# Audit finale — POLITICANDO 2026 — 16/10/2026

Branch `claude/nifty-johnson-a8x5cv`. Commit di partenza di questo giro: `67d0f46`. Regole seguite: lavoro solo sul branch, `main` mai toccato; nessun `reset --hard`, `clean` distruttivo, force-push o migrazione distruttiva; nessun deploy; nessun dato di produzione modificato; `www/` generato solo con `npm run build:www`. Ogni esito è di un comando eseguito in questa sessione; ciò che non si è potuto eseguire è scritto come **BLOCCATO** o **NON ESEGUITO**, mai come riuscito.

Legenda stato: **CORRETTO** (bug confermato, corretto, con test di regressione) · **VERIFICATO** (nessun difetto trovato, coperto da test) · **BLOCCATO** (dipende da una fonte o da uno strumento non raggiungibile da qui) · **APERTO** (rischio residuo dichiarato).

## 1. Priorità 0 — mobile e navigazione

| # | Problema | Evidenza | Gravità | Correzione | Test | Stato |
|---|---|---|---|---|---|---|
| 1 | Menu «Altro»: elenco piatto, nessuna ricerca, rischio di navigare per sbaglio | Foglio senza gruppi; un tocco sul fondo cambiava pagina | Alta (mobile) | `SHEET_GROUPS` in `src/ui/app.js`: categorie ad accordion, ricerca, chiusura con × o toccando lo sfondo, il tasto indietro chiude il foglio senza cambiare pagina, aprire il foglio non cambia carriera né settimana; popup settimanale e scheda del tutorial nascosti mentre il foglio è aperto; intestazione fissa così che × resta raggiungibile | `check-more-menu` | CORRETTO |
| 2 | «Annulla» in Nuova partita finiva dentro il gioco o toccava la carriera | Il wizard chiamava la navigazione verso la partita | Alta | Annulla da ogni passo torna alla Home iniziale (menu) senza scrivere sulla carriera esistente; dato salvato non toccato | `check-ui`, `check-start-screen`, `check-mobile-start` (un caso per passo) | CORRETTO |
| 3 | Nessun tutorial guidato | Solo la guida testuale | Media | `src/ui/tutorial.js`: percorso interattivo, saltabile, ripristinabile (si riprende dal passo, rilanciabile da Guida), cerca nella guida; non cambia lo stato della carriera | `check-tutorial` | CORRETTO |

## 2. Calendario elettorale

| # | Problema | Evidenza | Gravità | Correzione | Test | Stato |
|---|---|---|---|---|---|---|
| 4 | Elezioni distinte a meno di 100 giorni; anni senza voto giocabile; finestre oltre 365 giorni senza voto | Simulazione 8–10 anni su più semi: gap di 19–89 giorni e un caso di 385 giorni | Alta | `src/core/calendar-planner.js`: tornata = stesso giorno = un solo turno; DFS di armonizzazione; le anticipate prendono la prima data libera dal minimo legale (`earliest`); turni aperti rinviati o ritirati; ballottaggio trattato come fase del turno, non come elezione distinta; regola dei 150 giorni per candidatura personale mantenuta; `playableGapDays` 100; limiti dei cicli allargati alle finestre legali | `check-calendar-gap` (multi-seme, 8–10 anni), `check-calendar`, `check-calendar-years`, `check-races`, `check-career` | CORRETTO |
| 5 | Data di anticipate obsoleta (`baseDate` non azzerata) | Elezione anticipata fissata prima della data corrente | Media | `baseDate` ricalcolata alla programmazione | `check-calendar-gap` | CORRETTO |

## 3. Sondaggi

| # | Problema | Evidenza | Gravità | Correzione | Test | Stato |
|---|---|---|---|---|---|---|
| 6 | Il Quadro dei sondaggi mostrava solo alcune forze | Limite di righe nell'Osservatorio | Media | `src/ui/observatory-view.js` senza limiti di partito: **tutte** le forze presenti, anche oltre 12 | `check-observatory-page` (≥12 forze) | CORRETTO |
| 7 | Campagna e Osservatorio incoerenti | `campaign.polls` (legacy) separato dall'onda dell'Osservatorio | Alta | `recordCampaignPoll` legge `pollWave`: una sola fonte | `check-poll-consistency` (test statistici di coerenza) | CORRETTO |
| 8 | **Ballottaggio: la rilevazione del secondo turno partiva dalle righe del primo (somma ≈ 47 %)** | Letture di ballottaggio non normalizzate a due candidati | Alta | l'onda del ballottaggio non è seminata dal primo turno | `check-poll-consistency` | CORRETTO |
| 9 | Verifica fonte Supermedia 01/10/2026 | `youtrend.it` risponde 403 dal proxy dell'ambiente | — | Non verificabile: le date (data di rilevazione, data di pubblicazione, data del gioco) sono distinte nel codice e nei dati già presenti, ma **la rilevazione non è stata riscontrata sulla fonte** | `check-supermedia` (verifica interna) | **BLOCCATO** |

## 4. Colori dei partiti

| # | Problema | Evidenza | Gravità | Correzione | Test | Stato |
|---|---|---|---|---|---|---|
| 10 | Admin permetteva «colore 2» che non ha senso nel gioco | Campo duplicato in UI e dati | Media | Solo il colore primario; `color2` rimosso da `PARTY_FIELDS` e dall'interfaccia; i dati legacy con `color2` restano leggibili (forzato a `null`, nessuna perdita di dati) | `check-admin-parties`, `check-admin-e2e`, `check-party-colors` | CORRETTO |
| 11 | **Il colore scelto in Admin non arrivava alle nuove carriere** (forze del mondo create senza `brandColor`) | Carriera nuova con colore generico | Alta | `src/core/world-engine.js` assegna `brandColor` alla creazione; `withPartyIdentities` applica fin dal giorno 1 | `check-party-colors` | CORRETTO |
| 12 | **Riferimento obsoleto dopo una modifica in Admin** (lo store usava la vecchia tabella) | Colore corretto solo dopo il ricaricamento | Media | `refreshReference` dopo ogni modifica Admin; `setForceColorOverrides` a ogni render | `check-admin-e2e` | CORRETTO |
| 13 | Coalizioni colorate per posizione/nome | Scambio di colori fra liste omonime | Media | Coalizioni risolte per **id esplicito** | `check-party-colors`, `check-national-colors` | CORRETTO |

## 5. Popolazione dei comuni e pesi regionali (ISTAT)

| # | Problema | Evidenza | Gravità | Correzione | Test | Stato |
|---|---|---|---|---|---|---|
| 14 | Fascia demografica scelta a mano nel wizard e «oltre» fisso per le comunali generate dal calendario | `municipalityBand` passato a `startCampaign` | Alta | Rimossa la scelta manuale; la fascia deriva dai dati del comune con catena di base dichiarata (`municipal-rules.js`, `municipalityBandInfo`); popolazione **residente** e **legale** tenute separate; riferimento elettorale `null` finché non determinato (mai guida una decisione) | `check-istat-population` (entrambi i lati della soglia dei 15.000 con il riferimento prescritto, fasce dei seggi) | CORRETTO |
| 15 | Pesi regionali uniformi (5 % ciascuna) per i calcoli nazionali | Fallback uniforme anche con dati validi | Media | `territory-weights.js`: voti validi 2022 come pesi, fallback dichiarato solo se mancano | `check-istat-population`, `check-regional-ranking` | CORRETTO |
| 16 | Importatore ISTAT | — | — | `scripts/import-istat-popolazione-comuni.mjs` + `scripts/lib/istat-population.mjs` (chiave = codice ISTAT, zeri iniziali e accenti conservati, rifiuto di schemi non riconosciuti, report machine-readable `docs/istat-popolazione-report.json`, metadati e hash, `--check`); dati opzionali caricati da `loadOptionalRealDocument` | `check-istat-population` su fixture sintetiche etichettate come tali | CORRETTO (importatore) |
| 17 | **Importazione reale dei dati ISTAT** | `demo.istat.it` / `www.istat.it` / Situas rispondono 403 dal proxy | — | Nessun CSV inventato. I dati forniti nel repository **non contengono popolazione**: il gioco usa un fallback dichiarato (`fino-15000`) e lo segnala. Per completare: scaricare il CSV/ZIP POSAS 2026 e la popolazione legale 2021, poi `node scripts/import-istat-popolazione-comuni.mjs --resident … --legal …` | — | **BLOCCATO** (fonti non raggiungibili) |

L'integrazione dei dati demografici **non è dichiarata completa**: manca l'importazione dei due dataset reali, il rapporto di completezza e la verifica a campione.

## 6. Salvataggi

| # | Problema | Evidenza | Gravità | Correzione | Test | Stato |
|---|---|---|---|---|---|---|
| 18 | Salvataggi, backup, revisioni, migrazioni | Nessun cambio di schema in questo giro: le modifiche aggiungono solo campi opzionali (`brandColor`, `ritirato`, popolazione) | — | Nessuna migrazione distruttiva; vecchi salvataggi caricati nei test | `check-saves`, `check-legacy`, `check-advance`, `check-accounts` | VERIFICATO |
| 19 | Cache del piano (`planCache`) e versione degli asset | Da audit precedente | — | Già corretti nel giro H4; ricontrollati con `check-assets`, `check-scenario-date` | `check-assets`, `check-scenario-date` | VERIFICATO |

## 7. Istituzioni locali: atti multipli

| # | Problema | Evidenza | Gravità | Correzione | Test | Stato |
|---|---|---|---|---|---|---|
| 20 | Un solo atto alla volta per tutto il mandato («Hai già una proposta in discussione») | Blocco globale in `proposeLocalAct` | Media | Capacità trasparente per ruolo (`ACT_CAPACITY`: consigliere 2, delegato/assessore 3, chi guida l'esecutivo 4, eurodeputato 2), mostrata in UI («Atti in corso: n su max»); stesso tipo sullo stesso tema rifiutato con motivo; fondi insufficienti restano un motivo separato; pulsante **Ritira l'atto** (`withdrawLocalAct`) che libera un posto e sopravvive al salvataggio | `check-local`, `check-offices`, `check-mandates` (capacità del sindaco, pulsante nella pagina, ritiro), `check-province` | CORRETTO |
| 21 | **Gli atti del sindaco (sponsor «esecutivo») non rientravano nel conteggio né erano ritirabili** | `isOwnOpenAct` guardava solo `sponsor.kind === 'player'` | Media | Criterio basato su `kind === 'player'` / delega | `check-mandates` | CORRETTO |
| 23 | **Sforamento di un'opera a lavori avanzati: soldi prelevati inferiori ai lavori fatti** (Piscina comunale: costo 8 → 9,6 all'83 % dei lavori, prelevati 7,7 su 7,99 necessari) | Trovato dal long-run di 10 anni (`beta/comunale`, settimana 182); latente nel codice precedente, emerso perché il calendario nuovo cambia la traiettoria. `autoSettle` e `settleWorkIssue('integra')` pagavano solo la quota «impegnata» + 20 % dell'extra, non la parte già usata dai lavori | Media (invariante `opere` violata) | `overrunPay` in `src/core/local-works-engine.js`: il prelievo non è mai inferiore a `extra × avanzamento` (vale per la scelta del giocatore e per la Giunta); `committed` allineato | `check-local-works` (sforamento al 83 %), `check-long-run --tier=medium` | CORRETTO |
| 22 | Import duplicato di `withdrawLocalAct` in `store.js` (errore di sintassi trovato dai test, introdotto e corretto in questo giro) | 4 test falliti all'import | Alta (blocca l'avvio) | Rimosso il duplicato | `check-gameplay`, `check-observatory`, `check-polls` | CORRETTO |

## 8. Verifiche tecniche (§14) e altri punti

| Punto | Esito |
|---|---|
| Versione degli asset (`?v=`) | `npm run version:build` → `20261016-3`; `check-assets` verifica che ogni import e foglio di stile porti lo stesso timbro. VERIFICATO |
| Data di scenario 12/10/2026 | `check-scenario-date`. VERIFICATO |
| `guard.fail`, sessioni, CSP, privacy | Controllati nei giri H4/G11; `check-security`, `check-account-deletion`, `check-service-worker`. VERIFICATO. I campi legali della privacy (titolare, contatti) restano a carico del titolare: **APERTO** |
| Cloudflare / worker | Provati solo in locale su copie isolate (`check-admin-e2e`, `check-admin-parties`); nessun deploy. **NON ESEGUITO** online |
| Prestazioni e caricamento a richiesta (lazy loading) | `check-load` misura il budget dei moduli d'avvio (con `modulepreload`) e che i dati reali pesanti si carichino a richiesta; il caricamento a richiesta del **codice** delle sezioni non è stato realizzato: **APERTO** |
| Radio / sintesi vocale / popup settimanale | `check-news-radio`, `check-news-voice`. VERIFICATO (in browser headless: la voce reale dipende dal sistema dell'utente) |
| Dirigenti, congresso/Segreteria, Governo/Leggi, Parlamento/Quirinale, Admin | `check-leaders`, `check-cadres`, `check-congress`, `check-congress-ui`, `check-party-life`, `check-government`, `check-government-layout`, `check-laws`, `check-parliament-page`, `check-quirinale-page`, `check-admin`, `check-admin-sync`. VERIFICATO |
| Simulazione lunga | `check-long-run --tier=medium` (10 anni, 7 carriere: 4 semi e livelli diversi + gemelli per il determinismo, invarianti ogni trimestre, export/import a ogni tappa): PASS in 340 s dopo la correzione n. 23. Il livello `full` (30 anni) **NON ESEGUITO**: richiede ore (limite 360 min) e nella corsia di prova è scaduto a 40 min a 312 settimane su 1565, senza concludere: nessun esito |
| Responsive 320–1280 (compreso il Quadro con ≥12 righe) | `check-responsive`, `check-mobile-start`, `check-territory-legibility`, `check-chart-contrast`, `check-button-contrast`. VERIFICATO |
| Capacitor / Android / iOS | `docs/app-stato.md`: iOS presente, build `www/` ripetibile (`build:www`, `check:www`, `check:capacitor`); Android **assente** nel repository; nessun `.ipa`/`.aab`/`.apk` costruito, nessun SDK né Xcode qui: **NON ESEGUITO** |

## 9. Rischi residui

1. Supermedia 01/10/2026 non riscontrata sulla fonte (BLOCCATO).
2. Popolazione reale dei comuni non importata (BLOCCATO): le fasce usano un fallback dichiarato.
3. Android e iOS non costruiti né provati su dispositivo (NON ESEGUITO).
4. Dati legali della privacy a carico del titolare.
5. Lazy loading dei moduli non realizzato; prestazioni solo misurate in locale.
6. Verifiche Cloudflare solo su copie locali.

Il gioco **non è dichiarato pronto al rilascio**: restano aperti i punti sopra elencati.
