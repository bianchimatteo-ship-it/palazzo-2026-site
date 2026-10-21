// The staff at work: mandates the player gives (an objective, a duration, a weekly budget and a ceiling, a target) that the staff carries out at every weekly close. Pure functions on the game
// state of a career (the caller passes a copy): nothing is applied that the player did not approve, and what the staff does has true effects — on the committees, on the local leaders, on the
// funds (through book()), and on the stats and the preparation the career applies like any other effect. Reports are kept for every week of work.
// The skill of the staff is not a number of its own: it is read from what the player has built (the budget lines, the committees and their strength, the stats).
import { book } from './finance-engine.js?v=20261021-1';
import { committeeStrength } from './committee-engine.js?v=20261021-1';
import { MANDATE_STATUS, NON_DELEGABLE, STAFF_DURATIONS, STAFF_MAX_MANDATES, STAFF_REPORTS_KEPT, STAFF_SKILLS, STAFF_TASKS, STAFF_TASK_BY_ID } from '../data/simulation/staff-rules.js?v=20261021-1';

const SIM = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;

export const createStaff = () => ({ version: 1, source: SIM, mandates: [], reports: [], nextId: 1 });
export const staffOf = game => game?.staff ?? createStaff();
const ensure = game => { game.staff = { ...createStaff(), ...(game.staff ?? {}) }; return game.staff; };

// ---------- what the staff can do: skills and room ----------
const level = (game, line) => game.finance?.budget?.[line] ?? 0;
const liveCommittees = game => (game.party?.org?.committees ?? []).filter(item => item.status !== 'dissoluzione');
const liveCadres = game => (game.party?.life?.cadres ?? []).filter(item => item.status !== 'uscito' && !item.player);
export function staffSkills(game, stats = {}) {
  const committees = liveCommittees(game);
  const strength = committees.length ? committees.reduce((sum, item) => sum + committeeStrength(item), 0) / committees.length : 0;
  const assets = new Set((game.finance?.assets ?? []).map(asset => asset.id));
  const raw = {
    organizzazione: 20 + 14 * level(game, 'personale') + 9 * level(game, 'formazione') + 0.22 * strength + 0.12 * (stats.experience ?? 30),
    comunicazione: 18 + 18 * level(game, 'comunicazione') + 12 * level(game, 'digitale') + 5 * level(game, 'personale') + 0.15 * (stats.notoriety ?? 30),
    territorio: 18 + 16 * level(game, 'territorio') + 12 * level(game, 'sede') + 4 * level(game, 'personale') + 0.2 * strength + 0.08 * (stats.popularity ?? 30),
    tesoreria: 16 + 14 * level(game, 'raccolta') + 8 * level(game, 'personale') + 6 * level(game, 'digitale') + 0.1 * (stats.reputation ?? 40),
    analisi: 18 + 8 * level(game, 'formazione') + 6 * level(game, 'digitale') + 6 * level(game, 'personale') + 0.2 * (stats.experience ?? 30) + (assets.has('archivio-dati') ? 10 : 0)
  };
  return Object.fromEntries(Object.entries(raw).map(([id, value]) => [id, Math.round(clamp(value))]));
}
// How many mandates can be open at once: one for a party's own organisation, one more for every level of the staff budget.
export function staffCapacity(game) {
  const max = Math.min(STAFF_MAX_MANDATES, level(game, 'personale') + (game.party?.org ? 1 : 0));
  const used = staffOf(game).mandates.filter(item => item.status === 'attivo' || item.status === 'sospeso').length;
  return { max, used, free: Math.max(0, max - used), reason: max ? '' : 'Lo staff si forma con un partito o con un collaboratore (Finanze › Bilancio › Staff e collaboratori).' };
}
export const delegableNotes = () => NON_DELEGABLE.map(([what, why]) => ({ what, why }));

// The targets a task can be pointed at, as [id, label] pairs.
export function staffTargets(game, taskId) {
  const task = STAFF_TASK_BY_ID[taskId];
  if (task?.target === 'committee') return liveCommittees(game).map(item => [item.id, `${item.name} (${item.level}) · ${item.activists} volontari`]);
  if (task?.target === 'cadre') return liveCadres(game).map(item => [item.id, `${item.name} · lealtà ${item.loyalty} · malcontento ${item.grievance}`]);
  return [];
}
// Why a task cannot be given now (null: it can).
export function taskProblem(game, stats, taskId, target = null) {
  const task = STAFF_TASK_BY_ID[taskId];
  if (!task) return 'Incarico non riconosciuto: lo staff non può occuparsene.';
  if (task.needs === 'comitati' && !liveCommittees(game).length) return task.needsLabel;
  if (task.needs === 'dirigenti' && !liveCadres(game).length) return task.needsLabel;
  if (task.target && target && !staffTargets(game, taskId).some(([id]) => id === target)) return 'Il bersaglio scelto non è più disponibile.';
  const skill = staffSkills(game, stats)[task.skill];
  if (skill < task.minSkill) return `Competenze insufficienti: ${STAFF_SKILLS[task.skill]} ${skill}/100, ne servono ${task.minSkill} (si costruiscono con il bilancio, i comitati e la formazione).`;
  return null;
}
const budgetFactor = (task, weeklyBudget) => clamp((weeklyBudget - task.minWeeklyBudget) / task.minWeeklyBudget, 0, 1);
export const mandateQuality = (game, stats, mandate) => { const task = STAFF_TASK_BY_ID[mandate.task]; return clamp(staffSkills(game, stats)[task.skill] / 100 * 0.75 + budgetFactor(task, mandate.weeklyBudget) * 0.25, 0.15, 1); };

// ---------- the player's decisions ----------
function validate(game, stats, spec, { editing = null } = {}) {
  const task = STAFF_TASK_BY_ID[spec.task];
  if (!task) throw new Error('Incarico non riconosciuto: lo staff non può occuparsene.');
  const weeks = Number(spec.weeks);
  // A new mandate lasts one of the durations of the list; an open one can be set to any number of weeks still to go (up to the longest).
  if (editing ? !(Number.isInteger(weeks) && weeks >= 1 && weeks <= STAFF_DURATIONS.at(-1)[0]) : !STAFF_DURATIONS.some(([value]) => value === weeks)) throw new Error('Scegli una durata dell’elenco.');
  const weeklyBudget = Math.round(Number(spec.weeklyBudget));
  if (!(weeklyBudget >= task.minWeeklyBudget)) throw new Error(`Il budget settimanale minimo per questo incarico è ${task.minWeeklyBudget} €.`);
  if (weeklyBudget > 2000) throw new Error('Il budget settimanale non può superare 2.000 €.');
  const budgetMax = Math.round(Number(spec.budgetMax));
  if (!(budgetMax >= weeklyBudget)) throw new Error('Il tetto di spesa deve coprire almeno una settimana di budget.');
  if (budgetMax > 20000) throw new Error('Il tetto di spesa non può superare 20.000 €.');
  const problem = taskProblem(game, stats, spec.task, spec.target ?? null);
  if (problem) throw new Error(problem);
  return { task, weeks, weeklyBudget, budgetMax };
}
// The player gives a mandate. `approved` must be true: the interface asks for the confirmation, the engine will not take an unapproved one.
export function createMandate(input, stats, spec, { week, date }) {
  const game = JSON.parse(JSON.stringify(input));
  if (spec.approved !== true) throw new Error('Un incarico allo staff parte solo con la tua approvazione.');
  const { task, weeks, weeklyBudget, budgetMax } = validate(game, stats, spec);
  const capacity = staffCapacity(game);
  if (!capacity.max) throw new Error(capacity.reason);
  if (!capacity.free) throw new Error(`Lo staff ha già ${capacity.used} ${capacity.used === 1 ? 'incarico aperto' : 'incarichi aperti'} su ${capacity.max}: concludine o annullane uno.`);
  const staff = ensure(game);
  const mandate = {
    id: `incarico-${staff.nextId++}`, task: task.id, kind: weeks === 1 ? 'singolo' : 'ricorrente', target: spec.target ?? null, weeks, weeksLeft: weeks, weeksDone: 0,
    weeklyBudget, budgetMax, spent: 0, objective: Math.max(1, Math.round(Number(spec.objective) || task.objective)), points: 0, status: 'attivo', pausedReason: null,
    createdWeek: week, createdDate: date, approvedWeek: week, lastReport: null, results: [], source: SIM
  };
  staff.mandates.push(mandate);
  return { game, mandate };
}
// Edits: the budget, the ceiling, the duration, the objective and the target of an open mandate. What is already spent stays spent.
export function updateMandate(input, stats, id, patch) {
  const game = JSON.parse(JSON.stringify(input));
  const staff = ensure(game);
  const mandate = staff.mandates.find(item => item.id === id);
  if (!mandate || !['attivo', 'sospeso'].includes(mandate.status)) throw new Error('Questo incarico non si può più modificare.');
  const merged = { task: mandate.task, weeks: patch.weeks ?? mandate.weeksLeft, weeklyBudget: patch.weeklyBudget ?? mandate.weeklyBudget, budgetMax: patch.budgetMax ?? mandate.budgetMax, target: patch.target === undefined ? mandate.target : patch.target };
  const { weeks, weeklyBudget, budgetMax } = validate(game, stats, merged, { editing: mandate });
  if (budgetMax < mandate.spent + weeklyBudget && mandate.status === 'attivo') throw new Error(`Il tetto deve coprire quanto già speso (${mandate.spent} €) e almeno un’altra settimana.`);
  Object.assign(mandate, { weeklyBudget, budgetMax, target: merged.target, weeksLeft: weeks, weeks: mandate.weeksDone + weeks, kind: mandate.weeksDone + weeks === 1 ? 'singolo' : 'ricorrente' });
  if (patch.objective !== undefined) mandate.objective = Math.max(1, Math.round(Number(patch.objective)));
  if (mandate.status === 'sospeso' && mandate.pausedReason === 'budget' && mandate.spent + weeklyBudget <= budgetMax) { mandate.status = 'attivo'; mandate.pausedReason = null; }
  return { game, mandate };
}
export function setMandateStatus(input, stats, id, status, { week }) {
  const game = JSON.parse(JSON.stringify(input));
  const mandate = ensure(game).mandates.find(item => item.id === id);
  if (!mandate) throw new Error('Incarico non trovato.');
  if (!['attivo', 'sospeso', 'annullato'].includes(status)) throw new Error('Stato non valido.');
  if (['concluso', 'annullato'].includes(mandate.status)) throw new Error('Questo incarico è già chiuso.');
  if (status === 'attivo') {
    const problem = taskProblem(game, stats, mandate.task, mandate.target);
    if (problem) throw new Error(problem);
    if (mandate.spent + mandate.weeklyBudget > mandate.budgetMax) throw new Error('Il tetto di spesa è esaurito: alzalo per riprendere.');
    mandate.pausedReason = null;
  }
  mandate.status = status;
  if (status === 'annullato') mandate.closedWeek = week;
  if (status === 'sospeso') mandate.pausedReason = 'giocatore';
  return { game, mandate };
}

// ---------- the weekly close ----------
const pick = (items, rand) => items[Math.floor(rand() * items.length)] ?? null;
function runTask(game, stats, mandate, task, quality, rand, week, date) {
  const chance = 0.4 + 0.5 * quality;
  const scale = 0.5 + 0.5 * quality;
  const ok = rand() < chance;
  const effects = { stats: {} };
  let points = 0, text = '';
  if (task.id === 'volontari') {
    const committees = liveCommittees(game);
    const committee = committees.find(item => item.id === mandate.target) ?? [...committees].sort((a, b) => (a.region === game.place?.region ? 0 : 1) - (b.region === game.place?.region ? 0 : 1) || a.activists - b.activists)[0];
    if (!committee) return { ok: false, points: 0, text: 'nessun comitato attivo a cui rivolgersi.', effects };
    committee.fatigue = Math.round(clamp((committee.fatigue ?? 0) + 3));
    if (ok) {
      const added = Math.max(1, Math.round(4 * scale + 1));
      committee.activists += added;
      committee.mobilizedUntil = Math.max(committee.mobilizedUntil ?? 0, week + 2);
      committee.activity = Math.round(clamp((committee.activity ?? 0) + 3));
      effects.stats.popularity = 0.12 * scale;
      points = added;
      text = `${committee.name}: ${added} volontari in più mobilitati (ora ${committee.activists}).`;
    } else text = `${committee.name}: i volontari non rispondono, resta solo la stanchezza.`;
  } else if (task.id === 'dirigenti') {
    const cadres = liveCadres(game);
    const cadre = cadres.find(item => item.id === mandate.target) ?? [...cadres].sort((a, b) => b.grievance - a.grievance)[0];
    if (!cadre) return { ok: false, points: 0, text: 'nessun dirigente da seguire.', effects };
    if (ok) {
      cadre.grievance = Math.round(clamp(cadre.grievance - 6 * scale));
      cadre.loyalty = Math.round(clamp(cadre.loyalty + 3 * scale));
      points = 1;
      text = `Colloquio con ${cadre.person?.displayName ?? cadre.name}: malcontento ${cadre.grievance}, lealtà ${cadre.loyalty}.`;
    } else { cadre.grievance = Math.round(clamp(cadre.grievance + 2)); text = `Colloquio con ${cadre.person?.displayName ?? cadre.name} andato male: il malcontento sale a ${cadre.grievance}.`; }
  } else if (task.id === 'raccolta') {
    if (ok) {
      const amount = Math.round((50 + 170 * quality) * (0.7 + 0.6 * rand()));
      book(game, amount, 'donazioni', 'Raccolta fondi dello staff', date);
      points = amount;
      text = `Raccolti ${amount} € (a fronte di ${mandate.weeklyBudget} € di spesa).`;
    } else text = 'Nessun risultato: la settimana di raccolta non ha portato nulla.';
    if (rand() < 0.04) { effects.stats.reputation = -0.3; text += ' Un sostenitore si lamenta dei toni dell’appello.'; }
  } else if (task.id === 'comunicazione') {
    if (ok) { effects.stats.notoriety = 0.3 * scale; effects.stats.popularity = 0.08 * scale; effects.relations = { media: 0.4 * scale }; points = round2(0.3 * scale); text = 'Comunicati e presenza sui social: più notorietà e un rapporto migliore con le redazioni.'; }
    else text = 'Messaggi poco incisivi: nessun effetto questa settimana.';
    if (rand() < 0.06) { effects.stats.reputation = (effects.stats.reputation ?? 0) - 0.4; text += ' Una battuta fuori posto fa discutere.'; }
  } else if (task.id === 'territorio') {
    if (ok) { effects.stats.popularity = 0.35 * scale; effects.stats.notoriety = 0.1 * scale; points = round2(0.35 * scale); text = 'Presidio di mercati e associazioni: popolarità in crescita.'; }
    else text = 'Appuntamenti saltati o poco partecipati: nessun effetto.';
  } else if (task.id === 'studio') {
    if (ok) { effects.prep = 1 * scale; effects.stats.experience = 0.15 * scale; points = round2(1 * scale); text = 'Dossier consegnato: preparazione elettorale ed esperienza crescono.'; }
    else text = 'Il dossier non è pronto: si rimanda.';
  }
  return { ok, points, text, effects };
}
function mergeEffects(total, effects) {
  for (const [key, value] of Object.entries(effects.stats ?? {})) total.stats[key] = round2((total.stats[key] ?? 0) + value);
  for (const [key, value] of Object.entries(effects.relations ?? {})) { total.relations ??= {}; total.relations[key] = round2((total.relations[key] ?? 0) + value); }
  if (effects.prep) total.prep = round2((total.prep ?? 0) + effects.prep);
}
// Every open mandate works once. Returns { lines, effects } (the effects are for the career to apply: stats, relations, prep); the committees, the leaders and the funds are changed here.
export function staffWeek(game, stats, { week, date, rand }) {
  const staff = game.staff;
  const lines = [];
  const total = { stats: {} };
  if (!staff?.mandates?.some(item => item.status === 'attivo')) return { lines, effects: null };
  for (const mandate of staff.mandates) {
    if (mandate.status !== 'attivo' || (mandate.createdWeek ?? 0) > week) continue;
    const task = STAFF_TASK_BY_ID[mandate.task];
    const report = (text, tone = 'neutral', spent = 0) => { const entry = { week, mandateId: mandate.id, task: task.id, text, tone, spent, source: SIM }; mandate.lastReport = entry; staff.reports = [entry, ...staff.reports].slice(0, STAFF_REPORTS_KEPT); lines.push(`Staff · ${task.label}: ${text}`); };
    const problem = taskProblem(game, stats, mandate.task, mandate.target) ?? (mandate.spent + mandate.weeklyBudget > mandate.budgetMax ? 'budget' : null);
    if (problem === 'budget') { mandate.status = 'sospeso'; mandate.pausedReason = 'budget'; report(`sospeso: il tetto di spesa (${mandate.budgetMax} €) è esaurito. Alzalo per riprendere.`, 'warn'); continue; }
    if (problem) { mandate.status = 'sospeso'; mandate.pausedReason = 'requisiti'; report(`sospeso: ${problem}`, 'warn'); continue; }
    if (game.resources.funds < mandate.weeklyBudget) { report(`in attesa: in cassa mancano i ${mandate.weeklyBudget} € di questa settimana.`, 'warn'); continue; }
    book(game, -mandate.weeklyBudget, 'personale', `Staff: ${task.label}`, date);
    mandate.spent += mandate.weeklyBudget;
    const result = runTask(game, stats, mandate, task, mandateQuality(game, stats, mandate), rand, week, date);
    mandate.weeksDone += 1; mandate.weeksLeft -= 1; mandate.points = round2(mandate.points + result.points);
    mandate.results = [{ week, ok: result.ok, points: result.points, text: result.text }, ...mandate.results].slice(0, 12);
    mergeEffects(total, result.effects);
    report(result.text, result.ok ? 'good' : 'warn', mandate.weeklyBudget);
    if (mandate.points >= mandate.objective || mandate.weeksLeft <= 0) {
      mandate.status = 'concluso'; mandate.closedWeek = week;
      mandate.outcome = mandate.points >= mandate.objective ? 'obiettivo raggiunto' : 'obiettivo non raggiunto';
      lines.push(`Staff · ${task.label}: incarico concluso, ${mandate.outcome} (${round1(mandate.points)} su ${mandate.objective} ${task.unit}, ${mandate.spent} € spesi).`);
    }
  }
  const empty = !Object.keys(total.stats).length && !total.relations && !total.prep;
  return { lines, effects: empty ? null : total };
}

// What the Home shows of the staff: the open mandates with the last report, the room left and the skills.
export function staffView(game, stats = {}) {
  const staff = staffOf(game);
  const open = staff.mandates.filter(item => item.status === 'attivo' || item.status === 'sospeso');
  return { capacity: staffCapacity(game), skills: staffSkills(game, stats), open, closed: staff.mandates.filter(item => !open.includes(item)).slice(-6).reverse(), reports: staff.reports.slice(0, 6), tasks: STAFF_TASKS, status: MANDATE_STATUS };
}
