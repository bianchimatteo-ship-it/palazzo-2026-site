// The electoral calendar of a career, kept honest: two distinct elections are never closer than CALENDAR_RULES.minGapDays and NEVER fall on the same day (the player could stand in only one of them,
// the other would be lost to the career), and the player always has a vote to play: no calendar year without one and never more than a year between two. There is no way out under the distance:
// when the dates do not fit, the algorithm looks further (every vote the law leaves room for moves by whole weeks inside its legal window — the ordinary general election too —; a vote brought forward
// by a crisis waits for the first date that fits; a round of the amministrative joins the gap). When no date fits inside the window, the conflict is resolved EXPLICITLY and the entry says so:
// the councils, provinces and regions are put off beyond their window (deferred, deferralReason), the general election is brought forward by an early dissolution (anticipated), and only when
// even that leaves no date the general election and the European one — fixed by the Union — share the day, declared (coincides). A combination that still does not fit is declared (calendarConflict),
// never accepted by lowering the distance. Nothing is invented: a round of the amministrative is added only when no vote falls in the time the rule requires. Pure functions over the
// calendar of the game: the same calendar always gives the same dates.
import { advanceDays } from './time.js?v=20261027-1';
import { ELECTION_MODELS } from '../data/simulation/campaign-rules.js?v=20261027-1';
import { ELECTION_SCHEDULE } from '../data/simulation/career-rules.js?v=20261027-1';

export const CALENDAR_RULES = Object.freeze({
  // The distance between two distinct rounds: one value, never lowered (no step, no floor, no exception).
  minGapDays: 180,
  // Between two votes the player can play there are at most this many days (365 is the limit: one day of margin is kept). With the minimum above this also means that no calendar year is left
  // without a vote: two dates at most 364 days apart cannot skip a year.
  maxPlayableGapDays: 364,
  // How far, in days before and after its natural date, a vote may move (whole weeks, always a Sunday): the legal window of each kind.
  // - the comuni vote in the window of the law, 15 April – 15 June; the provinces and regions have no fixed day;
  // - the ordinary general election is held within seventy days of the end of the Chambers (Constitution, art. 61): its natural day is two weeks before the end, it can come up to two weeks
  //   earlier or ten weeks later, which keeps it inside that limit. The European one is fixed by the Union and does not move.
  flex: Object.freeze({ politiche: [14, 70], comunale: 'primavera', provinciale: [100, 100], regionale: [60, 75] }),
  // A vote brought forward by a dissolution waits for the first date that keeps its distance from the others or joins another round: the Government (or the commissioner of a council) stays
  // in office for the current affairs and the President takes the time of the consultations (never more than this many days after the first possible date).
  earlyAfter: Object.freeze({ politiche: 210, comunale: 300, provinciale: 210, regionale: 210 }),
  // The general election after a dissolution is held within seventy days of it (art. 61): it first looks for a date this close to the first possible one, and the other votes of the calendar
  // make room by being put off (up to `deferDays` beyond their window — less for the councils, whose mandates must stay near five years —, as the amministrative are when the country votes). Only when a vote already under way leaves no such date does the
  // wait grow, up to `earlyAfter`: a country is never left for months with a Government for the current affairs because of a calendar.
  earlyPoliticheFirst: 21,
  // The Chambers are not dissolved while the earliest date the calendar can give the general election is further than this (a vote just held, or one under way, keeps the distance): the President
  // goes on with the consultations (a Government of the President) instead of leaving the country with a Government for the current affairs for months.
  dissolveWithinDays: 112,
  deferDays: Object.freeze({ comunale: 70, provinciale: 238, regionale: 238 }),
  // Two distinct elections never share a day, and the comuni, the provinces and the regions cannot always keep their window: when no date fits inside the window (and the usual deferral
  // above), the vote is put off, by whole weeks, up to this many days beyond its window. It is the explicit resolution of the conflict between "in the window of the law" and "never on the
  // same day as another vote": the entry says so (deferred, deferralReason) and the dates, the candidacy window and the countdown follow the new date.
  conflictDeferDays: Object.freeze({ comunale: 420, provinciale: 420, regionale: 420 }),
  // The ordinary general election cannot be put off (art. 61: within seventy days of the end of the Chambers) and the European one is fixed by the Union: when they fall less than the distance
  // apart, the Chambers are dissolved a little early, by whole weeks and by at most this many days before the legal window (a dissolution before the end of the term, as happens in practice).
  conflictAdvanceDays: Object.freeze({ politiche: 210 }),
  // A round of the amministrative already open can still be put off, to join another vote, by at most this many days.
  roundPostponeDays: 126,
  order: Object.freeze(['politiche', 'regionale', 'provinciale', 'comunale'])
});
const dayNo = day => Math.round(Date.parse(`${day}T12:00:00Z`) / 86400000);
export const daysApart = (a, b) => Math.abs(dayNo(a) - dayNo(b));
// A date is free when it is at least minGapDays from every other vote. A vote on the very day of another is NOT free: two distinct elections never coincide, because the player could stand
// in only one of them and the other would be lost to the career (the planner used to count votes of the same day as one round).
export const keepsDistance = (day, others, min = CALENDAR_RULES.minGapDays) => others.every(other => daysApart(other, day) >= min);
// The votes of a list of dates (one date per vote: two votes on the same day are a gap of zero days), and the closest pair.
export function distinctRounds(dates) {
  const days = [...dates].sort();
  let closest = null;
  for (let i = 1; i < days.length; i++) { const gap = daysApart(days[i - 1], days[i]); if (!closest || gap < closest.days) closest = { days: gap, from: days[i - 1], to: days[i] }; }
  return { rounds: days, closest };
}

// a vote brought forward, or a general election already overdue when the calendar was drawn, has a first possible day (`earliest`) and waits for the first date that fits
const late = entry => Boolean(entry.early || entry.earliest);
const movable = (entry, today) => entry.status === 'upcoming' && entry.windowOpensAt > today && (late(entry) ? entry.type in CALENDAR_RULES.earlyAfter : entry.type in CALENDAR_RULES.flex);
const rangeOf = entry => {
  if (late(entry)) return [0, CALENDAR_RULES.earlyAfter[entry.type]];
  const rule = CALENDAR_RULES.flex[entry.type];
  if (rule !== 'primavera') return rule;
  const base = entry.baseDate ?? entry.electionDate, year = base.slice(0, 4);
  return [Math.max(0, Math.floor(dayNo(base) - dayNo(`${year}-04-15`))), Math.max(0, Math.floor(dayNo(`${year}-06-15`) - dayNo(base)))];
};
// The dates a vote can take, nearest its natural date first (later before earlier at the same distance).
function shifts([before, after]) {
  const list = [0];
  for (let step = 7; step <= Math.max(before, after); step += 7) { if (step <= after) list.push(step); if (step <= before) list.push(-step); }
  return list;
}
const ascending = (earliest, base, after) => {
  const list = [];
  for (let day = advanceDays(earliest, (7 - new Date(`${earliest}T12:00:00Z`).getUTCDay()) % 7); day <= advanceDays(base, after); day = advanceDays(day, 7)) list.push(day);
  return list.length ? list : [base];
};
// Moves the upcoming votes of the player's calendar (game.elections) so that every round is at least minGapDays from the next. Idempotent; never touches a vote already open,
// running or held, and never moves a window into the past. The votes are placed together (a small search, the natural dates first and the legal order of the kinds), so that one that
// takes a free date does not leave another without. A vote that cannot be placed keeps its natural date and is marked calendarConflict (the tests list them).
export function harmonizeElections(game, today) {
  // A vote put off in one pass may widen what the next one can try (the flag stays on the entry), so the plan is repeated until it no longer moves: the calendar the player sees at the
  // start is the one every later week finds, not a different one after the first tick.
  const key = () => (game.elections ?? []).map(entry => `${entry.id}:${entry.electionDate}`).join('|');
  for (let pass = 0, before = key(); pass < 4; pass++) {
    harmonizeOnce(game, today);
    const after = key();
    if (after === before) break;
    before = after;
  }
  return game;
}
function harmonizeOnce(game, today) {
  const fixed = [];
  const free = [];
  for (const entry of game.elections ?? []) (movable(entry, today) ? free : fixed).push(entry);
  const anchors = [...fixed.map(entry => entry.electionDate), ...(game.rounds ?? []).filter(round => round.status !== 'upcoming' || round.standing).map(round => round.electionDate)];
  free.sort((a, b) => CALENDAR_RULES.order.indexOf(a.type) - CALENDAR_RULES.order.indexOf(b.type) || String(a.baseDate ?? a.electionDate).localeCompare(String(b.baseDate ?? b.electionDate)));
  for (const entry of free) entry.baseDate ??= entry.electionDate;
  // the country is going to vote after a dissolution: the other votes of the calendar may be put off for it
  const dissolved = (game.elections ?? []).some(entry => entry.type === 'politiche' && entry.early && entry.status !== 'held');
  const optionsFor = (wait, extended = false) => free.map(entry => {
    const model = ELECTION_MODELS[entry.type];
    // A vote brought forward takes the first date that keeps its distances, from the first one the law allows (so that the player is never left more than a year without a vote);
    // the others stay as near as they can to their natural date.
    const limit = entry.type === 'politiche' && entry.early ? Math.min(wait, CALENDAR_RULES.earlyAfter.politiche) : CALENDAR_RULES.earlyAfter[entry.type];
    let days;
    if (late(entry) && entry.earliest) days = ascending(entry.earliest, entry.baseDate, limit);
    else {
      const range = rangeOf(entry);
      days = shifts(range).map(shift => advanceDays(entry.baseDate, shift));
      if (extended && entry.type === 'politiche') for (let step = Math.ceil((range[0] + 1) / 7) * 7; step <= range[0] + CALENDAR_RULES.conflictAdvanceDays.politiche; step += 7) days.push(advanceDays(entry.baseDate, -step));
      if ((dissolved || entry.deferred || extended) && entry.type !== 'politiche') {
        const reach = extended ? CALENDAR_RULES.conflictDeferDays[entry.type] : CALENDAR_RULES.deferDays[entry.type];
        for (let step = Math.ceil((range[1] + 1) / 7) * 7; step <= range[1] + reach; step += 7) days.push(advanceDays(entry.baseDate, step));
      }
    }
    return days.filter(day => advanceDays(day, -model.campaignDays) > today);
  });
  let options = optionsFor(CALENDAR_RULES.earlyPoliticheFirst);
  const chosen = [];
  let nodes = 0;
  // last resort, declared: the ordinary general election cannot move out of its legal window and the European one is fixed, so when nothing else fits the two share the day (as the
  // law of the Union and the Constitution leave no other date); the entry says so (coincides) and the tests list it, nothing is silently allowed
  let join = false;
  const fixedDays = new Set(anchors);
  const search = depth => {
    if (depth === free.length) return true;
    if (++nodes > 400000) return false;
    const taken = [...anchors, ...chosen.slice(0, depth)];
    for (const day of options[depth]) {
      if (!keepsDistance(day, taken) && !(join && free[depth].type === 'politiche' && fixedDays.has(day) && keepsDistance(day, taken.filter(other => other !== day)))) continue;
      chosen[depth] = day;
      if (search(depth + 1)) return true;
    }
    return false;
  };
  let solved = free.length === 0 || search(0);
  // The Chambers dissolved: the country votes soon (art. 61) and it is the other votes that wait; a longer wait for the general election only comes after that. Without a dissolution, the votes of the
  // councils, provinces and regions that cannot keep both their window and the distance wait beyond the window (explicitly) before a conflict is declared.
  const passes = dissolved ? [[CALENDAR_RULES.earlyPoliticheFirst, true, false], [Infinity, true, false], [Infinity, true, true]] : [[CALENDAR_RULES.earlyPoliticheFirst, true, false], [CALENDAR_RULES.earlyPoliticheFirst, true, true]];
  for (const [wait, extended, joining] of passes) { if (solved) break; join = joining; options = optionsFor(wait, extended); nodes = 0; solved = search(0); }
  const placed = [];
  free.forEach((entry, index) => {
    const model = ELECTION_MODELS[entry.type];
    let day = solved ? chosen[index] : null;
    if (!day) {
      // no way to keep every distance: this vote keeps the first date that keeps its own distances (or its natural one) and is declared (the tests list them, none is accepted)
      const taken = [...anchors, ...placed];
      day = options[index].find(candidate => keepsDistance(candidate, taken)) ?? entry.baseDate;
      if (keepsDistance(day, taken)) delete entry.calendarConflict; else entry.calendarConflict = true;
    } else delete entry.calendarConflict;
    delete entry.shortGap;
    if (entry.type === 'politiche') { if (solved && join && fixedDays.has(day)) { entry.coincides = true; entry.deferralReason = 'Coincide con un altro voto fissato dalla legge: nessuna altra data rispetta i 180 giorni'; } else delete entry.coincides; }
    // a vote put off beyond its window for a general election called early stays so until it is held (its natural window would no longer fit between the others)
    if (entry.type === 'politiche' && !late(entry)) {
      if (shifts(rangeOf(entry)).some(shift => advanceDays(entry.baseDate, shift) === day)) { delete entry.anticipated; if (!entry.coincides) delete entry.deferralReason; }
      else { entry.anticipated = true; entry.deferralReason = 'Le Camere si sciolgono in anticipo: le politiche non cadono mai lo stesso giorno delle europee né a meno di 180 giorni da un altro voto'; }
    }
    if (entry.type !== 'politiche' && !late(entry)) {
      if (shifts(rangeOf(entry)).some(shift => advanceDays(entry.baseDate, shift) === day)) { delete entry.deferred; delete entry.deferralReason; }
      else { entry.deferred = true; entry.deferralReason = dissolved ? 'Rinviata per le elezioni politiche anticipate' : 'Rinviata oltre la finestra ordinaria: due elezioni non cadono mai lo stesso giorno e devono distare almeno 180 giorni'; }
    }
    placed.push(day);
    if (day !== entry.electionDate) {
      const opens = advanceDays(day, -model.campaignDays);
      Object.assign(entry, { electionDate: day, windowOpensAt: opens, windowClosesAt: advanceDays(opens, ELECTION_SCHEDULE[entry.type].windowDays) });
    }
  });
  return game;
}

// The Sunday for a round of the amministrative between `after` (exclusive) and `cap`: in the spring window of the law (15 April – 15 June, nearest the last Sunday of May), else in
// the autumn one (15 September – 30 November), else any Sunday; always at least minGapDays from every other vote. Null when none fits.
export function pickRoundDate({ after, cap, taken }) {
  const out = [];
  for (let day = advanceDays(after, 1); day <= cap; day = advanceDays(day, 1)) {
    if (new Date(`${day}T12:00:00Z`).getUTCDay() !== 0 || !keepsDistance(day, taken) || taken.includes(day)) continue;
    const mmdd = day.slice(5);
    const rank = mmdd >= '04-15' && mmdd <= '06-15' ? 0 : mmdd >= '09-15' && mmdd <= '11-30' ? 1 : 2;
    const anchor = rank === 0 ? `${day.slice(0, 4)}-05-31` : rank === 1 ? `${day.slice(0, 4)}-10-25` : day;
    out.push({ day, rank, distance: daysApart(day, anchor) });
  }
  out.sort((a, b) => a.rank - b.rank || a.distance - b.distance || b.day.localeCompare(a.day));
  return out[0]?.day ?? null;
}

// A round of the amministrative that is already open (its campaign window began) and then finds a vote too close, because a government fell or a council was dissolved in the meantime,
// is put off to the first Sunday that keeps the distance (or joins the other vote), or withdrawn when the player has not taken part in it. Nothing moves earlier, nothing is invented.
export function settleOpenRounds(game, today) {
  const votes = (game.elections ?? []).map(entry => entry.electionDate);
  const kept = [];
  for (const round of game.rounds ?? []) {
    if (round.status !== 'open' || round.electionDate <= today || keepsDistance(round.electionDate, votes)) { kept.push(round); continue; }
    const others = [...votes, ...(game.rounds ?? []).filter(item => item !== round && (item.status !== 'upcoming' || item.standing)).map(item => item.electionDate)];
    let target = null;
    for (let day = advanceDays(round.electionDate, 7); day <= advanceDays(round.electionDate, CALENDAR_RULES.roundPostponeDays) && !target; day = advanceDays(day, 7)) if (keepsDistance(day, others)) target = day;
    if (target) { round.originalDate ??= round.electionDate; round.electionDate = target; kept.push(round); }
    else if (!round.engagement) continue;
    else { round.calendarConflict = true; kept.push(round); }
  }
  game.rounds = kept;
  return game;
}
