// Versioned, non-destructive repair of the votes of list elections (politiche, europee) saved BEFORE the fix of the double count of «Altri».
// What was wrong: the lists shown (percent on ALL the valid votes, e.g. 90.88 %) were stretched to 100 % of the valid ballots, so every list got more votes than percent × ballots and the rest (the lists not shown,
// «Altri») was counted again by the Election Night. What is certain: the percent of each list and the valid ballots were saved. A result is repaired ONLY when it can be proved to come from the old rule: the saved
// votes are EXACTLY what the old formula gives from the saved percentages and the valid ballots (largest remainder on the percentages alone). Anything else (a different shape, edited, already repaired, rows that
// reach 100 %, missing data) is left exactly as it is and reported as «non ricostruibile»: nothing is invented and nothing is changed silently. The original votes are kept in `votesBefore`, the repair is marked
// in `votesMigration` (so it runs once) and the caller keeps a copy of the whole save (storage.backup) before anything is written.
import { distributeVotes } from './electorate.js?v=20261124-3';
import { nightSnapshot } from './night-engine.js?v=20261124-3';

export const VOTES_MIGRATION_VERSION = 1;
const NATIONAL = new Set(['politiche', 'europee']);
const REST_MIN = 0.05;   // a rest below this was never given a row of its own

// Judges one count: { status: 'ok' | 'riparato' | 'gia-riparato' | 'non-ricostruibile' | 'non-applicabile', reason, votes? }
export function judgeVotes(groups, count, electionType = null) {
  if (electionType && !NATIONAL.has(electionType)) return { status: 'non-applicabile', reason: 'not a national list vote' };
  if (!Array.isArray(groups) || !groups.length) return { status: 'non-applicabile', reason: 'no lists' };
  if (groups.some(row => row.votesMigration || row.votesBefore)) return { status: 'gia-riparato', reason: 'already repaired' };
  const valid = Number(count?.valid ?? count?.ballots);
  if (!count || count.normalized || !Number.isInteger(valid) || valid <= 0) return { status: 'non-ricostruibile', reason: 'valid ballots missing or not an integer' };
  if (groups.some(row => !Number.isFinite(Number(row.percent)) || !Number.isInteger(row.votes) || row.votes < 0)) return { status: 'non-ricostruibile', reason: 'percentages or list votes missing' };
  const percents = groups.map(row => Number(row.percent));
  const shown = percents.reduce((sum, value) => sum + value, 0);
  const rest = Math.round((100 - shown) * 100) / 100;
  if (rest < REST_MIN) return { status: 'ok', reason: 'the lists cover the whole vote: no rest to derive' };
  const stored = groups.map(row => row.votes);
  const current = distributeVotes([...percents, rest], valid).slice(0, groups.length);
  if (current.every((value, index) => value === stored[index])) return { status: 'ok', reason: 'already consistent with the current rule' };
  if (stored.reduce((sum, value) => sum + value, 0) !== valid) return { status: 'non-ricostruibile', reason: 'saved votes follow neither the previous nor the current rule: left as they are' };
  const old = distributeVotes(percents, valid);
  if (old.some((value, index) => value !== stored[index])) return { status: 'non-ricostruibile', reason: 'saved votes do not match the previous rule: left as they are' };
  const repaired = distributeVotes([...percents, rest], valid).slice(0, groups.length);
  return { status: 'riparato', reason: 'votes stretched by the previous rule, rebuilt from percentages and valid ballots', votes: repaired, rest, restVotes: valid - repaired.reduce((sum, value) => sum + value, 0) };
}

// Applies the repair to the rows of one count. Returns { groups, outcome }; the rows are copied, never edited in place.
export function repairGroups(groups, count, electionType = null) {
  const outcome = judgeVotes(groups, count, electionType);
  if (outcome.status !== 'riparato') return { groups, outcome };
  const next = groups.map((row, index) => ({ ...row, votesBefore: row.votes, votes: outcome.votes[index], votesMigration: VOTES_MIGRATION_VERSION }));
  return { groups: next, outcome };
}

// The whole state: the result of the campaign (and its first round), and the last election report of the career. Returns { state, changed, notes } with a note for every count looked at that was not repaired.
export function migrateElectionVotes(state) {
  const notes = []; let changed = false;
  let campaign = state?.campaign ?? null, career = state?.career ?? null;
  const fix = (holder, groupsKey, countOf, type, label) => {
    const { groups, outcome } = repairGroups(holder?.[groupsKey], countOf(holder), type);
    if (outcome.status === 'riparato') { changed = true; notes.push({ where: label, status: outcome.status, reason: outcome.reason }); return { ...holder, [groupsKey]: groups, votesMigration: { version: VOTES_MIGRATION_VERSION, repaired: true } }; }
    if (outcome.status === 'non-ricostruibile') notes.push({ where: label, status: outcome.status, reason: outcome.reason });
    return holder;
  };
  if (campaign?.result) {
    let result = fix(campaign.result, 'groups', item => item.electorate, campaign.electionType ?? campaign.result.electionType, 'campaign.result');
    if (result.firstRound) result = { ...result, firstRound: fix(result.firstRound, 'groups', item => item.electorate, campaign.electionType, 'campaign.firstRound') };
    if (result !== campaign.result) campaign = { ...campaign, result };
  }
  if (career?.lastElectionReport) {
    const report = fix(career.lastElectionReport, 'groups', item => item.count, career.lastElectionReport.electionType, 'career.lastElectionReport');
    if (report !== career.lastElectionReport) career = { ...career, lastElectionReport: report };
  }
  // A night still in progress (not concluded) whose snapshot was made by the old rule: it is made again from the same result (same seed, same hour reached), keeping the old snapshot beside it. The
  // nights already concluded are history and stay as they were.
  let night = state?.night ?? null;
  if (night && !night.concluded && night.snapshot && campaign?.result && night.campaignId === campaign.id && !night.snapshotBefore) {
    const fresh = nightSnapshot(campaign, night.stage);
    const same = fresh && fresh.groups.filter(group => !group.others).every(group => night.snapshot.groups.some(old => old.id === group.id && Math.abs(old.percent - group.percent) < 0.005)) && fresh.groups.length === night.snapshot.groups.length;
    if (same && fresh.groups.some(group => night.snapshot.groups.find(old => old.id === group.id)?.votes !== group.votes)) { night = { ...night, snapshot: fresh, snapshotBefore: night.snapshot, votesMigration: { version: VOTES_MIGRATION_VERSION } }; changed = true; notes.push({ where: 'night.inProgress', status: 'riparato', reason: 'snapshot rebuilt from the same result' }); }
    else if (!same) notes.push({ where: 'night.inProgress', status: 'non-ricostruibile', reason: 'snapshot lists do not match the result: left as they are' });
  }
  return { state: changed ? { ...state, campaign, career, night } : state, changed, notes };
}
