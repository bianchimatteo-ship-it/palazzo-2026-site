// The national cycle: the real map of 2022, the calendar of the legislature and of the European elections,
// coalitions and national campaign, the vote on the map (and its thresholds), the new Chambers and their groups, the
// formation of the Government (and its failures), the store end to end (vote → Chambers → groups → Government →
// world), crises in a legislature of the game, European elections, saves and old saves, the national view.
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
assert.deepEqual([politiche.electionDate, europee.electionDate], ['2027-09-26', '2029-06-10'], 'Il calendario della carriera segue quello nazionale reale.');
assert.equal(politiche.windowOpensAt, '2027-08-08', 'Le candidature si aprono sette settimane prima del voto.');
// A save made with the accelerated calendar moves to the real one, keeping the ids of its entries.
const old = structuredClone(game);
delete old.flags.nationalCalendar;
old.elections = old.elections.map(item => ['politiche', 'europee'].includes(item.type) ? { ...item, windowOpensAt: '2027-01-01', windowClosesAt: '2027-01-15', electionDate: '2027-02-19' } : item);
const aligned = C.normalizeGameState(old);
assert.equal(aligned.elections.find(item => item.id === politiche.id).electionDate, '2027-09-26', 'Un vecchio salvataggio passa al calendario reale.');
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
assert.equal(chambers.government.status, 'caretaker', 'Il governo uscente resta per gli affari correnti.');
assert.ok(chambers.laws.every(law => law.stage === 'lapsed') && chambers.legislature.number === 20 && chambers.pastLegislatures.length === 1, 'Le proposte decadono, si apre la XX legislatura.');
assert.ok(chambers.player === null && chambers.pastMandates.length === 1 && chambers.previousPlayer.chamber === 'camera', 'Il vecchio seggio si chiude.');
const seated = L.seatPlayer(chambers, { politicianId: 'p', chamber: 'camera', groupId: L.groupOfParty(chambers, 'camera', ids.FDI).groupId, date: '2022-09-25' });
assert.equal(seated.player.mandateStartedAt, '2022-10-13', 'Rieletto nella stessa Camera: il mandato prosegue.');
let formation = L.startFormation(vote22, { date: '2022-09-25', number: 20 });
const phases = [];
const events = [];
for (let week = 1; week <= 12 && !['completata', 'fallita'].includes(formation.phase); week++) {
  const out = L.formationStep({ formation, parliament: chambers, result: vote22, world: world22, date: new Date(Date.parse('2022-09-25T12:00:00Z') + week * 7 * 86400000).toISOString().slice(0, 10), playerRole: {}, labelOf: id => id });
  formation = out.formation; chambers = out.parliament; events.push(...out.events);
  if (!phases.includes(formation.phase)) phases.push(formation.phase);
}
assert.deepEqual(phases, ['insediamento', 'consultazioni', 'fiducia', 'completata'], 'Prima seduta, consultazioni, giuramento e fiducia.');
assert.ok(chambers.government.status === 'active' && chambers.government.majorityKind === 'coalizione' && chambers.pastGovernments.some(item => item.id === 'g1' && item.status === 'concluded'), 'Governo della coalizione vincente in carica; quello uscente concluso.');
assert.ok(chambers.government.ministers.length >= 14 && new Set(chambers.government.ministers.map(item => item.groupId)).size >= 4, 'Ministeri ai gruppi della maggioranza, in entrambe le Camere.');
assert.ok(chambers.government.stability >= 62, 'Dopo il voto il governo parte con credito.');
// The player leads the winning party: the mandate is offered; accepted, the Government is the player's.
formation = L.startFormation(vote22, { date: '2022-09-25', number: 20 });
chambers = L.openLegislature(base, { result: vote22, number: 20, date: '2022-09-25', groups, world: world22 });
let offered = null;
for (let week = 1; week <= 6 && !offered; week++) {
  const out = L.formationStep({ formation, parliament: chambers, result: vote22, world: world22, date: new Date(Date.parse('2022-09-25T12:00:00Z') + week * 7 * 86400000).toISOString().slice(0, 10), playerRole: { secretaryOf: ids.FDI, seated: true, seatsOf: () => 100 }, labelOf: id => id });
  formation = out.formation; chambers = out.parliament; offered = out.events.find(event => event.id === 'incarico-governo') ?? null;
}
assert.ok(offered && formation.phase === 'incarico', 'Al segretario del primo partito della coalizione vincente arriva l’incarico.');
const accepted = L.acceptMandate({ formation, parliament: chambers, date: '2022-10-20' });
assert.ok(accepted.parliament.government.formedBy === 'player' && accepted.parliament.government.status === 'awaiting-confidence' && accepted.formation.playerAccepted, 'Accettato l’incarico, il governo è del giocatore.');
// No majority at all: the President dissolves the Chambers.
const hung = { ...vote22, winner: null, coalitions: [] };
formation = { ...L.startFormation(hung, { date: '2022-09-25', number: 20 }), excluded: [ids.FDI, ids.PD] };
chambers = L.openLegislature(base, { result: hung, number: 20, date: '2022-09-25', groups, world: world22 });
let dissolved = false;
for (let week = 1; week <= 6 && !dissolved; week++) {
  const out = L.formationStep({ formation, parliament: chambers, result: hung, world: world22, date: new Date(Date.parse('2022-09-25T12:00:00Z') + week * 7 * 86400000).toISOString().slice(0, 10), labelOf: id => id });
  formation = out.formation; chambers = out.parliament; dissolved = Boolean(out.dissolve);
}
assert.ok(dissolved, 'Senza alcuna maggioranza le Camere vengono sciolte.');
// European elections: 76 seats, 4% threshold, five circoscrizioni.
const eu = L.runEuropeanVote({ geography, world: world26, date: '2029-06-10', noise: false });
assert.equal(eu.national.reduce((sum, row) => sum + row.seats, 0), 76);
assert.ok(eu.national.every(row => row.seats === 0 || row.share >= 4) && eu.areas.length === 5 && eu.areas.reduce((sum, area) => sum + area.seats, 0) === 76, 'Europee: soglia del 4% e cinque circoscrizioni.');

// ---------- 5. the store end to end ----------
const { store } = await import(`../src/core/store.js${v}&legislatura=1`);
store.setRealReference({ twoPerThousand: db().twoPerThousand, parties: db().parties, movements: db().politicalMovements, coalitions: db().coalitions, polls: db().realPolls, startDate: db().manifest.snapshotDate, governingIds: links.governingEntityIds(db()) });
store.setReferenceGovernment(govRef.referenceGovernmentSpec(db()));
store.setElectoralGeography(geography);
// A founder and secretary: decides the coalition and the line, heads the lists.
store.createCareer({ firstName: 'Nora', lastName: 'Nazionale', birthDate: '1978-02-02', gender: 'donna', region: 'Lombardia', municipality: 'Bergamo', municipalityCode: '016024', previousProfession: 'Economista', initialLevel: 'deputato', parliamentaryGroupId: 'cam-xix-02', parliamentStartMode: 'real-context', partyMode: 'new', partyName: 'Movimento Nazionale di prova', partyAbbreviation: 'MNP', partyColor: '#2a6f97', partyDescription: 'Partito del test del ciclo nazionale.', partyOrientation: 'Altro', partyPosition: 'centro-destra', partyProgram: ['lavoro'], policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, db().parties, db().parliamentaryGroups);
let state = store.getState();
assert.equal(state.version, 9);
assert.ok(state.national && state.national.legislature.number === 19 && state.national.legislature.reference === 'real', 'La carriera parte nella XIX legislatura reale.');
const { renderElectionsHub } = await import(`../src/ui/elections-hub.js${v}`);
const hub = () => renderElectionsHub(store.getState(), { parties: db().parties, logoFor: () => null, tab: 'nazionali', national: () => store.nationalOverview(), geography });
let html = hub();
clean(html, 'Nazionali (inizio)');
for (const text of ['CALENDARIO NAZIONALE', 'Chi corre con chi', 'SE SI VOTASSE OGGI', 'Dove voti tu', 'I collegi uninominali regione per regione', 'Cosa è reale e cosa è simulato']) assert.ok(html.includes(text), `Nazionali: manca «${text}».`);
assert.ok(store.nationalOverview().projection.camera.total === 400, 'La proiezione usa la mappa reale.');
const give = () => { const s = store.getState(); s.game.week.ap = Math.max(s.game.week.ap, 6); s.game.resources.politicalCapital = Math.max(s.game.resources.politicalCapital, 45); if (s.game.party?.org) s.game.party.org.treasury.balance = Math.max(s.game.party.org.treasury.balance, 20000); };
const seen = { coalitionEvent: false, line: false, campaign: false, fixed: false };
for (let week = 0; week < 80 && !store.getState().national.lastPolitiche; week++) {
  state = store.getState();
  for (const item of [...state.game.inbox]) {
    if (item.templateId === 'coalizioni-politiche') seen.coalitionEvent = true;
    try { give(); store.resolveAgendaItem(item.id, item.templateId === 'coalizioni-politiche' ? 'aderisci' : item.defaultChoice); } catch { /* not this week */ }
  }
  state = store.getState();
  if (state.national.campaign && !seen.line) { give(); store.setNationalCampaignLine('coalizione'); seen.line = store.getState().national.campaign.line === 'coalizione'; clean(hub(), 'Nazionali (campagna)'); }
  if (state.national.campaign?.fixed) seen.fixed = true;
  const open = state.game.elections.find(item => item.status === 'open' && item.type === 'politiche');
  if (open && !seen.campaign && state.campaign?.status !== 'active') {
    give();
    store.startCampaign({ electionType: 'politiche', role: 'uninominale', objective: 'seat' }, db().parties, { politicians: db().politicians, groups: db().parliamentaryGroups });
    const campaign = store.getState().campaign;
    assert.equal(campaign.candidacy.listPosition, 1, 'Il fondatore guida le liste del proprio partito.');
    seen.campaign = true;
  }
  if (store.getState().campaign?.status === 'active') { for (let day = 0; day < 60 && store.getState().campaign.status === 'active'; day++) store.advance(1); continue; }
  store.advance(7);
}
state = store.getState();
assert.ok(seen.coalitionEvent && seen.line && seen.campaign, 'Il segretario sceglie coalizione e linea, poi si candida.');
const vote = state.national.lastPolitiche;
assert.ok(vote && vote.id === `politiche-${vote.date}` && isSunday(vote.date) && vote.model === 'geografia-2022', 'Il voto si tiene di domenica sulla mappa reale.');
assert.ok(state.national.legislature.number === 20 && state.game.legislature.number === 20 && state.parliament.legislature.number === 20 && state.parliament.legislature.reference === 'simulation', 'Si apre la XX legislatura (simulata), uguale per carriera, Parlamento e ciclo nazionale.');
for (const chamber of ['camera', 'senato']) assert.equal(state.parliament.chambers[chamber].groups.reduce((sum, group) => sum + group.simulatedSeats, 0), chamber === 'camera' ? 400 : 200, `Nuova ${chamber}: gruppi dal voto.`);
const report = state.career.lastElectionReport;
assert.ok(report && report.electionType === 'politiche' && report.groups.some(row => row.player) && report.territories.length === 20 && /2022/.test(report.seatRule), 'Il resoconto della campagna usa il voto nazionale (liste, regioni, regola dei seggi).');
assert.ok(['vittoria', 'eletto-proporzionale', 'eletto-lista', 'sotto-soglia', 'posizione-lista', 'sconfitta'].includes(report.outcome.code), 'Esito personale dal voto sulla mappa.');
if (report.personalMandate) {
  assert.ok(state.parliament.player?.groupId?.startsWith('leg20-') && state.career.parliamentContext.groupId === state.parliament.player.groupId, 'Eletto: siede con il gruppo del proprio partito nella nuova legislatura.');
} else assert.ok(!state.parliament.player && !state.career.parliamentContext, 'Non eletto: nessun seggio nella nuova legislatura.');
assert.ok(['caretaker', 'fallen', undefined].includes(state.parliament.government?.status) || state.national.formation.phase !== 'insediamento', 'Dopo il voto il governo uscente resta per gli affari correnti.');
assert.ok(state.game.elections.some(item => item.type === 'politiche' && item.status === 'upcoming' && item.electionDate > '2032-01-01'), 'Le prossime politiche sono a fine legislatura.');
html = hub();
clean(html, 'Nazionali (dopo il voto)');
assert.ok(html.includes('RISULTATO SIMULATO') && html.includes('FORMAZIONE DEL GOVERNO'), 'Nazionali: risultato e formazione.');
// The formation, week by week, until a Government has the confidence (or the Chambers are dissolved).
for (let week = 0; week < 16 && !['completata', 'fallita'].includes(store.getState().national.formation.phase); week++) {
  for (const item of [...store.getState().game.inbox]) { try { give(); store.resolveAgendaItem(item.id, item.defaultChoice); } catch { /* not this week */ } }
  const s = store.getState();
  if (s.national.formation.playerAccepted && s.parliament.government?.status === 'awaiting-confidence') { give(); store.voteGovernmentConfidence(); }
  store.advance(7);
}
state = store.getState();
const formed = state.national.formation;
assert.ok(['completata', 'fallita'].includes(formed.phase), `La formazione si conclude (${formed.phase}).`);
if (formed.phase === 'completata') {
  const government = state.parliament.government;
  assert.ok(government.status === 'active' && government.legislature === 20, 'Il nuovo governo ha la fiducia.');
  const governing = state.world.parties.filter(party => party.governing).map(party => party.id);
  assert.deepEqual([...governing].sort(), [...new Set(formed.majority.partyIds.filter(id => state.world.parties.some(party => party.id === id && party.active)))].sort(), 'Nel mondo politico governano i partiti della nuova maggioranza.');
} else assert.ok(state.game.elections.some(item => item.type === 'politiche' && item.early && item.status !== 'held'), 'Camere sciolte: politiche anticipate in calendario.');
const { renderParliamentPage } = await import(`../src/ui/parliament-mode.js${v}`);
const { renderHemicycle } = await import(`../src/ui/hemicycle-view.js${v}`);
const government = renderParliamentPage('governo', state, { politicians: db().politicians, secretary: true });
clean(government, 'Governo');
const parliamentHtml = renderParliamentPage('parlamento', state, { politicians: db().politicians, hemicycle: renderHemicycle(state, { politicians: db().politicians, db: db() }) });
clean(parliamentHtml, 'Parlamento');
assert.ok(parliamentHtml.includes('LEGISLATURA SIMULATA') && !parliamentHtml.includes('componenti nel dato reale'), 'Le nuove Camere sono dichiarate simulate, senza riferimenti reali.');
assert.ok(!db().politicians.some(person => parliamentHtml.includes(person.fullName) && person.fullName.length > 8), 'Nessun parlamentare reale siede nella legislatura simulata.');

// A crisis in a legislature of the game: consultations in the same Chambers, not automatic early elections.
if (formed.phase === 'completata') {
  const s = store.getState();
  s.parliament.government.status = 'fallen';
  s.parliament.government.fallenAt = s.clock.currentDate;
  const fallenName = s.parliament.government.name;
  for (let week = 0; week < 8 && !(store.getState().national.formation.crisis && ['completata', 'fallita'].includes(store.getState().national.formation.phase)); week++) {
    for (const item of [...store.getState().game.inbox]) { try { give(); store.resolveAgendaItem(item.id, item.defaultChoice); } catch { /* not this week */ } }
    const now = store.getState();
    if (now.national.formation.playerAccepted && now.parliament.government?.status === 'awaiting-confidence') { give(); store.voteGovernmentConfidence(); }
    store.advance(7);
  }
  const after = store.getState();
  assert.ok(after.national.formation.crisis, 'La caduta apre le consultazioni nelle stesse Camere.');
  assert.ok(after.national.formation.phase === 'fallita' ? after.game.elections.some(item => item.early && item.status !== 'held') : after.parliament.government.status === 'active' && after.parliament.government.name !== fallenName, 'Nasce un nuovo governo, oppure si torna al voto.');
  assert.equal(after.parliament.legislature.number, 20, 'La crisi non cambia legislatura.');
}

// Saves: the national cycle survives a reload; an old save (version 8) receives it and the real calendar.
store.save();
const saved = JSON.parse(mem.get(KEY));
assert.ok(saved.version === 9 && saved.national.lastPolitiche && JSON.stringify(saved.national).length < 60000, 'Il ciclo nazionale è nel salvataggio, compatto.');
const reloaded = (await import(`../src/core/store.js${v}&legislatura=2`)).store.getState();
assert.equal(reloaded.national.lastPolitiche.id, vote.id);
assert.equal(reloaded.national.legislature.number, 20);
const legacy = structuredClone(saved);
legacy.version = 8;
delete legacy.national;
delete legacy.game.flags.nationalCalendar;
mem.set(KEY, JSON.stringify(legacy));
const migrated = (await import(`../src/core/store.js${v}&legislatura=3`)).store.getState();
assert.ok(migrated.version === 9 && migrated.national.legislature.number === migrated.game.legislature.number && migrated.game.flags.nationalCalendar === 2, 'Un salvataggio precedente riceve il ciclo nazionale.');
assert.ok(mem.get(`${KEY}.backup`), 'Il salvataggio precedente è conservato prima dell’aggiornamento.');

// ---------- 6. without the player: missed politiche and the European elections of 2029 ----------
mem.delete(KEY);
const { store: quiet } = await import(`../src/core/store.js${v}&legislatura=4`);
quiet.setRealReference({ twoPerThousand: db().twoPerThousand, parties: db().parties, movements: db().politicalMovements, coalitions: db().coalitions, polls: db().realPolls, startDate: db().manifest.snapshotDate, governingIds: links.governingEntityIds(db()) });
quiet.setElectoralGeography(geography);
quiet.createCareer({ firstName: 'Lia', lastName: 'Locale', birthDate: '1985-05-05', gender: 'donna', region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', previousProfession: 'Medica', initialLevel: 'comunale', partyMode: 'existing', partyId: ids.PD }, db().parties, db().parliamentaryGroups);
for (let week = 0; week < 150 && !quiet.getState().national.lastEuropee; week++) {
  for (const item of [...quiet.getState().game.inbox]) { try { quiet.resolveAgendaItem(item.id, item.defaultChoice); } catch { /* not this week */ } }
  quiet.advance(7);
}
const q = quiet.getState();
assert.ok(q.national.votes.some(item => item.type === 'politiche') && q.national.legislature.number >= 20, 'Senza candidarsi il Paese vota comunque: nuove Camere.');
assert.ok(q.national.lastEuropee?.date === '2029-06-10' && q.national.lastEuropee.national.reduce((sum, row) => sum + row.seats, 0) === 76, 'Europee del 2029 con 76 seggi.');
assert.ok(q.game.elections.some(item => item.type === 'europee' && item.status === 'upcoming' && item.electionDate.startsWith('2034-06')), 'Prossime europee nel 2034.');
clean(renderElectionsHub(q, { parties: db().parties, logoFor: () => null, tab: 'nazionali', national: () => quiet.nationalOverview(), geography, nationalView: 'voto' }), 'Nazionali (europee)');

console.log(`Ciclo nazionale verificato: mappa reale 2022 (147 + 74 collegi, ${Object.keys(geography.comuni).length} comuni), calendario (XIX legislatura al voto il 26/09/2027, europee 2029 e 2034, ciclo quinquennale, scioglimento di domenica), voto sulla mappa (2022 riprodotto: ${vote22.camera.collegi.filter(row => row.f && same(row)).length}/147 collegi, seggi proporzionali entro 2), soglie e minoranze, gruppi e Misto, formazione (${phases.join(' → ')}), incarico al giocatore, scioglimento, store (${report.outcome.code}, XX legislatura, governo ${formed.phase}), crisi con consultazioni, salvataggi e migrazione, europee senza il giocatore, viste Nazionali, Governo, Parlamento ed emiciclo.`);
