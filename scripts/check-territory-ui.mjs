// "Risultati per territorio" in the national page: the card renders the last simulated vote by Region → Province → Comune, in the real hierarchy of the comuni, with the lean of the model, the source line and the sum
// check; the levels open one inside the other; nothing official is shown below the Region; before a vote or without the ISTAT data the card says why.
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
await realData.loadRealCollections(['parties', 'coalitions', 'municipalities']);
const geography = await realData.loadRealDocument('electoralGeography');
const population = await realData.loadOptionalRealDocument('municipalPopulation');
const db = () => realData.realDatabase;
const L = await import(`../src/core/legislature-engine.js${v}`);
const W = await import(`../src/core/world-engine.js${v}`);
const R = await import(`../src/core/municipal-rules.js${v}`);
const TR = await import(`../src/core/territory-results.js${v}`);
const { territoryResultsCard, regionalLean } = await import(`../src/ui/territory-results-card.js${v}`);
const parties = new Map([...db().parties, ...db().coalitions].map(item => [item.id, item]));
const ids = { FDI: 'party-registro-p1-2014-04-ir', PD: 'party-registro-p1-2015-29-ir', M5S: 'party-registro-p1-2022-63-ir', LEGA: 'party-registro-p1-2017-41-ir', FI: 'party-registro-p1-2015-20-ir', AZ: 'party-registro-p1-2019-51-ir', IV: 'party-registro-p1-2019-52-ir', AVS: 'coalition-alleanza-verdi-sinistra', PE: 'party-registro-p1-2018-47-ir', NM: 'party-registro-p1-2020-56-ir', SCN: 'party-registro-p1-2022-67-ir' };
const worldOf = (shares, governing = []) => W.createWorld({ seedText: 'verifica', date: '2026-09-24', forces: Object.entries(shares).map(([key, share]) => ({ id: ids[key], label: key, share, position: parties.get(ids[key])?.politicalPosition ?? null, governing: governing.includes(key) })), realPoll: null });
const shares2022 = { FDI: 25.99, PD: 19.07, M5S: 15.43, LEGA: 8.77, FI: 8.11, AZ: 4.7, IV: 3.09, AVS: 3.63, PE: 2.83, NM: 0.91, SCN: 0.76 };
const world22 = worldOf(shares2022, ['FDI', 'LEGA', 'FI']);
const coalitions22 = [{ id: 'cdx', label: 'Centrodestra', leaderId: ids.FDI, camp: 'destra', partyIds: [ids.FDI, ids.LEGA, ids.FI, ids.NM] }, { id: 'csx', label: 'Centrosinistra', leaderId: ids.PD, camp: 'sinistra', partyIds: [ids.PD, ids.AVS, ids.PE] }, { id: 'azv', label: 'Azione-IV', leaderId: ids.AZ, camp: 'centro', partyIds: [ids.AZ, ids.IV] }];
const vote = L.compactResult(L.runNationalVote({ geography, world: world22, coalitions: coalitions22, date: '2022-09-25', noise: false }));
const last = { ...vote, id: 'politiche-2022-09-25', date: '2022-09-25' };
const swatch = c => `<i style="background:${c}"></i>`;
const args = extra => ({ overview: {}, last, geography, municipalities: db().municipalities, swatch, colorOf: () => '#456', labelOf: id => String(id).slice(0, 18), ...extra });

// ---------- without ISTAT data or without a vote the card explains ----------
R.setMunicipalPopulationIndex(new Map());
let html = territoryResultsCard(args({}));
assert.ok(/data-territory-state="missing"/.test(html) && /dati ISTAT/.test(html), 'Senza dati ISTAT lo dice.');
R.setMunicipalPopulationIndex(R.indexMunicipalPopulation(population));
html = territoryResultsCard(args({ last: null }));
assert.ok(/primo voto politico/.test(html), 'Prima del voto lo dice.');

// ---------- the regional lean from the districts ----------
const lean = regionalLean(L.districtRows(last, 'camera', geography), geography.camera.collegi);
assert.ok(Object.keys(lean).length >= 18, 'Lo scarto regionale è calcolato per quasi tutte le regioni.');
const values = Object.values(lean).flatMap(item => Object.values(item));
assert.ok(values.every(item => item >= 0.4 && item <= 2.5) && values.some(item => item > 1.15) && values.some(item => item < 0.85), 'Scarti contenuti e non tutti uguali.');

// ---------- Italy → Region → Province → Comune ----------
const text = value => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
html = territoryResultsCard(args({}));
assert.equal((html.match(/data-territory-row/g) ?? []).length, 20, 'Italia: venti regioni.');
assert.ok(/data-territory-table="italia"/.test(html) && /Somma controllata/.test(html) && /Dato simulato/.test(html) && /non è un dato ufficiale/i.test(html), 'Fonte e somma dichiarate.');
assert.ok(/Lombardia/.test(html) && /Abitanti/.test(html) && !/undefined|NaN|\[object/.test(html), 'Intestazioni e regioni.');
const regionCode = html.match(/data-territory-open="(\d+)"/)[1];
html = territoryResultsCard(args({ terr: regionCode }));
assert.ok(/data-territory-table="regione"/.test(html) && /Somma controllata/.test(html) && /data-view-filter-value=""[^>]*>Italia</.test(html), 'Regione: province e ritorno a Italia.');
const provinceKey = html.match(/data-view-filter-value="([^"|]+\|[^"]+)"/)[1];
html = territoryResultsCard(args({ terr: provinceKey }));
assert.ok(/data-territory-table="provincia"/.test(html) && /Somma controllata/.test(html) && (html.match(/data-territory-row/g) ?? []).length >= 1, 'Provincia: comuni.');
assert.ok(!/data-territory-open/.test(html), 'I comuni non si aprono oltre.');
assert.ok(/aria-current="page"/.test(html), 'Il livello corrente è segnato.');
// the biggest province lists its biggest comuni first and caps the list
const lazio = TR.buildHierarchy(R.municipalPopulationIndex(), db().municipalities).find(item => item.name === 'Lazio');
const romaUnit = lazio.provinces.find(item => item.name === 'Roma');
assert.ok(romaUnit.comuni.length > 100, `Roma ha i suoi comuni (${romaUnit.comuni.length}).`);
const big = territoryResultsCard(args({ terr: `${lazio.code}|${romaUnit.code}` }));
assert.ok(/Roma/.test(big) && (big.match(/data-territory-row/g) ?? []).length <= 40, 'Roma: i comuni più popolosi, al massimo 40.');
assert.ok(/comuni più popolosi su/.test(text(big)), 'La nota dice che sono i più popolosi.');
// the same vote gives the same figures (deterministic) and a wrong key falls back to Italy
assert.equal(territoryResultsCard(args({ terr: provinceKey })), territoryResultsCard(args({ terr: provinceKey })));
assert.ok(/data-territory-table="italia"/.test(territoryResultsCard(args({ terr: '99|999' }))), 'Un codice sbagliato torna all’Italia.');
// the headline numbers of Italy: the valid votes of the table are those of the electorate of the vote
const electorate = L.nationalElectorate(geography, last.turnout);
const italyTotal = Number(text(territoryResultsCard(args({}))).match(/\(([\d.]+) voti validi simulati\)/)[1].replace(/\./g, ''));
assert.ok(Math.abs(italyTotal - electorate.valid) < 50, 'Il totale è quello dell’elettorato del voto (a meno degli arrotondamenti).');

console.log('Risultati per territorio: scheda verificata (Italia → regione → provincia → comune, somma, fonte, stati vuoti).');
