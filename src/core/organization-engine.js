import { ITALIAN_REGIONS } from '../data/regions.js?v=20260924-9';
import { CONGRESS_CYCLE_WEEKS, FIRST_CONGRESS_WEEKS, MEMBERSHIP_FEE, ORGANS, PARTY_PRIORITIES, SECTION_WEEKLY_COST, TREASURY_LABELS } from '../data/simulation/organization-rules.js?v=20260924-9';

// The party as an organisation: members, sections, bodies, cohesion, conflicts and treasury.
// Everything is simulated and lives inside the career state (game.party.org).
const SIM = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const HISTORY = 52;

const sectionLabel = (region, founder) => founder ? `Sezione ${region}` : `Federazione ${region}`;
const blankPeriod = () => ({ income: 0, expense: 0, byCategory: {} });

export function createOrganization({ rand, founder = false, region = null, share = null, week = 1, date = null }) {
  const home = ITALIAN_REGIONS.includes(region) ? region : ITALIAN_REGIONS[0];
  const size = founder ? 55 + Math.round(rand() * 50) : Math.round(Math.max(1.5, share ?? 5) * 5200 * (0.8 + rand() * 0.4));
  const regions = founder ? [home] : ITALIAN_REGIONS;
  const weights = regions.map(name => (name === home ? 1.6 : 0.6) + rand());
  const total = weights.reduce((sum, value) => sum + value, 0);
  const sections = regions.map((name, index) => ({ id: `sezione-${name}`, region: name, label: sectionLabel(name, founder), members: Math.max(12, Math.round(size * weights[index] / total)), vitality: Math.round(founder ? 62 : 38 + rand() * 32), openedWeek: week, source: SIM }));
  const members = sections.reduce((sum, item) => sum + item.members, 0);
  return {
    version: 1, source: SIM, founder, members, militants: Math.round(members * (founder ? 0.3 : 0.09)), cadres: sections.length * (founder ? 2 : 4) + (founder ? 3 : 14),
    sections, cohesion: founder ? 72 : Math.round(52 + rand() * 14), discipline: 70, conflicts: [],
    congress: { nextWeek: week + FIRST_CONGRESS_WEEKS, lastWeek: null, history: [] }, selections: {},
    priorities: { territorio: 1, comunicazione: 1, formazione: 1 }, lastCommunicationWeek: null,
    treasury: { balance: founder ? 1500 : Math.round(members * 9), current: blankPeriod(), history: [], yearTotals: blankPeriod(), annual: [], year: date?.slice(0, 4) ?? null },
    membersHistory: [{ week, members }], growth: 0
  };
}
export function normalizeOrganization(org, context) {
  if (!org || typeof org !== 'object' || !Array.isArray(org.sections)) return createOrganization(context);
  const base = createOrganization({ ...context, rand: () => 0.5 });
  return { ...base, ...org, treasury: { ...base.treasury, ...(org.treasury ?? {}) }, congress: { ...base.congress, ...(org.congress ?? {}) }, priorities: { ...base.priorities, ...(org.priorities ?? {}) } };
}

export const organOf = party => party ? ORGANS[party.affiliation === 'founder' ? 4 : Math.min(4, party.rank ?? 0)] : null;
export const isPartyLeader = party => party?.affiliation === 'founder' || (party?.rank ?? 0) >= 3;

export function treasuryBook(org, amount, category, label = null) {
  const value = Math.round(amount);
  if (!value) return;
  org.treasury.balance = Math.round(org.treasury.balance + value);
  for (const period of [org.treasury.current, org.treasury.yearTotals]) {
    if (value >= 0) period.income += value; else period.expense -= value;
    period.byCategory[category] = (period.byCategory[category] ?? 0) + value;
  }
  if (label) org.treasury.lastEntry = { label, amount: value, category };
}
function recount(org) {
  org.members = org.sections.reduce((sum, item) => sum + item.members, 0);
}

// Direct effects of the player's work in the party.
export function applyOrgEffects(org, effects = {}, lines = [], targetRegion = null) {
  if (effects.members) {
    // A membership drive adds a local batch of members: decisive for a young party, marginal for a large one.
    const added = Math.max(6, Math.round((18 + Math.sqrt(org.members) * 0.8) * effects.members));
    const pool = org.sections.reduce((sum, item) => sum + item.vitality, 0) || 1;
    for (const section of org.sections) section.members += Math.round(added * section.vitality / pool);
    recount(org);
    lines.push(`Iscritti +${added.toLocaleString('it-IT')}`);
  }
  if (effects.militants) { const added = Math.max(3, Math.round(org.members * effects.militants)); org.militants = Math.min(org.members, org.militants + added); lines.push(`Militanti attivi +${added}`); }
  if (effects.cohesion) { org.cohesion = Math.round(clamp(org.cohesion + effects.cohesion)); lines.push(`Coesione del partito ${effects.cohesion > 0 ? '+' : ''}${effects.cohesion}`); }
  if (effects.conflicts && org.conflicts.length) {
    for (const conflict of org.conflicts) conflict.intensity = Math.round(clamp(conflict.intensity + effects.conflicts));
    const closed = org.conflicts.filter(item => item.intensity <= 5);
    org.conflicts = org.conflicts.filter(item => item.intensity > 5);
    lines.push(closed.length ? `Chiuso lo scontro: ${closed[0].title}` : `Tensione interna ${effects.conflicts > 0 ? 'in aumento' : 'in calo'}`);
  }
  if (effects.discipline) org.discipline = Math.round(clamp(org.discipline + effects.discipline));
  if (effects.treasury) { treasuryBook(org, effects.treasury, 'donazioni', 'Contributo volontario'); lines.push(`Tesoreria del partito +${effects.treasury} €`); }
  if (effects.communication) { org.lastCommunicationWeek = effects.week ?? org.lastCommunicationWeek; }
  if (effects.section && targetRegion) {
    const existing = org.sections.find(item => item.region === targetRegion);
    if (existing) { existing.vitality = Math.round(clamp(existing.vitality + 18)); existing.members += Math.max(8, Math.round(existing.members * 0.03)); lines.push(`Rilanciata la ${existing.label.toLowerCase()} (vitalità ${existing.vitality})`); }
    else { org.sections.push({ id: `sezione-${targetRegion}`, region: targetRegion, label: sectionLabel(targetRegion, org.founder), members: 14, vitality: 60, openedWeek: effects.week ?? null, source: SIM }); org.cadres += 2; lines.push(`Aperta la sezione in ${targetRegion}`); }
    recount(org);
  }
  return lines;
}

// One week of party life. `context` carries the political climate and the player's standing.
export function advanceOrganization(org, { rand, week, date, pollShare = null, pollDelta = 0, mood = 50, rank = 0, founder = false, support = 50, currents = [], campaignActive = false }) {
  const lines = [];
  const events = [];
  const vitality = org.sections.reduce((sum, item) => sum + item.vitality * item.members, 0) / Math.max(1, org.members);
  const recentCommunication = org.lastCommunicationWeek && week - org.lastCommunicationWeek <= 3 ? 0.003 : 0;
  const rate = clamp(pollDelta * 0.004 + (vitality - 50) / 50 * 0.002 + (org.priorities.territorio - 1) * 0.0015 + (org.cohesion - 55) / 45 * 0.001 + (mood - 50) / 50 * 0.0005 + (rand() - 0.5) * 0.002 + recentCommunication - (org.treasury.balance < 0 ? 0.002 : 0), -0.03, 0.03);
  const before = org.members;
  for (const section of org.sections) {
    section.members = Math.max(5, Math.round(section.members * (1 + rate + (section.vitality - 50) / 50 * 0.001)));
    section.vitality = Math.round(clamp(section.vitality + (50 + (org.priorities.territorio - 1) * 8 - section.vitality) * 0.05 + (rand() - 0.5) * 5 - (org.treasury.balance < 0 ? 1.5 : 0)));
  }
  const closing = org.sections.filter(item => item.vitality < 12 && org.sections.length > 1);
  if (closing.length) {
    const [section] = closing;
    org.sections = org.sections.filter(item => item !== section);
    lines.push(`Chiude la ${section.label.toLowerCase()}: i suoi iscritti si disperdono`);
  }
  recount(org);
  org.growth = before ? round1((org.members - before) / before * 100) : 0;
  const targetMilitants = org.members * (0.07 + org.cohesion / 1500 + org.priorities.formazione * 0.01 + (founder ? 0.12 : 0));
  org.militants = Math.round(org.militants + (targetMilitants - org.militants) * 0.1);
  org.cadres = Math.max(org.cadres, org.sections.length * (founder ? 2 : 4) + (founder ? 3 : 14));

  // Treasury: fees, 2x1000 and elected members in, sections, staff and communication out.
  const income = org.members * MEMBERSHIP_FEE / 52 + Math.max(0, (pollShare ?? 2) - 1) * 650;
  treasuryBook(org, income * 0.8, 'quote');
  treasuryBook(org, income * 0.2, 'duepermille');
  treasuryBook(org, -org.sections.length * SECTION_WEEKLY_COST * (1 + 0.5 * org.priorities.territorio), 'sedi');
  treasuryBook(org, -income * (0.72 + (rand() - 0.5) * 0.06), 'personale');
  for (const priority of PARTY_PRIORITIES) if (priority.id !== 'territorio') treasuryBook(org, -income * priority.costPerLevel * org.priorities[priority.id], priority.id);
  if (campaignActive) treasuryBook(org, -income * 0.5, 'campagne');
  // A party does not hoard: reserves beyond half a year of income turn into staff and initiatives.
  if (org.treasury.balance > income * 26) treasuryBook(org, -(org.treasury.balance - income * 26) * 0.03, 'formazione');
  const period = org.treasury.current;
  org.treasury.history = [...org.treasury.history, { week, income: Math.round(period.income), expense: Math.round(period.expense), balance: org.treasury.balance, source: SIM }].slice(-HISTORY);
  org.treasury.current = blankPeriod();
  const year = date?.slice(0, 4);
  if (year && org.treasury.year && year !== org.treasury.year) {
    const totals = org.treasury.yearTotals;
    org.treasury.annual = [...org.treasury.annual, { year: org.treasury.year, income: Math.round(totals.income), expense: Math.round(totals.expense), net: Math.round(totals.income - totals.expense), byCategory: totals.byCategory, closingBalance: org.treasury.balance, source: SIM }].slice(-10);
    org.treasury.yearTotals = blankPeriod();
  }
  org.treasury.year = year ?? org.treasury.year;
  if (org.treasury.balance < 0) events.push({ type: 'treasury' });

  // Cohesion and conflicts between the internal areas.
  const tension = org.conflicts.reduce((sum, item) => sum + item.intensity, 0);
  const target = 60 - tension * 0.25 + (org.priorities.formazione - 1) * 3 - (org.treasury.balance < 0 ? 10 : 0);
  org.cohesion = Math.round(clamp(org.cohesion + (target - org.cohesion) * 0.08 + (rand() - 0.5) * 2));
  for (const conflict of org.conflicts) conflict.intensity = Math.round(clamp(conflict.intensity - 2.5 + (org.cohesion < 40 ? 3 : 0) + (rand() - 0.5) * 4));
  const resolved = org.conflicts.filter(item => item.intensity <= 5);
  if (resolved.length) lines.push(`Si ricompone lo scontro: ${resolved[0].title.toLowerCase()}`);
  org.conflicts = org.conflicts.filter(item => item.intensity > 5);
  const sorted = [...currents].sort((a, b) => b.strength - a.strength);
  if (sorted.length >= 2 && org.conflicts.length < 2 && rand() < 0.05 + Math.max(0, 60 - org.cohesion) / 500 + (sorted[0].strength - sorted[1].strength < 6 ? 0.03 : 0)) {
    const topics = ['sulle candidature', 'sulla linea economica', 'sulle alleanze', 'sulla gestione della tesoreria', 'sul rapporto con il governo'];
    const conflict = { id: `conflitto-${week}`, title: `${sorted[0].label} contro ${sorted[1].label} ${topics[Math.floor(rand() * topics.length)]}`, currents: [sorted[0].id, sorted[1].id], intensity: Math.round(35 + rand() * 30), since: week, source: SIM };
    org.conflicts.push(conflict);
    lines.push(`Scontro interno: ${conflict.title}`);
  }
  const hot = org.conflicts.find(item => item.intensity >= 70);
  if (hot) events.push({ type: 'conflict', conflict: hot });
  org.discipline = Math.round(clamp(org.discipline + 0.5));

  // Standing: a weak position costs the internal office.
  if (!founder && rank >= 1 && ((support < 30 && rand() < 0.15) || (org.discipline < 30 && rand() < 0.2))) events.push({ type: 'demote', reason: support < 30 ? 'Sostegno interno troppo basso' : 'Troppe prese di distanza dalla linea' });
  if (!founder && currents.length >= 2 && week >= org.congress.nextWeek) {
    org.congress = { ...org.congress, lastWeek: week, nextWeek: week + CONGRESS_CYCLE_WEEKS };
    events.push({ type: 'congress' });
  }
  org.membersHistory = [...(org.membersHistory ?? []), { week, members: org.members }].slice(-HISTORY);
  return { lines, events };
}

export function treasuryOutlook(org) {
  const recent = org.treasury.history.slice(-8);
  const net = recent.length ? Math.round(recent.reduce((sum, item) => sum + item.income - item.expense, 0) / recent.length) : 0;
  const state = org.treasury.balance < 0 ? ['crisi', 'In rosso'] : net < 0 ? ['calo', 'In perdita'] : ['solida', 'In equilibrio'];
  return { net, status: state[0], statusLabel: state[1] };
}
export { ORGANS, PARTY_PRIORITIES, TREASURY_LABELS };
