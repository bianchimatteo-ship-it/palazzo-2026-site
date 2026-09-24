import { ITALIAN_REGIONS } from '../data/regions.js?v=20260924-17';
import { CHART_SLOTS, CIVIC_FIGURE_LABEL, POLL_INSTITUTES, STRATEGIES, WORLD_EVENTS } from '../data/simulation/polling-rules.js?v=20260924-17';

// The political world: real parties whose poll figures, strategies, alliances and reactions are simulated.
// A party enters with its real identity only (id, name, abbreviation); its starting weight is the real
// share of 2x1000 choices (MEF), after which everything evolves inside the game.
const SIM = 'simulation';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const HISTORY = 52;
// Worlds saved before real parties only (invented forces, demo parties, splinters) are rebuilt.
const LEGACY_ORIGINS = ['scenario', 'demo', 'scissione'];

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
  const party = {
    id: spec.id, label: spec.label, abbreviation: spec.abbreviation ?? null,
    color: nextSlot(world, spec.brandColor), brandColor: spec.brandColor ?? null, refSource: spec.refSource ?? 'real', origin: spec.origin ?? 'real',
    reference: spec.reference ?? null, isPlayer: Boolean(spec.isPlayer), baseline: round2(spec.baseline), anchor: round2(spec.baseline),
    regional: Object.fromEntries(ITALIAN_REGIONS.map(region => [region, round2((draw(world) - 0.5) * 5 + (spec.isPlayer && region === world.place.region ? 2 : 0))])),
    strategy: spec.strategy ?? 'autonoma', strategySince: week, playerRelation: 0, cohesion: 62, crisis: null, active: true, createdWeek: week, source: SIM
  };
  world.parties.push(party);
  return party;
}

// forces: [{ id, label, abbreviation, share, reference }] — real parties chosen by the caller.
export function createWorld({ seedText, date, week = 1, place = {}, playerParty = null, forces = [], stats = {} }) {
  const seed = hash(`${seedText}|mondo`);
  const world = {
    version: 2, source: SIM, seed, rngState: seed, createdAt: date, week, place, playerPartyId: playerParty?.id ?? null,
    parties: [], others: 8, undecided: 27, effects: [], alliances: [], figures: [], events: [], polls: [], ties: {}, cooldowns: {}, lastEventId: null
  };
  const included = forces.reduce((sum, force) => sum + force.share, 0);
  world.others = round2(Math.max(4, 100 - included));
  for (const force of forces) addParty(world, { id: force.id, label: force.label, abbreviation: force.abbreviation, baseline: force.share, reference: force.reference, refSource: 'real' }, week);
  if (playerParty) attachPlayerParty(world, playerParty, week);
  for (let i = 0; i < world.parties.length; i++) for (let j = i + 1; j < world.parties.length; j++) world.ties[tieKey(world.parties[i].id, world.parties[j].id)] = Math.round((draw(world) - 0.5) * 20);
  publishPoll(world, { date, stats, parliament: null, game: null });
  return world;
}

// The player's party always appears; a real party keeps only its real identity.
export function setPlayerParty(input, party) {
  return attachPlayerParty(copy(input), party, input?.week ?? 1);
}
function attachPlayerParty(world, party, week) {
  for (const item of world.parties) item.isPlayer = false;
  world.playerPartyId = party?.id ?? null;
  if (!party) return world;
  let entry = world.parties.find(item => item.id === party.id);
  if (!entry) {
    const baseline = party.initialShare ?? (party.founder ? 1.5 + draw(world) * 1.5 : 1 + draw(world) * 1.5);
    entry = addParty(world, { id: party.id, label: party.label || 'Il tuo partito', abbreviation: party.abbreviation, brandColor: party.brandColor, refSource: party.refSource, origin: 'player', isPlayer: true, baseline, reference: party.reference ?? null }, week);
    for (const other of world.parties) if (other !== entry) world.ties[tieKey(entry.id, other.id)] ??= 0;
  }
  entry.isPlayer = true;
  entry.active = true;
  return world;
}

export function isLegacyWorld(world) {
  return Boolean(world?.parties?.some(party => LEGACY_ORIGINS.includes(party.origin)));
}
export function normalizeWorld(world) {
  if (!world || typeof world !== 'object' || !Array.isArray(world.parties)) return null;
  return { effects: [], alliances: [], figures: [], events: [], polls: [], others: 4, undecided: 27, place: {}, ties: {}, cooldowns: {}, ...world, parties: world.parties.map(party => ({ strategy: 'autonoma', strategySince: world.week ?? 1, playerRelation: 0, ...party })) };
}

// ---------- shares ----------
function effectSum(world, party, scope, region = null) {
  return world.effects.filter(effect => effect.scope === scope && (effect.partyId === party.id || (effect.strategy && effect.strategy === party.strategy && !party.isPlayer)) && (!region || effect.region === region)).reduce((sum, effect) => sum + effect.delta, 0);
}
function normalize(rows, others) {
  const total = rows.reduce((sum, row) => sum + row.raw, 0) + others;
  return rows.map(row => ({ partyId: row.partyId, share: round2(row.raw / total * 100) }));
}
export function nationalShares(world) {
  const active = world.parties.filter(party => party.active);
  return normalize(active.map(party => ({ partyId: party.id, raw: Math.max(0.3, party.baseline + effectSum(world, party, 'national')) })), world.others);
}
export function regionalShares(world, region, boost = 0) {
  const national = nationalShares(world);
  return normalize(national.map(row => {
    const party = world.parties.find(item => item.id === row.partyId);
    return { partyId: row.partyId, raw: Math.max(0.3, row.share + (party.regional?.[region] ?? 0) + effectSum(world, party, 'region', region) + (party.isPlayer && region === world.place.region ? boost : 0)) };
  }), world.others);
}
export function localShares(world, regionalBoost = 0, localBoost = 0) {
  const regional = regionalShares(world, world.place.region, regionalBoost);
  return normalize(regional.map(row => {
    const party = world.parties.find(item => item.id === row.partyId);
    return { partyId: row.partyId, raw: Math.max(0.3, row.share + effectSum(world, party, 'local') + (party.isPlayer ? localBoost : 0)) };
  }), world.others);
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
function sampleShares(world, shares, sample) {
  const noisy = shares.map(row => {
    const p = row.share / 100;
    const sigma = Math.sqrt(Math.max(0.0004, p * (1 - p)) / sample) * 100;
    return { partyId: row.partyId, raw: Math.max(0.2, row.share + gaussian(world) * 2 * sigma) };
  });
  return normalize(noisy, 100 - shares.reduce((sum, row) => sum + row.share, 0));
}
function publishPoll(world, { date, stats = {}, parliament = null, game = null }) {
  const institute = POLL_INSTITUTES[Math.floor(draw(world) * POLL_INSTITUTES.length)];
  const sample = Math.round((institute.sample[0] + draw(world) * (institute.sample[1] - institute.sample[0])) / 10) * 10;
  const margin = round1(1.96 * Math.sqrt(0.25 / sample) * 100);
  const previous = world.polls.at(-1);
  const boosts = personalBoosts(stats, game?.relations ?? []);
  const results = sampleShares(world, nationalShares(world), sample).map(row => ({ ...row, share: round1(row.share), delta: previous ? round1(row.share - (previous.results.find(item => item.partyId === row.partyId)?.share ?? row.share)) : 0 }));
  const player = world.playerPartyId;
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
    mood: world.society ? { satisfaction: world.society.mood, trust: world.society.trust } : null, source: SIM
  };
  // The full regional map is kept for the latest poll only; the home region stays in every entry.
  world.polls = [...world.polls.map(item => item.regional ? { ...item, regional: null } : item), poll].slice(-HISTORY);
  return poll;
}
// Why the player's party moved: its own drivers, the effects in force (by cause), and the rest (rivals and sampling).
const EFFECT_LABELS = { 'crisi-interna': 'Crisi interna del partito', alleanza: 'Effetto dell’alleanza', rottura: 'Rottura di un’alleanza', carriera: 'Iniziative e risultati del politico', fiducia: 'Sfiducia nelle istituzioni' };
function explainShare(world, row) {
  const player = playerParty(world);
  if (!player || !row) return [];
  const active = world.parties.filter(party => party.active);
  const total = active.reduce((sum, party) => sum + Math.max(0.3, party.baseline + effectSum(world, party, 'national')), 0) + world.others;
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
  world.effects.push({ id: `effetto-${world.week}-${world.effects.length}-${world.rngState % 997}`, scope: 'national', remaining: 4, source: SIM, ...effect });
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
  if (event.small) for (const party of world.parties.filter(item => !item.isPlayer && item.baseline < 5)) addEffect(world, { partyId: party.id, delta: event.small, remaining: event.duration, cause: event.id });
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
  const moved = world.parties.filter(item => !item.isPlayer && ((event.executive && item.strategy === 'governista') || (event.challengers && item.strategy === 'opposizione'))).map(item => item.label);
  if (moved.length) lines.push(`Effetti su chi ${event.executive && event.challengers ? 'sostiene o contrasta' : event.executive ? 'sostiene' : 'contrasta'} l’esecutivo: ${moved.slice(0, 3).join(', ')}`);
  return logEvent(world, date, { kind: 'evento', eventId: event.id, icon: event.icon, scope: event.scope, title: fill(event.title, world.place), body: fill(event.body, world.place), lines, tone: (event.stability ?? 0) < 0 || (event.majority ?? 0) < 0 ? 'bad' : 'neutral', reactable: Boolean(event.reactable) });
}

// Every party pursues its own strategy and changes it when it stops paying off.
function partyAgents(world, date, { approval, player, playerIsLeader, playerStrategy }) {
  const offers = [];
  for (const party of world.parties.filter(item => item.active && !item.isPlayer)) {
    party.cohesion = clamp(Math.round(party.cohesion + (draw(world) - 0.52) * 6 + (62 - party.cohesion) * 0.04), 0, 100);
    if (!party.crisis && party.cohesion < 30) {
      party.crisis = { since: world.week, source: SIM };
      addEffect(world, { partyId: party.id, delta: -0.8, remaining: 4, cause: 'crisi-interna' });
      logEvent(world, date, { kind: 'crisi', icon: 'alert', scope: 'nazionale', title: `Tensioni interne in ${party.label}`, body: 'Nello scenario il partito perde compattezza: dichiarazioni in ordine sparso e organi divisi (simulazione).', tone: 'bad', partyId: party.id });
    } else if (party.crisis && world.week - party.crisis.since >= 3 && party.cohesion >= 45) {
      party.crisis = null;
      logEvent(world, date, { kind: 'crisi', icon: 'link', scope: 'nazionale', title: `${party.label} ricompone le divisioni`, body: 'Nello scenario la crisi interna rientra (simulazione).', tone: 'neutral', partyId: party.id });
    }
    // What the strategy yields this week.
    const effect = party.strategy === 'governista' ? (approval - 50) / 500 : party.strategy === 'opposizione' ? (50 - approval) / 500 + 0.01 : party.strategy === 'coalizione' ? (world.alliances.some(item => item.status === 'active' && item.partyIds.includes(party.id)) ? 0.02 : -0.01) : 0;
    party.baseline = round2(Math.max(0.3, party.baseline + effect));
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
      party.playerRelation = round1(clamp(party.playerRelation * 0.97 + (clash ? -1.5 : party.strategy === playerStrategy ? 0.5 : 0), -100, 100));
      const cooldown = key => world.week - (world.cooldowns[`${key}|${party.id}`] ?? -99);
      const allied = world.alliances.some(item => item.status === 'active' && item.partyIds.includes(player.id));
      if (playerIsLeader && party.strategy === 'coalizione' && party.playerRelation >= 15 && !allied && cooldown('alleanza') >= 10 && draw(world) < 0.35) {
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
// Parties with close strategies draw together; tensions break the intese.
function allianceDynamics(world, date) {
  const allied = new Set(world.alliances.filter(item => item.status === 'active').flatMap(item => item.partyIds));
  for (const [key, value] of Object.entries(world.ties)) {
    const [a, b] = key.split('|').map(id => world.parties.find(item => item.id === id));
    if (!a || !b) continue;
    world.ties[key] = round1(clamp(value * 0.99 + (a.strategy === b.strategy ? 0.8 : -0.4), -100, 100));
  }
  for (const alliance of world.alliances.filter(item => item.status === 'active')) {
    const tie = world.ties[tieKey(...alliance.partyIds)] ?? 0;
    alliance.cohesion = clamp(Math.round(alliance.cohesion + (draw(world) - 0.53) * 7 + (62 - alliance.cohesion) * 0.05 + tie / 50), 0, 100);
    if (alliance.cohesion < 25) {
      alliance.status = 'broken';
      alliance.brokenAt = date;
      for (const id of alliance.partyIds) addEffect(world, { partyId: id, delta: -0.3, remaining: 3, cause: 'rottura' });
      logEvent(world, date, { kind: 'rottura', icon: 'unlink', scope: 'nazionale', title: `Si rompe l’${alliance.label.toLowerCase()}`, body: 'Veti incrociati e accuse reciproche: gli alleati vanno ognuno per la propria strada (simulazione).', tone: 'bad' });
    }
  }
  if (draw(world) < 0.07) {
    const free = world.parties.filter(item => item.active && !item.isPlayer && !allied.has(item.id));
    const pairs = free.flatMap((first, index) => free.slice(index + 1).map(second => [first, second, world.ties[tieKey(first.id, second.id)] ?? 0])).filter(([first, second, tie]) => tie >= 15 && (first.strategy === 'coalizione' || second.strategy === 'coalizione' || first.strategy === second.strategy)).sort((x, y) => y[2] - x[2]);
    if (pairs.length) {
      const [first, second] = pairs[0];
      world.alliances.push({ id: `alleanza-${world.week}-${hash(first.id + second.id) % 9973}`, label: `Intesa simulata ${first.label} – ${second.label}`, partyIds: [first.id, second.id], cohesion: 64, since: date, status: 'active', source: SIM });
      logEvent(world, date, { kind: 'alleanza', icon: 'link', scope: 'nazionale', title: `Intesa tra ${first.label} e ${second.label}`, body: 'Nello scenario le due forze annunciano un percorso comune (simulazione, non un accordo reale).', tone: 'neutral' });
    }
  }
  if (draw(world) < 0.03) {
    const count = world.figures.length + 1;
    const figure = { id: `figura-${count}-${world.rngState % 9973}`, name: `${CIVIC_FIGURE_LABEL} n.${count}`, role: 'Volto civico', partyId: null, since: date, status: 'active', simulated: true, source: SIM };
    world.figures.push(figure);
    logEvent(world, date, { kind: 'figura', icon: 'user', scope: 'locale', title: 'Emerge un nuovo volto civico', body: `${figure.name}: un amministratore civico di ${world.place.region || 'una regione'} guadagna visibilità (figura simulata, non una persona reale).`, tone: 'neutral' });
  }
}

// One simulated week of the political world. Returns reactions and offers the career can respond to.
export function advanceWorld(input, { date, week, stats = {}, deltas = {}, game = null, parliament: parliamentInput = null, majorityShift = null, society = null, playerIsLeader = false, playerStrategy = null }) {
  const world = copy(input);
  let parliament = copy(parliamentInput);
  world.week = week;
  const lines = [];
  const reactions = [];
  world.effects = world.effects.map(effect => ({ ...effect, remaining: effect.remaining - 1 })).filter(effect => effect.remaining > 0);
  for (const party of world.parties.filter(item => item.active)) {
    party.baseline = round2(Math.max(0.3, party.baseline + (draw(world) - 0.5) * 0.3 + (party.anchor - party.baseline) * (party.isPlayer ? 0.01 : 0.03)));
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
    } else if (signal.type === 'chronicle') logEvent(world, date, { kind: signal.kind ?? 'cronaca', icon: signal.icon ?? 'pin', scope: signal.scope ?? 'nazionale', title: signal.title, body: signal.body ?? '', tone: signal.tone ?? 'neutral', chain: signal.chain ?? null });
    else if (signal.type === 'election') {
      const gap = signal.pollShare === null ? 0 : clamp((signal.share - signal.pollShare) * 0.15, -2, 2);
      push(signal.mandate ? 1 : -0.4, 4, `${signal.label}: ${String(Math.round(signal.share * 10) / 10).replace('.', ',')}%`, signal.mandate ? 'Il risultato elettorale dà slancio al partito.' : 'Il voto ridimensiona le ambizioni del partito.', signal.mandate ? 'good' : 'bad', 'ballot', round2(gap));
    }
  }
  return world;
}

// ---------- alliances with the player ----------
export function allianceOf(world, partyId) {
  return world?.alliances.find(item => item.status === 'active' && item.partyIds.includes(partyId)) ?? null;
}
function sealAlliance(world, player, force, date) {
  const partnerAllied = allianceOf(world, force.id);
  if (partnerAllied) partnerAllied.partyIds = partnerAllied.partyIds.filter(id => id !== force.id);
  if (partnerAllied && partnerAllied.partyIds.length < 2) { partnerAllied.status = 'broken'; partnerAllied.brokenAt = date; }
  world.alliances.push({ id: `alleanza-giocatore-${world.week}-${hash(force.id) % 9973}`, label: `Intesa ${player.label} – ${force.label}`, partyIds: [player.id, force.id], cohesion: 66, since: date, status: 'active', withPlayer: true, source: SIM });
  force.playerRelation = round1(clamp(force.playerRelation + 15, -100, 100));
  addEffect(world, { partyId: player.id, delta: 0.3, remaining: 4, cause: 'alleanza' });
}
export function proposeAlliance(input, forceId, { partySupport = 50, influence = 50, date }) {
  const world = copy(input);
  const player = playerParty(world);
  const force = world.parties.find(item => item.id === forceId && item.active && !item.isPlayer);
  if (!player) throw new Error('Serve un partito per stringere un’alleanza.');
  if (!force) throw new Error('Forza politica non disponibile.');
  if (allianceOf(world, player.id)) throw new Error('Il tuo partito fa già parte di un’alleanza: rompila prima di cercarne un’altra.');
  const partnerAllied = allianceOf(world, force.id);
  const chance = clamp(0.25 + force.playerRelation / 200 + (force.strategy === 'coalizione' ? 0.25 : force.strategy === player.strategy ? 0.1 : -0.05) + (partySupport - 50) / 200 + (influence - 50) / 250 - (partnerAllied ? 0.25 : 0) + (force.crisis ? 0.1 : 0), 0.05, 0.9);
  const success = draw(world) < chance;
  if (success) sealAlliance(world, player, force, date);
  else force.playerRelation = round1(clamp(force.playerRelation - 5, -100, 100));
  logEvent(world, date, { kind: success ? 'alleanza' : 'rottura', icon: success ? 'link' : 'unlink', scope: 'nazionale', title: success ? `Intesa tra ${player.label} e ${force.label}` : `${force.label} respinge l’intesa`, body: success ? 'Nello scenario l’accordo porta voti e visibilità alle prossime elezioni (simulazione).' : 'Nello scenario i dirigenti prendono tempo: rapporti e strategie non coincidono (simulazione).', tone: success ? 'good' : 'bad' });
  return { world, success, chance: round2(chance) };
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
  if (player) addEffect(world, { partyId: player.id, delta: -0.3, remaining: 3, cause: 'rottura' });
  for (const id of alliance.partyIds) { const party = world.parties.find(item => item.id === id && !item.isPlayer); if (party) party.playerRelation = round1(clamp(party.playerRelation - 20, -100, 100)); }
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
