// The logo of a new party: shape, symbol, initials and TWO colours. Part 1 (Node): the shapes and symbols (generic, distinct from each other), the main colour (`partyColor`, the fill) and the second colour
// (`partyLogoSecondaryColor`, kept in `party.logo.secondary`: outline, symbol and initials; gold by default), the picker with its visible value and the ready colours, the check of the value, the logo of the party
// created, exported and loaded again, the old logos (no second colour) still gold. Part 2 (Chrome): the wizard with real clicks — preview that follows every choice, the value shown, the career created with the same logo
// in the headquarters, still the same after a reload. Skipped without Chrome (part 1 still runs).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromeAvailable, withBrowser } from './lib/browser.mjs';

const realFetch = globalThis.fetch;
const { startCareer } = await import('./lib/long-run.mjs');
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const L = await import(`../src/ui/party-logo.js${v}`);
const { makeCareerDraft, renderCareerWizard, wizardLogoPreview } = await import(`../src/ui/career-wizard.js${v}`);
const { validateCareerStep } = await import(`../src/core/career-rules.js${v}`);
const lines = [];
const decode = url => decodeURIComponent(url.replace('data:image/svg+xml;charset=utf-8,', ''));

// ---------- 1. shapes and symbols ----------
const OLD_SHAPES = ['cerchio', 'scudo', 'quadrato', 'esagono', 'goccia'];
const OLD_SYMBOLS = ['freccia', 'onda', 'foglia', 'torre', 'ponte', 'ali', 'cerchi', 'spiga', 'libro', 'montagna', 'ingranaggio', 'cuore'];
assert.deepEqual(Object.keys(L.LOGO_SHAPES).slice(0, 5), OLD_SHAPES, 'Le forme di prima restano (e i loghi già creati restano uguali).');
assert.deepEqual(Object.keys(L.LOGO_SYMBOLS).slice(0, 12), OLD_SYMBOLS, 'I simboli di prima restano.');
const newShapes = Object.keys(L.LOGO_SHAPES).filter(id => !OLD_SHAPES.includes(id)), newSymbols = Object.keys(L.LOGO_SYMBOLS).filter(id => !OLD_SYMBOLS.includes(id));
assert.ok(newShapes.length >= 3 && newSymbols.length >= 5, `Almeno 3 forme e 5 simboli nuovi (${newShapes.length} forme, ${newSymbols.length} simboli).`);
assert.equal(new Set(Object.values(L.LOGO_SHAPES).map(item => item.path)).size, Object.keys(L.LOGO_SHAPES).length, 'Ogni forma ha un disegno diverso.');
assert.equal(new Set(Object.values(L.LOGO_SYMBOLS).map(item => item.path)).size, Object.keys(L.LOGO_SYMBOLS).length, 'Ogni simbolo ha un disegno diverso.');
assert.ok([...Object.values(L.LOGO_SHAPES), ...Object.values(L.LOGO_SYMBOLS)].every(item => item.label && item.path.length > 20), 'Ogni voce ha il suo nome.');
const svgOf = extra => L.partyLogoSvg({ shape: 'cerchio', symbol: 'freccia', primary: '#264d82', secondary: '#f2c14e', text: 'ABC', ...extra });
assert.equal(new Set(newShapes.concat(OLD_SHAPES).map(shape => svgOf({ shape }))).size, OLD_SHAPES.length + newShapes.length, 'Ogni forma cambia il logo.');
assert.equal(new Set(newSymbols.concat(OLD_SYMBOLS).map(symbol => svgOf({ symbol }))).size, OLD_SYMBOLS.length + newSymbols.length, 'Ogni simbolo cambia il logo.');
// generic marks: nothing that spells or reproduces the name or the emblem of a party (the ids and the names are plain words of design and everyday life)
const FORBIDDEN = /(fratelli|lega|forza|azione|movimento|stelle|\bpd\b|verdi|sinistra|partito democratico|sole delle alpi|ulivo|fiamma|falce|martello|garofano|edera|quercia|scudo crociato|croce)/i;
assert.ok(![...Object.entries(L.LOGO_SHAPES), ...Object.entries(L.LOGO_SYMBOLS)].some(([id, item]) => FORBIDDEN.test(id) || FORBIDDEN.test(item.label)), 'Nomi generici, non imitativi dei marchi dei partiti reali.');
lines.push(`forme (${Object.keys(L.LOGO_SHAPES).length}) e simboli (${Object.keys(L.LOGO_SYMBOLS).length}) distinti e generici`);

// ---------- 2. the two colours ----------
const logo = svgOf({ primary: '#112233', secondary: '#abcdef' });
assert.ok(logo.includes('fill="#112233"') && (logo.match(/#abcdef/g) ?? []).length >= 3, 'Colore principale come fondo; il secondo per contorno, simbolo e sigla.');
assert.ok(!logo.includes('#f2c14e'), 'Con un secondo colore scelto non resta oro da nessuna parte.');
for (const secondary of [undefined, null, '', 'oro', '#zzzzzz', '#fff']) assert.ok(L.partyLogoSvg({ primary: '#112233', secondary, text: 'X' }).includes('#f2c14e'), `Secondo colore «${secondary}»: oro (predefinito).`);
assert.equal(L.DEFAULT_LOGO_SECONDARY, '#f2c14e', 'L’oro resta il predefinito.');
assert.ok(L.LOGO_SECONDARY_PALETTE.length >= 8 && L.LOGO_SECONDARY_PALETTE.every(L.isLogoColor) && L.LOGO_SECONDARY_PALETTE.includes('#f2c14e') && new Set(L.LOGO_SECONDARY_PALETTE).size === L.LOGO_SECONDARY_PALETTE.length, 'Palette di colori predefiniti (con l’oro).');
const party = { id: 'p-prova', color: '#112233', abbreviation: 'PRV', logo: { kind: 'builder', shape: 'rombo', symbol: 'faro', secondary: '#abcdef' } };
const fromParty = decode(L.userPartyLogo(party));
assert.ok(fromParty.includes('fill="#112233"') && fromParty.includes('#abcdef') && fromParty.includes('PRV'), 'userPartyLogo: forma, sigla e due colori.');
assert.ok(fromParty.includes(L.LOGO_SHAPES.rombo.path) && fromParty.includes(L.LOGO_SYMBOLS.faro.path), 'E la forma e il simbolo scelti.');
const old = decode(L.userPartyLogo({ ...party, logo: { kind: 'builder', shape: 'scudo', symbol: 'ponte' } }));
assert.ok(old.includes('#f2c14e') && old.includes('fill="#112233"') && old.includes(L.LOGO_SHAPES.scudo.path), 'Un logo già creato (senza secondo colore) resta com’era: oro.');
assert.equal(L.userPartyLogo({ ...party, logo: null }), null);
lines.push('due colori nel disegno, oro predefinito, vecchi loghi invariati');

// ---------- 3. wizard rendering, check and store ----------
const run = await startCareer({ seed: 'logo', level: 'comunale' });
const { store, db } = run;
const territory = { units: db.territorialUnits, municipalities: db.municipalities };
const view = d => renderCareerWizard(store.getState(), { ...makeCareerDraft('2026-09-24'), step: 4, region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', partyMode: 'new', partyName: 'Prova', partyAbbreviation: 'PRV', partyDescription: 'x', ...d }, db.parties, () => null, db.parliamentaryGroups, [], [], db.politicians, territory);
const draft0 = makeCareerDraft('2026-09-24');
assert.equal(draft0.partyLogoSecondaryColor, '#f2c14e', 'Il nuovo partito parte con l’oro.');
const html = view({ partyLogoSecondaryColor: '#2a9d8f', partyColor: '#112233', partyLogoShape: 'ottagono', partyLogoSymbol: 'bussola' });
assert.ok(html.includes('name="partyLogoSecondaryColor"') && html.includes('type="color"') && html.includes('value="#2a9d8f"') && html.includes('data-logo-secondary-hex>#2a9d8f<'), 'Selettore del secondo colore con il valore esadecimale visibile.');
assert.equal((html.match(/data-logo-secondary="#/g) ?? []).length, L.LOGO_SECONDARY_PALETTE.length, 'La palette è sotto il selettore.');
assert.ok(/class="logo-swatch selected" data-logo-secondary="#2a9d8f" aria-pressed="true"/.test(html) && (html.match(/class="logo-swatch selected"/g) ?? []).length === 1, 'Il colore attivo è evidenziato.');
assert.ok(html.includes('name="partyColor"') && html.includes('Colore principale'), 'Il colore principale del partito resta il suo campo.');
for (const shape of Object.keys(L.LOGO_SHAPES)) assert.ok(html.includes(`<option value="${shape}"`), `Forma nell’elenco: ${shape}.`);
for (const symbol of Object.keys(L.LOGO_SYMBOLS)) assert.ok(html.includes(`<option value="${symbol}"`), `Simbolo nell’elenco: ${symbol}.`);
const preview = decode(wizardLogoPreview({ partyLogoMode: 'builder', partyLogoShape: 'ottagono', partyLogoSymbol: 'bussola', partyColor: '#112233', partyLogoSecondaryColor: '#2a9d8f', partyAbbreviation: 'prv' }));
assert.ok(preview.includes('fill="#112233"') && preview.includes('#2a9d8f') && !preview.includes('#f2c14e') && preview.includes('PRV') && preview.includes(L.LOGO_SHAPES.ottagono.path) && preview.includes(L.LOGO_SYMBOLS.bussola.path), 'L’anteprima usa forma, simbolo, sigla e i due colori.');
assert.ok(html.includes(encodeURIComponent('#2a9d8f')), 'E l’anteprima della pagina è quella.');
assert.ok(!view({ partyLogoMode: 'upload' }).includes('name="partyLogoSecondaryColor"'), 'Con un file caricato il secondo colore non serve.');
const base = { ...draft0, region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', firstName: 'Ada', lastName: 'Logo', birthDate: '1985-04-12', gender: 'donna', previousProfession: 'Insegnante', partyMode: 'new', partyName: 'Partito Prova', partyAbbreviation: 'prv', partyDescription: 'Un partito di prova', partyColor: '#112233', partyLogoShape: 'arco', partyLogoSymbol: 'chiave', partyLogoSecondaryColor: '#e63946' };
assert.deepEqual(validateCareerStep(base, 3, db.parties, db.parliamentaryGroups), [], 'Un partito con il secondo colore valido è valido.');
assert.ok(validateCareerStep({ ...base, partyLogoSecondaryColor: 'rosso' }, 3, db.parties, db.parliamentaryGroups).some(error => /secondo colore/.test(error)), 'Un secondo colore non valido è rifiutato.');
assert.deepEqual(validateCareerStep({ ...base, partyLogoSecondaryColor: undefined }, 3, db.parties, db.parliamentaryGroups), [], 'Senza secondo colore (bozza di prima) è valido: oro.');
const { storage } = await import(`../src/core/storage.js${v}`);
const free = () => { for (const slot of storage.listSlots()) { try { storage.deleteSlot(slot.id); } catch { /* stays */ } } };
const partyOf = state => state.dataset.parties.find(item => item.source === 'user' && item.id === state.dataset.politicians.find(person => person.id === state.career.playerId)?.partyId);
free(); store.createCareer(base, db.parties, db.parliamentaryGroups);
let mine = partyOf(store.getState());
assert.deepEqual(mine.logo, { kind: 'builder', shape: 'arco', symbol: 'chiave', secondary: '#e63946' }, 'Il secondo colore è salvato in party.logo.secondary, con forma e simbolo.');
assert.equal(mine.color, '#112233', 'partyColor resta il colore principale del partito.');
assert.equal(mine.abbreviation, 'PRV');
const shown = decode(L.userPartyLogo(mine));
assert.ok(shown.includes('fill="#112233"') && shown.includes('#e63946') && !shown.includes('#f2c14e') && shown.includes('PRV') && shown.includes(L.LOGO_SHAPES.arco.path) && shown.includes(L.LOGO_SYMBOLS.chiave.path), 'Dopo la creazione: forma, simbolo, sigla e due colori.');
const exported = store.exportSave();
free(); store.createCareer({ ...base, firstName: 'Altra', partyName: 'Altro Partito', partyLogoSecondaryColor: undefined }, db.parties, db.parliamentaryGroups);
assert.equal(partyOf(store.getState()).logo.secondary, '#f2c14e', 'Senza scelta il secondo colore è oro.');
assert.throws(() => store.createCareer({ ...base, firstName: 'Terza', partyName: 'Terzo Partito', partyLogoSecondaryColor: 'zzz' }, db.parties, db.parliamentaryGroups), /secondo colore/, 'Un valore non valido non entra nei dati: la creazione lo rifiuta.');
free(); store.loadGame(exported);
mine = partyOf(store.getState());
assert.deepEqual(mine.logo, { kind: 'builder', shape: 'arco', symbol: 'chiave', secondary: '#e63946' }, 'Dopo il caricamento della carriera il logo è lo stesso.');
assert.ok(decode(L.userPartyLogo(mine)).includes('#e63946') && decode(L.userPartyLogo(mine)).includes('fill="#112233"'), 'E si disegna con gli stessi due colori.');
// a career saved before the second colour: its logo is gold, nothing else changes
const file = JSON.parse(exported); const record = file.dataset.parties.find(item => item.id === mine.id); delete record.logo.secondary;
free(); store.loadGame(JSON.stringify(file));
const reloaded = partyOf(store.getState());
assert.deepEqual(reloaded.logo, { kind: 'builder', shape: 'arco', symbol: 'chiave' }, 'Una carriera di prima conserva il suo logo.');
assert.ok(decode(L.userPartyLogo(reloaded)).includes('#f2c14e') && reloaded.color === '#112233', 'Il suo secondo colore è oro, il principale è lo stesso.');
lines.push('selettore, valore e palette, controllo, salvataggio in party.logo.secondary, caricamento e vecchie carriere');

if (!chromeAvailable) { console.log(`Logo del partito verificato (senza Chrome): ${lines.join('; ')}.`); process.exit(0); }

// ---------- 4. Chrome ----------
globalThis.fetch = realFetch; // the harness of the engine answered in place of the network: Chrome and its server need the real one
await withBrowser(async browser => {
  const { evaluate, waitFor, pause, goto, errors } = browser;
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const click = async (selector, wait = 150) => { const ok = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`); assert.ok(ok, `manca ${selector}`); await pause(wait); };
  const setField = (selector, value, event = 'input') => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true })); return true; })()`);
  const next = () => click('.wizard-footer [data-wizard-action="next"]', 300);
  const previewSvg = () => evaluate(`decodeURIComponent((document.querySelector('[data-wizard-logo-preview] img')?.getAttribute('src') ?? '').replace('data:image/svg+xml;charset=utf-8,', ''))`);
  const hexShown = () => evaluate(`document.querySelector('[data-logo-secondary-hex]')?.textContent.trim()`);
  await evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })), true`);
  await goto(); await waitFor(() => has('[data-menu="nuova"]:not([disabled])'));
  await click('[data-menu="nuova"]:not([disabled])', 200); await waitFor(() => has('.career-wizard'));
  await setField('.career-wizard [name="firstName"]', 'Ada'); await setField('.career-wizard [name="lastName"]', 'Logo');
  await setField('.career-wizard [name="birthDate"]', '1985-04-12', 'change'); await setField('.career-wizard [name="previousProfession"]', 'Insegnante');
  await next();
  await setField('[data-wizard-region]', 'Toscana', 'change'); await waitFor(() => has('[data-wizard-municipality-search]'));
  await setField('[data-wizard-municipality-search]', 'Siena'); await waitFor(() => has('[data-municipality-code="052032"]'));
  await click('[data-municipality-code="052032"]', 250); await next(); await next();
  await click('[data-party-mode="new"]', 250); await waitFor(() => has('[name="partyName"]'));
  await setField('[name="partyName"]', 'Partito del Faro'); await setField('[name="partyAbbreviation"]', 'faro'); await setField('[name="partyDescription"]', 'Un partito di prova');
  // main colour, shape, symbol
  await setField('[name="partyColor"]', '#123456', 'input');
  // a select fires input and then change, as in a browser
  for (const [name, value] of [['partyLogoShape', 'rombo'], ['partyLogoSymbol', 'faro']]) { await setField(`[name="${name}"]`, value, 'input'); await setField(`[name="${name}"]`, value, 'change'); }
  assert.equal(await hexShown(), '#f2c14e', 'Il secondo colore parte dall’oro, e si vede.');
  let svg = await previewSvg();
  assert.ok(svg.includes('fill="#123456"') && svg.includes('#f2c14e') && svg.includes(L.LOGO_SHAPES.rombo.path) && svg.includes(L.LOGO_SYMBOLS.faro.path) && svg.includes('FARO'), 'Anteprima: forma, simbolo, sigla, principale e oro.');
  // a ready colour: value, picker, selection and preview follow at once
  await click('[data-logo-secondary="#2a9d8f"]', 250);
  assert.equal(await hexShown(), '#2a9d8f'); assert.equal(await evaluate(`document.querySelector('[name="partyLogoSecondaryColor"]').value`), '#2a9d8f');
  assert.equal(await evaluate(`document.querySelector('.logo-swatch.selected')?.dataset.logoSecondary`), '#2a9d8f', 'Il colore predefinito scelto è evidenziato.');
  svg = await previewSvg();
  assert.ok(svg.includes('#2a9d8f') && !svg.includes('#f2c14e') && svg.includes('fill="#123456"'), 'L’anteprima passa al secondo colore; il principale non cambia.');
  assert.equal(await evaluate(`document.querySelector('[name="partyName"]').value`), 'Partito del Faro', 'Gli altri campi restano.');
  // the picker with any colour
  await setField('[name="partyLogoSecondaryColor"]', '#8844cc', 'input');
  assert.equal(await hexShown(), '#8844cc', 'Il valore esadecimale segue il selettore.');
  assert.ok((await previewSvg()).includes('#8844cc'), 'E l’anteprima.');
  assert.equal(await evaluate(`document.querySelectorAll('.logo-swatch.selected').length`), 0, 'Un colore fuori palette non ne evidenzia nessuno.');
  // the colours are those of the wizard in every screen of it: back and forth keeps them, the summary names the party
  await next(); await next();
  assert.match(await evaluate(`document.querySelector('.summary-sheet').innerText`), /Partito del Faro/);
  await evaluate(`document.querySelector('[data-wizard-goto="4"]').click(), true`); await pause(300);
  assert.equal(await hexShown(), '#8844cc', 'Tornando al partito il secondo colore è rimasto.');
  const overflow = await evaluate(`(() => { const body = document.querySelector('.wizard-body'); return body.scrollWidth - body.clientWidth; })()`);
  assert.ok(overflow <= 1, 'Nessuno scroll orizzontale.');
  await next(); await next();
  await click('.wizard-footer [data-wizard-action="finish"]', 300);
  await waitFor(() => evaluate(`Boolean(document.querySelector('.page-wrap')) && !document.querySelector('.career-wizard')`), 40000);
  const created = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${browser.version}'); const s = store.getState(); const player = s.dataset.politicians.find(item => item.id === s.career.playerId); const party = s.dataset.parties.find(item => item.id === player.partyId); return JSON.stringify({ color: party.color, logo: party.logo, abbreviation: party.abbreviation }); })()`).then(JSON.parse);
  assert.deepEqual(created, { color: '#123456', logo: { kind: 'builder', shape: 'rombo', symbol: 'faro', secondary: '#8844cc' }, abbreviation: 'FARO' }, 'La carriera creata salva i due colori (party.color e party.logo.secondary).');
  const logos = () => evaluate(`[...document.querySelectorAll('img[src^="data:image/svg+xml"]')].map(img => decodeURIComponent(img.getAttribute('src').replace('data:image/svg+xml;charset=utf-8,', ''))).filter(svg => svg.includes('#8844cc'))`);
  await waitFor(async () => (await logos()).length > 0, 20000);
  assert.ok((await logos()).every(svg => svg.includes('fill="#123456"') && svg.includes('FARO') && svg.includes(L.LOGO_SHAPES.rombo.path)), 'Nella carriera il logo del partito si vede con forma, simbolo, sigla e i due colori.');
  await goto(); await waitFor(() => has('[data-menu="continua"]')); await click('[data-menu="continua"]', 300); await waitFor(() => has('.page-wrap'));
  await waitFor(async () => (await logos()).length > 0, 20000);
  assert.ok((await logos()).every(svg => svg.includes('fill="#123456"') && svg.includes('FARO')), 'Dopo il riavvio e il caricamento della carriera il logo è lo stesso.');
  assert.deepEqual(errors, [], 'Nessun errore in pagina.');
}, { language: 'it' });
console.log(`Logo del partito verificato: ${lines.join('; ')}; in Chrome il wizard (anteprima che segue forma, simbolo, principale e secondo colore, valore esadecimale e palette), la carriera creata e ricaricata con lo stesso logo.`);
process.exit(0);
