// Frame-rate probe of the animated scenes in real Chrome: the citizens' meeting (the busiest stage) in each motion mode, at normal speed and with the CPU slowed 4× (a modest phone).
// It reports frames per second, long frames, the number of DOM nodes of the stage and the animations running. Run: node scripts/scene-perf-probe.mjs [--check]
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.log('Probe prestazioni scene: Chrome non disponibile.'); process.exit(0); }
const rows = {};
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, send, version }) => {
  await createCareerInPage({ evaluate, version }, { level: 'deputato', onboarding: true, extra: '' });
  await openCareer({ evaluate, goto, waitFor: wait });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  let started = false;
  for (const motion of ['complete', 'ridotte', 'off']) for (const slow of [1, 4]) {
    await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', language: 'it', weeklyReport: 'off', sceneMotion: ${JSON.stringify(motion)} })); true`);
    if (!started) {
      await openCareer({ evaluate, goto, waitFor: wait }); await pause(600);
      const note = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); let note = 'ok'; try { await store.startActivityScene('cittadini'); } catch (error) { note = error.message; } return note + ' scene=' + Boolean(store.getState().scene); })()`);
      assert.match(note, /scene=true/, `Scena non avviata: ${note}`); started = true;
    } else { await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); store.navigate('elezioni'); return true; })()`); await wait(() => evaluate(`Boolean(document.querySelector('.scene-stage'))`)); }
    await pause(1500);
    if (process.env.DEBUG_PROBE) console.log(await evaluate(`JSON.stringify({ shell: document.querySelector('.app-shell')?.className, scene: Boolean(document.querySelector('[class*="scene"]')), stage: [...document.querySelectorAll('[class*="stage"]')].slice(0, 3).map(el => el.className) })`));
    await send('Emulation.setCPUThrottlingRate', { rate: slow });
    const result = await evaluate(`new Promise(resolve => { const t = []; let last = performance.now(); const start = last; const tick = now => { t.push(now - last); last = now; if (now - start < 4000) requestAnimationFrame(tick); else resolve({ frames: t.length, fps: Math.round(t.length / ((now - start) / 1000)), long: t.filter(x => x > 50).length, worst: Math.round(Math.max(...t)), nodes: document.querySelectorAll('.scene-shell *, [data-stage] *').length, svg: document.querySelectorAll('svg *').length }); }; requestAnimationFrame(tick); })`);
    await send('Emulation.setCPUThrottlingRate', { rate: 1 });
    rows[`${motion} · CPU ${slow}×`] = result;
  }
});
console.table(rows);
if (process.argv.includes('--check')) { const c = rows['complete · CPU 1×']; assert.ok(c.fps >= 50, `Complete a velocità normale: almeno 50 fps (${c.fps}).`); assert.ok(rows['complete · CPU 4×'].fps >= 24, `Complete con CPU 4× rallentata: almeno 24 fps (${rows['complete · CPU 4×'].fps}).`); console.log('Prestazioni delle scene nei limiti.'); }
