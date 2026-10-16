// The electoral calendar of a career, kept honest: two distinct votes are never closer than CALENDAR_RULES.minGapDays (votes held on the same day are one round of voting, a
// “tornata”, and count as one), and the player always has a vote to play: no calendar year without one and never more than a year between two. The dates of the votes come from
// the real calendar (the general and European elections are fixed; the local and regional ones are the real ones five years on, simulated); where two of them would fall too close,
// the one that the law leaves room for moves by whole weeks inside its legal window, or joins the round of the other. Nothing is invented: a round of the amministrative is added
// (spring, then autumn) only when no vote falls in the time the rule requires. Pure functions over the calendar of the game: the same calendar always gives the same dates.
import { advanceDays } from './time.js?v=20261016-2';
import { ELECTION_MODELS } from '../data/simulation/campaign-rules.js?v=20261016-2';
import { ELECTION_SCHEDULE } from '../data/simulation/career-rules.js?v=20261016-2';

export const CALENDAR_RULES = Object.freeze({
  minGapDays: 100,
  // Between two votes the player can play there are at most this many days (365 is the limit: one day of margin is kept).
  maxPlayableGapDays: 364,
  // How far, in days before and after its natural date, a vote may move (whole weeks, always a Sunday): the legal window of each kind.
  // (the comuni vote in the window of the law, 15 April – 15 June; the provinces and regions have no fixed day)
  flex: Object.freeze({ comunale: 'primavera', provinciale: [100, 100], regionale: [60, 75] }),
  // A vote brought forward by a dissolution waits for a date that keeps its distance or joins another round: the Government stays in office for the current affairs and the President takes
  // the time of the consultations (weeks, never more than this many days after the first possible date).
  earlyAfter: Object.freeze({ politiche: 112, comunale: 70, provinciale: 70, regionale: 70 }),
  // A round of the amministrative already open can still be put off, to join another vote, by at most this many days.
  roundPostponeDays: 126,
  order: Object.freeze(['politiche', 'regionale', 'provinciale', 'comunale'])
});
const dayNo = day => Math.round(Date.parse(`${day}T12:00:00Z`) / 86400000);
export const daysApart = (a, b) => Math.abs(dayNo(a) - dayNo(b));
// A date is free when it is another vote's own day (the same round) or at least minGapDays from every other.
export const keepsDistance = (day, others, min = CALENDAR_RULES.minGapDays) => others.every(other => other === day || daysApart(other, day) >= min);
// The votes of a list of dates grouped by round (same day), and the closest pair of different rounds.
export function distinctRounds(dates) {
  const days = [...new Set(dates)].sort();
  let closest = null;
  for (let i = 1; i < days.length; i++) { const gap = daysApart(days[i - 1], days[i]); if (!closest || gap < closest.days) closest = { days: gap, from: days[i - 1], to: days[i] }; }
  return { rounds: days, closest };
}

const movable = (entry, today) => entry.status === 'upcoming' && entry.windowOpensAt > today && (entry.early ? entry.type in CALENDAR_RULES.earlyAfter : entry.type in CALENDAR_RULES.flex);
const rangeOf = entry => {
  if (entry.early) return [0, CALENDAR_RULES.earlyAfter[entry.type]];
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
  const fixed = [];
  const free = [];
  for (const entry of game.elections ?? []) (movable(entry, today) ? free : fixed).push(entry);
  const anchors = [...fixed.map(entry => entry.electionDate), ...(game.rounds ?? []).filter(round => round.status !== 'upcoming').map(round => round.electionDate)];
  free.sort((a, b) => CALENDAR_RULES.order.indexOf(a.type) - CALENDAR_RULES.order.indexOf(b.type) || String(a.baseDate ?? a.electionDate).localeCompare(String(b.baseDate ?? b.electionDate)));
  for (const entry of free) entry.baseDate ??= entry.electionDate;
  const options = free.map(entry => {
    const model = ELECTION_MODELS[entry.type];
    // A vote brought forward takes the first date that keeps its distances, from the first one the law allows (so that the player is never left more than a year without a vote);
    // the others stay as near as they can to their natural date.
    const days = entry.early && entry.earliest ? ascending(entry.earliest, entry.baseDate, CALENDAR_RULES.earlyAfter[entry.type]) : shifts(rangeOf(entry)).map(shift => advanceDays(entry.baseDate, shift));
    return days.filter(day => advanceDays(day, -model.campaignDays) > today);
  });
  const chosen = [];
  let nodes = 0;
  const search = depth => {
    if (depth === free.length) return true;
    if (++nodes > 40000) return false;
    const taken = [...anchors, ...chosen.slice(0, depth)];
    for (const day of options[depth]) {
      if (!keepsDistance(day, taken)) continue;
      chosen[depth] = day;
      if (search(depth + 1)) return true;
    }
    return false;
  };
  const solved = free.length === 0 || search(0);
  const placed = [];
  free.forEach((entry, index) => {
    const model = ELECTION_MODELS[entry.type];
    let day = solved ? chosen[index] : null;
    if (!day) {
      // no way to keep every distance: this vote keeps the first date that keeps its own distances (or its natural one) and is marked
      const taken = [...anchors, ...placed];
      day = options[index].find(candidate => keepsDistance(candidate, taken)) ?? entry.baseDate;
      if (keepsDistance(day, taken)) delete entry.calendarConflict; else entry.calendarConflict = true;
    } else delete entry.calendarConflict;
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
    const others = [...votes, ...(game.rounds ?? []).filter(item => item !== round && item.status !== 'upcoming').map(item => item.electionDate)];
    let target = null;
    for (let day = advanceDays(round.electionDate, 7); day <= advanceDays(round.electionDate, CALENDAR_RULES.roundPostponeDays) && !target; day = advanceDays(day, 7)) if (keepsDistance(day, others)) target = day;
    if (target) { round.originalDate ??= round.electionDate; round.electionDate = target; kept.push(round); }
    else if (!round.engagement) continue;
    else { round.calendarConflict = true; kept.push(round); }
  }
  game.rounds = kept;
  return game;
}
