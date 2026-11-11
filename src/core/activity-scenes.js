// The six optional scenes of the weekly activities: citizens and associations, the building site, the party meeting, the hearing in committee, the newspaper interview and the Council of Ministers.
// Each one is a SHORT animated scene (six beats: opening, a first question with three approaches, the reaction, a second question, the reaction, the outcome) played on a stage of its own (ui/room-art.js),
// built on the same scene machine as the debates (core/scene-engine.js registers it: node / choose / effects / progress) and ending in the SAME outcome engine as the plain activity: the scene only
// gives the verdict (`edge`) that scales the effects of the activity, so «Partecipa» (the animated scene) and «Simula» (the same scene played by the best choices, no stage) give coherent results, and
// «Non partecipare» costs nothing and changes nothing (it is a decision of the interface: no state is touched). Nothing here starts by itself, nothing here advances the week, and the cost of the
// activity is applied ONCE, by the store, when the scene ends.
// Deterministic: the family of topics, the names and the small variations come from the seed of the scene (and from what the player met lately: the same family is not drawn again in a row).
// Loaded on demand (it is not in the first screen): it registers itself in scene-engine.js and stage-script.js when imported.
import { AVATAR_OPTIONS, EXTRA_NAMES, F, M, defaultAvatarFor, genderOf, normalizeAvatar, roleGender } from './avatar.js?v=20261111-2';
import { personName, registerSceneKind } from './scene-engine.js?v=20261111-2';
import { SPEAK_GESTURES, LISTEN_GESTURES, pickGesture, registerStageScript, stagePose } from './stage-script.js?v=20261111-2';
import { ACTIVITY_SCENES, ACTIVITY_SCENE_UI } from '../data/activity-scene-lines.js?v=20261111-2';
import { STAKES } from '../data/activity-scene-stakes.js?v=20261111-2';
import { BODIES, CITIZEN_GUESTS, CITIZENS, GUESTS, HEADINGS, REFS } from '../data/activity-scene-guests.js?v=20261111-2';
import { APPROACH_LABELS } from '../data/activity-scene-approaches.js?v=20261111-2';

export { ACTIVITY_SCENES, ACTIVITY_SCENE_UI };
export const SCENE_KIND = 'attivita';
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const round1 = value => Math.round(value * 10) / 10;
const hashOf = text => { let h = 2166136261 >>> 0; for (let i = 0; i < String(text).length; i++) { h ^= String(text).charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const unit = text => hashOf(text) / 4294967296;
const pickBy = (list, text) => list[hashOf(text) % list.length];
const BEATS = Object.freeze(['apertura', 'q1', 'r1', 'q2', 'r2', 'esito']);
export const SCENE_KEYS = Object.freeze(Object.keys(ACTIVITY_SCENES));
// The scene an activity plays as, or null: the activities of the game that have a scene.
export const sceneKeyOf = activityId => SCENE_KEYS.find(key => ACTIVITY_SCENES[key].activityIds.includes(activityId)) ?? null;
export const activityHasScene = activityId => Boolean(sceneKeyOf(activityId));
// «Incontra i cittadini» is a scene of its own: the market square with passers-by and a daily problem each, not the civic hall with delegates (data/activity-scene-guests.js CITIZENS). The rest of the engine is the same.
const isCitizens = scene => scene.sceneKey === 'associazioni' && scene.activityId === 'cittadini';
export const CITIZENS_SETTING = 'mercato';
// What the player says for an approach in a family of topics: the words of the family (APPROACH_LABELS) with the id and the stat of the approach of the kind of scene; the generic wording where a family has none.
const approachText = (spec, sceneKey, familyId, approach) => {
  const index = spec.approaches.findIndex(item => item.id === approach.id);
  return APPROACH_LABELS[sceneKey]?.[familyId]?.[index] ?? approach.label;
};
const STAT_LABELS = Object.freeze({ competence: 'competenza', charisma: 'carisma', reputation: 'reputazione' });

// The family of topics: the ones not met in the last scenes of this kind first; among them by the seed (and a preference, e.g. the segment of the citizens).
export function pickFamily(spec, seed, recent = [], prefer = null) {
  const fresh = spec.families.filter(family => !recent.slice(-3).includes(family.id));
  const pool = fresh.length ? fresh : spec.families;
  return pool.find(family => family.id === prefer) ?? pickBy(pool, `${seed}|famiglia`);
}
const character = (id, role, spec, seed, used, { roleLabel = null, partyLabel = '' } = {}) => {
  // The gender is explicit in the data: the role fixes it when its grammar does («Ministra», «Delegato», «Una maestra»), otherwise the seed chooses, and the name is taken from the pool of that gender (a name of the
  // other gender is never used for it); the avatar follows it, so «Ministra Livia Donati» is never drawn as a man.
  const label = roleLabel ?? spec.tag[0];
  const gender = roleGender(label) ?? (hashOf(`${seed}|${id}|genere`) % 2 ? F : M);
  const ofGender = list => list.filter(name => genderOf({ name }) === gender);
  const own = ofGender(spec.names), extra = EXTRA_NAMES[gender];
  const free = [...own.filter(name => !used.has(name)), ...extra.filter(name => !used.has(name))];
  const name = personName(pickBy(own.filter(item => !used.has(item)).length ? own.filter(item => !used.has(item)) : free.length ? free : own.length ? own : extra, `${seed}|${id}|nome`), spec.tag[0]);
  used.add(name);
  // each person of a scene is a different person: face, skin, hair, style and jacket are drawn from the seed with a different salt each (never two alike in the same room)
  const base = defaultAvatarFor(`${seed}|${id}`);
  const opt = (field, salt) => AVATAR_OPTIONS[field][hashOf(`${seed}|${id}|${salt}`) % AVATAR_OPTIONS[field].length].id;
  const face = gender;
  const taken = used.avatars ?? (used.avatars = []);
  let avatar = null;
  for (let attempt = 0; attempt < 6 && !avatar; attempt++) {
    const h = hashOf(`${seed}|${id}|aspetto|${attempt}`);
    const candidate = normalizeAvatar({ ...base, face, skin: opt('skin', `pelle${attempt}`), hair: opt('hair', `capelli${attempt}`), hairstyle: opt('hairstyle', `taglio${attempt}`), jacket: opt('jacket', `giacca${attempt}`), glasses: h % 4 === 0 ? 'tondi' : h % 7 === 0 ? 'rettangolari' : 'nessuno', beard: face === 'maschile' && h % 5 === 0 ? 'corta' : 'nessuna' });
    if (!taken.some(other => other.skin === candidate.skin && other.hair === candidate.hair && other.jacket === candidate.jacket)) avatar = candidate;
    else if (attempt === 5) avatar = candidate;
  }
  taken.push(avatar);
  return { id, role, name, gender, avatar, tag: roleLabel ?? spec.tag[0], roleLabel: roleLabel ?? spec.tag[0], partyLabel };
};

// The scene of an activity. `recent`: the ids of the families of the last scenes of this kind (the game keeps them); `prefer`: a family wished by the situation; `variant`: 'head' or 'opposition'
// (the building site) — the dialogue banks are the same, the introduction changes.
// Who belongs to what: in the party meeting everyone is of the party of the player; in the committee and in the Council of Ministers the guests sit for the parties the game gives (`pool`); the others speak for
// the body of the scene (civil society, the public works, the press). `refs`: what the career holds that a scene can mention (the party, a promise, the territory, a rival, a headline of the week).
const AFFILIATION = Object.freeze({ sede: 'party', commissione: 'pool', consiglio: 'pool' });
const REF_ORDER = ['party', 'promise', 'region', 'rival', 'news'];
export function pickRef(sceneKey, seed, refs = {}) {
  const available = REF_ORDER.filter(type => String(refs[type] ?? '').trim() && REFS[type]?.[sceneKey]);
  if (!available.length) return null;
  const type = available[hashOf(`${seed}|riferimento`) % available.length];
  return { type, value: String(refs[type]).trim(), text: REFS[type][sceneKey][0].replace('{}', String(refs[type]).trim()) };
}
export function createActivityScene({ id, seed, sceneKey, activityId, target = null, variant = 'default', player, playerAvatar, stats = {}, recent = [], prefer = null, date = null, party = null, refs = {}, pool = [] }) {
  const spec = ACTIVITY_SCENES[sceneKey];
  if (!spec) throw new Error('Scena non riconosciuta.');
  const family = pickFamily(spec, seed, recent, prefer);
  const used = new Set();
  const roles = (activityId === 'cittadini' ? CITIZEN_GUESTS[family.id] : null) ?? GUESTS[sceneKey]?.[family.id] ?? [spec.cast[0].tag, spec.cast[1].tag];
  const heading = sceneKey === 'associazioni' ? HEADINGS[activityId === 'cittadini' ? 'cittadini' : 'associazioni'] : null;
  const partyOf = index => AFFILIATION[sceneKey] === 'party' ? (party?.label ?? '') : AFFILIATION[sceneKey] === 'pool' && pool.length ? pool[hashOf(`${seed}|appartenenza|${index}`) % pool.length] : '';
  const cast = [
    { id: 'giocatore', role: 'giocatore', name: personName(player?.name, 'Tu'), avatar: normalizeAvatar(playerAvatar), tag: player?.tag ?? '' },
    character('ospite1', 'ospite', spec.cast[0], seed, used, { roleLabel: roles[0]?.[0] ?? null, partyLabel: partyOf(1) }),
    character('ospite2', 'ospite', spec.cast[1], seed, used, { roleLabel: roles[1]?.[0] ?? null, partyLabel: partyOf(2) })
  ];
  const bodyLabel = AFFILIATION[sceneKey] === 'party' && party?.label ? party.label : heading?.body[0] ?? BODIES[sceneKey]?.[0] ?? '';
  const ref = pickRef(sceneKey, seed, { ...refs, party: AFFILIATION[sceneKey] === 'party' || refs.party ? (refs.party ?? party?.label ?? '') : '' });
  return {
    id, kind: SCENE_KIND, sceneKey, activityId, target, variant: spec.intro[variant] ? variant : 'default', setting: sceneKey === 'associazioni' && activityId === 'cittadini' ? CITIZENS_SETTING : spec.setting, seed, date, status: 'active', nodeId: 'apertura', cast,
    topic: { id: family.id, label: family.label[0] }, place: { label: (sceneKey === 'associazioni' && activityId === 'cittadini' ? CITIZENS.place : spec.place)[0] }, familyId: family.id, bodyLabel, heading: heading ? { kicker: heading.kicker[0], title: heading.title[0], banner: heading.banner[0] } : null, partyLabel: party?.label ?? '', ref: ref ? { type: ref.type, text: ref.text } : null,
    context: { stats: { competence: stats.competence ?? 50, charisma: stats.charisma ?? 50, reputation: stats.reputation ?? 50 } },
    audience: { mood: 50, history: [] }, history: [], outcome: null
  };
}

// ---------- scoring ----------
// How an approach does, 0..100: the stat it relies on, how well it suits this family of topics (decided by the seed: one approach is the right one, one half-right), and a small variation. Every term
// is explained to the player in the reaction.
function judge(scene, approach, nodeId) {
  const spec = ACTIVITY_SCENES[scene.sceneKey];
  const stat = scene.context.stats[approach.stat] ?? 50;
  const order = spec.approaches.map(item => item.id);
  const best = order[hashOf(`${scene.seed}|${scene.familyId}|${nodeId}|migliore`) % order.length];
  const second = order[(order.indexOf(best) + 1 + hashOf(`${scene.seed}|${nodeId}|secondo`) % 2) % order.length];
  const fit = approach.id === best ? 14 : approach.id === second ? 5 : -4;
  const noise = (unit(`${scene.seed}|${nodeId}|${approach.id}`) - 0.5) * 8;
  const score = Math.round(clamp(34 + stat * 0.44 + fit + noise, 5, 95));
  return { score, fit: approach.id === best ? 'giusto' : approach.id === second ? 'discreto' : 'debole', why: [`${STAT_LABELS[approach.stat]} ${Math.round(stat)}`, fit > 10 ? 'l’approccio giusto per questo tema' : fit > 0 ? 'un approccio discreto per questo tema' : 'un approccio poco adatto a questo tema'] };
}
const band = score => score >= 62 ? 'good' : score < 45 ? 'bad' : 'mid';

// ---------- the current beat ----------
const me = scene => scene.cast.find(item => item.role === 'giocatore');
const guest = (scene, n) => scene.cast.filter(item => item.role === 'ospite')[n - 1];
export function activityNode(scene) {
  const spec = ACTIVITY_SCENES[scene.sceneKey];
  const family = spec.families.find(item => item.id === scene.familyId) ?? spec.families[0];
  const last = scene.history.at(-1) ?? null;
  const base = { id: scene.nodeId, setting: scene.setting };
  const approaches = spec.approaches.map(item => [item.id, approachText(spec, scene.sceneKey, scene.familyId, item)[0], false, item.detail[0]]);
  switch (scene.nodeId) {
    case 'apertura': return { ...base, speaker: me(scene).id, expression: 'serena', gesture: 'saluta', camera: 'wide', title: scene.heading?.title ?? spec.title[0], text: (isCitizens(scene) ? CITIZENS.intro : (spec.intro[scene.variant] ?? spec.intro.default))[0], ...(scene.ref?.text ? { lines: [scene.ref.text] } : {}), choices: [['continua', 'Continua']] };
    case 'q1': return { ...base, speaker: guest(scene, 1).id, expression: 'determinata', gesture: 'sottolinea', camera: 'wide', title: family.label[0], text: (isCitizens(scene) ? CITIZENS.families[family.id]?.open ?? family.open : family.open)[0], choices: approaches };
    case 'q2': return { ...base, speaker: guest(scene, 2).id, expression: 'determinata', gesture: 'indica', camera: 'wide', title: family.label[0], text: (isCitizens(scene) ? CITIZENS.families[family.id]?.follow ?? family.follow : family.follow)[0], choices: approaches };
    case 'r1': case 'r2': {
      const who = last && last.band === 'good' ? guest(scene, scene.nodeId === 'r1' ? 1 : 2) : guest(scene, scene.nodeId === 'r1' ? 2 : 1);
      return { ...base, speaker: who.id, expression: last?.band === 'good' ? 'serena' : last?.band === 'bad' ? 'determinata' : 'serena', gesture: last?.band === 'bad' ? 'dissenso' : last?.band === 'good' ? 'applaude' : 'ascolta', camera: 'wide', title: scene.nodeId === 'r1' ? 'Reazioni alla prima risposta' : 'Reazioni alla seconda risposta', said: last?.said ?? null, text: last?.reaction ?? '', ...(last?.stake ? { lines: [last.stake] } : {}), why: last?.why ?? [], score: last?.score, audience: null, choices: [['continua', 'Continua']] };
    }
    default: return { ...base, speaker: guest(scene, 1).id, expression: scene.outcome?.band === 'bad' ? 'determinata' : 'sorridente', gesture: 'saluta', camera: 'wide', text: scene.outcome?.summary ?? (isCitizens(scene) ? CITIZENS.closings : spec.closings).mid[0], choices: [['fine', 'Concludi la scena']], final: true };
  }
}

// ---------- moving on ----------
export function activityChoose(scene, choiceId) {
  const spec = ACTIVITY_SCENES[scene.sceneKey];
  const node = activityNode(scene);
  const choice = node.choices.find(item => item[0] === choiceId);
  if (!choice) throw new Error('Scelta non valida per questo momento.');
  if (['apertura', 'r1', 'r2'].includes(scene.nodeId)) { scene.nodeId = { apertura: 'q1', r1: 'q2', r2: 'esito' }[scene.nodeId]; if (scene.nodeId === 'esito') finish(scene, spec); return scene; }
  if (scene.nodeId === 'esito') return scene;
  const approach = spec.approaches.find(item => item.id === choiceId);
  const result = judge(scene, approach, scene.nodeId);
  const b = band(result.score);
  const reaction = pickBy((isCitizens(scene) ? CITIZENS.reactions : spec.reactions)[b], `${scene.seed}|${scene.nodeId}|${b}|reazione`)[0];
  const stakePair = STAKES[scene.sceneKey]?.[scene.familyId]?.[b === 'good' ? 0 : b === 'bad' ? 1 : -1];
  scene.history.push({ node: scene.nodeId, choice: choiceId, score: result.score, band: b, why: result.why, said: approachText(spec, scene.sceneKey, scene.familyId, approach)[0], reaction, ...(stakePair ? { stake: stakePair[0] } : {}) });
  scene.audience.mood = clamp(round1(scene.audience.mood + (result.score - 55) / 4), 0, 100);
  scene.audience.history.push(scene.audience.mood);
  scene.nodeId = scene.nodeId === 'q1' ? 'r1' : 'r2';
  return scene;
}
function finish(scene, spec) {
  const scores = scene.history.map(item => item.score);
  const performance = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length));
  const b = band(performance);
  scene.status = 'done';
  scene.outcome = { performance, band: b, edge: round1(clamp((performance - 55) / 4.5, -6, 6)), summary: (isCitizens(scene) ? CITIZENS.closings : spec.closings)[b][0], audience: scene.audience.mood };
}
// The effects the store applies when the scene ends: the verdict (`edge`) scales the plain activity (career-engine `sceneEdge`).
export function activityEffects(scene) {
  if (!scene.outcome) return null;
  return { sceneKey: scene.sceneKey, activityId: scene.activityId, target: scene.target ?? null, familyId: scene.familyId, edge: scene.outcome.edge, performance: scene.outcome.performance, band: scene.outcome.band, declined: false, line: scene.outcome.summary, sceneId: scene.id, mediaTone: scene.outcome.performance >= 62 ? 1 : scene.outcome.performance < 45 ? -1 : 0.3 };
}
// A scene left halfway closes with what was done so far (a verdict of its own, a little worse than a scene played to the end).
export function abandonActivityScene(scene) {
  const done = scene.history.map(item => item.score);
  const performance = Math.round(clamp((done.length ? done.reduce((a, b) => a + b, 0) / done.length : 40) - 6, 20, 80));
  return { ...scene, status: 'abandoned', outcome: { performance, band: band(performance), edge: round1(clamp((performance - 55) / 4.5, -6, 6)), summary: ACTIVITY_SCENE_UI.abandoned[0], audience: scene.audience.mood, left: true }, history: scene.history };
}
export const activityProgress = scene => ({ index: Math.max(0, BEATS.indexOf(scene.nodeId)), total: BEATS.length });
registerSceneKind(SCENE_KIND, { node: activityNode, choose: activityChoose, effects: activityEffects, progress: activityProgress, abandon: abandonActivityScene });

// ---------- the stage ----------
// Where the people stand: the building site and the civic hall standing, the other four rooms around a table. The player arrives from the left in the opening; everyone else is already there.
const LAYOUT = {
  sala: { posture: 'stand', giocatore: [150, 300, 1], ospite1: [452, 296, -1], ospite2: [548, 300, -1] },
  mercato: { posture: 'stand', giocatore: [130, 304, 1], ospite1: [330, 300, -1], ospite2: [470, 304, -1] },
  cantiere: { posture: 'stand', giocatore: [150, 302, 1], ospite1: [420, 298, -1], ospite2: [536, 302, -1] },
  sede: { posture: 'sit', giocatore: [150, 300, 1], ospite1: [460, 292, -1], ospite2: [556, 296, -1] },
  commissione: { posture: 'sit', giocatore: [150, 300, 1], ospite1: [460, 292, -1], ospite2: [556, 296, -1] },
  redazione: { posture: 'sit', giocatore: [150, 300, 1], ospite1: [460, 292, -1], ospite2: [556, 296, -1] },
  consiglio: { posture: 'sit', giocatore: [150, 300, 1], ospite1: [460, 292, -1], ospite2: [556, 296, -1] }
};
export const ROOM_SETTINGS = Object.freeze(Object.keys(LAYOUT));
export function activityStage(scene, node) {
  const layout = LAYOUT[scene.setting] ?? LAYOUT.sala;
  const nodeId = scene.nodeId;
  const out = {};
  for (const member of scene.cast) {
    const [x, y, facing] = layout[member.id === 'giocatore' ? 'giocatore' : member.id];
    const speaking = node?.speaker === member.id;
    const gesture = nodeId === 'esito' ? 'saluta' : speaking ? (node.gesture && node.gesture !== 'sottolinea' ? node.gesture : pickGesture(scene, nodeId, member.id, SPEAK_GESTURES)) : (node?.speaker ? pickGesture(scene, nodeId, member.id, LISTEN_GESTURES) : null);
    if (member.id === 'giocatore' && nodeId === 'apertura') out[member.id] = stagePose(x, y, { facing, posture: layout.posture, gesture: speaking ? 'saluta' : null, path: [{ x: -70, y: 304 }, { x, y }] });
    else out[member.id] = stagePose(x, y, { facing, posture: nodeId === 'esito' ? 'stand' : layout.posture, gesture });
  }
  const camera = nodeId === 'apertura' || nodeId === 'esito' ? 'wide' : node?.speaker === 'giocatore' ? 'left' : 'right';
  return { setting: scene.setting, poses: out, camera: ['q1', 'q2', 'r1', 'r2'].includes(nodeId) ? camera : 'wide', crowd: 'quiet', props: { room: scene.setting, mood: scene.audience.mood >= 58 ? 'warm' : scene.audience.mood < 45 ? 'cold' : 'mixed' } };
}
for (const setting of ROOM_SETTINGS) registerStageScript(setting, activityStage);
