# Traduzione automatica IT → EN (DeepL API)

## Come funziona

| Livello | Dove | Cosa fa |
|---|---|---|
| Dizionario rivisto | `src/data/i18n/en-ui-*.js`, `keys.js` | Frasi esatte, modelli con `#` (numeri) e `{}` (parti libere). Vince sempre. Copre il 100% delle stringhe del codice (`npm run check:i18n-census`) e delle schermate (`npm run check:i18n`). |
| Cache del dispositivo | `src/core/i18n-auto.js` (`localStorage`, chiave `politicando.i18n.auto.v2`) | Ciò che il dizionario non conosce (contenuti dinamici, testi di aggiornamenti futuri) viene chiesto al server **una volta**, poi riusato anche offline. |
| Server | `worker-translate.js`, `POST /api/translate` | Cache KV (`tr:v2:deepl:…`), contatore atomico su D1, un'unica chiamata accorpata a DeepL per i soli testi mancanti. |

**Cosa parte verso DeepL.** Solo *modelli anonimi*. La pagina sostituisce nomi (persone, partiti, luoghi: parole maiuscole a metà frase, sigle, nomi che il gioco conosce), numeri, date e variabili con `⟦0⟧, ⟦1⟧…` **prima** di parlare con il Worker: «Hai ottenuto 1.234 voti a Siena» viaggia come «Hai ottenuto ⟦1⟧ voti a ⟦0⟧» e i valori tornano al loro posto sul dispositivo. Il Worker rifiuta qualsiasi modello che contenga ancora una cifra, un indirizzo e-mail o un indirizzo web, sostituisce il glossario politico e ciò che riconosce ancora come nome con `<x i="k"/>` e manda a DeepL (`tag_handling: xml`, `ignore_tags: ["x"]`) solo quei tag anonimi e le parole italiane attorno. Mai: testi scritti dal giocatore, account, salvataggi, dati di carriera. Una risposta che perde o altera un segnaposto viene scartata (resta l'italiano).

**Italiano come ripiego.** Provider non configurato, limite raggiunto, rete assente, risposta scartata: il testo resta in italiano; `autoStatus()` / `GET /api/translate/status` dicono perché.

**Nessuna traduzione massiva.** Né la build né l'apertura dell'app traducono in blocco: si traduce a richiesta, un modello alla volta, con cache. `npm run build:www` non chiama DeepL.

## Configurazione (Worker `palazzo-2026-site`)

- `TRANSLATE_PROVIDER=deepl` (variabile, in `wrangler.jsonc`) — unico provider; nessun ripiego verso altri servizi.
- `TRANSLATE_API_KEY` (secret del Worker, già caricata; il repository non la contiene, il client non la vede).
- Endpoint: chiave che finisce con `:fx` → `https://api-free.deepl.com` (piano Free); qualsiasi altra chiave → `https://api.deepl.com` (piano a pagamento/Developer). È la regola di DeepL per i due host.
- Limiti (variabili, predefiniti tra parentesi): `TRANSLATE_DAILY_CHARS` (10000), `TRANSLATE_MONTHLY_CHARS` (100000), `TRANSLATE_REQUEST_CHARS` (2000 per richiesta), `TRANSLATE_MAX_TEXTS` (20 per richiesta), `TRANSLATE_RATE_PER_MIN` (20 richieste al minuto per indirizzo).

## Come si contano e si bloccano i consumi

- Il contatore è **globale e atomico**: una sola riga D1 (`translate_budget`) aggiornata con un'unica istruzione `INSERT … ON CONFLICT DO UPDATE … WHERE` che somma e controlla insieme tetto giornaliero e mensile. Due richieste simultanee non possono superare l'ultimo carattere disponibile. Non usa KV per contare.
- Si **prenotano** prima della chiamata i caratteri del payload realmente inviato (tag compresi). La prenotazione non viene mai restituita, nemmeno se la chiamata fallisce.
- Raggiunto un tetto: 429, nessuna chiamata a DeepL, nessun tentativo ripetuto. Contatore guasto: 503 e nessuna chiamata (*fail closed*).
- Errore di DeepL: 456/403/401 bloccano il servizio per 6 ore, 429/5xx e rete per 30 minuti (`blocked_until`), senza nuovi tentativi.
- Cache prima di tutto: cache del dispositivo → cache KV → solo dopo prenotazione e chiamata. Stesso testo in richieste simultanee: una sola chiamata (`translate_claims`). Una traduzione già disponibile non fa chiamate né addebiti.

## Monitoraggio

- `npm run i18n:auto` (o `GET /api/translate/status`): configurazione, limiti, **caratteri usati oggi e nel mese**, eventuale blocco. Non chiama DeepL e non consuma nulla.
- Da D1: `npx wrangler d1 execute politicando-accounts --remote --command "SELECT * FROM translate_budget"`.
- Quota effettiva presso DeepL: area account DeepL o `GET https://api.deepl.com/v2/usage` (o `api-free`), con la tua chiave, da fuori dal repository.
- Per fermare tutto subito: rimuovi `TRANSLATE_PROVIDER` (o mettilo a un altro valore) e distribuisci; oppure `UPDATE translate_budget SET blocked_until = 9999999999999`.

## Controlli

`npm run check:i18n-auto` (provider simulato: payload HTTP reale senza alcun dato, ripristino locale, cache, offline, limiti giornaliero/mensile/per richiesta/per indirizzo, 30 richieste simultanee, duplicati, errori e blocco, contatore guasto, origini Android, pagina in Chrome con profilo desktop e Android), `npm run check:i18n` (ogni schermata, popup, passaggio, tooltip e ARIA), `npm run check:i18n-census` (ogni stringa italiana del codice). Nessun controllo chiama DeepL.
