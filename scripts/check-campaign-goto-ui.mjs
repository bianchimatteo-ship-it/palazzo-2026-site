// «Candidati» in the browser with TWO open votes of the same type: the button of the second one leads to ITS candidacy (the exact id), in one click, with «Candidati e inizia la campagna» in view without scrolling
// (desktop and phone), the campaign then starts for that vote, a second tap changes nothing, and a vote that cannot be run for says why. Comunali and politiche. Chrome; skipped without it.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.log('Candidati con più elezioni nel browser: SKIPPED (Chrome non trovato, imposta CHROME_PATH).'); process.exit(0); }

for (const [type, level, role] of [['comunale', 'comunale', 'sindaco'], ['politiche', 'regionale', 'deputato']]) {
  await withBrowser(async browser => {
    const { evaluate, waitFor: wait, pause, viewport, errors, version } = browser;
    const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    const dismiss = () => evaluate(`document.querySelectorAll('[data-outcome-dismiss],[data-news-popup-close]').forEach(el => el.click()); true`);
    await createCareerInPage(browser, { weeks: 1, level, extra: `store.fastForwardToElection('${type}'); store.save();` });
    await openCareer(browser); await dismiss();
    // a second open vote of the same type, first in the list so that «the first of its type» would be the wrong one
    const ids = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const g = store.getState().game; const first = g.elections.find(item => item.type === '${type}' && item.status === 'open'); const twin = { ...first, id: first.id + '-bis', label: first.label + ' (seconda tornata)' }; g.elections = [twin, ...g.elections]; store.save(); return JSON.stringify({ first: first.id, twin: twin.id, twinLabel: twin.label }); })()`).then(JSON.parse);
    for (const [name, w, h, mobile] of [['desktop', 1280, 800, false], ['smartphone', 390, 844, true]]) {
      await viewport(w, h, mobile); await pause(500); await dismiss();
      await evaluate(`location.hash = '#elezioni'; true`); await pause(900); await dismiss();
      await evaluate(`document.querySelector('[data-section-tab="elezioni"][data-section-tab-value="panoramica"]')?.click(), true`); await pause(500);
      // the button of the SECOND vote (exact id)
      const buttons = await evaluate(`[...document.querySelectorAll('[data-campaign-goto-id]')].map(b => b.dataset.campaignGotoId)`);
      assert.ok(buttons.includes(ids.twin), `${type}/${name}: la seconda tornata ha il suo pulsante «Candidati» (${buttons}).`);
      await evaluate(`(() => { const b = document.querySelector('[data-campaign-goto-id="${ids.twin}"]'); b.scrollIntoView({ block: 'center' }); b.click(); return true; })()`);
      await wait(() => has('.campaign-cta [data-action="campaign-start"]'), 8000); await pause(900);
      const seen = await evaluate(`(() => { const b = document.querySelector('.campaign-cta [data-action="campaign-start"]'); const r = b.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, challenge: document.querySelector('[data-campaign-cta]').dataset.challenge, target: document.querySelector('[data-campaign-target]')?.dataset.campaignTarget, started: Boolean(document.querySelector('[data-campaign-running]')), type: document.querySelector('[data-campaign-setup="electionType"]')?.value }; })()`);
      assert.equal(seen.challenge, ids.twin, `${type}/${name}: la sfida mostrata è la tornata scelta, non la prima dello stesso tipo (${seen.challenge}).`);
      assert.equal(seen.target, ids.twin, `${type}/${name}: la riga della tornata è quella scelta.`);
      assert.equal(seen.type, type, `${type}/${name}: tipo di elezione già impostato.`);
      assert.ok(seen.top >= 0 && seen.bottom <= seen.vh, `${type}/${name}: «Candidati e inizia la campagna» è visibile subito dopo UN clic (${seen.top}–${seen.bottom} su ${seen.vh}).`);
      assert.equal(seen.started, false, `${type}/${name}: la campagna non parte da sola.`);
      // a second tap on the same «Candidati» is harmless: same vote, same place
      await evaluate(`document.querySelector('[data-campaign-goto-id="${ids.twin}"]')?.click(), true`); await pause(400);
      assert.equal(await evaluate(`document.querySelector('[data-campaign-cta]')?.dataset.challenge`), ids.twin, `${type}/${name}: un secondo clic non cambia la scelta.`);
      await evaluate(`location.hash = '#panoramica'; true`); await pause(400);
    }
    // the campaign starts for the chosen vote
    await viewport(1280, 800, false); await pause(400);
    await evaluate(`location.hash = '#elezioni'; true`); await pause(700); await dismiss();
    await evaluate(`document.querySelector('[data-section-tab="elezioni"][data-section-tab-value="panoramica"]')?.click(), true`); await pause(400);
    await evaluate(`document.querySelector('[data-campaign-goto-id="${ids.twin}"]').click(), true`);
    await wait(() => has('.campaign-cta [data-action="campaign-start"]'), 8000); await pause(600);
    await evaluate(`document.querySelector('.campaign-cta [data-action="campaign-start"]').click(), true`); await pause(1200);
    const started = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const c = store.getState().campaign; return JSON.stringify({ status: c?.status ?? null, electionId: c?.electionId ?? null, toast: store.getState().ui.toast ?? '' }); })()`).then(JSON.parse);
    if (started.status === 'active') assert.equal(started.electionId, ids.twin, `${type}: la campagna è partita per la tornata scelta (${started.electionId}).`);
    else assert.ok(started.toast && !/non è più in calendario|corrisponde/.test(started.toast), `${type}: se non parte, dice perché (${started.toast}).`);
    assert.deepEqual(errors, [], `${type}: nessun errore JavaScript.`);
    console.log(`${type}: campagna ${started.status ?? 'non partita'} per ${started.electionId ?? '—'}${started.toast ? ` · «${String(started.toast).slice(0, 80)}»` : ''}`);
  });
}
console.log('«Candidati» con due elezioni dello stesso tipo (comunali e politiche): conduce alla candidatura esatta con un clic, pulsante visibile subito su desktop e smartphone, secondo clic innocuo, campagna per la tornata scelta.');
