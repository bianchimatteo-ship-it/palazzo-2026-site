// «Popup notizie settimanali» — Attivo / Disattivato. La preferenza è del browser, tranne per l'account che ha fatto l'accesso (la sua scelta non tocca quella degli altri account, né il valore del
// browser, né un salvataggio di carriera). Spenta: il popup non compare da solo all'avanzamento, le notizie si generano e restano in Informazione e nella Home, la settimana non viene consumata e
// riaccendendola arriva al massimo il popup (tre notizie recenti) della settimana in corso, mai l'arretrato. Parte 1: impostazioni e motore (Node). Parte 2: Chrome (telefono e computer).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const realFetch = globalThis.fetch; // the engine harness of part 2 serves files instead; the browser part needs the real one
const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { SETTINGS_SCHEMA, loadSettings, saveSetting, resetSettings } = await module('src/core/settings.js');

// ---------- 1. the setting itself ----------
{
  const spec = SETTINGS_SCHEMA.newsPopup;
  assert.equal(spec.label, 'Popup notizie settimanali', 'Il nome dell’interruttore.');
  assert.deepEqual(spec.options, [['on', 'Attivo'], ['off', 'Disattivato']], 'Due stati chiari: Attivo / Disattivato (i valori salvati restano on/off).');
  assert.equal(spec.default, 'on', 'Di default è attivo.');
  assert.equal(loadSettings().newsPopup, 'on', 'Chi non ha mai scelto resta con il popup acceso (nessuna modifica per gli utenti esistenti).');
  assert.equal(loadSettings('account:a').newsPopup, 'on');
  // an old save of the preferences (before the labels changed) keeps working
  localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sound: 'off' }));
  assert.equal(loadSettings().newsPopup, 'off', 'La scelta già fatta da un giocatore esistente è rispettata.');
  assert.equal(loadSettings('account:a').newsPopup, 'off', 'Un account che non ha scelto legge il valore del browser (com’era).');
  localStorage.removeItem('politicando.settings.v1');
  // active / not active, persistence
  assert.equal(saveSetting('newsPopup', 'off').newsPopup, 'off', 'Disattivato.');
  assert.equal(loadSettings().newsPopup, 'off', 'Persistente: una lettura nuova (il riavvio) la trova.');
  assert.equal(saveSetting('newsPopup', 'on').newsPopup, 'on', 'Attivo.');
  assert.throws(() => saveSetting('newsPopup', 'forse'), /non valida/, 'Un valore inventato è rifiutato.');
  assert.equal(loadSettings().newsPopup, 'on');
  // accounts: one never changes another's, nor the browser's value
  resetSettings();
  saveSetting('newsPopup', 'off', 'account:a');
  assert.equal(loadSettings('account:a').newsPopup, 'off', 'L’account A l’ha spento.');
  assert.equal(loadSettings('account:b').newsPopup, 'on', 'L’account B non ne risente.');
  assert.equal(loadSettings().newsPopup, 'on', 'Né chi non ha fatto l’accesso.');
  saveSetting('newsPopup', 'on', 'account:b');
  assert.equal(loadSettings('account:a').newsPopup, 'off', 'La scelta di B non riaccende A.');
  saveSetting('newsPopup', 'off');
  assert.equal(loadSettings('account:b').newsPopup, 'on', 'Quella del browser non spegne chi ha scelto di tenerlo acceso.');
  assert.equal(loadSettings('account:c').newsPopup, 'off', 'Chi non ha scelto segue il browser.');
  // the other preferences stay the browser's, whoever is signed in
  saveSetting('sound', 'off', 'account:a');
  assert.equal(loadSettings('account:b').sound, 'off', 'Le altre preferenze restano di tutto il browser.');
  // a damaged store never breaks the reading
  localStorage.setItem('politicando.settings.scoped.v1', '{non json'); localStorage.setItem('politicando.settings.v1', '[1,2]');
  assert.equal(loadSettings('account:a').newsPopup, 'on', 'Dati rovinati: valori di default, nessun errore.');
  // the reset gives back the signed-in account's own choice only
  resetSettings();
  saveSetting('newsPopup', 'off', 'account:a'); saveSetting('newsPopup', 'off', 'account:b');
  resetSettings('account:a');
  assert.equal(loadSettings('account:a').newsPopup, 'on'); assert.equal(loadSettings('account:b').newsPopup, 'off', 'Ripristinare le impostazioni di A non cambia B.');
  resetSettings();
}

// ---------- 2. the engine: the news are made and kept whatever the setting says; the popup is a view ----------
{
  const { startCareer } = await import(new URL('./lib/long-run.mjs', import.meta.url).href);
  const run = await startCareer({ seed: 'popup-setting', level: 'deputato', fast: true });
  const { store } = run;
  const weekOf = () => store.getState().game.week.index;
  const articles = () => (store.getState().society?.media?.articles ?? []).length;
  const snapshot = () => JSON.stringify(store.getState().game);
  for (let i = 0; i < 3; i++) store.advance(7);
  // enabled: at most three news, once for the week, never twice
  const on = store.weeklyNewsPopup({ enabled: true });
  assert.ok(on.length <= 3, `Al massimo tre notizie (${on.length}).`);
  assert.deepEqual(store.weeklyNewsPopup({ enabled: true }), [], 'La stessa settimana non si ripete: nessun popup duplicato.');
  // disabled for six weeks: it shows nothing, records nothing, changes nothing of the career; the news keep being made and kept
  const before = { popup: JSON.stringify(store.getState().society.media.popup), articles: articles() };
  for (let i = 0; i < 6; i++) {
    store.advance(7);
    const game = snapshot();
    assert.deepEqual(store.weeklyNewsPopup({ enabled: false }), [], 'Disattivato: nessun popup all’avanzamento.');
    assert.equal(snapshot(), game, 'Chiedere il popup da spento non cambia la carriera.');
  }
  assert.equal(JSON.stringify(store.getState().society.media.popup), before.popup, 'Da spento la settimana guardata non cambia: nulla viene consumato né scritto nel salvataggio.');
  assert.ok(articles() > before.articles, `Le notizie continuano a essere generate e registrate (${before.articles} → ${articles()}).`);
  const library = store.getState().society.media.articles;
  assert.ok(library.some(item => item.week >= weekOf() - 1), 'Sono consultabili: l’archivio ha anche quelle delle ultime settimane.');
  // the setting is not in the career: switching it leaves the whole state as it was
  const state = JSON.stringify(store.getState());
  saveSetting('newsPopup', 'off', 'account:x'); saveSetting('newsPopup', 'on', 'account:x'); saveSetting('newsPopup', 'off');
  assert.equal(JSON.stringify(store.getState()), state, 'Cambiare l’impostazione non tocca i dati della carriera.');
  resetSettings();
  // switched on again after six weeks: not the backlog, at most the three recent news of the week in progress, once
  const week = weekOf();
  const back = store.weeklyNewsPopup({ enabled: true });
  assert.ok(back.length <= 3, `Riattivato: al massimo tre notizie, non l’arretrato (${back.length}).`);
  assert.ok(back.every(item => item.week >= week - 2), 'Solo notizie recenti (le ultime due settimane).');
  assert.deepEqual(store.weeklyNewsPopup({ enabled: true }), [], 'Una volta sola.');
  // and the weekly advance still works as before with the popup on
  store.advance(7);
  assert.equal(weekOf(), week + 1, 'L’avanzamento settimanale non cambia.');
  assert.ok(store.weeklyNewsPopup({ enabled: true }).length <= 3);
}

// ---------- 3. in a real browser ----------
globalThis.fetch = realFetch;
delete globalThis.localStorage; delete globalThis.sessionStorage;
const { chromeAvailable, createCareerInPage, openCareer, withBrowser } = await import('./lib/browser.mjs');
if (!chromeAvailable) { console.log('Impostazioni e popup delle notizie verificate nel motore; parte nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).'); process.exit(0); }
const KEY = 'palazzo-2026.career.v1';
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  const reload = async () => { await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))')); await evaluate('document.querySelector("[data-menu=continua]").click(), true'); await wait(() => evaluate('Boolean(document.querySelector(".page-wrap"))')); await pause(700); };
  const popup = () => evaluate(`(() => { const el = document.querySelector('[data-news-popup]'); return el ? { n: el.querySelectorAll('.news-popup-list li').length, count: document.querySelectorAll('[data-news-popup]').length } : null; })()`);
  const closePopups = () => evaluate(`document.querySelectorAll('[data-news-popup-close],[data-outcome-dismiss]').forEach(el => el.click()), true`);
  const seed = tag => evaluate(`(() => { const saved = JSON.parse(localStorage.getItem('${KEY}')); const media = saved.society.media; const week = saved.game.week.index; for (let i = 0; i < 5; i++) media.articles.unshift({ id: 'ps-${tag}-' + i, week, date: saved.clock.currentDate, outletId: 'quotidiani', outlet: 'Il Meridiano', category: 'politica', kind: 'fatto', headline: 'Notizia ${tag}-' + i, deck: 'D', body: ['B'], facts: [], tone: 'neutral', edge: 'neutral', storyId: null, breaking: false, importance: 6, source: 'simulation' }); localStorage.setItem('${KEY}', JSON.stringify(saved)); return week; })()`);
  const savedCareer = () => evaluate(`localStorage.getItem('${KEY}')`);
  const settingsRow = () => evaluate(`(() => { const row = document.querySelector('[data-setting-row="newsPopup"]'); if (!row) return null; const buttons = [...row.querySelectorAll('button')].map(b => ({ text: b.textContent.trim(), active: b.classList.contains('active'), pressed: b.getAttribute('aria-pressed'), h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) })); const r = row.getBoundingClientRect(); return { label: row.querySelector(':scope > span')?.textContent.trim(), buttons, hint: row.querySelector('.setting-hint')?.textContent.trim() ?? '', inside: r.left >= 0 && r.right <= innerWidth + 1, over: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
  const openSettings = async () => { await closePopups(); await evaluate(`(() => { const n = document.querySelector('[data-nav="impostazioni"]'); if (n) n.click(); else location.hash = '#impostazioni'; return true; })()`); await wait(() => evaluate('Boolean(document.querySelector("[data-setting-row=newsPopup]"))')); await pause(300); };
  const tap = label => evaluate(`(() => { const b = [...document.querySelectorAll('[data-setting-row="newsPopup"] button')].find(x => x.textContent.trim() === ${JSON.stringify(label)}); b.click(); return true; })()`);

  for (const [width, mobile] of [[390, true], [320, true], [1280, false]]) {
    await viewport(width, 800, mobile);
    await reload();
    await openSettings();
    const row = await settingsRow();
    assert.equal(row.label, 'Popup notizie settimanali', `${width}px: il nome.`);
    assert.deepEqual(row.buttons.map(b => b.text), ['Attivo', 'Disattivato'], `${width}px: i due stati.`);
    assert.ok(row.buttons[0].active && row.buttons[0].pressed === 'true' && !row.buttons[1].active, `${width}px: di default è attivo e si vede.`);
    assert.ok(/^Attivo\./.test(row.hint), `${width}px: lo stato è scritto (${row.hint}).`);
    assert.ok(row.buttons.every(b => b.h >= 40 && b.w >= 80) && row.inside && !row.over, `${width}px: pulsanti da tocco, nulla fuori dallo schermo (${JSON.stringify(row.buttons)}).`);
    await tap('Disattivato'); await pause(300);
    const off = await settingsRow();
    assert.ok(off.buttons[1].active && off.buttons[1].pressed === 'true' && !off.buttons[0].active && /^Disattivato\./.test(off.hint), `${width}px: subito visibile: Disattivato.`);
    await tap('Attivo'); await pause(300);
    assert.ok((await settingsRow()).buttons[0].active, `${width}px: e di nuovo Attivo.`);
  }

  // off: persistence after a restart; no popup on the weekly advance; the news are made and can be read; the career is not touched by the setting
  await viewport(390, 800, true);
  await reload(); await openSettings(); await tap('Disattivato'); await pause(300);
  const settingsBefore = await evaluate(`localStorage.getItem('politicando.settings.v1')`);
  assert.ok(/"newsPopup":"off"/.test(settingsBefore), 'La scelta è scritta nelle preferenze del browser.');
  const careerAfterToggle = await savedCareer();
  await reload(); await openSettings();
  assert.ok((await settingsRow()).buttons[1].active, 'Dopo il riavvio è ancora Disattivato.');
  await closePopups();
  const articlesBefore = await evaluate(`JSON.parse(localStorage.getItem('${KEY}')).society.media.articles.length`);
  const popupBefore = await evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('${KEY}')).society.media.popup ?? null)`);
  for (let i = 0; i < 3; i++) {
    await evaluate(`document.querySelector('[data-action="advance"]').click(), true`); await pause(1100);
    await evaluate(`[...document.querySelectorAll('button')].filter(b => /Chiudi|Continua|OK/i.test(b.textContent) && b.closest('.report-modal,.modal-backdrop')).forEach(b => b.click()), true`); await pause(300);
    assert.equal(await popup(), null, `Settimana ${i + 1} da spento: nessun popup automatico.`);
  }
  const articlesAfter = await evaluate(`JSON.parse(localStorage.getItem('${KEY}')).society.media.articles.length`);
  assert.ok(articlesAfter > articlesBefore, `Le notizie si generano e si registrano comunque (${articlesBefore} → ${articlesAfter}).`);
  assert.equal(await evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('${KEY}')).society.media.popup ?? null)`), popupBefore, 'La settimana non viene consumata nel salvataggio.');
  await evaluate(`document.querySelector('[data-nav="notizie"]')?.click(), true`); await pause(900);
  assert.ok(await evaluate(`document.querySelectorAll('.page-wrap article, .page-wrap .news-article, .page-wrap [data-article]').length > 0`), 'Le notizie si leggono nella sezione Informazione.');
  assert.ok(careerAfterToggle !== null, 'C’è un salvataggio.');
  // on again: the news of the weeks gone by are not shown all together; the next week brings one popup of at most three news, once
  await openSettings(); await tap('Attivo'); await pause(300);
  assert.equal(await popup(), null, 'Riaccendere non fa comparire un popup arretrato.');
  let again = null;
  for (let i = 0; i < 6 && !again; i++) {
    await evaluate(`document.querySelector('[data-action="advance"]').click(), true`); await pause(1100);
    await evaluate(`[...document.querySelectorAll('button')].filter(b => /Chiudi|Continua|OK/i.test(b.textContent) && b.closest('.report-modal,.modal-backdrop')).forEach(b => b.click()), true`); await pause(300);
    again = await popup();
  }
  assert.ok(again && again.n >= 1 && again.n <= 3 && again.count === 1, `Riattivato: un solo popup, al massimo tre notizie (${JSON.stringify(again)}).`);
  // turning it off while it is open closes it at once and it does not come back
  await evaluate(`document.querySelector('[data-nav="impostazioni"]')?.click(), true`); await wait(() => evaluate('Boolean(document.querySelector("[data-setting-row=newsPopup]"))')); await pause(300);
  await tap('Disattivato'); await pause(300);
  assert.equal(await popup(), null, 'Spento mentre è aperto, sparisce subito.');
  await evaluate(`document.querySelector('[data-nav="elezioni"]')?.click(), document.querySelector('[data-nav="panoramica"]')?.click(), true`); await pause(500);
  assert.equal(await popup(), null, 'E non ricompare cambiando pagina.');
  await openSettings(); await tap('Attivo'); await pause(200); await tap('Disattivato'); await pause(200);

  // accounts: a signed-in account has its own choice; the other account and the browser are not touched
  await evaluate(`localStorage.setItem('politicando.account.v1', JSON.stringify({ username: 'prova.a', token: 'fittizio-a' })), true`);
  await reload(); await openSettings();
  const asA = await settingsRow();
  assert.ok(/prova\.a/.test(asA.hint), `Dice per quale account vale (${asA.hint}).`);
  await tap('Attivo'); await pause(300);
  const scoped = await evaluate(`JSON.parse(localStorage.getItem('politicando.settings.scoped.v1') ?? '{}')`);
  assert.equal(scoped['account:prova.a']?.newsPopup, 'on', 'La scelta dell’account è scritta sotto il suo nome.');
  assert.ok(/"newsPopup":"off"/.test(await evaluate(`localStorage.getItem('politicando.settings.v1')`)), 'Il valore del browser non è stato toccato.');
  await evaluate(`localStorage.setItem('politicando.account.v1', JSON.stringify({ username: 'prova.b', token: 'fittizio-b' })), true`);
  await reload(); await openSettings();
  assert.ok((await settingsRow()).buttons[1].active, 'L’account B vede la sua scelta (quella del browser: Disattivato), non quella di A.');
  assert.ok(errors.filter(e => !/401|fetch|Failed to load/i.test(String(e))).length === 0, `Nessun errore JavaScript (${errors.join(' | ').slice(0, 200)}).`);
});
console.log('Popup notizie settimanali verificato: interruttore Attivo/Disattivato (stato scritto e visibile su 320, 390 e 1280 px), attivo di default, preferenza persistente al riavvio, isolata per account senza toccare browser né carriere; da spento nessun popup, notizie generate e consultabili, settimana non consumata; riacceso, un solo popup di al massimo tre notizie recenti, mai l’arretrato né duplicati.');
