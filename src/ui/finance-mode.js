// Money of the career and of the party: balance, flows, budget, reports and sustainability.
import { BUDGET_LINES, FINANCE_CATEGORIES, financeOutlook, hasAsset, INVESTMENTS } from '../core/finance-engine.js?v=20260925-6';
import { isPartyLeader, PARTY_PRIORITIES, TREASURY_LABELS, treasuryOutlook } from '../core/organization-engine.js?v=20260925-6';
import { artTile } from './visuals.js?v=20260925-6';
import { illustration } from './illustrations.js?v=20260925-6';
import { breakdown, esc, euro, EXPENSE_COLOR, flowChart, INCOME_COLOR, lineChart, num, SERIES, signed, sparkline, stateBadge } from './charts.js?v=20260925-6';

const STATUS_KIND = { solida: 'solida', calo: 'calo', rischio: 'rischio', crisi: 'crisi' };

function categoryRows(byCategory = {}, labels) {
  const entries = Object.entries(byCategory).filter(([, value]) => value);
  return {
    income: entries.filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).map(([key, value]) => ({ label: labels[key]?.label ?? labels[key] ?? key, value, color: INCOME_COLOR })),
    expense: entries.filter(([, value]) => value < 0).sort((a, b) => a[1] - b[1]).map(([key, value]) => ({ label: labels[key]?.label ?? labels[key] ?? key, value: -value, color: EXPENSE_COLOR }))
  };
}

function budgetControls(game) {
  const budget = game.finance.budget;
  const disabled = game.status === 'ended' ? 'disabled' : '';
  return `<div class="budget-list">${BUDGET_LINES.map(line => {
    const level = budget[line.id] ?? 0;
    return `<article class="budget-line"><header>${artTile(line.icon, level ? 'var(--party-accent)' : '#8c988b', 'sm')}<div><strong>${esc(line.label)}</strong><small>${esc(line.levels[level].effect)}</small></div><b>${line.levels[level].cost ? `${euro(line.levels[level].cost)}<i>/sett.</i>` : 'Nessuna spesa'}</b></header><div class="segmented" role="group" aria-label="${esc(line.label)}">${line.levels.map((option, index) => `<button class="${index === level ? 'active' : ''}" data-budget-line="${esc(line.id)}" data-budget-level="${index}" aria-pressed="${index === level}" ${disabled}>${esc(option.label)}<small>${option.cost ? euro(option.cost) : '0 €'}</small></button>`).join('')}</div></article>`;
  }).join('')}</div>`;
}

// Lasting investments, the election fund and the balance sheet.
function investmentsPanel(game, outlook) {
  const ended = game.status === 'ended';
  const cards = INVESTMENTS.map(item => {
    const owned = !item.repeatable && hasAsset(game.finance, item.id, game.week.index);
    const asset = (game.finance.assets ?? []).find(entry => entry.id === item.id);
    const short = game.resources.funds < item.cost;
    return `<article class="invest-card ${owned ? 'is-owned' : ''}">${artTile(item.icon, owned ? '#1baf7a' : 'var(--party-accent)', 'sm')}<div><strong>${esc(item.label)}</strong><small>${esc(item.effect)}</small>${owned ? `<span class="state-badge state-solida">Tuo dalla settimana ${asset?.boughtWeek}${asset?.untilWeek ? ` · fino alla ${asset.untilWeek}` : ''}</span>` : `<button class="secondary-button" data-invest="${esc(item.id)}" ${ended || short ? 'disabled' : ''} title="${short ? 'Cassa insufficiente' : ''}">Investi ${euro(item.cost)}</button>`}</div></article>`;
  }).join('');
  const fundButtons = [500, 1000, 2500].map(amount => `<button class="chip-button" data-election-fund="${amount}" ${ended || game.resources.funds < amount ? 'disabled' : ''}>+${euro(amount)}</button>`).join('');
  return `<div class="balance-sheet"><div><small>Cassa</small><strong>${euro(game.resources.funds)}</strong></div><div><small>Fondo elettorale</small><strong>${euro(outlook.fund)}</strong></div><div><small>Beni</small><strong>${euro(outlook.assets)}</strong></div><div><small>Debito</small><strong class="${outlook.debt ? 'out' : ''}">${outlook.debt ? '−' : ''}${euro(outlook.debt)}</strong></div><div class="is-total"><small>Patrimonio netto</small><strong>${euro(outlook.netWorth)}</strong></div></div>
    <div class="invest-grid">${cards}</div>
    <div class="fund-box">${artTile('ballot', '#e34948', 'sm')}<div><strong>Fondo elettorale vincolato</strong><small>Accantona ora: all’avvio della prossima campagna il fondo passa ai candidati e i donatori aggiungono il 15%. Non conta come spesa.</small></div><div class="fund-actions">${fundButtons}</div></div>`;
}

export function renderFinancePage(state) {
  const game = state.game;
  if (!game?.finance) return '<p class="quiet-copy">Le finanze si attivano con la carriera.</p>';
  const finance = game.finance;
  const outlook = financeOutlook(game);
  const history = finance.history.slice(-16);
  const panel = (kicker, title, body, extra = '') => `<section class="hq-panel"><div class="home-section-heading"><div><span class="section-kicker">${kicker}</span><h2>${title}</h2></div>${extra}</div>${body}</section>`;
  const year = categoryRows(finance.yearTotals.byCategory, FINANCE_CATEGORIES);
  const ledger = finance.ledger.slice(0, 18).map(entry => `<div class="ledger-row"><time>${entry.week ? `S${entry.week}` : ''}</time><span><strong>${esc(entry.label)}</strong><small>${esc(FINANCE_CATEGORIES[entry.category]?.label ?? entry.category)}</small></span><b class="${entry.amount >= 0 ? 'in' : 'out'}">${signed(entry.amount, 0)} €</b></div>`).join('');
  const annual = finance.annual.length ? `<table class="annual-table"><thead><tr><th>Anno</th><th>Entrate</th><th>Uscite</th><th>Risultato</th><th>Saldo finale</th></tr></thead><tbody>${[...finance.annual].reverse().map(item => `<tr><th>${esc(item.year)}</th><td>${euro(item.income)}</td><td>${euro(item.expense)}</td><td class="${item.net >= 0 ? 'in' : 'out'}">${signed(item.net, 0)} €</td><td>${euro(item.closingBalance)}${item.debt ? ` · debito ${euro(item.debt)}` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="quiet-copy">Il primo bilancio annuale si chiude a fine anno solare.</p>';
  const weeks = history.map(item => ({ label: `Settimana ${item.week}`, short: `S${item.week}`, income: item.income, expense: item.expense }));
  return `<div class="finance-page">
    <section class="finance-hero">
      ${illustration('tesoro', 'hero-art')}<div>${artTile('wallet', 'var(--party-accent)', 'lg')}<div><span class="section-kicker">LE TUE FINANZE POLITICHE · SIMULATE</span><h2>${euro(game.resources.funds)} in cassa</h2><p class="section-subtitle">Comitato, staff, comunicazione e campagne si pagano da qui. Le spese ricorrenti lavorano per te ogni settimana; il debito costa interessi.</p></div>${stateBadge(STATUS_KIND[outlook.status], outlook.statusLabel)}</div>
      <div class="finance-kpis"><div><small>Entrate medie</small><strong>${euro(outlook.income)}</strong><span>a settimana</span></div><div><small>Uscite medie</small><strong>${euro(outlook.expense)}</strong><span>a settimana</span></div><div><small>Risultato medio</small><strong class="${outlook.net >= 0 ? 'in' : 'out'}">${signed(outlook.net, 0)} €</strong><span>ultime 6 settimane</span></div><div><small>Spese fisse</small><strong>${euro(outlook.recurring)}</strong><span>budget settimanale</span></div><div><small>Autonomia</small><strong>${outlook.runway === null ? '—' : `${outlook.runway} sett.`}</strong><span>al ritmo attuale</span></div><div><small>Debito</small><strong class="${outlook.debt ? 'out' : ''}">${euro(outlook.debt)}</strong><span>${outlook.debt ? 'interessi 1% a settimana' : 'nessun debito'}</span></div></div>
    </section>
    <div class="society-grid">
      ${panel('FLUSSI', 'Entrate e uscite, settimana per settimana', flowChart(weeks) + `<details class="poll-table"><summary>Tabella dei dati</summary><div class="poll-table-scroll"><table><thead><tr><th>Settimana</th><th>Entrate</th><th>Uscite</th><th>Saldo</th></tr></thead><tbody>${history.map(item => `<tr><th>S${item.week}</th><td>${euro(item.income)}</td><td>${euro(item.expense)}</td><td>${euro(item.balance)}</td></tr>`).join('')}</tbody></table></div></details>`)}
      ${panel('SALDO', 'Cassa nel tempo', lineChart({ series: [{ label: 'Saldo in cassa', short: 'Saldo', color: SERIES[0], values: history.map(item => item.balance), emphasis: true }, ...(history.some(item => item.debt) ? [{ label: 'Debito', color: SERIES[7], values: history.map(item => item.debt) }] : [])], labels: history.map(item => `S${item.week}`), tips: history.map(item => `Settimana ${item.week}`), unit: ' €', digits: 0, min: 0, ariaLabel: 'Saldo in cassa per settimana' }))}
    </div>
    ${panel('BILANCIO SETTIMANALE', 'Le tue spese ricorrenti', budgetControls(game) + '<p class="parliament-note">Le scelte valgono dalla prossima chiusura di settimana. Se la cassa non basta, la differenza diventa debito; oltre 2.500 € scatta una crisi finanziaria.</p>', `<span class="hq-count">${euro(outlook.recurring)}/sett.</span>`)}
    <div class="society-grid">
      ${panel('INVESTIMENTI E PATRIMONIO', 'Cosa possiedi e dove investire', investmentsPanel(game, outlook))}
    ${panel(`ANNO ${esc(finance.year ?? '')}`, 'Da dove arrivano e dove vanno', `<div class="split-breakdown"><div><small>ENTRATE</small>${year.income.length ? breakdown(year.income, { format: euro }) : '<p class="quiet-copy">—</p>'}</div><div><small>USCITE</small>${year.expense.length ? breakdown(year.expense, { format: euro }) : '<p class="quiet-copy">—</p>'}</div></div>`)}
      ${panel('MOVIMENTI', 'Registro contabile', `<div class="ledger">${ledger || '<p class="quiet-copy">Nessun movimento.</p>'}</div>`)}
    </div>
    ${panel('BILANCI ANNUALI', 'Chiusure d’esercizio', annual)}
    ${renderTreasuryPanel(state)}
    <p class="poll-footnote">Importi di gioco (source: simulation): non corrispondono a indennità, rimborsi o bilanci reali di persone o partiti.</p>
  </div>`;
}

export function renderTreasuryPanel(state) {
  const party = state.game?.party;
  const org = party?.org;
  if (!org) return '';
  const outlook = treasuryOutlook(org);
  const leader = isPartyLeader(party);
  const history = org.treasury.history.slice(-16);
  const last = org.treasury.annual.at(-1);
  const rows = categoryRows(last?.byCategory ?? org.treasury.yearTotals.byCategory, TREASURY_LABELS);
  const priorities = PARTY_PRIORITIES.map(priority => `<article class="budget-line"><header><div><strong>${esc(priority.label)}</strong><small>${esc(priority.detail)}</small></div></header><div class="segmented" role="group" aria-label="${esc(priority.label)}">${['Minima', 'Ordinaria', 'Prioritaria'].map((label, index) => `<button class="${org.priorities[priority.id] === index ? 'active' : ''}" data-party-priority="${esc(priority.id)}" data-party-priority-level="${index}" aria-pressed="${org.priorities[priority.id] === index}" ${leader ? '' : 'disabled'}>${label}</button>`).join('')}</div></article>`).join('');
  return `<section class="hq-panel treasury-panel"><div class="home-section-heading"><div><span class="section-kicker">TESORERIA DEL PARTITO · STIMA DI GIOCO</span><h2>${euro(org.treasury.balance)} nelle casse del partito</h2></div>${stateBadge(STATUS_KIND[outlook.status], outlook.statusLabel)}</div>
    <div class="society-grid"><div>${lineChart({ series: [{ label: 'Tesoreria', color: SERIES[0], values: history.map(item => item.balance), emphasis: true }], labels: history.map(item => `S${item.week}`), tips: history.map(item => `Settimana ${item.week}`), unit: ' €', digits: 0, height: 190, ariaLabel: 'Tesoreria del partito per settimana' })}<p class="parliament-note">Risultato medio ${signed(outlook.net, 0)} € a settimana. Entrate: quote degli iscritti, 2×1000 stimato dai sondaggi, contributi degli eletti. Uscite: sezioni, personale, comunicazione, formazione e campagne.</p></div>
    <div><div class="split-breakdown"><div><small>ENTRATE ${last ? esc(last.year) : 'DELL’ANNO'}</small>${rows.income.length ? breakdown(rows.income, { format: euro }) : '<p class="quiet-copy">—</p>'}</div><div><small>USCITE</small>${rows.expense.length ? breakdown(rows.expense, { format: euro }) : '<p class="quiet-copy">—</p>'}</div></div></div></div>
    <div class="home-section-heading"><div><span class="section-kicker">PRIORITÀ DI BILANCIO</span><h3>${leader ? 'Le decide la direzione: tu ne fai parte' : 'Le decide la direzione nazionale'}</h3></div></div><div class="budget-list">${priorities}</div></section>`;
}

export function renderFinanceCard(state) {
  const game = state.game;
  if (!game?.finance) return '';
  const outlook = financeOutlook(game);
  const org = game.party?.org;
  return `<div class="dash-body"><div class="dash-number"><strong>${euro(game.resources.funds)}</strong><small>in cassa</small>${stateBadge(STATUS_KIND[outlook.status], outlook.statusLabel)}</div>${sparkline(game.finance.history.slice(-12).map(item => item.balance))}<dl class="dash-facts"><div><dt>Risultato</dt><dd>${signed(outlook.net, 0)} €/sett.</dd></div><div><dt>Spese fisse</dt><dd>${euro(outlook.recurring)}</dd></div><div><dt>Fondo elettorale</dt><dd>${euro(outlook.fund)}</dd></div><div><dt>Debito</dt><dd>${euro(outlook.debt)}</dd></div>${org ? `<div class="dash-wide"><dt>Tesoreria del partito</dt><dd>${euro(org.treasury.balance)} · ${esc(treasuryOutlook(org).statusLabel.toLowerCase())}</dd></div>` : ''}</dl></div>`;
}
