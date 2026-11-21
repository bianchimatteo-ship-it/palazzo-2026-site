// QA screenshots of the new scene variety (ambience, bystander, atmosphere line): one activity of each kind of room, opening and first question, at 390 and 1280. QA_SHOT_DIR (default artifacts/qa/screenshots/after).
import { mkdirSync } from 'node:fs';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.log('Schermate saltate: Chrome non trovato.'); process.exit(0); }
const dir = process.env.QA_SHOT_DIR ?? 'artifacts/qa/screenshots/after'; mkdirSync(dir, { recursive: true });
const ACTIVITIES = ['associazioni', 'sopralluogo', 'riunione', 'audizione-commissione', 'intervista', 'cittadini'];
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, send, screenshot, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); document.querySelectorAll('[data-report-close],[data-news-popup-close],[data-confirm=cancel]').forEach(b => b.click()); true`);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  for (const id of ACTIVITIES) {
    for (const [w, h, tag] of [[1280, 900, '1280'], [390, 844, '390']]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: tag === '390' ? 2 : 1, mobile: tag === '390' }); await pause(300);
      const started = await S(`store.getState().game.week.ap = 6; try { await store.startActivityScene(${JSON.stringify(id)}, {}); } catch (e) { return e.message; } return true;`);
      if (started !== true) { console.log('non avviata', id, started); continue; }
      try { await wait(() => evaluate('Boolean(document.querySelector(".scene[data-scene-kind=attivita] .st-svg"))'), 8000); } catch { console.log('scena non disegnata', id, tag, await S('return JSON.stringify(Object.keys(store.getState().scene ?? {}).slice(0,4)) + (store.getState().scene?.kind ?? "")')); continue; }
      await pause(900);
      await screenshot(`${dir}/scena-variata-${id}-${tag}.png`);
      await S('try { store.sceneAbandon(); } catch (e) { return e.message; } return true;'); await pause(600);
      await evaluate(`location.hash = '#panoramica'; true`); await pause(900);
    }
  }
});
console.log('qa-scene-variety-shots: ok');
