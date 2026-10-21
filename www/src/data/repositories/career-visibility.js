// Which careers of this device an account may see. Leaving an account hides every career that was on the device to everyone but that account: nothing is deleted
// (slots, versions, backups and the online copies stay), the careers simply stop being listed, loaded or synced for anybody else until their owner signs in again.
// The record lives in the browser's localStorage next to the account session: { careers: { [careerId]: username } }.
const KEY = 'politicando.hidden-careers.v1';
const normalize = value => String(value ?? '').trim().toLowerCase();
const read = () => { try { const value = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null'); return value?.careers && typeof value.careers === 'object' ? value.careers : {}; } catch { return {}; } };
const write = careers => { try { globalThis.localStorage?.setItem(KEY, JSON.stringify({ version: 1, careers })); return true; } catch { return false; } };

// The account signed in on this browser (the same record the account module keeps), or null.
export const signedInUsername = () => { try { const value = JSON.parse(globalThis.localStorage?.getItem('politicando.account.v1') ?? 'null'); return value?.username && value?.token ? normalize(value.username) : null; } catch { return null; } };
// The account the career is reserved to, or null when it is not hidden.
export const hiddenOwner = careerId => read()[String(careerId ?? '')] ?? null;
// Is the career hidden from `username` (null = nobody signed in)?
export function isHiddenFrom(careerId, username = null) {
  const owner = hiddenOwner(careerId);
  return Boolean(owner) && owner !== normalize(username);
}
// Reserves the careers to `username`; a career already reserved to someone else stays theirs. Returns false when the browser could not keep the record.
export function hideCareers(careerIds, username) {
  const owner = normalize(username);
  if (!owner) return false;
  const next = { ...read() };
  for (const id of careerIds) if (id && !next[String(id)]) next[String(id)] = owner;
  return write(next);
}
// The account was deleted: its careers stay on the device as ordinary local ones.
export function releaseCareersOf(username) {
  const owner = normalize(username);
  const next = Object.fromEntries(Object.entries(read()).filter(([, value]) => value !== owner));
  return write(next);
}
export const hiddenCount = () => Object.keys(read()).length;
