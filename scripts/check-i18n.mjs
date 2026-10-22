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
const books = [];
for (let n = 1; n <= 8; n++) books.push((await import(`../src/data/i18n/en-ui-${n}.js?v=${version}`)).PHRASES);
const { KEYS } = await import(`../src/data/i18n/keys.js?v=${version}`);
const all = books.flat();
assert.ok(books.length === 8 && all.length > 8000, `Il dizionario inglese ha ${all.length} voci.`);
const seen = new Map();
for (const [it, en] of all) {
  assert.ok(typeof it === 'string' && typeof en === 'string' && it.trim() && en.trim(), `Voce vuota o non testuale: ${JSON.stringify([it, en])}`);
  assert.equal(it.split('#').length, en.split('#').length, `Numeri (#) diversi: «${it}» → «${en}»`);
  // free parts: the Italian has n `{}`; the English has n parts too, plain `{}` or named by position `{1}`…`{n}` (never a position beyond n)
  const free = it.split('{}').length - 1;
  const named = [...en.matchAll(/\{(\d)\}/g)].map(match => Number(match[1])), plain = en.split('{}').length - 1;
  assert.equal(plain + named.length, free, `Parti libere ({}) diverse: «${it}» → «${en}»`);
  assert.ok(named.every(position => position >= 1 && position <= free), `Posizione fuori intervallo: «${it}» → «${en}»`);
  assert.ok(!/\bTODO\b|XXX/.test(en), `Segnaposto nella traduzione: ${en}`);
  const same = text => text.replace(/\{\d\}/g, '{}');
  assert.ok(!(seen.has(it) && same(seen.get(it)) !== same(en)), `Voce doppia con traduzioni diverse: «${it}» → «${seen.get(it)}» / «${en}»`);
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
const ITALIAN = new Set('il lo la le gli un una uno di del della dei delle al alla dal nel nella sul sulla per con che non sono come più tra fra sei hai puoi questa questo quando dove cosa senza ogni è già può così anche ancora prima dopo fino mai tutti tutte tutto nessuna nessun viene vengono resta restano tuo tua tuoi tue suo sua loro partita carriera salvataggio salvataggi copia definitivo definitiva azioni conferma scegli serve sono se ma'.split(' '));
const italianLines = text => text.split('\n').filter(line => looksItalian(line));
const looksItalian = text => { const words = text.toLowerCase().match(/[a-zà-ù']+/g) ?? []; const hits = words.filter(word => ITALIAN.has(word)).length; return words.length >= 3 && hits >= 2; };
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version: v, ...browser }) => {
  // the opening screen: Italian by default, the selector in view, English on request
  await viewport(390, 800, true);
  assert.equal(await evaluate(`document.documentElement.lang`), 'it', 'Italiano è la lingua predefinita.');
  const sw = await evaluate(`(() => { const box = document.querySelector('.menu-lang'); const r = box.getBoundingClientRect(); const b = [...box.querySelectorAll('button')].map(x => [(x.querySelector('.menu-lang-label')?.textContent ?? x.textContent).trim(), x.getAttribute('aria-pressed'), Math.round(x.getBoundingClientRect().height)]); return { r: [r.left, r.right, r.top, r.bottom], b, w: innerWidth, over: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
  assert.deepEqual(sw.b.map(x => x.slice(0, 2)), [['Italiano', 'true'], ['English', 'false']], 'Il selettore Italiano / English è sulla schermata iniziale.');
  assert.ok(await evaluate(`[...document.querySelectorAll('.menu-lang button')].map(b => b.querySelector('.menu-lang-flag')?.textContent).join('')`) === '🇮🇹🇬🇧' && await evaluate(`Boolean(document.querySelector('.menu-lang button.active .menu-lang-check'))`), 'Bandiere italiana e britannica, con la lingua attiva evidente.');
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
  let nodes = 0, italian = []; const tourTexts = [];
  await tourCareer({ evaluate, pause }, { pages: PAGES.filter(page => !['archivio', 'politici', 'partiti-lista'].includes(page)), onScreen: (name, texts) => { for (const text of texts) tourTexts.push([name, text]); } });
  // the pop-ups of the opening menu (Load game, Account, Settings, Logos, Guide, Hall of Fame) and the five steps of a new career, in English; proper names (parties, groups, movements) stay as they are
  const proper = await evaluate(`(async () => { const real = await import('/src/data/repositories/real-data.js?v=${v}'); await real.loadRealCollections(['parties', 'politicalMovements', 'coalitions', 'parliamentaryGroups', 'laws', 'politicians', 'offices']); const names = new Set(); for (const list of [real.realDatabase.parties, real.realDatabase.politicalMovements, real.realDatabase.coalitions, real.realDatabase.parliamentaryGroups, real.realDatabase.laws, real.realDatabase.politicians, real.realDatabase.offices]) for (const item of list ?? []) { for (const [key, value] of Object.entries(item)) if (/group|committee|commission|title|office/i.test(key) && typeof value === 'string' && value.length > 5 && value.length < 200) names.add(value); for (const key of ['officialName', 'name', 'abbreviation', 'label', 'title', 'shortTitle']) if (item[key] && item[key].length > 3) names.add(item[key]); if (list === real.realDatabase.parliamentaryGroups) for (const value of Object.values(item)) if (typeof value === 'string' && value.length > 5 && value.length < 160) names.add(value); } for (const masthead of ['La Gazzetta del Territorio', 'Il Meridiano', 'LA POLITICA 24', 'Gazzetta del Territorio']) names.add(masthead);
  // official denominations of parliamentary groups as the institutions publish them (they stay in Italian)
  for (const group of ["NOI MODERATI (NOI CON L'ITALIA, CORAGGIO ITALIA, UDC E ITALIA AL CENTRO)-MAIE-CENTRO POPOLARE", "Civici d'Italia-UDC-Noi Moderati (Noi con l'Italia, Coraggio Italia, Italia al Centro)-MAIE-Centro Popolare", 'Per le Autonomie (SVP-PATT, Campobase)']) names.add(group); return [...names].sort((a, b) => b.length - a.length); })()`);
  const fold = text => text.replace(/[’']/g, "'").toLowerCase();
  const properFolded = [...new Set(proper.map(fold))].sort((a, b) => b.length - a.length);
  const stripProper = text => { let out = fold(text); for (const name of properFolded) if (out.includes(name)) out = out.split(name).join(' '); return out; };
  for (const [name, text] of tourTexts) { nodes++; if (looksItalian(stripProper(text))) italian.push(`${name}: ${text.slice(0, 400)}`); }
  const screens = new Map();
  const record = async name => { for (const text of await evaluate(COLLECT)) { nodes++; if (looksItalian(stripProper(text))) italian.push(`${name}: ${text.slice(0, 400)}`); } screens.set(name, true); };
  await goto(); await wait(() => evaluate('Boolean(document.querySelector(".main-menu"))')); await pause(600);
  for (const view of ['guida', 'impostazioni', 'carica', 'hall', 'loghi', 'account']) {
    await evaluate(`document.querySelector('[data-menu="${view}"]')?.click(); true`); await pause(view === 'loghi' ? 1800 : 700);
    await evaluate(`document.querySelectorAll('.menu-popup details:not([open])').forEach(d => d.setAttribute('open', '')); true`);
    await record(`menu/${view}`);
    await evaluate(`document.querySelector('.menu-popup-foot [data-menu-close]')?.click(); true`); await pause(300);
  }
  await evaluate(`document.querySelector('[data-menu="account"]')?.click(); true`); await pause(500);
  for (const mode of ['register', 'recover']) { await evaluate(`document.querySelector('[data-account-mode="${mode}"]')?.click(); true`); await pause(400); await record(`menu/account-${mode}`); }
  await evaluate(`document.querySelector('.menu-popup-foot [data-menu-close]')?.click(); true`); await pause(300);
  await evaluate(`document.querySelector('[data-menu="nuova"]:not([disabled])').click(); true`); await wait(() => evaluate('Boolean(document.querySelector(".career-wizard"))')); await pause(600);
  const setField = (selector, value, event = 'input') => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true })); return true; })()`);
  const nextStep = async () => { await evaluate(`document.querySelector('.wizard-footer [data-wizard-action="next"]').click(); true`); await pause(500); };
  await record('wizard/1');
  await setField('.career-wizard [name="firstName"]', 'Prova'); await setField('.career-wizard [name="lastName"]', 'Lingua'); await setField('.career-wizard [name="birthDate"]', '1985-04-12', 'change');
  await setField('.career-wizard [name="professionChoice"]', 'altro', 'change'); await pause(300); await record('wizard/1-altro');
  await setField('.career-wizard [name="professionChoice"]', 'Insegnante', 'change'); await pause(300);
  await nextStep(); await wait(() => evaluate('Boolean(document.querySelector("[data-wizard-region]"))')); await record('wizard/2');
  await setField('[data-wizard-region]', 'Toscana', 'change'); await wait(() => evaluate('Boolean(document.querySelector("[data-wizard-municipality-search]"))'));
  await setField('[data-wizard-municipality-search]', 'Siena'); await wait(() => evaluate('Boolean(document.querySelector("[data-municipality-code=\\"052032\\"]"))'));
  await evaluate(`document.querySelector('[data-municipality-code="052032"]').click(); true`); await pause(300);
  await nextStep(); await record('wizard/3');
  await nextStep(); await record('wizard/4');
  await evaluate(`document.querySelectorAll('.career-wizard details:not([open])').forEach(d => d.setAttribute('open', '')); true`); await record('wizard/4-aperto');
  await nextStep(); await record('wizard/5');
  assert.ok(screens.size >= 14, `Popup e passaggi percorsi: ${screens.size}.`);
  if (process.env.I18N_LEFT) (await import('node:fs')).writeFileSync(process.env.I18N_LEFT, JSON.stringify(italian));
  const ratio = italian.length / nodes;
  console.log(`Inglese: ${nodes} testi su ${PAGES.length - 3} pagine e schede più ${screens.size} popup e passaggi, ${italian.length} ancora in italiano (${(ratio * 100).toFixed(2)}%)${italian.length ? `: ${italian.slice(0, 12).join(' | ')}` : ''}.`);
  assert.ok(ratio < 0.01, `Troppo italiano rimasto in inglese (${(ratio * 100).toFixed(1)}%): ${italian.slice(0, 8).join(' | ')}`);
  assert.deepEqual(errors, [], 'Nessun errore JavaScript durante il giro delle pagine.');
});
console.log('Lingua verificata: dizionario inglese ben formato (numeri e parti libere coerenti), selettore sulla schermata iniziale, scelta salvata fuori dai salvataggi e ritrovata dopo il ricaricamento, <html lang> aggiornato, stessa schermata e stessi dati cambiando lingua in una carriera, pagine principali in inglese con la quota di italiano residuo misurata.');
