// The calendar of the country: five-year mandates, but comuni and regions vote in different years (the real date of
// their last vote, Eligendo), the law of the spring round for the comuni, a career whose local votes follow its place,
// regional and municipal votes somewhere in the country every year, early votes when a regional government falls.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const realData = await import(`../src/data/repositories/real-data.js${v}`);
const links = await import(`../src/data/repositories/party-links.js${v}`);
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'coalitions', 'twoPerThousand', 'realPolls', 'parliamentaryGroups']);
const calendar = await realData.loadRealDocument('localElections');
const geography = await realData.loadRealDocument('electoralGeography');
const db = realData.realDatabase;
const T = await import(`../src/core/time.js${v}`);
const C = await import(`../src/core/career-engine.js${v}`);
const W = await import(`../src/core/world-engine.js${v}`);
const { store } = await import(`../src/core/store.js${v}`);

// ---------- 1. the real data and the rules ----------
assert.equal(calendar.source, 'real');
assert.ok(calendar.verified && /eligendo/.test(calendar.sourceUrl) && calendar.regions.length === 20, 'Calendario reale con fonte ufficiale e tutte le regioni.');
const lastOf = code => Object.entries(calendar.municipalities).find(([, codes]) => codes.includes(code))?.[0] ?? null;
assert.equal(lastOf('048017'), '2024-06-09', 'Firenze ha votato il 9 giugno 2024 (Eligendo).');
assert.equal(lastOf('058091'), '2021-10-03', 'Roma ha votato il 3-4 ottobre 2021 (Eligendo).');
assert.equal(calendar.regions.find(item => item.region === 'Toscana').lastElection, '2025-10-12');
assert.equal(calendar.regions.find(item => item.region === 'Lombardia').lastElection, '2023-02-12');
// Law 182/1991: a mandate ending in the first half of the year → spring round of that year; in the second half → next year.
assert.equal(T.nextMunicipalVote('2024-06-09', '2026-10-01'), '2029-05-27', 'Firenze: turno di primavera del 2029.');
assert.equal(T.nextMunicipalVote('2021-10-03', '2026-10-01'), '2027-05-30', 'Roma: mandato che scade in autunno, turno di primavera dell’anno dopo (2027).');
assert.equal(T.nextRegionalVote('2025-10-12', '2026-10-01'), '2030-10-27', 'Toscana: cinque anni dopo.');
for (const date of [T.nextMunicipalVote('2024-06-09', '2026-10-01'), T.nextRegionalVote('2023-02-12', '2026-10-01')]) assert.equal(new Date(`${date}T12:00:00Z`).getUTCDay(), 0, 'Si vota di domenica.');
// Not everything in the same year.
const regionalYears = new Set(calendar.regions.map(item => T.nextRegionalVote(item.lastElection, '2026-10-01').slice(0, 4)));
assert.ok(regionalYears.size >= 4, `Le regionali sono sfalsate negli anni (${[...regionalYears].sort().join(', ')}).`);
const municipalYears = new Set(Object.keys(calendar.municipalities).map(date => T.nextMunicipalVote(date, '2026-10-01').slice(0, 4)));
assert.ok(municipalYears.size >= 4, `Le comunali sono sfalsate negli anni (${[...municipalYears].sort().join(', ')}).`);

// ---------- 2. a career in Firenze ----------
const local = C.localCalendarOf(calendar, { municipalityCode: '048017', region: 'Toscana' });
assert.ok(local.comunaleReal && local.regionaleReal && local.comunale === '2024-06-09' && local.regionale === '2025-10-12');
const game = C.createGameState({ seedText: 'firenze', currentDate: '2026-09-26', level: 'comunale', place: { region: 'Toscana', municipality: 'Firenze' }, localCalendar: local });
const dateOf = type => game.elections.find(item => item.type === type).electionDate;
assert.equal(dateOf('comunale'), '2029-05-27', 'Le comunali di Firenze nel 2029.');
assert.equal(dateOf('regionale'), '2030-10-27', 'Le regionali toscane nel 2030.');
assert.equal(dateOf('politiche'), '2027-09-26', 'Le politiche alla fine della legislatura.');
assert.ok(new Set(game.elections.map(item => item.electionDate.slice(0, 4))).size >= 3, 'Le elezioni della carriera cadono in anni diversi.');
// A comune not in the archives (a region that runs its own municipal votes) gets a simulated year, declared as such.
const sicily = C.localCalendarOf(calendar, { municipalityCode: '082053', region: 'Sicilia', seed: 'palermo' });
assert.ok(!sicily.comunaleReal && /^202[1-5]-05-30$/.test(sicily.comunale) && sicily.regionaleReal, 'Palermo: anno di voto simulato dichiarato; la regione ha la data reale.');
// After a vote, the next one five years later.
const held = C.markElectionHeld({ ...game, elections: game.elections.map(item => item.type === 'comunale' ? { ...item, status: 'running', campaignId: 'c1' } : item) }, 'c1', { share: 40 });
assert.ok(held.elections.some(item => item.type === 'comunale' && item.status === 'upcoming' && item.electionDate === '2034-05-28'), 'Dopo il voto, il prossimo tra cinque anni.');

// ---------- 3. the store: an existing career moves to the real calendar; the country votes every year ----------
store.setRealReference({ twoPerThousand: db.twoPerThousand, parties: db.parties, movements: db.politicalMovements, coalitions: db.coalitions, polls: db.realPolls, governingIds: links.governingEntityIds(db), startDate: db.manifest.snapshotDate });
store.createCareer({ firstName: 'Carla', lastName: 'Calendario', birthDate: '1980-01-01', gender: 'donna', region: 'Toscana', municipality: 'Firenze', municipalityCode: '048017', previousProfession: 'Architetta', initialLevel: 'comunale', parliamentaryGroupId: '', partyMode: 'independent', partyId: '', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, db.parties, db.parliamentaryGroups);
assert.notEqual(store.getState().game.flags.localCalendar, 1, 'Senza il documento la carriera parte con il vecchio calendario…');
store.setElectoralGeography(geography);
store.setLocalCalendar(calendar);
let s = store.getState();
assert.ok(s.world.localCalendar.leans?.['Emilia-Romagna']?.sinistra > 0 && s.world.localCalendar.leans?.Veneto?.destra > 0, 'Ogni regione ha il suo orientamento, dal voto reale del 2022.');
assert.equal(s.game.flags.localCalendar, 1, '…e passa al calendario reale appena arriva.');
assert.ok(s.world.localCalendar?.version === 1 && Object.keys(s.world.localCalendar.regions).length === 20, 'Il mondo conosce il calendario di tutte le regioni.');
const years = new Map();
let engaged = null, logged = false;
for (let week = 0; week < 170; week++) {
  const out = store.getState();
  if (out.game.status === 'ended') out.game.status = 'active';
  // The yearly round: when the request arrives, the player campaigns in the comuni at the polls.
  const request = out.game.inbox.find(item => item.templateId === 'tornata-amministrativa');
  if (request && !engaged) { out.game.week.ap = Math.max(out.game.week.ap, 2); out.game.resources.funds = Math.max(out.game.resources.funds, 1000); store.resolveAgendaItem(request.id, 'giro'); engaged = request.params.roundId; }
  store.advance(7);
  logged ||= store.getState().game.log.some(item => item.title.startsWith('Amministrative 2028:'));
}
s = store.getState();
// Firenze: politiche 2027, comunali and europee 2029, regionali 2030 — 2028 has no vote of the player's own, so the
// spring round of the amministrative is the player's round.
const round2028 = s.game.rounds.find(item => item.year === 2028);
assert.ok(round2028 && round2028.status === 'held' && round2028.electionDate === '2028-05-28', 'Nel 2028 la tornata amministrativa di primavera è la tornata del giocatore.');
assert.ok(engaged === round2028.id && round2028.engagement === 'giro' && ['buono', 'in-linea', 'deludente'].includes(round2028.outcome?.code), 'La campagna nei comuni è registrata e il risultato pesa sulla carriera.');
assert.ok(round2028.comuni > 100, `Il numero di comuni al voto viene dal calendario reale (${round2028.comuni}).`);
assert.ok(logged, 'Il risultato della tornata finisce nel diario.');
const votedYears = new Set([...s.game.elections.filter(item => item.electionDate <= s.clock.currentDate).map(item => item.electionDate), ...s.game.rounds.filter(item => item.status === 'held').map(item => item.electionDate)].map(date => date.slice(0, 4)));
assert.ok(['2027', '2028', '2029'].every(year => votedYears.has(year)), `Un voto ogni anno per il giocatore (${[...votedYears].sort().join(', ')}).`);
const votes = s.world.events.filter(item => item.kind === 'elezioni');
for (const event of votes) years.set(event.date.slice(0, 4), (years.get(event.date.slice(0, 4)) ?? 0) + 1);
// The world keeps the events of the last year only: the calendar itself shows the votes already held.
const heldRegions = Object.entries(s.world.localCalendar.regions).filter(([, entry]) => entry.camp);
assert.ok(heldRegions.length >= 3, `In tre anni hanno votato più regioni (${heldRegions.map(([region]) => region).join(', ')}).`);
assert.ok(heldRegions.every(([region]) => region !== 'Toscana'), 'La regione del giocatore vota nella sua carriera, non nel mondo.');
assert.ok(new Set(heldRegions.map(([, entry]) => entry.camp)).size >= 2 || heldRegions.length < 5, 'Non vince sempre lo stesso schieramento: le regioni hanno la loro storia politica.');
assert.ok(votes.some(item => /^Amministrative: si vota in \d+ comuni/.test(item.title)) || Object.keys(s.world.localCalendar.rounds).every(date => date > '2027-06-30'), 'Ogni primavera si vota in qualche comune.');
console.log(`  Tre anni: regionali in ${heldRegions.map(([region, entry]) => `${region} (${entry.camp})`).join(', ')}; eventi elettorali recenti per anno ${[...years.entries()].map(([year, count]) => `${year}: ${count}`).join(', ')}.`);

// ---------- 4. a vote every year: twenty years of careers, with early votes ----------
{
  // Real calendars with the most years without a vote of the player's own (Sicilia votes in 2027 with the politiche).
  const places = [['Toscana', '2023-05-14'], ['Lombardia', '2024-06-09'], ['Campania', '2026-05-24'], ['Sicilia', '2022-06-12'], ['Lazio', '2021-10-03'], ['Veneto', '2025-05-25']];
  const stats = { popularity: 50, reputation: 50, notoriety: 30, influence: 30, consensus: 5, experience: 20 };
  let worst = 0, rounds = 0;
  for (const [index, [region, comunale]] of places.entries()) {
    let game = C.createGameState({ seedText: `anni|${region}`, currentDate: '2026-09-24', level: 'comunale', place: { region, municipality: 'Comune di prova' }, localCalendar: { comunale, regionale: calendar.regions.find(item => item.region === region).lastElection, comunaleReal: true, regionaleReal: true } });
    let date = '2026-09-24';
    let ctxStats = { ...stats };
    const votes = new Map();
    for (let week = 0; week < 52 * 20 + 4; week++) {
      date = T.advanceDays(date, 7);
      // A Government falls in the spring of 2030 and no majority is found: early general election. Half the comuni are
      // dissolved in the summer of 2031: they vote again the next spring.
      const parliament = date >= '2030-03-01' && date <= '2030-04-20' ? { government: { status: 'fallen' }, chambers: {}, laws: [] } : null;
      if (index % 2 === 0 && date >= '2031-07-01' && date < '2031-07-08') game = C.scheduleEarlyLocalElection(game, 'comunale', date);
      const out = C.advanceWeek({ game, stats: ctxStats, parliament }, { currentDate: date, pollDelta: 0 });
      game = out.ctx.game; ctxStats = out.ctx.stats; game.status = 'active';
      for (const entry of game.elections) if (entry.electionDate <= date) votes.set(entry.id, { type: entry.type, date: entry.electionDate, early: Boolean(entry.early) });
      for (const round of game.rounds) if (round.status === 'held') votes.set(round.id, { type: 'tornata', date: round.electionDate });
    }
    const list = [...votes.values()].sort((a, b) => a.date.localeCompare(b.date));
    rounds += list.filter(item => item.type === 'tornata').length;
    for (let year = 2027; year <= 2046; year++) assert.ok(list.some(item => item.date.startsWith(String(year))), `${region}: nessun voto nel ${year}.`);
    list.reduce((previous, item) => { worst = Math.max(worst, (Date.parse(item.date) - Date.parse(previous)) / 86400000); return item.date; }, '2026-09-24');
    // Mandates keep their length: five years between two votes of the same kind, except when the second is early.
    for (const type of ['comunale', 'regionale', 'politiche', 'europee']) {
      const dates = list.filter(item => item.type === type);
      for (let i = 1; i < dates.length; i++) {
        const years = (Date.parse(dates[i].date) - Date.parse(dates[i - 1].date)) / (365.25 * 86400000);
        if (!dates[i].early) assert.ok(years > 4.8 && years < 5.15, `${region}: ${type} ${dates[i - 1].date} → ${dates[i].date} (${years.toFixed(2)} anni).`);
        else assert.ok(years < 5, `${region}: voto anticipato ${type} il ${dates[i].date}.`);
      }
    }
    assert.ok(list.some(item => item.type === 'politiche' && item.early && item.date.startsWith('2030')), `${region}: politiche anticipate dopo la caduta del governo.`);
    if (index % 2 === 0) assert.ok(list.some(item => item.type === 'comunale' && item.date === '2032-05-30'), `${region}: comune sciolto, si vota alla primavera successiva.`);
  }
  assert.ok(worst <= 400, `Mai più di tredici mesi senza un voto (massimo ${worst} giorni).`);
  console.log(`  Vent’anni in 6 calendari reali: un voto ogni anno (al massimo ${worst} giorni senza), ${rounds} tornate amministrative al posto degli anni vuoti, mandati di cinque anni anche dopo politiche e comunali anticipate.`);
}

// ---------- 5. early regional votes ----------
{
  let world = W.withLocalCalendar(s.world, { regions: calendar.regions, municipalities: {} }, '2026-10-01');
  world = structuredClone(s.world);
  let early = 0;
  for (let run = 0; run < 400 && !early; run++) {
    world.rngState = 12345 + run * 7919;
    const out = W.advanceWorld(world, { date: '2029-10-07', week: 999, stats: {}, society: { mood: 50, moodDelta: 0, trust: 48, sentiment: 0 } }).world;
    early = Object.values(out.localCalendar.regions).filter(entry => entry.early).length;
  }
  assert.ok(early >= 1, 'Una giunta regionale può cadere: si vota prima.');
}
console.log('Calendario verificato: mandati di cinque anni sfalsati (dati Eligendo), turno di primavera per legge, voti locali della carriera nel calendario del proprio territorio, un voto rilevante ogni anno per il giocatore (le amministrative di primavera negli anni senza un suo voto), regionali e amministrative nel Paese ogni anno, voto anticipato quando cade un governo o una giunta, mandati coerenti dopo il voto anticipato.');
