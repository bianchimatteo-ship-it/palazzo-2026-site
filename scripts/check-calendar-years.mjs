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
  for (const entry of game.elections) { const row = seen.get(entry.id) ?? { id: entry.id, kind: 'voto', type: entry.type, date: entry.electionDate, early: Boolean(entry.early), statuses: new Set() }; row.date = entry.electionDate; row.early = row.early || Boolean(entry.early); row.statuses.add(entry.status); seen.set(entry.id, row); }
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
    assert.ok(gap <= 410, `${label}: il ${date} il prossimo voto previsto è tra ${gap} giorni`);
  }
  const rows = [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (let year = 2027; year <= 2039; year++) {
    const ofYear = rows.filter(row => row.date.startsWith(String(year)));
    assert.ok(ofYear.length > 0, `${label}: nessun voto nel ${year}`);
    assert.ok(ofYear.some(playable), `${label}: nel ${year} nessun appuntamento giocabile (${ofYear.map(row => `${row.type} ${row.date} [${[...row.statuses].join('>')}]`).join('; ')})`);
  }
  totalRounds += rows.filter(row => row.kind === 'tornata').length;
  totalVotes += rows.filter(row => row.kind === 'voto' && row.statuses.has('held')).length;
  // Every kind of vote keeps its own cycle: comuni and regions five years, provinces four, Europe five; early votes are shorter.
  const cycle = { comunale: [4.8, 5.15], provinciale: [3.8, 4.15], regionale: [4.8, 5.15], politiche: [0.4, 5.15], europee: [4.8, 5.15] };
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
for (const [level, regionName] of [['provinciale', 'Toscana'], ['regionale', 'Lombardia'], ['deputato', 'Campania']]) {
  const run = await startCareer({ seed: `anni-${level}`, level, region: regionName });
  const { store } = run;
  const seen = new Map();
  let worst = 0;
  for (let week = 0; week < 52 * 8; week++) {
    playWeek(run);
    const state = store.getState();
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
  assert.ok(worst <= 410, `${level}: partita vera, mai oltre tredici mesi dal prossimo voto previsto (${worst} giorni)`);
  const result = checkInvariants(store.getState());
  assert.ok(result.ok, `${level}: invarianti dopo otto anni ${JSON.stringify(result.issues?.slice(0, 2))}`);
}

console.log(`Calendario negli anni verificato: ${CASES.length} carriere di livelli e regioni diversi per quattordici anni (${totalVotes} voti, ${totalRounds} tornate amministrative al posto degli anni vuoti), sempre un voto previsto entro ${worstGap} giorni e un appuntamento giocabile ogni anno; cicli di cinque anni (provinciali quattro), politiche anticipate e cambio di legislatura, comuni e province sciolti che votano di nuovo, vecchi salvataggi e tre partite vere di otto anni.`);
