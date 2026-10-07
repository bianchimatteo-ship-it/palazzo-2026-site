// The central invariants (src/core/invariants.js) on the real engine: every starting level is clean at the start and
// after months of play, and every kind of damage is recognised — NaN and undefined, impossible values, duplicate ids,
// broken references (party, group, politician, office, law, election), seats, votes (sì + no + astenuti + assenti),
// parties and groups, Government and majority, elections and campaigns, laws and their passage, the player's career, the territorial races
// and the seats of the assemblies of the game (a person for each seat, nobody twice, never a real one).
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
damaged('Data rimasta indietro rispetto alla settimana', 'data', state => { state.clock.currentDate = '2026-09-24'; });
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

// The races of the territorial votes (race-engine): a candidate without a person, a real politician copied among the persons of the simulation, a closed race without a
// result, two races of the same person on the same day, a result before the vote.
{
  const race = (id, extra = {}) => ({ id, level: 'comunale', territory: { kind: 'comune', name: 'Torino', region: 'Piemonte', code: '001272' }, label: 'Comunali · Torino', electionDate: '2030-05-26', windowOpensAt: '2030-04-21', windowClosesAt: '2030-05-05', nextVote: '2035-05-27', status: 'planned', candidacy: null, campaignId: null, result: null, polls: null, office: null, history: [], source: 'simulation', ...extra });
  const person = id => ({ id, firstName: 'Figura', lastName: 'simulata', displayName: 'Candidato simulato', source: 'simulation', partyId: base.world.playerPartyId, region: 'Piemonte' });
  const candidacy = (personId, source = 'simulation') => ({ kind: 'simulation', personId, personRef: { collection: 'politicians', id: personId, source }, label: 'Candidato simulato', partyId: base.world.playerPartyId, role: 'sindaco', source, rooting: 1, from: {}, confirmedAt: '2030-01-01' });
  const withRaces = (state, items, persons = []) => { state.races = { version: 1, items }; state.dataset.politicians.push(...persons); };
  const good = structuredClone(base);
  withRaces(good, [race('gara-a', { status: 'confirmed', candidacy: candidacy('persona-prova-1') })], [person('persona-prova-1')]);
  assert.ok(checkInvariants(good, context).ok, `Una corsa con il suo candidato è coerente: ${describe(checkInvariants(good, context))}`);
  damaged('Candidato senza persona', 'riferimento', state => withRaces(state, [race('gara-a', { status: 'confirmed', candidacy: candidacy('persona-inesistente') })]));
  damaged('Politico reale tra le persone della simulazione', 'coerenza', state => withRaces(state, [race('gara-a', { status: 'confirmed', candidacy: candidacy('persona-prova-1', 'real') })], [person('persona-prova-1')]));
  damaged('Corsa conclusa senza risultato', 'coerenza', state => withRaces(state, [race('gara-a', { status: 'held', candidacy: candidacy('persona-prova-1') })], [person('persona-prova-1')]));
  damaged('Risultato prima del voto', 'coerenza', state => withRaces(state, [race('gara-a', { status: 'confirmed', candidacy: candidacy('persona-prova-1'), result: { won: true, share: 40, mandate: true } })], [person('persona-prova-1')]));
  damaged('Corsa duplicata', 'duplicato', state => withRaces(state, [race('gara-a'), race('gara-a')]));
  damaged('Stato sconosciuto', 'valore-impossibile', state => withRaces(state, [race('gara-a', { status: 'sospesa' })]));
  damaged('Date della corsa fuori ordine', 'coerenza', state => withRaces(state, [race('gara-a', { windowOpensAt: '2030-06-01' })]));
  damaged('La stessa persona in due corse lo stesso giorno', 'coerenza', state => withRaces(state, [race('gara-a', { status: 'confirmed', candidacy: candidacy('persona-prova-1') }), race('gara-b', { status: 'confirmed', candidacy: candidacy('persona-prova-1') })], [person('persona-prova-1')]));
}
// Seats with people (seat-roster): a seat without a person, a person on two seats, a real person on a seat of the simulation, seats that do not add up to the groups, the player on
// a seat he does not hold, a council that closed with its seats still there.
{
  assert.ok(base.parliament.legislature?.reference === 'simulation' && base.parliament.chambers.camera.roster?.blocks?.length, 'Lo stato di prova ha una legislatura simulata con i seggi di ogni Camera.');
  const first = state => state.parliament.chambers.camera.roster.blocks[0];
  damaged('Seggio senza persona', 'riferimento', state => { const id = first(state).people[0]; state.dataset.politicians = state.dataset.politicians.filter(item => item.id !== id); });
  damaged('Persona su due seggi', 'duplicato', state => { const blocks = state.parliament.chambers.camera.roster.blocks; const spare = blocks.find(block => block !== blocks[0] && block.people.length); spare.people[0] = first(state).people[0]; });
  damaged('Persona reale su un seggio simulato', 'provenienza', state => { const id = first(state).people[0]; state.dataset.politicians.find(item => item.id === id).source = 'real'; });
  damaged('Seggi che non tornano ai gruppi', 'seggi', state => { first(state).people.pop(); });
  damaged('Il giocatore su un seggio che non è suo', 'coerenza', state => { const roster = state.parliament.chambers.camera.roster; first(state).people[0] = state.career.playerId; roster.player = null; });
  damaged('Consiglio concluso che tiene i seggi', 'coerenza', state => { state.local = { institutions: [{ id: 'comune-prova', kind: 'comune', name: 'Comune di prova', status: 'concluso', groups: [], seats: 0, roster: { blocks: [] } }] }; });
}
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

// ---------- 8. texts show dates through labels, never through the keys the state reads as dates ----------
// A formatted date («21 aprile 2052») stored in a key like deadline or until would be read as a broken date (found by a
// 30-year run): the texts of the events use label keys for what they show.
{
  const { DATE_KEY } = await import('../src/core/invariants.js');
  const { CAREER_EVENTS, SITUATION_EVENTS } = await import('../src/data/simulation/career-rules.js');
  const { DAILY_EVENTS } = await import('../src/data/simulation/daily-events.js');
  const { LIFE_SITUATIONS } = await import('../src/data/simulation/party-life-rules.js');
  const catalogue = [...CAREER_EVENTS, ...DAILY_EVENTS, ...Object.values(SITUATION_EVENTS), ...Object.values(LIFE_SITUATIONS)];
  const offenders = new Set();
  const scan = value => {
    if (typeof value === 'string') { for (const match of value.matchAll(/\{(\w+)\}/g)) if (DATE_KEY.test(match[1])) offenders.add(match[1]); }
    else if (Array.isArray(value)) value.forEach(scan);
    else if (value && typeof value === 'object') Object.values(value).forEach(scan);
  };
  catalogue.forEach(scan);
  assert.deepEqual([...offenders], [], `Testi di eventi con segnaposto che l’invariante legge come date: ${[...offenders].join(', ')}`);
}

console.log('Invarianti verificate: 4 livelli di partenza puliti all’avvio e dopo mesi di gioco; riconosciuti NaN/Infinity, undefined, valori impossibili, date non valide, ID duplicati, riferimenti rotti (partito, gruppo, politico, incarico, legge, elezione), seggi Camera/Senato, voti (sì + no + astenuti + assenti) ed esiti, partiti ↔ gruppi, sondaggi, governo ↔ maggioranza e ministri, elezioni bloccate o senza seguito, campagne, leggi e iter bloccati, carriera e incarichi del giocatore; l’assenza del giocatore al voto è contata.');
