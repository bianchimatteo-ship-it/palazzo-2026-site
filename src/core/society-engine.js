import { ITALIAN_REGIONS } from '../data/regions.js?v=20260926-3';
import { INDICATORS, ISSUE_THRESHOLD, ISSUE_TOPICS, MEDIA_OUTLETS, REAL_TOPIC_AREAS, SCENARIO_EXECUTIVE, SEGMENTS } from '../data/simulation/society-rules.js?v=20260926-3';
import { AREA_BY_ID, AREA_GROUPS, BILLION_PER_POINT, EU_DEFICIT_LIMIT, EU_PROCEDURE_WEEKS, FINANCING, INSTRUMENT_KINDS, INTENSITY, MACRO_AREAS, POLICY_AREAS, SPREAD_BASE, TERRITORIAL_TARGETS, areaOf, macroAreaOf } from '../data/simulation/policy-rules.js?v=20260926-3';

const SIM = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const HISTORY = 104;
const INDICATOR_IDS = INDICATORS.map(item => item.id);
// Services and networks wear out without new investment.
const AGEING = ['sanita', 'servizi', 'infrastrutture', 'trasporti'];
const segmentLabel = id => SEGMENTS.find(item => item.id === id)?.label ?? id;

function draw(society) {
  society.rngState = (Math.imul(society.rngState, 1664525) + 1013904223) >>> 0;
  return society.rngState / 4294967296;
}
const between = (society, min, max) => min + draw(society) * (max - min);

// ---------- derived measures ----------
function economyMood(economy) {
  return clamp(50 + (economy.growth - 0.8) * 12 - (economy.unemployment - 7.5) * 4 - (economy.inflation - 2) * 5 - Math.max(0, economy.deficit - 3.5) * 3, 0, 100);
}
// Each region has its own mix of citizens: the same measure pleases some territories more than others.
function segmentPull(region, segments) {
  return segments.reduce((sum, segment) => sum + (region.demography?.[segment.id] ?? segment.share) / 100 * (segment.mood ?? 0), 0);
}
function regionSatisfaction(region, economy, segments = []) {
  const values = INDICATOR_IDS.map(id => region.indicators[id]);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const needs = values.filter(value => value < 45).reduce((sum, value) => sum + (45 - value), 0);
  return clamp(mean * 0.75 - needs * 0.25 + economyMood(economy) * 0.3 + segmentPull(region, segments) * 0.8 + (region.mood ?? 0), 0, 100);
}
function makeDemography(rand) {
  const raw = SEGMENTS.map(segment => [segment.id, segment.share * (0.7 + rand() * 0.6)]);
  const total = raw.reduce((sum, [, value]) => sum + value, 0);
  return Object.fromEntries(raw.map(([id, value]) => [id, round1(value / total * 100)]));
}
// What citizens of a region ask for first: weak services weighted by who lives there.
export function regionPriorities(society, name, count = 3) {
  const region = society?.regions?.[name];
  if (!region) return [];
  const weight = id => 1 + SEGMENTS.reduce((sum, segment) => sum + (region.demography?.[segment.id] ?? segment.share) / 100 * (segment.attention[id] ?? 0), 0) * 3;
  return INDICATOR_IDS.map(id => ({ id, label: INDICATORS.find(item => item.id === id).label, score: (100 - region.indicators[id]) * weight(id) })).sort((a, b) => b.score - a.score).slice(0, count);
}
export function nationalIndicators(society) {
  const total = Object.values(society.regions).reduce((sum, region) => sum + region.weight, 0) || 1;
  return Object.fromEntries(INDICATOR_IDS.map(id => [id, round1(Object.values(society.regions).reduce((sum, region) => sum + region.indicators[id] * region.weight, 0) / total)]));
}
export function nationalSatisfaction(society) {
  const total = Object.values(society.regions).reduce((sum, region) => sum + region.weight, 0) || 1;
  return round1(Object.values(society.regions).reduce((sum, region) => sum + region.satisfaction * region.weight, 0) / total);
}
export function societyMood(society) {
  if (!society) return 50;
  return Math.round(nationalSatisfaction(society) * 0.6 + economyMood(society.economy) * 0.25 + society.trust * 0.15);
}
// The value of a policy area: measured on the territories when it has a regional indicator,
// from the accounts for public finances, from the security model for security, stored otherwise.
export function areaValue(society, areaId) {
  const spec = AREA_BY_ID[areaId];
  if (!spec || !society) return null;
  if (areaId === 'finanze') {
    const { deficit, debt } = society.economy;
    return round1(clamp(100 - Math.max(0, deficit - 2) * 11 - Math.max(0, debt - 110) * 0.45 - Math.max(0, (society.publicFinance?.spread ?? SPREAD_BASE) - SPREAD_BASE) / 7));
  }
  if (spec.security && society.security) return round1(society.security.perceived);
  if (spec.regional) {
    const national = nationalIndicators(society);
    const entries = Object.entries(spec.regional);
    const weight = entries.reduce((sum, [, value]) => sum + value, 0);
    return round1(entries.reduce((sum, [id, value]) => sum + (national[id] ?? 50) * value, 0) / weight);
  }
  return round1(society.areas?.[areaId]?.value ?? 50);
}
export function areaTable(society) {
  return POLICY_AREAS.map(spec => ({ id: spec.id, label: spec.label, group: spec.group, groupLabel: AREA_GROUPS[spec.group], icon: spec.icon, indicator: spec.national, value: areaValue(society, spec.id), trend: society.areas?.[spec.id]?.trend ?? 0, problem: spec.problem, portfolio: spec.portfolio }));
}
function refresh(society) {
  const national = nationalIndicators(society);
  for (const region of Object.values(society.regions)) {
    region.satisfaction = round1(regionSatisfaction(region, society.economy, society.segments));
    region.participation = round1(clamp(35 + region.trust * 0.35 + Math.abs(region.satisfaction - 50) * 0.3, 20, 90));
  }
  for (const segment of society.segments) {
    const topics = Object.entries(segment.attention).reduce((sum, [id, weight]) => sum + (national[id] ?? 50) * weight, 0);
    segment.satisfaction = round1(clamp(topics * 0.7 + economyMood(society.economy) * 0.2 + segment.economic * 0.1 + (segment.mood ?? 0), 0, 100));
    segment.participation = round1(clamp(35 + segment.trust * 0.35 + Math.abs(segment.satisfaction - 50) * 0.3, 20, 90));
  }
  society.satisfaction = nationalSatisfaction(society);
  society.participation = round1(society.segments.reduce((sum, segment) => sum + segment.participation * segment.share, 0) / 100);
}

// ---------- creation ----------
function seedPolicy(society, rand) {
  society.areas = Object.fromEntries(POLICY_AREAS.map(spec => [spec.id, { value: Math.round(38 + rand() * 30), trend: 0, source: SIM }]));
  society.security = { crime: round1(40 + rand() * 14), perceived: round1(44 + rand() * 12), capacity: round1(46 + rand() * 10), prevention: round1(40 + rand() * 12), operations: 0, source: SIM };
  society.publicFinance = { headroom: 60, committed: 0, history: [], spread: round1(SPREAD_BASE + rand() * 40), euStatus: 'regolare', euWeeks: 0, allocations: {}, budget: null, euFundsUsed: 0, source: SIM, ...(society.publicFinance ?? {}) };
}
export function createSociety({ seedText, date, week = 1, homeRegion = null, notoriety = 20 }) {
  const seed = hash(`${seedText}|societa`);
  const society = { version: 2, source: SIM, seed, rngState: seed, createdAt: date, week, homeRegion, regions: {}, segments: [], effects: [], issues: [], lawsApplied: [], history: [], trust: 48, satisfaction: 50, participation: 60 };
  society.economy = {
    growth: round2(between(society, 0.2, 1.2)), unemployment: round1(between(society, 6.2, 8.8)), inflation: round1(between(society, 1.4, 2.8)),
    deficit: round1(between(society, 2.8, 3.8)), debt: round1(between(society, 128, 140)), source: SIM
  };
  society.publicFinance = { headroom: 60, committed: 0, history: [], source: SIM };
  for (const name of ITALIAN_REGIONS) {
    society.regions[name] = {
      name, weight: Math.round(between(society, 1, 10)), trust: round1(between(society, 42, 58)),
      indicators: Object.fromEntries(INDICATOR_IDS.map(id => [id, Math.round(between(society, 38, 72))])), satisfaction: 50, source: SIM
    };
  }
  for (const region of Object.values(society.regions)) region.demography = makeDemography(() => draw(society));
  society.segments = SEGMENTS.map(segment => ({ ...segment, attention: { ...segment.attention }, economic: Math.round(between(society, 38, 62)), trust: round1(between(society, 42, 56)), mood: 0, satisfaction: 50, participation: 60, source: SIM }));
  society.media = { visibility: round1(clamp(notoriety * 0.7, 5, 90)), sentiment: 0, outlets: MEDIA_OUTLETS.map(outlet => ({ ...outlet, stance: 0, attention: 10, source: SIM })), coverage: [], source: SIM };
  society.executive = { label: SCENARIO_EXECUTIVE.label, approval: 45, lastActionWeek: week, measures: [], source: SIM };
  seedPolicy(society, () => draw(society));
  refresh(society);
  society.issues = detectIssues(society);
  society.history.push(snapshot(society, date));
  return society;
}
export function normalizeSociety(society) {
  if (!society || typeof society !== 'object' || !society.regions) return null;
  const next = { effects: [], issues: [], lawsApplied: [], history: [], ...society };
  // Saves from before regional demography get a stable mix derived from the region's name.
  if (Object.values(next.regions).some(region => !region.demography)) {
    next.regions = Object.fromEntries(Object.entries(next.regions).map(([name, region]) => {
      if (region.demography) return [name, region];
      let state = hash(`${next.seed}|${name}`);
      return [name, { ...region, demography: makeDemography(() => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }) }];
    }));
    refresh(next);
  }
  // Saves from before the policy model gain area indicators, security and market pressure, seeded from the save.
  if (!next.areas || !next.security || next.publicFinance?.spread === undefined) {
    let state = hash(`${next.seed}|politiche`);
    const rand = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    const kept = { areas: next.areas, security: next.security };
    seedPolicy(next, rand);
    if (kept.areas) next.areas = { ...next.areas, ...kept.areas };
    if (kept.security) next.security = kept.security;
  }
  next.areas = { ...next.areas };
  for (const spec of POLICY_AREAS) next.areas[spec.id] ??= { value: 50, trend: 0, source: SIM };
  return next;
}
function snapshot(society, date) {
  return { week: society.week, date, satisfaction: society.satisfaction, trust: round1(society.trust), participation: society.participation, growth: society.economy.growth, unemployment: society.economy.unemployment, inflation: society.economy.inflation, deficit: society.economy.deficit, debt: society.economy.debt, headroom: round1(society.publicFinance.headroom), spread: society.publicFinance.spread ?? null, crime: society.security?.crime ?? null, perceived: society.security?.perceived ?? null, visibility: society.media.visibility, sentiment: society.media.sentiment };
}

// ---------- issues derived from the concrete situation ----------
function detectIssues(society) {
  const issues = [];
  for (const region of Object.values(society.regions)) {
    for (const id of INDICATOR_IDS) {
      const value = region.indicators[id];
      if (value < ISSUE_THRESHOLD) issues.push({ id: `${region.name}-${id}`, scope: 'regionale', region: region.name, indicator: id, topic: ISSUE_TOPICS[id], severity: Math.round(ISSUE_THRESHOLD - value), source: SIM });
    }
  }
  const economy = society.economy;
  if (economy.unemployment > 9.5) issues.push({ id: 'nazionale-disoccupazione', scope: 'nazionale', indicator: 'occupazione', topic: 'Lavoro', severity: Math.round((economy.unemployment - 9.5) * 4) + 1, source: SIM });
  if (economy.inflation > 4) issues.push({ id: 'nazionale-carovita', scope: 'nazionale', indicator: 'economia', topic: 'Economia', severity: Math.round((economy.inflation - 4) * 4) + 1, source: SIM });
  if (economy.deficit > 4.6 || society.publicFinance.headroom < 15) issues.push({ id: 'nazionale-conti', scope: 'nazionale', indicator: 'economia', topic: 'Economia', severity: Math.round(Math.max(economy.deficit - 4.6, (15 - society.publicFinance.headroom) / 5)) + 1, source: SIM });
  if (society.security && society.security.crime > 62) issues.push({ id: 'nazionale-criminalita', scope: 'nazionale', indicator: 'sicurezza', area: 'sicurezza', topic: 'Sicurezza', severity: Math.round((society.security.crime - 62) / 2) + 1, source: SIM });
  // National areas without a territorial indicator raise their own problems.
  for (const spec of POLICY_AREAS.filter(item => !item.regional && !item.security && !item.derived)) {
    const value = society.areas?.[spec.id]?.value;
    if (value !== undefined && value < 32) issues.push({ id: `nazionale-area-${spec.id}`, scope: 'nazionale', area: spec.id, indicator: null, topic: spec.label, severity: Math.round((32 - value) / 2) + 1, source: SIM });
  }
  if (society.publicFinance?.euStatus === 'procedura') issues.push({ id: 'nazionale-procedura-ue', scope: 'nazionale', area: 'europa', indicator: 'economia', topic: 'Finanze pubbliche', severity: 6, source: SIM });
  return issues.sort((a, b) => b.severity - a.severity);
}

// ---------- measures: what a policy costs, how it is paid for, who gains and who loses ----------
export function realLawArea(law) {
  const text = [...(law.topics ?? []), law.officialTitle ?? ''].join(' ').toUpperCase();
  return REAL_TOPIC_AREAS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}
// A complete, valid design for a measure; older laws only had a category.
export function measureDesign(input = {}) {
  const spec = areaOf(input.area) ?? areaOf(input.category);
  if (!spec) return null;
  const instrument = INSTRUMENT_KINDS[input.instrument] ? input.instrument : 'investimento';
  const intensity = [1, 2, 3].includes(Number(input.intensity)) ? Number(input.intensity) : 2;
  const financing = FINANCING[input.financing] ? input.financing : 'deficit';
  const cutArea = financing === 'tagli' && AREA_BY_ID[input.cutArea] && input.cutArea !== spec.id ? input.cutArea : financing === 'tagli' ? POLICY_AREAS.find(item => item.id !== spec.id && item.group !== spec.group)?.id : null;
  const target = spec.forcedTarget ?? (TERRITORIAL_TARGETS.some(item => item.id === input.target) || ITALIAN_REGIONS.includes(input.target) ? input.target : 'nazionale');
  const segment = SEGMENTS.some(item => item.id === input.segment) ? input.segment : 'tutti';
  const compromise = clamp(Math.round(Number(input.compromise ?? input.compromiseLevel ?? 0)), 0, 3);
  return { area: spec.id, instrument, intensity, financing: financing === 'ue' && !spec.euFunds ? 'deficit' : financing, cutArea, target, segment, compromise };
}
export function designLabel(design) {
  const spec = AREA_BY_ID[design.area];
  return spec?.instruments?.[design.instrument] ?? spec?.label ?? 'Misura';
}
function targetRegions(target) {
  if (!target || target === 'nazionale') return null;
  if (ITALIAN_REGIONS.includes(target)) return [target];
  const macro = TERRITORIAL_TARGETS.find(item => item.id === target)?.macro ?? [];
  return macro.flatMap(id => MACRO_AREAS[id]?.regions ?? []);
}
// The whole bill of a measure, before it is applied: cost, cover, effects on areas, territories and citizens.
export function measureImpact(society, input) {
  const design = measureDesign(input);
  if (!design) return null;
  const spec = AREA_BY_ID[design.area];
  const kind = INSTRUMENT_KINDS[design.instrument];
  const level = INTENSITY[design.intensity - 1];
  const financing = FINANCING[design.financing];
  const finance = society.publicFinance;
  const cost = round1(spec.base * kind.costFactor * level.cost * (1 - 0.08 * design.compromise));
  // How much of the fiscal margin the chosen cover uses.
  const shareOfMargin = { deficit: 1, tagli: 0.25, ue: 0.3, evasione: 0.45 }[design.financing] ?? 0.3;
  const europeOk = design.financing !== 'ue' || areaValue(society, 'europa') >= 38;
  const marginUse = round1(cost * (europeOk ? shareOfMargin : 1));
  const covered = finance.headroom >= marginUse;
  let strength = kind.effectFactor * level.effect * (1 - 0.12 * design.compromise) * (covered ? 1 : 0.6);
  // A cash-strapped country gets less out of every euro (an EU procedure makes it worse).
  if (finance.euStatus === 'procedura') strength *= 0.85;
  strength = round2(strength);
  const deficit = round2((design.financing === 'deficit' ? cost * 0.045 : 0) + (covered ? 0 : cost * 0.035) + (!europeOk ? cost * 0.03 : 0));
  const inside = targetRegions(design.target);
  const economy = {};
  for (const [key, value] of Object.entries(spec.economy ?? {})) economy[key] = round2(value * strength);
  if (financing.growth) economy.growth = round2((economy.growth ?? 0) + financing.growth * cost / 6);
  if (financing.inflation) economy.inflation = round2((economy.inflation ?? 0) + financing.inflation * cost / 6);
  // Territories: lagging regions gain more; a territorial target concentrates the gain and leaves the others behind.
  const regions = {};
  const byIndicator = {};
  const regionalSpec = spec.regional ?? {};
  const meanGaps = Object.fromEntries(Object.keys(regionalSpec).map(indicator => { const gaps = Object.values(society.regions).map(item => 100 - item.indicators[indicator]); return [indicator, gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length || 1]; }));
  for (const region of Object.values(society.regions)) {
    const factor = inside ? (inside.includes(region.name) ? 1.7 : 0.3) : 1;
    let gain = 0;
    byIndicator[region.name] = {};
    for (const [indicator, weight] of Object.entries(regionalSpec)) {
      const value = 6 * weight * strength * (100 - region.indicators[indicator]) / meanGaps[indicator] * factor;
      byIndicator[region.name][indicator] = round2(value);
      gain += value;
    }
    // Areas without a territorial indicator still reach people differently depending on who lives there.
    if (!spec.regional) gain = strength * 1.2 * factor * (spec.pleased.reduce((sum, id) => sum + (region.demography?.[id] ?? 20), 0) / Math.max(1, spec.pleased.length) / 20);
    if (design.financing === 'tagli' && AREA_BY_ID[design.cutArea]?.regional) gain -= cost * 0.25 * Object.keys(AREA_BY_ID[design.cutArea].regional).length / 2;
    regions[region.name] = round2(gain);
  }
  // Citizens: who benefits and who pays, with the reason.
  const segments = Object.fromEntries(SEGMENTS.map(item => [item.id, { delta: 0, reasons: [] }]));
  const add = (id, delta, reason) => { if (!segments[id] || !delta) return; segments[id].delta = round2(segments[id].delta + delta); segments[id].reasons.push(reason); };
  const boost = design.instrument === 'sostegno' ? 1.3 : 1;
  for (const id of spec.pleased) add(id, 2.5 * strength * boost, `beneficia di ${spec.label.toLowerCase()}`);
  for (const id of spec.displeased) add(id, -1.8 * strength * (0.6 + kind.controversy), `paga o perde con ${designLabel(design).toLowerCase()}`);
  if (design.segment !== 'tutti') {
    add(design.segment, 2 * strength, 'categoria favorita dalla misura');
    if (design.instrument === 'sostegno') for (const other of SEGMENTS.filter(item => item.id !== design.segment && !spec.pleased.includes(item.id))) add(other.id, -0.4 * strength, 'si sente escluso dal beneficio');
  }
  for (const [id, delta] of Object.entries(financing.tax ?? {})) add(id, delta * cost / 6, `paga la copertura: ${financing.label.toLowerCase()}`);
  if (design.financing === 'tagli') for (const id of AREA_BY_ID[design.cutArea]?.pleased ?? []) add(id, -1.5 * cost / 6, `perde con i tagli a ${AREA_BY_ID[design.cutArea].label.toLowerCase()}`);
  if (design.financing === 'deficit' && finance.headroom < 25) add('giovani', -0.4 * cost / 6, 'eredita più debito');
  // Security has its own mechanics: forces, prevention, operations and penalties work on different timescales.
  let security = null;
  if (spec.security) {
    security = {
      investimento: { capacity: 8, crime: -3, perceived: 4 },
      riforma: { prevention: 10, crime: -4, perceived: 1.5 },
      sostegno: { operations: 10, crime: -2, perceived: 6, capacity: -2 },
      regole: { perceived: 4, crime: -0.5, justice: -3 }
    }[design.instrument];
    security = Object.fromEntries(Object.entries(security).map(([key, value]) => [key, round2(value * strength)]));
    if (design.instrument === 'regole') add('giovani', -1.2 * strength, 'teme misure solo repressive');
    if (design.instrument === 'riforma') add('fragili', 1.2 * strength, 'quartieri riqualificati');
  }
  const areaDelta = round1(6 * strength * (spec.regional ? 0 : 1));
  const cutDelta = design.financing === 'tagli' ? round1(-cost * 0.9) : 0;
  const winners = Object.entries(segments).filter(([, value]) => value.delta > 0.2).sort((a, b) => b[1].delta - a[1].delta).map(([id, value]) => ({ id, label: segmentLabel(id), delta: value.delta, reason: value.reasons[0] }));
  const losers = Object.entries(segments).filter(([, value]) => value.delta < -0.2).sort((a, b) => a[1].delta - b[1].delta).map(([id, value]) => ({ id, label: segmentLabel(id), delta: value.delta, reason: value.reasons.find(reason => /paga|perde|escluso|teme|debito/.test(reason)) ?? value.reasons[0] }));
  const ordered = Object.entries(regions).sort((a, b) => b[1] - a[1]);
  const controversy = round2(kind.controversy * (0.7 + design.intensity * 0.2) + (design.financing === 'consumi' ? 0.3 : 0) + (design.financing === 'tagli' ? 0.25 : 0));
  return {
    design, area: spec.id, areaLabel: spec.label, instrumentLabel: designLabel(design), kind: design.instrument, cost, billions: round1(cost * BILLION_PER_POINT), marginUse, covered, europeOk, strength, deficit, economy,
    phaseIn: kind.phaseIn + (design.financing === 'ue' ? 6 : 0), lasting: kind.lasting, areaDelta, cutArea: design.cutArea, cutDelta, security, regions, byIndicator,
    topRegions: ordered.slice(0, 3).map(([name, gain]) => ({ name, gain: round1(gain) })), bottomRegions: ordered.slice(-3).reverse().map(([name, gain]) => ({ name, gain: round1(gain) })),
    segments: Object.fromEntries(Object.entries(segments).map(([id, value]) => [id, value.delta])), winners, losers,
    pleased: winners.map(item => item.id), displeased: losers.map(item => item.id), controversy, financingLabel: financing.label,
    targetLabel: TERRITORIAL_TARGETS.find(item => item.id === design.target)?.label ?? design.target, source: SIM
  };
}
function pushEffect(society, effect) {
  society.effects.push({ id: `effetto-${society.week}-${society.effects.length}-${society.rngState % 997}`, delay: 0, source: SIM, ...effect });
}
// Applies a measure: the money goes at once, the effects arrive week after week (and bonuses fade).
export function applyMeasure(input, design, { title, origin = 'giocatore', date, week, lawId = null } = {}) {
  const society = normalizeSociety(copy(input));
  const impact = measureImpact(society, design);
  if (!impact) return { society, summary: null };
  const phase = impact.phaseIn;
  const regionalSpec = AREA_BY_ID[impact.area].regional ?? {};
  for (const [name, gain] of Object.entries(impact.regions)) {
    for (const indicator of Object.keys(regionalSpec)) {
      const share = impact.byIndicator[name]?.[indicator] ?? 0;
      pushEffect(society, { region: name, indicator, perWeek: round2(share / phase), remaining: phase, cause: title });
      if (!impact.lasting) pushEffect(society, { region: name, indicator, perWeek: round2(-share * 0.6 / 12), remaining: 12, delay: phase, cause: `${title} (fine del sostegno)` });
    }
    if (!Object.keys(regionalSpec).length && Math.abs(gain) > 0.05) society.regions[name].mood = round2(clamp((society.regions[name].mood ?? 0) + gain * 0.5, -8, 8));
  }
  if (impact.areaDelta) {
    pushEffect(society, { area: impact.area, perWeek: round2(impact.areaDelta / phase), remaining: phase, cause: title });
    if (!impact.lasting) pushEffect(society, { area: impact.area, perWeek: round2(-impact.areaDelta * 0.6 / 12), remaining: 12, delay: phase, cause: `${title} (fine del sostegno)` });
  }
  if (impact.cutDelta) pushEffect(society, { area: impact.cutArea, perWeek: round2(impact.cutDelta / 8), remaining: 8, cause: `Tagli per finanziare ${title}` });
  if (impact.security) {
    for (const [key, value] of Object.entries(impact.security)) {
      if (key === 'justice') { pushEffect(society, { area: 'giustizia', perWeek: round2(value / 8), remaining: 8, cause: title }); continue; }
      const weeks = key === 'perceived' ? Math.min(phase, 6) : key === 'operations' ? 1 : key === 'crime' ? phase + 8 : phase + 4;
      pushEffect(society, { security: key, perWeek: round2(value / weeks), remaining: weeks, cause: title });
    }
  }
  for (const [key, delta] of Object.entries(impact.economy)) society.economy[key] = round2(society.economy[key] + delta);
  society.economy.deficit = round2(society.economy.deficit + impact.deficit);
  const finance = society.publicFinance;
  finance.headroom = round1(clamp(finance.headroom - impact.marginUse, 0, 100));
  finance.committed = round1((finance.committed ?? 0) + impact.cost);
  finance.spread = round1((finance.spread ?? SPREAD_BASE) + impact.deficit * 18);
  if (impact.design.financing === 'ue') finance.euFundsUsed = round1((finance.euFundsUsed ?? 0) + impact.cost);
  // Uncertain cover: the promised recovery of tax evasion may never come.
  let evasionShortfall = false;
  if (impact.design.financing === 'evasione' && draw(society) > FINANCING.evasione.uncertain) {
    evasionShortfall = true;
    society.economy.deficit = round2(society.economy.deficit + impact.cost * 0.03);
  }
  for (const segment of society.segments) segment.mood = round1(clamp((segment.mood ?? 0) + (impact.segments[segment.id] ?? 0), -15, 15));
  refresh(society);
  const summary = {
    title, category: impact.areaLabel, area: impact.area, origin, week, date, lawId, strength: impact.strength, covered: impact.covered, cost: impact.cost, billions: impact.billions,
    financing: impact.design.financing, financingLabel: impact.financingLabel, target: impact.design.target, targetLabel: impact.targetLabel, instrument: impact.kind, instrumentLabel: impact.instrumentLabel,
    topRegions: impact.topRegions, bottomRegions: impact.bottomRegions, pleased: impact.pleased, displeased: impact.displeased, winners: impact.winners, losers: impact.losers,
    deficit: impact.deficit, evasionShortfall, controversy: impact.controversy, lasting: impact.lasting, source: SIM
  };
  society.lawsApplied = [summary, ...society.lawsApplied].slice(0, 40);
  return { society, summary, impact };
}
// Compatibility entry point: a law described only by its area uses a medium investment paid in deficit.
export function applyLawToSociety(input, { category, compromiseLevel = 0, title, origin = 'giocatore', date, week, policy = null, lawId = null }) {
  const design = measureDesign({ ...(policy ?? {}), area: policy?.area ?? category, compromise: policy?.compromise ?? compromiseLevel });
  if (!design) return { society: copy(input), summary: null };
  if (!policy) design.financing = 'deficit';
  return applyMeasure(input, design, { title, origin, date, week, lawId });
}
// A decree not converted in time: what has not happened yet is cancelled and part of the rest is undone.
export function revokeMeasure(input, title, share = 0.6) {
  const society = copy(input);
  const summary = society.lawsApplied.find(item => item.title === title);
  const pending = society.effects.filter(effect => effect.cause === title || effect.cause === `${title} (fine del sostegno)`);
  society.effects = society.effects.filter(effect => !pending.includes(effect));
  for (const effect of pending.filter(item => !item.delay)) {
    const done = effect.perWeek * Math.max(0, (effect.weeks ?? effect.remaining) - effect.remaining);
    if (effect.region && society.regions[effect.region]) society.regions[effect.region].indicators[effect.indicator] = round1(clamp(society.regions[effect.region].indicators[effect.indicator] - done * share));
    else if (effect.area && society.areas?.[effect.area]) society.areas[effect.area].value = round1(clamp(society.areas[effect.area].value - done * share));
    else if (effect.security && society.security) society.security[effect.security] = round1(clamp(society.security[effect.security] - done * share));
  }
  if (summary) summary.revoked = true;
  for (const segment of society.segments) if (summary?.pleased?.includes(segment.id)) segment.mood = round1(clamp((segment.mood ?? 0) - 1.5, -15, 15));
  refresh(society);
  return society;
}
// The annual budget: more or less money per group of areas, a tax lever and the deficit it implies.
export function budgetImpact(society, plan = {}) {
  const allocations = Object.fromEntries(Object.keys(AREA_GROUPS).map(id => [id, clamp(Math.round(Number(plan.allocations?.[id] ?? 0)), -1, 1)]));
  const taxes = clamp(Math.round(Number(plan.taxes ?? 0)), -1, 1);
  const spending = Object.values(allocations).reduce((sum, value) => sum + value, 0);
  const deficit = round2(spending * 0.12 - taxes * 0.25);
  const winners = [...new Set(Object.entries(allocations).filter(([, level]) => level > 0).flatMap(([group]) => POLICY_AREAS.filter(item => item.group === group).flatMap(item => item.pleased)))];
  const losers = [...new Set(Object.entries(allocations).filter(([, level]) => level < 0).flatMap(([group]) => POLICY_AREAS.filter(item => item.group === group).flatMap(item => item.pleased)))];
  if (taxes > 0) losers.push('famiglie', 'imprese');
  return { allocations, taxes, spending, deficit, deficitAfter: round2((society?.economy?.deficit ?? 3) + deficit), headroomAfter: round1(clamp((society?.publicFinance?.headroom ?? 50) - spending * 3 + taxes * 6 + 8)), winners: winners.filter(id => !losers.includes(id)), losers: [...new Set(losers)], overLimit: (society?.economy?.deficit ?? 3) + deficit > EU_DEFICIT_LIMIT };
}
export function applyBudgetPlan(input, plan = {}, { date, week, title = 'Legge di bilancio' } = {}) {
  const society = normalizeSociety(copy(input));
  const impact = budgetImpact(society, plan);
  const finance = society.publicFinance;
  finance.allocations = impact.allocations;
  finance.budget = { year: Number(String(date ?? '').slice(0, 4)) || null, allocations: impact.allocations, taxes: impact.taxes, approvedWeek: week, source: SIM };
  finance.headroom = impact.headroomAfter;
  society.economy.deficit = round2(clamp(society.economy.deficit + impact.deficit, 0, 12));
  society.economy.growth = round2(society.economy.growth - impact.taxes * 0.08 + impact.spending * 0.02);
  const mood = (id, delta) => { const segment = society.segments.find(item => item.id === id); if (segment) segment.mood = round1(clamp((segment.mood ?? 0) + delta, -15, 15)); };
  for (const [group, level] of Object.entries(impact.allocations)) {
    if (!level) continue;
    for (const id of new Set(POLICY_AREAS.filter(item => item.group === group).flatMap(item => item.pleased))) mood(id, level * 0.8);
  }
  if (impact.taxes > 0) { mood('famiglie', -1.5); mood('imprese', -1.5); }
  if (impact.taxes < 0) { mood('famiglie', 1.2); mood('imprese', 1.2); mood('fragili', -0.3); }
  refresh(society);
  society.lawsApplied = [{ title, category: 'Finanze pubbliche', area: 'finanze', origin: 'governo', week, date, cost: round1(impact.spending * 3), covered: true, pleased: impact.winners, displeased: impact.losers, winners: impact.winners.map(id => ({ id, label: segmentLabel(id), reason: 'più risorse nel bilancio' })), losers: impact.losers.map(id => ({ id, label: segmentLabel(id), reason: 'tagli o più tasse nel bilancio' })), topRegions: [], budget: { allocations: impact.allocations, taxes: impact.taxes }, source: SIM }, ...society.lawsApplied].slice(0, 40);
  return society;
}
// Year without an approved budget: spending frozen month by month, markets nervous.
export function provisionalBudget(input) {
  const society = normalizeSociety(copy(input));
  society.publicFinance.allocations = Object.fromEntries(Object.keys(AREA_GROUPS).map(id => [id, 0]));
  society.publicFinance.spread = round1((society.publicFinance.spread ?? SPREAD_BASE) + 35);
  society.publicFinance.budget = { ...(society.publicFinance.budget ?? {}), provisional: true, source: SIM };
  society.trust = round1(clamp(society.trust - 3, 5, 95));
  refresh(society);
  return society;
}

// ---------- media ----------
export function mediaEvent(input, { outletId, tone = 0, intensity = 1, headline, date, week }) {
  const society = copy(input);
  const outlet = society.media.outlets.find(item => item.id === outletId) ?? society.media.outlets[0];
  society.media.visibility = round1(clamp(society.media.visibility + intensity * outlet.reach / 10));
  society.media.sentiment = round1(clamp(society.media.sentiment + tone * intensity * outlet.reach / 12, -100, 100));
  outlet.stance = round1(clamp(outlet.stance + tone * intensity * 3, -100, 100));
  outlet.attention = round1(clamp(outlet.attention + intensity * 8));
  if (headline) society.media.coverage = [{ id: `copertura-${week}-${society.media.coverage.length}`, week, date, outletId: outlet.id, outlet: outlet.label, headline, tone: tone > 0 ? 'good' : tone < 0 ? 'bad' : 'neutral', source: SIM }, ...society.media.coverage].slice(0, 40);
  return society;
}
// A shock in the news: fear rises faster than crime itself; an area or region can take the hit too.
export function societyShock(input, { perceived = 0, crime = 0, region = null, indicator = null, delta = 0, area = null, areaDelta = 0, growth = 0, inflation = 0, headroom = 0, trust = 0 } = {}) {
  const society = normalizeSociety(copy(input));
  society.security.perceived = round1(clamp(society.security.perceived + perceived));
  society.security.crime = round1(clamp(society.security.crime + crime));
  if (region && society.regions[region]) {
    if (perceived) society.regions[region].indicators.sicurezza = round1(clamp(society.regions[region].indicators.sicurezza + perceived * 1.2));
    if (indicator && delta) society.regions[region].indicators[indicator] = round1(clamp(society.regions[region].indicators[indicator] + delta));
  }
  if (area && areaDelta && society.areas[area]) society.areas[area].value = round1(clamp(society.areas[area].value + areaDelta));
  society.economy.growth = round2(society.economy.growth + growth);
  society.economy.inflation = round2(society.economy.inflation + inflation);
  society.publicFinance.headroom = round1(clamp(society.publicFinance.headroom + headroom));
  society.trust = round1(clamp(society.trust + trust, 5, 95));
  refresh(society);
  return society;
}

// ---------- week ----------
function runEffects(society) {
  for (const effect of society.effects) {
    if (effect.delay > 0) { effect.delay -= 1; continue; }
    effect.weeks ??= effect.remaining;
    if (effect.region) {
      const region = society.regions[effect.region];
      if (region) region.indicators[effect.indicator] = round1(clamp(region.indicators[effect.indicator] + effect.perWeek));
    } else if (effect.area && society.areas?.[effect.area]) {
      society.areas[effect.area].value = round1(clamp(society.areas[effect.area].value + effect.perWeek));
      society.areas[effect.area].trend = round2((society.areas[effect.area].trend ?? 0) + effect.perWeek);
    } else if (effect.security && society.security) {
      society.security[effect.security] = round1(clamp(society.security[effect.security] + effect.perWeek));
    }
    effect.remaining -= 1;
  }
  society.effects = society.effects.filter(effect => effect.remaining > 0);
}
// Crime follows unemployment, forces on the ground and prevention; fear follows crime and the news.
function securityWeek(society) {
  const s = society.security;
  const fragili = society.segments.find(item => item.id === 'fragili');
  s.crime = round1(clamp(s.crime + (society.economy.unemployment - 7.5) * 0.05 - (s.capacity - 50) * 0.015 - (s.prevention - 50) * 0.02 - (s.operations > 0 ? 0.25 : 0) + ((fragili?.mood ?? 0) < -4 ? 0.1 : 0) + (draw(society) - 0.5) * 0.5 + (46 - s.crime) * 0.025));
  s.perceived = round1(clamp(s.perceived + ((100 - s.crime) * 0.9 - s.perceived) * 0.06 + (s.operations > 0 ? 0.3 : 0) + (draw(society) - 0.5) * 0.6));
  s.capacity = round1(clamp(s.capacity - 0.03 + (50 - s.capacity) * 0.004 + ((society.publicFinance.allocations?.sicurezza ?? 0) * 0.12)));
  s.prevention = round1(clamp(s.prevention - 0.02 + (45 - s.prevention) * 0.003));
  s.operations = Math.max(0, (s.operations ?? 0) - 1);
  // The territories feel it: regional security moves toward the national climate.
  for (const region of Object.values(society.regions)) region.indicators.sicurezza = round1(clamp(region.indicators.sicurezza + (s.perceived - region.indicators.sicurezza) * 0.015));
}
// Markets and Brussels watch the accounts; interest on the debt eats the margin.
function financeWeek(society, stability) {
  const finance = society.publicFinance;
  const economy = society.economy;
  const target = SPREAD_BASE + Math.max(0, economy.deficit - EU_DEFICIT_LIMIT) * 55 + Math.max(0, economy.debt - 130) * 1.6 + (50 - stability) * 0.9 + (finance.euStatus === 'procedura' ? 45 : 0) + (finance.budget?.provisional ? 25 : 0);
  finance.spread = round1(clamp(finance.spread + (target - finance.spread) * 0.12 + (draw(society) - 0.5) * 8, 40, 700));
  finance.headroom = round1(clamp(finance.headroom - Math.max(0, finance.spread - 170) / 450, 0, 100));
  if (economy.deficit > EU_DEFICIT_LIMIT) finance.euWeeks = (finance.euWeeks ?? 0) + 1;
  else finance.euWeeks = Math.max(0, (finance.euWeeks ?? 0) - 1);
  const before = finance.euStatus;
  finance.euStatus = finance.euWeeks >= EU_PROCEDURE_WEEKS && economy.deficit > EU_DEFICIT_LIMIT + 0.4 ? 'procedura' : finance.euStatus === 'procedura' && finance.euWeeks > 0 ? 'procedura' : finance.euWeeks >= 6 ? 'richiamo' : 'regolare';
  if (society.areas?.europa) society.areas.europa.value = round1(clamp(society.areas.europa.value + (finance.euStatus === 'procedura' ? -0.4 : finance.euStatus === 'richiamo' ? -0.15 : 0.05)));
  return before !== finance.euStatus ? finance.euStatus : null;
}
function areasWeek(society) {
  const allocations = society.publicFinance.allocations ?? {};
  for (const spec of POLICY_AREAS) {
    const entry = society.areas[spec.id];
    if (!entry) continue;
    const funded = (allocations[spec.group] ?? 0) * 0.07;
    const drift = (50 - entry.value) * 0.008 + (draw(society) - 0.5) * 0.5 + funded;
    entry.value = round1(clamp(entry.value + drift));
    entry.trend = round2((entry.trend ?? 0) * 0.85 + drift);
    // Funding decided in the budget also reaches the territorial services of that group.
    if (funded && spec.regional) for (const region of Object.values(society.regions)) for (const indicator of Object.keys(spec.regional)) region.indicators[indicator] = round1(clamp(region.indicators[indicator] + funded * 0.3));
  }
}
export function advanceSociety(input, { date, week, government = null, notoriety = 20, legislates = false }) {
  const society = normalizeSociety(copy(input));
  society.week = week;
  const lines = [];
  const derived = [];
  runEffects(society);
  const economy = society.economy;
  const stability = government?.stability ?? 50;
  economy.growth = round2(clamp(economy.growth + (draw(society) - 0.5) * 0.14 + (stability - 50) / 2500 + (society.publicFinance.headroom - 50) / 6000 - Math.max(0, society.publicFinance.spread - 200) / 9000 + (0.8 - economy.growth) * 0.08, -3, 4));
  economy.unemployment = round2(clamp(economy.unemployment - (economy.growth - 0.8) * 0.05 + (7.5 - economy.unemployment) * 0.02 + (draw(society) - 0.5) * 0.1, 3, 16));
  economy.inflation = round2(clamp(economy.inflation + (draw(society) - 0.5) * 0.12 + (economy.deficit - 3) * 0.01 + (2 - economy.inflation) * 0.02, -1, 9));
  economy.deficit = round2(clamp(economy.deficit + (2.8 - economy.deficit) * 0.04 - (economy.growth - 0.8) * 0.01 + Math.max(0, society.publicFinance.spread - 200) / 20000, 0, 12));
  economy.debt = round2(clamp(economy.debt + (economy.deficit - 2.6) * 0.03 - economy.growth * 0.02, 80, 200));
  // The fiscal margin refills slowly toward a normal year's room, never beyond: money is not infinite.
  society.publicFinance.headroom = round1(clamp(society.publicFinance.headroom + (55 - society.publicFinance.headroom) * 0.025 + economy.growth * 0.1 - Math.max(0, economy.deficit - 4) * 0.4, 0, 100));
  const euChange = financeWeek(society, stability);
  if (euChange === 'richiamo') lines.push('Bruxelles richiama l’Italia sul deficit.');
  if (euChange === 'procedura') lines.push('Si apre una procedura europea per deficit eccessivo: lo spread sale.');
  for (const region of Object.values(society.regions)) {
    for (const id of INDICATOR_IDS) {
      const economic = id === 'economia' || id === 'occupazione' ? (economy.growth - 0.8) * 0.1 : 0;
      region.indicators[id] = round1(clamp(region.indicators[id] + (50 - region.indicators[id]) * 0.012 + (draw(society) - 0.5) * 0.9 + economic - (AGEING.includes(id) ? 0.12 : 0)));
    }
    region.mood = round2((region.mood ?? 0) * 0.94);
  }
  securityWeek(society);
  areasWeek(society);
  // Local shocks: a closure, damage or a company crisis hits one territory hard.
  if (draw(society) < 0.09) {
    const names = Object.keys(society.regions);
    // The player's own region is watched more closely: its troubles make the local news more often.
    const region = society.regions[society.homeRegion] && draw(society) < 0.3 ? society.regions[society.homeRegion] : society.regions[names[Math.floor(draw(society) * names.length)]];
    const indicator = INDICATOR_IDS[Math.floor(draw(society) * INDICATOR_IDS.length)];
    const hit = Math.round(8 + draw(society) * 10);
    region.indicators[indicator] = round1(clamp(region.indicators[indicator] - hit));
    lines.push(`Colpo per ${INDICATORS.find(item => item.id === indicator).label.toLowerCase()} in ${region.name} (−${hit}).`);
  }
  for (const segment of society.segments) {
    segment.mood = round1((segment.mood ?? 0) * 0.93);
    segment.economic = round1(clamp(segment.economic + (economy.growth - 0.8) * 0.3 - (economy.inflation - 2) * 0.2 + (draw(society) - 0.5) * 0.6));
  }
  const before = society.satisfaction;
  refresh(society);
  const trustDrift = (society.satisfaction - before) * 0.3 + (government ? (stability - 50) / 400 : 0) + (48 - society.trust) * 0.02 - (society.publicFinance.euStatus === 'procedura' ? 0.1 : 0);
  society.trust = round1(clamp(society.trust + trustDrift, 5, 95));
  for (const segment of society.segments) segment.trust = round1(clamp(segment.trust + trustDrift * 0.8 + (draw(society) - 0.5) * 0.4, 5, 95));
  for (const region of Object.values(society.regions)) region.trust = round1(clamp(region.trust + trustDrift * 0.8 + (region.satisfaction - 50) * 0.004, 5, 95));
  // Media attention fades without new exposure; sentiment slowly returns to neutral.
  society.media.visibility = round1(clamp(society.media.visibility + (notoriety * 0.7 - society.media.visibility) * 0.08));
  society.media.sentiment = round1(society.media.sentiment * 0.92);
  for (const outlet of society.media.outlets) { outlet.attention = round1(outlet.attention * 0.85); outlet.stance = round1(outlet.stance * 0.95); }
  // New problems come from the indicators themselves.
  const known = new Set(society.issues.map(issue => issue.id));
  society.issues = detectIssues(society);
  for (const issue of society.issues.filter(item => !known.has(item.id)).slice(0, 2)) {
    derived.push(issue);
    lines.push(`Nuovo problema: ${issueLabel(issue)}`);
  }
  // Unless the player leads the Government, the executive acts on its own on the most pressing problem: the scenario
  // executive, or the Government in office led by the simulated Prime Minister. When the Chambers are at work
  // (lawmaking-engine) a Government in office acts through its bills and decrees instead.
  let measure = null;
  const inOffice = government && ['active', 'crisis'].includes(government.status);
  const governing = inOffice && government.primeMinister === 'player';
  const actor = inOffice ? 'Il governo in carica' : 'L’esecutivo di scenario';
  if (!governing && !(legislates && inOffice) && week - society.executive.lastActionWeek >= SCENARIO_EXECUTIVE.agendaEveryWeeks) {
    const topic = society.issues[0]?.topic ?? ['Economia', 'Sanità', 'Lavoro', 'Infrastrutture', 'Welfare'][Math.floor(draw(society) * 5)];
    const spec = areaOf(topic) ?? AREA_BY_ID.economia;
    society.executive.lastActionWeek = week;
    // The scenario executive keeps within the European reference: over 3% it pays with cuts, not debt.
    const tight = society.publicFinance.headroom < 20;
    const overLimit = society.economy.deficit > EU_DEFICIT_LIMIT - 0.5;
    const design = measureDesign({ area: spec.id, instrument: tight ? 'regole' : 'investimento', intensity: 1, financing: tight || overLimit ? 'tagli' : 'deficit' });
    const impact = measureImpact(society, design);
    if (impact.covered) {
      const result = applyMeasure(society, design, { title: `Provvedimento dell’esecutivo: ${spec.label.toLowerCase()}`, origin: 'esecutivo', date, week });
      Object.assign(society, result.society);
      society.executive.measures = [result.summary, ...(society.executive.measures ?? [])].slice(0, 12);
      measure = result.summary;
      lines.push(`${actor} adotta un provvedimento su ${spec.label.toLowerCase()}.`);
    } else lines.push(`${actor} rinvia un provvedimento su ${spec.label.toLowerCase()}: mancano le coperture.`);
  }
  society.executive.approval = round1(clamp(society.executive.approval + (societyMood(society) - society.executive.approval) * 0.1 + (draw(society) - 0.5) * 1.5, 10, 80));
  society.history = [...society.history, snapshot(society, date)].slice(-HISTORY);
  return { society, lines, derived, measure, euChange };
}
export function issueLabel(issue) {
  if (issue.scope === 'regionale') return `${INDICATORS.find(item => item.id === issue.indicator)?.label} in ${issue.region}`;
  if (issue.id === 'nazionale-carovita') return 'carovita';
  if (issue.id === 'nazionale-conti') return 'conti pubblici sotto pressione';
  if (issue.id === 'nazionale-disoccupazione') return 'disoccupazione in aumento';
  if (issue.id === 'nazionale-criminalita') return 'criminalità in aumento';
  if (issue.id === 'nazionale-procedura-ue') return 'procedura europea per deficit eccessivo';
  return AREA_BY_ID[issue.area]?.problem ?? issue.topic;
}
// Why the country's mood moved: the regions and groups that changed most, the economy, the measures in force.
export function explainMood(before, after) {
  if (!before || !after) return [];
  const causes = [];
  const regions = Object.values(after.regions).map(region => [region.name, round1(region.satisfaction - (before.regions[region.name]?.satisfaction ?? region.satisfaction))]).filter(([, delta]) => Math.abs(delta) >= 0.4).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const down = regions.filter(([, delta]) => delta < 0).slice(0, 2);
  const up = regions.filter(([, delta]) => delta > 0).slice(0, 2);
  if (down.length) causes.push({ label: `Peggiora in ${down.map(([name]) => name).join(' e ')}`, delta: round1(down.reduce((sum, [, delta]) => sum + delta, 0) / 4) });
  if (up.length) causes.push({ label: `Migliora in ${up.map(([name]) => name).join(' e ')}`, delta: round1(up.reduce((sum, [, delta]) => sum + delta, 0) / 4) });
  const growth = round2(after.economy.growth - before.economy.growth);
  const inflation = round2(after.economy.inflation - before.economy.inflation);
  if (Math.abs(growth) >= 0.05) causes.push({ label: growth > 0 ? 'L’economia accelera' : 'L’economia rallenta', delta: round1(growth * 3) });
  if (Math.abs(inflation) >= 0.1) causes.push({ label: inflation > 0 ? 'I prezzi salgono' : 'I prezzi rallentano', delta: round1(-inflation * 2) });
  const perceived = round1((after.security?.perceived ?? 0) - (before.security?.perceived ?? 0));
  if (Math.abs(perceived) >= 0.6) causes.push({ label: perceived > 0 ? 'Più sicurezza percepita' : 'Meno sicurezza percepita', delta: round1(perceived / 3) });
  const measures = after.lawsApplied.filter(item => !before.lawsApplied.some(old => old.title === item.title && old.week === item.week));
  for (const item of measures.slice(0, 2)) causes.push({ label: `Misura: ${item.title}`, delta: round1((item.pleased?.length ?? 0) * 0.3 - (item.displeased?.length ?? 0) * 0.3) });
  const segments = after.segments.map(segment => [segment.label, round1(segment.satisfaction - (before.segments.find(item => item.id === segment.id)?.satisfaction ?? segment.satisfaction))]).filter(([, delta]) => Math.abs(delta) >= 1).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  if (segments[0]) causes.push({ label: `${segments[0][0]}: ${segments[0][1] > 0 ? 'più soddisfatti' : 'meno soddisfatti'}`, delta: round1(segments[0][1] / 3) });
  return causes.slice(0, 5);
}

// Regions weigh on national averages in proportion to a verified reference (Camera seats by region).
export function calibrateWeights(input, weights = {}, reference = 'camera') {
  if (!input || input.weightSource === reference || !Object.keys(weights).length) return input;
  const society = copy(input);
  for (const region of Object.values(society.regions)) if (weights[region.name] > 0) region.weight = weights[region.name];
  society.weightSource = reference;
  refresh(society);
  return society;
}
// Listening to a group of citizens: their mood improves, most where they are numerous.
export function segmentAttention(input, segmentId, delta, regionName = null) {
  const society = copy(input);
  const segment = society.segments.find(item => item.id === segmentId);
  if (!segment) return society;
  segment.mood = round1(clamp((segment.mood ?? 0) + delta * 0.4, -15, 15));
  const region = society.regions[regionName];
  if (region) region.trust = round1(clamp(region.trust + delta * (region.demography?.[segmentId] ?? segment.share) / 25));
  refresh(society);
  return society;
}
// What a measure would do before it is voted: cost, cover, territories, citizens, satisfaction once in force.
export function projectMeasure(society, design) {
  const base = normalizeSociety(society);
  const result = applyMeasure(base, design, { title: 'proiezione', date: null, week: base.week });
  if (!result.summary) return null;
  const after = result.society;
  for (const effect of after.effects.filter(item => item.cause === 'proiezione')) {
    if (effect.region) after.regions[effect.region].indicators[effect.indicator] = round1(clamp(after.regions[effect.region].indicators[effect.indicator] + effect.perWeek * effect.remaining));
    else if (effect.area && after.areas[effect.area]) after.areas[effect.area].value = round1(clamp(after.areas[effect.area].value + effect.perWeek * effect.remaining));
    else if (effect.security) after.security[effect.security] = round1(clamp(after.security[effect.security] + effect.perWeek * effect.remaining));
  }
  refresh(after);
  const regionDeltas = Object.fromEntries(Object.values(after.regions).map(region => [region.name, round1(region.satisfaction - base.regions[region.name].satisfaction)]));
  return { ...result.impact, ...result.summary, satisfactionDelta: round1(after.satisfaction - base.satisfaction), headroomAfter: after.publicFinance.headroom, deficitAfter: after.economy.deficit, spreadAfter: after.publicFinance.spread, regionDeltas, areaAfter: areaValue(after, result.impact.area), areaBefore: areaValue(base, result.impact.area), crimeAfter: after.security.crime, perceivedAfter: after.security.perceived };
}
export function projectLaw(society, { category, compromiseLevel = 0, policy = null }) {
  const design = measureDesign({ ...(policy ?? {}), area: policy?.area ?? category, compromise: policy?.compromise ?? compromiseLevel });
  if (!design) return null;
  if (!policy) design.financing = 'deficit';
  return projectMeasure(society, design);
}
// Choices on the public budget when the margin is exhausted.
export function publicBudgetChoice(input, kind) {
  const society = copy(input);
  const mood = (id, delta) => { const segment = society.segments.find(item => item.id === id); if (segment) segment.mood = round1(clamp((segment.mood ?? 0) + delta, -15, 15)); };
  if (kind === 'public-cuts') {
    society.publicFinance.headroom = round1(clamp(society.publicFinance.headroom + 12));
    for (const region of Object.values(society.regions)) { region.indicators.servizi = round1(clamp(region.indicators.servizi - 1.5)); region.indicators.sanita = round1(clamp(region.indicators.sanita - 1)); }
    mood('fragili', -3); mood('anziani', -2);
  } else if (kind === 'public-deficit') {
    society.publicFinance.headroom = round1(clamp(society.publicFinance.headroom + 10));
    society.economy.deficit = round1(society.economy.deficit + 0.5);
    society.trust = round1(clamp(society.trust - 1.5, 5, 95));
  } else if (kind === 'public-taxes') {
    society.publicFinance.headroom = round1(clamp(society.publicFinance.headroom + 9));
    society.economy.growth = round2(society.economy.growth - 0.1);
    mood('imprese', -3); mood('famiglie', -1.5);
  }
  refresh(society);
  return society;
}
// Local listening, visits and promises move a region's opinion a little.
export function regionAttention(input, regionName, delta) {
  const society = copy(input);
  const region = society.regions[regionName];
  if (region) region.trust = round1(clamp(region.trust + delta));
  return society;
}
export { INDICATORS, SEGMENTS, MEDIA_OUTLETS, macroAreaOf };
