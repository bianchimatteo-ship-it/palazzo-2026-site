// Ricaricare la pagina e andare avanti non riporta mai la carriera indietro: dopo ogni ricaricamento la settimana è quella dell'ultimo salvataggio, avanzare la porta a quella successiva, e
// una copia più vecchia (uno slot, il backup) non prende il posto della carriera più avanzata. Browser vero (Chrome), profilo pulito. Senza Chrome il controllo si salta.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Ricarica e avanzamento saltati: Chrome non trovato (imposta CHROME_PATH per eseguirli).'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, version }) => {
  const mod = `import('/src/core/store.js?v=${version}')`;
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const week = () => evaluate(`(async () => (await ${mod}).store.getState().game.week.index)()`);
  const date = () => evaluate(`(async () => (await ${mod}).store.getState().clock.currentDate)()`);
  const storedWeek = () => evaluate(`(() => { const raw = localStorage.getItem('palazzo-2026.career.v1'); return raw ? JSON.parse(raw).game.week.index : null; })()`);
  const careerId = () => evaluate(`(async () => (await ${mod}).store.getState().career.id)()`);
  const reload = async () => { await evaluate('window.__old = true'); await goto(''); await wait(async () => !(await evaluate('window.__old === true')) && await has('[data-menu="nuova"]')); await pause(300); };
  const resume = async () => { await evaluate('document.querySelector("[data-menu=continua]")?.click(), true'); await wait(() => has('.page-wrap')); await pause(300); };
  const advance = async () => { await evaluate(`(() => { window.__done = false; setTimeout(async () => { try { const { store } = await ${mod}; store.advanceTurn(1); } catch (error) { window.__failed = error.message; } window.__done = true; }, 0); return true; })()`); await wait(() => evaluate('window.__done === true')); assert.ok(!(await evaluate('window.__failed ?? null')), 'l’avanzamento non deve fallire'); };

  await createCareerInPage({ evaluate, version }, { weeks: 3 });
  const id = await careerId();
  const start = await week();
  assert.equal(await storedWeek(), start, 'La carriera salvata è alla settimana corrente');
  const trail = [start];
  // a slot saved now will be older than the career after the rounds below
  await evaluate(`(async () => { (await ${mod}).store.saveToSlot('Copia vecchia', 'slot-vecchio-ricarica', { manual: true }); return true; })()`);
  for (let round = 1; round <= 3; round++) {
    await reload();
    await resume();
    assert.equal(await careerId(), id, `Giro ${round}: dopo il ricaricamento la carriera è la stessa`);
    assert.equal(await week(), trail.at(-1), `Giro ${round}: dopo il ricaricamento la settimana è quella dell'ultimo salvataggio (${trail.at(-1)})`);
    await advance();
    const after = await week();
    assert.equal(after, trail.at(-1) + 1, `Giro ${round}: avanzando si arriva alla settimana successiva`);
    assert.equal(await storedWeek(), after, `Giro ${round}: il salvataggio segue l'avanzamento`);
    trail.push(after);
  }
  assert.ok(trail.every((value, index) => index === 0 || value > trail[index - 1]), 'La settimana cresce sempre');
  // an older copy never takes the place of the advanced career: a slot saved earlier is restored as a separate career
  const lastDate = await date();
  const stale = await evaluate(`(async () => {
    const { storage } = await import('/src/core/storage.js?v=${version}');
    const { store } = await ${mod};
    const old = storage.loadSlot('slot-vecchio-ricarica');
    let refused = false;
    try { storage.save(old); } catch (error) { refused = /obsoleto/.test(error.message); }
    const kept = JSON.parse(localStorage.getItem('palazzo-2026.career.v1'));
    const before = { id: kept.career.id, week: kept.game.week.index, date: kept.clock.currentDate };
    store.loadSlot('slot-vecchio-ricarica');
    const opened = { id: store.getState().career.id, week: store.getState().game.week.index };
    const best = storage.bestForCareer(before.id);
    return { oldWeek: old.game.week.index, oldCareer: old.career.id, refused, before, opened, bestWeek: best?.game.week.index ?? null, bestDate: best?.clock.currentDate ?? null };
  })()`);
  assert.equal(stale.oldCareer, id, 'Lo slot vecchio è della stessa carriera');
  assert.ok(stale.oldWeek < trail.at(-1), `Lo slot è più vecchio della carriera (settimana ${stale.oldWeek} contro ${trail.at(-1)})`);
  assert.ok(stale.refused, 'Scrivere la copia vecchia sul salvataggio principale è rifiutato');
  assert.deepEqual(stale.before, { id, week: trail.at(-1), date: lastDate }, 'Il salvataggio principale è rimasto alla carriera avanzata');
  assert.equal(stale.opened.week, stale.oldWeek, 'Aprire lo slot vecchio riporta alla sua settimana…');
  assert.notEqual(stale.opened.id, id, '…come carriera separata, non al posto di quella avanzata');
  assert.equal(stale.bestWeek, trail.at(-1), 'Per la sua identità la carriera più avanzata resta la settimana più alta');
  assert.equal(stale.bestDate, lastDate, 'E alla sua data');
  await evaluate(`(async () => { const { storage } = await import('/src/core/storage.js?v=${version}'); (await ${mod}).store.loadGame(storage.bestForCareer(${JSON.stringify(id)}), 'Ritorno'); return true; })()`);
  await reload();
  assert.equal(await storedWeek(), trail.at(-1), 'Dopo l’ultimo ricaricamento il salvataggio principale è ancora il più avanzato');
  void date;
});
console.log('Ricarica e avanzamento verificati: tre giri consecutivi senza tornare indietro, salvataggio sempre allineato alla settimana.');
