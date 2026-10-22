// The public works of a comune, a provincia or a regione: from the act that approves them to the opening, the upkeep and the verdict of the term.
// A work belongs to the institution that answers for it (inst.works), with the territory it stands in (stable ISTAT codes), and is paid in points of
// the institution's budget margin, never in euros: the margin is a simulated measure, so a work reserves a share of its cost when it is approved,
// pays the rest as the work is done, and every point leaves the margin once (`drawn`). Another institution of the career can co-finance a work with a
// fixed contribution (`cofin`), agreed in simulated euros and paid once from its own margin; what it pays is not drawn again from the owner's.
// Benefits arrive only when the work is finished, in proportion to its quality; a work never delivers what it has not built. The national projects (project-engine) are another thing: they live in society.projects
// and use the national budget. Pure functions on plain data; the store keeps what they return.
import { uniqueId } from './ids.js?v=20261022-15';
import { fundingOf, stageOf } from './project-engine.js?v=20261022-15';
import { PORTFOLIO_AREAS } from '../data/simulation/office-rules.js?v=20261022-15';
import { regionShareOf } from './territory-share.js?v=20261022-15';
import { serviceIndicatorsOf } from '../data/simulation/local-acts.js?v=20261022-15';
import { ACTIVE_WORK_STAGES, COFIN_LEVEL, WORK_BY_ID, WORK_RULES, WORK_SITES, WORK_STAGE_LABEL, defaultWorkFor, workTypesFor } from '../data/simulation/local-works.js?v=20261022-15';

const SIM = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;
const weeksBetween = (from, to) => from && to ? Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 604800000) : 0;
const KIND_LABEL = Object.freeze({ comune: 'Comune', provincia: 'Provincia', regione: 'Regione' });

// ---------- state ----------
export const isActiveWork = work => ACTIVE_WORK_STAGES.includes(work?.stage);
export const worksOf = inst => inst?.works ?? [];
// The finished works that left the detailed list: each keeps what its upkeep and its wear need (and its verdict), so they go on being paid and judged.
export const archiveOf = inst => inst?.worksArchive ?? [];
export const emptyWorksRecord = () => ({ started: 0, completed: 0, suspended: 0, resumed: 0, budgeted: 0, completedBudget: 0, finalCost: 0, onTime: 0, delayWeeks: 0, overruns: 0, qualitySum: 0, upkeepMissed: 0, protests: 0, agedUpkeep: 0, archived: 0, cofinReceived: 0, cofinPaid: 0, requestAt: null, source: SIM });
// The euros are a reading of the margin points for the interface: how much money a point stands for at this level.
export const euroOf = (inst, points) => Math.round(points * (WORK_RULES.euroPerPoint[inst?.kind] ?? 0));
export const canManageWorks = inst => inst?.executive?.leader === 'player' && inst.status === 'active';
const mustManage = inst => { if (!canManageWorks(inst)) throw new Error('Solo chi guida l’esecutivo decide sulle opere: un consigliere o un assessore le propone o le segue, non spende il bilancio.'); };
const find = (inst, id) => { const work = worksOf(inst).find(item => item.id === id) ?? archiveOf(inst).find(item => item.id === id); if (!work) throw new Error('Opera non trovata.'); return work; };
const spentOf = work => round1(work.cost * clamp(work.progress, 0, 100) / 100);
// What the partners paid for the work (points of the owner's margin) and what the work has drawn in all: the owner's reserve and the contributions.
export const externalOf = work => { const paid = (work?.cofin ?? []).filter(item => item.status === 'erogato'); return paid.length ? round2(paid.reduce((sum, item) => sum + item.ownerPts, 0)) : 0; };
const bookedOf = work => { const external = externalOf(work); return external ? round2(work.drawn + external) : work.drawn; };
const ownSpentOf = work => Math.max(0, round1(spentOf(work) - externalOf(work)));
const setWork = (inst, id, patch) => {
  const apply = item => item.id === id ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) } : item;
  return { ...inst, works: worksOf(inst).map(apply), ...(archiveOf(inst).some(item => item.id === id) ? { worksArchive: archiveOf(inst).map(apply) } : {}) };
};
const withMargin = (inst, delta) => inst.budget ? { ...inst, budget: { ...inst.budget, margin: round1(clamp(inst.budget.margin + delta, 0, 100)) } } : inst;
const withRecord = (inst, change) => { const record = { ...emptyWorksRecord(), ...(inst.worksRecord ?? {}) }; return { ...inst, worksRecord: { ...record, ...change(record) } }; };
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
export const residualOf = work => round1(Math.max(0, work.cost - bookedOf(work)));
// agedUpkeep: the yearly upkeep of the archived works, summed from their own records (it is a reading of them, kept in the record only for the interface).
export const agedUpkeepOf = archive => round2((archive ?? []).reduce((sum, item) => sum + (item.upkeepYear ?? 0), 0));
export function worksLedger(inst) {
  const open = activeWorks(inst);
  const done = worksOf(inst).filter(item => item.stage === 'completato');
  const record = { ...emptyWorksRecord(), ...(inst?.worksRecord ?? {}) };
  const archive = archiveOf(inst);
  return {
    open: open.length, max: WORK_RULES.maxActive[inst?.kind] ?? 0, residual: round1(open.reduce((sum, item) => sum + residualOf(item), 0)), drawn: round1(worksOf(inst).reduce((sum, item) => sum + (item.drawn ?? 0), 0)),
    // The yearly upkeep of every finished work, listed or archived: each one pays its own (the archive's total is only the sum of its records, never a second charge).
    upkeepYear: round2(done.reduce((sum, item) => sum + (item.upkeepYear ?? 0), 0) + agedUpkeepOf(archive)), received: round2(worksOf(inst).reduce((sum, item) => sum + externalOf(item), 0)), archived: archive.length, record
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
// The works the executive can bring on a theme now: those of the catalog of its level on that theme that it is not already building or has not finished within a year, and
// never one work after the other (a quarter between two starts).
export function availableWorkTypes(inst, area, date) {
  const works = [...worksOf(inst), ...archiveOf(inst)];
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
  const ordinal = [...worksOf(inst), ...archiveOf(inst)].filter(item => item.typeId === plan.typeId).length + 1;
  const work = {
    id: uniqueId([...worksOf(inst), ...archiveOf(inst)], `${inst.id}-opera-${(inst.worksRecord?.started ?? 0) + 1}`), actId: act.id, typeId: plan.typeId, label: plan.label, title: act.title ?? plan.label, area: plan.area, site: plan.site,
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
  // The partners' contributions stay in the work while it is suspended: only the owner's own reserve that has not been spent comes back.
  const back = round1(Math.max(0, work.drawn - ownSpentOf(work)) * WORK_RULES.refund);
  let inst = withMargin(input, back);
  inst = setWork(inst, workId, { stage: 'sospeso', resumeStage: work.stage, pending: null, drawn: round1(work.drawn - back), refunded: round1((work.refunded ?? 0) + back), suspendedAt: date });
  inst = withRecord(inst, record => ({ suspended: record.suspended + 1 }));
  // A site stopped is a failure the majority notices: once for each suspension, more the further the work had gone.
  inst = tension(inst, find(inst, workId), `sospensione-${inst.worksRecord.suspended}`, round1(WORK_RULES.fallout.suspend + work.progress / 100 * 2), 'sospensione', []);
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
  if (cost < externalOf(work)) throw new Error('Il contributo degli altri enti supera il nuovo costo: il progetto non può scendere tanto.');
  const target = round1(Math.max(cost * WORK_RULES.commit, cost * work.progress / 100));
  const diff = Math.max(-work.drawn, round1(target - bookedOf(work)));
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
  const cost = round1(Math.max(spentOf(work), externalOf(work), work.cost * 0.88));
  const released = round1(Math.min(work.drawn, Math.max(0, bookedOf(work) - cost)));
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
    const pay = overrunPay(work, pending.amount);
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
    if (region) events.push({ type: 'effetti', actId: work.id, title: work.title, kind: next.kind, region: next.region, indicators: { [region]: round2(total * regionShareOf(next)) }, phase: 8, lasting: true, segments });
  } else {
    gains = Object.fromEntries(Object.entries(type.regional ?? {}).map(([id, weight]) => [id, round2(total * weight)]));
    events.push({ type: 'effetti', actId: work.id, title: work.title, kind: next.kind, region: next.region, indicators: gains, phase: 8, lasting: true, segments });
  }
  const finalCost = round1(work.cost + (work.compensation ?? 0));
  const onTime = work.delayWeeks <= 2 && work.overruns === 0;
  next = setWork(next, work.id, { stage: 'completato', progress: 100, completedAt: date, upkeepIn: WORK_RULES.upkeepEvery, condition: 100, result: { quality, late: work.delayWeeks, finalCost, budget: work.budget0 ?? work.cost, gains, onTime, external: externalOf(work) }, pending: null });
  next = withRecord(next, record => ({ completed: record.completed + 1, completedBudget: round1((record.completedBudget ?? 0) + (work.budget0 ?? work.cost)), finalCost: round1(record.finalCost + finalCost), onTime: record.onTime + (onTime ? 1 : 0), delayWeeks: record.delayWeeks + work.delayWeeks, overruns: record.overruns + work.overruns, qualitySum: round2(record.qualitySum + quality) }));
  events.push({ type: 'opera-completata', workId: work.id, title: work.title, label: work.label, area: work.area, quality, late: work.delayWeeks, cost: finalCost, budget: work.budget0 ?? work.cost, onTime, byPlayer: Boolean(work.byPlayer), site: work.site, benefit: type.benefit });
  return next;
}
// Who decides when the player does not: the executive settles an overrun by itself (pays if it can, scales down if not).
// What an overrun costs the margin now: the share already committed plus a reserve, and never less than the part of the extra cost that the work already done has used (otherwise a late overrun leaves the work with more progress than money drawn).
const overrunPay = (work, amount) => round1(Math.max(amount * WORK_RULES.commit + amount * 0.2, amount * (work.progress ?? 0) / 100));
function autoSettle(inst, work) {
  const pay = overrunPay(work, work.pending.amount);
  if ((inst.budget?.margin ?? 0) >= pay * 1.5) {
    let next = withMargin(inst, -pay);
    next = setWork(next, work.id, { cost: round1(work.cost + work.pending.amount), committed: round1(work.committed + pay), drawn: round1(work.drawn + pay), pending: null, stall: 0 });
    return withRecord(next, record => ({ budgeted: round1(record.budgeted + work.pending.amount) }));
  }
  const cost = round1(Math.max(spentOf(work), externalOf(work), work.cost * 0.88));
  const released = round1(Math.min(work.drawn, Math.max(0, bookedOf(work) - cost)));
  const next = withMargin(inst, released);
  return withRecord(setWork(next, work.id, { cost, scope: round2(work.scope * 0.88), drawn: round1(work.drawn - released), pending: null, stall: 2, delayWeeks: work.delayWeeks + 2 }), record => ({ budgeted: round1(record.budgeted + cost - work.cost) }));
}
// One week of the works of the institution. ctx: { date, rand }. Returns { inst, events }.
export function advanceWorks(input, { date, rand }) {
  const events = [];
  if (!input || input.kind === 'europa' || (!worksOf(input).length && !archiveOf(input).length)) return { inst: input, events };
  let inst = input;
  const leads = canManageWorks(inst);
  const provisional = Boolean(inst.budget?.provisional);
  const efficiency = clamp(0.35 + (inst.executive?.stability ?? 60) / 100 * 0.6 - (provisional ? 0.15 : 0), 0.2, 1);
  // The finished works of the archive go on being kept and wearing like the listed ones: the same step, on their own records.
  for (const original of [...worksOf(inst), ...archiveOf(inst)]) {
    let work = find(inst, original.id);
    const type = WORK_BY_ID[work.typeId];
    if (!type) continue;
    if (work.stage === 'completato') { inst = upkeepWeek(inst, work, date, events, leads); continue; }
    if (!isActiveWork(work)) continue;
    const patch = patchOf => { inst = setWork(inst, work.id, patchOf); work = find(inst, work.id); };
    // The trouble of a site that lasts weighs on the majority, once for each threshold crossed.
    inst = falloutOf(inst, work, events);
    work = find(inst, work.id);
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
    const due = round1(Math.max(0, work.cost * progress / 100 - bookedOf(work)));
    if (due > (inst.budget?.margin ?? 0)) {
      patch({ delayWeeks: work.delayWeeks + 1, stall: 1, fundsWeeks: (work.fundsWeeks ?? 0) + 1 });
      if (!work.fundsAlert) { patch({ fundsAlert: true }); events.push({ type: 'opera-fondi', workId: work.id, title: work.title, need: due, margin: inst.budget?.margin ?? 0, leads }); }
      continue;
    }
    if (due > 0) inst = withMargin(inst, -due);
    const stage = stageOf(progress);
    patch({ progress, stage, drawn: round1(work.drawn + due), fundsAlert: false, fundsWeeks: 0 });
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
      inst = tension(inst, find(inst, work.id), `protesta-${date}`, WORK_RULES.fallout.protest, 'protesta', events);
      events.push({ type: 'opera-protesta', workId: work.id, title: work.title, label: work.label, delay: work.delayWeeks, leads });
    }
    if (progress >= 100) inst = finish(inst, find(inst, work.id), date, events);
  }
  return { inst: archiveClosedWorks(inst, date), events };
}
// ---------- the tension on the majority ----------
// A work in trouble costs the groups of the majority a few points of cohesion (the cohesion of the groups of this council, not the party's): each problem once, by
// threshold, with its weight in proportion to how long and how serious it is. The group that holds the portfolio of the work answers for it more than the others,
// the group of the head of the executive a little less. Consent, pressure and the stability of the executive move with their own rules.
function tension(inst, work, id, loss, why, events) {
  if ((work.fallout ?? []).includes(id)) return inst;
  const mark = setWork(inst, work.id, w => ({ fallout: [...(w.fallout ?? []), id] }));
  const majority = (mark.groups ?? []).filter(group => group.side === 'maggioranza');
  if (!majority.length || !(loss > 0)) return mark;
  const holders = new Set((mark.executive?.members ?? []).filter(member => (PORTFOLIO_AREAS[mark.kind]?.[member.portfolio] ?? []).includes(work.area)).map(member => member.groupId));
  const hit = [];
  const groups = mark.groups.map(group => {
    if (group.side !== 'maggioranza') return group;
    const cut = round1(loss * (holders.has(group.id) ? 1.5 : group.id === mark.executive?.groupId ? 0.5 : 1));
    hit.push({ id: group.id, label: group.label, cut });
    return { ...group, cohesion: clamp(Math.round(group.cohesion - cut), 0, 100) };
  });
  events?.push({ type: 'opera-tensione', workId: work.id, title: work.title, why, loss, groups: hit, leads: canManageWorks(mark) });
  return { ...mark, groups };
}
// The thresholds of an open work: weeks of delay (8, 16, 26), a cost overrun left unanswered, a site stopped for lack of funds.
function falloutOf(inst, work, events) {
  const rules = WORK_RULES.fallout;
  let next = inst;
  for (const tier of rules.delay) if (work.delayWeeks >= tier.weeks) next = tension(next, find(next, work.id), `ritardo-${tier.weeks}`, tier.loss, `${tier.weeks} settimane di ritardo`, events);
  if ((work.pending?.waits ?? 0) >= 2) next = tension(next, find(next, work.id), 'sforamento', rules.overrun, 'sforamento senza risposta', events);
  if ((work.fundsWeeks ?? 0) >= rules.fundsWeeks) next = tension(next, find(next, work.id), 'fondi', rules.funds, 'cantiere fermo per mancanza di fondi', events);
  return next;
}
// ---------- the archive of the finished works ----------
// Past `keepClosed` finished works the oldest pass to the archive: a record with the verdict (cost, quality, delay) and the state the upkeep and the wear need. The totals
// of the term live in the worksRecord and do not change; the archived work pays its own upkeep, so the aggregate (agedUpkeep) is only a reading of those records.
const slimWork = (work, date) => ({
  id: work.id, actId: work.actId ?? null, typeId: work.typeId, label: work.label, title: work.title, area: work.area, site: work.site, stage: 'completato', progress: 100, cost: work.cost, budget0: work.budget0 ?? work.cost,
  compensation: work.compensation ?? 0, weeks: work.weeks, delayWeeks: work.delayWeeks ?? 0, overruns: work.overruns ?? 0, funding: work.funding, scope: work.scope ?? 1, quality: work.quality ?? null, condition: work.condition ?? 100,
  upkeepYear: work.upkeepYear ?? 0, upkeepIn: work.upkeepIn ?? WORK_RULES.upkeepEvery, upkeepMissed: work.upkeepMissed ?? 0, degraded: Boolean(work.degraded), byPlayer: Boolean(work.byPlayer), territory: work.territory ?? null,
  approvedAt: work.approvedAt ?? null, completedAt: work.completedAt ?? null, archivedAt: date,
  result: work.result ? { quality: work.result.quality, late: work.result.late, finalCost: work.result.finalCost, budget: work.result.budget, onTime: work.result.onTime, external: work.result.external ?? 0 } : null, source: SIM
});
export function archiveClosedWorks(inst, date) {
  const done = worksOf(inst).filter(work => work.stage === 'completato').sort((a, b) => String(a.completedAt ?? '').localeCompare(String(b.completedAt ?? '')) || a.id.localeCompare(b.id));
  const surplus = done.length - WORK_RULES.keepClosed;
  if (surplus <= 0) return inst;
  const old = done.slice(0, surplus);
  const gone = new Set(old.map(work => work.id));
  const archive = [...archiveOf(inst), ...old.map(work => slimWork(work, date))];
  return withRecord({ ...inst, works: worksOf(inst).filter(work => !gone.has(work.id)), worksArchive: archive }, record => ({ archived: record.archived + old.length, agedUpkeep: agedUpkeepOf(archive) }));
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
    if (region) events.push({ type: 'effetti', actId: work.id, title: `${work.title} (${kind})`, kind: next.kind, region: next.region, indicators: { [region]: round2(total * regionShareOf(next)) }, phase: 8, lasting: true, segments: {} });
  } else events.push({ type: 'effetti', actId: work.id, title: `${work.title} (${kind})`, kind: next.kind, region: next.region, indicators: Object.fromEntries(Object.entries(type.regional ?? {}).map(([id, weight]) => [id, round2(total * weight)])), phase: 8, lasting: true, segments: {} });
  return next;
}
const wearBenefit = (inst, work, events) => { const next = benefitShift(inst, work, -1, events, 'degrado'); events.push({ type: 'opera-degrado', workId: work.id, title: work.title }); return setWork(next, work.id, { degraded: true }); };
const restoreBenefit = (inst, work, events) => setWork(benefitShift(inst, work, 1, events, 'ripristino'), work.id, { degraded: false });

// ---------- co-financing between institutions ----------
// Only the institutions the career holds have a budget in the game, so only they can finance one another: the head of the executive that builds asks another
// institution of the career that covers the same territory for a fixed contribution (a share of the cost, 10% to 50% in all) before the site opens. The request is an
// act of the partner (category `cofinanziamento`), decided by its competent organ like any other; the money moves once, when the act has passed and the partner has
// the cover: it leaves the partner's margin (`partnerPts`) and enters the work (`ownerPts`), the owner's reserve shrinks by the same amount. The sum is agreed in
// simulated euros, so each side reads it in its own points. Overruns and upkeep stay with the institution that builds.
const eur = value => value >= 1e6 ? `${round1(value / 1e6)} milioni €` : `${Math.round(value / 1000)} mila €`;
const lower = text => text[0].toLowerCase() + text.slice(1);
const upper = text => text[0].toUpperCase() + text.slice(1);
const sameTerritory = (a, b) => (a.region ?? a.place?.region ?? null) === (b.region ?? b.place?.region ?? null) && (!a.place?.provinceCode || !b.place?.provinceCode || a.place.provinceCode === b.place.provinceCode);
export function cofinPlan(owner, work, partner, share) {
  const per = WORK_RULES.euroPerPoint;
  const euro = Math.round(work.cost * share * per[owner.kind]);
  return { share: round2(share), euro, ownerPts: round2(work.cost * share), partnerPts: round2(euro / per[partner.kind]) };
}
// Why the partner cannot co-finance the work (a lowercase reason), or null.
export function cofinProblem(owner, work, partner, share) {
  const rules = WORK_RULES.cofin;
  if (!canManageWorks(owner)) return 'solo chi guida l’esecutivo dell’ente che costruisce chiede un cofinanziamento';
  if (!work || !rules.stages.includes(work.stage)) return 'il cofinanziamento si concorda prima che il cantiere apra';
  if (!partner || partner.id === owner.id || partner.kind === 'europa' || partner.status !== 'active' || !partner.budget || COFIN_LEVEL[partner.kind] === undefined) return 'l’altro ente non ha un bilancio rappresentato nel gioco';
  if (!sameTerritory(owner, partner)) return 'l’altro ente non risponde del territorio dell’opera';
  if (COFIN_LEVEL[partner.kind] <= COFIN_LEVEL[owner.kind] && !workTypesFor(partner.kind).some(type => type.area === work.area)) return `un ${lower(KIND_LABEL[partner.kind])} non ha competenza su questo tema`;
  if (!(share >= rules.minShare - 1e-9 && share <= rules.maxShare + 1e-9)) return `la quota va dal ${Math.round(rules.minShare * 100)}% al ${Math.round(rules.maxShare * 100)}% del costo`;
  const live = (work.cofin ?? []).filter(item => ['richiesto', 'erogato'].includes(item.status));
  if (live.some(item => item.instId === partner.id)) return 'con questo ente c’è già un accordo per l’opera';
  if (live.reduce((sum, item) => sum + item.share, 0) + share > rules.maxShare + 1e-9) return `i contributi degli altri enti non possono superare il ${Math.round(rules.maxShare * 100)}% del costo`;
  const plan = cofinPlan(owner, work, partner, share);
  if (plan.partnerPts < rules.minPoints) return `la quota (${eur(plan.euro)}) è sotto quello che il bilancio ${lower(KIND_LABEL[partner.kind])} riesce a rappresentare (almeno ${eur(rules.minPoints * WORK_RULES.euroPerPoint[partner.kind])}): serve un’opera più grande o una quota maggiore`;
  if (partner.budget.provisional) return 'l’altro ente è in esercizio provvisorio';
  if (partner.budget.margin < plan.partnerPts + rules.reserve) return `il bilancio dell’altro ente non ha la copertura (servono ${plan.partnerPts} punti di margine più la riserva minima di ${rules.reserve}, ce ne sono ${round1(partner.budget.margin)})`;
  return null;
}
// The institutions of the career that could co-finance the work now (any share they could afford is checked when the request is made).
export const cofinPartners = (owner, work, institutions = []) => institutions.filter(partner => partner.id !== owner.id && partner.status === 'active' && cofinProblem(owner, work, partner, WORK_RULES.cofin.minShare) === null);
// The owner's side of the request: the agreement is recorded on the work, waiting for the partner's organ. The partner's act is made by the caller (local-engine).
export function cofinRequest(owner, workId, partner, share, date) {
  const work = find(owner, workId);
  const problem = cofinProblem(owner, work, partner, share);
  if (problem) throw new Error(upper(problem) + '.');
  const plan = cofinPlan(owner, work, partner, share);
  const entry = { id: `${work.id}-cof-${(work.cofin ?? []).length + 1}`, ownerId: owner.id, instId: partner.id, kind: partner.kind, name: partner.name, ...plan, terms: 'quota-fissa', status: 'richiesto', requestedAt: date, actId: null, source: SIM };
  return { inst: setWork(owner, workId, item => ({ cofin: [...(item.cofin ?? []), entry] })), entry, work, plan };
}
const note = (inst, date, text, type) => ({ ...inst, history: [...(inst.history ?? []), { date, text, type }].slice(-40) });
// What the partner's organ decided (or not yet): waiting, declined, lapsed or paid.
function cofinOutcome(owner, work, entry, partner, date) {
  if (!partner || partner.status !== 'active') return { status: 'decaduto', reason: 'l’ente non è più in carica' };
  const act = [...(partner.acts ?? []), ...(partner.archive ?? [])].find(item => item.id === entry.actId);
  if (!act) return { status: 'decaduto', reason: 'la richiesta non risulta più' };
  if (['respinto', 'ritirato'].includes(act.stage)) return { status: 'rifiutato', reason: act.withdrawn ? `ritirato: ${act.withdrawn}` : 'respinto dall’organo competente' };
  if (act.stage !== 'approvato') return weeksBetween(entry.requestedAt, date) >= WORK_RULES.cofin.waitWeeks ? { status: 'decaduto', reason: `nessuna decisione in ${WORK_RULES.cofin.waitWeeks} settimane` } : null;
  if (!isActiveWork(work) && work.stage !== 'sospeso') return { status: 'decaduto', reason: 'l’opera è già finita' };
  if ((partner.budget?.margin ?? 0) < entry.partnerPts + WORK_RULES.cofin.reserve) return { status: 'decaduto', reason: 'l’ente non ha più la copertura' };
  return { status: 'erogato', reason: null };
}
// The week's settlement of the agreements, on all the institutions of the career at once (the money crosses two institutions, so it cannot be done on one): returns the
// institutions and the events. An agreement closes once: paid, declined or lapsed.
export function settleCofinance(institutions, date) {
  const events = [];
  let list = institutions;
  const replace = inst => { list = list.map(item => item.id === inst.id ? inst : item); };
  for (const ownerRef of institutions) {
    if (ownerRef.status !== 'active') continue;
    for (const workRef of worksOf(ownerRef)) {
      for (const entryRef of (workRef.cofin ?? []).filter(item => item.status === 'richiesto')) {
        const owner = list.find(item => item.id === ownerRef.id);
        const work = find(owner, workRef.id);
        const entry = (work.cofin ?? []).find(item => item.id === entryRef.id);
        const partner = list.find(item => item.id === entry.instId) ?? null;
        const outcome = cofinOutcome(owner, work, entry, partner, date);
        if (!outcome) continue;
        const base = { type: 'cofin-esito', outcome: outcome.status, reason: outcome.reason, ownerId: owner.id, ownerName: owner.name, ownerKind: owner.kind, partnerId: entry.instId, partnerName: entry.name, partnerKind: entry.kind, workId: work.id, title: work.title, share: entry.share, euro: entry.euro, ownerPts: entry.ownerPts, partnerPts: entry.partnerPts };
        const setEntry = (inst, patch) => setWork(inst, work.id, item => ({ cofin: item.cofin.map(row => row.id === entry.id ? { ...row, ...patch } : row) }));
        const setLedger = (inst, patch) => inst ? { ...inst, cofin: (inst.cofin ?? []).map(row => row.id === entry.id ? { ...row, ...patch } : row) } : inst;
        let nextOwner = setEntry(owner, { status: outcome.status, decidedAt: date, ...(outcome.reason ? { reason: outcome.reason } : {}) });
        let nextPartner = partner ? setLedger(partner, { status: outcome.status, decidedAt: date, ...(outcome.reason ? { reason: outcome.reason } : {}) }) : null;
        if (outcome.status === 'erogato') {
          // The partner pays once; the work gets the sum and the owner's reserve shrinks by it (what was drawn beyond the need goes back to the margin).
          nextPartner = note({ ...nextPartner, budget: { ...nextPartner.budget, margin: round2(Math.max(0, nextPartner.budget.margin - entry.partnerPts)) } }, date, `Cofinanziamento a ${owner.name}: versati ${entry.partnerPts} punti di margine (${eur(entry.euro)}) per «${work.title}».`, 'cofinanziamento');
          nextPartner = withRecord(nextPartner, record => ({ cofinPaid: round2(record.cofinPaid + entry.partnerPts) }));
          nextOwner = setEntry(nextOwner, { paidAt: date });
          const paid = find(nextOwner, work.id);
          const target = Math.max(paid.cost * WORK_RULES.commit, paid.cost * paid.progress / 100);
          const refund = round1(Math.max(0, paid.drawn - Math.max(0, target - externalOf(paid))));
          nextOwner = withMargin(setWork(nextOwner, work.id, { drawn: round1(paid.drawn - refund) }), refund);
          nextOwner = withRecord(nextOwner, record => ({ cofinReceived: round2(record.cofinReceived + entry.ownerPts) }));
          nextOwner = note(nextOwner, date, `Cofinanziamento di ${entry.name} per «${work.title}»: ${eur(entry.euro)}, ${entry.ownerPts} punti di margine${refund ? `; ${refund} tornano al bilancio` : ''}.`, 'cofinanziamento');
          events.push({ ...base, refund });
        } else {
          nextOwner = note(nextOwner, date, `Cofinanziamento di ${entry.name} per «${work.title}»: ${outcome.status === 'rifiutato' ? 'rifiutato' : 'decaduto'} (${outcome.reason}).`, 'cofinanziamento');
          events.push(base);
        }
        if (nextPartner) {
          const closed = (nextPartner.cofin ?? []).filter(row => !['in-esame', 'richiesto'].includes(row.status));
          const drop = new Set(closed.slice(0, Math.max(0, closed.length - WORK_RULES.cofin.keepClosed)).map(row => row.id));
          nextPartner = { ...nextPartner, cofin: (nextPartner.cofin ?? []).filter(row => !drop.has(row.id)) };
          replace(nextPartner);
        }
        replace(nextOwner);
      }
    }
  }
  // A partner's request whose owner is gone (a concluded mandate, a work that no longer exists) lapses: it would wait for ever in the partner's ledger.
  list = list.map(partner => {
    const stale = (partner.cofin ?? []).filter(row => row.status === 'richiesto' && !list.some(owner => owner.status === 'active' && worksOf(owner).some(work => work.id === row.workId && (work.cofin ?? []).some(entry => entry.id === row.id && entry.status === 'richiesto'))));
    return stale.length ? { ...partner, cofin: partner.cofin.map(row => stale.includes(row) ? { ...row, status: 'decaduto', decidedAt: date, reason: 'l’ente che costruisce non c’è più o l’opera è cambiata' } : row) } : partner;
  });
  return { institutions: list, events };
}

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
  return { ...work, stageLabel: WORK_STAGE_LABEL[work.stage] ?? work.stage, weeksLeft: left, spent: spentOf(work), residual: residualOf(work), external: externalOf(work), costEuro: euroOf(inst, work.cost), spentEuro: euroOf(inst, spentOf(work)), type: WORK_BY_ID[work.typeId] ?? null };
}
