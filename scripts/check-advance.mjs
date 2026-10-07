// Advancing to a precise future date (store.advanceToDate): the weeks go by one at a time through the ordinary engine (stepTime, settleWeeks), so a jump of a few days, a year or
// more than five years (past the 260 weeks one settleWeeks call closes) leaves the same game as playing the weeks one by one; it stops before what only the player can settle
// (an urgent matter, a situation, a campaign under way) and goes on when the staff takes over; no past dates, a ceiling on the distance, a state that is always at the end of a week.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer, fingerprint } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const { checkInvariants } = await import(`../src/core/invariants.js${v}`);
const { advanceDays } = await import(`../src/core/time.js${v}`);
const days = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
const SEED = 'avanzamento-a-data';
const fresh = async (level = 'deputato') => startCareer({ seed: SEED, level });
// The week the game is in lags the clock by less than a week: no week is left unclosed behind the date.
const aligned = state => days(state.game.week.startedAt, state.clock.currentDate) < 7 && days(state.game.week.startedAt, state.clock.currentDate) >= 0;
// How many decisions the weeks closed with their default, and whether the diary says one was closed without the player.
const delegated = state => state.game.record?.decisions?.delegated ?? 0;
const closedWithout = (state, title) => state.game.log.some(entry => entry.title.startsWith(title) && entry.title.endsWith('(senza decisione)'));
// What the player decides by hand: every urgent matter and situation takes the first choice that can be taken.
const settle = store => {
  for (const item of [...store.getState().game.inbox].filter(entry => ['urgente', 'situazione'].includes(entry.kind))) {
    for (const choice of item.choices ?? []) { try { store.resolveAgendaItem(item.id, choice.id); break; } catch { /* the next choice */ } }
  }
};

// ---------- 1. what is refused ----------
let run = await fresh();
let store = run.store;
const start = store.getState().clock.currentDate;
const before = fingerprint(store.getState());
assert.throws(() => store.advanceToDate(start), /futura/, 'Oggi non è una data futura.');
assert.throws(() => store.advanceToDate(advanceDays(start, -30)), /futura/, 'Il passato è rifiutato.');
for (const bad of ['', 'domani', '2027-02-30', '2027-13-01', '27-01-2027', null, undefined, 20270101]) assert.throws(() => store.advanceToDate(bad), /Data non valida/, `Data non valida: ${bad}`);
assert.throws(() => store.advanceToDate(advanceDays(start, 366 * 41)), /al massimo di 40 anni/, 'Una data lontanissima è rifiutata.');
assert.equal(fingerprint(store.getState()), before, 'Una data rifiutata non cambia nulla.');
assert.equal(store.getState().clock.currentDate, start);

// ---------- 2. a few days: no week closes, the clock lands on the date ----------
const week0 = store.getState().game.week.index;
let result = store.advanceToDate(advanceDays(start, 3));
assert.equal(result.reason, 'data');
assert.equal(result.reached, advanceDays(start, 3));
assert.equal(store.getState().clock.currentDate, advanceDays(start, 3));
assert.equal(store.getState().game.week.index, week0, 'Tre giorni non chiudono la settimana.');
assert.ok(aligned(store.getState()));

// ---------- 3. what needs the player stops the advance (before it is passed); the staff goes on ----------
const target = advanceDays(start, 120);
result = store.advanceToDate(target);
assert.equal(result.reason, 'decisione', `Senza delega ci si ferma prima di una decisione (${result.reason}).`);
assert.ok(result.waiting?.title && ['urgente', 'situazione'].includes(result.waiting.kind));
assert.ok(result.reached < target && result.steps >= 0);
let waiting = store.getState().game.inbox.find(item => item.title === result.waiting.title && item.kind === result.waiting.kind);
assert.ok(waiting, 'La decisione è ancora lì: non è stata superata.');
const stoppedAt = store.getState().clock.currentDate;
// Asked again with nothing settled: still stopped, no time passes, no week closes, nothing changes.
const frozen = fingerprint(store.getState());
const again = store.advanceToDate(target);
assert.equal(again.reason, 'decisione');
assert.equal(again.steps, 0);
assert.equal(store.getState().clock.currentDate, stoppedAt);
assert.equal(fingerprint(store.getState()), frozen, 'Fermarsi non cambia la partita.');
// The player settles it and the advance goes on, stopping at the next one: every stop is before the week that would have settled it with its default.
let stops = 1;
const seen = [result.waiting.title];
for (let guard = 0; guard < 40; guard++) {
  assert.ok(store.getState().game.inbox.some(item => ['urgente', 'situazione'].includes(item.kind)), 'Si è fermato per una decisione presente.');
  settle(store);
  result = store.advanceToDate(target);
  for (const title of seen) assert.ok(!closedWithout(store.getState(), title), `“${title}” non è stata chiusa senza il giocatore.`);
  if (result.reason === 'decisione') { stops++; seen.push(result.waiting.title); continue; }
  break;
}
assert.ok(['data', 'campagna'].includes(result.reason), `Alla fine la data o una campagna (${result.reason}).`);
assert.ok(stops >= 2, 'Più decisioni in quattro mesi: più soste.');
// With the staff in charge nothing stops it: the decisions close with their default (counted as delegated) and the date is reached.
run = await fresh(); store = run.store;
const delegatedBefore = delegated(store.getState());
result = store.advanceToDate(advanceDays(start, 120), { delegate: true });
assert.equal(result.reason, 'data');
assert.equal(result.reached, advanceDays(start, 120));
assert.ok(delegated(store.getState()) > delegatedBefore, 'Le decisioni sono passate allo staff.');
assert.equal(store.getState().game.week.index, week0 + Math.floor(120 / 7), 'Tutte le settimane sono state chiuse.');
assert.ok(aligned(store.getState()));
assert.throws(() => store.advanceToDate(advanceDays(start, 100)), /futura/, 'Dopo l’avanzamento la data è passata.');

// ---------- 4. about a year: the same game as one week after the other, whatever the pieces ----------
const YEAR = advanceDays(start, 365);
run = await fresh(); store = run.store;
result = store.advanceToDate(YEAR, { delegate: true });
assert.equal(result.reason, 'data');
assert.equal(result.steps, Math.ceil(365 / 7));
assert.equal(store.getState().clock.currentDate, YEAR);
assert.ok(aligned(store.getState()));
const oneCall = fingerprint(store.getState());
const yearState = store.getState();
assert.ok(checkInvariants(yearState, run.context).ok, `Stato coerente dopo un anno: ${checkInvariants(yearState, run.context).issues.slice(0, 3).map(item => `[${item.code}] ${item.message}`).join('; ')}`);
assert.equal(JSON.parse(globalThis.localStorage.getItem('palazzo-2026.career.v1')).clock.currentDate, YEAR, 'Il salvataggio è alla data raggiunta.');
assert.equal(store.saveStatus().dirty, false);
// In pieces of ten weeks (as the page does).
run = await fresh(); store = run.store;
let pieces = 0;
do { result = store.advanceToDate(YEAR, { delegate: true, maxWeeks: 10 }); pieces++; assert.ok(aligned(store.getState()), 'A ogni pezzo la partita è a fine settimana.'); } while (result.reason === 'continua' && pieces < 20);
assert.equal(result.reason, 'data');
assert.equal(pieces, Math.ceil(Math.ceil(365 / 7) / 10), 'Dieci settimane alla volta.');
assert.equal(fingerprint(store.getState()), oneCall, 'A pezzi o in una volta, la partita è la stessa.');
// The ordinary flow, week by week.
run = await fresh(); store = run.store;
for (let date = store.getState().clock.currentDate; date < YEAR; date = store.getState().clock.currentDate) store.advance(Math.min(7, days(date, YEAR)));
assert.equal(fingerprint(store.getState()), oneCall, 'Come chiudere le settimane una dopo l’altra con il motore di sempre: nessuna scorciatoia.');

// ---------- 5. more than five years (more than 260 weeks): every week still passes through the engine ----------
run = await fresh(); store = run.store;
const FAR = advanceDays(start, 366 * 6);
const t0 = Date.now();
result = store.advanceToDate(FAR, { delegate: true });
assert.equal(result.reason, 'data', `Sei anni: ${result.reason}`);
assert.equal(result.reached, FAR);
assert.ok(result.steps > 260, `Oltre 260 settimane (${result.steps}).`);
assert.equal(result.steps, Math.ceil(days(start, FAR) / 7));
const far = store.getState();
assert.equal(far.clock.currentDate, FAR);
assert.ok(aligned(far), 'Nessuna settimana rimasta indietro rispetto alla data.');
assert.equal(far.game.week.index, 1 + Math.floor(days(start, FAR) / 7), 'Ogni settimana è stata chiusa.');
assert.ok((far.game.elections ?? []).filter(item => item.status === 'held').length >= 2, 'Nel frattempo si è votato: le elezioni sono passate dal motore.');
const issues = checkInvariants(far, run.context);
assert.ok(issues.ok, `Stato coerente dopo sei anni: ${issues.issues.slice(0, 3).map(item => `[${item.code}] ${item.message}`).join('; ')}`);
assert.equal(JSON.parse(globalThis.localStorage.getItem('palazzo-2026.career.v1')).clock.currentDate, FAR);

// ---------- 6. a campaign under way is the player's: it stops the advance, the staff takes it to the vote ----------
run = await fresh(); store = run.store;
const politiche = store.getState().game.elections.find(item => item.type === 'politiche');
assert.ok(politiche, 'Una carriera da deputato ha le politiche in calendario.');
store.fastForwardToElection('politiche');
store.startCampaign({ electionType: 'politiche', role: 'deputato', objective: 'seat' }, run.db.parties, { politicians: run.db.politicians, groups: run.db.parliamentaryGroups });
assert.equal(store.getState().campaign.status, 'active');
const afterVote = advanceDays(politiche.electionDate, 30);
const campaignDay = store.getState().clock.currentDate;
result = store.advanceToDate(afterVote);
assert.equal(result.reason, 'campagna');
assert.equal(result.steps, 0);
assert.equal(store.getState().clock.currentDate, campaignDay, 'La campagna non è stata superata.');
const votes = (store.getState().career.electionHistory ?? []).length;
result = store.advanceToDate(afterVote, { delegate: true });
assert.equal(result.reason, 'data');
assert.equal(store.getState().clock.currentDate, afterVote);
assert.equal(store.getState().campaign.status, 'finished', 'La campagna è arrivata al voto.');
assert.equal((store.getState().career.electionHistory ?? []).length, votes + 1, 'Il voto è stato registrato.');
assert.ok(aligned(store.getState()));

// ---------- 7. the career ends: the advance ends with it ----------
assert.throws(() => { const ended = run; ended.store.getState().game.status = 'ended'; try { ended.store.advanceToDate(advanceDays(afterVote, 30)); } finally { ended.store.getState().game.status = 'active'; } }, /conclusa/);

console.log('Avanzamento a una data verificato: date passate, odierne e non valide rifiutate, un tetto di 40 anni; pochi giorni senza chiudere settimane; stop prima di decisioni urgenti, situazioni e campagne in corso (senza cambiare la partita) e, con la delega allo staff, decisioni chiuse con la scelta predefinita e campagna portata al voto; circa un anno identico a chiudere le settimane una a una e a pezzi di dieci; oltre cinque anni (più di 260 settimane) con ogni settimana, voto e controllo di coerenza passati dal motore; salvataggio alla data raggiunta.');
