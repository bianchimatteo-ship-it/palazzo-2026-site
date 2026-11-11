// «Carica partita» with more than one career, in Chrome (clean profile): two different careers are created and saved, the start screen is reopened, each is loaded from the list and the game really enters it (name,
// role, date, id, week), also with the player's five slots full (the automatic copy of the running career does not use them) and after a reload of the browser. Nothing is lost or overwritten. Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Caricamento di più carriere saltato: Chrome non trovato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, errors, version }) => {
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const who = () => S(`const s = store.getState(); const p = s.dataset.politicians?.find(x => x.id === s.career.playerId); return { id: s.career.id, name: p?.displayName, week: s.game?.week.index, date: s.clock.currentDate, role: s.dataset.offices.find(o => o.id === p?.roleId)?.title ?? null, party: s.game?.party?.label ?? null, inPage: Boolean(document.querySelector('.page-wrap')) };`);
  await createCareerInPage({ evaluate, version }, { level: 'deputato', name: ['Anna', 'Prima'], weeks: 3 });
  await openCareer({ evaluate, goto, waitFor: wait });
  const A = await who();
  await S(`store.saveToSlot(); return true;`);
  await createCareerInPage({ evaluate, version }, { level: 'comunale', group: '', name: ['Bruno', 'Secondo'], weeks: 5 });
  await openCareer({ evaluate, goto, waitFor: wait });
  const B = await who();
  await S(`store.saveToSlot(); return true;`);
  assert.notEqual(A.id, B.id, 'Due carriere diverse.');
  const openList = async () => { await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu=carica]"))')); await evaluate('document.querySelector("[data-menu=carica]").click(), true'); await wait(() => evaluate('Boolean(document.querySelector("[data-slot-row]"))')); };
  const loadByName = async text => {
    const id = await evaluate(`[...document.querySelectorAll('[data-slot-row]')].find(row => /${text}/.test(row.querySelector('strong').textContent))?.dataset.slotRow`);
    assert.ok(id, `Lo slot «${text}» è nell’elenco.`);
    await evaluate(`document.querySelector('[data-slot-row="${id}"] [data-slot-load]').click(), true`);
    if (await evaluate(`Boolean(document.querySelector('[data-confirm="ok"]'))`)) await evaluate(`document.querySelector('[data-confirm="ok"]').click(), true`);
    await wait(() => evaluate(`Boolean(document.querySelector('.page-wrap'))`), 20000);
    await pause(400);
  };
  const same = (got, want, label) => { assert.equal(got.name, want.name, `${label}: nome`); assert.equal(got.role, want.role, `${label}: ruolo`); assert.equal(got.party, want.party, `${label}: partito`); assert.equal(got.week, want.week, `${label}: settimana`); assert.equal(got.date, want.date, `${label}: data`); assert.ok(got.inPage, `${label}: si entra nella partita`); };
  // from the start screen: first career, then (from inside the game) the second
  await openList(); await loadByName('Anna');
  const a1 = await who(); same(a1, A, 'Anna caricata dalla schermata iniziale');
  await S(`store.setHash?.('x'); return true;`).catch(() => {});
  await evaluate(`document.querySelector('[data-action="menu"]')?.click(), true`); await pause(400);
  await evaluate(`document.querySelector('[data-menu=carica]').click(), true`); await wait(() => evaluate('Boolean(document.querySelector("[data-slot-row]"))'));
  await loadByName('Bruno');
  same(await who(), B, 'Bruno caricato da dentro la partita');
  // the player's five slots full: the career is still loaded and none of the five is touched
  await S(`for (let i = 0; i < 8 && store.listSlots().filter(s => !s.autoPreserve).length < 5; i++) store.saveToSlot('Pieno ' + i); return store.listSlots().filter(s => !s.autoPreserve).length;`);
  const manualBefore = await S(`return store.listSlots().filter(s => !s.autoPreserve).map(s => s.name).sort();`);
  await S(`store.advance(7); return true;`);   // unsaved progress in the running career
  await evaluate(`document.querySelector('[data-action="menu"]')?.click(), true`); await pause(400);
  await evaluate(`document.querySelector('[data-menu=carica]').click(), true`); await wait(() => evaluate('Boolean(document.querySelector("[data-slot-row]"))'));
  await loadByName('Anna Prima · settimana');
  const a2 = await who(); assert.equal(a2.name, 'Anna Prima'); assert.ok(a2.inPage, 'Con i cinque slot pieni si entra comunque nella carriera scelta.');
  assert.deepEqual(await S(`return store.listSlots().filter(s => !s.autoPreserve).map(s => s.name).sort();`), manualBefore, 'Nessuno slot del giocatore è stato toccato.');
  assert.ok(await S(`return store.listSlots().some(s => s.autoPreserve && s.careerId === ${JSON.stringify(B.id)});`), 'La carriera lasciata (con i progressi) è nella sua copia automatica.');
  // reload of the browser: the career entered is the one «Continua» offers
  await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'));
  assert.match(await evaluate(`document.querySelector('[data-menu=continua]').textContent`), /Anna|Continua/, 'Dopo la ricarica «Continua» c’è.');
  await evaluate(`document.querySelector('[data-menu=continua]').click(), true`); await wait(() => evaluate(`Boolean(document.querySelector('.page-wrap'))`));
  assert.equal((await who()).name, 'Anna Prima', 'Dopo la ricarica del browser la carriera caricata è quella in corso.');
  assert.deepEqual(errors, [], 'Nessun errore in pagina.');
});
console.log('Più carriere verificate in Chrome: due carriere create e salvate, «Carica partita» dalla schermata iniziale e da dentro la partita entra davvero nella carriera scelta (nome, ruolo, partito, settimana, data), anche con i cinque slot pieni (nessuno toccato, la carriera lasciata nella sua copia automatica) e dopo la ricarica del browser.');
