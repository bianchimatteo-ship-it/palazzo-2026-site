import { residentsText } from '../core/municipal-rules.js?v=20261026-1';
import { CAREER_LEVELS, ITALIAN_REGIONS, PROVINCIAL_LEVEL_PROBLEM, hasProvincialLevel, initialCareerStatistics } from '../data/regions.js?v=20261026-1';
import { LOGO_SHAPES, LOGO_SYMBOLS, partyLogoDataUrl } from './party-logo.js?v=20261026-1';
import { AREA_GROUPS, POLICY_AREAS } from '../data/simulation/policy-rules.js?v=20261026-1';
import { STARTING_ROLES, validateCareerStep } from '../core/career-rules.js?v=20261026-1';
import { DATA_SOURCES, isSelectableParty } from '../data/schema.js?v=20261026-1';
import { DIFFICULTIES } from '../data/simulation/difficulty-rules.js?v=20261026-1';
import { POLL_SCENARIOS, SCENARIO_LIMITS } from '../core/poll-scenario.js?v=20261026-1';
import { startStep, startSummary } from './start-wizard.js?v=20261026-1';
import { START_PROFILES } from '../data/simulation/start-rules.js?v=20261026-1';
import { normalizeStart } from '../core/start-engine.js?v=20261026-1';
import { legacyBanner } from './hall-view.js?v=20261026-1';
import { formatDate } from '../core/time.js?v=20261026-1';

const POSITIONS = ['estrema sinistra', 'sinistra', 'centro-sinistra', 'centro', 'centro-destra', 'destra', 'estrema destra'];

const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = (path, size = 17) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const iconPaths = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', back: '<path d="m15 18-6-6 6-6M9 12h10"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>', route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h4a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/>',
  party: '<path d="M4 5h16v14H4zM8 9h8M8 13h5"/>', summary: '<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>',
  pin: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>', gauge: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="m12 16 4-5"/>'
};
// The five steps of a new career, from the essential to the detail: who you are, where and as what you start, the party (or none), the advanced
// settings (difficulty and starting conditions) and the summary. Each step runs the checks it gathers (career-rules: WIZARD_CHECKS).
export const WIZARD_STEPS = Object.freeze([
  ['Identità', 'Chi sei', 'person'], ['Partenza', 'Da dove parti', 'pin'], ['Partito', 'Scegli l’appartenenza', 'party'],
  ['Avanzate', 'Impostazioni avanzate', 'gauge'], ['Riepilogo', 'Riepilogo e avvio', 'summary']
]);
const LAST_STEP = WIZARD_STEPS.length;
const ico = (name, size) => icon(iconPaths[name], size);
const val = (draft, field) => esc(draft[field] ?? '');

export function makeCareerDraft(currentDate, parties = [], hall = []) {
  return {
    step: 1, errors: [], firstName: '', lastName: '', birthDate: '', gender: 'preferisco-non-specificare', previousProfession: '', startingRole: null, startingOffice: null,
    region: '', territorialUnit: '', municipality: '', municipalityCode: '', municipalityQuery: '', municipalityLimit: 40,
    initialLevel: 'comunale', parliamentStartMode: 'real-context', parliamentaryGroupId: '', groupQuery: '',
    partyMode: 'independent', partyId: parties.find(isSelectableParty)?.id ?? '',
    partyName: '', partyAbbreviation: '', partyDescription: '', partyColor: '#264d82', partyOrientation: 'Centrismo civico',
    partyProgram: [], partyLogoMode: 'builder', partyLogoShape: 'cerchio', partyLogoSymbol: 'freccia', partyLogoUrl: '',
    partyPosition: 'centro', difficulty: 'normale', start: { profile: 'ordinaria', levels: {} }, hall, legacyId: '',
    pollMode: 'realistico', pollSeed: '', pollCustom: {},
    policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 }, currentDate
  };
}

// territory: { units, municipalities, source } — the ISTAT list (territorial-units.json, municipalities.json), or
// { status: 'loading' | 'error', error } while it is missing. data: { loading, failed } — the other real data.
export function renderCareerWizard(state, draft, realParties = [], logoFor = () => null, parliamentaryGroups = [], partyLeaderships = [], politicalFigures = [], realPoliticians = [], territory = null, data = null, pollView = null) {
  const steps = WIZARD_STEPS;
  const level = CAREER_LEVELS[draft.initialLevel];
  const parties = [...state.dataset.parties.filter(isSelectableParty), ...realParties.filter(isSelectableParty)];
  const activeStep = steps[draft.step - 1];
  const place = chosenPlace(draft, territory);
  const body = draft.step === 1 ? profileStep(state, draft) : draft.step === 2 ? startingPoint(draft, territory, place, parliamentaryGroups, realPoliticians) : draft.step === 3 ? partyStep(draft, parties, logoFor, parliamentaryGroups, partyLeaderships, politicalFigures) : draft.step === 4 ? advancedStep(draft, pollView) : summaryStep(draft, parties, level, parliamentaryGroups, place, pollView);
  // «Annulla» is there at every step (and the × in the header): it always goes back to the initial menu, without creating or loading anything.
  const backButton = `${draft.step > 1 ? `<button type="button" class="secondary-button wizard-back" data-wizard-action="back">${ico('back', 16)} Indietro</button>` : ''}<button type="button" class="wizard-cancel" data-wizard-action="cancel">Annulla</button>`;
  const actionButton = draft.step === LAST_STEP
    ? `<button type="button" class="primary-button" data-wizard-action="finish">Inizia carriera ${ico('arrow', 16)}</button>`
    : `<button type="button" class="primary-button" data-wizard-action="next">Continua ${ico('arrow', 16)}</button>`;
  // When the career in progress cannot be kept, the new one does not start: the box says why and offers the file of the career in progress.
  const exportBox = draft.blocked ? `<div class="wizard-errors wizard-blocked" role="alert"><button type="button" class="secondary-button" data-wizard-action="export-current">Esporta la carriera in corso su file</button>${draft.exported ? '<span>File scaricato: controlla che sia nella cartella dei download prima di liberare spazio.</span>' : ''}</div>` : '';
  const errorBox = `${draft.errors?.length ? `<div class="wizard-errors" role="alert">${draft.errors.map(error => `<span>${esc(error)}</span>`).join('')}</div>` : ''}${exportBox}`;
  // Real data that did not arrive (parties, groups, people): the wizard goes on with the rest and offers a new attempt.
  const dataBox = data?.failed?.length ? `<div class="wizard-data-alert" role="alert"><span>Non è stato possibile caricare: ${esc(data.failed.join(', '))}. Le scelte che ne dipendono restano vuote finché i dati non arrivano.</span><button type="button" class="secondary-button" data-wizard-retry-data>Riprova</button></div>` : '';
  return `<div class="wizard-backdrop" data-wizard-backdrop><section class="career-wizard" data-step="${draft.step}" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
    <aside class="wizard-aside"><div class="wizard-brand"><img class="brand-logo wizard-logo" src="icons/logo-politicando-640.webp" srcset="icons/logo-politicando-240.webp 240w, icons/logo-politicando-640.webp 640w" sizes="88px" width="88" height="88" alt="POLITICANDO 2026" decoding="async" /></div><span class="wizard-aside-label">NUOVA CARRIERA</span><h2>Una storia<br/>da scrivere.</h2><p>Chi sei, da dove parti, con quale partito e con quali regole: cinque passaggi, dal più importante al dettaglio.</p><div class="wizard-steps">${steps.map((s, i) => `<div class="wizard-step ${draft.step === i + 1 ? 'current' : ''} ${draft.step > i + 1 ? 'complete' : ''}"><span class="wizard-step-icon">${draft.step > i + 1 ? '✓' : ico(s[2], 16)}</span><span><small>PASSAGGIO ${String(i + 1).padStart(2, '0')}</small><strong>${s[0]}</strong></span></div>`).join('')}</div><div class="wizard-aside-foot"><span class="live-dot"></span><span>Il salvataggio avviene solo quando inizi la carriera.</span></div></aside>
    <div class="wizard-main"><header class="wizard-header"><div><div class="wizard-progress" role="progressbar" aria-label="Avanzamento" aria-valuemin="1" aria-valuemax="${LAST_STEP}" aria-valuenow="${draft.step}">${steps.map((_, i) => `<i class="${draft.step > i + 1 ? 'done' : draft.step === i + 1 ? 'current' : ''}"></i>`).join('')}</div><ol class="wizard-chips" aria-label="Passaggi della nuova carriera">${steps.map((st, i) => `<li class="${draft.step > i + 1 ? 'done' : draft.step === i + 1 ? 'current' : ''}" ${draft.step === i + 1 ? 'aria-current="step"' : ''}><span>${draft.step > i + 1 ? '✓' : i + 1}</span><b>${st[0]}</b></li>`).join('')}</ol><span class="wizard-kicker">PASSAGGIO ${String(draft.step).padStart(2, '0')} <i>/</i> ${String(LAST_STEP).padStart(2, '0')}</span><h1 id="wizard-title">${activeStep[1]}</h1><p>${stepIntro(draft.step)}</p></div><button class="wizard-x" type="button" aria-label="Annulla nuova carriera" data-wizard-action="cancel">×</button></header>
      <div class="wizard-body">${legacyBanner(draft)}${errorBox}${dataBox}${body}</div>
      <footer class="wizard-footer">${backButton}<span class="wizard-footer-note">${draft.step < LAST_STEP ? 'Puoi tornare indietro e modificare ogni scelta.' : `Avvio della carriera il ${esc(draft.currentDate ?? state.clock.currentDate)}.`}</span>${actionButton}</footer>
    </div>
  </section></div>`;
}

function stepIntro(step) {
  return [
    'Il tuo politico: nome, data di nascita, genere e il lavoro che facevi prima. I dati servono solo a questa carriera.',
    'Il territorio da cui parti (elenco ufficiale ISTAT aggiornato al 21 febbraio 2026) e la carica o il percorso: dal consiglio comunale alla Camera, fino agli scenari di Presidente del Consiglio e della Repubblica.',
    'Scegli l’appartenenza e, solo se hai un partito, la posizione che ricopri già. Partito e gruppo parlamentare non sono la stessa cosa.',
    'Le scelte di contorno hanno già un valore predefinito: apri solo ciò che vuoi cambiare. La difficoltà resta per tutta la carriera; le condizioni di partenza continuano a pesare.',
    'Controlla le scelte: potrai correggere ogni passaggio prima di confermare.'
  ][step - 1];
}
// ---------- where: Regione → (provincia) → Comune, from the ISTAT list ----------
const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ' ').toLocaleLowerCase('it-IT').replace(/\s+/g, ' ').trim();
const searchKeys = new WeakMap();
const keysOf = municipalities => { if (!searchKeys.has(municipalities)) searchKeys.set(municipalities, municipalities.map(item => fold(`${item.name} ${item.alt ?? ''}`))); return searchKeys.get(municipalities); };
const unitLabel = unit => `${unit.name}${unit.sigla ? ` (${unit.sigla})` : ''}`;
// The chosen comune with its unit and region (null until one is picked from the list).
export function chosenPlace(d, territory) {
  const municipality = territory?.municipalities?.find(item => item.code === d.municipalityCode) ?? null;
  const unit = municipality ? territory.units.find(item => item.code === municipality.unit) ?? null : null;
  return municipality && unit ? { municipality, unit, region: unit.gameRegion } : null;
}
// A choice of the second rank: shut by default (the default value is already good), and left as the player puts it.
// Open or shut as the player left it (draft.open), otherwise by its default.
const more = (d, key, title, hint, body, open = false) => `<details class="wizard-more" data-wizard-more="${key}" ${(d.open?.[key] ?? open) ? 'open' : ''}><summary data-wizard-toggle="${key}"><span>${title}</span>${hint ? `<small>${hint}</small>` : ''}</summary><div class="wizard-more-body">${body}</div></details>`;
const block = (kicker, title, body) => `<section class="wizard-block"><header class="wizard-block-head"><span>${kicker}</span><strong>${title}</strong></header>${body}</section>`;
// Step 2: where the career starts (region and comune: the essential) and as what (the path, the scenario and, in the Parliament, the group).
function startingPoint(d, territory, place, parliamentaryGroups, realPoliticians) {
  return block('DOVE', 'Il territorio da cui parti', whereStep(d, territory)) + block('RUOLO E SCENARIO', 'La carica o il percorso', levelStep(d, parliamentaryGroups, realPoliticians, place));
}
// Step 4: difficulty (three cards, one chosen) and the starting conditions, shut under their current choice.
function advancedStep(d, pollView) {
  const start = START_PROFILES[normalizeStart(d.start).profile];
  return difficultyStep(d) + pollStep(d, pollView) + more(d, 'start', 'Condizioni di partenza', `${esc(start?.label ?? 'Ordinaria')} · outsider, debiti, partito diviso, carriera consolidata o scenario tuo`, startStep(d));
}
function whereStep(d, territory) {
  const regionSelect = `<label>Regione<select name="region" data-wizard-region><option value="">Scegli la regione</option>${ITALIAN_REGIONS.map(region => `<option value="${esc(region)}" ${d.region === region ? 'selected' : ''}>${esc(region)}</option>`).join('')}</select></label>`;
  const note = `<div class="wizard-data-note">Fonte: ${territory?.sourceUrl ? `<a href="${esc(territory.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(territory.sourceName ?? 'ISTAT')} ↗</a>` : 'ISTAT, Elenco dei comuni italiani (21 febbraio 2026)'} · ${Number(territory?.municipalities?.length ?? 7894).toLocaleString('it-IT')} comuni, codici e denominazioni 2026 (compreso il nuovo assetto della Sardegna). Dato reale, in sola lettura: la tua carriera resta una simulazione.</div>`;
  // The ISTAT list is compulsory: while it is loading the wizard says so; if it failed, the reason and “Riprova”.
  if (!territory?.municipalities?.length) return `<div class="wizard-form-grid">${regionSelect}</div>${territory?.status === 'error'
    ? `<div class="wizard-data-alert" role="alert"><span>L’elenco ISTAT dei comuni non è stato caricato${territory.error ? ` (${esc(territory.error)})` : ''}. Il comune va scelto da quell’elenco: controlla la connessione e riprova.</span><button type="button" class="secondary-button" data-wizard-retry-data>Riprova</button></div>`
    : '<div class="empty-inline" role="status">Caricamento dell’elenco ISTAT dei comuni…</div>'}${note}`;
  if (!d.region) return `<div class="wizard-form-grid">${regionSelect}</div><div class="wizard-place-hint">${ico('pin', 18)}<span>Scegli prima la regione: poi puoi cercare il comune, anche filtrando per provincia o città metropolitana.</span></div>${note}`;
  const units = territory.units.filter(unit => unit.gameRegion === d.region).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  const unitSelect = `<label>Provincia o città metropolitana<select name="territorialUnit" data-wizard-unit><option value="">Tutte (${units.length})</option>${units.map(unit => `<option value="${esc(unit.code)}" ${d.territorialUnit === unit.code ? 'selected' : ''}>${esc(unitLabel(unit))} · ${esc(unit.type)}</option>`).join('')}</select></label>`;
  const allowed = new Set((d.territorialUnit ? units.filter(unit => unit.code === d.territorialUnit) : units).map(unit => unit.code));
  const query = fold(d.municipalityQuery);
  const keys = keysOf(territory.municipalities);
  const matches = territory.municipalities.map((item, index) => [item, keys[index]]).filter(([item, key]) => allowed.has(item.unit) && (!query || key.includes(query)))
    .sort(([a, keyA], [b, keyB]) => (query ? Number(!keyB.startsWith(query)) - Number(!keyA.startsWith(query)) : 0) || a.name.localeCompare(b.name, 'it')).map(([item]) => item);
  const limit = Math.max(40, Number(d.municipalityLimit) || 40);
  const unitByCode = new Map(units.map(unit => [unit.code, unit]));
  const options = matches.slice(0, limit).map(item => `<button type="button" class="municipality-option ${d.municipalityCode === item.code ? 'selected' : ''}" data-municipality-code="${esc(item.code)}" aria-pressed="${d.municipalityCode === item.code}"><strong>${esc(item.name)}${item.alt ? ` <em>/ ${esc(item.alt)}</em>` : ''}</strong><small>${esc(unitLabel(unitByCode.get(item.unit) ?? { name: '' }))}${item.capital ? ' · capoluogo' : ''} · ${esc(residentsText(item.code))}</small></button>`).join('');
  const place = chosenPlace(d, territory);
  const chosen = place ? `<div class="wizard-place-selected"><span class="source-pill">DATO REALE · ISTAT</span><strong>Comune di ${esc(place.municipality.name)}${place.municipality.alt ? ` / ${esc(place.municipality.alt)}` : ''}</strong><small>${esc(place.unit.type)} di ${esc(unitLabel(place.unit))} · ${esc(place.region)} · codice ISTAT ${esc(place.municipality.code)}</small><small class="wizard-residents" data-residents="${esc(place.municipality.code)}">${esc(residentsText(place.municipality.code))}</small><small>Sarà il territorio iniziale della tua carriera.</small></div>` : '<div class="wizard-place-selected is-empty">Nessun comune scelto: cercalo nell’elenco.</div>';
  const unitChosen = units.find(unit => unit.code === d.territorialUnit);
  const count = matches.length ? `Mostrati ${Math.min(limit, matches.length).toLocaleString('it-IT')} di ${matches.length.toLocaleString('it-IT')} comuni` : 'Nessun comune corrisponde alla ricerca.';
  const list = `<div class="wizard-party-count">${count}</div><div class="municipality-list">${options}</div>${matches.length > limit ? '<button type="button" class="wizard-show-more" data-wizard-show-municipalities>Mostra altri comuni</button>' : ''}`;
  return `<div class="wizard-form-grid">${regionSelect}<label class="wizard-full-field">Cerca il comune<input type="search" name="municipalityQuery" data-wizard-municipality-search value="${val(d, 'municipalityQuery')}" placeholder="Nome del comune…" autocomplete="off" /></label></div>
    ${more(d, 'province', 'Filtra per provincia o città metropolitana', unitChosen ? esc(unitLabel(unitChosen)) : `tutte (${units.length})`, `<div class="wizard-form-grid">${unitSelect}</div>`, Boolean(d.territorialUnit))}
    ${chosen}
    ${more(d, 'comuni', place ? 'Cambia comune' : 'Elenco dei comuni', esc(count), list, !place)}${note}`;
}
// ---------- the opening poll: the real Supermedia, an invented but plausible picture drawn from a seed, or the numbers the player writes ----------
const fmt1 = value => (Math.round(Number(value) * 10) / 10).toFixed(1).replace('.', ',');
export const pollScenarioOf = d => ({ mode: d.pollMode ?? 'realistico', seed: d.pollSeed ?? '', custom: d.pollCustom ?? {} });
function pollStep(d, view) {
  const mode = view?.mode ?? d.pollMode ?? 'realistico';
  const heading = `<div class="summary-section-heading"><div><span>SONDAGGIO INIZIALE</span><strong>${esc(POLL_SCENARIOS[mode]?.label ?? 'Realistico')}</strong></div></div>`;
  if (!view?.available) return `<section class="summary-section poll-scenario">${heading}<small>La Supermedia reale non è ancora stata caricata: la partita partirà dai dati disponibili.</small></section>`;
  const cards = Object.entries(POLL_SCENARIOS).map(([id, item]) => `<label class="difficulty-card ${mode === id ? 'selected' : ''}"><input type="radio" name="pollMode" value="${id}" ${mode === id ? 'checked' : ''} /><strong>${esc(item.label)}</strong><small>${esc(item.detail)}</small></label>`).join('');
  const base = view.base ? `${esc(view.base.label)} del ${esc(formatDate(view.base.referenceDate ?? view.base.publishedAt))}` : 'Supermedia reale';
  const custom = mode === 'personalizzato';
  const rows = view.rows.map(row => {
    const cell = custom
      ? `<input type="number" inputmode="decimal" step="0.1" min="${SCENARIO_LIMITS.minShare}" max="${SCENARIO_LIMITS.maxShare}" name="poll_${esc(row.partyId)}" value="${esc(d.pollCustom?.[row.partyId] ?? row.share)}" aria-label="${esc(row.label)}: percentuale nel sondaggio iniziale" />`
      : `<b>${fmt1(row.share)}%</b>`;
    return `<li class="poll-scenario-row"><span class="poll-scenario-name">${esc(row.label)}</span><span class="poll-scenario-real" title="Supermedia reale">${fmt1(row.real)}%</span><span class="poll-scenario-new">${cell}</span></li>`;
  }).join('');
  const table = `<ul class="poll-scenario-table" aria-label="Sondaggio iniziale: reale e della partita"><li class="poll-scenario-row is-head"><span>Forza</span><span>Reale</span><span>In partita</span></li>${rows}<li class="poll-scenario-row is-others"><span class="poll-scenario-name">Altri</span><span class="poll-scenario-real">${fmt1(view.realOthers)}%</span><span class="poll-scenario-new"><b>${fmt1(view.others)}%</b></span></li></ul>`;
  const seed = mode === 'casuale' ? `<div class="poll-scenario-seed"><label>Seme<input name="pollSeed" data-poll-seed value="${esc(d.pollSeed ?? '')}" maxlength="40" autocomplete="off" spellcheck="false" placeholder="Un testo qualsiasi" /></label><button type="button" class="secondary-button" data-poll-new-seed>Nuovo seme</button></div>` : '';
  const tools = custom ? `<div class="poll-scenario-seed"><button type="button" class="secondary-button" data-poll-fit>Porta a 100</button><button type="button" class="secondary-button" data-poll-reset>Rimetti i valori reali</button></div>` : '';
  const problems = view.problems?.length ? `<ul class="poll-problems" role="alert">${view.problems.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '';
  const total = `<p class="poll-scenario-total ${view.problems?.length ? 'is-bad' : ''}" role="status">Totale <b>${fmt1(view.partiesTotal + view.others)}%</b> · partiti ${fmt1(view.partiesTotal)}% + Altri ${fmt1(view.others)}%</p>`;
  const note = mode === 'realistico'
    ? `Parti dal sondaggio reale: ${base} (${esc(view.base?.sourceName ?? 'fonte')}).`
    : `Quadro simulato sulle stesse forze di ${base}: i dati reali restano intatti e il sondaggio è segnato ovunque come «scenario», mai come dato della fonte. Dalla prima settimana i sondaggi sono comunque simulati.`;
  return `<section class="summary-section poll-scenario">${heading}<div class="difficulty-grid" role="radiogroup" aria-label="Sondaggio iniziale">${cards}</div>${seed}${more(d, 'poll', mode === 'realistico' ? 'Vedi le percentuali di partenza' : 'Le percentuali di partenza', `${fmt1(view.total)}% con Altri`, table + tools + total + problems, mode !== 'realistico')}<small>${note}</small></section>`;
}
function difficultyStep(d) {
  const setting = DIFFICULTIES[d.difficulty] ?? DIFFICULTIES.normale;
  return '<section class="summary-section difficulty-section"><div class="summary-section-heading"><div><span>DIFFICOLTÀ</span><strong>' + esc(setting.label) + '</strong></div></div><div class="difficulty-grid" role="radiogroup" aria-label="Difficoltà della partita">' + Object.entries(DIFFICULTIES).map(([id, item]) => '<label class="difficulty-card ' + ((d.difficulty ?? 'normale') === id ? 'selected' : '') + '"><input type="radio" name="difficulty" value="' + id + '" ' + ((d.difficulty ?? 'normale') === id ? 'checked' : '') + ' /><strong>' + esc(item.label) + '</strong><em>' + esc(item.short) + '</em><small>' + esc(item.detail) + '</small></label>').join('') + '</div><small>Si sceglie all’inizio e resta per tutta la carriera.</small></section>';
}
// The previous job: a list to choose from, with «Altro» to write one's own; the value kept in the draft is always the text itself (previousProfession), as before.
export const PROFESSIONS = Object.freeze(['Insegnante', 'Avvocato', 'Medico', 'Infermiere', 'Ingegnere', 'Imprenditore', 'Commerciante', 'Artigiano', 'Agricoltore', 'Operaio', 'Impiegato', 'Dirigente d’azienda', 'Libero professionista', 'Giornalista', 'Docente universitario', 'Ricercatore', 'Funzionario pubblico', 'Sindacalista', 'Studente', 'Pensionato']);
function professionField(d) {
  const text = String(d.previousProfession ?? '').trim();
  const choice = PROFESSIONS.includes(text) ? text : (text || d.professionChoice === 'altro') ? 'altro' : '';
  return '<label class="wizard-full-field">Professione precedente<select name="professionChoice" autocomplete="off"><option value="" ' + (choice === '' ? 'selected' : '') + '>Scegli dall’elenco…</option>' + PROFESSIONS.map(item => '<option value="' + esc(item) + '" ' + (choice === item ? 'selected' : '') + '>' + esc(item) + '</option>').join('') + '<option value="altro" ' + (choice === 'altro' ? 'selected' : '') + '>Altro…</option></select></label>'
    + (choice === 'altro' ? '<label class="wizard-full-field">Scrivi la professione<input name="previousProfession" value="' + val(d, 'previousProfession') + '" autocomplete="organization-title" maxlength="100" placeholder="Es. restauratrice, pilota, musicista" /></label>' : '<input type="hidden" name="previousProfession" value="' + esc(choice) + '" />');
}
function profileStep(state, d) {
  return `<section class="summary-section wizard-profile"><div class="summary-section-heading"><div><span>CHI SEI</span><strong>Il tuo politico</strong></div></div><div class="wizard-form-grid">
    <label>Nome<input name="firstName" value="${val(d, 'firstName')}" autocomplete="given-name" maxlength="40" placeholder="Il tuo nome" /></label>
    <label>Cognome<input name="lastName" value="${val(d, 'lastName')}" autocomplete="family-name" maxlength="50" placeholder="Il tuo cognome" /></label>
    <label>Data di nascita<input type="date" name="birthDate" value="${val(d, 'birthDate')}" max="${esc(d.currentDate ?? state.clock.currentDate)}" /></label>
    <label>Genere<select name="gender"><option value="preferisco-non-specificare" ${d.gender === 'preferisco-non-specificare' ? 'selected' : ''}>Preferisco non specificare</option><option value="donna" ${d.gender === 'donna' ? 'selected' : ''}>Donna</option><option value="uomo" ${d.gender === 'uomo' ? 'selected' : ''}>Uomo</option><option value="non-binario" ${d.gender === 'non-binario' ? 'selected' : ''}>Non binario</option></select></label>
    ${professionField(d)}
  </div><small class="wizard-hint">Sono i dati del tuo personaggio, non i tuoi: puoi inventarli. Servono solo a questa carriera. La data di nascita è quella del personaggio.</small></section>`;
}
function levelStep(d, parliamentaryGroups, realPoliticians, place = null) {
  const details = {
    comunale: ['Territorio locale', 'Parti dal tuo comune e costruisci relazioni nella comunità.'],
    provinciale: ['Area vasta', 'Consigliere comunale e provinciale: la provincia la eleggono sindaci e consiglieri, non i cittadini. Contano la rete degli amministratori e le strade e le scuole del territorio.'],
    regionale: ['Scala regionale', 'Costruisci una carriera con una prospettiva regionale.'],
    deputato: ['Camera dei deputati', 'Inizia una carriera parlamentare alla Camera.'],
    senatore: ['Senato della Repubblica', 'Inizia una carriera parlamentare al Senato.'],
    europeo: ['Parlamento europeo', 'Inizia da eurodeputato: commissioni, relazioni e voti al Parlamento europeo.']
  };
  const levels = Object.entries(CAREER_LEVELS);
  // A provincial career needs a province with organs in the chosen place (not Valle d’Aosta, the autonomous provinces, FVG).
  const noProvince = key => key === 'provinciale' && Boolean(place) && !hasProvincialLevel({ region: place.region, provinceCode: place.unit.code, provinceType: place.unit.type });
  const cards = levels.map(([key], i) => {
    const selected = !d.startingOffice && d.initialLevel === key;
    return '<button type="button" class="level-card ' + (selected ? 'selected' : '') + (noProvince(key) ? ' is-disabled' : '') + '" data-level="' + esc(key) + '" aria-pressed="' + selected + '"' + (noProvince(key) ? ' disabled aria-disabled="true"' : '') + '><span class="level-card-top"><span class="level-index">0' + (i + 1) + '</span><span class="radio-ring"></span></span><strong>' + (key === 'deputato' ? 'DEPUTATO' : key === 'senatore' ? 'SENATORE' : key === 'comunale' ? 'COMUNALE' : key === 'europeo' ? 'EURODEPUTATO' : key === 'provinciale' ? 'PROVINCIALE' : 'REGIONALE') + '</strong><p>' + esc(noProvince(key) ? PROVINCIAL_LEVEL_PROBLEM : details[key][1]) + '</p><span class="level-scope">' + esc(details[key][0]) + '</span></button>';
  }).join('');
  const pdcSelected = d.startingOffice === 'presidenteConsiglio';
  const presidentSelected = d.startingOffice === 'presidenteRepubblica';
  const pdcCard = '<button type="button" class="level-card ' + (pdcSelected ? 'selected' : '') + '" data-starting-office="presidenteConsiglio" aria-pressed="' + pdcSelected + '"><span class="level-card-top"><span class="level-index">07</span><span class="radio-ring"></span></span><strong>PRESIDENTE DEL CONSIGLIO</strong><p>Governo attivo e maggioranza nelle due Camere; scegli se avere un seggio personale.</p><span class="level-scope">Punto di partenza istituzionale</span></button>';
  const presidentCard = '<button type="button" class="level-card ' + (presidentSelected ? 'selected' : '') + '" data-starting-office="presidenteRepubblica" aria-pressed="' + presidentSelected + '"><span class="level-card-top"><span class="level-index">08</span><span class="radio-ring"></span></span><strong>PRESIDENTE DELLA REPUBBLICA</strong><p>Partenza diretta al Quirinale, senza seggio o incarichi di partito.</p><span class="level-scope">Scenario alternativo</span></button>';
  const chamber = pdcSelected && d.parliamentStartMode === 'external' ? null : CAREER_LEVELS[d.initialLevel]?.chamber;
  const pdcContext = d.parliamentStartMode === 'external' ? 'external' : chamber ?? 'camera';
  const pdcChambers = pdcSelected ? '<div class="wizard-pdc-context"><strong>Contesto parlamentare del PdC</strong><div class="wizard-pdc-chambers">' + [['camera', 'Camera · con seggio'], ['senato', 'Senato · con seggio'], ['external', 'Esterno al Parlamento']].map(([id, label]) => '<button type="button" class="level-scope-choice ' + (pdcContext === id ? 'selected' : '') + '" data-pdc-context="' + id + '" aria-pressed="' + (pdcContext === id) + '"><span class="radio-ring"></span>' + label + '</button>').join('') + '</div><small>' + (pdcContext === 'external' ? 'Nessun seggio o gruppo personale; il Governo usa un gruppo solo come riferimento di coalizione, senza attribuirlo al giocatore.' : 'Il gruppo personale resta quello reale selezionato per il contesto parlamentare.') + '</small></div>' : '';
  let context = '';
  if (chamber) {
    const query = String(d.groupQuery ?? '').trim().toLocaleLowerCase('it-IT');
    const compatible = parliamentaryGroups.filter(group => group.source === DATA_SOURCES.REAL && group.verified === true && group.chamber === chamber);
    const shown = compatible.filter(group => !query || group.officialName.toLocaleLowerCase('it-IT').includes(query));
    const selected = compatible.find(group => group.id === d.parliamentaryGroupId);
    const groupRows = shown.map(group => {
      const leader = realPoliticians.find(person => person.id === group.leaderPoliticianId && person.source === DATA_SOURCES.REAL && person.verified === true);
      const count = Number.isInteger(group.memberCount) ? group.memberCount + ' componenti nel riferimento reale' : 'Composizione numerica non disponibile';
      const leaderLabel = leader ? ' · Capogruppo documentato: ' + (leader.fullName || leader.firstName + ' ' + leader.lastName) : '';
      return '<div class="wizard-group-option ' + (d.parliamentaryGroupId === group.id ? 'selected' : '') + '"><button type="button" data-group-id="' + esc(group.id) + '" aria-pressed="' + (d.parliamentaryGroupId === group.id) + '"><span class="radio-ring"></span><span><strong>' + esc(group.officialName) + '</strong><small>' + esc(count + (group.countAsOf ? ' · ' + group.countAsOf : '') + leaderLabel) + '</small></span></button><a href="' + esc(group.sourceUrl) + '" target="_blank" rel="noopener noreferrer">Fonte ↗</a></div>';
    }).join('');
    context = '<section class="wizard-parliament-context"><div class="wizard-parliament-title"><div><span class="section-kicker">CONTESTO AVANZATO · ' + (chamber === 'camera' ? 'CAMERA' : 'SENATO') + '</span><strong>' + (pdcSelected ? 'Gruppo parlamentare di riferimento' : 'Parti da un contesto parlamentare reale') + '</strong></div><span class="source-pill">Dati reali verificati</span></div><p>La Camera, il Senato e i gruppi provengono dal database reale. L’ingresso del tuo personaggio, il posto nello scenario e le variabili di gioco sono simulati.</p><label class="wizard-group-search">Cerca un gruppo<input type="search" name="groupQuery" data-wizard-group-search value="' + val(d, 'groupQuery') + '" placeholder="Nome del gruppo…" autocomplete="off" /></label><div class="wizard-group-list">' + (groupRows || '<div class="empty-inline">' + (compatible.length ? 'Nessun gruppo corrisponde alla ricerca.' : 'Caricamento dei gruppi reali in corso…') + '</div>') + '</div>' + (selected ? '<div class="wizard-group-selected">Riferimento scelto: <strong>' + esc(selected.officialName) + '</strong> · ' + esc(selected.sourceName || 'Fonte istituzionale') + '</div>' : '<div class="wizard-group-selected">Seleziona un gruppo per configurare lo scenario parlamentare.</div>') + '<div class="wizard-data-note">Partito e gruppo parlamentare restano separati. Il database non documenta una relazione diretta con questo personaggio creato da te: la scelta del gruppo è esplicita e simulata.</div></section>';
  }
  const contextBlock = context ? more(d, 'group', 'Contesto parlamentare', esc(d.parliamentaryGroupId ? (parliamentaryGroups.find(group => group.id === d.parliamentaryGroupId)?.officialName ?? 'gruppo scelto') : 'scegli il gruppo di riferimento'), context, !d.parliamentaryGroupId) : '';
  return '<div class="level-cards">' + cards + pdcCard + presidentCard + '</div>' + pdcChambers + contextBlock + '<div class="wizard-data-note">La carriera parlamentare è uno scenario di gioco: non aggiunge il tuo personaggio agli elenchi dei parlamentari reali e non modifica le consistenze ufficiali.</div>';
}
// --- Party-selection filter: only criteria that exist in the data (orientation, kind, status, origin) plus name search. ---
const KIND_LABELS = { party: 'Partito', politicalMovement: 'Movimento', coalition: 'Coalizione / lista' };
const STATUS_LABELS = { active: 'In attività', historical: 'Storico' };
const NO_VALUE = '__none__';
const capital = text => text.charAt(0).toUpperCase() + text.slice(1);
const orientationOf = party => POSITIONS.includes(party.politicalPosition) ? party.politicalPosition : NO_VALUE;
const kindOf = party => party.entityType ?? NO_VALUE;
const statusOf = party => party.status ?? NO_VALUE;
const selectedOrientations = d => Array.isArray(d.partyOrient) ? d.partyOrient : [];
const partyMatches = (party, d, skip) => {
  const query = String(d.partyQuery ?? '').trim().toLocaleLowerCase('it-IT');
  if (query && ![party.officialName, party.name, party.abbreviation].filter(Boolean).join(' ').toLocaleLowerCase('it-IT').includes(query)) return false;
  if (d.partyFilter && d.partyFilter !== 'all' && party.source !== d.partyFilter) return false;
  if (skip !== 'orient' && selectedOrientations(d).length && !selectedOrientations(d).includes(orientationOf(party))) return false;
  if (skip !== 'kind' && d.partyKind && d.partyKind !== 'all' && kindOf(party) !== d.partyKind) return false;
  if (skip !== 'status' && d.partyStatus && d.partyStatus !== 'all' && statusOf(party) !== d.partyStatus) return false;
  return true;
};
export function filterWizardParties(parties, d) {
  return parties.filter(party => partyMatches(party, d)).sort((a, b) => (a.officialName ?? a.name).localeCompare(b.officialName ?? b.name, 'it'));
}
// The criteria currently applied, as { key, value, label } — each can be removed on its own.
export function activePartyCriteria(d) {
  const out = [];
  if (String(d.partyQuery ?? '').trim()) out.push({ key: 'query', value: '', label: '“' + String(d.partyQuery).trim() + '”' });
  for (const value of selectedOrientations(d)) out.push({ key: 'orient', value, label: value === NO_VALUE ? 'Orientamento non indicato' : capital(value) });
  if (d.partyKind && d.partyKind !== 'all') out.push({ key: 'kind', value: d.partyKind, label: KIND_LABELS[d.partyKind] ?? 'Tipo non indicato' });
  if (d.partyStatus && d.partyStatus !== 'all') out.push({ key: 'status', value: d.partyStatus, label: STATUS_LABELS[d.partyStatus] ?? 'Stato non indicato' });
  if (d.partyFilter && d.partyFilter !== 'all') out.push({ key: 'source', value: d.partyFilter, label: d.partyFilter === 'real' ? 'Dati reali verificati' : 'Creati da te' });
  return out;
}
export function removePartyCriterion(d, key, value) {
  if (key === 'query') d.partyQuery = '';
  else if (key === 'orient') d.partyOrient = selectedOrientations(d).filter(item => item !== value);
  else if (key === 'kind') d.partyKind = 'all';
  else if (key === 'status') d.partyStatus = 'all';
  else if (key === 'source') d.partyFilter = 'all';
  else if (key === 'all') { d.partyQuery = ''; d.partyOrient = []; d.partyKind = 'all'; d.partyStatus = 'all'; d.partyFilter = 'all'; }
  d.partyListLimit = 12;
}
export function togglePartyOrientation(d, value) {
  const current = selectedOrientations(d);
  d.partyOrient = current.includes(value) ? current.filter(item => item !== value) : [...current, value];
  d.partyListLimit = 12;
}
function partyFilterControls(parties, d) {
  const count = (skip, test) => parties.filter(party => partyMatches(party, d, skip) && test(party)).length;
  const present = (get, order) => {
    const values = [...new Set(parties.map(get))];
    return order ? [...order.filter(value => values.includes(value)), ...(values.includes(NO_VALUE) ? [NO_VALUE] : [])] : values;
  };
  const chosen = selectedOrientations(d);
  const chips = present(orientationOf, POSITIONS).map(value => {
    const n = count('orient', party => orientationOf(party) === value);
    const on = chosen.includes(value);
    return '<button type="button" class="party-chip pos-' + esc(value === NO_VALUE ? 'nd' : value.replace(/\s+/g, '-')) + (on ? ' on' : '') + '" data-party-orient="' + esc(value) + '" aria-pressed="' + on + '"' + (!n && !on ? ' disabled' : '') + '>' + esc(value === NO_VALUE ? 'Non indicato' : capital(value)) + ' <b>' + n + '</b></button>';
  }).join('');
  const select = (name, label, skip, get, values, labels, current, nothing) => values.length < 2 ? '' :
    '<label>' + label + '<select name="' + name + '" data-wizard-party-facet><option value="all">' + nothing + '</option>' + values.map(value => '<option value="' + esc(value) + '" ' + (current === value ? 'selected' : '') + '>' + esc(labels[value] ?? 'Non indicato') + ' (' + count(skip, party => get(party) === value) + ')</option>').join('') + '</select></label>';
  const criteria = activePartyCriteria(d);
  const removable = criteria.map(item => '<button type="button" class="party-criterion" data-party-criterion="' + esc(item.key) + '" data-value="' + esc(item.value) + '" aria-label="Rimuovi criterio: ' + esc(item.label) + '">' + esc(item.label) + ' <span aria-hidden="true">×</span></button>').join('');
  const facets = select('partyKind', 'Tipo', 'kind', kindOf, present(kindOf), KIND_LABELS, d.partyKind, 'Tutti i tipi') + select('partyStatus', 'Stato', 'status', statusOf, present(statusOf), STATUS_LABELS, d.partyStatus, 'Tutti gli stati');
  return '<div class="wizard-party-controls"><label>Cerca partito<input type="search" name="partyQuery" data-wizard-party-search value="' + val(d, 'partyQuery') + '" placeholder="Nome o sigla…" autocomplete="off" /></label>' +
    '<label>Origine<select name="partyFilter" data-wizard-party-filter><option value="all" ' + (!d.partyFilter || d.partyFilter === 'all' ? 'selected' : '') + '>Tutte le origini</option><option value="real" ' + (d.partyFilter === 'real' ? 'selected' : '') + '>Dati reali verificati</option><option value="user" ' + (d.partyFilter === 'user' ? 'selected' : '') + '>Creati da te</option></select></label></div>' +
    '<div class="party-orient" role="group" aria-label="Orientamento politico"><span class="party-orient-title">Orientamento politico <small>(puoi sceglierne più di uno)</small></span><div class="party-chip-row">' + chips + '</div></div>' +
    (facets ? '<div class="wizard-party-controls wizard-party-facets">' + facets + '</div>' : '') +
    (criteria.length ? '<div class="party-criteria" aria-label="Criteri applicati">' + removable + '<button type="button" class="party-criterion party-clear" data-party-criterion="all">Rimuovi tutti i filtri</button></div>' : '');
}
function partyStep(d, parties, logoFor, parliamentaryGroups, partyLeaderships, politicalFigures) {
  const modes = [
    ['independent', 'Indipendente', 'Comincia senza affiliazione.'],
    ['existing', 'Entra in un partito', 'Consulta le schede documentate e scegli un riferimento reale o simulato.'],
    ['new', 'Crea un partito', 'Definisci una nuova organizzazione.']
  ];
  let detail = '';
  if (d.partyMode === 'existing') {
    const available = filterWizardParties(parties, d);
    const limit = Math.max(12, Number(d.partyListLimit) || 12);
    const shown = available.slice(0, limit);
    const cards = shown.map(party => {
      const name = party.officialName ?? party.name;
      const logo = logoFor(party) ?? party.logoAsset ?? party.logoUrl;
      const color = /^#[\da-f]{6}$/i.test(party.color ?? '') ? party.color : null;
      const mark = logo ? '<img class="wizard-party-logo" src="' + esc(logo) + '" alt="' + esc(party.logoAlt ?? ('Logo di ' + name)) + '" loading="lazy" />' : '<span class="wizard-party-placeholder" aria-hidden="true">' + esc((party.abbreviation || name.slice(0, 2)).slice(0, 3)) + '</span>';
      // A coalition that stands as one list (AVS) is a political force one can join, not a party: it says so.
      const sourceName = (party.entityType === 'coalition' ? 'COALIZIONE / LISTA ELETTORALE · ' : '') + (party.source === DATA_SOURCES.REAL ? 'DATO REALE VERIFICATO' : party.source === DATA_SOURCES.USER ? 'CREATO DA TE' : 'SIMULAZIONE');
      const leaders = partyLeaderships.filter(item => item.partyId === party.id && item.source === DATA_SOURCES.REAL && item.verified === true).map(item => {
        const figure = politicalFigures.find(person => person.id === item.politicalFigureId && person.source === DATA_SOURCES.REAL && person.verified === true);
        return figure ? item.role + ': ' + figure.fullName : null;
      }).filter(Boolean);
      const facts = [
        party.level ? 'Livello: ' + party.level : null,
        party.geographicArea ? 'Territorio: ' + party.geographicArea : null,
        party.status ? 'Stato: ' + party.status : null,
        Number.isInteger(party.parliamentaryPresence) ? 'Presenza parlamentare documentata: ' + party.parliamentaryPresence : null,
        Number.isInteger(party.regionalPresence) ? 'Presenza regionale documentata: ' + party.regionalPresence : null,
        party.foundedAt ? 'Fondato: ' + party.foundedAt : null
      ].filter(Boolean);
      const description = party.factualDescription ?? party.description;
      const officialSource = party.source === DATA_SOURCES.REAL && party.sourceUrl ? '<a class="wizard-party-source" href="' + esc(party.sourceUrl) + '" target="_blank" rel="noopener noreferrer">Fonte ufficiale ↗</a>' : '';
      const website = party.source === DATA_SOURCES.REAL && party.website ? '<a class="wizard-party-source" href="' + esc(party.website) + '" target="_blank" rel="noopener noreferrer">Sito ↗</a>' : '';
      return '<article class="wizard-party-entry ' + (d.partyId === party.id ? 'selected' : '') + '" style="' + (color ? '--party-color:' + esc(color) : '') + '"><button type="button" class="demo-party ' + (d.partyId === party.id ? 'selected' : '') + '" data-party-id="' + esc(party.id) + '" aria-pressed="' + (d.partyId === party.id) + '">' + mark + '<span class="demo-party-copy"><strong>' + esc(name) + '</strong><small>' + esc(party.abbreviation || 'Sigla non documentata') + ' · ' + esc(description || 'Descrizione non presente nelle fonti caricate.') + '</small><em>' + esc([sourceName, ...facts, ...leaders].join(' · ')) + '</em></span><span class="source-pill">' + sourceName + '</span></button>' + officialSource + website + '</article>';
    }).join('');
    detail = partyFilterControls(parties, d) + '<div class="wizard-party-count">' + (available.length ? 'Mostrati ' + shown.length + ' di ' + available.length : 'Nessun partito corrisponde ai criteri scelti.') + '</div><div class="demo-party-list">' + (cards || '<div class="empty-inline">Rimuovi un criterio o prova un altro nome.</div>') + '</div>' + (shown.length < available.length ? '<button type="button" class="wizard-show-more" data-wizard-show-parties>Mostra altri partiti</button>' : '') + '<div class="wizard-data-note">Mostriamo solo informazioni presenti nel dataset. Le appartenenze a gruppi non vengono dedotte dal nome del partito; il riferimento al gruppo resta una scelta separata dello scenario.</div>';
  }
  if (d.partyMode === 'new') detail = '<div class="new-party-form"><div class="wizard-form-grid"><label>Nome del partito<input name="partyName" value="' + val(d, 'partyName') + '" maxlength="60" placeholder="Il nome del tuo partito" /></label><label>Abbreviazione<input name="partyAbbreviation" value="' + val(d, 'partyAbbreviation') + '" maxlength="8" placeholder="Sigla" /></label><label class="wizard-full-field">Descrizione<textarea name="partyDescription" maxlength="240" rows="2" placeholder="Qual è la ragione d’essere del partito?">' + val(d, 'partyDescription') + '</textarea></label><label>Orientamento generale<select name="partyOrientation">' + ['Centrismo civico', 'Progressista', 'Conservatore', 'Liberale', 'Socialdemocratico', 'Ecologista', 'Popolare', 'Autonomista', 'Altro'].map(option => '<option ' + (d.partyOrientation === option ? 'selected' : '') + '>' + esc(option) + '</option>').join('') + '</select></label><label>Collocazione<select name="partyPosition">' + POSITIONS.map(option => '<option value="' + option + '" ' + ((d.partyPosition ?? 'centro') === option ? 'selected' : '') + '>' + esc(option.charAt(0).toUpperCase() + option.slice(1)) + '</option>').join('') + '</select></label><label class="color-field">Colore principale<span class="color-input-wrap"><input type="color" name="partyColor" value="' + val(d, 'partyColor') + '" /><span>' + esc(d.partyColor || '#264d82') + '</span></span></label></div>' + logoBuilder(d) + '<section class="wizard-section wizard-program-section" aria-label="Programma del partito"><div class="policy-heading"><strong>Programma: fino a quattro priorità</strong><small>Le aree interne del partito le confrontano con i loro temi; da segretario potrai cambiarle.</small></div><div class="wizard-program">' + Object.entries(AREA_GROUPS).map(([group, label]) => '<fieldset><legend>' + esc(label) + '</legend>' + POLICY_AREAS.filter(item => item.group === group).map(item => '<label class="agenda-option"><input type="checkbox" name="partyProgram" value="' + esc(item.id) + '" ' + ((d.partyProgram ?? []).includes(item.id) ? 'checked' : '') + ' /><span>' + esc(item.label) + '</span></label>').join('') + '</fieldset>').join('') + '</div></section><section class="wizard-section" aria-label="Posizioni sulle grandi aree"><div class="policy-heading"><strong>Posizione sulle grandi aree</strong><small>1 = più prudente · 5 = più orientata al cambiamento</small></div><div class="policy-grid">' + [['economia', 'Economia'], ['welfare', 'Welfare e servizi'], ['ambiente', 'Ambiente'], ['europa', 'Integrazione europea']].map(([key, label]) => '<label class="policy-slider"><span>' + label + '</span><input type="range" name="policy_' + key + '" min="1" max="5" step="1" value="' + Number(d.policyPositions?.[key] ?? 3) + '" /><output>' + Number(d.policyPositions?.[key] ?? 3) + '</output></label>').join('') + '</div></section><div class="wizard-data-note">Il partito creato da te sarà marcato come dato utente e non sarà presentato come organizzazione reale.</div></div>';
  const group = parliamentaryGroups.find(item => item.id === d.parliamentaryGroupId);
  const parliamentaryNote = CAREER_LEVELS[d.initialLevel]?.chamber ? '<div class="wizard-data-note wizard-context-note"><strong>Contesto parlamentare scelto:</strong> ' + esc(group?.officialName || 'gruppo non selezionato') + '. Partito e gruppo rimangono dati separati.</div>' : '';
  const availableModes = d.startingOffice === 'presidenteRepubblica' ? modes.filter(([key]) => key === 'independent') : modes;
  const position = d.partyMode === 'independent'
    ? '<div class="wizard-data-note">Carriera indipendente: nessuna posizione di partito.</div>'
    : d.partyMode === 'new'
      ? '<div class="wizard-data-note wizard-party-position"><strong>Posizione: Fondatore e leader</strong><small>La guida usa lo stato di fondatore del partito; non viene creato un incarico di segreteria duplicato.</small></div>'
      : '<section class="wizard-party-position"><strong>Posizione nel partito</strong><small>La carica istituzionale resta distinta dalla posizione politica.</small><div class="level-cards wizard-party-role-cards">' + Object.entries(STARTING_ROLES).map(([id, role]) => '<button type="button" class="level-card ' + ((d.startingRole ?? 'militante') === id ? 'selected' : '') + '" data-starting-role="' + esc(id) + '" aria-pressed="' + ((d.startingRole ?? 'militante') === id) + '"><span class="level-card-top"><span class="level-index">' + String(role.partyRank).padStart(2, '0') + '</span><span class="radio-ring"></span></span><strong>' + esc(role.label) + '</strong><p>' + (role.partyRank === 0 ? 'Iscritto senza incarico direttivo.' : role.partyRank === 5 ? 'Guida nazionale del partito.' : 'Incarico coerente con il livello organizzativo.') + '</p></button>').join('') + '</div></section>';
  return '<div class="party-mode-grid">' + availableModes.map(([key, title, description]) => '<button type="button" class="party-mode ' + (d.partyMode === key ? 'selected' : '') + '" data-party-mode="' + key + '" aria-pressed="' + (d.partyMode === key) + '"><span class="radio-ring"></span><strong>' + title + '</strong><small>' + description + '</small></button>').join('') + '</div>' + position + detail + parliamentaryNote;
}
// The logo of the new party: built from shape, symbol and colours, linked from an address, or uploaded.
export function wizardLogoPreview(d) {
  if (d.partyLogoMode === 'upload') return d.partyLogoPreview ?? null;
  return partyLogoDataUrl({ shape: d.partyLogoShape, symbol: d.partyLogoSymbol, primary: d.partyColor, text: d.partyAbbreviation });
}
function logoBuilder(d) {
  const mode = d.partyLogoMode ?? 'builder';
  const preview = wizardLogoPreview(d);
  const modes = [['builder', 'Crea con forme e simboli'], ['upload', 'Carica un file']].map(([id, label]) => '<label class="' + (mode === id ? 'active' : '') + '"><input type="radio" name="partyLogoMode" value="' + id + '" ' + (mode === id ? 'checked' : '') + ' />' + label + '</label>').join('');
  const builder = mode === 'builder' ? '<label>Forma<select name="partyLogoShape">' + Object.entries(LOGO_SHAPES).map(([id, item]) => '<option value="' + id + '" ' + (d.partyLogoShape === id ? 'selected' : '') + '>' + esc(item.label) + '</option>').join('') + '</select></label><label>Simbolo<select name="partyLogoSymbol">' + Object.entries(LOGO_SYMBOLS).map(([id, item]) => '<option value="' + id + '" ' + (d.partyLogoSymbol === id ? 'selected' : '') + '>' + esc(item.label) + '</option>').join('') + '</select></label>' : '';
  const url = '';
  // After choosing the file the editor opens in its slot: crop, ratio, zoom, transparency, dominant colour.
  const upload = mode === 'upload' ? '<label class="wizard-full-field logo-admin-upload">File PNG, JPEG o WebP (resta su questo dispositivo, nel tuo catalogo dei loghi)<input type="file" accept="image/png,image/jpeg,image/webp" data-wizard-logo-upload /></label>' + (d.partyLogoError ? '<small class="menu-error">' + esc(d.partyLogoError) + '</small>' : '') + '<div class="wizard-full-field" data-logo-editor-slot></div>' : '';
  return '<section class="wizard-section wizard-logo-section" aria-label="Logo del partito"><div class="policy-heading"><strong>Logo del partito</strong><small>Anteprima e strumenti per crearlo o caricarlo.</small></div><div class="wizard-logo-builder"><div class="wizard-logo-preview" data-wizard-logo-preview>' + (preview ? '<img src="' + esc(preview) + '" alt="Anteprima del logo" />' : '<span>Logo</span>') + '</div><div class="wizard-logo-controls"><div class="segmented" role="group" aria-label="Tipo di logo">' + modes + '</div><div class="wizard-form-grid">' + builder + url + upload + '</div><small>I simboli disponibili sono segni grafici generici, diversi dagli emblemi dei partiti esistenti. Il logo è un dato dell’utente.</small></div></div></section>';
}
function summaryStep(d, parties, level, parliamentaryGroups, place = null, pollView = null) {
  const party = d.partyMode === 'existing' ? parties.find(p => p.id === d.partyId) : null;
  const parliamentaryGroup = parliamentaryGroups.find(group => group.id === d.parliamentaryGroupId);
  const partySummary = d.partyMode === 'independent' ? 'Indipendente'
    : d.partyMode === 'existing' ? (party?.officialName ?? party?.name ?? 'Partito non selezionato') + (party?.abbreviation ? ' · ' + party.abbreviation : '') + ' · ' + (party?.source === DATA_SOURCES.REAL ? 'Dato reale verificato' : party?.source === DATA_SOURCES.USER ? 'Creato da te' : 'Simulazione')
      : (d.partyName || 'Nuovo partito') + ' (' + (d.partyAbbreviation || '—').toUpperCase() + ') · Creato da te' + ((d.partyProgram ?? []).length ? ' · programma: ' + d.partyProgram.map(id => POLICY_AREAS.find(item => item.id === id)?.label ?? id).join(', ') : '');
  const partyPosition = d.partyMode === 'independent' ? 'Nessuna'
    : d.partyMode === 'new' ? 'Fondatore e leader'
      : STARTING_ROLES[d.startingRole ?? 'militante']?.label ?? 'Giovane militante';
  const setting = DIFFICULTIES[d.difficulty] ?? DIFFICULTIES.normale;
  const stats = Object.fromEntries(Object.entries(initialCareerStatistics(d.initialLevel)).map(([metric, value]) => [metric, ['popularity', 'reputation', 'influence'].includes(metric) ? Math.max(0, Math.min(100, value + setting.statStart)) : value]));
  const directPresident = d.startingOffice === 'presidenteRepubblica';
  const externalPremier = d.startingOffice === 'presidenteConsiglio' && d.parliamentStartMode === 'external';
  const chamber = directPresident || externalPremier ? null : CAREER_LEVELS[d.initialLevel]?.chamber;
  // Difficulty: chosen once (step 4), it changes resources, events, outcomes, relations, candidacies and Parliament.
  const difficulty = '<section class="summary-section"><div class="summary-section-heading"><div><span>04 · DIFFICOLTÀ</span><strong>' + esc(setting.label) + '</strong></div><button type="button" data-wizard-goto="4">Modifica</button></div><small>' + esc(setting.short) + '</small></section>';
  const pollMode = pollView?.available ? pollView.mode : 'realistico';
  const pollSummary = pollView?.available ? '<section class="summary-section"><div class="summary-section-heading"><div><span>04 · SONDAGGIO INIZIALE</span><strong>' + esc(POLL_SCENARIOS[pollMode]?.label ?? 'Realistico') + '</strong></div><button type="button" data-wizard-goto="4">Modifica</button></div><small>' + (pollMode === 'realistico' ? 'Supermedia reale ' + esc(pollView.base ? formatDate(pollView.base.referenceDate ?? pollView.base.publishedAt) : '') : pollMode === 'casuale' ? 'Quadro simulato dal seme «' + esc(d.pollSeed || '—') + '» · Altri ' + fmt1(pollView.others) + '%' : 'Percentuali scritte da te · Altri ' + fmt1(pollView.others) + '%') + '</small></section>' : '';
  const pathLabel = directPresident ? 'Presidente della Repubblica — scenario alternativo' : d.startingOffice === 'presidenteConsiglio' ? 'Presidente del Consiglio' : level.label;
  const territorySummary = directPresident ? 'Scenario nazionale alternativo · nessuna carica territoriale personale'
    : externalPremier ? 'Governo nazionale · senza seggio parlamentare personale'
      : d.initialLevel === 'comunale' ? 'Comune di ' + (d.municipality || 'da scegliere') + ' · ' + (d.region || 'Regione') : d.initialLevel === 'provinciale' ? 'Provincia di ' + (d.provinceName || 'da scegliere') + ' · Comune di ' + (d.municipality || 'da scegliere') : d.initialLevel === 'regionale' ? (d.region || 'Regione da scegliere') : (chamber === 'camera' ? 'Camera dei deputati' : chamber === 'senato' ? 'Senato della Repubblica' : 'Territorio nazionale') + ' · ' + (d.region || 'territorio da selezionare');
  const where = '<section class="summary-section"><div class="summary-section-heading"><div><span>02 · DOVE INIZI</span><strong>' + esc(place ? 'Comune di ' + place.municipality.name : d.municipality || 'Comune da scegliere') + '</strong></div><button type="button" data-wizard-goto="2">Modifica</button></div><small>' + esc(place ? place.unit.type + ' di ' + unitLabel(place.unit) + ' · ' + place.region + ' · codice ISTAT ' + place.municipality.code + ' · ' + residentsText(place.municipality.code) : d.region || 'Regione da scegliere') + '</small></section>';
  const metrics = [['Popolarità', stats.popularity], ['Reputazione', stats.reputation], ['Consenso', stats.consensus], ['Esperienza', stats.experience], ['Influenza', stats.influence], ['Notorietà', stats.notoriety]];
  const parliamentary = directPresident || externalPremier || chamber ? '<section class="summary-section"><div class="summary-section-heading"><div><span>CONTESTO PARLAMENTARE</span><strong>' + (directPresident ? 'Nessun seggio o gruppo personale' : externalPremier ? 'Esterno al Parlamento' : chamber === 'camera' ? 'Camera dei deputati' : 'Senato della Repubblica') + '</strong></div><button type="button" data-wizard-goto="2">Modifica</button></div>' + (chamber ? '<div class="summary-facts"><span>Seggio personale simulato · gruppo: ' + esc(parliamentaryGroup?.officialName || 'Da selezionare') + '</span><span>Territorio di riferimento: ' + esc(d.region || 'Non definito') + '</span></div><small>Il riferimento istituzionale è reale; il seggio del tuo personaggio appartiene solo allo scenario simulato.</small>' : '<small>' + (directPresident ? 'Le Camere esistono nello scenario, ma non hai un seggio o un gruppo personale.' : 'Il Governo usa un gruppo solo come riferimento di coalizione, senza attribuirlo al giocatore.') + '</small>') + '</section>' : '';
  const scenario = d.startingOffice ? '<section class="summary-section"><div class="summary-section-heading"><div><span>SCENARIO ISTITUZIONALE</span><strong>' + (directPresident ? 'Mandato presidenziale simulato · scenario alternativo' : 'Governo attivo formato dal giocatore') + '</strong></div></div><small>' + (directPresident ? 'Poteri del Quirinale attivi; nessuna carica parlamentare, governativa o di partito.' : externalPremier ? 'PdC esterno al Parlamento, senza seggio né gruppo personale.' : 'PdC con il seggio e il gruppo selezionati.') + '</small></section>' : '';
  const position = '<section class="summary-section"><div class="summary-section-heading"><div><span>POSIZIONE NEL PARTITO</span><strong>' + esc(partyPosition) + '</strong></div><button type="button" data-wizard-goto="3">Modifica</button></div></section>';
  const affiliation = '<section class="summary-section"><div class="summary-section-heading"><div><span>03 · APPARTENENZA</span><strong>' + esc(partySummary) + '</strong></div><button type="button" data-wizard-goto="3">Modifica</button></div>' + (party?.source === DATA_SOURCES.REAL && party.sourceUrl ? '<a class="catalog-source" href="' + esc(party.sourceUrl) + '" target="_blank" rel="noopener noreferrer">Fonte del partito ↗</a>' : '') + (d.partyMode === 'new' ? '<small>' + esc(d.partyOrientation) + ' · ' + esc(d.partyPosition ?? 'centro') + ' · Colore <i class="summary-color" style="--party:' + esc(d.partyColor) + '"></i></small>' : '') + '</section>';
  const initialStatus = directPresident ? 'Presidente della Repubblica · nessun seggio personale' : externalPremier ? 'Presidente del Consiglio · esterno al Parlamento' : chamber ? 'componente del gruppo nello scenario' : 'carriera territoriale in avvio';
  const identity = '<section class="summary-section"><div class="summary-section-heading"><div><span>01 · IDENTITÀ</span><strong>' + esc([d.firstName, d.lastName].filter(Boolean).join(' ') || 'Nome da inserire') + '</strong></div><button type="button" data-wizard-goto="1">Modifica</button></div><small>' + esc([d.birthDate, d.previousProfession].filter(Boolean).join(' · ') || 'Data di nascita e professione da inserire') + '</small></section>';
  return '<div class="summary-sheet">' + identity + where + '<section class="summary-section"><div class="summary-section-heading"><div><span>02 · PERCORSO ISTITUZIONALE</span><strong>' + esc(pathLabel) + '</strong></div><button type="button" data-wizard-goto="2">Modifica</button></div><small>' + esc(territorySummary) + '</small></section>' + scenario + parliamentary + affiliation + position + '<section class="summary-section"><div class="summary-section-heading"><div><span>STATISTICHE INIZIALI</span><strong>Valori di gioco simulati · base bilanciata per percorso</strong></div></div><div class="summary-stat-grid">' + metrics.map(([label, value]) => '<span><small>' + label + '</small><strong>' + value + '<i>/100</i></strong></span>').join('') + '</div><small>Posizione iniziale: ' + initialStatus + ' · situazione politica non garantita.</small></section>' + difficulty + pollSummary + startSummary(d) + '<div class="summary-disclaimer">Il giocatore è un personaggio creato da te. I valori, la posizione e gli eventi di questa carriera sono simulati. Le fonti istituzionali restano in sola lettura.</div></div>';
}
