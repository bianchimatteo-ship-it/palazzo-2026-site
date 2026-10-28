// The visual identity of the player's party, in one place. Every screen that shows "my party" takes the same colour, mark and name from here, so that the career
// reads as the party's while the app keeps its institutional green. Pure functions on records: nothing is saved, nothing is drawn here but strings.
//
// Colour of a party, first that exists:
//   1. the colour its owner or the player chose (a party founded in the game, or an owner's correction: `party.color`, or the `brandColor` of its force in the polls);
//   2. the colour measured on its official logo (src/data/party-brand.js), when the database holds a logo but no colour (Futuro Nazionale);
//   3. the colour the game gave its line in the charts (`force.color`);
//   4. none: an independent has a neutral sage and no mark, never an invented colour or symbol.
// The colour is shown as it is, lightened (same hue) only when it would disappear into the dark interface; its ink (text on it) is the one with the best contrast (inkOn).
//
// The party is not the coalition, the parliamentary group or the institution: those have their own tones (KIND_TONES) and their own glyph, whatever the party colour is,
// so that a chip says at a glance whether it speaks of the party, of the list it stands in with others, of the group in the Chamber or of the institution.
import { LOGO_BRAND } from '../data/party-brand.js?v=20261028-3';
import { contrastRatio, emblem, glyph, inkOn, partyMarkText } from './visuals.js?v=20261028-3';

export const NEUTRAL_ACCENT = '#9fb0a2';
// What a party colour must stand out from: the lightest panel of the app (for text), and the shell and the second panel (for lines, bars and fills).
export const TEXT_SURFACE = '#232520';
export const SHELL_SURFACE = '#10231b';
export const PANEL_SURFACE = '#1d1e1a';
const toRgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const toHex = rgb => `#${rgb.map(value => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('')}`;
function toHsl(hex) {
  const [r, g, b] = toRgb(hex).map(value => value / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function fromHsl([h, s, l]) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const channel = t => { t = (t + 1) % 1; return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p); };
  return toHex([channel(h + 1 / 3), channel(h), channel(h - 1 / 3)]);
}
// The colour made lighter (same hue and saturation) until it has the contrast asked with every surface; a colour that already has it is returned as it is, so a colour the party
// chose is shown exactly as chosen unless it would disappear into the dark interface.
function liftContrast(color, surfaces, minimum) {
  if (surfaces.every(surface => contrastRatio(color, surface) >= minimum)) return color;
  const [h, s, l] = toHsl(color);
  for (let step = 1; step <= 60; step++) {
    const out = fromHsl([h, s, Math.min(0.97, l + step * 0.012)]);
    if (surfaces.every(surface => contrastRatio(out, surface) >= minimum)) return out;
  }
  return '#ffffff';
}
// A second tone for a party that has only one colour: the same hue, lighter on a dark primary and deeper on a light one. Pure, and only a presentation: nothing is saved.
export function deriveSecondary(hex) {
  const [h, s, l] = toHsl(hex);
  return fromHsl([h, s * 0.85, l < 0.5 ? Math.min(0.78, l + 0.28) : Math.max(0.22, l - 0.28)]);
}
// The accent as written text on the panels: 4.5:1.
export const accentAsText = accent => liftContrast(accent, [TEXT_SURFACE], 4.5);
// The accent as a line, a bar or a fill (non-text graphics): 3:1 against the shell and the panels.
export const accentAsGraphic = color => liftContrast(color, [SHELL_SURFACE, PANEL_SURFACE], 3);
const hexOf = value => /^#[\da-f]{6}$/i.test(value ?? '') ? value.toLowerCase() : null;
const SOURCE_LABELS = Object.freeze({
  scelto: 'colore scelto dal partito',
  logo: 'colore del logo ufficiale',
  grafico: 'colore assegnato dal gioco ai grafici',
  neutro: 'nessun colore: indipendente'
});

// { kind, id, name, abbreviation, mark, logo, accent, accentText (the accent as written text), accentInk (text on the accent), accent2, source, sourceLabel }
export function partyIdentity({ party = null, force = null, logo = null } = {}) {
  if (!party && !force) {
    return { kind: 'indipendente', id: null, name: 'Indipendente', abbreviation: null, mark: null, logo: null, accent: NEUTRAL_ACCENT, accentText: accentAsText(NEUTRAL_ACCENT), accentInk: inkOn(NEUTRAL_ACCENT), accent2: null, source: 'neutro', sourceLabel: SOURCE_LABELS.neutro };
  }
  const id = party?.id ?? force?.id ?? null;
  const own = hexOf(party?.color) ?? hexOf(force?.brandColor);
  const brand = LOGO_BRAND[id] ?? null;
  const chart = hexOf(force?.color);
  const base = own ?? hexOf(brand?.primary) ?? chart ?? null;
  const source = own ? 'scelto' : brand?.primary ? 'logo' : chart ? 'grafico' : 'neutro';
  const accent = base ? accentAsGraphic(base) : NEUTRAL_ACCENT;
  // The only colour of a party is its primary one. The second tone (a decoration of the shell) is always derived from it: `color2` of old records and the secondary of a logo are never used.
  const second = base ? deriveSecondary(base) : null;
  const secondSource = second ? 'derivato' : null;
  const name = party?.officialName ?? party?.name ?? party?.label ?? force?.label ?? 'Partito';
  const abbreviation = party?.abbreviation ?? force?.abbreviation ?? null;
  return { kind: 'partito', id, name, abbreviation, mark: partyMarkText({ label: name, abbreviation }), logo: logo ?? null, accent, accentText: accentAsText(accent), accentInk: inkOn(accent), accent2: second ? accentAsGraphic(second) : null, colors: { primary: base, secondary: second }, secondSource, source, sourceLabel: SOURCE_LABELS[source] };
}

// The CSS variables of an identity, for the style attribute of the application shell: the accent, the ink on it, the second colour, a tint and a line made of it.
export function identityVars(identity) {
  const { accent, accentText, accentInk, accent2 } = identity ?? partyIdentity();
  return `--party-accent:${accent};--party-accent-text:${accentText};--party-accent-ink:${accentInk};--party-accent-2:${accent2 ?? accent};--party-accent-soft:color-mix(in srgb, ${accent} 16%, transparent);--party-accent-line:color-mix(in srgb, ${accent} 52%, transparent)`;
}

// What a chip speaks of. The party takes the accent of the career; the others keep their own tone and glyph.
export const KIND_TONES = Object.freeze({
  partito: Object.freeze({ label: 'Partito', icon: 'flag', tone: 'var(--party-accent)' }),
  coalizione: Object.freeze({ label: 'Coalizione', icon: 'link', tone: '#6aa9c4' }),
  gruppo: Object.freeze({ label: 'Gruppo parlamentare', icon: 'users', tone: '#c4a66a' }),
  istituzione: Object.freeze({ label: 'Istituzione', icon: 'ministry', tone: '#7fbf99' }),
  indipendente: Object.freeze({ label: 'Indipendente', icon: 'user', tone: NEUTRAL_ACCENT })
});
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// A chip with the glyph of its kind (never colour alone) and the name; `title` says what it is for readers who do not see the colour.
export function kindChip(kind, text) {
  const tone = KIND_TONES[kind] ?? KIND_TONES.istituzione;
  return `<span class="kind-chip kind-${esc(kind in KIND_TONES ? kind : 'istituzione')}" title="${esc(tone.label)}">${glyph(tone.icon, 14)}<b>${esc(text)}</b></span>`;
}

// The mark of the party: its logo, otherwise its abbreviation (or initials) on its colour; an independent has a plain person glyph, never an invented symbol.
export function identityMark(identity, size = 'sm') {
  if (!identity || identity.kind === 'indipendente') return `<span class="emblem emblem-${size} emblem-ghost" aria-hidden="true">${glyph('user', size === 'lg' ? 28 : 17)}</span>`;
  return emblem({ label: identity.name, abbreviation: identity.mark, color: identity.accent, logo: identity.logo }, size);
}
// The chip of the sidebar: the party of the career (mark, name, the player's role in it); for an independent, that there is no party yet.
export function partyChip(identity, role = null) {
  const independent = identity.kind === 'indipendente';
  const title = independent ? 'Senza partito' : `${identity.name} · ${identity.sourceLabel}`;
  return `<button class="party-identity" data-kind="${identity.kind}" data-nav="partito" title="${esc(title)}">${identityMark(identity)}<span><strong>${esc(independent ? 'Indipendente' : identity.abbreviation || identity.name)}</strong><small>${esc(independent ? 'Senza tessera di partito' : role || 'Partito')}</small></span></button>`;
}
// The same identity on the top bar, for the widths where the sidebar is folded away.
export function topbarParty(identity) {
  const independent = identity.kind === 'indipendente';
  return `<span class="topbar-party" data-kind="${identity.kind}" role="img" aria-label="${esc(independent ? 'Carriera da indipendente' : `Il tuo partito: ${identity.name}`)}">${identityMark(identity)}</span>`;
}
