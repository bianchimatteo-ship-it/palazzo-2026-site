// La telecamera delle scene delle attività segue la persona che parla o reagisce: l’inquadratura contiene davvero quell’attore (ospite 1 e ospite 2 non sono nello stesso punto in ogni stanza),
// i due ospiti hanno inquadrature diverse, e una reazione inquadra insieme il giocatore e chi reagisce. Prima la visuale era sempre «right» o «left» per qualunque interlocutore.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { ACTIVITY_SCENES, SCENE_KEYS, createActivityScene } = await load('src/core/activity-scenes.js');
const { chooseInScene, sceneNode } = await load('src/core/scene-engine.js');
const { stageOf, STAGE_W, STAGE_H } = await load('src/core/stage-script.js');
const { cameraTransform } = await load('src/ui/stage-art.js');
const make = (sceneKey, seed) => createActivityScene({ id: `t-${seed}`, seed, sceneKey, activityId: ACTIVITY_SCENES[sceneKey].activityIds[0], player: { name: 'Anna Verdi', tag: 'Deputata · Prova' }, playerAvatar: null, stats: { competence: 60, charisma: 55, reputation: 50 } });
const parse = camera => { const m = /^at:(-?[\d.]+):(-?[\d.]+):([\d.]+)$/.exec(camera); return m ? { x: Number(m[1]), y: Number(m[2]), s: Number(m[3]) } : null; };
let framed = 0, reactions = 0, seen = 0;
for (const key of SCENE_KEYS) {
  for (const seed of ['cam-1', 'cam-2', 'cam-3']) {
    let scene = make(key, seed);
    const guestCameras = { ospite1: new Set(), ospite2: new Set() };
    for (let guard = 0; guard < 30 && scene.status === 'active'; guard++) {
      const node = sceneNode(scene);
      const stage = stageOf(scene, node);
      const id = scene.nodeId;
      if (['q1', 'q2', 'q3', 'q4'].includes(id)) {
        seen++;
        const cam = parse(stage.camera);
        assert.ok(cam, `${key}/${id}: la camera è un’inquadratura sull’attore (${stage.camera}).`);
        const pose = stage.poses[node.speaker];
        assert.ok(pose, `${key}/${id}: chi parla ha una posa.`);
        // the speaker is inside the frame, near its centre
        const half = STAGE_W / (2 * cam.s);
        const left = Math.min(STAGE_W - half, Math.max(half, cam.x)) - half, right = left + 2 * half;
        assert.ok(pose.x >= left + 4 && pose.x <= right - 4, `${key}/${id}: ${node.speaker} (x=${pose.x}) è dentro l’inquadratura ${Math.round(left)}–${Math.round(right)}.`);
        assert.ok(cam.s >= 1.15 && cam.s <= 2, `${key}/${id}: ingrandimento ragionevole (${cam.s}).`);
        assert.match(cameraTransform(stage.camera), /^translate\(.*\) scale\(/, `${key}/${id}: la trasformazione si calcola.`);
        if (guestCameras[node.speaker]) guestCameras[node.speaker].add(Math.round(cam.x));
        framed++;
      } else if (['r1', 'r2', 'r3', 'r4'].includes(id) && node.reaction !== 'protesta') {
        const cam = parse(stage.camera);
        if (cam) { reactions++; for (const who of ['giocatore', node.speaker]) { const pose = stage.poses[who]; const half = STAGE_W / (2 * cam.s); const left = Math.min(STAGE_W - half, Math.max(half, cam.x)) - half; assert.ok(pose.x >= left - 1 && pose.x <= left + 2 * half + 1, `${key}/${id}: la reazione inquadra ${who}.`); } }
      }
      scene = chooseInScene(scene, node.choices.length === 1 ? node.choices[0][0] : node.choices[0][0]);
    }
    if (guestCameras.ospite1.size && guestCameras.ospite2.size) assert.notDeepEqual([...guestCameras.ospite1], [...guestCameras.ospite2], `${key}: ospite 1 e ospite 2 hanno inquadrature diverse.`);
  }
}
assert.ok(framed >= 30, `Inquadrature verificate (${framed}).`);
console.log(`Telecamera delle scene verificata: ${framed} inquadrature di chi parla (dentro il quadro), ${reactions} reazioni con giocatore e interlocutore nel quadro, ospiti 1 e 2 inquadrati in punti diversi in ogni stanza (${SCENE_KEYS.length} scene).`);
