// Robust start (src/main.js): one real collection that does not arrive, or arrives damaged, never stops the game.
// The page mounts with everything else, a notice names only what is really missing, the integrity checks still refuse
// a damaged collection, and “Riprova” loads again only what is missing. Real JSON files from disk; the failures are
// simulated by the stand-in network.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = { innerWidth: 1200 };
globalThis.addEventListener = () => {};
globalThis.location = { href: 'http://localhost:4173/', origin: 'http://localhost:4173', hostname: 'localhost', port: '4173', protocol: 'http:', hash: '', search: '', replace() { throw new Error('Nessun ricaricamento atteso.'); } };
globalThis.indexedDB = undefined;
const listeners = {};
const root = { innerHTML: '', addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); }, querySelector: () => null, querySelectorAll: () => [] };
globalThis.document = { baseURI: 'http://localhost/', activeElement: null, querySelector: selector => selector === '#app' ? root : null, documentElement: { dataset: {}, style: { setProperty() {} } }, createElement: () => ({ style: {}, dataset: {}, hidden: false, children: [], replaceChildren() {}, append() {} }), createTextNode: text => text, body: { append() {} } };

// The network: files from disk; a collection that fails (coalitions), one that arrives damaged (politicians: an
// incomplete list, refused by the count of the manifest) and a real document that fails (the 2022 map).
const broken = { 'coalitions.json': 'fail', 'politicians.json': 'truncated', 'electoral-geography.json': 'fail' };
const requested = [];
globalThis.fetch = async url => {
  const href = String(url);
  const file = new URL(href).pathname.split('/').pop();
  requested.push(file);
  if (!href.startsWith('file:')) throw new TypeError('fetch failed');
  if (broken[file] === 'fail') throw new TypeError('fetch failed');
  const text = await readFile(fileURLToPath(new URL(href.split('?')[0])), 'utf8');
  const body = broken[file] === 'truncated' ? JSON.stringify(JSON.parse(text).slice(0, 10)) : text;
  return { ok: true, status: 200, text: async () => body, json: async () => JSON.parse(body) };
};

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
await import(`../src/main.js${v}`);
const settle = async () => { for (let i = 0; i < 40; i++) await new Promise(resolve => setTimeout(resolve, 10)); };
await settle();
const real = await import(`../src/data/repositories/real-data.js${v}`);

// 1. The game is open, with what arrived.
assert.ok(root.innerHTML.includes('main-menu'), 'Con una collezione mancante il gioco si apre comunque.');
assert.ok(!root.innerHTML.includes('non è stato possibile leggere'), 'Nessuna schermata di errore bloccante.');
for (const name of ['parties', 'politicalMovements', 'twoPerThousand', 'realPolls', 'government', 'parliamentaryGroups']) assert.ok(real.isRealCollectionLoaded(name), `Collezione caricata nonostante gli errori: ${name}.`);
// 2. Only what is really missing is named, the integrity check still holds.
const failures = real.realDataFailures();
assert.deepEqual(failures.map(item => item.name).sort(), ['coalitions', 'electoralGeography', 'politicians'], 'Sono segnalati solo i dati davvero mancanti.');
assert.ok(!real.isRealCollectionLoaded('politicians') && /incompleta \(10\//.test(failures.find(item => item.name === 'politicians').message), 'Una collezione danneggiata viene ancora rifiutata dal controllo di integrità.');
assert.ok(root.innerHTML.includes('Alcuni dati reali non sono disponibili: <strong>'), 'Il menu mostra l’avviso dei dati mancanti.');
for (const label of ['coalizioni', 'parlamentari', 'mappa elettorale 2022']) assert.ok(root.innerHTML.includes(label), `Avviso: manca «${label}».`);
assert.ok(root.innerHTML.includes('data-action="retry-data"'), 'L’avviso offre “Riprova”.');

// 3. “Riprova” when the network is back: only the missing files are requested again, the notice disappears.
for (const key of Object.keys(broken)) delete broken[key];
requested.length = 0;
const click = async attrs => { const target = { closest: selector => selector.split(',').some(part => part.trim() === '[data-action]') && attrs.action ? { dataset: attrs } : null, matches: () => false }; for (const fn of listeners.click ?? []) await fn({ target, preventDefault() {} }); await settle(); };
await click({ action: 'retry-data' });
assert.deepEqual(real.realDataFailures(), [], 'Dopo “Riprova” non manca più nulla.');
assert.ok(real.isRealCollectionLoaded('coalitions') && real.isRealCollectionLoaded('politicians') && real.isRealCollectionLoaded('electoralGeography'), 'Le collezioni mancanti sono caricate.');
assert.ok(!requested.includes('parties.json') && !requested.includes('manifest.json') && requested.includes('coalitions.json'), `Si richiede di nuovo solo ciò che mancava: ${[...new Set(requested)].join(', ')}.`);
assert.ok(!root.innerHTML.includes('Alcuni dati reali non sono disponibili'), 'L’avviso sparisce.');

console.log('Avvio robusto verificato: con una collezione reale non disponibile (coalizioni), una danneggiata (parlamentari, rifiutata dal controllo di integrità) e un documento assente (mappa 2022) il gioco si apre, segnala solo i dati mancanti e “Riprova” ricarica solo quelli.');
process.exit(0);
