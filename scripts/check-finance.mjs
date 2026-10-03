// Money as a system with choices and consequences: investments that cost to keep, wear out, return slowly and can fail;
// programmes that build up while they are paid; the cost of a role; the unexpected and the reserve that absorbs it; the
// party's programmes (seats, apps, fundraising, logistics, research, scouting) with upkeep, slow returns and risks that
// reach the committees and the campaigns; a financial crisis that closes seats and thins the staff. Nothing snowballs.
import assert from 'node:assert/strict';
import { createFinance, buyInvestment, depositReserve, financeOutlook, normalizeFinance, releaseReserve, settleFinanceWeek, BUDGET_LINES, INVESTMENTS, RESERVE } from '../src/core/finance-engine.js';
import { FINANCE_CATEGORIES, FINANCE_SHOCKS, ROLE_COST_SHARE } from '../src/data/simulation/finance-rules.js';
import { PARTY_INVESTMENTS } from '../src/data/simulation/career-rules.js';
import { advanceOrganization, createOrganization, treasuryBook } from '../src/core/organization-engine.js';
import { advanceCommittees, committeeSupport } from '../src/core/committee-engine.js';
import { advanceWeek, createGameState, partyInvestment } from '../src/core/career-engine.js';
import { checkInvariants } from '../src/core/invariants.js';

const seeded = seed => { let state = seed >>> 0 || 1; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; };
const START = '2027-01-04';
const addDays = (date, days) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10); };
const makeGame = (funds = 6000) => ({ resources: { funds, politicalCapital: 10 }, week: { index: 1 }, flags: {}, memory: [], finance: createFinance({ week: 1, date: START, funds }) });
const paid = (game, category) => -(game.finance.current.byCategory[category] ?? 0);
let date = START;
const settle = (game, options = {}) => { const week = game.week.index; date = addDays(date, 7); const out = settleFinanceWeek(game, { week, date, incomes: [{ category: 'base', amount: 120, label: 'Sostenitori' }, ...(options.indemnity ? [{ category: 'indennita', amount: options.indemnity, label: 'Indennità' }] : [])], rand: options.rand ?? (() => 0.9999) }); game.week.index += 1; return out; };
const settleReading = (game, options) => { const before = JSON.parse(JSON.stringify(game.finance.current.byCategory)); const out = settle(game, options); return { out, byCategory: game.finance.history.at(-1).byCategory, before }; };

// ---------- 1. the catalogue ----------
{
  assert.ok(BUDGET_LINES.length >= 8 && ['formazione', 'digitale', 'raccolta', 'logistica'].every(id => BUDGET_LINES.some(line => line.id === id)), 'Voci di bilancio: formazione, digitale, raccolta fondi e logistica accanto a staff, comunicazione, territorio e sede.');
  assert.ok(BUDGET_LINES.every(line => line.levels.length >= 2 && line.levels.every(level => Number.isFinite(level.cost) && level.label && level.effect) && FINANCE_CATEGORIES[line.category]), 'Ogni voce ha livelli con costo ed effetto e una categoria contabile.');
  assert.ok(BUDGET_LINES.filter(line => line.ramp).length >= 4, 'I programmi hanno ritorni lenti (rampa) e svaniscono se non vengono finanziati.');
  assert.ok(INVESTMENTS.length >= 9 && INVESTMENTS.filter(item => item.upkeep).length >= 6 && INVESTMENTS.filter(item => item.risk).length >= 2 && INVESTMENTS.filter(item => item.decay).length >= 2 && INVESTMENTS.filter(item => item.requires).length >= 2, 'Investimenti con mantenimento, usura, rischi e potenziamenti.');
  for (const item of INVESTMENTS.filter(entry => entry.requires)) assert.ok(INVESTMENTS.some(base => base.id === item.requires), `${item.id}: il bene da potenziare esiste`);
  assert.ok(PARTY_INVESTMENTS.length >= 10 && PARTY_INVESTMENTS.filter(item => item.upkeep).length >= 8 && PARTY_INVESTMENTS.filter(item => item.risk).length >= 3 && PARTY_INVESTMENTS.filter(item => item.weekly?.income).length >= 2 && PARTY_INVESTMENTS.some(item => item.requires), 'Investimenti del partito: sedi, studi, app, raccolta fondi, logistica e scouting con costi di mantenimento, ritorni lenti e rischi.');
  for (const item of PARTY_INVESTMENTS.filter(entry => entry.requires)) assert.ok(PARTY_INVESTMENTS.some(base => base.id === item.requires), `${item.id}: l’investimento da potenziare esiste`);
  assert.ok(FINANCE_SHOCKS.length >= 3 && FINANCE_SHOCKS.every(item => item.cost[0] > 0 && item.cost[1] >= item.cost[0] && item.chance > 0), 'Imprevisti con probabilità e costi.');
}

// ---------- 2. assets: upgrades, upkeep, wear, effects, risks ----------
{
  const game = makeGame(30000);
  assert.throws(() => buyInvestment(game, 'piattaforma-pro', START), /Serve prima/, 'Un potenziamento richiede il bene di base.');
  buyInvestment(game, 'piattaforma', START);
  buyInvestment(game, 'piattaforma-pro', START);
  buyInvestment(game, 'mezzi', START);
  assert.throws(() => buyInvestment(game, 'mezzi', START), /Hai già/, 'Un bene non si compra due volte.');
  const value0 = game.finance.assets.find(item => item.id === 'mezzi').value;
  const reading = settleReading(game);
  const upkeep = INVESTMENTS.filter(item => ['piattaforma', 'piattaforma-pro', 'mezzi'].includes(item.id)).reduce((sum, item) => sum + item.upkeep, 0);
  assert.equal(-reading.byCategory.manutenzione, upkeep, `Ogni settimana si paga il mantenimento dei beni (${upkeep} €).`);
  assert.ok(game.finance.assets.find(item => item.id === 'mezzi').value < value0, 'I mezzi si usurano.');
  assert.ok((reading.byCategory.donazioni ?? 0) >= 45 && game.finance.perks.volunteers >= 4, 'La piattaforma evoluta rende donazioni e volontari alle campagne.');
  // Risks: a breakdown costs money (and the reserve pays first).
  const unlucky = makeGame(30000);
  buyInvestment(unlucky, 'mezzi', START);
  const cash = unlucky.resources.funds;
  const report = settleReading(unlucky, { rand: () => 0.0001 });
  assert.ok(report.byCategory.imprevisti < 0 && report.out.lines.some(line => /guasto|mezzi/i.test(line)), 'Un guasto ai mezzi costa e finisce nel resoconto.');
  void cash;
  const covered = makeGame(30000);
  buyInvestment(covered, 'mezzi', START);
  depositReserve(covered, 2500, START);
  const funds0 = covered.resources.funds, reserve0 = covered.finance.reserve;
  settle(covered, { rand: () => 0.0001 });
  assert.ok(covered.finance.reserve < reserve0, 'La riserva paga per prima gli imprevisti.');
  assert.ok(covered.resources.funds >= funds0 - 120 - INVESTMENTS.find(item => item.id === 'mezzi').upkeep - 5, 'E la cassa non paga ciò che ha già coperto la riserva.');
  // Time-limited assets expire.
  const limited = makeGame(30000);
  buyInvestment(limited, 'scouting', START);
  assert.ok(limited.finance.assets.some(item => item.id === 'scouting' && item.untilWeek === 53), 'Scouting dei candidati: dura un anno.');
}

// ---------- 3. programmes: they build up while paid and fade when the money stops ----------
{
  const game = makeGame(60000);
  game.finance.budget.raccolta = 1;
  const returns = [];
  for (let week = 0; week < 24; week++) { const reading = settleReading(game); returns.push(reading.byCategory.donazioni ?? 0); }
  assert.ok(returns[0] < returns[12] && returns[12] < returns[20], `Il ritorno è lento: ${returns[0]} → ${returns[12]} → ${returns[20]} € di donazioni a settimana.`);
  assert.ok(returns[0] < BUDGET_LINES.find(line => line.id === 'raccolta').levels[1].cost && returns.at(-1) > BUDGET_LINES.find(line => line.id === 'raccolta').levels[1].cost, 'All’inizio costa più di quanto rende; a regime rende più di quanto costa.');
  const built = game.finance.programs.raccolta.weeks;
  game.finance.budget.raccolta = 0;
  for (let week = 0; week < 6; week++) settle(game);
  assert.ok(game.finance.programs.raccolta.weeks < built - 5, 'Senza fondi il programma perde slancio più in fretta di quanto lo ha costruito.');
  // The cost of a role: representing a higher office costs more.
  const deputy = makeGame(5000), minister = makeGame(5000);
  const low = settleReading(deputy, { indemnity: 900 }), high = settleReading(minister, { indemnity: 1800 });
  assert.equal(-low.byCategory.relazioni, Math.round(900 * ROLE_COST_SHARE), 'La carica ha un costo di rappresentanza.');
  assert.ok(-high.byCategory.relazioni > -low.byCategory.relazioni, 'Più è alta la carica, più costa rappresentarla.');
}

// ---------- 4. the unexpected and the reserve ----------
{
  const game = makeGame(8000);
  settle(game, { rand: () => 0.0001, indemnity: 900 });
  assert.ok(game.finance.history.at(-1).byCategory.imprevisti < 0, 'Un imprevisto può capitare in qualunque settimana.');
  const calm = makeGame(8000);
  settle(calm, { rand: () => 0.9999, indemnity: 900 });
  assert.ok(!calm.finance.history.at(-1).byCategory.imprevisti, 'E quasi sempre non capita.');
  const heavy = makeGame(8000), light = makeGame(8000);
  settle(heavy, { rand: () => 0.0001, indemnity: 1800 }); settle(light, { rand: () => 0.0001, indemnity: 0 });
  assert.ok(-heavy.finance.history.at(-1).byCategory.imprevisti > -light.finance.history.at(-1).byCategory.imprevisti, 'Gli imprevisti pesano di più a chi ha una carica più alta.');
  // The reserve: set aside, capped, taken back, and used on a debt.
  const g = makeGame(5000);
  assert.throws(() => depositReserve(g, RESERVE.cap + 1, START), /Non hai|non può superare/, 'La riserva ha un tetto.');
  depositReserve(g, 1000, START);
  assert.equal(g.resources.funds, 4000, 'Accantonare toglie dalla cassa.');
  assert.equal(releaseReserve(g, 400, START), 600, 'Si può riprendere una parte.');
  g.finance.debt = 500;
  const out = settle(g);
  assert.ok(g.finance.debt < 500 && out.lines.some(line => /riserva copre/i.test(line)), 'La riserva copre il debito prima degli interessi.');
  assert.ok(financeOutlook(g).reserve === g.finance.reserve && financeOutlook(g).netWorth >= g.resources.funds, 'La riserva conta nel patrimonio e nell’autonomia.');
  // Old books (without programmes, reserve or the new lines) keep working.
  const old = makeGame(3000);
  delete old.finance.programs; delete old.finance.perks; delete old.finance.reserve; old.finance.budget = { personale: 1, comunicazione: 0, territorio: 1, sede: 1 };
  old.finance = normalizeFinance(old.finance, { week: 1, date: START, funds: 3000 });
  assert.doesNotThrow(() => { for (let week = 0; week < 6; week++) settle(old); }, 'Un vecchio bilancio continua a funzionare.');
  assert.ok(old.finance.reserve === 0 && 'raccolta' in old.finance.budget, 'E riceve riserva e nuove voci.');
}

// ---------- 5. no snowball: with money there is always something to choose, and everything at once is unaffordable ----------
{
  const income = 120 + 900;
  const everything = BUDGET_LINES.reduce((sum, line) => sum + line.levels.at(-1).cost, 0);
  const assets = INVESTMENTS.reduce((sum, item) => sum + (item.upkeep ?? 0), 0);
  assert.ok(everything + assets > income * 2, `Tutto al massimo costa più del doppio di un’indennità (${everything + assets} € contro ${income}): bisogna scegliere.`);
  const lean = makeGame(20000);
  const rich = makeGame(20000);
  for (const line of BUDGET_LINES) rich.finance.budget[line.id] = line.levels.length - 1;
  for (const item of INVESTMENTS.filter(entry => !entry.repeatable)) { try { buyInvestment(rich, item.id, START); } catch { /* cost or requirement */ } }
  for (let week = 0; week < 40; week++) { settle(lean, { indemnity: 900 }); settle(rich, { indemnity: 900 }); }
  assert.ok(rich.resources.funds < lean.resources.funds, 'Spendere su tutto svuota la cassa: ogni scelta è un compromesso.');
  assert.ok(rich.finance.debt > 0 || rich.resources.funds < 20000, 'Chi investe su tutto senza entrate adeguate va in difficoltà.');
}

// ---------- 6. the party's programmes: upkeep, slow returns, risks and what they give to committees and campaigns ----------
{
  const rand = seeded(5);
  const org = createOrganization({ rand, founder: false, region: 'Toscana', share: 6, week: 1, date: START });
  org.treasury.balance = 80000;
  org.committees = [{ id: 'comitato-regione-Toscana', level: 'regione', name: 'Toscana', region: 'Toscana', status: 'consolidamento', statusSince: 0, foundedWeek: 1, members: 800, activists: 70, organization: 55, consensus: 50, loyalty: 60, leader: { label: 'Coordinamento', currentId: null, player: false }, seat: 1, history: [] }];
  const week0 = org.treasury.balance;
  const context = week => ({ rand, week, date: addDays(START, week * 7), pollShare: 6, pollDelta: 0, mood: 50, rank: 3, founder: false, support: 55, currents: [] });
  org.investments = [{ id: 'raccolta-nazionale', label: 'Struttura di raccolta fondi', week: 1, untilWeek: null }, { id: 'sede-nazionale', label: 'Sede nazionale ampliata', week: 1, untilWeek: null }, { id: 'scuola-politica', label: 'Scuola politica nazionale', week: 1, untilWeek: 53 }];
  advanceOrganization(org, context(2));
  const byCategory = org.treasury.history.at(-1);
  assert.ok(org.perks.quality >= 8 && org.perks.organization >= 1.5 && org.perks.fundraising >= 0.1, 'Gli investimenti del partito danno vantaggi a comitati e raccolta.');
  const early = org.treasury.yearTotals.byCategory.donazioni ?? 0;
  for (let week = 3; week <= 40; week++) advanceOrganization(org, context(week));
  assert.ok((org.treasury.yearTotals.byCategory.sedi ?? 0) < 0 && (org.treasury.yearTotals.byCategory.formazione ?? 0) < 0, 'Il mantenimento pesa sulla tesoreria ogni settimana.');
  assert.ok((org.treasury.yearTotals.byCategory.donazioni ?? 0) > early, 'Il ritorno delle donazioni cresce con le settimane.');
  void week0; void byCategory;
  // A programme can go wrong.
  const risky = createOrganization({ rand: seeded(9), founder: false, region: 'Toscana', share: 6, week: 1, date: START });
  risky.investments = [{ id: 'app-nazionale', label: 'App e sito nazionale', week: 1, untilWeek: null }, { id: 'raccolta-nazionale', label: 'Struttura di raccolta fondi', week: 1, untilWeek: null }];
  const cohesion0 = risky.cohesion;
  const lines = advanceOrganization(risky, { ...context(2), rand: () => 0.0001 }).lines;
  assert.ok(lines.some(line => /incidente|caso su un grande/i.test(line)) && risky.cohesion <= cohesion0, 'Un incidente informatico o un caso sui finanziatori costa soldi e coesione.');
  // The perks reach the committees: a trained, well-housed committee works better than one left to itself.
  const trained = createOrganization({ rand: seeded(3), founder: false, region: 'Toscana', share: 6, week: 1, date: START });
  const plain = createOrganization({ rand: seeded(3), founder: false, region: 'Toscana', share: 6, week: 1, date: START });
  for (const o of [trained, plain]) o.committees = [{ id: 'c1', level: 'provincia', name: 'Pisa', region: 'Toscana', parentId: null, status: 'consolidamento', statusSince: 0, foundedWeek: 1, members: 300, activists: 24, organization: 50, consensus: 50, loyalty: 60, leader: { label: 'Coordinamento', currentId: null, player: false }, seat: 1, history: [] }];
  trained.perks = { quality: 8, organization: 3, activity: 5, recruit: 0.0006, fundraising: 0.1 };
  for (let week = 2; week <= 40; week++) { advanceCommittees(trained, { rand: seeded(week), week, nationalShare: 8, currents: [] }); advanceCommittees(plain, { rand: seeded(week), week, nationalShare: 8, currents: [] }); }
  assert.ok(trained.committees[0].quality > plain.committees[0].quality && trained.committees[0].members > plain.committees[0].members && trained.committees[0].activity > plain.committees[0].activity, 'I programmi del partito migliorano qualità, iscritti e attività dei comitati.');
  // A financial crisis thins the staff.
  const broke = createOrganization({ rand: seeded(4), founder: false, region: 'Toscana', share: 6, week: 1, date: START });
  broke.treasury.balance = -5000;
  const cadres = broke.cadres;
  for (let week = 2; week <= 30; week++) { broke.treasury.balance = -60000; advanceOrganization(broke, { ...context(week), rand: seeded(week) }); }
  assert.ok(broke.cadres < cadres, `Senza soldi i quadri se ne vanno (${cadres} → ${broke.cadres}).`);
}

// ---------- 7. the career: party investments, upgrades, weeks, saves ----------
{
  const stats = { popularity: 48, reputation: 58, notoriety: 35, influence: 48, experience: 42 };
  const env = day => ({ currentDate: day, career: { currentLevel: 'deputato' }, offices: [], player: null, pollShare: 8, pollDelta: 0.2, mood: 52, signals: { stability: 48, crime: 45, spread: 150, euStatus: 'regolare', memoryRecall: null, electionSoon: false, openLawInCommission: false, lawAtVote: false } });
  let game = createGameState({ seedText: 'finanza-partito', currentDate: START, level: 'deputato', party: { id: 'partito-simulato', label: 'Partito simulato', founder: true }, place: { region: 'Lazio', municipality: 'Roma' }, stats });
  game.party.org.treasury.balance = 200000;
  game.resources.politicalCapital = 40;
  let input = { game, stats, parliament: null };
  assert.throws(() => partyInvestment(input, env(START), 'app-nazionale'), /Serve prima/, 'L’app nazionale potenzia la piattaforma: senza non si può.');
  input = partyInvestment(input, env(START), 'piattaforma-iscritti').ctx; input = { game: input.game, stats, parliament: null };
  input = partyInvestment(input, env(START), 'app-nazionale').ctx; input = { game: input.game, stats, parliament: null };
  input = partyInvestment(input, env(START), 'sedi-regionali').ctx; input = { game: input.game, stats, parliament: null };
  assert.ok(input.game.party.org.investments.filter(item => ['piattaforma-iscritti', 'app-nazionale', 'sedi-regionali'].includes(item.id)).length === 3, 'Gli investimenti entrano nell’organizzazione.');
  assert.ok(input.game.party.org.investments.find(item => item.id === 'sedi-regionali').untilWeek === null && input.game.party.org.investments.find(item => item.id === 'piattaforma-iscritti').untilWeek === input.game.week.index + 52, 'Permanenti o a termine secondo il caso.');
  assert.throws(() => partyInvestment(input, env(START), 'sedi-regionali'), /già in corso/, 'Niente doppioni.');
  const before = input.game.party.org.treasury.balance;
  let day = START;
  for (let week = 0; week < 12; week++) { day = addDays(day, 7); input = advanceWeek(input, env(day), parliament => parliament).ctx; input = { game: input.game, stats: input.stats, parliament: null }; }
  assert.ok((input.game.party.org.treasury.yearTotals.byCategory.sedi ?? 0) < 0 && input.game.party.org.perks, 'Passano le settimane: il mantenimento si paga e i vantaggi sono attivi.');
  assert.ok(Number.isFinite(input.game.party.org.treasury.balance) && input.game.party.org.treasury.balance < before + 40000, 'La tesoreria non cresce senza limiti.');
  const report = checkInvariants({ game: input.game, clock: { currentDate: day }, career: {}, dataset: {}, world: null, parliament: null }, {});
  assert.ok(report.issues.filter(item => /Comitato|riserva|Programma/.test(item.message)).length === 0, 'Misure di comitati e finanze nei limiti.');
}

console.log('Finanze verificate: ' + `${BUDGET_LINES.length} voci di bilancio (programmi con ritorni lenti che svaniscono senza fondi), ${INVESTMENTS.length} investimenti personali con mantenimento, usura, potenziamenti e rischi, ${PARTY_INVESTMENTS.length} investimenti del partito (sedi, app, raccolta fondi, logistica, ricerca, scouting) con costi ricorrenti, ritorni e incidenti, costo della carica, imprevisti e riserva di emergenza, crisi finanziaria che riduce quadri e sedi, vantaggi che arrivano a comitati e campagne, vecchi bilanci e nessun accumulo senza limiti.`);
