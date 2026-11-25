// The credit of a rewarded video of personal funds (ui/funds-ad.js), loaded on demand by store.claimFundsAdReward: 1.000 € through book() of the finance engine (the personal funds of the career,
// category «ricompense», with its entry in the books; never the treasury of the party), once for each completion id: the save of the career and the journal of the device both remember it (a reopened app, a restored save or a repeated callback never pay it twice). Returns the entry, or null.
import { AD_FUNDS } from '../data/simulation/funds-ad-rules.js?v=20261125-10';
import { book } from './finance-engine.js?v=20261125-10';
import { normalizeRewards } from './rewards-engine.js?v=20261125-10';
import { REWARD_HISTORY_SIZE } from '../data/simulation/reward-rules.js?v=20261125-10';
import { rewardsJournal } from '../data/repositories/rewards-journal.js?v=20261125-10';

export function creditFundsAd(game, { id, at = new Date().toISOString(), date = null }, journal = rewardsJournal) {
  game.rewards = normalizeRewards(game.rewards);
  if (!id || game.rewards.funds.includes(id) || game.rewards.ads.includes(id) || journal.adSeen(id)) return null;   // one claim for each id, whatever its reward
  const amount = book(game, AD_FUNDS.amount, AD_FUNDS.category, AD_FUNDS.label, date ?? at.slice(0, 10));
  game.rewards.funds = [...game.rewards.funds, id].slice(-AD_FUNDS.keep);
  journal.adRemember(id, at);
  const entry = { id, kind: 'video-fondi', at, requested: AD_FUNDS.amount, amount, resource: 'Fondi personali' };
  if (!game.rewards.history.some(item => item.id === entry.id)) game.rewards.history = [entry, ...game.rewards.history].slice(0, REWARD_HISTORY_SIZE);
  return entry;
}
