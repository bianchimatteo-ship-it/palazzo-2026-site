// Automatic translation IT → EN with DeepL, end to end and WITHOUT ever calling DeepL: the provider is a stand-in that answers HTTP requests (a replaced fetch on the DeepL hosts) and records the real
// payloads. What is proved: what leaves the device and the Worker (anonymous templates: no name, number, e-mail, date value or career data in any payload), how the answer is put back (locally), the
// caches (device, KV), the limits (daily, monthly, per request, per address) with atomic counting under simultaneous requests, fail-closed behaviour, the block after a provider error, the
// right host for the kind of key, the origins of the Android app, and the page in Chrome (also with a phone profile). It does not prove the quality of DeepL's English: that is DeepL's.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, waitFor, withBrowser } from './lib/browser.mjs';
import { startLocalWorker } from './lib/local-worker.mjs';
import { anonymize, restore, sendable, needsOf, providerOf, deeplHost, limitsOf, reserve } from '../worker-translate.js';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const lines = [];
const SECRETS = ['Giorgia Meloni', 'Elly Schlein', 'Siena', 'Prova Verifica', 'mario.rossi@example.org', 'Lega per Salvini Premier', '1.234', '4821', '12 marzo 2026'];

// ---------- 1. the page's masking and the Worker's anonymisation ----------
const { maskText, fillTemplate, looksTranslatable, createAutoTranslator } = await import(`../src/core/i18n-auto.js?v=${build}`);
{
  const text = 'Elly Schlein ha ottenuto 1.234 voti a Siena con il 12,5% (Lega per Salvini Premier, M5S)';
  const { template, values } = maskText(text, ['Elly Schlein', 'Lega per Salvini Premier']);
  for (const secret of ['Elly Schlein', 'Siena', '1.234', '12,5', 'M5S', 'Lega per Salvini Premier']) assert.ok(!template.includes(secret), `Il modello non contiene «${secret}»: ${template}`);
  assert.ok(/⟦\d+⟧/.test(template) && values.includes('Siena') && values.includes('1.234'), 'I valori restano sul dispositivo.');
  assert.equal(fillTemplate(template, values), text, 'Il modello con i valori rimessi è il testo di partenza.');
  assert.equal(fillTemplate(template.replace('⟦0⟧', ''), values), null, 'Una risposta che perde un segnaposto non si usa.');
  assert.equal(maskText('Hai ottenuto 5 voti a Roma').template, maskText('Hai ottenuto 7000 voti a Napoli').template, 'Valori diversi, stesso modello: una sola traduzione per tutti.');
  for (const name of ['Giorgia Meloni', 'Fratelli d’Italia', 'Reggio Emilia', 'https://example.org/pagina', '123', 'M5S · 12']) assert.ok(!looksTranslatable(maskText(name).template), `${name}: un nome o un valore non si traduce`);
  assert.ok(looksTranslatable(maskText('Il governo è caduto').template));
  // the Worker's own defence: it refuses what still holds a value and hides what it recognises
  assert.ok(!sendable('Hai 5 voti a casa') && !sendable('Scrivi a mario.rossi@example.org per aiuto') && !sendable('Vai su https://example.org subito') && sendable('Hai ottenuto ⟦0⟧ voti a ⟦1⟧'));
  const { payload, values: kept } = anonymize('Il sindaco di Roma incontra Giorgia Meloni e il PD: ⟦0⟧');
  for (const secret of ['Meloni', 'PD', '⟦0⟧']) assert.ok(!payload.includes(secret), `Il payload non contiene «${secret}»: ${payload}`);
  assert.ok(payload.includes('<x i="'), 'Il payload ha soltanto segnaposto anonimi.');
  const answer = payload.replace('Il', 'The').replace('di', 'of').replace('incontra', 'meets').replace(' e il ', ' and ');
  assert.ok(restore(answer, kept)?.includes('Meloni') && restore(answer, kept).includes('⟦0⟧'), 'I valori tornano al loro posto, qui.');
  assert.equal(restore(answer.replace(/<x i="0"\/>/, ''), kept), null, 'Un segnaposto perso: la risposta non si usa.');
  assert.equal(restore(`${answer}<x i="9"/>`, kept), null);
  lines.push('modelli anonimi (nomi, numeri, sigle, variabili fuori dal modello) e ripristino locale');
}

// ---------- 2. DeepL stand-in ----------
const requests = [];
const realFetch = globalThis.fetch;
let deeplMode = 'ok';
const dictionary = { 'Hai ottenuto': 'You got', 'Il tuo avversario ha rinunciato': 'Your opponent has withdrawn', 'La riforma è stata approvata': 'The reform has been passed' };
globalThis.fetch = async (url, options) => {
  if (!/^https:\/\/api(-free)?\.deepl\.com\//.test(String(url))) return realFetch(url, options);
  const body = JSON.parse(options.body);
  requests.push({ url: String(url), headers: options.headers, body, raw: options.body });
  if (deeplMode === '456') return new Response('{}', { status: 456 });
  if (deeplMode === 'slow') await new Promise(resolve => setTimeout(resolve, 80));
  const translations = body.text.map(payload => {
    let out = payload;
    for (const [it, en] of Object.entries(dictionary)) out = out.replace(it, en);
    return { text: out === payload ? `EN ${payload}` : out, detected_source_language: 'IT' };
  });
  return new Response(JSON.stringify({ translations }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const local = await startLocalWorker({ port: 8797 });
const env = local.env;
let ipCounter = 10;
const ask = (texts, { ip = `203.0.113.${++ipCounter}`, origin = null } = {}) => local.worker.fetch(new Request(`${local.origin}/api/translate`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...(origin ? { origin } : {}) }, body: JSON.stringify({ texts }) }), env);
const status = async () => (await local.worker.fetch(new Request(`${local.origin}/api/translate/status`), env)).json();
const budget = () => local.sqlite.prepare("SELECT * FROM translate_budget WHERE id = 'global'").get();
const reset = () => { local.sqlite.exec('DELETE FROM translate_budget; DELETE FROM translate_claims; DELETE FROM translate_rate;'); local.kvData.forEach((_, key) => key.startsWith('tr:') && local.kvData.delete(key)); requests.length = 0; deeplMode = 'ok'; };
try {
  // ---- not configured ----
  const off = await status();
  assert.equal(off.configured, false); assert.ok(off.needs.some(item => /TRANSLATE_PROVIDER/.test(item)) && off.needs.some(item => /TRANSLATE_API_KEY/.test(item)));
  const refused = await ask(['Hai ottenuto ⟦0⟧ voti']);
  assert.equal(refused.status, 503); assert.equal((await refused.json()).configured, false);
  assert.equal(requests.length, 0, 'Non configurato: nessuna chiamata a DeepL.');
  assert.equal(providerOf({ TRANSLATE_PROVIDER: 'google', TRANSLATE_API_KEY: 'x' }), null, 'Nessun altro provider.');
  assert.equal(deeplHost('abc:fx'), 'https://api-free.deepl.com'); assert.equal(deeplHost('abc'), 'https://api.deepl.com');
  Object.assign(env, { TRANSLATE_PROVIDER: 'deepl', TRANSLATE_API_KEY: 'chiave-di-prova-segreta' });
  const on = await status();
  assert.equal(on.configured, true); assert.deepEqual(on.limits, { day: 10000, month: 100000, request: 2000, texts: 20, rate: 20 }, 'Limiti predefiniti: 10.000 al giorno e 100.000 al mese.');
  assert.ok(!JSON.stringify(on).includes('chiave-di-prova'), 'Lo stato non mostra la chiave.');
  lines.push('non configurato: 503 con ciò che manca e nessuna chiamata; limiti predefiniti 10.000/giorno e 100.000/mese; stato senza chiave');

  // ---- the payload that really leaves ----
  reset();
  const client = createAutoTranslator({ fetchImpl: (url, init) => /status$/.test(url) ? local.worker.fetch(new Request(`${local.origin}/api/translate/status`), env) : local.worker.fetch(new Request(`${local.origin}/api/translate`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.200' }, body: init.body }), env), storage: (() => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) }; })(), names: () => ['Elly Schlein', 'Lega per Salvini Premier', 'Prova Verifica'] });
  const dynamic = ['Hai ottenuto 1.234 voti a Siena', 'Hai ottenuto 4821 voti a Siena', 'Il tuo avversario ha rinunciato', 'La riforma è stata approvata', 'Elly Schlein: Hai ottenuto 12 marzo 2026 voti'];
  for (let i = 0; i < 40; i++) for (const text of dynamic) client.request(text);
  await client.flush();
  assert.ok(requests.length >= 1, 'DeepL (finto) ha ricevuto una richiesta.');
  const wire = requests.map(item => item.raw).join('\n');
  for (const secret of SECRETS) assert.ok(!wire.includes(secret), `Nel payload HTTP reale a DeepL non compare «${secret}»: ${wire.slice(0, 300)}`);
  assert.ok(!/\d/.test(requests.flatMap(item => item.body.text).join(' ').replace(/<x i="\d+"\/>/g, '')), 'Nessuna cifra fuori dai segnaposto anonimi.');
  assert.equal(requests.length, 1, 'I duplicati e le ripetizioni (40 giri) fanno una sola richiesta accorpata.');
  assert.equal(requests[0].body.text.length, new Set(requests[0].body.text).size, 'Nessun testo duplicato nella richiesta.');
  assert.equal(requests[0].url, 'https://api.deepl.com/v2/translate', 'La chiave senza :fx va all’endpoint dei piani a pagamento.');
  assert.equal(requests[0].headers.authorization, 'DeepL-Auth-Key chiave-di-prova-segreta'); assert.equal(requests[0].body.tag_handling, 'xml'); assert.equal(requests[0].body.target_lang, 'EN-GB');
  assert.equal(client.lookup('Hai ottenuto 1.234 voti a Siena'), 'You got 1.234 voti a Siena'.replace('voti a Siena', 'voti a Siena'), 'I valori tornano dalla cache locale, sul dispositivo.');
  assert.equal(client.lookup('Hai ottenuto 99 voti a Roma'), 'You got 99 voti a Roma', 'Lo stesso modello serve per valori diversi: nessuna nuova richiesta.');
  assert.equal(client.lookup('Il tuo avversario ha rinunciato'), 'Your opponent has withdrawn');
  const before = requests.length;
  client.request('Hai ottenuto 7 voti a Torino'); await client.flush();
  assert.equal(requests.length, before, 'Un modello già tradotto non genera nuove chiamate.');
  const used = budget();
  assert.ok(used.day_used > 0 && used.day_used === used.month_used, `Consumo registrato: ${used.day_used} caratteri.`);
  lines.push(`payload reale: ${requests[0].body.text.length} modelli anonimi, nessun nome/numero/dato, ripristino locale, 40 ripetizioni = 1 richiesta, ${used.day_used} caratteri contati`);

  // ---- caches ----
  reset();
  assert.equal((await (await ask(['Il tuo avversario ha rinunciato'])).json()).translations['Il tuo avversario ha rinunciato'], 'Your opponent has withdrawn');
  const spent = budget().day_used, calls = requests.length;
  for (let i = 0; i < 5; i++) await ask(['Il tuo avversario ha rinunciato']);
  assert.equal(requests.length, calls, 'La cache KV impedisce nuove chiamate.'); assert.equal(budget().day_used, spent, 'E nuovi addebiti.');
  assert.ok([...local.kvData.keys()].some(key => key.startsWith('tr:v2:deepl:')));
  lines.push('cache KV: 5 richieste ripetute, 0 chiamate, 0 caratteri in più');

  // ---- refusals before any call ----
  reset();
  const dirty = await (await ask(['Hai 5 voti a casa', 'Scrivi a mario.rossi@example.org subito', 'Visita https://example.org ora'])).json();
  assert.ok(Object.values(dirty.translations).every(value => value === null)); assert.equal(requests.length, 0, 'Cifre, e-mail e indirizzi non partono mai.');
  assert.equal((await ask(Array.from({ length: 21 }, (_, i) => `Testo numero ⟦0⟧ della prova ${'a'.repeat(i)}`))).status, 400, 'Oltre 20 testi per richiesta: rifiutata.');
  Object.assign(env, { TRANSLATE_REQUEST_CHARS: '60' });
  const big = await (await ask(['Questo è un testo piuttosto lungo che supera il limite per singola richiesta del servizio'])).json();
  assert.equal(Object.values(big.translations)[0], null); assert.equal(requests.length, 0, 'Oltre il limite per richiesta: nessuna chiamata.');
  delete env.TRANSLATE_REQUEST_CHARS;
  lines.push('rifiutati prima di ogni chiamata: cifre, e-mail, indirizzi, più di 20 testi, richiesta oltre il limite');

  // ---- daily and monthly limits, atomic under simultaneous requests ----
  reset();
  Object.assign(env, { TRANSLATE_DAILY_CHARS: '400', TRANSLATE_MONTHLY_CHARS: '100000', TRANSLATE_RATE_PER_MIN: '1000' });
  const burst = await Promise.all(Array.from({ length: 30 }, (_, i) => ask([`Frase di prova numero ${'x'.repeat(i + 1)} per il conteggio dei caratteri`], { ip: `198.51.100.${i + 1}` })));
  const sentChars = requests.reduce((sum, item) => sum + item.body.text.reduce((a, b) => a + b.length, 0), 0);
  assert.ok(sentChars <= 400, `Con 30 richieste simultanee e un tetto di 400 caratteri ne sono partiti ${sentChars}.`);
  assert.ok(budget().day_used <= 400 && budget().day_used >= sentChars, 'Il contatore non supera mai il tetto e conta quanto inviato.');
  assert.ok(burst.some(response => response.status === 429), 'Raggiunto il tetto le richieste vengono bloccate.');
  const afterLimit = requests.length;
  const blocked = await ask(['Una frase nuova dopo il tetto giornaliero del servizio']);
  assert.equal(blocked.status, 429); assert.equal((await blocked.json()).limit, 'limite-giornaliero'); assert.equal(requests.length, afterLimit, 'Dopo il tetto nessuna chiamata a DeepL.');
  reset();
  Object.assign(env, { TRANSLATE_DAILY_CHARS: '100000', TRANSLATE_MONTHLY_CHARS: '300' });
  for (let i = 0; i < 12; i++) await ask([`Altra frase mensile numero ${'y'.repeat(i + 1)} da contare bene`]);
  assert.ok(budget().month_used <= 300, 'Il tetto mensile vale anche se quello giornaliero è alto.');
  assert.equal((await ask(['Frase nuova oltre il tetto mensile del servizio di prova'])).status, 429);
  // the day rolls over, the month does not: with a new day the day counter restarts
  local.sqlite.exec("UPDATE translate_budget SET day = '2000-01-01'");
  assert.ok((await reserve(env.ACCOUNTS, 5, { day: 100, month: 100000 })).ok, 'Un nuovo giorno riparte da zero (mese permettendo).');
  delete env.TRANSLATE_DAILY_CHARS; delete env.TRANSLATE_MONTHLY_CHARS; delete env.TRANSLATE_RATE_PER_MIN;
  lines.push(`limiti: 30 richieste simultanee con tetto 400 → ${sentChars} caratteri inviati, contatore ≤ 400; tetto mensile; blocco immediato dopo il tetto`);

  // ---- the same text, many requests at once ----
  reset(); deeplMode = 'slow';
  await Promise.all(Array.from({ length: 12 }, (_, i) => ask(['La riforma è stata approvata'], { ip: `192.0.2.${i + 1}` })));
  assert.equal(requests.reduce((sum, item) => sum + item.body.text.filter(text => /riforma/.test(text)).length, 0), 1, 'Lo stesso testo chiesto 12 volte insieme parte una volta sola.');
  deeplMode = 'ok';

  // ---- errors: counted, blocked, never repeated ----
  reset(); deeplMode = '456';
  const failed = await ask(['Prova di errore del provider nel conteggio']);
  assert.equal(requests.length, 1); assert.ok(budget().day_used > 0, 'Anche la richiesta fallita dopo l’invio è contata.');
  assert.ok(budget().blocked_until > Date.now(), 'Dopo un errore di quota il servizio si blocca per ore.');
  deeplMode = 'ok';
  const again = await ask(['Seconda prova dopo il blocco del provider']);
  assert.equal(again.status, 429); assert.equal(requests.length, 1, 'Nessun nuovo tentativo mentre è bloccato.');
  lines.push('errore del provider (456): contato, servizio bloccato per ore, nessun nuovo tentativo');

  // ---- fail closed ----
  reset();
  const realDb = env.ACCOUNTS;
  env.ACCOUNTS = { prepare() { throw new Error('D1 non risponde'); }, batch: async () => { throw new Error('D1 non risponde'); } };
  const closed = await ask(['Prova con il contatore guasto del servizio']);
  assert.equal(closed.status, 503); assert.equal(requests.length, 0, 'Se il contatore non risponde non parte nessuna chiamata.');
  env.ACCOUNTS = realDb;
  lines.push('contatore guasto: 503 e nessuna chiamata (fail closed)');

  // ---- rate limit per address ----
  reset(); Object.assign(env, { TRANSLATE_RATE_PER_MIN: '4' });
  const codes = [];
  for (let i = 0; i < 8; i++) codes.push((await ask(['Il tuo avversario ha rinunciato'], { ip: '203.0.113.250' })).status);
  assert.deepEqual(codes.slice(0, 4).every(code => code === 200) && codes.slice(4).every(code => code === 429), true, `Limite per indirizzo: ${codes}`);
  assert.equal((await ask(['Il tuo avversario ha rinunciato'], { ip: '203.0.113.251' })).status, 200, 'Un altro indirizzo non è toccato.');
  delete env.TRANSLATE_RATE_PER_MIN;

  // ---- Android app: the origins of the installed app ----
  reset();
  for (const origin of ['capacitor://localhost', 'https://localhost']) {
    const pre = await local.worker.fetch(new Request(`${local.origin}/api/translate`, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' } }), env);
    assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-origin'), origin, `Preflight dell’app (${origin}).`);
    const response = await ask(['Il tuo avversario ha rinunciato'], { origin });
    assert.equal(response.headers.get('access-control-allow-origin'), origin); assert.equal(response.status, 200);
  }
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(/connect-src[^;]*palazzo-2026-site\.bianchimatteo657\.workers\.dev/.test(html), 'La CSP dell’app permette il Worker.');
  const { accountApiBase } = await import(`../src/data/repositories/account-sync.js?v=${build}`);
  globalThis.Capacitor = { isNativePlatform: () => true };
  assert.equal(accountApiBase(), 'https://palazzo-2026-site.bianchimatteo657.workers.dev', 'L’app Android usa sempre il Worker pubblicato.');
  delete globalThis.Capacitor;
  lines.push('Android: origini capacitor://localhost e https://localhost accettate (preflight e POST), CSP e indirizzo del Worker corretti');

  // ---- client: offline, limits, not configured ----
  const memory = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) }; };
  reset();
  const store = memory();
  const viaWorker = init => local.worker.fetch(new Request(`${local.origin}/api/translate`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.99' }, body: init.body }), env);
  const first = createAutoTranslator({ fetchImpl: (url, init) => viaWorker(init), storage: store });
  first.request('Il tuo avversario ha rinunciato'); await first.flush();
  const reborn = createAutoTranslator({ fetchImpl: async () => { throw new Error('offline'); }, storage: store });
  assert.equal(reborn.lookup('Il tuo avversario ha rinunciato'), 'Your opponent has withdrawn', 'Offline: la traduzione già scaricata resta.');
  const offline = createAutoTranslator({ fetchImpl: async () => { throw new Error('offline'); }, storage: memory() });
  offline.request('La riforma è stata approvata'); await offline.flush();
  assert.equal(offline.lookup('La riforma è stata approvata'), undefined, 'Offline e senza cache: resta l’italiano.'); assert.match(offline.status().reason, /Rete non disponibile/);
  let calls429 = 0;
  const limited = createAutoTranslator({ fetchImpl: async () => { calls429++; return new Response(JSON.stringify({ limit: 'limite-giornaliero', configured: true }), { status: 429 }); }, storage: memory() });
  limited.request('Primo testo da tradurre per il limite'); await limited.flush();
  limited.request('Secondo testo da tradurre per il limite'); await limited.flush();
  assert.equal(calls429, 1, 'Dopo il rifiuto per limite la pagina smette di chiedere.'); assert.match(limited.status().reason, /Limite/);
  delete env.TRANSLATE_PROVIDER;
  const callsBefore = requests.length;
  const none = createAutoTranslator({ fetchImpl: (url, init) => viaWorker(init), storage: memory() });
  none.request('Una frase mai vista prima della prova'); await none.flush(); none.request('Un’altra frase mai vista prima'); await none.flush();
  assert.equal(none.status().configured, false); assert.ok(none.status().needs.length);
  assert.equal(requests.length, callsBefore, 'Senza provider nessuna chiamata a DeepL.');
  Object.assign(env, { TRANSLATE_PROVIDER: 'deepl' });
  lines.push('client: offline (cache sul dispositivo), pausa dopo il limite, stato «non configurato»');

  // ---- static: the key and other providers do not exist in the page or the repository ----
  for (const dirUrl of [new URL('../src/core/', import.meta.url), new URL('../src/ui/', import.meta.url)]) for (const entry of await readdir(dirUrl, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    const source = await readFile(new URL(entry.name, dirUrl), 'utf8');
    assert.ok(!/TRANSLATE_API_KEY|api(-free)?\.deepl\.com|DeepL-Auth-Key|translation\.googleapis|libretranslate/i.test(source), `${entry.name}: nessuna chiave, host o altro provider nel client.`);
  }
  const wrangler = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.ok(!/TRANSLATE_API_KEY\s*"?\s*:/.test(wrangler), 'La chiave non è nel repository.');
  assert.ok(!/google|libretranslate/i.test(await readFile(new URL('../worker-translate.js', import.meta.url), 'utf8').then(text => text.replace(/\/\/.*$/gm, ''))), 'Il Worker non ha altri provider.');
  lines.push('nessuna chiave né altro provider nel client o nel repository');

  // ---- the page, with a desktop and a phone profile ----
  if (!chromeAvailable) lines.push('Chrome assente: prova della pagina saltata');
  else for (const phone of [false, true]) {
    reset();
    Object.assign(env, { TRANSLATE_PROVIDER: 'deepl', TRANSLATE_API_KEY: 'chiave-di-prova-segreta' });
    await withBrowser(async browser => {
      const { evaluate, send, viewport } = browser;
      if (phone) { await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36' }); await viewport(412, 915, true); }
      await createCareerInPage(browser, { language: 'en' });
      await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ language: 'en' })), true`);
      await openCareer(browser);
      const stateBefore = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${browser.version}'); const s = store.getState(); return JSON.stringify([s.career.id, s.career.playerId, s.dataset.politicians.length]); })()`);
      const insert = `document.body.insertAdjacentHTML('afterbegin', '<div id="auto-test"><p id="a">Il tuo avversario ha rinunciato</p><p id="b" data-no-translate>La riforma è stata approvata</p><p id="c">Giorgia Meloni</p><textarea id="d">La riforma è stata approvata</textarea><button id="e" title="La riforma è stata approvata">ok</button><p id="f">Hai ottenuto 1.234 voti a Siena</p></div>'), true`;
      await evaluate(insert);
      await waitFor(() => evaluate(`document.getElementById('a').textContent === 'Your opponent has withdrawn' && document.getElementById('f').textContent === 'You got 1,234 voti a Siena'`), 20000).catch(async error => { console.log('DBG', await evaluate(`JSON.stringify([document.getElementById('a')?.textContent, document.getElementById('f')?.textContent])`), requests.length); throw error; });
      assert.equal(await evaluate(`document.getElementById('b').textContent`), 'La riforma è stata approvata', 'Con data-no-translate il testo non si tocca.');
      assert.equal(await evaluate(`document.getElementById('c').textContent`), 'Giorgia Meloni');
      assert.equal(await evaluate(`document.getElementById('d').value`), 'La riforma è stata approvata', 'Il testo scritto dal giocatore non si tocca.');
      await waitFor(() => evaluate(`document.getElementById('e').title === 'The reform has been passed'`), 15000);
      const wire = requests.map(item => item.raw).join('\n');
      for (const secret of [...SECRETS, 'Giorgia', 'Verifica']) assert.ok(!wire.includes(secret), `Dalla pagina a DeepL non parte «${secret}».`);
      assert.equal(await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${browser.version}'); const s = store.getState(); return JSON.stringify([s.career.id, s.career.playerId, s.dataset.politicians.length]); })()`), stateBefore, 'I dati della carriera sono gli stessi.');
      const count = requests.length;
      await evaluate(`document.getElementById('auto-test').remove(), true`);
      await evaluate(insert.replace('1.234', '99').replace('Siena', 'Roma'));
      await waitFor(() => evaluate(`document.getElementById('f').textContent === 'You got 99 voti a Roma'`), 10000);
      assert.equal(requests.length, count, 'Valori nuovi, stesso modello: nessuna nuova richiesta a DeepL.');
      const html = await evaluate(`document.documentElement.outerHTML`);
      assert.ok(!html.includes('chiave-di-prova-segreta'), 'La chiave non arriva alla pagina.');
      assert.equal(browser.errors.length, 0, `Errori nella pagina: ${browser.errors.join(' | ')}`);
    }, { serverPort: 8797, language: 'en' });
  }
  if (chromeAvailable) lines.push('pagina (desktop e profilo Android): modelli tradotti, valori rimessi sul dispositivo, nessun dato verso DeepL, testi del giocatore e data-no-translate intatti, valori nuovi senza nuove richieste');
} finally { globalThis.fetch = realFetch; await local.close?.(); }
console.log(`Traduzione automatica (DeepL, provider finto) verificata: ${lines.join('; ')}.`);
process.exit(0);
