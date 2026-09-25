// The party mark of any real parliamentarian, wherever a list of people is drawn (contacts, rivals, admin lists).
// The link comes from the database (party-links), the logo from the same resolver the party archive uses.
import { realDatabase } from '../data/repositories/real-data.js?v=20260925-4';
import { politicianAffiliation } from '../data/repositories/party-links.js?v=20260925-4';
import { personMark } from './visuals.js?v=20260925-4';

let resolveLogo = () => null;
export function setPartyLogoResolver(resolver) { resolveLogo = typeof resolver === 'function' ? resolver : () => null; }
export function markForPerson(personOrId, size = 'sm') {
  const id = typeof personOrId === 'string' ? personOrId : personOrId?.id;
  const person = (realDatabase.politicians ?? []).find(item => item.id === id) ?? (typeof personOrId === 'object' ? personOrId : null);
  if (!person) return personMark({ chamber: 'camera' }, size);
  const link = politicianAffiliation(person);
  return personMark({ chamber: person.chamber, link, logo: link ? resolveLogo(link.entity) : null }, size);
}
export function affiliationOf(personOrId) {
  const id = typeof personOrId === 'string' ? personOrId : personOrId?.id;
  const person = (realDatabase.politicians ?? []).find(item => item.id === id);
  return person ? politicianAffiliation(person) : null;
}
