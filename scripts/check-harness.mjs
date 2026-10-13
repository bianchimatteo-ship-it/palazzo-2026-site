// The harness of the long runs (scripts/lib/long-run.mjs and check-long-run.mjs), checked on its own so that what it says about the game can be trusted:
//  1. the fast mode (the career save is not written to the browser storage) belongs to the worker that asks for it: it drops only the keys of the career save, every other write
//     (the lock, the saved slots, the Hall of Fame, the settings) goes through, and the plain mode writes everything;
//  2. the fast mode does not change the simulated game: the same seed gives the same fingerprint with and without it;
//  3. every checkpoint is on disk as soon as it is reached (seed, career, year, fingerprint, invariants) and survives an interruption of the process;
//  4. the export/import of the save at a checkpoint is made by another process and does not touch the run (same fingerprint with and without it), it is not vacuous (a tampered
//     save is caught) and the loader changes nothing but what is declared (LOAD_ADDITIONS and the duplicate causes of the event queue);
//  5. resuming a career from the state file of a checkpoint gives the game the straight run gives (same state but for what the loader adds, same invariants, same activity);
//  6. the persistence of the game in the plain mode (the save written, read again by a new instance of the store) works, separately from the fast mode.
// The runs are short (half a year to one year of game time) and the workers run side by side. It says at the end which of them ran and how long each took.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const lib = await import('./lib/long-run.mjs');
const { CAREER_STORAGE_PREFIX, LOAD_ADDITIONS, environment, isCareerSaveKey, seeded, stateDiff } = lib;
const workerPath = fileURLToPath(new URL('./lib/long-run.mjs', import.meta.url));
const root = new URL('../', import.meta.url);
const started = Date.now();
const done = [];
const step = name => done.push(name);
const work = mkdtempSync(join(tmpdir(), 'politicando-harness-'));
const dir = name => join(work, name);

// ---------- 1. the fast mode drops the career save and nothing else ----------
{
  const fast = await environment('iso', { fast: true });
  const store = globalThis.localStorage;
  const career = [CAREER_STORAGE_PREFIX, `${CAREER_STORAGE_PREFIX}.backup`, `${CAREER_STORAGE_PREFIX}.history`];
  const others = [`${CAREER_STORAGE_PREFIX}.lock`, 'politicando.slot.1', 'politicando.hall.v1', 'politicando.settings.v1', 'politicando.onboarding.v1', 'qualunque-altra-chiave'];
  for (const key of [...career, ...others]) store.setItem(key, `v:${key}`);
  assert.ok(career.every(key => store.getItem(key) === null) && career.every(key => store.__skipped.has(key)), 'Fast: il salvataggio della carriera (principale, backup, storico) non viene scritto');
  assert.ok(others.every(key => store.getItem(key) === `v:${key}`) && store.__skipped.size === career.length, 'Fast: ogni altra scrittura passa (blocco, slot, Hall of Fame, impostazioni, qualunque chiave)');
  assert.ok(career.every(isCareerSaveKey) && !isCareerSaveKey(`${CAREER_STORAGE_PREFIX}.lock`) && !others.some(isCareerSaveKey), 'Le chiavi escluse sono esattamente quelle del salvataggio della carriera');
  assert.equal(fast.fast, true);
  // A later environment starts again from the plain one: the fast mode does not leak.
  await environment('iso2');
  const plain = globalThis.localStorage;
  for (const key of [...career, ...others]) plain.setItem(key, `v:${key}`);
  assert.ok([...career, ...others].every(key => plain.getItem(key) === `v:${key}`) && plain.__skipped.size === 0 && plain.__fast === false, 'Normale: tutte le scritture passano, e la modalità veloce di un ambiente precedente non si trascina');
  // The prefix is the one of the storage layer (that file is not touched): the keys derive from it and the other keys do not start with it.
  const storage = readFileSync(new URL('src/core/storage.js', root), 'utf8');
  assert.equal(storage.match(/const STORAGE_KEY = '([^']+)'/)?.[1], CAREER_STORAGE_PREFIX, 'Il prefisso escluso è quello di STORAGE_KEY in storage.js');
  for (const name of ['BACKUP_KEY', 'HISTORY_KEY']) assert.ok(new RegExp(`const ${name} = \`\\$\\{STORAGE_KEY\\}\\.`).test(storage), `${name} deriva da STORAGE_KEY`);
  assert.ok(/const LOCK_KEY = `\$\{STORAGE_KEY\}\.lock`/.test(storage), 'Il blocco deriva da STORAGE_KEY ed è escluso dall’esclusione');
  for (const [name, text] of [['HALL_KEY', storage.match(/const HALL_KEY = '([^']+)'/)?.[1]], ['SLOT_PREFIX', storage.match(/const SLOT_PREFIX = '([^']+)'/)?.[1]]]) assert.ok(text && !text.startsWith(CAREER_STORAGE_PREFIX), `${name} (${text}) non è disabilitata dalla modalità veloce`);
  // No other file of the game writes a key under that prefix by itself (a new one would be silently dropped in the fast mode).
  const files = (folder => { const out = []; const walk = path => { for (const entry of readdirSync(path)) { const full = join(path, entry); if (statSync(full).isDirectory()) walk(full); else if (full.endsWith('.js')) out.push(full); } }; walk(folder); return out; })(fileURLToPath(new URL('src/', root)));
  const users = files.filter(file => readFileSync(file, 'utf8').includes('palazzo-2026.career')).map(file => file.slice(fileURLToPath(root).length));
  assert.deepEqual(users, ['src/core/storage.js'], 'Solo storage.js scrive sotto il prefisso del salvataggio della carriera');
  step('isolamento della modalità veloce (chiavi, assenza di perdite tra ambienti, prefisso legato a storage.js)');
}

// ---------- the pieces: the generators and the comparison of states ----------
{
  const a = seeded('seme'), b = seeded('seme');
  const first = Array.from({ length: 5 }, () => a());
  const state = a.getState();
  const rest = Array.from({ length: 5 }, () => a());
  const c = seeded('seme');
  c.setState(state);
  assert.deepEqual(Array.from({ length: 5 }, () => c()), rest, 'Un generatore rimesso al suo stato continua con gli stessi numeri');
  assert.deepEqual(Array.from({ length: 5 }, () => b()), first, 'Lo stato esposto non cambia i numeri del generatore');
  const base = { a: 1, b: { c: [1, 2, 3], d: 'x' }, f: 27.2, ui: { x: 1 }, saveMeta: { careerId: 'k', revision: 3 }, t: '2027-01-01T10:00:00Z' };
  assert.deepEqual(stateDiff(base, { ...base, ui: { x: 2 }, saveMeta: { careerId: 'k', revision: 9 }, t: '2027-02-02T11:00:00Z' }), { changed: [], onlyA: [], onlyB: [] }, 'Interfaccia, contatore di salvataggio e orari non sono differenze');
  assert.deepEqual(stateDiff(base, { ...base, f: 27.200000000000003 }), { changed: [], onlyA: [], onlyB: [] }, 'Il rumore in virgola mobile non è una differenza');
  const diff = stateDiff(base, { ...base, a: 2, b: { c: [1, 2], d: 'x', e: 1 }, g: 0 });
  assert.deepEqual(diff, { changed: ['a'], onlyA: ['b.c.2'], onlyB: ['b.e', 'g'] }, 'Una modifica, un percorso mancante e uno aggiunto sono visti per quello che sono');
  assert.deepEqual([...LOAD_ADDITIONS].sort(), ['exportedAt', 'exportedBy', 'game.setbacks', 'races'], 'Le aggiunte del caricamento sono un elenco esplicito');
  step('generatori ripresi e confronto degli stati');
}

// ---------- the workers ----------
const worker = (options, { onLine = null } = {}) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [workerPath, JSON.stringify(options)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '', pending = '';
  const t0 = Date.now();
  child.stdout.on('data', chunk => { out += chunk; pending += chunk; const parts = pending.split('\n'); pending = parts.pop(); for (const line of parts) onLine?.(line, child); });
  child.stderr.on('data', chunk => { err += chunk; });
  child.on('error', reject);
  child.on('close', (code, signal) => resolve({ code, signal, err, ms: Date.now() - t0, lines: out.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) }));
});
const checkpointsOf = result => result.lines.filter(line => line.type === 'checkpoint');
const ok = result => { assert.equal(result.code, 0, `Il worker è finito con ${result.code}: ${result.err.slice(-300)}`); assert.ok(result.lines.some(line => line.type === 'done')); return checkpointsOf(result); };
const file = (folder, options, years, kind = 'json') => lib.checkpointFile(folder, options, years, kind);
const base = { seed: 'harness', level: 'deputato', years: 0.5, checkpoints: [0.25, 0.5] };
const dirA = dir('a'), dirD = dir('d'), dirE = dir('e');
const optionsFast = { ...base, fast: true, roundtrip: true, outDir: dirA, saveStates: true };

// Interruption: a worker killed after its first checkpoint leaves that checkpoint on disk, whole, and no checkpoint it did not reach.
const interrupted = (async () => {
  const options = { ...base, years: 1, checkpoints: [0.25, 1], fast: true, outDir: dirE, saveStates: true };
  let killed = false;
  const result = await worker(options, { onLine: (line, child) => { if (!killed && JSON.parse(line).type === 'checkpoint') { killed = true; child.kill('SIGKILL'); } } });
  return { options, result };
})();
// The four runs side by side: fast with the export/import check and the states, the same without the check (it must not matter), the plain mode, and the resume (afterwards).
const [fastRun, bareRun, plainRun] = await Promise.all([
  worker(optionsFast),
  worker({ ...base, fast: true }),
  worker({ ...base, fast: false })
]);
const fastCheckpoints = ok(fastRun), bareCheckpoints = ok(bareRun), plainCheckpoints = ok(plainRun);

// ---------- 2. the fast mode does not change the game ----------
for (let index = 0; index < 2; index++) {
  assert.equal(fastCheckpoints[index].fingerprint, plainCheckpoints[index].fingerprint, `Stesso seed: stessa impronta con e senza modalità veloce (tappa ${base.checkpoints[index]})`);
  // `health.size` is the length of the whole state text, interface and save counters included (the fingerprint leaves them out): the save status differs by a few bytes, the game does not.
  const same = item => [item.issueCount, item.activity, item.mathRandom, { ...item.health, size: 0 }];
  assert.deepEqual(same(fastCheckpoints[index]), same(plainCheckpoints[index]), 'Invarianti, attività, Math.random e salute del gioco sono quelli della modalità normale');
  assert.ok(Math.abs(fastCheckpoints[index].health.size - plainCheckpoints[index].health.size) < 100, 'Le dimensioni dello stato differiscono solo di qualche byte (stato del salvataggio e interfaccia)');
}
assert.ok(fastCheckpoints.every(item => item.storage.fast === true && item.storage.skipped.length > 0 && item.storage.skipped.every(isCareerSaveKey) && item.storage.written.every(key => !isCareerSaveKey(key))), 'Nel worker veloce solo chiavi del salvataggio della carriera sono state escluse, e nessuna è finita nel browser');
assert.ok(plainCheckpoints.every(item => item.storage.fast === false && item.storage.skipped.length === 0 && item.storage.written.includes(CAREER_STORAGE_PREFIX)), 'Nel worker normale il salvataggio della carriera è scritto e nulla è escluso');
step('modalità veloce uguale alla normale (impronta, invarianti, attività, salute) a 0,25 e 0,5 anni');

// ---------- 4a. the export/import check does not touch the run, and it is not vacuous ----------
for (let index = 0; index < 2; index++) {
  assert.equal(fastCheckpoints[index].fingerprint, bareCheckpoints[index].fingerprint, `Con e senza export/import a ogni tappa la partita è la stessa (tappa ${base.checkpoints[index]})`);
  assert.ok(fastCheckpoints[index].roundtrip.ok && fastCheckpoints[index].roundtrip.faithful && fastCheckpoints[index].roundtrip.idempotent && fastCheckpoints[index].roundtrip.unexpected.length === 0, `Export/import fedele alla tappa ${base.checkpoints[index]}: ${JSON.stringify(fastCheckpoints[index].roundtrip)}`);
}
assert.ok(bareCheckpoints.every(item => item.roundtrip === undefined), 'Senza l’opzione non si fa nessuna verifica (la modalità normale non cambia)');
const verify = options => new Promise((resolve, reject) => { const child = spawn(process.execPath, [workerPath, JSON.stringify({ verify: true, ...options })], { stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; child.stdout.on('data', chunk => { out += chunk; }); child.on('error', reject); child.on('close', () => resolve(JSON.parse(out.trim().split('\n').at(-1)))); });
const stateFile = file(dirA, base, 0.25, 'state');
const tampered = join(work, 'manomesso.state.json');
const snapshot = JSON.parse(readFileSync(stateFile, 'utf8'));
const save = JSON.parse(snapshot.save);
save.game.week.index += 1;
writeFileSync(tampered, JSON.stringify({ ...snapshot, save: JSON.stringify(save) }));
const caught = await verify({ verify: tampered, expected: fastCheckpoints[0].fingerprint, fast: true });
assert.equal(caught.ok, false, 'Un salvataggio manomesso viene scoperto dall’export/import (la verifica non è vuota)');
assert.equal(caught.faithful, false, 'E si vede che non è lo stato che la partita aveva');
const clean = await verify({ verify: stateFile, expected: fastCheckpoints[0].fingerprint, fast: true });
assert.ok(clean.ok && clean.added.every(path => LOAD_ADDITIONS.some(item => path === item || path.startsWith(`${item}.`))), 'Lo stesso salvataggio non manomesso passa, con le sole aggiunte del caricamento');
step('export/import a ogni tappa in un altro processo: non tocca la partita, scopre un salvataggio manomesso, ammette solo le aggiunte dichiarate');

// ---------- 3. the checkpoints are on disk, and survive an interruption ----------
for (const [index, years] of base.checkpoints.entries()) {
  const record = JSON.parse(readFileSync(file(dirA, base, years), 'utf8'));
  assert.deepEqual([record.seed, record.level, record.years, record.fingerprint, record.invariantsOk, record.roundtripOk, record.fast], [base.seed, base.level, years, fastCheckpoints[index].fingerprint, true, true, true], 'Il checkpoint su disco dice seed, carriera, anno, impronta, esito delle invarianti e dell’export/import');
  assert.ok(typeof record.savedAt === 'string' && record.issueCount === 0 && existsSync(file(dirA, base, years, 'state')), 'E c’è il file di stato per riprendere');
}
const { options: optionsE, result: resultE } = await interrupted;
assert.ok(resultE.signal === 'SIGKILL', 'Il worker è stato interrotto con SIGKILL, senza modo di salvare nulla');
const first = JSON.parse(readFileSync(file(dirE, optionsE, 0.25), 'utf8'));
assert.equal(first.fingerprint, fastCheckpoints[0].fingerprint, 'Il checkpoint sopravvissuto all’interruzione è quello giusto (stessa impronta della corsa intera)');
assert.ok(!existsSync(file(dirE, optionsE, 1)) && !readdirSync(dirE).some(name => name.endsWith('.tmp')), 'Il checkpoint che non è stato raggiunto non esiste e non restano file a metà');
step('checkpoint su disco con identificazione completa, sopravvissuti a un’interruzione (SIGKILL)');

// ---------- 5. resuming gives the same game ----------
const resumed = ok(await worker({ ...base, checkpoints: [0.5], fast: true, roundtrip: true, outDir: dirD, saveStates: true, resumeFrom: file(dirA, base, 0.25, 'state') }));
assert.ok(resumed[0].roundtrip.ok && resumed[0].roundtrip.faithful, `Anche in una corsa ripresa l'export/import è fedele (la partita ripresa porta con sé la busta dell'export): ${JSON.stringify(resumed[0].roundtrip)}`);
const straight = JSON.parse(readFileSync(file(dirA, base, 0.5, 'state'), 'utf8')), after = JSON.parse(readFileSync(file(dirD, { ...base }, 0.5, 'state'), 'utf8'));
const diff = stateDiff(JSON.parse(straight.save), JSON.parse(after.save));
assert.deepEqual(diff.changed, [], 'Dopo la ripresa nessun valore dello stato è diverso dalla corsa intera');
assert.ok(diff.onlyA.length === 0 && diff.onlyB.every(path => LOAD_ADDITIONS.some(item => path === item || path.startsWith(`${item}.`))), `Dopo la ripresa cambia solo ciò che il caricamento aggiunge (${diff.onlyA.concat(diff.onlyB).join(', ')})`);
const [x, y] = [fastCheckpoints[1], resumed[0]];
assert.deepEqual([y.issueCount, y.issues, y.activity, y.mathRandom, y.week, y.years], [x.issueCount, x.issues, x.activity, x.mathRandom, x.week, x.years], 'Dopo la ripresa invarianti, attività, Math.random e settimana sono quelli della corsa intera');
assert.deepEqual({ ...y.health, size: 0 }, { ...x.health, size: 0 }, 'E la salute del gioco (la dimensione dello stato a parte, che include le aggiunte)');
assert.deepEqual(after.streams, straight.streams, 'I generatori degli id e delle decisioni sono allo stesso punto');
assert.deepEqual(after.accumulators, straight.accumulators, 'E gli accumulatori della corsa (leggi, eventi, governi, sondaggi, problemi visti)');
assert.equal(y.fingerprint === x.fingerprint, false, 'L’impronta intera non è identica: nello stato ripreso ci sono le aggiunte del caricamento (è una differenza dichiarata, non nascosta)');
step('ripresa dallo stato di un checkpoint: stesso stato salvo le aggiunte dichiarate, stesse invarianti, attività, generatori e accumulatori');

// ---------- 6. the persistence of the plain mode, apart from the fast one ----------
const probe = fast => new Promise((resolve, reject) => {
  const code = `
    import { startCareer, playWeek, fingerprint, stateDiff } from ${JSON.stringify(workerPath)};
    const run = await startCareer({ seed: 'persistenza', level: 'comunale', fast: ${fast} });
    for (let week = 0; week < 5; week++) playWeek(run);
    run.store.saveToSlot();
    const mem = globalThis.localStorage.__mem;
    const state = run.store.getState();
    const main = mem.get('palazzo-2026.career.v1');
    const out = { keys: [...mem.keys()].filter(key => !key.startsWith('politicando.onboarding')).sort(), skipped: [...globalThis.localStorage.__skipped] };
    out.mainParses = Boolean(main) && Boolean(JSON.parse(main));
    out.slots = [...mem.keys()].filter(key => key.startsWith('politicando.slot.')).length;
    if (main) {
      const build = (await import('node:fs')).readFileSync(${JSON.stringify(fileURLToPath(new URL('index.html', root)))}, 'utf8').match(/main\\.js\\?v=([^"']+)/)?.[1];
      const again = (await import(${JSON.stringify(new URL('src/core/store.js', root).href)} + '?v=' + build + '&ricarica=' + Date.now())).store.getState();
      const diff = stateDiff(state, again);
      out.sameCareer = again.career?.id === state.career.id && again.clock.currentDate === state.clock.currentDate;
      out.diff = diff;
    }
    console.log(JSON.stringify(out));
    process.exit(0);`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: ['ignore', 'pipe', 'pipe'], cwd: fileURLToPath(root) });
  let out = '', err = '';
  child.stdout.on('data', chunk => { out += chunk; }); child.stderr.on('data', chunk => { err += chunk; });
  child.on('error', reject);
  child.on('close', () => { try { resolve(JSON.parse(out.trim().split('\n').at(-1))); } catch { reject(new Error(`Sonda della persistenza senza risposta: ${err.slice(-300)}`)); } });
});
const [plain, quick] = await Promise.all([probe(false), probe(true)]);
assert.ok(plain.mainParses && plain.keys.includes('palazzo-2026.career.v1') && plain.skipped.length === 0, 'Normale: il salvataggio principale è scritto, è un JSON valido e nulla è escluso');
assert.ok(plain.slots === 1, 'Normale: lo slot salvato esplicitamente è scritto');
assert.ok(plain.sameCareer && plain.diff.changed.length === 0 && plain.diff.onlyA.length === 0, `Normale: un’istanza nuova dello store rilegge dal browser la stessa partita (${JSON.stringify(plain.diff)})`);
assert.ok(!quick.mainParses && !quick.keys.includes('palazzo-2026.career.v1') && quick.skipped.includes('palazzo-2026.career.v1'), 'Veloce: il salvataggio principale non è scritto');
assert.equal(quick.slots, 1, 'Veloce: lo slot salvato esplicitamente è comunque scritto (non è un salvataggio della carriera)');
step('persistenza nella modalità normale (salvataggio, slot, rilettura da una nuova istanza dello store), separata da quella veloce');

rmSync(work, { recursive: true, force: true });
const secs = ms => `${Math.round(ms / 100) / 10} s`;
console.log(`Harness dei test lunghi verificato in ${secs(Date.now() - started)}: ${done.join('; ')}. Tempi dei worker (mezzo anno, deputato): veloce ${secs(fastCheckpoints[1].ms)}, normale ${secs(plainCheckpoints[1].ms)}, ripreso (ultimo quarto) ${secs(resumed[0].ms)}.`);
