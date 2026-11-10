// Who sits in front of the player in each family of each activity scene (core/activity-scenes.js): the two interlocutors of a family have the roles that belong to its subject — a head physician in a scene
// about waiting lists, a union delegate in one about work — and not always the same two. Pairs [Italian, English]; the names come from the pool of the scene kind. `refs`: how a scene mentions what the career
// really holds (the party, a promise, the territory, a rival, a headline of the week): a template with `{}` for the real text, used only when the career has that datum.
const G = (a, b) => [a, b];
const Q = pair => pair;
export const GUESTS = Object.freeze({
  associazioni: {
    sanita: G(['Presidente del comitato dei pazienti', 'Chair of the patients’ committee'], ['Medico di base del quartiere', 'Neighbourhood family doctor']),
    trasporti: G(['Portavoce dei pendolari', 'Commuters’ spokesperson'], ['Rappresentante degli studenti', 'Students’ representative']),
    scuola: G(['Presidente dell’associazione dei genitori', 'Chair of the parents’ association'], ['Dirigente scolastica', 'School head']),
    casa: G(['Delegato del sindacato degli inquilini', 'Tenants’ union delegate'], ['Presidente del comitato sfrattati', 'Chair of the evictions committee']),
    sicurezza: G(['Presidente del comitato di quartiere', 'Chair of the neighbourhood committee'], ['Titolare di un negozio di vicinato', 'Owner of a local shop']),
    ambiente: G(['Presidente dell’associazione ambientalista', 'Chair of the environmental association'], ['Responsabile del comitato contro la discarica', 'Head of the anti-landfill committee']),
    lavoro: G(['Delegato sindacale', 'Union delegate'], ['Presidente della confederazione degli artigiani', 'Chair of the craftsmen’s confederation'])
  },
  cantiere: {
    ritardi: G(['Direttore dei lavori', 'Site manager'], ['Responsabile del procedimento', 'Project officer']),
    sicurezza: G(['Responsabile della sicurezza', 'Safety officer'], ['Delegato sindacale dei lavoratori', 'Workers’ union delegate']),
    costi: G(['Direttore tecnico dell’impresa', 'Contractor’s technical director'], ['Ragioniere dell’ente appaltante', 'Contracting authority accountant']),
    viabilita: G(['Comandante della polizia locale', 'Chief of the local police'], ['Rappresentante dei commercianti della zona', 'Representative of local traders']),
    materiali: G(['Ingegnere collaudatore', 'Testing engineer'], ['Capocantiere', 'Site foreman']),
    residenti: G(['Portavoce dei residenti', 'Residents’ spokesperson'], ['Capocantiere', 'Site foreman']),
    collaudo: G(['Direttore dei lavori', 'Site manager'], ['Funzionario della soprintendenza', 'Heritage authority official'])
  },
  sede: {
    tesseramento: G(['Responsabile del tesseramento', 'Membership officer'], ['Delegata dei giovani', 'Youth delegate']),
    candidature: G(['Capogruppo della corrente di maggioranza', 'Leader of the majority current'], ['Rappresentante della minoranza interna', 'Representative of the internal minority']),
    linea: G(['Segretario di sezione', 'Section secretary'], ['Rappresentante della base', 'Representative of the rank and file']),
    soldi: G(['Tesoriere della sezione', 'Section treasurer'], ['Militante storico', 'Long-time activist']),
    alleanze: G(['Capogruppo in consiglio comunale', 'Group leader in the city council'], ['Segretario di sezione', 'Section secretary']),
    territorio: G(['Responsabile territoriale', 'Local officer'], ['Referente dei circoli', 'Clubs’ coordinator']),
    comunicazione: G(['Responsabile della comunicazione', 'Communications officer'], ['Delegata dei giovani', 'Youth delegate'])
  },
  commissione: {
    sanita: G(['Presidente della commissione Affari sociali', 'Chair of the Social Affairs committee'], ['Direttore generale di un’azienda sanitaria', 'Director-general of a health authority']),
    lavoro: G(['Presidente della commissione Lavoro', 'Chair of the Labour committee'], ['Rappresentante dei sindacati', 'Union representative']),
    ambiente: G(['Presidente della commissione Ambiente', 'Chair of the Environment committee'], ['Geologo del dipartimento di protezione civile', 'Geologist of the civil protection department']),
    scuola: G(['Presidente della commissione Cultura', 'Chair of the Culture committee'], ['Dirigente dell’ufficio scolastico regionale', 'Head of the regional schools office']),
    giustizia: G(['Presidente della commissione Giustizia', 'Chair of the Justice committee'], ['Presidente di un tribunale', 'President of a court']),
    fisco: G(['Presidente della commissione Finanze', 'Chair of the Finance committee'], ['Commercialista esperto in partite IVA', 'Accountant expert in self-employed taxation']),
    digitale: G(['Presidente della commissione Trasporti e telecomunicazioni', 'Chair of the Transport and Telecommunications committee'], ['Responsabile dell’agenda digitale', 'Head of the digital agenda'])
  },
  redazione: {
    promesse: G(['Direttrice del quotidiano', 'Newspaper editor'], ['Cronista politico', 'Political reporter']),
    conti: G(['Caporedattore economia', 'Economics editor'], ['Cronista politico', 'Political reporter']),
    alleanze: G(['Direttrice del quotidiano', 'Newspaper editor'], ['Editorialista', 'Columnist']),
    partito: G(['Retroscenista', 'Behind-the-scenes reporter'], ['Cronista politico', 'Political reporter']),
    polemica: G(['Caposervizio politica', 'Politics desk head'], ['Cronista parlamentare', 'Parliamentary reporter']),
    territorio: G(['Caporedattore della cronaca locale', 'Local news editor'], ['Cronista politico', 'Political reporter']),
    sondaggi: G(['Direttrice del quotidiano', 'Newspaper editor'], ['Analista dei sondaggi', 'Poll analyst'])
  },
  consiglio: {
    decreto: G(['Ministro dell’Economia', 'Minister of Economy'], ['Ministra per i rapporti con il Parlamento', 'Minister for Relations with Parliament']),
    manovra: G(['Ministro dell’Economia', 'Minister of Economy'], ['Ministro del Lavoro', 'Minister of Labour']),
    nomine: G(['Sottosegretario alla Presidenza', 'Undersecretary to the Prime Minister'], ['Ministra per i rapporti con il Parlamento', 'Minister for Relations with Parliament']),
    emergenza: G(['Ministro dell’Interno', 'Minister of the Interior'], ['Capo del dipartimento di protezione civile', 'Head of the civil protection department']),
    europa: G(['Ministro degli Esteri', 'Minister of Foreign Affairs'], ['Ministra per gli Affari europei', 'Minister for European Affairs']),
    riforma: G(['Ministra per le Riforme', 'Minister for Reforms'], ['Sottosegretario alla Presidenza', 'Undersecretary to the Prime Minister']),
    opere: G(['Ministro delle Infrastrutture', 'Minister of Infrastructure'], ['Ministro dell’Economia', 'Minister of Economy'])
  }
});
// «Incontra un gruppo di cittadini» is not «Rete con associazioni e comitati»: the same civic hall, but ordinary people with their own problems, and its own heading and banner.
export const CITIZEN_GUESTS = Object.freeze({
  sanita: G(['Un pensionato in lista d’attesa', 'A pensioner on a waiting list'], ['Una madre con due bambini piccoli', 'A mother with two small children']),
  trasporti: G(['Un’operaia pendolare', 'A commuting factory worker'], ['Uno studente delle superiori', 'A secondary-school student']),
  scuola: G(['Un padre di due alunni', 'A father of two pupils'], ['Una maestra di scuola elementare', 'A primary-school teacher']),
  casa: G(['Una giovane coppia in affitto', 'A young couple renting'], ['Un anziano con lo sfratto in corso', 'An older man facing eviction']),
  sicurezza: G(['Una commerciante del quartiere', 'A shopkeeper of the neighbourhood'], ['Un residente di via Mazzini', 'A resident of the street']),
  ambiente: G(['Un contadino della zona', 'A farmer of the area'], ['Una ragazza dei comitati per il clima', 'A girl from the climate groups']),
  lavoro: G(['Un artigiano con la bottega in difficoltà', 'A craftsman with a struggling workshop'], ['Una lavoratrice precaria', 'A precarious worker'])
});
export const HEADINGS = Object.freeze({
  associazioni: { kicker: ['COMITATI E ASSOCIAZIONI', 'COMMITTEES AND ASSOCIATIONS'], title: ['Incontro con comitati e associazioni', 'Meeting with committees and associations'], banner: ['COMITATI E ASSOCIAZIONI', 'COMMITTEES AND ASSOCIATIONS'], body: ['Società civile', 'Civil society'] },
  cittadini: { kicker: ['INCONTRO CON I CITTADINI', 'MEETING WITH CITIZENS'], title: ['Incontro con i cittadini', 'Meeting with citizens'], banner: ['INCONTRO CON I CITTADINI', 'MEETING WITH CITIZENS'], body: ['Cittadini', 'Citizens'] }
});
// What the career holds that a scene can mention: one sentence per scene kind (the free part is the real text: the name of the party, the title of a promise, the region, a rival, a headline). A scene
// uses at most one, picked by the seed among those the career can fill; with none, the scene stays as it was.
export const REFS = Object.freeze({
  party: {
    sede: Q(['Sulla parete, sotto il simbolo di {}, qualcuno ha appeso il calendario delle assemblee.', 'On the wall, under the symbol of {1}, someone has pinned the calendar of the assemblies.']),
    associazioni: Q(['Sono venuti perché con {} avete aperto uno sportello in quartiere.', 'They came because with {1} you opened a help desk in the neighbourhood.']),
    cantiere: Q(['Sul cartello del cantiere c’è anche il nome di {}, che ha sostenuto l’opera.', 'The site sign also carries the name of {1}, which backed the project.']),
    commissione: Q(['Il gruppo di {} ha chiesto l’audizione e ora tocca a te sostenerla.', 'The group of {1} asked for the hearing and now it is up to you to carry it.']),
    redazione: Q(['Il titolo che circola in redazione è su {}: ti chiederanno conto della linea.', 'The headline going around the newsroom is about {1}: they will ask you to account for the line.']),
    consiglio: Q(['Fuori dalla sala i cronisti chiedono come voterà {} sul dossier.', 'Outside the room reporters ask how {1} will vote on the dossier.'])
  },
  promise: {
    sede: Q(['Un militante ti ricorda la promessa fatta: «{}».', 'An activist reminds you of the promise you made: “{1}”.']),
    associazioni: Q(['Qualcuno ha portato il volantino con la tua promessa: «{}».', 'Someone brought the leaflet with your promise: “{1}”.']),
    cantiere: Q(['Il capocantiere ti chiede se la tua promessa «{}» passa anche da qui.', 'The foreman asks whether your promise “{1}” also goes through here.']),
    commissione: Q(['Il presidente apre ricordando l’impegno preso: «{}».', 'The chair opens by recalling the commitment made: “{1}”.']),
    redazione: Q(['Sul tavolo della direttrice c’è una tua promessa sottolineata: «{}».', 'On the editor’s desk lies one of your promises, underlined: “{1}”.']),
    consiglio: Q(['In cartella c’è anche l’impegno «{}», che il governo dovrebbe mantenere.', 'In the file there is also the commitment “{1}”, which the government should keep.'])
  },
  region: {
    sede: Q(['Le sezioni di {} aspettano da te un segnale.', 'The branches in {1} are waiting for a signal from you.']),
    associazioni: Q(['Vengono da {} e raccontano quello che vedono ogni giorno.', 'They come from {1} and tell what they see every day.']),
    cantiere: Q(['Il cantiere è in {}: i residenti guardano ogni giorno cosa succede.', 'The site is in {1}: residents watch every day what happens.']),
    commissione: Q(['Gli ospiti arrivano da {} e portano dati del territorio.', 'The guests come from {1} and bring data from the territory.']),
    redazione: Q(['La cronaca locale di {} ha già pubblicato due articoli sul tema.', 'The local news pages of {1} have already run two articles on the subject.']),
    consiglio: Q(['Sul tavolo c’è un dossier che riguarda {}.', 'On the table is a dossier concerning {1}.'])
  },
  rival: {
    sede: Q(['Tra i presenti qualcuno cita {} e ciò che sta facendo.', 'Among those present someone mentions {1} and what is being done.']),
    associazioni: Q(['Hanno incontrato anche {} la settimana scorsa e ora vogliono sentire te.', 'They also met {1} last week and now want to hear from you.']),
    cantiere: Q(['Il giorno prima era passato da qui {}, e i lavoratori l’hanno notato.', 'The day before {1} had been here, and the workers noticed.']),
    commissione: Q(['L’audizione segue quella in cui {} ha preso posizione.', 'The hearing follows the one in which {1} took a position.']),
    redazione: Q(['In redazione hanno appena pubblicato un’intervista a {}.', 'The newsroom has just published an interview with {1}.']),
    consiglio: Q(['In sala si discute la posizione di {}, contraria alla linea del governo.', 'The room is discussing the position of {1}, against the government’s line.'])
  },
  news: {
    sede: Q(['Tutti hanno letto il titolo di questi giorni: «{}».', 'Everyone has read the headline of these days: “{1}”.']),
    associazioni: Q(['La gente arriva col titolo del giornale in mano: «{}».', 'People arrive with the newspaper headline in hand: “{1}”.']),
    cantiere: Q(['Le notizie di questi giorni («{}») pesano anche sul cantiere.', 'The news of these days (“{1}”) also weighs on the site.']),
    commissione: Q(['Il contesto è quello dei fatti recenti: «{}».', 'The context is that of recent events: “{1}”.']),
    redazione: Q(['Il fatto del momento, «{}», è l’apertura di domani.', 'The story of the moment, “{1}”, is tomorrow’s front page.']),
    consiglio: Q(['Aprendo la riunione si cita il fatto di questi giorni: «{}».', 'Opening the meeting, the event of these days is mentioned: “{1}”.'])
  }
});
export const BODIES = Object.freeze({ associazioni: ['Società civile', 'Civil society'], cantiere: ['Opera pubblica', 'Public works'], sede: ['Partito', 'Party'], commissione: ['Commissione parlamentare', 'Parliamentary committee'], redazione: ['Stampa', 'Press'], consiglio: ['Governo', 'Government'] });
export const ALL_PAIRS = [
  ...Object.values(BODIES),
  ...Object.values(CITIZEN_GUESTS).flat(),
  ...Object.values(HEADINGS).flatMap(item => [item.kicker, item.title, item.banner, item.body]),
  ...Object.values(GUESTS).flatMap(kind => Object.values(kind).flat()),
  ...Object.values(REFS).flatMap(group => Object.values(group))
].filter((pair, index, all) => all.findIndex(other => other[0] === pair[0]) === index);
