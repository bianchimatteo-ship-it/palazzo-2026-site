// Automatic translation IT → EN: server (worker-translate.js, the real Worker in process with a stand-in provider), client cache (src/core/i18n-auto.js) and the page in Chrome.
// The stand-in provider is a fake HTTP API answered by a replaced fetch: it proves what is SENT (protected placeholders, names, glossary, no key in the page) and what is DONE with the
// answer (cache, ceilings, refusal of an answer that lost a protected stretch). It does not prove the quality of a real provider's English: that needs a configured provider.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, pause, waitFor, withBrowser } from './lib/browser.mjs';
import { startLocalWorker } from './lib/local-worker.mjs';
import { protect, restore, needsOf, providerOf, translateBatch } from '../worker-translate.js';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const lines = [];

// ---------- 1. protection and restoration ----------
{
  const text = 'Il sindaco di Siena ha {nome} voti: 1.234,5 su 40 (Fratelli d’Italia, #)';
  const { html, pieces } = protect(text, ['Siena', 'Fratelli d’Italia']);
  for (const kept of ['Siena', 'Fratelli d’Italia', '{nome}', '1.234,5', '40', '#']) assert.ok(pieces.includes(kept), `Protetto: ${kept}`);
  assert.ok(pieces.includes('mayor'), 'Il glossario passa dal tag che il provider non tocca.');
  assert.ok(html.includes('>mayor<'), 'Nel testo protetto il termine inglese del glossario è già quello fisso.');
  // a provider that keeps the spans and translates the rest
  const fake = html.replace('Il ', 'The ').replace(' di ', ' of ').replace(' ha ', ' has ').replace(' voti: ', ' votes: ').replace(' su ', ' out of ');
  const back = restore(fake, pieces);
  assert.ok(back && back.includes('mayor') && back.includes('Siena') && back.includes('{nome}') && back.includes('1.234,5') && back.includes('Fratelli d’Italia') && back.endsWith('#)'), `Ripristino: ${back}`);
  assert.equal(restore(fake.replace(/<span[^>]*>Siena<\/span>/, 'Sienna'), pieces), null, 'Un nome alterato o perso rifiuta la traduzione (resta l’italiano).');
  assert.equal(restore('<b>x</b>', []), null, 'Markup non previsto rifiutato.');
  assert.equal(restore(fake.replace(/<span[^>]*>40<\/span>/, '41'), pieces), null, 'Un numero perso rifiuta la traduzione.');
  lines.push('protezione di segnaposto, numeri, nomi e glossario; risposte alterate rifiutate');
}

// ---------- 2. not configured: it says so ----------
assert.deepEqual(needsOf({}).length > 0, true);
assert.equal(providerOf({ TRANSLATE_PROVIDER: 'deepl' }), null, 'Senza chiave nessun provider.');
{
  const result = await translateBatch({}, ['Il governo è caduto'], []);
  assert.equal(result.translations['Il governo è caduto'], null);
  assert.equal(result.configured, false, 'Senza provider la risposta dice «non configurato», non restituisce l’italiano come tradotto.');
}

// ---------- 3. the Worker ----------
const calls = [];
const realFetch = globalThis.fetch;
const dictionary = { 'Il tuo avversario ha rinunciato': 'Your opponent has withdrawn', 'La riforma è stata approvata': 'The reform has been passed' };
globalThis.fetch = async (url, options) => {
  if (!String(url).startsWith('https://translate.test')) return realFetch(url, options);
  const body = JSON.parse(options.body);
  calls.push({ url: String(url), body });
  const q = Array.isArray(body.q) ? body.q : [body.q];
  const out = q.map(html => {
    const plain = html.replace(/<span[^>]*>[\s\S]*?<\/span>/g, '§');
    const key = Object.keys(dictionary).find(item => plain.startsWith(item));
    if (html.includes('PERDI')) return html.replace(/<span[^>]*>[\s\S]*?<\/span>/, ''); // an answer that loses a protected stretch
    return key ? html.replace(key, dictionary[key]) : html.replace(/^/, 'EN: ');
  });
  return new Response(JSON.stringify({ translatedText: out }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const local = await startLocalWorker({ port: 8797 });
const ask = (body, ip = '203.0.113.9') => local.worker.fetch(new Request(`${local.origin}/api/translate`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify(body) }), local.env);
try {
  const status = await (await local.worker.fetch(new Request(`${local.origin}/api/translate/status`), local.env)).json();
  assert.equal(status.configured, false);
  assert.ok(status.needs.length >= 2, 'Dice cosa manca.');
  const refused = await ask({ texts: ['Il governo è caduto'] });
  assert.equal(refused.status, 503);
  const refusedBody = await refused.json();
  assert.equal(refusedBody.configured, false); assert.ok(refusedBody.needs.some(item => /TRANSLATE_API_URL|TRANSLATE_API_KEY/.test(item)));
  assert.equal(calls.length, 0, 'Senza configurazione nessuna chiamata esterna.');

  Object.assign(local.env, { TRANSLATE_PROVIDER: 'libretranslate', TRANSLATE_API_URL: 'https://translate.test', TRANSLATE_API_KEY: 'chiave-segreta-di-prova' });
  const first = await (await ask({ texts: ['Il tuo avversario ha rinunciato', 'La riforma è stata approvata'], keep: [] })).json();
  assert.equal(first.translations['Il tuo avversario ha rinunciato'], 'Your opponent has withdrawn');
  assert.ok(!JSON.stringify(first).includes('chiave-segreta-di-prova'), 'La chiave non esce mai dal Worker.');
  assert.equal(calls.length, 1); assert.equal(calls[0].body.api_key, 'chiave-segreta-di-prova'); assert.equal(calls[0].body.source, 'it'); assert.equal(calls[0].body.target, 'en');
  const again = await (await ask({ texts: ['Il tuo avversario ha rinunciato'] }, '203.0.113.10')).json();
  assert.equal(again.translations['Il tuo avversario ha rinunciato'], 'Your opponent has withdrawn');
  assert.equal(calls.length, 1, 'Un testo già tradotto non rifà la richiesta (cache persistente).');
  assert.ok([...local.kvData.keys()].some(key => key.startsWith('tr:v1:')), 'La cache è nell’archivio persistente.');

  const lost = await (await ask({ texts: ['Questo PERDI il 12 per cento'] })).json();
  assert.equal(lost.translations['Questo PERDI il 12 per cento'], null, 'Una risposta che perde un numero non viene usata né salvata.');
  const named = await (await ask({ texts: ['Elly Schlein incontra il Presidente della Repubblica'], keep: ['Elly Schlein'] })).json();
  const sent = calls.at(-1).body.q.find(item => item.includes('Schlein'));
  assert.match(sent, /<span translate="no" class="notranslate">Elly Schlein<\/span>/, 'Il nome proprio viaggia protetto.');
  assert.match(sent, /President of the Republic/, 'Il glossario fissa il termine istituzionale.');
  assert.match(named.translations['Elly Schlein incontra il Presidente della Repubblica'], /Elly Schlein.*President of the Republic/);

  for (const bad of [{ texts: [] }, { texts: ['x'] }, { texts: ['a'.repeat(601)] }, { texts: Array.from({ length: 41 }, (_, i) => `Testo numero ${i} della prova`) }, {}]) assert.equal((await ask(bad)).status, 400);
  Object.assign(local.env, { TRANSLATE_DAILY_CHARS: '60' });
  const limited = await ask({ texts: ['Una frase nuova che supera il tetto giornaliero del servizio'] }, '203.0.113.11');
  assert.equal(limited.status, 429); assert.equal((await limited.json()).limit, true);
  delete local.env.TRANSLATE_DAILY_CHARS;
  let hit = 0;
  for (let i = 0; i < 25; i++) hit = (await ask({ texts: [`Frase di prova numero ${i} nel minuto`] }, '203.0.113.50')).status;
  assert.equal(hit, 429, 'Troppe richieste dallo stesso indirizzo in un minuto: limitate.');
  lines.push('Worker: stato e 503 con cosa manca, cache persistente, chiave mai in uscita, nome e glossario protetti, risposte alterate scartate, tetto giornaliero e limite per indirizzo');

  // ---------- 4. the client ----------
  const { createAutoTranslator, looksTranslatable } = await import(`../src/core/i18n-auto.js?v=${build}`);
  const memory = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)) }; };
  assert.ok(looksTranslatable('Il governo è caduto') && looksTranslatable('Hai raggiunto la soglia del 3%'));
  for (const name of ['Giorgia Meloni', 'Fratelli d’Italia', 'Reggio Emilia', 'https://example.org/pagina', '123']) assert.ok(!looksTranslatable(name), `${name}: un nome non si traduce`);
  const store = memory();
  const viaWorker = (body) => local.worker.fetch(new Request(`${local.origin}/api/translate`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.77' }, body }), local.env);
  const fetchImpl = async (url, init) => url.endsWith('/status') ? local.worker.fetch(new Request(`${local.origin}/api/translate/status`), local.env) : viaWorker(init.body);
  let arrived = 0;
  const auto = createAutoTranslator({ fetchImpl, storage: store, onTranslated: n => { arrived += n; }, names: () => ['Elly Schlein'] });
  auto.request('La riforma è stata approvata'); auto.request('Giorgia Meloni'); auto.request('La riforma è stata approvata');
  const before = calls.length;
  await auto.flush();
  assert.equal(auto.lookup('La riforma è stata approvata'), 'The reform has been passed');
  assert.equal(auto.lookup('Giorgia Meloni'), undefined, 'Un nome non viene nemmeno inviato.');
  assert.ok(arrived >= 1 && auto.status().configured === true);
  const reborn = createAutoTranslator({ fetchImpl: async () => { throw new Error('offline'); }, storage: store });
  assert.equal(reborn.lookup('La riforma è stata approvata'), 'The reform has been passed', 'Dopo un riavvio, offline, la traduzione salvata c’è.');
  const off = createAutoTranslator({ fetchImpl: async () => { throw new Error('offline'); }, storage: memory() });
  off.request('Il tuo avversario ha rinunciato'); await off.flush();
  assert.equal(off.lookup('Il tuo avversario ha rinunciato'), undefined); assert.match(off.status().reason, /Rete non disponibile/);
  delete local.env.TRANSLATE_PROVIDER;
  const none = createAutoTranslator({ fetchImpl, storage: memory() });
  none.request('Una frase mai vista prima della prova'); await none.flush();
  assert.equal(none.status().configured, false); assert.ok(none.status().needs.length, 'Lato client lo stato dice che manca la configurazione.');
  lines.push('client: nomi esclusi, cache persistente e offline, stato «non configurato» e «rete assente» dichiarati');
  Object.assign(local.env, { TRANSLATE_PROVIDER: 'libretranslate' });

  // ---------- 5. no key, no provider in the code that reaches the page ----------
  const walk = async dir => (await readdir(dir, { withFileTypes: true })).flatMap(entry => entry.isDirectory() ? [] : [new URL(entry.name, dir)]);
  for (const dirUrl of [new URL('../src/core/', import.meta.url), new URL('../src/ui/', import.meta.url)]) for (const file of await walk(dirUrl)) {
    const source = await readFile(file, 'utf8');
    assert.ok(!/TRANSLATE_API_KEY|api\.deepl\.com|translation\.googleapis\.com|DeepL-Auth-Key/.test(source), `${file.pathname}: nessuna chiave né indirizzo del provider nel client.`);
  }
  const wrangler = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.ok(!/TRANSLATE_API_KEY\s*"?\s*:/.test(wrangler), 'La chiave non è nel repository.');
  lines.push('nessuna chiave né indirizzo del provider nel client o nel repository');

  // ---------- 6. the page ----------
  if (!chromeAvailable) lines.push('Chrome assente: prova della pagina saltata');
  else {
    Object.assign(local.env, { TRANSLATE_PROVIDER: 'libretranslate', TRANSLATE_API_URL: 'https://translate.test', TRANSLATE_API_KEY: 'chiave-segreta-di-prova' });
    await withBrowser(async browser => {
      const { evaluate, send, goto } = browser;
      await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ language: 'en' })), true`);
      await createCareerInPage(browser, { language: 'en' });
      await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ language: 'en' })), true`);
      await openCareer(browser);
      // names and game data are not touched by the English view
      const before = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${browser.version}'); const s = store.getState(); return JSON.stringify([s.career.id, s.career.playerId, s.dataset.politicians.length, s.game?.party?.name ?? null]); })()`);
      const text = await evaluate(`document.body.innerText`);
      assert.ok(/Prova Verifica|Verifica Prova/.test(text) || /Prova/.test(text), 'Il nome del giocatore resta com’è in inglese.');
      const nodeHtml = `document.body.insertAdjacentHTML('afterbegin', '<div id="auto-test"><p id="a">Il tuo avversario ha rinunciato</p><p id="b" data-no-translate>La riforma è stata approvata</p><p id="c">Giorgia Meloni</p><textarea id="d">La riforma è stata approvata</textarea><button id="e" title="La riforma è stata approvata">ok</button></div>'), true`;
      await evaluate(nodeHtml);
      await waitFor(() => evaluate(`document.getElementById('a').textContent === 'Your opponent has withdrawn'`), 15000).catch(async error => { console.log('DBG', await evaluate(`JSON.stringify([document.documentElement.lang, document.getElementById('a')?.textContent, localStorage.getItem('politicando.settings.v1'), localStorage.getItem('politicando.i18n.auto.v1')])`), calls.length); throw error; });
      assert.equal(await evaluate(`document.getElementById('b').textContent`), 'La riforma è stata approvata', 'Con data-no-translate il testo non si tocca.');
      assert.equal(await evaluate(`document.getElementById('c').textContent`), 'Giorgia Meloni');
      assert.equal(await evaluate(`document.getElementById('d').value`), 'La riforma è stata approvata', 'Il testo scritto dal giocatore non si tocca.');
      await waitFor(() => evaluate(`document.getElementById('e').title === 'The reform has been passed'`), 15000);
      const afterData = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${browser.version}'); const s = store.getState(); return JSON.stringify([s.career.id, s.career.playerId, s.dataset.politicians.length, s.game?.party?.name ?? null]); })()`);
      assert.equal(afterData, before, 'I dati della carriera sono gli stessi: la traduzione vive solo sullo schermo.');
      const stored = await evaluate(`localStorage.getItem('politicando.i18n.auto.v1')`);
      assert.ok(stored && stored.includes('Your opponent has withdrawn') && !stored.includes('chiave-segreta'), 'La traduzione è salvata sul dispositivo, senza chiavi.');
      const html = await evaluate(`document.documentElement.outerHTML`);
      assert.ok(!html.includes('chiave-segreta-di-prova'), 'La chiave non arriva alla pagina.');
      // offline: the same text is now translated from the device cache
      const requests = calls.length;
      await evaluate(`document.getElementById('auto-test').remove(), true`);
      await evaluate(nodeHtml);
      await waitFor(() => evaluate(`document.getElementById('a').textContent === 'Your opponent has withdrawn'`), 10000);
      assert.equal(calls.length, requests, 'Il testo già tradotto non fa una nuova richiesta.');
      assert.equal(browser.errors.length, 0, `Errori nella pagina: ${browser.errors.join(' | ')}`);
    }, { serverPort: 8797, language: 'en' });
    lines.push('pagina: testo nuovo tradotto dal server, nomi/testi del giocatore/data-no-translate intatti, cache sul dispositivo, nessuna richiesta ripetuta, nessuna chiave nella pagina');
  }
} finally { globalThis.fetch = realFetch; await local.close?.(); }
console.log(`Traduzione automatica verificata: ${lines.join('; ')}.`);
process.exit(0);
