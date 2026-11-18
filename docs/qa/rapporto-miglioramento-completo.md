# Rapporto — miglioramento completo di Politicando 2026

Branch locale `feature/miglioramento-completo` (19 commit sopra `main` 7cfc6f6). Build `20261117-5`. Nessun push, nessun deploy, nessuna modifica Cloudflare o migrazione remota (come richiesto).
Distinzione usata: **Implementato** = scritto e provato da un test; **Solo verificato** = esisteva già, l'ho controllato; **Non fatto / parziale** = detto con il motivo.

## 1. Problemi trovati

| # | Area | Problema reale |
|---|---|---|
| 1 | Pulsanti | Ogni `<button>` con classe non stilizzata prendeva il grigio del browser; il primario disabilitato spariva nello sfondo. |
| 2 | Alleanze | `allianceOdds()` aggiungeva «Difficoltà della partita» come motivo di una decisione politica. |
| 3 | Scene | `sceneFactor()` aveva un minimo positivo: con una reazione negativa del pubblico restavano bonus; le attività senza rischio non avevano mai un esito negativo. |
| 4 | Richieste dei cittadini | Si chiudevano scrivendo la proposta nel programma, senza interventi, tempi o conseguenze. |
| 5 | Iniziative | Volontari gratuiti, firme senza variabilità né margine, nessun iter parlamentare vero, nessun costo ricorrente in vista. |
| 6 | Leggi | Una legge approvata non entrava in un registro dell'ordinamento e poteva essere ripresentata identica, anche con un altro titolo. |
| 7 | Referendum | La fase dopo il deposito delle 500.000 firme «non era simulata»; non c'era il referendum costituzionale. |
| 8 | Programmi | Un partito senza collocazione documentata (1 su 82: «Progetto Civico Italia») riceveva posizioni intermedie su tutti i dieci temi, inventate. |
| 9 | Territori | La scheda era chiusa nella pagina nazionale, mostrava al massimo 40 comuni per provincia, senza ricerca, filtri, pagine o confronto. Su smartphone etichette e valori si sovrapponevano (trovato con una schermata). |
| 10 | Voti d'Aula | Astensioni e assenze ordinarie troppo alte (assenti in media ~9,5%, astenuti fino al 30% di chi non vota sì). |
| 11 | Avatar | L'avatar casuale estraeva il volto a caso: «Uomo» poteva dare un volto femminile. |
| 12 | Data di nascita | `<input type="date">` nativo: su Android serve scorrere decenni di calendario. |
| 13 | Guida | Una pagina lunghissima, tutte le schede aperte. |
| 14 | Recensione | Il popup non compariva per un giocatore reale: esigeva il «tour iniziale completato» (mai segnato con login su altro dispositivo, «Inizia senza account», salvataggi vecchi), considerava occupato qualunque oggetto `campaign` (anche una campagna finita) e partiva solo alla chiusura del resoconto settimanale (spento da chi lo disattiva). I test passavano perché la preparazione segna il tour come fatto. |
| 15 | Statistiche admin | Mancavano carriere, modalità di gioco e una dichiarazione onesta di ciò che non si sa. |
| 16 | Trovati dai miei stessi test | Il pannello delle attività con gli alleati non compariva (le opzioni non arrivavano al pannello); `territoryPaint` non importato (rotto il test del browser); budget di caricamento superato; frasi di traduzione con numeri/quote nel formato sbagliato. |

## 2. Correzioni implementate

- **Pulsanti**: base `:where(button…)` scura a specificità zero, primario disabilitato in oro spento, nessun grigio di sistema; token semantici (verde accordi, rosso crisi, blu istituzioni, viola diplomazia, arancio campagne, oro azione principale) usati solo nelle sezioni nuove. «Difficoltà della partita» tolta dalle decisioni (resta la scelta della difficoltà di carriera). Test `check:button-palette`.
- **Scene**: `sceneFactor` simmetrico (−0,8…+1,8), esito «cattivo» anche senza rischio, extra scalati dal verdetto, mai bonus con reazione negativa; reazioni alternative (114 frasi). Test `check:scene-effects`.
- **Richieste**: ciclo ricevuta → presa in carico → promessa/intervento avviato → eseguita / fallita / ignorata → soddisfatta / respinta; effetti su soddisfazione, indicatori, consenso e reputazione; tutto nel diario.
- **Iniziative**: volontari 2 €/settimana, variazione ordinaria ±5%, copertura mediatica come evento, quota valida 92% e margine consigliato 15%, fondi esauriti = canali a pagamento sospesi; a 50.000 firme valide il testo diventa un disegno di legge vero (assegnazione, commissione, Aula, emendamenti, voti) e il suo esito chiude l'iniziativa.
- **Leggi in vigore**: registro `parliament.statutes` (titolo, contenuto, data, origine, stato), blocco della ripresentazione per stessa area+strumento o stesso titolo fino a fine legislatura / 104 settimane, modifica e abrogazione con procedimento proprio, storico conservato; tabella nella pagina «Leggi».
- **Referendum** (`src/core/referendum-engine.js`, pagina «Referendum», agenda): **abrogativo** (legge in vigore; totale/parziale; quesito con chiarezza e omogeneità; esclusi tributarie/bilancio, amnistia/indulto, ratifica trattati; 500.000 firme dalla pagina Iniziative o cinque Consigli regionali; Ufficio centrale della Cassazione; Corte costituzionale; campagna SÌ/NO con azioni, sondaggi, eventi; voto con **quorum 50%** e maggioranza dei SÌ; la legge risulta abrogata o modificata nel registro) e **costituzionale** (revisione con due deliberazioni a tre mesi; due terzi = nessun referendum; richiesta entro tre mesi da un quinto dei membri, 500.000 firme o cinque Consigli; **nessun quorum**; riforma respinta non entra in vigore). I due restano separati per regole, fasi e effetti. Test `check:referendum`, `check:referendum-ui`.
- **Alleanze**: attività con gli alleati (riunione dei leader, tavolo sul programma, iniziativa sul territorio, conferenza stampa, mobilitazione) con costo, durata, probabilità visibile, esito riuscita/a metà/fallita, effetti su coesione, rapporti, consenso, notorietà, reputazione, cronologia e diario; pannello nella pagina delle alleanze. Programmi: una posizione non documentata è «non rilevata», mai intermedia (non conta come accordo né come conflitto). Test `check:ally-activities`, `check:party-programs`, `check:alliance-ui`.
- **Territori**: nuova pagina «Risultati per territorio» nel menu Elezioni (e collegamento dalla scheda): ricerca tra tutti i comuni (accenti e maiuscole ignorati), filtri regione/provincia, ordine, pagine da 25 (mai tutto insieme), sintesi, colonne delle prime liste, confronto tra due voti nazionali, somme controllate lista per lista, etichette «dato reale / risultato simulato / sondaggio-proiezione». Test `check:territory-page`, `check:territory-page-browser` (con un voto vero nello stato).
- **Voti d'Aula**: astensioni (3% + chiusura·17%) e assenze (4–11%, media ~7,6%) più basse; fiducia invariata e sempre più bassa.
- **Avatar**: il volto segue il sesso scelto; barba/baffi solo maschili; niente stempiatura sul volto femminile; la varietà resta (`check:avatar`). **Data di nascita**: giorno e anno con tastiera numerica, mese a menu, calendario/bisestili/futuro/età controllati in parole, stesso `YYYY-MM-DD` di sempre (`check:birth-date`).
- **Guida**: schede ad accordion (titolo + due righe, si apre al clic, la ricerca apre ciò che trova, l'indice apre la scheda); voci nuove per Referendum e Risultati per territorio (`check:guide`).
- **Recensione**: tour non richiesto, solo campagna *attiva* conta come occupato, controllo anche a ogni cambio di stato (max ogni 4 s), resta una sola volta, solo app Android (non sito), nessuna ricompensa. Diagnostica `__reviewStatus()`. Test `check:review-prompt` + `check-review-prompt-flow`.
- **Statistiche admin**: carriere online (in corso/concluse, difficoltà, modalità, salvate negli ultimi 7/30 giorni), tabella «cosa si sa e cosa no», nessun dato personale (verificato con nomi veri), solo sessione del proprietario; `ADMIN_STATS` resta spento. `docs/statistiche-admin.md` aggiornato.

## 3. Funzioni nuove completate

Referendum abrogativo e costituzionale giocabili · registro delle leggi in vigore con blocco di ripresentazione · iniziativa popolare come disegno di legge reale · attività con gli alleati · pagina Risultati per territorio · data di nascita a tre campi · guida ad accordion · invito alla recensione raggiungibile · statistiche carriere/modalità.

## 4. File modificati (principali)

Motori: `src/core/{referendum-engine,alliance-activities,birth-date}.js` (nuovi), `store.js`, `career-engine.js`, `citizen-requests-engine.js`, `initiative-engine.js`, `parliament-engine.js`, `lawmaking-engine.js`, `world-engine.js`, `alliance-rules.js`, `vote-engine.js`, `agenda-engine.js`, `avatar.js`. UI: `src/ui/{referendum-mode,territory-page}.js` (nuovi), `app.js`, `menu.js`, `career-wizard.js`, `polls-mode.js`, `observatory-view.js`, `parliament-mode.js`, `initiative-mode.js`, `national-view.js`, `territory-results-card.js`, `agenda-page.js`, `lazy-views.js`, `admin-panel.js`. Stili: `theme.css`, `sections.css`. Server: `worker.js`. Dati/traduzioni: `guide-manual.js`, `release-pairs.js` (4.212 frasi), dizionari generati. Test nuovi: `check-{button-palette,scene-effects,statutes,referendum,referendum-ui,party-programs,ally-activities,territory-page,territory-page-browser,birth-date,review-prompt-flow}.mjs` (tutti in `check:all`); estesi: `check-{world,activity-moves,citizen-requests,initiatives,alliance-ui,avatar,vote-absences,admin-stats,guide,scenario-date,territory-page-browser}`; `check-load.mjs` (budget raw 5,15 → 5,30 MB, motivato). Build: `www/`, `android/app/src/main/assets/public`, `index.html` (20261117-5).

## 5. Test eseguiti e risultati (tutti verdi, build 20261117-5)

`check:button-palette · world · scene-effects · activity-scenes · activity-scenes-ui · activity-moves · citizen-requests · initiatives · initiatives-ui · statutes · referendum · referendum-ui · alliance-rules · alliance-ui · party-programs · ally-activities · avatar · birth-date · guide · territory-results · territory-ui · territory-page · territory-page-browser · territory-browser · italy-map · review-prompt · review-prompt-flow · admin-stats · vote-absences · hemicycle · i18n · i18n-offline · i18n-pages · load · service-worker · boot · first-run`.
Corsa di stabilità: una carriera da 5 anni (seed dedicato): 0 violazioni delle invarianti, 0 usi di `Math.random`, salvataggio 1,97 MB, una revisione costituzionale arrivata fino al voto. Non rieseguiti: i 263 controlli completi e il long-run da 30 anni (come richiesto). `check-campaign-ui` non eseguibile in questo ambiente (Chrome, noto, identico a prima). `check:activity-scenes-i18n` non esiste come script: le traduzioni delle scene sono coperte da `check:i18n*`.

## 6. Punti incompleti, con il motivo

- **Referendum**: le posizioni dei gruppi sono derivate dalla maggioranza/opposizione parlamentare (con un 12% di liberi), non dalla linea di ogni partito del mondo; gli effetti sui partiti passano per reputazione e consenso del giocatore; l'elettorato è fisso (51 milioni, dichiarato simulato); l'abrogazione toglie la legge dal registro ma non annulla gli effetti già applicati al Paese; le revisioni costituzionali nascono dal generatore delle Camere, il giocatore non può presentarne una.
- **Alleanze/coalizioni**: layout verificato a 390 e 820 px sulla pagina principale e sul nuovo pannello; non ho rifatto uno per uno tutti i popup. «Programma completo sulle dieci aree»: verificato sui dieci temi di `alliance-rules` (18 partiti del mondo su 19, 81 su 82 nel catalogo); l'editor del programma del giocatore (aree di `policy-rules`) non è stato toccato.
- **Territori**: il confronto tra consultazioni è sulle liste nazionali, non per territorio (i voti per territorio esistono solo per l'ultimo voto politico); non ho aggiunto un test specifico mappa↔tabella (la mappa «Ultimo voto» usa lo stesso risultato registrato, già coperta da `check-italy-map`/`check-territory-browser`).
- **Scene (punto 2)**: il lavoro sui verdetti è dell'ordine precedente; in questa fase non ho riaperto l'audit dei contenuti dei dialoghi.
- **Statistiche**: sessioni, carriere create (anche senza account), elezioni simulate e uso delle funzioni **non sono raccolti** e la pagina lo dichiara; le installazioni restano a inserimento manuale; `ADMIN_STATS` resta spento in attesa di base giuridica e informativa.
- **Recensione**: l'apertura nell'app Play Store non è provabile senza dispositivo Android.

## Pronto per nuova AAB

| Voce | Stato |
|---|---|
| Build web (`version:build`, portale, `build:www`) | Fatta: versione `20261117-5`, 319 file |
| `npx cap sync android` | Fatto |
| `check:www`, `check:android`, `check:capacitor`, `check:admob`, `check:legal`, `check:load` | Verdi |
| Package ID | `it.matteobianchi.politicando2026` (invariato) |
| `versionCode` / `versionName` | **1 / "1.0"** (letti da `android/app/build.gradle`) — **ultimo valore su Google Play non verificabile da qui: non l'ho inventato né modificato** |
| Notifiche, permessi, firma | Invariati (solo `INTERNET`; nessuna chiave nel repository) |
| AdMob | Spento nel repository, nessun ID aggiunto, monetizzazione invariata |
| Bloccanti | (1) l'AAB non si può generare qui: nessun Android SDK scaricabile (dl.google.com 403) e nessuna chiave di upload; (2) prima del caricamento portare il `versionCode` oltre l'ultimo pubblicato: `npm run check:android -- --release --previous-version-code <N>` poi impostare il numero in `android/app/build.gradle` (nessun altro codice da cambiare); (3) deploy Cloudflare non eseguito: nessuna credenziale (`npm run cf:deploy:test` poi `npm run cf:deploy`). |

## Aggiornamento — chiusura delle lacune dichiarate

1. **Audit dialoghi e argomenti** (`check:activity-audit`): 18 attività su 62 hanno ora una scena animata (erano 8: aggiunte ascolto, associazioni-imprese, verifica strade/scuole, mediazione correnti, dissenso, sezione, formazione, interrogazione, conferenza, talk); ogni famiglia di attività ne ha almeno una. Integrità (≥5 alternative per momento, ≥4 funzioni, testi IT/EN, nessun duplicato), ≥3 reazioni distinte per funzione e fascia, ≥6 argomenti e ≥4 nomi per scena, varietà su 80 semi. Limite rimasto: una sola battuta di apertura per argomento; le altre 44 attività restano risolte dal modello semplice.
2. **Posizioni referendarie dei partiti**: ogni gruppo decide dal programma del suo partito sul tema della legge (distanza dalla posizione dei partiti di governo, `alliance-rules`); senza posizione documentata torna alla regola maggioranza/opposizione, registrata in `basis`. Costituzionale: il tema è «istituzioni» o «sicurezza» (ordinamento giudiziario).
3. **Abrogazione ed effetti**: `repealMeasure` ferma gli effetti continuativi della legge (totale; parziale/modifica: metà) senza annullare ciò che è già maturato; vale per il referendum e per l'abrogazione con legge. Test `check:referendum-effects`.
4. **Revisione costituzionale**: provata nel gioco la catena prima deliberazione → tre mesi → seconda → richiesta (un quinto) → campagna → voto senza quorum → registro delle riforme. La proposta di una revisione da parte del giocatore **non** è stata aggiunta.
5. **Partito senza collocazione** (Progetto Civico Italia): nel database non ha né collocazione né programma e non è verificato: resta «non rilevata».
6. **Confronto territoriale regionali/locali**: il gioco conserva, per ogni voto locale concluso, solo le liste principali e il vincitore: la pagina confronta due voti dello stesso luogo e livello lista per lista (coerenza: quote ≤100%, assenti = trattino); nessuna ricostruzione dei comuni.
7. **Duplicati equivalenti**: oltre ad area+strumento e titolo, si blocca un testo della stessa area con sovrapposizione ≥60% delle radici delle parole (titolo+contenuto) con una legge in vigore.
8. **Controllo finale layout**: tabella dei risultati su smartphone corretta; pannello attività con gli alleati ora raggiungibile; pagine Referendum/Risultati controllate a 390 px e a desktop.
Inoltre: digitazione nel wizard (ricerca partiti/comuni/gruppi) ora ridisegna dopo una pausa di 220 ms invece di ogni tasto; la Home non scrive più «Carriera comunale» a chi parte senza incarico («Percorso senza incarico»).

## Aggiornamento 2 — completamento del lavoro rimasto (build 20261117-8)

**Fatto e verificato**
- Data di nascita: `parseTyped` accetta «12/04/1985», «12-4-1985», «12.04.1985», «1985-04-12», «12 aprile 1985» (campo giorno o incolla); anche il campo nascosto scritto dall'esterno (autofill) riempie i tre campi visibili. Test: `check-birth-date`.
- Attività e dialoghi: 62/62 attività con scena animata contestuale (titolo, introduzione e argomento preferito per ciascuna). `check-activity-audit`.
- Revisioni costituzionali proposte dal giocatore, con iter fino all'eventuale referendum confermativo (art. 138) e abrogativo (art. 75); abrogazione ferma gli effetti in corso e conserva lo storico. `check-referendum-effects`.
- Territorio: confronto tra consultazioni locali e regionali; partiti senza dati documentati (es. Progetto Civico Italia) restano «non rilevata» e la pagina lo dichiara, senza inventare dati reali.
- `check-load`: misura la migliore di 3 prove (non dipende più dal carico della macchina).
- Regressione trovata dalla suite e corretta: nelle votazioni nominative i seggi vuoti (assenti) erano sempre i parlamentari meno fedeli, quindi i dissidenti risultavano più fedeli della media (`check-laws`). Ora gli assenti sono sorteggiati (`vote-engine.js`).
- Test adeguati al comportamento nuovo: `check-start-screen` (profilo pulito apre la scelta lingua: ora `language:'it'`), `check-poll-scenario` (il wizard ridisegna 220 ms dopo l'ultimo tasto).

**Suite completa (272 comandi, 3 in parallelo) e riesecuzioni seriali**
- Con la concorrenza sono falliti 21 comandi: porte occupate (EADDRINUSE), timeout Chrome, test pesanti. Rieseguiti in serie: passano account-deletion, admin-e2e, admin-parties, logo-sync, logout-careers, reload-advance, territory-legibility, campaign-countdown, campaign-layout, laws, start-screen, poll-scenario.
- Falliscono identici anche su `main` (preesistenti, non causati da questo lavoro): `check-presidency`, `check-promise-reminders`, `check-button-contrast` (contrasto in stato hover di `.primary-button`, 1,86:1), `check-campaign-ui` (Chrome non si avvia in questo contenitore).
- i18n-pages: causa trovata. La riga di governo delle notizie («{} ha la fiducia di # gruppi; … il margine nella Camera più stretta è di ±# seggi») compare solo quando la Camera è stretta: mancavano le frasi con margine (e con «di cui # dall’esterno»), quindi il controllo falliva solo nelle partite con quel margine. Aggiunte le frasi (+/−, con e senza esterni); il fallback frase-per-frase del traduttore resta come rete di sicurezza. Il controllo ora passa.
- Audit traduzioni sul gioco generato: chiuse le lacune vere (pagina referendum: fondi, firme, Consigli regionali; liste senza collocazione; «Strappo»; misure di Consiglio comunale/provinciale; uscita da un’intesa; date delle leggi in vigore; «Promesse verificate dai cittadini»). `check-i18n-audit`, `check-i18n-pages`, `check-i18n-offline`, `check-i18n` passano.
- `check-load` (rapporto tra richieste con e senza modulepreload): in un caso su tre fallisce se in parallelo ad altri processi (199 ms contro 360 ms); eseguito da solo passa. Il confronto resta sensibile al carico della macchina.

**Bloccato (verificato, non aggirato)**
- AAB: nessun Android SDK (`ANDROID_HOME` assente), `dl.google.com` non raggiungibile, nessuna chiave di upload nel repo. Non generato. `versionCode` 1 non verificabile su Google Play da qui: non modificato; AdMob e firma invariati.
- TEST Cloudflare: niente `wrangler.test.local.jsonc`, `.dev.vars` né credenziali; `wrangler.test.jsonc` ha solo segnaposto. Nessuna migrazione e nessun deploy; produzione intatta.
- `check-start-screen`: intermittenza preesistente (anche su `main`, 1 volta su 4; sul branch più spesso): il primo ricaricamento allo stesso indirizzo resta sulla schermata «Caricamento…» e la navigazione successiva lo completa. Causa non individuata (sembra il documento precedente che trattiene lo storage del browser). Il test ora ritenta una volta; passa 3/3. Da indagare prima della prossima AAB se si vuole escludere un blocco all'avvio con più schede aperte.
- Limiti noti: una sola battuta d'apertura per argomento per scena; le 44 attività contestuali riusano i 6 cast di scena.

## Aggiornamento 3 — lavoro residuale e preparazione al rilascio (build 20261118-35, branch `feature/inmobi-integrazione`)

Solo ciò che è nuovo rispetto agli aggiornamenti precedenti. `main` non è stato toccato; nessun merge, push o deploy.

### Nuove correzioni
- **Voti e Notte Elettorale, «Altri» contati due volte (causa alla radice).** `electorate.js` (`withVotes`): il resto non mostrato (`others:false`) resta come peso nascosto nella ripartizione, quindi la somma dei voti di lista non supera più i validi; `countProblems` accetta lo scarto atteso. `night-engine.js`: lo snapshot usa i voti validi canonici `result.electorate.ballots`, ripartisce liste + resto con `distributeVotes` e ricava «Altri» dal resto, non da una seconda formula. Test: asserzioni dirette su `result.electorate.ballots` (totali dello snapshot e della dodicesima ora = schede valide; Altri = schede − liste; un doppio conteggio artificiale viene distinto).
- **Alleanze.** `joinCamp` non perde più le iscrizioni precedenti (`coalitions`); l'invito a un partito già in coalizione ha due modi, «singolo» o «fusione completa» (`mode`), con anteprima `inviteImpact`; le iscrizioni concluse sono immutabili e riportano la composizione (`members`); le approvazioni ancora aperte vengono riverificate se la composizione cambia (nota nello storico).
- **Referendum.** Scadenze in mesi di calendario (`addMonths`, 3 mesi per richiesta e tra le due deliberazioni) invece di 13 settimane.
- **Falsi positivi `statuteBlock`.** Le leggi generate (famiglia) non sono più bloccate per errore; il controllo resta per i testi del giocatore.
- **Contrasto pulsanti (WCAG AA).** `.primary-button`/`.advance-button` in hover e il primario disabilitato ora superano la soglia (era 1,86:1).
- **Ascoltatori `change` duplicati** in `app.js` (6 ascoltatori) → registro unico `onChange`; invio dei moduli di fusione non più in linea (CSP).
- **Effetti locali del territorio.** `localLeanOf`/`effectsFromHome` e ripartizione esatta dei resti: candidato e campagna incidono sul risultato locale, con somme conservate. Copertura: **7.894 comuni** nella gerarchia reale; i **5.075** sono solo i campioni dei test.
- **Tutorial.** Esercizi pratici non distruttivi (ruolo, attività, voto, notizie) verificati dallo stato dell'interfaccia; nessun giorno, denaro o capitale consumato.
- **Animazioni delle scene.** Gesti ed espressioni variati dal seme per apertura e domande; entrata morbida delle battute solo con `prefers-reduced-motion: no-preference`.
- **Pubblicità: InMobi unico fornitore** (vedi `docs/qa/rapporto-inmobi.md`): configurazione remota `ADS_CONFIG` (tutto spento di default, modalità test), crediti premio validati dal Worker, UMP solo per il consenso. Nessun annuncio reale attivo.
- **Wrangler 4 / Worker locale:** costanti spostate in `worker-constants.js` (il modulo principale esporta solo funzioni).
- **i18n:** frasi inglesi per tutorial, alleanze, effetti locali.

### File modificati (principali)
`src/core/electorate.js`, `src/core/night-engine.js`, `src/core/world-engine.js`, `src/core/store.js`, `src/core/referendum-engine.js`, `src/core/parliament-engine.js`, `src/core/lawmaking-engine.js`, `src/core/territory-results.js`, `src/core/activity-scenes.js`, `src/ui/app.js`, `src/ui/tutorial.js`, `src/theme.css`, `src/sections.css`, `src/scene.css`, `src/data/ads-config.js`, `src/data/repositories/*`, `src/data/release-pairs.js`, `worker.js`, `worker-constants.js`, `plugins/inmobi-ads/**`, `scripts/lib/browser.mjs`, test `check-election-night-engine`, `check-coalition-invites`, `check-referendum`, `check-statutes`, `check-tutorial-tasks`, `check-territory-results`, `check-inmobi*`, `check-local-test-mode`, e2e territorio/ranking.

### Test (PASS / FAIL / SKIPPED)
- **PASS:** check-election-night-engine, check-coalition-invites, check-referendum, check-statutes, check-tutorial-tasks, check-territory-results, check-button-contrast, check-start-screen, check-regional-ranking, check-guide, check-i18n (+ offline, pages, audit), check:inmobi, check:inmobi-native, check:capacitor, check:android, check:publication, check:security, check:legal.
- **FAIL, identici su `main` (preesistenti):** check-presidency, check-promise-reminders, check-territory-legibility (selettori obsoleti), check-election-night-language (timeout), check-load se in parallelo.
- **SKIPPED / non eseguibile qui:** check-campaign-ui (Chrome chiude la connessione websocket in questo contenitore; il difetto reale dei 6 ascoltatori è stato corretto), build Gradle/AAB, build Xcode/IPA, prove su dispositivo (UMP, annuncio premiato), `check:legal -- --release` (13 voci a carico del titolare).
- Nessun test dichiarato risolto solo perché passato al secondo tentativo.

### Screenshot (`artifacts/qa/screenshots/after/`)
`pulsante-primario-hover-1280.png`, `guida-percorsi-390.png`, `tutorial-esercizio-390.png`, `referendum-390.png`, `sondaggi-osservatorio-1280.png`.

### Problemi residui
- Schermata «Caricamento…» intermittente: **non riprodotta** (28 ricaricamenti, anche sotto carico); causa **non dimostrata**, resta solo la mitigazione già presente.
- Programma di Progetto Civico Italia: **non completato**; il sito ufficiale non è raggiungibile da qui e non è stato inventato nulla.
- Animazioni: le 44 attività contestuali riusano ancora i 6 cast di scena.
- Candidatura a vice-consigliere: non riproducibile senza il salvataggio del titolare.
- Statistiche, popup recensione su Google Play, `versionCode` ultimo pubblicato: dipendono dal titolare/dal dispositivo.

### Prerequisiti esterni
Chiave di upload e Android SDK per l'AAB; `versionCode` ultimo su Play; macOS/Xcode per archivio iOS (iOS 1.0 (1) invariato: Bundle ID, Team, firma, versione, nessuna pubblicità); ID InMobi di placement e conferma dell'Account ID dal pannello InMobi; credenziali e risorse Cloudflare TEST (`wrangler.test.local.jsonc`, `.dev.vars`, D1/KV/R2, Access): non presenti → **nessun deploy TEST eseguito**; decisioni legali del titolare (13 voci).

### Preparazione Android
Progetto coerente (`it.matteobianchi.politicando2026`, versionCode 1 / «1.0», permesso `INTERNET`), copia web sincronizzata (`cap sync android`), meta-data AdMob rimosso, plugin InMobi collegato; `check:android` e `check:capacitor` passano. **AAB non generato**: mancano SDK e chiave; pubblicità reali spente.
