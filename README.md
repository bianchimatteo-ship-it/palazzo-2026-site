# POLITICANDO 2026

Una carriera nella politica italiana.

Fondamenta di una simulazione gestionale della politica italiana. I dati reali, quelli generati dalla simulazione e quelli creati dall’utente restano separati. Lo snapshot reale è riferito al **22 settembre 2026**; i campi senza una fonte sufficiente rimangono `null`.

## Avvio

Richiede Node.js 20 o successivo, senza dipendenze esterne.

```sh
npm start
```

Apri `http://127.0.0.1:4173`. La carriera viene salvata nel `localStorage` del browser in uso. Il comando “Avanza di 1 settimana” aggiorna la data e registra un’attività simulata.

## Modalità campagna

La sezione **Elezioni** avvia una campagna giocabile. Ogni elezione usa un modello distinto (comunale, regionale, politiche o europee), una scadenza, risorse limitate, attività con costi e rischi, consenso territoriale inerziale, candidati interni simulati, avversari con priorità autonome, eventi contestuali, trattative e uno scrutinio che aggiorna la carriera.

Le candidature in partiti esistenti devono superare una selezione interna. Una candidatura parlamentare in carica può perdere sostegno o posizione e non ha il rinnovo garantito. Attività, avversari, consenso, risorse, alleanze, risultati e impatti sulla carriera sono salvati con `source: "simulation"`; un partito reale resta solo un riferimento al proprio ID e non viene modificato. Le schede reali di partiti e politici continuano a mostrare esclusivamente i campi documentati e le fonti disponibili.

I risultati contano schede normalizzate su 100.000 elettori simulati. Quote, seggi e territori sono uno scenario di gioco, non risultati o sondaggi reali e non costituiscono un calcolo legale. Il modello europeo applica la soglia del 4% documentata per le elezioni europee; circoscrizioni e quote di gioco restano simulate. Le regole regionali variano da regione a regione, perciò l’allocazione regionale è dichiarata semplificata. La modalità dei sondaggi non è ancora implementata: il motore espone un hook non collegato.

Il database attuale non contiene un collegamento verificato tra tutti i partiti e i risultati elettorali storici: i numeri di consenso delle campagne non possono quindi essere inizializzati come fatti reali. Le affiliazioni prive di fonte restano `null` e la campagna non deduce il partito da un gruppo parlamentare o da una lista.

Verifica il flusso completo (candidatura, attività, eventi, alleanze, modelli, scrutinio e salvataggio) con:

```sh
npm run check:campaign
```

## Carriera parlamentare, governo e leggi

Il Career Wizard offre quattro percorsi: Comunale, Regionale, Deputato e Senatore. Per Deputato e Senatore si sceglie esplicitamente un gruppo reale della Camera o del Senato: Camere e gruppi sono riferimenti verificati in sola lettura, mentre il seggio del giocatore, le consistenze dello scenario e ogni conseguenza sono `source: "simulation"`. Partito e gruppo restano distinti.

La sezione **Parlamento** mostra la composizione di scenario delle due Camere, il capitale politico (che si rigenera con il tempo), gli incarichi interni conquistabili (responsabile, vicepresidente e presidente di commissione) e il cambio di gruppo. **Governo** gestisce coalizione su entrambe le Camere, sostegni esterni, ministri (anche il giocatore, se il suo gruppo è in maggioranza), fiducia, crisi e caduta. **Leggi** segue l’iter proposta → commissione → emendamenti → voto → altra Camera → voto finale, con trattative e voto forzato. Incarichi e ministeri compaiono nello storico della carriera; un seggio vinto in campagna apre il mandato, una sconfitta da uscente lo chiude e fa decadere le proposte in esame. I salvataggi precedenti vengono completati al caricamento; un salvataggio illeggibile viene conservato a parte.

```sh
npm run check:parliament
```

## Dataset reale

Snapshot verificato al 22 settembre 2026:

- **69 partiti** e **2 movimenti politici**, 71 entità complessive;
- **6 entità** con livello regionale/territoriale e regione documentati;
- **604 parlamentari in carica**: 399 deputati e 205 senatori;
- **22 gruppi parlamentari**: 13 alla Camera e 9 al Senato;
- **4 figure politiche** e **4 incarichi di partito** collegati tramite ID stabili, verificati sull’organigramma ufficiale di Futuro Nazionale;
- **674 appartenenze** ai gruppi parlamentari;
- **613 incarichi** parlamentari importati;
- **13 etichette** di lista elettorale e **268 relazioni** tra candidati, liste e consultazioni;
- **23 territori**: Italia, 20 regioni, Camera e Senato;
- **2 consultazioni**: elezioni politiche 2022 ed europee 2024.

Il dataset non attribuisce automaticamente i parlamentari ai partiti: Camera e Senato documentano gruppi e liste d’elezione, che possono aggregare realtà diverse. Perciò il numero di partiti parlamentari e non parlamentari non viene stimato. Anche presenza locale, appartenenze individuali ai partiti, colore, orientamento, data di fondazione e cariche non documentate restano non valorizzati. La presenza regionale viene indicata solo per le formazioni con una fonte istituzionale o del partito adeguata; un gruppo consiliare non è convertito in un gruppo parlamentare nazionale né in appartenenze individuali.

Futuro Nazionale è incluso come partito sulla base delle sue pagine ufficiali di trasparenza e organigramma. La componente della Camera con un nome simile resta un’entità parlamentare distinta: non è usata per dedurre l’iscrizione al partito di ogni componente.

## Fonti

- [Parlamento italiano — Registro nazionale dei partiti politici](https://www.parlamento.it/Parlamento/1063), deliberazioni d’iscrizione e cancellazione;
- [MEF — dati 2 per mille](https://www1.finanze.gov.it/finanze/2xmille/public/index.php?aggiornato=1522252800&export=1&page=1&tree=2025AADUEXM0101), dichiarazioni 2025/redditi 2024;
- [Camera dei deputati — schede della XIX legislatura](https://www.camera.it/deputati/elenco) e [composizione dei gruppi](https://www.camera.it/leg19/217);
- [Senato — dati aperti sulla composizione](https://dati.senato.it/sito/composizione?legislatura=19&testo_generico=11);
- [ISTAT — codici territoriali](https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/);
- [Ministero dell’Interno — trasparenza elezioni europee 2024](https://dait.interno.gov.it/elezioni/trasparenza/elezioni-europee-2024) e [archivio storico elettorale](https://www.interno.gov.it/it/temi/elezioni-e-referendum/dato-storico-elezioni);
- [Futuro Nazionale — sito](https://futuronazionale.it/), [trasparenza](https://futuronazionale.it/trasparenza/), [organigramma](https://futuronazionale.it/organigramma/) e [logo ufficiale](https://futuronazionale.it/il-logo/);
- fonti territoriali ufficiali: [PATT](https://patt.tn.it/), [Südtiroler Volkspartei](https://www.svp.eu/de/partei-883.html), [Stella Alpina](https://www.stella-alpina.org/), [Union Valdôtaine](https://www.unionvaldotaine.org/), [Campobase](https://www.campobasetrentino.it/), [Sud chiama Nord](https://sud-chiamanord.it/), insieme alle pagine ufficiali dei rispettivi consigli regionali/provinciali e dell’Assemblea regionale siciliana riportate nelle schede.

Le fonti sono collegate direttamente alle schede. Ogni record reale contiene `source: "real"`, `verified: true`, `sourceUrl`, `sourceName` e `verifiedAt`; validità temporale e date di ingresso/uscita sono valorizzate quando la fonte le documenta.

## Struttura e caricamento

- `src/data/real/`: snapshot reale suddiviso in JSON per collezione, con `manifest.json`; `database.json` è conservato per controllo ed esportazione;
- `src/data/simulation/`: contenuti dimostrativi separati;
- `src/data/user/`: punto d’ingresso per i contenuti creati durante la carriera;
- `src/data/repositories/`: repository e caricamento delle collezioni; la UI non importa direttamente i file JSON;
- `src/data/real/party-leaderships.json`, `political-figures.json`, `group-memberships.json`, `party-memberships.json`, `office-history.json` e `parliamentary-group-history.json`: relazioni e storico separati, legati con ID;
- `src/data/real/assets/logos/`: loghi reali verificati e inclusi nel progetto;
- `src/data/repositories/logo-store.js`: loghi aggiunti dal gestore locale, conservati in IndexedDB del browser e mai presentati come fonti reali;
- `scripts/import-real-data.mjs`: importer ripetibile delle fonti;
- `scripts/validate-real-data.mjs`: controlli su provenienza, duplicati, relazioni, conteggi e assenza di statistiche reali inventate;
- `scripts/check-published-site.mjs`: controllo diretto della versione pubblicata su GitHub Pages, inclusa la corrispondenza dei file remoti con lo snapshot locale;
- `src/core/campaign-engine.js` e `src/core/election-engine.js`: stato e risoluzione delle campagne, separati dal database reale;

All’apertura vengono caricati manifest e partiti/movimenti. Politici, gruppi e altri dettagli vengono richiesti quando si apre il relativo archivio, così il browser non scarica il JSON aggregato da circa 2 MB.

## Aggiornamento e verifica

Dalla cartella del progetto:

```sh
npm run import:real-data
npm run check:real-data
npm run check:published-site
```

L’importatore scarica fonti pubbliche e riscrive esclusivamente `src/data/real/`. Impostare `AS_OF` alla data effettiva di verifica e aggiornare il numero versione del dataset nello script. Prima di pubblicare, controllare il diff e il risultato del validatore.

`check:published-site` interroga l’URL GitHub Pages, controlla tutti i JSON pubblici e verifica che corrispondano ai file presenti nella working tree. Va eseguito dopo che GitHub Pages ha terminato la pubblicazione.

## GitHub Pages

Il sito statico è pubblicato dal ramo `main` alla radice del repository. Ogni push su `main` aggiorna automaticamente la pagina quando la build Pages termina.
