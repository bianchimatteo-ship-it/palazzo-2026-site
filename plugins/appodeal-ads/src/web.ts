import type { AppodealAdsPlugin } from './definitions';

/** The website never shows ads: every call answers "not available" and nothing is requested. */
export class AppodealAdsWeb implements AppodealAdsPlugin {
  async requestConsent() { return { canRequestAds: false, status: 'UNKNOWN', privacyOptionsRequired: false }; }
  async initialize() { return { ok: false, code: 'unavailable' }; }
  async loadAd() { return { ready: false, code: 'unavailable' }; }
  async showAd() { return { shown: false, rewarded: false, code: 'unavailable' }; }
  async showBanner() { return { shown: false, code: 'unavailable' }; }
  async hideBanner() { /* nothing */ }
  async showPrivacyOptions() { return { canRequestAds: false, status: 'UNKNOWN', privacyOptionsRequired: false }; }
  async requestTracking() { return { status: 'unavailable' }; }
  async resetConsentDebug() { return { ok: false, code: 'unavailable' }; }
}
