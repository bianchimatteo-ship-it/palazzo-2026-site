# Pubblicità Appodeal e «Chiudi settimana» (26/11/2026)

## 1. Pubblicità Android: che cosa è stato dimostrato

**Dimostrato dal codice e dall'AAB (verificato aprendo i file, non solo «BUILD SUCCESSFUL»):**
- SDK Appodeal core 4.4.0; adapter nell'AAB prima: AppLovin 13.6.3.0, Unity Ads 4.17.0.0, renderer proprio `iab`.
- **Vungle era ON nel dashboard ma assente dall'app**: nessun adapter e nessuna classe `com/appodeal/ads/adapters/vungle` nel pacchetto. L'SDK registra soltanto le reti di cui trova l'adapter: per questo Vungle non compariva fra le reti registrate. Corretto: `com.appodeal.ads.sdk.adapters:vungle:7.7.9.0` (dipende dal core `[4.0.0,5.0.0)` e da `vungle-ads` 7.7.9). Nell'AAB ora ci sono 24 riferimenti all'adapter e 853 a `com/vungle/ads`; il provider `…vungle-provider` e `VungleActivity` sono nel manifest.
- Nessun Google Mobile Ads: l'albero delle dipendenze di release non contiene `play-services-ads` (solo `play-services-ads-identifier` 18.3.0, la libreria dell'ID pubblicitario). Nessun AdMob, InMobi, Meta, BidMachine.
- L'adapter Vungle dichiara `WRITE_EXTERNAL_STORAGE` (da cui il merger aggiunge `READ_EXTERNAL_STORAGE`): non servono al gioco e sono rimossi dal manifest del plugin. Il manifest unito finale ha 13 permessi, senza storage né posizione.
- AAB di release: `APPODEAL_MODE = 'production'`, `APPODEAL_PRODUCTION_AUTHORIZED = true`, quindi `testMode` falso; nelle build Debug il codice nativo forza il test. Firma verificata (`jarsigner`), impronta SHA-256 del certificato `BC:E5:36:B3:6B:0E:CA:4D:…:91:02`. Versione invariata: 1.0.6 (7). Nella build di rilascio la CSP non contiene le porte locali di prova.
- Inizializzazione, consenso (ConsentManager prima di ogni richiesta), App Key (48 caratteri esadecimali) e `applicationId` `it.matteobianchi.politicando2026`: coerenti nel codice e nell'AAB. **La corrispondenza della chiave con l'app del dashboard non è verificabile da qui.**

**Non è un errore d'integrazione (e non si corregge nel codice):**
- *Banner `No ads in banner`, `REQUEST ERROR (4)`*: l'SDK ha chiesto un banner e nessuna rete ha risposto: è assenza di inventory.
- *Unity Ads `NO_FILL` su unità a eCPM alto, una da 0,45 $ caricata*: legittimo `NO_FILL`.
- *AppLovin presente nel registro ma senza unità nella waterfall Rewarded*: la waterfall la decide il server Appodeal. Se le unità AppLovin Rewarded non sono nella risposta, mancano nella configurazione del dashboard (linea Rewarded AppLovin, chiave SDK di AppLovin, formato/regione): è un intervento manuale.
- Il codice del plugin già: carica con `Appodeal.cache` e un timeout di 20 s, controlla `isLoaded` prima di mostrare, accredita **solo** in `onRewardedVideoFinished` e solo alla chiusura (un id di completamento nuovo per video, chiamata di mostra una alla volta, callback duplicati ignorati), ricarica da solo dopo la chiusura, tiene il banner con cooldown di 120 s e durata massima di 60 s, senza richieste in ciclo.

**Non verificato (nessun telefono Android disponibile):** caricamento reale di banner e rewarded, callback su dispositivo, comportamento in background e ritorno in foreground, effetto dell'adapter Vungle sulle richieste. I test automatici (`check-appodeal`, `check-appodeal-safety`, `check-funds-ad`, `check-ads-states`) usano un plugin simulato.

**Attività manuali:**
1. Dashboard Appodeal → app 790468: controllare le linee **Rewarded** e **Banner** di AppLovin e di Vungle (unità attive, chiavi SDK delle reti, formati). Per Vungle serve l'app e il placement creati nel dashboard di Liftoff, collegati ad Appodeal.
2. Prova su un telefono con l'AAB di rilascio (`adb logcat -s Appodeal PolitAppodeal`): ora tra le reti registrate deve esserci `vungle`.
3. Play Console: la scheda Sicurezza dei dati deve includere anche Vungle/Liftoff secondo la guida «App Privacy Details» di Appodeal; l'informativa è già aggiornata (AppLovin, Unity Ads, Vungle).
4. Versione: l'AAB è stato costruito con 1.0.6 (7). Per caricarlo serve un versionCode libero e superiore a quelli già caricati: non l'ho cambiato (decisione tua dopo il controllo in Play Console).

## 2. «Chiudi settimana»
Cause dell'attesa: il gestore (`src/ui/app.js`, azione `advance`) faceva `await` di **due animazioni** (`requestAnimationFrame` due volte) prima di eseguire l'avanzamento. Non c'erano `setTimeout` né debounce. Rimossa l'attesa: il click esegue l'avanzamento nello stesso istante; i pulsanti sono marcati occupati e restano tali finché l'avanzamento gira.
Doppio tocco: la guardia sui tocchi doppi (450 ms) confrontava l'elemento; dopo ogni avanzamento il pulsante viene ridisegnato e il secondo tocco cadeva su un elemento nuovo. Ora l'azione `advance` si riconosce per ciò che fa e la guardia si rinnova alla fine dell'avanzamento, quindi anche un tocco in coda durante un calcolo lungo viene scartato.
Invariati: calcoli, economia, eventi, calendario, salvataggio.
Test nuovo `check-close-week-immediate`: sorgente senza timer, frame o `await` davanti all'avvio; nel browser l'avanzamento parte 0,5 ms dopo il click ed è già eseguito quando `click()` ritorna; una settimana per click (7 giorni di calendario); il doppio click ne chiude una; il salvataggio ha la settimana nuova; stessa carriera e stesso partito; un click successivo voluto avanza ancora. Durata di un avanzamento misurata: circa 50-57 ms (è il calcolo, non un'attesa).

## 3. Test
Superati: `check-close-week-immediate`, `check-button-response`, `check-advance`, `check-advance-turn`, `check-advance-modes`, `check-reload-advance`, `check-gameplay`, `check-calendar`, `check-calendar-scheduling`, `check-appodeal`, `check-appodeal-safety`, `check-funds-ad`, `check-ads-states`, `check-android`, `check-capacitor`, `check-app-identity`, `check-welcome-reward`, `check-legal`, `check:publication`, `check:security`; build Gradle `bundleRelease` riuscita. Non eseguiti: prove su telefono, intera regressione da 340 comandi.
