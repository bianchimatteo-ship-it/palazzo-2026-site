// The six optional scenes of the weekly activities: citizens and associations, the building site, the party meeting, the hearing in committee, the newspaper interview and the Council of Ministers.
// Each one is a SHORT animated scene (six beats: opening, a first question with three approaches, the reaction, a second question, the reaction, the outcome) played on a stage of its own (ui/room-art.js),
// built on the same scene machine as the debates (core/scene-engine.js registers it: node / choose / effects / progress) and ending in the SAME outcome engine as the plain activity: the scene only
// gives the verdict (`edge`) that scales the effects of the activity, so «Partecipa» (the animated scene) and «Simula» (the same scene played by the best choices, no stage) give coherent results, and
// «Non partecipare» costs nothing and changes nothing (it is a decision of the interface: no state is touched). Nothing here starts by itself, nothing here advances the week, and the cost of the
// activity is applied ONCE, by the store, when the scene ends.
// Deterministic: the family of topics, the names and the small variations come from the seed of the scene (and from what the player met lately: the same family is not drawn again in a row).
// Loaded on demand (it is not in the first screen): it registers itself in scene-engine.js and stage-script.js when imported.
import { AVATAR_OPTIONS, EXTRA_NAMES, F, M, defaultAvatarFor, genderOf, normalizeAvatar, roleGender } from './avatar.js?v=20261113-1';
import { personName, registerSceneKind } from './scene-engine.js?v=20261113-1';
import { SPEAK_GESTURES, LISTEN_GESTURES, pickGesture, registerStageScript, stagePose } from './stage-script.js?v=20261113-1';
import { ACTIVITY_SCENES, ACTIVITY_SCENE_UI } from '../data/activity-scene-lines.js?v=20261113-1';
import { STAKES } from '../data/activity-scene-stakes.js?v=20261113-1';
import { BODIES, CITIZEN_GUESTS, CITIZENS, GUESTS, HEADINGS, REFS } from '../data/activity-scene-guests.js?v=20261113-1';
import { APPROACH_LABELS } from '../data/activity-scene-approaches.js?v=20261113-1';
import { ONLY, TOPIC_KIND, TOPIC_MOVES, areasOf, newsFits } from '../data/activity-scene-topics.js?v=20261113-1';
import { APPROACH_FUNCTIONS, COMMITMENTS, COMMITMENT_TEXT, CONSEQUENCE_LINES, EXTRA_Q1, FUNCTIONS, FUND_COST, GUARANTEE_MOVES, MOVES, OUTCOME_KINDS, REACTION_LINES, REACTION_TYPES, STAGE_TEXT, WHY_LINES } from '../data/activity-scene-moves.js?v=20261113-1';

export { ACTIVITY_SCENES, ACTIVITY_SCENE_UI };
export const SCENE_KIND = 'attivita';
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const round1 = value => Math.round(value * 10) / 10;
const hashOf = text => { let h = 2166136261 >>> 0; for (let i = 0; i < String(text).length; i++) { h ^= String(text).charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const unit = text => hashOf(text) / 4294967296;
const pickBy = (list, text) => list[hashOf(text) % list.length];
// The beats: the opening, three moments of decision with the reaction after each (a fourth one when somebody asks for guarantees or the tone has risen), the outcome.
const BEATS = Object.freeze(['apertura', 'q1', 'r1', 'q2', 'r2', 'q3', 'r3', 'q4', 'r4', 'esito']);
const NEXT = Object.freeze({ apertura: 'q1', q1: 'r1', r1: 'q2', q2: 'r2', r2: 'q3', q3: 'r3', q4: 'r4', r4: 'esito' });
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
export function createActivityScene({ id, seed, sceneKey, activityId, target = null, variant = 'default', player, playerAvatar, stats = {}, recent = [], prefer = null, date = null, party = null, refs = {}, pool = [], situation = {}, promises = null, news = null, priorFamilies = null }) {
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
  // What the career holds is quoted only when it is about the subject of the encounter: a promise of the programme whose policy area is the family's, a headline of the diary that speaks of it. A scene made
  // without the lists (a test, an old call) keeps the plain values it is given.
  const kindName = sceneKey === 'associazioni' && activityId === 'cittadini' ? 'cittadini' : sceneKey;
  const areas = areasOf(kindName, family.id);
  const promiseRef = Array.isArray(promises) ? promises.find(item => areas.includes('*') || areas.includes(item.area))?.label ?? '' : refs.promise ?? '';
  const newsRef = Array.isArray(news) ? news.find(item => newsFits(family.id, item)) ?? '' : refs.news ?? '';
  const ref = pickRef(sceneKey, seed, { ...refs, promise: promiseRef, news: newsRef, party: AFFILIATION[sceneKey] === 'party' || refs.party ? (refs.party ?? party?.label ?? '') : '' });
  return {
    id, kind: SCENE_KIND, sceneKey, activityId, target, variant: spec.intro[variant] ? variant : 'default', setting: sceneKey === 'associazioni' && activityId === 'cittadini' ? CITIZENS_SETTING : spec.setting, seed, date, status: 'active', nodeId: 'apertura', cast,
    topic: { id: family.id, label: family.label[0] }, place: { label: (sceneKey === 'associazioni' && activityId === 'cittadini' ? CITIZENS.place : spec.place)[0] }, familyId: family.id, bodyLabel, heading: heading ? { kicker: heading.kicker[0], title: heading.title[0], banner: heading.banner[0] } : null, partyLabel: party?.label ?? '', ref: ref ? { type: ref.type, text: ref.text } : null,
    context: { stats: { competence: stats.competence ?? 50, charisma: stats.charisma ?? 50, reputation: stats.reputation ?? 50 } },
    // what the encounter knows of the situation of the player when it starts (kept in the scene: a saved scene resumed later offers the same moves) and what has happened in it so far
    flags: { promise: Boolean(promiseRef), prior: Array.isArray(priorFamilies) ? priorFamilies.includes(family.id) : Boolean(situation.prior), govern: Boolean(situation.govern), opp: Boolean(situation.opp), funds: situation.funds !== false, capital: situation.capital !== false, party: Boolean(situation.party), local: Boolean(situation.local) },
    tally: { k: 0, tension: 0, trust: 0, guarantee: false, asked: false },
    audience: { mood: 50, history: [] }, history: [], outcome: null
  };
}

// ---------- the moves of a moment ----------
// The catalogue of the encounter: the citizens' square has its own, the other five scenes have theirs (data/activity-scene-moves.js). A moment offers three to five moves of DIFFERENT functions: the situation
// of the player decides which are there (`when`), what was already done pushes aside the moves of a function used before, and the seed orders the rest — the same scene always offers the same moves.
const kindOf = scene => isCitizens(scene) ? 'cittadini' : scene.sceneKey;
// What the encounter knows of the player when it starts: the facts of the career (`sit` is the situation of the career-engine) become the flags the moves ask for.
export function sceneSituation({ sceneKey, activityId, sit, game, activity, refs = {} }) {
  const week = game?.week?.index ?? 0, cost = activity?.cost ?? {};
  const key = sceneKey === 'associazioni' && activityId === 'cittadini' ? 'cittadini' : sceneKey;
  return {
    promise: Boolean(refs.promise), prior: false,
    govern: Boolean(sit?.role?.head || sit?.role?.assessor || sit?.premier || sit?.minister), opp: Boolean(sit?.oppositionLocal),
    funds: (game?.resources?.funds ?? 0) - (cost.funds ?? 0) >= (FUND_COST[key] ?? 0), capital: (game?.resources?.politicalCapital ?? 0) - (cost.capital ?? 0) >= 1,
    party: Boolean(game?.party), local: Boolean(sit?.role?.local)
  };
}
const tagsOk = (move, flags) => !move.when || move.when.split(' ').filter(tag => !['funds', 'capital'].includes(tag)).every(tag => flags?.[tag]);
// Every move: { id, fn, stat, label, approach?, disabled?, reason? } — `funds` and `capital` tags make the move visible but not available when the money or the point of capital is not there.
function movesAt(scene, stage) {
  const spec = ACTIVITY_SCENES[scene.sceneKey], flags = scene.flags ?? {}, used = scene.history.map(item => item.fn);
  const wrap = move => ({ ...move, disabled: Boolean(move.when?.includes('funds') && !flags.funds) || Boolean(move.when?.includes('capital') && !flags.capital), reason: move.when?.includes('funds') && !flags.funds ? STAGE_TEXT.notes.funds : move.when?.includes('capital') && !flags.capital ? STAGE_TEXT.notes.capital : null });
  if (stage === 'q1') {
    const base = spec.approaches.map(item => ({ id: item.id, fn: APPROACH_FUNCTIONS[scene.sceneKey]?.[item.id] ?? 'listen', stat: item.stat, label: approachText(spec, scene.sceneKey, scene.familyId, item), approach: true }));
    const wanted = EXTRA_Q1.filter(move => move.when && tagsOk(move, flags)), always = EXTRA_Q1.filter(move => !move.when);
    return [...base, ...(wanted.length ? wanted.slice(0, 2) : always.slice(0, 1))].map(wrap);
  }
  // the moments of decision are about the subject: the moves of the topic first (the state of the building, the survey, the works diary, the amendment, the headline…), then the moves of the kind of
  // encounter that fit any subject (the ones bound to another subject are never offered)
  const topicOf = (list, family) => list?.[family]?.[stage] ?? [];
  const specific = stage === 'q4' ? [] : topicOf(TOPIC_MOVES[TOPIC_KIND[kindOf(scene)]], scene.familyId).map((move, index) => ({ ...move, id: `t-${kindOf(scene)}-${scene.familyId}-${stage}-${index}` })).filter(move => tagsOk(move, flags));
  const general = (stage === 'q4' ? GUARANTEE_MOVES : MOVES[kindOf(scene)]?.[stage] ?? []).filter(move => tagsOk(move, flags) && (!ONLY[move.id] || ONLY[move.id].includes(scene.familyId)));
  const order = list => [...list].sort((a, b) => hashOf(`${scene.seed}|${stage}|${a.id}`) - hashOf(`${scene.seed}|${stage}|${b.id}`));
  const fresh = list => list.filter(move => !used.includes(move.fn));
  const out = [];
  for (const move of [...order(fresh(specific)), ...order(specific.filter(move => used.includes(move.fn))), ...order(fresh(general)), ...order(general.filter(move => used.includes(move.fn)))]) if (!out.some(item => item.fn === move.fn)) out.push(move);
  // an informed player sees one more way out at the moment of the decision
  const count = stage === 'q3' && scene.tally.k >= 1 ? 5 : 4;
  return out.slice(0, count).map(wrap);
}
const moveFor = (scene, stage, id) => movesAt(scene, stage).find(item => item.id === id) ?? null;

// ---------- scoring ----------
// How a move does, 0..100: the stat it relies on, how well it suits this encounter (one move of the moment is the right one, another half-right: decided by the seed), what has happened so far — whether the
// player is informed, whether the tone has risen, whether he can decide what he promises — and a small variation. Every term is told to the player in the reaction.
function sequence(scene, move) {
  const fn = move.fn, t = scene.tally, flags = scene.flags ?? {}, last = scene.history.at(-1);
  const informed = t.k >= 1;
  let delta = 0; const reasons = [];
  const add = (value, key) => { delta += value; reasons.push(WHY_LINES[key][0]); };
  if (['propose', 'announce', 'fund', 'table'].includes(fn)) informed ? add(6, 'informed') : add(-6, 'uninformed');
  if (['involve', 'compromise'].includes(fn) && informed) add(4, 'informed');
  if (fn === 'contest') t.tension >= 2 ? add(-8, 'heated') : informed ? add(4, 'informed') : add(-3, 'uninformed');
  if (['mediate', 'compromise'].includes(fn)) t.tension >= 1 ? add(8, 'tension') : add(-4, 'nothingToMediate');
  if (['data', 'verify'].includes(fn) && t.tension >= 1) add(4, 'tension');
  if (['clarify', 'own'].includes(fn) && last?.band === 'bad') add(6, 'recovering');
  if (['announce', 'propose', 'table'].includes(fn) && !flags.funds) add(-5, 'noFunds');
  if (fn === 'involve') flags.govern ? add(4, 'authority') : flags.opp ? add(-3, 'noAuthority') : 0;
  if (['vote', 'assign', 'priority'].includes(fn) && flags.opp) add(-3, 'noAuthority');
  if (scene.history.some(item => item.fn === fn)) add(-4, 'repeated');
  if (move.id === 'x-impegno') add(6, 'prior');
  return { delta, reasons };
}
function judge(scene, move, stage) {
  const stat = scene.context.stats[move.stat] ?? 50;
  // the right move of the moment and the half-right one are drawn from the seed by the identity of the first four moves (the fifth, which an informed player sees, never changes who they are)
  const ranked = movesAt(scene, stage).slice(0, 4).map(item => item.id).sort((a, b) => hashOf(`${scene.seed}|${scene.familyId}|${stage}|migliore|${a}`) - hashOf(`${scene.seed}|${scene.familyId}|${stage}|migliore|${b}`));
  const best = ranked[0], second = ranked[1];
  const fit = move.id === best ? 12 : move.id === second ? 4 : -3;
  const noise = (unit(`${scene.seed}|${stage}|${move.id}`) - 0.5) * 6;
  const seq = sequence(scene, move);
  const score = Math.round(clamp(32 + stat * 0.42 + fit + seq.delta + noise, 5, 95));
  return { score, fit: move.id === best ? 'giusto' : move.id === second ? 'discreto' : 'debole', why: [`${STAT_LABELS[move.stat]} ${Math.round(stat)}`, fit > 10 ? 'l’approccio giusto per questo tema' : fit > 0 ? 'un approccio discreto per questo tema' : 'un approccio poco adatto a questo tema', ...seq.reasons] };
}
const band = score => score >= 62 ? 'good' : score < 45 ? 'bad' : 'mid';
// How the people take a move: approval, disagreement, doubt, protest, satisfaction, a compromise, or a request for guarantees (the visual reaction and the second voice follow it).
const GOOD_TYPE = { listen: 'approvazione', probe: 'approvazione', data: 'approvazione', own: 'approvazione', clarify: 'approvazione', story: 'approvazione', verify: 'approvazione', appoint: 'approvazione', table: 'approvazione', propose: 'soddisfazione', announce: 'soddisfazione', fund: 'soddisfazione', involve: 'soddisfazione', vote: 'soddisfazione', assign: 'soddisfazione', priority: 'soddisfazione', mediate: 'compromesso', compromise: 'compromesso', contest: 'dissenso' };
export function reactionType(fn, bandName) {
  if (bandName === 'good') return GOOD_TYPE[fn] ?? 'approvazione';
  if (bandName === 'mid') return ['propose', 'announce', 'fund', 'table', 'involve'].includes(fn) ? 'garanzie' : ['mediate', 'compromise'].includes(fn) ? 'compromesso' : fn === 'contest' ? 'protesta' : 'perplessita';
  return ['contest', 'announce', 'priority', 'vote', 'assign'].includes(fn) ? 'protesta' : ['data', 'probe', 'listen', 'story', 'verify', 'appoint'].includes(fn) ? 'perplessita' : 'dissenso';
}

// A scene saved by an earlier version (without the situation, the tally or the function of each move) is brought up to date when it is read: the saved scene continues, it is never lost.
function upgrade(scene) {
  if (!scene.flags) scene.flags = { promise: false, prior: false, govern: false, opp: false, funds: true, capital: true, party: Boolean(scene.sceneKey === 'sede'), local: false };
  if (!scene.tally) scene.tally = { k: 0, tension: 0, trust: 0, guarantee: false, asked: false };
  for (const entry of scene.history ?? []) if (!entry.fn) { entry.fn = APPROACH_FUNCTIONS[scene.sceneKey]?.[entry.choice] ?? 'listen'; entry.type = reactionType(entry.fn, entry.band); entry.k = entry.k ?? 0; }
  return scene;
}

// ---------- the current beat ----------
const me = scene => scene.cast.find(item => item.role === 'giocatore');
const guest = (scene, n) => scene.cast.filter(item => item.role === 'ospite')[n - 1];
const choicesOf = (scene, stage) => movesAt(scene, stage).map(move => [move.id, move.label[0], move.disabled, move.disabled ? move.reason[0] : FUNCTIONS[move.fn].detail[0]]);
// The stage the reaction beat belongs to.
const STAGE_OF = Object.freeze({ r1: 'q1', r2: 'q2', r3: 'q3', r4: 'q4' });
export function activityNode(scene) {
  upgrade(scene);
  const spec = ACTIVITY_SCENES[scene.sceneKey];
  const family = spec.families.find(item => item.id === scene.familyId) ?? spec.families[0];
  const last = scene.history.at(-1) ?? null;
  const base = { id: scene.nodeId, setting: scene.setting };
  const citizens = isCitizens(scene);
  switch (scene.nodeId) {
    case 'apertura': return { ...base, speaker: me(scene).id, expression: 'serena', gesture: 'saluta', camera: 'wide', title: scene.heading?.title ?? spec.title[0], text: (citizens ? CITIZENS.intro : (spec.intro[scene.variant] ?? spec.intro.default))[0], ...(scene.ref?.text ? { lines: [scene.ref.text] } : {}), choices: [['continua', 'Continua']] };
    case 'q1': return { ...base, speaker: guest(scene, 1).id, expression: 'determinata', gesture: 'sottolinea', camera: 'wide', title: family.label[0], text: (citizens ? CITIZENS.families[family.id]?.open ?? family.open : family.open)[0], choices: choicesOf(scene, 'q1') };
    case 'q2': return { ...base, speaker: guest(scene, 2).id, expression: 'determinata', gesture: 'indica', camera: 'wide', title: family.label[0], text: (citizens ? CITIZENS.families[family.id]?.follow ?? family.follow : family.follow)[0], choices: choicesOf(scene, 'q2') };
    case 'q3': {
      const text = scene.tally.tension >= 2 ? STAGE_TEXT.q3.tense : STAGE_TEXT.q3[last?.band ?? 'mid'];
      return { ...base, speaker: guest(scene, 1).id, expression: last?.band === 'bad' || scene.tally.tension >= 2 ? 'determinata' : 'serena', gesture: 'sottolinea', camera: 'wide', title: STAGE_TEXT.titles.q3[0], text: text[0], choices: choicesOf(scene, 'q3') };
    }
    case 'q4': return { ...base, speaker: guest(scene, 2).id, expression: 'determinata', gesture: 'indica', camera: 'wide', title: STAGE_TEXT.titles.q4[0], text: (scene.tally.guarantee ? STAGE_TEXT.q4.guarantee : STAGE_TEXT.q4.tense)[0], choices: choicesOf(scene, 'q4') };
    case 'r1': case 'r2': case 'r3': case 'r4': {
      const index = Number(scene.nodeId[1]);
      const reaction = REACTION_TYPES[last?.type ?? 'perplessita'];
      const who = guest(scene, index % 2 ? 1 : 2), other = guest(scene, index % 2 ? 2 : 1);
      const joined = reaction.joins[hashOf(`${scene.seed}|${scene.nodeId}|intervento`) % reaction.joins.length];
      return { ...base, speaker: who.id, expression: reaction.expression, gesture: reaction.gesture, camera: reaction.camera, reaction: last?.type ?? null, move: last ? { fn: last.fn, by: me(scene).id, gesture: FUNCTIONS[last.fn]?.gesture ?? 'apre' } : null, title: STAGE_TEXT.titles[scene.nodeId][0], kind: reaction.label[0], said: last?.said ?? null, preface: last?.reaction ? [last.reaction] : [], text: last ? REACTION_LINES[last.fn][last.band][0] : '', exchange: [{ who: other.name, text: joined[0] }], ...(last?.stake ? { lines: [last.stake] } : {}), why: last?.why ?? [], score: last?.score, audience: null, choices: [['continua', 'Continua']] };
    }
    default: {
      const kind = OUTCOME_KINDS[scene.outcome?.kind ?? 'parziale'];
      return { ...base, speaker: guest(scene, 1).id, expression: scene.outcome?.band === 'bad' ? 'determinata' : 'sorridente', gesture: 'saluta', camera: 'wide', title: kind.label[0], preface: scene.outcome?.flavor ? [scene.outcome.flavor] : [], text: scene.outcome?.summary ?? (citizens ? CITIZENS.closings : spec.closings).mid[0], lines: scene.outcome?.consequences ?? [], choices: [['fine', 'Concludi la scena']], final: true };
    }
  }
}

// ---------- moving on ----------
export function activityChoose(scene, choiceId) {
  upgrade(scene);
  const spec = ACTIVITY_SCENES[scene.sceneKey];
  const node = activityNode(scene);
  const choice = node.choices.find(item => item[0] === choiceId);
  if (!choice) throw new Error('Scelta non valida per questo momento.');
  if (choice[2]) throw new Error('Questa mossa non è disponibile ora.');
  if (scene.nodeId === 'apertura') { scene.nodeId = 'q1'; return scene; }
  if (['r1', 'r2'].includes(scene.nodeId)) { scene.nodeId = NEXT[scene.nodeId]; return scene; }
  if (scene.nodeId === 'r3') { scene.nodeId = scene.tally.guarantee || scene.tally.tension >= 3 ? 'q4' : 'esito'; if (scene.nodeId === 'q4') scene.tally.asked = true; else finish(scene, spec); return scene; }
  if (scene.nodeId === 'r4') { scene.nodeId = 'esito'; finish(scene, spec); return scene; }
  if (scene.nodeId === 'esito') return scene;
  const stage = scene.nodeId;
  const move = moveFor(scene, stage, choiceId);
  const result = judge(scene, move, stage);
  const b = band(result.score);
  const type = reactionType(move.fn, b);
  const reaction = pickBy((isCitizens(scene) ? CITIZENS.reactions : spec.reactions)[b], `${scene.seed}|${stage}|${b}|reazione`)[0];
  const stakePair = STAKES[scene.sceneKey]?.[scene.familyId]?.[b === 'good' ? 0 : b === 'bad' ? 1 : -1];
  scene.history.push({ node: stage, choice: choiceId, fn: move.fn, type, score: result.score, band: b, why: result.why, k: scene.tally.k, said: move.label[0], reaction, ...(stakePair ? { stake: stakePair[0] } : {}) });
  // what the move did to the meeting itself
  const effect = FUNCTIONS[move.fn].tally ?? {};
  scene.tally.k = clamp(scene.tally.k + (effect.k ?? 0) * (b === 'bad' ? 0.5 : 1), 0, 6);
  scene.tally.tension = clamp(scene.tally.tension + (effect.tension ?? 0) + (b === 'bad' ? 1 : b === 'good' && (effect.tension ?? 0) > 0 ? -1 : 0), 0, 5);
  scene.tally.trust = clamp(scene.tally.trust + (effect.trust ?? 0) * (b === 'good' ? 1 : b === 'mid' ? 0.5 : -1), -3, 6);
  if (type === 'garanzie') scene.tally.guarantee = true;
  scene.audience.mood = clamp(round1(scene.audience.mood + (result.score - 55) / 4), 0, 100);
  scene.audience.history.push(scene.audience.mood);
  scene.nodeId = NEXT[stage];
  return scene;
}

// ---------- what the encounter leaves ----------
// The relation of the body of the scene that moves: the committees and citizens, the contractors, the party leadership, the newsrooms, the group in committee, the government.
const relFx = (sceneKey, value) => sceneKey === 'cantiere' ? { relations: { business: value } } : sceneKey === 'sede' ? { relations: { leadership: value } } : sceneKey === 'redazione' ? { relations: { media: value } } : sceneKey === 'commissione' ? { group: { support: value } } : sceneKey === 'consiglio' ? { government: { stability: value } } : { relations: { civic: value } };
const STAT_KEYS = { rep: 'reputation', pop: 'popularity', not: 'notoriety', inf: 'influence', exp: 'experience' };
const round2 = value => Math.round(value * 100) / 100;
const addTo = (target, key, value) => { if (value) target[key] = round2((target[key] ?? 0) + value); };
// How the commitments of the encounter turn out weeks later: a commitment is kept more often when it was made well, with the facts, with the money and with the power to carry it out.
export function keptChance(move, scene) {
  const flags = scene.flags ?? {};
  const quality = move.band === 'good' ? 0.5 : move.band === 'mid' ? 0.2 : -0.15;
  return round2(clamp(0.35 + quality + (move.k >= 1 ? 0.1 : -0.05) + (flags.funds ? 0.08 : -0.15) + (flags.govern ? 0.08 : flags.opp ? -0.1 : 0), 0.1, 0.95));
}
// The effects of what was decided, summed over the moves made: `effects` for the career-engine (applied in the same pass as the activity), `society` for the store (the citizens' group and the trust of the
// territory), `pending` (what stays open in the career), the plain-words `consequences` and the kind of the outcome. A pure function of the scene: the same decisions give the same result, in the animated
// scene, in the simulation and after a save.
export function sceneAftermath(scene) {
  upgrade(scene);
  const effects = { stats: {} }, society = {}, commitments = [], flags = scene.flags ?? {};
  let rel = 0, party = 0, media = 0, funds = 0, capital = 0, standing = 0, press = 0;
  for (const entry of scene.history) {
    const fn = FUNCTIONS[entry.fn];
    if (!fn) continue;
    const q = entry.band === 'good' ? 1 : entry.band === 'mid' ? 0.5 : 0;
    const bold = fn.bold ? (entry.band === 'good' ? 1.5 : entry.band === 'bad' ? -0.6 : 1) : 1;
    for (const [key, value] of Object.entries(fn.gain ?? {})) {
      const amount = value * q * (key === 'party' ? bold : 1);
      if (STAT_KEYS[key]) addTo(effects.stats, STAT_KEYS[key], amount);
      else if (key === 'rel') rel += amount * (fn.bold && entry.band === 'bad' ? -0.5 : 1);
      else if (key === 'party') party += amount;
      else if (key === 'media') media += amount;
      else if (key === 'seg') society.segment = round2((society.segment ?? 0) + amount);
      else if (key === 'home') society.home = round2((society.home ?? 0) + amount);
    }
    for (const [key, value] of Object.entries(fn.cost ?? {})) { if (key === 'rel') rel += value; else if (key === 'pop') addTo(effects.stats, 'popularity', value); else if (key === 'capital' && flags.capital) capital += value; }
    // a move that went badly leaves a mark on the standing of the player whatever it was
    if (entry.band === 'bad') { addTo(effects.stats, 'reputation', -0.3); standing--; }
    if (entry.band === 'good' && ['clarify', 'own', 'data', 'verify'].includes(entry.fn)) standing++;
    if (entry.fn === 'contest') press += entry.band === 'good' ? 1 : -1;
    if (fn.fund) funds -= FUND_COST[kindOf(scene)] ?? 0;
    if (fn.commit && COMMITMENTS[fn.commit]) commitments.push({ kind: fn.commit, node: entry.node, weeks: COMMITMENTS[fn.commit].weeks, chance: keptChance({ band: entry.band, k: entry.k ?? 0 }, scene) });
  }
  if (rel) Object.assign(effects, relFx(scene.sceneKey, round2(clamp(rel, -4, 4))));
  if (party && flags.party) effects.party = { support: round2(clamp(party, -3, 3)) };
  if (media) effects.relations = { ...(effects.relations ?? {}), media: round2(clamp(media, -2, 2)) };
  if (funds) effects.funds = funds;
  if (capital) effects.capital = capital;
  for (const key of Object.keys(effects.stats)) { effects.stats[key] = round2(clamp(effects.stats[key], -2.5, 2.5)); if (!effects.stats[key]) delete effects.stats[key]; }
  if (!Object.keys(effects.stats).length) delete effects.stats;
  // what stays pending in the career: each commitment is kept or broken weeks later, by the chance the way it was made gave it
  const pending = commitments.map(item => ({
    weeks: item.weeks, mergeKey: `${scene.id}|${item.node}|${item.kind}`, label: COMMITMENTS[item.kind].label[0], hint: COMMITMENT_TEXT.hint[0],
    outcomes: [
      { label: COMMITMENT_TEXT.kept[0], chance: item.chance, effects: { stats: { reputation: item.kind === 'annuncio' ? 0.8 : 0.5 }, ...relFx(scene.sceneKey, 1.5) } },
      { label: COMMITMENT_TEXT.broken[0], chance: round2(1 - item.chance), effects: { stats: { reputation: item.kind === 'annuncio' ? -1.6 : -1 }, ...relFx(scene.sceneKey, -2) } }
    ]
  }));
  const lines = [], trust = scene.tally.trust;
  if (trust >= 2) lines.push(CONSEQUENCE_LINES.trustUp[0]); else if (trust <= -1) lines.push(CONSEQUENCE_LINES.trustDown[0]);
  if (scene.tally.k >= 2) lines.push(CONSEQUENCE_LINES.learned[0]);
  if (scene.tally.tension >= 3) lines.push(CONSEQUENCE_LINES.tense[0]); else if (scene.history.length && scene.tally.tension <= 0) lines.push(CONSEQUENCE_LINES.calm[0]);
  if (press > 0) lines.push(CONSEQUENCE_LINES.pressUp[0]); else if (press < 0) lines.push(CONSEQUENCE_LINES.pressDown[0]);
  if (standing > 0) lines.push(CONSEQUENCE_LINES.standingUp[0]); else if (standing < 0) lines.push(CONSEQUENCE_LINES.standingDown[0]);
  if (funds) lines.push(CONSEQUENCE_LINES.costFunds[0]);
  if (capital) lines.push(CONSEQUENCE_LINES.costCapital[0]);
  if (scene.history.some(item => (item.k ?? 0) < 1 && ['propose', 'announce', 'fund', 'table'].includes(item.fn))) lines.push(CONSEQUENCE_LINES.unprepared[0]);
  return { effects, society, pending, commitmentList: commitments.map(item => ({ kind: item.kind, weeks: item.weeks })), commitmentKinds: [...new Set(commitments.map(item => item.kind))], consequences: lines, mediaTone: press > 0 ? 1 : press < 0 ? -1 : null };
}
// How the encounter closes, by what was done in it.
export function outcomeKindOf(scene, bandName) {
  const picks = scene.history, tension = scene.tally.tension;
  if (tension >= 3 && bandName !== 'good') return 'contrasto';
  const commits = picks.filter(item => FUNCTIONS[item.fn]?.commit && item.band !== 'bad');
  if (bandName === 'bad') return tension >= 2 ? 'contrasto' : 'irrisolto';
  if (picks.some(item => ['mediate', 'compromise', 'vote'].includes(item.fn) && item.band !== 'bad')) return bandName === 'good' ? 'accordo' : 'parziale';
  if (commits.some(item => ['propose', 'announce', 'fund', 'table'].includes(item.fn))) return 'impegno';
  if (picks.slice(-2).some(item => ['verify', 'appoint', 'data', 'involve'].includes(item.fn))) return 'rinvio';
  return bandName === 'good' ? 'accordo' : 'parziale';
}
function finish(scene, spec) {
  const scores = scene.history.map(item => item.score);
  const performance = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length));
  const b = band(performance);
  const kind = outcomeKindOf(scene, b);
  const after = sceneAftermath(scene);
  scene.status = 'done';
  scene.outcome = { performance, band: b, kind, edge: round1(clamp((performance - 55) / 4.5, -6, 6)), summary: OUTCOME_KINDS[kind].text[0], flavor: (isCitizens(scene) ? CITIZENS.closings : spec.closings)[b][0], consequences: [...after.consequences, ...after.commitmentKinds.map(item => COMMITMENTS[item].line[0])].slice(0, 7), audience: scene.audience.mood };
}
// The effects the store applies when the scene ends: the verdict (`edge`) scales the plain activity (career-engine `sceneEdge`) and the decisions made add their own (`extras`, `society`, `commitments`).
export function activityEffects(scene) {
  if (!scene.outcome) return null;
  const after = sceneAftermath(scene);
  return { sceneKey: scene.sceneKey, activityId: scene.activityId, target: scene.target ?? null, familyId: scene.familyId, edge: scene.outcome.edge, performance: scene.outcome.performance, band: scene.outcome.band, kind: scene.outcome.kind ?? null, declined: false, line: scene.outcome.summary, sceneId: scene.id, extras: Object.keys(after.effects).length ? after.effects : null, society: after.society, commitments: after.pending, commitmentList: after.commitmentList, picks: scene.history.map(item => item.fn), consequences: scene.outcome.consequences ?? [], mediaTone: after.mediaTone ?? (scene.outcome.performance >= 62 ? 1 : scene.outcome.performance < 45 ? -1 : 0.3) };
}
// A scene left halfway closes with what was done so far (a verdict of its own, a little worse than a scene played to the end).
export function abandonActivityScene(scene) {
  const done = scene.history.map(item => item.score);
  const performance = Math.round(clamp((done.length ? done.reduce((a, b) => a + b, 0) / done.length : 40) - 6, 20, 80));
  const after = sceneAftermath(scene);
  return { ...scene, status: 'abandoned', outcome: { performance, band: band(performance), kind: null, edge: round1(clamp((performance - 55) / 4.5, -6, 6)), summary: ACTIVITY_SCENE_UI.abandoned[0], flavor: null, consequences: after.consequences, audience: scene.audience.mood, left: true }, history: scene.history };
}
export const activityProgress = scene => ({ index: Math.max(0, BEATS.indexOf(scene.nodeId)), total: scene.tally?.asked || ['q4', 'r4'].includes(scene.nodeId) ? BEATS.length : BEATS.length - 2 });
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
// How far the player steps toward the others for a move (the standing rooms only): a challenge or a mediation brings him into the middle, a handshake brings the two closer.
const STEP = Object.freeze({ contest: 110, mediate: 70, compromise: 90, announce: 60, propose: 45, assign: 50, vote: 0, involve: 40, fund: 70, story: 40 });
// What the guest who does not speak does while the other reacts, by the kind of reaction.
const SIDE_GESTURE = Object.freeze({ approvazione: 'ascolta', dissenso: 'dissenso', perplessita: 'esita', protesta: 'dissenso', soddisfazione: 'applaude', compromesso: 'ascolta', garanzie: 'appunti' });
export function activityStage(scene, node) {
  const layout = LAYOUT[scene.setting] ?? LAYOUT.sala;
  const nodeId = scene.nodeId;
  const reacting = ['r1', 'r2', 'r3', 'r4'].includes(nodeId);
  const out = {};
  for (const member of scene.cast) {
    let [x, y, facing] = layout[member.id === 'giocatore' ? 'giocatore' : member.id];
    const speaking = node?.speaker === member.id;
    let gesture;
    if (nodeId === 'esito') gesture = 'saluta';
    else if (reacting && member.id === 'giocatore') { gesture = node.move?.gesture ?? 'apre'; if (layout.posture === 'stand') x += STEP[node.move?.fn] ?? 0; }
    else if (reacting && !speaking) gesture = SIDE_GESTURE[node.reaction] ?? 'ascolta';
    else if (speaking) gesture = node.gesture && node.gesture !== 'sottolinea' ? node.gesture : pickGesture(scene, nodeId, member.id, SPEAK_GESTURES);
    else gesture = node?.speaker ? pickGesture(scene, nodeId, member.id, LISTEN_GESTURES) : null;
    if (member.id === 'giocatore' && nodeId === 'apertura') out[member.id] = stagePose(x, y, { facing, posture: layout.posture, gesture: speaking ? 'saluta' : null, path: [{ x: -70, y: 304 }, { x, y }] });
    else out[member.id] = stagePose(x, y, { facing, posture: nodeId === 'esito' ? 'stand' : layout.posture, gesture });
  }
  const camera = nodeId === 'apertura' || nodeId === 'esito' ? 'wide' : reacting ? (node?.reaction === 'protesta' ? 'protest' : 'stage') : node?.speaker === 'giocatore' ? 'left' : 'right';
  return { setting: scene.setting, poses: out, camera: ['q1', 'q2', 'q3', 'q4', 'r1', 'r2', 'r3', 'r4'].includes(nodeId) ? camera : 'wide', crowd: 'quiet', props: { room: scene.setting, mood: scene.audience.mood >= 58 ? 'warm' : scene.audience.mood < 45 ? 'cold' : 'mixed' } };
}
for (const setting of ROOM_SETTINGS) registerStageScript(setting, activityStage);
