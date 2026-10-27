// Legibility of the territory charts (Sondaggi › Territori) in a real browser (headless Chrome over the DevTools protocol), at eight widths: 320, 375, 390, 430, 520 (the medium line chart), 768, 1024, 1280.
// For the simulated measures and for the real 2022 vote, with the long-name and many-party cases that the page actually shows, it checks that: the page never scrolls sideways;
// no text is smaller than 11.5 px as drawn (SVG text is measured after the viewBox scale); every text has at least 4.5:1 contrast with what is behind it; no text is cut by overflow;
// the tiles of the map are big enough to touch, do not overlap and hold their own text; the legend, the source line and the key of the map are present; the line chart switches
// to its narrow layout on a phone. When Chrome is not installed the check is skipped with a message.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { legibilityAudit } from './lib/legibility.mjs';

const CHROME = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(path => path && existsSync(path));
if (!CHROME) { console.log('Controllo di leggibilità dei grafici territoriali saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
const PORT = 4600 + Math.floor(Math.random() * 300);
const DEBUG = 9700 + Math.floor(Math.random() * 300);
const root = fileURLToPath(new URL('..', import.meta.url));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async (check, timeout = 25000) => { const start = Date.now(); for (;;) { try { const value = await check(); if (value) return value; } catch { /* not yet */ } if (Date.now() - start > timeout) throw new Error('Tempo scaduto'); await pause(150); } };

const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const profile = await mkdtemp(join(tmpdir(), 'politicando-legibility-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--mute-audio', ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), 'about:blank'], { stdio: 'ignore' });
const cleanup = async () => { chrome.kill('SIGKILL'); server.kill('SIGKILL'); await pause(200); await rm(profile, { recursive: true, force: true }).catch(() => {}); };

const AUDIT = legibilityAudit('.polls-page.observatory');

let exitCode = 0;
try {
  await waitFor(() => fetch(`http://127.0.0.1:${PORT}/index.html`).then(response => response.ok));
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${DEBUG}/json/list`)).json()).find(item => item.type === 'page'));
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
  const viewport = (width, height, mobile) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  const base = `http://127.0.0.1:${PORT}/`;
  await send('Page.enable');
  await send('Runtime.enable');
  await viewport(1280, 800, false);
  await send('Page.navigate', { url: base });
  await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu], .main-menu, .language-gate"))'));
  const version = await evaluate('document.querySelector("script[type=module]").src.split("v=")[1]');
  // A career through the game's own store (isolated browser profile: nothing else is touched), a few weeks on so that the regional pictures have a history.
  await evaluate(`(async () => {
    localStorage.setItem('politicando.settings.v1', JSON.stringify({ language: 'it' }));
    localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true }));
    const { store } = await import('/src/core/store.js?v=${version}');
    const real = await import('/src/data/repositories/real-data.js?v=${version}');
    await real.loadRealDatabase();
    await real.loadRealCollections(['parties', 'politicalMovements', 'parliamentaryGroups']);
    const party = real.realDatabase.parties.find(item => item.id === 'party-registro-p1-2017-41-ir');
    store.createCareer({ firstName: 'Prova', lastName: 'Leggibilita', birthDate: '1980-05-05', gender: 'donna', region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', provinceCode: '052', provinceName: 'Siena', provinceType: 'Provincia', previousProfession: 'Insegnante', initialLevel: 'deputato', partyMode: 'existing', partyId: party.id, parliamentStartMode: 'real-context', parliamentaryGroupId: 'cam-xix-03', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, real.realDatabase.parties, real.realDatabase.parliamentaryGroups);
    for (let i = 0; i < 12; i++) store.advanceTurn(1);
    return true;
  })()`);
  await send('Page.navigate', { url: base });
  await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'));
  await evaluate('document.querySelector("[data-menu=continua]").click(), true');
  await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));

  const widths = [[320, 640, true], [375, 812, true], [390, 844, true], [430, 932, true], [520, 900, true], [768, 1024, true], [1024, 768, false], [1280, 800, false]];
  const steps = [
    ['consenso simulato', ''],
    ['scarto dal dato nazionale', 'document.querySelector("[data-view-filter-value=scarto]")?.click()'],
    ['voto reale 2022', 'document.querySelector("[data-view-filter-value=reale]")?.click()'],
    ['nord, mappa di calore', 'document.querySelector("[data-view-filter-value=quota]")?.click(); await new Promise(r => setTimeout(r, 300)); document.querySelector("[data-view-filter=obsArea][data-view-filter-value=nord]")?.click()']
  ];
  const report = [];
  const seenVariants = new Set();
  let checked = 0;
  for (const [width, height, mobile] of widths) {
    await viewport(width, height, mobile);
    await pause(300);
    await evaluate(`(async () => { document.querySelector('[data-nav="sondaggi"]')?.click(); await new Promise(r => setTimeout(r, 700)); document.querySelector('[data-obs-area="territori"]')?.click(); await new Promise(r => setTimeout(r, 600)); return true; })()`);
    if (!(await evaluate('Boolean(document.querySelector(".itmap-tile"))'))) { report.push(`${width}px · la cartina non si apre`); continue; }
    for (const [label, script] of steps) {
      if (script) { await evaluate(`(async () => { ${script}; await new Promise(r => setTimeout(r, 500)); return true; })()`); }
      const result = await evaluate(AUDIT);
      checked++;
      for (const issue of result.issues) report.push(`${width}px · ${label} · ${issue}`);
      if (result.tiles !== 20) report.push(`${width}px · ${label} · tessere: ${result.tiles} invece di 20`);
      if (!result.legend || !result.source || !result.key) report.push(`${width}px · ${label} · legenda (${result.legend}), fonte (${result.source}) o chiave (${result.key}) mancanti`);
    }
    // The line chart of the quadro: the narrow layout on a phone, the wide one from the tablet up.
    await evaluate(`(async () => { document.querySelector('[data-obs-area="quadro"]')?.click(); await new Promise(r => setTimeout(r, 600)); return true; })()`);
    const lines = await evaluate(`(() => { const block = document.querySelector('.trend-chart'); if (!block) return null; const visible = [...block.querySelectorAll('svg')].filter(s => getComputedStyle(s).display !== 'none').map(s => s.getAttribute('class')); return { visible, width: block.getBoundingClientRect().width }; })()`);
    if (lines) {
      const expected = lines.width <= 380 ? 'lc-narrow' : lines.width <= 600 ? 'lc-mid' : 'lc-wide';
      if (lines.visible.length !== 1) report.push(`${width}px · grafico a linee: ${lines.visible.length} impaginazioni visibili invece di una`);
      else if (lines.visible[0] !== expected) report.push(`${width}px · grafico a linee: impaginazione ${lines.visible[0]} invece di ${expected} con larghezza ${Math.round(lines.width)}px`);
      seenVariants.add(lines.visible[0]);
      const result = await evaluate(AUDIT);
      checked++;
      for (const issue of result.issues.filter(item => !item.startsWith('tessere'))) report.push(`${width}px · quadro · ${issue}`);
    }
  }
  for (const variant of ['lc-narrow', 'lc-mid', 'lc-wide']) if (!seenVariants.has(variant)) report.push(`nessuna larghezza ha mostrato l’impaginazione ${variant}`);
  if (errors.length) report.push(`errori JavaScript: ${errors.slice(0, 3).join(' | ')}`);
  if (report.length) {
    console.error(`Leggibilità dei grafici territoriali: ${report.length} problemi.\n${[...new Set(report)].slice(0, Number(process.env.MAX_ISSUES ?? 60)).join('\n')}`);
    exitCode = 1;
  } else console.log(`Leggibilità dei grafici territoriali verificata in Chrome: ${checked} schermate a 320, 375, 390, 430, 520, 768, 1024 e 1280 px (consenso, scarto, voto reale 2022, macro-area con mappa di calore, grafico a linee nelle tre impaginazioni stretta, media e larga): testo non sotto 11,5 px, contrasto almeno 4,5:1, nessun testo tagliato, tessere da almeno 32 px senza sovrapposizioni, legenda, fonte e chiave sempre presenti, nessuno scorrimento orizzontale.`);
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally { await cleanup(); }
process.exit(exitCode);
