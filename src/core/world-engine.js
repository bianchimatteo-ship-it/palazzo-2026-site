import { ITALIAN_REGIONS } from '../data/regions.js?v=20260924-5';
import { CHART_SLOTS, COMPATIBLE_FAMILIES, DEMO_FAMILIES, FAMILY_BY_ORIENTATION, INITIAL_ALLIANCES, SIMULATED_FIGURE_ROLES, POLL_INSTITUTES, SCENARIO_FORCES, SPLINTER_NAMES, WORLD_EVENTS } from '../data/simulation/polling-rules.js?v=20260924-5';

const SIM = 'simulation';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const AUTONOMIST_REGIONS = ['Trentino-Alto Adige', 'Valle d’Aosta', 'Veneto', 'Lombardia', 'Friuli-Venezia Giulia', 'Sardegna'];
const HISTORY = 52;

function draw(world) {
  world.rngState = (Math.imul(world.rngState, 1664525) + 1013904223) >>> 0;
  return world.rngState / 4294967296;
}
const between = (world, [min, max]) => min + draw(world) * (max - min);
const gaussian = world => draw(world) + draw(world) + draw(world) - 1.5;
const fill = (text, place) => String(text).replace('{region}', place.region || 'regione').replace('{municipality}', place.municipality || 'il tuo comune');

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
function newLeader(world, partyId, role = 'Segreteria', date = null) {
  const party = world.parties.find(item => item.id === partyId);
  const kind = partyId ? SIMULATED_FIGURE_ROLES.leader : SIMULATED_FIGURE_ROLES.civic;
  const count = world.figures.filter(figure => figure.partyId === partyId).length + 1;
  const name = `${kind} ${party ? party.abbreviation : world.place.region ?? ''} n.${count}`.replace(/\s+/g, ' ');
  const figure = { id: `figura-${world.figures.length + 1}-${hash(name + partyId) % 9973}`, name, role, partyId, since: date, status: 'active', simulated: true, source: SIM };
  world.figures.push(figure);
  return figure;
}
function regionalOffsets(world, family, boostRegion = null) {
  return Object.fromEntries(ITALIAN_REGIONS.map(region => [region, round2((draw(world) - 0.5) * 6 + (family === 'autonomista' ? (AUTONOMIST_REGIONS.includes(region) ? 4 : -1) : 0) + (region === boostRegion ? 2.5 : 0))]));
}
function addParty(world, spec, date) {
  const party = {
    id: spec.id, label: spec.label, abbreviation: spec.abbreviation ?? spec.label.slice(0, 3).toUpperCase(), family: spec.family ?? 'centro',
    color: nextSlot(world, spec.brandColor), brandColor: spec.brandColor ?? null, refSource: spec.refSource ?? SIM, origin: spec.origin ?? 'scenario',
    isPlayer: Boolean(spec.isPlayer), baseline: round2(spec.baseline), anchor: round2(spec.baseline), regional: regionalOffsets(world, spec.family, spec.isPlayer ? world.place.region : null),
    cohesion: spec.cohesion ?? 62, crisis: null, leaderId: null, leaderRole: spec.leaderRole ?? null, active: true, createdWeek: world.week, source: SIM
  };
  world.parties.push(party);
  if (spec.leader !== false) party.leaderId = newLeader(world, party.id, 'Segreteria', date).id;
  return party;
}

export function createWorld({ seedText, date, week = 1, place = {}, playerParty = null, demoParties = [], stats = {} }) {
  const seed = hash(`${seedText}|mondo`);
  const world = {
    version: 1, source: SIM, seed, rngState: seed, createdAt: date, week, place, playerPartyId: playerParty?.id ?? null,
    parties: [], others: 4, undecided: 27, effects: [], alliances: [], figures: [], events: [], polls: [], lastEventId: null
  };
  for (const force of SCENARIO_FORCES) addParty(world, { id: force.id, label: force.name, abbreviation: force.abbreviation, family: force.family, baseline: between(world, force.base), origin: 'scenario' }, date);
  for (const demo of demoParties) {
    if (demo.id === playerParty?.id) continue;
    addParty(world, { id: demo.id, label: demo.label, abbreviation: demo.abbreviation, family: DEMO_FAMILIES[demo.id] ?? 'centro', baseline: between(world, [3, 7]), origin: 'demo' }, date);
  }
  if (playerParty) attachPlayerParty(world, playerParty, date);
  for (const alliance of INITIAL_ALLIANCES) world.alliances.push({ ...alliance, cohesion: Math.round(between(world, [58, 72])), since: date, status: 'active', source: SIM });
  publishPoll(world, { date, stats, parliament: null, game: null });
  return world;
}

// The player's party always appears in the scenario; a real party is only referenced by id.
export function setPlayerParty(input, party, date) {
  return attachPlayerParty(copy(input), party, date);
}
function attachPlayerParty(world, party, date) {
  for (const item of world.parties) item.isPlayer = false;
  world.playerPartyId = party?.id ?? null;
  if (!party) return world;
  let entry = world.parties.find(item => item.id === party.id);
  if (!entry) {
    const baseline = party.initialShare ?? (party.founder ? between(world, [1.5, 3]) : party.refSource === 'real' ? between(world, [2, 6]) : between(world, [4, 8]));
    entry = addParty(world, {
      id: party.id, label: party.label || 'Il tuo partito', abbreviation: party.abbreviation, family: party.family ?? FAMILY_BY_ORIENTATION[party.orientation] ?? DEMO_FAMILIES[party.id] ?? 'centro',
      brandColor: party.brandColor, refSource: party.refSource, origin: 'player', isPlayer: true, baseline,
      // Real parties keep their actual leadership out of the game: the role stays generic.
      leader: party.refSource !== 'real' && !party.founder, leaderRole: party.founder ? 'Guidato da te' : party.refSource === 'real' ? 'Leadership (ruolo di gioco)' : null
    }, date);
  }
  entry.isPlayer = true;
  entry.active = true;
  return world;
}

export function normalizeWorld(world) {
  if (!world || typeof world !== 'object' || !Array.isArray(world.parties)) return null;
  return { effects: [], alliances: [], figures: [], events: [], polls: [], others: 4, undecided: 27, place: {}, ...world };
}

// ---------- shares ----------
function effectSum(world, party, scope, region = null) {
  return world.effects.filter(effect => effect.scope === scope && (effect.partyId === party.id || (effect.family && effect.family === party.family)) && (!region || effect.region === region)).reduce((sum, effect) => sum + effect.delta, 0);
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
  const sample = Math.round(between(world, institute.sample) / 10) * 10;
  const margin = round1(1.96 * Math.sqrt(0.25 / sample) * 100);
  const previous = world.polls.at(-1);
  const boosts = personalBoosts(stats, game?.relations ?? []);
  const results = sampleShares(world, nationalShares(world), sample).map(row => ({ ...row, share: round1(row.share), delta: previous ? round1(row.share - (previous.results.find(item => item.partyId === row.partyId)?.share ?? row.share)) : 0 }));
  const player = world.playerPartyId;
  const regional = player ? Object.fromEntries(ITALIAN_REGIONS.map(region => [region, round1(regionalShares(world, region, boosts.regional).find(row => row.partyId === player)?.share ?? 0)])) : {};
  const local = player ? round1(localShares(world, boosts.regional, boosts.local).find(row => row.partyId === player)?.share ?? 0) : null;
  const government = parliament?.government && ['active', 'crisis'].includes(parliament.government.status) ? round1(clamp(22 + (parliament.government.stability ?? 50) * 0.45 + gaussian(world) * 2, 5, 75)) : null;
  world.undecided = round1(clamp(world.undecided + gaussian(world) + (parliament?.government?.status === 'crisis' ? 0.8 : 0) - (world.undecided - 27) * 0.1, 15, 42));
  const poll = {
    id: `sondaggio-${world.week}-${world.polls.length}-${sample}`, week: world.week, date, institute: institute.name, sample, margin, undecided: world.undecided, results, regional, local,
    regionalHome: player ? regional[world.place.region] ?? null : null,
    personal: { approval: round1(clamp((stats.popularity ?? 45) * 0.55 + (stats.reputation ?? 50) * 0.45 + gaussian(world) * 2.4, 0, 100)), popularity: stats.popularity ?? null, notoriety: stats.notoriety ?? null },
    government: government === null ? null : { approval: government }, source: SIM
  };
  // The full regional map is kept for the latest poll only; the home region stays in every entry.
  world.polls = [...world.polls.map(item => item.regional ? { ...item, regional: null } : item), poll].slice(-HISTORY);
  return poll;
}
export const latestPoll = world => world?.polls?.at(-1) ?? null;
export function playerPollShare(world, scope = 'national') {
  const poll = latestPoll(world);
  if (!poll || !world.playerPartyId) return null;
  if (scope === 'local') return poll.local;
  if (scope === 'regional') return poll.regionalHome ?? null;
  return poll.results.find(row => row.partyId === world.playerPartyId)?.share ?? null;
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
  for (const [family, delta] of Object.entries(event.families ?? {})) addEffect(world, { family, delta, remaining: event.duration, cause: event.id });
  for (const [family, delta] of Object.entries(event.permanent ?? {})) for (const party of world.parties.filter(item => item.family === family)) party.baseline = round2(party.baseline + delta);
  const majority = inMajority(parliament);
  if (player && majority !== null && (event.majority || event.opposition)) {
    const delta = majority ? event.majority ?? 0 : event.opposition ?? 0;
    addEffect(world, { partyId: player.id, delta, remaining: event.duration, cause: event.id });
    if (delta) lines.push(`${player.label} ${delta > 0 ? '+' : ''}${delta} (${majority ? 'in maggioranza' : 'all’opposizione'})`);
  }
  if (player && event.regionalPlayer) addEffect(world, { partyId: player.id, scope: 'region', region: world.place.region, delta: event.regionalPlayer, remaining: event.duration, cause: event.id });
  if (player && event.localPlayer) addEffect(world, { partyId: player.id, scope: 'local', delta: event.localPlayer, remaining: event.duration, cause: event.id });
  if (event.stability && parliament?.government && ['active', 'crisis'].includes(parliament.government.status)) {
    parliament.government.stability = clamp(Math.round((parliament.government.stability ?? 50) + event.stability), 0, 100);
    lines.push(`Stabilità del governo ${event.stability > 0 ? '+' : ''}${event.stability}`);
  }
  return logEvent(world, date, { kind: 'evento', eventId: event.id, icon: event.icon, scope: event.scope, title: fill(event.title, world.place), body: fill(event.body, world.place), lines, tone: (event.stability ?? 0) < 0 || (event.majority ?? 0) < 0 ? 'bad' : 'neutral', reactable: Boolean(event.reactable) });
}
function partyDynamics(world, date) {
  for (const party of world.parties.filter(item => item.active && !item.isPlayer)) {
    party.cohesion = clamp(Math.round(party.cohesion + (draw(world) - 0.52) * 6 + (62 - party.cohesion) * 0.04), 0, 100);
    if (!party.crisis && draw(world) < 0.035) party.cohesion = Math.max(0, party.cohesion - 25);
    if (!party.crisis && party.cohesion < 30) {
      party.crisis = { since: world.week, source: SIM };
      addEffect(world, { partyId: party.id, delta: -0.8, remaining: 4, cause: 'crisi-interna' });
      logEvent(world, date, { kind: 'crisi', icon: 'alert', scope: 'nazionale', title: `Crisi interna in ${party.label}`, body: 'Correnti in rotta e dirigenti in disaccordo: il partito perde compattezza.', tone: 'bad', partyId: party.id });
    } else if (party.crisis && world.week - party.crisis.since >= 3) {
      if (party.baseline > 9 && draw(world) < 0.3) {
        const name = SPLINTER_NAMES.find(item => !world.parties.some(entry => entry.label === item)) ?? `Scissione ${world.parties.length}`;
        const share = round2(party.baseline * 0.18);
        party.baseline = round2(party.baseline - share);
        party.anchor = round2(party.anchor - share);
        const splinter = addParty(world, { id: `forza-scissione-${world.week}-${hash(name) % 9973}`, label: name, family: party.family, baseline: share, origin: 'scissione', cohesion: 58 }, date);
        party.crisis = null;
        party.cohesion = 55;
        logEvent(world, date, { kind: 'scissione', icon: 'split', scope: 'nazionale', title: `Scissione: nasce ${splinter.label}`, body: `Una parte di ${party.label} lascia il partito e fonda una nuova formazione (${world.figures.find(item => item.id === splinter.leaderId)?.name}, figura simulata).`, tone: 'bad', partyId: splinter.id });
      } else if (draw(world) < 0.6) {
        const previous = world.figures.find(item => item.id === party.leaderId);
        if (previous) { previous.status = 'dimesso'; previous.until = date; }
        const leader = newLeader(world, party.id, 'Segreteria', date);
        party.leaderId = leader.id;
        party.crisis = null;
        party.cohesion = 62;
        addEffect(world, { partyId: party.id, delta: 0.6, remaining: 3, cause: 'nuova-leadership' });
        logEvent(world, date, { kind: 'leadership', icon: 'crown', scope: 'nazionale', title: `${party.label}: cambio alla guida`, body: `${previous?.name ?? 'La segreteria uscente'} lascia dopo la crisi interna; subentra ${leader.name}. Figure simulate.`, tone: 'neutral', partyId: party.id });
      }
    } else if (party.crisis && party.cohesion >= 45) {
      party.crisis = null;
    }
  }
}
function allianceDynamics(world, date) {
  for (const alliance of world.alliances.filter(item => item.status === 'active')) {
    alliance.cohesion = clamp(Math.round(alliance.cohesion + (draw(world) - 0.53) * 7 + (62 - alliance.cohesion) * 0.05), 0, 100);
    if (alliance.cohesion >= 25 && draw(world) < 0.03) {
      alliance.cohesion = Math.max(0, alliance.cohesion - 28);
      logEvent(world, date, { kind: 'tensione', icon: 'alert', scope: 'nazionale', title: `Tensioni nell’${alliance.label.toLowerCase()}`, body: 'Candidature contese e dichiarazioni al veleno mettono alla prova l’accordo.', tone: 'bad' });
    }
    if (alliance.cohesion < 25) {
      alliance.status = 'broken';
      alliance.brokenAt = date;
      for (const id of alliance.partyIds) addEffect(world, { partyId: id, delta: -0.3, remaining: 3, cause: 'rottura' });
      logEvent(world, date, { kind: 'rottura', icon: 'unlink', scope: 'nazionale', title: `Si rompe l’${alliance.label.toLowerCase()}`, body: 'Veti incrociati e accuse reciproche: gli alleati vanno ognuno per la propria strada.', tone: 'bad' });
    }
  }
  if (draw(world) < 0.06) {
    const allied = new Set(world.alliances.filter(item => item.status === 'active').flatMap(item => item.partyIds));
    const free = world.parties.filter(item => item.active && !item.isPlayer && !allied.has(item.id));
    for (const first of free) {
      const second = free.find(item => item !== first && COMPATIBLE_FAMILIES[first.family]?.includes(item.family));
      if (!second) continue;
      world.alliances.push({ id: `alleanza-${world.week}-${first.abbreviation}-${second.abbreviation}`, label: `Intesa ${first.abbreviation}–${second.abbreviation}`, partyIds: [first.id, second.id], cohesion: 64, since: date, status: 'active', source: SIM });
      logEvent(world, date, { kind: 'alleanza', icon: 'link', scope: 'nazionale', title: `Nuova intesa tra ${first.label} e ${second.label}`, body: 'Le due forze annunciano un percorso comune in vista delle prossime elezioni.', tone: 'neutral' });
      break;
    }
  }
  if (draw(world) < 0.04) {
    const figure = newLeader(world, null, 'Nuovo volto civico', date);
    logEvent(world, date, { kind: 'figura', icon: 'user', scope: 'locale', title: 'Emerge un nuovo volto civico', body: `${figure.name}: un amministratore civico di ${world.place.region || 'una regione'} guadagna visibilità e potrebbe candidarsi. Figura simulata, non una persona reale.`, tone: 'neutral' });
  }
}

// One simulated week of the political world. Returns reactions the career can respond to.
export function advanceWorld(input, { date, week, stats = {}, deltas = {}, game = null, parliament: parliamentInput = null, majorityShift = null }) {
  const world = copy(input);
  let parliament = copy(parliamentInput);
  world.week = week;
  const lines = [];
  const reactions = [];
  world.effects = world.effects.map(effect => ({ ...effect, remaining: effect.remaining - 1 })).filter(effect => effect.remaining > 0);
  for (const party of world.parties.filter(item => item.active)) {
    party.baseline = round2(Math.max(0.3, party.baseline + (draw(world) - 0.5) * 0.35 + (party.anchor - party.baseline) * (party.isPlayer ? 0.01 : 0.04)));
  }
  const player = playerParty(world);
  if (player) {
    const weight = 0.3 + (stats.notoriety ?? 30) / 100 + (game?.party?.affiliation === 'founder' ? 0.5 : (game?.party?.rank ?? 0) >= 3 ? 0.2 : 0);
    const personal = clamp(((deltas.popularity ?? 0) * 0.03 + (deltas.reputation ?? 0) * 0.04 + (deltas.notoriety ?? 0) * 0.015) * weight, -0.5, 0.5);
    const majority = inMajority(parliament);
    const government = majority ? ((parliament.government.stability ?? 50) - 50) / 400 : 0;
    const unity = game?.party && game.party.support < 25 ? -0.08 : 0;
    player.baseline = round2(Math.max(0.3, player.baseline + personal + government + unity));
    player.cohesion = Math.round(game?.party?.support ?? player.cohesion);
    player.crisis = game?.party && game.party.support < 25 ? (player.crisis ?? { since: week, source: SIM }) : null;
  }
  partyDynamics(world, date);
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
  return { world, parliament, lines, reactions };
}

// Career and institutional moves ripple into polls.
export function applyWorldSignals(input, signals = [], date) {
  if (!input || !signals.length) return input;
  const world = copy(input);
  const player = playerParty(world);
  const push = (delta, remaining, title, body, tone = delta >= 0 ? 'good' : 'bad', icon = 'chart', permanent = 0) => {
    if (player) {
      addEffect(world, { partyId: player.id, delta, remaining, cause: 'carriera' });
      if (permanent) { player.baseline = round2(Math.max(0.3, player.baseline + permanent)); player.anchor = round2(Math.max(0.3, player.anchor + permanent * 0.6)); }
    }
    logEvent(world, date, { kind: 'carriera', icon, scope: 'nazionale', title, body, tone, lines: player ? [`${player.label} ${delta >= 0 ? '+' : ''}${delta} nei sondaggi${permanent ? `, ${permanent >= 0 ? '+' : ''}${permanent} di fondo` : ''}`] : [] });
  };
  for (const signal of signals) {
    if (signal.type === 'law-approved') push(0.6, 6, `Approvata la legge “${signal.title}”`, 'Il provvedimento del tuo gruppo diventa legge nello scenario.', 'good', 'law');
    else if (signal.type === 'law-rejected') push(-0.3, 3, `Respinta la proposta “${signal.title}”`, 'L’Aula boccia l’iniziativa: una battuta d’arresto visibile.', 'bad', 'law');
    else if (signal.type === 'government-formed') push(signal.inMajority ? 0.5 : -0.2, 4, 'Nasce un nuovo governo', signal.inMajority ? 'Il tuo gruppo fa parte della maggioranza che ha ottenuto la fiducia.' : 'Una nuova maggioranza ottiene la fiducia: il tuo gruppo resta fuori.', signal.inMajority ? 'good' : 'neutral', 'dome');
    else if (signal.type === 'government-fallen') push(signal.inMajority ? -0.8 : 0.4, 5, 'Il governo cade', signal.inMajority ? 'La maggioranza di cui fai parte perde la fiducia.' : 'La maggioranza perde la fiducia: l’opposizione guadagna terreno.', signal.inMajority ? 'bad' : 'good', 'dome');
    else if (signal.type === 'crisis') push(signal.inMajority ? -0.4 : 0.2, 3, 'Crisi di governo', 'La maggioranza deve verificare la fiducia in entrambe le Camere.', signal.inMajority ? 'bad' : 'neutral', 'alert');
    else if (signal.type === 'minister') push(0.4, 5, `Ministro: ${signal.portfolio}`, 'Il tuo ingresso al governo dà visibilità al partito.', 'good', 'star');
    else if (signal.type === 'congress') push(signal.won ? 0.4 : -0.5, 4, `Congresso: vince ${signal.winner}`, signal.won ? 'La tua area guida il partito: unità ritrovata.' : 'La nuova leadership ti è ostile: il partito appare diviso.', signal.won ? 'good' : 'bad', 'crown');
    else if (signal.type === 'stance') push(signal.delta, 3, `Presa di posizione: ${signal.title}`, 'La tua reazione pubblica sposta l’attenzione sul partito.', signal.delta >= 0 ? 'good' : 'bad', 'megaphone');
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
export function proposeAlliance(input, forceId, { partySupport = 50, influence = 50, date }) {
  const world = copy(input);
  const player = playerParty(world);
  const force = world.parties.find(item => item.id === forceId && item.active && !item.isPlayer);
  if (!player) throw new Error('Serve un partito per stringere un’alleanza.');
  if (!force) throw new Error('Forza politica non disponibile.');
  if (allianceOf(world, player.id)) throw new Error('Il tuo partito fa già parte di un’alleanza: rompila prima di cercarne un’altra.');
  const compatible = COMPATIBLE_FAMILIES[player.family]?.includes(force.family);
  const partnerAllied = allianceOf(world, force.id);
  const chance = clamp(0.25 + (compatible ? 0.3 : -0.15) + (partySupport - 50) / 200 + (influence - 50) / 250 - (partnerAllied ? 0.25 : 0) + (force.crisis ? 0.1 : 0), 0.05, 0.9);
  const success = draw(world) < chance;
  if (success) {
    if (partnerAllied) partnerAllied.partyIds = partnerAllied.partyIds.filter(id => id !== force.id);
    if (partnerAllied && partnerAllied.partyIds.length < 2) { partnerAllied.status = 'broken'; partnerAllied.brokenAt = date; }
    world.alliances.push({ id: `alleanza-giocatore-${world.week}-${force.abbreviation}`, label: `Alleanza ${player.abbreviation}–${force.abbreviation}`, partyIds: [player.id, force.id], cohesion: 66, since: date, status: 'active', withPlayer: true, source: SIM });
    addEffect(world, { partyId: player.id, delta: 0.3, remaining: 4, cause: 'alleanza' });
  }
  logEvent(world, date, { kind: success ? 'alleanza' : 'rottura', icon: success ? 'link' : 'unlink', scope: 'nazionale', title: success ? `Alleanza tra ${player.label} e ${force.label}` : `${force.label} respinge l’alleanza`, body: success ? 'L’accordo porta voti e visibilità alle prossime elezioni.' : compatible ? 'Il momento non è quello giusto: i dirigenti prendono tempo.' : 'Le distanze politiche sono troppo ampie.', tone: success ? 'good' : 'bad' });
  return { world, success, chance: round2(chance) };
}
export function breakAlliance(input, allianceId, date) {
  const world = copy(input);
  const alliance = world.alliances.find(item => item.id === allianceId && item.status === 'active');
  if (!alliance) throw new Error('Alleanza non disponibile.');
  alliance.status = 'broken';
  alliance.brokenAt = date;
  const player = playerParty(world);
  if (player) addEffect(world, { partyId: player.id, delta: -0.3, remaining: 3, cause: 'rottura' });
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
