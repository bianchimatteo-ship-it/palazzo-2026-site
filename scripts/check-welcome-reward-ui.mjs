// The thank-you reward of 2.500 € as the PLAYER lives it, in the real page (Chrome), with the real game code and, for the accounts, the real Worker (worker.js with an in-memory D1, scripts/lib/local-worker.mjs).
// The page is made to be the Android app of a promotion build (a Capacitor stand-in that reports 1.0.6 (7) release; every request to the published Worker is redirected to the local one: nothing reaches Production).
// What is proved, scenario by scenario, is what the player sees and what changes: the window of the reward is visible with its title and amount, the PERSONAL funds grow by exactly 2.500 € (never the party
// treasury), the economic ledger holds ONE entry, and nothing is credited twice.
//   A  a NEW account with no career: nothing is credited before a career exists; the first career created through the wizard gets the reward at once (window + funds + ledger)
//   B  a career that existed BEFORE the update, opened for the first time on the promotion build: the reward appears at once, with no need to create another career
//   C  a second career: no second reward
//   D  closing and reopening the app: no new credit
//   E  the same account on another device (and on iOS 1.0.3 (4)): no second reward, even with a brand new career
//   F  an account that had the reward in the past: no new credit
//   G  guests: one reward per installation; the limit after a reinstallation (a guest who clears the data is a new installation) is the declared one
import assert from 'node:assert/strict';
import { chromeAvailable, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.log('Premio di benvenuto (interfaccia): prova saltata, Chrome non trovato.'); process.exit(0); }
const { startLocalWorker } = await import('./lib/local-worker.mjs');
const local = await startLocalWorker({ port: 8791 });
const PROD = 'https://palazzo-2026-site.bianchimatteo657.workers.dev';
const AMOUNT = 2500;
const problems = [];
const ok = (condition, text) => { if (!condition) problems.push(text); };
const report = [];
const NATIVE = `(() => {
  const build = () => { try { return JSON.parse(localStorage.getItem('test.build') || 'null'); } catch { return null; } };
  const native = () => localStorage.getItem('test.native') === '1';
  if (native()) {
    const quiet = new Proxy({}, { get: () => async () => ({}) });
    globalThis.Capacitor = { isNativePlatform: () => true, getPlatform: () => (build()?.platform ?? 'android'), Plugins: new Proxy({ AppodealAds: { buildInfo: async () => ({ version: build()?.version ?? '1.0.6', build: build()?.build ?? '7', debug: false }) } }, { get: (target, key) => target[key] ?? quiet }), registerPlugin: () => quiet };
  }
  // nothing reaches the published Worker from this page: every request to it goes to the local one
  const original = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init) => original(typeof input === 'string' ? input.replace('${PROD}', location.origin) : input, init);
})();`;
try {
  await withBrowser(async ({ evaluate, send, goto, waitFor, pause, viewport, version, screenshot }) => {
    const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    const click = async (selector, wait = 150) => { const done = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`); assert.ok(done, `manca ${selector}`); await pause(wait); };
    const setField = (selector, value, event = 'input') => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('campo mancante ' + ${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true })); return true; })()`);
    const fill = (form, values) => evaluate(`(() => { const form = document.querySelector('[data-account-form="${form}"]'); for (const [name, value] of Object.entries(${JSON.stringify(values)})) form[name].value = value; form.requestSubmit(); return true; })()`);
    const snapshot = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); if (!s.game || !store.hasCareer()) return null; return { funds: s.game.resources.funds, treasury: s.game.party?.org?.treasury ?? null, entries: (s.game.finance?.ledger ?? []).filter(item => /Premio di ringraziamento/.test(item.label)).map(item => ({ amount: item.amount, label: item.label, category: item.category })), flag: Boolean(s.game.flags?.welcomeRewards?.['grazie-aggiornamento-2026-11']), career: s.career.id }; })()`);
    const windowText = () => evaluate(`document.querySelector('.welcome-reward')?.innerText ?? ''`);
    const device = async (build, native = true) => { await evaluate(`localStorage.setItem('test.native', ${native ? "'1'" : "'0'"}); localStorage.setItem('test.build', ${JSON.stringify(JSON.stringify(build))}); true`); };
    const ANDROID = { platform: 'android', version: '1.0.6', build: '7' }, IOS = { platform: 'ios', version: '1.0.3', build: '4' };
    // the page is the app: a stand-in for Capacitor before the game loads (only when the test asks for the native app), and the iOS user agent when the platform is iOS
    await send('Page.addScriptToEvaluateOnNewDocument', { source: NATIVE });
    const reload = async (userAgent = null) => { await send('Emulation.setUserAgentOverride', { userAgent: userAgent ?? 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36' }); await goto(); await waitFor(() => has('[data-menu], .main-menu'), 60000); };
    // a device with nothing on it (a new phone, a reinstalled app): the page is left first, so that the game in memory cannot write itself back; then local storage and IndexedDB are emptied
    const wipe = async () => { await goto('favicon.svg'); await evaluate(`(async () => { localStorage.clear(); sessionStorage.clear(); for (const db of (await indexedDB.databases?.()) ?? []) await new Promise(resolve => { const request = indexedDB.deleteDatabase(db.name); request.onsuccess = request.onerror = request.onblocked = () => resolve(); }); localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })); return true; })()`); };
    const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 PolitikandoApp/ios/1.0.3/4/release';
    await viewport(1280, 900, false);
    await evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })); true`);
    const openAccount = async () => { if (await has('[data-account-form="login"], [data-account-action="refresh"]')) return; await waitFor(() => has('[data-menu="account"]'), 60000); await click('[data-menu="account"]', 200); };
    const register = async (username, password) => { await openAccount(); await waitFor(() => has('[data-account-form="register"], [data-account-form="login"]')); if (!(await has('[data-account-form="register"]'))) { await click('[data-account-switch="register"]', 150).catch(() => {}); } await fill('register', { username, password, confirm: password, ageBand: 'adult14' }); await waitFor(() => has('[data-account-action="logout"], [data-account-action="refresh"]'), 30000); };
    const login = async (username, password) => { await openAccount(); if (await has('[data-account-action="logout"], [data-account-action="refresh"]')) return; await waitFor(() => has('[data-account-form="login"]')); await fill('login', { username, password }); await waitFor(() => has('[data-account-action="logout"], [data-account-action="refresh"]'), 30000); };
    const leaveAccountMenu = async () => { await click('[data-menu="home"], [data-menu-close], .menu-back', 150).catch(() => {}); await goto(); await waitFor(() => has('[data-menu], .main-menu'), 60000); };
    // the real wizard, as a player fills it
    const createCareerByWizard = async (name) => {
      await waitFor(() => has('[data-menu="nuova"]:not([disabled])'), 60000);
      await click('[data-menu="nuova"]:not([disabled])', 400); if (await has('[data-confirm="ok"]')) await click('[data-confirm="ok"]', 400); await waitFor(() => has('.wizard-mode-gate')); await click('[data-wizard-mode="realistica"]', 200); await waitFor(() => has('.career-wizard [name="firstName"]'));
      await setField('.career-wizard [name="firstName"]', name); await setField('.career-wizard [name="lastName"]', 'Premio'); await setField('.career-wizard [name="birthDate"]', '1988-03-02', 'change'); await setField('.career-wizard [name="previousProfession"]', 'Architetta'); await setField('.career-wizard [name="gender"]', 'donna', 'change'); await pause(200);
      await click('.wizard-footer [data-wizard-action="next"]', 300); await waitFor(() => has('[data-wizard-region]'), 30000); await setField('[data-wizard-region]', 'Toscana', 'change'); await waitFor(() => has('[data-wizard-municipality-search]')); await setField('[data-wizard-municipality-search]', 'Siena'); await waitFor(() => has('[data-municipality-code="052032"]')); await click('[data-municipality-code="052032"]', 250);
      await click('.wizard-footer [data-wizard-action="next"]', 300); await click('[data-level="provinciale"]', 200);
      for (let i = 0; i < 3; i++) await click('.wizard-footer [data-wizard-action="next"]', 300);
      await click('.wizard-footer [data-wizard-action="finish"]', 900);
      if (await has('[data-confirm="ok"]')) await click('[data-confirm="ok"]', 600);
      await waitFor(() => evaluate(`Boolean(document.querySelector('.page-wrap')) && !document.querySelector('.career-wizard')`), 60000).catch(async error => { throw new Error(`${error.message}: ${(await evaluate('document.body.innerText')).slice(0, 700)}`); });
    };
    // the player sees the window, reads it, closes it
    const seeWindow = async label => {
      await waitFor(() => has('.welcome-reward'), 15000).catch(() => {});
      const text = await windowText(); ok(/GRAZIE PER GIOCARE A POLITICANDO 2026/.test(text) && /2\.500/.test(text), `${label}: la finestra del premio è visibile con titolo e importo (${JSON.stringify(text.slice(0, 80))}).`);
      return text;
    };
    const closeWindow = async () => { if (await has('.welcome-reward')) { await click('[data-welcome-close]', 300); } ok(!(await has('.welcome-reward')), 'La finestra si chiude con «Continua a giocare».'); };
    const noWindow = async (label, wait = 3500) => { await pause(wait); ok(!(await has('.welcome-reward')), `${label}: nessuna finestra del premio.`); };
    const quiet = async (label, expected, after = null) => { await pause(2500); const now = await snapshot(); ok(now && now.funds === expected.funds && now.entries.length === expected.entries, `${label}: fondi ${now?.funds} (attesi ${expected.funds}), voci del premio ${now?.entries.length} (attese ${expected.entries}).`); return now; };
    const asserted = (label, before, after, credited) => {
      if (credited) {
        ok(after.funds === before.funds + AMOUNT, `${label}: i fondi personali aumentano di esattamente ${AMOUNT} € (${before.funds} → ${after.funds}).`);
        ok(after.treasury === before.treasury, `${label}: la tesoreria del partito non cambia (${before.treasury} → ${after.treasury}).`);
        ok(after.entries.length === 1 && after.entries[0].amount === AMOUNT, `${label}: una sola voce nello storico economico, di ${AMOUNT} € (${JSON.stringify(after.entries)}).`);
        ok(after.flag, `${label}: la carriera registra il premio.`);
      } else { ok(after.funds === before.funds && after.entries.length === before.entries.length, `${label}: nessun accredito (${before.funds} → ${after.funds}).`); }
    };

    // ---------- B. a career that existed before the update, opened for the first time on a promotion build ----------
    await device(ANDROID, false); await goto(); await waitFor(() => has('[data-menu]'), 60000);
    await createCareerByWizard('Bea');   // on the web build: no promotion
    const preB = await snapshot(); ok(preB.entries.length === 0 && !preB.flag, 'B: sul sito la carriera non riceve il premio.');
    await device(ANDROID, true); await reload();
    await waitFor(() => has('[data-menu="continua"]'), 60000); await click('[data-menu="continua"]', 600); await waitFor(() => has('.page-wrap'), 60000);
    await seeWindow('B'); const textB = await windowText(); await screenshot('/tmp/welcome-B.png').catch(() => {}); await closeWindow();
    const afterB = await snapshot(); asserted('B (carriera esistente, ospite)', preB, afterB, true);
    report.push(`B: finestra «${textB.split('\n')[0]}», fondi ${preB.funds} → ${afterB.funds}, voci ${afterB.entries.length}`);
    // D. close and reopen
    await reload(); await waitFor(() => has('[data-menu="continua"]'), 60000); await click('[data-menu="continua"]', 600); await waitFor(() => has('.page-wrap'), 60000); await noWindow('D (riapertura)');
    const afterD = await snapshot(); asserted('D (riapertura)', afterB, afterD, false); report.push(`D: riaperta l’app, fondi ${afterD.funds}, nessuna finestra`);
    // C. a second career on the same installation (guest)
    await goto(); await waitFor(() => has('[data-menu="nuova"]'), 60000); await createCareerByWizard('Carla');
    await noWindow('C (seconda carriera)'); const afterC = await snapshot(); ok(afterC.entries.length === 0 && !afterC.flag, `C: la seconda carriera non riceve un secondo premio (${JSON.stringify(afterC.entries)}).`); report.push(`C: seconda carriera, nessun premio (fondi ${afterC.funds})`);

    // ---------- G. a guest who clears the data is a new installation (the declared limit) ----------
    await wipe(); await device(ANDROID, true); await reload();
    await createCareerByWizard('Gigi'); await seeWindow('G (ospite dopo cancellazione dei dati)'); const afterG = await snapshot(); ok(afterG.entries.length === 1, 'G: l’ospite che cancella i dati è una nuova installazione e riceve il premio una volta (limite dichiarato).'); await closeWindow();
    report.push('G: ospite con dati cancellati = nuova installazione: premio di nuovo (limite dichiarato)');

    // ---------- A. a NEW account with no career ----------
    await wipe(); await device(ANDROID, true); await reload();
    await register('premio.nuovo', 'password-lunga-1');
    await leaveAccountMenu(); await noWindow('A (account nuovo, nessuna carriera)', 3000);
    { const pending = await snapshot(); ok(!pending, `A: senza carriera non esiste nessun saldo da premiare: il premio resta in attesa (${JSON.stringify(pending)}).`); }
    await createCareerByWizard('Anna');
    await seeWindow('A'); const textA = await windowText(); await screenshot('/tmp/welcome-A.png').catch(() => {});
    const fundsOnScreen = await evaluate(`document.body.innerText.includes('Fondi della carriera')`); ok(fundsOnScreen, 'A: la finestra dice che il premio va ai fondi della carriera.');
    const afterA = await snapshot(); ok(afterA.funds >= AMOUNT && afterA.entries.length === 1 && afterA.entries[0].amount === AMOUNT && afterA.flag, `A: fondi ${afterA.funds}, voci ${JSON.stringify(afterA.entries)}.`);
    const startFunds = afterA.funds - AMOUNT; ok(afterA.treasury === (await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); return store.getState().game.party?.org?.treasury ?? null; })()`)), 'A: la tesoreria non è toccata.');
    await closeWindow(); report.push(`A: account nuovo, premio alla prima carriera: finestra «${textA.split('\n')[0]}», fondi ${startFunds} → ${afterA.funds}, una voce da ${AMOUNT} €`);
    // the server holds ONE claim of the account
    const claims = local.sqlite.prepare(`SELECT COUNT(*) AS n FROM reward_community WHERE reward = 'benvenuto' AND user_id = (SELECT id FROM users WHERE username = 'premio.nuovo')`).get().n; ok(claims === 1, `A: il Worker registra una sola riscossione dell’account (${claims}).`);
    // D for the account: reopen
    await reload(); await waitFor(() => has('[data-menu="continua"]'), 60000); await click('[data-menu="continua"]', 800); await waitFor(() => has('.page-wrap'), 60000); await noWindow('D (account)'); const afterAD = await snapshot(); asserted('D (account, riapertura)', afterA, afterAD, false);
    // C for the account: a second career
    await goto(); await waitFor(() => has('[data-menu="nuova"]'), 60000); await createCareerByWizard('Anna Due'); await noWindow('C (account)'); const second = await snapshot(); ok(second.entries.length === 0, 'C: la seconda carriera dell’account non riceve un secondo premio.');

    // ---------- E. the same account on another device, then on iOS 1.0.3 (4) ----------
    await wipe(); await device(ANDROID, true); await reload();
    await login('premio.nuovo', 'password-lunga-1'); await leaveAccountMenu(); await createCareerByWizard('Anna Tablet'); await noWindow('E (altro dispositivo)'); const other = await snapshot(); ok(other.entries.length === 0 && !other.flag, 'E: stesso account su un altro dispositivo, carriera nuova: nessun secondo premio.');
    await wipe(); await device(IOS, true); await reload(IOS_UA);
    await login('premio.nuovo', 'password-lunga-1'); await leaveAccountMenu(); await createCareerByWizard('Anna iPhone'); await noWindow('E (iOS 1.0.3)'); const ios = await snapshot(); ok(ios.entries.length === 0 && !ios.flag, 'E: stesso account su iOS 1.0.3 (4): nessun secondo premio.');
    report.push('E: stesso account su un altro dispositivo e su iOS 1.0.3 (4): nessun secondo premio');

    // ---------- F. an account that already had the reward: another account created, rewarded, then used on a fresh installation ----------
    await wipe(); await device(IOS, true); await reload(IOS_UA);
    await register('premio.passato', 'password-lunga-2'); await leaveAccountMenu(); await createCareerByWizard('Pia'); await seeWindow('F (primo premio, iOS 1.0.3)'); await closeWindow();
    const had = await snapshot(); ok(had.entries.length === 1, 'F: l’account prende il premio una volta (iOS 1.0.3 (4)).');
    await wipe(); await device(ANDROID, true); await reload();
    await login('premio.passato', 'password-lunga-2'); await leaveAccountMenu(); await createCareerByWizard('Pia Android'); await noWindow('F (stesso account, Android)'); const again = await snapshot(); ok(again.entries.length === 0 && !again.flag, 'F: l’account che aveva già ricevuto il premio non lo riceve di nuovo, nemmeno cambiando piattaforma.');
    report.push('F: account già premiato (iOS) → Android con una nuova installazione e una nuova carriera: nessun accredito');

    // ---------- B (account). an account with a career made BEFORE the update: it updates the app, logs in, opens the career: the reward appears at once ----------
    await wipe(); await device({ platform: 'android', version: '1.0.5', build: '6' }, true); await reload();
    await register('premio.esistente', 'password-lunga-3'); await leaveAccountMenu(); await createCareerByWizard('Elia');
    const beforeUpdate = await snapshot(); ok(beforeUpdate.entries.length === 0, 'B (account): con la versione precedente (1.0.5) la carriera non ha il premio.');
    await device(ANDROID, true); await reload(); await login('premio.esistente', 'password-lunga-3'); await leaveAccountMenu();
    await waitFor(() => has('[data-menu="continua"]'), 60000); await click('[data-menu="continua"]', 800); await waitFor(() => has('.page-wrap'), 60000);
    await seeWindow('B (account)'); await closeWindow(); const afterBA = await snapshot(); asserted('B (account con carriera esistente)', beforeUpdate, afterBA, true);
    report.push(`B (account): carriera esistente aperta dopo l’aggiornamento, premio subito: fondi ${beforeUpdate.funds} → ${afterBA.funds}`);

    // ---------- the builds that are not authorised ----------
    await wipe(); await device({ platform: 'ios', version: '1.0.4', build: '5' }, true); await reload('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 PolitikandoApp/ios/1.0.4/5/release');
    await createCareerByWizard('Ugo'); await noWindow('iOS 1.0.4 (5)'); const unauthorised = await snapshot(); ok(unauthorised.entries.length === 0 && !unauthorised.flag, 'iOS 1.0.4 (5) non riceve il premio.');
    report.push('iOS 1.0.4 (5): nessun premio');
  }, { serverPort: 8791, voter: true });
} finally { await local.close?.(); }
assert.deepEqual(problems, [], `Premio di benvenuto, interfaccia e Worker:\n${problems.join('\n')}`);
console.log(`Premio di benvenuto verificato nell’interfaccia (Chrome, codice del gioco e Worker veri, build Android 1.0.6 (7) e iOS 1.0.3 (4) simulate): ${report.join(' | ')}.`);
process.exit(0);
