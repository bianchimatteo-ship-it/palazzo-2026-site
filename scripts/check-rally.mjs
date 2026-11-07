// The rally and the vote as scenes of the shared engine: the beats follow one another, the speeches come from the situation (promises, territory, economy, Government) and vary from one rally to
// the next, the protest comes only when the situation gives a reason and can end the rally, the verdict is deterministic, the stage script (poses) is defined at every beat, and a scene saved
// and resumed is the same scene.
import assert from 'node:assert/strict';
import { autoPlay, chooseInScene, createRallyScene, createVoteScene, sceneEffects, sceneNode, sceneProgress } from '../src/core/scene-engine.js';
import { stageOf, stageBefore, VOTE_ORDER } from '../src/core/stage-script.js';
import { defaultAvatarFor } from '../src/core/avatar.js';

const avatar = defaultAvatarFor('prova');
const ctx = (extra = {}) => ({
  stats: { competence: 60, charisma: 58, reputation: 55, notoriety: 45 }, credibility: 62,
  promises: [{ id: 'p1', area: 'sanita', label: 'Sanità', status: 'in-corso', intervention: 'più medici nei pronto soccorso' }, { id: 'p2', area: 'scuola', label: 'Scuola', status: 'non-avviata', intervention: 'mense scolastiche gratuite' }],
  programAreas: ['sanita', 'scuola', 'lavoro'], territory: { name: 'Lazio', trust: 44, problems: [{ id: 'sanita', area: 'sanita', label: 'Liste d’attesa in sanità', severity: 18 }] },
  economy: { inflation: 4.2, growth: 0.3 }, events: ['Nuovo decreto sui bollettini'], relations: { civic: 58 }, protestLevel: 0.2, rallyMemory: [], ...extra
});
const make = (seed, extra = {}, mode = 'settimana') => createRallyScene({ id: `comizio-${seed}`, seed, player: { name: 'Mario Rossi' }, playerAvatar: avatar, party: { id: 'p', name: 'Futuro Nazionale' }, place: { municipality: 'Roma', region: 'Lazio' }, mode, context: ctx(extra) });

// the beats in order, with texts and choices at each, and a stage script at each
let scene = make('a');
const seen = [];
while (scene.status === 'active') {
  const node = sceneNode(scene);
  assert.ok(node.text && node.choices.length, `${scene.nodeId}: testo e scelte`);
  const stage = stageOf(scene, node);
  assert.ok(stage.poses.giocatore, `${scene.nodeId}: posa del giocatore`);
  assert.ok(['piazza'].includes(stage.setting));
  seen.push(scene.nodeId);
  const choice = node.choices.find(item => !item[2]);
  scene = chooseInScene(scene, choice[0]);
  assert.ok(scene.prevNodeId, 'si ricorda il momento precedente');
}
assert.equal(scene.nodeId, 'esito'); assert.ok(scene.outcome.performance >= 0 && scene.outcome.performance <= 100);
assert.ok(seen.includes('saluto') && seen.includes('tema1') && seen.includes('tema2') && seen.includes('chiusura'));
assert.throws(() => chooseInScene(scene, 'fine'), /conclusa/);

// the speech comes from the situation: the options name the promises, the territory, the economy
const t1 = sceneNode((() => { let s = make('b'); for (const c of ['continua', 'continua', 'caloroso']) s = chooseInScene(s, c); return s; })());
const labels = t1.choices.map(item => item[1]).join(' | ');
assert.match(labels, /sanità|scuola/i, 'una promessa fatta è tra le scelte'); assert.match(labels, /Liste d’attesa|liste d’attesa/, 'un problema del territorio è tra le scelte');
assert.ok(t1.choices.length >= 3);
// without promises or problems the options are others (no invented context)
const poor = sceneNode((() => { let s = make('b', { promises: [], programAreas: [], territory: { name: 'Lazio', trust: 50, problems: [] }, events: [], economy: { inflation: 2, growth: 1 } }); for (const c of ['continua', 'continua', 'caloroso']) s = chooseInScene(s, c); return s; })());
assert.ok(!/sanità/i.test(poor.choices.map(item => item[1]).join('|')), 'senza promesse non si cita la sanità');
// the player governing adds the account of the Government
const gov = sceneNode((() => { let s = make('b', { governing: true, government: { approval: 40 } }); for (const c of ['continua', 'continua', 'caloroso']) s = chooseInScene(s, c); return s; })());
assert.ok(gov.choices.some(item => item[0] === 'governo'));

// variety: different seeds and different memories give different speeches
const speeches = new Set();
for (let i = 0; i < 24; i++) {
  let s = make(`var-${i}`, { rallyMemory: i % 2 ? [{ topics: ['sanita'], lines: [] }] : [] });
  for (const c of ['continua', 'continua', 'caloroso']) s = chooseInScene(s, c);
  const n = sceneNode(s); s = chooseInScene(s, n.choices[0][0]);
  speeches.add(s.history.at(-1).said);
}
assert.ok(speeches.size >= 8, `i discorsi variano (${speeches.size} diversi su 24)`);
// the lines used recently are not repeated when there is another
{
  let a = make('mem'); for (const c of ['continua', 'continua', 'caloroso']) a = chooseInScene(a, c);
  const first = chooseInScene(a, sceneNode(a).choices[0][0]).history.at(-1);
  const used = [first.said];
  let b = make('mem', { rallyMemory: [{ topics: [], lines: [chooseInScene(a, sceneNode(a).choices[0][0]).used[0].line] }] }); for (const c of ['continua', 'continua', 'caloroso']) b = chooseInScene(b, c);
  const second = chooseInScene(b, sceneNode(b).choices[0][0]).history.at(-1);
  assert.notEqual(second.said, used[0], 'una battuta usata di recente non torna uguale');
}

// the protest: only with a reason in the situation, never when the situation is calm, sometimes when it is hot; it can stop the rally
let calmProtests = 0, hotProtests = 0, degenerated = 0, handled = 0;
for (let i = 0; i < 80; i++) {
  if (make(`calmo-${i}`, { protestLevel: 0 }).protest.planned) calmProtests++;
  const hot = make(`caldo-${i}`, { protestLevel: 0.95, promises: [{ id: 'x', area: 'sanita', label: 'Sanità', status: 'non-mantenuta', intervention: 'x' }], territory: { name: 'Lazio', trust: 25, problems: [{ id: 'sanita', area: 'sanita', label: 'Liste d’attesa', severity: 30 }] } });
  if (hot.protest.planned) {
    hotProtests++;
    assert.ok(hot.protest.reason?.label, 'ogni protesta ha un motivo');
    let s = hot; for (const c of ['continua', 'continua', 'caloroso']) s = chooseInScene(s, c);
    s = chooseInScene(s, sceneNode(s).choices[0][0]);
    if (s.nodeId === 'contestazione') {
      assert.ok(s.protest.arrived); assert.ok(stageOf(s, sceneNode(s)).protest, 'in scena arrivano i contestatori');
      const done = chooseInScene(s, i % 2 ? 'prosegui' : 'interrompi');
      if (done.protest.state === 'degenerata' || done.protest.state === 'interrotta') { degenerated++; assert.equal(done.status, 'done'); assert.ok(done.interrupted); assert.ok(done.outcome.performance <= 40, 'un comizio interrotto non è un successo'); }
      const listen = chooseInScene(s, 'ascolta'); if (listen.protest.state === 'gestita') handled++;
    }
  }
}
assert.equal(calmProtests, 0, 'nessuna contestazione senza motivo');
assert.ok(hotProtests > 10 && hotProtests < 70, `la contestazione è occasionale (${hotProtests}/80 in una situazione tesa)`);
assert.ok(degenerated > 0, 'una contestazione può interrompere il comizio');
assert.ok(handled >= 0);

// determinism and save/resume: the same choices give the same scene; a saved copy continues identically
const play = () => { let s = make('det'); for (const c of ['continua', 'continua', 'locale']) s = chooseInScene(s, c); while (s.status === 'active') { const n = sceneNode(s); s = chooseInScene(s, n.choices.find(x => !x[2])[0]); } return s; };
assert.deepEqual(play(), play());
{
  let s = make('res'); for (const c of ['continua', 'continua', 'sobrio']) s = chooseInScene(s, c);
  const saved = JSON.parse(JSON.stringify(s));
  assert.deepEqual(sceneNode(saved), sceneNode(s));
  assert.deepEqual(chooseInScene(saved, sceneNode(saved).choices[0][0]), chooseInScene(s, sceneNode(s).choices[0][0]));
  assert.deepEqual(stageOf(saved, sceneNode(saved)), stageOf(s, sceneNode(s)));
  assert.ok(stageBefore(s, sceneNode), 'si conosce la posa precedente');
}
// the quick way is the same engine: autoPlay ends with a verdict and effects
const quick = autoPlay(make('quick'));
assert.equal(quick.status, 'done'); const fx = sceneEffects(quick);
assert.ok(Number.isFinite(fx.deltas.popularity) && fx.line && fx.sceneId === quick.id);
// good and bad speakers: stats matter
const strong = autoPlay(make('x1', { stats: { competence: 90, charisma: 90, reputation: 85, notoriety: 60 }, credibility: 85 })).outcome.performance;
const weak = autoPlay(make('x1', { stats: { competence: 20, charisma: 20, reputation: 25, notoriety: 20 }, credibility: 25 })).outcome.performance;
assert.ok(strong > weak + 10, `competenza e carisma contano (${strong} contro ${weak})`);
// a pledge makes a promise only when the player chose it
const pledged = (() => { let s = make('pl'); for (const c of ['continua', 'continua', 'caloroso']) s = chooseInScene(s, c); s = chooseInScene(s, sceneNode(s).choices.find(x => x[0].startsWith('promessa'))[0]); s = chooseInScene(s, sceneNode(s).choices[0][0]); return chooseInScene(s, 'impegno'); })();
assert.ok(pledged.outcome.pledge?.area, 'l’impegno pubblico indica il tema');
assert.equal(autoPlay(make('nopl')).outcome.pledge === null || typeof autoPlay(make('nopl')).outcome.pledge?.area === 'string', true);
assert.deepEqual(sceneProgress(make('p')), { index: 0, total: 8 });

// the vote
let vote = createVoteScene({ id: 'voto-1', seed: 'v', player: { name: 'Mario Rossi' }, playerAvatar: avatar, electionLabel: 'Elezioni comunali', place: { municipality: 'Roma' } });
const beats = [];
while (vote.status === 'active') {
  const node = sceneNode(vote); beats.push(vote.nodeId);
  const stage = stageOf(vote, node); assert.equal(stage.setting, 'seggio'); assert.ok(stage.poses.giocatore);
  vote = chooseInScene(vote, node.choices[0][0]);
}
assert.deepEqual(beats, [...VOTE_ORDER], 'ingresso, banco, cabina, voto, piega, uscita dalla cabina, urna, uscita');
assert.equal(vote.outcome.voted, true);
assert.equal(stageOf({ ...vote, nodeId: 'voto' }, null).poses.giocatore.visible, false, 'dentro la cabina non si vede il votante');
assert.equal(stageOf({ ...vote, nodeId: 'voto' }, null).props.booth, 'closed');
console.log('check-rally: ok');
