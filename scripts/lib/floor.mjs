// The player's ballots for the scripts that run the engines without a page. In the game a vote of an assembly where the player sits opens and waits for the player's own ballot (Favorevole, Contrario or
// Astenuto: never a default); a script that plays weeks in a row has nobody to ask, so it brings a voter of its own, which casts an explicit ballot whenever a vote comes.
const BALLOTS = ['favorevole', 'contrario', 'astenuto'];
// The intention the player declared on the card when there is one, otherwise the line of the player's group.
export const lineVoter = (item, line) => BALLOTS.includes(item?.pendingPlayerVote) ? item.pendingPlayerVote : BALLOTS.includes(line) ? line : 'astenuto';
// Casts every open vote of the career in the store (the first `pick` that returns a ballot; by default the line of the group); returns what was cast.
export function castOpenVotes(store, pick = vote => vote.intention ?? vote.line) {
  const cast = [];
  for (let guard = 0; guard < 40; guard++) {
    const open = store.openVotes();
    if (!open.length) break;
    const vote = open[0];
    const choice = pick(vote);
    cast.push({ vote, choice, out: store.castOpenVote(vote.id, BALLOTS.includes(choice) ? choice : 'astenuto') });
  }
  return cast;
}
