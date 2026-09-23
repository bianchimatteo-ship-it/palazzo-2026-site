import { activityProblem, costProblem, describeChoice, describeEffects, nextPartyRank, objectiveProgress, partyContestScore, situation, upcomingElections } from '../core/career-engine.js?v=20260924-3';
import { activeMinisters, CHAMBERS, parliamentGroupFacts } from '../core/parliament-engine.js?v=20260924-3';
import { ACTIVITY_CATEGORIES, PARTY_RANKS, STAT_LABELS, WEEKLY_ACTIVITIES } from '../data/simulation/career-rules.js?v=20260924-3';
import { careerLevelLabel } from '../data/regions.js?v=20260924-3';
import { formatDate } from '../core/time.js?v=20260924-3';

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
  const partyChip = game.party ? `${esc(options.partyName || game.party.label || 'Partito')} · ${esc(game.party.rankTitle)}` : 'Indipendente';
  const status = game.status === 'ended' ? ['Carriera conclusa', 'ended'] : (stats.reputation ?? 50) < 20 || (game.party && game.party.support < 25) ? ['Carriera in pericolo', 'danger'] : ['Carriera attiva', 'ok'];
  const meters = STAT_ORDER.map(metric => `<div class="hq-meter"><span>${STAT_LABELS[metric]}</span><strong>${num(stats[metric] ?? 0)}</strong>${meter(stats[metric])}<em class="${delta(metric) > 0 ? 'up' : delta(metric) < 0 ? 'down' : ''}">${delta(metric) ? `${signed(delta(metric))} in settimana` : 'stabile'}</em></div>`).join('');
  // Careers that only track party-level consensus fall back to it, labelled as such.
  const partyConsensus = !('consensus' in stats) ? state.dataset.statistics.find(item => item.metric === 'consensus' && item.subjectId === (player?.partyId ?? state.career.partyId)) : null;
  const consensus = partyConsensus?.value ?? stats.consensus ?? 0;
  const consensusUnit = partyConsensus?.unit ?? units.consensus;
  return `<section class="hq-hero">
    <div class="hq-identity"><span class="section-kicker">IL TUO POLITICO · SETTIMANA ${game.week.index}</span><div class="hq-identity-row"><div class="hero-avatar">${player ? esc(player.firstName[0] + player.lastName[0]) : 'P'}</div><div><h1>${player ? esc(player.displayName) : 'Nessun politico'}</h1><p>${office ? esc(office.endDate ? `${office.title} · concluso` : office.title) : 'Nessun incarico'} <span>·</span> ${esc(territory)}</p><div class="hq-chips"><span>${partyChip}</span><span>${esc(careerLevelLabel(state.career.currentLevel ?? state.career.initialLevel) ?? 'Percorso')}</span><span class="hq-status ${status[1]}">${status[0]}</span></div></div></div></div>
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
    <div><small>FONDI</small><strong>${euro(game.resources.funds)}</strong></div>
    <div><small>CAPITALE POLITICO</small><strong>${num(game.resources.politicalCapital, 0)}<i>/100</i></strong></div>
    <div><small>PREPARAZIONE ELETTORALE</small><strong>${num(game.prep, 0)}%</strong>${meter(game.prep, 'gold')}</div>
    <button class="primary-button hq-close-week" data-action="advance" ${game.status === 'ended' ? 'disabled' : ''}>${campaign ? 'Avanza la campagna' : 'Chiudi la settimana'} ${arrow}</button>
  </section>`;
}

export function renderInbox(state, { compact = false } = {}) {
  const game = state.game;
  if (!game.inbox.length) return `<p class="quiet-copy">Nessuna decisione in sospeso. Usa i giorni della settimana oppure chiudila.</p>`;
  const kinds = { evento: 'EVENTO', appuntamento: 'APPUNTAMENTO', urgente: 'URGENTE' };
  return `<div class="hq-inbox-list">${game.inbox.map(item => {
    const fallback = item.choices.find(choice => choice.id === item.defaultChoice)?.label ?? '';
    const choices = item.choices.map(choice => {
      const info = describeChoice(item, choice.id);
      const problem = costProblem(game, choice.cost ?? {});
      return `<button class="hq-choice" data-agenda-item="${esc(item.id)}" data-agenda-choice="${esc(choice.id)}" ${problem || game.status === 'ended' ? `disabled title="${esc(problem)}"` : ''}><strong>${esc(choice.label)}</strong><span class="hq-cost">${costChips(choice.cost ?? {})}</span>${info.effects || info.risk ? `<small>${esc([info.effects, info.risk].filter(Boolean).join(' · '))}</small>` : ''}${problem ? `<em>${esc(problem)}</em>` : ''}</button>`;
    }).join('');
    return `<article class="hq-card kind-${esc(item.kind)}"><header><span class="hq-tag">${kinds[item.kind] ?? 'DECISIONE'}</span><small>Entro fine settimana · senza scelta: “${esc(fallback)}”</small></header><h3>${esc(item.title)}</h3>${compact ? '' : `<p>${esc(item.body)}</p>`}<div class="hq-choices">${choices}</div></article>`;
  }).join('')}</div>`;
}

function planner(state, gc) {
  const { ctx, env } = gc;
  const game = state.game;
  const parliament = state.parliament;
  const targets = {
    current: (game.party?.currents ?? []).map(item => [item.id, `${item.label} · ${num(item.value ?? item.relation, 0)}`]),
    character: game.relations.map(item => [item.id, `${item.label} · ${num(item.value, 0)}`]),
    group: parliament?.player ? (parliament.chambers[parliament.player.chamber]?.groups ?? []).filter(group => group.groupId !== parliament.player.groupId).map(group => [group.groupId, `${group.officialName} · ${num(parliament.relations?.[group.groupId]?.value ?? 50, 0)}`]) : []
  };
  const groups = Object.entries(ACTIVITY_CATEGORIES).map(([category, label]) => {
    const rows = WEEKLY_ACTIVITIES.filter(activity => activity.category === category).map(activity => {
      const problem = activityProblem(ctx, env, activity);
      const target = activity.target && targets[activity.target]?.length ? `<select data-activity-target="${esc(activity.id)}" aria-label="Destinatario">${targets[activity.target].map(([id, text]) => `<option value="${esc(id)}">${esc(text)}</option>`).join('')}</select>` : '';
      return `<div class="hq-activity ${problem ? 'is-blocked' : ''}"><div class="hq-activity-copy"><strong>${esc(activity.label)}</strong><small>${esc(activity.detail)}</small><span>${esc(describeEffects(activity.effects))}${activity.risk ? ` · rischio ${Math.round(activity.risk.chance * 100)}%` : ''}</span></div><div class="hq-cost">${costChips(activity.cost)}</div><div class="hq-activity-action">${target}<button class="secondary-button" data-game-activity="${esc(activity.id)}" ${problem ? 'disabled' : ''}>Fai</button>${problem ? `<em>${esc(problem)}</em>` : ''}</div></div>`;
    }).join('');
    return `<details class="hq-category" ${['territorio', 'media', 'partito'].includes(category) || (category === 'parlamento' && gc.sit.seat) || (category === 'elezioni' && game.elections.some(item => item.status === 'open')) ? 'open' : ''}><summary><span>${esc(label)}</span><small>${WEEKLY_ACTIVITIES.filter(activity => activity.category === category && !activityProblem(ctx, env, activity)).length} disponibili</small></summary>${rows}</details>`;
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
    const status = entry.status === 'open' ? `<b class="hq-open">Candidature aperte fino al ${esc(shortDate(entry.windowClosesAt))}</b>` : entry.status === 'running' ? '<b class="hq-open">Campagna in corso</b>' : entry.status === 'missed' ? `<b class="hq-missed">Candidature chiuse · voto il ${esc(shortDate(entry.electionDate))}</b>` : `<span>Candidature dal ${esc(shortDate(entry.windowOpensAt))} · tra ${weeksUntil(today, entry.windowOpensAt)} settimane</span>`;
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

function partyPanel(state, options) {
  const party = state.game.party;
  if (!party) return `<p class="quiet-copy">Sei indipendente: nessuna leadership da convincere, ma nessuna struttura alle spalle.</p><button class="text-link" data-nav="partito">Valuta un partito ${arrow}</button>`;
  const leadership = state.game.relations.find(item => item.id === 'leadership');
  const aligned = party.currents.find(item => item.id === party.alignedCurrentId);
  return `<dl class="hq-facts"><div><dt>Partito</dt><dd>${esc(options.partyName || party.label || 'Partito')}</dd></div><div><dt>Ruolo</dt><dd>${esc(party.rankTitle)}</dd></div><div><dt>Sostegno interno</dt><dd>${num(party.support, 0)}/100 ${meter(party.support, party.support < 25 ? 'danger' : '')}</dd></div>${leadership ? `<div><dt>Leadership</dt><dd>${num(leadership.value, 0)}/100</dd></div>` : ''}<div><dt>Corrente</dt><dd>${esc(aligned?.label ?? 'Nessuna')}</dd></div></dl><button class="text-link" data-nav="partito">Posizione nel partito ${arrow}</button>`;
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

export function renderHeadquarters(state, options = {}) {
  const gc = gameContext(state);
  const game = state.game;
  const panel = (kicker, title, body, extra = '') => `<section class="hq-panel"><div class="home-section-heading"><div><span class="section-kicker">${kicker}</span><h2>${title}</h2></div>${extra}</div>${body}</section>`;
  return `<div class="hq">${endedBanner(state, gc)}${hero(state, gc, options)}${weekBar(state)}
    <div class="hq-grid">
      <div class="hq-main">
        ${panel('QUESTA SETTIMANA', 'Da decidere', renderInbox(state), `<span class="hq-count">${game.inbox.length}</span>`)}
        ${panel('AGENDA DEL POLITICO', 'Come usi la settimana', planner(state, gc), `<span class="hq-count">${game.week.ap} giorni</span>`)}
        ${panel('DIARIO', 'Cosa è successo', reportPanel(state))}
      </div>
      <aside class="hq-side">
        ${panel('PROGRESSIONE', 'Traguardi', objectivesPanel(gc))}
        ${panel('CALENDARIO ELETTORALE', 'Prossime elezioni', renderElectionCalendar(state), '<button class="text-link" data-nav="elezioni">Elezioni</button>')}
        ${panel('PARLAMENTO', gc.sit.seat ? 'La tua posizione in Aula' : 'Le Camere', parliamentPanel(state))}
        ${panel('PARTITO', game.party ? 'Il tuo peso interno' : 'Indipendente', partyPanel(state, options))}
        ${panel('RELAZIONI', 'Chi conta per te', relationsPanel(state))}
      </aside>
    </div>
    <footer class="home-footer"><span>POLITICANDO 2026</span><span>Personaggi, relazioni ed eventi della carriera sono simulati; i riferimenti istituzionali reali restano in sola lettura.</span></footer></div>`;
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
