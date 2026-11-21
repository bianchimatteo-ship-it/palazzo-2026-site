import { registerPlugin } from '@capacitor/core';
const AppodealAds = registerPlugin('AppodealAds', { web: () => import('./web').then(m => new m.AppodealAdsWeb()) });
export * from './definitions';
export { AppodealAds };
