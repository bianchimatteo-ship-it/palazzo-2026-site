// The territorial committees of the party (Partito → Territorio): the player's own chain Region → Province → Comune,
// every committee with state, strength, members, volunteers, local consensus, loyalty and leader, the actions that
// change them, and new committees to found on the ISTAT map.
import { COMMITTEE_ACTIONS, COMMITTEE_LEVELS, COMMITTEE_STATES, committeeStrength, committeeSummary } from '../core/committee-engine.js?v=20260926-3';
import { costProblem } from '../core/career-engine.js?v=20260926-3';
import { isPartyLeader } from '../core/organization-engine.js?v=20260926-3';
import { glyph } from './visuals.js?v=20260926-3';
import { arrow, badge, bar, card, esc, euro, kpi, num } from './sections-kit.js?v=20260926-3';

export const COMMITTEE_FILTERS = Object.freeze([['tutti', 'Tutti'], ['attivi', 'Attivi'], ['problemi', 'In crisi o fuori controllo'], ['sciolti', 'Sciolti']]);
const STATE_ORDER = ['fondazione', 'crescita', 'consolidamento', 'crisi', 'perdita-controllo', 'dissoluzione'];
const costLabel = cost => [cost.ap ? `${cost.ap} ${cost.ap === 1 ? 'giorno' : 'giorni'}` : '', cost.capital ? `${cost.capital} cap.` : '', cost.funds ? euro(cost.funds) : '', cost.treasury ? `${euro(cost.treasury)} dalla tesoreria` : ''].filter(Boolean).join(' · ');
const toneOf = status => COMMITTEE_STATES[status]?.tone ?? 'neutral';

function actionButton(game, committee, actionId, { leader = false } = {}) {
  const spec = COMMITTEE_ACTIONS[actionId];
  const weekGap = actionId === 'rilancia' && committee.lastVisitWeek !== null && game.week.index - committee.lastVisitWeek < 2 ? 'Ci sei stato da poco.' : '';
  const problem = weekGap || (actionId === 'commissaria' && !leader ? 'Solo chi guida il partito.' : '') || (actionId === 'commissaria' && !['crisi', 'perdita-controllo'].includes(committee.status) ? 'Solo per comitati in crisi o fuori controllo.' : '') || (actionId === 'responsabile' && committee.leader?.player ? 'Guidi tu questo comitato.' : '') || costProblem(game, spec.cost) || (game.status === 'ended' ? 'Carriera conclusa.' : '');
  return `<button type="button" class="secondary-button" data-committee-action="${actionId}" data-committee-id="${esc(committee.id)}" ${problem ? `disabled title="${esc(problem)}"` : `title="${esc(spec.detail)}"`}>${esc(spec.label)} <small>${esc(costLabel(spec.cost))}</small></button>`;
}

function committeeCard(game, committee, { leader, expanded = false, currents = [] } = {}) {
  const strength = committeeStrength(committee);
  const area = currents.find(item => item.id === committee.leader?.currentId);
  const dissolved = committee.status === 'dissoluzione';
  const actions = dissolved
    ? `<button type="button" class="secondary-button" data-committee-action="fonda" data-committee-level="${esc(committee.level)}" data-committee-name="${esc(committee.name)}" data-committee-region="${esc(committee.region)}" data-committee-unit="${esc(committee.unitCode ?? '')}" data-committee-unit-type="${esc(committee.unitType ?? '')}" data-committee-municipality="${esc(committee.municipalityCode ?? '')}" ${costProblem(game, COMMITTEE_ACTIONS.fonda.cost) || committee.level === 'regione' ? 'disabled' : ''}>Rifonda <small>${esc(costLabel(COMMITTEE_ACTIONS.fonda.cost))}</small></button>`
    : ['rilancia', 'mobilita', 'finanzia', ...(committee.leader?.player ? [] : ['responsabile']), ...(leader && ['crisi', 'perdita-controllo'].includes(committee.status) ? ['commissaria'] : [])].map(id => actionButton(game, committee, id, { leader })).join('');
  const last = committee.history?.[0];
  return `<article class="cm-card tone-${toneOf(committee.status)} ${committee.leader?.player ? 'is-mine' : ''}">
    <header><div><span class="section-kicker">${esc(COMMITTEE_LEVELS[committee.level].label.toUpperCase())}${committee.unitType && committee.level === 'provincia' ? ` · ${esc(committee.unitType.toUpperCase())}` : ''}</span><h4>${esc(committee.name)}</h4></div>${badge(COMMITTEE_STATES[committee.status].label, toneOf(committee.status))}</header>
    <div class="cm-strength"><span>Forza</span><b>${dissolved ? '—' : strength}</b>${bar(strength, strength >= 60 ? 'good' : strength < 35 ? 'bad' : 'warn')}</div>
    <dl class="cm-facts">
      <div><dt>Iscritti</dt><dd>${num(committee.members, 0)}</dd></div>
      <div><dt>Volontari attivi</dt><dd>${num(committee.activists, 0)}${committee.mobilizedUntil && committee.mobilizedUntil >= game.week.index ? ' · mobilitati' : ''}</dd></div>
      <div><dt>Organizzazione</dt><dd>${num(committee.organization, 0)}/100${committee.fundedUntil && committee.fundedUntil >= game.week.index ? ' · finanziata' : ''}</dd></div>
      <div><dt>Consenso locale</dt><dd title="Indice 0–100: 50 è in linea con la media nazionale del partito">${num(committee.consensus, 0)}/100</dd></div>
      <div><dt>Fedeltà a te</dt><dd>${num(committee.loyalty, 0)}/100</dd></div>
      <div><dt>Responsabile</dt><dd>${esc(committee.leader?.label ?? '—')}${area ? `<small>area: ${esc(area.label)}</small>` : ''}</dd></div>
    </dl>
    ${expanded ? `<p class="sx-note">${esc(COMMITTEE_STATES[committee.status].detail)}${last ? ` Ultimo fatto (S${last.week}): ${esc(last.text.toLowerCase())}.` : ''}</p>` : last ? `<p class="sx-note">S${last.week}: ${esc(last.text)}</p>` : ''}
    <div class="cm-actions">${actions}</div>
  </article>`;
}

function chain(game, committees, home, options) {
  const regional = committees.find(item => item.level === 'regione' && item.region === home.region);
  const comune = committees.find(item => item.level === 'comune' && item.region === home.region && item.name === home.municipality);
  const provinceCode = home.provinceCode ?? comune?.unitCode ?? null;
  const province = committees.find(item => item.level === 'provincia' && item.region === home.region && item.unitCode === provinceCode);
  home = { ...home, provinceCode, provinceName: home.provinceName ?? province?.name ?? null };
  const steps = [[regional, 'regione', home.region], [province, 'provincia', home.provinceName], [comune, 'comune', home.municipality]].filter(([, , name]) => name);
  return `<div class="cm-chain">${steps.map(([committee, level, name]) => committee ? committeeCard(game, committee, { ...options, expanded: true }) : `<article class="cm-card is-missing"><header><div><span class="section-kicker">${esc(COMMITTEE_LEVELS[level].label.toUpperCase())}</span><h4>${esc(name)}</h4></div>${badge('Nessun comitato')}</header><p class="sx-note">Il partito non ha un comitato qui: fondarlo porta volontari e radicamento alla prossima campagna.</p><div class="cm-actions">${level === 'regione' ? '<small>Le federazioni regionali nascono dalle sezioni del partito (attività “Apri o rilancia una sezione”).</small>' : `<button type="button" class="secondary-button" data-committee-action="fonda" data-committee-level="${level}" data-committee-name="${esc(name)}" data-committee-region="${esc(home.region)}" data-committee-unit="${esc(home.provinceCode ?? '')}" data-committee-unit-type="" data-committee-municipality="${esc(level === 'comune' ? home.municipalityCode ?? '' : '')}" ${costProblem(game, COMMITTEE_ACTIONS.fonda.cost) ? 'disabled' : ''}>${esc(COMMITTEE_ACTIONS.fonda.label)} <small>${esc(costLabel(COMMITTEE_ACTIONS.fonda.cost))}</small></button>`}</div></article>`).join('')}</div>`;
}

export function renderCommitteesPanel(state, { units = [], municipalities = null, home = {}, filter = 'tutti', region = '' } = {}) {
  const game = state.game;
  const party = game?.party;
  const org = party?.org;
  if (!org) return '<p class="sx-empty">Sei indipendente: nessun comitato alle spalle. Aderendo a un partito entri nella sua rete territoriale.</p>';
  const committees = org.committees ?? [];
  if (!committees.length) return `<div class="sx-empty-block"><p>${units.length ? 'Preparo i comitati sul territorio…' : 'Carico i territori ISTAT per costruire i comitati del partito…'}</p></div>`;
  const leader = isPartyLeader(party);
  const summary = committeeSummary(org);
  const currents = party.currents ?? [];
  const options = { leader, currents };
  const regions = [...new Set(committees.map(item => item.region))].sort((a, b) => (b === home.region) - (a === home.region) || a.localeCompare(b, 'it'));
  const selectedRegion = regions.includes(region) ? region : home.region ?? regions[0];
  const matches = committee => filter === 'attivi' ? committee.status !== 'dissoluzione' : filter === 'problemi' ? ['crisi', 'perdita-controllo'].includes(committee.status) : filter === 'sciolti' ? committee.status === 'dissoluzione' : true;
  const inRegion = committees.filter(item => item.region === selectedRegion && matches(item)).sort((a, b) => ['regione', 'provincia', 'comune'].indexOf(a.level) - ['regione', 'provincia', 'comune'].indexOf(b.level) || committeeStrength(b) - committeeStrength(a));
  // New committees: the provinces of the selected region still without one, and the comuni of the player's province.
  const regionUnits = units.filter(unit => unit.gameRegion === selectedRegion && !committees.some(item => item.level === 'provincia' && item.unitCode === unit.code && item.status !== 'dissoluzione'));
  const regionalHere = committees.some(item => item.level === 'regione' && item.region === selectedRegion && item.status !== 'dissoluzione');
  const foundProvince = regionUnits.length && regionalHere ? `<div class="cm-found"><label>Nuovo comitato provinciale in ${esc(selectedRegion)}<select data-committee-found-unit>${regionUnits.map(unit => `<option value="${esc(unit.code)}">${esc(unit.name)} · ${esc(unit.type)}</option>`).join('')}</select></label><button type="button" class="secondary-button" data-committee-found="provincia" ${costProblem(game, COMMITTEE_ACTIONS.fonda.cost) ? 'disabled' : ''}>${esc(COMMITTEE_ACTIONS.fonda.label)} <small>${esc(costLabel(COMMITTEE_ACTIONS.fonda.cost))}</small></button></div>` : '';
  const homeUnit = home.provinceCode ?? committees.find(item => item.level === 'comune' && item.name === home.municipality)?.unitCode ?? null;
  const homeProvince = committees.find(item => item.level === 'provincia' && item.unitCode === homeUnit && item.status !== 'dissoluzione');
  home = { ...home, provinceCode: homeUnit, provinceName: home.provinceName ?? homeProvince?.name ?? null };
  const comuni = municipalities ? municipalities.filter(item => item.unit === home.provinceCode && !committees.some(committee => committee.level === 'comune' && committee.name === item.name && committee.status !== 'dissoluzione')) : [];
  const foundComune = selectedRegion === home.region && homeProvince ? (municipalities ? (comuni.length ? `<div class="cm-found"><label>Nuovo comitato comunale in provincia di ${esc(homeProvince.name)}<select data-committee-found-municipality>${comuni.map(item => `<option value="${esc(item.code)}">${esc(item.name)}${item.capital ? ' · capoluogo' : ''}</option>`).join('')}</select></label><button type="button" class="secondary-button" data-committee-found="comune" ${costProblem(game, COMMITTEE_ACTIONS.fonda.cost) ? 'disabled' : ''}>${esc(COMMITTEE_ACTIONS.fonda.label)} <small>${esc(costLabel(COMMITTEE_ACTIONS.fonda.cost))}</small></button></div>` : '') : `<div class="cm-found"><button type="button" class="text-link" data-committee-load="municipalities">Mostra i comuni della provincia di ${esc(homeProvince.name)} per fondare un comitato ${arrow}</button></div>`) : '';
  const statusChips = STATE_ORDER.map(status => `<span class="cm-chip tone-${toneOf(status)}"><b>${summary.byStatus[status]}</b>${esc(COMMITTEE_STATES[status].label)}</span>`).join('');
  return `<div class="cm-panel">
    <div class="cm-kpis">${kpi({ label: 'Comitati attivi', value: `${summary.active}<small>/${summary.total}</small>` })}${kpi({ label: 'Forza media', value: `${summary.strength}/100`, bar: summary.strength, tone: summary.strength >= 60 ? 'good' : summary.strength < 35 ? 'bad' : '' })}${kpi({ label: 'Iscritti nei comitati locali', value: num(summary.members, 0) })}${kpi({ label: 'Volontari attivi', value: num(summary.activists, 0) })}</div>
    <div class="cm-chips">${statusChips}</div>
    ${card({ kicker: 'IL TUO TERRITORIO · SIMULAZIONE', title: `${home.municipality ?? ''}${home.provinceName ? `, ${home.provinceName}` : ''} · ${home.region ?? ''}`, body: `${chain(game, committees, home, options)}<p class="sx-note">Alle elezioni i comitati del territorio del voto portano volontari, organizzazione, peso nella scelta dei candidati e consenso locale; un comitato fuori controllo lavora contro di te. Alle promozioni nel partito contano come radicamento.</p>` })}
    ${card({ kicker: 'RETE DEI COMITATI', title: selectedRegion, action: '', body: `<div class="cm-filters"><label>Regione<select data-view-filter-select="comitati-regione">${regions.map(name => `<option value="${esc(name)}" ${name === selectedRegion ? 'selected' : ''}>${esc(name)}${name === home.region ? ' · casa tua' : ''}</option>`).join('')}</select></label><div class="cm-filter-buttons" role="group" aria-label="Filtra i comitati">${COMMITTEE_FILTERS.map(([id, label]) => `<button type="button" data-view-filter="comitati" data-view-filter-value="${id}" class="${filter === id ? 'active' : ''}" aria-pressed="${filter === id}">${esc(label)}</button>`).join('')}</div></div>
      <div class="cm-grid">${inRegion.map(item => committeeCard(game, item, options)).join('') || '<p class="sx-empty">Nessun comitato per questo filtro.</p>'}</div>${foundProvince}${foundComune}` })}
    <p class="sx-note">${glyph('map', 14)} Territori e nomi sono quelli ISTAT (elenco dei comuni al 21 febbraio 2026); iscritti, responsabili, forza e stati dei comitati sono simulati e non descrivono l’organizzazione reale del partito. I responsabili sono figure simulate, mai persone reali.</p>
  </div>`;
}
