// Which party a real parliamentarian belongs to, derived only from the database and never written in the UI:
// 1. a link made by the owner in the admin archive, 2. a documented membership (a verified party office),
// 3. the list the person was elected on, when that list belongs to a single party (document of 24/09/2026, §6).
// Multi-party lists stay electoral relations; coalition lists point to the coalition, never to one of its parties.
// The parliamentary group is never used as a substitute for the party.
import { realDatabase } from './real-data.js?v=20260924-21';

export const PARTY_LINK_COLLECTIONS = Object.freeze(['parties', 'politicalMovements', 'coalitions', 'electoralLists', 'partyMemberships']);
export const POLITICAL_POSITIONS = Object.freeze(['estrema sinistra', 'sinistra', 'centro-sinistra', 'centro', 'centro-destra', 'destra', 'estrema destra']);
// Left–right axis used by the simulation: −3 (estrema sinistra) … +3 (estrema destra).
export const positionAxis = position => { const index = POLITICAL_POSITIONS.indexOf(position); return index < 0 ? null : index - 3; };

const key = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('it-IT').replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
let cache = { db: null };
function index(db) {
  if (cache.db === db) return cache;
  const entities = new Map([...(db.parties ?? []), ...(db.politicalMovements ?? []), ...(db.coalitions ?? [])].map(item => [item.id, item]));
  const memberships = new Map();
  for (const item of db.partyMemberships ?? []) if (item.source === 'real' && item.verified === true && !memberships.has(item.politicianId)) memberships.set(item.politicianId, item);
  const lists = new Map((db.electoralLists ?? []).filter(item => item.chamber).map(item => [`${item.chamber}|${key(item.officialName)}`, item]));
  cache = { db, entities, memberships, lists };
  return cache;
}
// The canonical record: a MEF alias resolves to the registered party it names.
export function canonicalEntity(id, db = realDatabase) {
  const { entities } = index(db);
  const record = entities.get(id) ?? null;
  return record?.sameEntityAs ? entities.get(record.sameEntityAs) ?? record : record;
}

// { entity, basis, detail } or null when the database documents no party for the person.
export function politicianAffiliation(person, db = realDatabase) {
  if (!person) return null;
  const { entities, memberships, lists } = index(db);
  if (person.partyId && entities.has(person.partyId)) return { entity: canonicalEntity(person.partyId, db), basis: 'admin', detail: 'Collegamento dell’amministratore' };
  const membership = memberships.get(person.id);
  if (membership && entities.has(membership.partyId)) return { entity: canonicalEntity(membership.partyId, db), basis: 'membership', detail: membership.role ? `${membership.role} (incarico documentato)` : 'Iscrizione documentata' };
  const list = person.electedOnList ? lists.get(`${person.chamber}|${key(person.electedOnList)}`) : null;
  if (list?.partyId && entities.has(list.partyId)) return { entity: canonicalEntity(list.partyId, db), basis: 'list', detail: `Eletto nella lista ${list.officialName}` };
  if (list?.coalitionId && entities.has(list.coalitionId)) return { entity: entities.get(list.coalitionId), basis: 'coalition-list', detail: `Eletto nella lista di coalizione ${list.officialName}` };
  return null;
}
export const BASIS_LABELS = Object.freeze({ admin: 'collegamento dell’amministratore', membership: 'iscrizione documentata', list: 'partito della lista d’elezione', 'coalition-list': 'coalizione della lista d’elezione' });

// All parliamentarians linked to an entity, with the basis of each link.
export function linkedPoliticians(entityId, db = realDatabase) {
  const target = canonicalEntity(entityId, db)?.id ?? entityId;
  return (db.politicians ?? []).map(person => ({ person, link: politicianAffiliation(person, db) })).filter(item => item.link?.entity?.id === target);
}

// Parties of the real majority in office, derived from the members of the real government and their documented links.
export function governingEntityIds(db = realDatabase) {
  const government = (db.government ?? [])[0];
  if (!government) return [];
  const people = new Map((db.politicians ?? []).map(person => [person.id, person]));
  const byFigure = new Map((db.politicalFigures ?? []).filter(item => item.politicianId).map(item => [key(item.fullName), people.get(item.politicianId)]));
  const ids = new Set();
  for (const member of (government.members ?? []).filter(item => !item.endDate)) {
    const person = people.get(member.politicianId) ?? byFigure.get(key(member.fullName));
    const link = person ? politicianAffiliation(person, db) : null;
    if (link && ['membership', 'list'].includes(link.basis)) ids.add(link.entity.id);
  }
  return [...ids];
}
