// Campagna conclusa: «Prepara una nuova elezione» sta subito dopo il risultato (prima dello storico), è un solo pulsante, grande e raggiungibile su computer e smartphone;
// l'azione resta data-action="campaign-new" e svuota la campagna come prima.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Azione di fine campagna nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { level: 'comunale', onboarding: true, extra: `store.fastForwardToElection('comunale'); store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, real.parties ?? []);` });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); for (let i = 0; i < 80 && store.getState().campaign?.status !== 'finished'; i++) store.advance(7); return store.getState().campaign?.status; })()`).then(status => assert.equal(status, 'finished', 'La campagna si conclude.'));
  await evaluate(`location.hash = '#elezioni'; true`); await pause(900);
  await evaluate(`(() => { [...document.querySelectorAll('button')].filter(b => /^Chiudi$/.test(b.textContent.trim()) && b.closest('aside,[role=dialog]')).forEach(b => b.click()); const tab = [...document.querySelectorAll('button, a, [role="tab"]')].find(el => /^\\s*Campagna\\s*$/i.test(el.textContent)); tab?.click(); return true; })()`);
  await wait(() => evaluate(`Boolean(document.querySelector('.campaign-result-head'))`), 20000);
  for (const [name, w, h, mobile] of [['computer', 1440, 900, false], ['tablet', 768, 900, true], ['smartphone', 390, 800, true], ['smartphone stretto', 320, 700, true]]) {
    await viewport(w, h, mobile); await pause(500);
    const r = await evaluate(`(() => { const root = document.querySelector('.campaign-result-head').parentElement; const kids = [...root.children]; const idx = sel => kids.findIndex(el => el.matches(sel) || el.querySelector(sel));
      const btn = document.querySelector('[data-action="campaign-new"]'); const box = btn?.getBoundingClientRect(); const cs = btn && getComputedStyle(btn); const d = document.documentElement;
      return { head: idx('.campaign-result-head'), actions: idx('.campaign-result-actions'), history: idx('.campaign-history'), buttons: document.querySelectorAll('[data-action="campaign-new"]').length, w: box?.width, h: box?.height, top: box?.top, fs: parseFloat(cs?.fontSize), text: btn?.textContent.trim(), over: d.scrollWidth > innerWidth + 1, inView: box && box.right <= innerWidth + 1 && box.left >= -1 }; })()`);
    assert.ok(r.head === 0 && r.actions > r.head && r.actions < r.history, `${name}: il pulsante segue il risultato e precede lo storico (${JSON.stringify(r)}).`);
    assert.equal(r.buttons, 1, `${name}: un solo pulsante «Prepara una nuova elezione».`);
    assert.equal(r.text, 'Prepara una nuova elezione');
    assert.ok(r.h >= 44 && r.w >= 160 && r.fs >= 15 && r.inView, `${name}: dimensioni e posizione adeguate (${r.w}×${r.h}, ${r.fs}px).`);
    assert.equal(r.over, false, `${name}: nessuno scorrimento orizzontale.`);
  }
  await viewport(390, 800, true); await pause(300);
  await evaluate(`document.querySelector('[data-action="campaign-new"]').click(); true`); await pause(700);
  assert.equal(await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); return store.getState().campaign; })()`), null, 'L’azione svuota la campagna come prima.');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
});
console.log('Fine campagna verificata (computer, 768, 390 e 320 px): un solo «Prepara una nuova elezione», subito dopo il risultato e prima dello storico, grande e dentro lo schermo; l’azione svuota la campagna.');
