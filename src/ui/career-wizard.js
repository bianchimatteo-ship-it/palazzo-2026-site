import { CAREER_LEVELS, ITALIAN_REGIONS, initialCareerStatistics } from '../data/regions.js';
import { validateCareerStep } from '../core/career-rules.js';
import { DATA_SOURCES, isSelectableParty } from '../data/schema.js';

const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = (path, size = 17) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const iconPaths = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', back: '<path d="m15 18-6-6 6-6M9 12h10"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>', route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h4a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/>',
  party: '<path d="M4 5h16v14H4zM8 9h8M8 13h5"/>', summary: '<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>'
};
const ico = (name, size) => icon(iconPaths[name], size);
const val = (draft, field) => esc(draft[field] ?? '');

export function makeCareerDraft(currentDate, parties = []) {
  return {
    step: 1, errors: [], firstName: '', lastName: '', birthDate: '', gender: 'preferisco-non-specificare', region: '', municipality: '', previousProfession: '',
    initialLevel: 'comunale', partyMode: 'independent', partyId: parties.find(isSelectableParty)?.id ?? '',
    partyName: '', partyAbbreviation: '', partyDescription: '', partyColor: '#264d82', partyOrientation: 'Centrismo civico',
    policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 }, currentDate
  };
}

export function renderCareerWizard(state, draft, realParties = [], logoFor = () => null) {
  const steps = [
    ['Profilo', 'Crea il politico', 'person'], ['Percorso', 'Scegli il livello', 'route'],
    ['Partito', 'Scegli l’appartenenza', 'party'], ['Riepilogo', 'Pronto a iniziare', 'summary']
  ];
  const level = CAREER_LEVELS[draft.initialLevel];
  const parties = [...state.dataset.parties.filter(isSelectableParty), ...realParties.filter(isSelectableParty)];
  const activeStep = steps[draft.step - 1];
  const body = draft.step === 1 ? profileStep(state, draft) : draft.step === 2 ? levelStep(draft) : draft.step === 3 ? partyStep(draft, parties, logoFor) : summaryStep(draft, parties, level);
  const backButton = draft.step > 1
    ? `<button type="button" class="secondary-button wizard-back" data-wizard-action="back">${ico('back', 16)} Indietro</button>`
    : `<button type="button" class="wizard-cancel" data-wizard-action="cancel">Annulla</button>`;
  const actionButton = draft.step === 4
    ? `<button type="button" class="primary-button" data-wizard-action="finish">Inizia carriera ${ico('arrow', 16)}</button>`
    : `<button type="button" class="primary-button" data-wizard-action="next">${draft.step === 3 ? 'Vai al riepilogo' : 'Continua'} ${ico('arrow', 16)}</button>`;
  const errorBox = draft.errors?.length ? `<div class="wizard-errors" role="alert">${draft.errors.map(error => `<span>${esc(error)}</span>`).join('')}</div>` : '';
  return `<div class="wizard-backdrop"><section class="career-wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
    <aside class="wizard-aside"><div class="wizard-brand"><span class="brand-mark"><i></i><i></i><i></i></span><span>POLITICANDO <small>2026</small></span></div><span class="wizard-aside-label">NUOVA CARRIERA</span><h2>Una storia<br/>da scrivere.</h2><p>Definisci la tua identità politica e scegli da dove cominciare.</p><div class="wizard-steps">${steps.map((s, i) => `<div class="wizard-step ${draft.step === i + 1 ? 'current' : ''} ${draft.step > i + 1 ? 'complete' : ''}"><span class="wizard-step-icon">${draft.step > i + 1 ? '✓' : ico(s[2], 16)}</span><span><small>PASSAGGIO ${String(i + 1).padStart(2, '0')}</small><strong>${s[0]}</strong></span></div>`).join('')}</div><div class="wizard-aside-foot"><span class="live-dot"></span><span>Il salvataggio avviene solo quando inizi la carriera.</span></div></aside>
    <div class="wizard-main"><header class="wizard-header"><div><span class="wizard-kicker">PASSAGGIO ${String(draft.step).padStart(2, '0')} <i>/</i> 04</span><h1 id="wizard-title">${activeStep[1]}</h1><p>${stepIntro(draft.step)}</p></div><button class="wizard-x" type="button" aria-label="Annulla nuova carriera" data-wizard-action="cancel">×</button></header>
      <div class="wizard-body">${errorBox}${body}</div>
      <footer class="wizard-footer">${backButton}<span class="wizard-footer-note">${draft.step < 4 ? 'Puoi tornare indietro e modificare ogni scelta.' : `Avvio della carriera il ${esc(state.clock.currentDate)}.`}</span>${actionButton}</footer>
    </div>
  </section></div>`;
}

function stepIntro(step) {
  return ['Le informazioni personali restano parte del tuo salvataggio locale.', 'Il livello è il punto di partenza, non il risultato di un’elezione.', 'Puoi scegliere tra dati reali verificati, partiti demo oppure crearne uno tuo.', 'Controlla le scelte: potrai correggere ogni passaggio prima di confermare.'][step - 1];
}
function profileStep(state, d) {
  return `<div class="wizard-form-grid">
    <label>Nome<input name="firstName" value="${val(d, 'firstName')}" autocomplete="given-name" maxlength="40" placeholder="Il tuo nome" /></label>
    <label>Cognome<input name="lastName" value="${val(d, 'lastName')}" autocomplete="family-name" maxlength="50" placeholder="Il tuo cognome" /></label>
    <label>Data di nascita<input type="date" name="birthDate" value="${val(d, 'birthDate')}" max="${esc(state.clock.currentDate)}" /></label>
    <label>Genere<select name="gender"><option value="preferisco-non-specificare" ${d.gender === 'preferisco-non-specificare' ? 'selected' : ''}>Preferisco non specificare</option><option value="donna" ${d.gender === 'donna' ? 'selected' : ''}>Donna</option><option value="uomo" ${d.gender === 'uomo' ? 'selected' : ''}>Uomo</option><option value="non-binario" ${d.gender === 'non-binario' ? 'selected' : ''}>Non binario</option></select></label>
    <label>Regione<select name="region"><option value="">Seleziona una regione</option>${ITALIAN_REGIONS.map(region => `<option value="${esc(region)}" ${d.region === region ? 'selected' : ''}>${esc(region)}</option>`).join('')}</select></label>
    <label>Comune di residenza<input name="municipality" value="${val(d, 'municipality')}" autocomplete="address-level2" maxlength="80" placeholder="Scrivi il comune" /></label>
    <label class="wizard-full-field">Professione precedente<input name="previousProfession" value="${val(d, 'previousProfession')}" autocomplete="organization-title" maxlength="100" placeholder="Es. insegnante, avvocata, imprenditore" /></label>
  </div><div class="wizard-data-note">I dati anagrafici sono usati solo per questa carriera; il comune viene inserito come territorio scelto da te.</div>`;
}
function levelStep(d) {
  const details = {
    comunale: ['La comunità più vicina', 'Parti dal tuo comune e costruisci relazioni sul territorio.'],
    regionale: ['Il livello della regione', 'Imposta una prospettiva regionale fin dall’avvio.'],
    nazionale: ['L’orizzonte nazionale', 'Inizia con visibilità e responsabilità di scala nazionale.']
  };
  return `<div class="level-cards">${Object.entries(CAREER_LEVELS).map(([key, config], i) => `<button type="button" class="level-card ${d.initialLevel === key ? 'selected' : ''}" data-level="${key}" aria-pressed="${d.initialLevel === key}"><span class="level-card-top"><span class="level-index">0${i + 1}</span><span class="radio-ring"></span></span><strong>${config.label}</strong><p>${details[key][1]}</p><span class="level-scope">${details[key][0]}</span></button>`).join('')}</div><div class="wizard-data-note">La scelta configura il territorio e l’incarico iniziale. Non simula elezioni o vittorie.</div>`;
}
function partyStep(d, parties, logoFor) {
  const modes = [
    ['independent', 'Indipendente', 'Comincia senza affiliazione.'],
    ['existing', 'Entra in un partito', 'Scegli tra dati reali verificati e partiti demo.'],
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
      const mark = logo
        ? `<img class="wizard-party-logo" src="${esc(logo)}" alt="${esc(party.logoAlt ?? `Logo di ${name}`)}" loading="lazy" />`
        : `<span class="wizard-party-placeholder" aria-hidden="true">${party.source === DATA_SOURCES.REAL ? '—' : esc((party.abbreviation || name.slice(0, 2)).slice(0, 3))}</span>`;
      const dataLabel = party.source === DATA_SOURCES.REAL ? 'DATO REALE VERIFICATO' : party.source === DATA_SOURCES.USER ? 'CREATO DA TE' : 'SIMULAZIONE';
      const description = party.factualDescription ?? party.description;
      return `<button type="button" class="demo-party ${d.partyId === party.id ? 'selected' : ''}" data-party-id="${esc(party.id)}" aria-pressed="${d.partyId === party.id}">${mark}<span class="demo-party-copy"><strong>${esc(name)}</strong><small>${esc([party.abbreviation, description].filter(Boolean).join(' · ') || (party.source === DATA_SOURCES.REAL ? 'Descrizione non disponibile nelle fonti caricate.' : party.description || ''))}</small></span><span class="source-pill">${dataLabel}</span></button>`;
    }).join('');
    detail = `<div class="wizard-party-controls"><label>Cerca partito<input type="search" name="partyQuery" data-wizard-party-search value="${val(d, 'partyQuery')}" placeholder="Nome o sigla…" autocomplete="off" /></label><label>Origine<select name="partyFilter" data-wizard-party-filter><option value="all" ${!d.partyFilter || d.partyFilter === 'all' ? 'selected' : ''}>Tutte le origini</option><option value="real" ${d.partyFilter === 'real' ? 'selected' : ''}>Dati reali verificati</option><option value="simulation" ${d.partyFilter === 'simulation' ? 'selected' : ''}>Partiti demo</option><option value="user" ${d.partyFilter === 'user' ? 'selected' : ''}>Creati da te</option></select></label></div><div class="wizard-party-count">${available.length ? `Mostrati ${shown.length} di ${available.length}` : 'Nessun partito corrisponde alla ricerca.'}</div><div class="demo-party-list">${cards || '<div class="empty-inline">Prova un altro nome o cambia il filtro.</div>'}</div>${shown.length < available.length ? '<button type="button" class="wizard-show-more" data-wizard-show-parties>Mostra altri partiti</button>' : ''}<div class="wizard-data-note">I dati reali sono di sola lettura; i partiti demo e quelli creati da te sono contrassegnati separatamente.</div>`;
  }
  if (d.partyMode === 'new') detail = `<div class="new-party-form">
    <div class="wizard-form-grid"><label>Nome del partito<input name="partyName" value="${val(d, 'partyName')}" maxlength="60" placeholder="Es. Comunità in Movimento" /></label><label>Abbreviazione<input name="partyAbbreviation" value="${val(d, 'partyAbbreviation')}" maxlength="8" placeholder="Es. CIM" /></label>
      <label class="wizard-full-field">Descrizione<textarea name="partyDescription" maxlength="240" rows="2" placeholder="Qual è la ragione d’essere del partito?">${val(d, 'partyDescription')}</textarea></label>
      <label>Orientamento generale<select name="partyOrientation">${['Centrismo civico', 'Progressista', 'Conservatore', 'Liberale', 'Socialdemocratico', 'Ecologista', 'Popolare', 'Autonomista', 'Altro'].map(option => `<option ${d.partyOrientation === option ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></label>
      <label class="color-field">Colore principale<span class="color-input-wrap"><input type="color" name="partyColor" value="${val(d, 'partyColor') || '#264d82'}" /><span>${esc(d.partyColor || '#264d82')}</span></span></label>
    </div>
    <div class="policy-heading"><strong>Posizione sulle grandi aree</strong><small>1 = più prudente · 5 = più orientata al cambiamento</small></div>
    <div class="policy-grid">${[['economia', 'Economia'], ['welfare', 'Welfare e servizi'], ['ambiente', 'Ambiente'], ['europa', 'Integrazione europea']].map(([key, label]) => `<label class="policy-slider"><span>${label}</span><input type="range" name="policy_${key}" min="1" max="5" step="1" value="${Number(d.policyPositions?.[key] ?? 3)}" /><output>${Number(d.policyPositions?.[key] ?? 3)}</output></label>`).join('')}</div>
    <div class="wizard-data-note">Il partito creato da te sarà marcato come dato utente e non sarà presentato come organizzazione reale.</div>
  </div>`;
  return `<div class="party-mode-grid">${modes.map(([key, title, description]) => `<button type="button" class="party-mode ${d.partyMode === key ? 'selected' : ''}" data-party-mode="${key}" aria-pressed="${d.partyMode === key}"><span class="radio-ring"></span><strong>${title}</strong><small>${description}</small></button>`).join('')}</div>${detail}`;
}
function summaryStep(d, parties, level) {
  const party = d.partyMode === 'existing' ? parties.find(p => p.id === d.partyId) : null;
  const partySummary = d.partyMode === 'independent' ? 'Indipendente' : d.partyMode === 'existing' ? `${party?.officialName ?? party?.name ?? 'Partito non selezionato'}${party?.abbreviation ? ` · ${party.abbreviation}` : ''} · ${party?.source === DATA_SOURCES.REAL ? 'Dato reale verificato' : party?.source === DATA_SOURCES.USER ? 'Creato da te' : 'Simulazione'}` : `${d.partyName || 'Nuovo partito'} (${(d.partyAbbreviation || '—').toUpperCase()}) · Creato da te`;
  const stats = initialCareerStatistics(d.initialLevel);
  const territorySummary = d.initialLevel === 'comunale' ? `${d.municipality || 'Comune'} · ${d.region || 'Regione'}` : d.initialLevel === 'regionale' ? d.region || 'Regione da scegliere' : 'Italia · livello nazionale';
  const metrics = [['Popolarità', stats.popularity], ['Reputazione', stats.reputation], ['Consenso iniziale', stats.consensus], ['Esperienza', stats.experience], ['Influenza', stats.influence], ['Notorietà', stats.notoriety]];
  return `<div class="summary-sheet">
    <section class="summary-section"><div class="summary-section-heading"><div><span>01 · PROFILO</span><strong>${esc(d.firstName || 'Nome')} ${esc(d.lastName || 'Cognome')}</strong></div><button type="button" data-wizard-goto="1">Modifica</button></div><div class="summary-facts"><span>${esc(d.birthDate || 'Data non impostata')}</span><span>${esc(d.gender || '')}</span><span>${esc(d.previousProfession || 'Professione non impostata')}</span></div><small>Residenza: ${esc(d.municipality || 'Comune')} · ${esc(d.region || 'Regione')}</small></section>
    <section class="summary-section"><div class="summary-section-heading"><div><span>02 · PERCORSO</span><strong>${esc(level.label)}</strong></div><button type="button" data-wizard-goto="2">Modifica</button></div><small>Territorio iniziale: ${esc(territorySummary)}</small></section>
    <section class="summary-section"><div class="summary-section-heading"><div><span>03 · APPARTENENZA</span><strong>${esc(partySummary)}</strong></div><button type="button" data-wizard-goto="3">Modifica</button></div>${d.partyMode === 'new' ? `<small>${esc(d.partyOrientation)} · Colore <i class="summary-color" style="--party:${esc(d.partyColor)}"></i></small>` : ''}</section>
    <section class="summary-section"><div class="summary-section-heading"><div><span>STATISTICHE INIZIALI</span><strong>Valori deterministici per livello</strong></div></div><div class="summary-stat-grid">${metrics.map(([label, value]) => `<span><small>${label}</small><strong>${value}<i>/100</i></strong></span>`).join('')}</div></section>
    <div class="summary-disclaimer">Il livello iniziale imposta una base di esperienza e visibilità. Le statistiche non derivano da sorteggi né da risultati elettorali.</div>
  </div>`;
}
