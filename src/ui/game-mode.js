import { activityProblem, costProblem, describeChoice, describeEffects, nextPartyRank, objectiveProgress, partyContestScore, situation, upcomingElections } from '../core/career-engine.js?v=20260924-13';
import { activeMinisters, CHAMBERS, parliamentGroupFacts } from '../core/parliament-engine.js?v=20260924-13';
import { ACTIVITY_CATEGORIES, PARTY_RANKS, STAT_LABELS, WEEKLY_ACTIVITIES } from '../data/simulation/career-rules.js?v=20260924-13';
import { careerLevelLabel } from '../data/regions.js?v=20260924-13';
import { formatDate } from '../core/time.js?v=20260924-13';
import { renderBarometerPanel } from './polls-mode.js?v=20260924-13';
import { artTile, CATEGORY_VISUALS, EVENT_ICONS, glyph, officeIcon } from './visuals.js?v=20260924-13';
import { ITALIAN_REGIONS } from '../data/regions.js?v=20260924-13';
import { societyMood } from '../core/society-engine.js?v=20260924-13';
import { financeOutlook } from '../core/finance-engine.js?v=20260924-13';
import { isPartyLeader, organOf } from '../core/organization-engine.js?v=20260924-13';
import { renderCountryCard, renderMediaPanel, renderTerritoryCard } from './society-mode.js?v=20260924-13';
import { renderFinanceCard } from './finance-mode.js?v=20260924-13';
import { renderContactsPanel, renderPartyCard } from './organization-mode.js?v=20260924-13';
import { stateBadge } from './charts.js?v=20260924-13';
import { illustration } from './illustrations.js?v=20260924-13';
import { SEGMENTS } from '../data/simulation/society-rules.js?v=20260924-13';
import { regionPriorities } from '../core/society-engine.js?v=20260924-13';

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

function hero(state, gc, options) {
  const { player, stats, units } = gc;
  const game = state.game;
  const office = state.dataset.offices.find(item => item.id === player?.roleId);
  const territory = state.dataset.territories.find(item => item.id === player?.territoryId)?.name ?? player?.region ?? 'Italia';
  const deltas = game.lastReport?.deltas ?? {};
  const live = Object.fromEntries(Object.keys(STAT_LABELS).map(metric => [metric, (stats[metric] ?? 0) - (game.weekStartStats?.[metric] ?? stats[metric] ?? 0)]));
  const delta = metric => live[metric] || deltas[metric] || 0;
  const partyChip = game.party ? `${esc(options.partyName || game.party.label || 'Partito')} · ${esc(game.party.rankTitle)}${game.party.org ? ` · ${esc(organOf(game.party).label)}` : ''}` : 'Indipendente';
  const status = game.status === 'ended' ? ['Carriera conclusa', 'ended'] : (stats.reputation ?? 50) < 20 || (game.party && game.party.support < 25) ? ['Carriera in pericolo', 'danger'] : ['Carriera attiva', 'ok'];
  const meters = STAT_ORDER.map(metric => `<div class="hq-meter"><span>${STAT_LABELS[metric]}</span><strong>${num(stats[metric] ?? 0)}</strong>${meter(stats[metric])}<em class="${delta(metric) > 0 ? 'up' : delta(metric) < 0 ? 'down' : ''}">${delta(metric) ? `${signed(delta(metric))} in settimana` : 'stabile'}</em></div>`).join('');
  // Careers that only track party-level consensus fall back to it, labelled as such.
  const partyConsensus = !('consensus' in stats) ? state.dataset.statistics.find(item => item.metric === 'consensus' && item.subjectId === (player?.partyId ?? state.career.partyId)) : null;
  const consensus = partyConsensus?.value ?? stats.consensus ?? 0;
  const consensusUnit = partyConsensus?.unit ?? units.consensus;
  return `<section class="hq-hero">
    ${illustration('palazzo', 'hq-hero-art')}
    <div class="hq-identity"><span class="section-kicker">IL TUO POLITICO · SETTIMANA ${game.week.index}</span><div class="hq-identity-row"><div class="hero-avatar">${player ? esc(player.firstName[0] + player.lastName[0]) : 'P'}</div><div><h1>${player ? esc(player.displayName) : 'Nessun politico'}</h1><p>${office ? `<span class="hq-office">${glyph(officeIcon(office), 15)}</span>${esc(office.endDate ? `${office.title} · concluso` : office.title)}` : 'Nessun incarico'} <span>·</span> ${esc(territory)}</p><div class="hq-chips"><span>${partyChip}</span><span>${esc(careerLevelLabel(state.career.currentLevel ?? state.career.initialLevel) ?? 'Percorso')}</span><span class="hq-status ${status[1]}">${status[0]}</span></div></div></div></div>
    <div class="hq-consensus"><span>CONSENSO</span><strong>${num(consensus)}${consensusUnit === '%' ? '%' : ''}</strong><small>${partyConsensus ? 'Consenso del partito' : delta('consensus') ? `${signed(delta('consensus'))} questa settimana` : 'Stabile questa settimana'}</small></div>
    <div class="hq-meters">${meters}</div>
  </section>`;
}
function weekBar(state) {
  const game = state.game;
  const dots = Array.from({ length: game.week.maxAp }, (_, index) => `<i class="${index < game.week.ap ? 'on' : ''}"></i>`).join('');
  const campaign = state.campaign?.status === 'active';
  return `<section class="hq-week">
    <div class="hq-days"><small>GIORNI DISPONIBILI</small><span class="hq-dots" aria-label="${game.week.ap} giorni su ${game.week.maxAp}">${dots}</span><strong>${game.week.ap} / ${game.week.maxAp}</strong></div>
    <div><small>FONDI</small><strong>${euro(game.resources.funds)}</strong>${game.finance ? `<em class="hq-sub ${financeOutlook(game).net < 0 ? 'down' : 'up'}">${financeOutlook(game).net >= 0 ? '+' : '−'}${euro(Math.abs(financeOutlook(game).net))}/sett.</em>` : ''}</div>
    <div><small>CAPITALE POLITICO</small><strong>${num(game.resources.politicalCapital, 0)}<i>/100</i></strong></div>
    <div><small>PREPARAZIONE ELETTORALE</small><strong>${num(game.prep, 0)}%</strong>${meter(game.prep, 'gold')}</div>
    <button class="primary-button hq-close-week" data-action="advance" ${game.status === 'ended' ? 'disabled' : ''}>${campaign ? 'Avanza la campagna' : 'Chiudi la settimana'} ${arrow}</button>
  </section>`;
}

export function renderInbox(state, { compact = false } = {}) {
  const game = state.game;
  if (!game.inbox.length) return `<p class="quiet-copy">Nessuna decisione in sospeso. Usa i giorni della settimana oppure chiudila.</p>`;
  const kinds = { evento: 'EVENTO', appuntamento: 'APPUNTAMENTO', urgente: 'URGENTE', situazione: 'DALLA SITUAZIONE' };
  return `<div class="hq-inbox-list">${game.inbox.map(item => {
    const fallback = item.choices.find(choice => choice.id === item.defaultChoice)?.label ?? '';
    const choices = item.choices.map(choice => {
      const info = describeChoice(item, choice.id);
      const problem = costProblem(game, choice.cost ?? {}) || (choice.requires === 'seat' && !state.parliament?.player?.groupId ? 'Serve un seggio con un gruppo parlamentare.' : choice.requires === 'party' && !game.party ? 'Serve un partito.' : null);
      return `<button class="hq-choice" data-agenda-item="${esc(item.id)}" data-agenda-choice="${esc(choice.id)}" ${problem || game.status === 'ended' ? `disabled title="${esc(problem)}"` : ''}><strong>${esc(choice.label)}</strong><span class="hq-cost">${costChips(choice.cost ?? {})}</span>${info.effects || info.risk ? `<small>${esc([info.effects, info.risk].filter(Boolean).join(' · '))}</small>` : ''}${problem ? `<em>${esc(problem)}</em>` : ''}</button>`;
    }).join('');
    const tone = item.kind === 'urgente' ? '#e34948' : item.kind === 'situazione' ? '#eb6834' : item.kind === 'evento' ? '#c0a166' : '#1baf7a';
    return `<article class="hq-card kind-${esc(item.kind)}"><div class="hq-card-head">${artTile(EVENT_ICONS[item.templateId] ?? 'star', tone)}<div><header><span class="hq-tag">${kinds[item.kind] ?? 'DECISIONE'}</span><small>Entro fine settimana · senza scelta: “${esc(fallback)}”</small></header><h3>${esc(item.title)}</h3>${compact ? '' : `<p>${esc(item.body)}</p>`}</div></div><div class="hq-choices">${choices}</div></article>`;
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
    return `<details class="hq-category" style="--cat:${visual.color}" ${['territorio', 'media', 'partito'].includes(category) || (category === 'parlamento' && gc.sit.seat) || (category === 'elezioni' && game.elections.some(item => item.status === 'open')) ? 'open' : ''}><summary><span class="cat-icon">${glyph(visual.icon, 16)}</span><span>${esc(label)}</span><small>${WEEKLY_ACTIVITIES.filter(activity => activity.category === category && !activityProblem(ctx, env, activity)).length} disponibili</small></summary>${rows}</details>`;
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
    const action = entry.status === 'open' && state.campaign?.status !== 'active' ? `<button class="text-link" data-nav="elezioni">Candidati ${arrow}</button>` : entry.status === 'upcoming' && state.campaign?.status !== 'active' && game.status !== 'ended' ? `<button class="text-link" data-game-fastforward="${esc(entry.type)}">Avanza fino alle candidature ${arrow}</button>` : '';
    return `<div class="hq-election ${entry.status}"><div><strong>${esc(entry.label)}${entry.early ? ' · anticipate' : ''}</strong>${status}<small>Voto il ${esc(formatDate(entry.electionDate))}</small></div>${action}</div>`;
  }).join('');
  const note = detailed ? `<p class="parliament-note">Calendario simulato con cicli accelerati rispetto ai mandati reali. Quando si aprono le candidature puoi avviare la campagna; se non ti candidi, un mandato dello stesso tipo si conclude. La preparazione accumulata (${num(game.prep, 0)}%), i fondi e il sostegno nel partito entrano nella campagna.</p>` : '';
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

function endedBanner(state, gc) {
  const game = state.game;
  if (game.status !== 'ended') return '';
  const done = objectiveProgress(gc.ctx, gc.env).filter(item => item.done).length;
  const offices = state.dataset.offices.filter(item => item.politicianId === gc.player?.id).length;
  return `<section class="hq-ended"><span class="section-kicker">FINE DELLA CARRIERA · ${esc(formatDate(game.endedAt))}</span><h2>La tua carriera si chiude qui.</h2><p>${esc(game.endReason)}. Settimane giocate: ${game.week.index} · traguardi: ${done} · incarichi ricoperti: ${offices}.</p><button class="primary-button" data-action="new-career">Inizia una nuova carriera ${arrow}</button></section>`;
}

// The phase of national politics, read from government, calendar, campaign and citizens.
export function politicalPhase(state) {
  const game = state.game;
  const government = state.parliament?.government;
  const date = state.clock.currentDate;
  if (state.campaign?.status === 'active') return ['campagna', 'Campagna elettorale in corso', 'ballot'];
  if (government?.status === 'crisis') return ['crisi', 'Crisi di governo', 'alert'];
  if (government?.status === 'awaiting-confidence') return ['trattativa', 'Trattative per il nuovo governo', 'link'];
  if (government?.status === 'fallen') return ['crisi', 'Governo caduto: verso il voto', 'alert'];
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
    : government?.status === 'awaiting-confidence' ? 'Governo in attesa della fiducia' : `${state.society?.executive?.label ?? 'Esecutivo di scenario'}${poll?.executive ? ` · gradimento ${num(poll.executive.approval, 0)}%` : ''}`;
  const mood = state.society ? societyMood(state.society) : null;
  const moodState = mood === null ? null : mood < 40 ? ['crisi', 'Malcontento'] : mood < 47 ? ['rischio', 'Clima teso'] : mood >= 58 ? ['crescita', 'Clima positivo'] : ['stabile', 'Clima stabile'];
  const [phaseKind, phaseLabel, phaseIcon] = politicalPhase(state);
  return `<section class="situation-bar phase-${phaseKind}">
    <div>${glyph('flag', 16)}<span><small>ITALIA · ${legislature.reference === 'real' ? 'DATO REALE' : 'SIMULAZIONE'}</small><strong>${esc(legislature.label)}</strong><em>${glyph(phaseIcon, 12)} ${esc(phaseLabel)}</em></span></div>
    <div>${glyph(governing ? 'ministry' : 'dome', 16)}<span><small>ESECUTIVO</small><strong>${esc(executive)}</strong><em>${governing ? 'nato in Parlamento nella simulazione' : 'scenario, non il governo reale'}</em></span></div>
    ${mood === null ? '' : `<div>${glyph('users', 16)}<span><small>UMORE DEL PAESE</small><strong>${num(mood, 0)}/100 ${stateBadge(moodState[0], moodState[1])}</strong></span></div>`}
    <div>${glyph('clock', 16)}<span><small>SETTIMANA ${game.week.index}</small><strong>${esc(formatDate(state.clock.currentDate))}</strong></span></div>
  </section>`;
}

// The staff briefing: what matters most this week, why, and where to act.
function briefing(state, gc) {
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

function dashboard(state) {
  const card = (kicker, title, body, page, icon, color) => `<article class="dash-card" style="--dash:${color}"><header>${artTile(icon, color, 'sm')}<div><span class="section-kicker">${kicker}</span><h3>${title}</h3></div><button class="text-link" data-nav="${page}" aria-label="Apri ${esc(title)}">${arrow}</button></header>${body}</article>`;
  return `<section class="dash-grid">
    ${card('STATO DEL PAESE', 'Cittadini ed economia', renderCountryCard(state), 'territori', 'globe', '#2a78d6')}
    ${card('IL TUO TERRITORIO', esc(state.game.place.region || 'Territorio'), renderTerritoryCard(state), 'territori', 'map', '#1baf7a')}
    ${card('PARTITO', state.game.party ? 'La tua organizzazione' : 'Indipendente', renderPartyCard(state), 'partito', 'flag', 'var(--party-accent)')}
    ${card('FINANZE', 'Il tuo comitato', renderFinanceCard(state), 'finanze', 'wallet', '#eda100')}
  </section>`;
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

export function renderHeadquarters(state, options = {}) {
  const gc = gameContext(state);
  const game = state.game;
  const panel = (kicker, title, body, extra = '', id = '') => `<section class="hq-panel" ${id ? `id="${id}"` : ''}><div class="home-section-heading"><div><span class="section-kicker">${kicker}</span><h2>${title}</h2></div>${extra}</div>${body}</section>`;
  const media = state.society ? renderMediaPanel(state, { compact: true }) : '';
  return `<div class="hq">${endedBanner(state, gc)}${situationBar(state)}${hero(state, gc, options)}${weekBar(state)}${briefing(state, gc)}${dashboard(state)}
    <div class="hq-grid">
      <div class="hq-main">
        ${panel('QUESTA SETTIMANA', 'Da decidere', renderInbox(state), `<span class="hq-count">${game.inbox.length}</span>`, 'hq-inbox')}
        ${panel('AGENDA DEL POLITICO', 'Come usi la settimana', planner(state, gc), `<span class="hq-count">${game.week.ap} giorni</span>`, 'hq-planner')}
        ${panel('CAUSE ED EFFETTI', 'Le conseguenze delle scelte', consequencesPanel(state) + (media ? `<div class="home-section-heading hq-sub-heading"><div><span class="section-kicker">SUI MEDIA</span></div><button class="text-link" data-nav="sondaggi">Media e sondaggi</button></div>${media}` : ''))}
      </div>
      <aside class="hq-side">
        ${state.world ? panel('SONDAGGI · SIMULATI', 'Barometro e cronaca', renderBarometerPanel(state), '<button class="text-link" data-nav="sondaggi">Sondaggi</button>') : ''}
        ${panel('PARLAMENTO E GOVERNO', gc.sit.seat ? 'La tua posizione in Aula' : 'Le Camere', parliamentPanel(state))}
        ${panel('SCADENZE E OBIETTIVI', 'Elezioni, congressi, promesse', deadlinesPanel(state, gc), '<button class="text-link" data-nav="calendario">Agenda</button>')}
        ${panel('RELAZIONI', 'Chi conta per te', relationsPanel(state) + `<div class="home-section-heading hq-sub-heading"><div><span class="section-kicker">PARLAMENTARI REALI</span></div><button class="text-link" data-nav="parlamento">Tutti</button></div>${renderContactsPanel(state, { compact: true })}`)}
      </aside>
    </div>
    <footer class="home-footer"><span>POLITICANDO 2026</span><span>Persone e dati istituzionali reali restano in sola lettura (dati verificati); carriera, cittadini, territori, economia, media e relazioni sono simulati.</span></footer></div>`;
}

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
  const score = party.affiliation === 'member' ? partyContestScore(gc.ctx) : null;
  const cooldown = party.lastRankContestWeek && game.week.index - party.lastRankContestWeek < 3 ? `Nuovo tentativo dalla settimana ${party.lastRankContestWeek + 3}.` : '';
  const blocker = !next ? '' : cooldown || costProblem(game, { ap: 2, capital: 4 });
  const ladder = party.affiliation === 'founder'
    ? `<ol class="party-ladder"><li class="current"><span>${esc(party.rankTitle)}</span></li></ol>`
    : `<ol class="party-ladder">${PARTY_RANKS.map(rank => `<li class="${rank.level < party.rank ? 'done' : rank.level === party.rank ? 'current' : ''}"><span>${esc(rank.title)}</span>${rank.threshold ? `<small>soglia ${rank.threshold}</small>` : ''}</li>`).join('')}</ol>`;
  const currents = [...party.currents].sort((a, b) => b.strength - a.strength).map(current => `<div class="party-current ${party.alignedCurrentId === current.id ? 'aligned' : ''}"><div><strong>${esc(current.label)}${party.leaderCurrentId === current.id ? ' <em>guida il partito</em>' : ''}</strong><small>Peso interno ${current.strength}% · rapporto ${num(current.value ?? current.relation, 0)}/100</small>${meter(current.value ?? current.relation)}</div>${party.alignedCurrentId === current.id ? '<span class="hq-tag">LA TUA AREA</span>' : `<button class="secondary-button" data-party-current="${esc(current.id)}" ${costProblem(game, { ap: 1 }) ? 'disabled' : ''}>Schierati · 1 giorno</button>`}</div>`).join('');
  const log = game.log.filter(entry => entry.kind === 'partito' || /congresso|partito/i.test(entry.title)).slice(0, 5).map(entry => `<article class="hq-log tone-${esc(entry.tone)}"><time>S${entry.week}</time><div><strong>${esc(entry.title)}</strong>${entry.lines?.length ? `<small>${esc(entry.lines.join(' · '))}</small>` : ''}</div></article>`).join('');
  return `<section class="party-position"><div class="home-section-heading"><div><span class="section-kicker">POSIZIONE NEL PARTITO · SIMULAZIONE</span><h2>${esc(party.rankTitle)}</h2></div><button class="text-link" data-party-action="leave">Lascia il partito</button></div>
    <div class="party-metrics"><div><small>SOSTEGNO INTERNO</small><strong>${num(party.support, 0)}</strong>${meter(party.support, party.support < 25 ? 'danger' : '')}</div>${leadership ? `<div><small>RAPPORTO CON LA LEADERSHIP</small><strong>${num(leadership.value, 0)}</strong>${meter(leadership.value)}</div>` : ''}<div><small>AREA DI RIFERIMENTO</small><strong class="small">${esc(party.currents.find(item => item.id === party.alignedCurrentId)?.label ?? 'Nessuna')}</strong></div></div>
    ${ladder}
    ${next ? `<div class="party-contest"><div><strong>Prossimo incarico: ${esc(next.title)}</strong><small>Il tuo punteggio interno è ${score} su una soglia di ${next.threshold}: contano sostegno, rapporto con la leadership, influenza e l’area che guida il partito.</small></div><button class="primary-button" data-party-action="contest" ${blocker ? 'disabled' : ''}>Candidati · 2 giorni · 4 cap.</button>${blocker ? `<em>${esc(blocker)}</em>` : ''}</div>` : ''}
    ${party.support < 25 && party.affiliation === 'member' ? '<div class="hq-note danger">Il sostegno interno è molto basso: sotto quota 20 il partito può avviare un procedimento di espulsione.</div>' : ''}
    <div class="home-section-heading"><div><span class="section-kicker">CORRENTI INTERNE · SIMULATE</span><h3>Equilibri del partito</h3></div></div><div class="party-currents">${currents}</div>
    ${log ? `<div class="hq-log-list">${log}</div>` : ''}
    <p class="parliament-note">Correnti, leadership e incarichi interni sono ruoli di gioco: non rappresentano persone o organi reali del partito.</p></section>`;
}
