import { BUDGET_LINES, DEBT_CRISIS_THRESHOLD, DEBT_WEEKLY_INTEREST, ELECTION_FUND_MATCH, FINANCE_CATEGORIES, HISTORY_WEEKS, INVESTMENTS, LEDGER_SIZE, RESERVE_BEFORE_REPAYING } from '../data/simulation/finance-rules.js?v=20260926-7';

const SIM = 'simulation';
const blankPeriod = () => ({ income: 0, expense: 0, byCategory: {} });

export function createFinance({ week = 1, date = null, funds = 0 } = {}) {
  return {
    version: 1, source: SIM, budget: { personale: 0, comunicazione: 0, territorio: 0, sede: 0 }, debt: 0, assets: [], electionFund: 0,
    ledger: [], current: { week, ...blankPeriod() }, history: [], year: date ? date.slice(0, 4) : null, yearTotals: blankPeriod(), annual: [], openingFunds: funds
  };
}
export function normalizeFinance(finance, { week = 1, date = null, funds = 0 } = {}) {
  if (!finance || typeof finance !== 'object') return createFinance({ week, date, funds });
  const base = createFinance({ week, date, funds });
  return { ...base, ...finance, budget: { ...base.budget, ...(finance.budget ?? {}) }, current: { ...base.current, ...(finance.current ?? {}) }, yearTotals: { ...base.yearTotals, ...(finance.yearTotals ?? {}) } };
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
    const cost = lineCost(line, level, finance);
    if (!cost) continue;
    book(game, -cost, line.category, `${line.label}: ${line.levels[level].label.toLowerCase()}`, date);
    if (line.id === 'personale') { effects.staffDays = level === 2 || week % 2 === 0 ? 1 : 0; if (level === 2) effects.capital += 1; }
    if (line.id === 'comunicazione') { add(effects.stats, 'notoriety', level === 2 ? 1.1 : 0.5); if (level === 2) add(effects.stats, 'popularity', 0.3); add(effects.relations, 'media', level === 2 ? 1 : 0.5); }
    if (line.id === 'territorio') { add(effects.stats, 'popularity', level === 2 ? 1 : 0.5); if (level === 2) add(effects.stats, 'consensus', 0.2); add(effects.relations, 'civic', level === 2 ? 1 : 0.5); effects.territory = true; }
    if (line.id === 'sede') { effects.prep += 1.5; effects.party += 0.3; }
  }
  if (owns(finance, 'piattaforma')) add(effects.stats, 'notoriety', 0.3);
  if (owns(finance, 'ufficio-stampa', week)) add(effects.relations, 'media', 0.5);
  finance.assets = (finance.assets ?? []).filter(asset => !asset.untilWeek || asset.untilWeek >= week);
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
  return { net, expense, income: Math.round(average('income')), runway, debt: finance.debt, recurring: budgetCost(finance.budget, finance), assets, fund: finance.electionFund ?? 0, netWorth: game.resources.funds + assets + (finance.electionFund ?? 0) - finance.debt, status: status[0], statusLabel: status[1] };
}
export { BUDGET_LINES, FINANCE_CATEGORIES, INVESTMENTS };
