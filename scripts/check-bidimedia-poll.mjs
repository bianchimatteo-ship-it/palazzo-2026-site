// The BiDiMedia poll of October 2026 as the opening poll of the careers that start from 26 October (scripts/import-bidimedia-2026-10-21.mjs):
//   - nineteen forces and «un'altra lista» as the aggregate «Altri» (98,6 + 1,4 = 100), never a party; the figures are exactly those given to the project;
//   - every force points to an ID that already exists in the catalogue (no duplicates): Casa Riformista–Italia Viva → Italia Viva, AVS → the existing coalition entity, Avanti–PSI → the registered PSI
//     (assumption said in the file), Più Europa → +Europa; the only new entity is Progetto Civico Italia, with its name only, declared and waiting for confirmation, selectable like any party;
//   - no coalition aggregate, no invented variation, sample or margin; the original dates (fieldwork 17–19/10, publication 22/10) and the source are kept apart; nothing is declared verified;
//   - the scenario date is Monday 26 October 2026 and a career that starts then opens with this poll; one that starts on 21 October still opens with the October Supermedia (history untouched).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
import { isSelectableParty } from '../src/data/schema.js';

const dir = new URL('../src/data/real/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, dir), 'utf8'));
const EXPECTED = [
  ['party-registro-p1-2014-04-ir', 26.5], ['party-registro-p1-2015-29-ir', 20.5], ['party-registro-p1-2022-63-ir', 12.0], ['party-futuro-nazionale', 7.2], ['party-registro-p1-2015-20-ir', 6.7],
  ['coalition-alleanza-verdi-sinistra', 6.6], ['party-registro-p1-2017-41-ir', 5.4], ['party-registro-p1-2019-51-ir', 3.0], ['party-registro-p1-2019-52-ir', 2.0], ['party-registro-p1-2022-67-ir', 1.4],
  ['party-registro-p1-2018-47-ir', 1.1], ['party-registro-p1-2020-56-ir', 1.0], ['party-progetto-civico-italia', 1.0], ['party-registro-p1-2024-74-ir', 0.8], ['movement-potere-al-popolo', 0.8],
  ['party-registro-p1-2014-01-ir', 0.8], ['party-ora', 0.7], ['party-registro-p1-2014-05-ir', 0.6], ['party-registro-p1-2015-25-ir', 0.5]
];

// ---------- 1. the file ----------
const polls = await read('polls.json');
const poll = polls.find(item => item.id === 'poll-bidimedia-2026-10-21');
assert.ok(poll, 'Il sondaggio BiDiMedia è nel file.');
assert.deepEqual(poll.results.map(row => [row.entityId, row.share]), EXPECTED, 'Diciannove forze con le percentuali date al progetto.');
const total = Math.round(poll.results.reduce((sum, row) => sum + row.share, 0) * 10) / 10;
assert.equal(total, 98.6); assert.equal(poll.others, 1.4, '«Un’altra lista» è 1,4.');
assert.equal(Math.round((total + poll.others) * 10) / 10, 100, 'Forze e residuo fanno 100.');
assert.ok(poll.results.every(row => !/altra lista|altri/i.test(row.label) && row.delta === null), 'Nessuna riga «altra lista» tra i partiti e nessuna variazione inventata.');
assert.ok(/categoria aggregata e non un partito/.test(poll.othersNote), '«Altri» è dichiarato aggregato.');
assert.equal(poll.coalitions, null, 'Nessun dato aggregato sulle coalizioni.');
assert.equal(new Set(poll.results.map(row => row.entityId)).size, poll.results.length, 'Nessun ID ripetuto.');
assert.deepEqual([poll.fieldworkFrom, poll.fieldworkTo, poll.publishedAt, poll.referenceDate], ['2026-10-17', '2026-10-19', '2026-10-22', '2026-10-21'], 'Date: rilevazione 17–19/10, pubblicazione 22/10, sondaggio del 21/10.');
assert.ok(poll.referenceDate >= poll.fieldworkTo && poll.referenceDate <= poll.publishedAt);
assert.equal(poll.sourceUrl, 'https://sondaggibidimedia.com/sondaggio-bidimedia-ottobre-2026/'); assert.ok(/BiDiMedia/.test(poll.sourceName));
assert.ok(poll.source === 'real' && poll.verified === false && poll.verificationStatus === 'in-attesa-di-conferma' && poll.verifiedAt === null && poll.transcribedAt === '2026-10-22', 'Dichiarato, non verificato: nessuna data di lettura inventata.');
assert.ok(/non era raggiungibile|non è stata riletta/.test(poll.verificationNote) && /da riconfermare/.test(poll.verificationNote), 'La nota dice come è stato registrato e che cosa manca.');
assert.ok(/Casa Riformista–Italia Viva è mappata all’ID esistente di Italia Viva/.test(poll.mappingNote) && /Avanti–PSI al Partito Socialista Italiano/.test(poll.mappingNote), 'La mappatura è dichiarata.');
const sourceLabels = Object.fromEntries(poll.results.filter(row => row.sourceLabel).map(row => [row.entityId, row.sourceLabel]));
assert.equal(sourceLabels['party-registro-p1-2019-52-ir'], 'Casa Riformista–Italia Viva', 'Italia Viva conserva il nome della fonte.');
// the catalogue: every ID exists once, only Progetto Civico Italia is new
const parties = await read('parties.json'), movements = await read('political-movements.json'), coalitions = await read('coalitions.json');
const catalogue = [...parties, ...movements, ...coalitions];
for (const [id] of EXPECTED) assert.equal(catalogue.filter(item => item.id === id).length, 1, `${id}: una sola entità nel catalogo.`);
assert.equal(new Set(catalogue.map(item => item.id)).size, catalogue.length, 'Nessun ID duplicato.');
const names = catalogue.map(item => String(item.officialName).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''));
assert.equal(new Set(names).size, names.length, 'Nessuna denominazione duplicata.');
assert.ok(!catalogue.some(item => /riformista/i.test(item.officialName)), 'Casa Riformista non è un partito nuovo.');
const civico = parties.find(item => item.id === 'party-progetto-civico-italia');
assert.equal(civico.officialName, 'Progetto Civico Italia');
assert.ok(civico.source === 'real' && civico.verified === false && civico.verificationStatus === 'in-attesa-di-conferma' && civico.verifiedAt === null && /^\d{4}-\d{2}-\d{2}$/.test(civico.transcribedAt) && civico.verificationNote, 'Progetto Civico Italia è dichiarato, non verificato.');
for (const key of ['abbreviation', 'color', 'politicalPosition', 'website', 'factualDescription', 'foundedAt', 'registeredAt', 'logoUrl', 'logoAsset']) assert.equal(civico[key], null, `Progetto Civico Italia: ${key} non inventato.`);
assert.deepEqual(civico.leadership, [], 'Nessun leader inventato.');
assert.ok(isSelectableParty(civico), 'È un partito giocabile, come gli altri.');
const aggregate = await read('database.json');
assert.deepEqual(aggregate.parties.find(item => item.id === civico.id), civico, 'L’aggregato dei dati reali contiene lo stesso record.');
assert.equal(aggregate.parties.length, parties.length);
assert.equal(aggregate.manifest.scenarioDate, '2026-10-26'); const manifest = await read('manifest.json');
assert.equal(manifest.scenarioDate, '2026-10-26', 'Le nuove carriere partono il 26 ottobre 2026.');
assert.equal(new Date('2026-10-26T00:00:00Z').getUTCDay(), 1, 'È un lunedì.');
assert.equal(manifest.collections.realPolls, polls.length); assert.equal(manifest.collections.parties, parties.length);
// the earlier polls are untouched
assert.deepEqual(polls.map(item => item.id), ['poll-supermedia-youtrend-agi-2026-09-24', 'poll-supermedia-youtrend-agi-2026-10-01', 'poll-bidimedia-2026-10-21'], 'Lo storico resta.');
const { computeDataVersion, currentDataVersion } = await import('./lib/data-version.mjs');
assert.equal(await currentDataVersion(), await computeDataVersion(), 'Il timbro dei dati segue il loro contenuto.');

// ---------- 2. in the game ----------
const digest = async () => { const hash = createHash('sha256'); for (const name of (await readdir(dir)).filter(item => item.endsWith('.json')).sort()) hash.update(name).update(await readFile(new URL(name, dir))); return hash.digest('hex'); };
const before = await digest();
const opening = world => world.polls.find(item => item.source === 'real');
const run = await startCareer({ seed: 'bidimedia', level: 'deputato', partyId: 'party-futuro-nazionale', fast: true });
const { store } = run;
let world = store.getState().world;
assert.equal(store.startDate(), '2026-10-26', 'La data di avvio predefinita è il 26 ottobre 2026.');
assert.equal(store.getState().clock.currentDate, '2026-10-26');
const first = opening(world);
assert.equal(first.real.id, poll.id, 'La prima rilevazione è BiDiMedia.');
assert.equal(first.real.verificationStatus, 'in-attesa-di-conferma'); assert.equal(first.real.verifiedAt, null);
assert.deepEqual([first.real.publishedAt, first.real.fieldworkFrom, first.real.fieldworkTo], ['2026-10-22', '2026-10-17', '2026-10-19'], 'Date originali conservate.');
assert.equal(first.results.filter(row => row.real).length, 19, 'Diciannove forze reali.');
for (const [id, share] of EXPECTED) {
  const row = first.results.find(item => item.partyId === id);
  assert.ok(row?.real, `${id}: riga reale.`); assert.equal(row.share, share, `${id}: ${share}%.`);
}
assert.equal(first.others, 1.4, 'Altri: 1,4.');
assert.ok(!world.parties.some(party => /altra lista|casa riformista/i.test(`${party.label} ${party.officialName}`)), 'Né «un’altra lista» né Casa Riformista sono partiti nel mondo.');
assert.equal(world.parties.find(party => party.id === 'party-registro-p1-2019-52-ir').label, 'Italia Viva', 'Italia Viva ha la sua identità.');
const pci = world.parties.find(party => party.id === 'party-progetto-civico-italia');
assert.ok(pci && pci.label === 'Progetto Civico Italia' && pci.officialName === 'Progetto Civico Italia', 'Progetto Civico Italia è nel mondo con il suo nome.');
assert.equal(Math.round((first.results.filter(row => !row.outsideSource).reduce((sum, row) => sum + row.share, 0) + first.others) * 10) / 10, 100, 'Il totale è 100.');
assert.equal(first.sample, null); assert.equal(first.margin, null);
for (let week = 1; week <= 6; week++) {
  store.advance(7); world = store.getState().world;
  const current = world.polls.at(-1);
  assert.equal(current.source, 'simulation', `Settimana ${week}: sondaggio simulato.`);
  for (const row of current.results) assert.ok(Number.isFinite(row.share) && row.share >= 0, `Settimana ${week}: valori validi (${row.partyId}).`);
  assert.ok(current.results.some(row => row.partyId === 'party-progetto-civico-italia'), `Settimana ${week}: Progetto Civico Italia resta nei sondaggi.`);
}
assert.equal(opening(world).real.id, poll.id, 'Il dato reale resta nello storico del mondo.');
// a career that starts earlier keeps the earlier poll
const eve = await startCareer({ seed: 'bidimedia-vigilia', level: 'deputato', partyId: 'party-futuro-nazionale', fast: true, startDate: '2026-10-21' });
assert.equal(opening(eve.store.getState().world).real.id, 'poll-supermedia-youtrend-agi-2026-10-01', 'Il 21 ottobre vale ancora la Supermedia di ottobre.');
assert.equal(opening(eve.store.getState().world).results.find(row => row.partyId === 'party-progetto-civico-italia'), undefined, 'E non c’è Progetto Civico Italia nei dati di allora.');
assert.equal(await digest(), before, 'I JSON reali sono identici prima e dopo: nulla di simulato vi è confluito.');
console.log('Sondaggio BiDiMedia di ottobre 2026: diciannove forze e «Altri» 1,4 (totale 100), ID tutti esistenti senza duplicati (Casa Riformista → Italia Viva, AVS, Avanti–PSI → PSI dichiarato come assunzione), Progetto Civico Italia giocabile con il solo nome e in attesa di conferma, date e fonte originali, nessun dato dichiarato verificato né inventato, inizio predefinito lunedì 26/10/2026 con BiDiMedia, il 21/10 ancora la Supermedia di ottobre, storico intatto.');
