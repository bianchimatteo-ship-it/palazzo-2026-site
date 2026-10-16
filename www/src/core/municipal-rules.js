// The size class of a comune decides the electoral rules of the game (the council, the second round, the majority bonus). It comes from the data of the comune, never from a choice of
// the player and never from a default that a data set could contradict:
//   - the reference the law prescribes for the electoral rules is the population of the last official census (D.Lgs. 267/2000, art. 37 and the rules on the electoral systems: more than
//     15,000 inhabitants – the double round – or up to 15,000 – a single round); it is `electoralPopulationReference` of src/data/real/municipal-population.json;
//   - while that reference is not determined for a comune, the resident population of ISTAT (1 January 2026) is used as an indication and the class is declared provisional;
//   - while neither is known (the data set is not imported, or the comune is not in it) the rules of the smaller class apply, as a declared fallback.
// Nothing is estimated: a number that the data set does not hold is never invented.
export const MUNICIPAL_RULES = Object.freeze({
  threshold: 15000,
  // 15,000 inhabitants is still “up to 15,000”: the double round starts above it.
  source: 'D.Lgs. 267/2000 (TUEL), art. 37 e disciplina elettorale dei comuni: la fascia dipende dalla popolazione del censimento ufficiale'
});
export const MUNICIPAL_BANDS = Object.freeze({ small: 'fino-15000', large: 'oltre-15000' });
export const bandOfPopulation = population => Number(population) > MUNICIPAL_RULES.threshold ? MUNICIPAL_BANDS.large : MUNICIPAL_BANDS.small;
const whole = value => Number.isInteger(value) && value >= 0 ? value : null;

// code → record, from the document municipal-population.json (null while it is not imported).
export function indexMunicipalPopulation(doc) {
  const index = new Map();
  for (const record of Array.isArray(doc?.records) ? doc.records : []) if (/^\d{6}$/.test(record?.municipalityCode ?? '')) index.set(record.municipalityCode, record);
  return index;
}

// { band, basis: 'riferimento-legale' | 'residente-indicativo' | 'nessun-dato', provisional, population, referenceDate, label, note }
export function municipalityBandInfo(code, index = new Map()) {
  const record = index.get(String(code ?? '')) ?? null;
  const legal = whole(record?.electoralPopulationReference);
  if (legal !== null) return { band: bandOfPopulation(legal), basis: 'riferimento-legale', provisional: false, population: legal, referenceDate: record.electoralPopulationReferenceDate ?? null, label: `${legal.toLocaleString('it-IT')} abitanti (${record.electoralPopulationReferenceType ?? 'riferimento legale'})`, note: 'Fascia dedotta dalla popolazione di riferimento prevista per le regole elettorali.' };
  const resident = whole(record?.populationResident);
  if (resident !== null) return { band: bandOfPopulation(resident), basis: 'residente-indicativo', provisional: true, population: resident, referenceDate: record.populationReferenceDate ?? null, label: `${resident.toLocaleString('it-IT')} residenti al ${record.populationReferenceDate ?? 'data non indicata'}`, note: 'La popolazione di riferimento legale non è ancora nei dati: la fascia usa la popolazione residente ISTAT, solo come indicazione.' };
  return { band: MUNICIPAL_BANDS.small, basis: 'nessun-dato', provisional: true, population: null, referenceDate: null, label: 'popolazione non disponibile', note: 'I dati demografici dei comuni non sono ancora stati importati (o questo comune non è nel file): si applicano le regole dei comuni fino a 15.000 abitanti, come ripiego dichiarato.' };
}

// The index the game works with (set once when the document is loaded): the engines and the views read the class of a comune through bandOfMunicipality.
let shared = new Map();
export const setMunicipalPopulationIndex = index => { shared = index instanceof Map ? index : new Map(); };
export const bandOfMunicipality = code => municipalityBandInfo(code, shared);
