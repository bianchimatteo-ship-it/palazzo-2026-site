// The page #sondaggi in five areas and its territory charts: the nine views of the observatory gathered in Quadro elettorale, Istituti e rilevazioni, Territori,
// Partiti, alleanze e flussi and Opinione pubblica; the tile map of the regions, the ranking and diverging bars, the territories side by side, the parties × regions heatmap,
// the period filter, the coalitions and the movers. Everything is read from what the game has saved: no number is invented, a missing value is drawn as missing (never as zero),
// and opening the page changes nothing of the game.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { playWeek, startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { OBSERVATORY_AREAS, OBSERVATORY_VIEWS, renderObservatory } = await module('src/ui/observatory-view.js');
const charts = await module('src/ui/territory-charts.js');
const { ITALIAN_REGIONS } = await module('src/data/regions.js');
const { observatoryReport } = await module('src/core/world-engine.js');
const { observatorySociety } = await module('src/core/society-engine.js');

const run = await startCareer({ seed: 'sondaggi-pagina', level: 'deputato', fast: true });
const early = JSON.parse(JSON.stringify(run.store.getState()));
for (let week = 0; week < 40; week++) playWeek(run);
const state = run.store.getState();
const page = (view, filters = {}, s = state) => renderObservatory(s, { view, logoFor: () => null, filters, secretary: true, window: () => ({ open: true }) });
const clean = (html, where) => { const text = html.replace(/data-[a-z-]+="[^"]*"/g, ''); const bad = text.match(/undefined|NaN|\[object Object\]|Infinity/); assert.ok(!bad, `${where}: valore non valido …${bad && text.slice(Math.max(0, bad.index - 80), bad.index + 30)}…`); };

// ---------- 1. five areas, nine views, each view in exactly one area ----------
assert.deepEqual(OBSERVATORY_AREAS.map(([id]) => id), ['quadro', 'istituti', 'territori', 'forze', 'gradimento'], 'Cinque aree.');
assert.deepEqual(OBSERVATORY_AREAS.map(([, label]) => label), ['Quadro elettorale', 'Istituti e rilevazioni', 'Territori', 'Partiti, alleanze e flussi', 'Opinione pubblica']);
const inAreas = OBSERVATORY_AREAS.flatMap(([, , views]) => views);
assert.equal(OBSERVATORY_VIEWS.length, 9, 'Le nove viste dell’osservatorio ci sono ancora.');
assert.deepEqual([...inAreas].sort(), OBSERVATORY_VIEWS.map(([id]) => id).sort(), 'Ogni vista sta in una sola area, nessuna è persa.');
for (const [view] of OBSERVATORY_VIEWS) {
  const html = page(view);
  clean(html, view);
  const tabs = [...html.matchAll(/<button type="button" role="tab" class="sx-tab[^"]*" data-obs-area="([a-z]+)"/g)].map(match => match[1]);
  assert.deepEqual(tabs, ['quadro', 'istituti', 'territori', 'forze', 'gradimento'], `${view}: le cinque aree come tab.`);
  assert.ok(html.includes(`data-section-tab="osservatorio" data-section-tab-value="${view}" aria-selected="true"`), `${view}: la vista attiva è segnata.`);
  const area = OBSERVATORY_AREAS.find(([, , views]) => views.includes(view));
  const sub = html.includes('class="obs-subtabs"');
  assert.equal(sub, area[2].length > 1, `${view}: la seconda riga di viste compare solo nelle aree con più viste.`);
  if (sub) for (const id of area[2]) assert.ok(html.includes(`class="obs-subtab ${id === view ? 'active' : ''}" data-section-tab="osservatorio" data-section-tab-value="${id}"`), `${view}: la vista ${id} è raggiungibile dalla sua area.`);
}
assert.ok(page('quadro').includes('aggiornata al'), 'Il quadro dice la data dell’ultimo aggiornamento.');

// ---------- 2. the quadro: coalitions, movers and the period of the charts ----------
{
  const html = page('quadro');
  assert.ok(html.includes('Quanto pesano insieme') && html.includes('Chi sale e chi scende'), 'Quadro: coalizioni e principali movimenti.');
  const report = observatoryReport(state.world, observatorySociety(state.society));
  const alliance = state.world.alliances.find(item => item.status === 'active' && item.partyIds.filter(id => report.latestAverage.rows.some(row => row.partyId === id)).length >= 2);
  if (alliance) {
    const total = alliance.partyIds.map(id => report.latestAverage.rows.find(row => row.partyId === id)?.share ?? 0).reduce((sum, share) => sum + share, 0);
    assert.ok(html.includes(`${total.toLocaleString('it-IT', { minimumFractionDigits: total < 1 ? 2 : 1, maximumFractionDigits: total < 1 ? 2 : 1 })}%`), 'La coalizione riporta la somma delle letture dei suoi membri.');
  }
  const labels = filters => (page('quadro', filters).match(/>S\d+</g) ?? []).length;
  const eight = page('quadro', { obsPeriod: '8' }), all = page('quadro', { obsPeriod: 'all' });
  assert.ok(eight.includes('aria-pressed="true">Ultime 8 settimane') && all.includes('aria-pressed="true">Tutto lo storico') && page('quadro').includes('aria-pressed="true">Ultime 26'), 'Il periodo scelto è segnato (di norma 26 settimane).');
  assert.ok(labels({ obsPeriod: 'all' }) >= labels({ obsPeriod: '8' }), 'Il periodo più lungo non mostra meno settimane.');
}

// ---------- 3. istituti: the period too ----------
assert.ok(page('istituti').includes('Ultime 8 settimane') && page('istituti', { obsPeriod: 'all' }).includes('aria-pressed="true">Tutto lo storico'), 'Istituti e rilevazioni: filtro per periodo.');
assert.ok(page('istituti').includes('Come lavora ciascun istituto') && page('istituti').includes('obs-average'), 'Istituti: metodi, campioni e confronto con la media restano.');

// ---------- 4. territori: the tile map, the bars, the card, the comparison, the heatmap ----------
{
  const html = page('territori');
  clean(html, 'territori');
  const tiles = html.match(/class="itmap-tile[^"]*"/g) ?? [];
  assert.equal(tiles.length, 20, 'Una tessera per ognuna delle venti regioni.');
  for (const region of ITALIAN_REGIONS) assert.ok(html.includes(`data-view-filter-value="${region}"`) , `Tessera di ${region}.`);
  assert.ok(html.includes('Province: dato non disponibile') && html.includes('Che cosa manca, e perché') && html.includes('cartogramma'), 'Dove il dato non c’è (province, confini) la pagina lo dice.');
  assert.ok(html.includes('la tua regione') && html.includes('Più regioni, una forza') && html.includes('Forze e regioni a colpo d’occhio') && html.includes('class="hm-wrap"'), 'Scheda, confronto e mappa di calore.');
  const bars = [...html.matchAll(/class="rbar-value">([\d,]+)%</g)].map(match => Number(match[1].replace(',', '.')));
  assert.equal(bars.length, 20, 'Venti barre nella classifica.');
  assert.deepEqual([...bars].sort((a, b) => b - a), bars, 'La classifica è ordinata.');
  // the three measures; the change over time needs a second regional picture
  assert.ok(html.includes('data-view-filter="obsMapMode" data-view-filter-value="variazione" aria-pressed="false" >') || html.includes('data-view-filter-value="variazione" aria-pressed="false" >'), 'Con più quadri regionali la variazione nel tempo si può scegliere.');
  for (const mode of ['scarto', 'variazione']) { const html2 = page('territori', { obsMapMode: mode }); clean(html2, mode); assert.ok(html2.includes(`data-view-filter-value="${mode}" aria-pressed="true"`), `Misura ${mode} scelta.`); assert.ok(html2.includes('is-diverging') || mode === 'variazione', `${mode}: barre divergenti.`); }
  // another force and another region
  const report = observatoryReport(state.world, observatorySociety(state.society));
  const other = report.forces.find(force => !force.isPlayer);
  const html3 = page('territori', { obsForce: other.id, obsRegion: 'Lombardia' });
  assert.ok(html3.includes('<h2>Lombardia</h2>') && html3.includes(other.label), 'La scheda segue la regione e la forza scelte.');
  // the comparison: default of three, then the choice of the player, at most four
  assert.equal((page('territori').match(/aria-pressed="true"[^>]*title="[^"]+"[^>]*>[A-Z]{3}</g) ?? []).length >= 2, true, 'Il confronto parte con almeno due regioni.');
  const picked = page('territori', { obsCompare: 'Abruzzo,Basilicata,Calabria,Campania' });
  assert.equal((picked.match(/data-view-filter="obsCompare"[^>]*disabled/g) ?? []).length, 16, 'Scelte quattro regioni, le altre sedici non si possono aggiungere.');
  assert.ok(page('territori', { obsCompare: 'Abruzzo' }).includes('Scegli almeno due regioni'), 'Con una sola regione il confronto lo chiede.');
}

// ---------- 5. before the second regional picture: no change is drawn, nothing is invented ----------
{
  const wrapped = JSON.parse(JSON.stringify(state));
  wrapped.world.observatory.regional = wrapped.world.observatory.regional.slice(0, 1);
  const html = page('territori', { obsMapMode: 'variazione' }, wrapped);
  clean(html, 'un solo quadro regionale');
  assert.ok(html.includes('disabled title="Serve almeno un secondo quadro regionale"') && html.includes('data-view-filter-value="quota" aria-pressed="true"'), 'Con un solo quadro regionale la variazione non si offre e si torna al consenso.');
  assert.ok(html.includes('Variazione nel tempo: serve un secondo quadro regionale'), 'Il limite è dichiarato.');
}

// ---------- 6. the charts alone: missing is missing, never zero ----------
{
  const items = ITALIAN_REGIONS.map((region, i) => ({ region, share: i === 0 ? null : 5 + i / 4, gap: i === 0 ? null : i / 4 - 2, change: i < 3 ? null : (i - 10) / 10 }));
  const map = charts.italyMap(items, { mode: 'quota', selected: 'Lazio', compare: ['Lazio', 'Puglia'], home: 'Toscana' });
  assert.ok(map.includes('is-missing') && map.includes('>—<') && !/NaN|undefined/.test(map), 'Una regione senza dato è una tessera vuota con un trattino.');
  assert.ok(map.includes('is-selected') && map.includes('is-compared') && map.includes('is-home'), 'Selezionata, a confronto e propria.');
  assert.equal((charts.italyMap(items.map(item => ({ ...item, share: null })), {}).match(/itmap-tile/g) ?? []).length, 0, 'Senza nessun dato non si disegna una cartina.');
  const zero = charts.regionBars([{ region: 'Molise', share: 0, gap: -3, change: 0 }, { region: 'Lazio', share: 4, gap: 1, change: 0.5 }], { mode: 'quota', national: 3 });
  assert.ok(zero.includes('>0,0%<') && zero.includes('Dato nazionale'), 'Lo zero è uno zero, con il dato nazionale accanto.');
  assert.equal(charts.divergingColor(null, 3), charts.divergingColor(undefined, 3), 'Il dato mancante ha il colore neutro.');
  assert.notEqual(charts.divergingColor(2, 3), charts.divergingColor(-2, 3), 'Sopra e sotto il dato nazionale hanno colori diversi.');
  const heat = charts.heatmap({ columns: [{ label: 'Lazio', short: 'LAZ' }, { label: 'Molise', short: 'MOL' }], rows: [{ label: 'Forza', color: '#336699', national: 10, cells: [{ region: 'Lazio', share: 12, gap: 2 }, { region: 'Molise', share: null, gap: null }] }] });
  assert.ok(heat.includes('>12,0<') && heat.includes('>—<') && !/NaN|undefined/.test(heat), 'La mappa di calore mostra il trattino dove non c’è il dato.');
  assert.ok(charts.regionAbbreviation('Valle d’Aosta') === 'VDA' && Object.keys(charts.REGION_TILES).length === 20 && new Set(Object.values(charts.REGION_TILES).map(([row, col]) => `${row}:${col}`)).size === 20, 'Venti tessere in venti posti diversi.');
}

// ---------- 7. opinione pubblica ----------
{
  const html = page('gradimento');
  clean(html, 'gradimento');
  assert.ok(html.includes('Soddisfazione e fiducia nelle istituzioni') && html.includes('Che cosa conta ora per i cittadini') && html.includes('Governo e leader nel tempo'), 'Opinione pubblica: gradimento, fiducia e giudizio, temi.');
}

// ---------- 8. opening the page changes nothing ----------
{
  const frozen = JSON.stringify(state);
  for (const [view] of OBSERVATORY_VIEWS) page(view, { obsMapMode: 'scarto', obsCompare: 'Lazio,Puglia', obsPeriod: '8' });
  assert.equal(JSON.stringify(state), frozen, 'Aprire la pagina e cambiarne i filtri non cambia la partita.');
}
// The first week (no regional picture yet): a clear message, no chart.
{
  const html = page('territori', {}, early);
  clean(html, 'prima settimana');
  assert.ok(html.includes('itmap-tile') || html.includes('Il quadro regionale compare'), 'La prima settimana: la cartina oppure il messaggio che dice quando arriva.');
}

// ---------- 9. legibility and honesty of the territory charts ----------
{
  const visuals = await module('src/ui/visuals.js');
  const { forceRegionalVote2022, listsOfForce } = await module('src/core/regional-vote.js');
  const geography = JSON.parse(await readFile(new URL('../src/data/real/electoral-geography.json', import.meta.url), 'utf8'));
  const FDI = 'party-registro-p1-2014-04-ir', PD = 'party-registro-p1-2015-29-ir', LEGA = 'party-registro-p1-2017-41-ir', M5S = 'party-registro-p1-2022-63-ir', FI = 'party-registro-p1-2015-20-ir', FN = 'party-futuro-nazionale';
  const pageGeo = (view, filters = {}) => renderObservatory(state, { view, logoFor: () => null, filters, secretary: true, window: () => ({ open: true }), geography });

  // The ink written on any fill (party colours, tile colours, the whole RGB cube in steps) reaches 4.5:1; the old threshold gave 2.7:1 on mid tones.
  let worst = 99;
  for (let r = 0; r < 256; r += 15) for (let g = 0; g < 256; g += 15) for (let b = 0; b < 256; b += 15) {
    const hex = `#${[r, g, b].map(value => value.toString(16).padStart(2, '0')).join('')}`;
    worst = Math.min(worst, visuals.contrastRatio(visuals.inkOn(hex), hex));
  }
  assert.ok(worst >= 4.5, `Il testo sui riempimenti ha sempre contrasto almeno 4,5:1 (peggiore: ${worst.toFixed(2)}).`);
  const { SEQUENTIAL } = await module('src/ui/polls-mode.js');
  for (const color of [...SEQUENTIAL, charts.divergingColor(2, 3), charts.divergingColor(-2, 3), charts.divergingColor(null, 3)]) assert.ok(visuals.contrastRatio(visuals.inkOn(color), color) >= 4.5, `Contrasto sulla tessera ${color}.`);
  assert.equal(visuals.partyMarkText({ abbreviation: 'FN', label: 'Futuro Nazionale' }), 'FN', 'La sigla del partito è quella dichiarata.');
  assert.equal(visuals.partyMarkText({ label: 'Alleanza Verdi e Sinistra' }), 'AVS', 'Senza sigla: le iniziali, al massimo tre lettere.');

  // The real regional vote of 2022: national figures close to the official ones, a force that did not run has none, a list absent from a region is missing (not 0%).
  const near = (value, expected, tolerance, where) => assert.ok(Math.abs(value - expected) <= tolerance, `${where}: ${value} (atteso ${expected} ±${tolerance}).`);
  const real = id => forceRegionalVote2022(geography, id);
  near(real(FDI).national, 26.0, 0.3, 'Fratelli d’Italia 2022'); near(real(PD).national, 19.1, 0.3, 'PD 2022'); near(real(LEGA).national, 8.8, 0.3, 'Lega 2022'); near(real(M5S).national, 15.4, 0.3, 'M5S 2022'); near(real(FI).national, 8.1, 0.3, 'Forza Italia 2022');
  assert.equal(real(FN), null, 'Futuro Nazionale non era in nessuna lista del 2022: nessun dato reale inventato.');
  assert.deepEqual(listsOfForce(FN), [], 'Nessuna lista del 2022 è collegata a Futuro Nazionale.');
  assert.equal(forceRegionalVote2022(null, FDI), null, 'Senza il documento elettorale non c’è un dato reale.');
  assert.equal(real(LEGA).regions['Valle d’Aosta'], null, 'Dove la lista non era in scheda (Valle d’Aosta, solo collegio uninominale) il dato manca: non è 0%.');
  assert.equal(Object.keys(real(LEGA).regions).length, 20, 'Venti regioni, con il dato dove c’è.');
  assert.ok(real(LEGA).source.includes('Eligendo') && real(LEGA).date === '2022-09-25', 'Fonte e data del dato reale.');
  assert.equal(real('party-registro-p1-2019-51-ir').shared, true, 'Una lista condivisa da due partiti (Azione–Italia Viva) è dichiarata tale.');

  // The simulated map says so; the real one says where it comes from; a force with no 2022 list cannot select the real measure.
  const sim = pageGeo('territori', { obsForce: LEGA });
  assert.ok(sim.includes('src-badge is-sim') && sim.includes('stima simulata') && sim.includes('non sono rilevazioni reali'), 'La stima regionale è dichiarata simulata, non una rilevazione reale.');
  assert.ok(sim.includes('Quota di consenso') && sim.includes('Più chiaro = più consenso') && sim.includes('itmap-ticks') && sim.includes('dato non disponibile'), 'La cartina ha scala, significato dei colori e chiave.');
  assert.ok(/Territorio<\/b>?:? ?venti regioni|Territorio.{0,12}venti regioni/.test(sim), 'La riga di provenienza dice il territorio.');
  assert.ok(/Quando.{0,12}settimana \d+/.test(sim), 'La riga di provenienza dice la settimana e la data.');
  const reale = pageGeo('territori', { obsForce: LEGA, obsMapMode: 'reale' });
  clean(reale, 'voto reale 2022');
  assert.ok(reale.includes('src-badge is-real') && reale.includes('Eligendo') && reale.includes('2022'), 'Il dato reale cita fonte e data.');
  assert.ok(reale.includes('data-view-filter-value="reale" aria-pressed="true"'), 'La misura reale si sceglie.');
  const vda = reale.match(/class="itmap-tile[^"]*is-missing[^"]*"[^>]*>[\s\S]{0,200}?VDA[\s\S]{0,120}?>—</);
  assert.ok(vda, 'In Valle d’Aosta la tessera reale è «dato non disponibile» (trattino), non 0%.');
  const fn = pageGeo('territori', { obsForce: FN, obsMapMode: 'reale' });
  clean(fn, 'Futuro Nazionale');
  assert.ok(fn.includes('non è in nessuna lista delle politiche del 2022') && !fn.includes('data-view-filter-value="reale" aria-pressed="true"'), 'Futuro Nazionale: la misura reale non si offre e se ne dice il motivo; la cartina resta la stima simulata.');
  assert.ok(!pageGeo('territori', { obsForce: FN }).includes('Voto reale 2022</small>'), 'Nessun KPI di voto reale per una forza senza lista nel 2022.');
  const noGeo = page('territori', { obsMapMode: 'reale' });
  assert.ok(noGeo.includes('data-view-filter-value="quota" aria-pressed="true"'), 'Senza il documento elettorale la cartina torna alla stima simulata.');

  // The heatmap on a phone: macro-area filter, short marks with the names key, nothing missing drawn as zero.
  for (const [area] of charts.MACRO_AREAS) {
    const html = pageGeo('territori', { obsArea: area });
    clean(html, `macro-area ${area}`);
    assert.ok(html.includes('class="hm-wrap"') && html.includes('hm-names'), `${area}: mappa di calore con la chiave dei nomi.`);
  }
  assert.ok(charts.regionsOfArea('nord').length > 0 && charts.regionsOfArea('nord').every(name => ITALIAN_REGIONS.includes(name)), 'Le macro-aree usano solo regioni vere.');
  const covered = new Set(charts.MACRO_AREAS.filter(([id]) => id !== 'tutte').flatMap(([, , members]) => members));
  assert.equal(covered.size, 20, 'Le macro-aree coprono tutte e venti le regioni, ciascuna una volta.');

  // The line chart: three layouts (wide, medium and narrow) so the text never shrinks below legible size on a phone; gaps are gaps; an empty series says so.
  const { lineChart } = await module('src/ui/charts.js');
  const labels = Array.from({ length: 12 }, (_, i) => `S${i + 1}`);
  const long = 'Partito con un nome molto molto lungo per vedere come regge la legenda';
  const html = lineChart({ series: [{ label: long, color: '#2f6fb5', values: labels.map((_, i) => 20 + i) }, { label: 'Estremo', color: '#d0805f', values: labels.map((_, i) => (i === 4 || i === 5 ? null : 0.1 * i)) }, { label: 'Negativo', color: '#6fae8a', values: labels.map((_, i) => -3 + i / 2) }], labels, unit: '%' });
  assert.ok(html.includes('class="trend-block"') && html.includes('lc-wide') && html.includes('lc-mid') && html.includes('lc-narrow') && html.includes('data-trend='), 'Grafico a tre impaginazioni (larga, media e stretta) con i dati per il tooltip.');
  assert.ok(html.includes('legend-value') && html.includes(long.replace(/&/g, '&amp;')), 'La legenda riporta nome intero e ultimo valore.');
  assert.ok(!/NaN|undefined|Infinity/.test(html.replace(/data-trend="[^"]*"/, '')), 'Valori estremi, negativi e lacune non producono valori non validi.');
  assert.ok((html.match(/<path class="series[^"]*" d="[^"]*L[\d.,-]+\s+M[\d.,-]+/g) ?? []).length >= 3, 'Una lacuna nei dati spezza la linea (la riprende con M), non la collega: in tutte le impaginazioni.');
  assert.ok(!lineChart({ series: [{ label: 'Uno', color: '#2f6fb5', values: [1] }], labels: ['S1'] }).includes('<svg'), 'Con un solo punto non si disegna una linea.');
  assert.ok(!lineChart({ series: [{ label: 'Nulla', color: '#2f6fb5', values: [null, null, null] }], labels: ['S1', 'S2', 'S3'] }).includes('<svg'), 'Senza valori finiti si dice che il dato manca.');

  // Every figure drawn with a mark shows the mark's text beside the colour: no information by colour alone on the compare table.
  const compare = pageGeo('territori', { obsForce: LEGA });
  assert.ok(compare.includes('hm-mark') && compare.includes('hm-names'), 'Le righe della mappa di calore hanno sigla e, a parte, l’elenco dei nomi.');
}

// ---------- every force of the poll, at once, in the quadro and in the full page ----------
{
  const report = observatoryReport(state.world);
  const forces = report.latestAverage.rows.filter(row => state.world.parties.some(party => party.id === row.partyId));
  assert.ok(forces.length >= 12, `Il panorama ha almeno dodici forze (${forces.length}).`);
  const quadro = page('quadro');
  const rowsIn = html => [...html.matchAll(/<div class="obs-bar-row[^"]*"[^>]*data-tip="([^"]*)"/g)].map(match => match[1]);
  const shown = rowsIn(quadro).filter(tip => !/^Altri/.test(tip));
  assert.equal(shown.length, forces.length, `Il quadro mostra tutte le ${forces.length} forze della rilevazione, nessun taglio (${shown.length}).`);
  assert.ok(/obs-bar-row is-others/.test(quadro) && quadro.includes('<strong>Altri</strong>'), 'E la riga «Altri».');
  // the same forces, in the same order and with the same values, in the full page of the institutes
  const full = page('istituti');
  const nameOf = id => state.world.parties.find(party => party.id === id).label;
  const sorted = [...forces].sort((a, b) => b.share - a.share);
  for (const row of sorted) {
    assert.ok(quadro.includes(nameOf(row.partyId).replace(/&/g, '&amp;')) || quadro.includes(nameOf(row.partyId)), `Nel quadro c’è ${nameOf(row.partyId)}.`);
    assert.ok(full.includes(nameOf(row.partyId).replace(/&/g, '&amp;')) || full.includes(nameOf(row.partyId)), `Nella pagina completa c’è ${nameOf(row.partyId)}.`);
  }
  const unescape = text => text.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  const labelsShown = shown.map(tip => unescape(tip.split(': media')[0]));
  assert.deepEqual(labelsShown, sorted.map(row => nameOf(row.partyId)), 'Nel quadro le forze sono in ordine di percentuale, come nella pagina completa.');
  assert.ok(!/obs-more|Mostra altre|altre forze/i.test(quadro), 'Nessun «mostra altre»: niente è nascosto in un altro tab, in una paginazione o in una sezione chiusa.');
}

console.log('Pagina Sondaggi verificata: cinque aree con le nove viste, cartina a tessere delle venti regioni, classifica e barre divergenti, scheda del territorio, confronto fino a quattro regioni, mappa di calore, coalizioni, movimenti, periodo dei grafici, dati mancanti dichiarati (province e confini) e pagina in sola lettura.');
