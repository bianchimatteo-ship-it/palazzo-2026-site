# Decisioni e informazioni che deve fornire il titolare (13 voci di `check:legal -- --release`)

Fonte: `docs/legale-requisiti.json` (stato «non fornito»). Nulla qui è stato inventato né dichiarato al posto del titolare: per ogni voce c’è solo **cosa serve** e **chi può rispondere**. Dove la voce richiede una valutazione giuridica, la decisione spetta a un professionista (art. 13 GDPR, D.Lgs. 70/2003, DSA, norme sull’età).

| # | Voce (`id`) | Cosa mi serve da te | Da chi / con quale atto |
|---|---|---|---|
| 1 | `titolare-trattamento` | Chi è il titolare del trattamento e chi è responsabile o autorizzato (oggi: Matteo decide in concreto, i genitori supervisionano). | Decisione dei genitori con un professionista; poi aggiorno `privacy.html §1`. |
| 2 | `offerente-servizio` | Se un genitore assume formalmente il ruolo di offerente del servizio verso utenti e store, con atto scritto (anche semplice). | Il genitore (oggi disponibile a valutare, nessuna accettazione) + atto redatto con professionista. |
| 3 | `indirizzo-titolare` | Indirizzo (domicilio/residenza) da pubblicare come recapito del titolare, oppure la soluzione scelta (es. PEC/indirizzo professionale) dopo valutazione. | Il titolare scelto al punto 1. Non va inventato né pubblicato senza consenso. |
| 4 | `rappresentanza-capacita` | Valutazione della validità/ratifica dei contratti già conclusi da Matteo (Cloudflare, Google/Gmail) e a nome di chi si concludono quelli futuri (store, fornitori ads). | Professionista + firma dei genitori. |
| 5 | `cloudflare-dpa` | Prova dell’accettazione dei termini/DPA Cloudflare per rappresentanza (chi ha accettato, quando) e il ruolo di Cloudflare (responsabile/sub-responsabile). | Il genitore presente alla registrazione; screenshot/e-mail di accettazione dal Dashboard. |
| 6 | `email-fornitore` | Condizioni Google valide per l’account Gmail del gateway (regole sull’età), se Google è responsabile del trattamento e in quale account/ruolo. | Titolare dell’account Gmail/Apps Script; eventuale migrazione a un account di un adulto. |
| 7 | `diritti-asset` | Dichiarazione scritta di paternità di marchio, illustrazioni e testata; elenco di strumenti e fonti usati; licenze di loghi/dati di terzi; regole sui loghi caricati dagli utenti. | Matteo (autore) con firma dei genitori; verifica licenze con professionista. |
| 8 | `minori` | Elenco dei Paesi di distribuzione e verifica della soglia d’età per il consenso e per i servizi online in ciascuno (pubblico previsto 14+). | Professionista; poi aggiorno privacy, termini e schede store. |
| 9 | `account-sviluppatore-play` | Nome e cognome del genitore intestatario, tipo di account, dati pubblici che Google mostrerà, coerenza con le pagine legali. | Il genitore (Play Console). |
| 10 | `account-apple-developer` | Persona e modalità di iscrizione all’Apple Developer Program (individuale o organizzazione; serve la maggiore età nella propria area). | Il genitore o l’entità giuridica scelta. |
| 11 | `trader-dsa` | Se dichiarare lo status di «trader» (DSA) su Google Play e App Store Connect; se sì, nome/indirizzo/contatti diventano pubblici. | Decisione con professionista; compilazione da parte del titolare dell’account. |
| 12 | `eta-pubblico-store` | Pubblico di destinazione e risposte su classificazione per età (IARC, Apple), Data safety/privacy label, esclusione di Famiglie/Kids se non applicabile. | Titolari degli account store, sulla base dei fatti (non si sceglie 14+ per superare i controlli). |
| 13 | `admob-futuro` (InMobi) | Prima di una build che contiene l’SDK InMobi: aggiornare privacy/termini/schede store (dati pubblicitari, consenso UMP/IAB TCF, ruolo di InMobi), confermare l’Account ID dal pannello InMobi e creare i placement. Finché manca, gli annunci restano spenti. | Titolare + professionista; l’Account ID dal pannello InMobi (non lo invento). |

Dopo le tue risposte: aggiorno `docs/legale-requisiti.json` (campo `provided`), le pagine `privacy.html`/`termini.html` e le schede in `docs/google-play.md`, poi `npm run check:legal -- --release` deve passare.
