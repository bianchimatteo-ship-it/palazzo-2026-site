# Apple App Store — checklist di pubblicazione (13/11/2026)

Stato al 16/11/2026: **Apple Developer non ancora attivato; nessuna build firmata, nessun upload e nessun invio ad Apple.** Su Mac è stata completata una Release build senza firma e creato/verificato un archivio preliminare `.xcarchive` (non caricabile finché non viene firmato). Non è un parere legale. Ruoli e analisi: `docs/audit-legale-conformita.md` §2–3. Legenda: [V] letto su fonte ufficiale oggi; [NV] da verificare sul testo ufficiale; ☐ da fare; ⚠ decisione dei genitori.

## Priorità per la prima release iOS (ad-free)

I requisiti del registro generale non sono tutti requisiti specifici di App Store:

| Requisito aperto | Impatto sulla prima release iOS |
|---|---|
| `account-apple-developer` | Bloccante: iscrizione dell'adulto titolare, pagamento, accordi e Team di firma |
| `titolare-trattamento`, `offerente-servizio`, `indirizzo-titolare` | Bloccanti per finalizzare informativa, termini e identità pubblica del servizio; ruoli distinti da validare, non si presumono |
| `cloudflare-dpa`, `email-fornitore`, `rappresentanza-capacita` | Da chiarire prima di dichiarare in modo definitivo i fornitori e i contratti usati dall'app |
| `minori`, `eta-pubblico-store` | Da decidere/verificare: pubblico, account 14+, questionario Apple e Paesi di distribuzione |
| `diritti-asset` | Da documentare: marchio, grafica, font, dati/immagini di terzi e licenza per la distribuzione |
| `trader-dsa` | Il titolare dell'account deve dichiarare lo status; Apple richiede la dichiarazione anche per chi non distribuisce nell'UE. Se trader, contatti verificati sono pubblicati sulla pagina UE |
| `account-sviluppatore-play` | Relativo a Google Play: non è un campo né un'iscrizione richiesta da App Store; mantenere comunque coerenti i ruoli del servizio tra gli store |
| `admob-futuro` | Non blocca la prima release iOS ad-free (1.0 (1), in revisione): InMobi è l'unico provider e il suo codice iOS è preparato nel repository per l'aggiornamento successivo, non nella 1.0 (1) (docs/inmobi.md) |

Non creare segnaposto per i dati legali e non dichiarare chiuso un requisito senza prova o decisione del soggetto responsabile. Il fatto che un requisito non sia specifico di App Store non significa che sia irrilevante per la gestione complessiva del servizio.

## A. Account (prima di tutto)
- ☐ ⚠ **Decisione comunicata il 16/11/2026:** Apple Developer sarà intestato allo stesso genitore che possiede l'account Google Play. Iscrizione individuale del genitore prevista, da completare; il nome legale di quel genitore sarà il venditore pubblico su App Store. Serve Apple Account con 2FA, verifica identità, dati legali corretti e pagamento. Non equivale a chiudere automaticamente i requisiti su offerente del servizio e titolare GDPR [V, documentazione Apple].
- ☐ ⚠ Individuale o organizzazione. Individuale: il nome legale del genitore è il venditore pubblico [V]. Organizzazione: solo entità giuridica riconosciuta con D-U-N-S, e-mail e sito di dominio; non DBA, ditte fittizie o nomi commerciali [V]. Oggi non risulta alcuna entità: l'organizzazione non è disponibile senza crearne una.
- ☐ Apple Account del genitore con autenticazione a due fattori; dati reali (nome legale, e-mail, telefono, indirizzo senza caselle postali) [V].
- ☐ Quota 99 USD/anno (può variare) [V]; il genitore accetta il Program License Agreement [V].
- ☐ Aggiungere Matteo in App Store Connect con un ruolo limitato, senza condividere le credenziali dell'Account Holder [NV: ruoli].
- ☐ Chiarire per iscritto autore del codice, licenza di distribuzione e chi decide su rimozione/trasferimento dell'app (diritto d'autore ≠ titolarità dell'account).
- ☐ Condizioni di trasferimento dell'app tra account e di conversione individuale → organizzazione (Apple rinvia al supporto) [V].

## B. Conformità e metadati (App Review Guidelines)
- ☐ 5.1.1: privacy policy raggiungibile nel campo di App Store Connect e **nell'app** [NV]. Stato: collegamento nell'app presente (menu → informazioni legali); URL pubblico `https://palazzo-2026-site.bianchimatteo657.workers.dev/privacy.html` (inglese `https://palazzo-2026-site.bianchimatteo657.workers.dev/privacy-en.html`); il percorso senza estensione `/privacy` non è nella allowlist del Worker. Le pagine hanno ancora segnaposto: **non inviare finché i requisiti indispensabili non sono chiusi**.
- ☐ 5.1.1(v): eliminazione dell'account in app [NV]. Presente: Menu → Account → «Elimina il mio account» + pagina web.
- ☐ 1.5: contatto di supporto raggiungibile (Support URL + e-mail) [V]. Pagina pubblica italiana e inglese aggiunta al branch: `https://palazzo-2026-site.bianchimatteo657.workers.dev/support.html` e `/support-en.html`; **non ancora deployata né verificata online**. Contatto: `politicando2026simulazione@gmail.com`.
- ☐ 2.3: metadati fedeli, screenshot del gioco reale, età nella descrizione coerente con la classificazione [V]. Nessun logo di partiti di terzi negli screenshot.
- ☐ 2.3.9: niente dati di persone reali negli account di prova; il gioco non richiede credenziali di prova (si gioca senza account).
- ☐ 1.2 Contenuti degli utenti [V testo]: i nomi/loghi dei giocatori sono privati, non condivisi con altri; confermare che non si configura UGC. Se si volesse condividere, servirebbero filtri, segnalazione, blocco e contatto.
- ☐ 1.1.1 / 5.2: contenuti non diffamatori; nomi e dati di persone/partiti reali con fonte e dicitura «simulazione»; nessun logo di terzi non autorizzato [V 1.1.1; 5.2 NV].
- ☐ 4.2 funzionalità minima: l'app non è un sito impacchettato [NV]: contiene gioco completo offline.
- ☐ Ricompensa «comunità» (Instagram attiva, TikTok spenta): verificare le linee guida sulle ricompense per azioni sui social e sulla pubblicità (3.2.2) [NV]; se resta dubbio, spegnere anche Instagram sulla build iOS (decisione dei genitori).
- ☐ Nessuna pubblicità/analisi/acquisti: confermare nelle risposte; se si introdurranno annunci premiati, aggiornare informativa e label prima.
- ☐ Sign in with Apple: l'app ha solo un account proprio, non login di terzi: verificare sul testo corrente della 4.8 che non sia richiesto [NV].

## C. App Privacy («nutrition label») [V, app-privacy-details]
Va dichiarato tutto ciò che si trasmette fuori dal dispositivo oltre il tempo necessario, anche se non è analisi/pubblicità [V]. Con un account, secondo `privacy.html` §3:
- Contatti: indirizzo e-mail (facoltativo). Identificativi: nome utente e **identificativo casuale del dispositivo** usato per le ricompense. Contenuti: salvataggi e loghi personalizzati salvati nell’app, classificati come **Gameplay Content** (contenuto di gioco generato dall’utente). Uso: intervalli di tempo di gioco usati per attribuire ricompense, classificati come **Product Interaction**. IP: il Worker usa l’indirizzo di rete per limitare i tentativi ripetuti; Apple indica di classificare gli IP in base all’uso (fra le categorie possibili cita Device ID e dati diagnostici), quindi va confermato dal titolare nel questionario. Collegamento all’identità: i dati dell’account sono collegati all’account; non c’è tracking.
- Collegati all'identità: sì (account). Tracciamento: nessuno (nessun SDK, nessun dato condiviso per pubblicità).
- Senza account: nessun dato raccolto.
- ☐ ⚠ La compila Account Holder/Admin/App Manager [V]; privacy policy URL obbligatorio [V].
- ☐ Privacy manifest / required reason API: **non verificato** (pagina non leggibile); controllare i plugin Capacitor di `ios/` con Xcode.

## D. Classificazione per età [riassunto, da ricontrollare]
- ☐ Rispondere onestamente al questionario (tiers 4+/9+/13+/16+/18+ da OS 26; Unrated non pubblicabile) [NV]. Fatti: tema politico reale simulato; nessuna violenza, sesso, gioco d'azzardo, UGC condiviso, chat, web illimitato (link esterni a social/fonti ufficiali al tocco).
- ☐ ⚠ Non scegliere la categoria Kids (1.3 vieta link esterni non protetti da cancello genitori): il gioco ha link esterni; coerente con il pubblico non principalmente bambino.

## E. DSA / UE
- ☐ ⚠ Dichiarazione «trader»: Apple la richiede a chi distribuisce in UE; la gratuità da sola non basta a escluderla [NV, riassunto], consultare il consulente. Se «trader», dati pubblici (nome, indirizzo, telefono, e-mail).
- ☐ Verificare altri obblighi per la distribuzione in UE (pagina «Distributing apps in the EU») [non letta].

## F. Tecnica
- ☐ `npm run build:www && npx cap sync ios`; Xcode 26+; firma con il team del genitore; bundle id: ⚠ decidere prima (oggi Android usa `it.matteobianchi.politicando2026`; il nome di Matteo resta nell'identificativo per sempre).
- ☐ Test su dispositivo e TestFlight: avvio, account, eliminazione, offline, recupero password, tastiera.
- ☐ Icone/launch screen iOS (verificare che non siano i segnaposto Capacitor, come era per Android).
- ☐ Versione/build number crescente a ogni invio.

## G. Stato tecnico iOS (15/11/2026) e decisioni prese
**Decisioni dei genitori:** app universale iPhone + iPad; iPhone solo verticale; iPad verticale e orizzontale; Bundle ID invariato `it.matteobianchi.politicando2026`; prima release senza pubblicità; ricompensa Instagram spenta su iOS.

| Voce | Stato |
|---|---|
| Icona 1024 senza alfa, splash | ✅ dal marchio del gioco (non più il segnaposto Capacitor); `check-capacitor` lo verifica |
| `PrivacyInfo.xcprivacy` | ⚠️ aggiornato nel branch: `EmailAddress`, `UserID`, `DeviceID`, `ProductInteraction`, `GameplayContent`, `PhotosorVideos` (loghi caricati) e `OtherDataTypes` (prove di autenticazione/sessioni). Lo stesso DeviceID include l'IP temporaneo usato dal Worker per il rate-limit. Nessun tracking. Rigenerare il Privacy Report Xcode dopo la sincronizzazione. `includePlugins: []` esclude i plugin Capacitor da iOS, ma non sostituisce la verifica di Capacitor e delle API richieste |
| `Info.plist` | ✅ `arm64`, iPhone verticale, iPad quattro orientamenti, nessun permesso, nessuna modalità in background |
| Firma | automatica, nessun team nel repository (lo sceglie il titolare dell'account) |
| Safe area | ✅ `viewport-fit=cover` + regole iOS; layout verificato dall'utente su simulatore iPhone e iPad |
| iPad | ✅ layout e funzioni verificati dall'utente su simulatore in verticale e orizzontale |
| Instagram su iOS | ✅ spento (resta il collegamento senza premio); `check-rewards-sync` |
| Pubblicità | la 1.0 (1) non ha SDK pubblicitari; nel repository il bridge InMobi (SDK 11.5.0) è nel pacchetto SPM per l'aggiornamento successivo (Capacitor 8.5.3) |
| Login/registrazione/recupero/eliminazione/salvataggi | stessa logica del web, Worker già accetta `capacitor://localhost`; test automatici su web (`check-accounts`, `check-account-deletion`, `check-account-isolation`, `check-saves`); **nessuna prova su iOS** |
| Build Release / archivio | ✅ Xcode 27.2 + iOS SDK 27.2; `BUILD SUCCEEDED`; `.xcarchive` preliminare senza firma creato e bundle verificato (26 MB, bundle ID/versione corretti) |

### Passaggi tecnici ancora da completare
- Sincronizzare sul Mac gli aggiornamenti recenti del branch e verificare `npm run check:publication` (include ora le pagine di supporto).
- Attivare l'Apple Developer Program del genitore, scegliere il Team in Xcode e creare un **nuovo archivio firmato**; l'archivio preliminare senza firma non si carica.
- Verificare il privacy manifest e le API con required reason dell'app e di ogni dipendenza nell'archivio.
- Prova su almeno un dispositivo fisico e poi TestFlight; i test su simulatori iPhone/iPad sono già stati confermati dall'utente.
- App Store Connect: metadati, privacy label, age rating, contatti/trader e screenshot.

### Scheda dell'App Store (bozza, da far approvare ai genitori)
**Nome:** POLITICANDO 2026 · **Sottotitolo (≤30):** `Simulazione politica italiana` / `Italian politics simulation`
**Descrizione IT:** come in `docs/google-play.md` §4 (stesso testo, senza riferimenti ad Android); **EN:** idem. **Parole chiave:** simulazione, politica, elezioni, Parlamento, strategia / simulation, politics, elections, parliament, strategy. **Categoria:** Giochi → Simulazione (a scelta). **Classificazione per età:** questionario da compilare sui fatti (tema politico simulato, nessuna violenza, UGC non condiviso, nessuna pubblicità in questa versione). **Supporto:** pagina del portale + `politicando2026simulazione@gmail.com`. **Privacy policy:** `…/privacy.html` (IT) e `privacy-en.html`: solo dopo la chiusura dei requisiti legali.
**Privacy label (da compilare dal titolare):** contatti → e-mail (facoltativa); identificativi → ID utente (nome utente) e ID dispositivo (casuale, ricompense); contenuto → salvataggi e loghi; tutti collegati all'identità, per funzionalità dell'app, **nessun tracciamento**; senza account nessun dato.
**Screenshot:** prove di formato in `/tmp/ios-qa/appstore/` (fuori dal repository): iPhone 6,9" 1320×2868 e 6,5" 1284×2778, iPad 13" 2064×2752, IT/EN, pagine Home, Sondaggi, Notizie, Ricompense. Sono rendering di Chrome: vanno rifatti dal simulatore prima dell'invio.

### Prossimi passi per l'invio
1. Iscrizione Apple del genitore (sezione A) e decisione trader DSA. 2. Mac: build, simulatore, correzioni. 3. Archivio e TestFlight interno. 4. App Store Connect: scheda, privacy label, classificazione, screenshot, URL di privacy e supporto. 5. Invio per la revisione solo con i requisiti legali chiusi.
