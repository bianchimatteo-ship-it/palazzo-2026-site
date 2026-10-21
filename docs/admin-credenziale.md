# Credenziale dell’area amministrativa: procedura di sostituzione

La credenziale (il «PIN» dell’archivio condiviso) **non è mai scritta** nel codice, nel database, nei test, nei log, nel repository o in questa documentazione. Il server conserva soltanto
un record `pin-amministratore` nell’archivio chiave-valore (KV `ADMIN_ARCHIVE`): sale casuale, impronta PBKDF2-SHA-256 (100 000 iterazioni), data e un *epoch*. Ogni sessione
amministrativa conserva l’epoch con cui è stata aperta: cambiando credenziale cambia l’epoch e **tutte le sessioni precedenti smettono di valere** immediatamente (quelle ancora elencabili
nel KV vengono anche eliminate). Il limite di tentativi (8 errori ogni 15 minuti per indirizzo IP) vale sia per l’accesso sia per la sostituzione.

La credenziale non è precompilata in nessuna schermata (il campo è vuoto e `autocomplete` è `current-password`/`new-password`).

## Percorso A — dal gioco (consigliato, serve la credenziale attuale)
1. Area riservata → Archivio → «Archivio condiviso»: collegare il browser con la credenziale attuale.
2. «Cambia la credenziale di accesso» → inserire la credenziale attuale e la nuova (da 6 a 64 caratteri, diversa dalla precedente) → «Sostituisci la credenziale».
3. Il server verifica sessione e credenziale attuale, scrive il nuovo record (sale e impronta nuovi), chiude le altre sessioni e restituisce solo un nuovo token di sessione.

Servizio: `POST /api/admin/credential` con `Authorization: Bearer <sessione>` e corpo `{ currentPin, newPin }`.

## Percorso B — credenziale persa (serve il codice di attivazione del Worker)
Lo stesso endpoint accetta `{ newPin, setupCode }` senza sessione: `setupCode` è il segreto `ADMIN_SETUP_CODE` del Worker, noto solo al proprietario. Stessi limiti, stessa chiusura delle sessioni.

## Percorso C — scrittura diretta del record (offline, senza esporre la credenziale)
```
printf '%s' "<nuova credenziale>" | node scripts/admin-credential-record.mjs > record.json
npx wrangler kv key put --binding ADMIN_ARCHIVE "pin-amministratore" --path record.json --remote
rm record.json
```
Lo script legge la credenziale dall’input standard e stampa solo il record (sale, impronta, epoch). Non contatta Cloudflare: la scrittura nel KV di produzione la esegue il proprietario.
Attenzione alla cronologia della shell (usare un prompt senza cronologia o `HISTCONTROL=ignorespace`).

## Stato di questo intervento
- Preparato nel codice e provato in locale (`npm run check:admin-credential`): sostituzione riuscita, credenziale sbagliata rifiutata, sessione scaduta rifiutata, vecchie sessioni invalidate,
  limite di tentativi, assenza della credenziale in chiaro nel KV e nelle risposte.
- **Non** è stata modificata alcuna credenziale online né alcun KV di produzione e non è stato eseguito alcun deploy della procedura da questo intervento: la credenziale online cambia solo
  quando il proprietario esegue il percorso A, B o C dopo la pubblicazione del Worker aggiornato.
