# POLITICANDO 2026

Una carriera nella politica italiana.

Fondamenta per una simulazione gestionale della politica italiana. La versione corrente è una demo navigabile: i contenuti dimostrativi sono etichettati come simulazione e non sono presentati come cronaca o dati politici reali.

## Avvio

Richiede Node.js 18 o successivo, senza dipendenze esterne.

```sh
npm start
```

Apri `http://127.0.0.1:4173`. La carriera viene salvata nel `localStorage` del browser in uso. Le vecchie partite demo vengono aggiornate automaticamente al nuovo schema al primo avvio. Il comando “Avanza di 1 settimana” aggiorna la data, genera una voce di agenda simulata e salva la carriera.

## Pubblicazione automatica

Il sito statico può essere pubblicato da GitHub Pages scegliendo il ramo `main` e la cartella `/` nelle impostazioni Pages del repository. Ogni push su `main` aggiorna automaticamente il sito.

## Struttura

- `src/data/schema.js` definisce tipi di provenienza, campi canonici e validazione per politici, partiti, elezioni, territori, incarichi, statistiche, eventi, leggi e Camere.
- `src/data/demo.js` crea la carriera dimostrativa. Nomi e indicatori in questo file sono inventati per la demo.
- `src/core/store.js` gestisce stato, migrazione del salvataggio, navigazione, calendario e creazione atomica della carriera.
- `src/core/career-rules.js` centralizza validazione e regole dei passaggi della procedura guidata.
- `src/data/regions.js` definisce regioni, livelli e statistiche iniziali deterministiche.
- `src/ui/career-wizard.js` compone la procedura guidata per profilo, livello, partito e riepilogo.
- `src/core/storage.js` incapsula il salvataggio versionato nel browser.
- `src/core/time.js` raccoglie funzioni riusabili per data e calendario.
- `src/ui/app.js` compone dashboard e viste navigabili; `src/styles.css` contiene il sistema visuale responsive.
- `server.mjs` serve i file statici usando solo API integrate di Node.

## Provenienza dei dati

Ogni entità dati porta `source`: `real`, `simulation` o `user`. Le informazioni reali dovranno essere inserite da un dataset verificato e citabile; il campo `verified` consente di distinguere istituzioni predisposte da dati già verificati. Non è incluso un dataset di politici, partiti, sondaggi o risultati elettorali reali.

Le gerarchie territoriali includono comune, provincia, città metropolitana, regione e stato; le Camere sono già rappresentate nello schema. Il modello rimane volutamente leggero per poter introdurre repository dati e simulazioni più ricche senza legare lo stato alla UI.
