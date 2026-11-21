import Foundation
import UIKit
import Capacitor
import InMobiSDK
import UserMessagingPlatform
import AppTrackingTransparency

/// Capacitor bridge to the InMobi SDK 11.5.0 (the only ad provider of Politicando). Contract with the game: src/data/repositories/inmobi-adapter.js and plugins/inmobi-ads/src/definitions.ts.
///
///  - Consent first: Google UMP (IAB TCF). No ad request is made until `canRequestAds` is true; the TCF string UMP stores (`IABTCF_TCString`) is passed to InMobi.
///  - The SDK is initialised with the ACCOUNT ID given by the remote configuration (neither the App Key nor a placement id).
///  - Nothing about the player is sent: no location, birth date, gender or career data. ATT is asked only when `requestTracking` is called (the remote configuration decides: off by default).
///  - A rewarded video is "rewarded" ONLY when `interstitial(_:rewardActionCompletedWithRewards:)` fires, once for each show; a closed or failed video is never rewarded.
///  - NOT compiled in the repository's CI (no macOS/Xcode there): see docs/inmobi.md for what was and was not verified.
@objc(InMobiAdsPlugin)
public class InMobiAdsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "InMobiAdsPlugin"
    public let jsName = "InMobiAds"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestConsent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "loadAd", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showAd", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showBanner", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hideBanner", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showPrivacyOptions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestTracking", returnType: CAPPluginReturnPromise)
    ]

    /// One full-screen ad (rewarded or interstitial: both are `IMInterstitial`, the placement tells which).
    private final class Full: NSObject, IMInterstitialDelegate {
        let format: String
        var ad: IMInterstitial?
        var loaded = false
        var loadCall: CAPPluginCall?
        var showCall: CAPPluginCall?
        var rewarded = false
        var showing = false
        var onDone: ((String) -> Void)?
        init(format: String) { self.format = format }

        func interstitialDidFinishLoading(_ interstitial: IMInterstitial) { loaded = true; loadCall?.resolve(["ready": true]); loadCall = nil }
        func interstitial(_ interstitial: IMInterstitial, didFailToLoadWithError error: IMRequestStatus) { loaded = false; loadCall?.resolve(["ready": false, "code": "load-failed"]); loadCall = nil; onDone?(format) }
        func interstitial(_ interstitial: IMInterstitial, rewardActionCompletedWithRewards rewards: [String: Any]) { if format == "rewarded" { rewarded = true } }   // the only place that rewards
        func interstitialDidDismiss(_ interstitial: IMInterstitial) { finish(displayed: true) }
        func interstitial(_ interstitial: IMInterstitial, didFailToPresentWithError error: IMRequestStatus) { finish(displayed: false) }
        func interstitialWillPresent(_ interstitial: IMInterstitial) {}
        func interstitialDidPresent(_ interstitial: IMInterstitial) {}
        func interstitialWillDismiss(_ interstitial: IMInterstitial) {}
        func interstitial(_ interstitial: IMInterstitial, didInteractWithParams params: [String: Any]?) {}
        func userWillLeaveApplicationFromInterstitial(_ interstitial: IMInterstitial) {}   // the protocol's real name (Xcode: «nearly matches»); the old spelling never got called

        private func finish(displayed: Bool) {
            guard let call = showCall else { return }
            showCall = nil; showing = false
            let earned = displayed && rewarded && format == "rewarded"
            var out: [String: Any] = ["shown": displayed]
            if format == "rewarded" { out["rewarded"] = earned }
            if earned { out["completionId"] = "imb-" + UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased() }
            onDone?(format)   // an ad is shown once: the next one is a new object (a repeated callback cannot reward again)
            call.resolve(out)
        }
    }

    private var full: [String: Full] = [:]
    private var banner: IMBanner?
    private var sdkReady = false
    private var initializing = false

    private func topController() -> UIViewController? {
        var controller = bridge?.viewController
        while let presented = controller?.presentedViewController { controller = presented }
        return controller
    }

    // MARK: consent
    // Google User Messaging Platform 3.1.0 (module `UserMessagingPlatform`): the 3.x Swift API drops the `UMP` prefix (RequestParameters, ConsentInformation, ConsentForm, FormStatus, ConsentStatus,
    // PrivacyOptionsRequirementStatus), `sharedInstance` is `shared` and `tagForUnderAgeOfConsent` is `isTaggedForUnderAgeOfConsent`. The forms are `async throws` and main-actor. The calls below follow the usage of the
    // Capacitor AdMob plugin 8.3.0, which is built against this same package (swift-package-manager-google-user-messaging-platform, from 3.1.0).
    // Ads stay blocked until `ConsentInformation.shared.canRequestAds` is true: `initialize` and every ad call check it.
    @objc func requestConsent(_ call: CAPPluginCall) {
        let parameters = RequestParameters()
        parameters.isTaggedForUnderAgeOfConsent = false   // the audience is 14+
        ConsentInformation.shared.requestConsentInfoUpdate(with: parameters) { [weak self] error in
            // the state is refreshed; on an error nothing is shown and whatever the SDK says about `canRequestAds` (true only if consent was already obtained) is reported as it is
            guard error == nil else { call.resolve(InMobiAdsPlugin.consentResult()); return }
            Task { @MainActor in
                guard let self = self, let controller = self.topController(), ConsentInformation.shared.formStatus == FormStatus.available else { call.resolve(InMobiAdsPlugin.consentResult()); return }
                do { try await ConsentForm.loadAndPresentIfRequired(from: controller) } catch { /* the form failed: the status below decides */ }
                call.resolve(InMobiAdsPlugin.consentResult())
            }
        }
    }

    private static func consentResult() -> [String: Any] {
        let info = ConsentInformation.shared
        let status: String
        switch info.consentStatus {
        case ConsentStatus.required: status = "REQUIRED"
        case ConsentStatus.notRequired: status = "NOT_REQUIRED"
        case ConsentStatus.obtained: status = "OBTAINED"
        default: status = "UNKNOWN"
        }
        return ["canRequestAds": info.canRequestAds, "status": status, "privacyOptionsRequired": info.privacyOptionsRequirementStatus == PrivacyOptionsRequirementStatus.required]
    }

    // The privacy options form (accept, refuse, change, WITHDRAW the consent). It works after a refusal too: it does not need `canRequestAds`. As on Android (1.0.2), the answer carries the state AFTER the form
    // (also when the form could not be shown), so the game can start the SDK when the consent was given later, or stop using it when it was withdrawn.
    @objc func showPrivacyOptions(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let controller = self.topController() else { call.resolve(InMobiAdsPlugin.consentResult()); return }
            do { try await ConsentForm.presentPrivacyOptionsForm(from: controller) } catch { /* the user can try again */ }
            call.resolve(InMobiAdsPlugin.consentResult())
        }
    }

    /// The consent handed to InMobi: GDPR applies / consent available / the IAB TCF string that UMP keeps in UserDefaults.
    private func inmobiConsent() -> [String: Any] {
        let defaults = UserDefaults.standard
        var consent: [String: Any] = ["gdpr": defaults.integer(forKey: "IABTCF_gdprApplies") == 1 ? "1" : "0", "gdpr_consent_available": ConsentInformation.shared.canRequestAds ? "true" : "false"]   // the official sample passes the strings "true"/"false"
        if let tc = defaults.string(forKey: "IABTCF_TCString"), !tc.isEmpty { consent["gdpr_consent"] = tc }
        return consent
    }

    // MARK: SDK
    @objc func initialize(_ call: CAPPluginCall) {
        guard let account = call.getString("accountId"), !account.isEmpty else { call.resolve(["ok": false, "code": "not-configured"]); return }
        guard ConsentInformation.shared.canRequestAds else { call.resolve(["ok": false, "code": "no-consent"]); return }
        if sdkReady { call.resolve(["ok": true]); return }
        if initializing { call.resolve(["ok": false, "code": "busy"]); return }
        initializing = true
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { call.resolve(["ok": false, "code": "error"]); return }   // the plugin is gone: nothing to initialise
            IMSdk.setLogLevel(call.getBool("testMode") == true ? .debug : .none)
            IMSdk.setIsAgeRestricted(false)
            IMSdk.initWithAccountID(account, consentDictionary: self.inmobiConsent()) { [weak self] error in   // weak again: the SDK keeps this callback, it must not keep the plugin
                self?.initializing = false
                self?.sdkReady = (error == nil)
                call.resolve(error == nil ? ["ok": true] : ["ok": false, "code": "init-failed"])
            }
        }
    }

    // MARK: rewarded / interstitial
    @objc func loadAd(_ call: CAPPluginCall) {
        let format = call.getString("format") ?? ""
        guard sdkReady, ConsentInformation.shared.canRequestAds, let placement = Int64(call.getString("placementId") ?? ""), format == "rewarded" || format == "interstitial" else {
            call.resolve(["ready": false, "code": sdkReady ? "invalid" : "not-initialized"]); return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { call.resolve(["ready": false, "code": "error"]); return }
            if let current = self.full[format] {
                if current.loaded && !current.showing { call.resolve(["ready": true]); return }
                if current.loadCall != nil { call.resolve(["ready": false, "code": "loading"]); return }
            }
            let holder = Full(format: format)
            holder.onDone = { [weak self] key in self?.full.removeValue(forKey: key) }
            holder.loadCall = call
            holder.ad = IMInterstitial(placementId: placement, delegate: holder)
            self.full[format] = holder
            holder.ad?.load()
        }
    }

    @objc func showAd(_ call: CAPPluginCall) {
        let format = call.getString("format") ?? ""
        DispatchQueue.main.async {
            guard let holder = self.full[format], holder.loaded, !holder.showing, holder.showCall == nil, let ad = holder.ad, let controller = self.topController(), ad.isReady() else {
                self.full.removeValue(forKey: format)
                call.resolve(["shown": false, "rewarded": false, "code": "not-ready"]); return
            }
            holder.showCall = call; holder.showing = true; holder.rewarded = false
            ad.show(from: controller)
        }
    }

    // MARK: banner
    @objc func showBanner(_ call: CAPPluginCall) {
        guard sdkReady, ConsentInformation.shared.canRequestAds, let placement = Int64(call.getString("placementId") ?? "") else { call.resolve(["shown": false, "code": "not-initialized"]); return }
        let margin = CGFloat(call.getInt("margin") ?? 0)
        DispatchQueue.main.async {
            if self.banner != nil { call.resolve(["shown": true]); return }
            guard let view = self.bridge?.viewController?.view else { call.resolve(["shown": false, "code": "no-view"]); return }
            let unit = IMBanner(frame: CGRect(x: 0, y: 0, width: 320, height: 50), placementId: placement)
            unit.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(unit)
            NSLayoutConstraint.activate([
                unit.widthAnchor.constraint(equalToConstant: 320), unit.heightAnchor.constraint(equalToConstant: 50),
                unit.centerXAnchor.constraint(equalTo: view.centerXAnchor),
                unit.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -margin)
            ])
            self.banner = unit
            unit.load()
            call.resolve(["shown": true])
        }
    }

    @objc func hideBanner(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.banner?.removeFromSuperview(); self.banner = nil; call.resolve() }
    }

    // MARK: ATT (only when the remote configuration asks for it)
    @objc func requestTracking(_ call: CAPPluginCall) {
        // The prompt needs NSUserTrackingUsageDescription in Info.plist (NOT present: the app does not ask for tracking today; without the key the system would crash the app, so it is never called).
        if #available(iOS 14, *), Bundle.main.object(forInfoDictionaryKey: "NSUserTrackingUsageDescription") != nil {
            ATTrackingManager.requestTrackingAuthorization { status in
                let name: String
                switch status { case .authorized: name = "authorized"; case .denied: name = "denied"; case .restricted: name = "restricted"; default: name = "notDetermined" }
                call.resolve(["status": name])
            }
        } else { call.resolve(["status": "unavailable"]) }
    }
}
