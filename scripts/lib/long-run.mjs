// Long careers on the real engine of the game (the store, with the real data from disk), for the long-run checks.
// Everything that decides follows the seed: the player (and so every generator of the world), the ids the engine
// creates and the decisions taken week by week. Same seed + same decisions = same game.
// As a program: node scripts/lib/long-run.mjs '{"seed":"a","level":"deputato","years":30,"checkpoints":[5,10,20,30]}'
// prints one JSON line per checkpoint and a final line. Options of the program (all off by default, the plain run is what it always was):
//   fast: the worker does not write the game to the browser storage (only the keys of the career save, see CAREER_STORAGE_PREFIX): the simulated state is the same, the run is
//     many times quicker because the save layer parses whole saves again and again. It lives in this worker only: nothing else of the game or of the tests changes.
//   outDir: every checkpoint is written to disk at once (<tag>-y<years>.json: seed, level, year, fingerprint, invariants, health), so an interrupted run keeps what it reached;
//   saveStates: with outDir, also the state to resume from (<tag>-y<years>.state.json);   resumeFrom: continue a career from one of those state files;
//   roundtrip: at every checkpoint the save is exported and imported again by another process (the run is not touched) and compared with the state of the run (the result is in the checkpoint).
import { createHash, webcrypto } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const hashText = text => { let h = 2166136261; for (const char of String(text)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
// A small seeded generator (mulberry32) for the decisions and the ids.
// getState/setState let a run be resumed with the generator exactly where it was (the numbers it gives are the same as without them).
export function seeded(seed) {
  let a = hashText(seed) || 1;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  next.getState = () => a;
  next.setState = value => { a = value >>> 0; };
  return next;
}

// The browser the engine expects, stood in: storage in memory, files from disk, ids from the seed.
// The keys of the career save in the browser storage (main, backup, history; the lock is left alone): the only ones the fast mode does not write. Every other key (the Hall
// of Fame, the saved slots, the settings, the onboarding...) is written as always. check-harness.mjs ties this prefix to the one in src/core/storage.js.
export const CAREER_STORAGE_PREFIX = 'palazzo-2026.career.v1';
export const isCareerSaveKey = key => String(key).startsWith(CAREER_STORAGE_PREFIX) && !String(key).endsWith('.lock');
export async function environment(seed, { keepStorage = false, fast = false } = {}) {
  // keepStorage: the browser storage of the previous career stays (the Hall of Fame outlives every career).
  // fast: the writes of the career save are dropped (and counted in __skipped); this belongs to the worker that asks for it, a later environment() starts again from the plain one.
  const mem = keepStorage && globalThis.localStorage?.__mem ? globalThis.localStorage.__mem : new Map();
  const skipped = new Set();
  globalThis.localStorage = { __mem: mem, __fast: Boolean(fast), __skipped: skipped, getItem: key => mem.get(key) ?? null, setItem: (key, value) => { if (fast && isCareerSaveKey(key)) { skipped.add(String(key)); return; } mem.set(key, String(value)); }, removeItem: key => mem.delete(key) };
  globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(String(url).split('?')[0])), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body }; };
  const rand = seeded(`id|${seed}`);
  const hex = n => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');
  const crypto = Object.create(webcrypto);
  crypto.randomUUID = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
  Object.defineProperty(globalThis, 'crypto', { value: crypto, configurable: true, writable: true });
  // The simulation must not depend on Math.random: every call is counted (and reported).
  const counter = { calls: 0 };
  const random = Math.random;
  Math.random = () => { counter.calls++; return random(); };
  return { mem, counter, idRand: rand, fast: Boolean(fast) };
}

const PROFILES = {
  comunale: { initialLevel: 'comunale' },
  provinciale: { initialLevel: 'provinciale' },
  regionale: { initialLevel: 'regionale' },
  deputato: { initialLevel: 'deputato', parliamentStartMode: 'real-context', parliamentaryGroupId: 'cam-xix-03' },
  senatore: { initialLevel: 'senatore', parliamentStartMode: 'real-context', parliamentaryGroupId: 'senato-xix-gruppo-56' },
  europeo: { initialLevel: 'europeo' }
};
const PLACES = [
  { region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', provinceCode: '052', provinceName: 'Siena', provinceType: 'Provincia' },
  { region: 'Lombardia', municipality: 'Bergamo', municipalityCode: '016024', provinceCode: '016', provinceName: 'Bergamo', provinceType: 'Provincia' },
  { region: 'Campania', municipality: 'Salerno', municipalityCode: '065116', provinceCode: '065', provinceName: 'Salerno', provinceType: 'Provincia' }
];

// Starts the engine and a career for the seed. Returns the store, the real reference and the decision maker.
// The engine of the game as the long runs use it: the environment, the real data and the references the store needs (the same for a new career and for one resumed from a save).
async function prepareStore({ seed, keepStorage = false, fast = false, startDate = null }) {
  const env = await environment(seed, { keepStorage, fast });
  // The modules as the game loads them (with the build stamp of index.html): one instance of each, shared with the
  // engine's own imports, so the real data loaded here are the ones the reference Government and majority read.
  const build = (await readFile(new URL('index.html', root), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
  const module = path => import(new URL(`${path}${build ? `?v=${build}` : ''}`, root).href);
  const real = await module('src/data/repositories/real-data.js');
  await real.loadRealDatabase();
  await real.loadRealCollections(['parties', 'politicalMovements', 'coalitions', 'twoPerThousand', 'realPolls', 'parliamentaryGroups', 'politicians', 'government', 'politicalFigures', 'groupMemberships', 'partyMemberships', 'electionParticipations', 'electoralLists', 'territorialUnits', 'municipalities', 'partyLeaderships', 'chambers', 'offices']);
  const db = real.realDatabase;
  const { store } = await module('src/core/store.js');
  const { governingEntityIds } = await module('src/data/repositories/party-links.js');
  const { referenceGovernmentSpec } = await module('src/data/repositories/government-reference.js');
  store.setRealReference({ twoPerThousand: db.twoPerThousand, parties: db.parties, movements: db.politicalMovements, coalitions: db.coalitions, polls: db.realPolls, governingIds: governingEntityIds(), startDate: startDate ?? db.manifest.scenarioDate ?? db.manifest.snapshotDate });
  const spec = referenceGovernmentSpec();
  if (!spec?.groupIds?.length) throw new Error('Governo di riferimento non ricavato dai dati reali.');
  store.setReferenceGovernment(spec);
  store.setParliamentaryGroups(db.parliamentaryGroups);
  store.setElectoralGeography(await real.loadRealDocument('electoralGeography'));
  store.setLocalCalendar(await real.loadRealDocument('localElections'));
  const context = { realPartyIds: [...db.parties, ...db.politicalMovements, ...db.coalitions].map(item => item.id), realGroupIds: db.parliamentaryGroups.map(item => item.id) };
  return { store, db, context, env, real };
}

// Starts the engine and a career for the seed. Returns the store, the real reference and the decision maker.
export async function startCareer({ seed = 'a', level = 'deputato', partyId = 'party-registro-p1-2017-41-ir', region = null, draft = {}, keepStorage = false, fast = false, startDate = null, territorial = false } = {}) {
  const { store, db, context, env, real } = await prepareStore({ seed, keepStorage, fast, startDate });
  // territorial: the page loads the ISTAT residents of the comuni as the game does at start (main.js); the plain long runs keep their baseline without them.
  if (territorial) store.setMunicipalPopulation(await real.loadOptionalRealDocument('municipalPopulation'));
  const pick = seeded(`profilo|${seed}`);
  const drawn = PLACES[Math.floor(pick() * PLACES.length)];
  const place = PLACES.find(item => item.region === region) ?? drawn;
  const birth = `19${60 + Math.floor(pick() * 30)}-0${1 + Math.floor(pick() * 9)}-1${Math.floor(pick() * 9)}`;
  store.createCareer({ firstName: `Prova${seed}`, lastName: 'Lunga', birthDate: birth, gender: 'donna', ...place, previousProfession: 'Insegnante', ...PROFILES[level], partyMode: 'existing', partyId, difficulty: 'normale', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 }, ...draft }, db.parties, db.parliamentaryGroups);
  // The same seed gives the same career id, and starting a career keeps the one being replaced in an automatic slot (as the game does): a run that repeats a seed would then find, in that slot,
  // a copy of the previous run that "has gone further" and, rightly, would never be downgraded by the fresh one. The runs of the harness are separate games: that copy is dropped.
  {
    const stamp = (await readFile(new URL('index.html', root), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
    const { storage } = await import(new URL(`src/core/storage.js${stamp ? `?v=${stamp}` : ''}`, root).href);
    const own = store.getState().career.id;
    for (const slot of storage.listSlots()) { try { if (slot.autoPreserve && storage.loadSlot(slot.id)?.career?.id === own) storage.deleteSlot(slot.id); } catch { /* a slot that cannot be read stays */ } }
  }
  if (['deputato', 'senatore'].includes(level)) store.initializeParliament(db.parliamentaryGroups);
  // The territorial committees are born when the ISTAT units are loaded, as in the game: the long run plays them too.
  if (db.territorialUnits?.length) store.initializeCommittees(db.territorialUnits);
  // territorial: the player has opened Elezioni → Candidatura (the comuni and provinces of ISTAT are given to the game, which then lays out the races of the round).
  if (territorial) store.setTerritorialData({ units: db.territorialUnits, municipalities: db.municipalities, parties: [...db.parties, ...db.politicalMovements] });
  return { store, db, context, env, decide: seeded(`decisioni|${seed}`) };
}

// Resumes a career from the state file of a checkpoint (written with saveStates): the same engine set-up, the save loaded, the generators of the ids and of the decisions exactly where
// they were. Returns the same as startCareer, plus the accumulators of the run at that moment.
export async function resumeCareer({ seed = 'a', file, fast = false }) {
  const snapshot = JSON.parse(readFileSync(file, 'utf8'));
  if (snapshot.schema !== STATE_SCHEMA || snapshot.seed !== seed) throw new Error(`File di ripresa non valido o di un'altra carriera: ${file}`);
  const { store, db, context, env } = await prepareStore({ seed, fast });
  store.loadGame(snapshot.save);
  env.idRand.setState(snapshot.streams.id);
  const decide = seeded(`decisioni|${seed}`);
  decide.setState(snapshot.streams.decide);
  return { store, db, context, env, decide, snapshot };
}
const STATE_SCHEMA = 1;

const CAMPAIGN_ROLE = { politiche: 'deputato', europee: null, regionale: null, comunale: null };
// One week of play with the same rules for every seed: each open decision takes a choice drawn from the seed; when
// the candidacies open, the player runs (most of the times) and campaigns until the vote; then the week advances.
export function playWeek({ store, db, decide }) {
  const state = store.getState();
  for (const item of [...(state.game?.inbox ?? [])]) {
    const choices = item.choices ?? [];
    if (!choices.length) continue;
    const choice = choices[Math.floor(decide() * choices.length)];
    try { store.resolveAgendaItem(item.id, choice.id); } catch { try { store.resolveAgendaItem(item.id, choices[0].id); } catch { /* not possible this week */ } }
  }
  const now = store.getState();
  if (now.game?.status !== 'ended' && now.campaign?.status !== 'active') {
    const open = (now.game?.elections ?? []).find(item => item.status === 'open');
    if (open && decide() < 0.75) {
      try { store.startCampaign({ electionType: open.type, ...(CAMPAIGN_ROLE[open.type] ? { role: CAMPAIGN_ROLE[open.type] } : {}), objective: 'seat' }, db.parties, { politicians: db.politicians, groups: db.parliamentaryGroups }); } catch { /* not allowed: the week goes on */ }
    }
  }
  const campaign = store.getState().campaign;
  if (campaign?.status === 'active') {
    for (const event of [...(campaign.pendingEvents ?? [])]) { try { store.decideCampaignEvent(event.id, event.choices[Math.floor(decide() * event.choices.length)].id); } catch { /* already decided */ } }
    const activity = ['party_meeting', 'citizen_meeting', 'door_to_door', 'rally', 'interview', 'fundraising', 'social', 'posters'][Math.floor(decide() * 8)];
    try { store.performCampaignActivity(activity, { territoryId: store.getState().campaign.territories?.[0]?.id }); } catch { /* not affordable today */ }
  }
  store.advance(7);
}

// A fingerprint of the state for comparing two games: wall-clock timestamps, the interface and the save counter (how many times the game was written) are left out.
export function fingerprint(state) {
  const clean = JSON.stringify(state, (key, value) => key === 'ui' ? undefined : key === 'saveMeta' ? { careerId: value?.careerId } : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? 'T' : value);
  return createHash('sha256').update(clean).digest('hex');
}

// A summary of the health of the game at a moment (for the reports of the long run).
export function health(state) {
  const game = state.game ?? {};
  const poll = state.world?.polls?.at(-1);
  return {
    date: state.clock.currentDate, startedAt: state.career.startedAt, week: game.week?.index, status: game.status, formation: state.national?.formation?.phase ?? null,
    size: JSON.stringify(state).length,
    elections: (game.elections ?? []).filter(item => item.status === 'held').length,
    upcoming: (game.elections ?? []).filter(item => ['upcoming', 'open', 'running'].includes(item.status)).map(item => `${item.type}:${item.electionDate}`),
    campaigns: (state.career.electionHistory ?? []).length,
    legislature: state.national?.legislature?.number ?? null,
    government: state.parliament?.government ? `${state.parliament.government.status}` : null,
    laws: { open: (state.parliament?.laws ?? []).filter(law => !['approved', 'rejected', 'lapsed', 'withdrawn'].includes(law.stage)).length, archived: (state.parliament?.lawArchive ?? []).length },
    worldEvents: (state.world?.events ?? []).length,
    parties: (state.world?.parties ?? []).length,
    pollDate: poll?.date ?? null,
    debt: state.society?.economy?.debt ?? null, deficit: state.society?.economy?.deficit ?? null
  };
}

// The state as the comparisons read it: the interface and the save counter apart, wall-clock timestamps made equal (the same cleaning as the fingerprint).
const cleanState = state => JSON.parse(JSON.stringify(state, (key, value) => key === 'ui' ? undefined : key === 'saveMeta' ? { careerId: value?.careerId } : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? 'T' : value));
// What differs between two states, by path: `changed` (a value is not the same, floating-point noise of 1e-9 apart), `onlyA` and `onlyB` (a path exists on one side only).
export function stateDiff(a, b) {
  const out = { changed: [], onlyA: [], onlyB: [] };
  const walk = (x, y, path) => {
    if (JSON.stringify(x) === JSON.stringify(y)) return;
    // The loader recomputes some shares (the party currents sum to 100): 27.2 comes back as 27.200000000000003. That is the same number, not a change.
    if (typeof x === 'number' && typeof y === 'number' && Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y))) return;
    if (x === undefined) { out.onlyB.push(path); return; }
    if (y === undefined) { out.onlyA.push(path); return; }
    if (x && y && typeof x === 'object' && typeof y === 'object' && Array.isArray(x) === Array.isArray(y)) { for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[key], y[key], path ? `${path}.${key}` : key); return; }
    out.changed.push(path);
  };
  walk(cleanState(a), cleanState(b), '');
  return out;
}
// What loading a save adds to a state that the game has not needed yet (the defaults of the newer parts: the loader fills them) and the envelope of an export: nothing else is
// allowed to appear, disappear or change when a save goes through export and import (a new path here is a decision, not an accident).
export const LOAD_ADDITIONS = Object.freeze(['exportedAt', 'exportedBy', 'game.setbacks', 'races']);
export const isLoadAddition = path => LOAD_ADDITIONS.some(item => path === item || path.startsWith(`${item}.`));
// The state of a save text without the envelope of the export (a state loaded from a save keeps the envelope keys it came with: both sides of the comparison drop them).
const withoutEnvelope = saved => { const { exportedAt, exportedBy, ...state } = saved; return state; };

// The export/import of the save at a checkpoint, in a process of its own (so the run being watched is never touched by it): the save of the state file is read again as the game reads a
// file and loaded into a fresh store. Checked: the exported text is the state the run had (fingerprint), the import changes nothing but what the loader adds (LOAD_ADDITIONS), and a second
// export and import gives the same state again (nothing drifts at each reload).
export async function verifyRoundtripFile({ file, expected = null, fast = true, seed = null }) {
  const snapshot = JSON.parse(readFileSync(file, 'utf8'));
  const { store } = await prepareStore({ seed: seed ?? snapshot.seed, fast });
  const saved = JSON.parse(snapshot.save);
  const faithful = expected === null ? true : fingerprint(withoutEnvelope(saved)) === expected;
  store.loadGame(saved);
  const imported = store.getState();
  const diff = stateDiff(withoutEnvelope(saved), imported);
  // The one thing the loader removes: an entry of `causes` of an event in the queue that repeats an earlier one (the engine writes ['costo-vita', 'costo-vita']; a reload keeps one).
  const dedupedCause = path => { const match = /^game\.eventQueue\.(\d+)\.causes\.(\d+)$/.exec(path); if (!match) return false; const list = saved.game?.eventQueue?.[Number(match[1])]?.causes ?? []; return list.indexOf(list[Number(match[2])]) < Number(match[2]); };
  const normalized = diff.onlyA.filter(dedupedCause);
  const unexpected = [...diff.changed, ...diff.onlyA.filter(path => !dedupedCause(path)), ...diff.onlyB.filter(path => !isLoadAddition(path))];
  const first = fingerprint(imported);
  store.loadGame(JSON.parse(store.exportSave()));
  const idempotent = fingerprint(store.getState()) === first;
  return { ok: faithful && unexpected.length === 0 && idempotent, faithful, idempotent, unexpected: unexpected.slice(0, 12), normalized: normalized.slice(0, 12), added: diff.onlyB.filter(isLoadAddition).slice(0, 12), bytes: snapshot.save.length };
}

// Written whole or not at all: an interrupted process leaves either the old file or the new one, never half of it.
function writeAtomic(file, text) { const temp = `${file}.${process.pid}.tmp`; writeFileSync(temp, text); renameSync(temp, file); }
export const checkpointTag = ({ seed, level, twin = null }) => `${seed}-${level}${twin ? `-t${twin}` : ''}`;
export const checkpointFile = (dir, options, years, kind = 'json') => join(dir, `${checkpointTag(options)}-y${years}.${kind === 'state' ? 'state.json' : 'json'}`);

// As a program: one career, reports at each checkpoint (years), invariants included.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const options = JSON.parse(process.argv[2] ?? '{}');
  // The export/import check of a state file (see verifyRoundtripFile): prints the result and ends.
  if (options.verify) { console.log(JSON.stringify(await verifyRoundtripFile({ file: options.verify, expected: options.expected ?? null, fast: options.fast !== false, seed: options.seed ?? null }))); process.exit(0); }
  const { seed = 'a', level = 'deputato', years = 5, checkpoints = [years], checkEvery = 13, fast = false, outDir = null, saveStates = false, resumeFrom = null, roundtrip = false } = options;
  const { checkInvariants } = await import(new URL('src/core/invariants.js', root));
  const run = resumeFrom ? await resumeCareer({ seed, file: resumeFrom, fast }) : await startCareer({ seed, level, fast });
  const started = Date.now();
  const weeks = Math.round(years * 52.18);
  const marks = new Map(checkpoints.map(year => [Math.round(year * 52.18), year]));
  const seenIssues = new Map();
  // What keeps happening over the years: laws decided, chronicle of the world, Governments, polls.
  const activity = { lawsClosed: new Set(), worldEvents: new Set(), governments: new Set(), polls: 0, lastPollWeek: null, withoutGovernment: 0, longestWithoutGovernment: 0 };
  let lastWeekIndex = null, frozen = 0, from = 1;
  if (run.snapshot) {
    // The accumulators of the run at the checkpoint it resumes from (what the weeks before had seen).
    const saved = run.snapshot.accumulators;
    for (const key of ['lawsClosed', 'worldEvents', 'governments']) for (const id of saved[key]) activity[key].add(id);
    Object.assign(activity, { polls: saved.polls, lastPollWeek: saved.lastPollWeek, withoutGovernment: saved.withoutGovernment, longestWithoutGovernment: saved.longestWithoutGovernment });
    for (const [key, value] of saved.seenIssues) seenIssues.set(key, value);
    lastWeekIndex = saved.lastWeekIndex; frozen = saved.frozen; from = run.snapshot.week + 1;
    run.env.counter.calls = saved.mathRandom;
  }
  if (outDir) mkdirSync(outDir, { recursive: true });
  for (let week = from; week <= weeks; week++) {
    playWeek(run);
    const state = run.store.getState();
    // A game that stops moving (the clock or the weeks) is a block.
    const index = state.game?.week?.index ?? null;
    frozen = index === lastWeekIndex ? frozen + 1 : 0;
    lastWeekIndex = index;
    if (frozen > 2) { seenIssues.set('blocco|settimane', { code: 'blocco', path: 'game.week.index', message: `La settimana resta ${index} per ${frozen} turni`, week }); }
    for (const law of [...(state.parliament?.laws ?? []), ...(state.parliament?.lawArchive ?? [])]) if (['approved', 'rejected', 'lapsed', 'withdrawn'].includes(law.stage)) activity.lawsClosed.add(law.id);
    for (const event of state.world?.events ?? []) activity.worldEvents.add(event.id);
    if (state.parliament?.government?.id) activity.governments.add(state.parliament.government.id);
    // Weeks in a row without a Government in office (fallen, or none): a crisis must end.
    activity.withoutGovernment = !state.parliament?.government || state.parliament.government.status === 'fallen' ? activity.withoutGovernment + 1 : 0;
    activity.longestWithoutGovernment = Math.max(activity.longestWithoutGovernment, activity.withoutGovernment);
    const poll = state.world?.polls?.at(-1);
    if (poll && poll.id !== activity.lastPollWeek) { activity.polls++; activity.lastPollWeek = poll.id; }
    if (week % checkEvery === 0 || marks.has(week)) {
      // One entry per kind of problem and place (list positions aside), with how many times it was seen.
      for (const issue of checkInvariants(state, run.context).issues) { const key = `${issue.code}|${issue.path.replace(/\[\d+\]/g, '[]')}`; const seen = seenIssues.get(key); if (seen) seen.count++; else seenIssues.set(key, { ...issue, week, count: 1 }); }
    }
    // Progress for whoever watches the run (a stalled career is told from a slow one): one line every quarter of game time.
    if (week % 13 === 0) process.stdout.write(`${JSON.stringify({ type: 'progress', seed, level, week, weeks, date: state.clock?.currentDate ?? null, ms: Date.now() - started })}\n`);
    if (marks.has(week)) {
      const checkpoint = { type: 'checkpoint', seed, level, years: marks.get(week), week, ms: Date.now() - started, fast: Boolean(fast), fingerprint: fingerprint(state), health: health(state), issues: [...seenIssues.values()].slice(0, 60), issueCount: seenIssues.size, mathRandom: run.env.counter.calls, activity: { lawsClosed: activity.lawsClosed.size, worldEvents: activity.worldEvents.size, governments: activity.governments.size, polls: activity.polls, longestWithoutGovernment: activity.longestWithoutGovernment } };
      // The state file of this checkpoint: for resuming and for the export/import check (which is made by another process, and the run goes on untouched).
      const stateFile = outDir && saveStates ? checkpointFile(outDir, options, checkpoint.years, 'state') : null;
      const snapshotText = () => JSON.stringify({ schema: STATE_SCHEMA, seed, level, years: checkpoint.years, week, streams: { id: run.env.idRand.getState(), decide: run.decide.getState() }, accumulators: { lawsClosed: [...activity.lawsClosed], worldEvents: [...activity.worldEvents], governments: [...activity.governments], polls: activity.polls, lastPollWeek: activity.lastPollWeek, withoutGovernment: activity.withoutGovernment, longestWithoutGovernment: activity.longestWithoutGovernment, seenIssues: [...seenIssues], lastWeekIndex, frozen, mathRandom: run.env.counter.calls }, save: run.store.exportSave() });
      if (stateFile) writeAtomic(stateFile, snapshotText());
      if (roundtrip) {
        const file = stateFile ?? join(tmpdir(), `long-run-${process.pid}-${checkpoint.years}.state.json`);
        if (!stateFile) writeFileSync(file, snapshotText());
        const checked = spawnSync(process.execPath, [fileURLToPath(import.meta.url), JSON.stringify({ verify: file, expected: fingerprint(withoutEnvelope(state)), fast, seed })], { encoding: 'utf8', maxBuffer: 1 << 26 });
        if (!stateFile) unlinkSync(file);
        try { checkpoint.roundtrip = JSON.parse(checked.stdout.trim().split('\n').at(-1)); } catch { checkpoint.roundtrip = { ok: false, error: String(checked.stderr || checked.error || 'verifica senza risposta').slice(0, 300) }; }
      }
      checkpoint.storage = { fast: Boolean(globalThis.localStorage?.__fast), skipped: [...(globalThis.localStorage?.__skipped ?? [])], written: [...(globalThis.localStorage?.__mem?.keys() ?? [])] };
      // On disk before anything else is said: seed, career, year, fingerprint and the outcome of the invariants (and of the round trip) survive an interruption.
      if (outDir) writeAtomic(checkpointFile(outDir, options, checkpoint.years), `${JSON.stringify({ ...checkpoint, twin: options.twin ?? null, savedAt: new Date().toISOString(), invariantsOk: checkpoint.issueCount === 0, roundtripOk: checkpoint.roundtrip ? checkpoint.roundtrip.ok : null })}\n`);
      process.stdout.write(`${JSON.stringify(checkpoint)}\n`);
    }
  }
  process.stdout.write(`${JSON.stringify({ type: 'done', seed, level, years, ms: Date.now() - started })}\n`);
}
