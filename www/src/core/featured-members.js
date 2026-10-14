// Which verified real parliamentarians the Parlamento page puts on the table this week.
// Deterministic: the same chamber, week, scenario and player role always give the same cards, and the
// selection changes from week to week without ever inventing a person or a role. Only records that are
// real, verified and still in office are eligible; the card text comes straight from those records.

const OFFICER_ROLES = /^(presidente|vicepresidente|segretario|questore)/i;
const hash = text => { let h = 2166136261; for (const char of String(text)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function stream(seed) {
  let a = hash(seed) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (list, random) => { const out = [...list]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; };
const eligible = person => person?.source === 'real' && person.verified === true && !person.termEnd;

export const FEATURED_REASONS = Object.freeze({
  'capogruppo': 'Presidente di gruppo',
  'commissione': 'Ufficio di presidenza di commissione',
  'tuo-gruppo': 'Del tuo gruppo parlamentare',
  'tuo-territorio': 'Eletto nel tuo territorio',
  'aula': 'Dall’Aula'
});

// `scope` = { chamber, seed, count, playerGroupId, territoryHint }.
export function featuredMembers({ politicians = [], groups = [], offices = [], committees = [], committeeMemberships = [] } = {}, scope = {}) {
  const chamber = scope.chamber === 'senato' ? 'senato' : 'camera';
  const count = Math.max(1, Math.min(12, scope.count ?? 6));
  const random = stream(`${scope.seed ?? ''}|${chamber}`);
  const people = politicians.filter(person => eligible(person) && person.chamber === chamber);
  if (!people.length) return [];
  const byId = new Map(people.map(person => [person.id, person]));
  const groupName = new Map(groups.map(group => [group.id ?? group.groupId, group.officialName ?? group.name]));
  const taken = new Set();
  const usedGroups = new Set();
  const picked = [];
  const take = (person, reason, detail = null) => {
    if (!person || taken.has(person.id) || picked.length >= count) return false;
    taken.add(person.id); usedGroups.add(person.groupId);
    picked.push({ person, reason, detail, groupName: groupName.get(person.groupId) ?? null });
    return true;
  };
  // 1. Group presidents: the office records name the group in the title.
  const leaders = offices.filter(item => item.source === 'real' && item.verified === true && !item.endDate && /^Presidente del gruppo/i.test(item.title ?? '') && byId.has(item.politicianId));
  const leader = shuffle(leaders, random)[0];
  if (leader) take(byId.get(leader.politicianId), 'capogruppo', leader.title);
  // 2. Officers of a standing committee of this chamber.
  const committeeById = new Map(committees.map(item => [item.id, item]));
  const officers = committeeMemberships.filter(row => row.source === 'real' && row.verified === true && !row.validTo && !row.substitute && row.chamber === chamber && OFFICER_ROLES.test(row.role ?? '') && byId.has(row.politicianId) && !taken.has(row.politicianId));
  const officer = shuffle(officers, random)[0];
  if (officer) take(byId.get(officer.politicianId), 'commissione', `${officer.role}${committeeById.get(officer.committeeId)?.name ? ' · ' + committeeById.get(officer.committeeId).name : ''}`);
  // 3. The player's own group and, when known, the player's territory.
  if (scope.playerGroupId) take(shuffle(people.filter(person => person.groupId === scope.playerGroupId && !taken.has(person.id)), random)[0], 'tuo-gruppo');
  const hint = String(scope.territoryHint ?? '').toLocaleLowerCase('it-IT');
  if (hint) take(shuffle(people.filter(person => !taken.has(person.id) && String(person.circoscription ?? '').toLocaleLowerCase('it-IT').includes(hint)), random)[0], 'tuo-territorio');
  // 4. The rest of the table: one person per group not yet on it, then anyone.
  const rest = shuffle(people.filter(person => !taken.has(person.id)), random);
  for (const person of rest) { if (picked.length >= count) break; if (!usedGroups.has(person.groupId)) take(person, 'aula'); }
  for (const person of rest) { if (picked.length >= count) break; take(person, 'aula'); }
  return picked;
}
