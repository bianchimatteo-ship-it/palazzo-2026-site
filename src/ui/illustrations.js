// Inline line-art scenes for the game's main screens. Drawn here, no external image is loaded;
// the accent follows the player's party colour through currentColor and CSS variables.
const SCENES = Object.freeze({
  // A palazzo facade with colonnade, pediment and flag: the seat of power.
  palazzo: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M40 150V96h240v54"/>
    <path d="M30 96h260M36 88h248M160 34 44 84h232z"/>
    <path class="ill-accent-fill" d="M160 44 72 82h176z"/>
    <path d="M56 96v50M80 96v50M104 96v50M128 96v50M192 96v50M216 96v50M240 96v50M264 96v50"/>
    <path d="M144 150v-34a16 16 0 0 1 32 0v34"/>
    <path d="M24 146h272M18 150h284"/>
    <path d="M160 34V8"/><path class="ill-accent-fill" d="M160 8h26l-6 7 6 7h-26z"/>
    <circle class="ill-accent" cx="160" cy="64" r="7"/>`,
  // A hill town: towers, a dome and houses, for territories and citizens.
  borgo: `<path class="ill-ground" d="M0 150c60-18 120-24 160-22s110 10 160 22"/>
    <path class="ill-soft" d="M18 150v-38h34v38M58 150v-52h26v52M232 150v-44h30v44M268 150v-30h34v30"/>
    <path d="M96 150V70h20v80M100 70l6-14 6 14M122 150v-46a24 24 0 0 1 48 0v46M146 58v22M140 64h12"/>
    <path class="ill-accent-fill" d="M122 104a24 24 0 0 1 48 0z"/>
    <path d="M178 150V88h40v62M178 88l20-16 20 16M190 150v-18h16v18"/>
    <path d="M24 122h22M64 112h14M238 118h18M274 132h22"/>
    <circle class="ill-accent" cx="270" cy="36" r="12"/>`,
  // Coins, a ledger and a rising line: money and budgets.
  tesoro: `<path class="ill-ground" d="M0 150h320"/>
    <ellipse class="ill-accent-fill" cx="90" cy="138" rx="42" ry="10"/><path d="M48 138v-14c0 5 19 10 42 10s42-5 42-10v14M48 124v-14c0 5 19 10 42 10s42-5 42-10v14M48 110c0-5 19-10 42-10s42 5 42 10-19 10-42 10-42-5-42-10z"/>
    <path class="ill-soft" d="M150 150V62h110v88"/><path d="M150 62h110M168 82h74M168 98h74M168 114h52"/>
    <path class="ill-accent" d="M166 140l24-16 18 8 36-30"/><path d="M234 102h10v10"/>
    <circle cx="280" cy="44" r="14"/><path d="M276 38h8M274 44h10M276 50h8"/>`,
  // A square with flags and a crowd: the party and its members.
  piazza: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M20 150V80l30-18 30 18v70M240 150V74l30-20 30 20v76"/>
    <path d="M120 150V60h80v90M120 60l40-26 40 26M150 150v-26h20v26"/>
    <path d="M96 150V40M224 150V46"/><path class="ill-accent-fill" d="M96 40h30l-8 9 8 9H96zM224 46h-30l8 9-8 9h30z"/>
    <g class="ill-crowd"><circle cx="60" cy="136" r="6"/><circle cx="80" cy="134" r="6"/><circle cx="100" cy="138" r="6"/><circle cx="220" cy="136" r="6"/><circle cx="240" cy="134" r="6"/><circle cx="260" cy="138" r="6"/></g>
    <path d="M52 150a8 8 0 0 1 16 0M72 150a8 8 0 0 1 16 0M92 150a8 8 0 0 1 16 0M212 150a8 8 0 0 1 16 0M232 150a8 8 0 0 1 16 0M252 150a8 8 0 0 1 16 0"/>`
});

export function illustration(name, className = '') {
  return `<svg class="illustration ${className}" viewBox="0 0 320 160" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SCENES[name] ?? SCENES.palazzo}</svg>`;
}
