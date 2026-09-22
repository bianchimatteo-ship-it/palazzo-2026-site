# POLITICANDO 2026

Una carriera nella politica italiana.

Fondamenta per una simulazione gestionale della politica italiana. I dati reali importati, quelli generati dalla simulazione e quelli creati dall’utente restano archivi separati. Il database reale è uno snapshot aggiornato al **22 settembre 2026**; i campi non presenti nelle fonti sono `null` e non vengono ricostruiti per deduzione.

## Avvio

Richiede Node.js 20 o successivo, senza dipendenze esterne.

```sh
npm start
```

Apri `http://127.0.0.1:4173`. La carriera viene salvata nel `localStorage` del browser in uso. Il comando “Avanza di 1 settimana” aggiorna la data, genera una voce di agenda simulata e salva la carriera.

## Snapshot reale incluso

Rilevazione importata il 22 settembre 2026:

- **68 partiti** e **2 movimenti politici** nel registro ufficiale della Commissione di garanzia, più i riferimenti del MEF 2‰ integrati quando il nome coincide con la voce registrata;
- **30** organizzazioni risultano nella tabella del 2‰ relativa alle dichiarazioni 2025/redditi 2024, che non viene confusa con una prova di rappresentanza elettorale;
- **22 gruppi parlamentari**: 13 alla Camera e 9 al Senato, mantenuti distinti dai partiti;
- **604 parlamentari in carica**: 399 deputati e 205 senatori;
- **674 appartenenze ai gruppi**: roster corrente per la Camera e periodi di adesione documentati per i senatori attualmente in carica;
- **13 etichette di lista elettorale** ricavate dalle schede dei deputati e **268 relazioni** tra deputato, lista d’elezione e consultazione politica 2022;
- **23 nodi territoriali**: Italia, le 20 regioni con codice ISTAT stabile, Camera e Senato; comuni e articolazioni provinciali restano predisposti nello schema in attesa di importare i relativi elenchi ufficiali aggiornati.
- **2 consultazioni** configurate: elezioni politiche 2022 ed europee 2024.

Il dataset contiene **70 entità politiche** (68 partiti e 2 movimenti) documentate dal Registro nazionale o dai dati MEF 2‰; include entità attive e storiche del registro e non pretende di censire ogni formazione locale italiana. Il numero di partiti parlamentari e non parlamentari **non è ancora determinabile senza ambiguità**: il dato della Camera e del Senato identifica il gruppo, mentre la lista d’elezione può essere una lista congiunta o una coalizione. Non trasformiamo queste relazioni in appartenenze a un partito. Per questo, i valori di presenza parlamentare, livello territoriale, regione e partecipazioni elettorali dei singoli partiti sono lasciati non documentati finché non esiste un collegamento verificato. La sezione Politici mostra separatamente gruppo e lista d’elezione.

### Fonti istituzionali

- [Parlamento italiano — Registro nazionale dei partiti politici](https://www.parlamento.it/Parlamento/1063), deliberazioni d’iscrizione e cancellazioni;
- [Ministero dell’Economia e delle Finanze — dati 2‰](https://www1.finanze.gov.it/finanze/2xmille/public/index.php?aggiornato=1522252800&export=1&page=1&tree=2025AADUEXM0101), dichiarazioni 2025/redditi 2024;
- [Camera dei deputati — elenco e schede della XIX legislatura](https://www.camera.it/deputati/elenco) e [composizione dei gruppi](https://www.camera.it/leg19/217);
- [Senato — Open data sulla composizione](https://dati.senato.it/sito/composizione?legislatura=19&testo_generico=11), esportazioni datate di senatori e gruppi;
- [ISTAT — codici delle unità amministrative territoriali](https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/), codici e nomi ufficiali delle 20 regioni;
- [Ministero dell’Interno — trasparenza elezioni europee 2024](https://dait.interno.gov.it/elezioni/trasparenza/elezioni-europee-2024) e [archivio storico](https://www.interno.gov.it/it/temi/elezioni-e-referendum/dato-storico-elezioni).

Sono state importate le schede individuali ufficiali della Camera per nascita, collegio, circoscrizione, lista d’elezione e proclamazione. Per i senatori e per gli incarichi istituzionali non coperti dagli export importati, i dati personali e gli incarichi non verificati restano null o non collegati.

## Criteri di inclusione e qualità

- Ogni record reale contiene `source: "real"`, `verified: true`, `sourceUrl`, `sourceName` e `verifiedAt`; `validFrom`/`validTo` sono valorizzati solo quando la fonte consente di identificarli.
- Gli ID sono chiavi interne stabili o identificativi istituzionali: URI/numero Senato, identificativo della scheda Camera o numero di deliberazione. Le relazioni usano ID, mai il testo visualizzato.
- Le schede del registro e le voci MEF non inventano sito, colore, leadership, area geografica o ideologia: tali campi sono `null` se non attestati.
- I gruppi parlamentari sono entità a sé. Le appartenenze documentate non diventano partiti; la lista d’elezione non diventa coalizione.
- Il database reale non contiene consenso o statistiche simulate. Le carriere demo e le carriere utente non possono modificare lo snapshot reale.
- I nomi duplicati normalizzati, gli ID ripetuti, i nomi organizzativi duplicati dopo normalizzazione, le fonti mancanti, i collegamenti non risolti e i conteggi dei gruppi incoerenti fanno fallire il controllo qualità. Gli omonimi politici sono ammessi perché identificati con ID istituzionali distinti.

## Struttura dati

- `src/data/real/`: snapshot istituzionale versionato, file per collezione e `database.json` aggregato usato in lettura dalla UI;
- `src/data/simulation/`: dati e statistiche dimostrativi;
- `src/data/user/`: punto d’ingresso per i record creati nelle carriere;
- `src/data/repositories/`: accesso alla base reale separato dalla carriera locale;
- `scripts/import-real-data.mjs`: importa i registri ufficiali e genera lo snapshot; le nuove etichette di lista richiedono assegnazione manuale di un ID stabile;
- `scripts/validate-real-data.mjs`: controlla provenienza, duplicati, integrità relazionale, numeri dei gruppi e separazione dei dati.

Collezioni disponibili: `parties`, `politicalMovements`, `parliamentaryGroups`, `coalitions`, `electoralLists`, `politicians`, `offices`, `partyMemberships`, `groupMemberships`, `electionParticipations`, `partyMembershipHistory`, `parliamentaryGroupHistory`, `officeHistory`, `territories`, `elections`, `chambers`.

## Aggiornamento dei dati

Dalla cartella del progetto esegui:

```sh
npm run import:real-data
npm run check:real-data
```

L’importatore scarica fonti pubbliche istituzionali e riscrive soltanto `src/data/real/`. Il controllo si interrompe se le fonti cambiano struttura, se non trova un identificativo istituzionale o se una relazione risulta incoerente. Per aggiornare data di snapshot e `verifiedAt`, modificare la costante `AS_OF` nello script dopo avere fissato la data effettiva di consultazione. Verificare la differenza dei file prima di pubblicare lo snapshot.

## Pubblicazione automatica

Il sito statico può essere pubblicato da GitHub Pages scegliendo il ramo `main` e la cartella `/` nelle impostazioni Pages del repository. Ogni push su `main` aggiorna automaticamente il sito.
