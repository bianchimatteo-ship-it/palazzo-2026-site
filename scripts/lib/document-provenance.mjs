// The provenance rule for the real documents that are published with the game. Every document must be verified against its source (source «real», verified true, source name and address,
// date of the check). One document is the declared exception: the population of the comuni (ISTAT POSAS 2026), whose official comparison is still to be made. It is accepted only as
// what it says it is: not verified, with the explicit status, the declared source, the note that it is not a raw copy checked on the official ZIP, a manifest entry that says the same
// and counts that agree with the document (records, regions, total, date). Anything else that is not verified is refused. Returns the list of the problems (empty: accepted).
export const UNVERIFIED_EXCEPTION = Object.freeze({ name: 'municipalPopulation', status: 'derivato-da-tabella-pubblica-non-verificato-su-zip-ufficiale' });

export function documentProblems(name, document, manifestEntry = null) {
  const problems = [];
  const label = text => `${name}: ${text}`;
  if (!document || typeof document !== 'object') return [label('documento assente o illeggibile')];
  if (document.source !== 'real') problems.push(label('la fonte dichiarata non è «real»'));
  if (document.verified === true) {
    if (!(document.sourceUrl && document.sourceName && document.verifiedAt)) problems.push(label('provenienza non verificata'));
    return problems;
  }
  // not verified: only the one exception, and only if it is honest about it
  if (name !== UNVERIFIED_EXCEPTION.name) { problems.push(label('provenienza non verificata')); return problems; }
  if (document.verified !== false) problems.push(label('lo stato di verifica non è dichiarato (verified deve essere false)'));
  if (document.verificationStatus !== UNVERIFIED_EXCEPTION.status) problems.push(label('manca lo stato esplicito di verifica ufficiale incompleta'));
  if (!(document.sourceName && document.sourceUrl)) problems.push(label('la fonte dichiarata è incompleta'));
  if (!/NON sono una copia grezza verificata/.test(String(document.sourceNote ?? ''))) problems.push(label('manca la nota che il dataset non è una copia grezza verificata sullo ZIP ufficiale'));
  if (!manifestEntry) { problems.push(label('manca nel manifest')); return problems; }
  if (manifestEntry.verified !== false || manifestEntry.verificationStatus !== UNVERIFIED_EXCEPTION.status) problems.push(label('il manifest non dice lo stesso del documento (verified false e stato esplicito)'));
  const records = Array.isArray(document.records) ? document.records : [];
  const total = records.reduce((sum, record) => sum + (Number.isInteger(record.populationResident) ? record.populationResident : NaN), 0);
  if (manifestEntry.records !== records.length || document.totals?.municipalities !== records.length) problems.push(label(`i comuni non tornano (manifest ${manifestEntry.records}, documento ${records.length}, totali ${document.totals?.municipalities})`));
  if (manifestEntry.regions !== (document.regions ?? []).length || document.totals?.regions !== (document.regions ?? []).length) problems.push(label('le regioni non tornano'));
  if (!Number.isFinite(total) || document.totals?.populationResident !== total) problems.push(label(`il totale dei residenti non è la somma dei comuni (${document.totals?.populationResident} contro ${total})`));
  if (manifestEntry.residentReferenceDate !== document.totals?.referenceDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(document.totals?.referenceDate ?? ''))) problems.push(label('la data di riferimento non torna tra manifest e documento'));
  if (new Set(records.map(record => record.municipalityCode)).size !== records.length) problems.push(label('ci sono comuni duplicati'));
  const files = document.residentDataset?.files ?? {};
  if (!Object.keys(files).length || JSON.stringify(files) !== JSON.stringify(manifestEntry.filesSha256 ?? null)) problems.push(label('le impronte dei file di origine non coincidono con il manifest'));
  return problems;
}
