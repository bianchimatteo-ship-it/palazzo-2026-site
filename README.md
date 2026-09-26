# POLITICANDO 2026

Una carriera nella politica italiana.

Fondamenta di una simulazione gestionale della politica italiana. I dati reali, quelli generati dalla simulazione e quelli creati dall’utente restano separati. Lo snapshot reale è riferito al **22 settembre 2026**; i campi senza una fonte sufficiente rimangono `null`.

## Avvio

Richiede Node.js 20 o successivo, senza dipendenze esterne.

```sh
npm start
```

Apri `http://127.0.0.1:4173`. Il gioco si apre sul **menu principale**: Nuova partita, Carica partita (fino a 5 salvataggi, esportazione e importazione su file), Come giocare, Impostazioni e — se esiste una partita — Continua con la data dell’ultimo salvataggio. Il pulsante con le tre linee nella barra superiore riporta al menu. Il pulsante “Chiudi la settimana” fa avanzare il tempo e al termine mostra il resoconto con le cause di ogni variazione.

**Primo avvio e account.** Alla prima apertura senza account (sul sito pubblicato) il menu mostra un benvenuto che spiega perché serve l’account, come sincronizza le carriere, cosa succede ai salvataggi online e che passando da un dispositivo all’altro non si perde nulla; “Nuova partita” porta prima a creare l’account o ad accedere. Il servizio account viene davvero interrogato all’apertura (`/api/account/status` sul Worker; un indirizzo configurato non basta): finché la verifica è in corso, e subito se il servizio non risponde, il benvenuto offre “Inizia senza account” (con “Riprova”). La scelta di iniziare senza account resta ricordata nel browser: ricaricando la pagina non si torna al benvenuto. Dopo la registrazione un breve tour di cinque passaggi, saltabile e mostrato una sola volta (`politicando.onboarding.v1` nel browser), porta a “Inizia nuova carriera”. Chi è già connesso non vede mai il benvenuto; il sistema account non è cambiato. **Come giocare** ha 16 sezioni brevi con indice ed esempi concreti.

**Conferme.** Le azioni irreversibili o che fanno avanzare molto la partita chiedono conferma con la finestra del gioco (Annulla/Conferma, Esc per annullare), mai con il `confirm()` del browser: eliminare un salvataggio, tutti i salvataggi o una copia online; ripristinare impostazioni, campi o record; importare una partita o sostituire l’archivio amministrativo; caricare una partita con modifiche non salvate; iniziare una nuova carriera quando ce n’è una in corso; avanzare di più di una settimana in un’azione o fino alle candidature; lasciare il partito, espellere i dissidenti, ritirare una proposta o il sostegno al governo; nascondere, eliminare o svuotare nell’area amministrativa. Una settimana normale non chiede conferma.

**Impostazioni** (valgono per tutte le partite, chiave `politicando.settings.v1`): effetti sonori e volume (suoni sintetizzati, nessun file audio), animazioni complete/ridotte/disattivate, messaggi a comparsa e loro durata, resoconto settimanale, salvataggio automatico (dopo ogni azione, a fine settimana o solo manuale), velocità della simulazione (1, 2 o 4 settimane per turno, con arresto quando serve una decisione), dimensione del testo, contrasto alto, densità dell’interfaccia, ripristino, esportazione/importazione ed eliminazione dei salvataggi.

**Stile**: tema scuro da videogioco in tutte le schermate, colore del partito del giocatore come accento, badge di stato (crescita, calo, rischio, crisi, successo), grafici con la palette categoriale validata per lo sfondo scuro. Titoli in Manrope, sottotitoli in Newsreader.

**Offline**: dopo la prima visita un service worker (`sw.js`) conserva pagina, moduli, fogli di stile e tutti i dati reali; senza rete il gioco si avvia lo stesso. La strategia è “prima la rete”: online arriva sempre l’ultima versione. In cache vanno solo le richieste GET dei file del gioco: POST, PUT, DELETE e gli altri metodi, l’API (account, salvataggi online, archivio del proprietario) e le richieste con credenziali passano sempre dalla rete senza copie.

**Avvio robusto**: se una collezione reale non arriva o non supera il controllo di integrità (conteggi del manifest), il gioco si apre con tutto il resto e un avviso indica solo i dati mancanti, con “Riprova” che richiede soltanto quelli. Il Career Wizard fa lo stesso: se l’elenco ISTAT dei comuni non è caricato lo dice (caricamento, errore con “Riprova”) e non accetta comuni scritti a mano. Solo il manifest dei dati reali, necessario ai controlli di integrità, resta indispensabile (schermata di errore con “Riprova”). Su telefono il wizard sta sopra la barra di navigazione, che resta nascosta finché è aperto.

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

I risultati contano schede normalizzate su 100.000 elettori simulati. Quote, seggi e territori sono uno scenario di gioco, non risultati o sondaggi reali e non costituiscono un calcolo legale. Il modello europeo applica la soglia del 4% documentata per le elezioni europee; circoscrizioni e quote di gioco restano simulate. Le regole regionali variano da regione a regione, perciò l’allocazione regionale è dichiarata semplificata. I sondaggi simulati del partito orientano la partenza della campagna; alle politiche e alle europee seggi ed eletti vengono dal voto nazionale sulla mappa reale del 2022 (vedi **Ciclo nazionale**).

Il database attuale non contiene un collegamento verificato tra tutti i partiti e i risultati elettorali storici: i numeri di consenso delle campagne non possono quindi essere inizializzati come fatti reali. Le affiliazioni prive di fonte restano `null` e la campagna non deduce il partito da un gruppo parlamentare o da una lista.

### Centrale elettorale, campagna ed esiti (dal 25/09/2026)

La sezione **Elezioni** è una centrale elettorale con schede interne (Panoramica, Nazionali, Candidatura, Campagna, Sondaggi e avversari, Risultati, Storico) ricordate tra una schermata e l’altra: prossimo voto con conto alla rovescia, calendario, clima politico, preparazione, regole dei seggi, concorrenti interni, posizione in lista, coalizione, corsa in tempo reale e storico.

- **Candidatura non automatica**: il partito decide alla scadenza con una probabilità che dipende dal sostegno interno rispetto alla soglia *e* al distacco dai concorrenti; un margine stretto può dare una posizione in lista peggiore, un distacco negativo porta all’esclusione.
- **Campagna** (`src/data/simulation/campaign-rules.js`, `src/core/campaign-engine.js`): 34 azioni (comizi, incontri, porta a porta, eventi, social, interviste, conferenze stampa, dibattiti, manifesti e pubblicità, raccolte fondi, associazioni e categorie, accordi territoriali, sostegni pubblici, vita locale, focus sui temi, gestione delle crisi, iniziative con il partito e la coalizione, mobilitazione finale) con costi, tempo, rischi, requisiti ed effetti diversi; l’effetto cambia con la fase (apertura, fase centrale, rush finale, ballottaggio), il tipo di elezione, il territorio, la strategia, la ripetizione, il tema in agenda, il clima del Paese e i sondaggi del partito. Ogni azione mostra l’effetto atteso. Eventi e occasioni (maltempo, notizie false, gaffe dei rivali, sondaggi locali, richieste delle categorie, volontari, scandali in lista, leader nazionale, confronti TV, temi emergenti, video virali, patti con i sindaci, scioperi, donatori…) sono pesati sulle condizioni e non si ripetono a breve: due campagne non sono mai uguali. Le polemiche non gestite pesano ogni settimana.
- **Strategie** (consolidare, nuovi elettori, territorio, social e media, un tema, contrasto a un avversario, coalizione): cambiano cosa rende, rischi e oscillazioni del risultato; ognuna rende di più in certi contesti e nessuna è sempre la migliore. Si possono cambiare in corsa a un costo, non negli ultimi cinque giorni.
- **Voto non automatico**: la campagna sposta pochi punti con rendimenti decrescenti; il giorno del voto indecisi, affluenza e mobilitazione aggiungono incertezza (riproducibile per la stessa carriera). Una coalizione porta solo una parte dei voti dell’alleato (55–85%).
- **Esiti**: vittoria, vittoria o sconfitta al ballottaggio, secondo/terzo posto, eletto grazie alla lista o alla coalizione, collegio perso ma eletto nel proporzionale, sconfitto ma in consiglio all’opposizione, primo dei non eletti, preferenze insufficienti, posizione in lista non utile, lista sotto soglia, esclusione dalla candidatura; confronto con attese e sondaggi. Regole semplificate dichiarate: soglie (3%, 4% europee), premio di maggioranza nei comuni e nelle regioni, liste bloccate alle politiche, preferenze alle comunali, regionali ed europee.
- **Risultati e conseguenze** (`src/core/aftermath-engine.js`): voti, percentuale, posizione, seggi, affluenza, collegio o circoscrizione, preferenze, liste e coalizioni, distribuzione territoriale, ballottaggio; variazioni di reputazione, influenza, notorietà, popolarità, capitale, sostegno nel partito, rapporto con la leadership e con le correnti; incarico con lato (maggioranza/opposizione). Il voto apre decisioni in agenda che restano una settimana: giunta da comporre o assessorato da chiedere (esito incerto, anche inferiore alle attese), capogruppo di opposizione, ricorso dopo una sconfitta di misura, resa dei conti nel partito, squadra di governo dopo le politiche (mai assegnata in automatico), impegni presi in campagna. Una sconfitta non chiude la carriera.

Verifica il flusso completo con:

```sh
npm run check:campaign
npm run check:elections
```

## Carriera, Partito e Agenda (dal 25/09/2026)

Tre sezioni con un’identità propria, ognuna con intestazione, indicatori e schede interne ricordate tra una schermata e l’altra (anche dopo un ricaricamento):

- **Carriera** (`src/ui/career-page.js`, `src/core/career-overview.js`) — *il percorso e la progressione*. Quattro percorsi che avanzano a velocità diverse: istituzioni elette (consigliere, assessore, sindaco, consigliere e presidente di Regione, parlamentare, europarlamentare), partito (da Iscritto a Vicesegretario; la segreteria solo al congresso), Parlamento (componente del gruppo, responsabile, vicepresidente e presidente di commissione) e governo (sottosegretario, ministro, Presidente del Consiglio). Per ognuno: posizione attuale, prossimo passo, requisiti, probabilità e ciò che lo blocca. Schede: Percorso, Progressione (fattori, pesi, momento politico, esiti possibili, storico dei tentativi), Incarichi e poteri, Cronologia, Obiettivi.
- **Progressione non automatica** (`src/core/progression-engine.js`): ogni promozione (partito, commissioni, proposta della segreteria) pesa consenso, reputazione, esperienza, influenza, risultati elettorali recenti, rapporti con la leadership, forza della propria area, salute del partito, territorio, capitale politico e momento (congresso vicino, partito diviso, scontri aperti). Superare la soglia rende la nomina probabile (mai oltre l’86%), non certa; lo stesso tentativo può finire con la promozione, un incarico minore, un rinvio, una sconfitta interna o — se molto sotto la soglia e con un incarico da perdere — una retrocessione. Ogni tentativo resta nello storico con probabilità ed esito; la richiesta di un ministero mostra la sua probabilità e può finire con un posto da sottosegretario.
- **Partito** (`src/ui/party-page.js`) — *organizzazione, rapporti interni, ruoli e consenso*: identità (dati reali verificati in sola lettura), la tua posizione con probabilità del prossimo incarico, equilibri tra le aree, il partito nei sondaggi, allerte (sostegno, congresso, conflitti, tesoreria); schede Ruoli e correnti, Organizzazione (iscritti, organi, sezioni, conflitti), Segreteria (solo per chi guida il partito) e Storico (nomine, sfide, congressi, partiti lasciati).
- **Agenda** (`src/ui/agenda-page.js`, `src/core/agenda-engine.js`) — *il calendario delle attività e delle decisioni imminenti*: la settimana (giorni, decisioni, prossimi 14 giorni, bilancio della settimana chiusa), un calendario con griglia mensile e lista di tutti gli impegni datati (candidature, voto, ballottaggio, decisione sulla candidatura, selezione dei candidati, congresso, promesse da verificare, conseguenze in arrivo, decreti da convertire, richieste degli alleati, investimenti in scadenza, decisioni in sospeso) con filtri ricordati, le attività della settimana e il registro.

```sh
npm run check:sections
```

## Comitati territoriali ed editor dei loghi (dal 25/09/2026)

- **Comitati territoriali** (`src/core/committee-engine.js`, `src/ui/committees-view.js`, Partito → Territorio): la rete del tuo partito Regione → Provincia o città metropolitana → Comune sulla geografia ISTAT (nomi e codici reali; iscritti, volontari, organizzazione, consenso locale, fedeltà, responsabili e stati sono simulati, i responsabili sono sempre figure simulate). Stati: fondazione, crescita, consolidamento, crisi, perdita del controllo (il comitato risponde a un’altra area), dissoluzione. Azioni con costi: fondare o rifondare, visitare e rilanciare, cambiare il responsabile, finanziare, mobilitare i volontari, commissariare (solo chi guida il partito). Un comitato di casa in crisi apre una decisione in agenda. Effetti reali: alla partenza della campagna i comitati del territorio del voto danno volontari, organizzazione, peso sulla candidatura e consenso locale (un comitato fuori controllo pesa contro); il risultato del voto li rafforza o li mette alla prova; alle promozioni contano come radicamento. Filtri per regione e stato ricordati.
- **Editor dei loghi** (`src/core/logo-editor.js`, `src/ui/logo-editor-view.js`): nella gestione loghi del proprietario (file o indirizzo, quando l’immagine si può copiare) e nella creazione del partito. Ritaglio con proporzione libera o quadrata, zoom (sotto 1 lascia margini trasparenti invece di tagliare il logo) e spostamento trascinando, sfondo uniforme reso trasparente con tolleranza, anteprima su chiaro, scuro e trasparenza, colore dominante automatico (applicabile al partito). Senza modifiche resta il file originale (un SVG resta vettoriale); altrimenti PNG fino a 512 px. Con il logo restano fonte, stato di verifica dichiarato e metadati (ritaglio, proporzione, zoom, trasparenza, colore, file originale). I loghi non sono più forzati in un cerchio.

```sh
npm run check:territory
```

## Filtri, schede e responsive (dal 25/09/2026)

- **Persistenza**: schede interne (Elezioni, Carriera, Partito, Agenda), filtri (agenda, comitati, emiciclo, archivi di partiti e parlamentari con ordinamento e pagina, scheda dell’Archivio, leggi reali, misura e regione dei Territori, area del proprietario), selezioni (parlamentare, commissione, votazione dell’emiciclo) e categorie richiudibili (attività della settimana, azioni di campagna) restano come li lascia il giocatore dopo ogni aggiornamento, cambio pagina o ricaricamento. Sono comodità di questo browser (`politicando.views.v1`), mai dati di gioco.
- **Responsive**: nessun testo è più troncato con i puntini (nomi di partiti, gruppi, comuni, relazioni vanno a capo), i controlli segmentati non vengono tagliati, i menu a tendina non allargano la pagina, tabelle e schede diventano elenchi etichettati quando lo spazio è poco; `npm run check:responsive` controlla ogni vista in un vero browser.

## Ciclo nazionale: politiche, europee, nuove Camere e governo (dal 25/09/2026)

Le elezioni nazionali non sono più una corsa isolata del giocatore: il Paese vota, nascono nuove Camere e un nuovo governo, e il mondo politico ne tiene conto (`src/core/legislature-engine.js`, integrazione in `src/core/store.js`, vista `src/ui/national-view.js` in **Elezioni → Nazionali**).

- **Mappa elettorale reale del 2022** (`src/data/real/electoral-geography.json`, `npm run import:electoral-geography`): i 147 collegi uninominali della Camera e i 74 del Senato, i 49 e 26 collegi plurinominali, circoscrizioni, ripartizioni estere, seggi e voti di lista del 25 settembre 2022 dai file ufficiali di Eligendo (Ministero dell’Interno, nella copia pubblica di onData), con vincitori, secondi classificati e i 7.894 comuni ISTAT 2026 ricondotti ai loro collegi. Senato in Trentino-Alto Adige: collegi e comuni ufficiali, risultato 2022 assente nella copia dei dati e sostituito, dichiaratamente, dal voto della Camera negli stessi comuni. È un documento reale (`source: "real"`, fonte e data di verifica), validato da `check:real-data` e confrontato online da `check:published-site`.
- **Calendario**: la XIX legislatura (prima seduta il 13 ottobre 2022) scade il 12 ottobre 2027 e si vota domenica 26 settembre 2027; ogni nuova legislatura dura cinque anni dalla prima seduta (18 giorni dopo il voto). Europee il 10 giugno 2029 (data non ancora fissata: seconda domenica di giugno, simulata) e poi ogni cinque anni. Le candidature si aprono sette settimane prima del voto. Uno scioglimento anticipato porta al voto di domenica, dopo la campagna. I salvataggi con il vecchio calendario accelerato passano a quello reale.
- **Coalizioni e campagna nazionale**: all’apertura delle candidature i partiti si raccolgono attorno al primo partito di ciascun campo secondo collocazione, rapporti, alleanze, rotture e strategia; fino al deposito delle liste le coalizioni possono cambiare. Il segretario sceglie se chiedere l’ingresso in una coalizione (il leader può dire di no), correre da solo o lasciar decidere la direzione, e la linea della campagna nazionale (identitaria, di coalizione, sui collegi contendibili, contro il primo avversario), con costi in capitale e tesoreria ed effetti settimanali sui sondaggi; il voto utile premia le coalizioni e penalizza le piccole liste che corrono da sole.
- **Il voto sulla mappa**: ogni collegio parte dal voto di lista del 2022 e si sposta con i sondaggi simulati (misto di spostamento proporzionale e uniforme, con le forze nuove sul profilo delle forze vicine e i totali nazionali rispettati), più le sorprese del giorno del voto; nell’uninominale vince il candidato della coalizione più votata, e i collegi della coalizione sono ripartiti tra i suoi partiti; proporzionale con soglie del 3% per le liste e del 10% per le coalizioni (i voti delle liste coalizzate tra 1% e 3% contano per la coalizione), minoranze linguistiche al 20% nella regione, quoziente e resti più alti, Senato su base regionale, eletti all’estero per ripartizione. Con i voti del 2022 il modello riproduce 146 collegi su 147 della Camera e i seggi proporzionali di ogni lista entro due. Senza mappa (primo avvio offline) si usa un conteggio semplificato con le stesse soglie.
- **La tua candidatura**: nell’uninominale corri nel collegio reale del tuo comune come candidato della coalizione, con la lista nel plurinominale; in lista conta la posizione nel collegio plurinominale (Senato: la quota regionale). Chi guida il partito è capolista e, come la legge consente, in cinque collegi plurinominali. L’andamento della campagna rispetto alle attese sposta il tuo collegio e, per il segretario, il partito. Il resoconto del voto mostra liste, seggi, le 20 regioni, il collegio e la circoscrizione.
- **Nuove Camere e gruppi**: il voto apre la nuova legislatura (simulata): gruppi dei partiti con i numeri del regolamento semplificato (Camera 20, o 10 per chi supera la soglia; Senato 6), gli altri eletti nel Misto divisi per componente; le proposte in esame decadono, il vecchio mandato si chiude e chi è eletto siede con il gruppo del proprio partito. Parlamento, emiciclo e Governo dichiarano che le nuove Camere sono simulate e senza parlamentari reali; la XIX legislatura resta nell’archivio.
- **Formazione del governo**: prima seduta, consultazioni al Quirinale, incarico, giuramento e fiducia, settimana per settimana; il governo uscente resta per gli affari correnti. Governa la coalizione vincente (allargata se il margine è troppo stretto), altrimenti una maggioranza nata dopo il voto o un governo del Presidente; se il tuo partito serve alla maggioranza decidi se sostenerla, se guidi il primo partito della coalizione vincente ricevi l’incarico (formi il governo, scegli i ministri, chiedi la fiducia). Senza alcuna maggioranza le Camere vengono sciolte. Quando un governo di una legislatura della partita cade, si riaprono le consultazioni nelle stesse Camere (governo bis, ter… senza chi ha lasciato la maggioranza) prima di tornare al voto. Nel mondo politico governano i partiti della nuova maggioranza e i sondaggi ripartono dal risultato.
- **Europee**: 76 seggi, soglia del 4%, cinque circoscrizioni; il risultato dà o toglie slancio ai partiti nelle settimane successive; da candidato contano i seggi della lista nella tua circoscrizione e le preferenze.
- **Salvataggi**: il ciclo nazionale (legislatura, campagna, ultimi voti in forma compatta, formazione, storia) è nel salvataggio, versione 9; i salvataggi precedenti lo ricevono all’apertura, con una copia di sicurezza.

```sh
npm run check:legislature
```

## Gameplay: la carriera settimana per settimana

La Home è il quartier generale del politico: statistiche con variazione settimanale, giorni disponibili, fondi, capitale politico, preparazione elettorale, decisioni in agenda, attività, traguardi, calendario elettorale, posizione in Parlamento e nel partito, relazioni.

- **Tempo**: ogni settimana ha 6 giorni di lavoro. Attività (territorio, media, partito, Parlamento, relazioni, risorse, preparazione elettorale) e azioni parlamentari consumano giorni, fondi o capitale politico e hanno rischi e conseguenze persistenti. “Chiudi la settimana” registra entrate e bilancio, applica le scelte di default alle decisioni lasciate aperte e genera nuovi appuntamenti ed eventi.
- **Eventi**: appuntamenti e eventi contestuali (proteste, scandali simulati, rivalità, alleanze, congressi, crisi di maggioranza, emergenze) offrono scelte multiple con effetti ed esiti incerti. Situazioni critiche generano eventi obbligati: procedimento di espulsione, richieste di dimissioni, inchieste.
- **Partito**: gradi interni da Iscritto a Vicesegretario (conquistati con una probabilità, mai in automatico), sostegno interno, rapporto con la leadership e tre correnti simulate con peso e rapporti; congressi, conflitti, espulsione, uscita e adesione. Il partito reale resta un riferimento in sola lettura.
- **Relazioni**: leadership, rivale, associazioni, redazioni, categorie produttive, sindacati e gruppi parlamentari pesano su candidature, incarichi, trattative (un gruppo con rapporti tesi rifiuta di trattare) e votazioni.
- **Elezioni**: politiche ed europee seguono il calendario reale (fine della legislatura, europee del 2029 e poi ogni cinque anni); comunali e regionali hanno finestre di candidatura su cicli di gioco accelerati. Preparazione, fondi, sostegno interno e rapporti modificano la partenza della campagna; se non ti ricandidi il mandato si chiude; senza una maggioranza le Camere vengono sciolte e si torna al voto.
- **Governo**: stabilità settimanale legata ai margini della maggioranza, crisi spontanee, rinegoziazioni.
- **Progressione e cadute**: dieci traguardi (radicamento, rete, ruolo nel partito, candidatura, elezione, Parlamento, incarico in Aula, legge, leadership interna, Governo); una crisi di reputazione costa incarichi e sostegni, ma la carriera non si chiude (vedi **Carriera infinita e difficoltà**).

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

### Emiciclo interattivo, commissioni e voti dei singoli (dal 25/09/2026)

- **Emiciclo** (`src/core/hemicycle.js`, `src/ui/hemicycle-view.js`): Camera e Senato separati, disegno semicircolare con un marker per seggio — i parlamentari reali in carica (identità, gruppo e incarichi dal dataset verificato, con le correzioni dell’amministratore) e il seggio del giocatore. È una rappresentazione grafica, non la posizione fisica in Aula: i gruppi occupano spicchi contigui da sinistra a destra secondo la collocazione dei loro componenti. Colori per gruppo o per partito con la tavolozza validata del gioco (8 colori in ordine fisso alle forze più grandi, stesso colore alla Camera e al Senato; gruppi minori e Misto in toni neutri, sempre con legenda). Filtri per partito, gruppo, commissione e Camera, ricordati tra una schermata e l’altra; elenco accessibile dei componenti filtrati.
- **Scheda del parlamentare**: nome, logo e partito documentato (mai dedotto da lista o gruppo), gruppo e componente del Misto, ruoli verificati, collegio e circoscrizione, lista d’elezione 2022 (indicata come tale), commissioni con eventuale carica, data d’inizio del mandato, fonte ufficiale; rapporto simulato e incontro se è un tuo contatto.
- **Commissioni permanenti reali** (`npm run import:committees`, `scripts/import-committees.mjs`): 14 della Camera e 10 del Senato con componenti e uffici di presidenza in carica dagli open data ufficiali (dati.camera.it, dati.senato.it); `src/data/real/committees.json` e `committee-memberships.json`. Le cariche elette per metà legislatura e i record duplicati aperti della fonte vengono esclusi; una presidenza cessata senza successore resta vacante (come nella fonte).
- **Voti dei singoli** (`src/core/vote-engine.js`): il motore decide i voti di ogni gruppo, ora compatti (un gruppo convinto vota quasi tutto a favore, uno ostile quasi tutto contro); il resto si divide in contrari e astenuti, ogni gruppo ha una linea e chi vota diversamente è un discordante. Capigruppo e leader di partito documentati non votano mai contro la linea. Nel voto segreto i singoli non sono noti e i franchi tiratori sono solo stimati, mai attribuiti. Emiciclo verde/rosso/grigio chiaro, totali, esito, maggioranza richiesta, dettaglio per gruppo, elenco dei discordanti; ogni votazione è marcata **VOTAZIONE SIMULATA** (anche la fiducia, con dettaglio per gruppo). Dalle leggi e dalla fiducia si apre il voto nell’emiciclo.

```sh
npm run check:hemicycle
```

## Dataset reale

Snapshot verificato al 24 settembre 2026:

- **75 partiti** e **6 movimenti politici**, 81 entità complessive;
- **7 entità** con livello regionale/territoriale e regione documentati;
- **604 parlamentari** della XIX legislatura, 603 in carica: 398 deputati e 205 senatori;
- **22 gruppi parlamentari**: 13 alla Camera e 9 al Senato;
- **38 figure politiche** e **38 incarichi di partito** collegati tramite ID stabili;
- **674 appartenenze** ai gruppi parlamentari;
- **613 incarichi** parlamentari importati;
- **17 etichette** di lista elettorale e **268 relazioni** tra candidati, liste e consultazioni;
- **23 territori**: Italia, 20 regioni, Camera e Senato;
- **2 consultazioni**: elezioni politiche 2022 ed europee 2024;
- **436 atti legislativi** della XIX legislatura dal Senato (352 leggi approvate definitivamente, 84 in corso), verificati il 23 settembre 2026;
- **24 commissioni permanenti** con 655 componenti; **110 unità territoriali** e **7.894 comuni** ISTAT (21 febbraio 2026);
- **mappa elettorale delle politiche 2022** (Eligendo): 147 + 74 collegi uninominali, 49 + 26 plurinominali, circoscrizioni, ripartizioni estere, seggi e voti di lista, comuni ricondotti ai collegi (documento `electoral-geography.json`).

Il dataset non attribuisce automaticamente i parlamentari ai partiti: Camera e Senato documentano gruppi e liste d’elezione, che possono aggregare realtà diverse. Perciò il numero di partiti parlamentari e non parlamentari non viene stimato. Anche presenza locale, appartenenze individuali ai partiti, colore, orientamento, data di fondazione e cariche non documentate restano non valorizzati. La presenza regionale viene indicata solo per le formazioni con una fonte istituzionale o del partito adeguata; un gruppo consiliare non è convertito in un gruppo parlamentare nazionale né in appartenenze individuali.

Futuro Nazionale è incluso come partito sulla base delle sue pagine ufficiali di trasparenza e organigramma. La componente della Camera con un nome simile resta un’entità parlamentare distinta: non è usata per dedurre l’iscrizione al partito di ogni componente.

## Fonti

- [Parlamento italiano — Registro nazionale dei partiti politici](https://www.parlamento.it/Parlamento/1063), deliberazioni d’iscrizione e cancellazione;
- [MEF — dati 2 per mille](https://www1.finanze.gov.it/finanze/2xmille/public/index.php?aggiornato=1522252800&export=1&page=1&tree=2025AADUEXM0101), dichiarazioni 2025/redditi 2024;
- [Camera dei deputati — schede della XIX legislatura](https://www.camera.it/deputati/elenco) e [composizione dei gruppi](https://www.camera.it/leg19/217);
- [Senato — dati aperti sulla composizione](https://dati.senato.it/sito/composizione?legislatura=19&testo_generico=11) e [dati aperti sui disegni di legge](https://dati.senato.it/sito/home) (endpoint SPARQL);
- [ISTAT — codici territoriali](https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/);
- [Ministero dell’Interno — trasparenza elezioni europee 2024](https://dait.interno.gov.it/elezioni/trasparenza/elezioni-europee-2024) e [archivio storico elettorale](https://www.interno.gov.it/it/temi/elezioni-e-referendum/dato-storico-elezioni);
- [Ministero dell’Interno — Eligendo, politiche del 25 settembre 2022](https://elezioni.interno.gov.it/report/20220925) (collegi, circoscrizioni, voti e seggi), nella copia pubblica dei file ufficiali di [onData — elezioni politiche 2022](https://github.com/ondata/elezioni-politiche-2022);
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
- `src/core/legislature-engine.js`: ciclo nazionale (calendario, coalizioni, voto sulla mappa 2022, nuove Camere e gruppi, formazione del governo, europee); `src/ui/national-view.js` la vista **Elezioni → Nazionali**;
- `scripts/import-electoral-geography.mjs`: importer ripetibile della mappa elettorale 2022 (file Eligendo, copia onData con commit fissato);

All’apertura vengono caricati manifest e partiti/movimenti. Politici, gruppi e altri dettagli vengono richiesti quando si apre il relativo archivio, così il browser non scarica il JSON aggregato da circa 2 MB.

## Test

**Stabilità.** `src/core/invariants.js` raccoglie in un unico controllo ciò che deve valere in qualunque momento della partita: nessun `NaN`/`undefined`/valore impossibile, ID unici, riferimenti validi (partiti, gruppi, politici, incarichi, leggi, elezioni), seggi di Camera e Senato che tornano, voti in cui sì + no + astensioni + assenze = componenti, partiti ↔ gruppi, governo ↔ maggioranza e ministri, elezioni sempre in calendario, campagne con risultato, leggi con un iter che prosegue, carriera e incarichi del giocatore coerenti. Lo usano `check:invariants`, `check:long-run`, `check:career` e `check:legislature`; `scripts/lib/long-run.mjs` fa giocare il motore reale per anni con decisioni tratte dal seed (anche gli ID sono deterministici).

```sh
npm run check:ui          # menu, impostazioni, nuova partita, pagine, poteri, archivio, salvataggi, loghi, tooltip, identità del partito
npm run check:first-run   # primo avvio: benvenuto e account prima della prima carriera, servizio account verificato davvero (non raggiungibile: “Inizia senza account” subito), avvio locale persistente, tour saltabile una volta, guida, conferme del gioco
npm run check:boot        # avvio con collezioni reali mancanti o danneggiate: il gioco si apre, avviso solo per ciò che manca, “Riprova”
npm run check:service-worker # sw.js: in cache solo le GET dei file del gioco, mai POST/PUT/DELETE né l’API
npm run check:elections   # esiti elettorali vari e non automatici, ballottaggio, soglie, preferenze, conseguenze, varietà delle campagne, strategie
npm run check:sections    # progressione non automatica (probabilità ed esiti), percorsi di carriera, agenda datata, schede di Carriera, Partito e Agenda
npm run check:hemicycle   # commissioni reali, emiciclo Camera/Senato, colori e ordine dei gruppi, voti dei singoli coerenti coi totali, voto segreto, fiducia
npm run check:territory   # comitati Regione → Provincia → Comune, stati, azioni, crisi, effetti su campagna/voto/promozioni; editor dei loghi
npm run check:mobile-start # Chrome a 375 px con tocchi reali: primo avvio, boot con collezioni fallite, API account non raggiungibile, avvio locale persistente, wizard sopra la navigazione mobile (footer e “Inizia carriera” cliccabili, anche da “Altro”), ISTAT non caricato, service worker (saltato se Chrome manca)
npm run check:responsive  # Chrome senza interfaccia: 33 viste e 4 finestre a 375/768/1280 px senza scorrimento orizzontale, elementi fuori schermo, contenuti nascosti o testi troncati (saltato se Chrome manca; CHROME_PATH per indicarlo)
npm run check:government  # 34 temi, bilancio, territori, cittadini, sicurezza, Presidente del Consiglio, difficoltà
npm run check:events      # eventi procedurali: condizioni, cooldown, rarità, esclusività, varianti, catene
npm run check:career      # carriera pluriennale end-to-end, salvataggi e migrazione
npm run check:invariants  # invarianti centrali (src/core/invariants.js): stati puliti per ogni livello di partenza e ogni tipo di danno riconosciuto (NaN, undefined, valori impossibili, ID duplicati, riferimenti rotti, seggi, voti, governo e maggioranza, elezioni, campagne, leggi, carriera)
npm run check:long-run    # carriere di 5, 10, 20 e 30 anni sul motore reale con 4 seed e livelli diversi (processi paralleli): invarianti ogni trimestre, elezioni, governi, bilanci, partiti, sondaggi, leggi ed eventi sempre attivi, nessun blocco, stato salvabile; stesso seed + stesse decisioni = stessa partita (LONG_RUN_YEARS=5 per una prova rapida)
npm run check:legislature # ciclo nazionale: mappa 2022 riprodotta, calendario, soglie, gruppi, formazione del governo, crisi, europee, salvataggi, vista Nazionali
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
