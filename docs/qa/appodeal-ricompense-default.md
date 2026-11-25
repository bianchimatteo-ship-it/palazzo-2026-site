# Due video premiati, un solo placement Appodeal: `default`

Configurazione definitiva dal 25/11/2026 (sostituisce il placement `personal_funds_1000` del 24/11, mai creato nella Dashboard).

## In breve

- **Un solo placement**: `default`, già presente nella Dashboard dell'app Android 790468. Nessun placement nuovo. Nessun altro SDK (niente AdMob).
- **Un solo provider Rewarded** e **un solo blocco «video in corso»** per tutte le superfici: mentre un video è sullo schermo, ogni altro pulsante video risponde «Un video è già in corso».
- **Il premio dipende dal pulsante**, non da Appodeal. Ogni pulsante passa un tipo esplicito:
  - `sondaggi` per il bonus nei sondaggi nazionali;
  - `fondi` per i 1.000 € di fondi personali.
- Il tipo è fissato quando il video parte e resta lo stesso fino all'accredito. Non si può cambiare durante o dopo la visione.
- **Solo Android.** iOS è invariato e non mostra nuovi annunci. Banner e interstitial sono invariati.

## Le due ricompense

| | Bonus sondaggi | Fondi personali |
|---|---|---|
| Effetto | +0,15 punti per i sondaggi nazionali secondo `AD_REWARD`, con effetto sui tre sondaggi successivi (regole invariate) | +1.000 € virtuali nelle finanze personali della carriera, mai nella tesoreria del partito |
| Accredito | `store.claimAdReward()` e storico | `store.claimFundsAdReward()`, voce in contabilità «ricompense» |
| Limiti | Limite giornaliero del Worker (`AD_DAILY_MAX`) | Nessun limite giornaliero, massimale o cooldown applicativo |
| Dove si offre | Pagina Ricompense; pagina Sondaggi (riquadro sotto il barometro, `pollAdOffer` in `polls-mode.js`) | Pagina Ricompense; attività «Risorse»; Finanze; avvisi di rischio e debito (Home e Finanze) |

## Il percorso di un video

1. **Il pulsante** (`data-reward-video` per i sondaggi, `data-funds-ad` per i fondi) chiama `rewards-service.js` con il suo tipo.
2. **`ads-rewarded.js` `watch(kind)`** prende subito il blocco condiviso e chiede al provider di mostrare il video.
3. **Il bridge nativo** (`AppodealAdsPlugin.kt`, sempre `Appodeal.show(…, "default")`) genera la completion ID **solo** dopo il callback ufficiale `onRewardedVideoFinished`.
   - Nessun premio per un video chiuso prima della fine, non caricato, in errore o senza callback.
4. **Il Worker** (`bookAdReward`) riceve il tipo esplicito (`reward: 'sondaggi' | 'fondi'`).
   - Un client precedente che non lo invia vale `sondaggi`.
   - Il tipo `fondi` è accettato solo con `platform: 'android'`.
   - Il Worker registra la completion ID e risponde prima di qualunque accredito.
5. **Il salvataggio** riceve l'accredito solo dopo la conferma del Worker, e solo se il Worker ha registrato lo stesso tipo.

## Idempotenza unica

Una completion ID vale **una volta sola, qualunque sia il tipo**, per account o per dispositivo ospite. Lo garantiscono tre livelli.

- **Worker.** Le tabelle storiche restano separate e intatte:
  - `reward_ads`: bonus sondaggi, con il limite giornaliero;
  - `reward_ad_funds`: fondi, senza limite.

  Ogni inserimento avviene solo se l'ID non è in nessuna delle due tabelle (`INSERT … SELECT … WHERE NOT EXISTS`). Ogni istruzione D1 è atomica e le scritture sono serializzate. Così un ID registrato come bonus sondaggi risponde `duplicate` se richiesto come fondi, e viceversa. Nessuna nuova migrazione: le tabelle e i dati storici restano quelli delle migrazioni 0008 e 0010.
- **Dispositivo.** Un solo diario delle completion ID (`rewardsJournal.adSeen` / `adRemember`) per entrambi i tipi.
- **Salvataggio.** `claimAdReward` rifiuta un ID già presente in `rewards.funds`; `creditFundsAd` rifiuta un ID già presente in `rewards.ads`.

## Che cosa è stato tolto

- `personal_funds_1000`, `FUNDS_PLACEMENT`, `PLACEMENTS`, `rewardedPlacement()`.
- I controlli su importo e valuta del placement personalizzato.
- Il secondo provider di `funds-ad.js`.

Il bridge Kotlin è tornato alla versione a placement unico, con il solo commento aggiornato.

## Verifica

`check-funds-ad` usa un plugin nativo simulato, l'adapter reale, il servizio reale, lo store reale e il Worker reale in locale. Verifica:

- ogni video mostrato con `default`, senza nessun altro parametro;
- tre porte, un servizio;
- 1.000 € per ogni video, anche 35 di fila;
- nulla per un video chiuso, fallito o assente;
- il blocco condiviso tra fondi e sondaggi, in entrambi gli ordini;
- un ID di un tipo rifiutato come l'altro tipo, nel Worker, nello store e nel salvataggio con un diario vuoto;
- il tipo che non cambia dopo la registrazione;
- il limite giornaliero dei sondaggi che resta, mentre i fondi proseguono oltre;
- nessun video su iOS;
- nessuna traccia del vecchio placement nel codice.

`check-appodeal` verifica nel sorgente Kotlin l'assenza di ogni placement personalizzato.

**Non esiste una verifica SSV** (server-to-server) delle completion: la convalida è il callback ufficiale dell'SDK sul dispositivo, più la registrazione unica del Worker.

**Non verificato su un telefono:** la visione reale di un video Appodeal e la prima impression nella Dashboard.
