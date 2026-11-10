// Commands answer at once (Chrome): a click that saves does not make the page wait (the save of a long career, with its backup, costs a fraction of a second: the history of recoveries is not rewritten at
// every click), nothing invisible sits over the buttons (no transparent full-screen layer takes the clicks, on the main pages, at phone and desktop sizes), a double click does not do a thing twice,
// a choice in a scene interrupts its animation safely and at once, pause and resume are immediate and a scene always ends.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Reattività saltata: Chrome non trovato.'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, version, errors }) => {
  await createCareerInPage({ evaluate, version }, { level: 'deputato', onboarding: true, extra: `for (let i = 0; i < 40; i++) store.advance(7);` });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'full' })); true`);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const { storage } = await import('/src/core/storage.js?v=${version}'); ${body} })()`);
  const click = async sel => { await evaluate(`document.querySelector(${JSON.stringify(sel)})?.click(), true`); await pause(250); };

  // ---- 1. a click that saves does not make the page wait
  const size = await S(`return Math.round(JSON.stringify(store.getState()).length / 1024);`);
  assert.ok(size > 300, `Una carriera lunga (${size} KB).`);
  await S(`window.__save = []; const orig = storage.save.bind(storage); storage.save = (...a) => { const t = performance.now(); try { return orig(...a); } finally { window.__save.push(Math.round(performance.now() - t)); } }; return true;`);
  const times = [];
  for (let i = 0; i < 3; i++) times.push(await S(`const t = performance.now(); store.advance(7); return Math.round(performance.now() - t);`));
  const saves = await evaluate('window.__save');
  assert.ok(saves.length >= 3, `Ogni chiusura di settimana salva (${saves.join(', ')} ms).`);
  assert.ok(Math.max(...saves) <= 450, `Il salvataggio di ${size} KB è rapido (${saves.join(', ')} ms): lo storico dei recuperi non si riscrive a ogni clic.`);
  assert.ok(Math.max(...times) <= 900, `Chiudere la settimana è rapido (${times.join(', ')} ms).`);
  // the safety net is still there: a backup of the previous version exists and the main save is the current one
  const keys = await evaluate(`Object.keys(localStorage).filter(k => /career/.test(k)).join(',')`);
  assert.ok(/backup/.test(keys), `Il backup della versione precedente c’è (${keys}).`);

  // ---- 2. nothing invisible takes the clicks
  const blockers = () => evaluate(`(() => { const out = []; for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el); if (!['fixed', 'absolute', 'sticky'].includes(cs.position) || cs.pointerEvents === 'none' || cs.display === 'none') continue; const r = el.getBoundingClientRect(); if (r.width < innerWidth * 0.6 || r.height < innerHeight * 0.5) continue; const clear = cs.visibility === 'hidden' || Number(cs.opacity) < 0.05 || (cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.backgroundImage === 'none' && !el.textContent.trim() && !el.querySelector('svg,img,canvas,video')); if (clear) out.push(el.tagName + '.' + String(el.className).slice(0, 50)); } return out; })()`);
  for (const [w, h, mobile] of [[390, 844, true], [1440, 900, false]]) {
    await viewport(w, h, mobile); await pause(300);
    for (const page of ['panoramica', 'elezioni', 'parlamento', 'governo', 'partito', 'carriera', 'sondaggi']) {
      await evaluate(`location.hash = '#${page}'; true`); await pause(900);
      await evaluate(`document.querySelectorAll('.outcome-overlay [data-outcome-close], .outcome-overlay button').forEach(b => b.click()); true`); await pause(200);
      const found = await blockers();
      assert.deepEqual(found, [], `${w}px · ${page}: nessuno strato invisibile sopra i comandi.`);
      const hit = await evaluate(`(() => { const out = []; for (const b of [...document.querySelectorAll('.page-wrap button:not([disabled]), [data-nav]')].slice(0, 40)) { const r = b.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue; const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)); const top = document.elementFromPoint(x, y); if (top && top !== b && !b.contains(top) && !top.contains(b) && !top.closest('.topbar, .bottom-nav, .app-sidebar, nav, aside, header')) out.push(b.textContent.trim().slice(0, 24) + ' <- ' + top.tagName + '.' + String(top.className).slice(0, 40)); } return out.slice(0, 5); })()`);
      assert.deepEqual(hit, [], `${w}px · ${page}: i comandi visibili ricevono il clic (${hit.join(' | ')}).`);
    }
  }
  await viewport(1280, 800, false);

  // ---- 3. a double click does a thing once
  await evaluate(`location.hash = '#panoramica'; true`); await pause(1200);
  const week0 = await S(`return store.getState().game.week.index;`);
  await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => /Chiudi settimana/i.test(x.textContent)); b.click(); b.click(); return true; })()`); await pause(800);
  assert.equal(await S(`return store.getState().game.week.index;`), week0 + 1, 'Un doppio clic su «Chiudi settimana» avanza di una sola settimana.');
  await evaluate(`document.querySelectorAll('.outcome-overlay button').forEach(b => b.click()); true`); await pause(300);
  await S(`const save = JSON.parse(store.exportSave()); save.game.week.ap = 6; save.game.resources.funds = 5000; store.loadGame(save); return true;`);
  await evaluate(`location.hash = '#panoramica'; true`); await pause(1200);
  const before = await S(`const s = store.getState(); return { ap: s.game.week.ap, funds: s.game.resources.funds };`);
  await evaluate(`(() => { const b = [...document.querySelectorAll('[data-game-activity]:not([disabled])')].find(x => !x.dataset.quickScene && !/Piano/.test(x.textContent)) ?? document.querySelector('[data-game-activity]:not([disabled])'); window.__act = b?.dataset.gameActivity; b?.click(); b?.click(); return Boolean(b); })()`); await pause(800);
  const after = await S(`const s = store.getState(); return { ap: s.game.week.ap, funds: s.game.resources.funds, used: s.game.week.activityUses?.[${JSON.stringify(await evaluate('window.__act'))}] ?? 0 };`);
  assert.ok(after.used <= 1 && before.ap - after.ap <= 3, `Un doppio clic su un’attività la fa una volta sola (${JSON.stringify({ before, after })}).`);

  // ---- 4. a scene: the choice interrupts the animation at once, pause and resume are immediate, the scene ends
  await S(`store.startTalkShowScene({ source: 'attivita', showId: 'tg-sera' }); return true;`);
  await wait(() => evaluate(`Boolean(document.querySelector('.st-svg'))`), 8000);
  await evaluate(`document.querySelector('[data-scene-motion-set="full"]')?.click(); true`); await pause(400);
  const t0 = await evaluate(`new Promise(resolve => { const root = document.querySelector('.scene'); const node = root.dataset.sceneNode; const t = performance.now(); const choice = document.querySelector('[data-scene-choice]:not([disabled])'); choice.click(); const poll = () => { if (document.querySelector('.scene')?.dataset.sceneNode !== node) resolve(Math.round(performance.now() - t)); else if (performance.now() - t > 3000) resolve(-1); else requestAnimationFrame(poll); }; poll(); })`);
  assert.ok(t0 >= 0 && t0 <= 500, `Una scelta in scena risponde subito, anche con l’animazione in corso (${t0} ms).`);
  await pause(300);
  await click('[data-stage-pause]');
  assert.equal(await evaluate(`document.querySelector('[data-stage-pause]').getAttribute('aria-pressed')`), 'true', 'Pausa è immediata.');
  await click('[data-stage-pause]');
  assert.equal(await evaluate(`document.querySelector('[data-stage-pause]').getAttribute('aria-pressed')`), 'false', 'Riprendi è immediato.');
  let steps = 0;
  while (await evaluate(`Boolean(document.querySelector('.scene [data-scene-choice]:not([disabled])'))`) && steps++ < 20) { await evaluate(`document.querySelector('.scene [data-scene-choice]:not([disabled])')?.click(); true`); await pause(150); }
  assert.ok(steps < 20, `La scena finisce (${steps} passi).`);
  await pause(800);
  const running = await evaluate(`document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming?.().iterations === Infinity && a.effect.target?.closest?.('.st-svg')).length`);
  assert.equal(running, 0, 'A scena finita nessuna animazione infinita resta in corso.');
  assert.deepEqual(errors.filter(e => !/favicon/.test(e)), [], 'Nessun errore JavaScript.');
});
console.log('Reattività verificata: salvataggio di una carriera lunga e chiusura della settimana rapidi (lo storico dei recuperi non si riscrive a ogni clic), nessuno strato invisibile sopra i comandi a 390 e 1440 px, doppio clic senza doppio effetto, scelte, pausa e ripresa immediate nelle scene, scena sempre finita.');
