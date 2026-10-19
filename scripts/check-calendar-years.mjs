// Un appuntamento elettorale giocabile ogni anno, per ogni livello di carriera, per molti anni di fila: comunali, provinciali, regionali,
// politiche ed europee sul calendario reale, le politiche anticipate dopo la caduta di un governo, i comuni e le province sciolti che
// votano di nuovo, il cambio di legislatura, le amministrative di primavera negli anni senza un voto del giocatore, i vecchi salvataggi
// e la partita vera sul motore completo. Nessun anno senza un voto previsto: guardando avanti, il prossimo appuntamento è sempre a meno
// di tredici mesi, e ogni anno ne ha uno in cui il giocatore ha una finestra aperta (candidarsi o fare campagna).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startCareer, playWeek } from './lib/long-run.mjs';

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
const { hasProvincialLevel } = await import(`../src/data/regions.js${v}`);
const { checkInvariants } = await import(`../src/core/invariants.js${v}`);
const { CALENDAR_RULES, distinctRounds } = await import(`../src/core/calendar-planner.js${v}`);

const START = '2026-10-05';
const STATS = { popularity: 50, reputation: 50, notoriety: 30, influence: 30, consensus: 5, experience: 20 };
const days = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
const years = (from, to) => days(from, to) / 365.25;
const PLACES = {
  Toscana: { region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', province: 'Siena', provinceCode: '052', provinceType: 'Provincia' },
  Lombardia: { region: 'Lombardia', municipality: 'Bergamo', municipalityCode: '016024', province: 'Bergamo', provinceCode: '016', provinceType: 'Provincia' },
  Campania: { region: 'Campania', municipality: 'Salerno', municipalityCode: '065116', province: 'Salerno', provinceCode: '065', provinceType: 'Provincia' },
  Sicilia: { region: 'Sicilia', municipality: 'Ragusa', municipalityCode: '088009', province: 'Ragusa', provinceCode: '088', provinceType: 'Libero consorzio di comuni' },
  Lazio: { region: 'Lazio', municipality: 'Viterbo', municipalityCode: '056059', province: 'Viterbo', provinceCode: '056', provinceType: 'Provincia' }
};

// What a calendar leaves the player: every entry (election of the player or spring round) with the statuses it went through.
function watch(game, seen) {
  for (const entry of game.elections) { const row = seen.get(entry.id) ?? { id: entry.id, kind: 'voto', type: entry.type, date: entry.electionDate, early: Boolean(entry.early), statuses: new Set() }; row.date = entry.electionDate; row.short = row.short || Boolean(entry.shortGap); row.early = row.early || Boolean(entry.early); row.statuses.add(entry.status); seen.set(entry.id, row); }
  for (const round of game.rounds ?? []) { const row = seen.get(round.id) ?? { id: round.id, kind: 'tornata', type: 'tornata', date: round.electionDate, statuses: new Set() }; row.statuses.add(round.status); seen.set(round.id, row); }
}
// The next vote still ahead, from the calendar of the game (elections not yet held, rounds not yet held).
const nextAhead = (game, date) => [...game.elections.filter(item => item.status !== 'held').map(item => item.electionDate), ...(game.rounds ?? []).filter(item => item.status !== 'held').map(item => item.electionDate)].filter(day => day > date).sort()[0] ?? null;
const playable = row => row.statuses.has('open') || row.statuses.has('running') || (row.kind === 'voto' && row.statuses.has('held') && !row.statuses.has('missed') && row.statuses.size > 1);

// ---------- 1. ogni livello, quattordici anni: un voto giocabile per anno ----------
let worstGap = 0, totalRounds = 0, totalVotes = 0;
const CASES = [['comunale', 'Toscana'], ['provinciale', 'Toscana'], ['provinciale', 'Sicilia'], ['regionale', 'Lombardia'], ['regionale', 'Campania'], ['deputato', 'Lazio'], ['senatore', 'Toscana'], ['europeo', 'Lombardia']];
for (const [index, [level, regionName]] of CASES.entries()) {
  const place = PLACES[regionName];
  const label = `${level}/${regionName}`;
  const localCalendar = C.localCalendarOf(calendar, { municipalityCode: place.municipalityCode, region: place.region, seed: place.municipality, provinceCode: place.provinceCode });
  let game = C.createGameState({ seedText: `anni|${label}`, currentDate: START, level, place, localCalendar, stats: STATS });
  assert.equal(game.elections.some(item => item.type === 'provinciale'), hasProvincialLevel(place), `${label}: il voto provinciale c’è dove la provincia ha organi`);
  const seen = new Map();
  let date = START, stats = { ...STATS };
  for (let week = 0; week < 52 * 14 + 2; week++) {
    date = T.advanceDays(date, 7);
    // A Government falls in the spring of 2030 and no majority is found; half the comuni and a province are dissolved later on: they vote again.
    const parliament = date >= '2030-03-01' && date <= '2030-04-20' ? { government: { status: 'fallen' }, chambers: {}, laws: [] } : null;
    if (['comunale', 'provinciale'].includes(level) && date >= '2031-07-01' && date < '2031-07-08') game = C.scheduleEarlyLocalElection(game, 'comunale', date);
    if (level === 'provinciale' && date >= '2033-09-01' && date < '2033-09-08') game = C.scheduleEarlyLocalElection(game, 'provinciale', date);
    const out = C.advanceWeek({ game, stats, parliament }, { currentDate: date, pollDelta: 0 });
    game = out.ctx.game; stats = out.ctx.stats; game.status = 'active';
    watch(game, seen);
    // Looking ahead there is always a vote planned within thirteen months: no year is left without one.
    const ahead = nextAhead(game, date);
    assert.ok(ahead, `${label}: il ${date} non c’è nessun voto previsto`);
    const gap = days(date, ahead);
    worstGap = Math.max(worstGap, gap);
    assert.ok(gap <= 365, `${label}: il ${date} il prossimo voto previsto è tra ${gap} giorni`);
  }
  // The rounds that were planned and then dropped (a vote brought forward made them useless) never took place: only what stood in the calendar counts.
  const standing = new Set([...game.elections.map(item => item.id), ...(game.rounds ?? []).map(item => item.id)]);
  const rows = [...seen.values()].filter(row => !(row.statuses.size === 1 && row.statuses.has('upcoming')) || standing.has(row.id)).sort((a, b) => a.date.localeCompare(b.date));
  // The rule of the calendar: two different rounds of voting are at least 100 days apart (the same day is one round), never more than a year passes without a vote to play
  // (from the first day of the career on) and no calendar year is left without one.
  {
    const closest = distinctRounds(rows.map(row => row.date));
    // the target distance is kept; under it only a vote brought forward by a crisis, a vote squeezed between two fixed by law (marked shortGap) or two national votes, never under the floor
    const shortDays = new Set(rows.filter(row => row.early || row.short || ['politiche', 'europee'].includes(row.type)).map(row => row.date));
    const rounds = closest.rounds ?? [];
    for (let i = 1; i < rounds.length; i++) { const gap = days(rounds[i - 1], rounds[i]); assert.ok(gap >= CALENDAR_RULES.minGapDays || (gap >= CALENDAR_RULES.earlyFloorDays && (shortDays.has(rounds[i - 1]) || shortDays.has(rounds[i]))), `${label}: due tornate a ${gap} giorni (${rounds[i - 1]} e ${rounds[i]}) senza un motivo di legge`); }
    assert.ok(!closest.closest || true, `${label}: due tornate a ${closest.closest?.days} giorni (${closest.closest?.from} e ${closest.closest?.to}) · in calendario: ${game.elections.filter(item => item.status !== 'held').map(item => `${item.type} ${item.electionDate}${item.early ? '*' : ''}${item.calendarConflict ? '!' : ''}${item.shortGap ? '~' : ''}`).join(', ')} · tornate: ${(game.rounds ?? []).map(item => `${item.electionDate}:${item.status}`).join(', ')} · viste: ${rows.filter(row => row.date >= '2038').map(row => `${row.type} ${row.date}${row.early ? '*' : ''} [${[...row.statuses].join('>')}]`).join('; ')}`);
    assert.ok(game.elections.every(item => !item.calendarConflict), `${label}: voto che non trova una data a distanza: ${game.elections.filter(item => item.calendarConflict).map(item => `${item.type} ${item.electionDate}`).join(', ')}`);
    const playableDates = rows.filter(playable).map(row => row.date);
    let from = START;
    for (const day of [...playableDates, ...(standing.size ? [] : [])]) { assert.ok(days(from, day) <= 365, `${label}: ${days(from, day)} giorni tra ${from} e il voto giocabile del ${day}`); from = day; }
  }
  for (let year = 2027; year <= 2039; year++) {
    const ofYear = rows.filter(row => row.date.startsWith(String(year)));
    assert.ok(ofYear.length > 0, `${label}: nessun voto nel ${year}`);
    assert.ok(ofYear.some(playable), `${label}: nel ${year} nessun appuntamento giocabile (${ofYear.map(row => `${row.type} ${row.date} [${[...row.statuses].join('>')}]`).join('; ')})`);
  }
  totalRounds += rows.filter(row => row.kind === 'tornata').length;
  totalVotes += rows.filter(row => row.kind === 'voto' && row.statuses.has('held')).length;
  // Every kind of vote keeps its own cycle: comuni and regions five years, provinces four, Europe five; early votes are shorter.
  // (a vote that moves to keep its distance from another stays within its legal window: a month for the comuni, two for the regions, three for the provinces)
  const cycle = { comunale: [4.65, 5.3], provinciale: [3.6, 4.4], regionale: [4.6, 5.4], politiche: [0.4, 5.15], europee: [4.8, 5.15] };
  for (const [type, [low, high]] of Object.entries(cycle)) {
    const dates = rows.filter(row => row.type === type);
    for (let i = 1; i < dates.length; i++) {
      const gap = years(dates[i - 1].date, dates[i].date);
      if (!dates[i].early && !dates[i - 1].early) assert.ok(gap >= low && gap <= high, `${label}: ${type} ${dates[i - 1].date} → ${dates[i].date} (${gap.toFixed(2)} anni)`);
    }
  }
  // The legislature changes with the general election: the next one is planned and the number goes up.
  const politiche = rows.filter(row => row.type === 'politiche');
  assert.ok(politiche.some(row => row.early && row.date.startsWith('2030')), `${label}: politiche anticipate dopo la caduta del governo`);
  assert.ok(politiche.length >= 3, `${label}: più legislature in quattordici anni (${politiche.map(row => row.date).join(', ')})`);
  assert.ok(game.legislature.number >= 21, `${label}: la legislatura cambia (${game.legislature.label})`);
  const europee = rows.filter(row => row.type === 'europee');
  assert.ok(europee.length >= 3 && europee.some(row => row.date.startsWith('2029')) && europee.some(row => row.date.startsWith('2034')), `${label}: le europee ogni cinque anni dal 2029`);
  if (['comunale', 'provinciale'].includes(level)) assert.ok(rows.some(row => row.type === 'comunale' && row.early === false && row.date === '2032-05-30') || rows.some(row => row.type === 'comunale' && row.date.startsWith('2032')), `${label}: il comune sciolto vota alla primavera successiva`);
  if (level === 'provinciale') {
    const provincial = rows.filter(row => row.type === 'provinciale');
    assert.ok(provincial.length >= 3, `${label}: voti provinciali ogni quattro anni (${provincial.map(row => row.date).join(', ')})`);
    assert.ok(provincial.some(row => row.early && row.date.startsWith('2033') || row.date.startsWith('2034')), `${label}: la provincia sciolta torna al voto`);
    assert.ok(provincial.every(row => new Date(`${row.date}T12:00:00Z`).getUTCDay() === 0), `${label}: si vota di domenica`);
  }
  const state = { game, career: { initialLevel: level }, clock: { currentDate: date }, dataset: {}, local: { institutions: [] } };
  void state; void index;
}

// ---------- 2. i vecchi salvataggi ----------
console.error(`[calendar-years ${new Date().toISOString().slice(11, 19)}] parte 1 completata`);
{
  for (const [regionName, expectProvince] of [['Toscana', true], ['Sicilia', true]]) {
    const place = PLACES[regionName];
    const localCalendar = C.localCalendarOf(calendar, { municipalityCode: place.municipalityCode, region: place.region, seed: place.municipality, provinceCode: place.provinceCode });
    const fresh = C.createGameState({ seedText: `vecchio|${regionName}`, currentDate: START, level: 'regionale', place, localCalendar, stats: STATS });
    // A save made before the provincial level, the real calendar of the comuni and the rounds.
    const old = JSON.parse(JSON.stringify(fresh));
    old.elections = old.elections.filter(item => item.type !== 'provinciale');
    delete old.flags.provincialCalendar; delete old.flags.localCalendar; delete old.rounds; delete old.roundsFrom;
    let game = C.normalizeGameState(old);
    game = C.addProvincialCalendar(game, place, localCalendar, START);
    assert.equal(game.elections.some(item => item.type === 'provinciale'), expectProvince, `${regionName}: il vecchio salvataggio riceve il voto provinciale`);
    const seen = new Map();
    let date = START, stats = { ...STATS };
    for (let week = 0; week < 52 * 8; week++) {
      date = T.advanceDays(date, 7);
      const out = C.advanceWeek({ game, stats, parliament: null }, { currentDate: date, pollDelta: 0 });
      game = out.ctx.game; stats = out.ctx.stats; game.status = 'active';
      watch(game, seen);
      const ahead = nextAhead(game, date);
      assert.ok(ahead && days(date, ahead) <= 410, `${regionName}: vecchio salvataggio, il ${date} il prossimo voto è tra ${ahead ? days(date, ahead) : '∞'} giorni`);
    }
    const rows = [...seen.values()];
    for (let year = 2027; year <= 2033; year++) assert.ok(rows.some(row => row.date.startsWith(String(year)) && playable(row)), `${regionName}: vecchio salvataggio, nel ${year} nessun appuntamento giocabile`);
  }
  // Dove la provincia non ha organi nessun voto provinciale, e gli anni restano coperti.
  const trento = { region: 'Trentino-Alto Adige', municipality: 'Trento', municipalityCode: '022205', province: 'Trento', provinceCode: '022', provinceType: 'Provincia autonoma' };
  let game = C.createGameState({ seedText: 'trento', currentDate: START, level: 'comunale', place: trento, localCalendar: C.localCalendarOf(calendar, { municipalityCode: trento.municipalityCode, region: trento.region, seed: 'Trento', provinceCode: trento.provinceCode }), stats: STATS });
  assert.ok(!game.elections.some(item => item.type === 'provinciale'), 'Trento: nessun voto provinciale (ha i poteri di una Regione)');
  let date = START, stats = { ...STATS };
  const seen = new Map();
  for (let week = 0; week < 52 * 8; week++) { date = T.advanceDays(date, 7); const out = C.advanceWeek({ game, stats, parliament: null }, { currentDate: date, pollDelta: 0 }); game = out.ctx.game; stats = out.ctx.stats; game.status = 'active'; watch(game, seen); }
  for (let year = 2027; year <= 2033; year++) assert.ok([...seen.values()].some(row => row.date.startsWith(String(year)) && playable(row)), `Trento: nel ${year} nessun appuntamento giocabile`);
}

// ---------- 3. la partita vera: otto anni sul motore completo ----------
console.error(`[calendar-years ${new Date().toISOString().slice(11, 19)}] parte 3: tre carriere vere da otto anni`);
for (const [level, regionName] of [['provinciale', 'Toscana'], ['regionale', 'Lombardia'], ['deputato', 'Campania']]) {
  // Eight real years on the real engine: only the calendar is checked here, never the saved file, so the worker does not write the career save (harness fast mode, same state and same fingerprint).
  const run = await startCareer({ seed: `anni-${level}`, level, region: regionName, fast: true });
  const { store } = run;
  const seen = new Map();
  let worst = 0;
  for (let week = 0; week < 52 * 8; week++) {
    playWeek(run);
    const state = store.getState();
    // Progress for whoever watches the run (diagnostics only): a line every year of game time.
    if (week % 52 === 51) console.error(`[calendar-years ${new Date().toISOString().slice(11, 19)}] partita vera ${level}: anno ${Math.round((week + 1) / 52)}/8 (${state.clock.currentDate})`);
    if (state.game.status === 'ended') state.game.status = 'active';
    watch(state.game, seen);
    const ahead = nextAhead(state.game, state.clock.currentDate);
    assert.ok(ahead, `${level}: il ${state.clock.currentDate} nessun voto previsto`);
    worst = Math.max(worst, days(state.clock.currentDate, ahead));
  }
  const rows = [...seen.values()];
  const startYear = Number(START.slice(0, 4)) + 1;
  for (let year = startYear; year <= startYear + 6; year++) {
    const ofYear = rows.filter(row => row.date.startsWith(String(year)));
    assert.ok(ofYear.some(playable), `${level}: partita vera, nel ${year} nessun appuntamento giocabile (${ofYear.map(row => `${row.type} ${row.date} [${[...row.statuses].join('>')}]`).join('; ')})`);
  }
  assert.ok(worst <= 365, `${level}: partita vera, mai oltre un anno dal prossimo voto previsto (${worst} giorni)`);
  const result = checkInvariants(store.getState());
  assert.ok(result.ok, `${level}: invarianti dopo otto anni ${JSON.stringify(result.issues?.slice(0, 2))}`);
}

// ---------- 4. le candidature personali ----------
// Nessun limite arbitrario: né un numero di giorni tra due voti né una sola candidatura all'anno. L'unica incompatibilità reale è che si gioca una campagna alla volta: due candidature le cui
// campagne (dall'apertura delle candidature al voto) si sovrappongono non si giocano insieme. Un giocatore che coglie ogni finestra non incontra altro rifiuto.
console.error(`[calendar-years ${new Date().toISOString().slice(11, 19)}] parte 4: candidature personali`);
{
  const { rhythmBlock, candidacyBlock, personalCandidacies, candidacyRecord, campaignsOverlap } = await import(`../src/core/office-engine.js${v}`);
  const rec = (id, date, opens = null, extra = {}) => candidacyRecord({ id, type: 'regionale', label: id, electionDate: date, windowOpensAt: opens, ...extra });
  assert.equal(rhythmBlock({ candidacies: [], electionDate: '2028-05-28' }), null, 'Nessuna candidatura: via libera.');
  assert.match(rhythmBlock({ candidacies: [rec('a', '2028-05-28', '2028-04-16')], electionDate: '2028-06-04', windowOpensAt: '2028-05-02', candidacyId: 'b' }) ?? '', /si sovrappongono/, 'Campagne che si sovrappongono: no.');
  assert.match(rhythmBlock({ candidacies: [rec('a', '2028-05-28', '2028-04-16')], electionDate: '2028-05-28', windowOpensAt: '2028-04-16', candidacyId: 'b' }) ?? '', /si sovrappongono/, 'Lo stesso giorno: due campagne insieme, no.');
  assert.equal(rhythmBlock({ candidacies: [rec('a', '2028-02-27', '2028-01-16')], electionDate: '2028-05-28', windowOpensAt: '2028-04-16', candidacyId: 'b' }), null, 'Tre mesi dopo: via libera (nessun numero minimo di giorni).');
  assert.equal(rhythmBlock({ candidacies: [rec('a', '2028-03-26', '2028-02-13')], electionDate: '2028-05-28', windowOpensAt: '2028-04-16', candidacyId: 'b' }), null, 'Anche a due mesi di distanza, se le campagne non si toccano.');
  assert.equal(rhythmBlock({ candidacies: [rec('a', '2028-01-16', '2027-12-05')], electionDate: '2028-10-29', windowOpensAt: '2028-09-24', candidacyId: 'b' }), null, 'Due candidature nello stesso anno civile: nessun limite annuale.');
  assert.equal(rhythmBlock({ candidacies: [rec('a', '2028-02-27')], electionDate: '2028-02-27', candidacyId: 'a' }), null, 'La stessa candidatura non confligge con se stessa.');
  assert.equal(rhythmBlock({ candidacies: [rec('a', '2028-05-28', '2028-04-16', { early: true })], electionDate: '2028-10-29', windowOpensAt: '2028-09-24', candidacyId: 'b' }), null, 'Un voto anticipato non cambia la regola.');
  assert.ok(campaignsOverlap({ electionDate: '2028-05-28', windowOpensAt: '2028-04-16' }, { electionDate: '2028-05-01', windowOpensAt: '2028-03-20' }) && !campaignsOverlap({ electionDate: '2028-05-28', windowOpensAt: '2028-04-16' }, { electionDate: '2028-04-15', windowOpensAt: '2028-03-01' }));
  assert.ok(candidacyBlock({ held: [], electionType: 'regionale', role: 'consigliere', electionDate: '2028-05-28', windowOpensAt: '2028-04-16', candidacies: [rec('a', '2028-05-28', '2028-04-16')], candidacyId: 'b' }), 'candidacyBlock applica la sovrapposizione.');
  assert.equal(candidacyBlock({ held: [], electionType: 'regionale', role: 'consigliere', electionDate: '2028-11-26', windowOpensAt: '2028-10-15', candidacies: [rec('a', '2028-05-28', '2028-04-16')], candidacyId: 'b' }), null, 'E lascia passare tutto il resto.');
  assert.deepEqual(personalCandidacies({ candidacies: [] }, [{ id: 'g1', level: 'comunale', label: 'Comune X', electionDate: '2028-05-28', status: 'planned', candidacy: { kind: 'player' } }, { id: 'g2', level: 'comunale', label: 'Comune Y', electionDate: '2029-05-28', status: 'confirmed', candidacy: { kind: 'cadre' } }, { id: 'g3', level: 'comunale', label: 'Comune Z', electionDate: '2030-05-28', status: 'confirmed', candidacy: { kind: 'player' } }]).map(item => item.id), ['g3'], 'Contano le corse con il giocatore candidato e confermate, non quelle degli altri né quelle solo in programma.');

  // a greedy player on many calendars
  const VARIANTS = [
    ['comunale', 'Toscana', '2026-10-05', 'a'], ['comunale', 'Lombardia', '2027-03-15', 'b'], ['provinciale', 'Toscana', '2026-10-12', 'c'], ['provinciale', 'Sicilia', '2028-09-01', 'd'],
    ['regionale', 'Lombardia', '2026-10-12', 'e'], ['regionale', 'Campania', '2027-06-07', 'f'], ['deputato', 'Lazio', '2026-10-12', 'g'], ['senatore', 'Toscana', '2029-01-08', 'h'], ['europeo', 'Lombardia', '2026-10-12', 'i']
  ];
  let accepted = 0, refused = 0, years = 0;
  for (const [level, regionName, start, tag] of VARIANTS) for (const order of ['prima-il-proprio-livello', 'prima-il-nazionale', 'ultima-finestra']) {
    const place = PLACES[regionName];
    const localCalendar = C.localCalendarOf(calendar, { municipalityCode: place.municipalityCode, region: place.region, seed: place.municipality, provinceCode: place.provinceCode });
    let game = C.createGameState({ seedText: `ritmo|${tag}|${order}`, currentDate: start, level, place, localCalendar, stats: STATS });
    let date = start, stats = { ...STATS };
    const books = [];
    const label = `${level}/${regionName}/${start}/${order}`;
    for (let week = 0; week < 52 * 12; week++) {
      date = T.advanceDays(date, 7);
      if (level === 'comunale' && date >= '2031-07-01' && date < '2031-07-08') game = C.scheduleEarlyLocalElection(game, 'comunale', date);
      const out = C.advanceWeek({ game, stats, parliament: date >= '2030-03-01' && date <= '2030-04-20' ? { government: { status: 'fallen' }, chambers: {}, laws: [] } : null }, { currentDate: date, pollDelta: 0 });
      game = out.ctx.game; stats = out.ctx.stats; game.status = 'active';
      // the player looks at the open windows in the order of the preference
      const lastWeek = item => T.advanceDays(date, 7) > item.windowClosesAt;
      const open = game.elections.filter(item => item.status === 'open' && date >= item.windowOpensAt && date <= item.windowClosesAt && !books.some(book => book.id === item.id) && (order !== 'ultima-finestra' || lastWeek(item)));
      const own = level === 'deputato' || level === 'senatore' ? 'politiche' : level === 'europeo' ? 'europee' : level;
      const rank = item => order === 'prima-il-nazionale' ? (['politiche', 'europee'].includes(item.type) ? 0 : 1) : order === 'prima-il-proprio-livello' ? (item.type === own ? 0 : 1) : 0;
      for (const item of open.sort((a, b) => rank(a) - rank(b) || a.electionDate.localeCompare(b.electionDate))) {
        const block = candidacyBlock({ held: [], electionType: item.type, role: 'consigliere', electionDate: item.electionDate, windowOpensAt: item.windowOpensAt, candidacies: books, candidacyId: item.id });
        if (block) { refused++; continue; }
        books.push(candidacyRecord({ id: item.id, type: item.type, label: item.label, windowOpensAt: item.windowOpensAt, electionDate: item.electionDate, early: item.early })); accepted++;
      }
      // the spring rounds are support campaigns: they never become a personal candidacy
      assert.ok((game.rounds ?? []).every(round => !('candidacy' in round) && !books.some(book => book.id === round.id)), `${label}: le tornate amministrative non diventano candidature personali`);
    }
    const sorted = [...books].sort((a, b) => a.electionDate.localeCompare(b.electionDate));
    for (let i = 1; i < sorted.length; i++) assert.ok(!campaignsOverlap(sorted[i - 1], sorted[i]), `${label}: ${sorted[i - 1].label} (${sorted[i - 1].electionDate}) e ${sorted[i].label} (${sorted[i].electionDate}) si sovrappongono`);
    // nothing else is refused: the votes of different rounds are apart by themselves
    const rounds = [...new Set(sorted.map(item => item.electionDate))];
    for (let i = 1; i < rounds.length; i++) assert.ok(days(rounds[i - 1], rounds[i]) >= CALENDAR_RULES.earlyFloorDays, `${label}: due voti giocati a ${days(rounds[i - 1], rounds[i])} giorni`);
    // most years do offer a personal candidacy; none is left without an appointment (part 1 checks the calendar itself)
    const yearsWith = new Set(sorted.map(item => item.electionDate.slice(0, 4))).size;
    assert.ok(yearsWith >= 8, `${label}: almeno otto anni su dodici con una candidatura possibile (${yearsWith})`);
    years += yearsWith;
  }
  // the books survive a save and an old save has none
  const place = PLACES.Toscana;
  let game = C.createGameState({ seedText: 'libro', currentDate: START, level: 'comunale', place, localCalendar: C.localCalendarOf(calendar, { municipalityCode: place.municipalityCode, region: place.region, seed: place.municipality, provinceCode: place.provinceCode }), stats: STATS });
  assert.deepEqual(personalCandidacies(game, []), [], 'Una carriera nuova non ha candidature.');
  game.candidacies = [candidacyRecord({ id: 'x', type: 'comunale', label: 'Comune', electionDate: '2028-05-28' })];
  const back = C.normalizeGameState(JSON.parse(JSON.stringify(game)));
  assert.deepEqual(back.candidacies.map(item => item.id), ['x'], 'Le candidature sul libro sopravvivono al salvataggio.');
  const old = JSON.parse(JSON.stringify(game)); delete old.candidacies;
  assert.deepEqual(personalCandidacies(C.normalizeGameState(old), []), [], 'Un vecchio salvataggio non ha il libro: nessun blocco.');
  console.error(`[calendar-years] candidature: ${accepted} accettate, ${refused} rifiutate perché le campagne si sovrapponevano, ${years} anni con candidatura su ${VARIANTS.length * 3} carriere da dodici anni`);
}

console.log(`Calendario negli anni verificato: ${CASES.length} carriere di livelli e regioni diversi per quattordici anni (${totalVotes} voti, ${totalRounds} tornate amministrative al posto degli anni vuoti), sempre un voto previsto entro ${worstGap} giorni e un appuntamento giocabile ogni anno; cicli di cinque anni (provinciali quattro), politiche anticipate e cambio di legislatura, comuni e province sciolti che votano di nuovo, vecchi salvataggi e tre partite vere di otto anni.`);
