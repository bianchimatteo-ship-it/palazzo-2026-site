// The rally, the guest spots and the vote in the game (store): the weekly rally costs its days and money ONCE (also when the player leaves in the middle), it can be done once a week, the scene
// is saved and resumed on the same beat, the quick way is the same engine, the speeches go into the memory of the rallies, a public pledge makes a promise, the campaign rally goes through the
// activity `rally`, a guest spot is the studio or the quick way with one verdict, and the vote at the polling station opens before the election night and decides nothing.
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';
import { sceneNode } from '../src/core/scene-engine.js';

const { store, db } = await startCareer({ seed: 'comizio-store', level: 'deputato', fast: true, territorial: true });
const g = () => store.getState().game;
const ap = () => g().week.ap, funds = () => g().resources.funds;
const stat = metric => store.getState().dataset.statistics.find(item => item.subjectId === store.getState().career.playerId && item.metric === metric)?.value ?? 50;

// ---- weekly rally, animated
const apBefore = ap(), fundsBefore = funds();
const scene = store.startRallyScene();
assert.equal(scene.kind, 'comizio'); assert.equal(store.getState().scene.nodeId, 'arrivo');
assert.equal(ap(), apBefore, 'Aprire la scena non spende ancora nulla: il costo è pagato alla fine (anche se esci).');
assert.throws(() => store.startRallyScene(), /scena/);
assert.throws(() => store.advance(7), /./, 'Il tempo della carriera è fermo mentre la scena è aperta.');
// resume mid-scene
store.sceneChoose('continua'); store.sceneChoose('continua');
const raw = store.exportSave(); store.loadGame(JSON.parse(raw));
assert.equal(store.getState().scene.nodeId, 'saluto', 'Salvando e riprendendo si torna allo stesso momento.');
store.sceneMarkSeen('saluto'); assert.equal(store.getState().scene.stageSeen, 'saluto', 'Il momento già visto non si ripete.');
while (store.getState().scene?.status === 'active') {
  const node = sceneNode(store.getState().scene);
  store.sceneChoose(node.choices.find(item => !item[2])[0]);
}
assert.equal(store.getState().scene.status, 'done');
const repBefore = stat('popularity');
store.sceneChoose('fine');
assert.equal(store.getState().scene, null);
assert.equal(ap(), apBefore - 2, 'Due giorni spesi una volta sola.'); assert.ok(funds() <= fundsBefore - 600 + 1, 'I fondi sono spesi una volta sola.');
assert.equal(g().flags.rallyLog.length, 1, 'Il discorso entra nella memoria dei comizi.');
assert.ok(g().memory.some(item => /^comizio/.test(item.kind)), 'Entra nella memoria politica.');
assert.ok(g().log.some(item => /Comizio/.test(item.title)), 'E nel diario.');
assert.throws(() => store.startRallyScene(), /Già fatto questa settimana/, 'Una volta a settimana.');
void repBefore;

// ---- next week: leaving in the middle still pays, once
store.advance(7);
const apLeave = ap(), fundsLeave = funds(), popLeave = stat('popularity');
store.startRallyScene(); store.sceneChoose('continua');
store.sceneAbandon();
assert.equal(store.getState().scene, null);
assert.equal(ap(), apLeave - 2, 'Uscire a metà non evita il costo.'); assert.ok(funds() <= fundsLeave - 600 + 1);
assert.ok(stat('popularity') < popLeave + 0.5, 'E la piazza se ne accorge.');
assert.ok(g().memory.some(item => item.kind === 'comizio-interrotto'));

// ---- the quick way: the same engine, one click
store.advance(7);
const apQuick = ap();
store.startRallyScene({ quick: true });
assert.equal(store.getState().scene, null); assert.equal(ap(), apQuick - 2);
assert.equal(g().flags.rallyLog.length, 3, 'Anche il comizio rapido è nella memoria.');
// the speeches are remembered: the next scene knows the last topics
store.advance(7);
const next = store.startRallyScene();
assert.ok(next.context.rallyMemory.length >= 3, 'La scena conosce i discorsi recenti.');
store.sceneAbandon();

// ---- a pledge makes a promise
store.advance(7);
const promisesBefore = store.programView().promises.length;
store.startRallyScene();
for (const c of ['continua', 'continua', 'caloroso']) store.sceneChoose(c);
const options = sceneNode(store.getState().scene).choices;
store.sceneChoose((options.find(item => item[0].startsWith('proposta') || item[0].startsWith('promessa')) ?? options[0])[0]);
let n = sceneNode(store.getState().scene);
if (n.id === 'contestazione') { store.sceneChoose('ascolta'); n = sceneNode(store.getState().scene); }
if (store.getState().scene.status === 'active') {
  const second = n.choices.find(item => item[0].startsWith('proposta') || item[0].startsWith('promessa') || item[0].startsWith('territorio')) ?? n.choices[0];
  store.sceneChoose(second[0]);
  const closing = sceneNode(store.getState().scene).choices.find(item => item[0] === 'impegno' && !item[2]);
  store.sceneChoose(closing ? 'impegno' : 'appello');
  store.sceneChoose('fine');
  if (closing) assert.ok(store.programView().promises.length >= promisesBefore, 'L’impegno pubblico è nel programma.');
} else store.sceneChoose('fine');

// ---- a guest spot: studio or quick way, one verdict
store.advance(7);
const apTalk = ap(), notoriety = stat('notoriety');
store.startTalkShowScene({ source: 'attivita', quick: true });
assert.equal(store.getState().scene, null); assert.equal(ap(), apTalk - 2, 'L’ospitata costa i suoi giorni una volta.');
assert.ok(stat('notoriety') > notoriety - 0.01);
store.advance(7);
const studio = store.startTalkShowScene({ source: 'attivita' });
assert.equal(studio.kind, 'talkshow'); assert.equal(studio.nodeId, 'preparazione');
const apStudio = ap();
store.sceneAbandon();
assert.equal(ap(), apStudio - 2, 'Anche lasciando lo studio a metà il costo è pagato una volta.');

// ---- the campaign rally goes through the activity `rally`
store.advance(7);
store.fastForwardToElection('comunale');
store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, db.parties);
{ const saved = JSON.parse(store.exportSave()); saved.campaign.nomination = { ...saved.campaign.nomination, status: 'approved' }; saved.campaign.candidacy = { ...(saved.campaign.candidacy ?? {}), status: 'approved' }; store.loadGame(saved); }
const c0 = store.getState().campaign;
const money0 = c0.resources.money, day0 = c0.day;
store.startRallyScene();
assert.equal(store.getState().scene.mode, 'campagna'); assert.equal(store.getState().campaign.resources.money, money0, 'Aprire la scena non spende nulla.');
while (store.getState().scene?.status === 'active') store.sceneChoose(sceneNode(store.getState().scene).choices.find(item => !item[2])[0]);
store.sceneChoose('fine');
const c1 = store.getState().campaign;
assert.ok(c1.resources.money < money0, 'Il comizio di campagna costa i suoi fondi, una volta.'); assert.equal(c1.day, day0 + 3, 'E i suoi giorni.');
assert.equal(c1.history.filter(item => item.activityId === 'rally').length, 1, 'Un solo comizio registrato.');
assert.equal(c1.activityUses.rally, 1);
// leaving a campaign rally in the middle costs the same
store.startRallyScene(); store.sceneAbandon();
assert.equal(store.getState().campaign.activityUses.rally, 2);
assert.ok(store.getState().campaign.day === day0 + 6);
console.log('check-rally-store: ok');
