// How a force leaves the polls, on the real engine and on several deterministic seeds: by threshold (the simulated consensus below the exit line for the weeks the rules ask, after the minimum
// permanence), by merger (the same permanence and cooldown, never a consolidated force) or by the end of the observation. Every way out carries the evidence that decided it (the simulated
// consensus, the threshold, the weeks held, the previous state, the figure the latest poll published, the cooldown), the rules hold on every run, a force measured by the real source is not dropped
// for being where the source put it, a force that left comes back only after its cooldown, and the history of the polls stays whole (no series with a hole, no poll without the forces it measured).
import assert from 'node:assert/strict';
import { startCareer, playWeek } from './lib/long-run.mjs';
import { readFile } from 'node:fs/promises';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const engine = await import(new URL(`../src/core/world-engine.js${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { PRESENCE, PRESENCE_RULES, MERGE_RULES, mergeProblem } = engine;
const { evidenceLine } = await import(new URL(`../src/ui/polls-mode.js${build ? `?v=${build}` : ''}`, import.meta.url).href);
const lines = [];

// ---------- 1. the rules as pure functions ----------
const week = 40;
const force = (extra = {}) => ({ id: 'x', active: true, baseline: 1.4, presence: { status: PRESENCE.SURVEYED, since: week - 20, cooldownUntil: null, ...extra } });
const world = { week };
assert.equal(mergeProblem(world, force()), null, 'Una forza rilevata da tempo, senza cooldown, può essere assorbita.');
assert.match(mergeProblem(world, force({ since: week - 5 })), /permanenza/, 'Prima della permanenza minima no.');
assert.match(mergeProblem(world, force({ cooldownUntil: week + 3 })), /cooldown/, 'In cooldown no.');
assert.match(mergeProblem(world, force({ status: PRESENCE.CONSOLIDATED })), /consolidata/, 'Una forza consolidata prima deve scendere di stato.');
assert.match(mergeProblem(world, { ...force(), isPlayer: true }), /non disponibile/, 'Il partito del giocatore non si fonde da solo.');
assert.match(mergeProblem(world, { ...force(), active: false }), /non disponibile/, 'Una forza già uscita non si fonde.');
assert.match(mergeProblem(world, force(), new Map([['x', 3.4]])), /soglia di consolidamento/, 'Con un consenso già da consolidata no.');
lines.push('regole come funzioni pure (soglia, permanenza, cooldown, consolidata)');

// ---------- 2. several seeds: every exit and every merger keeps the rules and carries its evidence ----------
const SEEDS = ['a', 'b', 'c', 'd'];
const WEEKS = 104;
const record = { exits: [], merges: [], returns: [] };
let sample = null;
for (const seed of SEEDS) {
  const run = await startCareer({ seed, level: 'comunale', fast: true });
  const { store, db, decide } = run;
  let seenMoves = 0;
  const seenKeys = new Set();
  const lastMerge = [];
  const exitedAt = new Map();
  for (let step = 0; step < WEEKS; step++) {
    playWeek({ store, db, decide });
    const state = store.getState().world;
    if (!state) continue;
    const moves = state.presenceMoves ?? [];
    // presenceMoves keeps the latest 40: read what is new by week and id
    for (const move of moves.slice(Math.max(0, moves.length - 40))) {
      const key = `${move.week}|${move.id}|${move.to}|${move.merged ? 'm' : ''}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      seenMoves++;
      const ev = move.evidence;
      if (move.merged) {
        assert.ok(ev && ev.rule === 'fusione', `${seed} S${move.week}: la fusione di ${move.label} ha le sue prove.`);
        assert.ok(ev.weeksIn >= MERGE_RULES.minWeeks, `${seed} S${move.week}: ${move.label} è stata fusa dopo ${ev.weeksIn} settimane di permanenza (minimo ${MERGE_RULES.minWeeks}).`);
        assert.notEqual(ev.from, PRESENCE.CONSOLIDATED, `${seed} S${move.week}: una forza consolidata non si fonde.`);
        assert.ok(ev.share < MERGE_RULES.maxShare, `${seed} S${move.week}: ${move.label} aveva ${ev.share}%, sotto la soglia di consolidamento.`);
        if (lastMerge.length) assert.ok(move.week - lastMerge.at(-1) >= MERGE_RULES.cooldown, `${seed} S${move.week}: due fusioni a ${move.week - lastMerge.at(-1)} settimane di distanza (cooldown ${MERGE_RULES.cooldown}).`);
        lastMerge.push(move.week);
        assert.ok(evidenceLine(ev).includes(ev.intoLabel), 'La motivazione nomina la forza in cui confluisce.');
        record.merges.push({ seed, week: move.week, label: move.label, ev });
      } else if (move.to === PRESENCE.NONE) {
        assert.ok(ev, `${seed} S${move.week}: l’uscita di ${move.label} ha le sue prove.`);
        if (ev.rule === 'soglia') {
          assert.ok(ev.share < ev.threshold, `${seed} S${move.week}: ${move.label} è uscita con ${ev.share}% sopra la soglia ${ev.threshold}%.`);
          assert.ok(ev.weeksBelow >= ev.weeksRequired, `${seed} S${move.week}: ${move.label} è uscita dopo ${ev.weeksBelow} settimane sotto soglia (ne servono ${ev.weeksRequired}).`);
          assert.ok(ev.weeksIn >= ev.minWeeks, `${seed} S${move.week}: ${move.label} è uscita dopo ${ev.weeksIn} settimane nello stato (minimo ${ev.minWeeks}).`);
        } else assert.equal(ev.rule, 'osservazione', `${seed}: regola di uscita nota (${ev.rule}).`);
        assert.equal(ev.cooldownUntil, ev.week + (ev.from === PRESENCE.EMERGING ? PRESENCE_RULES.fade.cooldown : PRESENCE_RULES.exit.cooldown), `${seed} S${move.week}: il cooldown di ${move.label} è quello delle regole.`);
        assert.ok(evidenceLine(ev).includes('simulato') && /pubblicato/.test(evidenceLine(ev)), 'La motivazione distingue il consenso simulato dal dato pubblicato.');
        exitedAt.set(move.id, ev);
        record.exits.push({ seed, week: move.week, label: move.label, ev });
        sample ??= ev;
      } else if (exitedAt.has(move.id) && move.from === PRESENCE.NONE) {
        const before = exitedAt.get(move.id);
        assert.ok(move.week >= before.cooldownUntil, `${seed} S${move.week}: ${move.label} è rientrata alla settimana ${move.week}, prima della fine del cooldown (${before.cooldownUntil}).`);
        record.returns.push({ seed, week: move.week, label: move.label });
        exitedAt.delete(move.id);
      }
    }
    // the history of the polls: every poll lists the forces it measured, and a force that left is in no later poll
    const polls = state.polls ?? [];
    const last = polls.at(-1);
    for (const party of state.parties.filter(item => !item.active)) assert.ok(!(last?.results ?? []).some(row => row.partyId === party.id), `${seed}: ${party.label} è fusa e non compare nel sondaggio.`);
  }
  // exited forces are not in the latest poll, but they are in the older ones of the retained history while the history reaches them
  const state = store.getState().world;
  for (const party of state.parties.filter(item => item.active && item.presence?.status === PRESENCE.NONE && item.presence.exits > 0 && !item.isPlayer)) {
    assert.ok(!(state.polls.at(-1)?.results ?? []).some(row => row.partyId === party.id), `${seed}: ${party.label} è uscita e non ha una riga nel sondaggio.`);
  }
  console.error(`[${seed}] mosse viste: ${seenMoves}`);
}
lines.push(`${SEEDS.length} seed × ${WEEKS} settimane: ${record.exits.length} uscite, ${record.merges.length} fusioni, ${record.returns.length} rientri, tutte con regole e prove`);

// ---------- 3. a force that really collapses leaves, with its evidence, and comes back only after the cooldown ----------
{
  const run = await startCareer({ seed: 'soglia', level: 'comunale', fast: true });
  const { store, db, decide } = run;
  const parties = () => store.getState().world.parties;
  const weak = parties().find(item => item.active && !item.isPlayer && item.presence?.status === PRESENCE.SURVEYED && item.baseline >= 1);
  assert.ok(weak, 'Tra le forze rilevate ce n’è una da far crollare.');
  // the force loses its ground for good (level and anchor at 0,3%); the engine would otherwise drift back toward its own anchor
  weak.baseline = 0.3; weak.anchor = 0.3;
  let exitWeek = null;
  for (let step = 0; step < 52; step++) {
    playWeek({ store, db, decide });
    const world = store.getState().world;
    const wk = parties().find(item => item.id === weak.id);
    if (wk.presence.status === PRESENCE.NONE && exitWeek === null) exitWeek = world.week;
    wk.baseline = 0.3; wk.anchor = 0.3;
  }
  assert.ok(exitWeek !== null, 'La forza che crolla esce dai sondaggi (una dinamica legittima non viene cancellata).');
  const world = store.getState().world;
  const move = world.presenceMoves.find(item => item.id === weak.id && item.to === PRESENCE.NONE);
  assert.ok(move?.evidence && move.evidence.rule === 'soglia' && move.evidence.weeksIn >= PRESENCE_RULES.exit.minWeeks && move.evidence.weeksBelow >= PRESENCE_RULES.exit.weeks, 'Con le sue prove.');
  assert.equal(move.evidence.threshold, PRESENCE_RULES.exit.share, 'La soglia è quella delle regole, non cambiata.');
  // the panel shows the evidence
  const { presencePanel } = await import(new URL(`../src/ui/polls-mode.js${build ? `?v=${build}` : ''}`, import.meta.url).href);
  const html = presencePanel(world);
  assert.ok(html.includes('presence-why') && html.includes('Consenso simulato') && (html.includes('Ultimo sondaggio pubblicato') || html.includes('Nessun dato pubblicato')), 'Il pannello mostra la motivazione con le soglie, le settimane e il dato pubblicato.');
  // it comes back only after the cooldown
  const cooldown = move.evidence.cooldownUntil;
  const back = parties().find(item => item.id === weak.id);
  back.baseline = 1.8; back.anchor = 1.8; back.visibility = 80;
  let returnedWeek = null;
  for (let step = 0; step < 60 && returnedWeek === null; step++) {
    playWeek({ store, db, decide });
    const again = store.getState().world.parties.find(item => item.id === weak.id);
    again.baseline = 1.8; again.anchor = 1.8; again.visibility = 80;
    if (again.presence.status !== PRESENCE.NONE) returnedWeek = store.getState().world.week;
  }
  assert.ok(returnedWeek !== null, 'Dopo il cooldown la forza rientra (emergente), se il consenso c’è.');
  assert.ok(returnedWeek >= cooldown, `Rientro alla settimana ${returnedWeek}, non prima della fine del cooldown (${cooldown}).`);
  lines.push(`forza in crollo uscita alla settimana ${exitWeek} con prove, rientro alla settimana ${returnedWeek} dopo il cooldown (${cooldown})`);
}

console.log(`Uscite dai sondaggi: ${lines.join('; ')}.`);
