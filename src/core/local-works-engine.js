// The public works of a comune, a provincia or a regione: from the act that approves them to the opening, the upkeep and the verdict of the term.
// A work belongs to the institution that answers for it (inst.works), with the territory it stands in (stable ISTAT codes), and is paid in points of
// the institution's budget margin, never in euros: the margin is a simulated measure, so a work reserves a share of its cost when it is approved,
// pays the rest as the work is done, and every point leaves the margin once (`drawn`). Benefits arrive only when the work is finished, in proportion
// to its quality; a work never delivers what it has not built. The national projects (project-engine) are another thing: they live in society.projects
// and use the national budget. Pure functions on plain data; the store keeps what they return.
import { uniqueId } from './ids.js?v=20261012-3';
import { fundingOf, stageOf } from './project-engine.js?v=20261012-3';
import { CITY_SHARE_OF_REGION, PROVINCE_SHARE_OF_REGION, serviceIndicatorsOf } from '../data/simulation/local-acts.js?v=20261012-3';
import { ACTIVE_WORK_STAGES, WORK_BY_ID, WORK_RULES, WORK_SITES, WORK_STAGE_LABEL, defaultWorkFor, workTypesFor } from '../data/simulation/local-works.js?v=20261012-3';

const SIM = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;
const weeksBetween = (from, to) => from && to ? Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 604800000) : 0;
const KIND_LABEL = Object.freeze({ comune: 'Comune', provincia: 'Provincia', regione: 'Regione' });

// ---------- state ----------
export const isActiveWork = work => ACTIVE_WORK_STAGES.includes(work?.stage);
export const worksOf = inst => inst?.works ?? [];
export const emptyWorksRecord = () => ({ started: 0, completed: 0, suspended: 0, resumed: 0, budgeted: 0, completedBudget: 0, finalCost: 0, onTime: 0, delayWeeks: 0, overruns: 0, qualitySum: 0, upkeepMissed: 0, protests: 0, agedUpkeep: 0, requestAt: null, source: SIM });
// The euros are a reading of the margin points for the interface: how much money a point stands for at this level.
export const euroOf = (inst, points) => Math.round(points * (WORK_RULES.euroPerPoint[inst?.kind] ?? 0));
export const canManageWorks = inst => inst?.executive?.leader === 'player' && inst.status === 'active';
const mustManage = inst => { if (!canManageWorks(inst)) throw new Error('Solo chi guida l’esecutivo decide sulle opere: un consigliere o un assessore le propone o le segue, non spende il bilancio.'); };
const find = (inst, id) => { const work = worksOf(inst).find(item => item.id === id); if (!work) throw new Error('Opera non trovata.'); return work; };
const spentOf = work => round1(work.cost * clamp(work.progress, 0, 100) / 100);
const setWork = (inst, id, patch) => ({ ...inst, works: worksOf(inst).map(item => item.id === id ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) } : item) });
const withMargin = (inst, delta) => inst.budget ? { ...inst, budget: { ...inst.budget, margin: round1(clamp(inst.budget.margin + delta, 0, 100)) } } : inst;
const withRecord = (inst, change) => ({ ...inst, worksRecord: { ...emptyWorksRecord(), ...(inst.worksRecord ?? {}), ...change(inst.worksRecord ?? emptyWorksRecord()) } });
const placeOf = inst => ({ kind: inst.kind, name: inst.name, region: inst.region ?? inst.place?.region ?? null, provinceCode: inst.place?.provinceCode ?? null, municipalityCode: inst.place?.municipalityCode ?? null });

// ---------- the plan: what a work would cost and deliver (also the validation of a proposal) ----------
const weeksFor = (type, funding, site) => Math.max(8, Math.round(Math.round((type.weeks[0] + type.weeks[1]) / 2) * (funding > 100 ? 1 - (funding - 100) / 200 : 1 + (100 - funding) / 250) * (site.weeks ?? 1)));
export function planWork(inst, { typeId = null, area = null, funding = null, site = 'periferia' } = {}) {
  const type = typeId ? WORK_BY_ID[typeId] : defaultWorkFor(inst?.kind, area);
  if (!inst || inst.kind === 'europa') throw new Error('Il Parlamento europeo non costruisce opere locali.');
  if (!type) throw new Error(area ? `Il ${KIND_LABEL[inst.kind]?.toLowerCase() ?? 'tuo ente'} non ha opere in catalogo su questo tema: scegli il tipo di opera.` : 'Scegli il tipo di opera.');
  if (!type.kinds.includes(inst.kind)) throw new Error(`${type.label}: non è di competenza del ${KIND_LABEL[inst.kind]?.toLowerCase() ?? 'tuo ente'}.`);
  const spot = WORK_SITES[site] ?? WORK_SITES.periferia;
  const level = fundingOf(funding ?? WORK_RULES.fundingDefault);
  const cost = round1(type.cost * level / 100 * (spot.cost ?? 1));
  const quality = round2(clamp(0.55 + 0.45 * level / 100, 0.7, 1.12));
  return { typeId: type.id, label: type.label, area: type.area, site: spot.id, funding: level, cost, commit: round1(cost * WORK_RULES.commit), weeks: weeksFor(type, level, spot), permit: type.permit, upkeepYear: round2(cost * type.upkeep), quality, indicator: type.indicator ?? null, regional: type.regional ?? null, gain: type.gain };
}
// How many works are open and how much of the margin the open ones still have to draw.
export const activeWorks = inst => worksOf(inst).filter(isActiveWork);
export const residualOf = work => round1(Math.max(0, work.cost - work.drawn));
export function worksLedger(inst) {
  const open = activeWorks(inst);
  const done = worksOf(inst).filter(item => item.stage === 'completato');
  const record = { ...emptyWorksRecord(), ...(inst?.worksRecord ?? {}) };
  return {
    open: open.length, max: WORK_RULES.maxActive[inst?.kind] ?? 0, residual: round1(open.reduce((sum, item) => sum + residualOf(item), 0)), drawn: round1(worksOf(inst).reduce((sum, item) => sum + (item.drawn ?? 0), 0)),
    upkeepYear: round2(done.reduce((sum, item) => sum + (item.upkeepYear ?? 0), 0) + (record.agedUpkeep ?? 0)), record
  };
}
// The money still missing to cover a new work (a share of what the open works must still pay counts as already spoken for).
export function worksCoverageGap(inst, commit) {
  if (!inst?.budget) return null;
  const reserve = round1(worksLedger(inst).residual * 0.35);
  return commit + reserve > inst.budget.margin ? `manca la copertura finanziaria per l’opera (servono ${round1(commit)} punti più ${reserve} per i cantieri già aperti, ce ne sono ${round1(inst.budget.margin)})` : null;
}
// Why a work cannot start now (a lowercase reason, or null): no new works in a provisional budget, no more sites than the level can keep open, no money.
export function workGap(inst, commit) {
  if (inst.budget?.provisional) return 'esercizio provvisorio: niente nuove opere finché non passa il bilancio';
  if (activeWorks(inst).length >= (WORK_RULES.maxActive[inst.kind] ?? 0)) return `ci sono già ${WORK_RULES.maxActive[inst.kind]} cantieri aperti: ne serve uno chiuso prima di aprirne un altro`;
  return worksCoverageGap(inst, commit);
}
export const workProblems = (inst, plan) => { const gap = workGap(inst, plan.commit); return gap ? [gap[0].toUpperCase() + gap.slice(1) + '.'] : []; };
// The works the executive can bring on a theme now: those of the catalog of its level on that theme that it is not already building or has not finished within a year, and
// never one work after the other (a quarter between two starts).
export function availableWorkTypes(inst, area, date) {
  const works = worksOf(inst);
  if (works.some(work => work.approvedAt && weeksBetween(work.approvedAt, date) < 12)) return [];
  if ((inst.acts ?? []).some(act => act.category === 'opere' && !['approvato', 'respinto', 'ritirato'].includes(act.stage))) return [];
  return workTypesFor(inst.kind).filter(type => type.area === area && !works.some(work => work.typeId === type.id && (isActiveWork(work) || (work.stage === 'completato' && weeksBetween(work.completedAt, date) < 52))));
}
// The work the executive brings on a theme (its own priorities): one of those available, a funding level and a place.
export function executiveWorkChoice(inst, area, rand, date) {
  const pool = availableWorkTypes(inst, area, date);
  if (!pool.length) return null;
  const type = pool[Math.floor(rand() * pool.length)];
  const draw = rand();
  const sites = ['centro', 'periferia', 'interne'];
  return { typeId: type.id, funding: draw < 0.25 ? 80 : draw < 0.8 ? 100 : 120, site: sites[Math.floor(rand() * sites.length)] };
}

// ---------- approval: the act passed, the work starts ----------
// A work saved by an older act (an `opere` act without a plan) takes the work its theme calls for.
export function startWork(input, act, { date } = {}) {
  let inst = input;
  const plan = act.workPlan ?? planWork(inst, { area: act.area });
  const indicators = inst.indicators ?? null;
  const from = indicators && plan.indicator ? indicators[plan.indicator] ?? null : null;
  const ordinal = worksOf(inst).filter(item => item.typeId === plan.typeId).length + 1;
  const work = {
    id: uniqueId(worksOf(inst), `${inst.id}-opera-${(inst.worksRecord?.started ?? 0) + 1}`), actId: act.id, typeId: plan.typeId, label: plan.label, title: act.title ?? plan.label, area: plan.area, site: plan.site,
    funding: plan.funding, cost: plan.cost, budget0: plan.cost, compensation: 0, committed: plan.commit, drawn: plan.commit, refunded: 0, progress: 0, weeks: plan.weeks, stage: plan.permit > 0 ? 'autorizzazioni' : 'progettazione', permitLeft: plan.permit,
    delayWeeks: 0, overruns: 0, scope: 1, boost: 0, stall: 0, pending: null, upkeepYear: plan.upkeepYear, upkeepIn: null, condition: 100,
    quality: plan.quality, ordinal, byPlayer: act.sponsor?.kind === 'player' || Boolean(act.byDelega), sponsorLabel: act.sponsor?.label ?? null,
    goal: from !== null ? { indicator: plan.indicator, from: round1(from), to: round1(clamp(from + plan.gain * plan.quality, 0, 100)) } : { area: plan.area, gain: round1(plan.gain * plan.quality) },
    territory: placeOf(inst), approvedAt: date, source: SIM
  };
  inst = withMargin(inst, -plan.commit);
  inst = { ...inst, works: [...worksOf(inst), work] };
  inst = withRecord(inst, record => ({ started: record.started + 1, budgeted: round1(record.budgeted + plan.cost) }));
  return { inst, work };
}

// ---------- the decisions ----------
export function suspendWork(input, workId, date) {
  mustManage(input);
  const work = find(input, workId);
  if (!isActiveWork(work)) throw new Error('L’opera non è in corso.');
  const back = round1(Math.max(0, work.drawn - spentOf(work)) * WORK_RULES.refund);
  let inst = withMargin(input, back);
  inst = setWork(inst, workId, { stage: 'sospeso', resumeStage: work.stage, pending: null, drawn: round1(work.drawn - back), refunded: round1((work.refunded ?? 0) + back), suspendedAt: date });
  inst = withRecord(inst, record => ({ suspended: record.suspended + 1 }));
  return { inst, work: find(inst, workId), back };
}
export function resumeWork(input, workId) {
  mustManage(input);
  const work = find(input, workId);
  if (work.stage !== 'sospeso') throw new Error('L’opera non è sospesa.');
  if (activeWorks(input).length >= (WORK_RULES.maxActive[input.kind] ?? 0)) throw new Error('Ci sono già troppi cantieri aperti per riaprirne uno.');
  const need = round1(work.refunded ?? 0);
  if ((input.budget?.margin ?? 0) < need) throw new Error(`Il margine di bilancio (${round1(input.budget.margin)}) non basta per riaprire il cantiere (servono ${need} punti).`);
  let inst = withMargin(input, -need);
  inst = setWork(inst, workId, { stage: work.resumeStage && work.resumeStage !== 'sospeso' ? work.resumeStage : stageOf(work.progress), resumeStage: null, drawn: round1(work.drawn + need), refunded: 0, stall: 2, delayWeeks: work.delayWeeks + 2 });
  inst = withRecord(inst, record => ({ resumed: record.resumed + 1 }));
  return { inst, work: find(inst, workId), paid: need };
}
// More money for a work that has run out of it or is late: 10% on the cost, a share of it paid at once.
export function refundWork(input, workId) {
  mustManage(input);
  const work = find(input, workId);
  if (!isActiveWork(work)) throw new Error('Solo un’opera in corso si rifinanzia.');
  const extra = Math.max(0.5, round1(work.cost * 0.1));
  const pay = round1(extra * WORK_RULES.commit);
  if ((input.budget?.margin ?? 0) < pay) throw new Error(`Il margine di bilancio (${round1(input.budget.margin)}) non basta per rifinanziare l’opera (servono ${pay} punti).`);
  let inst = withMargin(input, -pay);
  inst = setWork(inst, workId, { cost: round1(work.cost + extra), committed: round1(work.committed + pay), drawn: round1(work.drawn + pay), fundsAlert: false, stall: Math.min(work.stall ?? 0, 0) });
  inst = withRecord(inst, record => ({ budgeted: round1(record.budgeted + extra) }));
  return { inst, work: find(inst, workId), extra, paid: pay };
}
// Before the site opens the plan can still be changed: the level of funding moves the cost, the reserve and the time (the difference is paid, or given back, at once).
export function setWorkFunding(input, workId, funding) {
  mustManage(input);
  const work = find(input, workId);
  if (!['autorizzazioni', 'progettazione', 'gara'].includes(work.stage)) throw new Error('Il progetto si modifica solo prima dell’apertura del cantiere.');
  const type = WORK_BY_ID[work.typeId];
  const level = fundingOf(funding);
  if (level === work.funding) throw new Error('Il progetto è già a questo livello.');
  const site = WORK_SITES[work.site] ?? WORK_SITES.periferia;
  const cost = round1(type.cost * level / 100 * (site.cost ?? 1) * work.scope);
  const target = round1(Math.max(cost * WORK_RULES.commit, cost * work.progress / 100));
  const diff = round1(target - work.drawn);
  if (diff > (input.budget?.margin ?? 0)) throw new Error('Il margine di bilancio non basta per l’aumento.');
  let inst = withMargin(input, -diff);
  inst = setWork(inst, workId, { funding: level, cost, committed: round1(Math.max(cost * WORK_RULES.commit, work.committed - (work.cost - cost) * WORK_RULES.commit)), drawn: round1(work.drawn + diff), weeks: weeksFor(type, level, site), quality: round2(clamp(0.55 + 0.45 * level / 100, 0.7, 1.12)), upkeepYear: round2(cost * type.upkeep) });
  inst = withRecord(inst, record => ({ budgeted: round1(record.budgeted + cost - work.cost) }));
  return { inst, work: find(inst, workId), diff };
}
// Scale the work down: it costs less and delivers less (the part already paid for stays).
export function resizeWork(input, workId) {
  mustManage(input);
  const work = find(input, workId);
  if (!isActiveWork(work) || work.stage === 'collaudo') throw new Error('L’opera è troppo avanti per essere ridimensionata.');
  const cost = round1(Math.max(spentOf(work), work.cost * 0.88));
  const released = round1(Math.max(0, work.drawn - cost));
  let inst = withMargin(input, released);
  inst = setWork(inst, workId, { cost, scope: round2(work.scope * 0.88), drawn: round1(work.drawn - released), pending: work.pending?.kind === 'sforamento' ? null : work.pending, stall: 2, delayWeeks: work.delayWeeks + 2, upkeepYear: round2(work.upkeepYear * 0.9) });
  inst = withRecord(inst, record => ({ budgeted: round1(record.budgeted + cost - work.cost) }));
  return { inst, work: find(inst, workId), released };
}
// The answer to a cost overrun or a delay (the same choices as the national projects).
export function settleWorkIssue(input, workId, choice, date = null) {
  mustManage(input);
  const work = find(input, workId);
  const pending = work.pending;
  if (choice === 'integra' && pending?.kind === 'sforamento') {
    const pay = round1(pending.amount * WORK_RULES.commit + pending.amount * 0.2);
    if ((input.budget?.margin ?? 0) < pay) throw new Error(`Il margine di bilancio (${round1(input.budget.margin)}) non basta: servono ${pay} punti.`);
    let inst = withMargin(input, -pay);
    inst = setWork(inst, workId, { cost: round1(work.cost + pending.amount), committed: round1(work.committed + pay), drawn: round1(work.drawn + pay), pending: null, stall: 0 });
    inst = withRecord(inst, record => ({ budgeted: round1(record.budgeted + pending.amount) }));
    return { inst, work: find(inst, workId) };
  }
  if (choice === 'ridimensiona' && pending?.kind === 'sforamento') return resizeWork(input, workId);
  if (choice === 'sospendi') return suspendWork(input, workId, date);
  if (choice === 'commissario') return { inst: setWork(input, workId, { boost: WORK_RULES.hurryWeeks, delayMark: work.delayWeeks, delayNoticed: false }), work };
  if (choice === 'attendi') return { inst: setWork(input, workId, pending?.kind === 'sforamento' ? { stall: WORK_RULES.stallWeeks, delayWeeks: work.delayWeeks + WORK_RULES.stallWeeks, pending: { ...pending, amount: round1(pending.amount * 1.15), waited: 0, raised: false, waits: (pending.waits ?? 0) + 1 } } : { delayMark: work.delayWeeks, delayNoticed: false }), work };
  throw new Error('Scelta non valida.');
}
// The upkeep of a finished work paid at once (the alternative is to let it wear).
export function payUpkeep(input, workId) {
  mustManage(input);
  const work = find(input, workId);
  if (work.stage !== 'completato') throw new Error('Solo un’opera finita si mantiene.');
  const pay = round2(work.upkeepYear * WORK_RULES.upkeepEvery / 52);
  if ((input.budget?.margin ?? 0) < pay) throw new Error(`Il margine di bilancio non basta per la manutenzione (servono ${round1(pay)} punti).`);
  const inst = withMargin(input, -pay);
  return { inst: setWork(inst, workId, { condition: clamp(work.condition + 12, 0, 100), upkeepMissed: 0 }), work: find(inst, workId), paid: pay };
}
// A protest at the site: dialogue costs nothing and calms little, compensation costs margin and calms more, ignoring it feeds the opposition.
export function answerProtest(input, workId, choice) {
  mustManage(input);
  const work = find(input, workId);
  let inst = input;
  if (choice === 'compensa') {
    const pay = round1(Math.max(0.3, work.cost * 0.04));
    if ((input.budget?.margin ?? 0) < pay) throw new Error(`Il margine di bilancio non basta per i ristori (servono ${pay} punti).`);
    inst = withMargin(inst, -pay);
    inst = { ...inst, pressure: clamp(round1((inst.pressure ?? 30) - 4), 0, 100) };
    return { inst: setWork(inst, workId, { compensation: round1((work.compensation ?? 0) + pay) }), work: find(inst, workId), paid: pay };
  }
  if (choice === 'dialoga') return { inst: { ...inst, pressure: clamp(round1((inst.pressure ?? 30) - 2), 0, 100) }, work: find(inst, workId), paid: 0 };
  if (choice === 'ignora') return { inst: { ...inst, pressure: clamp(round1((inst.pressure ?? 30) + 4), 0, 100), executive: inst.executive ? { ...inst.executive, stability: clamp(inst.executive.stability - 2, 0, 100) } : inst.executive }, work: find(inst, workId), paid: 0 };
  throw new Error('Scelta non valida.');
}

// ---------- every week ----------
// The benefits of a finished work: the service of the city (or the province) improves for eight weeks and stays; the region receives a share; the citizens who use it feel it.
function finish(inst, work, date, events) {
  const type = WORK_BY_ID[work.typeId];
  const late = clamp(work.delayWeeks / Math.max(1, work.weeks), 0, 0.35);
  const quality = round2(clamp(0.55 + 0.45 * work.funding / 100, 0.7, 1.12) * work.scope * (1 - late));
  const spot = WORK_SITES[work.site] ?? WORK_SITES.periferia;
  const total = round2(type.gain * quality);
  const segments = {};
  for (const id of type.pleased) segments[id] = round1(1.2 * quality * spot.equity);
  let next = inst;
  let gains;
  if (type.indicator && next.indicators) {
    gains = { [type.indicator]: total };
    next = { ...next, effects: [...(next.effects ?? []), { actId: work.id, title: work.title, indicator: type.indicator, perWeek: round2(total / 8), remaining: 8, delay: 0 }] };
    const list = serviceIndicatorsOf(next.kind);
    const region = list?.find(item => item.id === type.indicator)?.region;
    if (region) events.push({ type: 'effetti', actId: work.id, title: work.title, kind: next.kind, region: next.region, indicators: { [region]: round2(total * (next.kind === 'provincia' ? PROVINCE_SHARE_OF_REGION : CITY_SHARE_OF_REGION)) }, phase: 8, lasting: true, segments });
  } else {
    gains = Object.fromEntries(Object.entries(type.regional ?? {}).map(([id, weight]) => [id, round2(total * weight)]));
    events.push({ type: 'effetti', actId: work.id, title: work.title, kind: next.kind, region: next.region, indicators: gains, phase: 8, lasting: true, segments });
  }
  const finalCost = round1(work.cost + (work.compensation ?? 0));
  const onTime = work.delayWeeks <= 2 && work.overruns === 0;
  next = setWork(next, work.id, { stage: 'completato', progress: 100, completedAt: date, upkeepIn: WORK_RULES.upkeepEvery, condition: 100, result: { quality, late: work.delayWeeks, finalCost, budget: work.budget0 ?? work.cost, gains, onTime }, pending: null });
  next = withRecord(next, record => ({ completed: record.completed + 1, completedBudget: round1((record.completedBudget ?? 0) + (work.budget0 ?? work.cost)), finalCost: round1(record.finalCost + finalCost), onTime: record.onTime + (onTime ? 1 : 0), delayWeeks: record.delayWeeks + work.delayWeeks, overruns: record.overruns + work.overruns, qualitySum: round2(record.qualitySum + quality) }));
  events.push({ type: 'opera-completata', workId: work.id, title: work.title, label: work.label, area: work.area, quality, late: work.delayWeeks, cost: finalCost, budget: work.budget0 ?? work.cost, onTime, byPlayer: Boolean(work.byPlayer), site: work.site, benefit: type.benefit });
  return next;
}
// Who decides when the player does not: the executive settles an overrun by itself (pays if it can, scales down if not).
function autoSettle(inst, work) {
  const pay = round1(work.pending.amount * WORK_RULES.commit + work.pending.amount * 0.2);
  if ((inst.budget?.margin ?? 0) >= pay * 1.5) {
    let next = withMargin(inst, -pay);
    next = setWork(next, work.id, { cost: round1(work.cost + work.pending.amount), committed: round1(work.committed + work.pending.amount * WORK_RULES.commit + work.pending.amount * 0.2), drawn: round1(work.drawn + pay), pending: null, stall: 0 });
    return withRecord(next, record => ({ budgeted: round1(record.budgeted + work.pending.amount) }));
  }
  const cost = round1(Math.max(spentOf(work), work.cost * 0.88));
  const released = round1(Math.max(0, work.drawn - cost));
  const next = withMargin(inst, released);
  return withRecord(setWork(next, work.id, { cost, scope: round2(work.scope * 0.88), drawn: round1(work.drawn - released), pending: null, stall: 2, delayWeeks: work.delayWeeks + 2 }), record => ({ budgeted: round1(record.budgeted + cost - work.cost) }));
}
// One week of the works of the institution. ctx: { date, rand }. Returns { inst, events }.
export function advanceWorks(input, { date, rand }) {
  const events = [];
  if (!input || input.kind === 'europa' || !worksOf(input).length) return { inst: input, events };
  let inst = input;
  const leads = canManageWorks(inst);
  const provisional = Boolean(inst.budget?.provisional);
  const efficiency = clamp(0.35 + (inst.executive?.stability ?? 60) / 100 * 0.6 - (provisional ? 0.15 : 0), 0.2, 1);
  for (const original of worksOf(inst)) {
    let work = find(inst, original.id);
    const type = WORK_BY_ID[work.typeId];
    if (!type) continue;
    if (work.stage === 'completato') { inst = upkeepWeek(inst, work, date, events, leads); continue; }
    if (!isActiveWork(work)) continue;
    const patch = patchOf => { inst = setWork(inst, work.id, patchOf); work = find(inst, work.id); };
    // A cost overrun waits for the decision; the executive decides by itself when the player does not lead, and without an answer the work falls back on waiting.
    if (work.pending) {
      if (!work.pending.raised) {
        patch({ pending: { ...work.pending, raised: true } });
        events.push({ type: 'opera-sforamento', workId: work.id, title: work.title, amount: work.pending.amount, cost: work.cost, waits: work.pending.waits ?? 0, leads });
        if (!leads) { inst = autoSettle(inst, work); events.push({ type: 'opera-sforamento-risolto', workId: work.id, title: work.title }); }
      } else if (leads) {
        const waited = (work.pending.waited ?? 0) + 1;
        if (waited >= WORK_RULES.decisionWeeks) patch({ stall: WORK_RULES.stallWeeks, delayWeeks: work.delayWeeks + WORK_RULES.stallWeeks, pending: { ...work.pending, amount: round1(work.pending.amount * 1.15), waited: 0, raised: false, waits: (work.pending.waits ?? 0) + 1 } });
        else patch({ pending: { ...work.pending, waited } });
      }
      inst = setWork(inst, work.id, w => ({ delayWeeks: w.delayWeeks + 1 }));
      continue;
    }
    if (work.stage === 'autorizzazioni') {
      const left = work.permitLeft - (provisional ? 0.5 : 1);
      patch(left <= 0 ? { permitLeft: 0, stage: 'progettazione' } : { permitLeft: left });
      continue;
    }
    if (work.stall > 0) { patch({ stall: work.stall - 1 }); continue; }
    const speed = clamp((0.85 + 0.3 * efficiency) * clamp(0.7 + 0.3 * work.funding / 100, 0.8, 1.1) * (provisional ? 0.5 : 1) * (work.boost > 0 ? 1.4 : 1), 0.25, 1.6);
    if (work.boost > 0) patch({ boost: work.boost - 1 });
    const stageWeight = work.stage === 'gara' ? 1.6 : work.stage === 'cantiere' ? 1 : 0.6;
    const risk = type.risk * (1.3 - efficiency) * (work.funding < 100 ? 1 + (100 - work.funding) / 50 : 1) * stageWeight * (work.boost > 0 ? 0.5 : 1);
    if (rand() < risk) {
      const lost = 1 + Math.floor(rand() * 3);
      patch({ delayWeeks: work.delayWeeks + lost, stall: lost - 1 });
      if (work.delayWeeks - (work.delayMark ?? 0) >= 3 && !work.delayNoticed) {
        patch({ delayNoticed: true });
        inst = { ...inst, pressure: clamp(round1((inst.pressure ?? 30) + 1), 0, 100), executive: inst.executive ? { ...inst.executive, stability: clamp(inst.executive.stability - 1, 0, 100) } : inst.executive };
        events.push({ type: 'opera-ritardo', workId: work.id, title: work.title, delay: work.delayWeeks, stage: WORK_STAGE_LABEL[work.stage], leads });
      }
      continue;
    }
    // The money follows the work: what has been done and not yet drawn is taken from the margin; without it the site stops.
    const progress = round1(Math.min(100, work.progress + 100 / work.weeks * speed));
    const due = round1(Math.max(0, work.cost * progress / 100 - work.drawn));
    if (due > (inst.budget?.margin ?? 0)) {
      patch({ delayWeeks: work.delayWeeks + 1, stall: 1 });
      if (!work.fundsAlert) { patch({ fundsAlert: true }); events.push({ type: 'opera-fondi', workId: work.id, title: work.title, need: due, margin: inst.budget?.margin ?? 0, leads }); }
      continue;
    }
    if (due > 0) inst = withMargin(inst, -due);
    const stage = stageOf(progress);
    patch({ progress, stage, drawn: round1(work.drawn + due), fundsAlert: false });
    if (stage === 'cantiere' && work.funding < 110 && rand() < WORK_RULES.overrunChance * (1 + (110 - work.funding) / 60)) {
      const share = WORK_RULES.overrunShare;
      patch({ overruns: work.overruns + 1, pending: { kind: 'sforamento', amount: round1(work.cost * (share[0] + (share[1] - share[0]) * rand())), raised: false, waited: 0, waits: 0 } });
    }
    // A site that disturbs the neighbourhood: the service it touches loses a little every week it stays open, and a protest may come.
    if (stage === 'cantiere' && type.disruption && inst.indicators?.[type.disruption.indicator] !== undefined) inst = { ...inst, indicators: { ...inst.indicators, [type.disruption.indicator]: round1(clamp(inst.indicators[type.disruption.indicator] - type.disruption.perWeek, 0, 100)) } };
    const canProtest = stage === 'cantiere' && (type.disruption || work.delayWeeks >= 4) && (!work.protestAt || weeksBetween(work.protestAt, date) >= 10);
    if (canProtest && rand() < 0.025 + Math.min(0.06, work.delayWeeks * 0.005) + (type.disruption ? 0.015 : 0)) {
      patch({ protestAt: date });
      inst = withRecord(inst, record => ({ protests: record.protests + 1 }));
      events.push({ type: 'opera-protesta', workId: work.id, title: work.title, label: work.label, delay: work.delayWeeks, leads });
    }
    if (progress >= 100) inst = finish(inst, find(inst, work.id), date, events);
  }
  return { inst, events };
}
// A finished work wears out unless it is kept: every quarter its upkeep is paid from the margin; a work left unpaid loses condition and, below the threshold, part of its benefit.
function upkeepWeek(inst, work, date, events, leads) {
  if (work.upkeepIn === null || work.upkeepIn === undefined) return setWork(inst, work.id, { upkeepIn: WORK_RULES.upkeepEvery });
  if (work.upkeepIn > 1) return setWork(inst, work.id, { upkeepIn: work.upkeepIn - 1 });
  const pay = round2(work.upkeepYear * WORK_RULES.upkeepEvery / 52);
  let next = inst;
  const type = WORK_BY_ID[work.typeId];
  if ((next.budget?.margin ?? 0) >= pay && !next.budget?.provisional) {
    next = withMargin(next, -pay);
    const condition = clamp(work.condition + 3, 0, 100);
    next = setWork(next, work.id, { condition, upkeepIn: WORK_RULES.upkeepEvery, upkeepMissed: 0 });
    if (work.degraded && condition >= 70 && type) next = restoreBenefit(next, work, events);
    return next;
  }
  const condition = clamp(work.condition - WORK_RULES.wear, 0, 100);
  next = setWork(next, work.id, { condition, upkeepIn: WORK_RULES.upkeepEvery, upkeepMissed: (work.upkeepMissed ?? 0) + 1 });
  next = withRecord(next, record => ({ upkeepMissed: record.upkeepMissed + 1 }));
  events.push({ type: 'opera-manutenzione', workId: work.id, title: work.title, condition, due: pay, leads });
  if (condition < WORK_RULES.worn && !work.degraded && type) next = wearBenefit(next, work, events);
  return next;
}
// The benefit lost (half of the gain, on the same indicator) when a work is left to wear, given back when it is kept again.
function benefitShift(inst, work, sign, events, kind) {
  const type = WORK_BY_ID[work.typeId];
  const total = round2(type.gain * (work.result?.quality ?? 1) * 0.5) * sign;
  let next = inst;
  if (type.indicator && next.indicators) {
    next = { ...next, effects: [...(next.effects ?? []), { actId: work.id, title: `${work.title} (${kind})`, indicator: type.indicator, perWeek: round2(total / 8), remaining: 8, delay: 0 }] };
    const region = serviceIndicatorsOf(next.kind)?.find(item => item.id === type.indicator)?.region;
    if (region) events.push({ type: 'effetti', actId: work.id, title: `${work.title} (${kind})`, kind: next.kind, region: next.region, indicators: { [region]: round2(total * (next.kind === 'provincia' ? PROVINCE_SHARE_OF_REGION : CITY_SHARE_OF_REGION)) }, phase: 8, lasting: true, segments: {} });
  } else events.push({ type: 'effetti', actId: work.id, title: `${work.title} (${kind})`, kind: next.kind, region: next.region, indicators: Object.fromEntries(Object.entries(type.regional ?? {}).map(([id, weight]) => [id, round2(total * weight)])), phase: 8, lasting: true, segments: {} });
  return next;
}
const wearBenefit = (inst, work, events) => { const next = benefitShift(inst, work, -1, events, 'degrado'); events.push({ type: 'opera-degrado', workId: work.id, title: work.title }); return setWork(next, work.id, { degraded: true }); };
const restoreBenefit = (inst, work, events) => setWork(benefitShift(inst, work, 1, events, 'ripristino'), work.id, { degraded: false });

// ---------- the request of the citizens (the start of the chain) ----------
// A service of the territory that the level can improve with a work, weak, with no work open or approved on that theme and a request not made recently:
// the citizens ask for it. valueOf(area) reads the service (the city's or the province's own, the region's from the society simulation).
export function workRequestFor(inst, { date, valueOf }) {
  if (!inst || inst.status !== 'active' || inst.kind === 'europa' || !inst.budget || inst.budget.provisional) return null;
  const last = inst.worksRecord?.requestAt;
  if (last && weeksBetween(last, date) < WORK_RULES.requestGapWeeks) return null;
  const busy = new Set([...activeWorks(inst).map(work => work.area), ...(inst.acts ?? []).filter(act => act.category === 'opere' && !['approvato', 'respinto', 'ritirato'].includes(act.stage)).map(act => act.area), ...(inst.commitments ?? []).filter(item => item.status === 'aperto').map(item => item.area)]);
  const rows = workTypesFor(inst.kind).filter(type => !busy.has(type.area)).map(type => ({ type, value: valueOf(type.area) })).filter(item => Number.isFinite(item.value) && item.value < 46).sort((a, b) => a.value - b.value || (a.type.id < b.type.id ? -1 : 1));
  const top = rows[0];
  return top ? { area: top.type.area, typeId: top.type.id, label: top.type.label, value: Math.round(top.value) } : null;
}

// ---------- what the player's activities do to the works (effects.local.works*) ----------
// A site visit, a technical meeting, a control of the delega: boost or unblock the works the player can steer; an inspection puts pressure on the works in trouble.
export function applyWorkActivity(inst, local = {}) {
  if (!inst || inst.status !== 'active' || !worksOf(inst).length) return inst;
  const leads = inst.executive?.leader === 'player';
  const areas = inst.playerDelega?.areas ?? [];
  const steer = work => isActiveWork(work) && (leads || (inst.playerDelega && areas.includes(work.area)));
  let next = inst;
  if (local.workBoost) next = { ...next, works: worksOf(next).map(work => steer(work) && work.stage !== 'autorizzazioni' ? { ...work, boost: Math.max(work.boost ?? 0, local.workBoost) } : work) };
  if (local.workUnblock) next = { ...next, works: worksOf(next).map(work => steer(work) && (work.stall > 0 || work.fundsAlert) ? { ...work, stall: 0, delayMark: work.delayWeeks, delayNoticed: false } : work) };
  if (local.scrutiny) {
    const trouble = activeWorks(next).filter(work => work.delayWeeks >= 3 || work.pending || work.fundsAlert).length;
    if (trouble) next = { ...next, pressure: clamp(round1((next.pressure ?? 30) + 2.5 * Math.min(2, trouble)), 0, 100), executive: next.executive ? { ...next.executive, stability: clamp(next.executive.stability - Math.min(2, trouble), 0, 100) } : next.executive };
  }
  return next;
}
// What the career engine reads to open the activities of the works: how many works the player can steer, how many are in trouble.
export function worksSignals(institutions = []) {
  const out = { steer: 0, trouble: 0, any: 0 };
  for (const inst of institutions) {
    if (!inst || inst.status !== 'active' || inst.kind === 'europa') continue;
    const open = activeWorks(inst);
    out.any += open.length;
    const leads = inst.executive?.leader === 'player';
    const areas = inst.playerDelega?.areas ?? [];
    out.steer += open.filter(work => leads || (inst.playerDelega && areas.includes(work.area))).length;
    out.trouble += open.filter(work => work.delayWeeks >= 3 || work.pending || work.fundsAlert).length;
  }
  return out;
}
// What the interface shows of a work: the stage, the time left, the money in points and in euros.
export function workView(inst, work) {
  const left = isActiveWork(work) ? Math.max(0, Math.round((100 - work.progress) / 100 * work.weeks)) + (work.permitLeft ?? 0) : 0;
  return { ...work, stageLabel: WORK_STAGE_LABEL[work.stage] ?? work.stage, weeksLeft: left, spent: spentOf(work), residual: residualOf(work), costEuro: euroOf(inst, work.cost), spentEuro: euroOf(inst, spentOf(work)), type: WORK_BY_ID[work.typeId] ?? null };
}
