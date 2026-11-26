# Checklist di verifica manuale sui dispositivi reali (25/11/2026)

## Perché serve

Questa sessione **non ha accesso a telefoni fisici**: `adb devices` era vuoto e `xcrun xctrace` elenca solo il Mac. È stato provato l'emulatore Android del Mac (AVD `Medium_Phone_API_37.0`), con una build di debug collegata a un Worker locale e ad Appodeal in modalità test. Il sistema emulato però si bloccava: `system_server` cadeva di continuo e QEMU non rispondeva. Su questa macchina l'emulatore non è affidabile e non conta come prova.

Restano quindi **non verificati**:

- fotocamera e selettori nativi;
- Appodeal reale;
- foto reali di persone.

Tutto quello che è verificabile senza dispositivi è coperto dai test automatici (`check-photo-avatar`, `check-funds-ad`, `check-appodeal`, `check-welcome-reward`). Le voci qui sotto sono da eseguire a mano.

## Come prepararsi

- **Build.** Una build di debug installata da Android Studio, oppure un APK di test interno: **mai** la AAB di produzione con annunci reali sul proprio telefono.
- **Appodeal in test.** Per le prove degli annunci serve la modalità test di Appodeal: annunci di prova, nessuna impression reale.
- **Worker.** Le ricompense vanno al Worker. Per non scrivere in produzione usare il Worker locale:
  1. avviare `npm run cf:dev` (porta 8787);
  2. collegare il telefono con `adb reverse tcp:8787 tcp:8787`;
  3. costruire con i tag della modalità locale, lo stesso meccanismo di `scripts/ios-test-build.mjs`.

## Avatar da foto: Android e iPhone

Per ogni foto annotare che cosa riconosce il gioco e che cosa si è dovuto correggere.

**Foto da usare:** almeno 5 foto reali diverse.

- capelli lunghi scuri e occhiali;
- capelli corti e barba;
- capelli biondi o rossi;
- testa rasata o stempiata;
- foto con luce scarsa o controluce.

**Prove da fare:**

1. Wizard, passaggio 1 › «Crea l'avatar da una foto» › **Scegli dalla galleria**. Si apre il selettore nativo:
   - Android: selettore foto di sistema;
   - iOS: PHPicker / Foto.

   Scelta una foto, l'editor la mostra **dritta**: l'orientamento EXIF di una foto in verticale scattata ruotata è rispettato.
2. **Scatta una foto**: si apre la fotocamera frontale; dopo lo scatto la foto è nell'editor.
3. Annullare il selettore: nessun errore, l'editor resta com'era.
4. Ingrandimento, trascinamento nell'ovale, «Ruota di 90°»: l'anteprima del disegno cambia.
5. Il riepilogo «Dalla foto» elenca i tratti; le voci si correggono con i menu.
6. **HEIC (iPhone):** una foto HEIC si apre su iOS. Su Android, se non è leggibile, compare il messaggio con l'indicazione «Più compatibile».
7. File troppo grande (oltre 25 MB) o non immagine: il messaggio dice il motivo.
8. «Usa questo avatar», creazione della carriera, poi Home, Profilo e una scena: sempre lo stesso disegno, mai la foto.
9. Chiudere e riaprire l'app. Profilo › «Modifica l'avatar»: riapre le scelte e la foto conservata. Cambiare un tratto e salvare.
10. **Privacy.** Con un proxy (Charles o mitmproxy) o il log di rete:
    - nessuna richiesta porta la foto o un'immagine;
    - il salvataggio online (`PUT /api/account/saves…`) non contiene `data:image`;
    - nelle impostazioni dell'app lo spazio occupato cresce di poche decine di KB: la copia ridotta.
11. «Elimina la foto»: l'avatar resta, la foto non c'è più.

## Pubblicità Android: placement `default`, due ricompense

1. **Una ricompensa per pulsante.** Le due ricompense hanno pulsanti propri:
   - bonus sondaggi: Ricompense › «Ricompense pubblicitarie», e Sondaggi › riquadro «VIDEO PREMIATO · SONDAGGI»;
   - fondi: Ricompense › «1.000 € di fondi personali», attività «Risorse», Finanze e l'avviso di debito in Home.

   Per ciascun pulsante, guardare il video fino alla fine:
   - pulsante sondaggi: compare «il tuo partito guadagna nei sondaggi» e nello storico +0,15 punti; i fondi non cambiano;
   - pulsante fondi: +1.000 € nei fondi personali, con la voce «Video premiato: fondi personali» nel registro; la tesoreria del partito non cambia; i sondaggi non cambiano.
2. **Chiusura anticipata.** Chiudere il video prima della fine: nessun accredito, con il messaggio chiaro.
3. **Errore o nessun annuncio** (modalità aereo prima di premere): «Nessun video disponibile», nessun accredito.
4. **Doppio clic** sullo stesso pulsante o su due pulsanti di pagine diverse: parte un solo video, l'altro pulsante risponde «già in corso».
5. **Video consecutivi per i fondi:** 3 di fila danno +3.000 €; nessun limite del gioco.
6. **Limite dei sondaggi:** il limite giornaliero esistente resta.
7. **Riscossione ripetuta.** Dopo un video completato, forzare la chiusura dell'app subito dopo la fine e riaprirla: nessun doppio accredito.
8. **Logcat** (`adb logcat | grep PolitAppodeal`): ogni `show` usa `default` e `rewarded finished (official completion)` precede ogni accredito.
9. **Appodeal Dashboard:** nessun placement oltre `default`. Le impression rewarded compaiono sotto `default`.
10. **iPhone:** nessun nuovo annuncio, nessun pulsante video.

## Premio di benvenuto (2.500 €)

1. Android 1.0.6 (7) release con account: premio una volta. Aggiornare a 1.0.7 (8): nessun secondo premio.
2. Stesso account su un secondo telefono: nessun premio.
3. Ospite: premio una volta. Reinstallando l'app, l'ospite lo riceve di nuovo: è il limite dichiarato in `premio-benvenuto-deduplicazione.md`.
4. Build di debug: nessun premio.
