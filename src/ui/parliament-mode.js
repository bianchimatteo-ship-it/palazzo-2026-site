import { activeMinisters, canManageParliament, CHAMBERS, CONTEST_COST, CONTEST_WINDOW_DAYS, LAW_CATEGORIES, MINISTERIAL_PORTFOLIOS, nextParliamentaryRole, parliamentGroupFacts, playerInMajority } from '../core/parliament-engine.js?v=20260924-8';
import { DATA_SOURCES } from '../data/schema.js?v=20260924-8';
import { artTile, glyph, LAW_ICONS } from './visuals.js?v=20260924-8';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const whole = value => new Intl.NumberFormat('it-IT').format(value ?? 0);
const statusNames = { proposal: 'Proposta', commission: 'Commissione', amendments: 'Emendamenti', 'other-chamber': 'Altra Camera', 'final-vote': 'Votazione finale', approved: 'Approvata', rejected: 'Respinta', lapsed: 'Decaduta', active: 'In carica', crisis: 'Crisi aperta', fallen: 'Fiducia negata', 'awaiting-confidence': 'In attesa della fiducia' };
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
    const reference = group.reference.memberCount === null ? 'Consistenza di riferimento non disponibile' : whole(group.reference.memberCount) + ' componenti nel dato reale · ' + esc(group.reference.countAsOf || 'data non disponibile');
    return '<div class="parliament-group-row ' + (selected ? 'player-group' : '') + '"><div class="parliament-group-main"><span class="group-order">' + String(index + 1).padStart(2, '0') + '</span><div class="parliament-group-name"><strong>' + esc(group.officialName) + (selected ? '<em>Il tuo gruppo nello scenario</em>' : '') + (position ? '<em class="group-position">' + esc(position) + '</em>' : '') + '</strong><small>' + reference + (leaderLabel ? ' · ' + esc(leaderLabel) : '') + '</small></div><b class="parliament-sim-seat">' + whole(group.simulatedSeats) + '<small>scenario</small></b></div><div class="parliament-seat-track"><i style="width:' + pct + '%"></i></div><div class="parliament-group-meta"><span>' + (selected ? 'Il tuo gruppo' : 'Rapporto simulato con il tuo gruppo <b>' + relation + ' / 100</b>') + '</span>' + groupSource(group) + '</div></div>';
  }).join('');
  return '<section class="chamber-panel"><header class="chamber-panel-head"><div><span class="section-kicker">COMPOSIZIONE · ' + esc(kind.shortLabel.toUpperCase()) + '</span><h2>' + esc(kind.label) + '</h2></div>' + dataMarker(DATA_SOURCES.SIMULATION, 'SCENARIO · RIFERIMENTO REALE A LATO') + '</header><div class="chamber-totals"><span><small>SEGGI NELLO SCENARIO</small><strong>' + whole(facts.total) + '</strong></span><span><small>SOGLIA DI MAGGIORANZA</small><strong>' + whole(facts.majority) + '</strong></span></div><div class="parliament-group-list">' + (rows || '<p class="quiet-copy">I gruppi di questa Camera non sono disponibili.</p>') + '</div><p class="parliament-note">I numeri grandi e i rapporti sono della partita, source: simulation. Composizione reale di riferimento, data, capigruppo documentati e fonti sono distinti per ogni gruppo.</p></section>';
}
function groupChoices(parliament) {
  return (parliament.chambers[parliament.player.chamber]?.groups ?? []).filter(group => group.groupId !== parliament.player.groupId).map(group => '<label class="parliament-choice"><input type="radio" name="player-parliament-group" value="' + esc(group.groupId) + '" /><span><strong>' + esc(group.officialName) + '</strong><small>' + (group.reference.memberCount === null ? 'Consistenza reale non disponibile' : whole(group.reference.memberCount) + ' componenti nel dato reale') + ' · scelta simulata</small></span>' + groupSource(group) + '</label>').join('');
}
function playerGroupSelector(parliament) {
  if (!parliament.player) return '';
  if (!parliament.player.groupId) return '<section class="parliament-callout"><span class="section-kicker">IL TUO GRUPPO</span><h3>Scegli il gruppo di riferimento</h3><p>Il mandato è simulato e il gruppo non viene dedotto dal partito. Scegli a quale contesto collegare il personaggio.</p><div class="parliament-choice-list">' + groupChoices(parliament) + '</div><button class="primary-button" data-parliament-action="join-group">Conferma il gruppo ' + icon + '</button></section>';
  return '<details class="coalition-edit parliament-group-change"><summary>Cambia gruppo parlamentare</summary><p class="parliament-note">Lasciare il gruppo costa reputazione e interrompe gli incarichi ottenuti al suo interno.</p><div class="parliament-choice-list">' + groupChoices(parliament) + '</div><button class="secondary-button" data-parliament-action="join-group">Passa al gruppo selezionato</button></details>';
}
function rolePanel(parliament, currentDate) {
  const standing = parliament.careerStanding;
  if (!parliament.player || !standing) return '';
  const canAct = canManageParliament(parliament);
  const next = nextParliamentaryRole(parliament);
  const wait = standing.lastContestAt ? Math.max(0, CONTEST_WINDOW_DAYS - daysBetween(standing.lastContestAt, currentDate)) : 0;
  const capital = parliament.resources?.politicalCapital ?? 0;
  const blocker = !canAct ? 'Scegli prima un gruppo.' : !next ? 'Hai raggiunto l’incarico più alto previsto.' : wait ? `Nuovo tentativo tra ${wait} giorni.` : capital < CONTEST_COST ? `Servono ${CONTEST_COST} punti di capitale politico.` : '';
  const roles = (standing.roles ?? []).map(role => '<span>' + esc(role.title) + ' · dal ' + esc(role.appointedAt) + (role.endedAt ? ' al ' + esc(role.endedAt) : ' · in corso') + '</span>').join('');
  const last = standing.lastContest ? '<small>Ultima competizione: ' + esc(standing.lastContest.roleTitle || 'incarico') + ' · punteggio ' + whole(standing.lastContest.score) + ' su soglia ' + whole(standing.lastContest.threshold) + ' · ' + (standing.lastContest.result === 'success' ? 'vinta' : 'non vinta') + '</small>' : '';
  return '<section class="parliament-role-panel"><div><span class="section-kicker">INCARICHI PARLAMENTARI</span><h3>' + esc(standing.committeeRole?.title || 'Nessun incarico interno') + '</h3><p>Sostegno nel gruppo <b>' + whole(standing.partySupport) + ' / 100</b>' + (next ? ' · Prossimo obiettivo: <b>' + esc(next.title) + '</b> (soglia ' + whole(standing.competitionStrength ?? next.threshold) + ')' : '') + '</p>' + last + (roles ? '<div class="parliament-role-list">' + roles + '</div>' : '') + '</div><div class="parliament-role-action"><button class="secondary-button" data-parliament-action="contest-role" ' + (blocker ? 'disabled' : '') + '>Candidati all’incarico</button><small>' + esc(blocker || `Costo ${CONTEST_COST} di capitale politico. Contano influenza, reputazione, esperienza e sostegno nel gruppo.`) + '</small></div></section>';
}
function timeline(parliament) {
  const entries = [...(parliament.history ?? [])].slice(-6).reverse();
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

function renderParliament(parliament, party, politicians, player, currentDate) {
  const seat = parliament.player;
  const currentGroup = seat?.groupId ? groupsFor(parliament).find(group => group.groupId === seat.groupId) : null;
  const roleText = seat ? CHAMBERS[seat.chamber].label : 'Nessun incarico parlamentare nella carriera';
  const majorityLabel = seat?.groupId && ['active', 'crisis'].includes(parliament.government?.status) ? (playerInMajority(parliament) ? 'Il tuo gruppo sostiene il governo' : 'Il tuo gruppo è all’opposizione') : '';
  return '<div class="parliament-mode"><section class="parliament-mode-hero"><div><span class="section-kicker">POLITICA IN AULA</span><h2>Due Camere, una partita.</h2><p>Composizione reale usata come riferimento; maggioranze, posizione del giocatore e conseguenze appartengono al salvataggio simulato.</p></div><div class="parliament-player"><span class="player-avatar">' + initials(player) + '</span><span><small>' + esc(roleText) + '</small><strong>' + esc(seat ? currentGroup?.officialName || 'Gruppo da scegliere' : 'Osservatore') + '</strong></span></div></section>' + playerParty(party) + (seat && !seat.groupId ? playerGroupSelector(parliament) : '') + (seat ? '<section class="parliament-status-line">' + dataMarker(DATA_SOURCES.SIMULATION, 'RUOLO DI GIOCO') + '<span>' + esc(seat.position) + '</span><span>Capitale politico <b>' + whole(parliament.resources?.politicalCapital) + ' / 100</b></span>' + (majorityLabel ? '<span>' + esc(majorityLabel) + '</span>' : '') + '<span>Approvazione e seggi non sono dati ufficiali.</span></section>' : '') + rolePanel(parliament, currentDate) + (seat?.groupId ? playerGroupSelector(parliament) : '') + '<div class="parliament-chamber-grid">' + chamberPanel(parliament, 'camera', politicians) + chamberPanel(parliament, 'senato', politicians) + '</div>' + accessNote(parliament) + timeline(parliament) + '</div>';
}

function groupChecks(parliament, selectedIds = [], politicians = []) {
  return ['camera', 'senato'].map(chamber => {
    const groups = parliament.chambers[chamber]?.groups ?? [];
    return '<fieldset class="government-chamber"><legend>' + esc(CHAMBERS[chamber].label) + '</legend>' + groups.map(group => {
      const leader = politicians.find(person => person.id === group.reference.leaderPoliticianId && person.source === DATA_SOURCES.REAL && person.verified === true);
      const leaderLabel = leader ? 'Capogruppo: ' + (leader.fullName || leader.firstName + ' ' + leader.lastName) : 'Capogruppo non documentato';
      return '<label class="government-group-check"><input type="checkbox" data-government-group value="' + esc(group.groupId) + '" ' + (selectedIds.includes(group.groupId) ? 'checked' : '') + ' /><span><strong>' + esc(group.officialName) + (group.groupId === parliament.player?.groupId ? ' · il tuo gruppo' : '') + '</strong><small>' + whole(group.simulatedSeats) + ' seggi nello scenario · ' + esc(leaderLabel) + '</small></span></label>';
    }).join('') + '</fieldset>';
  }).join('');
}
function confidenceSummary(government) {
  const last = government?.confidenceVotes?.at(-1);
  if (!last) return '';
  return '<div class="government-vote-summary"><strong>Ultima fiducia · ' + esc(last.date) + '</strong>' + last.votes.map(vote => '<div class="law-vote-result"><strong>' + esc(CHAMBERS[vote.chamber]?.shortLabel || vote.chamber) + '</strong><span>Favorevoli <b>' + whole(vote.yes) + '</b></span><span>Soglia <b>' + whole(vote.needed) + '</b></span>' + (vote.nominalSupport !== vote.yes ? '<span>Defezioni per la crisi <b>' + whole(vote.nominalSupport - vote.yes) + '</b></span>' : '') + '<em>' + (vote.passed ? 'FIDUCIA' : 'NON RAGGIUNTA') + ' · simulazione</em></div>').join('') + '</div>';
}
function governmentStart(parliament, politicians, canEdit, fallen) {
  return '<section class="government-start"><span class="section-kicker">COSTRUISCI LA MAGGIORANZA</span><h2>' + (fallen ? 'Serve un nuovo governo.' : 'Nessun governo è stato formato.') + '</h2><p>Seleziona gruppi in entrambe le Camere, negozia i numeri e poi chiedi la fiducia. Le soglie sono calcolate sullo scenario di questa carriera.</p><div class="coalition-checks">' + groupChecks(parliament, [], politicians) + '</div><button class="primary-button" data-parliament-action="form-government" ' + (!canEdit ? 'disabled' : '') + '>Apri la trattativa ' + icon + '</button></section>';
}
function governmentView(parliament, politicians = [], approval = null) {
  const government = parliament.government;
  const open = government && ['active', 'crisis', 'awaiting-confidence'].includes(government.status);
  const all = groupsFor(parliament);
  const seats = chamber => (parliament.chambers[chamber]?.groups ?? []).filter(group => open && government.coalitionGroupIds.includes(group.groupId)).reduce((sum, group) => sum + group.simulatedSeats, 0);
  const supportSeats = chamber => (parliament.chambers[chamber]?.groups ?? []).filter(group => open && government.supportingGroupIds.includes(group.groupId)).reduce((sum, group) => sum + group.simulatedSeats, 0);
  const stats = ['camera', 'senato'].map(chamber => '<span><small>' + CHAMBERS[chamber].shortLabel.toUpperCase() + ' · SEGGI DI COALIZIONE</small><strong>' + whole(seats(chamber)) + (supportSeats(chamber) ? ' <i>+' + whole(supportSeats(chamber)) + ' sostegno</i>' : '') + '</strong><em>maggioranza ' + whole(parliamentGroupFacts(parliament, chamber).majority) + '</em></span>').join('');
  const status = government ? statusNames[government.status] || government.status : 'Nessun governo nella carriera';
  const canEdit = canManageParliament(parliament);
  const current = activeMinisters(government);
  const ministers = current.map(item => '<div class="minister-line' + (item.playerAppointed ? ' player-minister' : '') + '"><span>' + esc(item.portfolio) + '</span><strong>' + esc(item.playerAppointed ? item.appointeeLabel + ' · ' + item.groupName : item.groupName) + '</strong><small>' + esc(item.playerAppointed ? 'Il tuo incarico di governo · simulato' : item.appointeeLabel) + '</small></div>').join('') || '<p class="quiet-copy">Nessun ministero distribuito nello scenario.</p>';
  const ended = (government?.ministers ?? []).filter(item => item.endedAt);
  const endedLine = ended.length ? '<p class="parliament-note">Incarichi conclusi: ' + ended.map(item => esc(item.portfolio) + ' (' + esc(item.endReason || 'concluso') + ')').join(' · ') + '</p>' : '';
  const supportOptions = all.filter(group => !(government?.coalitionGroupIds ?? []).includes(group.groupId) && !(government?.supportingGroupIds ?? []).includes(group.groupId)).map(group => '<option value="' + esc(group.groupId) + '">' + esc(group.officialName) + ' · ' + CHAMBERS[group.chamber].shortLabel + '</option>').join('');
  const activeControls = open && canEdit ? '<div class="government-actions">' + (government.status === 'crisis' || government.status === 'awaiting-confidence' ? '<button class="primary-button" data-parliament-action="confidence">Vota la fiducia nelle due Camere ' + icon + '</button>' : '<button class="secondary-button" data-parliament-action="crisis">Apri una crisi di maggioranza</button>') + '<label>Coinvolgi un gruppo esterno<select data-government-support-select><option value="">Scegli un gruppo</option>' + supportOptions + '</select></label><button class="secondary-button" data-parliament-action="government-support">Negozia sostegno · 5 cap.</button></div>' : '';
  const portfolioOptions = MINISTERIAL_PORTFOLIOS.filter(portfolio => !current.some(item => item.portfolio === portfolio)).map(item => '<option>' + esc(item) + '</option>').join('');
  const majorityIds = [...(government?.coalitionGroupIds ?? []), ...(government?.supportingGroupIds ?? [])];
  const eligibleMinisters = all.filter(group => majorityIds.includes(group.groupId)).map(group => '<option value="' + esc(group.groupId) + '">' + esc(group.officialName) + '</option>').join('');
  const playerEligible = canEdit && majorityIds.includes(parliament.player.groupId) && !current.some(item => item.playerAppointed);
  const appoint = government && ['active', 'awaiting-confidence'].includes(government.status) && canEdit ? '<form class="minister-form" data-minister-form><label>Ministero<select name="portfolio" required><option value="">Scegli un ministero</option>' + portfolioOptions + '</select></label><label>Assegnatario<select name="appointee"><option value="group">Esponente di un gruppo alleato</option>' + (playerEligible ? '<option value="player">Tu, per il tuo gruppo</option>' : '') + '</select></label><label>Gruppo<select name="groupId"><option value="">Scegli un alleato</option>' + eligibleMinisters + '</select></label><button class="secondary-button" type="submit">Distribuisci incarico</button></form>' : '';
  const position = open && parliament.player?.groupId ? '<p class="parliament-note">' + (majorityIds.includes(parliament.player.groupId) ? 'Il tuo gruppo fa parte della maggioranza: puoi assumere un ministero.' : 'Il tuo gruppo è fuori dalla maggioranza: puoi negoziare sostegni o aprire una crisi.') + (government.status === 'crisis' ? ' Crisi in corso: fino al ' + whole(government.crisisSeverity) + '% dei voti della maggioranza è a rischio.' : '') + '</p>' : '';
  const currentSection = open ? '<section class="government-current"><div class="home-section-heading"><div><span class="section-kicker">COALIZIONE SIMULATA</span><h2>' + esc(government.name) + '</h2></div>' + dataMarker(DATA_SOURCES.SIMULATION) + '</div><p class="government-members">' + government.coalitionGroupIds.map(id => all.find(group => group.groupId === id)?.officialName).filter(Boolean).map(name => '<span>' + esc(name) + '</span>').join('') + government.supportingGroupIds.map(id => all.find(group => group.groupId === id)?.officialName).filter(Boolean).map(name => '<span>Sostegno esterno · ' + esc(name) + '</span>').join('') + '</p>' + position + '<div class="minister-list">' + ministers + '</div>' + endedLine + appoint + activeControls + confidenceSummary(government) + (canEdit ? '<details class="coalition-edit"><summary>' + (government.status === 'awaiting-confidence' ? 'Modifica i gruppi proposti' : 'Rinegozia la coalizione') + '</summary><div class="coalition-checks">' + groupChecks(parliament, government.coalitionGroupIds, politicians) + '</div><button class="secondary-button" data-parliament-action="revise-government">Aggiorna la coalizione</button></details>' : '') + '</section>' : '';
  const fallenSection = government?.status === 'fallen' ? '<section class="government-current"><div class="home-section-heading"><div><span class="section-kicker">GOVERNO CADUTO · ' + esc(government.fallenAt || '') + '</span><h2>' + esc(government.name) + '</h2></div>' + dataMarker(DATA_SOURCES.SIMULATION) + '</div>' + endedLine + confidenceSummary(government) + '</section>' : '';
  const approvalLine = approval === null ? '' : '<div class="government-approval"><small>GRADIMENTO NEI SONDAGGI</small><strong>' + String(approval).replace('.', ',') + '%</strong><span>Stabilità ' + whole(government?.stability ?? 0) + '/100</span></div>';
  return '<div class="parliament-mode government-mode"><section class="parliament-mode-hero"><div><span class="section-kicker">PALAZZO CHIGI</span><h2>' + esc(status) + '</h2><p>Per entrare in carica la coalizione deve ottenere la fiducia sia alla Camera sia al Senato. Le nomine e le maggioranze sono scenari simulati.</p></div>' + (approvalLine || dataMarker(DATA_SOURCES.SIMULATION, 'GOVERNO DI PARTITA')) + '</section>' + accessNote(parliament) + '<section class="government-majority-strip">' + stats + '</section>' + currentSection + fallenSection + (!open ? governmentStart(parliament, politicians, canEdit, government?.status === 'fallen') : '') + timeline(parliament) + '</div>';
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
function lawCard(law, parliament, society = null) {
  const canAct = canManageParliament(parliament);
  const chamber = CHAMBERS[law.currentChamber]?.label ?? law.currentChamber;
  const controls = canAct && ['amendments', 'final-vote'].includes(law.stage) ? negotiationControls(law, parliament) : '';
  const votes = (law.votes ?? []).map(vote => '<div class="law-vote-result"><strong>' + esc(CHAMBERS[vote.chamber]?.shortLabel || vote.chamber) + '</strong><span>Favorevoli <b>' + whole(vote.yes) + '</b></span><span>Contrari <b>' + whole(vote.no) + '</b></span><span>Soglia <b>' + whole(vote.needed) + '</b></span><em>' + (vote.passed ? 'APPROVATA' : 'RESPINTA') + (vote.forced ? ' · voto forzato' : '') + ' · simulazione</em></div>').join('');
  const impact = society?.lawsApplied?.find(item => item.lawId === law.id);
  const people = list => list.map(item => esc(item.fullName) + (item.groupName ? ' (' + esc(item.groupName) + ')' : '')).join(', ');
  const links = [
    law.realReference ? '<span class="law-link-real">' + glyph('link', 13) + ' Collegata all’atto reale: ' + esc(law.realReference.label) + (law.realReference.sourceUrl ? ' · <a href="' + esc(law.realReference.sourceUrl) + '" target="_blank" rel="noopener noreferrer">fonte ↗</a>' : '') + '</span>' : '',
    law.cosigners?.length ? '<span>' + glyph('users', 13) + ' Firme di parlamentari reali (iniziativa simulata): ' + people(law.cosigners) + '</span>' : '',
    law.contactSupport?.length ? '<span>' + glyph('link', 13) + ' Sostegno in Aula (simulato) da: ' + people(law.contactSupport) + '</span>' : '',
    impact ? '<span class="law-impact ' + (impact.covered ? 'good' : 'bad') + '">' + glyph('map', 13) + ' Effetti sul Paese: ' + (impact.covered ? 'coperture trovate' : 'coperture insufficienti, effetti ridotti') + ' · più visibili in ' + impact.topRegions.map(item => esc(item.name)).join(', ') + '</span>' : ''
  ].filter(Boolean).join('');
  return '<article class="law-card stage-' + esc(law.stage) + '"><header>' + artTile(LAW_ICONS[law.category] ?? 'law', law.stage === 'approved' ? '#1baf7a' : law.stage === 'rejected' || law.stage === 'lapsed' ? '#e34948' : '#2a78d6') + '<div class="law-card-title"><span class="section-kicker">' + esc(law.category.toUpperCase()) + ' · ' + esc(chamber) + '</span><h3>' + esc(law.title) + '</h3></div>' + dataMarker(DATA_SOURCES.SIMULATION, statusNames[law.stage] || law.stage) + '</header><p>' + esc(law.summary) + '</p><div class="law-amendment-list">' + (law.amendments ?? []).map(item => '<span>Emendamento simulato · ' + esc(item.text) + '</span>').join('') + (law.negotiatedGroupIds?.length ? '<span>Gruppi coinvolti nella trattativa: ' + whole(law.negotiatedGroupIds.length) + '</span>' : '') + '</div>' + (links ? '<div class="law-links">' + links + '</div>' : '') + '<div class="law-actions">' + lawAction(law, canAct) + '</div>' + controls + votes + '<small class="law-updated">Ultimo passaggio: ' + esc(law.updatedAt || law.introducedAt) + (law.stage === 'lapsed' ? ' · decaduta con la fine del mandato' : '') + '</small></article>';
}
function lawsView(parliament, extras = {}) {
  const playerCanAct = canManageParliament(parliament);
  const proposals = [...(parliament.laws ?? [])].reverse().map(law => lawCard(law, parliament, extras.society)).join('');
  const form = '<form class="law-proposal-form" data-law-proposal-form><div class="law-proposal-heading"><div><span class="section-kicker">NUOVA INIZIATIVA</span><h2>Scrivi una proposta.</h2></div>' + dataMarker(DATA_SOURCES.SIMULATION, 'PROPOSTA DEL GIOCATORE') + '</div><div class="law-form-grid"><label>Titolo<input name="title" required minlength="5" maxlength="90" placeholder="Dai un nome alla proposta" /></label><label>Tema<select name="category">' + LAW_CATEGORIES.map(category => '<option>' + esc(category) + '</option>').join('') + '</select></label><label class="law-summary-field">Contenuto<textarea name="summary" required minlength="12" maxlength="800" rows="3" placeholder="Quale cambiamento vuoi introdurre?"></textarea></label><input type="hidden" name="realReference" value="" /><p class="law-real-draft" data-law-real-draft hidden></p></div><button class="primary-button" type="submit" ' + (!playerCanAct ? 'disabled' : '') + '>Presenta la legge ' + icon + '</button><p>Le proposte attraversano commissione, emendamenti, prima votazione, seconda Camera e voto finale. Ogni esito è source: simulation.</p></form>';
  return '<div class="parliament-mode laws-mode"><section class="parliament-mode-hero"><div><span class="section-kicker">ITER LEGISLATIVO</span><h2>Una proposta alla volta.</h2><p>Costruisci consenso in aula, negozia modifiche e scegli quando portare il testo al voto.</p></div>' + dataMarker(DATA_SOURCES.SIMULATION, 'LEGISLAZIONE DELLA PARTITA') + '</section>' + accessNote(parliament) + form + '<section class="law-board"><div class="home-section-heading"><div><span class="section-kicker">IN DISCUSSIONE</span><h2>Proposte e votazioni</h2></div><span>' + (parliament.laws?.length ?? 0) + ' iniziative</span></div>' + (proposals || '<p class="quiet-copy">Non hai ancora presentato una proposta.</p>') + '</section>' + (extras.realLaws ? '<section class="law-board real-law-board"><div class="home-section-heading"><div><span class="section-kicker">XIX LEGISLATURA · DATI REALI VERIFICATI</span><h2>Leggi e disegni di legge reali</h2></div></div>' + extras.realLaws + '</section>' : '') + timeline(parliament) + '</div>';
}

export function renderParliamentPage(page, state, options = {}) {
  const parliament = state.parliament;
  if (!parliament) {
    const error = options.status?.error;
    return '<section class="parliament-empty"><span class="section-kicker">DATI ISTITUZIONALI</span><h2>' + (error ? 'Camere e gruppi non disponibili.' : 'Carico le Camere e i gruppi…') + '</h2><p>' + esc(error || 'La schermata usa i gruppi parlamentari verificati nel database locale del gioco.') + '</p><button class="secondary-button" data-action="retry-parliament">Riprova a caricare i gruppi</button></section>';
  }
  const days = state.game && parliament.player ? `<div class="parliament-access-note parliament-time-note">Ogni azione in Aula usa 1 giorno della settimana: ne restano <b>${state.game.week.ap}</b> su ${state.game.week.maxAp}. Capitale politico <b>${whole(parliament.resources?.politicalCapital)}</b>.</div>` : '';
  if (page === 'governo') return days + governmentView(parliament, options.politicians ?? [], state.world?.polls?.at(-1)?.government?.approval ?? null);
  if (page === 'leggi') return days + lawsView(parliament, { society: state.society, realLaws: options.realLaws });
  const player = options.player ?? state.dataset?.politicians?.find(item => item.id === state.career?.playerId) ?? null;
  return days + renderParliament(parliament, options.party, options.politicians ?? [], player, state.clock?.currentDate ?? parliament.createdAt);
}
