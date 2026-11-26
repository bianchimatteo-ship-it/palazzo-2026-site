// QA screenshots of the rooms of the activity scenes (ui/room-art.js), in the real page: one scene for each room, opened at its first question, at 820 x 1180 and 390 x 844 (OUT, default
// artifacts/qa/screenshots/after/scene-rooms). The scene is built by the engine (core/activity-scenes.js) and loaded into the career like a scene in progress: nothing else of the career changes.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
const OUT = process.env.OUT ?? 'artifacts/qa/screenshots/after/scene-rooms';
const NODE = process.env.NODE_ID ?? 'q1';
await mkdir(OUT, { recursive: true });
const ROOMS = [['comizio-piazza', 'associazioni'], ['conferenza-stampa-governo', 'redazione'], ['diplomazia', 'sede'], ['intergruppo-europeo', 'consiglio'], ['social', 'redazione'], ['corso-politiche', 'commissione'], ['riunione-giunta', 'commissione'], ['raccolta', 'sede'], ['bando-europeo-territorio', 'cantiere'], ['incontro-sindaci', 'associazioni'], ['question-time', 'commissione'], ['cittadini', 'associazioni'], ['intervista', 'redazione'], ['consiglio-ministri', 'consiglio']];
const shots = [];
await withBrowser(async browser => {
  const { evaluate, pause, viewport, screenshot, version } = browser;
  await createCareerInPage(browser, { level: 'deputato', weeks: 0 });
  await openCareer(browser);
  for (const [activityId, sceneKey] of ROOMS) {
    for (const [w, h] of [[820, 1180], [390, 844]]) {
      await viewport(w, h);
      const ok = await evaluate(`(async () => {
        const { store } = await import('/src/core/store.js?v=${version}');
        const S = await import('/src/core/activity-scenes.js?v=${version}');
        const s = store.getState();
        const player = s.dataset.politicians.find(item => item.id === s.career.playerId);
        const scene = S.createActivityScene({ id: 'qa-${activityId}', seed: 'qa|${activityId}', sceneKey: '${sceneKey}', activityId: '${activityId}', player: { name: player.displayName ?? player.name }, playerAvatar: player.avatar ?? null, situation: { party: true, funds: true, capital: true } });
        scene.nodeId = ${JSON.stringify(NODE)};
        const file = JSON.parse(store.exportSave()); file.scene = scene; store.loadGame(JSON.stringify(file));
        return Boolean(store.getState().scene);
      })()`);
      await pause(1600);
      const file = join(OUT, `scena-${activityId}-${NODE}-${w}x${h}.png`);
      await screenshot(file);
      const box = await evaluate(`(() => { const st = document.querySelector('.scene-stage svg'); const d = document.querySelector('.scene-dialogue'); const c = document.querySelector('.scene-choices'); const r = e => e ? e.getBoundingClientRect() : null; return { setting: st?.getAttribute('data-setting'), stage: r(st), dialogue: r(d), choices: r(c), overflow: document.documentElement.scrollWidth > innerWidth }; })()`);
      shots.push({ activityId, w, h, ok, file, ...box });
    }
  }
});
for (const shot of shots) console.log(`${shot.activityId.padEnd(26)} ${shot.w}x${shot.h} ${shot.setting ?? '—'} stage ${Math.round(shot.stage?.width ?? 0)}x${Math.round(shot.stage?.height ?? 0)} overflow ${shot.overflow}`);
