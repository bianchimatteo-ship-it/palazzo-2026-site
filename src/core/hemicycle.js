// The hemicycle: a graphic representation of a Chamber (not the physical seating in the Aula). Seats are laid out on
// concentric arcs and handed out group by group from left to right, following the political position of each group's
// members; every seat is a real parliamentarian in office (identity from the verified dataset), the player's own seat,
// or — only when the scenario gives a group more seats than the dataset lists — an unnamed seat of that group.
import { electionListOf, groupAffiliation, inOffice, politicianAffiliation, positionAxis } from '../data/repositories/party-links.js?v=20260926-8';
import { CHART_SLOTS } from '../data/simulation/polling-rules.js?v=20260926-8';

// Colour: the eight validated slots of the game's charts in fixed order to the largest groups (or parties) of the
// reference composition; smaller groups and the Misto family fold into neutral tones. Identity is never colour alone:
// legend, labels and the card say who is who.
export const NEUTRAL_TONES = Object.freeze(['#8d9791', '#6d7872', '#a9b1ac', '#5b6560', '#b9c0bb']);
export const UNKNOWN_COLOR = '#434d48';
const MISTO = /^misto/i;

export function hemicycleLayout(count, { width = 1000 } = {}) {
  const outer = width / 2 - 14;
  if (count <= 0) return { seats: [], width, height: outer + 28, radius: 0, rows: 0 };
  const rows = Math.max(2, Math.min(16, Math.round(Math.sqrt(count / 2.3))));
  const inner = outer * 0.36;
  const radii = Array.from({ length: rows }, (_, index) => inner + (outer - inner) * (rows === 1 ? 1 : index / (rows - 1)));
  const total = radii.reduce((sum, radius) => sum + radius, 0);
  const counts = radii.map(radius => Math.floor(count * radius / total));
  for (let rest = count - counts.reduce((sum, value) => sum + value, 0), row = rows - 1; rest > 0; rest--, row = (row - 1 + rows) % rows) counts[row]++;
  const cy = outer + 14;
  const seats = [];
  radii.forEach((radius, row) => {
    const n = counts[row];
    for (let index = 0; index < n; index++) {
      const angle = n === 1 ? Math.PI / 2 : Math.PI * (1 - index / (n - 1));
      seats.push({ row, angle, x: Math.round((width / 2 + radius * Math.cos(angle)) * 10) / 10, y: Math.round((cy - radius * Math.sin(angle)) * 10) / 10 });
    }
  });
  // From the left end to the right one; at the same angle the outer rows first: groups become wedges.
  seats.sort((a, b) => b.angle - a.angle || b.row - a.row);
  const gap = rows > 1 ? (outer - inner) / (rows - 1) : outer;
  const along = Math.min(...radii.map((radius, row) => counts[row] > 1 ? Math.PI * radius / (counts[row] - 1) : Infinity));
  return { seats, width, height: cy + 14, radius: Math.max(3, Math.min(gap, along) * 0.42), rows, cx: width / 2, cy };
}

// The entity (party or list) of a real parliamentarian: the documented current party, else the 2022 list's entity.
function entityOf(person, db) {
  return politicianAffiliation(person, db)?.entity ?? electionListOf(person, db)?.entity ?? null;
}
const shortGroupName = name => String(name ?? '').replace(/^MISTO\s*[-–]\s*/i, 'Misto · ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['di', 'd', 'e', 'per', 'le', 'la', 'il', 'lo', 'con', 'al', 'del', 'della', 'dei', 'l', 'gruppo', 'misto']);
const tokens = name => new Set(String(name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').split(/[^a-z0-9]+/).filter(word => word.length > 1 && !STOP.has(word)));
const similarity = (a, b) => { const x = tokens(a), y = tokens(b); const common = [...x].filter(word => y.has(word)).length; return common / Math.max(1, new Set([...x, ...y]).size); };

// Members of every scenario group of both chambers (real parliamentarians in office, with the owner's corrections).
function membersByGroup(parliament, { politicians, db, date }) {
  const members = new Map(['camera', 'senato'].flatMap(chamber => (parliament?.chambers?.[chamber]?.groups ?? []).map(group => [group.groupId, []])));
  const outside = [];
  for (const person of politicians) {
    if (!inOffice(person, date)) continue;
    const affiliation = groupAffiliation(person, db);
    const groupId = affiliation?.componentGroup?.id ?? affiliation?.group?.id ?? person.groupId;
    if (members.has(groupId)) members.get(groupId).push(person);
    else outside.push(person);
  }
  return { members, outside };
}

// Every group of both chambers: its political position (from its members' parties or 2022 lists; a group whose members
// are not documented takes the position of the group with the same name in the other chamber) and a colour that
// follows the political family in both chambers (same colour for the same force at the Camera and at the Senate).
export function groupIdentities(parliament, { politicians = [], db = {}, date = null } = {}) {
  const { members, outside } = membersByGroup(parliament, { politicians, db, date });
  const all = ['camera', 'senato'].flatMap(chamber => (parliament?.chambers?.[chamber]?.groups ?? []).map(group => ({ group, chamber })));
  const info = new Map(all.map(({ group, chamber }) => {
    const list = members.get(group.groupId) ?? [];
    const axes = list.map(person => positionAxis(entityOf(person, db)?.politicalPosition)).filter(Number.isFinite);
    const name = group.officialName ?? group.groupId;
    // The groups of a legislature simulated by the game carry the collocazione of their party.
    const own = group.simulated && Number.isFinite(group.axis) ? group.axis : null;
    return [group.groupId, { groupId: group.groupId, chamber, name, misto: MISTO.test(name.trim()), reference: group.reference?.memberCount ?? list.length, axis: axes.length >= Math.max(2, list.length * 0.25) ? axes.reduce((sum, value) => sum + value, 0) / axes.length : own }];
  }));
  // Families: a group of one chamber and the most similar group of the other one (by name).
  const family = new Map([...info.keys()].map(id => [id, id]));
  for (const item of info.values()) {
    if (item.chamber !== 'senato' || item.misto) continue;
    const best = [...info.values()].filter(other => other.chamber === 'camera' && !other.misto).map(other => ({ other, score: similarity(item.name, other.name) })).sort((a, b) => b.score - a.score)[0];
    if (best && best.score >= 0.25) family.set(item.groupId, best.other.groupId);
  }
  for (const item of info.values()) {
    if (item.axis !== null) continue;
    const twin = [...info.values()].find(other => other.groupId !== item.groupId && family.get(other.groupId) === family.get(item.groupId) && other.axis !== null);
    item.axis = twin?.axis ?? 0;
  }
  // Colours: the eight validated slots to the largest families of the reference composition, the rest neutral.
  const sizes = new Map();
  for (const item of info.values()) if (!item.misto) sizes.set(family.get(item.groupId), (sizes.get(family.get(item.groupId)) ?? 0) + item.reference);
  const rankedFamilies = [...sizes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key]) => key);
  let neutral = 0;
  const neutralOf = new Map();
  for (const item of [...info.values()].sort((a, b) => a.groupId.localeCompare(b.groupId))) {
    const rank = item.misto ? -1 : rankedFamilies.indexOf(family.get(item.groupId));
    if (rank >= 0 && rank < CHART_SLOTS.length) item.color = CHART_SLOTS[rank];
    else { const key = item.misto ? item.groupId : family.get(item.groupId); if (!neutralOf.has(key)) neutralOf.set(key, NEUTRAL_TONES[neutral++ % NEUTRAL_TONES.length]); item.color = neutralOf.get(key); }
    item.family = family.get(item.groupId);
  }
  return { info, members, outside };
}

// Groups of a chamber with their members, ordered from left to right.
export function chamberGroups(parliament, chamber, { politicians = [], db = {}, date = null } = {}) {
  const { info, members, outside } = groupIdentities(parliament, { politicians, db, date });
  const groups = (parliament?.chambers?.[chamber]?.groups ?? []).map(group => {
    const identity = info.get(group.groupId);
    const list = [...(members.get(group.groupId) ?? [])].sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'it'));
    return { groupId: group.groupId, name: identity.name, shortName: shortGroupName(identity.name), misto: identity.misto, axis: identity.axis, color: identity.color, family: identity.family, seats: group.simulatedSeats ?? 0, reference: identity.reference, members: list };
  });
  groups.sort((a, b) => a.axis - b.axis || Number(a.misto) - Number(b.misto) || b.reference - a.reference || a.groupId.localeCompare(b.groupId));
  return { groups, outside: outside.filter(person => person.chamber === chamber) };
}

// Party colours for the "by party" view: the eight parties with the most documented members in office (both chambers,
// so a party keeps its colour at the Camera and at the Senate) get the slots; the others are neutral.
export function partyColors(politicians = [], db = {}, date = null) {
  const counts = new Map();
  for (const person of politicians) {
    if (!inOffice(person, date)) continue;
    const entity = politicianAffiliation(person, db)?.entity;
    if (entity) counts.set(entity.id, { entity, count: (counts.get(entity.id)?.count ?? 0) + 1 });
  }
  const ranked = [...counts.values()].sort((a, b) => b.count - a.count || a.entity.id.localeCompare(b.entity.id));
  return new Map(ranked.map((item, index) => [item.entity.id, { ...item, color: CHART_SLOTS[index] ?? NEUTRAL_TONES[(index - CHART_SLOTS.length) % NEUTRAL_TONES.length] }]));
}

// Seats of a chamber: layout + who sits where. The player's seat belongs to the player's group in the scenario.
// Who sets the line of a group and keeps it in a vote: group presidents and documented party leaders.
export function lineKeepers(db = {}) {
  const keepers = new Set((db.offices ?? []).filter(item => !item.endDate && /^Presidente del gruppo/i.test(item.title ?? '')).map(item => item.politicianId));
  const figures = new Map((db.politicalFigures ?? []).filter(item => item.politicianId).map(item => [item.id, item.politicianId]));
  for (const leadership of db.partyLeaderships ?? []) if (!leadership.validTo && figures.has(leadership.politicalFigureId)) keepers.add(figures.get(leadership.politicalFigureId));
  return keepers;
}

export function chamberRoster(parliament, chamber, { politicians = [], db = {}, date = null, width = 1000 } = {}) {
  const { groups, outside } = chamberGroups(parliament, chamber, { politicians, db, date });
  const keepers = lineKeepers(db);
  const playerHere = parliament?.player?.chamber === chamber && parliament.player.groupId;
  const assigned = [];
  for (const group of groups) {
    const withPlayer = playerHere && parliament.player.groupId === group.groupId;
    const real = Math.max(0, group.seats - (withPlayer ? 1 : 0));
    const people = group.members.slice(0, real);
    group.overflow = Math.max(0, group.members.length - real);
    group.placeholders = Math.max(0, real - people.length);
    const seats = [...people.map(person => ({ groupId: group.groupId, person, player: false, placeholder: false, keepsLine: keepers.has(person.id) })), ...Array.from({ length: group.placeholders }, (_, index) => ({ groupId: group.groupId, person: null, player: false, placeholder: true, placeholderIndex: index + 1 }))];
    // The player sits in the middle of the group's wedge.
    if (withPlayer) seats.splice(Math.floor(seats.length / 2), 0, { groupId: group.groupId, person: null, player: true, placeholder: false });
    assigned.push(...seats);
  }
  const layout = hemicycleLayout(assigned.length, { width });
  const seats = assigned.map((seat, index) => ({ ...seat, index, ...layout.seats[index] }));
  return { chamber, groups, outside, seats, layout, total: seats.length };
}

// Committees of a person (verified memberships), with the committee record.
export function committeesOf(personId, db = {}) {
  const committees = new Map((db.committees ?? []).map(item => [item.id, item]));
  return (db.committeeMemberships ?? []).filter(row => row.politicianId === personId && !row.validTo).map(row => ({ ...row, committee: committees.get(row.committeeId) ?? null })).filter(row => row.committee);
}
