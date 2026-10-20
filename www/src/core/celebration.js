// A real win (an election that gives the player a seat or an office, a party congress won) is marked once, discreetly, and never twice. The mark waits in the game
// (`game.celebrations.pending`) until the player sees it; seeing it (or dismissing it) moves it to `seen`, so a redraw, a reload or a saved game never brings it back.
// A defeat, a seat lost or a result that is not a win never creates one. Nothing here moves any number of the simulation.
const SEEN_LIMIT = 60;

export function celebrate(game, { id, kind, title, body = '', date = null }) {
  if (!game || !id) return false;
  const box = game.celebrations ??= { pending: null, seen: [] };
  if (!Array.isArray(box.seen)) box.seen = [];
  if (box.seen.includes(id) || box.pending?.id === id) return false;
  box.pending = { id, kind, title, body, date };
  return true;
}
export function dismissCelebration(game, id) {
  const box = game?.celebrations;
  if (!box?.pending || (id && box.pending.id !== id)) return false;
  box.seen = [...(box.seen ?? []), box.pending.id].slice(-SEEN_LIMIT);
  box.pending = null;
  return true;
}
export const pendingCelebration = game => game?.celebrations?.pending ?? null;

// An election that is a real win for the player: elected (a seat or an office) with an outcome that is good, not a defeat softened by a consolation seat.
export function electionWin(result, outcome) {
  return Boolean(result?.personalMandate) && outcome?.tone === 'good';
}

// ---------- the official outcome of a vote or of a congress ----------
// Besides the discreet mark of a win, every official result — an election, a party congress — is told once in a card at the centre of the page: what happened, the percentage, the position, the mandate won
// or missed (election) or the winning line, the share of the delegates and the margin (congress). It does not block the game, it is closed by the player (or Escape), and it is never shown twice: its id joins
// the same `seen` list of the celebrations, so a redraw, a save or a reload does not bring it back. Nothing here moves any number of the simulation.
// kind 'elezione' | 'congresso'; tone 'win' (a real victory) | 'partial' (a seat that is not a victory, a result in between) | 'loss'.
export function announceOutcome(game, { id, kind, tone, title, headline, lines = [], date = null, celebrationId = null }) {
  if (!game || !id) return false;
  const box = game.celebrations ??= { pending: null, seen: [] };
  if (!Array.isArray(box.seen)) box.seen = [];
  const queue = box.outcomeQueue ??= [];
  if (box.seen.includes(id) || box.outcome?.id === id || queue.some(item => item.id === id)) return false;
  const card = { id, kind, tone, title, headline, lines, date, celebrationId };
  // one card at a time: a second result (a congress the same week as a vote) waits its turn instead of replacing the first
  if (box.outcome) queue.push(card); else box.outcome = card;
  return true;
}
export function dismissOutcome(game, id) {
  const box = game?.celebrations;
  if (!box?.outcome || (id && box.outcome.id !== id)) return false;
  box.seen = [...(box.seen ?? []), box.outcome.id].slice(-SEEN_LIMIT);
  // the discreet mark of the same result goes with it: one result, one notice
  if (box.outcome.celebrationId && box.pending?.id === box.outcome.celebrationId) { box.seen = [...box.seen, box.pending.id].slice(-SEEN_LIMIT); box.pending = null; }
  box.outcome = (box.outcomeQueue ?? []).shift() ?? null;
  return true;
}
export const pendingOutcome = game => game?.celebrations?.outcome ?? null;
// The kind of result of an election, told without exaggeration: a win is a win only when the mandate comes with a good outcome.
export function electionTone(result, outcome) {
  if (electionWin(result, outcome)) return 'win';
  return result?.personalMandate ? 'partial' : 'loss';
}
