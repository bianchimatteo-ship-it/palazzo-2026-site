// The offices of Italian politics as the game models them: what each one is, the powers it gives, the duties it brings, the
// risks it carries and which ones cannot be held together. The state says who the player is (office-engine.js reads it from
// the institutions, the Parliament, the Government and the party); this file says what that means. Powers, duties and risks
// are rules of the game; the incompatibilities are simplified from art. 122 of the Constitution and from the laws on
// ineligibility and incompatibility, and every refusal says which rule it applies (referenceVerified: false).
import { DATA_SOURCES } from '../schema.js?v=20261009-4';

export const OFFICE_RULES_SOURCE = DATA_SOURCES.SIMULATION;

// Scopes group the offices by the body they belong to.
export const OFFICE_SCOPES = Object.freeze({ comune: 'Comune', provincia: 'Provincia', regione: 'Regione', parlamento: 'Parlamento', europa: 'Parlamento europeo', governo: 'Governo', partito: 'Partito', stato: 'Quirinale' });

// The powers an office can give (the vocabulary the roles panel and the actions share). `reason` is what a locked power asks for.
export const POWERS = Object.freeze({
  'council-vote': { label: 'Proposte, voti e trattative in consiglio o al Parlamento europeo: il tuo voto vale e può essere decisivo', reason: 'Serve un seggio in un consiglio comunale, provinciale o regionale, o al Parlamento europeo' },
  motions: { label: 'Presentare mozioni, ordini del giorno e atti di indirizzo', reason: 'Serve un seggio da consigliere (chi governa propone atti dell’esecutivo)' },
  questions: { label: 'Interrogazioni e controllo sull’esecutivo', reason: 'Serve un seggio da consigliere: assessori e capi dell’esecutivo non interrogano se stessi' },
  'delega-acts': { label: 'Proporre gli atti della tua delega (li adotta la giunta) e risponderne ogni sei settimane', reason: 'Serve una delega da assessore o da consigliere delegato' },
  giunta: { label: 'Giunta, assessori e rimpasti: comporre la giunta e trattare con i gruppi della maggioranza', reason: 'Solo il sindaco, il Presidente della Provincia o il Presidente di Regione' },
  budget: { label: 'Bilancio e priorità di spesa dell’ente', reason: 'Solo chi guida l’esecutivo' },
  taxes: { label: 'Tributi locali: aliquote del Comune o della Regione', reason: 'Solo il sindaco o il Presidente di Regione (la Provincia ha tributi propri molto limitati)' },
  'group-pull': { label: 'Portare il gruppo con il tuo voto: la linea si sposta verso la tua scelta (se forzi, ne paga la coesione)', reason: 'Serve essere capogruppo in un consiglio' },
  'assembly-of-mayors': { label: 'Convocare e guidare l’Assemblea dei sindaci della provincia', reason: 'Solo il Presidente della Provincia' },
  'regional-law': { label: 'Leggi regionali, sanità e programmazione di area vasta', reason: 'Serve un seggio nel consiglio regionale' },
  bills: { label: 'Leggi con contenuto, emendamenti, trattative con i gruppi', reason: 'Serve un seggio in Parlamento' },
  'group-line': { label: 'Guidare il gruppo parlamentare: linea di voto, disciplina e trattative con governo e alleati', reason: 'Solo il capogruppo' },
  'committee-chair': { label: 'Calendario e relazioni della tua commissione', reason: 'Serve un incarico di commissione' },
  'eu-committees': { label: 'Relazioni, emendamenti e voti nelle commissioni del Parlamento europeo', reason: 'Serve un seggio al Parlamento europeo' },
  'govern-dossier': { label: 'Dossier e crisi del tuo ministero', reason: 'Serve un incarico di governo' },
  'coalition-summit': { label: 'Vertici di maggioranza: tutelare i ministri del tuo partito e trattare con il premier', reason: 'Serve essere vicepresidente del Consiglio' },
  'govern-nation': { label: 'Indirizzo del governo, decreti, rimpasti, questione di fiducia', reason: 'Solo il Presidente del Consiglio' },
  'party-line': { label: 'Linea, organi, candidature e alleanze del partito', reason: 'Solo il segretario' }
});

// What each office is. tier orders the offices by weight (the legacy and the Hall of Fame use the same scale); kind is the
// kind of seat: a seat in a body, a delegation in an executive, the head of an executive, a leadership role, a post of government.
export const OFFICES = Object.freeze({
  'consigliere-comunale': {
    label: 'Consigliere comunale', scope: 'comune', kind: 'seat', tier: 38, powers: ['council-vote', 'motions', 'questions'],
    duties: ['Presenzia alle sedute e vota gli atti.', 'Porta in aula le richieste del quartiere e del partito locale.'],
    risks: ['Poca visibilità: senza iniziative resti un nome tra tanti.', 'Il voto contro la linea del gruppo si paga con il partito.']
  },
  'assessore-comunale': {
    label: 'Assessore comunale', scope: 'comune', kind: 'delega', tier: 40, powers: ['council-vote', 'delega-acts'],
    duties: ['Risponde di una delega della giunta: gli atti sono tuoi e i risultati pure.', 'Ogni sei settimane il servizio viene giudicato.'],
    risks: ['Se la delega va male il sindaco può togliertela.', 'Non puoi interrogare la giunta di cui fai parte.']
  },
  sindaco: {
    label: 'Sindaco', scope: 'comune', kind: 'executive', tier: 55, powers: ['council-vote', 'giunta', 'budget', 'taxes', 'delega-acts'],
    duties: ['Guida la giunta, tiene la maggioranza e presenta il bilancio.', 'Risponde ai cittadini di ogni servizio della città.'],
    risks: ['Bilancio respinto o maggioranza persa: sfiducia e scioglimento.', 'Le tasse alte costano consenso, i servizi che calano costano reputazione.', 'Il ruolo è incompatibile con un seggio in Parlamento o in Regione.']
  },
  'capogruppo-consiliare': {
    label: 'Capogruppo in consiglio', scope: 'comune', kind: 'leadership', tier: 46, powers: ['council-vote', 'motions', 'questions', 'group-pull'],
    duties: ['Tiene unito il gruppo in aula e tratta con la maggioranza o con l’opposizione.', 'Il tuo voto orienta quello dei tuoi.'],
    risks: ['Se forzi la linea il gruppo si logora; se il gruppo si spacca, la colpa è tua.']
  },
  'consigliere-provinciale': {
    label: 'Consigliere provinciale', scope: 'provincia', kind: 'seat', tier: 42, powers: ['council-vote', 'motions', 'questions'],
    duties: ['Eletto dai sindaci e dai consiglieri comunali: la tua forza è la rete degli amministratori.', 'Segue strade, scuole superiori e servizi ai comuni.'],
    risks: ['Il seggio dipende da quello nel comune: se lo perdi decade anche il provinciale.', 'Voto di secondo livello: poca visibilità presso i cittadini.']
  },
  'assessore-provinciale': {
    label: 'Assessore provinciale (consigliere delegato)', scope: 'provincia', kind: 'delega', tier: 44, powers: ['council-vote', 'delega-acts'],
    duties: ['Ha una delega del Presidente (viabilità, scuole, ambiente, pianificazione…).', 'I sindaci giudicano come spendi le poche risorse.'],
    risks: ['Il Presidente può ritirarti la delega.', 'Poche risorse: ogni intervento ne sacrifica un altro.']
  },
  'presidente-provincia': {
    label: 'Presidente della Provincia', scope: 'provincia', kind: 'executive', tier: 52, powers: ['council-vote', 'giunta', 'budget', 'delega-acts', 'assembly-of-mayors'],
    duties: ['È uno dei sindaci della provincia: guida l’ente di area vasta e l’Assemblea dei sindaci.', 'Decide la spesa di strade e scuole con risorse limitate.'],
    risks: ['Il mandato dipende dal ruolo di sindaco: se il Comune cambia, cambia anche lui.', 'Pochi soldi e molte aspettative: i sindaci si lamentano per primi.']
  },
  'consigliere-regionale': {
    label: 'Consigliere regionale', scope: 'regione', kind: 'seat', tier: 48, powers: ['council-vote', 'motions', 'questions', 'regional-law'],
    duties: ['Vota le leggi regionali e il bilancio, in commissione e in aula.', 'Fa da tramite tra territorio, partito regionale e giunta.'],
    risks: ['Incompatibile con le Camere, il Parlamento europeo e le cariche di governo (art. 122 Cost.).']
  },
  'assessore-regionale': {
    label: 'Assessore regionale', scope: 'regione', kind: 'delega', tier: 50, powers: ['council-vote', 'delega-acts', 'regional-law'],
    duties: ['Risponde di una grande delega (sanità, trasporti, attività produttive…).', 'Ogni sei settimane i risultati sono giudicati.'],
    risks: ['Una sanità che peggiora o un bilancio in rosso ricadono su di te.', 'Il Presidente può ritirare la delega.']
  },
  'presidente-regione': {
    label: 'Presidente di Regione', scope: 'regione', kind: 'executive', tier: 62, powers: ['council-vote', 'giunta', 'budget', 'taxes', 'delega-acts', 'regional-law'],
    duties: ['Guida la giunta, la sanità e il bilancio della Regione.', 'Tiene insieme una maggioranza di partiti diversi.'],
    risks: ['Crisi di maggioranza, bilancio respinto e sfiducia portano a nuove elezioni.', 'Il partito nazionale e i territori tirano in direzioni opposte.']
  },
  deputato: {
    label: 'Deputato', scope: 'parlamento', kind: 'seat', tier: 70, powers: ['bills', 'committee-chair'],
    duties: ['Vota leggi e fiducia, presenta proposte ed emendamenti.', 'Lavora nelle commissioni e con il gruppo.'],
    risks: ['Il dissenso dal gruppo ha un prezzo; la ricandidatura passa dal partito.', 'Incompatibile con le cariche regionali e con il Parlamento europeo.']
  },
  senatore: {
    label: 'Senatore', scope: 'parlamento', kind: 'seat', tier: 70, powers: ['bills', 'committee-chair'],
    duties: ['Vota leggi e fiducia: il Senato ha numeri stretti e pesa di più il singolo voto.', 'Lavora nelle commissioni e con il gruppo.'],
    risks: ['Maggioranze risicate: ogni voto è contato.', 'Incompatibile con le cariche regionali e con il Parlamento europeo.']
  },
  capogruppo: {
    label: 'Capogruppo', scope: 'parlamento', kind: 'leadership', tier: 71, powers: ['bills', 'group-line', 'committee-chair'],
    duties: ['Tiene unito il gruppo e porta la sua linea ai vertici di maggioranza o di opposizione: i tuoi emendamenti pesano di più.', 'Distribuisce incarichi e interventi in aula.'],
    risks: ['Se il gruppo si spacca la colpa è tua.', 'Ogni voto ribelle di un tuo deputato pesa sulla tua autorevolezza.']
  },
  eurodeputato: {
    label: 'Eurodeputato', scope: 'europa', kind: 'seat', tier: 68, powers: ['council-vote', 'eu-committees'],
    duties: ['Relazioni, emendamenti e voti in commissione e in plenaria.', 'Rappresenta il territorio a Bruxelles.'],
    risks: ['Lontano dal territorio e dal partito nazionale: visibilità bassa in Italia.', 'Incompatibile con il Parlamento nazionale, le cariche regionali e il governo.']
  },
  sottosegretario: {
    label: 'Sottosegretario', scope: 'governo', kind: 'government', tier: 72, powers: ['govern-dossier'],
    duties: ['Segue un dossier delegato dal ministro.', 'Risponde in aula e in commissione per il governo.'],
    risks: ['Segui la sorte del governo: se cade, cadi con lui.', 'Incompatibile con le cariche regionali e con la guida di un ente locale.']
  },
  ministro: {
    label: 'Ministro', scope: 'governo', kind: 'government', tier: 75, powers: ['govern-dossier'],
    duties: ['Guida un ministero: dossier, crisi e nomine.', 'Risponde al premier e al Parlamento.'],
    risks: ['Un dossier in crisi o uno scandalo ti espongono: il premier può sostituirti.', 'Incompatibile con le cariche regionali e con la guida di un ente locale.']
  },
  vicepremier: {
    label: 'Vicepresidente del Consiglio', scope: 'governo', kind: 'government', tier: 82, powers: ['govern-dossier', 'coalition-summit'],
    duties: ['Guida il tuo partito dentro il governo: tutela i ministri e tratta con il premier nei vertici.', 'Sostituisci il premier quando è assente.'],
    risks: ['Se il tuo partito rompe, il governo cade e ti porta con sé.', 'Il premier ti tiene d’occhio: troppa visibilità lo irrita.']
  },
  premier: {
    label: 'Presidente del Consiglio', scope: 'governo', kind: 'government', tier: 90, powers: ['govern-dossier', 'govern-nation'],
    duties: ['Guida il governo: programma, decreti, ministri e fiducia.', 'Tiene insieme una coalizione di partiti.'],
    risks: ['Crisi di governo e sfiducia: il mandato dura finché ha la maggioranza.']
  },
  segretario: {
    label: 'Segretario di partito', scope: 'partito', kind: 'leadership', tier: 60, powers: ['party-line'],
    duties: ['Guida il partito: linea, organi, candidature e alleanze.', 'Tiene insieme correnti e territori.'],
    risks: ['Sconfitte e scissioni mettono in discussione la leadership; le correnti chiedono un congresso.']
  },
  'presidente-repubblica': {
    label: 'Presidente della Repubblica', scope: 'stato', kind: 'state', tier: 100, powers: [],
    duties: ['Garante della Costituzione: consultazioni, scioglimento, promulgazione e nomine.'],
    risks: ['Ogni atto è giudicato come arbitro: la parzialità si paga in autorevolezza.']
  }
});

// Offices that cannot be held together. Each rule lists two groups: an office of the first and one of the second exclude each
// other. Whoever wins the new office keeps it and the other lapses (the option the law asks the elected to make); the
// candidacy says so beforehand. `block` rules instead stop the candidacy itself.
const REGIONAL = ['consigliere-regionale', 'assessore-regionale', 'presidente-regione'];
const PARLIAMENT = ['deputato', 'senatore', 'capogruppo'];
const GOVERNMENT = ['sottosegretario', 'ministro', 'vicepremier', 'premier'];
const LOCAL_HEADS = ['sindaco', 'presidente-provincia'];
const LOCAL_EXECUTIVE = ['sindaco', 'assessore-comunale', 'presidente-provincia', 'assessore-provinciale'];

export const INCOMPATIBILITIES = Object.freeze([
  { id: 'camere-regione', a: PARLIAMENT, b: REGIONAL, rule: 'Art. 122 della Costituzione: non si appartiene insieme a un Consiglio o a una Giunta regionale e a una delle Camere.' },
  { id: 'camere-europa', a: PARLIAMENT, b: ['eurodeputato'], rule: 'Il mandato di eurodeputato è incompatibile con quello di parlamentare nazionale.' },
  { id: 'regione-europa', a: REGIONAL, b: ['eurodeputato'], rule: 'Art. 122 della Costituzione: non si appartiene insieme a un Consiglio o a una Giunta regionale e al Parlamento europeo.' },
  { id: 'due-camere', a: ['deputato'], b: ['senatore'], rule: 'Non si siede in due Camere insieme: la nuova elezione sostituisce il vecchio seggio.' },
  { id: 'governo-europa', a: GOVERNMENT, b: ['eurodeputato'], rule: 'Un membro del governo di uno Stato membro non può essere eurodeputato.' },
  { id: 'governo-regione', a: GOVERNMENT, b: REGIONAL, rule: 'Regola di gioco semplificata: chi ha un incarico di governo non ricopre una carica regionale.' },
  { id: 'governo-enti', a: GOVERNMENT, b: LOCAL_EXECUTIVE, rule: 'Regola di gioco semplificata: chi ha un incarico di governo non guida un ente locale.' },
  { id: 'camere-capi', a: PARLIAMENT, b: LOCAL_HEADS, rule: 'Regola di gioco semplificata, ispirata alle incompatibilità per i grandi comuni: sindaco e presidente di Provincia non si cumulano con il mandato parlamentare.' },
  { id: 'regione-capi', a: REGIONAL, b: LOCAL_HEADS, rule: 'Regola di gioco semplificata: una carica regionale non si cumula con quella di sindaco o di presidente di Provincia.' },
  { id: 'regione-giunte', a: ['presidente-regione', 'assessore-regionale'], b: ['assessore-comunale', 'assessore-provinciale'], rule: 'Regola di gioco semplificata: un assessore regionale non è anche assessore di un altro ente.' }
]);

// What an office needs in order to exist (a seat that hangs from another one): the held offices that make it possible.
export const OFFICE_BASES = Object.freeze({
  'consigliere-provinciale': { anyOf: ['sindaco', 'consigliere-comunale', 'assessore-comunale'], rule: 'Il consiglio provinciale è eletto dai sindaci e dai consiglieri comunali della provincia (legge 56/2014): serve un seggio in un comune.' },
  'assessore-provinciale': { anyOf: ['consigliere-provinciale'], rule: 'Il consigliere delegato è scelto dal Presidente tra i consiglieri provinciali.' },
  'presidente-provincia': { anyOf: ['sindaco'], rule: 'Il Presidente della Provincia è scelto tra i sindaci della provincia (legge 56/2014): serve essere sindaco.' },
  capogruppo: { anyOf: ['deputato', 'senatore'], rule: 'Il capogruppo è un parlamentare del gruppo.' },
  vicepremier: { anyOf: ['ministro'], rule: 'La vicepresidenza del Consiglio si accompagna a un ministero.' }
});

// How many months of the mayor's mandate the Presidente della Provincia must still have in front of him (law 56/2014).
export const PROVINCIAL_PRESIDENT_MIN_MONTHS = 18;

// Offices a member of the Government may not run for while in office (the candidacy is stopped, not resolved afterwards).
export const GOVERNMENT_CANDIDACY_BLOCK = Object.freeze(['comunale', 'provinciale', 'regionale', 'europee']);

// The office each election role leads to.
export const OFFICE_OF_CANDIDACY = Object.freeze({
  comunale: { sindaco: 'sindaco', consigliere: 'consigliere-comunale' },
  provinciale: { presidente: 'presidente-provincia', consigliere: 'consigliere-provinciale' },
  regionale: { presidente: 'presidente-regione', consigliere: 'consigliere-regionale' },
  politiche: { deputato: 'deputato', uninominale: 'deputato', senatore: 'senatore' },
  europee: { eurodeputato: 'eurodeputato' }
});

// The delega of an assessore or of a consigliere delegato: the areas of the service it covers (the same areas as the acts
// and the indicators). 'Bilancio' is judged on the margin of the budget, not on a service.
export const PORTFOLIO_AREAS = Object.freeze({
  comune: {
    Bilancio: ['pa'], 'Lavori pubblici': ['infrastrutture', 'casa'], 'Politiche sociali': ['welfare', 'giovani', 'scuola'], Urbanistica: ['casa', 'infrastrutture'],
    Mobilità: ['trasporti'], 'Cultura e turismo': ['cultura', 'turismo', 'sport'], 'Sicurezza urbana': ['sicurezza'], Ambiente: ['ambiente']
  },
  provincia: {
    'Viabilità e trasporti': ['infrastrutture', 'trasporti'], 'Edilizia scolastica': ['scuola'], 'Ambiente e rifiuti': ['ambiente'],
    'Pianificazione del territorio': ['casa', 'autonomie'], 'Sviluppo economico': ['industria', 'turismo'], 'Servizi ai comuni': ['pa', 'autonomie']
  },
  regione: {
    Sanità: ['sanita'], Bilancio: ['autonomie'], Trasporti: ['trasporti', 'infrastrutture'], 'Attività produttive': ['industria', 'lavoro', 'energia'],
    Ambiente: ['ambiente', 'energia'], Agricoltura: ['agricoltura'], Welfare: ['welfare', 'casa'], 'Istruzione e formazione': ['scuola', 'lavoro']
  }
});

// The review of a delega: every REVIEW_WEEKS weeks the service is judged; two bad reviews in a row, with an executive that does
// not hold, take the delega away.
export const DELEGA_RULES = Object.freeze({ reviewWeeks: 6, goodScore: 58, goodDrift: -2, badScore: 42, badDrift: -4, strikesToRevoke: 2, intensityCap: 2 });
