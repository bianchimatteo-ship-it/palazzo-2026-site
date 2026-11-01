# Traduzione automatica IT → EN

Stato: **il meccanismo è nel codice, il provider NON è configurato.** Finché non lo configuri, i testi senza traduzione restano in italiano e il gioco lo dichiara (`GET /api/translate/status` → `configured: false` con l’elenco di ciò che manca; `scripts/i18n-auto.mjs` lo scrive in chiaro). Il dizionario `src/data/i18n/en-ui-*.js` è un dizionario rivisto a mano, **non** traduzione automatica.

## Come funziona

| Livello | Dove | Cosa fa |
|---|---|---|
| Dizionario rivisto | `src/data/i18n/en-ui-*.js`, `keys.js` | Frasi esatte, modelli con `#` (numeri) e `{}` (parti libere). Vince sempre. |
| Traduzioni generate | `src/data/i18n/en-auto.js` | Prodotto da `scripts/i18n-auto.mjs` (sviluppo/build) col provider configurato; incluso nella build, funziona offline. |
| Cache del dispositivo | `src/core/i18n-auto.js` (`localStorage`, chiave `politicando.i18n.auto.v1`) | Testi nuovi a runtime (contenuti dinamici, testi introdotti da aggiornamenti futuri): chiesti al server **una volta**, poi riusati anche offline. |
| Server | `worker-translate.js` + `POST /api/translate` | Chiama il provider (la chiave è un secret del Worker, mai nella pagina), cache persistente in KV (`tr:v1:…`), tetto giornaliero di caratteri nuovi, limite di richieste per indirizzo. |

Cosa non viene mai tradotto né inviato: testi scritti dal giocatore (campi di testo, `data-no-translate`), nomi propri (testi senza parole italiane funzionali, sigle, nomi di partiti/persone/luoghi registrati dal gioco e protetti dentro le frasi che li contengono), numeri e segnaposto (`{nome}`, `%s`, `#`), il glossario politico-istituzionale (`GLOSSARY` in `worker-translate.js`, con il termine inglese fisso). I dati delle carriere non vengono mai modificati: la traduzione vive solo sullo schermo e nella cache.

Una risposta del provider che perde o altera un nome, un numero o un segnaposto viene **scartata** (resta l’italiano), non usata.

## Cosa serve da parte tua (nessun servizio a pagamento è attivato)

1. Scegli un provider: `deepl` (esiste un piano gratuito con chiave `…:fx`), `google` (a pagamento oltre le quote) oppure `libretranslate` (gratuito se lo ospiti tu).
2. Variabili del Worker: `TRANSLATE_PROVIDER` (`deepl|google|libretranslate`) e, solo per LibreTranslate, `TRANSLATE_API_URL`.
3. Secret del Worker: `npx wrangler secret put TRANSLATE_API_KEY`.
4. Opzionale: `TRANSLATE_DAILY_CHARS` (tetto giornaliero di caratteri nuovi, predefinito 200000).
5. Per le traduzioni «da build»: nella macchina che esegue `npm run build:www` imposta le stesse variabili d’ambiente (`TRANSLATE_PROVIDER`, `TRANSLATE_API_KEY`, …) e `CHROME_PATH`; `npm run i18n:auto` estrae i testi italiani ancora visibili in inglese e li traduce. `npm run i18n:auto:status` dice se è configurato.
6. Privacy: con il provider attivo i testi dell’interfaccia (non dati personali, non testi del giocatore) vanno a un fornitore esterno; aggiorna di conseguenza l’informativa (`privacy.html`, `privacy-en.html`).

## Controlli

`npm run check:i18n-auto` (protezione, Worker con provider finto, cache, offline, nessuna chiave nel client, pagina in Chrome) e `npm run check:i18n` (nessun testo italiano non autorizzato nell’inglese su tutte le schermate, popup, passaggi, tooltip e ARIA). Il test usa un provider finto: prova ciò che viene **inviato** e cosa si fa della **risposta**, non la qualità dell’inglese di un provider reale.
