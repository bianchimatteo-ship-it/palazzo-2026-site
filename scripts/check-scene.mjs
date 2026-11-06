// The scene engine and the television debate: the cast and its avatars (the player's is always the one saved in the career, the others are fixed per character and differ from one another), the
// beats in order, the choices and their consequences (competence, charisma, preparation, credibility, the rival's readiness), a scene that resumes exactly after a save, the refusal and the walk-out,
// and the game: a real campaign, the scene freezes the career, its verdict goes into the campaign through the debate activity, the memory keeps it.
import assert from 'node:assert/strict';
import { chooseInScene, characterAvatar, createDebateScene, sceneEffects, sceneNode, sceneProgress, withStats } from '../src/core/scene-engine.js';
import { avatarOf, normalizeAvatar } from '../src/core/avatar.js';
import { startCareer, playWeek } from './lib/long-run.mjs';

const myAvatar = normalizeAvatar({ face: 'femminile', skin: 'oliva', hair: 'rosso', hairstyle: 'ondulato', beard: 'nessuna', glasses: 'tondi', jacket: 'bordeaux', eyes: 'verdi', expression: 'sorridente', moustache: 'nessuno' });
const make = (over = {}, stats = { competence: 70, charisma: 60 }) => withStats(createDebateScene({ id: 'd1', seed: 's1', player: { name: 'Anna Rossi' }, playerAvatar: myAvatar, rival: { id: 'riv-1', name: 'Luca Bianchi', partyId: 'p1' }, host: { id: 'conduttore-1', name: 'Marco Valenti' }, topic: { id: 'sanita', label: 'Sanità' }, secondTopic: { id: 'lavoro', label: 'Lavoro e sviluppo' }, salientTopic: 'sanita', promises: [{ id: 'pr1', label: 'Sanità', topic: 'sanita', status: 'non-avviata', intervention: 'Investimento in sanità', cost: 3 }], credibility: 70, prep: 10, rivalProgram: ['sanita', 'fisco'], rivalReadiness: 40, rivalAggression: 60, ...over }), stats);
const play = (scene, picks) => { let s = scene; for (const pick of picks) s = chooseInScene(s, typeof pick === 'function' ? pick(s) : pick); return s; };
const FLOW = ['accetta', 'dati', 'continua', 'dati', 'continua', 'conti', 'continua', 'dati', 'continua', 'fatti', 'continua', 'appello'];

// ---------- the cast ----------
const scene = make();
assert.equal(scene.cast.length, 3, 'Giocatore, avversario e conduttore.');
assert.deepEqual(scene.cast.find(item => item.role === 'giocatore').avatar, myAvatar, 'Il giocatore ha esattamente l’avatar scelto a inizio carriera.');
const again = characterAvatar({ id: 'riv-1', role: 'rivale' });
assert.deepEqual(again, scene.cast.find(item => item.role === 'rivale').avatar, 'Lo stesso avversario ha sempre lo stesso aspetto.');
assert.notDeepEqual(characterAvatar({ id: 'riv-2', role: 'rivale' }), again, 'Avversari diversi hanno aspetti diversi.');
assert.equal(characterAvatar({ id: 'conduttore-1', role: 'conduttore' }).jacket, 'antracite', 'Il conduttore è in giacca antracite.');

// ---------- the beats ----------
let s = scene;
const seen = [];
for (const pick of FLOW) { seen.push(s.nodeId); const node = sceneNode(s); assert.ok(node.text && node.speaker && node.camera && node.expression && node.choices.length, `Il momento ${s.nodeId} ha testo, voce, inquadratura, espressione e scelte.`); s = chooseInScene(s, pick); }
assert.deepEqual(seen, ['invito', 'preparazione', 'ingresso', 'q1', 'r1', 'domanda', 'risposta-rivale', 'q2', 'r2', 'attacco', 'r3', 'chiusura'].slice(0, 0).concat(['invito', 'preparazione', 'ingresso', 'q1', 'r1', 'domanda', 'risposta-rivale', 'q2', 'r2', 'attacco', 'r3', 'chiusura']), 'La sequenza dei momenti è quella di un vero confronto.');
assert.equal(s.status, 'done'); assert.equal(s.nodeId, 'esito'); assert.ok(s.outcome.performance >= 0 && s.outcome.performance <= 100);
assert.deepEqual(s.cast.find(item => item.role === 'giocatore').avatar, myAvatar, 'L’avatar del giocatore resta identico fino alla fine.');
assert.ok(sceneNode(s).final, 'Il momento finale è segnato.');
assert.ok(sceneProgress(s).index > 5);
const fx = sceneEffects(s);
assert.equal(fx.edge, s.outcome.edge); assert.equal(fx.rivalId, 'riv-1'); assert.equal(fx.topicId, 'sanita');
assert.throws(() => chooseInScene(s, 'fine-boh'), /già conclusa/);

// ---------- the choices matter ----------
const lastScore = (scene, picks) => play(scene, picks).history.at(-1);
const upTo = (scene, n) => play(scene, FLOW.slice(0, n));
const q1 = (scene, style, prepFocus = 'dati') => { const s0 = play(scene, ['accetta', prepFocus, 'continua']); return chooseInScene(s0, style).history.at(-1).score; };
assert.ok(q1(make({}, { competence: 90, charisma: 40 }), 'dati') > q1(make({}, { competence: 30, charisma: 40 }), 'dati'), 'Più competenza, meglio vanno i dati.');
assert.ok(q1(make({}, { competence: 40, charisma: 90 }), 'empatia') > q1(make({}, { competence: 40, charisma: 30 }), 'empatia'), 'Più carisma, meglio va l’empatia.');
assert.ok(q1(make({ credibility: 90 }), 'programma', 'programma') > q1(make({ credibility: 30 }), 'programma', 'programma'), 'Citare il programma vale quanto sei credibile.');
assert.ok(q1(make(), 'programma', 'programma') > q1(make({ promises: [] }), 'programma', 'dati'), 'Senza promesse sul tema, il programma non regge.');
assert.ok(q1(make({ promises: [{ id: 'x', label: 'Sanità', topic: 'sanita', status: 'non-mantenuta' }] }), 'programma') < q1(make(), 'programma'), 'Una promessa tradita sullo stesso tema pesa.');
assert.ok(q1(make({ rivalReadiness: 20 }), 'attacco') > q1(make({ rivalReadiness: 85 }), 'attacco'), 'Attaccare funziona contro un avversario impreparato.');
assert.ok(q1(make({ prep: 22 }), 'dati') > q1(make({ prep: 0 }), 'dati'), 'La preparazione conta.');
assert.throws(() => chooseInScene(play(make({ promises: [] }), ['accetta']), 'programma'), /non è disponibile/, 'Non si può preparare il programma se non si hanno promesse sul tema.');
assert.throws(() => chooseInScene(make(), 'dati'), /non valida/);
// the attack of the rival is built where the player is weak
const broken = play(make({ promises: [{ id: 'x', label: 'Sanità', topic: 'sanita', status: 'non-mantenuta' }] }), FLOW.slice(0, 9));
assert.match(sceneNode(broken).text, /non ha mantenuto la parola|prometteva sanità/i, 'L’avversario attacca sulla promessa tradita.');
const lowCred = play(make({ credibility: 30 }), FLOW.slice(0, 9));
assert.match(sceneNode(lowCred).text, /dove sono i soldi/, 'O sulla scarsa credibilità del programma.');
assert.ok(q1(make(), 'dati') !== undefined);
// a good evening and a bad one
const strong = play(make({ credibility: 90, prep: 22, rivalReadiness: 25 }, { competence: 95, charisma: 90 }), ['accetta', 'dati', 'continua', 'dati', 'continua', 'conti', 'continua', 'programma', 'continua', 'fatti', 'continua', 'appello']);
const weak = play(make({ credibility: 25, prep: 0, rivalReadiness: 85, promises: [] }, { competence: 20, charisma: 20 }), ['accetta', 'empatia', 'continua', 'attacco', 'continua', 'passato', 'continua', 'attacco', 'continua', 'ignora', 'continua', 'sfida']);
assert.ok(strong.outcome.performance > weak.outcome.performance + 20, `Una serata preparata e credibile (${strong.outcome.performance}) batte una impreparata (${weak.outcome.performance}).`);
assert.ok(strong.outcome.edge > 1.5 && weak.outcome.edge < -1.5, `E il verdetto è netto: vantaggio o svantaggio (${strong.outcome.performance}/${strong.outcome.edge} contro ${weak.outcome.performance}/${weak.outcome.edge}).`);
// the audience follows
assert.ok(strong.audience.mood > 50 && weak.audience.mood < 50, 'Il pubblico segue la serata.');
// ---------- resume and determinism ----------
const mid = upTo(make(), 7);
const resumed = JSON.parse(JSON.stringify(mid));
const finish = sc => play(sc, FLOW.slice(7));
assert.equal(JSON.stringify(finish(mid)), JSON.stringify(finish(resumed)), 'Salvare e riprendere a metà dà la stessa scena e lo stesso esito.');
assert.equal(JSON.stringify(play(make(), FLOW)), JSON.stringify(play(make(), FLOW)), 'Le stesse scelte, la stessa serata.');
// refusing and the walk-out
const declined = chooseInScene(make(), 'rifiuta');
assert.equal(declined.status, 'declined'); assert.ok(sceneEffects(declined).declined && sceneEffects(declined).edge < 0, 'Rifiutare l’invito è un punto a favore dell’avversario.');

// ---------- in the game ----------
const { store, db, decide } = await startCareer({ seed: 'studio', level: 'deputato', fast: true, territorial: true });
store.fastForwardToElection('comunale');
store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, db.parties);
// the candidacy is approved (the negotiation with the party is not what is under test here): the save is edited and loaded
{ const saved = JSON.parse(store.exportSave()); saved.campaign.nomination = { ...saved.campaign.nomination, status: 'approved' }; saved.campaign.candidacy = { ...(saved.campaign.candidacy ?? {}), status: 'approved' }; store.loadGame(saved); }
const st0 = store.getState();
assert.equal(st0.campaign.status, 'active');
assert.notEqual(st0.campaign.nomination.status, 'pending', 'La candidatura è stata decisa.');
const day0 = st0.campaign.day, money0 = st0.campaign.resources.money, uses0 = st0.campaign.activityUses?.debate ?? 0, hist0 = st0.campaign.history.length;
const started = store.startDebateScene({});
assert.deepEqual(started.cast.find(item => item.role === 'giocatore').avatar, avatarOf(store.getState().dataset.politicians.find(item => item.id === store.getState().career.playerId)), 'Nel gioco il giocatore entra in studio con l’avatar della sua carriera.');
assert.throws(() => store.advance(7), /Sei in studio/, 'Con la scena in corso il tempo della carriera è fermo.');
assert.throws(() => store.performCampaignActivity('rally'), /Sei in studio/);
assert.throws(() => store.startDebateScene({}), /Sei in studio/, 'Una scena alla volta.');
assert.equal(store.getState().campaign.day, day0);
// save in the middle: the scene comes back as it was
store.sceneChoose('accetta'); store.sceneChoose('dati'); store.sceneChoose('continua'); store.sceneChoose('dati');
const midScene = JSON.stringify(store.sceneView());
store.loadGame(JSON.parse(store.exportSave()));
assert.equal(JSON.stringify(store.sceneView()), midScene, 'Il salvataggio a metà riporta la stessa scena.');
for (const pick of ['continua', 'conti', 'continua', 'dati', 'continua', 'fatti', 'continua', 'appello', 'fine']) store.sceneChoose(pick);
assert.equal(store.sceneView(), null, 'Finita la scena si torna alla carriera.');
const after = store.getState().campaign;
assert.equal(after.day, day0 + 1, 'Il dibattito costa un giorno di campagna.');
assert.ok(after.resources.money < money0, 'E le risorse della campagna.');
assert.equal(after.activityUses.debate, uses0 + 1, 'Conta come l’attività «Dibattito».');
assert.ok(after.history.length > hist0, 'Resta nel registro della campagna.');
assert.ok(store.getState().game.memory.some(item => item.kind === 'dibattito'), 'E nella memoria politica.');
assert.doesNotThrow(() => store.advance(1), 'Il tempo riparte.');
console.log('Scene e dibattito televisivo verificati: cast con avatar (il tuo è quello scelto, gli altri fissi per personaggio), dodici momenti in ordine, scelte con conseguenze (competenza, carisma, preparazione, credibilità, avversario), attacco costruito sui punti deboli, ripresa identica dopo il salvataggio, rifiuto, e nel gioco: carriera ferma, verdetto nella campagna, memoria.');
