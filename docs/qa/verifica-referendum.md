# Verifica normativa di iniziative e referendum (23/11/2026)

**Esito: i testi ufficiali non sono stati leggibili da questo ambiente, quindi la verifica è NON completata (⚫ bloccata da una fonte).** Nessuna regola del motore è stata cambiata sulla base di ricordi non verificati.

## Cosa si è provato
| Fonte | Esito |
|---|---|
| senato.it (Costituzione) | HTTP 403 |
| quirinale.it (Costituzione) | HTTP 403 |
| Normattiva, Costituzione e L. 352/1970 | pagina raggiungibile ma mostra solo l'art. 1; gli altri articoli si caricano con un controllo non seguibile |
| Normattiva, esportazione dell'atto completo | pagina di errore |
| Gazzetta Ufficiale n. 147 del 15/06/1970 (PDF) | scaricato, ma è una scansione senza testo: serve OCR |
| Wikisource, Altalex, camera.it | non disponibile / accesso con login / testo assente |

Dall'albero degli articoli di Normattiva risulta soltanto la struttura della L. 352/1970: Titolo I referendum dell'art. 138 (artt. 1-26), Titolo II referendum dell'art. 75 (artt. 27-40), Titolo III referendum territoriale dell'art. 132 (artt. 41-47), Titolo IV iniziativa del popolo (artt. 48-49), Titolo V disposizioni finali (artt. 50-53).

## Cosa fa il motore oggi (da riconfrontare con il testo quando disponibile)
- Iniziativa legislativa popolare: 50.000 firme, progetto redatto in articoli (art. 71); passa poi al Parlamento. Distinta da referendum e da petizione.
- Referendum abrogativo: 500.000 firme o 5 Consigli regionali; quorum della metà più uno degli aventi diritto; esclusi tributi e bilancio, amnistia e indulto, ratifica dei trattati (art. 75); Cassazione → Corte costituzionale → campagna → voto in una domenica tra il 15 aprile e il 15 giugno.
- Referendum costituzionale: richiesta entro tre mesi dalla pubblicazione, da un quinto dei membri di una Camera, 500.000 elettori o 5 Consigli regionali; nessun quorum; niente referendum se la seconda votazione raggiunge i due terzi (art. 138); intervallo di almeno tre mesi tra le due deliberazioni.
- Una raccolta firme referendaria aperta dalla pagina Iniziative va collegata a una legge in vigore (`store.linkReferendumCollection`, `check-referendum-link`).

## Cosa NON c'è e perché
- **Referendum territoriale (art. 132)**: non implementato. Il gioco non simula fusioni di Regioni né passaggi di Province o Comuni tra Regioni, quindi non esiste una procedura applicabile da simulare. Non è stato inventato.
- **Finestre di deposito e blocchi della L. 352/1970** (periodo dell'anno per depositare, blocco nell'anno prima della scadenza delle Camere e nei sei mesi dopo le elezioni, termine della Corte): non implementati perché non verificati sul testo.
- **Petizione (art. 50)**: non è una procedura del gioco; la pagina Iniziative non la presenta come iniziativa legislativa.

## Per chiudere
Fornire un testo leggibile (Normattiva in browser, o la scansione della Gazzetta passata con OCR) di: Costituzione artt. 71, 75, 132, 138; L. 352/1970 artt. 28-34, 41-47, 48-49. Con quello si potrà confrontare punto per punto e correggere solo le parti difformi.
