// Il modello locale dei risultati per territorio (SIMULATO): dimensione del luogo, presenza del partito, notorietà e reputazione del candidato nel suo comune, coalizione. Ogni livello continua a sommare al
// livello sopra (lista per lista), il totale nazionale non si muove, gli stessi dati danno gli stessi numeri e gli effetti vanno nella direzione dichiarata.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { indexMunicipalPopulation } from '../src/core/municipal-rules.js';
import { addsUp, buildHierarchy, localModel, territoryBreakdown } from '../src/core/territory-results.js';
const doc = JSON.parse(await readFile(new URL('../src/data/real/municipal-population.json', import.meta.url), 'utf8'));
const mun = JSON.parse(await readFile(new URL('../src/data/real/municipalities.json', import.meta.url), 'utf8'));
const hierarchy = buildHierarchy(indexMunicipalPopulation(doc), Array.isArray(mun) ? mun : mun.items ?? mun.municipalities);
const totals = { sx: 9_000_000, dx: 11_000_000, civ: 1_000_000, altri: 600_000 };
const forces = [{ id: 'sx', axis: -2 }, { id: 'dx', axis: 2 }];
const region = hierarchy.find(item => item.name === 'Toscana'), province = region.provinces[0];
const big = [...province.comuni].sort((a, b) => b.population - a.population)[0], small = [...province.comuni].sort((a, b) => a.population - b.population)[0];
const base = localModel({ hierarchy, forces, playerKey: 'sx', notoriety: 50, reputation: 50, homeComuneCode: big.code }).local;
const run = local => territoryBreakdown({ totals, hierarchy, seed: 'locale', regionCode: region.code, provinceCode: province.code, local });
const plain = territoryBreakdown({ totals, hierarchy, seed: 'locale', regionCode: region.code, provinceCode: province.code });
const withModel = run(base);
assert.ok(addsUp(withModel), 'Con il modello locale i comuni sommano alla provincia, lista per lista.');
assert.deepEqual(withModel.italy.votes, totals, 'Il Paese non si muove: il modello sposta i voti solo tra fratelli.'); assert.ok(addsUp(territoryBreakdown({ totals, hierarchy, seed: 'locale', local: base })), 'Le regioni sommano all’Italia con il modello.');
assert.deepEqual(run(base).rows.map(row => row.votes), withModel.rows.map(row => row.votes), 'Stessi dati, stessi numeri.');
const share = (breakdown, code, key) => { const row = breakdown.rows.find(item => item.code === code); return row.votes[key] / row.valid; };
const shift = (a, b, code, key) => share(a, code, key) - share(b, code, key);
// demographic: the big city leans left, the small comune leans right, civic lists do better in the small one (relative to the plain split)
assert.ok(shift(withModel, plain, big.code, 'sx') > shift(withModel, plain, small.code, 'sx'), 'La grande città pende a sinistra rispetto al piccolo comune.');
assert.ok(shift(withModel, plain, small.code, 'dx') > shift(withModel, plain, big.code, 'dx'), 'Il piccolo comune pende a destra.');
assert.ok(shift(withModel, plain, small.code, 'altri') > shift(withModel, plain, big.code, 'altri'), 'Le liste civiche e locali vanno meglio nei piccoli comuni.');
// candidate: notoriety and reputation raise the player's list in his home comune, and not elsewhere in the same way
const famous = run(localModel({ hierarchy, forces, playerKey: 'sx', notoriety: 90, reputation: 80, homeComuneCode: small.code }).local);
const unknown = run(localModel({ hierarchy, forces, playerKey: 'sx', notoriety: 10, reputation: 30, homeComuneCode: small.code }).local);
assert.ok(share(famous, small.code, 'sx') > share(unknown, small.code, 'sx'), 'Un candidato noto prende più voti nel suo comune.');
assert.ok(addsUp(famous) && addsUp(unknown));
assert.deepEqual(famous.italy.votes, unknown.italy.votes, 'Neanche il candidato sposta il Paese: sposta voti tra territori fratelli.');
// presence of the party: a well organised committee in the province raises the list
const organised = localModel({ hierarchy, forces, playerKey: 'sx', committees: [{ level: 'provincia', name: province.name, organization: 95 }] }).local;
const missing = localModel({ hierarchy, forces, playerKey: 'sx', committees: [{ level: 'provincia', name: province.name, organization: 5 }] }).local;
const regionTotals = territoryBreakdown({ totals, hierarchy, seed: 'locale', regionCode: region.code });
const prov = model => territoryBreakdown({ totals, hierarchy, seed: 'locale', regionCode: region.code, local: model }).rows.find(row => row.code === province.code);
assert.ok(prov(organised).votes.sx / prov(organised).valid > prov(missing).votes.sx / prov(missing).valid, 'Un partito organizzato prende più voti nella provincia.');
assert.ok(addsUp(territoryBreakdown({ totals, hierarchy, seed: 'locale', regionCode: region.code, local: organised })) && addsUp(regionTotals));
// the whole country and every region still add up with the model
for (const item of hierarchy.slice(0, 6)) assert.ok(addsUp(territoryBreakdown({ totals, hierarchy, seed: 'locale', regionCode: item.code, local: base })), `${item.name}: le province sommano alla regione.`);
console.log(`Modello locale dei risultati per territorio verificato: dimensione del luogo, presenza del partito, notorietà del candidato nel suo comune; ogni livello somma al superiore, il Paese non si muove, deterministico (${big.name} / ${small.name}).`);
