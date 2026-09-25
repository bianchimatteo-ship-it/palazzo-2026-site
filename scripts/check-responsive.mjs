// Responsive audit in a real browser (headless Chrome over the DevTools protocol): every section and internal tab at
// phone, tablet and desktop width. A page must never scroll sideways, no element may stick out of the screen (unless
// it lives in a container that scrolls on purpose), no content may be hidden by overflow:hidden and no text may be cut
// with an ellipsis. When Chrome is not installed the audit is skipped with a message.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(path => path && existsSync(path));
if (!CHROME) { console.log('Controllo responsive saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
const PORT = 4187 + Math.floor(Math.random() * 400);
const DEBUG = 9300 + Math.floor(Math.random() * 400);
const root = fileURLToPath(new URL('..', import.meta.url));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async (check, timeout = 20000) => { const start = Date.now(); for (;;) { try { const value = await check(); if (value) return value; } catch { /* not yet */ } if (Date.now() - start > timeout) throw new Error('Tempo scaduto'); await pause(150); } };

const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const profile = await mkdtemp(join(tmpdir(), 'politicando-responsive-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
const cleanup = async () => { chrome.kill('SIGKILL'); server.kill('SIGKILL'); await pause(200); await rm(profile, { recursive: true, force: true }).catch(() => {}); };

let exitCode = 0;
try {
  await waitFor(() => fetch(`http://127.0.0.1:${PORT}/index.html`).then(response => response.ok));
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${DEBUG}/json/list`)).json()).find(item => item.type === 'page'));
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = message => { const data = JSON.parse(message.data); if (data.id && pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); data.error ? reject(new Error(data.error.message)) : resolve(data.result); } };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
  const viewport = (width, height, mobile) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  const base = `http://127.0.0.1:${PORT}/`;
  await send('Page.enable');
  await send('Runtime.enable');
  await viewport(1280, 800, false);
  await send('Page.navigate', { url: base });
  await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu], .main-menu"))'));
  // A parliamentary career created through the game's own store (no account, nothing leaves the browser).
  const version = await evaluate('document.querySelector("script[type=module]").src.split("v=")[1]');
  await evaluate(`(async () => {
    localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true }));
    const { store } = await import('/src/core/store.js?v=${version}');
    const real = await import('/src/data/repositories/real-data.js?v=${version}');
    await real.loadRealDatabase();
    await real.loadRealCollections(['parties', 'politicalMovements', 'parliamentaryGroups']);
    const party = real.realDatabase.parties.find(item => item.id === 'party-registro-p1-2017-41-ir');
    store.createCareer({ firstName: 'Prova', lastName: 'Responsive', birthDate: '1980-05-05', gender: 'donna', region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', provinceCode: '052', provinceName: 'Siena', provinceType: 'Provincia', previousProfession: 'Insegnante', initialLevel: 'deputato', partyMode: 'existing', partyId: party.id, parliamentStartMode: 'real-context', parliamentaryGroupId: 'cam-xix-03', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, real.realDatabase.parties, real.realDatabase.parliamentaryGroups);
    return true;
  })()`);
  await send('Page.navigate', { url: base });
  await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'));
  await evaluate('document.querySelector("[data-menu=continua]").click(), true');
  await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));

  // What is audited: every section, and every internal tab of the redesigned ones.
  const views = [
    ['panoramica'], ['profilo'], ['territori'], ['finanze'], ['sondaggi'], ['governo'], ['leggi'], ['archivio'], ['impostazioni'],
    ...['panoramica', 'candidatura', 'campagna', 'avversari', 'risultati', 'storico'].map(tab => ['elezioni', 'elezioni', tab]),
    ...['percorso', 'progressione', 'incarichi', 'cronologia', 'obiettivi'].map(tab => ['carriera', 'carriera', tab]),
    ...['panoramica', 'ruoli', 'organizzazione', 'territorio', 'storico'].map(tab => ['partito', 'partito', tab]),
    ...['settimana', 'calendario', 'attivita', 'registro'].map(tab => ['calendario', 'agenda', tab]),
    ['parlamento'], ['parlamento', 'hemi', 'commissione'], ['parlamento', 'hemi', 'senato']
  ];
  const audit = `(() => {
    const vw = document.documentElement.clientWidth;
    const issues = [];
    const over = document.documentElement.scrollWidth - vw;
    if (over > 1) issues.push({ kind: 'pagina', el: 'html', detail: 'scorrimento orizzontale di ' + over + ' px' });
    const describe = el => el.tagName.toLowerCase() + [...el.classList].slice(0, 3).map(name => '.' + name).join('');
    const scrolls = el => { for (let node = el.parentElement; node; node = node.parentElement) { const style = getComputedStyle(node); if (/(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1) return true; } return false; };
    const decorative = el => Boolean(el.closest('[aria-hidden="true"], svg, .illustration, canvas, .visually-hidden, .viz-tip'));
    for (const el of document.querySelectorAll('.app-shell *')) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || decorative(el)) continue;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      if ((box.right > vw + 1 || box.left < -1) && style.position !== 'fixed' && !scrolls(el)) issues.push({ kind: 'fuori schermo', el: describe(el), detail: Math.round(box.left) + '…' + Math.round(box.right) + ' su ' + vw });
      const text = el.textContent.trim();
      if (!text || el.tagName === 'SELECT' || el.tagName === 'OPTION') continue;
      if (/(hidden|clip)/.test(style.overflowX + style.overflowY) && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)) issues.push({ kind: 'nascosto', el: describe(el), detail: text.slice(0, 50) });
      if (style.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) issues.push({ kind: 'troncato', el: describe(el), detail: text.slice(0, 50) });
    }
    const seen = new Set();
    return issues.filter(item => { const key = item.kind + item.el; if (seen.has(key)) return false; seen.add(key); return true; });
  })()`;
  const open = async ([page, section, tab]) => {
    await evaluate(`(async () => {
      const go = document.querySelector('[data-nav="${page}"]');
      if (go && !location.hash.endsWith('${page}')) { go.click(); await new Promise(resolve => setTimeout(resolve, 700)); }
      ${section === 'hemi' ? `
      ${tab === 'senato' ? 'document.querySelector("[data-hemi-chamber=senato]")?.click();' : ''}
      ${tab === 'commissione' ? 'const select = document.querySelector("[data-hemi-filter=committee]"); if (select && select.options.length > 1) { select.value = select.options[1].value; select.dispatchEvent(new Event("change", { bubbles: true })); } await new Promise(resolve => setTimeout(resolve, 300)); document.querySelector(".hemi-members button")?.click();' : ''}` : section ? `document.querySelector('[data-section-tab="${section}"][data-section-tab-value="${tab}"]')?.click();` : ''}
      await new Promise(resolve => setTimeout(resolve, 450));
      return true;
    })()`);
  };
  const overlays = [
    ['menu principale', 'document.querySelector("[data-action=menu]")?.click()', 'document.querySelector("[data-menu=continua]")?.click()', '.main-menu'],
    ['conferma', 'document.querySelector("[data-nav=elezioni]")?.click(); await new Promise(resolve => setTimeout(resolve, 700)); document.querySelector("[data-section-tab=elezioni][data-section-tab-value=panoramica]")?.click(); await new Promise(resolve => setTimeout(resolve, 400)); document.querySelector("[data-game-fastforward]")?.click()', 'document.querySelector("[data-confirm=cancel]")?.click()', '.confirm-dialog'],
    ['resoconto settimanale', 'document.querySelector(".topbar [data-action=advance], [data-action=advance]")?.click(); await new Promise(resolve => setTimeout(resolve, 500)); document.querySelector("[data-confirm=ok]")?.click()', 'document.querySelector("[data-report-close]")?.click()', '.report-modal'],
    ['nuova carriera', 'document.querySelector("[data-nav=impostazioni]")?.click(); await new Promise(resolve => setTimeout(resolve, 600)); document.querySelector("[data-action=new-career]")?.click(); await new Promise(resolve => setTimeout(resolve, 600)); document.querySelector("[data-menu-action=start-local]")?.click()', 'document.querySelector("[data-wizard-action=cancel]")?.click(); await new Promise(resolve => setTimeout(resolve, 400)); document.querySelector("[data-menu=continua]")?.click()', '.career-wizard']
  ];
  const widths = [[375, 812, true, 'telefono'], [768, 1024, true, 'tablet'], [1280, 800, false, 'desktop']];
  const report = [];
  const opened = new Set();
  const missing = new Set();
  let checked = 0;
  for (const [width, height, mobile, label] of widths) {
    await viewport(width, height, mobile);
    await pause(250);
    for (const view of views) {
      await open(view);
      const issues = await evaluate(audit);
      checked++;
      for (const issue of issues) report.push(`${label} · ${view.filter(Boolean).join(' › ')} · ${issue.kind}: ${issue.el} (${issue.detail})`);
    }
    // Leave the hemicycle on the Camera and without filters for the next width.
    await evaluate('document.querySelector("[data-hemi-chamber=camera]")?.click(), document.querySelector("[data-hemi-reset]")?.click(), true').catch(() => {});
    // Dialogs and overlays: main menu, a confirmation, the weekly report, the new-career wizard.
    for (const [name, openScript, closeScript, selector] of overlays) {
      const shown = await evaluate(`(async () => { ${openScript}; await new Promise(resolve => setTimeout(resolve, 600)); return Boolean(document.querySelector('${selector}')); })()`).catch(() => false);
      if (!shown) { missing.add(name); continue; }
      opened.add(name);
      const issues = await evaluate(audit);
      checked++;
      for (const issue of issues) report.push(`${label} · ${name} · ${issue.kind}: ${issue.el} (${issue.detail})`);
      await evaluate(`(async () => { ${closeScript}; await new Promise(resolve => setTimeout(resolve, 500)); return true; })()`).catch(() => {});
    }
  }
  if (missing.size) report.push(`finestre non aperte durante il controllo: ${[...missing].join(', ')}`);
  if (report.length) {
    exitCode = 1;
    console.error(`Controllo responsive: ${report.length} problemi su ${checked} schermate.\n- ${report.slice(0, 80).join('\n- ')}${report.length > 80 ? `\n… e altri ${report.length - 80}` : ''}`);
  } else console.log(`Responsive verificato con Chrome: ${checked} schermate (${views.length} viste e ${opened.size} finestre: ${[...opened].join(', ')} × telefono 375 px, tablet 768 px, desktop 1280 px) senza scorrimento orizzontale, elementi fuori schermo, contenuti nascosti da overflow o testi troncati.`);
  socket.close();
} catch (error) {
  exitCode = 1;
  console.error(`Controllo responsive non riuscito: ${error.message}`);
} finally {
  await cleanup();
}
process.exit(exitCode);
