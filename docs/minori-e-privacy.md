# Minori e privacy — analisi del trattamento reale e decisioni aperte (22/10/2026)

Documento di lavoro tecnico. **Non è un parere legale**: dice che cosa il codice fa davvero, quali obblighi vanno valutati e che cosa deve decidere o far verificare a un professionista il titolare (Matteo Bianchi, persona fisica). Le norme sono citate dalla conoscenza dell'autore: prima di dichiarare qualcosa a Google Play o a terzi vanno ricontrollate sui testi vigenti.

## 1. Che cosa viene trattato davvero

| Situazione | Dati che arrivano ai server | Fonte nel codice |
|---|---|---|
| Si gioca **senza account** (web o app Android) | Nessun dato di gioco. Solo i dati tecnici di connessione che Cloudflare tratta per servire i file del sito. | `src/core/storage.js` (localStorage/IndexedDB nel dispositivo) |
| Si crea un **account** | Nome utente, impronta della password (PBKDF2 nel browser + hash salato nel server), data di creazione, sessioni (impronta del codice, scadenza 30 giorni), IP nella tabella dei tentativi (finestra 15 minuti, righe eliminate dopo 24 ore), e-mail **facoltativa** con impronta del collegamento monouso, salvataggi online (max 12, più versioni precedenti). | `worker.js`, `migrations/` |
| E-mail inserita | L'indirizzo e il testo del messaggio passano da Google Apps Script/Gmail (gateway `EMAIL_GATEWAY_URL`). | `worker.js`, `docs/account-email.md` |
| Loghi personali | Restano in IndexedDB sul dispositivo, per account; mai inviati ai server né inseriti nei salvataggi. L'importazione da indirizzo contatta una volta il sito che ospita l'immagine. | `src/data/repositories/personal-logos.js` |
| Pubblicità, analisi, profilazione, pagamenti, cookie, SDK di terzi, permessi Android oltre `INTERNET` | **Nessuno.** | `android/app/src/main/AndroidManifest.xml`, `scripts/check-security.mjs` |

La **data di nascita** che compare nella creazione del personaggio è un dato inventato della partita: non riguarda chi gioca e non va mai usata per dedurre l'età dell'utente.

## 2. Basi giuridiche e soglia dei 14 anni

- L'art. 8 GDPR e l'art. 2-quinquies del Codice privacy (soglia di 14 anni in Italia) riguardano il **consenso** come base giuridica per i servizi della società dell'informazione offerti direttamente ai minori. Le basi indicate nell'informativa per l'account sono il contratto di servizio richiesto dall'interessato (art. 6, par. 1, lett. b) e il legittimo interesse per la sicurezza (lett. f), **non** il consenso. La soglia dei 14 anni quindi non si applica automaticamente, e non si può assumere che ogni trattamento abbia la stessa base.
- Resta aperta la questione civilistica: un minore di 18 anni ha capacità di agire limitata e il contratto di servizio con un account potrebbe essere annullabile. Per un servizio gratuito, senza pagamenti e con dati minimi il rischio è basso ma **va valutato da un professionista**; il codice non può risolverlo.
- L'informativa deve essere comprensibile da chi la legge, minori compresi (art. 12 GDPR, considerando 38 e 58). Il paragrafo «Minori» è scritto in frasi brevi e dice che cosa succede sotto i 14 anni; **non** è stata redatta una versione apposita per bambini: è una decisione del titolare.
- Se il titolare volesse basare l'account dei minori di 14 anni sul consenso, servirebbe quello dei genitori con «ragionevoli sforzi» di verifica (art. 8, par. 2). Non esiste alcuna procedura di questo tipo e non è stata inventata.

## 3. Google Play, Famiglie e normative estere

- La dichiarazione «Pubblico di destinazione» di Play Console non è una scelta tecnica: se include fasce d'età inferiori ai 13 anni, o un pubblico misto con bambini, si applicano le **Norme per le famiglie** (SDK e annunci certificati, nessun trattamento non necessario di dati dei bambini, schermata di verifica dell'età neutra, ecc.). Le definizioni precise delle fasce vanno lette nella console al momento della compilazione.
- Negli Stati Uniti il COPPA riguarda i servizi rivolti a minori di 13 anni o con conoscenza effettiva della loro età, e prevede il consenso verificabile dei genitori per la raccolta di dati personali (nome utente, e-mail e IP lo sono). Un'app distribuita nel mondo ne è potenzialmente toccata.
- **Non** si sceglie la fascia d'età per far passare i controlli. Le alternative che il titolare deve scegliere, con il suo consulente, sono:
  1. **Pubblico 14+ (o 16+) con account**, e gioco locale senza account aperto a tutti: oggi è ciò che fa il codice. Occorre però verificare se il gioco, con la sua grafica e il suo tema, sia o meno «rivolto anche ai bambini» ai fini delle norme: dichiarare 14+ non basta se il contenuto attira i bambini.
  2. **Pubblico che include i minori di 14 anni**: richiede di rispettare le Norme per le famiglie e, per l'account, un consenso dei genitori verificabile o la rinuncia all'account per i più piccoli (come ora).

## 4. Misure tecniche già nel codice

1. **Il gioco funziona per intero senza account** e senza inviare nulla ai server: i minori di 14 anni possono giocare senza che il titolare riceva alcun loro dato.
2. **Schermata d'età neutra alla registrazione** (`data-account-form="register"`, campo `ageBand`): scelta tra «meno di 14 anni» e «14 anni o più», senza preselezione. La risposta **non è salvata né inviata**; sotto i 14 anni l'account non si crea e il messaggio rimanda al gioco locale. È un'autodichiarazione, non una verifica: il server non la può controllare e non la riceve (un controllo lato server non aggiungerebbe garanzie, solo un dato in più).
3. **Nessuna raccolta non necessaria**: niente nome reale, telefono, posizione, data di nascita dell'utente, documenti; e-mail facoltativa; nessuna pubblicità, analisi, profilazione, pagamento, cookie o SDK; il manifest Android chiede solo `INTERNET`.
4. **Eliminazione**: dal gioco (Menu → Account) e dalla pagina pubblica `elimina-account.html` / `delete-account-en.html`, con la password; il server rimuove account, salvataggi con le versioni precedenti, e-mail, collegamenti e sessioni (`scripts/check-account-deletion.mjs`). Con e-mail verificata la password si può prima recuperare. Se la password è persa, la richiesta di un genitore passa dal contatto del titolare ed è valutata caso per caso.
5. **Ritiro**: non c'è un consenso da ritirare (le basi non sono il consenso); l'eliminazione dell'account fa cessare il trattamento.

## 5. Decisioni e verifiche che spettano al titolare (bloccanti nel file `legale-requisiti.json`)

- Se i minori di 14 anni sono pubblico previsto; dichiarazione «Pubblico di destinazione», Famiglie e questionario IARC (non compilati qui).
- Se introdurre un consenso dei genitori verificabile per l'account (e con quale metodo che non raccolga documenti o dati superflui), oppure mantenere il divieto di account sotto i 14 anni.
- Una versione dell'informativa pensata per i bambini, se il pubblico lo richiede.
- La valutazione sulla capacità di concludere il contratto di servizio.
- Indirizzo reale del titolare, applicabilità/accettazione del DPA di Cloudflare, titolarità e licenze di marchio, testata e illustrazioni: invariati, **non** inventati.
- Chi è il titolare dell'account sviluppatore Google Play rispetto a chi gestisce il servizio (`account-sviluppatore-play`).

Nessun test automatico dichiara risolta una di queste questioni: `npm run check:legal -- --release` continua a fallire finché i requisiti indispensabili sono «mancanti».
