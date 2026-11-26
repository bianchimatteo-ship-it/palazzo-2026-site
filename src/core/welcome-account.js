// Loaded only for a player signed in (ui/app.js), not with the first screen.
import { WELCOME_PROMO, readLedger, rewardKey, writeLedger } from './welcome-reward.js?v=20261126-3';
// Signed in: one claim per account on the Worker (reward_community «benvenuto»); a guest has only this device (docs/qa/premio-benvenuto-deduplicazione.md).
export const ACCOUNT_REWARD = 'benvenuto';
// 'bind' when this installation credited it as a guest (the claim goes to the account, no new credit), else 'claim'
export function accountStep({ key, user, storage = globalThis.localStorage, promo = WELCOME_PROMO }) {
  if (!user) return { action: 'local' };
  const guestKey = rewardKey(promo.id, key.split('|')[1], null), guest = readLedger(storage)[guestKey];
  return guest?.status === 'credited' && !guest.boundTo ? { action: 'bind', guestKey } : { action: 'claim' };
}
// → 'credit' (first claim of the account), 'skip' (already had), 'retry' (no answer)
export function settleAccountAnswer({ key, answer, guestKey = null, user = null, storage = globalThis.localStorage, now = new Date().toISOString() }) {
  if (!answer || answer.ok === false || answer.error) return 'retry';
  if (answer.claimed && !guestKey) return 'credit';
  const ledger = readLedger(storage);
  if (guestKey) ledger[guestKey] = { ...ledger[guestKey], boundTo: user, boundAt: now };
  ledger[key] = { ...ledger[key], status: 'credited', via: guestKey ? 'ospite' : 'account', creditedAt: now };
  writeLedger(storage, ledger);
  return 'skip';
}
