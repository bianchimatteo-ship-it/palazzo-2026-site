// The central invariants (src/core/invariants.js) on the real engine: every starting level is clean at the start and
// after months of play, and every kind of damage is recognised — NaN and undefined, impossible values, duplicate ids,
// broken references (party, group, politician, office, law, election), seats, votes (sì + no + astenuti + assenti),
// parties and groups, Government and majority, elections and campaigns, laws and their passage, the player's career.
// The votes where the player stays away count the absence (each seat accounted for).
import assert from 'node:assert/strict';

const { startCareer, playWeek } = await import('./lib/long-run.mjs');
const { checkInvariants } = await import('../src/core/invariants.js');
const { autoVote } = await import('../src/core/lawmaking-engine.js');
const { voteGovernmentConfidence, setConfidenceVote } = await import('../src/core/parliament-engine.js');

const codes = result => [...new Set(result.issues.map(issue => issue.code))];
const describe = result => result.issues.slice(0, 5).map(issue => `[${issue.code}] ${issue.path}: ${issue.message}`).join('; ');

// ---------- 1. every starting level: clean at the start and after half a year of play ----------
let run;
for (const level of ['comunale', 'regionale', 'senatore', 'deputato']) {
  run = await startCareer({ seed: `inv-${level}`, level });
  let result = checkInvariants(run.store.getState(), run.context);
  assert.ok(result.ok, `Carriera ${level} appena creata: ${describe(result)}`);
  for (let week = 0; week < 30; week++) playWeek(run);
  result = checkInvariants(run.store.getState(), run.context);
  assert.ok(result.ok, `Carriera ${level} dopo 30 settimane: ${describe(result)}`);
}
// The deputy's career goes on to a legislature with votes, laws and a Government.
for (let week = 0; week < 60; week++) playWeek(run);
const base = run.store.getState();
assert.ok(checkInvariants(base, run.context).ok, `Carriera da deputato dopo 90 settimane: ${describe(checkInvariants(base, run.context))}`);
const context = run.context;

// ---------- 2. each kind of damage is recognised ----------
const damaged = (label, expected, mutate) => {
  const state = structuredClone(base);
  mutate(state);
  const result = checkInvariants(state, context);
  assert.ok(!result.ok && codes(result).includes(expected), `${label}: atteso «${expected}», trovato ${JSON.stringify(codes(result))}`);
  return result;
};
const player = state => state.dataset.politicians.find(item => item.id === state.career.playerId);
const lawWithVote = state => state.parliament.laws.find(law => law.votes?.some(vote => vote.byGroup?.length)) ?? state.parliament.lawArchive.find(law => law.votes?.length);
assert.ok(lawWithVote(base), 'Lo stato di prova contiene leggi votate.');
assert.ok(base.parliament.government && ['active', 'crisis'].includes(base.parliament.government.status), 'Lo stato di prova ha un governo in carica.');

damaged('NaN', 'numero-non-valido', state => { state.society.economy.debt = NaN; });
damaged('Infinity', 'numero-non-valido', state => { state.game.resources.funds = Infinity; });
damaged('undefined in una lista', 'undefined', state => { state.world.parties.push(undefined); });
damaged('ID undefined', 'undefined', state => { state.dataset.offices[0].politicianId = undefined; });
damaged('Quota impossibile', 'valore-impossibile', state => { state.world.polls.at(-1).results[0].share = 140; });
damaged('Seggi negativi', 'valore-impossibile', state => { state.parliament.chambers.camera.groups[0].simulatedSeats = -3; });
damaged('Data non valida', 'data', state => { state.game.elections[0].electionDate = '2031-13-45'; });
damaged('ID duplicato', 'id-duplicato', state => { state.dataset.offices.push({ ...state.dataset.offices[0] }); });
damaged('Partito inesistente (carriera)', 'riferimento', state => { state.career.partyId = 'partito-inesistente'; player(state).partyId = 'partito-inesistente'; state.game.party.partyId = 'partito-inesistente'; });
damaged('Partito del giocatore incoerente', 'coerenza', state => { player(state).partyId = null; });
damaged('Gruppo inesistente (seggio)', 'riferimento', state => { state.parliament.player = { ...(state.parliament.player ?? { chamber: 'camera' }), groupId: 'gruppo-inesistente' }; });
damaged('Politico inesistente (incarico)', 'riferimento', state => { state.dataset.offices[0].politicianId = 'politico-inesistente'; });
damaged('Incarico inesistente (ruolo del giocatore)', 'riferimento', state => { player(state).roleId = 'incarico-inesistente'; });
damaged('Legge inesistente (agenda)', 'riferimento', state => { state.game.inbox.push({ id: 'decisione-prova', title: 'Voto in Aula', templateId: 'voto-aula', params: { lawId: 'legge-inesistente' }, choices: [] }); });
damaged('Elezione inesistente (agenda)', 'riferimento', state => { state.game.inbox.push({ id: 'decisione-prova', title: 'Candidatura', params: { electionId: 'elezione-inesistente' }, choices: [] }); });
damaged('Partito sconosciuto in un gruppo', 'riferimento', state => { state.parliament.chambers.camera.groups[0].partyId = 'partito-inesistente'; });
damaged('Forza sconosciuta in un sondaggio', 'riferimento', state => { state.world.polls.at(-1).results[0].partyId = 'forza-inesistente'; });
damaged('Sondaggio che non somma a 100', 'coerenza', state => { const poll = state.world.polls.at(-1); poll.results[0].share += 9; poll.results[1].share -= 0.5; });
damaged('Seggi della Camera che non tornano', 'seggi', state => { state.parliament.chambers.camera.groups.pop(); });
damaged('Voto che non somma', 'voti', state => { const vote = lawWithVote(state).votes.find(item => item.byGroup?.length) ?? lawWithVote(state).votes[0]; vote.against = (vote.against ?? 0) + 3; });
damaged('Esito del voto contrario ai numeri', 'voti', state => { const vote = lawWithVote(state).votes[0]; vote.passed = !vote.passed; });
damaged('Ministro fuori dalla maggioranza', 'coerenza', state => { const outside = state.parliament.chambers.camera.groups.find(group => !state.parliament.government.coalitionGroupIds.includes(group.groupId) && !(state.parliament.government.supportingGroupIds ?? []).includes(group.groupId)); state.parliament.government.ministers.push({ id: 'nomina-prova', portfolio: 'Ministero di prova', groupId: outside.groupId }); });
damaged('Governo in carica senza maggioranza', 'maggioranza', state => { const government = state.parliament.government; government.status = 'active'; const small = [...state.parliament.chambers.camera.groups].sort((a, b) => a.simulatedSeats - b.simulatedSeats)[0].groupId; government.coalitionGroupIds = [small]; government.supportingGroupIds = []; government.premierGroupId = small; government.ministers = []; });
damaged('Gruppo della maggioranza inesistente', 'riferimento', state => { state.parliament.government.coalitionGroupIds.push('gruppo-inesistente'); });
damaged('Elezione mai svolta', 'blocco', state => { const election = state.game.elections.find(item => item.status === 'upcoming'); Object.assign(election, { windowOpensAt: '2020-01-01', windowClosesAt: '2020-01-15', electionDate: '2020-02-01' }); });
damaged('Nessuna politica futura', 'elezioni', state => { for (const election of state.game.elections.filter(item => item.type === 'politiche')) Object.assign(election, { status: 'held', windowOpensAt: '2020-01-01', windowClosesAt: '2020-01-15', electionDate: '2020-02-01' }); });
damaged('Stato di un’elezione sconosciuto', 'valore-impossibile', state => { state.game.elections[0].status = 'boh'; });
damaged('Campagna conclusa senza risultato', 'coerenza', state => { state.campaign = { id: 'campagna-prova', status: 'finished', result: null, candidates: [] }; });
damaged('Fase di una legge sconosciuta', 'valore-impossibile', state => { state.parliament.laws[0].stage = 'boh'; });
damaged('Legge ferma da anni', 'blocco', state => { const law = state.parliament.laws.find(item => item.auto) ?? state.parliament.laws[0]; Object.assign(law, { stage: 'commission', stageSince: '2020-01-01', auto: true }); });
damaged('Legge chiusa prima di essere presentata', 'data', state => { const law = state.parliament.lawArchive[0]; law.introducedAt = '2030-01-10'; law.closedAt = '2030-01-01'; });
damaged('Due seggi insieme', 'coerenza', state => { const me = player(state); state.dataset.offices.push({ id: 'incarico-prova-1', title: 'Deputato', level: 'deputato', politicianId: me.id, startDate: state.clock.currentDate, endDate: null }, { id: 'incarico-prova-2', title: 'Senatore', level: 'senatore', politicianId: me.id, startDate: state.clock.currentDate, endDate: null }); });
damaged('Incarico chiuso prima di iniziare', 'coerenza', state => { Object.assign(state.dataset.offices[0], { startDate: '2030-01-01', endDate: '2029-01-01' }); });
damaged('Formazione completata senza governo', 'coerenza', state => { state.national.formation = { ...(state.national.formation ?? {}), phase: 'completata' }; state.parliament.government = null; });

// ---------- 3. the player who stays away from a vote is counted as absent ----------
const parliament = structuredClone(base.parliament);
const chamber = 'camera';
const seatGroup = parliament.chambers[chamber].groups.find(group => group.simulatedSeats > 5);
parliament.player = { chamber, groupId: seatGroup.groupId, politicianId: base.career.playerId };
const law = { ...structuredClone(parliament.laws[0] ?? lawWithVote(base)), votes: [], confidence: false };
const vote = autoVote(parliament, law, chamber, { date: base.clock.currentDate, playerChoice: 'assente' });
const own = vote.byGroup.find(row => row.groupId === seatGroup.groupId);
assert.equal(own.absentVotes, 1, 'Il giocatore assente è contato come assente nel suo gruppo.');
assert.equal(own.yesVotes + own.noVotes + own.abstainVotes + own.absentVotes, seatGroup.simulatedSeats, 'Il gruppo del giocatore assente somma ai suoi seggi.');
assert.equal(vote.yes + vote.against + vote.abstain + vote.absent, vote.total, 'sì + no + astenuti + assenti = componenti.');
const government = parliament.government;
if (government && government.coalitionGroupIds.length) {
  const confidence = voteGovernmentConfidence(setConfidenceVote({ ...parliament, government: { ...government, status: 'awaiting-confidence', confidenceVotes: government.confidenceVotes ?? [] } }, 'assente'), base.clock.currentDate);
  const record = confidence.government.confidenceVotes.at(-1).votes.find(item => item.chamber === chamber);
  for (const row of record.byGroup) assert.equal(row.yesVotes + row.noVotes + row.abstainVotes + (row.absentVotes ?? 0), row.simulatedSeats, `Fiducia: il gruppo ${row.groupId} somma ai suoi seggi.`);
  assert.equal(record.absent, 1, 'Fiducia: l’assenza del giocatore è registrata.');
}

console.log('Invarianti verificate: 4 livelli di partenza puliti all’avvio e dopo mesi di gioco; riconosciuti NaN/Infinity, undefined, valori impossibili, date non valide, ID duplicati, riferimenti rotti (partito, gruppo, politico, incarico, legge, elezione), seggi Camera/Senato, voti (sì + no + astenuti + assenti) ed esiti, partiti ↔ gruppi, sondaggi, governo ↔ maggioranza e ministri, elezioni bloccate o senza seguito, campagne, leggi e iter bloccati, carriera e incarichi del giocatore; l’assenza del giocatore al voto è contata.');
