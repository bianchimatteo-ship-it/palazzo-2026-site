// Seats with people. Every seat of an assembly the game simulates (the Chambers born from a vote, a regional, provincial or municipal council, the European
// Parliament) has a person: the player where he sits, a person the game already knows (the party's people, or the ones the party sent to the assembly that
// closes), or a person of the simulation that the roster creates and keeps in the same registry as every other person (dataset.politicians, source: simulation,
// never a real one). The groups say how many seats each has; the roster follows them: when a group gains or loses seats (a split, the player entering or leaving)
// the seats move, and a split takes the persons with it. Nothing here decides a vote or a seat count: it only gives the seats a face.
// A roster is kept compact (it is saved with the game): blocks of seats by group and party, each seat being the id of its person; `rosterSeats` gives them back as
// records (seat, person, group, party or list, who put him there, whether he leads the executive). Pure functions on plain data: the store gives them the groups,
// the persons and the player, and keeps what they return.
import { simulatedPerson } from './race-engine.js?v=20261007-1';

export const SEAT_PERSON = 'seggio';
const SEAT_ID = 'persona-seggio-';
export const SEAT_ROLES = Object.freeze({ camera: 'Deputato', senato: 'Senatore', europa: 'Eurodeputato', regione: 'Consigliere regionale', provincia: 'Consigliere provinciale', comune: 'Consigliere comunale' });
// Of the members a party had in the assembly that closes, the share the voters send back (the others leave and the seats of the party are filled by persons it
// already has, then by new ones).
export const RE_ELECTION_SHARE = 0.6;
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const shortOf = label => String(label ?? '').replace(/^Misto\s*[-–]\s*/i, 'Misto · ').replace(/\s+/g, ' ').trim();
const compact = person => Object.fromEntries(Object.entries(person).filter(([, value]) => value !== null && value !== undefined));
export const isSeatPerson = person => person?.origin === SEAT_PERSON;
const personIdOf = (assembly, number) => `${SEAT_ID}${hash(`${assembly}|${number}`).toString(36)}${hash(`${number}|${assembly}`).toString(36)}`;
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
        const person = compact({ ...simulatedPerson({ id: personIdOf(assembly, counter), label: heads && leader.label ? leader.label : `${role} simulato n. ${counter} · ${shortOf(quota.label ?? group.label)}`, region: place?.region ?? null, municipality: kind === 'comune' ? place?.municipality ?? null : null, partyId: quota.partyId, date }), origin: SEAT_PERSON });
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
  const roster = { version: 2, assembly, kind, label, date: prior?.date ?? date, resultId: prior ? prior.resultId ?? null : resultId, place: prior?.place ?? place ?? null, counter, player: player?.personId && seated.has(player.personId) ? player.personId : null, leader: leaderId && seated.has(leaderId) ? leaderId : null, blocks };
  return { roster, created, updated: [...patches].map(([id, value]) => ({ id, patch: value })), released };
}
