// The party as an organisation, and the real parliamentarians the career deals with.
import { ORGANS, organOf, treasuryOutlook } from '../core/organization-engine.js?v=20260924-18';
import { affiliationOf, markForPerson } from './person-marks.js?v=20260924-18';
import { contactStance } from '../core/contacts-engine.js?v=20260924-18';
import { SELECTION_METHODS } from '../data/simulation/organization-rules.js?v=20260924-18';
import { artTile, glyph } from './visuals.js?v=20260924-18';
import { illustration } from './illustrations.js?v=20260924-18';
const weeks = count => `${count} ${count === 1 ? 'settimana' : 'settimane'}`;
import { esc, euro, levelState, lineChart, meter, num, SERIES, signed, sparkline, stateBadge, trendState } from './charts.js?v=20260924-18';

const TREND_LABELS = { crescita: 'In crescita', calo: 'In calo', stabile: 'Stabile' };

export function renderOrganizationPanel(state) {
  const game = state.game;
  const party = game?.party;
  const org = party?.org;
  if (!org) return '';
  const organ = organOf(party);
  const weeksToCongress = org.congress.nextWeek - game.week.index;
  const growthState = trendState(org.growth, { threshold: 0.05 });
  const [cohesionState, cohesionLabel] = levelState(org.cohesion, { crisis: 30, risk: 45, good: 65 });
  const sections = [...org.sections].sort((a, b) => b.members - a.members);
  const history = (org.membersHistory ?? []).slice(-26);
  const selections = Object.values(org.selections ?? {}).slice(-4).reverse();
  const organs = ORGANS.map(item => `<li class="${item.level === organ.level ? 'current' : item.level < organ.level ? 'done' : ''}"><span>${esc(item.label)}</span><small>${esc(item.scope)}</small></li>`).join('');
  return `<section class="party-org">
    ${illustration('piazza', 'org-art')}<div class="home-section-heading"><div><span class="section-kicker">IL PARTITO COME ORGANIZZAZIONE · SIMULAZIONE</span><h2>Siedi in: ${esc(organ.label)}</h2><p class="section-subtitle">${esc(organ.detail)}</p></div>${stateBadge(cohesionState, `Coesione ${num(org.cohesion, 0)} · ${cohesionLabel}`)}</div>
    <div class="org-kpis">
      <div><small>ISCRITTI</small><strong>${num(org.members, 0)}</strong>${stateBadge(growthState, `${TREND_LABELS[growthState]} ${org.growth ? `${signed(org.growth)}%` : ''}`.trim())}</div>
      <div><small>MILITANTI ATTIVI</small><strong>${num(org.militants, 0)}</strong><span>${num(org.members ? org.militants / org.members * 100 : 0, 0)}% degli iscritti</span></div>
      <div><small>DIRIGENTI</small><strong>${num(org.cadres, 0)}</strong><span>negli organi</span></div>
      <div><small>SEZIONI</small><strong>${org.sections.length}</strong><span>${org.founder ? 'sezioni territoriali' : 'federazioni regionali'}</span></div>
      <div><small>DISCIPLINA PERSONALE</small><strong>${num(org.discipline, 0)}</strong>${meter(org.discipline, org.discipline < 35 ? 'danger' : '')}</div>
      <div><small>TESORERIA</small><strong>${euro(org.treasury.balance)}</strong><span>${esc(treasuryOutlook(org).statusLabel)}</span></div>
    </div>
    <div class="org-grid">
      <div><div class="home-section-heading"><div><span class="section-kicker">ORGANI INTERNI</span></div></div><ol class="organ-ladder">${organs}</ol>
        <div class="org-agenda"><div>${glyph('crown', 18)}<span><strong>${org.founder ? 'Guidi il partito da fondatore' : weeksToCongress > 0 ? `Congresso ordinario tra ${weeks(weeksToCongress)}` : 'Congresso in corso'}</strong><small>${org.congress.history?.[0] ? `Ultimo congresso: vince ${esc(org.congress.history[0].winner)}${org.congress.history[0].backed ? ' (la tua area)' : ''}` : 'Il congresso elegge la guida e ridisegna gli organi.'}</small></span></div>
        ${selections.length ? selections.map(item => `<div>${glyph('ballot', 18)}<span><strong>${esc(item.election)}</strong><small>${esc(SELECTION_METHODS[item.method] ?? item.method)} · peso sulla candidatura ${signed(item.bonus, 0)}</small></span></div>`).join('') : `<div>${glyph('ballot', 18)}<span><strong>Selezione dei candidati</strong><small>Si apre tre settimane prima di ogni finestra di candidatura.</small></span></div>`}</div>
      </div>
      <div><div class="home-section-heading"><div><span class="section-kicker">ISCRITTI NEL TEMPO</span></div></div>${lineChart({ series: [{ label: 'Iscritti', color: SERIES[0], values: history.map(item => item.members), emphasis: true }], labels: history.map(item => `S${item.week}`), tips: history.map(item => `Settimana ${item.week}`), digits: 0, height: 180, ariaLabel: 'Iscritti al partito per settimana' })}</div>
    </div>
    ${org.conflicts.length ? `<div class="home-section-heading"><div><span class="section-kicker">CONFLITTI APERTI</span></div></div><div class="conflict-list">${org.conflicts.map(conflict => `<div class="conflict-row">${stateBadge(conflict.intensity >= 70 ? 'crisi' : 'rischio', conflict.intensity >= 70 ? 'Scontro aperto' : 'Tensione')}<span>${esc(conflict.title)}</span>${meter(conflict.intensity, conflict.intensity >= 70 ? 'danger' : 'gold')}</div>`).join('')}</div>` : ''}
    <div class="home-section-heading"><div><span class="section-kicker">${org.founder ? 'SEZIONI TERRITORIALI' : 'FEDERAZIONI REGIONALI'}</span></div></div>
    <div class="section-grid">${sections.slice(0, 12).map(section => `<div class="section-tile ${section.region === game.place.region ? 'is-home' : ''}" data-tip="${esc(`${section.label}: ${num(section.members, 0)} iscritti · vitalità ${section.vitality}`)}" tabindex="0"><strong>${esc(section.region)}</strong><small>${num(section.members, 0)} iscritti</small>${meter(section.vitality, section.vitality < 25 ? 'danger' : section.vitality >= 60 ? 'good' : '')}</div>`).join('')}</div>
    ${sections.length > 12 ? `<p class="parliament-note">e altre ${sections.length - 12} federazioni.</p>` : ''}
    <p class="parliament-note">Iscritti, sezioni, organi, conflitti e tesoreria sono una simulazione di gioco anche quando il partito è reale: non descrivono l’organizzazione effettiva del partito.</p>
  </section>`;
}

export function renderPartyCard(state) {
  const party = state.game?.party;
  const org = party?.org;
  if (!org) return '<p class="dash-quiet">Sei indipendente: nessuna struttura alle spalle, nessuna leadership da convincere.</p>';
  const organ = organOf(party);
  const growthState = trendState(org.growth, { threshold: 0.05 });
  const tension = org.conflicts.some(item => item.intensity >= 70) ? ['crisi', 'Scontro interno'] : org.conflicts.length ? ['rischio', 'Tensioni'] : levelState(org.cohesion, { crisis: 30, risk: 45, good: 65 });
  return `<div class="dash-body"><div class="dash-number"><strong>${num(party.support, 0)}</strong><small>/100 sostegno interno</small>${stateBadge(tension[0], tension[1])}</div><p class="dash-role">${glyph('flag', 14)} ${esc(party.rankTitle)} · ${esc(organ.label)}</p><dl class="dash-facts"><div><dt>Iscritti</dt><dd>${num(org.members, 0)} ${org.growth ? `<em class="${growthState}">${signed(org.growth)}%</em>` : ''}</dd></div><div><dt>Sezioni</dt><dd>${org.sections.length}</dd></div><div><dt>Coesione</dt><dd>${num(org.cohesion, 0)}</dd></div><div><dt>Tesoreria</dt><dd>${euro(org.treasury.balance)}</dd></div></dl>${sparkline((org.membersHistory ?? []).slice(-12).map(item => item.members))}</div>`;
}

const REASONS = { territorio: 'Eletto nel tuo territorio', gruppo: 'Collega di gruppo', capogruppo: 'Presidente di gruppo' };
export function renderContactsPanel(state, { compact = false } = {}) {
  const contacts = state.game?.contacts ?? [];
  if (!contacts.length) return `<p class="quiet-copy">I parlamentari reali legati al tuo territorio e al tuo gruppo compariranno qui appena caricato l’archivio del Parlamento.</p>`;
  const busy = !state.game || state.game.status === 'ended' || state.game.week.ap < 1 || state.game.resources.politicalCapital < 1 || state.campaign?.status === 'active';
  const rows = [...contacts].sort((a, b) => b.relation - a.relation).slice(0, compact ? 4 : contacts.length).map(contact => {
    const [stance, label] = contactStance(contact.relation);
    const person = contact.person;
    const chamber = person.chamber === 'senato' ? 'Senato' : 'Camera';
    return `<article class="contact-card stance-${stance}"><header>${affiliationOf(person.id) ? markForPerson(person.id, 'md') : artTile(person.chamber === 'senato' ? 'dome' : 'users', stance === 'ostile' ? '#e34948' : stance === 'alleato' ? '#1baf7a' : '#2a78d6', 'sm')}<div><strong>${esc(person.fullName)}</strong><small>${esc(chamber)} · ${esc(person.groupName ?? 'Gruppo non indicato')}${person.circoscription ? ` · ${esc(person.circoscription)}` : ''}</small>${person.verifiedRole ? `<small class="verified-role">${glyph('shield', 12)} ${esc(person.verifiedRole)}</small>` : ''}</div></header>
      <div class="contact-relation"><span>${esc(label)}</span>${meter(contact.relation, stance === 'ostile' ? 'danger' : stance === 'alleato' ? 'good' : '')}<b>${num(contact.relation, 0)}</b></div>
      <footer><span class="badge">${esc(REASONS[contact.reason] ?? 'Contatto')}</span>${contact.cosigned?.length ? `<span class="badge">${contact.cosigned.length} firme su tue proposte</span>` : ''}${compact ? '' : `${person.sourceUrl ? `<a class="catalog-source" href="${esc(person.sourceUrl)}" target="_blank" rel="noopener noreferrer">Scheda ufficiale ↗</a>` : ''}<button class="secondary-button" data-game-activity="incontro-parlamentare" data-activity-target-value="${esc(person.id)}" ${busy ? 'disabled' : ''}>Incontra · 1 giorno · 1 cap.</button>`}</footer></article>`;
  }).join('');
  return `<div class="contact-grid ${compact ? 'is-compact' : ''}">${rows}</div><p class="parliament-note">Persone reali: nome, Camera, gruppo, circoscrizione e incarichi vengono dal dataset verificato e non sono modificati. Rapporto, firme e iniziative nei loro confronti sono simulati dal gioco.</p>`;
}
