package it.matteobianchi.politicando.appodeal

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.widget.FrameLayout
import com.appodeal.ads.Appodeal
import com.appodeal.ads.BannerCallbacks
import com.appodeal.ads.InterstitialCallbacks
import com.appodeal.ads.RewardedVideoCallbacks
import com.appodeal.ads.initializing.ApdInitializationCallback
import com.appodeal.ads.initializing.ApdInitializationError
import com.appodeal.consent.ConsentInfoUpdateCallback
import com.appodeal.consent.ConsentManager
import com.appodeal.consent.ConsentManagerError
import com.appodeal.consent.ConsentStatus
import com.appodeal.consent.ConsentUpdateRequestParameters
import com.appodeal.consent.OnConsentFormDismissedListener
import com.appodeal.consent.PrivacyOptionsRequirementStatus
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.UUID

/**
 * Capacitor bridge to the Appodeal SDK 4.4.0 (Android). Contract with the game: src/data/repositories/appodeal-adapter.js and plugins/appodeal-ads/src/definitions.ts.
 *
 *  - Consent first: Appodeal's ConsentManager (GDPR). No ad request is made until `ConsentManager.canShowAds()` is true; the SDK is initialised afterwards and reads the consent state itself.
 *  - Appodeal's automatic network connection is kept: only the app key is given, never a network id. No AdMob, Meta or InMobi SDK is wired by this code.
 *  - Placement `default` for every show. Test mode (`Appodeal.setTesting`) comes from the game's configuration, TEST by default; nothing here can switch production on by itself.
 *  - Nothing about the player (position, birth date, gender, simulated political choices) is ever passed to the SDK: no setUserId, no custom rules, no segments.
 *  - A rewarded video is "rewarded" ONLY after `onRewardedVideoFinished`, once for each show; a video closed early, failed or expired is never rewarded.
 *  - Every SDK call is wrapped: an exception, a missing activity or a refused request answers "not shown / not ready" and never crashes or blocks the game; every load has a timeout.
 */
@CapacitorPlugin(name = "AppodealAds")
class AppodealAdsPlugin : Plugin() {
    private companion object {
        const val TAG = "PolitAppodeal"
        const val PLACEMENT = "default"
        const val LOAD_TIMEOUT_MS = 20_000L
    }

    private val handler = Handler(Looper.getMainLooper())
    private var sdkReady = false
    private var initializing = false
    private var callbacksSet = false
    private var banner: com.appodeal.ads.BannerView? = null

    private val loaded = HashMap<String, Boolean>()
    private val loadCalls = HashMap<String, PluginCall>()
    private val loadTimeouts = HashMap<String, Runnable>()
    private val showCalls = HashMap<String, PluginCall>()
    private var rewardEarned = false

    private fun activityOrNull(): Activity? = try { activity } catch (e: Throwable) { null }
    private fun type(format: String): Int? = when (format) { "interstitial" -> Appodeal.INTERSTITIAL; "rewarded" -> Appodeal.REWARDED_VIDEO; else -> null }
    private fun obj(vararg pairs: Pair<String, Any?>) = JSObject().apply { for ((k, v) in pairs) put(k, v) }

    // ---------------------------------------------------------------- consent (Appodeal ConsentManager)
    private fun statusName(): String = when (ConsentManager.status) {
        ConsentStatus.Required -> "REQUIRED"
        ConsentStatus.NotRequired -> "NOT_REQUIRED"
        ConsentStatus.Obtained -> "OBTAINED"
        else -> "UNKNOWN"
    }
    private fun privacyRequired() = ConsentManager.getPrivacyOptionsRequirementStatus() == PrivacyOptionsRequirementStatus.Required
    private fun consentResult() = obj("canRequestAds" to ConsentManager.canShowAds(), "status" to statusName(), "privacyOptionsRequired" to privacyRequired())
    private fun failedConsent() = obj("canRequestAds" to false, "status" to "UNKNOWN", "privacyOptionsRequired" to false)

    @PluginMethod
    fun requestConsent(call: PluginCall) {
        val a = activityOrNull()
        val key = call.getString("appKey")
        if (a == null || key.isNullOrBlank()) { call.resolve(failedConsent()); return }
        try {
            a.runOnUiThread {
                try {
                    // The consent information is updated at EVERY launch; the form is shown only when it is required (GDPR / EEA, Italy). The audience is 14+: no under-age tag.
                    ConsentManager.requestConsentInfoUpdate(
                        ConsentUpdateRequestParameters(a, key, false, "Appodeal", Appodeal.getVersion()),
                        object : ConsentInfoUpdateCallback {
                            override fun onUpdated() {
                                try {
                                    ConsentManager.loadAndShowConsentFormIfRequired(a, object : OnConsentFormDismissedListener {
                                        override fun onConsentFormDismissed(error: ConsentManagerError?) {
                                            if (error != null) Log.w(TAG, "consent form: $error")
                                            call.resolve(consentResult())
                                        }
                                    })
                                } catch (e: Throwable) { call.resolve(consentResult()) }
                            }
                            override fun onFailed(error: ConsentManagerError) { Log.w(TAG, "consent update failed: $error"); call.resolve(consentResult()) }
                        }
                    )
                } catch (e: Throwable) { call.resolve(failedConsent()) }
            }
        } catch (e: Throwable) { call.resolve(failedConsent()) }
    }

    // The privacy options form (accept, refuse, change, withdraw). The answer carries the state AFTER the form.
    @PluginMethod
    fun showPrivacyOptions(call: PluginCall) {
        val a = activityOrNull()
        if (a == null) { call.resolve(failedConsent()); return }
        try {
            a.runOnUiThread {
                try {
                    ConsentManager.showPrivacyOptionsForm(a, object : OnConsentFormDismissedListener {
                        override fun onConsentFormDismissed(error: ConsentManagerError?) { call.resolve(consentResult()) }
                    })
                } catch (e: Throwable) { call.resolve(consentResult()) }
            }
        } catch (e: Throwable) { call.resolve(failedConsent()) }
    }

    // ---------------------------------------------------------------- SDK
    @PluginMethod
    fun initialize(call: PluginCall) {
        val a = activityOrNull()
        val key = call.getString("appKey")
        if (a == null || key.isNullOrBlank()) { call.resolve(obj("ok" to false, "code" to "not-configured")); return }
        if (!ConsentManager.canShowAds()) { call.resolve(obj("ok" to false, "code" to "no-consent")); return }
        if (sdkReady) { call.resolve(obj("ok" to true)); return }
        if (initializing) { call.resolve(obj("ok" to false, "code" to "busy")); return }
        initializing = true
        val test = call.getBoolean("testMode", true) != false   // TEST is the default
        try {
            a.runOnUiThread {
                try {
                    Appodeal.setTesting(test)
                    Appodeal.setLogLevel(if (test) com.appodeal.ads.utils.Log.LogLevel.verbose else com.appodeal.ads.utils.Log.LogLevel.none)
                    Appodeal.set728x90Banners(false)
                    setCallbacks()
                    Appodeal.initialize(a, key, Appodeal.INTERSTITIAL or Appodeal.REWARDED_VIDEO or Appodeal.BANNER_VIEW, object : ApdInitializationCallback {
                        override fun onInitializationFinished(errors: List<ApdInitializationError>?) {
                            initializing = false
                            sdkReady = true
                            if (errors != null && errors.isNotEmpty()) Log.w(TAG, "initialisation finished with ${errors.size} non-blocking error(s): $errors")
                            call.resolve(obj("ok" to true))
                        }
                    })
                } catch (e: Throwable) { initializing = false; Log.e(TAG, "initialize", e); call.resolve(obj("ok" to false, "code" to "error")) }
            }
        } catch (e: Throwable) { initializing = false; call.resolve(obj("ok" to false, "code" to "error")) }
    }

    private fun finishLoad(format: String, ready: Boolean, code: String? = null) {
        loaded[format] = ready
        loadTimeouts.remove(format)?.let { handler.removeCallbacks(it) }
        val call = loadCalls.remove(format) ?: return
        call.resolve(obj("ready" to ready, "code" to code).also { if (code == null) it.remove("code") })
    }

    private fun finishShow(format: String, shown: Boolean, rewarded: Boolean, code: String? = null) {
        val call = showCalls.remove(format) ?: return
        loaded[format] = false   // an ad is shown once; the SDK caches the next one by itself
        val earned = format == "rewarded" && shown && rewarded && rewardEarned
        if (format == "rewarded") rewardEarned = false
        call.resolve(JSObject().apply {
            put("shown", shown)
            if (format == "rewarded") put("rewarded", earned)
            if (earned) put("completionId", "apd-" + UUID.randomUUID().toString().replace("-", ""))
            if (code != null) put("code", code)
        })
    }

    private fun setCallbacks() {
        if (callbacksSet) return
        callbacksSet = true
        Appodeal.setInterstitialCallbacks(object : InterstitialCallbacks {
            override fun onInterstitialLoaded(isPrecache: Boolean) { Log.d(TAG, "interstitial loaded"); finishLoad("interstitial", true) }
            override fun onInterstitialFailedToLoad() { Log.d(TAG, "interstitial failed to load"); finishLoad("interstitial", false, "no-fill") }
            override fun onInterstitialShown() { Log.d(TAG, "interstitial shown") }
            override fun onInterstitialShowFailed() { Log.d(TAG, "interstitial show failed"); finishShow("interstitial", false, false, "show-failed") }
            override fun onInterstitialClicked() {}
            override fun onInterstitialClosed() { Log.d(TAG, "interstitial closed"); finishShow("interstitial", true, false) }
            override fun onInterstitialExpired() { loaded["interstitial"] = false }
        })
        Appodeal.setRewardedVideoCallbacks(object : RewardedVideoCallbacks {
            override fun onRewardedVideoLoaded(isPrecache: Boolean) { Log.d(TAG, "rewarded loaded"); finishLoad("rewarded", true) }
            override fun onRewardedVideoFailedToLoad() { Log.d(TAG, "rewarded failed to load"); finishLoad("rewarded", false, "no-fill") }
            override fun onRewardedVideoShown() { Log.d(TAG, "rewarded shown"); rewardEarned = false }
            override fun onRewardedVideoShowFailed() { Log.d(TAG, "rewarded show failed"); finishShow("rewarded", false, false, "show-failed") }
            override fun onRewardedVideoClicked() {}
            // The ONLY place that rewards: the SDK says the video was viewed to the end.
            override fun onRewardedVideoFinished(amount: Double, currency: String) { Log.d(TAG, "rewarded finished (official completion)"); rewardEarned = true }
            override fun onRewardedVideoClosed(finished: Boolean) { Log.d(TAG, "rewarded closed, finished=$finished"); finishShow("rewarded", true, finished) }
            override fun onRewardedVideoExpired() { loaded["rewarded"] = false }
        })
        Appodeal.setBannerCallbacks(object : BannerCallbacks {
            override fun onBannerLoaded(height: Int, isPrecache: Boolean) { Log.d(TAG, "banner loaded (height $height)") }
            override fun onBannerFailedToLoad() { Log.d(TAG, "banner failed to load") }
            override fun onBannerShown() { Log.d(TAG, "banner shown") }
            override fun onBannerShowFailed() { Log.d(TAG, "banner show failed") }
            override fun onBannerClicked() {}
            override fun onBannerExpired() {}
        })
    }

    // ---------------------------------------------------------------- interstitial / rewarded
    @PluginMethod
    fun loadAd(call: PluginCall) {
        val a = activityOrNull()
        val format = call.getString("format") ?: ""
        val t = type(format)
        if (!sdkReady || a == null || t == null) { call.resolve(obj("ready" to false, "code" to if (!sdkReady) "not-initialized" else "bad-request")); return }
        if (loaded[format] == true && Appodeal.isLoaded(t)) { call.resolve(obj("ready" to true)); return }
        if (loadCalls.containsKey(format)) { call.resolve(obj("ready" to false, "code" to "loading")); return }
        try {
            a.runOnUiThread {
                try {
                    if (Appodeal.isLoaded(t)) { loaded[format] = true; call.resolve(obj("ready" to true)); return@runOnUiThread }
                    loadCalls[format] = call
                    val timeout = Runnable { finishLoad(format, false, "timeout") }
                    loadTimeouts[format] = timeout
                    handler.postDelayed(timeout, LOAD_TIMEOUT_MS)
                    Appodeal.cache(a, t)
                } catch (e: Throwable) { loadCalls.remove(format); call.resolve(obj("ready" to false, "code" to "error")) }
            }
        } catch (e: Throwable) { call.resolve(obj("ready" to false, "code" to "error")) }
    }

    @PluginMethod
    fun showAd(call: PluginCall) {
        val a = activityOrNull()
        val format = call.getString("format") ?: ""
        val t = type(format)
        if (!sdkReady || a == null || t == null || showCalls.containsKey(format)) { call.resolve(obj("shown" to false, "rewarded" to false, "code" to "not-ready")); return }
        try {
            a.runOnUiThread {
                try {
                    if (!Appodeal.isLoaded(t)) { loaded[format] = false; call.resolve(obj("shown" to false, "rewarded" to false, "code" to "not-ready")); return@runOnUiThread }
                    showCalls[format] = call
                    rewardEarned = false
                    if (!Appodeal.show(a, t, PLACEMENT)) finishShow(format, false, false, "refused")
                } catch (e: Throwable) { Log.e(TAG, "show", e); showCalls.remove(format); call.resolve(obj("shown" to false, "rewarded" to false, "code" to "error")) }
            }
        } catch (e: Throwable) { call.resolve(obj("shown" to false, "rewarded" to false, "code" to "error")) }
    }

    // ---------------------------------------------------------------- banner (adaptive, in its own view above the bottom margin the game gives: it never covers the content)
    @PluginMethod
    fun showBanner(call: PluginCall) {
        val a = activityOrNull()
        if (!sdkReady || a == null) { call.resolve(obj("shown" to false, "code" to "not-initialized")); return }
        if (banner != null) { call.resolve(obj("shown" to true)); return }
        val margin = call.getInt("margin", 0) ?: 0
        try {
            a.runOnUiThread {
                try {
                    val unit = { dp: Int -> TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp.toFloat(), a.resources.displayMetrics).toInt() }
                    val view = Appodeal.getBannerView(a)
                    val params = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL).apply { bottomMargin = unit(margin) }
                    a.addContentView(view, params)
                    banner = view
                    val accepted = Appodeal.show(a, Appodeal.BANNER_VIEW, PLACEMENT)
                    if (!accepted) { (view.parent as? android.view.ViewGroup)?.removeView(view); banner = null }
                    call.resolve(obj("shown" to accepted))
                } catch (e: Throwable) { Log.e(TAG, "banner", e); call.resolve(obj("shown" to false, "code" to "error")) }
            }
        } catch (e: Throwable) { call.resolve(obj("shown" to false, "code" to "error")) }
    }

    @PluginMethod
    fun hideBanner(call: PluginCall) {
        val a = activityOrNull()
        val view = banner
        banner = null
        if (a == null || view == null) { call.resolve(); return }
        try { a.runOnUiThread { try { Appodeal.hide(a, Appodeal.BANNER_VIEW); (view.parent as? android.view.ViewGroup)?.removeView(view) } catch (e: Throwable) { /* ignored */ }; call.resolve() } } catch (e: Throwable) { call.resolve() }
    }

    @PluginMethod
    fun requestTracking(call: PluginCall) { call.resolve(obj("status" to "unavailable")) }   // iOS only
}
