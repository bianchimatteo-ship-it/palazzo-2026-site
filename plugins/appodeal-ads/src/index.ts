import { registerPlugin } from '@capacitor/core';
import type { AppodealAdsPlugin } from './definitions';

const AppodealAds = registerPlugin<AppodealAdsPlugin>('AppodealAds', { web: () => import('./web').then(m => new m.AppodealAdsWeb()) });
export * from './definitions';
export { AppodealAds };
