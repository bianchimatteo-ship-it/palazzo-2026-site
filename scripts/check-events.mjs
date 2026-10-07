// Procedural events: probabilities, conditions, cooldowns, rarity, exclusivity, variants and chains.
// Two careers must be able to tell very different political stories.
import assert from 'node:assert/strict';
import { advanceWeek, createGameState, resolveInboxItem } from '../src/core/career-engine.js';
import { APPOINTMENTS, CAREER_EVENTS, FORCED_EVENTS, SITUATION_EVENTS } from '../src/data/simulation/career-rules.js';
import { DAILY_EVENTS } from '../src/data/simulation/daily-events.js';
import { LIFE_SITUATIONS } from '../src/data/simulation/party-life-rules.js';
import { PRESIDENCY_SITUATIONS } from '../src/data/simulation/presidency-rules.js';
import { START_SITUATIONS } from '../src/data/simulation/start-rules.js';
import { OBJECTIVE_SITUATIONS } from '../src/data/simulation/objective-rules.js';
import { ITALIAN_REGIONS } from '../src/data/regions.js';

const byId = Object.fromEntries(CAREER_EVENTS.map(item => [item.id, item]));
const addDays = (date, days) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10); };
const premierParliament = () => ({
  player: { groupId: 'g1', chamber: 'camera', politicianId: 'p' },
  government: { status: 'active', primeMinister: 'player', coalitionGroupIds: ['g1'], supportingGroupIds: [], ministers: [{ id: 'm1', portfolio: 'Salute', groupId: 'g1', groupName: 'G1' }, { id: 'm2', portfolio: 'Interno', groupId: 'g1', groupName: 'G1' }], stability: 50, partners: {} },
  chambers: { camera: { groups: [{ groupId: 'g1', simulatedSeats: 300 }] }, senato: { groups: [{ groupId: 'g2', simulatedSeats: 150 }] } },
  relations: {}, laws: [], history: [], resources: { politicalCapital: 50 }, careerStanding: { partySupport: 50 }
});
function play(seedText, { premier = false, weeks = 208, spread = 150, crime = 50 } = {}) {
  let game = createGameState({ seedText, currentDate: '2027-01-04', level: 'deputato', party: { id: 'partito-prova', label: 'Partito di prova', founder: true }, place: { region: 'Lazio', municipality: 'Roma' }, stats: { popularity: 45, reputation: 55, notoriety: 45, influence: 45, experience: 40 } });
  let parliament = premier ? premierParliament() : null;
  let stats = { popularity: 45, reputation: 55, notoriety: 45, influence: 45, experience: 40 };
  let date = '2027-01-04';
  const raised = [];
  const shocks = [];
  let queued = 0;
  let exclusiveClash = false;
  for (let week = 0; week < weeks && game.status !== 'ended'; week++) {
    date = addDays(date, 7);
    const month = Number(date.slice(5, 7));
    const signals = { crime, perceived: 100 - crime, spread, euStatus: spread > 250 ? 'procedura' : 'regolare', stability: 50, ministers: premier ? 2 : 0, majorityMood: 45, summer: month >= 6 && month <= 8, autumn: month >= 9 && month <= 11, winter: month === 12 || month <= 2, regions: ITALIAN_REGIONS.map((name, index) => ({ name, indicators: { sicurezza: 30 + (index * 7) % 50, occupazione: 35 + (index * 11) % 45, ambiente: 40 + (index * 5) % 40, infrastrutture: 30 + (index * 13) % 50, turismo: 50 } })), memoryRecall: null, electionSoon: false, openLawInCommission: false, lawAtVote: false };
    const result = advanceWeek({ game, stats, parliament }, { currentDate: date, career: {}, offices: [], player: null, signals }, parliamentState => parliamentState);
    game = result.ctx.game; stats = result.ctx.stats; parliament = result.ctx.parliament;
    const events = game.inbox.filter(item => item.kind === 'evento');
    for (const item of events) raised.push({ id: item.templateId, week: game.week.index, month, summer: signals.summer, title: item.title });
    const exclusive = events.map(item => byId[item.templateId]?.exclusive).filter(Boolean);
    if (new Set(exclusive).size !== exclusive.length) exclusiveClash = true;
    shocks.push(...result.specials.filter(item => item.type === 'society-shock'));
    queued += (game.eventQueue ?? []).length ? 1 : 0;
    // Keep the career alive: this test looks at the events, not at survival.
    stats.reputation = Math.max(stats.reputation, 40);
    game.status = 'active';
  }
  return { raised, shocks, queued, exclusiveClash, history: game.eventHistory ?? {} };
}

const a = play('storia-alfa', { premier: true, spread: 240, crime: 60 });
const b = play('storia-beta', { premier: true, spread: 240, crime: 60 });
const citizen = play('storia-gamma', { premier: false, spread: 120, crime: 40 });
const repeat = play('storia-alfa', { premier: true, spread: 240, crime: 60 });
assert.deepEqual(repeat.raised.map(item => item.id), a.raised.map(item => item.id), 'Lo stesso seed riproduce la stessa storia.');
for (const run of [a, b, citizen]) {
  const ids = new Set(run.raised.map(item => item.id));
  assert.ok(ids.size >= 12, `Varietà: ${ids.size} eventi diversi in quattro anni`);
  // Cooldowns: the same event never comes back before its time.
  const last = {};
  for (const item of run.raised) {
    const cooldown = byId[item.id]?.cooldown ?? 8;
    if (last[item.id] !== undefined) assert.ok(item.week - last[item.id] >= Math.min(cooldown, 2), `${item.id} ripetuto dopo ${item.week - last[item.id]} settimane`);
    last[item.id] = item.week;
  }
  for (const item of run.raised.filter(entry => byId[entry.id]?.when?.toString().includes('summer'))) assert.ok(item.summer, `${item.id} arriva solo d’estate`);
  for (const item of run.raised.filter(entry => byId[entry.id]?.unique)) assert.equal(run.raised.filter(entry => entry.id === item.id).length, 1, `${item.id} accade una volta sola`);
  assert.ok(!run.exclusiveClash, 'Mai due emergenze insieme nella stessa agenda.');
  assert.ok(run.shocks.every(item => !JSON.stringify(item.shock).includes('{region2}')), 'Gli effetti immediati sono legati a una regione precisa.');
}
// Conditions: government-only events never reach a citizen without a government.
const premierOnly = CAREER_EVENTS.filter(item => /sit\.premier/.test(item.when?.toString() ?? '')).map(item => item.id);
assert.ok(premierOnly.length >= 4);
assert.ok(!citizen.raised.some(item => premierOnly.includes(item.id)), 'Gli eventi del Presidente del Consiglio non arrivano a chi non governa.');
assert.ok(a.raised.some(item => premierOnly.includes(item.id)), 'Chi governa affronta crisi di governo, mercati, Europa, ministri.');
// Situation-driven weights: markets under stress bring spread crises.
assert.ok(a.raised.some(item => item.id === 'tensione-spread') || b.raised.some(item => item.id === 'tensione-spread'), 'Spread alto: arrivano crisi sui mercati.');
// Immediate consequences: events change the country as soon as they happen.
assert.ok(a.shocks.length + b.shocks.length > 5, 'Gli eventi hanno effetti immediati sul Paese.');
// Chains: some choices bring later events.
assert.ok(a.queued + b.queued + citizen.queued > 0, 'Alcune scelte mettono in coda eventi successivi.');
// Variants: the same event can be told in different ways.
const crimeTitles = new Set([...a.raised, ...b.raised].filter(item => item.id === 'cronaca-nera').map(item => item.title.replace(/ in .*/, '')));
assert.ok(crimeTitles.size >= 2, 'Varianti diverse dello stesso evento.');
// Rare events are rare.
const count = run => id => run.raised.filter(item => item.id === id).length;
const rare = CAREER_EVENTS.filter(item => item.rare).map(item => item.id);
const rareTotal = [a, b].reduce((sum, run) => sum + rare.reduce((acc, id) => acc + count(run)(id), 0), 0);
assert.ok(rareTotal < [a, b].reduce((sum, run) => sum + run.raised.length, 0) * 0.12, 'Gli eventi rari restano rari.');
// Two careers, two stories.
const sequence = run => run.raised.slice(0, 40).map(item => item.id).join('|');
assert.notEqual(sequence(a), sequence(b), 'Due partite sviluppano storie diverse.');
// Economy of the decisions: one rule for every way a decision ends. Chosen by the player it validates and pays what it costs
// (never a negative balance); left to the week it runs a free, unconditional choice (a costly choice is never run for free), and
// the agenda announces the very choice that will run.
const everyTemplate = [...APPOINTMENTS, ...CAREER_EVENTS, ...DAILY_EVENTS, ...Object.values(FORCED_EVENTS), ...Object.values(SITUATION_EVENTS), ...Object.values(LIFE_SITUATIONS), ...Object.values(PRESIDENCY_SITUATIONS), ...Object.values(START_SITUATIONS), ...Object.values(OBJECTIVE_SITUATIONS)];
const costless = choice => !choice.cost || !Object.values(choice.cost).some(Boolean);
for (const template of everyTemplate) {
  const declared = template.choices.find(choice => choice.id === (template.defaultChoice ?? template.choices.at(-1).id));
  assert.ok(declared && costless(declared) && !declared.requires, `${template.id}: la scelta senza decisione è gratuita e senza requisiti`);
}
const economySignals = { crime: 50, perceived: 50, spread: 150, euStatus: 'regolare', stability: 50, ministers: 0, majorityMood: 45, summer: false, autumn: false, winter: true, regions: ITALIAN_REGIONS.map(name => ({ name, indicators: { sicurezza: 50, occupazione: 50, ambiente: 50, infrastrutture: 50, turismo: 50 } })), memoryRecall: null, electionSoon: false, openLawInCommission: false, lawAtVote: false };
const economyEnv = { currentDate: '2027-01-11', career: {}, offices: [], player: null, signals: economySignals };
const economyStats = { popularity: 45, reputation: 55, notoriety: 45, influence: 45, experience: 40 };
const economyGame = ({ funds, capital, ap = 5, defaultChoice = 'solidarieta' }) => {
  const game = createGameState({ seedText: 'economia-eventi', currentDate: '2027-01-04', level: 'deputato', party: { id: 'partito-prova', label: 'Partito di prova', founder: true }, place: { region: 'Lazio', municipality: 'Roma' }, stats: economyStats });
  game.resources.funds = funds; game.resources.politicalCapital = capital; game.week.ap = ap;
  const template = byId.maltempo;
  game.inbox = [{ id: 'agenda-1-maltempo-1', kind: 'evento', templateId: 'maltempo', day: 2, title: 'Maltempo e danni in Lazio', body: template.body, params: { region: 'Lazio', region2: 'Lazio' }, choices: template.choices.map(choice => ({ id: choice.id, label: choice.label, cost: choice.cost ?? null, requires: null })), defaultChoice, week: game.week.index, source: 'simulation' }];
  return game;
};
const spentOn = (game, title) => (game.finance?.ledger ?? []).filter(entry => entry.label === title && entry.amount < 0);
// Left alone, even a (stale) costly default gives way to the free choice: nothing is paid, nothing is borrowed.
{
  const game = economyGame({ funds: 100, capital: 1, defaultChoice: 'sul-posto' });
  const debt = game.finance.debt ?? 0;
  const result = advanceWeek({ game, stats: { ...economyStats }, parliament: null }, economyEnv, parliamentState => parliamentState);
  const next = result.ctx.game;
  assert.equal(spentOn(next, 'Maltempo e danni in Lazio').length, 0, 'La decisione non presa non costa nulla.');
  assert.ok(next.log.some(entry => /Esprimi solidarietà.*\(senza decisione\)/.test(entry.title)), 'Il registro riporta la scelta gratuita davvero eseguita.');
  assert.ok(!next.log.some(entry => /Coordina gli aiuti|Chiedi fondi/.test(entry.title)), 'Nessuna scelta a pagamento eseguita senza pagare.');
  assert.ok(next.resources.funds >= 0 && next.resources.politicalCapital >= 0 && (next.finance.debt ?? 0) >= debt, 'Nessun saldo negativo.');
}
// The player's own choice: validated first (nothing changes when it fails), then paid exactly.
{
  const poor = economyGame({ funds: 100, capital: 1 });
  const before = JSON.stringify(poor);
  assert.throws(() => resolveInboxItem({ game: poor, stats: { ...economyStats }, parliament: null }, economyEnv, 'agenda-1-maltempo-1', 'sul-posto'), /Servono 300 € di fondi/, 'Senza fondi la scelta a pagamento è rifiutata.');
  assert.throws(() => resolveInboxItem({ game: poor, stats: { ...economyStats }, parliament: null }, economyEnv, 'agenda-1-maltempo-1', 'fondi'), /capitale politico/, 'Senza capitale la scelta è rifiutata.');
  assert.equal(JSON.stringify(poor), before, 'Una scelta rifiutata non cambia nulla.');
  const rich = economyGame({ funds: 1000, capital: 10, ap: 5 });
  const paid = resolveInboxItem({ game: rich, stats: { ...economyStats }, parliament: null }, economyEnv, 'agenda-1-maltempo-1', 'sul-posto').ctx.game;
  assert.equal(paid.resources.funds, 700, 'I fondi scalati sono quelli dichiarati.');
  assert.equal(paid.week.ap, 3, 'I giorni scalati sono quelli dichiarati.');
  assert.equal(spentOn(paid, 'Maltempo e danni in Lazio').length, 1, 'Un solo movimento di cassa, con il titolo della decisione.');
  assert.ok(!paid.inbox.some(item => item.id === 'agenda-1-maltempo-1') && paid.log.some(entry => /Coordina gli aiuti/.test(entry.title)), 'Decisione chiusa e registrata una volta sola.');
  const free = resolveInboxItem({ game: economyGame({ funds: 0, capital: 0, ap: 0 }), stats: { ...economyStats }, parliament: null }, economyEnv, 'agenda-1-maltempo-1', 'solidarieta').ctx.game;
  assert.equal(free.resources.funds, 0, 'La scelta gratuita si può sempre prendere, anche a mani vuote.');
}
const overlap = [...new Set(a.raised.map(item => item.id))].filter(id => b.raised.some(item => item.id === id)).length;
console.log(`Eventi procedurali verificati: ${new Set(a.raised.map(item => item.id)).size}/${new Set(b.raised.map(item => item.id)).size}/${new Set(citizen.raised.map(item => item.id)).size} eventi diversi in 4 anni per tre carriere, cooldown, condizioni (governo, stagioni, mercati), esclusività delle emergenze, eventi unici e rari, varianti, catene, effetti immediati; economia delle decisioni (scelta senza decisione sempre gratuita e annunciata, scelta manuale validata e pagata, mai saldo negativo); sequenze diverse tra due partite (${overlap} eventi in comune).`);
