// The races of the party in other comuni, provinces and regions are not only in the page of the candidacies: the agenda tells when the windows open and close, which candidate the secretary still has to
// name (a decision with a deadline, apart from the news), the day of the vote, and the votes of the Chamber that wait for the player. Every item comes from the real state (the race, the law), has its
// date and its title, and acting in time (choosing the candidate) changes the agenda.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const root = new URL('../', import.meta.url);
const build = (await readFile(new URL('index.html', root), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const { agendaCalendar } = await import(new URL(`src/core/agenda-engine.js${v}`, root).href);
const { advanceDays } = await import(new URL(`src/core/time.js${v}`, root).href);

const run = await startCareer({ seed: 'agenda-gare', level: 'deputato', region: 'Toscana' });
const { store } = run;
const real = await import(new URL(`src/data/repositories/real-data.js${v}`, root).href);
await real.loadRealDatabase();
await real.loadRealCollections(['territorialUnits', 'municipalities', 'politicians', 'parliamentaryGroups', 'parties', 'politicalMovements']);
const db = real.realDatabase;
// four regions vote in the same round (a calendar of the test, as in check-races), and the player leads a party
const calendar = await real.loadRealDocument('localElections');
const doc = JSON.parse(JSON.stringify(calendar));
for (const row of doc.regions) if (['Piemonte', 'Lombardia', 'Veneto', 'Campania'].includes(row.region)) row.lastElection = '2022-02-13';
store.setLocalCalendar(doc);
store.initializeCommittees(db.territorialUnits);
store.getState().game.party.affiliation = 'founder'; store.getState().game.party.rank = 5;
store.advance(7);
store.setTerritorialData({ units: db.territorialUnits, municipalities: db.municipalities, parties: [...db.parties, ...db.politicalMovements] });
const people = { politicians: db.politicians, groups: db.parliamentaryGroups };
let state = store.getState();
const races = store.races();
assert.ok(races.length > 3, `Ci sono gare in calendario (${races.length}).`);

// ---------- the news and the decision, each from its race ----------
const items = () => agendaCalendar(store.getState(), { horizonDays: 800 });
const raceItems = () => items().filter(item => races.some(race => item.id.startsWith(race.id)));
const first = raceItems();
assert.ok(first.length > 0, 'Le gare compaiono in agenda.');
for (const item of first) {
  const race = races.find(entry => item.id.startsWith(entry.id));
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(item.date) && item.title && item.kind, `${item.id}: data, titolo e tipo.`);
  if (item.id.endsWith('-apertura')) assert.equal(item.date, race.windowOpensAt, `${race.label}: l'apertura cade nel giorno della finestra.`);
  if (item.id.endsWith('-voto')) assert.equal(item.date, race.electionDate, `${race.label}: il voto cade nel giorno del voto.`);
  if (item.id.endsWith('-scelta')) { assert.equal(item.date, race.windowClosesAt, `${race.label}: la scelta scade alla chiusura delle candidature.`); assert.ok(item.decision && item.tone === 'warn', 'È una decisione con scadenza, non una notizia.'); }
}
assert.ok(first.some(item => item.id.endsWith('-apertura') || item.id.endsWith('-scelta')) && first.some(item => item.id.endsWith('-voto')), 'Ci sono l’apertura (o la scelta) e il giorno del voto.');
assert.ok(raceItems().length <= 30, 'Il calendario non si riempie di centinaia di gare.');
const ids = items().map(item => item.id);
assert.equal(new Set(ids).size, ids.length, 'Nessun elemento duplicato in agenda.');

// ---------- the window opens: the decision is there, with its deadline; acting in time takes it away ----------
let guard = 0;
while (!races.some(race => store.getState().clock.currentDate >= race.windowOpensAt && store.getState().clock.currentDate <= race.windowClosesAt && !store.races().find(item => item.id === race.id)?.candidacy) && guard++ < 80) {
  for (const item of [...store.getState().game.inbox]) { try { store.resolveAgendaItem(item.id, item.defaultChoice); } catch { /* not this week */ } }
  store.advance(7);
}
const today = store.getState().clock.currentDate;
const live = store.races().filter(race => today >= race.windowOpensAt && today <= race.windowClosesAt && !race.candidacy);
assert.ok(live.length > 0, `Si arriva a una finestra aperta senza candidato (${today}).`);
const pending = items().filter(item => item.id.endsWith('-scelta'));
assert.ok(pending.length >= 1, 'La scelta del candidato è in agenda come decisione.');
const target = live.find(race => pending.some(item => item.id === `${race.id}-scelta`));
assert.ok(target, 'La decisione appartiene a una gara con la finestra aperta.');
const item = pending.find(entry => entry.id === `${target.id}-scelta`);
assert.ok(item.days >= 0 && item.date === target.windowClosesAt, 'La scadenza è futura o di oggi.');
// the item is not a dead end: the choice can really be made, in time, and it takes the decision away
const options = store.raceCandidates(target.id, people);
assert.ok(options && (options.simulation?.available ?? true), 'Si può davvero scegliere in tempo.');
store.chooseRaceCandidate(target.id, { kind: 'simulation' }, people);
assert.ok(store.races().find(race => race.id === target.id).candidacy, 'La scelta è registrata.');
assert.ok(!items().some(entry => entry.id === `${target.id}-scelta`), 'Scelto il candidato, la decisione sparisce dall’agenda.');
assert.ok(items().some(entry => entry.id === `${target.id}-chiusura` && /Candidato del partito/.test(entry.detail)), 'E compare la chiusura delle candidature con il candidato.');
// after the window nothing is left pending for that race
store.advance(7 * 12);
assert.ok(!items().some(entry => entry.id === `${target.id}-scelta`), 'Dopo la scadenza non resta nulla da decidere.');

// ---------- the Chamber: a vote that waits for the player, from the real bill ----------
{
  const parliament = structuredClone(store.getState().parliament);
  const probe = structuredClone(store.getState());
  probe.parliament = parliament;
  parliament.player = parliament.player ?? { chamber: 'camera', groupId: 'gruppo-prova' };
  parliament.laws = [...(parliament.laws ?? []), { id: 'legge-prova', title: 'Legge di prova', stage: 'final-vote', currentChamber: parliament.player.chamber, pendingPlayerVote: null, kind: 'ordinaria', votes: [] }];
  let votes = agendaCalendar(probe).filter(entry => entry.id.startsWith('voto-legge-prova'));
  assert.equal(votes.length, 1, 'Un voto finale in Aula che aspetta il giocatore compare in agenda.');
  assert.ok(votes[0].decision && votes[0].urgent && /Legge di prova/.test(votes[0].title) && votes[0].action?.page === 'leggi', 'È una decisione urgente con il collegamento alla pagina delle leggi.');
  parliament.laws.find(law => law.id === 'legge-prova').pendingPlayerVote = 'favorevole';
  assert.equal(agendaCalendar(probe).filter(entry => entry.id.startsWith('voto-legge-prova')).length, 0, 'Deciso il voto, non resta in agenda.');
  parliament.laws.find(law => law.id === 'legge-prova').pendingPlayerVote = null; parliament.laws.find(law => law.id === 'legge-prova').stage = 'approved';
  assert.equal(agendaCalendar(probe).filter(entry => entry.id.startsWith('voto-legge-prova')).length, 0, 'Una legge chiusa non è una decisione.');
  parliament.government = { ...(parliament.government ?? {}), id: 'governo-prova', name: 'Governo di prova', status: 'awaiting-confidence' };
  const confidence = agendaCalendar(probe).filter(entry => entry.id === 'fiducia-governo-prova');
  assert.equal(confidence.length, 1, 'La fiducia al governo che la chiede compare in agenda.');
}
console.log(`Agenda e gare verificate: ${first.length} voci di gare dal calendario reale (aperture, scelta del candidato come decisione con scadenza, giorno del voto), nessun duplicato; scegliere in tempo toglie la decisione; i voti in Aula e la fiducia che aspettano il giocatore sono in agenda.`);
