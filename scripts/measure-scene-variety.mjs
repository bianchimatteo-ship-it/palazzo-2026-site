// Variety of the animated scenes, activity by activity: thirty weeks, three deterministic seeds, the scene of every activity made as the game makes it (the families met lately are remembered). It measures,
// for each activity, how many different casts (the roles and the names of the two guests), openings, dialogues (the first two questions), reactions and gesture sequences come out, and how often the most common one
// comes back. Pure: it builds the scenes with the engine of the game, no browser. node scripts/measure-scene-variety.mjs [--json] ; imported by check-activity-variety.mjs.
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const S = await import(new URL(`../src/core/activity-scenes.js?v=${build}`, import.meta.url).href);
const { WEEKLY_ACTIVITIES } = await import(new URL(`../src/data/simulation/career-rules.js?v=${build}`, import.meta.url).href);
export const SEEDS = ['var-a', 'var-b', 'var-c'];
export const WEEKS = 30;
const player = { name: 'Prova Verifica', tag: 'Deputato' };
export function measure() {
  const ids = WEEKLY_ACTIVITIES.map(item => item.id).filter(id => S.activityHasScene(id));
  const rows = {};
  for (const activityId of ids) {
    const sceneKey = S.sceneKeyOf(activityId);
    const bucket = rows[activityId] = { sceneKey, scenes: 0, casts: [], openings: [], dialogues: [], reactions: [], gestures: [], names: new Set(), families: [] };
    for (const seed of SEEDS) {
      const recent = [];
      for (let week = 0; week < WEEKS; week++) {
        const scene = S.createActivityScene({ id: `${seed}-${week}-${activityId}`, seed: `${seed}|${week}|${activityId}`, sceneKey, activityId, player, playerAvatar: null, stats: { competence: 55, charisma: 55, reputation: 55 }, recent: [...recent], refs: {}, pool: ['Partito A', 'Partito B', 'Partito C'], party: { label: 'Il mio partito' } });
        recent.push(scene.familyId);
        const cast = scene.cast.filter(item => item.role === 'ospite');
        bucket.scenes++; bucket.families.push(scene.familyId);
        bucket.casts.push([...cast, ...(scene.extras ?? [])].map(item => item.roleLabel).join(' + '));
        [...cast, ...(scene.extras ?? [])].forEach(item => bucket.names.add(item.name));
        const gestures = []; const lines = []; const reacts = [];
        let node = S.activityNode(scene);
        bucket.openings.push(`${node.text} | ${(node.lines ?? []).join(' ')}`);
        for (let step = 0; step < 14 && node.id !== 'esito'; step++) {
          gestures.push(`${node.id}:${node.gesture ?? ''}:${node.expression ?? ''}`);
          if (node.id === 'q1' || node.id === 'q2') lines.push(`${(node.preface ?? []).join(' ')} ${node.text}`);
          if (/^r\d$/.test(node.id)) reacts.push(node.preface?.join?.('|') ?? node.said ?? '');
          const open = (node.choices ?? []).filter(choice => !choice[2]);
          const pick = open.length ? open[(week + step + SEEDS.indexOf(seed)) % open.length] : null;
          if (!pick) break;
          S.activityChoose(scene, pick[0]); node = S.activityNode(scene);
        }
        bucket.dialogues.push(lines.join(' // ')); bucket.reactions.push(reacts.join(' // ')); bucket.gestures.push(gestures.join(' '));
      }
    }
  }
  const stat = list => { const counts = new Map(); for (const item of list) counts.set(item, (counts.get(item) ?? 0) + 1); return { distinct: counts.size, top: Math.round(Math.max(...counts.values()) / list.length * 100) }; };
  return Object.fromEntries(Object.entries(rows).map(([id, b]) => [id, { sceneKey: b.sceneKey, scenes: b.scenes, casts: stat(b.casts), names: b.names.size, openings: stat(b.openings), dialogues: stat(b.dialogues), reactions: stat(b.reactions), gestures: stat(b.gestures), families: stat(b.families) }]));
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = measure();
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 1));
  else {
    console.log('attività'.padEnd(26), 'scena'.padEnd(12), 'cast(n/top%)', 'nomi', 'aperture', 'dialoghi', 'reazioni', 'gesti', 'temi');
    for (const [id, r] of Object.entries(result)) console.log(id.padEnd(26), r.sceneKey.padEnd(12), `${r.casts.distinct}/${r.casts.top}`.padEnd(12), String(r.names).padEnd(4), `${r.openings.distinct}/${r.openings.top}`.padEnd(8), `${r.dialogues.distinct}/${r.dialogues.top}`.padEnd(8), `${r.reactions.distinct}/${r.reactions.top}`.padEnd(8), `${r.gestures.distinct}/${r.gestures.top}`.padEnd(8), `${r.families.distinct}/${r.families.top}`);
  }
}
