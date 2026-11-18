// Results of a simulated vote by territory (core/territory-results.js): Italy → Region → Province → Comune on the real ISTAT hierarchy, always adding up list by list (comuni to the Province,
// Provinces to the Region, Regions to the country), exact integers, never negative, deterministic, proportional to the inhabitants with a regional lean and a local deviation; the small Provinces and
// the comuni of a one-comune Province are consistent too.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { indexMunicipalPopulation } from '../src/core/municipal-rules.js';
import { addsUp, buildHierarchy, distribute, shareExactly, territoryBreakdown, localLeanOf, effectsFromHome, LOCAL_FACTOR } from '../src/core/territory-results.js';

// ---------- the primitive ----------
for (const [total, weights] of [[100, [1, 1, 1]], [7, [5, 0, 0]], [0, [1, 2]], [1000003, [3, 5, 7, 11]], [5, [0, 0]], [13, [0.2, 0.7, 0.1]]]) {
  const parts = shareExactly(total, weights);
  assert.equal(parts.reduce((a, b) => a + b, 0), weights.some(w => w > 0) ? total : 0, `shareExactly(${total}) somma al totale.`); assert.ok(parts.every(p => Number.isInteger(p) && p >= 0), 'Interi non negativi.');
}
const a = distribute({ x: 1000, y: 333 }, [{ id: 'u', weight: 10 }, { id: 'v', weight: 30 }], { seed: 's' }), b = distribute({ x: 1000, y: 333 }, [{ id: 'u', weight: 10 }, { id: 'v', weight: 30 }], { seed: 's' });
assert.deepEqual(a, b, 'Stessi dati, stessa ripartizione.'); assert.equal(a.u.x + a.v.x, 1000); assert.equal(a.u.y + a.v.y, 333);
assert.ok(a.v.x > a.u.x, 'Chi ha più abitanti ha più voti.');

// ---------- the real hierarchy ----------
const doc = JSON.parse(await readFile(new URL('../src/data/real/municipal-population.json', import.meta.url), 'utf8'));
const municipalities = JSON.parse(await readFile(new URL('../src/data/real/municipalities.json', import.meta.url), 'utf8'));
const hierarchy = buildHierarchy(indexMunicipalPopulation(doc), Array.isArray(municipalities) ? municipalities : municipalities.items ?? municipalities.municipalities);
assert.equal(hierarchy.length, 20, 'Venti regioni.');
const comuni = hierarchy.flatMap(region => region.provinces.flatMap(province => province.comuni));
assert.ok(comuni.length >= 7800, `I comuni sono nelle province (${comuni.length} su 7894).`);
assert.ok(hierarchy.every(region => region.provinces.length >= 1), 'Ogni regione ha province.');
const totals = { 'lista-a': 12_500_000, 'lista-b': 9_100_000, 'lista-c': 4_800_000, 'lista-d': 1_250_333, altre: 800_017 };
const lean = { Lombardia: { 'lista-a': 1.25, 'lista-b': 0.8 }, Campania: { 'lista-b': 1.4, 'lista-a': 0.7 } };
const italy = territoryBreakdown({ totals, hierarchy, seed: 'prova', regionLean: lean });
assert.equal(italy.rows.length, 20); assert.ok(addsUp(italy), 'Le regioni sommano all’Italia, lista per lista.');
const share = (row, key) => row.votes[key] / row.valid;
const lombardia = italy.rows.find(row => row.name === 'Lombardia'), campania = italy.rows.find(row => row.name === 'Campania');
assert.ok(share(lombardia, 'lista-a') > share(campania, 'lista-a') + 0.05 && share(campania, 'lista-b') > share(lombardia, 'lista-b') + 0.05, 'Lo scarto regionale conta: ogni lista pesa di più dove ha il suo bacino.');
let provincesChecked = 0, comuniChecked = 0;
for (const region of hierarchy) {
  const level = territoryBreakdown({ totals, hierarchy, seed: 'prova', regionLean: lean, regionCode: region.code });
  assert.equal(level.region.name, region.name); assert.ok(addsUp(level), `${region.name}: le province sommano alla regione.`); provincesChecked += level.rows.length;
  assert.deepEqual(level.region.votes, italy.rows.find(row => row.code === region.code).votes, `${region.name}: la regione ha gli stessi numeri a ogni livello.`);
  for (const province of region.provinces.filter((_, index) => index < 4)) {
    const deep = territoryBreakdown({ totals, hierarchy, seed: 'prova', regionLean: lean, regionCode: region.code, provinceCode: province.code });
    assert.ok(addsUp(deep), `${province.name}: i comuni sommano alla provincia.`); comuniChecked += deep.rows.length;
    assert.deepEqual(deep.province.votes, level.rows.find(row => row.code === province.code).votes, `${province.name}: la provincia ha gli stessi numeri a ogni livello.`);
    assert.ok(deep.rows.every(row => Object.values(row.votes).every(v => Number.isInteger(v) && v >= 0)), 'Voti interi e non negativi.');
    if (province.comuni.length === 1) assert.deepEqual(deep.rows[0].votes, deep.province.votes, 'Una provincia con un solo comune ha gli stessi voti del comune.');
  }
}
assert.ok(provincesChecked >= 100 && comuniChecked > 300, `Controllati ${provincesChecked} livelli provinciali e ${comuniChecked} comuni.`);
assert.deepEqual(territoryBreakdown({ totals, hierarchy, seed: 'prova', regionLean: lean }), italy, 'Deterministico.');
const other = territoryBreakdown({ totals, hierarchy, seed: 'altro', regionLean: lean });
assert.notDeepEqual(other.rows.map(r => r.votes), italy.rows.map(r => r.votes), 'Un altro voto ha un’altra distribuzione locale.');

// ---------- local effects (candidate home, campaign): deterministic, exact, national result unchanged ----------
{
  const province = hierarchy.find(region => region.code === hierarchy[3].code).provinces[0];
  const home = province.comuni[Math.floor(province.comuni.length / 2)];
  const region = hierarchy[3];
  const effects = effectsFromHome({ hierarchy, comuneCode: home.code, key: 'lista-b', edge: 0.3 });
  assert.equal(effects.length, 3, 'Comune, provincia e regione del candidato.'); assert.deepEqual(effectsFromHome({ hierarchy, comuneCode: home.code, key: 'lista-b', edge: 0 }), [], 'Senza vantaggio registrato nessun effetto inventato.'); assert.deepEqual(effectsFromHome({ hierarchy, comuneCode: 'xx', key: 'lista-b', edge: 0.3 }), [], 'Comune sconosciuto: nessun effetto.');
  const args = { totals, hierarchy, seed: 'prova', regionLean: lean, regionCode: region.code, provinceCode: province.code };
  const plain = territoryBreakdown(args), local = territoryBreakdown({ ...args, local: localLeanOf(effects) }), again = territoryBreakdown({ ...args, local: localLeanOf(effects) });
  assert.deepEqual(local, again, 'Deterministico.'); assert.ok(addsUp(local), 'I comuni sommano ancora alla provincia, lista per lista.');
  assert.deepEqual(local.province.votes.length === undefined ? Object.keys(local.province.votes) : [], Object.keys(plain.province.votes), 'Le liste sono le stesse.');
  const plainHome = plain.rows.find(row => row.code === home.code), localHome = local.rows.find(row => row.code === home.code);
  assert.ok(localHome.votes['lista-b'] > plainHome.votes['lista-b'], 'La lista del candidato guadagna nel suo comune.');
  const regional = territoryBreakdown({ totals, hierarchy, seed: 'prova', regionLean: lean, regionCode: region.code, local: localLeanOf(effects) });
  assert.ok(addsUp(regional) && addsUp(territoryBreakdown({ totals, hierarchy, seed: 'prova', regionLean: lean, local: localLeanOf(effects) })), 'Province, regioni e Italia sommano ancora.');
  const nation = territoryBreakdown({ totals, hierarchy, seed: 'prova', regionLean: lean, local: localLeanOf(effects) });
  assert.deepEqual(nation.italy.votes, totals, 'Il risultato nazionale non si muove.');
  assert.equal(localLeanOf([{ level: 'comune', code: 'a', key: 'k', factor: 99 }])('comune', 'a', 'k'), LOCAL_FACTOR.max, 'Il fattore è limitato.');
  assert.equal(localLeanOf([{ level: 'comune', code: 'a' }, null, { factor: 2 }])('comune', 'a', 'k'), 1, 'Effetti incompleti ignorati.');
}
console.log(`Risultati per territorio verificati: Italia → 20 regioni → ${provincesChecked} province → ${comuniChecked} comuni controllati sul gerarchia ISTAT, sempre in somma lista per lista, interi, deterministici, con scarto regionale e popolazione.`);
