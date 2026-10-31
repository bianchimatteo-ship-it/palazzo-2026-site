// Money of the career and of the party: balance, flows, budget, reports and sustainability.
import { BUDGET_LINES, FINANCE_CATEGORIES, financeOutlook, hasAsset, INVESTMENTS, operationProblem, operationRange, partyRequestRules, RESERVE, TREASURY_OPERATIONS } from '../core/finance-engine.js?v=20261031-2';
import { TRANSFERS } from '../data/simulation/finance-rules.js?v=20261031-2';
import { costProblem } from '../core/career-engine.js?v=20261031-2';
import { costText, planAddButton } from './plan-view.js?v=20261031-2';
import { isPartyLeader, PARTY_PRIORITIES, TREASURY_LABELS, treasuryOutlook } from '../core/organization-engine.js?v=20261031-2';
import { artTile, glyph } from './visuals.js?v=20261031-2';
import { illustration } from './illustrations.js?v=20261031-2';
import { foldPanel } from './sections-kit.js?v=20261031-2';
import { breakdown, esc, euro, EXPENSE_COLOR, flowChart, INCOME_COLOR, lineChart, num, SERIES, signed, sparkline, stateBadge } from './charts.js?v=20261031-2';

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

// Fundraising dinners, membership drives, party events and online appeals: each costs days and money now, takes weeks and brings a result that is not guaranteed. The register under them
// compares what was spent with what came back, operation by operation.
function operationsPanel(game, state) {
  const ended = game.status === 'ended';
  const notoriety = state.dataset.statistics.find(item => item.subjectId === state.career.playerId && item.metric === 'notoriety')?.value ?? 30;
  const running = new Set((game.finance.operations ?? []).filter(item => item.status === 'in-corso').map(item => item.opId));
  const cards = TREASURY_OPERATIONS.map(spec => {
    const range = operationRange(spec, notoriety);
    const problem = ended ? 'Carriera conclusa.' : running.has(spec.id) ? 'È già in corso: aspetta l’esito.' : operationProblem(game, spec) ?? costProblem(game, spec.cost);
    const benefit = range.key === 'income' ? `${euro(range.low)}–${euro(range.high)} di incasso` : `${range.low}–${range.high} nuovi iscritti${spec.incomePerMember ? ` (${euro(spec.incomePerMember)} di quota ciascuno)` : ''}`;
    const risk = spec.risk ? `${Math.round(spec.risk.chance * 100)}%: ${spec.risk.label.toLowerCase()}${spec.risk.cost ? ` (−${euro(spec.risk.cost)})` : ''}` : 'nessun rischio particolare';
    return `<article class="invest-card ${problem ? '' : 'is-ready'}">${artTile(spec.icon, 'var(--party-accent)', 'sm')}<div><strong>${esc(spec.label)}</strong><small>${esc(spec.detail)}</small>
      <small class="invest-note"><b>Costo</b> ${esc(costText(spec.cost))} · <b>Tempi</b> esito tra ${spec.weeks} settimane</small>
      <small class="invest-note"><b>Può rendere</b> ${esc(benefit)} — non è garantito: l’esito più debole può restare sotto la spesa · <b>Rischio</b> ${esc(risk)}</small>
      <div class="invest-actions"><button class="secondary-button" data-treasury-start="${esc(spec.id)}" ${problem ? `disabled title="${esc(problem)}"` : ''}>Avvia</button>${problem ? '' : planAddButton({ kind: 'treasury', id: spec.id })}${problem ? `<em>${esc(problem)}</em>` : ''}</div></div></article>`;
  }).join('');
  const operations = game.finance.operations ?? [];
  const done = operations.filter(item => item.status === 'concluso' && item.result);
  const register = operations.length ? `<div class="ledger operations-register">${operations.slice(0, 10).map(item => `<div class="ledger-row"><time>S${item.startWeek}</time><span><strong>${esc(item.label)}</strong><small>${item.status === 'in-corso' ? `in corso: esito alla settimana ${item.dueWeek}, speso ${euro(item.cost)}` : esc(item.result.text)}</small></span><b class="${item.status === 'in-corso' ? '' : item.result.net >= 0 ? 'in' : 'out'}">${item.status === 'in-corso' ? '…' : `${item.result.net >= 0 ? '+' : '−'}${euro(Math.abs(item.result.net))}`}</b></div>`).join('')}</div>` : '<p class="quiet-copy">Nessuna operazione ancora: gli esiti compaiono qui, con quanto hai speso e quanto è tornato.</p>';
  const spent = done.reduce((sum, item) => sum + item.cost + (item.result.extraCost ?? 0), 0), back = done.reduce((sum, item) => sum + item.result.income, 0);
  const members = done.reduce((sum, item) => sum + (item.result.members ?? 0), 0);
  const summary = done.length ? `<p class="parliament-note">Finora ${done.length} ${done.length === 1 ? 'operazione conclusa' : 'operazioni concluse'}: spesi ${euro(spent)}, incassati ${euro(back)}${members ? `, ${members} nuovi iscritti` : ''}. Risultato netto ${back - spent >= 0 ? '+' : '−'}${euro(Math.abs(back - spent))}.</p>` : '';
  const supporters = game.supporters ? `<p class="parliament-note" data-supporters>Sostenitori ricorrenti: circa ${num(game.supporters.count, 0)} (${euro(game.supporters.perHead)} a testa a settimana), ${euro(game.supporters.income)} incassati questa settimana. Crescono con notorietà, consenso e popolarità e danno di più se la reputazione è alta; la cifra cambia di settimana in settimana.</p>` : '';
  return `${supporters}<div class="invest-grid">${cards}</div>${summary}${register}<p class="parliament-note">Importi e adesioni sono esiti simulati, tirati a sorte alla scadenza dentro gli intervalli indicati: nessuna donazione, quota o transazione è reale.</p>`;
}
// Where the weekly budget goes, line by line (the same lines as the controls above).
function allocationPanel(game) {
  const rows = BUDGET_LINES.map(line => ({ label: line.label, value: line.levels[game.finance.budget[line.id] ?? 0].cost ?? 0, color: INCOME_COLOR })).filter(row => row.value > 0);
  return rows.length ? breakdown(rows, { format: euro }) : '<p class="quiet-copy">Nessuna spesa ricorrente: scegli un livello nelle voci qui sopra.</p>';
}

// Lasting investments, the election fund and the balance sheet.
function investmentsPanel(game, outlook) {
  const ended = game.status === 'ended';
  const cards = INVESTMENTS.map(item => {
    const owned = !item.repeatable && hasAsset(game.finance, item.id, game.week.index);
    const asset = (game.finance.assets ?? []).find(entry => entry.id === item.id);
    const short = game.resources.funds < item.cost;
    const base = item.requires ? INVESTMENTS.find(entry => entry.id === item.requires) : null;
    const missing = base && !hasAsset(game.finance, item.requires, game.week.index);
    const why = missing ? `Serve prima: ${base.label}` : short ? 'Cassa insufficiente' : '';
    const worth = owned && asset?.value ? ` · valore ${euro(asset.value)}` : '';
    return `<article class="invest-card ${owned ? 'is-owned' : ''}">${artTile(item.icon, owned ? '#4C8F6B' : 'var(--party-accent)', 'sm')}<div><strong>${esc(item.label)}</strong><small>${esc(item.effect)}</small>${item.requires ? `<small class="invest-note">Potenziamento di: ${esc(base?.label ?? item.requires)}</small>` : ''}${owned ? `<span class="state-badge state-solida">Tuo dalla settimana ${asset?.boughtWeek}${asset?.untilWeek ? ` · fino alla ${asset.untilWeek}` : ''}${item.upkeep ? ` · ${euro(item.upkeep)}/sett.` : ''}${worth}</span>` : `<button class="secondary-button" data-invest="${esc(item.id)}" ${ended || short || missing ? 'disabled' : ''} title="${esc(why)}">Investi ${euro(item.cost)}</button>${missing ? `<small class="invest-note">${esc(why)}</small>` : ''}`}</div></article>`;
  }).join('');
  const reserveButtons = RESERVE.deposits.map(amount => `<button class="chip-button" data-reserve="${amount}" ${ended || game.resources.funds < amount || (outlook.reserve + amount > RESERVE.cap) ? 'disabled' : ''}>+${euro(amount)}</button>`).join('') + `<button class="chip-button" data-reserve-release ${ended || !outlook.reserve ? 'disabled' : ''}>Riprendi tutto</button>`;
  const fundButtons = [500, 1000, 2500].map(amount => `<button class="chip-button" data-election-fund="${amount}" ${ended || game.resources.funds < amount ? 'disabled' : ''}>+${euro(amount)}</button>`).join('');
  return `<div class="balance-sheet"><div><small>Cassa</small><strong>${euro(game.resources.funds)}</strong></div><div><small>Fondo elettorale</small><strong>${euro(outlook.fund)}</strong></div><div><small>Riserva</small><strong>${euro(outlook.reserve)}</strong></div><div><small>Beni</small><strong>${euro(outlook.assets)}</strong></div><div><small>Debito</small><strong class="${outlook.debt ? 'out' : ''}">${outlook.debt ? '−' : ''}${euro(outlook.debt)}</strong></div><div class="is-total"><small>Patrimonio netto</small><strong>${euro(outlook.netWorth)}</strong></div></div>
    <div class="invest-grid">${cards}</div>
    <div class="fund-box">${artTile('ballot', '#C4574A', 'sm')}<div><strong>Fondo elettorale vincolato</strong><small>Accantona ora: all’avvio della prossima campagna il fondo passa ai candidati e i donatori aggiungono il 15%. Non conta come spesa.</small></div><div class="fund-actions">${fundButtons}</div></div>
    <div class="fund-box">${artTile('wallet', '#4C8F6B', 'sm')}<div><strong>Riserva di emergenza</strong><small>Soldi tenuti da parte: pagano per primi gli imprevisti (cause, guasti, un donatore che si ritira) e coprono il debito prima degli interessi. Si possono riprendere in ogni momento; massimo ${euro(RESERVE.cap)}. Mantenimento dei beni: ${euro(outlook.upkeep)}/sett.</small></div><div class="fund-actions">${reserveButtons}</div></div>`;
}

// Funds between the politician and the party: two separate pots, every movement in both registers. Ask the treasury (by rank, approval when the rule says so) or pay into it.
const TRANSFER_STATUS = { 'in-attesa': ['in attesa', 'rischio'], approvata: ['approvata', 'solida'], rifiutata: ['respinta', 'crisi'], eseguito: ['eseguito', 'solida'] };
// Two arrows, one per direction: from the party to the politician (down-left, green) and from the politician to the party (up-right, gold).
const FLOW_ICON = {
  request: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 7 7 17"/><path d="M17 17H7V7"/></svg>',
  give: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>'
};
function transfersPanel(game) {
  const org = game.party?.org;
  if (!org) return '<p class="quiet-copy">Senza un partito non c’è una tesoreria con cui scambiare fondi: i tuoi fondi restano tuoi.</p>';
  const ended = game.status === 'ended';
  const rules = partyRequestRules(game);
  const funds = game.resources.funds, treasury = org.treasury.balance;
  const askOff = amount => ended || !rules.allowed || amount > rules.cap;
  const giveOff = amount => ended || amount > funds;
  const chip = (kind, amount, off) => `<button class="chip-button tr-chip" data-transfer-${kind}="${amount}" ${off ? `disabled title="${esc(ended ? 'Carriera conclusa.' : kind === 'request' ? (rules.allowed ? `Oltre il limite di ${euro(rules.cap)} per volta.` : rules.reason) : `Hai in cassa ${euro(funds)}.`)}"` : ''}>${euro(amount)}</button>`;
  const ask = TRANSFERS.presets.map(amount => chip('request', amount, askOff(amount))).join('');
  const give = TRANSFERS.presets.map(amount => chip('give', amount, giveOff(amount))).join('');
  const rule = !rules.allowed ? esc(rules.reason) : rules.approval ? `Con il tuo ruolo puoi chiedere fino a ${euro(rules.cap)} per volta; risponde la direzione alla chiusura della settimana e non è garantito.` : `Il segretario dispone direttamente, fino a ${euro(rules.cap)} per volta (un quarto della tesoreria).`;
  const askMode = !rules.allowed ? ['Non disponibile', 'off'] : rules.approval ? ['Serve l’approvazione della direzione', 'wait'] : ['Disposizione diretta', 'ok'];
  const giveBlock = !ended && funds < TRANSFERS.min ? `Non hai fondi sufficienti: servono almeno ${euro(TRANSFERS.min)}.` : '';
  const rows = (game.finance.transfers ?? []).slice(0, 8).map(item => {
    const [word, kind] = TRANSFER_STATUS[item.status] ?? [item.status, 'calo'];
    const fromParty = item.direction === 'dal-partito';
    return `<li class="tr-row ${fromParty ? 'is-request' : 'is-give'}"><span class="tr-row-ico">${FLOW_ICON[fromParty ? 'request' : 'give']}</span><span class="tr-row-main"><strong>${fromParty ? 'Dal partito a te' : 'Da te al partito'}</strong><small>${item.week ? `Settimana ${item.week} · ` : ''}${esc(item.note ?? '')}${Number.isFinite(item.treasuryAfter) ? ` · tesoreria ${euro(item.treasuryAfter)}, tuoi fondi ${euro(item.fundsAfter)}` : ''}</small></span><b class="${fromParty ? 'pos' : 'neg'}">${fromParty ? '+' : '−'}${euro(item.amount)}</b>${stateBadge(kind, word)}</li>`;
  }).join('');
  const op = (kind, { dir, title, tag, tagTone, note, facts, chips, field, button, off, reason }) => `<section class="tr-op is-${kind}" aria-label="${esc(title)}">
      <header><span class="tr-op-ico">${FLOW_ICON[kind]}</span><div><span class="tr-dir">${dir}</span><h3>${esc(title)}</h3></div><span class="tr-tag tone-${tagTone}">${esc(tag)}</span></header>
      <p class="tr-note">${note}</p>
      <dl class="tr-facts">${facts.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
      ${reason ? `<p class="tr-reason" role="status">${reason}</p>` : ''}
      <div class="tr-presets" role="group" aria-label="${esc(field.group)}">${chips}</div>
      <div class="tr-custom"><label>Un’altra cifra (€)<input type="number" inputmode="numeric" min="${TRANSFERS.min}" step="10" placeholder="importo" data-transfer-custom="${kind}" ${off ? 'disabled' : ''} /></label><button class="${kind === 'request' ? 'primary-button' : 'secondary-button'} tr-go" data-transfer-${kind}="custom" ${off ? 'disabled' : ''}>${button}</button></div>
    </section>`;
  return `<div class="transfers">
    <div class="tr-balances" role="group" aria-label="Saldi">
      <article class="tr-balance is-personal"><span class="tr-balance-ico">${glyph('wallet', 22)}</span><div><small>I tuoi fondi</small><strong>${euro(funds)}</strong><em>per campagne, staff e spese tue</em></div></article>
      <div class="tr-link" aria-hidden="true"><span class="tr-link-to-you">${FLOW_ICON.request}</span><span class="tr-link-to-party">${FLOW_ICON.give}</span></div>
      <article class="tr-balance is-treasury"><span class="tr-balance-ico">${glyph('flag', 22)}</span><div><small>Tesoreria del partito</small><strong>${euro(treasury)}</strong><em>cassa comune del partito</em></div></article>
    </div>
    <div class="tr-ops">
      ${op('request', { dir: 'DAL PARTITO → A TE', title: 'Richiedi fondi al partito', tag: askMode[0], tagTone: askMode[1], note: rule, facts: rules.allowed ? [['Massimo per volta', euro(rules.cap)], ['Risposta', rules.approval ? 'alla chiusura della settimana' : 'subito'], ['Esito', rules.approval ? 'non garantito' : 'garantito']] : [['Massimo per volta', '—']], chips: ask, field: { group: 'Importo da richiedere' }, button: 'Richiedi', off: ended || !rules.allowed, reason: !rules.allowed ? esc(rules.reason) : '' })}
      ${op('give', { dir: 'DA TE → AL PARTITO', title: 'Versa fondi al partito', tag: 'Subito', tagTone: 'ok', note: 'Dai tuoi fondi alla tesoreria, subito, mai più di quanto hai in cassa. Le quote di tesseramento restano entrate del partito: non passano da qui.', facts: [['Massimo', euro(funds)], ['Risposta', 'subito'], ['Esito', 'garantito']], chips: give, field: { group: 'Importo da versare' }, button: 'Versa', off: ended, reason: giveBlock })}
    </div>
    <p class="tr-diff"><strong>Richiesta o versamento?</strong> La richiesta porta denaro dalla tesoreria ai tuoi fondi e dipende dal tuo ruolo; il versamento porta denaro dai tuoi fondi alla tesoreria ed è immediato.</p>
    <div class="tr-history"><h3>Storico dei trasferimenti</h3>${rows ? `<ul class="transfers-register">${rows}</ul>` : '<p class="quiet-copy">Nessun trasferimento finora.</p>'}</div>
    <p class="parliament-note">Importi di gioco: nessun pagamento reale. Ogni trasferimento compare nel registro dei tuoi fondi e in quello della tesoreria, per lo stesso importo, una volta sola.</p>
  </div>`;
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
    ${foldPanel({ id: 'fin-andamento', tone: 'azzurro', icon: 'chart', title: 'Bilancio e andamento', summary: `${esc(euro(game.resources.funds))} in cassa · ${esc(signed(outlook.net, 0))} €/sett.`, body: `<div class="society-grid">
      ${panel('FLUSSI', 'Entrate e uscite, settimana per settimana', flowChart(weeks) + `<details class="poll-table"><summary>Tabella dei dati</summary><div class="poll-table-scroll"><table><thead><tr><th>Settimana</th><th>Entrate</th><th>Uscite</th><th>Saldo</th></tr></thead><tbody>${history.map(item => `<tr><th>S${item.week}</th><td>${euro(item.income)}</td><td>${euro(item.expense)}</td><td>${euro(item.balance)}</td></tr>`).join('')}</tbody></table></div></details>`)}
      ${panel('SALDO', 'Cassa nel tempo', lineChart({ series: [{ label: 'Saldo in cassa', short: 'Saldo', color: SERIES[0], values: history.map(item => item.balance), emphasis: true }, ...(history.some(item => item.debt) ? [{ label: 'Debito', color: SERIES[7], values: history.map(item => item.debt) }] : [])], labels: history.map(item => `S${item.week}`), tips: history.map(item => `Settimana ${item.week}`), unit: ' €', digits: 0, min: 0, ariaLabel: 'Saldo in cassa per settimana' }))}
    </div>` })}
    ${foldPanel({ id: 'fin-entrate-uscite', tone: 'oro', icon: 'scales', title: 'Entrate e uscite', summary: `Spese fisse ${esc(euro(outlook.recurring))}/sett.`, body: `${panel('BILANCIO SETTIMANALE', 'Le tue spese ricorrenti', budgetControls(game) + '<p class="parliament-note">Le scelte valgono dalla prossima chiusura di settimana. Se la cassa non basta, la differenza diventa debito; oltre 2.500 € scatta una crisi finanziaria.</p>', `<span class="hq-count">${euro(outlook.recurring)}/sett.</span>`)}
      <div class="society-grid">
        ${panel('RIPARTIZIONE DEL BUDGET', 'Come si divide la spesa settimanale', allocationPanel(game))}
        ${panel(`ANNO ${esc(finance.year ?? '')}`, 'Da dove arrivano e dove vanno', `<div class="split-breakdown"><div><small>ENTRATE</small>${year.income.length ? breakdown(year.income, { format: euro }) : '<p class="quiet-copy">—</p>'}</div><div><small>USCITE</small>${year.expense.length ? breakdown(year.expense, { format: euro }) : '<p class="quiet-copy">—</p>'}</div></div>`)}
      </div>` })}
    ${foldPanel({ id: 'fin-investimenti', tone: 'verde', icon: 'briefcase', title: 'Investimenti e patrimonio', summary: 'Cosa possiedi e dove investire', body: panel('INVESTIMENTI E PATRIMONIO', 'Cosa possiedi e dove investire', investmentsPanel(game, outlook)) })}
    ${foldPanel({ id: 'fin-raccolte', tone: 'azzurro', icon: 'ballot', title: 'Raccolte fondi ed eventi', summary: 'Operazioni con un costo oggi e un esito domani', body: panel('RACCOLTE FONDI ED EVENTI', 'Operazioni con un costo oggi e un esito domani', operationsPanel(game, state)) })}
    ${foldPanel({ id: 'fin-registri', tone: 'viola', icon: 'book', title: 'Registri e storico', summary: `${finance.ledger.length ? `${Math.min(18, finance.ledger.length)} movimenti recenti` : 'nessun movimento'}${finance.annual.length ? ` · ${finance.annual.length} chiusure` : ''}`, body: `${panel('MOVIMENTI', 'Registro contabile', `<div class="ledger">${ledger || '<p class="quiet-copy">Nessun movimento.</p>'}</div>`)}${panel('BILANCI ANNUALI', 'Chiusure d’esercizio', annual)}` })}
    ${game.party?.org ? foldPanel({ id: 'fin-fondi-partito', tone: 'oro', icon: 'wallet', title: 'Fondi e partito', summary: 'Trasferimenti tra te e la tesoreria', body: panel('FONDI E PARTITO', 'Trasferimenti tra te e la tesoreria del partito', transfersPanel(game)) }) : panel('FONDI E PARTITO', 'Trasferimenti tra te e la tesoreria del partito', transfersPanel(game))}
    ${game.party?.org ? foldPanel({ id: 'fin-tesoreria', tone: 'corallo', icon: 'flag', title: 'Tesoreria del partito', summary: `${esc(euro(game.party.org.treasury.balance))} nelle casse`, body: renderTreasuryPanel(state) }) : ''}
    <p class="poll-footnote">Importi di gioco: non corrispondono a indennità, rimborsi o bilanci reali di persone o partiti.</p>
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
