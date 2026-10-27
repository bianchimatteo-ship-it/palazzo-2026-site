import { SUPPORTERS, TRANSFERS, TREASURY_OPERATIONS, TREASURY_OPERATIONS_KEPT } from '../data/simulation/finance-rules.js?v=20261027-3';
import { treasuryBook } from './organization-engine.js?v=20261027-3';
import { BUDGET_LINES, DEBT_CRISIS_THRESHOLD, DEBT_WEEKLY_INTEREST, ELECTION_FUND_MATCH, FINANCE_CATEGORIES, FINANCE_SHOCKS, HISTORY_WEEKS, INVESTMENTS, LEDGER_SIZE, RESERVE, RESERVE_BEFORE_REPAYING, ROLE_COST_SHARE } from '../data/simulation/finance-rules.js?v=20261027-3';

const SIM = 'simulation';
const blankPeriod = () => ({ income: 0, expense: 0, byCategory: {} });

export function createFinance({ week = 1, date = null, funds = 0 } = {}) {
  return {
    version: 1, source: SIM, budget: { personale: 0, comunicazione: 0, territorio: 0, sede: 0, formazione: 0, digitale: 0, raccolta: 0, logistica: 0 }, debt: 0, assets: [], electionFund: 0, reserve: 0, programs: {}, perks: {},
    ledger: [], operations: [], current: { week, ...blankPeriod() }, history: [], year: date ? date.slice(0, 4) : null, yearTotals: blankPeriod(), annual: [], openingFunds: funds
  };
}
export function normalizeFinance(finance, { week = 1, date = null, funds = 0 } = {}) {
  if (!finance || typeof finance !== 'object') return createFinance({ week, date, funds });
  const base = createFinance({ week, date, funds });
  return { ...base, ...finance, budget: { ...base.budget, ...(finance.budget ?? {}) }, programs: { ...(finance.programs ?? {}) }, perks: { ...(finance.perks ?? {}) }, reserve: finance.reserve ?? 0, current: { ...base.current, ...(finance.current ?? {}) }, yearTotals: { ...base.yearTotals, ...(finance.yearTotals ?? {}) } };
}
function tally(period, amount, category) {
  // Moving money into the election fund is not spending: it stays out of income and expenses.
  if (FINANCE_CATEGORIES[category]?.kind !== 'movimento') { if (amount >= 0) period.income += amount; else period.expense -= amount; }
  period.byCategory[category] = (period.byCategory[category] ?? 0) + amount;
}

// Every movement of the player's funds goes through here: balance and books stay in step.
// A payment larger than the balance becomes debt instead of a negative balance.
export function book(game, amount, category = 'altro', label = null, date = null) {
  const value = Math.round(amount);
  if (!value) return 0;
  game.finance ??= createFinance({ week: game.week?.index ?? 1, date, funds: game.resources.funds });
  const finance = game.finance;
  let balance = game.resources.funds + value;
  if (balance < 0) { finance.debt = Math.round(finance.debt - balance); balance = 0; }
  game.resources.funds = balance;
  const key = FINANCE_CATEGORIES[category] ? category : 'altro';
  tally(finance.current, value, key);
  tally(finance.yearTotals, value, key);
  finance.ledger = [{ week: game.week?.index ?? null, date, category: key, amount: value, label: label ?? FINANCE_CATEGORIES[key].label, balance, source: SIM }, ...finance.ledger].slice(0, LEDGER_SIZE);
  return value;
}

const owns = (finance, id, week = null) => (finance?.assets ?? []).some(asset => asset.id === id && (!asset.untilWeek || week === null || week <= asset.untilWeek));
function lineCost(line, level, finance) {
  const cost = line.levels[level]?.cost ?? 0;
  return line.id === 'sede' && cost && owns(finance, 'sede-propria') ? 60 : cost;
}
export function budgetCost(budget = {}, finance = null) {
  return BUDGET_LINES.reduce((sum, line) => sum + lineCost(line, budget[line.id] ?? 0, finance), 0);
}
export const hasAsset = owns;
// One-off purchases; the caller applies the immediate effects of those that have them.
export function buyInvestment(game, id, date) {
  const investment = INVESTMENTS.find(item => item.id === id);
  if (!investment) throw new Error('Investimento non disponibile.');
  if (!investment.repeatable && owns(game.finance, id, game.week.index)) throw new Error('Hai già questo investimento.');
  if (investment.requires && !owns(game.finance, investment.requires, game.week.index)) throw new Error(`Serve prima: ${INVESTMENTS.find(item => item.id === investment.requires)?.label ?? investment.requires}.`);
  if (game.resources.funds < investment.cost) throw new Error(`Servono ${investment.cost} € in cassa.`);
  book(game, -investment.cost, 'investimenti', investment.label, date);
  if (!investment.repeatable) game.finance.assets = [...(game.finance.assets ?? []).filter(asset => asset.id !== id), { id, label: investment.label, value: investment.value, boughtWeek: game.week.index, untilWeek: investment.weeks ? game.week.index + investment.weeks : null, source: SIM }];
  return investment;
}
export function depositElectionFund(game, amount, date) {
  const value = Math.round(amount);
  if (!(value > 0)) throw new Error('Indica una cifra da accantonare.');
  if (game.resources.funds < value) throw new Error('Non hai questa cifra in cassa.');
  book(game, -value, 'fondo', 'Accantonamento nel fondo elettorale', date);
  game.finance.electionFund = (game.finance.electionFund ?? 0) + value;
  return game.finance.electionFund;
}
// The fund goes to the campaign; donors add a share on top of what was set aside.
export function releaseElectionFund(game, date) {
  const fund = game.finance?.electionFund ?? 0;
  if (!fund) return 0;
  const total = Math.round(fund * (1 + ELECTION_FUND_MATCH));
  game.finance.electionFund = 0;
  game.finance.ledger = [{ week: game.week?.index ?? null, date, category: 'fondo', amount: 0, label: `Fondo elettorale alla campagna: ${total} € (di cui ${total - fund} € dai donatori)`, balance: game.resources.funds, source: SIM }, ...game.finance.ledger].slice(0, LEDGER_SIZE);
  return total;
}
// The reserve of emergency: money kept apart that pays for the unexpected before it becomes a debt, and covers a debt
// that is already there. It is not an expense: it can be taken back (what is left) at any time.
export function depositReserve(game, amount, date) {
  const value = Math.round(amount);
  if (!(value > 0)) throw new Error('Indica una cifra da accantonare.');
  if (game.resources.funds < value) throw new Error('Non hai questa cifra in cassa.');
  if ((game.finance.reserve ?? 0) + value > RESERVE.cap) throw new Error(`La riserva non può superare ${RESERVE.cap} €.`);
  book(game, -value, 'riserva', 'Accantonamento nella riserva di emergenza', date);
  game.finance.reserve = (game.finance.reserve ?? 0) + value;
  return game.finance.reserve;
}
export function releaseReserve(game, amount, date) {
  const value = Math.min(Math.round(amount), game.finance.reserve ?? 0);
  if (!(value > 0)) throw new Error('La riserva è vuota.');
  game.finance.reserve -= value;
  book(game, value, 'riserva', 'Prelievo dalla riserva di emergenza', date);
  return game.finance.reserve;
}
export function setBudgetLevel(input, lineId, level) {
  const line = BUDGET_LINES.find(item => item.id === lineId);
  if (!line) throw new Error('Voce di bilancio non riconosciuta.');
  if (!Number.isInteger(level) || level < 0 || level >= line.levels.length) throw new Error('Livello di spesa non valido.');
  return { ...input, budget: { ...input.budget, [lineId]: level } };
}

// The weekly close: income, the party's share, the cost of the role, the recurring budget and the programmes it keeps
// alive (what they return builds up slowly), the assets (upkeep, wear, returns, risks), the unexpected, interest and
// repayments. Returns the effects that the budget buys, which the career applies like any other effect.
export function settleFinanceWeek(game, { week, date, incomes = [], partyContribution = 0, rand = () => 0.5 }) {
  const finance = game.finance;
  finance.programs ??= {};
  finance.reserve ??= 0;
  const lines = [];
  for (const income of incomes) if (income.amount) book(game, income.amount, income.category, income.label, date);
  if (partyContribution) book(game, -partyContribution, 'partito', 'Contributo al partito sull’indennità', date);
  const effects = { stats: {}, relations: {}, prep: 0, party: 0, capital: 0, staffDays: 0, territory: false, perks: { volunteers: 0, organization: 0, selection: 0, quality: 0, recruit: 0 } };
  const add = (bucket, key, value) => { bucket[key] = Math.round(((bucket[key] ?? 0) + value) * 100) / 100; };
  // An expense that the reserve covers first: the books show the expense, only what is left leaves the cash.
  const incident = (what, label) => {
    const amount = Math.round(what.cost ?? 0);
    if (amount > 0) {
      const fromReserve = Math.min(finance.reserve, amount);
      if (fromReserve) {
        finance.reserve -= fromReserve;
        for (const period of [finance.current, finance.yearTotals]) tally(period, -fromReserve, 'imprevisti');
        finance.ledger = [{ week, date, category: 'imprevisti', amount: -fromReserve, label: `${label} (dalla riserva)`, balance: game.resources.funds, source: SIM }, ...finance.ledger].slice(0, LEDGER_SIZE);
      }
      if (amount > fromReserve) book(game, -(amount - fromReserve), 'imprevisti', label, date);
    }
    for (const [key, value] of Object.entries(what.stats ?? {})) add(effects.stats, key, value);
    lines.push(`${label}${amount ? `: ${amount.toLocaleString('it-IT')} €` : ''}`);
  };
  // The programmes and assets work through the same weekly effects (data in the rules): `factor` is how much of them is working.
  const applyWeekly = (weekly, factor, label) => {
    if (!weekly) return;
    for (const [key, value] of Object.entries(weekly.stats ?? {})) add(effects.stats, key, value * factor);
    for (const [key, value] of Object.entries(weekly.relations ?? {})) add(effects.relations, key, value * factor);
    if (weekly.prep) effects.prep += weekly.prep * factor;
    if (weekly.party) effects.party += weekly.party * factor;
    if (weekly.capital) effects.capital += weekly.capital * factor;
    if (weekly.donations) book(game, Math.round(weekly.donations * factor), 'donazioni', `${label}: donazioni`, date);
    for (const key of Object.keys(effects.perks)) if (weekly[key]) effects.perks[key] += weekly[key] * factor;
    if (weekly.risk && rand() < weekly.risk.chance) incident(weekly.risk, weekly.risk.label);
  };
  // The cost of a role: representing an office has a price that grows with the office.
  const indemnity = incomes.find(item => item.category === 'indennita')?.amount ?? 0;
  finance.indemnity = indemnity;
  if (indemnity > 0) book(game, -Math.round(indemnity * ROLE_COST_SHARE), 'relazioni', 'Spese di rappresentanza della carica', date);
  for (const line of BUDGET_LINES) {
    const level = finance.budget[line.id] ?? 0;
    const cost = lineCost(line, level, finance);
    const program = finance.programs[line.id] ?? { weeks: 0 };
    if (line.ramp) {
      // A programme builds up while it is paid and fades twice as fast when it stops.
      program.weeks = cost ? Math.min(line.ramp * 2, program.weeks + 1) : Math.max(0, program.weeks - 2);
      finance.programs[line.id] = program;
    }
    if (!cost) continue;
    book(game, -cost, line.category, `${line.label}: ${line.levels[level].label.toLowerCase()}`, date);
    if (line.id === 'personale') { effects.staffDays = level === 2 || week % 2 === 0 ? 1 : 0; if (level === 2) effects.capital += 1; }
    if (line.id === 'comunicazione') { add(effects.stats, 'notoriety', level === 2 ? 1.1 : 0.5); if (level === 2) add(effects.stats, 'popularity', 0.3); add(effects.relations, 'media', level === 2 ? 1 : 0.5); }
    if (line.id === 'territorio') { add(effects.stats, 'popularity', level === 2 ? 1 : 0.5); if (level === 2) add(effects.stats, 'consensus', 0.2); add(effects.relations, 'civic', level === 2 ? 1 : 0.5); effects.territory = true; }
    if (line.id === 'sede') { effects.prep += 1.5; effects.party += 0.3; }
    if (line.ramp) { applyWeekly(line.levels[level].weekly, Math.min(1, (program.weeks + 1) / line.ramp), line.label); if (line.id === 'logistica') effects.territory = true; }
  }
  if (owns(finance, 'piattaforma')) add(effects.stats, 'notoriety', 0.3);
  if (owns(finance, 'ufficio-stampa', week)) add(effects.relations, 'media', 0.5);
  // The assets: they cost to keep, wear out, return something and may fail.
  for (const asset of finance.assets ?? []) {
    const spec = INVESTMENTS.find(item => item.id === asset.id);
    if (!spec || (asset.untilWeek && asset.untilWeek < week)) continue;
    if (spec.upkeep) book(game, -spec.upkeep, 'manutenzione', `Mantenimento: ${spec.label}`, date);
    if (spec.decay && asset.value > 0) asset.value = Math.max(0, Math.round(asset.value * (1 - spec.decay)));
    applyWeekly(spec.weekly, 1, spec.label);
    if (spec.risk && rand() < spec.risk.chance) incident(spec.risk, spec.risk.label);
  }
  finance.assets = (finance.assets ?? []).filter(asset => !asset.untilWeek || asset.untilWeek >= week);
  // The unexpected: one thing at most in a week, heavier for higher offices; the reserve takes the blow first.
  for (const shock of FINANCE_SHOCKS) {
    if (shock.when && !shock.when({ game })) continue;
    if (rand() >= shock.chance + (shock.risky?.({ game }) ?? 0)) continue;
    const base = shock.cost[0] + (shock.cost[1] - shock.cost[0]) * rand();
    incident({ cost: base * (1 + Math.min(1.5, indemnity / 900)), stats: shock.effects?.stats }, shock.label);
    break;
  }
  effects.perks = Object.fromEntries(Object.entries(effects.perks).map(([key, value]) => [key, Math.round(value * 100) / 100]));
  finance.perks = { ...effects.perks, week };
  if (finance.debt > 0) {
    // A reserve is there for this: it pays down the debt before the interest eats it.
    if (finance.reserve > 0) { const use = Math.min(finance.debt, finance.reserve); finance.reserve -= use; finance.debt -= use; lines.push(`La riserva copre ${use.toLocaleString('it-IT')} € di debito`); }
  }
  if (finance.debt > 0) {
    const interest = Math.max(1, Math.round(finance.debt * DEBT_WEEKLY_INTEREST));
    book(game, -interest, 'interessi', 'Interessi sul debito', date);
    const repay = Math.min(finance.debt, Math.max(0, Math.round((game.resources.funds - RESERVE_BEFORE_REPAYING) * 0.3)));
    if (repay > 0) { book(game, -repay, 'debito', 'Rimborso del debito', date); finance.debt -= repay; lines.push(`Debito rimborsato per ${repay} €: restano ${finance.debt} €`); }
    else lines.push(`Debito aperto: ${finance.debt} € (interessi ${interest} €)`);
  }
  const period = finance.current;
  finance.history = [...finance.history, { week, date, income: Math.round(period.income), expense: Math.round(period.expense), net: Math.round(period.income - period.expense), balance: game.resources.funds, debt: finance.debt, byCategory: period.byCategory, source: SIM }].slice(-HISTORY_WEEKS);
  lines.unshift(`Bilancio della settimana: +${Math.round(period.income)} € / −${Math.round(period.expense)} € · saldo ${game.resources.funds} €`);
  finance.current = { week: week + 1, ...blankPeriod() };
  // A new calendar year closes the annual report.
  const year = date?.slice(0, 4);
  if (year && finance.year && year !== finance.year) {
    const totals = finance.yearTotals;
    finance.annual = [...finance.annual, { year: finance.year, income: Math.round(totals.income), expense: Math.round(totals.expense), net: Math.round(totals.income - totals.expense), byCategory: totals.byCategory, closingBalance: game.resources.funds, debt: finance.debt, source: SIM }].slice(-10);
    lines.push(`Chiuso il bilancio ${finance.year}: ${totals.income - totals.expense >= 0 ? 'avanzo' : 'disavanzo'} di ${Math.abs(Math.round(totals.income - totals.expense))} €`);
    finance.yearTotals = blankPeriod();
  }
  finance.year = year ?? finance.year;
  return { lines, effects, crisis: finance.debt >= DEBT_CRISIS_THRESHOLD };
}

// Reading of the accounts for the interface: trend, autonomy and a plain-language status.
export function financeOutlook(game) {
  const finance = game.finance ?? createFinance();
  const recent = finance.history.slice(-6);
  const average = key => recent.length ? recent.reduce((sum, item) => sum + item[key], 0) / recent.length : 0;
  const net = Math.round(average('net'));
  const expense = Math.round(average('expense'));
  const runway = expense > 0 ? Math.floor(game.resources.funds / expense) : null;
  const status = finance.debt >= DEBT_CRISIS_THRESHOLD ? ['crisi', 'Crisi finanziaria'] : finance.debt > 0 || (runway !== null && runway < 6 && net < 0) ? ['rischio', 'A rischio'] : net < 0 ? ['calo', 'In calo'] : ['solida', 'Sostenibile'];
  const assets = (finance.assets ?? []).reduce((sum, asset) => sum + (asset.value ?? 0), 0);
  // What the assets cost to keep every week (on top of the budget lines).
  const upkeep = (finance.assets ?? []).reduce((sum, asset) => sum + (INVESTMENTS.find(item => item.id === asset.id)?.upkeep ?? 0), 0);
  const reserve = finance.reserve ?? 0;
  return { net, expense, income: Math.round(average('income')), runway: runway === null ? null : Math.floor((game.resources.funds + reserve) / Math.max(1, expense)), debt: finance.debt, recurring: budgetCost(finance.budget, finance), upkeep, assets, fund: finance.electionFund ?? 0, reserve, netWorth: game.resources.funds + assets + (finance.electionFund ?? 0) + reserve - finance.debt, status: status[0], statusLabel: status[1] };
}
export { BUDGET_LINES, FINANCE_CATEGORIES, INVESTMENTS, RESERVE, TREASURY_OPERATIONS };

// ---------- treasury operations: cost now, outcome later, benefit not guaranteed ----------
export const treasuryOperation = id => TREASURY_OPERATIONS.find(item => item.id === id) ?? null;
// The range of what an operation can bring, for the screen that asks the player (the outcome itself is drawn only when it falls due).
export function operationRange(spec, notoriety = 30) {
  const key = spec.outcomes.some(item => item.income) ? 'income' : 'members';
  const factor = spec.scale === 'notoriety' ? 0.5 + Math.max(0, notoriety) / 60 : 1;
  const low = Math.round(Math.min(...spec.outcomes.map(item => item[key][0])) * factor), high = Math.round(Math.max(...spec.outcomes.map(item => item[key][1])) * factor);
  return { key, low, high };
}
// Why an operation cannot be started now (null when it can): it needs a party, or an indemnity below the limit that is compatible with the work it stands for.
export function operationProblem(game, spec) {
  if (spec.requiresParty && !game.party?.org) return 'Serve un partito: questa operazione è del partito.';
  if (Number.isFinite(spec.maxIndemnity) && (game.finance?.indemnity ?? 0) > spec.maxIndemnity) return `Non è compatibile con l’indennità della tua carica attuale (oltre ${spec.maxIndemnity} € a settimana).`;
  return null;
}
// Starts it: the player pays (the caller charges days and funds), the operation is recorded as in progress with the week it falls due.
export function beginOperation(game, id, { week, date }) {
  const spec = treasuryOperation(id);
  if (!spec) throw new Error('Operazione di tesoreria non riconosciuta.');
  const problem = operationProblem(game, spec);
  if (problem) throw new Error(problem);
  game.finance ??= createFinance({ week, date, funds: game.resources.funds });
  game.finance.operations ??= [];
  if (game.finance.operations.some(item => item.opId === id && item.status === 'in-corso')) throw new Error('Questa operazione è già in corso: aspetta l’esito prima di ripeterla.');
  const entry = { id: `op-${week}-${id}`, opId: id, label: spec.label, startWeek: week, dueWeek: week + spec.weeks, status: 'in-corso', cost: spec.cost.funds, result: null, source: SIM };
  game.finance.operations = [entry, ...game.finance.operations].slice(0, TREASURY_OPERATIONS_KEPT);
  return entry;
}
// At the weekly close: every operation that falls due draws its outcome (income, new members, a risk that costs), books the money and leaves the result in the register.
export function settleOperations(game, { week, date, rand, notoriety = 30 }) {
  const finance = game.finance;
  const results = [];
  const effects = { stats: {}, party: 0 };
  for (const entry of finance?.operations ?? []) {
    if (entry.status !== 'in-corso' || entry.dueWeek > week) continue;
    const spec = treasuryOperation(entry.opId);
    if (!spec) { entry.status = 'concluso'; continue; }
    let roll = rand(), outcome = spec.outcomes.at(-1);
    for (const item of spec.outcomes) { if (roll < item.chance) { outcome = item; break; } roll -= item.chance; }
    const factor = spec.scale === 'notoriety' ? 0.5 + Math.max(0, notoriety) / 60 : 1;
    const within = range => Math.round((range[0] + (range[1] - range[0]) * rand()) * factor);
    let income = outcome.income ? within(outcome.income) : 0;
    const members = outcome.members ? within(outcome.members) : 0;
    let text = `${spec.label}: ${outcome.label.toLowerCase()}`;
    if (income) { book(game, income, 'donazioni', `${spec.label}: incasso`, date); text += `, incassati ${income} € (spesi ${entry.cost} €)`; }
    if (members) text += `, ${members} nuovi iscritti`;
    let extraCost = 0;
    if (spec.risk && rand() < spec.risk.chance) {
      extraCost = spec.risk.cost ?? 0;
      if (extraCost) book(game, -extraCost, 'imprevisti', `${spec.label}: ${spec.risk.label}`, date);
      for (const [key, value] of Object.entries(spec.risk.stats ?? {})) effects.stats[key] = Math.round(((effects.stats[key] ?? 0) + value) * 100) / 100;
      text += ` · ${spec.risk.label}${extraCost ? ` (−${extraCost} €)` : ''}`;
    }
    if (outcome.tone !== 'warn') for (const [key, value] of Object.entries(spec.effects?.stats ?? {})) effects.stats[key] = Math.round(((effects.stats[key] ?? 0) + value) * 100) / 100;
    if (spec.effects?.party) effects.party += spec.effects.party;
    entry.status = 'concluso';
    entry.result = { week, outcome: outcome.label, tone: outcome.tone, income, members, extraCost, net: income - entry.cost - extraCost, text };
    results.push({ entry, spec, members, text, tone: outcome.tone });
  }
  return { results, effects };
}


// ---------- the regular supporters ----------
// The circle of supporters follows the politician's standing: how many they are (notoriety, consensus, popularity) and what each gives (reputation); the weekly cashing varies.
// Returns the week's income and keeps the state (game.supporters) up to date: a save from before this model starts at the number the standing sustains, so nothing jumps.
export function supporterTarget(stats = {}) {
  const raw = SUPPORTERS.base + SUPPORTERS.perNotoriety * (stats.notoriety ?? 0) + SUPPORTERS.perConsensus * (stats.consensus ?? 0) + SUPPORTERS.perPopularity * (stats.popularity ?? 0);
  return Math.max(SUPPORTERS.min, Math.min(SUPPORTERS.max, raw));
}
export const supporterPerHead = (stats = {}) => SUPPORTERS.perHeadMin + SUPPORTERS.perHeadSpan * Math.max(0, Math.min(100, stats.reputation ?? 50)) / 100;
export function supporterIncome(game, stats, rand = () => 0.5) {
  const target = supporterTarget(stats);
  const state = game.supporters && Number.isFinite(game.supporters.count) ? game.supporters : { count: target };
  const moved = state.count + (target - state.count) * SUPPORTERS.inertia;
  const count = Math.max(SUPPORTERS.min, Math.min(SUPPORTERS.max, moved * (1 + (rand() - 0.5) * 2 * SUPPORTERS.noise)));
  const perHead = supporterPerHead(stats);
  const [low, high] = SUPPORTERS.swing;
  const amount = Math.round(count * perHead * (low + (high - low) * rand()));
  game.supporters = { count: Math.round(count * 10) / 10, target: Math.round(target), perHead: Math.round(perHead * 100) / 100, income: amount, source: 'simulation' };
  return { amount, count: Math.round(count), target: Math.round(target), perHead };
}

// ---------- transfers between the politician's funds and the party's treasury ----------
// Two separate pots: the funds of the politician (game.resources.funds, with the committee budget) and the treasury of the party (game.party.org.treasury). A transfer is written in both registers
// (the same amount, once each side), never creates money, never leaves a balance below zero. The membership fees are income of the party and never pass through here.
const log = game => (game.finance.transfers ??= []);
function addTransfer(game, entry) {
  game.finance.transfers = [entry, ...log(game)].slice(0, TRANSFERS.historyKept);
  return entry;
}
const validAmount = amount => {
  const raw = typeof amount === 'string' ? amount.trim() : amount;
  if (raw === '' || raw === null || raw === undefined || typeof raw === 'boolean' || !Number.isFinite(Number(raw))) throw new Error(`Indica una cifra valida in euro (da ${TRANSFERS.min} a ${TRANSFERS.max} €).`);
  const value = Math.round(Number(raw));
  if (value < TRANSFERS.min || value > TRANSFERS.max) throw new Error(`L’importo va da ${TRANSFERS.min} a ${TRANSFERS.max} €.`);
  return value;
};
// What the politician can ask of the party: the rule of the rank (cap, approval), the room in the treasury and the waiting time since the last request.
export function partyRequestRules(game) {
  const party = game.party, org = party?.org;
  if (!org) return { allowed: false, reason: 'Serve un partito: senza partito non c’è una tesoreria a cui chiedere.' };
  const rank = party.affiliation === 'founder' ? 5 : (party.rank ?? 0);
  const rule = TRANSFERS.ranks[Math.min(5, rank)];
  if (!rule) return { allowed: false, reason: 'Da semplice iscritto non puoi chiedere fondi al partito: serve almeno un incarico di coordinatore locale.', rank };
  const balance = org.treasury.balance;
  const room = Math.max(0, balance - TRANSFERS.floor);
  const cap = rule.approval ? Math.min(rule.cap, room) : Math.min(rule.cap, Math.floor(balance * TRANSFERS.leaderShare), room);
  const pending = log(game).some(item => item.direction === 'dal-partito' && item.status === 'in-attesa');
  const last = log(game).find(item => item.direction === 'dal-partito' && item.status !== 'rifiutata');
  const wait = last && Number.isFinite(last.week) ? Math.max(0, TRANSFERS.cooldownWeeks - ((game.week?.index ?? 0) - last.week)) : 0;
  const reason = pending ? 'Hai già una richiesta in attesa di risposta.' : wait ? `Hai già ricevuto fondi di recente: la prossima richiesta tra ${wait} ${wait === 1 ? 'settimana' : 'settimane'}.` : cap < TRANSFERS.min ? `La tesoreria del partito non ha margine (restano da parte ${TRANSFERS.floor} €).` : null;
  return { allowed: !reason, reason, rank, approval: rule.approval, cap, rankCap: rule.cap, balance, wait, pending };
}
export function requestPartyFunds(game, amount, { week, date }) {
  const value = validAmount(amount);
  const rules = partyRequestRules(game);
  if (!rules.allowed) throw new Error(rules.reason);
  if (value > rules.cap) throw new Error(`Con il tuo ruolo puoi chiedere al massimo ${rules.cap} € per volta${rules.approval ? '' : ` (un quarto della tesoreria)`}.`);
  game.finance ??= createFinance({ week, date, funds: game.resources.funds });
  const base = { id: `tr-${week}-${log(game).length + 1}`, week, date, direction: 'dal-partito', amount: value, source: 'simulation' };
  if (rules.approval) return addTransfer(game, { ...base, status: 'in-attesa', note: 'La direzione risponde alla chiusura della settimana.' });
  return settleGrant(game, addTransfer(game, { ...base, status: 'in-attesa', note: '' }), { week, date, decided: 'Disposta direttamente dal segretario' });
}
// Pays an approved request: the treasury must still hold the amount (and its floor), then the money moves in both registers.
function settleGrant(game, entry, { week, date, decided }) {
  const org = game.party?.org;
  if (!org || org.treasury.balance - entry.amount < TRANSFERS.floor) {
    Object.assign(entry, { status: 'rifiutata', decidedWeek: week, note: 'La tesoreria non ha più il margine necessario: nessun fondo è stato spostato.' });
    return entry;
  }
  treasuryBook(org, -entry.amount, 'sostegno', 'Sostegno a un eletto o candidato');
  book(game, entry.amount, 'fondi_partito', 'Fondi ricevuti dal partito', date);
  const support = Math.max(0, Math.min(0.8, entry.amount / 3000 * TRANSFERS.askedCost));
  if (game.party && !decided.startsWith('Disposta')) game.party.support = Math.max(0, Math.round(((game.party.support ?? 50) - support) * 100) / 100);
  Object.assign(entry, { status: 'approvata', decidedWeek: week, note: `${decided}.`, treasuryAfter: org.treasury.balance, fundsAfter: game.resources.funds });
  return entry;
}
// At the weekly close: the requests that wait are decided, with a chance that follows the support of the politician in the party, the reputation and the state of the treasury.
export function settleTransfers(game, { week, date, rand, stats = {} }) {
  const results = [];
  for (const entry of log(game)) {
    if (entry.status !== 'in-attesa' || entry.week > week) continue;
    const org = game.party?.org;
    const rules = TRANSFERS.approval;
    const room = org ? org.treasury.balance : 0;
    const chance = Math.max(0.05, Math.min(0.95, rules.base + rules.perSupport * (game.party?.support ?? 50) + rules.perReputation * (stats.reputation ?? 50) + (room > entry.amount * 4 ? rules.flush : room < entry.amount * 2 + TRANSFERS.floor ? rules.tight : 0)));
    if (rand() < chance) settleGrant(game, entry, { week, date, decided: 'Approvata dalla direzione' });
    else Object.assign(entry, { status: 'rifiutata', decidedWeek: week, note: 'La direzione ha respinto la richiesta: la cassa serve ad altro in questo momento.' });
    results.push(entry);
  }
  return results;
}
export function contributeToParty(game, amount, { week, date }) {
  const org = game.party?.org;
  if (!org) throw new Error('Serve un partito: senza partito non c’è una tesoreria a cui versare.');
  const value = validAmount(amount);
  if (value > game.resources.funds) throw new Error(`Nei tuoi fondi ci sono ${game.resources.funds} €: non puoi versare ${value} €.`);
  game.finance ??= createFinance({ week, date, funds: game.resources.funds });
  book(game, -value, 'partito', 'Versamento volontario al partito', date);
  treasuryBook(org, value, 'contributi', 'Versamento volontario di un eletto');
  const gift = Math.min(TRANSFERS.giftSupportMax, value / TRANSFERS.giftSupport);
  if (game.party) game.party.support = Math.min(100, Math.round(((game.party.support ?? 50) + gift) * 100) / 100);
  return addTransfer(game, { id: `tr-${week}-${log(game).length + 1}`, week, date, direction: 'al-partito', amount: value, status: 'eseguito', note: 'Versamento volontario.', treasuryAfter: org.treasury.balance, fundsAfter: game.resources.funds, source: 'simulation' });
}
