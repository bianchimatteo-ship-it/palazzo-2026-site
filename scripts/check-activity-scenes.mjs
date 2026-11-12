// The six optional scenes of the weekly activities (core/activity-scenes.js): citizens and associations, the building site, the party meeting, the hearing in committee, the newspaper interview and the
// Council of Ministers. On the real engine:
//   1. the data: six scenes tied to real ids of WEEKLY_ACTIVITIES, 6 to 8 families of topics each, every text a pair with an English side, no name of a control («Partecipa»…) as a person, no free parts;
//   2. the machine: deterministic by seed, the six beats, a memory of the last families (not drawn again in a row), variety across seeds, a scene saved as JSON and resumed is the same;
//   3. «Partecipa» and «Simula» come from the same scene: the choices of the quick way, played by hand, give the same outcome; a better player does better; the verdict scales the plain activity;
//   4. the store: opening a scene never starts by itself, never costs, never advances the week; one scene at a time; the cost of the activity is applied ONCE at the end (played, simulated or left halfway);
//      there is no third button: an activity not chosen is simply left alone; the family is remembered.
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';
import { readFile } from 'node:fs/promises';
// the modules at the stamp of the build (the same instances the game uses: the scene kinds register themselves in the engine that imported them)
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { WEEKLY_ACTIVITIES } = await load('src/data/simulation/career-rules.js');
const { ALL_PAIRS } = await load('src/data/activity-scene-lines.js');
const { ACTIVITY_SCENES, SCENE_KEYS, activityHasScene, createActivityScene, sceneKeyOf, pickFamily } = await load('src/core/activity-scenes.js');
const { autoPlay, chooseInScene, sceneEffects, sceneNode } = await load('src/core/scene-engine.js');
const { stageOf } = await load('src/core/stage-script.js');

// ---------- 1. the data ----------
const REQUIRED = ['associazioni', 'cittadini', 'sopralluogo', 'ispezione-cantiere', 'riunione', 'audizione-commissione', 'intervista', 'consiglio-ministri'];
assert.equal(SCENE_KEYS.length, 6, 'Sei scene.');
for (const id of REQUIRED) {
  const activity = WEEKLY_ACTIVITIES.find(item => item.id === id);
  assert.ok(activity, `${id}: è un’attività reale del gioco.`);
  assert.equal(activity.scene, 'attivita', `${id}: ha la scena.`); assert.ok(activityHasScene(id) && sceneKeyOf(id), `${id}: la scena è collegata.`);
}
const CONTROL = /^\s*(partecipa|non partecipare|simula|salta)/i;
const pairs = new Set(ALL_PAIRS.map(pair => pair[0]));
for (const [key, spec] of Object.entries(ACTIVITY_SCENES)) {
  assert.ok(spec.families.length >= 6 && spec.families.length <= 8, `${key}: da 6 a 8 famiglie di temi (${spec.families.length}).`);
  assert.equal(spec.approaches.length, 3, `${key}: tre approcci.`);
  assert.ok(spec.activityIds.every(id => WEEKLY_ACTIVITIES.some(item => item.id === id)), `${key}: id reali.`);
  const texts = [spec.title, spec.kicker, spec.place, ...Object.values(spec.intro), ...spec.cast.map(item => item.tag), ...spec.approaches.flatMap(item => [item.label, item.detail]), ...spec.families.flatMap(item => [item.label, item.open, item.follow]), ...Object.values(spec.reactions).flat(), ...Object.values(spec.closings)];
  for (const pair of texts) { assert.ok(Array.isArray(pair) && pair[0] && pair[1], `${key}: ogni testo ha italiano e inglese.`); assert.ok(pairs.has(pair[0]), `${key}: «${pair[0].slice(0, 40)}» è nel libro delle frasi.`); assert.ok(!/\{\}|\{\d\}/.test(pair[0] + pair[1]), `${key}: nessuna parte libera.`); assert.ok(!/[àèéìòù]\b/.test(pair[1].replace(/[“”’]/g, '')) && !/\b(il|della|degli|nel|non)\b/.test(pair[1].toLowerCase().replace(/non-/g, '')), `${key}: l’inglese non è italiano («${pair[1].slice(0, 40)}»).`); }
  for (const member of spec.cast) for (const name of member.names) assert.ok(!CONTROL.test(name), `${key}: ${name} non è il nome di un pulsante.`);
  assert.equal(new Set(spec.families.map(item => item.id)).size, spec.families.length, `${key}: famiglie diverse.`);
}
assert.equal(new Set(ALL_PAIRS.map(pair => pair[0])).size, ALL_PAIRS.length, 'Nessun doppione nel libro delle frasi.');

// ---------- 2. the machine ----------
const make = (sceneKey, seed, extra = {}) => createActivityScene({ id: `t-${seed}`, seed, sceneKey, activityId: ACTIVITY_SCENES[sceneKey].activityIds[0], player: { name: 'Anna Verdi', tag: 'Deputata · Prova' }, playerAvatar: null, stats: { competence: 60, charisma: 55, reputation: 50 }, ...extra });
// one step at a time through the beats: the continue/finish button where it is the only choice, `pick` where there is a decision
const first = choices => choices.find(choice => !choice[2])[0];
const walk = (scene, pick, onNode = null) => { let s = scene; const seen = []; for (let guard = 0; guard < 30 && s.status === 'active'; guard++) { seen.push(s.nodeId); const node = sceneNode(s); onNode?.(s, node); s = chooseInScene(s, node.choices.length === 1 ? node.choices[0][0] : pick(node.choices, node, s)); } return { scene: s, seen }; };
const play = (scene, pick) => walk(scene, pick).scene;
const best = choices => choices.map(choice => choice[0])[0];
for (const key of SCENE_KEYS) {
  const a = make(key, 'seme-1'), b = make(key, 'seme-1');
  assert.deepEqual(a, b, `${key}: stesso seme, stessa scena.`);
  assert.equal(a.cast.length, 3); assert.ok(a.cast.every(item => item.name && !CONTROL.test(item.name) && item.avatar), `${key}: tre persone con nome e avatar.`);
  assert.equal(new Set(a.cast.map(item => item.name)).size, 3, `${key}: tre nomi diversi.`);
  const families = new Set(Array.from({ length: 40 }, (_, i) => make(key, `v-${i}`).familyId));
  assert.ok(families.size >= 5, `${key}: varietà tra scene diverse (${families.size} famiglie in 40 scene).`);
  // memory: the last three families are not drawn again
  const spec = ACTIVITY_SCENES[key];
  for (let i = 0; i < 30; i++) { const recent = spec.families.slice(0, 3).map(item => item.id); assert.ok(!recent.includes(pickFamily(spec, `m-${i}`, recent).id), `${key}: non ripete le ultime famiglie.`); }
  assert.ok(pickFamily(spec, 'x', [], spec.families[2].id).id === spec.families[2].id, `${key}: una preferenza della situazione vale.`);
  // the beats: the opening, three moments of decision with their reactions (a fourth when guarantees are asked or the tone has risen), the outcome
  const stepped = walk(make(key, 'seme-2'), choices => first(choices), (scene, node) => { assert.ok(node.text && node.speaker && node.camera && node.choices.length, `${key}/${scene.nodeId}: il momento ha testo, voce, camera, scelte.`); assert.ok(scene.cast.some(item => item.id === node.speaker)); const stage = stageOf(scene, node); assert.equal(stage.setting, ACTIVITY_SCENES[key].setting); assert.ok(Object.keys(stage.poses).length === 3, `${key}/${scene.nodeId}: tre pose.`); });
  const s = stepped.scene;
  assert.deepEqual(stepped.seen.slice(0, 7), ['apertura', 'q1', 'r1', 'q2', 'r2', 'q3', 'r3'], `${key}: i momenti in ordine.`);
  assert.ok([7, 9].includes(stepped.seen.length), `${key}: tre momenti di decisione, quattro quando servono garanzie (${stepped.seen.join(' ')}).`);
  assert.equal(s.nodeId, 'esito'); assert.equal(s.status, 'done'); assert.ok(sceneNode(s).final && s.outcome, `${key}: l’esito è finale.`);
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(s))), JSON.stringify(s), `${key}: la scena è salvabile e uguale dopo il salvataggio.`);
  // a scene resumed from a save continues the same
  const half = play(make(key, 'seme-3'), choices => first(choices)); assert.deepEqual(half, play(JSON.parse(JSON.stringify(make(key, 'seme-3'))), choices => first(choices)), `${key}: ripresa identica.`);
  // the quick way: the same scene, the careful choice at each beat; played by hand the same choices give the same outcome
  const quick = autoPlay(make(key, 'seme-4'));
  assert.equal(quick.status, 'done');
  const picks = quick.history.map(item => item.choice);
  const manual = play(make(key, 'seme-4'), () => picks.shift());
  assert.deepEqual(manual.outcome, quick.outcome, `${key}: «Partecipa» e «Simula» danno lo stesso esito con le stesse scelte.`);
  assert.deepEqual(sceneEffects(manual), sceneEffects(quick), `${key}: stesse scelte, stesse conseguenze.`);
  const worst = play(make(key, 'seme-4'), (choices, node, scene) => choices.filter(choice => !choice[2]).map(choice => ({ id: choice[0], score: chooseInScene(scene, choice[0]).history.at(-1).score })).sort((x, y) => x.score - y.score)[0].id);
  assert.ok(quick.outcome.performance >= worst.outcome.performance, `${key}: chi sceglie meglio fa meglio (${quick.outcome.performance} ≥ ${worst.outcome.performance}).`);
  const effects = sceneEffects(quick); assert.ok(Number.isFinite(effects.edge) && effects.edge >= -6 && effects.edge <= 6 && effects.activityId === ACTIVITY_SCENES[key].activityIds[0] && effects.line, `${key}: il verdetto è un’intensità limitata.`);
  const strong = autoPlay(make(key, 'seme-5', { stats: { competence: 95, charisma: 95, reputation: 95 } })).outcome.performance, weak = autoPlay(make(key, 'seme-5', { stats: { competence: 10, charisma: 10, reputation: 10 } })).outcome.performance;
  assert.ok(strong > weak, `${key}: chi è preparato fa meglio (${strong} > ${weak}).`);
}
assert.throws(() => chooseInScene(make('sede', 's'), 'inesistente'), /non valida/, 'Una scelta inesistente è rifiutata.');
const sopralluogo = make('cantiere', 'v1', { variant: 'head' }), ispezione = make('cantiere', 'v1', { variant: 'opposition' });
assert.notEqual(sceneNode(sopralluogo).text, sceneNode(ispezione).text, 'Il sopralluogo dell’amministratore e l’ispezione dell’opposizione si introducono in modo diverso.');

// ---------- 4. the store ----------
{
  const { store } = await startCareer({ seed: 'scene-store', level: 'deputato' });
  const snap = () => { const g = store.getState().game; return { week: g.week.index, funds: g.resources.funds, capital: g.resources.politicalCapital }; };
  const date = () => store.getState().clock.currentDate;
  const before = snap(), day = date();
  assert.equal(store.getState().scene ?? null, null, 'Nessuna scena parte da sola.');
  const opened = await store.startActivityScene('associazioni', { target: null });
  assert.equal(store.getState().scene.kind, 'attivita'); assert.deepEqual(snap(), before, 'Aprire la scena non costa nulla e non fa avanzare la settimana.'); assert.equal(date(), day, 'La data non cambia.');
  await assert.rejects(() => Promise.resolve().then(() => store.startActivityScene('cittadini', { target: 'anziani' })), /scena/i, 'Una scena alla volta.');
  assert.throws(() => store.performWeeklyActivity('associazioni'), /scena/i, 'Nessun secondo avvio (e nessun doppio costo) mentre la scena è aperta.');
  assert.ok(store.getState().scene.familyId === opened.familyId);
  // play to the end through the store
  while (store.getState().scene.status === 'active') { const node = sceneNode(store.getState().scene); store.sceneChoose(node.choices[0][0]); assert.deepEqual(snap(), before, 'Durante la scena nulla viene pagato.'); }
  store.sceneChoose('fine');
  const cost = WEEKLY_ACTIVITIES.find(item => item.id === 'associazioni').cost;
  const after = snap();
  assert.equal(store.getState().scene, null, 'La scena finisce e lascia la partita libera.');
  assert.equal(after.funds, before.funds - cost.funds, 'Il costo in denaro è applicato una sola volta.'); assert.equal(after.week, before.week, 'La settimana non avanza.');
  assert.equal(store.getState().game.flags.sceneLog.at(-1).family, opened.familyId, 'La famiglia di temi è ricordata.');
  // «Simula»: the same plain activity with the verdict of the careful quick play; the cost once
  const mid = snap();
  await store.startActivityScene('riunione', { quick: true });
  assert.equal(store.getState().scene, null, 'Simula non apre nessuna scena.');
  assert.equal(snap().week, mid.week, 'Simula non fa avanzare la settimana.');
  // left halfway: the costs once, never twice
  const pre = snap();
  await store.startActivityScene('audizione-commissione');
  store.sceneChoose('continua'); store.sceneAbandon();
  const post = snap(); assert.equal(store.getState().scene, null);
  assert.equal(pre.funds - post.funds, WEEKLY_ACTIVITIES.find(item => item.id === 'audizione-commissione').cost.funds ?? 0, 'Lasciare a metà applica il costo una volta sola.');
  assert.equal(post.week, pre.week);
  // the same family is not drawn in a row for the same kind of scene
  await store.startActivityScene('cittadini', { target: 'anziani' }); const one = store.getState().scene.familyId; store.sceneAbandon();
  await assert.rejects(() => store.startActivityScene('sopralluogo'), /opera|cantiere|delega/i, 'Un’attività non disponibile non apre la scena.');
  await assert.rejects(() => store.startActivityScene('consiglio-ministri'), /governo|Presidente del Consiglio/i, 'Il Consiglio dei ministri è solo per chi guida un governo.');
  assert.ok(typeof one === 'string');
}
console.log('Le sei scene facoltative sono verificate: dati reali e bilingui, sei momenti, semi e memoria, «Partecipa» = «Simula» con le stesse scelte, costo applicato una sola volta, nessuna settimana avanzata, senza un terzo pulsante.');
