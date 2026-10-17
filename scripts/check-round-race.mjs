// La corsa della tornata di amministrative per chi non guida un partito: ogni tornata che riempie l'anno ha una corsa in un comune della regione del giocatore (non il suo), a cui può
// candidarsi solo lui (nessuno può scegliere i candidati di un partito che non guida), può ritirarsi, e la campagna è quella vera. La candidatura segna la tornata come «impegnata»
// (non sparisce se il calendario si ricalcola); la corsa non esiste senza l'elenco ISTAT dei comuni. Motore completo, nessun browser.
import assert from 'node:assert/strict';
import { startCareer, playWeek } from './lib/long-run.mjs';

const run = await startCareer({ seed: 'tornata', level: 'comunale', fast: true, territorial: true });
const { store, db, decide } = run;
const people = { politicians: db.politicians, groups: db.parliamentaryGroups };
const find = () => store.races().find(race => race.round && race.status !== 'held');
let race = find();
for (let week = 0; week < 80 && !race; week++) { playWeek({ store, db, decide }); race = find(); }
assert.ok(race, 'Entro due anni la tornata di amministrative ha la sua corsa.');
const state = store.getState();
const home = store.homePlace();
assert.equal(race.level, 'comunale');
assert.equal(race.territory.kind, 'comune');
assert.notEqual(race.territory.municipalityCode, home.municipalityCode, 'Non è il comune del giocatore (che ha il suo voto).');
assert.equal(race.territory.region, home.region, 'È un comune della sua regione.');
assert.equal(race.round && state.game.rounds.some(round => round.id === race.round), true, 'La corsa appartiene a una tornata del calendario.');
assert.equal(race.windowClosesAt > race.windowOpensAt && race.windowOpensAt < race.electionDate, true);

// who does not lead a party decides only about himself
assert.equal(state.game.party?.rank >= 5 || state.game.party?.affiliation === 'founder', false, 'Il giocatore di prova non guida il partito.');
const options = store.raceCandidates(race.id, people);
assert.ok(options.player, 'Tra le opzioni c’è il giocatore.');
assert.throws(() => store.chooseRaceCandidate(race.id, { kind: 'simulation' }, people), /Solo chi guida il partito/, 'Non si scelgono candidati altrui.');
assert.throws(() => store.chooseRaceCandidate(race.id, { kind: 'cadre', id: 'x' }, people), /Solo chi guida il partito/);
const slate = store.races().filter(item => !item.round);
assert.equal(slate.length, 0, 'Chi non guida un partito non vede la lista delle corse del partito, solo la sua.');
const other = { ...race, id: 'gara-altra', round: undefined };
void other;

// stand, withdraw, stand again: the round remembers it
const roundOf = () => store.getState().game.rounds.find(round => round.id === race.round);
store.chooseRaceCandidate(race.id, { kind: 'player' }, people);
assert.equal(store.races().find(item => item.id === race.id).status, 'confirmed');
assert.equal(roundOf().standing, true, 'La tornata è segnata come impegnata.');
// the calendar is recomputed every week: the round he stands in stays where it is
for (let week = 0; week < 3; week++) { store.advance(7); assert.ok(roundOf(), 'La tornata in cui è candidato resta in calendario.'); assert.equal(roundOf().electionDate, race.electionDate, 'E non si sposta.'); }
store.chooseRaceCandidate(race.id, { kind: 'none' }, people);
assert.equal(store.races().find(item => item.id === race.id).status, 'planned');
assert.equal(roundOf().standing, false);
store.chooseRaceCandidate(race.id, { kind: 'player' }, people);

// the campaign is the real one
for (let week = 0; week < 60 && store.getState().clock.currentDate < race.windowOpensAt; week++) store.advance(7);
assert.ok(store.getState().clock.currentDate >= race.windowOpensAt, 'La finestra delle candidature si apre.');
store.startCampaign({ electionType: 'comunale', raceId: race.id }, db.parties, people);
const campaign = store.getState().campaign;
assert.equal(campaign.status, 'active');
assert.equal(campaign.raceId, race.id);
assert.equal(campaign.electionType, 'comunale');
assert.equal(campaign.electionDate ?? race.electionDate, race.electionDate);
assert.equal(campaign.racePlace.municipalityCode, race.territory.municipalityCode, 'La campagna si gioca nel comune della corsa.');
for (let week = 0; week < 20 && store.getState().campaign?.status === 'active'; week++) {
  for (const event of [...(store.getState().campaign.pendingEvents ?? [])]) { try { store.decideCampaignEvent(event.id, event.choices[0].id); } catch { /* answered */ } }
  try { store.performCampaignActivity('citizen_meeting', { territoryId: store.getState().campaign.territories?.[0]?.id }); } catch { /* not today */ }
  store.advance(7);
}
const done = store.races().concat(store.getState().races.archive ?? []).find(item => item.id === race.id);
assert.equal(done.status, 'held', 'La corsa si conclude con un risultato.');
assert.ok(done.result && Number.isFinite(done.result.share), 'Con il risultato del voto.');
const { readFile } = await import('node:fs/promises');
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const { residentsOfMunicipality } = await import(`../src/core/municipal-rules.js${build ? `?v=${build}` : ''}`);
const count = store.getState().career.lastElectionReport?.count;
assert.ok(count, 'Il rapporto del voto ha il conteggio.');
assert.ok(residentsOfMunicipality(race.territory.municipalityCode) > 0, 'I residenti di quel comune sono in archivio.');
assert.equal(count.residents, residentsOfMunicipality(race.territory.municipalityCode), 'I residenti sono quelli ISTAT di quel comune.');
assert.equal(count.normalized, false, 'Nessuna scala fittizia di 100.000 schede: i dati demografici ci sono.');
assert.ok(count.voters <= count.residents && count.ballots <= count.voters, 'Votanti non oltre i residenti, validi non oltre i votanti.');
console.log(`Corsa della tornata di amministrative: ${done.label} (${done.territory.name}, ${home.region}), solo il giocatore può candidarsi, ritiro e nuova candidatura, la tornata resta in calendario e non si sposta, campagna vera con i residenti ISTAT del comune e risultato ${String(done.result.share).replace('.', ',')}%.`);
