// In-game archive of the real data: every tab reads the verified snapshot and never the simulation.
import { realDatabase } from '../data/repositories/real-data.js?v=20260924-17';
import { renderPartyArchive } from './party-archive.js?v=20260924-17';
import { renderPoliticianArchive } from './politician-archive.js?v=20260924-17';
import { renderRealLaws } from './real-laws.js?v=20260924-17';
import { glyph } from './visuals.js?v=20260924-17';
import { esc } from './charts.js?v=20260924-17';

export const ARCHIVE_TABS = Object.freeze([
  ['partiti', 'flag', 'Partiti e movimenti'],
  ['deputati', 'users', 'Deputati'],
  ['senatori', 'users', 'Senatori'],
  ['gruppi', 'dome', 'Gruppi parlamentari'],
  ['governo', 'ministry', 'Governo in carica'],
  ['leggi', 'law', 'Leggi e atti'],
  ['territori', 'map', 'Territori']
]);
// Collections each tab needs, loaded on demand.
export const ARCHIVE_COLLECTIONS = Object.freeze({
  partiti: ['parties', 'politicalMovements', 'territories', 'electionParticipations', 'twoPerThousand'],
  deputati: ['politicians', 'parliamentaryGroups', 'partyMemberships'],
  senatori: ['politicians', 'parliamentaryGroups', 'partyMemberships'],
  gruppi: ['parliamentaryGroups', 'groupMemberships', 'politicians'],
  governo: ['government', 'politicians'],
  leggi: ['laws'],
  territori: ['territories', 'politicians']
});

const number = value => Number(value).toLocaleString('it-IT');
const sourceLink = record => record?.sourceUrl ? `<a class="catalog-source" href="${esc(record.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(record.sourceName ?? 'Fonte')} ↗</a>` : '';
const regionKey = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').replace(/[^a-z]/g, '');

function groupsTab() {
  const groups = realDatabase.parliamentaryGroups ?? [];
  const memberships = realDatabase.groupMemberships ?? [];
  const people = new Map((realDatabase.politicians ?? []).map(person => [person.id, person]));
  const chamber = id => groups.filter(group => group.chamber === id).sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0)).map(group => {
    const members = memberships.filter(item => item.groupId === group.id).map(item => people.get(item.politicianId)).filter(Boolean).sort((a, b) => a.fullName.localeCompare(b.fullName, 'it'));
    return `<details class="archive-row"><summary><span class="catalog-mark" aria-hidden="true">${id === 'camera' ? 'C' : 'S'}</span><span class="catalog-main"><strong>${esc(group.officialName)}</strong><span>${group.memberCount ?? members.length} componenti${group.countAsOf ? ` al ${esc(group.countAsOf)}` : ''}</span></span><span class="verified-badge">Dato reale verificato</span></summary><div class="archive-members">${members.map(person => `<button type="button" class="chip-button" data-politician-profile="${esc(person.id)}">${esc(person.fullName)}</button>`).join('') || '<span class="quiet-copy">Composizione nominativa non disponibile nel dataset.</span>'}</div>${sourceLink(group)}</details>`;
  }).join('');
  return `<div class="archive-columns"><section><h3>Camera dei deputati</h3>${chamber('camera')}</section><section><h3>Senato della Repubblica</h3>${chamber('senato')}</section></div><p class="catalog-footnote">Il gruppo parlamentare è un’aggregazione nelle Camere e non coincide con il partito: le due relazioni restano separate.</p>`;
}

function governmentTab() {
  const government = (realDatabase.government ?? [])[0];
  if (!government) return '<div class="catalog-empty">Il governo in carica non è presente nello snapshot dei dati reali.</div>';
  const offices = new Map();
  for (const member of government.members) offices.set(member.office, [...(offices.get(member.office) ?? []), member]);
  const rows = [...offices.entries()].map(([office, members]) => `<article class="archive-office"><h4>${esc(office)}</h4>${members.map(member => `<div class="archive-member"><div><strong>${esc(member.fullName)}</strong><span>${esc(member.role)}</span><small>Dal ${esc(member.startDate)}</small></div>${member.politicianId ? `<button type="button" class="text-link" data-politician-profile="${esc(member.politicianId)}">Scheda da deputato</button>` : ''}${sourceLink(member)}</div>`).join('')}</article>`).join('');
  return `<div class="archive-lead"><span class="section-kicker">DATO REALE · ${esc(government.sourceName ?? 'Camera dei deputati')}</span><h3>${esc(government.label)}</h3><p>In carica dal ${esc(government.startDate)} · XIX legislatura · ${government.members.length} incarichi di governo. I nomi sono riportati come nella fonte.</p></div><div class="archive-offices">${rows}</div><p class="catalog-footnote">Il governo reale resta invariato: in partita il governo è quello della simulazione, formato e sostenuto dalle scelte dei gruppi e del giocatore.</p>`;
}

function territoriesTab() {
  const territories = realDatabase.territories ?? [];
  const deputies = (realDatabase.politicians ?? []).filter(person => person.chamber === 'camera' && !person.termEnd);
  const regions = territories.filter(item => item.kind === 'regione');
  const rows = regions.map(region => {
    const count = deputies.filter(person => regionKey(person.circoscription).startsWith(regionKey(region.officialName))).length;
    return `<article class="archive-territory"><strong>${esc(region.officialName)}</strong><span>${count ? `${count} deputati eletti nelle circoscrizioni della regione` : 'Deputati per circoscrizione non ricavabili dal dataset'}</span>${sourceLink(region)}</article>`;
  }).join('');
  return `<div class="archive-lead"><span class="section-kicker">DATO REALE</span><h3>Italia · ${regions.length} regioni</h3><p>Le regioni del dataset e i deputati in carica eletti nelle rispettive circoscrizioni. Umore, servizi ed economia dei territori in partita sono simulati e si trovano nella sezione Territori.</p></div><div class="archive-territories">${rows}</div>`;
}

// The tab body alone: the catalog filters redraw only this part, keeping focus in the search field.
export function renderArchiveBody(archive, { catalog, status = {}, logoFor, realLaws, canPropose = false } = {}) {
  const tab = ARCHIVE_TABS.some(([id]) => id === archive.tab) ? archive.tab : 'partiti';
  return tab === 'partiti' ? renderPartyArchive(catalog, { status, logoFor })
    : tab === 'deputati' || tab === 'senatori' ? renderPoliticianArchive(catalog, { status })
    : tab === 'gruppi' ? groupsTab()
    : tab === 'governo' ? governmentTab()
    : tab === 'leggi' ? renderRealLaws(realDatabase.laws ?? [], realLaws, { canPropose })
    : territoriesTab();
}

export function renderArchiveHub(archive, options = {}) {
  const { status = {} } = options;
  const tab = ARCHIVE_TABS.some(([id]) => id === archive.tab) ? archive.tab : 'partiti';
  const tabs = `<nav class="archive-tabs" aria-label="Sezioni dell’archivio">${ARCHIVE_TABS.map(([id, icon, label]) => `<button type="button" class="archive-tab ${tab === id ? 'active' : ''}" data-archive-tab="${id}" aria-pressed="${tab === id}">${glyph(icon, 16)}<span>${esc(label)}</span></button>`).join('')}</nav>`;
  if (status.error) return `${tabs}<div class="catalog-state catalog-state-error" role="alert"><strong>Archivio non disponibile</strong><span>${esc(status.error)}</span><button type="button" data-action="retry-database">Riprova</button></div>`;
  if (status.loading) return `${tabs}<div class="catalog-state" role="status"><span class="catalog-spinner" aria-hidden="true"></span><strong>Carico i dati reali…</strong></div>`;
  const manifest = realDatabase.manifest ?? {};
  return `${tabs}<div class="archive-body" data-catalog-body>${renderArchiveBody(archive, options)}</div><p class="catalog-footnote">Snapshot dei dati reali del ${esc(manifest.snapshotDate ?? '—')} · ${number(manifest.collections?.politicians ?? 0)} parlamentari · ${number((manifest.collections?.parties ?? 0) + (manifest.collections?.politicalMovements ?? 0))} organizzazioni · ${number(manifest.collections?.laws ?? 0)} atti. Nessun dato di questa pagina viene modificato dal gioco.</p>`;
}
