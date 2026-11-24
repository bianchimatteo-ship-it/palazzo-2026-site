# Aggiornamento generale — rapporto finale (23/11/2026)

Branch `feature/inmobi-integrazione`, partenza da `fedd4b30`. Nessun commit, push, merge, deploy o pubblicazione in questa fase. Stash e file non tracciati conservati.

Legenda: 🟢 completata e verificata · 🟡 parziale o non verificata del tutto · 🔴 non completata.

## Cause trovate (le più importanti)
| Problema | Causa |
|---|---|
| «Lo staff segue la linea» e 2/4 settimane | I test headless usavano un *elettore di prova* che chiudeva ogni voto e nascondeva il problema; nella UI reale la delega passava solo con un flag che il pulsante Avanza non passava. Ora il pulsante legge l'impostazione; provato in Chrome **senza** elettore di prova, con le impostazioni cambiate dalla schermata Impostazioni (`check-staff-weeks-ui`). |
| Pulsante «Lascia il partito» introvabile | Stava solo nella scheda secondaria «Ruoli e correnti». Ora è nella Panoramica del Partito (riquadro «Appartenenza», con «Cambia partito» e le conseguenze lette dal motore). |
| Telecamera delle scene sul personaggio sbagliato | `activityStage` usava sempre `left`/`right` fissi; ospite 1 e 2 stanno in punti diversi in ogni stanza. Ora l'inquadratura segue la posa reale di chi parla o reagisce (`at:x:y:scala`). |
| Animazioni attive con «Disattivate» | Le entrate delle battute e l'ambiente delle stanze erano protetti solo da `prefers-reduced-motion`, non dall'impostazione del gioco. |
| Raccolta firme referendaria «orfana» | Aperta dalla pagina Iniziative, dopo il deposito non aveva una legge né una procedura. Ora si collega a una legge in vigore dalla pagina Referendum e prosegue (Cassazione → Corte → campagna → voto). |
| «Chiedi al gioco» risponde fuori tema | Corrispondenza su prefissi di 5 lettere e fino a tre risposte anche con una sola parola in comune. Riscritto: radici forti/deboli, frasi, soglia minima, una risposta (due solo se ambigua), «intendevi…?» e «non lo so». |
| Pubblicità iOS | `providerFor('ios')` tornava `inmobi` e la configurazione remota poteva accendere i formati. Ora `IOS_ADS_ENABLED=false`: tutto spento, nessuna richiesta, nessuna scheda «Video premiati». |
| `plugins/` pubblicabile come asset | Mancava in `.assetsignore` (sorgenti nativi tra gli asset del sito di test). Corretto. |
| Coalizioni registrate che perdono un membro | Il risultato filtrava i membri non misurati dai sondaggi. Ora conserva i membri registrati al deposito (`check-alliance-exit`). |

## Matrice per richiesta
| # | Richiesta | Stato | File principali | Test | Note |
|---|---|---|---|---|---|
| 1.1 | Staff segue la linea del gruppo | 🟢 | `store.js`, `settings.js`, `app.js` | `check-staff-weeks-ui` (Chrome, impostazioni dalla UI, ricaricamento), `check-staff-votes` | Voti essenziali (fiducia, leggi proprie, bilancio) fermano sempre; il diario dice con quale linea. Più votazioni aperte: coperte da `check-staff-votes`. |
| 1.2 | 2 e 4 settimane | 🟢 | `store.js`, `app.js` | `check-staff-weeks-ui`, `check-advance-turn` | Se si ferma dice quante settimane sono passate e perché. |
| 2.1 | «Candidati ora» / «Prepara una nuova elezione» in cima | 🟢 | `app.js`, `campaign-mode.js` | `check-campaign-goto-ui`, `check-campaign-result-action` | |
| 2.2 | Notte Elettorale tutti i tipi | 🟡 | `night-engine.js` | `check-election-night-engine` (comunale, regionale, politiche, europee, ballottaggio) | **Provinciali non raggiungibili** con una campagna giocata nei test: il motore ha curva e soglie ma non è provato end-to-end. |
| 2.3 | Istituzioni coerenti dopo il voto | 🟡 | `office-engine.js`, `legislature-engine.js` | `check-night-player-party`, `check-candidacy-*` | Non rifatta una verifica completa per ruolo. |
| 2.4 | Carriera senza incarico | 🟢 | `career-wizard.js`, `career-page.js` | `check-resignations`, `check-wizard-*` | |
| 3.1–3.2 | Lasciare/cambiare partito | 🟢 | `party-page.js`, `store.js` (`leavePartyPreview`), `app.js` | `check-party-leave-ui` (uscita, annulla, indipendenza, nuova adesione, ricaricamento) | |
| 3.3 | Candidature indipendente / lista civica / movimento / gruppo misto | 🔴 | — | — | Non implementato: richiede requisiti per tipo di elezione (firme, comitato, fondi) e modifiche al motore di campagna. |
| 4 | Alleanze: UI e meccaniche | 🟢 | `polls-mode.js`, `polls.css` | `check-alliance-ui`, `-exit`, `-exit-browser`, `-rules`, `check-coalition-invites` | Scheda di sintesi (partiti, peso, coesione, guida), azioni in colonna, sezioni chiuse. `check-alliance-exit` corretto alla radice. |
| 5.1 | Telecamera | 🟢 | `activity-scenes.js`, `stage-art.js` | `check-scene-camera` (55 inquadrature + 55 reazioni) | |
| 5.2 | Varietà visiva | 🟡 | `activity-scenes.js`, `scene.css` | `check-activity-variety`, `check-scene-motion` | Disposizione (scambio ospiti, distanza) e luce (giorno/sera/piena) variano per scena. **Non** sono state create nuove stanze, gesti o scenografie. |
| 5.3 | Dialoghi/anti-ripetizione | 🟡 | — | `check-activity-repetition` | Sistema esistente verificato; nessun nuovo motore di dialoghi. |
| 5.4 | Interfaccia delle scelte | 🟡 | — | `check-stage-ui` | Corretto il rispetto di «Animazioni disattivate/ridotte». |
| 6 | Leggi in vigore | 🟢 | `parliament-mode.js`, `lawmaking-engine.js` | `check-statutes`, `check-parliament-page`, `check-laws` | Una scheda chiusa per legge; dettagli, «Cosa cambierebbe», costo e azioni dentro; pulsanti con stessa tipografia e altezza. Non verificata una prova visiva in Chrome dei pulsanti aperti. |
| 7 | Iniziative e referendum | 🟡 | `store.js` (`linkReferendumCollection`), `referendum-mode.js`, `initiative-mode.js` | `check-referendum-link`, `check-referendum*`, `check-initiatives*` | Ciclo collegato e persistente. **Non** ho riverificato le procedure sulle fonti ufficiali (art. 71, 75, 132, 138; L. 352/1970) in questa sessione: il rinvio è ai test e alle regole già nel motore. |
| 8 | Chiedi al gioco / tutorial | 🟢 | `ask-game.js`, `menu.js` | `check-ask-game` (73 domande IT/EN, fuori tema/vaghe/ambigue; Chrome IT e EN), `check-tutorial*`, `check-guide` | Tutorial invariato nei contenuti (saltabile e riprendibile già verificato). |
| 9 | Promesse e programma | 🟡 | `program-engine.js`, `app.js` | `check-promise-feasibility`, `check-promise-reminders` (incl. «Apri il programma» → scheda Programma) | Modello di potere e strumenti verificati; **agenda con ostacoli e prossima azione non completata**. |
| 10 | Identità grafica globale | 🟡 | `theme.css`, vari | `check-button-palette`, `check-button-contrast`, `check-ui-sections` | Livello di design unico per i pulsanti (oro / verde petrolio / rosso / testuale) e font coerente. Non è un redesign di ogni schermata. |
| 11 | Avatar | 🟡 | `theme.css` | `check-avatar`, `check-avatar-gender` | Anteprima grande in sticky. Foto→avatar: solo valutazione (`docs/valutazioni-aggiornamento.md`), non implementata. |
| 12.1 | Prestazioni | 🔴 | — | `check-button-response` | Nessun miglioramento misurato del ridisegno completo della pagina (limite noto in `docs/qa/reattivita.md`). |
| 12.2 | Dispositivi | 🟡 | — | Chrome 320–1280 px (`check-responsive` 740 schermate), simulatori iOS | iPhone 17 (Dynamic Island) e iPhone 17e provati con WKWebView reale e tocchi; iPhone Air/18 Pro/18 Pro Max solo schermata d'avvio. **Non provati**: iPad, Xiaomi/Android reale (nessun dispositivo collegato), Safari, App Store macOS. |
| 13.1 | Appodeal Android | 🟢 | `AppodealAdsPlugin.kt`, `build.gradle`, `ads-manager.js` | `check-appodeal`, `check-appodeal-safety`; AAB con Appodeal 4.4.0 + AppLovin 13.6.3.0 + Unity 4.17.0.0 + IAB 1.8.1.1 | Debug sempre test (nativo); Release solo con configurazione autorizzata e coerente. |
| 13.2 | Avvisi Appodeal | 🟡 | `docs/appodeal.md` | — | `bidmachine adapter not registered`: atteso (BidMachine non incluso). `Required value was null`: **causa non confermata** (ipotesi SDK), serve `adb logcat` da dispositivo. |
| 13.3 | iOS senza pubblicità | 🟢 | `ads-config.js`, `app.js`, `rewards-page.js`, IPA | `check-inmobi`, `check-inmobi-native`, `check-appodeal`, `check-ads-states`, `check-rewards-page`; IPA senza framework pubblicitari | Docs aggiornate. |
| 14 | Regressione | 🟡 | tutto | 308 controlli di `check:all`: vedi sotto | |
| 15 | Traduzioni | 🟢 | `release-pairs.js`, `ask-game.js` | `check-i18n`, `-release`, `-pages`, `-audit`, `-offline`, `-auto` | `check-i18n-release` ora verde (causa: frasi dinamiche delle scene non nel dizionario). |
| 17 | Build Android/iOS | 🟢 | — | AAB, xcarchive, IPA | Percorsi sotto. Non caricati su nessuno store. |
| M9 | Popup recensione iOS | 🟢 | `review-prompt.js`, `review-card.js` | `check-review-prompt` | Link App Store dato dall'utente; una sola volta per installazione. Non provato l'apertura reale dell'App Store (simulatore senza App Store). |
| M8 | Dashboard admin | 🟡 | — | `check-admin-stats` | Come in checklist: bloccata da credenziali store e decisioni legali (`decisioni-titolare-legali.md`). |
| M10 | «Candidati ora» crash segnalato | 🟡 | — | `check-candidacy-vice-councillor` | Non riprodotto senza il salvataggio dell'utente: non dichiarato risolto. |
| M11 | «Caricamento…» | 🟡 | — | `check-boot-failure`, `check-start-screen` | Non riprodotto; recupero con «Riprova» già presente. |
| M12 | Programmi dei partiti | 🟢 | — | `check-party-programs`, `check-pci-program-ui` | Progetto Civico Italia: nove temi documentati, uno «non rilevato». |

## Regressione (`check:all`, 308 controlli distinti)
Eseguiti in 3 processi paralleli. 299 verdi al primo giro; i 9 rossi sono stati ripresi uno a uno:
- corretti e verdi: `check-assets` (`plugins/` e `ADS_CONFIG`), `check-pacts-table` (il test misurava l'altezza del pulsante anziché le righe di testo: ora conta le righe), `check-i18n-audit` (frase «Nessun provvedimento su …, «…»»), `check-staff-weeks-ui` (attese fisse → attesa di stabilità);
- verdi da soli, rossi solo sotto carico di 3 processi: `check-floor-ui`, `check-wizard-party-layout`;
- **ancora rossi, tutti già rossi prima dell'aggiornamento**: `check-load` (moduli all'avvio 177 contro il limite 170; prima 171), `check-long-run` e `check-poll-election-consistency` (vedi «Problemi aperti»). Nessuna regressione attribuibile a questo lavoro è rimasta aperta nei 308 controlli.

## Problemi aperti
1. `check-load`: 177 moduli (budget 170). Già 171 prima dell'aggiornamento. Non ho alzato il limite: serve caricare in modo pigro alcuni moduli (assistente, catalogo argomenti) o decidere un nuovo budget.
2. `check-long-run` (30 anni, 7 carriere): 3 violazioni di coerenza «somma dei voti di lista ≠ voti sulla scala» (comunale a ~16,5 anni, senatore a ~28 anni). **Già presente prima**: stessa carriera (`beta`, comunale) fatta girare 17 anni sulla versione precedente all'aggiornamento (`/tmp/headcopy`) e su quella attuale → identico errore sulla stessa campagna e sulla stessa settimana (858). Ipotesi, NON verificata: conteggio «normalizzato» (`electorate.js` `countProblems`) che non ammette il resto delle liste non mostrate di una gara con `withVotes(..., {others:false})`; non corretta qui perché richiede di toccare il conteggio elettorale.
3. `check-poll-election-consistency`: 3 scarti sondaggio/proiezione oltre il margine nelle europee (scenario 3, partito `party-registro-p1-2014-04-ir`). **Già presente prima**: stessi tre scarti, stessi valori, sulla versione precedente.
4. Prestazioni, candidature indipendenti, agenda delle promesse, Notte elettorale provinciale: non completati (matrice).
5. Android: nessuna prova su dispositivo (Xiaomi non collegato): banner, WindowInsets e cooldown 120 s/60 s verificati solo con test automatici e fake plugin.

## Build (non pubblicate)
| Artefatto | Percorso | Versione / identità |
|---|---|---|
| AAB Android firmata | `android/app/build/outputs/bundle/release/app-release.aab` (SHA-256 `dd635ca4…`) | `it.matteobianchi.politicando2026`, versionCode 6, versionName 1.0.5; `jarsigner`: jar verified; certificato SHA-256 `BC:E5:36:B3…A9:91:02`, valido fino al 13/03/2054; Appodeal 4.4.0 + AppLovin 13.6.3.0 + Unity 4.17.0.0 + IAB 1.8.1.1, nessun AdMob/Meta/BidMachine/InMobi |
| xcarchive iOS | `ios/build-release/Politicando2026.xcarchive` | `it.politicando2026.app`, 1.0.1 (2), iOS 15.0+, iPhone portrait / iPad tutte |
| IPA iOS | `ios/build-release/export/App.ipa` (SHA-256 `4d1e08a1…`) | firmata «Apple Distribution: RAMONA BIANCHI (29HKABRSNK)», profilo «Politicando 2026 App Store»; `codesign --verify` valida; solo Capacitor e Cordova come framework; nessuna stringa Appodeal/InMobi/AdMob nel binario |

**Versioni non cambiate**: versionCode 6 / 1.0.5 e 1.0.1 (2) sono quelle del repository. Se uno dei due è già stato caricato su Play / App Store Connect va incrementato prima dell'invio (è una riga: `android/app/build.gradle`, `CURRENT_PROJECT_VERSION` in `project.pbxproj`).

## Dispositivi realmente provati
Chrome headless 320–1280 px (audit responsive di 740 schermate: tutto verde tranne il titolo del topbar a 1024 px, corretto dopo averlo trovato); simulatori iOS 27.2 con WKWebView reale: iPhone 17 (menu, primo avvio, guida con «Chiedi al gioco») e iPhone 17e (selezione lingua). Nessun dispositivo Android, iPad o Safari.

## Seguito: aggiornamento ufficiale del 24/11/2026

I problemi aperti qui sopra ripresi nell’ultima fase (candidature indipendenti, programmi, agenda, provinciali, prestazioni) e le nuove richieste sono nella matrice di [`aggiornamento-ufficiale-2026-11-24.md`](aggiornamento-ufficiale-2026-11-24.md).
