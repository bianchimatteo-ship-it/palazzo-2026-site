// Logo builder for parties created by the player: shape, symbol, two colours and the initials.
// The symbols are generic geometric marks, chosen to avoid the traditional emblems of existing parties.
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const hex = value => /^#[\da-f]{6}$/i.test(value ?? '') ? value : null;

export const LOGO_SHAPES = Object.freeze({
  cerchio: { label: 'Cerchio', path: '<circle cx="60" cy="60" r="54"/>' },
  scudo: { label: 'Scudo', path: '<path d="M60 6 106 22v34c0 30-20 48-46 58C34 104 14 86 14 56V22z"/>' },
  quadrato: { label: 'Quadrato', path: '<rect x="8" y="8" width="104" height="104" rx="18"/>' },
  esagono: { label: 'Esagono', path: '<path d="M60 4 108 32v56L60 116 12 88V32z"/>' },
  goccia: { label: 'Goccia', path: '<path d="M60 6c26 30 46 50 46 72a46 46 0 0 1-92 0C14 56 34 36 60 6z"/>' }
});
export const LOGO_SYMBOLS = Object.freeze({
  freccia: { label: 'Freccia', path: '<path d="M30 74 60 40l30 34M60 42v42"/>' },
  onda: { label: 'Onde', path: '<path d="M26 58c8-8 16-8 22 0s14 8 22 0 16-8 24 0M26 76c8-8 16-8 22 0s14 8 22 0 16-8 24 0"/>' },
  foglia: { label: 'Foglia', path: '<path d="M36 84c0-26 16-44 48-48-2 30-20 48-48 48zM36 84l30-30"/>' },
  torre: { label: 'Torre', path: '<path d="M44 86V46h32v40M40 46h40M46 46v-8h6v8M58 46v-8h6v8M70 46v-8h6v8M56 86V72h8v14"/>' },
  ponte: { label: 'Ponte', path: '<path d="M22 80h76M28 80c0-20 14-32 32-32s32 12 32 32M44 80V64M60 80V58M76 80V64"/>' },
  ali: { label: 'Ali', path: '<path d="M60 72c-10-18-24-24-38-22 8 10 20 18 38 22zM60 72c10-18 24-24 38-22-8 10-20 18-38 22zM60 72v14"/>' },
  cerchi: { label: 'Cerchi', path: '<circle cx="48" cy="62" r="16"/><circle cx="72" cy="62" r="16"/>' },
  spiga: { label: 'Spiga', path: '<path d="M60 90V36M60 44l-10-8M60 44l10-8M60 56l-11-8M60 56l11-8M60 68l-11-8M60 68l11-8"/>' },
  libro: { label: 'Libro', path: '<path d="M60 44c-10-6-22-6-32-2v40c10-4 22-4 32 2 10-6 22-6 32-2V42c-10-4-22-4-32 2zM60 44v40"/>' },
  montagna: { label: 'Montagna', path: '<path d="M22 84 48 46l12 16 10-12 28 34z"/>' },
  ingranaggio: { label: 'Ingranaggio', path: '<circle cx="60" cy="62" r="12"/><path d="M60 38v8M60 78v8M36 62h8M76 62h8M43 45l6 6M71 73l6 6M43 79l6-6M71 51l6-6"/>' },
  cuore: { label: 'Cuore', path: '<path d="M60 86C36 70 28 58 28 48a14 14 0 0 1 32-6 14 14 0 0 1 32 6c0 10-8 22-32 38z"/>' }
});

export function partyLogoSvg({ shape = 'cerchio', symbol = 'freccia', primary = '#264d82', secondary = '#f2c14e', text = '' } = {}) {
  const base = LOGO_SHAPES[shape] ?? LOGO_SHAPES.cerchio;
  const mark = LOGO_SYMBOLS[symbol] ?? LOGO_SYMBOLS.freccia;
  const fill = hex(primary) ?? '#264d82';
  const ink = hex(secondary) ?? '#f2c14e';
  const initials = String(text ?? '').trim().slice(0, 5).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="${esc(initials || 'Logo')}"><g fill="${fill}" stroke="${ink}" stroke-width="4">${base.path}</g><g fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 ${initials ? -8 : 0})">${mark.path}</g>${initials ? `<text x="60" y="104" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-weight="800" font-size="${initials.length > 3 ? 13 : 16}" fill="${ink}" letter-spacing="1">${esc(initials)}</text>` : ''}</svg>`;
}
export function partyLogoDataUrl(logo = {}) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(partyLogoSvg(logo))}`;
}
// The logo of a party created by the player, whatever way it was made.
export function userPartyLogo(party) {
  const logo = party?.logo;
  if (!logo) return null;
  if (logo.kind === 'builder') return partyLogoDataUrl({ ...logo, primary: logo.primary ?? party.color, secondary: logo.secondary ?? party.color2, text: logo.text ?? party.abbreviation });
  if (logo.kind === 'url' && /^https?:\/\//i.test(logo.url ?? '')) return logo.url;
  return null;
}
