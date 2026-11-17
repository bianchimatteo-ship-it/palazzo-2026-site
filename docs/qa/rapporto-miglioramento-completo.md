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
