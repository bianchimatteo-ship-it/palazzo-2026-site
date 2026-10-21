# Conservazione degli account inattivi (12 mesi, con preavviso) — procedura SPENTA

Stato al 20/10/2026. **Non è in funzione e non cancella nulla.** Non è un parere legale.

## Obiettivo
Eliminare gli account non usati da 12 mesi, dopo un preavviso di 30 giorni.

## Perché oggi è spenta
- Il preavviso può raggiungere solo chi ha un indirizzo e-mail **verificato**; il canale e-mail (gateway Google Apps Script, `EMAIL_GATEWAY_SECRET`) non è configurato (`docs/account-email.md`): oggi nessuna e-mail parte.
- Un account senza e-mail verificata **non viene mai eliminato dalla procedura** (non si può avvisare): il rapporto lo elenca come `non-avvisabile`.

## Come funziona (in `worker.js`)
- **Ultima attività** = il massimo tra creazione dell'account, apertura di una sessione e scrittura di un salvataggio. Limite noto: una sessione scade dopo 30 giorni e viene eliminata, quindi un accesso senza salvataggi non conta dopo quel termine. (Per non modificare lo schema in produzione non è stato aggiunto un campo `last_active_at`.)
- `planRetention(db, now)`: **sola lettura**; per ogni account dice `attivo`, `avvisare`, `in-preavviso`, `eliminare` o `non-avvisabile`.
- `runRetention(env, now)`: agisce solo se `retentionState(env).enabled`, cioè se **tutte e tre** le condizioni valgono: `RETENTION_ENABLED = "1"`, canale e-mail configurato (`EMAIL_GATEWAY_URL` + `EMAIL_GATEWAY_SECRET`), `RETENTION_NOTICE_TESTED = "1"` (da impostare solo dopo aver ricevuto davvero un preavviso di prova). Alla prima esecuzione crea la tabella `retention_notices`; spenta, non crea nulla.
  1. Preavviso: e-mail con la data di eliminazione (30 giorni); la riga in `retention_notices` si scrive **solo se l'invio riesce**.
  2. Dopo 30 giorni, se l'account non ha avuto attività dopo il preavviso: una sola eliminazione (`deleteAccountData`: salvataggi, cronologia, stato, e-mail, token, sessioni, avviso, account, in un batch). Chi torna a giocare nel frattempo non viene eliminato; un preavviso più vecchio dell'ultima attività non vale.
  - Al massimo 50 preavvisi e 50 eliminazioni per esecuzione (cron giornaliero già configurato in `wrangler.jsonc`).
- Prova: `node scripts/check-retention.mjs` (SQLite in memoria al posto di D1: nessun database o account reale).

## Per accenderla (a cura del titolare, in quest'ordine)
1. Attivare l'invio e-mail (`docs/account-email.md`) e verificare il fornitore nell'informativa (marcatore `email`).
2. Chiedere a sé stessi un preavviso di prova e confermarne la ricezione; impostare `RETENTION_NOTICE_TESTED=1`.
3. Guardare il rapporto di `planRetention` (non modifica nulla) e decidere cosa fare degli account `non-avvisabile`.
4. Impostare `RETENTION_ENABLED=1`; aggiornare l'informativa (marcatore `conservazione`) e rieseguire `node scripts/check-account-deletion.mjs --release`.
