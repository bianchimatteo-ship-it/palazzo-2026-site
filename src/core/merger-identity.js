// The identity of the party born from a merger, chosen by the player BEFORE the confirmation: which name (the own, the partner's, both joined, a completely custom one), the initials, the colours and
// the logo (the own, the partner's, a new one drawn with shapes and symbols, or one the player uploads and declares usable). Pure functions: the store applies the result to the party of the player
// (only a party founded by the player: the name of an existing real party is never changed), keeping the previous identity in a history of the merger. Nothing here invents a real logo or a real name.
const HEX = /^#[\da-f]{6}$/i;
const short = value => String(value ?? '').replace(/\s*\(.*\)\s*$/, '').trim();
export const NAME_MODES = Object.freeze(['own', 'partner', 'both', 'custom']);
export const LOGO_MODES = Object.freeze(['own', 'partner', 'new', 'upload']);
export const initialsOf = text => short(text).split(/[\s–-]+/).filter(word => word.length > 2 || /^[A-Z]/.test(word)).map(word => word[0].toUpperCase()).join('').slice(0, 6);
// own / partner: { label, abbreviation, color, color2?, logo? }; draft: what the form sent.
export function resolveMergerIdentity(own, partner, draft = {}) {
  const mode = NAME_MODES.includes(draft.nameMode) ? draft.nameMode : 'own';
  const ownName = short(own.label), partnerName = short(partner.label);
  let label;
  if (mode === 'partner') label = partnerName;
  else if (mode === 'both') label = `${ownName} – ${partnerName}`;
  else if (mode === 'custom') label = String(draft.label ?? '').trim();
  else label = ownName;
  label = label.slice(0, 60);
  if (label.length < 3) throw new Error('Il nome del nuovo soggetto deve avere almeno tre caratteri.');
  const defaultAbbr = mode === 'partner' ? (partner.abbreviation ?? initialsOf(label)) : mode === 'both' ? `${own.abbreviation ?? initialsOf(ownName)}${partner.abbreviation ?? initialsOf(partnerName)}` : mode === 'custom' ? initialsOf(label) : (own.abbreviation ?? initialsOf(label));
  const abbreviation = String(draft.abbreviation ?? '').trim().toUpperCase().slice(0, 6) || String(defaultAbbr).toUpperCase().slice(0, 6);
  if (abbreviation.length < 2) throw new Error('La sigla deve avere almeno due caratteri.');
  const color = HEX.test(draft.color ?? '') ? draft.color : (HEX.test(own.color ?? '') ? own.color : '#264d82');
  const color2 = HEX.test(draft.color2 ?? '') ? draft.color2 : (HEX.test(own.color2 ?? '') ? own.color2 : (HEX.test(partner.color ?? '') ? partner.color : '#f2c14e'));
  const logoMode = LOGO_MODES.includes(draft.logoMode) ? draft.logoMode : 'own';
  let logo;
  if (logoMode === 'partner') {
    if (!partner.logo && !partner.hasLogo) throw new Error('Il partner non ha un logo da adottare: scegli un altro logo.');
    logo = partner.logo ?? { kind: 'ref', partyId: partner.id };
  } else if (logoMode === 'new') logo = { kind: 'builder', shape: String(draft.logoShape ?? 'cerchio'), symbol: String(draft.logoSymbol ?? 'freccia'), secondary: color2 };
  else if (logoMode === 'upload') {
    if (!draft.logoRights) throw new Error('Per caricare un logo dichiara di averne i diritti di utilizzo.');
    logo = { kind: 'upload' };
  } else logo = own.logo ?? { kind: 'builder', shape: 'cerchio', symbol: 'freccia', secondary: color2 };
  return { nameMode: mode, label, abbreviation, color, color2, logoMode, logo };
}
// What the merger leaves in the history of the party: the previous identity and the new one, so that nothing is lost.
export const mergerRecord = ({ date, week, partner, previous, identity, members = 0 }) => ({ date, week, partnerId: partner.id, partnerLabel: short(partner.label), members, previous: { label: previous.label, abbreviation: previous.abbreviation ?? null, color: previous.color ?? null, color2: previous.color2 ?? null, logo: previous.logo ?? null }, identity: { label: identity.label, abbreviation: identity.abbreviation, color: identity.color, color2: identity.color2, logoMode: identity.logoMode, nameMode: identity.nameMode } });
