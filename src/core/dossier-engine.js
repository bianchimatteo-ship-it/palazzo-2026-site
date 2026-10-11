// The dossiers of the ministers: each minister who is not the player's takes on an objective in his own field (a reform to bring home, a sector to put right) with a term,
// and the Government is judged on the result. Nothing is fulfilled by an event: a reform is done when a law of the majority on that matter is approved, a sector is
// put right when its level, measured on the country, reaches the goal. A result moves the minister (loyalty, competence or pressure), the Government (stability) and the
// group the minister comes from, once. The programme of the Government is balanced the same way against the measures enacted in its priority areas.
// Everything is simulation: no dossier is a real decision of a real minister. Choices are a hash of the keys, never the random sequence of the game.
import { DATA_SOURCES } from '../data/schema.js?v=20261010-2';
import { AREA_BY_ID, areasOfPortfolio } from '../data/simulation/policy-rules.js?v=20261010-2';
import { DOSSIER_KINDS, DOSSIER_RULES as R, LAW_PROGRESS } from '../data/simulation/dossier-rules.js?v=20261010-2';
import { activeMinisters, canManageParliament, groupProfile, parliamentInternals, proposeLaw, record } from './parliament-engine.js?v=20261010-2';
import { areaValue, pushEffect } from './society-engine.js?v=20261010-2';

const SIM = DATA_SOURCES.SIMULATION;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const copy = value => JSON.parse(JSON.stringify(value));
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
const unit = (...parts) => { let n = hash(parts.join('|')) || 1; n = Math.imul(n ^ (n >>> 16), 0x85ebca6b) >>> 0; n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35) >>> 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const between = (range, ...parts) => range[0] + Math.floor(unit(...parts) * (range[1] - range[0] + 1));
const weeksOf = (from, to) => from && to ? Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 604800000) : 0;
const addWeeks = (date, weeks) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + weeks * 7); return value.toISOString().slice(0, 10); };

export const dossiersOf = government => Array.isArray(government?.dossiers) ? government.dossiers : [];
export const openDossiers = government => dossiersOf(government).filter(item => ['aperto', 'rinviato'].includes(item.status));
export const isLedByOthers = government => Boolean(government) && government.primeMinister !== 'player' && government.formedBy !== 'player';
const withGovernment = (parliament, patch) => ({ ...parliament, government: { ...parliament.government, ...patch } });
const setDossier = (parliament, id, change) => withGovernment(parliament, { dossiers: dossiersOf(parliament.government).map(item => item.id === id ? { ...item, ...(typeof change === 'function' ? change(item) : change) } : item) });
const setMinister = (parliament, id, change) => withGovernment(parliament, { ministers: (parliament.government.ministers ?? []).map(item => item.id === id ? { ...item, ...(typeof change === 'function' ? change(item) : change) } : item) });
const shiftPartner = (parliament, groupId, delta) => {
  const partner = parliament.government?.partners?.[groupId];
  return partner && delta ? withGovernment(parliament, { partners: { ...parliament.government.partners, [groupId]: { ...partner, satisfaction: round1(clamp(partner.satisfaction + delta, 0, 100)) } } }) : parliament;
};
const shiftStability = (parliament, delta) => withGovernment(parliament, { stability: clamp(Math.round((parliament.government.stability ?? 50) + delta), 0, 100) });

// ---------- what a dossier has done ----------
// Reform: the furthest bill of the majority on the matter introduced since the dossier opened, or a measure already applied. Emergency: the way from the starting level to the goal.
const majorityBill = law => law.origin === 'governo' || ['governo', 'maggioranza', 'commissione'].includes(law.sponsor?.kind);
export function dossierProgress(dossier, { parliament, society, lawsApplied = society?.lawsApplied ?? [] } = {}) {
  if (dossier.kind === 'riforma') {
    if (lawsApplied.some(item => item.area === dossier.area && (item.week ?? 0) >= dossier.openedWeek)) return { value: 100, evidence: 'Una misura nella materia è in vigore.' };
    const laws = (parliament?.laws ?? []).filter(law => law.policy?.area === dossier.area && (law.introducedAt ?? '') >= dossier.openedDate && majorityBill(law) && law.stage !== 'rejected' && law.stage !== 'lapsed');
    const best = laws.map(law => ({ law, value: LAW_PROGRESS[law.stage] ?? 0 })).sort((a, b) => b.value - a.value)[0];
    return best ? { value: best.value, evidence: `«${best.law.title}»: ${best.law.stage}`, lawId: best.law.id } : { value: 0, evidence: 'Nessun provvedimento presentato.' };
  }
  const now = areaValue(society, dossier.area);
  if (now === null) return { value: 0, evidence: 'Settore non misurabile.' };
  const value = clamp(Math.round((now - dossier.start) / Math.max(1, dossier.goal - dossier.start) * 100), 0, 100);
  return { value, evidence: `Livello ${round1(now)} su obiettivo ${dossier.goal} (partenza ${dossier.start}).` };
}

// ---------- opening ----------
function chooseDossier(parliament, society, minister, week) {
  const areas = areasOfPortfolio(minister.portfolio).filter(id => AREA_BY_ID[id]);
  if (!areas.length) return null;
  const open = openDossiers(parliament.government);
  const free = areas.filter(id => !open.some(item => item.area === id));
  if (!free.length) return null;
  // A problem of the country in the field calls for an emergency dossier, the programme of the Government for a reform; otherwise what the minister's group cares about.
  const issues = (society?.issues ?? []).map(issue => ({ area: issue.area ?? areas.find(id => AREA_BY_ID[id].label === issue.topic), severity: issue.severity ?? 0 })).filter(item => free.includes(item.area) && item.severity >= R.severity).sort((a, b) => b.severity - a.severity);
  if (issues[0]) return { area: issues[0].area, kind: 'emergenza', origin: 'emergenza' };
  const priorities = (parliament.government.program?.priorities ?? []).filter(id => free.includes(id));
  if (priorities.length) return { area: priorities[Math.floor(unit(minister.id, week, 'priorita') * priorities.length)], kind: 'riforma', origin: 'programma' };
  const group = minister.groupId ? parliamentInternals.getGroup(parliament, minister.groupId) : null;
  const likes = group ? groupProfile(group).likes.filter(id => free.includes(id)) : [];
  const pool = likes.length ? likes : free;
  return { area: pool[Math.floor(unit(minister.id, week, 'iniziativa') * pool.length)], kind: 'riforma', origin: likes.length ? 'iniziativa' : 'ministero' };
}
function openFor(parliament, society, minister, { date, week }) {
  const choice = chooseDossier(parliament, society, minister, week);
  if (!choice) return { parliament, opened: null };
  const spec = AREA_BY_ID[choice.area];
  const start = choice.kind === 'emergenza' ? areaValue(society, choice.area) : null;
  if (choice.kind === 'emergenza' && start === null) return { parliament, opened: null };
  const weeks = choice.kind === 'riforma' ? R.riformaWeeks : R.emergenzaWeeks;
  const dossier = {
    id: `dossier-${week}-${choice.area}-${hash(minister.id) % 997}`, kind: choice.kind, origin: choice.origin, area: choice.area, areaLabel: spec.label, portfolio: minister.portfolio, ministerId: minister.id, groupId: minister.groupId ?? null,
    title: choice.kind === 'riforma' ? `Riforma: ${spec.label.toLowerCase()}` : `Emergenza: ${spec.label.toLowerCase()}`,
    openedWeek: week, openedDate: date, due: addWeeks(date, weeks), termWeeks: weeks, status: 'aperto', progress: 0, postponed: 0, funded: false, drafted: false, alarmed: false,
    ...(choice.kind === 'emergenza' ? { start: round1(start), goal: round1(Math.min(R.areaCap, start + R.areaGain)) } : {}), source: SIM
  };
  let next = withGovernment(parliament, { dossiers: [dossier, ...dossiersOf(parliament.government)] });
  next = setMinister(next, minister.id, { nextDossierWeek: null });
  next = record(next, date, 'dossier-aperto', `Il ministro ${minister.portfolio} prende in carico un dossier: ${dossier.title.toLowerCase()}, da chiudere entro il ${dossier.due}.`, { dossierId: dossier.id, ministerId: minister.id, kind: dossier.kind, source: SIM });
  return { parliament: next, opened: dossier };
}

// ---------- settling ----------
function blameOf(parliament, minister, margin) {
  if ((minister?.competence ?? 60) < 50 || (minister?.loyalty ?? 60) < 45) return 'ministro';
  if (Number.isFinite(margin) && margin < 4) return 'maggioranza';
  return 'circostanze';
}
const BLAME_TEXT = { ministro: 'La responsabilità è del ministro: il dossier non ha avuto la guida che serviva.', maggioranza: 'La maggioranza era troppo stretta per portare avanti il dossier.', circostanze: 'Le circostanze, più che il ministro, hanno frenato il dossier.' };
function settle(parliament, dossier, outcome, { date, week, margin }) {
  const minister = (parliament.government.ministers ?? []).find(item => item.id === dossier.ministerId) ?? null;
  const fx = outcome === 'riuscito' ? R.success : outcome === 'fallito' ? R.failure : R.withdrawn;
  let next = setDossier(parliament, dossier.id, { status: outcome, closedWeek: week, closedDate: date, blame: outcome === 'fallito' ? blameOf(parliament, minister, margin) : null });
  if (minister) next = setMinister(next, minister.id, item => ({ loyalty: clamp((item.loyalty ?? 60) + (fx.loyalty ?? 0), 0, 100), competence: Number.isFinite(item.competence) ? clamp(item.competence + (fx.competence ?? 0), 0, 100) : item.competence, pressure: clamp((item.pressure ?? 0) + (fx.pressure ?? 0), 0, 6), dossiers: { done: (item.dossiers?.done ?? 0) + (outcome === 'riuscito' ? 1 : 0), failed: (item.dossiers?.failed ?? 0) + (outcome === 'fallito' ? 1 : 0) }, nextDossierWeek: week + between(R.cooldown, item.id, week, 'pausa') }));
  if (fx.stability) next = shiftStability(next, fx.stability);
  if (dossier.groupId) next = shiftPartner(next, dossier.groupId, fx.partner ?? 0);
  const text = outcome === 'riuscito' ? `Dossier riuscito — ministero ${dossier.portfolio}: ${dossier.title.toLowerCase()}.` : outcome === 'fallito' ? `Dossier fallito — ministero ${dossier.portfolio}: ${dossier.title.toLowerCase()}. ${BLAME_TEXT[blameOf(parliament, minister, margin)]}` : `Dossier ritirato — ministero ${dossier.portfolio}: ${dossier.title.toLowerCase()}.`;
  return record(next, date, 'dossier-esito', text, { dossierId: dossier.id, ministerId: dossier.ministerId, outcome, kind: dossier.kind, area: dossier.area, portfolio: dossier.portfolio, title: dossier.title, blame: outcome === 'fallito' ? blameOf(parliament, minister, margin) : null, source: SIM });
}

// ---------- the week ----------
// ctx: { date, week, society, margin }. Returns { parliament, settled: [{ dossier, outcome }], opened: [dossier], alarms: [dossier] }.
export function tickDossiers(input, { date, week, society, margin = null } = {}) {
  const out = { parliament: input, settled: [], opened: [], alarms: [] };
  const government = input?.government;
  if (!government || government.status !== 'active') return out;
  let next = input;
  // Progress and results of the open dossiers.
  for (const dossier of openDossiers(government)) {
    const current = dossiersOf(next.government).find(item => item.id === dossier.id);
    const { value } = dossierProgress(current, { parliament: next, society });
    next = setDossier(next, current.id, { progress: value });
    if (value >= 100) { next = settle(next, current, 'riuscito', { date, week, margin }); out.settled.push({ dossier: { ...current, progress: 100 }, outcome: 'riuscito' }); continue; }
    if (date > current.due) {
      // A minister with most of the way done asks for more time once.
      if (!current.postponed && value >= R.autoPostponeAt) {
        next = setDossier(next, current.id, { postponed: 1, originalDue: current.due, due: addWeeks(date, R.postponeWeeks), status: 'rinviato', alarmed: false });
        const minister = (next.government.ministers ?? []).find(item => item.id === current.ministerId);
        if (minister) next = setMinister(next, minister.id, item => ({ loyalty: clamp((item.loyalty ?? 60) + R.postponed.loyalty, 0, 100) }));
        next = record(next, date, 'dossier-rinvio', `Il ministro ${current.portfolio} chiede più tempo: ${current.title.toLowerCase()} slitta al ${addWeeks(date, R.postponeWeeks)} (fatto il ${value}%).`, { dossierId: current.id, ministerId: current.ministerId, portfolio: current.portfolio, title: current.title, source: SIM });
        continue;
      }
      next = settle(next, current, 'fallito', { date, week, margin });
      out.settled.push({ dossier: { ...current, progress: value }, outcome: 'fallito' });
      continue;
    }
    // The alarm: past half of the term and still little done.
    if (!current.alarmed && weeksOf(current.openedDate, date) >= current.termWeeks * R.alarm.elapsed && value < R.alarm.below) {
      next = setDossier(next, current.id, { alarmed: true });
      out.alarms.push({ ...current, progress: value });
    }
  }
  // A minister seen for the first time waits a few weeks (staggered by his id); one whose pause is over takes on a new dossier (a few at a time, up to the limit).
  const free = () => activeMinisters(next.government).filter(item => !item.playerAppointed && !openDossiers(next.government).some(d => d.ministerId === item.id));
  for (const item of free().filter(entry => !Number.isFinite(entry.nextDossierWeek))) next = setMinister(next, item.id, { nextDossierWeek: week + between(R.firstDelay, item.id, 'primo') });
  const candidates = free().filter(item => week >= item.nextDossierWeek).sort((a, b) => a.nextDossierWeek - b.nextDossierWeek || (a.id < b.id ? -1 : 1));
  for (const item of candidates.slice(0, 2)) {
    if (openDossiers(next.government).length >= R.maxOpen) break;
    const made = openFor(next, society, item, { date, week });
    next = made.parliament;
    if (made.opened) out.opened.push(made.opened);
  }
  // Pressure fades with time.
  if (week % R.pressure.every === 0) next = withGovernment(next, { ministers: (next.government.ministers ?? []).map(item => item.pressure ? { ...item, pressure: Math.round(item.pressure * R.pressure.fade * 10) / 10 } : item) });
  // The record keeps the last closed ones only.
  const all = dossiersOf(next.government);
  const closed = all.filter(item => !['aperto', 'rinviato'].includes(item.status));
  if (closed.length > R.kept) { const drop = new Set(closed.sort((a, b) => (a.closedWeek ?? 0) - (b.closedWeek ?? 0)).slice(0, closed.length - R.kept).map(item => item.id)); next = withGovernment(next, { dossiers: all.filter(item => !drop.has(item.id)) }); }
  out.parliament = next;
  return out;
}

// ---------- what the player can do for a dossier ----------
function mustFind(parliament, dossierId) {
  const dossier = dossiersOf(parliament?.government).find(item => item.id === dossierId);
  if (!dossier || !['aperto', 'rinviato'].includes(dossier.status)) throw new Error('Il dossier non è aperto.');
  return dossier;
}
// Money for a sector in trouble: a share of the fiscal margin, paid once, raises the sector over the following weeks.
export function fundDossier(parliament, society, dossierId, { week }) {
  const dossier = mustFind(parliament, dossierId);
  if (dossier.kind !== 'emergenza') throw new Error('Solo un settore in difficoltà si finanzia: una riforma si porta in Parlamento.');
  if (dossier.funded) throw new Error('Il dossier è già stato finanziato.');
  const finance = society.publicFinance;
  if ((finance.headroom ?? 0) < R.fund.minHeadroom) throw new Error(`Il margine di bilancio (${Math.round(finance.headroom)}) non basta: ne servono almeno ${R.fund.minHeadroom}.`);
  const nextSociety = copy(society);
  nextSociety.publicFinance.headroom = round1(clamp(nextSociety.publicFinance.headroom - R.fund.cost, 0, 100));
  nextSociety.publicFinance.committed = round1((nextSociety.publicFinance.committed ?? 0) + R.fund.cost);
  pushEffect(nextSociety, { area: dossier.area, perWeek: R.fund.perWeek, remaining: R.fund.weeks, cause: `Dossier: ${dossier.title}` });
  return { parliament: setDossier(parliament, dossierId, { funded: true, fundedWeek: week }), society: nextSociety, dossier };
}
// A bill drafted by the minister on the matter of a reform: the Government presents it (the player leads it), with the financing his group dislikes least.
export function draftDossierBill(parliament, dossierId, date) {
  const dossier = mustFind(parliament, dossierId);
  if (dossier.kind !== 'riforma') throw new Error('Il disegno di legge serve a una riforma.');
  if (dossier.drafted) throw new Error('Il ministro ha già preparato il testo.');
  if (!canManageParliament(parliament)) throw new Error('Per presentare un disegno di legge serve un mandato parlamentare attivo.');
  const spec = AREA_BY_ID[dossier.area];
  const group = dossier.groupId ? parliamentInternals.getGroup(parliament, dossier.groupId) : null;
  const dislike = group ? groupProfile(group).dislikesFinancing : null;
  const financing = ['evasione', 'deficit', 'tagli', 'ue'].find(item => item !== dislike && (item !== 'ue' || spec.euFunds)) ?? 'deficit';
  const instrument = Object.keys(spec.instruments ?? {}).includes('riforma') ? 'riforma' : Object.keys(spec.instruments ?? { riforma: 1 })[0];
  const design = { area: dossier.area, instrument, intensity: 1, financing, target: 'nazionale', segment: 'tutti', compromise: 0 };
  const out = proposeLaw(parliament, { title: spec.instruments?.[instrument] ?? `Disegno di legge: ${spec.label}`, category: spec.label, summary: `Disegno di legge del governo preparato dal ministro ${dossier.portfolio} (${spec.label.toLowerCase()}); copertura: ${financing}.`, currentDate: date, policy: design, origin: 'governo' });
  return { parliament: setDossier(out.parliament, dossierId, { drafted: true, draftLawId: out.law.id }), law: out.law, dossier };
}
export function postponeDossier(parliament, dossierId, date) {
  const dossier = mustFind(parliament, dossierId);
  if (dossier.postponed) throw new Error('Il dossier è già stato rinviato una volta.');
  let next = setDossier(parliament, dossierId, { postponed: 1, originalDue: dossier.due, due: addWeeks(date > dossier.due ? date : dossier.due, R.postponeWeeks), status: 'rinviato', alarmed: false });
  const minister = (next.government.ministers ?? []).find(item => item.id === dossier.ministerId);
  if (minister) next = setMinister(next, minister.id, item => ({ loyalty: clamp((item.loyalty ?? 60) + R.postponed.loyalty, 0, 100) }));
  return record(next, date, 'dossier-rinvio', `Il Governo concede più tempo al ministro ${dossier.portfolio}: ${dossier.title.toLowerCase()}.`, { dossierId, ministerId: dossier.ministerId, source: SIM });
}
export function withdrawDossier(parliament, dossierId, date, week) {
  const dossier = mustFind(parliament, dossierId);
  return settle(parliament, dossier, 'ritirato', { date, week, margin: null });
}

// ---------- the programme against what was done ----------
export function programReport(parliament, society, date) {
  const program = parliament?.government?.program;
  if (!program?.priorities?.length) return null;
  const since = program.setAt;
  const rows = program.priorities.map(area => {
    const applied = (society?.lawsApplied ?? []).filter(item => item.area === area && item.date >= since);
    const bill = (parliament.laws ?? []).filter(law => law.policy?.area === area && (law.introducedAt ?? '') >= since && majorityBill(law) && !['rejected', 'lapsed'].includes(law.stage)).sort((a, b) => (LAW_PROGRESS[b.stage] ?? 0) - (LAW_PROGRESS[a.stage] ?? 0))[0];
    return { area, label: AREA_BY_ID[area]?.label ?? area, status: applied.length ? 'attuata' : bill ? 'in-corso' : 'ferma', measures: applied.map(item => item.title), bill: bill ? { id: bill.id, title: bill.title, stage: bill.stage } : null };
  });
  const done = rows.filter(row => row.status === 'attuata').length;
  return { rows, share: Math.round(done / rows.length * 100) / 100, done, total: rows.length, since, weeks: weeksOf(since, date), settled: Boolean(program.settledAt) };
}
// After enough weeks the programme is balanced, once: a Government that did what it said is rewarded, one that did nothing is punished (the allies, the stability).
export function settleProgram(parliament, society, date) {
  const government = parliament?.government;
  if (!government || government.status !== 'active' || !government.program?.setAt || government.program.settledAt) return { parliament, report: null };
  if (weeksOf(government.program.setAt, date) < R.program.weeks) return { parliament, report: null };
  const report = programReport(parliament, society, date);
  if (!report) return { parliament, report: null };
  const good = report.share >= R.program.good, bad = report.share <= R.program.bad;
  let next = withGovernment(parliament, { program: { ...government.program, settledAt: date, settledShare: report.share } });
  if (good || bad) {
    next = shiftStability(next, good ? R.program.goodStability : R.program.badStability);
    for (const groupId of Object.keys(next.government.partners ?? {})) next = shiftPartner(next, groupId, good ? R.program.goodPartner : R.program.badPartner);
  }
  next = record(next, date, 'programma-bilancio', `Bilancio del programma di governo: ${report.done} priorità su ${report.total} attuate (${Math.round(report.share * 100)}%)${good ? ': gli alleati riconoscono il lavoro svolto' : bad ? ': la maggioranza lamenta che si è fatto poco o nulla' : ''}.`, { share: report.share, done: report.done, total: report.total, source: SIM });
  return { parliament: next, report };
}
export const dossierKindLabel = kind => DOSSIER_KINDS[kind]?.label ?? kind;
