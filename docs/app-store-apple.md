# Apple App Store — checklist di pubblicazione (13/11/2026)

Stato: **nulla è stato iscritto, costruito o inviato ad Apple.** Non è un parere legale. Ruoli e analisi: `docs/audit-legale-conformita.md` §2–3. Legenda: [V] letto su fonte ufficiale oggi; [NV] da verificare sul testo ufficiale; ☐ da fare; ⚠ decisione dei genitori.

## A. Account (prima di tutto)
- ☐ ⚠ Scegliere quale genitore si iscrive: serve la maggiore età nella propria area; un minore usa l'Apple Account del genitore [V, developer.apple.com/programs/enroll].
- ☐ ⚠ Individuale o organizzazione. Individuale: il nome legale del genitore è il venditore pubblico [V]. Organizzazione: solo entità giuridica riconosciuta con D-U-N-S, e-mail e sito di dominio; non DBA, ditte fittizie o nomi commerciali [V]. Oggi non risulta alcuna entità: l'organizzazione non è disponibile senza crearne una.
- ☐ Apple Account del genitore con autenticazione a due fattori; dati reali (nome legale, e-mail, telefono, indirizzo senza caselle postali) [V].
- ☐ Quota 99 USD/anno (può variare) [V]; il genitore accetta il Program License Agreement [V].
- ☐ Aggiungere Matteo in App Store Connect con un ruolo limitato, senza condividere le credenziali dell'Account Holder [NV: ruoli].
- ☐ Chiarire per iscritto autore del codice, licenza di distribuzione e chi decide su rimozione/trasferimento dell'app (diritto d'autore ≠ titolarità dell'account).
- ☐ Condizioni di trasferimento dell'app tra account e di conversione individuale → organizzazione (Apple rinvia al supporto) [V].

## B. Conformità e metadati (App Review Guidelines)
- ☐ 5.1.1: privacy policy raggiungibile nel campo di App Store Connect e **nell'app** [NV]. Stato: collegamento nell'app presente (menu → informazioni legali); URL pubblico `…/privacy.html` (inglese `privacy-en.html`). Le pagine hanno ancora segnaposto: **non inviare finché i requisiti indispensabili non sono chiusi**.
- ☐ 5.1.1(v): eliminazione dell'account in app [NV]. Presente: Menu → Account → «Elimina il mio account» + pagina web.
- ☐ 1.5: contatto di supporto raggiungibile (Support URL + e-mail) [V]. Presente: `politicando2026simulazione@gmail.com` nel gioco; serve un Support URL pubblico (la pagina del portale).
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
- Contatti: indirizzo e-mail (facoltativo). Identificativi: nome utente; **identificativo casuale del dispositivo** (ricompense; da classificare tra gli «ID dispositivo»). Contenuto utente: salvataggi, loghi caricati. Uso/dati di gioco: tempo di gioco per le ricompense. Dati diagnostici/sicurezza: IP nella tabella tentativi (15 minuti, 24 ore).
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

## F. Tecnica (non eseguita qui: serve un Mac con Xcode)
- ☐ `npm run build:www && npx cap sync ios`; Xcode 26+; firma con il team del genitore; bundle id: ⚠ decidere prima (oggi Android usa `it.matteobianchi.politicando2026`; il nome di Matteo resta nell'identificativo per sempre).
- ☐ Test su dispositivo e TestFlight: avvio, account, eliminazione, offline, recupero password, tastiera.
- ☐ Icone/launch screen iOS (verificare che non siano i segnaposto Capacitor, come era per Android).
- ☐ Versione/build number crescente a ogni invio.

## G. Stato tecnico iOS (15/11/2026) e decisioni prese
**Decisioni dei genitori:** app universale iPhone + iPad; iPhone solo verticale; iPad verticale e orizzontale; Bundle ID invariato `it.matteobianchi.politicando2026`; prima release senza pubblicità; ricompensa Instagram spenta su iOS.

| Voce | Stato |
|---|---|
| Icona 1024 senza alfa, splash | ✅ dal marchio del gioco (non più il segnaposto Capacitor); `check-capacitor` lo verifica |
| `PrivacyInfo.xcprivacy` | ✅ app: nessun tracciamento, dati dichiarati da `privacy.html` §3 (e-mail, ID utente, ID dispositivo, contenuto) — **da confermare dal titolare con la privacy label**; manifest dei plugin: nessun plugin nativo su iOS (`includePlugins: []`) |
| `Info.plist` | ✅ `arm64`, iPhone verticale, iPad quattro orientamenti, nessun permesso, nessuna modalità in background |
| Firma | automatica, nessun team nel repository (lo sceglie il titolare dell'account) |
| Safe area | ✅ `viewport-fit=cover` + regole solo iOS (`html.platform-ios`) per notch e Dynamic Island; **da verificare sul simulatore** |
| iPad | layout a barra laterale già adattivo (820/1024/1180 px verificati in Chrome: nessuno scorrimento orizzontale); da verificare su simulatore e con tocco |
| Instagram su iOS | ✅ spento (resta il collegamento senza premio); `check-rewards-sync` |
| AdMob | non presente su iOS; il pacchetto SPM è riallineato a Capacitor 8.5.3 |
| Login/registrazione/recupero/eliminazione/salvataggi | stessa logica del web, Worker già accetta `capacitor://localhost`; test automatici su web (`check-accounts`, `check-account-deletion`, `check-account-isolation`, `check-saves`); **nessuna prova su iOS** |
| Build, simulatore, TestFlight | ❌ **non eseguiti: serve un Mac con Xcode** |

### Prove da fare su Mac (non eseguite)
`npm ci && npm run build:www && npx cap sync ios`, aprire `ios/App/App.xcworkspace` (Xcode 26+), scegliere il team, e provare su: iPhone piccolo (es. SE), iPhone con Dynamic Island, iPad verticale, iPad orizzontale: avvio, registrazione, accesso, recupero password, eliminazione account, tastiera sui moduli, safe area (barra inferiore, titoli), selettore file (loghi), salvataggio e ripresa, modalità aereo (gioco offline), link esterni e `mailto:`, rotazione su iPad, e che iPhone non ruoti.

### Scheda dell'App Store (bozza, da far approvare ai genitori)
**Nome:** POLITICANDO 2026 · **Sottotitolo (≤30):** `Simulazione politica italiana` / `Italian politics simulation`
**Descrizione IT:** come in `docs/google-play.md` §4 (stesso testo, senza riferimenti ad Android); **EN:** idem. **Parole chiave:** simulazione, politica, elezioni, Parlamento, strategia / simulation, politics, elections, parliament, strategy. **Categoria:** Giochi → Simulazione (a scelta). **Classificazione per età:** questionario da compilare sui fatti (tema politico simulato, nessuna violenza, UGC non condiviso, nessuna pubblicità in questa versione). **Supporto:** pagina del portale + `politicando2026simulazione@gmail.com`. **Privacy policy:** `…/privacy.html` (IT) e `privacy-en.html`: solo dopo la chiusura dei requisiti legali.
**Privacy label (da compilare dal titolare):** contatti → e-mail (facoltativa); identificativi → ID utente (nome utente) e ID dispositivo (casuale, ricompense); contenuto → salvataggi e loghi; tutti collegati all'identità, per funzionalità dell'app, **nessun tracciamento**; senza account nessun dato.
**Screenshot:** prove di formato in `/tmp/ios-qa/appstore/` (fuori dal repository): iPhone 6,9" 1320×2868 e 6,5" 1284×2778, iPad 13" 2064×2752, IT/EN, pagine Home, Sondaggi, Notizie, Ricompense. Sono rendering di Chrome: vanno rifatti dal simulatore prima dell'invio.

### Prossimi passi per l'invio
1. Iscrizione Apple del genitore (sezione A) e decisione trader DSA. 2. Mac: build, simulatore, correzioni. 3. Archivio e TestFlight interno. 4. App Store Connect: scheda, privacy label, classificazione, screenshot, URL di privacy e supporto. 5. Invio per la revisione solo con i requisiti legali chiusi.
