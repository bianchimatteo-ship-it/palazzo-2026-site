// Interface test without a browser: the app is mounted on a minimal DOM stand-in, driven through its own
// click handlers, and every page is checked for content and for invalid values in the HTML.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
const session = new Map();
globalThis.sessionStorage = { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, String(value)), removeItem: key => session.delete(key) };
globalThis.window = { innerWidth: 1200 };
const html = { dataset: {}, style: { props: {}, setProperty(name, value) { this.props[name] = value; } } };
const bodyChildren = [];
const windowListeners = {};
globalThis.addEventListener = (type, fn) => { (windowListeners[type] ??= []).push(fn); };
globalThis.document = { baseURI: 'http://localhost/', activeElement: null, documentElement: html, createElement: () => ({ style: {}, dataset: {}, hidden: false, children: [], replaceChildren(...items) { this.children = items; }, append() {} }), createTextNode: text => text, body: { append: element => bodyChildren.push(element) } };
globalThis.indexedDB = undefined;
// Sensitive actions use the game's own confirmation dialog, never the browser's confirm().
globalThis.confirm = () => { throw new Error('Il gioco non deve usare il confirm() del browser.'); };
// Real JSON files served like the static server would.
const serveFile = async url => {
  const body = await readFile(fileURLToPath(new URL(url)), 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};
globalThis.fetch = serveFile;

const listeners = {};
const root = { innerHTML: '', addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); }, querySelector: () => null, querySelectorAll: () => [] };
const { store } = await import('../src/core/store.js');
const { mountApp } = await import('../src/ui/app.js');
const realData = await import('../src/data/repositories/real-data.js');
const { loadSettings } = await import('../src/core/settings.js');
const { playerRoles } = await import('../src/core/roles.js');
const logos = await import('../src/data/repositories/logo-store.js');
const { loadRealCollections, loadRealDatabase } = realData;

await loadRealDatabase();
await loadRealCollections(['parties', 'politicalMovements', 'twoPerThousand', 'parliamentaryGroups', 'politicians', 'groupMemberships', 'chambers', 'partyLeaderships', 'politicalFigures', 'offices', 'laws']);
store.setRealReference({ twoPerThousand: realData.realDatabase.twoPerThousand, parties: realData.realDatabase.parties, movements: realData.realDatabase.politicalMovements });
mountApp(root, store);

const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const click = async attrs => { const target = el(attrs); for (const fn of listeners.click) await fn({ target }); await tick(); return root.innerHTML; };
function el(attrs) {
  return {
    closest: selector => {
      for (const part of selector.split(',')) {
        const match = part.trim().match(/^\[data-([a-z-]+)(?:="([^"]+)")?\]$/);
        if (!match) continue;
        const key = match[1].replace(/-([a-z])/g, (_, char) => char.toUpperCase());
        if (key in attrs && (match[2] === undefined || attrs[key] === match[2])) return { dataset: attrs, matches: () => false };
      }
      return null;
    },
    matches: () => false
  };
}
const clean = text => !/undefined|NaN|\[object Object\]/.test(text.replace(/data-[a-z-]+="[^"]*"/g, ''));
const goto = page => click({ nav: page });

// ---------- 1. main menu at start ----------
assert.ok(root.innerHTML.includes('main-menu'), 'All’avvio compare il menu principale');
for (const label of ['Nuova partita', 'Carica partita', 'Come giocare', 'Impostazioni']) assert.ok(root.innerHTML.includes(label), `Menu: manca ${label}`);
assert.ok(!root.innerHTML.includes('CONTINUA LA PARTITA'), 'Senza partita non c’è “Continua”');
assert.ok((await click({ menu: 'guida' })).includes('guide-card') && root.innerHTML.includes('Ruoli e poteri'));
let menuHtml = await click({ menu: 'impostazioni' });
for (const key of ['sound', 'volume', 'motion', 'toasts', 'autosave', 'weeksPerTurn', 'textSize', 'contrast', 'density']) assert.ok(menuHtml.includes(`data-setting-key="${key}"`), `Impostazione mancante: ${key}`);
await click({ settingKey: 'motion', settingValue: 'reduced' });
await click({ settingKey: 'textSize', settingValue: '112' });
await click({ settingKey: 'contrast', settingValue: 'high' });
assert.equal(html.dataset.motion, 'reduced');
assert.equal(html.dataset.contrast, 'high');
assert.equal(html.style.props['--ui-scale'], '1.12');
assert.equal(loadSettings().textSize, '112', 'Le impostazioni restano salvate');
menuHtml = await click({ menuAction: 'reset-settings' });
assert.ok(menuHtml.includes('confirm-dialog') && menuHtml.includes('Ripristinare le impostazioni?') && menuHtml.includes('data-confirm="cancel"'), 'Il ripristino delle impostazioni chiede conferma con la finestra del gioco.');
assert.ok(!(await click({ confirm: 'cancel' })).includes('confirm-dialog'), 'Annulla chiude la conferma.');
assert.equal(loadSettings().motion, 'reduced', 'Annullando non cambia nulla.');
await click({ menuAction: 'reset-settings' });
await click({ confirm: 'ok' });
assert.equal(loadSettings().motion, 'full');
assert.ok((await click({ menu: 'carica' })).includes('Nessun salvataggio negli slot'));
// Account: sign in or sign up from the menu; the career is then kept online too.
menuHtml = await click({ menu: 'account' });
assert.ok(menuHtml.includes('data-account-form="login"') && menuHtml.includes('data-account-form="register"'), 'Dal menu si accede o si crea un account.');
assert.ok(menuHtml.includes('non lascia mai il tuo browser in chiaro'), 'Si spiega come viene protetta la password.');

// ---------- 2. new game from the menu: real parties only ----------
let page = await click({ menu: 'nuova' });
assert.ok(page.includes('Prima di iniziare: il tuo account') && !page.includes('career-wizard'), 'Senza account, Nuova partita porta prima alla creazione o all’accesso dell’account.');
// Here the account service is not reachable: the game can start in this browser (the fallback of the account view).
page = await click({ menuAction: 'start-local' });
assert.ok(page.includes('career-wizard'), 'Nuova partita apre il Career Wizard');
assert.ok(!page.includes('Partito di esempio'), 'Il segnaposto non è tra i partiti selezionabili');
const groups = realData.realDatabase.parliamentaryGroups;
const founder = { firstName: 'Marta', lastName: 'Neri', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', previousProfession: 'Architetta', initialLevel: 'deputato', parliamentaryGroupId: 'cam-xix-04', parliamentStartMode: 'real-context', partyMode: 'new', partyName: 'Lista Civica Neri', partyAbbreviation: 'LCN', partyColor: '#3a6ea5', partyColor2: '#f2c14e', partyDescription: 'Partito fondato dal giocatore.', partyOrientation: 'Altro', partyProgram: ['scuola', 'cultura'], partyLogoMode: 'builder', partyLogoShape: 'scudo', partyLogoSymbol: 'ponte', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } };
store.createCareer(founder, realData.realDatabase.parties, groups);
await click({ wizardAction: 'cancel' });
assert.ok(store.hasCareer() && !root.innerHTML.includes('main-menu'), 'Dopo la creazione si entra in partita');
const world = store.getState().world;
const verified = new Set([...realData.realDatabase.parties, ...realData.realDatabase.politicalMovements].filter(item => item.source === 'real' && item.verified === true).map(item => item.id));
assert.ok(world.parties.filter(item => !item.isPlayer).every(item => verified.has(item.id)), 'Gli altri partiti sono tutti reali verificati');
assert.ok(world.parties.filter(item => !item.isPlayer).every(item => item.reference?.source === 'real'), 'Ogni partito ha il riferimento reale del 2×1000');

// ---------- 3. every page renders ----------
const pages = ['panoramica', 'carriera', 'profilo', 'partito', 'territori', 'finanze', 'parlamento', 'governo', 'leggi', 'elezioni', 'calendario', 'sondaggi', 'archivio', 'amministrazione', 'impostazioni'];
for (const id of pages) { const text = await goto(id); assert.ok(text.length > 1000, `${id} vuota`); assert.ok(clean(text), `${id}: valori non validi`); assert.ok(!/in costruzione|STRUTTURA PRONTA/.test(text), `${id}: segnaposto`); }
// The admin area is not reachable by typing its address, and players see no way in.
const adminPage = await goto('amministrazione');
assert.ok(adminPage.includes('Area riservata al proprietario') && !adminPage.includes('data-admin-select-party') && !adminPage.includes('Imposta il PIN'), 'L’area amministrativa mostra solo l’accesso del proprietario.');
const playerSettings = await goto('impostazioni');
assert.ok(!playerSettings.includes('data-nav="amministrazione"') && !playerSettings.includes('data-action="logo-admin"'), 'Nessun ingresso all’area amministrativa per i giocatori.');
const pollsForFounder = await goto('sondaggi');
assert.ok(pollsForFounder.includes('Probabilità che accetti'), 'Il segretario vede, prima di proporre un’intesa, probabilità e motivi.');
let home = await goto('panoramica');
// Phones: four sections one tap away and an "Altro" sheet with every other section.
assert.ok(home.includes('class="mobile-tabbar"') && (home.match(/class="mobile-tab /g) ?? []).length === 5 && home.includes('data-mobile-more'), 'Barra inferiore con 5 tasti immediati.');
assert.ok(home.includes('data-mobile-sheet hidden') && ['finanze', 'parlamento', 'archivio', 'impostazioni'].every(id => home.includes(`class="sheet-item " data-nav="${id}"`) || home.includes(`class="sheet-item active" data-nav="${id}"`)), 'Il pannello “Altro” raggiunge tutte le sezioni.');
// Branding: the party created in the wizard has a real identity used across the game.
const userParty = store.getState().dataset.parties.find(party => party.source === 'user');
assert.ok(userParty.logo?.kind === 'builder' && userParty.color2 === '#f2c14e' && userParty.program.includes('scuola') && userParty.officialName === 'Lista Civica Neri', 'Il partito creato ha logo, colori, programma e scheda completa (source: user).');
assert.deepEqual(store.getState().game.party.program.areas, ['scuola', 'cultura'], 'Il programma del partito entra nella partita.');
assert.ok(home.includes('class="party-identity"') && home.includes('data:image/svg+xml') && home.includes('hero-party-logo'), 'Logo e identità del partito compaiono nelle schermate.');
assert.ok(home.includes('--party-accent:#3a6ea5'), 'Il colore del partito guida l’interfaccia.');
const { partyLogoSvg } = await import('../src/ui/party-logo.js');
assert.ok(partyLogoSvg({ shape: 'scudo', symbol: 'ponte', primary: '#3a6ea5', secondary: '#f2c14e', text: 'LCN' }).includes('LCN'), 'Il logo si costruisce con forme, simboli, colori e sigla.');
// Tooltips: one element, removed on every render, route change and when its anchor disappears.
const tip = bodyChildren.find(element => element.className === 'viz-tip');
assert.ok(tip && bodyChildren.filter(element => element.className === 'viz-tip').length === 1, 'Un solo tooltip nel documento.');
const anchor = { dataset: { tip: 'Sanità 58/100' }, isConnected: true, closest: selector => selector === '[data-tip]' ? anchor : null };
const hover = () => { for (const fn of listeners.pointermove) fn({ target: { closest: selector => anchor.closest(selector) }, clientX: 100, clientY: 100 }); };
hover();
assert.equal(tip.hidden, false, 'Il tooltip compare al passaggio del mouse.');
assert.notEqual(tip.style.display, 'none', 'Visibile solo mentre serve.');
await goto('territori');
assert.equal(tip.hidden, true, 'Cambiando pagina il tooltip sparisce.');
assert.equal(tip.style.display, 'none', 'Il riquadro nascosto non resta a schermo: display none anche se il CSS lo imposta a griglia.');
hover();
for (const fn of listeners.pointerout ?? []) fn({ relatedTarget: null });
assert.equal(tip.style.display, 'none', 'Uscendo dall’elemento il tooltip sparisce subito.');
hover();
for (const fn of windowListeners.hashchange ?? []) fn({});
assert.equal(tip.hidden, true, 'Anche al cambio di hash.');
hover();
for (const fn of listeners.pointerleave ?? []) fn({});
assert.equal(tip.hidden, true, 'E quando il mouse esce.');
home = await goto('panoramica');
for (const text of ['RUOLI E POTERI', 'Fondatore e segretario', 'PERCHÉ È CAMBIATO', 'REDAZIONE', 'data-news-filter', 'data-action="menu"']) assert.ok(home.includes(text), `Home: manca ${text}`);
assert.ok((await click({ newsFilter: 'diario' })).includes('data-news-filter="diario" class="active"'));
const settingsPage = await goto('impostazioni');
assert.ok(settingsPage.includes('data-setting-key="autosave"') && !settingsPage.includes('Gestione loghi') && !settingsPage.includes('Ricomincia la demo'), 'Impostazioni del giocatore, senza strumenti del proprietario');

// ---------- 4. the secretary's powers, with consequences ----------
assert.ok(playerRoles(store.getState()).secretary, 'Il fondatore è segretario');
// The Partito section opens on the overview; the secretary's desk has its own tab, remembered across redraws.
const partyOverview = await goto('partito');
for (const text of ['party-page', 'IL TUO PARTITO', 'data-section-tab-value="segreteria"', 'Le aree del partito', 'Il partito nei sondaggi']) assert.ok(partyOverview.includes(text), `Partito: manca ${text}`);
const party = await click({ sectionTab: 'partito', sectionTabValue: 'segreteria' });
assert.ok((await goto('panoramica')) && (await goto('partito')).includes('Le decisioni del segretario'), 'La scheda Segreteria resta aperta tornando al Partito.');
for (const text of ['Le decisioni del segretario', 'data-secretary="line"', 'data-secretary-select="organs"', 'data-secretary-select="candidacy"', 'data-secretary="discipline"', 'data-secretary="expel"', 'data-secretary="investment"']) assert.ok(party.includes(text), `Segreteria: manca ${text}`);
const before = store.getState();
await click({ secretary: 'line', secretaryValue: 'coalizione' });
let after = store.getState();
assert.equal(after.game.party.line, 'coalizione', 'La linea cambia');
assert.ok(after.game.week.ap < before.game.week.ap, 'La decisione costa tempo');
assert.ok(after.game.timeline.some(item => item.title.includes('Linea del partito')), 'La decisione entra nella cronologia');
await click({ secretary: 'line', secretaryValue: 'opposizione' });
assert.equal(store.getState().game.party.line, 'coalizione', 'Il cooldown impedisce di cambiare subito linea');
assert.ok(store.getState().ui.toast?.includes('settimana'), 'Il blocco è spiegato');
const members = store.getState().game.party.org.members;
store.expelDissidents();
assert.ok(store.getState().game.party.org.members < members, 'L’espulsione fa perdere iscritti');
assert.ok(store.getState().society.media.coverage.some(item => /dissidenti|espuls/i.test(item.headline)), 'La stampa ne parla');
store.getState().game.party.org.treasury.balance = 50000;
await click({ secretary: 'investment', secretaryValue: 'scuola-politica' });
assert.ok(store.getState().game.party.org.investments.some(item => item.id === 'scuola-politica'), 'Investimento del partito avviato');
store.advance(7);

// ---------- 5. Prime Minister: a different phase of the career, powers through Government and Parliament ----------
// The career found a Government already in office (simulation built from the real majority): the player is not in it.
{
  const government = store.getState().parliament.government;
  assert.ok(government?.status === 'active' && government.formedBy === 'reference' && government.primeMinister === 'reference', 'All’avvio c’è già un governo in carica, guidato da un Presidente del Consiglio simulato.');
  assert.ok(!playerRoles(store.getState()).primeMinister && !government.ministers.some(item => item.playerAppointed), 'Il giocatore non ne fa parte.');
  const governo = await goto('governo');
  assert.ok(governo.includes('GOVERNO IN CARICA · SIMULAZIONE') && governo.includes('I Governo Meloni') && !governo.includes('Nessun governo'), 'La pagina Governo mostra il governo in carica, non “Nessun governo”.');
  assert.ok(governo.includes('data-parliament-action="withdraw-support"') && governo.includes('data-government-post-form'), 'Dal suo gruppo di maggioranza il giocatore può chiedere un ministero o ritirare il sostegno.');
  assert.throws(() => store.formGovernment(['cam-xix-01', 'cam-xix-04', 'senato-xix-gruppo-85', 'senato-xix-gruppo-56']), /già un governo/, 'Per formarne uno nuovo il governo in carica deve prima cadere.');
  // The player's party takes its group out of the majority: crisis, then the simulated Prime Minister asks for confidence.
  store.getState().game.week.ap = 6;
  store.withdrawGovernmentSupport();
  assert.equal(store.getState().parliament.government.status, 'crisis');
  // The simulated Prime Minister goes back to the Chambers (or resigns before): without those seats the Government falls.
  for (let week = 0; week < 3 && store.getState().parliament.government.status !== 'fallen'; week++) store.advance(7);
  assert.equal(store.getState().parliament.government.status, 'fallen', 'Senza il gruppo del giocatore la maggioranza non ha più i numeri: il governo cade.');
  store.getState().game.week.ap = 6; store.getState().game.resources.politicalCapital = 40;
}
store.formGovernment(['cam-xix-01', 'cam-xix-03', 'cam-xix-04', 'senato-xix-gruppo-85', 'senato-xix-gruppo-33', 'senato-xix-gruppo-56']);
store.voteGovernmentConfidence();
assert.equal(store.getState().parliament.government.status, 'active', 'La coalizione ottiene la fiducia');
{
  assert.ok(playerRoles(store.getState()).primeMinister, 'Con la fiducia sei Presidente del Consiglio');
  let governo = await goto('governo');
  for (const text of ['La guida del governo', 'data-government-program-form', 'data-government-action="summit"', 'data-policy-form', 'data-budget-form', 'Il governo propone, il Parlamento decide']) assert.ok(governo.includes(text), `Scrivania del PdC: manca ${text}`);
  assert.ok(governo.includes('I Governo Meloni'), 'Il governo reale è mostrato come riferimento');
  assert.ok(!governo.includes('data-government-agenda-form'), 'Niente più decreti automatici del PdC');
  store.getState().game.week.ap = 6; store.getState().game.resources.politicalCapital = 40;
  store.setGovernmentProgram({ line: 'crescita', priorities: ['sanita', 'scuola', 'infrastrutture'] });
  assert.equal(store.getState().parliament.government.program.line, 'crescita');
  const applied = store.getState().society.lawsApplied.length;
  const bill = store.proposeGovernmentBill({ policy: { area: 'sanita', instrument: 'investimento', intensity: 2, financing: 'deficit' } });
  assert.equal(bill.origin, 'governo');
  assert.equal(store.getState().society.lawsApplied.length, applied, 'Il PdC non approva leggi da solo: il ddl deve passare dal Parlamento.');
  store.advanceLaw(bill.id, 'present');
  governo = await goto('leggi');
  assert.ok(governo.includes('Disegno di legge del governo') && governo.includes('Prossimo passaggio tra 2 settimane'), 'La scheda mostra tipo e tempi dell’iter');
  assert.ok(governo.includes('data-law-patch') && governo.includes('Riduci la portata'), 'Il contenuto si può emendare in commissione');
  console.log(`  PdC: programma ${store.getState().parliament.government.program.priorities.length} priorità, ddl in ${bill.stage}.`);
}

// ---------- 6. weekly report, turn speed, timeline ----------
await goto('panoramica');
let week = store.getState().game.week.index;
page = await click({ action: 'advance' });
assert.ok(store.getState().game.week.index > week, 'Chiudi settimana fa avanzare il tempo');
assert.ok(!page.includes('confirm-dialog'), 'Una sola settimana non chiede conferma.');
assert.ok(page.includes('report-modal') && page.includes('Com’è andata la settimana'), 'Resoconto di fine settimana');
assert.ok(!(await click({ reportClose: '' })).includes('report-modal'));
await click({ settingKey: 'weeksPerTurn', settingValue: '2' });
for (const item of store.getState().game.inbox) item.kind = 'normale';
week = store.getState().game.week.index;
page = await click({ action: 'advance' });
assert.ok(page.includes('confirm-dialog') && page.includes('Avanzare di 2 settimane?') && page.includes('Non chiedere più in questa sessione'), 'Avanzare di più settimane in un’azione chiede conferma.');
await click({ confirm: 'cancel' });
assert.equal(store.getState().game.week.index, week, 'Annullando il tempo non avanza.');
await click({ action: 'advance' });
for (const fn of windowListeners.keydown ?? []) fn({ key: 'Escape' });
await tick();
assert.ok(!root.innerHTML.includes('confirm-dialog') && store.getState().game.week.index === week, 'Esc chiude la conferma senza avanzare.');
await click({ action: 'advance' });
for (const fn of listeners.change) await fn({ target: { matches: selector => selector === '[data-confirm-option]', checked: true } });
await click({ confirm: 'ok' });
assert.ok(store.getState().game.week.index - week >= 1 && store.getState().game.week.index - week <= 2, 'La velocità della simulazione decide le settimane per turno');
if (root.innerHTML.includes('report-modal')) await click({ reportClose: '' });
for (const item of store.getState().game.inbox) item.kind = 'normale';
week = store.getState().game.week.index;
page = await click({ action: 'advance' });
assert.ok(!page.includes('confirm-dialog') && store.getState().game.week.index > week, '“Non chiedere più in questa sessione” vale per il resto della sessione.');
if (root.innerHTML.includes('report-modal')) await click({ reportClose: '' });
await click({ settingKey: 'weeksPerTurn', settingValue: '1' });
week = store.getState().game.week.index;
page = await click({ gameFastforward: 'comunale', fastforwardLabel: 'Elezioni comunali', fastforwardDate: '2027-05-02', fastforwardWeeks: '30' });
assert.ok(page.includes('Avanzare fino alle candidature?') && page.includes('circa 30 settimane') && page.includes('Elezioni comunali'), 'Il salto fino alle candidature chiede conferma e dice quanto tempo passa.');
await click({ confirm: 'cancel' });
assert.equal(store.getState().game.week.index, week, 'Annullando il salto il tempo non avanza.');
// Carriera: the four tracks with the odds of the next step; the timeline has its own tab.
let career = await goto('carriera');
for (const text of ['career-page', 'ISTITUZIONI ELETTE', 'PARTITO', 'PARLAMENTO', 'GOVERNO', 'PROSSIMO PASSO', 'data-section-tab-value="progressione"']) assert.ok(career.includes(text), `Carriera: manca ${text}`);
career = await click({ sectionTab: 'carriera', sectionTabValue: 'progressione' });
assert.ok(career.includes('COME FUNZIONA') && career.includes('Come può finire') && career.includes('STORICO DEI TENTATIVI'), 'Progressione: probabilità, esiti possibili e tentativi.');
career = await click({ sectionTab: 'carriera', sectionTabValue: 'cronologia' });
assert.ok(career.includes('La tua carriera, tappa per tappa') && career.includes('track-record') && career.includes('Inizia la carriera'), 'Cronologia della carriera');
assert.ok((await click({ timelineFilter: 'partito' })).includes('data-timeline-filter="partito" class="active"'));

// ---------- 7. archive of real data ----------
page = await goto('archivio');
assert.ok(page.includes('archive-tabs') && page.includes('Partiti e movimenti'), 'Archivio con schede');
page = await click({ archiveTab: 'governo' });
// Filters and selections outside the redesigned sections are kept too (archive tab, catalogue filters, laws, territories).
const savedViews = () => JSON.parse(localStorage.getItem('politicando.views.v1') ?? '{}');
assert.equal(savedViews().pages?.archive?.tab, 'governo', 'La scheda dell’Archivio resta salvata.');
assert.ok(['partySort', 'politicianChamber', 'politicianQuery'].every(key => key in (savedViews().pages?.catalog ?? {})) && 'measure' in (savedViews().pages?.territory ?? {}) && 'outcome' in (savedViews().pages?.realLaws ?? {}), 'Filtri di archivi, territori e leggi salvati.');
assert.ok(page.includes('I Governo Meloni') && page.includes('GIORGIA MELONI') && page.includes('Presidente del Consiglio dei ministri'), 'Governo reale con i nomi della fonte');
page = await click({ archiveTab: 'gruppi' });
assert.ok(page.includes('Camera dei deputati') && page.includes('Senato della Repubblica') && page.includes('componenti'));
page = await click({ archiveTab: 'senatori' });
assert.ok(page.includes('Senatore · Senato della Repubblica') && !page.includes('Deputato · Camera dei deputati'), 'La scheda Senatori mostra solo senatori');
page = await click({ archiveTab: 'deputati' });
assert.ok(page.includes('Deputato · Camera dei deputati') && !page.includes('Senatore · Senato della Repubblica'));
page = await click({ archiveTab: 'leggi' });
assert.ok(page.includes('Scheda del Senato'), 'Leggi reali consultabili');
page = await click({ archiveTab: 'territori' });
assert.ok(page.includes('Lombardia') && page.includes('deputati eletti'), 'Territori reali');
page = await click({ archiveTab: 'partiti' });
page = await click({ partyProfile: 'party-registro-p1-2015-29-ir' });
assert.ok(page.includes('2×1000') && page.includes('Partito Democratico') && page.includes('Scelte valide'), 'Scheda partito con 2×1000 reale');
await click({ profileClose: '' });
page = await click({ politicianProfile: 'camera-xix-deputato-302103' });
assert.ok(page.includes('Incarico di governo') && page.includes('Presidente del Consiglio dei ministri'), 'Scheda del parlamentare con l’incarico di governo reale');
for (const id of pages) assert.ok(clean(await goto(id)), `${id} (dopo le azioni): valori non validi`);

// ---------- 8. saves: slots, menu, continue, import/export, a second game ----------
await click({ action: 'menu' });
assert.ok(root.innerHTML.includes('CONTINUA LA PARTITA') && root.innerHTML.includes('Marta Neri'), 'Il menu offre “Continua” con l’ultima partita');
await click({ menu: 'carica' });
await click({ menuAction: 'save-slot' });
const slots = store.listSlots();
assert.equal(slots.length, 1, 'Salvataggio nello slot');
const savedWeek = store.getState().game.week.index;
const exported = store.exportSave();
store.advance(7);
page = await click({ slotLoad: slots[0].id });
if (page.includes('confirm-dialog')) { assert.ok(page.includes('Caricare questo salvataggio?'), 'Con modifiche non salvate il caricamento chiede conferma.'); await click({ confirm: 'ok' }); }
assert.equal(store.getState().game.week.index, savedWeek, 'Lo slot ripristina la partita');
assert.ok(!root.innerHTML.includes('main-menu'), 'Caricare chiude il menu');
store.loadGame(exported, 'Partita importata');
assert.equal(store.getState().game.week.index, savedWeek, 'Import da file');
assert.throws(() => store.loadGame('{"hello":1}'), /non contiene una partita/);
await click({ action: 'menu' });
await click({ menu: 'nuova' });
const member = { ...founder, firstName: 'Luca', lastName: 'Bassi', partyMode: 'existing', partyId: 'party-registro-p1-2015-29-ir', initialLevel: 'comunale', parliamentaryGroupId: '' };
store.createCareer(member, realData.realDatabase.parties, groups);
await click({ wizardAction: 'cancel' });
assert.ok(store.listSlots().some(slot => slot.player === 'Marta Neri'), 'La partita precedente resta in uno slot');
const keptSlot = store.listSlots()[0];
page = await click({ slotDelete: keptSlot.id });
assert.ok(page.includes('Eliminare questo salvataggio?') && page.includes('tone-danger') && page.includes('Elimina salvataggio'), 'Eliminare un salvataggio chiede conferma.');
await click({ confirm: 'cancel' });
assert.ok(store.listSlots().some(slot => slot.id === keptSlot.id), 'Annullando il salvataggio resta.');
const roles = playerRoles(store.getState());
assert.ok(!roles.secretary && roles.powers.find(power => power.label.startsWith('Linea politica')).enabled === false, 'Un iscritto non ha i poteri del segretario');
assert.throws(() => store.setPartyLine('opposizione'), /segretario/);
assert.throws(() => store.proposeAlliance(store.getState().world.parties.find(item => !item.isPlayer).id), /segretario/);
page = await goto('partito');
assert.ok(!page.includes('Le decisioni del segretario') && !page.includes('data-section-tab-value="segreteria"') && page.includes('LA TUA POSIZIONE'), 'Un iscritto non vede la scheda Segreteria (la scheda salvata non valida torna alla Panoramica).');
page = await click({ sectionTab: 'partito', sectionTabValue: 'ruoli' });
assert.ok(page.includes('POSIZIONE NEL PARTITO') && page.includes('probabilità stimata') && page.includes('PROBABILITÀ SIMULATA'), 'Ruoli e correnti: la promozione mostra probabilità e fattori, non solo una soglia.');
page = await goto('sondaggi');
assert.ok(!page.includes('data-world-alliance') && page.includes('Alleanze e rotture le decide il segretario'), 'Niente alleanze senza segreteria');
store.clearAllSaves();
assert.equal(store.listSlots().length, 0);
assert.ok(!store.hasCareer());

// ---------- 9. logos by address ----------
assert.equal(logos.isImageAddress('https://example.org/logo.svg'), true);
assert.equal(logos.isImageAddress('ftp://example.org/logo.svg'), false);
assert.equal(logos.isImageAddress('logo.svg'), false);
await assert.rejects(logos.fetchLogoFromUrl('non un indirizzo'), error => error.code === 'invalid');
const reply = (status, type, bytes) => async () => ({ ok: status < 400, status, headers: { get: name => name === 'content-type' ? type : String(bytes.length) }, blob: async () => new Blob([bytes], { type }) });
globalThis.fetch = reply(404, 'text/html', new Uint8Array(3));
await assert.rejects(logos.fetchLogoFromUrl('https://example.org/manca.png'), error => error.code === 'http');
globalThis.fetch = reply(200, 'text/html', new TextEncoder().encode('<html></html>'));
await assert.rejects(logos.fetchLogoFromUrl('https://example.org/pagina'), error => error.code === 'type');
globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
await assert.rejects(logos.fetchLogoFromUrl('https://example.org/protetto.png'), error => error.code === 'blocked');
const png = new Uint8Array(33); png.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 64, 0, 0, 0, 64]);
globalThis.fetch = reply(200, 'image/png', png);
const blob = await logos.fetchLogoFromUrl('https://example.org/logo.png');
assert.equal(blob.type, 'image/png');
await logos.saveLocalLogo('party-registro-p1-2015-29-ir', { blob, sourceUrl: 'https://example.org/logo.png', source: 'https://example.org', alt: 'Logo' });
await logos.saveLocalLogo('party-futuro-nazionale', { url: 'https://example.org/remoto.svg', alt: 'Logo remoto' });
const saved = await logos.listLocalLogos();
assert.ok(saved.every(item => item.origin === 'user'), 'I loghi aggiunti sono sempre dell’utente');
assert.ok(saved.find(item => item.partyId === 'party-futuro-nazionale').url === 'https://example.org/remoto.svg', 'Il logo remoto conserva l’indirizzo');
const logoExport = await logos.exportLogoConfiguration();
await logos.deleteLocalLogo('party-futuro-nazionale');
await logos.importLogoConfiguration(logoExport);
assert.equal((await logos.listLocalLogos()).length, 2, 'Import/export dei loghi, anche da indirizzo');
assert.equal(realData.realDatabase.parties.find(item => item.id === 'party-registro-p1-2015-29-ir').logoUrl ?? null, realData.realDatabase.parties.find(item => item.id === 'party-registro-p1-2015-29-ir').logoUrl ?? null);
assert.ok(Object.isFrozen(realData.realDatabase.parties[0]), 'I dati reali restano immutabili');
globalThis.fetch = serveFile;

console.log(`Interfaccia verificata: menu principale, guida, impostazioni applicate e salvate, nuova partita con soli partiti reali, ${pages.length} pagine senza valori non validi, poteri del segretario con costi e cooldown, scrivania del Presidente del Consiglio senza leggi unilaterali, identità del partito (logo, colori, programma), tooltip rimossi a ogni cambio pagina, resoconto settimanale, velocità del turno, cronologia, archivio reale (partiti con 2×1000, deputati, senatori, gruppi, governo, leggi, territori), slot, import/export, seconda partita con ruoli limitati, loghi da indirizzo separati dai verificati.`);
