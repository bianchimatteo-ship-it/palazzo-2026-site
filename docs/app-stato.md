# App (Capacitor): stato, build e requisiti degli store

Verificato il 14 ottobre 2026. Le pagine ufficiali sono state lette il 14 ottobre 2026; i requisiti degli store cambiano spesso: **riverificali il giorno dell'invio**.

## Stato verificato

| Voce | Stato |
|---|---|
| Sorgente | `src/`, `index.html`, `sw.js`, icone, pagine pubbliche. `www/` non si modifica a mano |
| Build | `npm run build:www` (ripetibile, con controlli), `npm run check:www` (coincidenza di `www/` con le sorgenti), `npm run check:capacitor` |
| Capacitor | `@capacitor/cli`, `core`, `ios` `^8.5.2` (ultimo disponibile: 8.5.3). `webDir: www` |
| Identificativo (bundle ID) | `it.matteobianchi.politicando2026`, uguale in `capacitor.config.json` e nel progetto iOS (controllato dal test) |
| iOS | Progetto presente (`ios/App`). Versione 1.0, build 1, target minimo iOS 15.0. Nessuna descrizione d'uso dei permessi in `Info.plist` (il gioco non usa fotocamera, microfono, posizione, contatti), nessuna modalità in background |
| Android | Progetto presente (`android/`, `@capacitor/android` `^8.5.3`, `minSdkVersion 24`, `compileSdkVersion`/`targetSdkVersion 36`). Firma di rilascio opzionale (`keystore.properties`, ignorato da git), icone e splash del gioco al posto dei segnaposto Capacitor (22/10/2026). **Non compilato né provato**: manca l’Android SDK in questo ambiente (e `dl.google.com` non è raggiungibile). Dettagli e passaggi manuali: `docs/google-play.md`. `android/` non è pubblicato (`.assetsignore`) né incluso in `www/` |
| Account nell'app | L'app (origine `capacitor://localhost` su iOS, `https://localhost` su Android) usa il Worker pubblicato; il Worker accetta quelle due origini e nessun'altra estranea (test). Le pagine privacy/termini/cancellazione si aprono dal sito pubblicato |
| Offline | Gioco e dati reali sono nel pacchetto; i salvataggi restano sul dispositivo; la sincronizzazione online riprende quando c'è rete |
| File che non devono stare nel pacchetto | Worker, Wrangler, script, documenti, migrazioni, file d'ambiente, chiavi, progetti nativi: la build li esclude e fallisce se compaiono (test). **Nota:** il codice del pannello Admin è parte dell'applicazione web e quindi anche del pacchetto; non contiene segreti (il PIN e il codice di attivazione sono verificati dal Worker) |
| Artefatti | **NON ESEGUITO.** Nessun `.ipa`, `.aab` o `.apk` è stato costruito né provato su dispositivo o simulatore: qui non ci sono Xcode né Android SDK |

## Requisiti degli store (fonti ufficiali, lette il 14 ottobre 2026)

**Google Play** — <https://developer.android.com/google/play/requirements/target-sdk>
Dal 31 agosto 2026 le nuove app e gli aggiornamenti devono avere come target Android 16 (API level 36) o superiore; le app esistenti Android 15 (API 35) o superiore per restare disponibili ai nuovi utenti. È possibile chiedere una proroga fino al 1° novembre 2026. Il modello di progetto Android di Capacitor 8.5.3 ha `minSdkVersion 24`, `compileSdkVersion 36`, `targetSdkVersion 36` e il solo permesso `INTERNET`: soddisfa il requisito, ma il progetto Android non esiste ancora in questo repository.

**Apple App Store** — <https://developer.apple.com/news/upcoming-requirements/>
Dal 28 aprile 2026 le app caricate su App Store Connect devono essere costruite con Xcode 26 o successivo e SDK iOS 26 o successivo. Dal 9 settembre 2026 devono avere come target iOS 13 o superiore (il progetto ha 15.0). Il questionario sulle fasce d'età aggiornato va compilato per ogni app.

## Passi da fare per ottenere gli artefatti (non eseguiti qui)

1. `npm install` (installa le dipendenze Capacitor).
2. Aggiornare le versioni (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`) a ogni invio.
3. iOS: `npm run build:www && npx cap sync ios`, aprire `ios/App/App.xcworkspace` con Xcode 26+, firmare con il proprio team, archiviare e caricare su App Store Connect. Compilare le risposte su privacy («Data Not Collected» o i dati dell'account, secondo l'informativa finale), età e crittografia (`ITSAppUsesNonExemptEncryption`, da decidere a cura del titolare).
4. Android: il progetto `android/` esiste già; `npm run build:www && npx cap sync android`; verificare `targetSdkVersion 36` (già impostato), creare il keystore di firma e il bundle `.aab`, compilare la sezione «Sicurezza dei dati» di Play Console.
5. Provare su dispositivo: accesso e creazione account, salvataggio e ripresa online, navigazione e tasto indietro (Android), area sicura/notch, tastiera sui moduli, modalità aereo (gioco offline), apertura delle pagine privacy/termini/cancellazione, eliminazione dell'account.

## Prima di ogni invio

`npm run check:capacitor`, `npm run check:www`, `node scripts/check-account-deletion.mjs --release` (fallisce finché restano punti a carico del titolare), inventario in `docs/privacy-e-asset.md`.

**Il gioco non è dichiarato pronto per gli store**: mancano gli artefatti provati (nessun `.aab`/`.apk` costruito), i dati del titolare, l'esito delle verifiche sugli asset e sul nome «LA POLITICA 24».
