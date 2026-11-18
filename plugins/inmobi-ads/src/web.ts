import type { InMobiAdsPlugin } from './definitions';

/** The website never shows ads: every call answers "not available" and nothing is requested. */
const none = async () => ({ ok: false, code: 'unavailable' });
export const InMobiAdsWeb: InMobiAdsPlugin = {
  requestConsent: async () => ({ canRequestAds: false, status: 'UNKNOWN', privacyOptionsRequired: false }),
  initialize: none,
  loadAd: async () => ({ ready: false, code: 'unavailable' }),
  showAd: async () => ({ shown: false, rewarded: false, code: 'unavailable' }),
  showBanner: async () => ({ shown: false, code: 'unavailable' }),
  hideBanner: async () => undefined,
  showPrivacyOptions: async () => undefined,
  requestTracking: async () => ({ status: 'unavailable' })
};
