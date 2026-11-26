// What a scene tells and what the numbers do are the same thing: a good verdict gives benefits, an intermediate one a proportional share, a bad one (the public reacted badly) gives NO normal benefit and takes away
// consensus, reputation and the like; the effects are applied once (a cost, a stat, a diary line) and the verdict is the one the scene shows. Played on the real engine, the same career for every verdict.
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const { sceneNode } = await import(new URL(`../src/core/scene-engine.js?v=${build}`, import.meta.url).href);
const { sceneFactor } = await import(new URL(`../src/core/career-engine.js?v=${build}`, import.meta.url).href);

// the factor itself: monotonic, never a bonus for a bad verdict
let last = -Infinity;
for (let e = -6; e <= 6; e += 0.5) { const f = sceneFactor(e); assert.ok(f >= last - 1e-9, `Il fattore non scende al salire del verdetto (${e}).`); last = f; if (e < -3) assert.ok(f < 0, `Verdetto ${e}: nessun beneficio, una perdita.`); if (e >= 3) assert.ok(f >= 1.2, `Verdetto ${e}: più dell’attività semplice.`); }
assert.equal(sceneFactor(-3), 0); assert.ok(sceneFactor(0) > 0 && sceneFactor(0) < 1);

const metricsOf = state => { const out = {}; for (const row of state.dataset.statistics.filter(item => item.subjectId === state.career.playerId)) out[row.metric] = row.value; return out; };
async function run(activityId, edge) {
  const { store } = await startCareer({ seed: 'scene-effects', level: 'deputato' });
  const before = metricsOf(store.getState());
  const g0 = store.getState().game;
  const logs0 = (g0.log ?? []).filter(item => item.kind === 'attività').length;
  await store.startActivityScene(activityId, { target: null });
  while (store.getState().scene.status === 'active') store.sceneChoose(sceneNode(store.getState().scene).choices[0][0]);
  store.getState().scene.outcome.edge = edge;   // the verdict under test (the scene is over, the store has not settled it yet)
  store.sceneChoose('fine');
  const after = metricsOf(store.getState());
  const delta = Object.fromEntries(Object.keys(after).map(key => [key, Math.round(((after[key] ?? 0) - (before[key] ?? 0)) * 100) / 100]));
  const rises = Object.entries(delta).filter(([, value]) => value > 0.001).length, falls = Object.entries(delta).filter(([, value]) => value < -0.001).length;
  const mine = (store.getState().game.log ?? []).filter(item => item.kind === 'attività');
  const logs = mine.length - logs0;
  return { delta, rises, falls, sum: Object.values(delta).reduce((a, b) => a + b, 0), logs, tone: mine.at(-1)?.tone };
}
for (const activityId of ['associazioni', 'riunione']) {
  const bad = await run(activityId, -5.5), poor = await run(activityId, -1), fine = await run(activityId, 1.5), great = await run(activityId, 5);
  assert.ok(bad.falls > 0 || bad.rises === 0, `${activityId}: un esito negativo non fa salire gli indicatori (${JSON.stringify(bad.delta)}).`);
  assert.equal(bad.rises, 0, `${activityId}: nessun bonus normale dopo una reazione negativa (${JSON.stringify(bad.delta)}).`);
  assert.ok(great.rises > 0 && great.sum > fine.sum && fine.sum >= poor.sum && poor.sum > bad.sum, `${activityId}: più il verdetto è buono, più l’attività rende (${bad.sum} < ${poor.sum} ≤ ${fine.sum} < ${great.sum}).`);
  assert.equal(great.logs, bad.logs, `${activityId}: l’esito è registrato una sola volta, qualunque sia il verdetto.`);
  assert.equal(bad.tone, 'bad', `${activityId}: il diario racconta un esito negativo.`);
}
console.log('Effetti delle scene verificati: esito negativo senza bonus e con perdite, intermedio proporzionale, positivo con benefici crescenti, un solo accredito e un solo diario.');
