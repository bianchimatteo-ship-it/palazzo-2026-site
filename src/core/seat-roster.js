// Seats with people. Every seat of an assembly the game simulates (the Chambers born from a vote, a regional, provincial or municipal council, the European
// Parliament) has a person: the player where he sits, a person the game already knows (the party's people, or the ones the party sent to the assembly that
// closes), or a person of the simulation that the roster creates and keeps in the same registry as every other person (dataset.politicians, source: simulation,
// never a real one). The groups say how many seats each has; the roster follows them: when a group gains or loses seats (a split, the player entering or leaving)
// the seats move, and a split takes the persons with it. Nothing here decides a vote or a seat count: it only gives the seats a face.
// A roster is kept compact (it is saved with the game): blocks of seats by group and party, each seat being the id of its person; `rosterSeats` gives them back as
// records (seat, person, group, party or list, who put him there, whether he leads the executive). Pure functions on plain data: the store gives them the groups,
// the persons and the player, and keeps what they return.
import { simulatedPerson } from './race-engine.js?v=20261009-4';

export const SEAT_PERSON = 'seggio';
const SEAT_ID = 'persona-seggio-';
export const SEAT_ROLES = Object.freeze({ camera: 'Deputato', senato: 'Senatore', europa: 'Eurodeputato', regione: 'Consigliere regionale', provincia: 'Consigliere provinciale', comune: 'Consigliere comunale' });
// Of the members a party had in the assembly that closes, the share the voters send back (the others leave and the seats of the party are filled by persons it
// already has, then by new ones).
export const RE_ELECTION_SHARE = 0.6;
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const FIRST_NAMES = Object.freeze(['Alessandro', 'Alessia', 'Andrea', 'Anna', 'Beatrice', 'Carlo', 'Chiara', 'Davide', 'Elena', 'Federico', 'Francesca', 'Giorgio', 'Giulia', 'Lorenzo', 'Luca', 'Marco', 'Marta', 'Mattia', 'Paola', 'Roberto', 'Sara', 'Sofia', 'Stefano', 'Valentina']);
const LAST_NAMES = Object.freeze(['Bassi', 'Bellini', 'Bernardi', 'Caruso', 'Conti', 'Costa', 'De Luca', 'Esposito', 'Ferri', 'Fontana', 'Galli', 'Greco', 'Leone', 'Lombardi', 'Marino', 'Marini', 'Moretti', 'Pellegrini', 'Ricci', 'Rinaldi', 'Romano', 'Rossi', 'Santoro', 'Serra', 'Villa', 'Vitale']);
function italianSeatName(id) {
  const first = FIRST_NAMES[hash(id) % FIRST_NAMES.length];
  const last = LAST_NAMES[hash(`${id}|cognome`) % LAST_NAMES.length].trim();
  return { firstName: first, lastName: last, displayName: `${first} ${last}` };
}
const shortOf = label => String(label ?? '').replace(/^Misto\s*[-–]\s*/i, 'Misto · ').replace(/\s+/g, ' ').trim();
const compact = person => Object.fromEntries(Object.entries(person).filter(([, value]) => value !== null && value !== undefined));
export const isSeatPerson = person => person?.origin === SEAT_PERSON;
const personIdOf = (assembly, number) => `${SEAT_ID}${hash(`${assembly}|${number}`).toString(36)}${hash(`${number}|${assembly}`).toString(36)}`;
// A new person of the simulation for a seat (never a real one): the n-th of the assembly, of the party the seat counts for.
const seatPerson = ({ assembly, number, kind, label, place, partyId, date }) => {
  const id = personIdOf(assembly, number);
  return compact({ ...simulatedPerson({ id, ...italianSeatName(id), region: place?.region ?? null, municipality: kind === 'comune' ? place?.municipality ?? null : null, partyId, date }), ...italianSeatName(id), origin: SEAT_PERSON });
};
// Older saves used placeholders; stabilize them from their already-persistent seat ID without touching real people.
export function normalizeSeatPerson(person) {
  if (!isSeatPerson(person) && !String(person?.id ?? '').startsWith(SEAT_ID)) return person;
  if (!person || (person.firstName !== 'Figura' && !/simulat[oa] n\.\s*\d|Eletto simulato/i.test(person.displayName ?? ''))) return person;
  return { ...person, ...italianSeatName(person.id) };
}
// Who put a person on his seat: the player, the simulation (a person the roster made), or a person the game already had.
const originOf = (roster, personId) => personId === roster?.player ? 'player' : String(personId).startsWith(SEAT_ID) ? 'simulation' : 'existing';

// The seats of a roster as records, in order: { id, personId, groupId, partyId, listId?, origin, leader? }.
export function rosterSeats(roster) {
  let index = 0;
  return (roster?.blocks ?? []).flatMap(block => block.people.map(personId => ({ id: `${roster.assembly}-${String(++index).padStart(3, '0')}`, personId, groupId: block.group, partyId: block.party ?? null, ...(block.list ? { listId: block.list } : {}), origin: originOf(roster, personId), ...(roster.leader === personId ? { leader: true } : {}) })));
}
export const seatsOfGroup = (roster, groupId) => rosterSeats(roster).filter(seat => seat.groupId === groupId);
export const rosterPeople = roster => (roster?.blocks ?? []).flatMap(block => block.people);
export const rosterSize = roster => rosterPeople(roster).length;

// What a group seats, by party or list: its named parts (the Italian delegation inside a European group, the territorial lists of the Misto), then the rest under
// the party of the group. The parts never exceed the seats of the group.
export function quotasOf(group) {
  let left = Math.max(0, group.seats ?? 0);
  const quotas = [];
  for (const part of group.parts ?? []) {
    const count = Math.min(left, Math.max(0, part.seats ?? 0));
    if (count > 0) { quotas.push({ partyId: part.partyId ?? null, listId: part.listId ?? null, label: part.label ?? null, count }); left -= count; }
  }
  if (left > 0 || !quotas.length) quotas.push({ partyId: group.partyId ?? null, listId: null, label: null, count: left });
  return quotas;
}

// Does the roster already say what the groups say? (the groups' seats, the player's place): then nothing needs to be done.
export function rosterInSync(roster, groups, player = null) {
  if (!Array.isArray(roster?.blocks)) return false;
  const counts = new Map();
  for (const block of roster.blocks) counts.set(block.group, (counts.get(block.group) ?? 0) + block.people.length);
  if (groups.some(group => (counts.get(group.id) ?? 0) !== Math.max(0, group.seats ?? 0))) return false;
  if ([...counts.keys()].some(id => !groups.some(group => group.id === id))) return false;
  if (!player?.personId) return !roster.player;
  return roster.player === player.personId && roster.blocks.some(block => block.group === player.groupId && block.people.includes(player.personId));
}

// The roster of an assembly, built or brought in line with its groups.
// spec: { assembly, kind, label, groups: [{ id, label, partyId, seats, parts?: [{ partyId, listId, label, seats }] }], previous (the roster of the same assembly), player: { personId, groupId, partyId },
// pool: [{ id, partyId, previous?: { assembly, since } }] (persons that can take a seat of their party), busy (persons seated in another assembly), people (the persons by id),
// splitFrom: { [newGroupId]: sourceGroupId }, date, resultId, place: { name, region, municipality }, leader: { groupId, player?, label? }, numberFrom }.
// Returns { roster, created (new persons), updated ([{ id, patch }] for people already known), released (the persons whose seats ended) }.
export function syncRoster({ assembly, kind, label = null, groups, previous = null, player = null, pool = [], busy = new Set(), people = new Map(), splitFrom = {}, date, resultId = null, place = null, leader = null, numberFrom = 0 }) {
  const prior = previous?.assembly === assembly ? previous : null;
  // The numbers of the new persons go on from the assembly this one follows, so that two members of successive assemblies never share a name.
  let counter = prior?.counter ?? numberFrom;
  const role = SEAT_ROLES[kind] ?? 'Eletto';
  const byGroup = new Map();
  for (const seat of rosterSeats(prior)) byGroup.set(seat.groupId, [...(byGroup.get(seat.groupId) ?? []), seat]);
  const patches = new Map();
  const patch = (id, value) => patches.set(id, { ...(patches.get(id) ?? {}), ...value });
  // A split: the seats of the group that leaves, with their people, pass to the new group.
  for (const group of groups) {
    const source = splitFrom[group.id];
    if (!source || byGroup.get(group.id)?.length) continue;
    const from = byGroup.get(source) ?? [];
    const takeable = from.filter(seat => seat.origin !== 'player');
    const moving = takeable.slice(takeable.length - Math.min(Math.max(0, group.seats ?? 0), takeable.length));
    for (const seat of moving) { seat.groupId = group.id; seat.partyId = group.partyId ?? null; patch(seat.personId, { partyId: group.partyId ?? null }); }
    byGroup.set(source, from.filter(seat => !moving.includes(seat)));
    byGroup.set(group.id, moving);
  }
  const seats = [];
  const created = [];
  const seated = new Set();
  let leaderId = prior?.leader ?? null;
  for (const group of groups) {
    const quotas = quotasOf(group);
    // The player's own seat is placed first (and only while he sits here): the others are the ones the roster had.
    const previousHere = (byGroup.get(group.id) ?? []).filter(seat => seat.origin !== 'player');
    const mine = player?.personId && player.groupId === group.id ? player : null;
    const tag = quota => ({ groupId: group.id, partyId: quota.partyId, ...(quota.listId ? { listId: quota.listId } : {}) });
    if (mine) {
      const quota = quotas.find(item => item.count > 0 && item.partyId && item.partyId === (mine.partyId ?? null)) ?? quotas.find(item => item.count > 0) ?? quotas[0];
      quota.count = Math.max(0, quota.count - 1);
      seats.push({ personId: mine.personId, ...tag(quota) });
      seated.add(mine.personId);
      if (leader?.player && leader.groupId === group.id) leaderId = mine.personId;
    }
    for (const quota of quotas) {
      const same = previousHere.filter(seat => (seat.partyId ?? null) === quota.partyId && (seat.listId ?? null) === (quota.listId ?? null) && !seated.has(seat.personId));
      const kept = same.slice(0, quota.count);
      for (const seat of kept) { seats.push({ personId: seat.personId, ...tag(quota) }); seated.add(seat.personId); }
      let missing = quota.count - kept.length;
      // Persons the game already has for this party: the ones sent back by the voters (a share of the old members), then the others it knows.
      if (missing > 0 && quota.partyId) {
        const cap = Math.floor(quota.count * RE_ELECTION_SHARE);
        let back = 0;
        for (const candidate of pool.filter(item => item.partyId === quota.partyId && !seated.has(item.id) && !busy.has(item.id))) {
          if (missing <= 0) break;
          if (seated.has(candidate.id)) continue;
          if (candidate.previous) { if (back >= cap) continue; back++; }
          seats.push({ personId: candidate.id, ...tag(quota) });
          seated.add(candidate.id);
          missing--;
          if (candidate.previous) patch(candidate.id, { terms: [...(people.get(candidate.id)?.terms ?? []), { ...candidate.previous, until: date }].slice(-6) });
        }
      }
      for (; missing > 0; missing--) {
        counter++;
        const heads = Boolean(leader && !leader.player && !leaderId && leader.groupId === group.id);
        const person = seatPerson({ assembly, number: counter, kind, label: heads && leader.label ? leader.label : `${role} simulato n. ${counter} · ${shortOf(quota.label ?? group.label)}`, place, partyId: quota.partyId, date });
        created.push(person);
        seats.push({ personId: person.id, ...tag(quota) });
        seated.add(person.id);
        if (heads) leaderId = person.id;
      }
    }
  }
  const blocks = [];
  for (const seat of seats) {
    const last = blocks.at(-1);
    if (last && last.group === seat.groupId && last.party === seat.partyId && (last.list ?? null) === (seat.listId ?? null)) last.people.push(seat.personId);
    else blocks.push({ group: seat.groupId, party: seat.partyId, ...(seat.listId ? { list: seat.listId } : {}), people: [seat.personId] });
  }
  const released = rosterSeats(prior).map(seat => seat.personId).filter(id => !seated.has(id));
  const roster = { version: 2, assembly, kind, label, date: prior?.date ?? date, resultId: prior ? prior.resultId ?? null : resultId, place: prior?.place ?? place ?? null, counter, player: player?.personId && seated.has(player.personId) ? player.personId : null, leader: leaderId && seated.has(leaderId) ? leaderId : null, ...(prior?.vacant?.length ? { vacant: prior.vacant } : {}), blocks };
  return { roster, created, updated: [...patches].map(([id, value]) => ({ id, patch: value })), released };
}

// ---------- the members: where each one sits, how a seat changes hands ----------
// A person on a seat of a Chamber the game simulates is a member: where he was elected, how attached he is to where he sits, how he stands with the player and what happened to him (person.member,
// in the same registry as every person). Group, party and list (component) are three separate things of a seat: a member can change any of them without the others. These functions are pure:
// they move persons between the blocks of a roster, keep the vacant seats and draw the week's change; the counts of the groups, the Government and the world follow in the store.
export const MEMBER_HISTORY_LIMIT = 10;
const clampTo = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const weeksSince = (from, to) => from && to ? Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 604800000) : 999;
const sameBlock = (block, seat) => block.group === seat.groupId && (block.party ?? null) === (seat.partyId ?? null) && (block.list ?? null) === (seat.listId ?? null);
const seatKeyOf = seat => ({ groupId: seat.groupId, partyId: seat.partyId ?? null, ...(seat.listId ? { listId: seat.listId } : {}) });

// A member in office has no status written down (a member who left has: dimesso, decaduto, deceduto). The state is kept small: what is the same for everybody (the assembly he sits in, the
// collocation he was elected with while he has not moved, the first election) is not repeated on every person.
export const inOffice = member => Boolean(member) && (member.status ?? 'in-carica') === 'in-carica';
// The state of a member who has just taken a seat: since when he is where he is, attachment and standing with the player drawn from his identity (so they are the same in every game).
export function newMember({ personId, date, relation = 50, loyalty = { min: 40, max: 90 }, history = [] }) {
  const roll = hash(`${personId}|membro`);
  return { since: date, loyalty: loyalty.min + roll % (loyalty.max - loyalty.min + 1), relation: clampTo(Math.round(relation + (roll >>> 8) % 21 - 10)), ...(history.length ? { history } : {}) };
}
// The member with something that happened to him (the last ones are kept); patch changes the fields that moved.
export const withMemberEntry = (member, entry, patch = {}) => ({ ...member, ...patch, history: [...(member?.history ?? []), entry].slice(-MEMBER_HISTORY_LIMIT) });

// The seat a person holds in the roster, as { groupId, partyId, listId? }, or null.
export function seatOf(roster, personId) {
  for (const block of roster?.blocks ?? []) if (block.people.includes(personId)) return seatKeyOf({ groupId: block.group, partyId: block.party, listId: block.list });
  return null;
}
// The roster without the person (his block goes when it is left empty) and the seat he held.
export function leaveSeat(roster, personId) {
  const seat = seatOf(roster, personId);
  if (!seat) return { roster, seat: null };
  const blocks = roster.blocks.map(block => block.people.includes(personId) ? { ...block, people: block.people.filter(id => id !== personId) } : block).filter(block => block.people.length);
  return { roster: { ...roster, blocks, ...(roster.leader === personId ? { leader: null } : {}) }, seat };
}
// The roster with the person on a seat of the block (group, party, list): in that block, or in a new one right after the others of the group. Nobody sits twice.
export function takeSeat(roster, personId, seat) {
  if (seatOf(roster, personId)) throw new Error('Una persona siede su un solo seggio.');
  const blocks = (roster.blocks ?? []).map(block => ({ ...block, people: [...block.people] }));
  const same = blocks.find(block => sameBlock(block, seat));
  if (same) same.people.push(personId);
  else { let last = -1; blocks.forEach((block, index) => { if (block.group === seat.groupId) last = index; }); blocks.splice(last < 0 ? blocks.length : last + 1, 0, { group: seat.groupId, party: seat.partyId ?? null, ...(seat.listId ? { list: seat.listId } : {}), people: [personId] }); }
  return { ...roster, blocks };
}
export const moveSeat = (roster, personId, seat) => { const left = leaveSeat(roster, personId); return left.seat ? takeSeat(left.roster, personId, seat) : roster; };
// The seats of a group that are not under its own party (a member who left his party but not his group, one who sits in the Misto with his party): a new sync has to keep them.
export function guestParts(roster, group) {
  const parts = new Map();
  for (const block of roster?.blocks ?? []) {
    if (block.group !== group.id || ((block.party ?? null) === (group.partyId ?? null) && !block.list)) continue;
    const key = `${block.party ?? ''}|${block.list ?? ''}`;
    parts.set(key, { partyId: block.party ?? null, listId: block.list ?? null, label: null, seats: (parts.get(key)?.seats ?? 0) + block.people.length });
  }
  return [...parts.values()];
}
// The named parts of a group (its lists) and, besides them, the guests the roster has put in it.
export const partsWithGuests = (roster, group) => { const named = group.parts ?? []; return [...named, ...guestParts(roster, group).filter(guest => !named.some(part => (part.partyId ?? null) === guest.partyId && (part.listId ?? null) === guest.listId))]; };

// The seats that lost their member and wait for the next of the list.
export const vacanciesOf = roster => roster?.vacant ?? [];
export const openVacancy = (roster, vacancy) => ({ ...roster, vacant: [...vacanciesOf(roster), vacancy] });
export function closeVacancy(roster, id) {
  const { vacant, ...rest } = roster;
  const left = (vacant ?? []).filter(item => item.id !== id);
  return left.length ? { ...rest, vacant: left } : rest;
}
// A vacant seat is taken by the next of the list: a person of the simulation the party already has (never a real one), or a new one. Returns { roster, personId, created }.
export function fillSeat({ roster, vacancy, pool = [], busy = new Set(), date }) {
  const seated = new Set(rosterPeople(roster));
  const known = vacancy.partyId ? pool.find(item => item.partyId === vacancy.partyId && !seated.has(item.id) && !busy.has(item.id)) : null;
  const number = (roster.counter ?? 0) + (known ? 0 : 1);
  const created = known ? null : seatPerson({ assembly: roster.assembly, number, kind: roster.kind, label: `${SEAT_ROLES[roster.kind] ?? 'Eletto'} simulato n. ${number} · ${shortOf(vacancy.label)}`, place: roster.place, partyId: vacancy.partyId ?? null, date });
  const personId = known?.id ?? created.id;
  return { roster: closeVacancy(takeSeat({ ...roster, counter: number }, personId, seatKeyOf(vacancy)), vacancy.id), personId, created };
}

const pick = (items, weight, rand) => {
  const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
  if (!items.length || total <= 0) return null;
  let at = rand() * total;
  for (const item of items) { at -= Math.max(0, weight(item)); if (at < 0) return item; }
  return items.at(-1);
};
// The week's change among the members of a Chamber, drawn from a seeded generator: null, or
//   { type: 'defezione', kind: 'group' | 'misto' | 'party' | 'component', personId, from, to }   (to: the seat he takes; to.groupId null = the Misto of the independents, not there yet)
//   { type: 'perdita', reason, personId, from }     { type: 'ritorno', personId, from, to }
// groups: [{ id, partyId, seats, axis, component, independent, lists (has territorial lists), listIds }]; people: Map of persons by id (with their member state); rules: LEGISLATURE_RULES.members; pressure: what a shaky Government
// does to the defections. The player never is the one who changes (his seat is his own to move), and a real person is never here.
export function drawMemberChange({ roster, groups, people, rand, rules, pressure = 1, playerId = null, date }) {
  const memberOf = id => people.get(id)?.member ?? null;
  const seated = rosterSeats(roster).filter(seat => seat.personId !== playerId && seat.origin !== 'player' && inOffice(memberOf(seat.personId)));
  const settled = (seat, factor = 1) => weeksSince(memberOf(seat.personId)?.since, date) >= rules.minTenureWeeks * factor;
  const groupOf = id => groups.find(item => item.id === id) ?? null;
  const roll = rand();
  const defect = rules.weekly.defection * pressure;
  if (roll < defect) {
    const seat = pick(seated.filter(item => settled(item)), item => (100 - (memberOf(item.personId)?.loyalty ?? 60)) ** 2, rand);
    if (!seat) return null;
    const from = seatKeyOf(seat), party = people.get(seat.personId)?.partyId ?? null, here = groupOf(seat.groupId);
    const lists = (here?.listIds ?? []).filter(id => id !== seat.listId);
    const kinds = Object.entries(rules.kinds).filter(([kind]) => kind !== 'party' || party).filter(([kind]) => kind !== 'misto' || !(here?.component || here?.independent)).filter(([kind]) => kind !== 'component' || (seat.listId && lists.length));
    let kind = pick(kinds, ([, share]) => share, rand)?.[0] ?? 'group';
    if (kind === 'group') {
      const others = groups.filter(item => item.id !== seat.groupId && !item.component && !item.lists && item.seats > 0);
      const to = pick(others, item => Math.sqrt(item.seats) / (1 + Math.abs((item.axis ?? 0) - (here?.axis ?? 0))), rand);
      if (to) return { type: 'defezione', kind, personId: seat.personId, from, to: { groupId: to.id, partyId: to.partyId ?? null } };
      kind = here?.component || here?.independent ? 'party' : 'misto';
    }
    if (kind === 'component') return { type: 'defezione', kind, personId: seat.personId, from, to: { groupId: seat.groupId, partyId: seat.partyId ?? null, listId: pick(lists, () => 1, rand) } };
    if (kind === 'misto') {
      const own = groups.find(item => item.component && !item.independent && party && item.partyId === party && item.id !== seat.groupId);
      const independents = groups.find(item => item.independent && item.id !== seat.groupId);
      return { type: 'defezione', kind, personId: seat.personId, from, to: { groupId: (own ?? independents)?.id ?? null, partyId: party } };
    }
    return party ? { type: 'defezione', kind: 'party', personId: seat.personId, from, to: { groupId: seat.groupId, partyId: null, ...(seat.listId ? { listId: seat.listId } : {}) } } : null;
  }
  if (roll < defect + rules.weekly.loss) {
    const seat = pick(seated, () => 1, rand);
    const reason = pick(Object.entries(rules.losses), ([, share]) => share, rand)?.[0] ?? 'dimissioni';
    return seat ? { type: 'perdita', reason, personId: seat.personId, from: seatKeyOf(seat) } : null;
  }
  if (roll < defect + rules.weekly.loss + rules.weekly.return) {
    const away = seated.filter(seat => { const back = memberOf(seat.personId)?.electedFor; return back && back.groupId !== seat.groupId && groupOf(back.groupId) && settled(seat, 2); });
    const seat = pick(away, () => 1, rand);
    return seat ? { type: 'ritorno', personId: seat.personId, from: seatKeyOf(seat), to: { ...memberOf(seat.personId).electedFor } } : null;
  }
  return null;
}
