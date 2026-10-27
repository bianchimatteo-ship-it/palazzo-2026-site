// How much of a region an institution is. A comune (or a province) that approves a measure changes its own territory; what reaches the indicators of the region is that
// territory's weight in the region, never a flat share: a village of two thousand inhabitants does not move the services of the whole region, and the effects never reach the
// other municipalities (they have their own indicators). The weight comes from the resident population (ISTAT), capped by the shares the rules give to a comune and a province; where
// the population is not known the share is the small `UNKNOWN_SHARE`, declared, never the cap.
import { CITY_SHARE_OF_REGION, PROVINCE_SHARE_OF_REGION } from '../data/simulation/local-acts.js?v=20261027-2';
import { residentsOfMunicipality, residentsOfRegion, residentsOfUnit } from './municipal-rules.js?v=20261027-2';

export const UNKNOWN_SHARE = 0.02;
export function regionShareOf(inst) {
  if (!inst || !['comune', 'provincia'].includes(inst.kind)) return 1;
  const cap = inst.kind === 'provincia' ? PROVINCE_SHARE_OF_REGION : CITY_SHARE_OF_REGION;
  const region = residentsOfRegion(inst.region ?? inst.place?.region ?? null);
  const own = inst.kind === 'provincia' ? residentsOfUnit(inst.place?.provinceCode) : residentsOfMunicipality(inst.place?.municipalityCode);
  if (!region || !own) return Math.min(cap, UNKNOWN_SHARE);
  return Math.round(Math.min(cap, own / region) * 10000) / 10000;
}
