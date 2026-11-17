// Audit of the dialogues and topics of the activity scenes: coverage of every weekly activity, integrity of the data (moves, functions, reactions, texts in both languages, no duplicates) and real variety
// (many seeded scenes of every kind: families, first questions, moves, reactions, names). A gap fails the check.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}?v=${build}`, import.meta.url).href);
const { WEEKLY_ACTIVITIES } = await load('src/data/simulation/career-rules.js');
const { ACTIVITY_SCENES, SCENE_KEYS, activityHasScene, sceneKeyOf, createActivityScene, activityNode } = await load('src/core/activity-scenes.js');
const M = await load('src/data/activity-scene-moves.js');
const activities = Object.values(WEEKLY_ACTIVITIES);

// ---------- coverage ----------
const withScene = activities.filter(item => activityHasScene(item.id));
const byCategory = {}; for (const a of activities) { (byCategory[a.category] ??= { all: 0, scene: 0 }).all++; if (activityHasScene(a.id)) byCategory[a.category].scene++; }
for (const a of activities) assert.ok(a.label && a.detail && a.effects && a.cost !== undefined, `${a.id}: scheda completa (nome, descrizione, costo, effetti, rischio).`);
assert.equal(new Set(activities.map(a => a.id)).size, activities.length, 'Identificativi delle attività unici.');
for (const key of SCENE_KEYS) for (const id of ACTIVITY_SCENES[key].activityIds) assert.ok(activities.some(a => a.id === id), `${key}: l’attività ${id} esiste.`);
assert.equal(withScene.length, activities.length, `Tutte le attività hanno una scena animata (${withScene.length}/${activities.length}).`);
const { ACTIVITY_CONTEXT } = await load('src/data/activity-scene-context.js');
const intros = [];
for (const [id, c] of Object.entries(ACTIVITY_CONTEXT)) {
  assert.ok(ACTIVITY_SCENES[c.scene], `${id}: scena ${c.scene} esistente.`);
  assert.ok(ACTIVITY_SCENES[c.scene].families.some(f => f.id === c.prefer), `${id}: argomento preferito ${c.prefer} esistente nella scena.`);
  for (const pair of [c.title, c.intro]) assert.ok(Array.isArray(pair) && pair.length === 2 && pair.every(t => t.length >= 8), `${id}: testo italiano e inglese.`);
  assert.ok(c.intro[0].length >= 60, `${id}: l’apertura è specifica (non una frase generica).`);
  intros.push(c.intro[0]);
}
assert.equal(new Set(intros).size, intros.length, 'Nessuna apertura ripetuta tra le attività.');
// a scene built for a contextual activity opens with its own title and line, and leans to its topic
{
  const { activityChoose: choose } = await load('src/core/activity-scenes.js');
  for (const [id, c] of Object.entries(ACTIVITY_CONTEXT)) {
    const scene = createActivityScene({ id: `ctx-${id}`, seed: `ctx|${id}`, sceneKey: c.scene, activityId: id, player: { name: 'Anna Verdi', tag: 'Deputata' }, playerAvatar: null, stats: {} });
    const node = activityNode(scene);
    assert.equal(node.text, c.intro[0], `${id}: apre con la sua frase.`); assert.equal(node.title, c.title[0]);
    assert.equal(scene.familyId, c.prefer, `${id}: parte dal suo argomento.`);
    assert.ok(activityNode(choose(scene, 'continua')).choices.length >= 3, `${id}: le scelte ci sono.`);
  }
}
for (const category of Object.keys(byCategory)) assert.equal(byCategory[category].scene, byCategory[category].all, `Ogni attività di «${category}» ha una scena.`);
// the activities with NO scene are resolved by the plain model, which the verdict engine covers: they all carry a text for each tone
// ---------- data integrity ----------
const seenIds = new Set();
for (const [scene, beats] of Object.entries(M.MOVES)) for (const [beat, list] of Object.entries(beats)) {
  assert.ok(list.length >= 5, `${scene}/${beat}: almeno cinque alternative (${list.length}).`);
  const fns = new Set(list.map(move => move.fn)); assert.ok(fns.size >= 4, `${scene}/${beat}: almeno quattro funzioni diverse (${fns.size}).`);
  for (const move of list) {
    assert.ok(M.FUNCTIONS[move.fn], `${move.id}: funzione ${move.fn} nota.`);
    assert.ok(!seenIds.has(`${scene}|${beat}|${move.id}`), `${move.id}: identificativo unico nel momento.`); seenIds.add(`${scene}|${beat}|${move.id}`);
    assert.ok(Array.isArray(move.label) && move.label.length === 2 && move.label.every(t => t.length >= 12 && t.length <= 140), `${move.id}: testo italiano e inglese di lunghezza ragionevole.`);
  }
  const labels = list.map(move => move.label[0]); assert.equal(new Set(labels).size, labels.length, `${scene}/${beat}: nessuna alternativa ripetuta.`);
}
for (const fn of Object.keys(M.FUNCTIONS)) for (const band of ['good', 'mid', 'bad']) {
  const lines = [M.REACTION_LINES[fn]?.[band], ...(M.REACTION_ALT[fn]?.[band] ?? [])].filter(Boolean);
  assert.ok(lines.length >= 3 && new Set(lines).size === lines.length, `reazioni ${fn}/${band}: almeno tre frasi diverse (${lines.length}).`);
}
for (const key of SCENE_KEYS) {
  const scene = ACTIVITY_SCENES[key];
  assert.ok(scene.families.length >= 6, `${key}: almeno sei famiglie di argomenti (${scene.families.length}).`);
  assert.equal(new Set(scene.families.map(f => f.id)).size, scene.families.length, `${key}: famiglie con identificativi unici.`);
  assert.ok(scene.cast.length >= 2, `${key}: almeno due personaggi tipo.`);
  assert.ok(Object.keys(scene.closings ?? {}).length >= 3, `${key}: chiusure per esito.`);
}
// ---------- variety on many seeds ----------
const { activityChoose } = await load('src/core/activity-scenes.js');
for (const key of SCENE_KEYS) {
  const families = new Set(), q1Texts = new Set(), q1Choices = new Set(), names = new Set();
  for (let n = 0; n < 80; n++) {
    const scene = createActivityScene({ id: `a-${n}`, seed: `audit|${key}|${n}`, sceneKey: key, activityId: ACTIVITY_SCENES[key].activityIds[0], player: { name: 'Anna Verdi', tag: 'Deputata · Prova' }, playerAvatar: null, stats: { competence: 60, charisma: 55, reputation: 50 } });
    families.add(scene.familyId);
    for (const person of scene.cast ?? []) if (person.role !== 'giocatore') names.add(person.name);
    const node = activityNode(activityChoose(scene, 'continua'));
    q1Texts.add(node.text); q1Choices.add(JSON.stringify((node.choices ?? []).map(choice => choice[1])));
  }
  assert.ok(families.size >= 5, `${key}: su 80 scene compaiono almeno cinque famiglie di argomenti (${families.size}).`);
  assert.ok(q1Texts.size >= Math.min(6, ACTIVITY_SCENES[key].families.length), `${key}: una prima battuta diversa per argomento (${q1Texts.size}).`);
  assert.ok(q1Choices.size >= 5, `${key}: prime domande con alternative diverse (${q1Choices.size}).`);
  assert.ok(names.size >= 4, `${key}: personaggi con nomi diversi (${names.size}).`);
}
console.log(`check-activity-audit: ok (${withScene.length}/${activities.length} attività con scena; ${Object.entries(byCategory).map(([k, v]) => `${k} ${v.scene}/${v.all}`).join(', ')})`);
