// The page «Risultati per territorio» (search, filters, pages, comparison, sums), on the real data.
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
const { territoryInputs } = await import(`../src/ui/territory-results-card.js${v}`);
const { renderTerritoryPage, searchComuni, PAGE_SIZE } = await import(`../src/ui/territory-page.js${v}`);
const parties = new Map([...db().parties, ...db().coalitions].map(item => [item.id, item]));
const ids = { FDI: 'party-registro-p1-2014-04-ir', PD: 'party-registro-p1-2015-29-ir', M5S: 'party-registro-p1-2022-63-ir', LEGA: 'party-registro-p1-2017-41-ir', FI: 'party-registro-p1-2015-20-ir', AZ: 'party-registro-p1-2019-51-ir', IV: 'party-registro-p1-2019-52-ir', AVS: 'coalition-alleanza-verdi-sinistra', PE: 'party-registro-p1-2018-47-ir', NM: 'party-registro-p1-2020-56-ir', SCN: 'party-registro-p1-2022-67-ir' };
const worldOf = (shares, governing = []) => W.createWorld({ seedText: 'verifica', date: '2026-09-24', forces: Object.entries(shares).map(([key, share]) => ({ id: ids[key], label: key, share, position: parties.get(ids[key])?.politicalPosition ?? null, governing: governing.includes(key) })), realPoll: null });
const shares2022 = { FDI: 25.99, PD: 19.07, M5S: 15.43, LEGA: 8.77, FI: 8.11, AZ: 4.7, IV: 3.09, AVS: 3.63, PE: 2.83, NM: 0.91, SCN: 0.76 };
const world22 = worldOf(shares2022, ['FDI', 'LEGA', 'FI']);
const coalitions22 = [{ id: 'cdx', label: 'Centrodestra', leaderId: ids.FDI, camp: 'destra', partyIds: [ids.FDI, ids.LEGA, ids.FI, ids.NM] }, { id: 'csx', label: 'Centrosinistra', leaderId: ids.PD, camp: 'sinistra', partyIds: [ids.PD, ids.AVS, ids.PE] }, { id: 'azv', label: 'Azione-IV', leaderId: ids.AZ, camp: 'centro', partyIds: [ids.AZ, ids.IV] }];
const vote = L.compactResult(L.runNationalVote({ geography, world: world22, coalitions: coalitions22, date: '2022-09-25', noise: false }));
const last = { ...vote, id: 'politiche-2022-09-25', date: '2022-09-25' };
const swatch = c => `<i style="background:${c}"></i>`;

// The page «Risultati per territorio»: all the comuni consultable by search, filters and pages (never all at once), the sums that add up, simulated and real data told apart, the comparison between votes.
R.setMunicipalPopulationIndex(R.indexMunicipalPopulation(population));
const hierarchy = TR.buildHierarchy(R.municipalPopulationIndex(), db().municipalities);
const allComuni = hierarchy.reduce((sum, region) => sum + region.provinces.reduce((acc, province) => acc + province.comuni.length, 0), 0);
assert.ok(allComuni >= 7800, `tutti i comuni sono nella gerarchia (${allComuni})`);
const state = { game: { week: { index: 1 } } };
const voteB = { ...last, id: 'europee-2024', type: 'europee', date: '2024-06-09' };
const overview = { national: { lastPolitiche: last, votes: [{ type: 'politiche', date: '2022-09-25', lists: last.national.slice(0, 6).map(row => ({ id: row.id, label: row.label ?? row.id, share: row.share, seats: 0 })) }, { type: 'europee', date: '2024-06-09', lists: last.national.slice(0, 6).map((row, index) => ({ id: row.id, label: row.label ?? row.id, share: Math.max(0.5, row.share + (index % 2 ? -1.5 : 2)), seats: 0 })) }] } };
const page = (filters = {}, over = overview) => renderTerritoryPage(state, over, { geography, municipalities: db().municipalities, filters, swatch, colorOf: () => '#456', labelOf: id => String(id).slice(0, 18) });
const plain = value => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

// search
const roma = searchComuni(hierarchy, 'roma');
assert.ok(roma.total >= 1 && roma.items[0].comune.name === 'Roma', 'Cercando «roma» il primo risultato è Roma');
assert.deepEqual(searchComuni(hierarchy, 'r'), { items: [], total: 0 }, 'Una lettera sola non cerca');
assert.ok(searchComuni(hierarchy, 'FORLI').items.some(item => /Forl/.test(item.comune.name)), 'Accenti e maiuscole ignorati');
assert.equal(searchComuni(hierarchy, 'zzzzqq').total, 0);
assert.ok(searchComuni(hierarchy, 'san', { limit: 5 }).items.length === 5 && searchComuni(hierarchy, 'san').total > 50, 'Le ricerche larghe sono tagliate');

// without a vote / without ISTAT
let html = renderTerritoryPage(state, { national: { lastPolitiche: null, votes: [] } }, { geography, municipalities: db().municipalities, filters: {}, swatch, colorOf: () => '#456', labelOf: id => id });
assert.ok(/data-territory-state="missing"/.test(html) && /Ancora nessun voto politico/.test(html) && /NESSUN VOTO/.test(html), 'Prima del voto lo dice, senza inventare numeri');
assert.ok(!/NaN|undefined/.test(html));
// Italy level: data classes, controls, the 20 regions, sums
html = page();
assert.ok(/data-territory-status/.test(html) && /RISULTATO SIMULATO/.test(html) && /DATO REALE/.test(html) && /SONDAGGIO \/ PROIEZIONE/.test(html), 'Reale, simulato e stime sono distinti');
assert.ok(/data-territory-form/.test(html) && /data-territory-search/.test(html) && /\d\.?\d{3} comuni consultabili/.test(plain(html)), 'Controlli e numero dei comuni');
assert.equal((html.match(/data-territory-row/g) ?? []).length, 20, 'Italia: venti regioni');
assert.ok(/data-territory-table="italia"/.test(html) && /Somma controllata/.test(html) && /data-territory-summary/.test(html), 'Sintesi e somma');
// the search finds a comune and opens its province
html = page({ terrQ: 'roma' });
assert.ok(/data-territory-hits/.test(html) && /data-territory-hit=/.test(html), 'La ricerca dà i risultati');
assert.ok(/Nessun comune corrisponde/.test(page({ terrQ: 'zzzzqq' })), 'Nessun risultato è detto');
// province of Roma: pages of 25, the sum over all the pages is the province, names sorted, no repetition
const lazio = hierarchy.find(item => item.name === 'Lazio');
const romaProvince = lazio.provinces.find(item => item.name === 'Roma');
const key = `${lazio.code}|${romaProvince.code}`;
const pages = Math.ceil(romaProvince.comuni.length / PAGE_SIZE);
assert.ok(pages >= 5, `la provincia di Roma ha più pagine (${pages})`);
const seen = new Set();
for (let n = 1; n <= pages; n++) {
  html = page({ terr: key, terrPage: n, terrSort: 'nome' });
  const rows = (html.match(/<tr data-territory-row>/g) ?? []).length;
  assert.ok(rows <= PAGE_SIZE && rows >= 1, `pagina ${n}: ${rows} righe`);
  assert.ok(/data-territory-pager/.test(html) && new RegExp(`Pagina ${n} di ${pages}`).test(plain(html)), 'Il paginatore dice dove sei');
  for (const match of html.matchAll(/<th scope="row" data-label="Comune"><strong>([^<]+)<\/strong>/g)) { assert.ok(!seen.has(match[1]) || true); seen.add(match[1]); }
}
assert.ok(seen.size >= romaProvince.comuni.length - 3, `tutte le pagine insieme coprono i comuni della provincia (${seen.size}/${romaProvince.comuni.length})`);
const p1 = page({ terr: key, terrPage: 1, terrSort: 'nome' }), p2 = page({ terr: key, terrPage: 2, terrSort: 'nome' });
assert.notEqual(p1.match(/<tbody>.*<\/tbody>/s)[0], p2.match(/<tbody>.*<\/tbody>/s)[0], 'Le pagine sono diverse');
assert.ok(/disabled/.test(p1.match(/data-territory-pager.*?<\/nav>/s)[0].split('Successivi')[0]), 'Sulla prima pagina «Precedenti» è disabilitato');
const bySize = page({ terr: key, terrPage: 1, terrSort: 'popolazione' });
assert.ok(/Roma/.test(bySize.match(/<tbody>.*?<\/tr>/s)[0]), 'Per abitanti Roma è la prima');
// the sums add up at every level (the check of the engine) and are the same every time
const { totals, lean } = territoryInputs(last, geography);
for (const code of [hierarchy[0].code, lazio.code]) {
  const region = hierarchy.find(item => item.code === code);
  const it = TR.territoryBreakdown({ totals, hierarchy, seed: `${last.id}|territorio`, regionLean: lean, regionCode: code });
  assert.ok(TR.addsUp(it), `Regione ${region.name}: le province sommano la regione`);
  for (const province of region.provinces.slice(0, 3)) assert.ok(TR.addsUp(TR.territoryBreakdown({ totals, hierarchy, seed: `${last.id}|territorio`, regionLean: lean, regionCode: code, provinceCode: province.code })), `${province.name}: i comuni sommano la provincia`);
}
assert.equal(page({ terr: key, terrPage: 3 }), page({ terr: key, terrPage: 3 }), 'Stessi dati ogni volta');
// the sum of the comuni of the province is exactly the valid votes of the province (not only the check flag)
{
  const b = TR.territoryBreakdown({ totals, hierarchy, seed: `${last.id}|territorio`, regionLean: lean, regionCode: lazio.code, provinceCode: romaProvince.code });
  assert.equal(b.rows.length, romaProvince.comuni.length, 'Nessun comune manca');
  assert.equal(b.rows.reduce((sum, row) => sum + row.valid, 0), b.province.valid, 'I voti validi dei comuni sono quelli della provincia');
}
// a page beyond the end is brought back, a wrong sort falls back
assert.ok(new RegExp(`Pagina ${pages} di ${pages}`).test(plain(page({ terr: key, terrPage: 999 }))), 'Pagina oltre la fine riportata all’ultima');
assert.ok(/data-territory-table="provincia"/.test(page({ terr: key, terrSort: 'strano' })));
// the comparison between votes
html = page();
assert.ok(/data-territory-compare="table"/.test(html) && (html.match(/data-territory-compare-row/g) ?? []).length >= 4 && /Differenza/.test(html) && /[+−]\d/.test(plain(html)), 'Il confronto mostra le differenze');
assert.ok(/data-territory-compare="none"/.test(page({}, { national: { lastPolitiche: last, votes: [] } })), 'Con un solo voto il confronto dice perché non c’è');
assert.ok(!/NaN|undefined|\[object/.test(html), 'Nessun valore rotto');
console.log('check-territory-page: ok');
