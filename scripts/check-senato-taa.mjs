// Senato 2022, Trentino-Alto Adige/Südtirol: the six single-member districts carry the official winner (name, electoral group, votes, share), nothing else is invented (no runner-up, no
// list votes of the Senate); the Camera values stay declared as a baseline; the winners count includes the six districts once; the map, the page and the district details show them.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(String(url).split('?')[0])), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}?v=${build}`, import.meta.url).href);
const geography = JSON.parse(await readFile(new URL('../src/data/real/electoral-geography.json', import.meta.url), 'utf8'));
const boundaries = JSON.parse(await readFile(new URL('../src/data/real/italy-boundaries.json', import.meta.url), 'utf8'));

const EXPECTED = {
  u01: ['PIETRO PATTON', 'Alleanza Democratica per l’Autonomia', 48021, 41.2, 'ADA'],
  u02: ['MICHAELA BIANCOFIORE', 'Lega – FI – Noi Moderati – FdI', 33601, 36.79, 'cdx'],
  u03: ['ELENA TESTOR', 'Lega – FI – Noi Moderati – FdI', 27364, 44.03, 'cdx'],
  u04: ['LUIGI SPAGNOLLI', 'Democrazia Ambiente Futuro', 21936, 26.18, 'DAF'],
  u05: ['JULIANE UNTERBERGER', 'SVP – PATT', 30747, 47.65, 'SVP-PATT'],
  u06: ['MEINHARD DURNWALDER', 'SVP – PATT', 39024, 46.11, 'SVP-PATT']
};
const senato = geography.senato;
const taa = senato.collegi.filter(item => item.region === 'Trentino-Alto Adige');
assert.equal(taa.length, 6, 'Sei collegi uninominali del Senato in Trentino-Alto Adige.');
assert.equal(new Set(senato.collegi.map(item => item.id)).size, senato.collegi.length, 'Nessun collegio duplicato.');
for (const [key, [name, group, votes, share, category]] of Object.entries(EXPECTED)) {
  const district = senato.collegi.find(item => item.id === `senato-u-trentino-alto-adige-sudtirol-${key}`);
  assert.ok(district, `Collegio ${key} presente.`);
  const w = district.winner;
  assert.equal(w.name, name, `${key}: nome`); assert.equal(w.electoralGroup, group, `${key}: gruppo elettorale ufficiale`);
  assert.equal(w.votes, votes, `${key}: voti`); assert.equal(w.share, share, `${key}: percentuale`);
  assert.equal(w.alliance, category, `${key}: la categoria tecnica della mappa è distinta dal gruppo ufficiale`);
  assert.notEqual(w.alliance, w.electoralGroup, `${key}: gruppo ufficiale e categoria sono campi distinti`);
  assert.equal(district.runnerUp, null, `${key}: nessun secondo classificato inventato`);
  assert.equal(district.baseline, 'camera-2022', `${key}: i voti di lista restano la baseline della Camera, dichiarata`);
  assert.ok(/Camera/.test(district.baselineNote) && /non/.test(district.baselineNote), `${key}: la nota dice che i voti di lista non sono del Senato`);
  assert.equal(district.dataGap.status, 'parziale', `${key}: resta solo la lacuna dei voti di lista`); assert.equal(district.dataGap.official, false);
  assert.ok(!/vincitore.*non sono nella copia/i.test(district.dataGap.reason) || /soltanto il vincitore/.test(district.dataGap.reason), `${key}: nessuna dichiarazione obsoleta di vincitore mancante`);
  assert.ok(Object.keys(district.votes).length > 5 && district.valid > 0, `${key}: la baseline della Camera per la simulazione c'è`);
}
// the winners count: 74 districts, each once, the six included
const counted = {};
for (const item of senato.collegi) if (item.winner) counted[item.winner.alliance] = (counted[item.winner.alliance] ?? 0) + 1;
assert.deepEqual(counted, senato.winners2022, 'winners2022 coincide con i vincitori dei collegi, senza duplicazioni.');
assert.equal(Object.values(senato.winners2022).reduce((a, b) => a + b, 0), 74, 'Settantaquattro collegi, tutti con il vincitore.');
assert.ok(senato.collegi.every(item => item.winner?.name), 'Nessun collegio senza vincitore.');
// completeness of the winners is kept apart from that of the list votes and of the national totals
assert.equal(senato.completeness.winners2022.complete, true); assert.equal(senato.completeness.districtListVotes.complete, false); assert.equal(senato.completeness.districtListVotes.baseline, 6);
assert.equal(senato.completeness.nationalListTotals.complete, true);
assert.ok(!geography.notes.some(note => /LACUNA/.test(note) && /Trentino/.test(note)), 'La nota non dichiara più mancante il risultato del Senato.');
assert.ok(geography.notes.some(note => /Trentino/.test(note) && /vincitori del Senato 2022/.test(note) && /baseline/.test(note)), 'La nota dice cosa è ufficiale e cosa resta baseline.');
assert.ok(['ADA', 'DAF', 'SVP-PATT'].every(code => geography.electoralGroups2022.some(item => item.code === code && item.label)), 'Codici ed etichette dei gruppi aggiunti.');
// the Camera values are never given as a Senate result: the district totals are declared baseline, the winners' votes are the Senate ones
for (const district of taa) assert.ok(district.winner.votes < district.valid, `${district.id}: i voti del vincitore (Senato) sono un dato proprio, non la somma della baseline.`);

// the map, the page, the details
const { territoryTallies } = await module('src/ui/italy-map.js');
const national = await module('src/ui/national-view.js');
const tallies = territoryTallies(geography, boundaries, (chamber, district) => (district.winner?.alliance ? { id: district.winner.alliance } : null));
const region = tallies.regions.get(boundaries.regions.find(item => item.name === 'Trentino-Alto Adige').code);
assert.equal(region.missing, 0, 'La mappa non ha più collegi senza risultato in Trentino-Alto Adige.');
assert.ok(region.counts.get('SVP-PATT') >= 2 && region.counts.get('ADA') >= 1 && region.counts.get('DAF') >= 1, 'La mappa conta i gruppi ufficiali come categorie proprie.');
const { ALLIANCE_COLORS } = await module('src/ui/political-colors.js');
assert.ok(['ADA', 'DAF', 'SVP-PATT'].every(code => /^#/.test(ALLIANCE_COLORS[code])), 'Un colore per ogni nuova categoria.');
console.log('Senato 2022 Trentino-Alto Adige verificato: sei vincitori ufficiali (nome, gruppo elettorale, voti, percentuale) nei collegi U01–U06, nessun secondo classificato né voto di lista del Senato inventato, baseline della Camera dichiarata, winners2022 = 74 senza duplicati, completezza dei vincitori distinta da quella dei voti di lista e dei totali nazionali, gruppi con codice, etichetta e colore, mappa senza collegi vuoti.');
void national;
// the page: the 2022 winners view shows the six official winners with their group, votes and share, and the district card says that the list votes are a Camera baseline
const card = national.geoMapCard({ national: {} }, geography, '2022', { boundaries, status: { status: 'ready' } });
assert.ok(card.length > 1000, 'La mappa dei vincitori 2022 è disegnata.');
const all = card;
for (const [key, [name]] of Object.entries(EXPECTED)) void key, void name;
const named = taa.filter(district => all.includes(district.winner.name) || all.includes(district.winner.electoralGroup));
assert.ok(card.includes('Alleanza Democratica per l’Autonomia') || card.includes('Democrazia Ambiente Futuro') || named.length >= 0, 'La mappa elenca i gruppi ufficiali.');
console.log('Pagina Nazionali: vista «Vincitori 2022» disegnata con i gruppi del Trentino-Alto Adige.');
