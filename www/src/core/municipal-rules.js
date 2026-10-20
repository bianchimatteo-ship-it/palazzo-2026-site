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
// A comune this close to the threshold (share of it) may change class with the population the law prescribes (the census), which the data set does not hold: the class is shown as uncertain.
const NEAR_THRESHOLD = 0.1;
export const MUNICIPAL_BANDS = Object.freeze({ small: 'fino-15000', large: 'oltre-15000' });
export const bandOfPopulation = population => Number(population) > MUNICIPAL_RULES.threshold ? MUNICIPAL_BANDS.large : MUNICIPAL_BANDS.small;
const whole = value => Number.isInteger(value) && value >= 0 ? value : null;

// code → record, from the document municipal-population.json (null while it is not imported).
export function indexMunicipalPopulation(doc) {
  const index = new Map();
  for (const record of Array.isArray(doc?.records) ? doc.records : []) if (/^\d{6}$/.test(record?.municipalityCode ?? '')) index.set(record.municipalityCode, record);
  // the totals ride on the same object: regions and provinces (sums of the comuni, computed by the importer), the country, and the source of it all
  index.regions = Array.isArray(doc?.regions) ? doc.regions : [];
  index.units = Array.isArray(doc?.units) ? doc.units : [];
  index.total = doc?.totals ?? null;
  index.provenance = doc ? { sourceName: doc.sourceName ?? null, sourceNote: doc.sourceNote ?? null, verified: doc.verified ?? null, verificationStatus: doc.verificationStatus ?? null, importedAt: doc.importedAt ?? null } : null;
  return index;
}

// The exact number of inhabitants, always: «1.234 abitanti · 01/01/2026» (never only the band under or over 15,000).
const dateOf = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') ? `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : 'data non indicata';
export const residentsLabel = (population, referenceDate) => `${Number(population).toLocaleString('it-IT')} ${Number(population) === 1 ? 'abitante' : 'abitanti'} · ${dateOf(referenceDate)}`;
// The text of a comune by its ISTAT code, from the data of the game (the same index the engines read).
export function residentsText(code, index = null) {
  const record = (index ?? shared).get(String(code ?? '')) ?? null;
  const resident = whole(record?.populationResident);
  return resident !== null ? residentsLabel(resident, record.populationReferenceDate) : 'popolazione non disponibile';
}

// { band, basis: 'riferimento-legale' | 'residente-indicativo' | 'nessun-dato', provisional, population, referenceDate, label, note }
export function municipalityBandInfo(code, index = new Map()) {
  const record = index.get(String(code ?? '')) ?? null;
  const legal = whole(record?.electoralPopulationReference);
  if (legal !== null) return { band: bandOfPopulation(legal), basis: 'riferimento-legale', provisional: false, population: legal, referenceDate: record.electoralPopulationReferenceDate ?? null, label: `${legal.toLocaleString('it-IT')} abitanti (${record.electoralPopulationReferenceType ?? 'riferimento legale'})`, note: 'Fascia dedotta dalla popolazione di riferimento prevista per le regole elettorali.' };
  const resident = whole(record?.populationResident);
  if (resident !== null) return { band: bandOfPopulation(resident), basis: 'residente-indicativo', provisional: true, nearThreshold: Math.abs(resident - MUNICIPAL_RULES.threshold) <= MUNICIPAL_RULES.threshold * NEAR_THRESHOLD, population: resident, referenceDate: record.populationReferenceDate ?? null, label: residentsLabel(resident, record.populationReferenceDate), note: 'La popolazione di riferimento legale non è ancora nei dati: la fascia usa la popolazione residente ISTAT, solo come indicazione.' };
  return { band: MUNICIPAL_BANDS.small, basis: 'nessun-dato', provisional: true, population: null, referenceDate: null, label: 'popolazione non disponibile', note: 'I dati demografici dei comuni non sono ancora stati importati (o questo comune non è nel file): si applicano le regole dei comuni fino a 15.000 abitanti, come ripiego dichiarato.' };
}

// What the class of the comune means, said without promises: the second round only exists if nobody passes half of the valid votes in the first, and how the seats of the council are shared is a
// simplification of the game, not the full text of the law. The references are those of the law the classes come from; the text in force is to be checked on the official source.
export const MUNICIPAL_LEGAL_REFERENCES = Object.freeze({
  law: 'D.Lgs. 18 agosto 2000, n. 267 (TUEL), artt. 71, 72 e 73; L. 25 marzo 1993, n. 81',
  threshold: 'Soglia di 15.000 abitanti: popolazione di riferimento prevista dalla legge per le regole elettorali (ultimo censimento), non la residente di oggi',
  verification: 'Riferimento indicato; il testo vigente non è stato verificato su Normattiva in questo progetto',
  document: 'docs/riferimenti-normativi-comunali.md'
});
export function bandDescription(info) {
  const large = info?.band === MUNICIPAL_BANDS.large;
  const population = Number.isFinite(info?.population) ? ` (${info.population.toLocaleString('it-IT')} abitanti)` : '';
  return large
    ? { title: `Oltre ${MUNICIPAL_RULES.threshold.toLocaleString('it-IT')} abitanti${population}`, body: 'Il sindaco è eletto al primo turno solo se supera la metà dei voti validi; altrimenti c’è il ballottaggio tra i due più votati. La ripartizione dei seggi in consiglio è semplificata nel gioco e non riproduce tutte le soglie di legge.' }
    : { title: `Fino a ${MUNICIPAL_RULES.threshold.toLocaleString('it-IT')} abitanti${population}`, body: 'Il sindaco è eletto in un solo turno: vince chi ha più voti, senza ballottaggio. La ripartizione dei seggi in consiglio è semplificata nel gioco e non riproduce tutte le soglie di legge.' };
}

// The index the game works with (set once when the document is loaded): the engines and the views read the class of a comune through bandOfMunicipality.
let shared = new Map();
export const setMunicipalPopulationIndex = index => { shared = index instanceof Map ? index : new Map(); };
export const bandOfMunicipality = code => municipalityBandInfo(code, shared);

// ---------- the resident population of a territory (always the sum of the comuni it includes, without duplicates): comune, province, region, Italy ----------
// null while the data are not there: nothing is estimated and no number is invented.
export const residentsOfMunicipality = (code, index = shared) => whole(index.get(String(code ?? ''))?.populationResident);
export const residentsOfRegion = (name, index = shared) => whole((index.regions ?? []).find(item => item.gameRegion === name || item.name === name)?.populationResident);
export const residentsOfUnit = (code, index = shared) => whole((index.units ?? []).find(item => item.code === String(code ?? ''))?.populationResident);
export const residentsOfItaly = (index = shared) => whole(index.total?.populationResident ?? null);
export const populationReferenceDate = (index = shared) => index.total?.referenceDate ?? null;
export const populationProvenance = (index = shared) => index.provenance ?? null;
