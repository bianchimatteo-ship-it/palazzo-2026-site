# Email degli account: verifica e recupero password

Stato: **gateway Google Apps Script integrato nel codice e provato con un gateway simulato; l'invio reale non è stato verificato** (il segreto non è configurato e nessuna e-mail reale è stata inviata). Non dichiarare la consegna delle email funzionante finché non è stata provata su un indirizzo vero.

## Cosa fa il Worker (`worker.js`)
- Un account può avere un solo indirizzo (tabella `user_emails`), **facoltativo**. Gli account esistenti continuano ad accedere con le credenziali di sempre e possono aggiungerne uno da *Menu → Account* (serve la password).
- L'indirizzo conta per il recupero solo se **verificato** con un collegamento monouso (48 ore). Un indirizzo verificato appartiene a un solo account.
- Recupero: `POST /api/account/recover` risponde sempre allo stesso modo (non rivela se l'account o l'indirizzo esistono). Se l'indirizzo è verificato parte un messaggio con un collegamento (30 minuti, monouso) alla schermata di reimpostazione; il browser ricava la prova della nuova password (PBKDF2, come per l'accesso) e il server non vede mai la password.
- I token sono 256 bit casuali; il database conserva soltanto l'impronta SHA-256. Cambiare la password chiude tutte le sessioni dell'account e annulla gli altri collegamenti di recupero.
- Limiti: 6 richieste per indirizzo di rete e 3 per casella ogni 15 minuti (`attempts`).
- `ACCOUNT_EMAIL_REQUIRED=1` rende l'email obbligatoria alla registrazione (di default no, perché senza provider configurato bloccherebbe la creazione di account).

## Come parte il messaggio (gateway Google Apps Script)
Il Worker non usa più Resend. Ogni messaggio (verifica dell'indirizzo, recupero della password, preavviso di eliminazione per inattività) è una richiesta `POST` JSON al gateway
`EMAIL_GATEWAY_URL` (web app di Apps Script, in `wrangler.jsonc` → `vars`) con i campi `secret`, `action: "sendMail"`, `to`, `subject`, `text`. Il gateway verifica `SHARED_SECRET` e l'host
del collegamento (`ALLOWED_RESET_HOST`) e spedisce da Gmail. Google risponde al POST con un redirect: il Worker lo segue; un invio conta come riuscito **solo** se la risposta è HTTP 200 con
JSON `{ "ok": true }`. Errori HTTP, pagine HTML, JSON non valido, `ok: false`, errori di rete e tempo scaduto (15 s) sono errori: la verifica risponde 502 «non è stato possibile inviare», il
recupero resta neutro, il preavviso di inattività non viene registrato (si riprova alla corsa successiva). Il segreto non compare in log, errori o risposte.
Gli oggetti ammessi sono esattamente tre (`MAIL_SUBJECTS` in `worker.js`): «POLITICANDO 2026 — conferma il tuo indirizzo email», «POLITICANDO 2026 — nuova password» e «POLITICANDO 2026: il tuo
account sarà eliminato per inattività». **La lista ammessa nel codice Apps Script deve contenere esattamente questi testi** (non verificato da qui: il codice del gateway non è nel repository).

## Cosa serve per attivare l'invio reale (a cura del titolare, non ancora fatto)
1. Nel gateway Apps Script: proprietà `SHARED_SECRET` e `ALLOWED_RESET_HOST` (l'host di `PUBLIC_BASE_URL`) già impostate; allow-list degli oggetti allineata a `MAIL_SUBJECTS`.
2. Segreto del Worker uguale a `SHARED_SECRET`: `npx wrangler secret put EMAIL_GATEWAY_SECRET` (mai nel repository). Finché manca, `mailConfigured()` è falso, `/api/account/status` risponde
   `email: false`, nessun messaggio parte e il gioco lo dice. Anche `EMAIL_GATEWAY_URL` deve essere un indirizzo `https://script.google.com/macros/s/<id>/exec`.
3. `PUBLIC_BASE_URL` (in `vars`) è il sito a cui portano i collegamenti dei messaggi.
4. Migrazioni additive `migrations/0003_save_protocol.sql` e `migrations/0004_email_recovery.sql` (`wrangler d1 migrations apply politicando-accounts`); il Worker comunque crea le tabelle da solo.
   **Non eseguite sul database di produzione.**
5. Quando l'invio è attivo, aggiornare l'informativa (`privacy.html` §6 dice oggi che non si inviano e-mail) con Google come fornitore dell'invio, e registrarlo in `docs/legale-requisiti.json`.
6. Provare con un indirizzo vero (sezione «Prova reale» sotto). Il preavviso di inattività resta spento (`RETENTION_ENABLED` e `RETENTION_NOTICE_TESTED` a "0").

## Test
`npm run check:email-gateway` (gateway simulato: richiesta esatta, conferma, 11 tipi di errore, flussi, risposte neutre, segreto assente da log e risposte), `npm run check:accounts` (server, token, limiti, riuso, scadenza, account legacy), `npm run check:account-isolation` (browser: schermate, collegamenti, sessione), `npm run check:security` (informativa coerente col Worker). Il Worker è eseguito in processo con un trasporto di prova (`env.EMAIL_SEND`), che esiste solo nei test: i segreti del Worker sono stringhe.


## Prova reale (da eseguire dopo la configurazione, non ancora eseguita)
Il recupero della password è **operativo in produzione solo dopo questa prova**:
1. Verificare `GET /api/account/status` → `email: true` (richiede `EMAIL_GATEWAY_SECRET` e il gateway raggiungibile).
2. Con un account di prova e un indirizzo che si controlla: Menu → Account → aggiungere l’indirizzo → ricevere il messaggio → aprire il collegamento (valido 48 ore) → stato «verificato».
3. Disconnettersi → «Password dimenticata?» → indirizzo → ricevere il messaggio (collegamento valido 30 minuti) → scegliere una nuova password → accedere con la nuova; la vecchia deve fallire e le sessioni precedenti devono essere chiuse.
4. Controllare mittente, oggetto, mancata finitura in spam, collegamento che porta a `PUBLIC_BASE_URL`; riaprire il collegamento già usato: deve essere rifiutato.
5. Eliminare l’account di prova dal gioco.
