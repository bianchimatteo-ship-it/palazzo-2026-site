// What a start is made of before the levers: the level (a council, a province, a region, the Chambers, Strasbourg) and the way of
// belonging (independent, member, founder). scenarioOf merges the two into one description (resources, relations, reputations,
// sectors, party, growth, expectations); scenarioInit writes it into the first week of the game; scenarioGrowth and
// scenarioCapitalGain are what goes on working afterwards (how fast the stats grow, how much capital comes each week). Pure and
// deterministic: no draws.
import { AFFILIATION_SCENARIOS, GROWTH_STATS, LEVEL_SCENARIOS, SCENARIO_VERSION } from '../data/simulation/scenario-rules.js?v=20261007-2';
import { REPUTATIONS, SECTORS } from '../data/simulation/standing-rules.js?v=20261007-2';
import { PARTY_RANKS, RELATION_TEMPLATES, STAT_LABELS } from '../data/simulation/career-rules.js?v=20261007-2';
import { createStanding } from './standing-engine.js?v=20261007-2';

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round2 = value => Math.round(value * 100) / 100;
const sum = (left = {}, right = {}) => { const out = { ...left }; for (const [key, value] of Object.entries(right)) out[key] = round2((out[key] ?? 0) + value); return out; };
const product = (left = {}, right = {}) => { const out = { ...left }; for (const [key, value] of Object.entries(right)) out[key] = round2((out[key] ?? 1) * value); return out; };
const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${String(Math.abs(round2(value))).replace('.', ',')}`;
const times = value => `×${String(round2(value)).replace('.', ',')}`;

// The way of belonging of a party record of the wizard or of the game (none: independent).
export const affiliationOf = party => !party?.id ? 'independent' : party.founder ? 'founder' : 'member';
export const SCENARIO_LEVELS = Object.freeze(Object.keys(LEVEL_SCENARIOS));
export const SCENARIO_AFFILIATIONS = Object.freeze(Object.keys(AFFILIATION_SCENARIOS));

// The scenario of a level and a way of belonging, as one description.
export function scenarioOf({ level = 'comunale', affiliation = 'independent' } = {}) {
  const lv = LEVEL_SCENARIOS[level] ?? LEVEL_SCENARIOS.comunale;
  const af = AFFILIATION_SCENARIOS[affiliation] ?? AFFILIATION_SCENARIOS.independent;
  return {
    version: SCENARIO_VERSION, level: LEVEL_SCENARIOS[level] ? level : 'comunale', affiliation: AFFILIATION_SCENARIOS[affiliation] ? affiliation : 'independent',
    label: `${lv.label} · ${af.label}`, stage: lv.stage,
    summary: [lv.summary, af.summary], expectation: [lv.expectation, af.expectation], pressure: [lv.pressure, af.pressure],
    fundsFactor: round2(lv.fundsFactor * af.fundsFactor), capital: lv.capital + af.capital, capitalGain: lv.capitalGain + af.capitalGain,
    relations: sum(lv.relations, af.relations), standing: sum(lv.standing, af.standing), sectors: sum(lv.sectors, af.sectors),
    growth: product(lv.growth, af.growth),
    // The party counts only for a member (a founder has the own party, an independent none).
    party: af === AFFILIATION_SCENARIOS.member ? { ...lv.party } : null
  };
}

// Writes the scenario into a game just created (week 1): capital, relations, reputations, sectors, the standing in the party and
// the vitality of the own section; keeps what keeps working afterwards (growth, weekly capital, expectations) in game.scenario.
export function scenarioInit(game, scenario, api) {
  game.resources.politicalCapital = clamp(game.resources.politicalCapital + scenario.capital);
  for (const [relation, delta] of Object.entries(scenario.relations)) api.changeRelation(game, relation, delta);
  game.standing = createStanding({ week: 1, rep: scenario.standing, sectors: scenario.sectors });
  const party = game.party;
  if (party?.affiliation === 'member' && scenario.party) {
    party.support = clamp(round2(party.support + scenario.party.support));
    if (scenario.party.rank > party.rank) {
      party.rank = scenario.party.rank; party.rankTitle = PARTY_RANKS[scenario.party.rank].title;
      party.history.push({ week: game.week.index, date: game.week.startedAt, text: `Parte da ${party.rankTitle.toLowerCase()}: il seggio da ${scenario.label.split(' · ')[0].toLowerCase()} pesa nel partito`, source: 'simulation' });
    }
    const home = party.org?.sections?.find(item => item.region === game.place?.region);
    if (home && scenario.party.vitality) home.vitality = Math.round(clamp(home.vitality + scenario.party.vitality));
  }
  game.scenario = {
    version: scenario.version, level: scenario.level, affiliation: scenario.affiliation, label: scenario.label, since: game.week.index,
    growth: { ...scenario.growth }, capitalGain: scenario.capitalGain, fundsFactor: scenario.fundsFactor, expectation: [...scenario.expectation], pressure: [...scenario.pressure], source: 'simulation'
  };
  return game.scenario;
}

// What goes on working: the pace of a stat's growth (positive changes are multiplied) and the weekly capital.
export const scenarioGrowth = (game, stat) => GROWTH_STATS.includes(stat) ? game?.scenario?.growth?.[stat] ?? 1 : 1;
export const scenarioCapitalGain = game => game?.scenario?.capitalGain ?? 0;

// The lines the wizard and the Career page show (generated from the numbers: the text is the rule).
export function scenarioLines(scenario) {
  const relationLabel = id => RELATION_TEMPLATES.find(item => item.id === id)?.label ?? id;
  const lines = [];
  const add = (id, label, items, tone = 'neutral') => { if (items.length) lines.push({ id, label, items, tone }); };
  add('resources', 'Risorse', [
    scenario.fundsFactor !== 1 ? `Fondi di partenza ${times(scenario.fundsFactor)}` : null,
    scenario.capital ? `Capitale politico ${signed(scenario.capital)}` : null,
    scenario.capitalGain ? `Capitale politico ogni settimana ${signed(scenario.capitalGain)}` : null
  ].filter(Boolean), scenario.fundsFactor >= 1 && scenario.capital >= 0 ? 'good' : 'neutral');
  add('relations', 'Relazioni', Object.entries(scenario.relations).filter(([, value]) => value).map(([id, value]) => `${relationLabel(id)} ${signed(value)}`));
  add('standing', 'Reputazione', Object.entries(scenario.standing).filter(([, value]) => value).map(([id, value]) => `${REPUTATIONS[id]?.label ?? id} ${signed(value)}`));
  add('sectors', 'Influenza di settore', Object.entries(scenario.sectors).filter(([, value]) => value).map(([id, value]) => `${SECTORS.find(item => item.id === id)?.label ?? id} ${signed(value)}`));
  add('party', 'Nel partito', scenario.party ? [
    scenario.party.rank ? `Parti da ${PARTY_RANKS[scenario.party.rank].title.toLowerCase()}` : null, scenario.party.support ? `Sostegno nel partito ${signed(scenario.party.support)}` : null,
    scenario.party.vitality ? `Sezione del tuo territorio ${scenario.party.vitality > 0 ? 'più viva' : 'meno viva'} (${signed(scenario.party.vitality)})` : null
  ].filter(Boolean) : []);
  add('growth', 'Crescita', Object.entries(scenario.growth).filter(([, value]) => value !== 1).map(([stat, value]) => `${STAT_LABELS[stat] ?? stat} ${value > 1 ? 'cresce più in fretta' : 'cresce più piano'} (${times(value)})`));
  return lines;
}
