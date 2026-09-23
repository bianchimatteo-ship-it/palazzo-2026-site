// Real parliamentarians the player deals with. Identity fields (name, chamber, group,
// circoscrizione, verified office) are copied unchanged from the verified dataset; the
// relationship, support and initiatives around them are simulation and labelled as such.
const SIM = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const key = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').replace(/[^a-z]/g, '');
const rankOf = (seedText, id) => [...`${seedText}|${id}`].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 11);
export const CONTACT_LIMIT = 8;

function identity(person, groups, role = null) {
  const group = groups.find(item => item.id === person.groupId);
  return {
    id: person.id, fullName: person.fullName, chamber: person.chamber, groupId: person.groupId ?? null, groupName: group?.officialName ?? null,
    circoscription: person.circoscription ?? null, verifiedRole: role?.title ?? null, roleSourceUrl: role?.sourceUrl ?? null,
    sourceUrl: person.sourceUrl ?? null, sourceName: person.sourceName ?? null, source: 'real', verified: true
  };
}

// Picks who matters for this career: elected in the player's region, colleagues of the group, group leaders.
export function selectContacts({ politicians = [], groups = [], offices = [], region = null, chamber = null, groupId = null, seedText = '' }) {
  const verified = politicians.filter(person => person.source === 'real' && person.verified === true && !person.termEnd);
  const byRank = list => [...list].sort((a, b) => rankOf(seedText, a.id) - rankOf(seedText, b.id));
  const picked = new Map();
  const add = (person, reason, role = null) => { if (person && !picked.has(person.id) && picked.size < CONTACT_LIMIT) picked.set(person.id, { person: identity(person, groups, role), reason }); };
  const leaders = offices.filter(office => office.source === 'real' && office.verified === true && !office.endDate && /^Presidente del gruppo/.test(office.title ?? ''));
  const leaderOf = id => leaders.find(office => office.politicianId === id) ?? null;
  // The leader of the player's own group, when the dataset documents one.
  if (groupId) {
    const office = leaders.find(item => verified.find(person => person.id === item.politicianId)?.groupId === groupId);
    if (office) add(verified.find(person => person.id === office.politicianId), 'capogruppo', office);
    for (const person of byRank(verified.filter(item => item.groupId === groupId && item.chamber === chamber)).slice(0, 2)) add(person, 'gruppo', leaderOf(person.id));
  }
  const target = key(region);
  if (target) {
    const local = byRank(verified.filter(person => key(person.circoscription).startsWith(target)));
    const groupsSeen = new Set();
    for (const person of local) {
      if (groupsSeen.has(person.groupId)) continue;
      groupsSeen.add(person.groupId);
      add(person, 'territorio', leaderOf(person.id));
      if (groupsSeen.size >= 4) break;
    }
  }
  for (const office of byRank(leaders.map(item => ({ ...item, id: item.politicianId }))).slice(0, 2)) add(verified.find(person => person.id === office.politicianId), 'capogruppo', office);
  return [...picked.values()];
}

// Merges a new selection with the saved relationships: people already met keep their history.
export function syncContacts(existing = [], selection = [], { week = 1, rand = Math.random } = {}) {
  const known = new Map(existing.map(item => [item.person.id, item]));
  const next = selection.map(({ person, reason }) => {
    const previous = known.get(person.id);
    return previous ? { ...previous, person, reason } : { person, reason, relation: Math.round(42 + rand() * 16), lastMetWeek: null, since: week, history: [], cosigned: [], source: SIM };
  });
  // People met before stay in the address book even when they are no longer pertinent.
  for (const item of existing) if (!next.some(entry => entry.person.id === item.person.id) && item.lastMetWeek) next.push(item);
  return next;
}

export function changeContact(contacts, personId, delta, note = null, week = null) {
  const contact = contacts.find(item => item.person.id === personId);
  if (!contact || !delta) return null;
  contact.relation = Math.round(clamp(contact.relation + delta));
  if (note) contact.history = [{ week, note, delta, source: SIM }, ...(contact.history ?? [])].slice(0, 8);
  return contact;
}

export function contactStance(relation) {
  if (relation >= 68) return ['alleato', 'Disponibile a sostenerti'];
  if (relation >= 55) return ['cordiale', 'Rapporto cordiale'];
  if (relation >= 35) return ['neutrale', 'Rapporto neutrale'];
  return ['ostile', 'Contrario alle tue iniziative'];
}

// Weekly drift and, now and then, an initiative that comes from the concrete situation.
export function advanceContacts(contacts = [], { rand, openLaw = null, seat = false, region = null }) {
  for (const contact of contacts) contact.relation = Math.round((contact.relation + (50 - contact.relation) * 0.03) * 10) / 10;
  if (!contacts.length || rand() > 0.14) return null;
  const allies = contacts.filter(item => item.relation >= 68);
  const hostile = contacts.filter(item => item.relation <= 32);
  const local = contacts.filter(item => item.reason === 'territorio');
  if (openLaw && allies.length && rand() < 0.6) {
    const contact = allies[Math.floor(rand() * allies.length)];
    if (!(contact.cosigned ?? []).includes(openLaw.id)) return { templateId: 'sostegno-parlamentare', contact, law: openLaw };
  }
  if (openLaw && hostile.length) return { templateId: 'emendamenti-contrari', contact: hostile[Math.floor(rand() * hostile.length)], law: openLaw };
  if (!seat && local.length) return { templateId: 'richiesta-territorio', contact: local[Math.floor(rand() * local.length)], region };
  return null;
}
export const contactLabel = contact => `${contact.person.fullName}${contact.person.groupName ? ` (${contact.person.groupName})` : ''}`;
