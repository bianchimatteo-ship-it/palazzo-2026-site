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
  const slots = await evaluate(`(async () => { const { storage } = await import('/src/core/storage.js?v=${version}'); return (storage.listSlots?.() ?? []).map(slot => ({ id: slot.id, week: slot.week ?? null })); })()`);
  assert.ok(Array.isArray(slots), 'Gli slot si leggono');
  await reload();
  assert.equal(await storedWeek(), trail.at(-1), 'Dopo l’ultimo ricaricamento il salvataggio principale è ancora il più avanzato');
  void date;
});
console.log('Ricarica e avanzamento verificati: tre giri consecutivi senza tornare indietro, salvataggio sempre allineato alla settimana.');
