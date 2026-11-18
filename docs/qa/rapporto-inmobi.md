# Rapporto — integrazione InMobi (branch `feature/inmobi-integrazione`)

Partenza: `407046c`. Commit: `98eefc1` (integrazione), `fb80e7f` (doc, correzione CSP), + commit di questo passaggio (Account ID, verifica API, rapporti). Dettaglio tecnico: `docs/inmobi.md`.

## Esito per piattaforma
| | Android (Kotlin, SDK 11.5.1) | iOS (Swift, SDK 11.5.0) |
|---|---|---|
| Codice | completo | completo |
| Compilazione | **solo il Kotlin**, contro l'SDK InMobi reale (Maven Central) con stub di Capacitor/UMP: PASS. **Build Gradle/AAB NON eseguita** (nessun Android SDK; `dl.google.com` 403) | **NON compilato** (nessun macOS/Xcode) |
| Prova su dispositivo | NO | NO |
| Dichiarata completata | **No** | **No** |

## Account ID
`60d3e31b9c094bd69283e287bc2d4c42`: 32 esadecimali; la guida ufficiale Android lo usa come secondo argomento di `InMobiSdk.init` e ne indica il formato 32–36 caratteri ⇒ **formato coerente**. Non sono riuscito a confermare da fonti ufficiali che sia il «Publisher Account ID» della dashboard (documentazione InMobi non raggiungibile; una guida di terzi parla di Finance › Payment Settings): **conferma richiesta al titolare**. È in `INMOBI.accountId` (`src/data/ads-config.js`), usato da JS per `InMobiSdk.init` (Android) e `IMSdk.initWithAccountID` (iOS); distinto da App Key `10000256631` e Placement ID (test automatico). Averlo non accende alcun formato.

## API verificate
- **Android**: tutte le firme controllate sull'AAR reale 11.5.1 con `javap` e **compilate** (errori trovati e corretti: `SdkInitializationListener` non è una `fun interface`; `setBannerSize` deprecato). Rewarded = `InterstitialAdEventListener.onRewardsUnlocked` (confermato dalla guida ufficiale).
- **iOS (Swift)**: confermati da fonti InMobi (esempi ufficiali, changelog, estratti della guida): `IMInterstitial(placementId:delegate:)`, `IMBanner`, delegate (`rewardActionCompletedWithRewards`), `IMSdk.initWithAccountID(_:consentDictionary:andCompletionHandler:)`, costanti di consenso (`gdpr_consent_available` con valori stringa `"true"/"false"` — **corretto in questo passaggio**, `gdpr_consent`, `gdpr`). **Non verificati** (documentazione ufficiale non raggiungibile): `IMSdk.setLogLevel`/`setIsAgeRestricted` in Swift, esattezza delle chiavi/valori `gdpr`, API UMP iOS, compilazione dell'intero file. Le guide ufficiali mostrano forme diverse a seconda della versione: controllare le note di rilascio 11.5.0 su Mac.
- **Consenso**: UMP (TCF) in nativo; la stringa `IABTCF_TCString` passa a InMobi. Chiamate UMP Android coerenti con quelle del plugin AdMob già compilato upstream; **non compilate contro il vero jar UMP** (Google Maven bloccato).
- **Callback locale vs server-to-server**: il bonus +0,15 dipende dal callback **locale** dell'SDK. Il Worker fa un **controllo del server** (formato attivo, id unico, limite giornaliero, punti in vigore) ma **non una verifica S2S**: nelle fonti lette non è documentato alcun callback server-side firmato di InMobi, quindi non la dichiaro.

## Test (questo branch, nessuna suite completa)
PASS: `check-inmobi`, `check-inmobi-native` (compilazione Kotlin inclusa), `check-ads-states`, `check-rewards`, `check-rewards-page`, `check-rewards-sync`, `check-capacitor` (+`--www`), `check-android`, `check-legal`, `check-publication`, `check-service-worker`, `check-account-deletion`, `check-security`, `check-merger-identity-browser`, `check-guide`, `check-i18n-offline`, `check-i18n-pages`. FAIL: nessuno tra quelli eseguiti. SKIPPED: nessuno. Non eseguiti: Gradle, Swift/Xcode, dispositivo, suite completa.
`npx cap sync android` e `npx cap sync ios` eseguiti (plugin registrato; SPM aggiornato). Build web `20261118-24`, www sincronizzata.

## File modificati (principali)
Nuovi: `plugins/inmobi-ads/**` (TS, Kotlin, Swift, Gradle, Package.swift, `dist`), `src/data/repositories/inmobi-adapter.js`, `scripts/check-inmobi-native.mjs`, `scripts/lib/inmobi-stubs/**`, `docs/inmobi.md`. Cambiati: `src/data/ads-config.js`, `ads-manager.js`, `ads-rewarded.js`, `rewards-service.js`, `reward-rules.js`, `rewards-page.js`, `account-sync.js`, `app.js`, `menu.js`, `party-life-view.js`, `worker.js`, `package.json`/lock, `capacitor.config.json`, `AndroidManifest.xml`, `capacitor.*.gradle`, `ios/App/CapApp-SPM/Package.swift`, `Info.plist` (SKAdNetwork), `PrivacyInfo.xcprivacy`, `privacy*.html`, doc legali/store, test `check-inmobi` (ex `check-admob`), `check-ads-states`, `check-rewards*`. Eliminati: `admob-adapter.js`, `docs/admob.md`, dipendenza `@capacitor-community/admob`.

## Sicurezza mantenuta
Formati spenti di base, modalità `test`, nessun deploy/upload, nessuna modifica a `main`, produzione, TEST (`wrangler*.jsonc` intatti), né a iOS 1.0 (1) (Bundle ID, versione, build, firma verificati dal test). Non ricostruire la 1.0 (1) da questo branch.

## Da fare ancora
**Mac/Xcode:** risolvere i pacchetti SPM, compilare il bridge Swift, correggere gli errori (vedi «non verificati»), build di test su dispositivo con versione/build nuove (decise dal titolare).
**Android:** Android SDK + chiave di upload, `./gradlew bundleRelease` (verifica Gradle/AGP 9.4.1 + kotlin-android + UMP 4.0.0), prova su dispositivo con test device InMobi.
**Dispositivi:** consenso UMP (accetta/rifiuta/opzioni), rewarded (completo/interrotto/offline), banner, interstitial, assenza di annunci con tutto spento.
**Titolare:** conferma che l'ID sia il Publisher Account ID; Placement ID iOS dedicati (usati quelli forniti); messaggio UMP in AdMob › Privacy e messaggistica; informativa/termini; Play Console (annunci, AD_ID, Data safety), App Store (privacy label); `app-ads.txt`; elenco SKAdNetwork completo; `ADS_CONFIG` nel Worker; riesame dei FAIL del rapporto precedente.
