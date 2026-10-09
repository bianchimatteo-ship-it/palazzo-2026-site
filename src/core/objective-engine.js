// The goals of a career, measured on what the player does. The career engine keeps a ledger of the actions and the
// choices (game.record) and hands the state in; this module reads them: how far each goal is, whether it is
// reachable now, what it unlocked once reached (and what that changes in the promotions, the candidacies, the
// campaigns and the equilibrium of the relations), and the public ambitions (a goal declared with a deadline).
// Pure functions over plain data (nothing imports the career engine, which owns the effects).
import { AMBITION_LIMIT, CAREER_OBJECTIVES, CLASSIC_OBJECTIVES, OBJECTIVE_BY_ID } from '../data/simulation/objective-rules.js?v=20261009-2';
import { territorialControl } from './committee-engine.js?v=20261009-2';

const SIM = 'simulation';
const round2 = value => Math.round(value * 100) / 100;
const LEDGER_KEYS = 120;

// ---------- the ledger of what the player does ----------
export const emptyRecord = () => ({ activities: {}, activityIds: {}, choices: {}, decisions: { made: 0, delegated: 0 }, ambitions: { declared: 0, kept: 0, broken: 0 }, source: SIM });
export function recordOf(game) {
  const record = game?.record;
  return record && typeof record === 'object' ? record : emptyRecord();
}
// Counts one action (an activity, a choice, a decision). The ledger stays small: the rarest keys go first.
export function bump(game, group, key, amount = 1) {
  if (!game || !key) return;
  game.record = { ...emptyRecord(), ...(game.record ?? {}) };
  game.record[group] = { ...(game.record[group] ?? {}) };
  game.record[group][key] = (game.record[group][key] ?? 0) + amount;
  const keys = Object.keys(game.record[group]);
  if (keys.length > LEDGER_KEYS) { const rarest = keys.sort((a, b) => game.record[group][a] - game.record[group][b])[0]; delete game.record[group][rarest]; }
}
export function bumpDecision(game, kind) {
  if (!game) return;
  game.record = { ...emptyRecord(), ...(game.record ?? {}) };
  game.record.decisions = { ...game.record.decisions, [kind]: (game.record.decisions?.[kind] ?? 0) + 1 };
}
export function bumpAmbition(game, kind) {
  if (!game) return;
  game.record = { ...emptyRecord(), ...(game.record ?? {}) };
  game.record.ambitions = { ...game.record.ambitions, [kind]: (game.record.ambitions?.[kind] ?? 0) + 1 };
}

// ---------- measuring ----------
const rankOf = game => game.party ? (game.party.affiliation === 'founder' ? 5 : game.party.rank ?? 0) : 0;
const ageOf = (birthDate, date) => /^\d{4}-\d{2}-\d{2}$/.test(birthDate ?? '') && /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? Number(date.slice(0, 4)) - Number(birthDate.slice(0, 4)) - (date.slice(5) < birthDate.slice(5) ? 1 : 0) : null;
// The target of a measure: a number, or "all" (every debt the career started with).
const targetOf = (measure, game) => measure.target === 'all' ? Math.max(1, (game.start?.debts ?? []).length) : measure.target;
// The value of one measure: a number read from the state of the career.
export function measureValue(measure, ctx, env = {}, extras = {}) {
  const game = ctx.game;
  const stats = ctx.stats ?? {};
  const record = recordOf(game);
  switch (measure.kind) {
    case 'stat': return stats[measure.stat] ?? 0;
    case 'activities': return measure.categories.reduce((sum, category) => sum + (record.activities[category] ?? 0), 0);
    case 'actions': return (measure.choices ?? []).reduce((sum, key) => sum + (record.choices[key] ?? 0), 0) + (measure.activities ?? []).reduce((sum, id) => sum + (record.activityIds[id] ?? 0), 0);
    case 'relations': return [...(game.relations ?? []), ...(game.party?.currents ?? [])].filter(item => (item.value ?? item.relation ?? 0) >= measure.min).length;
    case 'rank': return rankOf(game);
    case 'control': return territorialControl(game.party, { region: game.place?.region ?? null })?.index ?? 0;
    case 'leadersWith': return territorialControl(game.party, { region: game.place?.region ?? null })?.byStance['con-te'] ?? 0;
    case 'cohesion': return game.party?.org?.cohesion ?? 0;
    case 'candidacy': return env.campaign?.nomination?.status === 'approved' || game.flags?.candidacy ? 1 : 0;
    case 'mandates': return (env.career?.electionHistory ?? []).filter(item => item.personalMandate).length;
    case 'seat': return ctx.parliament?.player?.groupId ? 1 : 0;
    case 'committeeRole': return ctx.parliament?.careerStanding?.committeeRole ? 1 : 0;
    // The player's own bills (the others' carry a sponsor) that both Chambers approved.
    case 'laws': return (ctx.parliament?.laws ?? []).filter(law => law.stage === 'approved' && !law.sponsor).length;
    case 'minister': return (ctx.parliament?.government?.ministers ?? []).some(item => item.playerAppointed) ? 1 : 0;
    case 'epReports': return Math.max(0, ...(env.institutions ?? []).filter(item => item.kind === 'europa').map(item => item.ep?.reports ?? 0));
    case 'memory': return (game.memory ?? []).filter(item => measure.kinds.includes(item.kind)).length;
    case 'memoryNet': return extras.memoryNet ?? 0;
    case 'debtsPaid': return (game.start?.debts ?? []).filter(item => item.status === 'saldato').length;
    case 'ambitionsKept': return record.ambitions.kept ?? 0;
    case 'outsider': {
      const outsider = game.start?.outsider;
      const initial = game.start?.levels?.outsider ?? 0;
      return outsider && initial ? round2(Math.min(1, ((initial - outsider.level) + (outsider.level > 0 ? outsider.integration : 0)) / initial)) : 0;
    }
    case 'divided': return game.start?.divided?.resolvedAt ? 1 : 0;
    case 'weeksAbove': return game.start?.expectation?.metWeeks ?? 0;
    case 'president': return game.flags?.president || game.flags?.exPresident ? 1 : 0;
    case 'presidentCredit': return env.presidency?.credit ?? 0;
    default: return 0;
  }
}

// Does the goal exist for this player now? (A party goal needs a party, a start goal the start that brings it…)
export function objectiveAvailable(spec, ctx, env = {}) {
  const game = ctx.game;
  const needs = spec.needs;
  if (!needs) return true;
  if (needs === 'party') return Boolean(game.party);
  if (needs === 'territory') return Boolean(game.party?.org?.committees?.length);
  if (needs === 'member') return game.party?.affiliation === 'member';
  if (needs === 'seat') return Boolean(ctx.parliament?.player?.groupId);
  if (needs === 'ep') return env.career?.initialLevel === 'europeo' || (env.institutions ?? []).some(item => item.kind === 'europa');
  if (needs.startsWith('start:')) return Boolean(game.start?.levels?.[needs.slice(6)]);
  if (needs === 'president') return Boolean(game.flags?.president || game.flags?.exPresident);
  if (needs === 'quirinale') {
    const age = ageOf(env.player?.birthDate, env.currentDate ?? game.week?.startedAt);
    return Boolean(game.flags?.president || game.flags?.exPresident || (age !== null && age >= 50));
  }
  return true;
}

// The state of every goal: progress, what is still missing, whether it can be declared.
export function objectiveStatus(ctx, env = {}, extras = {}) {
  const game = ctx.game;
  const done = game.objectives ?? {};
  return CAREER_OBJECTIVES.map(spec => {
    const rows = spec.measures.map(measure => {
      const target = targetOf(measure, game);
      const value = round2(measureValue(measure, ctx, env, extras));
      return { kind: measure.kind, label: measure.label, value, target, met: value >= target, ratio: Math.min(1, target ? value / target : 1) };
    });
    const met = spec.mode === 'any' ? rows.some(row => row.met) : rows.every(row => row.met);
    const progress = round2(spec.mode === 'any' ? Math.max(0, ...rows.map(row => row.ratio)) : rows.reduce((sum, row) => sum + row.ratio, 0) / (rows.length || 1));
    const waiting = (spec.after ?? []).filter(id => !done[id]);
    const ambition = (game.ambitions ?? []).find(item => item.id === spec.id) ?? null;
    return {
      ...spec, rows, met, progress, done: Boolean(done[spec.id]), completedAt: done[spec.id]?.completedAt ?? null, silent: Boolean(done[spec.id]?.silent), declaredKept: Boolean(done[spec.id]?.declared),
      available: objectiveAvailable(spec, ctx, env), waiting: waiting.map(id => OBJECTIVE_BY_ID[id]?.label ?? id), ambitionActive: ambition
    };
  });
}

// ---------- ambitions: a goal declared in public ----------
export function ambitionProblem(ctx, env, spec, extras = {}) {
  const game = ctx.game;
  if (!spec) return 'Obiettivo non riconosciuto.';
  if (!spec.ambition) return 'Questo traguardo non si può dichiarare: arriva con le tue scelte.';
  if (game.objectives?.[spec.id]) return 'Già raggiunto.';
  if (!objectiveAvailable(spec, ctx, env)) return 'Non è un obiettivo della tua carriera.';
  const waiting = (spec.after ?? []).filter(id => !game.objectives?.[id]);
  if (waiting.length) return `Prima raggiungi: ${waiting.map(id => OBJECTIVE_BY_ID[id]?.label ?? id).join(', ')}.`;
  if ((game.ambitions ?? []).some(item => item.id === spec.id)) return 'L’hai già dichiarato.';
  if ((game.ambitions ?? []).length >= AMBITION_LIMIT) return `Puoi dichiarare al massimo ${AMBITION_LIMIT} obiettivi alla volta.`;
  return null;
}
export const expiredAmbitions = (game, week) => (game.ambitions ?? []).filter(item => item.deadline < week);

// ---------- what a reached goal leaves ----------
export function objectiveMods(game) {
  const sum = {};
  for (const entry of Object.values(game?.unlocks ?? {})) for (const [key, value] of Object.entries(entry.mods ?? {})) sum[key] = round2((sum[key] ?? 0) + value);
  return sum;
}
export function objectiveBase(game, relationId) {
  let shift = 0;
  for (const entry of Object.values(game?.unlocks ?? {})) shift += entry.base?.[relationId] ?? 0;
  return shift;
}
export function objectiveMoment(kind, game) {
  const bits = [];
  for (const entry of Object.values(game?.unlocks ?? {})) {
    const value = kind === 'partito' ? entry.mods?.partyScore : kind === 'parlamento' ? entry.mods?.parlScore : 0;
    if (value) bits.push([`Traguardo raggiunto: ${entry.label}`, value]);
  }
  return bits;
}
export const isClassicObjective = id => CLASSIC_OBJECTIVES.includes(id);
