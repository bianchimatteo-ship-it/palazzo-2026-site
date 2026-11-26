// The consent of the ads (Google UMP behind the InMobi bridge), with a fake plugin that behaves like UMP: refusal, acceptance, the privacy options form AFTER a refusal, withdrawal, a form error.
// With every format off (ADS_MODE off) the plugin is never called: no consent request and no ad request at start. Nothing here reaches the network.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const { createInMobiAdapter } = await import(new URL(`../src/data/repositories/inmobi-adapter.js?v=${build}`, import.meta.url).href);
const { defaultAds, resolveAds } = await import(new URL(`../src/data/ads-config.js?v=${build}`, import.meta.url).href);

function fakePlugin(script) {
  const calls = []; let first = true; let state = { canRequestAds: false, status: 'REQUIRED', privacyOptionsRequired: true };
  const plugin = {
    calls,
    // like UMP: the first update gives the status the account is in; later updates return what the user chose in the meantime
    requestConsent: async () => { calls.push('requestConsent'); if (first) { state = { ...state, ...script.start }; first = false; } return { ...state }; },
    showPrivacyOptions: async () => { calls.push('showPrivacyOptions'); state = { ...state, ...(script.options.shift() ?? {}) }; return { ...state }; },
    initialize: async () => { calls.push('initialize'); return { ok: true }; },
    loadAd: async () => { calls.push('loadAd'); return { ready: true }; },
    showAd: async () => { calls.push('showAd'); return { shown: true }; },
    showBanner: async () => { calls.push('showBanner'); return { shown: true }; },
    hideBanner: async () => { calls.push('hideBanner'); }
  };
  return plugin;
}
const ON = { enabled: true, accountId: 'abcdef0123456789abcdef0123456789', testing: true, banner: { enabled: true, placementId: '1' }, interstitial: { enabled: true, placementId: '2' }, rewarded: { enabled: true, placementId: '3' } };

// 1. ADS OFF: nothing is asked, nothing is called
{
  const plugin = fakePlugin({ start: {}, options: [] });
  const adapter = createInMobiAdapter({ plugin, platform: 'android', config: defaultAds('android') });
  assert.deepEqual(await adapter.status(), { ok: false, code: 'not-configured' }, 'Con tutto spento: non configurato.');
  assert.equal(await adapter.showBanner(), false); assert.equal(await adapter.showInterstitial(), false);
  assert.equal(await adapter.rewardedProvider.isReady(), false);
  assert.deepEqual(plugin.calls, [], 'Con ADS spenti il plugin non viene mai chiamato (nessun consenso, nessuna richiesta pubblicitaria).');
}
// 2. REFUSAL at start: no SDK, no ad; the privacy button is still offered and works
{
  const plugin = fakePlugin({ start: { canRequestAds: false, status: 'REQUIRED', privacyOptionsRequired: true }, options: [{ canRequestAds: true, status: 'OBTAINED', privacyOptionsRequired: true }, { canRequestAds: false, status: 'REQUIRED', privacyOptionsRequired: true }] });
  const adapter = createInMobiAdapter({ plugin, platform: 'android', config: ON });
  assert.deepEqual(await adapter.start(), { ok: false, code: 'no-consent' }, 'Consenso rifiutato: nessuna inizializzazione.');
  assert.ok(!plugin.calls.includes('initialize') && !plugin.calls.includes('loadAd'), 'Dopo il rifiuto nessuna richiesta di annunci.');
  assert.equal(adapter.consent().privacyOptions, true, 'Il pulsante privacy resta disponibile dopo un rifiuto.');
  assert.equal(await adapter.showBanner(), false, 'Senza consenso nessun banner.');
  // 3. the user opens the privacy options after the refusal and ACCEPTS: the SDK starts now
  assert.equal(await adapter.showPrivacyOptions(), true, 'Il modulo delle preferenze si apre anche dopo un rifiuto.');
  assert.equal(adapter.consent().canRequestAds, true, 'Il consenso dato dopo viene letto.');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(plugin.calls.includes('initialize'), 'Accettato dopo il rifiuto, l’SDK parte.');
  assert.equal(await adapter.showBanner(), true);
  // 4. the user WITHDRAWS the consent: the banner goes away, the loaded formats are forgotten, the next start asks again
  assert.equal(await adapter.showPrivacyOptions(), true);
  assert.equal(adapter.consent().canRequestAds, false, 'Revoca letta.');
  assert.ok(plugin.calls.includes('hideBanner') && adapter.isBannerShown() === false, 'Revocato il consenso il banner sparisce.');
  assert.equal(await adapter.rewardedProvider.isReady(), false, 'Dopo la revoca nessun annuncio è pronto.');
  assert.ok(plugin.calls.filter(c => c === 'requestConsent').length >= 2, 'Dopo la revoca il consenso viene chiesto di nuovo al prossimo avvio dell’SDK.');
  assert.equal(adapter.consent().privacyOptions, true, 'Il pulsante privacy resta anche dopo la revoca.');
}
// 5. ACCEPTANCE at start
{
  const plugin = fakePlugin({ start: { canRequestAds: true, status: 'OBTAINED', privacyOptionsRequired: true }, options: [] });
  const adapter = createInMobiAdapter({ plugin, platform: 'android', config: ON });
  assert.deepEqual(await adapter.start(), { ok: true }); assert.deepEqual(plugin.calls.slice(0, 2), ['requestConsent', 'initialize'], 'Il consenso viene aggiornato PRIMA dell’SDK.');
}
// 6. consent not required (outside the EEA): ads allowed, no privacy entry
{
  const plugin = fakePlugin({ start: { canRequestAds: true, status: 'NOT_REQUIRED', privacyOptionsRequired: false }, options: [] });
  const adapter = createInMobiAdapter({ plugin, platform: 'android', config: ON }); await adapter.start();
  assert.equal(adapter.consent().privacyOptions, false, 'Dove il consenso non serve non c’è la voce privacy.');
}
// 7. a plugin that fails or has no privacy form never breaks the game
{
  const broken = { requestConsent: async () => { throw new Error('boom'); }, showPrivacyOptions: async () => { throw new Error('boom'); } };
  const adapter = createInMobiAdapter({ plugin: broken, platform: 'android', config: ON });
  assert.deepEqual(await adapter.start(), { ok: false, code: 'error' }); assert.equal(await adapter.showPrivacyOptions(), false);
  assert.equal(await createInMobiAdapter({ plugin: null, platform: 'android', config: ON }).showPrivacyOptions(), false);
}
// 8. the remote configuration keeps everything off by default
{ const off = resolveAds('android', null); assert.ok(!off.enabled && !off.banner.enabled && !off.interstitial.enabled && !off.rewarded.enabled, 'Senza configurazione remota tutto è spento.'); }
console.log('Consenso (UMP): ADS spenti = nessuna chiamata; rifiuto, accettazione, preferenze dopo un rifiuto, revoca, errori: verificati con un plugin simulato (non sostituiscono la prova su dispositivo).');
