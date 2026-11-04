// Consenso dei partiti autonomi alle consultazioni: nessun ingresso automatico in maggioranza; coalizione ed esterno distinti; la risposta è registrata e vince sul default.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const KEY = 'palazzo-2026.career.v1';
const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
// The same module instances the game uses (every import carries the build version of index.html).
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const realData = await import(`../src/data/repositories/real-data.js${v}`);
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'coalitions', 'twoPerThousand', 'realPolls', 'parliamentaryGroups', 'politicians', 'government', 'politicalFigures', 'electoralLists', 'partyMemberships']);
const geography = await realData.loadRealDocument('electoralGeography');
const db = () => realData.realDatabase;
const L = await import(`../src/core/legislature-engine.js${v}`);
const W = await import(`../src/core/world-engine.js${v}`);
const C = await import(`../src/core/career-engine.js${v}`);
const links = await import(`../src/data/repositories/party-links.js${v}`);
const govRef = await import(`../src/data/repositories/government-reference.js${v}`);
const clean = (html, where) => { const bad = html.replace(/data-[a-z-]+="[^"]*"/g, '').match(/.{0,60}(undefined|NaN|\[object Object\]).{0,60}/); assert.ok(!bad, `${where}: valori non validi (${bad?.[0]})`); };
const isSunday = date => new Date(`${date}T12:00:00Z`).getUTCDay() === 0;

// ---------- 1. the real map of 2022 ----------
assert.equal(geography.source, 'real');
assert.ok(geography.verified === true && /^https:\/\/elezioni\.interno\.gov\.it/.test(geography.sourceUrl) && geography.verifiedAt, 'Mappa elettorale con fonte ufficiale e data di verifica.');
assert.equal(geography.camera.collegi.length, 147, 'Camera: 147 collegi uninominali.');
assert.equal(geography.senato.collegi.length, 74, 'Senato: 74 collegi uninominali.');
assert.deepEqual([geography.camera.seats.total, geography.camera.seats.proporzionali, geography.camera.seats.estero], [400, 245, 8]);
assert.deepEqual([geography.senato.seats.total, geography.senato.seats.proporzionali, geography.senato.seats.estero], [200, 122, 4]);
assert.equal(geography.camera.plurinominali.length, L.LEGISLATURE_RULES.plurinominali.camera);
assert.equal(geography.senato.plurinominali.length, L.LEGISLATURE_RULES.plurinominali.senato);
assert.equal(db().manifest.documents.electoralGeography.collegi.camera, 147, 'Il manifest dichiara il documento della mappa.');
// Every comune of the ISTAT list has its districts.
assert.ok(Object.keys(geography.comuni).length === db().manifest.documents.electoralGeography.comuni, 'Ogni comune ISTAT è ricondotto ai suoi collegi.');
const home = L.homeDistricts(geography, { municipalityCode: '016024', region: 'Lombardia', seed: 'prova' });
assert.ok(home.camera.region === 'Lombardia' && home.senato.region === 'Lombardia' && !home.approximate, 'Bergamo ha i suoi collegi reali di Camera e Senato.');

// ---------- 2. calendar ----------
const term = L.legislatureTerm({ number: 19, firstSitting: '2022-10-13' });
assert.deepEqual([term.firstSitting, term.naturalEnd, term.plannedVote], ['2022-10-13', '2027-10-12', '2027-09-26'], 'XIX legislatura: prima seduta 13/10/2022, scadenza 12/10/2027, voto domenica 26/09/2027.');
assert.ok(isSunday(term.plannedVote));
assert.equal(L.europeanElectionDate('2026-09-25'), '2029-06-10', 'Europee nel 2029 (seconda domenica di giugno, simulata).');
const nextEU = L.europeanElectionDate('2029-06-10');
assert.ok(nextEU.startsWith('2034-06') && isSunday(nextEU), 'Poi ogni cinque anni.');
const next = L.legislatureTerm({ number: 20, since: '2027-09-26' });
assert.equal(next.firstSitting, '2027-10-14', 'Le nuove Camere si riuniscono 18 giorni dopo il voto.');
assert.ok(next.plannedVote.startsWith('2032-09') && isSunday(next.plannedVote), 'Ciclo quinquennale: politiche successive a fine settembre 2032.');
const game = C.createGameState({ seedText: 'calendario', currentDate: '2026-09-25', level: 'comunale', party: null, place: { region: 'Toscana', municipality: 'Siena' } });
const politiche = game.elections.find(item => item.type === 'politiche');
const europee = game.elections.find(item => item.type === 'europee');
// The natural date of the vote is the real one (26/09/2027); the calendar may put it off inside the 70 days of art. 61 so that it keeps 180 days from the other votes of the career.
assert.equal(politiche.baseDate, '2027-09-26', 'Il calendario della carriera parte da quello nazionale reale.');
assert.ok(politiche.electionDate >= '2027-09-26' && politiche.electionDate <= '2027-12-21' && isSunday(politiche.electionDate), `Le politiche restano nei 70 giorni dell’art. 61 (${politiche.electionDate}).`);
assert.equal(europee.electionDate, '2029-06-10', 'Le europee restano il 10 giugno 2029.');
assert.equal(politiche.windowOpensAt, new Date(Date.parse(`${politiche.electionDate}T12:00:00Z`) - 49 * 86400000).toISOString().slice(0, 10), 'Le candidature si aprono sette settimane prima del voto.');
// A save made with the accelerated calendar moves to the real one, keeping the ids of its entries.
const old = structuredClone(game);
delete old.flags.nationalCalendar;
old.elections = old.elections.map(item => ['politiche', 'europee'].includes(item.type) ? { ...item, windowOpensAt: '2027-01-01', windowClosesAt: '2027-01-15', electionDate: '2027-02-19' } : item);
const aligned = C.normalizeGameState(old);
assert.equal(aligned.elections.find(item => item.id === politiche.id).baseDate ?? aligned.elections.find(item => item.id === politiche.id).electionDate, '2027-09-26', 'Un vecchio salvataggio passa al calendario reale.');
assert.equal(aligned.flags.nationalCalendar, 2);
const early = C.scheduleEarlyElection(game, '2027-01-07');
const earlyEntry = early.elections.find(item => item.type === 'politiche');
assert.ok(earlyEntry.early && isSunday(earlyEntry.electionDate) && earlyEntry.electionDate > '2027-02-20' && earlyEntry.electionDate < '2027-03-10', 'Scioglimento: politiche anticipate di domenica, dopo la campagna.');

// ---------- 3. the vote on the map: 2022 reproduced ----------
const parties = new Map([...db().parties, ...db().coalitions].map(item => [item.id, item]));
const ids = { FDI: 'party-registro-p1-2014-04-ir', PD: 'party-registro-p1-2015-29-ir', M5S: 'party-registro-p1-2022-63-ir', LEGA: 'party-registro-p1-2017-41-ir', FI: 'party-registro-p1-2015-20-ir', AZ: 'party-registro-p1-2019-51-ir', IV: 'party-registro-p1-2019-52-ir', AVS: 'coalition-alleanza-verdi-sinistra', PE: 'party-registro-p1-2018-47-ir', NM: 'party-registro-p1-2020-56-ir', SCN: 'party-registro-p1-2022-67-ir' };
const worldOf = (shares, governing = []) => W.createWorld({ seedText: 'verifica', date: '2026-09-24', forces: Object.entries(shares).map(([key, share]) => ({ id: ids[key], label: key, share, position: parties.get(ids[key])?.politicalPosition ?? null, governing: governing.includes(key) })), realPoll: null });
const shares2022 = { FDI: 25.99, PD: 19.07, M5S: 15.43, LEGA: 8.77, FI: 8.11, AZ: 4.7, IV: 3.09, AVS: 3.63, PE: 2.83, NM: 0.91, SCN: 0.76 };
const world22 = worldOf(shares2022, ['FDI', 'LEGA', 'FI']);
const coalitions22 = [{ id: 'cdx', label: 'Centrodestra', leaderId: ids.FDI, camp: 'destra', partyIds: [ids.FDI, ids.LEGA, ids.FI, ids.NM] }, { id: 'csx', label: 'Centrosinistra', leaderId: ids.PD, camp: 'sinistra', partyIds: [ids.PD, ids.AVS, ids.PE] }, { id: 'azv', label: 'Azione-IV', leaderId: ids.AZ, camp: 'centro', partyIds: [ids.AZ, ids.IV] }];
const vote22 = L.runNationalVote({ geography, world: world22, coalitions: coalitions22, date: '2022-09-25', noise: false });
const same = (row, chamber) => { const f = row.f; const w = row.w; return (w === 'cdx' && f === 'cdx') || (w === 'csx' && f === 'csx') || (w === ids.M5S && f === 'm5s') || (w === 'lista:SVP' && f === 'SVP') || (w === ids.SCN && f === 'SCN') || (String(w).startsWith('lista:VDA') && f === 'VDAAPF'); };
for (const [chamber, minimum] of [['camera', 144], ['senato', 65]]) {
  const rows = vote22[chamber].collegi.filter(row => row.f);
  const reproduced = rows.filter(row => same(row, chamber)).length;
  assert.ok(reproduced >= minimum, `${chamber}: vincitori 2022 riprodotti ${reproduced}/${rows.length}.`);
  assert.equal(vote22[chamber].total, chamber === 'camera' ? 400 : 200, `${chamber}: tutti i seggi assegnati.`);
  // Proportional seats of every list within two of the real ones of 2022.
  for (const list of geography[chamber].national.lists.filter(item => item.seats > 0 && item.code !== 'SVP')) {
    const forces = L.LIST_FORCES[list.code] ?? [];
    const model = vote22[chamber].parties.filter(row => forces.includes(row.id)).reduce((sum, row) => sum + row.prop, 0);
    assert.ok(Math.abs(model - list.seats) <= 2, `${chamber} · ${list.code}: seggi proporzionali ${model} contro ${list.seats} reali.`);
  }
}
const seatsOf = (result, chamber, id) => result[chamber].coalitions.find(row => row.id === id)?.seats ?? result[chamber].parties.find(row => row.id === id)?.seats ?? 0;
assert.ok(Math.abs(seatsOf(vote22, 'camera', 'cdx') - 237) <= 4 && Math.abs(seatsOf(vote22, 'camera', 'csx') - 85) <= 4 && Math.abs(seatsOf(vote22, 'camera', ids.M5S) - 52) <= 3, 'Camera 2022: coalizioni vicine ai seggi reali (237, 85, 52).');
assert.ok(Math.abs(seatsOf(vote22, 'senato', 'cdx') - 115) <= 5 && Math.abs(seatsOf(vote22, 'senato', 'csx') - 44) <= 4, 'Senato 2022: coalizioni vicine ai seggi reali (115, 44).');
assert.equal(vote22.winner, 'cdx', 'Nel 2022 vince il centrodestra.');
// Thresholds: a list at 2.5% alone gets no proportional seat; inside a coalition over 10% its votes count for the others.
const small = L.runNationalVote({ geography, world: worldOf({ ...shares2022, PE: 2.5 }), coalitions: [coalitions22[0], { ...coalitions22[1], partyIds: [ids.PD, ids.AVS] }, coalitions22[2]], date: '2022-09-25', noise: false });
assert.equal(small.camera.parties.find(row => row.id === ids.PE)?.prop ?? 0, 0, 'Sotto il 3% da sola: nessun seggio proporzionale.');
assert.equal(vote22.camera.parties.find(row => row.id === ids.PE)?.prop ?? 0, 0, 'Sotto il 3% in coalizione: nessun seggio proprio…');
assert.ok(vote22.camera.coalitions.find(row => row.id === 'csx').prop >= small.camera.parties.filter(row => [ids.PD, ids.AVS].includes(row.id)).reduce((sum, row) => sum + row.prop, 0) - 2, '…ma i suoi voti contano per la coalizione.');
assert.ok((vote22.camera.parties.find(row => row.id === 'lista:SVP')?.seats ?? 0) >= 2, 'Minoranza linguistica: SVP passa con il 20% nella regione.');
// The simplified count without the map keeps the same totals and thresholds.
const simple = L.runNationalVote({ geography: null, world: world22, coalitions: coalitions22, date: '2022-09-25', noise: false });
assert.ok(simple.camera.total === 400 && simple.senato.total === 200 && simple.model === 'semplificato', 'Senza la mappa: conteggio semplificato.');

// ---------- 4. coalitions, groups, formation ----------
const world26 = worldOf({ FDI: 27, PD: 20.8, M5S: 12.6, FI: 7.4, AVS: 6.5, LEGA: 5.6, AZ: 3.4, IV: 2.2, PE: 1.5, NM: 1.1, SCN: 1.1 }, ['FDI', 'LEGA', 'FI']);
const coalitions26 = L.buildCoalitions(world26);
const right = coalitions26.find(item => item.leaderId === ids.FDI);
const left = coalitions26.find(item => item.leaderId === ids.PD);
assert.ok(right && left && right.partyIds.includes(ids.LEGA) && right.partyIds.includes(ids.FI) && left.partyIds.includes(ids.AVS), 'Coalizioni attorno al primo partito di ciascun campo.');
assert.ok(!coalitions26.some(item => item.partyIds.includes(ids.FDI) && item.partyIds.includes(ids.PD)), 'Mai i due campi nella stessa coalizione.');
const projection = L.nationalProjection({ geography, world: world26, coalitions: coalitions26, date: '2027-09-26' });
assert.equal(projection.camera.collegi.length, 147);
assert.ok(L.contestedDistricts(projection, 'camera').every(row => row.m < 4), 'Collegi in bilico: margine sotto i 4 punti.');
const compact = L.compactResult(projection);
assert.ok(!Array.isArray(compact.camera.collegi) && L.districtRows(compact, 'camera', geography).length === 147 && L.districtRows(compact, 'camera', geography)[0].id === geography.camera.collegi[0].id, 'Nel salvataggio i collegi sono righe compatte, rilette con la mappa.');
const groups = L.legislatureGroups(vote22, { number: 20, date: '2022-09-25', world: world22 });
for (const chamber of ['camera', 'senato']) assert.equal(groups[chamber].reduce((sum, group) => sum + group.simulatedSeats, 0), chamber === 'camera' ? 400 : 200, `${chamber}: i gruppi coprono tutti i seggi.`);
assert.ok(groups.camera.some(group => group.partyId === ids.FDI && !group.component) && groups.camera.some(group => group.component && /^Misto – /.test(group.officialName)), 'Gruppi dei partiti e componenti del Misto.');
assert.ok(groups.camera.filter(group => !group.component).every(group => group.simulatedSeats >= L.LEGISLATURE_RULES.groups.cameraWaiver), 'Un gruppo proprio richiede i numeri del regolamento semplificato.');
// The Chambers open, the old Government stays for current business, the new one comes from the consultations.
const base = { chambers: { camera: { groups: [{ groupId: 'vecchio', officialName: 'Vecchio gruppo', simulatedSeats: 400 }] }, senato: { groups: [{ groupId: 'vecchio-s', officialName: 'Vecchio gruppo', simulatedSeats: 200 }] } }, government: { id: 'g1', name: 'Governo uscente', status: 'active', coalitionGroupIds: ['vecchio', 'vecchio-s'], supportingGroupIds: [], ministers: [], confidenceVotes: [], partners: {} }, laws: [{ id: 'l1', stage: 'commission' }], history: [], relations: {}, player: { politicianId: 'p', chamber: 'camera', groupId: 'vecchio', mandateStartedAt: '2022-10-13' } };
let chambers = L.openLegislature(base, { result: vote22, number: 20, date: '2022-09-25', groups, world: world22 });
const asPlayer = id => { const w = worldOf(shares2022, ['FDI', 'LEGA', 'FI']); for (const party of w.parties) { party.isPlayer = party.id === id; } return w; };
let checked = 0;
for (const key of ['M5S', 'PD', 'AZ', 'IV', 'AVS', 'PE']) {
  const world = asPlayer(ids[key]);
  const base = { crisis: true, exclude: [ids.FI, ids.NM, ids.LEGA] };
  const free = L.majorityAfterVote(chambers, { ...vote22, winner: null }, world, { ...base, consent: { all: true } });
  if (!free) continue;
  const members = majority => [...majority.partyIds, ...(majority.supportPartyIds ?? [])];
  const restricted = L.majorityAfterVote(chambers, { ...vote22, winner: null }, world, base);
  if (!free || !members(free).includes(ids[key]) || (restricted && members(restricted).includes(ids[key]))) continue;
  // 1. without consent the party is not put in the majority, neither as an ally nor as outside support
  assert.ok(!restricted || !members(restricted).includes(ids[key]), `${key}: senza consenso resta fuori dalla maggioranza.`);
  // 2. joined the coalition: a member, no external flag
  const joined = L.majorityAfterVote(chambers, { ...vote22, winner: null }, world, { ...base, include: [ids[key]] });
  assert.ok(joined && joined.partyIds.includes(ids[key]) && !(joined.supportPartyIds ?? []).includes(ids[key]), `${key}: l’adesione alla coalizione lo rende membro (con i ministri), non sostegno esterno.`);
  // 3. outside support: counted among the supporters, not among the members
  const outside = L.majorityAfterVote(chambers, { ...vote22, winner: null }, world, { ...base, include: [ids[key]], consent: { external: [ids[key]] } });
  assert.ok(outside && !outside.partyIds.includes(ids[key]) && outside.supportPartyIds.includes(ids[key]), `${key}: il sostegno esterno non è un ingresso in coalizione.`);
  assert.ok(outside.groupIds.length >= 1 && L.groupOfParty(chambers, 'camera', ids[key]) && outside.groupIds.includes(L.groupOfParty(chambers, 'camera', ids[key]).groupId), `${key}: il gruppo vota comunque la fiducia (sostegno).`);
  // 4. the electedGovernment keeps the difference between coalition members and external support
  const governmentJoined = L.electedGovernment(chambers, { majority: joined, number: 20, date: '2022-10-20' }).government;
  const governmentOutside = L.electedGovernment(chambers, { majority: outside, number: 20, date: '2022-10-20' }).government;
  const gid = L.groupOfParty(chambers, 'camera', ids[key])?.groupId;
  assert.ok(governmentJoined.coalitionGroupIds.includes(gid) && !governmentJoined.supportingGroupIds.includes(gid), 'Governo: membro della coalizione.');
  assert.ok(governmentOutside.supportingGroupIds.includes(gid) && !governmentOutside.coalitionGroupIds.includes(gid), 'Governo: sostegno esterno, fuori dalla coalizione.');
  // 5. the refusal: explicit exclusion keeps it out even with an alliance-free world
  const refused = L.majorityAfterVote(chambers, { ...vote22, winner: null }, world, { ...base, exclude: [...base.exclude, ids[key]] });
  assert.ok(!refused || !members(refused).includes(ids[key]), `${key}: chi rifiuta resta fuori.`);
  checked++;
  break;
}
assert.ok(checked === 1, 'Almeno un partito con il quale la maggioranza dipende dal consenso è stato verificato.');
console.log('Consenso dei partiti autonomi: nessun ingresso automatico, coalizione ed esterno distinti nel governo, rifiuto rispettato.');
