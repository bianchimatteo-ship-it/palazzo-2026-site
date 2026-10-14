// The President of the Republic: an office apart from the Government, elected by the Parliament in joint session with
// the regional delegates (art. 83–85 of the Constitution), by secret ballot. Rules inspired by the Constitution and
// declared as simplifications where they are. Everything here is simulation: no real candidate, no real vote, and the
// incumbent is never named (the game only knows when the current seven-year term began).
export const PRESIDENCY_RULES = Object.freeze({
  termYears: 7,                 // art. 85
  minAge: 50,                   // art. 84: fifty years of age and the enjoyment of civil and political rights
  // The date of the oath of the term in office when a career starts (a calendar fact, never a name).
  currentTermSince: '2022-02-03',
  // Thirty days before the end of the term the Speaker of the Camera convenes the joint session (art. 85); the first
  // ballot takes place a few days before the term ends. The weeks before are the weeks of the negotiations.
  convocationDays: 30,
  firstBallotBeforeEndDays: 10,
  negotiationWeeks: 8,
  // With the Chambers dissolved, or ending within three months, the vote waits for the new Chambers (art. 85): within
  // fifteen days of their meeting. Meanwhile the powers of the President in office are extended.
  chambersEndingDays: 90,
  afterNewChambersDays: 15,
  // The assembly: Deputies, Senators (the senators for life are already among the real groups of the XIX legislature),
  // three delegates for each Region and one for the Valle d'Aosta (art. 83).
  delegates: { perRegion: 3, valleDAosta: 1, majority: 2, minority: 1 },
  lifeSenatorsInSimulatedLegislature: 5,
  // Quorum: two thirds of the assembly in the first three ballots, the absolute majority from the fourth (art. 83).
  twoThirdsUntil: 3,
  ballotsPerWeek: 4,
  // A ballot that goes nowhere for long ends with the agreement of the last resort (so that no election lasts forever).
  softLimit: 14, hardLimit: 30,
  // The "semestre bianco" (art. 88): in the last six months of the term the President cannot dissolve the Chambers,
  // unless they coincide in whole or in part with the last six months of the legislature.
  whiteSemesterDays: 183,
  // A law approved by the Chambers is promulgated within a month, or sent back to them once (art. 73–74).
  returnWindowDays: 30,
  // The credit of the President with the Chambers and the country (0–100): what the seven years are made of.
  creditStart: 60,
  lifeSenatorLimit: 5,
  notes: [
    'Il Presidente non è eletto dai cittadini: lo elegge il Parlamento in seduta comune con tre delegati per ogni Regione (uno per la Valle d’Aosta), a scrutinio segreto.',
    'Nei primi tre scrutini serve la maggioranza dei due terzi dell’assemblea; dal quarto basta la maggioranza assoluta.',
    'Il mandato dura sette anni e non è rinnovabile per legge né vietato dalla Costituzione: può essere rieletto chi ha il consenso dell’assemblea.',
    'Il Presidente della Repubblica è incompatibile con ogni altra carica e non risponde politicamente delle sue scelte: può essere sfiduciato solo con la messa in stato d’accusa per alto tradimento o attentato alla Costituzione.',
    'Nomi, candidati e voti sono simulati: nessuna persona reale è candidata nella partita.'
  ],
  source: 'simulation'
});

export const CAMP_LABELS = Object.freeze({ destra: 'centrodestra', sinistra: 'centrosinistra', centro: 'centro' });

// The kinds of candidate that appear in the field: prestige (how high the figure stands), breadth (how many camps
// could vote for it) and partisanship (how much of a flag-bearer it is). Never a name: the label says what it is.
export const CANDIDATE_TYPES = Object.freeze({
  garanzia: { label: 'Figura di garanzia istituzionale', prestige: [64, 78], breadth: [72, 90], partisan: [0.05, 0.2] },
  giurista: { label: 'Giurista di alto profilo', prestige: [62, 76], breadth: [66, 84], partisan: [0.05, 0.25] },
  presidenza: { label: 'Alta carica delle Camere', prestige: [64, 78], breadth: [52, 74], partisan: [0.25, 0.5] },
  'ex-premier': { label: 'Ex presidente del Consiglio', prestige: [70, 84], breadth: [38, 60], partisan: [0.4, 0.7] },
  'ex-ministro': { label: 'Ex ministro di esperienza', prestige: [56, 72], breadth: [40, 62], partisan: [0.35, 0.65] },
  accademico: { label: 'Accademico di fama', prestige: [58, 72], breadth: [60, 80], partisan: [0.05, 0.25] },
  bandiera: { label: 'Candidato di area', prestige: [52, 70], breadth: [18, 42], partisan: [0.65, 0.95] },
  leader: { label: 'Leader di partito', prestige: [58, 76], breadth: [14, 34], partisan: [0.8, 1] },
  uscente: { label: 'Il Presidente uscente', prestige: [80, 90], breadth: [82, 94], partisan: [0, 0.05] },
  giocatore: { label: 'Il tuo nome', prestige: [0, 100], breadth: [0, 100], partisan: [0, 1] }
});

// How the electors weigh a candidate (see presidency-engine): every term is a plain number of points.
export const AFFINITY = Object.freeze({
  base: 50, perAxisStep: 8.5, prestige: 0.30, prestigeCentre: 55, breadth: 0.22, breadthCentre: 50,
  partisan: 14, sameCampPartisanShare: 0.3, sponsor: 28, veto: -60, acceptFrom: 30, acceptSpan: 25,
  // Pressure to converge grows from one ballot to the next (the fatigue of the Chambers).
  pressureBallots: 7, lineThresholdStart: 55, lineThresholdDrop: 20, viabilityWeight: 46, burnAfter: 3
});

// The people who decide, as the agenda sees them: decisions of the situation events (src/core/career-engine.js).
const sponsorChoice = (id, label, special, extra = {}) => ({ id, label, special, ...extra });
export const PRESIDENCY_SITUATIONS = Object.freeze({
  'quirinale-trattative': {
    id: 'quirinale-trattative', title: 'Quirinale: si apre la corsa', body: 'Tra {weeks} settimane il Parlamento in seduta comune, con i delegati delle Regioni, elegge il Presidente della Repubblica: scrutinio segreto, {twoThirds} voti (due terzi) nei primi tre scrutini, poi la maggioranza assoluta di {absolute}. Il tuo gruppo porta {electors} grandi elettori. {field}',
    defaultChoice: 'attendi', choices: [
      sponsorChoice('area', 'Lancia un candidato della tua area (3 capitale)', 'presidency-propose', { cost: { capital: 3 } }),
      sponsorChoice('condiviso', 'Proponi una figura di garanzia condivisa (2 capitale)', 'presidency-shared', { cost: { capital: 2 } }),
      sponsorChoice('attendi', 'Attendi le mosse degli altri: scheda bianca nei primi scrutini', 'presidency-wait')
    ]
  },
  'quirinale-scrutinio': {
    id: 'quirinale-scrutinio', title: 'Quirinale: scrutinio segreto', body: 'Questa settimana si vota per il Presidente della Repubblica ({rule}: servono {needed} voti su {total}). Il tuo gruppo oggi {line}. Il voto è segreto: nessuno saprà come hai votato, ma i sospetti restano. {standing}',
    defaultChoice: 'linea', choices: [
      sponsorChoice('linea', 'Vota come il tuo gruppo ({line})', 'presidency-vote-linea'),
      sponsorChoice('c1', 'Vota {cand1}', 'presidency-vote-c1'),
      sponsorChoice('c2', 'Vota {cand2}', 'presidency-vote-c2'),
      sponsorChoice('bianca', 'Scheda bianca', 'presidency-vote-bianca')
    ]
  },
  'quirinale-linea': {
    id: 'quirinale-linea', title: 'Quirinale: la linea del tuo partito', body: 'Dopo {ballots} scrutini nessuno è stato eletto ({leader} è in testa con {leaderVotes} voti su {needed} necessari). Come segretario decidi la linea del tuo gruppo per i prossimi scrutini: i tuoi {electors} grandi elettori la seguiranno, salvo i franchi tiratori. {standing}',
    defaultChoice: 'prosegui', choices: [
      sponsorChoice('sostieni', 'Sostieni {cand1}', 'presidency-line-c1', { cost: { capital: 1 } }),
      sponsorChoice('alternativa', 'Converge su {cand2}', 'presidency-line-c2', { cost: { capital: 1 } }),
      sponsorChoice('bianca', 'Scheda bianca: aspetta un accordo', 'presidency-line-bianca'),
      sponsorChoice('prosegui', 'Prosegui con la linea attuale', 'presidency-line-keep')
    ]
  },
  'quirinale-candidatura': {
    id: 'quirinale-candidatura', title: 'Quirinale: il tuo nome', body: 'Nelle trattative per il Colle circola il tuo nome, proposto da {sponsor}. Hai {age} anni e i requisiti, ma al Quirinale si va con il consenso dell’assemblea: i due terzi nei primi tre scrutini, poi la maggioranza assoluta. Candidarsi significa lasciare ogni altra carica se sarai eletto, e un fallimento pubblico si paga.',
    defaultChoice: 'rifiuta', choices: [
      sponsorChoice('accetta', 'Accetta la candidatura (2 capitale)', 'presidency-accept', { cost: { capital: 2 } }),
      sponsorChoice('rifiuta', 'Non sei disponibile', 'presidency-decline')
    ]
  },
  'quirinale-rielezione': {
    id: 'quirinale-rielezione', title: 'Il tuo mandato sta per finire', body: 'Tra {weeks} settimane scade il tuo settennato e il Parlamento sceglie il successore. La Costituzione non vieta un secondo mandato: se ti dichiari disponibile, il tuo nome entra tra i possibili. Il credito che hai con le Camere e con il Paese è {credit}/100.',
    defaultChoice: 'non-disponibile', choices: [
      sponsorChoice('disponibile', 'Dichiarati disponibile a un secondo mandato', 'presidency-reelect'),
      sponsorChoice('non-disponibile', 'Annuncia che lasci alla scadenza', 'presidency-step-down')
    ]
  },
  'quirinale-consultazioni': {
    id: 'quirinale-consultazioni', title: 'Consultazioni al Quirinale', body: '{situation} Dopo le consultazioni tocca a te decidere a chi affidare l’incarico. La maggioranza più solida è {main}; un’alternativa è {alt}. Puoi anche tentare un governo del Presidente con un tecnico, o sciogliere le Camere{whiteSemester}.',
    defaultChoice: 'maggioranza', choices: [
      sponsorChoice('maggioranza', 'Affida l’incarico alla maggioranza più solida', 'presidency-formation-main'),
      sponsorChoice('alternativa', 'Affida l’incarico all’alternativa', 'presidency-formation-alt'),
      sponsorChoice('tecnico', 'Governo del Presidente: un tecnico sostenuto da molti', 'presidency-formation-tech'),
      sponsorChoice('sciogli', 'Sciogli le Camere: si torna al voto', 'presidency-formation-dissolve')
    ]
  },
  'presidente-grazia': {
    id: 'presidente-grazia', title: 'Una richiesta di grazia divide il Paese', body: 'Arriva sul tuo tavolo una domanda di grazia per una condanna che ha acceso il dibattito: per alcuni è un atto di umanità, per altri un colpo alla giustizia. Il ministro della Giustizia ha già dato il parere.',
    defaultChoice: 'rinvia', choices: [
      sponsorChoice('concedi', 'Concedi la grazia', 'presidency-act-grazia'),
      sponsorChoice('nega', 'Respingi la domanda', 'presidency-act-grazia-negata'),
      sponsorChoice('rinvia', 'Chiedi altri approfondimenti', 'presidency-act-attesa')
    ]
  },
  'presidente-decreto': {
    id: 'presidente-decreto', title: 'Il decreto-legge «{title}» dai dubbi costituzionali', body: 'Il governo ti trasmette il decreto-legge «{title}»: gli uffici del Quirinale segnalano profili di dubbia costituzionalità. Se lo emani, resta in vigore; se lo rifiuti, decade e il governo ne esce indebolito; con una lettera di rilievi chiedi di correggerlo in sede di conversione.',
    defaultChoice: 'rilievi', choices: [
      sponsorChoice('emana', 'Emana il decreto senza rilievi', 'presidency-act-decreto-emanato'),
      sponsorChoice('rilievi', 'Emana il decreto con una lettera di rilievi', 'presidency-act-decreto-rilievi'),
      sponsorChoice('rifiuta', 'Rifiuta di emanarlo', 'presidency-act-decreto-rifiutato')
    ]
  },
  'presidente-difesa': {
    id: 'presidente-difesa', title: 'Crisi internazionale: il Consiglio supremo di difesa', body: 'Una crisi internazionale riaccende il dibattito sulle scelte del Paese. Presiedi il Consiglio supremo di difesa: puoi convocarlo subito, con un messaggio ai cittadini, oppure lasciare che sia il governo a gestire.',
    defaultChoice: 'governo', choices: [
      sponsorChoice('convoca', 'Convoca il Consiglio e parla al Paese', 'presidency-act-difesa'),
      sponsorChoice('governo', 'Lascia la scena al governo', 'presidency-act-difesa-governo')
    ]
  },
  'presidente-legge': {
    id: 'presidente-legge', title: 'Una legge da promulgare: «{title}»', body: 'Le Camere hanno approvato «{title}» e hai trenta giorni per promulgarla (art. 73). {doubt} Puoi promulgarla, farlo con una lettera ai presidenti delle Camere che segnali i dubbi, o rinviarla alle Camere una volta sola (art. 74): il governo ne uscirebbe indebolito.',
    defaultChoice: 'promulga', choices: [
      sponsorChoice('promulga', 'Promulga la legge', 'presidency-act-legge-promulgata'),
      sponsorChoice('lettera', 'Promulga con una lettera sui dubbi di costituzionalità', 'presidency-act-legge-lettera'),
      sponsorChoice('rinvia', 'Rinvia la legge alle Camere', 'presidency-act-legge-rinviata')
    ]
  },
  'presidente-corte': {
    id: 'presidente-corte', title: 'Nomina di un giudice della Corte costituzionale', body: 'Tocca a te nominare uno dei cinque giudici di tua competenza (art. 135). La scelta pesa per anni: la Corte giudicherà le leggi del governo e le tue scelte di oggi si vedranno nelle sentenze di domani. Giudici già nominati da te: {named}.',
    defaultChoice: 'accademico', choices: [
      sponsorChoice('accademico', 'Un costituzionalista indipendente', 'presidency-act-corte-accademico'),
      sponsorChoice('magistrato', 'Un magistrato di lungo corso', 'presidency-act-corte-magistrato'),
      sponsorChoice('avvocato', 'Un avvocato dello Stato vicino alle istituzioni', 'presidency-act-corte-avvocato')
    ]
  },
  'presidente-diplomazia': {
    id: 'presidente-diplomazia', title: 'Diplomazia: una visita di Stato', body: 'Il Presidente rappresenta l’unità nazionale e ratifica i trattati (art. 87): tre capitali attendono una tua visita, e nessuna è neutra. Le scelte del governo e i rapporti dell’Italia ne risentono. Oggi i rapporti con l’Europa valgono {europa}/100 e il peso internazionale {esteri}/100.',
    defaultChoice: 'rinuncia', choices: [
      sponsorChoice('europa', 'Visita alle istituzioni europee', 'presidency-act-diplomazia-europa'),
      sponsorChoice('atlantico', 'Visita di Stato a un alleato atlantico', 'presidency-act-diplomazia-atlantico'),
      sponsorChoice('mediterraneo', 'Viaggio nel Mediterraneo: energia e migrazioni', 'presidency-act-diplomazia-mediterraneo'),
      sponsorChoice('rinuncia', 'Rinuncia: l’agenda interna viene prima', 'presidency-act-diplomazia-rinuncia')
    ]
  },
  'presidente-garanzia': {
    id: 'presidente-garanzia', title: 'Crisi di garanzia: lo scontro tra poteri', body: '{conflict} Il Presidente è garante della Costituzione: puoi intervenire con la moral suasion riservata, con una dichiarazione pubblica, oppure convocare i leader per un chiarimento. Se non fai nulla lo scontro si allarga.',
    defaultChoice: 'attendi', choices: [
      sponsorChoice('suasion', 'Moral suasion riservata sui protagonisti', 'presidency-act-garanzia-suasion'),
      sponsorChoice('pubblica', 'Dichiarazione pubblica sul rispetto delle regole', 'presidency-act-garanzia-pubblica'),
      sponsorChoice('leader', 'Convoca i leader di maggioranza e opposizione', 'presidency-act-garanzia-leader'),
      sponsorChoice('attendi', 'Non intervenire', 'presidency-act-attesa')
    ]
  },
  'presidente-fine-anno': {
    id: 'presidente-fine-anno', title: 'Il messaggio di fine anno', body: 'Come ogni 31 dicembre parli al Paese. Il tono che scegli resta nella memoria politica: l’unità, il monito alle forze politiche, o le riforme che servono.',
    defaultChoice: 'unita', choices: [
      sponsorChoice('unita', 'Un messaggio di unità nazionale', 'presidency-act-messaggio-unita'),
      sponsorChoice('monito', 'Un monito alle forze politiche', 'presidency-act-messaggio-monito'),
      sponsorChoice('riforme', 'Un appello alle riforme', 'presidency-act-messaggio-riforme')
    ]
  },
  'presidente-csm': {
    id: 'presidente-csm', title: 'Tensione tra politica e magistratura', body: 'Presiedi il Consiglio superiore della magistratura: uno scontro tra governo e magistrati rischia di allargarsi. Puoi intervenire con una moral suasion riservata, oppure con una dichiarazione pubblica.',
    defaultChoice: 'riservata', choices: [
      sponsorChoice('riservata', 'Moral suasion riservata', 'presidency-act-csm-riservata'),
      sponsorChoice('pubblica', 'Dichiarazione pubblica', 'presidency-act-csm-pubblica'),
      sponsorChoice('attendi', 'Non intervenire', 'presidency-act-attesa')
    ]
  }
});

// What a decision of the President does: credit with the Chambers and the country, the stability of the Government,
// the mood of the citizens, the personal standing, and what stays in the memory. Never the same twice in a row.
// What a decision can also set in motion: `law` acts on the law of the decision, `ledger` is a commitment that comes due (checked against what the Chambers and the country really do:
// see LEDGER_RULES), `shock` moves an area of the country, `court` names a judge of the Constitutional Court.
export const PRESIDENT_ACTS = Object.freeze({
  'grazia': { label: 'Grazia concessa', credit: 3, stability: -1, mood: 0.6, stats: { popularity: 1, reputation: -0.5 }, memory: { kind: 'decisione', text: 'Hai concesso una grazia', weight: 1 }, ledger: { kind: 'grazia', weeks: 10 }, line: 'Concedi la grazia: parte dell’opinione pubblica applaude, la magistratura è fredda.' },
  'grazia-negata': { label: 'Grazia negata', credit: 1, stability: 0, mood: -0.2, stats: { reputation: 0.5 }, memory: { kind: 'decisione', text: 'Hai respinto una domanda di grazia', weight: 0.6 }, line: 'Respingi la domanda: la giustizia ne esce rafforzata, i sostenitori del condannato protestano.' },
  'attesa': { label: 'Decisione rinviata', credit: -1, stability: 0, mood: 0, stats: {}, memory: null, line: 'Rinvii la decisione: nessuno è contento, ma nessuno può dirti di aver sbagliato.' },
  'decreto-emanato': { label: 'Decreto emanato', credit: -2, stability: 3, mood: 0, stats: { influence: -0.5 }, memory: { kind: 'decisione', text: 'Hai emanato un decreto dai dubbi costituzionali', weight: 0.8 }, line: 'Emani il decreto: il governo ringrazia, i costituzionalisti protestano.' },
  'decreto-rilievi': { label: 'Decreto emanato con rilievi', credit: 2, stability: 0, mood: 0.2, stats: { reputation: 0.5 }, memory: null, ledger: { kind: 'rilievi', weeks: 8 }, line: 'Emani il decreto con una lettera di rilievi: il governo accetta, l’equilibrio regge.' },
  'decreto-rifiutato': { label: 'Decreto rifiutato', credit: 3, stability: -6, mood: 0, stats: { influence: 1 }, memory: { kind: 'decisione', text: 'Hai rifiutato di emanare un decreto del governo', weight: 1.2 }, law: 'refuse', line: 'Rifiuti di emanare il decreto: il governo è in difficoltà, la Costituzione è salva.' },
  'difesa': { label: 'Consiglio supremo di difesa', credit: 3, stability: 1, mood: 0.8, stats: { notoriety: 1.5 }, memory: { kind: 'emergenza', text: 'Hai convocato il Consiglio supremo di difesa', weight: 0.8 }, line: 'Convochi il Consiglio e parli al Paese: l’Italia ti vede alla guida nei momenti difficili.' },
  'difesa-governo': { label: 'Difesa lasciata al governo', credit: -1, stability: 0, mood: -0.2, stats: {}, memory: null, line: 'Lasci la scena al governo: nessun rischio, ma qualcuno ti accusa di assenza.' },
  'messaggio-unita': { label: 'Messaggio di unità', credit: 3, stability: 1, mood: 0.8, stats: { popularity: 1 }, memory: null, line: 'Il messaggio di unità nazionale raccoglie un consenso trasversale.' },
  'messaggio-monito': { label: 'Monito alle forze politiche', credit: 1, stability: -2, mood: 0.2, stats: { influence: 0.8 }, memory: null, line: 'Il monito scuote le forze politiche: qualcuno si sente chiamato in causa.' },
  'messaggio-riforme': { label: 'Appello alle riforme', credit: 0, stability: -1, mood: 0.2, stats: { influence: 1 }, memory: { kind: 'decisione', text: 'Hai chiesto riforme nel messaggio di fine anno', weight: 0.6 }, ledger: { kind: 'messaggio', weeks: 12 }, line: 'L’appello alle riforme apre il dibattito, ma divide la maggioranza.' },
  'csm-riservata': { label: 'Moral suasion al CSM', credit: 2, stability: 1, mood: 0, stats: { reputation: 0.6 }, memory: null, line: 'La moral suasion riservata raffredda lo scontro.' },
  'csm-pubblica': { label: 'Dichiarazione sul CSM', credit: 1, stability: -2, mood: 0.2, stats: { notoriety: 1 }, memory: null, line: 'La dichiarazione pubblica riaccende le tensioni, ma fissa un confine.' },
  'legge-promulgata': { label: 'Legge promulgata', credit: 0.5, stability: 1, mood: 0, stats: {}, memory: null, line: 'Promulghi la legge nei tempi: il governo ringrazia, nessuno ha nulla da dire.' },
  'legge-lettera': { label: 'Promulgazione con lettera', credit: 1, stability: -0.5, mood: 0.2, stats: { reputation: 0.4 }, memory: { kind: 'decisione', text: 'Hai promulgato una legge con una lettera sui dubbi', weight: 0.6 }, ledger: { kind: 'lettera', weeks: 8 }, line: 'Promulghi con una lettera ai presidenti delle Camere: segnali i dubbi senza fermare la legge.' },
  'legge-rinviata': { label: 'Legge rinviata alle Camere', credit: 2, stability: 0, mood: 0.1, stats: { influence: 0.8 }, memory: { kind: 'decisione', text: 'Hai rinviato una legge alle Camere', weight: 1.1 }, law: 'return', ledger: { kind: 'rinvio', weeks: 6 }, line: 'Rinvii la legge alle Camere: gli effetti si fermano e si rivota tra due settimane.' },
  'corte-accademico': { label: 'Giudice costituzionale: un costituzionalista', credit: 2, stability: 0, mood: 0.3, stats: { reputation: 0.6 }, court: 'accademico', memory: { kind: 'decisione', text: 'Hai nominato un costituzionalista indipendente alla Corte', weight: 0.8 }, ledger: { kind: 'corte', weeks: 26 }, line: 'Nomini un costituzionalista indipendente: la scelta è applaudita dai giuristi.' },
  'corte-magistrato': { label: 'Giudice costituzionale: un magistrato', credit: 1.5, stability: -0.5, mood: 0.1, stats: { influence: 0.5 }, court: 'magistrato', memory: { kind: 'decisione', text: 'Hai nominato un magistrato alla Corte', weight: 0.8 }, ledger: { kind: 'corte', weeks: 30 }, line: 'Nomini un magistrato di lungo corso: la Corte sarà più attenta ai diritti dei cittadini.' },
  'corte-avvocato': { label: 'Giudice costituzionale: un avvocato dello Stato', credit: 1, stability: 1, mood: 0, stats: {}, court: 'avvocato', memory: { kind: 'decisione', text: 'Hai nominato un avvocato dello Stato alla Corte', weight: 0.8 }, ledger: { kind: 'corte', weeks: 34 }, line: 'Nomini un avvocato dello Stato: la Corte sarà più prudente con l’azione del governo.' },
  'diplomazia-europa': { label: 'Visita alle istituzioni europee', credit: 1.5, stability: 0.5, mood: 0.4, stats: { notoriety: 0.8 }, shock: { area: 'europa', areaDelta: 2 }, ledger: { kind: 'diplomazia', weeks: 8, partner: 'europa' }, line: 'Il tuo discorso a Bruxelles riporta l’Italia al centro del tavolo europeo.' },
  'diplomazia-atlantico': { label: 'Visita di Stato a un alleato atlantico', credit: 1.5, stability: 0, mood: 0.4, stats: { notoriety: 0.8 }, shock: { area: 'esteri', areaDelta: 2 }, ledger: { kind: 'diplomazia', weeks: 8, partner: 'atlantico' }, line: 'La visita di Stato rafforza l’alleanza e il peso internazionale del Paese.' },
  'diplomazia-mediterraneo': { label: 'Viaggio nel Mediterraneo', credit: 1, stability: 0.5, mood: 0.2, stats: { influence: 0.5 }, shock: { area: 'esteri', areaDelta: 1 }, ledger: { kind: 'diplomazia', weeks: 8, partner: 'mediterraneo' }, line: 'Il viaggio apre un canale su energia e migrazioni, con esiti incerti.' },
  'diplomazia-rinuncia': { label: 'Visita rinviata', credit: -0.5, stability: 0, mood: 0, stats: {}, memory: null, line: 'Rinunci al viaggio: nessun rischio, ma qualcuno nota l’assenza.' },
  'garanzia-suasion': { label: 'Moral suasion riservata', credit: 2, stability: 1.5, mood: 0, stats: { reputation: 0.5 }, ledger: { kind: 'garanzia', weeks: 6 }, line: 'La moral suasion raffredda lo scontro senza esporre il Quirinale.' },
  'garanzia-pubblica': { label: 'Dichiarazione pubblica sulle regole', credit: 1, stability: -2, mood: 0.4, stats: { notoriety: 1 }, ledger: { kind: 'garanzia', weeks: 6 }, line: 'Parli in pubblico: fissi un confine, ma una parte politica si sente accusata.' },
  'garanzia-leader': { label: 'Chiarimento tra i leader', credit: 1.5, stability: 2, mood: 0, stats: { influence: 0.8 }, ledger: { kind: 'garanzia', weeks: 6 }, line: 'Il chiarimento al Quirinale ricompone lo scontro, per ora.' },
  'lettere-cittadini': { label: 'Risposta alle lettere dei cittadini', credit: 0.8, stability: 0, mood: 0.3, stats: { popularity: 0.5 }, memory: null, line: 'Rispondi ad alcune lettere: il Paese se ne accorge.' },
  'cerimonia-memoria': { label: 'Cerimonia della memoria', credit: 1, stability: 0.3, mood: 0.5, stats: { reputation: 0.5 }, memory: null, line: 'La cerimonia raccoglie il Paese attorno a un ricordo condiviso.' },
  'tragedia-visita': { label: 'Visita ai luoghi della tragedia', credit: 2, stability: 0.5, mood: 0.8, stats: { popularity: 1 }, memory: { kind: 'emergenza', text: 'Hai visitato i luoghi di una tragedia', weight: 0.8 }, line: 'La tua presenza accanto ai familiari è ricordata a lungo.' },
  'tragedia-messaggio': { label: 'Messaggio di cordoglio', credit: 0.5, stability: 0, mood: 0.3, stats: {}, memory: null, line: 'Il messaggio di cordoglio è sobrio e arriva presto.' },
  'ospite-stato': { label: 'Intesa con un ospite di Stato', credit: 1, stability: 0.3, mood: 0.3, stats: { notoriety: 0.5 }, shock: { area: 'esteri', areaDelta: 1 }, memory: null, line: 'Il colloquio con l’ospite di Stato porta a un’intesa sui dossier aperti.' },
  'mediazione-sociale': { label: 'Mediazione su una vertenza', credit: 1, stability: 0.8, mood: 0.3, stats: { reputation: 0.4 }, memory: null, line: 'Ricevi le parti: il governo si sente richiamato a fare la sua parte.' },
  'festa-europa': { label: 'Discorso europeista', credit: 0.8, stability: 0.2, mood: 0.2, stats: { notoriety: 0.5 }, shock: { area: 'europa', areaDelta: 1 }, memory: null, line: 'Il discorso europeista è letto a Bruxelles e commentato a Roma.' },
  'intervista': { label: 'Intervista del Presidente', credit: -0.5, stability: -1, mood: 0.4, stats: { notoriety: 1.5 }, memory: { kind: 'decisione', text: 'Hai rilasciato un’intervista da Presidente', weight: 0.5 }, line: 'L’intervista fa discutere: qualcuno la legge come una linea politica.' },
  'governo-incontro': { label: 'Incontro con il presidente del Consiglio', credit: 0.8, stability: 1.2, mood: 0, stats: { influence: 0.4 }, memory: null, line: 'L’incontro riservato con Palazzo Chigi mette ordine nei rapporti.' },
  'riforma-appello': { label: 'Appello alle riforme', credit: 0.5, stability: -1, mood: 0.2, stats: { influence: 0.6 }, ledger: { kind: 'messaggio', weeks: 8 }, line: 'L’appello alle riforme apre il dibattito: ora si vede se il Parlamento lo raccoglie.' }
});

// The weekly activities of the President (the ones a politician has do not fit the office): days of work, effects on
// credit, stability and mood. Powers with their own rules (formation, dissolution, return of a law, life senator) are
// separate buttons in the interface.
export const PRESIDENT_ACTIVITIES = Object.freeze([
  { id: 'colloqui', label: 'Colloqui riservati con i leader', detail: 'Incontri lontano dai riflettori: raffreddano le tensioni della maggioranza e danno credito alla tua moral suasion.', cost: { ap: 1, capital: 1 }, credit: 2, stability: 2, mood: 0, stats: { influence: 0.5 }, cooldownWeeks: 3 },
  { id: 'visita', label: 'Visita istituzionale in una regione', detail: 'Una giornata sul territorio: scuole, ospedali, ricorrenze. Il Paese ti vede vicino ai cittadini.', cost: { ap: 1 }, credit: 1, stability: 0, mood: 0.5, stats: { popularity: 1, notoriety: 0.5 }, target: 'region', cooldownWeeks: 2 },
  { id: 'messaggio', label: 'Messaggio alle Camere', detail: 'Un messaggio formale sulle priorità del Paese: il Parlamento è invitato a discuterne. Pesa, ma si usa poco.', cost: { ap: 1, capital: 2 }, credit: 1, stability: -1, mood: 0.3, stats: { influence: 1 }, cooldownWeeks: 26 },
  { id: 'cerimonia', label: 'Cerimonia e incontri di Stato', detail: 'Il lavoro quotidiano di rappresentanza: ambasciatori, onorificenze, ricorrenze nazionali.', cost: { ap: 1 }, credit: 0.5, stability: 0, mood: 0.2, stats: { reputation: 0.4 }, cooldownWeeks: 1 }
]);

// The commitments a decision of the President leaves behind, and how they are checked weeks later against what the Chambers, the Government and the country really did. label: how they read in the interface;
// success: the credit and stability gained; failure: the same when they come to nothing. Never a bonus without a check.
export const LEDGER_RULES = Object.freeze({
  rilievi: { label: 'Lettera di rilievi sul decreto', success: { credit: 2.5, stability: 0.5, text: 'Il decreto è stato corretto in sede di conversione: la lettera ha pesato.' }, failure: { credit: -1.5, stability: 0, text: 'Il decreto è passato senza correzioni: i rilievi del Quirinale sono rimasti inascoltati.' } },
  lettera: { label: 'Lettera sui dubbi di una legge', success: { credit: 2, stability: 0.5, text: 'Il Parlamento ha raccolto la segnalazione e ha rimesso mano alla materia.' }, failure: { credit: -0.5, stability: 0, text: 'La segnalazione non ha avuto seguito: la legge resta com’è.' } },
  rinvio: { label: 'Rinvio di una legge', success: { credit: 2, stability: 0, text: 'Le Camere hanno corretto il testo prima di riapprovarlo: il rinvio ha avuto un senso.' }, failure: { credit: -1, stability: -1, text: 'Le Camere hanno riapprovato la legge senza cambiarla: il rinvio ha solo allungato i tempi.' } },
  messaggio: { label: 'Messaggio alle Camere', success: { credit: 3, stability: 0.5, text: 'Il Parlamento ha approvato un provvedimento sul tema del messaggio.' }, failure: { credit: -1.5, stability: 0, text: 'Il messaggio è rimasto senza risposta: le Camere non hanno legiferato sul tema.' } },
  corte: { label: 'Giudice costituzionale', success: { credit: 1.5, stability: 0, text: 'La Corte ha deciso con equilibrio: la tua nomina è stata una buona scelta.' }, failure: { credit: -1, stability: -1.5, text: 'La Corte ha dichiarato illegittima una legge del governo: lo scontro si riflette sul Quirinale.' } },
  diplomazia: { label: 'Visita diplomatica', success: { credit: 2, stability: 0.5, text: 'La visita ha dato frutti: accordi e rapporti più solidi.' }, failure: { credit: -1, stability: 0, text: 'La visita non ha portato nulla: i rapporti restano freddi.' } },
  garanzia: { label: 'Intervento di garanzia', success: { credit: 2, stability: 1, text: 'Lo scontro tra poteri si è chiuso: il tuo intervento ha retto.' }, failure: { credit: -1.5, stability: -2, text: 'Lo scontro è peggiorato: l’intervento non ha tenuto.' } },
  incarico: { label: 'Incarico per il governo', success: { credit: 2, stability: 0.5, text: 'Il governo a cui hai dato l’incarico ha la fiducia e regge: la scelta delle consultazioni è stata solida.' }, failure: { credit: -2.5, stability: -1, text: 'Il governo a cui hai dato l’incarico non regge: la scelta delle consultazioni è messa in discussione.' } },
  scioglimento: { label: 'Scioglimento delle Camere', success: { credit: 1.5, stability: 0.5, text: 'Dopo il voto anticipato c’è un governo che ha la fiducia: lo scioglimento ha sbloccato la crisi.' }, failure: { credit: -2, stability: -1, text: 'Dopo il voto anticipato il governo non regge ancora: lo scioglimento non ha risolto la crisi.' } },
  grazia: { label: 'Grazia concessa', success: { credit: 1.5, stability: 0, text: 'La grazia è stata accolta senza polemiche: nessun caso di recidiva.' }, failure: { credit: -2.5, stability: -0.5, text: 'La persona graziata è tornata alla cronaca: la polemica ricade sul Colle.' } }
});
export const LEDGER_KEEP = 12;
