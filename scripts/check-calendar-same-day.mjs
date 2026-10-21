// Il calendario non fa più cadere due elezioni distinte lo stesso giorno (prima «stesso giorno = una sola tornata»). Caso riprodotto: carriera a Tassarolo (AL, Piemonte), 10 giugno 2029:
// Regionali del Piemonte, Europee e Comunali sulla stessa data. Qui: la stessa carriera su più anni, partenze diverse, un salvataggio vecchio che ha già due voti nello stesso giorno, le politiche
// anticipate; ogni sovrapposizione è rifiutata o dichiarata (coincides), mai silenziosa, e in ogni anno solare resta un voto da giocare.
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
const { CALENDAR_RULES, harmonizeElections, daysApart, keepsDistance, distinctRounds } = await import(`../src/core/calendar-planner.js${v}`);
const { ELECTION_MODELS } = await import(`../src/data/simulation/campaign-rules.js${v}`);
const { ELECTION_SCHEDULE } = await import(`../src/data/simulation/career-rules.js${v}`);

// the rule itself
assert.equal(keepsDistance('2029-06-10', ['2029-06-10']), false, 'Lo stesso giorno non è ammesso.');
assert.equal(keepsDistance('2029-06-10', ['2028-12-12']), true, '180 giorni sì.');
assert.equal(distinctRounds(['2029-06-10', '2029-06-10', '2030-01-01']).closest.days, 0, 'Due voti lo stesso giorno sono a distanza zero.');

const STATS = { popularity: 50, reputation: 50, notoriety: 30, influence: 30, consensus: 5, experience: 20 };
const place = { region: 'Piemonte', municipality: 'Tassarolo', municipalityCode: '006170', province: 'Alessandria', provinceCode: '006', provinceType: 'Provincia' };
const localCalendar = C.localCalendarOf(calendar, { municipalityCode: '006170', region: 'Piemonte', seed: 'Tassarolo', provinceCode: '006' });
const run = (level, start, { years = 9, fall = null } = {}) => {
  let game = C.createGameState({ seedText: `stesso-giorno|${level}|${start}`, currentDate: start, level, place, localCalendar, stats: STATS });
  let date = start, stats = { ...STATS };
  const seen = new Map(), coincidences = [];
  for (let week = 0; week < 52 * years; week++) {
    date = T.advanceDays(date, 7);
    const parliament = fall && date >= fall[0] && date <= fall[1] ? { government: { status: 'fallen' }, chambers: {}, laws: [] } : null;
    const out = C.advanceWeek({ game, stats, parliament }, { currentDate: date, pollDelta: 0 });
    game = out.ctx.game; stats = out.ctx.stats; game.status = 'active';
    const upcoming = game.elections.filter(item => item.status !== 'held');
    const byDay = new Map();
    for (const item of upcoming) byDay.set(item.electionDate, [...(byDay.get(item.electionDate) ?? []), item]);
    for (const [day, list] of byDay) if (list.length > 1 && !list.some(item => item.coincides)) assert.fail(`${level}/${start} @${date}: ${list.map(item => item.type).join(' + ')} lo stesso giorno ${day}, senza dichiarazione.`);
    for (const item of game.elections) { seen.set(item.id, item); if (item.coincides) coincidences.push(`${item.type}:${item.electionDate}`); assert.ok(!item.calendarConflict, `${level}/${start} @${date}: conflitto dichiarato per ${item.type}.`); }
    for (const round of game.rounds ?? []) assert.ok(!upcoming.some(item => item.electionDate === round.electionDate && round.status === 'upcoming'), `${level}/${start} @${date}: una tornata amministrativa coincide con un’elezione (${round.electionDate}).`);
  }
  const days = [...seen.values()].filter(item => item.status === 'held').map(item => item.electionDate).sort();
  const years_ = new Set([...days, ...(game.rounds ?? []).filter(item => item.status === 'held').map(item => item.electionDate)].map(day => day.slice(0, 4)));
  return { game, days, years: years_, coincidences: [...new Set(coincidences)], seen };
};

// 1. the reported case: Tassarolo, 2029 (Regionali Piemonte, Europee, Comunali) now on three different days, 180 days apart
{
  const { seen, years } = run('comunale', '2026-10-12');
  const of2029 = [...seen.values()].filter(item => item.electionDate.startsWith('2029') || item.electionDate.startsWith('2030')).filter(item => ['regionale', 'europee', 'comunale'].includes(item.type));
  const days = of2029.map(item => item.electionDate);
  assert.equal(new Set(days).size, days.length, `Regionali, Europee e Comunali su giorni diversi (${of2029.map(item => `${item.type} ${item.electionDate}`).join(', ')}).`);
  assert.ok(of2029.some(item => item.type === 'europee' && item.electionDate === '2029-06-10'), 'Le Europee restano il 10 giugno 2029 (data fissata).');
  const sorted = [...days].sort();
  for (let i = 1; i < sorted.length; i++) assert.ok(daysApart(sorted[i - 1], sorted[i]) >= CALENDAR_RULES.minGapDays, `${sorted[i - 1]} → ${sorted[i]}: almeno 180 giorni.`);
  assert.ok(of2029.filter(item => item.deferred).every(item => /Rinviata/.test(item.deferralReason)), 'I rinvii sono dichiarati (deferred + motivo).');
  for (let year = 2027; year <= 2034; year++) assert.ok(years.has(String(year)), `Nel ${year} c’è almeno un voto giocato o in programma.`);
}
// 2. several starts and levels, more consecutive years, with an early general election
for (const [level, start, fall] of [['regionale', '2027-03-08', null], ['deputato', '2028-01-10', ['2029-03-01', '2029-04-20']], ['provinciale', '2029-02-05', null], ['europeo', '2026-10-12', ['2030-03-01', '2030-04-20']]]) {
  const { years, coincidences } = run(level, start, { years: 8, fall });
  const first = Number(start.slice(0, 4)) + 1;
  for (let year = first; year < first + 6; year++) assert.ok(years.has(String(year)), `${level}/${start}: nel ${year} nessuna tornata.`);
  void coincidences;
}
// 3. a save from before the rule: two votes of the player's calendar on the same day that are still to come are separated (the ones already open are never moved)
{
  const entry = (type, vote) => { const opens = T.advanceDays(vote, -ELECTION_MODELS[type].campaignDays); return { id: `elezione-${type}-${opens}`, type, label: type, windowOpensAt: opens, windowClosesAt: T.advanceDays(opens, ELECTION_SCHEDULE[type].windowDays), electionDate: vote, status: 'upcoming', early: false }; };
  const old = { elections: [entry('europee', '2034-06-04'), entry('regionale', '2034-06-04'), entry('comunale', '2034-06-04')], rounds: [] };
  harmonizeElections(old, '2033-10-10');
  const days = old.elections.map(item => item.electionDate);
  assert.equal(new Set(days).size, 3, `Un salvataggio con tre voti nello stesso giorno li separa (${days.join(', ')}).`);
  assert.ok(old.elections.every(item => !item.calendarConflict));
  const frozen = JSON.stringify(old.elections); harmonizeElections(old, '2033-10-10');
  assert.equal(JSON.stringify(old.elections), frozen, 'Riarmonizzare non cambia nulla.');
  const open = { elections: [{ ...entry('europee', '2034-06-04'), status: 'open', windowOpensAt: '2034-04-23' }, entry('regionale', '2034-06-04')], rounds: [] };
  harmonizeElections(open, '2034-05-01');
  assert.equal(open.elections[0].electionDate, '2034-06-04', 'Un voto già aperto non si sposta.');
}
console.log('Calendario senza sovrapposizioni verificato: due elezioni distinte mai lo stesso giorno e sempre a 180 giorni (Tassarolo 2029: Regionali, Europee e Comunali separate, rinvii dichiarati), anche con partenze diverse, otto anni, politiche anticipate e un salvataggio vecchio; un voto giocabile in ogni anno solare.');
