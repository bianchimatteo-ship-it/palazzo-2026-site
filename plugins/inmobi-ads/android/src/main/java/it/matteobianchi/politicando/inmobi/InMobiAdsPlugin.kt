package it.matteobianchi.politicando.inmobi

import android.app.Activity
import android.preference.PreferenceManager
import android.util.TypedValue
import android.view.Gravity
import android.widget.FrameLayout
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.ump.ConsentDebugSettings
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import com.inmobi.ads.AdMetaInfo
import com.inmobi.ads.InMobiAdRequestStatus
import com.inmobi.ads.InMobiBanner
import com.inmobi.ads.InMobiInterstitial
import com.inmobi.ads.listeners.BannerAdEventListener
import com.inmobi.ads.listeners.InterstitialAdEventListener
import com.inmobi.sdk.InMobiSdk
import com.inmobi.sdk.SdkInitializationListener
import org.json.JSONObject
import java.util.UUID

/**
 * Capacitor bridge to the InMobi SDK 11.5.1 (the only ad provider of Politicando). Contract with the game: src/data/repositories/inmobi-adapter.js and plugins/inmobi-ads/src/definitions.ts.
 *
 *  - Consent first: Google UMP (IAB TCF). No ad request is made until `canRequestAds` is true; the TCF string UMP stores (`IABTCF_TCString`) is passed to InMobi.
 *  - The SDK is initialised with the ACCOUNT ID given by the remote configuration (it is neither the App Key nor a placement id).
 *  - Nothing about the player is sent: no location, birth date, gender or career data (none of InMobiSdk.setLocation/setYearOfBirth/setGender is ever called).
 *  - A rewarded video is "rewarded" ONLY when InterstitialAdEventListener.onRewardsUnlocked fires, once for each show; a closed or failed video is never rewarded.
 *  - Every SDK call is wrapped: a missing SDK, an exception or a refused request answers "not shown / not ready" to the game and never crashes it.
 */
@CapacitorPlugin(name = "InMobiAds")
class InMobiAdsPlugin : Plugin() {
    private data class Full(val ad: InMobiInterstitial, var loaded: Boolean = false, var loadCall: PluginCall? = null, var showCall: PluginCall? = null, var rewarded: Boolean = false, var showing: Boolean = false)

    private val full = HashMap<String, Full>()
    private var banner: InMobiBanner? = null
    private var sdkReady = false
    private var initializing = false
    private var consentInfo: ConsentInformation? = null

    private fun activityOrNull(): Activity? = try { activity } catch (e: Throwable) { null }
    private fun ok(extra: JSObject.() -> Unit = {}) = JSObject().apply { put("ok", true); extra() }
    private fun main(block: () -> Unit) { val a = activityOrNull(); if (a == null) throw IllegalStateException("no-activity"); a.runOnUiThread { try { block() } catch (e: Throwable) { /* handled by the caller's callbacks */ } } }

    // ---------------------------------------------------------------- consent
    @PluginMethod
    fun requestConsent(call: PluginCall) {
        val a = activityOrNull()
        if (a == null) { call.resolve(consentResult(false, "UNKNOWN", false)); return }
        try {
            val info = UserMessagingPlatform.getConsentInformation(a)
            consentInfo = info
            val params = ConsentRequestParameters.Builder().setTagForUnderAgeOfConsent(false)   // the audience is 14+: no under-age tag
            if (call.getBoolean("testMode", false) == true) params.setConsentDebugSettings(ConsentDebugSettings.Builder(a).build())
            a.runOnUiThread {
                info.requestConsentInfoUpdate(a, params.build(), {
                    UserMessagingPlatform.loadAndShowConsentFormIfRequired(a) { formError ->
                        call.resolve(consentResult(info.canRequestAds(), statusName(info), privacyRequired(info)))
                    }
                }, { call.resolve(consentResult(info.canRequestAds(), statusName(info), false)) })
            }
        } catch (e: Throwable) { call.resolve(consentResult(false, "UNKNOWN", false)) }
    }

    // The privacy options entry must stay available after a refusal and after a form error: it depends only on what UMP says is required.
    private fun privacyRequired(info: ConsentInformation) = info.privacyOptionsRequirementStatus == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
    private fun statusName(info: ConsentInformation) = when (info.consentStatus) {
        ConsentInformation.ConsentStatus.REQUIRED -> "REQUIRED"
        ConsentInformation.ConsentStatus.NOT_REQUIRED -> "NOT_REQUIRED"
        ConsentInformation.ConsentStatus.OBTAINED -> "OBTAINED"
        else -> "UNKNOWN"
    }
    private fun consentResult(can: Boolean, status: String, options: Boolean) = JSObject().apply { put("canRequestAds", can); put("status", status); put("privacyOptionsRequired", options) }

    // The privacy options form (accept, refuse, change, WITHDRAW the consent). It works after a refusal too: it does not need `canRequestAds`. The answer carries the state AFTER the form, so the game can start the SDK
    // when the consent was given later, or stop using it when it was withdrawn.
    @PluginMethod
    fun showPrivacyOptions(call: PluginCall) {
        val a = activityOrNull()
        if (a == null) { call.resolve(consentResult(false, "UNKNOWN", false)); return }
        try {
            val info = consentInfo ?: UserMessagingPlatform.getConsentInformation(a).also { consentInfo = it }
            a.runOnUiThread {
                try { UserMessagingPlatform.showPrivacyOptionsForm(a) { call.resolve(consentResult(info.canRequestAds(), statusName(info), privacyRequired(info))) } }
                catch (e: Throwable) { call.resolve(consentResult(info.canRequestAds(), statusName(info), privacyRequired(info))) }
            }
        } catch (e: Throwable) { call.resolve(consentResult(false, "UNKNOWN", false)) }
    }

    // The consent handed to InMobi: GDPR applies / consent available / the IAB TCF string that UMP keeps in the default SharedPreferences.
    private fun inmobiConsent(a: Activity): JSONObject {
        val prefs = PreferenceManager.getDefaultSharedPreferences(a)
        val tc = prefs.getString("IABTCF_TCString", null)
        val gdpr = prefs.getInt("IABTCF_gdprApplies", 0)
        return JSONObject().apply {
            put("gdpr", if (gdpr == 1) "1" else "0")
            put(InMobiSdk.IM_GDPR_CONSENT_AVAILABLE, consentInfo?.canRequestAds() == true)
            if (!tc.isNullOrEmpty()) put(InMobiSdk.IM_GDPR_CONSENT_IAB, tc)
        }
    }

    // ---------------------------------------------------------------- SDK
    @PluginMethod
    fun initialize(call: PluginCall) {
        val a = activityOrNull()
        val account = call.getString("accountId")
        if (a == null || account.isNullOrBlank()) { call.resolve(JSObject().apply { put("ok", false); put("code", "not-configured") }); return }
        if (consentInfo?.canRequestAds() != true) { call.resolve(JSObject().apply { put("ok", false); put("code", "no-consent") }); return }
        if (sdkReady) { call.resolve(ok()); return }
        if (initializing) { call.resolve(JSObject().apply { put("ok", false); put("code", "busy") }); return }
        initializing = true
        try {
            a.runOnUiThread {
                try {
                    if (call.getBoolean("testMode", false) == true) InMobiSdk.setLogLevel(InMobiSdk.LogLevel.DEBUG) else InMobiSdk.setLogLevel(InMobiSdk.LogLevel.NONE)
                    InMobiSdk.setIsAgeRestricted(false)
                    InMobiSdk.init(a.applicationContext, account, inmobiConsent(a), object : SdkInitializationListener {
                        override fun onInitializationComplete(error: Error?) {
                            initializing = false
                            sdkReady = error == null
                            call.resolve(if (error == null) ok() else JSObject().apply { put("ok", false); put("code", "init-failed") })
                        }
                    })
                } catch (e: Throwable) { initializing = false; call.resolve(JSObject().apply { put("ok", false); put("code", "error") }) }
            }
        } catch (e: Throwable) { initializing = false; call.resolve(JSObject().apply { put("ok", false); put("code", "error") }) }
    }

    // ---------------------------------------------------------------- rewarded / interstitial (one class for both: the placement tells which)
    @PluginMethod
    fun loadAd(call: PluginCall) {
        val a = activityOrNull()
        val format = call.getString("format") ?: ""
        val placement = call.getString("placementId")?.toLongOrNull()
        if (!sdkReady || a == null || placement == null || (format != "rewarded" && format != "interstitial")) { call.resolve(JSObject().apply { put("ready", false); put("code", if (!sdkReady) "not-initialized" else "invalid") }); return }
        val current = full[format]
        if (current != null && current.loaded && !current.showing) { call.resolve(JSObject().apply { put("ready", true) }); return }
        if (current != null && current.loadCall != null) { call.resolve(JSObject().apply { put("ready", false); put("code", "loading") }); return }
        try {
            a.runOnUiThread {
                try {
                    lateinit var holder: Full
                    val listener = object : InterstitialAdEventListener() {
                        override fun onAdLoadSucceeded(ad: InMobiInterstitial, info: AdMetaInfo) { holder.loaded = true; holder.loadCall?.resolve(JSObject().apply { put("ready", true) }); holder.loadCall = null }
                        override fun onAdLoadFailed(ad: InMobiInterstitial, status: InMobiAdRequestStatus) { holder.loaded = false; holder.loadCall?.resolve(JSObject().apply { put("ready", false); put("code", status.statusCode.name) }); holder.loadCall = null; full.remove(format) }
                        override fun onRewardsUnlocked(ad: InMobiInterstitial, rewards: MutableMap<Any, Any>?) { if (format == "rewarded") holder.rewarded = true }   // the only place that rewards
                        override fun onAdDismissed(ad: InMobiInterstitial) { finishShow(format, holder, true) }
                        override fun onAdDisplayFailed(ad: InMobiInterstitial) { finishShow(format, holder, false) }
                    }
                    holder = Full(InMobiInterstitial(a, placement, listener), loadCall = call)
                    full[format] = holder
                    holder.ad.load()
                } catch (e: Throwable) { full.remove(format); call.resolve(JSObject().apply { put("ready", false); put("code", "error") }) }
            }
        } catch (e: Throwable) { call.resolve(JSObject().apply { put("ready", false); put("code", "error") }) }
    }

    private fun finishShow(format: String, holder: Full, displayed: Boolean) {
        val call = holder.showCall ?: return
        holder.showCall = null; holder.showing = false
        val earned = displayed && holder.rewarded && format == "rewarded"
        full.remove(format)   // an ad is shown once: the next one is a new object (a repeated callback cannot reward again)
        call.resolve(JSObject().apply {
            put("shown", displayed)
            if (format == "rewarded") put("rewarded", earned)
            if (earned) put("completionId", "imb-" + UUID.randomUUID().toString().replace("-", ""))
        })
    }

    @PluginMethod
    fun showAd(call: PluginCall) {
        val a = activityOrNull()
        val format = call.getString("format") ?: ""
        val holder = full[format]
        if (a == null || holder == null || !holder.loaded || holder.showing || holder.showCall != null) { call.resolve(JSObject().apply { put("shown", false); put("rewarded", false); put("code", "not-ready") }); return }
        try {
            a.runOnUiThread {
                try {
                    if (!holder.ad.isReady()) { full.remove(format); call.resolve(JSObject().apply { put("shown", false); put("rewarded", false); put("code", "not-ready") }); return@runOnUiThread }
                    holder.showCall = call; holder.showing = true; holder.rewarded = false
                    holder.ad.show()
                } catch (e: Throwable) { holder.showCall = null; holder.showing = false; full.remove(format); call.resolve(JSObject().apply { put("shown", false); put("rewarded", false); put("code", "error") }) }
            }
        } catch (e: Throwable) { call.resolve(JSObject().apply { put("shown", false); put("rewarded", false); put("code", "error") }) }
    }

    // ---------------------------------------------------------------- banner
    @PluginMethod
    fun showBanner(call: PluginCall) {
        val a = activityOrNull()
        val placement = call.getString("placementId")?.toLongOrNull()
        if (!sdkReady || a == null || placement == null) { call.resolve(JSObject().apply { put("shown", false); put("code", "not-initialized") }); return }
        if (banner != null) { call.resolve(JSObject().apply { put("shown", true) }); return }
        val margin = call.getInt("margin", 0) ?: 0
        try {
            a.runOnUiThread {
                try {
                    val unit = { dp: Int -> TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp.toFloat(), a.resources.displayMetrics).toInt() }
                    val view = InMobiBanner(a, placement)
                    view.setEnableAutoRefresh(true)
                    view.setListener(object : BannerAdEventListener() {})
                    val params = FrameLayout.LayoutParams(unit(320), unit(50), Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL).apply { bottomMargin = unit(margin) }
                    a.addContentView(view, params)
                    banner = view
                    view.load()
                    call.resolve(JSObject().apply { put("shown", true) })
                } catch (e: Throwable) { call.resolve(JSObject().apply { put("shown", false); put("code", "error") }) }
            }
        } catch (e: Throwable) { call.resolve(JSObject().apply { put("shown", false); put("code", "error") }) }
    }

    @PluginMethod
    fun hideBanner(call: PluginCall) {
        val a = activityOrNull()
        val view = banner
        banner = null
        if (a == null || view == null) { call.resolve(); return }
        try { a.runOnUiThread { try { (view.parent as? android.view.ViewGroup)?.removeView(view); view.destroy() } catch (e: Throwable) { /* ignored */ }; call.resolve() } } catch (e: Throwable) { call.resolve() }
    }

    @PluginMethod
    fun requestTracking(call: PluginCall) { call.resolve(JSObject().apply { put("status", "unavailable") }) }   // iOS only
}
