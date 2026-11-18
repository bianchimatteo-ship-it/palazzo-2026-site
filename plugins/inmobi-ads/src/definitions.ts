/** The ad formats of the game. `rewarded` and `interstitial` are full-screen; `banner` is an overlay at the bottom. */
export type AdFormat = 'rewarded' | 'interstitial';

export interface ConsentResult {
  /** `true` only when the CMP (Google UMP, IAB TCF) says ads may be requested: consent given, or not required. */
  canRequestAds: boolean;
  /** UMP status: UNKNOWN | REQUIRED | NOT_REQUIRED | OBTAINED. */
  status: string;
  /** `true` when the user must be offered a way to change the choice (privacy options form). */
  privacyOptionsRequired: boolean;
}

export interface InMobiAdsPlugin {
  /** Consent first (no ad request happens before it): asks the CMP and shows its form only when it is required. */
  requestConsent(options?: { testMode?: boolean }): Promise<ConsentResult>;
  /** Initialises the InMobi SDK with the Account ID (NOT the App Key, NOT a placement id). Fails when there is no consent. */
  initialize(options: { accountId: string; testMode?: boolean }): Promise<{ ok: boolean; code?: string }>;
  /** Loads a full-screen ad for the placement. `ready` is true only when the SDK reported the ad as loaded. */
  loadAd(options: { format: AdFormat; placementId: string; testMode?: boolean }): Promise<{ ready: boolean; code?: string }>;
  /** Shows the loaded ad and resolves when it is closed. `rewarded` is true ONLY if the SDK confirmed the reward (Android `onRewardsUnlocked`, iOS `rewardActionCompletedWithRewards`); `completionId` is made natively, once for each rewarded video. */
  showAd(options: { format: AdFormat }): Promise<{ shown: boolean; rewarded?: boolean; completionId?: string; code?: string }>;
  showBanner(options: { placementId: string; margin?: number; testMode?: boolean }): Promise<{ shown: boolean; code?: string }>;
  hideBanner(): Promise<void>;
  /** The privacy options form of the CMP, when `privacyOptionsRequired`. */
  showPrivacyOptions(): Promise<void>;
  /** iOS only, and only if the remote configuration asks for it: the App Tracking Transparency prompt. Resolves the status (never prompts on Android). */
  requestTracking(): Promise<{ status: string }>;
}
