// Rewards for time played and for rewarded videos. Game values (source: simulation), never real money or real advertising.
// The time counted here is the real time the player spends in the game (a monotonic clock, only while a career is open and the page is in the foreground), NOT the calendar of the simulation.
export const REWARD_TIMEZONE = 'Europe/Rome';
// One reward a day for each account (a local guest id for guests), whatever the careers and the devices: 500 € to the personal funds of the active career once 5 minutes have been played that day (Europe/Rome).
export const DAILY_REWARD = Object.freeze({ amount: 500, minutes: 5, category: 'ricompense', label: 'Ricompensa giornaliera' });
// Cumulative time of a career: every 30 minutes +4 political capital, every 60 minutes +4 electoral preparation (the limits of the game, 100, still hold: what is received is what is recorded).
export const PLAY_REWARDS = Object.freeze({
  capital: Object.freeze({ everyMinutes: 30, amount: 4, resource: 'Capitale politico' }),
  preparation: Object.freeze({ everyMinutes: 60, amount: 4, resource: 'Preparazione elettorale' }),
  max: 100
});
// A completed rewarded video moves the polls of the player's party by exactly this many points for this many weekly polls, taking them from another component of the survey (never from the player's party,
// never below the least a force has in the survey or the least "Altri" keeps). The effect never touches the base consensus of the parties.
export const AD_REWARD = Object.freeze({ points: 0.15, polls: 3, minShare: 0.2, minOthers: 0.5, keep: 120 });
// The clock: a tick is counted in full only when it is no longer than this (a longer gap means the page was frozen or the machine asleep), and a tab holds the lease for a few seconds at a time.
export const PLAY_CLOCK = Object.freeze({ tickMs: 1000, maxGapMs: 3000, leaseMs: 8000, saveEveryMs: 15000 });
export const REWARD_HISTORY_SIZE = 60;
