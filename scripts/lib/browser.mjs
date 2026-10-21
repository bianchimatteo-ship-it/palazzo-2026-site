// A real browser for the checks that need one: headless Chrome over the DevTools protocol, the game served by server.mjs on a free port, a clean profile (nothing of the
// player's is touched). `withBrowser(callback)` gives the callback { evaluate, send, viewport, goto, waitFor, pause, errors, base, version } and cleans up. When Chrome is not
// installed `chromeAvailable` is false: the checks skip themselves with a message.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CHROME = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(path => path && existsSync(path));
export const chromeAvailable = Boolean(CHROME);
export const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export const waitFor = async (check, timeout = 25000) => { const start = Date.now(); for (;;) { try { const value = await check(); if (value) return value; } catch { /* not yet */ } if (Date.now() - start > timeout) throw new Error('Tempo scaduto'); await pause(150); } };

// `serverPort`: the game is already served there (a test that runs its own server, such as the local Worker of scripts/lib/local-worker.mjs); then no server.mjs is started.
// `fresh`: a new clean Chrome profile is the default; two calls of withBrowser are two browsers that share nothing (no cache, no storage).
export async function withBrowser(callback, { root = fileURLToPath(new URL('../..', import.meta.url)), serverPort = null } = {}) {
  const port = serverPort ?? 4600 + Math.floor(Math.random() * 300), debug = 9700 + Math.floor(Math.random() * 300);
  const server = serverPort ? { kill() {} } : spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  const profile = await mkdtemp(join(tmpdir(), 'politicando-browser-'));
  // Chrome refuses to start its sandbox as root (containers, CI): there it runs without it.
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${debug}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--mute-audio', ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), 'about:blank'], { stdio: 'ignore' });
  const cleanup = async () => { chrome.kill('SIGKILL'); server.kill('SIGKILL'); await pause(200); await rm(profile, { recursive: true, force: true }).catch(() => {}); };
  try {
    await waitFor(() => fetch(`http://127.0.0.1:${port}/index.html`).then(response => response.ok));
    const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${debug}/json/list`)).json()).find(item => item.type === 'page'));
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let id = 0;
    const pending = new Map();
    const errors = [];
    socket.onmessage = message => {
      const data = JSON.parse(message.data);
      if (data.id && pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); data.error ? reject(new Error(data.error.message)) : resolve(data.result); }
      else if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description ?? data.params.exceptionDetails.text);
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
    const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
    const viewport = (width, height, mobile = width < 800) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    const base = `http://127.0.0.1:${port}/`;
    const goto = async (path = '') => { await send('Page.navigate', { url: base + path }); await pause(300); };
    const screenshot = async file => { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(file, Buffer.from(shot.data, 'base64')); };
    await send('Page.enable');
    await send('Runtime.enable');
    await viewport(1280, 800, false);
    await goto();
    await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu], .main-menu"))'));
    const version = await evaluate('document.querySelector("script[type=module]").src.split("v=")[1]');
    return await callback({ evaluate, send, viewport, goto, screenshot, waitFor, pause, errors, base, version });
  } finally { await cleanup(); }
}

// A career created through the game's own store, in the page: `party` and `group` of the database (Lega in the Camera by default), a level and some weeks on.
// The browser then opens on the main menu: `openCareer` presses "Continua".
export async function createCareerInPage({ evaluate, version }, { party = 'party-registro-p1-2017-41-ir', group = 'cam-xix-03', level = 'deputato', weeks = 0, name = ['Prova', 'Verifica'], region = 'Toscana', onboarding = true, extra = '' } = {}) {
  await evaluate(`(async () => {
    ${onboarding ? `localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true }));` : ''}
    const { store } = await import('/src/core/store.js?v=${version}');
    const real = await import('/src/data/repositories/real-data.js?v=${version}');
    await real.loadRealDatabase();
    await real.loadRealCollections(['parties', 'politicalMovements', 'parliamentaryGroups']);
    // The game loads the institutions and the heavy documents a moment after its first screen (src/main.js): a career made straight from the page waits for them, as the creator of a
    // career does (it asks for them and waits), so that it starts with the Government, the electoral map and the calendars of the data set.
    const waitUntil = async (check, ms = 30000) => { const t0 = Date.now(); while (!check() && Date.now() - t0 < ms) await new Promise(resolve => setTimeout(resolve, 100)); };
    await waitUntil(() => ['government', 'politicians', 'parliamentaryGroups', 'localElections', 'electoralGeography'].every(name => real.isRealCollectionLoaded(name)));
    await new Promise(resolve => setTimeout(resolve, 400));
    const party = real.realDatabase.parties.find(item => item.id === ${JSON.stringify(party)});
    store.createCareer({ firstName: ${JSON.stringify(name[0])}, lastName: ${JSON.stringify(name[1])}, birthDate: '1980-05-05', gender: 'donna', region: ${JSON.stringify(region)}, municipality: 'Siena', municipalityCode: '052032', provinceCode: '052', provinceName: 'Siena', provinceType: 'Provincia', previousProfession: 'Insegnante', initialLevel: ${JSON.stringify(level)}, partyMode: 'existing', partyId: party.id, parliamentStartMode: 'real-context', parliamentaryGroupId: ${JSON.stringify(group)}, policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, real.realDatabase.parties, real.realDatabase.parliamentaryGroups);
    for (let i = 0; i < ${weeks}; i++) store.advanceTurn(1);
    ${extra}
    return true;
  })()`);
}
export async function openCareer({ evaluate, goto, waitFor }) {
  await goto();
  await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'));
  await evaluate('document.querySelector("[data-menu=continua]").click(), true');
  await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
}
