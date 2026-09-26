// The real first opening on a phone (375 px), in headless Chrome over the DevTools protocol, with real taps
// (mouse events at the centre of each button, so whatever covers a button would receive the tap instead):
// - boot with real collections that fail (coalitions and the ISTAT comuni): the game opens anyway, says what is
//   missing and loads it again with “Riprova”;
// - account service unreachable (the page is served as on workers.dev, where the API is expected, by a static server
//   without the Worker): the welcome offers “Inizia senza account” at once;
// - the local start is remembered after a reload (no second account welcome);
// - the Career Wizard stays above the mobile navigation: its footer, “Continua” and “Inizia carriera” are visible and
//   receive the taps, from the first career and from a new career started inside the game (menu “Altro”);
// - the ISTAT list that fails keeps the wizard usable (reason and “Riprova”) and no comune can be accepted without it;
// - the service worker never caches POST/PUT/DELETE nor the API.
// When Chrome is not installed the check is skipped with a message.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(path => path && existsSync(path));
if (!CHROME) { console.log('Controllo del primo avvio su telefono saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
const PORT = 4600 + Math.floor(Math.random() * 400);
const DEBUG = 9700 + Math.floor(Math.random() * 400);
const HOST = 'politicando-prova.workers.dev';
const ORIGIN = `http://${HOST}:${PORT}`;
const root = fileURLToPath(new URL('..', import.meta.url));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async (check, timeout = 20000, what = 'condizione') => { const start = Date.now(); for (;;) { try { const value = await check(); if (value) return value; } catch { /* not yet */ } if (Date.now() - start > timeout) throw new Error(`Tempo scaduto: ${what}`); await pause(120); } };

const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const profile = await mkdtemp(join(tmpdir(), 'politicando-mobile-'));
// The host of the published Worker is mapped on the local server: the game looks for its account API there and finds
// a static server instead (the service “does not answer”). The origin is treated as secure, as the real https one.
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--mute-audio', '--no-proxy-server', `--host-resolver-rules=MAP ${HOST} 127.0.0.1`, `--unsafely-treat-insecure-origin-as-secure=${ORIGIN}`, ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), 'about:blank'], { stdio: 'ignore' });
const cleanup = async () => { chrome.kill('SIGKILL'); server.kill('SIGKILL'); await pause(200); await rm(profile, { recursive: true, force: true }).catch(() => {}); };

const checks = [];
const ok = (condition, message) => { if (!condition) throw new Error(message); checks.push(message); };
let exitCode = 0;
try {
  await waitFor(() => fetch(`http://127.0.0.1:${PORT}/index.html`).then(response => response.ok), 20000, 'server locale');
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${DEBUG}/json/list`)).json()).find(item => item.type === 'page'), 20000, 'Chrome');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  // Requests of the files that must fail (a collection and the ISTAT comuni) while `failing` is on.
  let failing = true;
  const failed = new Set();
  const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
  socket.onmessage = message => {
    const data = JSON.parse(message.data);
    if (data.id && pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); data.error ? reject(new Error(data.error.message)) : resolve(data.result); return; }
    if (data.method === 'Fetch.requestPaused') {
      const { requestId, request } = data.params;
      const file = new URL(request.url).pathname.split('/').pop();
      if (failing) { failed.add(file); send('Fetch.failRequest', { requestId, errorReason: 'ConnectionFailed' }).catch(() => {}); }
      else send('Fetch.continueRequest', { requestId }).catch(() => {});
    }
  };
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
  const text = () => evaluate('document.querySelector("#app").innerText');
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  // A real tap: the element must be on screen and be the one found at its centre (nothing covering it).
  const tap = async (selector, { scroll = false } = {}) => {
    const box = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return { missing: true };
      ${scroll ? 'el.scrollIntoView({ block: "center" });' : ''}
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      const cover = hit && !el.contains(hit) ? (hit.closest('nav, .mobile-sheet, .mobile-tabbar, [class]')?.className || hit.tagName) : null;
      return { x, y, top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: innerWidth, vh: innerHeight, cover: cover ? String(cover) : null };
    })()`);
    if (box.missing) throw new Error(`Elemento non trovato: ${selector}`);
    if (box.top < 0 || box.left < 0 || box.bottom > box.vh + 0.5 || box.right > box.vw + 0.5) throw new Error(`${selector} non è tutto sullo schermo (${Math.round(box.top)}–${Math.round(box.bottom)} su ${box.vh} px).`);
    if (box.cover) throw new Error(`${selector} è coperto da «${box.cover}»: il tocco non gli arriva.`);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
    await pause(250);
  };
  const setField = (selector, value, event = 'input') => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true })); return true; })()`).then(() => pause(250));
  const tabbarShown = () => evaluate('(() => { const bar = document.querySelector(".mobile-tabbar"); return Boolean(bar) && getComputedStyle(bar).display !== "none"; })()');

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 740, deviceScaleFactor: 2, mobile: true });
  // The page asks the network directly while files are made to fail (the service worker would otherwise answer from
  // its own copy, as it does for a player offline); it is back in play for the last part.
  await send('Network.enable');
  await send('Network.setBypassServiceWorker', { bypass: true });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*coalitions.json*' }, { urlPattern: '*municipalities.json*' }] });

  // ---------- 1. first opening: a real collection fails, the account service does not answer ----------
  const started = Date.now();
  await send('Page.navigate', { url: `${ORIGIN}/` });
  await waitFor(() => has('.main-menu'), 20000, 'menu principale');
  ok(failed.has('coalitions.json'), 'La collezione delle coalizioni è stata fatta fallire.');
  ok(/Alcuni dati reali non sono disponibili:[\s\S]*coalizioni/.test(await text()), 'Boot con una collezione reale fallita: il gioco si apre e dice cosa manca.');
  ok((await text()).includes('Prima di iniziare: il tuo account'), 'Primo avvio reale: parte il benvenuto.');
  await waitFor(async () => (await text()).includes('Il servizio account non risponde'), 8000, 'servizio account non raggiungibile');
  ok(Date.now() - started < 12000, 'Il servizio account non raggiungibile è riconosciuto in pochi secondi.');
  ok(await has('.welcome-points ~ .setting-actions [data-menu-action="start-local"], [data-menu-action="start-local"]'), 'API account non raggiungibile: “Inizia senza account” subito disponibile.');
  await tap('[data-menu-action="start-local"]', { scroll: true });
  await waitFor(() => has('.career-wizard'), 10000, 'Career Wizard');
  ok(!(await tabbarShown()), 'Con il wizard aperto la barra di navigazione mobile non è visibile.');

  // ---------- 2. the ISTAT comuni do not arrive: the wizard stays usable, no comune is accepted without them ----------
  await waitFor(async () => (await text()).includes('L’elenco ISTAT dei comuni non è stato caricato'), 10000, 'errore ISTAT nel wizard');
  ok(await has('.career-wizard [data-wizard-retry-data]'), 'Elenco ISTAT non caricato: il wizard offre “Riprova”.');
  await setField('[data-wizard-region]', 'Toscana', 'change');
  await tap('.wizard-footer [data-wizard-action="next"]');
  ok((await text()).includes('L’elenco ISTAT dei comuni non è ancora disponibile') && await has('.career-wizard'), 'Senza elenco ISTAT nessun comune viene accettato (nessun comune inventato).');
  failing = false;
  await tap('.career-wizard [data-wizard-retry-data]', { scroll: true });
  await waitFor(() => has('[data-municipality-code]'), 15000, 'comuni ISTAT dopo “Riprova”');
  ok(true, '“Riprova” carica l’elenco ISTAT e il wizard prosegue.');

  // ---------- 3. the local start lasts after a reload ----------
  await send('Page.reload');
  await waitFor(() => has('.main-menu'), 20000, 'menu dopo il ricaricamento');
  await pause(600);
  ok(!(await text()).includes('Prima di iniziare: il tuo account'), 'Avvio locale persistente: dopo il ricaricamento non torna il benvenuto account.');
  ok(!(await has('.data-alert')), 'Ricaricando, le collezioni tornate disponibili non sono più segnalate.');
  await tap('[data-menu="nuova"]', { scroll: true });
  await waitFor(() => has('.career-wizard'), 10000, 'wizard da “Nuova carriera”');
  ok(!(await text()).includes('Prima di iniziare'), 'Nuova carriera senza passare di nuovo dall’account.');

  // ---------- 4. the whole first career on the phone, with real taps on the wizard footer ----------
  await waitFor(() => has('[data-wizard-region]'), 10000, 'passaggio Dove');
  await setField('[data-wizard-region]', 'Toscana', 'change');
  await waitFor(() => has('[data-wizard-municipality-search]'), 10000, 'ricerca comune');
  await setField('[data-wizard-municipality-search]', 'Siena');
  await waitFor(() => has('[data-municipality-code="052032"]'), 10000, 'Siena nell’elenco');
  await tap('[data-municipality-code="052032"]', { scroll: true });
  for (let step = 1; step <= 4; step++) {
    await tap('.wizard-footer [data-wizard-action="next"]');
    ok(await evaluate(`document.querySelector('.wizard-kicker')?.textContent.includes('0${step + 1}')`), `Wizard su telefono: “Continua” del passaggio ${step} ricevuto.`);
  }
  await setField('.career-wizard [name="firstName"]', 'Prova');
  await setField('.career-wizard [name="lastName"]', 'Telefono');
  await setField('.career-wizard [name="birthDate"]', '1985-04-12', 'change');
  await setField('.career-wizard [name="previousProfession"]', 'Insegnante');
  await tap('.wizard-footer [data-wizard-action="finish"]');
  await waitFor(async () => !(await has('.career-wizard')) && await has('.page-wrap'), 15000, 'carriera avviata');
  ok(await tabbarShown(), '“Inizia carriera” toccato su 375 px: la carriera parte e torna la navigazione mobile.');

  // ---------- 5. a new career from inside the game, through the mobile menu ----------
  await tap('[data-mobile-more]');
  ok(await evaluate('!document.querySelector("[data-mobile-sheet]").hidden'), 'Il foglio “Altro” si apre.');
  await tap('.mobile-sheet [data-nav="impostazioni"]');
  await waitFor(() => has('[data-action="new-career"]'), 10000, 'Impostazioni');
  await tap('[data-action="new-career"]', { scroll: true });
  await waitFor(() => has('.career-wizard'), 10000, 'wizard dalla partita');
  ok(!(await tabbarShown()) && await evaluate('!document.querySelector(".mobile-sheet") || getComputedStyle(document.querySelector(".mobile-sheet")).display === "none"'), 'Nuova carriera da telefono: barra e foglio mobile non coprono il wizard.');
  const layering = await evaluate('Number(getComputedStyle(document.querySelector(".wizard-backdrop")).zIndex) > Math.max(Number(getComputedStyle(document.querySelector(".mobile-tabbar")).zIndex) || 0, Number(getComputedStyle(document.querySelector(".mobile-sheet")).zIndex) || 0)');
  ok(layering, 'Il wizard sta sopra barra e foglio mobile anche come livelli (z-index).');
  await tap('.wizard-footer [data-wizard-action="next"]');
  ok((await text()).includes('Scegli la regione in cui iniziare'), 'Il footer del wizard riceve il tocco anche dentro la partita.');
  await tap('.wizard-footer [data-wizard-action="cancel"]');
  await waitFor(async () => !(await has('.career-wizard')), 5000, 'chiusura wizard');

  // ---------- 6. service worker: only GET files of the site, never the API nor other methods ----------
  await send('Network.setBypassServiceWorker', { bypass: false });
  const sw = await waitFor(() => evaluate('navigator.serviceWorker?.controller ? true : navigator.serviceWorker?.ready.then(() => Boolean(navigator.serviceWorker.controller))'), 15000, 'service worker attivo').catch(() => false);
  if (!sw) { await send('Page.reload'); await waitFor(() => has('.main-menu, .app-shell'), 20000, 'pagina dopo il ricaricamento'); }
  const cache = await evaluate(`(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i++) await new Promise(resolve => setTimeout(resolve, 100));
    if (!navigator.serviceWorker.controller) return { controlled: false };
    for (const method of ['POST', 'PUT', 'DELETE']) await fetch('/api/saves/c-prova', { method, headers: { 'content-type': 'application/json' }, body: method === 'DELETE' ? undefined : '{}' }).catch(() => null);
    await fetch('/api/account/status').catch(() => null);
    await fetch('/api/saves', { headers: { authorization: 'Bearer prova' } }).catch(() => null);
    await fetch('/src/core/time.js?cache-check=1').catch(() => null);
    await new Promise(resolve => setTimeout(resolve, 800));
    const names = await caches.keys();
    const urls = [];
    for (const name of names) for (const request of await (await caches.open(name)).keys()) urls.push(request.method + ' ' + new URL(request.url).pathname);
    return { controlled: true, names, urls };
  })()`);
  ok(cache.controlled, 'Il service worker controlla la pagina.');
  ok(cache.urls.some(url => url.startsWith('GET /src/')), 'Il service worker conserva i file del gioco (GET).');
  ok(!cache.urls.some(url => url.includes('/api/')), 'Service worker: nessuna richiesta API (POST, PUT, DELETE o GET) in cache.');
  ok(cache.urls.every(url => url.startsWith('GET ')), 'Service worker: in cache solo richieste GET.');
  ok(cache.names.every(name => name === 'politicando-offline-v2'), 'Le cache della versione precedente sono eliminate.');
} catch (error) {
  exitCode = 1;
  console.error(`Primo avvio su telefono: ${error.message}\nVerificati prima dell’errore:\n- ${checks.join('\n- ')}`);
} finally {
  await cleanup();
}
if (!exitCode) console.log(`Primo avvio su telefono verificato in Chrome (375 px, tocchi reali): ${checks.length} controlli — boot con collezioni reali fallite e “Riprova”, servizio account non raggiungibile con “Inizia senza account” immediato, avvio locale persistente dopo il ricaricamento, wizard sopra la navigazione mobile con footer, “Continua” e “Inizia carriera” cliccabili (prima carriera e nuova carriera dal menu “Altro”), elenco ISTAT non caricato senza comuni inventati, service worker senza cache di POST/PUT/DELETE né dell’API.`);
process.exit(exitCode);
