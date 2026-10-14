// Sondaggi e media › Territori › «Classifica delle regioni» (territoryRanking in observatory-view.js, regionBars in territory-charts.js). The fault it guards against: the ranking dropped, without a
// word, every region that had no figure for the measure (with «Voto reale 2022» a force that did not run in a region showed 19 regions, not 20), wrote «9%» next to «9,1%» (no fixed decimals) and
// gave a sign to a figure that rounds to zero («−0»). Now: every region is listed, those without a figure at the end with «—» and the reason; a zero is a zero, not a missing value; decimals are fixed;
// the order, the width of each bar and the figure written agree with the data; the real 2022 vote is kept apart from the simulated estimate.
// Part 1 runs on the function with built-in cases; part 2, in Chrome, on the real page for a force with a 2022 list (Lega) and one without (Futuro Nazionale), with all 20 regions and all four measures.
import assert from 'node:assert/strict';
import { REGION_TILES, regionBars } from '../src/ui/territory-charts.js';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

const REGIONS = Object.keys(REGION_TILES);
assert.equal(REGIONS.length, 20);
const rowsOf = html => [...html.matchAll(/<button type="button" class="rbar-row([^"]*)"[^>]*>(.*?)<\/button>/gs)].map(match => ({
  classes: match[1], region: match[2].match(/class="rbar-name">([^<]*)/)?.[1].trim(), value: match[2].match(/<b class="rbar-value"[^>]*>([^<]*)<\/b>/)?.[1], width: Number(match[2].match(/<i[^>]*width:([\d.]+)%/)?.[1] ?? NaN), missing: /is-missing/.test(match[1]), why: match[2].match(/class="rbar-why">([^<]*)/)?.[1] ?? null
}));
const items = (fn) => REGIONS.map((region, index) => ({ region, share: null, gap: null, change: null, real: null, ...fn(region, index) }));

// ---------- 1. the function ----------
{
  // quota: 20 rows, sorted, fixed decimals, widths in proportion, national marker, selection and home
  const shares = items((region, index) => ({ share: 5 + (index % 7) * 0.9 + (index === 3 ? 0.05 : 0) }));
  shares.find(item => item.region === 'Lazio').share = 9; // a whole number: «9,0%», never «9%»
  const html = regionBars(shares, { mode: 'quota', selected: 'Toscana', home: 'Lazio', national: 7.2, digits: 1 });
  const rows = rowsOf(html);
  assert.equal(rows.length, 20, 'Venti regioni, venti righe.');
  assert.ok(rows.every(row => /^\d+,\d%$/.test(row.value)), `Decimali fissi: ${rows.map(row => row.value).join(' ')}`);
  assert.equal(rows.find(row => row.region === 'Lazio').value, '9,0%');
  const values = rows.map(row => Number(row.value.replace(',', '.').replace('%', '')));
  assert.deepEqual(values, [...values].sort((a, b) => b - a), 'In ordine decrescente.');
  assert.equal(rows[0].width, 100, 'La barra più lunga è piena.');
  rows.forEach(row => assert.ok(Math.abs(row.width - Number(row.value.replace(',', '.').replace('%', '')) / Math.max(...values, 7.2) * 100) < 0.6, `${row.region}: la barra è proporzionale al valore (${row.width}% per ${row.value}).`));
  assert.ok(/class="rbar-row is-selected[^"]*"[^>]*data-view-filter-value="Toscana"|data-view-filter-value="Toscana"[^>]*aria-pressed="true"/.test(html), 'La regione aperta è segnata.');
  assert.ok(html.includes('la tua regione') && html.includes('Dato nazionale 7,2%'), 'La tua regione e il dato nazionale sono segnati.');
  // 2022 real vote: two regions without a list are kept, at the end, with the reason
  const real = items((region, index) => ({ real: ['Valle d’Aosta', 'Trentino-Alto Adige'].includes(region) ? null : 3 + index * 0.37 }));
  real.find(item => item.region === 'Molise').real = 0; // a zero is a zero
  const realHtml = regionBars(real, { mode: 'reale', national: 7.2, digits: 1, color: 'var(--gold)' });
  const realRows = rowsOf(realHtml);
  assert.equal(realRows.length, 20, 'Anche con il voto reale 2022, venti regioni: nessuna riga nascosta.');
  assert.deepEqual(realRows.slice(-2).map(row => row.region).sort(), ['Trentino-Alto Adige', 'Valle d’Aosta']);
  assert.ok(realRows.slice(-2).every(row => row.missing && row.value === '—' && /nessuna lista/.test(row.why)), 'Le regioni senza lista sono in fondo, con «—» e il motivo.');
  const molise = realRows.find(row => row.region === 'Molise');
  assert.ok(!molise.missing && molise.value === '0,0%', `Zero è zero, non dato mancante (${molise.value}).`);
  assert.equal(realRows.indexOf(molise), 17, 'Lo zero sta in coda ai valori, prima dei dati mancanti.');
  assert.ok(realHtml.includes('18 regioni con il dato, 2 senza'), 'Il conto dei dati mancanti è scritto.');
  // gaps and changes: no «−0», two decimals when everything is under a point
  const small = items((region, index) => ({ change: [-0.04, 0.03, 0, 0.012][index % 4], gap: [-0.04, 0.03, 0, 0.012][index % 4] }));
  const smallRows = rowsOf(regionBars(small, { mode: 'variazione', digits: 1 }));
  assert.equal(smallRows.length, 20);
  assert.ok(smallRows.every(row => !/^[−+±]0$/.test(row.value) && !/^−0,0$/.test(row.value)), `Nessun «−0»: ${[...new Set(smallRows.map(row => row.value))].join(' ')}`);
  assert.ok(smallRows.some(row => row.value === '−0,04') && smallRows.some(row => row.value === '+0,03') && smallRows.some(row => row.value === '±0,00'), 'Con scarti sotto il punto servono due decimali.');
  const wide = items((region, index) => ({ gap: (index - 9.5) * 0.4 }));
  const wideRows = rowsOf(regionBars(wide, { mode: 'scarto', digits: 1, national: 7 }));
  assert.ok(wideRows.every(row => /^[−+±]\d+,\d$/.test(row.value)), `Scarti da un punto in su: un decimale (${wideRows.map(row => row.value).join(' ')}).`);
  assert.ok(wideRows[0].value.startsWith('+') && wideRows.at(-1).value.startsWith('−'), 'Sopra in testa, sotto in coda.');
  // nothing at all, extremes, ties
  assert.ok(regionBars(items(() => ({})), { mode: 'quota' }).includes('Nessun dato regionale'), 'Senza nessun dato lo dice.');
  const extreme = rowsOf(regionBars(items((region, index) => ({ share: index === 0 ? 100 : index === 1 ? 0 : 12.345 })), { mode: 'quota', digits: 1 }));
  assert.equal(extreme.length, 20); assert.equal(extreme[0].value, '100,0%'); assert.equal(extreme.at(-1).value, '0,0%'); assert.ok(!extreme.at(-1).missing);
  const ties = rowsOf(regionBars(items(() => ({ share: 6.5 })), { mode: 'quota', digits: 1 })).map(row => row.region);
  assert.deepEqual(ties, [...REGIONS].sort((a, b) => a.localeCompare(b, 'it')), 'A parità di valore, in ordine alfabetico: l’ordine non cambia da un disegno all’altro.');
  assert.equal(rowsOf(regionBars(items((region, index) => ({ gap: index ? -index : 3 })), { mode: 'scarto', digits: 1 })).length, 20);
}

// ---------- 2. the real page ----------
if (!chromeAvailable) console.log('Parte nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).');
else {
  const problems = [];
  const check = (condition, message) => { if (!condition) problems.push(message); };
  for (const [name, party, group, hasReal] of [['Lega', 'party-registro-p1-2017-41-ir', 'cam-xix-03', true], ['Futuro Nazionale', 'party-futuro-nazionale', 'cam-xix-12', false]]) {
    await withBrowser(async browser => {
      const { evaluate, version } = browser;
      await createCareerInPage(browser, { party, group, weeks: 12 });
      await openCareer(browser);
      await evaluate(`(async () => { document.querySelector('[data-nav="sondaggi"]')?.click(); await new Promise(r => setTimeout(r, 700)); document.querySelector('[data-obs-area="territori"]')?.click(); await new Promise(r => setTimeout(r, 600)); return true; })()`);
      const source = await evaluate(`(async () => {
        const { store } = await import('/src/core/store.js?v=${version}'); const engine = await import('/src/core/world-engine.js?v=${version}'); const reg = await import('/src/core/regional-vote.js?v=${version}'); const real = await import('/src/data/repositories/real-data.js?v=${version}');
        const s = store.getState(); const report = engine.observatoryReport(s.world, s.society); const force = s.world.parties.find(item => item.isPlayer);
        const geography = await real.loadRealDocument('electoralGeography'); const vote = reg.forceRegionalVote2022(geography, force.id);
        const regional = {}; for (const [region, rows] of Object.entries(report.regional ?? {})) regional[region] = rows.find(row => row.partyId === force.id)?.share ?? null;
        return { regional, real: vote ? vote.regions : null, national: report.latestAverage?.rows.find(row => row.partyId === force.id)?.share ?? null };
      })()`);
      check(Object.keys(source.regional).length === 20, `${name}: venti regioni nel quadro (${Object.keys(source.regional).length}).`);
      const fmt = (value, digits) => value === null || value === undefined ? '—' : `${Number(value).toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
      for (const mode of ['quota', 'scarto', 'variazione', 'reale']) {
        const available = await evaluate(`Boolean(document.querySelector('[data-view-filter-value=${mode}]:not([disabled])'))`);
        if (mode === 'reale' && !hasReal) { check(!available || (await evaluate(`(async () => { document.querySelector('[data-view-filter-value=reale]')?.click(); await new Promise(r => setTimeout(r, 400)); return document.querySelectorAll('.rbars .rbar-row').length; })()`)) !== 19, `${name}: senza lista del 2022 la misura reale non finge un dato.`); continue; }
        if (!available) { check(mode === 'variazione' || mode === 'reale', `${name}: la misura «${mode}» non è disponibile.`); continue; }
        await evaluate(`(async () => { document.querySelector('[data-view-filter-value=${mode}]')?.click(); await new Promise(r => setTimeout(r, 500)); return true; })()`);
        const view = await evaluate(`(() => { const box = document.querySelector('.rbars'); const rows = [...box.querySelectorAll('.rbar-row')].map(row => ({ region: row.querySelector('.rbar-name')?.firstChild?.textContent.trim(), value: row.querySelector('.rbar-value')?.textContent.trim(), missing: row.classList.contains('is-missing'), selected: row.classList.contains('is-selected'), width: parseFloat(row.querySelector('.rbar-track i')?.style.width ?? 'NaN') })); const panel = box.closest('section, article, .poll-panel'); return { rows, kicker: panel?.querySelector('.section-kicker')?.textContent.trim() ?? '', text: panel?.textContent ?? '', overflow: box.scrollWidth > box.clientWidth + 1 }; })()`);
        check(view.rows.length === 20, `${name} · ${mode}: ${view.rows.length} righe invece di 20.`);
        check(new Set(view.rows.map(row => row.region)).size === 20, `${name} · ${mode}: regioni ripetute o mancanti.`);
        check(view.rows.filter(row => row.selected).length === 1, `${name} · ${mode}: una sola regione aperta.`);
        const reference = mode === 'quota' ? source.regional : mode === 'reale' ? source.real : null;
        if (reference) {
          for (const row of view.rows) {
            const expected = reference[row.region];
            check(row.value === fmt(Number.isFinite(expected) ? expected : null, 1) || row.value === fmt(Number.isFinite(expected) ? expected : null, 2), `${name} · ${mode} · ${row.region}: scritto ${row.value}, il dato è ${expected}.`);
            check(row.missing === !Number.isFinite(expected), `${name} · ${mode} · ${row.region}: «dato mancante» non coincide con il dato.`);
          }
          const withData = view.rows.filter(row => !row.missing);
          const nums = withData.map(row => reference[row.region]);
          check(nums.every((value, index) => index === 0 || nums[index - 1] >= value), `${name} · ${mode}: righe fuori ordine.`);
          check(view.rows.slice(withData.length).every(row => row.missing), `${name} · ${mode}: i dati mancanti non sono in fondo.`);
        }
        if (mode === 'reale') check(/reale/i.test(view.kicker) && /Eligendo|Ministero dell’Interno/.test(view.text), `${name}: il voto reale dichiara la sua fonte (${view.kicker}).`);
        else check(/simula/i.test(view.text), `${name} · ${mode}: la stima è dichiarata simulata.`);
        check(!view.rows.some(row => /^[−+±]0$/.test(row.value) || row.value === '−0,0'), `${name} · ${mode}: valori «−0».`);
        check(!view.overflow, `${name} · ${mode}: la classifica esce dalla pagina.`);
      }
    });
  }
  if (problems.length) { console.error(`Classifica delle regioni: ${problems.length} problemi.\n${[...new Set(problems)].slice(0, 40).join('\n')}`); process.exit(1); }
}
console.log('Classifica delle regioni verificata: sempre venti righe (anche con il voto reale 2022: le regioni senza lista sono in fondo con «—» e il motivo, lo zero resta uno zero), decimali fissi, nessun «−0», ordine, barra e valore coerenti con i dati, parità in ordine alfabetico, la regione aperta e la tua segnate, voto reale e stima simulata distinti e dichiarati; sulla pagina vera con Lega (con lista nel 2022) e Futuro Nazionale (senza) e le quattro misure.');
