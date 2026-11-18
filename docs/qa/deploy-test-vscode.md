# Deploy di Politicando TEST da Visual Studio Code

Solo il sito **TEST** (`politicando-test`, protetto da Cloudflare Access). Il Worker di produzione (`wrangler.jsonc`) e i suoi D1/KV/R2 **non si toccano**: non usare mai `npm run cf:deploy` né `-c wrangler.jsonc`.

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
npx wrangler@4 deploy --dry-run --outdir .wrangler/dry -c wrangler.test.local.jsonc   # costruisce il Worker, non pubblica nulla
```
Nella tabella delle risorse stampata dal dry-run controlla che:
- `ADMIN_ARCHIVE` (KV), `ACCOUNTS` (D1: nome `politicando-accounts-test`) e `LOGOS` (R2: `politicando-logos-test`) siano **le risorse di prova**;
- `PUBLIC_BASE_URL` sia l’indirizzo del sito TEST;
- non compaia nessun nome/id di produzione.

## 4. Comando di deploy (solo TEST)
```bash
npx wrangler@4 deploy -c wrangler.test.local.jsonc
```
(`npm run cf:deploy:test` usa `wrangler.test.jsonc` con i segnaposto: serve solo come prova di fallimento sicuro.)

## 5. Database e verifica dell’URL
1. Le tabelle D1 si creano al primo uso; per applicare le migrazioni a mano: `npx wrangler@4 d1 migrations apply politicando-accounts-test --remote -c wrangler.test.local.jsonc`.
2. Controlla che il database sia quello di prova: `npx wrangler@4 d1 list` → deve comparire `politicando-accounts-test` con **lo stesso `database_id`** scritto in `wrangler.test.local.jsonc`; non deve essere l’id del D1 di produzione.
3. Apri `https://politicando-test.<tuo-account>.workers.dev/` da una finestra anonima: deve chiedere il login Cloudflare Access e accettare **solo** il tuo indirizzo e-mail. Se apre direttamente il gioco, Access non è attivo: non usare il sito (docs/ambiente-test-privato.md, punto 5).
4. Dopo il login: la schermata iniziale si apre, «Nuova partita» crea una carriera, il pannello Sondaggi → Alleanze mostra «Progetto Civico Italia» con il programma documentato.
5. `https://palazzo-2026-site.bianchimatteo657.workers.dev/` (produzione) deve restare invariato: solo portale, nessun cambiamento di versione.

## 6. Cose che NON fare
- Non eseguire `npm run cf:deploy`, `wrangler deploy` senza `-c`, né modificare `wrangler.jsonc`.
- Non impostare `ADS_CONFIG` sul Worker TEST con formati attivi: la pubblicità reale resta spenta.
- Non incollare token, chiavi o id di produzione in chat, in file tracciati o nei commit.
