// Campagna: «Decidi come impiegare le risorse» (le attività) sta subito sotto le risorse della campagna e prima del consenso territoriale e delle altre metriche. Un solo blocco (non due
// copie), con tutti i suoi gruppi, pulsanti, costi, selettori e rischi; sposta l'ordine della pagina, non gli effetti: un'attività si fa e cambia fondi/giorni come prima.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Ordine della Campagna nel browser saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { level: 'comunale', onboarding: true, extra: `store.fastForwardToElection('comunale'); store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, real.realDatabase.parties); store.getState().campaign.nomination.status = 'approved'; store.save();` });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`location.hash = '#elezioni'; true`);
  await pause(800);
  await evaluate(`(() => { const tab = [...document.querySelectorAll('button, a, [role="tab"]')].find(el => /^\\s*Campagna\\s*$/i.test(el.textContent)); tab?.click(); return true; })()`);
  await wait(() => evaluate(`Boolean(document.querySelector('.campaign-activities'))`), 20000);
  for (const [name, w, h, mobile] of [['computer', 1280, 900, false], ['smartphone', 390, 800, true], ['smartphone stretto', 320, 700, true]]) {
    await viewport(w, h, mobile); await pause(500);
    const order = await evaluate(`(() => { const at = sel => { const e = document.querySelector(sel); return e ? [...document.querySelectorAll('.campaign-active-head ~ *, .campaign-active-head')].indexOf(e) : -1; };
      const root = document.querySelector('.campaign-resource-line')?.parentElement; const kids = root ? [...root.children] : [];
      const idx = sel => kids.findIndex(el => el.matches(sel) || el.querySelector(sel));
      return { resources: idx('.campaign-resource-line'), activities: idx('.campaign-activities'), metrics: idx('.campaign-metrics'), territories: idx('.campaign-territories'), opponents: idx('.campaign-opponents'), copies: document.querySelectorAll('.campaign-activities').length, groups: document.querySelectorAll('.campaign-activity-group').length, buttons: document.querySelectorAll('[data-campaign-activity]').length, selectors: ['[data-campaign-territory]', '[data-campaign-topic]'].every(s => document.querySelectorAll(s).length === 1), over: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
    assert.ok(order.resources >= 0 && order.activities === order.resources + 1, `${name}: le attività seguono subito le risorse (${JSON.stringify(order)}).`);
    assert.ok(order.activities < order.metrics && order.metrics < order.territories && order.territories <= order.opponents, `${name}: poi il consenso territoriale e le altre metriche (${JSON.stringify(order)}).`);
    assert.equal(order.copies, 1, `${name}: un solo blocco, nessuna seconda copia.`);
    assert.ok(order.groups >= 4 && order.buttons >= 8 && order.selectors, `${name}: gruppi, pulsanti e selettori intatti (${order.groups} gruppi, ${order.buttons} pulsanti).`);
    assert.equal(order.over, false, `${name}: nessuno scorrimento orizzontale.`);
  }
  await viewport(1280, 900, false); await pause(400);
  // the effects are those of before: an activity spends what it costs and is written in the register of the campaign
  const before = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const c = store.getState().campaign; return { history: c.history.length, days: c.resources?.days ?? null, funds: c.resources?.funds ?? null, state: JSON.stringify(c.resources ?? {}) }; })()`);
  const clicked = await evaluate(`(() => { const b = [...document.querySelectorAll('[data-campaign-activity]')].find(x => !x.disabled); if (!b) return null; const id = b.dataset.campaignActivity; b.click(); return id; })()`);
  assert.ok(clicked, 'Almeno un’attività è disponibile.');
  await pause(700);
  const after = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const c = store.getState().campaign; return { history: c.history.length, state: JSON.stringify(c.resources ?? {}), last: c.history[0]?.text ?? '' }; })()`);
  assert.ok(after.history > before.history && after.state !== before.state, `Fare l'attività «${clicked}» la scrive nel registro e consuma risorse (${before.history} → ${after.history}).`);
  assert.equal(await evaluate(`document.querySelectorAll('.campaign-activities').length`), 1, 'Dopo il ridisegno resta un solo blocco.');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
});
console.log('Ordine della Campagna verificato (computer, 390 e 320 px): risorse, poi attività (un solo blocco, tutti i gruppi, pulsanti e selettori), poi consenso territoriale e metriche, poi geografia e contendenti; un’attività fatta consuma risorse e entra nel registro come prima.');
