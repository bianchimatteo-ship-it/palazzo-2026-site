// Appodeal safety net (Android): (1) a Debug build can NEVER send a real ad request, (2) a Release with an incoherent ad configuration is refused, (3) the banner policy
// (120 s between sessions, 60 s maximum, persistent, error- and hang-proof). Everything runs against fakes: no network, no ad shown. The native side is checked by its sources here
// and on a device by logcat (docs/appodeal.md); the Gradle guard is exercised with `gradlew --dry-run` (no Release is built).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const build = (await read('index.html')).match(/main\.js\?v=([^"']+)/)?.[1];
const mod = path => import(new URL(`../${path}?v=${build}`, import.meta.url).href);
const { createAdsManager } = await mod('src/data/repositories/ads-manager.js');
const { resolveAppodeal } = await mod('src/data/ads-config.js');
const lines = [];

// ---------------------------------------------------------------- 1. Debug can never be production (native sources)
const kt = await read('plugins/appodeal-ads/android/src/main/java/it/matteobianchi/politicando/appodeal/AppodealAdsPlugin.kt');
const code = kt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
assert.match(code, /FLAG_DEBUGGABLE/, 'Controllo nativo FLAG_DEBUGGABLE.'); assert.match(code, /BuildConfig\.DEBUG\) return true/, 'Secondo segnale indipendente: BuildConfig.DEBUG.');
assert.match(code, /catch \(e: Throwable\) \{ true \}/, 'Se non si riesce a stabilire se è Debug, si assume Debug (lato sicuro).');
assert.match(code, /fun effectiveTesting\(requested: Boolean\): Boolean = isDebugBuild\(\) \|\| requested/, 'La modalità test prevale su qualsiasi richiesta.');
assert.match(code, /val test = effectiveTesting\(requestedTest\)/, 'initialize usa il valore forzato.');
assert.equal((code.match(/Appodeal\.setTesting\(/g) ?? []).length, 2, 'Solo due chiamate a setTesting: quella forzata e la riaffermazione dopo l’init.');
assert.match(code, /Appodeal\.setTesting\(test\)/); assert.match(code, /if \(debugBuild\) Appodeal\.setTesting\(true\)/);
assert.ok(!/setTesting\(\s*false\s*\)/.test(code), 'Nessun setTesting(false) esplicito.');
assert.ok(code.indexOf('Appodeal.setTesting(test)') < code.indexOf('Appodeal.initialize('), 'setTesting precede l’inizializzazione.');
assert.match(code, /"productionRefused" to \(debugBuild && !requestedTest\)/, 'Il rifiuto della produzione in Debug è segnalato al chiamante.');
assert.ok(code.indexOf('isDebugBuild()') < code.indexOf('Appodeal.initialize('), 'La verifica Debug precede l’inizializzazione.');
// the model of the native rule, against every combination of (build, what JS asks)
const effective = (debug, requestedTest) => debug || requestedTest;
for (const requested of [true, false]) assert.equal(effective(true, requested), true, 'Debug: sempre test.');
assert.equal(effective(false, true), true); assert.equal(effective(false, false), false, 'Release + produzione autorizzata: annunci reali.');
// whatever the JS configuration says (the shipped one included), the plugin receives a flag that the native side overrides in Debug
const shipped = resolveAppodeal(null);
lines.push(`configurazione spedita: mode=${shipped.mode}, testMode inviato=${shipped.testing} → in Debug il nativo forza comunque test`);
assert.equal(resolveAppodeal({ appodeal: { mode: 'production' } }, 'test').testing, true, 'Un valore remoto non può portare in produzione una build in modalità test.');

// ---------------------------------------------------------------- 2. Release coherence guard (sources; the dry-run is done by the runner)
const gradle = await read('android/app/build.gradle');
assert.match(gradle, /incoherent advertising configuration/); assert.match(gradle, /without APPODEAL_PRODUCTION_AUTHORIZED = true/); assert.match(gradle, /src, www and the Capacitor copy disagree/);
assert.match(gradle, /releaseTask != null/);
lines.push('guard Release in Gradle presente (produzione non autorizzata, copie discordi, chiave non valida → build rifiutata)');

// ---------------------------------------------------------------- 3. Banner policy
const GAP = 120_000, MAX = 60_000, OPS = 8_000;
const harness = ({ storage, adapterOverrides = {}, start = 1_000_000, enabled = true } = {}) => {
  let t = start; const timers = new Map(); let nextId = 1;
  const clock = {
    now: () => t, setTimer: (fn, ms) => { const id = nextId++; timers.set(id, { at: t + ms, fn }); return id; }, clearTimer: id => { timers.delete(id); },
    // moves time forward, firing due timers in order, letting promises settle between them
    async advance(ms) {
      const target = t + ms;
      for (;;) {
        await settle();
        const due = [...timers.entries()].filter(([, v]) => v.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]); t = Math.max(t, due[1].at); due[1].fn();
      }
      t = target; await settle();
    },
    jump(ms) { t += ms; }   // time passes with no timer firing (app frozen in the background)
  };
  const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)); };
  const log = []; let shown = false;
  const adapter = {
    ids: { banner: { enabled }, interstitial: { enabled: false } },
    async showBanner() { log.push('show'); shown = true; return true; },
    async hideBanner() { log.push('hide'); shown = false; return true; },
    isBannerShown: () => shown,
    ...adapterOverrides
  };
  const make = (extra = {}) => createAdsManager({ adapter, storage, now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer, pages: ['panoramica'], bannerMinGapMs: GAP, bannerMaxSessionMs: MAX, bannerOpTimeoutMs: OPS, bannerRetryMs: 30_000, ...extra });
  return { clock, adapter, log, make, setShown: value => { shown = value; }, settle };
};
const memoryStorage = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, String(v)); }, map }; };
const home = { page: 'panoramica' };
const count = (log, what) => log.filter(item => item === what).length;

{ // basic: shows, exact 60 s hide by its own timer (no polling at all), 120 s cooldown from the END of the session
  const h = harness({ storage: memoryStorage() }); const m = h.make();
  assert.equal(await m.syncBanner(home), true); assert.equal(count(h.log, 'show'), 1);
  await h.clock.advance(59_999); assert.equal(h.adapter.isBannerShown(), true, 'A 59,999 s è ancora visibile.');
  await h.clock.advance(1); assert.equal(h.adapter.isBannerShown(), false, 'Nascosto esattamente a 60 s dal solo timer, senza polling.'); assert.equal(count(h.log, 'hide'), 1);
  await h.clock.advance(119_999); assert.equal(await m.syncBanner(home), false, 'Prima di 120 s dalla fine: nessuna nuova sessione.'); assert.equal(count(h.log, 'show'), 1);
  await h.clock.advance(1); assert.equal(await m.syncBanner(home), true, 'A 120 s: nuova sessione.'); assert.equal(count(h.log, 'show'), 2);
  lines.push('banner: nascosto a 60,000 s dal timer proprio; nuova sessione solo dopo 120 s dalla fine');
}
{ // concurrent calls: one show
  const h = harness({ storage: memoryStorage() }); const m = h.make();
  const results = await Promise.all([m.syncBanner(home), m.syncBanner(home), m.syncBanner(home), m.syncBanner(home)]);
  assert.equal(count(h.log, 'show'), 1, 'Quattro chiamate nello stesso istante: una sola richiesta.'); assert.deepEqual(results, [true, true, true, true]);
  lines.push('chiamate concorrenti: una sola richiesta di banner');
}
{ // page change hides at once and starts the cooldown; going back within 120 s does not show it
  const h = harness({ storage: memoryStorage() }); const m = h.make();
  await m.syncBanner(home); await h.clock.advance(10_000); await m.syncBanner({ page: 'elezioni' }); assert.equal(h.adapter.isBannerShown(), false);
  await h.clock.advance(30_000); assert.equal(await m.syncBanner(home), false, 'Tornare sulla Home dopo 30 s: cooldown.'); assert.equal(count(h.log, 'show'), 1);
  await m.syncBanner({ page: 'panoramica', blocked: true }); assert.equal(count(h.log, 'show'), 1);
  lines.push('cambio schermata: nascosto subito, il cooldown vale anche tornando sulla Home');
}
{ // return from background: the app was frozen (no timer fired) for far longer than 60 s
  const h = harness({ storage: memoryStorage() }); const m = h.make();
  await m.syncBanner(home); h.clock.jump(300_000);
  assert.equal(await m.syncBanner(home), false, 'Al ritorno dal background con sessione scaduta: nascosto, non mostrato di nuovo.'); assert.equal(h.adapter.isBannerShown(), false);
  assert.equal(count(h.log, 'show'), 1); assert.equal(count(h.log, 'hide'), 1);
  lines.push('ritorno dal background: sessione scaduta nascosta alla prima verifica');
}
{ // persistence: close and reopen the app (new manager, same storage)
  const storage = memoryStorage(); const h = harness({ storage }); let m = h.make();
  await m.syncBanner(home); await h.clock.advance(60_000); assert.equal(h.adapter.isBannerShown(), false);
  await h.clock.advance(20_000); m = h.make();   // app closed and reopened 20 s after the session ended
  assert.equal(await m.syncBanner(home), false, 'Riapertura a 20 s dalla fine: ancora cooldown.'); assert.equal(count(h.log, 'show'), 1);
  await h.clock.advance(99_999); assert.equal(await m.syncBanner(home), false); await h.clock.advance(1); assert.equal(await m.syncBanner(home), true, 'A 120 s dalla fine: di nuovo ammesso.');
  assert.ok(JSON.parse(storage.map.get('politicando.ads.v1')).bannerOpenAt, 'La sessione aperta è registrata.');
  lines.push('riapertura: il cooldown sopravvive alla chiusura dell’app');
}
{ // the app is killed while the banner is up: the restart cannot shorten the cooldown
  const storage = memoryStorage(); const h = harness({ storage }); let m = h.make();
  await m.syncBanner(home); await h.clock.advance(10_000);   // killed 10 s into the session
  h.setShown(false); await h.clock.advance(5_000); m = h.make();
  assert.equal(await m.syncBanner(home), false, 'Riavvio dopo kill durante la sessione: cooldown, nessun banner immediato.'); assert.equal(count(h.log, 'show'), 1);
  await h.clock.advance(119_999); assert.equal(await m.syncBanner(home), false); await h.clock.advance(1); assert.equal(await m.syncBanner(home), true);
  lines.push('kill con banner aperto: il riavvio non accorcia il cooldown');
}
{ // storage unavailable: safe fallback = a restart never gives an immediate banner; works in memory
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const h = harness({ storage: broken }); const m = h.make();
  assert.equal(await m.syncBanner(home), false, 'Senza storage: all’avvio parte il cooldown, nessun banner immediato.'); assert.equal(m.bannerState().persistent, false);
  await h.clock.advance(120_000); assert.equal(await m.syncBanner(home), true); await h.clock.advance(60_000); assert.equal(h.adapter.isBannerShown(), false); assert.equal(await m.syncBanner(home), false);
  const none = harness({ storage: null }); assert.equal(await none.make().syncBanner(home), false);
  lines.push('storage non disponibile: fallback sicuro (cooldown all’avvio), limiti validi in memoria');
}
{ // clock moved backwards: the wait is never longer than the cooldown, never negative
  const storage = memoryStorage(); const h = harness({ storage }); let m = h.make();
  await m.syncBanner(home); await h.clock.advance(60_000); h.clock.jump(-3_600_000); m = h.make();
  assert.equal(await m.syncBanner(home), false); assert.ok(m.bannerState().endedAt <= h.clock.now());
  await h.clock.advance(120_000); assert.equal(await m.syncBanner(home), true, 'Orologio all’indietro: al massimo un cooldown pieno.');
  lines.push('orologio portato indietro: attesa limitata a un cooldown');
}
{ // showBanner THROWS: recovers, backs off 30 s, then works; no cooldown for an impression that never happened
  let fail = 2; const h = harness({ storage: memoryStorage(), adapterOverrides: { async showBanner() { h.log.push('show'); if (fail-- > 0) throw new Error('boom'); h.setShown(true); return true; } } }); const m = h.make();
  assert.equal(await m.syncBanner(home), false); assert.equal(m.bannerState().shown, false, 'Stato coerente dopo l’errore.'); assert.equal(count(h.log, 'show'), 1);
  assert.equal(await m.syncBanner(home), false, 'Subito dopo: backoff, nessuna richiesta duplicata.'); assert.equal(count(h.log, 'show'), 1);
  await h.clock.advance(30_000); assert.equal(await m.syncBanner(home), false); assert.equal(count(h.log, 'show'), 2, 'Secondo errore.');
  await h.clock.advance(30_000); assert.equal(await m.syncBanner(home), true, 'Il sistema recupera e continua a funzionare.'); assert.equal(m.bannerState().shown, true);
  lines.push('errore in showBanner: stato coerente, backoff 30 s, poi recupera');
}
{ // hideBanner FAILS (false / throw): retried on the next checks, no new show until it worked, the cooldown has started
  let ok = false; const h = harness({ storage: memoryStorage(), adapterOverrides: { async hideBanner() { h.log.push('hide'); if (!ok) throw new Error('boom'); h.setShown(false); return true; } } }); const m = h.make();
  await m.syncBanner(home); await m.syncBanner({ page: 'elezioni' }); assert.equal(m.bannerState().hidePending, true, 'Hide fallito: debito di hide.');
  await m.syncBanner(home); assert.equal(count(h.log, 'show'), 1, 'Mai un nuovo show mentre un hide è dovuto.'); const failed = count(h.log, 'hide'); assert.ok(failed >= 2, 'L’hide viene riprovato.');
  ok = true; await m.syncBanner({ page: 'elezioni' }); assert.equal(m.bannerState().hidePending, false); assert.equal(h.adapter.isBannerShown(), false);
  await h.clock.advance(120_000); assert.equal(await m.syncBanner(home), true, 'Dopo il recupero e il cooldown torna a funzionare.');
  lines.push('errore in hideBanner: riprovato a ogni verifica, nessun nuovo show finché non riesce, poi recupera');
}
{ // hide returns false (adapter contract) behaves the same
  let ok = false; const h = harness({ storage: memoryStorage(), adapterOverrides: { async hideBanner() { h.log.push('hide'); if (ok) h.setShown(false); return ok; } } }); const m = h.make();
  await m.syncBanner(home); await m.syncBanner({ page: 'x' }); assert.equal(m.bannerState().hidePending, true); ok = true; await m.syncBanner({ page: 'x' }); assert.equal(m.bannerState().hidePending, false);
}
{ // an expiry hide that fails is retried too (the timer does not give up)
  let ok = false; const h = harness({ storage: memoryStorage(), adapterOverrides: { async hideBanner() { h.log.push('hide'); if (!ok) throw new Error('boom'); h.setShown(false); return true; } } }); const m = h.make();
  await m.syncBanner(home); await h.clock.advance(60_000); assert.equal(m.bannerState().hidePending, true); ok = true; await m.syncBanner(home); assert.equal(h.adapter.isBannerShown(), false); assert.equal(m.bannerState().hidePending, false);
}
{ // showBanner HANGS: the operation is bounded, the chain is not blocked for ever, the stray banner (if it appears late) is taken down
  let release; const h = harness({ storage: memoryStorage(), adapterOverrides: { showBanner() { h.log.push('show'); return new Promise(resolve => { release = () => { h.setShown(true); resolve(true); }; }); } } }); const m = h.make();
  const first = m.syncBanner(home); const second = m.syncBanner(home);   // queued calls evaluate the LATEST page when their turn comes
  await h.clock.advance(OPS); assert.equal(await first, false, 'Show pendente: dopo il timeout l’operazione è chiusa.'); assert.equal(await second, false, 'La catena non resta bloccata: la chiamata successiva viene servita (backoff, senza una seconda richiesta).'); assert.equal(count(h.log, 'show'), 1);
  assert.equal(m.bannerState().shown, false);
  release();   // the native layer finally answers
  await h.settle(); await m.syncBanner({ page: 'elezioni' }); assert.equal(h.adapter.isBannerShown(), false, 'Un banner comparso in ritardo viene nascosto.'); assert.equal(m.bannerState().hidePending, false);
  lines.push('show pendente: timeout 8 s, catena libera, banner tardivo nascosto');
}
{ // hideBanner HANGS: bounded; owed again
  let hang = true; const h = harness({ storage: memoryStorage(), adapterOverrides: { hideBanner() { h.log.push('hide'); return hang ? new Promise(() => {}) : (h.setShown(false), Promise.resolve(true)); } } }); const m = h.make();
  await m.syncBanner(home); const pending = m.syncBanner({ page: 'x' }); await h.clock.advance(OPS); await pending; assert.equal(m.bannerState().hidePending, true);
  hang = false; await m.syncBanner({ page: 'x' }); assert.equal(m.bannerState().hidePending, false); assert.equal(h.adapter.isBannerShown(), false);
  lines.push('hide pendente: timeout 8 s, ritentato, sistema non bloccato');
}
{ // a banner hidden behind our back (the floor overlay hides it through the adapter) ends the session and starts the cooldown
  const h = harness({ storage: memoryStorage() }); const m = h.make();
  await m.syncBanner(home); await h.adapter.hideBanner(); await h.clock.advance(1_000);
  assert.equal(await m.syncBanner(home), false, 'Nascosto fuori dal gestore: cooldown dalla sua fine.'); assert.equal(count(h.log, 'show'), 1); assert.equal(m.bannerState().shown, false);
  await h.clock.advance(120_000); assert.equal(await m.syncBanner(home), true);
  lines.push('banner nascosto dall’esterno (overlay): sessione chiusa e cooldown coerenti');
}
{ // format switched off: hidden, nothing asked
  const h = harness({ storage: memoryStorage() }); const m = h.make();
  await m.syncBanner(home); h.adapter.ids.banner.enabled = false; await m.syncBanner(home); assert.equal(h.adapter.isBannerShown(), false); const shows = count(h.log, 'show');
  await h.clock.advance(300_000); await m.syncBanner(home); assert.equal(count(h.log, 'show'), shows, 'Formato spento: nessuna richiesta.');
}
{ // the other formats are untouched: interstitial limits and the rewarded timestamp still work through the same manager
  const store = memoryStorage(); let t = 5_000_000; let shownInterstitial = 0;
  const adapter = { ids: { interstitial: { enabled: true }, banner: { enabled: false } }, showInterstitial: async () => { shownInterstitial++; return true; } };
  const m = createAdsManager({ adapter, storage: store, now: () => t, policy: () => ({ everyWeeks: 2, minGapMs: 180_000, perDay: 12 }) });
  const state = { game: {} };
  assert.equal(await m.onWeekClosed(state), false); assert.equal(await m.onWeekClosed(state), true, 'Interstitial ogni 2 settimane.'); t += 60_000;
  assert.equal(await m.onWeekClosed(state), false); assert.equal(await m.onWeekClosed(state), false, 'Meno di 180 s: no.'); t += 130_000; assert.equal(await m.onWeekClosed(state), true);
  m.noteRewarded(); assert.ok(m.stats().lastRewarded, 'Il rewarded registra l’istante.'); t += 400_000;
  assert.equal(await m.onWeekClosed({ game: {}, night: {} }), false, 'Mai durante la notte.'); assert.equal(shownInterstitial, 2);
  lines.push('interstitial (ogni 2 settimane, 180 s, momenti naturali) e rewarded invariati');
}
console.log(`Sicurezza Appodeal Android verificata:\n- ${lines.join('\n- ')}`);
