// The weight of a territory in a vote is a fact about the vote, not a share to split evenly: for the general and European elections it comes from the valid votes of the last real general
// election (Eligendo, src/data/real/electoral-geography.json), region by region, for the chamber that is voted. Where the data are not there, the weight is uniform and says so
// (`weightBasis: 'uniforme-dati-mancanti'`): nothing is hidden. Local, provincial and regional votes have their own territories and their own weights (the areas of the electorate),
// which are rules of the game and are declared as such.
const round2 = value => Math.round(value * 100) / 100;
// The five European constituencies and the regions that form them (law 18/1979).
export const EUROPEAN_CIRCUMSCRIPTIONS = Object.freeze({
  'nord-occidentale': ['Piemonte', 'Valle d’Aosta', 'Lombardia', 'Liguria'],
  'nord-orientale': ['Veneto', 'Trentino-Alto Adige', 'Friuli-Venezia Giulia', 'Emilia-Romagna'],
  centrale: ['Toscana', 'Umbria', 'Marche', 'Lazio'],
  meridionale: ['Abruzzo', 'Molise', 'Campania', 'Puglia', 'Basilicata', 'Calabria'],
  insulare: ['Sicilia', 'Sardegna']
});
// A list of values turned into percentages that add up to exactly 100 (two decimals, largest remainder).
export function percentages(values) {
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return null;
  const raw = Object.entries(values).map(([key, value]) => [key, value / total * 100]);
  const floors = raw.map(([key, value]) => [key, Math.floor(value * 100) / 100, value * 100 - Math.floor(value * 100)]);
  let missing = Math.round((100 - floors.reduce((sum, [, value]) => sum + value, 0)) * 100);
  const byRemainder = [...floors].sort((a, b) => b[2] - a[2]);
  const bonus = new Map();
  for (const [key] of byRemainder) { if (missing <= 0) break; bonus.set(key, 0.01); missing--; }
  return Object.fromEntries(floors.map(([key, value]) => [key, round2(value + (bonus.get(key) ?? 0))]));
}
export function validVotesByRegion(geography, chamber = 'camera') {
  const rows = geography?.[chamber === 'senato' ? 'senato' : 'camera']?.collegi;
  if (!Array.isArray(rows) || !rows.length) return null;
  const byRegion = {};
  for (const row of rows) if (row.region && Number.isFinite(row.valid) && row.valid > 0) byRegion[row.region] = (byRegion[row.region] ?? 0) + row.valid;
  return Object.keys(byRegion).length ? byRegion : null;
}
// { weights: { region: percent }, basis, source } or null.
export function regionWeights(geography, chamber = 'camera') {
  const byRegion = validVotesByRegion(geography, chamber);
  const weights = byRegion ? percentages(byRegion) : null;
  if (!weights) return null;
  return { weights, basis: `voti validi delle politiche ${String(geography.electionDate ?? '2022').slice(0, 4)} (${chamber === 'senato' ? 'Senato' : 'Camera'}), per regione`, source: geography.sourceName ?? 'Eligendo' };
}
export function europeanWeights(geography) {
  const byRegion = validVotesByRegion(geography, 'camera');
  if (!byRegion) return null;
  const byArea = Object.fromEntries(Object.entries(EUROPEAN_CIRCUMSCRIPTIONS).map(([id, regions]) => [id, regions.reduce((sum, region) => sum + (byRegion[region] ?? 0), 0)]));
  const weights = percentages(byArea);
  return weights ? { weights, basis: `voti validi delle politiche ${String(geography.electionDate ?? '2022').slice(0, 4)} (Camera), sommati per circoscrizione europea`, source: geography.sourceName ?? 'Eligendo' } : null;
}
// What the campaign needs: the weights of each vote, whatever the geography allows.
export const territoryWeightsOf = geography => geography ? { camera: regionWeights(geography, 'camera'), senato: regionWeights(geography, 'senato'), europee: europeanWeights(geography) } : null;
