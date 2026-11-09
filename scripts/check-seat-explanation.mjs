// A list at 11% without a seat is not a contradiction: the seats of the proportional count are shared in the multi-member districts, so a party at 11% wins about one seat in each of them, and a
// candidate who is FOURTH on the list needs four seats in that district. This check puts that in numbers on the real engine (legislature-engine.js politicheOutcome, the average multi-member district
// of the chamber when the map is not loaded): 4th on the list is not elected (code «posizione-lista» or «sconfitta», never a mandate through the list), 1st on the list almost always is, a list under
// the threshold has the code «sotto-soglia», a leader who heads the list in several districts is elected more often than a candidate in one district, and every outcome has a text that says why.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { politicheOutcome, LEGISLATURE_RULES } = await load('src/core/legislature-engine.js');
const { ELECTION_OUTCOME_LABELS } = await load('src/data/simulation/campaign-rules.js').catch(() => ({}));

const chamber = 'camera';
const proportionalSeats = 245; // the proportional share of the Chamber (the rest is single-member districts and abroad)
const make = (share, prop) => ({ id: 'ris', coalitions: [], national: [{ id: 'F', share }], [chamber]: { parties: [{ id: 'F', prop }], shares: { F: share }, byRegion: {}, playerNational: prop, playerLists: {} } });
const play = (share, prop, listPosition, leader, seeds) => {
  const outcomes = { mandate: 0, 'posizione-lista': 0, sconfitta: 0, 'sotto-soglia': 0 };
  for (let i = 0; i < seeds; i++) {
    let a = (i + 1) * 2654435761 >>> 0; const rand = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const out = politicheOutcome(make(share, prop), { candidate: true, chamber, forceId: 'F', listPosition, leader, districts: {} }, { rand });
    if (out.mandate) outcomes.mandate++; else outcomes[out.code] = (outcomes[out.code] ?? 0) + 1;
    assert.ok(out.code && typeof out.share === 'number' && out.threshold === LEGISLATURE_RULES.thresholds.list, 'Ogni esito ha codice, quota e soglia.');
  }
  return outcomes;
};
const prop = 245 * 0.11; // ≈ 27 proportional seats for a party at 11%
const first = play(11, prop, 1, false, 400), fourth = play(11, prop, 4, false, 400), fourthLeader = play(11, prop, 4, true, 400), below = play(2.1, 0, 1, false, 50);
const perDistrict = prop / LEGISLATURE_RULES.plurinominali[chamber];
assert.ok(perDistrict > 0.5 && perDistrict < 1.6, `Un partito all’11% ha circa un seggio per circoscrizione (${perDistrict.toFixed(2)}).`);
assert.ok(first.mandate / 400 > 0.35 && first.mandate / 400 < 0.75, `Primo in lista con mezzo seggio a circoscrizione: eletto circa una volta su due (${first.mandate}/400).`);
assert.equal(fourth.mandate, 0, `Quarto in lista con un solo seggio a circoscrizione: mai eletto dalla lista (${fourth.mandate}/400).`);
assert.ok(fourth['posizione-lista'] + fourth.sconfitta === 400, 'Il motivo è la posizione in lista (o nessun seggio nella circoscrizione), mai la soglia.');
assert.ok(fourthLeader.mandate <= fourth.mandate + 400 * 0.02, 'Anche un capolista in più circoscrizioni non diventa quarto per magia: servono quattro seggi in una circoscrizione.');
assert.equal(below.mandate, 0); assert.equal(below['sotto-soglia'], 50, 'Sotto il 3% la lista resta fuori: «sotto-soglia».');
// the texts that tell the player why (the labels of the outcome and the sentence of the election engine)
const labels = (await load('src/data/simulation/campaign-rules.js'));
const text = JSON.stringify(labels);
assert.ok(/Non eletto: posizione in lista non utile/.test(text) && /Lista sotto la soglia di sbarramento/.test(text), 'Le etichette dicono il motivo.');
console.log(`Seggio e quota: all’11% ≈ ${perDistrict.toFixed(1)} seggi per circoscrizione; primo in lista eletto ${first.mandate}/400, quarto in lista ${fourth.mandate}/400 (motivo: posizione in lista), sotto il 3% sempre fuori.`);
