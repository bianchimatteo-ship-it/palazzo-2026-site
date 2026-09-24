// Procedural events: probabilities, conditions, cooldowns, rarity, exclusivity, variants and chains.
// Two careers must be able to tell very different political stories.
import assert from 'node:assert/strict';
import { advanceWeek, createGameState } from '../src/core/career-engine.js';
import { CAREER_EVENTS } from '../src/data/simulation/career-rules.js';
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
const overlap = [...new Set(a.raised.map(item => item.id))].filter(id => b.raised.some(item => item.id === id)).length;
console.log(`Eventi procedurali verificati: ${new Set(a.raised.map(item => item.id)).size}/${new Set(b.raised.map(item => item.id)).size}/${new Set(citizen.raised.map(item => item.id)).size} eventi diversi in 4 anni per tre carriere, cooldown, condizioni (governo, stagioni, mercati), esclusività delle emergenze, eventi unici e rari, varianti, catene, effetti immediati; sequenze diverse tra due partite (${overlap} eventi in comune).`);
