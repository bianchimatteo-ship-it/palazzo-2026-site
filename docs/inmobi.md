# InMobi — unico provider pubblicitario (Android + iOS)

Stato: codice completo nel branch `feature/inmobi-integrazione`, **spento di base**. Nessun annuncio reale; nessun Account ID inventato. Sostituisce la vecchia integrazione AdMob (eliminata: adattatore, plugin, manifest, id).

## Identificativi
| Voce | Valore | Dove si usa |
|---|---|---|
| App Key | `10000256631` | solo dashboard InMobi (l'SDK **non** la usa) |
| Rewarded (Placement ID) | `10000884972` | `src/data/ads-config.js`, sovrascrivibile dalla configurazione remota |
| Banner (Placement ID) | `10000884973` | idem |
| Interstitial (Placement ID) | `10000884974` | idem |
| **Account ID** | `60d3e31b9c094bd69283e287bc2d4c42` (fornito dal titolare) | `INMOBI.accountId` in `src/data/ads-config.js`; sovrascrivibile da `accountId` remoto |

**L'Account ID non è l'App Key né un Placement ID.** Verifica con la documentazione ufficiale: la guida Android InMobi usa `InMobiSdk.init(context, "<InMobi Account ID>", consent, listener)` e il changelog ne descrive il formato come stringa di 32–36 caratteri; quello del titolare è di 32 caratteri esadecimali, **coerente nel formato**. Non ho potuto verificare, con le sole fonti raggiungibili (la documentazione InMobi non è accessibile dall'ambiente; una guida di terzi indica Finance › Payment Settings), che sia proprio il *Publisher Account ID* della dashboard: va confermato dal titolare. È un identificativo pubblico, non un segreto. Averlo nel codice **non accende nessun formato**: tutti restano spenti finché `ADS_CONFIG` non li abilita. Un `accountId` remoto presente ma malformato spegne tutto.

## Architettura
- **Un solo provider**: `src/data/repositories/inmobi-adapter.js` (consenso → SDK → rewarded/banner/interstitial). `ads-rewarded.js` (premio solo con completamento autentico), `ads-manager.js` (politica banner/interstitial), `rewards-service.js` + `store.claimAdReward` (effetto sui sondaggi) sono invariati nella logica.
- **Bridge Capacitor condiviso** `plugins/inmobi-ads` (pacchetto locale `politicando-inmobi-ads`): contratto TypeScript `src/definitions.ts` (compilato in `dist/`), implementazione **Kotlin** (`android/…/InMobiAdsPlugin.kt`, `com.inmobi.monetization:inmobi-ads-kotlin:11.5.1`) e **Swift** (`ios/Sources/InMobiAdsPlugin/InMobiAdsPlugin.swift`, Swift Package `InMobiSDK-Swift-Package` 11.5.0). Otto metodi identici: `requestConsent`, `initialize`, `loadAd`, `showAd`, `showBanner`, `hideBanner`, `showPrivacyOptions`, `requestTracking`.
- Sul sito il plugin non esiste: nessun annuncio.
- Dipendenze Google tenute **solo** per la CMP: `com.google.android.ump:user-messaging-platform` (Android) e `GoogleUserMessagingPlatform` (iOS). Nessun Google Mobile Ads SDK / AdMob.

## Configurazione remota (nessuna modifica al codice né nuova versione dell'app)
Il Worker serve `GET /api/account/ads/config` (pubblico, cache 5 minuti) dalla variabile JSON **`ADS_CONFIG`** (Cloudflare › Worker › Settings › Variables; nessun deploy del codice). L'app la legge all'avvio e ogni 30 minuti. Valore mancante, non valido o irraggiungibile ⇒ **valori di sicurezza: tutto spento** (`defaultAds`). Ogni campo è validato e limitato dallo stesso codice nel Worker e nell'app (`resolveAds`).

```json
{
  "enabled": true,
  "all":     { "mode": "test" },
  "android": { "accountId": "<Account ID>", "mode": "test",
               "rewarded":     { "enabled": true,  "placementId": "10000884972" },
               "banner":       { "enabled": true,  "placementId": "10000884973" },
               "interstitial": { "enabled": false, "placementId": "10000884974" },
               "interstitialPolicy": { "everyWeeks": 3, "perDay": 4, "minGapMs": 240000 },
               "rewardPoints": 0.15 },
  "ios":     { "accountId": "<Account ID>", "rewarded": { "enabled": false } }
}
```
| Chiave | Effetto | Limiti / fallback |
|---|---|---|
| `enabled` (radice, o per piattaforma) | interruttore generale | `false` spegne tutto |
| `mode` | `off` spegne; `test` (predefinito: nessun annuncio reale, log di debug); `live` | valore sconosciuto ⇒ `test` |
| `accountId` | Account ID InMobi | 32 hex; altrimenti nessun formato si accende |
| `rewarded` / `banner` / `interstitial` `.enabled` | attiva il formato **per piattaforma** | solo `true` accende; predefinito `false` |
| `…placementId` | Placement ID del formato per piattaforma | 8–20 cifre; altrimenti i predefiniti sopra |
| `interstitialPolicy.everyWeeks` | un interstitial ogni N settimane chiuse | 1–52 (predef. 3) |
| `interstitialPolicy.perDay` | massimo al giorno (0 = nessuno) | 0–12 (predef. 4) |
| `interstitialPolicy.minGapMs` | distanza minima da un altro interstitial/video | 60 000–3 600 000 (predef. 240 000) |
| `rewardPoints` | punti del video nei sondaggi | 0–0,5 (predef. **0,15**) |

Il banner compare solo sulle pagine secondarie (`BANNER_PAGES`), l'interstitial solo alla chiusura della settimana, mai durante scene, voto, notte elettorale, campagna, wizard; mai subito dopo un video con premio.

**Cosa NON si cambia da qui e richiede un aggiornamento dell'app:** versioni SDK, plugin nativi, permessi, SKAdNetwork/privacy manifest, elenco delle pagine del banner, momenti dell'interstitial, regole del premio (3 sondaggi, quota minima del donatore), testi.
**Cosa resta modificabile da InMobi (dashboard):** floor/priorità, test device e modalità test per placement, creatività/categorie, riempimento e rapporti, nuovi Placement ID (poi nella configurazione remota), `app-ads.txt`.

## Ricompensa dei sondaggi (+0,15) — validata dal server
1. Il bonus nasce **solo** da `onRewardsUnlocked` (Android) / `rewardActionCompletedWithRewards` (iOS): il plugin lo trasforma in `rewarded: true` + un id di completamento fatto in nativo (UUID). Video chiuso prima, errore, annuncio non mostrato ⇒ nessun id ⇒ nessun premio. Un secondo callback per lo stesso video non ricompensa (l'oggetto annuncio è usato una volta).
2. Il client chiede al Worker di prenotare l'id: `POST /api/account/rewards/ad` (account) o `POST /api/account/ads/reward` (ospite, con l'id del dispositivo). Il Worker rifiuta se il formato `rewarded` è spento per la piattaforma (403), se l'id non è valido (400), se è già stato prenotato (`duplicate`) o oltre 30 video al giorno (429), e risponde con i **punti in vigore**. **Senza risposta del server (offline) il premio non è accreditato.** L'effetto sui sondaggi si applica solo dopo.
3. Limite onesto: **InMobi non offre una conferma server-to-server del completamento** che questo codice possa verificare (nessun callback firmato documentato per gli SDK 11.x). Il Worker convalida configurazione, unicità e limite (**controllo del server, non verifica S2S**); la conferma del *completamento* resta quella **locale** dell'SDK sul dispositivo. Nessun meccanismo S2S è documentato nelle fonti lette: non lo dichiaro. Se InMobi attiverà un callback server-side, andrà collegato a `bookAdReward` in `worker.js`.
Salvataggi e ricompense esistenti: invariati (la cronologia conserva l'importo accreditato a suo tempo).

## Consenso e privacy
- CMP: **Google UMP** (compatibile IAB TCF) in entrambe le piattaforme; il messaggio va configurato in AdMob › Privacy e messaggistica (azione del titolare). Nessuna richiesta pubblicitaria prima che UMP dica `canRequestAds` (test: rifiuto ⇒ nessuna init, nessun caricamento). La stringa TCF (`IABTCF_TCString`) e `gdpr` sono passate a InMobi; "Opzioni privacy della pubblicità" in Impostazioni quando UMP lo richiede. Pubblico 14+: nessun tag «under age».
- **Nessun dato del giocatore all'SDK**: mai posizione, data di nascita, genere, età, interessi, dati delle carriere (verificato dal test statico `check-inmobi-native`). Nessun permesso aggiunto dal progetto: restano `INTERNET` (app) + quelli portati dall'SDK (`ACCESS_NETWORK_STATE`, `AD_ID`: da dichiarare in Play Console).
- **ATT (iOS)**: mai richiesto da solo; `requestTracking` esiste ma l'app non lo chiama e il testo `NSUserTrackingUsageDescription` **non è** in `Info.plist` (se mancasse, il prompt farebbe crollare l'app: il codice Swift non lo chiama senza la chiave). Se lo si vorrà attivare: aggiungere la chiave, impostare `NSPrivacyTracking` a `true` con i domini di tracciamento di InMobi e chiamare `requestTracking` prima della prima richiesta di annuncio.
- iOS: `SKAdNetworkItems` contiene `wzmmz9fp6w.skadnetwork` (InMobi, confermato da Unity LevelPlay e Google); **l'elenco completo degli id dei bidder va preso dalla documentazione InMobi prima del rilascio** (non inventato qui). `PrivacyInfo.xcprivacy` dichiara DeviceID, ProductInteraction e AdvertisingData per pubblicità di terzi; da riconciliare con il privacy manifest dell'SDK InMobi e con la scheda privacy dell'App Store.
- `privacy.html` / `privacy-en.html` dicono «InMobi» nel paragrafo sul futuro: **prima di attivare gli annunci vanno riscritte da titolare/professionista** (InMobi come servizio presente, dati, consenso, minori).

## Protezione della versione iOS 1.0 (1)
La 1.0 (1) è in revisione, **senza pubblicità**, e non è toccata: Bundle ID `it.matteobianchi.politicando2026`, `MARKETING_VERSION 1.0`, `CURRENT_PROJECT_VERSION 1`, nessun Team/firma/profilo cambiati (`check-inmobi-native`). Il codice iOS di InMobi è nel repository (`includePlugins: ['politicando-inmobi-ads']`, pacchetto SPM) per il **prossimo aggiornamento**: **non archiviare né caricare di nuovo la 1.0 (1) da questo branch** (conterrebbe l'SDK); l'aggiornamento successivo deve avere una versione/build nuove, decise dal titolare. Anche allora la configurazione remota tiene gli annunci iOS spenti finché non li si attiva.

## Verifiche — cosa è stato fatto davvero
| Cosa | Esito |
|---|---|
| `node scripts/check-inmobi.mjs` (configurazione remota, consenso/rifiuto, rewarded +0,15, doppio premio, video interrotto, nessuna rete/SDK, banner, interstitial, Worker) | PASS |
| `node scripts/check-inmobi-native.mjs`: contratto identico TS/Kotlin/Swift, nessun dato personale, versioni, SPM/Gradle sincronizzati, SKAdNetwork, privacy manifest, versioni iOS/Android invariate | PASS |
| **Compilazione del plugin Kotlin contro l'SDK InMobi 11.5.1 reale** (Maven Central) con il compilatore Kotlin di Gradle e stub di Capacitor/UMP (`scripts/lib/inmobi-stubs`) | **PASS** (scoperto e corretto: `SdkInitializationListener` non è una `fun interface`; `setBannerSize` è deprecato) |
| `npx cap sync android` / `npx cap sync ios` | fatti (plugin registrato, Gradle e SPM aggiornati) |
| Build **Gradle** Android (AAB/APK) | **NON eseguita**: nessun Android SDK; `dl.google.com` è bloccato (403) quindi non si scarica nemmeno il Gradle plugin Android; nessuna chiave di upload |
| Compilazione **Swift / Xcode** iOS | **NON eseguita**: nessun macOS/Xcode. Il Swift usa i nomi verificati dagli esempi ufficiali InMobi (`IMInterstitial`, `IMBanner`, delegate, `rewardActionCompletedWithRewards`); **non verificati** (la documentazione ufficiale non è raggiungibile dall'ambiente; solo estratti via ricerca e gli esempi GitHub): confermata da fonti ufficiali la forma `IMSdk.initWithAccountID(_, consentDictionary:, andCompletionHandler:)` (il Swift la usa) e i valori di consenso come stringhe `"true"`/`"false"` (corretto); ancora non verificati: la firma esatta di `IMSdk.initWithAccountID(_:consentDictionary:…)` in Swift, i nomi delle chiavi del dizionario di consenso, `IMSdk.setLogLevel/.setIsAgeRestricted`, e le chiamate UMP iOS |
| Prova su dispositivo (annuncio reale/di test, consenso UMP, rewarded) | **NON eseguita** |

## Cosa serve dal titolare prima di attivare
1. **Account ID** InMobi (e conferma dei Placement ID per **iOS**, se diversi da quelli forniti, che sono stati usati per entrambe le piattaforme).
2. Messaggio di consenso in AdMob › Privacy e messaggistica (UMP/TCF) per l'app Android e per l'app iOS.
3. Build Android con Android SDK e chiave di upload: `npx cap sync android`, poi `./gradlew bundleRelease`; build iOS su macOS (Xcode 16+, SPM: `InMobiSDK-Swift-Package` 11.5.0, `GoogleUserMessagingPlatform`); correggere eventuali errori di compilazione Swift (non verificati).
4. Test su dispositivo in modalità `test` con un test device registrato nella dashboard InMobi; poi, solo dopo, `mode: "live"` e formato per formato.
5. Informativa/termini, Play Console (annunci, ID pubblicitario, Data safety), App Store (privacy label, ATT se usato), `app-ads.txt`, elenco SKAdNetwork completo.
6. Variabile `ADS_CONFIG` nel Worker (il file `wrangler*.jsonc` non è stato modificato).

## Altre correzioni fatte in questo intervento
- `src/ui/party-life-view.js`: tolto un `onsubmit` inline (violava la politica CSP; `check-security` falliva già sul branch precedente); ora un listener delegato in `app.js` blocca l'invio con Invio nel modulo di fusione.
- Rafforzato l'adattatore: un video è «completato» solo con `shown: true` **e** `rewarded: true` **e** un id nativo (trovato dal test); la validazione numerica della configurazione rifiuta `null`/stringhe vuote (`Number(null)` valeva 0).

## Test eseguiti su questo branch (PASS/FAIL/SKIPPED)
PASS: `check-inmobi`, `check-inmobi-native` (compilazione Kotlin inclusa), `check-ads-states`, `check-rewards`, `check-rewards-page`, `check-rewards-sync`, `check-capacitor` (anche `--www`), `check-android`, `check-legal`, `check-publication`, `check-service-worker`, `check-account-deletion`, `check-security`, `check-merger-identity-browser`, `check-i18n-offline`, `check-i18n-pages`, `check-guide`.
Non rieseguita la suite completa (richiesto): l'ultima corsa parziale sul branch `feature/miglioramento-completo` (198 comandi su 278, 3 in parallelo) aveva avuto FAIL su `check-campaign-ui`, `check-presidency`, `check-long-run`, `check-calendar-years`, `check-territory-legibility`, `check-e2e-futuro-nazionale`, `check-regional-ranking`, `check-news-voice`, `check-security` (corretto ora), `check-load`, `check-button-contrast`, `check-account-deletion` e `check-account-isolation` (passa da solo), `check-published-local`, `check-news-popup-setting`, `check-calendar-scheduling`, `check-poll-election-consistency`, `check-i18n` e SKIPPED `check-boot`, `check-panels-stay-put`: in parte preesistenti (presidency, button-contrast, campaign-ui, load) e in parte dovuti alla concorrenza; **non ancora riesaminati in serie**.
