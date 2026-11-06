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
- *Exit poll, sondaggi, proiezioni, risultati ufficiali* sono sempre distinti nei testi e nei colori. Le proiezioni completano le unità non ancora contate con l'exit poll (mai con le unità future) e hanno un margine che si restringe; le stime sui seggi usano i seggi del motore come calibrazione, dichiarato come semplificazione.
- *Notizie*: generate una volta all'arrivo dell'ora e salvate (id stabili): salvataggio e ripresa a metà non duplicano nulla. Derivano dai dati: sorpasso, soglia, rimonta, maggioranza, ballottaggio, territori decisivi.
- *Dichiarazioni del giocatore* (ore 3, 7, 11): registrate una volta; la più recente entra nella memoria politica alla conclusione. Nessun altro effetto sul gioco.
- *Test e vecchi salvataggi*: la notte è attiva solo se l'interfaccia la attiva (`store.setElectionNightLive`) e il giocatore non l'ha spenta; gli script che usano il motore o lo store direttamente chiudono la campagna subito, come prima. I test browser precedenti impostano `__noElectionNight` (default di `withBrowser`; `night: true` per chi la vuole). I salvataggi senza `night` funzionano senza migrazione.

**Verifiche.** `check-election-night-engine` (somme, crescita, risultato finale = motore, determinismo, salvataggio a metà), `check-election-night-ui` (Chrome: 12 ore, tempo fermo, schede, ricarica a metà, salvataggio su file, conclusione unica, ballottaggio, 320/390/768/1440 px), `check-election-night-language` (inglese completo, ritorno all'italiano identico).

**Resta da fare / limiti noti.**
- Prove su emulatore/dispositivo Android e nell'app Capacitor: non eseguite in questo ambiente (nessun emulatore); sono state fatte solo l'emulazione mobile di Chrome (320/390 px) e le misure di layout.
- La mappa geografica è disegnata solo per le consultazioni con territori regionali; per le altre c'è il cartogramma a riquadri.
- Le dichiarazioni dei leader sono modelli generici legati alla situazione (non frasi di persone reali).

## Milestone precedente — fondazione partito, consenso, fiducia, direttiva (completata)
Vedi la cronologia git (commit `7fbae22`, `8842e95`).

## Prossime milestone (ordine di lavoro)
3. Programma elettorale e promesse (da integrare con programmi di partito, impegni di coalizione e di Governo già presenti).
4. Motore delle scene interattive e primo dibattito televisivo con avatar SVG (riusando `avatar-svg.js` e l'avatar del giocatore salvato a inizio carriera).
5–9. Eventi/avversari, Governo e ministri, diplomazia, scenari e sfide, espansione grafica.

## Problemi noti non legati a queste modifiche
- `check-annual-elections` (caso `regionale/b`): fallisce già sul commit `1480b52`, prima del lavoro di questa sessione.
- `check-load` (162 moduli > 150), `check-chart-contrast`, `check-campaign-ui` (crash di Chrome), `check-start-screen`: falliscono già sul codice di partenza.
