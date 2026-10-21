// Finanze: il riepilogo di cassa resta in cima; poi, nell'ordine, Bilancio e andamento, Entrate e uscite, Investimenti e patrimonio, Raccolte fondi ed eventi, Registri e storico, Fondi e partito
// e, subito sotto, Tesoreria del partito. I blocchi sono gli stessi di prima (nessuna copia): trasferimenti, raccolte e investimenti rispondono ancora.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Ordine di Finanze nel browser saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
const ORDER = ['fin-andamento', 'fin-entrate-uscite', 'fin-investimenti', 'fin-raccolte', 'fin-registri', 'fin-fondi-partito', 'fin-tesoreria'];
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 3 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await pause(1500);
  await evaluate(`(() => { [...document.querySelectorAll('button')].filter(b => /^Chiudi$/.test(b.textContent.trim()) && b.closest('aside,[role=dialog]')).forEach(b => b.click()); location.hash = '#finanze'; return true; })()`);
  await pause(900);
  for (const [name, w, h, mobile] of [['computer', 1440, 900, false], ['smartphone', 390, 800, true], ['smartphone stretto', 320, 700, true]]) {
    await viewport(w, h, mobile); await pause(500);
    const page = await evaluate(`(() => { const root = document.querySelector('.finance-page'); const kids = [...root.children]; const ids = kids.map(el => el.matches('details[data-remember]') ? el.dataset.remember : el.className.split(' ')[0]);
      const d = document.documentElement; return { ids, hero: ids.indexOf('finance-hero'), copies: ['[data-transfer-request]', '[data-treasury-start]', '[data-reserve]'].map(s => document.querySelectorAll(s).length), over: d.scrollWidth > innerWidth + 1 }; })()`);
    assert.equal(page.ids[0], 'finance-hero', `${name}: il riepilogo di cassa resta in cima (${page.ids}).`);
    const order = ORDER.map(id => page.ids.indexOf(id));
    assert.ok(order.every(i => i > 0), `${name}: tutte le sezioni ci sono (${page.ids}).`);
    assert.deepEqual([...order].sort((a, b) => a - b), order, `${name}: ordine delle sezioni (${page.ids}).`);
    assert.equal(order[6], order[5] + 1, `${name}: «Fondi e partito» è subito sopra «Tesoreria del partito».`);
    assert.ok(page.copies[0] > 0, `${name}: i pulsanti dei trasferimenti ci sono.`);
    assert.equal(page.over, false, `${name}: nessuno scorrimento orizzontale.`);
  }
  // the controls keep working: open Fondi e partito and pay 50 € to the party; the two registers show it once
  await viewport(390, 800, true); await pause(300);
  await evaluate(`document.querySelector('details[data-remember="fin-fondi-partito"] > summary').click(); true`); await pause(300);
  const before = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const g = store.getState().game; return { funds: g.resources.funds, treasury: g.party.org.treasury.balance, rows: g.finance.transfers.length }; })()`);
  assert.equal(await evaluate(`document.querySelector('details[data-remember="fin-fondi-partito"]').open`), true, 'Un tocco apre «Fondi e partito».');
  const clicked = await evaluate(`(() => { const b = [...document.querySelectorAll('[data-transfer-give]')].find(x => !x.disabled && x.dataset.transferGive !== 'custom'); if (!b) return null; b.click(); return b.dataset.transferGive; })()`);
  assert.ok(clicked, 'Un versamento preimpostato è disponibile.');
  await pause(700);
  const after = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const g = store.getState().game; return { funds: g.resources.funds, treasury: g.party.org.treasury.balance, rows: g.finance.transfers.length }; })()`);
  assert.equal(after.rows, before.rows + 1, 'Il trasferimento è registrato una volta sola.');
  assert.equal(before.funds - after.funds, Number(clicked), 'I fondi personali calano dell’importo versato.');
  assert.equal(after.treasury - before.treasury, Number(clicked), 'La tesoreria cresce dello stesso importo.');
  assert.equal(await evaluate(`document.querySelector('details[data-remember="fin-fondi-partito"]').open`), true, 'Dopo il ridisegno la sezione resta aperta.');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
});
console.log('Ordine di Finanze verificato (computer, 390 e 320 px): riepilogo, Bilancio, Entrate e uscite, Investimenti, Raccolte, Registri, Fondi e partito e Tesoreria; un versamento al partito è registrato una volta e lo stato della tendina resta.');
