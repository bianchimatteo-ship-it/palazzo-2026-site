// The concrete projects of the Government (hospitals, railways, schools, firms) and the European funds, on the state of the country (society-engine):
// a project is proposed with a budget, financed from the fiscal margin or from an awarded European call, built week after week (progress, delays, cost overruns that ask for a decision)
// and delivers its results on the regional indicators and on the citizens only when it is finished. Pure functions on plain data; the store keeps what they return.
import { uniqueId } from './ids.js?v=20261010-2';
import { ITALIAN_REGIONS } from '../data/regions.js?v=20261010-2';
import { AREA_BY_ID, BILLION_PER_POINT } from '../data/simulation/policy-rules.js?v=20261010-2';
import { EU_CALLS, EU_RULES, PROJECT_RULES, PROJECT_STAGES, PROJECT_TYPES } from '../data/simulation/project-rules.js?v=20261010-2';

const SIM = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
function draw(society) {
  society.rngState = (Math.imul(society.rngState ?? 1, 1664525) + 1013904223) >>> 0;
  return society.rngState / 4294967296;
}
const push = (society, effect) => society.effects.push({ id: uniqueId(society.effects, `effetto-${society.week}-${society.effects.length}-${(society.rngState ?? 0) % 997}`), delay: 0, source: SIM, ...effect });

// ---------- state ----------
export const ACTIVE_STAGES = Object.freeze(['progettazione', 'gara', 'cantiere', 'collaudo']);
export const isActive = project => ACTIVE_STAGES.includes(project?.stage);
export function eu(society) {
  const finance = society.publicFinance;
  return finance.eu ??= { calls: [], nextCallWeek: null, received: 0, lost: 0, reports: 0, missed: 0, source: SIM };
}
export const projectsOf = society => society.projects ?? [];
export const stageOf = progress => PROJECT_STAGES.find(item => progress < item.until)?.id ?? 'collaudo';
const stageLabel = id => STAGE_NAMES[id] ?? id;
const ministerOf = (government, area) => (government?.ministers ?? []).find(item => !item.endedAt && item.portfolio === AREA_BY_ID[area]?.portfolio) ?? null;
const paEfficiency = society => clamp(society.areas?.pa?.value ?? 50, 0, 100) / 100;
const weeksFor = (type, funding) => Math.max(8, Math.round(Math.round((type.weeks[0] + type.weeks[1]) / 2) * (funding > 100 ? 1 - (funding - 100) / 200 : 1 + (100 - funding) / 250)));
const STAGE_NAMES = { progettazione: 'Progettazione', gara: 'Gara d’appalto', cantiere: 'Cantiere', collaudo: 'Collaudo', completato: 'Completata', sospeso: 'Sospesa' };

// ---------- quote: what a project would cost and deliver (also the validation of a proposal) ----------
export function fundingOf(value) {
  const step = PROJECT_RULES.fundingStep;
  return clamp(Math.round(Number(value ?? PROJECT_RULES.fundingDefault) / step) * step, PROJECT_RULES.fundingMin, PROJECT_RULES.fundingMax);
}
export function callFor(society, type, callId = null) {
  return eu(society).calls.find(call => call.status === 'assegnato' && (callId ? call.id === callId : true) && EU_CALLS[call.template]?.projects.includes(type)) ?? null;
}
export function projectQuote(society, input = {}, government = null) {
  const type = PROJECT_TYPES[input.type];
  const problems = [];
  if (!type) return { ok: false, problems: ['Scegli il tipo di opera.'] };
  const region = ITALIAN_REGIONS.includes(input.region) ? input.region : null;
  if (!region) problems.push('Scegli la regione in cui si costruisce.');
  const funding = fundingOf(input.funding);
  const cost = round1(type.base * funding / 100);
  const financing = input.financing === 'ue' ? 'ue' : 'bilancio';
  const call = financing === 'ue' ? callFor(society, type.id, input.callId ?? null) : null;
  const cofinance = call ? EU_CALLS[call.template].cofinance : 1;
  const euShare = call ? round1(cost * (1 - cofinance)) : 0;
  const statePart = round1(cost - euShare);
  const marginUse = round1(statePart * PROJECT_RULES.commit);
  const headroom = society.publicFinance.headroom;
  if (financing === 'ue' && !call) problems.push('Nessun bando europeo assegnato per questo tipo di opera.');
  if (call && call.amount - call.committed < euShare - 1e-9) problems.push('Il bando europeo non ha più fondi sufficienti: riduci il budget o scegli il bilancio.');
  if (headroom < marginUse) problems.push(`Il margine di bilancio (${Math.round(headroom)}) non basta per l’impegno iniziale (${marginUse}).`);
  if (projectsOf(society).filter(isActive).length >= PROJECT_RULES.maxActive) problems.push(`Ci sono già ${PROJECT_RULES.maxActive} opere in corso.`);
  const minister = ministerOf(government, type.area);
  const competence = minister?.competence ?? 55;
  const quality = round2(clamp(0.55 + 0.45 * funding / 100, 0.7, 1.12));
  const weeks = weeksFor(type, funding);
  const delayRisk = round2(type.risk * (1.3 - paEfficiency(society)) * (funding < 100 ? 1 + (100 - funding) / 50 : 1));
  const regional = Object.fromEntries(Object.entries(type.regional).map(([indicator, weight]) => [indicator, round1(type.gain * weight * quality)]));
  return { ok: !problems.length, problems, type: type.id, region, funding, cost, billions: round1(cost * BILLION_PER_POINT), financing, callId: call?.id ?? null, euShare, statePart, marginUse, weeks, quality, delayRisk, regional, competence, ministry: AREA_BY_ID[type.area].portfolio, headroomAfter: round1(headroom - marginUse) };
}

// ---------- proposing, funding, suspending ----------
export function proposeProject(input, request, { date, week, government = null } = {}) {
  const society = copy(input);
  const quote = projectQuote(society, request, government);
  if (!quote.ok) throw new Error(quote.problems[0]);
  const type = PROJECT_TYPES[quote.type];
  const ordinal = projectsOf(society).filter(item => item.type === type.id && item.region === quote.region).length + 1;
  const project = {
    id: uniqueId(projectsOf(society), `opera-${week}-${type.id}-${quote.region.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8)}`),
    type: type.id, region: quote.region, title: `${type.label} · ${quote.region}${ordinal > 1 ? ` (${ordinal})` : ''}`,
    funding: quote.funding, cost: quote.cost, committed: quote.marginUse, financing: quote.financing, callId: quote.callId, euShare: quote.euShare,
    weeks: quote.weeks, progress: 0, stage: 'progettazione', delayWeeks: 0, overruns: 0, scope: 1, boost: 0, stall: 0, pending: null,
    proposedWeek: week, proposedDate: date, minister: quote.ministry, source: SIM
  };
  society.projects = [...projectsOf(society), project];
  society.publicFinance.headroom = round1(clamp(society.publicFinance.headroom - quote.marginUse));
  society.publicFinance.committed = round1((society.publicFinance.committed ?? 0) + quote.statePart);
  if (quote.callId) {
    const call = eu(society).calls.find(item => item.id === quote.callId);
    call.committed = round1(call.committed + quote.euShare);
    call.reportDueWeek ??= week + EU_RULES.reportEveryWeeks;
    society.publicFinance.euFundsUsed = round1((society.publicFinance.euFundsUsed ?? 0) + quote.euShare);
  }
  return { society, project };
}
// Before the works start the budget can still be changed; the difference is paid (or given back) at once.
export function setProjectFunding(input, projectId, funding) {
  const society = copy(input);
  const project = projectsOf(society).find(item => item.id === projectId);
  if (!project || !['progettazione', 'gara'].includes(project.stage)) throw new Error('Il budget si cambia solo prima dell’apertura del cantiere.');
  const type = PROJECT_TYPES[project.type];
  const next = fundingOf(funding);
  if (next === project.funding) throw new Error('Il budget è già a questo livello.');
  const cost = round1(type.base * next / 100);
  const call = project.callId ? eu(society).calls.find(item => item.id === project.callId) : null;
  const euShare = call ? round1(cost * (1 - EU_CALLS[call.template].cofinance)) : 0;
  const committed = round1((cost - euShare) * PROJECT_RULES.commit);
  const diff = round1(committed - project.committed);
  if (diff > society.publicFinance.headroom) throw new Error('Il margine di bilancio non basta per l’aumento.');
  if (call) {
    const extra = round1(euShare - project.euShare);
    if (extra > call.amount - call.committed + 1e-9) throw new Error('Il bando europeo non ha fondi per l’aumento.');
    call.committed = round1(call.committed + extra);
  }
  society.publicFinance.headroom = round1(clamp(society.publicFinance.headroom - diff));
  society.publicFinance.committed = round1((society.publicFinance.committed ?? 0) + (cost - euShare) - (project.cost - project.euShare));
  Object.assign(project, { funding: next, cost, committed, euShare, weeks: weeksFor(type, next) });
  return { society, project };
}
function release(society, project, share) {
  const back = round1(project.committed * share);
  society.publicFinance.headroom = round1(clamp(society.publicFinance.headroom + back));
  const call = project.callId ? eu(society).calls.find(item => item.id === project.callId) : null;
  if (call) { call.committed = round1(Math.max(0, call.committed - project.euShare * (1 - project.progress / 100))); }
  return back;
}
export function suspendProject(input, projectId) {
  const society = copy(input);
  const project = projectsOf(society).find(item => item.id === projectId);
  if (!project || !isActive(project)) throw new Error('L’opera non è in corso.');
  const back = release(society, project, PROJECT_RULES.refund * (1 - project.progress / 100));
  Object.assign(project, { stage: 'sospeso', pending: null, suspendedWeek: society.week });
  for (const segment of society.segments) if (PROJECT_TYPES[project.type].pleased.includes(segment.id)) segment.mood = round1(clamp((segment.mood ?? 0) - 1.2 - project.progress / 60, -15, 15));
  const region = society.regions[project.region];
  if (region) region.trust = round1(clamp(region.trust - 2));
  return { society, project, back };
}

// ---------- the decisions an event asks for ----------
function waitOn(society, project) {
  const pending = project.pending;
  Object.assign(project, { stall: PROJECT_RULES.stallWeeks, delayWeeks: project.delayWeeks + PROJECT_RULES.stallWeeks, pending: { ...pending, amount: round1(pending.amount * 1.15), week: society.week, waits: (pending.waits ?? 0) + 1, raised: false } });
}
export function settleProjectIssue(input, projectId, choice) {
  const society = copy(input);
  const project = projectsOf(society).find(item => item.id === projectId);
  if (!project) throw new Error('Opera non trovata.');
  const pending = project.pending;
  if (choice === 'integra' && pending?.kind === 'sforamento') {
    const pay = round1(pending.amount * PROJECT_RULES.commit + pending.amount * 0.2);
    if (society.publicFinance.headroom < pay) throw new Error(`Il margine di bilancio (${Math.round(society.publicFinance.headroom)}) non basta: servono ${pay} punti.`);
    society.publicFinance.headroom = round1(clamp(society.publicFinance.headroom - pay));
    society.economy.deficit = round2(society.economy.deficit + pending.amount * 0.012);
    Object.assign(project, { cost: round1(project.cost + pending.amount), committed: round1(project.committed + pay), pending: null, stall: 0 });
  } else if (choice === 'ridimensiona' && pending?.kind === 'sforamento') {
    Object.assign(project, { scope: round2(project.scope * 0.88), pending: null, stall: 2, delayWeeks: project.delayWeeks + 2 });
  } else if (choice === 'sospendi') return suspendProject(society, projectId);
  else if (choice === 'commissario') Object.assign(project, { boost: PROJECT_RULES.hurryWeeks, delayMark: project.delayWeeks, delayNoticed: false });
  else if (choice === 'attendi' && pending?.kind === 'sforamento') waitOn(society, project);
  else if (choice === 'attendi') Object.assign(project, { delayMark: project.delayWeeks, delayNoticed: false });
  return { society, project };
}

// ---------- every week ----------
function finish(society, project, alerts, date) {
  const type = PROJECT_TYPES[project.type];
  const late = clamp(project.delayWeeks / Math.max(1, project.weeks), 0, 0.35);
  const quality = clamp(0.55 + 0.45 * project.funding / 100, 0.7, 1.12) * project.scope * (1 - late);
  const region = society.regions[project.region];
  const gains = {};
  for (const [indicator, weight] of Object.entries(type.regional)) {
    const total = round2(type.gain * weight * quality * (region ? (100 - region.indicators[indicator]) / 50 : 1));
    gains[indicator] = total;
    push(society, { region: project.region, indicator, perWeek: round2(total / 8), remaining: 8, cause: project.title });
  }
  const national = round2(type.national * quality);
  push(society, { area: type.area, perWeek: round2(national / 8), remaining: 8, cause: project.title });
  for (const segment of society.segments) if (type.pleased.includes(segment.id)) segment.mood = round1(clamp((segment.mood ?? 0) + 1.6 * quality, -15, 15));
  if (region) region.mood = round2(clamp((region.mood ?? 0) + 2 * quality, -8, 8));
  Object.assign(project, { stage: 'completato', progress: 100, completedWeek: society.week, completedDate: date, result: { quality: round2(quality), late: project.delayWeeks, gains, national } });
  alerts.push({ kind: 'completato', projectId: project.id, title: project.title, region: project.region, quality: round2(quality), late: project.delayWeeks, indicator: Object.keys(type.regional)[0], areaLabel: AREA_BY_ID[type.area].label });
}
export function projectsWeek(society, { date, government = null } = {}) {
  const alerts = [];
  const provisional = Boolean(society.publicFinance.budget?.provisional);
  for (const project of projectsOf(society).filter(isActive)) {
    const type = PROJECT_TYPES[project.type];
    // A cost overrun waits for the decision; without one it falls back on waiting.
    if (project.pending) {
      if (!project.pending.raised) { project.pending.raised = true; alerts.push({ kind: 'sforamento', projectId: project.id, title: project.title, amount: project.pending.amount, region: project.region, cost: project.cost, waits: project.pending.waits ?? 0 }); }
      else if (society.week - project.pending.week >= PROJECT_RULES.decisionWeeks) { waitOn(society, project); continue; }
      project.delayWeeks += 1;
      continue;
    }
    if (project.stall > 0) { project.stall -= 1; continue; }
    const minister = ministerOf(government, type.area);
    const speed = clamp((0.85 + 0.3 * paEfficiency(society)) * clamp(0.7 + 0.3 * project.funding / 100, 0.8, 1.1) * (0.92 + (minister?.competence ?? 55) / 400) * (provisional ? 0.5 : 1) * (project.boost > 0 ? 1.4 : 1), 0.25, 1.6);
    if (project.boost > 0) project.boost -= 1;
    const stageWeight = project.stage === 'gara' ? 1.6 : project.stage === 'cantiere' ? 1 : 0.6;
    const risk = type.risk * (1.3 - paEfficiency(society)) * (project.funding < 100 ? 1 + (100 - project.funding) / 50 : 1) * stageWeight * (project.boost > 0 ? 0.5 : 1);
    if (draw(society) < risk) {
      const lost = 1 + Math.floor(draw(society) * 3);
      project.delayWeeks += lost; project.stall = lost - 1;
      if (project.delayWeeks - (project.delayMark ?? 0) >= 3 && !project.delayNoticed) { project.delayNoticed = true; alerts.push({ kind: 'ritardo', projectId: project.id, title: project.title, delay: project.delayWeeks, stage: stageLabel(project.stage), region: project.region }); }
      continue;
    }
    project.progress = round1(Math.min(100, project.progress + 100 / project.weeks * speed));
    project.stage = stageOf(project.progress);
    if (project.stage === 'cantiere' && project.funding < 110 && draw(society) < PROJECT_RULES.overrunChance * (1 + (110 - project.funding) / 60)) {
      const share = PROJECT_RULES.overrunShare;
      const amount = round1(project.cost * (share[0] + (share[1] - share[0]) * draw(society)));
      project.overruns += 1;
      project.pending = { kind: 'sforamento', amount, week: society.week, raised: false, waits: 0 };
    }
    if (project.progress >= 100) finish(society, project, alerts, date);
  }
  // The finished and the suspended stay in the list for a while, not for ever (the save stays small).
  const closed = projectsOf(society).filter(item => !isActive(item));
  if (closed.length > 12) { const drop = new Set(closed.slice(0, closed.length - 12).map(item => item.id)); society.projects = projectsOf(society).filter(item => !drop.has(item.id)); }
  return alerts;
}

// ---------- European funds ----------
export function openCallWeek(society, week) {
  const state = eu(society);
  state.nextCallWeek ??= week + 6;
  if (week < state.nextCallWeek) return null;
  state.nextCallWeek = week + EU_RULES.everyWeeks;
  const open = new Set(state.calls.filter(call => ['aperto', 'candidato', 'assegnato'].includes(call.status)).map(call => call.template));
  const templates = Object.values(EU_CALLS).filter(item => !open.has(item.id));
  if (!templates.length) return null;
  const template = templates[Math.floor(draw(society) * templates.length)];
  const amount = round1(template.amount[0] + (template.amount[1] - template.amount[0]) * draw(society));
  const call = { id: uniqueId(state.calls, `bando-ue-${week}-${template.id}`), template: template.id, title: template.title, amount, committed: 0, cofinance: template.cofinance, openedWeek: week, deadlineWeek: week + EU_RULES.openWeeks, status: 'aperto', reports: 0, missed: 0, source: SIM };
  state.calls = [...state.calls, call].slice(-EU_RULES.keep * 3);
  return call;
}
// The reform behind an application: a law of the Government on one of the areas of the call, enacted in the last two years.
export function callRequirement(society, call, week) {
  const template = EU_CALLS[call.template];
  const reform = (society.lawsApplied ?? []).find(item => !item.revoked && template.areas.includes(item.area) && (week - (item.week ?? 0)) <= EU_RULES.reformWeeks) ?? null;
  const status = society.publicFinance.euStatus;
  return { reform: reform ? { title: reform.title, area: reform.area } : null, accounts: status !== 'procedura', areas: template.areas.map(id => AREA_BY_ID[id]?.label.toLowerCase()).filter(Boolean), ok: Boolean(reform) && status !== 'procedura' };
}
export function applyCall(input, callId, { week }) {
  const society = copy(input);
  const call = eu(society).calls.find(item => item.id === callId);
  if (!call || call.status !== 'aperto') throw new Error('Il bando non è più aperto.');
  const requirement = callRequirement(society, call, week);
  if (!requirement.reform) throw new Error(`Manca la riforma richiesta: serve un provvedimento approvato su ${requirement.areas.slice(0, 3).join(', ')} negli ultimi due anni.`);
  if (!requirement.accounts) throw new Error('Con la procedura per deficit eccessivo aperta Bruxelles non accoglie nuove candidature.');
  const [min, max] = EU_RULES.reviewWeeks;
  Object.assign(call, { status: 'candidato', appliedWeek: week, decideWeek: week + min + Math.floor(draw(society) * (max - min + 1)), reform: requirement.reform.title });
  return { society, call };
}
export function reportCall(input, callId, { week }) {
  const society = copy(input);
  const call = eu(society).calls.find(item => item.id === callId);
  if (!call || call.status !== 'assegnato' || call.committed <= 0) throw new Error('Non ci sono spese da rendicontare per questo bando.');
  if (call.reportDueWeek - week > EU_RULES.reportEveryWeeks - 4) throw new Error('Il rendiconto è stato presentato da poco: la prossima scadenza è più avanti.');
  call.reports += 1; call.lastReportWeek = week; call.reportDueWeek = week + EU_RULES.reportEveryWeeks;
  eu(society).reports += 1;
  if (society.areas?.europa) society.areas.europa.value = round1(clamp(society.areas.europa.value + 1));
  return { society, call };
}
export function euWeek(society, { week }) {
  const alerts = [];
  const state = eu(society);
  const europe = society.areas?.europa?.value ?? 50;
  for (const call of state.calls) {
    if (call.status === 'aperto' && week > call.deadlineWeek) { call.status = 'scaduto'; alerts.push({ kind: 'bando-scaduto', callId: call.id, title: call.title }); }
    else if (call.status === 'candidato' && week >= call.decideWeek) {
      const p = clamp(0.4 + (europe - 50) / 150 + (society.publicFinance.euStatus === 'regolare' ? 0.1 : society.publicFinance.euStatus === 'richiamo' ? 0 : -0.2) + (society.areas?.pa?.value ?? 50) / 500, 0.1, 0.9);
      const won = draw(society) < p;
      call.status = won ? 'assegnato' : 'respinto';
      if (won) { call.spendByWeek = week + EU_RULES.spendWeeks; state.received = round1(state.received + call.amount); }
      alerts.push({ kind: won ? 'bando-assegnato' : 'bando-respinto', callId: call.id, title: call.title, amount: call.amount, spendByWeek: call.spendByWeek ?? null });
    } else if (call.status === 'assegnato') {
      if (call.reportDueWeek && week > call.reportDueWeek + EU_RULES.reportGraceWeeks) {
        const clawback = round1(call.committed * 0.15);
        call.missed += 1; call.amount = round1(Math.max(call.committed, call.amount - clawback)); state.lost = round1(state.lost + clawback); state.missed += 1;
        call.reportDueWeek = week + EU_RULES.reportEveryWeeks;
        if (society.areas?.europa) society.areas.europa.value = round1(clamp(society.areas.europa.value - EU_RULES.lossEurope));
        society.publicFinance.spread = round1(society.publicFinance.spread + EU_RULES.lossSpread);
        alerts.push({ kind: 'rendiconto-mancato', callId: call.id, title: call.title, lost: clawback });
      } else if (call.reportDueWeek && week >= call.reportDueWeek && !call.reportAlerted) { call.reportAlerted = call.reportDueWeek; alerts.push({ kind: 'rendiconto', callId: call.id, title: call.title, due: call.reportDueWeek + EU_RULES.reportGraceWeeks - week }); }
      if (week >= call.spendByWeek) {
        const left = round1(call.amount - call.committed);
        call.status = 'chiuso';
        if (left > 0) { state.lost = round1(state.lost + left); call.lost = left; if (society.areas?.europa) society.areas.europa.value = round1(clamp(society.areas.europa.value - EU_RULES.lossEurope)); society.publicFinance.spread = round1(society.publicFinance.spread + EU_RULES.lossSpread); alerts.push({ kind: 'fondi-perduti', callId: call.id, title: call.title, lost: left }); }
      } else if (call.spendByWeek - week === 13 && call.amount - call.committed > 0.1) alerts.push({ kind: 'fondi-in-scadenza', callId: call.id, title: call.title, left: round1(call.amount - call.committed) });
    }
  }
  return alerts;
}

// ---------- what the interface shows ----------
export function projectView(society) {
  return projectsOf(society).map(project => {
    const type = PROJECT_TYPES[project.type];
    return { ...project, typeLabel: type.label, icon: type.icon, stageLabel: stageLabel(project.stage) ?? project.stage, billions: round1(project.cost * BILLION_PER_POINT), weeksLeft: isActive(project) ? Math.max(0, Math.round((100 - project.progress) / 100 * project.weeks)) : 0 };
  });
}
export function euView(society, week) {
  const state = society.publicFinance?.eu;
  if (!state) return { calls: [], received: 0, lost: 0, reports: 0, missed: 0 };
  return {
    ...state,
    calls: state.calls.slice().reverse().map(call => ({ ...call, template: EU_CALLS[call.template], requirement: call.status === 'aperto' ? callRequirement(society, call, week) : null, remaining: round1(call.amount - call.committed), billions: round1(call.amount * BILLION_PER_POINT) }))
  };
}
