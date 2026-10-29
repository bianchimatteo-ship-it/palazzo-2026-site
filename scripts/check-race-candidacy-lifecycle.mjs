// The candidacy of the player in a territorial race (comunale, provinciale, regionale) outside his own place, from the choice to the office, on the real store: the closing of the candidacies
// is not the end of the race. The candidacy he filed («Tu») stays valid until the vote, in every place of the game (the race, the hub of the elections, the agenda, the save), is never
// «Senza candidato» / «missed» before the vote, and at the vote the party runs the campaign he did not start and the result, the history and the office are his, once.
//   - the case of the report: a provincial race of another region, the player chosen as candidate, the candidacies close with no campaign started, the vote still ahead;
//   - the three levels, a place of the same region and of another one, the choice saved and reloaded, before and after the closing of the candidacies;
//   - every week from the closing to the vote: the same candidate, no result, not in «Ultime corse concluse»; the vote: held, result, office or none, one entry in the history;
//   - a game saved by the previous version (candidacy marked «missed» at the closing): it stands again and goes to the vote;
//   - races with no valid candidacy leave the list without ever being «missed»; the campaign started in the window is not touched; no duplicates.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { storage } = await module('src/core/storage.js');
const { checkInvariants } = await module('src/core/invariants.js');
const { renderElectionsHub } = await module('src/ui/elections-hub.js');

const SI = 'party-registro-p1-2014-13-ir';
const lines = [];
const free = () => { for (const slot of storage.listSlots()) { try { if (slot.autoPreserve) storage.deleteSlot(slot.id); } catch { /* a slot that cannot be read stays */ } } };
const advanceDate = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const raceOf = (store, id) => store.races().concat(store.getState().races.archive ?? []).find(item => item.id === id);
const racesCount = (store, id) => store.races().concat(store.getState().races.archive ?? []).filter(item => item.id === id).length;
const today = store => store.getState().clock.currentDate;
const problems = (store, label) => { const report = checkInvariants(store.getState()); assert.deepEqual((report.issues ?? []).map(item => `${item.path}: ${item.message}`), [], `${label}: nessuna incoerenza nello stato.`); };

// The career of the leader of a party that has a seat in a comune (the second-level provincial vote needs one), with the races of the party in front of him.
async function leader({ seed, level = 'comunale', region = 'Toscana' }) {
  const run = await startCareer({ seed, level, region, partyId: SI, territorial: true, fast: true });
  const { store, db } = run;
  const parties = [...db.parties, ...db.politicalMovements];
  const people = { politicians: db.politicians, groups: db.parliamentaryGroups };
  const state = store.getState();
  state.game.party.affiliation = 'founder'; state.game.party.rank = 5;
  store.initializeCommittees(db.territorialUnits);
  store.setTerritorialData({ units: db.territorialUnits, municipalities: db.municipalities, parties });
  store.advance(7);
  return { store, db, parties, people };
}
// A race of the level in front of the leader, in a place that is not his own, that the player can stand in (the calendar is waited for: a vote that overlaps another of his is not one).
function findRace(setup, level, { sameRegion = null } = {}) {
  const { store, people } = setup;
  for (let guard = 0; guard < 200; guard++) {
    const home = store.homePlace();
    const race = store.races().find(item => item.level === level && !item.round && item.status === 'planned' && item.windowOpensAt > today(store)
      && (level !== 'comunale' || item.territory.kind === 'comune') && item.territory.municipalityCode !== home.municipalityCode && (level !== 'provinciale' || item.territory.provinceCode !== home.provinceCode)
      && (sameRegion === null || (item.territory.region === home.region) === sameRegion) && store.raceCandidates(item.id, people)?.player?.available);
    if (race) return race;
    store.advance(7);
  }
  return null;
}
const hub = (setup, tab = 'candidatura') => renderElectionsHub(store(setup).getState(), { parties: setup.parties, logoFor: () => null, tab, races: { raceOptions: id => store(setup).raceCandidates(id, setup.people) } });
const store = setup => setup.store;
const rowOf = (html, race) => (html.match(/<li class="eh-race [^"]*">[\s\S]*?<\/li>/g) ?? []).find(item => item.includes(race.label)) ?? null;
const pastOf = html => html.match(/<details class="eh-races-past">[\s\S]*?<\/details>/g)?.join('') ?? '';

// One race of the player, from the choice to the office. `where` says what is being checked.
async function run(label, setup, race, { reload = true } = {}) {
  const { store, people } = setup;
  const home = store.homePlace();
  const career = store.getState().career;
  assert.ok(race, `${label}: c'è una corsa fuori dal proprio territorio.`);
  assert.notEqual(race.territory.kind === 'comune' ? race.territory.municipalityCode : race.territory.kind === 'provincia' ? race.territory.provinceCode : race.territory.region, race.territory.kind === 'comune' ? home.municipalityCode : race.territory.kind === 'provincia' ? home.provinceCode : home.region, `${label}: il territorio della corsa non è quello del giocatore.`);
  // ---- the candidacy is filed: the same candidate everywhere ----
  store.chooseRaceCandidate(race.id, { kind: 'player' }, people);
  let current = raceOf(store, race.id);
  assert.equal(current.status, 'confirmed', `${label}: candidatura salvata.`);
  assert.equal(current.candidacy.kind, 'player'); assert.equal(current.candidacy.personId, career.playerId);
  const rowNow = rowOf(hub(setup), current);
  assert.ok(rowNow && /Candidato scelto/.test(rowNow) && /Tu</.test(rowNow) && !/Senza candidato/.test(rowNow), `${label}: l'hub riconosce il candidato («Tu») dopo il salvataggio.`);
  problems(store, `${label} (candidatura)`);
  if (reload) {
    const saved = JSON.parse(store.exportSave()); free(); store.loadGame(saved);
    current = raceOf(store, race.id);
    assert.equal(current.status, 'confirmed', `${label}: dopo il ricaricamento la candidatura c'è ancora.`);
    assert.equal(current.candidacy.kind, 'player'); assert.equal(current.candidacy.personId, career.playerId);
  }
  // ---- the candidacies open and close with no campaign started ----
  while (today(store) <= race.windowClosesAt) {
    store.advance(7);
    current = raceOf(store, race.id);
    assert.equal(current.status, 'confirmed', `${label}: ${today(store)} (finestra ${race.windowOpensAt} – ${race.windowClosesAt}): la candidatura non scade mai prima del voto.`);
  }
  assert.ok(today(store) < race.electionDate, `${label}: il voto è ancora davanti (${today(store)} < ${race.electionDate}).`);
  assert.equal(current.status, 'confirmed', `${label}: chiuse le candidature la corsa NON è «Senza candidato»: la candidatura presentata resta valida.`);
  assert.notEqual(current.status, 'missed'); assert.equal(current.result, null); assert.equal(current.campaignId, null);
  assert.equal(current.candidacy.kind, 'player'); assert.equal(current.candidacy.personId, career.playerId);
  let html = hub(setup), row = rowOf(html, current);
  assert.ok(row && /status-confirmed/.test(row) && /Candidatura presentata/.test(row) && /Tu</.test(row), `${label}: l'hub mostra «Candidatura presentata» e il candidato «Tu» a candidature chiuse.`);
  assert.ok(!/Senza candidato/.test(row) && !pastOf(html).includes(current.label), `${label}: e non la mette tra le corse concluse.`);
  assert.ok(/voto del/.test(row), `${label}: dice che il risultato arriva al voto.`);
  assert.ok(racesCount(store, race.id) === 1, `${label}: nessun duplicato.`);
  problems(store, `${label} (candidature chiuse)`);
  if (reload) {
    const saved = JSON.parse(store.exportSave()); free(); store.loadGame(saved);
    assert.equal(raceOf(store, race.id).status, 'confirmed', `${label}: salvata e ricaricata a candidature chiuse, la candidatura resta.`);
  }
  // ---- the weeks to the vote ----
  let weeks = 0;
  while (today(store) < race.electionDate && weeks++ < 12) {
    store.advance(7);
    current = raceOf(store, race.id);
    if (today(store) < race.electionDate) {
      assert.equal(current.status, 'confirmed', `${label}: ${today(store)}: ancora in attesa del voto del ${race.electionDate}.`);
      assert.equal(current.result, null); assert.equal(current.candidacy.kind, 'player');
    }
  }
  assert.ok(today(store) >= race.electionDate, `${label}: il voto è arrivato.`);
  // ---- the vote: result, office, history, once ----
  current = raceOf(store, race.id);
  assert.equal(current.status, 'held', `${label}: dopo il voto la corsa è conclusa.`);
  assert.ok(current.result && current.campaignId, `${label}: con il suo risultato (${current.result?.share}%) e la sua campagna.`);
  assert.ok(current.history.some(item => /Voto del/.test(item.text) && /condotto|condotta il partito/.test(item.text)), `${label}: la storia dice che la campagna l'ha condotta il partito.`);
  assert.equal(current.candidacy.kind, 'player'); assert.equal(racesCount(store, race.id), 1, `${label}: una sola corsa.`);
  const state = store.getState();
  const entries = (state.career.electionHistory ?? []).filter(item => item.raceId === race.id);
  assert.equal(entries.length, 1, `${label}: una sola voce nella storia elettorale del giocatore.`);
  assert.equal(entries[0].campaignId, current.campaignId); assert.ok(Math.abs(Number(entries[0].percent) - current.result.share) < 0.11, `${label}: la stessa percentuale (${entries[0].percent} ≈ ${current.result.share}).`);
  assert.equal(state.campaign?.raceId, race.id, `${label}: la campagna conclusa è quella della corsa.`);
  const offices = state.dataset.offices.filter(item => item.raceId === race.id);
  if (current.result.mandate) { assert.equal(offices.length, 1, `${label}: l'incarico è assegnato una volta (${offices[0]?.title}).`); assert.equal(offices[0].politicianId, career.playerId); assert.ok(current.office?.title?.startsWith(offices[0].title), `${label}: lo stesso incarico nella corsa e nei registri.`); }
  else assert.equal(offices.length, 0, `${label}: nessun mandato, nessun incarico.`);
  assert.ok(!/Senza candidato/.test(rowOf(hub(setup), current) ?? ''), `${label}: dopo il voto l'hub non dice «Senza candidato».`);
  const html2 = hub(setup);
  assert.ok(pastOf(html2).includes(current.label) && /Conclusa/.test(pastOf(html2)), `${label}: ora è tra le corse concluse.`);
  problems(store, `${label} (dopo il voto)`);
  // advancing further changes nothing and never counts the vote twice
  const copy = JSON.stringify([raceOf(store, race.id), (store.getState().career.electionHistory ?? []).length]);
  store.advance(14);
  assert.equal(JSON.stringify([raceOf(store, race.id), (store.getState().career.electionHistory ?? []).length]), copy, `${label}: il voto non si conta due volte.`);
  lines.push(`${label}: ${current.territory.name}, ${current.result.won ? 'vittoria' : current.result.mandate ? 'consiglio all’opposizione' : 'sconfitta'} (${String(current.result.share).replace('.', ',')}%)`);
  return current;
}

// ---------- the case of the report: a provincial race of another region ----------
{
  const setup = await leader({ seed: 'cand-provinciale' });
  const race = findRace(setup, 'provinciale', { sameRegion: false });
  await run('provinciali, altra provincia e altra regione', setup, race);
}
// ---------- the other places of the three levels ----------
{
  const setup = await leader({ seed: 'cand-comunale-altra' });
  await run('comunali, altro comune di un’altra regione', setup, findRace(setup, 'comunale', { sameRegion: false }), { reload: false });
}
{
  // (the place of the career is drawn from the seed: the first seed that has a comune of the same region in the calendar)
  let setup = null, race = null;
  for (const seed of ['cand-sr-1', 'cand-sr-2', 'cand-sr-3', 'cand-sr-4', 'cand-sr-5', 'cand-sr-6']) { setup = await leader({ seed }); race = findRace(setup, 'comunale', { sameRegion: true }); if (race) break; }
  await run('comunali, altro comune della stessa regione', setup, race, { reload: false });
}
{
  const setup = await leader({ seed: 'cand-regionale', level: 'regionale' });
  await run('regionali, altra regione', setup, findRace(setup, 'regionale'), { reload: false });
}

// ---------- a game saved by the previous version, the candidacy marked «missed» at the closing ----------
{
  const setup = await leader({ seed: 'cand-vecchio-salvataggio' });
  const { store, people } = setup;
  const race = findRace(setup, 'provinciale');
  store.chooseRaceCandidate(race.id, { kind: 'player' }, people);
  while (today(store) <= race.windowClosesAt) store.advance(7);
  assert.equal(raceOf(store, race.id).status, 'confirmed');
  const saved = JSON.parse(store.exportSave());
  const old = saved.races.items.find(item => item.id === race.id);
  old.status = 'missed'; old.history.unshift({ date: today(store), text: 'Le candidature si sono chiuse senza che la campagna cominciasse: nessun candidato.', source: 'simulation' });
  free(); store.loadGame(saved);
  assert.equal(raceOf(store, race.id).status, 'missed', 'Il vecchio salvataggio si carica com’era.');
  store.advance(7);
  const back = raceOf(store, race.id);
  if (today(store) < race.electionDate) assert.equal(back.status, 'confirmed', 'La candidatura segnata «missed» dalla versione precedente torna valida fino al voto.');
  assert.equal(back.candidacy.kind, 'player');
  let guard = 0; while (today(store) < race.electionDate && guard++ < 12) store.advance(7);
  assert.equal(raceOf(store, race.id).status, 'held', 'e al voto si conclude con il suo risultato.');
  assert.ok(raceOf(store, race.id).result && racesCount(store, race.id) === 1);
  problems(store, 'vecchio salvataggio');
  lines.push('salvataggio della versione precedente («missed») ripreso e portato al voto');
}

// ---------- no valid candidacy, withdrawal, other candidates, and the campaign started in the window ----------
{
  const setup = await leader({ seed: 'cand-senza' });
  const { store, people } = setup;
  const races = store.races().filter(item => item.level === 'comunale' && !item.round && item.status === 'planned' && item.territory.kind === 'comune');
  assert.ok(races.length >= 3);
  const [none, withdrawn, simulated] = races;
  // a candidacy withdrawn: the race is to be decided again and leaves the list with the closing, without ever being «missed»
  store.chooseRaceCandidate(withdrawn.id, { kind: 'player' }, people);
  store.chooseRaceCandidate(withdrawn.id, { kind: 'none' }, people);
  assert.equal(raceOf(store, withdrawn.id).status, 'planned'); assert.equal(raceOf(store, withdrawn.id).candidacy, null);
  store.chooseRaceCandidate(simulated.id, { kind: 'simulation' }, people);
  let guard = 0;
  while (today(store) <= [none.electionDate, simulated.electionDate].sort().at(-1) && guard++ < 90) {
    store.advance(7);
    for (const id of [none.id, withdrawn.id]) { const item = raceOf(store, id); assert.ok(!item || (item.status !== 'missed' && !item.result), `Corsa senza candidato valido: mai «missed» né con risultato (${item?.status}).`); }
  }
  assert.ok(!store.races().concat(store.getState().races.archive ?? []).some(item => [none.id, withdrawn.id].includes(item.id) && ['missed', 'held'].includes(item.status)), 'Le corse senza candidato escono dal calendario senza risultato.');
  const ran = raceOf(store, simulated.id);
  assert.equal(ran.status, 'held'); assert.ok(ran.result && racesCount(store, simulated.id) === 1, 'Il candidato del partito corre al voto, una volta.');
  assert.equal((store.getState().career.electionHistory ?? []).filter(item => item.raceId === simulated.id).length, 0, 'Il candidato simulato non entra nella storia del giocatore.');
  problems(store, 'corse senza candidato');
  lines.push('nessun candidato o candidatura ritirata: mai «missed», nessun risultato; candidato simulato al voto una volta');
}
{
  // the campaign started in the window is not touched by the closing, and the candidacy of the player is never counted twice
  const setup = await leader({ seed: 'cand-campagna' });
  const { store, parties, people } = setup;
  const race = findRace(setup, 'comunale', { sameRegion: false });
  store.chooseRaceCandidate(race.id, { kind: 'player' }, people);
  while (today(store) < race.windowOpensAt) store.advance(7);
  store.startCampaign({ electionType: 'comunale', raceId: race.id }, parties, people);
  assert.equal(raceOf(store, race.id).status, 'running');
  let guard = 0;
  while (store.getState().campaign?.status === 'active' && guard++ < 40) { for (const event of [...(store.getState().campaign.pendingEvents ?? [])]) store.decideCampaignEvent(event.id, event.choices[0].id); store.advance(7); if (today(store) > race.windowClosesAt && today(store) < race.electionDate) assert.equal(raceOf(store, race.id).status, 'running', 'La chiusura delle candidature non tocca la campagna giocata.'); }
  const done = raceOf(store, race.id);
  assert.equal(done.status, 'held'); assert.ok(done.result && /la campagna l’hai guidata tu/.test(done.history[0].text));
  assert.equal((store.getState().career.electionHistory ?? []).filter(item => item.raceId === race.id).length, 1);
  assert.equal(racesCount(store, race.id), 1);
  problems(store, 'campagna giocata');
  lines.push('campagna avviata nella finestra: invariata, una sola voce nella storia');
}

console.log(`Candidature territoriali fuori dal proprio territorio, dalla scelta all'incarico: ${lines.join('; ')}.`);
process.exit(0);
