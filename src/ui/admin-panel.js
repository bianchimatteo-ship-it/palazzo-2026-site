import { ADMIN_FIELDS, POSITIONS, adminArchiveSummary, loadSharedArchive, overrideFor } from '../data/repositories/admin-store.js?v=20260926-1';
import { affiliationOf, markForPerson } from './person-marks.js?v=20260926-1';
import { hasSharedSession, sharedApiUrl } from '../data/repositories/admin-sync.js?v=20260926-1';
import { emblem, glyph } from './visuals.js?v=20260926-1';
import { BASIS_LABELS, electionListOf, groupAffiliation, groupLabel, politicianAffiliation } from '../data/repositories/party-links.js?v=20260926-1';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = value => String(value ?? '').toLocaleLowerCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// Results are never cut: the list renders a page at a time, the search always covers every record.
const PAGE = 40;

// Only the owner, recognised by the server, gets past this gate: nothing of the admin area is shown before.
function ownerGate(message, { available = true, configured = true, checking = false } = {}) {
  if (checking) return `<section class="admin-lock hq-panel">${glyph('shield', 34)}<h2>Verifica della sessione…</h2><p>Controllo con il server che questo browser sia collegato come proprietario.</p></section>`;
  if (!available) return `<section class="admin-lock hq-panel">${glyph('shield', 34)}<h2>Area riservata</h2><p>Quest’area è disponibile solo sul sito pubblicato, con l’accesso del proprietario verificato dal server.</p></section>`;
  return `<section class="admin-lock hq-panel">${glyph('shield', 34)}<h2>Area riservata al proprietario</h2><p>Accesso verificato dal server del gioco. I giocatori non possono creare un proprio PIN.</p><form class="admin-lock-form" data-admin-shared-form><label>PIN del proprietario<input type="password" name="pin" autocomplete="current-password" minlength="6" required /></label>${configured ? '' : '<label>Codice di attivazione (solo la prima volta)<input type="password" name="setupCode" autocomplete="one-time-code" /></label>'}<button class="primary-button" type="submit">Entra</button></form>${message ? `<p class="admin-message" role="alert">${esc(message)}</p>` : ''}</section>`;
}

function fieldInput(field, value, context) {
  const name = `name="${field.key}"`;
  if (field.type === 'textarea') return `<textarea ${name} rows="4" maxlength="${field.max}">${esc(value)}</textarea>`;
  if (field.type === 'color') return `<input type="color" ${name} value="${esc(/^#[\da-f]{6}$/i.test(value ?? '') ? value : '#264d82')}" />`;
  if (field.type === 'date') return `<input type="date" ${name} value="${esc(value)}" />`;
  if (field.type === 'position') return `<select ${name}><option value="">Non classificata</option>${POSITIONS.map(item => `<option value="${esc(item)}" ${item === value ? 'selected' : ''}>${esc(item.charAt(0).toUpperCase() + item.slice(1))}</option>`).join('')}</select>`;
  if (field.type === 'chamber') return `<select ${name}><option value="camera" ${value === 'camera' ? 'selected' : ''}>Camera dei deputati</option><option value="senato" ${value === 'senato' ? 'selected' : ''}>Senato della Repubblica</option></select>`;
  // Only the groups of the person's Chamber; a group of the other Chamber already saved stays visible (and flagged)
  // so that saving the form never changes it silently.
  if (field.type === 'group') return `<select ${name}><option value="">Nessun gruppo</option>${context.groups.filter(group => !context.chamber || group.chamber === context.chamber || group.id === value).map(group => `<option value="${esc(group.id)}" ${group.id === value ? 'selected' : ''}>${esc(groupTitle(group))} · ${group.chamber === 'camera' ? 'Camera' : 'Senato'}${context.chamber && group.chamber !== context.chamber ? ' (altra Camera!)' : ''}</option>`).join('')}</select>`;
  if (field.type === 'party') return `<select ${name}><option value="">Nessun partito collegato</option>${context.parties.map(party => `<option value="${esc(party.id)}" ${party.id === value ? 'selected' : ''}>${esc(party.officialName ?? party.name)}</option>`).join('')}</select>`;
  return `<input type="${field.type === 'url' ? 'url' : 'text'}" ${name} value="${esc(value)}" maxlength="${field.max ?? 200}" />`;
}
// The Camera lists the components of the Misto group as groups named "MISTO-…": group Misto, component "…".
const groupTitle = group => { const component = group.officialName.match(/^MISTO\s*[-–]\s*(.+)$/i)?.[1]; return component ? `Misto · componente ${component}` : /^misto$/i.test(group.officialName.trim()) ? 'Misto' : group.officialName; };
function editorFields(kind, record, original, context) {
  const edited = new Set(record.adminEdited?.fields ?? []);
  const scoped = kind === 'politicians' ? { ...context, chamber: record.chamber } : context;
  return ADMIN_FIELDS[kind].map(field => {
    const originalValue = original?.[field.key];
    const shown = field.type === 'group' ? context.groups.find(group => group.id === originalValue)?.officialName : field.type === 'party' ? context.parties.find(party => party.id === originalValue)?.officialName : originalValue;
    const wrongChamber = field.type === 'group' && record[field.key] && context.groups.find(group => group.id === record[field.key])?.chamber !== record.chamber;
    return `<label class="admin-field ${field.type === 'textarea' ? 'is-wide' : ''} ${edited.has(field.key) ? 'is-edited' : ''}"><span>${esc(field.label)}${field.required ? ' *' : ''}</span>${fieldInput(field, record[field.key], scoped)}${wrongChamber ? `<small class="admin-warning">Il gruppo salvato appartiene all’altra Camera: nel gioco viene letto come il gruppo con lo stesso nome della ${record.chamber === 'camera' ? 'Camera' : 'Senato'}. Scegli qui il gruppo corretto e salva.</small>` : ''}${edited.has(field.key) ? `<small>Dato del dataset: ${esc(shown ?? 'vuoto')} <button type="button" class="text-link" data-admin-reset-field="${esc(field.key)}">Ripristina</button></small>` : ''}</label>`;
  }).join('');
}
function badges(item) {
  return `${item.adminCreated ? '<span class="badge">Aggiunto</span>' : ''}${item.adminHidden ? `<span class="badge badge-bad">${item.adminDeleted ? 'Eliminato' : 'Nascosto'}</span>` : ''}${item.adminEdited ? '<span class="badge">Modificato</span>' : ''}`;
}
function searchList(items, selectedId, attr, describe, page = 1) {
  const shown = items.slice(0, Math.max(1, page) * PAGE);
  return `<p class="admin-count">${items.length} risultati</p>` + (shown.map(item => `<button type="button" class="admin-list-item ${item.id === selectedId ? 'is-selected' : ''}" data-${attr}="${esc(item.id)}">${describe(item)}${badges(item)}</button>`).join('') || '<p class="admin-note">Nessun risultato.</p>') + (shown.length < items.length ? `<button type="button" class="secondary-button admin-more" data-admin-more>Mostra altri ${Math.min(PAGE, items.length - shown.length)} (${shown.length} di ${items.length})</button>` : '');
}
const PARTY_FILTERS = [['tutti', 'Tutti'], ['attivi', 'Attivi'], ['nascosti', 'Nascosti'], ['aggiunti', 'Aggiunti da me'], ['con-logo', 'Con logo'], ['senza-logo', 'Senza logo']];
function newPartyForm(message) {
  return `<form class="admin-editor" data-admin-new-party-form><header class="admin-editor-head">${glyph('flag', 28)}<div><span class="section-kicker">NUOVO PARTITO · LIVELLO AMMINISTRATIVO</span><h3>Aggiungi un partito</h3><small>Si aggiunge accanto ai dati reali, senza modificarli; è marcato come dato inserito dall’amministratore.</small></div></header>
    <div class="admin-fields"><label class="admin-field"><span>Nome ufficiale *</span><input name="officialName" maxlength="160" required /></label><label class="admin-field"><span>Sigla</span><input name="abbreviation" maxlength="20" /></label><label class="admin-field is-wide"><span>Descrizione</span><textarea name="factualDescription" rows="3" maxlength="1500"></textarea></label><label class="admin-field"><span>Sito</span><input type="url" name="website" maxlength="300" placeholder="https://" /></label><label class="admin-field"><span>Collocazione</span><select name="politicalPosition"><option value="">Non classificata</option>${POSITIONS.map(item => `<option value="${esc(item)}">${esc(item.charAt(0).toUpperCase() + item.slice(1))}</option>`).join('')}</select></label><label class="admin-field"><span>Colore</span><input type="color" name="color" value="#264d82" /></label><label class="admin-field is-wide"><span>Logo (indirizzo https, facoltativo: poi puoi caricarne uno da file)</span><input type="url" name="logoUrl" maxlength="600" placeholder="https://…/logo.png" /></label></div>
    ${message ? `<p class="admin-message" role="alert">${esc(message)}</p>` : ''}<div class="admin-actions"><button class="primary-button" type="submit">Aggiungi partito</button><button type="button" class="secondary-button" data-admin-cancel-new>Annulla</button></div></form>`;
}

function partiesTab(admin, context) {
  const query = norm(admin.query);
  const filter = admin.partyFilter ?? 'tutti';
  const hasLogo = party => Boolean(context.logoFor(party));
  const matches = party => filter === 'attivi' ? !party.adminHidden : filter === 'nascosti' ? Boolean(party.adminHidden) : filter === 'aggiunti' ? Boolean(party.adminCreated) : filter === 'con-logo' ? hasLogo(party) : filter === 'senza-logo' ? !hasLogo(party) : true;
  const parties = context.parties.filter(party => matches(party) && (!query || norm(`${party.officialName} ${party.abbreviation ?? ''} ${(party.aliases ?? []).map(alias => alias.name).join(' ')}`).includes(query)));
  const selected = context.parties.find(party => party.id === admin.partyId) ?? null;
  const list = searchList(parties, admin.partyId, 'admin-select-party', party => `${emblem({ label: party.officialName, abbreviation: party.abbreviation, color: party.color, logo: context.logoFor(party) }, 'sm')}<span><strong>${esc(party.officialName)}</strong><small>${esc(party.abbreviation ?? 'Sigla non documentata')}${party.collection === 'politicalMovements' ? ' · movimento' : ''}</small></span>`, admin.listPage);
  const counts = { real: context.parties.filter(item => !item.adminCreated && item.collection === 'parties').length, movements: context.parties.filter(item => item.collection === 'politicalMovements').length, added: context.parties.filter(item => item.adminCreated && !item.adminDeleted).length, hidden: context.parties.filter(item => item.adminHidden).length, logos: context.parties.filter(hasLogo).length };
  const summary = `<div class="admin-summary"><span><b>${counts.real}</b> partiti reali</span><span><b>${counts.movements}</b> movimenti</span><span><b>${counts.added}</b> aggiunti</span><span><b>${counts.hidden}</b> nascosti</span><span><b>${counts.logos}</b> loghi configurati</span></div>`;
  const toolbar = `<div class="admin-toolbar"><label class="admin-search">Mostra<select data-admin-filter>${PARTY_FILTERS.map(([id, label]) => `<option value="${id}" ${filter === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><button type="button" class="primary-button" data-admin-new-party>+ Aggiungi partito</button></div>`;
  let editor = admin.creating ? newPartyForm(admin.message) : '<div class="admin-empty">Scegli un partito dall’elenco per modificarlo, oppure aggiungine uno.</div>';
  if (selected && !admin.creating) {
    const original = context.pristine(selected.collection, selected.id);
    const linked = context.politicians.filter(person => person.partyId === selected.id);
    const linkQuery = norm(admin.linkQuery);
    const candidates = linkQuery.length >= 2 ? context.politicians.filter(person => person.partyId !== selected.id && norm(person.fullName).includes(linkQuery)).slice(0, 30) : [];
    editor = `<form class="admin-editor" data-admin-form="party" data-admin-id="${esc(selected.id)}" data-admin-collection="${esc(selected.collection)}">
      <header class="admin-editor-head">${emblem({ label: selected.officialName, abbreviation: selected.abbreviation, color: selected.color, logo: context.logoFor(selected) }, 'lg')}<div><span class="section-kicker">PARTITO · ${selected.collection === 'politicalMovements' ? 'MOVIMENTO' : 'DATASET REALE'}</span><h3>${esc(selected.officialName)}</h3><small>${selected.adminEdited ? `Modificato dall’amministratore · ${esc((selected.adminEdited.updatedAt ?? '').slice(0, 10))}` : 'Nessuna modifica: valori del dataset verificato'}</small></div></header>
      ${(context.aliasesOf?.(selected.id) ?? []).length ? `<p class="admin-note">Altre denominazioni dello stesso partito (non compaiono come partiti separati): ${context.aliasesOf(selected.id).map(alias => esc(alias.officialName)).join(', ')}.</p>` : ''}
      <div class="admin-fields">${editorFields('parties', selected, original, context)}</div>
      <div class="admin-actions"><button class="primary-button" type="submit">Salva modifiche</button>${selected.adminEdited ? '<button type="button" class="secondary-button" data-admin-reset-record>Ripristina i dati originali</button>' : ''}${selected.adminHidden ? `<button type="button" class="secondary-button" data-admin-restore="${esc(selected.id)}">Ripristina ${selected.adminDeleted ? 'il partito eliminato' : 'nel gioco'}</button>` : selected.adminCreated ? `<button type="button" class="secondary-button danger" data-admin-delete="${esc(selected.id)}">Elimina</button>` : `<button type="button" class="secondary-button danger" data-admin-hide="${esc(selected.id)}">Nascondi dal gioco</button>`}</div>
      <p class="admin-note">${selected.adminCreated ? 'Partito aggiunto dall’amministratore: vive solo nel livello amministrativo.' : 'Dato reale: nascondere o modificare non cambia mai i file del dataset.'}${selected.adminHidden ? ' Ora non compare nelle liste del gioco.' : ''}</p>
    </form>
    <section class="admin-block"><h4>${glyph('flag', 16)} Logo</h4><p class="admin-note">Il logo caricato qui resta nel browser (archivio loghi locale) e non sostituisce il file del dataset.</p><button type="button" class="secondary-button" data-admin-logo="${esc(selected.id)}">Carica o sostituisci il logo</button></section>
    <section class="admin-block"><h4>${glyph('users', 16)} Deputati e senatori collegati (${linked.length})</h4>${linked.map(person => `<div class="admin-link-row"><span><strong>${esc(person.fullName)}</strong><small>${person.chamber === 'camera' ? 'Camera' : 'Senato'} · ${esc(context.groups.find(group => group.id === person.groupId)?.officialName ?? 'gruppo non indicato')}</small></span><button type="button" class="text-link" data-admin-unlink="${esc(person.id)}">Scollega</button></div>`).join('') || '<p class="admin-note">Nessun parlamentare collegato. Il dataset non attribuisce i parlamentari ai partiti: i collegamenti aggiunti qui sono amministrativi.</p>'}
      <div class="admin-link-add"><label>Cerca un parlamentare<input type="search" data-admin-link-query value="${esc(admin.linkQuery)}" placeholder="Almeno 2 lettere…" autocomplete="off" /></label>${candidates.length ? `<select data-admin-link-select>${candidates.map(person => `<option value="${esc(person.id)}">${esc(person.fullName)} · ${person.chamber === 'camera' ? 'Camera' : 'Senato'}</option>`).join('')}</select><button type="button" class="secondary-button" data-admin-link="${esc(selected.id)}">Collega</button>` : ''}</div></section>`;
  }
  return `${summary}${toolbar}<div class="admin-split"><aside class="admin-list"><label class="admin-search">Cerca partito<input type="search" data-admin-query value="${esc(admin.query)}" placeholder="Nome, sigla o altra denominazione…" autocomplete="off" /></label>${list}</aside><div class="admin-main">${editor}</div></div>`;
}

// Party, group/component and 2022 list, side by side: the list can be proposed as the party, never applied alone.
function affiliationSummary(person, context) {
  const link = politicianAffiliation(person);
  const own = groupAffiliation(person);
  const list = electionListOf(person);
  const proposable = !person.partyId && list?.kind === 'list' && list.entity && context.parties.some(party => party.id === list.entity.id);
  return `<div class="admin-affiliation"><span><small>Partito attuale</small><strong>${link ? `${esc(link.entity.officialName)} · ${esc(BASIS_LABELS[link.basis])}` : 'Non documentato'}</strong></span><span><small>Gruppo</small><strong>${esc(groupLabel(own) ?? 'Non indicato')}${own?.corrected ? ' · da correggere (altra Camera)' : ''}</strong></span><span><small>Lista d’elezione 2022</small><strong>${list ? `${esc(list.label)}${list.entity ? ` · ${list.kind === 'coalition-list' ? 'coalizione' : 'partito'} ${esc(list.entity.officialName)}` : ' · più partiti'}` : 'Non indicata'}</strong>${proposable ? `<button type="button" class="text-link" data-admin-suggest-party="${esc(list.entity.id)}">Usa come partito attuale (da confermare con Salva)</button>` : ''}</span>${person.termEnd ? `<span><small>Mandato</small><strong>Concluso il ${esc(person.termEnd)}</strong></span>` : ''}</div>`;
}

function politiciansTab(admin, context) {
  const query = norm(admin.query);
  const people = context.politicians.filter(person => (admin.chamber === 'all' || person.chamber === admin.chamber) && (!query || norm(person.fullName).includes(query)));
  const selected = context.politicians.find(person => person.id === admin.politicianId) ?? null;
  const list = searchList(people, admin.politicianId, 'admin-select-politician', person => `${affiliationOf(person.id) ? markForPerson(person.id) : `<span class="admin-chamber">${person.chamber === 'camera' ? 'C' : 'S'}</span>`}<span><strong>${esc(person.fullName)}</strong><small>${esc((group => group ? groupTitle(group) : 'Gruppo non indicato')(context.groups.find(group => group.id === person.groupId)))}${person.termEnd ? ' · mandato concluso' : ''}</small></span>`, admin.listPage);
  let editor = '<div class="admin-empty">Scegli un deputato o un senatore dall’elenco.</div>';
  if (selected) {
    const original = context.pristine('politicians', selected.id);
    const datasetRoles = context.offices.filter(office => office.politicianId === selected.id);
    editor = `<form class="admin-editor" data-admin-form="politician" data-admin-id="${esc(selected.id)}" data-admin-collection="politicians">
      <header class="admin-editor-head">${affiliationOf(selected.id) ? markForPerson(selected.id, 'lg') : `<span class="admin-avatar">${esc(selected.fullName.split(/\s+/).map(word => word[0]).join('').slice(0, 2))}</span>`}<div><span class="section-kicker">${selected.chamber === 'camera' ? 'DEPUTATO' : 'SENATORE'} · DATASET REALE</span><h3>${esc(selected.fullName)}</h3><small>${selected.adminEdited ? `Modificato dall’amministratore · ${esc((selected.adminEdited.updatedAt ?? '').slice(0, 10))}` : 'Nessuna modifica: valori del dataset verificato'}${selected.sourceUrl ? ` · <a href="${esc(selected.sourceUrl)}" target="_blank" rel="noopener noreferrer">Scheda ufficiale ↗</a>` : ''}</small></div></header>
      ${affiliationSummary(selected, context)}
      <div class="admin-fields">${editorFields('politicians', selected, original, context)}</div>
      <div class="admin-actions"><button class="primary-button" type="submit">Salva modifiche</button>${overrideFor('politicians', selected.id) ? '<button type="button" class="secondary-button" data-admin-reset-record>Ripristina i dati originali</button>' : ''}</div>
    </form>
    <section class="admin-block"><h4>${glyph('ministry', 16)} Incarichi</h4>${datasetRoles.map(office => `<div class="admin-link-row"><span><strong>${esc(office.title)}</strong><small>${esc(office.institution ?? '')} · dal ${esc(office.startDate ?? 'n.d.')} · dataset verificato</small></span></div>`).join('')}${(selected.adminRoles ?? []).map(role => `<div class="admin-link-row is-edited"><span><strong>${esc(role.title)}</strong><small>${esc(role.institution ?? '')}${role.startDate ? ` · dal ${esc(role.startDate)}` : ''}${role.endDate ? ` al ${esc(role.endDate)}` : ''} · aggiunto dall’amministratore</small></span><button type="button" class="text-link" data-admin-remove-role="${esc(role.id)}">Rimuovi</button></div>`).join('')}
      <form class="admin-role-form" data-admin-role-form data-admin-id="${esc(selected.id)}"><label>Incarico<input name="title" maxlength="160" required placeholder="Es. Presidente di commissione" /></label><label>Istituzione<input name="institution" maxlength="160" placeholder="Es. Camera dei deputati" /></label><label>Dal<input type="date" name="startDate" /></label><label>Al<input type="date" name="endDate" /></label><button class="secondary-button" type="submit">Aggiungi incarico</button></form></section>`;
  }
  return `<div class="admin-split"><aside class="admin-list"><label class="admin-search">Cerca per nome<input type="search" data-admin-query value="${esc(admin.query)}" placeholder="Nome o cognome…" autocomplete="off" /></label><label class="admin-search">Camera<select data-admin-chamber><option value="all" ${admin.chamber === 'all' ? 'selected' : ''}>Camera e Senato</option><option value="camera" ${admin.chamber === 'camera' ? 'selected' : ''}>Camera</option><option value="senato" ${admin.chamber === 'senato' ? 'selected' : ''}>Senato</option></select></label>${list}</aside><div class="admin-main">${editor}</div></div>`;
}

// The shared archive on the server: what every player sees, surviving refreshes, restarts and new deploys.
function sharedBlock() {
  const shared = loadSharedArchive();
  const available = Boolean(sharedApiUrl());
  const connected = hasSharedSession();
  const counts = shared ? `${Object.keys(shared.parties ?? {}).length} partiti, ${Object.keys(shared.politicians ?? {}).length} politici, ${Object.keys(shared.logos ?? {}).length} loghi` : 'nessuna copia scaricata';
  const connect = !available ? '<p class="admin-note">Questa copia del gioco non raggiunge l’archivio condiviso (è disponibile sul sito pubblicato): le modifiche restano in questo browser.</p>'
    : connected ? '<div class="admin-actions"><button class="primary-button" data-admin-shared="publish">Pubblica ora le modifiche per tutti</button><button class="secondary-button" data-admin-shared="refresh">Aggiorna dall’archivio</button><button class="text-link" data-admin-shared="logout">Scollega</button></div><p class="admin-note">Collegato: ogni modifica salvata viene pubblicata automaticamente per tutti i giocatori.</p>'
    : `<form class="admin-lock-form" data-admin-shared-form><label>PIN dell’archivio condiviso<input type="password" name="pin" minlength="6" autocomplete="current-password" required /></label>${shared?.configured ? '' : '<label>Codice di attivazione (solo la prima volta)<input type="password" name="setupCode" autocomplete="one-time-code" /></label>'}<button class="secondary-button" type="submit">Collega questo browser</button></form><p class="admin-note">${shared?.configured ? 'L’archivio è già attivo: inserisci il PIN scelto alla prima attivazione.' : 'Prima attivazione: il codice di attivazione lega il PIN all’archivio del sito.'}</p>`;
  return `<section class="admin-block"><h4>${glyph('globe', 16)} Archivio condiviso (tutti i giocatori)</h4><p>Pubblicato: ${esc(counts)}${shared?.updatedAt ? ` · aggiornato ${esc(String(shared.updatedAt).slice(0, 16).replace('T', ' '))}` : ''}.</p>${connect}<p class="admin-note">Correzioni e loghi pubblicati restano sul server (Cloudflare, archivio chiave-valore) anche dopo aggiornamenti e nuovi deploy. I file dei dati reali non vengono mai modificati.</p></section>`;
}
function archiveTab() {
  const summary = adminArchiveSummary();
  return `<div class="admin-archive">${sharedBlock()}<section class="admin-block"><h4>${glyph('book', 16)} Archivio amministrativo</h4><p><strong>${summary.parties}</strong> partiti e <strong>${summary.politicians}</strong> politici modificati · <strong>${summary.added}</strong> partiti aggiunti · <strong>${summary.hidden}</strong> nascosti${summary.updatedAt ? ` · ultimo salvataggio ${esc(summary.updatedAt.slice(0, 16).replace('T', ' '))}` : ''}.</p><p class="admin-note">Le modifiche sono salvate in un archivio separato di questo browser e applicate sopra il dataset reale ogni volta che il gioco si apre. Restano anche dopo gli aggiornamenti del codice, finché l’archivio non viene cancellato (o non vengono cancellati i dati del sito dal browser). Esporta una copia per sicurezza o per usarla su un altro dispositivo.</p><div class="admin-actions"><button type="button" class="primary-button" data-admin-export>Esporta archivio (JSON)</button><label class="secondary-button admin-file">Importa archivio<input type="file" accept="application/json,.json" data-admin-import hidden /></label><button type="button" class="secondary-button danger" data-admin-clear>Cancella tutte le modifiche</button></div></section>
</div>`;
}

export function renderAdminPanel(admin, context) {
  const tabs = [['partiti', 'Partiti', 'flag'], ['politici', 'Politici', 'users'], ['archivio', 'Archivio', 'book']];
  if (!context.unlocked) return `<div class="admin-page">${ownerGate(admin.message, { available: context.available, configured: context.configured, checking: context.checking })}</div>`;
  const hero = `<section class="admin-hero"><div>${glyph('shield', 30)}<div><span class="section-kicker">AREA AMMINISTRATIVA · PROPRIETARIO</span><h2>Dati di partiti e politici</h2><p>Le correzioni diventano un livello separato sopra il dataset reale: i file originali non cambiano mai. Ogni modifica è pubblicata per tutti i giocatori.</p></div></div><button class="secondary-button" data-admin-shared="logout">Esci</button></section>`;
  if (context.loading) return `<div class="admin-page">${hero}<div class="catalog-state" role="status"><span class="catalog-spinner" aria-hidden="true"></span><strong>Carico partiti e parlamentari…</strong></div></div>`;
  const body = admin.tab === 'politici' ? politiciansTab(admin, context) : admin.tab === 'archivio' ? archiveTab() : partiesTab(admin, context);
  return `<div class="admin-page">${hero}<nav class="admin-tabs">${tabs.map(([id, label, icon]) => `<button type="button" class="${admin.tab === id ? 'is-active' : ''}" data-admin-tab="${id}">${glyph(icon, 16)} ${label}</button>`).join('')}</nav>${admin.message ? `<p class="admin-message" role="status">${esc(admin.message)}</p>` : ''}${body}</div>`;
}
