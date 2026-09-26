// Long careers on the real engine of the game (the store, with the real data from disk), for the long-run checks.
// Everything that decides follows the seed: the player (and so every generator of the world), the ids the engine
// creates and the decisions taken week by week. Same seed + same decisions = same game.
// As a program: node scripts/lib/long-run.mjs '{"seed":"a","level":"deputato","years":30,"checkpoints":[5,10,20,30]}'
// prints one JSON line per checkpoint and a final line.
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const hashText = text => { let h = 2166136261; for (const char of String(text)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
// A small seeded generator (mulberry32) for the decisions and the ids.
export function seeded(seed) { let a = hashText(seed) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// The browser the engine expects, stood in: storage in memory, files from disk, ids from the seed.
async function environment(seed) {
  const mem = new Map();
  globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
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
  return { mem, counter };
}

const PROFILES = {
  comunale: { initialLevel: 'comunale' },
  regionale: { initialLevel: 'regionale' },
  deputato: { initialLevel: 'deputato', parliamentStartMode: 'real-context', parliamentaryGroupId: 'cam-xix-03' },
  senatore: { initialLevel: 'senatore', parliamentStartMode: 'real-context', parliamentaryGroupId: 'senato-xix-gruppo-56' }
};
const PLACES = [
  { region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', provinceCode: '052', provinceName: 'Siena', provinceType: 'Provincia' },
  { region: 'Lombardia', municipality: 'Bergamo', municipalityCode: '016024', provinceCode: '016', provinceName: 'Bergamo', provinceType: 'Provincia' },
  { region: 'Campania', municipality: 'Salerno', municipalityCode: '065116', provinceCode: '065', provinceName: 'Salerno', provinceType: 'Provincia' }
];

// Starts the engine and a career for the seed. Returns the store, the real reference and the decision maker.
export async function startCareer({ seed = 'a', level = 'deputato', partyId = 'party-registro-p1-2017-41-ir' } = {}) {
  const env = await environment(seed);
  // The modules as the game loads them (with the build stamp of index.html): one instance of each, shared with the
  // engine's own imports, so the real data loaded here are the ones the reference Government and majority read.
  const build = (await readFile(new URL('index.html', root), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
  const module = path => import(new URL(`${path}${build ? `?v=${build}` : ''}`, root).href);
  const real = await module('src/data/repositories/real-data.js');
  await real.loadRealDatabase();
  await real.loadRealCollections(['parties', 'politicalMovements', 'coalitions', 'twoPerThousand', 'realPolls', 'parliamentaryGroups', 'politicians', 'government', 'politicalFigures', 'groupMemberships', 'partyMemberships', 'electionParticipations', 'electoralLists', 'territorialUnits', 'partyLeaderships', 'chambers', 'offices']);
  const db = real.realDatabase;
  const { store } = await module('src/core/store.js');
  const { governingEntityIds } = await module('src/data/repositories/party-links.js');
  const { referenceGovernmentSpec } = await module('src/data/repositories/government-reference.js');
  store.setRealReference({ twoPerThousand: db.twoPerThousand, parties: db.parties, movements: db.politicalMovements, coalitions: db.coalitions, polls: db.realPolls, governingIds: governingEntityIds(), startDate: db.manifest.snapshotDate });
  const spec = referenceGovernmentSpec();
  if (!spec?.groupIds?.length) throw new Error('Governo di riferimento non ricavato dai dati reali.');
  store.setReferenceGovernment(spec);
  store.setParliamentaryGroups(db.parliamentaryGroups);
  store.setElectoralGeography(await real.loadRealDocument('electoralGeography'));
  store.setLocalCalendar(await real.loadRealDocument('localElections'));
  const pick = seeded(`profilo|${seed}`);
  const place = PLACES[Math.floor(pick() * PLACES.length)];
  const birth = `19${60 + Math.floor(pick() * 30)}-0${1 + Math.floor(pick() * 9)}-1${Math.floor(pick() * 9)}`;
  store.createCareer({ firstName: `Prova${seed}`, lastName: 'Lunga', birthDate: birth, gender: 'donna', ...place, previousProfession: 'Insegnante', ...PROFILES[level], partyMode: 'existing', partyId, difficulty: 'normale', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, db.parties, db.parliamentaryGroups);
  if (['deputato', 'senatore'].includes(level)) store.initializeParliament(db.parliamentaryGroups);
  const context = { realPartyIds: [...db.parties, ...db.politicalMovements, ...db.coalitions].map(item => item.id), realGroupIds: db.parliamentaryGroups.map(item => item.id) };
  return { store, db, context, env, decide: seeded(`decisioni|${seed}`) };
}

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

// A fingerprint of the state for comparing two games: wall-clock timestamps and the interface are left out.
export function fingerprint(state) {
  const clean = JSON.stringify(state, (key, value) => key === 'ui' ? undefined : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? 'T' : value);
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

// As a program: one career, reports at each checkpoint (years), invariants included.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const options = JSON.parse(process.argv[2] ?? '{}');
  const { seed = 'a', level = 'deputato', years = 5, checkpoints = [years], checkEvery = 13 } = options;
  const { checkInvariants } = await import(new URL('src/core/invariants.js', root));
  const run = await startCareer({ seed, level });
  const started = Date.now();
  const weeks = Math.round(years * 52.18);
  const marks = new Map(checkpoints.map(year => [Math.round(year * 52.18), year]));
  const seenIssues = new Map();
  // What keeps happening over the years: laws decided, chronicle of the world, Governments, polls.
  const activity = { lawsClosed: new Set(), worldEvents: new Set(), governments: new Set(), polls: 0, lastPollWeek: null, withoutGovernment: 0, longestWithoutGovernment: 0 };
  let lastWeekIndex = null, frozen = 0;
  for (let week = 1; week <= weeks; week++) {
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
    if (marks.has(week)) process.stdout.write(`${JSON.stringify({ type: 'checkpoint', seed, level, years: marks.get(week), ms: Date.now() - started, fingerprint: fingerprint(state), health: health(state), issues: [...seenIssues.values()].slice(0, 60), issueCount: seenIssues.size, mathRandom: run.env.counter.calls, activity: { lawsClosed: activity.lawsClosed.size, worldEvents: activity.worldEvents.size, governments: activity.governments.size, polls: activity.polls, longestWithoutGovernment: activity.longestWithoutGovernment } })}\n`);
  }
  process.stdout.write(`${JSON.stringify({ type: 'done', seed, level, years, ms: Date.now() - started })}\n`);
}
