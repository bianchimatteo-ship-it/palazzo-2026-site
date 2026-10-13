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
  assert.equal((page('territori').match(/aria-pressed="true" [^>]*title="[^"]+">[A-Z]{3}</g) ?? []).length >= 2, true, 'Il confronto parte con almeno due regioni.');
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
  assert.ok(zero.includes('>0%<') && zero.includes('Dato nazionale'), 'Lo zero è uno zero, con il dato nazionale accanto.');
  assert.equal(charts.divergingColor(null, 3), charts.divergingColor(undefined, 3), 'Il dato mancante ha il colore neutro.');
  assert.notEqual(charts.divergingColor(2, 3), charts.divergingColor(-2, 3), 'Sopra e sotto il dato nazionale hanno colori diversi.');
  const heat = charts.heatmap({ columns: [{ label: 'Lazio', short: 'LAZ' }, { label: 'Molise', short: 'MOL' }], rows: [{ label: 'Forza', color: '#336699', national: 10, cells: [{ region: 'Lazio', share: 12, gap: 2 }, { region: 'Molise', share: null, gap: null }] }] });
  assert.ok(heat.includes('>12<') && heat.includes('>—<') && !/NaN|undefined/.test(heat), 'La mappa di calore mostra il trattino dove non c’è il dato.');
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
console.log('Pagina Sondaggi verificata: cinque aree con le nove viste, cartina a tessere delle venti regioni, classifica e barre divergenti, scheda del territorio, confronto fino a quattro regioni, mappa di calore, coalizioni, movimenti, periodo dei grafici, dati mancanti dichiarati (province e confini) e pagina in sola lettura.');
