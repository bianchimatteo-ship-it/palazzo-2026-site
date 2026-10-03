import { activityProblem, CANDIDACY_RULES, costProblem, describeChoice, describeEffects, nextPartyRank, objectiveProgress, partyAdvancementOdds, situation, upcomingElections } from '../core/career-engine.js?v=20261003-1';
import { playerRoles } from '../core/roles.js?v=20261003-1';
import { activeMinisters, CHAMBERS, parliamentGroupFacts } from '../core/parliament-engine.js?v=20261003-1';
import { ACTIVITY_CATEGORIES, COMMUNICATION_STYLES, CURRENT_AREAS, PARTY_INVESTMENTS, PARTY_LINES, PARTY_RANKS, STAT_LABELS, WEEKLY_ACTIVITIES } from '../data/simulation/career-rules.js?v=20261003-1';
import { AREA_BY_ID, AREA_GROUPS, POLICY_AREAS } from '../data/simulation/policy-rules.js?v=20261003-1';
import { memoryBalance, MEMORY_KINDS } from '../core/career-engine.js?v=20261003-1';
import { careerLevelLabel } from '../data/regions.js?v=20261003-1';
import { advanceDays, formatDate } from '../core/time.js?v=20261003-1';
import { renderBarometerPanel } from './polls-mode.js?v=20261003-1';
import { artTile, CATEGORY_VISUALS, EVENT_ICONS, glyph, officeIcon } from './visuals.js?v=20261003-1';
import { ITALIAN_REGIONS } from '../data/regions.js?v=20261003-1';
import { societyMood } from '../core/society-engine.js?v=20261003-1';
import { financeOutlook } from '../core/finance-engine.js?v=20261003-1';
import { isPartyLeader, organOf } from '../core/organization-engine.js?v=20261003-1';
import { renderCountryCard, renderTerritoryCard } from './society-mode.js?v=20261003-1';
import { activeInstitutions, institutionLabel } from './local-mode.js?v=20261003-1';
import { renderFinanceCard } from './finance-mode.js?v=20261003-1';
import { renderContactsPanel, renderPartyCard } from './organization-mode.js?v=20261003-1';
import { stateBadge } from './charts.js?v=20261003-1';
import { illustration } from './illustrations.js?v=20261003-1';
import { SEGMENTS } from '../data/simulation/society-rules.js?v=20261003-1';
import { regionPriorities } from '../core/society-engine.js?v=20261003-1';

const weeks = count => `${count} ${count === 1 ? 'settimana' : 'settimane'}`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (value, digits = 1) => Number(value ?? 0).toLocaleString('it-IT', { maximumFractionDigits: digits });
const euro = value => `${Number(value ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })} €`;
const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${num(Math.abs(value))}`;
const shortDate = date => formatDate(date, { day: 'numeric', month: 'short' });
const arrow = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const weeksUntil = (from, to) => Math.max(0, Math.ceil((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 604800000));
const STAT_ORDER = ['popularity', 'reputation', 'notoriety', 'influence', 'experience'];

export function gameContext(state) {
  const player = state.dataset.politicians.find(item => item.id === state.career.playerId) ?? null;
  const stats = Object.fromEntries(state.dataset.statistics.filter(item => item.subjectId === player?.id).map(item => [item.metric, item.value]));
  const units = Object.fromEntries(state.dataset.statistics.filter(item => item.subjectId === player?.id).map(item => [item.metric, item.unit]));
  const ctx = { game: state.game, stats, parliament: state.parliament };
  const env = { career: state.career, offices: state.dataset.offices, campaign: state.campaign, player, currentDate: state.clock.currentDate };
  return { player, stats, units, ctx, env, sit: situation(ctx, env) };
}
function costChips(cost = {}) {
  const chips = [];
  if (cost.ap) chips.push(`${cost.ap} ${cost.ap === 1 ? 'giorno' : 'giorni'}`);
  if (cost.funds) chips.push(euro(cost.funds));
  if (cost.capital) chips.push(`${cost.capital} cap.`);
  return chips.length ? chips.map(chip => `<span>${esc(chip)}</span>`).join('') : '<span>Gratis</span>';
}
function meter(value, tone = '') {
  return `<b class="hq-bar ${tone}"><i style="width:${Math.max(0, Math.min(100, Number(value) || 0))}%"></i></b>`;
}

// ---------- Home: the command centre ----------
// Who the player is, as a compact identity: avatar and party logo, name, office, territory and status.
// The councils (and the European Parliament) where the player holds a seat: one tap from the Home.
const institutionLinks = state => { const active = activeInstitutions(state); return active.length ? `<p class="hq-institutions">${active.map(inst => `<button class="text-link" data-nav="territori" data-scroll="istituzione-${esc(inst.kind)}">${glyph(inst.kind === 'europa' ? 'globe' : inst.kind === 'regione' ? 'map' : 'town', 14)} ${esc(institutionLabel(inst))} →</button>`).join('')}</p>` : ''; };
function identity(state, gc, options) {
  const { player, stats } = gc;
  const game = state.game;
  const office = state.dataset.offices.find(item => item.id === player?.roleId);
  const territory = state.dataset.territories.find(item => item.id === player?.territoryId)?.name ?? player?.region ?? 'Italia';
  const partyChip = game.party ? `${esc(options.partyName || game.party.label || 'Partito')} · ${esc(game.party.rankTitle)}${game.party.org ? ` · ${esc(organOf(game.party).label)}` : ''}` : 'Indipendente';
  const status = game.flags?.comebackFrom ? ['Traversata nel deserto', 'danger'] : (stats.reputation ?? 50) < 20 || (game.party && game.party.support < 25) ? ['Carriera in pericolo', 'danger'] : ['Carriera attiva', 'ok'];
  return `<div class="hq-identity"><span class="section-kicker">IL TUO POLITICO · SETTIMANA ${game.week.index}</span><div class="hq-identity-row"><div class="hero-avatar">${player ? esc(player.firstName[0] + player.lastName[0]) : 'P'}</div>${options.partyLogo ? `<img class="hero-party-logo" src="${esc(options.partyLogo)}" alt="${esc(`Logo di ${options.partyName ?? 'partito'}`)}" />` : ''}<div><h1>${player ? esc(player.displayName) : 'Nessun politico'}</h1><p>${office ? `<span class="hq-office">${glyph(officeIcon(office), 15)}</span>${esc(office.endDate ? `${office.title} · concluso` : office.title)}` : 'Nessun incarico'} <span>·</span> ${esc(territory)}</p><div class="hq-chips"><span>${partyChip}</span><span>${esc(careerLevelLabel(state.career.currentLevel ?? state.career.initialLevel) ?? 'Percorso')}</span><span title="Difficoltà scelta all’inizio">Difficoltà: ${esc(({ facile: 'Facile', normale: 'Normale', difficile: 'Difficile' })[game.difficulty] ?? 'Normale')}</span><span class="hq-status ${status[1]}">${status[0]}</span></div>${institutionLinks(state)}</div></div></div>`;
}
// The personal indicators, with their change this week.
function statMeters(state, gc) {
  const { stats } = gc;
  const game = state.game;
  const deltas = game.lastReport?.deltas ?? {};
  const live = Object.fromEntries(Object.keys(STAT_LABELS).map(metric => [metric, (stats[metric] ?? 0) - (game.weekStartStats?.[metric] ?? stats[metric] ?? 0)]));
  const delta = metric => live[metric] || deltas[metric] || 0;
  return `<div class="hq-meters">${STAT_ORDER.map(metric => `<div class="hq-meter"><span>${STAT_LABELS[metric]}</span><strong>${num(stats[metric] ?? 0)}</strong>${meter(stats[metric])}<em class="${delta(metric) > 0 ? 'up' : delta(metric) < 0 ? 'down' : ''}">${delta(metric) ? `${signed(delta(metric))} in settimana` : 'stabile'}</em></div>`).join('')}</div>`;
}
// The consensus shown on the Home: the player's own, or the party's when the career only tracks that one.
function consensusOf(state, gc) {
  const { player, stats, units } = gc;
  const game = state.game;
  const partyConsensus = !('consensus' in stats) ? state.dataset.statistics.find(item => item.metric === 'consensus' && item.subjectId === (player?.partyId ?? state.career.partyId)) : null;
  const change = (stats.consensus ?? 0) - (game.weekStartStats?.consensus ?? stats.consensus ?? 0) || game.lastReport?.deltas?.consensus || 0;
  return { value: partyConsensus?.value ?? stats.consensus ?? 0, unit: partyConsensus?.unit ?? units.consensus, note: partyConsensus ? 'consenso del partito' : change ? `${signed(change)} questa settimana` : 'stabile questa settimana' };
}
// The main action of the moment: the one thing to do first, with the reason, and closing the week always at hand.
function mainAction(state) {
  const game = state.game;
  const advance = primary => `<button class="${primary ? 'primary-button' : 'secondary-button'} hq-close-week" data-action="advance" ${game.status === 'ended' ? 'disabled' : ''}>${state.campaign?.status === 'active' ? 'Avanza la campagna' : 'Chiudi la settimana'} ${arrow}</button>`;
  const button = (attrs, label) => `<button class="primary-button" ${attrs}>${label} ${arrow}</button>`;
  const urgent = game.inbox.filter(item => ['urgente', 'situazione'].includes(item.kind));
  const open = upcomingElections(game).find(item => item.status === 'open');
  let next;
  if (game.status === 'ended') next = ['CARRIERA CONCLUSA', 'La partita è ferma', 'Dal menu principale puoi caricare un salvataggio o iniziare una nuova carriera.', ''];
  else if (state.campaign?.status === 'active') next = ['CAMPAGNA IN CORSO', state.campaign.electionLabel ?? 'Campagna elettorale', 'Ogni giorno di campagna conta: attività, alleanze ed eventi si decidono nella centrale elettorale.', button('data-nav="elezioni"', 'Vai alla campagna')];
  else if (urgent.length) next = ['DA DECIDERE SUBITO', urgent[0].title, urgent.length > 1 ? `E altre ${urgent.length - 1} decisioni urgenti: se non scegli entro fine settimana si applica la scelta più passiva.` : 'Se non scegli entro fine settimana si applica la scelta più passiva.', button('data-scroll="hq-inbox"', 'Decidi ora')];
  else if (open) next = ['CANDIDATURE APERTE', open.label, `La finestra si chiude il ${shortDate(open.windowClosesAt)}: fondi, preparazione e sostegno del partito entrano nella campagna.`, button('data-nav="elezioni"', 'Candidati')];
  else if (game.inbox.length) next = ['DECISIONI DELLA SETTIMANA', `${game.inbox.length} ${game.inbox.length === 1 ? 'decisione' : 'decisioni'} da prendere`, 'Ogni scelta ha costi ed effetti diversi; senza scelta vale quella indicata sotto ciascuna.', button('data-scroll="hq-inbox"', 'Rivedi le decisioni')];
  else if (game.week.ap > 0) next = ['GIORNI DA USARE', `Hai ancora ${game.week.ap} ${game.week.ap === 1 ? 'giorno' : 'giorni'} questa settimana`, 'Territorio, media, partito e Parlamento: ogni attività costa giorni e fondi e muove i tuoi numeri.', button('data-scroll="hq-planner"', 'Pianifica la settimana')];
  else next = ['SETTIMANA COMPLETA', 'Hai usato tutti i giorni', 'Chiudi la settimana per vedere cosa è cambiato: sondaggi, eventi e conseguenze arrivano con la nuova settimana.', ''];
  const [kicker, title, why, primary] = next;
  return `<div class="hqc-action"><span class="section-kicker">${glyph('target', 14)} ${esc(kicker)}</span><strong>${esc(title)}</strong><p>${esc(why)}</p><div class="hqc-action-buttons">${primary}${game.status === 'ended' ? '' : advance(!primary)}</div></div>`;
}
// 1. Where you are: the politician, the country this week and the main action.
function commandHeader(state, gc, options) {
  return `<section class="hqc-head" aria-label="La tua situazione">
    ${illustration('palazzo', 'hq-hero-art')}
    <div class="hqc-who">${identity(state, gc, options)}${situationBar(state)}</div>
    ${mainAction(state)}
    ${statMeters(state, gc)}
  </section>`;
}
// 2. The resources of the week: days, funds and political capital, then consensus and electoral preparation.
function resourcesBar(state, gc) {
  const game = state.game;
  const dots = Array.from({ length: game.week.maxAp }, (_, index) => `<i class="${index < game.week.ap ? 'on' : ''}"></i>`).join('');
  const outlook = game.finance ? financeOutlook(game) : null;
  const consensus = consensusOf(state, gc);
  const tile = (label, value, note, extra = '', page = '') => `<div class="hqc-resource">${page ? `<button class="hqc-resource-link" data-nav="${page}" aria-label="Apri ${esc(label.toLowerCase())}">` : '<div class="hqc-resource-link">'}<small>${esc(label)}</small><strong>${value}</strong>${extra}<em>${note}</em>${page ? '</button>' : '</div>'}</div>`;
  return `<section class="hqc-resources" aria-label="Risorse della settimana">
    ${tile('Giorni disponibili', `${game.week.ap}<i>/${game.week.maxAp}</i>`, 'ogni attività o decisione ne usa', `<span class="hq-dots" aria-label="${game.week.ap} giorni su ${game.week.maxAp}">${dots}</span>`, 'calendario')}
    ${tile('Fondi', euro(game.resources.funds), outlook ? `<b class="${outlook.net < 0 ? 'down' : 'up'}">${outlook.net >= 0 ? '+' : '−'}${euro(Math.abs(outlook.net))}/sett.</b>` : 'per attività e campagne', '', 'finanze')}
    ${tile('Capitale politico', `${num(game.resources.politicalCapital, 0)}<i>/100</i>`, 'per trattative, incarichi e decisioni', meter(game.resources.politicalCapital, 'gold'), 'carriera')}
    ${tile('Consenso', `${num(consensus.value)}${consensus.unit === '%' ? '%' : ''}`, esc(consensus.note), '', 'sondaggi')}
    ${tile('Preparazione elettorale', `${num(game.prep, 0)}%`, 'entra nella prossima campagna', meter(game.prep, 'gold'), 'elezioni')}
  </section>`;
}
// A block of the Home with its heading: what it is and, in one line, what the player can do there.
function band(kicker, title, lead, body, { id = '', className = '', extra = '' } = {}) {
  return `<section class="hqc-band ${className}" ${id ? `id="${id}"` : ''}><header class="hqc-band-head"><div><span class="section-kicker">${esc(kicker)}</span><h2>${esc(title)}</h2>${lead ? `<p>${esc(lead)}</p>` : ''}</div>${extra}</header>${body}</section>`;
}
// On phones the longest lists show their first items; “Mostra tutte” opens the rest (the choice is remembered).
// Computers always show everything. fold: the list's opening tag gets the classes, the button follows the list.
function folded(html, listClass, key, count, limit, noun, expanded = {}) {
  if (count <= limit) return html;
  const open = Boolean(expanded[key]);
  return html.replace(`class="${listClass}"`, `class="${listClass} hqc-fold fold-${limit}${open ? '' : ' is-folded'}"`) + `<button type="button" class="hqc-more" data-home-expand="${esc(key)}" aria-expanded="${open}">${open ? 'Mostra meno' : `Mostra ${noun} (${count})`}</button>`;
}
// 3. What to do: the staff's priorities and the decisions of the week.
function prioritiesBlock(state, gc, expanded) {
  const game = state.game;
  const priorities = briefing(state, gc, { bare: true });
  const count = (priorities.match(/class="briefing-item /g) ?? []).length;
  return `${band('PRIORITÀ DELLO STAFF', 'Cosa conta di più', 'Le questioni più urgenti della settimana, in ordine di importanza, con il posto dove agire.', priorities ? folded(priorities, 'briefing-grid', 'priorita', count, 2, 'tutte le priorità', expanded) : '<p class="quiet-copy">Nessuna emergenza: puoi dedicare la settimana a costruire consenso e rapporti.</p>', { className: 'hqc-priorities' })}
    ${band('DECISIONI DELLA SETTIMANA', 'Da decidere', 'Ogni scelta mostra costo ed effetti; entro fine settimana, senza scelta, si applica quella indicata.', folded(renderInbox(state), 'hq-inbox-list', 'decisioni', game.inbox.length, 2, 'tutte le decisioni', expanded), { id: 'hq-inbox', className: 'hqc-decisions', extra: `<span class="hq-count" title="Decisioni in attesa">${game.inbox.length}</span>` })}`;
}
// 4. What is coming: the elections in the calendar (the first is the one that matters most), deadlines, next goal.
function upcomingBlock(state, gc, expanded) {
  const game = state.game;
  const rows = [];
  const party = game.party;
  if (party?.org && !party.org.founder) rows.push(['crown', 'Congresso del partito', `tra ${weeks(Math.max(0, party.org.congress.nextWeek - game.week.index))}`, 'partito']);
  for (const promise of (game.promises ?? []).filter(item => item.status === 'open').slice(0, 2)) rows.push(['target', `Promessa: ${promise.topic} in ${promise.region}`, `verifica tra ${weeks(Math.max(0, promise.dueWeek - game.week.index))}`, 'territori']);
  for (const law of (state.parliament?.laws ?? []).filter(item => !['approved', 'rejected', 'lapsed'].includes(item.stage)).slice(0, 2)) rows.push(['law', law.title, 'iter parlamentare in corso', 'leggi']);
  const pending = (game.pending ?? []).length;
  if (pending) rows.push(['clock', `${pending} ${pending === 1 ? 'conseguenza' : 'conseguenze'} in arrivo`, 'effetti ritardati di scelte passate', '']);
  const deadlines = rows.length ? folded(`<ul class="hqc-deadlines">${rows.map(([icon, title, when, page]) => `<li>${glyph(icon, 16)}<span><strong>${esc(title)}</strong><small>${esc(when)}</small></span>${page ? `<button class="text-link" data-nav="${page}" aria-label="Apri ${esc(title)}">${arrow}</button>` : `<button class="text-link" data-scroll="hq-consequences" aria-label="Vedi le conseguenze">${arrow}</button>`}</li>`).join('')}</ul>`, 'hqc-deadlines', 'scadenze', rows.length, 2, 'tutte le scadenze', expanded) : '<p class="quiet-copy">Nessun congresso, promessa o legge in scadenza.</p>';
  const goals = objectiveProgress(gc.ctx, gc.env).filter(item => item.available);
  const done = goals.filter(item => item.done).length;
  const next = goals.find(item => !item.done);
  const goal = `<div class="hqc-goal"><div class="hq-objective-head"><strong>${done} / ${goals.length}</strong>${meter(goals.length ? done / goals.length * 100 : 0, 'gold')}</div>${next ? `<p class="hq-next-goal"><small>PROSSIMO TRAGUARDO</small><strong>${esc(next.label)}</strong><span>${esc(next.detail)}</span></p>` : '<p class="hq-next-goal"><strong>Tutti i traguardi raggiunti.</strong></p>'}<button class="text-link" data-scroll="hq-deadlines">Tutti i traguardi ${arrow}</button></div>`;
  const calendar = renderElectionCalendar(state);
  const elections = (calendar.match(/class="hq-election /g) ?? []).length;
  return `${band('ELEZIONI IN CALENDARIO', 'Il prossimo voto', 'La prima è la più vicina: quando si aprono le candidature puoi candidarti dalla centrale elettorale.', folded(calendar, 'hq-elections', 'elezioni', elections, 1, 'tutte le elezioni', expanded), { className: 'hqc-elections', extra: '<button class="text-link" data-nav="elezioni">Elezioni</button>' })}
    ${band('SCADENZE', 'In arrivo', 'Congressi, promesse fatte ai cittadini, leggi in Aula e conseguenze delle scelte passate.', deadlines, { className: 'hqc-deadline-band', extra: '<button class="text-link" data-nav="calendario">Agenda</button>' })}
    ${band('TRAGUARDI', 'Obiettivi della carriera', 'Le tappe che misurano la tua crescita politica.', goal, { className: 'hqc-goals' })}`;
}
// 5. The whole picture: one card per area, a few numbers each, and the way into the section with every detail.
function summaryCard({ kicker, title, icon, color, lead, body, page, cta, more = '' }) {
  return `<article class="dash-card hqc-card" style="--dash:${color}"><header>${artTile(icon, color, 'sm')}<div><span class="section-kicker">${esc(kicker)}</span><h3>${title}</h3></div></header><p class="hqc-card-lead">${esc(lead)}</p><div class="hqc-card-body">${body}</div><footer>${page ? `<button class="secondary-button" data-nav="${page}">${esc(cta)} ${arrow}</button>` : ''}${more}</footer></article>`;
}
function summariesBlock(state, gc, expanded) {
  const game = state.game;
  const parliament = state.parliament;
  const seat = parliament?.player;
  const government = parliament?.government;
  const governing = ['active', 'crisis'].includes(government?.status);
  const openLaws = (parliament?.laws ?? []).filter(law => !['approved', 'rejected', 'lapsed'].includes(law.stage)).length;
  const group = seat ? parliament.chambers?.[seat.chamber]?.groups.find(item => item.groupId === seat.groupId) : null;
  const facts = rows => `<dl class="hqc-facts">${rows.filter(Boolean).map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
  const parliamentBody = facts([
    ['Governo', governing ? `${government.status === 'crisis' ? 'In crisi' : 'In carica'} · stabilità ${num(government.stability ?? 50, 0)}` : government?.status === 'awaiting-confidence' ? 'In attesa della fiducia' : government?.status === 'caretaker' ? 'Affari correnti' : government?.status === 'fallen' ? 'Caduto' : 'Nessun governo'],
    ['Il tuo seggio', seat ? esc(`${CHAMBERS[seat.chamber].shortLabel} · ${group?.officialName ?? 'gruppo da scegliere'}`) : 'Non siedi in Parlamento'],
    ['Leggi in corso', String(openLaws)]
  ]);
  const poll = state.world?.polls?.at(-1);
  const mine = state.world?.parties?.find(item => item.isPlayer);
  const share = mine ? poll?.results?.find(item => item.partyId === mine.id) : null;
  const election = upcomingElections(game)[0];
  const electionsBody = facts([
    share ? ['Il tuo partito', `${num(share.share, 1)}% <b class="${share.delta >= 0 ? 'up' : 'down'}">${share.delta >= 0 ? '+' : '−'}${num(Math.abs(share.delta), 1)}</b>`] : ['Sondaggi', poll ? `${esc(poll.institute)} · ${esc(shortDate(poll.date))}` : 'Nessun sondaggio'],
    election ? ['Prossimo voto', esc(`${election.label} · ${formatDate(election.electionDate)}`)] : ['Prossimo voto', 'Nessuna elezione in calendario'],
    ['Campagna', state.campaign?.status === 'active' ? 'In corso' : 'Nessuna campagna aperta']
  ]);
  const { roles, powers } = playerRoles(state);
  const goals = objectiveProgress(gc.ctx, gc.env).filter(item => item.available);
  const careerBody = `<div class="role-chips">${roles.slice(0, 3).map(([, label]) => `<span class="role-chip">${esc(label)}</span>`).join('')}</div>${facts([['Poteri disponibili', `${powers.filter(power => power.enabled).length} su ${powers.length}`], ['Traguardi', `${goals.filter(item => item.done).length} su ${goals.length}`]])}`;
  const media = state.society?.media;
  const headline = media?.coverage?.[0];
  const mediaBody = media ? facts([['Visibilità', `${num(media.visibility, 0)}/100`], ['Tono della stampa', `${media.sentiment > 5 ? 'Favorevole' : media.sentiment < -5 ? 'Ostile' : 'Neutro'} (${signed(media.sentiment)})`], headline ? ['Ultimo titolo', esc(headline.headline)] : null]) : '<p class="quiet-copy">Nessuna copertura.</p>';
  const relations = [...game.relations].sort((a, b) => a.value - b.value).slice(0, 3);
  const relationsBody = `<div class="hq-relations">${relations.map(item => `<div class="hq-relation"><span><strong>${esc(item.label)}</strong><small>${esc(item.kind)}</small></span><b>${num(item.value, 0)}</b>${meter(item.value, item.value < 30 ? 'danger' : item.value >= 65 ? 'good' : '')}</div>`).join('')}</div>`;
  const memory = memoryBalance(game);
  const memoryBody = memory.highlights.length ? facts([['Bilancio', `<b class="${memory.net >= 0 ? 'up' : 'down'}">${memory.net >= 0 ? '+' : '−'}${num(Math.abs(memory.net), 1)}</b> ${memory.net >= 0 ? 'a tuo favore' : 'contro di te'}`], ['Ricordo più pesante', esc(memory.highlights[0].text)]]) : '<p class="quiet-copy">Ancora nessun ricordo: leggi, promesse, crisi e rotture resteranno qui per anni.</p>';
  const cards = [
    summaryCard({ kicker: 'PAESE', title: 'Cittadini ed economia', icon: 'globe', color: '#2a78d6', lead: 'Umore, fiducia ed economia: cambiano con leggi, eventi e governo.', body: renderCountryCard(state), page: 'territori', cta: 'Territori e cittadini' }),
    summaryCard({ kicker: 'PARLAMENTO E GOVERNO', title: seat ? 'La tua posizione in Aula' : 'Le Camere', icon: 'dome', color: '#8e6cf0', lead: seat ? 'Voti, leggi, trattative e fiducia al governo.' : 'Osserva gruppi, governo e leggi; con un seggio puoi votare e proporre.', body: parliamentBody, page: 'parlamento', cta: 'Apri il Parlamento', more: governing || government ? '<button class="text-link" data-nav="governo">Governo</button>' : '' }),
    summaryCard({ kicker: 'PARTITO', title: game.party ? esc(game.party.label) : 'Indipendente', icon: 'flag', color: 'var(--party-accent)', lead: game.party ? 'Sostegno interno, correnti, sezioni e tesoreria.' : 'Aderisci a un partito per candidature di lista e incarichi interni.', body: renderPartyCard(state), page: 'partito', cta: 'Apri il partito' }),
    summaryCard({ kicker: 'ELEZIONI E SONDAGGI', title: 'Voto e consenso', icon: 'ballot', color: '#eb6834', lead: 'Candidature, campagne, risultati e l’andamento dei partiti.', body: electionsBody, page: 'elezioni', cta: 'Centrale elettorale', more: '<button class="text-link" data-nav="sondaggi">Sondaggi</button>' }),
    summaryCard({ kicker: 'CARRIERA', title: 'Ruoli e traguardi', icon: 'route', color: '#c0a166', lead: 'I tuoi incarichi, cosa ti permettono e il prossimo passo.', body: careerBody, page: 'carriera', cta: 'Apri la carriera' }),
    summaryCard({ kicker: 'TERRITORIO', title: esc(game.place.region || 'Territorio'), icon: 'map', color: '#1baf7a', lead: 'Servizi, problemi e soddisfazione nella tua regione.', body: renderTerritoryCard(state), page: 'territori', cta: 'Apri il territorio' }),
    summaryCard({ kicker: 'MEDIA', title: 'Stampa e visibilità', icon: 'news', color: '#e34948', lead: 'Come ti raccontano: pesa su reputazione e notorietà ogni settimana.', body: mediaBody, page: 'sondaggi', cta: 'Media e sondaggi', more: '<button class="text-link" data-scroll="hq-news">Notizie</button>' }),
    summaryCard({ kicker: 'FINANZE', title: 'Il tuo comitato', icon: 'wallet', color: '#eda100', lead: 'Entrate, spese fisse, investimenti e fondo elettorale.', body: renderFinanceCard(state), page: 'finanze', cta: 'Apri le finanze' }),
    summaryCard({ kicker: 'RELAZIONI', title: 'Chi conta per te', icon: 'users', color: '#2fa39a', lead: 'I rapporti più fragili: pesano su candidature, incarichi e voti.', body: relationsBody, page: '', cta: '', more: '<button class="secondary-button" data-scroll="hq-relations">Tutte le relazioni ' + arrow + '</button>' }),
    summaryCard({ kicker: 'MEMORIA POLITICA', title: 'Quello che non si dimentica', icon: 'book', color: '#9aa7a1', lead: 'Scelte che pesano ancora su elezioni, alleanze e rapporti.', body: memoryBody, page: 'carriera', cta: 'Memoria e cronologia' })
  ];
  // The cards flow in the board's columns with the other blocks; on phones the first four, then “Mostra tutte”.
  const open = Boolean(expanded.aree);
  return `<header class="hqc-overview hqc-band-head"><div><span class="section-kicker">IL QUADRO COMPLETO</span><h2>Tutte le aree in breve</h2><p>Un riepilogo per area: apri la sezione per vedere i dettagli e agire.</p></div></header>${cards.map((card, index) => index >= 4 && !open ? card.replace('class="dash-card hqc-card"', 'class="dash-card hqc-card is-folded-card"') : card).join('')}<button type="button" class="hqc-more hqc-more-cards" data-home-expand="aree" aria-expanded="${open}">${open ? 'Mostra meno aree' : `Mostra tutte le aree (${cards.length})`}</button>`;
}
// Details of the week kept on the Home, folded: open one to read or act without leaving the page.
function drawer(id, kicker, title, lead, body, { badge = '', wide = false } = {}) {
  return `<details class="hqc-drawer ${wide ? 'is-wide' : ''}" id="${id}" data-remember="home-${id}"><summary><span class="hqc-drawer-title"><span class="section-kicker">${esc(kicker)}</span><strong>${esc(title)}</strong><small>${esc(lead)}</small></span>${badge ? `<span class="hq-count">${esc(badge)}</span>` : ''}<span class="hqc-drawer-toggle" aria-hidden="true">${arrow}</span></summary><div class="hqc-drawer-body">${body}</div></details>`;
}
function detailsBlock(state, gc, options) {
  const game = state.game;
  const activities = WEEKLY_ACTIVITIES.filter(activity => !activityProblem(gc.ctx, gc.env, activity)).length;
  const drawers = [
    drawer('hq-planner', 'AGENDA DEL POLITICO', 'Come usi la settimana', 'Attività su territorio, media, partito e Parlamento: costi, effetti e rischi.', planner(state, gc), { badge: `${game.week.ap} giorni · ${activities} attività`, wide: true }),
    drawer('hq-news', 'REDAZIONE · SIMULATA', 'Notizie della settimana', 'Cronaca politica, titoli dei giornali e il tuo diario, con filtri.', renderNewsroom(state, options.newsFilter), { wide: true }),
    drawer('hq-consequences', 'CAUSE ED EFFETTI', 'Le conseguenze delle scelte', 'Catene di eventi, conseguenze in arrivo e bilancio della settimana.', consequencesPanel(state)),
    drawer('hq-why', 'PERCHÉ È CAMBIATO', 'Da dove vengono i tuoi numeri', 'Le cause di ogni variazione di consenso e indicatori.', renderWhyPanel(state)),
    drawer('hq-roles', 'RUOLI E POTERI', 'Cosa puoi fare adesso', 'Ogni potere sbloccato dai tuoi incarichi e cosa serve per gli altri.', renderRolesPanel(state)),
    state.world ? drawer('hq-polls', 'SONDAGGI · SIMULATI', 'Barometro e cronaca', 'L’ultimo sondaggio del tuo partito e i fatti della settimana.', `${renderBarometerPanel(state)}<button class="text-link" data-nav="sondaggi">Tutti i sondaggi ${arrow}</button>`) : '',
    drawer('hq-parliament', 'PARLAMENTO E GOVERNO', gc.sit.seat ? 'La tua posizione in Aula' : 'Le Camere', 'Gruppo, posizione, sostegno, governo e leggi in corso.', parliamentPanel(state)),
    drawer('hq-deadlines', 'SCADENZE E OBIETTIVI', 'Elezioni, congressi, promesse', 'Il calendario elettorale completo, le scadenze e tutti i traguardi.', `${deadlinesPanel(state, gc)}<button class="text-link" data-nav="calendario">Apri l’agenda ${arrow}</button>`),
    drawer('hq-memory', 'MEMORIA POLITICA', 'Quello che non si dimentica', 'I ricordi che pesano ancora e quanto a lungo.', renderMemoryPanel(state)),
    drawer('hq-relations', 'RELAZIONI', 'Chi conta per te', 'Rapporti con leadership, rivali, alleati e parlamentari reali.', relationsPanel(state) + `<div class="home-section-heading hq-sub-heading"><div><span class="section-kicker">PARLAMENTARI REALI</span></div><button class="text-link" data-nav="parlamento">Tutti</button></div>${renderContactsPanel(state, { compact: true })}`)
  ].filter(Boolean);
  return band('APPROFONDIMENTI', 'Dettagli della settimana', 'Aprili quando ti servono: restano aperti come li lasci.', `<div class="hqc-drawers">${drawers.join('')}</div>`, { className: 'hqc-details' });
}

export function renderInbox(state, { compact = false } = {}) {
  const game = state.game;
  if (!game.inbox.length) return `<p class="quiet-copy">Nessuna decisione in sospeso. Usa i giorni della settimana oppure chiudila.</p>`;
  const kinds = { evento: 'EVENTO', appuntamento: 'APPUNTAMENTO', urgente: 'URGENTE', situazione: 'DALLA SITUAZIONE' };
  // The decisions of the situation come first; appointments and events follow in the order of the days of the week.
  const ordered = game.inbox.map((item, index) => ({ item, index })).sort((a, b) => (a.item.day ?? -1) - (b.item.day ?? -1) || a.index - b.index).map(entry => entry.item);
  const dayLabel = item => Number.isInteger(item.day) && game.week?.startedAt ? new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(`${advanceDays(game.week.startedAt, item.day)}T12:00:00`)) : '';
  return `<div class="hq-inbox-list">${ordered.map(item => {
    const fallback = item.choices.find(choice => choice.id === item.defaultChoice)?.label ?? '';
    const choices = item.choices.map(choice => {
      const info = describeChoice(item, choice.id);
      const problem = costProblem(game, choice.cost ?? {}) || (choice.requires === 'seat' && !state.parliament?.player?.groupId ? 'Serve un seggio con un gruppo parlamentare.' : choice.requires === 'party' && !game.party ? 'Serve un partito.' : null);
      return `<button class="hq-choice" data-agenda-item="${esc(item.id)}" data-agenda-choice="${esc(choice.id)}" ${problem || game.status === 'ended' ? `disabled title="${esc(problem)}"` : ''}><strong>${esc(choice.label)}</strong><span class="hq-cost">${costChips(choice.cost ?? {})}</span>${info.effects || info.risk ? `<small>${esc([info.effects, info.risk].filter(Boolean).join(' · '))}</small>` : ''}${problem ? `<em>${esc(problem)}</em>` : ''}</button>`;
    }).join('');
    const tone = item.kind === 'urgente' ? '#e34948' : item.kind === 'situazione' ? '#eb6834' : item.kind === 'evento' ? '#c0a166' : '#1baf7a';
    return `<article class="hq-card kind-${esc(item.kind)}"><div class="hq-card-head">${artTile(EVENT_ICONS[item.templateId] ?? CATEGORY_VISUALS[item.category]?.icon ?? 'star', tone)}<div><header><span class="hq-tag">${kinds[item.kind] ?? 'DECISIONE'}</span>${dayLabel(item) ? `<span class="hq-day">${esc(dayLabel(item))}</span>` : ''}<small>Entro fine settimana · senza scelta: “${esc(fallback)}”</small></header><h3>${esc(item.title)}</h3>${compact ? '' : `<p>${esc(item.body)}</p>`}</div></div><div class="hq-choices">${choices}</div></article>`;
  }).join('')}</div>`;
}

function planner(state, gc) {
  const { ctx, env } = gc;
  const game = state.game;
  const parliament = state.parliament;
  const targets = {
    current: (game.party?.currents ?? []).map(item => [item.id, `${item.label} · ${num(item.value ?? item.relation, 0)}`]),
    character: game.relations.map(item => [item.id, `${item.label} · ${num(item.value, 0)}`]),
    group: parliament?.player ? (parliament.chambers[parliament.player.chamber]?.groups ?? []).filter(group => group.groupId !== parliament.player.groupId).map(group => [group.groupId, `${group.officialName} · ${num(parliament.relations?.[group.groupId]?.value ?? 50, 0)}`]) : [],
    region: [...ITALIAN_REGIONS].sort((a, b) => (b === game.place.region) - (a === game.place.region)).map(name => [name, `${name}${game.party?.org?.sections.some(section => section.region === name) ? ' · rilancia la sezione' : ' · nuova sezione'}`]),
    contact: (game.contacts ?? []).map(item => [item.person.id, `${item.person.fullName} · ${num(item.relation, 0)}`]),
    segment: SEGMENTS.map(segment => [segment.id, `${segment.label} · soddisfazione ${num(state.society?.segments.find(item => item.id === segment.id)?.satisfaction ?? 50, 0)}`])
  };
  const groups = Object.entries(ACTIVITY_CATEGORIES).map(([category, label]) => {
    const rows = WEEKLY_ACTIVITIES.filter(activity => activity.category === category).map(activity => {
      const problem = activityProblem(ctx, env, activity);
      const target = activity.target && targets[activity.target]?.length ? `<select data-activity-target="${esc(activity.id)}" aria-label="Destinatario">${targets[activity.target].map(([id, text]) => `<option value="${esc(id)}">${esc(text)}</option>`).join('')}</select>` : '';
      return `<div class="hq-activity ${problem ? 'is-blocked' : ''}"><div class="hq-activity-copy"><strong>${esc(activity.label)}</strong><small>${esc(activity.detail)}</small><span><b>Effetti</b> ${esc(describeEffects(activity.effects) || 'vedi descrizione')}</span>${activity.risk || activity.later ? `<span class="hq-risk"><b>Rischio</b> ${activity.risk ? `${Math.round(activity.risk.chance * 100)}%: ${esc(activity.risk.label.toLowerCase())}` : ''}${activity.later ? `${activity.risk ? ' · ' : ''}${esc(activity.later.hint.toLowerCase())}` : ''}</span>` : ''}</div><div class="hq-cost">${costChips(activity.cost)}</div><div class="hq-activity-action">${target}<button class="secondary-button" data-game-activity="${esc(activity.id)}" ${problem ? 'disabled' : ''}>Fai</button>${problem ? `<em>${esc(problem)}</em>` : ''}</div></div>`;
    }).join('');
    const visual = CATEGORY_VISUALS[category];
    return `<details class="hq-category" data-remember="attivita-${category}" style="--cat:${visual.color}" ${['territorio', 'media', 'partito'].includes(category) || (category === 'parlamento' && gc.sit.seat) || (category === 'elezioni' && game.elections.some(item => item.status === 'open')) ? 'open' : ''}><summary><span class="cat-icon">${glyph(visual.icon, 16)}</span><span>${esc(label)}</span><small>${WEEKLY_ACTIVITIES.filter(activity => activity.category === category && !activityProblem(ctx, env, activity)).length} disponibili</small></summary>${rows}</details>`;
  }).join('');
  const campaignNote = state.campaign?.status === 'active' ? '<div class="hq-note">Sei in campagna elettorale: le attività sul territorio e sui media si decidono nella sezione Elezioni. Parlamento e decisioni restano disponibili.</div>' : '';
  return `${campaignNote}<div class="hq-planner">${groups}</div>`;
}

function reportPanel(state) {
  const game = state.game;
  const report = game.lastReport;
  const log = game.log.slice(0, 6).map(entry => `<article class="hq-log tone-${esc(entry.tone)}"><time>S${entry.week}</time><div><strong>${esc(entry.title)}</strong>${entry.lines?.length ? `<small>${esc(entry.lines.join(' · '))}</small>` : ''}</div></article>`).join('');
  return `${report ? `<div class="hq-report"><strong>Bilancio della settimana ${report.week}</strong>${report.lines.map(line => `<span>${esc(line)}</span>`).join('')}${Object.keys(report.deltas ?? {}).length ? `<span>${Object.entries(report.deltas).map(([metric, value]) => `${STAT_LABELS[metric]} ${signed(value)}`).join(' · ')}</span>` : ''}</div>` : ''}<div class="hq-log-list">${log || '<p class="quiet-copy">Il diario si riempirà con le tue scelte.</p>'}</div>`;
}

function objectivesPanel(gc) {
  const items = objectiveProgress(gc.ctx, gc.env).filter(item => item.available);
  const done = items.filter(item => item.done).length;
  const next = items.find(item => !item.done);
  return `<div class="hq-objective-head"><strong>${done} / ${items.length}</strong>${meter(done / items.length * 100, 'gold')}</div>${next ? `<p class="hq-next-goal"><small>PROSSIMO TRAGUARDO</small><strong>${esc(next.label)}</strong><span>${esc(next.detail)}</span></p>` : '<p class="hq-next-goal"><strong>Tutti i traguardi raggiunti.</strong></p>'}<ol class="hq-objectives">${items.map(item => `<li class="${item.done ? 'done' : ''}"><i>${item.done ? '✓' : ''}</i><span>${esc(item.label)}</span>${item.completedAt ? `<small>${esc(shortDate(item.completedAt))}</small>` : ''}</li>`).join('')}</ol>`;
}

export function renderElectionCalendar(state, { detailed = false } = {}) {
  const game = state.game;
  const today = state.clock.currentDate;
  const rows = upcomingElections(game).slice(0, detailed ? 6 : 3).map(entry => {
    const status = entry.status === 'open' ? `<b class="hq-open">Candidature aperte fino al ${esc(shortDate(entry.windowClosesAt))}</b>` : entry.status === 'running' ? '<b class="hq-open">Campagna in corso</b>' : entry.status === 'missed' ? `<b class="hq-missed">Candidature chiuse · voto il ${esc(shortDate(entry.electionDate))}</b>` : `<span>Candidature dal ${esc(shortDate(entry.windowOpensAt))} · tra ${weeks(weeksUntil(today, entry.windowOpensAt))}</span>`;
    const action = entry.status === 'open' && state.campaign?.status !== 'active' ? `<button class="text-link" data-nav="elezioni">Candidati ${arrow}</button>` : entry.status === 'upcoming' && state.campaign?.status !== 'active' && game.status !== 'ended' ? `<button class="text-link" data-game-fastforward="${esc(entry.type)}" data-fastforward-label="${esc(entry.label)}" data-fastforward-date="${esc(entry.windowOpensAt)}" data-fastforward-weeks="${weeksUntil(today, entry.windowOpensAt)}">Avanza fino alle candidature ${arrow}</button>` : '';
    return `<div class="hq-election ${entry.status}"><div><strong>${esc(entry.label)}${entry.early ? ' · anticipate' : ''}</strong>${status}<small>Voto il ${esc(formatDate(entry.electionDate))}</small></div>${action}</div>`;
  }).join('');
  const note = detailed ? `<p class="parliament-note">Politiche ed europee seguono il calendario reale (fine della legislatura, europee 2029 e poi ogni cinque anni); comunali e regionali seguono il calendario reale del tuo comune e della tua regione (cinque anni dall’ultimo voto). Quando si aprono le candidature puoi avviare la campagna; se non ti candidi, un mandato dello stesso tipo si conclude. La preparazione accumulata (${num(game.prep, 0)}%), i fondi e il sostegno nel partito entrano nella campagna.</p>` : '';
  return `<div class="hq-elections">${rows || '<p class="quiet-copy">Nessuna elezione in calendario.</p>'}</div>${note}`;
}

function parliamentPanel(state) {
  const parliament = state.parliament;
  const seat = parliament?.player;
  if (!seat) return `<p class="quiet-copy">${state.career.pastParliamentContexts?.length ? 'Il tuo mandato parlamentare si è concluso.' : 'Non siedi in Parlamento.'} Vinci un seggio alle politiche per entrare in Aula.</p><button class="text-link" data-nav="parlamento">Osserva le Camere ${arrow}</button>`;
  const group = parliament.chambers[seat.chamber]?.groups.find(item => item.groupId === seat.groupId);
  const government = parliament.government;
  const governing = ['active', 'crisis'].includes(government?.status);
  const inMajority = governing && [...government.coalitionGroupIds, ...government.supportingGroupIds].includes(seat.groupId);
  const openLaws = (parliament.laws ?? []).filter(law => !['approved', 'rejected', 'lapsed'].includes(law.stage)).length;
  const minister = activeMinisters(government).find(item => item.playerAppointed);
  const facts = parliamentGroupFacts(parliament, seat.chamber);
  return `<dl class="hq-facts"><div><dt>${esc(CHAMBERS[seat.chamber].shortLabel)}</dt><dd>${esc(group?.officialName ?? 'Gruppo da scegliere')}</dd></div><div><dt>Posizione</dt><dd>${esc(parliament.careerStanding?.committeeRole?.title ?? 'Componente del gruppo')}</dd></div><div><dt>Sostegno nel gruppo</dt><dd>${num(parliament.careerStanding?.partySupport ?? 50, 0)}/100</dd></div><div><dt>Governo</dt><dd>${governing ? `${government.status === 'crisis' ? 'In crisi' : 'In carica'} · ${inMajority ? 'sei in maggioranza' : 'sei all’opposizione'}` : government?.status === 'awaiting-confidence' ? 'In attesa della fiducia' : government?.status === 'fallen' ? 'Caduto' : 'Nessun governo'}</dd></div>${governing ? `<div><dt>Stabilità</dt><dd>${num(government.stability ?? 50, 0)}/100 ${meter(government.stability ?? 50, (government.stability ?? 50) < 35 ? 'danger' : '')}</dd></div>` : ''}${minister ? `<div><dt>Ministero</dt><dd>${esc(minister.portfolio)}</dd></div>` : ''}<div><dt>Leggi in corso</dt><dd>${openLaws} · maggioranza a ${facts.majority}</dd></div></dl>${!seat.groupId ? '<button class="primary-button" data-nav="parlamento">Scegli il gruppo</button>' : `<div class="hq-links"><button class="text-link" data-nav="parlamento">Aula ${arrow}</button><button class="text-link" data-nav="leggi">Leggi ${arrow}</button><button class="text-link" data-nav="governo">Governo ${arrow}</button></div>`}`;
}

function relationsPanel(state) {
  return `<div class="hq-relations">${state.game.relations.map(item => `<div class="hq-relation"><span><strong>${esc(item.label)}</strong><small>${esc(item.kind)}</small></span><b>${num(item.value, 0)}</b>${meter(item.value, item.value < 30 ? 'danger' : item.value >= 65 ? 'good' : '')}</div>`).join('')}</div><p class="parliament-note">Rapporti simulati: pesano su candidature, incarichi, trattative e votazioni.</p>`;
}

// The career never ends: after a fall the headquarters shows the climb back, not a final screen.
function endedBanner(state, gc) {
  const game = state.game;
  const fall = (game.setbacks ?? []).at(-1);
  if (!fall || !game.flags?.comebackFrom || game.week.index - fall.week > 26) return '';
  const offices = state.dataset.offices.filter(item => item.politicianId === gc.player?.id && !item.endDate).length;
  return `<section class="hq-setback"><span class="section-kicker">TRAVERSATA NEL DESERTO · DA ${esc(formatDate(fall.date))}</span><h2>La carriera continua: si riparte dal basso.</h2><p>${esc(fall.reason)}. Settimane da allora: ${game.week.index - fall.week} · incarichi in corso: ${offices}. Ricostruisci reputazione e rapporti: quando tornerai credibile, il ritorno resterà nella tua memoria politica.</p></section>`;
}

// The phase of national politics, read from government, calendar, campaign and citizens.
export function politicalPhase(state) {
  const game = state.game;
  const government = state.parliament?.government;
  const date = state.clock.currentDate;
  if (state.campaign?.status === 'active') return ['campagna', 'Campagna elettorale in corso', 'ballot'];
  if (government?.status === 'crisis') return ['crisi', 'Crisi di governo', 'alert'];
  if (government?.status === 'awaiting-confidence') return ['trattativa', 'Trattative per il nuovo governo', 'link'];
  if (government?.status === 'fallen') return ['crisi', state.national?.formation?.crisis && state.national.formation.phase !== 'fallita' ? 'Governo caduto: consultazioni in corso' : 'Governo caduto: verso il voto', 'alert'];
  // After the vote: new Chambers, consultations, confidence (national cycle).
  if (government?.status === 'caretaker' || (state.national?.formation && !['completata', 'fallita'].includes(state.national.formation.phase))) return ['trattativa', 'Dopo il voto: si forma il nuovo governo', 'link'];
  const politiche = game.elections.find(item => item.type === 'politiche' && item.status !== 'held');
  if (politiche && (politiche.status === 'open' || weeksUntil(date, politiche.windowOpensAt) <= 10)) return ['preelettorale', 'Fine legislatura: clima pre-elettorale', 'ballot'];
  if (game.legislature?.since && weeksUntil(game.legislature.since, date) <= 12) return ['inizio', 'Inizio di legislatura', 'flag'];
  if (state.society && societyMood(state.society) < 42) return ['tensione', 'Malcontento nel Paese', 'megaphone'];
  return ['ordinaria', 'Legislatura in corso', 'dome'];
}

// Where the country stands this week: legislature, phase, government, citizens' mood.
function situationBar(state) {
  const game = state.game;
  const legislature = game.legislature ?? { label: 'XIX legislatura', reference: 'real' };
  const government = state.parliament?.government;
  const poll = state.world?.polls?.at(-1);
  const governing = ['active', 'crisis'].includes(government?.status);
  const executive = governing
    ? `${government.status === 'crisis' ? 'Governo in crisi' : 'Governo in carica'} · stabilità ${num(government.stability ?? 50, 0)}${poll?.government ? ` · gradimento ${num(poll.government.approval, 0)}%` : ''}`
    : government?.status === 'awaiting-confidence' ? 'Governo in attesa della fiducia' : government?.status === 'caretaker' ? `${government.name}: affari correnti` : `${state.society?.executive?.label ?? 'Esecutivo di scenario'}${poll?.executive ? ` · gradimento ${num(poll.executive.approval, 0)}%` : ''}`;
  const mood = state.society ? societyMood(state.society) : null;
  const moodState = mood === null ? null : mood < 40 ? ['crisi', 'Malcontento'] : mood < 47 ? ['rischio', 'Clima teso'] : mood >= 58 ? ['crescita', 'Clima positivo'] : ['stabile', 'Clima stabile'];
  const [phaseKind, phaseLabel, phaseIcon] = politicalPhase(state);
  return `<section class="situation-bar phase-${phaseKind}">
    <div>${glyph('flag', 16)}<span><small>ITALIA · ${legislature.reference === 'real' ? 'DATO REALE' : 'SIMULAZIONE'}</small><strong>${esc(legislature.label)}</strong><em>${glyph(phaseIcon, 12)} ${esc(phaseLabel)}</em></span></div>
    <div>${glyph(governing ? 'ministry' : 'dome', 16)}<span><small>ESECUTIVO</small><strong>${esc(executive)}</strong><em>${governing ? (government.primeMinister === 'player' ? 'guidato da te · simulazione' : government.formedBy === 'reference' ? 'in carica dall’avvio della carriera · simulazione' : 'nato in Parlamento nella simulazione') : 'scenario, non il governo reale'}</em></span></div>
    ${mood === null ? '' : `<div>${glyph('users', 16)}<span><small>UMORE DEL PAESE</small><strong>${num(mood, 0)}/100 ${stateBadge(moodState[0], moodState[1])}</strong></span></div>`}
    <div>${glyph('clock', 16)}<span><small>SETTIMANA ${game.week.index}</small><strong>${esc(formatDate(state.clock.currentDate))}</strong></span></div>
  </section>`;
}

// The staff briefing: what matters most this week, why, and where to act.
function briefing(state, gc, { bare = false } = {}) {
  const game = state.game;
  if (game.status === 'ended') return '';
  const items = [];
  const add = (priority, kind, icon, title, why, action) => items.push({ priority, kind, icon, title, why, action });
  const go = (page, label) => `<button class="secondary-button" data-nav="${page}">${label} ${arrow}</button>`;
  const act = (id, label) => `<button class="secondary-button" data-game-activity="${id}">${label}</button>`;
  const urgent = game.inbox.filter(item => ['urgente', 'situazione'].includes(item.kind));
  if (urgent.length) add(100, 'crisi', 'alert', urgent[0].title, urgent.length > 1 ? `E altre ${urgent.length - 1} decisioni che non possono aspettare.` : 'Se non decidi entro fine settimana, si applica la scelta più passiva.', `<button class="secondary-button" data-scroll="hq-inbox">Decidi ${arrow}</button>`);
  const finance = game.finance ? financeOutlook(game) : null;
  if (finance?.status === 'crisi') add(95, 'crisi', 'wallet', `Debito a ${euro(finance.debt)}`, 'Gli interessi mangiano la cassa e i fornitori chiedono garanzie.', go('finanze', 'Finanze'));
  else if (finance?.status === 'rischio') add(70, 'rischio', 'wallet', finance.debt ? `Debito aperto: ${euro(finance.debt)}` : `Cassa per ${weeks(finance.runway ?? 0)}`, 'Riduci le spese fisse o raccogli fondi prima che scatti una crisi.', go('finanze', 'Finanze'));
  const region = game.place.region;
  const issue = state.society?.issues.find(item => item.region === region);
  const priorities = regionPriorities(state.society, region, 1);
  if (issue) add(80, 'rischio', 'pin', `${region}: problema aperto`, `I cittadini guardano a te per ${priorities[0]?.label.toLowerCase() ?? 'i servizi'}.`, go('territori', 'Territorio'));
  for (const promise of (game.promises ?? []).filter(item => item.status === 'open' && item.dueWeek - game.week.index <= 4)) add(85, 'rischio', 'target', `Promessa in ${promise.region} in scadenza`, `Tra ${weeks(Math.max(0, promise.dueWeek - game.week.index))} i cittadini verificheranno: una legge su ${promise.topic.toLowerCase()} o un miglioramento reale.`, go('territori', 'Verifica'));
  const election = upcomingElections(game).find(item => item.status === 'open' || (item.status === 'upcoming' && weeksUntil(state.clock.currentDate, item.windowOpensAt) <= 4));
  if (election?.status === 'open' && state.campaign?.status !== 'active') add(90, 'crescita', 'ballot', `Candidature aperte: ${election.label}`, 'La finestra si chiude presto: fondi, preparazione e sostegno del partito entrano nella campagna.', go('elezioni', 'Candidati'));
  else if (election?.status === 'upcoming') add(60, 'stabile', 'ballot', `${election.label} tra ${weeks(weeksUntil(state.clock.currentDate, election.windowOpensAt))}`, `Preparazione al ${num(game.prep, 0)}%: più è alta, più forte parte la campagna.`, act('preparazione', 'Prepara la candidatura'));
  const party = game.party;
  if (party?.org && party.org.treasury.balance < 0 && isPartyLeader(party)) add(88, 'crisi', 'money', 'Tesoreria del partito in rosso', 'Le sezioni chiudono e la coesione cala finché i conti non tornano in ordine.', go('finanze', 'Tesoreria'));
  if (party?.affiliation === 'member' && party.support < 35) add(75, 'rischio', 'flag', `Sostegno interno a ${num(party.support, 0)}`, 'Sotto quota 20 il partito può espellerti; sotto 30 rischi gli incarichi.', act('riunione', 'Riunione di partito'));
  const congress = party?.org && !party.org.founder ? party.org.congress.nextWeek - game.week.index : null;
  if (congress !== null && congress >= 0 && congress <= 4) add(65, 'stabile', 'crown', `Congresso tra ${weeks(congress)}`, party.alignedCurrentId ? 'La tua area si gioca la guida del partito.' : 'Schierati con un’area prima del voto: chi resta neutrale conta meno.', go('partito', 'Partito'));
  if ((state.society?.media.sentiment ?? 0) < -15) add(68, 'calo', 'news', 'La stampa ti è ostile', 'Il tono della copertura pesa sulla reputazione ogni settimana.', act('conferenza', 'Conferenza stampa'));
  if ((gc.stats.popularity ?? 50) < 35) add(62, 'calo', 'users', `Popolarità a ${num(gc.stats.popularity, 0)}`, 'Senza presenza sul territorio la popolarità scende ogni settimana.', act('ascolto', 'Giro di ascolto'));
  const law = (state.parliament?.laws ?? []).find(item => !['approved', 'rejected', 'lapsed'].includes(item.stage));
  if (law && gc.sit.seat) add(58, 'stabile', 'law', `In Aula: “${law.title}”`, 'Ogni passaggio costa un giorno: trattative e compromessi cambiano il voto.', go('leggi', 'Leggi'));
  if (finance && game.resources.funds > 8000 && !(game.finance.assets ?? []).length) add(40, 'crescita', 'money', `${euro(game.resources.funds)} fermi in cassa`, 'Un investimento o un fondo elettorale ti renderebbero più forte alle prossime elezioni.', go('finanze', 'Investi'));
  if (game.week.ap === game.week.maxAp) add(30, 'stabile', 'clock', `Hai ancora ${game.week.ap} giorni questa settimana`, 'Territorio, media e partito aspettano: ogni giorno non usato è un’occasione persa.', `<button class="secondary-button" data-scroll="hq-planner">Pianifica ${arrow}</button>`);
  const top = items.sort((a, b) => b.priority - a.priority).slice(0, 4);
  if (!top.length) return '';
  // On the Home the priorities sit in their own block, which already has the heading.
  if (bare) return `<div class="briefing briefing-bare"><div class="briefing-grid">${top.map(item => `<article class="briefing-item state-${item.kind}"><span class="briefing-icon">${glyph(item.icon, 18)}</span><div><strong>${esc(item.title)}</strong><small>${esc(item.why)}</small></div>${item.action}</article>`).join('')}</div></div>`;
  return `<section class="briefing"><header>${glyph('target', 18)}<div><span class="section-kicker">BRIEFING DELLO STAFF · SETTIMANA ${game.week.index}</span><h2>Le priorità di questa settimana</h2></div></header><div class="briefing-grid">${top.map(item => `<article class="briefing-item state-${item.kind}"><span class="briefing-icon">${glyph(item.icon, 18)}</span><div><strong>${esc(item.title)}</strong><small>${esc(item.why)}</small></div>${item.action}</article>`).join('')}</div></section>`;
}

// Cause-and-effect chains of recent weeks, and the consequences still to come.
function consequencesPanel(state) {
  const game = state.game;
  const recent = game.week.index - 6;
  const chains = (state.world?.events ?? []).filter(event => event.chain?.length && event.week >= recent).slice(0, 3);
  const resolved = game.log.filter(entry => entry.kind === 'conseguenza' && entry.week >= recent).slice(0, 3);
  const chainHtml = chains.map(event => `<article class="chain tone-${esc(event.tone)}"><header>${glyph(event.icon ?? 'law', 16)}<strong>${esc(event.title)}</strong><time>S${event.week}</time></header><ol>${event.chain.map(step => `<li>${glyph(step.icon, 14)}<span>${esc(step.text)}</span></li>`).join('')}</ol></article>`).join('');
  const resolvedHtml = resolved.map(entry => `<article class="hq-log tone-${esc(entry.tone)}"><time>S${entry.week}</time><div><strong>${esc(entry.title)}</strong>${entry.lines?.length ? `<small>${esc(entry.lines.join(' · '))}</small>` : ''}</div></article>`).join('');
  const pending = (game.pending ?? []).map(item => `<li>${glyph('clock', 14)}<span><strong>${esc(item.hint)}</strong><small>Da “${esc(item.origin)}” · ${item.dueWeek - game.week.index > 0 ? `tra ${weeks(item.dueWeek - game.week.index)}` : 'a fine settimana'}</small></span></li>`).join('');
  return `${chainHtml ? `<div class="chain-list">${chainHtml}</div>` : ''}${pending ? `<div class="pending"><span class="section-kicker">CONSEGUENZE IN ARRIVO</span><ul>${pending}</ul></div>` : ''}${resolvedHtml ? `<div class="hq-log-list">${resolvedHtml}</div>` : ''}${reportPanel(state)}`;
}

// What the player's offices allow: every locked power says what it takes.
export function renderRolesPanel(state) {
  const { roles, powers } = playerRoles(state);
  return `<div class="role-chips">${roles.map(([id, label]) => `<span class="role-chip role-${esc(id)}">${glyph(id === 'premier' || id === 'segretario' || id === 'fondatore' ? 'crown' : id === 'ministro' || id === 'sottosegretario' ? 'ministry' : id === 'parlamentare' || id === 'commissione' ? 'dome' : 'user', 14)}${esc(label)}</span>`).join('')}</div>
    <ul class="power-list">${powers.map(power => `<li class="${power.enabled ? 'on' : 'off'}">${glyph(power.enabled ? 'shield' : 'clock', 14)}<span><strong>${esc(power.label)}</strong>${power.enabled ? '' : `<small>${esc(power.reason)}</small>`}</span></li>`).join('')}</ul>`;
}

// Why the indicators moved: the attributed causes of this week and of the last one.
// Why the party's consensus moved in the last poll, and why the country's mood changed.
export function renderConsensusWhy(state) {
  const poll = state.world?.polls?.at(-1);
  const player = state.world?.parties?.find(item => item.isPlayer);
  const row = player ? poll?.results?.find(item => item.partyId === player.id) : null;
  const mood = state.society?.lastWhy?.causes ?? [];
  const rows = list => `<ul>${list.map(item => `<li><span>${esc(item.label)}</span><b class="${item.delta >= 0 ? 'up' : 'down'}">${item.delta >= 0 ? '+' : '−'}${num(Math.abs(item.delta), 1)}</b></li>`).join('')}</ul>`;
  const consensus = row ? `<article class="why-row"><header><strong>Consenso di ${esc(player.label)}: ${num(row.share, 1)}%</strong><b class="${row.delta >= 0 ? 'up' : 'down'}">${row.delta >= 0 ? '+' : '−'}${num(Math.abs(row.delta), 1)}</b></header>${poll.why?.length ? rows(poll.why) : '<ul><li><span>Nessuna causa rilevante: variazione dentro il margine d’errore</span></li></ul>'}</article>` : '';
  const country = mood.length ? `<article class="why-row"><header><strong>Umore del Paese</strong></header>${rows(mood)}</article>` : '';
  return consensus || country ? `<div class="why-block"><span class="section-kicker">SONDAGGIO E PAESE · ULTIMA SETTIMANA</span>${consensus}${country}</div>` : '';
}
// The political memory of the career: what voters, allies and rivals still remember.
export function renderMemoryPanel(state) {
  const game = state.game;
  const balance = memoryBalance(game);
  if (!balance.highlights.length) return '<p class="quiet-copy">Le scelte importanti (leggi, promesse, crisi, rotture, scandali) resteranno qui e peseranno su elezioni, alleanze e rapporti anche anni dopo.</p>';
  return `<div class="memory-balance"><span>Bilancio della memoria: <b class="${balance.net >= 0 ? 'up' : 'down'}">${balance.net >= 0 ? '+' : '−'}${num(Math.abs(balance.net), 1)}</b></span><small>Alle prossime elezioni, nelle candidature, nelle alleanze e nei sondaggi pesa ${balance.net >= 0 ? 'a favore' : 'contro'} di te; ogni ricordo perde metà del peso in circa ${num(2 * ({ facile: 0.85, difficile: 1.3 }[game.difficulty] ?? 1), 1)} anni e le scelte più gravi restano per molti anni.</small></div><ul class="memory-list">${balance.highlights.map(item => `<li class="tone-${esc(item.tone)}">${glyph(item.tone === 'good' ? 'shield' : 'alert', 14)}<span><strong>${esc(item.text)}</strong><small>${esc(MEMORY_KINDS[item.kind]?.label ?? item.kind)} · settimana ${item.week} · peso attuale ${num(item.current, 2)}</small></span></li>`).join('')}</ul>`;
}
export function renderWhyPanel(state) {
  const game = state.game;
  const block = (journal, label) => {
    const entries = journal?.entries ?? [];
    if (!entries.length) return '';
    const metrics = [...new Set(entries.map(entry => entry.metric))];
    return `<div class="why-block"><span class="section-kicker">${label}</span>${metrics.map(metric => {
      const rows = entries.filter(entry => entry.metric === metric).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      const total = rows.reduce((sum, entry) => sum + entry.delta, 0);
      return `<article class="why-row"><header><strong>${esc(STAT_LABELS[metric])}</strong><b class="${total >= 0 ? 'up' : 'down'}">${total >= 0 ? '+' : '−'}${num(Math.abs(total), 1)}</b></header><ul>${rows.slice(0, 4).map(entry => `<li><span>${esc(entry.source)}</span><b class="${entry.delta >= 0 ? 'up' : 'down'}">${entry.delta >= 0 ? '+' : '−'}${num(Math.abs(entry.delta), 1)}</b></li>`).join('')}</ul></article>`;
    }).join('')}</div>`;
  };
  const html = renderConsensusWhy(state) + block(game.why, `SETTIMANA ${game.week.index} · FINORA`) + block(game.whyLast, `SETTIMANA ${game.whyLast?.week ?? game.week.index - 1} · CHIUSA`);
  return html || '<p class="quiet-copy">Ogni variazione di popolarità, reputazione, influenza e degli altri indicatori comparirà qui con la sua causa.</p>';
}

// The newsroom: political chronicle, headlines and the career diary in one feed.
const NEWS_FILTERS = [['tutto', 'Tutto'], ['cronaca', 'Cronaca'], ['media', 'Titoli'], ['diario', 'Il tuo diario']];
export function renderNewsroom(state, filter = 'tutto') {
  const game = state.game;
  const items = [
    ...(state.world?.events ?? []).map(event => ({ kind: 'cronaca', week: event.week, icon: event.icon ?? 'news', tone: event.tone, title: event.title, body: event.body, label: event.chain?.step ? `Sviluppi · ${event.chain.rootTitle ?? 'vicenda in corso'}` : 'Cronaca politica' })),
    ...(state.society?.media?.coverage ?? []).map(item => ({ kind: 'media', week: item.week, icon: 'news', tone: item.tone, title: item.headline, body: '', label: item.outlet })),
    ...game.log.map(entry => ({ kind: 'diario', week: entry.week, icon: entry.kind === 'partito' ? 'flag' : entry.kind === 'conseguenza' ? 'route' : 'pin', tone: entry.tone, title: entry.title, body: (entry.lines ?? []).slice(0, 2).join(' · '), label: 'Diario' }))
  ].filter(item => filter === 'tutto' || item.kind === filter).sort((a, b) => b.week - a.week).slice(0, 10);
  const tabs = `<div class="segmented news-filter" role="group" aria-label="Filtra le notizie">${NEWS_FILTERS.map(([id, label]) => `<button data-news-filter="${id}" class="${filter === id ? 'active' : ''}" aria-pressed="${filter === id}">${label}</button>`).join('')}</div>`;
  // Stories still open: something will follow, the outcome is not known in advance.
  const open = [...new Map((state.world?.chains ?? []).map(chain => [chain.root, chain])).values()].filter(chain => chain.rootTitle);
  const threads = open.length && filter !== 'diario' && filter !== 'media' ? `<p class="news-threads">${glyph('route', 14)} Vicende aperte: ${open.slice(0, 4).map(chain => `<b>${esc(chain.rootTitle)}</b>`).join(' · ')} — gli sviluppi arrivano nelle prossime settimane.</p>` : '';
  return `${tabs}${threads}<div class="newsroom">${items.map(item => `<article class="news-item tone-${esc(item.tone ?? 'neutral')}">${glyph(item.icon, 16)}<div><span class="news-meta">${esc(item.label)} · S${item.week}</span><strong>${esc(item.title)}</strong>${item.body ? `<small>${esc(item.body)}</small>` : ''}</div></article>`).join('') || '<p class="quiet-copy">Nessuna notizia per questo filtro.</p>'}</div><p class="poll-footnote">Cronaca, titoli e testate sono simulati: nessuna dichiarazione o fatto è attribuito a persone reali.</p>`;
}

// The career timeline: every milestone, week by week; what happened before shapes what comes next.
const TIMELINE_KINDS = { inizio: ['flag', 'Inizio'], partito: ['flag', 'Partito'], incarico: ['star', 'Incarico'], governo: ['ministry', 'Governo'], legge: ['law', 'Legge'], elezione: ['ballot', 'Elezioni'], decisione: ['target', 'Decisione'], promessa: ['pin', 'Promessa'], sondaggi: ['chart', 'Sondaggi'], fine: ['alert', 'Fine'] };
export function renderCareerTimeline(state, filter = 'tutto') {
  const game = state.game;
  const all = [...(game.timeline ?? [])];
  const count = kind => all.filter(item => item.kind === kind).length;
  const record = [
    ['Settimane', game.week.index], ['Anni di carriera', num(game.week.index / 52, 1)],
    ['Incarichi', all.filter(item => item.kind === 'incarico' && item.tone === 'good').length], ['Elezioni', count('elezione')],
    ['Leggi', all.filter(item => item.kind === 'legge' && item.tone === 'good').length], ['Decisioni chiave', count('decisione')],
    ['Promesse mantenute', all.filter(item => item.kind === 'promessa' && item.tone === 'good').length], ['Partiti cambiati', (game.pastParties ?? []).length]
  ];
  const kinds = ['tutto', ...Object.keys(TIMELINE_KINDS).filter(kind => all.some(item => item.kind === kind))];
  const items = all.filter(item => filter === 'tutto' || item.kind === filter).reverse();
  const years = new Map();
  for (const item of items) { const year = String(item.date ?? '').slice(0, 4) || '—'; years.set(year, [...(years.get(year) ?? []), item]); }
  const body = [...years.entries()].map(([year, entries]) => `<section class="timeline-year"><h3>${esc(year)}</h3><ol>${entries.map(item => { const [icon, label] = TIMELINE_KINDS[item.kind] ?? ['pin', 'Evento']; return `<li class="timeline-entry tone-${esc(item.tone)}"><span class="timeline-icon">${glyph(icon, 15)}</span><div><span class="news-meta">${esc(label)} · S${item.week} · ${esc(formatDate(item.date))}</span><strong>${esc(item.title)}</strong>${item.detail ? `<small>${esc(item.detail)}</small>` : ''}</div></li>`; }).join('')}</ol></section>`).join('');
  return `<div class="track-record">${record.map(([label, value]) => `<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('')}</div>
    <div class="segmented timeline-filter" role="group" aria-label="Filtra la cronologia">${kinds.map(kind => `<button data-timeline-filter="${kind}" class="${filter === kind ? 'active' : ''}" aria-pressed="${filter === kind}">${kind === 'tutto' ? 'Tutto' : esc(TIMELINE_KINDS[kind][1])}</button>`).join('')}</div>
    <div class="career-timeline">${body || '<p class="quiet-copy">Nessuna tappa per questo filtro.</p>'}</div>
    <p class="parliament-note">Le tappe restano: partiti lasciati, promesse tradite e cadute di governo pesano su fiducia, sostegno e rapporti negli anni successivi.</p>`;
}

function deadlinesPanel(state, gc) {
  const game = state.game;
  const rows = [];
  const party = game.party;
  if (party?.org && !party.org.founder) rows.push(['crown', 'Congresso ordinario', `tra ${weeks(Math.max(0, party.org.congress.nextWeek - game.week.index))}`]);
  for (const promise of (game.promises ?? []).filter(item => item.status === 'open')) rows.push(['target', `Promessa: ${promise.topic} in ${promise.region}`, `verifica alla settimana ${promise.dueWeek}`]);
  for (const law of (state.parliament?.laws ?? []).filter(item => !['approved', 'rejected', 'lapsed'].includes(item.stage)).slice(0, 2)) rows.push(['law', law.title, 'iter in corso']);
  const extra = rows.length ? `<div class="deadline-list">${rows.map(([icon, title, when]) => `<div>${glyph(icon, 16)}<span><strong>${esc(title)}</strong><small>${esc(when)}</small></span></div>`).join('')}</div>` : '';
  return `${renderElectionCalendar(state)}${extra}<div class="home-section-heading hq-sub-heading"><div><span class="section-kicker">TRAGUARDI</span></div></div>${objectivesPanel(gc)}`;
}

// The Home is the command centre: 1. where you are and the main action; 2. the resources of the week; 3. priorities
// and decisions; 4. what is coming; 5. every area in brief (each card opens its section); then the details, folded.
export function renderHeadquarters(state, options = {}) {
  const gc = gameContext(state);
  const expanded = options.expanded ?? {};
  // The board: priorities, decisions, the coming votes and deadlines, goals and the area cards flow in balanced
  // columns on computers (no empty space beside a long list), in this order on one column on phones.
  return `<div class="hq hqc">${endedBanner(state, gc)}
    ${commandHeader(state, gc, options)}
    ${resourcesBar(state, gc)}
    <div class="hqc-board">
      ${prioritiesBlock(state, gc, expanded)}
      ${upcomingBlock(state, gc, expanded)}
      ${summariesBlock(state, gc, expanded)}
    </div>
    ${detailsBlock(state, gc, options)}
    <footer class="home-footer"><span>POLITICANDO 2026</span><span>Persone e dati istituzionali reali restano in sola lettura (dati verificati); carriera, cittadini, territori, economia, media e relazioni sono simulati.</span></footer></div>`;
}

// Pieces of the headquarters reused by the redesigned sections (Carriera, Partito, Agenda).
export function renderPlanner(state) { return planner(state, gameContext(state)); }
export function renderObjectivesPanel(state) { return objectivesPanel(gameContext(state)); }
export function renderSecretaryDesk(state) { return secretaryPanel(state); }
export function renderRelationsPanel(state) { return relationsPanel(state); }
export function renderConsequencesPanel(state) { return consequencesPanel(state); }

export function renderPartyPosition(state, options = {}) {
  const game = state.game;
  const gc = gameContext(state);
  if (!game.party) {
    const choices = (options.parties ?? []).map(party => `<option value="${esc(party.id)}">${esc(party.officialName ?? party.name)}${party.source === 'real' ? ' · dato reale verificato' : party.source === 'user' ? ' · creato da te' : ' · simulazione'}</option>`).join('');
    return `<section class="party-position"><div class="home-section-heading"><div><span class="section-kicker">POSIZIONE NEL PARTITO · SIMULAZIONE</span><h2>Sei indipendente</h2></div></div><p class="parliament-note">Aderire a un partito apre candidature di lista, incarichi interni e correnti, ma ti lega a una leadership da convincere. Il partito reale resta un riferimento: la tua posizione interna è simulata.</p><div class="party-join"><label>Partito<select data-party-join>${choices}</select></label><button class="primary-button" data-party-action="join" ${costProblem(game, { ap: 1 }) ? 'disabled' : ''}>Aderisci · 1 giorno</button></div></section>`;
  }
  const party = game.party;
  const leadership = game.relations.find(item => item.id === 'leadership');
  const next = nextPartyRank(game);
  const odds = party.affiliation === 'member' ? partyAdvancementOdds(gc.ctx) : null;
  const cooldown = party.lastRankContestWeek && game.week.index - party.lastRankContestWeek < 3 ? `Nuovo tentativo dalla settimana ${party.lastRankContestWeek + 3}.` : '';
  const blocker = !next ? '' : cooldown || costProblem(game, { ap: 2, capital: 4 });
  const ladder = party.affiliation === 'founder'
    ? `<ol class="party-ladder"><li class="current"><span>${esc(party.rankTitle)}</span></li></ol>`
    : `<ol class="party-ladder">${PARTY_RANKS.map(rank => `<li class="${rank.level < party.rank ? 'done' : rank.level === party.rank ? 'current' : ''}"><span>${esc(rank.title)}</span>${rank.threshold ? `<small>soglia ${rank.threshold}</small>` : ''}</li>`).join('')}</ol>`;
  const currents = [...party.currents].sort((a, b) => b.strength - a.strength).map(current => { const request = current.profile?.requests?.at(-1); return `<div class="party-current ${party.alignedCurrentId === current.id ? 'aligned' : ''}"><div><strong>${esc(current.label)}${party.leaderCurrentId === current.id ? ' <em>guida il partito</em>' : ''}</strong><small>Peso interno ${num(current.strength, 1)}% · rapporto ${num(current.value ?? current.relation, 0)}/100</small><small>${esc(current.profile?.objective ?? 'Obiettivo in definizione')} · ${esc(current.lastAction ?? 'In attesa di iniziativa')}${request?.status === 'open' ? ` · richiesta: ${esc(request.title)}` : ''}</small>${meter(current.value ?? current.relation)}</div>${party.alignedCurrentId === current.id ? '<span class="hq-tag">LA TUA AREA</span>' : `<button class="secondary-button" data-party-current="${esc(current.id)}" ${costProblem(game, { ap: 1 }) ? 'disabled' : ''}>Schierati · 1 giorno</button>`}</div>`; }).join('');
  const log = game.log.filter(entry => entry.kind === 'partito' || /congresso|partito/i.test(entry.title)).slice(0, 5).map(entry => `<article class="hq-log tone-${esc(entry.tone)}"><time>S${entry.week}</time><div><strong>${esc(entry.title)}</strong>${entry.lines?.length ? `<small>${esc(entry.lines.join(' · '))}</small>` : ''}</div></article>`).join('');
  return `<section class="party-position"><div class="home-section-heading"><div><span class="section-kicker">POSIZIONE NEL PARTITO · SIMULAZIONE</span><h2>${esc(party.rankTitle)}</h2></div><button class="text-link" data-party-action="leave">Lascia il partito</button></div>
    <div class="party-metrics"><div><small>SOSTEGNO INTERNO</small><strong>${num(party.support, 0)}</strong>${meter(party.support, party.support < 25 ? 'danger' : '')}</div>${leadership ? `<div><small>RAPPORTO CON LA LEADERSHIP</small><strong>${num(leadership.value, 0)}</strong>${meter(leadership.value)}</div>` : ''}<div><small>AREA DI RIFERIMENTO</small><strong class="small">${esc(party.currents.find(item => item.id === party.alignedCurrentId)?.label ?? 'Nessuna')}</strong></div></div>
    ${ladder}
    ${next?.threshold ? `<div class="party-contest"><div><strong>Prossimo incarico: ${esc(next.title)} · probabilità stimata ${Math.round((odds?.chance ?? 0) * 100)}%</strong><small>Punteggio ${num(odds?.score ?? 0, 0)} su soglia ${next.threshold}: superarla rende la nomina probabile, non certa. Contano sostegno, leadership, la tua area, influenza, risultati, territorio e salute del partito; l’esito può essere anche un incarico minore, un rinvio o una sconfitta interna.</small></div><button class="primary-button" data-party-action="contest" ${blocker ? 'disabled' : ''}>Candidati · 2 giorni · 4 cap.</button>${blocker ? `<em>${esc(blocker)}</em>` : ''}</div>` : ''}
    ${party.affiliation === 'member' && next && !next.threshold ? '<div class="hq-note">Sei in direzione nazionale: la segreteria si conquista solo al congresso, candidandoti quando viene convocato.</div>' : ''}
    ${party.support < 25 && party.affiliation === 'member' ? '<div class="hq-note danger">Il sostegno interno è molto basso: sotto quota 20 il partito può avviare un procedimento di espulsione.</div>' : ''}
    <div class="home-section-heading"><div><span class="section-kicker">CORRENTI INTERNE · SIMULATE</span><h3>Equilibri del partito</h3></div></div><div class="party-currents">${currents}</div>
    ${log ? `<div class="hq-log-list">${log}</div>` : ''}
    <p class="parliament-note">Correnti, leadership e incarichi interni sono ruoli di gioco: non rappresentano persone o organi reali del partito.</p></section>
    ${options.withSecretary !== false && playerRoles(state).secretary ? secretaryPanel(state) : ''}`;
}

// The secretary's desk: every control calls a decision the store checks again, with costs and cooldowns.
function secretaryPanel(state) {
  const game = state.game;
  const party = game.party;
  const org = party.org;
  const week = game.week.index;
  const wait = (key, weeksNeeded) => { const since = party.decisions?.[key]; return since !== undefined && week - since < weeksNeeded ? `di nuovo dalla settimana ${since + weeksNeeded}` : ''; };
  const block = (cost, key, weeksNeeded) => costProblem(game, cost) || (key ? wait(key, weeksNeeded) : '');
  const button = (attrs, label, problem, primary = false) => `<button class="${primary ? 'primary-button' : 'secondary-button'}" ${attrs} ${problem ? `disabled title="${esc(problem)}"` : ''}>${label}</button>${problem ? `<em class="decision-block">${esc(problem)}</em>` : ''}`;
  const current = party.line ?? 'autonoma';
  const lines = Object.entries(PARTY_LINES).map(([id, item]) => `<button class="line-option ${current === id ? 'active' : ''}" data-secretary="line" data-secretary-value="${id}" ${current === id || block({ ap: 1, capital: 3 }, 'line', 8) ? 'disabled' : ''} aria-pressed="${current === id}"><strong>${esc(item.label)}</strong><small>${esc(item.detail)}</small></button>`).join('');
  const organs = party.currents.map(item => `<option value="${esc(item.id)}" ${party.organsCurrentId === item.id ? 'selected' : ''}>${esc(item.label)} · peso ${num(item.strength, 1)}%</option>`).join('');
  const rule = party.candidacyRule ?? 'segreteria';
  const rules = Object.entries(CANDIDACY_RULES).map(([id, item]) => `<option value="${id}" ${rule === id ? 'selected' : ''}>${esc(item.label)}</option>`).join('');
  const isActive = id => (org?.investments ?? []).some(entry => entry.id === id && (!entry.untilWeek || entry.untilWeek >= week));
  const investments = PARTY_INVESTMENTS.map(item => {
    const active = isActive(item.id);
    const base = item.requires ? PARTY_INVESTMENTS.find(entry => entry.id === item.requires) : null;
    const missing = base && !isActive(item.requires) ? `Serve prima: ${base.label}` : '';
    const entry = (org?.investments ?? []).find(candidate => candidate.id === item.id && (!candidate.untilWeek || candidate.untilWeek >= week));
    const meta = [item.upkeep ? `${euro(item.upkeep)}/sett. di mantenimento` : '', item.weeks ? `${item.weeks} settimane` : item.oneOff ? 'una tantum' : 'permanente', base ? `potenzia: ${base.label}` : '', item.risk ? 'con un rischio' : ''].filter(Boolean).join(' · ');
    return `<div class="secretary-investment"><div><strong>${esc(item.label)}</strong><small>${esc(item.effect)}</small><small class="invest-note">${esc(meta)}</small></div>${active ? `<span class="hq-tag">IN CORSO${entry?.untilWeek ? ` · fino alla ${entry.untilWeek}` : ''}</span>` : button(`data-secretary="investment" data-secretary-value="${esc(item.id)}"`, `${euro(item.cost)} dalla tesoreria`, missing || costProblem(game, { treasury: item.cost }))}</div>`;
  }).join('');
  const congressIn = org && !org.founder ? org.congress.nextWeek - week : null;
  return `<section class="party-position secretary-desk"><div class="home-section-heading"><div><span class="section-kicker">SEGRETERIA NAZIONALE · SIMULAZIONE</span><h2>Le decisioni del segretario</h2></div><span class="hq-tag">${esc(party.rankTitle)}</span></div>
    <p class="parliament-note">Ogni scelta costa giorni, capitale politico o fondi, cambia i rapporti con le aree interne e si ripercuote su sondaggi, iscritti e coesione. Le decisioni strategiche hanno un intervallo minimo prima di poter essere cambiate.</p>
    <div class="secretary-block"><h3>${glyph('route', 16)} Linea politica</h3><small>1 giorno · 3 capitale · ogni 8 settimane. Gli altri partiti la leggono come la tua strategia; ogni area interna ne preferisce una.</small><div class="line-options">${lines}</div>${wait('line', 8) ? `<em class="decision-block">Linea cambiata di recente: ${esc(wait('line', 8))}</em>` : ''}</div>
    <div class="secretary-grid">
      <div class="secretary-block"><h3>${glyph('crown', 16)} Organi e incarichi</h3><small>La scelta indica la guida, ma i portafogli vengono distribuiti considerando peso, lealtà, memoria e richieste delle correnti. 1 giorno · 2 capitale · ogni 8 settimane.</small><div class="secretary-row"><select data-secretary-select="organs">${organs}</select>${button('data-secretary="organs"', 'Assegna', block({ ap: 1, capital: 2 }, 'organs', 8))}</div>${org.currentPortfolios ? `<small>Portafogli: ${Object.entries(org.currentPortfolios.portfolios ?? {}).map(([role, id]) => `${esc(role)} → ${esc(party.currents.find(item => item.id === id)?.label ?? id)}`).join(' · ')}</small>` : ''}</div>
      <div class="secretary-block"><h3>${glyph('ballot', 16)} Candidature</h3><small>${esc(CANDIDACY_RULES[rule].detail)} 2 capitale · ogni 12 settimane.</small><div class="secretary-row"><select data-secretary-select="candidacy">${rules}</select>${button('data-secretary="candidacy"', 'Applica', block({ capital: 2 }, 'candidacy', 12))}</div></div>
      <div class="secretary-block"><h3>${glyph('dome', 16)} Disciplina dei parlamentari</h3><small>Il gruppo si compatta (+6 sostegno, +4 coesione), i contatti personali si raffreddano. 1 giorno · 3 capitale · ogni 6 settimane.</small>${button('data-secretary="discipline"', 'Richiama alla disciplina', block({ ap: 1, capital: 3 }, 'discipline', 6))}</div>
      <div class="secretary-block"><h3>${glyph('split', 16)} Dissidenti</h3><small>Coesione +10, ma il 2% degli iscritti se ne va, l’area rivale ti è ostile e la stampa ne parla. 4 capitale · ogni 16 settimane.</small>${button('data-secretary="expel"', 'Espelli i dissidenti', block({ capital: 4 }, 'expel', 16))}</div>
      ${congressIn !== null ? `<div class="secretary-block"><h3>${glyph('users', 16)} Congresso</h3><small>Prossimo congresso tra ${weeks(Math.max(0, congressIn))}. Anticiparlo mette subito la tua segreteria al voto degli iscritti. 4 capitale.</small>${button('data-secretary="congress"', 'Convoca un congresso anticipato', congressIn <= 2 ? 'Il congresso è già alle porte' : costProblem(game, { capital: 4 }))}</div>` : ''}
    </div>
    <div class="secretary-grid">
      <form class="secretary-block" data-party-program-form><h3>${glyph('target', 16)} Programma del partito</h3><small>Fino a quattro priorità. Ogni area interna le confronta con i suoi temi (${party.currents.map(current => `${esc(current.label)}: ${(CURRENT_AREAS[current.id] ?? []).map(id => esc(AREA_BY_ID[id]?.label.toLowerCase())).join(', ')}`).join(' · ')}). Governare sui temi del programma tiene unito il partito. 1 giorno · 2 capitale · ogni 12 settimane.</small>
        <div class="program-options">${POLICY_AREAS.map(item => `<label class="agenda-option"><input type="checkbox" name="program" value="${item.id}" ${party.program?.areas?.includes(item.id) ? 'checked' : ''} /><span>${esc(item.label)}</span></label>`).join('')}</div>
        <button class="secondary-button" type="submit" ${wait('program', 12) ? 'disabled' : ''}>Approva il programma</button>${wait('program', 12) ? `<em class="decision-block">Programma cambiato di recente: ${esc(wait('program', 12))}</em>` : ''}</form>
      <div class="secretary-block"><h3>${glyph('megaphone', 16)} Comunicazione</h3><small>Lo stile agisce ogni settimana su reputazione, notorietà e tono della stampa. 1 capitale · ogni 6 settimane.</small><div class="line-options">${Object.entries(COMMUNICATION_STYLES).map(([id, item]) => `<button class="line-option ${party.communication === id ? 'active' : ''}" data-communication="${id}" ${party.communication === id || wait('communication', 6) ? 'disabled' : ''} aria-pressed="${party.communication === id}"><strong>${esc(item.label)}</strong><small>${esc(item.detail)}</small></button>`).join('')}</div></div>
    </div>
    ${org ? `<div class="secretary-block"><h3>${glyph('money', 16)} Investimenti del partito</h3><small>Tesoreria disponibile: ${euro(org.treasury.balance)}.</small><div class="secretary-investments">${investments}</div></div>` : ''}
    <div class="hq-links"><button class="text-link" data-nav="sondaggi">Alleanze con gli altri partiti ${arrow}</button><button class="text-link" data-nav="finanze">Bilancio e priorità della tesoreria ${arrow}</button><button class="text-link" data-nav="territori">Territori e sezioni ${arrow}</button></div>
  </section>`;
}
