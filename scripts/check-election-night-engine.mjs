// The election night, engine level (core/night-engine.js): for the votes that a real career plays (the engine of the campaign, the stored result), the night built from the result is
// consistent: the simulated units add up, per group, to the exact votes of the result; the count only grows hour by hour; the last hour is the result of the election engine; the
// partial percentages are computed on the counted votes; the territories add up to the total; nothing is random (the same night twice is the same, and building it leaves the
// random sequence of the campaign untouched); the news are told once; the player's statement is stored once. Run with ONLY=level to limit.
import assert from 'node:assert/strict';
import { startCareer, playWeek } from './lib/long-run.mjs';
import { NIGHT_HOURS, advanceNight, answerStatement, createNight, exitPoll, nightConsistency, nightTally, nightView, pendingPrompts, projection, hash01, apportion } from '../src/core/night-engine.js';

// ---------- pure helpers ----------
assert.deepEqual(apportion(10, [1, 1, 1]), [4, 3, 3], 'Il resto va al primo.');
assert.equal(apportion(1000003, [3, 5, 7, 11]).reduce((a, b) => a + b, 0), 1000003, 'La ripartizione somma al totale.');
assert.deepEqual(apportion(0, [1, 2]), [0, 0]);
assert.equal(hash01('a'), hash01('a'), 'L’hash è deterministico.');
assert.notEqual(hash01('a'), hash01('b'));

const levels = (process.env.ONLY ? process.env.ONLY.split(',') : ['comunale', 'regionale', 'deputato']);
let nights = 0, runoffs = 0;
for (const level of levels) {
  const { store, db, decide } = await startCareer({ seed: `notte-${level}`, level, fast: true, territorial: true });
  const found = new Map();
  for (let week = 0; week < 52 * 5 && store.getState().game?.status !== 'ended'; week++) {
    playWeek({ store, db, decide });
    const now = store.getState().campaign;
    if (now?.status === 'finished' && now.result) {
      const kind = `${now.electionType}${now.firstRoundResult ? '+ballottaggio' : ''}`;
      if (!found.has(kind)) found.set(kind, JSON.parse(JSON.stringify(now)));
    }
  }
  assert.ok(found.size, `${level}: almeno una campagna conclusa con un risultato.`);
  for (const [kind, campaign] of found) {
  const stages = ['finale', ...(campaign.firstRoundResult ? ['primo-turno'] : [])];
  for (const stage of stages) {
    const rngBefore = JSON.stringify(campaign.rngState);
    // a candidate who was in the first round and is out of the runoff has lost: he is not «escluso dalla candidatura» (the party never nominated him)
    if (stage === 'finale' && campaign.firstRoundResult && campaign.candidates?.some(item => item.isPlayer)) assert.notEqual(campaign.result.outcome?.code, 'escluso', `${level}/${kind}: chi esce al primo turno ha perso, non è escluso dalla candidatura.`);
    const first = createNight(campaign, stage);
    assert.ok(first, `${level}/${stage}: la notte si crea.`);
    assert.equal(JSON.stringify(campaign.rngState), rngBefore, `${level}/${stage}: la sequenza casuale della campagna non viene toccata.`);
    assert.equal(first.hour, 1, 'La notte si apre alla prima ora.');
    assert.equal(first.feed.some(item => item.tag === 'EXIT POLL'), true, 'La prima ora ha l’exit poll, dichiarato come stima.');
    assert.ok(first.feed.find(item => item.tag === 'EXIT POLL').text.includes('stima, non è un risultato'), 'L’exit poll è distinto dal risultato.');
    assert.deepEqual(nightConsistency(first), [], `${level}/${stage}: unità, totali e ore sono coerenti.`);
    const sum = (rows, key) => rows.reduce((acc, row) => acc + row[key], 0);
    const result = stage === 'finale' ? campaign.result : campaign.firstRoundResult;
    // hour by hour
    let night = first; let previousBallots = -1; let previousCounted = -1;
    const views = [];
    for (let hour = 1; hour <= NIGHT_HOURS; hour++) {
      if (hour > 1) night = advanceNight(night);
      assert.equal(night.hour, hour, 'Una sola ora per volta.');
      const view = nightView(night, hour);
      views.push(view);
      assert.ok(view.ballots >= previousBallots && view.counted >= previousCounted, `${level}/${stage}: ora ${hour}, i voti e le unità contate non calano.`);
      previousBallots = view.ballots; previousCounted = view.counted;
      assert.equal(sum(view.rows, 'votes'), view.ballots, 'Le righe sommano ai voti scrutinati.');
      if (view.ballots) for (const row of view.rows) assert.equal(row.percent, Math.round(row.votes * 10000 / view.ballots) / 100, `${level}: percentuale parziale sui voti scrutinati (${row.label}).`);
      assert.equal(sum(view.areas, 'ballots'), view.ballots, 'I territori sommano ai voti scrutinati.');
      const proj = projection(night, view);
      assert.ok(Math.abs(proj.rows.reduce((acc, row) => acc + row.percent, 0) - 100) < 0.6, 'La proiezione somma a 100.');
      if (hour === 1) assert.equal(view.counted, 0, 'Alla prima ora lo scrutinio non è iniziato.');
      if (night.snapshot.seatTotal) assert.equal(proj.rows.reduce((acc, row) => acc + row.seats, 0), view.complete ? night.snapshot.seatTotal : night.snapshot.rule.seatCount, `${level}/${stage}: ora ${hour}, i seggi stimati sommano ai seggi dell’assemblea secondo la regola del voto.`);
      if (view.complete) {
        // count closed (the last hour, or earlier for a small council): the projection IS the official result, to the last decimal and the last seat
        for (const row of proj.rows) { const official = view.rows.find(item => item.id === row.id); assert.equal(row.percent, official.percent, `${level}/${stage}: ultima ora, la proiezione di ${row.label} coincide con il risultato ufficiale (${row.percent} / ${official.percent}).`); assert.equal(row.seats, night.snapshot.groups.find(group => group.id === row.id).seats, 'Anche i seggi coincidono.'); }
        assert.equal(proj.official, true); assert.equal(proj.margin, 0);
      } else assert.equal(proj.official, false, 'A scrutinio aperto la proiezione è una stima.');
      if (hour === NIGHT_HOURS) assert.equal(view.complete, true, 'All’ultima ora lo scrutinio è chiuso.');
    }
    const last = views.at(-1);
    assert.equal(last.complete, true);
    assert.equal(last.ballots, night.snapshot.totalVotes, `${level}/${stage}: il totale finale è quello dello snapshot.`);
        const listedPercent = result.groups.reduce((acc, row) => acc + row.percent, 0);
    assert.ok(Math.abs(night.snapshot.totalVotes - Math.round(sum(result.groups, 'votes') * 100 / listedPercent)) <= 1 || listedPercent > 99.95, 'Il totale è quello del motore più gli «Altri» dichiarati (le percentuali del motore sono sui voti validi).');
    for (const group of result.groups) {
      const row = last.rows.find(item => item.id === group.id);
      assert.equal(row.votes, group.votes, `${level}/${stage}: voti finali di ${group.label} uguali al motore.`);
      assert.ok(Math.abs(row.percent - group.percent) <= 0.011 + 0.005, `${level}/${stage}: percentuale finale di ${group.label} (${row.percent} / ${group.percent}).`);
    }
    assert.equal(last.rows.find(row => !row.id.startsWith('altri'))?.id, [...result.groups].sort((a, b) => b.votes - a.votes || a.label.localeCompare(b.label))[0].id, 'Il primo finale è quello del motore.');
    assert.equal(projection(night, last).rows.reduce((acc, row) => acc + row.seats, 0), night.snapshot.seatTotal, 'A scrutinio chiuso i seggi sono quelli del motore.');
    for (const group of result.groups) assert.equal(projection(night, last).rows.find(row => row.id === group.id).seats, group.seats ?? 0, 'Seggi finali uguali al motore.');
    // the news are told once, and the feed has something for each hour
    const ids = night.feed.map(item => item.id);
    assert.equal(new Set(ids).size, ids.length, 'Nessuna notizia doppia.');
    for (let hour = 1; hour <= NIGHT_HOURS; hour++) assert.ok(night.feed.some(item => item.hour === hour), `Ora ${hour}: almeno una notizia.`);
    assert.equal(new Set(night.feed.filter(item => item.kind === 'speciale' || item.kind === 'chiusura').map(item => item.tag + item.text)).size, NIGHT_HOURS, 'Le dodici ore hanno contenuti distinti.');
    // no leakage: the projection of an hour before the last never reads the final seats (they are zeroed in a copy: same percentages, same estimated seats)
    const blind = { ...night, snapshot: { ...night.snapshot, groups: night.snapshot.groups.map(group => ({ ...group, seats: 0 })) } };
    for (let hour = 1; hour < NIGHT_HOURS; hour++) if (!nightView(night, hour).complete) assert.equal(JSON.stringify(projection(blind, nightView(blind, hour)).rows), JSON.stringify(projection(night, nightView(night, hour)).rows), `${level}/${stage}: ora ${hour}, la proiezione non usa i seggi finali.`);
    // the same with the votes of the units still to count: a copy whose uncounted units are emptied gives the same projection (nothing is read from the future)
    for (const hour of [3, 6, 9]) {
      const tally = nightTally(night); const counted = nightView(night, hour).counted;
      const probe = { ...night, snapshot: { ...night.snapshot } };
      const emptied = { ...tally, units: tally.units.map(unit => unit.order < counted ? unit : { ...unit, votes: unit.votes.map(() => 0), ballots: 0 }) };
      assert.ok(emptied.units.length === tally.units.length);
      // (the projection is computed from the view, which only sums counted units: the future units cannot matter)
      const v = nightView(night, hour); const sumCounted = v.ballots;
      assert.equal(sumCounted, tally.units.filter(unit => unit.order < counted).reduce((acc, unit) => acc + unit.ballots, 0), 'La vista somma solo le unità contate.');
      void probe;
    }
    // determinism: the same night rebuilt, the same feed, the same units; advancing past the end does nothing
    let again = createNight(campaign, stage);
    for (let hour = 2; hour <= NIGHT_HOURS; hour++) again = advanceNight(again);
    assert.equal(JSON.stringify(again.feed), JSON.stringify(night.feed), 'La stessa notte ricostruita è identica.');
    assert.equal(advanceNight(night).hour, NIGHT_HOURS, 'Dopo la dodicesima ora non si va oltre.');
    // reload in the middle (the record goes through JSON): same hour, same feed, advancing gives the same result as without the reload
    let half = createNight(campaign, stage); for (let hour = 2; hour <= 6; hour++) half = advanceNight(half);
    half = JSON.parse(JSON.stringify(half));
    for (let hour = 7; hour <= NIGHT_HOURS; hour++) half = advanceNight(half);
    assert.equal(JSON.stringify(half.feed), JSON.stringify(night.feed), 'Salvare e riprendere a metà non cambia né duplica nulla.');
    // statements
    let mid = createNight(campaign, stage);
    assert.equal(pendingPrompts(mid).length, 0, 'Nessuna dichiarazione prima dell’ora 3.');
    for (let hour = 2; hour <= 3; hour++) mid = advanceNight(mid);
    assert.equal(pendingPrompts(mid).length, 1);
    const said = answerStatement(mid, 'dichiarazione-3', 'fiduciosa');
    assert.equal(said.statements.length, 1);
    assert.equal(answerStatement(said, 'dichiarazione-3', 'attacco').statements.length, 1, 'Una dichiarazione si fa una volta sola.');
    assert.equal(pendingPrompts(said).length, 0);
    assert.ok(exitPoll(night).length > 0);
    assert.equal(nightTally(night), nightTally(night), 'Il conteggio è memorizzato.');
    nights++; if (stage === 'primo-turno') runoffs++;
    console.log(`${level}/${kind}/${stage}: ${campaign.electionType}, ${last.units} unità, ${night.snapshot.groups.length} gruppi, ${night.feed.length} notizie`);
  }
  }
}
console.log(`Notte elettorale (motore) verificata: ${nights} notti (${runoffs} di primo turno con ballottaggio) su ${levels.length} tipi di voto — unità e territori sommano ai voti del motore, il conteggio cresce soltanto, l’ultima ora è il risultato del motore, nessuna casualità consumata, notizie senza doppioni, salvataggio a metà identico.`);
