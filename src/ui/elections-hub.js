// The electoral centre: next vote, calendar, context, candidacy, campaign, polls and rivals, results and history.
import { upcomingElections } from '../core/career-engine.js?v=20260926-7';
import { campaignSummary, strategyOf } from '../core/campaign-engine.js?v=20260926-7';
import { CAMPAIGN_PHASES, ELECTION_MODELS, SEAT_RULES } from '../data/simulation/campaign-rules.js?v=20260926-7';
import { PARTY_RANKS } from '../data/simulation/career-rules.js?v=20260926-7';
import { formatDate } from '../core/time.js?v=20260926-7';
import { societyMood } from '../core/society-engine.js?v=20260926-7';
import { renderCampaignPage } from './campaign-mode.js?v=20260926-7';
import { politicalPhase } from './game-mode.js?v=20260926-7';
import { lineChart, SERIES } from './charts.js?v=20260926-7';
import { glyph } from './visuals.js?v=20260926-7';
import { arrow, badge, bar, card, empty, esc, euro, kpi, num, pct, sectionHero, sectionTabs, signed, table, weeksLabel } from './sections-kit.js?v=20260926-7';
import { renderElectionReport } from './election-report.js?v=20260926-7';
import { renderNationalView } from './national-view.js?v=20260926-7';
export { renderElectionReport };

export const ELECTION_TABS = Object.freeze([['panoramica', 'Panoramica'], ['nazionali', 'Nazionali'], ['candidatura', 'Candidatura'], ['campagna', 'Campagna'], ['avversari', 'Sondaggi e avversari'], ['risultati', 'Risultati'], ['storico', 'Storico']]);
const TYPE_ICONS = { comunale: 'town', regionale: 'map', politiche: 'dome', europee: 'globe' };
const STATUS = { upcoming: ['In calendario', 'neutral'], open: ['Candidature aperte', 'good'], running: ['Campagna in corso', 'warn'], missed: ['Candidature chiuse', 'bad'], held: ['Concluse', 'neutral'] };
const daysUntil = (from, to) => Math.max(0, Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000));
const weeksUntil = (from, to) => Math.max(0, Math.ceil(daysUntil(from, to) / 7));
const shortDate = date => formatDate(date, { day: 'numeric', month: 'short' });
const toneOf = value => value > 0 ? 'good' : value < 0 ? 'bad' : 'neutral';

export function defaultElectionTab(state) {
  if (state.campaign?.status === 'active') return 'campagna';
  if (state.campaign?.status === 'finished') return 'risultati';
  return 'panoramica';
}

function playerPoll(state) {
  const world = state.world;
  const player = world?.parties?.find(item => item.isPlayer);
  if (!player) return null;
  const polls = world.polls ?? [];
  const row = polls.at(-1)?.results?.find(item => item.partyId === player.id);
  const history = polls.slice(-16).map(poll => poll.results?.find(item => item.partyId === player.id)?.share ?? null);
  return { party: player, share: row?.share ?? null, delta: row?.delta ?? 0, history };
}

function hero(state, summary) {
  const game = state.game;
  const campaign = state.campaign;
  const today = state.clock.currentDate;
  if (campaign?.status === 'active') {
    const phase = CAMPAIGN_PHASES[summary.phase];
    const strategy = strategyOf(campaign);
    const rivals = summary.standings?.length ?? 0;
    return sectionHero({
      kicker: `CAMPAGNA IN CORSO · ${campaign.electionLabel.toUpperCase()}`, icon: TYPE_ICONS[campaign.electionType] ?? 'ballot', tone: 'campaign',
      title: `${summary.daysRemaining} giorni al voto`, lead: `${phase?.label ?? ''}: ${phase?.detail ?? ''} Voto il ${formatDate(campaign.electionDate)}.`,
      kpis: [
        { label: 'Proiezione', value: pct(summary.consensus), note: summary.expectation !== null ? `attesa ${pct(summary.expectation)}` : '' },
        { label: 'Posizione', value: summary.playerPosition ? `${summary.playerPosition}ª su ${rivals}` : '—', tone: summary.playerPosition === 1 ? 'good' : summary.playerPosition && summary.playerPosition > 2 ? 'bad' : '' },
        { label: 'Candidatura', value: campaign.nomination.status === 'approved' ? 'Confermata' : campaign.nomination.status === 'excluded' ? 'Esclusa' : 'Da conquistare', tone: campaign.nomination.status === 'approved' ? 'good' : campaign.nomination.status === 'excluded' ? 'bad' : 'warn' },
        { label: 'Strategia', value: esc(strategy.short ?? 'Libera') },
        { label: 'Fondi', value: euro(campaign.candidates.find(item => item.isPlayer)?.resources.money ?? 0) }
      ],
      actions: `<button class="primary-button" data-section-tab="elezioni" data-section-tab-value="campagna">Guida la campagna ${arrow}</button>`
    });
  }
  const next = upcomingElections(game).find(item => item.status !== 'missed') ?? upcomingElections(game)[0];
  const poll = playerPoll(state);
  const mood = state.society ? societyMood(state.society) : null;
  const last = state.career.lastElectionReport;
  const open = next?.status === 'open';
  const actions = next ? (open ? `<button class="primary-button" data-section-tab="elezioni" data-section-tab-value="campagna">Candidati ora ${arrow}</button>` : next.status === 'upcoming' && game.status !== 'ended' ? `<button class="secondary-button" data-game-fastforward="${esc(next.type)}" data-fastforward-label="${esc(next.label)}" data-fastforward-date="${esc(next.windowOpensAt)}" data-fastforward-weeks="${weeksUntil(today, next.windowOpensAt)}">Avanza fino alle candidature ${arrow}</button>` : '') : '';
  return sectionHero({
    kicker: 'CENTRALE ELETTORALE · SIMULAZIONE', icon: next ? TYPE_ICONS[next.type] ?? 'ballot' : 'ballot', tone: open ? 'open' : 'default',
    title: next ? `Prossimo voto: ${next.label}` : 'Nessuna elezione in calendario',
    lead: next ? (open ? `Candidature aperte fino al ${formatDate(next.windowClosesAt)}: il voto è il ${formatDate(next.electionDate)}.` : `Candidature dal ${formatDate(next.windowOpensAt)} (tra ${weeksLabel(weeksUntil(today, next.windowOpensAt))}), voto il ${formatDate(next.electionDate)}.`) : 'Il calendario si aggiornerà con i prossimi turni.',
    actions,
    kpis: [
      { label: 'Il tuo partito nei sondaggi', value: poll?.share !== null && poll ? pct(poll.share) : '—', note: poll ? `${signed(poll.delta)} nell’ultima rilevazione` : 'nessun partito', tone: poll ? toneOf(poll.delta) : '' },
      { label: 'Preparazione', value: `${num(game.prep, 0)}%`, bar: game.prep, tone: game.prep >= 40 ? 'good' : '' },
      { label: 'Fondo elettorale', value: euro(game.finance?.electionFund ?? 0), note: '+15% dai donatori all’avvio' },
      { label: 'Sostegno nel partito', value: game.party ? `${num(game.party.support, 0)}/100` : 'Indipendente', bar: game.party ? game.party.support : null, tone: game.party && game.party.support < 35 ? 'bad' : '' },
      { label: 'Clima nel Paese', value: mood === null ? '—' : `${num(mood, 0)}/100`, tone: mood !== null && mood < 45 ? 'bad' : mood !== null && mood >= 58 ? 'good' : '' },
      { label: 'Ultimo risultato', value: last ? pct(last.playerShare) : '—', note: last ? esc(last.outcome?.label ?? '') : 'nessuna elezione ancora' }
    ]
  });
}

// The calendar as a timeline: every vote with its window, status and what can be done now.
function calendar(state) {
  const game = state.game;
  const today = state.clock.currentDate;
  const rows = upcomingElections(game).slice(0, 8).map(entry => {
    const [label, tone] = STATUS[entry.status] ?? STATUS.upcoming;
    const action = entry.status === 'open' && state.campaign?.status !== 'active' ? `<button class="primary-button" data-section-tab="elezioni" data-section-tab-value="campagna">Candidati</button>`
      : entry.status === 'running' ? `<button class="secondary-button" data-section-tab="elezioni" data-section-tab-value="campagna">Vai alla campagna</button>`
      : entry.status === 'upcoming' && state.campaign?.status !== 'active' && game.status !== 'ended' ? `<button class="text-link" data-game-fastforward="${esc(entry.type)}" data-fastforward-label="${esc(entry.label)}" data-fastforward-date="${esc(entry.windowOpensAt)}" data-fastforward-weeks="${weeksUntil(today, entry.windowOpensAt)}">Avanza fino alle candidature ${arrow}</button>` : '';
    const when = entry.status === 'upcoming' ? `tra ${weeksLabel(weeksUntil(today, entry.windowOpensAt))}` : entry.status === 'open' ? `chiude tra ${Math.max(0, daysUntil(today, entry.windowClosesAt))} giorni` : '';
    return `<li class="eh-cal-item status-${esc(entry.status)}"><span class="eh-cal-icon">${glyph(TYPE_ICONS[entry.type] ?? 'ballot', 18)}</span><div class="eh-cal-body"><div class="eh-cal-title"><strong>${esc(entry.label)}${entry.early ? ' · anticipate' : ''}</strong>${badge(label, tone)}</div><small>Candidature ${esc(shortDate(entry.windowOpensAt))} – ${esc(shortDate(entry.windowClosesAt))} · voto ${esc(formatDate(entry.electionDate))}${when ? ` · ${esc(when)}` : ''}</small></div><div class="eh-cal-action">${action}</div></li>`;
  }).join('');
  return `<ol class="eh-calendar">${rows || '<li class="sx-empty">Nessuna elezione in calendario.</li>'}</ol><p class="sx-note">Politiche ed europee seguono il calendario reale (fine della legislatura, europee del 2029 e poi ogni cinque anni); comunali e regionali seguono il calendario reale del tuo comune e della tua regione (ultimo voto da Eligendo, cinque anni di mandato), e ogni anno qualche regione o comune va al voto. Se non ti candidi, un mandato dello stesso tipo si conclude. <button class="text-link" data-section-tab="elezioni" data-section-tab-value="nazionali">Ciclo nazionale ${arrow}</button></p>`;
}

function context(state) {
  const [, phaseLabel, phaseIcon] = politicalPhase(state);
  const government = state.parliament?.government;
  const governing = ['active', 'crisis'].includes(government?.status);
  const seat = state.parliament?.player?.groupId;
  const inMajority = governing && seat && [...government.coalitionGroupIds, ...government.supportingGroupIds].includes(seat);
  const poll = playerPoll(state);
  const world = state.world;
  const alliances = poll ? (world?.alliances ?? []).filter(item => item.status === 'active' && item.partyIds.includes(poll.party.id)) : [];
  const allyNames = alliances.flatMap(item => item.partyIds.filter(id => id !== poll.party.id)).map(id => world.parties.find(party => party.id === id)?.label ?? id);
  const mood = state.society ? societyMood(state.society) : null;
  const chart = poll && poll.history.filter(value => value !== null).length > 2 ? lineChart({ series: [{ label: poll.party.label, color: SERIES[0], values: poll.history, emphasis: true }], labels: poll.history.map((_, index) => `${index + 1}`), unit: '%', height: 150, ariaLabel: 'Il tuo partito negli ultimi sondaggi' }) : '';
  return `<ul class="eh-facts">
      <li>${glyph(phaseIcon, 16)}<span><small>Fase politica</small><strong>${esc(phaseLabel)}</strong></span></li>
      <li>${glyph('ministry', 16)}<span><small>Governo</small><strong>${governing ? `${government.status === 'crisis' ? 'In crisi' : 'In carica'}${seat ? ` · ${inMajority ? 'sei in maggioranza' : 'sei all’opposizione'}` : ' · non siedi in Parlamento'}` : government?.status === 'fallen' ? 'Caduto: verso un nuovo governo' : government?.status === 'caretaker' ? 'Dimissionario: affari correnti fino al nuovo governo' : government?.status === 'awaiting-confidence' ? 'In attesa della fiducia' : esc(state.society?.executive?.label ?? 'Esecutivo di scenario in carica')}</strong></span></li>
      <li>${glyph('users', 16)}<span><small>Umore dei cittadini</small><strong>${mood === null ? '—' : `${num(mood, 0)}/100 · ${mood < 45 ? 'chi governa rischia' : mood >= 58 ? 'premia chi governa' : 'neutro'}`}</strong></span></li>
      <li>${glyph('link', 16)}<span><small>Alleanze del partito</small><strong>${allyNames.length ? esc(allyNames.join(', ')) : poll ? 'Nessuna intesa attiva' : 'Nessun partito'}</strong></span></li>
    </ul>${chart ? `<div class="eh-chart"><span class="section-kicker">IL TUO PARTITO NEI SONDAGGI · SIMULATI</span>${chart}</div>` : ''}`;
}

function readiness(state) {
  const game = state.game;
  const party = game.party;
  const next = upcomingElections(game).find(item => ['upcoming', 'open'].includes(item.status));
  const selection = next ? party?.org?.selections?.[next.id] : null;
  const expectedPlace = party?.affiliation === 'member' ? Math.max(1, Math.min(6, 6 - party.rank - (party.support >= 70 ? 1 : 0))) : null;
  const rows = [
    ['Preparazione accumulata', `${num(game.prep, 0)}%`, game.prep >= 40 ? 'good' : game.prep >= 15 ? 'warn' : 'bad', 'Più preparazione, più risorse e sostegno alla partenza.'],
    ['Fondi personali', euro(game.resources.funds), game.resources.funds >= 3000 ? 'good' : 'warn', 'Il 60% passa alla campagna.'],
    ['Sostegno interno', party ? `${num(party.support, 0)}/100` : 'Indipendente', !party ? 'neutral' : party.support >= 60 ? 'good' : party.support >= 40 ? 'warn' : 'bad', 'Pesa sulla candidatura e sulla posizione in lista.'],
    ['Posizione in lista attesa', expectedPlace ? `${expectedPlace}ª` : party?.affiliation === 'founder' ? 'Capolista (fondatore)' : 'Lista civica', expectedPlace && expectedPlace <= 2 ? 'good' : 'warn', 'Nelle liste bloccate conta il posto; con le preferenze conta il tuo seguito.'],
    ['Selezione dei candidati', selection ? `${selection.method} · ${signed(selection.bonus, 0)}` : party?.affiliation === 'member' ? 'Non ancora aperta' : '—', selection ? toneOf(selection.bonus) : 'neutral', 'Si apre tre settimane prima delle candidature.']
  ];
  return `<ul class="eh-checklist">${rows.map(([label, value, tone, note]) => `<li class="tone-${tone}"><span><strong>${esc(label)}</strong><small>${esc(note)}</small></span><b>${value}</b></li>`).join('')}</ul><div class="sx-actions"><button class="secondary-button" data-game-activity="preparazione" ${state.campaign?.status === 'active' ? 'disabled' : ''}>Prepara la candidatura</button><button class="text-link" data-nav="finanze">Fondo elettorale ${arrow}</button><button class="text-link" data-nav="partito">Rapporti nel partito ${arrow}</button></div>`;
}

function rules(state) {
  const types = ['comunale', 'regionale', 'politiche', 'europee'];
  return `<ul class="eh-rules">${types.map(type => `<li>${glyph(TYPE_ICONS[type], 16)}<span><strong>${esc(ELECTION_MODELS[type].label)}</strong><small>${esc(SEAT_RULES[type]?.note ?? ELECTION_MODELS[type].strategy)} <a href="${esc(ELECTION_MODELS[type].referenceUrl)}" target="_blank" rel="noopener noreferrer">Fonte ↗</a></small></span></li>`).join('')}</ul>`;
}

function candidacy(state) {
  const campaign = state.campaign;
  const game = state.game;
  if (campaign?.status === 'active' || campaign?.status === 'finished') {
    const nomination = campaign.nomination;
    const strongest = Math.max(0, ...(campaign.internalCandidates ?? []).map(item => item.internalSupport));
    const odds = nomination.decision?.odds ?? Math.max(.01, Math.min(.95, .5 + (nomination.internalSupport - nomination.requiredSupport) * .09 + (nomination.internalSupport - strongest) * .12));
    const status = nomination.status === 'approved' ? ['Candidatura confermata', 'good'] : nomination.status === 'excluded' ? ['Esclusa dalla candidatura', 'bad'] : ['Da conquistare entro il giorno ' + nomination.deadlineDay, 'warn'];
    const rivals = (campaign.internalCandidates ?? []).map(item => `<li><span><strong>${esc(item.displayName)}</strong><small>${esc(item.lastAction ?? '')}</small></span><b>${num(item.internalSupport, 1)}/10</b>${bar(item.internalSupport * 10, 'bad')}</li>`).join('');
    const body = `<div class="eh-nomination"><div class="eh-nomination-head">${badge(status[0], status[1])}${nomination.incumbent ? badge('Uscente: ricandidatura da negoziare', 'warn') : ''}</div>
      <ul class="eh-bars"><li class="is-player"><span><strong>Il tuo sostegno interno</strong><small>soglia richiesta ${nomination.requiredSupport}/10</small></span><b>${num(nomination.internalSupport, 1)}/10</b>${bar(nomination.internalSupport * 10, 'good')}</li>${rivals}</ul>
      <div class="eh-odds">${kpi({ label: nomination.status === 'pending' ? 'Probabilità stimata di candidatura' : 'Probabilità al momento della decisione', value: `${Math.round(odds * 100)}%`, bar: odds * 100, tone: odds >= .6 ? 'good' : odds >= .35 ? 'warn' : 'bad', note: 'Superare la soglia non basta: conta anche il distacco dai concorrenti interni.' })}${kpi({ label: 'Posizione in lista', value: `${campaign.candidacy.listPosition}ª`, note: nomination.decision?.lowerPlace ? 'più bassa di quella attesa' : 'si migliora con riunioni e costruzione della lista' })}</div>
      ${nomination.memoryNote ? `<p class="sx-note">${esc(nomination.memoryNote)}</p>` : ''}${nomination.incumbencyNote ? `<p class="sx-note">${esc(nomination.incumbencyNote)}</p>` : ''}
      ${nomination.status === 'pending' ? `<div class="sx-actions"><button class="secondary-button" data-campaign-activity="party_meeting">Riunione del partito</button><button class="secondary-button" data-campaign-activity="list_building">Costruzione della lista</button></div>` : ''}</div>`;
    return card({ kicker: 'CANDIDATURA INTERNA · SIMULAZIONE', title: campaign.electionLabel, body });
  }
  const party = game.party;
  if (!party) return card({ kicker: 'CANDIDATURA', title: 'Corri da indipendente', body: '<p class="sx-note">Senza partito la candidatura è tua, ma parti senza la struttura, i fondi e i voti di lista di un partito. Puoi aderire a un partito dalla sezione Partito.</p>' });
  const rank = PARTY_RANKS[party.rank]?.title ?? party.rankTitle;
  return card({ kicker: 'CANDIDATURA · COME FUNZIONA', title: party.affiliation === 'founder' ? 'Da fondatore decidi tu le liste' : 'La candidatura si conquista nel partito', body: `<p class="sx-note">${party.affiliation === 'founder' ? 'Da fondatore sei candidato di diritto, ma il partito ha pochi voti di lista: coalizioni e territorio contano di più.' : `Oggi sei ${esc(rank.toLowerCase())}. All’avvio della campagna il partito valuta il tuo sostegno interno contro quello dei concorrenti: superare la soglia rende la candidatura probabile, non certa, e un margine stretto può costarti posti in lista.`}</p><ul class="eh-checklist"><li class="tone-${party.support >= 60 ? 'good' : 'warn'}"><span><strong>Sostegno interno</strong><small>riunioni, assemblee, lealtà</small></span><b>${num(party.support, 0)}/100</b></li><li class="tone-neutral"><span><strong>La tua area interna</strong><small>se guida il partito, ti sostiene</small></span><b>${esc(party.currents?.find(item => item.id === party.alignedCurrentId)?.label ?? 'nessuna')}</b></li></ul>` });
}

function rivals(state, parties, logoFor) {
  const campaign = state.campaign;
  if (campaign && campaign.status !== 'idle') {
    const summary = campaign.status === 'active' ? campaignSummary(campaign) : null;
    const standings = summary?.standings ?? (campaign.result?.groups ?? []).map((row, index) => ({ id: row.id, leaderCandidateId: row.candidateId, share: row.percent, position: index + 1, members: row.memberCandidateIds }));
    const rows = standings.map(group => {
      const candidate = campaign.candidates.find(item => item.id === group.leaderCandidateId);
      const party = parties.find(item => item.id === candidate?.partyId);
      const logo = party ? logoFor(party) : null;
      const name = candidate?.isPlayer ? 'La tua candidatura' : candidate?.realReference?.fullName ?? 'Candidatura simulata';
      const label = candidate?.isPlayer ? (party?.officialName ?? party?.name ?? 'Indipendente') : candidate?.realReference ? `Deputato in carica${candidate.realReference.groupName ? ` · ${candidate.realReference.groupName}` : ''}` : party?.officialName ?? party?.name ?? 'Lista simulata';
      return { _class: candidate?.isPlayer ? 'is-player' : '', pos: `${group.position}ª`, name: `<span class="eh-cand">${logo ? `<img src="${esc(logo)}" alt="" loading="lazy">` : `<i>${esc((party?.abbreviation ?? name).slice(0, 2))}</i>`}<span><strong>${esc(name)}</strong><small>${esc(label)}${(group.members?.length ?? 1) > 1 ? ` · coalizione di ${group.members.length}` : ''}</small></span></span>`, share: `<span class="eh-share"><b>${pct(group.share)}</b>${bar(group.share, candidate?.isPlayer ? 'good' : '')}</span>`, action: candidate?.isPlayer ? '' : esc(candidate?.lastAction ?? '') };
    });
    const trend = campaign.consensusHistory ?? [];
    const chart = trend.length > 1 ? lineChart({ series: [{ label: 'Proiezione', color: SERIES[0], values: trend.map(item => item.value), emphasis: true }, ...(campaign.expectation ? [{ label: 'Attesa iniziale', color: SERIES[3], values: trend.map(() => campaign.expectation.share) }] : [])], labels: trend.map(item => `G${item.day}`), unit: '%', height: 170, ariaLabel: 'Andamento della proiezione della campagna' }) : '';
    return card({ kicker: campaign.status === 'active' ? 'CORSA IN TEMPO REALE · PROIEZIONE SIMULATA' : 'CLASSIFICA FINALE · SIMULAZIONE', title: 'Chi è in corsa', body: `${table([['pos', 'Pos.'], ['name', 'Candidatura'], ['share', 'Consenso', 'num'], ['action', 'Ultima mossa']], rows)}${chart ? `<div class="eh-chart">${chart}</div>` : ''}<p class="sx-note">La proiezione è interna al gioco: non è un sondaggio. Le persone reali mostrano solo dati verificati; i numeri di campagna sono simulati.</p>` });
  }
  const poll = state.world?.polls?.at(-1);
  if (!poll) return card({ kicker: 'SONDAGGI', title: 'Nessun sondaggio', body: '<p class="sx-note">I sondaggi si aggiornano ogni settimana.</p>' });
  const rows = [...poll.results].sort((a, b) => b.share - a.share).slice(0, 10).map((row, index) => {
    const force = state.world.parties.find(item => item.id === row.partyId);
    return { _class: force?.isPlayer ? 'is-player' : '', pos: `${index + 1}ª`, name: `<strong>${esc(force?.label ?? row.partyId)}</strong>`, share: `<span class="eh-share"><b>${pct(row.share)}</b>${bar(row.share * 3, force?.isPlayer ? 'good' : '')}</span>`, delta: `<span class="tone-${toneOf(row.delta)}">${signed(row.delta)}</span>` };
  });
  return card({ kicker: `SONDAGGIO · ${poll.source === 'real' ? 'DATO REALE' : 'SIMULATO'} · ${esc(formatDate(poll.date ?? state.clock.currentDate))}`, title: 'Le forze nazionali', body: `${table([['pos', 'Pos.'], ['name', 'Forza'], ['share', 'Consenso', 'num'], ['delta', 'Variazione', 'num']], rows)}<p class="sx-note">Gli avversari diretti si conoscono all’avvio della campagna.</p><button class="text-link" data-nav="sondaggi">Tutti i sondaggi ${arrow}</button>` });
}

function history(state) {
  const entries = [...(state.career.electionHistory ?? [])].reverse();
  const rows = entries.map(item => ({ date: esc(formatDate(item.date)), type: esc(item.electionLabel ?? item.electionType), share: pct(item.percent), position: item.position ? `${item.position}ª` : '—', outcome: `${badge(item.outcomeLabel ?? (item.personalMandate ? 'Mandato' : 'Nessun mandato'), item.personalMandate ? 'good' : 'bad')}`, expectation: item.expectation === 'sopra' ? '<span class="tone-good">sopra</span>' : item.expectation === 'sotto' ? '<span class="tone-bad">sotto</span>' : item.expectation ? 'in linea' : '—', seats: num(item.seats, 0) }));
  const wins = entries.filter(item => item.personalMandate).length;
  return card({ kicker: 'STORICO ELETTORALE · SIMULAZIONE', title: `${entries.length} ${entries.length === 1 ? 'elezione' : 'elezioni'} · ${wins} con mandato`, body: table([['date', 'Data'], ['type', 'Elezione'], ['share', '%', 'num'], ['position', 'Pos.', 'num'], ['outcome', 'Esito'], ['expectation', 'Attese'], ['seats', 'Seggi lista', 'num']], rows, { empty: 'Nessuna elezione ancora disputata.' }) });
}

export function renderElectionsHub(state, { parties = [], logoFor = () => null, tab = null, national = null, geography = null, nationalView = null } = {}) {
  if (!state.game) return empty('Crea prima un politico per entrare nella centrale elettorale.', '<button class="primary-button" data-action="new-career">Crea il politico</button>');
  const active = ELECTION_TABS.some(([id]) => id === tab) ? tab : defaultElectionTab(state);
  const summary = state.campaign?.status === 'active' ? campaignSummary(state.campaign) : null;
  const formation = state.national?.formation;
  const counts = { campagna: state.campaign?.status === 'active' ? '●' : '', nazionali: state.national?.campaign || (formation && !['completata', 'fallita'].includes(formation.phase)) ? '●' : '', storico: (state.career.electionHistory ?? []).length || '' };
  let body = '';
  if (active === 'panoramica') body = `<div class="sx-grid two">${card({ kicker: 'CALENDARIO ELETTORALE', title: 'Quando si vota', body: calendar(state) })}${card({ kicker: 'CONTESTO POLITICO', title: 'Il clima del voto', body: context(state) })}</div><div class="sx-grid two">${card({ kicker: 'PREPARAZIONE', title: 'Quanto sei pronto', body: readiness(state) })}${card({ kicker: 'REGOLE DEL GIOCO', title: 'Come si assegnano i seggi', body: rules(state) })}</div>`;
  else if (active === 'candidatura') body = candidacy(state);
  else if (active === 'campagna') body = `<div class="eh-campaign">${renderCampaignPage(state, parties, logoFor)}</div>`;
  else if (active === 'avversari') body = rivals(state, parties, logoFor);
  else if (active === 'risultati') body = renderElectionReport(state.career.lastElectionReport);
  else if (active === 'nazionali') body = national ? renderNationalView(state, national(), { geography, view: nationalView }) : empty('Il ciclo nazionale si apre con i dati della partita: calendario, coalizioni e proiezione dei seggi.');
  else body = history(state);
  return `<div class="elections-hub">${hero(state, summary)}${sectionTabs('elezioni', ELECTION_TABS.map(([id, label]) => [id, label, counts[id]]), active)}<div class="sx-body" role="tabpanel">${body}</div></div>`;
}
