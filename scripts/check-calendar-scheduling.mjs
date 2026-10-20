// Il calendario elettorale, in breve e senza eccezioni. Due regole insieme, verificate a ogni settimana di carriere brevi di ogni livello e su calendari costruiti a mano:
//  1. tra due tornate distinte passano almeno 180 giorni (voti dello stesso giorno = una sola tornata), per ogni coppia: nessun passo ridotto, nessuna deroga per voti anticipati o
//     nazionali, nessun voto segnato a distanza ridotta;
//  2. in ogni anno solare c'è almeno una tornata giocabile e tra due voti giocabili passano al massimo 364 giorni.
// Le politiche ordinarie si riprogrammano nella loro finestra costituzionale; un calendario che non si riesce a sistemare è dichiarato (calendarConflict), mai accettato abbassando la soglia.
// Motore puro, nessun browser.
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
const { CALENDAR_RULES, harmonizeElections, distinctRounds } = await import(`../src/core/calendar-planner.js${v}`);
const { ELECTION_MODELS } = await import(`../src/data/simulation/campaign-rules.js${v}`);
const { ELECTION_SCHEDULE } = await import(`../src/data/simulation/career-rules.js${v}`);

const days = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
const sunday = date => new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
const sun = date => T.advanceDays(date, -new Date(`${date}T12:00:00Z`).getUTCDay());

// ---------- 0. the rule is one number ----------
assert.equal(CALENDAR_RULES.minGapDays, 180, 'La distanza è di 180 giorni.');
assert.ok(Object.isFrozen(CALENDAR_RULES) && !('earlyFloorDays' in CALENDAR_RULES), 'Nessuna soglia ridotta, nessun gradino sotto i 180 giorni.');
assert.ok(CALENDAR_RULES.flex.politiche, 'Le politiche ordinarie sono tra i voti che si possono riprogrammare.');
assert.ok(CALENDAR_RULES.flex.politiche[1] <= 70 + 16, 'Restano dentro i settanta giorni dalla fine delle Camere (art. 61 Cost.).');
assert.equal(CALENDAR_RULES.maxPlayableGapDays, 364, 'Al massimo 364 giorni tra due voti giocabili: nessun anno solare resta vuoto.');

// ---------- 1. calendars made by hand ----------
const entry = (type, vote0, extra = {}) => {
  const vote = sun(vote0);
  const opens = T.advanceDays(vote, -ELECTION_MODELS[type].campaignDays);
  return { id: `elezione-${type}-${opens}`, type, label: type, windowOpensAt: opens, windowClosesAt: T.advanceDays(opens, ELECTION_SCHEDULE[type].windowDays), electionDate: vote, status: 'upcoming', campaignId: null, early: false, ...extra };
};
const planned = game => game.elections.filter(item => item.status !== 'held').map(item => item.electionDate);
const keeps = (dates, min = CALENDAR_RULES.minGapDays) => { const list = distinctRounds(dates); return !list.closest || list.closest.days >= min; };

{ // the case that used to be accepted at 175 days: a provincial vote between the European and the general election
  const game = { elections: [entry('europee', '2039-06-05'), entry('politiche', '2040-05-27'), entry('provinciale', '2039-11-26')], rounds: [] };
  harmonizeElections(game, '2039-01-10');
  assert.ok(game.elections.every(item => !item.calendarConflict), 'Il calendario si sistema senza dichiarare conflitti.');
  assert.ok(keeps(planned(game)), `Tutte le tornate a 180 giorni almeno (${planned(game).join(', ')}).`);
  const politiche = game.elections.find(item => item.type === 'politiche');
  assert.ok(politiche.electionDate > sun('2040-05-27') && days(sun('2040-05-27'), politiche.electionDate) <= CALENDAR_RULES.flex.politiche[1], 'Le politiche ordinarie si spostano, dentro la loro finestra.');
  assert.ok(sunday(politiche.electionDate) && politiche.windowOpensAt < politiche.windowClosesAt && politiche.windowClosesAt <= politiche.electionDate, 'Domenica e finestra coerenti.');
  assert.ok(game.elections.every(item => !('shortGap' in item)), 'Nessun voto segnato a distanza ridotta.');
  const again = JSON.stringify(game.elections); harmonizeElections(game, '2039-01-10');
  assert.equal(JSON.stringify(game.elections), again, 'Riarmonizzare non cambia nulla.');
}
{ // the ordinary general election never leaves its window
  for (const base of ['2027-09-26', '2032-05-30', '2038-03-06']) {
    const game = { elections: [entry('politiche', base), entry('regionale', T.advanceDays(base, 150)), entry('provinciale', T.advanceDays(base, -100))], rounds: [] };
    harmonizeElections(game, T.advanceDays(base, -400));
    const moved = game.elections.find(item => item.type === 'politiche');
    const shift = days(sun(base), moved.electionDate);
    assert.ok(shift >= -CALENDAR_RULES.flex.politiche[0] && shift <= CALENDAR_RULES.flex.politiche[1], `${base}: politiche spostate di ${shift} giorni, dentro la finestra`);
    assert.ok(game.elections.every(item => !item.calendarConflict) && keeps(planned(game)), `${base}: 180 giorni rispettati (${planned(game).join(', ')})`);
  }
}
{ // an early vote waits for the first date that fits, or joins the round of the vote it is close to
  const base = [entry('europee', '2034-06-10'), entry('regionale', '2034-10-15')];
  for (const day of ['2033-12-01', '2034-01-20', '2034-03-30', '2034-04-25', '2034-05-20']) {
    const earlyDate = sun(T.advanceDays(day, 7 + ELECTION_MODELS.politiche.campaignDays + 6));
    const game = { elections: [...base.map(item => ({ ...item })), entry('politiche', earlyDate, { early: true, earliest: earlyDate, baseDate: earlyDate })], rounds: [] };
    harmonizeElections(game, day);
    const dates = planned(game);
    assert.ok(game.elections.every(item => !item.calendarConflict), `Politiche anticipate dal ${day}: nessun conflitto (${dates.join(', ')})`);
    assert.ok(keeps(dates), `Politiche anticipate dal ${day}: 180 giorni rispettati (${dates.join(', ')})`);
    const early = game.elections.find(item => item.early);
    assert.ok(early.electionDate >= earlyDate && days(earlyDate, early.electionDate) <= CALENDAR_RULES.earlyAfter.politiche, `Politiche anticipate dal ${day}: mai prima del primo giorno possibile né oltre l'attesa massima`);
  }
}
{ // what cannot be placed is declared and not accepted by lowering the distance
  const game = { elections: [entry('regionale', '2030-05-12', { status: 'held' }), entry('europee', '2030-08-25', { status: 'held' }), entry('provinciale', '2030-06-30')], rounds: [] };
  harmonizeElections(game, '2030-01-10');
  const provincial = game.elections.find(item => item.type === 'provinciale');
  assert.equal(provincial.calendarConflict, true, 'Una combinazione impossibile è dichiarata (calendarConflict).');
  assert.ok(!('shortGap' in provincial), 'E non diventa una distanza ridotta.');
}

// ---------- 2. short careers of every level, checked every week ----------
const STATS = { popularity: 50, reputation: 50, notoriety: 30, influence: 30, consensus: 5, experience: 20 };
const PLACES = {
  Toscana: { region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', province: 'Siena', provinceCode: '052', provinceType: 'Provincia' },
  Lombardia: { region: 'Lombardia', municipality: 'Bergamo', municipalityCode: '016024', province: 'Bergamo', provinceCode: '016', provinceType: 'Provincia' },
  Campania: { region: 'Campania', municipality: 'Salerno', municipalityCode: '065116', province: 'Salerno', provinceCode: '065', provinceType: 'Provincia' },
  Sicilia: { region: 'Sicilia', municipality: 'Ragusa', municipalityCode: '088009', province: 'Ragusa', provinceCode: '088', provinceType: 'Libero consorzio di comuni' }
};
const LEVELS = ['comunale', 'provinciale', 'regionale', 'deputato', 'senatore', 'europeo'];
const STARTS = ['2026-10-12', '2027-03-08', '2027-09-20', '2028-01-10', '2029-02-05', '2030-11-04'];
const problems = [];
let runs = 0, weeks = 0, planChecks = 0, closest = 9999, roundsSeen = 0;
for (const [index, level] of LEVELS.entries()) for (const [k, start] of STARTS.entries()) {
  const regionName = Object.keys(PLACES)[(index + k) % 4];
  const place = PLACES[regionName];
  const label = `${level}/${regionName}/${start}`;
  const localCalendar = C.localCalendarOf(calendar, { municipalityCode: place.municipalityCode, region: place.region, seed: place.municipality, provinceCode: place.provinceCode });
  let game = C.createGameState({ seedText: `sched|${label}`, currentDate: start, level, place, localCalendar, stats: STATS });
  let date = start, stats = { ...STATS };
  const all = new Map();
  for (let week = 0; week < 130; week++) {
    // a government falls once, in a different season for each run: the early general election has to find its date
    const fall = date >= T.advanceDays(start, 200 + 37 * k) && date < T.advanceDays(start, 200 + 37 * k + 42);
    date = T.advanceDays(date, 7);
    const out = C.advanceWeek({ game, stats, parliament: fall ? { government: { status: 'fallen' }, chambers: {}, laws: [] } : null }, { currentDate: date, pollDelta: 0 });
    game = out.ctx.game; stats = out.ctx.stats; game.status = 'active';
    weeks++;
    for (const item of game.elections) all.set(item.id, { date: item.electionDate, type: item.type, early: item.early, held: item.status === 'held', status: item.status });
    for (const item of game.rounds ?? []) all.set(item.id, { date: item.electionDate, type: 'tornata', held: item.status === 'held', status: item.status });
    // the plan as it stands today: every vote still to come (and the last one held), pairwise 180 days apart, never more than 364 between two
    const ahead = [...game.elections.filter(item => item.status !== 'held'), ...(game.rounds ?? []).filter(item => item.status !== 'held')].map(item => item.electionDate);
    const lastHeld = [...game.elections, ...(game.rounds ?? [])].filter(item => item.status === 'held' && item.electionDate <= date).map(item => item.electionDate).sort().at(-1);
    const chain = [...new Set([...(lastHeld ? [lastHeld] : []), ...ahead])].sort();
    for (let i = 1; i < chain.length; i++) {
      const gap = days(chain[i - 1], chain[i]);
      if (gap < CALENDAR_RULES.minGapDays) problems.push(`${label} @${date}: tornate a ${gap} giorni (${chain[i - 1]} e ${chain[i]})`);
      if (chain[i - 1] >= date && chain[i - 1] < T.advanceDays(date, 400) && gap > CALENDAR_RULES.maxPlayableGapDays) problems.push(`${label} @${date}: ${gap} giorni tra ${chain[i - 1]} e ${chain[i]}`);
      closest = Math.min(closest, gap);
    }
    if (ahead.length && days(date, ahead.sort()[0]) > CALENDAR_RULES.maxPlayableGapDays) problems.push(`${label} @${date}: il prossimo voto è tra più di ${CALENDAR_RULES.maxPlayableGapDays} giorni`);
    if (!ahead.length) problems.push(`${label} @${date}: nessun voto in programma`);
    for (const item of game.elections) {
      if (item.calendarConflict) problems.push(`${label} @${date}: conflitto dichiarato per ${item.type} ${item.electionDate}`);
      if ('shortGap' in item) problems.push(`${label} @${date}: ${item.type} segnato a distanza ridotta`);
      // after every rescheduling the entry still tells the truth: the window of the candidacies opens the campaign's length before the vote and closes when the schedule says
      if (item.status === 'upcoming' && ELECTION_MODELS[item.type]) {
        if (item.windowOpensAt !== T.advanceDays(item.electionDate, -ELECTION_MODELS[item.type].campaignDays)) problems.push(`${label} @${date}: ${item.type} ${item.electionDate} con la finestra aperta il ${item.windowOpensAt}`);
        if (item.windowClosesAt !== T.advanceDays(item.windowOpensAt, ELECTION_SCHEDULE[item.type].windowDays)) problems.push(`${label} @${date}: ${item.type} con la finestra chiusa il ${item.windowClosesAt}`);
        if (item.windowClosesAt > item.electionDate) problems.push(`${label} @${date}: ${item.type} con le candidature chiuse dopo il voto`);
      }
      if (game.elections.filter(other => other.type === item.type && other.electionDate === item.electionDate && other.status !== 'held').length > 1) problems.push(`${label} @${date}: due ${item.type} lo stesso giorno (${item.electionDate})`);
      if (item.status === 'upcoming' && !sunday(item.electionDate) && item.type !== 'europee') problems.push(`${label} @${date}: ${item.type} non cade di domenica (${item.electionDate})`);
    }
    planChecks++;
  }
  // every calendar year after the first holds a vote that was played, or one that is still ahead
  const years = new Set([...all.values()].filter(row => row.status !== 'upcoming' || row.date >= date).map(row => row.date.slice(0, 4)));
  for (let year = Number(start.slice(0, 4)) + 1; year <= Number(date.slice(0, 4)); year++) if (!years.has(String(year))) problems.push(`${label}: nel ${year} nessuna tornata`);
  roundsSeen += [...all.values()].filter(row => row.type === 'tornata').length;
  runs++;
}

// ---------- dissolution: the country does not wait months for a vote because of the calendar ----------
{
  const { dissolutionWait } = C;
  let checked = 0, held = 0, blocked = 0;
  for (const level of ['deputato', 'regionale', 'provinciale', 'comunale']) {
    const base = C.createGameState({ seedText: `scioglimento-${level}`, currentDate: '2026-10-19', level, party: null, place: { region: 'Toscana', municipality: 'Siena', province: 'Siena' } });
    for (let offset = 0; offset < 800; offset += 7) {
      const date = T.advanceDays('2026-10-19', offset);
      const game = structuredClone(base);
      for (const item of game.elections) if (item.electionDate < date) item.status = 'held';
      const wait = dissolutionWait(game, date);
      if (wait === null) continue;
      checked++;
      // a vote already under way or held less than 180 days ago keeps the next round at a distance: only then may the wait be longer
      const anchors = game.elections.filter(item => item.type !== 'politiche' && item.windowOpensAt <= date && item.electionDate >= T.advanceDays(date, -CALENDAR_RULES.minGapDays)).map(item => item.electionDate).sort();
      if (!anchors.length) {
        if (wait > CALENDAR_RULES.dissolveWithinDays) {
        // the Chambers are not dissolved into a wait this long (the store goes on with the consultations): the block must pass, and a vote within the limit must become possible in a few months
        blocked++;
        let later = null;
        for (let step = 1; step <= 30 && later === null; step++) {
          const day = T.advanceDays(date, step * 7);
          const next = structuredClone(base);
          for (const item of next.elections) if (item.electionDate < day) item.status = 'held';
          const found = dissolutionWait(next, day);
          if (found !== null && found <= CALENDAR_RULES.dissolveWithinDays) later = step;
        }
        assert.ok(later !== null, `${level} ${date}: nessun voto vicino ma lo scioglimento resterebbe bloccato per oltre 30 settimane (attesa ${wait} giorni).`);
        }
      } else {
        held++;
        const reach = days(date, T.advanceDays(anchors.at(-1), CALENDAR_RULES.minGapDays + CALENDAR_RULES.earlyPoliticheFirst + 7));
        assert.ok(wait <= Math.max(reach, CALENDAR_RULES.dissolveWithinDays), `${level} ${date}: con un voto vicino (${anchors.at(-1)}) l'attesa è ${wait} giorni, oltre il necessario (${reach}).`);
      }
      // when the Chambers are dissolved (the wait is within the limit) the date found never breaks the distance either
      if (!(wait <= CALENDAR_RULES.dissolveWithinDays)) continue;
      const copy = C.scheduleEarlyElection(game, date);
      harmonizeElections(copy, date);
      assert.ok(!copy.elections.some(item => item.calendarConflict), `${level} ${date}: lo scioglimento lascia un conflitto di calendario.`);
      const rounds = distinctRounds(copy.elections.map(item => item.electionDate)).closest;
      assert.ok(!rounds || rounds.days >= CALENDAR_RULES.minGapDays, `${level} ${date}: dopo lo scioglimento due tornate a ${rounds?.days} giorni.`);
    }
  }
  assert.ok(checked > 100, 'Lo scioglimento è provato su molte date e livelli.');
  console.log(`Scioglimento: ${checked} date provate in quattro livelli, ${held} con un voto vicino che può allungare l’attesa, le altre entro ${CALENDAR_RULES.dissolveWithinDays} giorni (${blocked} con attesa più lunga: le Camere non si sciolgono e la finestra si apre entro 30 settimane).`);
}

if (problems.length) {
  const byRun = new Map();
  for (const problem of problems) { const key = problem.split(' ')[0].replace(/:$/, ''); const list = byRun.get(key) ?? []; list.push(problem); byRun.set(key, list); }
  console.error(`Calendario: ${problems.length} problemi in ${byRun.size} carriere.`);
  for (const [key, list] of byRun) console.error(`${key}: ${list.length} segnalazioni, la prima: ${list[0]}`);
  process.exit(1);
}
console.log(`Calendario verificato: 180 giorni tra tornate distinte e un voto giocabile in ogni anno solare, senza soglie ridotte né deroghe; ${runs} carriere di sei livelli e partenze diverse (${weeks} settimane, ${planChecks} calendari controllati, la distanza minima trovata è ${closest} giorni), caduta del governo inclusa, politiche ordinarie riprogrammabili nella finestra costituzionale, combinazioni impossibili dichiarate. ${roundsSeen} tornate amministrative usate come riempitivo.`);
