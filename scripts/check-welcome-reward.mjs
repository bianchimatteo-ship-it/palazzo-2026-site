// The thank-you reward of the update (core/welcome-reward.js, store.creditWelcomeReward, the window of app.js): 2,500 € of funds of the career, once per pair installation + user, only in the exact
// release of the promotion. Checked with the real store and an installation storage of its own for each «device»:
//   eligibility: Android 1.0.6 build 7 and 1.0.7 build 8, iOS 1.0.2 build 3 and 1.0.3 build 4 release yes (one reward across the builds); the same versions in Debug no; older and newer versions no; the web and the TEST site (no native build) no;
//   first start of the target version (guest): pending until a career is open, then credited once (+2,500 € in the funds, an entry in the books, the flag of the promotion), the ledger credited after;
//   restart, more careers, save and reload, the restore of an older save: never a second credit; an account already registered, logout and login: the same pair; another user on the same device: once
//   for that pair; a change of device: once for the new pair, never twice in the same career (a career synced with the flag is not credited again);
//   the exact title, subtitle and amount of the window.
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const W = { ...(await import(new URL(`../src/core/welcome-reward.js?v=${build}`, import.meta.url).href)), ...(await import(new URL(`../src/core/welcome-account.js?v=${build}`, import.meta.url).href)) };
const problems = [];
const check = (ok, text) => { if (!ok) problems.push(text); };
const memory = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key), map }; };
const ANDROID = { platform: 'android', version: '1.0.6', build: '7', debug: false };
const IOS = { platform: 'ios', version: '1.0.2', build: '3', debug: false };
// eligibility
check(W.promoEligible(ANDROID) && W.promoEligible(IOS), 'Le versioni della release della promozione restano idonee (Android 1.0.6 build 7, iOS 1.0.2 build 3).');
// 25/11/2026: the next build of each platform is authorised too (the update that follows); the versions are those of the native projects (+1), checked here against android/app/build.gradle and the Xcode project
{
  const { readFileSync } = await import('node:fs');
  const gradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8'), pbx = readFileSync(new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url), 'utf8');
  const vc = Number(gradle.match(/versionCode (\d+)/)?.[1]), vn = gradle.match(/versionName "([^"]+)"/)?.[1];
  const mv = pbx.match(/MARKETING_VERSION = ([^;]+);/)?.[1], cv = Number(pbx.match(/CURRENT_PROJECT_VERSION = (\d+);/)?.[1]);
  const bump = v => v.replace(/(\d+)$/, n => String(Number(n) + 1));
  check(W.promoEligible({ platform: 'android', version: vn, build: String(vc), debug: false }), `Android del progetto (${vn} build ${vc}): idonea.`);
  check(W.promoEligible({ platform: 'android', version: bump(vn), build: String(vc + 1), debug: false }), `Android successiva prevista (${bump(vn)} build ${vc + 1}): idonea.`);
  check(W.promoEligible({ platform: 'ios', version: mv, build: String(cv), debug: false }), `iOS del progetto (${mv} build ${cv}): idonea.`);
  check(W.promoEligible({ platform: 'ios', version: bump(mv), build: String(cv + 1), debug: false }), `iOS successiva prevista (${bump(mv)} build ${cv + 1}): idonea.`);
  check(W.WELCOME_PROMO.id === 'grazie-aggiornamento-2026-11' && W.WELCOME_PROMO.amount === 2500, 'Stessa promozione (stesso id, stesso importo): nessuna nuova promozione.');
}
for (const [info, what] of [[{ ...ANDROID, debug: true }, 'Android Debug'], [{ ...IOS, debug: true }, 'iOS Debug'], [{ ...ANDROID, version: '1.0.5', build: '6' }, 'Android precedente'], [{ ...ANDROID, version: '1.0.8', build: '9' }, 'Android oltre la prossima'], [{ ...ANDROID, version: '1.0.7', build: '9' }, 'Android 1.0.7 con un altro build'],
  [{ ...IOS, version: '1.0.1', build: '2' }, 'iOS precedente'], [{ ...IOS, version: '1.0.4', build: '5' }, 'iOS oltre la prossima'], [{ ...IOS, version: '1.0.3', build: '5' }, 'iOS 1.0.3 con un altro build'], [{ ...ANDROID, build: '8' }, 'stesso nome, altro build'], [null, 'sito web / sito TEST'], [{ ...ANDROID, debug: undefined }, 'debug sconosciuto']])
  check(!W.promoEligible(info), `${what}: il premio non è attivo.`);
check(JSON.stringify(W.buildInfoFromUserAgent('Mozilla/5.0 (iPhone) AppleWebKit Mobile/15E148 PolitikandoApp/ios/1.0.2/3/release')) === JSON.stringify(IOS), 'iOS: la release si legge dal marcatore del web view.');
check(W.buildInfoFromUserAgent('Mozilla/5.0 (iPhone) PolitikandoApp/ios/1.0.2/3/debug').debug === true, 'iOS: il Debug si riconosce.');
check(W.buildInfoFromUserAgent('Mozilla/5.0 (Macintosh) Chrome/131') === null, 'Un browser non ha marcatore: niente premio.');
check(W.WELCOME_PROMO.title === 'GRAZIE PER GIOCARE A POLITICANDO 2026!' && W.WELCOME_PROMO.amount === 2500 && W.WELCOME_PROMO.badge === '+2.500 €', 'Titolo, importo e cifra mostrata sono quelli richiesti.');
check(W.WELCOME_PROMO.subtitle === 'Grazie per aver scelto di giocare a Politicando 2026. Per ringraziarti della tua partecipazione, abbiamo aggiunto 2.500 € ai fondi della tua carriera. Continua a costruire il tuo percorso nella politica italiana!', 'Il sottotitolo è il testo esatto.');
// the flow of the app: entry, credit when a career is open, ledger after; a signed-in user asks the Worker first (the claim of the account: worker.js reward_community «benvenuto», here a stand-in
// with the same rule: the first claim of an account is { claimed: true }, the next ones { claimed: false, already: true }; `down` = no answer)
const server = { accounts: new Set(), down: false, claim(user) { if (this.down) return null; const first = !this.accounts.has(user); this.accounts.add(user); return { ok: true, claimed: first, already: !first }; } };
const flow = (store, device, info, user = null) => {
  const entry = W.welcomeEntry({ info, user, storage: device });
  if (!entry || entry.status === 'credited') return { entry, credited: false };
  if (!store.hasCareer()) return { entry, credited: false };
  if (user) {
    const step = W.accountStep({ key: entry.key, user, storage: device });
    const verdict = W.settleAccountAnswer({ key: entry.key, answer: server.claim(user), guestKey: step.action === 'bind' ? step.guestKey : null, user, storage: device });
    if (verdict !== 'credit') return { entry: { ...entry, status: W.welcomeEntry({ info, user, storage: device })?.status }, credited: false, verdict };
  }
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
  check(out.entry?.status === 'credited', 'Sul nuovo dispositivo lo stesso account risulta già premiato (il Worker ha la sua richiesta): nessuna attesa di un secondo accredito.');
  // since 24/11/2026 the reward of a signed-in player belongs to the ACCOUNT (the Worker): a second device of the same account does not get it again (a device cannot be told from a reinstallation
  // without identifying the hardware, which the game never does)
  const fresh = await startCareer({ seed: 'premio-h', level: 'comunale', fast: true });
  const fundsFresh = fresh.store.getState().game.resources.funds;
  check(!flow(fresh.store, laptop, ANDROID, 'luca.verdi').credited && fresh.store.getState().game.resources.funds === fundsFresh, 'Stesso account su un secondo dispositivo: nessun secondo premio (il premio è dell’account).');
  const id1 = W.installationId(laptop), id2 = W.installationId(laptop);
  check(id1 === id2 && id1 !== W.installationId(phone), 'L’identificativo dell’installazione è stabile e diverso per ogni installazione (nessuna impronta del dispositivo).');
}
// reinstallation and cleared data
{
  const { store: s5 } = await startCareer({ seed: 'premio-i', level: 'comunale', fast: true });
  const before5 = s5.getState().game.resources.funds;
  const phoneA = memory();
  check(flow(s5, phoneA, ANDROID, 'anna.neri').credited, 'Account: primo premio.');
  const reinstalled = memory();   // the app removed and installed again: storage empty, a new installation id
  const { store: s6 } = await startCareer({ seed: 'premio-j', level: 'comunale', fast: true });
  const funds6 = s6.getState().game.resources.funds;
  check(!flow(s6, reinstalled, ANDROID, 'anna.neri').credited && s6.getState().game.resources.funds === funds6, 'Reinstallazione con lo stesso account: nessun secondo premio (il Worker ha già il premio dell’account).');
  check(W.welcomeEntry({ info: ANDROID, user: 'anna.neri', storage: reinstalled })?.status === 'credited', '…e il dispositivo reinstallato lo segna come già ricevuto.');
  void before5;
  // a guest who gets it, then signs in on the same installation: the claim goes to the account, nothing is credited again; the account on another device gets nothing either
  const tabletG = memory();
  const { store: s7 } = await startCareer({ seed: 'premio-k', level: 'comunale', fast: true });
  check(flow(s7, tabletG, IOS).credited, 'Ospite: premio sul dispositivo.');
  const funds7 = s7.getState().game.resources.funds;
  check(!flow(s7, tabletG, IOS, 'paolo.gialli').credited && s7.getState().game.resources.funds === funds7, 'L’ospite accede con il suo account sulla stessa installazione: il premio passa all’account, nessun secondo accredito.');
  const otherPhone = memory(); const { store: s8 } = await startCareer({ seed: 'premio-l', level: 'comunale', fast: true });
  check(!flow(s8, otherPhone, IOS, 'paolo.gialli').credited, '…e lo stesso account su un altro dispositivo non lo riceve di nuovo.');
  // the Worker does not answer: nothing credited, the entry stays pending and is tried again
  const offline = memory(); const { store: s9 } = await startCareer({ seed: 'premio-m', level: 'comunale', fast: true });
  server.down = true;
  const out9 = flow(s9, offline, ANDROID, 'marta.blu');
  check(!out9.credited && out9.verdict === 'retry' && W.welcomeEntry({ info: ANDROID, user: 'marta.blu', storage: offline })?.status === 'pending', 'Senza risposta del server: nessun accredito, il premio resta in sospeso.');
  server.down = false;
  check(flow(s9, offline, ANDROID, 'marta.blu').credited, '…e arriva una volta quando il server risponde.');
  // the declared limit: a GUEST with cleared data is, for the game, a new installation (no fingerprint, no hardware id): the premio can come again for that guest
  const cleared = memory(); const { store: s10 } = await startCareer({ seed: 'premio-n', level: 'comunale', fast: true });
  check(flow(s10, cleared, ANDROID).credited, 'Limite dichiarato: un ospite che cancella i dati è una nuova installazione (nessuna impronta del dispositivo).');
}
if (problems.length) { console.error(`Premio di ringraziamento — problemi:\n- ${problems.join('\n- ')}`); process.exit(1); }
// 25/11/2026: the update to the next build keeps ONE reward. A guest credited on 1.0.6 (7) who updates to 1.0.7 (8) on the same installation gets nothing again (the key is promotion + installation + user,
// not the build); an account credited on one build gets nothing on the other build, on another device or after a reinstallation (the claim of the account on the Worker).
{
  const NEXT = { platform: 'android', version: '1.0.7', build: '8', debug: false };
  const { store: s2 } = await startCareer({ seed: 'premio-aggiornamento', level: 'comunale', fast: true });
  const funds = () => s2.getState().game.resources.funds;
  const device = memory();
  const before = funds();
  check(flow(s2, device, ANDROID).credited && funds() === before + 2500, 'Ospite su 1.0.6 (7): premio accreditato.');
  check(!flow(s2, device, NEXT).credited && funds() === before + 2500, 'Ospite aggiornato a 1.0.7 (8) sulla stessa installazione: nessun secondo premio.');
  const other = memory();
  const { store: s3 } = await startCareer({ seed: 'premio-aggiornamento-account', level: 'comunale', fast: true });
  const f3 = () => s3.getState().game.resources.funds, b3 = f3();
  check(flow(s3, other, NEXT, 'utente-aggiornamento').credited && f3() === b3 + 2500, 'Account su 1.0.7 (8): premio accreditato una volta.');
  check(!flow(s3, memory(), ANDROID, 'utente-aggiornamento').credited && f3() === b3 + 2500, 'Stesso account su un altro dispositivo con 1.0.6 (7): nessun secondo premio.');
  check(!flow(s3, memory(), { platform: 'ios', version: '1.0.3', build: '4', debug: false }, 'utente-aggiornamento').credited && f3() === b3 + 2500, 'Stesso account su iOS 1.0.3 (4), reinstallato: nessun secondo premio.');
}
console.log('Premio di ringraziamento verificato (con il premio dell’account sul Worker: reinstallazione, ospite che accede, secondo dispositivo, server assente; limite dichiarato per gli ospiti che cancellano i dati): attivo solo su Android 1.0.6 (7) e 1.0.7 (8), iOS 1.0.2 (3) e 1.0.3 (4) release (un solo premio anche passando da una build all’altra), mai in Debug, su versioni precedenti o successive, sul web o sul sito TEST; primo avvio, ospite, account, logout/login, altro utente, più carriere, salvataggio e ricaricamento, ripristino di un salvataggio, cambio di dispositivo e premio in sospeso senza carriera: una sola volta per coppia dispositivo + utente, +2.500 € ai fondi della carriera con voce nel registro; titolo, sottotitolo e importo esatti.');
