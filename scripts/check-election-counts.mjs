// The count of every vote keeps four numbers apart (residents, electors, voters, valid ballots) and respects the rules of the game: voters ≤ residents of the territory (for a region or Italy the sum of its
// comuni without duplicates), voters ≤ electors, valid ballots ≤ voters, the votes of the lists add up to the valid ballots; no artificial 100,000 voters when the demographic data exist; where the data
// are missing the count is a declared scale, never presented as voters; the second-level vote of the provinces stays a weighted vote. Comuni of 280 and 1,000 residents, turnout 100% and 0%,
// regional and general votes, first round and runoff.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const engine = await import(`../src/core/campaign-engine.js${v}`);
const elections = await import(`../src/core/election-engine.js${v}`);
const electorate = await import(`../src/core/electorate.js${v}`);
const rules = await import(`../src/core/municipal-rules.js${v}`);
const legislature = await import(`../src/core/legislature-engine.js${v}`);
const { checkInvariants } = await import(`../src/core/invariants.js${v}`);
const { makeDemoState } = await import(`../src/data/simulation/demo.js${v}`);
const doc = JSON.parse(await readFile(new URL('../src/data/real/municipal-population.json', import.meta.url), 'utf8'));
const geography = JSON.parse(await readFile(new URL('../src/data/real/electoral-geography.json', import.meta.url), 'utf8'));
const parties = JSON.parse(await readFile(new URL('../src/data/real/parties.json', import.meta.url), 'utf8'));
const party = parties.find(item => item.id === 'party-registro-p1-2022-63-ir');
const base = makeDemoState();
const index = rules.indexMunicipalPopulation(doc);
rules.setMunicipalPopulationIndex(index);

// ---------- 1. the populations: the sums are the sums of the comuni, once ----------
const sumBy = key => doc.records.reduce((map, record) => map.set(record[key], (map.get(record[key]) ?? 0) + record.populationResident), new Map());
assert.equal(doc.records.length, 7894, '7.894 comuni.');
assert.equal(new Set(doc.records.map(record => record.municipalityCode)).size, 7894, 'Nessun comune doppio.');
assert.equal(doc.regions.length, 20, '20 regioni.');
for (const [code, total] of sumBy('regionCode')) assert.equal(doc.regions.find(region => region.code === code).populationResident, total, `La regione ${code} è la somma dei suoi comuni.`);
const italy = doc.records.reduce((sum, record) => sum + record.populationResident, 0);
assert.equal(rules.residentsOfItaly(), italy, 'L’Italia è la somma dei comuni.');
assert.equal(italy, 58942828, 'Il totale nazionale è quello del dataset.');
assert.equal(rules.residentsOfRegion('Valle d’Aosta'), 122554, 'La Valle d’Aosta si trova con il nome del gioco.');
assert.equal(rules.residentsText('052032'), '53.180 abitanti · 01/01/2026', 'Il testo mostra il numero esatto e la data.');
assert.equal(rules.residentsText('999999'), 'popolazione non disponibile');

// ---------- 2. the arithmetic of the count, for every kind of territory and turnout ----------
const seeded = seed => { let state = seed >>> 0 || 1; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; };
const normalOf = random => () => Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, random()))) * Math.cos(2 * Math.PI * random());
const comuni = [...doc.records].sort((a, b) => a.populationResident - b.populationResident);
const closest = target => comuni.reduce((best, item) => Math.abs(item.populationResident - target) < Math.abs(best.populationResident - target) ? item : best);
const tiny = closest(280), small = closest(1000);
assert.ok(Math.abs(tiny.populationResident - 280) < 25 && Math.abs(small.populationResident - 1000) < 40, `Esistono comuni vicini a 280 e 1.000 residenti (${tiny.populationResident}, ${small.populationResident}).`);
const fake = (type, extra = {}) => ({ id: `conto-${type}`, seed: 7, stage: 'campagna', electionDays: [], electionType: type, ...extra });
let counted = 0;
for (const record of [tiny, small, closest(5000), closest(50000), comuni.at(-1), ...comuni.filter((_, at) => at % 197 === 0)]) {
  for (const turnout of [0, 12, 40, 61, 83, 99.5, 100]) {
    for (let seed = 1; seed <= 3; seed++) {
      const campaign = fake('comunale', { electorate: { place: { municipalityCode: record.municipalityCode, region: null } }, electionDays: [{ turnout }] });
      const random = seeded(seed * 1009 + counted); counted++;
      const count = electorate.countBallots(campaign, { turnout, normal: normalOf(random) });
      assert.equal(count.normalized, false, `${record.name}: con i dati demografici non c’è la scala di 100.000.`);
      assert.equal(count.residents, record.populationResident, `${record.name}: i residenti sono quelli ISTAT.`);
      assert.deepEqual(electorate.countProblems(count, []), [], `${record.name} (${record.populationResident}), affluenza ${turnout}%: ${electorate.countProblems(count, []).join('; ')}`);
      assert.ok(count.electors < count.residents || count.residents <= 1, 'L’elettorato simulato è una parte dei residenti.');
      if (turnout === 100) assert.equal(count.voters, count.electors, `${record.name}: con l’affluenza al 100% votano tutti gli elettori, mai più dei residenti.`);
      if (turnout === 0) assert.equal(count.voters, 0, 'Affluenza 0: nessun votante.');
      const rows = electorate.withVotes([{ percent: 41.37 }, { percent: 33.3 }, { percent: 25.33 }], count.ballots, { others: false });
      assert.equal(rows.reduce((sum, row) => sum + row.votes, 0), count.ballots, 'I voti delle liste sommano ai voti validi.');
    }
  }
}
// registers larger than the residents (a register that includes people abroad): the voters never pass the residents
{
  const campaign = fake('regionale', { electorate: { electors: 500000, validRatio: .98, basis: 'prova', place: { region: 'Valle d’Aosta' } } });
  const count = electorate.countBallots(campaign, { turnout: 100, normal: normalOf(seeded(5)) });
  assert.ok(count.voters <= 122554 && count.voters <= count.electors, `Regione con registri maggiori dei residenti: votanti ${count.voters} ≤ residenti 122.554.`);
  assert.deepEqual(electorate.countProblems(count, []), []);
}
// the second-level vote and the missing data are scales, never voters
{
  const provincial = electorate.countBallots(fake('provinciale', { electorate: { place: { region: 'Toscana' } } }), { turnout: 60, normal: normalOf(seeded(2)) });
  assert.equal(provincial.normalized, true); assert.equal(provincial.kind, 'secondo-livello'); assert.equal(provincial.voters, null, 'La provinciale di secondo livello non ha votanti-popolazione.');
  assert.match(provincial.basis, /secondo livello/);
  rules.setMunicipalPopulationIndex(new Map());
  const missing = electorate.countBallots(fake('comunale', { electorate: { place: { municipalityCode: '052032' } } }), { turnout: 60, normal: normalOf(seeded(3)) });
  assert.equal(missing.normalized, true, 'Senza dati demografici la scala è dichiarata.');
  assert.equal(missing.voters, null); assert.match(missing.basis, /Dati demografici non disponibili/);
  rules.setMunicipalPopulationIndex(index);
}
// the votes of the lists add up exactly, whatever the shares
for (let seed = 1; seed <= 400; seed++) {
  const random = seeded(seed);
  const shares = Array.from({ length: 2 + Math.floor(random() * 6) }, () => random() + .01);
  const sum = shares.reduce((a, b) => a + b, 0);
  const total = Math.floor(random() * 3000000);
  const votes = electorate.distributeVotes(shares.map(value => value / sum * 100), total);
  assert.equal(votes.reduce((a, b) => a + b, 0), total, 'La somma è esatta.');
  assert.ok(votes.every(value => Number.isInteger(value) && value >= 0));
}

// ---------- 3. a whole campaign, with its first round and runoff ----------
function play({ type, role, region, municipalityCode, band, seed, registers = null }) {
  const player = { ...base.dataset.politicians[0], partyId: party.id, region };
  const config = { electionType: type, role, objective: 'win', municipalityBand: band, place: { municipalityCode, region }, ...(registers ? { electorate: registers } : {}) };
  let campaign = engine.createCampaign({ career: { ...base.career, id: `conto-${type}-${seed}`, partyId: party.id }, player, statistics: base.dataset.statistics, partyCatalog: parties, currentDate: '2026-09-25', config });
  campaign.nomination.status = 'approved';
  for (let guard = 0; campaign.status === 'active' && guard < 260; guard++) {
    if (campaign.pendingEvents.length) { const event = campaign.pendingEvents[0]; campaign = engine.decideCampaignEvent(campaign, event.id, event.choices[(seed + guard) % event.choices.length].id); continue; }
    campaign = engine.advanceCampaign(campaign, 1);
  }
  return campaign;
}
const unitRegion = new Map(JSON.parse(await readFile(new URL('../src/data/real/territorial-units.json', import.meta.url), 'utf8')).map(unit => [unit.regionCode, unit.gameRegion]));
const place = record => ({ municipalityCode: record.municipalityCode, region: unitRegion.get(record.regionCode) });
const registersOf = region => { const rows = region ? geography.camera.collegi.filter(row => row.region === region) : geography.camera.collegi; const sum = key => rows.reduce((total, row) => total + (row[key] ?? 0), 0); return { electors: sum('electors'), validRatio: Math.round(sum('valid') / sum('voters') * 10000) / 10000, basis: 'iscritti 2022' }; };
let runoffs = 0, finals = 0;
const bigComuni = comuni.filter(record => record.populationResident > 15000);
for (let seed = 0; seed < 14; seed++) {
  const record = [tiny, small, closest(4000), bigComuni[(seed * 37) % bigComuni.length], bigComuni[(seed * 91 + 5) % bigComuni.length]][seed % 5];
  const where = place(record);
  const band = record.populationResident > 15000 ? 'oltre-15000' : 'fino-15000';
  const campaign = play({ type: 'comunale', role: 'sindaco', ...where, band, seed });
  assert.equal(campaign.status, 'finished');
  const result = campaign.result, count = result.electorate;
  assert.equal(count.normalized, false, `${record.name}: ${count.basis}`);
  assert.deepEqual(electorate.countProblems(count, result.groups, { label: record.name }), [], `${record.name}: il risultato rispetta i vincoli`);
  assert.ok(count.voters <= record.populationResident, `${record.name}: votanti ${count.voters} ≤ residenti ${record.populationResident}`);
  assert.ok(result.territories.every(area => area.groups.reduce((sum, row) => sum + row.votes, 0) === area.ballots), 'Anche in ogni area i voti sommano alle schede.');
  assert.equal(result.territories.reduce((sum, area) => sum + area.ballots, 0), count.ballots, 'Le schede delle aree sommano a quelle del voto.');
  if (campaign.firstRoundResult) { runoffs++; const first = campaign.firstRoundResult.electorate; assert.deepEqual(electorate.countProblems(first, campaign.firstRoundResult.groups), [], 'Anche il primo turno è coerente.'); assert.ok(first.voters <= record.populationResident); assert.equal(first.electors, count.electors, 'Primo turno e ballottaggio hanno lo stesso elettorato.'); assert.ok(count.voters <= count.electors, 'Al ballottaggio non votano più elettori di quanti ce ne siano.'); }
  finals++;
  // the invariants of the game state accept the result
  const state = { ...base, campaign };
  const issues = checkInvariants(state).issues.filter(issue => /campaign\.result/.test(issue.path));
  assert.deepEqual(issues, [], 'Le invarianti della partita accettano il conteggio.');
}
// regional and general votes with the registers of the map
for (const region of ['Valle d’Aosta', 'Molise', 'Lombardia']) {
  const campaign = play({ type: 'regionale', role: 'presidente', region, municipalityCode: null, band: null, seed: 3, registers: registersOf(region) });
  const count = campaign.result.electorate;
  assert.equal(count.residents, rules.residentsOfRegion(region), `${region}: i residenti sono la somma dei comuni della regione.`);
  assert.deepEqual(electorate.countProblems(count, campaign.result.groups, { label: region }), []);
  assert.ok(count.voters <= count.residents, `${region}: votanti ≤ residenti.`);
}
{
  const campaign = play({ type: 'politiche', role: 'deputato', region: 'Lombardia', municipalityCode: null, band: null, seed: 4, registers: registersOf(null) });
  const count = campaign.result.electorate;
  assert.equal(count.residents, 58942828); assert.deepEqual(electorate.countProblems(count, campaign.result.groups, { label: 'politiche' }), []);
}
// the national vote of the legislature engine
for (const turnout of [0, 55, 100]) {
  const count = legislature.nationalElectorate(geography, turnout);
  assert.equal(count.residents, 58942828); assert.ok(count.voters <= count.residents && count.voters <= count.electors && count.valid <= count.voters, `Nazionali, affluenza ${turnout}%: ${JSON.stringify({ v: count.voters, e: count.electors, r: count.residents })}`);
}
console.log(`Conteggio dei voti verificato: popolazioni regionali e nazionale come somma dei 7.894 comuni, comuni da ${tiny.populationResident} e ${small.populationResident} residenti e oltre ${counted} conteggi con affluenza da 0 a 100% (votanti ≤ residenti e ≤ elettori, validi ≤ votanti, voti di lista = validi), ${finals} campagne comunali (${runoffs} con ballottaggio), regionali e politiche con i registri della mappa, nazionali, dati mancanti e secondo livello dichiarati come scala, voti in numeri interi.`);
