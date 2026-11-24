// The thank-you reward of the November 2026 update: 2,500 € of FUNDS OF THE CAREER (not political capital, not funds of the party, not real money), once for each pair device + user, and only
// in the release of the stores this promotion belongs to (Android 1.0.6 build 7, iOS 1.0.2 build 3). Not on the web (the TEST site included), not in a Debug build, not in an older or a newer
// version. No tracking: the device is a random id of this installation kept in its own storage (never a fingerprint); the user is the account signed in, or «ospite».
// The record is idempotent at two levels: the ledger of this installation (pending → credited, keyed by promotion + installation + user) and the flag the credit leaves in the career
// (game.flags.welcomeRewards). The credit is atomic in the store (funds, entry in the books, flag, in one state change) and the ledger is marked credited only after it.
export const WELCOME_PROMO = Object.freeze({
  id: 'grazie-aggiornamento-2026-11',
  amount: 2500,
  targets: Object.freeze({ android: Object.freeze({ version: '1.0.6', build: '7' }), ios: Object.freeze({ version: '1.0.2', build: '3' }) }),
  title: 'GRAZIE PER GIOCARE A POLITICANDO 2026!',
  subtitle: 'Grazie per aver scelto di giocare a Politicando 2026. Per ringraziarti della tua partecipazione, abbiamo aggiunto 2.500 € ai fondi della tua carriera. Continua a costruire il tuo percorso nella politica italiana!',
  badge: '+2.500 €'
});
export const INSTALL_KEY = 'politicando.install.v1';
export const LEDGER_KEY = 'politicando.rewards.welcome.v1';

// What the native app says about itself: { platform: 'android'|'ios', version, build, debug } or null (the web). iOS writes it in the user agent of its web view (ios/App/App/MainViewController.swift):
// «PolitikandoApp/ios/<version>/<build>/<release|debug>»; Android answers through its bridge (AppodealAds.buildInfo).
export function buildInfoFromUserAgent(userAgent = '') {
  const match = String(userAgent).match(/PolitikandoApp\/(android|ios)\/([\w.]+)\/(\w+)\/(release|debug)/);
  return match ? { platform: match[1], version: match[2], build: match[3], debug: match[4] === 'debug' } : null;
}
// Whether this build is the one of the promotion (exact version and build, a release, a native app).
export function promoEligible(info, promo = WELCOME_PROMO) {
  if (!info || info.debug !== false) return false;
  const target = promo.targets[info.platform];
  return Boolean(target) && String(info.version) === target.version && String(info.build) === target.build;
}
const safe = fn => { try { return fn(); } catch { return null; } };
// The id of this installation: random, made once, kept in this installation's storage (a reinstall is a new installation).
export function installationId(storage = globalThis.localStorage, makeId = () => globalThis.crypto?.randomUUID?.() ?? `inst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`) {
  const known = safe(() => storage?.getItem(INSTALL_KEY));
  if (known) return known;
  const id = makeId();
  safe(() => storage?.setItem(INSTALL_KEY, id));
  return id;
}
export const rewardKey = (promoId, installId, user) => `${promoId}|${installId}|${user || 'ospite'}`;
const readLedger = storage => safe(() => JSON.parse(storage?.getItem(LEDGER_KEY) ?? '{}')) ?? {};
const writeLedger = (storage, ledger) => safe(() => storage?.setItem(LEDGER_KEY, JSON.stringify(ledger)));
// The entry of this pair: created «pending» the first time an eligible build runs; null when the build is not the one of the promotion.
export function welcomeEntry({ info, user = null, storage = globalThis.localStorage, promo = WELCOME_PROMO, now = new Date().toISOString() } = {}) {
  if (!promoEligible(info, promo)) return null;
  const key = rewardKey(promo.id, installationId(storage), user);
  const ledger = readLedger(storage);
  if (!ledger[key]) { ledger[key] = { status: 'pending', since: now, platform: info.platform, version: info.version, build: info.build }; writeLedger(storage, ledger); }
  return { key, ...ledger[key] };
}
export function markCredited({ key, careerId, storage = globalThis.localStorage, now = new Date().toISOString() }) {
  const ledger = readLedger(storage);
  ledger[key] = { ...(ledger[key] ?? {}), status: 'credited', careerId, creditedAt: now };
  writeLedger(storage, ledger);
}
// The credit on a game (pure): +amount to the funds of the career, the entry in the books, the flag of the promotion. Returns null when it cannot be credited (no career, already credited to this
// career, a flag of the same pair). `book` is the bookkeeping function of finance-engine.js.
export function creditGame(game, { key, date, book, promo = WELCOME_PROMO }) {
  if (!game?.resources) return null;
  const flags = game.flags?.welcomeRewards ?? {};
  if (flags[promo.id]) return null;
  const next = JSON.parse(JSON.stringify(game));
  if (typeof book === 'function') book(next, promo.amount, 'premi', 'Premio di ringraziamento per l’aggiornamento di Politicando 2026', date);
  else next.resources.funds = (next.resources.funds ?? 0) + promo.amount;
  next.flags = { ...(next.flags ?? {}), welcomeRewards: { ...flags, [promo.id]: { key, date, amount: promo.amount } } };
  return next;
}
