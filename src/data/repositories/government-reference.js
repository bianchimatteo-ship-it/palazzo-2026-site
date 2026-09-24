// The Government a career finds in office when it starts, derived from the real data and never written by hand:
// the parliamentary groups of the members of the real Government in office, the group of the real Prime Minister
// and which group holds each ministry. The career then turns this into a simulated Government (see
// createReferenceGovernment in parliament-engine): the real records stay untouched and separate.
import { realDatabase } from './real-data.js?v=20260924-21';

const key = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').replace(/\s+/g, ' ').trim();
// Real ministries → portfolios of the simulation (only the ones the game models; the others are left out).
const PORTFOLIO_RULES = [
  [/economia e delle finanze/i, 'Economia e finanze'], [/imprese/i, 'Imprese'], [/lavoro/i, 'Lavoro'], [/salute/i, 'Salute'],
  [/istruzione/i, 'Istruzione'], [/universit/i, 'Università e ricerca'], [/infrastrutture/i, 'Infrastrutture'], [/ambiente/i, 'Ambiente'],
  [/agricoltura/i, 'Agricoltura'], [/dell'interno|dell’interno/i, 'Interno'], [/difesa/i, 'Difesa'], [/giustizia/i, 'Giustizia'],
  [/famiglia/i, 'Famiglia'], [/sport/i, 'Sport e giovani'], [/cultura/i, 'Cultura'], [/turismo/i, 'Turismo'],
  [/pubblica amministrazione/i, 'Pubblica amministrazione'], [/affari regionali/i, 'Affari regionali'], [/affari europei/i, 'Affari europei e Sud'],
  [/affari esteri/i, 'Esteri']
];
export const portfolioOfRole = role => /^ministr[oa]\b/i.test(String(role ?? '').trim()) ? PORTFOLIO_RULES.find(([pattern]) => pattern.test(role))?.[1] ?? null : null;

export function referenceGovernmentSpec(db = realDatabase) {
  const government = (db.government ?? []).find(item => item.source === 'real' && item.verified === true && !item.endDate) ?? null;
  const people = db.politicians ?? [];
  if (!government || !people.length || !(db.parliamentaryGroups ?? []).length) return null;
  const byId = new Map(people.map(person => [person.id, person]));
  // Senators are not linked by the Camera data: an exact, unique full name identifies them.
  const byName = new Map();
  for (const person of people) { const name = key(person.fullName); byName.set(name, byName.has(name) ? null : person); }
  const members = (government.members ?? []).filter(item => item.source === 'real' && item.verified === true && !item.endDate)
    .map(member => ({ member, person: byId.get(member.politicianId) ?? byName.get(key(member.fullName)) ?? null }));
  const groupIds = [...new Set(members.map(item => item.person?.groupId).filter(Boolean))];
  const premier = members.find(item => /^presidente del consiglio/i.test(item.member.role));
  const ministries = [];
  for (const { member, person } of members) {
    const portfolio = portfolioOfRole(member.role);
    if (portfolio && !ministries.some(item => item.portfolio === portfolio)) ministries.push({ portfolio, groupId: person?.groupId ?? null });
  }
  return {
    governmentId: government.id, label: government.label, startDate: government.startDate, sourceUrl: government.sourceUrl, sourceName: government.sourceName,
    groupIds, premierGroupId: premier?.person?.groupId ?? null, ministries, members: members.length, parliamentarians: members.filter(item => item.person).length,
    source: 'real', derivedFrom: 'componenti del governo reale e loro gruppi parlamentari'
  };
}
