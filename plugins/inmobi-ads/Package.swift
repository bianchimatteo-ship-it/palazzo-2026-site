// swift-tools-version: 5.9
import PackageDescription

// Capacitor plugin `InMobiAds` (iOS). InMobi SDK 11.5.0 through its official Swift package; the consent form is Google's UMP (IAB TCF), used ONLY for the CMP: no Google Mobile Ads / AdMob SDK.
let package = Package(
    name: "PoliticandoInmobiAds",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "PoliticandoInmobiAds", targets: ["InMobiAdsPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/InMobi/InMobiSDK-Swift-Package", exact: "11.5.0"),
        .package(url: "https://github.com/googleads/swift-package-manager-google-user-messaging-platform.git", .upToNextMinor(from: "3.1.0"))
    ],
    targets: [
        .target(
            name: "InMobiAdsPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "InMobiSDK", package: "InMobiSDK-Swift-Package"),
                .product(name: "GoogleUserMessagingPlatform", package: "swift-package-manager-google-user-messaging-platform")
            ],
            path: "ios/Sources/InMobiAdsPlugin")
    ]
)
