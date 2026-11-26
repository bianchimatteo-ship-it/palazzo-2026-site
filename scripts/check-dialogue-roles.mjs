// The line «who you are» before the first question of an activity scene (data/activity-scene-threads.js ROLE) on REAL careers, by the office the player really holds:
//   · a national parliamentarian of the MAJORITY with no office in the government → «maggioranza» (a seat and a vote, not the power to decide);
//   · a national parliamentarian of the OPPOSITION → «opposizione» (the case that was left out: it used to get no presentation at all);
//   · a councillor of the opposition, a mayor/assessor, a minister (technical or not), a former parliamentarian, a plain member with no office → each its own line, never a power or a seat the player does not hold.
// Several groups (so that both sides of the chamber are met), activities and seeds; the answers of the whole conversation are played and the line is read at the first question.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}?v=${build}`, import.meta.url).href);
const A = await load('src/core/activity-scenes.js'), T = await load('src/data/activity-scene-threads.js');
const problems = [], seen = new Map();
const want = (ok, text) => { if (!ok) problems.push(text); };
// the three words that would be wrong: «maggioranza» to someone who does not sit in it, «governa» to someone who does not, «seggio» to someone with none
const KEYS = Object.keys(T.ROLE);
const keyOfLine = line => KEYS.find(key => T.ROLE[key].some(pair => pair[0] === line)) ?? null;
// the ROLE lines of governing never speak of «the majority»: a technical minister does not sit in it
for (const pair of T.ROLE.governo) want(!/maggioranza/i.test(pair[0]), `Riga di chi governa che parla di maggioranza: «${pair[0]}».`);
for (const pair of T.ROLE.nessuno) want(!/\b(governa|maggioranza|opposizione)\b/i.test(pair[0].replace(/chi governa|di governo/g, '')) , `Riga di chi non ha incarichi che attribuisce una parte: «${pair[0]}».`);
async function firstQuestion(store, activityId, pick) {
  await store.startActivityScene(activityId, { quick: false });
  let line = null, flags = null;
  for (let step = 0; step < 12; step++) {
    const scene = store.getState().scene; if (!scene) break;
    flags = scene.flags; const node = { ...A.activityNode(scene), id: scene.nodeId };
    if (node.id === 'q1') { line = (node.preface ?? []).map(keyOfLine).find(Boolean) ?? null; break; }
    const open = (node.choices ?? []).filter(choice => !choice[2]); if (!open.length || node.final) break;
    store.sceneChoose(open[pick % open.length][0]);
  }
  try { store.sceneAbandon(); } catch { /* closed */ }
  return { key: line, flags };
}
const expected = flags => flags.govern ? 'governo' : flags.opp || flags.oppNational ? 'opposizione' : flags.majority ? 'maggioranza' : flags.seat === false ? 'nessuno' : null;
async function visit(label, run, activities = ['cittadini', 'ascolto', 'associazioni', 'dossier', 'riunione']) {
  for (const [index, id] of activities.entries()) {
    let out; try { out = await firstQuestion(run.store, id, index); } catch (error) { if (/scena|già|settimana|requisit|serve|giorni|Non/i.test(error.message)) continue; throw error; }
    if (!out.flags) continue;
    const want_ = expected(out.flags), role = out.key;
    want(role === want_, `${label}/${id}: la riga sul ruolo è «${role}», attesa «${want_}» (flag ${JSON.stringify({ govern: out.flags.govern, opp: out.flags.opp, majority: out.flags.majority, oppNational: out.flags.oppNational, seat: out.flags.seat })}).`);
    seen.set(want_ ?? 'nessuna riga', (seen.get(want_ ?? 'nessuna riga') ?? 0) + 1);
  }
}
// national parliamentarians: many groups of the Camera and of the Senate, so that the majority and the opposition both appear
const first = await startCareer({ seed: 'ruoli-0', level: 'deputato', fast: true });
const chamberGroups = first.db.parliamentaryGroups.filter(group => /^cam-/.test(group.id)).slice(0, 9), senateGroups = first.db.parliamentaryGroups.filter(group => /^senato-/.test(group.id)).slice(0, 5);
for (const [level, groups] of [['deputato', chamberGroups], ['senatore', senateGroups]]) for (const group of groups) {
  const run = await startCareer({ seed: `ruoli-${group.id}`, level, draft: { parliamentaryGroupId: group.id }, fast: true });
  await visit(`${level}/${group.id}`, run);
}
assert.ok(seen.get('maggioranza') && seen.get('opposizione'), `Sono stati incontrati sia un parlamentare di maggioranza sia uno di opposizione (visti: ${JSON.stringify([...seen])}).`);
// a plain member, a councillor, a regional councillor, a MEP
for (const [label, level, draft] of [['iscritto', 'comunale', { startingOffice: 'iscritto' }], ['consigliere', 'comunale', {}], ['regionale', 'regionale', {}], ['europeo', 'europeo', {}]]) await visit(label, await startCareer({ seed: `ruoli-${label}`, level, draft, fast: true }));
// a former parliamentarian: after the resignation of the seat the line is the one of who holds no office
{
  const run = await startCareer({ seed: 'ruoli-ex', level: 'deputato', fast: true });
  for (let i = 0; i < 6; i++) { const post = run.store.resignationPosts().find(item => !item.blocked); if (!post) break; try { run.store.resign(post.id); } catch { break; } }
  const left = run.store.resignationPosts().filter(item => !item.blocked).length;
  await visit('ex-parlamentare', run);
  if (!left) want(seen.get('nessuno') >= 1, 'Dopo le dimissioni da ogni incarico la riga è quella di chi non ha incarichi.');
}
assert.ok([...seen.values()].reduce((sum, n) => sum + n, 0) >= 30, `Conversazioni lette: ${[...seen.values()].reduce((sum, n) => sum + n, 0)}.`);
assert.deepEqual(problems.slice(0, 12), [], `Ruoli nelle presentazioni:\n${problems.slice(0, 12).join('\n')}`);
console.log(`Presentazioni per ruolo verificate su carriere vere (${[...seen].map(([key, n]) => `${key}: ${n}`).join(', ')}): maggioranza e opposizione nazionale, consigliere, europarlamentare, iscritto, ex parlamentare; nessuna riga di governo parla di maggioranza.`);
