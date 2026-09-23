import { ITALIAN_REGIONS } from '../data/regions.js?v=20260924-11';
import { INDICATORS, ISSUE_THRESHOLD, ISSUE_TOPICS, LAW_EFFECTS, LAW_PHASE_IN_WEEKS, MEDIA_OUTLETS, REAL_TOPIC_AREAS, SCENARIO_EXECUTIVE, SEGMENTS } from '../data/simulation/society-rules.js?v=20260924-11';

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

function draw(society) {
  society.rngState = (Math.imul(society.rngState, 1664525) + 1013904223) >>> 0;
  return society.rngState / 4294967296;
}
const between = (society, min, max) => min + draw(society) * (max - min);

// ---------- derived measures ----------
function economyMood(economy) {
  return clamp(50 + (economy.growth - 0.8) * 12 - (economy.unemployment - 7.5) * 4 - (economy.inflation - 2) * 5 - Math.max(0, economy.deficit - 3.5) * 3, 0, 100);
}
function regionSatisfaction(region, economy) {
  const values = INDICATOR_IDS.map(id => region.indicators[id]);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const needs = values.filter(value => value < 45).reduce((sum, value) => sum + (45 - value), 0);
  return clamp(mean * 0.75 - needs * 0.25 + economyMood(economy) * 0.3, 0, 100);
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
function refresh(society) {
  const national = nationalIndicators(society);
  for (const region of Object.values(society.regions)) region.satisfaction = round1(regionSatisfaction(region, society.economy));
  for (const segment of society.segments) {
    const topics = Object.entries(segment.attention).reduce((sum, [id, weight]) => sum + (national[id] ?? 50) * weight, 0);
    segment.satisfaction = round1(clamp(topics * 0.7 + economyMood(society.economy) * 0.2 + segment.economic * 0.1 + (segment.mood ?? 0), 0, 100));
    segment.participation = round1(clamp(35 + segment.trust * 0.35 + Math.abs(segment.satisfaction - 50) * 0.3, 20, 90));
  }
  society.satisfaction = nationalSatisfaction(society);
  society.participation = round1(society.segments.reduce((sum, segment) => sum + segment.participation * segment.share, 0) / 100);
}

// ---------- creation ----------
export function createSociety({ seedText, date, week = 1, homeRegion = null, notoriety = 20 }) {
  const seed = hash(`${seedText}|societa`);
  const society = { version: 1, source: SIM, seed, rngState: seed, createdAt: date, week, homeRegion, regions: {}, segments: [], effects: [], issues: [], lawsApplied: [], history: [], trust: 48, satisfaction: 50, participation: 60 };
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
  society.segments = SEGMENTS.map(segment => ({ ...segment, attention: { ...segment.attention }, economic: Math.round(between(society, 38, 62)), trust: round1(between(society, 42, 56)), mood: 0, satisfaction: 50, participation: 60, source: SIM }));
  society.media = { visibility: round1(clamp(notoriety * 0.7, 5, 90)), sentiment: 0, outlets: MEDIA_OUTLETS.map(outlet => ({ ...outlet, stance: 0, attention: 10, source: SIM })), coverage: [], source: SIM };
  society.executive = { label: SCENARIO_EXECUTIVE.label, approval: 45, lastActionWeek: week, measures: [], source: SIM };
  refresh(society);
  society.issues = detectIssues(society);
  society.history.push(snapshot(society, date));
  return society;
}
export function normalizeSociety(society) {
  if (!society || typeof society !== 'object' || !society.regions) return null;
  return { effects: [], issues: [], lawsApplied: [], history: [], ...society };
}
function snapshot(society, date) {
  return { week: society.week, date, satisfaction: society.satisfaction, trust: round1(society.trust), participation: society.participation, growth: society.economy.growth, unemployment: society.economy.unemployment, inflation: society.economy.inflation, deficit: society.economy.deficit, headroom: round1(society.publicFinance.headroom), visibility: society.media.visibility, sentiment: society.media.sentiment };
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
  return issues.sort((a, b) => b.severity - a.severity);
}

// ---------- laws through the country ----------
export function realLawArea(law) {
  const text = [...(law.topics ?? []), law.officialTitle ?? ''].join(' ').toUpperCase();
  return REAL_TOPIC_AREAS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}
export function applyLawToSociety(input, { category, compromiseLevel = 0, title, origin = 'giocatore', date, week }) {
  const society = copy(input);
  const effect = LAW_EFFECTS[category];
  if (!effect) return { society, summary: null };
  let strength = 1 - 0.12 * compromiseLevel;
  const covered = society.publicFinance.headroom >= effect.cost;
  if (!covered) strength *= 0.6;
  // Lagging territories gain more: the same law produces different local effects.
  const topRegions = new Map();
  for (const [indicator, delta] of Object.entries(effect.indicators)) {
    const gaps = Object.values(society.regions).map(region => [region.name, 100 - region.indicators[indicator]]);
    const meanGap = gaps.reduce((sum, [, gap]) => sum + gap, 0) / gaps.length || 1;
    for (const [name, gap] of gaps) {
      const gain = delta * strength * gap / meanGap;
      society.effects.push({ id: `effetto-${week}-${society.effects.length}`, region: name, indicator, perWeek: round2(gain / LAW_PHASE_IN_WEEKS), remaining: LAW_PHASE_IN_WEEKS, cause: title, source: SIM });
      topRegions.set(name, (topRegions.get(name) ?? 0) + gain);
    }
  }
  for (const [key, delta] of Object.entries(effect.economy)) society.economy[key] = round2(society.economy[key] + delta * strength * (key === 'deficit' && !covered ? 1.6 : 1));
  society.publicFinance.headroom = round1(clamp(society.publicFinance.headroom - effect.cost * strength, 0, 100));
  society.publicFinance.committed = round1(society.publicFinance.committed + effect.cost * strength);
  for (const segment of society.segments) {
    if (effect.pleased.includes(segment.id)) segment.mood = round1(clamp((segment.mood ?? 0) + 3 * strength, -15, 15));
    if (effect.displeased.includes(segment.id)) segment.mood = round1(clamp((segment.mood ?? 0) - 2 * strength, -15, 15));
  }
  refresh(society);
  const summary = {
    title, category, origin, week, date, strength: round2(strength), covered, cost: round1(effect.cost * strength),
    topRegions: [...topRegions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, gain]) => ({ name, gain: round1(gain) })),
    pleased: effect.pleased, displeased: effect.displeased, source: SIM
  };
  society.lawsApplied = [summary, ...society.lawsApplied].slice(0, 30);
  return { society, summary };
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

// ---------- week ----------
export function advanceSociety(input, { date, week, government = null, notoriety = 20 }) {
  const society = copy(input);
  society.week = week;
  const lines = [];
  const derived = [];
  for (const effect of society.effects) {
    const region = society.regions[effect.region];
    if (region) region.indicators[effect.indicator] = round1(clamp(region.indicators[effect.indicator] + effect.perWeek));
    effect.remaining -= 1;
  }
  society.effects = society.effects.filter(effect => effect.remaining > 0);
  const economy = society.economy;
  const stability = government?.stability ?? 50;
  economy.growth = round2(clamp(economy.growth + (draw(society) - 0.5) * 0.14 + (stability - 50) / 2500 + (society.publicFinance.headroom - 50) / 6000 + (0.8 - economy.growth) * 0.08, -3, 4));
  economy.unemployment = round1(clamp(economy.unemployment - (economy.growth - 0.8) * 0.05 + (7.5 - economy.unemployment) * 0.02 + (draw(society) - 0.5) * 0.1, 3, 16));
  economy.inflation = round1(clamp(economy.inflation + (draw(society) - 0.5) * 0.12 + (economy.deficit - 3) * 0.01 + (2 - economy.inflation) * 0.02, -1, 9));
  economy.deficit = round1(clamp(economy.deficit + (3.2 - economy.deficit) * 0.04 - (economy.growth - 0.8) * 0.01, 0, 10));
  economy.debt = round1(clamp(economy.debt + (economy.deficit - 2.6) * 0.03 - economy.growth * 0.02, 80, 200));
  society.publicFinance.headroom = round1(clamp(society.publicFinance.headroom + 0.8 + economy.growth * 0.2 - Math.max(0, economy.deficit - 4) * 0.4, 0, 100));
  for (const region of Object.values(society.regions)) {
    for (const id of INDICATOR_IDS) {
      const economic = id === 'economia' || id === 'occupazione' ? (economy.growth - 0.8) * 0.1 : 0;
      region.indicators[id] = round1(clamp(region.indicators[id] + (50 - region.indicators[id]) * 0.012 + (draw(society) - 0.5) * 0.9 + economic - (AGEING.includes(id) ? 0.12 : 0)));
    }
  }
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
  const trustDrift = (society.satisfaction - before) * 0.3 + (government ? (stability - 50) / 400 : 0) + (48 - society.trust) * 0.02;
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
    lines.push(`Nuovo problema: ${issue.scope === 'regionale' ? `${INDICATORS.find(item => item.id === issue.indicator)?.label} in ${issue.region}` : issue.id === 'nazionale-carovita' ? 'carovita' : issue.id === 'nazionale-conti' ? 'conti pubblici sotto pressione' : 'disoccupazione in aumento'}`);
  }
  // Without a player-led government, the scenario executive acts on the most pressing problem.
  let measure = null;
  const governing = government && ['active', 'crisis'].includes(government.status);
  if (!governing && week - society.executive.lastActionWeek >= SCENARIO_EXECUTIVE.agendaEveryWeeks) {
    const topic = society.issues[0]?.topic ?? ['Economia', 'Sanità', 'Lavoro', 'Infrastrutture', 'Welfare'][Math.floor(draw(society) * 5)];
    society.executive.lastActionWeek = week;
    if (society.publicFinance.headroom >= LAW_EFFECTS[topic].cost) {
      const result = applyLawToSociety(society, { category: topic, title: `Provvedimento dell’esecutivo: ${topic.toLowerCase()}`, origin: 'esecutivo', date, week });
      Object.assign(society, result.society);
      society.executive.measures = [result.summary, ...(society.executive.measures ?? [])].slice(0, 12);
      measure = result.summary;
      lines.push(`L’esecutivo di scenario adotta un provvedimento su ${topic.toLowerCase()}.`);
    } else lines.push(`L’esecutivo rinvia un provvedimento su ${topic.toLowerCase()}: mancano le coperture.`);
  }
  society.executive.approval = round1(clamp(society.executive.approval + (societyMood(society) - society.executive.approval) * 0.1 + (draw(society) - 0.5) * 1.5, 10, 80));
  society.history = [...society.history, snapshot(society, date)].slice(-HISTORY);
  return { society, lines, derived, measure };
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
// Local listening, visits and promises move a region's opinion a little.
export function regionAttention(input, regionName, delta) {
  const society = copy(input);
  const region = society.regions[regionName];
  if (region) region.trust = round1(clamp(region.trust + delta));
  return society;
}
export { INDICATORS, SEGMENTS, MEDIA_OUTLETS };
