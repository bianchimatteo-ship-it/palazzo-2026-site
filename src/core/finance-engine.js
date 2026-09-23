import { BUDGET_LINES, DEBT_CRISIS_THRESHOLD, DEBT_WEEKLY_INTEREST, FINANCE_CATEGORIES, HISTORY_WEEKS, LEDGER_SIZE, RESERVE_BEFORE_REPAYING } from '../data/simulation/finance-rules.js?v=20260924-8';

const SIM = 'simulation';
const blankPeriod = () => ({ income: 0, expense: 0, byCategory: {} });

export function createFinance({ week = 1, date = null, funds = 0 } = {}) {
  return {
    version: 1, source: SIM, budget: { personale: 0, comunicazione: 0, territorio: 0, sede: 0 }, debt: 0,
    ledger: [], current: { week, ...blankPeriod() }, history: [], year: date ? date.slice(0, 4) : null, yearTotals: blankPeriod(), annual: [], openingFunds: funds
  };
}
export function normalizeFinance(finance, { week = 1, date = null, funds = 0 } = {}) {
  if (!finance || typeof finance !== 'object') return createFinance({ week, date, funds });
  const base = createFinance({ week, date, funds });
  return { ...base, ...finance, budget: { ...base.budget, ...(finance.budget ?? {}) }, current: { ...base.current, ...(finance.current ?? {}) }, yearTotals: { ...base.yearTotals, ...(finance.yearTotals ?? {}) } };
}
function tally(period, amount, category) {
  if (amount >= 0) period.income += amount; else period.expense -= amount;
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

export function budgetCost(budget = {}) {
  return BUDGET_LINES.reduce((sum, line) => sum + (line.levels[budget[line.id] ?? 0]?.cost ?? 0), 0);
}
export function setBudgetLevel(input, lineId, level) {
  const line = BUDGET_LINES.find(item => item.id === lineId);
  if (!line) throw new Error('Voce di bilancio non riconosciuta.');
  if (!Number.isInteger(level) || level < 0 || level >= line.levels.length) throw new Error('Livello di spesa non valido.');
  return { ...input, budget: { ...input.budget, [lineId]: level } };
}

// The weekly close: income, the party's share, the recurring budget, interest and repayments.
// Returns the effects that the budget buys, which the career applies like any other effect.
export function settleFinanceWeek(game, { week, date, incomes = [], partyContribution = 0 }) {
  const finance = game.finance;
  const lines = [];
  for (const income of incomes) if (income.amount) book(game, income.amount, income.category, income.label, date);
  if (partyContribution) book(game, -partyContribution, 'partito', 'Contributo al partito sull’indennità', date);
  const effects = { stats: {}, relations: {}, prep: 0, party: 0, capital: 0, staffDays: 0, territory: false };
  const add = (bucket, key, value) => { bucket[key] = Math.round(((bucket[key] ?? 0) + value) * 100) / 100; };
  for (const line of BUDGET_LINES) {
    const level = finance.budget[line.id] ?? 0;
    const cost = line.levels[level]?.cost ?? 0;
    if (!cost) continue;
    book(game, -cost, line.category, `${line.label}: ${line.levels[level].label.toLowerCase()}`, date);
    if (line.id === 'personale') { effects.staffDays = level === 2 || week % 2 === 0 ? 1 : 0; if (level === 2) effects.capital += 1; }
    if (line.id === 'comunicazione') { add(effects.stats, 'notoriety', level === 2 ? 1.1 : 0.5); if (level === 2) add(effects.stats, 'popularity', 0.3); add(effects.relations, 'media', level === 2 ? 1 : 0.5); }
    if (line.id === 'territorio') { add(effects.stats, 'popularity', level === 2 ? 1 : 0.5); if (level === 2) add(effects.stats, 'consensus', 0.2); add(effects.relations, 'civic', level === 2 ? 1 : 0.5); effects.territory = true; }
    if (line.id === 'sede') { effects.prep += 1.5; effects.party += 0.3; }
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
  return { net, expense, income: Math.round(average('income')), runway, debt: finance.debt, recurring: budgetCost(finance.budget), status: status[0], statusLabel: status[1] };
}
export { BUDGET_LINES, FINANCE_CATEGORIES };
