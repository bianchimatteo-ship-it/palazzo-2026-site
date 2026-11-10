// Special challenges: a bounded game inside the career, with its own starting condition, goals, limits, deadline and verdict (success / failure) and a summary.
// It does not replace the scenarios (scenario-engine.js: how a career begins) or the long goals (objective-engine.js: what a career builds): it reuses the way they measure (measureValue) and adds
// the one thing they lack, the comparison with the day the challenge was accepted (baseline) and a hard end. Pure and deterministic: no random numbers, nothing leaves the game state
// (game.challenge = the one open, game.challengesDone = the verdicts). The store applies the starting condition and the reward; the weekly tick calls tickChallenge.
// Everything is simulated; no challenge describes a real person or organisation.
import { measureValue, objectiveAvailable, recordOf } from './objective-engine.js?v=20261110-1';

const round1 = value => Math.round(value * 10) / 10;
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

// needs: 'party' | 'seat' | 'government' (the player belongs to the majority or leads the Government) | null.
export const CHALLENGES = Object.freeze([
  { id: 'cento-giorni', label: 'I primi cento giorni', kicker: 'Radicamento', weeks: 14, needs: null,
    summary: 'Hai poco più di tre mesi per farti conoscere: più popolarità, un territorio che ti vede, nessuno scivolone.',
    setup: { text: 'Si parte da zero: le attese sono alte e la pazienza è poca.', stats: {} },
    goals: [{ kind: 'statGain', stat: 'popularity', target: 6, label: 'Popolarità in più' }, { kind: 'activitiesGain', categories: ['territorio', 'relazioni'], target: 5, label: 'Attività sul territorio e incontri' }],
    limits: [{ kind: 'statMin', stat: 'reputation', min: 30, label: 'Reputazione non sotto 30' }],
    reward: { capital: 3, stats: { reputation: 1.5, popularity: 1 } }, penalty: { stats: { popularity: -1.5 } } },
  { id: 'parola-data', label: 'La parola data', kicker: 'Programma', weeks: 26, needs: null,
    summary: 'Poche promesse, mantenute: la credibilità si costruisce con i fatti verificati, non con gli annunci.',
    setup: { text: 'Gli elettori e i giornali terranno il conto di ogni impegno.', stats: {} },
    goals: [{ kind: 'promisesKept', target: 1, label: 'Promesse mantenute' }, { kind: 'statAbove', stat: 'reputation', target: 55, label: 'Reputazione' }],
    limits: [{ kind: 'promisesBroken', max: 0, label: 'Nessuna promessa tradita' }],
    reward: { capital: 4, stats: { reputation: 2 } }, penalty: { stats: { reputation: -1.5 } } },
  { id: 'sotto-i-riflettori', label: 'Sotto i riflettori', kicker: 'Crisi di immagine', weeks: 16, needs: null,
    summary: 'Una polemica ti ha colpito: sei partito in svantaggio. Recupera la fiducia senza farti trascinare in altre polemiche.',
    setup: { text: 'Una polemica sui giornali ti costa subito reputazione e popolarità.', stats: { reputation: -6, popularity: -5 } },
    goals: [{ kind: 'statGain', stat: 'reputation', target: 8, label: 'Reputazione recuperata' }, { kind: 'statGain', stat: 'popularity', target: 4, label: 'Popolarità recuperata' }],
    limits: [{ kind: 'statMin', stat: 'reputation', min: 15, label: 'Reputazione non sotto 15' }],
    reward: { capital: 3, stats: { reputation: 2, popularity: 1 } }, penalty: { stats: { reputation: -2 } } },
  { id: 'partito-diviso', label: 'Il partito diviso', kicker: 'Partito', weeks: 20, needs: 'party',
    summary: 'Correnti in lotta, sezioni che non si parlano: ricuci il partito prima che si spacchi.',
    setup: { text: 'Le correnti si dividono: coesione interna in calo.', cohesion: -12 },
    goals: [{ kind: 'cohesion', target: 60, label: 'Coesione del partito' }, { kind: 'relations', min: 60, target: 2, label: 'Rapporti sopra 60' }],
    limits: [{ kind: 'cohesionMin', min: 18, label: 'Coesione non sotto 18' }],
    reward: { capital: 4, stats: { influence: 1.5 }, support: 3 }, penalty: { stats: { influence: -1 }, support: -2 } },
  { id: 'rete-di-alleati', label: 'Una rete di alleati', kicker: 'Relazioni', weeks: 24, needs: null,
    summary: 'Nessuno governa da solo: costruisci quattro rapporti solidi con persone e categorie diverse.',
    setup: { text: 'Si parte da quello che hai: ogni incontro conta.', stats: {} },
    goals: [{ kind: 'relations', min: 65, target: 4, label: 'Rapporti sopra 65' }, { kind: 'activitiesGain', categories: ['relazioni'], target: 3, label: 'Incontri e relazioni' }],
    limits: [],
    reward: { capital: 3, stats: { influence: 1 } }, penalty: { stats: {} } },
  { id: 'legislatore', label: 'Il legislatore', kicker: 'Parlamento', weeks: 40, needs: 'seat',
    summary: 'Una legge tua, approvata da entrambe le Camere: serve il lavoro in commissione, i voti e un po’ di pazienza.',
    setup: { text: 'Il tempo corre: la legislatura non aspetta.', stats: {} },
    goals: [{ kind: 'lawsGain', target: 1, label: 'Leggi tue approvate' }],
    limits: [{ kind: 'statMin', stat: 'reputation', min: 25, label: 'Reputazione non sotto 25' }],
    reward: { capital: 5, stats: { influence: 2, reputation: 1 } }, penalty: { stats: { influence: -1 } } },
  { id: 'governo-che-regge', label: 'Il governo che regge', kicker: 'Governo', weeks: 18, needs: 'government',
    summary: 'La maggioranza traballa: riporta la stabilità del Governo sopra 60 senza perdere la faccia.',
    setup: { text: 'Tensioni nella maggioranza: stabilità del Governo in calo.', stability: -14 },
    goals: [{ kind: 'stability', target: 60, label: 'Stabilità del Governo' }],
    limits: [{ kind: 'stabilityMin', min: 12, label: 'Stabilità non sotto 12' }],
    reward: { capital: 4, stats: { influence: 1.5, reputation: 1 } }, penalty: { stats: { reputation: -1.5, popularity: -1 } } }
]);
export const CHALLENGE_BY_ID = Object.freeze(Object.fromEntries(CHALLENGES.map(spec => [spec.id, spec])));

const kept = game => (game?.promises ?? []).filter(item => item.status === 'mantenuta' || item.status === 'parzialmente-mantenuta').length;
const broken = game => (game?.promises ?? []).filter(item => item.status === 'non-mantenuta').length;
const lawsOf = ctx => (ctx.parliament?.laws ?? []).filter(law => law.stage === 'approved' && !law.sponsor).length;
const activitiesOf = (game, categories) => categories.reduce((sum, category) => sum + (recordOf(game).activities[category] ?? 0), 0);

// The day the challenge begins: everything a goal is compared with.
export function baselineOf(ctx) {
  const game = ctx.game, stats = ctx.stats ?? {};
  return { stats: { reputation: stats.reputation ?? 50, popularity: stats.popularity ?? 50, influence: stats.influence ?? 50 }, stability: ctx.parliament?.government?.stability ?? null, cohesion: game?.party?.org?.cohesion ?? null, ties: measureValue({ kind: 'relations', min: 65 }, ctx, {}), kept: kept(game), broken: broken(game), laws: lawsOf(ctx), activities: { territorio: activitiesOf(game, ['territorio']), relazioni: activitiesOf(game, ['relazioni']), both: activitiesOf(game, ['territorio', 'relazioni']) } };
}

// A goal never starts already met: the targets that read a level are at least the level of the day the challenge began (what the starting condition took away must be won back) and, for the
// network of allies, two more than the ties already held.
export function targetOf(goal, base) {
  if (goal.kind === 'stability' && Number.isFinite(base?.stability)) return Math.min(92, Math.max(goal.target, Math.round(base.stability)));
  if (goal.kind === 'cohesion' && Number.isFinite(base?.cohesion)) return Math.min(92, Math.max(goal.target, Math.round(base.cohesion)));
  if (goal.kind === 'relations' && Number.isFinite(base?.ties) && goal.min === 65) return Math.max(goal.target, base.ties + 2);
  return goal.target;
}
function goalValue(goal, ctx, env, base) {
  const game = ctx.game, stats = ctx.stats ?? {};
  switch (goal.kind) {
    case 'statGain': return round1((stats[goal.stat] ?? 0) - (base.stats[goal.stat] ?? 0));
    case 'statAbove': return round1(stats[goal.stat] ?? 0);
    case 'activitiesGain': {
      const key = goal.categories.length > 1 ? 'both' : goal.categories[0];
      return Math.max(0, activitiesOf(game, goal.categories) - (base.activities[key] ?? 0));
    }
    case 'relations': return measureValue({ kind: 'relations', min: goal.min }, ctx, env);
    case 'cohesion': return round1(game.party?.org?.cohesion ?? 0);
    case 'lawsGain': return Math.max(0, lawsOf(ctx) - base.laws);
    case 'promisesKept': return Math.max(0, kept(game) - base.kept);
    case 'stability': return round1(ctx.parliament?.government?.stability ?? 0);
    default: return 0;
  }
}
function limitBroken(limit, ctx, base) {
  const stats = ctx.stats ?? {};
  switch (limit.kind) {
    case 'statMin': return (stats[limit.stat] ?? 50) < limit.min;
    case 'promisesBroken': return broken(ctx.game) - base.broken > limit.max;
    case 'cohesionMin': return (ctx.game.party?.org?.cohesion ?? 100) < limit.min;
    case 'stabilityMin': return (ctx.parliament?.government?.stability ?? 100) < limit.min;
    default: return false;
  }
}

// Can the challenge be taken now, and if not why.
export function challengeProblem(spec, ctx, env = {}) {
  if (!spec) return 'Sfida non riconosciuta.';
  const game = ctx.game;
  if (game?.challenge?.status === 'attiva') return 'Hai già una sfida in corso: portala a termine prima di accettarne un’altra.';
  if (game?.challengesDone?.[spec.id]?.status === 'riuscita') return 'Sfida già superata.';
  if (spec.id === 'parola-data' && !(game?.promises ?? []).some(item => !['mantenuta', 'parzialmente-mantenuta', 'non-mantenuta', 'modificata'].includes(item.status))) return 'Serve almeno una promessa aperta: falla dal Programma (Elezioni › Programma).';
  if (spec.needs === 'party' && !objectiveAvailable({ needs: 'party' }, ctx, env)) return 'Serve un partito: iscriviti o fondane uno.';
  if (spec.needs === 'seat' && !objectiveAvailable({ needs: 'seat' }, ctx, env)) return 'Serve un seggio in Parlamento.';
  if (spec.needs === 'government' && !(ctx.inMajority || ctx.premier)) return 'Serve far parte della maggioranza di Governo.';
  return null;
}

export function startChallenge(id, ctx, env = {}, { week, date }) {
  const spec = CHALLENGE_BY_ID[id];
  const problem = challengeProblem(spec, ctx, env);
  if (problem) throw new Error(problem);
  const base = baselineOf(ctx);
  return { challenge: { id, label: spec.label, status: 'attiva', startedWeek: week, startedAt: date, deadlineWeek: week + spec.weeks, baseline: base, progress: 0, history: [{ week, text: `Sfida accettata: ${spec.label}.` }] }, setup: spec.setup };
}

// The rows of the open challenge (goals and limits), for the page and for the weekly verdict.
export function challengeRows(challenge, ctx, env = {}) {
  const spec = CHALLENGE_BY_ID[challenge?.id];
  if (!spec) return { goals: [], limits: [], met: false, failed: false, progress: 0 };
  const goals = spec.goals.map(goal => {
    const value = goalValue(goal, ctx, env, challenge.baseline), target = targetOf(goal, challenge.baseline);
    return { label: goal.label, value, target, met: value >= target, ratio: Math.min(1, target ? value / target : 1) };
  });
  const limits = spec.limits.map(limit => ({ label: limit.label, broken: limitBroken(limit, ctx, challenge.baseline) }));
  const progress = Math.round(100 * goals.reduce((sum, row) => sum + row.ratio, 0) / (goals.length || 1));
  return { goals, limits, met: goals.every(row => row.met), failed: limits.some(row => row.broken), progress };
}

// Weekly: the verdict. Returns the next state of the challenge and, when it just ended, its effects (applied once by the store).
export function tickChallenge(game, ctx, env = {}, { week, date }) {
  const challenge = game?.challenge;
  if (!challenge || challenge.status !== 'attiva') return { challenge: challenge ?? null, ended: null };
  const spec = CHALLENGE_BY_ID[challenge.id];
  const rows = challengeRows(challenge, ctx, env);
  const weeksLeft = Math.max(0, challenge.deadlineWeek - week);
  const history = challenge.history ?? [];
  let status = 'attiva', reason = null;
  if (rows.failed) { status = 'fallita'; reason = rows.limits.find(row => row.broken)?.label ?? 'Un limite è stato superato'; }
  else if (rows.met) status = 'riuscita';
  else if (weeksLeft <= 0) { status = 'fallita'; reason = 'Tempo scaduto'; }
  const next = { ...challenge, progress: rows.progress, weeksLeft, history: history.slice(-8) };
  if (status === 'attiva') return { challenge: next, ended: null };
  const ok = status === 'riuscita';
  const effects = ok ? spec.reward : spec.penalty;
  const lines = [ok ? `Obiettivi raggiunti in ${week - challenge.startedWeek} settimane su ${spec.weeks}.` : `${reason}.`, ...rows.goals.map(row => `${row.label}: ${row.value}/${row.target}`)];
  const text = ok ? `Sfida superata: ${spec.label}.` : `Sfida fallita: ${spec.label} (${reason.toLowerCase()}).`;
  return { challenge: { ...next, status, endedWeek: week, endedAt: date, reason, progress: ok ? 100 : rows.progress, history: [...next.history, { week, text }] }, ended: { id: spec.id, label: spec.label, status, reason, effects, lines, text, headline: ok ? `Sfida superata: ${spec.label}` : `Sfida fallita: ${spec.label}`, tone: ok ? 'win' : 'loss', weeks: week - challenge.startedWeek } };
}

// Giving up costs a little credibility: the challenge was a public commitment.
export function abandonChallenge(game, { week, date }) {
  const challenge = game?.challenge;
  if (!challenge || challenge.status !== 'attiva') throw new Error('Nessuna sfida in corso.');
  const spec = CHALLENGE_BY_ID[challenge.id];
  return { challenge: { ...challenge, status: 'abbandonata', endedWeek: week, endedAt: date, reason: 'Abbandonata', history: [...(challenge.history ?? []), { week, text: `Sfida abbandonata: ${spec.label}.` }] }, effects: { stats: { reputation: -1 } } };
}

export function challengeView(ctx, env = {}) {
  const game = ctx.game;
  const open = game?.challenge?.status === 'attiva' ? game.challenge : null;
  const week = ctx.week ?? game?.week?.index ?? 0;
  return {
    open: open ? { ...open, spec: CHALLENGE_BY_ID[open.id], rows: challengeRows(open, ctx, env), weeksLeft: Math.max(0, open.deadlineWeek - week) } : null,
    available: CHALLENGES.map(spec => ({ ...spec, problem: challengeProblem(spec, ctx, env), done: game?.challengesDone?.[spec.id] ?? null })),
    last: game?.challenge && game.challenge.status !== 'attiva' ? game.challenge : null
  };
}

// The verdicts kept in the game: the best result per challenge.
export function recordVerdict(game, challenge) {
  const done = { ...(game.challengesDone ?? {}) };
  const previous = done[challenge.id];
  if (previous?.status === 'riuscita') return done;
  done[challenge.id] = { status: challenge.status, week: challenge.endedWeek, attempts: (previous?.attempts ?? 0) + 1 };
  return done;
}
export const clampStat = clamp;
