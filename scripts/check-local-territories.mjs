// The councils of the player are told apart by place, not only by kind: a comune won in another territory (a race of the round of local elections) is a second council next to the one the
// player already sits in, it does not replace it. Candidacy → campaign → result → office, on the real engine, no browser:
//   - the mandate held in the home comune stays active, with its roster, its office record and its history, when a comune elsewhere is won;
//   - the new council carries the name and the place of the race (not the player's), and every consequence (the office, the institution, the territory of the services) refers to it;
//   - a vote lost in another territory leaves everything held as it is; a vote lost in the home place ends only the home term, the mandate elsewhere stays;
//   - a new term in the same place replaces that place's council only (the old one is closed in the record);
//   - every institution is reached by its own id (the anchor, the selector, the links), and a bare kind (an old link or view) opens the latest of that kind;
//   - the incompatibilities still apply (a seat in Parliament ends the mayoralties of both comuni) and close the offices of each place;
//   - an older save, whose councils carry no place codes, is read by name.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer, playWeek } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const E = await module('src/core/local-engine.js');
const { rosterSeats } = await module('src/core/seat-roster.js');
const { renderInstitutions, resolveInstitution, institutionLabel, activeInstitutions } = await module('src/ui/local-mode.js');
const { mandatePlace } = await module('src/ui/election-report.js');
const { renderHeadquarters } = await module('src/ui/game-mode.js');
const { heldOffices, localOffices } = await module('src/core/office-engine.js');
const lines = [];

// ---------- 1. the identity of a place (pure) ----------
const council = (kind, name, place, extra = {}) => ({ id: `${kind}-x-${name}`, kind, name, status: 'active', place, region: place?.region ?? null, ...extra });
assert.equal(E.sameTerritory(council('comune', 'Comune di Siena', { municipalityCode: '052032' }), council('comune', 'Comune di Siena', { municipalityCode: '052032' })), true, 'Stesso codice: stesso comune.');
assert.equal(E.sameTerritory(council('comune', 'Comune di Siena', { municipalityCode: '052032' }), council('comune', 'Comune di Arezzo', { municipalityCode: '051002' })), false, 'Codici diversi: comuni diversi.');
assert.equal(E.sameTerritory(council('comune', 'Comune di Siena', { municipalityCode: '052032' }), council('comune', 'Comune di Siena', {})), true, 'Un salvataggio senza codici si legge dal nome.');
assert.equal(E.sameTerritory(council('comune', 'Comune di Siena', { municipalityCode: '052032' }), council('comune', 'Comune di Montepulciano', {})), false, 'Il nome distingue anche senza codici.');
assert.equal(E.sameTerritory(council('comune', 'Comune di Siena', { municipalityCode: '1' }), council('comune', 'Comune di Siena', { municipalityCode: '2' })), false, 'Due comuni con lo stesso nome ma codici diversi non sono lo stesso.');
assert.equal(E.sameTerritory(council('comune', 'Comune di Roma', {}), council('provincia', 'Provincia di Roma', {})), false, 'Il genere conta: comune e provincia non coincidono.');
assert.equal(E.sameTerritory(council('regione', 'Regione Toscana', { region: 'Toscana' }), council('regione', 'Regione Lazio', { region: 'Lazio' })), false, 'Regioni diverse.');
assert.equal(E.sameTerritory(council('europa', 'Parlamento europeo'), council('europa', 'Parlamento europeo')), true, 'Il Parlamento europeo è uno solo.');
// two councils of one kind: both offices are held, and the label of each says the place
const mayorA = council('comune', 'Comune di Alfa', { municipalityCode: '1' }, { executive: { leader: 'player' } });
const councillorB = council('comune', 'Comune di Beta', { municipalityCode: '2' }, { executive: { leader: 'simulato' }, playerRole: 'consigliere' });
assert.deepEqual([...heldOffices({ institutions: [mayorA, councillorB] })].sort(), ['consigliere-comunale', 'sindaco'], 'Si tengono entrambi gli incarichi, non solo l’ultimo.');
assert.equal(localOffices([mayorA, councillorB]).comune, 'sindaco', 'Per genere conta l’incarico più pesante.');
assert.match(institutionLabel(councillorB, [mayorA, councillorB]), /Beta/, 'L’etichetta dice il luogo quando i consigli dello stesso genere sono più d’uno.');
lines.push('identità del luogo (codici, nomi, genere), incarichi di più consigli');

// ---------- 2. win the race of another comune: a second council next to the home one ----------
const people = db => ({ politicians: db.politicians, groups: db.parliamentaryGroups });
const give = store => { const s = store.getState(); s.game.week.ap = Math.max(s.game.week.ap, 6); s.game.resources.funds = Math.max(s.game.resources.funds, 50000); s.game.resources.politicalCapital = 80; };
function forceVote(store, win) {
  const c = store.getState().campaign;
  c.nomination.status = 'approved'; c.nomination.internalSupport = 10; c.candidacy.listPosition = 1;
  c.candidateStats = { ...c.candidateStats, notoriety: win ? 98 : 5, reputation: win ? 98 : 5, popularity: win ? 98 : 5 };
  for (const area of c.territories) { const ids = Object.keys(area.supportByCandidate); area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === c.playerCandidateId ? (win ? 60 : 3) : (win ? 40 : 97) / Math.max(1, ids.length - 1)])); }
  c.day = c.totalDays - 1;
  store.advance(1);
  if (store.getState().campaign?.status === 'active') { forceVote(store, win); }
}
async function raceOutcome(seed, win) {
  const run = await startCareer({ seed, level: 'comunale', fast: true, territorial: true });
  const { store, db, decide } = run;
  const find = () => store.races().find(race => race.round && race.status !== 'held' && race.level === 'comunale');
  let race = find();
  for (let week = 0; week < 80 && !race; week++) { playWeek({ store, db, decide }); race = find(); }
  assert.ok(race, `${seed}: la tornata ha la sua corsa`);
  const before = store.getState();
  const home = store.homePlace();
  const homeInst = (before.local?.institutions ?? []).find(item => item.kind === 'comune' && item.status === 'active');
  assert.ok(homeInst, `${seed}: il giocatore siede nel consiglio del suo comune`);
  store.chooseRaceCandidate(race.id, { kind: 'player' }, people(db));
  for (let week = 0; week < 60 && store.getState().clock.currentDate < race.windowOpensAt; week++) store.advance(7);
  give(store);
  store.startCampaign({ electionType: 'comunale', raceId: race.id }, db.parties, people(db));
  forceVote(store, win);
  const after = store.getState();
  assert.equal(after.campaign?.status, 'finished', `${seed}: la campagna si chiude con il voto`);
  return { run, store, race, before, after, home, homeInst };
}
let wonSnapshot = null;
const won = await raceOutcome('tornata', true);
{
  const { after, homeInst, race, home } = won;
  assert.ok(after.career.lastElectionResult?.personalMandate, `Il voto forzato è vinto (${after.career.lastElectionResult?.outcomeLabel}).`);
  const active = (after.local.institutions ?? []).filter(item => item.kind === 'comune' && item.status === 'active');
  assert.equal(active.length, 2, 'I consigli comunali attivi sono due: quello di casa e quello della corsa.');
  const kept = active.find(item => item.id === homeInst.id);
  assert.ok(kept, 'Il consiglio di casa è ancora attivo (stesso id).');
  assert.equal(kept.name, homeInst.name, 'Con il suo nome.');
  const fresh = active.find(item => item.id !== homeInst.id);
  assert.equal(fresh.name, `Comune di ${race.territory.municipality ?? race.territory.name}`, 'Il nuovo consiglio porta il nome del comune della corsa.');
  assert.equal(fresh.place.municipalityCode, race.territory.municipalityCode, 'E il suo codice ISTAT, non quello del comune di partenza.');
  assert.notEqual(fresh.place.municipalityCode, home.municipalityCode, 'Diverso dal comune di casa.');
  assert.equal(fresh.region, race.territory.region, 'Con la sua regione.');
  assert.equal(new Set((after.local.institutions ?? []).map(item => item.id)).size, after.local.institutions.length, 'Gli id delle istituzioni sono unici.');
  // the offices: both open, each in its own comune
  const offices = after.dataset.offices.filter(item => item.politicianId === after.career.playerId && !item.endDate && item.level === 'comunale');
  assert.ok(offices.some(item => item.institution === fresh.name), 'L’incarico del nuovo comune è aperto.');
  const homeOffices = before => before.dataset.offices.filter(item => item.politicianId === before.career.playerId && !item.endDate && item.level === 'comunale' && item.institution === homeInst.name);
  assert.equal(homeOffices(after).length, homeOffices(won.before).length, 'Gli incarichi aperti del comune di casa non sono stati chiusi.');
  // the record of the past: nothing of the home council went to the closed list
  assert.equal((after.local.institutions ?? []).some(item => item.id === homeInst.id && item.status !== 'active'), false, 'Il consiglio di casa non risulta concluso.');
  // roles, offices held
  const held = heldOffices({ institutions: activeInstitutions(after) });
  assert.ok(held.length >= 1, 'Gli incarichi dei consigli attivi sono nell’elenco.');
  // navigation: every institution by its own id
  const view = renderInstitutions(after, { localInst: fresh.id });
  assert.ok(view.includes(`id="istituzione-${fresh.id}"`) && !view.includes(`id="istituzione-${kept.id}"`), 'La scheda mostrata è quella scelta per id.');
  assert.ok(view.includes(`data-local-inst="${kept.id}"`) && view.includes(`data-local-inst="${fresh.id}"`), 'Il selettore ha un pulsante con l’id di ciascun consiglio.');
  assert.ok(view.includes(`<h2>${fresh.name}</h2>`), 'Con il nome del consiglio scelto.');
  const other = renderInstitutions(after, { localInst: kept.id });
  assert.ok(other.includes(`id="istituzione-${kept.id}"`) && other.includes(`<h2>${kept.name}</h2>`), 'E l’altro si raggiunge con il suo id.');
  assert.ok(renderInstitutions(after, { localInst: 'comune' }).includes(`id="istituzione-${fresh.id}"`), 'Un genere nudo (vecchio collegamento) apre l’ultimo di quel genere.');
  assert.equal(resolveInstitution(after, kept.id).id, kept.id);
  assert.equal(resolveInstitution(after, fresh.id).id, fresh.id);
  assert.equal(resolveInstitution(after, 'nessuno'), null);
  const hq = renderHeadquarters(after);
  assert.ok(hq.includes(`data-scroll="istituzione-${kept.id}"`) && hq.includes(`data-scroll="istituzione-${fresh.id}"`), 'La Home ha un collegamento per ciascun consiglio.');
  assert.deepEqual(mandatePlace(after, after.career.lastElectionReport)?.scroll, `istituzione-${fresh.id}`, 'Il rapporto del voto porta al consiglio appena conquistato.');
  // the next weeks: both councils live, neither is lost or doubled
  const run = won.run;
  for (let week = 0; week < 6; week++) playWeek({ store: won.store, db: run.db, decide: run.decide });
  const later = won.store.getState().local.institutions.filter(item => item.status === 'active' && item.kind === 'comune');
  assert.deepEqual(later.map(item => item.id).sort(), [kept.id, fresh.id].sort(), 'Dopo alcune settimane i due consigli sono ancora quelli.');
  assert.ok(later.every(item => item.roster && rosterSeats(item.roster).length === item.seats), 'Ciascuno ha il suo roster di eletti (una persona per seggio).');
  const everyone = later.flatMap(item => rosterSeats(item.roster).map(seat => seat.personId));
  assert.ok(everyone.filter(id => id === after.career.playerId).length >= 1, 'Il giocatore siede nei suoi consigli.');
  assert.equal(later.find(item => item.id === kept.id).name, kept.name, 'Il consiglio di casa ha ancora il suo nome.');
  wonSnapshot = structuredClone(won.store.getState()); // the store is one for the whole process: the next career replaces it
  lines.push(`vittoria in un altro comune (${fresh.name}): due consigli, incarichi e roster intatti, navigazione per id`);
}

// ---------- 3. a vote lost elsewhere: nothing held is touched ----------
const lost = await raceOutcome('tornata', false);
{
  const { after, before, homeInst } = lost;
  assert.equal(Boolean(after.career.lastElectionResult?.personalMandate), false, `Il voto forzato è perso (${after.career.lastElectionResult?.outcomeLabel}).`);
  const openHome = st => st.dataset.offices.filter(item => item.politicianId === st.career.playerId && !item.endDate && item.institution === homeInst.name).length;
  const homeActive = (after.local.institutions ?? []).some(item => item.id === homeInst.id && item.status === 'active');
  // an event of the same week may end every office (a resignation): then the council ends with them, never one without the other
  assert.equal(homeActive, openHome(after) > 0, 'Il consiglio di casa è attivo se e solo se ha ancora il suo incarico aperto.');
  assert.equal((after.local.institutions ?? []).filter(item => item.kind === 'comune' && item.status === 'active' && item.id !== homeInst.id).length, 0, 'Nessun nuovo consiglio dal voto perso.');
  if (homeActive) assert.equal(openHome(after), openHome(before), 'Gli incarichi del comune di casa sono quelli di prima.');
  lines.push('voto perso in un altro territorio: nessun consiglio nuovo, consigli e incarichi coerenti');
}

// ---------- 3b. a resignation ends councils and offices together (checked on the same state, whatever the week brought) ----------
for (const st of [wonSnapshot, lost.store.getState()]) {
  const openNames = new Set(st.dataset.offices.filter(item => item.politicianId === st.career.playerId && !item.endDate && item.level === 'comunale').map(item => item.institution));
  for (const inst of (st.local.institutions ?? []).filter(item => item.kind === 'comune')) assert.equal(inst.status === 'active', openNames.has(inst.name), `${inst.name}: consiglio e incarico sono aperti o chiusi insieme.`);
}

// ---------- 4. the incompatibilities, place by place ----------
const { institutionOps } = await module('src/core/store.js');
{
  const base = structuredClone(wonSnapshot);
  const comuni = base.local.institutions.filter(item => item.kind === 'comune' && item.status === 'active');
  assert.equal(comuni.length, 2, 'Si parte da due consigli comunali.');
  const [first, second] = comuni;
  const setRole = (state, inst, leads) => { const item = state.local.institutions.find(other => other.id === inst.id); item.executive = { ...(item.executive ?? {}), leader: leads ? 'player' : 'simulato' }; item.playerRole = leads ? 'sindaco' : 'consigliere'; };
  const officeOf = (state, inst) => state.dataset.offices.find(item => item.politicianId === state.career.playerId && item.institution === inst.name && item.level === 'comunale');
  const openOf = (state, inst) => officeOf(state, inst) && !officeOf(state, inst).endDate;
  const date = base.clock.currentDate;
  // mayor here, councillor there: a seat in the Chambers ends the mayoralty only (art. 122 and the rule of the game on the heads of local bodies), the seat of councillor stays
  const mixed = structuredClone(base);
  setRole(mixed, first, true); setRole(mixed, second, false);
  for (const inst of [first, second]) if (!officeOf(mixed, inst)) mixed.dataset.offices.push({ id: `prova-${inst.id}`, title: inst.id === first.id ? 'Sindaco' : 'Consigliere comunale', institution: inst.name, level: 'comunale', politicianId: mixed.career.playerId, startDate: inst.since, endDate: null });
  const afterMixed = institutionOps.lapseConflicts(mixed, 'deputato', date);
  const stateOf = (state, inst) => state.local.institutions.find(item => item.id === inst.id).status;
  assert.equal(stateOf(afterMixed, first), 'concluso', 'Il comune in cui è sindaco si chiude con il seggio alle Camere.');
  assert.equal(stateOf(afterMixed, second), 'active', 'Il consiglio in cui è solo consigliere resta (nessuna regola lo esclude).');
  assert.equal(Boolean(openOf(afterMixed, first)), false, 'L’incarico di sindaco è chiuso nel suo comune.');
  assert.equal(Boolean(openOf(afterMixed, second)), Boolean(openOf(mixed, second)), 'L’incarico dell’altro comune è com’era.');
  // mayor in both: both lapse, each office in its own place
  const both = structuredClone(base);
  setRole(both, first, true); setRole(both, second, true);
  for (const inst of [first, second]) if (!officeOf(both, inst)) both.dataset.offices.push({ id: `prova-${inst.id}`, title: 'Sindaco', institution: inst.name, level: 'comunale', politicianId: both.career.playerId, startDate: inst.since, endDate: null });
  const afterBoth = institutionOps.lapseConflicts(both, 'deputato', date);
  assert.deepEqual([stateOf(afterBoth, first), stateOf(afterBoth, second)], ['concluso', 'concluso'], 'Due sindaci: entrambe le fasce decadono.');
  assert.equal(Boolean(openOf(afterBoth, first)) || Boolean(openOf(afterBoth, second)), false, 'E i due incarichi si chiudono, ciascuno nel suo comune.');
  // a council of another kind is not touched by a comune that closes elsewhere; a province falls only when no comune of its province is left
  const closedOne = institutionOps.closeInstitution(structuredClone(base), 'comune', date, 'concluso', { id: first.id });
  assert.equal(stateOf(closedOne, first), 'concluso', 'Chiudere un comune per id chiude solo quello.');
  assert.equal(stateOf(closedOne, second), 'active', 'E non l’altro.');
  // same place, new term: the old one of that place ends, the other stays
  const renewed = institutionOps.withInstitution(structuredClone(base), { ...structuredClone(first), id: `${first.id}-bis`, since: date, roster: null, status: 'active' });
  assert.equal(renewed.local.institutions.filter(item => item.kind === 'comune' && item.status === 'active').length, 2, 'Un nuovo mandato nello stesso comune sostituisce quel consiglio e non l’altro.');
  assert.equal(stateOf(renewed, first), 'concluso', 'Il vecchio mandato è nello storico.');
  assert.equal(stateOf(renewed, second), 'active', 'L’altro consiglio è intatto.');
  lines.push('incompatibilità luogo per luogo (sindaco/consigliere, due sindaci, chiusura per id, rinnovo nello stesso luogo)');
}

console.log(`Consigli locali per luogo: ${lines.join('; ')}.`);
