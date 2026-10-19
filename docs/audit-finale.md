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
| 4 | Elezioni distinte a meno di 100 giorni; anni senza voto giocabile; finestre oltre 365 giorni senza voto | Simulazione 8–10 anni su più semi: gap di 19–89 giorni e un caso di 385 giorni | Alta | `src/core/calendar-planner.js`: tornata = stesso giorno = un solo turno; DFS di armonizzazione; le anticipate prendono la prima data libera dal minimo legale (`earliest`); turni aperti rinviati o ritirati; ballottaggio trattato come fase del turno, non come elezione distinta; (superato: la regola dei 150 giorni e `playableGapDays` sono stati rimossi, vedi «Correzione definitiva dei bug» più sotto: distanza di 180 giorni tra tornate distinte e nessun limite di una candidatura all'anno); limiti dei cicli allargati alle finestre legali | `check-calendar-gap` (multi-seme, 8–10 anni), `check-calendar`, `check-calendar-years`, `check-races`, `check-career` | CORRETTO |
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
| Capacitor / Android / iOS | `docs/app-stato.md`: iOS e Android presenti come progetti nel repository, build `www/` ripetibile (`build:www`, `check:www`, `check:capacitor`); nessun `.ipa`/`.aab`/`.apk` costruito, nessun SDK né Xcode qui: **NON ESEGUITO** |

## 9. Rischi residui

1. Supermedia 01/10/2026 non riscontrata sulla fonte (BLOCCATO).
2. Popolazione reale dei comuni non importata (BLOCCATO): le fasce usano un fallback dichiarato.
3. Android e iOS non costruiti né provati su dispositivo (NON ESEGUITO).
4. Dati legali della privacy a carico del titolare.
5. Lazy loading del codice non realizzato (motivo nella sezione G dell’aggiornamento del 16/10).
6. Verifiche Cloudflare solo su copie locali.

Il gioco **non è dichiarato pronto al rilascio**: restano aperti i punti sopra elencati.

---

# Aggiornamento 16/10/2026 (correzione dei bug residui) — solo i cambiamenti di questo giro

Stati: **PASS** / **FAIL** / **BLOCKED** / **NOT RUN**. Il Worker è stato provato **solo in locale** su D1/KV di prova in memoria (`scripts/lib/local-worker.mjs`); la produzione Cloudflare non è stata toccata né verificata, nessuna migrazione è stata eseguita su database reali.

## A. Salvataggi online (protocollo 2) — PASS
| Problema confermato | Correzione | Test |
|---|---|---|
| `worker.js` accettava `baseRevision` **superiore** alla revisione online; `force:true` saltava ogni controllo; il client ricavava la revisione da `knownRevision(slot)` per account+slot, anche per una copia vecchia | **Server** (`PUT /api/saves/:slot`): contenuto letto e validato (deve essere una carriera, nello slot che porta il suo nome); `baseRevision` deve essere **esattamente** la revisione online (mancante → 400, inferiore → 409 `conflict`, superiore → 409 `base-ahead`); l'avanzamento (data, settimana, turno, elezioni) è letto **dal contenuto** e un salvataggio più indietro è rifiutato (`regression`) anche con la revisione giusta; `force` non esiste più (ignorato: stesso esito di una richiesta normale); controllo+scrittura+checkpoint in un unico `batch` con compare-and-swap. **Client**: la revisione è legata alla **carriera** e alla copia con cui è stata sincronizzata (revisione locale + avanzamento); una copia più vecchia o senza provenienza (anche il vecchio registro per-slot) non va online da sola | `check-accounts` (caso critico settimana 21/revisione 6 ← settimana 1 con base 6: 409, contenuto persistito identico; base inferiore/superiore/assente/non intera; slot di un'altra carriera; contenuto non valido; `force` su richiesta automatica; corsa tra due dispositivi; riga legacy senza stato; contenuto compresso), `check-saves`, `check-sync-queue` |
| Nessun checkpoint cloud | Tabella `save_history`: prima di sostituire (o eliminare) una versione viene copiata; ultime 6 per carriera + quelle sostituite da ripristino/eliminazione; elenco e lettura `GET …/history[/id]` | `check-accounts` (cronologia, ritaglio, eliminazione e ricreazione, contatore `save_state.last_revision` che non ripete revisioni) |
| Ripristino volontario | `POST /api/saves/:slot/restore`: nomina la revisione vista (`expectedRevision`), accetta la copia del dispositivo o una voce della cronologia, conserva la versione sostituita, dà una revisione nuova e più alta; UI: «Sostituisci online con questa» (con conferma) e «Versioni precedenti → Ripristina» | `check-accounts`, `check-saves` (conferma richiesta, nulla cambia senza), `check-sync-queue` |
| Solo timer di 6 s | **Coda persistente** (`src/data/repositories/sync-queue.js`) nel browser: una richiesta per carriera legata all'account, sopravvive alla chiusura della pagina, attese crescenti (5 s … 15 min) offline, riprende alla riconnessione/riapertura/ritorno visibile **dopo aver riletto la versione online** (se è diversa: conflitto, nulla inviato), una sola scheda alla volta (lease), sessione scaduta e rifiuti definitivi visibili | `check-sync-queue` (Worker reale) |
| Stati poco chiari | Stato in parole: «Modifiche non salvate in questo browser» · «Salvata in questo browser» · «Salvata qui · sincronizzazione in attesa» · «Salvata qui e online» · «Conflitto» · «Errore»/«Sessione scaduta» · «Solo su questo dispositivo»/«Collegata all'account X» (`data-sync-status`) | `check-saves`, `check-account-isolation` |
Migrazioni **additive**: `migrations/0003_save_protocol.sql` (`save_state`, `save_history`) — solo `CREATE … IF NOT EXISTS`, nessuna colonna modificata, nessun dato toccato; le protezioni locali di `storage.js` (backup, storico, slot, lock, rifiuto di salvataggi obsoleti) sono invariate. Non eseguita sul database di produzione.

## B. Account — PASS (consegna email: NON VERIFICATA)
| Problema | Correzione | Test |
|---|---|---|
| Dopo login/registrazione la carriera aperta veniva sincronizzata subito nell'account appena scelto | Nessun invio automatico: una carriera va in un account solo se è già collegata a quell'account o se il giocatore lo sceglie («Porta online su questo account»; per una carriera di un altro account serve una conferma e la copia dell'altro non si tocca). Le carriere create mentre si è collegati sono dell'account. Il collegamento è per **carriera** e per account (`politicando.sync.links.v2`) | `check-account-isolation` (Chrome: login → nulla online; scelta → online; logout → sessione chiusa sul server e carriera locale intatta; secondo account → «collegata a legacy.a», nulla caricato né dopo nuovi salvataggi; collegamento esplicito con conferma, copia del primo intatta), `check-accounts`, `check-sync-queue` |
| Logout/sessioni | Logout chiude la sessione locale subito e quella sul server (se offline la ritenta in seguito); sessione scaduta (401) e uscita in un'altra scheda sono riconosciute; i dati locali restano | `check-accounts`, `check-account-isolation` |
| Nessuna email/recupero password | Email **facoltativa** (tabella `user_emails`), verifica con collegamento monouso 48 h, recupero con collegamento monouso 30 min; token a 256 bit casuali, solo l'hash nel database; risposta neutra (non rivela se un account esiste); limiti per rete e per casella; dopo il cambio password tutte le sessioni e gli altri collegamenti si chiudono; account legacy invariati (possono aggiungere e verificare un'email senza perdere nulla); `ACCOUNT_EMAIL_REQUIRED` per renderla obbligatoria quando il provider sarà attivo. Provider **Resend** configurabile con segreti (`RESEND_API_KEY`, `EMAIL_FROM`, `PUBLIC_BASE_URL`), nessun segreto nel repository | `check-accounts` (legacy, verifica, scaduto, riuso, collegamenti vecchi, limiti, neutralità, cambio password, sessioni chiuse, eliminazione account che toglie email/token/cronologia), `check-account-isolation` (schermate e collegamenti in Chrome), `check-security` (informativa coerente: 48 h/30 min, hash dei token, nessuna chiave nel codice, nessun `force`), `check-account-deletion` |
| **BLOCKED** | L'invio reale non è stato provato: nessuna credenziale del provider in questo ambiente. Il Worker è stato eseguito con un trasporto di prova (`env.EMAIL_SEND`, esiste solo nei test). Senza chiave `/api/account/status` dice `email: false` e nulla viene spedito. Cosa serve: `docs/account-email.md` | — |
Informativa privacy aggiornata (email, cronologia delle versioni, token) con un nuovo campo `data-controller-todo="email"` per il titolare: i punti aperti per il titolare passano da 7 a 8.

## C. Dati ISTAT reali — **BLOCKED** (invariato)
Ritentato il 16/10/2026: `demo.istat.it`, `www.istat.it`, Situas, `dait.interno.gov.it` rifiutati dalla rete dell'ambiente (CONNECT 403; anche lo strumento di lettura web: host non risolto). Nessun file ufficiale ottenuto, nessun dato inventato; l'importatore (`scripts/import-istat-popolazione-comuni.mjs`) e il fallback dichiarato `fino-15000` restano. **I test su fixture sintetiche non sono la prova dell'importazione ufficiale.** File mancanti: archivio CSV/ZIP POSAS «Popolazione residente per sesso, età e stato civile al 1° gennaio 2026» e la tabella «Popolazione legale 2021 (31/12/2021)» da Situas/Censimento permanente.

## D. Supermedia 1/10/2026 — corretta la contraddizione (PASS); verifica sulla fonte **BLOCKED**
`polls.json` dichiarava `verified: true` con una nota che diceva «non riletta». Ora: `verified: false`, `verificationStatus: "in-attesa-di-conferma"`, `verifiedAt: null`, `transcribedAt: 2026-10-14` (data di trascrizione, distinta da riferimento 01/10, finestra 17–30/09, pubblicazione 07/10 e dalla verifica che non c'è), nota che dice cosa manca. I numeri non sono stati toccati. La simulazione apre ancora la carriera con questi valori ma li marca «DATO REALE · in attesa di conferma sulla fonte»; resta distinta dal dato verificato (settembre) e dai sondaggi simulati. `check-supermedia` e `validate-real-data` non obbligano più a dichiarare verificata una fonte non consultata: una poll `verified` senza data di lettura, o con la nota «non riletta», fallisce. YouTrend non raggiungibile (rete bloccata).

## E. Schermate esistenti — PASS
- **Bilancio/misure** (`policy-mode.js`): stessi calcoli, nuova gerarchia — costo e copertura in testa, poi ogni cifra come «etichetta · prima → dopo · ▲ migliora/▼ peggiora/● invariato» in una colonna sul telefono (test: `check-premier`).
- **Cronologia della carriera** (`game-mode.js`): tre blocchi distinti — «In corso adesso» (incarichi), «Previsto» (voti già in calendario, «non ancora avvenuto») e «Accaduto» ordinato per **data dell'evento** (non per ordine di scrittura); solo dati della carriera; identica dopo salvataggio e ricaricamento (`check-sections`).
- **Regionali**: la campagna portava il nome generico «Regionali» (la corsa del partito invece «Regionali · Piemonte»). Ora campagna, resoconto, storia elettorale e memoria portano «Regionali · Lombardia» e l'id del voto (`electionId`); la preparazione indica quale elezione è, con le date del calendario. Nessuna regola o data cambiata. Test su Lombardia **e** Toscana: `check-regional-chain`.

## F. Diritti degli asset — documentato
`docs/audit-diritti-asset.md` (nuovo, solo le verifiche ancora aperte): nessun asset dichiarato lecito, nessuno rimosso. Aperti: marchio/icone Politicando, logo di Futuro Nazionale (nessuna licenza documentata), loghi dell'Admin (nessun campo di licenza), illustrazioni SVG, «LA POLITICA 24»; font OFL documentati. Campi del titolare nell'informativa non inventati.

## G. Caricamento a richiesta del codice — **non realizzato, con motivo**
Misurato: 140 moduli, 4,26 MiB, di cui 2,3 MiB sono motori (`core`) importati in modo sincrono da `store.js` e 1,3 MiB viste. Le viste candidate (Admin, riservato al proprietario) pesano 56 KiB (1,3 %); i motori non si possono rendere asincroni senza riscrivere lo store e il rendering (stringhe sincrone). Beneficio < 2 % contro rischio di schermate vuote e corse con il cambio pagina: **non introdotto**. I dati pesanti restano a richiesta e il budget d'avvio è controllato da `check-load`.

## H. Non eseguito per istruzione
Build o modifiche native Android/iOS e AdMob: non toccati.

---

# Aggiornamento del 17/10/2026 — salvataggi, nuova partita, colori dell'Admin

Branch `claude/nifty-johnson-a8x5cv`. Stati: **codice corretto** · **test locale superato** (Node, Chrome headless su profilo pulito, Worker/D1/KV di prova in memoria) · **provato nel browser** (Chrome headless: non è un browser di un giocatore, né Safari/Firefox) · **produzione verificata** (non è stata toccata né letta: il sito pubblicato non è raggiungibile da questo ambiente).

## 1. Salvataggi (P0)
**Misura** (Chrome, profilo pulito, carriera di prova; localStorage ≈ 5,2 milioni di caratteri prima del `QuotaExceededError`):

| Carriera | principale | copia | cronologia | 3 slot | totale |
|---|---|---|---|---|---|
| 3 settimane | 219 K | 245 K | 797 K | 388 K | 1,65 M |
| 30 settimane | 618 K | 687 K | 1.942 K | 1.396 K | **4,64 M** (89 % del limite) |

Con 5 slot la quota si esaurisce già dopo poche decine di settimane: il problema era reale. Prima, con quota esaurita, il salvataggio falliva (corretto: mai «salvato» falso) ma il giocatore non aveva dove mettere i dati.

**Correzione** (`src/core/tiered-storage.js`, usato da `src/core/storage.js`): due livelli. localStorage resta il primo (sincrono, letto dalle altre schede), con un **budget** di 3 milioni di caratteri per i salvataggi (principale, copia, cronologia, slot) che lascia spazio alle chiavi piccole (blocco, indici, coda, impostazioni). Ciò che non entra va in **IndexedDB** (`politicando-vault`), tenuto in memoria e riletto dal ricaricamento. Ogni scrittura è anche specchiata in IndexedDB.
- **Migrazione idempotente e verificata**: all'avvio le chiavi di localStorage non ancora in IndexedDB vengono copiate, **riletta** da IndexedDB e confrontate; l'esito (copiate / verificate / differenze / saltate) è nel rapporto `storage.vaultReport()` e in un registro `__meta__`. **Nessuna chiave di localStorage viene cancellata o riscritta dal codice di migrazione.** Riaprendo non si copia di nuovo nulla.
- **Nessun falso «salvato»**: se la copia non è in localStorage, `storage.save` restituisce `durable:false` e una promessa `confirm`; il gioco mostra «Salvataggio nel database del browser in corso…» (stato non salvato) e dichiara «Salvato» solo a conferma di IndexedDB. Se nessuno dei due accetta la scrittura: errore visibile («Il browser non ha confermato la scrittura: la carriera è solo in memoria»), lo stato resta in memoria, compare in ogni schermata un avviso con «Esporta la carriera su file» (ultimo stato, non quello vecchio) e il gioco chiede al browser di domandare conferma prima di chiudere la pagina (`beforeunload`: nel codice, non provato nel browser automatico).
- **Operazioni rischiose bloccate**: prima di sostituire la carriera (nuova partita, carica slot, importa file, carica o ripristina dall'account, ripristino di una copia) `store.preserveCurrent()` scrive la copia in uno slot automatico **e ne attende la conferma**; se non è confermata non si sostituisce nulla e si spiega come esportare. Nessuno slot manuale viene eliminato da sé.
- **Schede**: lo stato che vive solo fuori da localStorage è annunciato alle altre schede (BroadcastChannel) e riletto da IndexedDB quando la scheda torna visibile. Con quota esaurita anche per il blocco, il salvataggio prosegue senza blocco (resta il controllo sul progresso della carriera, che rifiuta un salvataggio obsoleto).
- **Coda di sincronizzazione**: se il browser non riesce a scrivere la coda, la richiesta compare come **errore** («non è stata registrata»), non come attesa.
- **Limiti residui**: IndexedDB non c'è/è disabilitato (modalità privata di alcuni browser) → tutto torna come prima (solo localStorage, con gli stessi errori); due schede con localStorage pieno si vedono via BroadcastChannel (non c'è in Safari < 15.4); un eventuale «slot eliminato» può riapparire se la cancellazione in IndexedDB fallisce. Safari/Firefox non provati.

Test: `check-tiered-storage` (Node, IndexedDB e localStorage simulati con quota e guasti: migrazione, idempotenza, quota, ricaricamento, due schede, assenza di spazio per il blocco, molti slot), `check-save-resilience` (Chrome, IndexedDB reale: migrazione di una carriera «all'antica», quota, ricaricamento, seconda scheda, scrittura rifiutata, avviso, esportazione, blocco della sostituzione), `check-sync-queue` (coda non scrivibile), `check-saves` (invariato).

## 2. Nuova partita, × e «Annulla» (P0)
**Riproduzione** (`check-new-game-flow`, Chrome): «Nuova partita» apriva la procedura **sopra** la schermata della carriera in corso (barra laterale, intestazione, pagina dietro un velo traslucido): da lì l'impressione di «riapre l'ultima carriera». Inoltre «Annulla» c'era solo al passaggio 1 e una risposta tardiva dei dati ricaricava la procedura.
**Correzione**: la procedura è una schermata a sé (sfondo opaco, nulla della carriera disegnato dietro, né barra mobile); «Annulla» e × a ogni passaggio tornano al menu iniziale senza creare né caricare nulla; ogni caricamento dati ha un controllo di appartenenza (una risposta dopo l'annullamento non cambia schermata); con gli slot pieni «Inizia carriera» è bloccato con il motivo e l'esportazione della carriera in corso (prima il messaggio prometteva di perderla). Verificato da menu principale, pagina Carriera, Impostazioni, telefono (375 px) e a ogni passaggio 1–5: id, settimana e data della carriera restano identici.

## 3. Colori dell'Admin (P0)
Il modulo ha **un solo colore** (già dal commit precedente). Il sintomo online «due colori / colore non salvato» **non è riproducibile in locale** (il codice sorgente non ha mai avuto un secondo selettore su `main`; sul branch c'è stato solo tra il 14 e il 16/10): l'ipotesi più probabile è una pagina in cache di quella versione. Corretto comunque ciò che poteva fallire in silenzio: `persist()` ora **rifiuta** (con messaggio) una modifica che il browser non può tenere; la copia dell'archivio ricevuta dal server resta in uso anche se non si può scrivere in localStorage (prima il colore pubblicato poteva non arrivare in partita); il messaggio dell'Admin dice «Salvato in questo browser; pubblicazione in corso…» e **«Pubblicato … (confermato dal server)» solo con la risposta del server**, altrimenti «NON pubblicato»; il Worker non scrive più `color2` (né nei partiti aggiunti né nei record corretti; i vecchi archivi si leggono ancora); l'indirizzo dell'API vale anche per un dominio personalizzato.
Test: `check-admin-storage` (nuovo), `check-admin-parties`, `check-admin-e2e` (selettore → modulo → archivio locale → KV del Worker → ricaricamento → nuova sessione → nuova carriera), `check-party-colors`.

## 4. Carica partita (P1)
Ogni slot: nome leggibile, giocatore, settimana, data di gioco, data di salvataggio, dove sta («In questo browser» / «Nel database del browser») e se il browser ha confermato; **esportazione per slot**; la partita in corso dice se è salvata, in scrittura, non salvata o non riuscita; **copie di sicurezza** (copia e cronologia locale) elencate con il motivo, esportabili e ripristinabili: una copia più vecchia della stessa carriera torna come **carriera separata** (nuova identità), perché il gioco non fa mai tornare indietro una carriera (la più avanzata non viene toccata). Test: `check-load-game`.

## 5. Workers Builds rosso
Il controllo `Workers Builds: palazzo-2026-site` è rosso su ogni commit del branch, anche su `1b78892` che ha `wrangler.jsonc` identico a quello della build verde di `main`. Da qui: `npm ci --dry-run`, `wrangler deploy --dry-run` e `wrangler versions upload --dry-run` **passano**; il dettaglio dell'errore è solo nella dashboard Cloudflare (il controllo non espone testo). **Causa non determinabile da questo ambiente**; la produzione serve `main` (cbaac63), quindi nulla di quanto è su questo branch è online.

# Aggiornamento del 17/10/2026 (secondo giro) — ISTAT, voti, salvataggi, elezioni annuali, account

Branch `claude/nifty-johnson-a8x5cv`. Le stesse etichette: **codice corretto** · **test locale superato** · **provato nel browser** (Chrome headless) · **produzione verificata** (no: il sito pubblicato non è raggiungibile da questo ambiente e non è stato toccato).

## 1. ISTAT e popolazione (P0)
**Fonte**: il solo file allegato `POLITICANDO_ISTAT_COMUNI_REGIONI_2026_COMPLETO.xlsx` (lo `scripts/convert-istat-xlsx.mjs` lo legge e `scripts/import-istat-comuni-2026.mjs` lo porta nel formato del gioco). Il CSV, il LEGGIMI e `municipal-population.json` indicati dalla richiesta **non c'erano** tra gli allegati: nessun dato è stato scaricato né cercato altrove. **Il dataset deriva da una tabella pubblica documentata come uso del POSAS 2026 e non è una copia grezza verificata direttamente dallo ZIP ufficiale ISTAT**: `verified: false`, `verificationStatus: derivato-da-tabella-pubblica-non-verificato-su-zip-ufficiale`, ripetuto nel file, nel manifesto e in `docs/istat-popolazione-report.json`. Prima del rilascio pubblico va fatto il confronto con il POSAS ufficiale.
**Contenuto e controlli** (`check-istat-import`, `check-istat-population`): 7.894 comuni, 20 regioni, 58.942.828 residenti al 01/01/2026; codice a 6 cifre come stringa, nome, popolazione numerica intera, data, fonte; nessun duplicato, nessun codice mancante, somma dei comuni = regione (e Italia), fusioni/ricodifiche della tabella di raccordo rilevate; se un controllo fallisce l'importazione si ferma con i codici dei problemi. La schermata mostra gli abitanti esatti («1.234 abitanti · 01/01/2026»).

## 2. Voti e risultati (P0)
`src/core/electorate.js`: residenti, elettorato, votanti e voti validi sono quattro numeri distinti. Residenti = ISTAT (regioni e Italia = somma dei comuni); elettorato = iscritti reali (mappa 2022, politiche e regionali) oppure, per un comune, **simulato** all'82 % dei residenti (assunzione dichiarata del gioco, non un dato); votanti ≤ elettorato e ≤ residenti, validi ≤ votanti, voti di lista = validi (resto maggiore, riga «Altre liste»). La scala fittizia di 100.000 resta **solo** senza dati demografici o per il voto di secondo livello (province, dichiarata come tale). Test `check-election-counts` (280 e 1.000 residenti, affluenza 100 %, regionale, nazionale, dati mancanti, primo turno e ballottaggio) e invarianti in `src/core/invariants.js`.

## 3. Salvataggi (P0)
**Riprodotto** in Chrome senza IndexedDB: `Setting the value of 'palazzo-2026.career.v1' exceeded the quota`. Ora (`tiered-storage.js`, `lz.js`): budget di localStorage, IndexedDB per ciò che non entra, **copia compressa come ultimo ripiego** quando IndexedDB non c'è, apertura di IndexedDB in ritardo con nuovi tentativi, scritture ritentate sugli errori transitori, **cancellazioni confermate** (uno slot cancellato non riappare), riapertura e più schede. «Salvato» solo a conferma durevole; se nessun sistema accetta la scrittura lo stato resta recuperabile e si offre l'esportazione su file. Nessuna carriera vera viene cancellata né sovrascritta. Test: `check-tiered-storage`, `check-save-resilience`, `check-load-game`, `check-saves`.

## 4. Elezioni annuali (P0)
**Problema verificato**: nelle annate senza un voto proprio (mandati di cinque anni) il calendario aveva solo la «tornata di amministrative», una scelta di impegno senza candidati né schede: un evento di calendario, non un'elezione giocabile. In più il calendario contava come «voto giocabile» anche i voti che la regola del ritmo personale (150 giorni tra due candidature, una per anno solare) impedisce di giocare.
**Correzione**: (1) ogni tornata ha una **corsa vera** (`race-engine.js: roundRace/syncRoundRaces`) in un comune della regione del giocatore (non il suo), a cui si candida **solo lui** anche se non guida un partito (Elezioni → Candidatura → «Mi candido»/«Ritira la candidatura»); la campagna è quella vera, con i residenti ISTAT di quel comune. Chi guida un partito ha in più tutta la lista di prima. (2) `roundPlan` (`career-engine.js`) conta solo i voti a cui il giocatore può candidarsi (`calendar-planner.js: reachableFrom`) e aggiunge una tornata quando il prossimo è oltre 364 giorni. (3) Tra tornate diverse restano ≥ 100 giorni; il ballottaggio è parte della stessa campagna (una sola voce nello storico) e non conta come seconda elezione dell'anno.
**Test**: `check-annual-elections` (nuovo, 11 percorsi/seed × 6 anni sul motore completo: ogni anno solare e ogni anno di carriera ha una campagna avviata e conclusa; voti giocati e tornate a ≥ 105 giorni), `check-round-race` (nuovo), `check-calendar`, `check-calendar-gap`, `check-calendar-years`, `check-races`.
**Scelte da sapere**: la regola «una sola candidatura personale all'anno solare» (introdotta in precedenza) è rimasta; per non lasciare anni vuoti il calendario aggiunge una tornata dove serve. Le politiche anticipate sono l'eccezione già prevista.

## 5. Logout e account (P0)
Dopo l'uscita (o con un altro account) la carriera collegata a un account **non** compare come «Continua la partita» normale: la scheda è bloccata e mostra il proprietario, con «Accedi come …» e «Usa localmente» (conferma esplicita; non elimina nulla e non tocca le copie online). Una carriera usata localmente non viene sincronizzata finché il proprietario non la riporta online («Salva ora online»). Le carriere anonime non sono mai bloccate. `check-account-isolation` esteso: uscita, stesso account di nuovo, altro account, carriera anonima, riapertura. Codice: `account-sync.js` (`careerGate`, `useLocally`), `menu.js`, `app.js`.

## Non verificato / residuo
Dataset ISTAT non confrontato con lo ZIP ufficiale; produzione non toccata né verificata; Safari/Firefox non provati; `Workers Builds` rosso: causa visibile solo nella dashboard Cloudflare.

# Aggiornamento del 17/10/2026 (terzo giro) — logout, popup, correzioni elettorali, controllo di pubblicazione

**Logout e partite protette.** Una carriera collegata a un account che non è quello con cui si è entrati (o a nessun account dopo l'uscita) non compare più né nella schermata iniziale né in «Carica partita» (slot manuali, copie automatiche e copie di sicurezza). La proprietà si legge dal salvataggio stesso (`storage.slotCareerId`, un solo metodo per tutti i percorsi) e si controlla anche nei gestori di caricamento, esportazione, ripristino ed eliminazione, non soltanto nascondendo i pulsanti. Niente viene cancellato: copie locali e copie online restano; con l'account giusto tornano visibili; «Usa localmente» resta una scelta esplicita e confermata e non sincronizza verso altri account. Test: `check-account-isolation` (uscita, elenchi, pulsante forzato, copia locale e online intatte, rientro del proprietario, secondo account, «Usa localmente»).

**Popup della homepage.** Carica partita, Hall of Fame, Account, Come giocare, Impostazioni, i passaggi di primo avvio e Nuova partita (cinque passaggi invariati) si aprono come finestre centrate sopra la homepage, con titolo, chiusura, «Annulla», sfondo, scorrimento interno e a tutto schermo su telefono; si chiudono con la chiusura, «Annulla», Escape o un clic sullo sfondo (un clic dentro non chiude). La homepage sotto è inerte; le conferme distruttive usano ancora la finestra di conferma, che sta sopra. «Continua la partita» resta un'azione. Test: `check-start-screen`, `check-mobile-start`, `check-ui`, `check-new-game-flow`.

**Correzioni elettorali.** Primo turno: le schede delle aree sommano al totale della tornata. Politiche ed europee: le righe sono liste, partiti o coalizioni, il nome della persona è nel dettaglio; indipendenti e candidature locali non cambiano. Affluenza: «richiesta» e «vera» (votanti su elettori) sono distinte, con 0 %, 100 %, tetto dei residenti e scale gestiti. Pesi territoriali: decimali sufficienti per i pesi positivi piccoli (i valori non cambiano). Precaricamento offline: include i documenti opzionali; un documento mancante viene saltato senza fermare gli altri.

**Controllo di pubblicazione.** `scripts/lib/document-provenance.mjs`: tutti i documenti devono essere verificati; l'unica eccezione è `municipalPopulation` (popolazione dei comuni, ISTAT POSAS 2026), accettata solo se dichiara di non essere verificata con lo stato esplicito, la fonte, la nota «non è una copia grezza verificata», e se manifest, conteggi, totale, data e impronte dei file di origine coincidono. Il confronto con la fonte ufficiale non è stato possibile: da questo ambiente `demo.istat.it` risponde 403 (un solo tentativo mirato). Il dataset resta `verified: false`. Senza la popolazione legale la classificazione demografica che ne dipende (la fascia dei 15.000 abitanti) resta provvisoria e usa la popolazione residente come riferimento dichiarato.

## Correzione definitiva dei bug (ottobre 2026)

Questa sezione registra cosa è stato corretto alla radice nell'ultimo ciclo e come è verificato. Lo stato di ogni punto, con test eseguiti ed esiti, è nel resoconto finale della sessione.

- **Calendario** (`calendar-planner.js`, `office-engine.js`, `race-engine.js`, `career-engine.js`): distanza di 180 giorni tra tornate distinte, una sola soglia e nessuna deroga (la versione precedente la abbassava a gradini fino a 90 giorni e segnava `shortGap`: rimosso); le politiche ordinarie sono riprogrammabili nella loro finestra costituzionale; i vincoli artificiali di 100/150 giorni e di una candidatura all'anno sono rimossi e sostituiti dal solo divieto di sovrapporre due campagne. Test: `check-calendar-gap`, `check-calendar-years`, `check-races`, `check-annual-elections`, `check-round-race`.
- **Sondaggi e ballottaggio** (`election-engine.js`, `campaign-engine.js`): l'eliminato conserva la quota del primo turno invece di comparire allo 0%; l'esito si confronta con la stima della fase giusta; il sondaggio del ballottaggio nasce all'apertura con due candidati; la mobilitazione al ballottaggio vale per tutti gli stessi finalisti; gli spareggi non dipendono dall'ordine dei candidati. Test: `check-runoff-polls`, `check-elections`.
- **Dal voto alla misura** (`local-engine.js`, `territory-share.js`): il voto di un atto non sposta i servizi; la mozione non ha misura; la misura approvata va in attuazione e produce effetti solo se attuata (in ritardo, inefficace o non attuata), e alla regione arriva il peso reale del comune o della provincia (popolazione ISTAT), non una quota fissa. Test: `check-local-implementation`, `check-local`.
- **Comitati** (`committee-engine.js`, `career-engine.js`, `party-life-engine.js`, `committees-view.js`): fondazione in qualsiasi regione con selezione Regione → Provincia → Comune; nessun responsabile alla nascita; un solo responsabile (la persona della Vita interna); iscritti contati una volta tra comitati, sezioni e partito. Test: `check-committee-founding`.
- **Interfaccia**: logo e programma separati nella creazione del partito (la classe `wizard-logo` era condivisa con il marchio del gioco); pannelli che mantengono lo stato aperto/chiuso; «Candidati» che porta alla procedura del voto con i motivi di blocco; descrizioni delle fasce dei comuni senza promesse automatiche (`docs/riferimenti-normativi-comunali.md`); segno discreto per le vittorie vere (`core/celebration.js`). Test: `check-wizard-party-layout`, `check:panels` (script `check-panels-stay-put.mjs`), `check-candidacy-access`, `check-municipality-descriptions`, `check-elections`, `check-party-life`.
- **Pubblicazione**: `.assetsignore` esclude `android` e `.gitattributes`; `check-assets` non permette che `android` sia pubblicato.

## Correzioni mirate ai bug ancora aperti (ottobre 2026)

- **Calendario (causa).** `movable()` escludeva le politiche ordinarie; `harmonizeElections()` abbassava la distanza da 180 a 90 giorni a passi di 15; `check-calendar-years` conteneva un’asserzione sempre vera. Ora una sola soglia (180), politiche ordinarie spostabili nella finestra `[14, 70]` giorni, politiche già scadute all’avvio con prima data possibile (`earliest`), asserzioni rigorose. Test: `check-calendar-scheduling` (nuovo, rapido), `check-calendar-gap` (rafforzato), `check-calendar-years` (rigoroso).
- **Governo senza maggioranza (causa riprodotta).** Con un voto appena tenuto o in corso, le politiche anticipate dopo uno scioglimento arrivavano a 258 giorni (la regola dei 180 giorni lasciava le Camere sciolte e il governo in ordinaria amministrazione per mesi; con la formazione fallita il test restava 16+ settimane in «fallita»). Correzione: prima si cerca una data entro ~70 giorni rinviando gli altri voti; se il calendario non lo permette (`dissolveWithinDays` = 112) le Camere non si sciolgono e si prosegue con un governo di scopo. Test: `check-government-formation` (nuovo).
- **Sondaggi.** `consensusHistory` ora distingue le metriche (consenso territoriale, sondaggio con istituto/campione/margine, proiezione del ballottaggio, risultato della fase) con `campaignMetrics()`; la UI di campagna non confonde più il consenso territoriale con la proiezione del ballottaggio. Test: `check-poll-metrics` (nuovo).
- **Salvataggi.** Slot, backup e copie di cronologia più vecchi non sovrascrivono mai una carriera avanzata (tornano come carriera separata). Test: `check-stale-slot` (nuovo, senza browser) e `check-reload-advance` (Chrome) con uno slot realmente più vecchio.
- **Comitati.** Rimosso un attributo HTML duplicato (`data-committee-unit-name`) nel pulsante di fondazione; il test lo verifica.
- **Documentazione.** Data dello snapshot (24 settembre 2026), Android (progetto presente, mai compilato), nome del test dei pannelli (`check:panels` → `scripts/check-panels-stay-put.mjs`).
- **Ancora NON verificati** (invariato): la popolazione ISTAT dei comuni non è stata confrontata con lo ZIP ufficiale e i riferimenti normativi di `docs/riferimenti-normativi-comunali.md` non sono stati controllati sul testo vigente (Normattiva); restano dichiarati non verificati nei dati e nei documenti.
