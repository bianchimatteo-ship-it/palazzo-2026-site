// Italiano / English. Part 1 (Node): the phrase book — pairs well formed, no duplicates that disagree, the same numbers (`#`) and free parts (`{}`) on both sides, numbers/currency/dates in the
// English form, templates that never match a long text, the stable keys. Part 2 (Chrome): the selector on the opening screen, the choice kept after a reload and independent of the saves,
// `<html lang>`, the same screen and the same data after switching language in a career (nothing created, reset or moved), the main screens in English with the Italian that remains measured.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { COLLECT, PAGES, tourCareer } from './lib/i18n-tour.mjs';
import { ALLOWED_ITALIAN, ENGLISH_LOANWORDS } from './lib/i18n-allowlist.mjs';
import { partsOf } from './lib/i18n-pair.mjs';

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
  // free parts (`{}`) and numbers (`#`) together: the English names every part by its position (numbers count), see scripts/lib/i18n-pair.mjs; otherwise numbers and free parts are counted apart
  const free = it.split('{}').length - 1, total = partsOf(it);
  const named = [...en.matchAll(/\{(\d)\}/g)].map(match => Number(match[1])), plain = en.split('{}').length - 1;
  if (free > 0 && total > free && named.length > 0) {
    const freeAt = [...it.matchAll(/\{\}|#/g)].map((match, index) => match[0] === '{}' ? index + 1 : null).filter(Boolean);
    assert.ok(freeAt.every(position => named.includes(position)), `Parte libera non nominata (posizioni: ${freeAt}): «${it}» → «${en}»`);
    assert.ok(named.every(position => position >= 1 && position <= total) && !/\{\}|#/.test(en), `Posizioni da usare da sole quando ci sono parti libere e numeri: «${it}» → «${en}»`);
  } else {
    assert.equal(it.split('#').length, en.split('#').length, `Numeri (#) diversi: «${it}» → «${en}»`);
    assert.equal(plain + named.length, free, `Parti libere ({}) diverse: «${it}» → «${en}»`);
    assert.ok(named.every(position => position >= 1 && position <= free), `Posizione fuori intervallo: «${it}» → «${en}»`);
  }
  assert.ok(!/\bTODO\b|XXX/.test(en), `Segnaposto nella traduzione: ${en}`);
  const same = text => text.replace(/\{\d\}/g, '{}');
  assert.ok(!(seen.has(it) && same(seen.get(it)) !== same(en)), `Voce doppia con traduzioni diverse: «${it}» → «${seen.get(it)}» / «${en}»`);
  seen.set(it, en);
}
assert.ok(Object.keys(KEYS).includes('language.label') && KEYS['language.hint'], 'Le chiavi stabili della lingua ci sono.');
{
  // every stable key used in the code has its English text, and every key of the dictionary is used (nothing orphaned)
  const { readdir } = await import('node:fs/promises');
  const used = new Set();
  for (const folder of ['ui', 'core']) for (const file of (await readdir(new URL(`../src/${folder}/`, import.meta.url))).filter(name => name.endsWith('.js'))) {
    const text = (await readFile(new URL(`../src/${folder}/${file}`, import.meta.url), 'utf8')).replace(/^\s*\/\/.*$/gm, '');
    for (const match of text.matchAll(/\bt\('([a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+)',/g)) used.add(match[1]);
  }
  for (const key of used) assert.ok(KEYS[key], `La chiave «${key}» è usata nel codice ma non ha il testo inglese in keys.js.`);
  for (const key of Object.keys(KEYS)) assert.ok(used.has(key) || key.startsWith('language.'), `La chiave «${key}» è in keys.js ma nessun codice la usa.`);
}
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
// ---- the engine: a translation is complete only when nothing Italian is left in it ----
{
  // the straight and the curly apostrophe are the same letter, and a closing mark does not make another phrase
  assert.equal(T('L\'accordo non regge più.'), T('L’accordo non regge più.'), 'L’apostrofo dritto e quello curvo sono la stessa lettera.');
  assert.notEqual(T('L’accordo non regge più.'), 'L’accordo non regge più.');
  assert.equal(T('Nuova partita.'), `${T('Nuova partita')}.`, 'Un punto in più non è un’altra frase.');
  assert.equal(T('Nuova partita…'), `${T('Nuova partita')}…`);
  // a sentence of the book with a long name inside is still a template (no limit at 360 characters)
  const longName = 'Associazione per la tutela e la promozione dei diritti dei cittadini del comune e dei territori limitrofi di montagna';
  const frame = 'Quest’anno non hai un voto tuo, ma il {}, {} si misura nei comuni al voto. Puoi anche candidarti tu, in un comune della tua regione che vota quel giorno (Elezioni → Candidatura): la campagna la giochi. Chi fa campagna per i candidati si fa vedere e se ne prende il merito; chi resta fuori non rischia nulla se va male, ma se va bene resta a guardare.';
  assert.ok(frame.replace('{}', longName).replace('{}', 'ottobre').length > 360);
  assert.match(T(frame.replace('{}', longName).replace('{}', 'ottobre')), /^This year you have no vote of your own/, 'Una frase lunga con un nome lungo si traduce comunque.');
  // what is Italian in a text that merely changed: found, with the word
  assert.equal(I.residualItalian('Programme: fino a quattro priorità'), 'fino');
  assert.equal(I.residualItalian('Siena\'s post goes round the web'), null, 'Un nome a metà frase non conta.');
  assert.equal(I.residualItalian('Il governo is falling'), 'il', 'Un articolo italiano basta.');
  assert.equal(I.residualItalian('Open the profile of Azione'), null);
  // a partial translation goes to the automatic translator as a WHOLE text, not as a text that "changed"
  const asked = [];
  I.setAutoTranslator({ lookup: () => undefined, request: text => asked.push(text), status: () => ({}) });
  const partial = T('Programma: fino a nove temi nuovi per la settimana');
  assert.ok(asked.includes('Programma: fino a nove temi nuovi per la settimana'), `Il testo tradotto a metà viene chiesto per intero (${JSON.stringify(asked)}).`);
  asked.length = 0;
  T('Nuova partita');
  assert.deepEqual(asked, [], 'Un testo tradotto per intero non si chiede.');
  I.setAutoTranslator({ lookup: text => text === 'Programma: fino a nove temi nuovi per la settimana' ? 'Programme: up to nine new topics for the week' : undefined, request: () => {}, status: () => ({}) });
  assert.equal(T('Programma: fino a nove temi nuovi per la settimana'), 'Programme: up to nine new topics for the week', 'La traduzione completa sostituisce quella a metà.');
  I.setAutoTranslator(null);
  assert.ok(partial.includes('Programme') || partial.includes('PROGRAMME'), 'Senza traduttore, ciò che è noto resta tradotto.');
}
assert.equal(T('Z'.repeat(5000)), 'Z'.repeat(5000), 'Un testo lungo non passa dai confronti costosi.');
const t0 = Date.now(); for (let i = 0; i < 2000; i++) T(`Un testo qualunque ${i} che non ha corrispondenze, con ${i} numeri e (parentesi) · e altro: ancora`); assert.ok(Date.now() - t0 < 3000, `La ricerca è rapida (${Date.now() - t0} ms).`);
assert.equal(I.t('language.label', 'Lingua'), 'Language');
assert.equal(I.t('chiave.inesistente', 'Testo {n}', { n: 3 }), 'Testo 3', 'Una chiave mancante ricade sull’italiano.');
await I.setLanguage('it');
assert.equal(T('Nuova partita'), 'Nuova partita', 'In italiano nulla cambia.');
assert.equal(I.t('language.label', 'Lingua'), 'Lingua');
assert.equal(JSON.parse(mem.get('politicando.settings.v1')).language, 'it', 'La scelta è salvata tra le preferenze, non in un salvataggio.');

// ---------- 2. in a real browser ----------
if (!chromeAvailable) { console.log('Lingua nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).'); process.exit(0); }
const ITALIAN = new Set('il lo la le gli un una uno di del della dei delle al alla dal nel nella sul sulla per con che non sono come più tra fra sei hai puoi questa questo quando dove cosa senza ogni è già può così anche ancora prima dopo fino mai tutti tutte tutto nessuna nessun viene vengono resta restano tuo tua tuoi tue suo sua loro partita carriera salvataggio salvataggi copia definitivo definitiva azioni conferma scegli serve sono se ma'.split(' '));
// A text of the screen that is EXACTLY an Italian phrase of the book (whatever its length, a one-word label included) is a translation that did not reach the screen: it is flagged even where the text is too short for the
// word-count test. Proper names and official denominations are in the book with the same text on both sides, so they never count.
// Intentional Italian: the title of an official act of Parliament that is not in the book (it stays whole, as published), a title in «quotes» (the name of a law or of a story, a proper name) and the
// month abbreviation «Mar», which is the same word in English.
const intentionalItalian = text => /^(Conversione in legge|Ratifica ed esecuzione|Modifiche al|Disposizioni|Istituzione)/.test(text.trim()) || /^«[^»]+»(?::|$)/.test(text.trim()) || text.trim() === 'Mar';
// The words that are Italian and nothing else: every word of the Italian side of the phrase book that never appears in an English text of the book. A text of the English interface that contains one of them is Italian that did not
// get translated, whatever its length (a one-word label, a button, a tooltip, a short heading); proper names and official denominations are in the book with the same text on both sides, so their words are not in this set.
const wordsOf = text => text.toLowerCase().replace(/#|\{\d?\}/g, ' ').match(/[a-zà-ù]{3,}/g) ?? [];
const italianWords = new Set(), englishWords = new Set();
for (const [it, en] of all) { for (const word of wordsOf(it)) italianWords.add(word); for (const word of wordsOf(en)) englishWords.add(word); }
const italianOnly = new Set([...italianWords].filter(word => !englishWords.has(word) && !ENGLISH_LOANWORDS.has(word)));
const allowedItalian = text => ALLOWED_ITALIAN.find(item => item.pattern.test(text.trim()))?.reason ?? null;
const englishSides = new Set(all.map(([, en]) => en.replace(/\{\d\}/g, '{}')));
// (a word that is both an Italian phrase of the book and an English one — «Province» — is not untranslated Italian)
const knownUntranslated = text => { const core = text.replace(/\s+/g, ' ').trim(); return !englishSides.has(core) && seen.has(core) && seen.get(core).replace(/\{\d\}/g, '{}') !== core && !/[{#]/.test(core); };
const italianLines = text => text.split('\n').filter(line => looksItalian(line));
const looksItalian = text => { const words = text.toLowerCase().match(/[a-zà-ù']+/g) ?? []; const hits = words.filter(word => ITALIAN.has(word)).length; return words.length >= 3 && hits >= 2; };
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version: v, ...browser }) => {
  // the opening screen: Italian by default, the selector in view, English on request
  await viewport(390, 800, true);
  assert.equal(await evaluate(`document.documentElement.lang`), 'it', 'Italiano è la lingua predefinita.');
  // a first installation starts with the choice of the language (both languages, two buttons); Italian is chosen here and the selector stays on the menu
  assert.ok(await evaluate(`Boolean(document.querySelector('.language-gate [data-language-choice="it"]')) && Boolean(document.querySelector('.language-gate [data-language-choice="en"]'))`), 'La prima schermata è la scelta della lingua.');
  await evaluate(`document.querySelector('.language-gate [data-language-choice="it"]').click(); true`); await wait(() => evaluate('Boolean(document.querySelector(".main-menu .menu-lang"))'));
  const sw = await evaluate(`(() => { const box = document.querySelector('.menu-lang'); const r = box.getBoundingClientRect(); const b = [...box.querySelectorAll('button')].map(x => [(x.querySelector('.menu-lang-label')?.textContent ?? x.textContent).trim(), x.getAttribute('aria-pressed'), Math.round(x.getBoundingClientRect().height)]); return { r: [r.left, r.right, r.top, r.bottom], b, w: innerWidth, over: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
  assert.deepEqual(sw.b.map(x => x.slice(0, 2)), [['Italiano', 'true'], ['English', 'false']], 'Il selettore Italiano / English è sulla schermata iniziale.');
  assert.ok(await evaluate(`[...document.querySelectorAll('.menu-lang button')].map(b => b.querySelector('.menu-lang-flag')?.textContent).join('')`) === '🇮🇹🇬🇧' && await evaluate(`Boolean(document.querySelector('.menu-lang button.active .menu-lang-check'))`), 'Bandiere italiana e britannica, con la lingua attiva evidente.');
  assert.ok(sw.r[0] >= 0 && sw.r[1] <= sw.w && sw.r[2] >= 0 && sw.r[3] <= 160 && sw.b.every(x => x[2] >= 40) && !sw.over, `Il selettore è visibile e toccabile (${JSON.stringify(sw)}).`);
  await createCareerInPage({ evaluate, version: v }, { weeks: 4, name: ['Anna', 'Bianchi'] });
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

  // what the player writes is never translated; the interface's attributes on the same fields are (TEXTAREA and its placeholder, title, accessible name; an input; an editable element)
  {
    const probe = await evaluate(`(async () => {
      const { translateTree } = await import('/src/core/i18n.js?v=${v}');
      const box = document.createElement('div');
      box.innerHTML = '<textarea id="p-area" placeholder="Cerca un partito" title="Chiudi" aria-label="Nuova partita">Nuova partita</textarea><input id="p-input" placeholder="Cerca un partito" value="Chiudi" /><div id="p-edit" contenteditable="true" title="Chiudi">Nuova partita</div><img id="p-img" alt="Nuova partita" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" /><button id="p-button" data-voice-idle="Ascolta il notiziario" data-voice-active="Ferma il notiziario">Chiudi</button><input id="p-submit" type="submit" value="Chiudi" />';
      document.body.append(box);
      translateTree(box);
      const get = id => document.getElementById(id);
      const out = { areaText: get('p-area').value, areaPlaceholder: get('p-area').placeholder, areaTitle: get('p-area').title, areaLabel: get('p-area').getAttribute('aria-label'), inputValue: get('p-input').value, inputPlaceholder: get('p-input').placeholder, editText: get('p-edit').textContent, editTitle: get('p-edit').title, alt: get('p-img').alt, idle: get('p-button').dataset.voiceIdle, active: get('p-button').dataset.voiceActive, button: get('p-button').textContent, submit: get('p-submit').value };
      box.remove();
      return out;
    })()`);
    assert.equal(probe.areaText, 'Nuova partita', 'Il testo scritto dal giocatore in una TEXTAREA non si traduce.');
    assert.equal(probe.inputValue, 'Chiudi', 'Né il valore di un campo.'); assert.equal(probe.editText, 'Nuova partita', 'Né un elemento modificabile.');
    assert.notEqual(probe.areaPlaceholder, 'Cerca un partito', `Il placeholder di una TEXTAREA si traduce (${probe.areaPlaceholder}).`);
    assert.ok(probe.areaTitle !== 'Chiudi' && probe.areaLabel !== 'Nuova partita', `Titolo e nome accessibile della TEXTAREA si traducono (${probe.areaTitle} / ${probe.areaLabel}).`);
    assert.notEqual(probe.inputPlaceholder, 'Cerca un partito'); assert.notEqual(probe.editTitle, 'Chiudi'); assert.notEqual(probe.alt, 'Nuova partita', 'L’alt delle immagini si traduce.');
    assert.ok(probe.idle !== 'Ascolta il notiziario' && probe.active !== 'Ferma il notiziario', `I testi che un comando scambia mentre lavora si traducono (${probe.idle} / ${probe.active}).`);
    assert.equal(probe.button, 'Close'); assert.equal(probe.submit, 'Close', 'I pulsanti di invio si traducono.');
  }
  // the main screens in English: how much Italian remains (a measure, with a limit)
  let nodes = 0, italian = []; const tourTexts = []; const reasons = new Map();
  await tourCareer({ evaluate, pause }, { pages: PAGES.filter(page => !['archivio', 'politici', 'partiti-lista'].includes(page)), onScreen: (name, texts) => { for (const text of texts) tourTexts.push([name, text]); } });
  // the pop-ups of the opening menu (Load game, Account, Settings, Logos, Guide, Hall of Fame) and the five steps of a new career, in English; proper names (parties, groups, movements) stay as they are
  const proper = await evaluate(`(async () => { const real = await import('/src/data/repositories/real-data.js?v=${v}'); await real.loadRealCollections(['parties', 'politicalMovements', 'coalitions', 'parliamentaryGroups', 'laws', 'politicians', 'offices', 'territorialUnits', 'municipalities', 'committees', 'politicalFigures']); const names = new Set(); { const geo = await (await fetch('/src/data/real/electoral-geography.json')).json(); for (const chamber of ['camera', 'senato']) for (const district of geo?.[chamber]?.collegi ?? []) { if (district.name) names.add(district.name); if (district.region) names.add(district.region); } for (const list of [geo?.camera?.circoscrizioni, geo?.senato?.circoscrizioni, geo?.camera?.estero, geo?.senato?.estero]) for (const item of list ?? []) { if (item.name) names.add(item.name); if (item.region) names.add(item.region); } for (const item of [...(real.realDatabase.territorialUnits ?? []), ...(real.realDatabase.municipalities ?? []), ...(real.realDatabase.committees ?? [])]) for (const key of ['name', 'region', 'gameRegion', 'label', 'officialName']) if (typeof item[key] === 'string' && item[key].length > 3) names.add(item[key]); } for (const list of [real.realDatabase.parties, real.realDatabase.politicalMovements, real.realDatabase.coalitions, real.realDatabase.parliamentaryGroups, real.realDatabase.laws, real.realDatabase.politicians, real.realDatabase.offices, real.realDatabase.politicalFigures]) for (const item of list ?? []) { for (const [key, value] of Object.entries(item)) if (/group|committee|commission|title|office/i.test(key) && typeof value === 'string' && value.length > 5 && value.length < 200) names.add(value); for (const key of ['officialName', 'name', 'abbreviation', 'label', 'title', 'shortTitle', 'fullName', 'displayName', 'firstName', 'lastName']) if (item[key] && item[key].length > 3) names.add(item[key]); if (list === real.realDatabase.parliamentaryGroups) for (const value of Object.values(item)) if (typeof value === 'string' && value.length > 5 && value.length < 160) names.add(value); } for (const masthead of ['La Gazzetta del Territorio', 'Il Meridiano', 'LA POLITICA 24', 'Gazzetta del Territorio']) names.add(masthead);
  // official denominations of parliamentary groups as the institutions publish them (they stay in Italian)
  for (const group of ["NOI MODERATI (NOI CON L'ITALIA, CORAGGIO ITALIA, UDC E ITALIA AL CENTRO)-MAIE-CENTRO POPOLARE", "Civici d'Italia-UDC-Noi Moderati (Noi con l'Italia, Coraggio Italia, Italia al Centro)-MAIE-Centro Popolare", 'Per le Autonomie (SVP-PATT, Campobase)', 'Per le Autonomie (SVP-PATT, Camp…']) names.add(group); return [...names].sort((a, b) => b.length - a.length); })()`);
  const fold = text => text.replace(/[’']/g, "'").toLowerCase();
  const properFolded = [...new Set(proper.map(fold))].sort((a, b) => b.length - a.length);
  // a proper name is removed as a whole name, never from inside a word (the «nomic» of a name would otherwise eat «economic»)
  const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stripProper = text => { let out = fold(text); for (const name of properFolded) if (out.includes(name)) out = out.replace(new RegExp(`(^|[^a-zà-ù0-9])${escapeRe(name)}(?![a-zà-ù0-9])`, 'g'), '$1 '); return out; };
  // why a text counts as Italian (kept in the report, so that a false alarm is easy to tell from a missing translation)
  const reasonOf = text => {
    if (intentionalItalian(text) || allowedItalian(text)) return null;
    const bare = stripProper(text);
    if (knownUntranslated(text)) return 'è una voce del dizionario rimasta in italiano';
    const word = wordsOf(bare).find(item => italianOnly.has(item));
    if (word) return `parola solo italiana: «${word}»`;
    if (looksItalian(bare)) return 'parole grammaticali italiane';
    return null;
  };
  const untranslated = text => reasonOf(text) !== null;
  for (const [name, text] of tourTexts) { nodes++; if (untranslated(text)) italian.push(`${name}: ${text.slice(0, 400)}`) && reasons.set(text, reasonOf(text)); }
  const screens = new Map();
  const record = async name => { for (const text of await evaluate(COLLECT)) { nodes++; if (untranslated(text)) italian.push(`${name}: ${text.slice(0, 400)}`) && reasons.set(text, reasonOf(text)); } screens.set(name, true); };
  // the tooltip of a chart is appended to the body (outside the container the interface redraws) and written to while the pointer moves: it is English too, numbers included
  await evaluate(`location.hash = '#sondaggi'; true`); await pause(1200);
  for (const [index, ratio] of [[0, 0.25], [1, 0.7]]) {
    const tip = await evaluate(`(async () => { const chart = document.querySelectorAll('[data-trend]')[${index}]; if (!chart) return null; chart.scrollIntoView({ block: 'center' }); await new Promise(resolve => setTimeout(resolve, 400)); const r = chart.getBoundingClientRect(); chart.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + r.width * ${ratio}, clientY: r.top + r.height / 2 })); await new Promise(resolve => setTimeout(resolve, 120)); const el = document.querySelector('.viz-tip'); return el && !el.hidden ? el.innerText : ''; })()`);
    if (tip === null) continue;
    assert.ok(tip.length > 3, `Il tooltip del grafico ${index + 1} compare (${JSON.stringify(tip)}).`);
    const bad = tip.split('\n').filter(Boolean).filter(line => { nodes++; return reasonOf(line) !== null || /\d,\d/.test(line); });
    assert.deepEqual(bad, [], `Il tooltip del grafico ${index + 1} è in inglese, con i numeri in forma inglese (${JSON.stringify(tip)}).`);
    screens.set(`tooltip/${index}`, true);
  }
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
  await setField('.career-wizard [name="firstName"]', 'Anna'); await setField('.career-wizard [name="lastName"]', 'Bianchi'); await setField('.career-wizard [name="birthDate"]', '1985-04-12', 'change');
  await setField('.career-wizard [name="professionChoice"]', 'altro', 'change'); await pause(300); await record('wizard/1-altro');
  await setField('.career-wizard [name="professionChoice"]', 'Insegnante', 'change'); await pause(300);
  await nextStep(); await wait(() => evaluate('Boolean(document.querySelector("[data-wizard-region]"))')); await record('wizard/2');
  await setField('[data-wizard-region]', 'Toscana', 'change'); await wait(() => evaluate('Boolean(document.querySelector("[data-wizard-municipality-search]"))'));
  await setField('[data-wizard-municipality-search]', 'Siena'); await wait(() => evaluate('Boolean(document.querySelector("[data-municipality-code=\\"052032\\"]"))'));
  await evaluate(`document.querySelector('[data-municipality-code="052032"]').click(); true`); await pause(300);
  // 3 career path, 4 party, 5 advanced settings (and the starting conditions, opened), 6 summary
  await nextStep(); await record('wizard/3');
  await evaluate(`document.querySelector('[data-starting-office="presidenteConsiglio"]').click(); true`); await pause(300); await record('wizard/3-pdc');
  await evaluate(`document.querySelector('[data-level="comunale"]').click(); true`); await pause(300);
  await nextStep(); await record('wizard/4');
  await nextStep(); await record('wizard/5');
  await evaluate(`document.querySelectorAll('.career-wizard details:not([open])').forEach(d => d.setAttribute('open', '')); true`); await record('wizard/5-aperto');
  await nextStep(); await record('wizard/6');
  assert.ok(screens.size >= 14, `Popup e passaggi percorsi: ${screens.size}.`);
  if (process.env.I18N_LEFT) (await import('node:fs')).writeFileSync(process.env.I18N_LEFT, JSON.stringify(italian));
  // the extraction for development (scripts/i18n-extract.mjs): the distinct Italian texts the English screens still show, numbers brought to `#`, with the screens that show them
  if (process.env.I18N_EXTRACT) {
    const distinct = new Map();
    for (const entry of italian) { const at = entry.indexOf(': '); const screen = entry.slice(0, at), text = entry.slice(at + 2); const key = text.replace(/\d[\d.,]*/g, '#'); const item = distinct.get(key) ?? { text: key, example: text, screens: [] }; if (!item.screens.includes(screen)) item.screens.push(screen); distinct.set(key, item); }
    (await import('node:fs')).writeFileSync(process.env.I18N_EXTRACT, JSON.stringify([...distinct.values()].sort((a, b) => a.text.localeCompare(b.text)), null, 1));
  }
  const ratio = italian.length / nodes;
  if (process.env.I18N_WHY) for (const [text, why] of reasons) console.log(`  [${why}] ${text.slice(0, 160)}`);
  console.log(`Inglese: ${nodes} testi su ${PAGES.length - 3} pagine e schede più ${screens.size} popup e passaggi, ${italian.length} ancora in italiano (${(ratio * 100).toFixed(2)}%)${italian.length ? `: ${italian.slice(0, 12).join(' | ')}` : ''}.`);
  if (!process.env.I18N_MEASURE) assert.equal(italian.length, 0, `Testi italiani non autorizzati nell’inglese (${italian.length}): ${italian.slice(0, 12).join(' | ')}`);
  assert.deepEqual(errors, [], 'Nessun errore JavaScript durante il giro delle pagine.');
});
console.log('Lingua verificata: dizionario inglese ben formato (numeri e parti libere coerenti), selettore sulla schermata iniziale, scelta salvata fuori dai salvataggi e ritrovata dopo il ricaricamento, <html lang> aggiornato, stessa schermata e stessi dati cambiando lingua in una carriera, pagine, popup, procedura guidata e tooltip dei grafici in inglese senza alcun testo italiano non autorizzato (lessico italiano, parole singole ed etichette brevi comprese), chiavi stabili tutte usate e tutte tradotte.');
