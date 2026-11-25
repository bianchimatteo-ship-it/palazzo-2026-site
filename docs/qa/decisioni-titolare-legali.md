# Domande precise al titolare e decisioni ancora aperte (19/11/2026)

**Stato delle pagine pubbliche:** `privacy.html`, `privacy-en.html`, `termini.html`, `terms-en.html` non hanno più segnaposto. Sono scritte con i dati forniti: gestore/sviluppatore Matteo Bianchi; **titolare del trattamento e offerente del servizio: Ramona Bianchi** (indicata da te come maggiorenne); recapito `politicando2026simulazione@gmail.com`; Gmail/Apps Script con quell'account; account Cloudflare intestato a Matteo Bianchi; nessun indirizzo postale; nessun accordo con Cloudflare o Google dichiarato. `docs/legale-requisiti.json` registra come «fornito» solo titolare e offerente. Le altre 11 voci restano «mancante»: `check:legal -- --release` resta **bloccato** (corretto: non è stato aggirato).

## Un'unica lista di domande (rispondi a tutte insieme)
1. **Ramona Bianchi** — nome e cognome completi come devono comparire; rapporto con Matteo (genitore, tutore…); conferma che accetta di essere indicata pubblicamente come titolare del trattamento e offerente del servizio e di rispondere verso utenti, store e Garante; se è lei l'intestataria dell'account Google Play (oggi la pagina dice solo «un genitore»). Serve un atto scritto (anche semplice) che lo documenti: lo ha già prodotto o va preparato con un professionista?
2. **Indirizzo** — vuoi pubblicare un indirizzo postale/PEC di Ramona Bianchi o di un domicilio eletto? Altrimenti restiamo con la sola e-mail: confermi, dopo parere di un professionista, che per un servizio gratuito senza attività d'impresa basta? (D.Lgs. 70/2003 art. 7; per Apple/Google come «trader» DSA l'indirizzo diventa pubblico.)
3. **Cloudflare** — chi ha accettato le condizioni (data e persona); piano usato; nella Dashboard (Account → Legal / «Data Processing Addendum») il DPA risulta accettato? Vuoi spostare/riaprire l'account a nome di Ramona Bianchi? Quale giurisdizione hanno D1, KV e R2 (impostazioni di localizzazione)? Quanto conservano i backup/Time Travel di D1?
4. **Gmail / Google** — l'account `politicando2026simulazione@gmail.com` di chi è (regole di Google sull'età)? Il gateway Apps Script può passare a un account intestato a un adulto? Esiste un accordo/un'impostazione Workspace diversa dalle condizioni standard?
5. **Minori ed età** — elenco dei Paesi in cui distribuire l'app; conferma del pubblico 14+ e delle risposte su classificazione (IARC/Apple), Data safety, privacy label.
6. **Diritti sugli asset** — dichiarazione di paternità di marchio, illustrazioni e testata «La Politica 24»; strumenti e fonti usati; licenze di loghi/dati di terzi; regole per i loghi caricati dagli utenti.
7. **Apple Developer** — persona (individuale/organizzazione) e nome che comparirà come venditore; dichiarazione «trader» (sì/no, con parere); contatti pubblici.
8. **InMobi (prima di qualunque build con annunci)** — conferma dell'Account ID dal pannello InMobi, placement creati, testo del consenso; aggiornamento di privacy/termini/schede store.
9. **Conservazione** — vuoi eliminare gli account inattivi dopo 12 mesi (preavviso di 30 giorni via e-mail verificata)? Oggi è disattivato (`RETENTION_ENABLED=0`).
10. **Prova reale dell'e-mail su TEST** — indica una casella di prova controllata da te e conferma che sul Worker TEST esistono `EMAIL_GATEWAY_URL` ed `EMAIL_GATEWAY_SECRET` (non me li dare): la prova la esegui tu col comando in `docs/qa/deploy-test-vscode.md` §7.

## Elenco originale delle 13 voci di `check:legal -- --release`

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


## Aggiornamento 19/11/2026 — elenco unico di domande aperte

Fatti ora confermati (non da richiedere di nuovo): Ramona Bianchi è titolare del trattamento e offerente del servizio; Apple Developer (individuale) e Google Play Console sono a suo nome; account Cloudflare di Matteo gestito con Ramona; Gmail `politicando2026simulazione@gmail.com` di Matteo sotto la supervisione di Ramona (email ufficiale, privacy, test); marchio, icona e grafiche create da Matteo; nessuna cancellazione automatica degli account inattivi.

### Bloccanti per la revisione iOS
1. Hash del commit (o IPA) da cui è stato creato l'archivio iOS 1.0 (1): senza non si può dichiarare cosa contiene.
2. Indirizzo da pubblicare: Ramona intende pubblicare un indirizzo postale o una PEC? (come venditore individuale Apple mostrerà i suoi dati.)
3. Trader DSA: Ramona dichiara lo stato di «trader» (servizio gratuito, nessuna monetizzazione nella 1.0)?
4. Età e Paesi: classificazione di età (IARC/Apple) e Paesi di distribuzione.
5. Cloudflare: quali condizioni/DPA sono state accettate e da chi (prove); regione di D1/KV/R2; esistenza di backup e per quanto tempo.
6. Ratifica da parte di Ramona dei contratti conclusi da Matteo (Cloudflare, Google/Gmail).
7. Google: le condizioni dell'account Gmail permettono l'uso come gateway e l'età del titolare dell'account?
8. Licenze di terzi: loghi, illustrazioni, dati reali, testata «LA POLITICA 24».

### Bloccanti Android / pubblicità futura
9. Android SDK e upload keystore (la stessa chiave già associata a Google Play) per generare l'AAB: sempre da fornire fuori dal repository.
10. InMobi: conferma dell'Account ID e del testo di consenso; AdMob App ID già nel manifest solo per UMP.
11. Dichiarazioni Data safety / pubblico di destinazione compilate da Ramona.

## Riconciliazione del 24/11/2026 (stato attuale, da `node scripts/check-legal.mjs --release`)

**Risolte: 4 su 13.** `titolare-trattamento`, `offerente-servizio`, `account-sviluppatore-play`, `account-apple-developer`.

**Aperte: 9.** Ognuna richiede un atto o una decisione del titolare: nessun esito è stato scritto al suo posto e le raccolte che ne dipendono restano spente.

| # | Voce | Dove pesa | Che cosa serve |
|---|---|---|---|
| 1 | `indirizzo-titolare` | privacy.html §1, termini.html §1 | Indirizzo (o PEC/recapito professionale) da pubblicare come recapito del titolare |
| 2 | `cloudflare-dpa` | privacy.html §5 | Prova dell’accettazione del DPA Cloudflare (chi, quando, per conto di chi) e ruolo di Cloudflare |
| 3 | `minori` | privacy.html §10, termini.html §6, docs/minori-e-privacy.md | Paesi di distribuzione e soglia d’età per il consenso in ciascuno (pubblico previsto 14+) |
| 4 | `diritti-asset` | termini.html §4–5 | Dichiarazione di paternità di marchio, illustrazioni e testata; licenze; regole sui loghi caricati dagli utenti |
| 5 | `email-fornitore` | privacy.html §5–6 | Ruolo di Google (Apps Script/Gmail) come fornitore dell’invio e-mail e account usato |
| 6 | `trader-dsa` | Play Console, App Store Connect | Decisione sullo status di «trader» (DSA) e, se sì, dati pubblici |
| 7 | `eta-pubblico-store` | Play Console, App Store Connect | Pubblico di destinazione, classificazione IARC/Apple, Data safety, esclusione da Famiglie/Kids |
| 8 | `rappresentanza-capacita` | docs/audit-legale-conformita.md §2 | Rappresentanza dei genitori e capacità contrattuale verso fornitori e store |
| 9 | `admob-futuro` | privacy.html §5, termini.html §9, schede store | Documenti pubblicitari prima di una build con SDK pubblicitario: **attenzione**, la voce parla di InMobi «unico provider», ma l’AAB Android in uscita usa **Appodeal 4.4.0** (InMobi non è nella build). Il titolare deve confermare che privacy, termini, Data safety e dichiarazione del permesso `AD_ID` descrivono Appodeal e i suoi partner prima della pubblicazione |

Restano spente fino a una decisione: statistiche dell’amministrazione (`ADMIN_STATS`), import automatico delle installazioni (richiede le credenziali del titolare), TikTok tra le ricompense community.
