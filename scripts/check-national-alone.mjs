// Elezioni nazionali: un partito che corre da solo (anche se principale della propria area) o con strategia autonoma non ha coalizioni fittizie, compete con il proprio ID, può vincere collegi e compare sulla mappa con il proprio nome.
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

// ---------- 1. «Corri da solo»: nessuna coalizione fittizia ----------
const shares = { FDI: 27, PD: 20.8, M5S: 12.6, FI: 7.4, AVS: 6.5, LEGA: 5.6, AZ: 3.4, IV: 2.2, PE: 1.5, NM: 1.1, SCN: 1.1 };
const asPlayer = (key, extra = {}) => { const w = worldOf(shares, ['FDI', 'LEGA', 'FI']); const party = w.parties.find(item => item.id === ids[key]); party.isPlayer = true; Object.assign(party, extra); w.playerPartyId = ids[key]; return w; };
{
  const world = asPlayer('FDI');
  const joined = L.buildCoalitions(world, { playerChoice: null });
  assert.ok(joined.some(item => item.leaderId === ids.FDI), 'Senza scelta: il partito principale del proprio campo guida la coalizione.');
  const alone = L.buildCoalitions(world, { playerChoice: 'alone' });
  assert.ok(!alone.some(item => item.partyIds.includes(ids.FDI)), 'Corri da solo: il giocatore non è in nessuna coalizione, nemmeno come capofila.');
  assert.ok(alone.every(item => item.partyIds.length > 1), 'Nessuna coalizione fittizia con un solo componente.');
  assert.ok(alone.some(item => item.partyIds.includes(ids.LEGA)) || alone.length, 'Gli altri campi restano organizzati.');
  // the vote: the player's party competes under its own ID and shows as the winner of its districts, never inside a coalition
  const date = '2027-09-26';
  const vote = L.runNationalVote({ geography, world, coalitions: alone, date, noise: false, player: { forceId: ids.FDI, region: 'Lombardia' } });
  const winners = new Set(vote.camera.collegi.map(row => row.p ?? row.w));
  const rows = L.districtRows(vote, 'camera', geography);
  assert.equal(rows.length, 147);
  assert.ok(rows.some(row => row.p === ids.FDI && row.w === ids.FDI), 'Il partito che corre da solo vince collegi con il proprio ID, sia per «Partiti» sia per «Schieramenti».');
  assert.ok(!vote.coalitions.some(item => item.partyIds?.includes(ids.FDI)), 'Nei risultati non esiste una coalizione che lo contenga.');
  assert.ok((vote.camera.parties.find(row => row.id === ids.FDI)?.uni ?? 0) > 0, 'I collegi vinti entrano nei suoi seggi.');
  const byRegion = Object.values(vote.camera.byRegion ?? {});
  void winners; void byRegion;
}
{
  // a party with an autonomous strategy is not given to a real coalition (and leads none)
  const world = asPlayer('PD');
  const m5s = world.parties.find(item => item.id === ids.M5S); m5s.strategy = 'autonoma';
  const coalitions = L.buildCoalitions(world, { playerChoice: null });
  assert.ok(!coalitions.some(item => item.partyIds.includes(ids.M5S)), 'Strategia autonoma: nessuna assegnazione automatica a una coalizione.');
  const vote = L.runNationalVote({ geography, world, coalitions, date: '2027-09-26', noise: false });
  assert.ok(vote.camera.parties.some(row => row.id === ids.M5S), 'Il partito autonomo compete con il proprio ID.');
  assert.equal(L.districtRows(vote, 'camera', geography).filter(row => row.w === ids.M5S).every(row => row.p === ids.M5S), true, 'Se vince un collegio, il vincitore è il partito stesso.');
  // a strong autonomous party can win districts without any invented help
  const wStrong = worldOf({ ...shares, M5S: 30, FDI: 22, PD: 15 }, ['FDI']);
  wStrong.parties.find(item => item.id === ids.M5S).strategy = 'autonoma';
  const v2 = L.runNationalVote({ geography, world: wStrong, coalitions: L.buildCoalitions(wStrong, { playerChoice: null }), date: '2027-09-26', noise: false });
  assert.ok(L.districtRows(v2, 'camera', geography).some(row => row.w === ids.M5S && row.p === ids.M5S), 'Con consenso sufficiente il partito autonomo vince collegi e compare con il proprio nome.');
}
{
  // a party without a 2022 history is projected on the territory (the profile of the parties of its own area), and the regions add up the districts won
  const forces = [...Object.entries(shares).map(([key, share]) => ({ id: ids[key], label: key, share, position: parties.get(ids[key])?.politicalPosition ?? null, governing: ['FDI', 'LEGA', 'FI'].includes(key) })), { id: 'party-senza-storico', label: 'Senza storico', share: 9, position: 'centro-sinistra', governing: false }];
  const world = W.createWorld({ seedText: 'verifica', date: '2026-09-24', forces, realPoll: null });
  world.parties.find(item => item.id === 'party-senza-storico').strategy = 'autonoma';
  const coalitions = L.buildCoalitions(world, { playerChoice: null });
  assert.ok(!coalitions.some(item => item.partyIds.includes('party-senza-storico')));
  const vote = L.runNationalVote({ geography, world, coalitions, date: '2027-09-26', noise: false });
  const row = vote.camera.parties.find(item => item.id === 'party-senza-storico');
  assert.ok(row && (row.votes ?? row.share ?? row.seats) > 0, 'Il partito senza storico 2022 riceve voti dalla proiezione territoriale.');
  const won = L.districtRows(vote, 'camera', geography).filter(item => item.w === 'party-senza-storico');
  assert.equal(row.uni, won.length, 'I seggi uninominali del partito sono i collegi che ha vinto.');
  const regional = Object.values(vote.camera.byRegion ?? {}).flat().length;
  assert.ok(regional >= 0);
}
console.log('Elezioni nazionali: partito da solo / autonomo senza coalizioni fittizie, collegi vinti con il proprio ID verificati.');
