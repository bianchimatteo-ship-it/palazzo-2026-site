import { advanceDays } from './time.js?v=20260924-5';
import { ELECTION_MODELS } from '../data/simulation/campaign-rules.js?v=20260924-5';
import { activeMinisters, governingGroupIds, playerInMajority } from './parliament-engine.js?v=20260924-5';
import {
  APPOINTMENTS, BASE_WEEKLY_INCOME, CAREER_EVENTS, CAREER_OBJECTIVES, CURRENT_TEMPLATES, EARLY_ELECTION_AFTER_WEEKS, ELECTION_SCHEDULE,
  FORCED_EVENTS, LEGACY_RIVAL_NAMES, SIMULATED_RIVAL_LABEL, FOUNDER_RANK, LEVEL_FIRST_ELECTION, OFFICE_INCOME, PARTY_RANKS, RELATION_TEMPLATES, STAT_LABELS,
  WEEKLY_ACTION_POINTS, WEEKLY_ACTIVITIES
} from '../data/simulation/career-rules.js?v=20260924-5';

const SIM = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round2 = value => Math.round(value * 100) / 100;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const signed = value => `${value > 0 ? '+' : ''}${String(round2(value)).replace('.', ',')}`;
const LOCAL_EVENTS = ['protesta', 'maltempo', 'sindacati-vertenza'];
const RELATION_BASES = Object.fromEntries(RELATION_TEMPLATES.map(item => [item.id, item.base]));

function draw(game) {
  game.rngState = (Math.imul(game.rngState, 1664525) + 1013904223) >>> 0;
  return game.rngState / 4294967296;
}

// ---------- situation ----------
export function situation(ctx, env = {}) {
  const parliament = ctx.parliament;
  const seat = Boolean(parliament?.player?.groupId);
  const governing = ['active', 'crisis'].includes(parliament?.government?.status);
  return {
    game: ctx.game, stats: ctx.stats, seat, governing,
    inMajority: seat && playerInMajority(parliament),
    minister: governing && activeMinisters(parliament.government).some(item => item.playerAppointed),
    party: Boolean(ctx.game.party), member: ctx.game.party?.affiliation === 'member',
    campaignActive: env.campaign?.status === 'active'
  };
}
function meets(requirement, sit) {
  if (!requirement) return true;
  if (typeof requirement === 'function') return requirement(sit);
  return Boolean(sit[requirement]);
}
const requirementReason = { member: 'Serve l’iscrizione a un partito.', party: 'Serve un partito.', seat: 'Serve un seggio con un gruppo parlamentare.', minister: 'Serve un incarico di governo.' };

// ---------- creation ----------
function createPartyState(party, seed) {
  if (!party?.id) return null;
  const shares = [[40, 34, 26], [38, 36, 26], [44, 30, 26], [36, 33, 31]][seed % 4];
  const order = [0, 1, 2].sort((a, b) => ((seed >> (a + 3)) & 7) - ((seed >> (b + 3)) & 7));
  const currents = CURRENT_TEMPLATES.map((item, index) => ({ ...item, strength: shares[order[index]], value: 50, relation: 50, source: SIM }));
  const leader = [...currents].sort((a, b) => b.strength - a.strength)[0];
  const founder = Boolean(party.founder);
  return {
    partyId: party.id, label: party.label ?? null, affiliation: founder ? 'founder' : 'member',
    rank: founder ? FOUNDER_RANK.level : 0, rankTitle: founder ? FOUNDER_RANK.title : PARTY_RANKS[0].title,
    support: founder ? 70 : 50, currents, leaderCurrentId: leader.id, alignedCurrentId: null,
    leadershipContestWeek: null, lastRankContestWeek: null, joinedAt: party.joinedAt ?? null, history: [], source: SIM
  };
}
function makeElection(type, windowOpensAt, place = {}, early = false) {
  const model = ELECTION_MODELS[type];
  const labels = { comunale: `Comunali · ${place.municipality || 'il tuo comune'}`, regionale: `Regionali · ${place.region || 'la tua regione'}`, politiche: early ? 'Politiche anticipate' : 'Elezioni politiche', europee: 'Elezioni europee' };
  return {
    id: `elezione-${type}-${windowOpensAt}`, type, label: labels[type], windowOpensAt,
    windowClosesAt: advanceDays(windowOpensAt, ELECTION_SCHEDULE[type].windowDays), electionDate: advanceDays(windowOpensAt, model.campaignDays),
    status: 'upcoming', campaignId: null, early, source: SIM
  };
}

export function createGameState({ seedText, currentDate, level, party = null, place = {}, stats = {}, parliament = null, funds = null }) {
  const seed = hash(seedText);
  const member = party?.id && !party.founder;
  const relations = RELATION_TEMPLATES.filter(item => item.requires !== 'member' || member).map(item => ({
    id: item.id, label: item.id === 'rival' ? SIMULATED_RIVAL_LABEL : item.label,
    kind: item.kind, value: item.base, source: SIM
  }));
  const elections = Object.keys(ELECTION_SCHEDULE).map(type => makeElection(type, advanceDays(currentDate, 7 * (LEVEL_FIRST_ELECTION[level]?.[type] ?? ELECTION_SCHEDULE[type].firstWeeks)), place));
  const startingFunds = funds ?? ({ comunale: 1500, regionale: 2500, deputato: 4000, senatore: 4000 }[level] ?? 2000);
  const game = {
    version: 1, source: SIM, status: 'active', seed, rngState: seed, place,
    week: { index: 1, startedAt: currentDate, ap: WEEKLY_ACTION_POINTS, maxAp: WEEKLY_ACTION_POINTS, categoriesUsed: [] },
    resources: { funds: startingFunds, politicalCapital: clamp(Math.round(parliament?.resources?.politicalCapital ?? stats.influence ?? 30), 0, 100), source: SIM },
    prep: 0, relations, party: createPartyState(party, seed), pastParties: [], elections,
    inbox: [], log: [], objectives: {}, flags: {}, lastReport: null, weekStartStats: { ...stats }, lastEventId: null,
    fallenWeeks: 0, endedAt: null, endReason: null
  };
  const ctx = { game, stats: { ...stats }, parliament };
  refreshObjectives(ctx, {}, [], currentDate);
  fillInbox(ctx, {}, []);
  return game;
}

export function normalizeGameState(game) {
  if (!game || typeof game !== 'object') return null;
  return {
    status: 'active', prep: 0, pastParties: [], inbox: [], log: [], objectives: {}, flags: {}, lastReport: null, lastEventId: null, fallenWeeks: 0, place: {},
    ...game,
    week: { ap: WEEKLY_ACTION_POINTS, maxAp: WEEKLY_ACTION_POINTS, categoriesUsed: [], ...(game.week ?? {}) },
    resources: { funds: 0, politicalCapital: 30, source: SIM, ...(game.resources ?? {}) },
    // Older saves named the rival with a realistic invented name: it becomes an explicit simulated role.
    relations: Array.isArray(game.relations) ? game.relations.map(item => item.id === 'rival' && LEGACY_RIVAL_NAMES.includes(item.label) ? { ...item, label: SIMULATED_RIVAL_LABEL } : item) : [],
    elections: Array.isArray(game.elections) ? game.elections : []
  };
}

// ---------- effects ----------
function relationList(game) { return [...game.relations, ...(game.party?.currents ?? [])]; }
function changeRelation(game, id, delta) {
  const item = relationList(game).find(entry => entry.id === id);
  if (!item || !delta) return null;
  item.value = clamp(round2((item.value ?? item.relation ?? 50) + delta));
  if ('relation' in item) item.relation = item.value;
  return item;
}
function applyEffects(ctx, effects = {}, targetId = null, lines = []) {
  const { game } = ctx;
  for (const [metric, delta] of Object.entries(effects.stats ?? {})) {
    if (!delta || !(metric in ctx.stats || STAT_LABELS[metric])) continue;
    ctx.stats[metric] = clamp(round2((ctx.stats[metric] ?? 0) + delta));
    lines.push(`${STAT_LABELS[metric]} ${signed(delta)}`);
  }
  if (effects.funds) { game.resources.funds = Math.max(0, Math.round(game.resources.funds + effects.funds)); lines.push(`Fondi ${effects.funds > 0 ? '+' : '−'}${Math.abs(effects.funds)} €`); }
  if (effects.capital) { game.resources.politicalCapital = clamp(game.resources.politicalCapital + effects.capital); lines.push(`Capitale politico ${signed(effects.capital)}`); }
  if (effects.prep) { game.prep = clamp(game.prep + effects.prep); lines.push(`Preparazione elettorale ${signed(effects.prep)}`); }
  for (const [key, delta] of Object.entries(effects.relations ?? {})) {
    if (key === 'otherCurrents') { for (const current of game.party?.currents ?? []) if (current.id !== targetId) changeRelation(game, current.id, delta); continue; }
    const item = changeRelation(game, key === 'target' ? targetId : key, delta);
    if (item) lines.push(`${item.label} ${signed(delta)}`);
  }
  if (effects.party?.support && game.party) { game.party.support = clamp(round2(game.party.support + effects.party.support)); lines.push(`Sostegno nel partito ${signed(effects.party.support)}`); }
  const parliament = ctx.parliament;
  if (effects.group?.support && parliament?.careerStanding) { parliament.careerStanding.partySupport = clamp(round2(parliament.careerStanding.partySupport + effects.group.support)); lines.push(`Sostegno nel gruppo ${signed(effects.group.support)}`); }
  for (const [key, delta] of Object.entries(effects.groups ?? {})) {
    if (!parliament?.relations) continue;
    const ids = key === 'target' ? [targetId] : key === 'coalition' ? [...governingGroupIds(parliament)].filter(id => id !== parliament.player?.groupId) : [key];
    for (const id of ids) if (parliament.relations[id]) parliament.relations[id] = { ...parliament.relations[id], value: clamp(parliament.relations[id].value + delta) };
    if (ids.length) lines.push(`${key === 'coalition' ? 'Rapporti con la maggioranza' : 'Rapporto con il gruppo'} ${signed(delta)}`);
  }
  if (effects.government?.stability && ['active', 'crisis'].includes(parliament?.government?.status)) {
    parliament.government.stability = clamp(Math.round((parliament.government.stability ?? 50) + effects.government.stability));
    lines.push(`Stabilità del governo ${signed(effects.government.stability)}`);
  }
  return lines;
}
export function costProblem(game, cost = {}) {
  if (cost.ap && game.week.ap < cost.ap) return `Servono ${cost.ap} giorni: questa settimana ne restano ${game.week.ap}.`;
  if (cost.funds && game.resources.funds < cost.funds) return `Servono ${cost.funds} € di fondi.`;
  if (cost.capital && game.resources.politicalCapital < cost.capital) return `Servono ${cost.capital} punti di capitale politico.`;
  return null;
}
function pay(game, cost = {}) {
  if (cost.ap) game.week.ap -= cost.ap;
  if (cost.funds) game.resources.funds -= cost.funds;
  if (cost.capital) game.resources.politicalCapital -= cost.capital;
}
function addLog(game, date, kind, title, lines = [], tone = 'neutral') {
  game.log.unshift({ id: `diario-${game.week.index}-${game.log.length}-${game.rngState % 9973}`, week: game.week.index, date, kind, title, lines, tone, source: SIM });
  game.log = game.log.slice(0, 40);
}
function start(ctx) {
  const next = { game: copy(ctx.game), stats: { ...ctx.stats }, parliament: copy(ctx.parliament) };
  if (next.game.status === 'ended') throw new Error('La carriera è conclusa: inizia una nuova partita.');
  return next;
}

// Time spent on parliamentary work comes out of the same week.
export function spendTime(game, ap) {
  if (game.status === 'ended') throw new Error('La carriera è conclusa: inizia una nuova partita.');
  if (!ap) return game;
  if (game.week.ap < ap) throw new Error(`Non hai più tempo questa settimana (servono ${ap} giorni). Chiudi la settimana per continuare.`);
  return { ...game, week: { ...game.week, ap: game.week.ap - ap, categoriesUsed: [...new Set([...(game.week.categoriesUsed ?? []), 'parlamento'])] } };
}

// ---------- activities ----------
export function activityProblem(ctx, env, activity) {
  const sit = situation(ctx, env);
  if (ctx.game.status === 'ended') return 'La carriera è conclusa.';
  if (sit.campaignActive && activity.category !== 'parlamento') return 'In campagna: usa le attività della sezione Elezioni.';
  if (!meets(activity.requires, sit)) return requirementReason[activity.requires] ?? 'Non disponibile ora.';
  return costProblem(ctx.game, activity.cost);
}
export function performActivity(input, env, activityId, targetId = null) {
  const ctx = start(input);
  const activity = WEEKLY_ACTIVITIES.find(item => item.id === activityId);
  if (!activity) throw new Error('Attività non riconosciuta.');
  const problem = activityProblem(ctx, env, activity);
  if (problem) throw new Error(problem);
  if (activity.target === 'current' && !ctx.game.party?.currents.some(item => item.id === targetId)) throw new Error('Scegli una corrente del partito.');
  if (activity.target === 'character' && !ctx.game.relations.some(item => item.id === targetId)) throw new Error('Scegli con chi parlare.');
  if (activity.target === 'group' && !ctx.parliament?.relations?.[targetId]) throw new Error('Scegli un gruppo parlamentare.');
  pay(ctx.game, activity.cost);
  ctx.game.week.categoriesUsed = [...new Set([...ctx.game.week.categoriesUsed, activity.category])];
  const lines = applyEffects(ctx, activity.effects, targetId);
  let tone = 'good';
  if (activity.risk && draw(ctx.game) < activity.risk.chance) {
    lines.push(activity.risk.label);
    applyEffects(ctx, activity.risk.effects, targetId, lines);
    tone = 'bad';
  }
  addLog(ctx.game, env.currentDate, 'attività', activity.label, lines, tone);
  const completed = refreshObjectives(ctx, env, [], env.currentDate);
  return { ctx, report: { title: activity.label, lines, tone }, completed };
}

// ---------- inbox ----------
function fill(text, params = {}) {
  return String(text).replace(/\{(\w+)\}/g, (match, key) => params[key] ?? match);
}
function templateFor(item) {
  if (item.kind === 'appuntamento') return APPOINTMENTS.find(entry => entry.id === item.templateId);
  if (item.kind === 'urgente') return FORCED_EVENTS[item.templateId];
  return CAREER_EVENTS.find(entry => entry.id === item.templateId);
}
function instantiate(template, kind, ctx, params) {
  return {
    id: `agenda-${ctx.game.week.index}-${template.id}-${ctx.game.rngState % 100000}`, kind, templateId: template.id,
    title: fill(template.title, params), body: fill(template.body, params), params,
    choices: template.choices.map(choice => ({ id: choice.id, label: fill(choice.label, params), cost: choice.cost ?? null })),
    defaultChoice: template.defaultChoice ?? template.choices.at(-1).id, week: ctx.game.week.index, source: SIM
  };
}
function eventParams(ctx) {
  const game = ctx.game;
  const currents = [...(game.party?.currents ?? [])].sort((a, b) => b.strength - a.strength);
  return {
    municipality: game.place.municipality || 'il tuo comune', region: game.place.region || 'la tua regione',
    rival: 'il tuo rivale interno', party: game.party?.label || 'il partito',
    currentA: currents[0]?.label, currentB: currents[1]?.label, currentAId: currents[0]?.id, currentBId: currents[1]?.id
  };
}
function raiseForced(ctx, id) {
  if (ctx.game.inbox.some(item => item.templateId === id)) return;
  ctx.game.inbox.unshift(instantiate(FORCED_EVENTS[id], 'urgente', ctx, eventParams(ctx)));
}
function fillInbox(ctx, env, lines) {
  const game = ctx.game;
  const sit = situation(ctx, env);
  const params = eventParams(ctx);
  const recent = game.lastAppointmentIds ?? [];
  const appointments = APPOINTMENTS.filter(item => meets(item.when, sit) && !recent.includes(item.id));
  const picked = [];
  for (let count = 0; count < 2 && appointments.length; count++) {
    const [item] = appointments.splice(Math.floor(draw(game) * appointments.length), 1);
    picked.push(item.id);
    game.inbox.push(instantiate(item, 'appuntamento', ctx, params));
  }
  game.lastAppointmentIds = picked;
  const events = CAREER_EVENTS.filter(item => item.id !== game.lastEventId && meets(item.when, sit) && !(item.id === 'congresso' && !params.currentB));
  if (events.length && draw(game) < 0.6) {
    const total = events.reduce((sum, item) => sum + item.weight, 0);
    let pick = draw(game) * total;
    const event = events.find(item => (pick -= item.weight) < 0) ?? events[0];
    game.inbox.push(instantiate(event, 'evento', ctx, params));
    game.lastEventId = event.id;
    lines.push(`Nuova decisione: ${fill(event.title, params)}`);
  }
}
// The political world can ask for a reaction: it lands in the week's agenda like any other event.
export function addWorldReaction(input, reaction) {
  const game = copy(input);
  if (game.status === 'ended' || game.inbox.some(item => item.templateId === 'presa-posizione')) return game;
  const template = CAREER_EVENTS.find(entry => entry.id === 'presa-posizione');
  const ctx = { game };
  game.inbox.push(instantiate(template, 'evento', ctx, { event: reaction.title, eventBody: reaction.body }));
  return game;
}
export function describeEffects(effects = {}) {
  const parts = [];
  for (const [metric, delta] of Object.entries(effects.stats ?? {})) parts.push(`${STAT_LABELS[metric]} ${signed(delta)}`);
  if (effects.funds) parts.push(`Fondi ${signed(effects.funds)} €`);
  if (effects.capital) parts.push(`Capitale ${signed(effects.capital)}`);
  if (effects.prep) parts.push(`Preparazione ${signed(effects.prep)}`);
  for (const [key, delta] of Object.entries(effects.relations ?? {})) parts.push(`${key === 'target' ? 'Rapporto scelto' : key === 'otherCurrents' ? 'Altre correnti' : RELATION_TEMPLATES.find(entry => entry.id === key)?.label ?? 'Rapporto'} ${signed(delta)}`);
  if (effects.party?.support) parts.push(`Sostegno nel partito ${signed(effects.party.support)}`);
  if (effects.group?.support) parts.push(`Sostegno nel gruppo ${signed(effects.group.support)}`);
  if (effects.groups?.target) parts.push(`Rapporto con il gruppo ${signed(effects.groups.target)}`);
  if (effects.groups?.coalition) parts.push(`Maggioranza ${signed(effects.groups.coalition)}`);
  if (effects.government?.stability) parts.push(`Stabilità governo ${signed(effects.government.stability)}`);
  return parts.join(' · ');
}
export function describeChoice(item, choiceId) {
  const choice = templateFor(item)?.choices.find(entry => entry.id === choiceId);
  if (!choice) return { effects: '', risk: '' };
  const risk = choice.risk ? `Rischio ${Math.round(choice.risk.chance * 100)}%` : choice.special?.startsWith('world-stance') ? 'Sposta i sondaggi del partito' : choice.outcomes ? 'Esito incerto' : choice.special?.startsWith('leadership') ? 'Esito legato al congresso' : choice.special === 'leave-party' ? 'Lasci il partito' : choice.special === 'resign' ? 'Lasci gli incarichi' : '';
  return { effects: describeEffects(choice.effects), risk };
}
function runChoice(ctx, env, item, choice, lines, specials) {
  let tone = 'neutral';
  applyEffects(ctx, choice.effects, null, lines);
  if (choice.outcomes) {
    let roll = draw(ctx.game);
    const outcome = choice.outcomes.find(entry => (roll -= entry.chance) < 0) ?? choice.outcomes.at(-1);
    lines.push(outcome.label);
    applyEffects(ctx, outcome.effects, null, lines);
    if (outcome.special) handleSpecial(ctx, env, outcome.special, item, lines, specials);
    tone = outcome.special || Object.values(outcome.effects?.stats ?? {}).some(value => value < -2) ? 'bad' : 'good';
  }
  if (choice.risk && draw(ctx.game) < choice.risk.chance) { lines.push(choice.risk.label); applyEffects(ctx, choice.risk.effects, null, lines); tone = 'bad'; }
  if (choice.special) handleSpecial(ctx, env, choice.special, item, lines, specials);
  return tone;
}
export function resolveInboxItem(input, env, itemId, choiceId) {
  const ctx = start(input);
  const item = ctx.game.inbox.find(entry => entry.id === itemId);
  if (!item) throw new Error('Questa decisione non è più disponibile.');
  const choice = templateFor(item)?.choices.find(entry => entry.id === choiceId);
  if (!choice) throw new Error('Scelta non valida.');
  const problem = costProblem(ctx.game, choice.cost);
  if (problem) throw new Error(problem);
  pay(ctx.game, choice.cost);
  const template = templateFor(item);
  const local = item.kind === 'appuntamento' ? !['seat', 'minister'].includes(template.when) : LOCAL_EVENTS.includes(item.templateId);
  if (choice.cost?.ap && local) ctx.game.week.categoriesUsed = [...new Set([...ctx.game.week.categoriesUsed, 'territorio'])];
  const lines = [];
  const specials = [];
  const tone = runChoice(ctx, env, item, choice, lines, specials);
  ctx.game.inbox = ctx.game.inbox.filter(entry => entry.id !== itemId);
  addLog(ctx.game, env.currentDate, item.kind, `${item.title} — ${fill(choice.label, item.params)}`, lines, tone);
  const completed = refreshObjectives(ctx, env, [], env.currentDate);
  return { ctx, report: { title: fill(choice.label, item.params), lines, tone }, specials, completed };
}

function leaveParty(ctx, reason) {
  const party = ctx.game.party;
  if (!party) return;
  ctx.game.pastParties.push({ partyId: party.partyId, label: party.label, rankTitle: party.rankTitle, reason, leftAtWeek: ctx.game.week.index, source: SIM });
  ctx.game.party = null;
  ctx.game.relations = ctx.game.relations.filter(item => item.id !== 'leadership');
}
function handleSpecial(ctx, env, special, item, lines, specials) {
  const game = ctx.game;
  if (special === 'leadership-a' || special === 'leadership-b') {
    const backed = special === 'leadership-a' ? item.params.currentAId : item.params.currentBId;
    const [a, b] = [item.params.currentAId, item.params.currentBId].map(id => game.party.currents.find(entry => entry.id === id));
    const winner = draw(game) < a.strength / (a.strength + b.strength) ? a : b;
    winner.strength = Math.min(60, winner.strength + 8);
    game.party.leaderCurrentId = winner.id;
    game.party.alignedCurrentId = backed;
    game.party.leadershipContestWeek = game.week.index;
    const leadership = game.relations.find(entry => entry.id === 'leadership');
    if (winner.id === backed) {
      game.party.support = clamp(game.party.support + 8);
      if (leadership) leadership.value = Math.max(leadership.value, 62);
      changeRelation(game, winner.id, 8);
      lines.push(`${winner.label} vince il congresso: sei dalla parte giusta (sostegno +8).`);
    } else {
      game.party.support = clamp(game.party.support - 6);
      if (leadership) leadership.value = Math.min(leadership.value, 38);
      changeRelation(game, backed, 4);
      lines.push(`${winner.label} vince il congresso: la nuova leadership non dimentica (sostegno −6).`);
    }
  } else if (special === 'world-stance-proposal' || special === 'world-stance-attack') {
    specials.push({ type: 'world-stance', delta: special === 'world-stance-proposal' ? 0.4 : 0.25, title: item.params.event });
  } else if (special === 'flag-opaque-funding') {
    game.flags.opaqueFunding = game.week.index;
  } else if (special === 'leave-party') {
    lines.push('Lasci il partito: prosegui da indipendente.');
    leaveParty(ctx, 'Uscita volontaria');
    specials.push({ type: 'party-left' });
  } else if (special === 'expel') {
    lines.push('Espulsione dal partito: prosegui da indipendente.');
    leaveParty(ctx, 'Espulsione');
    specials.push({ type: 'party-left' });
  } else if (special === 'resign') {
    lines.push('Lasci gli incarichi istituzionali in corso.');
    specials.push({ type: 'resign' });
  } else if (special === 'end-career') {
    endCareer(game, env.currentDate, 'Travolto dalla crisi di reputazione');
  }
}
function endCareer(game, date, reason) {
  game.status = 'ended';
  game.endedAt = date;
  game.endReason = reason;
  game.inbox = [];
  addLog(game, date, 'fine', 'La carriera si chiude', [reason], 'bad');
}

// ---------- party ----------
export function nextPartyRank(game) {
  if (game.party?.affiliation !== 'member') return null;
  return PARTY_RANKS[game.party.rank + 1] ?? null;
}
export function partyContestScore(ctx) {
  const party = ctx.game.party;
  const leadership = ctx.game.relations.find(item => item.id === 'leadership')?.value ?? 50;
  return Math.round(party.support * 0.45 + leadership * 0.35 + (ctx.stats.influence ?? 30) * 0.2 + (party.alignedCurrentId && party.alignedCurrentId === party.leaderCurrentId ? 4 : 0));
}
export function contestPartyRank(input, env) {
  const ctx = start(input);
  const party = ctx.game.party;
  const rank = nextPartyRank(ctx.game);
  if (!party || party.affiliation !== 'member') throw new Error('Gli incarichi interni si conquistano da iscritto a un partito.');
  if (!rank) throw new Error('Hai raggiunto il vertice interno previsto dal gioco.');
  if (party.lastRankContestWeek && ctx.game.week.index - party.lastRankContestWeek < 3) throw new Error('Dopo una sfida interna servono tre settimane prima di riprovare.');
  const problem = costProblem(ctx.game, { ap: 2, capital: 4 });
  if (problem) throw new Error(problem);
  pay(ctx.game, { ap: 2, capital: 4 });
  const score = partyContestScore(ctx);
  const success = score >= rank.threshold;
  party.lastRankContestWeek = ctx.game.week.index;
  const lines = [`Punteggio ${score} su soglia ${rank.threshold}`];
  if (success) {
    party.rank = rank.level; party.rankTitle = rank.title;
    applyEffects(ctx, { party: { support: 3 }, stats: { influence: 2, notoriety: 1 } }, null, lines);
    party.history.push({ week: ctx.game.week.index, date: env.currentDate, text: `Nominato ${rank.title.toLowerCase()}`, source: SIM });
  } else {
    applyEffects(ctx, { party: { support: -3 }, relations: { leadership: -2 } }, null, lines);
  }
  addLog(ctx.game, env.currentDate, 'partito', success ? `Nuovo incarico: ${rank.title}` : `Sfida interna persa: ${rank.title}`, lines, success ? 'good' : 'bad');
  const completed = refreshObjectives(ctx, env, [], env.currentDate);
  return { ctx, success, rank, score, completed };
}
export function alignCurrent(input, env, currentId) {
  const ctx = start(input);
  const party = ctx.game.party;
  const current = party?.currents.find(item => item.id === currentId);
  if (!current) throw new Error('Corrente non disponibile.');
  if (party.alignedCurrentId === currentId) throw new Error('Sei già schierato con questa corrente.');
  const problem = costProblem(ctx.game, { ap: 1 });
  if (problem) throw new Error(problem);
  pay(ctx.game, { ap: 1 });
  party.alignedCurrentId = currentId;
  const lines = applyEffects(ctx, { relations: { target: 6, otherCurrents: -3, ...(currentId === party.leaderCurrentId ? { leadership: 3 } : {}) } }, currentId);
  addLog(ctx.game, env.currentDate, 'partito', `Ti schieri con ${current.label}`, lines, 'neutral');
  return { ctx };
}
export function joinParty(input, env, party) {
  const ctx = start(input);
  if (ctx.game.party) throw new Error('Hai già un partito: lascialo prima di aderire a un altro.');
  const problem = costProblem(ctx.game, { ap: 1 });
  if (problem) throw new Error(problem);
  pay(ctx.game, { ap: 1 });
  ctx.game.party = createPartyState({ ...party, founder: false, joinedAt: env.currentDate }, hash(`${ctx.game.seed}|${party.id}`));
  ctx.game.party.support = 40;
  if (!ctx.game.relations.some(item => item.id === 'leadership')) ctx.game.relations.unshift({ id: 'leadership', label: 'Leadership del partito', kind: 'Partito', value: 45, source: SIM });
  addLog(ctx.game, env.currentDate, 'partito', `Aderisci a ${party.label || 'un partito'}`, ['Parti come iscritto: il sostegno interno va costruito.'], 'neutral');
  return { ctx };
}
export function quitParty(input, env) {
  const ctx = start(input);
  if (!ctx.game.party) throw new Error('Non fai parte di un partito.');
  const lines = applyEffects(ctx, { stats: { notoriety: 2, influence: -1 } });
  leaveParty(ctx, 'Uscita volontaria');
  addLog(ctx.game, env.currentDate, 'partito', 'Lasci il partito', lines, 'neutral');
  return { ctx };
}

// ---------- objectives ----------
function objectiveMet(id, ctx, env) {
  const game = ctx.game;
  const parliament = ctx.parliament;
  if (id === 'radicamento') return (ctx.stats.popularity ?? 0) >= 55;
  if (id === 'rete') return relationList(game).filter(item => (item.value ?? item.relation) >= 65).length >= 3;
  if (id === 'partito') return (game.party?.rank ?? 0) >= 1;
  if (id === 'candidatura') return env.campaign?.nomination?.status === 'approved' || Boolean(game.flags.candidacy);
  if (id === 'elezione') return (env.career?.electionHistory ?? []).some(item => item.personalMandate);
  if (id === 'parlamento') return Boolean(parliament?.player?.groupId);
  if (id === 'incarico') return Boolean(parliament?.careerStanding?.committeeRole);
  if (id === 'legge') return (parliament?.laws ?? []).some(law => law.stage === 'approved');
  if (id === 'dirigenza') return (game.party?.rank ?? 0) >= 3;
  if (id === 'governo') return (parliament?.government?.ministers ?? []).some(item => item.playerAppointed);
  return false;
}
export function refreshObjectives(ctx, env, lines = [], date) {
  const completed = [];
  for (const objective of CAREER_OBJECTIVES) {
    if (ctx.game.objectives[objective.id] || !objectiveMet(objective.id, ctx, env)) continue;
    ctx.game.objectives[objective.id] = { completedAt: date, week: ctx.game.week.index, source: SIM };
    applyEffects(ctx, objective.reward);
    completed.push(objective);
    lines.push(`Traguardo raggiunto: ${objective.label}`);
    addLog(ctx.game, date, 'traguardo', `Traguardo: ${objective.label}`, [`Capitale politico +${objective.reward.capital}`], 'good');
  }
  return completed;
}
export function objectiveProgress(ctx, env) {
  return CAREER_OBJECTIVES.map(objective => ({ ...objective, done: Boolean(ctx.game.objectives[objective.id]), completedAt: ctx.game.objectives[objective.id]?.completedAt ?? null, available: objective.id !== 'partito' && objective.id !== 'dirigenza' ? true : Boolean(ctx.game.party) }));
}

// ---------- elections ----------
export function openElection(game, type, date) {
  return game.elections.find(item => item.type === type && item.status === 'open' && date >= item.windowOpensAt && date <= item.windowClosesAt) ?? null;
}
export function upcomingElections(game) {
  return [...game.elections].filter(item => item.status !== 'held').sort((a, b) => a.windowOpensAt.localeCompare(b.windowOpensAt));
}
export function markElectionRunning(game, electionId, campaignId) {
  return { ...game, elections: game.elections.map(item => item.id === electionId ? { ...item, status: 'running', campaignId } : item) };
}
function reschedule(game, entry) {
  const cycle = ELECTION_SCHEDULE[entry.type].cycleWeeks * 7;
  const base = entry.early ? entry.electionDate : entry.windowOpensAt;
  game.elections.push(makeElection(entry.type, advanceDays(base, cycle), game.place));
}
export function markElectionHeld(game, campaignId, result) {
  const next = copy(game);
  const entry = next.elections.find(item => item.campaignId === campaignId);
  if (!entry) return next;
  entry.status = 'held';
  entry.result = result;
  reschedule(next, entry);
  return next;
}
function updateElections(ctx, date, lines, specials) {
  const game = ctx.game;
  for (const entry of [...game.elections]) {
    if (entry.status === 'upcoming' && date >= entry.windowOpensAt) {
      entry.status = 'open';
      lines.push(`Si apre la finestra delle candidature: ${entry.label} (fino al ${entry.windowClosesAt}).`);
    }
    if (entry.status === 'open' && date > entry.windowClosesAt) {
      entry.status = 'missed';
      lines.push(`Candidature chiuse senza di te: ${entry.label}.`);
      specials.push({ type: 'election-missed', electionType: entry.type });
    }
    if (entry.status === 'missed' && date >= entry.electionDate) {
      entry.status = 'held';
      reschedule(game, entry);
    }
  }
  // A government that stays fallen long enough brings the general election forward.
  const government = ctx.parliament?.government;
  game.fallenWeeks = government?.status === 'fallen' ? (game.fallenWeeks ?? 0) + 1 : 0;
  const politics = game.elections.find(item => item.type === 'politiche' && item.status === 'upcoming');
  if (game.fallenWeeks >= EARLY_ELECTION_AFTER_WEEKS && politics && politics.windowOpensAt > advanceDays(date, 7)) {
    const early = makeElection('politiche', advanceDays(date, 7), game.place, true);
    Object.assign(politics, { ...early, id: politics.id });
    lines.push('Nessuna maggioranza dopo la caduta del governo: si va alle politiche anticipate.');
    game.fallenWeeks = 0;
  }
}

// ---------- week ----------
function weeklyIncome(ctx, env) {
  const offices = (env.offices ?? []).filter(item => item.politicianId === env.player?.id && !item.endDate);
  const officeIncome = offices.reduce((sum, office) => sum + (OFFICE_INCOME.find(entry => entry.match.test(office.title))?.amount ?? 0), 0);
  const party = ctx.game.party;
  const rankIncome = party ? (party.affiliation === 'founder' ? FOUNDER_RANK.weeklyIncome : PARTY_RANKS[party.rank]?.weeklyIncome ?? 0) : 0;
  return BASE_WEEKLY_INCOME + officeIncome + rankIncome;
}
function drift(ctx, lines) {
  const { game, stats } = ctx;
  if ((stats.notoriety ?? 0) > 15) stats.notoriety = round2(stats.notoriety - 0.5);
  if (!game.week.categoriesUsed.includes('territorio') && (stats.popularity ?? 0) > 20) { stats.popularity = round2(stats.popularity - 0.4); lines.push('Poca presenza sul territorio: popolarità −0,4'); }
  if ((stats.reputation ?? 50) < 50) stats.reputation = round2(stats.reputation + 0.3);
  if (game.party && game.party.support < 45) game.party.support = round2(game.party.support + 0.5);
  for (const item of game.relations) {
    const base = RELATION_BASES[item.id] ?? 50;
    if (Math.abs(item.value - base) > 2) item.value = round2(item.value + (item.value > base ? -0.5 : 0.5));
  }
  const standing = ctx.parliament?.careerStanding;
  if (standing && Math.abs(standing.partySupport - 50) > 2) standing.partySupport = round2(standing.partySupport + (standing.partySupport > 50 ? -0.5 : 0.5));
}
export function advanceWeek(input, env, governmentWeek = parliament => parliament) {
  const ctx = { game: copy(input.game), stats: { ...input.stats }, parliament: copy(input.parliament) };
  const game = ctx.game;
  const date = env.currentDate;
  const lines = [];
  const specials = [];
  if (game.status === 'ended') return { ctx, specials, report: null };
  const closing = game.week.index;
  for (const item of [...game.inbox]) {
    const choice = templateFor(item)?.choices.find(entry => entry.id === item.defaultChoice);
    game.inbox = game.inbox.filter(entry => entry.id !== item.id);
    if (!choice) continue;
    const itemLines = [];
    const tone = runChoice(ctx, env, item, choice, itemLines, specials);
    if (item.kind !== 'appuntamento' || itemLines.length) addLog(game, date, item.kind, `${item.title} — ${fill(choice.label, item.params)} (senza decisione)`, itemLines, tone);
    if (item.kind !== 'appuntamento') lines.push(`Senza una tua decisione: ${item.title}`);
    if (game.status === 'ended') break;
  }
  if (game.status !== 'ended') {
    const income = weeklyIncome(ctx, env);
    game.resources.funds += income;
    const capitalGain = Math.round(2 + (ctx.stats.influence ?? 30) / 25 + ((game.party?.rank ?? 0) >= 2 ? 1 : 0));
    game.resources.politicalCapital = clamp(game.resources.politicalCapital + capitalGain);
    lines.unshift(`Entrate della settimana: ${income} € · capitale politico +${capitalGain}`);
    drift(ctx, lines);
    if (ctx.parliament) {
      const before = ctx.parliament.government?.status;
      ctx.parliament = governmentWeek(ctx.parliament, date, draw(game));
      if (before === 'active' && ctx.parliament.government?.status === 'crisis') lines.push('La maggioranza si incrina: il governo entra in crisi.');
    }
    if (game.flags.opaqueFunding && !game.flags.opaqueFundingExposed && draw(game) < 0.25) { raiseForced(ctx, 'finanziamento'); game.flags.opaqueFundingExposed = true; }
    if (game.party?.affiliation === 'member' && game.party.support < 20) raiseForced(ctx, 'espulsione');
    if ((ctx.stats.reputation ?? 50) < 12) raiseForced(ctx, 'dimissioni');
    updateElections(ctx, date, lines, specials);
    game.week = { index: closing + 1, startedAt: date, ap: game.week.maxAp ?? WEEKLY_ACTION_POINTS, maxAp: game.week.maxAp ?? WEEKLY_ACTION_POINTS, categoriesUsed: [] };
    fillInbox(ctx, env, lines);
  }
  const deltas = Object.fromEntries(Object.keys(STAT_LABELS).map(metric => [metric, round2((ctx.stats[metric] ?? 0) - (game.weekStartStats?.[metric] ?? ctx.stats[metric] ?? 0))]).filter(([, delta]) => delta));
  game.weekStartStats = { ...ctx.stats };
  refreshObjectives(ctx, env, lines, date);
  game.lastReport = { week: closing, date, lines, deltas, source: SIM };
  return { ctx, specials, report: game.lastReport };
}

export function relationValue(game, id) {
  return relationList(game).find(item => item.id === id)?.value ?? null;
}
