import type { AppodealAdsPlugin } from './definitions';
/** The website never shows ads: every call answers "not available" and nothing is requested. */
export declare class AppodealAdsWeb implements AppodealAdsPlugin {
    requestConsent(): Promise<{
        canRequestAds: boolean;
        status: string;
        privacyOptionsRequired: boolean;
    }>;
    initialize(): Promise<{
        ok: boolean;
        code: string;
    }>;
    loadAd(): Promise<{
        ready: boolean;
        code: string;
    }>;
    showAd(): Promise<{
        shown: boolean;
        rewarded: boolean;
        code: string;
    }>;
    rewardedPlacement(): Promise<{
        canShow: boolean;
        loaded: boolean;
        code: string;
    }>;
    showBanner(): Promise<{
        shown: boolean;
        code: string;
    }>;
    hideBanner(): Promise<void>;
    showPrivacyOptions(): Promise<{
        canRequestAds: boolean;
        status: string;
        privacyOptionsRequired: boolean;
    }>;
    requestTracking(): Promise<{
        status: string;
    }>;
}
