import { activeMinisters, canManageParliament, CHAMBERS, CONTEST_COST, CONTEST_WINDOW_DAYS, GOVERNMENT_POST_REQUIREMENTS, governingGroupIds, governmentPostProblems, MINISTERIAL_PORTFOLIOS, nextParliamentaryRole, parliamentGroupFacts, playerInMajority } from '../core/parliament-engine.js?v=20260926-8';
import { amendmentOdds, forecastVote, LAW_SPONSORS, PLAYER_VOTE_CHOICES } from '../core/lawmaking-engine.js?v=20260926-8';
import { AREA_BY_ID, FINANCING, GOVERNMENT_LINES } from '../data/simulation/policy-rules.js?v=20260926-8';
const GOVERNMENT_LINE_LABELS = Object.fromEntries(Object.entries(GOVERNMENT_LINES).map(([id, item]) => [id, item.label]));
import { AMENDMENT_CAPITAL_COST } from '../data/simulation/career-rules.js?v=20260926-8';
import { DATA_SOURCES } from '../data/schema.js?v=20260926-8';
import { careerOverview } from '../core/career-overview.js?v=20260926-8';
import { voteSummary } from '../core/vote-engine.js?v=20260926-8';
import { artTile, glyph, LAW_ICONS } from './visuals.js?v=20260926-8';
import { measureDesign, projectLaw } from '../core/society-engine.js?v=20260926-8';
import { governmentDesk, lawContent, policyFields, policyPreview } from './policy-mode.js?v=20260926-8';
import { SEGMENTS } from '../data/simulation/society-rules.js?v=20260926-8';
import { legislatureLabel } from '../core/legislature-engine.js?v=20260926-8';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const whole = value => new Intl.NumberFormat('it-IT').format(value ?? 0);
const statusNames = { resigned: 'Dimissionario · consultazioni in corso', proposal: 'Proposta', commission: 'Commissione', amendments: 'Emendamenti', 'other-chamber': 'Altra Camera', 'final-vote': 'Votazione finale', approved: 'Approvata', rejected: 'Respinta', lapsed: 'Decaduta', active: 'In carica', crisis: 'Crisi aperta', fallen: 'Fiducia negata', 'awaiting-confidence': 'In attesa della fiducia', caretaker: 'Dimissionario · affari correnti' };
const FORMATION_LABELS = { insediamento: 'Verso la prima seduta delle Camere', consultazioni: 'Consultazioni al Quirinale', incarico: 'Incarico e giuramento', fiducia: 'Fiducia nelle Camere', completata: 'Governo in carica', fallita: 'Camere sciolte: verso nuove elezioni' };
// Groups of a legislature born from a vote of the game: no real reference, no real leaders.
const simulatedGroup = group => group?.simulated === true;
// In a legislature of the game the groups of a party have the same name in both Chambers: the chamber tells them apart.
const chipName = group => group ? (simulatedGroup(group) ? group.officialName + ' · ' + (CHAMBERS[group.chamber]?.shortLabel ?? group.chamber) : group.officialName) : null;
const referenceText = group => simulatedGroup(group) ? 'Gruppo della ' + esc(group.legislature ? legislatureLabel(group.legislature) : 'legislatura') + ' (simulata) · ' + whole(group.reference?.memberCount ?? group.simulatedSeats) + ' eletti nel voto della partita' : group.reference.memberCount === null ? 'Consistenza di riferimento non disponibile' : whole(group.reference.memberCount) + ' componenti nel dato reale · ' + esc(group.reference.countAsOf || 'data non disponibile');
const groupsFor = parliament => ['camera', 'senato'].flatMap(chamber => parliament?.chambers?.[chamber]?.groups ?? []);
const daysBetween = (from, to) => Math.round((Date.parse(to + 'T12:00:00') - Date.parse(from + 'T12:00:00')) / 86400000);

function dataMarker(source, label) {
  return '<span class="parliament-provenance ' + (source === DATA_SOURCES.REAL ? 'real' : 'simulated') + '">' + esc(label || (source === DATA_SOURCES.REAL ? 'DATO REALE' : 'SCENARIO SIMULATO')) + '</span>';
}
function groupSource(group) {
  const source = group.reference?.sourceUrl;
  return source ? '<a class="parliament-source" href="' + esc(source) + '" target="_blank" rel="noopener noreferrer">Fonte ' + esc(group.reference.sourceName || 'istituzionale') + ' ↗</a>' : '';
}
function playerParty(party) {
  if (!party) return '<div class="parliament-party-banner"><span class="parliament-party-mark">I</span><span><small>APPARTENENZA</small><strong>Politico indipendente</strong></span></div>';
  const color = /^#[\da-f]{6}$/i.test(party.color ?? '') ? party.color : '#8c988b';
  const logo = party.logoAsset || (party.logoVerified && party.logoUrl) ? '<img src="' + esc(party.logoAsset || party.logoUrl) + '" alt="' + esc(party.logoAlt || ('Logo di ' + (party.officialName || party.name))) + '" />' : '<i>' + esc((party.abbreviation || party.name || 'P').slice(0, 3)) + '</i>';
  const source = party.source === DATA_SOURCES.REAL ? 'Identità e colore ufficiali solo se documentati' : party.source === DATA_SOURCES.USER ? 'Partito creato nella carriera' : 'Partito di simulazione';
  return '<div class="parliament-party-banner" style="--party-color:' + esc(color) + '">' + logo + '<span><small>' + esc(source) + '</small><strong>' + esc(party.officialName || party.name) + '</strong></span></div>';
}
function chamberPanel(parliament, chamber, politicians = []) {
  const facts = parliamentGroupFacts(parliament, chamber);
  const kind = CHAMBERS[chamber];
  const government = parliament.government;
  const coalition = new Set(government?.coalitionGroupIds ?? []);
  const supporters = new Set(government?.supportingGroupIds ?? []);
  const hasGovernment = government?.status === 'active' || government?.status === 'crisis';
  const rows = [...facts.groups].sort((a, b) => b.simulatedSeats - a.simulatedSeats).map((group, index) => {
    const pct = facts.total ? Math.max(1, Math.round(group.simulatedSeats / facts.total * 100)) : 0;
    const selected = parliament.player?.groupId === group.groupId;
    const leader = politicians.find(person => person.id === group.reference.leaderPoliticianId && person.source === DATA_SOURCES.REAL && person.verified === true);
    const relation = parliament.relations?.[group.groupId]?.value ?? 50;
    const position = hasGovernment ? coalition.has(group.groupId) ? 'Maggioranza simulata' : supporters.has(group.groupId) ? 'Sostegno esterno simulato' : 'Opposizione simulata' : '';
    const leaderLabel = leader ? 'Capogruppo documentato: ' + (leader.fullName || leader.firstName + ' ' + leader.lastName) : '';
    const reference = referenceText(group);
    return '<div class="parliament-group-row ' + (selected ? 'player-group' : '') + '"><div class="parliament-group-main"><span class="group-order">' + String(index + 1).padStart(2, '0') + '</span><div class="parliament-group-name"><strong>' + esc(group.officialName) + (selected ? '<em>Il tuo gruppo nello scenario</em>' : '') + (position ? '<em class="group-position">' + esc(position) + '</em>' : '') + '</strong><small>' + reference + (leaderLabel ? ' · ' + esc(leaderLabel) : '') + '</small></div><b class="parliament-sim-seat">' + whole(group.simulatedSeats) + '<small>scenario</small></b></div><div class="parliament-seat-track"><i style="width:' + pct + '%"></i></div><div class="parliament-group-meta"><span>' + (selected ? 'Il tuo gruppo' : 'Rapporto simulato con il tuo gruppo <b>' + relation + ' / 100</b>') + '</span>' + groupSource(group) + '</div></div>';
  }).join('');
  const simulated = parliament.legislature?.reference === 'simulation';
  return '<section class="chamber-panel"><header class="chamber-panel-head"><div><span class="section-kicker">COMPOSIZIONE · ' + esc(kind.shortLabel.toUpperCase()) + '</span><h2>' + esc(kind.label) + '</h2></div>' + dataMarker(DATA_SOURCES.SIMULATION, simulated ? 'LEGISLATURA SIMULATA' : 'SCENARIO · RIFERIMENTO REALE A LATO') + '</header><div class="chamber-totals"><span><small>SEGGI NELLO SCENARIO</small><strong>' + whole(facts.total) + '</strong></span><span><small>SOGLIA DI MAGGIORANZA</small><strong>' + whole(facts.majority) + '</strong></span></div><div class="parliament-group-list">' + (rows || '<p class="quiet-copy">I gruppi di questa Camera non sono disponibili.</p>') + '</div><p class="parliament-note">' + (simulated ? 'Camere nate dal voto della partita sulla mappa elettorale reale del 2022: gruppi, seggi e rapporti sono simulati, source: simulation. I gruppi sotto la soglia siedono nel Misto come componenti.' : 'I numeri grandi e i rapporti sono della partita, source: simulation. Composizione reale di riferimento, data, capigruppo documentati e fonti sono distinti per ogni gruppo.') + '</p></section>';
}
function groupChoices(parliament) {
  return (parliament.chambers[parliament.player.chamber]?.groups ?? []).filter(group => group.groupId !== parliament.player.groupId).map(group => '<label class="parliament-choice"><input type="radio" name="player-parliament-group" value="' + esc(group.groupId) + '" /><span><strong>' + esc(group.officialName) + '</strong><small>' + (simulatedGroup(group) ? whole(group.simulatedSeats) + ' seggi nella legislatura simulata' : group.reference.memberCount === null ? 'Consistenza reale non disponibile' : whole(group.reference.memberCount) + ' componenti nel dato reale') + ' · scelta simulata</small></span>' + groupSource(group) + '</label>').join('');
}
function playerGroupSelector(parliament) {
  if (!parliament.player) return '';
  if (!parliament.player.groupId) return '<section class="parliament-callout"><span class="section-kicker">IL TUO GRUPPO</span><h3>Scegli il gruppo di riferimento</h3><p>Il mandato è simulato e il gruppo non viene dedotto dal partito. Scegli a quale contesto collegare il personaggio.</p><div class="parliament-choice-list">' + groupChoices(parliament) + '</div><button class="primary-button" data-parliament-action="join-group">Conferma il gruppo ' + icon + '</button></section>';
  return '<details class="coalition-edit parliament-group-change"><summary>Cambia gruppo parlamentare</summary><p class="parliament-note">Lasciare il gruppo costa reputazione e interrompe gli incarichi ottenuti al suo interno.</p><div class="parliament-choice-list">' + groupChoices(parliament) + '</div><button class="secondary-button" data-parliament-action="join-group">Passa al gruppo selezionato</button></details>';
}
function rolePanel(parliament, currentDate, odds = null) {
  const standing = parliament.careerStanding;
  if (!parliament.player || !standing) return '';
  const canAct = canManageParliament(parliament);
  const next = nextParliamentaryRole(parliament);
  const wait = standing.lastContestAt ? Math.max(0, CONTEST_WINDOW_DAYS - daysBetween(standing.lastContestAt, currentDate)) : 0;
  const capital = parliament.resources?.politicalCapital ?? 0;
  const blocker = !canAct ? 'Scegli prima un gruppo.' : !next ? 'Hai raggiunto l’incarico più alto previsto.' : wait ? `Nuovo tentativo tra ${wait} giorni.` : capital < CONTEST_COST ? `Servono ${CONTEST_COST} punti di capitale politico.` : '';
  const roles = (standing.roles ?? []).map(role => '<span>' + esc(role.title) + ' · dal ' + esc(role.appointedAt) + (role.endedAt ? ' al ' + esc(role.endedAt) : ' · in corso') + '</span>').join('');
  const lastContest = standing.lastContest;
  // The outcome of the last attempt as it was decided: odds, and one of the possible endings (not just won or lost).
  const last = lastContest ? '<small>Ultima competizione: ' + esc(lastContest.roleTitle || 'incarico') + (Number.isFinite(lastContest.chance) ? ' · probabilità ' + Math.round(lastContest.chance * 100) + '%' : ' · punteggio ' + whole(lastContest.score) + ' su soglia ' + whole(lastContest.threshold)) + ' · ' + esc(lastContest.label || (lastContest.result === 'success' ? 'vinta' : 'non vinta')) + '</small>' : '';
  const chance = next && odds && Number.isFinite(odds.chance) ? ' · probabilità stimata <b>' + Math.round(odds.chance * 100) + '%</b>' : '';
  return '<section class="parliament-role-panel"><div><span class="section-kicker">INCARICHI PARLAMENTARI</span><h3>' + esc(standing.committeeRole?.title || 'Nessun incarico interno') + '</h3><p>Sostegno nel gruppo <b>' + whole(standing.partySupport) + ' / 100</b>' + (next ? ' · Prossimo obiettivo: <b>' + esc(next.title) + '</b> (soglia ' + whole(standing.competitionStrength ?? next.threshold) + ')' + chance : '') + '</p>' + last + (roles ? '<div class="parliament-role-list">' + roles + '</div>' : '') + '</div><div class="parliament-role-action"><button class="secondary-button" data-parliament-action="contest-role" ' + (blocker ? 'disabled' : '') + '>Candidati all’incarico</button><small>' + esc(blocker || `Costo ${CONTEST_COST} di capitale politico. Superare la soglia rende la nomina probabile, non certa: contano influenza, reputazione, esperienza, sostegno nel gruppo, anzianità e risultati. Può finire anche con un incarico minore, un rinvio o un altro nome.`) + '</small><button class="text-link" data-section-tab="carriera" data-section-tab-value="progressione">Fattori e probabilità</button></div></section>';
}
function timeline(parliament) {
  const entries = [...(parliament.history ?? [])].filter(item => !item.details?.auto).slice(-6).reverse();
  return '<section class="parliament-timeline"><div class="home-section-heading"><div><span class="section-kicker">STORICO DELLA CARRIERA</span><h2>Decisioni a Palazzo</h2></div></div>' + (entries.map(item => '<article class="parliament-timeline-item"><time>' + esc(item.date) + '</time><span class="timeline-mark"></span><div><strong>' + esc(item.text) + '</strong><small>' + esc(item.type.replaceAll('-', ' ')) + ' · source: simulation</small></div></article>').join('') || '<p class="quiet-copy">Le attività parlamentari appariranno qui e nello storico della carriera.</p>') + '</section>';
}
function accessNote(parliament) {
  if (canManageParliament(parliament)) return '';
  if (parliament.player && !parliament.player.groupId) return '<div class="parliament-access-note">Completa la scelta del gruppo nella sezione Parlamento per partecipare alle attività di governo e alle leggi.</div>';
  if (parliament.pastMandates?.length) return '<div class="parliament-access-note">Il tuo mandato parlamentare si è concluso. Puoi consultare la composizione e lo storico; per tornare in Aula serve una nuova elezione nella sezione Elezioni.</div>';
  return '<div class="parliament-access-note">La composizione è consultabile in questa carriera. Per proporre leggi, votare o formare un governo serve un percorso parlamentare come Deputato o Senatore, oppure un mandato ottenuto nella campagna elettorale.</div>';
}
function initials(player) {
  return player ? esc((player.firstName?.[0] ?? '') + (player.lastName?.[0] ?? '')) || 'P' : 'P';
}

function renderParliament(parliament, party, politicians, player, currentDate, odds = null) {
  const seat = parliament.player;
  const currentGroup = seat?.groupId ? groupsFor(parliament).find(group => group.groupId === seat.groupId) : null;
  const roleText = seat ? CHAMBERS[seat.chamber].label : 'Nessun incarico parlamentare nella carriera';
  const majorityLabel = seat?.groupId && ['active', 'crisis'].includes(parliament.government?.status) ? (playerInMajority(parliament) ? 'Il tuo gruppo sostiene il governo' : 'Il tuo gruppo è all’opposizione') : '';
  return '<div class="parliament-mode"><section class="parliament-mode-hero"><div><span class="section-kicker">POLITICA IN AULA' + (parliament.legislature?.label ? ' · ' + esc(parliament.legislature.label.toUpperCase()) : '') + '</span><h2>Due Camere, una partita.</h2><p>' + (parliament.legislature?.reference === 'simulation' ? 'Le Camere nate dal voto della partita: gruppi, seggi, maggioranze e posizione del giocatore sono simulati. La XIX legislatura reale resta nell’archivio.' : 'Composizione reale usata come riferimento; maggioranze, posizione del giocatore e conseguenze appartengono al salvataggio simulato.') + '</p></div><div class="parliament-player"><span class="player-avatar">' + initials(player) + '</span><span><small>' + esc(roleText) + '</small><strong>' + esc(seat ? currentGroup?.officialName || 'Gruppo da scegliere' : 'Osservatore') + '</strong></span></div></section>' + playerParty(party) + (seat && !seat.groupId ? playerGroupSelector(parliament) : '') + (seat ? '<section class="parliament-status-line">' + dataMarker(DATA_SOURCES.SIMULATION, 'RUOLO DI GIOCO') + '<span>' + esc(seat.position) + '</span><span>Capitale politico <b>' + whole(parliament.resources?.politicalCapital) + ' / 100</b></span>' + (majorityLabel ? '<span>' + esc(majorityLabel) + '</span>' : '') + '<span>Approvazione e seggi non sono dati ufficiali.</span></section>' : '') + rolePanel(parliament, currentDate, odds) + (seat?.groupId ? playerGroupSelector(parliament) : '') + '<div class="parliament-chamber-grid">' + chamberPanel(parliament, 'camera', politicians) + chamberPanel(parliament, 'senato', politicians) + '</div>' + accessNote(parliament) + timeline(parliament) + '</div>';
}

function groupChecks(parliament, selectedIds = [], politicians = []) {
  return ['camera', 'senato'].map(chamber => {
    const groups = parliament.chambers[chamber]?.groups ?? [];
    return '<fieldset class="government-chamber"><legend>' + esc(CHAMBERS[chamber].label) + '</legend>' + groups.map(group => {
      const leader = politicians.find(person => person.id === group.reference.leaderPoliticianId && person.source === DATA_SOURCES.REAL && person.verified === true);
      const leaderLabel = simulatedGroup(group) ? 'gruppo della legislatura simulata' : leader ? 'Capogruppo: ' + (leader.fullName || leader.firstName + ' ' + leader.lastName) : 'Capogruppo non documentato';
      return '<label class="government-group-check"><input type="checkbox" data-government-group value="' + esc(group.groupId) + '" ' + (selectedIds.includes(group.groupId) ? 'checked' : '') + ' /><span><strong>' + esc(group.officialName) + (group.groupId === parliament.player?.groupId ? ' · il tuo gruppo' : '') + '</strong><small>' + whole(group.simulatedSeats) + ' seggi nello scenario · ' + esc(leaderLabel) + '</small></span></label>';
    }).join('') + '</fieldset>';
  }).join('');
}
function confidenceSummary(government) {
  const last = government?.confidenceVotes?.at(-1);
  if (!last) return '';
  const index = government.confidenceVotes.length;
  return '<div class="government-vote-summary"><strong>Ultima fiducia · ' + esc(last.date) + '</strong>' + last.votes.map(vote => '<div class="law-vote-result"><strong>' + esc(CHAMBERS[vote.chamber]?.shortLabel || vote.chamber) + '</strong><span>Favorevoli <b>' + whole(vote.yes) + '</b></span><span>Soglia <b>' + whole(vote.needed) + '</b></span>' + (vote.nominalSupport !== vote.yes ? '<span>Defezioni per la crisi <b>' + whole(vote.nominalSupport - vote.yes) + '</b></span>' : '') + '<em>' + (vote.passed ? 'FIDUCIA' : 'NON RAGGIUNTA') + ' · VOTAZIONE SIMULATA</em><button type="button" class="text-link" data-hemi-vote="' + esc(vote.id ?? `fiducia-${index}-${vote.chamber}`) + '" data-hemi-vote-chamber="' + esc(vote.chamber) + '">Vedi i voti nell’emiciclo</button></div>').join('') + '</div>';
}
function governmentStart(parliament, politicians, canEdit, fallen) {
  return '<section class="government-start"><span class="section-kicker">COSTRUISCI LA MAGGIORANZA</span><h2>' + (fallen ? 'Serve un nuovo governo.' : 'Nessun governo è stato formato.') + '</h2><p>Seleziona gruppi in entrambe le Camere, negozia i numeri e poi chiedi la fiducia. Le soglie sono calcolate sullo scenario di questa carriera.</p><div class="coalition-checks">' + groupChecks(parliament, [], politicians) + '</div><button class="primary-button" data-parliament-action="form-government" ' + (!canEdit ? 'disabled' : '') + '>Apri la trattativa ' + icon + '</button></section>';
}
// A Government led by the simulated Prime Minister (the one in office at the start, or any not formed by the player):
// the player can support it, ask for a ministry, withdraw the group's support or open a crisis; the Prime Minister
// answers the allies and asks for confidence by himself.
function referenceGovernmentPanel(parliament, government, extras = {}) {
  const all = groupsFor(parliament);
  const name = id => all.find(group => group.groupId === id)?.officialName ?? id;
  const reference = government.reference;
  const origin = reference
    ? '<p class="government-origin">' + dataMarker(DATA_SOURCES.SIMULATION, 'SIMULAZIONE') + ' Governo trovato in carica all’avvio della carriera: la maggioranza è ricostruita dai gruppi parlamentari dei componenti del governo reale ' + dataMarker(DATA_SOURCES.REAL, 'DATO REALE') + ' «' + esc(reference.label) + '», in carica dal ' + esc(reference.startDate) + (reference.sourceUrl ? ' · <a href="' + esc(reference.sourceUrl) + '" target="_blank" rel="noopener noreferrer">fonte ↗</a>' : '') + '. Da qui in poi è tutto simulato: il Presidente del Consiglio è un ruolo di gioco e i ministri sono incarichi simulati senza nome. Non ne fai parte.</p>'
    : '<p class="government-origin">' + dataMarker(DATA_SOURCES.SIMULATION, 'SIMULAZIONE') + ' Governo guidato da un Presidente del Consiglio simulato: non ne fai parte.</p>';
  const premier = government.premierGroupId ? '<p class="parliament-note">Presidente del Consiglio (ruolo simulato) espresso da ' + esc(name(government.premierGroupId)) + '.</p>' : '';
  const seat = parliament.player;
  if (!seat?.groupId) return origin + premier + '<p class="parliament-note">Senza un seggio in Parlamento segui il governo dall’esterno: le sue scelte pesano sul Paese, sui sondaggi e sulle tue elezioni.</p>';
  if (government.status !== 'active') return origin + premier + '<p class="parliament-note">' + (government.status === 'crisis' ? 'Crisi in corso: il Presidente del Consiglio (simulato) tornerà alle Camere per la fiducia due settimane dopo l’apertura. Fino al ' + whole(government.crisisSeverity) + '% dei voti della maggioranza è a rischio.' : 'Il governo attende la fiducia delle Camere.') + '</p>';
  const inMajority = [...government.coalitionGroupIds, ...government.supportingGroupIds].includes(seat.groupId);
  const secretary = Boolean(extras.secretary);
  const needsSecretary = secretary ? '' : ' disabled title="Le scelte del gruppo sul governo le prende il segretario del partito"';
  const problems = governmentPostProblems(parliament, extras.stats ?? {}, extras.currentDate ?? null);
  const current = activeMinisters(government);
  const portfolioOptions = MINISTERIAL_PORTFOLIOS.map(item => '<option value="' + esc(item) + '">' + esc(item) + (current.some(minister => minister.portfolio === item) ? ' · occupato (serve un rimpasto)' : ' · libero') + '</option>').join('');
  const needs = GOVERNMENT_POST_REQUIREMENTS;
  const post = inMajority ? '<form class="government-post-form" data-government-post-form><div><strong>Chiedi un incarico di governo</strong><small>Decide il Presidente del Consiglio (simulato). Requisiti: influenza ' + needs.influence + ', reputazione ' + needs.reputation + ', esperienza ' + needs.experience + ', sostegno nel gruppo ' + needs.groupSupport + ', almeno ' + needs.mandateWeeks + ' settimane di mandato. Costo: 1 giorno e 6 di capitale politico.</small></div><label>Ministero<select name="portfolio" required><option value="">Scegli un ministero</option>' + portfolioOptions + '</select></label>' + (problems.length ? '<ul class="government-requirements">' + problems.map(item => '<li>' + esc(item) + '</li>').join('') + '</ul>' : '<p class="government-ready">Hai i requisiti: la decisione resta del Presidente del Consiglio.</p>') + '<button class="secondary-button" type="submit"' + (problems.length ? ' disabled' : '') + '>Chiedi il ministero</button></form>' : '';
  const actions = inMajority
    ? '<button class="secondary-button" data-parliament-action="withdraw-support"' + needsSecretary + '>Ritira il sostegno del tuo gruppo</button><button class="secondary-button" data-parliament-action="crisis"' + needsSecretary + '>Apri una crisi di maggioranza</button>'
    : '<button class="primary-button" data-parliament-action="support-government"' + needsSecretary + '>Offri il sostegno del tuo gruppo · 1 giorno · 5 cap.</button><button class="secondary-button" data-parliament-action="crisis"' + needsSecretary + '>Presenta una mozione di sfiducia</button>';
  return origin + premier + post + '<div class="government-actions">' + actions + '</div>' + (secretary ? '' : '<p class="parliament-note">Sostegno, uscita dalla maggioranza e crisi sono decisioni del segretario del partito: da parlamentare puoi chiedere un incarico, votare e trattare sulle leggi.</p>');
}
// After a general election (or a crisis in a legislature of the game) the Government comes from the consultations:
// phases, dates and the majority taking shape; the outgoing Government handles current business.
function formationPanel(parliament, national) {
  const formation = national?.formation;
  if (!formation || formation.phase === 'completata') return '';
  const caretaker = parliament.government?.status === 'caretaker' ? '<p class="parliament-note">' + esc(parliament.government.name) + ' resta in carica per gli affari correnti fino al giuramento del nuovo governo.</p>' : '';
  const steps = (formation.steps ?? []).slice(-5).reverse().map(item => '<li><time>' + esc(item.date) + '</time><span>' + esc(item.text) + '</span></li>').join('');
  const majority = formation.majority ? '<p class="parliament-note">Maggioranza in formazione: <b>' + esc(formation.majority.label ?? 'nuova maggioranza') + '</b>.</p>' : '';
  return '<section class="government-current formation-panel"><div class="home-section-heading"><div><span class="section-kicker">' + (formation.crisis ? 'CRISI DI GOVERNO' : 'DOPO IL VOTO') + ' · ' + esc(FORMATION_LABELS[formation.phase] ?? formation.phase) + '</span><h2>' + (formation.phase === 'fallita' ? 'Camere sciolte' : 'Si forma il nuovo governo') + '</h2></div>' + dataMarker(DATA_SOURCES.SIMULATION) + '</div>' + caretaker + majority + '<ol class="formation-steps">' + steps + '</ol><p class="parliament-note">' + (formation.phase === 'fallita' ? 'Nessuna maggioranza: si torna al voto con le elezioni anticipate.' : 'Consultazioni, incarico e fiducia seguono il calendario: se l’incarico tocca a te arriva in agenda.') + ' <button class="text-link" data-section-tab="elezioni" data-section-tab-value="nazionali">Ciclo nazionale ' + icon + '</button></p></section>';
}
// The life of a Government led by others: programme, reshuffles, new ministers, support gained or refused, verifiche.
const CABINET_EVENTS = ['programma-governo', 'rimpasto', 'nuovo-ministro', 'sostegno-esterno', 'sostegno-negato', 'verifica-maggioranza', 'dimissioni-governo', 'cambio-maggioranza', 'richiesta-alleato', 'richiesta-accolta', 'richiesta-respinta', 'crisi-spontanea', 'crisi-governo', 'fiducia-ottenuta', 'fiducia-negata'];
function cabinetLife(parliament, government) {
  const program = government.program ? '<div class="cabinet-program"><span class="section-kicker">PROGRAMMA</span><strong>' + esc(GOVERNMENT_LINE_LABELS[government.program.line] ?? government.program.line) + '</strong><span>' + (government.program.priorities ?? []).map(id => '<em>' + esc(AREA_BY_ID[id]?.label ?? id) + '</em>').join('') + '</span><small>fissato il ' + esc(government.program.setAt ?? '') + '</small></div>' : '';
  const entries = (parliament.history ?? []).filter(entry => CABINET_EVENTS.includes(entry.type) && (!entry.details?.governmentId || entry.details.governmentId === government.id)).slice(-6).reverse();
  const life = entries.length ? '<ul class="cabinet-life">' + entries.map(entry => '<li class="cabinet-' + esc(entry.type) + '"><time>' + esc(entry.date) + '</time> ' + esc(entry.text) + '</li>').join('') + '</ul>' : '';
  return program || life ? '<div class="cabinet-panel">' + program + (life ? '<span class="section-kicker">VITA DEL GOVERNO</span>' + life : '') + '</div>' : '';
}
function confidenceChoice(parliament, government) {
  const seat = parliament.player;
  if (!seat?.groupId || !['crisis', 'awaiting-confidence'].includes(government.status) || government.primeMinister === 'player' || government.formedBy === 'player') return '';
  const inside = [...government.coalitionGroupIds, ...government.supportingGroupIds].includes(seat.groupId);
  const current = government.pendingPlayerVote ?? 'linea';
  const labels = { linea: 'Con il gruppo (' + (inside ? 'a favore' : 'contro') + ')', favorevole: 'Vota la fiducia', contrario: 'Vota contro', astenuto: 'Astieniti', assente: 'Non partecipare' };
  return '<div class="bill-vote confidence-vote"><span>Il tuo voto sulla fiducia' + (government.status === 'crisis' ? ' (il governo torna alle Camere due settimane dopo l’apertura della crisi)' : '') + '</span><div class="bill-vote-choices" role="group" aria-label="Il tuo voto sulla fiducia">' + Object.entries(labels).map(([id, label]) => '<button type="button" class="chip-button' + (current === id ? ' active' : '') + '" data-confidence-vote="' + id + '" aria-pressed="' + (current === id) + '">' + esc(label) + '</button>').join('') + '</div></div>';
}
function governmentView(parliament, politicians = [], approval = null, extras = {}) {
  const government = parliament.government;
  const open = government && ['active', 'crisis', 'awaiting-confidence'].includes(government.status);
  const led = open && government.primeMinister !== 'player' && government.formedBy !== 'player';
  const all = groupsFor(parliament);
  const seats = chamber => (parliament.chambers[chamber]?.groups ?? []).filter(group => open && government.coalitionGroupIds.includes(group.groupId)).reduce((sum, group) => sum + group.simulatedSeats, 0);
  const supportSeats = chamber => (parliament.chambers[chamber]?.groups ?? []).filter(group => open && government.supportingGroupIds.includes(group.groupId)).reduce((sum, group) => sum + group.simulatedSeats, 0);
  const stats = ['camera', 'senato'].map(chamber => '<span><small>' + CHAMBERS[chamber].shortLabel.toUpperCase() + ' · SEGGI DI COALIZIONE</small><strong>' + whole(seats(chamber)) + (supportSeats(chamber) ? ' <i>+' + whole(supportSeats(chamber)) + ' sostegno</i>' : '') + '</strong><em>maggioranza ' + whole(parliamentGroupFacts(parliament, chamber).majority) + '</em></span>').join('');
  const status = government ? statusNames[government.resigned && government.status === 'fallen' ? 'resigned' : government.status] || government.status : 'Nessun governo nella carriera';
  const canEdit = canManageParliament(parliament);
  const current = activeMinisters(government);
  const ministers = current.map(item => '<div class="minister-line' + (item.playerAppointed ? ' player-minister' : '') + '"><span>' + esc(item.portfolio) + '</span><strong>' + esc(item.playerAppointed ? item.appointeeLabel + ' · ' + item.groupName : item.groupName) + '</strong><small>' + esc(item.playerAppointed ? 'Il tuo incarico di governo · simulato' : item.appointeeLabel) + '</small></div>').join('') || '<p class="quiet-copy">Nessun ministero distribuito nello scenario.</p>';
  const ended = (government?.ministers ?? []).filter(item => item.endedAt);
  const endedLine = ended.length ? '<p class="parliament-note">Incarichi conclusi: ' + ended.map(item => esc(item.portfolio) + ' (' + esc(item.endReason || 'concluso') + ')').join(' · ') + '</p>' : '';
  const supportOptions = all.filter(group => !(government?.coalitionGroupIds ?? []).includes(group.groupId) && !(government?.supportingGroupIds ?? []).includes(group.groupId)).map(group => '<option value="' + esc(group.groupId) + '">' + esc(group.officialName) + ' · ' + CHAMBERS[group.chamber].shortLabel + '</option>').join('');
  const activeControls = open && canEdit && !led ? '<div class="government-actions">' + (government.status === 'crisis' || government.status === 'awaiting-confidence' ? '<button class="primary-button" data-parliament-action="confidence">Vota la fiducia nelle due Camere ' + icon + '</button>' : '<button class="secondary-button" data-parliament-action="crisis">Apri una crisi di maggioranza</button>') + '<label>Coinvolgi un gruppo esterno<select data-government-support-select><option value="">Scegli un gruppo</option>' + supportOptions + '</select></label><button class="secondary-button" data-parliament-action="government-support">Negozia sostegno · 5 cap.</button></div>' : '';
  const portfolioOptions = MINISTERIAL_PORTFOLIOS.filter(portfolio => !current.some(item => item.portfolio === portfolio)).map(item => '<option>' + esc(item) + '</option>').join('');
  const majorityIds = [...(government?.coalitionGroupIds ?? []), ...(government?.supportingGroupIds ?? [])];
  const eligibleMinisters = all.filter(group => majorityIds.includes(group.groupId)).map(group => '<option value="' + esc(group.groupId) + '">' + esc(group.officialName) + '</option>').join('');
  const playerEligible = canEdit && majorityIds.includes(parliament.player.groupId) && !current.some(item => item.playerAppointed);
  const appoint = government && ['active', 'awaiting-confidence'].includes(government.status) && canEdit && !led ? '<form class="minister-form" data-minister-form><label>Ministero<select name="portfolio" required><option value="">Scegli un ministero</option>' + portfolioOptions + '</select></label><label>Assegnatario<select name="appointee"><option value="group">Esponente di un gruppo alleato</option>' + (playerEligible ? '<option value="player">Tu, per il tuo gruppo</option>' : '') + '</select></label><label>Gruppo<select name="groupId"><option value="">Scegli un alleato</option>' + eligibleMinisters + '</select></label><button class="secondary-button" type="submit">Distribuisci incarico</button></form>' : '';
  const position = open && parliament.player?.groupId ? '<p class="parliament-note">' + (majorityIds.includes(parliament.player.groupId) ? (led ? 'Il tuo gruppo sostiene il governo: puoi chiedere un ministero se hai i requisiti.' : 'Il tuo gruppo fa parte della maggioranza: puoi assumere un ministero.') : (led ? 'Il tuo gruppo è all’opposizione: puoi offrire il sostegno o presentare una mozione di sfiducia.' : 'Il tuo gruppo è fuori dalla maggioranza: puoi negoziare sostegni o aprire una crisi.')) + (government.status === 'crisis' ? ' Crisi in corso: fino al ' + whole(government.crisisSeverity) + '% dei voti della maggioranza è a rischio.' : '') + '</p>' : '';
  const currentSection = open ? '<section class="government-current"><div class="home-section-heading"><div><span class="section-kicker">' + (led ? 'GOVERNO IN CARICA · SIMULAZIONE' : 'COALIZIONE SIMULATA') + '</span><h2>' + esc(government.name) + '</h2></div>' + dataMarker(DATA_SOURCES.SIMULATION) + '</div>' + (led ? referenceGovernmentPanel(parliament, government, extras) + confidenceChoice(parliament, government) + cabinetLife(parliament, government) : '') + '<p class="government-members">' + government.coalitionGroupIds.map(id => chipName(all.find(group => group.groupId === id))).filter(Boolean).map(name => '<span>' + esc(name) + '</span>').join('') + government.supportingGroupIds.map(id => chipName(all.find(group => group.groupId === id))).filter(Boolean).map(name => '<span>Sostegno esterno · ' + esc(name) + '</span>').join('') + '</p>' + position + '<div class="minister-list">' + ministers + '</div>' + endedLine + appoint + activeControls + confidenceSummary(government) + (canEdit && !led ? '<details class="coalition-edit"><summary>' + (government.status === 'awaiting-confidence' ? 'Modifica i gruppi proposti' : 'Rinegozia la coalizione') + '</summary><div class="coalition-checks">' + groupChecks(parliament, government.coalitionGroupIds, politicians) + '</div><button class="secondary-button" data-parliament-action="revise-government">Aggiorna la coalizione</button></details>' : '') + '</section>' : '';
  const fallenSection = government?.status === 'fallen' ? '<section class="government-current"><div class="home-section-heading"><div><span class="section-kicker">GOVERNO CADUTO · ' + esc(government.fallenAt || '') + '</span><h2>' + esc(government.name) + '</h2></div>' + dataMarker(DATA_SOURCES.SIMULATION) + '</div>' + endedLine + confidenceSummary(government) + '</section>' : '';
  const approvalLine = approval === null ? '' : '<div class="government-approval"><small>GRADIMENTO NEI SONDAGGI</small><strong>' + String(approval).replace('.', ',') + '%</strong><span>Stabilità ' + whole(government?.stability ?? 0) + '/100</span></div>';
  // During the formation after the vote (or after a crisis) the Government comes from the consultations, not from the player's hand;
  // in a crisis, before the mandate is given, a secretary with a seat can still present a majority of his own.
  const formation = formationPanel(parliament, extras.national);
  const forming = Boolean(formation);
  const ownBid = Boolean(extras.national?.formation?.crisis && ['insediamento', 'consultazioni'].includes(extras.national.formation.phase));
  return '<div class="parliament-mode government-mode"><section class="parliament-mode-hero"><div><span class="section-kicker">PALAZZO CHIGI</span><h2>' + esc(status) + '</h2><p>' + (forming ? 'Il governo nasce dalle consultazioni al Quirinale e dalla fiducia delle Camere: il calendario è nel ciclo nazionale.' : led ? 'Un governo è già in carica: puoi sostenerlo, chiedere di entrarvi, uscire dalla maggioranza o aprire una crisi. Per formarne uno tuo deve prima cadere.' : 'Per entrare in carica la coalizione deve ottenere la fiducia sia alla Camera sia al Senato. Le nomine e le maggioranze sono scenari simulati.') + '</p></div>' + (approvalLine || dataMarker(DATA_SOURCES.SIMULATION, 'GOVERNO DI PARTITA')) + '</section>' + accessNote(parliament) + '<section class="government-majority-strip">' + stats + '</section>' + formation + currentSection + fallenSection + (!open && (!forming || ownBid) ? governmentStart(parliament, politicians, canEdit, government?.status === 'fallen') : '') + timeline(parliament) + '</div>';
}

function lawAction(law, canAct) {
  const actions = {
    proposal: ['present', 'Invia in commissione'],
    commission: ['complete-commission', 'Concludi l’esame'],
    amendments: ['vote', 'Porta al voto'],
    'other-chamber': ['transmit', 'Trasmetti all’altra Camera'],
    'final-vote': ['final-vote', 'Votazione finale']
  };
  const entry = actions[law.stage];
  if (!entry || !canAct) return '';
  return '<button class="primary-button" data-law-action="' + entry[0] + '" data-law-id="' + esc(law.id) + '">' + entry[1] + ' ' + icon + '</button>';
}
function negotiationControls(law, parliament) {
  const options = (parliament.chambers[law.currentChamber]?.groups ?? []).filter(group => group.groupId !== parliament.player?.groupId && !law.negotiatedGroupIds.includes(group.groupId)).map(group => '<option value="' + esc(group.groupId) + '">' + esc(group.officialName) + '</option>').join('');
  const negotiate = '<label>Gruppo da coinvolgere · ' + esc(CHAMBERS[law.currentChamber]?.shortLabel) + '<select data-law-group-select data-law-id="' + esc(law.id) + '"><option value="">Scegli un gruppo</option>' + options + '</select></label><button class="secondary-button" data-law-negotiate data-law-id="' + esc(law.id) + '">Cerca un compromesso · 4 cap.</button>';
  const hint = '<small>Capitale politico: ' + whole(parliament.resources?.politicalCapital) + ' · Il voto è deterministico e usa solo rapporti e impegni simulati.' + (law.stage === 'amendments' ? ' Forzare il voto compatta il tuo schieramento ma irrigidisce gli altri gruppi.' : '') + '</small>';
  if (law.stage === 'final-vote') return '<div class="law-negotiation"><div class="law-negotiation-actions">' + negotiate + '</div>' + hint + '</div>';
  return '<div class="law-negotiation"><form data-law-amend-form data-law-id="' + esc(law.id) + '"><label>Testo emendamento<input name="amendment" maxlength="300" placeholder="Modifica un articolo o aggiungi una garanzia" /></label><button class="secondary-button" type="submit">Aggiungi</button></form><div class="law-negotiation-actions">' + negotiate + '<button class="secondary-button" data-law-compromise data-law-id="' + esc(law.id) + '">Modifica la proposta · 2 cap.</button><button class="text-link" data-law-action="force-vote" data-law-id="' + esc(law.id) + '">Forza il voto</button></div>' + hint + '</div>';
}
function lawCard(law, parliament, society = null, state = null) {
  const canAct = canManageParliament(parliament);
  const chamber = CHAMBERS[law.currentChamber]?.label ?? law.currentChamber;
  const controls = canAct && ['amendments', 'final-vote'].includes(law.stage) ? negotiationControls(law, parliament) : '';
  const votes = (law.votes ?? []).map((vote, index) => { const summary = voteSummary({ ...vote, id: vote.id ?? `${law.id}-voto-${index + 1}` }); return '<div class="law-vote-result"><strong>' + esc(CHAMBERS[vote.chamber]?.shortLabel || vote.chamber) + '</strong><span>Favorevoli <b>' + whole(summary.yes) + '</b></span><span>Contrari <b>' + whole(summary.against) + '</b></span><span>Astenuti <b>' + whole(summary.abstain) + '</b></span><span>Soglia <b>' + whole(vote.needed) + '</b></span><em>' + (vote.passed ? 'APPROVATA' : 'RESPINTA') + (vote.forced ? ' · voto forzato' : '') + (vote.secret ? ' · voto segreto' : '') + ' · VOTAZIONE SIMULATA</em><button type="button" class="text-link" data-hemi-vote="' + esc(vote.id ?? `${law.id}-voto-${index + 1}`) + '" data-hemi-vote-chamber="' + esc(vote.chamber) + '">Vedi i voti nell’emiciclo</button></div>'; }).join('');
  const impact = society?.lawsApplied?.find(item => item.lawId === law.id);
  const segment = id => SEGMENTS.find(item => item.id === id)?.label.toLowerCase() ?? id;
  // Before the vote: what the law would cost and change. After: how far it has come into force.
  const open = !['approved', 'rejected', 'lapsed'].includes(law.stage);
  const projection = open && society && law.kind !== 'manovra' ? projectLaw(society, { category: law.category, compromiseLevel: law.compromiseLevel ?? 0, policy: law.policy?.area ? { ...law.policy, compromise: law.compromiseLevel ?? 0 } : null }) : null;
  const remaining = law.stage === 'approved' && society ? Math.max(0, ...society.effects.filter(effect => effect.cause === law.title).map(effect => effect.remaining)) : 0;
  const forecast = projection ? '<div class="law-forecast"><span class="section-kicker">IMPATTO PREVISTO · SIMULAZIONE</span><div><span>' + glyph('money', 14) + ' Costo: ' + String(projection.cost).replace('.', ',') + ' punti di margine (disponibili ' + Math.round(society.publicFinance.headroom) + ')' + (projection.covered ? '' : ' · <b>senza coperture</b>: effetti ridotti e più deficit') + '</span><span>' + glyph('users', 14) + ' Soddisfazione dei cittadini a regime ' + (projection.satisfactionDelta >= 0 ? '+' : '−') + String(Math.abs(projection.satisfactionDelta)).replace('.', ',') + '</span><span>' + glyph('map', 14) + ' Più benefici in ' + projection.topRegions.map(item => esc(item.name)).join(', ') + '</span>' + (projection.pleased.length || projection.displeased.length ? '<span>' + glyph('megaphone', 14) + ' ' + (projection.pleased.length ? 'Favorevoli: ' + projection.pleased.map(segment).join(', ') : '') + (projection.displeased.length ? (projection.pleased.length ? ' · ' : '') + 'Contrari: ' + projection.displeased.map(segment).join(', ') : '') + '</span>' : '') + '</div></div>' : '';
  const people = list => list.map(item => esc(item.fullName) + (item.groupName ? ' (' + esc(item.groupName) + ')' : '')).join(', ');
  const links = [
    law.realReference ? '<span class="law-link-real">' + glyph('link', 13) + ' Collegata all’atto reale: ' + esc(law.realReference.label) + (law.realReference.sourceUrl ? ' · <a href="' + esc(law.realReference.sourceUrl) + '" target="_blank" rel="noopener noreferrer">fonte ↗</a>' : '') + '</span>' : '',
    law.cosigners?.length ? '<span>' + glyph('users', 13) + ' Firme di parlamentari reali (iniziativa simulata): ' + people(law.cosigners) + '</span>' : '',
    law.contactSupport?.length ? '<span>' + glyph('link', 13) + ' Sostegno in Aula (simulato) da: ' + people(law.contactSupport) + '</span>' : '',
    impact ? '<span class="law-impact ' + (impact.covered ? 'good' : 'bad') + '">' + glyph('map', 13) + ' Effetti sul Paese: ' + (impact.covered ? 'coperture trovate' : 'coperture insufficienti, effetti ridotti') + ' · più visibili in ' + impact.topRegions.map(item => esc(item.name)).join(', ') + ' · ' + (remaining ? 'in attuazione, ancora ' + remaining + (remaining === 1 ? ' settimana' : ' settimane') : 'pienamente in vigore') + '</span>' : ''
  ].filter(Boolean).join('');
  return '<article class="law-card stage-' + esc(law.stage) + '"><header>' + artTile(LAW_ICONS[law.category] ?? 'law', law.stage === 'approved' ? '#1baf7a' : law.stage === 'rejected' || law.stage === 'lapsed' ? '#e34948' : '#2a78d6') + '<div class="law-card-title"><span class="section-kicker">' + esc(law.category.toUpperCase()) + ' · ' + esc(chamber) + '</span><h3>' + esc(law.title) + '</h3></div>' + dataMarker(DATA_SOURCES.SIMULATION, statusNames[law.stage] || law.stage) + '</header><p>' + esc(law.summary) + '</p>' + (state ? lawContent(law, parliament, state) : '') + '<div class="law-amendment-list">' + (law.amendments ?? []).map(item => '<span>Emendamento simulato · ' + esc(item.text) + '</span>').join('') + (law.negotiatedGroupIds?.length ? '<span>Gruppi coinvolti nella trattativa: ' + whole(law.negotiatedGroupIds.length) + '</span>' : '') + '</div>' + forecast + (links ? '<div class="law-links">' + links + '</div>' : '') + '<div class="law-actions">' + lawAction(law, canAct) + '</div>' + controls + votes + '<small class="law-updated">Ultimo passaggio: ' + esc(law.updatedAt || law.introducedAt) + (law.stage === 'lapsed' ? ' · decaduta con la fine del mandato' : '') + '</small></article>';
}
// ---------- the bills of the Government, of the groups and of the committees (lawmaking-engine) ----------
const BILL_FILTERS = [['tutte', 'Tutte'], ['governo', 'Governo'], ['maggioranza', 'Maggioranza'], ['opposizione', 'Opposizione'], ['commissione', 'Commissioni'], ['aula', 'Al voto nella tua Camera'], ['concluse', 'Concluse']];
const BILL_STEPS = [['proposal', 'Presentata'], ['commission', 'In commissione'], ['amendments', 'Emendamenti e Aula'], ['other-chamber', 'Verso l’altra Camera'], ['final-vote', 'Voto finale']];
const CLOSED_STAGES = ['approved', 'rejected', 'lapsed'];
const LINE_LABELS = { favorevole: 'Favorevole', contrario: 'Contrario', astenuto: 'Astensione' };
const SEGMENT_OPTIONS = [['giovani', 'i giovani'], ['famiglie', 'le famiglie'], ['anziani', 'i pensionati'], ['imprese', 'le imprese'], ['fragili', 'i redditi bassi']];
// Majority or opposition as it is now for an open bill (a change of majority changes it), as it was for a closed one.
function billSide(law, governing) {
  if (['governo', 'commissione'].includes(law.sponsor?.kind)) return law.sponsor.kind;
  if (CLOSED_STAGES.includes(law.stage)) return law.sponsor?.kind ?? 'opposizione';
  return governing.has(law.sponsor?.groupId) ? 'maggioranza' : 'opposizione';
}
function billMatches(law, filter, parliament, governing) {
  const open = !CLOSED_STAGES.includes(law.stage);
  if (filter === 'concluse') return !open;
  if (filter === 'aula') return open && law.currentChamber === parliament.player?.chamber && ['amendments', 'final-vote'].includes(law.stage);
  if (filter === 'tutte') return true;
  return open && billSide(law, governing) === filter;
}
function billSteps(law) {
  const index = BILL_STEPS.findIndex(([id]) => id === law.stage);
  const closed = CLOSED_STAGES.includes(law.stage);
  const outcome = law.stage === 'approved' ? 'Approvata' : law.status === 'arenata' ? 'Ferma in commissione' : law.stage === 'lapsed' ? 'Decaduta' : law.stage === 'rejected' ? 'Respinta' : null;
  return '<ol class="bill-steps">' + BILL_STEPS.map(([id, label], position) => '<li class="' + (closed || position < index ? 'done' : position === index ? 'current' : '') + '">' + esc(label) + '</li>').join('') + (outcome ? '<li class="outcome ' + (law.stage === 'approved' ? 'good' : 'bad') + '">' + esc(outcome) + '</li>' : '') + '</ol>';
}
function billForecast(law, parliament, world) {
  if (CLOSED_STAGES.includes(law.stage) || law.stage === 'proposal') return '';
  const forecast = forecastVote(parliament, law, { world });
  const groups = parliament.chambers[law.currentChamber]?.groups ?? [];
  // Short names: the force of the world behind the group when it is known, otherwise the group's own name.
  const nameOf = id => { const group = groups.find(item => item.groupId === id); const party = group?.partyId ? world?.parties?.find(item => item.id === group.partyId) : null; const name = party && !/^misto/i.test(group.officialName ?? '') ? party.label : group?.officialName ?? id; return name.length > 34 ? name.slice(0, 32) + '…' : name; };
  const width = forecast.total ? Math.round(forecast.yes / forecast.total * 100) : 0;
  const mark = forecast.total ? Math.round(forecast.needed / forecast.total * 100) : 50;
  const positions = [...forecast.positions].sort((a, b) => b.seats - a.seats).map(item => '<span class="bill-pos pos-' + item.line + (item.groupId === parliament.player?.groupId ? ' own' : '') + '" title="' + esc(LINE_LABELS[item.line]) + ' · sostegno stimato ' + Math.round(item.support * 100) + '%">' + esc(nameOf(item.groupId)) + ' <b>' + whole(item.seats) + '</b>' + (item.groupId === parliament.player?.groupId ? ' · il tuo gruppo' : '') + '</span>').join('');
  return '<div class="bill-forecast"><div class="bill-forecast-head"><span class="section-kicker">PREVISIONE IN AULA · ' + esc(CHAMBERS[law.currentChamber]?.shortLabel.toUpperCase()) + '</span><strong class="' + (forecast.passes ? 'good' : 'bad') + '">' + (forecast.passes ? 'Passerebbe' : 'Verrebbe respinta') + ' · circa ' + whole(forecast.yes) + ' sì, ne servono ' + whole(forecast.needed) + '</strong></div><div class="bill-meter" role="img" aria-label="Voti favorevoli stimati ' + whole(forecast.yes) + ' su ' + whole(forecast.total) + ', soglia ' + whole(forecast.needed) + '"><i style="width:' + width + '%"></i><b style="left:' + mark + '%"></b></div><div class="bill-positions">' + positions + '</div><small><i class="bill-key pos-favorevole"></i> a favore <i class="bill-key pos-contrario"></i> contro <i class="bill-key pos-astenuto"></i> astensione · posizioni stimate dei gruppi: il voto vero può cambiare con emendamenti, trattative, fiducia e dissensi individuali.</small></div>';
}
function billAmendments(law) {
  const policy = law.policy ?? {};
  const options = [];
  if ((policy.intensity ?? 2) > 1) options.push(['intensity:' + ((policy.intensity ?? 2) - 1), 'Riduci la portata della misura']);
  if ((policy.intensity ?? 2) < 3) options.push(['intensity:' + ((policy.intensity ?? 2) + 1), 'Aumenta la portata della misura']);
  for (const [id, item] of Object.entries(FINANCING)) if (id !== policy.financing && (id !== 'ue' || AREA_BY_ID[policy.area]?.euFunds)) options.push(['financing:' + id, 'Copertura: ' + item.label.toLowerCase()]);
  for (const [id, label] of SEGMENT_OPTIONS) if (policy.segment !== id) options.push(['segment:' + id, 'Più attenzione per ' + label]);
  return options;
}
function billActions(law, parliament, extras) {
  const seat = parliament.player;
  if (!canManageParliament(parliament) || CLOSED_STAGES.includes(law.stage)) return '';
  if (law.currentChamber !== seat.chamber) return '<p class="parliament-note">Ora la esamina ' + (law.currentChamber === 'camera' ? 'la Camera' : 'il Senato') + ': potrai intervenire e votare quando arriva nella tua Camera.</p>';
  const speak = ['favorevole', 'contrario'].map(stance => '<button class="secondary-button" data-bill-speak="' + stance + '" data-law-id="' + esc(law.id) + '"' + (law.playerStance === stance ? ' disabled' : '') + '>' + (stance === 'favorevole' ? 'Intervieni a favore' : 'Intervieni contro') + ' · 1 giorno</button>').join('');
  const oddsOf = offerVote => amendmentOdds(parliament, law, { influence: extras.influence ?? 50, committeeRole: Boolean(parliament.careerStanding?.committeeRole), offerVote });
  const open = law.kind !== 'manovra' && ['commission', 'amendments'].includes(law.stage);
  const deal = law.sponsor?.groupId !== seat.groupId && !law.playerDeal ? '<label class="bill-deal"><input type="checkbox" name="deal" value="1" /> Offri il tuo voto favorevole in cambio (probabilità ' + Math.round(oddsOf(true) * 100) + '%): se poi non lo rispetti, il proponente non lo dimentica</label>' : '';
  const amend = open ? (law.confidence ? '<p class="parliament-note">Sul testo c’è la fiducia: niente più emendamenti.</p>' : '<form class="bill-amend" data-bill-amend-form data-law-id="' + esc(law.id) + '"><label>Il tuo emendamento<select name="patch">' + billAmendments(law).map(([value, label]) => '<option value="' + esc(value) + '">' + esc(label) + '</option>').join('') + '</select></label><button class="secondary-button" type="submit">Presenta · 1 giorno · ' + AMENDMENT_CAPITAL_COST + ' cap. · probabilità ' + Math.round(oddsOf(false) * 100) + '%</button>' + deal + '</form>') : '';
  const voting = ['commission', 'amendments', 'final-vote'].includes(law.stage) ? '<div class="bill-vote"><span>Il tuo voto quando arriva in Aula</span><div class="bill-vote-choices" role="group" aria-label="Il tuo voto">' + Object.entries(PLAYER_VOTE_CHOICES).map(([id, label]) => '<button type="button" class="chip-button' + ((law.pendingPlayerVote ?? 'linea') === id ? ' active' : '') + '" data-bill-vote="' + id + '" data-law-id="' + esc(law.id) + '" aria-pressed="' + ((law.pendingPlayerVote ?? 'linea') === id) + '">' + esc(label) + '</button>').join('') + '</div></div>' : '';
  return '<div class="bill-actions"><div class="bill-speak">' + speak + '</div>' + amend + voting + '</div>';
}
function billCard(law, parliament, extras = {}) {
  const governing = extras.governing ?? governingGroupIds(parliament);
  const side = billSide(law, governing);
  const committee = (extras.committees ?? []).find(item => item.id === law.committeeId);
  const chamber = CHAMBERS[law.currentChamber]?.shortLabel ?? law.currentChamber;
  const kindLabel = law.kind === 'decreto' ? 'Decreto-legge' : law.kind === 'manovra' ? 'Legge di bilancio' : 'Disegno di legge';
  const open = !CLOSED_STAGES.includes(law.stage);
  const next = open && law.nextStepAt ? '<span>' + glyph('clock', 13) + ' Prossimo passaggio: ' + esc(law.nextStepAt) + '</span>' : '';
  const decree = law.kind === 'decreto' && open ? '<span class="bill-flag warn">In vigore · va convertito entro il ' + esc(law.deadline ?? '') + '</span>' : '';
  const confidence = law.confidence && open ? '<span class="bill-flag bad">Fiducia posta dal governo</span>' : '';
  const stance = (law.playerStance ? '<span class="bill-flag">Sei intervenuto ' + (law.playerStance === 'favorevole' ? 'a favore' : 'contro') + '</span>' : '') + (law.playerDeal ? '<span class="bill-flag warn">Accordo: hai promesso il voto favorevole</span>' : '');
  const amendments = (law.playerAmendments ?? []).map(item => '<span class="bill-flag ' + (item.accepted ? 'good' : 'bad') + '">Tuo emendamento ' + (item.accepted ? 'approvato' : 'respinto') + '</span>').join('');
  const votes = (law.votes ?? []).map((vote, index) => { const summary = voteSummary({ ...vote, id: vote.id ?? law.id + '-voto-' + (index + 1) }); const mine = vote.playerChoice ? '<span>Il tuo voto <b>' + esc(PLAYER_VOTE_CHOICES[vote.playerChoice] ?? vote.playerChoice) + '</b></span>' : ''; return '<div class="law-vote-result"><strong>' + esc(CHAMBERS[vote.chamber]?.shortLabel || vote.chamber) + ' · ' + esc(vote.date ?? '') + '</strong><span>Favorevoli <b>' + whole(summary.yes) + '</b></span><span>Contrari <b>' + whole(summary.against) + '</b></span><span>Astenuti <b>' + whole(summary.abstain) + '</b></span><span>Soglia <b>' + whole(summary.needed) + '</b></span>' + (summary.dissent ? '<span>Voti in dissenso <b>' + whole(summary.dissent) + '</b></span>' : '') + mine + '<em>' + (summary.passed ? 'Approvata' : 'Respinta') + '</em><button class="text-link" data-hemi-vote="' + esc(summary.id) + '" data-hemi-vote-chamber="' + esc(vote.chamber) + '">Vedi nell’emiciclo</button></div>'; }).join('');
  const journal = (law.journal ?? []).slice(-3).reverse().map(item => '<li><time>' + esc(item.date) + '</time> ' + esc(item.text) + '</li>').join('');
  const impact = extras.society?.lawsApplied?.find(item => item.lawId === law.id);
  return '<article class="law-card bill-card stage-' + esc(law.stage) + ' side-' + esc(side) + '"><header>' + artTile(LAW_ICONS[law.category] ?? 'law', side === 'governo' ? '#2a78d6' : side === 'maggioranza' ? '#1baf7a' : side === 'opposizione' ? '#e3a348' : '#8f7ad6') + '<div class="law-card-title"><span class="section-kicker">' + esc(kindLabel.toUpperCase()) + ' · ' + esc(law.category.toUpperCase()) + ' · ' + esc(chamber.toUpperCase()) + '</span><h3>' + esc(law.title) + '</h3><span class="bill-sponsor"><b class="sponsor-' + esc(side) + '">' + esc(LAW_SPONSORS[side]?.label ?? side) + '</b> ' + esc(side === 'governo' ? 'Consiglio dei ministri (simulato)' : law.sponsor?.label ?? '') + '</span></div>' + dataMarker(DATA_SOURCES.SIMULATION, statusNames[law.stage] || law.stage) + '</header><p>' + esc(law.summary) + '</p>' + billSteps(law) + '<div class="bill-meta">' + (committee ? '<span>' + glyph('users', 13) + ' ' + esc(committee.number) + ' Commissione · ' + esc(committee.shortName ?? committee.name) + ' <small>(reale)</small></span>' : '') + next + decree + confidence + stance + amendments + '</div>' + billForecast(law, parliament, extras.world) + billActions(law, parliament, extras) + (journal ? '<ul class="bill-journal">' + journal + '</ul>' : '') + (impact ? '<p class="law-impact ' + (impact.covered ? 'good' : 'bad') + '">' + glyph('map', 13) + ' Effetti sul Paese: ' + (impact.covered ? 'coperture trovate' : 'coperture insufficienti') + (impact.topRegions?.length ? ' · più visibili in ' + impact.topRegions.map(item => esc(item.name)).join(', ') : '') + '</p>' : '') + votes + '</article>';
}
function billsBoard(parliament, extras = {}) {
  const governing = governingGroupIds(parliament);
  const bills = (parliament.laws ?? []).filter(law => law.auto);
  if (!bills.length && !(parliament.lawArchive ?? []).length) return '<section class="law-board bill-board"><div class="home-section-heading"><div><span class="section-kicker">IN PARLAMENTO · SIMULAZIONE</span><h2>Le proposte degli altri</h2></div></div><p class="quiet-copy">Governo, gruppi e commissioni presentano le loro proposte settimana dopo settimana: le troverai qui.</p></section>';
  const filter = BILL_FILTERS.some(([id]) => id === extras.filter) ? extras.filter : 'tutte';
  const open = bills.filter(law => !CLOSED_STAGES.includes(law.stage));
  const counts = Object.fromEntries(BILL_FILTERS.map(([id]) => [id, bills.filter(law => billMatches(law, id, parliament, governing)).length]));
  const shown = bills.filter(law => billMatches(law, filter, parliament, governing)).sort((a, b) => Number(CLOSED_STAGES.includes(a.stage)) - Number(CLOSED_STAGES.includes(b.stage)) || String(a.nextStepAt ?? '9999').localeCompare(String(b.nextStepAt ?? '9999')) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const year = String(extras.currentDate ?? '').slice(0, 4);
  const approvedYear = [...bills, ...(parliament.lawArchive ?? [])].filter(law => law.stage === 'approved' && String(law.updatedAt ?? law.closedAt ?? '').startsWith(year)).length;
  const toVote = open.filter(law => law.currentChamber === parliament.player?.chamber && ['amendments', 'final-vote'].includes(law.stage)).length;
  const filters = '<div class="ag-filters bill-filters" role="group" aria-label="Filtra le proposte">' + BILL_FILTERS.filter(([id]) => id !== 'aula' || parliament.player?.groupId).map(([id, label]) => '<button type="button" data-view-filter="leggi" data-view-filter-value="' + id + '" class="' + (filter === id ? 'active' : '') + '" aria-pressed="' + (filter === id) + '">' + esc(label) + (counts[id] ? ' · ' + counts[id] : '') + '</button>').join('') + '</div>';
  const archive = (parliament.lawArchive ?? []).slice(0, 8).map(item => '<li><span class="bill-flag ' + (item.stage === 'approved' ? 'good' : 'bad') + '">' + esc(item.stage === 'approved' ? 'Approvata' : item.status === 'arenata' ? 'Ferma' : item.stage === 'lapsed' ? 'Decaduta' : 'Respinta') + '</span> ' + esc(item.title) + ' <small>' + esc(item.sponsor?.kind === 'governo' ? 'Governo' : item.sponsor?.label ?? '') + ' · ' + esc(item.closedAt ?? '') + '</small></li>').join('');
  return '<section class="law-board bill-board"><div class="home-section-heading"><div><span class="section-kicker">IN PARLAMENTO · SIMULAZIONE</span><h2>Le proposte di governo, gruppi e commissioni</h2></div><span>' + whole(open.length) + ' in discussione · ' + whole(approvedYear) + ' approvate nel ' + esc(year) + (toVote ? ' · ' + whole(toVote) + ' al voto nella tua Camera' : '') + '</span></div><p class="parliament-note">Ogni settimana il governo, i gruppi di maggioranza e di opposizione e le commissioni presentano e portano avanti le loro proposte. ' + (canManageParliament(parliament) ? 'Puoi intervenire, presentare emendamenti e decidere il tuo voto: votare contro la linea del gruppo si nota.' : 'Senza un seggio le segui dall’esterno: le leggi approvate cambiano il Paese e i sondaggi.') + '</p>' + filters + (shown.map(law => billCard(law, parliament, { ...extras, governing })).join('') || '<p class="quiet-copy">Nessuna proposta in questo filtro.</p>') + (archive ? '<details class="bill-archive"><summary>Archivio delle proposte concluse</summary><ul>' + archive + '</ul></details>' : '') + '</section>';
}
function lawsView(parliament, extras = {}) {
  const playerCanAct = canManageParliament(parliament);
  const proposals = [...(parliament.laws ?? [])].filter(law => !law.auto).reverse().map(law => lawCard(law, parliament, extras.society, extras.state)).join('');
  const form = '<form class="law-proposal-form" data-law-proposal-form><div class="law-proposal-heading"><div><span class="section-kicker">NUOVA INIZIATIVA</span><h2>Scrivi una proposta.</h2></div>' + dataMarker(DATA_SOURCES.SIMULATION, 'PROPOSTA DEL GIOCATORE') + '</div><div class="law-form-grid"><label>Titolo<input name="title" required minlength="5" maxlength="90" placeholder="Dai un nome alla proposta" /></label><div class="law-policy-field">' + policyFields({ area: 'sanita' }) + '</div><div class="law-policy-preview" data-policy-preview>' + (extras.society ? policyPreview(extras.society, measureDesign({ area: 'sanita' })) : '') + '</div><label class="law-summary-field">Contenuto<textarea name="summary" required minlength="12" maxlength="800" rows="3" placeholder="Quale cambiamento vuoi introdurre?"></textarea></label><input type="hidden" name="realReference" value="" /><p class="law-real-draft" data-law-real-draft hidden></p></div><button class="primary-button" type="submit" ' + (!playerCanAct ? 'disabled' : '') + '>Presenta la legge ' + icon + '</button><p>Le proposte attraversano commissione, emendamenti, prima votazione, seconda Camera e voto finale. Ogni esito è source: simulation.</p></form>';
  return '<div class="parliament-mode laws-mode"><section class="parliament-mode-hero"><div><span class="section-kicker">ITER LEGISLATIVO</span><h2>Una proposta alla volta.</h2><p>Governo, maggioranza, opposizione e commissioni legiferano ogni settimana. Le tue proposte le porti avanti tu: costruisci consenso, negozia e scegli quando portarle al voto.</p></div>' + dataMarker(DATA_SOURCES.SIMULATION, 'LEGISLAZIONE DELLA PARTITA') + '</section>' + accessNote(parliament) + form + '<section class="law-board"><div class="home-section-heading"><div><span class="section-kicker">LE TUE INIZIATIVE</span><h2>Proposte e votazioni</h2></div><span>' + (parliament.laws ?? []).filter(law => !law.auto).length + ' iniziative</span></div>' + (proposals || '<p class="quiet-copy">Non hai ancora presentato una proposta.</p>') + '</section>' + billsBoard(parliament, extras) + (extras.realLaws ? '<section class="law-board real-law-board"><div class="home-section-heading"><div><span class="section-kicker">XIX LEGISLATURA · DATI REALI VERIFICATI</span><h2>Leggi e disegni di legge reali</h2></div></div>' + extras.realLaws + '</section>' : '') + timeline(parliament) + '</div>';
}

export function renderParliamentPage(page, state, options = {}) {
  const parliament = state.parliament;
  if (!parliament) {
    const error = options.status?.error;
    return '<section class="parliament-empty"><span class="section-kicker">DATI ISTITUZIONALI</span><h2>' + (error ? 'Camere e gruppi non disponibili.' : 'Carico le Camere e i gruppi…') + '</h2><p>' + esc(error || 'La schermata usa i gruppi parlamentari verificati nel database locale del gioco.') + '</p><button class="secondary-button" data-action="retry-parliament">Riprova a caricare i gruppi</button></section>';
  }
  const days = state.game && parliament.player ? `<div class="parliament-access-note parliament-time-note">Ogni azione in Aula usa 1 giorno della settimana: ne restano <b>${state.game.week.ap}</b> su ${state.game.week.maxAp}. Capitale politico <b>${whole(parliament.resources?.politicalCapital)}</b>.</div>` : '';
  if (page === 'governo') {
    const stats = Object.fromEntries((state.dataset?.statistics ?? []).filter(item => item.subjectId === state.career?.playerId).map(item => [item.metric, item.value]));
    return days + governmentDesk(state) + governmentView(parliament, options.politicians ?? [], state.world?.polls?.at(-1)?.government?.approval ?? null, { stats, secretary: options.secretary, currentDate: state.clock?.currentDate, national: state.national ?? null });
  }
  if (page === 'leggi') {
    const influence = (state.dataset?.statistics ?? []).find(item => item.subjectId === state.career?.playerId && item.metric === 'influence')?.value ?? 50;
    return days + lawsView(parliament, { society: state.society, realLaws: options.realLaws, state, world: state.world, filter: options.lawFilter, committees: options.committees ?? [], currentDate: state.clock?.currentDate, influence });
  }
  const player = options.player ?? state.dataset?.politicians?.find(item => item.id === state.career?.playerId) ?? null;
  const odds = state.game ? careerOverview(state)?.tracks.find(track => track.id === 'parlamento')?.odds ?? null : null;
  return days + (options.hemicycle ?? '') + renderParliament(parliament, options.party, options.politicians ?? [], player, state.clock?.currentDate ?? parliament.createdAt, odds);
}
