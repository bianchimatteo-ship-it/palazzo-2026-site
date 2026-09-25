import { realDatabase } from '../data/repositories/real-data.js?v=20260925-1';
import { BASIS_LABELS, electionListOf, groupAffiliation, groupLabel, inOffice, politicianAffiliation } from '../data/repositories/party-links.js?v=20260925-1';
import { personMark } from './visuals.js?v=20260925-1';

const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const pageSize = 48;
const date = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
function select(key, options, value = 'all') {
  return `<label class="catalog-filter"><span></span><select data-catalog-filter="${key}">${options.map(([id,name]) => `<option value="${esc(id)}" ${value === id ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>`;
}
// Party, group (and component), election list: four relations, never mixed.
const listLine = list => list ? `${list.label}${list.entity ? ` (${list.kind === 'coalition-list' ? 'coalizione' : 'partito'}: ${list.entity.officialName})` : ' (lista di più partiti)'}` : null;

export function renderPoliticianArchive(filters, { status = {}, logoFor = () => null } = {}) {
  if (status.error) return `<div class="catalog-state catalog-state-error" role="alert"><strong>Archivio non disponibile</strong><span>${esc(status.error)}</span><button type="button" data-action="retry-database">Riprova</button></div>`;
  if (status.loading) return `<div class="catalog-state" role="status"><span class="catalog-spinner" aria-hidden="true"></span><strong>Carico l’archivio dei politici…</strong><span>Le schede dettagliate vengono caricate solo quando le apri.</span></div>`;
  const people = realDatabase.politicians ?? [];
  const groups = realDatabase.parliamentaryGroups ?? [];
  // Current party: the owner's link or a documented membership. Never the group, never the 2022 list.
  const links = new Map(people.map(person => [person.id, politicianAffiliation(person)]));
  const memberships = new Map(people.map(person => [person.id, groupAffiliation(person)]));
  const linkedEntities = new Map([...links.values()].filter(Boolean).map(link => [link.entity.id, link.entity]));
  const partyOptions = [...linkedEntities.values()].map(entity => [entity.id, entity.officialName]).sort((a,b) => a[1].localeCompare(b[1],'it'));
  const groupName = group => { const component = group.officialName.match(/^MISTO\s*[-–]\s*(.+)$/i)?.[1]; return component ? `Misto · componente ${component}` : /^misto$/i.test(group.officialName.trim()) ? 'Misto' : group.officialName; };
  const groupOptions = groups.map(group => [group.id,`${groupName(group)} · ${group.chamber === 'camera' ? 'Camera' : 'Senato'}`]).sort((a,b) => a[1].localeCompare(b[1],'it'));
  const controls = `<div class="catalog-toolbar politician-toolbar"><label class="catalog-search"><span>Cerca una persona</span><input type="search" data-catalog-filter="politicianQuery" value="${esc(filters.politicianQuery)}" placeholder="Nome o cognome…" autocomplete="off" /></label>${select('politicianChamber',[['all','Camera e Senato'],['camera','Camera'],['senato','Senato']],filters.politicianChamber)}${select('politicianParty',[['all',partyOptions.length ? 'Tutti i partiti documentati' : 'Partito: non documentato'],['none','Nessun partito documentato'],...partyOptions],filters.politicianParty)}${select('politicianGroup',[['all','Tutti i gruppi parlamentari'],...groupOptions],filters.politicianGroup)}</div>`;
  let filtered = people;
  const query = String(filters.politicianQuery ?? '').trim().toLocaleLowerCase('it-IT');
  if (query) filtered = filtered.filter(person => person.fullName.toLocaleLowerCase('it-IT').includes(query));
  if (filters.politicianChamber !== 'all') filtered = filtered.filter(person => person.chamber === filters.politicianChamber);
  if (filters.politicianParty === 'none') filtered = filtered.filter(person => !links.get(person.id));
  else if (filters.politicianParty !== 'all') filtered = filtered.filter(person => links.get(person.id)?.entity.id === filters.politicianParty);
  // The Misto group includes its components.
  if (filters.politicianGroup !== 'all') filtered = filtered.filter(person => { const own = memberships.get(person.id); return own?.group?.id === filters.politicianGroup || own?.componentGroup?.id === filters.politicianGroup; });
  filtered = [...filtered].sort((a,b) => Number(!inOffice(a)) - Number(!inOffice(b)) || a.fullName.localeCompare(b.fullName,'it'));
  const visible = filtered.slice(0,Math.max(1,Number(filters.politicianPage)||1)*pageSize);
  const rows = visible.map(person => {
    const chamber = person.chamber === 'camera' ? 'camera' : 'senato';
    const own = memberships.get(person.id);
    const link = links.get(person.id);
    const list = electionListOf(person);
    const ended = !inOffice(person);
    const mark = personMark({ chamber, link, logo: link ? logoFor(link.entity) : null });
    return `<button type="button" class="catalog-row politician-row ${ended ? 'is-former' : ''}" data-politician-profile="${esc(person.id)}">${mark}<span class="catalog-main"><strong>${esc(person.fullName)}</strong><span>${chamber === 'camera' ? (ended ? 'Ex deputato · Camera dei deputati' : 'Deputato · Camera dei deputati') : (ended ? 'Ex senatore · Senato della Repubblica' : 'Senatore · Senato della Repubblica')}${own ? ` · Gruppo ${esc(groupLabel(own))}` : ''}</span><small>${link ? `Partito: ${esc(link.entity.officialName)} (${esc(BASIS_LABELS[link.basis])})` : 'Partito non documentato'}${list ? ` · Lista 2022: ${esc(list.label)}` : ''}${person.birthDate ? ` · Nato il ${esc(person.birthDate)}` : ''}</small></span><span class="verified-badge">${ended ? `Mandato concluso il ${esc(date(person.termEnd))}` : person.adminEdited ? 'Dato reale con correzioni dell’amministratore' : 'Dato reale verificato'}</span><span class="catalog-open">Profilo ↗</span></button>`;
  }).join('');
  const noPartyFacts = '<p class="catalog-footnote">Partito, gruppo parlamentare (con l’eventuale componente del Misto) e lista d’elezione sono relazioni distinte. Il partito attuale viene solo da un collegamento dell’amministratore o da un’iscrizione documentata: il gruppo non è mai un partito e la lista del 2022 non è il partito attuale. Il logo accanto al nome è quello del partito attuale; senza partito documentato resta l’iniziale della Camera.</p>';
  const pagination = visible.length < filtered.length ? `<div class="catalog-pagination"><span>Mostrati ${visible.length} di ${filtered.length}</span><button type="button" data-catalog-more="politicianPage">Mostra altri 48</button></div>` : `<div class="catalog-pagination"><span>${filtered.length} risultati</span></div>`;
  const current = people.filter(person => inOffice(person)).length;
  return `<div class="catalog-shell"><div class="catalog-summary"><strong>${current} parlamentari in carica</strong><span>Deputati e senatori della XIX legislatura · snapshot ${esc(realDatabase.manifest.snapshotDate)}${people.length > current ? ` · ${people.length - current} con mandato concluso` : ''}</span></div>${controls}<div class="catalog-result-count" aria-live="polite">${filtered.length} profili corrispondenti</div><div class="catalog-list">${rows || '<div class="catalog-empty">Nessun politico corrisponde ai filtri selezionati. Rimuovi un filtro o prova un altro nome.</div>'}</div>${filtered.length ? pagination : ''}${noPartyFacts}<p class="catalog-footnote">Ogni profilo collega alla scheda istituzionale d’origine. I dati anagrafici mancanti restano vuoti.</p></div>`;
}

export function renderPoliticianProfile(id, { loading = false, logoFor = () => null } = {}) {
  if (loading) return `<div class="profile-modal-backdrop" data-profile-backdrop><section class="politician-profile" role="dialog" aria-modal="true" aria-label="Caricamento profilo"><button class="profile-modal-close" data-profile-close aria-label="Chiudi">×</button><div class="catalog-state"><span class="catalog-spinner" aria-hidden="true"></span><strong>Carico i dettagli del profilo…</strong></div></section></div>`;
  const person = (realDatabase.politicians ?? []).find(item => item.id === id);
  if (!person) return '';
  const memberships = (realDatabase.groupMemberships ?? []).filter(item => item.politicianId === id).sort((a,b) => String(a.validFrom ?? '').localeCompare(String(b.validFrom ?? '')));
  const offices = (realDatabase.offices ?? []).filter(item => item.politicianId === id);
  const link = politicianAffiliation(person);
  const own = groupAffiliation(person);
  const list = electionListOf(person);
  const ended = !inOffice(person);
  const chamberName = person.chamber === 'camera' ? 'Camera dei deputati' : 'Senato della Repubblica';
  const items = [
    ['Partito attuale', link ? `${link.entity.officialName} — ${link.detail}` : 'Non documentato: nessun collegamento dell’amministratore né iscrizione documentata (il gruppo e la lista d’elezione non indicano il partito attuale)'],
    ['Collocazione del partito', link?.entity.politicalPosition ? `${link.entity.politicalPosition} (classificazione del documento del 24/09/2026)` : null],
    ['Gruppo parlamentare', own ? `${own.groupName}${own.corrected ? ' (nell’archivio dell’amministratore è indicato il gruppo con lo stesso nome dell’altra Camera: da correggere in Admin)' : ''}` : null],
    ...(own?.component ? [['Componente del gruppo Misto', own.component]] : []),
    ['Lista d’elezione (2022)', list ? `${listLine(list)} · relazione elettorale, non il partito attuale` : null],
    ['Data di nascita',person.birthDate],['Luogo di nascita',person.birthPlace],['Collegio/circoscrizione',person.constituency || person.circoscription],
    ['Cariche',[...offices.map(item => `${item.title}${item.endDate ? ` (fino al ${date(item.endDate)})` : ''}`), ...(person.adminRoles ?? []).map(role => `${role.title}${role.institution ? `, ${role.institution}` : ''} (aggiunto dall’amministratore)`)].join(', ') || null]
  ];
  if (ended) items.push(['Fine del mandato', `${date(person.termEnd)}${person.mandateEnd?.reason ? ` — ${person.mandateEnd.reason}` : ''}`]);
  const groupHistory = memberships.map(item => {
    const membershipGroup = (realDatabase.parliamentaryGroups ?? []).find(entry => entry.id === item.groupId);
    return `${membershipGroup?.officialName ?? 'Gruppo non disponibile'}: ${item.validFrom || 'data iniziale non disponibile'} – ${item.validTo || 'in carica'}`;
  }).join('; ');
  items.push(['Storico gruppo',groupHistory]);
  // Offices in the government in office, from the Camera open data, linked by the Camera person id.
  const governmentRoles = (realDatabase.government ?? []).flatMap(government => government.members.filter(member => member.politicianId === id).map(member => `${member.role} (${government.label}, dal ${member.startDate})`));
  if (governmentRoles.length) items.push(['Incarico di governo', governmentRoles.join('; ')]);
  const details = items.map(([label,value]) => `<dt>${esc(label)}</dt><dd>${value ? esc(value) : 'Non disponibile nelle fonti caricate'}</dd>`).join('');
  const partySource = link?.basis === 'membership' && link.sourceUrl ? `<a href="${esc(link.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fonte del partito: ${esc(link.sourceName || 'fonte documentata')} ↗</a>` : '';
  const endSource = ended && person.mandateEnd?.sourceUrl ? `<a href="${esc(person.mandateEnd.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(person.mandateEnd.sourceName || 'Fonte istituzionale')} ↗</a>` : '';
  return `<div class="profile-modal-backdrop" data-profile-backdrop><section class="politician-profile" role="dialog" aria-modal="true" aria-labelledby="person-title"><button class="profile-modal-close" data-profile-close aria-label="Chiudi">×</button><span class="verified-badge">${ended ? 'Mandato concluso · dato reale' : 'Dato reale verificato'}</span><div class="person-profile-head">${personMark({ chamber: person.chamber, link, logo: link ? logoFor(link.entity) : null }, 'md')}<h2 id="person-title">${esc(person.fullName)}</h2></div><p>${person.chamber === 'camera' ? (ended ? 'Ex deputato' : 'Deputato') : (ended ? 'Ex senatore' : 'Senatore')} · ${chamberName}</p><dl>${details}</dl><a href="${esc(person.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(person.sourceName || 'Fonte istituzionale')} ↗</a>${partySource}${endSource}</section></div>`;
}
