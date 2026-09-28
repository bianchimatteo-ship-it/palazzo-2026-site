// The campaign's selects in a real browser (headless Chrome over the DevTools protocol, keys and clicks), after the
// “Tema” select that jumped back to another theme and could not be chosen: the page is drawn again in full at every
// change of the game and when a notice ends, and every redraw rebuilt the select with the strategy's theme.
// - setup: the theme picked survives a redraw and goes with the player into the campaign;
// - campaign: while a notice ends nothing is drawn again under the player (the same select stays in the page); the
//   theme picked for the activities survives an activity (which uses it) and a change of strategy with another theme;
// - the choices are saved with the game: they come back after a reload of the page and with a saved game (slot);
// - one listener for each kind of event on the page, however many redraws.
// When Chrome is not installed the check is skipped with a message.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(path => path && existsSync(path));
if (!CHROME) { console.log('Controllo dei select della campagna saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
const PORT = 4600 + Math.floor(Math.random() * 400);
const DEBUG = 9300 + Math.floor(Math.random() * 400);
const root = fileURLToPath(new URL('..', import.meta.url));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async (check, timeout = 20000, what = 'condizione') => { const start = Date.now(); for (;;) { try { const value = await check(); if (value) return value; } catch { /* not yet */ } if (Date.now() - start > timeout) throw new Error(`Tempo scaduto: ${what}`); await pause(120); } };

const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const profile = await mkdtemp(join(tmpdir(), 'politicando-campagna-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--mute-audio', '--no-proxy-server', ...(process.getuid?.() === 0 ? ['--no-sandbox'] : [])], { stdio: 'ignore' });
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
  const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
  socket.onmessage = message => { const data = JSON.parse(message.data); if (data.id && pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); data.error ? reject(new Error(data.error.message)) : resolve(data.result); } };
  const evaluate = async (expression, commandLine = false) => { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, includeCommandLineAPI: commandLine }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
  const q = selector => JSON.stringify(selector);
  const valueOf = selector => evaluate(`document.querySelector(${q(selector)})?.value ?? null`);
  const click = selector => evaluate(`(() => { const el = document.querySelector(${q(selector)}); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`);
  // The select is marked: a redraw replaces it with a new one without the mark.
  const mark = selector => evaluate(`(() => { const el = document.querySelector(${q(selector)}); if (el) el.__kept = true; return Boolean(el); })()`);
  const kept = selector => evaluate(`Boolean(document.querySelector(${q(selector)})?.__kept)`);
  // The page at rest: nothing drawn again for 400 ms (after a navigation the data of the page can still arrive).
  const settle = () => evaluate(`new Promise(resolve => { let timer; const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(done, 400); }); const done = () => { observer.disconnect(); resolve(true); }; observer.observe(document.getElementById('app'), { childList: true, subtree: true }); timer = setTimeout(done, 400); })`);
  // A choice as the player makes it: the select has the focus and the arrow keys move to the next themes.
  const pick = async (selector, steps = 1) => {
    await settle();
    ok(await evaluate(`(() => { const el = document.querySelector(${q(selector)}); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.focus(); return document.activeElement === el; })()`), `Il select ${selector} riceve il fuoco.`);
    const before = await valueOf(selector);
    for (let step = 0; step < steps; step++) {
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40 });
      await pause(120);
    }
    const after = await valueOf(selector);
    ok(after && after !== before, `Con i tasti il select ${selector} passa a un altro tema (${before} → ${after}).`);
    return after;
  };
  const campaign = () => evaluate(`import('/src/core/store.js?v=' + document.querySelector('script[type=module]').src.split('v=')[1]).then(({ store }) => { const c = store.getState().campaign; return c ? { id: c.id, status: c.status, strategy: c.strategy, preparation: c.preparationByTopic, salient: c.nationalContext?.salientTopic } : null; })`);
  // The page opened again from scratch (reload, “Continua”), on the campaign's tab.
  const reopen = async () => {
    await send('Page.navigate', { url: base });
    await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'), 30000, 'Continua dopo il ricaricamento');
    await click('[data-menu=continua]');
    await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))'), 20000, 'pagina di gioco');
    await click('[data-nav=elezioni]');
    await waitFor(() => evaluate('Boolean(document.querySelector("[data-section-tab=elezioni][data-section-tab-value=campagna]"))'), 10000, 'scheda Campagna');
    await click('[data-section-tab=elezioni][data-section-tab-value=campagna]');
  };
  const inStore = body => evaluate(`import('/src/core/store.js?v=' + document.querySelector('script[type=module]').src.split('v=')[1]).then(({ store }) => { ${body} })`);
  const listeners = () => evaluate(`(() => { const all = getEventListeners(document.getElementById('app')); return Object.fromEntries(Object.entries(all).map(([type, list]) => [type, list.length])); })()`, true);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const base = `http://127.0.0.1:${PORT}/`;
  await send('Page.navigate', { url: base });
  await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu], .main-menu"))'), 30000, 'menu principale');
  // A comunale career created through the game's own store, brought to the opening of its candidacies.
  const version = await evaluate('document.querySelector("script[type=module]").src.split("v=")[1]');
  await evaluate(`(async () => {
    localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true }));
    const { store } = await import('/src/core/store.js?v=${version}');
    const real = await import('/src/data/repositories/real-data.js?v=${version}');
    await real.loadRealDatabase();
    await real.loadRealCollections(['parties', 'politicalMovements', 'parliamentaryGroups']);
    const party = real.realDatabase.parties.find(item => item.id === 'party-registro-p1-2017-41-ir') ?? real.realDatabase.parties[0];
    store.createCareer({ firstName: 'Prova', lastName: 'Campagna', birthDate: '1983-04-04', gender: 'donna', region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', provinceCode: '052', provinceName: 'Siena', provinceType: 'Provincia', previousProfession: 'Insegnante', initialLevel: 'comunale', partyMode: 'existing', partyId: party.id, parliamentaryGroupId: '', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, real.realDatabase.parties, real.realDatabase.parliamentaryGroups);
    store.fastForwardToElection('comunale');
    store.save();
    return true;
  })()`);
  await send('Page.navigate', { url: base });
  await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'), 30000, 'Continua');
  await click('[data-menu=continua]');
  await waitFor(() => evaluate('Boolean(document.querySelector(".page-wrap"))'), 20000, 'pagina di gioco');
  const initialListeners = await listeners();
  ok(initialListeners.change === 1 && initialListeners.click >= 1, `Un solo ascoltatore “change” sulla pagina (${JSON.stringify(initialListeners)}).`);

  // 1. Setup: the theme picked survives a redraw of the page.
  await click('[data-nav=elezioni]');
  await waitFor(() => evaluate('Boolean(document.querySelector("[data-section-tab=elezioni][data-section-tab-value=campagna]"))'), 10000, 'scheda Campagna');
  await click('[data-section-tab=elezioni][data-section-tab-value=campagna]');
  const SETUP = '[data-campaign-setup="topicId"]';
  await waitFor(() => evaluate(`Boolean(document.querySelector(${q(SETUP)}))`), 10000, 'impostazione della campagna');
  const setupTopic = await pick(SETUP, 2);
  await mark(SETUP);
  await click('[data-section-tab=elezioni][data-section-tab-value=campagna]');
  await waitFor(async () => !(await kept(SETUP)), 5000, 'ridisegno dell’impostazione');
  ok(await valueOf(SETUP) === setupTopic, `Impostazione: il tema scelto resta dopo il ridisegno (${await valueOf(SETUP)}, atteso ${setupTopic}).`);
  await reopen();
  await waitFor(() => evaluate(`Boolean(document.querySelector(${q(SETUP)}))`), 10000, 'impostazione dopo il ricaricamento');
  ok(await valueOf(SETUP) === setupTopic, `Impostazione: il tema scelto resta dopo il ricaricamento della pagina (${await valueOf(SETUP)}).`);

  // 2. The campaign starts (strategy “Consolida la base”, no theme of its own): the theme of the setup goes with it.
  ok(await click('[data-action=campaign-start]'), 'Il pulsante “Inizia la campagna” c’è.');
  const TOPIC = '[data-campaign-topic]';
  await waitFor(() => evaluate(`Boolean(document.querySelector(${q(TOPIC)}))`), 10000, 'campagna attiva');
  const started = await campaign();
  ok(started?.status === 'active', 'La campagna è attiva.');
  ok(await valueOf(TOPIC) === setupTopic, `Campagna: il select del tema parte dal tema scelto nell’impostazione (${await valueOf(TOPIC)}, atteso ${setupTopic}; strategia ${started.strategy?.topicId ?? 'senza tema'}, tema del dibattito ${started.salient}).`);

  // 3. While the notice of the start is on screen the player picks another theme: when the notice ends the page is not
  // drawn again under the select.
  ok(await evaluate('Boolean(document.querySelector(".toast"))'), 'L’avviso di inizio campagna è sullo schermo mentre si sceglie.');
  const topic = await pick(TOPIC, 3);
  await mark(TOPIC);
  await waitFor(() => evaluate('!document.querySelector(".toast")'), 8000, 'fine dell’avviso');
  await pause(600);
  ok(await kept(TOPIC), 'Alla fine dell’avviso il select del tema non viene ricreato (nessun ridisegno sotto il giocatore).');
  ok(await valueOf(TOPIC) === topic, `Alla fine dell’avviso il tema resta ${topic}.`);

  // 4. An activity with that theme: the page is drawn again, the theme stays and the activity used it.
  const activity = await evaluate(`(() => { const buttons = [...document.querySelectorAll('[data-campaign-activity]')].filter(item => !item.disabled); return (buttons.find(item => item.dataset.campaignActivity === 'debate_prep') ?? buttons[0])?.dataset.campaignActivity ?? null; })()`);
  ok(activity, 'C’è un’attività disponibile.');
  await click(`[data-campaign-activity="${activity}"]`);
  await waitFor(async () => !(await kept(TOPIC)), 5000, 'ridisegno dopo l’attività');
  ok(await valueOf(TOPIC) === topic, `Dopo l’attività (${activity}) il tema resta ${topic} (${await valueOf(TOPIC)}).`);
  if (activity === 'debate_prep') ok(((await campaign()).preparation?.[topic] ?? 0) > 0, `La preparazione è andata sul tema scelto (${topic}).`);
  await mark(TOPIC);
  await pause(5000);
  ok(await kept(TOPIC) && await valueOf(TOPIC) === topic, 'Nei 5 secondi dopo l’attività il select non viene ricreato e il tema non cambia.');

  // 5. A change of strategy with another theme: the strategy takes its theme, the activities keep the player's one.
  const STRATEGY_TOPIC = '[data-campaign-strategy-topic]';
  await evaluate(`(() => { const details = document.querySelector('.campaign-strategy-change'); details.open = true; details.scrollIntoView({ block: 'center' }); return true; })()`);
  await click('input[name="campaign-strategy-live"][value="temi"]');
  const current = await valueOf(STRATEGY_TOPIC);
  let strategyTopic = await pick(STRATEGY_TOPIC, 1);
  if (strategyTopic === topic) strategyTopic = await pick(STRATEGY_TOPIC, 1);
  ok(strategyTopic !== current, 'Il tema della strategia è un altro.');
  await click('[data-campaign-strategy-apply]');
  await waitFor(async () => (await campaign())?.strategy?.id === 'temi', 5000, 'nuova strategia');
  const changed = await campaign();
  ok(changed.strategy.topicId === strategyTopic, `La strategia “Temi” usa il tema scelto (${changed.strategy.topicId}, atteso ${strategyTopic}).`);
  await waitFor(() => evaluate(`Boolean(document.querySelector(${q(TOPIC)}))`), 5000, 'campagna ridisegnata');
  ok(await valueOf(TOPIC) === topic, `Dopo il cambio di strategia il tema delle attività resta ${topic} (${await valueOf(TOPIC)}).`);
  ok(await valueOf(STRATEGY_TOPIC) === strategyTopic, `Il select della strategia mostra il suo tema (${await valueOf(STRATEGY_TOPIC)}).`);

  // 6. The choices are saved with the game: after a reload of the page, and with a saved game in a slot.
  const ALLY = '[data-campaign-ally]';
  const allyOptions = await evaluate(`document.querySelector(${q(ALLY)})?.options.length ?? 0`);
  const ally = allyOptions > 1 ? await pick(ALLY, 1) : await valueOf(ALLY);
  await reopen();
  await waitFor(() => evaluate(`Boolean(document.querySelector(${q(TOPIC)}))`), 10000, 'campagna dopo il ricaricamento');
  ok(await valueOf(TOPIC) === topic, `Dopo il ricaricamento il tema delle attività resta ${topic} (${await valueOf(TOPIC)}).`);
  ok(await valueOf(STRATEGY_TOPIC) === strategyTopic, `Dopo il ricaricamento il tema della strategia resta ${strategyTopic} (${await valueOf(STRATEGY_TOPIC)}).`);
  ok(await valueOf(ALLY) === ally, `Dopo il ricaricamento l’avversario scelto resta lo stesso (${await valueOf(ALLY)}).`);
  ok(await evaluate('document.querySelector(\'input[name="campaign-strategy-live"]:checked\')?.value') === 'temi', 'Dopo il ricaricamento la strategia scelta resta selezionata.');
  const slot = await inStore(`return store.saveToSlot('Prova dei select');`);
  const later = await pick(TOPIC, 1);
  ok(later !== topic, 'Dopo il salvataggio nello slot il giocatore sceglie un altro tema.');
  await inStore(`store.loadSlot(${JSON.stringify(slot)}); return true;`);
  await click('[data-nav=elezioni]');
  await waitFor(() => evaluate('Boolean(document.querySelector("[data-section-tab=elezioni][data-section-tab-value=campagna]"))'), 10000, 'scheda Campagna dopo lo slot');
  await click('[data-section-tab=elezioni][data-section-tab-value=campagna]');
  await waitFor(() => evaluate(`Boolean(document.querySelector(${q(TOPIC)}))`), 10000, 'campagna dallo slot');
  ok(await valueOf(TOPIC) === topic, `La partita salvata nello slot riporta il tema scelto al momento del salvataggio (${await valueOf(TOPIC)}, atteso ${topic}).`);

  // 7. However many redraws, the page keeps one listener for each kind of event.
  const finalListeners = await listeners();
  ok(JSON.stringify(finalListeners) === JSON.stringify(initialListeners), `Nessun ascoltatore duplicato dopo i ridisegni (${JSON.stringify(finalListeners)}).`);
} catch (error) {
  exitCode = 1;
  console.error(`Select della campagna: ${error.message}\nVerificati prima dell’errore:\n- ${checks.join('\n- ')}`);
} finally {
  await cleanup();
}
if (!exitCode) console.log(`Select della campagna verificati in Chrome: ${checks.length} controlli — il tema scelto resta dopo i ridisegni (impostazione, inizio campagna, attività, cambio di strategia), le scelte restano dopo il ricaricamento e con una partita salvata nello slot, nessun ridisegno alla fine degli avvisi, un solo ascoltatore per tipo di evento.`);
process.exit(exitCode);
