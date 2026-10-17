// «Carica partita» in Chrome (clean profile): every slot has a readable name, the date of the game and the week, where it is kept and whether the browser has confirmed it; each slot
// and each copy kept aside can be exported to a file; a copy kept aside can be restored (the running game is first put in a slot, or nothing happens); a deletion or a save that fails says why and changes nothing;
// with the slots full the save to a slot is refused with the reason and no slot is deleted by the game. Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Carica partita nel browser saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }

await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, errors, version }) => {
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent.replace(/\\s+/g, ' ').trim() ?? ''`);
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ' + ${JSON.stringify(selector)}); el.click(); return true; })()`);
  const mod = `import('/src/core/store.js?v=${version}')`;
  const run = body => evaluate(`(async () => { const { store } = await ${mod}; ${body} })()`);
  const week = () => run('return store.getState().game.week.index;');
  const open = async () => { if (!(await has('.slot-list'))) { if (!(await has('[data-menu="carica"]'))) await click('[data-action="menu"]'); await wait(() => has('[data-menu="carica"]')); await click('[data-menu="carica"]'); } await wait(() => has('.slot-list')); };
  const captured = () => evaluate(`window.__downloads.length`);
  const reload = async () => { await evaluate('window.__old = true'); await goto(''); await wait(async () => !(await evaluate('window.__old === true')) && await has('[data-menu="nuova"]')); await pause(300); };

  await createCareerInPage({ evaluate, version }, { weeks: 3 });
  await reload();
  await evaluate(`(() => { window.__downloads = []; const make = URL.createObjectURL.bind(URL); URL.createObjectURL = blob => { blob.text().then(value => window.__downloads.push(value)); return make(blob); }; return true; })()`);
  const careerId = await run('return store.getState().career.id;');
  const startWeek = await week();

  // ---------- 1. slots: name, date and week, where, status ----------
  await run(`store.save(); store.saveToSlot('Prima di un voto'); store.advanceTurn(1); store.save(); store.saveToSlot('Dopo una settimana'); return true;`);
  await pause(400);
  await open();
  const rows = await evaluate(`[...document.querySelectorAll('[data-slot-row]')].map(row => row.textContent.replace(/\\s+/g, ' ').trim())`);
  assert.equal(rows.length, 2, 'Due slot elencati.');
  assert.ok(rows.some(row => row.includes('Prima di un voto') && row.includes(`Settimana ${startWeek}`) && /salvato il \d/.test(row)), `Un nome leggibile, la settimana e la data del salvataggio (${rows[0]}).`);
  assert.ok(rows.every(row => /In questo browser|Nel database del browser/.test(row)), 'Ogni slot dice dove sta.');
  assert.match(await text('.slot-row.is-current'), /Salvata alle|Salvata in questo browser|Salvato alle/, 'La partita in corso dice che è salvata.');
  assert.equal(await evaluate(`document.querySelector('.slot-row.is-current [data-save-state]')?.dataset.saveState`), 'saved', 'E lo stato è «salvata».');

  // ---------- 2. export of one slot ----------
  await click('[data-slot-row] [data-slot-export]');
  await wait(async () => (await captured()) === 1);
  const exported = JSON.parse(await evaluate('window.__downloads[0]'));
  assert.equal(exported.career.id, careerId, 'Il file è la partita di quello slot.');
  assert.ok(exported.exportedAt && exported.dataset?.politicians?.length, 'Con la data di esportazione e tutti i dati.');

  // ---------- 3. copies kept aside: listed, exported, restored ----------
  await run(`store.advanceTurn(1); store.save(); store.advanceTurn(1); store.save(); return true;`);
  const latest = await week();
  await click('[data-menu="carica"]'); await click('[data-menu="carica"]'); await wait(() => has('.slot-list'));
  await open();
  assert.ok(await has('.slot-versions'), 'Le copie di sicurezza di questo browser sono elencate.');
  await evaluate(`document.querySelector('.slot-versions').open = true`);
  const versions = await evaluate(`[...document.querySelectorAll('[data-version-row]')].map(row => ({ id: row.dataset.versionRow, text: row.textContent.replace(/\\s+/g, ' ').trim() }))`);
  assert.ok(versions.length >= 1 && versions.every(item => /settimana \d+/.test(item.text) && /salvata il/.test(item.text)), `Ogni copia dice perché c’è, di chi è, quale settimana e quando (${versions[0]?.text}).`);
  await click('[data-version-export]');
  await wait(async () => (await captured()) === 2);
  assert.equal(JSON.parse(await evaluate('window.__downloads[1]')).career.id, careerId, 'Anche una copia di sicurezza si esporta.');
  const target = versions.map(item => ({ ...item, weekNumber: Number(/settimana (\d+)/.exec(item.text)[1]) })).find(item => item.weekNumber < latest);
  assert.ok(target, 'C’è una copia di una settimana precedente.');
  const slotsBefore = await evaluate(`document.querySelectorAll('[data-slot-row]').length`);
  await click(`[data-version-restore="${target.id}"]`);
  await wait(() => has('[data-confirm="ok"]'));
  assert.match(await text('.confirm-dialog'), /messa in uno slot automatico/, 'La conferma dice che la partita in corso viene prima conservata.');
  assert.match(await text('.confirm-dialog'), /carriera separata/, 'Una copia più vecchia della stessa carriera torna come carriera separata: quella avanzata non si tocca.');
  await click('[data-confirm="ok"]');
  await wait(() => has('.page-wrap'));
  assert.equal(await week(), target.weekNumber, 'La copia scelta è tornata la partita in corso.');
  assert.notEqual(await run('return store.getState().career.id;'), careerId, 'Con una nuova identità: la carriera avanzata resta quella di prima.');
  await open().catch(async () => { await click('[data-action="menu"]'); await wait(() => has('[data-menu="carica"]')); await click('[data-menu="carica"]'); await wait(() => has('.slot-list')); });
  const afterRows = await evaluate(`[...document.querySelectorAll('[data-slot-row]')].map(row => row.textContent.replace(/\\s+/g, ' ').trim())`);
  assert.equal(afterRows.length, slotsBefore + 1, 'La partita che c’era è stata messa in uno slot: nulla è andato perso.');
  assert.ok(afterRows.some(row => /Copia automatica prima di cambiare partita/.test(row) && row.includes(`Settimana ${latest}`)), 'Lo slot automatico è riconoscibile e ha l’ultima settimana.');

  // ---------- 4. errors say why and change nothing ----------
  await evaluate(`(() => { window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key === 'politicando.slots.v1') throw new DOMException('quota', 'QuotaExceededError'); return window.__realSet.call(this, key, value); }; return true; })()`);
  const before = await evaluate(`document.querySelectorAll('[data-slot-row]').length`);
  await click('[data-slot-delete]');
  await wait(() => has('[data-confirm="ok"]')); await click('[data-confirm="ok"]');
  await pause(500);
  assert.equal(await evaluate(`document.querySelectorAll('[data-slot-row]').length`), before, 'Se l’indice non si può scrivere, lo slot non sparisce.');
  await evaluate(`(() => { Storage.prototype.setItem = window.__realSet; return true; })()`);

  // ---------- 5. slots full: refused with the reason, nothing deleted by the game ----------
  await run(`for (let i = store.listSlots().length; i < 5; i++) store.saveToSlot('Slot ' + i, null, { manual: true }); return store.listSlots().length;`);
  await click('[data-menu="carica"]'); await click('[data-menu="carica"]'); await wait(() => has('.slot-list'));
  await open();
  const names = await evaluate(`[...document.querySelectorAll('[data-slot-row] strong')].map(el => el.textContent)`);
  await click('[data-menu-action="save-slot"]');
  await wait(() => has('.menu-error'));
  assert.match(await text('.menu-error'), /al massimo 5 salvataggi/, 'Con gli slot pieni il salvataggio in uno slot è rifiutato con il motivo.');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-slot-row] strong')].map(el => el.textContent)`), names, 'E nessuno slot è stato eliminato da sé.');
  assert.deepEqual(errors, [], 'Nessun errore in pagina.');
});
console.log('Carica partita verificato in Chrome: ogni slot ha nome, settimana, data, posizione e conferma del browser, la partita in corso dice se è salvata, uno slot e una copia di sicurezza si esportano su file, una copia si ripristina (la partita in corso va prima in uno slot automatico), un’eliminazione che non riesce non cancella nulla, con gli slot pieni il salvataggio è rifiutato con il motivo e il gioco non elimina mai uno slot da sé.');
