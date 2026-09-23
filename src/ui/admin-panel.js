import { ADMIN_FIELDS, adminArchiveSummary, overrideFor } from '../data/repositories/admin-store.js?v=20260924-10';
import { emblem, glyph } from './visuals.js?v=20260924-10';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = value => String(value ?? '').toLocaleLowerCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const LIST_LIMIT = 40;

function lockScreen(hasPin, message) {
  return `<section class="admin-lock hq-panel">${glyph('shield', 34)}<h2>${hasPin ? 'Area riservata' : 'Imposta il PIN del proprietario'}</h2><p>${hasPin ? 'Inserisci il PIN per modificare partiti e politici.' : 'Scegli un PIN di almeno 6 caratteri: servirà per aprire quest’area in questo browser.'}</p><form class="admin-lock-form" data-admin-lock-form><label>PIN<input type="password" name="pin" autocomplete="${hasPin ? 'current-password' : 'new-password'}" minlength="6" required /></label>${hasPin ? '' : '<label>Ripeti il PIN<input type="password" name="confirm" autocomplete="new-password" minlength="6" required /></label>'}<button class="primary-button" type="submit">${hasPin ? 'Sblocca' : 'Imposta e sblocca'}</button></form>${message ? `<p class="admin-message" role="alert">${esc(message)}</p>` : ''}<p class="admin-note">Il blocco protegge l’area in questo browser: su un sito statico non è un’autenticazione lato server.</p></section>`;
}

function fieldInput(field, value, context) {
  const name = `name="${field.key}"`;
  if (field.type === 'textarea') return `<textarea ${name} rows="4" maxlength="${field.max}">${esc(value)}</textarea>`;
  if (field.type === 'color') return `<input type="color" ${name} value="${esc(/^#[\da-f]{6}$/i.test(value ?? '') ? value : '#264d82')}" />`;
  if (field.type === 'date') return `<input type="date" ${name} value="${esc(value)}" />`;
  if (field.type === 'chamber') return `<select ${name}><option value="camera" ${value === 'camera' ? 'selected' : ''}>Camera dei deputati</option><option value="senato" ${value === 'senato' ? 'selected' : ''}>Senato della Repubblica</option></select>`;
  if (field.type === 'group') return `<select ${name}><option value="">Nessun gruppo</option>${context.groups.map(group => `<option value="${esc(group.id)}" ${group.id === value ? 'selected' : ''}>${esc(group.officialName)} · ${group.chamber === 'camera' ? 'Camera' : 'Senato'}</option>`).join('')}</select>`;
  if (field.type === 'party') return `<select ${name}><option value="">Nessun partito collegato</option>${context.parties.map(party => `<option value="${esc(party.id)}" ${party.id === value ? 'selected' : ''}>${esc(party.officialName ?? party.name)}</option>`).join('')}</select>`;
  return `<input type="${field.type === 'url' ? 'url' : 'text'}" ${name} value="${esc(value)}" maxlength="${field.max ?? 200}" />`;
}
function editorFields(kind, record, original, context) {
  const edited = new Set(record.adminEdited?.fields ?? []);
  return ADMIN_FIELDS[kind].map(field => {
    const originalValue = original?.[field.key];
    const shown = field.type === 'group' ? context.groups.find(group => group.id === originalValue)?.officialName : field.type === 'party' ? context.parties.find(party => party.id === originalValue)?.officialName : originalValue;
    return `<label class="admin-field ${field.type === 'textarea' ? 'is-wide' : ''} ${edited.has(field.key) ? 'is-edited' : ''}"><span>${esc(field.label)}${field.required ? ' *' : ''}</span>${fieldInput(field, record[field.key], context)}${edited.has(field.key) ? `<small>Dato del dataset: ${esc(shown ?? 'vuoto')} <button type="button" class="text-link" data-admin-reset-field="${esc(field.key)}">Ripristina</button></small>` : ''}</label>`;
  }).join('');
}
function searchList(items, selectedId, attr, describe) {
  return items.slice(0, LIST_LIMIT).map(item => `<button type="button" class="admin-list-item ${item.id === selectedId ? 'is-selected' : ''}" data-${attr}="${esc(item.id)}">${describe(item)}${item.adminEdited ? '<span class="badge">Modificato</span>' : ''}</button>`).join('') + (items.length > LIST_LIMIT ? `<p class="admin-note">Mostrati ${LIST_LIMIT} di ${items.length}: affina la ricerca.</p>` : '') || '<p class="admin-note">Nessun risultato.</p>';
}

function partiesTab(admin, context) {
  const query = norm(admin.query);
  const parties = context.parties.filter(party => !query || norm(`${party.officialName} ${party.abbreviation}`).includes(query));
  const selected = context.parties.find(party => party.id === admin.partyId) ?? null;
  const list = searchList(parties, admin.partyId, 'admin-select-party', party => `${emblem({ label: party.officialName, abbreviation: party.abbreviation, color: party.color, logo: context.logoFor(party) }, 'sm')}<span><strong>${esc(party.officialName)}</strong><small>${esc(party.abbreviation ?? 'Sigla non documentata')}</small></span>`);
  let editor = '<div class="admin-empty">Scegli un partito dall’elenco per modificarlo.</div>';
  if (selected) {
    const original = context.pristine(selected.collection, selected.id);
    const linked = context.politicians.filter(person => person.partyId === selected.id);
    const linkQuery = norm(admin.linkQuery);
    const candidates = linkQuery.length >= 2 ? context.politicians.filter(person => person.partyId !== selected.id && norm(person.fullName).includes(linkQuery)).slice(0, 30) : [];
    editor = `<form class="admin-editor" data-admin-form="party" data-admin-id="${esc(selected.id)}" data-admin-collection="${esc(selected.collection)}">
      <header class="admin-editor-head">${emblem({ label: selected.officialName, abbreviation: selected.abbreviation, color: selected.color, logo: context.logoFor(selected) }, 'lg')}<div><span class="section-kicker">PARTITO · ${selected.collection === 'politicalMovements' ? 'MOVIMENTO' : 'DATASET REALE'}</span><h3>${esc(selected.officialName)}</h3><small>${selected.adminEdited ? `Modificato dall’amministratore · ${esc((selected.adminEdited.updatedAt ?? '').slice(0, 10))}` : 'Nessuna modifica: valori del dataset verificato'}</small></div></header>
      <div class="admin-fields">${editorFields('parties', selected, original, context)}</div>
      <div class="admin-actions"><button class="primary-button" type="submit">Salva modifiche</button>${selected.adminEdited ? '<button type="button" class="secondary-button" data-admin-reset-record>Ripristina i dati originali</button>' : ''}</div>
    </form>
    <section class="admin-block"><h4>${glyph('flag', 16)} Logo</h4><p class="admin-note">Il logo caricato qui resta nel browser (archivio loghi locale) e non sostituisce il file del dataset.</p><button type="button" class="secondary-button" data-admin-logo="${esc(selected.id)}">Carica o sostituisci il logo</button></section>
    <section class="admin-block"><h4>${glyph('users', 16)} Deputati e senatori collegati (${linked.length})</h4>${linked.map(person => `<div class="admin-link-row"><span><strong>${esc(person.fullName)}</strong><small>${person.chamber === 'camera' ? 'Camera' : 'Senato'} · ${esc(context.groups.find(group => group.id === person.groupId)?.officialName ?? 'gruppo non indicato')}</small></span><button type="button" class="text-link" data-admin-unlink="${esc(person.id)}">Scollega</button></div>`).join('') || '<p class="admin-note">Nessun parlamentare collegato. Il dataset non attribuisce i parlamentari ai partiti: i collegamenti aggiunti qui sono amministrativi.</p>'}
      <div class="admin-link-add"><label>Cerca un parlamentare<input type="search" data-admin-link-query value="${esc(admin.linkQuery)}" placeholder="Almeno 2 lettere…" autocomplete="off" /></label>${candidates.length ? `<select data-admin-link-select>${candidates.map(person => `<option value="${esc(person.id)}">${esc(person.fullName)} · ${person.chamber === 'camera' ? 'Camera' : 'Senato'}</option>`).join('')}</select><button type="button" class="secondary-button" data-admin-link="${esc(selected.id)}">Collega</button>` : ''}</div></section>`;
  }
  return `<div class="admin-split"><aside class="admin-list"><label class="admin-search">Cerca partito<input type="search" data-admin-query value="${esc(admin.query)}" placeholder="Nome o sigla…" autocomplete="off" /></label>${list}</aside><div class="admin-main">${editor}</div></div>`;
}

function politiciansTab(admin, context) {
  const query = norm(admin.query);
  const people = context.politicians.filter(person => (admin.chamber === 'all' || person.chamber === admin.chamber) && (!query || norm(person.fullName).includes(query)));
  const selected = context.politicians.find(person => person.id === admin.politicianId) ?? null;
  const list = searchList(people, admin.politicianId, 'admin-select-politician', person => `<span class="admin-chamber">${person.chamber === 'camera' ? 'C' : 'S'}</span><span><strong>${esc(person.fullName)}</strong><small>${esc(context.groups.find(group => group.id === person.groupId)?.officialName ?? 'Gruppo non indicato')}</small></span>`);
  let editor = '<div class="admin-empty">Scegli un deputato o un senatore dall’elenco.</div>';
  if (selected) {
    const original = context.pristine('politicians', selected.id);
    const datasetRoles = context.offices.filter(office => office.politicianId === selected.id);
    editor = `<form class="admin-editor" data-admin-form="politician" data-admin-id="${esc(selected.id)}" data-admin-collection="politicians">
      <header class="admin-editor-head"><span class="admin-avatar">${esc(selected.fullName.split(/\s+/).map(word => word[0]).join('').slice(0, 2))}</span><div><span class="section-kicker">${selected.chamber === 'camera' ? 'DEPUTATO' : 'SENATORE'} · DATASET REALE</span><h3>${esc(selected.fullName)}</h3><small>${selected.adminEdited ? `Modificato dall’amministratore · ${esc((selected.adminEdited.updatedAt ?? '').slice(0, 10))}` : 'Nessuna modifica: valori del dataset verificato'}${selected.sourceUrl ? ` · <a href="${esc(selected.sourceUrl)}" target="_blank" rel="noopener noreferrer">Scheda ufficiale ↗</a>` : ''}</small></div></header>
      <div class="admin-fields">${editorFields('politicians', selected, original, context)}</div>
      <div class="admin-actions"><button class="primary-button" type="submit">Salva modifiche</button>${overrideFor('politicians', selected.id) ? '<button type="button" class="secondary-button" data-admin-reset-record>Ripristina i dati originali</button>' : ''}</div>
    </form>
    <section class="admin-block"><h4>${glyph('ministry', 16)} Incarichi</h4>${datasetRoles.map(office => `<div class="admin-link-row"><span><strong>${esc(office.title)}</strong><small>${esc(office.institution ?? '')} · dal ${esc(office.startDate ?? 'n.d.')} · dataset verificato</small></span></div>`).join('')}${(selected.adminRoles ?? []).map(role => `<div class="admin-link-row is-edited"><span><strong>${esc(role.title)}</strong><small>${esc(role.institution ?? '')}${role.startDate ? ` · dal ${esc(role.startDate)}` : ''}${role.endDate ? ` al ${esc(role.endDate)}` : ''} · aggiunto dall’amministratore</small></span><button type="button" class="text-link" data-admin-remove-role="${esc(role.id)}">Rimuovi</button></div>`).join('')}
      <form class="admin-role-form" data-admin-role-form data-admin-id="${esc(selected.id)}"><label>Incarico<input name="title" maxlength="160" required placeholder="Es. Presidente di commissione" /></label><label>Istituzione<input name="institution" maxlength="160" placeholder="Es. Camera dei deputati" /></label><label>Dal<input type="date" name="startDate" /></label><label>Al<input type="date" name="endDate" /></label><button class="secondary-button" type="submit">Aggiungi incarico</button></form></section>`;
  }
  return `<div class="admin-split"><aside class="admin-list"><label class="admin-search">Cerca per nome<input type="search" data-admin-query value="${esc(admin.query)}" placeholder="Nome o cognome…" autocomplete="off" /></label><label class="admin-search">Camera<select data-admin-chamber><option value="all" ${admin.chamber === 'all' ? 'selected' : ''}>Camera e Senato</option><option value="camera" ${admin.chamber === 'camera' ? 'selected' : ''}>Camera</option><option value="senato" ${admin.chamber === 'senato' ? 'selected' : ''}>Senato</option></select></label>${list}</aside><div class="admin-main">${editor}</div></div>`;
}

function archiveTab() {
  const summary = adminArchiveSummary();
  return `<div class="admin-archive"><section class="admin-block"><h4>${glyph('book', 16)} Archivio amministrativo</h4><p><strong>${summary.parties}</strong> partiti e <strong>${summary.politicians}</strong> politici modificati${summary.updatedAt ? ` · ultimo salvataggio ${esc(summary.updatedAt.slice(0, 16).replace('T', ' '))}` : ''}.</p><p class="admin-note">Le modifiche sono salvate in un archivio separato di questo browser e applicate sopra il dataset reale ogni volta che il gioco si apre. Restano anche dopo gli aggiornamenti del codice, finché l’archivio non viene cancellato (o non vengono cancellati i dati del sito dal browser). Esporta una copia per sicurezza o per usarla su un altro dispositivo.</p><div class="admin-actions"><button type="button" class="primary-button" data-admin-export>Esporta archivio (JSON)</button><label class="secondary-button admin-file">Importa archivio<input type="file" accept="application/json,.json" data-admin-import hidden /></label><button type="button" class="secondary-button danger" data-admin-clear>Cancella tutte le modifiche</button></div></section>
    <section class="admin-block"><h4>${glyph('shield', 16)} PIN</h4><form class="admin-lock-form" data-admin-pin-form><label>Nuovo PIN<input type="password" name="pin" minlength="6" autocomplete="new-password" required /></label><label>Ripeti<input type="password" name="confirm" minlength="6" autocomplete="new-password" required /></label><button class="secondary-button" type="submit">Cambia PIN</button></form></section></div>`;
}

export function renderAdminPanel(admin, context) {
  const tabs = [['partiti', 'Partiti', 'flag'], ['politici', 'Politici', 'users'], ['archivio', 'Archivio', 'book']];
  const hero = `<section class="admin-hero"><div>${glyph('shield', 30)}<div><span class="section-kicker">AREA AMMINISTRATIVA · PROPRIETARIO</span><h2>Dati di partiti e politici</h2><p>Le correzioni diventano un livello separato sopra il dataset reale: i file originali non cambiano mai.</p></div></div>${context.unlocked ? '<button class="secondary-button" data-admin-lock>Blocca</button>' : ''}</section>`;
  if (!context.unlocked) return `<div class="admin-page">${hero}${lockScreen(context.hasPin, admin.message)}</div>`;
  if (context.loading) return `<div class="admin-page">${hero}<div class="catalog-state" role="status"><span class="catalog-spinner" aria-hidden="true"></span><strong>Carico partiti e parlamentari…</strong></div></div>`;
  const body = admin.tab === 'politici' ? politiciansTab(admin, context) : admin.tab === 'archivio' ? archiveTab() : partiesTab(admin, context);
  return `<div class="admin-page">${hero}<nav class="admin-tabs">${tabs.map(([id, label, icon]) => `<button type="button" class="${admin.tab === id ? 'is-active' : ''}" data-admin-tab="${id}">${glyph(icon, 16)} ${label}</button>`).join('')}</nav>${admin.message ? `<p class="admin-message" role="status">${esc(admin.message)}</p>` : ''}${body}</div>`;
}
