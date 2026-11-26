package it.matteobianchi.politicando.appodeal

import android.app.Activity
import android.content.pm.ApplicationInfo
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.widget.FrameLayout
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.appodeal.ads.Appodeal
import com.appodeal.ads.BannerCallbacks
import com.appodeal.ads.InterstitialCallbacks
import com.appodeal.ads.RewardedVideoCallbacks
import com.appodeal.ads.initializing.ApdInitializationCallback
import com.appodeal.ads.initializing.ApdInitializationError
import com.appodeal.consent.ConsentDebugGeography
import com.appodeal.consent.ConsentDebugSettings
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
 *  - Placement `default` for every show, the two rewarded videos of the game included (poll bonus and personal funds): which reward a video gives is decided by the game from the button that asked for it, never by the placement. Test mode (`Appodeal.setTesting`) comes from the game's configuration, TEST by default; nothing here can switch production on by itself.
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
        const val BANNER_WAIT_MS = 6_000L
    }

    private val handler = Handler(Looper.getMainLooper())
    private var sdkReady = false
    private var initializing = false
    private var callbacksSet = false
    private var banner: com.appodeal.ads.BannerView? = null
    // The banner's own bottom margin (dp): the real system navigation-bar/gesture-bar inset, kept live by the
    // OnApplyWindowInsetsListener in showBanner(). Folded into notifyBannerHeight() below so the ONE number the game
    // reserves is the banner's true total footprint from the physical bottom of the screen, counted once — the game's
    // own CSS safe-area padding (env(safe-area-inset-bottom)) is for when there is NO banner, never added to this too.
    private var bannerMarginDp = 0
    private var bannerContentHeightDp = 0   // the last height Appodeal reported; re-sent (with the margin above) whenever the margin itself changes (e.g. a rotation)

    private val loaded = HashMap<String, Boolean>()
    private val loadCalls = HashMap<String, PluginCall>()
    private val loadTimeouts = HashMap<String, Runnable>()
    private val showCalls = HashMap<String, PluginCall>()
    private var rewardEarned = false

    private fun activityOrNull(): Activity? = try { activity } catch (e: Throwable) { null }
    private fun type(format: String): Int? = when (format) { "interstitial" -> Appodeal.INTERSTITIAL; "rewarded" -> Appodeal.REWARDED_VIDEO; else -> null }
    private fun obj(vararg pairs: Pair<String, Any?>) = JSObject().apply { for ((k, v) in pairs) put(k, v) }

    // The game reserves exactly this much space (dp, the same unit Appodeal's own callback reports and the WebView's CSS px
    // both use at the default device-width viewport) above its own bottom chrome: 0 the moment there is no banner to show.
    // `contentHeightDp` is the ad creative's own height (Appodeal's callback); bannerMarginDp (the real nav-bar/gesture-bar
    // inset the banner already sits above) is added on top, once, here — never also by the game's own CSS safe area.
    private fun notifyBannerHeight(contentHeightDp: Int) { bannerContentHeightDp = contentHeightDp; notifyListeners("bannerHeight", obj("heightDp" to (if (contentHeightDp > 0) contentHeightDp + bannerMarginDp else 0))) }

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

    // ---------------------------------------------------------------- GDPR/CMP debug (Debug builds only)
    // Forces Appodeal's CMP to behave as if this device were in the EEA, to test the GDPR form without a real
    // EEA device or a VPN. `BuildConfig.DEBUG` follows this module's own build type, which Gradle always matches
    // to the app's (debug app -> debug library); a Release build gets `null` here, and the SDK itself separately
    // refuses any debug settings in a release build ("[Appodeal CMP] Debug settings ignored - release build").
    // ---------------------------------------------------------------- Debug builds: test ads ONLY (native, final word)
    // Two independent signals, either one is enough: this module's `BuildConfig.DEBUG` and the HOST APP's
    // `ApplicationInfo.FLAG_DEBUGGABLE` (set by Gradle for every debuggable build and never for a normal Release).
    // Whatever the JavaScript side, the remote configuration or APPODEAL_MODE ask for, a debuggable build ALWAYS runs
    // `Appodeal.setTesting(true)`: there is no code path from a Debug build to a real ad request.
    private fun isDebugBuild(): Boolean {
        if (BuildConfig.DEBUG) return true
        return try { (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0 } catch (e: Throwable) { true }   // cannot tell: assume Debug (the safe side)
    }
    private fun effectiveTesting(requested: Boolean): Boolean = isDebugBuild() || requested

    private val APPODEAL_DEBUG_GEOGRAPHY: ConsentDebugGeography? = if (BuildConfig.DEBUG) ConsentDebugGeography.EEA else null

    // Hashed test-device ids allowed to receive the forced debug geography. Appodeal's CMP ignores the forced
    // geography for any device NOT listed here, and logs (logcat tag "ConsentManager") the hashed id of the
    // current device the first time it runs: "Add testDeviceIds = [\"<id>\"] to ConsentDebugSettings." Copy that
    // id into this list and rebuild to unlock the forced EEA flow on that phone. Empty by default: no device is
    // forced into the EEA flow until its id is added here.
    private val APPODEAL_DEBUG_TEST_DEVICE_IDS: List<String> = listOf(
        "5CC96CD4E66F284C249423DB2CA04F2D",   // phone x4z5iffapbwc8dhm (24116RACCG / obsidian_eea), logged 2026-11-22 testing the EEA debug flow
    )

    private fun applyDebugConsentSettings() {
        val geography = APPODEAL_DEBUG_GEOGRAPHY ?: return
        ConsentManager.debugSettings = ConsentDebugSettings(geography, APPODEAL_DEBUG_TEST_DEVICE_IDS)
    }

    @PluginMethod
    fun requestConsent(call: PluginCall) {
        val a = activityOrNull()
        val key = call.getString("appKey")
        if (a == null || key.isNullOrBlank()) { call.resolve(failedConsent()); return }
        try {
            a.runOnUiThread {
                try {
                    applyDebugConsentSettings()
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

    // Debug-only: clears Appodeal's own CMP/consent state (its SharedPreferences) so the GDPR form can be
    // re-tested from scratch on the same device. It touches ONLY Appodeal's consent storage, never the game's
    // saves (WebView localStorage/IndexedDB, Capacitor Preferences) which live in a separate storage area this
    // call never reaches. No-op (ok=false, code=not-debug) outside a Debug build.
    @PluginMethod
    fun resetConsentDebug(call: PluginCall) {
        if (!BuildConfig.DEBUG) { call.resolve(obj("ok" to false, "code" to "not-debug")); return }
        val ctx = try { context } catch (e: Throwable) { null }
        if (ctx == null) { call.resolve(obj("ok" to false, "code" to "no-context")); return }
        try {
            ConsentManager.revoke(ctx)
            sdkReady = false
            call.resolve(obj("ok" to true))
        } catch (e: Throwable) { Log.e(TAG, "resetConsentDebug", e); call.resolve(obj("ok" to false, "code" to "error")) }
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
        val requestedTest = call.getBoolean("testMode", true) != false   // TEST is the default
        val debugBuild = isDebugBuild()
        val test = effectiveTesting(requestedTest)   // a Debug build is ALWAYS test, even when production was asked for
        if (debugBuild && !requestedTest) Log.w(TAG, "production requested in a DEBUG build: refused, test ads forced")
        try {
            a.runOnUiThread {
                try {
                    Appodeal.setTesting(test)   // `test` is already forced to true in a Debug build (effectiveTesting)
                    // Kept on regardless of test/production: needed to monitor the first live rollouts (logcat tag "Appodeal"), not tied to test mode.
                    Appodeal.setLogLevel(com.appodeal.ads.utils.Log.LogLevel.verbose)
                    Appodeal.set728x90Banners(false)
                    setCallbacks()
                    Appodeal.setAutoCache(Appodeal.BANNER, true)   // the default; stated so that nothing can switch the banner cache off by accident
                    Appodeal.initialize(a, key, Appodeal.INTERSTITIAL or Appodeal.REWARDED_VIDEO or Appodeal.BANNER, object : ApdInitializationCallback {
                        override fun onInitializationFinished(errors: List<ApdInitializationError>?) {
                            initializing = false
                            sdkReady = true
                            if (debugBuild) Appodeal.setTesting(true)   // re-asserted once started: nothing can leave a Debug build in production
                            Log.d(TAG, "banner state after init: initialized=${Appodeal.isInitialized(Appodeal.BANNER)} autoCache=${Appodeal.isAutoCacheEnabled(Appodeal.BANNER)} loaded=${Appodeal.isLoaded(Appodeal.BANNER)} testing=$test")
                            if (errors != null && errors.isNotEmpty()) Log.w(TAG, "initialisation finished with ${errors.size} non-blocking error(s): $errors")
                            call.resolve(obj("ok" to true, "testing" to test, "debugBuild" to debugBuild, "productionRefused" to (debugBuild && !requestedTest)))
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
            // «loaded» = the SDK has an ad for the banner. A show asked for earlier (showBanner waiting for it) is done NOW, on this callback: no waiting for the next retry of the game.
            override fun onBannerLoaded(height: Int, isPrecache: Boolean) {
                Log.d(TAG, "banner LOADED (height ${height}dp, precache=$isPrecache, waitingForIt=${bannerCall != null})")
                bannerContentHeightDp = height
                val waiting = bannerCall
                if (waiting != null) attachAndShowBanner(waiting) else if (banner != null) notifyBannerHeight(height)
            }
            override fun onBannerFailedToLoad() {
                Log.d(TAG, "banner LOAD FAILED (no ad from any network: the SDK asks again by itself; waitingForIt=${bannerCall != null})")
                finishBannerWait(false, "no-fill")
            }
            override fun onBannerShown() { Log.d(TAG, "banner SHOWN (the SDK counts the impression)") }
            override fun onBannerShowFailed() { Log.d(TAG, "banner SHOW FAILED (the SDK refused to show it)"); removeBannerView(); notifyBannerHeight(0) }
            override fun onBannerClicked() {}
            override fun onBannerExpired() { Log.d(TAG, "banner expired") }
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

    // ---------------------------------------------------------------- banner
    // A native sibling of the WebView (Appodeal.BANNER_VIEW, added programmatically per Appodeal's own docs: getBannerView()
    // + addContentView()), bottom-anchored. Its bottom margin follows the real system navigation-bar/gesture-bar inset
    // (never a fixed guess), so the banner sits flush above it; the game reserves its OWN bottom chrome (tab bar, content
    // padding) by listening to the "bannerHeight" event this plugin fires (0 when there is nothing to show), rather than
    // this native code guessing the height of web content it cannot see. No fixed margin is passed in from JS.
    // The banner is shown ONLY when the SDK has an ad for it (the earlier version added the view and asked to show it at once, with nothing loaded: the SDK refused, the view was taken away, and the ad
    // that loaded a moment later found nobody). Now: loaded → show at once; not loaded → wait for onBannerLoaded for at most BANNER_WAIT_MS (shorter than the 8 s of the game's own limit), then answer
    // «not shown» and let the game ask again after its pause; a failure to load answers at once. One request at a time, one view at a time.
    private var bannerCall: PluginCall? = null
    private var bannerWait: Runnable? = null

    private fun removeBannerView() {
        val view = banner ?: return
        banner = null
        try { (view.parent as? android.view.ViewGroup)?.removeView(view) } catch (e: Throwable) { Log.w(TAG, "banner view removal", e) }
    }

    private fun finishBannerWait(shown: Boolean, code: String? = null) {
        bannerWait?.let { handler.removeCallbacks(it) }; bannerWait = null
        val call = bannerCall ?: return
        bannerCall = null
        call.resolve(obj("shown" to shown, "code" to code).also { if (code == null) it.remove("code") })
    }

    @PluginMethod
    fun showBanner(call: PluginCall) {
        val a = activityOrNull()
        if (!sdkReady || a == null) { Log.d(TAG, "showBanner: not ready (sdkReady=$sdkReady, activity=${a != null})"); call.resolve(obj("shown" to false, "code" to "not-initialized")); return }
        if (banner != null) { call.resolve(obj("shown" to true)); return }          // already on screen: never a second view
        if (bannerCall != null) { call.resolve(obj("shown" to false, "code" to "loading")); return }   // already waiting: never a second request
        try {
            a.runOnUiThread {
                try {
                    val loadedNow = Appodeal.isLoaded(Appodeal.BANNER)
                    Log.d(TAG, "showBanner: requested (initialized=${Appodeal.isInitialized(Appodeal.BANNER)} autoCache=${Appodeal.isAutoCacheEnabled(Appodeal.BANNER)} loaded=$loadedNow)")
                    if (!Appodeal.isAutoCacheEnabled(Appodeal.BANNER)) { Log.w(TAG, "banner autocache was OFF: switched on"); Appodeal.setAutoCache(Appodeal.BANNER, true) }
                    if (loadedNow) { bannerCall = call; attachAndShowBanner(call); return@runOnUiThread }
                    bannerCall = call
                    val timeout = Runnable { Log.d(TAG, "banner: nothing loaded within ${BANNER_WAIT_MS} ms (the game asks again after its pause)"); finishBannerWait(false, "timeout") }
                    bannerWait = timeout
                    handler.postDelayed(timeout, BANNER_WAIT_MS)
                } catch (e: Throwable) { Log.e(TAG, "banner", e); finishBannerWait(false, "error") }
            }
        } catch (e: Throwable) { call.resolve(obj("shown" to false, "code" to "error")) }
    }

    // On the UI thread, with an ad loaded: the view is created (once), added above the WebView, sits flush above the system bars, and the SDK is asked to show it.
    private fun attachAndShowBanner(call: PluginCall) {
        val a = activityOrNull()
        if (a == null || banner != null) { finishBannerWait(banner != null); return }
        try {
            val view = Appodeal.getBannerView(a)
            (view.parent as? android.view.ViewGroup)?.removeView(view)   // a view of a previous Activity (recreated) still has a parent: never add it twice
            val params = FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL)
            ViewCompat.setOnApplyWindowInsetsListener(view) { v, insets ->
                val navBottomPx = insets.getInsets(WindowInsetsCompat.Type.navigationBars() or WindowInsetsCompat.Type.displayCutout()).bottom
                val density = a.resources.displayMetrics.density
                val navBottomDp = if (density > 0f) (navBottomPx / density).toInt() else navBottomPx
                (v.layoutParams as FrameLayout.LayoutParams).bottomMargin = navBottomPx
                v.requestLayout()
                if (navBottomDp != bannerMarginDp) { bannerMarginDp = navBottomDp; if (bannerContentHeightDp > 0) notifyBannerHeight(bannerContentHeightDp) }
                insets
            }
            a.addContentView(view, params)
            view.bringToFront()   // above the WebView and whatever the game added later
            banner = view
            ViewCompat.requestApplyInsets(view)
            val accepted = Appodeal.show(a, Appodeal.BANNER_VIEW, PLACEMENT)
            Log.d(TAG, "banner show INVOKED: result=$accepted (view attached=${view.parent != null}, height=${bannerContentHeightDp}dp)")
            if (!accepted) { removeBannerView(); notifyBannerHeight(0); finishBannerWait(false, "refused"); return }
            notifyBannerHeight(bannerContentHeightDp)
            finishBannerWait(true)
        } catch (e: Throwable) { Log.e(TAG, "banner attach", e); removeBannerView(); notifyBannerHeight(0); finishBannerWait(false, "error") }
    }

    @PluginMethod
    fun hideBanner(call: PluginCall) {
        val a = activityOrNull()
        finishBannerWait(false, "hidden")
        val had = banner != null
        notifyBannerHeight(0)
        if (a == null || !had) { call.resolve(); return }
        try { a.runOnUiThread { try { Appodeal.hide(a, Appodeal.BANNER_VIEW); Log.d(TAG, "banner hidden"); removeBannerView() } catch (e: Throwable) { /* ignored */ }; call.resolve() } } catch (e: Throwable) { call.resolve() }
    }

    // The Activity is destroyed (a rotation, the system recreates it): the banner view belongs to it and is dropped; the game, which still wants it, asks again and the SDK's cached ad is shown at once.
    override fun handleOnDestroy() { try { finishBannerWait(false, "destroyed"); removeBannerView(); notifyBannerHeight(0) } catch (e: Throwable) { /* the plugin is going away */ }; super.handleOnDestroy() }

    // A line from the game's JavaScript (why a banner is or is not asked for): the WebView console does not reach logcat in a release build.
    @PluginMethod
    fun diagnostic(call: PluginCall) { Log.d(TAG, "js: ${call.getString("message") ?: ""}"); call.resolve() }

    @PluginMethod
    fun requestTracking(call: PluginCall) { call.resolve(obj("status" to "unavailable")) }   // iOS only

    // What the installed app is: its version name and code (from the package, the values Gradle wrote) and whether it is a debuggable build. The web layer uses it for the thank-you reward of one
    // exact release (src/core/welcome-reward.js): nothing is sent anywhere, no advertising is involved.
    @PluginMethod
    fun buildInfo(call: PluginCall) {
        try {
            val ctx = context
            val info = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
            @Suppress("DEPRECATION")
            val code = if (android.os.Build.VERSION.SDK_INT >= 28) info.longVersionCode.toString() else info.versionCode.toString()
            call.resolve(obj("platform" to "android", "version" to (info.versionName ?: ""), "build" to code, "debug" to isDebugBuild()))
        } catch (e: Throwable) { Log.e(TAG, "buildInfo", e); call.resolve(obj("platform" to "android", "version" to "", "build" to "", "debug" to true)) }
    }
}
