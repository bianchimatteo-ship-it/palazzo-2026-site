// A comunale race of the party, outside the comune of the player, is a campaign the player really plays. The leader of a party fields himself in an ordinary municipal race of the party
// (a comune that is not his own), and from then on it is the one campaign of the game: the same chain of ids from the race to the result (race ↔ campaign ↔ election ↔ office ↔ history),
// the party of the career is the party of the race, of the candidate and of the campaign (also when the polls know that party as another force: Sinistra Italiana is measured as Alleanza
// Verdi e Sinistra), the whole competition is the comune of the race, the party weighs in the vote through its candidate, the result of the campaign played is the result of the race and
// no second simulation of the party replaces it. On the real store (no direct call of createCampaign): candidacy, window, start, weeks of activities and events, polls and projection,
// save and reload with the campaign on, the vote, victory and defeat, office and history, the way the other races of the party and the lapse of the candidacies still work.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { aggregateShares } = await module('src/core/election-engine.js');
const { campaignObservatory } = await module('src/core/campaign-engine.js');
const { storage } = await module('src/core/storage.js');
const { checkInvariants } = await module('src/core/invariants.js');

const SI = 'party-registro-p1-2014-13-ir';        // Sinistra Italiana: the polls measure it as Alleanza Verdi e Sinistra
const AVS = 'coalition-alleanza-verdi-sinistra';
const LEGA = 'party-registro-p1-2017-41-ir';       // measured as itself
const WEAK = 'party-registro-p1-2015-25-ir';       // a force of less than 1% in the polls
const lines = [];
const free = () => { for (const slot of storage.listSlots()) { try { if (slot.autoPreserve) storage.deleteSlot(slot.id); } catch { /* a slot that cannot be read stays */ } } };
const FOUNDER = { partyMode: 'new', partyName: 'Partito del Fondatore', partyAbbreviation: 'PDF', partyDescription: 'Un partito di prova', partyColor: '#264d82', partyOrientation: 'Centrismo civico', startingRole: null, parliamentaryGroupId: '', parliamentStartMode: 'real-context', initialLevel: 'comunale' };

// The career of the leader of a party, with the races of the party in front of him.
async function leader({ seed, partyId = null, draft = {}, region = 'Toscana' }) {
  const run = await startCareer({ seed, level: 'deputato', region, partyId: partyId ?? '', territorial: true, draft, fast: true });
  const { store, db } = run;
  const parties = [...db.parties, ...db.politicalMovements];
  const people = { politicians: db.politicians, groups: db.parliamentaryGroups };
  const state = store.getState();
  state.game.party.affiliation = 'founder'; state.game.party.rank = 5;
  store.initializeCommittees(db.territorialUnits);
  store.setTerritorialData({ units: db.territorialUnits, municipalities: db.municipalities, parties });
  store.advance(7);
  return { store, db, parties, people, context: run.context };
}
const raceOf = (store, id) => store.races().concat(store.getState().races.archive ?? []).find(item => item.id === id);
const ordinary = store => store.races().find(race => race.level === 'comunale' && !race.round && race.status === 'planned' && race.territory.kind === 'comune');
const goTo = (store, date) => { for (let guard = 0; store.getState().clock.currentDate < date && guard < 120; guard++) store.advance(7); assert.ok(store.getState().clock.currentDate >= date, `Il tempo arriva al ${date}.`); };
const share = (campaign, id = campaign.playerCandidateId) => campaign.territories.reduce((sum, area) => sum + Number(area.supportByCandidate[id] ?? 0) * area.weight, 0) / campaign.territories.reduce((sum, area) => sum + area.weight, 0);

// One complete race of the player. `ending` decides how the vote goes: 'natural' (as played), 'win' or 'lose' (the support of the candidate is set the day before the vote).
async function playRace(label, setup, { ending = 'natural', save = true } = {}) {
  const { store, db, parties, people } = setup;
  const race = ordinary(store);
  assert.ok(race, `${label}: tra le corse del partito c'è un comune ordinario.`);
  const home = store.homePlace();
  assert.notEqual(race.territory.municipalityCode, home.municipalityCode, `${label}: il comune della corsa non è quello del giocatore.`);
  const career = store.getState().career;
  const party = store.getState().game.party;
  // ---- candidacy ----
  store.chooseRaceCandidate(race.id, { kind: 'player' }, people);
  let state = store.getState();
  const confirmed = raceOf(store, race.id);
  assert.equal(confirmed.status, 'confirmed', `${label}: la candidatura è confermata.`);
  assert.equal(confirmed.candidacy.kind, 'player');
  assert.equal(confirmed.candidacy.personId, career.playerId, `${label}: il candidato è il giocatore.`);
  const person = state.dataset.politicians.find(item => item.id === career.playerId);
  const force = state.world.playerPartyId;
  assert.ok(career.partyId, `${label}: la carriera ha un partito.`);
  assert.equal(confirmed.candidacy.partyId, career.partyId, `${label}: il partito della corsa è quello della carriera.`);
  assert.equal(person.partyId, career.partyId, `${label}: e quello della persona.`);
  assert.equal(party.partyId ?? career.partyId, career.partyId, `${label}: e quello del partito di gioco.`);
  assert.equal(confirmed.candidacy.forceId, force, `${label}: la forza dei sondaggi è dichiarata a parte (${force}).`);
  // the lapse of the candidacies is untouched: nothing is simulated before the vote, and the window only opens when the calendar says
  assert.equal(confirmed.result, null); assert.equal(confirmed.campaignId, null);
  assert.equal(store.getState().campaign?.status === 'active', false, `${label}: nessuna campagna parte da sola.`);
  goTo(store, race.windowOpensAt);
  assert.equal(raceOf(store, race.id).status, 'confirmed', `${label}: aperte le candidature la corsa è ancora da giocare.`);
  assert.equal(raceOf(store, race.id).result, null, `${label}: e nessun risultato è stato calcolato dal partito.`);
  // ---- the campaign ----
  const started = store.startCampaign({ electionType: 'comunale', raceId: race.id }, parties, people);
  const campaign = store.getState().campaign;
  assert.equal(started.id, campaign.id);
  assert.equal(campaign.status, 'active'); assert.equal(campaign.electionType, 'comunale');
  assert.equal(campaign.raceId, race.id, `${label}: la campagna è quella della corsa (raceId).`);
  assert.equal(raceOf(store, race.id).campaignId, campaign.id, `${label}: e la corsa conosce la campagna (campaignId).`);
  assert.equal(raceOf(store, race.id).status, 'running', `${label}: durante la campagna la corsa è «in svolgimento».`);
  assert.equal(campaign.electionId, race.id, `${label}: l'elezione ha l'id della corsa.`);
  const players = campaign.candidates.filter(item => item.isPlayer);
  assert.equal(players.length, 1, `${label}: un solo candidato è il giocatore.`);
  assert.equal(players[0].id, campaign.playerCandidateId);
  assert.equal(players[0].partyId, career.partyId, `${label}: il candidato della campagna ha il partito della carriera.`);
  assert.equal(campaign.partyId, career.partyId);
  assert.equal(campaign.candidates.filter(item => item.partyId && item.partyId === force && !item.isPlayer).length, 0, `${label}: la forza del giocatore non è anche un suo avversario.`);
  assert.ok(campaign.candidates.length >= 3, `${label}: ci sono gli avversari della competizione.`);
  assert.deepEqual(campaign.territories.map(area => area.name), [race.territory.name], `${label}: la competizione è il comune della corsa (${race.territory.name}).`);
  assert.equal(campaign.racePlace.municipalityCode, race.territory.municipalityCode); assert.equal(campaign.racePlace.municipality, race.territory.name);
  assert.equal(campaign.electorate.place.municipalityCode, race.territory.municipalityCode, `${label}: il bacino elettorale è quello del comune.`);
  assert.notEqual(campaign.racePlace.municipalityCode, home.municipalityCode);
  assert.equal(campaign.electionDate, race.electionDate); assert.equal(campaign.nomination.status, 'approved');
  assert.ok(campaign.polls.length >= 1 && campaign.polls.at(-1).results.some(row => row.candidateId === campaign.playerCandidateId), `${label}: il candidato è nel primo sondaggio.`);
  const opening = share(campaign);
  // ---- the weeks: activities, resources, events, polls, projection ----
  const before = { money: campaign.resources.money, visibility: campaign.resources.visibility };
  let performed = 0;
  for (let week = 0; week < 3 && store.getState().campaign.status === 'active'; week++) {
    const current = store.getState().campaign;
    for (const event of [...(current.pendingEvents ?? [])]) store.decideCampaignEvent(event.id, event.choices[0].id);
    for (const activity of ['citizen_meeting', 'social', 'door_to_door']) { try { store.performCampaignActivity(activity, { territoryId: current.territories[0].id }); performed++; } catch { /* not affordable today */ } }
    store.advance(7);
  }
  const middle = store.getState().campaign;
  assert.ok(performed >= 2 && Object.keys(middle.activityUses ?? {}).length >= 1, `${label}: le attività di campagna si eseguono (${performed}).`);
  assert.ok(middle.resources.money !== before.money || middle.resources.visibility !== before.visibility, `${label}: le risorse si muovono con le attività.`);
  assert.ok(middle.history.length > 1, `${label}: la campagna ha il suo diario.`);
  assert.ok(middle.polls.length >= 3, `${label}: i sondaggi arrivano ogni settimana (${middle.polls.length}).`);
  assert.ok(middle.polls.every(poll => poll.results.some(row => row.candidateId === middle.playerCandidateId)), `${label}: il candidato è in ogni sondaggio.`);
  assert.ok(aggregateShares(middle).some(group => group.id === middle.playerCandidateId), `${label}: il candidato è nella proiezione.`);
  assert.ok(campaignObservatory(middle, {}).rows.some(row => row.isPlayer), `${label}: e nell'osservatorio.`);
  assert.equal(raceOf(store, race.id).status, 'running', `${label}: la corsa resta in svolgimento.`);
  // the candidacies of the race have closed meanwhile: a campaign that is on does not turn into a race without a candidate
  assert.ok(store.getState().clock.currentDate > race.windowClosesAt, `${label}: la finestra delle candidature è chiusa.`);
  assert.equal(raceOf(store, race.id).status, 'running', `${label}: la chiusura delle candidature non tocca la campagna già avviata.`);
  assert.equal(raceOf(store, race.id).candidacy.kind, 'player'); assert.equal(raceOf(store, race.id).result, null);
  // ---- save and reload with the campaign on ----
  if (save) {
    const saved = JSON.parse(store.exportSave());
    free();
    store.loadGame(saved);
    const back = store.getState();
    assert.equal(back.campaign.status, 'active', `${label}: dopo il ricaricamento la campagna è in corso.`);
    assert.equal(JSON.stringify(back.campaign), JSON.stringify(saved.campaign), `${label}: con i suoi progressi intatti.`);
    assert.equal(raceOf(store, race.id).status, 'running'); assert.equal(raceOf(store, race.id).campaignId, back.campaign.id);
    assert.equal(raceOf(store, race.id).candidacy.partyId, career.partyId);
    assert.ok(back.campaign.raceId === race.id && back.campaign.candidates.some(item => item.isPlayer && item.partyId === career.partyId));
  }
  // ---- the vote ----
  if (ending !== 'natural') {
    const current = store.getState().campaign;
    for (const area of current.territories) { const ids = Object.keys(area.supportByCandidate); area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === current.playerCandidateId ? (ending === 'win' ? 78 : 4) : (ending === 'win' ? 22 : 96) / (ids.length - 1)])); }
    current.day = current.totalDays - 1;
  }
  let guard = 0;
  while (store.getState().campaign?.status === 'active' && guard++ < 40) {
    const current = store.getState().campaign;
    for (const event of [...(current.pendingEvents ?? [])]) store.decideCampaignEvent(event.id, event.choices[0].id);
    store.advance(ending === 'natural' ? 7 : 1);
  }
  state = store.getState();
  const done = raceOf(store, race.id);
  assert.equal(state.campaign.status, 'finished', `${label}: la campagna si conclude.`);
  assert.equal(done.status, 'held', `${label}: la corsa passa a «conclusa».`);
  assert.equal(done.campaignId, state.campaign.id, `${label}: il risultato è quello della campagna giocata, non di un'altra simulazione.`);
  assert.equal(done.result.share, state.campaign.result.playerShare, `${label}: percentuale della corsa = percentuale della campagna.`);
  assert.equal(done.result.mandate, Boolean(state.campaign.result.personalMandate));
  assert.ok(done.result.groups.length >= 2 && (done.result.groups.some(group => group.ours) || done.result.outcome === 'escluso' || state.campaign.result.eliminatedInFirstRound), `${label}: il risultato ha le candidature del voto.`);
  assert.ok(!done.history.some(item => /corsa simulata|senza gestione giornaliera/.test(item.text)), `${label}: la corsa non è stata simulata dal partito.`);
  assert.ok(done.history.some(item => /la campagna l’hai guidata tu/.test(item.text)), `${label}: lo storico dice che l'hai guidata tu.`);
  assert.ok(!state.world.events.some(item => item.title?.startsWith(race.label) && /corsa simulata/.test(item.body ?? '')), `${label}: nessuna cronaca di corsa simulata per questa corsa.`);
  assert.ok(!state.game.log.some(item => item.title?.startsWith(race.label) && /Radicamento/.test((item.lines ?? []).join(' '))), `${label}: nessun diario di corsa simulata.`);
  const entries = state.career.electionHistory.filter(item => item.raceId === race.id || item.electionId === race.id);
  assert.equal(entries.length, 1, `${label}: un solo record nello storico del giocatore (${entries.length}).`);
  assert.equal(entries[0].percent, done.result.share, `${label}: lo storico ha la stessa percentuale.`);
  assert.equal(entries[0].campaignId, state.campaign.id); assert.equal(entries[0].electionId, race.id);
  assert.equal(racesCount(store, race.id), 1, `${label}: la corsa non si duplica tra lista e archivio.`);
  const offices = state.dataset.offices.filter(item => item.raceId === race.id);
  if (done.result.mandate) {
    assert.equal(offices.length, 1, `${label}: con il mandato c'è una sola carica.`);
    assert.equal(offices[0].politicianId, career.playerId); assert.equal(offices[0].electionId, race.id); assert.ok(done.office.title.startsWith(offices[0].title), `${label}: la carica del giocatore («${offices[0].title}») è quella della corsa («${done.office.title}»).`);
    assert.equal(done.office.since, race.electionDate); assert.equal(done.office.personId, career.playerId);
    assert.match(offices[0].institution, new RegExp(race.territory.name), `${label}: la carica è nel comune della corsa.`);
  } else {
    assert.equal(offices.length, 0, `${label}: senza mandato nessuna carica.`); assert.equal(done.office, null);
  }
  if (ending === 'win') assert.ok(done.result.won && done.result.mandate && /Sindaco/.test(done.office.title), `${label}: la vittoria dà la carica di sindaco di ${race.territory.name}.`);
  if (ending === 'lose') assert.ok(!done.result.won && !done.result.mandate && done.office === null, `${label}: la sconfitta non dà né vittoria né carica.`);
  // later weeks never run the race again or write the result twice
  const frozen = JSON.stringify([raceOf(store, race.id).result, raceOf(store, race.id).history.length, state.career.electionHistory.length]);
  for (let week = 0; week < 6; week++) store.advance(7);
  assert.equal(JSON.stringify([raceOf(store, race.id).result, raceOf(store, race.id).history.length, store.getState().career.electionHistory.length]), frozen, `${label}: nei mesi seguenti il risultato resta quello e non si duplica.`);
  const report = checkInvariants(store.getState(), setup.context);
  assert.ok(report.ok, `${label}: stato coerente dopo la corsa: ${report.issues.slice(0, 3).map(item => `[${item.code}] ${item.message}`).join('; ')}`);
  return { race, campaign: state.campaign, opening, done, setup };
}
const racesCount = (store, id) => [...store.races(), ...(store.getState().races.archive ?? [])].filter(item => item.id === id).length;

// ---------- 1. the party of the career when the polls know it as another force ----------
const si = await playRace('Sinistra Italiana (misurata come AVS)', await leader({ seed: 'gara-si', partyId: SI }));
{
  const state = si.setup.store.getState();
  assert.equal(state.career.partyId, SI); assert.equal(state.world.playerPartyId, AVS, 'Per i sondaggi è Alleanza Verdi e Sinistra.');
  assert.equal(si.done.candidacy.partyId, SI, 'La corsa porta il partito della carriera, non quello dei sondaggi.');
  assert.equal(si.done.candidacy.forceId, AVS);
  lines.push('partito della carriera ≠ forza dei sondaggi: stesso partito in carriera, corsa, candidato e campagna');
}

// ---------- 2. the party weighs in the vote through its candidate ----------
// The same career, place and seed with a party the polls measure at 6% and one under 1%: the candidate of the first starts well ahead of the second's. (Before the party of the race was
// the party of the campaign, the force of the polls was an id nobody had: the candidate counted as a party that weighs nothing.)
{
  // (the store is one for the whole game: the careers are played one after the other)
  const open = async partyId => { const setup = await leader({ seed: 'gara-peso', partyId }); const { store, parties, people } = setup; const race = ordinary(store); store.chooseRaceCandidate(race.id, { kind: 'player' }, people); goTo(store, race.windowOpensAt); store.startCampaign({ electionType: 'comunale', raceId: race.id }, parties, people); const campaign = store.getState().campaign; const rivals = campaign.candidates.filter(item => !item.isPlayer); return { race, mine: share(campaign), relative: share(campaign) / (rivals.reduce((sum, item) => sum + share(campaign, item.id), 0) / rivals.length) }; };
  const a = await open(SI), b = await open(WEAK);
  if (a.race.id === b.race.id) {
    assert.ok(a.relative > b.relative * 1.25, `Un partito del 6% pesa più di uno sotto l'1% nello stesso comune: ${a.mine.toFixed(1)}% (${a.relative.toFixed(2)}× i rivali) contro ${b.mine.toFixed(1)}% (${b.relative.toFixed(2)}×).`);
    lines.push(`il partito pesa nel voto (${a.mine.toFixed(1)}% contro ${b.mine.toFixed(1)}% alla partenza)`);
  } else lines.push('peso del partito (corse diverse: confronto saltato)');
}

// ---------- 3. a party the polls measure as itself, and a new party of the player: the usual flows ----------
const lega = await playRace('Lega (misurata come sé stessa)', await leader({ seed: 'gara-lega', partyId: LEGA }), { save: false });
assert.equal(lega.done.candidacy.partyId, LEGA); assert.equal(lega.done.candidacy.forceId, LEGA);
const founder = await playRace('partito del fondatore', await leader({ seed: 'gara-nuovo', draft: FOUNDER }), { save: false });
assert.ok(founder.done.candidacy.partyId.startsWith('partito-utente-') && founder.done.candidacy.partyId === founder.setup.store.getState().career.partyId);
lines.push('partito reale, partito della carriera e partito nuovo del giocatore');

// ---------- 4. victory and defeat: the office and the history agree with the vote ----------
await playRace('vittoria', await leader({ seed: 'gara-vince', partyId: SI }), { ending: 'win', save: false });
await playRace('sconfitta', await leader({ seed: 'gara-perde', partyId: SI }), { ending: 'lose', save: false });
lines.push('vittoria (sindaco) e sconfitta (nessuna carica), storico e id coerenti');

// ---------- 5. the other paths are intact ----------
{
  const setup = await leader({ seed: 'gara-altri', partyId: SI });
  const { store, people } = setup;
  const [first, second, third] = store.races().filter(race => race.level === 'comunale' && !race.round && race.status === 'planned' && race.territory.kind === 'comune');
  assert.ok(first && second && third, 'Ci sono più corse comunali del partito.');
  // a candidate of the party (not the player): at the vote the party runs the race, once, with its own result
  store.chooseRaceCandidate(first.id, { kind: 'simulation' }, people);
  assert.equal(raceOf(store, first.id).candidacy.partyId, store.getState().career.partyId, 'Anche il candidato simulato ha il partito della carriera.');
  // the player cannot stand in two races that overlap, and a race he stood in without starting the campaign lapses
  store.chooseRaceCandidate(second.id, { kind: 'player' }, people);
  assert.throws(() => store.chooseRaceCandidate(third.id, { kind: 'player' }, people), /Si sovrappone|Già candidato|sovrappon/i, 'Due campagne del giocatore che si sovrappongono: no.');
  goTo(store, advance(first.electionDate, 3) > second.windowClosesAt ? advance(first.electionDate, 3) : advance(second.windowClosesAt, 2));
  const lapsed = raceOf(store, second.id);
  assert.equal(lapsed.status, 'missed', 'Una candidatura mai avviata scade: nessun candidato.');
  assert.equal(lapsed.result, null); assert.equal(lapsed.campaignId, null);
  const ran = raceOf(store, first.id);
  assert.equal(ran.status, 'held', 'La corsa affidata al partito si conclude al voto.');
  assert.ok(ran.result && ran.campaignId && ran.history.some(item => /Voto del/.test(item.text)), 'Con il suo risultato e la sua campagna simulata.');
  assert.equal(racesCount(store, first.id), 1);
  assert.equal((store.getState().career.electionHistory ?? []).filter(item => item.raceId === first.id).length, 0, 'Le corse del partito non entrano nella storia del giocatore.');
  lines.push('candidati del partito simulati, candidatura mai avviata scaduta, sovrapposizioni rifiutate');
}
function advance(date, days) { return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10); }

console.log(`Corsa comunale giocata fuori dal proprio comune: ${lines.join('; ')}.`);
