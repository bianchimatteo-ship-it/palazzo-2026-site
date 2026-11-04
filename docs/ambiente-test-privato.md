# Pubblicazione: app Android, portale pubblico e sito di prova privato

**Stato del codice (nessun deploy fatto, nessuna risorsa toccata).** Il gioco completo si distribuisce solo come app Android (`www/` dentro l'app, backend di produzione). Il Worker di produzione risponde alle API e al **portale** (`portal/`); per ogni altro percorso non API risponde 404 (anche se un file del gioco finisse per errore tra gli asset: `PORTAL_PATHS` in `worker.js`). Il gioco web completo esiste solo nel sito di prova `wrangler.test.jsonc` (`GAME_WEB=1`).

- Produzione: `wrangler.jsonc` (stessi id di KV, D1, R2; asset = `./portal`). `PUBLIC_BASE_URL` è invariato: i collegamenti `/?verifica-email=…` e `/?reimposta-password=…` già nelle e-mail ora aprono il portale (stessi token e scadenze: il portale usa lo stesso client `account-sync.js`, copiato byte per byte da `npm run build:portal`).
- CORS: restano accettate le origini dell'app (`https://localhost`, `capacitor://localhost`) e quella del Worker; **GitHub Pages non è più un'origine del servizio**.
- E-mail: invariato (Google Apps Script + Gmail). Il sito di prova non ha `EMAIL_GATEWAY_URL`: non invia nulla.
- Controllo: `npm run check:publication` (e `check:all`).

## Ordine consigliato dei passaggi manuali

**A. Prima del deploy di produzione**
1. Crea le risorse di PROVA (Dashboard → Storage & Databases): un **D1** `politicando-accounts-test`, un **KV namespace** per l'archivio di prova, un bucket **R2** `politicando-logos-test`. Annota gli id.
2. In `wrangler.test.jsonc` sostituisci i segnaposto `REPLACE_WITH_…` con gli id di PROVA (mai quelli di produzione; `check:publication` fallisce se compaiono).
3. Distribuisci il sito di prova: `npm run cf:deploy:test` (crea il Worker `politicando-test`). Le tabelle D1 si creano da sole al primo uso (`migrations/` solo se vuoi applicarle: `wrangler d1 migrations apply politicando-accounts-test --remote -c wrangler.test.jsonc`).
4. Imposta `PUBLIC_BASE_URL` del sito di prova all'indirizzo del sito di prova (variabile nel Dashboard o nel file) e ridistribuisci.
5. **Proteggi il sito di prova con Cloudflare Access PRIMA di usarlo**: Zero Trust → Access → Applications → Add → Self-hosted; dominio = `politicando-test.<tuo-account>.workers.dev` (Workers → politicando-test → Settings → Domains & Routes: abilita "Cloudflare Access" per workers.dev); policy **Allow** → Include → Emails → solo il tuo indirizzo; nessuna policy Bypass/Everyone. Verifica da una finestra anonima che l'indirizzo chieda il login e rifiuti altri indirizzi.
6. (Facoltativo) secret del sito di prova: nessuno è necessario; `EMAIL_GATEWAY_SECRET` NON va impostato (nessuna e-mail dal sito di prova). Per provare i messaggi crea un gateway Apps Script separato e imposta `EMAIL_GATEWAY_URL` e il suo secret solo sul Worker di prova.
7. **Non applicare Access** né al Worker di produzione né alle sue API `/api/*`.

**B. Produzione (solo dopo A e dopo avere letto l'esito di `check:publication`)**
8. Disattiva GitHub Pages del repository (Settings → Pages → Unpublish): è la copia web pubblica del gioco.
9. Pubblica il commit (push su `main` → Workers Builds): da quel momento `https://palazzo-2026-site.bianchimatteo657.workers.dev/` mostra solo il portale. Non cambiano né le risorse né i dati.
10. Verifica: `/` e `/privacy.html` rispondono; `/src/main.js`, `/sw.js`, `/src/core/store.js` rispondono 404; l'app Android accede e sincronizza come prima; apri un collegamento di verifica e uno di recupero password ricevuti per e-mail (richiedine di nuovi dall'app) e completa le operazioni dal portale.
11. Disinstalla il Service Worker residuo dei vecchi visitatori non serve: `sw.js` ora risponde 404 e il browser lo scarta da solo.

## Collegamenti diretti verso l'app (facoltativo, richiede una nuova versione dell'app)
Il portale mostra su Android il pulsante «Apri l'app» (`intent://…;package=it.matteobianchi.politicando2026`). Perché il collegamento si apra nell'app serve una nuova build che dichiari uno schema `politicando://` o gli Android App Links (intent-filter con `autoVerify` per il dominio del Worker e `/.well-known/assetlinks.json` con l'impronta SHA-256 del certificato di firma). L'app attuale non è stata modificata: senza quell'aggiornamento il pulsante non fa nulla di dannoso e il flusso completo resta nel portale.

## Cosa è stato verificato dai test (senza rete né risorse reali)
App Android → Worker di produzione; 404 per il gioco in produzione; portale servito; API e origini Android; portale identico ai sorgenti; link e-mail invariati; sito di prova con risorse, nomi e URL diversi dalla produzione, id segnaposto, nessun gateway e-mail, nessun segreto.
