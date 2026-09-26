import { CAREER_LEVELS, ITALIAN_REGIONS, initialCareerStatistics } from '../data/regions.js?v=20260926-8';
import { LOGO_SHAPES, LOGO_SYMBOLS, partyLogoDataUrl } from './party-logo.js?v=20260926-8';
import { AREA_GROUPS, POLICY_AREAS } from '../data/simulation/policy-rules.js?v=20260926-8';
import { validateCareerStep } from '../core/career-rules.js?v=20260926-8';
import { DATA_SOURCES, isSelectableParty } from '../data/schema.js?v=20260926-8';
import { DIFFICULTIES } from '../data/simulation/difficulty-rules.js?v=20260926-8';

const POSITIONS = ['estrema sinistra', 'sinistra', 'centro-sinistra', 'centro', 'centro-destra', 'destra', 'estrema destra'];

const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = (path, size = 17) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const iconPaths = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', back: '<path d="m15 18-6-6 6-6M9 12h10"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>', route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h4a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/>',
  party: '<path d="M4 5h16v14H4zM8 9h8M8 13h5"/>', summary: '<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>',
  pin: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>', gauge: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="m12 16 4-5"/>'
};
// The five steps of a new career: where, path, party, difficulty, who you are (with the summary).
export const WIZARD_STEPS = Object.freeze([
  ['Dove', 'Dove vuoi iniziare?', 'pin'], ['Percorso', 'Scegli il percorso', 'route'], ['Partito', 'Scegli l’appartenenza', 'party'],
  ['Difficoltà', 'Scegli la difficoltà', 'gauge'], ['Chi sei', 'Chi sei e riepilogo', 'person']
]);
const LAST_STEP = WIZARD_STEPS.length;
const ico = (name, size) => icon(iconPaths[name], size);
const val = (draft, field) => esc(draft[field] ?? '');

export function makeCareerDraft(currentDate, parties = []) {
  return {
    step: 1, errors: [], firstName: '', lastName: '', birthDate: '', gender: 'preferisco-non-specificare', previousProfession: '',
    region: '', territorialUnit: '', municipality: '', municipalityCode: '', municipalityQuery: '', municipalityLimit: 40,
    initialLevel: 'comunale', parliamentStartMode: 'real-context', parliamentaryGroupId: '', groupQuery: '',
    partyMode: 'independent', partyId: parties.find(isSelectableParty)?.id ?? '',
    partyName: '', partyAbbreviation: '', partyDescription: '', partyColor: '#264d82', partyColor2: '#f2c14e', partyOrientation: 'Centrismo civico',
    partyProgram: [], partyLogoMode: 'builder', partyLogoShape: 'cerchio', partyLogoSymbol: 'freccia', partyLogoUrl: '',
    partyPosition: 'centro', difficulty: 'normale',
    policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 }, currentDate
  };
}

// territory: { units, municipalities, source } — the ISTAT list (territorial-units.json, municipalities.json), or
// { status: 'loading' | 'error', error } while it is missing. data: { loading, failed } — the other real data.
export function renderCareerWizard(state, draft, realParties = [], logoFor = () => null, parliamentaryGroups = [], partyLeaderships = [], politicalFigures = [], realPoliticians = [], territory = null, data = null) {
  const steps = WIZARD_STEPS;
  const level = CAREER_LEVELS[draft.initialLevel];
  const parties = [...state.dataset.parties.filter(isSelectableParty), ...realParties.filter(isSelectableParty)];
  const activeStep = steps[draft.step - 1];
  const place = chosenPlace(draft, territory);
  const body = draft.step === 1 ? whereStep(draft, territory) : draft.step === 2 ? placeLine(draft, place) + levelStep(draft, parliamentaryGroups, realPoliticians) : draft.step === 3 ? partyStep(draft, parties, logoFor, parliamentaryGroups, partyLeaderships, politicalFigures) : draft.step === 4 ? difficultyStep(draft) : profileStep(state, draft) + summaryStep(draft, parties, level, parliamentaryGroups, place);
  const backButton = draft.step > 1
    ? `<button type="button" class="secondary-button wizard-back" data-wizard-action="back">${ico('back', 16)} Indietro</button>`
    : `<button type="button" class="wizard-cancel" data-wizard-action="cancel">Annulla</button>`;
  const actionButton = draft.step === LAST_STEP
    ? `<button type="button" class="primary-button" data-wizard-action="finish">Inizia carriera ${ico('arrow', 16)}</button>`
    : `<button type="button" class="primary-button" data-wizard-action="next">Continua ${ico('arrow', 16)}</button>`;
  const errorBox = draft.errors?.length ? `<div class="wizard-errors" role="alert">${draft.errors.map(error => `<span>${esc(error)}</span>`).join('')}</div>` : '';
  // Real data that did not arrive (parties, groups, people): the wizard goes on with the rest and offers a new attempt.
  const dataBox = data?.failed?.length ? `<div class="wizard-data-alert" role="alert"><span>Non è stato possibile caricare: ${esc(data.failed.join(', '))}. Le scelte che ne dipendono restano vuote finché i dati non arrivano.</span><button type="button" class="secondary-button" data-wizard-retry-data>Riprova</button></div>` : '';
  return `<div class="wizard-backdrop"><section class="career-wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
    <aside class="wizard-aside"><div class="wizard-brand"><span class="brand-mark"><i></i><i></i><i></i></span><span>POLITICANDO <small>2026</small></span></div><span class="wizard-aside-label">NUOVA CARRIERA</span><h2>Una storia<br/>da scrivere.</h2><p>Scegli da dove cominciare, poi il percorso, il partito e la difficoltà.</p><div class="wizard-steps">${steps.map((s, i) => `<div class="wizard-step ${draft.step === i + 1 ? 'current' : ''} ${draft.step > i + 1 ? 'complete' : ''}"><span class="wizard-step-icon">${draft.step > i + 1 ? '✓' : ico(s[2], 16)}</span><span><small>PASSAGGIO ${String(i + 1).padStart(2, '0')}</small><strong>${s[0]}</strong></span></div>`).join('')}</div><div class="wizard-aside-foot"><span class="live-dot"></span><span>Il salvataggio avviene solo quando inizi la carriera.</span></div></aside>
    <div class="wizard-main"><header class="wizard-header"><div><span class="wizard-kicker">PASSAGGIO ${String(draft.step).padStart(2, '0')} <i>/</i> ${String(LAST_STEP).padStart(2, '0')}</span><h1 id="wizard-title">${activeStep[1]}</h1><p>${stepIntro(draft.step)}</p></div><button class="wizard-x" type="button" aria-label="Annulla nuova carriera" data-wizard-action="cancel">×</button></header>
      <div class="wizard-body">${errorBox}${dataBox}${body}</div>
      <footer class="wizard-footer">${backButton}<span class="wizard-footer-note">${draft.step < LAST_STEP ? 'Puoi tornare indietro e modificare ogni scelta.' : `Avvio della carriera il ${esc(state.clock.currentDate)}.`}</span>${actionButton}</footer>
    </div>
  </section></div>`;
}

function stepIntro(step) {
  return [
    'Regioni, province e comuni vengono dall’elenco ufficiale ISTAT aggiornato al 21 febbraio 2026. Il comune che scegli diventa il territorio iniziale della simulazione.',
    'Scegli il livello della carriera. Camera, Senato e gruppi reali sono riferimenti verificati; il tuo ingresso resta simulato.',
    'Puoi entrare in un partito reale verificato oppure fondarne uno tuo. Partito e gruppo non sono la stessa cosa.',
    'La difficoltà cambia risorse, eventi, alleati, candidature e Parlamento: si sceglie ora e resta per tutta la carriera.',
    'Crea il tuo politico e controlla le scelte: potrai correggere ogni passaggio prima di confermare.'
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
function placeLine(d, place) {
  return place ? `<div class="wizard-place-line">${ico('pin', 15)}<span>Territorio iniziale: <strong>Comune di ${esc(place.municipality.name)}</strong> · ${esc(unitLabel(place.unit))} · ${esc(place.region)}</span><button type="button" data-wizard-goto="1">Cambia</button></div>` : '';
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
  const options = matches.slice(0, limit).map(item => `<button type="button" class="municipality-option ${d.municipalityCode === item.code ? 'selected' : ''}" data-municipality-code="${esc(item.code)}" aria-pressed="${d.municipalityCode === item.code}"><strong>${esc(item.name)}${item.alt ? ` <em>/ ${esc(item.alt)}</em>` : ''}</strong><small>${esc(unitLabel(unitByCode.get(item.unit) ?? { name: '' }))}${item.capital ? ' · capoluogo' : ''}</small></button>`).join('');
  const place = chosenPlace(d, territory);
  const chosen = place ? `<div class="wizard-place-selected"><span class="source-pill">DATO REALE · ISTAT</span><strong>Comune di ${esc(place.municipality.name)}${place.municipality.alt ? ` / ${esc(place.municipality.alt)}` : ''}</strong><small>${esc(place.unit.type)} di ${esc(unitLabel(place.unit))} · ${esc(place.region)} · codice ISTAT ${esc(place.municipality.code)}</small><small>Sarà il territorio iniziale della tua carriera.</small></div>` : '<div class="wizard-place-selected is-empty">Nessun comune scelto: cercalo nell’elenco.</div>';
  return `<div class="wizard-form-grid">${regionSelect}${unitSelect}<label class="wizard-full-field">Cerca il comune<input type="search" name="municipalityQuery" data-wizard-municipality-search value="${val(d, 'municipalityQuery')}" placeholder="Nome del comune…" autocomplete="off" /></label></div>
    ${chosen}
    <div class="wizard-party-count">${matches.length ? `Mostrati ${Math.min(limit, matches.length).toLocaleString('it-IT')} di ${matches.length.toLocaleString('it-IT')} comuni` : 'Nessun comune corrisponde alla ricerca.'}</div>
    <div class="municipality-list">${options}</div>${matches.length > limit ? '<button type="button" class="wizard-show-more" data-wizard-show-municipalities>Mostra altri comuni</button>' : ''}${note}`;
}
function difficultyStep(d) {
  const setting = DIFFICULTIES[d.difficulty] ?? DIFFICULTIES.normale;
  return '<section class="summary-section difficulty-section"><div class="summary-section-heading"><div><span>DIFFICOLTÀ</span><strong>' + esc(setting.label) + '</strong></div></div><div class="difficulty-grid" role="radiogroup" aria-label="Difficoltà della partita">' + Object.entries(DIFFICULTIES).map(([id, item]) => '<label class="difficulty-card ' + ((d.difficulty ?? 'normale') === id ? 'selected' : '') + '"><input type="radio" name="difficulty" value="' + id + '" ' + ((d.difficulty ?? 'normale') === id ? 'checked' : '') + ' /><strong>' + esc(item.label) + '</strong><em>' + esc(item.short) + '</em><small>' + esc(item.detail) + '</small></label>').join('') + '</div><small>Si sceglie all’inizio e resta per tutta la carriera.</small></section>';
}
function profileStep(state, d) {
  return `<section class="summary-section wizard-profile"><div class="summary-section-heading"><div><span>CHI SEI</span><strong>Il tuo politico</strong></div></div><div class="wizard-form-grid">
    <label>Nome<input name="firstName" value="${val(d, 'firstName')}" autocomplete="given-name" maxlength="40" placeholder="Il tuo nome" /></label>
    <label>Cognome<input name="lastName" value="${val(d, 'lastName')}" autocomplete="family-name" maxlength="50" placeholder="Il tuo cognome" /></label>
    <label>Data di nascita<input type="date" name="birthDate" value="${val(d, 'birthDate')}" max="${esc(state.clock.currentDate)}" /></label>
    <label>Genere<select name="gender"><option value="preferisco-non-specificare" ${d.gender === 'preferisco-non-specificare' ? 'selected' : ''}>Preferisco non specificare</option><option value="donna" ${d.gender === 'donna' ? 'selected' : ''}>Donna</option><option value="uomo" ${d.gender === 'uomo' ? 'selected' : ''}>Uomo</option><option value="non-binario" ${d.gender === 'non-binario' ? 'selected' : ''}>Non binario</option></select></label>
    <label class="wizard-full-field">Professione precedente<input name="previousProfession" value="${val(d, 'previousProfession')}" autocomplete="organization-title" maxlength="100" placeholder="Es. insegnante, avvocata, imprenditore" /></label>
  </div><small>I dati anagrafici sono usati solo per questa carriera (source: user).</small></section>`;
}
function levelStep(d, parliamentaryGroups, realPoliticians) {
  const details = {
    comunale: ['Territorio locale', 'Parti dal tuo comune e costruisci relazioni nella comunità.'],
    regionale: ['Scala regionale', 'Costruisci una carriera con una prospettiva regionale.'],
    deputato: ['Camera dei deputati', 'Inizia una carriera parlamentare alla Camera.'],
    senatore: ['Senato della Repubblica', 'Inizia una carriera parlamentare al Senato.']
  };
  const levels = Object.entries(CAREER_LEVELS);
  const cards = levels.map(([key, config], i) => '<button type="button" class="level-card ' + (d.initialLevel === key ? 'selected' : '') + '" data-level="' + esc(key) + '" aria-pressed="' + (d.initialLevel === key) + '"><span class="level-card-top"><span class="level-index">0' + (i + 1) + '</span><span class="radio-ring"></span></span><strong>' + (key === 'deputato' ? 'DEPUTATO' : key === 'senatore' ? 'SENATORE' : key === 'comunale' ? 'COMUNALE' : 'REGIONALE') + '</strong><p>' + esc(details[key][1]) + '</p><span class="level-scope">' + esc(details[key][0]) + '</span></button>').join('');
  const chamber = CAREER_LEVELS[d.initialLevel]?.chamber;
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
    context = '<section class="wizard-parliament-context"><div class="wizard-parliament-title"><div><span class="section-kicker">CONTESTO AVANZATO · ' + (chamber === 'camera' ? 'CAMERA' : 'SENATO') + '</span><strong>Parti da un contesto parlamentare reale</strong></div><span class="source-pill">Dati reali verificati</span></div><p>La Camera, il Senato e i gruppi provengono dal database reale. L’ingresso del tuo personaggio, il posto nello scenario e le variabili di gioco sono simulati.</p><label class="wizard-group-search">Cerca un gruppo<input type="search" name="groupQuery" data-wizard-group-search value="' + val(d, 'groupQuery') + '" placeholder="Nome del gruppo…" autocomplete="off" /></label><div class="wizard-group-list">' + (groupRows || '<div class="empty-inline">' + (compatible.length ? 'Nessun gruppo corrisponde alla ricerca.' : 'Caricamento dei gruppi reali in corso…') + '</div>') + '</div>' + (selected ? '<div class="wizard-group-selected">Riferimento scelto: <strong>' + esc(selected.officialName) + '</strong> · ' + esc(selected.sourceName || 'Fonte istituzionale') + '</div>' : '<div class="wizard-group-selected">Seleziona un gruppo per configurare lo scenario parlamentare.</div>') + '<div class="wizard-data-note">Partito e gruppo parlamentare restano separati. Il database non documenta una relazione diretta con questo personaggio creato da te: la scelta del gruppo è esplicita e simulata.</div></section>';
  }
  return '<div class="level-cards">' + cards + '</div>' + context + '<div class="wizard-data-note">La carriera parlamentare è uno scenario di gioco: non aggiunge il tuo personaggio agli elenchi dei parlamentari reali e non modifica le consistenze ufficiali.</div>';
}
function partyStep(d, parties, logoFor, parliamentaryGroups, partyLeaderships, politicalFigures) {
  const modes = [
    ['independent', 'Indipendente', 'Comincia senza affiliazione.'],
    ['existing', 'Entra in un partito', 'Consulta le schede documentate e scegli un riferimento reale o simulato.'],
    ['new', 'Crea un partito', 'Definisci una nuova organizzazione.']
  ];
  let detail = '';
  if (d.partyMode === 'existing') {
    const query = String(d.partyQuery ?? '').trim().toLocaleLowerCase('it-IT');
    const available = parties.filter(party => {
      const sourceAllowed = !d.partyFilter || d.partyFilter === 'all' || party.source === d.partyFilter;
      const searchText = [party.officialName, party.name, party.abbreviation].filter(Boolean).join(' ').toLocaleLowerCase('it-IT');
      return sourceAllowed && (!query || searchText.includes(query));
    }).sort((a, b) => (a.officialName ?? a.name).localeCompare(b.officialName ?? b.name, 'it'));
    const limit = Math.max(12, Number(d.partyListLimit) || 12);
    const shown = available.slice(0, limit);
    const cards = shown.map(party => {
      const name = party.officialName ?? party.name;
      const logo = logoFor(party) ?? party.logoAsset ?? party.logoUrl;
      const color = /^#[\da-f]{6}$/i.test(party.color ?? '') ? party.color : null;
      const mark = logo ? '<img class="wizard-party-logo" src="' + esc(logo) + '" alt="' + esc(party.logoAlt ?? ('Logo di ' + name)) + '" loading="lazy" />' : '<span class="wizard-party-placeholder" aria-hidden="true">' + esc((party.abbreviation || name.slice(0, 2)).slice(0, 3)) + '</span>';
      const sourceName = party.source === DATA_SOURCES.REAL ? 'DATO REALE VERIFICATO' : party.source === DATA_SOURCES.USER ? 'CREATO DA TE' : 'SIMULAZIONE';
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
    detail = '<div class="wizard-party-controls"><label>Cerca partito<input type="search" name="partyQuery" data-wizard-party-search value="' + val(d, 'partyQuery') + '" placeholder="Nome o sigla…" autocomplete="off" /></label><label>Origine<select name="partyFilter" data-wizard-party-filter><option value="all" ' + (!d.partyFilter || d.partyFilter === 'all' ? 'selected' : '') + '>Tutte le origini</option><option value="real" ' + (d.partyFilter === 'real' ? 'selected' : '') + '>Dati reali verificati</option><option value="user" ' + (d.partyFilter === 'user' ? 'selected' : '') + '>Creati da te</option></select></label></div><div class="wizard-party-count">' + (available.length ? 'Mostrati ' + shown.length + ' di ' + available.length : 'Nessun partito corrisponde alla ricerca.') + '</div><div class="demo-party-list">' + (cards || '<div class="empty-inline">Prova un altro nome o cambia il filtro.</div>') + '</div>' + (shown.length < available.length ? '<button type="button" class="wizard-show-more" data-wizard-show-parties>Mostra altri partiti</button>' : '') + '<div class="wizard-data-note">Mostriamo solo informazioni presenti nel dataset. Le appartenenze a gruppi non vengono dedotte dal nome del partito; il riferimento al gruppo resta una scelta separata dello scenario.</div>';
  }
  if (d.partyMode === 'new') detail = '<div class="new-party-form"><div class="wizard-form-grid"><label>Nome del partito<input name="partyName" value="' + val(d, 'partyName') + '" maxlength="60" placeholder="Il nome del tuo partito" /></label><label>Abbreviazione<input name="partyAbbreviation" value="' + val(d, 'partyAbbreviation') + '" maxlength="8" placeholder="Sigla" /></label><label class="wizard-full-field">Descrizione<textarea name="partyDescription" maxlength="240" rows="2" placeholder="Qual è la ragione d’essere del partito?">' + val(d, 'partyDescription') + '</textarea></label><label>Orientamento generale<select name="partyOrientation">' + ['Centrismo civico', 'Progressista', 'Conservatore', 'Liberale', 'Socialdemocratico', 'Ecologista', 'Popolare', 'Autonomista', 'Altro'].map(option => '<option ' + (d.partyOrientation === option ? 'selected' : '') + '>' + esc(option) + '</option>').join('') + '</select></label><label>Collocazione<select name="partyPosition">' + POSITIONS.map(option => '<option value="' + option + '" ' + ((d.partyPosition ?? 'centro') === option ? 'selected' : '') + '>' + esc(option.charAt(0).toUpperCase() + option.slice(1)) + '</option>').join('') + '</select></label><label class="color-field">Colore principale<span class="color-input-wrap"><input type="color" name="partyColor" value="' + val(d, 'partyColor') + '" /><span>' + esc(d.partyColor || '#264d82') + '</span></span></label><label class="color-field">Secondo colore<span class="color-input-wrap"><input type="color" name="partyColor2" value="' + val(d, 'partyColor2') + '" /><span>' + esc(d.partyColor2 || '#f2c14e') + '</span></span></label></div>' + logoBuilder(d) + '<div class="policy-heading"><strong>Programma: fino a quattro priorità</strong><small>Le aree interne del partito le confrontano con i loro temi; da segretario potrai cambiarle.</small></div><div class="wizard-program">' + Object.entries(AREA_GROUPS).map(([group, label]) => '<fieldset><legend>' + esc(label) + '</legend>' + POLICY_AREAS.filter(item => item.group === group).map(item => '<label class="agenda-option"><input type="checkbox" name="partyProgram" value="' + esc(item.id) + '" ' + ((d.partyProgram ?? []).includes(item.id) ? 'checked' : '') + ' /><span>' + esc(item.label) + '</span></label>').join('') + '</fieldset>').join('') + '</div><div class="policy-heading"><strong>Posizione sulle grandi aree</strong><small>1 = più prudente · 5 = più orientata al cambiamento</small></div><div class="policy-grid">' + [['economia', 'Economia'], ['welfare', 'Welfare e servizi'], ['ambiente', 'Ambiente'], ['europa', 'Integrazione europea']].map(([key, label]) => '<label class="policy-slider"><span>' + label + '</span><input type="range" name="policy_' + key + '" min="1" max="5" step="1" value="' + Number(d.policyPositions?.[key] ?? 3) + '" /><output>' + Number(d.policyPositions?.[key] ?? 3) + '</output></label>').join('') + '</div><div class="wizard-data-note">Il partito creato da te sarà marcato come dato utente e non sarà presentato come organizzazione reale.</div></div>';
  const group = parliamentaryGroups.find(item => item.id === d.parliamentaryGroupId);
  const parliamentaryNote = CAREER_LEVELS[d.initialLevel]?.chamber ? '<div class="wizard-data-note wizard-context-note"><strong>Contesto parlamentare scelto:</strong> ' + esc(group?.officialName || 'gruppo non selezionato') + '. Partito e gruppo rimangono dati separati.</div>' : '';
  return '<div class="party-mode-grid">' + modes.map(([key, title, description]) => '<button type="button" class="party-mode ' + (d.partyMode === key ? 'selected' : '') + '" data-party-mode="' + key + '" aria-pressed="' + (d.partyMode === key) + '"><span class="radio-ring"></span><strong>' + title + '</strong><small>' + description + '</small></button>').join('') + '</div>' + detail + parliamentaryNote;
}
// The logo of the new party: built from shape, symbol and colours, linked from an address, or uploaded.
export function wizardLogoPreview(d) {
  if (d.partyLogoMode === 'url') return /^https?:\/\//i.test(d.partyLogoUrl || '') ? d.partyLogoUrl : null;
  if (d.partyLogoMode === 'upload') return d.partyLogoPreview ?? null;
  return partyLogoDataUrl({ shape: d.partyLogoShape, symbol: d.partyLogoSymbol, primary: d.partyColor, secondary: d.partyColor2, text: d.partyAbbreviation });
}
function logoBuilder(d) {
  const mode = d.partyLogoMode ?? 'builder';
  const preview = wizardLogoPreview(d);
  const modes = [['builder', 'Crea con forme e simboli'], ['url', 'Da un indirizzo'], ['upload', 'Carica un file']].map(([id, label]) => '<label class="' + (mode === id ? 'active' : '') + '"><input type="radio" name="partyLogoMode" value="' + id + '" ' + (mode === id ? 'checked' : '') + ' />' + label + '</label>').join('');
  const builder = mode === 'builder' ? '<label>Forma<select name="partyLogoShape">' + Object.entries(LOGO_SHAPES).map(([id, item]) => '<option value="' + id + '" ' + (d.partyLogoShape === id ? 'selected' : '') + '>' + esc(item.label) + '</option>').join('') + '</select></label><label>Simbolo<select name="partyLogoSymbol">' + Object.entries(LOGO_SYMBOLS).map(([id, item]) => '<option value="' + id + '" ' + (d.partyLogoSymbol === id ? 'selected' : '') + '>' + esc(item.label) + '</option>').join('') + '</select></label>' : '';
  const url = mode === 'url' ? '<label class="wizard-full-field">Indirizzo dell’immagine<input type="url" name="partyLogoUrl" value="' + val(d, 'partyLogoUrl') + '" placeholder="https://…/logo.png" /></label>' : '';
  // After choosing the file the editor opens in its slot: crop, ratio, zoom, transparency, dominant colour.
  const upload = mode === 'upload' ? '<label class="wizard-full-field logo-admin-upload">File SVG, PNG, JPEG o WebP (resta in questo browser)<input type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" data-wizard-logo-upload /></label>' + (d.partyLogoError ? '<small class="menu-error">' + esc(d.partyLogoError) + '</small>' : '') + '<div class="wizard-full-field" data-logo-editor-slot></div>' : '';
  return '<div class="wizard-logo"><div class="wizard-logo-preview" data-wizard-logo-preview>' + (preview ? '<img src="' + esc(preview) + '" alt="Anteprima del logo" />' : '<span>Logo</span>') + '</div><div class="wizard-logo-controls"><div class="segmented" role="group" aria-label="Tipo di logo">' + modes + '</div><div class="wizard-form-grid">' + builder + url + upload + '</div><small>I simboli disponibili sono segni grafici generici, diversi dagli emblemi dei partiti esistenti. Il logo è un dato dell’utente.</small></div></div>';
}
function summaryStep(d, parties, level, parliamentaryGroups, place = null) {
  const party = d.partyMode === 'existing' ? parties.find(p => p.id === d.partyId) : null;
  const parliamentaryGroup = parliamentaryGroups.find(group => group.id === d.parliamentaryGroupId);
  const partySummary = d.partyMode === 'independent' ? 'Indipendente' : d.partyMode === 'existing' ? (party?.officialName ?? party?.name ?? 'Partito non selezionato') + (party?.abbreviation ? ' · ' + party.abbreviation : '') + ' · ' + (party?.source === DATA_SOURCES.REAL ? 'Dato reale verificato' : party?.source === DATA_SOURCES.USER ? 'Creato da te' : 'Simulazione') : (d.partyName || 'Nuovo partito') + ' (' + (d.partyAbbreviation || '—').toUpperCase() + ') · Creato da te' + ((d.partyProgram ?? []).length ? ' · programma: ' + d.partyProgram.map(id => POLICY_AREAS.find(item => item.id === id)?.label ?? id).join(', ') : '');
  const setting = DIFFICULTIES[d.difficulty] ?? DIFFICULTIES.normale;
  const stats = Object.fromEntries(Object.entries(initialCareerStatistics(d.initialLevel)).map(([metric, value]) => [metric, ['popularity', 'reputation', 'influence'].includes(metric) ? Math.max(0, Math.min(100, value + setting.statStart)) : value]));
  const chamber = CAREER_LEVELS[d.initialLevel]?.chamber;
  // Difficulty: chosen once (step 4), it changes resources, events, outcomes, relations, candidacies and Parliament.
  const difficulty = '<section class="summary-section"><div class="summary-section-heading"><div><span>04 · DIFFICOLTÀ</span><strong>' + esc(setting.label) + '</strong></div><button type="button" data-wizard-goto="4">Modifica</button></div><small>' + esc(setting.short) + '</small></section>';
  const territorySummary = d.initialLevel === 'comunale' ? 'Comune di ' + (d.municipality || 'da scegliere') + ' · ' + (d.region || 'Regione') : d.initialLevel === 'regionale' ? (d.region || 'Regione da scegliere') : (chamber === 'camera' ? 'Camera dei deputati' : 'Senato della Repubblica') + ' · ' + (d.region || 'territorio da selezionare');
  const where = '<section class="summary-section"><div class="summary-section-heading"><div><span>01 · DOVE INIZI</span><strong>' + esc(place ? 'Comune di ' + place.municipality.name : d.municipality || 'Comune da scegliere') + '</strong></div><button type="button" data-wizard-goto="1">Modifica</button></div><small>' + esc(place ? place.unit.type + ' di ' + unitLabel(place.unit) + ' · ' + place.region + ' · codice ISTAT ' + place.municipality.code : d.region || 'Regione da scegliere') + '</small></section>';
  const metrics = [['Popolarità', stats.popularity], ['Reputazione', stats.reputation], ['Consenso', stats.consensus], ['Esperienza', stats.experience], ['Influenza', stats.influence], ['Notorietà', stats.notoriety]];
  const parliamentary = chamber ? '<section class="summary-section"><div class="summary-section-heading"><div><span>CONTESTO PARLAMENTARE</span><strong>' + (chamber === 'camera' ? 'Camera dei deputati' : 'Senato della Repubblica') + '</strong></div><button type="button" data-wizard-goto="2">Modifica</button></div><div class="summary-facts"><span>Gruppo: ' + esc(parliamentaryGroup?.officialName || 'Da selezionare') + '</span><span>Territorio di riferimento: ' + esc(d.region || 'Non definito') + '</span></div><small>Posizione iniziale simulata: componente del gruppo; influenza e sostegno interno possono cambiare durante la partita. I dati personali restano creati da te, i riferimenti istituzionali sono reali.</small></section>' : '';
  return '<div class="summary-sheet">' + where + '<section class="summary-section"><div class="summary-section-heading"><div><span>02 · PERCORSO</span><strong>' + esc(level.label) + '</strong></div><button type="button" data-wizard-goto="2">Modifica</button></div><small>Territorio iniziale: ' + esc(territorySummary) + '</small></section>' + parliamentary + '<section class="summary-section"><div class="summary-section-heading"><div><span>03 · APPARTENENZA</span><strong>' + esc(partySummary) + '</strong></div><button type="button" data-wizard-goto="3">Modifica</button></div>' + (party?.source === DATA_SOURCES.REAL && party.sourceUrl ? '<a class="catalog-source" href="' + esc(party.sourceUrl) + '" target="_blank" rel="noopener noreferrer">Fonte del partito ↗</a>' : '') + (d.partyMode === 'new' ? '<small>' + esc(d.partyOrientation) + ' · ' + esc(d.partyPosition ?? 'centro') + ' · Colore <i class="summary-color" style="--party:' + esc(d.partyColor) + '"></i></small>' : '') + '</section><section class="summary-section"><div class="summary-section-heading"><div><span>STATISTICHE INIZIALI</span><strong>Valori di gioco simulati · base bilanciata per percorso</strong></div></div><div class="summary-stat-grid">' + metrics.map(([label, value]) => '<span><small>' + label + '</small><strong>' + value + '<i>/100</i></strong></span>').join('') + '</div><small>Posizione iniziale: ' + (chamber ? 'componente del gruppo nello scenario' : 'carriera territoriale in avvio') + ' · situazione politica non garantita.</small></section>' + difficulty + '<div class="summary-disclaimer">Il giocatore è un personaggio creato da te (source: user). I valori, la posizione e gli eventi di questa carriera sono source: simulation. Le fonti istituzionali restano in sola lettura.</div></div>';
}
