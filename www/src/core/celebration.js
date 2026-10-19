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
