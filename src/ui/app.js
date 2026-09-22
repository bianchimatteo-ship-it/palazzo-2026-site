import { fullDate, formatDate } from '../core/time.js';
import { DATA_SOURCES, isSelectableParty } from '../data/schema.js';
import { realDatabase } from '../data/repositories/real-data.js?v=20260922-4';
import { makeCareerDraft, renderCareerWizard } from './career-wizard.js';
import { validateCareerStep } from '../core/career-rules.js';

const mainSectionActive = (id, page) => page === id || (id === 'calendario' && page === 'eventi') || (id === 'parlamento' && ['governo', 'leggi'].includes(page)) || (id === 'partito' && page === 'partiti-lista') || (id === 'profilo' && page === 'politici');
const mainNavigation = [
  ['panoramica', 'home', 'Home'], ['carriera', 'route', 'Carriera'], ['partito', 'party', 'Partito'],
  ['elezioni', 'ballot', 'Elezioni'], ['parlamento', 'building', 'Parlamento'],
  ['sondaggi', 'chart', 'Sondaggi'], ['calendario', 'calendar', 'Agenda']
];
const pages = {
  panoramica: { title: 'Home', eyebrow: 'LA TUA PARTITA', intro: 'Una carriera nella politica italiana' },
  profilo: { title: 'Profilo', eyebrow: 'IL TUO POLITICO', intro: 'La persona e i numeri della tua carriera.' },
  carriera: { title: 'Carriera', eyebrow: 'IL TUO PERCORSO', intro: 'Costruisci la tua presenza, un incarico alla volta.' },
  partito: { title: 'Il tuo partito', eyebrow: 'APPARTENENZA', intro: 'Relazioni, linea politica e peso nel partito.' },
  calendario: { title: 'Agenda', eyebrow: 'IL TUO TEMPO', intro: 'Appuntamenti e momenti da tenere d’occhio.' },
  elezioni: { title: 'Elezioni', eyebrow: 'ORIZZONTE ELETTORALE', intro: 'Consulta le scadenze e prepara il prossimo appuntamento.' },
  sondaggi: { title: 'Sondaggi', eyebrow: 'UMORE DEL PAESE', intro: 'Indicatori di consenso pronti per collegarsi ai dati di simulazione.' },
  parlamento: { title: 'Parlamento', eyebrow: 'LE CAMERE', intro: 'Seggi, gruppi e lavori parlamentari.' },
  governo: { title: 'Governo', eyebrow: 'PALAZZO CHIGI', intro: 'Composizione, agenda e approvazione dell’esecutivo.' },
  leggi: { title: 'Leggi', eyebrow: 'ITER LEGISLATIVO', intro: 'Proposte, commissioni e provvedimenti.' },
  eventi: { title: 'Eventi', eyebrow: 'CRONACA POLITICA', intro: 'Gli eventi che scandiscono la vita pubblica.' },
  politici: { title: 'Politici', eyebrow: 'PERSONE', intro: 'Profili e incarichi nel panorama politico.' },
  'partiti-lista': { title: 'Partiti', eyebrow: 'ORGANIZZAZIONI', intro: 'Le forze politiche del mondo di gioco.' },
  impostazioni: { title: 'Impostazioni', eyebrow: 'PREFERENZE', intro: 'Gestisci carriera, dati e salvataggio.' }
};
const icon = (name, size = 20) => {
  const paths = { arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', plus: '<path d="M12 5v14M5 12h14"/>', chevron: '<path d="m9 18 6-6-6-6"/>', save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>', home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/>', route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h4a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/>', party: '<path d="M4 5h16v14H4zM8 9h8M8 13h5"/>', ballot: '<path d="M5 4h14v17H5zM8 8l1.5 1.5L12 7M8 14l1.5 1.5L12 13M14 9h2M14 15h2"/>', building: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 9h.01M15 9h.01M9 12h.01M15 12h.01"/>', chart: '<path d="M4 19V5M4 19h17M8 15l4-4 3 2 5-6"/>', person: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2Z"/>', close: '<path d="m18 6-12 12M6 6l12 12"/>', spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>' };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;
};
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sourceLabel = source => source === DATA_SOURCES.REAL ? 'Dato reale' : source === DATA_SOURCES.USER ? 'Creato da te' : 'Simulazione';

export function mountApp(root, store) {
  let wizard = null;
  let toastTimer;
  const catalog = { partyQuery:'', partyPresence:'all', partyLevel:'all', partyRegion:'all', partyStatus:'all', partyElection:'all', partySort:'name', politicianQuery:'', politicianChamber:'all', politicianParty:'all', politicianGroup:'all', selectedPoliticianId:null };
  const render = (state, lastSaved) => {
    const player = state.dataset.politicians.find(p => p.id === state.career.playerId);
    const party = state.dataset.parties.find(p => p.id === (player ? player.partyId : state.career.partyId));
    const current = pages[state.ui.activePage] ?? pages.panoramica;
    const eventList = [...state.dataset.events].filter(e => e.date >= state.clock.currentDate).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
    root.innerHTML = `
      <div class="app-shell">
        <aside class="sidebar">
          <a class="brand" href="#panoramica" aria-label="Politicando 2026, Home"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="brand-copy"><strong>POLITICANDO</strong><small>2026</small></span></a><div class="brand-subtitle">Una carriera nella<br/>politica italiana</div>
          <nav class="main-nav" aria-label="Navigazione principale">${mainNavigation.map(([id, glyph, label]) => `<button class="nav-item ${mainSectionActive(id, state.ui.activePage) ? 'active' : ''}" data-nav="${id}" aria-current="${mainSectionActive(id, state.ui.activePage) ? 'page' : 'false'}">${icon(glyph, 19)}<span>${label}</span></button>`).join('')}</nav>
          <div class="sidebar-bottom"><button class="nav-item sidebar-account ${state.ui.activePage === 'profilo' || state.ui.activePage === 'politici' ? 'active' : ''}" data-nav="profilo">${icon('person', 19)}<span>Profilo</span></button><button class="nav-item sidebar-account ${state.ui.activePage === 'impostazioni' ? 'active' : ''}" data-nav="impostazioni">${icon('settings', 19)}<span>Impostazioni</span></button><div class="save-status"><span class="save-dot"></span><span>${lastSaved}</span></div></div>
        </aside>
        <main class="main-area">
          <header class="topbar"><div class="topbar-title"><strong>${current.title}</strong><span>${current.intro}</span></div><div class="top-actions"><div class="date-chip">${icon('calendar', 16)}<span>${fullDate(state.clock.currentDate)}</span></div><button class="icon-button" aria-label="Salva carriera" title="Salva carriera" data-action="save">${icon('save', 17)}</button><button class="advance-button" data-action="advance">Avanza settimana ${icon('arrow', 17)}</button></div></header>
          <div class="page-wrap">${wizard ? '' : (state.ui.activePage === 'panoramica' ? dashboard(state, { player, party, eventList }) : subpage(state, current, player, party, eventList, catalog))}</div>
        </main>
        ${wizard ? renderCareerWizard(state, wizard) : ''}
        ${state.ui.toast ? `<div class="toast" role="status">${icon('spark', 17)}${esc(state.ui.toast)}</div>` : ''}
      </div>`;
    if (state.ui.toast) { clearTimeout(toastTimer); toastTimer = setTimeout(() => { const s = store.getState(); if (s.ui.toast) { s.ui.toast = null; render(s, store.getLastSaved()); } }, 2400); }
  };
  const syncWizardDraft = () => {
    if (!wizard) return;
    for (const field of root.querySelectorAll('.career-wizard [name]')) {
      if (field.name.startsWith('policy_')) wizard.policyPositions[field.name.slice(7)] = Number(field.value);
      else wizard[field.name] = field.value;
    }
  };
  const failStep = () => {
    const parties = store.getState().dataset.parties.filter(isSelectableParty);
    wizard.errors = validateCareerStep(wizard, wizard.step, parties);
    return wizard.errors.length > 0;
  };

  root.addEventListener('click', event => {
    const profileOpen = event.target.closest('[data-politician-profile]')?.dataset.politicianProfile;
    if (profileOpen) { catalog.selectedPoliticianId = profileOpen; render(store.getState(), store.getLastSaved()); return; }
    if (event.target.closest('[data-profile-close]')) { catalog.selectedPoliticianId = null; render(store.getState(), store.getLastSaved()); return; }
    const wizardAction = event.target.closest('[data-wizard-action]')?.dataset.wizardAction;
    const goto = Number(event.target.closest('[data-wizard-goto]')?.dataset.wizardGoto || 0);
    if (wizard && (wizardAction || goto)) {
      syncWizardDraft();
      wizard.errors = [];
      if (wizardAction === 'cancel') wizard = null;
      else if (wizardAction === 'back') wizard.step = Math.max(1, wizard.step - 1);
      else if (wizardAction === 'next') { if (!failStep()) wizard.step = Math.min(4, wizard.step + 1); }
      else if (goto >= 1 && goto <= 3) wizard.step = goto;
      else if (wizardAction === 'finish') {
        const errors = [1, 2, 3].flatMap(step => validateCareerStep(wizard, step, store.getState().dataset.parties.filter(isSelectableParty)));
        if (errors.length) { wizard.errors = errors; wizard.step = errors[0].includes('livello') ? 2 : errors.some(e => e.includes('partito') || e.includes('abbreviazione') || e.includes('descrizione') || e.includes('orientamento')) ? 3 : 1; }
        else { try { store.createCareer(wizard); wizard = null; } catch (error) { wizard.errors = [error.message || 'Impossibile creare la carriera.']; } }
      }
      render(store.getState(), store.getLastSaved());
      return;
    }
    if (wizard) {
      const level = event.target.closest('[data-level]')?.dataset.level;
      const mode = event.target.closest('[data-party-mode]')?.dataset.partyMode;
      const partyId = event.target.closest('[data-party-id]')?.dataset.partyId;
      if (level) { wizard.initialLevel = level; wizard.errors = []; render(store.getState(), store.getLastSaved()); }
      else if (mode) { wizard.partyMode = mode; wizard.errors = []; render(store.getState(), store.getLastSaved()); }
      else if (partyId) { wizard.partyId = partyId; wizard.errors = []; render(store.getState(), store.getLastSaved()); }
      return;
    }
    const nav = event.target.closest('[data-nav]');
    if (nav) { store.navigate(nav.dataset.nav); return; }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'advance') store.advance(7);
    else if (action === 'save') store.save();
    else if (action === 'new-career') {
      wizard = makeCareerDraft(store.getState().clock.currentDate, store.getState().dataset.parties);
      render(store.getState(), store.getLastSaved());
    }
    else if (action === 'reset') store.reset();
  });
  const updateCatalog = () => {
    const body = root.querySelector('[data-catalog-body]');
    if (!body) return;
    const active = document.activeElement?.matches('[data-catalog-filter]') ? document.activeElement : null;
    const key = active?.dataset.catalogFilter;
    const start = active?.selectionStart;
    const end = active?.selectionEnd;
    body.innerHTML = stateCatalogContent(store.getState(), catalog);
    if (key) {
      const next = body.querySelector(`[data-catalog-filter="${key}"]`);
      next?.focus();
      if (typeof start === 'number' && next?.setSelectionRange) next.setSelectionRange(start, end);
    }
  };
  root.addEventListener('input', event => {
    const field = event.target;
    if (field.matches('[data-catalog-filter]')) { catalog[field.dataset.catalogFilter] = field.value; updateCatalog(); return; }
    if (!wizard || !field.matches('.career-wizard [name]')) return;
    if (field.name.startsWith('policy_')) wizard.policyPositions[field.name.slice(7)] = Number(field.value);
    else wizard[field.name] = field.value;
    const output = field.closest('.policy-slider')?.querySelector('output');
    if (output) output.textContent = field.value;
    if (field.name === 'partyColor') { const caption = field.parentElement?.querySelector('span'); if (caption) caption.textContent = field.value; }
  });
  root.addEventListener('change', event => {
    const field = event.target;
    if (field.matches('[data-catalog-filter]')) { catalog[field.dataset.catalogFilter] = field.value; updateCatalog(); }
  });
  store.subscribe(render);
  render(store.getState(), store.getLastSaved());
}

function dashboard(state, { player, party, eventList }) {
  const playerStats = state.dataset.statistics.filter(item => item.subjectId === player?.id);
  const consensus = playerStats.find(item => item.metric === 'consensus') ?? state.dataset.statistics.find(item => item.metric === 'consensus' && item.subjectId === party?.id);
  const popularity = playerStats.find(item => item.metric === 'popularity');
  const reputation = playerStats.find(item => item.metric === 'reputation');
  const office = state.dataset.offices.find(item => item.id === player?.roleId);
  const territory = state.dataset.territories.find(item => item.id === player?.territoryId);
  const event = eventList[0];
  const levels = { comunale: 'Politica comunale', regionale: 'Politica regionale', nazionale: 'Politica nazionale' };
  const nextSteps = {
    comunale: 'Fatti conoscere nella tua comunità',
    regionale: 'Costruisci una presenza in tutta la regione',
    nazionale: 'Dai forma a una voce riconoscibile nel Paese'
  };
  const statNumber = record => record ? `${String(record.value).replace('.', ',')}${record.unit === '%' ? '%' : ''}` : '—';
  const territoryName = territory?.name ?? player?.region ?? 'Italia';
  const appointment = event
    ? `<div class="today-event"><time datetime="${esc(event.date)}"><strong>${formatDate(event.date, { day: '2-digit' })}</strong><span>${formatDate(event.date, { month: 'short' })}</span></time><div><strong>${esc(event.title)}</strong><span>${esc(event.category)} · ${esc(event.status)}</span></div></div>`
    : '<p class="quiet-copy">Nessun appuntamento in agenda per oggi. Puoi avanzare la settimana per continuare la simulazione.</p>';
  return `<section class="home-hero">
      <div class="hero-profile"><span class="section-kicker">PROFILO DEL POLITICO</span><div class="hero-avatar">${player ? esc(player.firstName[0] + player.lastName[0]) : 'P'}</div><div class="hero-identity"><h1>${player ? esc(player.displayName) : 'Comincia la tua storia'}</h1><p>${office ? esc(office.title) : 'Una carriera tutta da costruire'} <span>·</span> ${esc(territoryName)}</p><span class="hero-party">${party ? esc(party.name) : 'Politico indipendente'}</span></div><button class="hero-edit" data-nav="profilo" aria-label="Apri il profilo">${icon('chevron', 20)}</button></div>
      <div class="hero-consensus"><span>CONSENSO</span><strong>${statNumber(consensus)}</strong><small>${consensus?.subjectId === party?.id && party ? `Nel partito · ${esc(party.abbreviation)}` : 'Situazione attuale'}</small></div>
    </section>
    <section class="profile-stat-strip" aria-label="Statistiche principali"><div class="stat-strip-title">Il tuo profilo</div><div class="stat-strip-item"><span>Popolarità</span><strong>${statNumber(popularity)}<small>${popularity?.unit === '%' ? '' : '/ 100'}</small></strong></div><div class="stat-strip-item"><span>Reputazione</span><strong>${statNumber(reputation)}<small>${reputation?.unit === '%' ? '' : '/ 100'}</small></strong></div><button class="text-link" data-nav="profilo">Tutte le statistiche ${icon('arrow', 16)}</button></section>
    <section class="home-sections">
      <article class="home-section today-section"><div class="home-section-heading"><div><span class="section-kicker">COSA FARE OGGI</span><h2>La tua giornata</h2></div><button class="text-link" data-nav="calendario">Apri agenda ${icon('arrow', 16)}</button></div>${appointment}<button class="section-action" data-action="advance">Avanza di una settimana ${icon('arrow', 17)}</button></article>
      <article class="home-section career-section"><div class="home-section-heading"><div><span class="section-kicker">LA TUA CARRIERA</span><h2>${levels[state.career.initialLevel] ?? 'Il tuo percorso'}</h2></div><button class="text-link" data-nav="carriera">Apri carriera ${icon('arrow', 16)}</button></div><p class="career-goal-label">PROSSIMO OBIETTIVO</p><strong class="career-goal">${nextSteps[state.career.initialLevel] ?? 'Scegli il prossimo traguardo'}</strong><div class="career-location">${office ? esc(office.institution) : 'Punto di partenza'} <span>·</span> ${esc(territoryName)}</div></article>
      <article class="home-section politics-section"><div class="home-section-heading"><div><span class="section-kicker">SITUAZIONE POLITICA</span><h2>La tua area</h2></div></div><div class="politics-party"><span class="politics-swatch" style="--party-color:${esc(party?.color ?? '#b7a77f')}"></span><div><strong>${party ? esc(party.name) : 'Indipendente'}</strong><span>${party ? esc(party.orientation || 'Partito di simulazione') : 'Senza affiliazione'}</span></div></div><p class="politics-note">${party ? esc(party.description || 'La tua appartenenza politica.') : 'Il tuo percorso è indipendente.'}</p><button class="text-link" data-nav="partito">Apri il partito ${icon('arrow', 16)}</button></article>
    </section>
    <footer class="home-footer"><span>POLITICANDO 2026</span><span>Dati dimostrativi generati per questa carriera.</span></footer>`;
}

function subpage(state, page, player, party, events, catalog) {
  const personalStats = state.dataset.statistics.filter(item => item.subjectId === player?.id);
  const profileMetrics = [['popularity', 'Popolarità'], ['reputation', 'Reputazione'], ['consensus', 'Consenso'], ['experience', 'Esperienza'], ['influence', 'Influenza'], ['notoriety', 'Notorietà']].map(([metric, label]) => { const record = personalStats.find(item => item.metric === metric) ?? (metric === 'consensus' ? state.dataset.statistics.find(item => item.metric === metric && item.subjectId === party?.id) : null); return `<div><span>${label}</span><strong>${record ? `${String(record.value).replace('.', ',')}${record.unit === '%' ? '%' : ''}${record.unit === '%' ? '' : '<small> / 100</small>'}` : '—'}</strong></div>`; }).join('');
  const listContents = {
    calendario: `<div class="agenda-list">${events.map(e => `<div class="agenda-row"><div class="agenda-date"><strong>${formatDate(e.date, { day: '2-digit' })}</strong><span>${formatDate(e.date, { month: 'short' })}</span></div><div class="agenda-row-text"><span class="event-tag">${esc(e.category)}</span><strong>${esc(e.title)}</strong><small>${esc(e.status)}</small></div><span class="source-pill">${sourceLabel(e.source)}</span></div>`).join('') || '<div class="empty-state">La tua agenda è libera. Avanza il tempo per generare i primi appuntamenti.</div>'}</div>`,
    politici: `<div class="catalog-shell"><div class="catalog-summary"><strong>${realDatabase.politicians.length} parlamentari</strong><span>Dato reale verificato · roster XIX legislatura al ${esc(realDatabase.manifest.snapshotDate)}</span></div><div class="catalog-body" data-catalog-body>${politiciansPage(catalog)}</div></div>${catalog.selectedPoliticianId ? politicianProfile(catalog.selectedPoliticianId) : ''}`,
    'partiti-lista': `<div class="catalog-shell"><div class="catalog-summary"><strong>${realDatabase.parties.length + realDatabase.politicalMovements.length} partiti e movimenti</strong><span>Registro Parlamento · MEF 2‰ · Dato reale verificato</span></div><div class="catalog-body" data-catalog-body>${partiesPage(catalog)}</div></div>`,
    partito: `<div class="feature-card party-detail-card"><span class="feature-icon">◇</span><div class="eyebrow">${party ? 'AFFILIAZIONE ATTUALE' : 'PROFILO INDIPENDENTE'}</div><h2>${party ? esc(party.name) : 'Nessuna affiliazione'}</h2><p>${party ? esc(party.description || 'Partito pronto a essere configurato.') : 'Puoi restare indipendente. La scelta di un partito o la sua creazione sarà disponibile all’avvio di una nuova carriera.'}</p><div class="party-detail-meta">${party ? `<span class="party-swatch" style="--party:${esc(party.color || '#687b90')}">${esc(party.abbreviation)}</span><span><small>ORIENTAMENTO</small><strong>${esc(party.orientation || 'Da definire')}</strong></span><span class="source-pill">${sourceLabel(party.source)}</span>` : '<span class="source-pill">Nessuna affiliazione</span>'}</div>${party?.policyPositions ? `<div class="policy-summary">${[['economia','Economia'],['welfare','Welfare'],['ambiente','Ambiente'],['europa','Europa']].map(([key,label]) => `<span><small>${label}</small><strong>${Number(party.policyPositions[key] ?? 3)} <i>/ 5</i></strong><b><i style="width:${Number(party.policyPositions[key] ?? 3)*20}%"></i></b></span>`).join('')}</div>` : ''}</div>`,
    carriera: `<div class="career-roadmap"><div class="roadmap-lead"><span class="section-kicker">PUNTO DI PARTENZA</span><h2>${player ? esc(player.displayName) : 'Crea il tuo politico'}</h2><p>${player ? `${esc(player.previousProfession)} · ${esc(player.municipality)}, ${esc(player.region)}` : 'Scegli chi vuoi diventare e da dove iniziare.'}</p>${player ? '' : '<button class="primary-button" data-action="new-career">Crea il tuo politico ' + icon('arrow', 16) + '</button>'}</div><div class="roadmap-stage"><span class="roadmap-number">01</span><div><small>IL TUO LIVELLO INIZIALE</small><strong>${({comunale:'Politica comunale',regionale:'Politica regionale',nazionale:'Politica nazionale'})[state.career.initialLevel] ?? 'Da definire'}</strong><span>${esc(state.dataset.territories.find(item => item.id === state.career.territoryId)?.name ?? player?.region ?? 'Italia')}</span></div></div><div class="roadmap-stage upcoming"><span class="roadmap-number">02</span><div><small>PROSSIMO CAPITOLO</small><strong>Fatti conoscere sul territorio</strong><span>Il percorso si svilupperà con le prossime fasi del gioco.</span></div></div><button class="text-link" data-nav="profilo">Vai al tuo profilo ${icon('arrow', 16)}</button></div>`,
    profilo: `<div class="profile-page"><section class="profile-page-lead"><div class="hero-avatar">${player ? esc(player.firstName[0] + player.lastName[0]) : 'P'}</div><div><span class="section-kicker">IL TUO POLITICO</span><h2>${player ? esc(player.displayName) : 'Nessun profilo creato'}</h2><p>${player ? `${esc(player.previousProfession)} · residente a ${esc(player.municipality)}, ${esc(player.region)}` : 'Crea una carriera per definire il tuo profilo.'}</p></div>${player ? '' : '<button class="primary-button" data-action="new-career">Nuova carriera ' + icon('arrow', 16) + '</button>'}</section><div class="profile-page-facts"><div><span>INCARICO</span><strong>${player?.roleId ? esc(state.dataset.offices.find(item => item.id === player.roleId)?.title ?? 'Da assegnare') : 'Da assegnare'}</strong></div><div><span>TERRITORIO</span><strong>${esc(state.dataset.territories.find(item => item.id === player?.territoryId)?.name ?? player?.region ?? 'Italia')}</strong></div><div><span>PARTITO</span><strong>${party ? esc(party.name) : 'Indipendente'}</strong></div></div><section class="profile-metrics"><h3>Statistiche</h3>${profileMetrics}</section><button class="text-link" data-nav="politici">Esplora i profili politici ${icon('arrow', 16)}</button></div>`,
    eventi: `<div class="agenda-list">${events.map(e => `<div class="agenda-row"><div class="agenda-date"><strong>${formatDate(e.date, { day: '2-digit' })}</strong><span>${formatDate(e.date, { month: 'short' })}</span></div><div class="agenda-row-text"><span class="event-tag">${esc(e.category)}</span><strong>${esc(e.title)}</strong><small>${esc(e.status)}</small></div><span class="source-pill">${sourceLabel(e.source)}</span></div>`).join('') || '<div class="empty-state">Nessun evento in programma.</div>'}</div>`,
    impostazioni: `<div class="settings-grid"><article class="panel settings-card"><div class="eyebrow">SALVATAGGIO</div><h3>La tua carriera è locale</h3><p>Il salvataggio viene conservato in questo browser. Puoi salvare in qualsiasi momento dalla barra superiore.</p><button class="secondary-button" data-action="save">Salva adesso ${icon('save', 16)}</button></article><article class="panel settings-card"><div class="eyebrow">DATI DI GIOCO</div><h3>Demo e provenienza</h3><p>I dataset di riferimento sono separati dai dati della carriera. Le schede reali mostrano fonte, verifica e data di riferimento; i dati non disponibili restano vuoti.</p><span class="source-pill">${realDatabase.parties.length + realDatabase.politicalMovements.length} organizzazioni · ${realDatabase.politicians.length} parlamentari</span></article><article class="panel settings-card danger-card"><div class="eyebrow">NUOVA PARTITA</div><h3>Ricomincia la demo</h3><p>Ripristina la carriera dimostrativa e ricrea il salvataggio locale.</p><button class="secondary-button" data-action="reset">Nuova carriera demo</button></article></div>`,
  };
  const placeholder = `<div class="coming-grid"><div class="coming-main panel"><span class="feature-icon">${page.title.slice(0, 1)}</span><div class="eyebrow">STRUTTURA PRONTA</div><h2>${page.title} in costruzione</h2><p>Questa sezione è già collegata alla navigazione. La struttura dati è pronta per accogliere contenuti verificati e dati generati dalla simulazione, con provenienza esplicita.</p><div class="coming-tags"><span>Database modulare</span><span>Dati versionati</span><span>Pronto a espandersi</span></div></div><div class="coming-side panel"><div class="eyebrow">COMPONENTI PREVISTI</div>${plannedFor(state.ui.activePage).map(x => `<div class="planned-item"><span>${icon('chevron', 15)}</span>${x}</div>`).join('')}</div></div>`;
  const routeGroups = { partito: [['partiti-lista', 'Tutti i partiti']], parlamento: [['governo', 'Governo'], ['leggi', 'Leggi']], calendario: [['eventi', 'Eventi']], eventi: [['calendario', 'Agenda']], profilo: [['politici', 'Archivio politici']], politici: [['profilo', 'Il tuo profilo']], 'partiti-lista': [['partito', 'Il tuo partito']] };
  const routes = routeGroups[state.ui.activePage] ?? [];
  return `<section class="welcome-row sub-welcome"><div><div class="eyebrow">${page.eyebrow} <span class="eyebrow-line"></span></div><h1>${page.title}<span class="period">.</span></h1><p class="intro">${page.intro}</p></div>${state.ui.activePage === 'carriera' && player ? `<button class="secondary-button" data-action="new-career">Nuova carriera ${icon('plus', 16)}</button>` : ''}</section>${routes.length ? `<nav class="section-routes" aria-label="Sezioni collegate">${routes.map(([id, label]) => `<button class="section-route ${state.ui.activePage === id ? 'active' : ''}" data-nav="${id}">${label} ${icon('arrow', 15)}</button>`).join('')}</nav>` : ''}<section class="subpage-content">${listContents[state.ui.activePage] ?? placeholder}</section><footer class="page-footer"><span>POLITICANDO 2026 <i>·</i> ${['politici','partiti-lista'].includes(state.ui.activePage)?'DATABASE REALE':'SIMULAZIONE'}</span><span>${['politici','partiti-lista'].includes(state.ui.activePage)?`${realDatabase.politicians.length} parlamentari · ${realDatabase.parties.length+realDatabase.politicalMovements.length} organizzazioni`:`${state.dataset.politicians.length} profili · ${state.dataset.parties.length} partiti demo`}</span></footer>`;
}
function catalogSelect(label, key, options, value = 'all') {
  return `<label class="catalog-filter"><span>${label}</span><select data-catalog-filter="${key}">${options.map(([id,name]) => `<option value="${esc(id)}" ${value === id ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>`;
}
function partiesPage(filters) {
  const all = [...realDatabase.parties, ...realDatabase.politicalMovements];
  const regions = realDatabase.territories.filter(x => x.kind === 'regione').sort((a,b) => a.officialName.localeCompare(b.officialName,'it'));
  const options = {partyPresence:[['all','Presenza parlamentare: tutte'],['yes','Presente'],['no','Non presente'],['unknown','Non documentata']],partyLevel:[['all','Livello: tutti'],['nazionale','Nazionale'],['regionale','Regionale'],['locale','Locale'],['unknown','Non documentato']],partyRegion:[['all','Regione: tutte'],['unknown','Regione non documentata'],...regions.map(x=>[x.id,x.officialName])],partyStatus:[['all','Stato: tutti'],['active','Attivo nel registro'],['inactive','Non attivo'],['historical','Storico'],['unknown','Non documentato']],partyElection:[['all','Partecipazione elettorale: tutte'],['yes','Partecipazione verificata'],['unknown','Non documentata']],partySort:[['name','Ordine alfabetico'],['representation','Rappresentanza parlamentare']]};
  const filtersHtml = `<div class="catalog-toolbar"><label class="catalog-search"><span>Cerca partito o movimento</span><input data-catalog-filter="partyQuery" value="${esc(filters.partyQuery)}" placeholder="Nome, sigla, regione…" /></label>${Object.entries(options).map(([key,opts])=>catalogSelect('',key,opts,filters[key])).join('')}</div>`;
  return `${filtersHtml}<div data-catalog-results>${partyRows(filters)}</div>`;
}
function partyRows(filters) {
  let rows = [...realDatabase.parties,...realDatabase.politicalMovements];
  const query = filters.partyQuery.trim().toLocaleLowerCase('it-IT');
  if (query) rows = rows.filter(p => [p.officialName,p.abbreviation,p.factualDescription,p.website,p.regionId].some(value => String(value ?? '').toLocaleLowerCase('it-IT').includes(query)));
  if (filters.partyPresence !== 'all') rows = rows.filter(p => filters.partyPresence === 'unknown' ? p.parliamentaryPresence == null : p.parliamentaryPresence === (filters.partyPresence === 'yes'));
  if (filters.partyLevel !== 'all') rows = rows.filter(p => filters.partyLevel === 'unknown' ? !p.level : p.level === filters.partyLevel);
  if (filters.partyRegion !== 'all') rows = rows.filter(p => filters.partyRegion === 'unknown' ? !p.regionId : p.regionId === filters.partyRegion);
  if (filters.partyStatus !== 'all') rows = rows.filter(p => filters.partyStatus === 'unknown' ? !p.status : filters.partyStatus === 'inactive' ? p.status === 'inactive' || p.status === 'historical' : p.status === filters.partyStatus);
  if (filters.partyElection !== 'all') rows = rows.filter(p => { const documented = realDatabase.electionParticipations.some(e => e.partyId === p.id); return filters.partyElection === 'unknown' ? !documented : documented; });
  rows.sort((a,b) => filters.partySort === 'representation' ? (Number(b.parliamentaryRepresentation ?? 0)-Number(a.parliamentaryRepresentation ?? 0)) || a.officialName.localeCompare(b.officialName,'it') : a.officialName.localeCompare(b.officialName,'it'));
  if (!rows.length) return '<div class="catalog-empty">Nessuna organizzazione corrisponde ai filtri selezionati.</div>';
  return `<div class="catalog-list">${rows.map(p => `<article class="catalog-row"><span class="catalog-mark">${p.entityType === 'politicalMovement' ? 'M' : 'P'}</span><div class="catalog-main"><strong>${esc(p.officialName)}</strong><span>${p.entityType === 'politicalMovement' ? 'Movimento politico' : 'Partito politico'} · ${p.level ? esc(p.level) : 'livello non documentato'}</span><small>${p.factualDescription ? esc(p.factualDescription) : 'Descrizione non presente nella fonte consultata.'}</small></div><div class="catalog-facts"><span>${p.status ? statusLabel(p.status) : 'Stato non documentato'}</span><span>${p.parliamentaryPresence == null ? 'Rappresentanza non documentata' : p.parliamentaryPresence ? 'Presenza parlamentare' : 'Senza presenza parlamentare'}</span><span class="verified-badge">Dato reale verificato</span></div><a class="catalog-source" href="${esc(p.sourceUrl)}" target="_blank" rel="noreferrer">Fonte ↗</a></article>`).join('')}</div><p class="catalog-footnote">I filtri mostrano “non documentato” quando il dataset ufficiale non consente di stabilire il valore. La registrazione e la partecipazione elettorale non sono usate come sinonimi.</p>`;
}
function politiciansPage(filters) {
  const parties = [...new Set(realDatabase.partyMemberships.map(m => m.partyId))].map(id => [id,realDatabase.parties.find(p=>p.id===id)?.officialName ?? id]);
  const groups = realDatabase.parliamentaryGroups.map(g => [g.id,`${g.officialName} · ${g.chamber === 'camera' ? 'Camera' : 'Senato'}`]).sort((a,b)=>a[1].localeCompare(b[1],'it'));
  const chambers = [['all','Camera e Senato'],['camera','Camera'],['senato','Senato']];
  const controls = `<div class="catalog-toolbar"><label class="catalog-search"><span>Cerca una persona</span><input data-catalog-filter="politicianQuery" value="${esc(filters.politicianQuery)}" placeholder="Nome o cognome…" /></label>${catalogSelect('', 'politicianChamber', chambers, filters.politicianChamber)}${catalogSelect('', 'politicianParty', [['all','Tutti i partiti documentati'],...parties], filters.politicianParty)}${catalogSelect('', 'politicianGroup', [['all','Tutti i gruppi'],...groups], filters.politicianGroup)}</div>`;
  const q=filters.politicianQuery.trim().toLocaleLowerCase('it-IT');
  let people=realDatabase.politicians;
  if(q) people=people.filter(p=>p.fullName.toLocaleLowerCase('it-IT').includes(q));
  if(filters.politicianChamber!=='all')people=people.filter(p=>p.chamber===filters.politicianChamber);
  if(filters.politicianParty!=='all')people=people.filter(p=>realDatabase.partyMemberships.some(m=>m.politicianId===p.id&&m.partyId===filters.politicianParty));
  if(filters.politicianGroup!=='all')people=people.filter(p=>p.groupId===filters.politicianGroup);
  const groupById=new Map(realDatabase.parliamentaryGroups.map(g=>[g.id,g]));
  const rows=people.map(p=>{const group=groupById.get(p.groupId);const memberships=realDatabase.groupMemberships.filter(m=>m.politicianId===p.id);const currentMembership=memberships.find(m=>m.groupId===p.groupId&&!m.validTo);const offices=realDatabase.offices.filter(o=>o.politicianId===p.id);return `<button type="button" class="catalog-row politician-row" data-politician-profile="${esc(p.id)}"><span class="catalog-mark">${p.chamber==='camera'?'C':'S'}</span><span class="catalog-main"><strong>${esc(p.fullName)}</strong><span>${offices[0]?esc(offices[0].title):p.chamber==='camera'?'Deputato della Repubblica':'Senatore della Repubblica'} · ${group?esc(group.officialName):p.chamber==='camera'?'Camera dei deputati':'Senato della Repubblica'}</span><small>${p.birthDate?`Nato il ${esc(p.birthDate)}`:'Dati anagrafici non presenti nell’importazione'}${p.electedOnList?` · Lista di elezione: ${esc(p.electedOnList)}`:''} · ${currentMembership?`Appartenenza al gruppo dal ${esc(currentMembership.validFrom||'data non documentata')}`:'Gruppo corrente documentato'}</small></span><span class="verified-badge">Dato reale verificato</span><span class="catalog-open">Profilo ↗</span></button>`}).join('');
  return `${controls}<div class="catalog-result-count">${people.length} profili reali verificati</div><div class="catalog-list">${rows||'<div class="catalog-empty">Nessun politico corrisponde ai filtri selezionati.</div>'}</div><p class="catalog-footnote">Il gruppo parlamentare è distinto dal partito. Il filtro per partito usa soltanto appartenenze documentate; qui non ci sono associazioni partito-politico aggiunte per deduzione.</p>`;
}
function statusLabel(status) { return status === 'active' ? 'Registrato' : status === 'historical' ? 'Storico' : 'Non attivo'; }
function politicianProfile(id) {
  const p=realDatabase.politicians.find(x=>x.id===id); if(!p)return '';
  const group=realDatabase.parliamentaryGroups.find(g=>g.id===p.groupId);
  const memberships=realDatabase.groupMemberships.filter(m=>m.politicianId===id);const offices=realDatabase.offices.filter(o=>o.politicianId===id);
  const groupNames=new Map(realDatabase.parliamentaryGroups.map(g=>[g.id,g.officialName]));
  const history=memberships.slice().sort((a,b)=>String(a.validFrom??'').localeCompare(String(b.validFrom??''))).map(m=>`${esc(groupNames.get(m.groupId)??'Gruppo non disponibile')}: ${esc(m.validFrom||'data iniziale non disponibile')} – ${esc(m.validTo||'in carica')}`).join('; ');
  return `<div class="profile-modal-backdrop" data-profile-close><section class="politician-profile" role="dialog" aria-modal="true" aria-labelledby="person-title"><button class="profile-modal-close" data-profile-close aria-label="Chiudi">×</button><span class="verified-badge">Dato reale verificato</span><h2 id="person-title">${esc(p.fullName)}</h2><p>${p.chamber==='camera'?'Deputato · Camera dei deputati':'Senatore · Senato della Repubblica'}</p><dl><dt>Partito</dt><dd>${p.partyId?esc(realDatabase.parties.find(x=>x.id===p.partyId)?.officialName??'Non disponibile'):'Non documentato separatamente dal gruppo'}</dd><dt>Lista di elezione</dt><dd>${p.electedOnList?esc(p.electedOnList):'Non disponibile'}</dd><dt>Gruppo parlamentare</dt><dd>${group?esc(group.officialName):'Non documentato'}</dd><dt>Data di nascita</dt><dd>${p.birthDate?esc(p.birthDate):'Non disponibile nel dataset importato'}</dd><dt>Luogo di nascita</dt><dd>${p.birthPlace?esc(p.birthPlace):'Non disponibile'}</dd><dt>Collegio/circoscrizione</dt><dd>${p.constituency||p.circoscription?esc(p.constituency||p.circoscription):'Non disponibile'}</dd><dt>Cariche</dt><dd>${offices.length?offices.map(x=>esc(x.title)).join(', '):'Non documentato'} </dd><dt>Storico gruppo</dt><dd>${history||'Non disponibile'}</dd></dl><a href="${esc(p.sourceUrl)}" target="_blank" rel="noreferrer">Apri fonte istituzionale ↗</a></section></div>`;
}
function stateCatalogContent(state, catalog) {
  return state.ui.activePage === 'politici' ? politiciansPage(catalog) : state.ui.activePage === 'partiti-lista' ? partiesPage(catalog) : '';
}

function plannedFor(page) {
  const items = { elezioni: ['Scadenziario nazionale e locale', 'Territori e collegi', 'Storico dei risultati'], sondaggi: ['Trend di consenso nel tempo', 'Confronto tra partiti', 'Approvazione e popolarità'], parlamento: ['Camera dei deputati', 'Senato della Repubblica', 'Gruppi e commissioni'], governo: ['Composizione del Consiglio dei ministri', 'Agenda dell’esecutivo', 'Indici di approvazione'], leggi: ['Proposte e iter', 'Stato alle Camere', 'Storico dei provvedimenti'], eventi: ['Eventi politici e casuali', 'Archivio per data', 'Impatto sulla carriera'] };
  return items[page] ?? ['Enti territoriali e gerarchie', 'Profili e incarichi', 'Indicatori nel tempo'];
}
