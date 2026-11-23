# Appodeal — pubblicità dell'app Android

Stato (aggiornato con l'aggiornamento generale): **integrazione completa; Debug SEMPRE in modalità test, Release in produzione solo con configurazione esplicita e coerente**. Android usa Appodeal; **iOS e sito non mostrano nessuna pubblicità** (iOS: nessun SDK pubblicitario, nessun plugin, nessuna richiesta; vedi `docs/ios-senza-pubblicita.md`).

## Cosa c'è
| Cosa | Dove |
|---|---|
| SDK | Appodeal Android **4.4.0** (stabile), `com.appodeal.ads.sdk:core`, Maven `https://artifactory.appodeal.com/appodeal` (`android/build.gradle`) |
| Bridge nativo | `plugins/appodeal-ads` (Kotlin, Capacitor 8), plugin `AppodealAds`; solo Android (`capacitor.config.json` → `android.includePlugins`) |
| Adapter JS | `src/data/repositories/appodeal-adapter.js` (stesso contratto dell'adapter InMobi) |
| Configurazione | `src/data/ads-config.js` (`APPODEAL`, `APPODEAL_MODE`, `resolveAppodeal`) |
| Test automatico | `npm run check:appodeal` (plugin finto: nessuna rete, nessun annuncio) |

Dashboard ID `790468` · App Key Android in `ads-config.js` (identificativo pubblico, non un segreto) · placement **`default`**.

## Reti: Autoconnection
Si mantiene l'autoconnessione di Appodeal: l'app dà **solo la App Key**, mai un id di rete. Adapter inclusi: `applovin` 13.6.3.0 e `unity_ads` 4.17.0.0.
**Non inclusi**: AdMob, Meta, InMobi (né standalone né adapter), e **BidMachine**, perché il suo adapter dipende da Google Ad Manager (`io.bidmachine:ads.networks.gam`), cioè dall'SDK Google Mobile Ads. Se negli annunci di test o reali servissero altre reti (le «starred» del Mediation Wizard), si aggiungono in `plugins/appodeal-ads/android/build.gradle` dopo aver controllato le loro dipendenze.

## Modalità (regole in vigore)
* **Debug (`FLAG_DEBUGGABLE` / `BuildConfig.DEBUG`)**: `Appodeal.setTesting(true)` è deciso dal codice nativo e **prevale su qualunque configurazione JavaScript, remota o di produzione**; una richiesta «production» in Debug viene rifiutata e annunciata nei log (`production requested in a DEBUG build: refused, test ads forced`). Nessun annuncio reale in sviluppo.
* **Release**: annunci reali solo se `APPODEAL_MODE = 'production'` **e** `APPODEAL_PRODUCTION_AUTHORIZED = true` (autorizzazione commerciale del titolare) **e** App Key ben formata. Il build Gradle di una Release **rifiuta** configurazioni incoerenti (copie `src`/`www`/Capacitor discordi, produzione non autorizzata, chiave malformata, modalità sconosciuta) — `android/app/build.gradle`.
* Banner: Promise serializzate che non restano mai rifiutate, operazioni con timeout, cooldown **120 s persistente** (`politicando.ads.v1`), durata massima **60 s** con timer esatto, controllo al ritorno dal background (`ads-manager.js`).

## Modalità storiche
* `test` (**predefinita**): `Appodeal.setTesting(true)`, solo creatività di test, nessun incasso.
* `off`: nulla viene chiesto né mostrato.
* `production`: ammessa solo con `APPODEAL_PRODUCTION_AUTHORIZED = true` (vedi sopra); altrimenti degrada a `test`. Per attivarla serve l'autorizzazione commerciale del titolare e una modifica deliberata di quella costante (+ `APPODEAL_MODE = 'production'`). Un valore remoto non può mai attivarla; può solo **spegnere** (`remote.appodeal.mode = 'off'` o `enabled: false`, o un singolo formato).

## Formati
* **Banner**: Home e schermate statiche (`panoramica, ricompense, notizie, archivio, impostazioni, storico`), mai in scena, voto, notte elettorale, report, menu o primo avvio; sta sopra la barra (margine), non copre i contenuti.
* **Interstitial**: solo alla chiusura di una settimana (pausa naturale), una ogni 2 settimane chiuse, **mai entro 180 s** dalla precedente (o da un rewarded), mai in notte/scena/voto/campagna/wizard; se non è disponibile non si blocca nulla.
* **Rewarded**: sempre facoltativo (pulsante della pagina Ricompense). Il premio nasce **solo** da `onRewardedVideoFinished` (completamento ufficiale); chiusura anticipata, errore o scadenza non danno nulla; un id di completamento nuovo per ogni video (`apd-…`), che il Worker già controlla (`/api/account/ads/reward`, punti 0,15 invariati).

## Privacy
Consenso **tramite Appodeal** (`ConsentManager`): aggiornamento a ogni avvio, modulo mostrato solo quando richiesto (GDPR/SEE, Italia), nessuna richiesta di annunci senza `canShowAds()`, voce «opzioni privacy» nelle impostazioni (`showPrivacyOptionsForm`). Al SDK **non** si passa alcun dato del giocatore (niente id utente, posizione, età, genere, filtri o segmenti): le scelte politiche simulate non servono mai alla profilazione. I permessi di posizione che gli SDK possono dichiarare sono rimossi dal manifest. Aggiornare la scheda Data safety di Google Play secondo la guida Appodeal «App Privacy Details» prima della pubblicazione.

## Cosa NON è stato verificato (ambiente senza dispositivo)
La visualizzazione di banner, interstitial e rewarded su dispositivo, il modulo di consenso reale, i log `PolitAppodeal`/`Appodeal` e la **prima impression nel dashboard** richiedono un telefono Android: vedi «Prova su dispositivo».

## Prova su dispositivo
1. `npm run build:www && npx cap sync android`, poi `cd android && ./gradlew :app:installDebug` (o Android Studio → Run) con un telefono in debug USB.
2. `adb logcat -s PolitAppodeal Appodeal` per vedere: consenso, init, `interstitial loaded/shown/closed`, `rewarded finished`, `banner loaded/shown`.
3. Banner: apri la Home. Interstitial: chiudi due settimane. Rewarded: pagina Ricompense → video.
4. Dashboard Appodeal (app 790468): le richieste di test non contano come reali; serve almeno una richiesta reale per attivare le reti.


## Avvisi nei log (analisi)
* `IllegalArgumentException: Required value was null`: **causa NON confermata**. Ipotesi: eccezione interna all'SDK Appodeal 4.4.0 (un `requireNotNull` nel caso d'uso di rete / configurazione), non nel bridge dell'app (il bridge Kotlin non usa `requireNotNull` né `!!` su dati dell'SDK: verificato leggendo `AppodealAdsPlugin.kt`). Non ha impedito l'inizializzazione negli avvii osservati. Per chiuderla serve lo stack completo (`adb logcat`) da un dispositivo collegato: in questa sessione il Xiaomi non era raggiungibile.
* `bidmachine adapter not registered`: atteso. BidMachine **non** è incluso di proposito (dipenderebbe da Google Ad Manager / Google Mobile Ads, che non vogliamo). Non va aggiunto per far sparire l'avviso.
