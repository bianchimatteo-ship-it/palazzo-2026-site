// The decisions of the weekly-activity scenes, TOPIC BY TOPIC (core/activity-scenes.js). An encounter keeps its subject from the first word to the last: the first moment has the approaches of the family of
// topics (data/activity-scene-approaches.js), and the second and the third offer moves that are about THAT subject — a school gym closed for two years asks for the state of the building, the survey, the
// works by phases, the date of reopening, the school office; a late building site asks for the works diary, the supplier, the schedule — plus a few moves of the kind of encounter that fit any subject
// (data/activity-scene-moves.js, narrowed by `ONLY`). The functions are the same ones (a function has the same consequences everywhere); what changes is what the move is ABOUT.
// Also here: which policy areas a family of topics belongs to (a promise of the programme is mentioned only when it is about the subject) and the words that make a headline of the diary relevant to it.
// Every text is a pair [Italian, English] with no free part.

const P = (it, en) => [it, en];
const T = (fn, stat, it, en, when = '') => ({ fn, stat, label: P(it, en), when });

// The citizens' square and the civic hall share the seven topics of everyday life.
const SOCIETY = {
  sanita: {
    q2: [T('probe', 'charisma', 'Chiedi quali visite e quali reparti hanno le attese più lunghe', 'Ask which tests and which wards have the longest waits'), T('data', 'competence', 'Chiedi i tempi d’attesa per struttura e per priorità', 'Ask for waiting times by facility and by priority'), T('verify', 'competence', 'Proponi di visitare il poliambulatorio con il direttore sanitario', 'Offer to visit the outpatient clinic with the medical director')],
    q3: [T('propose', 'competence', 'Proponi più ore di specialistica e un richiamo automatico delle prenotazioni', 'Propose more specialist hours and an automatic recall of bookings'), T('involve', 'competence', 'Chiedi all’azienda sanitaria un piano per smaltire le liste d’attesa', 'Ask the health authority for a plan to clear the waiting lists'), T('appoint', 'charisma', 'Fissa un incontro con il direttore generale entro due settimane', 'Set a meeting with the general manager within two weeks')]
  },
  trasporti: {
    q2: [T('probe', 'charisma', 'Chiedi a chi viaggia quali corse e quali fasce orarie mancano di più', 'Ask the commuters which runs and which hours are missed the most'), T('data', 'competence', 'Chiedi i dati su passeggeri e corse soppresse', 'Ask for the figures on passengers and cancelled runs'), T('verify', 'competence', 'Proponi di fare il percorso insieme e contare i tempi', 'Offer to ride the route together and time it')],
    q3: [T('propose', 'competence', 'Proponi di ripristinare l’ultima corsa serale e due corse di punta', 'Propose restoring the last evening run and two peak-hour runs'), T('involve', 'competence', 'Convoca l’azienda di trasporto per rivedere gli orari', 'Call the transport company to review the timetable'), T('appoint', 'charisma', 'Fissa un tavolo con l’azienda per controllare le corse tra un mese', 'Set a table with the company to check the runs in a month')]
  },
  scuola: {
    q2: [T('probe', 'charisma', 'Chiedi a insegnanti e genitori che cosa manca di più: palestra, mensa o trasporto', 'Ask teachers and parents what is missing most: gym, canteen or transport'), T('data', 'competence', 'Chiedi lo stato dell’edificio, la perizia e i costi di ripristino', 'Ask for the state of the building, the survey and the cost of repairs'), T('verify', 'competence', 'Proponi un sopralluogo con il tecnico dell’edilizia scolastica', 'Offer an inspection with the school-buildings engineer'), T('involve', 'competence', 'Chiedi all’ufficio scuola di spiegare dove si è fermata la pratica', 'Ask the school office to explain where the file got stuck')],
    q3: [T('propose', 'competence', 'Proponi i lavori per fasi, con una data di riapertura della palestra', 'Propose the works in phases, with a date for reopening the gym'), T('involve', 'competence', 'Chiedi all’ufficio tecnico e al dirigente un piano di messa in sicurezza', 'Ask the technical office and the head teacher for a safety plan'), T('appoint', 'charisma', 'Fissa un incontro con genitori e ufficio scuola sulle date di riapertura', 'Set a meeting with parents and the school office on the reopening dates'), T('own', 'reputation', 'Di’ di chi sono le responsabilità del ritardo e che cosa farai tu', 'Say who is responsible for the delay and what you will do')]
  },
  casa: {
    q2: [T('probe', 'charisma', 'Chiedi quante famiglie sono in graduatoria e da quanto tempo', 'Ask how many families are on the list and for how long'), T('data', 'competence', 'Chiedi quanti alloggi popolari sono sfitti e perché', 'Ask how many public homes stand empty and why'), T('verify', 'competence', 'Proponi un censimento degli alloggi pubblici vuoti', 'Propose a census of the empty public homes')],
    q3: [T('propose', 'competence', 'Proponi di riassegnare gli alloggi sfitti con un bando entro l’anno', 'Propose reassigning the empty homes through a call within the year'), T('involve', 'competence', 'Chiedi all’ente per la casa un piano di ristrutturazione degli alloggi', 'Ask the housing body for a plan to renovate the homes'), T('fund', 'competence', 'Destina un fondo di sostegno all’affitto alle famiglie in graduatoria', 'Set aside a rent-support fund for the families on the list', 'funds govern')]
  },
  sicurezza: {
    q2: [T('probe', 'charisma', 'Chiedi in quali vie e a che ora ci si sente meno sicuri', 'Ask in which streets and at what time people feel least safe'), T('data', 'competence', 'Chiedi i dati su furti, segnalazioni e interventi della polizia locale', 'Ask for the figures on thefts, reports and local police calls'), T('verify', 'competence', 'Proponi una passeggiata serale nel quartiere con le forze dell’ordine', 'Offer an evening walk in the neighbourhood with the police')],
    q3: [T('propose', 'competence', 'Proponi più illuminazione e più presenza nelle ore serali', 'Propose more lighting and more patrols in the evening'), T('involve', 'competence', 'Chiedi alla polizia locale un presidio concordato con il quartiere', 'Ask the local police for a patrol agreed with the neighbourhood'), T('appoint', 'charisma', 'Fissa un tavolo sulla sicurezza con prefettura e residenti', 'Set a table on safety with the prefecture and residents')]
  },
  ambiente: {
    q2: [T('probe', 'charisma', 'Chiedi da quando si sentono l’odore e i disagi, e dove', 'Ask since when the smell and the nuisance have been felt, and where'), T('data', 'competence', 'Chiedi le analisi dell’agenzia ambientale e i dati sulla differenziata', 'Ask for the environmental agency’s tests and the recycling figures'), T('verify', 'competence', 'Proponi un sopralluogo lungo il rio con i tecnici ambientali', 'Offer an inspection along the stream with the environmental technicians')],
    q3: [T('propose', 'competence', 'Proponi la pulizia del rio e più passaggi della raccolta', 'Propose cleaning the stream and more waste collections'), T('involve', 'competence', 'Chiedi al gestore dei rifiuti un piano di servizio e di controlli', 'Ask the waste operator for a service and inspection plan'), T('appoint', 'charisma', 'Fissa un monitoraggio mensile insieme al comitato', 'Set monthly monitoring together with the committee')]
  },
  lavoro: {
    q2: [T('probe', 'charisma', 'Chiedi quali turni e quali reparti sono a rischio e da quando', 'Ask which shifts and which departments are at risk, and since when'), T('data', 'competence', 'Chiedi i dati su occupazione, cassa integrazione e negozi chiusi', 'Ask for the figures on jobs, furlough and shops closed'), T('verify', 'competence', 'Proponi un incontro con l’azienda e i sindacati per capire i piani', 'Offer a meeting with the company and the unions to understand the plans')],
    q3: [T('propose', 'competence', 'Proponi incentivi alle assunzioni e alle botteghe del centro', 'Propose incentives for hiring and for the shops in the centre'), T('involve', 'competence', 'Convoca azienda, sindacati e Regione a un tavolo sul lavoro', 'Call the company, the unions and the Region to a table on jobs'), T('fund', 'competence', 'Concorda un fondo per la formazione dei lavoratori a rischio', 'Agree a fund to retrain the workers at risk', 'funds govern')]
  }
};

export const TOPIC_MOVES = Object.freeze({
  societa: SOCIETY,
  cantiere: {
    ritardi: {
      q2: [T('data', 'competence', 'Chiedi il diario dei lavori e le cause di ogni sospensione', 'Ask for the works diary and the cause of each stoppage'), T('probe', 'charisma', 'Chiedi al fornitore quando consegna e che cosa lo blocca', 'Ask the supplier when it delivers and what is holding it up'), T('verify', 'competence', 'Verifica sul posto quali lavorazioni sono ferme', 'Check on site which works are stopped')],
      q3: [T('propose', 'competence', 'Fai rifare il cronoprogramma con date vincolanti per i lavori critici', 'Have the schedule redone with binding dates for the critical works'), T('appoint', 'charisma', 'Fissa un nuovo sopralluogo tra due settimane con l’impresa', 'Set a new inspection in two weeks with the contractor'), T('involve', 'competence', 'Convoca fornitore e impresa per anticipare le consegne', 'Call the supplier and the contractor to bring deliveries forward')]
    },
    sicurezza: {
      q2: [T('verify', 'competence', 'Verifica imbracature, ponteggi e piano di sicurezza', 'Check harnesses, scaffolding and the safety plan'), T('probe', 'charisma', 'Chiedi agli operai che cosa li mette più a rischio', 'Ask the workers what puts them most at risk'), T('data', 'competence', 'Chiedi il registro dei controlli e dei quasi-incidenti', 'Ask for the log of inspections and near misses')],
      q3: [T('propose', 'competence', 'Pretendi un piano di sicurezza rafforzato prima di riprendere i lavori', 'Demand a reinforced safety plan before work resumes'), T('involve', 'competence', 'Convoca il coordinatore della sicurezza e l’impresa', 'Call the safety coordinator and the contractor'), T('clarify', 'reputation', 'Metti a verbale chi risponde della sicurezza in cantiere', 'Put on record who is answerable for safety on site')]
    },
    costi: {
      q2: [T('data', 'competence', 'Chiedi la contabilità dei lavori e la revisione prezzi', 'Ask for the works accounts and the price revision'), T('probe', 'charisma', 'Chiedi all’impresa quali voci sono aumentate e perché', 'Ask the contractor which items have gone up and why'), T('verify', 'competence', 'Chiedi un computo metrico indipendente', 'Ask for an independent bill of quantities')],
      q3: [T('propose', 'competence', 'Proponi una variante che contenga la spesa senza tagliare la qualità', 'Propose a variant that contains the cost without cutting quality'), T('fund', 'competence', 'Autorizza un’integrazione di spesa per sbloccare l’opera', 'Authorise extra spending to unblock the work', 'funds govern'), T('compromise', 'charisma', 'Concorda con l’impresa una revisione prezzi parziale', 'Agree a partial price revision with the contractor')]
    },
    viabilita: {
      q2: [T('probe', 'charisma', 'Chiedi ai negozianti quali giorni e quali orari pesano di più', 'Ask the shopkeepers which days and hours weigh most'), T('data', 'competence', 'Chiedi i dati su traffico, incassi persi e deviazioni', 'Ask for the figures on traffic, lost takings and diversions'), T('verify', 'competence', 'Verifica i percorsi alternativi e i parcheggi', 'Check the alternative routes and the parking')],
      q3: [T('propose', 'competence', 'Proponi la riapertura a tratti con lavorazioni notturne', 'Propose reopening in stretches with night work'), T('appoint', 'charisma', 'Concorda con i negozianti un calendario delle chiusure', 'Agree a calendar of closures with the shopkeepers'), T('fund', 'competence', 'Prevedi un ristoro per le attività più colpite', 'Provide compensation for the hardest-hit businesses', 'funds govern')]
    },
    materiali: {
      q2: [T('data', 'competence', 'Chiedi i certificati e le prove sui lotti di materiale', 'Ask for the certificates and tests on the material batches'), T('verify', 'competence', 'Fai ripetere le prove di laboratorio sul lotto contestato', 'Have the lab tests repeated on the disputed batch'), T('probe', 'charisma', 'Chiedi ai tecnici come si è arrivati al lotto difettoso', 'Ask the technicians how the faulty batch came about')],
      q3: [T('propose', 'competence', 'Pretendi la sostituzione del lotto a spese dell’impresa', 'Demand the batch be replaced at the contractor’s expense'), T('appoint', 'charisma', 'Fissa il controllo di un laboratorio indipendente', 'Set the check by an independent laboratory'), T('clarify', 'reputation', 'Metti a verbale la responsabilità della fornitura', 'Put on record who is responsible for the supply')]
    },
    residenti: {
      q2: [T('probe', 'charisma', 'Chiedi ai residenti a che ora il rumore pesa di più', 'Ask the residents when the noise weighs most'), T('data', 'competence', 'Chiedi le misure di rumore e di polveri', 'Ask for the noise and dust measurements'), T('verify', 'competence', 'Proponi di misurare insieme ai residenti in orario di lavorazione', 'Offer to measure together with residents during working hours')],
      q3: [T('propose', 'competence', 'Proponi di spostare le lavorazioni rumorose in orari concordati', 'Propose moving the noisy work to agreed hours'), T('appoint', 'charisma', 'Fissa un incontro mensile con il comitato dei residenti', 'Set a monthly meeting with the residents’ committee'), T('involve', 'competence', 'Chiedi all’impresa barriere antirumore e pulizia delle strade', 'Ask the contractor for noise barriers and street cleaning')]
    },
    collaudo: {
      q2: [T('data', 'competence', 'Chiedi il programma delle prove e chi le firma', 'Ask for the test programme and who signs it'), T('verify', 'competence', 'Chiedi i verbali dei collaudi parziali', 'Ask for the minutes of the partial tests'), T('probe', 'charisma', 'Chiedi ai tecnici che cosa manca ancora per l’apertura', 'Ask the technicians what is still missing for opening')],
      q3: [T('propose', 'competence', 'Proponi un’apertura parziale dei tratti già collaudati', 'Propose a partial opening of the stretches already tested'), T('appoint', 'charisma', 'Fissa la data del collaudo finale con tutti i firmatari', 'Set the date of the final test with all the signatories'), T('clarify', 'reputation', 'Dichiara che non si apre prima del collaudo', 'State that nothing opens before the final test')]
    }
  },
  sede: {
    tesseramento: {
      q2: [T('data', 'competence', 'Mostra le iscrizioni sezione per sezione', 'Show the memberships branch by branch'), T('probe', 'charisma', 'Chiedi ai segretari perché i nuovi iscritti non restano', 'Ask the secretaries why new members do not stay'), T('verify', 'competence', 'Chiedi la verifica delle tessere contestate', 'Ask for the contested cards to be checked')],
      q3: [T('propose', 'competence', 'Proponi una campagna di tesseramento con banchetti nei quartieri', 'Propose a membership drive with stalls in the neighbourhoods'), T('vote', 'charisma', 'Metti ai voti le regole sulle tessere: pagamento e verifica', 'Put the card rules to the vote: payment and checks'), T('assign', 'competence', 'Affida a ogni sezione un obiettivo di nuovi iscritti', 'Give each branch a target of new members')]
    },
    candidature: {
      q2: [T('mediate', 'charisma', 'Metti allo stesso tavolo le aree che chiedono un candidato', 'Put the areas that each want a candidate at the same table'), T('data', 'competence', 'Mostra i sondaggi sui possibili candidati', 'Show the polls on the possible candidates'), T('listen', 'charisma', 'Fai parlare i segretari dei territori interessati', 'Let the secretaries of the territories concerned speak')],
      q3: [T('vote', 'charisma', 'Metti ai voti la rosa dei candidati', 'Put the shortlist of candidates to the vote'), T('compromise', 'competence', 'Dividi i collegi tra le aree con un criterio condiviso', 'Divide the constituencies among the areas by a shared criterion'), T('assign', 'competence', 'Affida la scelta a una commissione di garanzia', 'Hand the choice to a guarantee committee')]
    },
    linea: {
      q2: [T('clarify', 'reputation', 'Ricorda che cosa dice il programma approvato', 'Recall what the approved programme says'), T('contest', 'reputation', 'Contesta chi ha preso posizione contro la linea sui giornali', 'Challenge whoever took a stand against the line in the papers'), T('mediate', 'charisma', 'Cerca una formula che tenga insieme le correnti', 'Look for a formula that keeps the currents together')],
      q3: [T('vote', 'charisma', 'Metti ai voti la linea del partito', 'Put the party line to the vote'), T('priority', 'reputation', 'Cambia le priorità: prima i punti su cui c’è accordo', 'Change the priorities: the points of agreement first'), T('own', 'reputation', 'Prenditi la responsabilità della linea davanti a tutti', 'Take responsibility for the line in front of everyone')]
    },
    soldi: {
      q2: [T('data', 'competence', 'Mostra entrate, uscite e debiti della tesoreria', 'Show the treasury’s income, spending and debts'), T('probe', 'charisma', 'Chiedi alle sezioni che cosa non riescono a pagare', 'Ask the branches what they cannot pay for'), T('verify', 'competence', 'Chiedi un controllo dei conti da parte del tesoriere', 'Ask the treasurer to check the accounts')],
      q3: [T('propose', 'competence', 'Proponi un piano di contribuzione e di taglio dei costi', 'Propose a plan of contributions and cost cuts'), T('vote', 'charisma', 'Metti ai voti il bilancio della tesoreria', 'Put the treasury budget to the vote'), T('priority', 'reputation', 'Cambia le priorità di spesa: prima le sezioni in difficoltà', 'Change the spending priorities: the struggling branches first')]
    },
    alleanze: {
      q2: [T('probe', 'charisma', 'Chiedi alle correnti con chi sono disposte ad allearsi e a quali condizioni', 'Ask the currents whom they would ally with, and on what terms'), T('data', 'competence', 'Mostra quanto valgono i possibili alleati nei sondaggi', 'Show what the possible allies are worth in the polls'), T('mediate', 'charisma', 'Cerca un punto d’incontro tra chi vuole e chi rifiuta l’alleanza', 'Look for a meeting point between those for and against the alliance')],
      q3: [T('compromise', 'competence', 'Proponi un’alleanza limitata ai collegi decisivi', 'Propose an alliance limited to the decisive constituencies'), T('vote', 'charisma', 'Metti ai voti il mandato a trattare', 'Put the mandate to negotiate to the vote'), T('appoint', 'competence', 'Convoca gli alleati a un tavolo entro due settimane', 'Call the allies to a table within two weeks')]
    },
    territorio: {
      q2: [T('listen', 'charisma', 'Fai parlare i segretari regionali sui problemi dei territori', 'Let the regional secretaries speak about the problems of the territories'), T('data', 'competence', 'Mostra voti e iscritti per provincia', 'Show votes and members by province'), T('probe', 'charisma', 'Chiedi dove il partito non ha più una sede', 'Ask where the party no longer has a branch')],
      q3: [T('propose', 'competence', 'Proponi la riapertura delle sedi più deboli', 'Propose reopening the weakest branches'), T('assign', 'competence', 'Affida a un dirigente ogni territorio in difficoltà', 'Give each struggling territory to a senior member'), T('priority', 'reputation', 'Cambia le priorità: risorse alle zone dove si perde di più', 'Change the priorities: resources to where we lose most')]
    },
    comunicazione: {
      q2: [T('data', 'competence', 'Mostra l’andamento di contatti e social', 'Show the trend of contacts and social media'), T('clarify', 'reputation', 'Chiarisci chi parla a nome del partito e su che cosa', 'Make clear who speaks for the party and on what'), T('contest', 'reputation', 'Contesta le dichiarazioni fuori linea dei dirigenti', 'Challenge the off-line statements of the leaders')],
      q3: [T('propose', 'competence', 'Proponi un piano di comunicazione con messaggi comuni', 'Propose a communication plan with common messages'), T('assign', 'competence', 'Affida un portavoce a ogni tema', 'Give each subject a spokesperson'), T('vote', 'charisma', 'Metti ai voti le regole sulle dichiarazioni pubbliche', 'Put the rules on public statements to the vote')]
    }
  },
  commissione: {
    sanita: {
      q2: [T('probe', 'competence', 'Ascolta medici e direttori sanitari sulle liste d’attesa', 'Hear doctors and health managers on the waiting lists'), T('data', 'competence', 'Chiedi al ministero i tempi d’attesa per regione', 'Ask the ministry for waiting times by region'), T('verify', 'competence', 'Chiedi una relazione tecnica sul costo del recupero delle prestazioni', 'Ask for a technical report on the cost of recovering the backlog')],
      q3: [T('propose', 'competence', 'Presenta un emendamento sul recupero delle prestazioni, con la copertura', 'Table an amendment on recovering the backlog, with the funding'), T('compromise', 'charisma', 'Ritira l’emendamento in cambio di un ordine del giorno sulle assunzioni', 'Withdraw the amendment in exchange for a resolution on hiring'), T('appoint', 'competence', 'Chiedi un’audizione del ministro della Salute', 'Ask for a hearing of the Health Minister')]
    },
    lavoro: {
      q2: [T('probe', 'competence', 'Ascolta sindacati e imprese su salari e contratti', 'Hear unions and firms on wages and contracts'), T('data', 'competence', 'Chiedi i dati su occupazione e contratti per settore', 'Ask for figures on jobs and contracts by sector'), T('verify', 'competence', 'Chiedi la relazione tecnica sul costo degli incentivi', 'Ask for the technical report on the cost of the incentives')],
      q3: [T('propose', 'competence', 'Presenta un emendamento sugli incentivi alle assunzioni stabili', 'Table an amendment on incentives for permanent hiring'), T('vote', 'charisma', 'Chiedi il voto per parti separate sul salario minimo', 'Ask for a vote in separate parts on the minimum wage'), T('appoint', 'competence', 'Chiedi un’audizione delle parti sociali', 'Ask for a hearing of the social partners')]
    },
    ambiente: {
      q2: [T('probe', 'competence', 'Ascolta gli esperti su rischio idrogeologico e rifiuti', 'Hear the experts on landslide risk and waste'), T('data', 'competence', 'Chiedi i dati dell’agenzia ambientale', 'Ask for the environmental agency’s data'), T('verify', 'competence', 'Chiedi una relazione tecnica sui costi della bonifica', 'Ask for a technical report on the cost of the clean-up')],
      q3: [T('propose', 'competence', 'Presenta un emendamento per finanziare la bonifica', 'Table an amendment to fund the clean-up'), T('compromise', 'charisma', 'Ritira l’emendamento in cambio di un impegno sui fondi di bonifica', 'Withdraw the amendment in exchange for a pledge on clean-up funds'), T('announce', 'charisma', 'Annuncia che porterai la bonifica in aula', 'Announce that you will take the clean-up to the floor')]
    },
    scuola: {
      q2: [T('probe', 'competence', 'Ascolta dirigenti e insegnanti su organici ed edifici', 'Hear head teachers and teachers on staffing and buildings'), T('data', 'competence', 'Chiedi i dati su edifici a norma e classi sovraffollate', 'Ask for figures on compliant buildings and overcrowded classes'), T('verify', 'competence', 'Chiedi la relazione tecnica sul piano di edilizia scolastica', 'Ask for the technical report on the school-building plan')],
      q3: [T('propose', 'competence', 'Presenta un emendamento sull’edilizia scolastica, con la copertura', 'Table an amendment on school buildings, with the funding'), T('vote', 'charisma', 'Chiedi di votare per parti separate organici ed edifici', 'Ask for separate votes on staffing and buildings'), T('appoint', 'competence', 'Chiedi un’audizione del ministro dell’Istruzione', 'Ask for a hearing of the Education Minister')]
    },
    giustizia: {
      q2: [T('probe', 'competence', 'Ascolta magistrati e avvocati sui tempi dei processi', 'Hear magistrates and lawyers on the length of trials'), T('data', 'competence', 'Chiedi i dati sull’arretrato e sulla durata dei procedimenti', 'Ask for figures on the backlog and the length of proceedings'), T('verify', 'competence', 'Chiedi la relazione tecnica sull’organico dei tribunali', 'Ask for the technical report on court staffing')],
      q3: [T('propose', 'competence', 'Presenta un emendamento per assumere personale amministrativo', 'Table an amendment to hire administrative staff'), T('compromise', 'charisma', 'Ritira l’emendamento in cambio di un ordine del giorno sui tempi', 'Withdraw the amendment in exchange for a resolution on timing'), T('appoint', 'competence', 'Chiedi un’audizione del Consiglio superiore', 'Ask for a hearing of the Superior Council')]
    },
    fisco: {
      q2: [T('probe', 'competence', 'Ascolta commercialisti e categorie sulle aliquote', 'Hear accountants and trade bodies on the rates'), T('data', 'competence', 'Chiedi la stima del gettito e dei contribuenti coinvolti', 'Ask for the estimate of revenue and taxpayers affected'), T('verify', 'competence', 'Chiedi alla Ragioneria la relazione tecnica sulle coperture', 'Ask the State Accounting Office for the technical report on the funding')],
      q3: [T('propose', 'competence', 'Presenta un emendamento sull’aliquota, con la copertura', 'Table an amendment on the rate, with the funding'), T('vote', 'charisma', 'Chiedi il voto per parti separate sulle due aliquote', 'Ask for a vote in separate parts on the two rates'), T('compromise', 'charisma', 'Ritira l’emendamento in cambio di un impegno nella manovra', 'Withdraw the amendment in exchange for a pledge in the budget')]
    },
    digitale: {
      q2: [T('probe', 'competence', 'Ascolta esperti di sicurezza informatica e imprese del settore', 'Hear cybersecurity experts and firms in the sector'), T('data', 'competence', 'Chiedi i dati su infrastrutture e servizi digitali della PA', 'Ask for figures on public-administration digital infrastructure and services'), T('verify', 'competence', 'Chiedi la relazione tecnica sui costi dei servizi', 'Ask for the technical report on the cost of the services')],
      q3: [T('propose', 'competence', 'Presenta un emendamento sul fondo per i servizi digitali', 'Table an amendment on the digital services fund'), T('announce', 'charisma', 'Annuncia che chiederai l’esame in aula', 'Announce that you will ask for it to go to the floor'), T('appoint', 'competence', 'Chiedi un’audizione dell’agenzia per l’Italia digitale', 'Ask for a hearing of the digital agency')]
    }
  },
  redazione: {
    promesse: {
      q2: [T('data', 'competence', 'Elenca le promesse mantenute, con i numeri', 'List the promises kept, with the figures'), T('own', 'reputation', 'Ammetti quali promesse non sono state mantenute e perché', 'Admit which promises were not kept and why'), T('clarify', 'reputation', 'Distingui le promesse in corso da quelle ancora da fare', 'Distinguish the promises under way from those still to come')],
      q3: [T('announce', 'charisma', 'Annuncia una data per la promessa più attesa', 'Announce a date for the most awaited promise'), T('propose', 'charisma', 'Proponi di rendere pubblico ogni mese lo stato delle promesse', 'Propose publishing the state of the promises every month'), T('clarify', 'reputation', 'Dichiara che cosa non puoi promettere', 'State what you cannot promise')]
    },
    conti: {
      q2: [T('data', 'competence', 'Spiega le coperture con tre cifre verificabili', 'Explain the funding with three checkable figures'), T('clarify', 'reputation', 'Chiarisci dove si taglia e dove si spende', 'Make clear where you cut and where you spend'), T('contest', 'reputation', 'Contesta il calcolo del giornalista sul costo della misura', 'Challenge the journalist’s calculation of the measure’s cost')],
      q3: [T('propose', 'competence', 'Proponi di pubblicare i conti con le coperture', 'Propose publishing the accounts with the funding'), T('announce', 'charisma', 'Annuncia un intervento con la sua copertura', 'Announce an intervention with its funding'), T('own', 'reputation', 'Ammetti il limite dei conti e indica come rientrare', 'Admit the limit of the accounts and say how to recover')]
    },
    alleanze: {
      q2: [T('clarify', 'reputation', 'Chiarisci con chi governi e con chi no', 'Make clear whom you govern with and whom not'), T('contest', 'reputation', 'Contesta la lettura di un’alleanza come tradimento', 'Challenge the reading of an alliance as betrayal'), T('data', 'competence', 'Mostra i voti comuni con i possibili alleati', 'Show the votes in common with the possible allies')],
      q3: [T('propose', 'competence', 'Proponi un accordo programmatico pubblico con gli alleati', 'Propose a public programme agreement with the allies'), T('clarify', 'reputation', 'Dichiara le condizioni che non negozierai', 'State the conditions you will not negotiate'), T('announce', 'charisma', 'Annuncia un incontro con gli alleati', 'Announce a meeting with the allies')]
    },
    partito: {
      q2: [T('clarify', 'reputation', 'Chiarisci la tua posizione rispetto alla linea del partito', 'Clarify your position on the party line'), T('own', 'reputation', 'Ammetti una divergenza interna e come la risolvi', 'Admit an internal disagreement and how you settle it'), T('contest', 'reputation', 'Contesta la ricostruzione di uno scontro tra correnti', 'Challenge the account of a clash between currents')],
      q3: [T('propose', 'charisma', 'Proponi un confronto interno aperto sulla linea', 'Propose an open internal debate on the line'), T('announce', 'charisma', 'Annuncia come si decide nel partito', 'Announce how decisions are taken in the party'), T('clarify', 'reputation', 'Distingui il tuo parere dalla linea ufficiale', 'Distinguish your own view from the official line')]
    },
    polemica: {
      q2: [T('clarify', 'reputation', 'Chiarisci la frase portata fuori contesto', 'Clarify the sentence taken out of context'), T('contest', 'reputation', 'Contesta la ricostruzione della polemica, prove alla mano', 'Challenge the account of the row, with evidence in hand'), T('own', 'reputation', 'Chiedi scusa per il tono, non per il merito', 'Apologise for the tone, not for the substance')],
      q3: [T('own', 'reputation', 'Assumi la responsabilità di quanto detto', 'Take responsibility for what was said'), T('contest', 'competence', 'Chiudi respingendo l’accusa con le prove', 'Close by rejecting the charge with evidence'), T('propose', 'charisma', 'Proponi un confronto pubblico sul tema', 'Propose a public debate on the subject')]
    },
    territorio: {
      q2: [T('story', 'charisma', 'Racconta un caso che hai visto nel tuo territorio', 'Tell a case you saw in your territory'), T('data', 'competence', 'Cita i dati sul tuo territorio: lavoro, servizi, trasporti', 'Quote the figures for your territory: jobs, services, transport'), T('clarify', 'reputation', 'Chiarisci che cosa cambia per chi vive lì', 'Make clear what changes for those who live there')],
      q3: [T('announce', 'charisma', 'Annuncia un intervento per il tuo territorio con una data', 'Announce an intervention for your territory with a date'), T('propose', 'charisma', 'Proponi un patto con i sindaci del territorio', 'Propose a pact with the mayors of the territory'), T('own', 'reputation', 'Ammetti i ritardi sul territorio e come li recuperi', 'Admit the delays in the territory and how you will recover them')]
    },
    sondaggi: {
      q2: [T('data', 'competence', 'Leggi il sondaggio con il suo margine d’errore', 'Read the poll with its margin of error'), T('clarify', 'reputation', 'Spiega perché non si governa sui sondaggi', 'Explain why one does not govern by polls'), T('story', 'charisma', 'Racconta che cosa senti parlando con le persone', 'Tell what you hear when you talk to people')],
      q3: [T('announce', 'charisma', 'Annuncia come userai il consenso: per fare, non per misurare', 'Announce how you will use support: to act, not to measure'), T('own', 'reputation', 'Ammetti il calo e indica come reagire', 'Admit the drop and say how to react'), T('propose', 'competence', 'Proponi di confrontare i dati di più istituti', 'Propose comparing the data of several pollsters')]
    }
  },
  consiglio: {
    decreto: {
      q2: [T('verify', 'competence', 'Chiedi la relazione tecnica sui requisiti d’urgenza', 'Ask for the technical report on the urgency requirements'), T('mediate', 'charisma', 'Cerca la sintesi tra i ministri sul testo del decreto', 'Seek a synthesis among the ministers on the text of the decree'), T('probe', 'charisma', 'Ascolta il ministro proponente sulle misure', 'Hear the proposing minister on the measures')],
      q3: [T('vote', 'charisma', 'Metti ai voti il decreto', 'Put the decree to the vote'), T('compromise', 'competence', 'Approva una versione ridotta ora e il resto con un disegno di legge', 'Approve a reduced version now and the rest by a bill'), T('appoint', 'competence', 'Riconvoca il consiglio dopo il parere del Quirinale', 'Call the council again after the opinion of the Quirinale')]
    },
    manovra: {
      q2: [T('verify', 'competence', 'Chiedi alla Ragioneria la relazione sulle coperture', 'Ask the State Accounting Office for the report on the funding'), T('mediate', 'charisma', 'Cerca la sintesi tra le richieste dei ministeri', 'Seek a synthesis among the ministries’ requests'), T('data', 'competence', 'Chiedi il quadro delle entrate e dei saldi', 'Ask for the picture of revenue and balances')],
      q3: [T('priority', 'reputation', 'Cambia l’ordine delle priorità di spesa', 'Change the order of the spending priorities'), T('vote', 'charisma', 'Metti ai voti il quadro della manovra', 'Put the framework of the budget to the vote'), T('compromise', 'competence', 'Approva ora i tetti di spesa e i dettagli più avanti', 'Approve the spending ceilings now and the details later')]
    },
    nomine: {
      q2: [T('probe', 'charisma', 'Ascolta i ministri sui profili proposti', 'Hear the ministers on the proposed profiles'), T('clarify', 'reputation', 'Ricorda i criteri di competenza e di incompatibilità', 'Recall the criteria of competence and incompatibility'), T('mediate', 'charisma', 'Cerca un equilibrio tra le richieste dei partiti', 'Seek a balance among the parties’ requests')],
      q3: [T('vote', 'charisma', 'Metti ai voti la lista delle nomine', 'Put the list of appointments to the vote'), T('assign', 'competence', 'Affida l’istruttoria a un sottosegretario', 'Give the preparation to an under-secretary'), T('appoint', 'competence', 'Rinvia le nomine alla prossima riunione, con i curricula', 'Postpone the appointments to the next meeting, with the CVs')]
    },
    emergenza: {
      q2: [T('probe', 'charisma', 'Ascolta la Protezione civile sulla situazione', 'Hear Civil Protection on the situation'), T('data', 'competence', 'Chiedi i dati sui danni e sulle risorse disponibili', 'Ask for the figures on damage and available resources'), T('verify', 'competence', 'Chiedi un sopralluogo tecnico nelle zone colpite', 'Ask for a technical inspection of the areas hit')],
      q3: [T('priority', 'reputation', 'Cambia l’ordine del giorno: prima l’emergenza', 'Change the agenda: the emergency first'), T('announce', 'charisma', 'Annuncia lo stato di emergenza in conferenza stampa', 'Announce the state of emergency at a press conference'), T('assign', 'competence', 'Affida il coordinamento a un commissario', 'Give the coordination to a commissioner')]
    },
    europa: {
      q2: [T('probe', 'charisma', 'Ascolta il ministro per gli Affari europei sui negoziati', 'Hear the European Affairs minister on the negotiations'), T('data', 'competence', 'Chiedi il calendario e le scadenze europee', 'Ask for the European calendar and deadlines'), T('clarify', 'reputation', 'Ricorda la posizione del governo su questo dossier', 'Recall the government’s position on this dossier')],
      q3: [T('vote', 'charisma', 'Metti ai voti il mandato per il Consiglio europeo', 'Put the mandate for the European Council to the vote'), T('compromise', 'competence', 'Approva una linea flessibile con due condizioni', 'Approve a flexible line with two conditions'), T('appoint', 'competence', 'Riconvoca il consiglio prima del vertice', 'Call the council again before the summit')]
    },
    riforma: {
      q2: [T('probe', 'charisma', 'Ascolta il ministro sul testo della riforma', 'Hear the minister on the text of the reform'), T('mediate', 'charisma', 'Cerca la sintesi tra i ministri sui punti controversi', 'Seek a synthesis among the ministers on the disputed points'), T('data', 'competence', 'Chiedi la valutazione d’impatto', 'Ask for the impact assessment')],
      q3: [T('vote', 'charisma', 'Metti ai voti il disegno di legge di riforma', 'Put the reform bill to the vote'), T('compromise', 'competence', 'Approva il testo base e rinvia i punti controversi', 'Approve the base text and postpone the disputed points'), T('assign', 'competence', 'Affida l’istruttoria a un ministro e il seguito a un sottosegretario', 'Give the preparation to a minister and the follow-up to an under-secretary')]
    },
    opere: {
      q2: [T('verify', 'competence', 'Chiedi lo stato dei cantieri e dei fondi', 'Ask for the state of the sites and of the funds'), T('data', 'competence', 'Chiedi il costo e i tempi di ogni opera', 'Ask for the cost and timing of each work'), T('probe', 'charisma', 'Ascolta il ministro delle Infrastrutture', 'Hear the Infrastructure minister')],
      q3: [T('priority', 'reputation', 'Cambia le priorità: prima le opere già finanziate', 'Change the priorities: the works already funded first'), T('vote', 'charisma', 'Metti ai voti il piano delle opere', 'Put the works plan to the vote'), T('announce', 'charisma', 'Annuncia l’avvio delle opere in conferenza stampa', 'Announce the start of the works at a press conference')]
    }
  }
});
// Which catalogue a kind of encounter uses.
export const TOPIC_KIND = Object.freeze({ cittadini: 'societa', associazioni: 'societa', cantiere: 'cantiere', sede: 'sede', commissione: 'commissione', redazione: 'redazione', consiglio: 'consiglio' });

// The moves of the kind of encounter that are bound to a subject: they appear only in the topics listed (the others fit any subject).
export const ONLY = Object.freeze({
  'w-sicurezza': ['sicurezza'], 'w-registro': ['costi', 'ritardi', 'collaudo'], 'w-impresa': ['ritardi', 'costi', 'materiali', 'collaudo'], 'w-operai': ['ritardi', 'sicurezza', 'residenti'], 'w-ritardi': ['ritardi', 'viabilita'],
  'w-crono': ['ritardi', 'viabilita', 'collaudo'], 'w-carte': ['costi', 'materiali', 'collaudo', 'sicurezza'], 'w-spesa': ['costi', 'ritardi', 'viabilita', 'sicurezza'], 'w-data': ['ritardi', 'viabilita', 'collaudo'], 'w-pazienza': ['ritardi', 'viabilita', 'residenti'],
  'p-correnti': ['candidature', 'linea', 'alleanze'], 'p-testo': ['linea', 'alleanze', 'candidature'], 'p-voti': ['tesseramento', 'territorio', 'candidature'], 'p-polemica': ['linea', 'comunicazione'], 'p-segretari': ['tesseramento', 'territorio', 'soldi'],
  'p-statuto': ['tesseramento', 'candidature', 'linea'], 'p-odg': ['linea', 'alleanze', 'comunicazione', 'candidature'], 'p-linea': ['linea', 'comunicazione', 'alleanze'],
  'm-relazione': ['sanita', 'lavoro', 'fisco', 'scuola', 'ambiente', 'digitale'],
  'r-numeri': ['conti', 'territorio', 'sondaggi', 'promesse'], 'r-posizione': ['partito', 'alleanze', 'polemica'], 'r-errore': ['promesse', 'polemica', 'conti'], 'r-caso': ['territorio', 'promesse'], 'r-annuncio': ['promesse', 'conti', 'territorio'],
  'r-colpa': ['polemica', 'promesse', 'partito'], 'r-distingui': ['promesse', 'conti'], 'r-prove': ['polemica', 'conti'],
  'g-coperture': ['manovra', 'decreto', 'opere', 'riforma'], 'g-ritardo': ['opere', 'riforma', 'decreto'], 'g-decreto': ['decreto', 'riforma'], 'g-istruttoria': ['nomine', 'riforma', 'europa'], 'g-ordine': ['emergenza', 'manovra', 'opere'],
  'g-ridotta': ['decreto', 'manovra', 'riforma'], 'g-conferenza': ['emergenza', 'opere', 'europa', 'decreto']
});

// The policy areas each family of topics is about: a promise of the programme is mentioned in an encounter only when its area is one of these (a promise on schools is not quoted at a meeting about waiting lists).
const SOCIETY_AREAS = { sanita: ['sanita', 'welfare'], trasporti: ['trasporti', 'infrastrutture'], scuola: ['scuola', 'universita', 'giovani'], casa: ['casa', 'famiglia'], sicurezza: ['sicurezza'], ambiente: ['ambiente', 'energia', 'agricoltura'], lavoro: ['lavoro', 'industria', 'commercio', 'economia'] };
const AREAS = {
  societa: SOCIETY_AREAS,
  cantiere: Object.fromEntries(['ritardi', 'sicurezza', 'costi', 'viabilita', 'materiali', 'residenti', 'collaudo'].map(id => [id, ['infrastrutture', 'trasporti', 'ambiente']])),
  sede: { territorio: ['autonomie', 'mezzogiorno'], soldi: ['finanze'] },
  commissione: { sanita: ['sanita'], lavoro: ['lavoro'], ambiente: ['ambiente', 'energia'], scuola: ['scuola', 'universita'], giustizia: ['giustizia'], fisco: ['fisco', 'finanze'], digitale: ['digitale', 'pa'] },
  redazione: { promesse: ['*'], conti: ['finanze', 'fisco', 'economia'], territorio: ['autonomie', 'mezzogiorno'] },
  consiglio: { decreto: ['*'], manovra: ['finanze', 'fisco', 'economia'], emergenza: ['sicurezza', 'sanita', 'ambiente'], europa: ['europa', 'esteri'], riforma: ['pa', 'giustizia', 'autonomie'], opere: ['infrastrutture', 'trasporti'] }
};
export const areasOf = (kind, family) => AREAS[TOPIC_KIND[kind]]?.[family] ?? [];
// The words that make a headline of the diary relevant to a family of topics (a headline is quoted only when it is about the subject).
const NEWS = {
  sanita: /sanit|ospedal|medic|salute|liste d.attesa/i, trasporti: /trasport|corse|treni|autobus|mobilit/i, scuola: /scuol|student|istruzion|palestr|universit/i, casa: /casa|affitt|alloggi|abitazion/i, sicurezza: /sicurez|furti|crimin|polizia/i,
  ambiente: /ambient|rifiut|inquin|clima|energia/i, lavoro: /lavor|occupaz|sciopero|fabbric|imprese/i, giustizia: /giustiz|tribunal|process/i, fisco: /fisco|tasse|imposte|tributi/i, digitale: /digital|informatic|rete/i,
  ritardi: /ritard|cantier/i, costi: /costi|prezzi|spesa/i, viabilita: /strad|viabil|traffico/i, collaudo: /collaud|opera|cantier/i, conti: /conti|bilancio|deficit|spesa|debito/i, territorio: /territor|region|comun/i, sondaggi: /sondagg|consens/i,
  tesseramento: /tessere|iscritti|tesserament/i, candidature: /candidat/i, linea: /linea|congresso|segreteria/i, soldi: /tesoreria|finanziament|contribut/i, alleanze: /allean|coalizion/i, comunicazione: /comunicaz|social|dichiaraz/i,
  decreto: /decreto/i, manovra: /manovra|bilancio|finanziaria/i, emergenza: /emergenz|alluvion|terremot/i, europa: /europ|bruxelles|ue\b/i, riforma: /riforma/i, opere: /opere|cantier|infrastrutt/i, nomine: /nomin/i, promesse: /promess|programma/i, partito: /partito|corrente|direzione/i, polemica: /polemic|attacc|scontro/i, materiali: /material|lotto|collaud/i, residenti: /rumor|residenti/i
};
export const newsFits = (family, headline) => Boolean(NEWS[family]?.test(String(headline ?? '')));

export const ALL_PAIRS = Object.values(TOPIC_MOVES).flatMap(kind => Object.values(kind).flatMap(topic => Object.values(topic).flat().map(move => move.label)));
