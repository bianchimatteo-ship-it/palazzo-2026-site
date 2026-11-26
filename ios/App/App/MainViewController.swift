import UIKit
import WebKit
import Capacitor

// The web view of the app tells the game which build it is: «PolitikandoApp/ios/<version>/<build>/<release|debug>» at the end of its user agent (src/core/welcome-reward.js reads it
// for the thank-you reward of one exact release). Nothing is sent anywhere; iOS stays without advertising.
class MainViewController: CAPBridgeViewController {
    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        let info = Bundle.main.infoDictionary ?? [:]
        let version = info["CFBundleShortVersionString"] as? String ?? "0"
        let build = info["CFBundleVersion"] as? String ?? "0"
        #if DEBUG
        let kind = "debug"
        #else
        let kind = "release"
        #endif
        let marker = "PolitikandoApp/ios/\(version)/\(build)/\(kind)"
        let current = configuration.applicationNameForUserAgent ?? ""
        configuration.applicationNameForUserAgent = current.isEmpty ? marker : "\(current) \(marker)"
        return configuration
    }
}
