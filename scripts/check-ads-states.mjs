// Rewarded video: the three states of the card «Ricompense pubblicitarie», told apart and verifiable.
//   1. not integrated / not configured (today): the button is off and the note says what is missing (AdMob, not configured);
//   2. integrated, configured and a video available: the button works and the note about the configuration is gone;
//   3. integrated but no video available now: the button is off with a temporary message, different from the first (nothing to configure: it comes back by itself).
// The ids below are written for this test only (never real, never in the game): the game ships with no SDK, no plugin and no advertising id, and this test also checks that nothing pretends otherwise.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startCareer } from './lib/long-run.mjs';

const build = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const run = await startCareer({ seed: 'annunci', level: 'deputato', fast: false });
const { store } = run;
const { createRewardsService } = await module('src/ui/rewards-service.js');
const { renderRewardsPage } = await module('src/ui/rewards-page.js');
const { createRewardsJournal } = await module('src/data/repositories/rewards-journal.js');
const { createRewardedAds, REWARDED_ADS_OFF } = await module('src/data/repositories/ads-rewarded.js');
const { ADS_CONFIG } = await module('src/data/ads-config.js');
const { createStorageLease } = await module('src/core/play-clock.js');
const memoryStorage = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => { map.set(key, String(value)); }, removeItem: key => { map.delete(key); } }; };
const TEST_CONFIG = Object.freeze({ enabled: true, appId: 'ca-app-pub-0000000000000000~0000000000', rewardedUnitId: 'ca-app-pub-0000000000000000/0000000000' });   // placeholders of this test
const service = ads => createRewardsService({ store, journal: createRewardsJournal(memoryStorage()), username: () => null, ads, env: { now: () => 0, wall: () => 1, visible: () => true, playing: () => true, lease: createStorageLease(memoryStorage(), { tabId: 't', wall: () => 1 }), storage: memoryStorage() } });
const card = async ads => { const rewards = service(ads); await rewards.refreshAds(); const html = renderRewardsPage(store.getState(), { ...rewards.snapshot(), playing: true }); return { rewards, html, button: /<button[^>]*data-reward-video[^>]*>/.exec(html)?.[0] ?? '', note: /<p class="quiet-copy" data-reward-video-note[^>]*>([^<]*)<\/p>/.exec(html)?.[1] ?? null }; };

// ---- what the game ships: nothing ----
assert.deepEqual({ ...ADS_CONFIG }, { enabled: false, appId: null, rewardedUnitId: null }, 'La configurazione degli annunci è spenta e senza identificativi.');
const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const shipped = ['package.json', 'capacitor.config.json', 'android/app/build.gradle', 'android/build.gradle', 'android/variables.gradle', 'android/app/src/main/AndroidManifest.xml', 'android/app/capacitor.build.gradle', 'android/capacitor.settings.gradle'].map(read).join('\n');
assert.ok(!/admob|play-services-ads|google-mobile-ads|ca-app-pub|com\.google\.android\.gms\.ads|capacitor-community\/admob|@capacitor-community/i.test(shipped), 'Nel progetto Android non ci sono SDK o plugin AdMob né identificativi pubblicitari.');
assert.ok(!/ca-app-pub-/.test(fs.readdirSync(new URL('../src/', import.meta.url), { recursive: true }).filter(name => /\.(js|json|html)$/.test(name) && !/^data\/real\//.test(name)).map(name => read(`src/${name}`)).join('\n')), 'Nessun identificativo AdMob nei sorgenti del gioco.');

// ---- 1. not integrated / not configured ----
let state = await card({});
assert.match(state.button, /disabled/, '1. Il pulsante è spento.'); assert.match(state.button, /data-ads-state="not-configured"/);
assert.equal(state.note, REWARDED_ADS_OFF, '1. La nota dice che cosa manca (AdMob non configurato).'); assert.match(state.note, /AdMob/);
state = await card({ config: TEST_CONFIG });
assert.match(state.button, /data-ads-state="not-configured"/, '1. Configurato ma senza il provider nativo: resta «non integrato».');
state = await card({ provider: { kind: 'admob', isReady: () => true, show: async () => ({}) } });
assert.match(state.button, /data-ads-state="not-configured"/, '1. Il provider senza identificativi non basta.');
state = await card({ config: { enabled: true, appId: null, rewardedUnitId: null }, provider: { kind: 'admob', isReady: () => true, show: async () => ({}) } });
assert.match(state.button, /data-ads-state="not-configured"/, '1. Configurazione incompleta: non configurato.');
state = await card({ config: TEST_CONFIG, provider: { kind: 'demo', isReady: () => true, show: async () => ({}) } });
assert.match(state.button, /data-ads-state="not-configured"/, '1. Un provider di prova è rifiutato in produzione.');

// ---- 2. integrated, configured, a video is available ----
let ready = true, shown = 0;
const provider = { kind: 'admob', isReady: () => ready, show: async () => { shown++; return { completed: true, verified: true, completionId: `transazione-${shown}-0001` }; } };
state = await card({ config: TEST_CONFIG, provider });
assert.doesNotMatch(state.button, /disabled/, '2. Il pulsante è attivo.'); assert.match(state.button, /data-ads-state="ready"/);
assert.equal(state.note, null, '2. La nota sulla configurazione è sparita.'); assert.doesNotMatch(state.html, /integrazione di AdMob|Nessun video disponibile/);
// the video really rewards, once for each completion
const before = JSON.stringify(store.getState().game?.rewards?.ads ?? []);
const first = await createRewardedAds({ config: TEST_CONFIG, provider, grant: id => store.claimAdReward(id) }).watch();
assert.equal(first.status, 'completed'); assert.notEqual(JSON.stringify(store.getState().game?.rewards?.ads ?? []), before, 'Il premio è registrato.');
const repeated = createRewardedAds({ config: TEST_CONFIG, provider, grant: id => store.claimAdReward(id) }).complete({ completed: true, verified: true, completionId: first.completionId });
assert.equal(repeated.status, 'duplicate', 'La stessa conferma non paga due volte.');
assert.equal((await createRewardedAds({ config: TEST_CONFIG, provider: { kind: 'admob', isReady: () => true, show: async () => ({ completed: true, verified: false, completionId: 'transazione-falsa-1' }) }, grant: id => store.claimAdReward(id) }).watch()).status, 'failed', 'Una conferma che non viene dalla rete pubblicitaria non vale.');

// ---- 3. integrated, no video available now ----
ready = false;
state = await card({ config: TEST_CONFIG, provider });
assert.match(state.button, /disabled/, '3. Il pulsante è spento.'); assert.match(state.button, /data-ads-state="no-ad"/);
assert.equal(state.note, 'Nessun video disponibile in questo momento.', '3. Messaggio temporaneo.');
assert.notEqual(state.note, REWARDED_ADS_OFF, '3. Diverso da «non configurato».'); assert.doesNotMatch(state.html, /integrazione di AdMob/);
const rewards = service({ config: TEST_CONFIG, provider }); await rewards.refreshAds();
ready = true; await rewards.refreshAds();
assert.equal(rewards.snapshot().ads.available, true, '3. Quando un video torna disponibile il pulsante si riattiva da solo.');
provider.isReady = () => { throw new Error('sdk'); };
state = await card({ config: TEST_CONFIG, provider });
assert.match(state.button, /data-ads-state="no-ad"/, '3. Un errore dell’SDK è «nessun video», non «non configurato».');
console.log('Annunci premiati verificati: non configurato (pulsante spento, nota su AdMob), integrato e disponibile (pulsante attivo, nota sparita, premio una volta per conferma verificata), integrato senza video (pulsante spento, messaggio temporaneo diverso); il gioco non contiene SDK, plugin né identificativi AdMob.');
