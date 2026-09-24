import { realDatabase } from '../data/repositories/real-data.js?v=20260924-17';

const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const pageSize = 48;
function select(key, options, value = 'all') {
  return `<label class="catalog-filter"><span></span><select data-catalog-filter="${key}">${options.map(([id,name]) => `<option value="${esc(id)}" ${value === id ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>`;
}

export function renderPoliticianArchive(filters, { status = {} } = {}) {
  if (status.error) return `<div class="catalog-state catalog-state-error" role="alert"><strong>Archivio non disponibile</strong><span>${esc(status.error)}</span><button type="button" data-action="retry-database">Riprova</button></div>`;
  if (status.loading) return `<div class="catalog-state" role="status"><span class="catalog-spinner" aria-hidden="true"></span><strong>Carico l’archivio dei politici…</strong><span>Le schede dettagliate vengono caricate solo quando le apri.</span></div>`;
  const people = realDatabase.politicians ?? [];
  const groups = realDatabase.parliamentaryGroups ?? [];
  const partyMemberships = realDatabase.partyMemberships ?? [];
  const parties = [...(realDatabase.parties ?? []), ...(realDatabase.politicalMovements ?? [])];
  // Owner-made links (admin archive) sit beside documented memberships.
  const partyIds = [...new Set([...partyMemberships.map(item => item.partyId), ...people.map(person => person.partyId).filter(Boolean)])];
  const partyOptions = partyIds.map(id => [id,parties.find(item => item.id === id)?.officialName ?? id]).sort((a,b) => a[1].localeCompare(b[1],'it'));
  const groupOptions = groups.map(group => [group.id,`${group.officialName} · ${group.chamber === 'camera' ? 'Camera' : 'Senato'}`]).sort((a,b) => a[1].localeCompare(b[1],'it'));
  const controls = `<div class="catalog-toolbar politician-toolbar"><label class="catalog-search"><span>Cerca una persona</span><input type="search" data-catalog-filter="politicianQuery" value="${esc(filters.politicianQuery)}" placeholder="Nome o cognome…" autocomplete="off" /></label>${select('politicianChamber',[['all','Camera e Senato'],['camera','Camera'],['senato','Senato']],filters.politicianChamber)}${select('politicianParty',[['all',partyOptions.length ? 'Tutti i partiti documentati' : 'Partito: non documentato'],...partyOptions],filters.politicianParty)}${select('politicianGroup',[['all','Tutti i gruppi parlamentari'],...groupOptions],filters.politicianGroup)}</div>`;
  let filtered = people;
  const query = String(filters.politicianQuery ?? '').trim().toLocaleLowerCase('it-IT');
  if (query) filtered = filtered.filter(person => person.fullName.toLocaleLowerCase('it-IT').includes(query));
  if (filters.politicianChamber !== 'all') filtered = filtered.filter(person => person.chamber === filters.politicianChamber);
  if (filters.politicianParty !== 'all') filtered = filtered.filter(person => person.partyId === filters.politicianParty || partyMemberships.some(item => item.politicianId === person.id && item.partyId === filters.politicianParty));
  if (filters.politicianGroup !== 'all') filtered = filtered.filter(person => person.groupId === filters.politicianGroup);
  filtered = [...filtered].sort((a,b) => a.fullName.localeCompare(b.fullName,'it'));
  const visible = filtered.slice(0,Math.max(1,Number(filters.politicianPage)||1)*pageSize);
  const groupById = new Map(groups.map(group => [group.id,group]));
  const rows = visible.map(person => {
    const chamber = person.chamber === 'camera' ? 'camera' : 'senato';
    const group = groupById.get(person.groupId);
    const linkedParty = partyMemberships.find(item => item.politicianId === person.id);
    const party = parties.find(item => item.id === (linkedParty?.partyId ?? person.partyId));
    return `<button type="button" class="catalog-row politician-row" data-politician-profile="${esc(person.id)}"><span class="catalog-mark" aria-hidden="true">${chamber === 'camera' ? 'C' : 'S'}</span><span class="catalog-main"><strong>${esc(person.fullName)}</strong><span>${chamber === 'camera' ? 'Deputato · Camera dei deputati' : 'Senatore · Senato della Repubblica'}${group ? ` · ${esc(group.officialName)}` : ''}</span><small>${person.birthDate ? `Nato il ${esc(person.birthDate)}` : 'Data di nascita non disponibile'}${person.electedOnList ? ` · Lista d’elezione: ${esc(person.electedOnList)}` : ''}${party ? ` · Partito: ${esc(party.officialName)}` : ''}</small></span><span class="verified-badge">${person.adminEdited ? 'Dato reale con correzioni dell’amministratore' : 'Dato reale verificato'}</span><span class="catalog-open">Profilo ↗</span></button>`;
  }).join('');
  const noPartyFacts = partyMemberships.length ? '' : '<p class="catalog-footnote">Il dataset aggiornato non contiene appartenenze individuali a partiti verificate con una relazione esplicita. Il gruppo parlamentare è mostrato separatamente e non viene usato come sostituto del partito.</p>';
  const pagination = visible.length < filtered.length ? `<div class="catalog-pagination"><span>Mostrati ${visible.length} di ${filtered.length}</span><button type="button" data-catalog-more="politicianPage">Mostra altri 48</button></div>` : `<div class="catalog-pagination"><span>${filtered.length} risultati</span></div>`;
  return `<div class="catalog-shell"><div class="catalog-summary"><strong>${people.length} parlamentari</strong><span>Deputati e senatori in carica nella XIX legislatura · snapshot ${esc(realDatabase.manifest.snapshotDate)}</span></div>${controls}<div class="catalog-result-count" aria-live="polite">${filtered.length} profili corrispondenti</div><div class="catalog-list">${rows || '<div class="catalog-empty">Nessun politico corrisponde ai filtri selezionati. Rimuovi un filtro o prova un altro nome.</div>'}</div>${filtered.length ? pagination : ''}${noPartyFacts}<p class="catalog-footnote">Ogni profilo collega alla scheda istituzionale d’origine. I dati anagrafici mancanti restano vuoti; cariche, gruppo e partito sono relazioni distinte.</p></div>`;
}

export function renderPoliticianProfile(id, { loading = false } = {}) {
  if (loading) return `<div class="profile-modal-backdrop" data-profile-backdrop><section class="politician-profile" role="dialog" aria-modal="true" aria-label="Caricamento profilo"><button class="profile-modal-close" data-profile-close aria-label="Chiudi">×</button><div class="catalog-state"><span class="catalog-spinner" aria-hidden="true"></span><strong>Carico i dettagli del profilo…</strong></div></section></div>`;
  const person = (realDatabase.politicians ?? []).find(item => item.id === id);
  if (!person) return '';
  const group = (realDatabase.parliamentaryGroups ?? []).find(item => item.id === person.groupId);
  const memberships = (realDatabase.groupMemberships ?? []).filter(item => item.politicianId === id).sort((a,b) => String(a.validFrom ?? '').localeCompare(String(b.validFrom ?? '')));
  const offices = (realDatabase.offices ?? []).filter(item => item.politicianId === id);
  const partyMemberships = (realDatabase.partyMemberships ?? []).filter(item => item.politicianId === id);
  const parties = [...(realDatabase.parties ?? []), ...(realDatabase.politicalMovements ?? [])];
  const adminParty = person.partyId ? parties.find(item => item.id === person.partyId) : null;
  const chamberName = person.chamber === 'camera' ? 'Camera dei deputati' : 'Senato della Repubblica';
  const items = [
    ['Partito',partyMemberships.length ? partyMemberships.map(item => parties.find(party => party.id === item.partyId)?.officialName).filter(Boolean).join(', ') : adminParty ? `${adminParty.officialName} (collegamento dell’amministratore)` : 'Non documentato separatamente dal gruppo'],
    ['Lista d’elezione',person.electedOnList],['Gruppo parlamentare',group?.officialName],['Data di nascita',person.birthDate],['Luogo di nascita',person.birthPlace],['Collegio/circoscrizione',person.constituency || person.circoscription],['Cariche',[...offices.map(item => item.title), ...(person.adminRoles ?? []).map(role => `${role.title}${role.institution ? `, ${role.institution}` : ''} (aggiunto dall’amministratore)`)].join(', ') || null]
  ];
  const groupHistory = memberships.map(item => {
    const membershipGroup = (realDatabase.parliamentaryGroups ?? []).find(entry => entry.id === item.groupId);
    return `${membershipGroup?.officialName ?? 'Gruppo non disponibile'}: ${item.validFrom || 'data iniziale non disponibile'} – ${item.validTo || 'in carica'}`;
  }).join('; ');
  items.push(['Storico gruppo',groupHistory]);
  // Offices in the government in office, from the Camera open data, linked by the Camera person id.
  const governmentRoles = (realDatabase.government ?? []).flatMap(government => government.members.filter(member => member.politicianId === id).map(member => `${member.role} (${government.label}, dal ${member.startDate})`));
  if (governmentRoles.length) items.push(['Incarico di governo', governmentRoles.join('; ')]);
  const details = items.map(([label,value]) => `<dt>${esc(label)}</dt><dd>${value ? esc(value) : 'Non disponibile nelle fonti caricate'}</dd>`).join('');
  return `<div class="profile-modal-backdrop" data-profile-backdrop><section class="politician-profile" role="dialog" aria-modal="true" aria-labelledby="person-title"><button class="profile-modal-close" data-profile-close aria-label="Chiudi">×</button><span class="verified-badge">Dato reale verificato</span><h2 id="person-title">${esc(person.fullName)}</h2><p>${person.chamber === 'camera' ? 'Deputato' : 'Senatore'} · ${chamberName}</p><dl>${details}</dl><a href="${esc(person.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(person.sourceName || 'Fonte istituzionale')} ↗</a></section></div>`;
}
