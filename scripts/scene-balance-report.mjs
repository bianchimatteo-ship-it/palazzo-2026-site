// Statistical report on the encounters of the activity scenes: hundreds of generated scenes with different seeds, three levels of the player (low / medium / high stats), three ways of playing
// (random choices, always the first choice, the best choice of each moment found by trying all of them on a copy). Prints the share of favourable / middling / bad reactions of the moves and the
// kinds of final outcomes. Run: node scripts/scene-balance-report.mjs [scenesPerCell=60]. With --check it fails when a skilled, well-prepared player cannot reach a positive result or a careless
// one always does (the targets are written below).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const A = await import(new URL(`../src/core/activity-scenes.js?v=${build}`, import.meta.url).href);
const N = Number(process.argv.find(arg => /^\d+$/.test(arg))) || 60;
const CHECK = process.argv.includes('--check');
const rngOf = seed => { let a = [...seed].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const LEVELS = { basso: { competence: 30, charisma: 30, reputation: 30, popularity: 30, notoriety: 30, influence: 30, experience: 30 }, medio: { competence: 55, charisma: 55, reputation: 50, popularity: 50, notoriety: 50, influence: 50, experience: 50 }, alto: { competence: 78, charisma: 75, reputation: 70, popularity: 70, notoriety: 70, influence: 70, experience: 70 } };
const decisions = scene => { const node = A.activityNode(scene); return node.choices?.length > 1 || (node.choices?.length === 1 && !['continua', 'fine'].includes(node.choices[0][0]) && node.choices[0][0] !== 'avanti') ? node.choices : null; };
function play(sceneKey, seed, stats, mode) {
  const rand = rngOf(`${seed}|${mode}`);
  const scene = A.createActivityScene({ id: `b-${seed}`, seed, sceneKey, activityId: A.ACTIVITY_SCENES[sceneKey].activityIds[0], player: { name: 'Anna Verdi', tag: 'Prova' }, playerAvatar: null, stats, recent: [] });
  const bands = [];
  for (let guard = 0; guard < 40 && scene.nodeId !== 'esito'; guard++) {
    const node = A.activityNode(scene);
    const choices = node.choices ?? [];
    const free = choices.filter(item => !item[2]);
    const isMove = scene.nodeId === 'q1' || scene.nodeId === 'q2' || scene.nodeId === 'q3' || scene.nodeId === 'q4';
    let pick = free[0];
    if (isMove && free.length > 1) {
      if (mode === 'random') pick = free[Math.floor(rand() * free.length)];
      else if (mode === 'best') { let top = -1; for (const option of free) { const copy = structuredClone(scene); try { A.activityChoose(copy, option[0]); } catch { continue; } const score = copy.history.at(-1)?.score ?? 0; if (score > top) { top = score; pick = option; } } }
    }
    const before = scene.history.length;
    A.activityChoose(scene, pick[0]);
    if (scene.history.length > before) bands.push(scene.history.at(-1).band);
  }
  return { bands, outcome: scene.outcome?.band ?? null, kind: scene.outcome?.kind ?? null };
}
const pct = (n, d) => d ? Math.round(100 * n / d) : 0;
const table = {};
for (const [level, stats] of Object.entries(LEVELS)) for (const mode of ['random', 'primo', 'best']) {
  let good = 0, mid = 0, bad = 0, moves = 0; const outcomes = {}; let scenes = 0;
  for (const sceneKey of A.SCENE_KEYS) for (let i = 0; i < Math.max(2, Math.round(N / A.SCENE_KEYS.length)); i++) {
    const out = play(sceneKey, `${sceneKey}-${level}-${mode}-${i}`, stats, mode === 'primo' ? 'first' : mode);
    scenes++; for (const b of out.bands) { moves++; if (b === 'good') good++; else if (b === 'bad') bad++; else mid++; }
    outcomes[out.outcome ?? 'n/d'] = (outcomes[out.outcome ?? 'n/d'] ?? 0) + 1;
  }
  table[`${level}/${mode}`] = { scene: scenes, 'mosse favorevoli %': pct(good, moves), 'intermedie %': pct(mid, moves), 'negative %': pct(bad, moves), esiti: Object.entries(outcomes).map(([k, v]) => `${k} ${pct(v, scenes)}%`).join(' · ') };
}
console.table(table);
if (CHECK) {
  const best = table['alto/best'], low = table['basso/random'], mid = table['medio/random'];
  assert.ok(best['mosse favorevoli %'] >= 55, `Un giocatore competente e ben preparato ottiene reazioni favorevoli nella maggior parte delle mosse (${best['mosse favorevoli %']}%).`);
  assert.ok(mid['mosse favorevoli %'] >= 25 && mid['mosse favorevoli %'] <= 60, `Un giocatore medio che sceglie a caso ne ottiene una quota intermedia (${mid['mosse favorevoli %']}%).`);
  assert.ok(low['negative %'] >= low['mosse favorevoli %'], `Un giocatore impreparato che sceglie a caso resta penalizzato (${low['negative %']}% negative vs ${low['mosse favorevoli %']}% favorevoli).`);
  console.log('Bilanciamento delle scene nei limiti previsti.');
}
