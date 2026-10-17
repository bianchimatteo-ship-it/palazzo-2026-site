// Un'elezione realmente giocabile ogni anno di carriera, sul motore completo (lo store, i dati reali da disco): per ogni percorso e per più seed la carriera viene giocata per
// diversi anni di fila, e in ogni anno di carriera il giocatore deve avere almeno una campagna avviata dal gioco e conclusa con un risultato (un voto suo: un'elezione del
// calendario oppure la corsa della tornata di amministrative che riempie l'anno, a cui può candidarsi anche chi non guida un partito). Nessun anno solo "segnato sul
// calendario". Tra due tornate diverse almeno 100 giorni (le elezioni dello stesso giorno sono una tornata); il ballottaggio è parte della stessa campagna, non una seconda
// elezione dell'anno (una sola voce nello storico per campagna). Ogni percorso gira in un processo a parte (CONC=n); ONLY=livello:seed per un solo caso, YEARS=n per la durata.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const YEARS = Number(process.env.YEARS ?? 5);
const CASES = (process.env.ONLY ? process.env.ONLY.split(',').map(item => item.split(':')) : [['comunale', 'a'], ['comunale', 'b'], ['provinciale', 'a'], ['provinciale', 'b'], ['regionale', 'a'], ['regionale', 'b'], ['deputato', 'a'], ['deputato', 'b'], ['senatore', 'a'], ['europeo', 'a'], ['europeo', 'b']]);
const MIN_GAP = 100;

if (process.argv[2] === 'worker') {
  const { startCareer, playWeek } = await import('./lib/long-run.mjs');
  const { distinctRounds } = await import('../src/core/calendar-planner.js');
  const [, , , level, seed] = process.argv;
  const { store, db, decide } = await startCareer({ seed, level, fast: true, territorial: true });
  const people = { politicians: db.politicians, groups: db.parliamentaryGroups };
  const days = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
  const start = store.getState().clock.currentDate;
  const yearOf = date => Math.floor(days(start, date) / 365.25) + 1;
  const seen = new Map();
  const blocked = [];
  let cap = 0;
  for (let week = 0; week < Math.ceil(52.18 * YEARS) && store.getState().game?.status !== 'ended'; week++) {
    const now = store.getState();
    // the dates of the votes as they stood when they opened or were held (a date still ahead may be moved by the calendar planner): the last one seen for each vote
    for (const entry of [...(now.game.elections ?? []), ...(now.game.rounds ?? [])]) if (entry.status !== 'upcoming' && entry.status !== 'missed') seen.set(entry.id, entry.electionDate);
    // The player always takes the vote that is in front of him (what is checked is that there is one he can play, not how often a player decides to): the open election of
    // his calendar, else the race of the round of the amministrative, which any career can stand in (Elezioni → Candidatura).
    if (now.campaign?.status !== 'active') {
      const open = (now.game.elections ?? []).find(item => item.status === 'open');
      const race = store.races().find(item => item.round && ['planned', 'confirmed'].includes(item.status) && now.clock.currentDate >= item.windowOpensAt && now.clock.currentDate <= item.windowClosesAt);
      if (open) {
        try { store.startCampaign({ electionType: open.type, ...(open.type === 'politiche' ? { role: 'deputato' } : {}), objective: 'seat' }, db.parties, people); } catch (error) { blocked.push({ date: now.clock.currentDate, election: open.id, reason: error.message }); }
      }
      if (store.getState().campaign?.status !== 'active' && race) {
        try {
          if (race.status === 'planned') store.chooseRaceCandidate(race.id, { kind: 'player' }, people);
          store.startCampaign({ electionType: race.level, raceId: race.id }, db.parties, people);
        } catch (error) { blocked.push({ date: now.clock.currentDate, race: race.id, reason: error.message }); }
      }
    }
    playWeek({ store, db, decide });
    cap++;
  }
  const state = store.getState();
  const history = (state.career.electionHistory ?? []).map(item => ({ campaignId: item.campaignId, type: item.electionType, date: item.date, label: item.electionLabel ?? null, outcome: item.outcome ?? null }));
  const races = store.races().concat(state.races?.archive ?? []).filter(race => race.round).map(race => ({ id: race.id, status: race.status, date: race.electionDate, won: race.result?.won ?? null }));
  process.stdout.write(`RESULT ${JSON.stringify({ level, seed, start, weeks: cap, ended: state.game?.status === 'ended', history, races, blocked, calendar: [...seen.values()].sort(), years: Array.from({ length: YEARS }, (_, index) => history.filter(item => yearOf(item.date) === index + 1).length), solar: Object.fromEntries(history.reduce((map, item) => map.set(item.date.slice(0, 4), (map.get(item.date.slice(0, 4)) ?? 0) + 1), new Map())), closest: distinctRounds([...seen.values()]).closest })}\n`);
  process.exit(0);
}

// ---------- the runner ----------
const run = ([level, seed]) => new Promise(resolve => {
  const child = spawn(process.execPath, ['--no-warnings', fileURLToPath(import.meta.url), 'worker', level, seed], { env: { ...process.env, YEARS: String(YEARS) } });
  let out = '', err = '';
  child.stdout.on('data', chunk => { out += chunk; });
  child.stderr.on('data', chunk => { err += chunk; });
  child.on('close', code => resolve({ level, seed, code, out, err }));
});
const results = [];
const queue = [...CASES];
await Promise.all(Array.from({ length: Math.min(Number(process.env.CONC ?? 4), queue.length) }, async () => { for (let item = queue.shift(); item; item = queue.shift()) results.push(await run(item)); }));
const days = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
const summary = [];
for (const done of results.sort((a, b) => `${a.level}${a.seed}`.localeCompare(`${b.level}${b.seed}`))) {
  const line = done.out.split('\n').find(row => row.startsWith('RESULT '));
  assert.ok(done.code === 0 && line, `${done.level}/${done.seed}: il processo non si è concluso (${done.code}) ${done.err.slice(-600)}`);
  const r = JSON.parse(line.slice(7));
  const label = `${r.level}/${r.seed}`;
  if (r.ended) { summary.push(`${label}: carriera conclusa prima della fine (non valutata)`); continue; }
  // 1. a campaign of the player, finished with a result, in every year of the career
  // Every calendar year that the career lives whole has one (the rule of the game: one personal candidacy a year, early elections apart)...
  const first = Number(r.start.slice(0, 4)) + 1, last = Number(r.start.slice(0, 4)) + YEARS - 1;
  const emptySolar = []; for (let year = first; year <= last; year++) if (!r.solar[year]) emptySolar.push(year);
  assert.deepEqual(emptySolar, [], `${label}: anni solari senza un'elezione giocata e conclusa: ${emptySolar.join(', ')} (storico: ${r.history.map(item => `${item.type}@${item.date}`).join(' ')}; candidature negate: ${JSON.stringify(r.blocked.slice(0, 3))})`);
  const emptyCareer = r.years.map((count, index) => count === 0 ? index + 1 : null).filter(Boolean);
  // and every year of the career counted from its first day (twelve months at a time) too
  assert.deepEqual(emptyCareer, [], `${label}: anni di carriera (dodici mesi dall'inizio) senza un'elezione giocata e conclusa: ${emptyCareer.join(', ')} (storico: ${r.history.map(item => `${item.type}@${item.date}`).join(' ')}; candidature negate: ${JSON.stringify(r.blocked.slice(0, 3))})`);
  // 2. one history entry for each campaign: the runoff is part of the campaign, never a second election
  assert.equal(new Set(r.history.map(item => item.campaignId)).size, r.history.length, `${label}: una campagna compare più volte nello storico (il ballottaggio non è una seconda elezione)`);
  // 3. at least MIN_GAP days between two distinct rounds of the votes the player played (the same day is one round) and of the whole calendar
  const played = [...new Set(r.history.map(item => item.date))].sort();
  for (let i = 1; i < played.length; i++) assert.ok(days(played[i - 1], played[i]) >= MIN_GAP, `${label}: due voti giocati a meno di ${MIN_GAP} giorni (${played[i - 1]} → ${played[i]})`);
  if (r.closest) assert.ok(r.closest.days >= MIN_GAP, `${label}: due tornate del calendario a ${r.closest.days} giorni (${r.closest.from} → ${r.closest.to})`);
  summary.push(`${label}: ${r.years.join('/')} campagne per anno, tornate giocate ${r.races.filter(race => race.status === 'held').length}, voti più vicini ${r.closest?.days ?? '—'} giorni`);
}
console.log(`Un'elezione giocabile e giocata in ogni anno di carriera (${YEARS} anni, ${CASES.length} percorsi/seed sul motore completo): ${summary.join('; ')}.`);
