# Reattività dei pulsanti — cause, correzioni, misure

Misure fatte con Chrome headless (Chromium di Playwright), schermo 390×844, CPU rallentata 4× (telefono di fascia media),
mouse reale (`Input.dispatchMouseEvent`), `PerformanceObserver` sugli eventi (script di misura in `/tmp/qa/perf.mjs`, non nel repository).
Ogni valore è il peggiore degli eventi dopo il clic. Variazione da una prova all'altra: circa ±120 ms.

| Azione | Prima (9eb2ca8) | Dopo | Nota |
|---|---|---|---|
| Scheda Sondaggi | 576 ms | 184–408 ms | formattatori memorizzati |
| Scheda Elezioni | 552 ms | 224–352 ms | idem |
| Scheda Istituzioni | 728 ms | 304–464 ms | idem |
| Home | 464 ms | 384–608 ms | invariato: pesa il layout del browser (≈665 ms «program» nel profilo), non lo script |
| Chiudi settimana | 872 ms | 752–1056 ms | invariato: è la simulazione vera della settimana |
| Altro | 328 ms | 256–304 ms | |

## Cause trovate
1. **Formattatori `Intl` costruiti a ogni chiamata** (date e numeri) in `time.js`, `charts.js`, `polls-mode.js`, `policy-mode.js`, `sections-kit.js`: decine di migliaia di costruzioni a ogni ridisegno → memorizzati.
2. **Doppio tocco**: due tocchi veloci su «Chiudi settimana» chiudevano due settimane → protezione `SINGLE_TAP` in `app.js` (un solo tocco per azione nel tempo di ridisegno).
3. **Errori silenziosi**: un'eccezione in un gestore lasciava il pulsante «morto» senza dire nulla → `watchErrors` registra l'errore nel registro diagnostico (`core/diagnostics.js`) e mostra un avviso; il registro si copia dalle impostazioni.
4. **Nessun feedback alla pressione**: stato `:active` immediato e `touch-action: manipulation` (niente attesa del doppio tocco) in `theme.css`.
5. **Ridisegno dell'intera pagina a ogni azione** (innerHTML dell'intera shell): resta la causa dominante di Home e Istituzioni; un ridisegno parziale richiederebbe una riscrittura del rendering e non è stato fatto. Provato `content-visibility: auto` sulle schede: nessun miglioramento misurabile, scartato.

## Cosa non è stato toccato
Nessun controllo di sicurezza e nessuna attesa di sincronizzazione sono stati rimossi; le azioni passano dallo store e la pagina si ridisegna dopo l'esito (nessun aggiornamento ottimistico non confermato).

Test: `scripts/check-button-response.mjs`.
