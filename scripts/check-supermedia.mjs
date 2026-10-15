// The Supermedia YouTrend/Agi of 1 October 2026 as the opening poll of the realistic careers (the one of 24 September stays as history):
//   - the twelve figures and the published variations are exactly those of the table; the twelve add up to 96.6 and «Altri» is the 3.4 left, never a force of its own;
//   - three dates stay apart (reference 2026-10-01, polls 17–30 September, article 2026-10-07) and apart from the day the project recorded it; provenance is the article, with its note;
//   - the September file is untouched; a career that starts before the article is out (5 October) still opens with September's poll, the ones that start on 12 October with the new one;
//   - in the game: the first poll is real, shows the published values, variations, dates and source, adds up to 100 with «Altri»; from the next week the polls are simulated and move gradually;
//   - the real JSON files are the same before and after (nothing simulated flows back into them) and the stamp of the data follows their content.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const dir = new URL('../src/data/real/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, dir), 'utf8'));
const digest = async () => { const hash = createHash('sha256'); for (const name of (await readdir(dir)).filter(item => item.endsWith('.json')).sort()) hash.update(name).update(await readFile(new URL(name, dir))); return hash.digest('hex'); };
const before = await digest();

const EXPECTED = [
  ['Fratelli d’Italia', 26.8, 0.2], ['Partito Democratico', 20.4, -0.7], ['Movimento 5 Stelle', 12.8, 0.3], ['Futuro Nazionale', 7.7, 0], ['Forza Italia', 7.4, 0], ['Alleanza Verdi e Sinistra', 6.3, -0.1],
  ['Lega', 5.7, 0.1], ['Azione', 3.2, -0.1], ['Italia Viva', 2.2, -0.1], ['+Europa', 1.7, 0.2], ['Partito Liberaldemocratico', 1.3, -0.1], ['Noi Moderati', 1.1, 0]
];
const SEPTEMBER = [27, 20.8, 12.6, 7.8, 7.4, 6.5, 5.6, 3.4, 2.2, 1.5, 1.1, 1.1];

// ---------- 1. the file ----------
const polls = await read('polls.json');
assert.equal(polls.length, 2, 'Due sondaggi reali: lo storico di settembre e la Supermedia di ottobre.');
const [september, october] = polls;
assert.equal(september.id, 'poll-supermedia-youtrend-agi-2026-09-24', 'Lo storico di settembre resta.');
assert.deepEqual(september.results.map(row => row.share), SEPTEMBER, 'I valori di settembre non sono stati toccati.');
assert.equal(september.publishedAt, '2026-09-24');
assert.equal(october.id, 'poll-supermedia-youtrend-agi-2026-10-01');
assert.deepEqual(october.results.map(row => [row.label, row.share, row.delta]), EXPECTED, 'Dodici valori e variazioni esattamente come pubblicati.');
const total = Math.round(october.results.reduce((sum, row) => sum + row.share, 0) * 10) / 10;
assert.equal(total, 96.6, 'Le dodici forze sommano 96,6.');
assert.equal(october.others, 3.4, 'Il residuo è 3,4.');
assert.ok(/non è un dato che la fonte pubblichi/.test(october.othersNote), 'Il residuo non è attribuito alla fonte.');
assert.equal(Math.round((total + october.others) * 10) / 10, 100, 'Forze e residuo fanno 100.');
assert.equal(october.referenceDate, '2026-10-01', 'Data di riferimento.');
assert.deepEqual([october.fieldworkFrom, october.fieldworkTo], ['2026-09-17', '2026-09-30'], 'Finestra dei sondaggi considerati.');
assert.equal(october.publishedAt, '2026-10-07', 'Pubblicazione dell’articolo.');
assert.ok(october.verifiedAt >= october.publishedAt && october.verifiedAt !== october.referenceDate, 'La data di verifica del progetto è un’altra data.');
assert.ok(october.source === 'real' && october.verified === true && /youtrend\.it\/2026\/10\/07\/supermedia-youtrend-agi-il-pd-scende-al-204/.test(october.sourceUrl) && /YouTrend/.test(october.sourceName), 'Fonte: l’articolo di YouTrend.');
assert.ok(/non era raggiungibile|non è stata riletta/.test(october.verificationNote ?? ''), 'La nota dice come è stata registrata.');
assert.ok(october.results.every(row => row.entityId && !/Altri/i.test(row.label)), 'Nessuna riga «Altri» tra le forze.');
assert.ok(/non sono la differenza con la rilevazione del 24\/09/.test(october.deltaNote), 'Le variazioni sono dichiarate come pubblicate.');
const manifest = await read('manifest.json');
assert.equal(manifest.collections.realPolls, 2, 'Il manifest conta due sondaggi.');
const { computeDataVersion, currentDataVersion } = await import('./lib/data-version.mjs');
assert.equal(await currentDataVersion(), await computeDataVersion(), 'Il timbro dei dati segue il loro contenuto.');

// ---------- 2. in the game ----------
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const roundOf = value => Math.round(value * 10) / 10;
const opening = world => world.polls.find(item => item.source === 'real');
const run = await startCareer({ seed: 'supermedia-ottobre', level: 'deputato', partyId: 'party-futuro-nazionale', fast: true });
const { store } = run;
let world = store.getState().world;
const first = opening(world);
assert.ok(first && first.real.id === october.id, 'La prima rilevazione è la Supermedia del 1° ottobre.');
assert.equal(first.date, '2026-10-01', 'Con la data di riferimento.');
assert.deepEqual([first.real.referenceDate, first.real.publishedAt, first.real.fieldworkFrom, first.real.fieldworkTo], ['2026-10-01', '2026-10-07', '2026-09-17', '2026-09-30'], 'Le tre date restano distinte.');
assert.ok(/youtrend\.it/.test(first.real.sourceUrl) && /YouTrend/.test(first.real.sourceName), 'Provenienza.');
const shown = first.results.filter(row => row.real);
assert.equal(shown.length, 12, 'Dodici forze reali.');
for (const [label, share, delta] of EXPECTED) {
  const party = world.parties.find(item => item.label === label || item.officialName === label || (label === 'Alleanza Verdi e Sinistra' && /Verdi/.test(item.label)));
  assert.ok(party, `${label}: è nel mondo.`);
  const row = first.results.find(item => item.partyId === party.id);
  assert.ok(row?.real, `${label}: riga reale.`);
  assert.equal(row.share, share, `${label}: ${share}%.`);
  assert.equal(row.delta, delta, `${label}: variazione pubblicata ${delta}.`);
}
assert.equal(first.others, 3.4, 'Altri: 3,4.');
assert.equal(roundOf(first.results.filter(row => !row.outsideSource).reduce((sum, row) => sum + row.share, 0) + first.others), 100, 'Totale normalizzato a 100 con Altri.');
assert.ok(first.results.every(row => Number.isFinite(row.share) && row.share >= 0), 'Nessun valore negativo o NaN.');
assert.equal(first.sample, null, 'Nessun campione inventato per un dato reale.');
assert.equal(first.margin, null, 'Nessun margine d’errore inventato per una media.');
// the weeks after: simulated, gradual, always 100
let previous = first;
for (let week = 1; week <= 8; week++) {
  store.advance(7);
  world = store.getState().world;
  const current = world.polls.at(-1);
  assert.equal(current.source, 'simulation', `Settimana ${week}: sondaggio simulato.`);
  assert.ok(current.date > previous.date, `Settimana ${week}: data successiva.`);
  const known = current.results.filter(row => !row.outsideSource);
  const sum = known.reduce((s, row) => s + row.share, 0) + (current.others ?? 0);
  assert.ok(Math.abs(sum - 100) <= 1.2, `Settimana ${week}: tutto sommato fa ${roundOf(sum)}.`);
  for (const row of current.results) {
    assert.ok(Number.isFinite(row.share) && row.share >= 0 && Number.isFinite(row.delta), `Settimana ${week}: valori validi.`);
    const old = previous.results.find(item => item.partyId === row.partyId);
    if (old && week === 1) assert.ok(Math.abs(row.share - old.share) <= 1.8, `Settimana 1: ${row.partyId} si muove poco (${old.share} → ${row.share}).`);
  }
  previous = current;
}
assert.equal(opening(world)?.real.id, october.id, 'Il dato reale resta nello storico del mondo.');
assert.ok(world.polls.filter(item => item.source === 'real').length === 1, 'Un solo sondaggio reale nel mondo della carriera.');

// ---------- 3. a career that starts before the article is out ----------
{
  const early = await startCareer({ seed: 'supermedia-presto', level: 'deputato', partyId: 'party-futuro-nazionale', fast: true, startDate: '2026-10-05' });
  const poll = opening(early.store.getState().world);
  assert.equal(poll.real.id, september.id, 'Prima del 7 ottobre la carriera apre con la Supermedia del 24 settembre.');
  assert.equal(poll.results.find(row => /Futuro Nazionale/.test(early.store.getState().world.parties.find(p => p.id === row.partyId)?.label ?? ''))?.share, 7.8, 'Con i valori di settembre.');
  const late = await startCareer({ seed: 'supermedia-tardi', level: 'deputato', partyId: 'party-futuro-nazionale', fast: true, startDate: '2026-10-12' });
  assert.equal(opening(late.store.getState().world).real.id, october.id, 'Dal 12 ottobre con quella di ottobre.');
}

assert.equal(await digest(), before, 'I JSON reali sono identici prima e dopo: nulla di simulato vi è confluito.');
console.log('Supermedia del 01/10/2026 verificata: dodici valori e variazioni esatti, totale 96,6 e Altri 3,4, tre date distinte con la verifica del progetto, storico di settembre intatto, prima rilevazione reale con provenienza e passaggio graduale alla simulazione, JSON reali invariati.');
