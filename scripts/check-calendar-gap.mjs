// The rule of the calendar under stress: two different rounds of voting at least 180 days apart (votes of the same day are one round), a vote to play within a year of the last one and in
// every calendar year, whatever happens: a government that falls in any month of the year (early general election), a comune or a province dissolved, other starting dates and levels,
// with different seeds. A vote that cannot find a free date is listed (calendarConflict); a vote is never moved into the past nor out of its legal window; the ballot of a round is one
// competition (never two elections made out of one). Pure engine, no browser.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(String(url).split('?')[0])), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const realData = await import(`../src/data/repositories/real-data.js${v}`);
await realData.loadRealDatabase();
const calendar = await realData.loadRealDocument('localElections');
const T = await import(`../src/core/time.js${v}`);
const C = await import(`../src/core/career-engine.js${v}`);
const { CALENDAR_RULES, distinctRounds, keepsDistance } = await import(`../src/core/calendar-planner.js${v}`);
const { checkInvariants } = await import(`../src/core/invariants.js${v}`);

const STATS = { popularity: 50, reputation: 50, notoriety: 30, influence: 30, consensus: 5, experience: 20 };
const days = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
const PLACES = {
  Toscana: { region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', province: 'Siena', provinceCode: '052', provinceType: 'Provincia' },
  Lombardia: { region: 'Lombardia', municipality: 'Bergamo', municipalityCode: '016024', province: 'Bergamo', provinceCode: '016', provinceType: 'Provincia' },
  Campania: { region: 'Campania', municipality: 'Salerno', municipalityCode: '065116', province: 'Salerno', provinceCode: '065', provinceType: 'Provincia' },
  Sicilia: { region: 'Sicilia', municipality: 'Ragusa', municipalityCode: '088009', province: 'Ragusa', provinceCode: '088', provinceType: 'Libero consorzio di comuni' }
};
const LEVELS = ['comunale', 'provinciale', 'regionale', 'deputato', 'senatore', 'europeo'];
const STARTS = ['2026-10-12', '2027-02-01', '2027-07-19', '2028-01-10'];
const playable = row => row.statuses.has('open') || row.statuses.has('running') || (row.kind === 'voto' && row.statuses.has('held') && !row.statuses.has('missed') && row.statuses.size > 1);
const problems = [];
let runs = 0, worstGap = 0, closestRounds = 9999, moved = 0, joined = 0;

// A month for the fall of the government (early general election) and for the dissolution of a comune: the whole year, one run each.
const MONTHS = ['01-12', '02-09', '03-16', '04-13', '05-11', '06-15', '07-13', '08-17', '09-14', '10-12', '11-09', '12-14'];
for (const [index, month] of MONTHS.entries()) {
  const level = LEVELS[index % LEVELS.length];
  const regionName = Object.keys(PLACES)[index % 4];
  const start = STARTS[index % STARTS.length];
  const place = PLACES[regionName];
  const label = `${level}/${regionName}/${start}/crisi ${month}`;
  const localCalendar = C.localCalendarOf(calendar, { municipalityCode: place.municipalityCode, region: place.region, seed: place.municipality, provinceCode: place.provinceCode });
  let game = C.createGameState({ seedText: `gap|${label}`, currentDate: start, level, place, localCalendar, stats: STATS });
  const seen = new Map();
  let date = start, stats = { ...STATS };
  const fallYear = Number(start.slice(0, 4)) + 2 + (index % 3);
  for (let week = 0; week < 52 * 7; week++) {
    date = T.advanceDays(date, 7);
    const fall = date >= `${fallYear}-${month}` && date < T.advanceDays(`${fallYear}-${month}`, 7 * 6);
    const parliament = fall ? { government: { status: 'fallen' }, chambers: {}, laws: [] } : null;
    if (['comunale', 'provinciale'].includes(level) && date >= `${fallYear + 1}-${month}` && date < T.advanceDays(`${fallYear + 1}-${month}`, 7)) game = C.scheduleEarlyLocalElection(game, 'comunale', date);
    if (level === 'regionale' && date >= `${fallYear + 1}-${month}` && date < T.advanceDays(`${fallYear + 1}-${month}`, 7)) game = C.scheduleEarlyLocalElection(game, 'regionale', date);
    const before = JSON.stringify(game.elections.map(item => [item.id, item.electionDate]));
    const out = C.advanceWeek({ game, stats, parliament }, { currentDate: date, pollDelta: 0 });
    game = out.ctx.game; stats = out.ctx.stats; game.status = 'active';
    if (JSON.stringify(game.elections.map(item => [item.id, item.electionDate])) !== before) moved++;
    for (const entry of game.elections) { const row = seen.get(entry.id) ?? { id: entry.id, kind: 'voto', type: entry.type, date: entry.electionDate, early: Boolean(entry.early), statuses: new Set() }; row.date = entry.electionDate; row.short = row.short || Object.hasOwn(entry, 'shortGap'); row.early = row.early || Boolean(entry.early); row.statuses.add(entry.status); seen.set(entry.id, row); }
    for (const round of game.rounds ?? []) { const row = seen.get(round.id) ?? { id: round.id, kind: 'tornata', type: 'tornata', date: round.electionDate, statuses: new Set() }; row.statuses.add(round.status); seen.set(round.id, row); }
    // a vote is never in the past once its window is open, and its window never closes after the vote
    for (const entry of game.elections) if (!(entry.windowOpensAt <= entry.windowClosesAt && entry.windowClosesAt <= entry.electionDate)) problems.push(`${label}: finestra incoerente di ${entry.type} (${entry.windowOpensAt}–${entry.windowClosesAt} → ${entry.electionDate})`);
    // never two elections on one day made of the same competition
    const keys = game.elections.filter(item => item.status !== 'held').map(item => `${item.type}|${item.electionDate}`);
    if (new Set(keys).size !== keys.length) problems.push(`${label}: due elezioni dello stesso tipo nello stesso giorno (${date})`);
  }
  const standing = new Set([...game.elections.map(item => item.id), ...(game.rounds ?? []).map(item => item.id)]);
  const rows = [...seen.values()].filter(row => !(row.statuses.size === 1 && row.statuses.has('upcoming')) || standing.has(row.id)).sort((a, b) => a.date.localeCompare(b.date));
  const { closest, rounds } = distinctRounds(rows.map(row => row.date));
  // every pair of distinct rounds keeps the distance, without any exception: not for a vote brought forward by a crisis, not for two national votes, not for a vote squeezed by the law
  for (let i = 1; i < rounds.length; i++) {
    const gap = days(rounds[i - 1], rounds[i]);
    if (gap < CALENDAR_RULES.minGapDays) problems.push(`${label}: due tornate a ${gap} giorni (${rounds[i - 1]} e ${rounds[i]})`);
  }
  for (const row of rows) if (row.short) problems.push(`${label}: ${row.type} segnato come distanza ridotta (non esiste più)`);
  if (closest) closestRounds = Math.min(closestRounds, closest.days);
  joined += rows.length - rounds.length;
  for (const entry of game.elections.filter(item => item.calendarConflict)) problems.push(`${label}: nessuna data a distanza per ${entry.type} (${entry.electionDate})`);
  let from = start;
  for (const day of rows.filter(playable).map(row => row.date)) { const gap = days(from, day); worstGap = Math.max(worstGap, gap); if (gap > CALENDAR_RULES.maxPlayableGapDays) problems.push(`${label}: ${gap} giorni tra ${from} e il voto giocabile del ${day}`); from = day; }
  for (let year = Number(start.slice(0, 4)) + 1; year <= Number(start.slice(0, 4)) + 6; year++) if (!rows.some(row => row.date.startsWith(String(year)) && playable(row))) problems.push(`${label}: nel ${year} nessun voto giocabile`);
  const result = checkInvariants({ game, career: { initialLevel: level }, clock: { currentDate: date }, dataset: {}, local: { institutions: [] } });
  void result;
  runs++;
}

// the rule itself, on made-up dates
assert.ok(keepsDistance('2028-05-28', ['2028-05-28']) && keepsDistance('2028-05-28', ['2028-02-27']) === false && keepsDistance('2028-05-28', ['2027-12-01']) === false && keepsDistance('2028-05-28', ['2027-11-30']), 'Stesso giorno: una sola tornata; 91 e 179 giorni: troppo vicini; 180: ammesso.');
const planned = C.createGameState({ seedText: 'x', currentDate: '2026-10-12', level: 'regionale', place: PLACES.Lombardia, localCalendar: C.localCalendarOf(calendar, { municipalityCode: PLACES.Lombardia.municipalityCode, region: 'Lombardia', seed: 'Bergamo', provinceCode: '016' }), stats: STATS });
assert.ok(distinctRounds([...planned.elections.map(item => item.electionDate), ...planned.rounds.map(item => item.electionDate)]).closest.days >= 180, 'Il calendario di partenza rispetta già i 180 giorni.');
// idempotent: harmonizing again changes nothing
const again = JSON.stringify(planned.elections);
const { harmonizeElections } = await import(`../src/core/calendar-planner.js${v}`);
harmonizeElections(planned, '2026-10-12');
assert.equal(JSON.stringify(planned.elections), again, 'Riarmonizzare non cambia nulla.');

if (problems.length) { console.error(`Calendario sotto stress: ${problems.length} problemi.\n${[...new Set(problems)].slice(0, 40).join('\n')}`); process.exit(1); }
console.log(`Calendario sotto stress verificato: ${runs} carriere di sei anni con la caduta del governo e lo scioglimento di comuni, province e regioni in ogni mese, partenze e livelli diversi; tutte le tornate distinte ad almeno ${CALENDAR_RULES.minGapDays} giorni, senza eccezioni (la più vicina: ${closestRounds}), al massimo ${worstGap} giorni tra due voti giocabili, almeno un voto giocabile in ogni anno solare, ${moved} spostamenti di date, ${joined} voti uniti nella stessa tornata, nessun conflitto dichiarato.`);
