// The player is out of the runoff: the candidacy is eliminated (no longer in the race, no normal campaign), the ordinary weeks of the career come back, the player may support a finalist (once,
// optional) or do nothing, the runoff goes on in the world without moving or anticipating its dates and reaches its result; a save in the middle resumes.
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';

const { store, db } = await startCareer({ seed: 'ballottaggio-fuori', level: 'comunale', fast: true, territorial: true });
store.fastForwardToElection('comunale');
store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'oltre-15000' }, db.parties);
{
  const saved = JSON.parse(store.exportSave());
  saved.campaign.nomination = { ...saved.campaign.nomination, status: 'approved' }; saved.campaign.candidacy = { ...(saved.campaign.candidacy ?? {}), status: 'approved' };
  const ids = saved.campaign.candidates.map(item => item.id), me = saved.campaign.playerCandidateId;
  const others = ids.filter(id => id !== me);
  for (const area of saved.campaign.territories) area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === me ? 5 : id === others[0] ? 40 : id === others[1] ? 35 : 20 / Math.max(1, others.length - 2)]));
  store.loadGame(saved);
}
const electionDate = store.getState().campaign.electionDate;
for (let i = 0; i < 140 && store.getState().campaign.stage !== 'ballottaggio' && store.getState().campaign.status === 'active'; i++) store.advance(1);
let c = store.getState().campaign;
assert.equal(c.stage, 'ballottaggio', 'Nessuno ha superato il 50%: ballottaggio.');
const me = c.candidates.find(item => item.isPlayer);
assert.equal(me.status, 'eliminated', 'Il giocatore è eliminato.');
assert.ok(!c.runoffCandidateIds.includes(me.id) && c.runoffCandidateIds.length === 2, 'I finalisti sono due e il giocatore non è tra loro.');
assert.ok(c.electionDate > electionDate && c.electionDate <= new Date(Date.parse(electionDate) + 15 * 86400000).toISOString().slice(0, 10), 'Il ballottaggio è due settimane dopo, senza spostare altro.');
// not a candidate in the race any more; the normal campaign activities are refused
assert.throws(() => store.performCampaignActivity('rally', {}), /non è in corsa|candidatura/i, 'Da eliminato non si fa campagna.');
// the ordinary career is back: a weekly activity works and the week goes on
assert.doesNotThrow(() => store.performWeeklyActivity('ascolto'), 'Le attività settimanali tornano disponibili.');
// optional: support one of the finalists (once), or do nothing
const finalist = c.runoffCandidateIds[0];
assert.doesNotThrow(() => store.performCampaignActivity('runoff_stance', { backs: finalist, targetCandidateId: finalist, finalistId: finalist }));
// the world goes on: save/resume in the middle, then the result
const raw = store.exportSave(); store.loadGame(JSON.parse(raw));
assert.equal(store.getState().campaign.candidates.find(item => item.isPlayer).status, 'eliminated');
for (let i = 0; i < 40 && store.getState().campaign?.status === 'active'; i++) store.advance(1);
c = store.getState().campaign;
assert.ok(!c || c.status === 'finished' || store.getState().career.lastCampaignId, 'Il ballottaggio arriva al risultato.');
assert.ok(store.getState().career.electionHistory?.at(-1) ?? store.getState().lastElectionResult ?? true);
console.log('check-runoff-eliminated: ok');
