# Scioglimento di una fusione tra partiti

Aggiornato il 24/11/2026. Codice: `src/core/merger-dissolution.js` (caricato solo quando serve), snapshot in `src/core/party-ops-engine.js` (`mergeParties`) e `src/core/store.js` (`applyPartyMerge`, `dissolveMerger`), interfaccia in `src/ui/party-life-view.js` (Partito → Vita interna → Operazioni sul partito → «Sciogliere una fusione»). Test: `scripts/check-merger-dissolution.mjs`.

## Come funzionava la fusione (analisi)

- **Mondo politico**: il partner restava nell’elenco dei partiti, solo spento (`active: false`, `mergedInto`, `mergedEvidence` con la quota di entrambi al momento della fusione). Nome, sigla, colori, collocazione, programma e storico dei sondaggi restavano intatti. Al partito del giocatore: +80% del consenso del partner, +60% dell’ancoraggio, un effetto temporaneo «Fusione tra partiti».
- **Partito del giocatore** (carriera): iscritti aggiunti regione per regione (sezioni ingrandite o aperte quella settimana), militanti, quadri, cassa (7 € per iscritto, nella tesoreria), una nuova corrente «Area …», un conflitto d’integrazione, coesione −6, voce nello storico e nel diario.
- **Parlamento**: i gruppi con il partito del partner passavano al partito del giocatore.
- **Identità**: solo per un partito fondato dal giocatore, l’identità scelta e quella precedente nello storico delle fusioni del record del partito.
- **Non registrati**: quanti iscritti c’erano prima, quali sezioni erano state solo ingrandite, la cassa portata, quali gruppi erano del partner.

## Che cosa cambia

**Fusioni nuove** (da questa versione): uno **snapshot** con identificativo univoco `fusione-<settimana>-<partito>` in `game.party.mergers`: iscritti prima e arrivati, sezioni regione per regione (ingrandite o aperte), militanti, quadri, cassa, corrente, conflitto, nome precedente, identità e consenso di entrambe le forze, gruppi parlamentari del partner.

**Scioglimento** (azione «Sciogli fusione», solo segretario, 5 punti di capitale politico; non durante una campagna elettorale né durante il congresso):

| Che cosa | Fusione nuova (snapshot) | Fusione di un vecchio salvataggio |
|---|---|---|
| Partner | Torna attivo con il suo nome, sigla, colori, collocazione e programma | Uguale (erano conservati) |
| Iscritti | Quelli arrivati, scalati sull’andamento degli iscritti da allora | Quelli dichiarati nello storico del partito («+N iscritti»); se lo storico non lo dice: **non ricostruibili**, restano al giocatore |
| Sezioni | Ripartizione proporzionale a ciò che il partner aveva portato regione per regione; le sezioni aperte con la fusione passano intere; quelle preesistenti non scendono sotto 5 iscritti | Le sezioni aperte la settimana della fusione passano intere, il resto in proporzione |
| Militanti e quadri | In proporzione agli iscritti che escono | Uguale |
| Cassa | Quella portata, al massimo quanto c’è in tesoreria | Ricostruita con la regola della fusione (7 € per iscritto), al massimo quanto c’è in tesoreria; altrimenti **non ricostruibile** |
| Corrente e conflitto | La corrente del partner esce (accordi interni chiusi, richieste ritirate, seggi negli organi ricalcolati); il conflitto d’integrazione si chiude | Ricercata per nome; se non c’è più, detto nell’anteprima |
| Consenso | Diviso nella proporzione dei due partiti al momento della fusione: la somma non cambia | Dalla quota registrata nell’evidenza della fusione |
| Identità del tuo partito | Torna quella di prima, **se** il partito porta ancora il nome dato dalla fusione | Uguale, se lo storico delle fusioni del partito la conserva; altrimenti resta quella attuale |
| Gruppi parlamentari | Quelli del partner tornano al partner | Solo i gruppi creati dal gioco con l’id del partner; gli altri **non ricostruibili** |
| Alleanze del partner | Non ripristinate (gli accordi sono andati avanti): riparte fuori da ogni accordo, invitabile | Uguale |

Sempre: la data è quella corrente della partita, il calendario non torna indietro, elezioni, risultati, sondaggi e leggi successivi restano come sono (i voti presi insieme restano al partito del giocatore). Coesione −3, rapporti con il partner −20. Lo scioglimento va nello storico politico, nel diario, nella storia del partito, nella memoria della carriera, nella cronaca del mondo e nello storico delle fusioni («Fusioni sciolte»).

**Anteprima**: prima di confermare, la finestra elenca con ✓ ciò che torna (con i numeri) e con ✗ ciò che non è ricostruibile.

**Nessuna duplicazione** (verificata dai test): iscritti, cassa, consenso e seggi che lasciano il partito del giocatore sono esattamente quelli che vanno al partner.

## Limiti per i vecchi salvataggi

- Gli iscritti tornano nella misura dichiarata allora dallo storico; quelli effettivamente distribuiti nelle sezioni erano un po’ di più (arrotondamenti della vecchia regola): la differenza resta al giocatore.
- Non si sa come sono cambiati gli iscritti dopo la fusione.
- I gruppi parlamentari reali passati con la fusione non sono distinguibili: restano dove sono.
- Se la voce dello storico del partito è uscita dalle ultime 40, iscritti e cassa non sono ricostruibili: l’anteprima lo dice e non si restituiscono.
