import { registerPlugin } from '@capacitor/core';
import type { InMobiAdsPlugin } from './definitions';

export * from './definitions';
/** The native plugin `InMobiAds` (Kotlin / Swift). The game reads it as `Capacitor.Plugins.InMobiAds`. */
export const InMobiAds = registerPlugin<InMobiAdsPlugin>('InMobiAds', { web: () => import('./web').then(module => module.InMobiAdsWeb) });
