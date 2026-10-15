// The colours of the political forces in Elezioni → Nazionali are fixed by id: the same force (or the coalition it leads) has the same colour in every view, week, legislature and reload, and does
// not depend on the order in which the page happens to draw them.
//   - the table (political-colors.js) uses only colours of the validated series, the leading forces of the game have pairwise different ones, the main alliances too (centre-right blue, centre-left
//     coral), a coalition has the colour of its leader, the 2022 alliances have their own, what has no entry gets a colour from a fixed pool by a hash of its id (the same every time);
//   - the page's palette gives the same colour to the same id whatever the order and whatever else is in the lists; the territorial lists are neutral;
//   - in Chrome, in Elezioni → Nazionali: every label has one colour on the page, the colours are the same after weeks of play, after a reload and at another width, and the 2022 alliances of the
//     map keep the colours of the table. Skipped without Chrome for the browser part.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { SERIES } from '../src/ui/charts.js';
import { ALLIANCE_COLORS, FORCE_COLORS, NEUTRAL_COLOR, coalitionColor, forceColor, stableColor } from '../src/ui/political-colors.js';
import { nationalPalette } from '../src/ui/national-view.js';
import { contrastRatio } from '../src/ui/visuals.js';

// ---------- 1. the table ----------
const series = new Set(SERIES);
assert.ok(Object.values(FORCE_COLORS).every(color => series.has(color)) && Object.values(ALLIANCE_COLORS).every(color => series.has(color)), 'Solo colori della serie validata dei grafici.');
assert.ok([...series].every(color => contrastRatio(color, '#1d1e1a') >= 3 && contrastRatio(color, '#10231b') >= 3), 'Ogni colore si legge sui pannelli scuri (3:1).');
const LEADERS = ['party-registro-p1-2014-04-ir', 'party-registro-p1-2015-29-ir', 'party-registro-p1-2022-63-ir', 'party-registro-p1-2017-41-ir', 'party-registro-p1-2015-20-ir', 'coalition-alleanza-verdi-sinistra', 'party-registro-p1-2019-51-ir', 'party-futuro-nazionale'];
assert.equal(new Set(LEADERS.map(forceColor)).size, LEADERS.length, 'Le otto forze principali hanno otto colori diversi.');
assert.notEqual(ALLIANCE_COLORS.cdx, ALLIANCE_COLORS.csx, 'Centrodestra e centrosinistra non hanno lo stesso colore (né due blu).');
assert.equal(ALLIANCE_COLORS.cdx, forceColor('party-registro-p1-2014-04-ir'), 'Il centrodestra ha il colore della forza che lo guida.');
assert.equal(ALLIANCE_COLORS.csx, forceColor('party-registro-p1-2015-29-ir'), 'Il centrosinistra, quello della sua.');
assert.equal(coalitionColor({ id: 'coalizione-party-registro-p1-2014-04-ir', leaderId: 'party-registro-p1-2014-04-ir', camp: 'destra' }), forceColor('party-registro-p1-2014-04-ir'), 'Una coalizione ha il colore del suo capofila.');
assert.equal(coalitionColor({ id: 'coalizione-sconosciuta', leaderId: 'party-inesistente' }), coalitionColor({ id: 'coalizione-sconosciuta', leaderId: 'party-inesistente' }), 'Senza voce in tabella: sempre lo stesso.');
for (const id of ['party-a', 'party-b', 'party-nuovo-123', 'coalizione-x']) assert.equal(stableColor(id), stableColor(id), `${id}: il colore non dipende da quando lo si chiede.`);
assert.ok(new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'l', 'm', 'n'].map(id => stableColor(`party-${id}`))).size >= 3, 'Il sorteggio per id usa più di un colore.');

// ---------- 2. the palette of the page ----------
{
  const coalitions = [
    { id: 'coalizione-party-registro-p1-2014-04-ir', leaderId: 'party-registro-p1-2014-04-ir', camp: 'destra', label: 'Centrodestra' },
    { id: 'coalizione-party-registro-p1-2015-29-ir', leaderId: 'party-registro-p1-2015-29-ir', camp: 'sinistra', label: 'Centrosinistra' },
    { id: 'coalizione-party-nuovo', leaderId: 'party-nuovo', camp: 'centro', label: 'Coalizione Nuovo' }
  ];
  const ids = [...coalitions.map(item => item.id), ...LEADERS, 'party-sconosciuto-1', 'party-sconosciuto-2', 'lista:valle-d-aosta'];
  const reference = nationalPalette({ coalitions }, null);
  const expected = Object.fromEntries(ids.map(id => [id, reference.of(id)]));
  let seed = 7;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let round = 0; round < 60; round++) {
    const shuffled = [...coalitions].sort(() => random() - 0.5).slice(0, 1 + Math.floor(random() * 3));
    // ... a different subset, a different order, the coalitions of another vote in the result: the colour of an id never changes
    const palette = nationalPalette({ coalitions: shuffled }, { coalitions: coalitions.filter(() => random() > 0.4) });
    for (const id of [...ids].sort(() => random() - 0.5)) {
      // a coalition the palette does not know about is coloured as a force (by its own id), so compare only what the palette was told about
      if (coalitions.some(item => item.id === id) && !shuffled.some(item => item.id === id)) continue;
      assert.equal(palette.of(id), expected[id], `${id}: lo stesso colore in ogni combinazione (round ${round}).`);
    }
  }
  assert.equal(reference.of('lista:valle-d-aosta'), NEUTRAL_COLOR, 'Le liste territoriali sono neutre.');
  assert.equal(reference.of(null), NEUTRAL_COLOR, 'E chi non è indicato.');
  assert.notEqual(reference.of(coalitions[0].id), reference.of(coalitions[1].id), 'Le due coalizioni principali si distinguono.');
}

// ---------- 3. in Chrome ----------
let swatches = 0, mapColors = 0;
if (!chromeAvailable) console.log('Parte nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).');
else await withBrowser(async browser => {
  const { evaluate, viewport, waitFor, pause, errors } = browser;
  await createCareerInPage(browser, { party: 'party-futuro-nazionale', group: 'cam-xix-12', level: 'deputato', weeks: 1 });
  // a swatch is named by the element right after it (the legend's <span>, the coalition's <strong>); the swatches inside table cells are not legends
  const collect = () => evaluate(`(() => { const out = []; for (const swatch of document.querySelectorAll('.nv-swatch')) { if (swatch.classList.contains('is-close')) continue; const color = swatch.style.background || getComputedStyle(swatch).backgroundColor; const label = (swatch.nextElementSibling?.textContent ?? '').trim().replace(/\\s+/g, ' ').slice(0, 60); if (label) out.push([label, color]); } return out; })()`);
  const rgb = value => { const probe = value.startsWith('#') ? value : value; return probe.replace(/\s+/g, '').toLowerCase(); };
  const open = async () => {
    await openCareer(browser);
    await evaluate(`document.querySelector('[data-nav="elezioni"]')?.click(), true`); await pause(500);
    await evaluate(`document.querySelector('[data-section-tab="elezioni"][data-section-tab-value="nazionali"]')?.click(), true`); await pause(900);
    await waitFor(() => evaluate(`document.querySelectorAll('.nv-swatch').length > 0`), 20000);
  };
  const byLabel = rows => { const map = new Map(); for (const [label, color] of rows) { const key = label.replace(/\s*\d.*$/, '').trim(); const value = rgb(color); if (map.has(key) && map.get(key) !== value) throw new Error(`«${key}» ha due colori nella stessa pagina: ${map.get(key)} e ${value}.`); map.set(key, value); } return map; };

  await open();
  const first = byLabel(await collect());
  swatches = first.size;
  assert.ok(first.size >= 3, `La pagina ha almeno tre voci colorate (${[...first.keys()].join(', ')}).`);
  assert.ok(![...first.values()].some(color => /undefined|nan/.test(color)), 'Colori validi.');
  // after weeks of play, the same labels have the same colours
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${browser.version}'); for (let i = 0; i < 6; i++) store.advanceTurn(1); return true; })()`);
  await open();
  const later = byLabel(await collect());
  for (const [label, color] of first) if (later.has(label)) assert.equal(later.get(label), color, `«${label}»: stesso colore dopo sei settimane.`);
  // after a reload, at another width
  await viewport(390, 844, true); await pause(300);
  await open();
  const phone = byLabel(await collect());
  for (const [label, color] of first) if (phone.has(label)) assert.equal(phone.get(label), color, `«${label}»: stesso colore a 390 px, dopo il ricaricamento.`);
  // the 2022 alliances of the map have the colours of the table
  assert.ok(await evaluate(`(() => { const view = document.querySelector('[data-view-filter="nazionali"][data-view-filter-value="2022"]'); if (!view) return false; view.click(); return true; })()`), 'La mappa ha la vista dei vincitori del 2022.');
  await pause(700);
  const map2022 = byLabel(await collect());
  const wanted = { Centrodestra: ALLIANCE_COLORS.cdx, Centrosinistra: ALLIANCE_COLORS.csx, Movimento: ALLIANCE_COLORS.m5s };   // (the page's labels are cut at the first digit: «Movimento 5 Stelle» → «Movimento»)
  const hex = value => { const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(value); return m ? `#${[1, 2, 3].map(i => Number(m[i]).toString(16).padStart(2, '0')).join('')}` : value; };
  for (const [label, color] of Object.entries(wanted)) { const found = [...map2022].find(([name]) => name === label); assert.ok(found, `${label}: nella legenda della mappa del 2022 (${[...map2022.keys()].join(', ')}).`); assert.equal(hex(found[1]).toLowerCase(), color.toLowerCase(), `${label} (2022): il colore della tabella.`); mapColors++; }
  assert.deepEqual(errors, [], `Errori in pagina: ${errors.slice(0, 2).join(' | ')}`);
}, {});
console.log(`Colori delle coalizioni verificati: tabella per id con la sola serie validata (leggibile sui pannelli scuri), otto forze principali con otto colori, centrodestra e centrosinistra distinti (non più due azzurri), coalizione = colore del capofila, il resto sorteggiato dall’id; la tavolozza della pagina dà a ogni id lo stesso colore in 60 combinazioni e ordini diversi${chromeAvailable ? `; in Chrome ${swatches} voci della pagina Nazionali con un solo colore ciascuna, uguale dopo sei settimane, dopo il ricaricamento e a 390 px (${mapColors} alleanze del 2022 con i colori della tabella)` : '; parte nel browser NON eseguita'}.`);
