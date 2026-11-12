// The decisions of the weekly-activity scenes (data/activity-scene-moves.js, core/activity-scenes.js), on the real engine:
//   1. the catalogue: every move has a function with its own consequences, every text a pair with an English side, and the six families (plus the citizens' square) each have their own moves;
//   2. the variety: each moment offers three to five moves of DIFFERENT functions, the moments of one encounter do not repeat each other, the situation (promise, earlier commitment, money, power) changes
//      what is offered, and repeated encounters tell different stories;
//   3. the development: what was done before changes what a move is worth (informed or not, tone risen or not), and the reaction — words, gesture, kind — follows the move and how it went;
//   4. the consequences: different decisions leave different consequences (relations, standing, costs, commitments), a pure function of the decisions, the same after a save;
//   5. the three paths — plain activity, scene played by hand, scene simulated — end in the same engine: nothing lost, nothing applied twice, the commitments registered.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { WEEKLY_ACTIVITIES } = await load('src/data/simulation/career-rules.js');
const moves = await load('src/data/activity-scene-moves.js');
const { ALL_PAIRS: MOVE_PAIRS, FUNCTIONS, MOVES, EXTRA_Q1, GUARANTEE_MOVES, COMMITMENTS, REACTION_LINES, REACTION_TYPES, APPROACH_FUNCTIONS } = moves;
const { ACTIVITY_SCENES, SCENE_KEYS, createActivityScene, activityNode, reactionType, sceneAftermath, outcomeKindOf } = await load('src/core/activity-scenes.js');
const { autoPlay, chooseInScene, sceneEffects, sceneNode } = await load('src/core/scene-engine.js');
const { stageOf } = await load('src/core/stage-script.js');
const { sceneFactor } = await load('src/core/career-engine.js');

// ---------- 1. the catalogue ----------
const isPair = pair => Array.isArray(pair) && pair.length === 2 && typeof pair[0] === 'string' && pair[0] && typeof pair[1] === 'string' && pair[1];
for (const pair of MOVE_PAIRS) assert.ok(isPair(pair), `ogni testo ha italiano e inglese: ${JSON.stringify(pair).slice(0, 60)}`);
assert.equal(new Set(MOVE_PAIRS.map(pair => pair[0])).size, new Set(MOVE_PAIRS.map(pair => pair[0] + '|' + pair[1])).size, 'nessun italiano con due inglesi diversi');
assert.ok(Object.keys(FUNCTIONS).length >= 18, 'almeno diciotto funzioni diverse');
for (const [id, fn] of Object.entries(FUNCTIONS)) {
  assert.ok(isPair(fn.label) && isPair(fn.detail) && fn.gesture, `${id}: nome, descrizione e gesto`);
  assert.ok(fn.gain || fn.cost || fn.tally || fn.commit, `${id}: ha conseguenze sue`);
  for (const band of ['good', 'mid', 'bad']) assert.ok(isPair(REACTION_LINES[id]?.[band]), `${id}: la reazione ${band} esiste`);
}
for (const [id, fn] of Object.entries(FUNCTIONS)) if (fn.commit) assert.ok(COMMITMENTS[fn.commit], `${id}: l’impegno ${fn.commit} esiste`);
assert.deepEqual(new Set(Object.values(FUNCTIONS).map(fn => JSON.stringify([fn.gain, fn.cost, fn.tally, fn.commit]))).size, Object.keys(FUNCTIONS).length, 'nessuna funzione uguale a un’altra');
const tags = new Set(['promise', 'prior', 'govern', 'opp', 'funds', 'capital', 'party']);
const ids = new Set();
for (const [kind, stages] of Object.entries(MOVES)) {
  for (const [stage, list] of Object.entries(stages)) {
    assert.ok(['q2', 'q3'].includes(stage) && list.length >= 5, `${kind}/${stage}: almeno cinque mosse tra cui scegliere (${list.length})`);
    assert.ok(new Set(list.map(move => move.fn)).size >= 4, `${kind}/${stage}: almeno quattro funzioni diverse`);
    for (const move of list) {
      assert.ok(FUNCTIONS[move.fn], `${move.id}: funzione reale`); assert.ok(['competence', 'charisma', 'reputation'].includes(move.stat), `${move.id}: statistica`); assert.ok(isPair(move.label));
      assert.ok(!ids.has(move.id), `${move.id}: identificativo unico`); ids.add(move.id);
      for (const tag of move.when.split(' ').filter(Boolean)) assert.ok(tags.has(tag), `${move.id}: etichetta ${tag}`);
    }
  }
  const q2 = new Set(stages.q2.map(move => move.label[0])), q3 = new Set(stages.q3.map(move => move.label[0]));
  assert.ok(![...q2].some(label => q3.has(label)), `${kind}: il secondo e il terzo momento non hanno mosse in comune`);
}
assert.equal(Object.keys(MOVES).length, 7, 'sette cataloghi: cittadini, associazioni, cantiere, sede, commissione, redazione, consiglio');
assert.ok(GUARANTEE_MOVES.length >= 4 && EXTRA_Q1.length >= 3);
for (const [key, map] of Object.entries(APPROACH_FUNCTIONS)) for (const approach of ACTIVITY_SCENES[key].approaches) assert.ok(FUNCTIONS[map[approach.id]], `${key}/${approach.id}: l’approccio ha una funzione`);

// ---------- 2. the variety ----------
const make = (sceneKey, seed, extra = {}) => createActivityScene({ id: `t-${seed}`, seed, sceneKey, activityId: extra.activityId ?? ACTIVITY_SCENES[sceneKey].activityIds[0], player: { name: 'Anna Verdi', tag: 'Deputata · Prova' }, playerAvatar: null, stats: { competence: 60, charisma: 60, reputation: 60 }, ...extra });
const FULL = { promise: true, prior: true, govern: true, funds: true, capital: true, party: true };
const first = choices => choices.find(choice => !choice[2])[0];
const optionsAt = (scene, nodeId) => { const s = { ...scene, nodeId }; return activityNode(s).choices; };
const fnOf = (scene, nodeId, id) => { const stage = nodeId; const node = optionsAt(scene, stage); return node.find(choice => choice[0] === id); };
const KEYS = [...SCENE_KEYS, 'cittadini'];
for (const key of KEYS) {
  const sceneKey = key === 'cittadini' ? 'associazioni' : key;
  const sets = [];
  for (let i = 0; i < 12; i++) {
    const scene = make(sceneKey, `var-${key}-${i}`, { activityId: key === 'cittadini' ? 'cittadini' : undefined, situation: i % 2 ? FULL : { funds: true } });
    const perStage = {};
    for (const stage of ['q1', 'q2', 'q3']) {
      const choices = optionsAt(scene, stage);
      assert.ok(choices.length >= 3 && choices.length <= 5, `${key}/${stage}: da tre a cinque alternative (${choices.length})`);
      assert.equal(new Set(choices.map(choice => choice[0])).size, choices.length, `${key}/${stage}: alternative diverse`);
      assert.equal(new Set(choices.map(choice => choice[1])).size, choices.length, `${key}/${stage}: etichette diverse`);
      assert.equal(new Set(choices.map(choice => choice[3])).size >= 3, true, `${key}/${stage}: funzioni diverse (descrizioni diverse)`);
      perStage[stage] = choices.map(choice => choice[0]);
    }
    assert.ok(!perStage.q2.some(id => perStage.q1.includes(id)) && !perStage.q3.some(id => perStage.q2.includes(id)), `${key}: i momenti non ripetono le stesse opzioni`);
    assert.notDeepEqual(optionsAt(scene, 'q1').map(choice => choice[1]).sort(), optionsAt(scene, 'q2').map(choice => choice[1]).sort(), `${key}: il primo e il secondo momento offrono cose diverse`);
    sets.push(perStage.q3.join(','));
  }
  assert.ok(new Set(sets).size >= 3, `${key}: la scelta del terzo momento cambia da un incontro all’altro (${new Set(sets).size} insiemi in 12)`);
}
// the situation changes what is offered
{
  const plain = make('associazioni', 'ctx-1', { situation: { funds: true, capital: true } }), rich = make('associazioni', 'ctx-1', { situation: FULL });
  assert.ok(optionsAt(rich, 'q1').length > optionsAt(plain, 'q1').length || optionsAt(rich, 'q1').some(choice => choice[0] === 'x-impegno'), 'un impegno precedente o una promessa aggiungono una scelta al primo momento');
  assert.ok(optionsAt(rich, 'q1').some(choice => choice[0] === 'x-impegno') && !optionsAt(plain, 'q1').some(choice => choice[0] === 'x-impegno'), 'rendere conto dell’ultimo incontro c’è solo se c’è un impegno aperto');
  assert.ok(optionsAt(rich, 'q1').some(choice => choice[0] === 'x-programma') && !optionsAt(plain, 'q1').some(choice => choice[0] === 'x-programma'), 'richiamare il programma c’è solo con una promessa aperta');
  const poor = make('associazioni', 'ctx-2', { situation: { funds: false, capital: true, govern: true } });
  const fund = [...Array(30)].map((_, i) => make('associazioni', `ctx-f${i}`, { situation: { funds: false, govern: true, capital: true } })).flatMap(scene => optionsAt(scene, 'q3')).find(choice => choice[0] === 'a-cofin');
  assert.ok(!fund || fund[2], 'senza fondi liberi il finanziamento si vede ma non si può scegliere');
  const rich30 = [...Array(30)].map((_, i) => make('associazioni', `ctx-f${i}`, { situation: { funds: true, govern: true, capital: true } })).flatMap(scene => optionsAt(scene, 'q3')).find(choice => choice[0] === 'a-cofin');
  assert.ok(rich30 && !rich30[2], 'con i fondi il finanziamento si può scegliere');
  const opp = [...Array(30)].map((_, i) => make('cittadini' in {} ? 'associazioni' : 'associazioni', `ctx-o${i}`, { activityId: 'cittadini', situation: { opp: true, funds: true, capital: true } })).flatMap(scene => optionsAt(scene, 'q3')).map(choice => choice[0]);
  assert.ok(!opp.includes('c-annuncio') && !opp.includes('c-fondo'), 'chi è all’opposizione non può annunciare né finanziare');
  assert.ok(poor);
}
// repeated encounters tell different stories: families, names and opening moves differ
{
  const stories = new Set(), families = [];
  for (let i = 0; i < 10; i++) { const scene = make('associazioni', `rep-${i}`, { activityId: 'cittadini', recent: families.slice(-3), situation: FULL }); families.push(scene.familyId); stories.add(`${scene.familyId}|${scene.cast[1].name}|${optionsAt(scene, 'q2').map(choice => choice[0]).join()}`); }
  assert.ok(new Set(families).size >= 5, `incontri ripetuti: temi diversi (${new Set(families).size})`);
  assert.ok(stories.size >= 8, `incontri ripetuti: storie diverse (${stories.size} su 10)`);
  for (let i = 3; i < families.length; i++) assert.ok(!families.slice(i - 3, i).includes(families[i]), 'nessun tema ripetuto subito');
}

// ---------- 3. the development ----------
// what was done before changes what a move is worth
{
  const clone = (scene, patch) => ({ ...JSON.parse(JSON.stringify(scene)), ...patch });
  const score = (scene, id) => chooseInScene(scene, id).history.at(-1).score;
  const findScene = (sceneKey, nodeId, ids, extra = {}) => { for (let i = 0; i < 200; i++) { const scene = { ...make(sceneKey, `dev-${i}`, extra), nodeId }; const offered = optionsAt(scene, nodeId).map(choice => choice[0]); if (ids.every(id => offered.includes(id))) return scene; } throw new Error(`nessuna scena offre ${ids}`); };
  // a promise or an announcement is worth more after the facts have been gathered than before (same scene, only what the player knows differs)
  for (const [sceneKey, id] of [['associazioni', 'a-scritto'], ['associazioni', 'a-pubblico'], ['cantiere', 'w-crono'], ['redazione', 'r-annuncio']]) {
    const scene = findScene(sceneKey, 'q3', [id], { situation: FULL });
    const knows = clone(scene, { tally: { ...scene.tally, k: 2 } }), ignorant = clone(scene, { tally: { ...scene.tally, k: 0 } });
    assert.ok(score(knows, id) >= score(ignorant, id) + 8, `${id}: con i dati vale di più (${score(knows, id)} contro ${score(ignorant, id)})`);
  }
  // mediating is worth more when the tone has risen, challenging is worth less
  const calm = findScene('sede', 'q2', ['p-correnti', 'p-polemica'], { situation: FULL });
  const heated = clone(calm, { tally: { ...calm.tally, tension: 3 } });
  assert.ok(score(heated, 'p-correnti') > score(calm, 'p-correnti') + 8, 'mediare vale di più quando i toni sono alti');
  assert.ok(score(heated, 'p-polemica') < score(calm, 'p-polemica') - 4, 'contestare vale meno quando i toni sono già alti');
  // what was already done is pushed aside: a function used before comes after the others
  const once = findScene('associazioni', 'q2', ['a-progetto'], { situation: FULL });
  const done = clone(once, { history: [{ node: 'q1', choice: 'x', fn: 'data', score: 60, band: 'mid', why: [], k: 0, said: 'x', reaction: 'x' }] });
  assert.ok(!optionsAt(done, 'q2').some(choice => choice[0] === 'a-progetto'), 'chi ha già chiesto i dati trova altro da fare');
  // after a bad move, setting things straight is worth more
  const stumbled = clone(once, { history: [{ node: 'q1', choice: 'x', fn: 'listen', score: 30, band: 'bad', why: [], k: 0, said: 'x', reaction: 'x' }] });
  const clarify = findScene('associazioni', 'q2', ['a-ruolo'], { situation: FULL });
  const clarifyAfter = clone(clarify, { history: stumbled.history });
  assert.ok(optionsAt(clarifyAfter, 'q2').some(choice => choice[0] === 'a-ruolo'), 'il chiarimento resta tra le mosse dopo un passo falso');
  assert.ok(score(clarifyAfter, 'a-ruolo') > score(clarify, 'a-ruolo') + 4, 'dopo un passo falso chiarire aiuta');
  // the opposition cannot command the offices
  const gov = findScene('associazioni', 'q2', ['a-bandi'], { situation: { ...FULL, govern: true } });
  const opp = clone(gov, { flags: { ...gov.flags, govern: false, opp: true } });
  assert.ok(score(gov, 'a-bandi') > score(opp, 'a-bandi') + 5, 'chi governa coinvolge gli uffici con più effetto di chi è all’opposizione');
  // the tone of the next moment follows how the last one went
  const good = clone(calm, { nodeId: 'q3', history: [{ node: 'q2', choice: 'x', fn: 'data', score: 80, band: 'good', why: [], k: 1, said: 'x', reaction: 'x' }] }), bad = clone(good, { history: [{ ...good.history[0], band: 'bad', score: 20 }] }), hot = clone(good, { tally: { ...good.tally, tension: 3 } });
  assert.notEqual(activityNode(good).text, activityNode(bad).text); assert.notEqual(activityNode(good).text, activityNode(hot).text); assert.notEqual(activityNode(bad).text, activityNode(hot).text);
}
// the reaction follows the move: words, gesture, kind
{
  const lines = new Set(), gestures = new Set(), types = new Set(), reactions = new Set();
  for (const key of SCENE_KEYS) for (let i = 0; i < 6; i++) {
    let scene = make(key, `rea-${key}-${i}`, { situation: FULL });
    scene = chooseInScene(scene, 'continua');
    for (let step = 0; step < 3; step++) {
      const node = sceneNode(scene), choice = node.choices.filter(item => !item[2])[(i + step) % node.choices.filter(item => !item[2]).length];
      scene = chooseInScene(scene, choice[0]);
      const reaction = sceneNode(scene);
      assert.ok(reaction.text && reaction.reaction && reaction.exchange?.length === 1 && reaction.move?.gesture && reaction.kind, `${key}: la reazione ha parole, tipo, seconda voce e gesto della mossa`);
      lines.add(reaction.text); gestures.add(`${reaction.move.gesture}|${reaction.gesture}`); types.add(reaction.reaction); reactions.add(reaction.exchange[0].text);
      const stage = stageOf(scene, reaction);
      assert.equal(stage.poses.giocatore.gesture, reaction.move.gesture, 'il politico fa il gesto della mossa scelta');
      assert.equal(stage.poses[reaction.speaker].gesture, reaction.gesture, 'chi reagisce fa il gesto della reazione');
      scene = chooseInScene(scene, 'continua');
    }
  }
  assert.ok(lines.size >= 30, `reazioni diverse nelle parole (${lines.size})`);
  assert.ok(gestures.size >= 12, `gesti diversi tra mosse e reazioni (${gestures.size})`);
  assert.ok(types.size >= 5, `tipi di reazione diversi (${[...types].join()})`);
  assert.ok(reactions.size >= 8, `seconda voce diversa (${reactions.size})`);
  for (const type of Object.keys(REACTION_TYPES)) assert.ok(REACTION_TYPES[type].gesture && REACTION_TYPES[type].joins.length >= 2);
  assert.equal(reactionType('contest', 'good'), 'dissenso'); assert.equal(reactionType('propose', 'mid'), 'garanzie'); assert.equal(reactionType('mediate', 'mid'), 'compromesso'); assert.equal(reactionType('announce', 'bad'), 'protesta'); assert.equal(reactionType('listen', 'good'), 'approvazione');
}
// a request for guarantees opens a fourth moment; a calm encounter without commitments does not
{
  let withGuarantee = 0, without = 0;
  for (let i = 0; i < 40; i++) {
    for (const key of SCENE_KEYS) {
      let scene = make(key, `g-${key}-${i}`, { situation: FULL });
      scene = chooseInScene(scene, 'continua');
      for (let step = 0; step < 3; step++) { const node = sceneNode(scene); const options = node.choices.filter(item => !item[2]); scene = chooseInScene(scene, options[(i + step) % options.length][0]); scene = chooseInScene(scene, 'continua'); }
      if (scene.nodeId === 'q4') { withGuarantee++; assert.ok(scene.tally.guarantee || scene.tally.tension >= 3, 'il quarto momento ha una ragione'); } else without++;
    }
  }
  assert.ok(withGuarantee > 10 && without > 10, `il quarto momento compare solo quando serve (${withGuarantee} su ${withGuarantee + without})`);
}

// ---------- 4. the consequences ----------
{
  const run = (key, seed, picker, extra = {}) => { let scene = make(key, seed, { situation: FULL, ...extra }); scene = chooseInScene(scene, 'continua'); for (let guard = 0; guard < 12 && scene.status === 'active'; guard++) { const node = sceneNode(scene); scene = chooseInScene(scene, node.choices.length === 1 ? node.choices[0][0] : picker(node, scene)); } return scene; };
  const byFn = fn => (node, scene) => { const list = scene.nodeId === 'q1' ? [] : node.choices; void list; return node.choices.filter(item => !item[2]).map(item => item[0])[0]; };
  void byFn;
  const outcomes = new Set(), extras = new Set(), commitKinds = new Set(), kinds = new Set();
  for (const key of SCENE_KEYS) for (let i = 0; i < 25; i++) {
    const s = run(key, `cons-${key}-${i}`, (node, scene) => { const options = node.choices.filter(item => !item[2]); return options[(i * 3 + scene.history.length) % options.length][0]; });
    const effects = sceneEffects(s);
    assert.deepEqual(sceneAftermath(s).effects, sceneAftermath(JSON.parse(JSON.stringify(s))).effects, 'le conseguenze sono una funzione pura delle decisioni');
    extras.add(JSON.stringify(effects.extras)); outcomes.add(s.outcome.kind); kinds.add(s.outcome.kind);
    for (const item of effects.commitments) commitKinds.add(item.label);
    assert.ok(Array.isArray(effects.commitments) && effects.consequences.length >= 1 || s.history.length, 'le conseguenze si dicono a parole');
    // commitments match the moves that make them, and only those
    const made = s.history.filter(item => FUNCTIONS[item.fn].commit).length;
    assert.equal(effects.commitments.length, made, 'un impegno per ogni mossa che lo comporta, nessuno altrimenti');
    for (const commitment of effects.commitments) { assert.equal(commitment.outcomes.length, 2); assert.ok(Math.abs(commitment.outcomes[0].chance + commitment.outcomes[1].chance - 1) < 0.011); assert.ok(commitment.weeks >= 2 && commitment.mergeKey && commitment.label); }
    if (made === 0) assert.equal(effects.commitments.length, 0);
    // no cost without a move that has it
    if (effects.extras?.funds) assert.ok(s.history.some(item => FUNCTIONS[item.fn].fund), 'i fondi spesi vengono da un finanziamento deciso');
    if (effects.extras?.capital) assert.ok(s.history.some(item => FUNCTIONS[item.fn].capital), 'il capitale politico speso viene da un tavolo aperto');
    assert.ok(effects.edge >= -6 && effects.edge <= 6);
  }
  assert.ok(extras.size >= 40, `decisioni diverse, conseguenze diverse (${extras.size} insiemi di effetti su 150)`);
  assert.ok(outcomes.size >= 4, `esiti diversi (${[...outcomes].join()})`);
  assert.ok(commitKinds.size >= 5, `impegni diversi (${commitKinds.size})`);
  // two different paths through the same encounter end differently
  const one = run('associazioni', 'same-1', node => node.choices.filter(item => !item[2])[0][0]), two = run('associazioni', 'same-1', node => node.choices.filter(item => !item[2]).at(-1)[0]);
  assert.notDeepEqual(sceneEffects(one).extras, sceneEffects(two).extras, 'due strade nello stesso incontro: conseguenze diverse');
  // outcome kinds follow what was done
  const agree = outcomeKindOf({ history: [{ fn: 'mediate', band: 'good' }], tally: { tension: 0 } }, 'good'), conflict = outcomeKindOf({ history: [{ fn: 'contest', band: 'bad' }], tally: { tension: 4 } }, 'mid');
  assert.equal(agree, 'accordo'); assert.equal(conflict, 'contrasto');
  assert.equal(outcomeKindOf({ history: [{ fn: 'propose', band: 'good' }], tally: { tension: 0 } }, 'good'), 'impegno');
  assert.equal(outcomeKindOf({ history: [{ fn: 'verify', band: 'mid' }], tally: { tension: 0 } }, 'mid'), 'rinvio');
  assert.equal(outcomeKindOf({ history: [{ fn: 'listen', band: 'bad' }], tally: { tension: 0 } }, 'bad'), 'irrisolto');
  // the verdict scales what the activity gives, all of it: party, organisation, preparation, the institution
  assert.ok(sceneFactor(6) > 1 && sceneFactor(-6) < 1 && sceneFactor(6) <= 1.8 && sceneFactor(-6) >= 0.2);
}

// ---------- 5. the three paths ----------
{
  const snapshot = store => { const state = store.getState(); const g = state.game; return { funds: g.resources.funds, capital: g.resources.politicalCapital, ap: g.week.ap, week: g.week.index, pending: (g.pending ?? []).length, log: (g.log ?? []).length, stats: JSON.stringify(state.stats ?? null), support: g.party?.support ?? null, society: JSON.stringify(state.society?.segments?.map(item => item.mood)), trust: JSON.stringify(Object.values(state.society?.regions ?? {}).map(item => item.trust)) }; };
  // 5a. the plain activity applies the society effects (the reference)
  const plain = await startCareer({ seed: 'moves-store', level: 'deputato' });
  const before = snapshot(plain.store);
  plain.store.performWeeklyActivity('cittadini', 'anziani');
  const afterPlain = snapshot(plain.store);
  assert.notEqual(afterPlain.society, before.society, 'l’attività normale muove il gruppo di cittadini');
  const cost = WEEKLY_ACTIVITIES.find(item => item.id === 'cittadini').cost;
  assert.equal(before.funds - afterPlain.funds, cost.funds); assert.equal(before.ap - afterPlain.ap, cost.ap);

  // 5b. the same activity as a scene played by hand
  const manual = await startCareer({ seed: 'moves-store', level: 'deputato' });
  const m0 = snapshot(manual.store);
  await manual.store.startActivityScene('cittadini', { target: 'anziani' });
  assert.deepEqual(snapshot(manual.store), m0, 'aprire la scena non cambia nulla');
  const saved = JSON.parse(JSON.stringify(manual.store.getState().scene));
  assert.ok(saved.flags && saved.tally && Array.isArray(saved.history), 'la scena salva i suoi segni distintivi');
  const picked = [];
  let decisions = 0;
  while (manual.store.getState().scene.status === 'active') {
    const scene = manual.store.getState().scene, node = sceneNode(scene);
    if (node.choices.length > 1) {
      decisions++;
      const options = node.choices.filter(item => !item[2]);
      const id = options[(decisions - 1) % options.length][0];
      // a reload in the middle of the scene (save and resume) offers the same moves and gives the same result
      assert.deepEqual(sceneNode(JSON.parse(JSON.stringify(scene))), node, 'ricaricando la scena si ritrovano le stesse mosse');
      picked.push(id); manual.store.sceneChoose(id);
    } else manual.store.sceneChoose(node.choices[0][0]);
    if (manual.store.getState().scene?.nodeId === 'esito') break;
  }
  const finalScene = manual.store.getState().scene;
  assert.ok(decisions >= 3, `almeno tre momenti decisionali (${decisions})`);
  const effects = sceneEffects(finalScene);
  assert.equal(snapshot(manual.store).funds, m0.funds, 'durante la scena nulla viene pagato');
  manual.store.sceneChoose('fine');
  const m1 = snapshot(manual.store);
  assert.equal(manual.store.getState().scene, null);
  const spent = m0.funds - m1.funds;
  assert.equal(spent, cost.funds - (effects.extras?.funds ?? 0), 'il costo si paga una volta: attività più eventuale finanziamento deciso');
  assert.equal(m0.ap - m1.ap, cost.ap, 'i giorni si pagano una volta');
  assert.equal(m1.week, m0.week, 'la settimana non avanza');
  assert.notEqual(m1.society, m0.society, 'anche la scena giocata muove il gruppo di cittadini e il territorio');
  assert.equal(m1.pending - m0.pending, effects.commitments.length, 'gli impegni presi restano registrati nella carriera');
  assert.equal(manual.store.getState().game.flags.sceneLog.at(-1).commits.length, effects.commitments.length, 'e nel registro delle scene');
  assert.deepEqual(manual.store.getState().game.flags.sceneLog.at(-1).picks, effects.picks);
  const diary = manual.store.getState().game.log[0];
  assert.ok(diary.lines.length >= 2 && diary.title, 'una riga nel diario con gli effetti applicati');
  assert.equal(m1.log - m0.log, 1, 'una sola riga nel diario');

  // 5c. the same scene simulated with the same decisions: the same career
  const quick = await startCareer({ seed: 'moves-store', level: 'deputato' });
  const q0 = snapshot(quick.store);
  await quick.store.startActivityScene('cittadini', { target: 'anziani', quick: true });
  const q1 = snapshot(quick.store);
  assert.equal(quick.store.getState().scene, null, 'Simula non apre nessuna scena');
  assert.equal(q0.ap - q1.ap, cost.ap); assert.equal(q1.week, q0.week);
  assert.notEqual(q1.society, q0.society, 'anche la simulazione muove il gruppo di cittadini e il territorio');
  const replay = JSON.parse(JSON.stringify(quick.store.getState().game.flags.sceneLog.at(-1)));
  assert.ok(replay.picks.length >= 3, 'la simulazione prende almeno tre decisioni');
  // identical decisions give identical careers, whether played by hand or by the simulation
  const twin = await startCareer({ seed: 'moves-store', level: 'deputato' });
  await twin.store.startActivityScene('cittadini', { target: 'anziani' });
  const cast = [...replay.picks];
  const choiceIds = autoPlay(twin.store.getState().scene).history.map(item => item.choice);
  while (twin.store.getState().scene.status === 'active') {
    const node = sceneNode(twin.store.getState().scene);
    twin.store.sceneChoose(node.choices.length > 1 ? choiceIds.shift() : node.choices[0][0]);
    if (twin.store.getState().scene?.nodeId === 'esito') break;
  }
  twin.store.sceneChoose('fine');
  const t1 = snapshot(twin.store);
  assert.deepEqual(t1, q1, 'a parità di stato e decisioni la partita giocata a mano e quella simulata coincidono');
  assert.deepEqual(twin.store.getState().game.flags.sceneLog.at(-1).picks, cast);

  // 5d. an activity of another family: the building site and the party room also pay once and register their consequences
  for (const [activityId, careerLevel] of [['riunione', 'deputato'], ['audizione-commissione', 'deputato'], ['intervista', 'deputato'], ['associazioni', 'deputato']]) {
    const career = await startCareer({ seed: `moves-${activityId}`, level: careerLevel });
    const spec = WEEKLY_ACTIVITIES.find(item => item.id === activityId);
    const a0 = snapshot(career.store);
    await career.store.startActivityScene(activityId, { quick: true });
    const a1 = snapshot(career.store);
    assert.equal(a0.ap - a1.ap, spec.cost.ap ?? 0, `${activityId}: i giorni una sola volta`);
    assert.ok(a0.funds - a1.funds >= (spec.cost.funds ?? 0), `${activityId}: i fondi almeno il costo`);
    assert.equal(a1.week, a0.week);
    assert.equal(career.store.getState().game.log.length - a0.log, 1, `${activityId}: una riga nel diario`);
  }
}
// the verdict of a scene scales EVERYTHING the activity gives (not only the stats and the relations), costs stay what they are, the treasury is never scaled
{
  const { scaleEffects } = await load('src/core/career-engine.js');
  const effects = { stats: { popularity: 1, reputation: -1 }, relations: { civic: 2 }, party: { support: 3 }, org: { cohesion: 2, section: true }, prep: 4, funds: -100, local: { stability: 3, pressure: -1.5, workUnblock: true } };
  const up = scaleEffects(effects, 1.5), down = scaleEffects(effects, 0.5);
  assert.deepEqual([up.stats.popularity, up.stats.reputation, up.relations.civic, up.party.support, up.org.cohesion, up.prep], [1.5, -1, 3, 4.5, 3, 6], 'ciò che l’attività dà segue il verdetto, i costi no');
  assert.equal(up.org.section, true); assert.equal(up.funds, -100); assert.deepEqual(up.local, { stability: 4.5, pressure: -2.25, workUnblock: true }, 'anche l’effetto sull’ente segue il verdetto');
  assert.deepEqual([down.party.support, down.org.cohesion, down.local.stability], [1.5, 1, 1.5]);
  assert.equal(scaleEffects(null, 2), null);
}
// a scene saved by the previous version (no situation, no tally, no function in the history) continues instead of breaking
{
  const old = JSON.parse(JSON.stringify(make('sede', 'old-1')));
  delete old.flags; delete old.tally;
  old.nodeId = 'r1'; old.history = [{ node: 'q1', choice: 'mediare', score: 70, band: 'good', why: ['carisma 60'], said: 'Cerca una mediazione tra le correnti', reaction: 'La sala si distende.' }];
  const node = sceneNode(old);
  assert.ok(node.text && node.reaction && node.exchange.length === 1, 'la reazione di una scena salvata con il formato precedente si legge');
  const next = chooseInScene(old, 'continua');
  assert.equal(next.nodeId, 'q2'); assert.ok(next.tally && next.flags);
  const finished = autoPlay(next);
  assert.equal(finished.status, 'done'); assert.ok(sceneEffects(finished).edge !== undefined);
}
console.log('Le decisioni delle scene sono verificate: sette cataloghi con funzioni diverse, da tre a cinque alternative per momento, tre momenti decisionali (quattro con le garanzie), situazione e sequenza che cambiano il valore delle mosse, reazioni e gesti per mossa, conseguenze e impegni distinti, tre percorsi nello stesso motore.');
