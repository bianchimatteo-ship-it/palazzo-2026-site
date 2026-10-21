# Email degli account: verifica e recupero password

Stato: **implementato e provato in locale; l'invio reale non è stato verificato** (nessuna credenziale del provider in questo ambiente). Non dichiarare la consegna delle email funzionante finché non è stata provata su un indirizzo vero.

## Cosa fa il Worker (`worker.js`)
- Un account può avere un solo indirizzo (tabella `user_emails`), **facoltativo**. Gli account esistenti continuano ad accedere con le credenziali di sempre e possono aggiungerne uno da *Menu → Account* (serve la password).
- L'indirizzo conta per il recupero solo se **verificato** con un collegamento monouso (48 ore). Un indirizzo verificato appartiene a un solo account.
- Recupero: `POST /api/account/recover` risponde sempre allo stesso modo (non rivela se l'account o l'indirizzo esistono). Se l'indirizzo è verificato parte un messaggio con un collegamento (30 minuti, monouso) alla schermata di reimpostazione; il browser ricava la prova della nuova password (PBKDF2, come per l'accesso) e il server non vede mai la password.
- I token sono 256 bit casuali; il database conserva soltanto l'impronta SHA-256. Cambiare la password chiude tutte le sessioni dell'account e annulla gli altri collegamenti di recupero.
- Limiti: 6 richieste per indirizzo di rete e 3 per casella ogni 15 minuti (`attempts`).
- `ACCOUNT_EMAIL_REQUIRED=1` rende l'email obbligatoria alla registrazione (di default no, perché senza provider configurato bloccherebbe la creazione di account).

## Cosa serve per attivare l'invio reale (a cura del titolare)
1. Un account presso un fornitore di invio email (il codice supporta **Resend**, `https://api.resend.com/emails`) e un dominio mittente verificato (SPF/DKIM).
2. Segreto del Worker: `npx wrangler secret put RESEND_API_KEY`.
3. Variabili in `wrangler.jsonc` (`vars`) o nel pannello: `EMAIL_FROM` (es. `POLITICANDO <no-reply@tuodominio.it>`) e `PUBLIC_BASE_URL` (es. `https://palazzo-2026-site.bianchimatteo657.workers.dev`).
4. Applicare le migrazioni additive `migrations/0003_save_protocol.sql` e `migrations/0004_email_recovery.sql` (`wrangler d1 migrations apply politicando-accounts`) — il Worker comunque le crea da solo con `CREATE TABLE IF NOT EXISTS`. **Non sono state eseguite sul database di produzione.**
5. Quando l’invio sarà attivato, aggiornare l’informativa (`privacy.html`, paragrafo «E-mail e recupero della password»: oggi dice che il servizio non invia e-mail) con il fornitore, il suo ruolo e gli eventuali trasferimenti extra-SEE, e registrare il fatto in `docs/legale-requisiti.json`.
6. Provare: aggiungere un indirizzo vero, aprire il collegamento, poi «Password dimenticata?».
Finché 1–3 mancano, `/api/account/status` risponde `email: false`, il gioco lo dice e nessun messaggio viene spedito.

## Test
`npm run check:accounts` (server, token, limiti, riuso, scadenza, account legacy), `npm run check:account-isolation` (browser: schermate, collegamenti, sessione), `npm run check:security` (informativa coerente col Worker). Il Worker è eseguito in processo con un trasporto di prova (`env.EMAIL_SEND`), che esiste solo nei test: i segreti del Worker sono stringhe.


## Prova reale (da eseguire dopo la configurazione, non ancora eseguita)
Il recupero della password è **operativo in produzione solo dopo questa prova**:
1. Verificare `GET /api/account/status` → `email: true` (richiede `RESEND_API_KEY`, `EMAIL_FROM` e dominio mittente verificato).
2. Con un account di prova e un indirizzo che si controlla: Menu → Account → aggiungere l’indirizzo → ricevere il messaggio → aprire il collegamento (valido 48 ore) → stato «verificato».
3. Disconnettersi → «Password dimenticata?» → indirizzo → ricevere il messaggio (collegamento valido 30 minuti) → scegliere una nuova password → accedere con la nuova; la vecchia deve fallire e le sessioni precedenti devono essere chiuse.
4. Controllare mittente, oggetto, mancata finitura in spam, collegamento che porta a `PUBLIC_BASE_URL`; riaprire il collegamento già usato: deve essere rifiutato.
5. Eliminare l’account di prova dal gioco.
