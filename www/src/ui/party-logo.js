// Logo builder for parties created by the player: shape, symbol, two colours and the initials.
// The symbols are generic geometric marks, chosen to avoid the traditional emblems of existing parties.
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const hex = value => /^#[\da-f]{6}$/i.test(value ?? '') ? value : null;

export const LOGO_SHAPES = Object.freeze({
  cerchio: { label: 'Cerchio', path: '<circle cx="60" cy="60" r="54"/>' },
  scudo: { label: 'Scudo', path: '<path d="M60 6 106 22v34c0 30-20 48-46 58C34 104 14 86 14 56V22z"/>' },
  quadrato: { label: 'Quadrato', path: '<rect x="8" y="8" width="104" height="104" rx="18"/>' },
  esagono: { label: 'Esagono', path: '<path d="M60 4 108 32v56L60 116 12 88V32z"/>' },
  goccia: { label: 'Goccia', path: '<path d="M60 6c26 30 46 50 46 72a46 46 0 0 1-92 0C14 56 34 36 60 6z"/>' },
  rombo: { label: 'Rombo', path: '<path d="M60 4 112 60 60 116 8 60z"/>' },
  ottagono: { label: 'Ottagono', path: '<path d="M38 6h44l32 32v44l-32 32H38L6 82V38z"/>' },
  arco: { label: 'Arco', path: '<path d="M16 112V56a44 44 0 0 1 88 0v56z"/>' },
  pentagono: { label: 'Pentagono', path: '<path d="M60 6 112 44 92 110H28L8 44z"/>' }
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
  cuore: { label: 'Cuore', path: '<path d="M60 86C36 70 28 58 28 48a14 14 0 0 1 32-6 14 14 0 0 1 32 6c0 10-8 22-32 38z"/>' },
  bussola: { label: 'Bussola', path: '<circle cx="60" cy="62" r="24"/><path d="M60 44l7 18-7 18-7-18z"/>' },
  casa: { label: 'Tetto', path: '<path d="M30 64 60 38l30 26M38 58v28h44V58M54 86V70h12v16"/>' },
  bilancia: { label: 'Bilancia', path: '<path d="M60 38v48M44 86h32M34 50h52M34 50 24 70h20zM86 50 76 70h20z"/>' },
  faro: { label: 'Faro', path: '<path d="M52 88 56 50h8l4 38zM54 50l6-10 6 10M44 38h-8M76 38h8M46 30l-6-4M74 30l6-4M52 70h16"/>' },
  chiave: { label: 'Chiave', path: '<circle cx="46" cy="52" r="12"/><path d="M56 60 86 90M74 78l8-8M82 86l8-8"/>' },
  razzo: { label: 'Razzo', path: '<path d="M60 36c12 10 14 28 8 46H52c-6-18-4-36 8-46zM52 82l-8 8M68 82l8 8"/><circle cx="60" cy="56" r="4"/>' }
});
// The second colour of the logo (its outline, its symbol and its initials): gold unless the player chooses another, with a palette of ready colours.
export const DEFAULT_LOGO_SECONDARY = '#f2c14e';
export const LOGO_SECONDARY_PALETTE = Object.freeze(['#f2c14e', '#ffffff', '#f4efe4', '#e63946', '#f4845f', '#2a9d8f', '#4cc9f0', '#264d82', '#6a4c93', '#1b1b1f']);
export const isLogoColor = value => /^#[\da-f]{6}$/i.test(value ?? '');

export function partyLogoSvg({ shape = 'cerchio', symbol = 'freccia', primary = '#264d82', secondary = DEFAULT_LOGO_SECONDARY, text = '' } = {}) {
  const base = LOGO_SHAPES[shape] ?? LOGO_SHAPES.cerchio;
  const mark = LOGO_SYMBOLS[symbol] ?? LOGO_SYMBOLS.freccia;
  const fill = hex(primary) ?? '#264d82';
  const ink = hex(secondary) ?? DEFAULT_LOGO_SECONDARY;
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
  if (logo.kind === 'builder') return partyLogoDataUrl({ ...logo, primary: logo.primary ?? party.color, secondary: logo.secondary, text: logo.text ?? party.abbreviation });
  return null;
}
