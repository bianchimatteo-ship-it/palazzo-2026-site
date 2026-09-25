// Career progression is never automatic: a promotion weighs consensus, reputation, experience, influence, results,
// internal relations, the state of the party, the territory, resources and the political moment. Crossing a
// threshold makes it likely, never certain; the same attempt can end in a promotion, a lower office than hoped,
// a postponement, an internal defeat or even a demotion.
import { committeeStrength } from './committee-engine.js?v=20260925-9';

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;

export const ADVANCEMENT_OUTCOMES = Object.freeze({
  promosso: { label: 'Promozione ottenuta', tone: 'good' },
  'incarico-inferiore': { label: 'Un incarico minore di quello sperato', tone: 'neutral' },
  stallo: { label: 'Decisione rinviata', tone: 'neutral' },
  'sconfitta-interna': { label: 'Sconfitta interna: passa un altro nome', tone: 'bad' },
  retrocessione: { label: 'Retrocessione', tone: 'bad' }
});

// The weights of each kind of promotion (they sum to 1): what counts in the party is not what counts in Parliament.
export const PROGRESSION_WEIGHTS = Object.freeze({
  partito: [['support', 'Sostegno nel partito', .24], ['leadership', 'Rapporto con la leadership', .15], ['current', 'Peso della tua area interna', .12], ['influence', 'Influenza', .12], ['reputation', 'Reputazione', .08], ['experience', 'Esperienza', .06], ['results', 'Risultati elettorali recenti', .09], ['territory', 'Radicamento sul territorio', .07], ['party', 'Salute del partito', .07]],
  parlamento: [['influence', 'Influenza', .26], ['reputation', 'Reputazione', .2], ['experience', 'Esperienza', .18], ['group', 'Sostegno nel gruppo', .2], ['seniority', 'Anzianità di mandato', .08], ['results', 'Risultati elettorali recenti', .08]]
});

// The factors of a player, from the career state (all 0–100; 50 is neutral).
export function progressionFactors({ game = null, stats = {}, parliament = null, week = null } = {}) {
  const party = game?.party ?? null;
  const relation = id => (game?.relations ?? []).find(item => item.id === id)?.value ?? 50;
  const aligned = party?.currents?.find(item => item.id === party.alignedCurrentId) ?? null;
  const now = week ?? game?.week?.index ?? 0;
  // Elections of the last two years: victories help, defeats weigh.
  const recent = (game?.memory ?? []).filter(item => now - (item.week ?? 0) <= 104);
  const wins = recent.filter(item => item.kind === 'vittoria-elettorale').length;
  const losses = recent.filter(item => item.kind === 'sconfitta-elettorale').length;
  const home = party?.org?.sections?.find(item => item.region === game?.place?.region) ?? null;
  // The committees of the player's own territory, when the party has them: the comune first, then the region.
  const homeCommittees = (party?.org?.committees ?? []).filter(item => item.region === game?.place?.region && item.status !== 'dissoluzione' && ['comune', 'provincia'].includes(item.level));
  const rooted = homeCommittees.length ? homeCommittees.reduce((sum, item) => sum + committeeStrength(item), 0) / homeCommittees.length : null;
  const cohesion = party?.org?.cohesion ?? 55;
  const trend = party?.org?.growth ?? 0;
  const mandateWeeks = parliament?.player?.mandateStartedAt && game?.week?.startedAt ? Math.max(0, Math.round((Date.parse(`${game.week.startedAt}T12:00:00`) - Date.parse(`${parliament.player.mandateStartedAt}T12:00:00`)) / 604800000)) : 0;
  return {
    support: clamp(party?.support ?? 50),
    leadership: clamp(relation('leadership')),
    current: clamp(aligned ? aligned.strength * 1.3 + (aligned.id === party?.leaderCurrentId ? 18 : 0) : 30),
    influence: clamp(stats.influence ?? 40),
    reputation: clamp(stats.reputation ?? 50),
    experience: clamp(stats.experience ?? 30),
    results: clamp(50 + wins * 15 - losses * 12),
    territory: clamp((stats.popularity ?? 45) * .6 + (rooted ?? home?.vitality ?? 40) * .4),
    party: clamp(cohesion * .7 + 15 + trend * 60),
    group: clamp(parliament?.careerStanding?.partySupport ?? 50),
    seniority: clamp(30 + mandateWeeks * 1.2)
  };
}

// The moment: a party in crisis or a congress around the corner change the odds (in points of score).
function momentBonus(kind, { game = null, capital = 0 } = {}) {
  const org = game?.party?.org;
  const bits = [];
  if (kind === 'partito' && org) {
    const toCongress = (org.congress?.nextWeek ?? 999) - (game.week?.index ?? 0);
    if (!org.founder && toCongress >= 0 && toCongress <= 4) bits.push(['Congresso alle porte: gli organi sono congelati', -4]);
    if ((org.cohesion ?? 55) < 40) bits.push(['Partito diviso: ogni nomina diventa uno scontro', -3]);
    if ((org.conflicts ?? []).some(item => item.intensity >= 70)) bits.push(['Scontro aperto tra le aree', -2]);
  }
  if (capital >= 25) bits.push(['Capitale politico da spendere', 2]);
  else if (capital < 6) bits.push(['Poco capitale politico', -2]);
  return bits;
}

// Score, odds and factor-by-factor explanation of a promotion attempt, without drawing anything (for the interface).
export function advancementOdds(kind, { factors, threshold, bonus = 0, game = null, capital = 0 }) {
  const weights = PROGRESSION_WEIGHTS[kind] ?? PROGRESSION_WEIGHTS.partito;
  const rows = weights.map(([id, label, weight]) => ({ id, label, weight, value: round1(factors[id] ?? 50), contribution: round2((factors[id] ?? 50) * weight) }));
  const moment = momentBonus(kind, { game, capital });
  const score = round1(rows.reduce((sum, row) => sum + row.contribution, 0) + moment.reduce((sum, [, value]) => sum + value, 0) + bonus);
  // A logistic curve: well above the bar the promotion is likely, never certain; well below it is a long shot.
  const chance = round2(clamp(1 / (1 + Math.exp(-(score - threshold) / 6)), .04, .86));
  return { score, threshold, chance, factors: rows, moment: moment.map(([label, value]) => ({ label, value })), bonus };
}

// The attempt itself: `roll` and `roll2` are draws in [0,1) from the career's own sequence.
export function evaluateAdvancement(kind, { factors, threshold, bonus = 0, game = null, capital = 0, rank = 0, hostile = false, roll = Math.random(), roll2 = Math.random() }) {
  const odds = advancementOdds(kind, { factors, threshold, bonus, game, capital });
  let outcome;
  if (roll < odds.chance) outcome = roll > odds.chance * .85 ? 'incarico-inferiore' : 'promosso';
  else {
    const gap = odds.score - threshold;
    if (gap < -10 && rank >= 1 && roll2 < .35) outcome = 'retrocessione';
    else if (hostile && roll2 < .55) outcome = 'sconfitta-interna';
    else outcome = 'stallo';
  }
  return { ...odds, outcome, label: ADVANCEMENT_OUTCOMES[outcome].label, tone: ADVANCEMENT_OUTCOMES[outcome].tone };
}
