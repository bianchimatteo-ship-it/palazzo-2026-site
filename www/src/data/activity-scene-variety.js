// More variety for the animated scenes of the weekly activities (core/activity-scenes.js): until now every activity had ONE opening sentence, the guests came from a pool of four names and the room was always empty
// behind them. Here: (1) ATMOSPHERE, the moment of the day, the weather or the mood of the room, told before the situation (the situation itself, the topics, the moves and the results are untouched); (2) LEADIN,
// a line of the room between the opening and the first question, and between the first reaction and the second one; (3) BYSTANDERS, a person who is in the room and does not speak (an usher, a photographer, a
// site foreman…) and reacts to what is said; (4) AMBIENCE, what the room has around it, by activity (a crowd, cameras, papers, helmets…). Everything is a pair [Italian, English], with no free parts, so the same
// pairs are the text of the game and of the phrase-book. Nothing here decides a result: it is the colour of the encounter, chosen by the seed of the scene (the same scene always looks the same).
const P = (it, en) => [it, en];

export const ATMOSPHERE = Object.freeze({
  associazioni: [
    P('Fuori piove e la sala si riempie piano, di ombrelli bagnati e di borse della spesa.', 'It is raining outside and the hall fills slowly with wet umbrellas and shopping bags.'),
    P('È il tardo pomeriggio: la luce entra obliqua dalle finestre e qualcuno ha portato i dolci.', 'It is late afternoon: the light comes in slanting through the windows and someone has brought pastries.'),
    P('Il caffè è già finito e le sedie non bastano: alcuni restano in piedi in fondo.', 'The coffee has run out and there are not enough chairs: some stand at the back.'),
    P('Una signora ha portato una cartellina di lettere e foto, e la tiene stretta sulle ginocchia.', 'A woman has brought a folder of letters and photos and holds it tight on her knees.'),
    P('Sul tavolo c’è un taccuino con l’elenco degli interventi: tutti vogliono parlare per primi.', 'On the table is a notebook with the list of speakers: everyone wants to speak first.'),
    P('Un bambino gioca sotto le sedie mentre i genitori si dispongono a semicerchio.', 'A child plays under the chairs while the parents arrange themselves in a half-circle.'),
    P('Il microfono fischia, poi si sistema: la sala si zittisce di colpo.', 'The microphone squeals, then settles: the hall falls suddenly silent.'),
    P('Fa caldo e qualcuno apre le finestre: dalla strada arriva il rumore del traffico.', 'It is hot and someone opens the windows: the noise of traffic comes in from the street.')
  ],
  cantiere: [
    P('Un vento freddo muove i teli della recinzione e il rumore di una betoniera copre le voci.', 'A cold wind moves the fence sheeting and a concrete mixer drowns the voices.'),
    P('È mattina presto: gli operai sono già al lavoro e la polvere si posa sugli elmetti.', 'It is early morning: the workers are already at it and dust settles on the helmets.'),
    P('Il terreno è ancora fangoso dopo la pioggia e tutti camminano sulle tavole.', 'The ground is still muddy after the rain and everyone walks on planks.'),
    P('Il capocantiere srotola la planimetria sul cofano di un furgone e la ferma con un sasso.', 'The foreman unrolls the plan on the bonnet of a van and holds it down with a stone.'),
    P('Una gru gira lenta sopra le vostre teste e per un momento nessuno parla.', 'A crane turns slowly above your heads and for a moment nobody speaks.'),
    P('Il cartello dei lavori è sbiadito: la data di fine, scritta a pennarello, è stata corretta due volte.', 'The works sign has faded: the end date, written in marker, has been corrected twice.'),
    P('Un cane di passaggio annusa i sacchi di cemento mentre si discute del cronoprogramma.', 'A passing dog sniffs the cement sacks while the schedule is discussed.'),
    P('Il sole è alto e l’ombra dei ponteggi disegna righe sul tavolo da campo.', 'The sun is high and the shadow of the scaffolding draws stripes on the trestle table.')
  ],
  sede: [
    P('La sede è quasi vuota: si sente solo il ronzio della stampante e il bollitore in cucina.', 'The headquarters are almost empty: only the hum of the printer and the kettle in the kitchen.'),
    P('È sera tardi: le bandiere sono appese storte e sul tavolo restano i resti di una cena.', 'It is late evening: the flags hang crooked and the remains of a supper are still on the table.'),
    P('Una pila di volantini ancora impacchettati occupa un angolo della stanza.', 'A pile of leaflets, still wrapped, takes up a corner of the room.'),
    P('Qualcuno ha scritto alla lavagna tre parole e le ha cerchiate: sono il motivo della riunione.', 'Someone has written three words on the board and circled them: they are the reason for the meeting.'),
    P('Il telefono di uno dei presenti vibra di continuo, e lui lo gira a faccia in giù.', 'One of those present has a phone that keeps buzzing, and turns it face down.'),
    P('Fuori dalla finestra qualcuno attacca i manifesti: ogni tanto la colla gocciola sul vetro.', 'Outside the window someone is putting up posters: now and then the glue drips on the glass.'),
    P('Sul tavolo ci sono tessere, elenchi e una calcolatrice con il nastro di carta già lungo.', 'On the table are cards, lists and a calculator with a long paper tape already.'),
    P('Arrivano alla spicciolata, con i cappotti ancora addosso: la stufa non è ancora calda.', 'They arrive one by one, still in their coats: the heater is not warm yet.')
  ],
  commissione: [
    P('L’aula è fredda e illuminata a metà: i microfoni si accendono uno alla volta.', 'The room is cold and half lit: the microphones come on one at a time.'),
    P('Il presidente controlla l’orologio: i tempi sono contingentati e lo sanno tutti.', 'The chair checks the clock: the speaking times are limited and everyone knows it.'),
    P('Un funzionario distribuisce i fascicoli, ancora tiepidi di fotocopiatrice.', 'An official hands out the files, still warm from the photocopier.'),
    P('Sulla tavola ci sono bottigliette d’acqua e un segnaposto è stato messo al contrario.', 'There are water bottles on the table and a name card has been put the wrong way round.'),
    P('Qualcuno tossisce, qualcuno sfoglia: nel silenzio il verbale comincia a riempirsi.', 'Someone coughs, someone leafs through: in the silence the minutes begin to fill.'),
    P('Fuori dalle finestre c’è la fila dei taxi: la seduta è stata convocata di fretta.', 'Outside the windows is a row of taxis: the sitting was called in a hurry.'),
    P('Un collega arriva in ritardo, si siede senza fare rumore e chiede a mezza voce a che punto siamo.', 'A colleague arrives late, sits down quietly and asks in a low voice where we are.'),
    P('Le luci dell’aula ronzano: è il momento in cui tutti guardano i propri appunti.', 'The lights of the room hum: it is the moment when everyone looks at their notes.')
  ],
  redazione: [
    P('Squilla un telefono dopo l’altro e sullo schermo scorrono le agenzie dell’ultima ora.', 'One phone rings after another and the latest agency wires scroll across the screen.'),
    P('È quasi l’ora di chiudere il pezzo: il caporedattore passa dietro le scrivanie e guarda l’orologio.', 'It is almost time to file the piece: the editor walks behind the desks and looks at the clock.'),
    P('Un tecnico sistema le luci e prova il microfono: «Uno, due, prova».', 'A technician adjusts the lights and tests the microphone: “One, two, check.”'),
    P('Sul tavolo c’è una tazza di caffè freddo e un blocco di appunti pieno di frecce.', 'On the table is a cup of cold coffee and a notepad full of arrows.'),
    P('Dalla finestra si vede il cortile: due colleghi fumano e scorrono i social sul telefono.', 'Through the window you see the courtyard: two colleagues smoke and scroll social media on their phones.'),
    P('Il registratore è acceso: il giornalista ha già preparato tre domande e una di riserva.', 'The recorder is on: the journalist has prepared three questions and a spare.'),
    P('Un cameraman ti fa cenno di spostarti di mezzo passo: così la luce è migliore.', 'A cameraman gestures for you to move half a step: the light is better that way.'),
    P('Nella stanza accanto discutono già di cosa mettere in prima pagina: si sente il tuo nome.', 'In the next room they are already arguing about the front page: your name is audible.')
  ],
  consiglio: [
    P('La sala è austera e silenziosa: i ministri arrivano con le cartelle già aperte.', 'The room is solemn and quiet: the ministers arrive with their folders already open.'),
    P('I segretari aggiornano l’ordine del giorno a matita: il punto che ti riguarda è stato spostato.', 'The secretaries update the agenda in pencil: the item that concerns you has been moved.'),
    P('Fuori dalle vetrate i fotografi aspettano: la seduta sarà breve ma delicata.', 'Outside the windows the photographers wait: the sitting will be short but delicate.'),
    P('Il presidente del Consiglio guarda l’orologio e chiede di cominciare: ci sono già due telefoni in vibrazione.', 'The Prime Minister looks at the clock and asks to begin: two phones are already buzzing.'),
    P('Sul tavolo ci sono i fascicoli con le cifre, in una cartellina verde per ogni dicastero.', 'On the table are the files with the figures, in a green folder for each ministry.'),
    P('Nessuno ha ancora preso la parola: tutti aspettano di capire chi cederà per primo.', 'Nobody has spoken yet: everyone is waiting to see who will give way first.'),
    P('Un usciere porta l’acqua e richiude la porta con cura: la discussione può cominciare.', 'An usher brings water and closes the door carefully: the discussion can begin.'),
    P('La luce del pomeriggio taglia la tavola in due: da una parte i fascicoli, dall’altra le facce stanche.', 'The afternoon light cuts the table in two: files on one side, tired faces on the other.')
  ],
  mercato: [
    P('È giorno di mercato: l’odore del pane e del pesce arriva fino alla fontana.', 'It is market day: the smell of bread and fish reaches the fountain.'),
    P('Il sole è già caldo e i banchi tirano su i tendoni a righe.', 'The sun is already warm and the stalls put up their striped awnings.'),
    P('Una signora con il carrello si ferma, ti guarda e comincia a raccontare prima ancora che tu abbia salutato.', 'A woman with a trolley stops, looks at you and begins to talk before you have said hello.'),
    P('Un ambulante fa un fischio e ti passa una mela: «Intanto assaggi, poi ne parliamo».', 'A stallholder whistles and hands you an apple: “Taste first, then we talk.”'),
    P('Un gruppo di anziani sulla panchina ha già deciso che toccherà a te rispondere.', 'A group of old men on the bench has already decided that you will be the one to answer.'),
    P('Dalla piazza arriva il suono di una fisarmonica: bisogna alzare un po’ la voce.', 'The sound of an accordion comes from the square: you have to raise your voice a little.'),
    P('Un ragazzo in bici rallenta, ascolta un momento e riparte con un sorriso storto.', 'A boy on a bike slows down, listens for a moment and rides on with a crooked smile.'),
    P('Un vigile osserva da lontano: si capisce che qualcuno vuole parlarti del parcheggio.', 'A traffic warden watches from afar: someone clearly wants to talk to you about parking.')
  ]
});

// A line of the room before the first and before the second question of the guests (by kind of room).
export const LEADIN = Object.freeze({
  associazioni: {
    q1: [P('Il brusio cala: il primo intervento è già in coda sul foglio dei turni.', 'The murmur falls: the first speaker is already queued on the list.'), P('Qualcuno alza la mano prima ancora che tu abbia finito di salutare.', 'Someone raises a hand before you have finished greeting.'), P('Si fa avanti chi è venuto apposta: ha le idee in ordine e un foglio in mano.', 'The person who came on purpose steps forward: ideas in order and a sheet in hand.'), P('Un colpo di tosse, poi una voce ferma dal fondo della sala.', 'A cough, then a steady voice from the back of the hall.'), P('Le sedie strisciano: tutti si voltano verso chi sta per parlare.', 'Chairs scrape: everyone turns towards the person about to speak.')],
    q2: [P('Un altro si alza, più nervoso del primo, e aspetta che gli sia data la parola.', 'Another gets up, more nervous than the first, and waits to be given the floor.'), P('C’è chi annuisce e chi scuote la testa: il tema scalda la sala.', 'Some nod and some shake their heads: the topic warms the hall.'), P('Dal tavolo qualcuno interviene a mezza voce: «Se posso aggiungere…».', 'From the table someone chimes in quietly: “If I may add…”'), P('Il presidente della riunione guarda l’orologio e passa la parola.', 'The chair of the meeting looks at the clock and gives the floor.'), P('Qualcuno prende appunti, qualcuno registra con il telefono.', 'Some take notes, some record on their phones.')]
  },
  cantiere: {
    q1: [P('Il capocantiere si toglie il guanto e indica il punto esatto.', 'The foreman takes off a glove and points to the exact spot.'), P('Il rumore dei macchinari cala di colpo: tocca a chi segue i lavori.', 'The noise of the machines drops suddenly: it is the turn of the one who follows the works.'), P('Un tecnico apre il tablet e fa scorrere le fotografie dei giorni scorsi.', 'A technician opens a tablet and scrolls through the photos of recent days.'), P('Il progettista batte due volte sul disegno: «Qui è dove ci siamo fermati».', 'The designer taps the drawing twice: “This is where we stopped.”'), P('Si ferma una ruspa e nel silenzio improvviso si sente la domanda.', 'A digger stops and in the sudden silence the question is heard.')],
    q2: [P('Un secondo interlocutore si avvicina, i calcoli ancora a penna sul blocchetto.', 'A second speaker steps closer, figures still in pen on the notepad.'), P('Il vento gira i fogli sul tavolo e qualcuno li ferma con le mani.', 'The wind turns the sheets on the table and someone holds them with their hands.'), P('Dal ponteggio un operaio scende a sentire: nessuno gli chiede di tornare su.', 'A worker comes down from the scaffolding to listen: nobody asks him to go back.'), P('Il direttore dei lavori rilegge la voce di spesa e alza gli occhi.', 'The site manager rereads the expense item and looks up.'), P('Un camion in manovra costringe tutti a fare due passi indietro.', 'A lorry manoeuvring forces everyone to take two steps back.')]
  },
  sede: {
    q1: [P('Si abbassa il tono delle voci: chi parla per primo ha già lo sguardo basso.', 'Voices drop: whoever speaks first is already looking down.'), P('Qualcuno spinge verso di te un foglio con tre nomi e un numero.', 'Someone pushes towards you a sheet with three names and a number.'), P('Il segretario di sezione si schiarisce la voce: «Allora, partiamo da qui».', 'The branch secretary clears his throat: “Right, let us start here.”'), P('Una sedia si sposta: chi aspettava di intervenire ora è pronto.', 'A chair moves: the person who waited to speak is now ready.'), P('Il bollitore scatta in cucina e la prima domanda arriva con il rumore delle tazze.', 'The kettle clicks off in the kitchen and the first question arrives with the clatter of cups.')],
    q2: [P('Dall’altro lato del tavolo si fa avanti chi finora ha solo ascoltato.', 'From the other side of the table steps in someone who has only listened so far.'), P('C’è chi guarda il soffitto e chi il telefono: la seconda domanda li costringe a tornare.', 'Some look at the ceiling and some at their phones: the second question brings them back.'), P('Un militante storico alza due dita: «Una cosa soltanto».', 'A veteran member raises two fingers: “Just one thing.”'), P('Si sente una porta sbattere in corridoio e nessuno ci fa caso.', 'A door slams in the corridor and nobody notices.'), P('Qualcuno scrive qualcosa sulla lavagna e la cancella subito.', 'Someone writes something on the board and wipes it at once.')]
  },
  commissione: {
    q1: [P('Il presidente dà la parola con un cenno: il tempo scorre sul display.', 'The chair gives the floor with a nod: the time ticks on the display.'), P('Un commissario ripassa gli appunti e si prepara a un intervento breve.', 'A member goes over their notes and prepares a short speech.'), P('Il verbalizzante alza la testa: la domanda verrà messa agli atti.', 'The clerk looks up: the question will go on record.'), P('Si accende un microfono e una voce chiede la parola sull’ordine dei lavori.', 'A microphone comes on and a voice asks for the floor on a point of order.'), P('Il rumore dei fogli cessa: sta per parlare chi ha letto davvero il fascicolo.', 'The rustle of papers stops: someone who has actually read the file is about to speak.')],
    q2: [P('Un secondo commissario si sporge dal banco: «Chiedo un chiarimento».', 'A second member leans over the bench: “I ask for a clarification.”'), P('Qualcuno sussurra al vicino e annota qualcosa a margine.', 'Someone whispers to their neighbour and jots something in the margin.'), P('Il presidente richiama al tempo e poi concede trenta secondi.', 'The chair calls time and then allows thirty seconds.'), P('Un funzionario fa scivolare un biglietto: c’è una cifra da verificare.', 'An official slips over a note: there is a figure to check.'), P('Dai banchi dell’opposizione si alza un mormorio, subito richiamato.', 'A murmur rises from the opposition benches, quickly called to order.')]
  },
  redazione: {
    q1: [P('Il giornalista apre il blocco e ti guarda: «Cominciamo da una cosa semplice».', 'The journalist opens the notepad and looks at you: “Let us start with something simple.”'), P('La spia rossa si accende: da qui in poi è tutto registrato.', 'The red light comes on: from here on it is all recorded.'), P('Una voce fuori campo chiede il silenzio e conta fino a tre.', 'An off-camera voice asks for quiet and counts to three.'), P('Il conduttore si sistema l’auricolare e legge la prima domanda con calma.', 'The host adjusts his earpiece and reads the first question calmly.'), P('Sul monitor scorre la scritta con il tuo nome: ci siamo.', 'Your name scrolls across the monitor: here we go.')],
    q2: [P('Il giornalista gira pagina: «Mi permetta una seconda domanda, meno comoda».', 'The journalist turns the page: “Allow me a second, less comfortable question.”'), P('Qualcuno dalla regia fa cenno di stringere: il tempo è quasi finito.', 'Someone in the control room signals to wrap up: time is almost out.'), P('Un collega passa un foglietto con un dato appena arrivato.', 'A colleague passes a slip with a figure that has just come in.'), P('Il microfono ti viene avvicinato di qualche centimetro.', 'The microphone is moved a few centimetres closer to you.'), P('Il fotografo scatta due volte e poi abbassa la macchina.', 'The photographer clicks twice and then lowers the camera.')]
  },
  consiglio: {
    q1: [P('Il presidente del Consiglio chiede a tutti di restare sul punto.', 'The Prime Minister asks everyone to stay on the point.'), P('Un ministro stringe la penna e prende la parola per primo.', 'A minister grips a pen and takes the floor first.'), P('Il sottosegretario alla presidenza legge a bassa voce il capitolo di spesa.', 'The undersecretary reads the spending item in a low voice.'), P('Si sente il fruscio dei fascicoli: tutti cercano la stessa pagina.', 'The rustle of files: everyone looks for the same page.'), P('Qualcuno guarda dalla finestra: la discussione è già cominciata prima di cominciare.', 'Someone looks out of the window: the discussion started before it started.')],
    q2: [P('Un altro ministro interviene: «Prima di decidere guardiamo i numeri».', 'Another minister cuts in: “Before deciding, let us look at the figures.”'), P('Il tono sale di mezzo gradino e il presidente alza una mano.', 'The tone rises half a notch and the chair raises a hand.'), P('Dal fondo il segretario passa un appunto al presidente.', 'From the end of the table the secretary passes a note to the chair.'), P('Qualcuno beve un sorso d’acqua per prendere tempo.', 'Someone takes a sip of water to buy time.'), P('Due ministri si scambiano uno sguardo: sanno già come finirà.', 'Two ministers exchange a glance: they already know how it ends.')]
  },
  mercato: {
    q1: [P('Un uomo con la borsa della spesa si ferma e abbassa la voce: «Posso farle una domanda?».', 'A man with a shopping bag stops and lowers his voice: “Can I ask you something?”'), P('Una donna si fa largo tra i banchi: «Lei è quello della televisione?».', 'A woman pushes through the stalls: “Are you the one from the television?”'), P('Un banchista smette di pesare la frutta e ti guarda con le braccia incrociate.', 'A stallholder stops weighing fruit and looks at you with arms folded.'), P('Si forma un capannello: tutti vogliono sentire cosa rispondi.', 'A knot of people forms: everyone wants to hear what you answer.'), P('Una voce dalla panchina: «Sentite questo, che ha ragione».', 'A voice from the bench: “Listen to this one, he is right.”')],
    q2: [P('Dopo il primo, ne arriva subito un altro: qui nessuno aspetta il proprio turno.', 'After the first, another one arrives at once: nobody here waits their turn.'), P('Un passante si ferma a metà strada e torna indietro.', 'A passer-by stops halfway and comes back.'), P('Una signora ti tira per la manica: «Mi scusi, ma il mio problema è un altro».', 'A woman tugs your sleeve: “Excuse me, but my problem is a different one.”'), P('Il vociare dei banchi copre un attimo le parole: bisogna ripetere.', 'The chatter of the stalls briefly covers the words: you have to repeat.'), P('Un ragazzo registra con il telefono, un anziano scuote la testa.', 'A boy records on his phone, an old man shakes his head.')]
  }
});

// A person in the room who does not speak: the bystander reacts to what is said (a nod, a note, a clap). One of the pool by the seed of the scene; the grammar of the role fixes the gender.
export const BYSTANDERS = Object.freeze({
  associazioni: [P('Volontaria della segreteria', 'Secretariat volunteer'), P('Un pensionato del quartiere', 'A retired man of the neighbourhood'), P('Una mamma con il passeggino', 'A mother with a pushchair'), P('Il custode della sala', 'The hall caretaker'), P('Una giovane cronista del giornale locale', 'A young reporter of the local paper'), P('Un commerciante della zona', 'A local shopkeeper')],
  cantiere: [P('Il capocantiere', 'The foreman'), P('Un operaio con l’elmetto giallo', 'A worker in a yellow helmet'), P('La geometra dell’impresa', 'The contractor’s surveyor'), P('Un tecnico del Comune', 'A technician of the municipality'), P('Un ingegnere della direzione lavori', 'An engineer of the site management'), P('Un residente con il cane', 'A resident with a dog')],
  sede: [P('Il tesoriere', 'The treasurer'), P('Una volontaria dei banchetti', 'A volunteer of the stalls'), P('Il segretario di sezione', 'The branch secretary'), P('Una giovane militante', 'A young activist'), P('Uno storico iscritto', 'A long-standing member'), P('La responsabile della comunicazione', 'The communications officer')],
  commissione: [P('Un funzionario della commissione', 'A committee official'), P('La stenografa', 'The stenographer'), P('Un consulente del gruppo', 'A consultant of the group'), P('Un assistente parlamentare', 'A parliamentary assistant'), P('Una commessa d’aula', 'A usher of the chamber'), P('Un giornalista parlamentare', 'A parliamentary reporter')],
  redazione: [P('Un cameraman', 'A cameraman'), P('Una redattrice con il blocco', 'A staff writer with a notepad'), P('Il fonico', 'The sound engineer'), P('Una truccatrice', 'A make-up artist'), P('Un fotografo di agenzia', 'An agency photographer'), P('Un redattore della cronaca locale', 'A local news editor')],
  consiglio: [P('Un sottosegretario', 'An undersecretary'), P('La segretaria del Consiglio', 'The secretary of the Council'), P('Un consigliere giuridico', 'A legal adviser'), P('Un commesso di Palazzo', 'A Palazzo usher'), P('Una capo di gabinetto', 'A head of cabinet'), P('Un esperto del Tesoro', 'A Treasury expert')],
  mercato: [P('Una fruttivendola', 'A greengrocer'), P('Un anziano sulla panchina', 'An old man on the bench'), P('Una studentessa con lo zaino', 'A student with a backpack'), P('Un ambulante', 'A street vendor'), P('Una commessa in pausa', 'A shop assistant on a break'), P('Un vigile', 'A traffic warden')]
});

// What the room has around it, by activity: the pieces the room art draws behind the characters (a few small shapes: nothing that blocks the stage).
export const AMBIENCE = Object.freeze({
  folla: ['ascolto', 'associazioni', 'cittadini', 'tour-regione', 'comizio-piazza', 'incontro-sindaci', 'confronto-territori', 'associazioni-imprese', 'incontro-amministratori', 'tavolo-parti-sociali', 'progetto', 'sezione', 'tesseramento'],
  stampa: ['intervista', 'conferenza', 'talk', 'contestazione-pubblica', 'social', 'replica-polemica', 'conferenza-stampa-governo', 'incontro', 'campagna-partito'],
  cantiere: ['sopralluogo', 'ispezione-cantiere', 'verifica-strade-scuole', 'gestione-servizi', 'coordina-progetti', 'cabina-regia-opere', 'bando-europeo-territorio'],
  carte: ['audizione-commissione', 'interrogazione', 'riunione-giunta', 'controllo-delega', 'tavolo-regionale', 'proposta-alternativa', 'aula', 'dossier', 'question-time', 'corso-politiche', 'relazione-commissione-ue'],
  bilancio: ['raccolta', 'crowdfunding', 'contributo', 'formazione', 'preparazione', 'squadra', 'selezione-candidati', 'leadership', 'corrente', 'riunione', 'disciplina', 'mediazione', 'mediazione-correnti', 'dissenso', 'negoziazione-locale', 'diplomazia', 'incontro-parlamentare'],
  palazzo: ['consiglio-ministri', 'vertice-maggioranza', 'verifica-programma', 'intergruppo-europeo', 'delegazione-bruxelles']
});
export const ambienceOf = activityId => Object.entries(AMBIENCE).find(([, ids]) => ids.includes(activityId))?.[0] ?? 'carte';

// every [Italian, English] pair of the file (the phrase-book is written from it: scripts/sync-release-pairs.mjs)
const collect = value => Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(collect) : [];
export const ALL_PAIRS = Object.freeze(collect([ATMOSPHERE, LEADIN, BYSTANDERS]));
