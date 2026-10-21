// Italiano / English. Part 1 (Node): the phrase book — pairs well formed, no duplicates that disagree, the same numbers (`#`) and free parts (`{}`) on both sides, numbers/currency/dates in the
// English form, templates that never match a long text, the stable keys. Part 2 (Chrome): the selector on the opening screen, the choice kept after a reload and independent of the saves,
// `<html lang>`, the same screen and the same data after switching language in a career (nothing created, reset or moved), the main screens in English with the Italian that remains measured.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { COLLECT, PAGES, tourCareer } from './lib/i18n-tour.mjs';

// ---------- 1. the dictionaries ----------
const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
mem.set('politicando.settings.v1', JSON.stringify({ language: 'en' }));
const version = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const I = await import(`../src/core/i18n.js?v=${version}`);
const { PHRASES: p1 } = await import(`../src/data/i18n/en-ui-1.js?v=${version}`), { PHRASES: p2 } = await import(`../src/data/i18n/en-ui-2.js?v=${version}`), { PHRASES: p3 } = await import(`../src/data/i18n/en-ui-3.js?v=${version}`), { PHRASES: p4 } = await import(`../src/data/i18n/en-ui-4.js?v=${version}`);
const { KEYS } = await import(`../src/data/i18n/keys.js?v=${version}`);
const all = [...p1, ...p2, ...p3, ...p4];
assert.ok(all.length > 3000, `Il dizionario inglese ha ${all.length} voci.`);
const seen = new Map();
for (const [it, en] of all) {
  assert.ok(typeof it === 'string' && typeof en === 'string' && it.trim() && en.trim(), `Voce vuota o non testuale: ${JSON.stringify([it, en])}`);
  assert.equal(it.split('#').length, en.split('#').length, `Numeri (#) diversi: «${it}» → «${en}»`);
  assert.equal(it.split('{}').length, en.split('{}').length, `Parti libere ({}) diverse: «${it}» → «${en}»`);
  assert.ok(!/\bTODO\b|XXX/.test(en), `Segnaposto nella traduzione: ${en}`);
  assert.ok(!(seen.has(it) && seen.get(it) !== en), `Voce doppia con traduzioni diverse: «${it}»`);
  seen.set(it, en);
}
assert.ok(Object.keys(KEYS).includes('language.label') && KEYS['language.hint'], 'Le chiavi stabili della lingua ci sono.');
I.installBook(all, KEYS);
await I.setLanguage('en');
const T = I.translateText;
assert.equal(T('Nuova partita'), 'New game');
assert.equal(T('  Chiudi la settimana  '), '  Close the week  ', 'Gli spazi attorno al testo restano.');
assert.equal(T('Settimana 12'), 'Week 12', 'Una frase con un numero è tradotta con il suo valore.');
assert.equal(T('1.234 €'), '€1,234', 'Importi in forma inglese.');
assert.equal(T('12,5%'), '12.5%', 'Decimali in forma inglese.');
assert.equal(T('Settimana 3 · 2.500 €'), 'Week 3 · €2,500', 'Numeri e frasi insieme.');
assert.equal(T('12 ottobre 2026'), '12 October 2026', 'Le date seguono la lingua.');
assert.equal(T('lunedì'), 'Monday');
assert.equal(T('Mario Rossi'), 'Mario Rossi', 'I nomi propri non si traducono.');
assert.equal(T('Partito Democratico'), 'Partito Democratico', 'Le denominazioni ufficiali non si traducono.');
assert.equal(T('Apri il profilo di Azione'), 'Open the profile of Azione', 'Una frase con una parte libera: il nome resta.');
assert.equal(T('Toscana · fiducia 62'), 'Toscana · confidence 62');
assert.equal(T('un testo mai visto prima'), 'un testo mai visto prima', 'Ciò che non è nel dizionario resta italiano, mai sbagliato.');
assert.equal(T('Z'.repeat(5000)), 'Z'.repeat(5000), 'Un testo lungo non passa dai confronti costosi.');
const t0 = Date.now(); for (let i = 0; i < 2000; i++) T(`Un testo qualunque ${i} che non ha corrispondenze, con ${i} numeri e (parentesi) · e altro: ancora`); assert.ok(Date.now() - t0 < 1500, `La ricerca è rapida (${Date.now() - t0} ms).`);
assert.equal(I.t('language.label', 'Lingua'), 'Language');
assert.equal(I.t('chiave.inesistente', 'Testo {n}', { n: 3 }), 'Testo 3', 'Una chiave mancante ricade sull’italiano.');
await I.setLanguage('it');
assert.equal(T('Nuova partita'), 'Nuova partita', 'In italiano nulla cambia.');
assert.equal(I.t('language.label', 'Lingua'), 'Lingua');
assert.equal(JSON.parse(mem.get('politicando.settings.v1')).language, 'it', 'La scelta è salvata tra le preferenze, non in un salvataggio.');

// ---------- 2. in a real browser ----------
if (!chromeAvailable) { console.log('Lingua nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).'); process.exit(0); }
const ITALIAN = new Set('il lo la le gli un una di del della dei delle al alla dal nel nella sul sulla per con che non sono come più tra fra sei hai puoi questa questo quando dove cosa senza ogni'.split(' '));
const italianLines = text => text.split('\n').filter(line => looksItalian(line));
const looksItalian = text => { const words = text.toLowerCase().match(/[a-zà-ù']+/g) ?? []; const hits = words.filter(word => ITALIAN.has(word)).length; return words.length >= 3 && hits >= 2; };
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version: v, ...browser }) => {
  // the opening screen: Italian by default, the selector in view, English on request
  await viewport(390, 800, true);
  assert.equal(await evaluate(`document.documentElement.lang`), 'it', 'Italiano è la lingua predefinita.');
  const sw = await evaluate(`(() => { const box = document.querySelector('.menu-lang'); const r = box.getBoundingClientRect(); const b = [...box.querySelectorAll('button')].map(x => [x.textContent.trim(), x.getAttribute('aria-pressed'), Math.round(x.getBoundingClientRect().height)]); return { r: [r.left, r.right, r.top, r.bottom], b, w: innerWidth, over: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
  assert.deepEqual(sw.b.map(x => x.slice(0, 2)), [['Italiano', 'true'], ['English', 'false']], 'Il selettore Italiano / English è sulla schermata iniziale.');
  assert.ok(sw.r[0] >= 0 && sw.r[1] <= sw.w && sw.r[2] >= 0 && sw.r[3] <= 160 && sw.b.every(x => x[2] >= 40) && !sw.over, `Il selettore è visibile e toccabile (${JSON.stringify(sw)}).`);
  await createCareerInPage({ evaluate, version: v }, { weeks: 4 });
  await viewport(1280, 900, false);
  await goto(); await wait(() => evaluate('Boolean(document.querySelector(".main-menu"))'));
  const saves = () => evaluate(`JSON.stringify(Object.keys(localStorage).filter(k => /career|slot|save/i.test(k)).sort())`);
  const before = await saves();
  await evaluate(`document.querySelector('.menu-lang button[data-setting-value="en"]').click(); true`);
  await wait(() => evaluate(`document.documentElement.lang === 'en' && /New game/i.test(document.querySelector('.menu-new strong')?.textContent ?? '')`), 20000);
  assert.equal(await saves(), before, 'Cambiare lingua non crea né cancella salvataggi.');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('politicando.settings.v1')).language`), 'en', 'La scelta è salvata tra le preferenze.');
  assert.equal(await evaluate(`[...document.querySelectorAll('.menu-lang button')].map(b => b.getAttribute('aria-pressed')).join()`), 'false,true');
  assert.deepEqual(italianLines(await evaluate(`document.querySelector('.menu-column').innerText`)), [], 'La schermata iniziale è in inglese.');
  // persistence after a reload, before any render
  await goto(); await wait(() => evaluate('Boolean(document.querySelector(".main-menu"))'));
  assert.equal(await evaluate(`document.documentElement.lang`), 'en', 'Dopo il ricaricamento la lingua è ancora l’inglese.');
  assert.ok(/New game/i.test(await evaluate(`document.querySelector('.menu-new strong').textContent`)), 'E la prima schermata è già in inglese.');
  // the career: the same screen and the same data when the language changes
  await openCareer({ evaluate, goto, waitFor: wait });
  await pause(1500);
  await evaluate(`[...document.querySelectorAll('button')].filter(b => /^(Chiudi|Close)$/.test(b.textContent.trim()) && b.closest('aside,[role=dialog]')).forEach(b => b.click()); location.hash = '#finanze'; true`); await pause(900);
  await evaluate(`document.querySelector('details[data-remember="fin-investimenti"] > summary')?.click(); window.scrollTo(0, 240); true`); await pause(300);
  const snapshot = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${v}'); const s = store.getState(); return JSON.stringify({ week: s.game.week.index, date: s.clock.currentDate, funds: s.game.resources.funds, player: s.career.playerId, elections: s.game.elections.map(e => e.electionDate), page: s.ui.activePage }); })()`);
  const dataBefore = await snapshot();
  assert.deepEqual(italianLines(await evaluate(`document.querySelector('.page-wrap').innerText`)), [], 'Finanze è in inglese.');
  await evaluate(`(async () => { const { setLanguage } = await import('/src/core/i18n.js?v=${v}'); await setLanguage('it'); return true; })()`); await pause(900);
  assert.equal(await evaluate(`document.documentElement.lang`), 'it');
  assert.equal(await snapshot(), dataBefore, 'Passando all’italiano la carriera, la data e il calendario non cambiano.');
  assert.equal(await evaluate(`location.hash`), '#finanze', 'La schermata resta la stessa.');
  assert.equal(await evaluate(`document.querySelector('details[data-remember="fin-investimenti"]')?.open`), false, 'Le selezioni (la tendina chiusa dal giocatore) restano.');
  assert.ok(/Bilancio e andamento/.test(await evaluate(`document.querySelector('.page-wrap').innerText`)), 'Tornato l’italiano, i testi sono quelli di prima.');
  await evaluate(`(async () => { const { setLanguage } = await import('/src/core/i18n.js?v=${v}'); await setLanguage('en'); return true; })()`); await pause(900);
  assert.equal(await snapshot(), dataBefore, 'E di nuovo in inglese i dati sono gli stessi.');
  assert.ok(/Balance and trend/.test(await evaluate(`document.querySelector('.page-wrap').innerText`)), 'Finanze è in inglese.');
  assert.equal(await evaluate(`location.hash`), '#finanze');
  // advancing a week in English: nothing breaks, the calendar is the engine's
  await evaluate(`document.querySelector('[data-action="advance"]')?.click(); true`); await pause(1200);
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');

  // the main screens in English: how much Italian remains (a measure, with a limit)
  let nodes = 0, italian = [];
  await tourCareer({ evaluate, pause }, { pages: PAGES.filter(page => !['archivio', 'politici', 'partiti-lista'].includes(page)), onScreen: (name, texts) => { for (const text of texts) { nodes++; if (looksItalian(text)) italian.push(`${name}: ${text.slice(0, 90)}`); } } });
  const ratio = italian.length / nodes;
  console.log(`Inglese: ${nodes} testi su ${PAGES.length - 3} pagine e schede, ${italian.length} ancora in italiano (${(ratio * 100).toFixed(1)}%).`);
  assert.ok(ratio < 0.08, `Troppo italiano rimasto in inglese (${(ratio * 100).toFixed(1)}%): ${italian.slice(0, 8).join(' | ')}`);
  assert.deepEqual(errors, [], 'Nessun errore JavaScript durante il giro delle pagine.');
});
console.log('Lingua verificata: dizionario inglese ben formato (numeri e parti libere coerenti), selettore sulla schermata iniziale, scelta salvata fuori dai salvataggi e ritrovata dopo il ricaricamento, <html lang> aggiornato, stessa schermata e stessi dati cambiando lingua in una carriera, pagine principali in inglese con la quota di italiano residuo misurata.');
