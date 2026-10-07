// The territorial races of a round (regional, provincial and municipal votes): the leader fields a candidate in each — himself (a campaign he plays), a person of the
// staff, a politician the game knows, a new figure of the simulation — with no days and no money; the others are run by the party with the campaign-engine and leave
// persons, party, territory, candidacy, campaign, polls, result, office and history. One engine for the three levels, rooting that moves the result and never blocks,
// real people and data untouched, a playable calendar (a race to play every year, distance between the ones the player plays), save and reload.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { startCareer, seeded } from './lib/long-run.mjs';

const root = new URL('../', import.meta.url);
const build = (await readFile(new URL('index.html', root), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const engine = await import(new URL(`src/core/race-engine.js${v}`, root).href);
const { advanceDays } = await import(new URL(`src/core/time.js${v}`, root).href);
const rules = (await import(new URL(`src/data/simulation/race-rules.js${v}`, root).href)).RACE_RULES;
const models = (await import(new URL(`src/data/simulation/campaign-rules.js${v}`, root).href)).ELECTION_MODELS;
const { checkInvariants } = await import(new URL(`src/core/invariants.js${v}`, root).href);
const days = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
const hashOf = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// The game as the browser has it (storage, files from disk) and a career of a party leader in Toscana: the same engine, the same real data.
const run = await startCareer({ seed: 'tornata-gare', level: 'deputato', region: 'Toscana' });
const store = run.store;
// ---------- 1. the slate: the real calendar of the votes, nothing invented ----------
const real = await import(new URL(`src/data/repositories/real-data.js${v}`, root).href);
await real.loadRealDatabase();
await real.loadRealCollections(['territorialUnits', 'municipalities', 'politicians', 'parliamentaryGroups', 'parties', 'politicalMovements']);
const db = real.realDatabase;
const calendar = await real.loadRealDocument('localElections');
const realBefore = hashOf({ politicians: db.politicians, parties: db.parties, groups: db.parliamentaryGroups, units: db.territorialUnits });
const TODAY = '2026-09-24';
const hasProvincial = (await import(new URL(`src/data/regions.js${v}`, root).href)).hasProvincialLevel;
const slateArgs = { today: TODAY, calendar, units: db.territorialUnits, municipalities: db.municipalities, avoid: { regions: ['Toscana'], provinceCodes: ['052'], municipalityCodes: ['052032'] }, hasProvincial };
const slate = engine.buildSlate(slateArgs);
assert.deepEqual(engine.buildSlate(slateArgs), slate, 'La stessa data e gli stessi dati: la stessa lista di corse.');
for (const level of ['regionale', 'provinciale', 'comunale']) assert.ok(slate.some(race => race.level === level), `Nella lista ci sono corse di livello ${level}: un solo motore, tre livelli.`);
for (const race of slate) {
  const model = models[race.level];
  assert.equal(days(race.windowOpensAt, race.electionDate), model.campaignDays, `${race.label}: la campagna dura quanto dice il modello (${model.campaignDays} giorni).`);
  assert.equal(days(race.windowOpensAt, race.windowClosesAt), rules.windowDays, `${race.label}: candidature aperte ${rules.windowDays} giorni.`);
  assert.ok(race.windowClosesAt >= TODAY && race.windowOpensAt <= '2027-10-15' && race.nextVote > race.electionDate, `${race.label}: una finestra futura entro l’orizzonte, con il voto seguente dopo.`);
  assert.equal(race.source, 'simulation');
  assert.ok(!(race.territory.name === 'Toscana' || race.territory.provinceCode === '052' || race.territory.municipalityCode === '052032'), `${race.label}: il territorio del giocatore ha il suo voto, non è tra le corse del partito.`);
}
const perDay = {};
for (const race of slate) perDay[`${race.level}|${race.electionDate}`] = (perDay[`${race.level}|${race.electionDate}`] ?? 0) + 1;
assert.ok(Object.entries(perDay).every(([key, count]) => count <= rules.maxPerLevel[key.split('|')[0]]), 'Mai più corse di quante la regola ne dà per livello e giorno.');
const merged = engine.mergeSlate(slate, slate, TODAY);
assert.deepEqual(merged, engine.mergeSlate(merged, slate, TODAY), 'Rinnovare la lista non cambia ciò che c’è già.');
assert.ok(real.realDatabase.municipalities.length > 7000 && slate.filter(race => race.level === 'comunale').every(race => /^\d{6}$/.test(race.territory.municipalityCode)), 'I comuni sono quelli reali dell’ISTAT (capoluoghi).');

// ---------- 2. the same round: the player in Piemonte, staff in Lombardia, a politician in a third region, a new figure in a fourth, a Comune and a Provincia ----------
// Four regions vote in the same round (a custom calendar of the test: the real one has them in different years).
const doc = JSON.parse(JSON.stringify(calendar));
for (const row of doc.regions) if (['Piemonte', 'Lombardia', 'Veneto', 'Campania'].includes(row.region)) row.lastElection = '2022-02-13';
store.setLocalCalendar(doc);
store.initializeCommittees(db.territorialUnits);
let state = store.getState();
state.game.party.affiliation = 'founder'; state.game.party.rank = 5;
store.advance(7);
const parties = [...db.parties, ...db.politicalMovements];
store.setTerritorialData({ units: db.territorialUnits, municipalities: db.municipalities, parties });
const people = { politicians: db.politicians, groups: db.parliamentaryGroups };
const raceOf = name => store.races().find(race => race.territory.name === name && race.level === (['Piemonte', 'Lombardia', 'Veneto', 'Campania'].includes(name) ? 'regionale' : race.level));
const [piemonte, lombardia, veneto, campania] = ['Piemonte', 'Lombardia', 'Veneto', 'Campania'].map(raceOf);
assert.ok(piemonte && lombardia && veneto && campania && new Set([piemonte, lombardia, veneto, campania].map(race => race.electionDate)).size === 1, 'Le quattro regioni votano nella stessa tornata.');
const comune = store.races().find(race => race.level === 'comunale');
const provincia = store.races().find(race => race.level === 'provinciale');
assert.ok(comune && provincia, 'Nella tornata c’è almeno un Comune e almeno una Provincia.');

// What the choices cost: nothing. Not a day, not a point of capital, not a euro, not the clock.
state = store.getState();
const before = { ap: state.game.week.ap, week: state.game.week.index, date: store.getState().clock.currentDate, capital: state.game.resources.politicalCapital, funds: state.game.resources.funds, treasury: state.game.party.org.treasury.balance };
const optionsOf = race => store.raceCandidates(race.id, people);
// The player stands in Piemonte, outside his own region: the rooting is lower, the candidacy is not blocked.
const own = optionsOf(piemonte);
const home = engine.rootingOf({ race: { territory: { kind: 'regione', name: 'Toscana', region: 'Toscana' } }, from: { region: 'Toscana' }, committee: 50 });
assert.ok(own.player.available && own.player.rooting.points < home.points && !own.player.rooting.exact, `Il giocatore (toscano) può candidarsi in Piemonte: radicamento ${own.player.rooting.points} contro ${home.points} a casa, nessun blocco.`);
store.chooseRaceCandidate(piemonte.id, { kind: 'player' }, people);
// A staff member in Lombardia (a local leader of the party), a politician the game knows in Veneto, a new figure in Campania.
const staff = optionsOf(lombardia).cadres.find(item => item.available);
assert.ok(staff, 'Il partito ha quadri da candidare.');
store.chooseRaceCandidate(lombardia.id, { kind: 'cadre', id: staff.id }, people);
const politician = optionsOf(veneto).politicians.find(item => item.available && item.source === 'real');
assert.ok(politician, 'Un parlamentare reale del gruppo del partito è disponibile.');
store.chooseRaceCandidate(veneto.id, { kind: 'politician', id: politician.id }, people);
store.chooseRaceCandidate(campania.id, { kind: 'simulation' }, people);
store.chooseRaceCandidate(comune.id, { kind: 'simulation' }, people);
const cadreForProvince = optionsOf(provincia).cadres.find(item => item.available && item.id !== staff.id);
store.chooseRaceCandidate(provincia.id, cadreForProvince ? { kind: 'cadre', id: cadreForProvince.id } : { kind: 'simulation' }, people);
state = store.getState();
assert.deepEqual({ ap: state.game.week.ap, week: state.game.week.index, date: state.clock.currentDate, capital: state.game.resources.politicalCapital, funds: state.game.resources.funds, treasury: state.game.party.org.treasury.balance }, before, 'Scegliere i candidati non consuma giorni, capitale, fondi né tempo.');
const chosen = store.races().filter(race => race.status === 'confirmed');
assert.equal(chosen.length, 6, 'Sei corse con il candidato scelto.');
const kinds = chosen.map(race => race.candidacy.kind);
assert.ok(kinds.filter(kind => kind === 'player').length === 1 && kinds.filter(kind => kind === 'politician').length === 1 && kinds.filter(kind => kind === 'cadre').length >= 1 && kinds.filter(kind => kind === 'simulation').length >= 2, 'Giocatore, quadri, politico esistente e figure simulate.');
// The persons: a new person of the simulation only where the candidate is new; a real politician is not copied; the player is himself.
const persons = state.dataset.politicians;
const fresh = race => store.races().find(item => item.id === race.id);
const personOf = race => persons.find(item => item.id === fresh(race).candidacy.personId);
assert.ok(personOf(campania).source === 'simulation' && personOf(campania).partyId === state.world.playerPartyId && /Candidato simulato/.test(personOf(campania).displayName), 'La figura nuova è una persona della simulazione, del partito.');
assert.ok(personOf(lombardia).source === 'simulation' && fresh(lombardia).candidacy.cadreId === staff.id, 'Il quadro candidato diventa una persona del gioco.');
assert.ok(!persons.some(item => item.id === politician.id) && fresh(veneto).candidacy.personRef.source === 'real' && fresh(veneto).candidacy.personId === politician.id, 'Il politico reale resta reale: nessuna copia tra le persone della simulazione.');
assert.equal(fresh(piemonte).candidacy.personId, state.career.playerId, 'Nella corsa del Piemonte il candidato sei tu.');
// No duplicates and no overwrite: choosing the same again keeps the same person.
const idOfCampania = fresh(campania).candidacy.personId;
store.chooseRaceCandidate(campania.id, { kind: 'simulation' }, people);
assert.equal(store.getState().dataset.politicians.filter(item => item.id === idOfCampania).length, 1, 'La stessa figura non si duplica.');
assert.equal(store.getState().dataset.politicians.length, persons.length, 'Né si aggiungono persone se non serve.');
// A person is in one race at a time; the player plays his campaigns apart.
assert.throws(() => store.chooseRaceCandidate(campania.id, { kind: 'cadre', id: staff.id }, people), /Già candidato a/, 'Lo stesso quadro non corre in due corse a pochi giorni.');
assert.throws(() => store.chooseRaceCandidate(lombardia.id, { kind: 'player' }, people), /Troppo vicina a Regionali · Piemonte/, 'Il giocatore non gioca due voti dello stesso giorno.');
// The distance between two votes the player plays is 89 days (88 is too close, 89 is not); between two races of the same person it stays at 35 (34 is too close, 35 is not).
assert.equal(rules.playableGapDays, 89, 'Tra due voti che il giocatore gioca passano almeno 89 giorni.');
assert.equal(rules.personGapDays, 35, 'La distanza di una persona tra due corse non cambia.');
{
  const [base, other] = store.races();
  const held = candidacy => ({ ...base, status: 'confirmed', candidacy });
  const probe = (gap, candidacy) => engine.candidateOptions({ race: { ...other, id: 'corsa-di-prova', electionDate: advanceDays(base.electionDate, gap) }, items: [held(candidacy)], today: state.clock.currentDate, player: { id: 'p-gioco', label: 'Tu', block: null }, cadres: [{ id: 'quadro-prova', label: 'Quadro di prova' }], politicians: [], homeVotes: [], from: {}, committee: 0, standing: null });
  const own = { kind: 'player', personId: 'p-gioco' };
  assert.equal(probe(88, own).player.available, false, 'A 88 giorni da un voto che giochi, un altro non si gioca.');
  assert.match(probe(88, own).player.reason, /almeno 89 giorni/);
  assert.equal(probe(89, own).player.available, true, 'A 89 giorni sì.');
  assert.equal(probe(-88, own).player.available, false, 'Vale anche per un voto prima.');
  assert.equal(probe(-89, own).player.available, true);
  const staffed = { kind: 'cadre', cadreId: 'quadro-prova', personId: 'quadro-prova' };
  assert.equal(probe(34, staffed).cadres[0].available, false, 'Una persona non corre in due corse a 34 giorni.');
  assert.equal(probe(35, staffed).cadres[0].available, true, 'A 35 sì: la distanza di una persona resta di 35 giorni.');
  assert.equal(probe(34, staffed).player.available, true, 'Le corse affidate ad altri non contano per le campagne del giocatore.');
}
// Only the leader decides.
const member = JSON.parse(JSON.stringify(store.getState().game.party));
store.getState().game.party.affiliation = 'member'; store.getState().game.party.rank = 1;
assert.throws(() => store.chooseRaceCandidate(provincia.id, { kind: 'none' }, people), /Solo chi guida il partito/, 'Solo il segretario decide i candidati.');
store.getState().game.party.affiliation = member.affiliation; store.getState().game.party.rank = member.rank;
// Taking a choice back, and the closing of the candidacies (engine).
store.chooseRaceCandidate(provincia.id, { kind: 'none' }, people);
assert.equal(store.races().find(race => race.id === provincia.id).status, 'planned', 'Il candidato si può ritirare finché le candidature sono aperte.');
store.chooseRaceCandidate(provincia.id, { kind: 'simulation' }, people);
assert.throws(() => engine.chooseCandidate(store.races(), comune.id, { kind: 'simulation' }, { today: '2027-12-31', leader: true, career: { id: 'x', playerId: 'p', partyId: 'q' }, people: [], cadres: [], politicians: [], homeVotes: [], from: {}, committee: () => 0 }), /candidature per questa corsa sono chiuse/, 'Chiuse le candidature la scelta non si cambia.');

// ---------- 3. the player plays his own race; the others are run by the party and answer at their vote ----------
const piemonteRace = () => store.races().find(race => race.id === piemonte.id);
let guard = 0;
while (store.getState().clock.currentDate < piemonte.windowOpensAt && guard++ < 80) { assert.notEqual(store.getState().game.status, 'ended'); store.advance(7); }
assert.ok(store.getState().clock.currentDate >= piemonte.windowOpensAt, 'Il tempo arriva alle candidature del Piemonte.');
assert.ok(!store.getState().campaign || store.getState().campaign.status !== 'active', 'Nessuna campagna in corso: si può cominciare.');
const started = store.startCampaign({ electionType: 'regionale', raceId: piemonte.id }, parties, people);
assert.equal(started.electionType, 'regionale', 'Una sola campagna del motore, anche per il Piemonte.');
assert.ok(started.racePlace.region === 'Piemonte' && store.homePlace().region === 'Toscana' && started.territories.every(area => area.region === 'Piemonte'), 'La campagna si tiene in Piemonte, dove si vota, anche se il giocatore è toscano.');
assert.equal(started.nomination.status, 'approved', 'Il segretario ha scelto sé stesso: nessuna contesa interna.');
assert.equal(piemonteRace().status, 'running', 'La corsa è in svolgimento.');
assert.equal(started.rooting.exact, false, 'Fuori dal suo territorio il radicamento è basso, non un blocco.');
let weeks = 0;
while (store.getState().campaign?.status === 'active' && weeks++ < 30) {
  const current = store.getState().campaign;
  for (const event of [...(current.pendingEvents ?? [])]) { try { store.decideCampaignEvent(event.id, event.choices[0].id); } catch { /* answered */ } }
  try { store.performCampaignActivity('citizen_meeting', { territoryId: current.territories[0].id }); } catch { /* not affordable today */ }
  store.advance(7);
}
assert.equal(store.getState().campaign?.status, 'finished', 'La campagna giocata si conclude.');
// The others: at their vote, the party runs the race (no daily management) and the result is kept.
while (store.getState().clock.currentDate <= '2027-06-06' && guard++ < 160) { assert.notEqual(store.getState().game.status, 'ended'); store.advance(7); }
state = store.getState();
const held = id => state.races.items.find(race => race.id === id);
for (const race of [piemonte, lombardia, veneto, campania, comune, provincia]) {
  const done = held(race.id);
  assert.equal(done.status, 'held', `${race.label}: la corsa è conclusa.`);
  // person → party → territory → candidacy → campaign → polls → result → office → history
  assert.ok(done.candidacy.personId && done.candidacy.partyId === state.world.playerPartyId, `${race.label}: la persona e il partito.`);
  assert.ok(done.territory.name && done.territory.region && done.level === race.level, `${race.label}: il territorio.`);
  assert.ok(done.campaignId && done.candidacy.role && done.candidacy.rooting !== undefined, `${race.label}: la candidatura e la campagna.`);
  assert.ok(done.polls.waves >= 3 && done.polls.rows.length >= 3 && done.polls.rows.every(row => row.series.length >= 3), `${race.label}: i sondaggi di ogni settimana (${done.polls.waves} onde, ${done.polls.rows.length} righe, serie ${done.polls.rows.map(row => row.series.length).join('/')}).`);
  assert.ok(done.result.groups.length >= 3 && done.result.groups.some(group => group.ours) && Number.isFinite(done.result.share) && typeof done.result.won === 'boolean', `${race.label}: il risultato.`);
  assert.ok(done.history.length >= 2 && done.history.every(item => item.date && item.text), `${race.label}: lo storico.`);
  if (done.result.mandate) assert.ok(done.office?.title && done.office.personId === done.candidacy.personId && done.office.since === done.electionDate, `${race.label}: la carica di chi è eletto.`);
  else assert.equal(done.office, null, `${race.label}: nessuna carica senza mandato.`);
}
const winners = [lombardia, campania, comune, provincia].map(race => held(race.id)).filter(race => race.result.mandate && race.candidacy.personRef.source === 'simulation');
for (const race of winners) assert.ok(state.dataset.offices.some(item => item.politicianId === race.candidacy.personId && item.title === race.office.title && item.source === 'simulation' && !item.endDate), `${race.label}: la persona della simulazione eletta ha la sua carica nei dati del gioco.`);
assert.ok(!state.dataset.offices.some(item => item.politicianId === politician.id), 'Il politico reale non riceve cariche nei dati: la sua candidatura è solo nella corsa.');
assert.ok(held(piemonte.id).result.outcome && state.career.electionHistory.some(item => /Regionali · Piemonte/.test(item.electionLabel)), 'La corsa giocata è anche nella storia elettorale del giocatore, quelle del partito no.');
assert.ok(!state.career.electionHistory.some(item => /Lombardia|Veneto|Campania/.test(item.electionLabel)), 'Le corse del partito non entrano nella storia elettorale del giocatore.');
const names = [lombardia, veneto, campania, comune, provincia].map(race => race.label);
assert.ok(state.game.log.some(item => item.kind === 'elezioni' && names.some(name => item.title.startsWith(name))), 'Nel diario delle ultime settimane compaiono le corse del partito.');
assert.ok(state.game.party.history.some(item => names.some(name => item.text.startsWith(name))), 'E nella storia del partito.');
assert.ok(state.world.events.some(item => names.some(name => item.title.startsWith(name))), 'E nella cronaca dei sondaggi.');
const report = checkInvariants(state, run.context);
assert.ok(report.ok, `Stato coerente dopo la tornata: ${report.issues.slice(0, 3).map(item => `[${item.code}] ${item.message}`).join('; ')}`);

// ---------- 4. save and reload: the same races, the same persons ----------
const reloaded = (await import(new URL(`src/core/store.js?gare=${Date.now()}`, root).href)).store.getState();
assert.equal(JSON.stringify(reloaded.races), JSON.stringify(state.races), 'Dopo il ricaricamento le corse sono quelle salvate.');
assert.deepEqual(reloaded.dataset.politicians.map(item => item.id), state.dataset.politicians.map(item => item.id), 'E le persone.');

// ---------- 5. determinism: the same game, the same races ----------
const again = async () => {
  const other = await startCareer({ seed: 'tornata-gare-det', level: 'deputato', region: 'Toscana' });
  other.store.setLocalCalendar(doc);
  other.store.getState().game.party.affiliation = 'founder'; other.store.getState().game.party.rank = 5;
  other.store.setTerritorialData({ units: db.territorialUnits, municipalities: db.municipalities, parties });
  for (const race of other.store.races().filter(item => item.level === 'regionale').slice(0, 2)) other.store.chooseRaceCandidate(race.id, { kind: 'simulation' }, people);
  while (other.store.getState().clock.currentDate <= '2027-03-14') other.store.advance(7);
  return other.store.races().filter(race => race.status === 'held').map(race => [race.id, race.result.share, race.result.won, race.polls.waves]);
};
const first = await again();
assert.ok(first.length >= 2, 'Le corse affidate al partito si concludono.');
assert.deepEqual(await again(), first, 'Stessa partita, stessi risultati: la simulazione è deterministica.');

// ---------- 6. a calendar to play: a race every year, distance between the ones the player plays ----------
{
  const long = await startCareer({ seed: 'calendario-gare', level: 'deputato', region: 'Lombardia' });
  long.store.initializeCommittees(db.territorialUnits);
  long.store.getState().game.party.affiliation = 'founder'; long.store.getState().game.party.rank = 5;
  long.store.setTerritorialData({ units: db.territorialUnits, municipalities: db.municipalities, parties });
  const offered = new Map();
  for (let week = 0; week < 52 * 7 && long.store.getState().game.status !== 'ended'; week++) {
    const now = long.store.getState();
    for (const race of long.store.races().filter(item => item.status === 'planned')) {
      const options = long.store.raceCandidates(race.id, people);
      const playable = options.player?.available;
      const year = race.electionDate.slice(0, 4);
      if (playable) offered.set(year, new Set([...(offered.get(year) ?? []), race.id]));
      // The leader plays the first race he can (the rule keeps the distance), the others he leaves to the party.
      try { long.store.chooseRaceCandidate(race.id, playable && week % 2 === 0 ? { kind: 'player' } : { kind: 'simulation' }, people); } catch { /* not possible: the next race */ }
    }
    if (now.campaign?.status === 'active') { try { long.store.performCampaignActivity('citizen_meeting', { territoryId: now.campaign.territories[0].id }); } catch { /* wait */ } }
    long.store.advance(7);
  }
  const all = long.store.races();
  for (const year of ['2027', '2028', '2029', '2030', '2031', '2032']) assert.ok((offered.get(year)?.size ?? 0) >= 1, `${year}: almeno una corsa che il giocatore può giocare.`);
  const played = all.filter(race => race.candidacy?.kind === 'player' && race.status !== 'planned').sort((a, b) => a.electionDate.localeCompare(b.electionDate));
  assert.ok(played.length >= 3, `Il giocatore sceglie sé stesso in più corse (${played.length}).`);
  for (let index = 1; index < played.length; index++) assert.ok(days(played[index - 1].electionDate, played[index].electionDate) >= rules.playableGapDays, `Tra ${played[index - 1].label} e ${played[index].label} ci sono almeno ${rules.playableGapDays} giorni.`);
  assert.ok(all.filter(race => race.status === 'held').length >= 8, 'Le altre corse si svolgono da sole, anno dopo anno.');
  const later = checkInvariants(long.store.getState(), long.context);
  assert.ok(later.ok, `Stato coerente dopo sette anni di corse: ${later.issues.slice(0, 3).map(item => `[${item.code}] ${item.message}`).join('; ')}`);
}

// ---------- 7. the real data stay as they are ----------
assert.equal(hashOf({ politicians: db.politicians, parties: db.parties, groups: db.parliamentaryGroups, units: db.territorialUnits }), realBefore, 'I dati reali non sono stati modificati.');
console.log('Corse territoriali verificate: una lista dal calendario reale (regioni, province, capoluoghi) con un solo motore per i tre livelli; nella stessa tornata il giocatore in Piemonte (fuori dal suo territorio: radicamento più basso, nessun blocco), un quadro in Lombardia, un parlamentare reale nel Veneto, una figura simulata in Campania, un Comune e una Provincia, scelti senza consumare giorni, capitale né fondi; nessun duplicato e nessuna sovrascrittura, politici reali intatti; solo il segretario decide; la corsa giocata e quelle del partito (sondaggi settimanali, risultato, carica, storico); salvataggio e ricaricamento; determinismo; una corsa da giocare ogni anno e almeno ' + rules.playableGapDays + ' giorni tra quelle giocate.');
