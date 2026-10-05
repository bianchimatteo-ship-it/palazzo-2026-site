// The internal life of the party, week by week: the people behind the currents (goals, loyalty, memory, initiatives),
// their requests and the agreements that follow (conditions, duration, breach, renewal), the local leaders of the
// committees, the congress that grows out of the balances accumulated, the vitals of the organisation and the
// rebuilding of a party in opposition. Everything lives in game.party.life and is simulated: no real person or
// real organisation is described. The career engine owns the calendar and hands in the helpers it already has
// (memory, relations, diary) through `api`, so nothing here imports the career engine.
import { uniqueId } from './ids.js?v=20261005-1';
import {
  ACTOR_PERSONAS, CADRE_ACTIONS, CADRE_INTERESTS, CONGRESS_DELEGATES, CONGRESS_PHASES, EMERGING_AREAS, PACT_KINDS, PERSONAS_BY_CURRENT, PERSONA_FALLBACK,
  REBUILD_FOCUS, REBUILD_WEEKS, REQUEST_KINDS, SPLIT_RULES
} from '../data/simulation/party-life-rules.js?v=20261005-1';
import { CURRENT_AREAS, CURRENT_LINES, PARTY_LINES } from '../data/simulation/career-rules.js?v=20261005-1';
import { LEADER_RULES } from '../data/simulation/committee-rules.js?v=20261005-1';
import { leaderKeyOf, leaderStance, territorialControl } from './committee-engine.js?v=20261005-1';

const SIM = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const cap = text => String(text).charAt(0).toUpperCase() + String(text).slice(1);
const rel = current => current?.value ?? current?.relation ?? 50;
const OPEN = ['aperta', 'trattativa'];
const MAX_OPEN = 2;
const HISTORY_LIMIT = 40;
const CLOSED_LIMIT = 16;

// ---------- reading the party ----------
const currentsOf = party => party?.currents ?? [];
const totalStrength = party => currentsOf(party).reduce((sum, item) => sum + (item.strength ?? 0), 0) || 1;
export const strengthShare = (party, id) => (currentsOf(party).find(item => item.id === id)?.strength ?? 0) / totalStrength(party);
const isSecretary = party => party?.affiliation === 'founder' || (party?.affiliation === 'member' && (party.rank ?? 0) >= 5);
export const partyLineOf = party => party?.line ?? CURRENT_LINES[party?.leaderCurrentId] ?? 'autonoma';
const committeesOf = org => (org?.committees ?? []).filter(item => item.status !== 'dissoluzione');
const note = (life, week, kind, text) => { life.history = [{ week, kind, text, source: SIM }, ...(life.history ?? [])].slice(0, HISTORY_LIMIT); };
const closeRequest = (life, request, outcome, week) => {
  request.stage = 'chiusa'; request.outcome = outcome; request.closedWeek = week;
  life.closed = [{ id: request.id, kind: request.kind, title: request.title, refId: request.refId, from: request.from, outcome, week }, ...(life.closed ?? [])].slice(0, CLOSED_LIMIT);
  life.requests = life.requests.filter(item => item.id !== request.id);
};

// ---------- creation and migration ----------
function makeActor(current, index, seed, week) {
  const pool = PERSONAS_BY_CURRENT[current.id] ?? PERSONA_FALLBACK;
  const persona = pool[(seed + index * 7) % pool.length];
  const spec = ACTOR_PERSONAS[persona];
  return {
    id: current.id, persona, leaderLabel: `${cap(spec.label)} · ${current.label} (figura simulata)`, priority: spec.priority,
    line: current.line ?? CURRENT_LINES[current.id] ?? 'autonoma', areas: current.areas ?? CURRENT_AREAS[current.id] ?? [],
    ambition: spec.ambition, patience: spec.patience, temper: spec.temper, loyalty: 55, grievance: 20, momentum: 0,
    nextActWeek: week + 4 + (hash(`${seed}|${current.id}`) % 6), lastActWeek: null, lastGrantWeek: null, granted: 0, refused: 0, stance: 'neutrale', source: SIM
  };
}
export function createLife(party, { seed = 1, week = 1 } = {}) {
  const life = { version: 1, source: SIM, actors: {}, cadres: [], requests: [], closed: [], pacts: [], organs: { total: 9, seats: {} }, congress: null, lastCongress: null, rebuild: null, vitals: null, splitWatch: {}, history: [], cooldowns: {}, counters: { requests: 0, pacts: 0 } };
  syncActors(party, life, seed, week);
  allocateSeats(party, life);
  return life;
}
function syncActors(party, life, seed, week) {
  const ids = currentsOf(party).map(item => item.id);
  currentsOf(party).forEach((current, index) => { if (!life.actors[current.id]) life.actors[current.id] = makeActor(current, index, seed, week); });
  for (const id of Object.keys(life.actors)) if (!ids.includes(id)) delete life.actors[id];
}
// A party from an old save, or one just founded, gets its life without losing anything it already had.
export function normalizeLife(party, { seed = 1, week = 1 } = {}) {
  if (!party) return null;
  if (!party.life || typeof party.life !== 'object' || !party.life.actors) { party.life = createLife(party, { seed, week }); return party.life; }
  const life = party.life;
  for (const key of ['cadres', 'requests', 'closed', 'pacts', 'history']) if (!Array.isArray(life[key])) life[key] = [];
  life.organs ??= { total: 9, seats: {} };
  life.splitWatch ??= {}; life.cooldowns ??= {}; life.counters ??= { requests: 0, pacts: 0 };
  syncActors(party, life, seed, week);
  return life;
}

// The seats of the national bodies: they follow the strength of each area, the area the secretary rewarded and the agreements.
export function allocateSeats(party, life) {
  const currents = currentsOf(party);
  const total = life.organs?.total ?? 9;
  const weights = Object.fromEntries(currents.map(item => [item.id, (item.strength ?? 0) + (party.organsCurrentId === item.id ? 14 : 0) + life.pacts.filter(pact => pact.status === 'attivo' && pact.kind === 'incarico' && pact.actorId === item.id).length * 10]));
  const sum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const exact = currents.map(item => ({ id: item.id, value: weights[item.id] / sum * total }));
  const seats = Object.fromEntries(exact.map(item => [item.id, Math.floor(item.value)]));
  let left = total - Object.values(seats).reduce((a, b) => a + b, 0);
  for (const item of [...exact].sort((a, b) => (b.value % 1) - (a.value % 1))) { if (left-- <= 0) break; seats[item.id] += 1; }
  life.organs = { total, seats };
}

// ---------- the vitals of the organisation ----------
export function computeVitals(party, life) {
  const org = party?.org;
  if (!org) return null;
  const history = (org.membersHistory ?? []).slice(-12);
  const growth = history.length >= 2 && history[0].members ? (history.at(-1).members - history[0].members) / history[0].members * 100 : 0;
  const actors = Object.values(life.actors);
  const grievance = actors.length ? actors.reduce((sum, item) => sum + item.grievance, 0) / actors.length : 30;
  const tension = (org.conflicts ?? []).reduce((sum, item) => sum + item.intensity, 0);
  const stability = Math.round(clamp((org.cohesion ?? 55) * 0.45 + (org.discipline ?? 70) * 0.15 + (100 - grievance) * 0.25 - tension * 0.15 + (org.treasury?.balance < 0 ? -10 : 8) + 8));
  const volatility = Math.round(clamp(grievance * 0.45 + tension * 0.35 + Math.abs(growth) * 3 + Object.keys(life.splitWatch).length * 12));
  const momentum = round1(clamp(growth * 1.5 + ((org.cohesion ?? 55) - 55) / 12 - tension / 40, -10, 10));
  const committees = committeesOf(org);
  const strength = committees.length ? committees.reduce((sum, item) => sum + (item.organization ?? 0), 0) / committees.length : (org.sections ?? []).reduce((sum, item) => sum + item.vitality, 0) / Math.max(1, (org.sections ?? []).length);
  const militantShare = org.members ? org.militants / org.members : 0;
  const mobilization = Math.round(clamp(militantShare * 180 + strength * 0.45 + (org.cadres ?? 0) * 0.15 - (org.treasury?.balance < 0 ? 8 : 0)));
  const trend = momentum >= 2 ? 'crescita' : momentum <= -2 ? 'declino' : volatility >= 60 ? 'volatile' : 'stabile';
  return { stability, volatility, momentum, mobilization, trend, growth: round1(growth), source: SIM };
}

// ---------- local leaders (cadres) ----------
const INTERESTS = Object.keys(CADRE_INTERESTS);
function syncCadres(game, life, week) {
  const org = game.party?.org;
  // The local leaders that matter most come first: the player's own territory (comune, province, region), then the
  // strongest committees, so that the nodes of the network have a person of their own before the rest.
  const home = game.place?.region ?? null;
  const rank = item => (item.region === home ? 100 : 0) + (item.level === 'comune' ? 30 : item.level === 'provincia' ? 20 : 10) + (item.organization ?? 0) / 10 + (item.members ?? 0) / 500;
  const committees = committeesOf(org).filter(item => ['regione', 'provincia', 'comune'].includes(item.level)).sort((a, b) => rank(b) - rank(a) || String(a.id).localeCompare(String(b.id)));
  for (const committee of committees) {
    if (life.cadres.some(item => item.committeeId === committee.id)) continue;
    if (life.cadres.filter(item => item.status !== 'uscito').length >= 16) break;
    const seed = hash(`${committee.id}|${game.seed ?? 1}`);
    life.cadres.push({
      id: `quadro-${committee.id}`, committeeId: committee.id, region: committee.region, level: committee.level, name: committee.name,
      label: committee.leader?.player ? 'Tu' : committee.leader?.label ?? 'Dirigente locale (figura simulata)', currentId: committee.leader?.currentId ?? null, player: Boolean(committee.leader?.player),
      interest: INTERESTS[seed % INTERESTS.length], ambition: 35 + (seed >>> 3) % 55, loyalty: committee.loyalty ?? 55, grievance: committee.leader?.player ? 5 : 20 + (seed >>> 5) % 20,
      status: 'attivo', sinceWeek: week, lastActWeek: null, nextActWeek: week + 6 + (seed >>> 7) % 8, source: SIM
    });
  }
  // A cadre follows its committee: a dissolved committee has no leader any more.
  for (const cadre of life.cadres) {
    const committee = (org?.committees ?? []).find(item => item.id === cadre.committeeId);
    if (!committee || committee.status === 'dissoluzione') { if (cadre.status !== 'uscito') cadre.status = 'uscito'; continue; }
    // A committee that changes hands (a new leader chosen, a commissioner, the player taking it) has a new man: his interests, his
    // ambition, his mood and the promises made to the old one are not carried over. A save from before keeps the one on record.
    const key = leaderKeyOf(committee);
    if (cadre.leaderKey === undefined) cadre.leaderKey = key;
    else if (cadre.leaderKey !== key && cadre.status !== 'uscito') renewCadre(cadre, committee, game, week, key);
    cadre.player = Boolean(committee.leader?.player);
    cadre.currentId = committee.leader?.currentId ?? null;
    cadre.label = cadre.player ? 'Tu' : committee.leader?.label ?? cadre.label;
  }
  life.cadres = life.cadres.filter(item => item.status !== 'uscito' || week - (item.leftWeek ?? week) < 26);
}
function renewCadre(cadre, committee, game, week, key) {
  const seed = hash(`${committee.id}|${key}|${week}|${game.seed ?? 1}`);
  Object.assign(cadre, {
    interest: INTERESTS[seed % INTERESTS.length], ambition: 35 + (seed >>> 3) % 55, loyalty: Math.round(clamp(committee.loyalty ?? 55)), grievance: committee.leader?.player ? 5 : 12 + (seed >>> 5) % 12,
    status: 'attivo', sinceWeek: week, lastActWeek: null, nextActWeek: week + 8 + (seed >>> 7) % 8, promise: null, leaderKey: key
  });
}
// A promise of a candidacy to a local leader breaks when its time runs out or the vote has gone by without the lists being drawn up by the
// player: the leader remembers it, his area too.
function breakPromise(game, life, api, cadre, committee, week, lines) {
  const rules = LEADER_RULES.promise;
  cadre.loyalty = Math.round(clamp(cadre.loyalty + rules.brokenLoyalty)); cadre.grievance = Math.round(clamp(cadre.grievance + rules.brokenGrievance));
  committee.loyalty = Math.round(clamp(committee.loyalty + rules.brokenLoyalty / 3));
  cadre.promise = null; cadre.broken = (cadre.broken ?? 0) + 1;
  if (cadre.currentId) { api.changeRelation(game, cadre.currentId, rules.brokenRelation); const actor = life.actors[cadre.currentId]; if (actor) actor.grievance = Math.round(clamp(actor.grievance + 4)); }
  api.remember(game, { date: api.date, kind: 'promessa-tradita', text: `Candidatura promessa al responsabile di ${committee.name} e mai arrivata`, weight: 0.9, subject: cadre.currentId ?? null });
  note(life, week, 'quadro', `${committee.name}: la candidatura promessa non è arrivata`);
  lines.push(`${committee.name}: la candidatura promessa non è arrivata, il responsabile se la lega al dito`);
}
// The lists are drawn up by the player (the secretary): the promises of a candidacy to the local leaders are kept, with what that is worth
// in loyalty, in the relations with their area, in the committee that has one of its own on the list, and in the memory of the party.
export function honourCadrePromises(game, api, { week, date, electionId = null }) {
  const life = game.party?.life;
  const lines = [];
  if (!life) return lines;
  const rules = LEADER_RULES.promise;
  for (const cadre of life.cadres.filter(item => item.promise && item.status !== 'uscito' && !item.player)) {
    if (cadre.promise.electionId && electionId && cadre.promise.electionId !== electionId) continue;
    if (week > cadre.promise.until) continue;
    const committee = game.party.org.committees.find(item => item.id === cadre.committeeId);
    if (!committee) continue;
    cadre.loyalty = Math.round(clamp(cadre.loyalty + rules.keptLoyalty)); cadre.grievance = Math.round(clamp(cadre.grievance + rules.keptGrievance));
    committee.loyalty = Math.round(clamp(committee.loyalty + rules.keptLoyalty / 2)); committee.activity = round1(clamp((committee.activity ?? 40) + 6)); committee.consensus = Math.round(clamp(committee.consensus + 2));
    if (cadre.currentId) api.changeRelation(game, cadre.currentId, rules.keptRelation);
    cadre.promise = null; cadre.kept = (cadre.kept ?? 0) + 1;
    api.remember(game, { date, kind: 'promessa-mantenuta', text: `Candidatura promessa al responsabile di ${committee.name}: nelle liste`, weight: 0.7, subject: cadre.currentId ?? null });
    note(life, week, 'quadro', `${committee.name}: il responsabile è nelle liste, come promesso`);
    lines.push(`Liste: il responsabile di ${committee.name} è candidato, come promesso`);
  }
  return lines;
}
function tickCadres(game, life, api, week, rand, lines) {
  const org = game.party.org;
  const raises = [];
  const heard = {};
  for (const cadre of life.cadres.filter(item => item.status !== 'uscito')) {
    const committee = org.committees.find(item => item.id === cadre.committeeId);
    if (!committee) continue;
    const actor = cadre.currentId ? life.actors[cadre.currentId] : null;
    const crisis = ['crisi', 'perdita-controllo'].includes(committee.status);
    const visited = committee.lastVisitWeek !== null && week - committee.lastVisitWeek <= 8;
    const funded = Boolean(committee.fundedUntil && committee.fundedUntil >= week);
    const hostile = actor ? actor.grievance > 60 : false;
    const target = cadre.player ? 5 : 22 + (crisis ? 22 : 0) + (hostile ? 14 : 0) - (visited ? 10 : 0) - (funded ? 12 : 0) - (committee.loyalty - 50) * 0.3 + (cadre.ambition - 50) * 0.15;
    cadre.grievance = Math.round(clamp(cadre.grievance + (target - cadre.grievance) * 0.1 + (rand() - 0.5) * 3));
    cadre.loyalty = Math.round(clamp(cadre.loyalty + ((committee.loyalty ?? 50) - cadre.loyalty) * 0.2));
    cadre.status = cadre.player ? 'attivo' : cadre.grievance >= 70 ? 'in-uscita' : cadre.grievance >= 50 ? 'critico' : 'attivo';
    // The discontent of the territory reaches the area the leader follows: his leader hears it every week (a critical leader one point, one
    // on his way out two, at most three a week for an area).
    if (actor && !cadre.player && cadre.status !== 'attivo') heard[actor.id] = (heard[actor.id] ?? 0) + (cadre.status === 'in-uscita' ? 2 : 1);
    // A candidacy promised to him: still open, or gone by (a player who is no longer the one who draws up the lists cannot keep it: it lapses with no blame).
    if (cadre.promise && !isSecretary(game.party)) cadre.promise = null;
    if (cadre.promise && !cadre.player) {
      const election = (game.elections ?? []).find(item => item.id === cadre.promise.electionId);
      if (week > cadre.promise.until || (election && ['held', 'missed'].includes(election.status))) breakPromise(game, life, api, cadre, committee, week, lines);
    }
    if (cadre.player || week < cadre.nextActWeek) continue;
    const open = life.requests.filter(item => OPEN.includes(item.stage));
    if (open.length >= MAX_OPEN) continue;
    if (cadre.status === 'in-uscita' && cadre.loyalty <= 30 && rand() < 0.5) {
      cadre.nextActWeek = week + 6;
      raises.push({ id: 'dirigente-lascia', params: { dedupe: cadre.id, cadreId: cadre.id, title: `${committee.name}: il dirigente locale minaccia di andarsene`, body: `${cadre.label} guida il comitato di ${committee.name} (${committee.status === 'crisi' ? 'in crisi' : 'stato: ' + committee.status}) e ${CADRE_INTERESTS[cadre.interest].detail}. Il malcontento è a ${cadre.grievance}/100 e la fedeltà a ${cadre.loyalty}/100: se se ne va porta via iscritti e volontari.` }, urgent: false });
      continue;
    }
    // A leader with a following and a committee that works brings a package of memberships: the territory grows at once, with the risk that comes with it.
    const gaps = LEADER_RULES.tessere;
    if (cadre.status === 'attivo' && cadre.ambition >= 60 && cadre.loyalty >= 55 && committee.level !== 'regione' && (committee.organization ?? 0) >= 40 && week - (cadre.lastTesseraWeek ?? -99) >= gaps.cadreGapWeeks && week - (life.lastTesseraWeek ?? -99) >= gaps.partyGapWeeks && !game.inbox.some(item => item.templateId === 'capobastone-tessere') && rand() < gaps.chance) {
      cadre.lastTesseraWeek = week; life.lastTesseraWeek = week; cadre.nextActWeek = week + 8;
      const bulk = Math.max(12, Math.round(committee.members * 0.25));
      raises.push({ id: 'capobastone-tessere', params: { dedupe: `${cadre.id}-${week}`, cadreId: cadre.id, title: `${committee.name}: il responsabile ti porta un pacchetto di tessere`, body: `${cadre.label.replace(' (figura simulata)', '')} guida il comitato di ${committee.name} e ha un seguito: propone ${bulk} nuove iscrizioni in blocco e, in cambio, ${CADRE_INTERESTS[cadre.interest].detail}. Il comitato crescerebbe subito e lui si sentirebbe in credito; ma le iscrizioni in blocco sono il genere di cosa che le altre aree contestano e che i giornali raccontano.` }, urgent: false });
      continue;
    }
    // What a local leader asks follows what he wants and where his committee stands: a committee that already decides for itself asks for more room, one with no seat or little activity asks for means.
    const kind = (committee.autonomy ?? 0) >= 72 && cadre.interest !== 'seggio' ? 'autonomia' : cadre.interest === 'seggio' ? 'candidatura-locale' : cadre.interest === 'risorse' || (committee.seat ?? 1) === 0 ? 'risorse-locali' : cadre.interest === 'autonomia' ? 'autonomia' : 'risorse-locali';
    if (rand() < 0.5 + cadre.grievance / 200) {
      const request = openRequest(life, game, { kind, from: 'cadre', refId: cadre.id, week, rand, api, cadre, committee });
      if (request) { cadre.nextActWeek = week + 10 + Math.floor(rand() * 8); cadre.lastActWeek = week; lines.push(request.title); }
    } else cadre.nextActWeek = week + 3;
  }
  for (const [id, points] of Object.entries(heard)) if (life.actors[id]) life.actors[id].grievance = Math.round(clamp(life.actors[id].grievance + Math.min(3, points)));
  return raises;
}
// The player works with a local leader: meet, promote, replace, recruit.
export function cadreAction(game, api, { action, cadreId = null, committeeId = null, week, rand }) {
  const org = game.party?.org;
  const life = normalizeLife(game.party, { seed: game.seed ?? 1, week });
  if (!CADRE_ACTIONS[action]) throw new Error('Azione non disponibile.');
  if (action === 'recluta') {
    const committee = (org?.committees ?? []).find(item => item.id === committeeId && item.status !== 'dissoluzione');
    if (!committee) throw new Error('Scegli un comitato attivo.');
    if (committee.leader?.player) throw new Error('Questo comitato lo guidi già tu.');
    if (life.cadres.some(item => item.committeeId === committee.id && item.status !== 'uscito' && !item.player)) throw new Error('Il comitato ha già un dirigente: puoi incontrarlo o sostituirlo.');
    const seed = hash(`${committee.id}|recluta|${week}`);
    life.cadres.push({ id: `quadro-${committee.id}`, committeeId: committee.id, region: committee.region, level: committee.level, name: committee.name, label: 'Dirigente reclutato da te (figura simulata)', currentId: null, player: false, interest: INTERESTS[seed % INTERESTS.length], ambition: 40 + seed % 40, loyalty: 72, grievance: 8, status: 'attivo', sinceWeek: week, lastActWeek: null, nextActWeek: week + 12, recruitedBy: 'player', source: SIM });
    committee.leader = { label: 'Dirigente reclutato da te (figura simulata)', currentId: null, player: false, since: week };
    life.cadres.at(-1).leaderKey = leaderKeyOf(committee);
    committee.loyalty = Math.round(clamp(Math.max(committee.loyalty, 70)));
    org.cadres = (org.cadres ?? 0) + 1;
    note(life, week, 'quadro', `Reclutato un dirigente per ${committee.name}`);
    return [`${committee.name}: nuovo dirigente, fedeltà 72`];
  }
  const cadre = life.cadres.find(item => item.id === cadreId && item.status !== 'uscito');
  if (!cadre) throw new Error('Dirigente non disponibile.');
  const committee = org.committees.find(item => item.id === cadre.committeeId);
  if (cadre.player) throw new Error('Guidi tu questo comitato.');
  const lines = [];
  if (action === 'incontra') {
    const resolved = cadre.grievance >= 75 && cadre.loyalty <= 30;
    cadre.loyalty = Math.round(clamp(cadre.loyalty + (resolved ? 4 : 9))); cadre.grievance = Math.round(clamp(cadre.grievance - (resolved ? 6 : 16)));
    committee.loyalty = Math.round(clamp(committee.loyalty + 4)); committee.lastVisitWeek = week;
    if (cadre.currentId) api.changeRelation(game, cadre.currentId, 1);
    lines.push(`${committee.name}: fedeltà ${cadre.loyalty}, malcontento ${cadre.grievance}${resolved ? ' (ha già deciso: servirà altro)' : ''}`);
  } else if (action === 'promuovi') {
    cadre.loyalty = Math.round(clamp(cadre.loyalty + 22)); cadre.grievance = Math.round(clamp(cadre.grievance - 30)); cadre.ambition = Math.round(clamp(cadre.ambition + 10));
    committee.loyalty = Math.round(clamp(committee.loyalty + 12));
    if (cadre.currentId) api.changeRelation(game, cadre.currentId, 2);
    for (const other of life.cadres.filter(item => item.id !== cadre.id && item.status !== 'uscito' && !item.player)) other.grievance = Math.round(clamp(other.grievance + 4));
    for (const actor of Object.values(life.actors)) if (actor.id !== cadre.currentId) actor.grievance = Math.round(clamp(actor.grievance + 2));
    lines.push(`${committee.name}: dirigente promosso, fedeltà ${cadre.loyalty}; gli altri quadri si sentono scavalcati`);
  } else if (action === 'sostituisci') {
    const outgoing = cadre.currentId ? life.actors[cadre.currentId] : null;
    // A new man, chosen by the player: his own interests and ambition, no promise of the one he replaces.
    const seed = hash(`${committee.id}|sostituisci|${week}|${game.seed ?? 1}`);
    cadre.label = 'Dirigente scelto da te (figura simulata)'; cadre.currentId = null; cadre.loyalty = 72; cadre.grievance = 10; cadre.recruitedBy = 'player';
    cadre.interest = INTERESTS[seed % INTERESTS.length]; cadre.ambition = 35 + (seed >>> 3) % 55; cadre.promise = null; cadre.status = 'attivo';
    committee.leader = { label: cadre.label, currentId: null, player: false, since: week };
    cadre.leaderKey = leaderKeyOf(committee);
    committee.loyalty = Math.round(clamp(Math.max(committee.loyalty, 70)));
    committee.organization = Math.round(clamp(committee.organization - 4));
    if (outgoing) { outgoing.grievance = Math.round(clamp(outgoing.grievance + 8)); outgoing.loyalty = Math.round(clamp(outgoing.loyalty - 5)); api.changeRelation(game, outgoing.id, -3); lines.push(`${outgoing.leaderLabel}: non gradisce il cambio`); }
    lines.push(`${committee.name}: nuovo dirigente vicino a te, organizzazione −4`);
  }
  note(life, week, 'quadro', `${CADRE_ACTIONS[action].label}: ${committee.name}`);
  return lines;
}
// The decision when a local leader threatens to go: hold him back with a post, meet him, or let him leave.
export function cadreDecision(game, api, { cadreId, choice, week, date, rand }) {
  const life = normalizeLife(game.party, { seed: game.seed ?? 1, week });
  const cadre = life.cadres.find(item => item.id === cadreId && item.status !== 'uscito');
  if (!cadre) return [];
  const committee = game.party.org.committees.find(item => item.id === cadre.committeeId);
  if (choice === 'leave') return cadreLeaves(game, life, api, cadre, week, date);
  if (choice === 'rifiuta') {
    cadre.grievance = Math.round(clamp(cadre.grievance + 10)); cadre.loyalty = Math.round(clamp(cadre.loyalty - 6));
    if (cadre.currentId) api.changeRelation(game, cadre.currentId, -1);
    return [`${committee?.name ?? 'Il comitato'}: il responsabile non la prende bene, ma le tessere restano in sezione`];
  }
  if (choice === 'tessere' || choice === 'verifica') {
    const org = game.party.org;
    const checked = choice === 'verifica';
    const added = Math.round(Math.max(12, committee.members * 0.25) * (checked ? 0.6 : 1));
    committee.members += added;
    const section = org.sections.find(item => item.region === committee.region);
    if (section) section.members += added;
    org.members = org.sections.reduce((sum, item) => sum + item.members, 0);
    committee.organization = Math.round(clamp(committee.organization + (checked ? 2 : 3)));
    cadre.loyalty = Math.round(clamp(cadre.loyalty + (checked ? 4 : 8))); cadre.grievance = Math.round(clamp(cadre.grievance - 10));
    if (cadre.currentId) api.changeRelation(game, cadre.currentId, 1);
    const lines = [`${committee.name}: +${added} iscritti${checked ? ' (verificati uno per uno)' : ''}`];
    // Memberships taken in bulk without a check are the stuff of the other areas' accusations.
    if (!checked && rand() < 0.4) {
      org.cohesion = Math.round(clamp((org.cohesion ?? 55) - 2));
      api.remember(game, { date, kind: 'scandalo', text: `Tessere in blocco a ${committee.name}: il caso finisce sui giornali`, weight: 0.8, subject: cadre.currentId ?? null });
      lines.push('Le altre aree contestano le iscrizioni in blocco: coesione −2 e un caso sui giornali');
    }
    note(life, week, 'quadro', `${committee.name}: ${added} tessere portate dal responsabile`);
    return lines;
  }
  if (choice === 'keep') {
    cadre.grievance = Math.round(clamp(cadre.grievance - 32)); cadre.loyalty = Math.round(clamp(cadre.loyalty + 16)); cadre.ambition = Math.round(clamp(cadre.ambition + 8));
    for (const other of life.cadres.filter(item => item.id !== cadre.id && item.status !== 'uscito' && !item.player)) other.grievance = Math.round(clamp(other.grievance + 3));
    note(life, week, 'quadro', `${committee?.name ?? 'Il comitato'}: il dirigente resta con un incarico`);
    return [`${committee?.name ?? 'Il comitato'}: il dirigente resta, ma gli altri quadri notano il favore`];
  }
  // A meeting: it works unless the mind is already made up.
  if (cadre.loyalty <= 30 && rand() < 0.5) return [`${committee?.name ?? 'Il comitato'}: il colloquio non basta`, ...cadreLeaves(game, life, api, cadre, week, date)];
  cadre.grievance = Math.round(clamp(cadre.grievance - 18)); cadre.loyalty = Math.round(clamp(cadre.loyalty + 10));
  if (committee) { committee.lastVisitWeek = week; committee.loyalty = Math.round(clamp(committee.loyalty + 4)); }
  return [`${committee?.name ?? 'Il comitato'}: il colloquio ricuce, malcontento ${cadre.grievance}`];
}
// A local leader walks away: the committee loses members and volunteers, and may pass to a rival area.
function cadreLeaves(game, life, api, cadre, week, date) {
  const org = game.party.org;
  const committee = org.committees.find(item => item.id === cadre.committeeId);
  cadre.status = 'uscito'; cadre.leftWeek = week;
  if (!committee) return [];
  const lost = Math.round(committee.members * 0.3), activists = Math.round(committee.activists * 0.5);
  committee.members = Math.max(3, committee.members - lost); committee.activists = Math.max(0, committee.activists - activists);
  committee.organization = Math.round(clamp(committee.organization - 14));
  const rival = Object.values(life.actors).filter(item => item.id !== cadre.currentId).sort((a, b) => b.grievance - a.grievance)[0];
  committee.leader = { label: `${rival ? rival.leaderLabel.split(' · ')[1]?.replace(' (figura simulata)', '') ?? 'un’altra area' : 'un’altra area'} (figura simulata)`, currentId: rival?.id ?? null, player: false, since: week };
  committee.loyalty = Math.round(clamp(committee.loyalty - 22));
  const section = org.sections.find(item => item.region === committee.region);
  if (section && committee.level === 'regione') section.members = Math.max(5, section.members - lost);
  org.members = org.sections.reduce((sum, item) => sum + item.members, 0);
  org.militants = Math.max(0, Math.round(org.militants - activists)); org.cadres = Math.max(0, (org.cadres ?? 0) - 1);
  // His area loses a man (and hears about it), the one that takes the committee gains ground.
  const left = cadre.currentId ? life.actors[cadre.currentId] : null;
  if (left) { left.grievance = Math.round(clamp(left.grievance + 4)); left.momentum = round1(clamp(left.momentum - 1, -15, 15)); api.changeRelation(game, left.id, -2); }
  if (rival) rival.momentum = round1(clamp(rival.momentum + 1, -15, 15));
  cadre.promise = null;
  api.remember(game, { date, kind: 'quadro-perso', text: `Il dirigente di ${committee.name} ha lasciato il partito`, weight: 0.8, subject: rival?.id ?? null });
  note(life, week, 'quadro', `${committee.name}: il dirigente se ne va (−${lost} iscritti, −${activists} volontari)`);
  return [`${committee.name}: il dirigente se ne va, −${lost} iscritti e −${activists} volontari`];
}

// ---------- requests ----------
function electionSoon(game, date, days = 84) {
  return (game.elections ?? []).find(item => ['upcoming', 'open'].includes(item.status) && item.windowOpensAt <= addDays(date, days) && date <= item.windowClosesAt) ?? null;
}
function addDays(date, days) { const next = new Date(`${String(date).slice(0, 10)}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + days); return next.toISOString().slice(0, 10); }
// Builds the request an actor makes in the present situation, or null when the kind does not fit it.
function buildRequest(kind, context) {
  const { game, party, life, actor, current, week, date, cadre, committee, external } = context;
  const org = party.org;
  const share = actor ? strengthShare(party, actor.id) : 0;
  const seats = actor ? life.organs.seats[actor.id] ?? 0 : 0;
  const weight = Math.round(share * 100);
  const who = actor?.leaderLabel?.split(' · ')[0] ?? 'Il capo dell’area';
  if (kind === 'quote-liste') {
    const election = electionSoon(game, date);
    if (!election || !isSecretary(party)) return null;
    const pct = Math.round(clamp(share * 100 * 1.1 + actor.ambition / 10 - 8, 10, 40));
    return { title: `${current.label}: quota nelle liste per ${election.label}`, body: `${who} chiede il ${pct}% dei posti sicuri nelle liste: oggi l’area pesa il ${weight}% del partito e ha ${seats} seggi su ${life.organs.total} negli organi.`, acceptLabel: `${pct}% dei posti sicuri`, ask: { share: pct, electionId: election.id }, dueWeek: week + 5 };
  }
  if (kind === 'linea') {
    if (!isSecretary(party) || party.line === actor.line || partyLineOf(party) === actor.line) return null;
    return { title: `${current.label} vuole la linea «${PARTY_LINES[actor.line]?.label ?? actor.line}»`, body: `Il partito tiene la linea «${PARTY_LINES[partyLineOf(party)]?.label}». ${who} chiede «${PARTY_LINES[actor.line]?.label}»: ${PARTY_LINES[actor.line]?.detail ?? ''}`, acceptLabel: `linea «${PARTY_LINES[actor.line]?.label}»`, ask: { line: actor.line }, dueWeek: week + 6 };
  }
  if (kind === 'programma') {
    const program = party.program?.areas ?? [];
    const area = (actor.areas ?? []).find(item => !program.includes(item));
    if (!isSecretary(party) || !area) return null;
    return { title: `${current.label} chiede un tema nel programma`, body: `${who} vuole «${area}» tra le priorità: oggi il programma ne conta ${program.length} e nessuna è dell’area.`, acceptLabel: `inserisci «${area}» nel programma`, ask: { area }, dueWeek: week + 6 };
  }
  if (kind === 'incarico') {
    if (!isSecretary(party) || share - seats / life.organs.total < 0.05) return null;
    return { title: `${current.label} chiede un seggio in più negli organi`, body: `${who}: l’area pesa il ${weight}% ma siede in ${seats} organi su ${life.organs.total} (${Math.round(seats / life.organs.total * 100)}%). Chiede di riequilibrare.`, acceptLabel: 'un seggio in più negli organi', ask: { seats: 1 }, dueWeek: week + 6 };
  }
  if (kind === 'fondi') {
    const regional = committeesOf(org).filter(item => item.leader?.currentId === actor.id);
    if (!isSecretary(party) || regional.length === 0 || org.treasury.balance < 3000) return null;
    const amount = Math.round(clamp(org.treasury.balance * 0.04, 300, 2500) / 50) * 50;
    return { title: `${current.label} chiede fondi per le sue federazioni`, body: `${who} guida ${regional.length} comitati (organizzazione media ${Math.round(regional.reduce((sum, item) => sum + item.organization, 0) / regional.length)}/100) e chiede ${amount.toLocaleString('it-IT')} € ogni quattro settimane. In cassa: ${Math.round(org.treasury.balance).toLocaleString('it-IT')} €.`, acceptLabel: `${amount.toLocaleString('it-IT')} € ogni quattro settimane`, ask: { amount }, dueWeek: week + 6 };
  }
  if (kind === 'tregua') {
    const conflict = (org.conflicts ?? []).find(item => (item.currents ?? []).includes(actor.id));
    if (!isSecretary(party) || !conflict) return null;
    return { title: `${current.label} offre una tregua`, body: `${who} propone di chiudere lo scontro «${conflict.title.toLowerCase()}» (intensità ${conflict.intensity}): in cambio chiede di non essere attaccata né colpita da espulsioni.`, acceptLabel: 'tregua di quattro mesi', ask: { conflictId: conflict.id }, dueWeek: week + 4 };
  }
  if (kind === 'ultimatum') {
    const demand = actor.priority === 'poltrone' ? 'incarico' : actor.priority === 'linea' ? 'linea' : actor.priority === 'candidature' ? 'quote-liste' : actor.priority === 'programma' ? 'programma' : actor.priority === 'risorse' ? 'fondi' : 'incarico';
    const inner = buildRequest(demand, context);
    if (!inner) return null;
    return { title: `${current.label}: ultimatum`, body: `${who}: «${inner.title}». ${cap(inner.body)} Se non arriva una risposta entro quattro settimane l’area valuta di lasciare il partito (malcontento ${Math.round(actor.grievance)}/100, fedeltà ${Math.round(actor.loyalty)}/100).`, acceptLabel: inner.acceptLabel, ask: { demand, ...inner.ask }, dueWeek: week + SPLIT_RULES.ultimatumWeeks, urgent: true };
  }
  if (kind === 'sostegno-congresso' || kind === 'sponsor') {
    if (isSecretary(party) || !party.org || party.alignedCurrentId === actor.id) return null;
    const cong = life.congress;
    if (kind === 'sostegno-congresso' && !cong) return null;
    return { title: kind === 'sponsor' ? `${current.label} si offre di spingere la tua candidatura` : `${current.label} ti chiede di sostenere la sua mozione`, body: kind === 'sponsor' ? `${who} può pesare sulle liste: in cambio vuole che tu ti schieri con l’area (oggi pesa il ${weight}%).` : `${who} cerca delegati prima del congresso: se ti schieri con l’area (${weight}% del partito) avrai un posto quando vince; se perde, ne pagherai le conseguenze.`, acceptLabel: `schierati con ${current.label}`, ask: { alignWith: actor.id }, dueWeek: week + 5 };
  }
  if (kind === 'alleanza-congressuale') {
    const cong = life.congress;
    if (!cong || !isSecretary(party) || party.leaderCurrentId === actor.id) return null;
    const partner = currentsOf(party).filter(item => item.id !== actor.id && !cong.alliances.some(al => al.ids.includes(actor.id) && al.ids.includes(item.id))).sort((a, b) => rel(b) - rel(a))[0];
    if (!partner) return null;
    return { title: `${current.label} propone una mozione comune con ${partner.label}`, body: `${who} e ${partner.label} vogliono presentarsi insieme al congresso: sommano i delegati (${weight}% + ${Math.round(strengthShare(party, partner.id) * 100)}%). Tu puoi appoggiare la mozione comune o lasciarle sole.`, acceptLabel: 'appoggia la mozione comune', ask: { withId: partner.id }, dueWeek: week + 4 };
  }
  if (kind === 'risorse-locali') {
    const amount = Math.round(clamp(300 + (60 - committee.organization) * 12, 300, 1200) / 50) * 50;
    return { title: `${committee.name}: ${cadre.label.replace(' (figura simulata)', '')} chiede mezzi`, body: `Il comitato di ${committee.name} (${committee.status}, organizzazione ${committee.organization}/100) chiede ${amount.toLocaleString('it-IT')} € per sede e iniziative; il dirigente ${CADRE_INTERESTS[cadre.interest].detail}.`, acceptLabel: `${amount.toLocaleString('it-IT')} € al comitato`, ask: { amount }, dueWeek: week + 5 };
  }
  if (kind === 'candidatura-locale') {
    const election = electionSoon(game, date, 120);
    return { title: `${committee.name}: il dirigente chiede una candidatura`, body: `${cadre.label.replace(' (figura simulata)', '')} guida il comitato di ${committee.name} e chiede di essere candidato${election ? ` a ${election.label}` : ' alle prossime elezioni'}: ha ambizione ${cadre.ambition}/100 e fedeltà ${cadre.loyalty}/100.`, acceptLabel: isSecretary(party) ? 'promettigli una candidatura' : 'promettigli il tuo sostegno', ask: { electionId: election?.id ?? null }, dueWeek: week + 6 };
  }
  if (kind === 'autonomia') {
    return { title: `${committee.name}: il dirigente chiede autonomia`, body: `Il dirigente del comitato di ${committee.name} vuole decidere da solo su sede, volontari e candidati locali. Dargli mano libera rafforza la lealtà ma la coesione ne soffre.`, acceptLabel: 'mano libera sul territorio', ask: {}, dueWeek: week + 6 };
  }
  if (kind === 'fusione') {
    return { title: `${external.label} propone una fusione`, body: `${external.label} (${external.share} % nei sondaggi, rapporti ${external.tie}) propone di unire liste e organizzazione con ${party.label ?? 'il partito'}. Gli iscritti, i comitati e la cassa si sommano; ma la nuova area cambia gli equilibri e la coesione ne risente.`, acceptLabel: `fondi il partito con ${external.label}`, ask: { forceId: external.id, label: external.label, share: external.share }, dueWeek: week + 8 };
  }
  return null;
}
function openRequest(life, game, { kind, from, refId, week, rand, api, cadre = null, committee = null, external = null, actor = null }) {
  const party = game.party;
  const current = from === 'actor' ? currentsOf(party).find(item => item.id === refId) : null;
  const built = buildRequest(kind, { game, party, life, actor: from === 'actor' ? life.actors[refId] : actor, current, week, date: api.date, cadre, committee, external });
  if (!built) return null;
  life.counters.requests += 1;
  const request = { id: uniqueId(life.requests, `richiesta-${week}-${life.counters.requests}`), kind, from, refId, ...built, counter: null, stage: 'aperta', week, delays: 0, source: SIM };
  life.requests.push(request);
  return request;
}
function requestParams(request) {
  const spec = request.counter ? request.counter : null;
  return { dedupe: request.id, requestId: request.id, title: request.title, body: spec?.body ?? request.body, acceptLabel: spec?.acceptLabel ?? request.acceptLabel, kind: request.kind };
}
// Weights of what an area asks for next, from the real state of the party (not from fixed patterns).
function requestWeights(game, life, actor, party, week, date) {
  const share = strengthShare(party, actor.id);
  const seatGap = share - (life.organs.seats[actor.id] ?? 0) / life.organs.total;
  const lineGap = party.leaderCurrentId !== actor.id && partyLineOf(party) !== actor.line ? 1 : 0;
  const program = party.program?.areas ?? [];
  const programGap = (actor.areas ?? []).length ? (actor.areas.filter(item => !program.includes(item)).length / actor.areas.length) : 0;
  const priority = kind => actor.priority === kind ? 2.2 : 1;
  const election = electionSoon(game, date);
  const conflict = (party.org.conflicts ?? []).some(item => (item.currents ?? []).includes(actor.id));
  const regional = committeesOf(party.org).filter(item => item.leader?.currentId === actor.id);
  const weakTerritory = regional.length ? 1 - regional.reduce((sum, item) => sum + item.organization, 0) / regional.length / 100 : 0;
  const weights = { 'quote-liste': election ? (0.5 + Math.max(0, seatGap) * 4) * priority('candidature') : 0, linea: lineGap * (0.6 + actor.temper / 100) * priority('linea'), programma: programGap * 1.2 * priority('programma'), incarico: Math.max(0, seatGap) * 6 * priority('poltrone'), fondi: weakTerritory * 2.2 * priority('risorse'), tregua: conflict ? 1.3 * priority('unita') : 0 };
  if (!isSecretary(party)) { weights['sostegno-congresso'] = life.congress ? 1.5 + share * 3 : 0; weights.sponsor = election ? 0.8 * priority('candidature') : 0; }
  if (isSecretary(party) && life.congress) weights['alleanza-congressuale'] = 0.9 * priority('unita');
  return weights;
}
function pickWeighted(weights, rand) {
  const entries = Object.entries(weights).filter(([, value]) => value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return null;
  let roll = rand() * total;
  return (entries.find(([, value]) => (roll -= value) < 0) ?? entries.at(-1))[0];
}
function tickActors(game, life, api, week, date, rand, lines) {
  const party = game.party;
  const org = party.org;
  const raises = [];
  const secretary = isSecretary(party);
  const conflicts = org.conflicts ?? [];
  for (const current of currentsOf(party)) {
    const actor = life.actors[current.id];
    if (!actor) continue;
    const share = strengthShare(party, actor.id);
    const seatGap = share - (life.organs.seats[actor.id] ?? 0) / life.organs.total;
    const ruling = party.leaderCurrentId === actor.id;
    const lineGap = !ruling && partyLineOf(party) !== actor.line ? 1 : 0;
    const program = party.program?.areas ?? [];
    const programGap = (actor.areas ?? []).length ? actor.areas.filter(item => !program.includes(item)).length / actor.areas.length : 0.4;
    const bad = api.memoryAbout(game, actor.id, 'bad'), good = api.memoryAbout(game, actor.id, 'good');
    const pacts = life.pacts.filter(pact => pact.status === 'attivo' && pact.actorId === actor.id).length;
    const inConflict = conflicts.some(item => (item.currents ?? []).includes(actor.id));
    const target = 22 + (ruling ? -12 : 0) + Math.max(0, seatGap) * 110 + lineGap * 16 * (actor.priority === 'linea' ? 1.5 : 1) + programGap * 10 * (actor.priority === 'programma' ? 1.5 : 1)
      - (rel(current) - 50) * 0.4 + bad * 9 - good * 5 + (inConflict ? 8 : 0) + ((org.cohesion ?? 55) < 40 ? 7 : 0) - pacts * 8 - (week - (actor.lastGrantWeek ?? week - 30) < 12 ? 6 : 0);
    actor.grievance = Math.round(clamp(actor.grievance + (target - actor.grievance) * 0.12 + (rand() - 0.5) * 3));
    const loyaltyTarget = 40 + rel(current) * 0.55 - actor.grievance * 0.25 + (ruling ? 10 : 0) + pacts * 5;
    actor.loyalty = Math.round(clamp(actor.loyalty + (loyaltyTarget - actor.loyalty) * 0.1));
    actor.momentum = round1(clamp(actor.momentum * 0.97, -15, 15));
    actor.stance = actor.grievance >= 65 ? 'ostile' : actor.loyalty >= 65 && actor.grievance < 35 ? 'alleata' : 'neutrale';
    if (week < (actor.nextActWeek ?? 0)) continue;
    const open = life.requests.filter(item => OPEN.includes(item.stage));
    if (open.length >= MAX_OPEN || open.some(item => item.refId === actor.id)) continue;
    const weights = requestWeights(game, life, actor, party, week, date);
    // A grudge turns a request into an ultimatum.
    if (secretary && actor.grievance >= 76 && actor.loyalty <= 35 && !life.splitWatch[actor.id] && share * 100 >= SPLIT_RULES.minStrength && week - (life.lastSplitWeek ?? -99) > SPLIT_RULES.cooldownWeeks / 2) weights.ultimatum = 4;
    const kind = pickWeighted(weights, rand);
    actor.nextActWeek = week + Math.round((7 + actor.patience / 8) * (actor.grievance >= 60 ? 0.6 : 1)) + Math.floor(rand() * 4);
    if (!kind) continue;
    const request = openRequest(life, game, { kind, from: 'actor', refId: actor.id, week, rand, api });
    if (!request) continue;
    actor.lastActWeek = week; actor.demands = (actor.demands ?? 0) + 1;
    lines.push(`${current.label}: ${request.title.split(': ').at(-1)}`);
  }
  return raises;
}
// Open requests that are not on the desk (new, or still waiting) come back every week until they fall due.
function surfaceRequests(life, game, week, raises) {
  for (const request of life.requests.filter(item => OPEN.includes(item.stage))) {
    if (game.inbox.some(item => item.params?.requestId === request.id)) continue;
    const template = request.kind === 'ultimatum' ? 'ultimatum-partito' : request.counter ? 'controfferta-partito' : 'richiesta-partito';
    raises.push({ id: template, params: requestParams(request), urgent: Boolean(request.urgent) });
  }
}

// ---------- answering a request ----------
function addPact(life, game, { kind, actorId, terms = {}, week, weeks = null, requestId = null, title = null }) {
  life.counters.pacts += 1;
  const spec = PACT_KINDS[kind];
  const pact = { id: uniqueId(life.pacts, `accordo-${week}-${life.counters.pacts}`), kind, actorId, title: title ?? spec.label, terms, since: week, until: week + (weeks ?? spec.weeks), status: 'attivo', breaches: 0, renewals: 0, requestId, nextPayWeek: week + 4, source: SIM };
  life.pacts.push(pact);
  return pact;
}
const POWER_KINDS = ['incarico', 'quote-liste', 'linea', 'programma', 'fondi'];
// What the others think when one area gets what it asked for.
function reactToGrant(life, party, actor, kind, week, lines) {
  if (!POWER_KINDS.includes(kind)) return;
  for (const other of Object.values(life.actors)) {
    if (other.id === actor.id) continue;
    const bump = Math.round(3 + strengthShare(party, other.id) * 10);
    other.grievance = Math.round(clamp(other.grievance + bump));
    if (bump >= 6) lines.push(`${other.leaderLabel.split(' · ')[1]?.replace(' (figura simulata)', '') ?? 'Un’altra area'} non gradisce`);
  }
}
function grant(game, life, api, request, ask, week, date, lines, specials) {
  const party = game.party;
  const org = party.org;
  const actor = request.from === 'actor' ? life.actors[request.refId] : null;
  const kind = request.kind === 'ultimatum' ? ask.demand : request.kind;
  if (kind === 'quote-liste') { addPact(life, game, { kind: 'quote-liste', actorId: actor.id, terms: { share: ask.share, electionId: ask.electionId }, week, requestId: request.id }); lines.push(`Accordo: ${ask.share}% dei posti sicuri a ${party.currents.find(item => item.id === actor.id).label}`); }
  else if (kind === 'linea') {
    party.line = ask.line;
    party.decisions = { ...(party.decisions ?? {}), line: week };
    for (const current of party.currents) api.changeRelation(game, current.id, CURRENT_LINES[current.id] === ask.line ? 6 : -3);
    org.cohesion = Math.round(clamp(org.cohesion + (CURRENT_LINES[party.leaderCurrentId] === ask.line ? 2 : -3)));
    addPact(life, game, { kind: 'linea', actorId: actor.id, terms: { line: ask.line }, week, requestId: request.id });
    lines.push(`Il partito adotta la linea «${PARTY_LINES[ask.line]?.label}»`);
  } else if (kind === 'programma') {
    const areas = [...(party.program?.areas ?? [])];
    if (!areas.includes(ask.area)) areas.push(ask.area);
    party.program = { areas: areas.slice(-4), since: week, source: SIM };
    api.changeRelation(game, actor.id, 4);
    addPact(life, game, { kind: 'programma', actorId: actor.id, terms: { area: ask.area }, week, requestId: request.id });
    lines.push(`«${ask.area}» entra nel programma`);
  } else if (kind === 'incarico') {
    party.organsCurrentId = actor.id;
    addPact(life, game, { kind: 'incarico', actorId: actor.id, terms: { seats: 1 }, week, requestId: request.id });
    allocateSeats(party, life);
    lines.push(`${party.currents.find(item => item.id === actor.id).label} sale a ${life.organs.seats[actor.id]} seggi negli organi`);
  } else if (kind === 'fondi') {
    addPact(life, game, { kind: 'fondi', actorId: actor.id, terms: { amount: ask.amount }, week, requestId: request.id });
    lines.push(`Fondi ai territori: ${ask.amount.toLocaleString('it-IT')} € ogni quattro settimane`);
  } else if (kind === 'tregua') {
    addPact(life, game, { kind: 'tregua', actorId: actor.id, terms: { conflictId: ask.conflictId }, week, requestId: request.id });
    for (const conflict of org.conflicts) if ((conflict.currents ?? []).includes(actor.id)) conflict.intensity = Math.round(clamp(conflict.intensity - 25));
    org.conflicts = org.conflicts.filter(item => item.intensity > 5);
    lines.push('Tregua: lo scontro si raffredda');
  } else if (kind === 'sostegno-congresso' || kind === 'sponsor') {
    party.alignedCurrentId = ask.alignWith;
    api.changeRelation(game, ask.alignWith, 8);
    for (const current of party.currents) if (current.id !== ask.alignWith) api.changeRelation(game, current.id, -3);
    addPact(life, game, { kind: 'sostegno-congresso', actorId: ask.alignWith, terms: { alignWith: ask.alignWith }, week, weeks: life.congress ? Math.max(8, life.congress.voteWeek - week + 6) : 20, requestId: request.id });
    if (kind === 'sponsor') org.sponsor = { currentId: ask.alignWith, until: week + 40, bonus: 3, source: SIM };
    lines.push(`Ti schieri con ${party.currents.find(item => item.id === ask.alignWith)?.label}`);
  } else if (kind === 'alleanza-congressuale') {
    life.congress?.alliances.push({ ids: [request.refId, ask.withId], week, origin: 'segreteria' });
    api.changeRelation(game, request.refId, 3); api.changeRelation(game, ask.withId, 3);
    lines.push('Appoggi la mozione comune: le due aree sommano i delegati');
  } else if (kind === 'rinnovo') {
    const pact = life.pacts.find(item => item.id === ask.pactId);
    if (pact) { pact.until += ask.weeks ?? PACT_KINDS[pact.kind].weeks; pact.renewals += 1; pact.status = 'attivo'; lines.push(`Accordo rinnovato: ${pact.title}`); }
  } else if (kind === 'risorse-locali') {
    const cadre = life.cadres.find(item => item.id === request.refId);
    const committee = org.committees.find(item => item.id === cadre?.committeeId);
    api.book(game, org, -ask.amount, 'formazione', 'Mezzi a un comitato');
    if (committee) { committee.fundedUntil = week + 8; committee.organization = Math.round(clamp(committee.organization + 4)); committee.loyalty = Math.round(clamp(committee.loyalty + 6)); if (ask.amount >= 600 && (committee.seat ?? 1) < 2 && committee.level !== 'regione') { committee.seat = (committee.seat ?? 1) + 1; committee.seatSince = week; lines.push(`${committee.name}: una sede migliore`); } }
    if (cadre) { cadre.grievance = Math.round(clamp(cadre.grievance - 20)); cadre.loyalty = Math.round(clamp(cadre.loyalty + 10)); }
    lines.push(`${committee?.name ?? 'Il comitato'}: ${ask.amount.toLocaleString('it-IT')} € dalla tesoreria`);
  } else if (kind === 'candidatura-locale') {
    const cadre = life.cadres.find(item => item.id === request.refId);
    // Only who draws up the lists (the secretary) can promise a place in them; anyone else gives his support in the selections, a word that is not a promise.
    const promises = isSecretary(party);
    if (cadre) { cadre.grievance = Math.round(clamp(cadre.grievance - 25)); cadre.loyalty = Math.round(clamp(cadre.loyalty + 16)); if (promises) cadre.promise = { week, electionId: ask.electionId, until: week + 52 }; }
    lines.push(promises ? 'Promessa di candidatura: il dirigente la ricorderà' : 'Gli assicuri il tuo sostegno nelle selezioni: il dirigente lo ricorderà');
    // The lists of that vote are already drawn up: there is still time to add a name before the candidacies close, so the promise is kept now.
    if (promises && cadre && ask.electionId && org.selections?.[ask.electionId]) lines.push(...honourCadrePromises(game, api, { week, date, electionId: ask.electionId }));
  } else if (kind === 'autonomia') {
    const cadre = life.cadres.find(item => item.id === request.refId);
    const committee = org.committees.find(item => item.id === cadre?.committeeId);
    if (cadre) { cadre.grievance = Math.round(clamp(cadre.grievance - 20)); cadre.loyalty = Math.round(clamp(cadre.loyalty + 12)); }
    if (committee) { committee.loyalty = Math.round(clamp(committee.loyalty + 8)); committee.autonomyBias = Math.min(40, (committee.autonomyBias ?? 0) + 15); committee.autonomy = Math.round(clamp((committee.autonomy ?? 50) + 15)); }
    org.cohesion = Math.round(clamp(org.cohesion - 1)); org.discipline = Math.round(clamp(org.discipline - 2));
    lines.push('Mano libera sul territorio: più lealtà, meno disciplina');
  } else if (kind === 'fusione') {
    specials.push({ type: 'merge-request', forceId: ask.forceId, label: ask.label, share: ask.share });
    lines.push(`Accetti la fusione con ${ask.label}`);
  }
  if (actor) {
    actor.loyalty = Math.round(clamp(actor.loyalty + 12)); actor.grievance = Math.round(clamp(actor.grievance - 22));
    actor.granted += 1; actor.lastGrantWeek = week; actor.momentum = round1(clamp(actor.momentum + 2, -15, 15));
    api.changeRelation(game, actor.id, 4);
    reactToGrant(life, party, actor, kind, week, lines);
    api.remember(game, { date, kind: 'accordo-partito', text: `Accordo con ${party.currents.find(item => item.id === actor.id)?.label ?? 'un’area'}: ${request.title}`, weight: 0.9, subject: actor.id });
  }
  delete life.splitWatch[request.refId];
}
function refuse(game, life, api, request, week, date, lines, { soft = false } = {}) {
  const party = game.party;
  const actor = request.from === 'actor' ? life.actors[request.refId] : null;
  if (actor) {
    actor.grievance = Math.round(clamp(actor.grievance + (soft ? 4 + (request.delays ?? 0) * 1.5 : 8 + actor.temper / 10)));
    actor.loyalty = Math.round(clamp(actor.loyalty - (soft ? 2 : 6)));
    actor.refused += 1; actor.momentum = round1(clamp(actor.momentum - 1, -15, 15));
    api.changeRelation(game, actor.id, soft ? -1 : -4);
    api.remember(game, { date, kind: 'richiesta-respinta', text: `${soft ? 'Nessuna risposta a' : 'Respinta la richiesta di'} ${party.currents.find(item => item.id === actor.id)?.label ?? 'un’area'}: ${request.title}`, weight: soft ? 0.5 : 0.8, subject: actor.id });
    if (request.kind === 'ultimatum') { life.splitWatch[actor.id] = { since: week, deadline: week + 1, from: 'ultimatum' }; lines.push(`${party.currents.find(item => item.id === actor.id)?.label} valuta la rottura`); }
    else if (actor.grievance >= 60) lines.push(`${party.currents.find(item => item.id === actor.id)?.label}: malcontento ${actor.grievance}/100`);
  } else if (request.from === 'cadre') {
    const cadre = life.cadres.find(item => item.id === request.refId);
    if (cadre) { cadre.grievance = Math.round(clamp(cadre.grievance + (soft ? 6 : 12))); cadre.loyalty = Math.round(clamp(cadre.loyalty - (soft ? 3 : 8))); lines.push(`${cadre.name}: il dirigente non la prende bene`); }
  }
}
// The player's answer to a request on the desk (accept, negotiate, refuse, wait) or to a counter-offer.
export function respondRequest(game, api, { requestId, choice, week, date, rand }) {
  const party = game.party;
  const life = normalizeLife(party, { seed: game.seed ?? 1, week });
  const request = life?.requests.find(item => item.id === requestId);
  const lines = [], raises = [], specials = [];
  if (!request || !OPEN.includes(request.stage)) return { lines, raises, specials, gone: true };
  const actor = request.from === 'actor' ? life.actors[request.refId] : null;
  const label = party.currents.find(item => item.id === request.refId)?.label ?? 'l’interlocutore';
  if (choice === 'accetta' || choice === 'accetta-controfferta') {
    const ask = choice === 'accetta-controfferta' && request.counter ? request.counter.ask : request.ask;
    grant(game, life, api, request, ask, week, date, lines, specials);
    closeRequest(life, request, choice === 'accetta-controfferta' ? 'accordo-dopo-trattativa' : 'accolta', week);
    note(life, week, 'accordo', `${label}: ${request.title} — accolta`);
  } else if (choice === 'rifiuta') {
    refuse(game, life, api, request, week, date, lines);
    closeRequest(life, request, 'respinta', week);
    note(life, week, 'rifiuto', `${label}: ${request.title} — respinta`);
  } else if (choice === 'tratta') {
    const capitalBoost = clamp(((game.resources?.politicalCapital ?? 30) - 20) / 200, 0, 0.2);
    const base = actor ? 0.3 + (actor.loyalty - 50) / 160 + (rel(party.currents.find(item => item.id === actor.id)) - 50) / 200 - (actor.temper - 40) / 300 : 0.45;
    const chance = clamp(base + capitalBoost - (request.delays ?? 0) * 0.03 - (request.kind === 'ultimatum' ? 0.1 : 0), 0.1, 0.8);
    if (rand() < chance) {
      const counter = softenRequest(request);
      if (counter) {
        request.counter = counter; request.stage = 'trattativa'; request.dueWeek = Math.max(request.dueWeek, week + 3); request.rounds = (request.rounds ?? 0) + 1;
        lines.push(`${label} risponde con una controfferta: ${counter.acceptLabel}`);
        raises.push({ id: 'controfferta-partito', params: requestParams(request), urgent: false });
      } else {
        request.dueWeek += 3; request.delays += 1;
        if (actor) actor.grievance = Math.round(clamp(actor.grievance - 4));
        lines.push(`${label} concede più tempo`);
      }
    } else {
      if (actor) { actor.grievance = Math.round(clamp(actor.grievance + 4)); }
      lines.push(`${label} non cede: la trattativa è chiusa`);
      note(life, week, 'trattativa', `${label}: trattativa fallita`);
    }
  } else if (choice === 'tempo') {
    request.delays += 1;
    if (actor) actor.grievance = Math.round(clamp(actor.grievance + 1.5));
  }
  return { lines, raises, specials };
}
// A softer version of what is asked: the counter-offer of a negotiation (null when the ask cannot be softened).
function softenRequest(request) {
  const ask = request.ask;
  if (request.kind === 'quote-liste' || (request.kind === 'ultimatum' && ask.demand === 'quote-liste')) {
    const pct = Math.max(8, Math.round(ask.share * 0.65));
    return { ask: { ...ask, share: pct }, acceptLabel: `${pct}% dei posti sicuri`, body: `${request.body.split(' ')[0]} abbassa la pretesa: ${pct}% dei posti sicuri al posto del ${ask.share}%.` };
  }
  if (request.kind === 'fondi' || (request.kind === 'ultimatum' && ask.demand === 'fondi')) {
    const amount = Math.max(250, Math.round(ask.amount * 0.6 / 50) * 50);
    return { ask: { ...ask, amount }, acceptLabel: `${amount.toLocaleString('it-IT')} € ogni quattro settimane`, body: `Controfferta: ${amount.toLocaleString('it-IT')} € ogni quattro settimane al posto di ${ask.amount.toLocaleString('it-IT')} €.` };
  }
  if (request.kind === 'risorse-locali') {
    const amount = Math.max(200, Math.round(ask.amount * 0.6 / 50) * 50);
    return { ask: { ...ask, amount }, acceptLabel: `${amount.toLocaleString('it-IT')} € al comitato`, body: `Il dirigente accetta ${amount.toLocaleString('it-IT')} € invece di ${ask.amount.toLocaleString('it-IT')} €.` };
  }
  return null;
}

// ---------- agreements ----------
function pactHonoured(game, life, pact) {
  const party = game.party;
  if (pact.kind === 'linea') return party.line === pact.terms.line;
  if (pact.kind === 'programma') return (party.program?.areas ?? []).includes(pact.terms.area);
  if (pact.kind === 'incarico') return (life.organs.seats[pact.actorId] ?? 0) >= 1;
  if (pact.kind === 'tregua') return party.communication !== 'aggressiva' && !(party.org.expelledWeek && party.org.expelledWeek >= pact.since);
  if (pact.kind === 'sostegno-congresso') return party.alignedCurrentId === pact.terms.alignWith;
  return true;
}
function tickPacts(game, life, api, week, date, rand, lines, raises) {
  const party = game.party;
  const org = party.org;
  for (const pact of life.pacts.filter(item => item.status === 'attivo')) {
    const actor = life.actors[pact.actorId];
    const current = party.currents.find(item => item.id === pact.actorId);
    if (!actor || !current) { pact.status = 'scaduto'; continue; }
    if (!pactHonoured(game, life, pact)) {
      pact.status = 'rotto'; pact.breaches += 1; pact.endedWeek = week;
      actor.grievance = Math.round(clamp(actor.grievance + 18)); actor.loyalty = Math.round(clamp(actor.loyalty - 15));
      api.changeRelation(game, actor.id, -6);
      api.remember(game, { date, kind: 'accordo-rotto', text: `Rotto l’accordo «${pact.title}» con ${current.label}`, weight: 1.1, subject: actor.id });
      note(life, week, 'accordo', `Accordo rotto: ${pact.title} (${current.label})`);
      lines.push(`Accordo rotto: ${pact.title}. ${current.label} se lo ricorderà`);
      allocateSeats(party, life);
      continue;
    }
    if (pact.kind === 'fondi' && week >= pact.nextPayWeek) {
      pact.nextPayWeek = week + 4;
      if (org.treasury.balance < pact.terms.amount) {
        pact.status = 'rotto'; pact.breaches += 1; pact.endedWeek = week;
        actor.grievance = Math.round(clamp(actor.grievance + 14)); actor.loyalty = Math.round(clamp(actor.loyalty - 10));
        api.remember(game, { date, kind: 'accordo-rotto', text: `Fondi non versati a ${current.label}: cassa vuota`, weight: 1, subject: actor.id });
        lines.push(`Tesoreria vuota: i fondi a ${current.label} non arrivano`);
        continue;
      }
      api.book(game, org, -pact.terms.amount, 'formazione', `Fondi a ${current.label}`);
      for (const committee of committeesOf(org).filter(item => item.leader?.currentId === actor.id)) { committee.organization = Math.round(clamp(committee.organization + 2.5)); committee.loyalty = Math.round(clamp(committee.loyalty + 1)); committee.fundedUntil = week + 4; }
      actor.momentum = round1(clamp(actor.momentum + 0.5, -15, 15));
    }
    if (pact.kind === 'tregua') for (const conflict of org.conflicts) if ((conflict.currents ?? []).includes(actor.id)) conflict.intensity = Math.round(clamp(conflict.intensity - 1.5));
    if (pact.kind === 'linea' || pact.kind === 'incarico') actor.loyalty = Math.round(clamp(actor.loyalty + 0.4));
    const left = pact.until - week;
    if (left <= 4 && left > 0 && !life.requests.some(item => item.kind === 'rinnovo' && item.ask?.pactId === pact.id) && life.requests.filter(item => OPEN.includes(item.stage)).length < MAX_OPEN + 1) {
      const harder = actor.grievance > 55 || actor.momentum > 6;
      life.counters.requests += 1;
      const request = { id: uniqueId(life.requests, `richiesta-${week}-${life.counters.requests}`), kind: 'rinnovo', from: 'actor', refId: actor.id, title: `${current.label}: rinnovo di «${pact.title}»`, body: `L’accordo «${pact.title}» scade tra ${left} settimane. ${actor.leaderLabel.split(' · ')[0]} chiede di rinnovarlo${harder ? ' a condizioni più pesanti: la sua area è cresciuta o è scontenta' : ' alle stesse condizioni'}. Senza rinnovo, l’area perde ciò che ha ottenuto.`, acceptLabel: `rinnova per ${PACT_KINDS[pact.kind].weeks} settimane`, ask: { pactId: pact.id, weeks: PACT_KINDS[pact.kind].weeks }, counter: null, stage: 'aperta', week, dueWeek: pact.until, delays: 0, source: SIM };
      life.requests.push(request);
    }
    if (week >= pact.until) {
      pact.status = 'scaduto'; pact.endedWeek = week;
      actor.grievance = Math.round(clamp(actor.grievance + 4));
      note(life, week, 'accordo', `Scaduto: ${pact.title} (${current.label})`);
      lines.push(`Accordo scaduto: ${pact.title}`);
      allocateSeats(party, life);
    }
  }
  // The record keeps only the latest pacts that are over.
  life.pacts = [...life.pacts.filter(item => item.status === 'attivo'), ...life.pacts.filter(item => item.status !== 'attivo').slice(-8)];
  for (const request of [...life.requests].filter(item => OPEN.includes(item.stage) && item.dueWeek <= week)) {
    if (request.kind === 'rinnovo') { closeRequest(life, request, 'scaduta', week); continue; }
    refuse(game, life, api, request, week, date, lines, { soft: true });
    closeRequest(life, request, 'scaduta', week);
    note(life, week, 'rifiuto', `${request.title} — scaduta senza risposta`);
  }
}
export function breakPact(game, api, { pactId, week, date }) {
  const party = game.party;
  const life = normalizeLife(party, { seed: game.seed ?? 1, week });
  const pact = life.pacts.find(item => item.id === pactId && item.status === 'attivo');
  if (!pact) throw new Error('Accordo non più in vigore.');
  const actor = life.actors[pact.actorId];
  pact.status = 'rotto'; pact.breaches += 1; pact.endedWeek = week; pact.byPlayer = true;
  if (actor) { actor.grievance = Math.round(clamp(actor.grievance + 14)); actor.loyalty = Math.round(clamp(actor.loyalty - 12)); }
  api.remember(game, { date, kind: 'accordo-rotto', text: `Denunciato l’accordo «${pact.title}»`, weight: 1, subject: pact.actorId });
  allocateSeats(party, life);
  note(life, week, 'accordo', `Denunciato: ${pact.title}`);
  return [`Accordo denunciato: ${pact.title}`];
}
// At the selection of the candidates the agreements on the lists are honoured: bonus for the area, resentment of the others.
export function honourListPacts(game, api, { week, date }) {
  const life = game.party?.life;
  const lines = [];
  if (!life) return lines;
  for (const pact of life.pacts.filter(item => item.status === 'attivo' && item.kind === 'quote-liste')) {
    const actor = life.actors[pact.actorId];
    if (!actor) continue;
    actor.loyalty = Math.round(clamp(actor.loyalty + 10)); actor.grievance = Math.round(clamp(actor.grievance - 12)); actor.momentum = round1(clamp(actor.momentum + 2, -15, 15));
    for (const other of Object.values(life.actors)) if (other.id !== actor.id) other.grievance = Math.round(clamp(other.grievance + Math.round(pact.terms.share / 8)));
    pact.honoured = (pact.honoured ?? 0) + 1;
    lines.push(`Liste: il ${pact.terms.share}% dei posti sicuri va a ${game.party.currents.find(item => item.id === actor.id)?.label}`);
  }
  return lines;
}

// ---------- the congress ----------
const SCHEDULE_LEAD = CONGRESS_PHASES.reduce((sum, item) => sum + item.weeks, 0);
function schedulePhases(voteWeek, week) {
  const lead = clamp(voteWeek - week, 4, SCHEDULE_LEAD);
  const scale = lead / SCHEDULE_LEAD;
  let start = voteWeek - lead;
  return CONGRESS_PHASES.map(phase => { const entry = { id: phase.id, startWeek: Math.round(start) }; start += phase.weeks * scale; return entry; });
}
export const congressPhaseOf = (congress, week) => [...congress.schedule].reverse().find(item => item.startWeek <= week)?.id ?? congress.schedule[0].id;
// The area that prepared the congress on its own (a plan with the federations, a motion, an agreement) arrives with more delegates.
function preparedBonus(current, congress) {
  const plan = current.profile?.congressPlan;
  if (!plan || (congress.voteWeek ?? 0) - (plan.week ?? 0) > 60) return 1;
  return 1 + (plan.action === 'endorsement-territoriale' ? 0.12 : 0.08);
}
// The agreements the areas reached by themselves count as alliances of the vote (the pairs stay apart).
function adoptAgreements(party, congress, week) {
  for (const current of party.currents) for (const pact of current.profile?.agreements ?? []) {
    const ids = pact?.currents;
    if (pact?.status !== 'active' || !Array.isArray(ids) || ids.length !== 2 || week - (pact.week ?? week) > 30) continue;
    const members = ids.map(id => party.currents.find(item => item.id === id));
    if (members.some(item => !item) || congress.alliances.some(item => item.ids.some(id => ids.includes(id)))) continue;
    congress.alliances.push({ ids: [...ids], week, origin: 'accordo' });
    congress.notes.push({ week, phase: 'alleanze', text: `${members[0].label} e ${members[1].label} arrivano al congresso con un’intesa già pronta.` });
  }
}
// The share of the local committees of a region (provincial and comunal, by level and organisation) led by people of an area: the
// delegates of the congress come from the territory, and the territory follows its leaders.
function localLead(party, region, currentId) {
  const local = committeesOf(party.org).filter(item => item.region === region && ['provincia', 'comune'].includes(item.level) && !item.leader?.player);
  const weight = item => (LEADER_RULES.levelWeight[item.level] ?? 1) * (0.6 + (item.organization ?? 0) / 100);
  const total = local.reduce((sum, item) => sum + weight(item), 0);
  return total ? local.filter(item => item.leader?.currentId === currentId).reduce((sum, item) => sum + weight(item), 0) / total : 0;
}
function regionalDelegates(party, life, congress) {
  const org = party.org;
  const total = CONGRESS_DELEGATES[party.affiliation === 'founder' ? 'founder' : 'member'];
  const sections = org.sections ?? [];
  const members = sections.reduce((sum, item) => sum + item.members, 0) || 1;
  const exact = sections.map(section => ({ section, value: total * section.members / members }));
  const alloc = exact.map(item => Math.max(1, Math.floor(item.value)));
  let left = total - alloc.reduce((a, b) => a + b, 0);
  const order = exact.map((item, index) => ({ index, frac: item.value % 1 })).sort((a, b) => b.frac - a.frac);
  for (let i = 0; left > 0 && order.length; i++, left--) alloc[order[i % order.length].index] += 1;
  const byRegion = [];
  let player = 0;
  exact.forEach(({ section }, index) => {
    const delegates = alloc[index];
    const committee = (org.committees ?? []).find(item => item.level === 'regione' && item.region === section.region && item.status !== 'dissoluzione');
    const weights = party.currents.map(current => {
      const actor = life.actors[current.id];
      const noise = 0.85 + (hash(`${congress.id}|${section.region}|${current.id}`) % 31) / 100;
      const lead = 1 + (committee?.leader?.currentId === current.id ? 1.2 : 0) + 0.8 * localLead(party, section.region, current.id);
      const mobilized = 1 + (congress.mobilization?.[current.id] ?? 0) / 100;
      return Math.max(0.1, (current.strength ?? 1) * noise * lead * mobilized * (1 + (actor?.momentum ?? 0) / 100) * preparedBonus(current, congress) * (0.6 + section.vitality / 100));
    });
    const sum = weights.reduce((a, b) => a + b, 0);
    const own = committee?.leader?.player ? Math.round(delegates * 0.6) : 0;
    player += own;
    const rest = delegates - own;
    const parts = weights.map(weight => weight / sum * rest);
    const floorParts = parts.map(Math.floor);
    let remainder = rest - floorParts.reduce((a, b) => a + b, 0);
    parts.map((value, i) => ({ i, frac: value % 1 })).sort((a, b) => b.frac - a.frac).forEach(({ i }) => { if (remainder-- > 0) floorParts[i] += 1; });
    byRegion.push({ region: section.region, delegates, player: own, byCurrent: Object.fromEntries(party.currents.map((current, i) => [current.id, floorParts[i]])) });
  });
  const byCurrent = Object.fromEntries(party.currents.map(current => [current.id, byRegion.reduce((sum, row) => sum + row.byCurrent[current.id], 0)]));
  // Every federation has at least one delegate: the real total is what was actually assigned.
  return { total: byRegion.reduce((sum, row) => sum + row.delegates, 0), byRegion, byCurrent, player };
}
function openCongress(game, life, week, date) {
  const party = game.party;
  const voteWeek = party.org.congress.nextWeek;
  const congress = { id: `congresso-${voteWeek}`, voteWeek, openedWeek: week, schedule: schedulePhases(voteWeek, week), phase: 'forza', mobilization: {}, alliances: [], notes: [], delegates: null, motions: [], source: SIM };
  congress.delegates = regionalDelegates(party, life, congress);
  congress.notes.push({ week, phase: 'forza', text: `Si apre la stagione congressuale: ${congress.delegates.total} delegati, voto alla settimana ${voteWeek}.` });
  life.congress = congress;
  note(life, week, 'congresso', 'Si apre la stagione congressuale');
  return congress;
}
// Alliances of motions: the ruling area looks for a partner, the challengers can join forces against it.
function formAlliances(party, life, congress, rand, week) {
  const ordered = [...party.currents].sort((a, b) => b.strength - a.strength);
  if (ordered.length < 3 || congress.alliances.length) return;
  const ruling = party.currents.find(item => item.id === party.leaderCurrentId) ?? ordered[0];
  const others = ordered.filter(item => item.id !== ruling.id);
  const bloc = others[0].strength + others[1].strength;
  if (bloc > ruling.strength * 0.95 && rand() < 0.55 && rel(others[0]) + rel(others[1]) >= 80) { congress.alliances.push({ ids: [others[0].id, others[1].id], week, origin: 'sfidanti' }); congress.notes.push({ week, phase: 'alleanze', text: `${others[0].label} e ${others[1].label} presentano una mozione comune contro ${ruling.label}.` }); }
  else { const partner = [...others].sort((a, b) => (life.actors[b.id].loyalty - life.actors[a.id].loyalty))[0]; congress.alliances.push({ ids: [ruling.id, partner.id], week, origin: 'maggioranza' }); congress.notes.push({ week, phase: 'alleanze', text: `${ruling.label} cerca l’intesa con ${partner.label}.` }); }
}
function tickCongress(game, life, api, week, date, rand, lines, raises) {
  const party = game.party;
  if (party.affiliation === 'founder' || currentsOf(party).length < 2) { life.congress = null; return; }
  let congress = life.congress;
  if (!congress && party.org.congress.nextWeek - week <= SCHEDULE_LEAD && party.org.congress.nextWeek > week) congress = openCongress(game, life, week, date);
  if (!congress) return;
  // The vote is on the desk (the decision was raised when the congress fell due): the process waits for the answer, and
  // a congress nobody answered within six weeks is decided without the player.
  if (week >= congress.voteWeek) {
    congress.phase = 'voto';
    if (week - congress.voteWeek > 6) { const done = resolveCongress(game, api, { mode: 'neutral', influence: 30, week, date, rand }); lines.push(...done.lines); }
    return;
  }
  // A congress called early (or put off) moves the whole calendar.
  if (congress.voteWeek !== party.org.congress.nextWeek && party.org.congress.nextWeek > week) { congress.voteWeek = party.org.congress.nextWeek; congress.schedule = schedulePhases(congress.voteWeek, week); }
  const phase = congressPhaseOf(congress, week);
  if (phase !== congress.phase) {
    congress.phase = phase;
    const spec = CONGRESS_PHASES.find(item => item.id === phase);
    congress.notes.push({ week, phase, text: spec.detail });
    lines.push(`Congresso — ${spec.label}: ${spec.detail}`);
    if (phase === 'delegati') congress.delegates = regionalDelegates(party, life, congress);
    if (phase === 'alleanze') { adoptAgreements(party, congress, week); formAlliances(party, life, congress, rand, week); }
    if (phase === 'mozioni') congress.motions = party.currents.map(current => ({ id: current.id, label: `Mozione ${current.label}`, leaderLabel: life.actors[current.id]?.leaderLabel ?? null, line: life.actors[current.id]?.line ?? null }));
    if (['preparazione', 'alleanze', 'trattative'].includes(phase) && !game.inbox.some(item => item.templateId === 'congresso-fase') && (party.rank ?? 0) >= 1) raises.push({ id: 'congresso-fase', params: { dedupe: `${congress.id}-${phase}`, phaseLabel: spec.label, body: `${spec.detail} Le aree contano su di te: puoi lavorare per la tua parte o restare alla finestra. Peso attuale: ${Object.entries(congress.delegates.byCurrent).map(([id, n]) => `${party.currents.find(item => item.id === id)?.label ?? id} ${n}`).join(' · ')} delegati su ${congress.delegates.total}.` }, urgent: false });
  }
  // The preparation: every area mobilises according to its ambition, its committees and the money it has.
  if (['preparazione', 'delegati', 'alleanze', 'trattative'].includes(phase)) {
    for (const current of party.currents) {
      const actor = life.actors[current.id];
      const led = committeesOf(party.org).filter(item => item.leader?.currentId === current.id);
      const capacity = led.length ? led.reduce((sum, item) => sum + item.organization, 0) / led.length / 100 : 0.3;
      congress.mobilization[current.id] = round1(clamp((congress.mobilization[current.id] ?? 0) + actor.ambition / 100 * capacity * 2.4 * (0.6 + actor.loyalty / 200), 0, 40));
    }
  }
  if (['alleanze', 'trattative'].includes(phase)) adoptAgreements(party, congress, week);
  if (['alleanze', 'trattative', 'mozioni'].includes(phase) && week % 2 === 0) congress.delegates = regionalDelegates(party, life, congress);
  // The requests of the congress: delegates and alliances for places and lines.
  if (['alleanze', 'trattative'].includes(phase) && life.requests.filter(item => OPEN.includes(item.stage)).length < MAX_OPEN && rand() < 0.35) {
    const actor = Object.values(life.actors).filter(item => !life.requests.some(request => request.refId === item.id && OPEN.includes(request.stage))).sort((a, b) => b.ambition * strengthShare(party, b.id) - a.ambition * strengthShare(party, a.id))[0];
    if (actor) {
      const kind = isSecretary(party) ? 'alleanza-congressuale' : 'sostegno-congresso';
      const request = openRequest(life, game, { kind, from: 'actor', refId: actor.id, week, rand, api });
      if (request) lines.push(`Congresso: ${request.title}`);
    }
  }
}
// What the congress would say today (no chance): for the interface and for the decisions that come before the vote.
export function projectCongress(game, { mode = 'support', backedId = null } = {}) {
  const party = game.party;
  const life = party?.life;
  if (!life || !life.congress) return null;
  return tally(party, life, life.congress, { mode, backedId: backedId ?? party.alignedCurrentId, rand: null });
}
function tally(party, life, congress, { mode, backedId, unity = false, rand = null, influence = 40 }) {
  const delegates = congress.delegates ?? regionalDelegates(party, life, congress);
  const motions = party.currents.map(current => ({ id: current.id, label: current.label, delegates: delegates.byCurrent[current.id] ?? 0, leader: life.actors[current.id]?.leaderLabel ?? null }));
  const byId = Object.fromEntries(motions.map(item => [item.id, item]));
  // The player's own people (committees led by the player) follow the area the player backs.
  const bloc = delegates.player ?? 0;
  if (bloc) { if (backedId && byId[backedId]) byId[backedId].delegates += bloc; else for (const item of motions) item.delegates += bloc * (item.delegates / (delegates.total - bloc || 1)); }
  // Pacts for the support of the congress: whoever the player is tied to gets the weight of the agreement.
  for (const pact of life.pacts.filter(item => item.status === 'attivo' && item.kind === 'sostegno-congresso')) if (byId[pact.actorId] && backedId === pact.actorId) byId[pact.actorId].delegates += Math.round(delegates.total * 0.03);
  const ruling = party.leaderCurrentId;
  let player = null;
  if (mode === 'candidate' || mode === 'incumbent') {
    const own = mode === 'incumbent' ? ruling : backedId;
    const aligned = own && byId[own] ? byId[own] : null;
    const base = aligned ? Math.round(aligned.delegates * (mode === 'incumbent' ? 1 : 0.75)) : 0;
    if (aligned) aligned.delegates -= base;
    const incumbentBonus = mode === 'incumbent' ? Math.round(delegates.total * 0.04) : 0;
    const prestige = Math.round(delegates.total * clamp((influence - 30) / 400 + (party.support - 50) / 600, -0.03, 0.08));
    let moved = 0;
    if (unity) { const strongest = [...motions].filter(item => item.id !== own).sort((a, b) => b.delegates - a.delegates)[0]; if (strongest) { moved = Math.round(strongest.delegates * 0.4); strongest.delegates -= moved; } }
    player = { id: 'player', label: mode === 'incumbent' ? 'La tua segreteria' : 'La tua candidatura', delegates: Math.max(0, base + incumbentBonus + prestige + moved + (mode === 'candidate' && !aligned ? bloc : 0)), leader: 'Tu' };
  }
  // Joint motions: the delegates of the allied areas add up under the strongest.
  const lists = [...motions, ...(player ? [player] : [])];
  const fronts = [];
  const used = new Set();
  for (const alliance of congress.alliances ?? []) {
    const members = alliance.ids.map(id => lists.find(item => item.id === id)).filter(Boolean);
    if (members.length < 2 || members.some(item => used.has(item.id))) continue;
    members.forEach(item => used.add(item.id));
    const head = [...members].sort((a, b) => b.delegates - a.delegates)[0];
    fronts.push({ id: head.id, label: `${members.map(item => item.label).join(' + ')}`, delegates: members.reduce((sum, item) => sum + item.delegates, 0), leader: head.leader, members: members.map(item => item.id) });
  }
  for (const item of lists) if (!used.has(item.id)) fronts.push({ ...item, members: [item.id] });
  const noise = rand ? () => 1 + (rand() - 0.5) * 0.06 : () => 1;
  const totals = fronts.map(front => ({ ...front, votes: front.delegates * noise() }));
  const sum = totals.reduce((a, b) => a + b.votes, 0) || 1;
  const ranked = totals.map(front => ({ id: front.id, label: front.label, leader: front.leader, members: front.members, delegates: Math.round(front.delegates), pct: round1(front.votes / sum * 100) })).sort((a, b) => b.pct - a.pct);
  return { mode, total: delegates.total, ranked, winner: ranked[0], margin: round1((ranked[0]?.pct ?? 0) - (ranked[1]?.pct ?? 0)), playerBloc: bloc };
}
// The vote of the congress: the delegates built week after week decide the leadership; then come the consequences.
export function resolveCongress(game, api, { mode = 'support', backedId = null, unity = false, influence = 40, week, date, rand }) {
  const party = game.party;
  const life = normalizeLife(party, { seed: game.seed ?? 1, week });
  if (!life.congress) { openCongress(game, life, week, date); life.congress.delegates = regionalDelegates(party, life, life.congress); }
  const congress = life.congress;
  const result = tally(party, life, congress, { mode, backedId, unity, rand, influence });
  const winnerPlayer = result.winner.id === 'player' || (result.winner.members ?? []).includes('player');
  const winnerCurrentId = winnerPlayer ? (mode === 'incumbent' ? party.leaderCurrentId : backedId ?? party.alignedCurrentId ?? [...party.currents].sort((a, b) => b.strength - a.strength)[0].id) : result.winner.id;
  const outcome = { ...result, winnerCurrentId, playerWon: winnerPlayer, week, source: SIM };
  const lines = applyCongressOutcome(game, life, api, outcome, { week, date, rand, mode, backedId });
  return { outcome, lines };
}
function applyCongressOutcome(game, life, api, outcome, { week, date, rand, mode, backedId }) {
  const party = game.party;
  const org = party.org;
  const lines = [];
  const congress = life.congress;
  const shares = Object.fromEntries(party.currents.map(current => [current.id, 0]));
  for (const row of outcome.ranked) { const members = row.members ?? [row.id]; for (const id of members) if (id in shares) shares[id] += row.pct / members.length; }
  const sum = Object.values(shares).reduce((a, b) => a + b, 0) || 1;
  const total = totalStrength(party);
  for (const current of party.currents) {
    const target = shares[current.id] / sum * total;
    current.strength = Math.round(clamp(current.strength * 0.55 + target * 0.45 + (current.id === outcome.winnerCurrentId ? 4 : 0), 6, 60));
  }
  party.leaderCurrentId = outcome.winnerCurrentId;
  party.leadershipContestWeek = week;
  const winner = party.currents.find(item => item.id === outcome.winnerCurrentId);
  // The bodies follow the vote: seats in proportion to the delegates, the winners first.
  party.organsCurrentId = outcome.winnerCurrentId;
  allocateSeats(party, life);
  for (const current of party.currents) {
    const actor = life.actors[current.id];
    const won = (outcome.winner.members ?? [outcome.winner.id]).includes(current.id);
    const seatShare = (life.organs.seats[current.id] ?? 0) / life.organs.total;
    const strength = strengthShare(party, current.id);
    if (won) { actor.loyalty = Math.round(clamp(actor.loyalty + 8)); actor.grievance = Math.round(clamp(actor.grievance - 15)); actor.momentum = round1(clamp(actor.momentum + 4, -15, 15)); }
    else { actor.grievance = Math.round(clamp(actor.grievance + 8 + Math.max(0, strength - seatShare) * 40 + (outcome.margin > 20 ? 4 : 0))); actor.loyalty = Math.round(clamp(actor.loyalty - 6)); actor.momentum = round1(clamp(actor.momentum - 3, -15, 15)); }
    // The committees follow the winners and resent the losers.
    for (const committee of committeesOf(org).filter(item => item.leader?.currentId === current.id)) committee.loyalty = Math.round(clamp(committee.loyalty + (won ? 6 : -6)));
    api.changeRelation(game, current.id, won ? 3 : -3);
  }
  // The pacts for the congress are settled: who backed the winner is rewarded, who backed the loser pays.
  for (const pact of life.pacts.filter(item => item.status === 'attivo' && item.kind === 'sostegno-congresso')) {
    const actor = life.actors[pact.actorId];
    const won = pact.actorId === outcome.winnerCurrentId;
    pact.status = won ? 'scaduto' : 'rotto'; pact.endedWeek = week; pact.settled = won ? 'vinto' : 'perso';
    if (actor && won) { actor.loyalty = Math.round(clamp(actor.loyalty + 8)); lines.push(`${party.currents.find(item => item.id === pact.actorId)?.label} ricorda chi l’ha sostenuta`); }
  }
  if (outcome.margin < 8) { org.conflicts.push({ id: `conflitto-${week}-congresso`, title: `Un congresso al fotofinish: ${winner.label} contro il resto`, currents: [winner.id, [...party.currents].filter(item => item.id !== winner.id).sort((a, b) => b.strength - a.strength)[0].id], intensity: 48, since: week, source: SIM }); lines.push('Congresso al fotofinish: lo scontro interno resta acceso'); }
  else for (const conflict of org.conflicts) conflict.intensity = Math.round(clamp(conflict.intensity - 12));
  org.conflicts = org.conflicts.filter(item => item.intensity > 5);
  org.cohesion = Math.round(clamp(org.cohesion + (outcome.margin >= 20 ? 4 : outcome.margin < 8 ? -4 : 1)));
  api.book(game, org, -Math.round(org.members * 0.35 + 600), 'formazione', 'Congresso');
  // The area that lost badly, with a grudge and a grievance, may think of leaving.
  for (const current of party.currents.filter(item => item.id !== outcome.winnerCurrentId && !(outcome.winner.members ?? []).includes(item.id))) {
    const actor = life.actors[current.id];
    if (actor.grievance >= 60 && actor.loyalty <= 45 && current.strength >= SPLIT_RULES.minStrength && outcome.margin >= 15) life.splitWatch[current.id] = { since: week, deadline: week + 8, from: 'congresso' };
  }
  api.remember(game, { date, kind: 'congresso', text: `Congresso: vince ${outcome.playerWon ? 'la tua linea' : winner.label} (${outcome.winner.pct}%)`, weight: 1.1, subject: outcome.winnerCurrentId });
  note(life, week, 'congresso', `Congresso: ${outcome.winner.label} al ${outcome.winner.pct}% (scarto ${outcome.margin} punti)`);
  lines.push(`Congresso: ${outcome.winner.label} al ${outcome.winner.pct}% dei delegati, scarto ${outcome.margin} punti`);
  life.lastCongress = { week, winnerId: outcome.winnerCurrentId, playerWon: outcome.playerWon, margin: outcome.margin, ranked: outcome.ranked.map(row => ({ id: row.id, label: row.label, pct: row.pct, delegates: row.delegates })), mode, source: SIM };
  life.congress = null;
  return lines;
}
// The player works for an area before the vote: quadri in movement or alliances woven.
export function congressWork(game, api, { kind, week }) {
  const party = game.party;
  const life = normalizeLife(party, { seed: game.seed ?? 1, week });
  const congress = life.congress;
  if (!congress) return ['Nessun congresso in preparazione.'];
  const aligned = party.alignedCurrentId;
  if (!aligned) return ['Non hai un’area di riferimento: nessuno da sostenere.'];
  if (kind === 'mobilita') { congress.mobilization[aligned] = round1(clamp((congress.mobilization[aligned] ?? 0) + 8, 0, 40)); congress.delegates = regionalDelegates(party, life, congress); return [`Mobiliti i quadri: ${party.currents.find(item => item.id === aligned)?.label} guadagna peso nelle federazioni`]; }
  const partner = [...party.currents].filter(item => item.id !== aligned).sort((a, b) => rel(b) - rel(a))[0];
  if (partner && !congress.alliances.some(al => al.ids.includes(aligned))) { congress.alliances.push({ ids: [aligned, partner.id], week, origin: 'giocatore' }); api.changeRelation(game, partner.id, 3); return [`Tessi un’intesa: ${party.currents.find(item => item.id === aligned)?.label} e ${partner.label} corrono insieme`]; }
  return ['L’area ha già un’alleanza: non resta altro da tessere per ora.'];
}

// ---------- splitting and leaving ----------
// An area at the end of its patience: it leaves unless the player holds it back. Returns the decisions to raise.
function tickSplits(game, life, api, week, date, rand, lines, raises, env) {
  const party = game.party;
  for (const [id, watch] of Object.entries(life.splitWatch)) {
    const actor = life.actors[id];
    const current = party.currents.find(item => item.id === id);
    if (!actor || !current) { delete life.splitWatch[id]; continue; }
    if (actor.grievance < 40 || actor.loyalty > 55) { delete life.splitWatch[id]; continue; }
    if (week < watch.deadline) continue;
    if (week - (life.lastSplitWeek ?? -99) < SPLIT_RULES.cooldownWeeks / 2) { watch.deadline = week + 4; continue; }
    // Not every threat is carried out: the angrier and the less loyal, the likelier the rupture; otherwise the area backs down.
    if (rand() > clamp((actor.grievance - 50) / 60 + (50 - actor.loyalty) / 100, 0.15, 0.85)) { actor.grievance = Math.round(clamp(actor.grievance - 15)); delete life.splitWatch[id]; lines.push(`${current.label} ripiega: per ora resta nel partito`); continue; }
    if (game.inbox.some(item => ['scissione-partito', 'scissione-subita'].includes(item.templateId))) continue;
    if (strengthShare(party, id) * 100 < SPLIT_RULES.minStrength || party.currents.length < 3 && strengthShare(party, id) > 0.5) { delete life.splitWatch[id]; continue; }
    const aligned = party.alignedCurrentId === id;
    raises.push({ id: aligned ? 'scissione-partito' : 'scissione-subita', params: { dedupe: `scissione-${id}-${week}`, currentId: id, current: current.label, title: `${current.label} lascia il partito`, body: `${actor.leaderLabel.split(' · ')[0]} ha deciso: l’area (${Math.round(strengthShare(party, id) * 100)}% del partito, malcontento ${actor.grievance}/100) esce con i suoi comitati, una parte degli iscritti e dei parlamentari${aligned ? '. Sei dalla sua parte: puoi seguirla e fondare il nuovo partito, trattenerla o restare' : ''}.` }, urgent: true });
    life.lastSplitWeek = week;
    delete life.splitWatch[id];
  }
  // Spontaneous break-up of a party in trouble (no deadline): rare, and only with the ingredients present.
  if (!Object.keys(life.splitWatch).length && week - (life.lastSplitWeek ?? -99) > SPLIT_RULES.cooldownWeeks) {
    for (const actor of Object.values(life.actors)) {
      const current = party.currents.find(item => item.id === actor.id);
      if (!current || party.leaderCurrentId === actor.id) continue;
      if (actor.grievance >= SPLIT_RULES.minGrievance && actor.loyalty <= SPLIT_RULES.maxLoyalty && current.strength >= SPLIT_RULES.minStrength && (party.org.cohesion ?? 55) < 45 && rand() < 0.006 + actor.temper / 6000) { life.splitWatch[actor.id] = { since: week, deadline: week + 3, from: 'tensione' }; lines.push(`${current.label} medita la rottura`); break; }
    }
  }
}

// A party with few areas sees a new one grow (a young generation, a civic wing): it keeps the internal life going.
function tickEmergence(game, life, api, week, date, rand, lines) {
  const party = game.party;
  if (party.currents.length >= 3 || party.affiliation === 'founder' && party.currents.length >= 2) return;
  if (week - (life.lastSplitWeek ?? -99) < 20 || week - (life.lastEmergenceWeek ?? -99) < 40 || rand() >= 0.05) return;
  const used = new Set(party.currents.map(item => item.label));
  const label = EMERGING_AREAS.find(item => !used.has(item)) ?? `Area ${week}`;
  const id = `area-${String(label).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  if (party.currents.some(item => item.id === id)) return;
  const strength = 12 + Math.floor(rand() * 8);
  for (const current of party.currents) current.strength = Math.max(6, Math.round(current.strength * (100 - strength) / 100));
  party.currents.push({ id, label, strength, value: 50, relation: 50, source: SIM });
  life.lastEmergenceWeek = week;
  syncActors(party, life, game.seed ?? 1, week);
  note(life, week, 'area', `Nasce una nuova area interna: ${label}`);
  lines.push(`Nasce una nuova area interna: ${label} (${strength}%)`);
}

// ---------- rebuilding in opposition ----------
function tickRebuild(game, life, api, week, date, lines, raises, env) {
  const party = game.party;
  const org = party.org;
  const rebuild = life.rebuild;
  if (rebuild) {
    const spec = REBUILD_FOCUS[rebuild.focus];
    const w = spec.weekly;
    if (w.vitality) for (const section of org.sections) section.vitality = Math.round(clamp(section.vitality + w.vitality));
    if (w.members) for (const section of org.sections) section.members = Math.max(5, Math.round(section.members * (1 + w.members)));
    if (w.militants) org.militants = Math.min(org.members, Math.round(org.militants + org.members * w.militants));
    if (w.loyalty) for (const actor of Object.values(life.actors)) actor.loyalty = Math.round(clamp(actor.loyalty + w.loyalty));
    if (w.cohesion) org.cohesion = Math.round(clamp(org.cohesion + w.cohesion));
    if (w.support) party.support = clamp(Math.round((party.support + w.support) * 100) / 100);
    if (w.treasury) api.book(game, org, w.treasury, 'donazioni', 'Sottoscrizioni della ricostruzione');
    org.members = org.sections.reduce((sum, item) => sum + item.members, 0);
    rebuild.progress = Math.min(100, Math.round((week - rebuild.since) / REBUILD_WEEKS * 100));
    if (week - rebuild.since >= REBUILD_WEEKS || env.signals?.partyGoverning) {
      api.remember(game, { date, kind: 'ricostruzione', text: `Ricostruzione del partito conclusa: ${spec.label.toLowerCase()}`, weight: 1 });
      note(life, week, 'ricostruzione', `Conclusa: ${spec.label}`);
      lines.push(`Ricostruzione conclusa: ${spec.label.toLowerCase()}`);
      life.rebuild = null; life.lastRebuildWeek = week;
    }
    return;
  }
  const opposition = env.signals?.partyGoverning === false;
  const declining = life.vitals && (life.vitals.trend === 'declino' || life.vitals.stability < 45);
  if (opposition && declining && isSecretary(party) && week - (life.lastRebuildWeek ?? -99) > 60 && week - (life.lastRebuildOfferWeek ?? -99) > 26 && !game.inbox.some(item => item.templateId === 'ricostruzione-partito')) {
    life.lastRebuildOfferWeek = week;
    raises.push({ id: 'ricostruzione-partito', params: {}, urgent: false });
  }
}
export function startRebuild(game, api, { focus, week, date }) {
  const party = game.party;
  const life = normalizeLife(party, { seed: game.seed ?? 1, week });
  if (!REBUILD_FOCUS[focus]) throw new Error('Piano di ricostruzione non riconosciuto.');
  if (life.rebuild) throw new Error('Un piano di ricostruzione è già in corso.');
  life.rebuild = { focus, since: week, progress: 0, source: SIM };
  note(life, week, 'ricostruzione', `Avviata: ${REBUILD_FOCUS[focus].label}`);
  api.remember(game, { date, kind: 'ricostruzione', text: `Avviato il piano di ricostruzione: ${REBUILD_FOCUS[focus].label.toLowerCase()}`, weight: 0.5 });
  return [`Piano di ricostruzione: ${REBUILD_FOCUS[focus].label}`];
}

// ---------- the week ----------
// One week of internal life. Returns the lines for the report, the decisions to raise and the vitals.
export function advanceLife(game, api, { week, date, rand, env = {} }) {
  const party = game.party;
  if (!party?.org) return { lines: [], raises: [], specials: [] };
  const life = normalizeLife(party, { seed: game.seed ?? 1, week });
  const lines = [], raises = [], specials = [];
  api.date = date;
  syncCadres(game, life, week);
  allocateSeats(party, life);
  tickActors(game, life, api, week, date, rand, lines);
  raises.push(...tickCadres(game, life, api, week, rand, lines));
  // The external proposals (a merger) arrive from the political world, for the party that has a secretary.
  const neighbours = env.signals?.neighbours ?? [];
  if (isSecretary(party) && neighbours.length && !life.requests.some(item => item.kind === 'fusione') && week - (life.lastMergerWeek ?? -99) > 78 && rand() < 0.01 && life.requests.filter(item => OPEN.includes(item.stage)).length < MAX_OPEN) {
    const external = neighbours[Math.floor(rand() * neighbours.length)];
    const request = openRequest(life, game, { kind: 'fusione', from: 'external', refId: external.id, week, rand, api, external });
    if (request) { life.lastMergerWeek = week; lines.push(`Proposta di fusione da ${external.label}`); }
  }
  tickPacts(game, life, api, week, date, rand, lines, raises);
  tickCongress(game, life, api, week, date, rand, lines, raises);
  tickSplits(game, life, api, week, date, rand, lines, raises, env);
  tickEmergence(game, life, api, week, date, rand, lines);
  life.vitals = computeVitals(party, life);
  tickRebuild(game, life, api, week, date, lines, raises, env);
  surfaceRequests(life, game, week, raises);
  allocateSeats(party, life);
  return { lines, raises, specials };
}

// Delays that lapse and requests answered by the week's close: an unanswered ultimatum puts the area on the way out.
export function lapseAnswer(game, api, { requestId, week, date }) {
  const life = game.party?.life;
  const request = life?.requests.find(item => item.id === requestId);
  if (!request) return;
  request.delays += 1;
  const actor = life.actors[request.refId];
  if (actor) actor.grievance = Math.round(clamp(actor.grievance + 1.5));
}

// ---------- what the player sees ----------
export function lifeOverview(game) {
  const party = game?.party;
  const life = party?.life;
  if (!life) return null;
  const secretary = isSecretary(party);
  const currents = currentsOf(party).map(current => {
    const actor = life.actors[current.id];
    return {
      id: current.id, label: current.label, strength: current.strength, share: Math.round(strengthShare(party, current.id) * 100), relation: Math.round(rel(current)), seats: life.organs.seats[current.id] ?? 0,
      ruling: party.leaderCurrentId === current.id, aligned: party.alignedCurrentId === current.id,
      persona: actor ? ACTOR_PERSONAS[actor.persona]?.label : null, trait: actor ? ACTOR_PERSONAS[actor.persona]?.trait : null, leader: actor?.leaderLabel ?? null, priority: actor?.priority ?? null,
      line: actor?.line ?? null, areas: actor?.areas ?? [], loyalty: Math.round(actor?.loyalty ?? 50), grievance: Math.round(actor?.grievance ?? 20), stance: actor?.stance ?? 'neutrale', momentum: actor?.momentum ?? 0,
      granted: actor?.granted ?? 0, refused: actor?.refused ?? 0,
      pacts: life.pacts.filter(pact => pact.status === 'attivo' && pact.actorId === current.id).map(pact => pact.title),
      leaving: Boolean(life.splitWatch[current.id])
    };
  });
  const phaseSpec = life.congress ? CONGRESS_PHASES.find(item => item.id === congressPhaseOf(life.congress, game.week.index)) : null;
  return {
    secretary, currents, vitals: life.vitals, organs: life.organs,
    requests: life.requests.filter(item => OPEN.includes(item.stage)).map(item => ({ id: item.id, kind: item.kind, label: REQUEST_KINDS[item.kind]?.label ?? item.kind, title: item.title, body: item.counter?.body ?? item.body, stage: item.stage, dueWeek: item.dueWeek, weeksLeft: Math.max(0, item.dueWeek - game.week.index), refId: item.refId, from: item.from })),
    pacts: life.pacts.map(pact => ({ id: pact.id, kind: pact.kind, title: pact.title, actor: party.currents.find(item => item.id === pact.actorId)?.label ?? pact.actorId, status: pact.status, since: pact.since, until: pact.until, weeksLeft: Math.max(0, pact.until - game.week.index), gives: PACT_KINDS[pact.kind]?.gives, asks: PACT_KINDS[pact.kind]?.asks, renewals: pact.renewals, settled: pact.settled ?? null })),
    congress: life.congress ? { id: life.congress.id, voteWeek: life.congress.voteWeek, weeksLeft: Math.max(0, life.congress.voteWeek - game.week.index), phase: phaseSpec?.id, phaseLabel: phaseSpec?.label, phaseDetail: phaseSpec?.detail, schedule: life.congress.schedule.map(item => ({ ...item, label: CONGRESS_PHASES.find(spec => spec.id === item.id)?.label })), delegates: life.congress.delegates ? { total: life.congress.delegates.total, byCurrent: life.congress.delegates.byCurrent, player: life.congress.delegates.player } : null, alliances: life.congress.alliances.map(al => ({ ids: al.ids, labels: al.ids.map(id => party.currents.find(item => item.id === id)?.label ?? id), origin: al.origin })), notes: life.congress.notes.slice(-4), projection: projectCongress(game, { mode: secretary ? 'incumbent' : 'support' }) } : null,
    nextCongressWeek: party.org?.congress?.nextWeek ?? null, lastCongress: life.lastCongress,
    cadres: life.cadres.filter(item => item.status !== 'uscito').map(item => {
      const committee = party.org?.committees?.find(entry => entry.id === item.committeeId) ?? null;
      const stance = committee ? leaderStance(committee, { party, cadre: item }) : null;
      return {
        id: item.id, name: item.name, level: item.level, region: item.region, label: item.label, interest: CADRE_INTERESTS[item.interest]?.label, loyalty: Math.round(item.loyalty), grievance: Math.round(item.grievance), ambition: Math.round(item.ambition ?? 50), status: item.status, player: item.player, committeeId: item.committeeId,
        area: item.currentId ? party.currents.find(entry => entry.id === item.currentId)?.label ?? null : null, stance: stance ? { id: stance.id, label: stance.label, tone: stance.tone, weight: stance.weight, reasons: stance.reasons } : null,
        autonomy: committee ? Math.round(committee.autonomy ?? 50) : null, organization: committee ? Math.round(committee.organization ?? 0) : null,
        promise: item.promise ? { electionId: item.promise.electionId ?? null, weeksLeft: Math.max(0, item.promise.until - game.week.index) } : null
      };
    }),
    control: territorialControl(party, { region: game.place?.region ?? null }),
    rebuild: life.rebuild ? { ...life.rebuild, label: REBUILD_FOCUS[life.rebuild.focus]?.label, weeksLeft: Math.max(0, life.rebuild.since + REBUILD_WEEKS - game.week.index) } : null,
    closed: life.closed.slice(0, 6), history: life.history.slice(0, 10)
  };
}
export const lifeKinds = REQUEST_KINDS;
export { requestWeights as lifeRequestWeights, tally as lifeTally, regionalDelegates as lifeDelegates };
