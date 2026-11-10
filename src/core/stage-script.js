// The script of a scene on its stage: for every beat of a scene (scene-engine.js) WHERE each character stands, how (standing, walking, sitting, gesture), WHAT the camera frames and what the crowd does.
// It is a pure function of the scene (kind, node, history): the animation (ui/stage-player.js) only plays the passage from the poses of the previous beat to the poses of this one, so a scene saved
// and resumed, skipped or played with the motion off shows exactly the same poses — the final ones — and never repeats a beat that is over. The poses are the DECISIONS of the engines drawn on
// a stage: nothing here decides a result.
//
// Coordinates: the stage is 640 x 360 units; `x` is the centre of the figure, `y` the line of its feet (the lower, the nearer to the camera); `s` the scale of the figure (nearer = bigger).

import { formatOf } from './studio-lines.js?v=20261110-20';

export const STAGE_W = 640, STAGE_H = 360;
export const depthScale = y => Math.max(0.2, Math.min(0.72, 0.3 + (y - 170) / 190 * 0.34));
// A character never makes the same gesture for the same kind of beat: one is picked, by the seed of the scene and the beat, among the ones that suit the moment (speaking, listening, reacting).
const hashOf = text => { let h = 2166136261 >>> 0; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
export const SPEAK_GESTURES = ['sottolinea', 'apre', 'indica', 'palmi', 'petto', 'sottolinea', 'pensa'];
export const LISTEN_GESTURES = ['ascolta', 'appunti', 'esita', 'ascolta', 'dissenso', 'sorpresa'];
export const pickGesture = (scene, nodeId, who, list) => list[hashOf(`${scene.seed ?? scene.id}|${nodeId}|${who}`) % list.length];
export const stagePose = (x, y, extra = {}) => pose(x, y, extra);
const pose = (x, y, extra = {}) => ({ x, y, s: depthScale(y), facing: 1, posture: 'stand', gesture: null, visible: true, ...extra });
const away = (x, y) => pose(x, y, { visible: false });

// ---------- the television studio (debates and talk shows) ----------
// Where the people of a studio sit or stand, by format (core/studio-lines.js `formatOf`): the face-to-face debate has two lecterns and a moderator; the talk show a host's desk on the left and a sofa
// on the right; the news a desk on the left and two armchairs. Doors: the guests come in from the right in the two latter, from both sides at the lecterns.
const SEATS = {
  faccia: { giocatore: { x: 128, y: 292, facing: 1, posture: 'sit' }, rivale: { x: 512, y: 292, facing: -1, posture: 'sit' }, conduttore: { x: 320, y: 262, facing: 1, posture: 'stand' } },
  talk: { conduttore: { x: 176, y: 272, facing: 1, posture: 'sit' }, giocatore: { x: 436, y: 298, facing: -1, posture: 'sit' }, rivale: { x: 574, y: 298, facing: -1, posture: 'sit' } },
  intervista: { conduttore: { x: 211, y: 276, facing: 1, posture: 'sit' }, giocatore: { x: 436, y: 298, facing: -1, posture: 'sit' }, rivale: { x: 572, y: 298, facing: -1, posture: 'sit' } }
};
const DOORS = { faccia: { giocatore: { x: -70, y: 300 }, rivale: { x: 710, y: 300 }, conduttore: { x: 320, y: 262 } }, talk: { giocatore: { x: 700, y: 300 }, rivale: { x: 760, y: 300 }, conduttore: { x: 176, y: 272 } }, intervista: { giocatore: { x: 700, y: 300 }, rivale: { x: 760, y: 300 }, conduttore: { x: 211, y: 276 } } };
const STUDIO_ORDER = ['invito', 'preparazione', 'ingresso', 'q1', 'r1', 'domanda', 'risposta-rivale', 'q2', 'r2', 'attacco', 'r3', 'chiusura', 'esito'];

function studioPoses(scene, nodeId, node) {
  const format = formatOf(scene), seats = SEATS[format], doors = DOORS[format];
  const at = STUDIO_ORDER.indexOf(nodeId);
  const seated = at >= STUDIO_ORDER.indexOf('ingresso') && nodeId !== 'esito';
  const out = {};
  for (const member of scene.cast) {
    const seat = seats[member.role] ?? seats.rivale, door = doors[member.role] ?? doors.rivale;
    const speaking = node?.speaker === member.id;
    const gesture = speaking ? (node.gesture && node.gesture !== 'sottolinea' ? node.gesture : pickGesture(scene, nodeId, member.id, SPEAK_GESTURES)) : (node?.speaker && at >= 3 ? pickGesture(scene, nodeId, member.id, LISTEN_GESTURES) : null);
    if (member.role === 'conduttore') out[member.id] = pose(seat.x, seat.y, { posture: seat.posture, gesture: nodeId === 'esito' ? 'saluta' : gesture, facing: seat.facing });
    else if (nodeId === 'invito' || nodeId === 'preparazione') out[member.id] = member.role === 'giocatore' && nodeId === 'preparazione' ? pose(format === 'faccia' ? 150 : 520, 300, { gesture: 'pensa', facing: format === 'faccia' ? 1 : -1 }) : away(door.x, door.y);
    else if (nodeId === 'esito') out[member.id] = format === 'faccia' ? pose(member.role === 'giocatore' ? 90 : 550, 300, { gesture: 'saluta', posture: 'stand' }) : pose(seat.x, seat.y, { gesture: 'saluta', posture: 'stand', facing: seat.facing });
    else if (seated) out[member.id] = pose(seat.x, seat.y, { posture: seat.posture, gesture, facing: seat.facing });
    else out[member.id] = pose(seat.x, seat.y, { gesture, facing: seat.facing });
  }
  return out;
}
const studioCrowd = (scene, node) => {
  if (formatOf(scene) === 'intervista') return 'quiet';
  if (!node?.audience) return scene.audience.mood >= 60 ? 'warm' : 'quiet';
  const mood = scene.audience.mood;
  return mood >= 58 ? 'applause' : mood < 45 ? 'boo' : 'mixed';
};
// The shots by format: the host, the player and the other guest are not where they are in the other studios, so each studio has its own framings (stage-art.js CAMERAS).
const studioCamera = (scene, node) => {
  const format = formatOf(scene), shot = node?.camera ?? 'wide', base = ({ wide: 'wide', host: 'host', player: 'left', rival: 'right', crowd: 'crowd' })[shot] ?? 'wide';
  if (format === 'faccia') return base;
  if (base === 'crowd' && format === 'intervista') return 'wide';
  return base === 'wide' || base === 'crowd' ? base : `${format}-${base}`;
};

// ---------- the square (rallies) ----------
const STAGE_MIC = { x: 330, y: 222 };
const RALLY_STEPS = [{ x: 40, y: 330 }, { x: 230, y: 332 }, { x: 262, y: 246 }, STAGE_MIC];
function rallyPoses(scene, nodeId, node) {
  const me = scene.cast.find(item => item.role === 'giocatore');
  const out = {};
  const speaking = node?.speaker === me.id;
  const gesture = speaking ? (node.gesture && node.gesture !== 'sottolinea' ? node.gesture : pickGesture(scene, nodeId, 'comiziante', SPEAK_GESTURES)) : null;
  const interrupted = scene.protest?.state === 'degenerata' || scene.interrupted;
  if (nodeId === 'arrivo') out[me.id] = pose(RALLY_STEPS[0].x, RALLY_STEPS[0].y, { gesture: 'saluta' });
  else if (nodeId === 'cammino') out[me.id] = pose(STAGE_MIC.x - 22, STAGE_MIC.y, { path: RALLY_STEPS, gesture: 'saluta' });
  else if (nodeId === 'esito') out[me.id] = interrupted ? pose(-60, 232, { facing: -1, path: [{ x: 300, y: 226 }, { x: 150, y: 232 }, { x: -60, y: 232 }] }) : pose(-50, 228, { facing: -1, path: [{ x: 290, y: 226 }, { x: 150, y: 230 }, { x: -50, y: 228 }], gesture: 'saluta' });
  else out[me.id] = pose(STAGE_MIC.x, STAGE_MIC.y, { gesture: gesture ?? (nodeId === 'contestazione' ? 'ascolta' : 'sottolinea'), facing: nodeId === 'contestazione' ? 1 : 1 });
  for (const member of scene.cast.filter(item => item.role === 'sostenitore' || item.role === 'contestatore')) {
    out[member.id] = member.role === 'contestatore'
      ? (['contestazione', 'tema2', 'chiusura', 'esito'].includes(nodeId) && scene.protest?.arrived ? pose(member.x, member.y, { gesture: nodeId === 'contestazione' ? 'indica' : 'sottolinea' }) : away(740, member.y))
      : pose(member.x, member.y, { gesture: null });
  }
  return out;
}
function rallyCrowd(scene, nodeId, node) {
  if (scene.protest?.arrived && ['contestazione'].includes(nodeId)) return 'protest';
  if (nodeId === 'arrivo' || nodeId === 'cammino') return 'welcome';
  if (nodeId === 'esito') return scene.protest?.state === 'degenerata' ? 'boo' : (scene.audience.mood >= 58 ? 'cheer' : scene.audience.mood < 45 ? 'boo' : 'mixed');
  if (!node?.audience && !['saluto', 'tema1', 'tema2', 'chiusura'].includes(nodeId)) return 'quiet';
  const mood = scene.audience.mood;
  return mood >= 62 ? 'cheer' : mood >= 54 ? 'applause' : mood < 42 ? 'boo' : 'mixed';
}
const RALLY_CAMERA = { arrivo: 'panorama', cammino: 'follow', saluto: 'stage', tema1: 'stage', contestazione: 'protest', tema2: 'stage', chiusura: 'player', esito: 'wide' };

// ---------- the polling station (the vote) ----------
const VOTE_POSES = {
  ingresso: { x: 560, y: 262, path: [{ x: 600, y: 262 }, { x: 560, y: 262 }], gesture: null, prop: 'desk', booth: 'open' },
  banco: { x: 300, y: 300, path: [{ x: 440, y: 300 }, { x: 300, y: 300 }], gesture: 'prende', prop: 'hand', booth: 'open' },
  cabina: { x: 474, y: 286, path: [{ x: 400, y: 318 }, { x: 474, y: 300 }], gesture: null, prop: 'hand', booth: 'closed' },
  // in the booth the voter stays in view above the curtain (head, shoulders, hands): the ballot is in the hand that writes, then folded in both, never hidden or floating
  voto: { x: 474, y: 286, gesture: 'scrive', prop: 'hand', booth: 'closed' },
  piega: { x: 474, y: 286, gesture: 'piega', prop: 'folded', booth: 'closed' },
  esce: { x: 440, y: 304, path: [{ x: 474, y: 300 }, { x: 440, y: 308 }], gesture: null, prop: 'folded', booth: 'open' },
  // the voter stands beside the urn (to its right, facing it), never on top of it: the folded ballot goes into the slot at the top
  urna: { x: 226, y: 308, path: [{ x: 300, y: 320 }, { x: 226, y: 308 }], gesture: 'inserisce', prop: 'urn', booth: 'open', facing: -1 },
  uscita: { x: 620, y: 252, path: [{ x: 300, y: 330 }, { x: 560, y: 300 }, { x: 640, y: 256 }], gesture: 'saluta', prop: 'none', booth: 'open', exit: true }
};
export const VOTE_ORDER = Object.freeze(Object.keys(VOTE_POSES));
function votePoses(scene, nodeId) {
  const me = scene.cast.find(item => item.role === 'giocatore');
  const spec = VOTE_POSES[nodeId] ?? VOTE_POSES.uscita;
  const out = { [me.id]: pose(spec.x, spec.y, { path: spec.path, gesture: spec.gesture, visible: !spec.hidden, exit: spec.exit, facing: spec.facing ?? 1 }) };
  for (const member of scene.cast.filter(item => item.role === 'scrutatore')) out[member.id] = pose(member.x, member.y, { posture: 'sit', facing: member.x > 310 ? -1 : 1, gesture: nodeId === 'banco' ? 'porge' : null });
  return out;
}

// Stages of other settings (the rooms of the optional scenes) register their script here: (scene, node) -> { setting, poses, camera, crowd, props }.
const SCRIPTS = {};
export const registerStageScript = (setting, fn) => { SCRIPTS[setting] = fn; };
// What a stage shows at a beat of a scene.
export function stageOf(scene, node) {
  const nodeId = scene.nodeId;
  if (SCRIPTS[scene.setting]) return SCRIPTS[scene.setting](scene, node);
  if (scene.setting === 'piazza') return { setting: 'piazza', poses: rallyPoses(scene, nodeId, node), camera: RALLY_CAMERA[nodeId] ?? 'stage', crowd: rallyCrowd(scene, nodeId, node), props: {}, protest: Boolean(scene.protest?.arrived) };
  if (scene.setting === 'seggio') { const spec = VOTE_POSES[nodeId] ?? VOTE_POSES.uscita; return { setting: 'seggio', poses: votePoses(scene, nodeId), camera: nodeId === 'cabina' || nodeId === 'voto' || nodeId === 'piega' ? 'booth' : nodeId === 'urna' ? 'urn' : 'wide', crowd: 'quiet', props: { ballot: spec.prop ?? 'none', booth: spec.booth ?? 'open' } }; }
  return { setting: scene.setting, poses: studioPoses(scene, nodeId, node), camera: studioCamera(scene, node), crowd: studioCrowd(scene, node), props: {} };
}
// The beat before this one (to animate the passage), or null for the first.
export function previousNode(scene) { return scene.prevNodeId ?? null; }
// The poses of the beat before: the animation starts from them. For the first beat, every character starts offstage or where the beat puts it.
export function stageBefore(scene, sceneNodeFn) {
  const prevId = previousNode(scene);
  if (!prevId) return null;
  const earlier = { ...scene, nodeId: prevId };
  return stageOf(earlier, sceneNodeFn(earlier));
}
