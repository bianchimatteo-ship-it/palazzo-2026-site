// The real vote of the general election of 25 September 2022 (Camera, proportional lists) by region, read from the districts of electoral-geography.json
// (Eligendo: the list votes of each of the 147 collegi, which cover the whole Italian territory). It is the one real regional figure the game holds: the regional
// polls of the simulation are estimates (national figure + regional offsets of the model), this is what the ballot boxes said. A force that did not run in 2022
// (a party born later, such as Futuro Nazionale) has no figure: nothing is invented for it. Pure functions on the document: nothing is saved.
import { LIST_FORCES } from './legislature-engine.js?v=20261016-2';

// Joint lists of the centre-right abroad and in Valle d’Aosta are not the vote of one party in a region.
const JOINT_LISTS = new Set(['CDXE', 'CDXVDA']);
const cache = new WeakMap();

function totals(geography) {
  if (cache.has(geography)) return cache.get(geography);
  const regions = {};
  for (const district of geography?.camera?.collegi ?? []) {
    const entry = regions[district.region] ??= { votes: {}, valid: 0 };
    for (const [code, votes] of Object.entries(district.votes ?? {})) { entry.votes[code] = (entry.votes[code] ?? 0) + votes; entry.valid += votes; }
  }
  const national = { votes: {}, valid: 0 };
  for (const entry of Object.values(regions)) { national.valid += entry.valid; for (const [code, votes] of Object.entries(entry.votes)) national.votes[code] = (national.votes[code] ?? 0) + votes; }
  const result = { regions, national };
  cache.set(geography, result);
  return result;
}

// The lists of 2022 that the game links to a force (documented links of legislature-engine), without the joint lists.
export const listsOfForce = partyId => Object.entries(LIST_FORCES).filter(([code, ids]) => ids.includes(partyId) && !JOINT_LISTS.has(code)).map(([code]) => code);

// { listCode, listName, shared, national, regions: { region: share % of the valid list votes } } or null when the force did not run in 2022.
export function forceRegionalVote2022(geography, partyId) {
  if (!geography?.camera?.collegi?.length) return null;
  const codes = listsOfForce(partyId);
  if (!codes.length) return null;
  const { regions, national } = totals(geography);
  const code = codes.find(item => (national.votes[item] ?? 0) > 0);
  if (!code) return null;
  // A list with no vote at all in a whole region was not on the ballot there (Valle d’Aosta votes the Camera in a single-member district, with no national lists):
  // the figure does not exist, which is not the same as 0%.
  const share = entry => entry.valid && (entry.votes[code] ?? 0) > 0 ? Math.round(entry.votes[code] / entry.valid * 10000) / 100 : null;
  return {
    listCode: code,
    listName: geography.lists?.find(item => item.code === code)?.name ?? code,
    // A list shared by two parties (Azione–Italia Viva) is one vote for both: said, not split.
    shared: (LIST_FORCES[code] ?? []).length > 1,
    national: share(national),
    regions: Object.fromEntries(Object.entries(regions).map(([region, entry]) => [region, share(entry)])),
    source: geography.sourceName ?? 'Ministero dell’Interno — Eligendo',
    date: geography.electionDate ?? '2022-09-25'
  };
}
