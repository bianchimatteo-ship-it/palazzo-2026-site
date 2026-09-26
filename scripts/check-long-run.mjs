// Long runs on the real engine: careers of 5, 10, 20 and 30 years with different seeds and starting levels (each in its
// own process, several at a time), then the same seed twice. At every checkpoint the central invariants
// (src/core/invariants.js, checked every quarter along the way) must hold, and the game must still be alive:
// elections ahead and held, Governments in office, budgets and polls in range, laws decided, events happening, no
// frozen weeks, no Math.random; the state stays small enough for the browser's storage. Same seed + same decisions =
// same game (identical fingerprint); another seed = another game.
// LONG_RUN_YEARS=5 limits the horizon (quick runs while developing); the default is the full 30 years.
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';

const worker = fileURLToPath(new URL('./lib/long-run.mjs', import.meta.url));
const horizon = Math.min(30, Number(process.env.LONG_RUN_YEARS) || 30);
const checkpoints = [5, 10, 20, 30].filter(year => year <= horizon);
const runs = [
  { seed: 'alfa', level: 'deputato' },
  { seed: 'beta', level: 'comunale' },
  { seed: 'gamma', level: 'senatore' },
  { seed: 'delta', level: 'regionale' },
  // The same seed twice (and one more seed) over five years: determinism and variety.
  { seed: 'eco', level: 'deputato', years: 5, checkpoints: [5], twin: 1 },
  { seed: 'eco', level: 'deputato', years: 5, checkpoints: [5], twin: 2 },
  { seed: 'foxtrot', level: 'deputato', years: 5, checkpoints: [5] }
].map(run => ({ years: horizon, checkpoints, ...run }));

const execute = options => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [worker, JSON.stringify(options)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stdout.on('data', chunk => { out += chunk; });
  child.stderr.on('data', chunk => { err += chunk; });
  child.on('error', reject);
  child.on('close', code => {
    const lines = out.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    if (code !== 0 || !lines.some(line => line.type === 'done')) reject(new Error(`Carriera ${options.seed}/${options.level} interrotta (codice ${code}): ${err.split('\n').filter(Boolean).slice(-6).join(' | ')}`));
    else resolve({ options, checkpoints: lines.filter(line => line.type === 'checkpoint') });
  });
});
// A few careers at a time (one per core).
async function pool(items, limit) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (next < items.length) { const index = next++; results[index] = await execute(items[index]); } }));
  return results;
}

const started = Date.now();
const results = await pool(runs, Math.max(1, Math.min(4, availableParallelism())));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const lines = [];
for (const { options, checkpoints: reports } of results) {
  check(reports.length === options.checkpoints.length, `${options.seed}: ${reports.length} tappe su ${options.checkpoints.length}`);
  let previous = null;
  for (const report of reports) {
    const { health, activity } = report;
    const label = `${options.seed}/${options.level} a ${report.years} anni`;
    // 1. Invariants: no NaN, duplicate ids, broken references, impossible numbers, votes and seats that do not add up.
    check(report.issueCount === 0, `${label}: ${report.issueCount} violazioni delle invarianti — ${report.issues.slice(0, 6).map(issue => `[${issue.code}] ${issue.message} (settimana ${issue.week}, ×${issue.count})`).join('; ')}`);
    check(report.mathRandom === 0, `${label}: ${report.mathRandom} chiamate a Math.random (la partita non dipende solo dal seed)`);
    // 2. Time and elections: the weeks advance, votes keep being held and the next ones are in the calendar.
    check(health.status === 'active', `${label}: carriera non attiva (${health.status})`);
    // The week counter follows the calendar (campaign days included).
    const weeksByDate = Math.floor((Date.parse(health.date) - Date.parse(health.startedAt)) / (7 * 86400000)) + 1;
    check(Math.abs(health.week - weeksByDate) <= 2, `${label}: settimana ${health.week} ma il calendario è alla ${weeksByDate}`);
    check(health.week >= Math.round(report.years * 52.18) - 2, `${label}: settimana ${health.week}, meno di ${report.years} anni di gioco`);
    check(health.elections >= Math.floor(report.years * 0.6), `${label}: solo ${health.elections} elezioni svolte`);
    for (const type of ['politiche', 'europee']) check(health.upcoming.some(item => item.startsWith(`${type}:`)), `${label}: nessuna elezione ${type} in calendario`);
    check(health.legislature >= 19 + Math.floor(report.years / 5.5), `${label}: legislatura ${health.legislature} (le politiche non si rinnovano)`);
    // 3. Government, budgets, parties and polls stay coherent.
    // A Government in office or being formed; a crisis never lasts forever.
    check(['active', 'crisis', 'caretaker', 'awaiting-confidence'].includes(health.government) || (health.government === 'fallen' && !['completata', null].includes(health.formation)), `${label}: governo ${health.government} (formazione: ${health.formation})`);
    check(activity.longestWithoutGovernment <= 26, `${label}: ${activity.longestWithoutGovernment} settimane di fila senza governo in carica`);
    check(Number.isFinite(health.debt) && health.debt > 40 && health.debt < 250, `${label}: debito pubblico ${health.debt}% del PIL`);
    check(Number.isFinite(health.deficit) && health.deficit > -8 && health.deficit < 15, `${label}: deficit ${health.deficit}%`);
    check(health.parties >= 6 && health.parties <= 45, `${label}: ${health.parties} forze nel mondo politico`);
    check(health.pollDate && health.pollDate >= new Date(Date.parse(health.date) - 21 * 86400000).toISOString().slice(0, 10), `${label}: ultimo sondaggio del ${health.pollDate} (oggi ${health.date})`);
    // 4. Laws and events keep working; the state stays within what the browser can store.
    check(health.size < 3_500_000, `${label}: stato di ${Math.round(health.size / 1024)} KB (troppo per il salvataggio nel browser)`);
    if (previous) {
      check(activity.lawsClosed > previous.activity.lawsClosed, `${label}: nessuna legge conclusa dopo i ${previous.years} anni`);
      check(activity.worldEvents > previous.activity.worldEvents, `${label}: nessun nuovo evento dopo i ${previous.years} anni`);
      check(activity.polls > previous.activity.polls, `${label}: nessun nuovo sondaggio dopo i ${previous.years} anni`);
      check(health.elections > previous.health.elections, `${label}: nessuna elezione dopo i ${previous.years} anni`);
    } else check(activity.lawsClosed > 20 && activity.worldEvents > 20 && activity.governments >= 1, `${label}: attività scarsa (${activity.lawsClosed} leggi concluse, ${activity.worldEvents} eventi, ${activity.governments} governi)`);
    // Over ten years at least two legislatures: Governments change.
    if (report.years >= 10) check(activity.governments >= 2, `${label}: un solo governo in ${report.years} anni`);
    previous = report;
    lines.push(`${label}: ${health.elections} elezioni, legislatura ${health.legislature}, ${activity.governments} governi, ${activity.lawsClosed} leggi concluse, ${activity.worldEvents} eventi, debito ${health.debt}%, ${Math.round(health.size / 1024)} KB (${Math.round(report.ms / 1000)} s)`);
  }
}
// 5. Determinism: same seed and same decisions give the same game; another seed another game.
const final = seed => results.filter(item => item.options.seed === seed).map(item => item.checkpoints.at(-1)?.fingerprint);
const [first, second] = final('eco');
check(first && first === second, `Stesso seed, stesse decisioni: partite diverse (${first?.slice(0, 12)} ≠ ${second?.slice(0, 12)})`);
check(final('foxtrot')[0] !== first, 'Seed diversi producono la stessa partita.');

if (failures.length) {
  console.error(`Long run: ${failures.length} problemi.\n- ${failures.join('\n- ')}\n\n${lines.join('\n')}`);
  process.exit(1);
}
console.log(`Long run verificato sul motore reale (${runs.length} carriere, ${Math.round((Date.now() - started) / 1000)} s): ${checkpoints.map(year => `${year}`).join(', ')} anni con 4 seed e livelli diversi (deputato, consigliere comunale, senatore, consigliere regionale) — invarianti sempre rispettate (controllate ogni trimestre), nessun Math.random, elezioni sempre in calendario e svolte, legislature rinnovate, governi, debito, deficit, partiti e sondaggi coerenti, leggi ed eventi sempre attivi, stato salvabile; stesso seed + stesse decisioni = stessa partita, seed diverso = partita diversa.\n  ${lines.join('\n  ')}`);
