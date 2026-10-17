// Saves in a real Chrome (clean profile, real IndexedDB), when the browser storage is short of room or refuses: a career saved the old way (only in localStorage) is copied to IndexedDB, read back
// and checked, and nothing is deleted; with localStorage full the save is kept in IndexedDB and called safe only when it is confirmed; a reload finds the latest career; when nothing can take the
// write the page says so, keeps the career in memory and lets the player export the latest state; the career in progress is not replaced while it cannot be kept; a second tab sees the first's overflow.
// Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Salvataggi nel browser saltati: Chrome non trovato (imposta CHROME_PATH per eseguirli).'); process.exit(0); }

await withBrowser(async ({ evaluate, send, goto, waitFor: wait, pause, errors, version }) => {
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const mod = `import('/src/core/store.js?v=${version}')`;
  const week = () => evaluate(`(async () => (await ${mod}).store.getState().game.week.index)()`);
  const stored = () => evaluate(`(() => { const raw = localStorage.getItem('palazzo-2026.career.v1'); return raw ? JSON.parse(raw).game.week.index : null; })()`);
  const report = () => evaluate(`(async () => (await import('/src/core/storage.js?v=${version}')).storage.vaultReport())()`);
  const vaultKeys = () => evaluate(`new Promise((resolve, reject) => { const open = indexedDB.open('politicando-vault', 1); open.onerror = () => reject(open.error); open.onsuccess = () => { const tx = open.result.transaction('entries', 'readonly'); const all = tx.objectStore('entries').getAll(); all.onsuccess = () => resolve(all.result.map(row => ({ key: row.key, same: row.key.startsWith('__') ? true : row.value === localStorage.getItem(row.key), lsOk: row.lsOk }))); }; })`);
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ' + ${JSON.stringify(selector)}); el.click(); return true; })()`);
  // localStorage that has no room for the saves (the keys of the saves are refused with a quota error, as when the 5 MB are spent; the small keys still fit)
  const fillLocal = () => evaluate(`(() => { if (!window.__realSet) { window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (/^(palazzo-2026\\.career\\.v1|politicando\\.slot\\.)/.test(key) && !window.__roomForSaves) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); return window.__realSet.call(this, key, value); }; } window.__roomForSaves = false; return true; })()`);
  // a reload that is really finished: the old document is gone (a marker on it disappears) and the menu of the new one is there
  const reload = async () => { await evaluate('window.__old = true'); await goto(''); await wait(async () => !(await evaluate('window.__old === true')) && await has('[data-menu="nuova"]')); await pause(300); };
  // the weekly advance runs in a timer of the page and the check polls for its end: a long synchronous step never holds a DevTools call open
  const advance = async () => { await evaluate(`(() => { window.__done = false; setTimeout(async () => { try { const { store } = await ${mod}; store.advanceTurn(1); } catch (error) { window.__failed = error.message; } window.__done = true; }, 0); return true; })()`); await wait(() => evaluate('window.__done === true')); assert.equal(await evaluate('window.__failed ?? null'), null, 'L’avanzamento non ha errori.'); };
  const freeLocal = () => evaluate(`(() => { window.__roomForSaves = true; return true; })()`);

  // ---------- 1. a career saved the old way: copied to IndexedDB, checked, nothing deleted ----------
  await createCareerInPage({ evaluate, version }, { weeks: 3 });
  await reload();
  await evaluate(`(async () => { const { store } = await ${mod}; store.save(); store.saveToSlot('vecchio'); return true; })()`);
  await pause(600);
  // As if the browser had never had IndexedDB: the database is deleted, localStorage keeps everything.
  const before = await evaluate(`JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key).length])))`);
  await evaluate(`new Promise(resolve => { const request = indexedDB.deleteDatabase('politicando-vault'); request.onsuccess = request.onerror = request.onblocked = () => resolve(true); })`);
  await reload();
  const migrated = (await report()).migrated;
  assert.ok(migrated.done && migrated.keys.length >= 3, `La migrazione ha copiato i salvataggi (${migrated.keys.join(', ')}).`);
  assert.deepEqual(migrated.mismatches, [], 'Riletti da IndexedDB, nessuna differenza.');
  assert.equal(migrated.verified.length, migrated.keys.length, 'Ogni copia è verificata.');
  const rows = await vaultKeys();
  assert.ok(rows.filter(row => !row.key.startsWith('__')).every(row => row.same), 'Le copie in IndexedDB coincidono con localStorage.');
  assert.equal(await evaluate(`JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(key => !key.startsWith('politicando.onboarding')).map(key => [key, localStorage.getItem(key).length])))`).then(value => Object.keys(JSON.parse(value)).sort().join()), Object.keys(JSON.parse(before)).filter(key => !key.startsWith('politicando.onboarding')).sort().join(), 'Nessuna chiave di localStorage è stata cancellata.');
  await reload();
  assert.deepEqual((await report()).migrated.keys, [], 'Riaprendo la migrazione non si ripete.');

  // ---------- 2. localStorage full: the save goes to IndexedDB, is "safe" only when confirmed, and survives a reload ----------
  await click('[data-menu="continua"]'); await wait(() => has('.page-wrap'));
  const startWeek = await week();
  await fillLocal();
  await advance();
  const status = await evaluate(`(async () => { const { store } = await ${mod}; return store.saveStatus(); })()`);
  await wait(async () => { const s = await evaluate(`(async () => (await ${mod}).store.saveStatus())()`); return s.ok && !s.dirty && !s.pending; });
  assert.equal(await week(), startWeek + 1);
  assert.ok((await stored()) <= startWeek + 1, 'In localStorage la copia principale può essere la vecchia (non c’è spazio): è IndexedDB a reggere la nuova.');
  const afterFill = await report();
  assert.ok(afterFill.ahead.includes('palazzo-2026.career.v1') || (await stored()) === startWeek + 1, 'La copia principale vive fuori da localStorage o ci è entrata.');
  assert.equal(await has('[data-save-alert]'), false, 'A conferma avvenuta non resta nessun avviso.');
  await reload(); await wait(() => has('[data-menu="continua"]'));
  const reloadedWeek = await evaluate(`(async () => (await ${mod}).store.getState().game.week.index)()`);
  assert.equal(reloadedWeek, startWeek + 1, 'Dopo il ricaricamento c’è la settimana più recente, anche con localStorage pieno.');
  void status;

  // ---------- 3. a second tab (a frame of the same site) sees the overflow of the first ----------
  await click('[data-menu="continua"]'); await wait(() => has('.page-wrap'));
  await fillLocal();
  await advance();
  await wait(async () => { const s = await evaluate(`(async () => (await ${mod}).store.saveStatus())()`); return s.ok && !s.pending && !s.dirty; });
  const target = await week();
  // the second tab is the whole game opened in another window of the same site (same storage, same IndexedDB, same channel)
  await send('Runtime.evaluate', { expression: "window.__second = window.open('/index.html', 'second-tab'); Boolean(window.__second)", userGesture: true, returnByValue: true });
  await wait(() => evaluate(`Boolean(window.__second?.document?.querySelector('.menu-continue'))`));
  const secondText = await evaluate(`window.__second.document.querySelector('.menu-continue').textContent`);
  assert.match(secondText, new RegExp(`Settimana ${target}\\b`), `La seconda scheda mostra la settimana più recente (${target}): ${secondText.replace(/\s+/g, ' ').slice(0, 120)}`);
  await evaluate(`window.__second.close()`);

  // ---------- 4. nothing can take the write: the page says so, the career stays in memory and can be exported ----------
  await evaluate(`(() => { window.__realPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('prova: scrittura rifiutata', 'QuotaExceededError'); }; window.__downloads = []; const make = URL.createObjectURL.bind(URL); URL.createObjectURL = blob => { blob.text().then(text => window.__downloads.push(text)); return make(blob); }; return true; })()`);
  await advance();
  await wait(async () => (await evaluate(`(async () => (await ${mod}).store.saveStatus())()`)).ok === false);
  const failed = await evaluate(`(async () => (await ${mod}).store.saveStatus())()`);
  assert.equal(failed.ok, false, 'Il salvataggio non riuscito non è mai dato per riuscito.');
  assert.equal(failed.dirty, true);
  assert.match(failed.error ?? '', /non ha confermato|solo in memoria|spazio|Spazio/i, 'L’errore dice che cosa è successo.');
  await evaluate(`(async () => { const { store } = await ${mod}; store.emit?.(); document.querySelector('[data-action="save"]')?.click(); return true; })()`);
  await wait(() => has('[data-save-alert="failed"]'));
  const latest = await week();
  await click('[data-save-alert] [data-action="export-save"]');
  await wait(() => evaluate(`window.__downloads.length > 0`));
  const exported = JSON.parse(await evaluate(`window.__downloads[0]`));
  assert.equal(exported.game.week.index, latest, 'Il file esportato contiene l’ultimo stato della carriera, non quello vecchio.');
  // the career in progress is not replaced while it cannot be kept
  const blocked = await evaluate(`(async () => { const { store } = await ${mod}; try { await store.preserveCurrent(); return 'ok'; } catch (error) { return error.message; } })()`);
  assert.match(blocked, /non può essere conservata/, 'Con la scrittura rifiutata la carriera in corso non viene sostituita.');
  assert.equal(await week(), latest, 'La carriera in corso è intatta.');
  await evaluate(`(() => { IDBObjectStore.prototype.put = window.__realPut; return true; })()`);
  await freeLocal();
  await evaluate(`(async () => { const { store } = await ${mod}; store.save(); return true; })()`);
  await wait(async () => (await evaluate(`(async () => (await ${mod}).store.saveStatus())()`)).ok);
  assert.equal(await has('[data-save-alert="failed"]'), false, 'Tornata la possibilità di scrivere, l’avviso sparisce.');

  // ---------- 5. a browser with no IndexedDB (a private window, an in-app browser) and a localStorage that spends its quota: the error of the report, and the last resort ----------
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); (() => { const real = Storage.prototype.setItem; window.__limit = Infinity; Storage.prototype.setItem = function (key, value) { if (/^(palazzo-2026\\.career\\.v1|politicando\\.slot\\.)/.test(key) && String(value).length > window.__limit) throw new DOMException(\"Failed to execute 'setItem' on 'Storage': Setting the value of '\" + key + \"' exceeded the quota.\", 'QuotaExceededError'); return real.call(this, key, value); }; })();" });
  await reload();
  assert.equal(await evaluate('typeof indexedDB'), 'undefined', 'Senza IndexedDB.');
  await click('[data-menu="continua"]'); await wait(() => has('.page-wrap'));
  const plainSize = await evaluate(`localStorage.getItem('palazzo-2026.career.v1').length`);
  await evaluate(`window.__limit = Math.round(localStorage.getItem('palazzo-2026.career.v1').length * 0.7)`);
  await advance();
  const compressedStatus = await evaluate(`(async () => (await ${mod}).store.saveStatus())()`);
  assert.equal(compressedStatus.ok, true, 'Con la quota stretta ma la copia compressa che ci sta, il salvataggio riesce senza IndexedDB.');
  assert.equal(compressedStatus.dirty, false); assert.equal(compressedStatus.pending, false, 'Ed è al sicuro subito (è in localStorage).');
  const packed = await evaluate(`localStorage.getItem('palazzo-2026.career.v1').startsWith('\\u0001lz1:')`);
  assert.equal(packed, true, 'La copia principale è compressa.');
  assert.ok(plainSize > 100000, 'La carriera di prova è grande abbastanza da non entrare così com’è.');
  const compressedWeek = await week();
  await reload();
  await click('[data-menu="continua"]'); await wait(() => has('.page-wrap'));
  assert.equal(await week(), compressedWeek, 'Dopo il ricaricamento la carriera compressa si legge: stessa settimana.');
  // no room even for the compressed copy: the error of the report, the state in memory, the file
  await evaluate(`window.__limit = 1; window.__downloads = []; const make = URL.createObjectURL.bind(URL); URL.createObjectURL = blob => { blob.text().then(text => window.__downloads.push(text)); return make(blob); }; true`);
  await advance();
  const refused = await evaluate(`(async () => (await ${mod}).store.saveStatus())()`);
  assert.equal(refused.ok, false, 'Senza posto per niente il salvataggio non riesce, e non è dato per riuscito.');
  assert.match(refused.error ?? '', /exceeded the quota/, 'È l’errore del browser della segnalazione, mostrato al giocatore.');
  await wait(() => has('[data-save-alert="failed"]'));
  const lastWeek = await week();
  await click('[data-save-alert] [data-action="export-save"]');
  await wait(() => evaluate('window.__downloads.length > 0'));
  assert.equal(JSON.parse(await evaluate('window.__downloads[0]')).game.week.index, lastWeek, 'Il file contiene l’ultimo stato.');
  assert.deepEqual(errors.filter(error => !/prova: scrittura rifiutata/.test(error)), [], 'Nessun errore imprevisto in pagina.');
});
console.log('Salvataggi verificati in Chrome con IndexedDB reale: la carriera salvata solo in localStorage è copiata, riletta e controllata senza cancellare nulla e senza ripetersi; con localStorage pieno il salvataggio passa da IndexedDB ed è «al sicuro» solo a conferma avvenuta, e dopo il ricaricamento c’è lo stato più recente; una seconda scheda lo legge; se nessuno accetta la scrittura la pagina lo dice, tiene lo stato in memoria, permette di esportare l’ultimo stato e non sostituisce la carriera in corso; senza IndexedDB e con la quota stretta la copia compressa salva (si rilegge dopo il ricaricamento), senza posto per nulla l’errore del browser è mostrato, lo stato resta in memoria e si esporta.');
