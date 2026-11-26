# Premio di benvenuto (2.500 €): deduplicazione

Aggiornato il 25/11/2026. Codice: `src/core/welcome-reward.js`, `src/ui/app.js` (accredito), `worker.js` (`reward_community`, ricompensa `benvenuto`). Test: `check-welcome-reward`, `check-rewards-sync`.

## Che cosa cambia

| Caso | Prima | Ora |
|---|---|---|
| Giocatore con account, stesso dispositivo, app reinstallata o dati cancellati | Nuovo identificativo di installazione → premio di nuovo | Il Worker conserva la richiesta dell’account: **nessun secondo premio** |
| Stesso account su un secondo dispositivo | Premio di nuovo (nuova coppia installazione + utente) | **Nessun secondo premio**: il premio è dell’account |
| Ospite che riceve il premio e poi accede con il suo account sulla stessa installazione | Premio di nuovo (nuova coppia) | Il premio passa all’account, **nessun secondo accredito** |
| Server non raggiungibile | — | Nessun accredito: il premio resta in sospeso e si riprova |
| Più richieste contemporanee dello stesso account | — | Una sola vince (riga unica per account, inserimento atomico) |
| Ospite (senza account) che cancella i dati o reinstalla | Premio di nuovo | **Premio di nuovo: limite dichiarato** |

Restano invariati: importo, testi, voce nel registro economico, una sola volta per carriera (anche dopo un ripristino), solo nelle release Android 1.0.6 (7) e 1.0.7 (8) e iOS 1.0.2 (3) e 1.0.3 (4), mai Debug, web o sito TEST.

## Il limite per gli ospiti

Senza account, l’unica memoria è quella del dispositivo. Dopo una cancellazione dei dati o una reinstallazione, distinguere lo stesso dispositivo da uno nuovo richiederebbe un identificativo che sopravvive alla disinstallazione, cioè un identificativo hardware o un’impronta del dispositivo. Il gioco non ne usa, e non ne introduce. Per questo **non è possibile garantire «una volta per dispositivo» agli ospiti** dopo una reinstallazione.

## Opzioni per il titolare (nessuna attivata)

1. **Premio solo con account** (consigliata se l’abuso conta): l’ospite vede il messaggio con l’invito ad accedere, e l’accredito avviene alla prima richiesta dell’account. È garantito una volta per account.
2. **iOS: Keychain dell’app.** Un valore casuale salvato nel Keychain dell’app sopravvive alla reinstallazione, non identifica l’hardware ed è limitato all’app. Serve un piccolo plugin nativo e la dichiarazione nella privacy dell’app. Non esiste un equivalente su Android che sopravviva alla disinstallazione senza servizi Google aggiuntivi (Block Store) o identificativi del dispositivo.
3. **Accettare il limite** per gli ospiti: valore solo di gioco, nessun denaro reale.

Le opzioni 1 e 2 cambiano il comportamento visibile o la privacy dell’app: vanno decise dal titolare.

## Estensione alla build successiva (25/11/2026)

**Che cosa cambia.**

- La promozione resta la stessa:
  - id locale `grazie-aggiornamento-2026-11`;
  - chiave dell'account sul Worker `benvenuto`;
  - 2.500 € nei fondi personali della carriera.
- Agli obiettivi di partenza si aggiunge la build successiva di ogni piattaforma.
- I numeri vengono dai progetti nativi:
  - `android/app/build.gradle`: versionCode 7, versionName 1.0.6, quindi la successiva è 1.0.7 (8);
  - `ios/App/App.xcodeproj`: MARKETING_VERSION 1.0.2, CURRENT_PROJECT_VERSION 3, quindi la successiva è 1.0.3 (4).
- Le versioni precedenti restano idonee.
- Restano escluse le versioni oltre queste, le stesse versioni con un altro build, il Debug, il web e il sito TEST.
- I progetti nativi **non** sono stati portati a 1.0.7 (8) e 1.0.3 (4): il numero si aggiorna quando si prepara la build.

**Un solo premio anche passando da una build all'altra.**

- **Account.** La riga `benvenuto` del Worker è una per account. Nessun secondo premio su un'altra build, un altro dispositivo, iOS o dopo una reinstallazione.
- **Ospite.** La chiave locale è promozione + installazione + utente, senza la build. Aggiornando l'app sulla stessa installazione il premio non si ripete.
- **Limite dichiarato, invariato.** Un ospite che reinstalla o cancella i dati riceve di nuovo il premio. Nessuna impronta del dispositivo è stata introdotta.
- Gli accrediti già fatti non sono stati toccati.

**Test.** `check-welcome-reward` verifica:

- l'idoneità delle due build per piattaforma, lette dai progetti nativi;
- l'esclusione delle build oltre queste e degli altri build con la stessa versione;
- ospite su 1.0.6 (7) e poi 1.0.7 (8): un solo premio;
- account su 1.0.7 (8), poi un altro dispositivo con 1.0.6 (7), poi iOS 1.0.3 (4) reinstallato: un solo premio.
