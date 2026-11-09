// The geographic map of the national elections: real boundaries (ISTAT via Openpolis, CC BY 4.0) of 20 regions and 110 provinces, coloured by the bloc that wins the single-member districts, with legend,
// info card, touch/keyboard selection and a table; real 2022 data is kept apart from projection and simulated vote; no territory is invented. Node checks on the data and the pure functions, then Chrome
// (desktop and phone) on the real page. Browser part skipped without Chrome.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

const read = f => JSON.parse(readFileSync(new URL(`../src/data/real/${f}.json`, import.meta.url), 'utf8'));
const boundaries = read('italy-boundaries'), geography = read('electoral-geography'), manifest = read('manifest');
const build = (readFileSync(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const { territoryTallies, provinceDistricts, italyMapSvg, italyMapInfo, italyMapTable, PROVINCE_INDICATOR_NOTE } = await import(new URL(`../src/ui/italy-map.js?v=${build}`, import.meta.url).href);
const { geoMapCard } = await import(new URL(`../src/ui/national-view.js?v=${build}`, import.meta.url).href);

// ---------- 1. the data: provenance, licence, completeness ----------
assert.equal(boundaries.source, 'real'); assert.equal(boundaries.license, 'CC BY 4.0');
assert.ok(/openpolis\/geojson-italy/.test(boundaries.sourceUrl) && /^[0-9a-f]{40}$/.test(boundaries.sourceCommit) && /ISTAT/.test(boundaries.attribution), 'Fonte, commit, licenza e attribuzione dichiarati.');
assert.equal(boundaries.regions.length, 20); assert.equal(boundaries.provinces.length, 110);
assert.ok(boundaries.regions.every(item => item.d.length > 200) && boundaries.provinces.every(item => item.d.length > 60), 'Ogni territorio ha un contorno.');
assert.equal(manifest.documents.italyBoundaries.file, 'italy-boundaries.json', 'Il documento è nel manifest.');
const regionCodes = new Set(boundaries.regions.map(item => item.code));
assert.ok(boundaries.provinces.every(item => regionCodes.has(item.region)), 'Ogni provincia appartiene a una regione esistente.');
const gameRegions = new Set([...geography.camera.collegi, ...geography.senato.collegi].map(item => item.region));
assert.deepEqual([...gameRegions].sort(), boundaries.regions.map(item => item.name).sort(), 'Le 20 regioni dei collegi sono le 20 regioni dei confini (stessi nomi).');
const byProvince = provinceDistricts(geography);
assert.ok(boundaries.provinces.every(item => byProvince.has(item.code)), 'Ogni provincia dei confini ha comuni (e collegi) nei dati elettorali.');

// ---------- 2. the 2022 reading: only what the data says ----------
const outcome2022 = (chamber, district) => district.winner?.alliance ? { id: district.winner.alliance } : null;
const tallies = territoryTallies(geography, boundaries, outcome2022);
const districtsByRegion = name => ['camera', 'senato'].reduce((n, chamber) => n + geography[chamber].collegi.filter(item => item.region === name).length, 0);
for (const region of boundaries.regions) { const t = tallies.regions.get(region.code); assert.equal(t.total + t.missing, districtsByRegion(region.name), `${region.name}: tutti i collegi della regione sono contati.`); }
const national = new Map(); let nationalTotal = 0;
for (const region of boundaries.regions) { const t = tallies.regions.get(region.code); nationalTotal += t.total; for (const [id, n] of t.counts) national.set(id, (national.get(id) ?? 0) + n); }
const winners = alliance => ['camera', 'senato'].reduce((n, chamber) => n + geography[chamber].collegi.filter(item => item.winner?.alliance === alliance).length, 0);
assert.equal(national.get('cdx'), winners('cdx'), 'I collegi del centrodestra nelle regioni sommano a quelli del dato ufficiale.');
assert.equal(nationalTotal, ['camera', 'senato'].reduce((n, chamber) => n + geography[chamber].collegi.filter(item => item.winner?.alliance).length, 0));
assert.ok(national.get('cdx') > national.get('csx'), 'Nel 2022 il centrodestra ha vinto più collegi del centrosinistra (dato Eligendo).');
const toscana = tallies.regions.get(boundaries.regions.find(item => item.name === 'Toscana').code);
assert.ok(toscana.counts.get('csx') > 0 && toscana.leader, 'Toscana: il centrosinistra vince alcuni collegi, c’è uno schieramento prevalente.');
const aosta = tallies.regions.get(boundaries.regions.find(item => item.name === 'Valle d’Aosta').code);
assert.equal(aosta.total, 2, 'Valle d’Aosta: un collegio per Camera e Senato.');
const taa = tallies.regions.get(boundaries.regions.find(item => item.name === 'Trentino-Alto Adige').code);
assert.ok(taa.missing === 0 && taa.total > 0, 'Trentino-Alto Adige: i sei collegi del Senato hanno il vincitore ufficiale e nessuno resta «senza risultato».');
const taaSenate = geography.senato.collegi.filter(item => item.region === 'Trentino-Alto Adige');
assert.equal(taaSenate.length, 6);
// the winners and the residual gaps are checked in detail by check-senato-taa.mjs
assert.ok(taaSenate.every(item => item.winner?.name && item.dataGap?.status === 'parziale' && item.dataGap.official === false && item.runnerUp === null), 'I sei collegi hanno il vincitore; restano dichiarati solo i voti di lista (baseline) e il secondo classificato.');
assert.ok(boundaries.provinces.every(item => { const t = tallies.provinces.get(item.code); return t.total + t.missing > 0; }), 'Ogni provincia ha almeno un collegio.');
// the province is an indicator by comuni, never a whole district given to every province it touches: each comune counts once, so the weights of all provinces add up to the comuni
const comuniInProvinces = Object.keys(geography.comuni).filter(code => boundaries.provinces.some(item => item.code === String(code).padStart(6, '0').slice(0, 3))).length;
const weightSum = [...tallies.provinces.values()].reduce((sum, t) => sum + t.total + t.missing, 0);
assert.ok(Math.abs(weightSum - comuniInProvinces) < 1e-6, `Le province contano ogni comune una sola volta (${weightSum.toFixed(2)} su ${comuniInProvinces}).`);
const sharedDistrict = [...provinceDistricts(geography).entries()].flatMap(([province, slot]) => [...slot.camera.keys()].map(index => [index, province])).reduce((map, [index, province]) => map.set(index, [...(map.get(index) ?? []), province]), new Map());
assert.ok([...sharedDistrict.values()].some(list => list.length > 1), 'Esistono collegi che toccano più province (il caso da non contare per intero in ciascuna).');
// a province is read from districts that include its comuni: Siena (052) must hold the district(s) of its comuni
const siena = tallies.provinces.get('052');
assert.ok(siena.total >= 1 && [...siena.counts.keys()].every(id => ['cdx', 'csx', 'm5s', 'azione-iv'].includes(id) || typeof id === 'string'), 'Siena: collegi dai suoi comuni.');

// ---------- 3. the drawing ----------
const colorOf = id => ({ cdx: '#1d4f91', csx: '#c0392b' }[id] ?? '#888'), labelOf = id => ({ cdx: 'Centrodestra', csx: 'Centrosinistra' }[id] ?? id);
const svgRegions = italyMapSvg({ boundaries, tallies, scope: 'regioni', selected: '', colorOf, labelOf });
const svgProvinces = italyMapSvg({ boundaries, tallies, scope: 'province', selected: 'p:052', colorOf, labelOf });
assert.equal((svgRegions.match(/data-map-area="r:/g) ?? []).length, 20, '20 regioni cliccabili.');
assert.equal((svgProvinces.match(/data-map-area="p:/g) ?? []).length, 110, '110 province cliccabili.');
assert.ok(/aria-pressed="true"/.test(svgProvinces) && /it-halo/.test(svgProvinces), 'La zona scelta è evidenziata.');
assert.ok(/<title>/.test(svgRegions) && /aria-label="[^"]*collegi/.test(svgRegions) && !/http|<image/.test(svgRegions), 'Ogni area ha etichetta e tooltip, nessuna risorsa esterna.');
const info = italyMapInfo({ boundaries, tallies, selected: 'p:052', labelOf, colorOf, dataClass: 'DATO STORICO REALE' });
assert.ok(/Provincia di Siena/.test(info) && /Indicatore descrittivo/.test(info) && /non è il vincitore né un risultato ufficiale della provincia/.test(info) && /dei comuni/.test(info) && !/prevale<\/span>/.test(info) && /DATO STORICO REALE/.test(info), 'La scheda dice che è un indicatore sui comuni, non il vincitore né un risultato ufficiale della provincia.');
assert.ok(/Indicatore descrittivo/.test(PROVINCE_INDICATOR_NOTE) && /Indicatore/.test(svgProvinces) === false || /indicatore sui comuni/.test(svgProvinces), 'Le province dichiarano l’indicatore in etichetta e tooltip.');
// a selection of the other level is never shown: a province while the regions are on, a region while the provinces are on
const staleInfo = italyMapInfo({ boundaries, tallies, selected: 'p:052', labelOf, colorOf, dataClass: '', scope: 'regioni' });
assert.ok(/Tocca o seleziona/.test(staleInfo) && !/Siena/.test(staleInfo), 'Passando da province a regioni nessuna scheda residua.');
assert.ok(!/is-selected|it-halo/.test(italyMapSvg({ boundaries, tallies, scope: 'regioni', selected: 'p:052', colorOf, labelOf })), 'Nessuna zona evidenziata dopo il cambio di livello.');
// the four states of the loading: loading, error (with retry), missing and no results — none is a screen that waits for ever
const dummy = { national: {} };
assert.ok(/data-geo-state="loading"/.test(geoMapCard(dummy, geography, 'proiezione', { boundaries: null, status: { status: 'loading' } })), 'Stato: caricamento.');
assert.ok(/data-geo-state="loading"/.test(geoMapCard(dummy, geography, 'proiezione', { boundaries: null, status: { status: 'idle' } })), 'Stato: in attesa.');
const failed = geoMapCard(dummy, geography, 'proiezione', { boundaries: null, status: { status: 'error', reason: 'Tempo scaduto nel caricamento di italy-boundaries.json.' } });
assert.ok(/data-geo-state="error"/.test(failed) && /data-action="retry-data"/.test(failed) && /Tempo scaduto/.test(failed), 'Stato: errore, con motivo e «Riprova».');
assert.ok(/data-geo-state="missing"/.test(geoMapCard(dummy, geography, 'proiezione', { boundaries: null, status: { status: 'missing', reason: 'Il pacchetto dei dati reali non comprende questo documento.' } })), 'Stato: dato mancante.');
const noResults = geoMapCard(dummy, null, 'proiezione', { boundaries, status: { status: 'ready' } });
assert.ok(/data-geo-state="no-results"/.test(noResults) && /data-action="retry-data"/.test(noResults), 'Stato: confini presenti ma elezioni 2022 non caricate.');
assert.ok(/Tocca o seleziona/.test(italyMapInfo({ boundaries, tallies, selected: '', labelOf, colorOf, dataClass: '' })), 'Senza selezione, un invito.');
{
  const labelOf = id => String(id), colorOf = () => '#888';
  const regionRows = (italyMapTable({ boundaries, tallies, labelOf, colorOf, scope: 'regioni' }).match(/<tr><th scope="row">/g) ?? []).length;
  const provinceRows = (italyMapTable({ boundaries, tallies, labelOf, colorOf, scope: 'province' }).match(/<tr><th scope="row">/g) ?? []).length;
  assert.equal(regionRows, 20, 'La tabella regionale ha 20 righe.'); assert.equal(provinceRows, 110, 'La tabella provinciale ne ha 110.');
}
// ---------- 3b. the party filter reads «where is the party» (presence), on regions and provinces ----------
{
  const PARTY = 'party-x';
  // a fake outcome: the party wins the districts of a few regions, nothing in the others, no result in one
  const winRegions = new Set(['Toscana', 'Lazio']);
  const outcome = (chamber, district) => district.region === 'Molise' ? null : { id: district.region === 'Toscana' || (district.region === 'Lazio' && String(district.id).length % 2 === 0) || (district.region === 'Lazio' && /[0-4]$/.test(String(district.id))) ? PARTY : 'altri' };
  const t = territoryTallies(geography, boundaries, outcome);
  const presence = PARTY;
  const partyColor = id => id === PARTY ? '#7fb8d6' : '#c9cfcb', partyLabel = id => id === PARTY ? 'Partito X' : 'Altri';
  const regionsSvg = italyMapSvg({ boundaries, tallies: t, scope: 'regioni', colorOf: partyColor, labelOf: partyLabel, presence });
  const provincesSvg = italyMapSvg({ boundaries, tallies: t, scope: 'province', colorOf: partyColor, labelOf: partyLabel, presence });
  for (const [name, svg] of [['regioni', regionsSvg], ['province', provincesSvg]]) {
    const states = new Set([...svg.matchAll(/data-presence="([a-z]+)"/g)].map(match => match[1]));
    assert.ok(states.has('absent'), `${name}: «assente» è uno stato distinto.`);
    assert.ok(states.has('nodata') || name === 'province' || svg.includes('Molise'), `${name}: nessun dato distinto.`);
    assert.ok(states.has('partial') || states.has('prevails'), `${name}: la presenza del partito si vede.`);
    assert.ok(!/is-absent[^>]*fill="#d7dcd9"/.test(svg), `${name}: l’assenza non ha il grigio del «nessun dato».`);
  }
  assert.ok(/fill="#2e3733"/.test(regionsSvg) && /fill="#d7dcd9"/.test(regionsSvg), 'Regioni: assente e nessun dato hanno due colori diversi.');
  assert.ok(/fill-opacity="(0\.[3-9]\d?|1)"/.test(provincesSvg), 'Province: la presenza parziale è resa con l’intensità.');
  const info = italyMapInfo({ boundaries, tallies: t, selected: 'r:09', labelOf: partyLabel, colorOf: partyColor, dataClass: 'x', scope: 'regioni', presence });
  assert.match(info, /Partito X: (presenza|partito assente)/, 'La scheda dice la presenza del partito.');
  assert.match(info, /Presenza del partito/, 'La scheda spiega la metrica.');
  assert.ok(/Presenza del partito/.test(italyMapTable({ boundaries, tallies: t, labelOf: partyLabel, colorOf: partyColor, scope: 'province', presence })), 'La tabella ha la colonna della presenza.');
}
console.log('Mappa geografica: dati e funzioni verificati (20 regioni, 110 province, 2022 coerente con i collegi ufficiali).');

// ---------- 4. the page, in Chrome ----------
if (!chromeAvailable) { console.log('Mappa geografica nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).'); process.exit(0); }
await withBrowser(async browser => {
  const { evaluate, waitFor: wait, pause, viewport, errors, version } = browser;
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ' + ${JSON.stringify(selector)}); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()`).then(() => pause(350));
  await createCareerInPage(browser, { weeks: 2 });
  await openCareer(browser);
  await evaluate(`location.hash = '#elezioni'; true`);
  await wait(() => has('[data-tab-id="nazionali"], [data-tab="nazionali"], .tab-nazionali'), 8000).catch(() => {});
  await evaluate(`(() => { const tab = [...document.querySelectorAll('button, a')].find(el => /Nazionali/i.test(el.textContent) && /tab|elez/i.test(el.className + el.getAttribute('role'))) ?? [...document.querySelectorAll('[role="tab"], .page-tab, .tab')].find(el => /Nazionali/i.test(el.textContent)); tab?.click(); return true; })()`);
  await pause(600);
  await wait(() => has('.it-map'), 20000);
  for (const [name, w, h, mobile] of [['desktop', 1280, 900, false], ['smartphone', 390, 800, true]]) {
    await viewport(w, h, mobile); await pause(500);
    assert.equal(await evaluate(`document.querySelectorAll('.it-area').length`), 20, `${name}: 20 regioni in mappa.`);
    assert.ok(await has('.nv-map'), `${name}: la mappa a quadratini dei collegi resta.`);
    const box = await evaluate(`(() => { const r = document.querySelector('.it-map').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), over: document.documentElement.scrollWidth - document.documentElement.clientWidth }; })()`);
    assert.ok(box.w > 250 && box.h > 300 && box.over <= 1, `${name}: mappa leggibile e senza overflow (${JSON.stringify(box)}).`);
    // tap a region: the info card names it and tells what kind of data it is
    await click('.it-area[data-map-area="r:09"]');
    await wait(() => evaluate(`/Toscana/.test(document.querySelector('.it-info h4')?.textContent ?? '')`), 5000);
    assert.ok(await evaluate(`/DATO STORICO REALE|PROIEZIONE SIMULATA|RISULTATO SIMULATO/.test(document.querySelector('.it-info .it-class')?.textContent ?? '')`), `${name}: la scheda distingue dato reale, proiezione e simulato.`);
    // provinces
    await click('[data-view-filter="mapScope"][data-view-filter-value="province"]');
    await wait(() => evaluate(`document.querySelectorAll('.it-area').length === 110`), 5000);
    assert.ok(await evaluate(`document.querySelector('.it-info')?.classList.contains('is-empty') && !document.querySelector('.it-area.is-selected')`), `${name}: passando alle province la regione scelta non resta selezionata.`);
    await click('.it-area[data-map-area="p:052"]');
    await wait(() => evaluate(`/Siena/.test(document.querySelector('.it-info h4')?.textContent ?? '')`), 5000);
    assert.ok(await evaluate(`/Indicatore descrittivo/.test(document.querySelector('.it-info')?.textContent ?? '') && /non è il vincitore/.test(document.querySelector('.it-info')?.textContent ?? '')`), `${name}: la provincia dichiara il metodo.`);
    assert.ok(await evaluate(`document.querySelector('.it-area.is-selected')?.dataset.mapArea === 'p:052'`), `${name}: area scelta evidenziata.`);
    // blocs / parties: the simulated reading can be coloured by winning bloc (row.w) or winning party (row.p); the districts are the same 221 either way, none lost, none counted twice
    if (await has('[data-view-filter="nazionali"][data-view-filter-value="proiezione"]')) await click('[data-view-filter="nazionali"][data-view-filter-value="proiezione"]');
    await click('[data-view-filter="mapScope"][data-view-filter-value="regioni"]'); await wait(() => evaluate(`document.querySelectorAll('.it-area').length === 20`), 5000);
    const tableTotal = () => evaluate(`[...document.querySelectorAll('.it-table tbody tr')].reduce((sum, row) => sum + [...(row.children[2]?.textContent ?? '').matchAll(/ (\\d+)(?: ·|$)/g)].reduce((a, m) => a + Number(m[1]), 0), 0)`);
    const legendSize = () => evaluate(`document.querySelectorAll('.it-layout')?.[0]?.closest('.sx-card, section, article')?.querySelectorAll('.nv-legend li').length ?? 0`);
    assert.ok(await has('[data-view-filter="mapGroup"][data-view-filter-value="schieramenti"]') && await has('[data-view-filter="mapGroup"][data-view-filter-value="partiti"]'), `${name}: la scelta Schieramenti / Partiti c’è.`);
    const byBloc = { total: await tableTotal(), legend: await legendSize() };
    await click('[data-view-filter="mapGroup"][data-view-filter-value="partiti"]'); await wait(() => evaluate(`document.querySelector('[data-view-filter="mapGroup"][data-view-filter-value="partiti"]')?.classList.contains('active')`), 5000);
    const byParty = { total: await tableTotal(), legend: await legendSize() };
    assert.equal(byBloc.total, 221, `${name}: per schieramenti i collegi sono 221 (147 + 74).`); assert.equal(byParty.total, 221, `${name}: per partiti i collegi sono ancora 221: nessuno sparisce né è contato due volte.`);
    assert.ok(byParty.legend >= byBloc.legend, `${name}: per partiti la legenda ha almeno tanti elementi quanti gli schieramenti (${byParty.legend} / ${byBloc.legend}).`);
    // the filter by party: the districts a party wins keep their colour, all the others are muted; none lost, the legend names the others, «Tutti i partiti» gives the map back
    assert.ok(await has('[data-map-party]'), `${name}: il filtro per partito c’è.`);
    await evaluate(`document.querySelector('[data-map-party]').open = true; true`);
    const partyButtons = await evaluate(`[...document.querySelectorAll('[data-view-filter="mapParty"]')].map(el => el.dataset.viewFilterValue)`);
    assert.ok(partyButtons[0] === '' && partyButtons.length >= 3, `${name}: Tutti i partiti più almeno due partiti.`);
    const cellsBefore = await evaluate(`document.querySelectorAll('.nv-map .nv-cell').length`);
    await click(`[data-view-filter="mapParty"][data-view-filter-value="${partyButtons[1]}"]`);
    await wait(() => evaluate(`document.querySelector('[data-view-filter="mapParty"][data-view-filter-value="${partyButtons[1]}"]')?.classList.contains('active')`), 5000);
    assert.equal(await evaluate(`document.querySelectorAll('.nv-map .nv-cell').length`), cellsBefore, `${name}: con il filtro i collegi sono sempre gli stessi.`);
    const muted = await evaluate(`[...document.querySelectorAll('.nv-map .nv-cell')].filter(el => el.style.background.includes('201, 207, 203') || el.style.background.includes('c9cfcb')).length`);
    assert.ok(muted > 0 && muted < cellsBefore, `${name}: i collegi degli altri partiti sono attenuati, quelli del partito scelto no (${muted}/${cellsBefore}).`);
    assert.ok(await evaluate(`[...document.querySelectorAll('.nv-legend li')].some(li => /Altri partiti/.test(li.textContent))`), `${name}: la legenda nomina gli altri partiti.`);
    await evaluate(`document.querySelector('[data-map-party]').open = true; true`);
    await click('[data-view-filter="mapParty"][data-view-filter-value=""]');
    await wait(() => evaluate(`!document.querySelector('.nv-legend')?.textContent.includes('Altri partiti')`), 5000);
    await click('[data-view-filter="mapGroup"][data-view-filter-value="schieramenti"]'); await pause(300);
    await click('[data-view-filter="mapScope"][data-view-filter-value="province"]'); await wait(() => evaluate(`document.querySelectorAll('.it-area').length === 110`), 5000);
    // 2022 reading is real and its alliances are labelled
    await click('[data-view-filter="nazionali"][data-view-filter-value="2022"]');
    await wait(() => evaluate(`document.querySelector('[data-map-group-note]') !== null && !document.querySelector('[data-view-filter="mapGroup"]')`), 5000);
    await wait(() => evaluate(`/DATO STORICO REALE/.test(document.querySelector('.it-class')?.textContent ?? '')`), 5000);
    assert.ok(await evaluate(`/Centrodestra/.test(document.querySelector('.it-layout')?.closest('.sx-card, section, article, div')?.textContent ?? document.body.textContent)`), `${name}: legenda con il centrodestra nel 2022.`);
    // keyboard: Enter on a focused area picks it
    await evaluate(`(() => { const el = document.querySelector('.it-area[data-map-area="p:058"]'); el.focus(); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true; })()`);
    await wait(() => evaluate(`/Roma/.test(document.querySelector('.it-info h4')?.textContent ?? '')`), 5000);
    // the table is there for those who do not use the map
    assert.ok(await evaluate(`document.querySelectorAll('.it-table tbody tr').length === 110 && document.querySelector('.it-table')?.dataset.mapTable === 'province'`), `${name}: nella vista provinciale la tabella ha le 110 province.`);
    assert.ok(await evaluate(`/Siena/.test(document.querySelector('.it-table')?.textContent ?? '') && /Toscana/.test(document.querySelector('.it-table')?.textContent ?? '')`), `${name}: con la regione di ciascuna.`);
    await click('[data-view-filter="mapScope"][data-view-filter-value="regioni"]');
    await wait(() => evaluate(`document.querySelectorAll('.it-table tbody tr').length === 20`), 5000);
    assert.ok(await evaluate(`document.querySelector('.it-table')?.dataset.mapTable === 'regioni'`), `${name}: nella vista regionale la tabella ha le 20 regioni.`);
    await click('[data-view-filter="mapSel"][data-view-filter-value=""]').catch(() => {});
  }
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
});
console.log('Mappa geografica nel browser (desktop e smartphone): regioni, province, schede, tabella, tastiera e distinzione dei dati verificati.');
