# Valutazioni e proposte (nessuna implementata)

## 1. AI esterna per «Chiedi al gioco» (via Cloudflare)
Stato: «Chiedi al gioco» è locale (`src/core/ask-game.js`): tabella di argomenti verificati, nessuna rete, nessun costo.
Opzione esterna: un endpoint del Worker che chiama un modello (Workers AI o API di terzi) con il manuale come contesto.
- **Costi**: Workers AI ha un piano gratuito limitato e poi paga a token; un’API di terzi paga sempre. Va fissato un tetto giornaliero per utente e globale, con interruttore remoto.
- **Privacy**: la domanda del giocatore lascerebbe il dispositivo. Serve consenso esplicito, nessun dato di carriera (nome, partito, salvataggio) nella richiesta, nessun log delle domande oltre il necessario, informativa privacy aggiornata.
- **Sicurezza**: la chiave non va mai nell’app; solo il Worker la conosce. Rate limit per dispositivo/account, lunghezza massima, filtro dei contenuti, risposta solo dal manuale (RAG) e «non lo so» se non c’è.
- **Raccomandazione**: restare sul locale finché le domande non riconosciute (misurabili con un contatore locale anonimo) non diventano frequenti; poi valutare un modello piccolo con tetto di spesa. Nessun servizio a pagamento attivato.

## 2. Foto → avatar
- **Architettura**: elaborazione locale (nel browser/WebView) preferibile: il volto non lascia il dispositivo. Tre vie: (a) stima di tratti con un modello leggero on-device (colore pelle/capelli, presenza di barba/occhiali) mappati sulle opzioni esistenti dell’editor; (b) servizio esterno che genera un avatar illustrato; (c) nulla.
- **Qualità**: (a) dà un punto di partenza approssimato ma sempre modificabile nell’editor (le opzioni sono già discrete); (b) più fedele ma costa e invia una foto a terzi.
- **Costi**: (a) nessun costo di servizio, peso del modello (qualche MB) da scaricare; (b) a pagamento per immagine.
- **Consenso e privacy**: la foto è un dato biometrico-adiacente: consenso esplicito prima dell’uso, nessun salvataggio della foto (si scarta dopo l’estrazione dei tratti), nessun invio senza un secondo consenso dedicato, cancellazione immediata.
- **Raccomandazione**: se si procede, solo (a), con la foto mai salvata né inviata. Nessuna API a pagamento e nessun invio di fotografie sono stati attivati.

## 3. Proposta: nuove modalità di gioco e scenari iniziali
Nessuna è implementata; vanno valutate prima (equilibrio, dati, test).
**Modalità**
- *Legislatura breve*: 12 mesi di gioco con obiettivi fissi (tre leggi, un’elezione), pensata per sessioni da mezz’ora e per un tabellone globale.
- *Crisi di governo*: parte con un governo in bilico; vince chi tiene insieme o ricostruisce la maggioranza. Usa le meccaniche di fiducia e alleanze già presenti.
- *Cronista parlamentare*: si gioca senza incarico, dal punto di vista della stampa: scene in redazione, inchieste e fonti, con effetto sul clima politico.
- *Campagna a tappe*: solo le sei settimane prima di un voto, con eventi di piazza e dibattiti; molto adatta ai nuovi giocatori.
- *Sindaco di un piccolo comune*: gestione locale con bilancio ridotto e assemblee cittadine; un percorso più semplice come introduzione.
**Scenari iniziali**
- *Il nuovo partito dopo uno scandalo* (si riparte da una lista civica con fiducia bassa).
- *Il candidato di coalizione* (parti con alleati già scelti ma programma da concordare).
- *Il ritorno dopo la sconfitta* (carriera già avviata, un mandato perso, una rete da ricostruire).
- *Il referendum che cambia tutto* (parti con una raccolta firme già lanciata e tempi stretti).
**Caratteristiche distintive**: obiettivi chiari per partita, sfide settimanali condivise senza classifica obbligatoria, e un tutorial dedicato per modalità.
