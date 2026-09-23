// Inline SVG visuals: every glyph is drawn here, no external image is loaded.
const PATHS = Object.freeze({
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z M15 9a3 3 0 0 1 0 6 M18 6a7 7 0 0 1 0 12',
  storm: 'M7 16a4 4 0 1 1 .6-7.95A5 5 0 0 1 17 9a3.5 3.5 0 0 1 0 7 M12 13l-2 4h3l-2 4',
  scandal: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z M20 20l-4-4 M11 8v4 M11 14.5h.01',
  media: 'M4 7h16v11H4z M9 3l3 4 3-4 M8 21h8',
  mic: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z M6 11a6 6 0 0 0 12 0 M12 17v4 M9 21h6',
  link: 'M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1 M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1',
  unlink: 'M9 15l-1.5 1.5a3.5 3.5 0 0 1-5-5L4 10 M15 9l1.5-1.5a3.5 3.5 0 0 1 5 5L20 14 M8 8 6 6 M16 16l2 2',
  ballot: 'M5 4h14v17H5z M8 8l1.5 1.5L12 7 M8 14l1.5 1.5L12 13 M14 9h2 M14 15h2',
  money: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Z M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  factory: 'M3 21V10l6 4V10l6 4V6h6v15z M7 17h2 M12 17h2 M17 17h2',
  dome: 'M3 21h18 M5 21v-8 M19 21v-8 M9 21v-8 M15 21v-8 M4 13h16 M6 13a6 6 0 0 1 12 0 M12 4v3',
  ministry: 'M3 21h18 M4 10h16 M12 3 3 8h18z M6 10v9 M10 10v9 M14 10v9 M18 10v9',
  crown: 'M3 18h18 M4 18 3 7l5 4 4-6 4 6 5-4-1 11',
  star: 'm12 3 2.6 5.6 6 .7-4.5 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.4 9.3l6-.7z',
  flag: 'M5 21V4 M5 4h11l-2 4 2 4H5',
  chart: 'M4 19V5 M4 19h17 M8 15l4-4 3 2 5-6',
  leaf: 'M5 19c0-8 5-14 15-14 0 10-6 15-14 15 M5 19l7-7',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 21V5 M9 7h6',
  cross: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z M9 12l2 2 4-4',
  bridge: 'M3 18h18 M3 12h18 M6 12v6 M18 12v6 M3 12c3-4 15-4 18 0 M12 9v9',
  scales: 'M12 3v18 M8 21h8 M5 7h14 M5 7l-3 6a3 3 0 0 0 6 0z M19 7l-3 6a3 3 0 0 0 6 0z',
  heart: 'M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9Z',
  briefcase: 'M4 8h16v11H4z M9 8V5h6v3 M4 13h16',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M2 21a7 7 0 0 1 14 0 M17 11a3 3 0 1 0 0-6 M22 21a5 5 0 0 0-5-5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M5 21a7 7 0 0 1 14 0',
  town: 'M3 21h18 M5 21V10l7-5 7 5v11 M9 21v-5h6v5 M12 5V2 M12 2h3v2h-3',
  energy: 'M13 2 4 14h7l-1 8 9-12h-7z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M3 12h18 M12 3c3 3.2 3 14.8 0 18 M12 3c-3 3.2-3 14.8 0 18',
  alert: 'M12 3 2 20h20z M12 10v4 M12 17h.01',
  split: 'M6 3v6a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3 M12 15v6',
  law: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 13h6 M9 17h4',
  pin: 'M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  trophy: 'M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4',
  route: 'M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M8 18h4a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3'
});

export function glyph(name, size = 20, stroke = 1.7) {
  return `<svg class="glyph" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATHS[name] ?? PATHS.star}"/></svg>`;
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const EVENT_ICONS = Object.freeze({
  protesta: 'megaphone', collaboratore: 'scandal', rivale: 'users', 'lista-civica': 'link', 'prima-serata': 'media', congresso: 'crown', finanziatore: 'money',
  maltempo: 'storm', 'tensione-maggioranza': 'dome', decreto: 'law', corteggiamento: 'split', 'crisi-ministero': 'ministry', 'sindacati-vertenza': 'factory',
  'presa-posizione': 'megaphone', espulsione: 'unlink', dimissioni: 'alert', finanziamento: 'scandal',
  inaugurazione: 'town', assemblea: 'flag', imprenditori: 'briefcase', sindacati: 'users', radio: 'mic', festa: 'star', scuola: 'book',
  audizione: 'dome', 'riunione-gruppo': 'users', 'dossier-ministero': 'ministry'
});
export const CATEGORY_VISUALS = Object.freeze({
  territorio: { icon: 'pin', color: '#1baf7a' }, media: { icon: 'mic', color: '#2a78d6' }, partito: { icon: 'flag', color: 'var(--party-accent)' },
  parlamento: { icon: 'dome', color: '#c0a166' }, relazioni: { icon: 'link', color: '#4a3aa7' }, risorse: { icon: 'money', color: '#eda100' }, elezioni: { icon: 'ballot', color: '#e34948' }
});
export const LAW_ICONS = Object.freeze({
  Economia: 'money', Lavoro: 'briefcase', Sanità: 'cross', Scuola: 'book', Sicurezza: 'shield', Ambiente: 'leaf', Infrastrutture: 'bridge',
  Giustizia: 'scales', Welfare: 'heart', 'Pubblica amministrazione': 'ministry'
});
export function officeIcon(office) {
  const title = `${office?.title ?? ''} ${office?.level ?? ''}`;
  if (/ministr/i.test(title)) return 'star';
  if (/commissione/i.test(title)) return 'law';
  if (/partito/i.test(office?.level ?? '')) return 'flag';
  if (/deputat|senat|parlamento/i.test(title)) return 'dome';
  if (/sindac/i.test(title)) return 'town';
  if (/regione|regional/i.test(title)) return 'pin';
  if (/consiglier/i.test(title)) return 'users';
  return 'route';
}

// A square tile with a tinted field and one large glyph: the visual anchor of a card.
export function artTile(icon, color = 'var(--party-accent)', size = 'md') {
  return `<span class="art-tile art-${size}" style="--art:${esc(color)}" aria-hidden="true"><svg class="art-rings" viewBox="0 0 64 64"><circle cx="54" cy="10" r="18"/><circle cx="54" cy="10" r="28"/><circle cx="54" cy="10" r="38"/></svg>${glyph(icon, size === 'lg' ? 30 : size === 'sm' ? 18 : 24, 1.6)}</span>`;
}

// Ink that stays readable on a given fill.
export function inkOn(hex) {
  if (!/^#[\da-f]{6}$/i.test(hex ?? '')) return '#fffdf7';
  const [r, g, b] = [1, 3, 5].map(index => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.36 ? '#1f2a24' : '#fffdf7';
}

// Party mark: the verified logo when available, otherwise initials on the party colour.
export function emblem({ label, abbreviation, color, logo = null }, size = 'md') {
  const initials = String(label ?? 'P').split(/[\s\-–—/]+/).map(word => word.replace(/[^\p{L}\p{N}]/gu, '')[0]).filter(Boolean).join('');
  const text = (abbreviation || initials || 'P').slice(0, 3).toUpperCase();
  const fill = color || '#8c988b';
  return logo
    ? `<span class="emblem emblem-${size} has-logo" style="--emblem:${esc(fill)}"><img src="${esc(logo)}" alt="" loading="lazy" /></span>`
    : `<span class="emblem emblem-${size}" style="--emblem:${esc(fill)};color:${inkOn(fill)}" aria-hidden="true">${esc(text)}</span>`;
}
