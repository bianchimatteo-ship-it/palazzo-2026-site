import { realDatabase } from '../data/repositories/real-data.js?v=20260924-1';

const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const pageSize = 18;

function select(label, key, options, value = 'all') {
  return `<label class="catalog-filter"><span>${label}</span><select data-catalog-filter="${key}">${options.map(([id,name]) => `<option value="${esc(id)}" ${value === id ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>`;
}
function logoMark(party, logoFor) {
  const src = logoFor?.(party);
  const name = party.officialName;
  return src
    ? `<span class="organization-logo"><img src="${esc(src)}" alt="${esc(party.logoAlt || `Logo di ${name}`)}" loading="lazy" /></span>`
    : `<span class="organization-logo organization-logo-empty" aria-label="Logo non disponibile"><span aria-hidden="true">—</span></span>`;
}
function loadingOrError(status, retry) {
  if (status?.error) return `<div class="catalog-state catalog-state-error" role="alert"><strong>Archivio non disponibile</strong><span>${esc(status.error)}</span><button type="button" data-action="retry-database">Riprova</button></div>`;
  if (status?.loading) return `<div class="catalog-state" role="status"><span class="catalog-spinner" aria-hidden="true"></span><strong>Carico l’archivio dei partiti…</strong><span>Il resto della carriera resta disponibile.</span></div>`;
  return '';
}

export function renderPartyArchive(filters, { status = {}, logoFor = () => null } = {}) {
  const state = loadingOrError(status);
  if (state) return `<div class="catalog-shell"><div class="catalog-summary"><strong>${realDatabase.manifest?.collections?.parties ?? 0} partiti · ${realDatabase.manifest?.collections?.politicalMovements ?? 0} movimenti</strong><span>Snapshot al ${esc(realDatabase.manifest?.snapshotDate ?? '—')}</span></div>${state}</div>`;

  const all = [...(realDatabase.parties ?? []), ...(realDatabase.politicalMovements ?? [])];
  const regions = (realDatabase.territories ?? []).filter(item => item.kind === 'regione').sort((a,b) => a.officialName.localeCompare(b.officialName, 'it'));
  const options = {
    partyPresence: [['all','Rappresentanza: tutte'],['yes','Presente'],['no','Non presente'],['unknown','Non documentata']],
    partyType: [['all','Tipo: tutti'],['party','Partiti'],['politicalMovement','Movimenti']],
    partyLevel: [['all','Livello: tutti'],['national','Nazionale'],['regional','Regionale'],['local','Locale'],['unknown','Non documentato']],
    partyRegion: [['all','Regione: tutte'],['unknown','Regione non documentata'],...regions.map(item => [item.id,item.officialName])],
    partyStatus: [['all','Stato: tutti'],['active','Attivo'],['inactive','Non attivo'],['historical','Storico'],['unknown','Non documentato']],
    partyElection: [['all','Elezioni: tutte'],['yes','Partecipazione collegata'],['unknown','Nessun collegamento documentato']],
    partySort: [['name','Ordine alfabetico'],['representation','Rappresentanza documentata']]
  };
  const toolbar = `<div class="catalog-toolbar"><label class="catalog-search"><span>Cerca un partito o movimento</span><input type="search" data-catalog-filter="partyQuery" value="${esc(filters.partyQuery)}" placeholder="Nome o sigla…" autocomplete="off" /></label>${Object.entries(options).map(([key,items]) => select('',key,items,filters[key])).join('')}</div>`;
  const results = filterParties(all, filters);
  const regionNames = new Map(regions.map(item => [item.id,item.officialName]));
  const currentPage = Math.max(1, Number(filters.partyPage) || 1);
  const visible = results.slice(0,currentPage*pageSize);
  const cards = visible.map(party => {
    const kind = party.entityType === 'politicalMovement' ? 'Movimento politico' : 'Partito politico';
    const presence = party.parliamentaryPresence == null ? 'Rappresentanza non documentata' : party.parliamentaryPresence ? 'Presenza parlamentare' : 'Senza presenza parlamentare';
    const statusLabel = party.status === 'active' ? 'Attivo nel registro' : party.status === 'historical' ? 'Storico' : party.status === 'inactive' ? 'Non attivo' : 'Stato non documentato';
    const levelLabel = ({national:'Nazionale',regional:'Regionale',local:'Locale'})[party.level] || party.level;
    const area = [levelLabel, party.regionId ? regionNames.get(party.regionId) : null].filter(Boolean).join(' · ') || 'Livello territoriale non documentato';
    const description = party.factualDescription || 'Descrizione non disponibile nelle fonti consultate.';
    return `<article class="organization-card"><button type="button" class="organization-open" data-party-profile="${esc(party.id)}" aria-label="Apri il profilo di ${esc(party.officialName)}">${logoMark(party,logoFor)}<span class="organization-copy"><strong>${esc(party.officialName)}</strong><span>${esc(party.abbreviation || 'Sigla non documentata')} · ${kind}</span><small>${esc(description)}</small></span><span class="organization-facts"><span>${esc(statusLabel)}</span><span>${esc(area)}</span><span>${esc(presence)}</span></span><span class="verified-badge">Dato reale verificato</span></button><a class="catalog-source" href="${esc(party.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fonte del dato ↗</a></article>`;
  }).join('');
  const empty = '<div class="catalog-empty">Nessun partito o movimento corrisponde ai filtri selezionati. Rimuovi un filtro o prova un’altra ricerca.</div>';
  const pagination = visible.length < results.length ? `<div class="catalog-pagination"><span>Mostrati ${visible.length} di ${results.length}</span><button type="button" data-catalog-more="partyPage">Mostra altri 18</button></div>` : `<div class="catalog-pagination"><span>${results.length} risultati</span></div>`;
  return `<div class="catalog-shell"><div class="catalog-summary"><strong>${all.length} partiti e movimenti</strong><span>Registro, partecipazioni documentate e fonti ufficiali · snapshot ${esc(realDatabase.manifest.snapshotDate)}</span></div>${toolbar}<div class="catalog-result-count" aria-live="polite">${results.length} risultati</div><div class="organization-list">${cards || empty}</div>${results.length ? pagination : ''}<p class="catalog-footnote">Le formazioni sono classificate come partiti o movimenti secondo la fonte; liste, coalizioni e gruppi parlamentari restano entità separate. I valori assenti non sono dedotti.</p></div>`;
}

function filterParties(source, filters) {
  let rows = source;
  const query = String(filters.partyQuery ?? '').trim().toLocaleLowerCase('it-IT');
  if (query) rows = rows.filter(item => [item.officialName,item.abbreviation,item.factualDescription,item.website].some(value => String(value ?? '').toLocaleLowerCase('it-IT').includes(query)));
  if (filters.partyType !== 'all') rows = rows.filter(item => item.entityType === filters.partyType);
  if (filters.partyPresence !== 'all') rows = rows.filter(item => filters.partyPresence === 'unknown' ? item.parliamentaryPresence == null : item.parliamentaryPresence === (filters.partyPresence === 'yes'));
  if (filters.partyLevel !== 'all') rows = rows.filter(item => filters.partyLevel === 'unknown' ? !item.level : item.level === filters.partyLevel);
  if (filters.partyRegion !== 'all') rows = rows.filter(item => filters.partyRegion === 'unknown' ? !item.regionId : item.regionId === filters.partyRegion);
  if (filters.partyStatus !== 'all') rows = rows.filter(item => filters.partyStatus === 'unknown' ? !item.status : item.status === filters.partyStatus);
  if (filters.partyElection !== 'all') rows = rows.filter(item => {
    const documented = (realDatabase.electionParticipations ?? []).some(entry => entry.partyId === item.id);
    return filters.partyElection === 'unknown' ? !documented : documented;
  });
  rows = [...rows];
  rows.sort((a,b) => filters.partySort === 'representation'
    ? (Number(b.parliamentaryRepresentation ?? 0) - Number(a.parliamentaryRepresentation ?? 0)) || a.officialName.localeCompare(b.officialName,'it')
    : a.officialName.localeCompare(b.officialName,'it'));
  return rows;
}

export function renderPartyProfile(id, logoFor = () => null) {
  const party = [...(realDatabase.parties ?? []), ...(realDatabase.politicalMovements ?? [])].find(item => item.id === id);
  if (!party) return '';
  const leaders = (realDatabase.partyLeaderships ?? []).filter(item => item.partyId === id).map(item => {
    const person = (realDatabase.politicalFigures ?? []).find(entry => entry.id === item.politicalFigureId);
    return person ? `<li><strong>${esc(item.role)}</strong><span>${esc(person.fullName)}</span><a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fonte ↗</a></li>` : '';
  }).join('');
  const logo = logoFor(party);
  const alt = party.logoAlt || `Logo di ${party.officialName}`;
  const status = party.status === 'active' ? 'Attivo nel registro' : party.status === 'historical' ? 'Storico' : party.status || 'Non documentato';
  const field = (label,value) => `<dt>${label}</dt><dd>${value ? esc(value) : 'Non documentato'}</dd>`;
  return `<div class="profile-modal-backdrop" data-party-backdrop><section class="politician-profile organization-profile" role="dialog" aria-modal="true" aria-labelledby="organization-title"><button class="profile-modal-close" data-profile-close aria-label="Chiudi">×</button><span class="verified-badge">Dato reale verificato</span><div class="organization-profile-head">${logo ? `<img src="${esc(logo)}" alt="${esc(alt)}" />` : `<span class="organization-logo organization-logo-empty" aria-hidden="true">—</span>`}<div><h2 id="organization-title">${esc(party.officialName)}</h2><p>${party.entityType === 'politicalMovement' ? 'Movimento politico' : 'Partito politico'} · ${esc(party.abbreviation || 'Sigla non documentata')}</p></div></div><dl>${field('Stato',status)}${field('Livello',party.level)}${field('Regione',party.regionId ? (realDatabase.territories ?? []).find(item => item.id === party.regionId)?.officialName : null)}${field('Rappresentanza parlamentare',party.parliamentaryPresence == null ? null : party.parliamentaryPresence ? 'Presenza documentata' : 'Assenza documentata')}${field('Sito ufficiale',party.website)}${field('Descrizione',party.factualDescription)}</dl>${leaders ? `<section class="organization-leadership"><h3>Organi documentati</h3><ul>${leaders}</ul></section>` : ''}<div class="organization-sources"><a href="${esc(party.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(party.sourceName || 'Fonte primaria del dato')} ↗</a>${party.website ? `<a href="${esc(party.website)}" target="_blank" rel="noopener noreferrer">Sito ufficiale ↗</a>` : ''}${party.logoSource ? `<a href="${esc(party.logoSource)}" target="_blank" rel="noopener noreferrer">Fonte del logo ↗</a>` : ''}${party.logoVerified ? '<span class="verified-badge">Logo ufficiale verificato</span>' : ''}${(party.secondarySources ?? []).length ? `<section class="organization-sources organization-secondary-sources"><h3>Altre fonti verificate</h3>${party.secondarySources.map(source => `<a href="${esc(source.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(source.sourceName || 'Fonte aggiuntiva')} ↗</a>`).join('')}</section>` : ''}</div></section></div>`;
}
