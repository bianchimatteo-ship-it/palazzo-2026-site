# Politicando 2026: ciclo conclusivo del 25/11/2026

- **Branch:** `feature/inmobi-integrazione`.
- **Commit iniziale:** `32f4b5ae`. Il commit finale e il deploy TEST sono nel report di chiusura in chat: un commit non può contenere il proprio hash.

**Legenda.** 🟢 fatto e verificato · 🟡 fatto, verificato in parte · ⚫ non verificabile qui o da decidere.

## 1. Avatar da foto 🟢 nel browser · ⚫ su telefono

**Causa.** L'editor del 24/11 trasformava la foto con un filtro: sfocatura, pochi toni, contorni. Il ritratto ottenuto sostituiva l'avatar in Home e nel Profilo e la testa nelle scene. Non era un personaggio del gioco.

**Che cosa fa ora.** Il nuovo `src/ui/photo-traits.js` legge sul dispositivo la zona del volto inquadrata nella guida ovale. Usa misure su colori e contorni: nessun servizio esterno, nessun modello scaricato. Riconosce:

- carnagione;
- colore dei capelli;
- acconciatura: lunghi, caschetto, corti, rasati, stempiati, frangia, ricci o ondulati;
- occhiali;
- barba: completa, corta, pizzetto, basette, tre giorni;
- baffi;
- larghezza del volto.

Ogni tratto letto ha un grado di certezza: riconosciuto, probabile, incerto o non visibile. Diventa una scelta di `AVATAR_OPTIONS` disegnata da `avatar-svg.js`.

**L'editor** (`src/ui/photo-avatar.js`):

- foto dalla galleria o dalla fotocamera;
- orientamento EXIF, rotazione di 90°, ingrandimento e trascinamento;
- anteprima del disegno immediata;
- un menu per ogni tratto: una correzione a mano non viene cancellata da una nuova lettura;
- volto, barba e baffi seguono il genere scelto nel wizard.

**Formati.**

- Riconosciuti dai primi byte: JPEG, PNG, WebP, HEIC/HEIF.
- Se il dispositivo non decodifica HEIC, il messaggio lo dice.
- Rifiutati con il motivo: GIF, file non immagine, file vuoti, oltre 25 MB o 60 milioni di pixel.
- La foto viene ridotta a 1.600 px prima di ogni elaborazione.

**Che cosa resta.**

- Nel salvataggio: solo le scelte dell'avatar.
- Solo sul dispositivo (`photo-avatar-store.js`): una copia ridotta a 480 px in JPEG, ricodificata senza metadati, con inquadratura, letture e correzioni. Serve per modificare l'avatar in seguito ed è eliminabile.
- L'originale non viene conservato.

Home, Profilo e scene mostrano sempre il disegno: `playerPortrait` non usa più immagini e le scene non ricevono più una testa fotografica.

**Modifica degli avatar salvati.** Profilo › «Modifica l'avatar» riapre le scelte salvate e la foto conservata. Salva con il nuovo `store.setPlayerAvatar`: prima il profilo poteva solo sostituire il ritratto filtrato.

**Test `check-photo-avatar`.**

- Lettura su 6 ritratti **sintetici** × 3 luci × 2 semi: capelli lunghi neri e occhiali, corti con barba, caschetto biondo, rasato con baffi, grigi con occhiali e pizzetto, lunghi rossi.
- In Chrome, percorso completo:
  1. wizard e file non valido rifiutato;
  2. lettura (capelli neri, lunghi, occhiali);
  3. correzioni a mano conservate dopo una nuova lettura;
  4. editor a 375 px;
  5. creazione della carriera, poi Home, Profilo e una scena animata con l'avatar;
  6. nessuna immagine nel salvataggio;
  7. ricaricamento;
  8. modifica dal profilo con le impostazioni precedenti;
  9. nuovo salvataggio e nuovo ricaricamento;
  10. «Elimina la foto».

**⚫ Non verificati:** foto reali di persone, fotocamera fisica, selettori nativi di Android e iOS.

## 2. Fondazione di un partito durante la carriera 🟢

**Cause** (riprodotte nel browser con una vera carriera):

1. L'anteprima del logo del modulo in carriera non si aggiornava. Colori, forma, simbolo e sigla aggiornavano l'anteprima solo nel wizard (`updateWizardLogo`).
2. I campioni del secondo colore funzionavano solo nel wizard: il gestore scriveva in `wizard`, che a carriera avviata non esiste.

La catena dei dati (`renderNewPartyFields → args → lifeFound → cleanPartyIdentity → applyPartySplit → record`) era corretta: lo conferma il test.

**Correzione** (`app.js`): `paintFoundPreview` ridisegna l'anteprima a ogni modifica e al ripristino della bozza dopo un ridisegno. I campioni del secondo colore funzionano anche nel modulo in carriera.

**Test `check-party-founding-career`.** Una vera carriera da deputato. Si cambiano tutti i campi con veri eventi: nome, sigla, descrizione, orientamento, posizione, colore principale e secondario, forma, simbolo, quattro priorità, quattro posizioni e un logo dalla galleria. Poi:

- l'anteprima cambia subito;
- i dati restano dopo un avviso, un cambio di pagina, la chiusura del pannello e con la conferma aperta;
- dopo la conferma, tutti i valori sono nel record del partito, nei sondaggi (nome, sigla, colore) e nelle pagine;
- dopo la chiusura e la riapertura del gioco i valori restano.

Il pannello parte chiuso e torna aperto com'era.

## 3. Dialoghi 🟢 per le scene delle attività · 🟡 per gli altri tipi di scena

**Causa.** Dopo la risposta del giocatore, l'ospite commentava solo il *tipo* di mossa, con una frase generica. La seconda domanda non riprendeva la prima. Decisione e garanzie erano uguali per ogni tema.

**Che cosa fa ora.** Il nuovo `src/data/activity-scene-threads.js`: 120 coppie italiano/inglese, 5 varianti per ogni momento.

- **Replica.** Chi ha fatto la domanda risponde *sul tema* e *sul tipo di risposta*: ascolto, impegno, mediazione, scontro. Tiene conto di come è andata: bene, a metà, male.
- **Seconda voce.** Riprende il tema e dice come è andata la prima risposta.
- **Decisione e garanzie.** Sono chieste sul tema.
- **Riga sul ruolo** prima della prima domanda: chi governa, chi è all'opposizione, chi non ha incarichi. Mai «governa lei» a chi non ha un incarico.
- **Varietà.** Si sceglie la variante incontrata meno di recente nella carriera.
- **Resa.** La replica è una riga a sé (`node.reply`, `.scene-reply`), tradotta frase per frase.

**Test `check-dialogue-threads`.** 2.376 conversazioni complete, 20.192 momenti: 65 attività × 3 semi × 4 situazioni × 3 modi di rispondere, più una carriera di 36 scene.

- Continuità verificata a ogni passo: risponde chi ha chiesto, la replica è sul tema e sul tipo di risposta, la seconda voce riprende il tema, decisione e garanzie sono sul tema.
- In 36 scene di fila: 14 repliche, 10 raccordi e 11 decisioni diverse, nessuna ripetuta in due scene consecutive.
- `check-activity-i18n`: 42.607 testi inglesi senza italiano residuo.

**⚫ Non rivisti in questo ciclo:** dibattiti televisivi, talk show, comizi (salvo le contestazioni del 24/11), Notte elettorale e scene di voto in aula.

## 4. Attività ed eventi 🟢

- **Quarta attività:** `visita-azienda` («Visita a un'azienda in difficoltà»).
  - Aperta a tutti, 1 giorno.
  - Esperienza, popolarità, rapporti con sindacati (+3) e imprese (+2).
  - Rischio 15%: il sindacato ti accusa di aver ascoltato solo la proprietà.
  - Scena «cantiere» sulla sicurezza sul lavoro.
- **Quarto evento:** `pronto-soccorso-notte` («Il pronto soccorso chiude di notte»), famiglia sanità.
  - Per incarichi locali, provinciali, regionali e per parlamentari; cooldown di 30 settimane.
  - Tre scelte: sostieni la raccolta di firme (scelta automatica, senza giorni), apri una trattativa (1 giorno, esito dopo 3 settimane), accetta il piano.
- Traduzioni per entrambi.

**Test `check-weekly-variety`:** 12 carriere × 40 settimane, nessun evento ripetuto in settimane consecutive. I **quattro** eventi nuovi arrivano tutti nel gioco. La visita è disponibile sia all'iscritto sia al deputato. Nessuna scelta automatica consuma giorni.

## 5. Tutorial 🟢

Il manuale «Come giocare» passa da 22 a 29 capitoli. Ognuno ha: dove si trova, come si usa, requisiti, costi, conseguenze ed esempio. I capitoli nuovi:

- avatar e foto;
- fondare e personalizzare un partito;
- organizzazione, iscritti e tesoreria;
- avanzamento di 1/2/4 settimane e delega allo staff;
- finanze personali e debiti;
- fusioni e scioglimento;
- ricompense e video premiati.

Il tour guidato (13 passi con le prove sulle pagine vere) è invariato: non spende denaro né giorni. «Chiedi al gioco» usa anche i nuovi capitoli.

## 6. Due ricompense, un solo placement `default` 🟢 nel codice · ⚫ su telefono

Dettagli in `docs/qa/appodeal-ricompense-default.md`.

- Un solo provider e un solo blocco «video in corso».
- Il tipo (`sondaggi` o `fondi`) viene dal pulsante ed è fissato per la richiesta.
- Il Worker riceve il tipo esplicito e applica l'idempotenza unica su `reward_ads` + `reward_ad_funds`.
- Rimossi `personal_funds_1000`, `FUNDS_PLACEMENT`, `rewardedPlacement()` e i controlli su importo e valuta del placement.
- Il bonus sondaggi è offerto anche nella pagina Sondaggi.

## 7. Elezioni e `check-campaign-start` 🟢 (opzione B adottata)

**L'analisi** (stesso seme `comunale-debole-noto-2`, Siena, su tre versioni):

| Versione | Esito del test | Quota del giocatore | Rivali |
|---|---|---|---|
| `fedd4b30` | superato | — | — |
| `b6d9d9c5` | superato | 12,3% | Futuro Nazionale 36,0%, Partito Liberaldemocratico, civica |
| `32f4b5ae` | fallito | 25,9% | tre forze piccole |
| oggi, prima della correzione | fallito | 25,7% | Partito Comunista dei Lavoratori 23,5%, Partito Liberaldemocratico 23,8%, civica 27,0% |

Il modello di partenza non è cambiato. Cambia il campo dei rivali, estratto in base al peso nei sondaggi: in questo seme escono tre forze piccole, che pesano lo 0,3% nei sondaggi. I pesi sono corretti: le prime forze sono nel catalogo con le loro quote.

**Decisione del titolare: opzione B.** Il modello elettorale non cambia; il test misura il campo davvero estratto. Ogni rivale porta il peso nei sondaggi del suo partito; una candidatura civica o indipendente non ha un peso noto.

- **Rivali di un partito davvero più forte** (almeno 2 punti e almeno il triplo del peso del giocatore):
  - il giocatore parte sotto di loro, con i margini di prima: 0,9 della loro media in un comune, 0,55 in una provincia, 0,4 in una regione;
  - in più, al massimo 0,8 del più forte.
- **Campo senza partiti più forti:** la partenza resta equilibrata. Un nome noto può essere avanti, ma non oltre 1,25 volte la quota pari in un comune, 1,1 in una provincia, 1,0 in una regione.
- **Il controllo principale resta esercitato:** almeno metà dei campi locali di un partito debole deve avere rivali più forti. Oggi sono 9 campi su 10.
- **Caso specifico mantenuto:** un esordiente di un partito debole contro rivali di partiti più forti parte **dietro ciascuno di loro** (semi deterministici della griglia).

**Esempi del risultato** (campo estratto, quota del giocatore):

- Comunale, esordiente, seme 1: Fratelli d'Italia 44,7%, Noi Moderati 15,1%, civica 31,7%; giocatore 8,5%, dietro il rivale di FdI.
- Comunale, nome noto, seme 2: tre forze piccole; giocatore 25,7% contro una quota pari del 25%. È accettato perché sotto il tetto di equilibrio (31,3%): contro avversari altrettanto piccoli un nome noto parte alla pari.
- Regionale ed esordiente: tra 0,5% e 2,5% contro rivali di FdI, PD e M5S tra il 22% e il 48%.

Nessuna asserzione è stata tolta. Il controllo sui rivali più forti è lo stesso di prima, solo applicato ai rivali che lo sono davvero; il controllo di equilibrio è nuovo e più severo per i campi deboli, che prima non avevano limite.

## 8. Versione, premio di benvenuto e AAB

**Premio di benvenuto (2.500 €).** Idoneo anche nella build successiva di ogni piattaforma:

- Android 1.0.6 (7) e 1.0.7 (8);
- iOS 1.0.2 (3) e 1.0.3 (4).

I numeri vengono dai progetti nativi più uno. Restano invariati:

- l'id `grazie-aggiornamento-2026-11` e la chiave dell'account `benvenuto`;
- l'importo e i fondi personali come destinazione;
- l'idempotenza: un solo premio per account anche cambiando build, dispositivo o piattaforma; per un ospite, un solo premio sulla stessa installazione anche dopo l'aggiornamento.

Il limite degli ospiti che reinstallano resta dichiarato. Dettagli in `docs/qa/premio-benvenuto-deduplicazione.md`.

**Nessuna AAB e nessuna build iOS in questa fase**, su richiesta. I progetti nativi restano a 1.0.6 (7) e 1.0.2 (3). Alla prossima build vanno portati a 1.0.7 (8) e 1.0.3 (4), entrambe già idonee al premio.

### Nota precedente (superata)

Play Console non è accessibile da questa sessione: il browser integrato non ha un accesso a Google. Non è stato possibile verificare quali `versionCode` siano già caricati.

Il premio di benvenuto è legato esattamente ad Android 1.0.6 build 7. Il test lo vuole così ed esclude 1.0.7 (8).

La AAB resta quindi **1.0.6 (7)**. Se la 7 è già in Play Console, Google la rifiuterà: serve una 1.0.7 (8) e il titolare deve decidere se spostare o estendere il premio di benvenuto.


## 9. Fase del 25/11, pomeriggio: scene non ancora riviste

Rivisti dibattiti televisivi, talk show e interviste giocandoli per intero su carriere reali: deputato, consigliere comunale e iscritto, dentro e fuori campagna. Il nuovo test `check-studio-scenes` copre 36 scene e 378 momenti.

**Problemi trovati e corretti** in `src/core/scene-engine.js`, `src/core/store.js` e `src/data/studio-lines.js`:

1. **Chi parla.** Nelle reazioni era evidenziato il rivale, ma la prima battuta era del conduttore, e la «risposta del rivale» mostrava la frase del conduttore. Ora la prima battuta è sempre di chi è evidenziato: il rivale, poi il commento del conduttore.
2. **Reazione alla seconda domanda.** Dopo la domanda sui conti, la reazione parlava del tema della prima domanda. Ora parla di «Conti e coperture».
3. **Fatti citati.** Il rivale citava come «fatto del giorno» voci del diario del giocatore, per esempio «Mentre si discute di Dibattito su una TV locale, lei dov'era?». Ora le voci del diario del giocatore (inviti in TV, interviste, richieste dei comitati del partito) sono escluse. Le questioni pubbliche si citano ancora, anche senza un tema preciso: per quelle restano le risposte generiche, come chiede `check-dialogue-coherence`.
4. **Etichette.** Prima comparivano «Deputato (scenario di simulazione)» e «Candidato» per una donna. Ora l'etichetta mostra l'incarico senza note dei dati, è concordata per genere (giocatore e rivale) e, in campagna, riporta la lista con cui si corre davvero.
5. **Italiano.** «una domanda diretta a Andrea»: le frasi sono riscritte perché un nome non segua mai una «a» semplice.

**Comizi e contestazioni.** Rivisti nel giro di prova: discorso coerente con città, temi e impegni. Le contestazioni seguono la causa documentata e la responsabilità del giocatore (correzione del 24/11, `check-protests`, `check-scene-backgrounds`).

**Notte elettorale e votazioni in aula.** Coperte dai test esistenti, eseguiti in questa fase:

- `check-election-night-engine`, `check-election-night-ui`, `check-election-night-language` (inglese in Chrome);
- `check-floor-vote`, `check-floor-ui`, `check-floor-i18n`, `check-aula-live`, `check-aula-ui`.

Nessun nuovo problema rilevato.

## 10. Verifiche sui dispositivi

**Nessun dispositivo fisico disponibile.**

- L'emulatore Android (API 37) è stato avviato con una build di debug collegata a un Worker locale e ad Appodeal in modalità test. Il sistema emulato però cadeva di continuo (`system_server`, QEMU bloccato): non conta come prova.
- La copia Android è stata ripristinata (modalità produzione, nessun tag locale).

**Restano da provare a mano**, con la checklist `docs/qa/checklist-dispositivi-2026-11-25.md`:

- foto reali di persone;
- fotocamera, selettori nativi e HEIC;
- annunci Appodeal reali per entrambe le ricompense;
- premio di benvenuto tra le build.

**Coperto dai test automatici:**

- `check-funds-ad`: ogni pulsante video dei sondaggi chiede «sondaggi», ogni pulsante dei fondi chiede «fondi», qualunque sia la pagina; il doppio clic da due pagine fa partire un solo video, del tipo del primo pulsante.


## 11. Regressione del 25/11 e analisi dei quattro problemi del mondo simulato

**Prima regressione completa:** 338 comandi, 326 superati e 12 falliti. La quarta attività e il quarto evento restano (decisione del titolare). Il nuovo evento cambia l'evoluzione del mondo simulato e ha messo in luce comportamenti che prima non si presentavano.

**Come sono stati analizzati.** Ogni caso è stato riprodotto con il suo seme deterministico e confrontato con il commit iniziale `32f4b5ae`, dove tutti e quattro passano. Il confronto isolato (attività e evento separati nel worktree di `32f4b5ae`) indica il nuovo evento come innesco.

### Bug del motore corretti

1. **«Vai all'elezione» si fermava prima della finestra spostata** (`src/core/store.js`, `fastForwardToElection`).
   - Il limite di settimane era calcolato una volta sola, sulla data iniziale del voto.
   - Se il pianificatore rinviava il voto (Regionali Toscana, dal 27/10/2030 al 27/04/2031, «Rinviata per le elezioni politiche anticipate»), l'avanzamento si fermava senza aprire le candidature.
   - Ora segue la finestra pianificata in quel momento per lo stesso voto, con gli stessi limiti di prima (tra 160 e 330 settimane).
   - Il rinvio è risultato legittimo: politiche anticipate al 27/10/2030, Regionali 182 giorni dopo (minimo 180), entro il margine di rinvio del pianificatore.
   - Con la sola correzione del motore passano `check-regional-chain` e `check-candidacy-routes`, senza modifiche ai test.
2. **Il giocatore Presidente poteva sciogliere le Camere quando il calendario non lo consente** (`store.js`, `presidentDissolve`).
   - Il Presidente simulato non scioglie se il calendario elettorale non permette di votare a breve (`dissolutionWait > CALENDAR_RULES.dissolveWithinDays`). Il giocatore poteva farlo.
   - Ora vale la stessa regola, con il motivo nel messaggio.
3. **Una crisi aperta prima dell'insediamento del giocatore al Quirinale restava al Presidente uscente simulato.**
   - Il 19/02/2029 la simulazione ha sciolto le Camere al posto del giocatore, che era Presidente dal 29/01/2029.
   - Ora le consultazioni ripartono all'insediamento e la decisione è del giocatore.
4. **Senza alcuna maggioranza politica la simulazione scioglieva da sola, anche con il giocatore Presidente** (`src/core/legislature-engine.js`).
   - Ora il giocatore riceve la decisione «Nessuna maggioranza alle consultazioni» (nuova in `src/data/simulation/presidency-rules.js`, con traduzione inglese): governo del Presidente con un tecnico, oppure scioglimento.
   - Senza risposta entro la scadenza vale il tecnico. Solo se anche il tecnico non trova una maggioranza seguono il mandato esplorativo e lo scioglimento previsti dal flusso esistente.

### Test aggiornati perché non più coerenti con il comportamento previsto

1. **`check-annual-elections`.**
   - Il pianificatore unisce politiche ed europee nello stesso giorno solo nel suo ultimo passaggio dichiarato. Succede quando nessun'altra data rispetta i 180 giorni: la politica riceve `coincides` e il motivo «Coincide con un altro voto fissato dalla legge».
   - È il caso del 10/06/2029. Il flag è assegnato correttamente.
   - Il controllo delle distanze ora conta come una sola tornata **solo** quella coppia (politiche con `coincides` + europee, esattamente due voti). Qualsiasi altra sovrapposizione continua a fallire. Verificato con casi unitari: senza flag, due voti locali, tre voti.
2. **`check-presidency`.**
   - La premessa del test («nessuna crisi») è falsa in questo percorso. La crisi del 20/11/2028 è reale e registrata: dimissioni dopo la verifica di bilancio, consultazioni ancora aperte. È ereditata dal Presidente precedente.
   - Lo scioglimento ora deve essere rifiutato per una ragione delle regole: nessuna crisi, calendario o semestre bianco. Prima il test accettava qualsiasi errore: ora è più severo.
   - La decisione delle consultazioni può essere quella con maggioranza o quella senza. In entrambe devono esserci «tecnico» e «sciogli», ed è il giocatore a decidere.
3. **`check-long-run`.**
   - Le politiche del 17/12/2056 esistono e si tengono: la legislatura passa da 25 a 26 e le successive sono fissate al 18/12/2061. Lo stato `missed` indica solo che il giocatore, allora consigliere regionale, non era candidato.
   - Il controllo di salute ora guarda il calendario del Paese (`health.scheduled`, ogni voto non ancora tenuto). Un voto davvero assente continua a fallire.

### Altri fallimenti della regressione, corretti

- **`census-i18n` e `check-i18n-offline`:** traduzioni mancanti (manuale, avatar, contesti delle attività) e tre testi generati, tra cui il riepilogo delle amministrative, riscritto in frasi brevi. Ora 0 incompleti e 0 mancanti.
- **`check-i18n-audit`:** l'esempio «Patto Civico» del manuale, riformulato.
- **`check-load`:** 1304 KB contro il budget di 1300. Il manuale si carica all'apertura della guida e le regole essenziali restano immediate. Ora 1265 KiB.
- **`check-dialogue-coherence`:** il filtro dei fatti era troppo stretto, vedi la sezione 9.
- **`check-simulation`:** passa da solo; era fallito solo sotto carico parallelo.
- **`check-photo-avatar`:** vedi il punto 4 dei test aggiornati qui sotto.

### Regressione completa finale (25/11, 17:41, 338 comandi, quattro esecutori in parallelo)

**334 PASS, 4 FAIL.** Ogni fallimento è stato rieseguito da solo, tre volte.

| Test | In regressione | Da solo | Esito |
|---|---|---|---|
| `check-i18n` | 1° comando dell'esecutore 4, partito un secondo dopo la sincronizzazione delle coppie; nel log anche «La ricerca è rapida (8457 ms)» | 3 PASS su 3 | Carico e avvio concorrente, nessun difetto |
| `check-committee-filters` | filtro «tutte» non letto | 3 PASS su 3 | Carico parallelo (Chrome), nessun difetto |
| `check-floor-ui` | conteggio atteso 0, trovato 1 | 3 PASS su 3 | Carico parallelo (Chrome), nessun difetto |
| `check-photo-avatar` | avatar della scena diverso dalla firma | 1 PASS su 3 prima della correzione (2 FAIL); dopo, 3 PASS su 3 | Premessa del test errata, corretta (punto 4) |

4. **`check-photo-avatar`** (test scritto in questa fase).
   - Nella scena, chi parla prende l'espressione della battuta (`src/ui/stage-art.js` `actorSvg`, `src/ui/room-art.js`). È un comportamento già presente al commit `32f4b5ae`.
   - Il test confrontava anche l'espressione. Falliva quando la scena aperta a caso cominciava con una battuta del giocatore con un'altra espressione: `…marroni.sorridente` invece di `…marroni.serena`.
   - Verificato con `actorSvg` sullo stesso avatar: cambia solo il campo dell'espressione (`sorridente`, `determinata`); volto, capelli, occhiali, barba, giacca e occhi restano.
   - Ora il test confronta uno per uno tutti i tratti letti dalla foto. L'espressione può essere diversa solo se il giocatore sta parlando. Nessun tratto è stato tolto dal confronto.

### Problemi ancora aperti

- Nessun fallimento riproducibile nella regressione.
- Restano non verificati, per mancanza di dispositivi: fotocamera e selettori nativi, foto reali, video Appodeal reali e prima impression nella Dashboard. Vedi `checklist-dispositivi-2026-11-25.md`.
- I test nel browser (`check-committee-filters`, `check-floor-ui`, `check-i18n`) restano sensibili al carico con quattro esecutori in parallelo.
