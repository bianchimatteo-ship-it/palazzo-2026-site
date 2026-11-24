// The thank-you reward of the update (core/welcome-reward.js, store.creditWelcomeReward, the window of app.js): 2,500 € of funds of the career, once per pair installation + user, only in the exact
// release of the promotion. Checked with the real store and an installation storage of its own for each «device»:
//   eligibility: Android 1.0.6 build 7 and iOS 1.0.2 build 3 release yes; the same versions in Debug no; older and newer versions no; the web and the TEST site (no native build) no;
//   first start of the target version (guest): pending until a career is open, then credited once (+2,500 € in the funds, an entry in the books, the flag of the promotion), the ledger credited after;
//   restart, more careers, save and reload, the restore of an older save: never a second credit; an account already registered, logout and login: the same pair; another user on the same device: once
//   for that pair; a change of device: once for the new pair, never twice in the same career (a career synced with the flag is not credited again);
//   the exact title, subtitle and amount of the window.
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const W = await import(new URL(`../src/core/welcome-reward.js?v=${build}`, import.meta.url).href);
const problems = [];
const check = (ok, text) => { if (!ok) problems.push(text); };
const memory = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key), map }; };
const ANDROID = { platform: 'android', version: '1.0.6', build: '7', debug: false };
const IOS = { platform: 'ios', version: '1.0.2', build: '3', debug: false };
// eligibility
check(W.promoEligible(ANDROID) && W.promoEligible(IOS), 'Le versioni di questa release sono idonee.');
for (const [info, what] of [[{ ...ANDROID, debug: true }, 'Android Debug'], [{ ...IOS, debug: true }, 'iOS Debug'], [{ ...ANDROID, version: '1.0.5', build: '6' }, 'Android precedente'], [{ ...ANDROID, version: '1.0.7', build: '8' }, 'Android successiva'],
  [{ ...IOS, version: '1.0.1', build: '2' }, 'iOS precedente'], [{ ...IOS, version: '1.0.3', build: '4' }, 'iOS successiva'], [{ ...ANDROID, build: '8' }, 'stesso nome, altro build'], [null, 'sito web / sito TEST'], [{ ...ANDROID, debug: undefined }, 'debug sconosciuto']])
  check(!W.promoEligible(info), `${what}: il premio non è attivo.`);
check(JSON.stringify(W.buildInfoFromUserAgent('Mozilla/5.0 (iPhone) AppleWebKit Mobile/15E148 PolitikandoApp/ios/1.0.2/3/release')) === JSON.stringify(IOS), 'iOS: la release si legge dal marcatore del web view.');
check(W.buildInfoFromUserAgent('Mozilla/5.0 (iPhone) PolitikandoApp/ios/1.0.2/3/debug').debug === true, 'iOS: il Debug si riconosce.');
check(W.buildInfoFromUserAgent('Mozilla/5.0 (Macintosh) Chrome/131') === null, 'Un browser non ha marcatore: niente premio.');
check(W.WELCOME_PROMO.title === 'GRAZIE PER GIOCARE A POLITICANDO 2026!' && W.WELCOME_PROMO.amount === 2500 && W.WELCOME_PROMO.badge === '+2.500 €', 'Titolo, importo e cifra mostrata sono quelli richiesti.');
check(W.WELCOME_PROMO.subtitle === 'Grazie per aver scelto di giocare a Politicando 2026. Per ringraziarti della tua partecipazione, abbiamo aggiunto 2.500 € ai fondi della tua carriera. Continua a costruire il tuo percorso nella politica italiana!', 'Il sottotitolo è il testo esatto.');
// the flow of the app: entry, credit when a career is open, ledger after
const flow = (store, device, info, user = null) => {
  const entry = W.welcomeEntry({ info, user, storage: device });
  if (!entry || entry.status === 'credited') return { entry, credited: false };
  if (!store.hasCareer()) return { entry, credited: false };
  const out = store.creditWelcomeReward(entry.key);
  if (out) W.markCredited({ key: entry.key, careerId: out.careerId, storage: device });
  return { entry, credited: Boolean(out) };
};
const { store } = await startCareer({ seed: 'premio-a', level: 'comunale', fast: true });
const fundsOf = () => store.getState().game.resources.funds;
const phone = memory();
// a Debug build and the web: nothing, nothing recorded
check(!flow(store, phone, { ...ANDROID, debug: true }).credited && !phone.map.has(W.LEDGER_KEY), 'Debug: nessun accredito e nessuna voce nel registro.');
check(!flow(store, phone, null).credited, 'Sito web / TEST: nessun accredito.');
// first start of the target version, as a guest, with a career
const before = fundsOf();
const first = flow(store, phone, ANDROID);
check(first.credited && fundsOf() === before + 2500, `Primo avvio della versione: +2.500 € ai fondi della carriera (${before} → ${fundsOf()}).`);
const entry = store.getState().game.finance.ledger.find(item => /ringraziamento/i.test(item.label ?? ''));
check(entry?.amount === 2500, 'Una voce nel registro economico della carriera.');
check(store.getState().game.flags.welcomeRewards?.[W.WELCOME_PROMO.id]?.key === first.entry.key, 'La carriera porta il segno del premio.');
check(store.getState().game.resources.politicalCapital !== undefined && entry?.category !== 'partito', 'Sono fondi della carriera, non capitale politico né fondi del partito.');
// restart: nothing more
check(!flow(store, phone, ANDROID).credited && fundsOf() === before + 2500, 'Al riavvio non si ripresenta.');
// save and reload
store.loadGame(JSON.parse(store.exportSave()));
check(!flow(store, phone, ANDROID).credited && fundsOf() === before + 2500, 'Dopo salvataggio e ricaricamento: nessun secondo accredito.');
// the restore of an older save (without the flag)
{
  const old = JSON.parse(store.exportSave()); old.game.flags.welcomeRewards = {}; old.game.resources.funds = before;
  store.loadGame(old);
  check(!flow(store, phone, ANDROID).credited && fundsOf() === before, 'Ripristino di un salvataggio precedente: il premio non si duplica.');
}
// another career on the same device and user
{
  const other = await startCareer({ seed: 'premio-b', level: 'comunale', fast: true });
  const funds = other.store.getState().game.resources.funds;
  check(!flow(other.store, phone, ANDROID).credited && other.store.getState().game.resources.funds === funds, 'Più carriere sullo stesso dispositivo: nessun secondo premio.');
}
// an account: logout and login (the same pair), another user on the same device (a new pair: once)
{
  const tablet = memory();
  const { store: s1 } = await startCareer({ seed: 'premio-c', level: 'comunale', fast: true });
  check(flow(s1, tablet, IOS, 'mario.rossi').credited, 'Account già registrato: il premio arriva una volta.');
  check(!flow(s1, tablet, IOS, 'mario.rossi').credited, 'Logout e nuovo login dello stesso utente: nessun secondo premio.');
  const { store: s2 } = await startCareer({ seed: 'premio-d', level: 'comunale', fast: true });
  check(flow(s2, tablet, IOS, 'giulia.bianchi').credited, 'Un altro utente sullo stesso dispositivo: una volta per la sua coppia.');
  check(!flow(s2, tablet, IOS, 'giulia.bianchi').credited, '…e mai due volte.');
}
// pending without a career: nothing until a career is open
{
  const fresh = memory();
  const empty = { hasCareer: () => false, creditWelcomeReward: () => { throw new Error('non deve accreditare'); } };
  const out = flow(empty, fresh, ANDROID);
  check(!out.credited && out.entry?.status === 'pending', 'Senza carriera il premio resta in sospeso.');
  const { store: s3 } = await startCareer({ seed: 'premio-e', level: 'comunale', fast: true });
  check(flow(s3, fresh, ANDROID).credited, 'Creata la carriera, il premio sospeso viene accreditato.');
}
// a change of device: the synced career with the flag is not credited again; the new pair gets it in a career that has not had it
{
  const deviceA = memory(), laptop = memory();
  const source = await startCareer({ seed: 'premio-f', level: 'comunale', fast: true });
  check(flow(source.store, deviceA, ANDROID, 'luca.verdi').credited, 'Primo dispositivo: premio accreditato.');
  const saved = JSON.parse(source.store.exportSave());
  const synced = await startCareer({ seed: 'premio-g', level: 'comunale', fast: true });
  synced.store.loadGame(saved);
  const funds = synced.store.getState().game.resources.funds;
  const out = flow(synced.store, laptop, ANDROID, 'luca.verdi');
  check(!out.credited && synced.store.getState().game.resources.funds === funds, 'Cambio di dispositivo: la carriera sincronizzata, che ha già il premio, non lo riceve due volte.');
  check(out.entry?.status === 'pending', 'La nuova coppia dispositivo + utente resta in attesa di una carriera che non lo abbia avuto.');
  const fresh = await startCareer({ seed: 'premio-h', level: 'comunale', fast: true });
  check(flow(fresh.store, laptop, ANDROID, 'luca.verdi').credited && !flow(fresh.store, laptop, ANDROID, 'luca.verdi').credited, 'Sul nuovo dispositivo il premio arriva una sola volta, in una carriera che non lo aveva.');
  const id1 = W.installationId(laptop), id2 = W.installationId(laptop);
  check(id1 === id2 && id1 !== W.installationId(phone), 'L’identificativo dell’installazione è stabile e diverso per ogni installazione (nessuna impronta del dispositivo).');
}
if (problems.length) { console.error(`Premio di ringraziamento — problemi:\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('Premio di ringraziamento verificato: attivo solo su Android 1.0.6 (7) e iOS 1.0.2 (3) release, mai in Debug, su versioni precedenti o successive, sul web o sul sito TEST; primo avvio, ospite, account, logout/login, altro utente, più carriere, salvataggio e ricaricamento, ripristino di un salvataggio, cambio di dispositivo e premio in sospeso senza carriera: una sola volta per coppia dispositivo + utente, +2.500 € ai fondi della carriera con voce nel registro; titolo, sottotitolo e importo esatti.');
