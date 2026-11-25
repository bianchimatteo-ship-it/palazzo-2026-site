// Whole conversations of the activity scenes, not single lines: for every activity with a scene, several seeds, four situations of the player (who governs, who opposes from a council, who sits
// with no side, who holds no office) and different ways of answering, the scene is played from the opening to the outcome and the THREAD is checked at every step:
//   question → the guest who asks speaks (and is the one highlighted) → the answer of the player → the reply of THAT guest is about the subject of the encounter and about the KIND of answer given
//   (an inquiry, a commitment, a mediation, a clash) and how it went → the second guest takes the floor on the same subject saying how the first answer landed → the decision and the guarantees
//   asked are about the subject → the line «who you are» before the first question fits the office of the player (never «you govern» to someone with no office).
// Variety: one career plays 36 scenes in a row with the memory of the game (the same wording is not met again in close scenes), and the replies, bridges and decisions it meets are counted.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}?v=${build}`, import.meta.url).href);
const S = await load('src/core/activity-scenes.js');
const { WEEKLY_ACTIVITIES } = await load('src/data/simulation/career-rules.js');
const T = await load('src/data/activity-scene-threads.js');
const fill = (pair, label) => pair[0].replace('{}', label);
const SITUATIONS = { governo: { govern: true, seat: true }, opposizione: { opp: true, seat: true, local: true }, seggio: { seat: true }, nessuno: { seat: false } };
const ids = WEEKLY_ACTIVITIES.map(item => item.id).filter(id => S.activityHasScene(id));
const player = { name: 'Elena Prova', tag: 'Consigliera' };
let conversations = 0, beats = 0;
const problems = [];
const want = (ok, text) => { if (!ok) problems.push(text); };
// one conversation: `pick(choices, step)` chooses the answer
function play(activityId, seed, situation, pick, memory = null) {
  const sceneKey = S.sceneKeyOf(activityId);
  const scene = S.createActivityScene({ id: `filo-${seed}`, seed, sceneKey, activityId, player, playerAvatar: null, stats: { competence: 55, charisma: 55, reputation: 55 }, situation: { party: true, funds: true, capital: true, ...situation }, party: { label: 'Partito di Prova' }, memory });
  const label = scene.topic.label, asked = {};
  const seen = [];
  for (let step = 0; step < 14; step++) {
    const node = { ...S.activityNode(scene), id: scene.nodeId };
    seen.push(node); beats++;
    const where = `${activityId}/${seed}/${node.id}`;
    if (/^q[1-4]$/.test(node.id)) asked[node.id] = node.speaker;
    if (/^r[1-4]$/.test(node.id)) {
      const n = node.id[1], last = scene.history.at(-1);
      want(node.speaker === asked[`q${n}`], `${where}: risponde chi ha fatto la domanda (${node.speaker} ≠ ${asked[`q${n}`]}).`);
      const group = T.FN_GROUP[last.fn];
      want(Boolean(node.reply), `${where}: dopo la risposta c’è la replica sul tema.`);
      if (node.reply) {
        want(node.reply.includes(`«${label}»`), `${where}: la replica è sul tema «${label}» (${node.reply}).`);
        want(T.FOLLOW[group][last.band].some(pair => fill(pair, label) === node.reply), `${where}: la replica segue il tipo di risposta (${last.fn} → ${group}, ${last.band}).`);
      }
    }
    if (node.id === 'q2') {
      const band = scene.history[0]?.band ?? 'mid';
      want(T.BRIDGE[band].some(pair => (node.preface ?? []).includes(fill(pair, label))), `${where}: la seconda voce riprende il tema e com’è andata la prima risposta (${band}).`);
    }
    if (node.id === 'q3') want(node.text.includes(`«${label}»`), `${where}: la decisione è chiesta sul tema.`);
    if (node.id === 'q4') want(node.text.includes(`«${label}»`), `${where}: le garanzie sono chieste sul tema.`);
    if (node.id === 'q1') {
      const role = situation.govern ? 'governo' : situation.opp ? 'opposizione' : situation.seat === false ? 'nessuno' : null;
      const lines = (node.preface ?? []);
      for (const [key, list] of Object.entries(T.ROLE)) {
        const present = list.some(pair => lines.includes(pair[0]));
        want(present === (key === role), `${where}: la riga sul ruolo «${key}» ${key === role ? 'c’è' : 'non c’è'} (situazione ${JSON.stringify(situation)}).`);
      }
    }
    if (node.final) break;
    const open = node.choices.filter(choice => !choice[2]);
    const choice = open.length > 1 ? pick(open, step) : open[0];
    S.activityChoose(scene, choice[0]);
  }
  conversations++;
  return { scene, seen };
}
// every activity, seeds, situations, three ways of answering (the first move, the last, one in the middle)
const pickers = [(open) => open[0], (open) => open.at(-1), (open, step) => open[step % open.length]];
for (const activityId of ids) for (const seed of ['a', 'b', 'c']) for (const [name, situation] of Object.entries(SITUATIONS)) for (const [p, pick] of pickers.entries()) play(activityId, `filo|${activityId}|${seed}|${name}|${p}`, situation, pick);
// the variety of a career: 36 scenes in a row with the memory of the game
const memory = { lines: {}, names: [], stances: [] };
const met = { reply: [], bridge: [], decide: [] };
for (let n = 0; n < 36; n++) {
  const activityId = ids[n % ids.length];
  const { scene, seen } = play(activityId, `carriera|${n}`, SITUATIONS.seggio, pickers[n % 3], memory);
  for (const item of Object.values(scene.lines)) (memory.lines[item.key] ??= []).push(item.index);
  memory.names.push(...scene.cast.map(item => item.name));
  met.reply.push(seen.find(node => node.id === 'r1')?.reply?.replace(/«[^»]*»/, '«…»') ?? null);
  met.bridge.push(seen.find(node => node.id === 'q2')?.preface?.[0]?.replace(/«[^»]*»/, '«…»') ?? null);
  met.decide.push(seen.find(node => node.id === 'q3')?.text?.replace(/«[^»]*»/, '«…»') ?? null);
}
for (const [kind, list] of Object.entries(met)) {
  const shown = list.filter(Boolean);
  let repeats = 0; for (let i = 1; i < shown.length; i++) if (shown[i] === shown[i - 1]) repeats++;
  want(repeats === 0, `Varietà: la stessa frase (${kind}) in due scene di fila (${repeats}).`);
  want(new Set(shown).size >= Math.min(8, shown.length), `Varietà: almeno 8 formulazioni diverse di ${kind} in 36 scene (${new Set(shown).size}).`);
}
// grammar of the places and names put into a sentence (causes found in games): a region takes its article and preposition («dalla Lombardia», «dal Veneto», «dall’Abruzzo», «nelle Marche»), a name that carries its
// article never follows «di» («di la mia lista»), and a municipality is «a Siena», not «in Siena»
{
  const { ITALIAN_REGIONS } = await load('src/data/regions.js');
  const R = await load('src/core/rally-scene.js');
  const REGION = ITALIAN_REGIONS.join('|');
  const bad = text => [new RegExp(`\\b(a|da|di) (?:${REGION})\\b`), /\b(di|a|da|su|in) (il|lo|la|le|i|gli) /i, new RegExp(`\\bnelle? (?!Marche)(?:${REGION})\\b`), /\bin Marche\b/].find(re => re.test(text));
  const texts = [];
  for (const region of ITALIAN_REGIONS) for (const key of S.SCENE_KEYS) { const ref = S.pickRef(key, 'x', { region }); if (ref?.type === 'region') texts.push(ref.text); }
  for (const name of ['la mia lista', 'il partito', 'Lega per Salvini Premier', 'Partito Democratico', 'l’Alleanza civica']) for (const mode of ['settimana', 'campagna']) {
    const scene = R.createRallyScene({ id: 'r', seed: `grammatica|${name}|${mode}`, player: { name: 'Elena Prova' }, playerAvatar: null, party: { id: null, name }, place: { municipality: 'Siena', region: 'Toscana' }, mode, context: {} });
    for (let step = 0; step < 6; step++) { const node = R.rallyNode(scene); texts.push(node.text, ...(node.lines ?? []), ...(node.choices ?? []).map(choice => choice[1])); if (node.final || !node.choices?.length) break; try { R.rallyChoose?.(scene, node.choices[0][0]); } catch { break; } }
  }
  assert.ok(texts.length >= 100, `Frasi controllate: ${texts.length}.`);
  for (const text of texts.filter(Boolean)) want(!bad(text), `Grammatica di luoghi e nomi: «${text.slice(0, 120)}».`);
  want(S.pickRef('cantiere', 'x', { region: 'Marche' }).text.includes('nelle Marche'), 'Le Marche sono plurali: «nelle Marche».');
  want(S.pickRef('associazioni', 'x', { region: 'Abruzzo' }).text.includes('dall’Abruzzo'), 'Davanti a vocale: «dall’Abruzzo».');
}
assert.deepEqual(problems.slice(0, 15), [], `Continuità dei dialoghi:\n${problems.slice(0, 15).join('\n')}`);
console.log(`Dialoghi verificati per intero: ${conversations} conversazioni (${ids.length} attività × 3 semi × 4 situazioni × 3 modi di rispondere, più 36 scene di una carriera), ${beats} momenti. Domanda → risposta → replica di chi ha chiesto, sul tema e sul tipo di risposta → seconda voce che riprende il tema → decisione e garanzie sul tema; riga sul ruolo solo quando è vera. In 36 scene di fila: repliche ${new Set(met.reply.filter(Boolean)).size}, raccordi ${new Set(met.bridge.filter(Boolean)).size}, decisioni ${new Set(met.decide.filter(Boolean)).size} formulazioni diverse, nessuna ripetuta in due scene consecutive.`);
