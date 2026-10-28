// "In Aula questa settimana": cards of verified real parliamentarians of the chamber on screen, picked by
// `featuredMembers` (deterministic, varied from week to week). Names, groups, constituencies and offices are
// the dataset's own; nothing here is a statement or an opinion of the person.
import { FEATURED_REASONS, featuredMembers } from '../core/featured-members.js?v=20261028-2';
import { glyph, artTile } from './visuals.js?v=20261028-2';
import { esc } from './sections-kit.js?v=20261028-2';
import { affiliationOf, markForPerson } from './person-marks.js?v=20261028-2';

const CHAMBER_NAME = { camera: 'Camera dei deputati', senato: 'Senato della Repubblica' };

export function featuredMembersFor(state, db = {}, view = {}) {
  const parliament = state.parliament;
  // After a general election of the game the Chambers are simulated: the real people no longer sit there.
  if (!parliament || parliament.legislature?.reference === 'simulation') return null;
  const chamber = ['camera', 'senato'].includes(view.chamber) ? view.chamber : parliament.player?.chamber ?? 'camera';
  const player = state.dataset?.politicians?.find(item => item.id === state.career?.playerId) ?? null;
  const seed = [state.career?.id ?? state.career?.playerId ?? 'scenario', chamber, state.game?.week?.index ?? 0, parliament.player?.groupId ?? 'senza-gruppo'].join('|');
  return { chamber, seed, picks: featuredMembers({ politicians: db.politicians ?? [], groups: db.parliamentaryGroups ?? [], offices: db.offices ?? [], committees: db.committees ?? [], committeeMemberships: db.committeeMemberships ?? [] }, { chamber, seed, count: 6, playerGroupId: parliament.player?.chamber === chamber ? parliament.player?.groupId ?? null : null, territoryHint: player?.region ?? '' }) };
}

export function renderFeaturedMembers(state, db = {}, view = {}) {
  const featured = featuredMembersFor(state, db, view);
  if (!featured) return '';
  const { chamber, picks } = featured;
  if (!picks.length) return '<section class="hq-panel featured-members"><div class="home-section-heading"><div><span class="section-kicker">PARLAMENTARI REALI</span><h2>In Aula questa settimana</h2></div></div><p class="quiet-copy">Le schede dei parlamentari compaiono appena è caricato l’archivio del Parlamento.</p></section>';
  const cards = picks.map(({ person, reason, detail, groupName }) => `<article class="contact-card featured-card">
      <header>${affiliationOf(person.id) ? markForPerson(person.id, 'md') : artTile(person.chamber === 'senato' ? 'dome' : 'users', '#3C7C95', 'sm')}<div><strong>${esc(person.fullName)}</strong><small>${esc(CHAMBER_NAME[person.chamber] ?? '')} · ${esc(groupName ?? 'Gruppo non indicato')}${person.circoscription ? ` · ${esc(person.circoscription)}` : ''}</small>${detail ? `<small class="verified-role">${glyph('shield', 12)} ${esc(detail)}</small>` : ''}</div></header>
      <footer><span class="badge">${esc(FEATURED_REASONS[reason] ?? FEATURED_REASONS.aula)}</span><span class="badge badge-real">${glyph('shield', 12)} Dato reale verificato</span>${person.sourceUrl ? `<a class="catalog-source" href="${esc(person.sourceUrl)}" target="_blank" rel="noopener noreferrer">Scheda ufficiale ↗</a>` : ''}<button type="button" class="text-link" data-hemi-seat="${esc(person.id)}" data-hemi-scroll="1">Mostra nell’emiciclo</button></footer>
    </article>`).join('');
  return `<section class="hq-panel featured-members" data-featured-chamber="${esc(chamber)}"><div class="home-section-heading"><div><span class="section-kicker">PARLAMENTARI REALI · ${esc(CHAMBER_NAME[chamber].toUpperCase())}</span><h2>In Aula questa settimana</h2></div></div><div class="contact-grid">${cards}</div><p class="parliament-note">La scelta cambia ogni settimana e con la Camera che stai guardando, ma resta la stessa per la stessa settimana. Nome, gruppo, circoscrizione e incarico sono del dataset verificato; non sono dichiarazioni né posizioni attribuite alle persone.</p></section>`;
}
