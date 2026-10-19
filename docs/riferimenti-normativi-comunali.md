# Riferimenti normativi: fasce di popolazione dei comuni

Questo documento spiega da dove vengono le due fasce di comuni del gioco e cosa il gioco semplifica. Non è una consulenza giuridica: i riferimenti sono quelli della normativa da cui le regole derivano, **il testo vigente non è stato verificato sulla fonte ufficiale (Normattiva) in questo progetto** e va controllato prima di citarlo come ufficiale.

## Le due fasce

| Fascia | Come è eletto il sindaco | Riferimento |
|---|---|---|
| Fino a 15.000 abitanti | Un solo turno: vince il candidato con più voti. Nessun ballottaggio. | D.Lgs. 18 agosto 2000, n. 267 (TUEL), art. 71 |
| Oltre 15.000 abitanti | Eletto al primo turno chi supera la metà dei voti validi; altrimenti ballottaggio tra i due più votati. | TUEL, artt. 72 e 73; L. 25 marzo 1993, n. 81 |

Il ballottaggio non è automatico: nel gioco si apre solo se nessun candidato supera il 50% dei voti validi al primo turno (`election-engine.js`).

## Quale popolazione conta

La soglia dei 15.000 abitanti si applica alla **popolazione di riferimento prevista dalla legge per le regole elettorali** (l'ultimo censimento), non alla popolazione residente di oggi. Il gioco lo rispetta così (`src/core/municipal-rules.js`):

1. se il file dei dati ha il riferimento legale del comune (`electoralPopulationReference`), si usa quello e la fascia non è provvisoria;
2. altrimenti si usa la popolazione residente ISTAT (1 gennaio 2026) come indicazione, e la fascia è dichiarata **provvisoria**;
3. se non ci sono dati, si applicano le regole dei comuni fino a 15.000 abitanti, come ripiego dichiarato.

Nessun numero viene stimato: un dato che manca non viene inventato. Il numero esatto di abitanti con la data di riferimento è sempre mostrato accanto alla fascia.

## Cosa il gioco semplifica

- **Ripartizione dei seggi**: soglia del 3% per le liste e maggioranza alla lista del sindaco eletto (2/3 dei seggi fino a 15.000 abitanti, 60% oltre). È una semplificazione dichiarata (`SEAT_RULES.comunale` in `src/data/simulation/campaign-rules.js`), non il testo della legge: la legge prevede condizioni e soglie ulteriori che il gioco non riproduce. Le descrizioni nell'interfaccia non promettono quindi né il ballottaggio né il premio di maggioranza come automatici.
- **Liste e coalizioni, apparentamenti, voto disgiunto**: modellati in modo semplificato, non come la disciplina completa.

## Come verificare un riferimento

1. aprire Normattiva (normattiva.it) e cercare il D.Lgs. 267/2000;
2. confrontare gli articoli 71, 72 e 73 con la tabella sopra;
3. aggiornare la riga «Riferimento» e rimuovere l'avvertenza solo dopo il confronto.
