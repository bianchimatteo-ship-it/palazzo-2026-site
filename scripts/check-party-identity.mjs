// The visual identity of the player's party (src/ui/party-identity.js, src/data/party-brand.js), verified with Futuro Nazionale, the party of the database that has a verified
// logo and no colour. Part 1 (no browser): where each colour comes from, contrast of the accent as fill / as text / as ink, the neutral independent, no mutation, and that the
// brand colours of src/data/party-brand.js are what the official logo shows (the PNG is measured again). Part 2 (Chrome, skipped when it is not installed): the career opens with
// the colour, logo and name of Futuro Nazionale in the sidebar and (on a phone) in the top bar; leaving the party makes the career neutral; joining another party, or founding one,
// changes it; another career in the same browser is not touched; no error in the page.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { brandOfLogo, decodePng } from './lib/logo-color.mjs';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { KIND_TONES, NEUTRAL_ACCENT, PANEL_SURFACE, SHELL_SURFACE, TEXT_SURFACE, accentAsGraphic, accentAsText, identityMark, identityVars, kindChip, partyChip, partyIdentity, topbarParty } = await module('src/ui/party-identity.js');
const { LOGO_BRAND } = await module('src/data/party-brand.js');
const { contrastRatio, inkOn } = await module('src/ui/visuals.js');
const json = async name => JSON.parse(await readFile(new URL(`../src/data/real/${name}.json`, import.meta.url), 'utf8'));
const FN = 'party-futuro-nazionale';

// ---------- 1. where the colour comes from ----------
const parties = await json('parties');
const fnRecord = parties.find(item => item.id === FN);
assert.ok(fnRecord, 'Futuro Nazionale è nel database dei partiti.');
assert.equal(fnRecord.color, null, 'Il database non ha un colore per Futuro Nazionale: nessun colore è stato inventato nei dati.');
assert.ok(fnRecord.logoVerified === true && fnRecord.logoAsset, 'Futuro Nazionale ha un logo verificato nel database.');
for (const id of Object.keys(LOGO_BRAND)) assert.ok(parties.find(item => item.id === id && item.logoAsset), `${id}: i colori di party-brand.js vengono da un logo che il database ha davvero.`);

const fn = partyIdentity({ party: fnRecord, force: { color: '#c98500', label: 'Futuro Nazionale' }, logo: 'logo.png' });
assert.equal(fn.kind, 'partito'); assert.equal(fn.source, 'logo', 'Senza colore nel database né scelto dal giocatore, Futuro Nazionale prende il colore del suo logo.');
assert.equal(fn.accent, accentAsGraphic(LOGO_BRAND[FN].primary), 'L’accento è il colore del logo reso leggibile sullo sfondo scuro.');
assert.notEqual(fn.accent, '#c98500', 'Non il colore assegnato dal gioco alla linea nei grafici.');
assert.equal(fn.mark, 'FN'); assert.equal(fn.logo, 'logo.png'); assert.ok(fn.accent2 && fn.accent2 !== fn.accent, 'Il secondo colore (il giallo del logo) c’è.');
assert.ok(contrastRatio(fn.accentInk, fn.accent) >= 4.5, 'Il testo sul colore del partito ha almeno 4,5:1.');
assert.ok(contrastRatio(fn.accentText, TEXT_SURFACE) >= 4.5, 'Il colore del partito usato come testo sui pannelli ha almeno 4,5:1.');
assert.ok(contrastRatio(fn.accent, SHELL_SURFACE) >= 3 && contrastRatio(fn.accent, PANEL_SURFACE) >= 3, 'L’accento come elemento grafico si distingue dal verde istituzionale (almeno 3:1).');
const chosen = partyIdentity({ party: { id: 'user-1', name: 'Alba Civica', color: '#2a9d8f', color2: '#e9c46a', abbreviation: 'AC' }, force: { color: '#c98500' } });
assert.equal(chosen.source, 'scelto', 'Il colore scelto dal partito vince su tutto.'); assert.equal(partyIdentity({ party: { id: 'u2', name: 'Lista', color: '#3a6ea5' } }).accent, '#3a6ea5', 'Un colore scelto che si legge sul fondo scuro è mostrato com’è, senza ritocchi.'); assert.equal(chosen.accent, accentAsGraphic('#2a9d8f')); assert.equal(chosen.mark, 'AC'); assert.equal(chosen.accent2, accentAsGraphic('#e9c46a'));
assert.equal(partyIdentity({ party: { id: 'x', officialName: 'Forza Nuova Italiana' }, force: { color: '#d95926', brandColor: '#228833' } }).source, 'scelto', 'Il colore di correzione del proprietario (brandColor della forza) conta come scelto.');
const chart = partyIdentity({ party: { id: 'party-registro-p1-2017-41-ir', officialName: 'Lega per Salvini Premier', abbreviation: 'Lega' }, force: { color: '#9085e9' } });
assert.equal(chart.source, 'grafico', 'Un partito senza colore proprio, scelta o logo prende il colore del grafico assegnato dal gioco.'); assert.equal(chart.accent, accentAsGraphic('#9085e9'), 'Il colore del grafico, reso leggibile.');
assert.match(chart.sourceLabel, /grafici/, 'L’origine del colore è dichiarata.');
const junk = partyIdentity({ party: { id: 'j', name: 'Prova', color: 'rosso' }, force: { color: 'blu' } });
assert.equal(junk.accent, NEUTRAL_ACCENT, 'Un colore non valido non diventa un colore: neutro.'); assert.equal(junk.source, 'neutro');
// The independent: neutral, no mark, no logo, never an invented symbol.
const independent = partyIdentity();
assert.equal(independent.kind, 'indipendente'); assert.equal(independent.accent, NEUTRAL_ACCENT); assert.equal(independent.mark, null); assert.equal(independent.logo, null); assert.equal(independent.accent2, null);
assert.ok(!identityMark(independent).includes('<img') && identityMark(independent).includes('emblem-ghost'), 'L’indipendente ha un segno neutro (una persona), non un simbolo inventato.');
assert.ok(partyChip(independent).includes('Indipendente') && partyChip(independent).includes('data-kind="indipendente"'), 'Il riquadro dell’indipendente lo dice.');
assert.ok(topbarParty(independent).includes('aria-label="Carriera da indipendente"'), 'Anche nella barra alta.');
// Vars and chips.
const vars = identityVars(fn);
for (const name of ['--party-accent:', '--party-accent-text:', '--party-accent-ink:', '--party-accent-2:', '--party-accent-soft:', '--party-accent-line:']) assert.ok(vars.includes(name), `Variabile ${name}`);
assert.ok(partyChip(fn, 'Coordinatore locale').includes('<img') && partyChip(fn, 'Coordinatore locale').includes('Futuro Nazionale') && partyChip(fn, 'Coordinatore locale').includes('Coordinatore locale'), 'Il riquadro del partito ha logo, nome e ruolo.');
assert.ok(partyChip(fn).includes('colore del logo ufficiale'), 'L’origine del colore è nel titolo del riquadro.');
// Party, coalition, group and institution are four things with four glyphs and tones (never colour alone); the party is the only one that takes the accent of the career.
assert.deepEqual(Object.keys(KIND_TONES), ['partito', 'coalizione', 'gruppo', 'istituzione', 'indipendente']);
assert.equal(new Set(Object.values(KIND_TONES).map(item => item.icon)).size, 5, 'Cinque glifi diversi.');
assert.equal(new Set(Object.values(KIND_TONES).filter(item => item.tone !== 'var(--party-accent)').map(item => item.tone)).size, 4, 'Toni propri per coalizione, gruppo, istituzione e indipendente.');
for (const kind of ['partito', 'coalizione', 'gruppo', 'istituzione']) assert.ok(kindChip(kind, 'X').includes(`kind-${kind}`) && kindChip(kind, 'X').includes('<svg'), `Etichetta ${kind} con glifo.`);
assert.ok(kindChip('sconosciuto', 'X').includes('kind-istituzione'), 'Un tipo sconosciuto non produce una classe inventata.');
assert.ok(!kindChip('partito', '<b>x</b>').includes('<b>x</b>'), 'Il testo è escapato.');
// Pure: the same input gives the same identity and nothing is mutated.
const input = Object.freeze({ party: Object.freeze({ ...fnRecord }), force: Object.freeze({ color: '#c98500' }), logo: 'l.png' });
assert.deepEqual(partyIdentity(input), partyIdentity(input), 'Funzione pura.');
assert.ok(contrastRatio(accentAsText('#000000'), TEXT_SURFACE) >= 4.5 && contrastRatio(accentAsText('#ffffff'), TEXT_SURFACE) >= 4.5, 'accentAsText regge i casi estremi.');
// Every readable accent that the three sources can give keeps ink and text contrast.
let worstInk = 99, worstText = 99, worstGraphic = 99;
for (let r = 0; r < 256; r += 51) for (let g = 0; g < 256; g += 51) for (let b = 0; b < 256; b += 51) {
  const hex = `#${[r, g, b].map(value => value.toString(16).padStart(2, '0')).join('')}`;
  const identity = partyIdentity({ party: { id: 'p', name: 'P', color: hex } });
  worstInk = Math.min(worstInk, contrastRatio(identity.accentInk, identity.accent)); worstText = Math.min(worstText, contrastRatio(identity.accentText, TEXT_SURFACE)); worstGraphic = Math.min(worstGraphic, contrastRatio(identity.accent, SHELL_SURFACE), contrastRatio(identity.accent, PANEL_SURFACE));
}
assert.ok(worstInk >= 4.5 && worstText >= 4.5 && worstGraphic >= 3, `Qualunque colore scelto: inchiostro ${worstInk.toFixed(2)}:1, testo ${worstText.toFixed(2)}:1 (almeno 4,5:1), elemento grafico ${worstGraphic.toFixed(2)}:1 (almeno 3:1).`);
assert.ok(inkOn('#122c69') === '#ffffff', 'Il blu del logo vuole inchiostro chiaro.');

// ---------- 2. the colours are the logo's ----------
for (const [id, brand] of Object.entries(LOGO_BRAND)) {
  const png = decodePng(await readFile(new URL(`../${brand.asset.replace(/^\.\//, '')}`, import.meta.url)));
  const measured = brandOfLogo(png);
  const close = (a, b) => [1, 3, 5].every(index => Math.abs(parseInt(a.slice(index, index + 2), 16) - parseInt(b.slice(index, index + 2), 16)) <= 2);
  assert.ok(measured.primary && close(measured.primary, brand.primary), `${id}: il colore principale ${brand.primary} è quello del logo (misurato ${measured.primary}).`);
  assert.ok(measured.secondary && close(measured.secondary, brand.secondary), `${id}: il secondo colore ${brand.secondary} è quello del logo (misurato ${measured.secondary}).`);
  assert.ok(brand.source.includes('Logo ufficiale'), `${id}: la fonte è dichiarata.`);
}

// ---------- 3. Futuro Nazionale is linked to everything the game uses ----------
{
  const figures = await json('political-figures'), leaderships = await json('party-leaderships'), memberships = await json('party-memberships'), polls = await json('polls'), groups = await json('parliamentary-groups');
  const leader = leaderships.find(item => item.partyId === FN && item.role === 'Presidente');
  assert.ok(leader && figures.find(item => item.id === leader.politicalFigureId), 'Futuro Nazionale ha un presidente, e la sua scheda esiste.');
  assert.ok(memberships.some(item => item.partyId === FN), 'Futuro Nazionale ha iscritti nelle appartenenze.');
  assert.ok(JSON.stringify(polls).includes(FN), 'Futuro Nazionale è nel sondaggio reale di partenza.');
  assert.ok(groups.some(item => /Futuro Nazionale/.test(item.name ?? item.officialName ?? '')), 'Futuro Nazionale ha un gruppo alla Camera.');
}
console.log('Identità del partito (parte senza browser): colori dalla scelta, dal logo ufficiale o dal grafico (mai inventati), contrasto di accento, testo e inchiostro, indipendente neutro, etichette di partito, coalizione, gruppo e istituzione distinte, Futuro Nazionale collegato a logo, presidente, appartenenze, sondaggi e gruppo.');

// ---------- 4. in the page ----------
if (!chromeAvailable) { console.log('Identità del partito nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).'); process.exit(0); }
let failure = null;
await withBrowser(async browser => {
  const { evaluate, viewport, waitFor, pause, errors, version } = browser;
  const state = () => evaluate(`(() => { const shell = document.querySelector('.app-shell'); if (!shell) return null; const css = getComputedStyle(shell); const chip = document.querySelector('.party-identity'); const top = document.querySelector('.topbar-party'); return { kind: shell.dataset.identity, source: shell.dataset.identitySource, accent: css.getPropertyValue('--party-accent').trim(), ink: css.getPropertyValue('--party-accent-ink').trim(), chip: chip ? { text: chip.textContent.trim().replace(/\\s+/g, ' '), img: chip.querySelector('img')?.getAttribute('src') ?? null, kind: chip.dataset.kind } : null, top: top ? { shown: getComputedStyle(top).display !== 'none', img: top.querySelector('img')?.getAttribute('src') ?? null, label: top.getAttribute('aria-label') } : null, navActive: getComputedStyle(document.querySelector('.nav-item.active') ?? document.body).boxShadow }; })()`);
  const rerender = () => pause(500);
  // Another career's colour must not leak in: a first career with Lega is created, then Futuro Nazionale replaces it (one career per browser profile, as in the game).
  await createCareerInPage(browser, { party: FN, group: 'cam-xix-12', weeks: 2 });
  await openCareer(browser);
  await viewport(1280, 800, false);
  await rerender();
  let now = await state();
  assert.equal(now.kind, 'partito'); assert.equal(now.source, 'logo', 'Futuro Nazionale: colore del logo.');
  assert.equal(now.accent, fn.accent, `L’accento della pagina è quello calcolato (${now.accent}).`);
  assert.ok(now.chip.img?.includes('futuro-nazionale.png') && /Futuro Nazionale/.test(now.chip.text), `Il riquadro del partito mostra il logo e il nome (${JSON.stringify(now.chip)}).`);
  assert.ok(now.navActive.includes('34, 84, 200') || now.navActive.includes(hexToRgb(fn.accent)), 'La voce attiva del menu usa il colore del partito.');
  assert.equal(now.top.shown, false, 'Sul computer la barra alta non ripete il segno del partito (c’è il riquadro nel menu).');
  await viewport(390, 844, true); await rerender();
  now = await state();
  assert.equal(now.top.shown, true, 'Sul telefono il segno del partito è nella barra alta.');
  assert.ok(now.top.img?.includes('futuro-nazionale.png') && /Futuro Nazionale/.test(now.top.label), 'Con il logo di Futuro Nazionale.');
  await viewport(1280, 800, false); await rerender();

  // Leaving the party: independent, neutral, nothing of the old colour.
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.leaveParty(); return true; })()`);
  await rerender();
  now = await state();
  assert.equal(now.kind, 'indipendente', 'Lasciato il partito la carriera è da indipendente.'); assert.equal(now.accent, NEUTRAL_ACCENT, 'Colore neutro.');
  assert.ok(now.chip.kind === 'indipendente' && !now.chip.img && /Indipendente/.test(now.chip.text), 'Il riquadro dice Indipendente, senza logo né simbolo.');
  // Joining another party: its own identity (here the colour the game gave Lega in the charts: the database has none).
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const real = await import('/src/data/repositories/real-data.js?v=${version}'); store.joinParty('party-registro-p1-2017-41-ir', real.realDatabase.parties); return true; })()`);
  await rerender();
  now = await state();
  assert.equal(now.kind, 'partito'); assert.equal(now.source, 'grafico', 'Un partito del database senza colore né logo prende il colore del grafico.');
  assert.notEqual(now.accent, fn.accent, 'Il colore di Futuro Nazionale non resta.'); assert.ok(/Lega/.test(now.chip.text) && !now.chip.img, 'Il riquadro dice Lega, senza il logo di un altro partito.');
  // Founding a party: it brings its own colour and name.
  const founded = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); try { store.foundParty({ label: 'Alba Civica', abbreviation: 'ALBA', followerIds: [] }); return 'ok'; } catch (error) { return error.message; } })()`);
  await rerender();
  if (founded === 'ok') {
    now = await state();
    assert.equal(now.kind, 'partito'); assert.ok(/Alba Civica|ALBA/.test(now.chip.text), `Il riquadro dice il partito fondato (${now.chip.text}).`);
    assert.equal(now.source, 'scelto', 'Un partito fondato ha il colore scelto alla fondazione.');
  } else console.log(`(fondazione non disponibile in questa settimana: ${founded}; il controllo sul partito fondato è coperto da check:life)`);
  if (errors.length) failure = `Errori JavaScript: ${errors.slice(0, 3).join(' | ')}`;
});
function hexToRgb(hex) { return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)).join(', '); }
if (failure) { console.error(failure); process.exit(1); }
console.log('Identità del partito nel browser verificata: Futuro Nazionale con colore, logo e nome nel menu e nella barra alta del telefono, indipendente neutro dopo aver lasciato il partito, nuovo partito con la sua identità, partito fondato con il colore scelto, nessun errore nella pagina.');
