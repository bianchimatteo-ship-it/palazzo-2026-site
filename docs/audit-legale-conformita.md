# Audit legale e di conformità — Politicando 2026 (13 novembre 2026)

**Non è un parere legale e non dichiara la conformità del gioco a nessuna norma o policy.** È un inventario di ciò che il codice fa davvero, di ciò che la documentazione dice, delle fonti ufficiali effettivamente lette e di ciò che manca. Un aggiornamento dei testi pubblici non basta a rendere conforme il trattamento: la conformità dipende anche da decisioni e atti che il codice non può compiere (chi è titolare, contratti con i fornitori, registri, risposte negli store). Nessun deploy, nessuna pubblicazione e nessuna modifica agli account Google Play o Apple sono stati fatti.

## 1. Fonti: che cosa è stato letto davvero

| Fonte | Esito in questa sessione |
|---|---|
| Apple — Become a member https://developer.apple.com/programs/enroll/ ; Program enrollment https://developer.apple.com/help/account/membership/program-enrollment/ | **Letta** |
| Apple — App Review Guidelines https://developer.apple.com/app-store/review/guidelines/ | Letta solo la parte iniziale (fino a 2.5.8); le sezioni 3.2.2, 4.x, 5.x sono da un riassunto, **da ricontrollare sul testo** |
| Apple — App Privacy Details https://developer.apple.com/app-store/app-privacy-details/ | **Letta** |
| Apple — Age ratings, Manage app privacy, trader status DSA (developer.apple.com/help/app-store-connect/…) | Lette come riassunto: **da ricontrollare** |
| Apple — Privacy manifest / required reason API | **Non leggibile** |
| Google Play Console (support.google.com: account personali nuovi, tipi di account, Data safety, pubblico di destinazione, Famiglie, eliminazione dell'account, DSA trader) | **Non raggiungibile** (host bloccato dalla rete di questo ambiente). Quanto sotto su Google Play viene dal codice e da `docs/google-play.md` (22/10/2026), **non** da una verifica ufficiale odierna |
| GDPR (EUR-Lex), D.Lgs. 196/2003 art. 2-quinquies, Codice civile, D.Lgs. 70/2003, linee guida EDPB 07/2020 | **Non raggiungibili** (eur-lex.europa.eu, normattiva.it, edpb.europa.eu bloccati). I riferimenti normativi sotto sono dalla conoscenza dell'autore: vanno **verificati su testi vigenti** da un professionista |

Ogni punto sotto è marcato **[V]** se poggia su una fonte ufficiale letta oggi o sul codice, **[NV]** se non verificato da fonte ufficiale in questa sessione.

## 2. Ruoli e responsabilità (cose diverse, da non confondere)

| Aspetto | Chi | Base |
|---|---|---|
| Ideazione, sviluppo, gestione operativa | Matteo Bianchi (**minorenne**, confermato il 14/11/2026), sotto la supervisione dei genitori; è lui a decidere in concreto finalità e modalità del trattamento | dato fornito dal progetto |
| Account Google Play Console e accordo con Google | Un genitore (intestatario e contraente). **Matteo non è titolare** dell'account | dato fornito dal progetto; nome del genitore **non fornito** |
| Account Apple Developer | Non esiste ancora | — |
| Titolare del trattamento GDPR | **Non determinato** (segnaposto `titolare-trattamento`) | vedi sotto |
| Diritti di proprietà intellettuale su codice, testi, grafica | Da documentare (`diritti-asset`); in generale spettano a chi crea l'opera, non a chi ha l'account dello store [NV] | — |
| Fornitori tecnici | Cloudflare (hosting, D1, KV, R2) e Google (Apps Script/Gmail, solo invio e-mail): **nessun ruolo giuridico attribuito nelle pagine finché non sono verificati gli accordi effettivi** (segnaposti `cloudflare-dpa`, `email-fornitore`); DeepL (riceve solo modelli di frase anonimi, nessun dato personale) | codice, `privacy.html` §5 |
| Titolari autonomi per i propri dati | Google Play e Apple, per l'installazione e l'acquisto/scaricamento | [NV] |

**Titolare del trattamento.** Per l'art. 4, n. 7 GDPR il titolare è chi «determina le finalità e i mezzi» del trattamento; secondo l'impostazione delle linee guida EDPB 07/2020 il criterio è funzionale (chi decide davvero), non formale [NV]. Nel progetto le scelte (quali dati raccogliere, quali fornitori usare, quanto conservare) le prende Matteo; ma i contratti con Cloudflare, Google e Apple e gli account sugli store sono (o saranno) di un genitore. Conseguenze da non risolvere per presunzione:

- Attribuire il ruolo ai genitori «perché sono adulti» o «perché hanno l'account Play» non è corretto di per sé: l'account dello store non determina il titolare. Ma anche attribuirlo a Matteo senza altro è rischioso se Matteo è minorenne (confermato minorenne): un minore non ha piena capacità di agire (art. 2 c.c.) e non può assumere in proprio contratti e obblighi/responsabilità del titolare; esercita la rappresentanza legale chi ha la responsabilità genitoriale (art. 320 c.c.) [NV].
- L'esenzione per le attività puramente personali o domestiche (art. 2, par. 2, lett. c GDPR) non si applica a un servizio con account offerto al pubblico [NV].
- Soluzioni possibili, da scegliere con un professionista: (A) un genitore assume il ruolo di titolare e Matteo opera come persona autorizzata che segue istruzioni scritte (art. 29 GDPR; art. 2-quaterdecies Codice privacy) [NV]; (B) un'entità giuridica diversa (associazione o altro) come titolare, con relativi costi e obblighi; (C) Matteo titolare con l'intervento di chi lo rappresenta — è la soluzione che richiede più cautele. La documentazione pubblica non anticipa la scelta: usa un segnaposto.
- Va chiarito anche **a chi appartengono gli account tecnici** (Cloudflare, il Gmail/Apps Script del gateway, il dominio): chi li possiede stipula il contratto con il fornitore e va coerentemente indicato come titolare/responsabile.

## 3. Apple Developer Program e App Store

**Fatti letti oggi [V] (developer.apple.com/programs/enroll e help/account/membership/program-enrollment):**
- Serve «the legal age of majority in your region». Nota ufficiale: «If you're under the age of majority in your region, your parent/guardian can enroll with their Apple Account and share their account with you.»
- **Individuale / ditta individuale:** il nome legale della persona è il nome del venditore sull'App Store («Your name will be displayed as the seller name of your apps»); alias, soprannomi o nomi commerciali ritardano l'approvazione; chi è un «sole proprietor/single-person business» deve iscriversi come individuo.
- **Organizzazione:** il nome del venditore è quello dell'entità giuridica; serve **entità giuridica riconosciuta** («We don't accept DBAs, fictitious businesses, trade names, or branches»), **D-U-N-S Number**, email di dominio dell'organizzazione e sito web funzionante legato al dominio; chi si iscrive diventa Account Holder e «must have the legal authority to bind your organization».
- Serve un Apple Account con autenticazione a due fattori; per gli individui nome legale, e-mail, telefono e indirizzo (no caselle postali); se non si paga con una carta propria può essere chiesto un documento d'identità.
- Quota: 99 USD per anno di iscrizione (può variare per area); per distribuire sull'App Store occorre l'iscrizione.
- Conversione individuale → organizzazione: la pagina rinvia a contattare Apple; **non** dice nulla sul trasferimento delle app.
- Il contratto (Apple Developer Program License Agreement) lo accetta chi si iscrive.

**Implicazioni per Politicando 2026:**
1. Con l'iscrizione **individuale del genitore**: il venditore pubblico sull'App Store sarà il **nome e cognome legali del genitore**; il contratto con Apple, la responsabilità verso Apple e (per le app) la titolarità dell'account sono del genitore. Non è «automaticamente» il modello migliore: espone il nome del genitore, lo rende parte contrattuale e, se si dichiara «trader», rende pubblici indirizzo e contatti [V per il nome del venditore; trader: riassunto, da ricontrollare].
2. L'iscrizione come **organizzazione** richiede un'entità giuridica che oggi, per quanto risulta, non esiste; non si può usare una ditta fittizia né un nome commerciale. Crearla comporta costi e obblighi che vanno valutati: non è una scorciatoia per cambiare il nome del venditore.
3. Matteo, minorenne (da confermare), non può iscriversi; può lavorare sull'app attraverso l'account del genitore. **Raccomandazione:** aggiungere Matteo come utente con ruolo limitato di App Store Connect, invece di condividere le credenziali dell'Account Holder (la formula «share their account with you» di Apple non va intesa come condivisione di password; i ruoli esatti vanno controllati su Apple) [NV].
4. Diritti sull'app: la titolarità sull'account e il diritto d'autore sul codice sono cose distinte; sull'account vale il contratto, sul codice la legge sul diritto d'autore. Un accordo scritto in famiglia che dica chi è autore, chi concede la licenza di distribuzione e chi può chiedere la rimozione è consigliabile.
5. Cambiare in seguito tipo di iscrizione o titolare dell'account può non essere semplice e può comportare il trasferimento dell'app (verificare le condizioni Apple prima di iscriversi).

**Da verificare prima dell'iscrizione:** quale genitore; se la scelta è individuale; che nome/indirizzo/telefono saranno pubblici; se l'iscrizione individuale è compatibile con l'uso previsto (distribuzione gratuita, nessun ricavo); dichiarazione DSA «trader» (Apple stessa dice, nel riassunto letto, che la gratuità non basta a escludere la qualifica e rinvia al consulente); condizioni di trasferimento app/account; costi annui.

**Requisiti dell'app rispetto alle linee guida Apple lette (checklist completa in `docs/app-store-apple.md`):** informativa privacy raggiungibile nell'app (menu → collegamenti legali, già presente) e nel campo di App Store Connect (5.1.1) [riassunto]; eliminazione dell'account in app (c'è: Menu → Account) [riassunto]; contatto di supporto raggiungibile (1.5: c'è, `politicando2026simulazione@gmail.com` nel gioco) [V]; descrizione fedele (2.3) [V]; contenuti generati dagli utenti: non condivisi con altri utenti, quindi 1.2 non appare applicabile ma va confermato [V per il testo, valutazione NV]; nessuna pubblicità né analisi di terzi (1.3/5.1.4 non pertinenti se non si chiede la categoria Kids).

## 4. Google Play (aggiornamento senza fonti ufficiali odierne)

Quanto già documentato resta valido come inventario tecnico (`docs/google-play.md`). Correzioni di ruolo fatte oggi: l'account è del genitore; la scheda e le dichiarazioni (Sicurezza dei dati, Pubblico di destinazione, IARC) le firma il genitore sul fatto dell'app. Da **verificare su support.google.com** (non raggiungibile oggi): requisiti per account personali nuovi (verifica identità, eventuale periodo di test chiuso con tester), dati pubblici dello sviluppatore se «trader» DSA, requisiti di Data safety (devono comprendere l'identificativo del dispositivo casuale e i dati delle ricompense), obbligo di URL di eliminazione account, Norme per le famiglie se tra il pubblico ci sono minori di 13 anni. `applicationId` `it.matteobianchi.politicando2026` contiene il nome di Matteo e **non è modificabile dopo la pubblicazione**: se si vuole un identificativo neutro va deciso adesso (decisione dei genitori).

## 5. Coerenza documentazione ↔ app ↔ flussi di dati

| Verifica | Esito |
|---|---|
| Senza account nessun dato di gioco ai server | [V] codice, `check-security` |
| Tabelle D1 dell'account vs informativa | **Lacuna trovata e corretta**: l'informativa non descriveva i dati delle ricompense (`reward_claims`, `reward_time`, `reward_devices` con identificativo casuale del dispositivo, `reward_blocks`, `reward_community`). Riga aggiunta in `privacy.html` §3 (IT/EN). Eliminazione con l'account verificata nel Worker (tutte e cinque le tabelle); pulizia giornaliera 62/90 giorni verificata nel Worker |
| Ricompensa «comunità» (Instagram attiva, TikTok spenta) | Autodichiarazione: l'app non accede ai social né verifica; il link si apre solo al tocco. Detto nell'informativa. **Policy delle piattaforme non verificata** (requisito `ricompense-social-policy`) |
| Pubblicità | Nessuna SDK e nessun annuncio oggi [V manifest/`check-ads-states`]; informativa dice che sarà aggiornata prima di introdurne |
| Titolare nelle pagine pubbliche | **Corretta**: prima dicevano «titolare: Matteo Bianchi, persona fisica»; ora descrivono il ruolo operativo di Matteo con la supervisione dei genitori e lasciano il segnaposto `titolare-trattamento`. Il test `check-legal` rifiuta ora di nuovo quell'attribuzione e verifica che ogni segnaposto corrisponda a un requisito aperto |
| Termini | Stessa correzione al §1; clausole su legge/foro/limitazioni restano assenti (`legge-foro`, facoltative) |
| Tabella dei dati vs Data safety/privacy label | Da compilare dal titolare con l'elenco di `privacy.html` §3 (incl. identificativo casuale del dispositivo) |
| Backup Android `allowBackup=true` | Dichiarato nell'informativa §7; scelta del titolare |
| Catalogo admin condiviso | Contiene solo dati di partiti scritti da amministratori; i partiti dei giocatori non sono pubblicati [V `check-shared-catalog`]: nessun dato personale dei giocatori aggiuntivo |
| Dati reali di persone (parlamentari ecc.) | Fonti pubbliche, distinti dal simulato; base giuridica e condizioni di riuso delle fonti **non verificate** (`diritti-asset`) |
| Documenti interni ancora con «il titolare (Matteo Bianchi)» | `docs/minori-e-privacy.md` aggiornato; `docs/google-play.md` §7 aggiornato |

## 6. Minori e tutela

- Soglia 14 anni per il consenso ai servizi della società dell'informazione (art. 8 GDPR; art. 2-quinquies Codice privacy) [NV]. L'account è però basato su contratto/legittimo interesse, non su consenso (come da informativa); sotto i 14 anni l'account non si crea (autodichiarazione, non verificata).
- Capacità contrattuale dei minori di 18 anni (annullabilità: art. 1425 c.c.) [NV]: rischio basso per un servizio gratuito con dati minimi, ma va valutato.
- **Anche il gestore potrebbe essere minorenne**: la sua età non è stata fornita. Va documentata la supervisione dei genitori e il loro ruolo (si veda §2).
- Il gioco è giocabile da bambini senza account: nessun dato raccolto, nessuna pubblicità né SDK. Il pubblico di destinazione e le Norme per le famiglie (Google) / categoria Kids (Apple) sono scelte dei genitori (`eta-pubblico-store`); il tema politico e la grafica vanno valutati onestamente rispetto all'attrattiva per bambini.
- COPPA e normative estere: se l'app è distribuita fuori dall'UE, va valutato con un professionista [NV].

## 7. Proprietà intellettuale

- Marchio «POLITICANDO», icone, illustrazioni SVG, testata «LA POLITICA 24»: titolarità/licenza **non documentata**, nessuna ricerca di anteriorità (`diritti-asset`).
- Caratteri: SIL OFL 1.1 documentata. Loghi di partiti di terzi: non distribuiti; i giocatori caricano i propri (responsabilità loro, come da Termini §4).
- Nomi di partiti e persone reali: usati come dati identificativi con fonte; rischio di diffamazione/associazione ridotto dal fatto che gli eventi sono dichiarati simulati; Apple 1.1.1 (contenuti diffamatori) e 5.2 (contenuti di cui si ha licenza) vanno tenute presenti nelle risposte allo store.
- Il nome di Matteo nell'`applicationId` e (se individuale) nome del genitore come venditore: effetti permanenti.

## 8. Documenti aggiornati in questo intervento

`portal/privacy.html`/`privacy-en.html` e root (stesso contenuto: §1 titolare con segnaposto, riga «Ricompense», dichiarazione sulla pubblicità); `termini.html`/`terms-en.html` §1; `docs/legale-requisiti.json` (5 nuovi requisiti indispensabili/facoltativi, `account-sviluppatore-play` riscritto); `scripts/check-legal.mjs` (segnaposto ammessi solo se registrati; vieta l'attribuzione per default a Matteo); `docs/audit-legale-conformita.md` (questo); `docs/app-store-apple.md` (checklist nuova); `docs/google-play.md` (ruoli, §7); `docs/minori-e-privacy.md` (titolare).

## 9. Richieste ai genitori (decisioni) e verifiche professionali

| Questione | Cosa manca esattamente | Perché |
|---|---|---|
| Chi è titolare del trattamento | Nome, cognome, indirizzo, ruolo di Matteo, istruzioni scritte | Art. 13 GDPR, D.Lgs. 70/2003 art. 7 [NV]; non si presume |
| Età di Matteo e supervisione | Età/data di nascita (non va pubblicata) e forma della supervisione | Capacità di contrarre e responsabilità |
| Account Play | Nome del genitore intestatario; tipo di account; contatti pubblici; conferma di coerenza con l'informativa | Google mostra i dati dello sviluppatore; coerenza con la privacy |
| Iscrizione Apple | Quale genitore, individuale o organizzazione, nome/indirizzo/telefono pubblici, trader DSA, costo annuo | Il nome diventa il venditore; contratto personale |
| Cloudflare/Google | Conferma DPA accettato, account che possiede Cloudflare e Gmail/Apps Script, residenza dati | Art. 28 GDPR |
| Registro dei trattamenti e valutazione | Se serve e chi lo tiene | Art. 30 GDPR [NV] |
| Minori/età | Pubblico di destinazione, IARC, Apple age rating, Famiglie/Kids sì/no | Scelte sui fatti, non per superare i controlli |
| Applicazione id | Se cambiare `it.matteobianchi.politicando2026` prima del primo caricamento | Irreversibile dopo la pubblicazione |
| Marchio e opere | Dichiarazione autore, ricerca anteriorità, eventuale registrazione | Diritti sull'app |
| Ricompense social | Conferma dalle regole TikTok/Instagram e degli store | Incentivi per azioni su social |
| Professionista | Revisione di informativa, termini, ruoli, capacità del minore, DSA | Il codice non può garantirlo |

## 10. Prima della pubblicazione

**Android:** requisiti legali indispensabili chiusi (`npm run check:legal -- --release` oggi **fallisce con 9 requisiti aperti**, come deve); account Play verificato; scheda e dichiarazioni compilate dal genitore; `.aab` firmato (non generato qui); prove su dispositivo; versionCode > ultimo caricato.
**iOS:** iscrizione Apple decisa e conclusa dal genitore; `ios/` con firma e Xcode 26+ su Mac (non provato qui); privacy label e age rating compilate sui fatti; trader DSA; privacy manifest (**non verificato**: pagina non leggibile); test su dispositivo/TestFlight; checklist `docs/app-store-apple.md`.

## Aggiornamento del 14/11/2026
Confermato: Matteo è minorenne e decide in concreto finalità e modalità. Le pagine pubbliche (IT/EN) descrivono i ruoli operativi, non attribuiscono la titolarità formale né l'offerta del servizio (segnaposto `titolare-trattamento`, da decidere con un professionista tenendo conto di capacità giuridica e rappresentanza dei genitori), non qualificano Cloudflare e Google, e non rivelano l'età di Matteo (scelta dei genitori). `email-fornitore` diventa requisito indispensabile (10 aperti).

## Aggiornamento del 14/11/2026 (2)
Fatti comunicati: i genitori supervisionano; un genitore, intestatario dell'account Play, è disponibile a valutare di assumere formalmente il ruolo di **offerente del servizio** (proposto, **non** formalizzato: nessuna accettazione documentata); gli account **Cloudflare e Gmail sono intestati a Matteo** e il genitore era presente alle accettazioni, ma **non risulta rappresentanza formale documentata**; pubblico **14+** con verifica per Paese; nome, marchio e grafiche opera di Matteo; **AdMob** unica monetizzazione futura, non presente nella versione attuale (1.0.1 secondo i genitori; nel repository `versionName` è ancora 1.0).

| Ruolo | Stato |
|---|---|
| Sviluppatore e gestore operativo | Matteo Bianchi (minorenne); decide in concreto finalità e modalità |
| Intestatario account Google Play | un genitore (nome non fornito) |
| Intestatario account Cloudflare e Gmail | Matteo; nessuna rappresentanza formale documentata |
| Offerente del servizio | proposto: il genitore; **non formalizzato** (`offerente-servizio`) |
| Titolare del trattamento | **non attribuito**; da validare con un professionista (`titolare-trattamento`) |
| Responsabili del trattamento | nessuno qualificato finché non esistono prove degli accordi (`cloudflare-dpa`, `email-fornitore`) |
| Autore di nome, marchio e grafiche | Matteo; asset/licenze di terzi da verificare (`diritti-asset`) |

Requisiti aperti indispensabili: indirizzo-titolare, cloudflare-dpa, minori, diritti-asset, email-fornitore, account-sviluppatore-play, titolare-trattamento, account-apple-developer, trader-dsa, eta-pubblico-store, **offerente-servizio**, **rappresentanza-capacita**. Facoltativi: ricompense-social-policy, **admob-futuro** (solo prima della versione con annunci), conservazione-inattivi, verifica-identita-richieste, legge-foro. Le pagine pubbliche non menzionano gli account di Cloudflare e Gmail né l'età di Matteo.
