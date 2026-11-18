// Results of a SIMULATED vote by territory: Italy → Region → Province → Comune, always adding up. The game does not simulate every comune one by one: it takes the result of the vote (the votes of each
// list in the country) and shares it down the levels in proportion to the inhabitants (ISTAT, population of the comuni) with a regional lean (how much each list weighs more or less in a Region than in
// the country, from the model of the polls) and a small local deviation that is drawn from the keys (the same vote gives the same figures). The shares are exact (largest remainder): the comuni of a
// Province add up to the Province, the Provinces of a Region to the Region, the Regions to the country, list by list. Nothing here is an official figure and the page says so; the official data of the
// real 2022 vote exist only by Region (the uninominal colleges do not coincide with Provinces and comuni): the page does not invent a lower level for it.
import { seededRandom } from './vote-engine.js?v=20261118-32';

// Share an integer total among the children by weights, exactly (largest remainder), never below zero.
export function shareExactly(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0) || !(sum > 0)) return weights.map(() => 0);
  const exact = weights.map(value => total * value / sum);
  const base = exact.map(Math.floor);
  let left = total - base.reduce((a, b) => a + b, 0);
  exact.map((value, index) => ({ index, rest: value - Math.floor(value) })).sort((a, b) => b.rest - a.rest || a.index - b.index).forEach(item => { if (left > 0) { base[item.index]++; left--; } });
  return base;
}
// totals: { key: votes }; children: [{ id, weight }]; deviation(childId, key) → multiplier. Returns { childId: { key: votes } } adding up to totals.
export function distribute(totals, children, { seed = 'territorio', spread = 0.22, lean = null } = {}) {
  const out = Object.fromEntries(children.map(child => [child.id, {}]));
  for (const [key, total] of Object.entries(totals)) {
    const weights = children.map(child => {
      const rand = seededRandom(`${seed}|${child.id}|${key}`);
      const deviation = 1 + (rand() - 0.5) * 2 * spread;
      return Math.max(0, child.weight * deviation * (lean?.(child.id, key) ?? 1));
    });
    const parts = shareExactly(Math.round(total), weights);
    children.forEach((child, index) => { out[child.id][key] = parts[index]; });
  }
  return out;
}

// The tree of the territory from the population index of the game (indexMunicipalPopulation): regions with their provinces and comuni.
// unitOf: { [comune code]: unit code } from the list of the comuni (municipalities.json): the metropolitan cities have their own unit codes (Torino 201, Milano 215…), not the prefix of the code of the comune.
export function buildHierarchy(index, municipalities = []) {
  const unitOf = new Map((municipalities ?? []).map(item => [item.code, item.unit]));
  const regions = (index?.regions ?? []).map(region => ({ code: region.code, name: region.name, gameRegion: region.gameRegion ?? region.name, population: region.populationResident, provinces: [] }));
  const byRegion = new Map(regions.map(region => [region.code, region]));
  const provinces = new Map();
  for (const unit of index?.units ?? []) { const region = byRegion.get(unit.regionCode); if (!region) continue; const province = { code: unit.code, name: unit.name, regionCode: unit.regionCode, population: unit.populationResident, comuni: [] }; provinces.set(`${unit.regionCode}|${unit.code}`, province); region.provinces.push(province); }
  for (const [code, record] of index?.entries?.() ?? []) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) continue;
    const province = provinces.get(`${record.regionCode}|${unitOf.get(code) ?? code.slice(0, 3)}`) ?? provinces.get(`${record.regionCode}|${code.slice(0, 3)}`);
    if (province) province.comuni.push({ code, name: record.name, population: record.populationResident });
  }
  for (const region of regions) { region.provinces.sort((a, b) => a.name.localeCompare(b.name, 'it')); for (const province of region.provinces) province.comuni.sort((a, b) => a.name.localeCompare(b.name, 'it')); }
  return regions.sort((a, b) => a.name.localeCompare(b.name, 'it'));
}
// LOCAL EFFECTS (candidates, campaigns, territorial activities): a list of { level: 'regione'|'provincia'|'comune', code, key, factor, why }, where `factor` is a multiplier of the weight of the list `key` in that
// territory (1 = no effect; > 1 more votes there). They are applied to the SAME exact split as everything else, so every level still adds up to the one above and the national result does not move: an effect only
// moves votes between the siblings of one parent (a comune gains what the others of its province lose). Deterministic (no randomness), only the factors given are applied, and a factor is clamped to [0.5, 1.8].
// The engine records no per-comune data of candidates or campaigns (its campaign areas are zones of ONE election): the effects must come from real, declared inputs (the home place of the candidate, a recorded
// territorial activity); nothing here invents history. `effectsFromHome` is the one builder the game uses today.
export const LOCAL_FACTOR = Object.freeze({ min: 0.5, max: 1.8 });
export function localLeanOf(effects = []) {
  const table = new Map();
  for (const effect of effects ?? []) {
    const factor = Math.min(LOCAL_FACTOR.max, Math.max(LOCAL_FACTOR.min, Number(effect?.factor)));
    if (!effect?.level || !effect?.code || !effect?.key || !Number.isFinite(factor)) continue;
    const id = `${effect.level}|${effect.code}|${effect.key}`;
    table.set(id, (table.get(id) ?? 1) * factor);
  }
  return (level, code, key) => table.get(`${level}|${code}|${key}`) ?? 1;
}
// A candidate (or a campaign) concentrated on the home territory of a list: the effect is strongest in the home comune, weaker in its province (60% of the gap from 1) and in the region (30%).
// `edge` is the relative advantage the campaign gave to the list, as a fraction (0.2 = +20% weight at home); it must come from the recorded result, not from a guess.
export function effectsFromHome({ hierarchy, comuneCode, key, edge = 0 }) {
  if (!comuneCode || !key || !Number.isFinite(edge) || edge === 0) return [];
  for (const region of hierarchy ?? []) for (const province of region.provinces) if (province.comuni.some(item => item.code === comuneCode)) return [
    { level: 'comune', code: comuneCode, key, factor: 1 + edge, why: 'comune di residenza del candidato' },
    { level: 'provincia', code: province.code, key, factor: 1 + edge * 0.6, why: 'provincia del candidato' },
    { level: 'regione', code: region.code, key, factor: 1 + edge * 0.3, why: 'regione del candidato' }
  ];
  return [];
}
// regionLean: { [gameRegion]: { [key]: multiplier } } (default 1). `local`: the function of localLeanOf(effects) (optional).
export function territoryBreakdown({ totals, hierarchy, seed = 'voto', regionLean = {}, regionCode = null, provinceCode = null, local = null }) {
  const rows = (items, votes, kind, parent) => items.map(item => ({ kind, code: item.code, name: item.name, population: item.population, votes: votes[item.code] ?? {}, valid: Object.values(votes[item.code] ?? {}).reduce((a, b) => a + b, 0), parent }));
  const regionVotes = distribute(totals, hierarchy.map(region => ({ id: region.code, weight: region.population })), { seed: `${seed}|regioni`, spread: 0.06, lean: (id, key) => (regionLean[hierarchy.find(r => r.code === id)?.gameRegion]?.[key] ?? 1) * (local?.('regione', id, key) ?? 1) });
  const italy = { kind: 'italia', code: 'IT', name: 'Italia', population: hierarchy.reduce((s, r) => s + r.population, 0), votes: totals, valid: Object.values(totals).reduce((a, b) => a + b, 0) };
  if (!regionCode) return { level: 'italia', italy, rows: rows(hierarchy, regionVotes, 'regione', italy) };
  const region = hierarchy.find(item => item.code === regionCode);
  if (!region) return { level: 'italia', italy, rows: rows(hierarchy, regionVotes, 'regione', italy) };
  const regionRow = rows([region], regionVotes, 'regione', italy)[0];
  const provinceVotes = distribute(regionVotes[region.code], region.provinces.map(item => ({ id: item.code, weight: item.population })), { seed: `${seed}|${region.code}|province`, spread: 0.12, lean: local ? (id, key) => local('provincia', id, key) : null });
  if (!provinceCode) return { level: 'regione', italy, region: regionRow, rows: rows(region.provinces, provinceVotes, 'provincia', regionRow) };
  const province = region.provinces.find(item => item.code === provinceCode);
  if (!province) return { level: 'regione', italy, region: regionRow, rows: rows(region.provinces, provinceVotes, 'provincia', regionRow) };
  const provinceRow = rows([province], provinceVotes, 'provincia', regionRow)[0];
  const comuneVotes = distribute(provinceVotes[province.code], province.comuni.map(item => ({ id: item.code, weight: item.population })), { seed: `${seed}|${province.code}|comuni`, spread: 0.2, lean: local ? (id, key) => local('comune', id, key) : null });
  return { level: 'provincia', italy, region: regionRow, province: provinceRow, rows: rows(province.comuni, comuneVotes, 'comune', provinceRow) };
}
// Does every level add up? (the check that the page and the test run)
export function addsUp(breakdown) {
  const sums = rows => rows.reduce((acc, row) => { for (const [key, value] of Object.entries(row.votes)) acc[key] = (acc[key] ?? 0) + value; return acc; }, {});
  const parent = breakdown.province ?? breakdown.region ?? breakdown.italy;
  const sum = sums(breakdown.rows);
  return Object.keys(parent.votes).every(key => (sum[key] ?? 0) === (parent.votes[key] ?? 0)) && Object.keys(sum).every(key => key in parent.votes);
}
