// Repetition of the weekly activity scenes in REAL careers: thirty weeks, several deterministic seeds, the player doing an activity every week (one that has an animated scene, in turn). For every kind of scene
// the topics (families) must not come back one after the other, must be many and spread, the sequences of moves must differ, and the outcomes must not be always the same.
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';
const { WEEKLY_ACTIVITIES } = await import('../src/data/simulation/career-rules.js');
const SEEDS = ['rip-a', 'rip-b', 'rip-c', 'rip-d'];
const WEEKS = 30;
const total = { scenes: 0, immediate: 0 }; const byKey = {};
for (const seed of SEEDS) {
  const { store } = await startCareer({ seed, level: 'comunale', fast: true });
  const pool = WEEKLY_ACTIVITIES.map(item => item.id);
  const tried = new Map();
  for (let week = 0; week < WEEKS; week++) {
    // the activities are taken in turn, starting from a different one for each seed: the first one the game allows this week
    const order = [...pool.slice((week * 7 + SEEDS.indexOf(seed) * 5) % pool.length), ...pool.slice(0, (week * 7 + SEEDS.indexOf(seed) * 5) % pool.length)];
    for (const id of order) { try { await store.startActivityScene(id, { quick: true }); break; } catch { /* not this week */ } }
    try { store.advanceTurn(1, { delegate: true }); } catch { /* the week closes */ }
  }
  const log = store.getState().game.flags?.sceneLog ?? [];
  const lastOfKey = new Map();
  for (const entry of [...log].sort((a, b) => a.week - b.week)) {
    total.scenes++;
    const bucket = byKey[entry.key] ??= { count: 0, families: new Map(), picks: new Set(), kinds: new Set(), immediate: 0 };
    bucket.count++; bucket.families.set(entry.family, (bucket.families.get(entry.family) ?? 0) + 1); bucket.picks.add((entry.picks ?? []).join('>')); bucket.kinds.add(entry.kind);
    if (lastOfKey.get(entry.key) === entry.family) { bucket.immediate++; total.immediate++; }
    lastOfKey.set(entry.key, entry.family);
  }
}
const lines = [];
for (const [key, b] of Object.entries(byKey)) {
  const shares = [...b.families.values()].map(n => n / b.count);
  lines.push(`${key}: ${b.count} scene, ${b.families.size} temi, ${b.picks.size} sequenze di mosse, ${b.kinds.size} esiti, ${b.immediate} temi ripetuti di seguito, tema più frequente ${Math.round(Math.max(...shares) * 100)}%`);
  if (b.count < 8) continue;
  assert.ok(b.families.size >= Math.min(6, Math.floor(b.count / 2)), `${key}: i temi sono vari (${b.families.size} su ${b.count} scene)`);
  assert.ok(b.immediate <= Math.max(1, Math.round(b.count * 0.12)), `${key}: lo stesso tema non torna di seguito (${b.immediate} ripetizioni su ${b.count})`);
  assert.ok(Math.max(...shares) <= 0.35, `${key}: nessun tema domina (${Math.round(Math.max(...shares) * 100)}%)`);
  assert.ok(b.picks.size >= Math.min(8, Math.floor(b.count * 0.5)), `${key}: le sequenze di mosse sono diverse (${b.picks.size} su ${b.count})`);
  assert.ok(b.kinds.size >= 2, `${key}: gli esiti non sono sempre gli stessi (${b.kinds.size})`);
}
assert.ok(total.scenes >= SEEDS.length * 12, `Nelle trenta settimane si giocano molte scene (${total.scenes}).`);
console.log(`Ripetitività verificata su ${SEEDS.length} carriere di ${WEEKS} settimane (${total.scenes} scene): ${lines.join(' | ')}`);
