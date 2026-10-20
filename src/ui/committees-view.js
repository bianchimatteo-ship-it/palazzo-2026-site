// The territorial committees of the party (Partito → Territorio): the player's own chain Region → Province → Comune,
// every committee with state, strength, members, volunteers, local consensus, loyalty and leader, the actions that
// change them, and new committees to found on the ISTAT map.
import { COMMITTEE_ACTIONS, COMMITTEE_LEVELS, COMMITTEE_STATES, committeeActionCost, committeeProfile, committeeStrength, committeeSummary, ensureStructure, leaderStance, PARTY_SCALES, SEAT_TIERS, territorialControl } from '../core/committee-engine.js?v=20261020-1';
import { costProblem } from '../core/career-engine.js?v=20261020-1';
import { isPartyLeader } from '../core/organization-engine.js?v=20261020-1';
import { glyph, territoryTile, territoryVisual } from './visuals.js?v=20261020-1';
import { planAddButton } from './plan-view.js?v=20261020-1';
import { arrow, badge, bar, card, esc, euro, kpi, num } from './sections-kit.js?v=20261020-1';

export const COMMITTEE_FILTERS = Object.freeze([['tutti', 'Tutti'], ['attivi', 'Attivi'], ['problemi', 'In crisi o fuori controllo'], ['sciolti', 'Sciolti']]);
const STATE_ORDER = ['fondazione', 'crescita', 'consolidamento', 'crisi', 'perdita-controllo', 'dissoluzione'];
const costLabel = cost => [cost.ap ? `${cost.ap} ${cost.ap === 1 ? 'giorno' : 'giorni'}` : '', cost.capital ? `${cost.capital} cap.` : '', cost.funds ? euro(cost.funds) : '', cost.treasury ? `${euro(cost.treasury)} dalla tesoreria` : ''].filter(Boolean).join(' · ');
// One person per committee: the one recruited in the internal life (his name), «Tu», or nobody for a committee still without a manager.
export const leaderName = committee => committee.leader?.player ? 'Tu' : committee.leader?.vacant ? 'Nessun responsabile' : committee.leader?.person?.displayName ? `${committee.leader.person.displayName} (figura simulata)` : committee.leader?.label ?? '—';
const toneOf = status => COMMITTEE_STATES[status]?.tone ?? 'neutral';

const COOLDOWN_REASON = { iniziativa: ['lastInitiativeWeek', 3, 'Un’iniziativa c’è già stata da poco.'], forma: ['trainedWeek', 6, 'I volontari sono stati formati da poco.'], raccolta: ['lastFundraiserWeek', 4, 'Una raccolta fondi c’è già stata da poco.'] };
function actionButton(game, committee, actionId, { leader = false } = {}) {
  const spec = { ...COMMITTEE_ACTIONS[actionId], cost: committeeActionCost(committee, actionId) };
  const [field, weeks, why] = COOLDOWN_REASON[actionId] ?? [];
  const extra = (field && committee[field] !== undefined && game.week.index - committee[field] < weeks ? why : '')
    || (actionId === 'recluta' && committee.recruitUntil >= game.week.index ? 'La campagna di tesseramento è già in corso.' : '')
    || (actionId === 'sede' && (committee.seat ?? 0) >= SEAT_TIERS.length - 1 ? 'La sede è già di proprietà.' : '')
    || (actionId === 'delega' && !leader ? 'Solo chi guida il partito.' : '')
    || (actionId === 'delega' && committee.leader?.player ? 'Guidi tu questo comitato.' : '');
  const weekGap = extra || (actionId === 'rilancia' && committee.lastVisitWeek !== null && game.week.index - committee.lastVisitWeek < 2 ? 'Ci sei stato da poco.' : '');
  const problem = weekGap || (actionId === 'commissaria' && !leader ? 'Solo chi guida il partito.' : '') || (actionId === 'commissaria' && !['crisi', 'perdita-controllo'].includes(committee.status) ? 'Solo per comitati in crisi o fuori controllo.' : '') || (actionId === 'responsabile' && committee.leader?.player ? 'Guidi tu questo comitato.' : '') || costProblem(game, spec.cost) || (game.status === 'ended' ? 'Carriera conclusa.' : '');
  const button = `<button type="button" class="secondary-button" data-committee-action="${actionId}" data-committee-id="${esc(committee.id)}" ${problem ? `disabled title="${esc(problem)}"` : `title="${esc(spec.detail)}"`}>${esc(spec.label)} <small>${esc(costLabel(spec.cost))}</small></button>`;
  // The four operations that make sense in a series (rally the volunteers, fund the activities, recruit, relaunch) can also be added to the plan of the week.
  return !problem && ['rilancia', 'mobilita', 'finanzia', 'recluta'].includes(actionId) ? `<span class="plan-pair">${button}${planAddButton({ kind: 'committee', action: actionId, id: committee.id }, '+ Piano')}</span>` : button;
}

const SEAT_UPKEEP_LEVEL = { regione: 0, provincia: 1.6, comune: 1 };
function committeeCard(game, committee, { leader, expanded = false, currents = [], party = null } = {}) {
  ensureStructure(committee);
  const stance = party && !committee.leader?.player ? leaderStance(committee, { party, cadre: (party.life?.cadres ?? []).find(item => item.committeeId === committee.id && item.status !== 'uscito') ?? null }) : null;
  const profile = committeeProfile(committee);
  const seat = SEAT_TIERS[committee.seat] ?? SEAT_TIERS[0];
  const upkeep = Math.round(seat.upkeep * (SEAT_UPKEEP_LEVEL[committee.level] ?? 1));
  const strength = committeeStrength(committee);
  const area = currents.find(item => item.id === committee.leader?.currentId);
  const dissolved = committee.status === 'dissoluzione';
  const actions = dissolved
    ? `<button type="button" class="secondary-button" data-committee-action="fonda" data-committee-level="${esc(committee.level)}" data-committee-name="${esc(committee.name)}" data-committee-region="${esc(committee.region)}" data-committee-unit="${esc(committee.unitCode ?? '')}" data-committee-unit-type="${esc(committee.unitType ?? '')}" data-committee-municipality="${esc(committee.municipalityCode ?? '')}" ${costProblem(game, COMMITTEE_ACTIONS.fonda.cost) || committee.level === 'regione' ? 'disabled' : ''}>Rifonda <small>${esc(costLabel(COMMITTEE_ACTIONS.fonda.cost))}</small></button>`
    : '';
  const last = committee.history?.[0];
  const visual = territoryVisual(committee.level);
  const main = dissolved ? actions : ['rilancia', 'mobilita', 'finanzia', 'recluta'].map(id => actionButton(game, committee, id, { leader })).join('');
  const more = dissolved ? '' : `<div class="cm-actions">${['iniziativa', 'forma', 'raccolta', 'sede', ...(leader ? ['delega'] : []), ...(committee.leader?.player ? [] : ['responsabile']), ...(leader && ['crisi', 'perdita-controllo'].includes(committee.status) ? ['commissaria'] : [])].map(id => actionButton(game, committee, id, { leader })).join('')}</div>`;
  const facts = `<dl class="cm-facts">
      <div><dt>Iscritti</dt><dd>${num(committee.members, 0)}</dd></div>
      <div><dt>Volontari attivi</dt><dd>${num(committee.activists, 0)}${committee.mobilizedUntil && committee.mobilizedUntil >= game.week.index ? ' · mobilitati' : ''}</dd></div>
      <div><dt>Organizzazione</dt><dd>${num(committee.organization, 0)}/100${committee.fundedUntil && committee.fundedUntil >= game.week.index ? ' · finanziata' : ''}</dd></div>
      <div><dt>Consenso locale</dt><dd title="Indice 0–100: 50 è in linea con la media nazionale del partito">${num(committee.consensus, 0)}/100</dd></div>
      <div><dt>Volontari: qualità</dt><dd>${num(committee.quality, 0)}/100<small>stanchezza ${num(committee.fatigue, 0)}/100</small></dd></div>
      <div><dt>Attività locale</dt><dd>${num(committee.activity, 0)}/100${committee.recruitUntil && committee.recruitUntil >= game.week.index ? ' · tesseramento aperto' : ''}</dd></div>
      <div><dt>Sede</dt><dd>${esc(seat.label)}${upkeep ? `<small>${euro(upkeep)}/sett. dalla tesoreria</small>` : ''}</dd></div>
      <div><dt>Fedeltà a te</dt><dd>${num(committee.loyalty, 0)}/100<small>autonomia ${num(committee.autonomy, 0)}/100</small></dd></div>
      <div><dt>Raccolti finora</dt><dd>${euro(committee.raised ?? 0)}</dd></div>
      <div><dt>Responsabile</dt><dd>${esc(leaderName(committee))}${area ? `<small>area: ${esc(area.label)}</small>` : ''}${stance && !dissolved ? `<small class="cm-stance tone-${stance.tone}" title="${esc(stance.reasons.join(' · '))}">${esc(stance.label)} · peso politico ${Math.round(stance.weight * 100)}/100</small>` : ''}</dd></div>
    </dl>
    ${expanded ? `<p class="sx-note">${esc(COMMITTEE_STATES[committee.status].detail)}${last ? ` Ultimo fatto (S${last.week}): ${esc(last.text.toLowerCase())}.` : ''}</p>` : last ? `<p class="sx-note">S${last.week}: ${esc(last.text)}</p>` : ''}`;
  // Compact by default: name, level, territory, state, the person in charge and the main actions on the first line; the figures, the history and the other actions fold under «Dettagli».
  return `<article class="cm-card cm-compact tone-${toneOf(committee.status)} ${committee.leader?.player ? 'is-mine' : ''}" style="--lv:${esc(visual.color)}" data-level="${esc(committee.level)}">
    <header>${territoryTile(committee.level, 'sm')}<div><span class="section-kicker">${esc(COMMITTEE_LEVELS[committee.level].label.toUpperCase())}${committee.unitType && committee.level === 'provincia' ? ` · ${esc(committee.unitType.toUpperCase())}` : ''} · ${esc(committee.region)}</span><h4>${esc(committee.name)}</h4><small class="cm-lead">${dissolved ? 'Comitato sciolto' : `Responsabile: ${esc(leaderName(committee))}${stance ? ` · ${esc(stance.label)}` : ''}`}</small></div><span class="cm-badges">${badge(COMMITTEE_STATES[committee.status].label, toneOf(committee.status))}${dissolved ? '' : badge(`${profile.tier}${profile.trend === 'stabile' ? '' : ` · ${profile.trend}`}`, profile.trend === 'declino' || profile.tier === 'fragile' ? 'warn' : profile.trend === 'crescita' || profile.tier === 'forte' ? 'good' : 'neutral')}</span></header>
    <div class="cm-strength"><span>Forza</span><b>${dissolved ? '—' : strength}</b>${bar(strength, strength >= 60 ? 'good' : strength < 35 ? 'bad' : 'warn')}</div>
    <div class="cm-actions">${main}</div>
    <details class="cm-details" data-remember="committee-details-${expanded ? "chain" : "list"}-${esc(committee.id)}"><summary>Dettagli e altre azioni</summary>${facts}${more}</details>
  </article>`;
}

function chain(game, committees, home, options) {
  const regional = committees.find(item => item.level === 'regione' && item.region === home.region);
  const comune = committees.find(item => item.level === 'comune' && item.region === home.region && item.name === home.municipality);
  const provinceCode = home.provinceCode ?? comune?.unitCode ?? null;
  const province = committees.find(item => item.level === 'provincia' && item.region === home.region && item.unitCode === provinceCode);
  home = { ...home, provinceCode, provinceName: home.provinceName ?? province?.name ?? null };
  const steps = [[regional, 'regione', home.region], [province, 'provincia', home.provinceName], [comune, 'comune', home.municipality]].filter(([, , name]) => name);
  return `<div class="cm-chain">${steps.map(([committee, level, name]) => committee ? committeeCard(game, committee, { ...options, expanded: true }) : `<article class="cm-card cm-compact is-missing" style="--lv:${esc(territoryVisual(level).color)}"><header>${territoryTile(level, 'sm')}<div><span class="section-kicker">${esc(COMMITTEE_LEVELS[level].label.toUpperCase())}</span><h4>${esc(name)}</h4></div>${badge('Nessun comitato')}</header><p class="sx-note">Il partito non ha un comitato qui: fondarlo porta volontari e radicamento alla prossima campagna.</p><div class="cm-actions">${level === 'regione' ? '<small>Le federazioni regionali nascono dalle sezioni del partito (attività “Apri o rilancia una sezione”).</small>' : `<button type="button" class="secondary-button" data-committee-action="fonda" data-committee-level="${level}" data-committee-name="${esc(name)}" data-committee-region="${esc(home.region)}" data-committee-unit="${esc(home.provinceCode ?? '')}" data-committee-unit-type="" data-committee-municipality="${esc(level === 'comune' ? home.municipalityCode ?? '' : '')}" ${costProblem(game, COMMITTEE_ACTIONS.fonda.cost) ? 'disabled' : ''}>${esc(COMMITTEE_ACTIONS.fonda.label)} <small>${esc(costLabel(COMMITTEE_ACTIONS.fonda.cost))}</small></button>`}</div></article>`).join('')}</div>`;
}

// Founding a committee anywhere in Italy: Region → Province → Comune, from the ISTAT lists (the region of a comune is the one of its province). The level founded is the lowest one chosen;
// the cost is paid once and a new committee has no manager until one is recruited.
function foundingPanel(game, { committees, units, municipalities, home, found }) {
  if (!units.length) return '';
  const regions = [...new Set(units.map(unit => unit.gameRegion))].sort((a, b) => (b === home.region) - (a === home.region) || a.localeCompare(b, 'it'));
  const region = regions.includes(found.region) ? found.region : regions.includes(home.region) ? home.region : regions[0];
  const regionUnits = units.filter(unit => unit.gameRegion === region).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  const homeUnit = region === home.region ? regionUnits.find(unit => unit.code === home.provinceCode) ?? null : null;
  const wanted = found.unit !== undefined ? found.unit : homeUnit?.code ?? '';
  const unitChosen = regionUnits.find(item => item.code === wanted) ?? null;
  const places = unitChosen && municipalities ? municipalities.filter(item => item.unit === unitChosen.code).sort((a, b) => a.name.localeCompare(b.name, 'it')) : [];
  const place = unitChosen ? places.find(item => item.code === found.municipality) ?? null : null;
  const level = place ? 'comune' : unitChosen ? 'provincia' : 'regione';
  const name = place?.name ?? unitChosen?.name ?? region;
  const exists = committees.some(item => item.status !== 'dissoluzione' && item.level === level && item.region === region && (level === 'regione' || (level === 'provincia' ? item.unitCode === unitChosen.code : item.municipalityCode === place.code || (item.name === place.name && item.unitCode === unitChosen.code))));
  const problem = exists ? `Il partito ha già il comitato ${COMMITTEE_LEVELS[level].label.toLowerCase().replace('comitato ', '')} di ${name}.` : costProblem(game, COMMITTEE_ACTIONS.fonda.cost) || (game.status === 'ended' ? 'Carriera conclusa.' : '');
  const unitSelect = `<label>Provincia<select data-view-filter-select="found-unit"><option value="" ${unitChosen ? '' : 'selected'}>Nessuna: comitato regionale</option>${regionUnits.map(item => `<option value="${esc(item.code)}" ${unitChosen?.code === item.code ? 'selected' : ''}>${esc(item.name)} · ${esc(item.type)}</option>`).join('')}</select></label>`;
  const placeSelect = !unitChosen ? '' : municipalities ? `<label>Comune<select data-view-filter-select="found-municipality"><option value="" ${place ? '' : 'selected'}>Nessuno: comitato provinciale</option>${places.map(item => `<option value="${esc(item.code)}" ${place?.code === item.code ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>` : `<button type="button" class="secondary-button" data-committee-load="municipalities">Carica i comuni ISTAT</button>`;
  return `<section class="cm-found" aria-label="Fonda un nuovo comitato"><strong class="cm-found-title">Fonda un nuovo comitato</strong>
    <label>Regione<select data-view-filter-select="found-region">${regions.map(item => `<option value="${esc(item)}" ${item === region ? 'selected' : ''}>${esc(item)}${item === home.region ? ' · casa tua' : ''}</option>`).join('')}</select></label>${unitSelect}${placeSelect}
    <button type="button" class="primary-button" data-committee-found="nuovo" data-committee-level="${esc(level)}" data-committee-name="${esc(name)}" data-committee-region="${esc(region)}" data-committee-unit="${esc(unitChosen?.code ?? '')}" data-committee-unit-type="${esc(unitChosen?.type ?? '')}" data-committee-unit-name="${esc(unitChosen?.name ?? '')}" data-committee-municipality="${esc(place?.code ?? '')}" ${problem ? `disabled title="${esc(problem)}"` : ''}>Fonda il ${esc(COMMITTEE_LEVELS[level].label.toLowerCase())} di ${esc(name)} <small>${esc(costLabel(committeeActionCost({ level }, 'fonda')))}</small></button>
    <small class="cm-found-note">${problem ? esc(problem) : 'Il nuovo comitato nasce senza responsabile: ne recluti uno dalla Vita interna.'}</small></section>`;
}

export function renderCommitteesPanel(state, { units = [], municipalities = null, home = {}, filter = 'tutti', region = '', found = {} } = {}) {
  const game = state.game;
  const party = game?.party;
  const org = party?.org;
  if (!org) return '<p class="sx-empty">Sei indipendente: nessun comitato alle spalle. Aderendo a un partito entri nella sua rete territoriale.</p>';
  const committees = org.committees ?? [];
  if (!committees.length) return `<div class="sx-empty-block"><p>${units.length ? 'Preparo i comitati sul territorio…' : 'Carico i territori ISTAT per costruire i comitati del partito…'}</p></div>`;
  const leader = isPartyLeader(party);
  const summary = committeeSummary(org);
  const currents = party.currents ?? [];
  const options = { leader, currents, party };
  const control = territorialControl(party, { region: home.region });
  const regions = [...new Set(committees.map(item => item.region))].sort((a, b) => (b === home.region) - (a === home.region) || a.localeCompare(b, 'it'));
  const selectedRegion = regions.includes(region) ? region : home.region ?? regions[0];
  const matches = committee => filter === 'attivi' ? committee.status !== 'dissoluzione' : filter === 'problemi' ? ['crisi', 'perdita-controllo'].includes(committee.status) : filter === 'sciolti' ? committee.status === 'dissoluzione' : true;
  const inRegion = committees.filter(item => item.region === selectedRegion && matches(item)).sort((a, b) => ['regione', 'provincia', 'comune'].indexOf(a.level) - ['regione', 'provincia', 'comune'].indexOf(b.level) || committeeStrength(b) - committeeStrength(a));
  // New committees: the provinces of the selected region still without one, and the comuni of the player's province.
  const foundPanel = foundingPanel(game, { committees, units, municipalities, home, found });
  const statusChips = STATE_ORDER.map(status => `<span class="cm-chip tone-${toneOf(status)}"><b>${summary.byStatus[status]}</b>${esc(COMMITTEE_STATES[status].label)}</span>`).join('');
  return `<div class="cm-panel">
    <div class="cm-kpis">${kpi({ label: 'Comitati attivi', value: `${summary.active}<small>/${summary.total}</small>` })}${kpi({ label: 'Forza media', value: `${summary.strength}/100`, bar: summary.strength, tone: summary.strength >= 60 ? 'good' : summary.strength < 35 ? 'bad' : '' })}${kpi({ label: 'Iscritti nei comitati locali', value: num(summary.members, 0) })}${kpi({ label: 'Volontari attivi', value: `${num(summary.activists, 0)}<small> · qualità ${summary.quality}/100</small>` })}${kpi({ label: 'Sedi e raccolta', value: `${summary.seats}<small> sedi · ${euro(summary.upkeep)}/sett. di costi · ${euro(summary.raised)}/sett. raccolti</small>` })}${kpi({ label: 'Rete', value: `${summary.strong}<small> forti · ${summary.growing} in crescita · ${summary.declining} in declino · ${summary.fragile} fragili</small>` })}${control ? kpi({ label: 'Controllo del territorio', value: `${control.index}<small>/100 · ${control.byStance.tuo + control.byStance['con-te']} con te · ${control.byStance.distante + control.byStance.contro} distanti o contro</small>`, bar: control.index, tone: control.index >= 65 ? 'good' : control.index < 40 ? 'bad' : '' }) : ''}</div>
    <div class="cm-chips">${statusChips}</div>
    ${foundPanel}
    ${card({ kicker: 'IL TUO TERRITORIO · SIMULAZIONE', title: `${home.municipality ?? ''}${home.provinceName ? `, ${home.provinceName}` : ''} · ${home.region ?? ''}`, body: `${chain(game, committees, home, options)}<p class="sx-note">Alle elezioni i comitati del territorio del voto portano volontari, organizzazione, peso nella scelta dei candidati e consenso locale; un comitato fuori controllo lavora contro di te. Ogni responsabile segue un’area del partito (o te): se è con te porta volontari, preferenze e candidature, se è distante o contro no. Il controllo del territorio conta alle candidature, al congresso, nei rapporti con le aree e nelle promozioni.</p>` })}
    ${card({ kicker: 'RETE DEI COMITATI', title: selectedRegion, action: '', body: `<div class="cm-filters"><label>Regione<select data-view-filter-select="comitati-regione">${regions.map(name => `<option value="${esc(name)}" ${name === selectedRegion ? 'selected' : ''}>${esc(name)}${name === home.region ? ' · casa tua' : ''}</option>`).join('')}</select></label><div class="cm-filter-buttons" role="group" aria-label="Filtra i comitati">${COMMITTEE_FILTERS.map(([id, label]) => `<button type="button" data-view-filter="comitati" data-view-filter-value="${id}" class="${filter === id ? 'active' : ''}" aria-pressed="${filter === id}">${esc(label)}</button>`).join('')}</div></div>
      <div class="cm-grid">${inRegion.map(item => committeeCard(game, item, options)).join('') || '<p class="sx-empty">Nessun comitato per questo filtro.</p>'}</div>` })}
    ${summary.scale ? `<p class="sx-note">${esc(PARTY_SCALES[summary.scale].label)}: ${esc(PARTY_SCALES[summary.scale].detail)} ${summary.autonomous ? `${summary.autonomous} comitati decidono in buona parte da soli.` : ''}</p>` : ''}
    <p class="sx-note">${glyph('map', 14)} Territori e nomi sono quelli ISTAT (elenco dei comuni al 21 febbraio 2026); iscritti, responsabili, forza e stati dei comitati sono simulati e non descrivono l’organizzazione reale del partito. I responsabili sono figure simulate, mai persone reali.</p>
  </div>`;
}
