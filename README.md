# POLITICANDO 2026

Una carriera nella politica italiana.

Fondamenta di una simulazione gestionale della politica italiana. I dati reali, quelli generati dalla simulazione e quelli creati dall’utente restano separati. Lo snapshot reale è riferito al **22 settembre 2026**; i campi senza una fonte sufficiente rimangono `null`.

## Avvio

Richiede Node.js 20 o successivo, senza dipendenze esterne.

```sh
npm start
```

Apri `http://127.0.0.1:4173`. Il gioco si apre sul **menu principale**: Nuova partita, Carica partita (fino a 5 salvataggi, esportazione e importazione su file), Come giocare, Impostazioni e — se esiste una partita — Continua con la data dell’ultimo salvataggio. Il pulsante con le tre linee nella barra superiore riporta al menu. Il pulsante “Chiudi la settimana” fa avanzare il tempo e al termine mostra il resoconto con le cause di ogni variazione.

**Primo avvio e account.** Alla prima apertura senza account (sul sito pubblicato) il menu mostra un benvenuto che spiega perché serve l’account, come sincronizza le carriere, cosa succede ai salvataggi online e che passando da un dispositivo all’altro non si perde nulla; “Nuova partita” porta prima a creare l’account o ad accedere (se il servizio account non risponde si può iniziare comunque nel browser). Dopo la registrazione un breve tour di cinque passaggi, saltabile e mostrato una sola volta (`politicando.onboarding.v1` nel browser), porta a “Inizia nuova carriera”. Chi è già connesso non vede mai il benvenuto; il sistema account non è cambiato. **Come giocare** ha 16 sezioni brevi con indice ed esempi concreti.

**Conferme.** Le azioni irreversibili o che fanno avanzare molto la partita chiedono conferma con la finestra del gioco (Annulla/Conferma, Esc per annullare), mai con il `confirm()` del browser: eliminare un salvataggio, tutti i salvataggi o una copia online; ripristinare impostazioni, campi o record; importare una partita o sostituire l’archivio amministrativo; caricare una partita con modifiche non salvate; iniziare una nuova carriera quando ce n’è una in corso; avanzare di più di una settimana in un’azione o fino alle candidature; lasciare il partito, espellere i dissidenti, ritirare una proposta o il sostegno al governo; nascondere, eliminare o svuotare nell’area amministrativa. Una settimana normale non chiede conferma.

**Impostazioni** (valgono per tutte le partite, chiave `politicando.settings.v1`): effetti sonori e volume (suoni sintetizzati, nessun file audio), animazioni complete/ridotte/disattivate, messaggi a comparsa e loro durata, resoconto settimanale, salvataggio automatico (dopo ogni azione, a fine settimana o solo manuale), velocità della simulazione (1, 2 o 4 settimane per turno, con arresto quando serve una decisione), dimensione del testo, contrasto alto, densità dell’interfaccia, ripristino, esportazione/importazione ed eliminazione dei salvataggi.

**Stile**: tema scuro da videogioco in tutte le schermate, colore del partito del giocatore come accento, badge di stato (crescita, calo, rischio, crisi, successo), grafici con la palette categoriale validata per lo sfondo scuro. Titoli in Manrope, sottotitoli in Newsreader.

**Offline**: dopo la prima visita un service worker (`sw.js`) conserva pagina, moduli, fogli di stile e tutti i dati reali; senza rete il gioco si avvia lo stesso. La strategia è “prima la rete”: online arriva sempre l’ultima versione.

## Documento dati del 24/09/2026

Il documento “POLITICANDO 2026 — Database politici e partiti — 24/09/2026” è integrato con `npm run import:document` (`scripts/import-document-2026-09-24.mjs`), idempotente: aggiunge senza sostituire né duplicare.

- **Collocazione** (§2) per ogni partito, movimento e coalizione (`politicalPosition`: estrema sinistra … estrema destra), con la fonte del documento. Per liste e coalizioni indica l’aggregazione.
- **Nuove entità** (§4) con fonte ufficiale dell’organizzazione: Forza Nuova, CasaPound Italia, Potere al Popolo!, Rete dei Patrioti (movimenti); Democrazia Sovrana Popolare, Partito Popolare del Nord, PCI, PCL, Partito Sardo d’Azione, ORA! (partiti); Alleanza Verdi e Sinistra (coalizione); Libertà, Stati Uniti d’Europa, Pace Terra Dignità, Partito Animalista - Italexit per l’Italia (liste europee 2024). “Liberali Democratici Europei” è una denominazione riconciliata con il Partito Liberaldemocratico; i nomi MEF di M5S e +Europa restano per il 2‰ ma non compaiono come secondi partiti (`sameEntityAs`).
- **Leadership** (§3): 34 incarichi nuovi più i 4 di Futuro Nazionale, ciascuno con la pagina ufficiale del partito; dove il documento chiede verifica e non c’è una fonte ufficiale corrente (PCL, Rete dei Patrioti, AVS, liste) il vertice resta vuoto. Le figure con nome identico a un parlamentare sono collegate alla sua scheda; un incarico documentato vale come iscrizione (`party-memberships.json`).
- **Liste → partiti** (§6): le liste di un solo partito puntano al partito; liste di più partiti e coalizioni restano relazioni elettorali (`componentPartyIds`, `coalitionId`).
- **Sondaggio reale iniziale**: `polls.json` (Supermedia AGI/YouTrend del 24/09/2026, sondaggi dal 10 al 23 settembre, fonte Agi; importato con `npm run import:update`). Ogni nuova carriera parte da questi valori, marcati come dato reale (solo le 12 forze della fonte, “Altri” 3,0% come nella fonte); dalla prima settimana i sondaggi sono simulati.

## Loghi dei politici

Partito, gruppo parlamentare, componente e lista d’elezione sono relazioni distinte (`src/data/repositories/party-links.js`). Il **partito attuale** viene solo dal collegamento dell’amministratore (archivio del browser e archivio condiviso KV, che prevalgono sempre) o da un’iscrizione/incarico documentato con fonte (`party-memberships.json`); il gruppo non è mai un partito e la **lista d’elezione del 2022** resta una relazione elettorale mostrata a parte (in Admin si può proporre come partito, da confermare). I componenti del gruppo Misto (es. “MISTO-Futuro Nazionale Vannacci - Free”) sono mostrati come gruppo Misto e componente; un gruppo dell’altra Camera salvato per errore in Admin non viene modificato ma è letto come il gruppo omonimo della Camera giusta e segnalato. In ogni elenco o scheda l’iniziale è sostituita dal logo del partito attuale; senza partito documentato resta l’iniziale della Camera. I mandati conclusi (es. Alberto Bagnai, 15/09/2026) restano nell’archivio ma escono dagli elenchi dei parlamentari in carica.

## Account e salvataggi online

Dal menu principale (“Account e salvataggi online”) si crea un account o si accede; la carriera in corso si salva online dopo ogni salvataggio locale e si recupera da qualsiasi dispositivo. Il Worker usa Cloudflare D1 (`politicando-accounts`, schema in `migrations/`): la password viene derivata nel browser (PBKDF2-SHA-256, 310 000 iterazioni) e il server conserva solo un hash con sale casuale; le sessioni sono token casuali salvati come hash; ogni salvataggio ha una revisione, così un dispositivo con una versione vecchia non sovrascrive quella più recente senza una scelta esplicita. Il browser conserva comunque una copia per giocare offline.

## Governo in carica all’avvio

Ogni carriera trova un governo già in carica, costruito sulla situazione reale all’avvio e poi del tutto simulato: `src/data/repositories/government-reference.js` ricava dal database i gruppi parlamentari dei componenti del governo reale in carica (oggi Fratelli d’Italia, Lega e Forza Italia in entrambe le Camere), il gruppo del Presidente del Consiglio e la ripartizione dei ministeri; `createReferenceGovernment` (motore parlamentare) ne fa un governo simulato con un Presidente del Consiglio simulato e ministri senza nomi. Il giocatore non ne fa parte: dal suo gruppo può offrire o ritirare il sostegno, chiedere un ministero se ha i requisiti, aprire una crisi (o una mozione di sfiducia dall’opposizione); il premier simulato risponde agli alleati e torna alle Camere per la fiducia. Se il governo cade si può formarne uno nuovo; “Nessun governo” compare solo quando nella partita non c’è davvero un esecutivo. I vecchi salvataggi senza governo lo ricevono al caricamento.

## Nuova carriera e comuni ISTAT

La nuova carriera parte da **“Dove vuoi iniziare?”**: Regione → (provincia o città metropolitana, facoltativa) → Comune → percorso → partito → difficoltà → chi sei e riepilogo. Nessuna persona o territorio è preimpostato. Regioni, unità territoriali sovracomunali e comuni vengono dall’**Elenco dei comuni italiani ISTAT aggiornato al 21 febbraio 2026** (7.894 comuni, nuovo assetto della Sardegna dal 1° gennaio 2026; [fonte](https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/)), importato con `npm run import:istat` (`scripts/import-istat-comuni.mjs`: legge direttamente il file xlsx permanente di ISTAT, senza dipendenze) in `src/data/real/territorial-units.json` e `src/data/real/municipalities.json` (codice statistico, denominazione anche bilingue, unità territoriale, capoluogo). Sono dati reali in sola lettura, caricati solo quando si apre la nuova partita; il comune scelto (con il suo codice ISTAT) diventa il territorio iniziale della simulazione.

## Presenza nei sondaggi

Il primo sondaggio della carriera è la fotografia della fonte reale: solo le forze che misura, con i suoi valori, e “Altri” come nella fonte; il partito del giocatore, se la fonte non lo misura, compare a parte come stima simulata marcata, fuori dal totale reale. Gli altri partiti e movimenti reali attivi del database (non storici, non doppioni, non già misurati dentro una lista come AVS) restano fuori dai sondaggi con un piccolo consenso latente simulato, che fa parte di “Altri”, e nessuna stima pubblicata. Da lì ogni forza passa per non rilevato → emergente → rilevato → consolidato e può uscire dalla rilevazione (`PRESENCE_RULES` in `src/core/world-engine.js`): contano soglie, permanenza minima e cooldown. Una forza fuori dai sondaggi cresce solo quando c’è una condizione (un partito vicino in crisi o in calo, sfiducia nelle istituzioni, campagna per le europee, attenzione dei media, elezioni) e prende i voti ai partiti vicini. Entrando acquista colore, logo, serie e storico simulati; uscendo conserva la sua storia. La pagina Sondaggi mostra le forze in osservazione, gli ingressi e le uscite della settimana e le regole; i vecchi salvataggi ricevono le forze in attesa senza cambiare “Altri”.

## Sondaggi simulati credibili

Dopo il primo sondaggio (dato reale) le rilevazioni sono simulate e partono dall’ultimo dato reale. L’errore di ogni rilevazione non è un’estrazione nuova ogni settimana: persiste da una settimana all’altra (come nei panel degli istituti) e ogni istituto simulato ha un piccolo effetto proprio; nessuna forza si sposta tra due sondaggi consecutivi oltre un limite legato alla sua dimensione (0,25 + 3,5% della quota; al primo sondaggio simulato il 60% di questo limite), così crisi e scissioni emergono nel giro di qualche settimana. Eventi, strategie (sostegno al governo o opposizione), alleanze e crisi pesano in proporzione alla dimensione del partito ed entrano ed escono in modo graduale. Il partito nuovo del giocatore prende il consenso iniziale per metà da “Altri” e per metà, in proporzione, dalle altre forze (`world.playerStart`).

## Carriera infinita e difficoltà

Nessun traguardo, anno o crollo di reputazione chiude la partita: la caduta peggiore costa incarichi e sostegni e apre una “traversata nel deserto”; i salvataggi che nelle versioni precedenti si erano chiusi riprendono. La difficoltà (Facile, Normale, Difficile) si sceglie nel riepilogo della nuova partita e modifica fondi, capitale, giorni di lavoro, statistiche iniziali, frequenza di crisi e scandali, esiti incerti, tolleranza del partito, candidature, pazienza degli alleati, disciplina delle maggioranze, rumore dei sondaggi e durata della memoria.

## Politiche pubbliche, bilancio e difficoltà

La simulazione copre **34 temi** (economia, finanze pubbliche, fisco, industria, commercio, lavoro, pensioni, welfare, sanità, scuola, università e ricerca, infrastrutture, trasporti, energia, ambiente, agricoltura, sicurezza, difesa, giustizia, immigrazione, cittadinanza, casa, famiglia, giovani, natalità, cultura, sport, turismo, digitale, pubblica amministrazione, autonomie, Mezzogiorno, esteri, Europa). Ogni tema ha un indicatore, un problema tipico che emerge quando peggiora, un ministero responsabile e quattro strumenti (investimento, riforma strutturale, sostegno mirato, regolazione) con costi, tempi ed effetti diversi (`src/data/simulation/policy-rules.js`).

Ogni misura si progetta scegliendo **quanto spendere** (portata), **come finanziarla** (deficit, IRPEF sui redditi alti, contributo delle grandi imprese, accise e IVA, rendite, recupero dell’evasione dall’esito incerto, tagli a un altro settore, fondi europei solo per alcuni temi), **quale territorio** privilegiare (tutto il Paese, Nord, Centro, Mezzogiorno o una regione) e **chi favorire**. Prima del voto l’anteprima mostra costo in miliardi (di gioco), margine di bilancio, deficit, spread, soddisfazione a regime, indicatore del tema, chi guadagna e chi perde con il motivo, regioni più e meno toccate. Il deficit oltre il 3% porta richiami e procedura europea, lo spread sale e gli interessi erodono il margine: il denaro non è infinito. La **sicurezza** ha un modello proprio (criminalità, sicurezza percepita, capacità operativa, prevenzione): più agenti costano e agiscono in mesi, pene più severe rassicurano subito ma dividono e intasano la giustizia.

L’iter legislativo richiede **settimane** (commissione almeno 2, poi emendamenti, altra Camera, voto finale): niente più leggi approvate in un clic. I gruppi chiedono modifiche concrete del contenuto in cambio dei voti; il voto dipende da contenuto, rapporti, disciplina del proprio gruppo, soddisfazione degli alleati, eventuali franchi tiratori e ostruzionismo.

## Presidente del Consiglio

Una fase diversa della carriera (sezione Governo): indirizzo politico e fino a cinque priorità nazionali; alleati con soddisfazione propria, richieste (un ministero, un provvedimento) con scadenza e uscita dalla maggioranza se ignorati; vertici di maggioranza dall’esito incerto; ministri con lealtà e competenza, rimpasti; **disegni di legge del governo** che passano dalle Camere; **decreti-legge** solo con un’emergenza aperta, in vigore subito ma decaduti (e in parte annullati) se non convertiti entro 60 giorni; **questione di fiducia** su un testo (se il voto fallisce il governo cade); **legge di bilancio** ogni autunno, da approvare entro il 31 dicembre o si va all’esercizio provvisorio. Il Presidente del Consiglio non approva mai leggi da solo.

## Eventi, memoria e spiegazioni

Gli eventi sono procedurali: condizioni legate alla situazione (governo, mercati, criminalità, stagioni, partito), pesi che cambiano con il contesto, cooldown, eventi rari e unici, emergenze esclusive, varianti del racconto, catene di eventi ed effetti immediati sul Paese. La **memoria politica** registra leggi, tasse, tagli, promesse, crisi, rotture, scandali ed esercizi provvisori: ogni ricordo si dimezza in due anni e pesa sulle elezioni, sulle alleanze e sui giudizi dei media. Il Quartier generale spiega il consenso del partito (per cause) e l’umore del Paese (regioni, economia, sicurezza, misure, gruppi di cittadini).

## Ruoli e poteri

Ogni ruolo sblocca poteri reali, verificati di nuovo dal motore prima di ogni azione: iscritto (attività, riunioni, contributi), dirigente (sezioni, formazione, comunicazione e mediazione), direzione nazionale (priorità di bilancio, disciplina), riferimento di un’area interna (candidature della propria area), parlamentare (leggi, emendamenti, trattative), segretario (linea politica, organi e incarichi, regola per le candidature, congresso anticipato, investimenti del partito, disciplina dei parlamentari, espulsione dei dissidenti, alleanze e rotture, formazione del governo), ministro (dossier e crisi del ministero), Presidente del Consiglio (nomina dei ministri, agenda del governo con un decreto ogni sei settimane che costa bilancio pubblico e arriva su territori, cittadini e media). Il Quartier generale mostra ruoli, poteri disponibili e ciò che serve per sbloccare gli altri; ogni decisione di segreteria ha costi, intervalli minimi e conseguenze su aree interne, iscritti, coesione, sondaggi e stampa.

La **cronologia della carriera** (sezione Carriera) registra ogni tappa: partiti, incarichi, governi, leggi, elezioni, decisioni chiave, promesse, record nei sondaggi. Il passato pesa: chi ha cambiato più partiti parte con meno fiducia, le promesse tradite abbassano la popolarità.

## Archivio dei dati reali

La sezione **Archivio** consulta senza uscire dal gioco partiti e movimenti (con le scelte reali del 2×1000, MEF dichiarazioni 2025), deputati, senatori, gruppi parlamentari con i componenti, governo in carica (Camera dei deputati, nomi come nella fonte), leggi e atti del Senato, territori. Le schede dei parlamentari riportano anche l’eventuale incarico nel governo reale. Nulla di questa sezione è modificato dalla partita.

## Archivio amministrativo condiviso (Cloudflare)

Correzioni ai dati e loghi dell’amministratore possono essere **pubblicati per tutti i giocatori**: il Worker (`worker.js`) risponde su `/api/admin` e li conserva in **Workers KV** (nessun R2), quindi sopravvivono a refresh, riavvii, aggiornamenti e nuovi deploy. Il gioco li scarica all’avvio (anche da GitHub Pages) e ne tiene una copia per l’uso offline; i file in `src/data/real/` non vengono mai modificati. Il proprietario collega il browser dalla schermata di accesso di `#amministrazione`: la prima volta con il codice di attivazione (segreto `ADMIN_SETUP_CODE` del Worker) e un PIN, poi solo con il PIN. Da collegato, ogni correzione, partito aggiunto o nascosto e logo salvato (indirizzo https o file sotto i 300 KB) viene pubblicato automaticamente.

## Creare un partito

Nel Career Wizard il nuovo partito (dato `source: user`) ha nome, sigla, descrizione, due colori, orientamento, un programma di fino a quattro priorità e un logo: costruito con forme, simboli generici (diversi dagli emblemi dei partiti esistenti), colori e sigla, oppure da un indirizzo, oppure caricato. Logo e colori personalizzano l’interfaccia (barra laterale, Quartier generale, accento dei colori); da segretario programma e comunicazione si possono cambiare e le aree interne reagiscono.

## Loghi

In **Impostazioni → Gestione loghi** (visibile solo al proprietario collegato) si incolla l’indirizzo di un’immagine (o si carica un file SVG, PNG, JPEG, WebP): l’anteprima compare subito, gli errori (indirizzo non valido, pagina che non è un’immagine, sito irraggiungibile, file troppo grande) sono spiegati. Se il sito lo consente l’immagine viene copiata nel browser e funziona offline; altrimenti si conserva l’indirizzo dopo aver verificato che l’immagine si vede. I loghi aggiunti sono sempre dell’utente (`origin: "user"`) e restano separati dai loghi ufficiali verificati del repository, che tornano visibili eliminando quelli personali.

## Modalità campagna

La sezione **Elezioni** avvia una campagna giocabile. Ogni elezione usa un modello distinto (comunale, regionale, politiche o europee), una scadenza, risorse limitate, attività con costi e rischi, consenso territoriale inerziale, candidati interni simulati, avversari con priorità autonome, eventi contestuali, trattative e uno scrutinio che aggiorna la carriera.

Le candidature in partiti esistenti devono superare una selezione interna. Una candidatura parlamentare in carica può perdere sostegno o posizione e non ha il rinnovo garantito. Attività, avversari, consenso, risorse, alleanze, risultati e impatti sulla carriera sono salvati con `source: "simulation"`; un partito reale resta solo un riferimento al proprio ID e non viene modificato. Le schede reali di partiti e politici continuano a mostrare esclusivamente i campi documentati e le fonti disponibili.

I risultati contano schede normalizzate su 100.000 elettori simulati. Quote, seggi e territori sono uno scenario di gioco, non risultati o sondaggi reali e non costituiscono un calcolo legale. Il modello europeo applica la soglia del 4% documentata per le elezioni europee; circoscrizioni e quote di gioco restano simulate. Le regole regionali variano da regione a regione, perciò l’allocazione regionale è dichiarata semplificata. La modalità dei sondaggi non è ancora implementata: il motore espone un hook non collegato.

Il database attuale non contiene un collegamento verificato tra tutti i partiti e i risultati elettorali storici: i numeri di consenso delle campagne non possono quindi essere inizializzati come fatti reali. Le affiliazioni prive di fonte restano `null` e la campagna non deduce il partito da un gruppo parlamentare o da una lista.

Verifica il flusso completo (candidatura, attività, eventi, alleanze, modelli, scrutinio e salvataggio) con:

```sh
npm run check:campaign
```

## Gameplay: la carriera settimana per settimana

La Home è il quartier generale del politico: statistiche con variazione settimanale, giorni disponibili, fondi, capitale politico, preparazione elettorale, decisioni in agenda, attività, traguardi, calendario elettorale, posizione in Parlamento e nel partito, relazioni.

- **Tempo**: ogni settimana ha 6 giorni di lavoro. Attività (territorio, media, partito, Parlamento, relazioni, risorse, preparazione elettorale) e azioni parlamentari consumano giorni, fondi o capitale politico e hanno rischi e conseguenze persistenti. “Chiudi la settimana” registra entrate e bilancio, applica le scelte di default alle decisioni lasciate aperte e genera nuovi appuntamenti ed eventi.
- **Eventi**: appuntamenti e eventi contestuali (proteste, scandali simulati, rivalità, alleanze, congressi, crisi di maggioranza, emergenze) offrono scelte multiple con effetti ed esiti incerti. Situazioni critiche generano eventi obbligati: procedimento di espulsione, richieste di dimissioni, inchieste.
- **Partito**: gradi interni da Iscritto a Vicesegretario, sostegno interno, rapporto con la leadership e tre correnti simulate con peso e rapporti; congressi, conflitti, espulsione, uscita e adesione. Il partito reale resta un riferimento in sola lettura.
- **Relazioni**: leadership, rivale, associazioni, redazioni, categorie produttive, sindacati e gruppi parlamentari pesano su candidature, incarichi, trattative (un gruppo con rapporti tesi rifiuta di trattare) e votazioni.
- **Elezioni**: calendario simulato con finestre di candidatura (cicli accelerati rispetto ai mandati reali). Preparazione, fondi, sostegno interno e rapporti modificano la partenza della campagna; se non ti ricandidi il mandato si chiude; un governo caduto senza alternativa porta a politiche anticipate.
- **Governo**: stabilità settimanale legata ai margini della maggioranza, crisi spontanee, rinegoziazioni.
- **Progressione e fallimento**: dieci traguardi (radicamento, rete, ruolo nel partito, candidatura, elezione, Parlamento, incarico in Aula, legge, leadership interna, Governo); la carriera può chiudersi per una crisi di reputazione.

```sh
npm run check:gameplay
```

## Sondaggi e mondo politico dinamico

La sezione **Sondaggi** pubblica ogni settimana un sondaggio simulato (istituto immaginario, campione e margine d’errore al 95%) con consenso nazionale, regionale (tutte le regioni) e locale del partito del giocatore, gradimento personale separato dal partito, gradimento del governo, indecisi, trend e tabella dei dati. Il mondo di gioco comprende solo partiti reali verificati (i primi per scelte del 2×1000, con la quota reale come punto di partenza dichiarato, non come sondaggio) e il partito del giocatore; non esistono partiti inventati. Strategie (corsa solitaria, sostegno all’esecutivo, opposizione dura, ricerca di alleanze), coesione, crisi interne, rapporti con il partito del giocatore, proposte di intesa, attacchi, alleanze e rotture sono comportamenti simulati e dichiarati, mai attribuiti come fatti ai partiti reali; eventi nazionali e territoriali hanno effetti temporanei o permanenti. Carriera, leggi, governo ed elezioni spostano i sondaggi; i sondaggi e le alleanze modificano la partenza delle campagne; alcuni eventi chiedono al giocatore di prendere posizione. Tutto ciò che viene generato è `source: "simulation"`: un partito reale compare solo con il suo nome e le sue percentuali sono stime di gioco, non sondaggi reali.

**Persone reali.** Dove il dataset verificato contiene persone pertinenti, il gioco usa loro con nome e dati esatti: nelle politiche per la Camera gli avversari sono deputati in carica della circoscrizione del giocatore (gruppo e lista d’elezione verificati; i numeri di campagna restano simulati); per un partito reale la guida mostra solo gli organi documentati, altrimenti resta vuota. Rivale interno e nuovi volti civici sono ruoli dichiaratamente simulati, senza nomi realistici. Nessuna persona reale riceve incarichi non documentati.

```sh
npm run check:polls
```

## Simulazione del Paese: territori, cittadini, economia, media

Ogni settimana, con o senza il giocatore, si muove un Paese simulato: 20 regioni con indicatori propri (economia, occupazione, servizi, sanità, istruzione, infrastrutture, trasporti, sicurezza, ambiente), soddisfazione e fiducia nelle istituzioni; cinque gruppi di popolazione con priorità, situazione economica, fiducia e partecipazione; crescita, disoccupazione, inflazione, deficit, debito e margine di bilancio pubblico; canali mediatici generici (TV, stampa, social, radio) con visibilità e tono della copertura. La pagina **Territori** mostra la mappa a tessere delle regioni, il dettaglio di ogni regione, i gruppi di cittadini, gli andamenti e le misure in vigore; la Home apre con la situazione del Paese (legislatura, esecutivo, umore) e un cruscotto di Paese, territorio, partito e finanze con stati visivi di crescita, calo, rischio e crisi.

I sistemi sono collegati: una **legge** approvata in Parlamento consuma margine di bilancio (senza coperture ha effetti ridotti e appesantisce il deficit), arriva gradualmente sui **territori** — di più dove il servizio è più indietro —, cambia l’umore dei **cittadini** interessati, finisce sui **media** e nella cronaca; l’umore del Paese sposta il gradimento del **governo** e i **sondaggi** (premia la maggioranza quando le cose vanno bene, l’opposizione quando vanno male), la fiducia bassa alimenta indecisi e area di protesta; sondaggi e clima fanno crescere o calare gli iscritti del **partito**; chi governa (sindaco, presidente di regione, maggioranza, ministro) risponde dei risultati con la propria popolarità; umore e partecipazione entrano nelle **campagne elettorali** e nell’affluenza. I problemi dei territori diventano decisioni in agenda con conseguenze immediate e future (una promessa viene verificata dopo 12 settimane). Senza un governo nato in Parlamento agisce un *esecutivo di scenario*, che non rappresenta il governo reale. Tutto questo è `source: "simulation"` e non descrive statistiche ufficiali.

**Quartier generale.** La Home mostra la fase politica (inizio legislatura, clima pre-elettorale, crisi di governo, campagna, malcontento), il briefing dello staff con le priorità della settimana e dove intervenire, le catene di cause ed effetti delle misure (bilancio → territori → cittadini → media → sondaggi) e le conseguenze ancora in arrivo. Molte scelte hanno ora **conseguenze future**: si vedono come rischio al momento della decisione e si risolvono settimane dopo. Nuove situazioni nascono dallo stato del mondo: stampa ostile, crollo o slancio nei sondaggi, conti pubblici esauriti quando si governa, incarico offerto dalla segreteria. Ogni regione ha una propria composizione di cittadini (giovani, famiglie, pensionati, autonomi, redditi bassi), quindi la stessa legge produce effetti diversi da territorio a territorio; le proposte in Aula mostrano prima del voto costo, coperture, soddisfazione attesa, regioni e gruppi favorevoli o contrari, e dopo l’approvazione lo stato di attuazione.

## Partito come organizzazione e finanze

Il partito del giocatore ha iscritti, militanti, dirigenti, sezioni o federazioni regionali, organi interni (dall’assemblea degli iscritti alla segreteria nazionale), coesione, conflitti tra le correnti, disciplina personale, congresso ordinario annuale, selezione dei candidati prima di ogni elezione (primarie, accordo in direzione, indicazione della propria area) e una tesoreria con quote, 2×1000 stimato, contributi degli eletti e spese per sezioni, personale, comunicazione, formazione e campagne. Nuove attività (tesseramento, apertura di sezioni, formazione, contributi, campagne di comunicazione del partito, mediazione e disciplina) dipendono dal ruolo interno; incarichi si conquistano e si perdono. Le **Finanze** del politico hanno un registro per categoria, un budget settimanale (staff che aggiunge giorni, comunicazione, presenza sul territorio, sede), investimenti (piattaforma per i volontari, sede di proprietà, sondaggio riservato, ufficio stampa), patrimonio netto, un fondo elettorale vincolato che i donatori integrano del 15%, debito con interessi, crisi finanziaria, bilanci annuali e indice di sostenibilità; all’avvio di una campagna anche la tesoreria del partito finanzia il candidato, in base al ruolo e al sostegno interno. Anche per i partiti reali questi numeri sono solo stime di gioco.

## Parlamentari e leggi reali nella simulazione

La carriera incontra **parlamentari reali**: eletti nella regione del giocatore, colleghi di gruppo e presidenti di gruppo documentati. Nome, Camera, gruppo, circoscrizione e incarico vengono copiati senza modifiche dal dataset verificato (con eventuali correzioni dell’area amministrativa); rapporto, firme alle proposte, emendamenti contrari e incontri sono iniziative simulate e dichiarate come tali, senza scandali o ruoli attribuiti. La pagina **Leggi** elenca **436 atti reali della XIX legislatura** dal Senato (352 leggi approvate definitivamente e 84 in corso), con titolo, stato, numero e data esatti e link alla scheda ufficiale: il giocatore può proporre una *modifica simulata* collegata a un atto reale, che resta distinta dall’atto e non lo modifica. L’area di gioco accanto a ogni atto è solo un’interpretazione dei temi ufficiali.

```sh
npm run import:real-laws
npm run check:simulation
```

Font: Manrope per i titoli, Newsreader per i sottotitoli, DM Sans per il testo.

## Area amministrativa (proprietario)

L’area amministrativa è riservata al proprietario e non compare nei menu dei giocatori. Chi apre `#amministrazione` vede solo la schermata di accesso: il PIN del proprietario è verificato dal Worker (`POST /api/admin/session`, la prima volta insieme al codice di attivazione `ADMIN_SETUP_CODE`) e a ogni apertura la sessione salvata nel browser viene riconfermata dal server (`GET /api/admin/session`); un token inventato o scaduto non apre nulla. Non esiste un PIN locale: un giocatore non può crearne uno per diventare amministratore.

Il proprietario corregge nome, sigla, descrizione, collocazione e informazioni dei partiti, il logo, i deputati e senatori collegati, nomi e informazioni dei politici, gruppo, partito e incarichi. La ricerca copre tutti i partiti e movimenti e tutti i 604 parlamentari: l’elenco mostra 40 risultati alla volta con «Mostra altri», ma la ricerca non è mai limitata. Con **+ Aggiungi partito** si crea un partito (nome ufficiale, sigla, descrizione, sito, collocazione, colore, logo) marcato «aggiunto dall’amministratore» (`source: user`) e utilizzabile nel resto del gioco; nomi e sigle già esistenti sono rifiutati. Ogni partito si può nascondere, eliminare (con conferma) e ripristinare; i filtri distinguono tutti, attivi, nascosti, aggiunti, con logo e senza logo, e il riepilogo conta partiti reali, movimenti, aggiunti, nascosti e loghi configurati.

Le modifiche formano un livello separato sopra il dataset reale (`politicando.admin.overrides.v1` nel browser e archivio condiviso su Workers KV, pubblicato per tutti i giocatori): i JSON in `src/data/real/` non vengono mai modificati e ogni record corretto, aggiunto o nascosto è segnalato come tale.

## Pubblicazione e cache

`npm run version:build` imposta un’unica versione di cache su `index.html` e su tutti gli import dei moduli; la versione avanza sempre. `check:published-site` verifica in locale che nessun modulo o foglio di stile abbia una versione diversa e, online, confronta ogni modulo raggiungibile da `main.js`, ogni foglio di stile e ogni collezione di dati con i file locali. All’avvio, se il browser ha in cache un `index.html` più vecchio della versione online, la pagina si ricarica da sola sulla build aggiornata.

## Carriera parlamentare, governo e leggi

Il Career Wizard offre quattro percorsi: Comunale, Regionale, Deputato e Senatore. Per Deputato e Senatore si sceglie esplicitamente un gruppo reale della Camera o del Senato: Camere e gruppi sono riferimenti verificati in sola lettura, mentre il seggio del giocatore, le consistenze dello scenario e ogni conseguenza sono `source: "simulation"`. Partito e gruppo restano distinti.

La sezione **Parlamento** mostra la composizione di scenario delle due Camere, il capitale politico (che si rigenera con il tempo), gli incarichi interni conquistabili (responsabile, vicepresidente e presidente di commissione) e il cambio di gruppo. **Governo** gestisce coalizione su entrambe le Camere, sostegni esterni, ministri (anche il giocatore, se il suo gruppo è in maggioranza), fiducia, crisi e caduta. **Leggi** segue l’iter proposta → commissione → emendamenti → voto → altra Camera → voto finale, con trattative e voto forzato. Incarichi e ministeri compaiono nello storico della carriera; un seggio vinto in campagna apre il mandato, una sconfitta da uscente lo chiude e fa decadere le proposte in esame. I salvataggi precedenti vengono completati al caricamento; un salvataggio illeggibile viene conservato a parte.

```sh
npm run check:parliament
```

## Dataset reale

Snapshot verificato al 22 settembre 2026:

- **69 partiti** e **2 movimenti politici**, 71 entità complessive;
- **6 entità** con livello regionale/territoriale e regione documentati;
- **604 parlamentari in carica**: 399 deputati e 205 senatori;
- **22 gruppi parlamentari**: 13 alla Camera e 9 al Senato;
- **4 figure politiche** e **4 incarichi di partito** collegati tramite ID stabili, verificati sull’organigramma ufficiale di Futuro Nazionale;
- **674 appartenenze** ai gruppi parlamentari;
- **613 incarichi** parlamentari importati;
- **13 etichette** di lista elettorale e **268 relazioni** tra candidati, liste e consultazioni;
- **23 territori**: Italia, 20 regioni, Camera e Senato;
- **2 consultazioni**: elezioni politiche 2022 ed europee 2024;
- **436 atti legislativi** della XIX legislatura dal Senato (352 leggi approvate definitivamente, 84 in corso), verificati il 23 settembre 2026.

Il dataset non attribuisce automaticamente i parlamentari ai partiti: Camera e Senato documentano gruppi e liste d’elezione, che possono aggregare realtà diverse. Perciò il numero di partiti parlamentari e non parlamentari non viene stimato. Anche presenza locale, appartenenze individuali ai partiti, colore, orientamento, data di fondazione e cariche non documentate restano non valorizzati. La presenza regionale viene indicata solo per le formazioni con una fonte istituzionale o del partito adeguata; un gruppo consiliare non è convertito in un gruppo parlamentare nazionale né in appartenenze individuali.

Futuro Nazionale è incluso come partito sulla base delle sue pagine ufficiali di trasparenza e organigramma. La componente della Camera con un nome simile resta un’entità parlamentare distinta: non è usata per dedurre l’iscrizione al partito di ogni componente.

## Fonti

- [Parlamento italiano — Registro nazionale dei partiti politici](https://www.parlamento.it/Parlamento/1063), deliberazioni d’iscrizione e cancellazione;
- [MEF — dati 2 per mille](https://www1.finanze.gov.it/finanze/2xmille/public/index.php?aggiornato=1522252800&export=1&page=1&tree=2025AADUEXM0101), dichiarazioni 2025/redditi 2024;
- [Camera dei deputati — schede della XIX legislatura](https://www.camera.it/deputati/elenco) e [composizione dei gruppi](https://www.camera.it/leg19/217);
- [Senato — dati aperti sulla composizione](https://dati.senato.it/sito/composizione?legislatura=19&testo_generico=11) e [dati aperti sui disegni di legge](https://dati.senato.it/sito/home) (endpoint SPARQL);
- [ISTAT — codici territoriali](https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/);
- [Ministero dell’Interno — trasparenza elezioni europee 2024](https://dait.interno.gov.it/elezioni/trasparenza/elezioni-europee-2024) e [archivio storico elettorale](https://www.interno.gov.it/it/temi/elezioni-e-referendum/dato-storico-elezioni);
- [Futuro Nazionale — sito](https://futuronazionale.it/), [trasparenza](https://futuronazionale.it/trasparenza/), [organigramma](https://futuronazionale.it/organigramma/) e [logo ufficiale](https://futuronazionale.it/il-logo/);
- fonti territoriali ufficiali: [PATT](https://patt.tn.it/), [Südtiroler Volkspartei](https://www.svp.eu/de/partei-883.html), [Stella Alpina](https://www.stella-alpina.org/), [Union Valdôtaine](https://www.unionvaldotaine.org/), [Campobase](https://www.campobasetrentino.it/), [Sud chiama Nord](https://sud-chiamanord.it/), insieme alle pagine ufficiali dei rispettivi consigli regionali/provinciali e dell’Assemblea regionale siciliana riportate nelle schede.

Le fonti sono collegate direttamente alle schede. Ogni record reale contiene `source: "real"`, `verified: true`, `sourceUrl`, `sourceName` e `verifiedAt`; validità temporale e date di ingresso/uscita sono valorizzate quando la fonte le documenta.

## Struttura e caricamento

- `src/data/real/`: snapshot reale suddiviso in JSON per collezione, con `manifest.json`; `database.json` è conservato per controllo ed esportazione;
- `src/data/simulation/`: contenuti dimostrativi separati;
- `src/data/user/`: punto d’ingresso per i contenuti creati durante la carriera;
- `src/data/repositories/`: repository e caricamento delle collezioni; la UI non importa direttamente i file JSON;
- `src/data/real/party-leaderships.json`, `political-figures.json`, `group-memberships.json`, `party-memberships.json`, `office-history.json` e `parliamentary-group-history.json`: relazioni e storico separati, legati con ID;
- `src/data/real/assets/logos/`: loghi reali verificati e inclusi nel progetto;
- `src/data/repositories/logo-store.js`: loghi aggiunti dal gestore locale, conservati in IndexedDB del browser e mai presentati come fonti reali;
- `scripts/import-real-data.mjs`: importer ripetibile delle fonti;
- `scripts/validate-real-data.mjs`: controlli su provenienza, duplicati, relazioni, conteggi e assenza di statistiche reali inventate;
- `scripts/check-published-site.mjs`: controllo diretto della versione pubblicata su GitHub Pages, inclusa la corrispondenza dei file remoti con lo snapshot locale;
- `src/core/campaign-engine.js` e `src/core/election-engine.js`: stato e risoluzione delle campagne, separati dal database reale;

All’apertura vengono caricati manifest e partiti/movimenti. Politici, gruppi e altri dettagli vengono richiesti quando si apre il relativo archivio, così il browser non scarica il JSON aggregato da circa 2 MB.

## Test

```sh
npm run check:ui          # menu, impostazioni, nuova partita, pagine, poteri, archivio, salvataggi, loghi, tooltip, identità del partito
npm run check:first-run   # primo avvio: benvenuto e account prima della prima carriera, tour saltabile una volta, guida, conferme del gioco
npm run check:government  # 34 temi, bilancio, territori, cittadini, sicurezza, Presidente del Consiglio, difficoltà
npm run check:events      # eventi procedurali: condizioni, cooldown, rarità, esclusività, varianti, catene
npm run check:career      # carriera pluriennale end-to-end, salvataggi e migrazione
npm run check:admin-sync  # archivio amministrativo condiviso su Workers KV
npm run check:document    # documento del 24/09/2026: collocazioni, nuove entità, leadership, liste, loghi dei politici, sondaggio reale
npm run check:world       # alleanze realistiche, evoluzione dei partiti, difficoltà, notizie, memoria politica
npm run check:accounts    # account, salvataggi online su D1 (SQLite in test), conflitti tra dispositivi
npm run check:reference-government # governo in carica all’avvio: maggioranza reale, premier simulato, sostegno, ministero, crisi, caduta
npm run check:admin       # area del proprietario: sessione verificata dal server, ricerca completa, aggiunta/nascondi/elimina/ripristina partiti
npm run check:poll-presence # primo sondaggio = fonte reale; ingresso/uscita dai sondaggi con soglie, permanenza e cooldown
npm run check:onboarding  # nuova carriera: Regione → Comune ISTAT → percorso → partito → difficoltà → chi sei
npm run check:affiliations # partito/gruppo/componente/lista separati, modifiche Admin prevalenti, AVS unica nei sondaggi, alias, migrazioni
npm run check:poll-realism # sondaggi simulati: partenza dal dato reale, variazioni graduali, normalizzazione, effetto degli eventi
npm run check:all         # tutte le verifiche
npm run check:gameplay
npm run check:parliament
npm run check:polls
npm run check:simulation
npm run check:campaign
npm run check:real-data
```

## Aggiornamento e verifica

Dalla cartella del progetto:

```sh
npm run import:real-data
npm run check:real-data
npm run check:published-site
```

L’importatore scarica fonti pubbliche e riscrive esclusivamente `src/data/real/`. Impostare `AS_OF` alla data effettiva di verifica e aggiornare il numero versione del dataset nello script. Prima di pubblicare, controllare il diff e il risultato del validatore.

`check:published-site` interroga l’URL GitHub Pages, controlla tutti i JSON pubblici e verifica che corrispondano ai file presenti nella working tree. Va eseguito dopo che GitHub Pages ha terminato la pubblicazione.

## Cloudflare Workers

Lo stesso sito è pubblicato anche come Worker con asset statici (`palazzo-2026-site` su workers.dev). `wrangler.jsonc` indica come cartella degli asset la radice del progetto, così import relativi, JSON e navigazione restano identici a GitHub Pages; `.assetsignore` esclude tutto ciò che non serve al gioco (`.git`, `node_modules`, `scripts`, `outputs`, README, configurazioni e lo snapshot `database.json` usato solo dagli script). Senza questa configurazione l’auto-configurazione di Cloudflare pubblicava la radice intera, compreso `node_modules/workerd` (127 MiB), e il deploy falliva.

```sh
npm run cf:dev      # anteprima locale su http://localhost:8787
npm run cf:deploy   # pubblicazione su Cloudflare Workers
npm run check:published-site -- https://palazzo-2026-site.<sottodominio>.workers.dev/
```

`.assetsignore` esclude anche gli archivi `*.zip`, che non vanno pubblicati (e sono ignorati da git). Il controllo del sito pubblicato verifica anche `sw.js` e che file di lavoro come `Archivio.zip`, `package.json` e gli script non siano raggiungibili sul Worker.

Anche il collegamento Git di Cloudflare usa `wrangler.jsonc`: ogni push su `main` aggiorna sia GitHub Pages sia il Worker.

## GitHub Pages

Il sito statico è pubblicato dal ramo `main` alla radice del repository. Ogni push su `main` aggiorna automaticamente la pagina quando la build Pages termina.
