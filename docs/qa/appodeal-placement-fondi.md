# Video premiato da 1.000 € di fondi personali: placement Appodeal `personal_funds_1000`

Aggiornato il 24/11/2026. **Stato: implementato e verificato con test automatici; NON ancora verificato su un telefono reale né con la Dashboard Appodeal configurata.** Finché il placement non è configurato, il gioco **non mostra** il nuovo video (vedi «Protezione dal placement `default`»).

## Che cosa fa il gioco

| | |
|---|---|
| Ricompensa | 1.000 € alle **finanze personali** della carriera, per **ogni** video completato. Mai alla tesoreria del partito. |
| Limiti del gioco | Nessuno: nessun limite giornaliero, nessun limite totale, nessun cooldown. Restano solo la disponibilità degli annunci e le eventuali regole della rete (es. un limite di impressioni impostato in Dashboard). |
| Piattaforma | Solo Android (Appodeal). iOS: nessun annuncio nuovo, nessuna scheda, il Worker rifiuta la ricompensa. Web: nessun annuncio. |
| Porte d’accesso | Pagina **Ricompense** (scheda «1.000 € di fondi personali»), **Home → attività → Risorse** (sezione in testa alla categoria), **avvisi di rischio o debito** (briefing della Home e intestazione della pagina Finanze, solo quando un video è pronto). Un solo servizio (`src/ui/funds-ad.js`), un solo placement. |
| Bonus sondaggi | Invariato: placement `default`, +0,15 punti, stesso codice nativo e JS, stesso limite di 30 al giorno sul Worker. I video dei fondi stanno in una tabella separata e non consumano quel limite. |

## Configurazione da fare nella Dashboard Appodeal (manuale, a cura del titolare)

App Android già esistente (App ID **790468**). Le etichette esatte dei menu possono variare con le versioni della Dashboard.

1. Apri l’app Android in Appodeal → sezione **Placements** → **Create placement**.
2. **Nome del placement**: `personal_funds_1000` (esattamente così, minuscole e trattini bassi).
3. **Tipo di annuncio**: Rewarded Video (attivo).
4. **Reward**: **Amount = `1000`**, **Currency = `Fondi personali`** (stesse maiuscole; spazi iniziali o finali sono tollerati, nient’altro).
5. Non modificare il placement **`default`** né le sue impostazioni (bonus sondaggi), né banner, interstitial o BidMachine.
6. Facoltativo: nessun limite di impressioni (il gioco non ne vuole); se ne imposti uno, il video sparirà quando è raggiunto, senza errori.
7. Salva. Le impostazioni dei placement arrivano all’app all’**avvio dell’SDK**: dopo la modifica chiudi e riapri l’app.

### Verifica sul telefono (da fare prima di considerare la funzione completata)

1. Build di prova (Debug: annunci di test forzati) → Ricompense: la scheda deve passare da «Verifica della disponibilità…» a **«Video disponibile»**. Se resta «Non ancora disponibile: il video da 1.000 € non è ancora attivo», il placement non è configurato o la reward non è esattamente `1000` / `Fondi personali`.
2. Guarda un video fino alla fine: +1.000 € nei fondi personali, voce «Video premiato: fondi personali» nel registro contabile (categoria Ricompense di gioco).
3. Chiudi un video prima della fine: nessun accredito.
4. Logcat: `adb logcat -s PolitAppodeal Appodeal` mostra «rewarded finished (official completion)» solo per i video completati.

## Protezione dal placement `default`

Appodeal, per un placement che non esiste in Dashboard, usa le impostazioni di `default`. Per non attribuire mai la ricompensa sbagliata:

- il gioco chiede al bridge nativo `rewardedPlacement({ placement })`, che legge `Appodeal.canShow(REWARDED_VIDEO, placement)` e `Appodeal.getReward(placement)`. Il video è offerto **solo** se `canShow` è vero e la reward è esattamente **1000 / «Fondi personali»**; con la reward di `default` (o nessuna) la scheda dice «Non ancora disponibile» e il pulsante è disattivato;
- prima di mostrare, il bridge controlla di nuovo `canShow` per quel placement; un placement diverso da `default` e `personal_funds_1000` è rifiutato;
- al completamento (`onRewardedVideoFinished(amount, currency)`) il bridge riporta placement, importo e valuta: il gioco accredita solo se sono `personal_funds_1000`, 1000, «Fondi personali».

## Accredito: atomico e idempotente

1. L’SDK conferma il completamento (unico punto di accredito: `onRewardedVideoFinished`; chiusura anticipata, errore o timeout non pagano). Il bridge crea un id univoco per quel video (`apd-…`).
2. Il **Worker** registra l’id una sola volta (`reward_ad_funds`, chiave account o dispositivo dell’ospite + id; `INSERT OR IGNORE`): un id ripetuto risponde «duplicato». Senza risposta del Worker (offline, errore) **non si accredita nulla**.
3. Il **gioco** accredita 1.000 € con `book()` (finanze personali) una sola volta per id: l’id resta nel salvataggio della carriera (`game.rewards.funds`) e nel registro del dispositivo; il salvataggio è scritto subito.
4. Un video alla volta: un secondo tocco mentre il primo è in corso risponde «Un video è già in corso.» (guardia JS e guardia nativa).

## Verifica server-to-server di Appodeal: valutata, non adottata

Appodeal offre callback server-to-server per le reward, ma richiede di identificare l’utente presso l’SDK (`Appodeal.setUserId`) e un URL di callback con chiave di firma in Dashboard. Il gioco oggi non passa **alcun** identificativo del giocatore all’SDK (scelta di privacy documentata nel bridge). Adottarla significherebbe: un id pseudonimo per l’SDK, una route di callback nel Worker con verifica della firma, la chiave come segreto del Worker (mai nel client) e l’aggiornamento dell’informativa privacy. È una decisione del titolare; finché non è presa, la validazione è quella sopra (completamento dell’SDK + registrazione unica sul Worker).

## Worker, database, migrazioni

- `worker.js`: in `bookAdReward`, il campo `reward: 'fondi'` (solo `platform: 'android'`) registra in `reward_ad_funds` senza limite giornaliero; ogni altro valore è rifiutato (403). Tabella creata da `ensureSchema` e dalla nuova migrazione `migrations/0010_reward_ad_funds.sql` (stesso testo). Pulizia delle righe dopo 62 giorni; cancellazione con l’account.
- **Il Worker con questa route non è ancora pubblicato** (né TEST né produzione): finché non lo è, il Worker in esercizio rifiuta la richiesta e il gioco **non accredita** (il video risulta «non confermato»). Va pubblicato su TEST, verificato, poi in produzione insieme o prima della nuova AAB.

## Test

`scripts/check-funds-ad.mjs` (nel `check:all`): placement non configurato → nessun annuncio e nessun accredito; tre porte, un servizio; 2, 3, 10 e 35 video consecutivi; chiusura anticipata, errore di visualizzazione, nessun annuncio; callback duplicata; richieste contemporanee; salvataggio e ricaricamento; riapertura dell’app; bonus sondaggi invariato su `default`; Worker senza limite e solo Android, account e ospite; nessuna offerta su iOS. Il bridge Kotlin è compilato (`:politicando-appodeal-ads:compileReleaseKotlin`), non provato su un dispositivo.
