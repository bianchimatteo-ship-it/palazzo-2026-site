// Party, parliamentary group, component and election list of a real parliamentarian: four different things, derived
// only from the database (with the owner's corrections applied) and never written in the UI.
// - Party (current): 1. a link made by the owner in the admin archive, 2. a documented membership (a verified party
//   office or adhesion). Nothing else: the group is never a party, and the 2022 election list is never taken as the
//   current party (people change party during the legislature).
// - Election list: the list the person was elected on in 2022, with the party or coalition it belongs to — an
//   electoral relation, shown apart.
// - Group and component: in the Camera open data the components of the Misto group are listed as groups named
//   "MISTO-…": they are shown as group Misto, component "…".
import { pristineRecord, realDatabase } from './real-data.js?v=20260925-4';

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
  for (const item of db.partyMemberships ?? []) if (item.source === 'real' && item.verified === true && !item.validTo && !memberships.has(item.politicianId)) memberships.set(item.politicianId, item);
  const lists = new Map((db.electoralLists ?? []).filter(item => item.chamber).map(item => [`${item.chamber}|${key(item.officialName)}`, item]));
  const groups = new Map((db.parliamentaryGroups ?? []).map(item => [item.id, item]));
  cache = { db, entities, memberships, lists, groups };
  return cache;
}
// The canonical record: a MEF alias resolves to the registered party it names.
export function canonicalEntity(id, db = realDatabase) {
  const { entities } = index(db);
  const record = entities.get(id) ?? null;
  return record?.sameEntityAs ? entities.get(record.sameEntityAs) ?? record : record;
}
// A parliamentarian is in office until the end of the mandate recorded in the database.
export const inOffice = (person, date = realDatabase.manifest?.snapshotDate ?? null) => Boolean(person) && (!person.termEnd || (date ? person.termEnd > date : false));

// Current party: { entity, basis, detail } or null when neither the owner nor a documented membership says it.
export function politicianAffiliation(person, db = realDatabase) {
  if (!person) return null;
  const { entities, memberships } = index(db);
  if (person.partyId && entities.has(person.partyId)) return { entity: canonicalEntity(person.partyId, db), basis: 'admin', detail: 'Collegamento dell’amministratore' };
  const membership = memberships.get(person.id);
  if (membership && entities.has(membership.partyId)) return { entity: canonicalEntity(membership.partyId, db), basis: 'membership', detail: membership.role ? `${membership.role} (documentato)` : 'Iscrizione documentata', sourceUrl: membership.sourceUrl ?? null, sourceName: membership.sourceName ?? null };
  return null;
}
export const BASIS_LABELS = Object.freeze({ admin: 'collegamento dell’amministratore', membership: 'iscrizione documentata', list: 'lista d’elezione di un solo partito', 'coalition-list': 'lista di coalizione', 'multi-party-list': 'lista di più partiti' });

// The 2022 election list and what it belongs to (an electoral relation, not the current party).
export function electionListOf(person, db = realDatabase) {
  if (!person?.electedOnList) return null;
  const { entities, lists } = index(db);
  const list = lists.get(`${person.chamber}|${key(person.electedOnList)}`) ?? null;
  const entity = list?.partyId ? canonicalEntity(list.partyId, db) : list?.coalitionId ? entities.get(list.coalitionId) ?? null : null;
  const kind = list?.partyId ? 'list' : list?.coalitionId ? 'coalition-list' : 'multi-party-list';
  return { label: list?.officialName ?? person.electedOnList, list, entity, kind, basis: BASIS_LABELS[kind] };
}

// Group and component. The owner's group wins; a group of the other Chamber (an evident slip) is read as the group
// with the same name in the person's Chamber, and flagged so the owner can fix it.
const MISTO = /^misto$/i;
const COMPONENT = /^MISTO\s*[-–]\s*(.+)$/i;
export function groupAffiliation(person, db = realDatabase) {
  if (!person) return null;
  const { groups } = index(db);
  let group = groups.get(person.groupId) ?? null;
  let corrected = false;
  if (group && person.chamber && group.chamber !== person.chamber) {
    const same = [...groups.values()].find(item => item.chamber === person.chamber && key(item.officialName) === key(group.officialName));
    if (same) { group = same; corrected = true; }
  }
  if (!group) return null;
  const misto = [...groups.values()].find(item => item.chamber === group.chamber && MISTO.test(item.officialName.trim())) ?? null;
  const own = group.officialName.match(COMPONENT);
  if (own) return { group: misto ?? group, groupName: 'Misto', component: own[1].trim(), componentGroup: group, corrected };
  // The owner placed the person in the Misto group: the component recorded in the database, when there is one, stays.
  if (MISTO.test(group.officialName.trim())) {
    const base = pristineRecord('politicians', person.id);
    const baseGroup = base ? groups.get(base.groupId) : null;
    const component = baseGroup?.chamber === group.chamber ? baseGroup.officialName.match(COMPONENT)?.[1]?.trim() ?? null : null;
    return { group, groupName: 'Misto', component, componentGroup: component ? baseGroup : null, corrected };
  }
  return { group, groupName: group.officialName, component: null, componentGroup: null, corrected };
}
export const groupLabel = affiliation => affiliation ? `${affiliation.groupName}${affiliation.component ? ` · componente ${affiliation.component}` : ''}` : null;

// Parliamentarians in office linked to an entity (current party), with the basis of each link.
export function linkedPoliticians(entityId, db = realDatabase) {
  const target = canonicalEntity(entityId, db)?.id ?? entityId;
  return (db.politicians ?? []).filter(person => inOffice(person, db.manifest?.snapshotDate)).map(person => ({ person, link: politicianAffiliation(person, db) })).filter(item => item.link?.entity?.id === target);
}
// Parliamentarians in office elected in 2022 on a list of the entity: an electoral relation, listed apart.
export function electedOnListsOf(entityId, db = realDatabase) {
  const target = canonicalEntity(entityId, db)?.id ?? entityId;
  return (db.politicians ?? []).filter(person => inOffice(person, db.manifest?.snapshotDate)).map(person => ({ person, list: electionListOf(person, db) })).filter(item => item.list?.entity?.id === target);
}

// Parties of the real majority in office: the current parties (owner's links or documented memberships) of the
// members of the real government.
export function governingEntityIds(db = realDatabase) {
  const government = (db.government ?? [])[0];
  if (!government) return [];
  const people = new Map((db.politicians ?? []).map(person => [person.id, person]));
  const byFigure = new Map((db.politicalFigures ?? []).filter(item => item.politicianId).map(item => [key(item.fullName), people.get(item.politicianId)]));
  const ids = new Set();
  for (const member of (government.members ?? []).filter(item => !item.endDate)) {
    const person = people.get(member.politicianId) ?? byFigure.get(key(member.fullName));
    const link = person ? politicianAffiliation(person, db) : null;
    if (link) ids.add(link.entity.id);
  }
  return [...ids];
}
