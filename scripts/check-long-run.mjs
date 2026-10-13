// Long runs on the real engine: careers of 5, 10, 20 and 30 years with different seeds and starting levels (each in its
// own process, several at a time), then the same seed twice. At every checkpoint the central invariants
// (src/core/invariants.js, checked every quarter along the way) must hold, and the game must still be alive:
// elections ahead and held, Governments in office, budgets and polls in range, laws decided, events happening, no
// frozen weeks, no Math.random; the state stays small enough for the browser's storage. Same seed + same decisions =
// same game (identical fingerprint); another seed = another game.
// The levels (--tier): `short` (2 years, the quick frequent one), `medium` (10 years) and `full` (30 years, the default: what `npm run check:long-run` has always been). Every tier has
// the same assertions below; only the horizon and the checkpoints change. LONG_RUN_YEARS=5 still limits the horizon (it wins over the tier).
//   --fast: the workers do not write the career save to the browser storage (the simulated state is the same, see scripts/lib/long-run.mjs and check-harness.mjs); on by default for
//     short and medium, off for full (`--fast` or `--no-fast` decide). The save and the reload of a game are checked on their own (check-saves, check-local, check-harness), and at every
//     checkpoint the save is exported and imported again in another process and the result is one more assertion here.
//   --out=<dir>: where every checkpoint is written as soon as it is reached (default: a folder of the temporary directory named after the tier);
//   --resume: take up an interrupted run from the checkpoints and the state files found in that folder (the states are kept for medium and full).
// The check says at the start and at the end which level, mode and careers it really ran.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Diagnostics, never a weaker check: every worker reports its progress (a line every quarter of game time, shown here with the time); a worker that reports nothing for
// LONG_RUN_STALL_MIN minutes (default 30) is stopped and named as stalled, and the whole run stops after LONG_RUN_TIMEOUT_MIN minutes (default 360) with where each career got to.
// LONG_RUN_JOBS limits the careers run at the same time (default: one per core, at most 4).
const worker = fileURLToPath(new URL('./lib/long-run.mjs', import.meta.url));
const STALL_MS = (Number(process.env.LONG_RUN_STALL_MIN) || 30) * 60000;
const LIMIT_MS = (Number(process.env.LONG_RUN_TIMEOUT_MIN) || 360) * 60000;
const progress = new Map();
const minutes = ms => `${Math.round(ms / 60000)} min`;
const argValue = name => process.argv.find(item => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const tier = argValue('tier') ?? 'full';
const TIERS = { short: { years: 2, checkpoints: [2], twinYears: 2, twinCheckpoints: [2] }, medium: { years: 10, checkpoints: [5, 10], twinYears: 5, twinCheckpoints: [5] }, full: { years: 30, checkpoints: [5, 10, 20, 30], twinYears: 5, twinCheckpoints: [5] } };
if (!TIERS[tier]) { console.error(`Livello sconosciuto: ${tier} (short, medium o full).`); process.exit(1); }
const fast = process.argv.includes('--fast') ? true : process.argv.includes('--no-fast') ? false : tier !== 'full';
const outDir = argValue('out') ?? join(tmpdir(), 'politicando-long-run', `${tier}-${fast ? 'fast' : 'normal'}`);
const resume = process.argv.includes('--resume');
const horizon = Math.min(TIERS[tier].years, Number(process.env.LONG_RUN_YEARS) || TIERS[tier].years);
const checkpoints = TIERS[tier].checkpoints.filter(year => year <= horizon);
// The twins keep their own horizon (as before, whatever LONG_RUN_YEARS says): the determinism check needs them.
const twin = { years: TIERS[tier].twinYears, checkpoints: TIERS[tier].twinCheckpoints };
const runs = [
  { seed: 'alfa', level: 'deputato' },
  { seed: 'beta', level: 'comunale' },
  { seed: 'gamma', level: 'senatore' },
  { seed: 'delta', level: 'regionale' },
  // The same seed twice (and one more seed) over five years: determinism and variety.
  { seed: 'eco', level: 'deputato', ...twin, twin: 1 },
  { seed: 'eco', level: 'deputato', ...twin, twin: 2 },
  { seed: 'foxtrot', level: 'deputato', ...twin }
].map(run => ({ years: horizon, checkpoints, ...run, fast, outDir, roundtrip: true, saveStates: tier !== 'short' || resume }));
console.error(`[long-run] livello ${tier}: ${horizon} anni, ${runs.length} carriere (${runs.map(run => `${run.seed}/${run.level}${run.twin ? `#${run.twin}` : ''} ${run.years}a`).join(', ')}); modalità ${fast ? 'veloce (salvataggio del browser non scritto)' : 'normale'}; export/import del salvataggio a ogni tappa; checkpoint in ${outDir}${resume ? '; ripresa attiva' : ''}.`);

// The checkpoints already on disk for a career (resume): the reports of the years reached and the latest state to start again from.
const checkpointPath = (options, years, kind) => join(outDir, `${options.seed}-${options.level}${options.twin ? `-t${options.twin}` : ''}-y${years}.${kind === 'state' ? 'state.json' : 'json'}`);
const readReport = (options, years) => { try { return JSON.parse(readFileSync(checkpointPath(options, years), 'utf8')); } catch { return null; } };
function reached(options) {
  const reports = [];
  for (const year of options.checkpoints) { const report = readReport(options, year); if (!report || report.seed !== options.seed || report.fast !== options.fast) break; reports.push(report); }
  const last = [...reports].reverse().find(report => existsSync(checkpointPath(options, report.years, 'state')));
  return { reports, last };
}

const execute = options => new Promise((resolve, reject) => {
  const key = `${options.seed}/${options.level}${options.twin ? `#${options.twin}` : ''}`;
  // Resume: a career whose checkpoints are all on disk is not run again; one that stopped on the way starts again from its last state, and keeps the reports it had.
  const earlier = resume ? reached(options) : { reports: [], last: null };
  if (resume && earlier.reports.length === options.checkpoints.length) { console.error(`[long-run] ${key}: già completa, ripresa dai file (${earlier.reports.length} tappe)`); resolve({ options, checkpoints: earlier.reports }); return; }
  const base = { ...options, ...(earlier.last ? { resumeFrom: checkpointPath(options, earlier.last.years, 'state') } : {}) };
  const kept = earlier.last ? earlier.reports.filter(report => report.years <= earlier.last.years) : [];
  if (earlier.last) console.error(`[long-run] ${key}: ripresa dalla tappa di ${earlier.last.years} anni`);
  const child = spawn(process.execPath, [worker, JSON.stringify(base)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '', pending = '', stalled = false, last = Date.now();
  progress.set(key, 'non ancora partita');
  const watchdog = setInterval(() => { if (Date.now() - last > STALL_MS) { stalled = true; child.kill('SIGTERM'); } }, 30000);
  child.stdout.on('data', chunk => {
    out += chunk; last = Date.now(); pending += chunk;
    const parts = pending.split('\n'); pending = parts.pop();
    for (const line of parts) { try { const item = JSON.parse(line); if (item.type === 'progress') { progress.set(key, `settimana ${item.week}/${item.weeks} (${item.date}) dopo ${minutes(item.ms)}`); console.error(`[long-run ${new Date().toISOString().slice(11, 19)}] ${key}: ${progress.get(key)}`); } } catch { /* a partial line */ } }
  });
  child.stderr.on('data', chunk => { err += chunk; last = Date.now(); });
  child.on('error', error => { clearInterval(watchdog); reject(error); });
  child.on('close', code => {
    clearInterval(watchdog);
    const lines = out.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    if (stalled) reject(new Error(`Carriera ${key} ferma: nessun avanzamento da ${minutes(STALL_MS)} (ultimo: ${progress.get(key)})`));
    else if (code !== 0 || !lines.some(line => line.type === 'done')) reject(new Error(`Carriera ${key} interrotta (codice ${code}, ultimo avanzamento: ${progress.get(key)}): ${err.split('\n').filter(Boolean).slice(-6).join(' | ')}`));
    else resolve({ options, checkpoints: [...kept, ...lines.filter(line => line.type === 'checkpoint')] });
  });
  execute.children.add(child);
  child.on('close', () => execute.children.delete(child));
});
execute.children = new Set();
process.on('exit', () => { for (const child of execute.children) child.kill('SIGTERM'); });
// A few careers at a time (one per core).
async function pool(items, limit) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (next < items.length) { const index = next++; results[index] = await execute(items[index]); } }));
  return results;
}

const started = Date.now();
const limit = setTimeout(() => {
  console.error(`Long run: limite di ${minutes(LIMIT_MS)} superato. Avanzamento:\n- ${[...progress].map(([key, value]) => `${key}: ${value}`).join('\n- ')}`);
  for (const child of execute.children) child.kill('SIGTERM');
  process.exit(2);
}, LIMIT_MS);
let results;
try { results = await pool(runs, Math.max(1, Math.min(Number(process.env.LONG_RUN_JOBS) || 4, availableParallelism()))); }
catch (error) { console.error(`Long run: ${error.message}\nAvanzamento:\n- ${[...progress].map(([key, value]) => `${key}: ${value}`).join('\n- ')}`); process.exit(1); }
clearTimeout(limit);
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
    // 1b. Added with the tiers (the assertions around it are the original ones): the save, exported and imported again in another process, is the state the run had and goes through the loader unchanged.
    check(report.roundtrip?.ok === true, `${label}: export/import del salvataggio non fedele (${report.roundtrip ? `fedele ${report.roundtrip.faithful}, idempotente ${report.roundtrip.idempotent}, differenze ${(report.roundtrip.unexpected ?? []).join(', ') || report.roundtrip.error || 'nessuna'}` : 'non eseguito'})`);
    check(report.storage?.fast === fast, `${label}: modalità ${report.storage?.fast ? 'veloce' : 'normale'} invece di ${fast ? 'veloce' : 'normale'}`);
    check(report.storage?.skipped.every(key => key.startsWith('palazzo-2026.career.v1') && !key.endsWith('.lock')), `${label}: scritture escluse oltre a quelle del salvataggio della carriera (${report.storage?.skipped.join(', ')})`);
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
console.log(`Long run (livello ${tier}, ${horizon} anni, modalità ${fast ? 'veloce' : 'normale'}, export/import a ogni tappa) verificato sul motore reale (${runs.length} carriere, ${Math.round((Date.now() - started) / 1000)} s): ${checkpoints.map(year => `${year}`).join(', ')} anni con 4 seed e livelli diversi (deputato, consigliere comunale, senatore, consigliere regionale) — invarianti sempre rispettate (controllate ogni trimestre), nessun Math.random, elezioni sempre in calendario e svolte, legislature rinnovate, governi, debito, deficit, partiti e sondaggi coerenti, leggi ed eventi sempre attivi, stato salvabile; stesso seed + stesse decisioni = stessa partita, seed diverso = partita diversa.\n  ${lines.join('\n  ')}`);
