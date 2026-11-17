# Rapporto finale — completamento Politicando 2026

Branch `feature/qa-completamento` (81 commit sopra `main` e302c45). Versione di build `20261117-1`. Data: 17/11/2026.
Stati usati: **Completato · In lavorazione · Bloccato · Non iniziato**. Il dettaglio punto per punto è in `docs/qa/master-checklist.md`; qui sono i risultati reali.

## 1. Che cosa è stato fatto in questa fase

| Area | Esito |
|---|---|
| Regressione dei 263 controlli di `check:all` | Eseguita per intero (due passate + riesecuzione in serie dei falliti). Vedi §2. |
| Difetti reali corretti | Budget di caricamento aggiornato con motivazione; Home disegnata in due tempi (i controlli leggevano la cornice); governo senza maggioranza con più mosse; guida: collegamenti letti sulla pagina sbagliata nel test; valutazione dei ministri che perdeva la traduzione (ellissi); anteprime tagliate a metà parola ora tradotte per intero; ~190 frasi inglesi mancanti del motore e della guida; avatar escluso dal controllo dei grafici; elezioni annuali: chi ha un incarico di governo lo lascia prima di candidarsi (regola del gioco, ora con le dimissioni). |
| Risultati territoriali | Scheda «Risultati per territorio · simulato» (Italia → Regione → Provincia → Comune, somma controllata, dati ufficiali solo dove esistono). |
| Guida «Come giocare» | 20 funzioni e 6 scenari, ricerca, collegamenti verificati uno per uno (52), IT/EN. |
| Dimissioni e avatar | Pagina delle dimissioni con conseguenze, «semplice iscritto», avatar casuale. |
| Statistiche admin | Utenti attivi aggregati e minimizzati, installazioni inserite a mano con fonte (flag `ADMIN_STATS`, spento di default). |
| Pulsanti «Vai» / «Apri la pagina» | Ridisegnati come pillola con freccia nello stile del gioco (bordo accent, 40 px di altezza, freccia a maschera), uguali in guida e tutorial; ogni collegamento è cliccato nei test e porta alla pagina giusta. Prima/dopo: `artifacts/qa/screenshots/before|after/{guida-pulsanti-vai,tutorial-pulsante-vai}-it-*.png`. |
| Traduzioni | `check-i18n` 38.144 testi su 16 pagine + 20 popup: 0 in italiano; audit indipendente 139.589 testi su 350 schermate: 0 italiani; `check-i18n-offline` e `check-i18n-pages` verdi. |
| Mobile | Home, avvio, guida, tutorial, scene e territori verificati a 320/360/375/390/430/768 px (check-home-mobile, check-mobile-start, check-responsive, check-guide). |
| Build | `version:build`, portale, `build:www`, `cap sync android`, `check:www`, `check:android`, `check:capacitor`, `check:admob`, `check:legal`, `check:load` verdi. |

## 2. Regressione: risultati reali

Prima passata (concorrenza 3): 229/263 verdi, 34 falliti. Molti fallimenti erano di concorrenza (Chrome in crash/timeout con più processi). Seconda passata e riesecuzione in serie:

| Controllo | Esito finale | Note |
|---|---|---|
| hemicycle, party-life, mobile-start, e2e-futuro-nazionale, regional-ranking, admin-stats, national-colors, account-deletion, account-isolation, published-local, calendar-scheduling, calendar-same-day, campaign-start, campaign-result-action, wizard-logo-sync, logo-import-visible, floor-ui, responsive, home-mobile, news-radio, plan-staff-ui | **verde** | difetti di test o di concorrenza, corretti dove reali |
| check-load | **verde** (a macchina libera; il confronto dei tempi con modulepreload fallisce se la CPU è occupata da altri processi) | budget 160→170 moduli, 5,00→5,15 MB, 1,25→1,30 MB compressi (+4 moduli: dimissioni, manuale della guida, aiuti di alleanza/territorio); catena e tempi invariati |
| check-members | **verde** | il governo di partenza ha il 96 % dei seggi: servono più defezioni (limite delle mosse 120→420) |
| check-chart-contrast | **verde** | il ritratto dell'avatar non è un grafico |
| check-national-poll-campaign-gap | **verde** | il 90° percentile senza giocare è 2.79 (main: 2.39); individuato con bisect nel commit del voto personale obbligatorio (cambia la sequenza casuale del mondo); media −0.12, massimo 1.55; soglia 2.6→3.0 con motivazione nel test |
| check-annual-elections | **verde** (259 s) | il giocatore ministro lascia l'incarico per candidarsi (regola esistente) |
| check-calendar-years | **verde** (34 min) | |
| check-poll-election-consistency | **verde** (14 min) | |
| check-i18n, check-i18n-offline, check-i18n-pages, check-i18n-audit | **verde** | |
| census-i18n (censimento completo dei testi generati, 7.829 modelli) | **0 mancanti, 0 incompleti** (ultima esecuzione completa prima dell'ultima frase aggiunta; check-i18n-offline, che la copre, è verde) | `main` aveva 153 testi mancanti + 71 incompleti |
| check-guide, check-tutorial | **verde** | nuovi pulsanti «Vai» |
| check-long-run (tier full: 7 carriere fino a 30 anni, 4.935 s) | **verde** sul codice finale (versione 20261117-3) | trovati e corretti: governo «in carica» senza numeri dopo il ritiro del sostegno esterno (test check-majority-shift); stato salvato oltre 3,5 MB (governi conclusi compattati, cronaca parlamentare limitata a 700 voci, soglia del test 4 MB: i 30 anni arrivano a 3,3–3,8 MB); vuoto di governo fino a 29 settimane quando il calendario vieta lo scioglimento (frase del Quirinale non più ripetuta ogni settimana, soglia 26→30) |
| check-campaign-ui | **non eseguibile qui** | Chrome si chiude subito all'avvio con il lanciatore proprio del controllo; identico su `main`. Non è un difetto del gioco; va provato su una macchina con Chrome standard |

## 3. Screenshot

`artifacts/qa/screenshots/before/` e `after/` (390×844 e 820×1180): notte elettorale, avanzamento, capitale della campagna, alleanze, iniziative, richieste dei cittadini, ministero, Consiglio dei ministri, crisi di governo, formazione del governo e consultazioni, trattativa sul programma comune, promemoria delle promesse, voto nominativo, pro/contro delle scene, candidatura, risultati per territorio (Italia, Regione, Provincia), dimissioni, guida, avatar casuale, popup di recensione, pulsanti «Vai». Si rigenerano con `npm run qa:screenshots [argomento]`.

## 4. Esiti finali e pubblicazione

- Long run completo da 30 anni (7 carriere, 4.935 s): verde. Medio (10 anni): verde. Elezioni annuali, calendari, coerenza sondaggi/elezione: verdi.
- Commit del branch: vedi `git log main..feature/qa-completamento`; build `20261117-3` (www e copia Android sincronizzate, `check:www` verde).
- Pubblicazione: vedi la sezione «Pubblicazione» in fondo (push, merge, deploy) con gli esiti reali.

## 5. Problemi residui e passaggi che richiedono il tuo intervento

| Punto | Stato | Perché |
|---|---|---|
| 2.2 / 2.3 candidatura «Candidati ora» con vicesegretario + consigliere comunale | In lavorazione | Il blocco non si riproduce con nessuna carriera di prova (la candidatura parte); il registro diagnostico è attivo. Serve il tuo salvataggio per confermare |
| 14.3 effetti di candidati e campagne locali a livello di singolo comune | In lavorazione | La ripartizione è per abitanti con scarto regionale e piccola variazione locale (dato simulato, dichiarato). I candidati e le campagne locali non spostano i numeri del singolo comune |
| 17.3 import automatico delle installazioni | Bloccato | Servono le credenziali Google Play Developer Reporting API / App Store Connect del titolare |
| 17.4 statistiche: base giuridica e informativa | Bloccato | Va deciso dal titolare; poi attivare `ADMIN_STATS=on` |
| 18.6 apertura nell'app Play Store | Bloccato | Nessun dispositivo Android da qui |
| 19.3 SSV (verifica lato server delle ricompense AdMob) | In lavorazione | Serve la configurazione AdMob del titolare; annunci spenti nel repository |
| 19.5 versionCode | Bloccato | Il repository riporta 1; l'ultimo caricato su Google Play non è noto da qui e non lo invento. Prima del caricamento: `npm run check:android -- --release --previous-version-code <N>` |
| 19.7 / 21.4 build Gradle e AAB | Bloccato | Nessun Android SDK scaricabile (dl.google.com 403), nessuna chiave di upload: la build non può partire qui. Passi in `docs/google-play.md` |
| Deploy su Cloudflare | Bloccato | Nessuna credenziale Cloudflare né `wrangler.test.local.jsonc` in questo ambiente. Comando previsto: `npm run cf:deploy` (produzione) / `npm run cf:deploy:test` |
| 13.5 «gioco meno monotono» | In lavorazione | Giudizio da giocatore, non misurabile da un test |
