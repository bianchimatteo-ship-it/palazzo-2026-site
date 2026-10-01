// CARRIERA — the path and the progression: four tracks (institutions, party, Parliament, Government), the odds of
// every next step with the factors that decide them, offices and powers, the timeline and the goals.
import { careerOverview } from '../core/career-overview.js?v=20260926-6';
import { ADVANCEMENT_OUTCOMES } from '../core/progression-engine.js?v=20260926-6';
import { STAT_LABELS } from '../data/simulation/career-rules.js?v=20260926-6';
import { careerLevelLabel } from '../data/regions.js?v=20260926-6';
import { formatDate } from '../core/time.js?v=20260926-6';
import { glyph, officeIcon } from './visuals.js?v=20260926-6';
import { renderCareerTimeline, renderMemoryPanel, renderObjectivesPanel, renderRolesPanel, renderWhyPanel } from './game-mode.js?v=20260926-6';
import { arrow, badge, bar, card, empty, esc, num, sectionHero, sectionTabs, signed, table } from './sections-kit.js?v=20260926-6';

export const CAREER_TABS = Object.freeze([['percorso', 'Percorso'], ['progressione', 'Progressione'], ['incarichi', 'Incarichi e poteri'], ['cronologia', 'Cronologia'], ['obiettivi', 'Obiettivi']]);
const STAT_ORDER = ['popularity', 'reputation', 'influence', 'experience', 'notoriety'];
const OUTCOME_TONES = { promosso: 'good', 'incarico-inferiore': 'warn', stallo: 'neutral', 'sconfitta-interna': 'bad', retrocessione: 'bad' };
const OUTCOME_HELP = {
  promosso: 'Ottieni l’incarico a cui puntavi.',
  'incarico-inferiore': 'Ti riconoscono qualcosa, ma meno di quanto chiedevi.',
  stallo: 'La decisione slitta: riprovi più avanti, senza grossi danni.',
  'sconfitta-interna': 'Passa un altro nome: sostegno e rapporti ne risentono.',
  retrocessione: 'Se sei molto sotto la soglia, la sfida può costarti l’incarico che hai.'
};
const pctOf = chance => `${Math.round((chance ?? 0) * 100)}%`;
const chanceTone = chance => chance >= .6 ? 'good' : chance >= .35 ? 'warn' : 'bad';

// The button of a track's action: the same controls used everywhere else in the game.
function actionButton(action, blocker, primary = true) {
  if (!action) return '';
  const cls = primary ? 'primary-button' : 'secondary-button';
  const disabled = blocker ? `disabled title="${esc(blocker)}"` : '';
  if (action.type === 'party-contest') return `<button class="${cls}" data-party-action="contest" ${disabled}>${esc(action.label)}</button>`;
  if (action.type === 'parliament-contest') return `<button class="${cls}" data-parliament-action="contest-role" ${disabled}>${esc(action.label)}</button>`;
  if (action.type === 'tab') return `<button class="secondary-button" data-section-tab="${esc(action.section)}" data-section-tab-value="${esc(action.tab)}">${esc(action.label)} ${arrow}</button>`;
  return `<button class="secondary-button" data-nav="${esc(action.page)}">${esc(action.label)} ${arrow}</button>`;
}

function stepper(steps) {
  if (!steps.length) return '';
  return `<ol class="cp-steps">${steps.map(step => `<li class="${step.current ? 'is-current' : step.done ? 'is-done' : ''}"><i aria-hidden="true">${step.done ? '✓' : step.current ? '●' : ''}</i><span>${esc(step.label)}${step.threshold ? `<small>soglia ${step.threshold}</small>` : ''}</span>${step.current ? '<em>ora</em>' : ''}</li>`).join('')}</ol>`;
}

function trackCard(track) {
  const odds = track.odds ? `<div class="cp-odds tone-${chanceTone(track.odds.chance)}"><strong>${pctOf(track.odds.chance)}</strong><span>probabilità stimata${track.odds.score !== null && track.odds.threshold ? ` · punteggio ${num(track.odds.score, 0)} su soglia ${track.odds.threshold}` : ''}</span>${bar(track.odds.chance * 100, chanceTone(track.odds.chance))}</div>` : '';
  const next = track.next ? `<div class="cp-next"><small>PROSSIMO PASSO</small><strong>${esc(track.next.title)}</strong><span>${esc(track.next.when)}</span></div>` : '<div class="cp-next"><small>PROSSIMO PASSO</small><strong>Nessun passo ulteriore su questo percorso</strong></div>';
  return `<article class="cp-track track-${esc(track.id)}">
    <header><span class="cp-track-icon">${glyph(track.icon, 18)}</span><div><span class="section-kicker">${esc(track.label.toUpperCase())}</span><h3>${esc(track.position)}</h3></div></header>
    ${stepper(track.steps)}
    ${next}${odds}
    <p class="sx-note">${esc(track.requirement)}</p>
    ${track.problems?.length > 1 ? `<ul class="cp-problems">${track.problems.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
    <div class="sx-actions">${actionButton(track.action, ['party-contest', 'parliament-contest'].includes(track.action?.type) ? track.blocker : null)}${track.blocker && !(track.problems?.length > 1) ? `<em class="cp-blocker">${esc(track.blocker)}</em>` : ''}</div>
  </article>`;
}

// Where the career started and the chapter it is in.
function origin(state, player) {
  const territory = state.dataset.territories.find(item => item.id === state.career.territoryId)?.name ?? player?.region ?? 'Italia';
  const start = (state.game.timeline ?? [])[0];
  const rows = [
    ['Livello iniziale', esc(careerLevelLabel(state.career.initialLevel) ?? 'Da definire')],
    ['Territorio', esc(territory)],
    ['Professione precedente', esc(player?.previousProfession ?? '—')],
    ['Inizio della carriera', start?.date ? esc(formatDate(start.date)) : '—'],
    ['Settimane di carriera', num(state.game.week.index, 0)],
    ['Partiti cambiati', num((state.game.pastParties ?? []).length, 0)]
  ];
  return `<dl class="cp-facts">${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function factorTable(odds) {
  const rows = odds.factors.map(item => ({ label: `<strong>${esc(item.label)}</strong>`, value: `<span class="cp-factor">${num(item.value, 0)}${bar(item.value, item.value >= 60 ? 'good' : item.value < 40 ? 'bad' : '')}</span>`, weight: `${Math.round(item.weight * 100)}%`, contribution: num(item.contribution, 1) }));
  const moment = (odds.moment ?? []).map(item => ({ label: `<span>${esc(item.label)}</span>`, value: '—', weight: 'momento', contribution: `<span class="tone-${item.value >= 0 ? 'good' : 'bad'}">${signed(item.value, 0)}</span>` }));
  if (odds.bonus) moment.push({ label: '<span>Proposta della segreteria</span>', value: '—', weight: 'bonus', contribution: `<span class="tone-good">${signed(odds.bonus, 0)}</span>` });
  return table([['label', 'Fattore'], ['value', 'Valore (0–100)'], ['weight', 'Peso', 'num'], ['contribution', 'Punti', 'num']], [...rows, ...moment]);
}

export function renderOddsCard(track) {
  if (!track.odds) return '';
  const factors = track.odds.factors?.length ? factorTable(track.odds) : '';
  const outcomes = `<ul class="cp-outcomes">${Object.entries(ADVANCEMENT_OUTCOMES).map(([id, item]) => `<li>${badge(item.label, OUTCOME_TONES[id])}<small>${esc(OUTCOME_HELP[id])}</small></li>`).join('')}</ul>`;
  const body = `<div class="cp-odds-big tone-${chanceTone(track.odds.chance)}"><strong>${pctOf(track.odds.chance)}</strong><span>${track.odds.threshold ? `Punteggio <b>${num(track.odds.score, 1)}</b> su soglia <b>${track.odds.threshold}</b>: ${track.odds.score >= track.odds.threshold ? 'sei sopra la soglia, ma la nomina resta incerta' : 'sei sotto la soglia: servono fortuna o più sostegno'}.` : 'Stima del Presidente del Consiglio (simulato): influenza, reputazione, sostegno nel gruppo e stabilità del governo.'}</span>${bar(track.odds.chance * 100, chanceTone(track.odds.chance))}</div>
    ${factors}
    <h4 class="cp-sub">Come può finire</h4>${outcomes}
    <div class="sx-actions">${actionButton(track.action, ['party-contest', 'parliament-contest'].includes(track.action?.type) ? track.blocker : null)}${track.blocker ? `<em class="cp-blocker">${esc(track.blocker)}</em>` : ''}</div>`;
  return card({ kicker: `${track.label.toUpperCase()} · PROBABILITÀ SIMULATA`, title: track.next?.title ?? track.position, body, tone: chanceTone(track.odds.chance) === 'good' ? 'good' : '' });
}

function contestsTable(contests) {
  const rows = contests.map(item => ({
    date: item.date ? esc(formatDate(item.date, { day: 'numeric', month: 'short', year: 'numeric' })) : item.week ? `S${item.week}` : '—',
    track: esc(item.trackLabel ?? item.track ?? ''),
    target: `<strong>${esc(item.target ?? '')}</strong>${item.kind === 'proposta' ? '<small> · proposta della segreteria</small>' : ''}`,
    chance: item.chance !== null && item.chance !== undefined ? pctOf(item.chance) : '—',
    outcome: badge(item.label ?? ADVANCEMENT_OUTCOMES[item.outcome]?.label ?? item.outcome, OUTCOME_TONES[item.outcome] ?? 'neutral')
  }));
  return table([['date', 'Data'], ['track', 'Percorso'], ['target', 'Obiettivo'], ['chance', 'Probabilità', 'num'], ['outcome', 'Esito']], rows, { empty: 'Nessun tentativo ancora: quando proverai a salire, qui resteranno probabilità ed esito.' });
}

function officesCard(state, player) {
  const offices = state.dataset.offices.filter(item => item.politicianId === player?.id).sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  const current = offices.filter(item => !item.endDate);
  const past = offices.filter(item => item.endDate);
  const row = item => `<li><span class="cp-office-icon">${glyph(officeIcon(item), 16)}</span><span><strong>${esc(item.title)}</strong><small>${esc(item.institution ?? '')} · dal ${esc(formatDate(item.startDate, { day: 'numeric', month: 'short', year: 'numeric' }))}${item.endDate ? ` al ${esc(formatDate(item.endDate, { day: 'numeric', month: 'short', year: 'numeric' }))}` : ''}</small></span>${item.endDate ? badge('Concluso', 'neutral') : badge('In corso', 'good')}</li>`;
  const minor = state.game.party?.minorRoles ?? [];
  return `${current.length ? `<ul class="cp-offices">${current.map(row).join('')}</ul>` : '<p class="sx-empty">Nessun incarico in corso: si conquistano alle elezioni, nel partito e in Parlamento.</p>'}
    ${minor.length ? `<h4 class="cp-sub">Incarichi minori ottenuti</h4><ul class="cp-offices is-minor">${minor.map(item => `<li><span class="cp-office-icon">${glyph('flag', 16)}</span><span><strong>${esc(item.title)}</strong><small>settimana ${item.week} · simulazione</small></span></li>`).join('')}</ul>` : ''}
    ${past.length ? `<details class="cp-past"><summary>Incarichi conclusi (${past.length})</summary><ul class="cp-offices">${past.map(row).join('')}</ul></details>` : ''}
    <p class="sx-note">Incarichi della partita: sono simulazioni e non modificano i dati reali delle istituzioni.</p>`;
}

function hero(state, player, overview) {
  const game = state.game;
  const stats = overview.stats;
  const office = state.dataset.offices.find(item => item.id === player?.roleId && !item.endDate) ?? state.dataset.offices.find(item => item.politicianId === player?.id && !item.endDate);
  const territory = state.dataset.territories.find(item => item.id === player?.territoryId)?.name ?? player?.region ?? 'Italia';
  const delta = metric => (stats[metric] ?? 0) - (game.weekStartStats?.[metric] ?? stats[metric] ?? 0) || game.lastReport?.deltas?.[metric] || 0;
  const status = game.flags?.comebackFrom ? ['Traversata nel deserto', 'bad'] : (stats.reputation ?? 50) < 20 || (game.party && game.party.support < 25) ? ['Carriera in pericolo', 'bad'] : ['Carriera attiva', 'good'];
  const focusTrack = overview.focus ? overview.tracks.find(track => track.id === overview.focus.track) : null;
  const focusAction = focusTrack ? actionButton(focusTrack.action, ['party-contest', 'parliament-contest'].includes(focusTrack.action?.type) ? focusTrack.blocker : null) : `<button class="primary-button" data-section-tab="carriera" data-section-tab-value="progressione">Valuta i prossimi passi ${arrow}</button>`;
  return sectionHero({
    kicker: `IL TUO PERCORSO · ${(careerLevelLabel(state.career.currentLevel ?? state.career.initialLevel) ?? 'CARRIERA').toUpperCase()} · SIMULAZIONE`, icon: 'route',
    title: player?.displayName ?? 'Il tuo politico',
    lead: `${office ? office.title : 'Nessun incarico'} · ${territory}${game.party ? ` · ${game.party.rankTitle}` : ' · indipendente'}. ${overview.focus ? overview.focus.text : 'Nessun passo è automatico: ogni promozione dipende da numeri, rapporti e momento politico.'}`,
    actions: `${focusAction}<button class="secondary-button" data-action="new-career">Nuova carriera</button>`,
    aside: badge(status[0], status[1]),
    kpis: [...STAT_ORDER.map(metric => ({ label: STAT_LABELS[metric], value: num(stats[metric] ?? 0, 0), bar: stats[metric] ?? 0, note: delta(metric) ? `<span class="tone-${delta(metric) > 0 ? 'good' : 'bad'}">${signed(delta(metric))}</span> in settimana` : 'stabile', tone: (stats[metric] ?? 0) < 25 ? 'bad' : '' })), { label: 'Capitale politico', value: `${num(game.resources.politicalCapital, 0)}<small>/100</small>`, note: 'serve per sfide e trattative' }]
  });
}

export function renderCareerPage(state, { tab = null, timelineFilter = 'tutto' } = {}) {
  const player = state.dataset?.politicians?.find(item => item.id === state.career?.playerId) ?? null;
  if (!state.game || !player) return empty('Crea il tuo politico per iniziare il percorso.', '<button class="primary-button" data-action="new-career">Crea il tuo politico</button>');
  const overview = careerOverview(state);
  const active = CAREER_TABS.some(([id]) => id === tab) ? tab : 'percorso';
  const counts = { progressione: overview.tracks.filter(track => track.odds && !track.blocker).length || '', cronologia: (state.game.timeline ?? []).length || '' };
  let body = '';
  if (active === 'percorso') {
    body = `<div class="cp-tracks">${overview.tracks.map(trackCard).join('')}</div>
      <div class="sx-grid two">${card({ kicker: 'PUNTO DI PARTENZA', title: 'Da dove sei partito', body: origin(state, player) })}${card({ kicker: 'TENTATIVI RECENTI', title: 'Promozioni tentate', body: contestsTable(overview.contests.slice(0, 5)), action: overview.contests.length ? `<button class="text-link" data-section-tab="carriera" data-section-tab-value="progressione">Tutti ${arrow}</button>` : '' })}</div>`;
  } else if (active === 'progressione') {
    const withOdds = overview.tracks.filter(track => track.odds);
    const blocked = overview.tracks.filter(track => !track.odds && track.next);
    body = `<div class="sx-card cp-explainer"><span class="section-kicker">COME FUNZIONA</span><p>Nessun incarico arriva da solo. Ogni tentativo pesa <b>consenso, reputazione, esperienza, influenza, risultati elettorali, rapporti interni, forza della tua area, salute del partito, territorio, risorse e momento politico</b>. Superare la soglia rende la promozione probabile, mai certa: puoi ottenere l’incarico, uno minore, un rinvio, perdere contro un altro nome o, se sei molto sotto, perdere quello che hai.</p></div>
      ${withOdds.length ? `<div class="sx-grid two">${withOdds.map(renderOddsCard).join('')}</div>` : ''}
      ${blocked.length ? card({ kicker: 'NON ANCORA A PORTATA', title: 'Cosa manca', body: `<ul class="cp-blocked">${blocked.map(track => `<li><span class="cp-track-icon">${glyph(track.icon, 16)}</span><span><strong>${esc(track.label)}: ${esc(track.next.title)}</strong><small>${esc(track.problems?.length ? track.problems.join(' ') : track.blocker ?? track.requirement)}</small></span>${actionButton(track.action, null, false)}</li>`).join('')}</ul>` }) : ''}
      ${card({ kicker: 'STORICO DEI TENTATIVI · SIMULAZIONE', title: `${overview.contests.length} ${overview.contests.length === 1 ? 'tentativo' : 'tentativi'}`, body: contestsTable(overview.contests) })}`;
  } else if (active === 'incarichi') {
    body = `<div class="sx-grid two">${card({ kicker: 'INCARICHI', title: 'Cosa ricopri', body: officesCard(state, player) })}${card({ kicker: 'RUOLI E POTERI', title: 'Cosa puoi fare adesso', body: renderRolesPanel(state) })}</div>`;
  } else if (active === 'cronologia') {
    body = `<div class="cp-two-col">${card({ kicker: 'CRONOLOGIA · SIMULAZIONE', title: 'La tua carriera, tappa per tappa', body: renderCareerTimeline(state, timelineFilter), className: 'career-timeline-panel' })}${card({ kicker: 'MEMORIA POLITICA', title: 'Quello che non si dimentica', body: renderMemoryPanel(state) })}</div>`;
  } else {
    body = `<div class="sx-grid two">${card({ kicker: 'TRAGUARDI', title: 'Obiettivi della carriera', body: renderObjectivesPanel(state) })}${card({ kicker: 'PERCHÉ È CAMBIATO', title: 'Da dove vengono i tuoi numeri', body: renderWhyPanel(state) })}</div>`;
  }
  return `<div class="career-page">${hero(state, player, overview)}${sectionTabs('carriera', CAREER_TABS.map(([id, label]) => [id, label, counts[id]]), active)}<div class="sx-body" role="tabpanel">${body}</div></div>`;
}
