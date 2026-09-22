// Entity contracts are intentionally source-aware: imported real-world facts and
// simulation output must never share an implicit provenance.
export const DATA_SOURCES = Object.freeze({ REAL: 'real', SIMULATION: 'simulation', USER: 'user' });
export const PROVENANCE_FIELDS = Object.freeze(['source', 'verified', 'sourceUrl', 'sourceName', 'verifiedAt', 'validFrom', 'validTo']);

// Relational collections for political reference data. Memberships and offices
// are first-class records and are never joined by display name.
export const POLITICAL_COLLECTIONS = Object.freeze([
  'parties', 'politicalMovements', 'parliamentaryGroups', 'coalitions', 'electoralLists',
  'politicians', 'offices', 'partyMemberships', 'groupMemberships', 'electionParticipations',
  'partyMembershipHistory', 'parliamentaryGroupHistory', 'officeHistory', 'territories', 'elections'
]);

export function validateRealRecord(record, collection = 'record') {
  if (!record || record.source !== DATA_SOURCES.REAL || record.verified !== true) throw new Error(`${collection}: dato reale non verificato`);
  for (const key of ['id', 'sourceUrl', 'sourceName', 'verifiedAt']) {
    if (!record[key]) throw new Error(`${collection}: manca ${key}`);
  }
  return record;
}

// Canonical fields for repository adapters and future save migrations.
// `source` is required on every record to preserve data provenance end-to-end.
export const ENTITY_FIELDS = Object.freeze({
  politicians: ['id', 'firstName', 'lastName', 'displayName', 'birthDate', 'gender', 'region', 'municipality', 'previousProfession', 'partyId', 'territoryId', 'roleId', 'source', 'createdAt'],
  parties: ['id', 'name', 'abbreviation', 'description', 'color', 'orientation', 'policyPositions', 'source', 'sourceRef', 'verified', 'createdAt', 'foundedAt'],
  elections: ['id', 'name', 'level', 'date', 'territoryId', 'electionType', 'status', 'source'],
  territories: ['id', 'kind', 'name', 'parentId', 'source'],
  offices: ['id', 'title', 'institution', 'level', 'politicianId', 'territoryId', 'startDate', 'endDate', 'source'],
  statistics: ['id', 'subjectId', 'metric', 'value', 'unit', 'asOf', 'source'],
  events: ['id', 'title', 'date', 'category', 'status', 'territoryId', 'impact', 'source'],
  laws: ['id', 'title', 'summary', 'status', 'chamberId', 'introducedAt', 'source'],
  chambers: ['id', 'kind', 'name', 'source', 'verified']
});
const REQUIRED_FIELDS = Object.freeze({
  politicians: ['id', 'firstName', 'lastName', 'source'], parties: ['id', 'name', 'abbreviation', 'source'],
  elections: ['id', 'name', 'level', 'date', 'electionType', 'source'], territories: ['id', 'kind', 'name', 'source'],
  offices: ['id', 'title', 'institution', 'level', 'startDate', 'source'], statistics: ['id', 'subjectId', 'metric', 'value', 'asOf', 'source'],
  events: ['id', 'title', 'date', 'category', 'status', 'source'], laws: ['id', 'title', 'status', 'introducedAt', 'source'],
  chambers: ['id', 'kind', 'name', 'source', 'verified']
});

export const isSelectableParty = party => party?.source === DATA_SOURCES.SIMULATION || (party?.source === DATA_SOURCES.REAL && party.verified === true);

export function validateEntity(collection, record) {
  const required = REQUIRED_FIELDS[collection];
  if (!required || !record || typeof record !== 'object') throw new Error(`Collezione o record non valido: ${collection}`);
  const missing = required.filter(key => !(key in record));
  if (missing.length) throw new Error(`${collection}: campi mancanti (${missing.join(', ')})`);
  const unexpected = Object.keys(record).filter(key => !ENTITY_FIELDS[collection].includes(key));
  if (unexpected.length) throw new Error(`${collection}: campi non riconosciuti (${unexpected.join(', ')})`);
  if (!Object.values(DATA_SOURCES).includes(record.source)) throw new Error(`${collection}: provenienza non valida`);
  return record;
}

export const emptyDataset = () => ({
  politicians: [], parties: [], elections: [], territories: [], offices: [], statistics: [], events: [], laws: [],
  chambers: [],
  territorialKinds: ['comune', 'provincia', 'citta-metropolitana', 'regione', 'stato']
});
