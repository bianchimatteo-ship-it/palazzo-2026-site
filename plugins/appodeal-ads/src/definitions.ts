/** The full-screen formats of the game. The banner has its own calls. */
export type AdFormat = 'rewarded' | 'interstitial';

export interface ConsentResult {
  /** `true` only when Appodeal's consent manager says ads may be requested: consent obtained, or not required. */
  canRequestAds: boolean;
  /** Appodeal consent status: UNKNOWN | REQUIRED | NOT_REQUIRED | OBTAINED. */
  status: string;
  /** `true` when the user must be offered a way to change the choice (privacy options form). */
  privacyOptionsRequired: boolean;
}

export interface AppodealAdsPlugin {
  /** Consent first (no ad request happens before it): updates the consent information and shows Appodeal's form only when it is required. */
  requestConsent(options: { appKey: string; testMode?: boolean }): Promise<ConsentResult>;
  /** Initialises the Appodeal SDK with the Android app key. Fails when there is no consent. `testMode` is `Appodeal.setTesting`. */
  initialize(options: { appKey: string; testMode?: boolean }): Promise<{ ok: boolean; code?: string }>;
  /** Loads (caches) a full-screen ad. `ready` is true only when the SDK reported the ad as loaded. */
  loadAd(options: { format: AdFormat }): Promise<{ ready: boolean; code?: string }>;
  /** Shows the loaded ad (placement `default`) and resolves when it is closed. `rewarded` is true ONLY when the SDK reported `onRewardedVideoFinished` (viewed to the end); `completionId` is made natively, once for each video. */
  showAd(options: { format: AdFormat }): Promise<{ shown: boolean; rewarded?: boolean; completionId?: string; code?: string }>;
  showBanner(options: { margin?: number }): Promise<{ shown: boolean; code?: string }>;
  hideBanner(): Promise<void>;
  /** The privacy options form, when `privacyOptionsRequired`. */
  showPrivacyOptions(): Promise<ConsentResult | void>;
  /** Not used on Android (no ATT): always `unavailable`. */
  requestTracking(): Promise<{ status: string }>;
}
