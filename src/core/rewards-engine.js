// Rewards of the game for time played and for rewarded videos (the rules are in data/simulation/reward-rules.js). Pure functions on the game state: the store gives them the game and the journal of the device
// and keeps what they return. Nothing here has rules of its own about politics: the funds go through book() of the finance engine (the personal funds of the career, never the treasury of the party), the political
// capital and the preparation are the resources the game already has (game.resources.politicalCapital, game.prep) with the limits it already has.
import { AD_REWARD, COMMUNITY_REWARD, DAILY_REWARD, PLAY_REWARDS, REWARD_HISTORY_SIZE, REWARD_TIMEZONE } from '../data/simulation/reward-rules.js?v=20261031-3';
import { book } from './finance-engine.js?v=20261031-3';

const SIM = 'simulation';
const MINUTE = 60000;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// The day of a moment in Europe/Rome, as YYYY-MM-DD (the reference of the daily reward, wherever the player is).
export function romeDay(moment = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: REWARD_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(moment));
  const get = type => parts.find(item => item.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// What a game carries of its rewards (saves of before have none: they start from zero). playMs is the cumulative real time played in this career; paidCapital / paidPrep are the blocks of 30 and 60 minutes
// already credited; daily lists the ids of the daily rewards credited to this career; ads the ids of the completed videos whose effect was handed to the world; history is what was really received.
export function normalizeRewards(input) {
  const value = input && typeof input === 'object' ? input : {};
  const count = item => Number.isSafeInteger(item) && item > 0 ? item : 0;
  return {
    version: 1, source: SIM,
    playMs: Number.isFinite(value.playMs) && value.playMs > 0 ? Math.floor(value.playMs) : 0,
    paidCapital: count(value.paidCapital), paidPrep: count(value.paidPrep),
    daily: Array.isArray(value.daily) ? value.daily.filter(item => typeof item === 'string').slice(-400) : [],
    community: Array.isArray(value.community) ? value.community.filter(item => typeof item === 'string').slice(-40) : [],
    ads: Array.isArray(value.ads) ? value.ads.filter(item => typeof item === 'string').slice(-AD_REWARD.keep) : [],
    history: Array.isArray(value.history) ? value.history.filter(item => item && typeof item.id === 'string').slice(0, REWARD_HISTORY_SIZE) : []
  };
}
export const blocksOf = (playMs, everyMinutes) => Math.floor(Math.max(0, playMs) / (everyMinutes * MINUTE));
const remember = (rewards, entry) => { if (!rewards.history.some(item => item.id === entry.id)) rewards.history = [entry, ...rewards.history].slice(0, REWARD_HISTORY_SIZE); };

// The blocks of time that are complete: every 30 minutes +4 political capital, every 60 minutes +4 preparation, up to the blocks `basisMs` reaches. Every block has its own id (the career and its number) and a counter
// that only goes forward, so that crediting it twice is impossible. The amount recorded is what was really received: a resource at 100 gets nothing (and the entry says 0), a resource at 98 gets 2.
export function creditBlocks(game, basisMs, { at = new Date().toISOString(), careerId = '' } = {}) {
  game.rewards = normalizeRewards(game.rewards);
  const rewards = game.rewards, credited = [];
  while (rewards.paidCapital < blocksOf(basisMs, PLAY_REWARDS.capital.everyMinutes)) {
    rewards.paidCapital++;
    const spec = PLAY_REWARDS.capital, before = game.resources.politicalCapital ?? 0;
    game.resources.politicalCapital = clamp(before + spec.amount, 0, PLAY_REWARDS.max);
    credited.push({ id: `tempo-capitale-${careerId}-${rewards.paidCapital}`, kind: 'capitale', at, requested: spec.amount, amount: game.resources.politicalCapital - before, resource: spec.resource, minutes: rewards.paidCapital * spec.everyMinutes });
  }
  while (rewards.paidPrep < blocksOf(basisMs, PLAY_REWARDS.preparation.everyMinutes)) {
    rewards.paidPrep++;
    const spec = PLAY_REWARDS.preparation, before = game.prep ?? 0;
    game.prep = clamp(before + spec.amount, 0, PLAY_REWARDS.max);
    credited.push({ id: `tempo-preparazione-${careerId}-${rewards.paidPrep}`, kind: 'preparazione', at, requested: spec.amount, amount: game.prep - before, resource: spec.resource, minutes: rewards.paidPrep * spec.everyMinutes });
  }
  for (const entry of credited) remember(rewards, entry);
  return credited;
}

// Time played: adds the real milliseconds to the career and (unless `credit` is false) credits the blocks that are now complete. Returns the entries credited now.
// `credit: false` is for an account whose time is merged by the Worker: the time is shown at once, the blocks are credited from the time the Worker confirms (confirmPlayTime), never from the device alone.
export function addPlayTime(game, ms, { at = new Date().toISOString(), careerId = '', credit = true } = {}) {
  game.rewards = normalizeRewards(game.rewards);
  if (!(ms > 0)) return [];
  game.rewards.playMs += Math.floor(ms);
  return credit ? creditBlocks(game, game.rewards.playMs, { at, careerId }) : [];
}

// The Worker's merged time of the career (`confirmedMs`) plus what is not delivered yet (`pendingMs`): the figure shown is set to it (a copy of the career open at the same time may have played the same minutes: they
// are one) and the blocks are credited up to what the Worker confirmed. A block that was credited stays credited (the counters never go back).
export function confirmPlayTime(game, confirmedMs, pendingMs = 0, { at = new Date().toISOString(), careerId = '' } = {}) {
  game.rewards = normalizeRewards(game.rewards);
  game.rewards.playMs = Math.max(0, Math.floor(confirmedMs + pendingMs));
  return creditBlocks(game, confirmedMs, { at, careerId });
}

// A one-off community reward (the Instagram one): funds through book() (the personal funds, category «ricompense») and political capital within the limit of the game, in one step, once for each id.
// Two history entries (funds and capital) with what was really received. Returns the entries, or null if the id was already credited.
export function creditCommunity(game, spec, { id, at = new Date().toISOString(), date = null }) {
  game.rewards = normalizeRewards(game.rewards);
  if (!id || game.rewards.community.includes(id)) return null;
  const funds = book(game, spec.funds, spec.category, spec.label, date ?? at.slice(0, 10));
  const before = game.resources.politicalCapital ?? 0;
  game.resources.politicalCapital = clamp(before + spec.capital, 0, PLAY_REWARDS.max);
  game.rewards.community = [...game.rewards.community, id].slice(-40);
  const entries = [
    { id: `${id}-fondi`, kind: 'community', at, requested: spec.funds, amount: funds, resource: 'Fondi personali', reward: spec.id },
    { id: `${id}-capitale`, kind: 'community', at, requested: spec.capital, amount: game.resources.politicalCapital - before, resource: PLAY_REWARDS.capital.resource, reward: spec.id }
  ];
  for (const entry of entries) remember(game.rewards, entry);
  return entries;
}

// The daily reward: 500 € to the personal funds (book(), category «ricompense»: it shows in the books as an income, apart from the treasury of the party). One id for each account and day.
export function creditDaily(game, { id, day, at = new Date().toISOString(), date = null }) {
  game.rewards = normalizeRewards(game.rewards);
  if (!id || game.rewards.daily.includes(id)) return null;
  const amount = book(game, DAILY_REWARD.amount, DAILY_REWARD.category, DAILY_REWARD.label, date ?? at.slice(0, 10));
  game.rewards.daily = [...game.rewards.daily, id].slice(-400);
  const entry = { id, kind: 'giornaliera', at, requested: DAILY_REWARD.amount, amount, resource: 'Fondi personali', day };
  remember(game.rewards, entry);
  return entry;
}

// What the device remembers of a career (journal) and the save does not (a save that was not written, a manual save, an older copy): the missing blocks are credited, the ids already in the save are never credited again.
// journal: { playMs, daily: [{ id, day, at }], history }. Returns the entries credited now.
export function reconcileRewards(game, journal, { careerId = '', date = null, credit = true } = {}) {
  game.rewards = normalizeRewards(game.rewards);
  const credited = [];
  if (!journal) return credited;
  const ahead = Math.floor(journal.playMs ?? 0) - game.rewards.playMs;
  if (ahead > 0) credited.push(...addPlayTime(game, ahead, { careerId, at: journal.updatedAt ?? new Date().toISOString(), credit }));
  for (const item of journal.daily ?? []) if (item?.id && !game.rewards.daily.includes(item.id)) { const entry = creditDaily(game, { id: item.id, day: item.day, at: item.at, date }); if (entry) credited.push(entry); }
  for (const item of journal.community ?? []) if (item?.id && COMMUNITY_REWARD[item.reward] && !game.rewards.community.includes(item.id)) { const entries = creditCommunity(game, COMMUNITY_REWARD[item.reward], { id: item.id, at: item.at, date }); if (entries) credited.push(...entries); }
  return credited;
}

// The history shown to the player: what was really received, newest first.
export const rewardHistory = game => normalizeRewards(game?.rewards).history;

// Progress towards the next rewards, for the page: minutes of the career, and how far each block is.
export function playProgress(game) {
  const rewards = normalizeRewards(game?.rewards);
  const progress = spec => { const size = spec.everyMinutes * MINUTE; const into = rewards.playMs % size; return { everyMinutes: spec.everyMinutes, amount: spec.amount, minutes: Math.floor(into / MINUTE), seconds: Math.floor(into / 1000), fraction: into / size, blocks: Math.floor(rewards.playMs / size), resource: spec.resource }; };
  return { totalMs: rewards.playMs, totalMinutes: Math.floor(rewards.playMs / MINUTE), capital: progress(PLAY_REWARDS.capital), preparation: progress(PLAY_REWARDS.preparation) };
}
