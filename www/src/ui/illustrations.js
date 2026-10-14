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
  // The hemicycle: seats in rows around the speaker's desk (Parliament).
  emiciclo: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M30 150a130 130 0 0 1 260 0M60 150a100 100 0 0 1 200 0M90 150a70 70 0 0 1 140 0"/>
    <g class="ill-crowd"><circle cx="30.0" cy="150.0" r="3.4"/><circle cx="32.0" cy="127.4" r="3.4"/><circle cx="37.8" cy="105.5" r="3.4"/><circle cx="47.4" cy="85.0" r="3.4"/><circle cx="60.4" cy="66.4" r="3.4"/><circle cx="76.4" cy="50.4" r="3.4"/><circle cx="95.0" cy="37.4" r="3.4"/><circle cx="115.5" cy="27.8" r="3.4"/><circle cx="137.4" cy="22.0" r="3.4"/><circle cx="160.0" cy="20.0" r="3.4"/><circle cx="182.6" cy="22.0" r="3.4"/><circle cx="204.5" cy="27.8" r="3.4"/><circle cx="225.0" cy="37.4" r="3.4"/><circle cx="243.6" cy="50.4" r="3.4"/><circle cx="259.6" cy="66.4" r="3.4"/><circle cx="272.6" cy="85.0" r="3.4"/><circle cx="282.2" cy="105.5" r="3.4"/><circle cx="288.0" cy="127.4" r="3.4"/><circle cx="290.0" cy="150.0" r="3.4"/><circle cx="60.0" cy="150.0" r="3.4"/><circle cx="62.5" cy="127.7" r="3.4"/><circle cx="69.9" cy="106.6" r="3.4"/><circle cx="81.8" cy="87.7" r="3.4"/><circle cx="97.7" cy="71.8" r="3.4"/><circle cx="116.6" cy="59.9" r="3.4"/><circle cx="137.7" cy="52.5" r="3.4"/><circle cx="160.0" cy="50.0" r="3.4"/><circle cx="182.3" cy="52.5" r="3.4"/><circle cx="203.4" cy="59.9" r="3.4"/><circle cx="222.3" cy="71.8" r="3.4"/><circle cx="238.2" cy="87.7" r="3.4"/><circle cx="250.1" cy="106.6" r="3.4"/><circle cx="257.5" cy="127.7" r="3.4"/><circle cx="260.0" cy="150.0" r="3.4"/><circle cx="90.0" cy="150.0" r="3.4"/><circle cx="93.4" cy="128.4" r="3.4"/><circle cx="103.4" cy="108.9" r="3.4"/><circle cx="118.9" cy="93.4" r="3.4"/><circle cx="138.4" cy="83.4" r="3.4"/><circle cx="160.0" cy="80.0" r="3.4"/><circle cx="181.6" cy="83.4" r="3.4"/><circle cx="201.1" cy="93.4" r="3.4"/><circle cx="216.6" cy="108.9" r="3.4"/><circle cx="226.6" cy="128.4" r="3.4"/><circle cx="230.0" cy="150.0" r="3.4"/></g>
    <path d="M136 150v-16h48v16M148 134v-10h24v10"/>
    <path class="ill-accent-fill" d="M154 124h12v-12h-12z"/>`,
  // A ballot box with a paper going in (elections).
  urna: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M104 150V92h112v58"/>
    <path d="M94 92h132M122 92v-8h76v8M142 84h36"/>
    <path class="ill-accent-fill" d="M144 40h32v42h-32z"/>
    <path d="M151 62l6 7 12-14"/>
    <path d="M118 112h84M118 126h60"/>
    <circle class="ill-accent" cx="258" cy="46" r="12"/><path d="M258 38v16M250 46h16"/>
    <circle cx="58" cy="52" r="8"/><path d="M58 60v-4M40 150a18 18 0 0 1 36 0"/>`,
  // The palazzo cracked by a lightning bolt (a crisis).
  crisi: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M52 150V98h216v52"/>
    <path d="M44 98h232M160 40 48 92h224z"/>
    <path d="M72 98v52M104 98v52M136 98v52M184 98v52M216 98v52M248 98v52"/>
    <path class="ill-accent" d="M168 40l-14 38 20 5-22 42 18 4-12 21"/>
    <path d="M250 52l-9 16 12 3-8 15"/>
    <path d="M70 70l-14-8M82 60l-8-14"/>`,
  // A podium with a star (results).
  podio: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M60 150v-38h64v38M196 150v-26h64v26"/>
    <path d="M124 150V90h72v60"/>
    <path class="ill-accent-fill" d="M160 38l7 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z"/>
    <path d="M154 108h12M92 128h14M228 136h14M144 126h32"/>
    <circle cx="92" cy="96" r="7"/><circle cx="228" cy="108" r="7"/>
    <path d="M80 112a12 12 0 0 1 24 0M216 124a12 12 0 0 1 24 0"/>`,
  // A radio set with its antenna and waves (the radio).
  radio: `<path class="ill-ground" d="M0 150h320"/>
    <rect class="ill-soft" x="64" y="82" width="132" height="68" rx="9"/>
    <circle cx="104" cy="116" r="21"/><circle cx="104" cy="116" r="7"/>
    <path d="M144 100h38M144 112h38M144 124h38M72 94h24"/>
    <path d="M76 82 52 34"/><circle class="ill-accent" cx="51" cy="32" r="5"/>
    <path class="ill-accent" d="M226 72a22 22 0 0 1 0 44M242 58a42 42 0 0 1 0 72M258 44a62 62 0 0 1 0 100"/>
    <path d="M214 94v-14M206 94h16"/>`,
  // A newspaper page with a photo and columns (the paper).
  giornale: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M74 30h180v112H74z"/>
    <path d="M90 48h148M90 64h56M90 76h56M90 88h56M90 100h56M90 112h56M90 124h56"/>
    <path class="ill-accent-fill" d="M160 64h78v56h-78z"/>
    <path d="M168 112l20-24 14 14 10-8 20 18M178 78h.01"/>
    <path d="M254 52l30-12v100l-30-8"/>`,
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

// The logo of LA POLITICA 24 (original, internal to the game): a rounded plate with a large «24» drawn with strokes (no font involved) and, for the radio, the arcs of a wave. It uses
// only the tokens `--lp24-plate`, `--lp24-ink`, `--lp24-gold`, so it never takes the colour of a party or of an institution.
export function lp24Logo(kind = 'paper', className = '') {
  const waves = kind === 'radio' ? '<path d="M92 14a16 16 0 0 1 0 28M100 8a26 26 0 0 1 0 40" stroke="var(--lp24-gold)" stroke-width="3.4" stroke-linecap="round"/>' : '<path d="M88 52h24" stroke="var(--lp24-gold)" stroke-width="3.4" stroke-linecap="round"/>';
  return `<svg class="lp24-logo ${className}" viewBox="0 0 120 64" role="img" aria-label="Logo di LA POLITICA 24"><rect x="1.5" y="1.5" width="117" height="61" rx="12" fill="var(--lp24-plate)" stroke="var(--lp24-gold)" stroke-width="3"/><path d="M14 24c0-8 6-12 13-12s13 4 13 11c0 6-4 9-9 13L14 52h27" fill="none" stroke="var(--lp24-ink)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M72 12 46 42h36M72 12v40" fill="none" stroke="var(--lp24-ink)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>${waves}</svg>`;
}
