// The seats of the Chambers on the real map of 2022, in a reduced and deterministic run (no noise, one vote per chamber): proportional, single-member, abroad and territorial seats add up; a list
// with a tiny national percentage holds seats only where the model says so (a territorial list that wins single-member districts, a seat abroad), never a proportional seat under the thresholds;
// percentages, votes, seats and the summaries by party and by coalition say the same thing.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const realData = await import(`../src/data/repositories/real-data.js${v}`);
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'coalitions', 'twoPerThousand', 'realPolls', 'parliamentaryGroups', 'politicians', 'government', 'politicalFigures', 'electoralLists', 'partyMemberships']);
const geography = await realData.loadRealDocument('electoralGeography');
const db = () => realData.realDatabase;
const L = await import(`../src/core/legislature-engine.js${v}`);
const W = await import(`../src/core/world-engine.js${v}`);
const parties = new Map([...db().parties, ...db().coalitions].map(item => [item.id, item]));
const ids = { FDI: 'party-registro-p1-2014-04-ir', PD: 'party-registro-p1-2015-29-ir', M5S: 'party-registro-p1-2022-63-ir', LEGA: 'party-registro-p1-2017-41-ir', FI: 'party-registro-p1-2015-20-ir', AZ: 'party-registro-p1-2019-51-ir', IV: 'party-registro-p1-2019-52-ir', AVS: 'coalition-alleanza-verdi-sinistra', PE: 'party-registro-p1-2018-47-ir', NM: 'party-registro-p1-2020-56-ir', SCN: 'party-registro-p1-2022-67-ir' };
const worldOf = (shares, governing = []) => W.createWorld({ seedText: 'verifica', date: '2026-09-24', forces: Object.entries(shares).map(([key, share]) => ({ id: ids[key], label: key, share, position: parties.get(ids[key])?.politicalPosition ?? null, governing: governing.includes(key) })), realPoll: null });
const shares2022 = { FDI: 25.99, PD: 19.07, M5S: 15.43, LEGA: 8.77, FI: 8.11, AZ: 4.7, IV: 3.09, AVS: 3.63, PE: 2.83, NM: 0.91, SCN: 0.76 };
const world22 = worldOf(shares2022, ['FDI', 'LEGA', 'FI']);
const coalitions22 = [{ id: 'cdx', label: 'Centrodestra', leaderId: ids.FDI, camp: 'destra', partyIds: [ids.FDI, ids.LEGA, ids.FI, ids.NM] }, { id: 'csx', label: 'Centrosinistra', leaderId: ids.PD, camp: 'sinistra', partyIds: [ids.PD, ids.AVS, ids.PE] }, { id: 'azv', label: 'Azione-IV', leaderId: ids.AZ, camp: 'centro', partyIds: [ids.AZ, ids.IV] }];
const vote = L.runNationalVote({ geography, world: world22, coalitions: coalitions22, date: '2022-09-25', noise: false });
const again = L.runNationalVote({ geography, world: world22, coalitions: coalitions22, date: '2022-09-25', noise: false });
assert.deepEqual(vote.camera.parties.map(row => [row.id, row.seats]), again.camera.parties.map(row => [row.id, row.seats]), 'Lo stesso voto dà gli stessi seggi.');

const EXPECTED = { camera: { total: 400, uni: 147, prop: 245, estero: 8 }, senato: { total: 200, uni: 74, prop: 122, estero: 4 } };
const territorial = row => String(row.id).startsWith('lista:');
for (const chamber of ['camera', 'senato']) {
  const result = vote[chamber], expect = EXPECTED[chamber];
  const sum = key => result.parties.reduce((acc, row) => acc + row[key], 0);
  assert.equal(result.total, expect.total, `${chamber}: ${expect.total} seggi.`);
  assert.equal(sum('seats'), expect.total, `${chamber}: i seggi dei partiti sommano al totale.`);
  assert.equal(sum('uni'), expect.uni, `${chamber}: ${expect.uni} seggi uninominali.`);
  assert.equal(sum('prop'), expect.prop, `${chamber}: ${expect.prop} seggi proporzionali.`);
  assert.equal(sum('estero'), expect.estero, `${chamber}: ${expect.estero} seggi della circoscrizione Estero.`);
  assert.equal(result.collegi.length, expect.uni, `${chamber}: un vincitore per collegio uninominale.`);
  for (const row of result.parties) assert.equal(row.uni + row.prop + row.estero, row.seats, `${chamber} · ${row.id}: uninominali + proporzionali + estero = seggi.`);
  // coalition rows say what their parties say
  for (const coalition of result.coalitions) {
    const members = result.parties.filter(row => row.coalitionId === coalition.id);
    assert.equal(coalition.seats, members.reduce((acc, row) => acc + row.seats, 0), `${chamber} · ${coalition.id}: i seggi della coalizione sono quelli dei suoi partiti.`);
  }
  // no proportional seat under the thresholds: a force under 3% nationally has none (a territorial list reaches them with 20% in its own region)
  for (const row of result.parties) {
    if (territorial(row)) continue;
    if (row.share < 3 && !row.coalitionId) assert.equal(row.prop, 0, `${chamber} · ${row.id}: ${row.share}% da sola non ha seggi proporzionali.`);
    if (row.share < 3) assert.equal(row.prop, 0, `${chamber} · ${row.id}: ${row.share}% non ha seggi proporzionali propri.`);
  }
  // shares are percentages of the same vote: none is negative, together they never exceed 100
  const shares = Object.values(result.shares);
  assert.ok(shares.every(value => value >= 0) && shares.reduce((acc, value) => acc + value, 0) <= 100.5, `${chamber}: le percentuali sono coerenti.`);
}
// a list with a tiny national percentage that holds seats: every one is explained
const explained = [];
for (const chamber of ['camera', 'senato']) {
  for (const row of vote[chamber].parties.filter(item => item.seats > 0 && (item.share ?? 0) < 1)) {
    const why = row.estero > 0 && row.uni + row.prop === 0 ? 'estero' : row.uni > 0 ? 'collegi uninominali' : territorial(row) ? 'lista territoriale' : 'DA SPIEGARE';
    explained.push(`${chamber}:${row.id}:${row.seats}:${why}`);
    assert.notEqual(why, 'DA SPIEGARE', `${chamber} · ${row.id}: ${row.share}% con ${row.seats} seggi senza una ragione nel modello.`);
  }
}
assert.ok(explained.some(item => /lista:SVP|party-registro-p1-2015-19-ir|party-registro-p1-2014-09-ir/.test(item) && /collegi uninominali|lista territoriale/.test(item)), `La lista altoatesina (SVP) tiene seggi con una percentuale nazionale bassa: ${explained.join(' | ')}`);
// Valle d'Aosta: one single-member district in each Chamber, won by the territorial list or the joint list of the centre-right
for (const chamber of ['camera', 'senato']) {
  const aosta = geography[chamber].collegi.filter(item => /Valle d.Aosta/i.test(item.region ?? ''));
  assert.equal(aosta.length, 1, `${chamber}: un collegio in Valle d'Aosta.`);
  const winner = vote[chamber].collegi.find(row => row.id === aosta[0].id);
  assert.ok(winner && (winner.w ?? winner.p), `${chamber}: il collegio della Valle d'Aosta ha un vincitore.`);
}
// abroad: the 2022 seats by ripartizione, nothing more
for (const chamber of ['camera', 'senato']) assert.equal(geography[chamber].estero.reduce((acc, area) => acc + area.seats, 0), EXPECTED[chamber].estero, `${chamber}: i seggi esteri dei dati sono ${EXPECTED[chamber].estero}.`);
console.log(`Riparto dei seggi verificato (Camera 400 = 147 + 245 + 8, Senato 200 = 74 + 122 + 4): nessun seggio proporzionale sotto le soglie, coalizioni e partiti coerenti; liste sotto l'1% con seggi spiegate (${explained.length}: ${explained.map(item => item.split(':').slice(-1)[0]).join(', ')}).`);
