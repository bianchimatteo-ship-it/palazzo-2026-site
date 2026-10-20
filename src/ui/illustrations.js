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
    <path d="M52 150a8 8 0 0 1 16 0M72 150a8 8 0 0 1 16 0M92 150a8 8 0 0 1 16 0M212 150a8 8 0 0 1 16 0M232 150a8 8 0 0 1 16 0M252 150a8 8 0 0 1 16 0"/>`,  // A crane over a building site (public works).
  cantiere: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M196 150V96h72v54M208 150v-24h16v24"/>
    <path d="M70 150V28M70 28h120M70 40l36-12M70 40l-30-10M190 28v22"/><path d="M62 150l8-70 8 70M64 120h12M66 100h8"/>
    <path class="ill-accent-fill" d="M180 50h20v14h-20z"/>
    <path d="M118 150v-16h46v16M126 134v-8h30v8"/>
    <path class="ill-accent" d="M232 96l18-22 18 22"/><path d="M20 150l16-14 16 14"/>`,
  // A bridge across a river (infrastructure).
  ponte: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M0 132h320M0 142h320"/>
    <path d="M20 112h280M20 120h280"/><path d="M60 120v30M130 120v30M190 120v30M260 120v30"/>
    <path class="ill-accent" d="M60 112c20-48 50-48 70 0M190 112c20-48 50-48 70 0"/>
    <path d="M80 80v32M95 70v42M110 80v32M210 80v32M225 70v42M240 80v32"/>
    <circle cx="280" cy="40" r="10"/>`,
  // A bar chart with a trend line: surveys and polls.
  sondaggio: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M40 24v126M40 60h240M40 96h240"/>
    <path d="M62 150v-44h26v44M108 150v-70h26v70M154 150v-30h26v30M200 150v-86h26v86M246 150v-54h26v54"/>
    <path class="ill-accent-fill" d="M200 150v-86h26v86z"/>
    <path class="ill-accent" d="M62 98l46-26 46 36 46-52 46 26"/>
    <circle cx="154" cy="108" r="4"/><circle cx="246" cy="82" r="4"/>`,
  // A candlestick chart and an arrow: markets, spread and public accounts.
  mercati: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M30 30v120M30 70h260M30 110h260"/>
    <path d="M60 122v-44M60 96h0M52 88h16v22H52zM100 112v-52M92 72h16v28H92zM140 98v-48M132 60h16v30h-16zM180 104v-34M172 80h16v18h-16zM220 80v-42M212 48h16v26h-16z"/>
    <path class="ill-accent-fill" d="M92 72h16v28H92zM172 80h16v18h-16z"/>
    <path class="ill-accent" d="M44 126l60-24 40 12 70-52 56-24"/><path d="M250 38l20 2-4 20"/>`,
  // A ballot paper dropped in the Chamber: a vote of confidence or a final vote.
  fiducia: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M30 150a130 130 0 0 1 260 0M70 150a90 90 0 0 1 180 0"/>
    <path d="M120 150v-30h80v30M130 120V92h60v28"/>
    <path class="ill-accent-fill" d="M138 36h44v52h-44z"/>
    <path d="M146 54h28M146 66h28M146 78h16"/><path class="ill-accent" d="M150 44l6 6 12-12"/>
    <circle cx="70" cy="110" r="6"/><circle cx="250" cy="110" r="6"/><path d="M62 130a8 8 0 0 1 16 0M242 130a8 8 0 0 1 16 0"/>`,
  // A door and a briefcase: resignations and exits.
  dimissioni: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M70 150V44h92v106"/>
    <path d="M70 44h92M84 150V60h64v90"/><circle cx="136" cy="108" r="3.5"/>
    <path class="ill-accent-fill" d="M196 128h54v22h-54z"/><path d="M212 128v-8h22v8M196 138h54"/>
    <path class="ill-accent" d="M178 90h60M226 78l14 12-14 12"/>
    <path d="M262 150v-24M256 126h12"/>`,
  // A magnifying glass over documents: inquiries and cases.
  inchiesta: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M44 138V44h96v94zM64 138V64h96v74"/>
    <path d="M60 64h64M60 78h64M60 92h40"/>
    <circle class="ill-accent" cx="206" cy="82" r="38"/><path class="ill-accent" d="M233 110l36 36"/>
    <path d="M184 76h44M184 90h30"/><path class="ill-accent-fill" d="M244 36h24v18h-24z"/>`,
  // A stage with a lectern and microphone: rallies and public appearances.
  comizio: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M30 150v-26h260v26"/>
    <path d="M30 124h260M120 124v-36h80v36M160 88V56"/><path class="ill-accent-fill" d="M154 40h12v18h-12z"/>
    <path d="M140 124h40"/><path class="ill-accent" d="M110 40l-22-12M210 40l22-12M104 54l-26-4M216 54l26-4"/>
    <g class="ill-crowd"><circle cx="48" cy="142" r="5"/><circle cx="76" cy="144" r="5"/><circle cx="244" cy="142" r="5"/><circle cx="272" cy="144" r="5"/></g>
    <path d="M232 124V30M232 30h26l-6 8 6 8h-26"/>`,
  // A factory with smoking chimneys: work, industry, productive sectors.
  fabbrica: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M40 150V96l40-22v22l40-22v22l40-22v22l40-22v76"/>
    <path d="M40 150V96M240 150V74h24v76M248 74V40h8v34"/><path class="ill-accent" d="M252 34c6-8 14-10 22-8-6-12 12-18 22-8"/>
    <path d="M60 132h24v18H60zM104 132h24v18h-24zM148 132h24v18h-24z"/><path class="ill-accent-fill" d="M196 112h30v38h-30z"/>`,
  // People around a table: negotiations, summits, agreements.
  tavolo: `<path class="ill-ground" d="M0 150h320"/>
    <ellipse class="ill-soft" cx="160" cy="118" rx="96" ry="20"/><path d="M64 118v22M256 118v22M110 134v12M210 134v12"/>
    <g class="ill-crowd"><circle cx="92" cy="86" r="9"/><circle cx="160" cy="76" r="9"/><circle cx="228" cy="86" r="9"/></g>
    <path d="M78 108a14 14 0 0 1 28 0M146 100a14 14 0 0 1 28 0M214 108a14 14 0 0 1 28 0"/>
    <path class="ill-accent-fill" d="M140 108h40v8h-40z"/><path class="ill-accent" d="M150 44h20v14h-20z"/>`,
  // Citizens in a street: society, territory, everyday life.
  cittadini: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M16 150V70h56v80M248 150V58h56v92M28 90h10M28 108h10M260 80h10M260 100h10M260 120h10"/>
    <g class="ill-crowd"><circle cx="106" cy="104" r="9"/><circle cx="150" cy="98" r="9"/><circle cx="196" cy="106" r="9"/></g>
    <path d="M92 150v-26a14 14 0 0 1 28 0v26M136 150v-32a14 14 0 0 1 28 0v32M182 150v-24a14 14 0 0 1 28 0v24"/>
    <path class="ill-accent" d="M128 66h44l-8 12h-28z"/><circle cx="152" cy="40" r="10"/>`,
  // A scroll with a seal: laws and decrees.
  decreto: `<path class="ill-ground" d="M0 150h320"/>
    <path class="ill-soft" d="M80 28h160v104H80z"/>
    <path d="M76 28a8 8 0 0 1 0 16M244 28a8 8 0 0 0 0 16M76 132a8 8 0 0 0 0-16M244 132a8 8 0 0 1 0-16"/>
    <path d="M104 52h112M104 66h112M104 80h112M104 94h60"/>
    <circle class="ill-accent-fill" cx="204" cy="106" r="16"/><path class="ill-accent" d="M196 106l6 6 10-12"/><path d="M196 122l-6 22 14-8 14 8-6-22"/>`
});

export function illustration(name, className = '') {
  return `<svg class="illustration ${className}" viewBox="0 0 320 160" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SCENES[name] ?? SCENES.palazzo}</svg>`;
}

// ---------- the covers of the newsroom ----------
// A cover is a scene of the set above plus a backdrop and an orientation that follow from the article itself (its id and its tone): the same article always shows the same cover, whatever the page does,
// and two different news almost never share all three. The line style, the frame and the colour of the category stay the same, so the covers read as one editorial series.
const BACKDROPS = Object.freeze({
  sole: '<circle cx="262" cy="34" r="13"/><path d="M262 10v8M262 50v8M238 34h8M278 34h8M245 17l5 5M274 46l5 5M279 17l-5 5M250 46l-5 5"/>',
  luna: '<path d="M270 20a16 16 0 1 0 14 24 14 14 0 0 1-14-24z"/><path d="M36 28h.01M70 18h.01M104 34h.01M236 22h.01"/>',
  nuvole: '<path d="M30 40a12 12 0 0 1 22-6 10 10 0 0 1 18 6zM236 30a10 10 0 0 1 18-4 8 8 0 0 1 16 4z"/>',
  colline: '<path d="M0 118c40-26 80-30 120-14s80 18 120 4 60-12 80-4"/>',
  trama: '<path d="M24 24h.01M48 24h.01M72 24h.01M24 48h.01M48 48h.01M248 24h.01M272 24h.01M296 24h.01M272 48h.01M296 48h.01"/>',
  nessuno: ''
});
const BACKDROP_BY_TONE = Object.freeze({ bad: ['nuvole', 'luna', 'nuvole', 'trama'], good: ['sole', 'colline', 'sole', 'trama'], neutral: ['colline', 'trama', 'nuvole', 'sole', 'nessuno'] });
const hashOf = value => { let n = 2166136261; for (const char of String(value)) n = Math.imul(n ^ char.charCodeAt(0), 16777619) >>> 0; n = Math.imul(n ^ (n >>> 15), 2246822507) >>> 0; return (n ^ (n >>> 13)) >>> 0; };
export const coverVariant = (seed, tone = 'neutral') => {
  const h = hashOf(seed), backdrops = BACKDROP_BY_TONE[tone] ?? BACKDROP_BY_TONE.neutral;
  return { backdrop: backdrops[h % backdrops.length], flip: ((h >>> 8) & 1) === 1 };
};
export const pickByHash = (list, seed) => list[hashOf(seed) % list.length];
export function coverIllustration(name, { seed = '', tone = 'neutral', className = '' } = {}) {
  const { backdrop, flip } = coverVariant(seed, tone);
  const scene = SCENES[name] ?? SCENES.palazzo;
  const body = `<g class="ill-back ill-soft">${BACKDROPS[backdrop]}</g>${flip ? `<g transform="translate(320 0) scale(-1 1)">${scene}</g>` : scene}`;
  return `<svg class="illustration cover ${className}" data-cover-scene="${name in SCENES ? name : 'palazzo'}" data-cover-backdrop="${backdrop}" data-cover-flip="${flip}" viewBox="0 0 320 160" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
export const sceneNames = () => Object.keys(SCENES);

// The logo of LA POLITICA 24 (original, internal to the game): a rounded plate with a large «24» drawn with strokes (no font involved) and, for the radio, the arcs of a wave. It uses
// only the tokens `--lp24-plate`, `--lp24-ink`, `--lp24-gold`, so it never takes the colour of a party or of an institution.
export function lp24Logo(kind = 'paper', className = '') {
  const waves = kind === 'radio' ? '<path d="M92 14a16 16 0 0 1 0 28M100 8a26 26 0 0 1 0 40" stroke="var(--lp24-gold)" stroke-width="3.4" stroke-linecap="round"/>' : '<path d="M88 52h24" stroke="var(--lp24-gold)" stroke-width="3.4" stroke-linecap="round"/>';
  return `<svg class="lp24-logo ${className}" viewBox="0 0 120 64" role="img" aria-label="Logo di LA POLITICA 24"><rect x="1.5" y="1.5" width="117" height="61" rx="12" fill="var(--lp24-plate)" stroke="var(--lp24-gold)" stroke-width="3"/><path d="M14 24c0-8 6-12 13-12s13 4 13 11c0 6-4 9-9 13L14 52h27" fill="none" stroke="var(--lp24-ink)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M72 12 46 42h36M72 12v40" fill="none" stroke="var(--lp24-ink)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>${waves}</svg>`;
}
