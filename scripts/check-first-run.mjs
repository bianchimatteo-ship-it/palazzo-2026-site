// First opening: without an account the game starts from a welcome screen that explains the account and leads to it
// before the first career; after the registration a short tour (skippable, shown once) leads to “Inizia nuova
// carriera”. Players already signed in are never asked again. “Come giocare” covers the whole game with examples, and
// sensitive actions use the game's own confirmation dialog, never the browser's confirm(). The account service is
// simulated here: no real account is created.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
const session = new Map();
globalThis.sessionStorage = { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, String(value)), removeItem: key => session.delete(key) };
globalThis.window = { innerWidth: 1200 };
const windowListeners = {};
globalThis.addEventListener = (type, fn) => { (windowListeners[type] ??= []).push(fn); };
globalThis.document = { baseURI: 'http://localhost/', activeElement: null, documentElement: { dataset: {}, style: { setProperty() {} } }, createElement: () => ({ style: {}, dataset: {}, hidden: false, children: [], replaceChildren() {}, append() {} }), createTextNode: text => text, body: { append() {} } };
globalThis.indexedDB = undefined;
globalThis.confirm = () => { throw new Error('Il gioco non deve usare il confirm() del browser.'); };
// The forms of the stand-in DOM carry their values.
globalThis.FormData = class { constructor(form) { return new Map(Object.entries(form.values ?? {})); } };

// Real JSON files from disk; the account service is a stand-in that records the calls (it answers in JSON, as the
// Worker does). The check of the service at the opening (/api/account/status) is recorded apart.
const calls = [];
const probes = [];
let serviceDown = false;
globalThis.fetch = async (url, options = {}) => {
  const href = String(url);
  if (href.startsWith('https://')) {
    const path = new URL(href).pathname;
    if (path === '/api/account/status') probes.push(serviceDown ? 'down' : 'up');
    if (serviceDown) throw new TypeError('fetch failed');
    if (path !== '/api/account/status') calls.push(path);
    const body = ['/api/account/register', '/api/account/login'].includes(path) ? { username: JSON.parse(options.body).username, token: 'token-di-prova' } : path === '/api/saves' ? { saves: [] } : path === '/api/account/status' ? { ok: true, service: 'accounts' } : {};
    return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json; charset=utf-8' }), json: async () => body };
  }
  const body = await readFile(fileURLToPath(new URL(href)), 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const realData = await import(`../src/data/repositories/real-data.js${v}`);
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'twoPerThousand']);
const { store } = await import(`../src/core/store.js${v}`);
store.setRealReference({ twoPerThousand: realData.realDatabase.twoPerThousand, parties: realData.realDatabase.parties, movements: realData.realDatabase.politicalMovements });
const { mountApp } = await import(`../src/ui/app.js${v}`);
const { renderConfirmDialog, TOUR_STEPS } = await import(`../src/ui/menu.js${v}`);

const tick = () => new Promise(resolve => setTimeout(resolve, 5));
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
// A fresh mount of the game on a stand-in root, as when the page is opened.
function open() {
  const listeners = {};
  const root = { innerHTML: '', addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); }, querySelector: () => null, querySelectorAll: () => [] };
  mountApp(root, store);
  const click = async attrs => { for (const fn of listeners.click) await fn({ target: el(attrs), preventDefault() {} }); await tick(); return root.innerHTML; };
  const submit = async (mode, values) => { const form = { dataset: { accountForm: mode }, values, matches: selector => selector === '[data-account-form]' }; for (const fn of listeners.submit) await fn({ target: form, preventDefault() {} }); await tick(); return root.innerHTML; };
  return { root, click, submit };
}
const flags = () => JSON.parse(localStorage.getItem('politicando.onboarding.v1') ?? '{}');
const WELCOME = 'Prima di iniziare: il tuo account';

// ---------- 1. first opening without an account ----------
let game = open();
let page = game.root.innerHTML;
assert.ok(page.includes('main-menu') && page.includes('PRIMO AVVIO') && page.includes(WELCOME), 'Al primo avvio senza account parte il benvenuto.');
await tick();
page = game.root.innerHTML;
assert.deepEqual(probes, ['up'], 'All’apertura il servizio account viene davvero interrogato (non basta un indirizzo).');
assert.ok(!page.includes('data-menu-action="start-local"'), 'Con il servizio raggiungibile l’account viene prima della carriera.');
for (const text of ['Perché serve', 'Salvataggi e sincronizzazione', 'I salvataggi online', 'Nessuna perdita', 'non si perdono', 'Crea un account', 'Ho già un account: accedi']) assert.ok(page.includes(text), `Benvenuto: manca «${text}».`);
page = await game.click({ menu: 'nuova' });
assert.ok(page.includes(WELCOME) && page.includes('Per iniziare una nuova carriera crea il tuo account o accedi') && !page.includes('career-wizard'), 'Senza account la nuova carriera passa prima dall’account.');
page = await game.click({ menu: 'account', accountMode: 'register' });
assert.ok(page.includes('account-forms focus-register') && page.includes('data-account-form="register"'), 'Il pulsante porta alla creazione dell’account.');
page = await game.submit('register', { username: 'prova.primo', password: 'password-lunga', confirm: 'password-diversa' });
assert.ok(page.includes('Le due password non coincidono') && !calls.length, 'Password diverse: nessuna chiamata al servizio.');

// ---------- 2. registration, then the tour (skippable, once) and the first career ----------
page = await game.submit('register', { username: 'prova.primo', password: 'password-lunga', confirm: 'password-lunga' });
assert.ok(calls.includes('/api/account/register'), 'La registrazione passa dal sistema account esistente.');
assert.ok(flags().account === true, 'Il benvenuto è completato.');
assert.ok(page.includes(`COME FUNZIONA · 1 DI ${TOUR_STEPS.length}`) && page.includes('data-tour="skip"'), 'Dopo la registrazione parte il breve onboarding visuale, saltabile.');
page = await game.click({ tour: 'next' });
assert.ok(page.includes(`2 DI ${TOUR_STEPS.length}`) && page.includes('data-tour="prev"'));
page = await game.click({ tour: 'prev' });
assert.ok(page.includes(`1 DI ${TOUR_STEPS.length}`));
for (let step = 1; step < TOUR_STEPS.length; step++) page = await game.click({ tour: 'next' });
assert.ok(page.includes(`${TOUR_STEPS.length} DI ${TOUR_STEPS.length}`) && page.includes('data-tour="finish"') && page.includes('Inizia nuova carriera'), 'L’ultimo passaggio porta a “Inizia nuova carriera”.');
page = await game.click({ tour: 'finish' });
assert.ok(page.includes('career-wizard') && flags().tour === 'done', 'Alla fine del tour si apre la nuova carriera e il tour non si ripete.');

// ---------- 3. signed-in players are never asked again ----------
calls.length = 0;
game = open();
page = game.root.innerHTML;
assert.ok(!page.includes(WELCOME) && !page.includes('COME FUNZIONA'), 'Chi ha già un account non rivede benvenuto né tour.');
page = await game.click({ menu: 'nuova' });
assert.ok(page.includes('career-wizard') && !calls.some(path => path.startsWith('/api/account/')), 'Nuova partita apre subito la carriera, senza nuova registrazione.');

// ---------- 4. another device: sign in, the career starts, no tour ----------
mem.clear(); calls.length = 0;
game = open();
assert.ok(game.root.innerHTML.includes(WELCOME), 'Su un nuovo dispositivo senza account torna il benvenuto.');
await game.click({ menu: 'nuova' });
page = await game.click({ menu: 'account', accountMode: 'login' });
assert.ok(page.includes('account-forms focus-login'));
page = await game.submit('login', { username: 'prova.primo', password: 'password-lunga' });
assert.ok(calls.includes('/api/account/login') && page.includes('career-wizard') && !page.includes('COME FUNZIONA'), 'Dopo l’accesso si prosegue verso la nuova carriera.');

// ---------- 5. skipping the tour ----------
mem.clear();
game = open();
await game.click({ menu: 'account', accountMode: 'register' });
page = await game.submit('register', { username: 'prova.salta', password: 'password-lunga', confirm: 'password-lunga' });
assert.ok(page.includes('COME FUNZIONA · 1 DI'));
page = await game.click({ tour: 'skip' });
assert.ok(!page.includes('COME FUNZIONA') && page.includes('La politica italiana, settimana dopo settimana') && flags().tour === 'done', 'Il tour si può saltare e non si ripete.');
game = open();
assert.ok(!game.root.innerHTML.includes('COME FUNZIONA') && !game.root.innerHTML.includes(WELCOME));

// ---------- 6. account service unreachable: the game can still start in this browser ----------
mem.clear(); serviceDown = true;
game = open();
await tick();
page = game.root.innerHTML;
assert.ok(page.includes(WELCOME) && page.includes('Il servizio account non risponde') && page.includes('data-menu-action="start-local"') && page.includes('data-account-action="probe"'), 'Servizio account non raggiungibile all’apertura: “Inizia senza account” (e “Riprova”) subito, senza passare dai moduli.');
assert.ok(!page.includes('data-account-mode="register"'), 'Con il servizio non raggiungibile non si resta bloccati sulla registrazione.');
page = await game.click({ menu: 'nuova' });
assert.ok(page.includes(WELCOME) && page.includes('data-menu-action="start-local"') && !page.includes('career-wizard') && !page.includes('data-account-form'), 'Con il servizio non raggiungibile “Nuova carriera” propone subito “Inizia senza account”, senza moduli bloccanti.');
serviceDown = false;
page = await game.click({ accountAction: 'probe' });
assert.ok(page.includes('data-account-mode="register"') && !page.includes('Il servizio account non risponde'), '“Riprova”: quando il servizio torna, l’account è di nuovo proposto.');
// The service answered at the opening but stops answering during the registration.
mem.clear();
game = open();
await tick();
await game.click({ menu: 'nuova' });
await game.click({ menu: 'account', accountMode: 'register' });
serviceDown = true;
page = await game.submit('register', { username: 'prova.rete', password: 'password-lunga', confirm: 'password-lunga' });
assert.ok(page.includes('Connessione assente') && page.includes('data-menu-action="start-local"'), 'Se il servizio non risponde si può iniziare senza account.');
page = await game.click({ menuAction: 'start-local' });
assert.ok(page.includes('career-wizard'));
assert.equal(flags().localStart, true, 'La scelta “Inizia senza account” viene ricordata.');
serviceDown = false;
// Reload after the local start: the service answers again, but the player is not sent back to the account welcome.
const reloaded = open();
await tick();
assert.ok(!reloaded.root.innerHTML.includes(WELCOME), 'Avvio locale persistente: al ricaricamento non torna il benvenuto account.');
page = await reloaded.click({ menu: 'nuova' });
assert.ok(page.includes('career-wizard') && !page.includes(WELCOME), 'Dopo l’avvio locale “Nuova carriera” apre subito la carriera.');
await reloaded.click({ wizardAction: 'cancel' });

// ---------- 7. “Come giocare”: short sections with examples ----------
page = await game.click({ wizardAction: 'cancel' });
assert.ok(page.includes('main-menu') && !page.includes('career-wizard'), 'Chiudendo la procedura si torna al menu.');
page = await game.click({ menu: 'guida' });
const sections = ['L’obiettivo', 'Iniziare una partita', 'Il tempo', 'Attività e decisioni', 'Ruoli e poteri', 'Partito', 'Parlamento, governo e leggi', 'Eventi', 'Consenso, sondaggi e media', 'Cittadini e territori', 'Finanze', 'Elezioni', 'Dati reali e simulazione', 'Salvataggi, account e sincronizzazione', 'Cosa cambia nel tempo', 'Difficoltà'];
for (const title of sections) assert.ok(page.includes(`<strong>${title}</strong>`), `Come giocare: manca la sezione «${title}».`);
assert.equal((page.match(/class="guide-card"/g) ?? []).length, sections.length);
assert.equal((page.match(/class="guide-example"/g) ?? []).length, sections.length, 'Ogni sezione ha un esempio concreto.');
assert.ok(page.includes('guide-index') && page.includes('data-guide-jump="guida-0"'), 'Indice delle sezioni.');
for (const text of ['Regione e Comune', 'difficoltà', '6 giorni', 'Chiudi la settimana', 'scelta più passiva', 'commissione', 'sondaggio della carriera è reale', 'simulati', 'fondi', 'candidatura', 'copia online']) assert.ok(page.includes(text), `Come giocare: manca «${text}».`);
await game.click({ guideJump: 'guida-3' });

// ---------- 8. the confirmation dialog ----------
assert.equal(renderConfirmDialog(null), '');
const dialog = renderConfirmDialog({ kicker: 'PROVA', title: 'Eliminare?', body: 'Non si può annullare.', details: ['Prima riga', ''], option: 'Non chiedere più', confirmLabel: 'Elimina', tone: 'danger' });
for (const text of ['role="alertdialog"', 'aria-modal="true"', 'confirm-dialog tone-danger', 'Eliminare?', 'Non si può annullare.', '<li>Prima riga</li>', 'data-confirm-option', 'data-confirm="cancel"', 'Annulla', 'data-confirm="ok"', 'Elimina']) assert.ok(dialog.includes(text), `Conferma: manca ${text}.`);
assert.ok(!dialog.includes('<li></li>'), 'Righe vuote omesse.');
const sources = [];
for (const dir of ['../src/ui/', '../src/core/']) for (const name of await readdir(new URL(dir, import.meta.url))) if (name.endsWith('.js')) sources.push([name, await readFile(new URL(dir + name, import.meta.url), 'utf8')]);
const browserConfirm = sources.filter(([, text]) => /\b(?:globalThis|window)\.confirm\b|(?<![\w.$])confirm\s*\(/.test(text)).map(([name]) => name);
assert.deepEqual(browserConfirm, [], 'Nessun confirm() del browser nel gioco.');

console.log(`Primo avvio verificato: benvenuto con account (perché serve, sincronizzazione, copie online, nessuna perdita tra dispositivi), nuova carriera solo dopo account (o senza, se il servizio non risponde), registrazione e accesso dal sistema esistente, tour di ${TOUR_STEPS.length} passaggi saltabile e mostrato una volta che porta a “Inizia nuova carriera”, nessuna nuova richiesta a chi è già connesso, guida con ${sections.length} sezioni ed esempi, finestra di conferma del gioco al posto di confirm().`);
