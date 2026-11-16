# Master checklist — completamento Politicando 2026

Ogni voce parte da *non iniziato*. Uno stato *completato* richiede una prova concreta (test, screenshot, file). Stati: non iniziato · in lavorazione · completato · bloccato · parziale.

Ultimo aggiornamento: 2026-11-16 · branch `feature/qa-completamento` (da `feature/ios-admob-android` @ 9eb2ca8).


## 2. Bug prioritari: candidature ed elezioni

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 2.1 Scenario vicesegretario + consigliere comunale: candidatura alle Politiche riprodotta | parziale |  | repro browser /tmp/qa | riprodotto con livello Vicesegretario + consigliere comunale: la candidatura funziona (nessun blocco, nessun errore); regole verificate con 18 combinazioni |
| 2.2 Impedimento ingiustificato alla candidatura corretto (o dimostrato assente) | non iniziato |  |  |  |
| 2.3 Blocco/crash dopo «Candidati ora» corretto (o dimostrato assente) | non iniziato |  |  |  |
| 2.4 Spiegazione dei requisiti non soddisfatti, sempre visibile | non iniziato |  |  |  |
| 2.5 Incarichi non automaticamente incompatibili; rinuncia gestibile se prevista | non iniziato |  |  |  |
| 2.6 Campagna senza candidatura: partecipazione chiusa, stato di campagna azzerato, ritorno alla carriera, nessuno stato residuo | non iniziato |  |  |  |
| 2.7 Notte elettorale: popup iniziale non copre tutto lo schermo; leggibile su smartphone e tablet | non iniziato |  |  |  |
| 2.8 Notte elettorale: partito del giocatore non mostrato come «Altri» | non iniziato |  |  |  |
| 2.9 Collegamenti giocatore/candidato/partito/coalizione; voti, percentuali, seggi coerenti | non iniziato |  |  |  |
| 2.10 Candidato al 6% non eletto con partito senza rappresentanza: collegio, soglie, seggi, posizione in lista spiegati (nessun seggio artificiale) | non iniziato |  |  |  |

## 3. Velocità e reattività dei pulsanti

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 3.1 Analisi delle cause di ritardo (thread principale, API, timer, render, handler) | non iniziato |  |  |  |
| 3.2 Feedback visivo immediato alla pressione | non iniziato |  |  |  |
| 3.3 Prevenzione doppi clic e operazioni duplicate | non iniziato |  |  |  |
| 3.4 Gestione errori senza interfaccia bloccata | non iniziato |  |  |  |
| 3.5 Misura dei tempi di risposta nelle principali schermate (prima/dopo) | non iniziato |  |  |  |

## 4. Avanzamento del tempo e simulazione automatica

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 4.1 Impostazione 2/4 settimane corretta (non avanza una sola settimana) | completato | src/core/store.js (advanceTurn) | check-advance-turn | causa: il ciclo si fermava a ogni campagna attiva/messaggio urgente senza dirlo |
| 4.2 Motivo di ogni interruzione e numero di settimane realmente trascorse | completato | src/core/store.js | check-advance-turn | toast «Avanzate N su M: mi sono fermato perché …»; screenshot da fare |
| 4.3 Simulare fino a una data o alle prossime elezioni | parziale | (già presente: advanceToDate, UI «Avanza fino alla data») | check-advance | «fino alle prossime elezioni» esiste come «fino alle candidature» (fastForwardToElection); non esteso al voto |
| 4.4 Votazioni delegate allo staff, con indicazioni politiche | parziale | (già presente: delega allo staff in advanceToDate) | check-advance | indicazioni politiche allo staff non implementate |
| 4.5 Simulazione che prosegue durante eventi ordinari e votazioni non essenziali; stop solo per decisioni importanti | non iniziato |  |  |  |

## 5. Parlamento, consigli e disciplina

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 5.1 Votazioni nominative (nome, favorevole/contrario/astenuto/assente) | non iniziato |  |  |  |
| 5.2 Più astensioni/assenze realistiche; scrutini segreti solo aggregati; totali coerenti | non iniziato |  |  |  |
| 5.3 Disciplina di gruppo con dissensi realistici | non iniziato |  |  |  |
| 5.4 Capitale politico: 60% trasferito alla campagna, calcolo mostrato, nessuna duplicazione | non iniziato |  |  |  |

## 6. Iniziative popolari e richieste dei cittadini

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 6.1 Iniziativa legislativa popolare: articoli, raccolta firme (50.000), costi, avanzamento, esito, passaggio al Parlamento | non iniziato |  |  |  |
| 6.2 Distinzione tra iniziativa popolare, proposta parlamentare, firme referendarie | non iniziato |  |  |  |
| 6.3 Richieste di cittadini/associazioni: azioni, competenze, tempi, costi, conseguenze | non iniziato |  |  |  |

## 7. Leggi, Governo e crisi del Paese

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 7.1 Catena approvazione → attuazione → effetti sugli indicatori verificata | non iniziato |  |  |  |
| 7.2 Presidente del Consiglio: crisi evidenziate in Home, urgenze, interventi con costi/tempi/rischi | non iniziato |  |  |  |

## 8. Consiglio dei ministri e gioco da Ministro

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 8.1 Sezione Consiglio dei ministri nell'area Governo | non iniziato |  |  |  |
| 8.2 Da Ministro: area ministeriale, proposte, incontri, voto in Consiglio, relazioni | non iniziato |  |  |  |
| 8.3 Da Presidente del Consiglio: convocazione, ordine del giorno, contrasti tra dicasteri, verifica programma | non iniziato |  |  |  |
| 8.4 Competenze rispettate (nessun potere non spettante) | non iniziato |  |  |  |

## 9. Formazione del Governo e consultazioni

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 9.1 Notizie e comunicazioni istituzionali della Presidenza della Repubblica (cronologia delle consultazioni) | non iniziato |  |  |  |
| 9.2 Dichiarazioni pubbliche dei gruppi, mandato esplorativo, incarico, nomina (art. 92) | non iniziato |  |  |  |

## 10. Promesse elettorali e notifiche

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 10.1 Registrazione delle promesse da tutte le fonti | non iniziato |  |  |  |
| 10.2 Promemoria popup non invadenti, con scadenze e azioni | non iniziato |  |  |  |
| 10.3 Stato dopo l'elezione (mantenuta/parziale/in corso/non mantenuta) | non iniziato |  |  |  |

## 11. Animazioni, dialoghi e personalità

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 11.1 Azioni pertinenti all'argomento | non iniziato |  |  |  |
| 11.2 Pro e contro prima della selezione, coerenti con il motore | non iniziato |  |  |  |
| 11.3 Barra di apprezzamento (50 neutro, valore iniziale/variazione/finale) | non iniziato |  |  |  |
| 11.4 Più scene e dialoghi; caratteri (razionale, individualista, pragmatico, carismatico, moderato, ideologico, diplomatico) | non iniziato |  |  |  |
| 11.5 Animazioni riducibili/disattivabili | non iniziato |  |  |  |

## 12. Alleanze e coalizioni

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 12.1 Alleanza ≠ coalizione; «Crea alleanza»; trasformazione esplicita | non iniziato |  |  |  |
| 12.2 Adesione a una coalizione esistente, rifiuto con motivazione e blocco di 7 giorni | non iniziato |  |  |  |
| 12.3 Scadenza elettorale per formazione/modifica delle coalizioni | non iniziato |  |  |  |
| 12.4 Programmi strutturati su 10 temi; compatibilità per posizione; incompatibilità vincolanti | non iniziato |  |  |  |
| 12.5 Trattative e compromessi con conseguenze | non iniziato |  |  |  |
| 12.6 Effetti su sondaggi, candidature, risultati, seggi, stabilità; rottura | non iniziato |  |  |  |
| 12.7 Nuova pagina alleanze/coalizioni (smartphone e tablet) | non iniziato |  |  |  |
| 12.8 Dodici scenari di test obbligatori | non iniziato |  |  |  |

## 13. Dimissioni, carriera, interfaccia

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 13.1 Dimissioni da tutti gli incarichi (istituzionali/di partito) con conseguenze mostrate | non iniziato |  |  |  |
| 13.2 Carriera da semplice iscritto senza incarichi | non iniziato |  |  |  |
| 13.3 Avatar casuale | non iniziato |  |  |  |
| 13.4 Ruoli e autorizzazioni delle azioni; chiarezza di schermate e menu | non iniziato |  |  |  |

## 14. Risultati elettorali territoriali

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 14.1 Consultazione Italia/Regione/Provincia/Comune con coerenza dei totali | non iniziato |  |  |  |
| 14.2 Dati ufficiali storici con fonte/anno; simulazioni distinte | non iniziato |  |  |  |
| 14.3 Verifica voti, collegi, soglie e seggi per sistema elettorale | non iniziato |  |  |  |

## 15. Guida completa «Come giocare»

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 15.1 Manuale interattivo ricercabile su tutte le funzioni | non iniziato |  |  |  |
| 15.2 Scenari guidati (partito, sindaco, Parlamento, coalizione, Ministro, Presidente del Consiglio) | non iniziato |  |  |  |
| 15.3 Tutorial iniziale saltabile e riprendibile | non iniziato |  |  |  |

## 16. Traduzioni

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 16.1 Audit IT/EN completo, nuove funzioni bilingui, test aggiornati | non iniziato |  |  |  |

## 17. Statistiche amministrative private

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 17.1 Dashboard admin (installazioni, DAU/WAU/MAU, andamento, account attivi) con autenticazione lato server | non iniziato |  |  |  |
| 17.2 Dati aggregati e minimizzati; finalità, base giuridica, conservazione, informativa | non iniziato |  |  |  |

## 18. Popup recensione Google Play

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 18.1 Popup IT/EN con testo e due pulsanti richiesti | completato | src/data/repositories/review-prompt.js, src/ui/app.js, src/data/release-pairs.js | check-review-prompt | after/popup-recensione-it|en-390x844.png |
| 18.2 Una sola volta per installazione, non al primo avvio, non durante tutorial/elezioni/votazioni/scene | completato | review-prompt.js | check-review-prompt (logica + Chrome) | una volta, non al primo avvio, solo momento tranquillo |
| 18.3 Registrato come visualizzato prima dell'apertura; persistente (Preferences/locale); limite tecnico documentato | completato | review-prompt.js, docs/qa/review-prompt.md | check-review-prompt | localStorage della WebView; Preferences non aggiunto (stesso limite, documentato) |

## 19. AdMob e aggiornamento Android

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 19.1 Verifica integrazione AdMob nel branch (plugin, ID, banner, interstitial, rewarded, UMP) | non iniziato |  |  |  |
| 19.2 Limiti, duplicazioni, offline, attribuzione ricompense; valutazione SSV | non iniziato |  |  |  |
| 19.3 Annunci reali/live NON attivati; versione e versionCode incrementati | non iniziato |  |  |  |
| 19.4 Build Android, avvio reale, AAB (solo se stabile) | non iniziato |  |  |  |

## 20. Screenshot

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 20.1 Screenshot before/after per i 22 punti richiesti | non iniziato |  |  |  |

## 21. Collaudo finale

| Punto | Stato | File modificati | Test | Screenshot / note |
|---|---|---|---|---|
| 21.1 Test mirati per ogni modifica; regressione pertinente finale; smartphone/tablet; IT/EN; salvataggi | non iniziato |  |  |  |
| 21.2 Rapporto finale | non iniziato |  |  |  |
