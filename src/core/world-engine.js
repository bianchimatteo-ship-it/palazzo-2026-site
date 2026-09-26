import { ITALIAN_REGIONS } from '../data/regions.js?v=20260926-1';
import { CHART_SLOTS, CIVIC_FIGURE_LABEL, POLL_INSTITUTES, STRATEGIES, WORLD_EVENTS } from '../data/simulation/polling-rules.js?v=20260926-1';

// The political world: real parties whose poll figures, strategies, alliances and reactions are simulated.
// A party enters with its real identity only (id, name, abbreviation, documented collocazione); its starting weight
// is the latest real poll available at the start of the career (or, without one, the real 2x1000 share), after
// which everything evolves inside the game. Congresses, splits, mergers and new forces are simulation only.
const SIM = 'simulation';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;
// Forces outside the polls move by hundredths of a point: rounding them to 0.01 would erase the slow returns.
const round4 = value => Math.round(value * 10000) / 10000;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const HISTORY = 52;
// Collocazione → left–right axis (−3 … +3): the documented classification of every real entity.
export const POSITIONS = Object.freeze(['estrema sinistra', 'sinistra', 'centro-sinistra', 'centro', 'centro-destra', 'destra', 'estrema destra']);
export const axisOf = position => { const index = POSITIONS.indexOf(position); return index < 0 ? null : index - 3; };
const positionOf = axis => Number.isFinite(axis) ? POSITIONS[clamp(Math.round(axis), -3, 3) + 3] : null;
const distance = (a, b) => Number.isFinite(a?.axis) && Number.isFinite(b?.axis) ? Math.abs(a.axis - b.axis) : 2;
const shortName = label => String(label ?? '').replace(/\s*\(.*\)\s*$/, '');
const EVOLVED_LIMIT = 4;
// Worlds saved before real parties only (invented forces, demo parties, old splinters) are rebuilt; from version 3
// splits and new forces are the simulated evolution of the world and are kept.
const LEGACY_ORIGINS = ['scenario', 'demo', 'scissione'];

// ---------- presence in the polls (simulation) ----------
// A force goes from not surveyed to emerging, surveyed and consolidated, and can later drop out of the survey.
// Moving up depends on a sustained simulated consensus, its trend, visibility (events, elections, crises of close
// forces, broken alliances) and size: thresholds, minimum permanence and cooldowns decide, never a weekly coin toss.
export const PRESENCE = Object.freeze({ NONE: 'non-rilevato', EMERGING: 'emergente', SURVEYED: 'rilevato', CONSOLIDATED: 'consolidato' });
export const PRESENCE_LABELS = Object.freeze({ 'non-rilevato': 'Non rilevato', emergente: 'Emergente', rilevato: 'Rilevato', consolidato: 'Consolidato' });
export const PRESENCE_RULES = Object.freeze({
  emerge: { share: 0.6, weeks: 3, trend: 0.1, visibility: 50, size: 1.5 },
  enter: { share: 1, weeks: 4, minWeeks: 3, visibility: 30 },
  fade: { share: 0.45, weeks: 6, minWeeks: 8, maxWeeks: 26, cooldown: 16 },
  consolidate: { share: 3, weeks: 12 },
  weaken: { share: 2.2, weeks: 8 },
  exit: { share: 0.6, weeks: 8, minWeeks: 12, cooldown: 16 }
});
// Small forces move less in absolute terms: 1 at `full` points and above, down to 0.3 for the smallest.
const sizeFactor = (share, full) => clamp(Math.sqrt(Math.max(0, share) / full), 0.3, 1);
const surveyedStatus = status => status === PRESENCE.SURVEYED || status === PRESENCE.CONSOLIDATED;
// Worlds saved before the presence model had every force in the polls.
export const isSurveyed = party => !party?.presence || surveyedStatus(party.presence.status);
const inResults = party => party.active && (party.isPlayer || isSurveyed(party));
const presenceFor = (status, week) => ({ status, since: week, above: 0, below: 0, cooldownUntil: null, entries: surveyedStatus(status) ? 1 : 0, exits: 0, recent: [], log: [] });
const initialPresence = (share, week) => presenceFor(share >= PRESENCE_RULES.consolidate.share ? PRESENCE.CONSOLIDATED : PRESENCE.SURVEYED, week);

function draw(world) {
  world.rngState = (Math.imul(world.rngState, 1664525) + 1013904223) >>> 0;
  return world.rngState / 4294967296;
}
const gaussian = world => draw(world) + draw(world) + draw(world) - 1.5;
const fill = (text, place) => String(text).replace('{region}', place.region || 'regione').replace('{municipality}', place.municipality || 'il tuo comune');
const tieKey = (a, b) => [a, b].sort().join('|');

// A brand colour is only reused in charts when it is saturated and mid-light enough to read.
function usableColor(hex) {
  if (!/^#[\da-f]{6}$/i.test(hex ?? '')) return false;
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1));
  return lightness > 0.32 && lightness < 0.72 && saturation > 0.35;
}
function nextSlot(world, preferred = null) {
  const used = new Set(world.parties.map(party => party.color));
  if (preferred && usableColor(preferred) && !used.has(preferred)) return preferred;
  return CHART_SLOTS.find(color => !used.has(color)) ?? CHART_SLOTS[world.parties.length % CHART_SLOTS.length];
}
function addParty(world, spec, week) {
  const axis = Number.isFinite(spec.axis) ? spec.axis : axisOf(spec.position);
  const party = {
    id: spec.id, label: spec.label, abbreviation: spec.abbreviation ?? null, officialName: spec.officialName ?? null,
    color: nextSlot(world, spec.brandColor ? readableOnDark(spec.brandColor) : null), brandColor: spec.brandColor ?? null, refSource: spec.refSource ?? 'real', origin: spec.origin ?? 'real',
    reference: spec.reference ?? null, pollReference: spec.pollReference ?? null, position: spec.position ?? positionOf(axis), axis, governing: Boolean(spec.governing),
    isPlayer: Boolean(spec.isPlayer), baseline: round2(spec.baseline), anchor: round2(spec.baseline),
    regional: Object.fromEntries(ITALIAN_REGIONS.map(region => [region, round2((draw(world) - 0.5) * 5 + (spec.isPlayer && region === world.place.region ? 2 : 0))])),
    strategy: spec.strategy ?? initialStrategy(spec, axis), strategySince: week, playerRelation: 0, cohesion: 62, crisis: null, active: true, createdWeek: week,
    // Simulated internal life: congress calendar and the weight of the internal minority (no real person involved).
    life: { nextCongress: week + 40 + Math.floor(draw(world) * 160), minority: round1(18 + draw(world) * 16), leadership: 'uscente', congresses: 0 },
    presence: spec.presence ?? initialPresence(spec.baseline, week),
    source: SIM
  };
  world.parties.push(party);
  return party;
}

// Where a party starts: the parties of the real majority back the executive, the far ends oppose it, the centre waits.
function initialStrategy(spec, axis) {
  if (spec.isPlayer) return 'autonoma';
  if (spec.governing) return 'governista';
  // The large forces outside the real majority lead the opposition; so do the far ends.
  if ((Number.isFinite(axis) && Math.abs(axis) >= 2) || (spec.baseline ?? 0) >= 10) return 'opposizione';
  return Number.isFinite(axis) && Math.abs(axis) <= 0 ? 'autonoma' : 'coalizione';
}
// Starting relations between two forces: close collocazione and a shared majority draw them together.
function initialTie(world, a, b) {
  const ideology = Number.isFinite(a.axis) && Number.isFinite(b.axis) ? 26 - 12 * Math.abs(a.axis - b.axis) : 0;
  const majority = a.governing && b.governing ? 18 : a.governing !== b.governing && (a.governing || b.governing) ? -6 : 0;
  return Math.round(clamp(ideology + majority + (draw(world) - 0.5) * 12, -100, 100));
}

// ---------- forces outside the polls ----------
// The forces of the database that the polls do not list share most of "Altri" (the rest are minor lists): each has a
// small simulated consensus weighted by its documented size (2x1000 choices, regional presence) and a visibility.
function latentEntry(spec, support, week) {
  const axis = Number.isFinite(spec.axis) ? spec.axis : axisOf(spec.position);
  const visibility = round1(clamp(12 + Math.min(1, Math.max(0, spec.weight ?? 0)) * 10 + (spec.regionalPresence ? 4 : 0), 5, 45));
  return {
    id: spec.id, label: spec.label, officialName: spec.officialName ?? spec.label, abbreviation: spec.abbreviation ?? null, brandColor: spec.brandColor ?? null,
    position: spec.position ?? positionOf(axis), axis, refSource: spec.refSource ?? 'real', origin: spec.origin ?? 'real', regional: Boolean(spec.regional), reference: spec.reference ?? null,
    support: round4(support), anchor: round4(support), base: round4(support), visibility, baseVisibility: visibility, presence: presenceFor(PRESENCE.NONE, week), source: SIM
  };
}
function seedLatent(world, candidates = []) {
  world.latent ??= [];
  const taken = new Set([...world.parties.map(party => party.id), ...world.latent.map(item => item.id)]);
  const fresh = [];
  for (const item of candidates) if (item?.id && item.label && !taken.has(item.id)) { taken.add(item.id); fresh.push(item); }
  if (!fresh.length) return world;
  const residual = world.residual ?? world.others;
  // The first seeding shares 70% of "Altri"; forces added later (a party added by the owner) start from a trace.
  const pool = world.latentSeeded ? Math.min(residual * 0.3, fresh.length * 0.08) : residual * 0.7;
  // Documented size counts, up to a cap: 2x1000 choices are not votes, and a dormant party can still collect them.
  const weights = fresh.map(item => (0.1 + Math.min(1, Math.max(0, item.weight ?? 0))) * (item.regional ? 0.6 : 1));
  const total = weights.reduce((sum, value) => sum + value, 0) || 1;
  let used = 0;
  for (const [index, item] of fresh.entries()) {
    const entry = latentEntry(item, Math.max(0.02, pool * weights[index] / total), world.week);
    used += entry.support;
    world.latent.push(entry);
  }
  world.residual = round2(Math.max(0.3, residual - used));
  world.latentSeeded = true;
  world.others = othersOf(world);
  return world;
}
// ---------- one force per party in the polls ----------
// A force recorded under another name of the same party (a MEF alias) or as a component of a list the polls
// measure as one force (Sinistra Italiana and Europa Verde inside Alleanza Verdi e Sinistra) becomes that single
// force. Nothing of the history is lost: in every poll the rows of the components are summed into its row.
// map: { fromId: toId }; identities: { toId: { label, officialName, abbreviation, position } }.
export function withCanonicalForces(input, map = {}, identities = {}) {
  if (!input?.parties?.some(party => map[party.id])) return input;
  const world = copy(input);
  const into = id => map[id] ?? id;
  for (const party of [...world.parties].filter(item => map[item.id])) {
    const target = into(party.id);
    const host = world.parties.find(item => item.id === target);
    if (host) {
      host.baseline = round2(host.baseline + party.baseline);
      host.anchor = round2((host.anchor ?? host.baseline) + (party.anchor ?? party.baseline));
      host.isPlayer = host.isPlayer || party.isPlayer;
      host.active = host.active || party.active;
    } else {
      const identity = identities[target] ?? {};
      const axis = identity.position ? axisOf(identity.position) : party.axis;
      world.parties.push({ ...party, id: target, label: identity.label ?? party.label, officialName: identity.officialName ?? party.officialName ?? null, abbreviation: identity.abbreviation ?? null, position: identity.position ?? party.position, axis: axis ?? party.axis, reference: null, pollReference: party.pollReference ?? null, mergedFrom: [party.id] });
    }
    const merged = world.parties.find(item => item.id === target);
    merged.mergedFrom = [...new Set([...(merged.mergedFrom ?? []), party.id])];
    world.parties = world.parties.filter(item => item !== party);
  }
  // Poll history: one row per force, components summed.
  world.polls = world.polls.map(poll => {
    const rows = new Map();
    for (const row of poll.results) {
      const id = into(row.partyId);
      const current = rows.get(id);
      rows.set(id, current ? { ...current, share: round1(current.share + row.share), delta: round1((current.delta ?? 0) + (row.delta ?? 0)) } : { ...row, partyId: id });
    }
    return { ...poll, results: [...rows.values()], emerging: (poll.emerging ?? []).filter(item => !map[item.partyId]), moves: (poll.moves ?? []).map(move => ({ ...move, id: into(move.id) })) };
  });
  const pair = key => key.split('|').map(into);
  const ties = {};
  for (const [key, value] of Object.entries(world.ties ?? {})) {
    const [a, b] = pair(key);
    if (a === b) continue;
    const merged = tieKey(a, b);
    ties[merged] = merged in ties ? round1((ties[merged] + value) / 2) : value;
  }
  world.ties = ties;
  for (const bag of ['grudges', 'cooldowns']) world[bag] = Object.fromEntries(Object.entries(world[bag] ?? {}).map(([key, value]) => [key.includes('|') ? key.split('|').map(into).join('|') : key, value]));
  world.effects = (world.effects ?? []).map(effect => effect.partyId ? { ...effect, partyId: into(effect.partyId) } : effect);
  world.events = (world.events ?? []).map(event => event.partyId ? { ...event, partyId: into(event.partyId) } : event);
  world.presenceMoves = (world.presenceMoves ?? []).map(move => ({ ...move, id: into(move.id) }));
  world.alliances = (world.alliances ?? []).map(alliance => {
    const partyIds = [...new Set(alliance.partyIds.map(into))];
    return partyIds.length < 2 && alliance.status === 'active' ? { ...alliance, partyIds, status: 'broken', brokenAt: alliance.brokenAt ?? world.createdAt } : { ...alliance, partyIds };
  });
  world.latent = (world.latent ?? []).filter(item => !map[item.id]);
  if (world.playerPartyId) world.playerPartyId = into(world.playerPartyId);
  world.others = othersOf(world);
  return world;
}
// The owner's corrections to a party (colour, abbreviation, official name, collocazione) reach the forces of the
// world. A colour too dark or too light for the dark game surface keeps its hue and gets a readable lightness.
export function readableOnDark(hex) {
  if (!/^#[\da-f]{6}$/i.test(hex ?? '')) return null;
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  const light = clamp(l, 0.46, 0.7), sat = clamp(s, 0.4, 0.95);
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat, p = 2 * light - q;
  const channel = t => { t = (t + 1) % 1; const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; return Math.round(v * 255).toString(16).padStart(2, '0'); };
  return `#${channel(h + 1 / 3)}${channel(h)}${channel(h - 1 / 3)}`;
}
export function withPartyIdentities(input, identities = {}) {
  if (!input?.parties) return input;
  const changes = input.parties.filter(party => {
    const identity = identities[party.id];
    if (!identity) return false;
    const color = identity.color ? readableOnDark(identity.color) : null;
    return (identity.abbreviation && identity.abbreviation !== party.abbreviation) || (identity.officialName && identity.officialName !== party.officialName) || (color && color !== party.color) || (identity.position && identity.position !== party.position);
  });
  if (!changes.length) return input;
  const world = copy(input);
  for (const party of world.parties) {
    const identity = identities[party.id];
    if (!identity) continue;
    if (identity.abbreviation) party.abbreviation = identity.abbreviation;
    if (identity.officialName) party.officialName = identity.officialName;
    if (identity.position && identity.position !== party.position) { party.position = identity.position; party.axis = axisOf(identity.position); }
    const color = identity.color ? readableOnDark(identity.color) : null;
    if (color) { party.brandColor = identity.color; party.color = color; }
  }
  return world;
}
// Saves made before the presence model: every force they list was in the polls; the forces of the database that
// were not are added outside the polls, and the ones no longer available (hidden by the owner) leave the pool.
export function withLatentForces(input, candidates = []) {
  if (!input || !candidates.length) return input;
  const world = copy(input);
  world.latent ??= [];
  world.residual ??= world.others;
  const available = new Set(candidates.map(item => item.id));
  const gone = world.latent.filter(item => !available.has(item.id));
  if (gone.length) {
    world.latent = world.latent.filter(item => available.has(item.id));
    world.residual = round2(world.residual + gone.reduce((sum, item) => sum + item.support, 0));
  }
  seedLatent(world, candidates);
  world.others = othersOf(world);
  return world;
}
const outsideForces = world => [...(world.latent ?? []), ...world.parties.filter(party => party.active && !party.isPlayer && !isSurveyed(party))];
const isLatent = force => Object.hasOwn(force, 'support');
// Moves the consensus of a force, whether it is a party of the world or a latent force; `anchor` is the share that stays.
function bump(force, delta, anchor = 0) {
  const key = isLatent(force) ? 'support' : 'baseline';
  const floor = isLatent(force) ? 0.02 : 0.3;
  force[key] = round4(Math.max(floor, force[key] + delta));
  if (anchor) force.anchor = round4(Math.max(floor, (force.anchor ?? force[key]) + delta * anchor));
}
const notice = (force, delta) => { force.visibility = round1(clamp((force.visibility ?? 20) + delta, 0, 100)); };
// Voters of forces in trouble look around: close forces outside the polls get noticed.
function stirOutside(world, partyIds, delta) {
  const sources = partyIds.map(id => world.parties.find(item => item.id === id)).filter(Boolean);
  for (const force of outsideForces(world)) if (sources.some(source => distance(force, source) <= 1)) notice(force, delta);
}

// forces: [{ id, label, abbreviation, share, position, governing, reference, pollReference }] — real entities chosen by the caller.
// realPoll: the real poll the career opens with ({ id, label, publishedAt, sourceUrl, sourceName, results: [{ partyId, share, delta }] }).
// latent: the other forces of the database, not measured by the opening poll ({ id, label, abbreviation, position, weight, regional }):
// they start outside the polls and can enter them later (see PRESENCE).
export function createWorld({ seedText, date, week = 1, place = {}, playerParty = null, forces = [], stats = {}, realPoll = null, pollNoise = 1, latent = [] }) {
  const seed = hash(`${seedText}|mondo`);
  const world = {
    version: 3, source: SIM, seed, rngState: seed, createdAt: date, week, place, playerPartyId: playerParty?.id ?? null, pollNoise,
    parties: [], others: 8, undecided: 27, effects: [], alliances: [], figures: [], events: [], polls: [], ties: {}, grudges: {}, cooldowns: {}, lastEventId: null,
    latent: [], residual: null, presenceMoves: []
  };
  const included = forces.reduce((sum, force) => sum + force.share, 0);
  world.others = round2(Math.max(realPoll ? 1 : 4, 100 - included));
  for (const force of forces) addParty(world, { id: force.id, label: force.label, officialName: force.officialName, abbreviation: force.abbreviation, baseline: force.share, reference: force.reference, pollReference: force.pollReference, position: force.position, governing: force.governing, refSource: force.refSource ?? 'real' }, week);
  if (playerParty) attachPlayerParty(world, playerParty, week);
  for (let i = 0; i < world.parties.length; i++) for (let j = i + 1; j < world.parties.length; j++) world.ties[tieKey(world.parties[i].id, world.parties[j].id)] = initialTie(world, world.parties[i], world.parties[j]);
  world.residual = world.others;
  seedLatent(world, latent);
  carvePlayerShare(world);
  if (realPoll?.results?.length) publishRealPoll(world, realPoll, { date, stats });
  else publishPoll(world, { date, stats, parliament: null, game: null });
  return world;
}

// The simulated polls start from the last real one: a player's party that the source does not measure takes its
// initial consensus first from “Altri” (minor lists and forces outside the polls): half of it, up to 60% of “Altri”; the rest evenly
// from the other forces, so that the real forces keep their figures in the first simulated weeks.
function carvePlayerShare(world) {
  const player = playerParty(world);
  if (!player || isSurveyed(player) || !(player.baseline > 0)) return;
  const others = othersOf(world);
  const fromOthers = Math.min(player.baseline * 0.5, others * 0.6);
  if (others > 0 && Array.isArray(world.latent)) {
    const factor = (others - fromOthers) / others;
    world.residual = round4((world.residual ?? others) * factor);
    for (const force of world.latent) for (const key of ['support', 'anchor', 'base']) if (Number.isFinite(force[key])) force[key] = round4(Math.max(0.01, force[key] * factor));
  }
  const rest = player.baseline - fromOthers;
  const forces = world.parties.filter(party => party.active && !party.isPlayer && isSurveyed(party));
  const total = forces.reduce((sum, party) => sum + party.baseline, 0);
  if (rest > 0 && total > 0) for (const party of forces) { const share = rest * party.baseline / total; party.baseline = round4(party.baseline - share); party.anchor = round4((party.anchor ?? party.baseline) - share); }
  // Where the new party's starting consensus comes from, kept for the explanations.
  world.playerStart = { fromOthers: round2(fromOthers), fromForces: round2(Math.max(0, rest)), source: SIM };
  world.others = othersOf(world);
}
// The player's party always appears; a real party keeps only its real identity.
export function setPlayerParty(input, party) {
  return attachPlayerParty(copy(input), party, input?.week ?? 1);
}
function attachPlayerParty(world, party, week) {
  for (const item of world.parties) item.isPlayer = false;
  world.playerPartyId = party?.id ?? null;
  // The player's own party when the polls measure it inside a list (e.g. Sinistra Italiana inside AVS).
  world.playerComponent = party?.component ?? null;
  if (!party) return world;
  let entry = world.parties.find(item => item.id === party.id);
  if (!entry) {
    // A force of the database still outside the polls brings its simulated consensus and its presence with it.
    const latent = world.latent?.find(item => item.id === party.id) ?? null;
    if (latent) world.latent = world.latent.filter(item => item !== latent);
    const baseline = latent ? Math.max(0.3, latent.support) : party.initialShare ?? (party.founder ? 1.5 + draw(world) * 1.5 : 1 + draw(world) * 1.5);
    entry = addParty(world, { id: party.id, label: party.label || 'Il tuo partito', abbreviation: party.abbreviation, brandColor: party.brandColor, refSource: party.refSource, origin: 'player', isPlayer: true, baseline, reference: party.reference ?? null, position: party.position ?? latent?.position ?? null, presence: latent?.presence ?? presenceFor(PRESENCE.NONE, week) }, week);
    if (latent) entry.visibility = latent.visibility;
    for (const other of world.parties) if (other !== entry) world.ties[tieKey(entry.id, other.id)] ??= initialTie(world, entry, other);
  }
  if (party.position && !entry.position) { entry.position = party.position; entry.axis = axisOf(party.position); }
  // The player's relations with the other forces start from ideology: close forces are warmer, distant ones colder.
  for (const other of world.parties) if (other !== entry && !other.playerRelation && Number.isFinite(entry.axis) && Number.isFinite(other.axis)) other.playerRelation = round1(clamp(12 - 8 * Math.abs(entry.axis - other.axis), -30, 20));
  entry.isPlayer = true;
  entry.active = true;
  return world;
}

export function isLegacyWorld(world) {
  return (world?.version ?? 2) < 3 && Boolean(world?.parties?.some(party => LEGACY_ORIGINS.includes(party.origin)));
}
export function normalizeWorld(world) {
  if (!world || typeof world !== 'object' || !Array.isArray(world.parties)) return null;
  const week = world.week ?? 1;
  // Before the presence model every force of the world was in the polls: it keeps its place there.
  return { effects: [], alliances: [], figures: [], events: [], polls: [], others: 4, undecided: 27, place: {}, ties: {}, grudges: {}, cooldowns: {}, pollNoise: 1, presenceMoves: [], ...world, latent: Array.isArray(world.latent) ? world.latent : [], residual: world.residual ?? world.others ?? 4, parties: world.parties.map(party => ({ strategy: 'autonoma', strategySince: week, playerRelation: 0, axis: axisOf(party.position), life: { nextCongress: week + 60 + (hash(party.id) % 120), minority: 22, leadership: 'uscente', congresses: 0 }, ...party, presence: party.presence ?? initialPresence(party.baseline ?? 0, week) })) };
}
// The world knows the collocazione of the real entities: older saves get it without being rebuilt.
export function withPositions(input, positions = {}) {
  if (!input) return input;
  const world = copy(input);
  for (const party of world.parties) if (!party.position && positions[party.id]) { party.position = positions[party.id]; party.axis = axisOf(party.position); }
  return world;
}

// ---------- shares ----------
// An effect moves a force in proportion to its size (−0.5 is a lot for a 1% party, little for a 27% one) and comes
// in and goes out over two weeks instead of in a single step. Effects of one week (recomputed every week) count whole.
function effectWeight(effect) {
  const total = effect.total ?? effect.remaining;
  if (!Number.isFinite(total) || total <= 1) return 1;
  return Math.min(1, (total - effect.remaining + 1) / 2, effect.remaining / 2 + 0.5);
}
function effectSum(world, party, scope, region = null) {
  const scale = sizeFactor(party.baseline, 8) * (party.isPlayer ? 1.3 : 1);
  return world.effects.filter(effect => effect.scope === scope && (effect.partyId === party.id || (effect.strategy && effect.strategy === party.strategy && !party.isPlayer)) && (!region || effect.region === region))
    .reduce((sum, effect) => sum + effect.delta * effectWeight(effect) * (effect.unscaled ? 1 : Math.min(1, scale)), 0);
}
function normalize(rows, others) {
  const total = rows.reduce((sum, row) => sum + row.raw, 0) + others;
  return rows.map(row => ({ partyId: row.partyId, share: round2(row.raw / total * 100) }));
}
const rawOf = (world, party) => Math.max(0.3, party.baseline + effectSum(world, party, 'national'));
// "Altri": minor lists plus every force outside the polls (latent forces of the database, forces that left the survey).
function othersOf(world) {
  if (!Array.isArray(world.latent)) return world.others;
  const latent = world.latent.reduce((sum, item) => sum + item.support, 0);
  const outside = world.parties.filter(party => party.active && !party.isPlayer && !isSurveyed(party)).reduce((sum, party) => sum + rawOf(world, party), 0);
  return round2(Math.max(0.5, (world.residual ?? world.others) + latent + outside));
}
// The true (unsampled) share of every force the world knows, in the polls or not.
function trueShares(world) {
  const rows = [...world.parties.filter(party => party.active).map(party => [party.id, rawOf(world, party)]), ...(world.latent ?? []).map(item => [item.id, item.support])];
  const total = rows.reduce((sum, [, raw]) => sum + raw, 0) + (Array.isArray(world.latent) ? world.residual ?? world.others : world.others);
  return new Map(rows.map(([id, raw]) => [id, raw / (total || 1) * 100]));
}
// Only the forces in the survey (and the player's party, always estimated) have a row; the others are in "Altri".
export function nationalShares(world) {
  return normalize(world.parties.filter(inResults).map(party => ({ partyId: party.id, raw: rawOf(world, party) })), othersOf(world));
}
export function regionalShares(world, region, boost = 0) {
  const national = nationalShares(world);
  return normalize(national.map(row => {
    const party = world.parties.find(item => item.id === row.partyId);
    return { partyId: row.partyId, raw: Math.max(0.3, row.share + (party.regional?.[region] ?? 0) + effectSum(world, party, 'region', region) + (party.isPlayer && region === world.place.region ? boost : 0)) };
  }), othersOf(world));
}
export function localShares(world, regionalBoost = 0, localBoost = 0) {
  const regional = regionalShares(world, world.place.region, regionalBoost);
  return normalize(regional.map(row => {
    const party = world.parties.find(item => item.id === row.partyId);
    return { partyId: row.partyId, raw: Math.max(0.3, row.share + effectSum(world, party, 'local') + (party.isPlayer ? localBoost : 0)) };
  }), othersOf(world));
}
// Personal standing turns into territorial pull for the player's party.
export function personalBoosts(stats = {}, relations = []) {
  const civic = relations.find(item => item.id === 'civic')?.value ?? 45;
  return {
    regional: clamp(((stats.popularity ?? 45) - 45) * 0.03 + ((stats.notoriety ?? 30) - 30) * 0.02, -2, 3),
    local: clamp(((stats.popularity ?? 45) - 45) * 0.08 + (civic - 45) * 0.05, -3, 5)
  };
}

// ---------- polls ----------
// A poll is not a fresh random draw every week: institutes weight their panels, so the error persists from one
// week to the next (AR 0.7) and each institute has a small, stable house effect. Consecutive polls therefore move by
// tenths of a point, not by whole points, while the level can still differ from the true share within the margin.
const POLL_ERROR_MEMORY = 0.7;
function houseEffect(instituteId, partyId, share) {
  const offset = (hash(`${instituteId}|${partyId}`) % 1000) / 1000 - 0.5;
  return offset * 0.3 * clamp(Math.sqrt(Math.max(share, 0.1) / 10), 0.3, 1.2);
}
function sampleShares(world, shares, sample, instituteId = 'x') {
  world.pollErrors ??= {};
  const noisy = shares.map(row => {
    const p = row.share / 100;
    const sigma = Math.sqrt(Math.max(0.0004, p * (1 - p)) / sample) * 100;
    const error = round4((world.pollErrors[row.partyId] ?? 0) * POLL_ERROR_MEMORY + gaussian(world) * 2 * 0.25 * sigma * (world.pollNoise ?? 1));
    world.pollErrors[row.partyId] = error;
    return { partyId: row.partyId, raw: Math.max(0.2, row.share + error + houseEffect(instituteId, row.partyId, row.share)) };
  });
  return normalize(noisy, 100 - shares.reduce((sum, row) => sum + row.share, 0));
}
// No force moves by more than a credible amount between two consecutive polls: large changes (a split, a crisis)
// show up over a few weeks, as in real series.
const weeklyCap = share => 0.25 + 0.035 * share;
function publishPoll(world, { date, stats = {}, parliament = null, game = null }) {
  const institute = POLL_INSTITUTES[Math.floor(draw(world) * POLL_INSTITUTES.length)];
  const sample = Math.round((institute.sample[0] + draw(world) * (institute.sample[1] - institute.sample[0])) / 10) * 10;
  const margin = round1(1.96 * Math.sqrt(0.25 / sample) * 100);
  const previous = world.polls.at(-1);
  const boosts = personalBoosts(stats, game?.relations ?? []);
  const player = world.playerPartyId;
  const playerSurveyed = isSurveyed(world.parties.find(item => item.id === player));
  // A force that has just entered the survey has no previous figure: its change starts from the next poll.
  const results = sampleShares(world, nationalShares(world), sample, institute.id).map(row => {
    const before = previous?.results.find(item => item.partyId === row.partyId)?.share;
    // The first simulated poll starts from the real one: it may move less than an ordinary week.
    const cap = Number.isFinite(before) ? weeklyCap(before) * (previous?.source === 'real' ? 0.6 : 1) : 0;
    const share = Number.isFinite(before) ? round1(clamp(row.share, before - cap, before + cap)) : round1(row.share);
    return { ...row, share, delta: Number.isFinite(before) ? round1(share - before) : 0, ...(row.partyId === player && !playerSurveyed ? { internal: true } : {}) };
  });
  const regional = player ? Object.fromEntries(ITALIAN_REGIONS.map(region => [region, round1(regionalShares(world, region, boosts.regional).find(row => row.partyId === player)?.share ?? 0)])) : {};
  const local = player ? round1(localShares(world, boosts.regional, boosts.local).find(row => row.partyId === player)?.share ?? 0) : null;
  const mood = world.society?.mood ?? 50;
  const government = parliament?.government && ['active', 'crisis'].includes(parliament.government.status) ? round1(clamp(22 + (parliament.government.stability ?? 50) * 0.3 + (mood - 50) * 0.35 + 7 + gaussian(world) * 2, 5, 75)) : null;
  const undecidedTarget = 27 + (48 - (world.society?.trust ?? 48)) * 0.3;
  world.undecided = round1(clamp(world.undecided + gaussian(world) + (parliament?.government?.status === 'crisis' ? 0.8 : 0) - (world.undecided - undecidedTarget) * 0.1, 15, 42));
  const why = player ? explainShare(world, results.find(row => row.partyId === player)) : [];
  const poll = {
    why,
    id: `sondaggio-${world.week}-${world.polls.length}-${sample}`, week: world.week, date, institute: institute.name, sample, margin, undecided: world.undecided, results, regional, local,
    regionalHome: player ? regional[world.place.region] ?? null : null,
    personal: { approval: round1(clamp((stats.popularity ?? 45) * 0.55 + (stats.reputation ?? 50) * 0.45 + gaussian(world) * 2.4, 0, 100)), popularity: stats.popularity ?? null, notoriety: stats.notoriety ?? null },
    government: government === null ? null : { approval: government },
    executive: government === null && world.society?.executive ? { label: world.society.executive.label, approval: round1(clamp(world.society.executive.approval + gaussian(world) * 1.5, 5, 80)) } : null,
    mood: world.society ? { satisfaction: world.society.mood, trust: world.society.trust } : null,
    ...presenceSnapshot(world, results),
    source: SIM
  };
  // The full regional map is kept for the latest poll only; the home region stays in every entry.
  world.polls = [...world.polls.map(item => item.regional ? { ...item, regional: null } : item), poll].slice(-HISTORY);
  return poll;
}
// What a poll says besides its rows: "Altri", the forces under observation (emerging, still inside "Altri") and the
// forces that entered or left the survey this week.
function presenceSnapshot(world, results) {
  const shares = trueShares(world);
  const emerging = outsideForces(world).filter(force => force.presence?.status === PRESENCE.EMERGING)
    .map(force => ({ partyId: force.id, label: force.label, abbreviation: force.abbreviation ?? null, share: round1(shares.get(force.id) ?? 0) }))
    .sort((a, b) => b.share - a.share).slice(0, 6);
  return { others: round1(Math.max(0, 100 - results.reduce((sum, row) => sum + row.share, 0))), emerging, moves: (world.presenceMoves ?? []).filter(move => move.week === world.week) };
}
// The career opens with a snapshot of the real source: only the forces it measures, with its figures, and "Altri" as
// the source leaves it. No other force of the database gets a figure. The player's party, when the source does not
// measure it, is a simulated estimate outside the real total, marked as such.
function publishRealPoll(world, real, { date, stats = {} }) {
  const player = world.playerPartyId;
  const measured = new Set(real.results.map(row => row.partyId));
  const results = real.results.filter(row => world.parties.some(party => party.id === row.partyId)).map(row => ({ partyId: row.partyId, share: row.share, delta: 0, real: true }));
  const others = round1(Math.max(0, 100 - results.reduce((sum, row) => sum + row.share, 0)));
  if (player && !measured.has(player)) results.push({ partyId: player, share: round1(nationalShares(world).find(row => row.partyId === player)?.share ?? 0), delta: 0, simulated: true, outsideSource: true });
  const regional = player ? Object.fromEntries(ITALIAN_REGIONS.map(region => [region, round1(regionalShares(world, region).find(row => row.partyId === player)?.share ?? 0)])) : {};
  const poll = {
    id: `sondaggio-reale-${real.id}`, week: world.week, date: real.publishedAt ?? date, institute: real.label, sample: null, margin: null, undecided: world.undecided, results, regional,
    local: player ? round1(localShares(world).find(row => row.partyId === player)?.share ?? 0) : null, regionalHome: player ? regional[world.place.region] ?? null : null,
    personal: { approval: round1(clamp((stats.popularity ?? 45) * 0.55 + (stats.reputation ?? 50) * 0.45, 0, 100)), popularity: stats.popularity ?? null, notoriety: stats.notoriety ?? null },
    government: null, executive: null, mood: null, why: [], others, othersSource: 'real', emerging: [], moves: [],
    source: 'real', real: { id: real.id, label: real.label, publishedAt: real.publishedAt, fieldworkFrom: real.fieldworkFrom ?? null, fieldworkTo: real.fieldworkTo ?? null, sourceUrl: real.sourceUrl, sourceName: real.sourceName, method: real.method ?? null }
  };
  world.polls = [...world.polls, poll].slice(-HISTORY);
  return poll;
}
// Why the player's party moved: its own drivers, the effects in force (by cause), and the rest (rivals and sampling).
const EFFECT_LABELS = { 'crisi-interna': 'Crisi interna del partito', alleanza: 'Effetto dell’alleanza', rottura: 'Rottura di un’alleanza', carriera: 'Iniziative e risultati del politico', fiducia: 'Sfiducia nelle istituzioni' };
function explainShare(world, row) {
  const player = playerParty(world);
  if (!player || !row) return [];
  const total = world.parties.filter(inResults).reduce((sum, party) => sum + rawOf(world, party), 0) + othersOf(world);
  const factor = 100 / (total || 100);
  const byCause = {};
  for (const effect of world.effects.filter(item => item.scope === 'national' && (item.partyId === player.id || (item.strategy && item.strategy === player.strategy)))) {
    const label = effect.label ?? EFFECT_LABELS[effect.cause] ?? 'Altri fattori';
    byCause[label] = round2((byCause[label] ?? 0) + effect.delta);
  }
  const previous = player.lastEffects ?? {};
  player.lastEffects = byCause;
  const causes = [];
  for (const [label, value] of Object.entries(player.components ?? {})) if (Math.abs(value * factor) >= 0.05) causes.push({ label, delta: round1(value * factor) });
  for (const label of new Set([...Object.keys(byCause), ...Object.keys(previous)])) {
    const change = (byCause[label] ?? 0) - (previous[label] ?? 0);
    if (Math.abs(change * factor) >= 0.05) causes.push({ label: change > 0 || byCause[label] ? label : `Si esaurisce: ${label.toLowerCase()}`, delta: round1(change * factor) });
  }
  player.components = {};
  const explained = causes.reduce((sum, item) => sum + item.delta, 0);
  const rest = round1(row.delta - explained);
  if (Math.abs(rest) >= 0.1) causes.push({ label: 'Mosse degli altri partiti e oscillazione del campione', delta: rest });
  return causes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 6);
}
export const latestPoll = world => world?.polls?.at(-1) ?? null;
export function playerPollShare(world, scope = 'national') {
  const poll = latestPoll(world);
  if (!poll || !world.playerPartyId) return null;
  if (scope === 'local') return poll.local;
  if (scope === 'regional') return poll.regionalHome ?? null;
  return poll.results.find(row => row.partyId === world.playerPartyId)?.share ?? null;
}
function trendOf(world, partyId, weeks = 4) {
  const now = world.polls.at(-1)?.results.find(row => row.partyId === partyId)?.share;
  const then = world.polls.at(-1 - weeks)?.results.find(row => row.partyId === partyId)?.share ?? world.polls[0]?.results.find(row => row.partyId === partyId)?.share;
  return Number.isFinite(now) && Number.isFinite(then) ? now - then : 0;
}

// ---------- events & dynamics ----------
function logEvent(world, date, entry) {
  world.events = [{ id: `cronaca-${world.week}-${world.events.length}-${world.rngState % 9973}`, week: world.week, date, tone: 'neutral', lines: [], source: SIM, ...entry }, ...world.events].slice(0, 40);
  return world.events[0];
}
function addEffect(world, effect) {
  if (!effect.delta) return;
  const entry = { id: `effetto-${world.week}-${world.effects.length}-${world.rngState % 997}`, scope: 'national', remaining: 4, source: SIM, ...effect };
  world.effects.push({ ...entry, total: entry.remaining });
}
function playerParty(world) { return world.parties.find(item => item.isPlayer) ?? null; }
function inMajority(parliament) {
  const government = parliament?.government;
  if (!government || !['active', 'crisis'].includes(government.status) || !parliament.player?.groupId) return null;
  return [...government.coalitionGroupIds, ...government.supportingGroupIds].includes(parliament.player.groupId);
}
function applyWorldEvent(world, event, date, parliament) {
  const lines = [];
  const player = playerParty(world);
  if (event.executive) addEffect(world, { strategy: 'governista', delta: event.executive, remaining: event.duration, cause: event.id });
  if (event.challengers) addEffect(world, { strategy: 'opposizione', delta: event.challengers, remaining: event.duration, cause: event.id });
  if (event.small) {
    for (const party of world.parties.filter(item => !item.isPlayer && item.baseline < 5)) addEffect(world, { partyId: party.id, delta: event.small, remaining: event.duration, cause: event.id });
    // What helps or hurts the small forces also changes how much the ones outside the polls are noticed.
    for (const force of (world.latent ?? []).filter(item => item.support >= 0.3)) notice(force, Math.sign(event.small) * 3);
  }
  const majority = inMajority(parliament);
  if (player && majority !== null && (event.majority || event.opposition)) {
    const delta = majority ? event.majority ?? 0 : event.opposition ?? 0;
    addEffect(world, { partyId: player.id, delta, remaining: event.duration, cause: event.id, label: fill(event.title, world.place) });
    if (delta) lines.push(`${player.label} ${delta > 0 ? '+' : ''}${delta} (${majority ? 'in maggioranza' : 'all’opposizione'})`);
  }
  if (player && event.regionalPlayer) addEffect(world, { partyId: player.id, scope: 'region', region: world.place.region, delta: event.regionalPlayer, remaining: event.duration, cause: event.id, label: fill(event.title, world.place) });
  if (player && event.localPlayer) addEffect(world, { partyId: player.id, scope: 'local', delta: event.localPlayer, remaining: event.duration, cause: event.id, label: fill(event.title, world.place) });
  if (event.stability && parliament?.government && ['active', 'crisis'].includes(parliament.government.status)) {
    parliament.government.stability = clamp(Math.round((parliament.government.stability ?? 50) + event.stability), 0, 100);
    lines.push(`Stabilità del governo ${event.stability > 0 ? '+' : ''}${event.stability}`);
  }
  const moved = world.parties.filter(item => !item.isPlayer && inResults(item) && ((event.executive && item.strategy === 'governista') || (event.challengers && item.strategy === 'opposizione'))).map(item => item.label);
  if (moved.length) lines.push(`Effetti su chi ${event.executive && event.challengers ? 'sostiene o contrasta' : event.executive ? 'sostiene' : 'contrasta'} l’esecutivo: ${moved.slice(0, 3).join(', ')}`);
  return logEvent(world, date, { kind: 'evento', eventId: event.id, icon: event.icon, scope: event.scope, title: fill(event.title, world.place), body: fill(event.body, world.place), lines, tone: (event.stability ?? 0) < 0 || (event.majority ?? 0) < 0 ? 'bad' : 'neutral', reactable: Boolean(event.reactable) });
}

// A party in crisis loses voters for good: close forces outside the polls pick up part of them, and get noticed.
function bleed(world, party) {
  const loss = round2(clamp(party.baseline * 0.03, 0.02, 0.08));
  bump(party, -loss, 0.5);
  const receivers = outsideForces(world).filter(force => distance(force, party) <= 1);
  const weights = receivers.map(force => ((force.visibility ?? 20) + 10) * ((isLatent(force) ? force.support : force.baseline) + 0.1));
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (!total) return;
  receivers.forEach((force, index) => { bump(force, loss * 0.6 * weights[index] / total, 0.5); notice(force, 1.5); });
}
// Every party pursues its own strategy and changes it when it stops paying off.
function partyAgents(world, date, { approval, player, playerIsLeader, playerStrategy }) {
  const offers = [];
  for (const party of world.parties.filter(item => item.active && !item.isPlayer && isSurveyed(item))) {
    party.cohesion = clamp(Math.round(party.cohesion + (draw(world) - 0.52) * 6 + (62 - party.cohesion) * 0.04), 0, 100);
    if (!party.crisis && party.cohesion < 30) {
      party.crisis = { since: world.week, source: SIM };
      addEffect(world, { partyId: party.id, delta: -0.8, remaining: 4, cause: 'crisi-interna' });
      logEvent(world, date, { kind: 'crisi', icon: 'alert', scope: 'nazionale', title: `Tensioni interne in ${party.label}`, body: 'Nello scenario il partito perde compattezza: dichiarazioni in ordine sparso e organi divisi (simulazione).', tone: 'bad', partyId: party.id });
    } else if (party.crisis && world.week - party.crisis.since >= 3 && party.cohesion >= 45) {
      party.crisis = null;
      logEvent(world, date, { kind: 'crisi', icon: 'link', scope: 'nazionale', title: `${party.label} ricompone le divisioni`, body: 'Nello scenario la crisi interna rientra (simulazione).', tone: 'neutral', partyId: party.id });
    }
    if (party.crisis) bleed(world, party);
    // What the strategy yields this week.
    const effect = party.strategy === 'governista' ? (approval - 50) / 500 : party.strategy === 'opposizione' ? (50 - approval) / 500 + 0.01 : party.strategy === 'coalizione' ? (world.alliances.some(item => item.status === 'active' && item.partyIds.includes(party.id)) ? 0.02 : -0.01) : 0;
    party.baseline = round2(Math.max(0.3, party.baseline + effect * sizeFactor(party.baseline, 6)));
    // Re-thinking the strategy: losing ground, or the climate turned.
    const trend = trendOf(world, party.id);
    if (world.week - party.strategySince >= 6 && (trend < -0.4 || draw(world) < 0.08)) {
      const options = (approval < 44 ? ['opposizione', 'coalizione'] : approval > 56 ? ['governista', 'coalizione'] : ['autonoma', 'coalizione', 'opposizione', 'governista']).filter(item => item !== party.strategy);
      const choice = options[Math.floor(draw(world) * options.length)] ?? party.strategy;
      if (choice !== party.strategy) {
        party.strategy = choice;
        party.strategySince = world.week;
        logEvent(world, date, { kind: 'strategia', icon: 'route', scope: 'nazionale', title: `${party.label} cambia strategia: ${STRATEGIES[choice].label.toLowerCase()}`, body: `${trend < -0.4 ? 'Dopo settimane in calo nei sondaggi, n' : 'N'}ello scenario il partito sceglie una nuova linea (simulazione).`, tone: 'neutral', partyId: party.id });
      }
    }
    // Relationship with the player's party: it fades, and conflicting lines wear it down.
    if (player) {
      const clash = (party.strategy === 'opposizione' && playerStrategy === 'governista') || (party.strategy === 'governista' && playerStrategy === 'opposizione');
      // Collocazione keeps pulling: close forces warm up over time, distant ones cool down.
      const ideology = (1.5 - distance(party, player)) * 0.15;
      party.playerRelation = round1(clamp(party.playerRelation * 0.97 + (clash ? -1.5 : party.strategy === playerStrategy ? 0.5 : 0) + ideology, -100, 100));
      const cooldown = key => world.week - (world.cooldowns[`${key}|${party.id}`] ?? -99);
      const allied = world.alliances.some(item => item.status === 'active' && item.partyIds.includes(player.id));
      if (playerIsLeader && party.strategy === 'coalizione' && party.playerRelation >= 15 && distance(party, player) <= 2 && !world.grudges?.[tieKey(party.id, player.id)] && !allied && cooldown('alleanza') >= 10 && draw(world) < 0.35) {
        world.cooldowns[`alleanza|${party.id}`] = world.week;
        offers.push({ templateId: 'proposta-alleanza', partyId: party.id, label: party.label, strategy: STRATEGIES[party.strategy].label });
      } else if (party.strategy === 'opposizione' && party.playerRelation <= -15 && cooldown('attacco') >= 8 && draw(world) < 0.3) {
        world.cooldowns[`attacco|${party.id}`] = world.week;
        offers.push({ templateId: 'attacco-avversario', partyId: party.id, label: party.label });
      }
    }
  }
  return offers;
}
// Why two forces can agree: collocazione, shared majority, common interest. An agreement across distant camps is
// only possible as a motivated tactical exception (both small and under the threshold, or both in crisis).
function agreementMotive(a, b) {
  const gap = distance(a, b);
  if (gap <= 1) return `affinità di collocazione (${a.position ?? 'n.d.'} e ${b.position ?? 'n.d.'})`;
  if (a.governing && b.governing) return 'stessa maggioranza di governo';
  if (gap === 2) return 'programmi compatibili su alcuni temi';
  if (a.baseline < 3 && b.baseline < 3) return 'accordo tattico per superare la soglia di sbarramento (eccezione motivata)';
  if (a.crisis && b.crisis) return 'accordo di sopravvivenza tra due forze in crisi (eccezione motivata)';
  return null;
}
function breakWithGrudge(world, alliance, date, reason) {
  alliance.status = 'broken';
  alliance.brokenAt = date;
  const key = tieKey(...alliance.partyIds.slice(0, 2));
  world.grudges[key] = 40;
  world.ties[key] = round1(clamp((world.ties[key] ?? 0) - 25, -100, 100));
  for (const id of alliance.partyIds) addEffect(world, { partyId: id, delta: -0.3, remaining: 3, cause: 'rottura' });
  stirOutside(world, alliance.partyIds, 4);
  logEvent(world, date, { kind: 'rottura', icon: 'unlink', scope: 'nazionale', title: `Si rompe l’${alliance.label.toLowerCase()}`, body: `${reason} Il rancore resterà: per molto tempo sarà difficile ritrovare un accordo (simulazione).`, tone: 'bad' });
}
function allianceDynamics(world, date) {
  world.grudges ??= {};
  for (const key of Object.keys(world.grudges)) { world.grudges[key] = round1(world.grudges[key] - 0.4); if (world.grudges[key] <= 0) delete world.grudges[key]; }
  const allied = new Set(world.alliances.filter(item => item.status === 'active').flatMap(item => item.partyIds));
  for (const [key, value] of Object.entries(world.ties)) {
    const [a, b] = key.split('|').map(id => world.parties.find(item => item.id === id));
    if (!a || !b) continue;
    // Strategies, collocazione and old wounds pull relations every week.
    const ideology = (2 - distance(a, b)) * 0.25;
    const majority = a.strategy === 'governista' && b.strategy === 'governista' ? 0.3 : 0;
    world.ties[key] = round1(clamp(value * 0.99 + (a.strategy === b.strategy ? 0.8 : -0.4) + ideology + majority - (world.grudges[key] ?? 0) / 100, -100, 100));
  }
  for (const alliance of world.alliances.filter(item => item.status === 'active')) {
    const tie = world.ties[tieKey(...alliance.partyIds)] ?? 0;
    const [a, b] = alliance.partyIds.map(id => world.parties.find(item => item.id === id));
    const strain = a && b ? Math.max(0, distance(a, b) - 1) * 1.2 : 0;
    alliance.cohesion = clamp(Math.round(alliance.cohesion + (draw(world) - 0.53) * 7 + (62 - alliance.cohesion) * 0.05 + tie / 50 - strain), 0, 100);
    if (alliance.cohesion < 25) breakWithGrudge(world, alliance, date, strain > 1 ? 'Troppa distanza sui programmi: l’accordo non regge.' : 'Veti incrociati e accuse reciproche: gli alleati vanno ognuno per la propria strada.');
  }
  if (draw(world) < 0.07) {
    const free = world.parties.filter(item => item.active && !item.isPlayer && isSurveyed(item) && !allied.has(item.id));
    const pairs = free.flatMap((first, index) => free.slice(index + 1).map(second => [first, second, world.ties[tieKey(first.id, second.id)] ?? 0]))
      .filter(([first, second, tie]) => !world.grudges[tieKey(first.id, second.id)] && agreementMotive(first, second) && (distance(first, second) <= 2 ? tie >= 15 : tie >= 35 && draw(world) < 0.2) && (first.strategy === 'coalizione' || second.strategy === 'coalizione' || first.strategy === second.strategy))
      .sort((x, y) => y[2] - x[2]);
    if (pairs.length) {
      const [first, second] = pairs[0];
      const motive = agreementMotive(first, second);
      world.alliances.push({ id: `alleanza-${world.week}-${hash(first.id + second.id) % 9973}`, label: `Intesa simulata ${first.label} – ${second.label}`, partyIds: [first.id, second.id], cohesion: 64, since: date, status: 'active', motive, source: SIM });
      logEvent(world, date, { kind: 'alleanza', icon: 'link', scope: 'nazionale', title: `Intesa tra ${first.label} e ${second.label}`, body: `Motivo: ${motive}. Nello scenario le due forze annunciano un percorso comune (simulazione, non un accordo reale).`, tone: 'neutral' });
    }
  }
  if (draw(world) < 0.03) {
    const count = world.figures.length + 1;
    const figure = { id: `figura-${count}-${world.rngState % 9973}`, name: `${CIVIC_FIGURE_LABEL} n.${count}`, role: 'Volto civico', partyId: null, since: date, status: 'active', simulated: true, source: SIM };
    world.figures.push(figure);
    logEvent(world, date, { kind: 'figura', icon: 'user', scope: 'locale', title: 'Emerge un nuovo volto civico', body: `${figure.name}: un amministratore civico di ${world.place.region || 'una regione'} guadagna visibilità (figura simulata, non una persona reale).`, tone: 'neutral' });
  }
}

// ---------- evolution of the parties (simulation only) ----------
// Congresses, leadership changes, internal minorities, splits, mergers, reorganisations and new forces.
// Nothing here is attributed to real people: new leaders are "nuova segreteria (simulata)", new forces carry explicit labels.
function congress(world, party, date) {
  const trend = trendOf(world, party.id, 8);
  const change = draw(world) < (party.cohesion < 40 || trend < -0.6 ? 0.55 : 0.18);
  party.life.congresses += 1;
  party.life.nextCongress = world.week + 150 + Math.floor(draw(world) * 70);
  if (change) {
    party.life.leadership = 'nuova';
    party.cohesion = clamp(party.cohesion + 12, 0, 100);
    party.life.minority = round1(clamp(party.life.minority - 8, 8, 60));
    addEffect(world, { partyId: party.id, delta: round2(0.2 + draw(world) * 0.4), remaining: 8, cause: 'congresso', label: 'Nuova segreteria' });
    const options = ['autonoma', 'coalizione', 'opposizione', 'governista'].filter(item => item !== party.strategy);
    if (draw(world) < 0.5) { party.strategy = options[Math.floor(draw(world) * options.length)]; party.strategySince = world.week; }
    logEvent(world, date, { kind: 'congresso', icon: 'crown', scope: 'nazionale', title: `Congresso di ${party.label}: cambia la leadership`, body: `Nello scenario una nuova segreteria (simulata, nessuna persona reale) guida il partito${party.strategySince === world.week ? ` e sceglie una nuova linea: ${STRATEGIES[party.strategy].label.toLowerCase()}` : ''}.`, tone: 'neutral', partyId: party.id });
  } else {
    party.life.leadership = 'confermata';
    party.cohesion = clamp(party.cohesion + 5, 0, 100);
    logEvent(world, date, { kind: 'congresso', icon: 'crown', scope: 'nazionale', title: `Congresso di ${party.label}: confermata la linea`, body: 'Nello scenario la maggioranza interna vince il congresso; la minoranza resta in campo (simulazione).', tone: 'neutral', partyId: party.id });
  }
}
function split(world, parent, date) {
  const direction = Number.isFinite(parent.axis) ? (parent.axis === 0 ? (draw(world) < 0.5 ? -1 : 1) : Math.sign(parent.axis)) : 1;
  const share = round2(parent.baseline * (0.14 + draw(world) * 0.1));
  parent.baseline = round2(Math.max(0.3, parent.baseline - share * 0.85));
  parent.anchor = round2(Math.max(0.3, parent.anchor - share * 0.6));
  parent.life.minority = round1(clamp(parent.life.minority - 15, 8, 60));
  parent.cohesion = clamp(parent.cohesion + 10, 0, 100);
  const count = world.parties.filter(item => item.origin === 'evoluzione').length + 1;
  const force = addParty(world, { id: `evoluzione-scissione-${world.week}-${hash(parent.id) % 997}`, label: `Scissione da ${shortName(parent.label)} (forza simulata n.${count})`, baseline: share, refSource: 'simulation', origin: 'evoluzione', axis: clamp((parent.axis ?? 0) + direction, -3, 3), strategy: 'opposizione', parentId: parent.id, presence: presenceFor(PRESENCE.EMERGING, world.week) }, world.week);
  force.parentId = parent.id;
  force.visibility = 45;
  for (const other of world.parties) if (other !== force) world.ties[tieKey(force.id, other.id)] = other === parent ? -35 : initialTie(world, force, other);
  logEvent(world, date, { kind: 'scissione', icon: 'unlink', scope: 'nazionale', title: `Scissione in ${parent.label}`, body: `Nello scenario la minoranza interna lascia il partito e fonda una nuova forza (${force.label}). Nessun dirigente reale è coinvolto: è un’evoluzione simulata. Per ora il suo consenso è dentro “Altri”: gli istituti la rileveranno se regge.`, tone: 'bad', partyId: parent.id });
}
function merge(world, absorber, absorbed, date) {
  absorbed.active = false;
  absorbed.mergedInto = absorber.id;
  absorber.baseline = round2(absorber.baseline + absorbed.baseline * 0.8);
  absorber.anchor = round2(absorber.anchor + absorbed.anchor * 0.6);
  for (const alliance of world.alliances.filter(item => item.status === 'active' && item.partyIds.includes(absorbed.id))) { alliance.status = 'broken'; alliance.brokenAt = date; }
  logEvent(world, date, { kind: 'fusione', icon: 'link', scope: 'nazionale', title: `${absorbed.label} confluisce in ${absorber.label}`, body: `Nello scenario due forze vicine (${absorber.position ?? 'collocazione n.d.'}) uniscono liste e organizzazione per contare di più (simulazione, non un accordo reale).`, tone: 'neutral' });
}
function partyLife(world, date) {
  for (const party of world.parties.filter(item => item.active && !item.isPlayer && isSurveyed(item))) {
    party.life ??= { nextCongress: world.week + 80, minority: 22, leadership: 'uscente', congresses: 0 };
    // The internal minority grows when the party is divided and losing ground.
    party.life.minority = round1(clamp(party.life.minority + (party.cohesion < 40 ? 0.6 : -0.2) + (trendOf(world, party.id, 6) < -0.5 ? 0.4 : 0), 8, 60));
    if (world.week >= party.life.nextCongress) congress(world, party, date);
    else if (party.cohesion < 32 && party.life.minority > 40 && party.baseline >= 3 && world.parties.filter(item => item.active && item.origin === 'evoluzione').length < EVOLVED_LIMIT && draw(world) < 0.06) split(world, party, date);
    else if (party.cohesion < 35 && !party.crisis && draw(world) < 0.02) {
      party.cohesion = clamp(party.cohesion + 8, 0, 100);
      logEvent(world, date, { kind: 'organizzazione', icon: 'route', scope: 'nazionale', title: `${party.label} si riorganizza`, body: 'Nello scenario nuovi dipartimenti e coordinatori territoriali provano a ricompattare il partito (simulazione).', tone: 'neutral', partyId: party.id });
    }
  }
  // Two small, close forces with good relations can merge.
  if (draw(world) < 0.03) {
    const small = world.parties.filter(item => item.active && !item.isPlayer && isSurveyed(item) && item.baseline < 3);
    const pairs = small.flatMap((a, index) => small.slice(index + 1).map(b => [a, b])).filter(([a, b]) => distance(a, b) <= 1 && (world.ties[tieKey(a.id, b.id)] ?? 0) >= 40 && !world.grudges?.[tieKey(a.id, b.id)]);
    if (pairs.length) { const [a, b] = pairs[Math.floor(draw(world) * pairs.length)]; if (a.baseline >= b.baseline) merge(world, a, b, date); else merge(world, b, a, date); }
  }
  // Rarely, a new civic force is born (simulated, with an explicit label).
  if (draw(world) < 0.004 && world.parties.filter(item => item.active && item.origin === 'evoluzione').length < EVOLVED_LIMIT) {
    const count = world.parties.filter(item => item.origin === 'evoluzione').length + 1;
    const force = addParty(world, { id: `evoluzione-civica-${world.week}-${world.rngState % 997}`, label: `Nuova forza civica (simulata n.${count})`, baseline: round2(0.8 + draw(world) * 0.9), refSource: 'simulation', origin: 'evoluzione', axis: Math.round((draw(world) - 0.5) * 2), strategy: 'autonoma', presence: presenceFor(PRESENCE.EMERGING, world.week) }, world.week);
    for (const other of world.parties) if (other !== force) world.ties[tieKey(force.id, other.id)] = initialTie(world, force, other);
    force.visibility = 35;
    logEvent(world, date, { kind: 'nuova-forza', icon: 'spark', scope: 'nazionale', title: 'Nasce una nuova forza civica', body: `${force.label}: amministratori locali e associazioni si presentano insieme (forza simulata, non un partito reale). Entrerà nei sondaggi solo se il consenso regge.`, tone: 'neutral' });
  }
}

// ---------- presence in the polls: the weekly step (simulation) ----------
const SPOTLIGHT_COOLDOWN = 6;
const RISE_COOLDOWN = 40;
const levelOf = force => isLatent(force) ? force.support : force.baseline;
// What a rising force gains comes from the voters of the close forces in the polls (all of them if none is close).
function takeFrom(world, force, amount) {
  const surveyed = world.parties.filter(party => party.active && !party.isPlayer && isSurveyed(party));
  const close = surveyed.filter(party => distance(party, force) <= 1);
  const donors = close.length ? close : surveyed;
  const total = donors.reduce((sum, party) => sum + party.baseline, 0);
  if (total > 0) for (const party of donors) bump(party, -amount * party.baseline / total, 0.5);
}
// A rise is the only way a force outside the polls gains ground for good: it starts from a condition (voters leaving a
// close party in trouble, distrust for the forces at the far ends, the European campaign, media attention), lasts a
// few months, then the force keeps part of what it gained. One at a time, and never two in a row.
function startRise(world, force, date, reason) {
  // A regional force grows at home: its weight in a national poll moves far less.
  force.rise = { since: world.week, until: world.week + 12 + Math.floor(draw(world) * 18), rate: round4((0.03 + draw(world) * 0.04) * (force.regional ? 0.35 : 1)), reason };
  world.cooldowns.rise = world.week;
  notice(force, 20);
  logEvent(world, date, { kind: 'visibilita', icon: 'trendUp', scope: 'nazionale', title: `${force.label} guadagna consensi`, body: `Nello scenario ${force.label} cresce (${reason}): per ora il suo consenso è dentro “Altri”; se regge per settimane, gli istituti potrebbero iniziare a rilevarla (simulazione, nessuna dichiarazione o iniziativa reale).`, tone: 'neutral', partyId: force.id });
}
function outsideDynamics(world, date, trust = 48) {
  const year = Number(String(date).slice(0, 4));
  const month = Number(String(date).slice(5, 7));
  const euroYear = year >= 2029 && (year - 2029) % 5 === 0;
  // Forces outside the polls go back towards their own level, which returns over the years to their original size;
  // during a rise they grow, taking voters from the close forces in the polls.
  for (const force of outsideForces(world)) {
    notice(force, ((force.baseVisibility ?? 20) - (force.visibility ?? 20)) * 0.06);
    if (force.rise && world.week > force.rise.until) force.rise = null;
    if (force.rise) {
      const gain = round4(force.rise.rate * Math.max(0.2, 1 - levelOf(force) / 2.5));
      bump(force, gain, 0.5);
      force.visibility = Math.max(force.visibility ?? 20, (force.baseVisibility ?? 20) + 20);
      takeFrom(world, force, gain * 0.9);
    } else if (isLatent(force)) {
      force.support = round4(Math.max(0.02, force.support + (force.anchor - force.support) * 0.05 + (draw(world) - 0.5) * 0.01 * (0.3 + force.support)));
      force.anchor = round4(Math.max(0.02, force.anchor + ((force.base ?? force.anchor) - force.anchor) * 0.01));
    }
  }
  // Low trust in the institutions feeds the forces at the far ends: a small shared pool, not a gift to each of them.
  if (trust < 42) {
    const extremes = outsideForces(world).filter(force => Math.abs(force.axis ?? 0) >= 3);
    const weights = extremes.map(force => (levelOf(force) + 0.05) * ((force.visibility ?? 20) + 10));
    const total = weights.reduce((sum, value) => sum + value, 0);
    if (total > 0) extremes.forEach((force, index) => { const gain = (42 - trust) * 0.0005 * weights[index] / total; bump(force, gain, 0.5); takeFrom(world, force, gain); });
  }
  // Media attention for a force outside the polls: a chance to be noticed, not an entry. It turns into a rise only
  // when a condition backs it. Rooted forces, anti-system forces when trust is low, neighbours of parties in trouble
  // get it more often; the same force not twice within five months.
  if (world.week - (world.cooldowns.spotlight ?? -99) >= SPOTLIGHT_COOLDOWN && draw(world) < 0.2) {
    const surveyed = world.parties.filter(item => item.active && !item.isPlayer && isSurveyed(item));
    const troubleOf = force => surveyed.find(party => distance(party, force) <= 1 && (party.crisis || trendOf(world, party.id, 8) < -0.5)) ?? null;
    const pool = outsideForces(world).filter(force => !force.rise && (force.presence?.cooldownUntil ?? -1) <= world.week && world.week - (force.spotlightWeek ?? -99) >= 20);
    const weights = pool.map(force => (levelOf(force) + 0.1) * ((force.baseVisibility ?? 20) + 10) * (Math.abs(force.axis ?? 0) >= 3 && trust < 45 ? 2 : 1) * (troubleOf(force) ? 1.6 : 1));
    const total = weights.reduce((sum, value) => sum + value, 0);
    if (total > 0) {
      let pick = draw(world) * total;
      const force = pool.find((item, index) => (pick -= weights[index]) < 0) ?? pool[0];
      force.spotlightWeek = world.week;
      world.cooldowns.spotlight = world.week;
      notice(force, 16 + draw(world) * 10);
      const trouble = troubleOf(force);
      const distrust = Math.abs(force.axis ?? 0) >= 3 && trust < 42;
      const euro = euroYear && month >= 2 && month <= 5;
      const chance = 0.1 + (trouble ? 0.25 : 0) + (distrust ? 0.15 : 0) + (euro ? 0.15 : 0) + (levelOf(force) >= 0.3 ? 0.1 : 0);
      const reason = trouble ? `elettori delusi da ${trouble.label} guardano altrove` : distrust ? 'cresce la sfiducia nelle istituzioni' : euro ? 'la campagna per le europee dà spazio alle liste minori' : 'più attenzione dei media';
      if (!outsideForces(world).some(item => item.rise) && world.week - (world.cooldowns.rise ?? -99) >= RISE_COOLDOWN && draw(world) < chance) startRise(world, force, date, reason);
      // Attention for a tiny force changes little and makes no news.
      else if (levelOf(force) >= 0.1) logEvent(world, date, { kind: 'visibilita', icon: 'megaphone', scope: 'nazionale', title: `Più attenzione per ${force.label}`, body: 'Nello scenario i media parlano di più di questa forza, che è fuori dai sondaggi nazionali: senza un consenso che cresce e regge per settimane, gli istituti non la rileveranno (simulazione, nessuna dichiarazione o iniziativa reale).', tone: 'neutral', partyId: force.id });
    }
  }
  // Attention is limited: when the latent forces not in a rise grow together beyond their usual weight, they compete
  // for the same voters.
  const settled = (world.latent ?? []).filter(item => !item.rise);
  const pool = settled.reduce((sum, item) => sum + item.support, 0);
  const usual = settled.reduce((sum, item) => sum + (item.base ?? item.support), 0) * 1.6;
  if (pool > usual && usual > 0) for (const force of settled) { force.support = round4(Math.max(0.02, force.support * usual / pool)); force.anchor = round4(Math.max(0.02, force.anchor * usual / pool)); }
  // European elections (every five years from 2029, proportional with a 4% threshold): the minor lists get a stage.
  if (month === 5 && euroYear && world.euroVote !== year && outsideForces(world).length) {
    world.euroVote = year;
    for (const force of outsideForces(world).filter(item => levelOf(item) >= 0.25)) notice(force, 10);
    logEvent(world, date, { kind: 'visibilita', icon: 'ballot', scope: 'nazionale', title: 'Campagna per le europee: spazio alle liste minori', body: 'Nello scenario il voto proporzionale con soglia al 4% dà visibilità anche alle forze fuori dai sondaggi nazionali (simulazione).', tone: 'neutral' });
  }
  // Spring local elections: the minor lists measure their weight on the ground, the rooted ones get noticed.
  if (month === 6 && world.localVote !== year && outsideForces(world).length) {
    world.localVote = year;
    for (const force of outsideForces(world)) if (force.regional || levelOf(force) >= 0.4) notice(force, force.regional ? 8 : 4);
    logEvent(world, date, { kind: 'visibilita', icon: 'ballot', scope: 'locale', title: 'Amministrative: le liste minori si misurano sul territorio', body: 'Nello scenario le forze fuori dai sondaggi nazionali si presentano nei comuni al voto: chi è radicato guadagna visibilità (simulazione, nessun risultato reale).', tone: 'neutral' });
  }
}
function presenceText(force, from, to, reason) {
  const name = force.isPlayer ? `il tuo partito (${force.label})` : force.label;
  const own = force.isPlayer;
  if (to === PRESENCE.EMERGING) return { title: `${force.label}: forza emergente`, body: `Nello scenario ${name} resta sopra lo 0,6% stimato da settimane (${reason}): gli istituti iniziano a tenerne conto, ma il dato resta dentro “Altri” (simulazione).`, tone: own ? 'good' : 'neutral' };
  if (to === PRESENCE.SURVEYED && from === PRESENCE.EMERGING) return { title: `${force.label} entra nei sondaggi`, body: `Stabilmente sopra l’1% da un mese: da questa settimana gli istituti rilevano ${force.label} con una propria voce. Colore, serie e storico da qui in avanti sono simulati.`, tone: own ? 'good' : 'neutral' };
  if (to === PRESENCE.CONSOLIDATED) return { title: `${force.label} si consolida nei sondaggi`, body: 'Sopra il 3% da tre mesi: è ormai una presenza stabile delle rilevazioni (simulazione).', tone: own ? 'good' : 'neutral' };
  if (to === PRESENCE.SURVEYED) return { title: `${force.label} perde terreno nei sondaggi`, body: 'Sotto il 2,2% da due mesi: resta rilevata, ma non è più una forza consolidata (simulazione).', tone: own ? 'bad' : 'neutral' };
  if (from === PRESENCE.EMERGING) return { title: `${force.label} non sfonda`, body: 'Il consenso stimato non supera la soglia della rilevazione: gli istituti smettono di tenerne conto (simulazione).', tone: own ? 'bad' : 'neutral' };
  return { title: `${force.label} esce dai sondaggi`, body: `Sotto lo 0,6% da due mesi: gli istituti non rilevano più ${force.label} e il suo consenso torna tra “Altri”. La sua storia nei sondaggi resta (simulazione).`, tone: own ? 'bad' : 'neutral' };
}
// A force of the database that enters the survey becomes a full force of the world: colour, logo, series, relations.
function promote(world, entry) {
  world.latent = world.latent.filter(item => item !== entry);
  const party = addParty(world, { id: entry.id, label: entry.label, officialName: entry.officialName, abbreviation: entry.abbreviation, brandColor: entry.brandColor, refSource: entry.refSource, origin: entry.origin, baseline: entry.support, position: entry.position, axis: entry.axis, presence: entry.presence, reference: entry.reference ?? null }, world.week);
  party.anchor = round2(Math.max(0.3, entry.anchor));
  party.visibility = entry.visibility;
  for (const other of world.parties) if (other !== party) world.ties[tieKey(party.id, other.id)] ??= initialTie(world, party, other);
  const player = playerParty(world);
  if (player && Number.isFinite(player.axis) && Number.isFinite(party.axis)) party.playerRelation = round1(clamp(12 - 8 * Math.abs(player.axis - party.axis), -30, 20));
  return party;
}
function movePresence(world, force, to, date, reason = null) {
  const presence = force.presence;
  const from = presence.status;
  Object.assign(presence, { status: to, since: world.week, above: 0, below: 0 });
  if (to === PRESENCE.SURVEYED && from === PRESENCE.EMERGING) presence.entries = (presence.entries ?? 0) + 1;
  if (to === PRESENCE.NONE) {
    presence.cooldownUntil = world.week + (from === PRESENCE.EMERGING ? PRESENCE_RULES.fade.cooldown : PRESENCE_RULES.exit.cooldown);
    if (surveyedStatus(from)) {
      presence.exits = (presence.exits ?? 0) + 1;
      // What is left becomes the new floor: no bounce back only because the old level was higher.
      if (!isLatent(force)) { force.anchor = round2(Math.min(force.anchor ?? force.baseline, force.baseline + 0.1)); force.visibility = 20; force.exitedWeek = world.week; }
    }
  }
  presence.log = [...(presence.log ?? []), { week: world.week, date, from, to }].slice(-6);
  const party = to === PRESENCE.SURVEYED && isLatent(force) ? promote(world, force) : force;
  if (to === PRESENCE.SURVEYED && from === PRESENCE.EMERGING) party.enteredWeek = world.week;
  world.presenceMoves = [...(world.presenceMoves ?? []), { week: world.week, date, id: force.id, label: force.label, from, to, player: Boolean(force.isPlayer) }].slice(-40);
  const text = presenceText(force, from, to, reason);
  logEvent(world, date, { kind: 'sondaggi', icon: 'chart', scope: 'nazionale', title: text.title, body: text.body, tone: text.tone, partyId: force.id });
}
// Every week, every force is measured against the thresholds: how long it has held them decides, and nothing moves
// during a cooldown or before the minimum permanence.
function presenceStep(world, date, stats = {}) {
  const shares = trueShares(world);
  const rules = PRESENCE_RULES;
  for (const force of [...world.parties.filter(item => item.active), ...(world.latent ?? [])]) {
    const share = shares.get(force.id) ?? 0;
    const presence = force.presence ??= initialPresence(share, world.week);
    presence.recent = [...(presence.recent ?? []), round2(share)].slice(-8);
    const trend = presence.recent.length >= 6 ? share - presence.recent.at(-6) : 0;
    // The player's party is noticed through its leader's notoriety and its own size.
    const visibility = clamp(force.isPlayer ? (stats.notoriety ?? 30) * 0.6 + share * 12 : (force.visibility ?? 20) + share * 8, 0, 100);
    const held = (condition, key) => (presence[key] = condition ? (presence[key] ?? 0) + 1 : 0);
    const weeksIn = world.week - (presence.since ?? world.week);
    if (presence.status === PRESENCE.NONE) {
      const ready = (presence.cooldownUntil ?? -1) <= world.week && share >= rules.emerge.share && (trend >= rules.emerge.trend || visibility >= rules.emerge.visibility || share >= rules.emerge.size);
      if (held(ready, 'above') >= rules.emerge.weeks) movePresence(world, force, PRESENCE.EMERGING, date, trend >= rules.emerge.trend ? 'in crescita' : share >= rules.emerge.size ? 'per il suo peso' : 'sempre più visibile');
    } else if (presence.status === PRESENCE.EMERGING) {
      const up = held(share >= rules.enter.share && visibility >= rules.enter.visibility, 'above');
      const down = held(share < rules.fade.share, 'below');
      if (up >= rules.enter.weeks && weeksIn >= rules.enter.minWeeks) movePresence(world, force, PRESENCE.SURVEYED, date);
      // Half a year under observation without breaking through: the institutes stop watching.
      else if ((down >= rules.fade.weeks && weeksIn >= rules.fade.minWeeks) || weeksIn >= rules.fade.maxWeeks) movePresence(world, force, PRESENCE.NONE, date);
    } else if (presence.status === PRESENCE.SURVEYED) {
      const up = held(share >= rules.consolidate.share, 'above');
      const down = held(share < rules.exit.share, 'below');
      if (up >= rules.consolidate.weeks) movePresence(world, force, PRESENCE.CONSOLIDATED, date);
      else if (down >= rules.exit.weeks && weeksIn >= rules.exit.minWeeks) movePresence(world, force, PRESENCE.NONE, date);
    } else if (presence.status === PRESENCE.CONSOLIDATED) {
      presence.above = 0;
      if (held(share < rules.weaken.share, 'below') >= rules.weaken.weeks) movePresence(world, force, PRESENCE.SURVEYED, date);
    }
  }
  world.others = othersOf(world);
}
// For the polls page: who is where, who is being watched, who came and went (simulation).
export function presenceOverview(world) {
  if (!world?.parties) return null;
  const shares = trueShares(world);
  const forces = [...world.parties.filter(party => party.active), ...(world.latent ?? [])];
  const of = status => forces.filter(force => (force.presence?.status ?? PRESENCE.SURVEYED) === status);
  const row = force => ({ id: force.id, label: force.label, abbreviation: force.abbreviation ?? null, share: round1(shares.get(force.id) ?? 0), since: force.presence?.since ?? null, isPlayer: Boolean(force.isPlayer), latent: isLatent(force), refSource: force.refSource ?? null });
  return {
    consolidated: of(PRESENCE.CONSOLIDATED).map(row), surveyed: of(PRESENCE.SURVEYED).map(row), emerging: of(PRESENCE.EMERGING).map(row).sort((a, b) => b.share - a.share),
    outside: of(PRESENCE.NONE).filter(force => !force.isPlayer).length,
    exited: world.parties.filter(party => party.active && !party.isPlayer && party.presence?.status === PRESENCE.NONE && party.presence.exits > 0).map(party => ({ ...row(party), week: party.exitedWeek ?? party.presence.since })),
    moves: (world.presenceMoves ?? []).slice(-8).reverse(), rules: PRESENCE_RULES
  };
}

// One simulated week of the political world. Returns reactions and offers the career can respond to.
export function advanceWorld(input, { date, week, stats = {}, deltas = {}, game = null, parliament: parliamentInput = null, majorityShift = null, society = null, playerIsLeader = false, playerStrategy = null }) {
  const world = copy(input);
  let parliament = copy(parliamentInput);
  world.week = week;
  const lines = [];
  const reactions = [];
  world.effects = world.effects.map(effect => ({ ...effect, remaining: effect.remaining - 1 })).filter(effect => effect.remaining > 0);
  // Weekly drift: small forces move less in absolute terms than large ones.
  for (const party of world.parties.filter(item => item.active)) {
    party.baseline = round2(Math.max(0.3, party.baseline + (draw(world) - 0.5) * 0.3 * sizeFactor(party.baseline, 8) + (party.anchor - party.baseline) * (party.isPlayer ? 0.01 : 0.03)));
  }
  const player = playerParty(world);
  const majority = inMajority(parliament);
  if (player) {
    const weight = 0.3 + (stats.notoriety ?? 30) / 100 + (game?.party?.affiliation === 'founder' || (game?.party?.rank ?? 0) >= 5 ? 0.5 : (game?.party?.rank ?? 0) >= 3 ? 0.2 : 0);
    const personal = clamp(((deltas.popularity ?? 0) * 0.03 + (deltas.reputation ?? 0) * 0.04 + (deltas.notoriety ?? 0) * 0.015) * weight, -0.5, 0.5);
    const government = majority ? ((parliament.government.stability ?? 50) - 50) / 400 : 0;
    const unity = game?.party && game.party.support < 25 ? -0.08 : 0;
    // Citizens judge whoever governs: a better mood rewards the majority, a worse one the opposition.
    const mood = society ? (majority === true ? society.moodDelta * 0.05 : majority === false ? -society.moodDelta * 0.025 : 0) + clamp((society.sentiment ?? 0) / 100 * 0.05, -0.05, 0.05) : 0;
    player.baseline = round2(Math.max(0.3, player.baseline + personal + government + unity + clamp(mood, -0.25, 0.25)));
    // What moved the party this week, before the poll's sampling: kept to explain the change.
    player.components = { 'Immagine del tuo politico': round2(personal), 'Stabilità del governo': round2(government), 'Divisioni nel partito': round2(unity), 'Umore dei cittadini verso chi governa': round2(clamp(mood, -0.25, 0.25)) };
    player.cohesion = Math.round(game?.party?.org?.cohesion ?? game?.party?.support ?? player.cohesion);
    player.crisis = game?.party && game.party.support < 25 ? (player.crisis ?? { since: week, source: SIM }) : null;
    if (playerStrategy) player.strategy = playerStrategy;
  }
  // Low institutional trust feeds the parties in hard opposition and the undecided.
  if (society) {
    addEffect(world, { strategy: 'opposizione', delta: round2(clamp((48 - society.trust) * 0.02, -0.2, 0.4)), remaining: 1, cause: 'fiducia' });
    world.society = { mood: society.mood, trust: society.trust, executive: society.executive ?? null, source: SIM };
  }
  const approval = world.polls.at(-1)?.government?.approval ?? world.polls.at(-1)?.executive?.approval ?? society?.executive?.approval ?? 45;
  const offers = partyAgents(world, date, { approval, player, playerIsLeader, playerStrategy: player?.strategy ?? null });
  allianceDynamics(world, date);
  partyLife(world, date);
  if (draw(world) < 0.55) {
    const pool = WORLD_EVENTS.filter(event => event.id !== world.lastEventId);
    const total = pool.reduce((sum, event) => sum + event.weight, 0);
    let pick = draw(world) * total;
    const event = pool.find(item => (pick -= item.weight) < 0) ?? pool[0];
    world.lastEventId = event.id;
    const entry = applyWorldEvent(world, event, date, parliament);
    lines.push(`Cronaca: ${entry.title}`);
    if (event.reactable) reactions.push({ eventId: event.id, title: entry.title, body: entry.body });
  }
  // A shaky majority can lose pieces on its own.
  if (majorityShift && parliament?.government?.status === 'active' && (parliament.government.stability ?? 50) < 32 && draw(world) < 0.3) {
    parliament = majorityShift(parliament, date);
    const entry = parliament.history.at(-1);
    logEvent(world, date, { kind: 'maggioranza', icon: 'dome', scope: 'nazionale', title: 'Cambio di maggioranza', body: entry?.text ?? 'La maggioranza perde un pezzo.', tone: 'bad' });
    lines.push(`Parlamento: ${entry?.text ?? 'cambio di maggioranza'}`);
  }
  // Forces outside the polls move too; then every force is measured against the thresholds of the survey.
  outsideDynamics(world, date, society?.trust ?? world.society?.trust ?? 48);
  presenceStep(world, date, stats);
  const poll = publishPoll(world, { date, stats, parliament, game });
  if (player) {
    const row = poll.results.find(item => item.partyId === player.id);
    lines.unshift(`Sondaggio ${poll.institute}: ${player.label} ${String(row.share).replace('.', ',')}% (${row.delta >= 0 ? '+' : ''}${String(row.delta).replace('.', ',')})`);
  }
  return { world, parliament, lines, reactions, offers };
}

// Career and institutional moves ripple into polls.
export function applyWorldSignals(input, signals = [], date) {
  if (!input || !signals.length) return input;
  const world = copy(input);
  const player = playerParty(world);
  const push = (delta, remaining, title, body, tone = delta >= 0 ? 'good' : 'bad', icon = 'chart', permanent = 0) => {
    if (player) {
      addEffect(world, { partyId: player.id, delta, remaining, cause: 'carriera', label: title });
      if (permanent) { player.baseline = round2(Math.max(0.3, player.baseline + permanent)); player.anchor = round2(Math.max(0.3, player.anchor + permanent * 0.6)); }
    }
    logEvent(world, date, { kind: 'carriera', icon, scope: 'nazionale', title, body, tone, lines: player ? [`${player.label} ${delta >= 0 ? '+' : ''}${delta} nei sondaggi${permanent ? `, ${permanent >= 0 ? '+' : ''}${permanent} di fondo` : ''}`] : [] });
  };
  for (const signal of signals) {
    if (signal.type === 'law-approved') push(0.6, 6, `Approvata la legge “${signal.title}”`, 'Il provvedimento diventa legge nello scenario.', 'good', 'law');
    else if (signal.type === 'law-rejected') push(-0.3, 3, `Respinta la proposta “${signal.title}”`, 'L’Aula boccia l’iniziativa: una battuta d’arresto visibile.', 'bad', 'law');
    else if (signal.type === 'government-formed') push(signal.inMajority ? 0.5 : -0.2, 4, 'Nasce un nuovo governo', signal.inMajority ? 'Il tuo gruppo fa parte della maggioranza che ha ottenuto la fiducia.' : 'Una nuova maggioranza ottiene la fiducia: il tuo gruppo resta fuori.', signal.inMajority ? 'good' : 'neutral', 'dome');
    else if (signal.type === 'government-fallen') push(signal.inMajority ? -0.8 : 0.4, 5, 'Il governo cade', signal.inMajority ? 'La maggioranza di cui fai parte perde la fiducia.' : 'La maggioranza perde la fiducia: l’opposizione guadagna terreno.', signal.inMajority ? 'bad' : 'good', 'dome');
    else if (signal.type === 'crisis') push(signal.inMajority ? -0.4 : 0.2, 3, 'Crisi di governo', 'La maggioranza deve verificare la fiducia in entrambe le Camere.', signal.inMajority ? 'bad' : 'neutral', 'alert');
    else if (signal.type === 'minister') push(0.4, 5, `Ministro: ${signal.portfolio}`, 'Il tuo ingresso al governo dà visibilità al partito.', 'good', 'star');
    else if (signal.type === 'congress') push(signal.won ? 0.4 : -0.5, 4, `Congresso: vince ${signal.winner}`, signal.won ? 'La tua area guida il partito: unità ritrovata.' : 'La nuova leadership ti è ostile: il partito appare diviso.', signal.won ? 'good' : 'bad', 'crown');
    else if (signal.type === 'stance') {
      push(signal.delta, 3, `Presa di posizione: ${signal.title}`, 'La tua reazione pubblica sposta l’attenzione sul partito.', signal.delta >= 0 ? 'good' : 'bad', 'megaphone');
      if (signal.attack) for (const party of world.parties.filter(item => !item.isPlayer)) party.playerRelation = round1(clamp(party.playerRelation - (party.strategy === 'opposizione' ? 1 : 3), -100, 100));
    } else if (signal.type === 'relation') {
      const party = world.parties.find(item => item.id === signal.partyId);
      if (party) party.playerRelation = round1(clamp(party.playerRelation + signal.delta, -100, 100));
    } else if (signal.type === 'territorial' && player) {
      // Measures and citizens' mood move the party region by region: that is where local elections are decided.
      for (const [region, delta] of Object.entries(signal.regions ?? {})) addEffect(world, { partyId: player.id, scope: 'region', region, delta: round2(delta), remaining: 12, cause: 'territori' });
    } else if (signal.type === 'memory' && player) {
      // What voters remember of the player's past weighs on the party, week after week, for years.
      addEffect(world, { partyId: player.id, delta: signal.delta, remaining: 1, cause: 'memoria', label: 'Ciò che gli elettori ricordano' });
    } else if (signal.type === 'seek-alliance' && player) {
      // The closest free force (collocazione first, then relations) is sounded out.
      const candidates = world.parties.filter(item => item.active && !item.isPlayer && isSurveyed(item) && !allianceOf(world, item.id) && distance(item, player) <= 2 && !world.grudges?.[tieKey(item.id, player.id)]).sort((a, b) => distance(a, player) - distance(b, player) || b.playerRelation - a.playerRelation);
      const target = candidates[0];
      if (target) { target.playerRelation = round1(clamp(target.playerRelation + 10, -100, 100)); logEvent(world, date, { kind: 'alleanza', icon: 'link', scope: 'nazionale', title: `Contatti tra ${player.label} e ${target.label}`, body: `Si parla di una lista comune: stessa area (${target.position ?? 'collocazione n.d.'}), interesse a superare la soglia (simulazione).`, tone: 'neutral' }); }
    } else if (signal.type === 'lean' && player) {
      for (const party of world.parties.filter(item => !item.isPlayer && Number.isFinite(item.axis))) party.playerRelation = round1(clamp(party.playerRelation + (Math.sign(party.axis) === signal.direction ? 8 : Math.sign(party.axis) === -signal.direction ? -6 : 0), -100, 100));
      if (player.refSource !== 'real') { player.axis = clamp((player.axis ?? 0) + signal.direction * 0.5, -3, 3); player.position = positionOf(player.axis); }
    } else if (signal.type === 'chronicle') logEvent(world, date, { kind: signal.kind ?? 'cronaca', icon: signal.icon ?? 'pin', scope: signal.scope ?? 'nazionale', title: signal.title, body: signal.body ?? '', tone: signal.tone ?? 'neutral', chain: signal.chain ?? null });
    else if (signal.type === 'election') {
      const gap = signal.pollShare === null ? 0 : clamp((signal.share - signal.pollShare) * 0.15, -2, 2);
      push(signal.mandate ? 1 : -0.4, 4, `${signal.label}: ${String(Math.round(signal.share * 10) / 10).replace('.', ',')}%`, signal.mandate ? 'Il risultato elettorale dà slancio al partito.' : 'Il voto ridimensiona le ambizioni del partito.', signal.mandate ? 'good' : 'bad', 'ballot', round2(gap));
      // Elections give the forces outside the polls a stage: national votes the larger ones, local votes the rooted ones.
      const national = ['politiche', 'europee'].includes(signal.electionType);
      for (const force of outsideForces(world)) if (national ? (isLatent(force) ? force.support : force.baseline) >= 0.3 : force.regional) notice(force, national ? 8 : 6);
    }
  }
  return world;
}

// ---------- the national cycle (legislature-engine) ----------
// A general election resets the level of every force to the vote: the next simulated poll starts from the result.
export function alignWorldToVote(input, shares = [], date, { title = 'Risultati delle elezioni', body = '' } = {}) {
  if (!input || !shares.length) return input;
  const world = copy(input);
  const byId = new Map(shares.map(row => [row.partyId, row.share]));
  for (const party of world.parties.filter(item => item.active && byId.has(item.id))) {
    const share = Math.max(0.3, byId.get(party.id));
    party.baseline = round2(share);
    party.anchor = round2(share);
  }
  world.effects = world.effects.filter(effect => effect.cause === 'territori');
  world.pollErrors = {};
  logEvent(world, date, { kind: 'elezioni', icon: 'ballot', scope: 'nazionale', title, body, tone: 'neutral' });
  return world;
}
// The forces of the parliamentary majority support the Government; the others go back to their own line.
export function setGoverningForces(input, partyIds = [], date, { label = 'un nuovo governo', log = true } = {}) {
  if (!input) return input;
  const world = copy(input);
  const majority = new Set(partyIds);
  for (const party of world.parties.filter(item => item.active)) {
    const was = party.governing;
    party.governing = majority.has(party.id);
    if (party.isPlayer) continue;
    if (party.governing && party.strategy !== 'governista') { party.strategy = 'governista'; party.strategySince = world.week; }
    else if (!party.governing && was && party.strategy === 'governista') { party.strategy = Math.abs(party.axis ?? 0) >= 2 || party.baseline >= 10 ? 'opposizione' : 'coalizione'; party.strategySince = world.week; }
  }
  if (log) logEvent(world, date, { kind: 'governo', icon: 'dome', scope: 'nazionale', title: `Nasce ${label}`, body: `Lo sostengono ${world.parties.filter(item => majority.has(item.id)).map(item => item.label).join(', ') || 'forze diverse'} (simulazione).`, tone: 'neutral' });
  return world;
}
// Effects of a national campaign on several forces at once (coalitions, useful vote, the player's party line).
export function addWorldEffects(input, effects = [], date, entry = null) {
  if (!input || (!effects.length && !entry)) return input;
  const world = copy(input);
  for (const effect of effects) if (world.parties.some(party => party.id === effect.partyId && party.active)) addEffect(world, { remaining: 2, cause: 'campagna-nazionale', ...effect });
  if (entry) logEvent(world, date, { kind: 'elezioni', icon: 'megaphone', scope: 'nazionale', tone: 'neutral', ...entry });
  return world;
}

// ---------- alliances with the player ----------
export function allianceOf(world, partyId) {
  return world?.alliances.find(item => item.status === 'active' && item.partyIds.includes(partyId)) ?? null;
}
function sealAlliance(world, player, force, date, motive = null) {
  const partnerAllied = allianceOf(world, force.id);
  if (partnerAllied) partnerAllied.partyIds = partnerAllied.partyIds.filter(id => id !== force.id);
  if (partnerAllied && partnerAllied.partyIds.length < 2) { partnerAllied.status = 'broken'; partnerAllied.brokenAt = date; }
  world.alliances.push({ id: `alleanza-giocatore-${world.week}-${hash(force.id) % 9973}`, label: `Intesa ${player.label} – ${force.label}`, partyIds: [player.id, force.id], cohesion: 66, since: date, status: 'active', withPlayer: true, motive: motive ?? agreementMotive(player, force), source: SIM });
  force.playerRelation = round1(clamp(force.playerRelation + 15, -100, 100));
  addEffect(world, { partyId: player.id, delta: 0.3, remaining: 4, cause: 'alleanza' });
}
// The chance that a force accepts an intesa, and why: collocazione, programme, previous relations and wounds,
// interests (thresholds, weight in the polls), majorities and the situation. Shown to the player before proposing.
export function allianceOdds(world, forceId, { partySupport = 50, influence = 50, memory = { good: 0, bad: 0 }, difficulty = 0, programOverlap = null } = {}) {
  const player = playerParty(world);
  const force = world.parties.find(item => item.id === forceId && item.active && !item.isPlayer);
  if (!player || !force) return null;
  const shares = latestPoll(world)?.results ?? [];
  const shareOf = party => shares.find(row => row.partyId === party.id)?.share ?? party.baseline;
  const reasons = [];
  const add = (label, delta) => { if (Math.abs(delta) >= 0.005) reasons.push({ label, delta: round2(delta) }); };
  const gap = distance(player, force);
  add(`Collocazione (${player.position ?? 'non definita'} / ${force.position ?? 'non documentata'})`, [0.12, 0.05, -0.08, -0.22, -0.4, -0.5, -0.55][Math.round(gap)] ?? -0.55);
  add('Rapporti tra i due partiti', force.playerRelation / 200);
  add(`Strategia di ${force.label}`, force.strategy === 'coalizione' ? 0.2 : force.strategy === player.strategy ? 0.1 : -0.05);
  if (programOverlap !== null) add('Programmi a confronto', (programOverlap - 0.5) * 0.2);
  if ((force.strategy === 'governista' && player.strategy === 'opposizione') || (force.strategy === 'opposizione' && player.strategy === 'governista')) add('Uno sostiene il governo, l’altro è all’opposizione', -0.12);
  const own = shareOf(player), theirs = shareOf(force);
  if (own < 4 && theirs < 4) add('Interesse comune a superare la soglia di sbarramento', 0.08);
  else if (theirs > own * 5 && own < 3) add(`${force.label} pesa molto di più nei sondaggi`, -0.08);
  add('Memoria di alleanze e rotture passate', clamp((memory?.good ?? 0) * 0.05 - (memory?.bad ?? 0) * 0.1, -0.35, 0.15));
  const grudge = world.grudges?.[tieKey(player.id, force.id)];
  if (grudge) add('Rancore per una rottura recente', -grudge / 200);
  add('Sostegno interno al tuo partito', (partySupport - 50) / 200);
  add('La tua influenza', (influence - 50) / 250);
  if (allianceOf(world, force.id)) add(`${force.label} è già in un’altra intesa`, -0.25);
  if (force.crisis) add(`${force.label} è in crisi e cerca sponde`, 0.1);
  if (difficulty) add('Difficoltà della partita', difficulty);
  const chance = clamp(0.22 + reasons.reduce((sum, item) => sum + item.delta, 0), 0.03, 0.9);
  // Very distant forces only agree as a motivated exception: two small forces, or a force in crisis.
  const exception = gap >= 4 && !(own < 3 && theirs < 3) && !force.crisis;
  return { chance: exception ? 0.03 : round2(chance), reasons: reasons.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)), exception };
}
export function proposeAlliance(input, forceId, { partySupport = 50, influence = 50, date, memory, difficulty = 0, programOverlap = null }) {
  const world = copy(input);
  const player = playerParty(world);
  const force = world.parties.find(item => item.id === forceId && item.active && !item.isPlayer);
  if (!player) throw new Error('Serve un partito per stringere un’alleanza.');
  if (!force) throw new Error('Forza politica non disponibile.');
  if (allianceOf(world, player.id)) throw new Error('Il tuo partito fa già parte di un’alleanza: rompila prima di cercarne un’altra.');
  const odds = allianceOdds(world, forceId, { partySupport, influence, memory, difficulty, programOverlap });
  const success = draw(world) < odds.chance;
  const motive = agreementMotive(player, force) ?? 'scelta politica del segretario';
  if (success) sealAlliance(world, player, force, date, motive);
  else force.playerRelation = round1(clamp(force.playerRelation - 5, -100, 100));
  const obstacles = odds.reasons.filter(item => item.delta < 0).slice(0, 2).map(item => item.label.toLowerCase());
  logEvent(world, date, { kind: success ? 'alleanza' : 'rottura', icon: success ? 'link' : 'unlink', scope: 'nazionale', title: success ? `Intesa tra ${player.label} e ${force.label}` : `${force.label} respinge l’intesa`, body: success ? `Motivo: ${motive}. Nello scenario l’accordo porta voti e visibilità alle prossime elezioni (simulazione).` : `Nello scenario i dirigenti dicono no${obstacles.length ? `: pesano ${obstacles.join(' e ')}` : ''} (simulazione).`, tone: success ? 'good' : 'bad' });
  return { world, success, chance: odds.chance, reasons: odds.reasons };
}
// An offer from another party, accepted by the player.
export function acceptAlliance(input, forceId, date) {
  const world = copy(input);
  const player = playerParty(world);
  const force = world.parties.find(item => item.id === forceId && item.active && !item.isPlayer);
  if (!player || !force || allianceOf(world, player.id)) return world;
  sealAlliance(world, player, force, date);
  logEvent(world, date, { kind: 'alleanza', icon: 'link', scope: 'nazionale', title: `Intesa tra ${player.label} e ${force.label}`, body: 'Accetti la proposta: nello scenario le due forze si presentano insieme (simulazione).', tone: 'good' });
  return world;
}
export function breakAlliance(input, allianceId, date) {
  const world = copy(input);
  const alliance = world.alliances.find(item => item.id === allianceId && item.status === 'active');
  if (!alliance) throw new Error('Alleanza non disponibile.');
  alliance.status = 'broken';
  alliance.brokenAt = date;
  const player = playerParty(world);
  world.grudges ??= {};
  for (const id of alliance.partyIds) if (id !== player?.id) world.grudges[tieKey(player?.id ?? '', id)] = 50;
  if (player) addEffect(world, { partyId: player.id, delta: -0.3, remaining: 3, cause: 'rottura' });
  for (const id of alliance.partyIds) { const party = world.parties.find(item => item.id === id && !item.isPlayer); if (party) party.playerRelation = round1(clamp(party.playerRelation - 20, -100, 100)); }
  stirOutside(world, alliance.partyIds, 3);
  logEvent(world, date, { kind: 'rottura', icon: 'unlink', scope: 'nazionale', title: `Rottura: ${alliance.label}`, body: 'Esci dall’accordo: più autonomia, meno voti in comune.', tone: 'bad' });
  return world;
}

// Polls and allies shape the opening of a campaign.
export function campaignPollBonus(world, electionType, stats = {}, relations = []) {
  if (!world) return { bonus: 0, share: null, allies: 0 };
  const player = playerParty(world);
  const boosts = personalBoosts(stats, relations);
  if (!player) {
    const approval = latestPoll(world)?.personal?.approval ?? 50;
    return { bonus: round2(clamp((approval - 50) * 0.05, -2, 2)), share: null, allies: 0 };
  }
  const shares = electionType === 'comunale' ? localShares(world, boosts.regional, boosts.local) : electionType === 'regionale' ? regionalShares(world, world.place.region, boosts.regional) : nationalShares(world);
  const share = shares.find(row => row.partyId === player.id)?.share ?? 0;
  const alliance = allianceOf(world, player.id);
  const allies = alliance ? alliance.partyIds.filter(id => id !== player.id).reduce((sum, id) => sum + (shares.find(row => row.partyId === id)?.share ?? 0), 0) : 0;
  return { bonus: round2(clamp((share - 6) * 0.2 + allies * 0.08, -2, 4)), share: round1(share), allies: round1(allies) };
}
export { STRATEGIES };
