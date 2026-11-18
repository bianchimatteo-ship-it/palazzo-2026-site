import { registerPlugin } from '@capacitor/core';
export * from './definitions';
/** The native plugin `InMobiAds` (Kotlin / Swift). The game reads it as `Capacitor.Plugins.InMobiAds`. */
export const InMobiAds = registerPlugin('InMobiAds', { web: () => import('./web').then(module => module.InMobiAdsWeb) });
