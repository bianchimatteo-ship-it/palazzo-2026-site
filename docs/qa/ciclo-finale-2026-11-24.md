# Ciclo finale di correzioni e controllo qualità — 24/11/2026

Rapporto del ciclo «correzioni, miglioramenti e controllo qualità» e del ciclo precedente (scioglimento delle fusioni e video da 1.000 €), che era rimasto senza rapporto finale. Stato: 🟢 fatto e verificato con test automatici · 🟡 fatto, verifica parziale · 🔴 non fatto · ⚫ non verificabile qui (serve un dispositivo, un account o il titolare).

## Mappa dei problemi, cause e file

| # | Problema | Causa trovata | File |
|---|---|---|---|
| 14 | Avanzamento di 2 e 4 settimane che si blocca, anche delegando | (1) Una settimana che chiude un voto apre la Notte Elettorale o la scena del seggio: la settimana successiva dello stesso avanzamento chiamava `advance()`, che con la Notte aperta lancia un errore non gestito → il pulsante non rispondeva più. (2) Fiducia, bilancio e proposte del giocatore fermavano sempre, anche delegando. (3) In `app.js` il controllo dei voti aperti intercettava il pulsante e chiamava `advance(7)`, ignorando le settimane scelte. (4) Lo staff leggeva le impostazioni del browser, non quelle passate dalla pagina (account o ospite). | `src/core/store.js` (`advanceTurn`, `castByStaff`, `essentialChoice`, `nightEnabled`), `src/ui/app.js`, `src/core/settings.js`, `src/ui/menu.js` |
| 13 | Lista sopra soglia ma giocatore non eletto | Il motore era coerente tra risultato e carriera (verificato su campagne reali: chi risulta eletto ha la carica nel salvataggio). Unico difetto trovato: in una coalizione i seggi della lista del giocatore erano `round(seggi × quota)`, che può dare 0 a una lista con diritto a un seggio (o 1 a chi non lo ha). Ora D’Hondt tra le liste della coalizione, la regola dei seggi del motore. | `src/core/election-engine.js` |
| 15 | «Altri» trattato come un partito | Due identificativi (`altre-liste` nei risultati, `altri` nella Notte) e la Notte ricostruiva le righe perdendo il flag `others`: «Altre liste» entrava in classifica, podio e aree. | `src/core/electorate.js` (`OTHERS_ID`, `isOthersRow`), `src/core/night-engine.js`, `src/ui/election-night.js`, `src/ui/election-report.js`, `src/core/store.js` |
| 2 | «Semplice iscritto» selezionato insieme a una carica | `levelStep()` selezionava anche la scheda del livello (comunale…) quando il percorso era «iscritto»; nel motore il seggio veniva creato e chiuso il primo giorno (restava un «consigliere di un giorno» nello storico) e `situation()` trattava l’iscritto da amministratore locale (livello iniziale usato come livello di carica). | `src/ui/career-wizard.js`, `src/ui/app.js`, `src/core/store.js` (`createCareer`), `src/core/career-engine.js` (`situation`) |
| 1 | Avatar da foto nella creazione | Già integrato nel ciclo precedente (galleria, fotocamera, editor esistente, anteprima, cambio e rimozione, ritratto temporaneo nel draft e assegnato al personaggio alla creazione, solo sul dispositivo). Verificato di nuovo. | `src/ui/career-wizard.js`, `src/ui/app.js`, `src/ui/photo-avatar.js`, `src/core/photo-avatar-store.js` |
| 5 | Fondazione da indipendente troppo ingombrante; dati persi | Sezione sempre aperta; a ogni ridisegno della pagina il modulo si svuotava e il logo scelto dalla galleria veniva scartato («non è più mostrato: non viene usato»). | `src/ui/party-life-view.js`, `src/ui/app.js` |
| 9 | Sfondi neri nelle scene | Un’ambientazione senza disegno registrato (scena salvata da una versione precedente, stanza rinominata) ripiegava sullo studio TV, che richiede rivale e conduttore e lanciava un errore: la scena restava sullo sfondo scuro del contenitore. | `src/ui/stage-art.js` (`drawSetting`) |
| 8 | Dialoghi e carriera | L’etichetta del giocatore nelle scene e negli studi usava l’ufficio puntato dal record anche se concluso (un incarico passato, o quello di un giorno dell’iscritto, mostrato come attuale). Nelle contestazioni l’evidenziazione restava sul giocatore mentre la narrazione diceva che parlavano i contestatori, e i contestatori non dicevano nulla. | `src/core/store.js` (`studioTags`, contesto del comizio), `src/core/rally-scene.js`, `src/ui/scene-view.js` |
| 10 | Settimane ripetitive | Le richieste interne del partito (stesso modello «richiesta-partito») si aprivano quasi ogni settimana. | `src/core/party-life-engine.js` (`openRequest`), `src/data/simulation/career-rules.js` |
| 4 | Font della data | La regola `.topbar .date-chip[data-action="date-picker"] { font: inherit }`, aggiunta quando la data è diventata un pulsante, annullava la dimensione e il peso propri della data. | `src/home.css` |
| 7 | Sottolineature, giallo, ciano | `.ghost-button { text-decoration: underline }` e i pulsanti del riepilogo; colori per passaggio del wizard (blu, verde, arancio, viola, ciano) e gradiente giallo chiaro del pulsante «Entra in Aula». | `src/theme.css`, `src/styles.css`, `src/scene.css` |
| 3, 11, 12 | Schermate iniziali, popup notizie, referendum | Interventi grafici e di usabilità (vedi sotto). | `src/ui/career-wizard.js`, `src/ui/news-view.js`, `src/sections.css`, `src/theme.css` |

## Che cosa è stato fatto

### 14 · Avanzamento e delega 🟢
- Nuova impostazione **«Avanzamento di più settimane»** (Impostazioni → Partita): **Fermati per le decisioni importanti** (predefinita) e **Delega tutto allo staff**.
- **A**: lo staff vota secondo «Votazioni delegate allo staff»; fiducia, bilancio, proposte proprie, decisioni urgenti, situazioni, campagna e Notte Elettorale fermano l’avanzamento con il motivo e le settimane trascorse.
- **B**: lo staff decide anche i voti essenziali con una regola fissa e documentata — **proposta del giocatore: a favore; altrimenti la linea del gruppo** (per la fiducia: maggioranza → a favore, opposizione → contro, la linea che il voto porta già); le questioni aperte prendono l’esito predefinito a fine settimana; la campagna prosegue da sola; **la Notte Elettorale non si gioca** (risultato registrato subito). Ogni voto dello staff va nel **diario** e nella memoria della carriera, i voti essenziali con il titolo «Delega totale». Si ferma solo se un voto non ha una linea da seguire, dicendolo.
- La Notte o la scena del seggio aperte durante un avanzamento lo fermano con il motivo invece di bloccarlo con un errore.
- Il pulsante usa sempre le settimane scelte; modalità e voti dello staff arrivano dalla pagina (impostazioni dell’account o dell’ospite).
- Feedback immediato: il pulsante mostra lo stato «in corso» prima della simulazione e ignora un secondo clic.
- Test: `check-advance-modes` (17 casi richiesti: 1/2/4 settimane, senza voti, voti ordinari, fiducia, voti importanti, bilancio, eventi urgenti, campagna fino al voto, delega ordinaria e totale, ricaricamento a metà, ogni settimana una volta, diario senza duplicati, nessun blocco). Esito misurato: **delega totale 320 turni, 800 settimane, 0 fermate, 217 voti dello staff (100 essenziali nel diario)**; modalità A 19 fermate per voti essenziali e 211 per decisioni, sempre con il motivo; campagna comunale: in B arriva al risultato senza Notte, in A si ferma per la campagna e poi per la Notte.

### 13 · Elezioni e seggi 🟢
- Seggi della lista del giocatore in coalizione con D’Hondt (sopra). Nessuna regola elettorale cambiata per forzare un’elezione.
- Test: `check-election-mandates` — politiche con risultati costruiti: soglia superata con seggi sufficienti → eletto; soglia superata ma posizione in lista oltre i seggi del collegio → **non eletto, motivo «posizione in lista»**; sotto soglia → nessun seggio; sei campagne comunali reali (2 eletti, 4 non eletti): chi è eletto ha la carica aperta nel salvataggio, i seggi della lista non superano quelli della coalizione. Restano verdi `check-elections`, `check-election-counts`, `check-seat-allocation`, `check-election-night-engine`, `check-election-night-ui`, `check-night-player-party`, `check-old-saves-votes`.

### 15 · «Altri» 🟢
Un identificatore canonico (`altri`) con il metadato `others: true`, un solo test `isOthersRow` usato da motore, Notte, report (riconosce anche `altre-liste` dei vecchi salvataggi). «Altri» resta nei totali dei voti ma non ha posizione in classifica, non vince aree, non ha seggi, non è il giocatore, non è una coalizione, è elencato per ultimo con «—» nel report.

### 2 · «Semplice iscritto» 🟢
Scelta autonoma nel wizard (nessuna carica elettiva selezionata insieme); **territorio di riferimento** separato (comune, provincia, regione), dichiarato «non una carica»; nessun seggio creato, nessuna carica di un giorno nello storico, nessun ruolo istituzionale nei ruoli e nelle attività; dopo il ricaricamento uguale. Le altre partenze conservano i seggi. Test: `check-starting-member`, `check-resignations`.

### 1 · Avatar da foto 🟢 / ⚫
Verificato il flusso del ciclo precedente (`check-photo-avatar`, `check-avatar`, `check-wizard-identity-visual`). **Fotocamera fisica ⚫**: il pulsante «Scatta una foto» usa `capture="user"`; non provato su un telefono reale.

### 5 · Fondazione del partito 🟢
Sezione **«Fonda un nuovo partito»** chiusa all’inizio, con indicatore aperto/chiuso; campi e logo scelto restano dopo chiusura, riapertura e ridisegni; selettore di file esistente (PNG/JPEG/WebP, 5 MB) riutilizzato, non duplicato. Il logo caricato diventa quello del partito nel gioco (catalogo dei loghi con l’id del nuovo partito). Test: `check-party-founding`, `check-party-founding-ui`, `check-wizard-logo-sync`.

### 9 · Sfondi neri 🟢
Ripiego su una stanza valida dello stesso tipo, e su una stanza valida anche se il disegno fallisce. Test: `check-scene-backgrounds` — **4.464 disegni** (62 attività × 6 momenti × 12 varianti): stanza sempre presente e intera, nessun colore non valido, al massimo una figura evidenziata ed è chi parla; ambientazione sconosciuta → stanza valida.

### 8 · Dialoghi e carriera 🟡
- Etichetta del giocatore: solo incarichi in corso; «già …» solo per un incarico davvero ricoperto; altrimenti il ruolo nel partito («Iscritto/a»), «Candidato» in campagna.
- Contestazioni: parla ed è evidenziato un contestatore, con una frase sul motivo documentato e sulla responsabilità reale del giocatore (Governo, amministrazione, eletto, nessun incarico): a chi non ha incarichi non si dice «amministrate voi».
- Le varianti delle scene erano già legate ai ruoli reali (`head`/`opposition`); audit dei dialoghi (`check-dialogue-audit`) verde.
- 🟡 Non fatto in questo ciclo: nuove battute per ogni tema (economia, lavoro, salari…) oltre a quelle dei cicli precedenti.

### 10 · Attività ed eventi 🟢
Nuove attività: **Giornata di volontariato** (per tutti, una volta a settimana), **Diretta con le domande dei cittadini** (notorietà ≥ 10, rischio di gaffe), **Studio del bilancio con gli uffici** (solo con un seggio o un incarico). Nuovi eventi: **Un profilo falso a tuo nome**, **Un tuo fuori onda circola online**, **Un patrocinio che divide** (tre scelte, sviluppi successivi). Pacing delle richieste interne del partito. Test `check-weekly-variety` (12 carriere × 40 settimane, più seed, comunale/regionale/deputato/iscritto): nessun evento ripetuto in due settimane consecutive, al massimo 3 eventi di fila della stessa categoria, 19–26 questioni importanti per carriera, i tre nuovi eventi compaiono.

### 4, 7 · Data, pulsanti, oro 🟢
Data della topbar di nuovo con il suo carattere; niente sottolineature sui pulsanti (i veri link restano); oro classico (`--gold`, `--accent`) per il wizard e per «Entra in Aula»; stile «Nuova partita» per sei azioni importanti (Inizia la campagna, Conferma il voto, Presenta la legge, Presenta la manovra, Candidati al Quirinale, Presenta la richiesta di referendum). Test: `check-button-palette`, `check-button-contrast`, `check-button-response`.

### 3, 11, 12 · Schermate 🟢
- Wizard: percorso del territorio scelto (regione › provincia › comune), selezioni evidenti in oro; carriera divisa in **Cariche elettive** e **Percorsi e scenari speciali**, schede compatte su telefono (altezza dell’elenco da ~1.260 px a ~530 px a 390 px).
- Popup notizie: notizia principale in evidenza (la «breaking» quando c’è), fonte e categoria distinte, azioni insieme, opzione per disattivarlo invariata, dentro la safe area.
- Referendum: due toni della palette (abrogativo terracotta, costituzionale salvia), fasi come percorso numerato, intestazioni e confronto più leggibili; motore e regole invariati.

### 16 · Smartphone 🟡
Audit responsive su tutte le sezioni e schede a 320, 360, 375, 390, **412** (aggiunta), 430 px, tablet e desktop (`check-responsive`); wizard a 320–412; schermate in `docs/qa/screenshots/final/`. ⚫ Non verificati su dispositivo: Android WebView reale, iOS Safari/WebView, fotocamera, tastiera reale, selettore di file nativo.

## Ciclo precedente (non rendicontato): scioglimento delle fusioni e video da 1.000 €
- **Scioglimento delle fusioni 🟢** — `docs/qa/scioglimento-fusioni.md`. Snapshot per le fusioni nuove, ricostruzione con lacune dichiarate per i vecchi salvataggi, anteprima con ✓/✗, nessuna duplicazione. Test `check-merger-dissolution`, `check-merger-dissolution-browser`.
- **Video da 1.000 € 🟡/⚫** — `docs/qa/appodeal-placement-fondi.md`. Codice e test completi (`check-funds-ad`); **il placement `personal_funds_1000` va configurato nella Dashboard Appodeal (amount 1000, currency «Fondi personali»)**; finché non lo è il video non viene mostrato. **Il Worker con la route dei fondi è pubblicato solo su TEST**: in produzione la registrazione dei video dei fondi finirebbe nella tabella dei video sondaggi (limite 30/giorno). Va pubblicato in produzione dal titolare prima di configurare il placement. Bonus sondaggi 0,15 invariato (verificato). Non provato su un telefono.

## Bundle iniziale
`check-load`: **167 moduli, 1268,7 KiB compressi**, dentro il budget del test (170 moduli, 1270 KiB), soglie non modificate. Il limite di 1264 KiB del ciclo precedente è superato di circa 4,7 KiB: le funzionalità di questo ciclo (modalità di avanzamento, «Altri», iscritto, scene, eventi) sono nel codice di avvio.

## Versione
AAB **1.0.6 (7)**, come la build precedente: il premio di benvenuto è legato esattamente a 1.0.6 (7). ⚫ Se la versionCode 7 è già in Play Console, Google rifiuterà questa AAB: serve una 1.0.7 (8) e il titolare deve decidere a quale versione legare il premio di benvenuto.

## Regressione finale
`check:all` completo, **335 comandi**: prima esecuzione 324 superati, 11 falliti. Correzioni (nessuna asserzione o soglia cambiata, salvo `check-funds-ad` aggiornato al nuovo posto del titolo della scheda):
- `check-ui`: `requestAnimationFrame` usato senza ripiego fuori dal browser → ripiego su `setTimeout`.
- `check-campaign-ui`: un secondo listener `change` aggiunto per la memoria del modulo di fondazione → unito al listener esistente.
- `check-i18n`: dieci coppie nuove con segnaposto misti `{}`/`#` → posizioni numerate; coppia del tooltip «problema aperto».
- `check:i18n-wizard`, `check-i18n-audit`: la classe CSS «chevron» dentro un template italiano veniva letta come parola italiana → classe rinominata `pl-found-toggle`.
- `check-activity-audit`: le tre attività nuove non avevano la scena animata → contesti aggiunti in `activity-scene-context.js`.
- `check-responsive`: il nuovo stile «Nuova partita» tagliava «Presenta la legge · 1 giorno» a 320 px → altezza automatica e testo a capo sotto 480 px.
- `check-long-run`, `check-calendar-years`: non bloccati, interrotti dal limite di 25 minuti per test messo da me → rieseguiti senza limite: superati (2.364 s e 1.559 s).

Riesecuzione dei 13 test coinvolti, uno alla volta: **13/13 superati**. Dopo la ricostruzione: `check-load`, `check-android`, `check:publication`, `check:security`, `check:test-access` superati.

⚫ **`check-campaign-start` resta fallito** (deterministico, una cella): comunale, partito debole (0,3 %), giocatore noto, 4 candidati → partenza del giocatore 25,85 % contro una media dei rivali di 24,72 %; il test chiede al massimo il 90 % della media. Il motore non ha un tetto esplicito per questa cella; gli eventi nuovi cambiano l’evoluzione del mondo simulato e il campo risulta più piccolo. Farlo passare vorrebbe dire cambiare il modello di partenza della campagna, cioè le regole elettorali: lasciato al titolare.

## Build
AAB `android/app/build/outputs/bundle/release/app-release.aab`, 1.0.6 (7), 19.631.641 byte, SHA-256 `ce0b83d8a32541f4f8f4f2ec39239e29af472c527289dfdd15aeac76934fd952`, firmata con la chiave di caricamento («Politicando 2026»), classi Appodeal presenti. Non caricata sugli store. Timbro web `20261125-1`. Worker pubblicato solo sull’ambiente TEST; produzione invariata.
