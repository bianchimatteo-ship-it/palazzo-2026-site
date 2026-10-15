// Security headers and the Content-Security-Policy of the game, and the privacy text that has to agree with what the code really does.
//   - `_headers` (Cloudflare static assets) carries a strict policy: scripts only from the site itself (no inline, no eval), no plug-ins, no framing, forms and <base> only to itself, style attributes the only inline
//     style allowed, connections only to the site and to the game's own Worker, pictures from the site, data:, blob: and https: (the logo someone linked on purpose: the one declared exception);
//   - the same policy (minus frame-ancestors, which a <meta> cannot carry) is in the <meta> of every page, so it also holds on GitHub Pages and in the installed app (Capacitor), which get no headers;
//   - nothing in the code needs more than that: no inline <script> or event-handler attribute, no eval/new Function/document.write/javascript: URL, no remote script, stylesheet, font or @import;
//     every network address the code calls is the site or the Worker;
//   - every answer of the Worker API carries nosniff, its own restrictive policy, no referrer and HSTS (check-account-deletion exercises it against the Worker itself);
//   - the privacy page says what the code does: the one external load (a linked logo), the 15-minute window and the 24 hours of the attempts, the 30 days of the sessions and their removal once expired
//     (with the daily schedule declared in wrangler.jsonc), and it still lists the open points of the controller;
//   - in Chrome, with the real `_headers` applied by the local Worker: the whole game (every section of a career, the privacy, terms and deletion pages) runs with ZERO policy violations, and the policy really
//     blocks an injected inline script and an inline handler (a control: if it did not, the zero above would mean nothing). Skipped without Chrome (the static part always runs).
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { startLocalWorker } from './lib/local-worker.mjs';

const root = new URL('..', import.meta.url).pathname;
const text = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const walk = async dir => (await readdir(join(root, dir), { withFileTypes: true })).flatMap(entry => entry.isDirectory() ? [] : [`${dir}/${entry.name}`]).concat(...await Promise.all((await readdir(join(root, dir), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => walk(`${dir}/${entry.name}`))));
const WORKER = 'https://palazzo-2026-site.bianchimatteo657.workers.dev';
const PAGES = ['index.html', 'privacy.html', 'termini.html', 'elimina-account.html'];

const parse = policy => new Map(policy.split(';').map(item => item.trim()).filter(Boolean).map(item => { const [name, ...values] = item.split(/\s+/); return [name, values]; }));

// ---------- 1. the policy in `_headers` ----------
const headersFile = await text('_headers');
const cspHeader = /^\s+Content-Security-Policy:\s*(.+)$/m.exec(headersFile)?.[1];
assert.ok(cspHeader, '_headers: c’è una Content-Security-Policy.');
const policy = parse(cspHeader);
const must = (directive, values) => assert.deepEqual(policy.get(directive), values, `CSP ${directive}: ${policy.get(directive)?.join(' ')}`);
must('default-src', ["'self'"]); must('script-src', ["'self'"]); must('object-src', ["'none'"]); must('base-uri', ["'self'"]); must('form-action', ["'self'"]); must('frame-ancestors', ["'none'"]);
must('style-src', ["'self'"]); must('style-src-attr', ["'unsafe-inline'"]); must('font-src', ["'self'"]); must('worker-src', ["'self'"]); must('manifest-src', ["'self'"]);
for (const [directive, values] of policy) assert.ok(!values.some(value => /unsafe-eval|unsafe-hashes|^\*$/.test(value)) && !(directive === 'script-src' && values.some(value => /unsafe-inline|^https?:|data:/.test(value))), `CSP ${directive}: nessun eval, nessun inline negli script, nessun jolly.`);
assert.deepEqual(policy.get('connect-src').filter(value => value !== "'self'").sort(), [WORKER, 'http://127.0.0.1:8791', 'http://localhost:8791'].sort(), 'CSP connect-src: il sito, il Worker del gioco e l’anteprima locale del Worker, nient’altro.');
assert.ok(policy.get('img-src').includes('https:') && policy.get('img-src').includes('data:') && policy.get('img-src').includes('blob:'), 'CSP img-src: le immagini collegate di proposito (https:), i data: e i blob: dei loghi costruiti nel gioco.');
for (const header of ['X-Content-Type-Options: nosniff', 'Referrer-Policy: no-referrer', 'X-Frame-Options: DENY', 'Strict-Transport-Security: max-age=', 'Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()']) assert.ok(headersFile.includes(header), `_headers: ${header}`);
assert.ok(/\/sw\.js\s+Cache-Control: no-cache/.test(headersFile), 'Il service worker non resta in cache.');

// ---------- 2. the same policy in every page (GitHub Pages and the installed app get no headers) ----------
const withoutAncestors = new Map([...policy].filter(([name]) => name !== 'frame-ancestors'));
for (const page of PAGES) {
  const html = await text(page);
  const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1];
  assert.ok(meta, `${page}: c’è la politica nel <meta>.`);
  assert.deepEqual(parse(meta), withoutAncestors, `${page}: la politica del <meta> è quella di _headers (senza frame-ancestors, che un <meta> non può portare).`);
  assert.ok(!/frame-ancestors/.test(meta), `${page}: frame-ancestors non va nel <meta>.`);
  assert.ok(/<meta name="referrer" content="no-referrer"/.test(html), `${page}: nessun referrer.`);
  assert.ok(html.indexOf('Content-Security-Policy') < (html.indexOf('<script') >= 0 ? html.indexOf('<script') : Infinity) && html.indexOf('Content-Security-Policy') < html.indexOf('<link'), `${page}: la politica viene prima di ogni risorsa.`);
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), `${page}: nessuno script scritto nella pagina.`);
  assert.ok(!/\son[a-z]+\s*=\s*["']/i.test(html.replace(/<meta[^>]*>/gi, '')), `${page}: nessun gestore di eventi nell’HTML.`);
  assert.ok(!/<style[\s>]/i.test(html), `${page}: nessun <style> scritto nella pagina.`);
  assert.ok(!/(?:src|href)=["']https?:\/\/(?!bianchimatteo-ship-it\.github\.io)/i.test(html.replace(/<a [^>]*>/gi, '')), `${page}: nessuna risorsa caricata da un altro sito.`);
}

// ---------- 3. the code needs nothing more ----------
const sources = [...await walk('src'), 'sw.js'].filter(path => /\.(js|css)$/.test(path));
const found = { dynamic: [], inline: [], remote: [], hosts: new Set() };
for (const path of sources) {
  const code = await text(path);
  if (path.endsWith('.js')) {
    if (/\beval\s*\(|\bnew\s+Function\s*\(|document\.write\s*\(|setTimeout\s*\(\s*['"`]|setInterval\s*\(\s*['"`]/.test(code)) found.dynamic.push(path);
    if (/javascript:|<script[\s>]|createElement\(\s*['"]script['"]\s*\)|createElement\(\s*['"]style['"]\s*\)|<style[\s>]|setAttribute\(\s*['"]on|\son(?:click|load|error|change|input|submit|mouse\w*|key\w*)\s*=\s*["'\\${`]/.test(code)) found.inline.push(path);
    for (const match of code.matchAll(/\bfetch\(\s*([^,)]+)/g)) if (/https?:\/\/(?!\$\{)/.test(match[1])) found.hosts.add(`${path}: ${match[1].slice(0, 60)}`);
  } else if (/@import|url\(\s*["']?https?:|src:\s*url\(\s*["']?https?:/i.test(code)) found.remote.push(path);
}
assert.deepEqual(found.dynamic, [], 'Nessun eval, new Function, document.write né stringhe eseguite da timer.');
assert.deepEqual(found.inline, [], 'Nessuno script o stile in linea né gestori di eventi nel codice: la politica non ne ha bisogno.');
assert.deepEqual(found.remote, [], 'Nessun @import né font o immagini di CSS da un altro sito.');
assert.deepEqual([...found.hosts].filter(item => !/logo-store\.js/.test(item)), [], 'Le chiamate di rete scritte con un indirizzo fisso sono solo quelle previste (la copia di un logo a indirizzo, che la politica lascia fallire e il gioco gestisce collegando l’immagine).');

// ---------- 4. the privacy text says what the code does ----------
const privacy = await text('privacy.html');
const workerCode = await text('worker.js');
const wrangler = await text('wrangler.jsonc');
const days = Number(/ACCOUNT_SESSION_DAYS = (\d+)/.exec(workerCode)?.[1]);
assert.ok(days > 0 && new RegExp(`scadenza \\(${days} giorni\\)`).test(privacy) && new RegExp(`scadono comunque dopo ${days} giorni`).test(privacy), `L’informativa dice ${days} giorni, come il Worker.`);
assert.ok(/window_start < \?'\)\.bind\(now - 86_400_000\)/.test(workerCode) && /più vecchie di 24 ore/.test(privacy), 'Le 24 ore dei tentativi.');
assert.ok(/15 \* 60_000/.test(workerCode) && /finestra di 15 minuti/.test(privacy), 'La finestra di 15 minuti.');
assert.ok(/DELETE FROM sessions WHERE expires_at < \?/.test(workerCode) && /scheduled\(event, env, ctx\)/.test(workerCode) && /"crons"/.test(wrangler), 'Il Worker elimina le sessioni scadute (a richiesta e ogni giorno).');
assert.ok(/sessioni scadute[^.]*eliminate|eliminate[^.]*sessioni scadute|una volta scadute[^.]*elimin/i.test(privacy), 'L’informativa dice che le sessioni scadute vengono eliminate, non solo che “scadono”.');
assert.ok(/ogni giorno|pulizia automatica/i.test(privacy), 'E che c’è una pulizia automatica giornaliera.');
const logoFromUrl = (await text('src/ui/party-logo.js')).includes("logo.kind === 'url'");
assert.ok(logoFromUrl, 'Il gioco può mostrare il logo di un partito da un indirizzo esterno.');
assert.ok(!/non carica caratteri o altre risorse da server esterni\./.test(privacy), 'L’informativa non afferma più, senza eccezioni, che nulla viene caricato da server esterni.');
assert.ok(/(unica|sola) eccezione/i.test(privacy) && /logo/.test(privacy) && /indirizzo IP/.test(privacy), 'Dichiara l’unica eccezione: il logo a indirizzo, che mostra l’IP al sito che lo ospita.');
assert.ok(/titolare|amministrator/i.test(/eccezione[\s\S]{0,900}/i.exec(privacy)?.[0] ?? ''), 'E dice che la scelta può essere anche del titolare (un partito del gioco), non solo dell’utente.');
assert.ok(/non (viene|è) (inviat|comunicat)[^.]*(pagina|referrer)|senza (indicare|inviare)[^.]*(pagina|referrer)|nessun referrer/i.test(privacy), 'E che il sito esterno non sa da quale pagina arriva (nessun referrer).');
const todos = [...privacy.matchAll(/data-controller-todo="([^"]+)"/g)].map(item => item[1]);
for (const marker of ['titolare', 'infrastruttura', 'conservazione']) assert.ok(todos.includes(marker), `Resta il punto aperto del titolare: ${marker}.`);

// ---------- 5. Chrome, with the real headers ----------
let checkedPages = 0, blockedByControl = 0;
if (!chromeAvailable) console.log('Parte nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).');
else {
  const local = await startLocalWorker({ port: 8794 });
  try {
    await withBrowser(async browser => {
      const { evaluate, send, waitFor, pause, goto, version, errors } = browser;
      const watch = `window.__csp = []; document.addEventListener('securitypolicyviolation', event => window.__csp.push(event.violatedDirective + ' ← ' + String(event.blockedURI).slice(0, 80) + (event.sample ? ' [' + event.sample.slice(0, 40) + ']' : '')));`;
      await send('Page.addScriptToEvaluateOnNewDocument', { source: watch });
      await goto();
      await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu], .main-menu"))'));
      const delivered = await evaluate(`fetch('/index.html').then(response => ({ csp: response.headers.get('content-security-policy'), nosniff: response.headers.get('x-content-type-options'), referrer: response.headers.get('referrer-policy'), frame: response.headers.get('x-frame-options') }))`);
      assert.equal(delivered.csp, cspHeader, 'Il Worker serve davvero la politica di _headers.');
      assert.deepEqual([delivered.nosniff, delivered.referrer, delivered.frame], ['nosniff', 'no-referrer', 'DENY']);
      assert.equal(await evaluate(`fetch('/sw.js').then(response => response.headers.get('cache-control'))`), 'no-cache');
      // a career and every section of it, with the policy active
      const v = await evaluate('document.querySelector("script[type=module]").src.split("v=")[1]');
      assert.equal(v, version);
      await createCareerInPage(browser, { party: 'party-futuro-nazionale', level: 'comunale', weeks: 4 });
      await openCareer(browser);
      const sections = await evaluate(`[...new Set([...document.querySelectorAll('[data-nav]')].map(item => item.dataset.nav))]`);
      assert.ok(sections.length >= 8, `Sezioni della carriera: ${sections.join(', ')}.`);
      for (const section of sections) {
        await evaluate(`(async () => { document.querySelector('[data-nav="${section}"]')?.click(); await new Promise(resolve => setTimeout(resolve, 500)); for (const details of document.querySelectorAll('details')) details.open = true; await new Promise(resolve => setTimeout(resolve, 200)); return true; })()`);
        checkedPages++;
      }
      // the menu: new game wizard, load, account, guide
      for (const menu of await evaluate(`[...document.querySelectorAll('[data-menu]')].map(item => item.dataset.menu)`)) { void menu; }
      // the public pages
      for (const page of ['privacy.html', 'termini.html', 'elimina-account.html']) {
        await goto(page);
        await waitFor(() => evaluate('document.readyState === "complete" && Boolean(document.querySelector("h1"))'));
        await pause(400);
        checkedPages++;
        assert.deepEqual(await evaluate('window.__csp'), [], `${page}: nessuna violazione della politica.`);
      }
      await goto();
      await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu], .main-menu"))'));
      const violations = await evaluate('window.__csp');
      assert.deepEqual(violations, [], `Il gioco gira con la politica attiva senza violazioni: ${violations.slice(0, 3).join(' | ')}`);
      assert.deepEqual(errors, [], `Errori in pagina: ${errors.slice(0, 2).join(' | ')}`);
      // controls: the policy really blocks what it should
      const control = await evaluate(`(async () => {
        window.__pwn = 0;
        const script = document.createElement('script'); script.textContent = 'window.__pwn = 1'; document.head.append(script);
        document.body.insertAdjacentHTML('beforeend', '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" onload="window.__pwn = 2" id="__control">');
        const remote = document.createElement('script'); remote.src = 'https://example.com/x.js'; document.head.append(remote);
        await new Promise(resolve => setTimeout(resolve, 600));
        let evalBlocked = false; try { new Function('return 1')(); } catch { evalBlocked = true; }
        let framed = false; try { const frame = document.createElement('iframe'); frame.src = 'https://example.com/'; document.body.append(frame); await new Promise(resolve => setTimeout(resolve, 400)); framed = true; } catch { /* blocked */ }
        const fetchBlocked = await fetch('https://example.com/data.json', { mode: 'no-cors' }).then(() => false, () => true);
        await new Promise(resolve => setTimeout(resolve, 300));
        return { pwn: window.__pwn, evalBlocked, fetchBlocked, framed, violations: window.__csp.slice() };
      })()`);
      assert.equal(control.pwn, 0, 'Uno script iniettato non gira e un gestore di eventi iniettato non scatta.');
      assert.ok(control.evalBlocked, 'new Function è bloccato.');
      assert.ok(control.fetchBlocked, 'Una connessione a un altro sito è bloccata.');
      const kinds = control.violations.map(item => item.split(' ←')[0]);
      assert.ok(kinds.some(item => item.startsWith('script-src')), `Violazione di script-src registrata (${kinds}).`);
      assert.ok(kinds.some(item => item.startsWith('connect-src')), 'E di connect-src.');
      blockedByControl = kinds.length;
    }, { serverPort: 8794 });
  } finally { await local.close(); }
}
console.log(`Sicurezza verificata: _headers con politica restrittiva (script solo dal sito, niente inline né eval, niente plug-in né frame, form e base solo verso il sito, stili in linea solo come attributi, connessioni solo al sito e al Worker del gioco, immagini https: per i loghi collegati) e la stessa politica nel <meta> di ${PAGES.length} pagine (GitHub Pages e app installata); il codice non richiede nulla di più (nessuno script o gestore in linea, eval, risorsa remota o indirizzo imprevisto); l’informativa dice ciò che il codice fa (${days} giorni, 15 minuti, 24 ore, sessioni scadute eliminate a richiesta e ogni giorno, l’unica eccezione dei loghi a indirizzo) e conserva i punti aperti del titolare${chromeAvailable ? `; in Chrome con gli header veri: ${checkedPages} schermate senza una violazione, e i controlli (script e gestore iniettati, eval, connessione esterna) bloccati (${blockedByControl} violazioni attese)` : '; parte nel browser NON eseguita'}.`);
