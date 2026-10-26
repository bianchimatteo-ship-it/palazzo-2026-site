# Google Play — preparazione tecnica, scheda e passaggi manuali (22/10/2026)

**Stato: bundle `.aab` NON generato (BLOCCATO in questo ambiente).** Qui non c'è l'Android SDK (piattaforma 36, build-tools) e `dl.google.com`, da cui si scarica, non è raggiungibile; Java e Gradle ci sono, ma senza SDK Android Gradle Plugin non compila. Nessuna chiave di firma esiste nel repository né è stata inventata. Nessun `.apk`/`.aab` è stato provato su dispositivo o emulatore. Nulla è stato pubblicato su Google Play.

## 1. Verifica del progetto Android (`android/`)

| Voce | Valore trovato | Esito |
|---|---|---|
| `applicationId` / `namespace` | `it.matteobianchi.politicando2026` (uguale a `capacitor.config.json`) | coerente, invariato |
| `minSdk` / `compileSdk` / `targetSdk` | 24 / 36 / 36 | già conforme al requisito di target API 36 di Play (vedi `docs/app-stato.md`), invariato |
| `versionCode` / `versionName` | 1 / "1.0" | corretti per un primo caricamento; **aumentare `versionCode` a ogni nuovo caricamento** |
| Permessi | solo `INTERNET` | nessun permesso sensibile |
| Dipendenze native | Capacitor 8.5.x, AndroidX appcompat/coordinatorlayout/core-splashscreen; nessun SDK di pubblicità, analisi, pagamenti o notifiche push (il plugin google-services si applica solo se esiste `google-services.json`, che non c'è) | nessun SDK di terzi |
| Rete | solo HTTPS (origine `https://localhost` dell'app, Worker pubblicato in HTTPS); nessun `usesCleartextTraffic`, nessun `server.url` in `capacitor.config.json` | ok |
| Backup | `allowBackup="true"` (predefinito di Capacitor): Android può includere i dati dell'app nel backup Google dell'utente | dichiarato nell'informativa (§7); il titolare può scegliere di disattivarlo |
| Firma di rilascio | **aggiunta** in `android/app/build.gradle`: legge `android/keystore.properties` (ignorato da git) o le variabili `POLITICANDO_KEYSTORE_FILE`, `_KEYSTORE_PASSWORD`, `_KEY_ALIAS`, `_KEY_PASSWORD`; senza una chiave valida `bundleRelease`/`assembleRelease` **falliscono** con un messaggio che elenca cosa manca (mai i valori); le build debug non sono toccate | nessun segreto nel repository; `.gitignore` esclude `*.jks`, `*.keystore` e `keystore.properties` |
| Segreti nel bundle | `npm run build:www` rifiuta file estranei, segreti e host esterni; la credenziale amministrativa non è nel codice (`check-admin-credential`) | verificato dai test |
| Dipendenze npm | `npm audit --omit=dev`: 3 avvisi *moderate* (`uuid` → `xcode` → `@capacitor/cli`), solo strumenti di build, non inclusi nell'app; la correzione proposta (`--force`) è un declassamento del CLI e non è stata applicata | da rivedere a ogni aggiornamento di Capacitor |

## 2. Come costruire il bundle firmato (passaggi manuali, su una macchina con Android Studio/SDK)

```
npm ci
npm run version:build
npm run build:www
npx cap sync android
npm run check:www && npm run check:android -- --release --previous-version-code <versionCode già su Play>
# prima volta: creare la chiave di caricamento (conservarla fuori dal repository e farne una copia sicura)
keytool -genkeypair -v -keystore politicando-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
# android/keystore.properties (non committare): storeFile=/percorso/politicando-upload.jks  storePassword=…  keyAlias=upload  keyPassword=…
cd android && ./gradlew bundleRelease
# dopo: verificare la firma del .aab (jarsigner -verify -verbose -certs app-release.aab) prima del caricamento; incrementare versionCode in android/app/build.gradle a ogni caricamento
# risultato: android/app/build/outputs/bundle/release/app-release.aab
```

Consigliato: **Play App Signing** (Google conserva la chiave di firma, il titolare la sola chiave di caricamento). `android/gradlew.bat` resta escluso dal commit (`skip-worktree`).

## 3. Prove da fare su dispositivo prima di pubblicare (NON ESEGUITE qui)

Installazione pulita e aggiornamento da una versione precedente; avvio a freddo e a caldo; creazione account, accesso, uscita, cambio account; recupero della password (e-mail reale); eliminazione dell'account (in app e dalla pagina web); salvataggio, ripresa, esportazione/importazione; importazione di un logo da file e da indirizzo (selettore file di sistema); modalità aereo (gioco offline); tasto indietro; area sicura/notch; tastiera sui moduli; lettura di crash/ANR in Play Console (pre-launch report).

## 4. Scheda del negozio

**Titolo** (≤30): `POLITICANDO 2026` · **Categoria**: Giochi → Simulazione (a scelta del titolare) · **Contatto**: `politicando2026simulazione@gmail.com`.

URL richiesti (sito pubblicato): politica sulla privacy `https://palazzo-2026-site.bianchimatteo657.workers.dev/privacy.html` (inglese: `privacy-en.html`); eliminazione dell'account `https://palazzo-2026-site.bianchimatteo657.workers.dev/elimina-account.html` (inglese: `delete-account-en.html`). Le pagine sono raggiungibili da chiunque; oggi hanno `noindex` (solo contro l'indicizzazione dei motori di ricerca) finché i requisiti legali sono aperti.

### Italiano
- **Descrizione breve** (≤80): `Simulazione politica italiana: crea il tuo personaggio e costruisci la carriera.`
- **Descrizione completa**:
  > POLITICANDO 2026 è un gioco di simulazione della politica italiana. Crei il tuo personaggio, scegli da dove partire e costruisci una carriera: campagne elettorali, sondaggi, partiti, Parlamento, governo e istituzioni, settimana dopo settimana.
  >
  > • Un calendario che segue le regole delle elezioni e delle istituzioni italiane.
  > • Dati reali di parlamentari, gruppi, governo e leggi, mostrati con la loro fonte pubblica e distinti da ciò che è simulato.
  > • Tutto ciò che accade nella tua partita (voti, notizie, sondaggi, rapporti) è inventato dal gioco: non è informazione elettorale, né giornalismo reale, né una previsione.
  > • Gioca senza account: la partita resta sul tuo dispositivo e non invia nulla ai nostri server. L'account, facoltativo e riservato a chi ha almeno 14 anni, serve a ritrovare le carriere su altri dispositivi.
  > • Nessuna pubblicità, nessuna analisi, nessun acquisto.
  > • Puoi aggiungere, solo per te, i loghi dei partiti che hai il diritto di usare: restano sul tuo dispositivo e, se hai un account, sono copiati anche nell'archivio online del tuo account per ritrovarli su altri dispositivi.
  >
  > POLITICANDO 2026 non è collegato né approvato da partiti, movimenti, istituzioni o persone reali citati.

### English
- **Short description** (≤80): `Italian politics simulation: build your career from the ballot box to Parliament.`
- **Full description**:
  > POLITICANDO 2026 is a simulation game of Italian politics. Create your character, choose where to start and build a career: election campaigns, polls, parties, Parliament, government and institutions, week after week.
  >
  > • A calendar that follows the rules of Italian elections and institutions.
  > • Real data on members of parliament, groups, government and laws, shown with its public source and kept distinct from what is simulated.
  > • Everything that happens in your game (votes, news, polls, relationships) is invented by the game: it is not electoral information, not real journalism and not a forecast.
  > • Play without an account: the game stays on your device and sends nothing to our servers. The account, optional and reserved for people aged 14 or over, lets you find your careers on other devices.
  > • No ads, no analytics, no purchases.
  > • You can add, for yourself, the party logos you have the right to use: they stay on your device and, if you have an account, are also copied to your account's online storage so you can find them on other devices.
  >
  > POLITICANDO 2026 is neither connected to nor approved by the parties, movements, institutions or people it mentions.

(Il gioco è in italiano e in inglese; la scheda in inglese va caricata come traduzione della scheda predefinita.)

## 5. Dichiarazioni di Play Console — fatti, non scelte

Le dichiarazioni le compila e le firma il titolare. Qui ci sono solo i **fatti verificabili nel codice**; le scelte che dipendono da una decisione sono lasciate vuote.

| Dichiarazione | Fatto / stato |
|---|---|
| Annunci | **L'app non contiene annunci** (nessun SDK pubblicitario). |
| Acquisti in-app / app a pagamento | Nessuno. |
| Accesso all'app | Tutte le funzioni sono disponibili senza account; l'account è facoltativo. Nessuna credenziale di prova è fornita nel repository: il revisore può giocare subito o creare un proprio account di prova (basta nome utente e password; l'e-mail è facoltativa). Per provare il recupero password serve un indirizzo e-mail reale. |
| Pubblico di destinazione e Famiglie | **DA DECIDERE dal titolare** (vedi `docs/minori-e-privacy.md` §3). Non scegliere le fasce per superare i controlli. Fatto: l'account è riservato a chi dichiara almeno 14 anni; si gioca senza account a qualunque età. |
| Classificazione dei contenuti (IARC) | **Questionario da compilare dal titolare.** Fatti utili: tema politico/elettorale reale simulato; nessuna violenza, sesso, gioco d'azzardo, linguaggio volgare né uso di sostanze nel gioco; contenuti generati dall'utente: solo i nomi inventati del proprio personaggio e dei propri partiti, privati (non condivisi con altri utenti); nessuna chat né condivisione di posizione. |
| Sicurezza dei dati — raccolta | Con account: *Informazioni personali* → nome utente e (facoltativo) e-mail; *Attività nell'app* → contenuto dei salvataggi; *Foto e video* → i loghi scelti dall'utente (PNG, JPEG o WebP, fino a 300 KB e 150 per account), solo con un account, conservati in R2 con i metadati in D1 ed eliminabili uno a uno o con l'account; identificativi → impronta di sessione. Senza account: nessun dato raccolto. |
| Sicurezza dei dati — condivisione | Nessuna vendita né condivisione a fini di pubblicità. Fornitori che trattano per conto del titolare: Cloudflare (hosting, D1, KV, R2) e Google Apps Script/Gmail (solo invio dei messaggi e-mail): da dichiarare secondo le definizioni correnti di Play (la qualifica di Google è un punto aperto, `email-fornitore`). |
| Sicurezza dei dati — sicurezza | Dati in transito cifrati (HTTPS); password mai inviata né conservata in chiaro; eliminazione dei dati disponibile in app e dal web. |
| Eliminazione dell'account | In app: Menu → Account → «Elimina il mio account»; web: URL indicato sopra. Rimuove account, salvataggi con versioni precedenti, e-mail e sessioni (test `check-account-deletion`). |
| App governativa / finanziaria / salute / notizie | Non è un'app di notizie né governativa; è una simulazione: la scheda dice che non è informazione elettorale né giornalismo. |
| Politica sul contenuto politico/elezioni | Le notizie e i sondaggi dopo l'avvio sono generati dal gioco e dichiarati come simulazione; i dati reali sono distinti e con fonte. |

## 6. Risorse grafiche richieste (inventario)

| Risorsa | Requisito Play | Stato |
|---|---|---|
| Icona | PNG 512×512 | `icons/icon-512.png` presente; **titolarità/licenza da documentare** (`diritti-asset`) |
| Immagine in evidenza | PNG/JPEG 1024×500 | **mancante**: da creare |
| Screenshot telefono | da 2 a 8, lato minimo 320 px, rapporto fino a 2:1 (consigliati 1080×1920) | **mancanti**: da catturare dall'app installata, in italiano e in inglese; mostrare solo schermate del gioco e dati inventati |
| Screenshot tablet 7"/10" | facoltativi (consigliati per la visibilità) | mancanti |
| Icone e splash nativi | `android/app/src/main/res` | **sostituiti il 22/10/2026**: nel progetto c'erano i segnaposto del modello Capacitor (la «X» azzurra); ora icona adattiva, tonda e splash derivano dall'icona del gioco (`icons/icon-maskable-512.png`, stessa titolarità da documentare). Da controllare a vista su dispositivo |
| Video promozionale | facoltativo | assente |

Nelle schermate non devono comparire loghi di partiti di terzi che il titolare non abbia diritto di mostrare: usare le grafiche originali del gioco.

## 7. Cosa resta a Matteo Bianchi (in ordine)

1. Chiudere i requisiti legali bloccanti di `docs/legale-requisiti.json` (indirizzo, DPA Cloudflare, minori, diritti sugli asset, account sviluppatore Play).
2. Creare l'account sviluppatore Play (verifica identità/indirizzo richiesta da Google) e decidere chi figura come sviluppatore.
3. Costruire il bundle firmato (§2) e provarlo su dispositivo (§3); caricarlo in un test interno, leggere il pre-launch report.
4. Compilare Play Console: scheda (§4), dichiarazioni (§5), IARC, pubblico di destinazione, sicurezza dei dati; caricare le risorse (§6).
5. Pubblicare **solo dopo** i punti precedenti: nulla è stato inviato a Google Play da questo lavoro.
