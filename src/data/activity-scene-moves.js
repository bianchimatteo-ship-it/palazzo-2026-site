// The decisions of the six optional scenes of the weekly activities (core/activity-scenes.js) — what the player CAN DO at each moment of an encounter. Nothing here is a variation of a sentence: every move
// has a FUNCTION (listen, ask for data, propose, involve the offices, mediate, contest, announce, fund…) and each function has its own consequences (FUNCTIONS: what it gives, what it costs, what it leaves
// pending); the same function means the same thing in the citizens' square, in the party room and in the committee, and the words of each family of encounters (a hall, a building site, a party room, a
// committee, a newspaper, the Council of Ministers) tell how it is done THERE. A moment offers three to five moves of different functions, chosen by the situation of the player (`when`) and by what he did before.
// Every text is a pair [Italian, English] with no free part, so the same pairs are the text of the game and the phrase-book (data/i18n/en-ui-8.js reads `ALL_PAIRS` through data/release-pairs.js).

const P = (it, en) => [it, en];
// [id, function, stat that carries it, label, situation required]. The tags of `when`: promise (an open promise of the programme), prior (a commitment of an earlier meeting still open), govern (the player
// governs or holds a delega), opp (sits in the opposition of a council), funds (the money of the move is there), capital (a point of political capital), party (the player belongs to a party).
const M = (id, fn, stat, it, en, when = '') => ({ id, fn, stat, label: P(it, en), when });

// What each function is. `gain`: effects that follow the quality of the move (a good move gives all, an uncertain one half, a bad one nothing); `cost`: what it costs or risks whatever happens; `tally`: what it
// changes in the meeting itself (k: what the player learned, tension, trust); `commit`: the commitment it leaves open (a pending consequence in the career); `fund`: money of the move, by kind of scene.
// The keys of `gain`/`cost`: rel (the relation of the body of the scene), rep, pop, not, inf, exp (stats), party (support in the party), seg (the citizens' group), home (trust of the territory), media.
export const FUNCTIONS = Object.freeze({
  listen: { label: P('Ascoltare', 'Listening'), detail: P('Raccogli ciò che dicono e il clima migliora; non ti impegna a nulla.', 'You gather what they say and the mood improves; it commits you to nothing.'), gain: { rel: 1, pop: 0.2, seg: 0.4 }, tally: { k: 1, tension: -1, trust: 1 }, gesture: 'ascolta' },
  probe: { label: P('Approfondire', 'Digging deeper'), detail: P('Capisci meglio il problema: ciò che scopri aiuta le decisioni dopo.', 'You understand the problem better: what you learn helps the decisions that follow.'), gain: { exp: 0.2, rel: 0.3 }, tally: { k: 1 }, gesture: 'palmi' },
  data: { label: P('Chiedere dati', 'Asking for data'), detail: P('Dati e documenti: sai di più e parli con più autorità; rallenta un poco.', 'Data and documents: you know more and speak with more authority; it slows things a little.'), gain: { exp: 0.3, rep: 0.2 }, tally: { k: 2 }, gesture: 'appunti' },
  propose: { label: P('Proporre un intervento', 'Proposing an intervention'), detail: P('Metti sul tavolo un intervento: ti impegni a portarlo avanti.', 'You put an intervention on the table: you commit to pushing it forward.'), gain: { pop: 0.4, inf: 0.2, rel: 0.5 }, tally: { trust: 1 }, commit: 'proposta', gesture: 'apre' },
  involve: { label: P('Coinvolgere gli uffici', 'Involving the offices'), detail: P('Porti al tavolo chi può decidere: più concretezza, ma serve tempo.', 'You bring to the table those who can decide: more substance, but it takes time.'), gain: { inf: 0.3, rel: 0.5, home: 0.3 }, tally: { trust: 1 }, commit: 'uffici', gesture: 'indica' },
  appoint: { label: P('Fissare un appuntamento', 'Setting a date'), detail: P('Una data in agenda: rende verificabile ciò che si è detto.', 'A date in the diary: it makes what was said checkable.'), gain: { rel: 0.5 }, tally: { trust: 1 }, commit: 'appuntamento', gesture: 'scrive' },
  mediate: { label: P('Mediare', 'Mediating'), detail: P('Avvicini le posizioni e abbassi la tensione; nessuno vince del tutto.', 'You bring positions closer and lower the tension; nobody wins entirely.'), gain: { rel: 0.8, party: 0.5 }, tally: { tension: -2, trust: 1 }, gesture: 'palmi' },
  compromise: { label: P('Proporre un compromesso', 'Proposing a compromise'), detail: P('Cedi qualcosa per tenere insieme tutti: un accordo parziale, ma solido.', 'You give up something to keep everyone together: a partial agreement, but a solid one.'), gain: { rel: 0.5, party: 0.3 }, tally: { tension: -1, trust: 1 }, commit: 'compromesso', gesture: 'stretta', safe: true },
  vote: { label: P('Mettere ai voti', 'Putting it to the vote'), detail: P('Chiudi la discussione con un voto: rafforza la linea se la sostieni bene, spacca se no.', 'You close the discussion with a vote: it strengthens the line if you carry it well, splits if not.'), gain: { party: 1.2, rel: 0.6 }, cost: {}, tally: { tension: 1 }, gesture: 'sottolinea', bold: true },
  assign: { label: P('Assegnare incarichi', 'Assigning tasks'), detail: P('Distribuisci responsabilità: leghi a te chi le riceve, ma qualcuno resta fuori.', 'You hand out responsibilities: you bind those who receive them to you, but someone is left out.'), gain: { party: 0.6, rel: 1 }, tally: { tension: 1 }, gesture: 'porge' },
  priority: { label: P('Cambiare le priorità', 'Changing the priorities'), detail: P('Metti avanti un punto e ne sposti un altro: pesa sul consenso interno e sulla tua influenza.', 'You move one point up and another down: it weighs on internal support and on your influence.'), gain: { party: 0.5, inf: 0.3 }, tally: { tension: 1 }, gesture: 'sottolinea' },
  contest: { label: P('Contestare', 'Challenging'), detail: P('Smonti la versione dell’altra parte: visibilità e scontro, con il rischio di ferire i rapporti.', 'You take apart the other side’s account: visibility and conflict, with the risk of hurting relations.'), gain: { not: 1, media: 0.6 }, cost: { rel: -0.8 }, tally: { tension: 2, trust: -1 }, gesture: 'interrompe' },
  clarify: { label: P('Chiarire la posizione', 'Clarifying your position'), detail: P('Dici dove stai e perché: coerenza e reputazione, senza promettere nulla.', 'You say where you stand and why: consistency and reputation, promising nothing.'), gain: { rep: 0.5 }, tally: { tension: -1 }, gesture: 'petto' },
  own: { label: P('Assumersi la responsabilità', 'Taking responsibility'), detail: P('Ammetti i limiti: perdi un poco di consenso, guadagni credibilità e la tensione scende.', 'You admit the limits: you lose a little support, gain credibility and the tension falls.'), gain: { rep: 0.6 }, cost: { pop: -0.2 }, tally: { tension: -2, trust: 1 }, gesture: 'petto' },
  announce: { label: P('Annunciare un intervento', 'Announcing an intervention'), detail: P('Dai la notizia davanti a tutti: visibilità e consenso subito, ma l’impegno è pubblico.', 'You give the news in front of everyone: visibility and support at once, but the commitment is public.'), gain: { pop: 0.6, not: 0.6, home: 0.5 }, tally: { trust: 1 }, commit: 'annuncio', gesture: 'saluta' },
  fund: { label: P('Concordare un finanziamento', 'Agreeing a funding'), detail: P('Metti dei fondi: rapporto più forte con chi li riceve, e un impegno da verificare.', 'You put up money: a stronger relationship with those who receive it, and a commitment to check.'), gain: { rel: 1.5 }, tally: { trust: 2 }, commit: 'finanziamento', gesture: 'porge', fund: true },
  verify: { label: P('Chiedere verifiche', 'Asking for checks'), detail: P('Documenti, relazioni e controlli: ne sai di più e resta una scadenza.', 'Documents, reports and checks: you know more and a deadline is left.'), gain: { rep: 0.3 }, tally: { k: 1 }, commit: 'verifica', gesture: 'appunti' },
  table: { label: P('Aprire un tavolo', 'Opening a round table'), detail: P('Un luogo stabile in cui decidere: costa un punto di capitale politico.', 'A permanent place to decide: it costs a point of political capital.'), gain: { rel: 1.2, inf: 0.4 }, cost: { capital: -1 }, tally: { trust: 1 }, commit: 'tavolo', gesture: 'apre', capital: true },
  story: { label: P('Raccontare un caso', 'Telling a story'), detail: P('Porti un caso concreto: si ricorda più dei numeri, ma non risolve nulla da solo.', 'You bring a concrete case: it is remembered better than figures, but solves nothing alone.'), gain: { pop: 0.5, not: 0.5 }, tally: { trust: 1 }, gesture: 'petto' }
});

// What each commitment is (a pending consequence of the career: kept or not, decided weeks later) and how long it takes.
export const COMMITMENTS = Object.freeze({
  proposta: { weeks: 4, label: P('Intervento proposto agli interessati', 'Intervention proposed to those concerned'), line: P('Impegno registrato: l’intervento proposto agli interessati.', 'Commitment recorded: the intervention proposed to those concerned.') },
  uffici: { weeks: 3, label: P('Risposta degli uffici coinvolti', 'Answer from the offices involved'), line: P('Impegno registrato: la risposta degli uffici coinvolti.', 'Commitment recorded: the answer from the offices involved.') },
  appuntamento: { weeks: 2, label: P('Appuntamento fissato', 'Meeting set'), line: P('Impegno registrato: un appuntamento fissato.', 'Commitment recorded: a meeting set.') },
  compromesso: { weeks: 3, label: P('Compromesso da attuare', 'Compromise to carry out'), line: P('Impegno registrato: il compromesso da attuare.', 'Commitment recorded: the compromise to carry out.') },
  annuncio: { weeks: 4, label: P('Annuncio pubblico da mantenere', 'Public announcement to keep'), line: P('Impegno registrato: l’annuncio pubblico da mantenere.', 'Commitment recorded: the public announcement to keep.') },
  finanziamento: { weeks: 5, label: P('Finanziamento concordato', 'Funding agreed'), line: P('Impegno registrato: il finanziamento concordato.', 'Commitment recorded: the funding agreed.') },
  verifica: { weeks: 3, label: P('Verifica richiesta', 'Check requested'), line: P('Impegno registrato: la verifica richiesta.', 'Commitment recorded: the check requested.') },
  tavolo: { weeks: 4, label: P('Tavolo aperto', 'Round table opened'), line: P('Impegno registrato: il tavolo aperto.', 'Commitment recorded: the round table opened.') }
});
export const COMMITMENT_TEXT = Object.freeze({
  hint: P('Chi era presente aspetta di vedere se l’impegno sarà rispettato', 'Those who were there are waiting to see whether the commitment will be honoured'),
  kept: P('Impegno rispettato', 'Commitment honoured'),
  broken: P('Impegno non rispettato', 'Commitment not honoured')
});

// The money of the move «agree a funding», by scene.
export const FUND_COST = Object.freeze({ associazioni: 300, cittadini: 200, cantiere: 400, sede: 0, commissione: 0, redazione: 0, consiglio: 0 });

// ---------- the moves of each family of encounters ----------
// q1 has the three approaches of the family of topics (data/activity-scene-approaches.js) plus a move of the situation (EXTRA_Q1 below); the other moments are these.
// «cittadini» is the market square (citizens), «associazioni» the civic hall (committees, associations).
export const MOVES = Object.freeze({
  cittadini: {
    q2: [
      M('c-caso', 'probe', 'charisma', 'Chiedi a una persona di raccontare un caso concreto', 'Ask someone to tell a concrete case'),
      M('c-segnalazioni', 'data', 'competence', 'Chiedi quante segnalazioni sono già state presentate e a chi', 'Ask how many reports have already been filed, and with whom'),
      M('c-ufficio', 'involve', 'competence', 'Chiama l’ufficio competente e metti il vivavoce davanti a tutti', 'Phone the office concerned and put it on speaker for everyone'),
      M('c-altri', 'listen', 'charisma', 'Chiedi agli altri presenti se hanno lo stesso problema', 'Ask the others present whether they have the same problem'),
      M('c-gestione', 'contest', 'reputation', 'Contesta il modo in cui il problema è stato gestito finora', 'Challenge the way the problem has been handled so far', 'opp'),
      M('c-luogo', 'verify', 'competence', 'Proponi di andare a vedere di persona il punto indicato', 'Offer to go and see the place in person')
    ],
    q3: [
      M('c-piano', 'propose', 'competence', 'Proponi un intervento in tre passi, con chi fa che cosa', 'Propose an intervention in three steps, with who does what'),
      M('c-incontro', 'appoint', 'charisma', 'Fissa un incontro con gli uffici e invitane due a venire', 'Set a meeting with the offices and invite two of them'),
      M('c-annuncio', 'announce', 'charisma', 'Annuncia l’intervento davanti a tutti i presenti', 'Announce the intervention in front of everyone', 'govern'),
      M('c-fondo', 'fund', 'competence', 'Assicura un piccolo fondo per cominciare subito', 'Secure a small fund to start at once', 'funds govern'),
      M('c-limiti', 'own', 'reputation', 'Di’ cosa non puoi fare e indica un’alternativa realistica', 'Say what you cannot do and point to a realistic alternative'),
      M('c-richiesta', 'involve', 'competence', 'Coinvolgi gli uffici con una richiesta formale a tuo nome', 'Involve the offices with a formal request in your name'),
      M('c-tavolo', 'table', 'reputation', 'Apri un tavolo con i residenti e gli uffici', 'Open a round table with residents and the offices', 'capital')
    ]
  },
  associazioni: {
    q2: [
      M('a-tavolo', 'table', 'reputation', 'Proponi un tavolo stabile con l’associazione e il Comune', 'Propose a standing table with the association and the municipality', 'capital'),
      M('a-progetto', 'data', 'competence', 'Chiedi il progetto e il bilancio dell’iniziativa', 'Ask for the project and the budget of the initiative'),
      M('a-effetti', 'probe', 'charisma', 'Chiedi quante persone coinvolge davvero e con quali risultati', 'Ask how many people it really involves and with what results'),
      M('a-bandi', 'involve', 'competence', 'Metti l’associazione in contatto con l’ufficio che gestisce i bandi', 'Put the association in touch with the office that runs the calls for funding'),
      M('a-ruolo', 'clarify', 'reputation', 'Spiega con chiarezza che cosa il tuo ruolo consente e che cosa no', 'Explain clearly what your role allows and what it does not'),
      M('a-passerella', 'contest', 'reputation', 'Respingi l’accusa di fare passerella, fatti alla mano', 'Reject the charge of showing off, with facts in hand')
    ],
    q3: [
      M('a-cofin', 'fund', 'competence', 'Concorda un cofinanziamento a stato di avanzamento', 'Agree a co-funding paid by progress', 'funds govern'),
      M('a-scritto', 'propose', 'competence', 'Chiedi un progetto scritto da portare all’istituzione', 'Ask for a written project to take to the institution'),
      M('a-date', 'appoint', 'charisma', 'Concorda con l’associazione le date delle verifiche', 'Agree the dates of the checks with the association'),
      M('a-rendiconto', 'verify', 'reputation', 'Chiedi un rendiconto trimestrale dei risultati', 'Ask for a quarterly report on the results'),
      M('a-pubblico', 'announce', 'charisma', 'Annuncia pubblicamente la collaborazione con l’associazione', 'Announce the partnership with the association in public'),
      M('a-niente-fondi', 'own', 'reputation', 'Di’ che per ora non puoi finanziare, ma puoi dare visibilità e un riferimento', 'Say you cannot fund it for now, but can give visibility and a contact')
    ]
  },
  cantiere: {
    q2: [
      M('w-sicurezza', 'verify', 'competence', 'Verifica la sicurezza di ponteggi e percorsi pedonali', 'Check the safety of scaffolding and pedestrian routes'),
      M('w-registro', 'data', 'competence', 'Chiedi il registro dei lavori e le fatture già pagate', 'Ask for the works log and the invoices already paid'),
      M('w-impresa', 'involve', 'competence', 'Convoca l’impresa e il progettista nello stesso incontro', 'Call the contractor and the designer to the same meeting', 'govern'),
      M('w-operai', 'probe', 'charisma', 'Chiedi agli operai che cosa manca per andare più veloci', 'Ask the workers what is missing to go faster'),
      M('w-ritardi', 'contest', 'reputation', 'Contesta la ricostruzione dei ritardi data dall’impresa', 'Challenge the contractor’s account of the delays')
    ],
    q3: [
      M('w-crono', 'propose', 'competence', 'Fai rivedere il cronoprogramma: prima i lavori critici', 'Have the schedule revised: the critical works first'),
      M('w-carte', 'data', 'competence', 'Richiedi la documentazione tecnica prima di decidere', 'Ask for the technical documents before deciding'),
      M('w-tavolo', 'table', 'reputation', 'Apri un tavolo tecnico con impresa, uffici e residenti', 'Open a technical table with contractor, offices and residents', 'capital'),
      M('w-spesa', 'fund', 'competence', 'Autorizza una spesa per accelerare i lavori critici', 'Authorise spending to speed up the critical works', 'funds govern'),
      M('w-data', 'announce', 'charisma', 'Annuncia ai cittadini la nuova data di consegna', 'Announce the new delivery date to the citizens', 'govern'),
      M('w-pazienza', 'own', 'reputation', 'Riconosci il ritardo e chiedi pazienza ai residenti', 'Acknowledge the delay and ask residents for patience')
    ]
  },
  sede: {
    q2: [
      M('p-correnti', 'mediate', 'charisma', 'Metti allo stesso tavolo le due correnti più distanti', 'Put the two most distant currents at the same table'),
      M('p-testo', 'compromise', 'competence', 'Proponi un testo con una clausola per ciascuna area', 'Propose a text with a clause for each area'),
      M('p-voti', 'data', 'competence', 'Mostra come sono andati i voti nelle sezioni', 'Show how the vote went in the branches'),
      M('p-polemica', 'contest', 'reputation', 'Contesta chi ha portato la polemica sui giornali', 'Challenge whoever took the quarrel to the newspapers'),
      M('p-segretari', 'listen', 'charisma', 'Fai parlare i segretari di sezione, uno alla volta', 'Let the branch secretaries speak, one at a time'),
      M('p-statuto', 'clarify', 'reputation', 'Ricorda che cosa dice lo statuto sul punto', 'Recall what the statute says on the point')
    ],
    q3: [
      M('p-voto', 'vote', 'charisma', 'Metti ai voti la proposta e accetta l’esito', 'Put the proposal to the vote and accept the result'),
      M('p-incarichi', 'assign', 'competence', 'Affida a un esponente di ogni area un incarico preciso', 'Give one member of each area a precise task'),
      M('p-priorita', 'priority', 'reputation', 'Cambia le priorità dell’agenda: prima questo punto', 'Change the priorities of the agenda: this point first'),
      M('p-odg', 'compromise', 'charisma', 'Chiudi con un ordine del giorno condiviso', 'Close with a shared resolution'),
      M('p-riconvoca', 'appoint', 'competence', 'Riconvoca la riunione fra dieci giorni, con i numeri', 'Call the meeting again in ten days, with the figures'),
      M('p-linea', 'own', 'reputation', 'Prenditi la responsabilità della linea davanti a tutti', 'Take responsibility for the line in front of everyone')
    ]
  },
  commissione: {
    q2: [
      M('m-esperti', 'probe', 'competence', 'Ascolta gli esperti uno per volta e chiedi dove sbaglia il testo', 'Hear the experts one at a time and ask where the text is wrong'),
      M('m-documenti', 'data', 'competence', 'Chiedi al governo i documenti e i dati che mancano', 'Ask the government for the missing documents and data'),
      M('m-relazione', 'verify', 'competence', 'Chiedi una relazione tecnica sulle coperture', 'Ask for a technical report on the funding'),
      M('m-relatore', 'contest', 'reputation', 'Contesta la ricostruzione del relatore', 'Challenge the rapporteur’s account'),
      M('m-maggioranza', 'mediate', 'charisma', 'Cerca un punto in comune con la maggioranza', 'Look for common ground with the majority')
    ],
    q3: [
      M('m-emendamento', 'propose', 'competence', 'Presenta un emendamento con la copertura indicata', 'Table an amendment with the funding indicated'),
      M('m-parti', 'vote', 'charisma', 'Chiedi di votare per parti separate', 'Ask for a vote in separate parts'),
      M('m-odg', 'compromise', 'charisma', 'Ritira l’emendamento in cambio di un ordine del giorno', 'Withdraw the amendment in exchange for a resolution'),
      M('m-nuove', 'appoint', 'competence', 'Chiedi un nuovo ciclo di audizioni', 'Ask for a new round of hearings'),
      M('m-aula', 'announce', 'charisma', 'Annuncia che porterai la questione in aula', 'Announce that you will bring the matter to the floor'),
      M('m-allegata', 'verify', 'reputation', 'Chiedi che la relazione tecnica sia allegata al testo', 'Ask for the technical report to be attached to the text')
    ]
  },
  redazione: {
    q2: [
      M('r-numeri', 'data', 'competence', 'Rispondi con tre numeri che si possono verificare', 'Answer with three figures that can be checked'),
      M('r-posizione', 'clarify', 'reputation', 'Chiarisci la tua posizione, anche se è diversa da quella del partito', 'Clarify your position, even if it differs from the party’s'),
      M('r-domanda', 'contest', 'reputation', 'Contesta la ricostruzione contenuta nella domanda', 'Challenge the account contained in the question'),
      M('r-errore', 'own', 'reputation', 'Ammetti l’errore prima che lo faccia notare il giornalista', 'Admit the mistake before the journalist points it out'),
      M('r-caso', 'story', 'charisma', 'Racconta un caso concreto che hai visto di persona', 'Tell a concrete case you saw in person')
    ],
    q3: [
      M('r-annuncio', 'announce', 'charisma', 'Annuncia un intervento con una data', 'Announce an intervention with a date'),
      M('r-colpa', 'own', 'reputation', 'Assumi la responsabilità di quanto è accaduto', 'Take responsibility for what happened'),
      M('r-distingui', 'clarify', 'reputation', 'Distingui con precisione ciò che è fatto da ciò che è promesso', 'Distinguish precisely what is done from what is promised'),
      M('r-prove', 'contest', 'competence', 'Chiudi respingendo l’accusa con le prove', 'Close by rejecting the charge with evidence'),
      M('r-confronto', 'propose', 'charisma', 'Proponi un confronto pubblico sul tema', 'Propose a public debate on the subject')
    ]
  },
  consiglio: {
    q2: [
      M('g-coperture', 'verify', 'competence', 'Chiedi la relazione tecnica sulle coperture', 'Ask for the technical report on the funding'),
      M('g-sintesi', 'mediate', 'charisma', 'Cerca la sintesi tra i due ministri in disaccordo', 'Seek a synthesis between the two ministers who disagree'),
      M('g-ministro', 'probe', 'charisma', 'Ascolta il ministro competente fino in fondo', 'Hear the responsible minister to the end'),
      M('g-programma', 'clarify', 'reputation', 'Richiama l’impegno del programma di governo', 'Recall the commitment of the government programme'),
      M('g-ritardo', 'contest', 'reputation', 'Contesta il ritardo del ministero', 'Challenge the ministry’s delay')
    ],
    q3: [
      M('g-decreto', 'vote', 'charisma', 'Metti ai voti il decreto e proseguite', 'Put the decree to the vote and move on'),
      M('g-istruttoria', 'assign', 'competence', 'Affida l’istruttoria a un ministro e il seguito a un sottosegretario', 'Give the preparation to one minister and the follow-up to an under-secretary'),
      M('g-ordine', 'priority', 'reputation', 'Cambia l’ordine del giorno: prima l’emergenza', 'Change the agenda: the emergency first'),
      M('g-ridotta', 'compromise', 'competence', 'Approva ora una versione ridotta e il resto più avanti', 'Approve a reduced version now and the rest later'),
      M('g-conferenza', 'announce', 'charisma', 'Annuncia la decisione in conferenza stampa', 'Announce the decision at a press conference'),
      M('g-pareri', 'appoint', 'competence', 'Riconvoca il consiglio dopo aver raccolto i pareri', 'Call the council again after collecting the opinions')
    ]
  }
});

// The extra move of the first moment (q1), by situation: three moves that depend on what the career holds, and one that is always there.
export const EXTRA_Q1 = Object.freeze([
  M('x-impegno', 'own', 'reputation', 'Rendi conto di quanto promesso l’ultima volta', 'Account for what you promised last time', 'prior'),
  M('x-programma', 'clarify', 'reputation', 'Richiama l’impegno del programma su questo tema', 'Recall the programme’s commitment on this subject', 'promise'),
  M('x-fatto', 'probe', 'charisma', 'Chiedi prima di tutto che cosa è già stato fatto', 'First of all ask what has already been done')
]);
// The last moment, when somebody asks for guarantees (q4): the same five moves for every encounter.
export const GUARANTEE_MOVES = Object.freeze([
  M('z-scritto', 'verify', 'reputation', 'Metti l’impegno per iscritto, con una data di verifica', 'Put the commitment in writing, with a date for the check'),
  M('z-incontro', 'appoint', 'charisma', 'Fissa un nuovo incontro fra un mese per rendere conto', 'Set a new meeting in a month to report back'),
  M('z-ridimensiona', 'own', 'reputation', 'Riduci l’impegno a ciò che puoi davvero garantire', 'Scale the commitment down to what you can really guarantee'),
  M('z-primo-passo', 'compromise', 'competence', 'Proponi un primo passo subito e il resto dopo', 'Propose a first step now and the rest later'),
  M('z-affianca', 'involve', 'competence', 'Chiedi di essere affiancato da chi deve attuarlo', 'Ask to be joined by those who must carry it out')
]);
// How the three approaches of the first moment (data/activity-scene-approaches.js) work: what each does, by scene.
export const APPROACH_FUNCTIONS = Object.freeze({
  associazioni: { ascolto: 'listen', concreto: 'propose', fermezza: 'clarify' },
  cantiere: { cronoprogramma: 'data', operai: 'listen', scritto: 'verify' },
  sede: { mediare: 'mediate', dati: 'data', linea: 'priority' },
  commissione: { dossier: 'data', testimoni: 'probe', emendamento: 'propose' },
  redazione: { merito: 'data', storia: 'story', sobrio: 'clarify' },
  consiglio: { sintesi: 'mediate', coperture: 'verify', collegialita: 'clarify' }
});

// ---------- the people react: what a guest says to a move (by function and by how it went) ----------
export const REACTION_LINES = Object.freeze({
  listen: { good: P('Ci ha lasciato parlare fino in fondo: non succedeva da tempo.', 'You let us speak to the end: it has not happened for a long time.'), mid: P('Ascolta con attenzione, ma ora aspettiamo una risposta.', 'You listen carefully, but now we are waiting for an answer.'), bad: P('Ascoltare va bene, ma qui servono decisioni, non pazienza.', 'Listening is fine, but here we need decisions, not patience.') },
  probe: { good: P('La domanda coglie il punto: adesso il quadro è molto più chiaro.', 'The question hits the point: the picture is much clearer now.'), mid: P('Una domanda sensata, ma la risposta non cambia molto.', 'A sensible question, but the answer does not change much.'), bad: P('Domande che girano intorno al problema senza toccarlo.', 'Questions that circle the problem without touching it.') },
  data: { good: P('I numeri sono chiari e tornano: si può discutere su basi solide.', 'The figures are clear and they add up: we can discuss on solid ground.'), mid: P('I dati ci sono, ma raccontano solo una parte della storia.', 'The data are there, but they tell only part of the story.'), bad: P('Cifre senza contesto: servono a poco e qualcuno le contesta.', 'Figures without context: of little use, and someone disputes them.') },
  propose: { good: P('Il piano è concreto: sappiamo chi fa che cosa e quando.', 'The plan is concrete: we know who does what and when.'), mid: P('La proposta è ragionevole, ma mancano i dettagli per crederci.', 'The proposal is reasonable, but the details are missing to believe in it.'), bad: P('Un piano vago: non si capisce chi lo paga né quando parte.', 'A vague plan: it is unclear who pays for it or when it starts.') },
  involve: { good: P('Coinvolgere subito chi decide è la mossa giusta: ora ci sono interlocutori veri.', 'Involving those who decide straight away is the right move: now there are real counterparts.'), mid: P('Passare la palla agli uffici può aiutare, o allungare i tempi.', 'Passing the ball to the offices may help, or lengthen the time.'), bad: P('Rimandare agli uffici sembra un modo per prendere tempo.', 'Referring us to the offices looks like a way of buying time.') },
  appoint: { good: P('Una data scritta in agenda: finalmente qualcosa di verificabile.', 'A date in the diary: at last something that can be checked.'), mid: P('Un appuntamento è un inizio, ma da solo non risolve nulla.', 'A meeting is a start, but it solves nothing by itself.'), bad: P('Un altro incontro? Ne abbiamo fatti troppi senza risultati.', 'Another meeting? We have had too many with no results.') },
  mediate: { good: P('Le posizioni si avvicinano: nessuno ha vinto, ma tutti restano al tavolo.', 'The positions move closer: nobody has won, but everybody stays at the table.'), mid: P('La mediazione tiene, anche se nessuno è davvero soddisfatto.', 'The mediation holds, even if nobody is truly satisfied.'), bad: P('Mediare tra posizioni così lontane non basta: il confronto si riapre.', 'Mediating between positions so far apart is not enough: the dispute reopens.') },
  compromise: { good: P('Il compromesso regge: ciascuno rinuncia a qualcosa e il resto è salvo.', 'The compromise holds: each gives something up and the rest is safe.'), mid: P('Un compromesso a metà: qualcuno lo accetta solo per non rompere.', 'A half compromise: some accept it only to avoid a break.'), bad: P('Il compromesso scontenta tutti: nessuno lo difenderà.', 'The compromise displeases everyone: nobody will defend it.') },
  vote: { good: P('Il voto è chiaro e la linea ne esce rafforzata: si va avanti uniti.', 'The vote is clear and the line comes out stronger: we go on together.'), mid: P('Passa di poco: la decisione c’è, ma resta un’area contraria.', 'It passes narrowly: there is a decision, but an opposing area remains.'), bad: P('Il voto divide e la minoranza lo contesterà ancora.', 'The vote divides and the minority will go on contesting it.') },
  assign: { good: P('Gli incarichi sono equilibrati: ognuno sa che cosa deve fare.', 'The tasks are balanced: everyone knows what to do.'), mid: P('Gli incarichi sono accettati, ma qualcuno si sente escluso.', 'The tasks are accepted, but someone feels left out.'), bad: P('Gli incarichi sembrano scelti per convenienza: si apre un nuovo fronte.', 'The tasks look chosen for convenience: a new front opens.') },
  priority: { good: P('Le priorità cambiano e il punto più urgente passa avanti.', 'The priorities change and the most urgent point moves forward.'), mid: P('Le priorità cambiano, ma non tutti sono convinti dell’ordine.', 'The priorities change, but not everyone is convinced by the order.'), bad: P('Cambiare le priorità adesso sembra un capriccio: l’agenda salta.', 'Changing the priorities now looks like a whim: the agenda collapses.') },
  contest: { good: P('La ricostruzione è smontata punto per punto: l’altra parte non risponde.', 'The account is taken apart point by point: the other side does not reply.'), mid: P('Il confronto si accende: ognuno resta sulle sue posizioni.', 'The exchange heats up: everyone stays on their positions.'), bad: P('Lo scontro degenera: urla e interruzioni coprono ogni argomento.', 'The clash gets out of hand: shouting and interruptions drown every argument.') },
  clarify: { good: P('La posizione è chiara e coerente: si sa dove si sta.', 'The position is clear and consistent: we know where you stand.'), mid: P('Posizione chiara, ma alcuni la trovano troppo rigida.', 'A clear position, but some find it too rigid.'), bad: P('Più chiarisce, più sembra evasivo: la domanda resta aperta.', 'The more you clarify, the more evasive you seem: the question stays open.') },
  own: { good: P('Riconoscere i limiti dà credibilità: la tensione scende.', 'Acknowledging the limits earns credibility: the tension falls.'), mid: P('L’ammissione è apprezzata, ma ora si aspettano i fatti.', 'The admission is appreciated, but now they expect results.'), bad: P('Ammettere i limiti senza un’alternativa sembra una resa.', 'Admitting the limits without an alternative looks like surrender.') },
  announce: { good: P('L’annuncio è accolto con favore: ora tutti ne aspettano gli effetti.', 'The announcement is welcomed: now everyone waits for its effects.'), mid: P('L’annuncio fa notizia, ma c’è chi vuole garanzie scritte.', 'The announcement makes news, but some want it in writing.'), bad: P('L’annuncio suona vuoto: promesse già sentite.', 'The announcement sounds hollow: promises already heard.') },
  fund: { good: P('I fondi ci sono e questo cambia tutto: si può partire subito.', 'The funds are there and that changes everything: we can start at once.'), mid: P('Una somma utile ma limitata: basta per cominciare, non per finire.', 'A useful but limited sum: enough to begin, not to finish.'), bad: P('Fondi promessi senza copertura: nessuno ci crede davvero.', 'Funds promised without cover: nobody really believes it.') },
  verify: { good: P('Una verifica a data fissa: così gli impegni diventano controllabili.', 'A check on a fixed date: that way commitments can be monitored.'), mid: P('Va bene verificare, ma intanto il problema resta.', 'Checking is fine, but meanwhile the problem remains.'), bad: P('Verifiche e carte: sembra solo un modo per rinviare.', 'Checks and paperwork: it looks only like a way to delay.') },
  table: { good: P('Il tavolo ha un metodo e un calendario: è un luogo dove si decide.', 'The table has a method and a calendar: it is a place where things are decided.'), mid: P('Un tavolo serve solo se si riunisce davvero.', 'A table is useful only if it really meets.'), bad: P('L’ennesimo tavolo senza poteri: non porterà a nulla.', 'Yet another table without powers: it will lead nowhere.') },
  story: { good: P('Quel racconto colpisce: la gente si riconosce e ricorda.', 'That story strikes home: people recognise themselves and remember.'), mid: P('Una bella storia, ma non risponde alla domanda.', 'A good story, but it does not answer the question.'), bad: P('Si racconta un aneddoto per evitare la domanda: non convince.', 'An anecdote told to avoid the question: it does not convince.') }
});
// The second person of the scene joins in (what he says depends on how the move was received).
export const REACTION_TYPES = Object.freeze({
  approvazione: { label: P('Approvazione', 'Approval'), joins: [P('Giusto, era ora che qualcuno lo dicesse.', 'Right, it was time someone said it.'), P('Concordo: si va nella direzione giusta.', 'I agree: this is the right direction.')], gesture: 'applaude', expression: 'sorridente', camera: 'right' },
  dissenso: { label: P('Dissenso', 'Disagreement'), joins: [P('Non sono d’accordo: così non funziona.', 'I do not agree: that will not work.'), P('Questa lettura non mi convince.', 'This reading does not convince me.')], gesture: 'dissenso', expression: 'determinata', camera: 'right' },
  perplessita: { label: P('Perplessità', 'Doubt'), joins: [P('Non so se basterà, ma vedremo.', 'I do not know whether it will be enough, but we shall see.'), P('Mi lascia più di un dubbio.', 'It leaves me with more than one doubt.')], gesture: 'esita', expression: 'serena', camera: 'right' },
  protesta: { label: P('Protesta', 'Protest'), joins: [P('Così non si può andare avanti!', 'We cannot go on like this!'), P('Basta parole: vogliamo i fatti!', 'Enough words: we want action!')], gesture: 'interrompe', expression: 'determinata', camera: 'protest' },
  soddisfazione: { label: P('Soddisfazione', 'Satisfaction'), joins: [P('Finalmente una risposta chiara.', 'At last a clear answer.'), P('È quello che chiedevamo.', 'It is what we asked for.')], gesture: 'stretta', expression: 'sorridente', camera: 'wide' },
  compromesso: { label: P('Compromesso', 'Compromise'), joins: [P('Un punto d’incontro si può trovare.', 'A meeting point can be found.'), P('Se ognuno cede qualcosa, si va avanti.', 'If everyone gives a little, we can go on.')], gesture: 'palmi', expression: 'serena', camera: 'wide' },
  garanzie: { label: P('Richiesta di garanzie', 'Request for guarantees'), joins: [P('Mettiamolo per iscritto, con una data.', 'Let us put it in writing, with a date.'), P('Va bene, ma chi garantisce che sarà fatto?', 'Fine, but who guarantees it will be done?')], gesture: 'indica', expression: 'determinata', camera: 'right' }
});

// ---------- the end: how an encounter closes and what it leaves ----------
export const OUTCOME_KINDS = Object.freeze({
  accordo: { label: P('Accordo', 'Agreement'), text: P('Si chiude con un accordo che tutti i presenti possono sottoscrivere.', 'It ends with an agreement everyone present can sign.') },
  parziale: { label: P('Accordo parziale', 'Partial agreement'), text: P('Si chiude con un accordo parziale: resta aperto qualche punto.', 'It ends with a partial agreement: a few points remain open.') },
  impegno: { label: P('Impegno', 'Commitment'), text: P('Si chiude con un impegno preso davanti a tutti: ora conta mantenerlo.', 'It ends with a commitment made in front of everyone: what counts now is keeping it.') },
  rinvio: { label: P('Rinvio', 'Postponement'), text: P('Si chiude con un rinvio: la decisione arriverà dopo le verifiche.', 'It ends with a postponement: the decision will come after the checks.') },
  irrisolto: { label: P('Problema irrisolto', 'Problem unresolved'), text: P('Il problema resta irrisolto: l’incontro non ha cambiato la situazione.', 'The problem remains unresolved: the meeting has not changed the situation.') },
  contrasto: { label: P('Contrasto', 'Open conflict'), text: P('Si chiude con un contrasto aperto: i toni si sono alzati e nessuno ha ceduto.', 'It ends in open conflict: voices were raised and nobody gave way.') }
});
// What the meeting leaves, said in plain words (each line appears only when it is true of the choices made).
export const CONSEQUENCE_LINES = Object.freeze({
  trustUp: P('La fiducia dei presenti cresce.', 'The trust of those present grows.'),
  trustDown: P('La fiducia dei presenti cala.', 'The trust of those present falls.'),
  learned: P('Hai raccolto informazioni utili per le decisioni successive.', 'You have gathered information useful for later decisions.'),
  calm: P('Il clima si è disteso.', 'The mood has eased.'),
  tense: P('Il clima resta teso.', 'The mood remains tense.'),
  pressUp: P('La stampa dà risalto all’incontro.', 'The press gives the meeting prominence.'),
  pressDown: P('La stampa riporta lo scontro.', 'The press reports the clash.'),
  standingUp: P('La tua reputazione ne esce rafforzata.', 'Your reputation comes out stronger.'),
  standingDown: P('La tua reputazione ne esce incrinata.', 'Your reputation is dented.'),
  costFunds: P('Fondi impegnati per l’intervento.', 'Funds committed to the intervention.'),
  costCapital: P('Capitale politico impegnato.', 'Political capital committed.'),
  unprepared: P('Hai promesso senza averne gli elementi: l’impegno è fragile.', 'You promised without the facts: the commitment is fragile.')
});
// Why a move did well or badly beyond the stat it relies on (the player reads these in the reaction).
export const WHY_LINES = Object.freeze({
  informed: P('eri informato: avevi già raccolto gli elementi', 'you were informed: you had already gathered the facts'),
  uninformed: P('senza dati la mossa resta vaga', 'without data the move stays vague'),
  heated: P('il clima era già teso e lo hai acceso ancora', 'the mood was already tense and you inflamed it further'),
  tension: P('c’era una tensione da ricomporre', 'there was tension to be eased'),
  nothingToMediate: P('non c’era ancora nulla da ricomporre', 'there was nothing to settle yet'),
  noFunds: P('i fondi sono scarsi: l’impegno è a rischio', 'funds are short: the commitment is at risk'),
  authority: P('il tuo ruolo ti permette di decidere', 'your role lets you decide'),
  noAuthority: P('il tuo ruolo non ti permette di decidere da solo', 'your role does not let you decide alone'),
  repeated: P('lo avevi già fatto: ripeterlo rende meno', 'you had already done it: repeating it gives less'),
  recovering: P('dopo un passo falso chiarire aiuta', 'after a misstep, setting things straight helps'),
  prior: P('rendi conto di un impegno già preso', 'you are accounting for a commitment already made')
});

// The words that lead from one moment to the next: they depend on how the last move went (the encounter develops, it is not a fixed list of questions).
export const STAGE_TEXT = Object.freeze({
  q3: { good: P('Le cose sono più chiare, ora. Dite a noi che cosa si decide, in concreto.', 'Things are clearer now. Tell us what is decided, in concrete terms.'), mid: P('Siamo a metà strada. Che cosa si fa adesso, davvero?', 'We are halfway there. What do we actually do now?'), bad: P('Così non ci siamo. Qual è la vostra proposta, a questo punto?', 'This is not working. What is your proposal at this point?'), tense: P('I toni si stanno alzando: come se ne esce, adesso?', 'Voices are rising: how do we get out of this?') },
  q4: { guarantee: P('Va bene, ma vogliamo garanzie: come ci assicura che sarà fatto?', 'Fine, but we want guarantees: how do you assure us it will be done?'), tense: P('Prima di chiudere dobbiamo ricucire lo strappo: come procediamo?', 'Before we close we must mend the rift: how do we proceed?') },
  titles: { r1: P('Reazioni alla prima risposta', 'Reactions to the first answer'), r2: P('Reazioni alla seconda risposta', 'Reactions to the second answer'), r3: P('Reazioni alla decisione', 'Reactions to the decision'), r4: P('Reazioni alla garanzia', 'Reactions to the guarantee'), q3: P('La decisione', 'The decision'), q4: P('Le garanzie', 'The guarantees') },
  notes: { funds: P('Non ci sono fondi liberi per questa mossa.', 'There are no free funds for this move.'), capital: P('Serve un punto di capitale politico libero.', 'It needs a free point of political capital.') }
});

export const ALL_PAIRS = [
  ...Object.values(STAGE_TEXT.q3), ...Object.values(STAGE_TEXT.q4), ...Object.values(STAGE_TEXT.titles), ...Object.values(STAGE_TEXT.notes),
  ...Object.values(FUNCTIONS).flatMap(item => [item.label, item.detail]),
  ...Object.values(COMMITMENTS).flatMap(item => [item.label, item.line]), ...Object.values(COMMITMENT_TEXT),
  ...Object.values(MOVES).flatMap(kind => Object.values(kind).flat().map(move => move.label)),
  ...[...EXTRA_Q1, ...GUARANTEE_MOVES].map(move => move.label),
  ...Object.values(REACTION_LINES).flatMap(item => Object.values(item)),
  ...Object.values(REACTION_TYPES).flatMap(item => [item.label, ...item.joins]),
  ...Object.values(OUTCOME_KINDS).flatMap(item => [item.label, item.text]),
  ...Object.values(CONSEQUENCE_LINES), ...Object.values(WHY_LINES)
];
