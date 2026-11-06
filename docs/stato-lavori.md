# Stato dei lavori — evoluzione di POLITICANDO 2026

Documento sintetico: cosa è stato fatto, le decisioni tecniche, cosa resta. Aggiornato a ogni milestone.

## Milestone 1 — Notte Elettorale (completata)

**Cosa fa.** Al termine di ogni voto giocato dal giocatore (comunali, provinciali, regionali, politiche, europee) il gioco entra in una schermata dedicata di **dodici ore** consecutive, avanzabili una alla volta con un pulsante. Il tempo della carriera è sospeso: `advance`, `advanceToDate`, `fastForwardToElection` e le azioni di campagna rifiutano di muoversi finché la notte non è conclusa. Con il ballottaggio ci sono due notti: la prima termina con i finalisti e apre la campagna del ballottaggio; la seconda dà l'esito.

**Dove sta il codice.**
- `src/core/night-engine.js` — motore puro e deterministico. Nessun secondo motore di voto: parte dal risultato già calcolato da `election-engine.js` (copiato in uno *snapshot* all'apertura).
- `src/core/store.js` — `state.night`, `state.nightsHeld`, `openNightFor`, `advanceElectionNight`, `answerElectionNight`, `concludeElectionNight`. La carriera viene toccata **una sola volta**, alla conclusione (`closeCampaign` come prima della notte).
- `src/ui/election-night.js` + `src/night.css` — la schermata (speciale televisivo con i token e i componenti del gioco).
- `src/ui/app.js` — a tutto schermo quando c'è `state.night`; il menu resta raggiungibile.
- Impostazione «Notte Elettorale» (da giocare / salta) in `src/core/settings.js`.

**Decisioni tecniche.**
- *Unità di scrutinio simulate*: il gioco non ha le sezioni reali. I voti dei gruppi sono ripartiti (resto maggiore) fra i territori e poi fra le unità, in modo che per ogni gruppo la somma delle unità sia **esattamente** il voto del motore. L'ordine di scrutinio e le dimensioni derivano da un hash del seme: nessuna casualità consumata, la sequenza casuale della campagna non si tocca.
- *Altri*: nel voto di lista il motore dà le percentuali sul totale dei voti validi (compresi gli «Altri»); la notte aggiunge un gruppo «Altri» con i voti che fanno tornare quelle percentuali.
- *Curva dello scrutinio e ora di chiusura* per tipo di voto (politiche/europee 23:00, comunali/regionali 15:00, provinciali 20:00, ballottaggio 15:00); la prima ora è l'exit poll (scrutinio non iniziato).
- *Exit poll, sondaggi, proiezioni, risultati ufficiali* sono sempre distinti nei testi e nei colori. Le proiezioni completano le unità non ancora contate con l'exit poll (mai con le unità future) e hanno un margine che si restringe; le stime sui seggi applicano la **regola di assegnazione reale** del tipo di voto (D'Hondt, premio di maggioranza, ecc. da `election-engine.js`) ai voti dell'ora, senza conoscere i seggi finali; all'ultima ora la proiezione coincide con il risultato ufficiale.
- *Notizie*: generate una volta all'arrivo dell'ora e salvate (id stabili): salvataggio e ripresa a metà non duplicano nulla. Derivano dai dati: sorpasso, soglia, rimonta, maggioranza, ballottaggio, territori decisivi.
- *Dichiarazioni del giocatore* (ore 3, 7, 11): registrate una volta; la più recente entra nella memoria politica alla conclusione. Nessun altro effetto sul gioco.
- *Test e vecchi salvataggi*: la notte è attiva solo se l'interfaccia la attiva (`store.setElectionNightLive`) e il giocatore non l'ha spenta; gli script che usano il motore o lo store direttamente chiudono la campagna subito, come prima. I test browser precedenti impostano `__noElectionNight` (default di `withBrowser`; `night: true` per chi la vuole). I salvataggi senza `night` funzionano senza migrazione.

**Verifiche.** `check-election-night-engine` (somme, crescita, risultato finale = motore, determinismo, salvataggio a metà), `check-election-night-ui` (Chrome: 12 ore, tempo fermo, schede, ricarica a metà, salvataggio su file, conclusione unica, ballottaggio, 320/390/768/1440 px), `check-election-night-language` (inglese completo, ritorno all'italiano identico).

**Resta da fare / limiti noti.**
- Prove su emulatore/dispositivo Android e nell'app Capacitor: non eseguite in questo ambiente (nessun emulatore); sono state fatte solo l'emulazione mobile di Chrome (320/390 px) e le misure di layout.
- La mappa geografica è disegnata solo per le consultazioni con territori regionali; per le altre c'è il cartogramma a riquadri.
- Le dichiarazioni dei leader sono modelli generici legati alla situazione (non frasi di persone reali).

## Milestone 1b — Notte Elettorale: completamento
Proiezioni dell'ultima ora = risultato ufficiale; le due notti (primo turno e ballottaggio) sospendono ogni effetto sulla carriera (guardia globale dello store su `state.night`/`state.scene`); animazioni ridotte/spente applicate a tutta la schermata; esito finale con la card di vittoria/sconfitta (coriandoli solo per la vittoria) dopo il risultato, tono dall'esito reale; corretto un bug reale (il giocatore eliminato al primo turno risultava «escluso»). Test: `check-election-night-engine`, `-ui`, `-language`.

## Milestone 2 — Programma e promesse
`src/core/program-engine.js` (puro) + `store.programView/makePromise/modifyPromise/withdrawPromise/announcePromise`; UI `src/ui/program-view.js` (tab «Programma» in Elezioni). Riusa `party.program` (proposte del partito), `game.promises` (kind «programma»), gli impegni di coalizione (`accordPromises`) e il programma di Governo (`setGovernmentProgram` ricava le priorità dalle promesse e crea promesse di governo). Stati: non avviata, in corso, mantenuta, parzialmente mantenuta, ritardata, modificata, non mantenuta; verificate ogni settimana su leggi approvate, disegni di legge e indicatori; conseguenze (reputazione, popolarità, memoria, alleati) applicate una sola volta. In campagna l'attività «Presenta agli elettori» alimenta il tema. Test: `check-program`, `-store`, `-ui`.

## Milestone 3 — Governo e ministri
`src/core/cabinet-life-engine.js`: competenza, lealtà, ambizione, rapporto con premier e partito, valutazione periodica, riunioni, conflitti, richieste di sostituzione, crisi ministeriali, rimpasti con conseguenze; estende `parliament.government` (campo `life`), non lo sostituisce. UI `cabinet-life-view.js` nella sezione Governo. Test: `check-cabinet-life`, `-ui`.

## Milestone 4 — Diplomazia e UE
`src/core/diplomacy-engine.js` (`state.diplomacy`): paesi, relazioni con storico, bilaterali e vertici, negoziati e trattati, crisi, istituzioni UE, conseguenze economiche e politiche (`applyDiplomacyEffects`); pagina «Diplomazia». Test: `check-diplomacy`.

## Milestone 5 — Scene interattive e dibattiti TV
`src/core/scene-engine.js` (motore riusabile, `state.scene`, salvabile e riprendibile) + `src/ui/scene-view.js` + `src/scene.css`; SVG/CSS 2D; l'avatar del giocatore è quello scelto a inizio carriera (`avatarOf`), gli altri personaggi hanno avatar stabili da seme; dialoghi a bivi con conseguenze su sondaggi, consenso, relazioni, media; argomenti legati a programma/eventi; resa da competenza, carisma, preparazione, reputazione, coerenza; funziona con animazioni attive o spente. Collegata alla campagna («Entra in studio»). Test: `check-scene`, `-ui`.

## Milestone 6 — Eventi e rivali
`src/core/rival-life-engine.js` + `src/data/simulation/rival-life-rules.js`: i rivali già incontrati (`game.rivalRegistry`, stessa memoria e personalità delle campagne) agiscono tra una campagna e l'altra — attacco, mano tesa, sfida su un tema del programma del giocatore, rivincita — come eventi di agenda con scelte reali; la risposta è ricordata nel registro (memoria, rapporto) e ricompare nella campagna successiva. Test: `check-rival-life`. Limite: nessuna schermata dedicata ai rivali (le mosse passano dall'agenda).

## Milestone 7 — Scenari e sfide
`src/core/challenge-engine.js` (sopra `objective-engine`: stessa misura, più confronto con il giorno di accettazione e scadenza); 7 sfide (cento giorni, parola data, sotto i riflettori, partito diviso, rete di alleati, legislatore, governo che regge) con condizione di partenza, obiettivi, limiti, premio/penalità e card di esito; UI `challenge-view.js` nella scheda «Obiettivi» di Carriera. Gli scenari di inizio carriera (`scenario-engine`) restano quelli esistenti. Test: `check-challenges`.

## Milestone precedente — fondazione partito, consenso, fiducia, direttiva (completata)
Vedi la cronologia git (commit `7fbae22`, `8842e95`).

## Limiti noti complessivi
- Nessuna prova su emulatore/dispositivo Android né nell'app Capacitor: solo emulazione mobile di Chrome (320/390/768/1440 px).
- Il deploy su Cloudflare non è verificabile da questo ambiente.
- Le mappe della notte sono geografiche solo per i voti con territori regionali; altrove cartogramma.
- Dichiarazioni, rivali ed eventi sono modelli simulati, non frasi di persone reali.

## Problemi noti non legati a queste modifiche
- `check-annual-elections` (caso `regionale/b`): fallisce già sul commit `1480b52`, prima del lavoro di questa sessione.
- `check-load` (162 moduli > 150), `check-chart-contrast`, `check-campaign-ui` (crash di Chrome), `check-start-screen`: falliscono già sul codice di partenza.
