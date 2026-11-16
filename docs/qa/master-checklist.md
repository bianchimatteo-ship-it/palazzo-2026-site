# Master checklist — completamento Politicando 2026

Stati ammessi: **Non iniziato · In lavorazione · Completato · Bloccato**. Una voce è *Completato* solo con prova (file, test, screenshot). Branch `feature/qa-completamento`. Confrontata punto per punto con il documento di lavoro originale (sezioni 1–21) e con le aggiunte del 16/11 (sezione 22).

Riepilogo: Bloccato 3 · Completato 108 · In lavorazione 21 · Non iniziato 37 · totale 169


## 1. Regole operative

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 1.1 | Prima di modificare: controllare git status, branch, HEAD, modifiche locali | Completato |  | git status/branch/HEAD controllati a inizio di ogni lavoro |  |
| 1.2 | Verificare le modifiche successive nel branch feature/ios-admob-android | Completato |  | git fetch + ff-merge di origin/feature/ios-admob-android (18 commit del 15-16/11) | branch feature/qa-completamento da 9eb2ca8 |
| 1.3 | Non sovrascrivere/perdere lavoro; non toccare main; nessun merge, deploy, pubblicazione | In lavorazione |  |  | nessun merge/deploy/modifica a main finora; regola valida fino alla fine |
| 1.4 | Non duplicare sistemi esistenti: migliorarli | Non iniziato |  |  |  |
| 1.5 | Non inventare dati, risultati elettorali, fonti, autorizzazioni, esiti dei test | Non iniziato |  |  |  |
| 1.6 | Implementare davvero (non solo analisi/piano); lavorare per aree, priorità ai bug bloccanti | Non iniziato |  |  |  |
| 1.7 | Test mirati durante il lavoro e regressione complessiva alla fine | Non iniziato |  |  |  |
| 1.8 | Funzioni realmente utilizzabili (non solo una schermata) | Non iniziato |  |  |  |
| 1.9 | Nessuna modalità per impersonare politici reali | Non iniziato |  |  |  |
| 1.10 | Creare e aggiornare docs/qa/master-checklist.md con stato, file, test, screenshot | Completato | docs/qa/master-checklist.md | confronto con il documento originale (sez. 1-21) e con le aggiunte del 16/11 (sez. 22) |  |

## 2. Bug prioritari: candidature ed elezioni

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 2.1 | Riprodurre lo scenario vicesegretario + consigliere comunale + candidatura Politiche + «Candidati ora» | Completato | scripts/check-candidacy-vice-councillor.mjs | check-candidacy-vice-councillor (ranghi 3, 4, 5; /tmp repro Chrome) | Scenario riprodotto con partita di test: la candidatura parte e non c’è errore; il blocco segnalato non si riproduce. Diagnostica attiva per futuri casi |
| 2.2 | Correggere l'impedimento ingiustificato alla candidatura | In lavorazione | scripts/check-candidacy-vice-councillor.mjs | check-candidacy-vice-councillor | Il blocco segnalato non si riproduce con vicesegretario + consigliere comunale (ranghi 3, 4, 5: la candidatura parte). Serve il salvataggio dell’utente per confermare |
| 2.3 | Correggere il blocco/crash dopo «Candidati ora» | In lavorazione | scripts/check-candidacy-vice-councillor.mjs, src/core/diagnostics.js | check-candidacy-vice-councillor, check-button-response | Nessun blocco o crash dopo «Candidati ora» nei test; registro diagnostico attivo per il caso reale |
| 2.4 | Spiegare sempre i requisiti non soddisfatti; mai un pulsante che si blocca senza spiegazione | Completato | src/core/office-engine.js (candidacyBlock) | check-candidacy-vice-councillor, check-candidacy-access, check-calendar-years | Ogni rifiuto è una frase leggibile (test: >25 caratteri, nessuna campagna a metà) |
| 2.5 | Vicesegretario e consigliere comunale non automaticamente incompatibili; rinuncia gestibile se prevista | Completato | src/core/office-engine.js | check-candidacy-vice-councillor | Vicesegretario e consigliere comunale non sono incompatibili: la campagna alle politiche parte |
| 2.6 | Verificare regole, calendario, candidature già aperte, stato della carriera | Completato | src/core/office-engine.js | check-calendar-years, check-candidacy-access, check-race-candidacy-lifecycle, check-candidacy-vice-councillor | Regole, calendario, candidature aperte e stato della carriera verificati da test esistenti e nuovi |
| 2.7 | Campagna senza candidatura: partecipazione chiusa, stato di campagna chiuso, uscita dalla modalità campagna, ritorno alla carriera, nessuno stato residuo | Completato | src/core/career-engine.js, scripts/check-campaign-excluded.mjs | check-campaign-excluded | Escluso dal partito: campagna chiusa con esito «escluso» spiegato, nessuna notte né richiesta pendente, carriera attiva, nuova elezione preparabile, avanzamento libero. Trovato e corretto un crash (domanda sulle correnti di un partito già lasciato) |
| 2.8 | Notte elettorale: popup iniziale non copre tutto lo schermo; dimensioni, posizione, leggibilità su smartphone e tablet | Completato | src/night.css, scripts/check-election-night-ui.mjs | check-election-night-ui (390×844 e 320×640) | Causa: la regola generale del toast (bottom !important) si sommava a top:12px della notte e allungava l’avviso «Hai votato: ora la serata elettorale» da cima a fondo (245×761 px su 390×844). Ora è una scheda piccola. Prima: artifacts/qa/screenshots/before/notte-elettorale-390x844.png · dopo: artifacts/qa/screenshots/after/notte-elettorale-390x844.png (+820x1180) |
| 2.9 | Notte elettorale: partito del giocatore non mostrato come «Altri» | Completato | scripts/check-night-player-party.mjs | check-night-player-party | La lista del giocatore (partito esistente e partito fondato) ha sempre il suo nome e non è mai in «Altri»; il caso segnalato non si riproduce |
| 2.10 | Collegamenti giocatore/candidato/partito/coalizione; voti, percentuali, attribuzione seggi | Completato | src/core/night-engine.js, src/core/legislature-engine.js | check-night-player-party, check-election-counts, check-seat-allocation, check-election-night-engine | Lista del giocatore con nome proprio; voti, percentuali e seggi coerenti |
| 2.11 | Candidato al 6% con partito senza rappresentanza non eletto: collegio, soglie, seggi, posizione in lista; nessun seggio artificiale; spiegazione chiara | Completato | scripts/check-night-player-party.mjs | check-night-player-party | Sotto soglia: nessun seggio, nessun mandato, soglia spiegata nell’esito (partito fondato: 2 notti su 2) |
| 2.12 | Diagnostica per individuare la causa di blocchi (registro errori dei pulsanti) | Completato | src/core/diagnostics.js, src/ui/app.js, src/ui/menu.js | scripts/check-button-response.mjs | Registro errori e controlli copiabili dal menu |

## 3. Velocità e reattività dei pulsanti

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 3.1 | Individuare le cause dei ritardi (thread principale, API/database, timer artificiali, render eccessivi, stato, handler, caricamenti, richieste duplicate) | Completato | docs/qa/reattivita.md, src/core/time.js, src/ui/charts.js, src/ui/polls-mode.js, src/ui/policy-mode.js, src/ui/sections-kit.js | check-button-response | Cause misurate e documentate; il ridisegno dell’intera pagina resta il limite per Home e Istituzioni (non risolto) |
| 3.2 | Feedback visivo immediato alla pressione | Completato | src/theme.css | check-button-response | Stato premuto immediato, nessun ritardo del doppio tocco |
| 3.3 | Avvio tempestivo dell'azione; indicatori di caricamento solo se necessari | Completato | src/ui/app.js | check-button-response | Le azioni partono al tocco; indicatore di caricamento solo nelle pagine caricate in ritardo |
| 3.4 | Prevenzione doppi clic/doppie operazioni | Completato | src/ui/app.js (SINGLE_TAP) | check-button-response | Doppio tocco su «Chiudi settimana» = una settimana |
| 3.5 | Aggiornamento UI corretto dopo la risposta del server; niente aggiornamenti ottimistici non confermati | Completato | src/core/store.js, src/ui/app.js | check-button-response | Nessun aggiornamento ottimistico: la pagina si ridisegna dopo l’esito dello store |
| 3.6 | Gestione errori senza interfaccia bloccata | Completato | src/core/diagnostics.js, src/ui/app.js, src/ui/menu.js | check-button-response | Errore non gestito → registro diagnostico, avviso, interfaccia non bloccata |
| 3.7 | Misura dei tempi di risposta nelle principali schermate (prima/dopo) | Completato | docs/qa/reattivita.md | /tmp/qa/perf.mjs (misura documentata nel file) | Tabella prima/dopo |
| 3.8 | Non eliminare controlli di sicurezza o attese di sincronizzazione necessarie | Completato |  | check-save-resilience, check-saves | Nessun controllo di sicurezza o attesa di sincronizzazione rimosso |

## 4. Avanzamento del tempo e simulazione automatica

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 4.1 | Correggere l'impostazione 2/4 settimane che avanza una sola settimana | Completato | src/core/store.js (advanceTurn), src/ui/app.js | check-advance-turn + prova in Chrome | cause: ciclo che si fermava senza dirlo; app senza argomenti → impostazioni dell'ospite invece dell'account |
| 4.2 | Mostrare sempre il motivo di ogni interruzione e le settimane realmente trascorse | Completato | src/core/store.js, src/ui/menu.js, src/theme.css, src/data/release-pairs.js | check-advance-turn, check-i18n | before/after/avanzamento-4-settimane-390x844.png |
| 4.3 | Simulare fino a una data specifica o alle prossime elezioni | Completato | src/core/store.js (advanceToDate, fastForwardToElection) | check-advance, check-advance-turn | Avanza fino a una data o all’apertura delle candidature, fermandosi per decisioni e voti |
| 4.4 | Simulare le votazioni delegandole allo staff | Completato | src/core/store.js, src/core/settings.js, src/ui/menu.js | check-staff-votes | Impostazione «Votazioni delegate allo staff»: linea del gruppo o astensione, voti scritti nel diario; fiducia, leggi proprie e bilancio fermano sempre |
| 4.5 | Indicazioni politiche allo staff per non perdere consenso | Completato | src/core/settings.js, src/core/store.js | check-staff-votes | Indicazione allo staff: segui la linea del gruppo (non perdere consenso) o astieniti |
| 4.6 | Proseguire durante eventi ordinari e votazioni non essenziali; stop solo per decisioni importanti | Completato | src/core/store.js | check-advance-turn, check-staff-votes | Gli eventi ordinari non fermano; si ferma per decisioni urgenti, campagne e voti essenziali, dicendo perché |
| 4.7 | Coerenza di calendario, eventi, campagne, elezioni, crisi, salvataggi | Completato |  | check-calendar, check-calendar-years, check-calendar-same-day, check-calendar-gap, check-choice-fuzz, check-saves | Calendario, eventi, campagne, elezioni, crisi e salvataggi: test esistenti più il fuzz delle scelte casuali (600 settimane senza errori) |

## 5. Parlamento, consigli e disciplina

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 5.1 | Votazioni nominative: nome e cognome, favorevole/contrario/astenuto/assente | Completato | src/core/vote-engine.js, src/core/parliament-engine.js, src/core/lawmaking-engine.js, src/ui/parliament-mode.js, src/ui/aula-view.js | scripts/check-vote-absences.mjs, check-parliament-votes.mjs | Ogni seggio ha un voto (favorevole/contrario/astenuto/assente) legato al nome del parlamentare dell’emiciclo (hemicycle-view) |
| 5.2 | Aumentare realisticamente astensioni e assenze | Completato | src/core/vote-engine.js, src/core/parliament-engine.js, src/core/lawmaking-engine.js, src/ui/parliament-mode.js, src/ui/aula-view.js | scripts/check-vote-absences.mjs | Assenze medie 9,6% nei voti ordinari (forbice 4-14%), fiducia ≤3%; astensioni già presenti (splitGroupVote). Prima le assenze erano sempre 0 |
| 5.3 | Scrutini segreti: solo risultati aggregati | Completato | src/core/vote-engine.js | scripts/check-vote-absences.mjs | Voto segreto: solo totali, nessun voto individuale |
| 5.4 | Totali coerenti con i componenti dell'assemblea | Completato | src/core/vote-engine.js, src/core/parliament-engine.js, src/core/lawmaking-engine.js, src/ui/parliament-mode.js, src/ui/aula-view.js | scripts/check-vote-absences.mjs, check-invariants | Favorevoli+contrari+astenuti+assenti = seggi; maggioranza contata sui presenti |
| 5.5 | Disciplina dei gruppi (grande maggioranza segue l'indicazione) con dissensi e assenze non al 100% | Completato | src/core/vote-engine.js, src/core/parliament-engine.js, src/core/lawmaking-engine.js, src/ui/parliament-mode.js, src/ui/aula-view.js | scripts/check-vote-absences.mjs | La maggioranza segue la linea del gruppo con dissensi medi <30% e assenze; mai 100% |
| 5.6 | Indicazioni del giocatore agli altri parlamentari/consiglieri | Completato | src/core/parliament-engine.js (direttiva del capogruppo), src/core/local-engine.js (group-pull), src/data/simulation/office-rules.js | check-parliament-votes, check-group-directive-ui, check-local | Parlamento: indicazioni del capogruppo con adesioni parziali; consigli: il capogruppo orienta il gruppo con il suo voto (costo in coesione) |
| 5.7 | 60% del capitale politico alla campagna, calcolo mostrato, nessuna duplicazione, capitale e fondi separati | Completato | src/core/store.js, src/ui/campaign-mode.js, src/data/release-pairs.js | check-campaign-capital + regressione campagna | before/after/capitale-campagna-390x844.png |

## 6. Iniziative popolari e richieste dei cittadini

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 6.1 | Iniziativa legislativa popolare: anche piccoli partiti senza parlamentari | Completato | src/core/initiative-engine.js, src/core/store.js, src/ui/initiative-mode.js, src/ui/app.js, src/ui/lazy-views.js, src/theme.css, src/data/release-pairs.js | scripts/check-initiatives.mjs, scripts/check-initiatives-ui.mjs | Basta una carriera qualsiasi (provato con un consigliere comunale, senza parlamentari). artifacts/qa/screenshots/after/iniziative-it-390x844.png, iniziative-it-820x1180.png, iniziative-en-390x844.png |
| 6.2 | Proposta in articoli; organizzazione raccolta; raccolta nazionale e territoriale | Completato | src/core/initiative-engine.js, src/core/store.js, src/ui/initiative-mode.js, src/ui/app.js, src/ui/lazy-views.js, src/theme.css, src/data/release-pairs.js | scripts/check-initiatives.mjs, scripts/check-initiatives-ui.mjs | Testo in 1-8 articoli; leve: banchetti, piattaforma online, volontari, comuni amici, campagna di sensibilizzazione; firme nazionali e per Regione e per canale |
| 6.3 | Costi e risorse; avanzamento firme; sostegno dei cittadini; opposizioni e campagne | Completato | src/core/initiative-engine.js, src/core/store.js, src/ui/initiative-mode.js, src/ui/app.js, src/ui/lazy-views.js, src/theme.css, src/data/release-pairs.js | scripts/check-initiatives.mjs, scripts/check-initiatives-ui.mjs | Costo di apertura 400 €, leve con costo iniziale e settimanale dai fondi, avanzamento, ritmo e previsione; sostegno dei cittadini (peso del partito, notorietà, quanto il tema è sentito), campagne contrarie e sostegni di associazioni |
| 6.4 | Fallimento o raggiungimento dei requisiti (50.000 firme); passaggio alla fase parlamentare | Completato | src/core/initiative-engine.js, src/core/store.js, src/ui/initiative-mode.js, src/ui/app.js, src/ui/lazy-views.js, src/theme.css, src/data/release-pairs.js | scripts/check-initiatives.mjs, scripts/check-initiatives-ui.mjs | Soglia 50.000; deposito rifiutato sotto soglia; verifica con quota di firme valide 88-97% (serve un margine); passaggio al Parlamento (fase simulata: assegnazione, commissione, Aula, approvata/archiviata) con effetti sulla carriera |
| 6.5 | Distinguere iniziativa popolare, proposta parlamentare, raccolta firme referendaria | Completato | src/core/initiative-engine.js, src/core/store.js, src/ui/initiative-mode.js, src/ui/app.js, src/ui/lazy-views.js, src/theme.css, src/data/release-pairs.js | scripts/check-initiatives.mjs, scripts/check-initiatives-ui.mjs | Tre strade distinte nella pagina: iniziativa popolare, raccolta firme referendaria (500.000; la fase dopo il deposito dichiarata non simulata), proposta parlamentare (pagina Leggi) |
| 6.6 | Richieste di cittadini/associazioni: azioni disponibili, competenze, tempi, costi, conseguenze | Completato | src/core/citizen-requests-engine.js, src/core/store.js, src/ui/initiative-mode.js, src/ui/app.js, src/data/release-pairs.js | scripts/check-citizen-requests.mjs, scripts/check-initiatives-ui.mjs | Richieste di cittadini e associazioni su servizi in sofferenza (indicatore reale), azioni per incarico con costo/tempo/chance, esito dopo qualche settimana con conseguenze, scadenza |
| 6.7 | Soddisfare direttamente o avviare interrogazioni, mozioni, segnalazioni, proposte | Completato | src/core/citizen-requests-engine.js, src/core/store.js, src/ui/initiative-mode.js, src/ui/app.js, src/data/release-pairs.js | scripts/check-citizen-requests.mjs | Segnalazione, interrogazione, mozione, promessa nel programma, raccolta firme, intervento diretto (esecutivi), risposta di non competenza |

## 7. Leggi, Governo e crisi del Paese

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 7.1 | Catena approvazione → attuazione → effetti sugli indicatori verificata | Completato | src/core/lawmaking-engine.js, src/core/society-engine.js | check-laws, check-government, check-legislature | Approvazione → attuazione → effetti sugli indicatori |
| 7.2 | Leggi con effetti reali su economia, sanità, lavoro, sicurezza, ambiente, immigrazione, istruzione | Completato | src/core/society-engine.js, src/data/simulation/policy-rules.js | check-government | 34 temi con indicatori, 7 strumenti ciascuno, effetti per territorio e gruppo di cittadini |
| 7.3 | Da Presidente del Consiglio: tematiche in crisi in Home, problemi urgenti | Completato | src/ui/game-mode.js (crisisTopicsBand), src/core/society-engine.js | scripts/check-ministry-ui.mjs | Home del Presidente del Consiglio con i temi in crisi (nazionali e Regioni) e il rinvio al Governo |
| 7.4 | Interventi concreti con costi, tempi, benefici, rischi; collegati agli effetti | Completato | src/core/store.js, src/ui/policy-mode.js | check-premier, check-government | Interventi con costi, tempi, benefici e rischi collegati agli indicatori |

## 8. Consiglio dei ministri e gioco da Ministro

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 8.1 | Sezione Consiglio dei ministri nell'area Governo (interattiva) | Completato | src/core/cabinet-life-engine.js, src/ui/cabinet-life-view.js, src/core/ministry-engine.js, src/ui/ministry-view.js, src/core/store.js, src/ui/parliament-mode.js, src/ui/app.js, src/data/release-pairs.js | check-cabinet-life, check-cabinet-ui, scripts/check-ministry.mjs, scripts/check-ministry-ui.mjs | Consiglio dei ministri interattivo nell’area Governo: ordine del giorno scelto dal PdC, proposte dei ministri, voti |
| 8.2 | Ministro: area ministeriale, dossier, problemi, obiettivi, priorità del dicastero | Completato | src/core/ministry-engine.js, src/ui/ministry-view.js, src/core/store.js, src/ui/parliament-mode.js, src/ui/app.js, src/data/release-pairs.js | scripts/check-ministry.mjs, scripts/check-ministry-ui.mjs | Area ministeriale: aree del dicastero con indicatori, problemi, priorità, dossier dei ministri, crisi di settore |
| 8.3 | Ministro: proporre provvedimenti, preparare proposte normative, sottoporle al Governo | Completato | src/core/ministry-engine.js, src/ui/ministry-view.js, src/core/store.js, src/ui/parliament-mode.js, src/ui/app.js, src/data/release-pairs.js | scripts/check-ministry.mjs, scripts/check-ministry-ui.mjs | Proposte preparate dallo staff, sottoposte al Consiglio; se approvate diventano disegno di legge del governo |
| 8.4 | Ministro: coordinarsi con il Presidente del Consiglio, interloquire con i colleghi, incontri e riunioni, negoziati | Completato | src/core/ministry-engine.js, src/ui/ministry-view.js, src/core/store.js, src/ui/parliament-mode.js, src/ui/app.js, src/data/release-pairs.js | scripts/check-ministry.mjs, scripts/check-ministry-ui.mjs | Incontri con i colleghi (voto più favorevole), rapporto con il Presidente del Consiglio, richieste del PdC con scadenza |
| 8.5 | Ministro: partecipare e votare in Consiglio dei ministri | Completato | src/core/ministry-engine.js, src/ui/ministry-view.js, src/core/store.js, src/ui/parliament-mode.js, src/ui/app.js, src/data/release-pairs.js | scripts/check-ministry.mjs, scripts/check-ministry-ui.mjs | Ogni ministro vota in Consiglio, il PdC conta doppio; voto di ciascuno visibile |
| 8.6 | Ministro: crisi del settore, Parlamento e cittadini, incarichi dal PdC, relazioni sui risultati, rapporti e conflitti | Completato | src/core/ministry-engine.js, src/ui/ministry-view.js, src/core/store.js, src/ui/parliament-mode.js, src/ui/app.js, src/data/release-pairs.js | scripts/check-ministry.mjs, scripts/check-ministry-ui.mjs | Crisi del settore (dichiarazione o fondi d’emergenza), incarichi del PdC (relazioni, piani), conseguenze sul rapporto |
| 8.7 | Conseguenze su consenso, rapporti, efficacia, governo, stabilità | Completato | src/core/ministry-engine.js, src/ui/ministry-view.js, src/core/store.js, src/ui/parliament-mode.js, src/ui/app.js, src/data/release-pairs.js | scripts/check-ministry.mjs, scripts/check-ministry-ui.mjs | Effetti su reputazione, rapporto con il PdC, peso nel governo, stabilità e indicatori (fondi d’emergenza) |
| 8.8 | PdC: convocare, ordine del giorno, priorità, proposte dei ministri, contrasti, relazioni, negoziare, verificare programma | Completato | src/core/cabinet-life-engine.js, src/ui/cabinet-life-view.js, src/core/dossier-engine.js | check-cabinet-life, check-cabinet-ui, check-dossiers, check-ministry | Il PdC convoca il Consiglio con ordine del giorno, decide sui ministri, media nei conflitti, sostiene o sostituisce, verifica il programma |
| 8.9 | Rispetto delle competenze (nessun potere non spettante) | Completato | src/core/ministry-engine.js | check-ministry | Un ministro agisce solo nelle aree del dicastero: fuori competenza è rifiutato dicendo chi è competente |

## 9. Formazione del Governo e consultazioni del Quirinale

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 9.1 | Notizie e comunicazioni della Presidenza: apertura consultazioni, calendario, soggetti, colloqui | Completato | src/core/legislature-engine.js, src/ui/national-view.js, src/data/release-pairs.js | check-government-formation | Calendario delle consultazioni (piccole delegazioni prima), comunicazioni e cronologia della formazione |
| 9.2 | Dichiarazioni dei partiti, orientamenti e condizioni pubbliche, mandati esplorativi, esito, incarico, nomina PdC e ministri | Completato | src/core/legislature-engine.js, src/ui/national-view.js, src/data/release-pairs.js | check-government-formation | Dichiarazioni dei partiti simulati con orientamento e condizioni pubbliche, mandato esplorativo, esito, incarico e fiducia |
| 9.3 | Nessuna preferenza personale/dichiarazione privata inventata del Presidente; distinzione prassi/art. 92 | Completato | src/core/legislature-engine.js, src/ui/national-view.js, src/data/release-pairs.js | check-government-formation | Nessuna preferenza personale inventata del Presidente; spiegata la prassi dell’articolo 92 |
| 9.4 | Fase più interessante: notizie, cronologia, decisioni, conseguenze | Completato | src/core/legislature-engine.js, src/ui/national-view.js, src/data/release-pairs.js | check-government-formation | Fase con notizie, cronologia, decisioni e conseguenze nella carta «Formazione del governo» |

## 10. Promesse elettorali e notifiche

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 10.1 | Registrare promesse da candidatura, campagna, comizi, dialoghi, programma, trattative | Completato | src/core/program-engine.js, src/core/store.js (makePromise, richieste → promessa) | check-program, check-promise-tools, check-program-ui, check-citizen-requests | Promesse da programma, campagna (annuncio), trattative con gli alleati e richieste dei cittadini |
| 10.2 | Promemoria popup: ricordare, evidenziare da mantenere, scadenze/progressi, momenti opportuni, senza ripetizioni, apribili | Completato | src/core/promise-reminders.js, src/ui/promise-reminder.js, src/core/store.js, src/ui/app.js, src/data/release-pairs.js | scripts/check-promise-reminders.mjs | Scheda promemoria non bloccante: scadenze a 8/4/1 settimane, in ritardo, non avviata; apribile con «Apri il programma»; una ogni tre settimane, mai ripetuti |
| 10.3 | Coerenti con la fase di gioco; non interrompono animazioni/votazioni | Completato | src/ui/app.js (quietNow) | scripts/check-promise-reminders.mjs | La scheda compare solo in un momento tranquillo (non in scene, votazioni, notte, dialoghi, campagna) e si nasconde se arriva altro |
| 10.4 | Dopo l'elezione: mantenuta/parzialmente/in corso/non mantenuta | Completato | src/core/program-engine.js | check-promise-tools, check-program | Stati: mantenuta, parzialmente mantenuta, in corso, non mantenuta, con effetti una sola volta |

## 11. Animazioni, dialoghi e personalità

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 11.1 | Azioni pertinenti all'argomento (niente opzioni fuori tema) | Completato | src/core/scene-engine.js, src/core/activity-scenes.js | check-scene-variety, check-scene-topics | Verificato da test esistenti |
| 11.2 | Pro e contro su ogni pulsante, coerenti con il motore | In lavorazione | src/core/scene-engine.js | check-scene | Ogni pulsante ha una descrizione con vantaggi e svantaggi in prosa, coerente con il motore; manca la struttura esplicita «Pro/Contro» |
| 11.3 | Barra di apprezzamento: 50 neutro; effetti progressivi; valore iniziale, variazione, finale | Completato | src/ui/scene-view.js, src/scene.css | check-scene, check-scene-ui | Barra del pubblico: 50 neutro, valore, scarto dal neutro e ultima mossa, aggiornata a ogni scelta |
| 11.4 | Più varietà/quantità di scene, dialoghi e azioni | Completato | src/core/scene-engine.js, src/core/activity-scenes.js | check-scene-variety, check-activity-scenes | Verificato da test esistenti |
| 11.5 | Caratteri (razionale, individualista, pragmatico, carismatico, moderato, ideologico, diplomatico) con effetto reale | Completato | src/core/scene-engine.js, src/core/activity-scenes.js | check-scene-identity, check-scene | Verificato da test esistenti |
| 11.6 | Migliorare grafica, animazioni, transizioni, leggibilità; riduzione/disattivazione animazioni | In lavorazione | src/ui/scene-view.js | check-stage-ui, check-scene-ui | Animazioni ridotte/disattivate presenti; miglioramento grafico generale non quantificato |

## 12. Alleanze e coalizioni

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 12.1 | Alleanza ≠ coalizione; pulsante «Crea alleanza» | Completato | src/core/alliance-rules.js, src/core/world-engine.js, src/core/store.js, src/ui/polls-mode.js, src/ui/app.js, src/polls.css | scripts/check-alliance-rules.mjs, scripts/check-alliance-ui.mjs | artifacts/qa/screenshots/after/alleanze-it-390x844.png, alleanze-it-820x1180.png, alleanze-en-390x844.png |
| 12.2 | Alleanza → coalizione solo con approvazione formale per una specifica elezione; alleanza può restare tale; accordi diversi per livelli diversi | Completato | src/core/alliance-rules.js, src/core/world-engine.js, src/core/store.js, src/ui/polls-mode.js, src/ui/app.js, src/polls.css | scripts/check-alliance-rules.mjs (scenari 2, 3, 11) | artifacts/qa/screenshots/after/alleanze-it-390x844.png, alleanze-it-820x1180.png, alleanze-en-390x844.png |
| 12.3 | Partito da solo chiede di entrare in coalizione: richiesta formale, condizioni, valutazione, trattative, accettazione/rifiuto, registrazione | Completato | src/core/world-engine.js, src/core/alliance-rules.js, src/core/store.js, src/ui/polls-mode.js, src/ui/app.js, src/data/release-pairs.js | scripts/check-alliance-rules.mjs (gruppo 13), scripts/check-alliance-ui.mjs | Richieste inviate/ricevute con storico (world.requests), valutazione, accettazione/rifiuto motivato, registrazione |
| 12.4 | Rifiuto con motivazione comprensibile; stesso richiedente bloccato 7 giorni di gioco | Completato | src/core/alliance-rules.js, src/core/world-engine.js, src/core/store.js, src/ui/polls-mode.js, src/ui/app.js, src/polls.css | scripts/check-alliance-rules.mjs (scenario 5), scripts/check-alliance-ui.mjs | Blocco di 7 giorni di gioco con data mostrata nella scheda del partito |
| 12.5 | Scadenza elettorale per formazione/adesioni/programmi/candidature/candidato guida; nessuna fusione improvvisa; modifiche comunicate e registrate | Completato | src/core/world-engine.js, src/core/alliance-rules.js, src/core/store.js, src/ui/polls-mode.js, src/ui/app.js, src/data/release-pairs.js | scripts/check-alliance-rules.mjs (gruppo 13), scripts/check-alliance-ui.mjs | Le trattative si chiudono al deposito delle liste di ogni elezione (qualsiasi livello); modifiche registrate nella storia e nella cronaca |
| 12.6 | Programma strutturato per ogni partito su 10 temi (immigrazione, sicurezza, economia/fisco, sanità, lavoro, ambiente/energia, Europa, diritti civili, istituzioni, politica estera) | Completato | src/core/alliance-rules.js, src/core/world-engine.js, src/core/store.js, src/ui/polls-mode.js, src/ui/app.js, src/polls.css | scripts/check-alliance-rules.mjs (scenario 6), scripts/check-alliance-ui.mjs | artifacts/qa/screenshots/after/alleanze-it-390x844.png, alleanze-it-820x1180.png, alleanze-en-390x844.png |
| 12.7 | Compatibilità calcolata sulle singole posizioni; incompatibilità forti come vere condizioni; compromesso esplicito o fallimento | Completato | src/core/alliance-rules.js, src/core/world-engine.js, src/core/store.js, src/ui/polls-mode.js, src/ui/app.js, src/polls.css | scripts/check-alliance-rules.mjs (scenari 6, 7), scripts/check-alliance-ui.mjs | Incompatibilità forti (distanza ≥4) bloccano la registrazione finché non c’è un compromesso |
| 12.8 | Trattative: punti programmatici, modifiche, concessioni, candidature e collegi, candidato guida, incarichi, programma comune, condizioni, rifiuto, interruzione, uscita | Completato | src/core/world-engine.js, src/core/alliance-rules.js, src/core/store.js, src/ui/polls-mode.js, src/ui/app.js, src/data/release-pairs.js | scripts/check-alliance-rules.mjs (gruppo 13), scripts/check-alliance-ui.mjs | Capolista, candidature (peso sulla quota di collegi al voto), incarichi, punto comune, rifiuto con ritentativo dopo 7 giorni, uscita |
| 12.9 | Valutazione per ideologia, convenienza, rapporti, leadership, consenso interno, precedenti; compromessi con conseguenze | Completato | src/core/world-engine.js, src/core/alliance-rules.js, src/core/store.js, src/ui/polls-mode.js, src/ui/app.js, src/data/release-pairs.js | scripts/check-alliance-rules.mjs (gruppo 13), scripts/check-alliance-ui.mjs | Risposta per peso, rapporti, rancori, coesione; richieste di peso rifiutate più spesso; impegni verificati al voto (mantenuti/traditi) |
| 12.10 | Effetti su sondaggi, consenso, candidature, risultati territoriali, seggi, rapporti, stabilità, fiducia; rottura con conseguenze | Completato | src/core/world-engine.js, src/core/alliance-rules.js, src/core/store.js, src/ui/polls-mode.js, src/ui/app.js, src/data/release-pairs.js, src/core/legislature-engine.js | scripts/check-alliance-rules.mjs (gruppo 13), scripts/check-alliance-ui.mjs, check-coalition-invites | Candidature negoziate → quotaBoost al voto; guida → capofila; rifiuti → rapporti e coesione; impegni traditi → rancori |
| 12.11 | Evitare duplicazioni, coalizioni sovrapposte, partecipazioni incompatibili | Completato | src/core/world-engine.js, src/core/alliance-rules.js, src/core/store.js, src/ui/polls-mode.js, src/ui/app.js, src/data/release-pairs.js | scripts/check-alliance-rules.mjs (gruppo 13), scripts/check-alliance-ui.mjs, check-coalition-invites | Un solo accordo per partito, incarico non assegnabile due volte, coalizione solo se registrata |
| 12.12 | Nuova pagina alleanze/coalizioni: esistenti, coalizioni, aderenti, richieste ricevute/inviate, trattative, programma comune, compatibilità, condizioni, scadenze, storico; smartphone e tablet | Completato | src/core/world-engine.js, src/core/alliance-rules.js, src/core/store.js, src/ui/polls-mode.js, src/ui/app.js, src/data/release-pairs.js | scripts/check-alliance-rules.mjs (gruppo 13), scripts/check-alliance-ui.mjs (screenshot in artifacts/qa/screenshots/after/alleanze-*) | Pagina: alleanza, programma, trattative per elezione, richieste ricevute/inviate/storico, scadenze; smartphone e tablet, IT/EN |
| 12.13 | Test 1: alleanza senza partecipazione elettorale | Completato | scripts/check-alliance-rules.mjs | check-alliance-rules, scenario 1 |  |
| 12.14 | Test 2: trasformazione esplicita in coalizione | Completato | scripts/check-alliance-rules.mjs | check-alliance-rules, scenario 2 |  |
| 12.15 | Test 3: alleanza che resta tale | Completato | scripts/check-alliance-rules.mjs | check-alliance-rules, scenario 3 |  |
| 12.16 | Test 4: partito solo chiede di entrare nel centrodestra | Completato | scripts/check-alliance-rules.mjs | check-alliance-rules, scenario 4 |  |
| 12.17 | Test 5: rifiuto e nuovo tentativo bloccato 7 giorni | Completato | scripts/check-alliance-rules.mjs | check-alliance-rules, scenario 5 |  |
| 12.18 | Test 6: programmi incompatibili non si accordano automaticamente | Completato | scripts/check-alliance-rules.mjs | check-alliance-rules, scenario 6 |  |
| 12.19 | Test 7: compromesso programmatico negoziato e approvato | Completato | scripts/check-alliance-rules.mjs | check-alliance-rules, scenario 7 |  |
| 12.20 | Test 8: chiusura delle adesioni prima delle elezioni | Completato | scripts/check-alliance-rules.mjs | check-alliance-rules, scenario 8 |  |
| 12.21 | Test 9: modifica a pochi giorni dal voto rifiutata | Completato | scripts/check-alliance-rules.mjs | check-alliance-rules, scenario 9 |  |
| 12.22 | Test 10: rottura di alleanza/coalizione | Completato | scripts/check-alliance-rules.mjs | check-alliance-rules, scenario 10 |  |
| 12.23 | Test 11: elezioni di livelli diversi con accordi diversi | Completato | scripts/check-alliance-rules.mjs | check-alliance-rules, scenario 11 |  |
| 12.24 | Test 12: coerenza coalizioni/candidature/sondaggi/risultati/seggi | Completato | scripts/check-alliance-rules.mjs | check-alliance-rules, scenario 12 |  |
| 12.25 | Compatibilità con carriere e salvataggi esistenti; un solo motore di alleanze | Completato | src/core/world-engine.js, src/core/alliance-rules.js, src/core/store.js, src/ui/polls-mode.js, src/ui/app.js, src/data/release-pairs.js | check-saves, check-world, check-invariants, check-coalition-invites, check-alliance-exit | Vecchi salvataggi senza coalitions/terms/requests: stessa semantica di prima |

## 13. Dimissioni, carriera, interfaccia

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 13.1 | Dimissioni da tutti gli incarichi (istituzionali/di partito) con conseguenze prima della conferma | Non iniziato |  |  |  |
| 13.2 | Carriera da semplice iscritto/militante senza incarichi istituzionali | Non iniziato |  |  |  |
| 13.3 | Avatar casuale | In lavorazione | src/ui/career-wizard.js | check-avatar | Avatar presente; «casuale» da verificare |
| 13.4 | Ruoli e autorizzazioni delle azioni controllati | Non iniziato |  |  |  |
| 13.5 | Schermate e menu più chiari; gioco meno monotono senza perdere contenuti | Non iniziato |  |  |  |

## 14. Risultati elettorali territoriali

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 14.1 | Consultazione Italia/Regione/Provincia/Comune; comunali coerenti con i totali superiori | In lavorazione | src/core/election-engine.js, src/ui/territory* | check-election-counts, check-seat-allocation, check-territory-legibility, check-italy-map | Verifiche esistenti sui conteggi e sulle mappe; verifica punto per punto ancora da fare |
| 14.2 | Dati ufficiali storici con fonte/anno, senza inventare | Non iniziato |  |  |  |
| 14.3 | Elezioni simulate: risultati territoriali coerenti (consenso, popolazione, caratteristiche locali, partiti, candidati, campagne); ufficiale vs simulato distinti | In lavorazione | src/core/election-engine.js, src/ui/territory* | check-election-counts, check-seat-allocation, check-territory-legibility, check-italy-map | Verifiche esistenti sui conteggi e sulle mappe; verifica punto per punto ancora da fare |
| 14.4 | Verifica voti, percentuali, collegi, soglie, seggi per ogni sistema elettorale | In lavorazione | src/core/election-engine.js, src/ui/territory* | check-election-counts, check-seat-allocation, check-territory-legibility, check-italy-map | Verifiche esistenti sui conteggi e sulle mappe; verifica punto per punto ancora da fare |

## 15. Guida «Come giocare»

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 15.1 | Manuale interattivo completo in Home su tutte le funzioni elencate (carriera, partiti, staff/capitale/fondi, tempo, sondaggi, candidature, elezioni, alleanze, assemblee, leggi, iniziative, Governo/Ministeri, CdM, crisi, richieste, animazioni, promesse, account/salvataggi) | Non iniziato |  |  |  |
| 15.2 | Per ogni funzione: come funziona, uso, requisiti, costi, conseguenze, esempi | Non iniziato |  |  |  |
| 15.3 | Scenari guidati: fondare partito, sindaco, Parlamento, coalizione, Ministro, PdC | Non iniziato |  |  |  |
| 15.4 | Ricercabile, smartphone e tablet, collegata alle funzioni; tutorial iniziale saltabile e riprendibile | In lavorazione | src/ui/menu.js | check-tutorial | Tutorial saltabile e riprendibile verificato; guida completa con ricerca non ancora fatta |

## 16. Traduzioni

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 16.1 | Verifica integrale IT/EN (menu, pulsanti, tutorial, dialoghi, eventi, notifiche, animazioni, elezioni, alleanze, Ministeri, errori, contenuti dinamici) | In lavorazione | src/data/release-pairs.js | check-i18n, check-i18n-release | Audit: 37.692 testi su 16 pagine e 20 popup, 0 in italiano; verifica integrale di tutti i contenuti dinamici non completata |
| 16.2 | Ogni nuova funzione bilingue nello stesso intervento; nessuna stringa italiana in EN; audit e test aggiornati | In lavorazione | src/data/release-pairs.js | check-i18n, check-i18n-release, check-i18n-pages | fatto per le funzioni nuove di questa sessione |

## 17. Statistiche amministrative private

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 17.1 | Dashboard admin: installazioni, DAU, WAU, MAU, andamento, account attivi | Non iniziato |  |  |  |
| 17.2 | Nessun collegamento visibile nell'app/sito pubblico; autenticazione e autorizzazione lato server | Non iniziato |  |  |  |
| 17.3 | Installazioni dalle statistiche degli store; utenti attivi aggregati/minimizzati; nessun fingerprinting/IP/clic indiscriminati | Non iniziato |  |  |  |
| 17.4 | Finalità, base giuridica, conservazione, informativa prima di attivare; nessuna credenziale nel client | Non iniziato |  |  |  |

## 18. Popup recensione Google Play

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 18.1 | Testo e pulsanti richiesti (IT/EN), link al Play Store | Completato | src/ui/review-card.js, src/data/repositories/review-prompt.js, src/ui/app.js | check-review-prompt | after/popup-recensione-it|en-{390x844,820x1180}.png |
| 18.2 | Una sola volta per installazione; non al primo avvio; solo dopo uso sufficiente; non durante tutorial/elezioni/votazioni/scene | Completato | review-prompt.js, app.js | check-review-prompt | una volta, non al primo avvio, solo quando quieto (si nasconde con menu/scena/voto) |
| 18.3 | Registrato come visualizzato prima dell'apertura; non ricompare dopo logout/cambio account/riavvio | Completato | review-prompt.js | check-review-prompt | dopo riavvio e nuova installazione verificati; stesso storage per ogni account |
| 18.4 | Memoria persistente locale; limite tecnico documentato; nessun fingerprinting; nessun premio/obbligo | Completato | docs/qa/review-prompt.md | check-review-prompt | localStorage WebView; limite di persistenza documentato |
| 18.5 | Miglioramento grafico: scheda moderna nello stile del gioco, testo, impaginazione, pulsanti, modalità non bloccante | Completato | src/ui/review-card.js, src/theme.css | check-review-prompt (non modale, anchor) | after/popup-recensione-*.png |
| 18.6 | Verifica funzionamento reale del collegamento al Play Store | Bloccato |  | check-review-prompt verifica href/target/clic (anchor verso la scheda) | play.google.com non raggiungibile da qui e nessun dispositivo Android: l'apertura nell'app Play Store va provata su telefono |

## 19. AdMob e aggiornamento Android

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 19.1 | Verificare l'integrazione nel branch (plugin, ID, banner, interstitial, rewarded, UMP) | Completato | docs/admob.md | check-admob | plugin 8.3.0, ID, banner/interstitial/rewarded, UMP presenti, spenti |
| 19.2 | ID di test ufficiali durante i test; limiti, duplicazioni, offline, attribuzione ricompense | In lavorazione |  | check-admob, check-rewards-sync | limiti/duplicati/offline/accredito Worker verificati con ID di prova |
| 19.3 | Valutare SSV lato server | In lavorazione | docs/admob.md |  | SSV valutata, non implementata (serve configurazione AdMob) |
| 19.4 | Non attivare annunci reali/live; se AdMob non pronto, aggiornamento senza pubblicità | Completato |  | check-admob | ADS_MODE off: nessun annuncio reale |
| 19.5 | Incrementare versione e versionCode prima dell'AAB | Bloccato |  |  | versionCode attuale su Play sconosciuto (repo: 1): non lo invento |
| 19.6 | Non modificare inutilmente iOS | Completato |  | git diff | nessuna modifica a ios/ in questo branch |
| 19.7 | Build Android, avvio reale, AAB solo se stabile, percorso dell'AAB | Bloccato |  |  | nessun Android SDK qui: build Gradle/AAB non eseguibili |

## 20. Screenshot (artifacts/qa/screenshots/before|after)

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 20.1 | Candidatura alle Politiche | Non iniziato |  |  |  |
| 20.2 | Messaggio requisiti non soddisfatti | Non iniziato |  |  |  |
| 20.3 | Notte elettorale | Completato | src/night.css | check-election-night-ui | Before/after: artifacts/qa/screenshots/{before,after}/notte-elettorale-390x844.png |
| 20.4 | Avanzamento 2/4 settimane | Completato | src/core/store.js | check-advance-turn | artifacts/qa/screenshots/{before,after}/avanzamento-4-settimane-390x844.png |
| 20.5 | Votazione nominativa | Non iniziato |  |  |  |
| 20.6 | Scene con pro e contro | Non iniziato |  |  |  |
| 20.7 | Barra di apprezzamento | Non iniziato |  |  |  |
| 20.8 | Pagina alleanze e coalizioni | Completato | src/ui/polls-mode.js | check-alliance-ui | artifacts/qa/screenshots/after/alleanze-it-390x844.png, alleanze-it-820x1180.png, alleanze-en-390x844.png |
| 20.9 | Trattativa e programma comune | Non iniziato |  |  |  |
| 20.10 | Raccolta firme | Completato | src/ui/initiative-mode.js | check-initiatives-ui | artifacts/qa/screenshots/after/iniziative-it-390x844.png, iniziative-it-820x1180.png, iniziative-en-390x844.png |
| 20.11 | Richieste dei cittadini | Non iniziato |  |  |  |
| 20.12 | Crisi di Governo | Non iniziato |  |  |  |
| 20.13 | Area Ministeri | Non iniziato |  |  |  |
| 20.14 | Consiglio dei ministri | Non iniziato |  |  |  |
| 20.15 | Formazione del Governo e consultazioni | Non iniziato |  |  |  |
| 20.16 | Promemoria delle promesse | Non iniziato |  |  |  |
| 20.17 | Risultati elettorali territoriali | Non iniziato |  |  |  |
| 20.18 | Guida completa | Non iniziato |  |  |  |
| 20.19 | Dimissioni e carriera senza incarichi | Non iniziato |  |  |  |
| 20.20 | Avatar casuale | Non iniziato |  |  |  |
| 20.21 | Popup recensione | Completato | src/ui/review-card.js | check-review-prompt | artifacts/qa/screenshots/after/popup-recensione-* |
| 20.22 | Schermate principali con pulsanti e caricamenti | Non iniziato |  |  |  |
| 20.23 | Screenshot reali (Playwright/browser/emulatore), senza credenziali/token/dati personali; per ognuno funzione, scenario, dispositivo, risultato | In lavorazione | scripts/* |  | Screenshot reali fatti con Chrome headless (Chromium di Playwright) per notte, avanzamento, capitale, alleanze, iniziative, recensione; mancano gli altri argomenti |

## 21. Collaudo e risultato finale

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 21.1 | Test specifici per ogni modifica; casi limite; compatibilità salvataggi; smartphone/tablet; IT/EN | In lavorazione | scripts/ | check-* (vedi rapporto) | Regressione parziale eseguita sui test pertinenti; check:all completo non eseguito in questa sessione |
| 21.2 | Regressioni tra elezioni, campagne, partiti, assemblee, Governo, Ministeri, animazioni, avanzamento, account, ricompense | In lavorazione | scripts/ | check-* (vedi rapporto) | Regressione parziale eseguita sui test pertinenti; check:all completo non eseguito in questa sessione |
| 21.3 | Verifica completa pertinente prima della consegna | In lavorazione | scripts/ | check-* (vedi rapporto) | Regressione parziale eseguita sui test pertinenti; check:all completo non eseguito in questa sessione |
| 21.4 | Build Android, avvio reale, AAB se stabile, percorso AAB | Non iniziato |  |  |  |
| 21.5 | Rapporto finale con tutte le richieste e lo stato, file, test, screenshot, problemi residui, passaggi esterni | Non iniziato |  |  |  |

## 22. Ultime aggiunte (messaggio del 16/11)

| Punto | Richiesta | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|---|
| 22.1 | Rendere il popup recensione più curato (vedi 18.5, 18.6) e aggiornare gli screenshot | Completato |  | check-review-prompt | vedi 18.5/18.6 |
| 22.2 | Confrontare la checklist punto per punto con il documento originale | Completato | docs/qa/master-checklist.md |  | 169 voci |
| 22.3 | Riprodurre il bug candidatura con una partita di test e aggiungere diagnostica | Completato | scripts/check-candidacy-vice-councillor.mjs, src/core/diagnostics.js | check-candidacy-vice-councillor | Scenario riprodotto con partita di test; il blocco non si presenta; diagnostica attiva |
| 22.4 | Priorità: reattività pulsanti, candidatura, notte elettorale, alleanze/coalizioni con tutti i test | In lavorazione |  |  | Reattività, candidatura, notte e alleanze: fatti; restano i punti indicati In lavorazione |
| 22.5 | Poi: Parlamento, iniziative popolari, Governo, Ministeri, CdM, consultazioni, promesse, animazioni, guida, risultati territoriali, traduzioni, statistiche, AdMob | In lavorazione |  |  | Parlamento (assenze) e iniziative popolari fatte; il resto verificato solo in parte |
| 22.6 | Mantenere aggiornati checklist, test, screenshot; non eliminare funzioni; non dichiarare completato senza verifica; nessun deploy/merge/main | In lavorazione |  |  | Regola valida fino alla consegna: nessun deploy, merge o modifica a main |
