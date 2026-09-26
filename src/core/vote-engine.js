// Simulated votes, seat by seat. The engines decide how many members of each group vote in favour (parliament-engine);
// here the rest is split into votes against and abstentions, each group gets its line (the vote of most of its
// members), members voting differently are the dissenters, and in a secret ballot the missing votes of the majority
// are the snipers ("franchi tiratori") — counted, never named: in a secret ballot nobody knows who they are.
// Every vote is a simulation: individual votes of real parliamentarians are illustrations of the group totals.
export const VOTE_CHOICES = Object.freeze({
  favorevole: { label: 'Favorevole', color: '#3fa45d' },
  contrario: { label: 'Contrario', color: '#d0453a' },
  astenuto: { label: 'Astenuto', color: '#d9d6cc' },
  segreto: { label: 'Voto segreto', color: '#5d6a64' },
  assente: { label: 'Non vota', color: '#2b3430' }
});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const hashOf = value => [...String(value)].reduce((n, char) => (Math.imul(n, 31) + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
// A small deterministic sequence: the same vote always gives the same seats.
export function seededRandom(seed) {
  let state = hashOf(seed);
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

// The votes that are not in favour, split into against and abstentions. Groups close to the proposal (support near
// one half) abstain more; a question of confidence leaves little room for abstaining.
export function splitGroupVote({ seats, yes, confidence = false, seed = 'voto' }) {
  const rest = Math.max(0, seats - yes);
  const support = seats ? yes / seats : 0;
  const closeness = 1 - Math.abs(2 * support - 1);
  const random = seededRandom(seed);
  const share = confidence ? 0.02 + random() * 0.03 : clamp(0.04 + closeness * 0.22 + (random() - 0.5) * 0.08, 0.02, 0.4);
  const abstain = Math.min(rest, Math.round(rest * share));
  return { yes, no: rest - abstain, abstain };
}
// The group line: what most of its members do.
export function groupLine({ yes = 0, no = 0, abstain = 0 }) {
  if (yes >= no && yes >= abstain) return 'favorevole';
  return abstain > no ? 'astenuto' : 'contrario';
}

// A complete reading of a vote, also for votes saved before abstentions were counted (split deterministically).
export function voteSummary(vote, { seed = null } = {}) {
  if (!vote) return null;
  const key = seed ?? vote.id ?? `${vote.chamber}|${vote.total}|${vote.yes}`;
  const groups = (vote.byGroup ?? []).map(row => {
    const seats = row.simulatedSeats ?? 0;
    const yes = row.yesVotes ?? 0;
    const split = Number.isFinite(row.noVotes) && Number.isFinite(row.abstainVotes) ? { yes, no: row.noVotes, abstain: row.abstainVotes } : splitGroupVote({ seats, yes, confidence: vote.confidence, seed: `${key}|${row.groupId}` });
    const line = row.line ?? groupLine(split);
    const withLine = split[{ favorevole: 'yes', contrario: 'no', astenuto: 'abstain' }[line]];
    return { groupId: row.groupId, seats, ...split, line, dissent: Math.max(0, seats - withLine), snipers: row.snipers ?? 0, governing: Boolean(row.governing), playerChoice: row.playerChoice ?? null };
  });
  const against = groups.length ? groups.reduce((sum, row) => sum + row.no, 0) : Math.max(0, (vote.total ?? 0) - (vote.yes ?? 0));
  const abstain = groups.reduce((sum, row) => sum + row.abstain, 0);
  return {
    id: vote.id ?? null, chamber: vote.chamber, date: vote.date ?? null, kind: vote.kind ?? 'legge', label: vote.label ?? null,
    yes: vote.yes ?? groups.reduce((sum, row) => sum + row.yes, 0), against, abstain, total: vote.total ?? groups.reduce((sum, row) => sum + row.seats, 0),
    needed: vote.needed ?? null, passed: Boolean(vote.passed), secret: Boolean(vote.secret), confidence: Boolean(vote.confidence), forced: Boolean(vote.forced),
    snipers: groups.reduce((sum, row) => sum + row.snipers, 0), dissent: groups.reduce((sum, row) => sum + row.dissent, 0), groups, source: 'simulation'
  };
}

// The vote of every seat of a chamber roster (see hemicycle.js): members of a group follow its line, the dissenters
// are drawn from the group with the vote's own sequence, the members least tied to the line first (a trait of each
// seat, the same in every vote: the usual dissenters of a group, never a statement about a real person). The player's
// seat votes as the player decided (recorded with the vote), otherwise with the line of the group (or in favour of an
// own bill). In a secret ballot the individual votes are not known.
export const independenceOf = seat => (hashOf(`indipendenza|${seat?.person?.id ?? `${seat?.groupId}|${seat?.placeholderIndex ?? 0}`}`) % 1000) / 1000;
export function individualVotes(summary, roster, { playerBill = false } = {}) {
  const choices = new Array(roster.length).fill('assente');
  if (!summary) return { choices, dissenters: [] };
  if (summary.secret) return { choices: choices.map((_, index) => roster[index]?.groupId ? 'segreto' : 'assente'), dissenters: [] };
  const dissenters = [];
  for (const group of summary.groups) {
    const decided = group.playerChoice ?? null;
    // A player who stayed away leaves the seat empty.
    const seats = roster.map((seat, index) => ({ seat, index })).filter(item => item.seat.groupId === group.groupId && !(item.seat.player && decided === 'assente'));
    if (!seats.length) continue;
    const random = seededRandom(`${summary.id ?? summary.chamber}|${group.groupId}|posti`);
    // The player's seat first, then who sets the group's line (group presidents, party leaders: they never break it),
    // then the others from the most to the least loyal, with a share of chance.
    const order = seats.map(item => ({ ...item, key: random() * 0.55 + independenceOf(item.seat) * 0.45 })).sort((a, b) => Number(b.seat.player) - Number(a.seat.player) || Number(Boolean(b.seat.keepsLine)) - Number(Boolean(a.seat.keepsLine)) || a.key - b.key);
    const counts = { favorevole: group.yes, contrario: group.no, astenuto: group.abstain };
    const sequence = [group.line, ...['favorevole', 'contrario', 'astenuto'].filter(choice => choice !== group.line)];
    if (order[0]?.seat.player && decided && counts[decided] > 0) sequence.unshift(decided);
    else if (playerBill && order[0]?.seat.player && counts.favorevole > 0) sequence.unshift('favorevole');
    let cursor = 0;
    for (const choice of [...new Set(sequence)]) {
      for (let taken = 0; taken < counts[choice] && cursor < order.length; taken++, cursor++) {
        const { seat, index } = order[cursor];
        choices[index] = choice;
        if (choice !== group.line) dissenters.push({ index, personId: seat.person?.id ?? null, player: Boolean(seat.player), groupId: group.groupId, choice, line: group.line });
      }
    }
  }
  return { choices, dissenters };
}

// Every simulated vote of the career, newest first: final and first readings of bills, confidence votes.
export function voteCatalog(parliament) {
  const items = [];
  for (const law of parliament?.laws ?? []) (law.votes ?? []).forEach((vote, index) => items.push({ ...vote, id: vote.id ?? `${law.id}-voto-${index + 1}`, date: vote.date ?? law.updatedAt ?? null, kind: vote.kind ?? (law.kind === 'decreto' ? 'decreto' : 'legge'), label: vote.label ?? law.title, lawId: law.id }));
  (parliament?.government?.confidenceVotes ?? []).forEach((entry, index) => (entry.votes ?? []).forEach(vote => items.push({ ...vote, id: vote.id ?? `fiducia-${index + 1}-${vote.chamber}`, date: vote.date ?? entry.date, kind: 'fiducia', confidence: true, label: vote.label ?? 'Fiducia al governo' })));
  return items.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
}
