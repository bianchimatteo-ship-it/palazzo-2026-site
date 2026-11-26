# Deploy di Politicando TEST da Visual Studio Code

Solo il sito **TEST** (`politicando-test`, protetto da una password gestita dal Worker (`TEST_ACCESS_ENABLED=1`, secret `TEST_ACCESS_PASSWORD`)). Il Worker di produzione (`wrangler.jsonc`) e i suoi D1/KV/R2 **non si toccano**: non usare mai `npm run cf:deploy` né `-c wrangler.jsonc`.

## 1. Branch e commit
- Branch da selezionare: **`feature/inmobi-integrazione`** (contiene anche `miglioramento-completo`, `qa-completamento`, `ios-admob-android` e `test/ambiente-privato`; `main` non è toccato).
- Commit più recente: quello in cima a `git log -1 --oneline` dopo l’aggiornamento; deve coincidere con l’hash comunicato nel rapporto finale.

```bash
git fetch origin
git checkout feature/inmobi-integrazione
git pull --ff-only origin feature/inmobi-integrazione
git log -1 --oneline        # confronta con l’hash del rapporto
git status                  # deve essere pulito (i file locali sotto sono ignorati da git)
```

## 2. File locali da avere (NON sono nel repository e NON vanno committati)
| File | A cosa serve | Note |
|---|---|---|
| `wrangler.test.local.jsonc` | copia di `wrangler.test.jsonc` con gli **id reali del TEST**: KV `ADMIN_ARCHIVE`, D1 `politicando-accounts-test` (`database_id`), R2 `politicando-logos-test`, `PUBLIC_BASE_URL` = indirizzo del sito TEST | In `.gitignore`. Mai gli id di produzione. |
| `.dev.vars` | variabili/segreti solo per `wrangler dev` locale | In `.gitignore`. Non serve per il deploy. |
| Segreti del Worker TEST (facoltativi) | `EMAIL_GATEWAY_URL`/`EMAIL_GATEWAY_SECRET` solo se hai un gateway e-mail **separato** di prova | Impostali con `npx wrangler secret put NOME -c wrangler.test.local.jsonc`. |
| Accesso Cloudflare | `npx wrangler login` (account che possiede il TEST) | Verifica con `npx wrangler whoami`. |

Se `wrangler.test.local.jsonc` non esiste: `cp wrangler.test.jsonc wrangler.test.local.jsonc` e sostituisci ogni `REPLACE_WITH_…` con l’id della risorsa **di prova** (Dashboard → Storage & Databases). Il file `wrangler.test.jsonc` del repository resta con i segnaposto: così un deploy sbagliato fallisce.

## 3. Controlli prima del deploy
```bash
npm ci                              # solo se node_modules manca o package-lock è cambiato
npm run check:publication           # nessun id/nome/URL/segreto di produzione nei file TEST
npm run check:security
npm run check:test-access           # cancello con password: tutto chiuso senza sessione
npx wrangler@4 deploy --dry-run --outdir .wrangler/dry -c wrangler.test.local.jsonc   # costruisce il Worker, non pubblica nulla
```
Nella tabella delle risorse stampata dal dry-run controlla che:
- `ADMIN_ARCHIVE` (KV), `ACCOUNTS` (D1: nome `politicando-accounts-test`) e `LOGOS` (R2: `politicando-logos-test`) siano **le risorse di prova**;
- `PUBLIC_BASE_URL` sia l’indirizzo del sito TEST;
- non compaia nessun nome/id di produzione.

## 3b. Aggiorna `wrangler.test.local.jsonc` e imposta la password (nel TUO terminale)
Il file locale (non tracciato) deve avere le stesse novità di `wrangler.test.jsonc`: in `vars` aggiungi `"TEST_ACCESS_ENABLED": "1"` e in `assets` usa `"run_worker_first": ["/*"]`. Poi:
```bash
npx wrangler@4 secret put TEST_ACCESS_PASSWORD -c wrangler.test.local.jsonc   # la password si digita nel terminale, mai in chat
```
`.assetsignore` ora esclude `wrangler.test.local.jsonc`, `.dev.vars*`, `.env*`, chiavi e il modulo del cancello: il deploy precedente aveva caricato il file locale come asset pubblico, questo no.

## 4. Comando di deploy (solo TEST)
```bash
npx wrangler@4 deploy -c wrangler.test.local.jsonc
```
(`npm run cf:deploy:test` usa `wrangler.test.jsonc` con i segnaposto: serve solo come prova di fallimento sicuro.)

## 5. Database e verifica dell’URL
1. Le tabelle D1 si creano al primo uso; per applicare le migrazioni a mano: `npx wrangler@4 d1 migrations apply politicando-accounts-test --remote -c wrangler.test.local.jsonc`.
2. Controlla che il database sia quello di prova: `npx wrangler@4 d1 list` → deve comparire `politicando-accounts-test` con **lo stesso `database_id`** scritto in `wrangler.test.local.jsonc`; non deve essere l’id del D1 di produzione.
3. Verifica automatica (dal tuo terminale, la password solo nell'ambiente del comando): `TEST_BASE_URL=https://politicando-test.<tuo-account>.workers.dev TEST_ACCESS_PASSWORD='…' npm run verify:test-deploy` controlla: tutto 401 senza password, password errata, login con cookie Secure/HttpOnly/Strict, asset e API con sessione, `/wrangler.test.local.jsonc` → 404, uscita. Poi apri l'URL da una finestra anonima: deve mostrare il modulo della password. Se apre direttamente il gioco, **non usare il sito**.
4. Dopo il login: la schermata iniziale si apre, «Nuova partita» crea una carriera, il pannello Sondaggi → Alleanze mostra «Progetto Civico Italia» con il programma documentato.
5. `https://palazzo-2026-site.bianchimatteo657.workers.dev/` (produzione) deve restare invariato: solo portale, nessun cambiamento di versione.

## 6. Cose che NON fare
- Non eseguire `npm run cf:deploy`, `wrangler deploy` senza `-c`, né modificare `wrangler.jsonc`.
- Non impostare `ADS_CONFIG` sul Worker TEST con formati attivi: la pubblicità reale resta spenta.
- Non incollare token, chiavi o id di produzione in chat, in file tracciati o nei commit.

## 7. Prova reale dell’e-mail (solo TEST, casella di prova tua)
Il gateway simulato dei test automatici (`check:email-gateway`, `check:account-recovery`) **non prova** l’invio reale. Dopo il deploy TEST, e solo se sul Worker TEST sono impostati `EMAIL_GATEWAY_URL` e il secret `EMAIL_GATEWAY_SECRET` (di un gateway **separato** da quello di produzione):
1. `curl -s https://<sito-test>/api/account/status` → deve dire `"email": true`. Con `false` il gioco mostra «Al momento il servizio non riesce a spedire e-mail»: l’invio non è attivo.
2. Registra un account di prova con un indirizzo di una casella **tua** di prova; deve arrivare il messaggio «POLITICANDO 2026 — conferma il tuo indirizzo email»; apri il collegamento (si apre sul dominio TEST, valido 48 ore, una sola volta).
3. «Password dimenticata» → indirizzo → arriva «nuova password» (collegamento valido 30 minuti, una sola volta); scegli una nuova password; la vecchia deve fallire, la nuova funzionare, le altre sessioni chiudersi.
4. Elimina l’account di prova dal gioco. Non usare indirizzi di utenti reali.

## 8. Dopo il deploy: verifiche in 5 minuti
- Home: nessuna schermata «Caricamento…» fissa; se un file non si carica compare il messaggio con «Riprova» (guardia di avvio).
- «Carica partita» di una carriera salvata prima del 18/11 con un voto politico/europeo concluso: il resoconto storico mostra «Altri» coerente (migrazione versionata, copia di sicurezza `prima-correzione-voti` nel browser).
- Sondaggi → Alleanze: invitare un partito che è già in un altro accordo mostra la scelta «Invita soltanto questo partito» / «Proponi la fusione delle intere alleanze» con l’anteprima.


## Test e-mail reale (script)

`TEST_BASE_URL=https://<sito-test> [CF_ACCESS_CLIENT_ID=… CF_ACCESS_CLIENT_SECRET=…] node scripts/email-real-test.mjs --yes` registra un account di prova e chiede la verifica verso `politicando2026simulazione@gmail.com`. Rifiuta host senza «test», richiede `--yes`, non salva né stampa segreti e non fa parte di `check:all`. Esito reale (arrivo del messaggio) da confermare a mano nella casella. Non eseguito in questo ambiente: mancano URL e credenziali del TEST.
