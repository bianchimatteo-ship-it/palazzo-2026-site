// The acts of the local institutions as the game models them: what each kind of act is for, which body adopts it, the
// steps it goes through, the majority it needs, what it changes (services, budget, taxes) and what happens when it is
// approved or rejected. Rules of the game drawn from the TUEL (d.lgs. 267/2000) for the comuni and from the Constitution
// (artt. 117, 121, 123, 126) and the regional statutes for the regioni, simplified; every number is a game mechanic
// (source: simulation), never a statistic.
import { AREA_BY_ID } from './policy-rules.js?v=20261003-2';

// ---------- majorities ----------
export const QUORUMS = Object.freeze({
  votanti: { id: 'votanti', label: 'Maggioranza dei votanti', short: 'più sì che no', detail: 'Passa se i sì superano i no: astenuti e assenti non contano per nessuna delle due parti. In aula deve esserci il numero legale.' },
  componenti: { id: 'componenti', label: 'Maggioranza assoluta dei componenti', short: 'metà più uno dei seggi', detail: 'Servono i sì di metà più uno di tutti i componenti, presenti o no: assenze e astensioni pesano come i no.' },
  dueterzi: { id: 'dueterzi', label: 'Maggioranza dei due terzi dei componenti', short: 'due terzi dei seggi', detail: 'Maggioranza qualificata, riservata alle regole fondamentali dell’ente.' },
  giunta: { id: 'giunta', label: 'Maggioranza della Giunta', short: 'decide la Giunta', detail: 'Delibera la Giunta in seduta collegiale, a maggioranza dei suoi componenti: il consiglio non vota.' },
  nessuno: { id: 'nessuno', label: 'Nessun voto', short: 'risponde l’esecutivo', detail: 'Non si vota: l’esecutivo risponde in aula o per iscritto.' }
});
// The members who must be present (voting or abstaining) for a vote to be valid: the regolamento of the comune asks for
// half of the councillors in the first call and a third in the second (never less than a third, art. 38 TUEL); the
// regional statutes ask for the majority of the members; the European Parliament for a third.
export function legalNumber(kind, seats, secondCall = false) {
  if (kind === 'comune' || kind === 'provincia') return secondCall ? Math.ceil(seats / 3) : Math.ceil(seats / 2);
  if (kind === 'regione') return Math.floor(seats / 2) + 1;
  return Math.ceil(seats / 3);
}
// The yes an act needs under a quorum (for the majority of the voters it depends on the no: null).
export function neededYes(quorum, seats) {
  if (quorum === 'componenti') return Math.floor(seats / 2) + 1;
  if (quorum === 'dueterzi') return Math.ceil(seats * 2 / 3);
  return null;
}

// ---------- the city: the services the comune answers for ----------
// Each indicator (0-100) moves with the acts of the comune on its themes; `region` is the indicator of the society
// simulation that the city contributes to (a share of the effect), `segments` the citizens who feel it most.
export const CITY_INDICATORS = Object.freeze([
  { id: 'sociale', label: 'Servizi sociali ed educativi', icon: 'heart', areas: ['welfare', 'famiglia', 'scuola', 'demografia'], region: 'servizi', segments: ['fragili', 'famiglie', 'anziani'] },
  { id: 'sicurezza', label: 'Sicurezza urbana', icon: 'shield', areas: ['sicurezza', 'giustizia', 'immigrazione'], region: 'sicurezza', segments: ['anziani', 'famiglie'] },
  { id: 'ambiente', label: 'Ambiente, verde e rifiuti', icon: 'leaf', areas: ['ambiente', 'energia', 'agricoltura'], region: 'ambiente', segments: ['giovani', 'famiglie'] },
  { id: 'mobilita', label: 'Mobilità e trasporto pubblico', icon: 'route', areas: ['trasporti'], region: 'trasporti', segments: ['giovani', 'famiglie'] },
  { id: 'territorio', label: 'Casa e urbanistica', icon: 'town', areas: ['casa'], region: 'infrastrutture', segments: ['giovani', 'fragili'] },
  { id: 'opere', label: 'Strade ed edifici pubblici', icon: 'bridge', areas: ['infrastrutture'], region: 'infrastrutture', segments: ['imprese', 'famiglie'] },
  { id: 'cultura', label: 'Cultura, turismo e commercio', icon: 'book', areas: ['cultura', 'turismo', 'commercio', 'industria', 'economia'], region: 'economia', segments: ['imprese', 'giovani'] },
  { id: 'sport', label: 'Sport e giovani', icon: 'trophy', areas: ['sport', 'giovani'], region: null, segments: ['giovani', 'famiglie'] },
  { id: 'uffici', label: 'Uffici e servizi digitali', icon: 'ministry', areas: ['pa', 'digitale', 'autonomie', 'finanze', 'fisco'], region: 'servizi', segments: ['imprese', 'famiglie'] }
]);
export const cityIndicatorOf = area => CITY_INDICATORS.find(item => item.areas.includes(area)) ?? CITY_INDICATORS.at(-1);
// A city is a part of its region: this share of what its acts change reaches the regional indicators.
export const CITY_SHARE_OF_REGION = 0.15;
// A province is a part of its region too, a larger one than a city: this share of what its acts change reaches the regional indicators.
export const PROVINCE_SHARE_OF_REGION = 0.4;
// The regione moves the indicators of its territory (those of the society simulation): the areas that have a regional
// indicator use it, the others the closest ones.
const REGIONAL_FALLBACK = Object.freeze({
  agricoltura: { economia: 0.6, ambiente: 0.2 }, turismo: { economia: 0.7 }, casa: { servizi: 0.6, infrastrutture: 0.3 }, cultura: { istruzione: 0.3, economia: 0.3 },
  energia: { ambiente: 0.5, economia: 0.4 }, autonomie: { servizi: 0.6 }, commercio: { economia: 0.6 }, famiglia: { servizi: 0.7 }, giovani: { occupazione: 0.4, istruzione: 0.3 },
  sport: { servizi: 0.3 }, digitale: { servizi: 0.5, economia: 0.3 }, fisco: { economia: 0.3 }, finanze: { servizi: 0.3 }
});
export const regionalWeights = area => AREA_BY_ID[area]?.regional ?? REGIONAL_FALLBACK[area] ?? { servizi: 0.5 };

// ---------- positions ----------
// Where a typical measure on a theme sits between left (−3) and right (+3), and how much the theme brings the groups
// together (0 divides, 1 unites). Rules of the game for the simulated groups, never the position of a real party.
export const AREA_LEANS = Object.freeze({
  sicurezza: 1.4, immigrazione: 1.6, fisco: 1.5, famiglia: 0.8, difesa: 1.5, autonomie: 1, industria: 0.8, commercio: 0.9, turismo: 0.5, agricoltura: 0.7,
  infrastrutture: 0.4, energia: 0.2, economia: 0.6, pa: 0.3, digitale: 0, giustizia: 0.6, demografia: 0.8, finanze: 0.5, casa: -0.9, welfare: -1.3,
  sanita: -0.8, scuola: -0.7, lavoro: -0.9, ambiente: -1.4, trasporti: -0.6, cultura: -0.5, giovani: -0.4, sport: 0.1, cittadinanza: -1.6, universita: -0.5,
  europa: -0.3, esteri: 0, mezzogiorno: -0.3, pensioni: -0.2
});
export const AREA_BREADTH = Object.freeze({
  cultura: 0.55, sport: 0.65, infrastrutture: 0.5, scuola: 0.5, sanita: 0.5, trasporti: 0.45, turismo: 0.5, pa: 0.5, digitale: 0.55, agricoltura: 0.45,
  welfare: 0.35, casa: 0.35, ambiente: 0.3, sicurezza: 0.3, commercio: 0.4, lavoro: 0.4, giovani: 0.5, industria: 0.4, energia: 0.4, autonomie: 0.3,
  fisco: 0.2, immigrazione: 0.1, finanze: 0.2, famiglia: 0.45, economia: 0.4, europa: 0.35, difesa: 0.3, esteri: 0.4
});

// ---------- the kinds of act ----------
// organ: who adopts it (consiglio: the council votes; giunta: the executive decides; esecutivo: it answers). quorum: see
// QUORUMS. politics: how much the vote is about government and opposition (0..1); content: how much the text itself
// counts; breadth: how much the kind of act widens (or narrows) the agreement on its theme. effect, cost, phase, lasting:
// what an approved act of medium intensity does (points of the indicators, points of budget margin, weeks to take
// effect, whether it stays). weight: how often the executive brings it. player: who can propose it in the game.
const T = (id, spec) => Object.freeze({ id, organ: 'consiglio', quorum: 'votanti', politics: 0.4, content: 1, breadth: 0, effect: 0, cost: 0, phase: 8, lasting: true, weight: 0, player: [], ...spec });
const COMUNE = [
  T('delibera-giunta', {
    label: 'Deliberazione di Giunta', organ: 'giunta', quorum: 'giunta', reference: 'art. 48 TUEL', proposers: 'Sindaco e assessori',
    function: 'Atti di governo non riservati al consiglio: iniziative, contributi, progetti, organizzazione dei servizi.',
    iter: ['Proposta dell’assessore', 'Pareri di regolarità tecnica e contabile (art. 49 TUEL)', 'Seduta di Giunta'],
    modifies: 'Un servizio del tema, in poche settimane; spesa contenuta.',
    approved: 'Effetto rapido sul servizio, che poi si attenua; il costo pesa sul bilancio.', rejected: 'La giunta si divide: perde stabilità e il problema resta.',
    politics: 0.4, effect: 1.8, cost: 1.5, phase: 4, lasting: false, weight: 0.24, player: ['leader']
  }),
  T('tariffe', {
    label: 'Tariffe dei servizi', organ: 'giunta', quorum: 'giunta', reference: 'art. 42 e 48 TUEL', proposers: 'Giunta, nel quadro della disciplina generale votata dal consiglio',
    function: 'I prezzi dei servizi a domanda individuale: autobus e sosta, mense e nidi, impianti sportivi, musei.', areas: ['trasporti', 'scuola', 'sport', 'cultura', 'welfare'],
    iter: ['Proposta dell’assessore', 'Parere contabile', 'Seduta di Giunta'],
    modifies: 'Le entrate del bilancio e la soddisfazione di chi usa il servizio.',
    approved: 'Aumento: più entrate, utenti scontenti. Riduzione: utenti soddisfatti, meno entrate.', rejected: 'Tariffe invariate; la giunta perde un po’ di stabilità.',
    politics: 0.5, content: 0.7, effect: 0.5, revenue: 3, phase: 2, weight: 0.05, player: ['leader'], variants: ['aumento', 'riduzione']
  }),
  T('tributi', {
    label: 'Tributi comunali', reference: 'IMU, addizionale IRPEF e TARI: aliquote e tariffe deliberate dal consiglio', proposers: 'Giunta',
    function: 'Le aliquote dell’IMU e dell’addizionale comunale IRPEF e le tariffe della TARI, di norma insieme al bilancio.', areas: ['fisco'],
    iter: ['Proposta della giunta', 'Parere dei revisori dei conti', 'Commissione bilancio', 'Voto in aula'],
    modifies: 'La pressione fiscale locale e il margine del bilancio.',
    approved: 'Aumento: +12 di margine, famiglie e imprese scontente, popolarità di chi governa in calo. Riduzione: −12 di margine e cittadini più soddisfatti.', rejected: 'Aliquote invariate: se servivano entrate, il bilancio resta stretto.',
    politics: 0.75, content: 0.8, revenue: 12, phase: 1, weight: 0.03, player: ['leader'], variants: ['aumento', 'riduzione']
  }),
  T('regolamento', {
    label: 'Regolamento comunale', reference: 'art. 7 e 42 TUEL', proposers: 'Giunta e consiglieri',
    function: 'Norme stabili su un servizio o un’attività: polizia urbana, rifiuti, edilizia, commercio, servizi sociali, impianti sportivi.',
    iter: ['Proposta', 'Commissione consiliare', 'Voto in aula', 'Pubblicazione all’albo pretorio'],
    modifies: 'Le regole di un servizio: effetto moderato e duraturo, quasi a costo zero.',
    approved: 'Il servizio migliora a poco a poco e resta migliorato.', rejected: 'Restano le regole vecchie; chi l’ha proposto perde credibilità.',
    politics: 0.35, effect: 2.2, cost: 0.3, phase: 8, weight: 0.12, player: ['leader', 'consigliere']
  }),
  T('piano', {
    label: 'Piano o programma di settore', reference: 'art. 42 TUEL', proposers: 'Giunta',
    function: 'Piani e programmi comunali: mobilità sostenibile, verde urbano, servizi sociali di zona, protezione civile, commercio.',
    iter: ['Proposta della giunta', 'Commissione consiliare', 'Voto in aula', 'Attuazione in più mesi'],
    modifies: 'Un intero settore, con effetti ampi ma lenti e una spesa pluriennale.',
    approved: 'Il settore migliora in modo stabile nei mesi successivi.', rejected: 'Il settore resta senza programmazione e continua a peggiorare; la giunta ne esce indebolita.',
    politics: 0.4, effect: 3.2, cost: 2.5, phase: 16, weight: 0.09, player: ['leader']
  }),
  T('urbanistica', {
    label: 'Pianificazione urbanistica', reference: 'art. 42 TUEL e leggi urbanistiche regionali', proposers: 'Giunta',
    function: 'Varianti al piano urbanistico e piani attuativi: dove e che cosa si può costruire.', areas: ['casa'],
    iter: ['Adozione in consiglio', 'Deposito e osservazioni dei cittadini (8 settimane)', 'Controdeduzioni e approvazione definitiva'],
    modifies: 'Casa e urbanistica; il consumo di suolo e il verde; gli oneri di urbanizzazione.',
    approved: 'Espansione: più case e oneri (+margine) ma meno verde. Rigenerazione: aree dismesse recuperate, casa e ambiente migliorano, con una spesa.', rejected: 'Il piano decade: resta tutto com’è, delusi costruttori e chi cerca casa.',
    politics: 0.5, breadth: -0.15, effect: 3, cost: 0.5, phase: 20, weight: 0.05, player: ['leader'], variants: ['espansione', 'rigenerazione'], readings: 'adozione'
  }),
  T('opere', {
    label: 'Opere pubbliche', reference: 'programma triennale dei lavori pubblici, art. 42 TUEL', proposers: 'Giunta',
    function: 'Il programma dei lavori e i progetti delle opere: strade, scuole, impianti sportivi, edifici pubblici.', areas: ['infrastrutture', 'scuola', 'sport', 'trasporti', 'casa', 'cultura', 'ambiente'],
    iter: ['Progetto e copertura finanziaria', 'Commissione lavori pubblici', 'Voto in aula', 'Gara e cantiere'],
    modifies: 'Le strutture del tema: effetto forte ma lento (i cantieri), spesa alta.',
    approved: 'Cantieri e poi strutture migliori; lavoro per le imprese del territorio.', rejected: 'L’opera salta e i fondi dedicati vanno persi: la struttura continua a invecchiare.',
    politics: 0.35, breadth: 0.15, effect: 4.5, cost: 6, phase: 26, weight: 0.1, player: ['leader']
  }),
  T('servizi', {
    label: 'Servizi pubblici locali', reference: 'art. 42 TUEL', proposers: 'Giunta e consiglieri',
    function: 'Istituzione, organizzazione e affidamento dei servizi: trasporto pubblico, rifiuti, asili nido, assistenza domiciliare.',
    iter: ['Proposta', 'Commissione consiliare', 'Voto in aula', 'Affidamento e avvio del servizio'],
    modifies: 'La qualità di un servizio, con una spesa corrente.',
    approved: 'Il servizio migliora in poche settimane e resta migliorato.', rejected: 'Il servizio resta com’è; chi lo usa protesta.',
    politics: 0.4, effect: 3.5, cost: 3.5, phase: 10, weight: 0.11, player: ['leader', 'consigliere']
  }),
  T('convenzione', {
    label: 'Convenzione tra enti', reference: 'art. 30 TUEL', proposers: 'Giunta',
    function: 'Convenzioni con altri comuni, con la Regione o con l’ASL: polizia locale associata, servizi sociali, rifiuti, trasporti.',
    iter: ['Accordo tra gli enti', 'Commissione', 'Voto in aula nei consigli interessati'],
    modifies: 'Un servizio gestito insieme ad altri: migliora e fa risparmiare.',
    approved: 'Servizio più efficiente e qualche risparmio (+margine).', rejected: 'Il servizio resta frammentato e più caro.',
    politics: 0.2, breadth: 0.2, effect: 2, cost: -1.5, phase: 8, weight: 0.06, player: ['leader']
  }),
  T('variazione', {
    label: 'Variazione di bilancio', reference: 'art. 175 TUEL', proposers: 'Giunta',
    function: 'Sposta risorse tra i programmi durante l’anno; a luglio l’assestamento generale.',
    iter: ['Proposta della giunta', 'Parere dei revisori', 'Commissione bilancio', 'Voto in aula'],
    modifies: 'Le risorse di un programma: più fondi al tema, meno margine.',
    approved: 'Il tema riceve fondi e migliora per qualche mese.', rejected: 'Le risorse restano ferme e la giunta perde stabilità.',
    politics: 0.6, content: 0.6, effect: 2, cost: 3, phase: 6, lasting: false, weight: 0.08, player: ['leader']
  }),
  T('bilancio', {
    label: 'Bilancio di previsione', reference: 'artt. 151, 162 e 141 TUEL', proposers: 'Giunta',
    function: 'Entrate e spese dell’anno: va approvato entro il 31 dicembre (termine spesso prorogato dallo Stato).', areas: ['finanze'],
    iter: ['Proposta della giunta', 'Parere dei revisori dei conti', 'Commissione bilancio', 'Voto in aula'],
    modifies: 'Le risorse dell’anno (margine) e la possibilità di spendere.',
    approved: 'Nuove risorse per l’anno e una giunta più solida.', rejected: 'Esercizio provvisorio: solo spese obbligatorie e servizi in calo; al secondo no il Prefetto nomina un commissario e il consiglio è sciolto.',
    politics: 1, content: 0.25
  }),
  T('statuto', {
    label: 'Statuto comunale', quorum: 'dueterzi', reference: 'art. 6 TUEL', proposers: 'Giunta e consiglieri',
    function: 'La carta fondamentale del comune: organi, partecipazione dei cittadini, referendum.', areas: ['pa'],
    iter: ['Proposta', 'Commissione statuto', 'Voto con i due terzi dei consiglieri', 'Se non bastano: due voti a maggioranza assoluta entro 30 giorni'],
    modifies: 'Le regole della partecipazione: meno tensione con i cittadini, uffici più trasparenti.',
    approved: 'Più partecipazione: cala la pressione sull’amministrazione.', rejected: 'Tutto come prima; la maggioranza ne esce indebolita.',
    politics: 0.3, content: 0.6, breadth: 0.25, effect: 1, phase: 8, weight: 0.01, player: ['leader']
  }),
  T('mozione', {
    label: 'Mozione', reference: 'art. 43 TUEL', proposers: 'Consiglieri e gruppi consiliari',
    function: 'Atto di indirizzo: il consiglio impegna il sindaco e la giunta ad agire su un tema.',
    iter: ['Deposito', 'Calendario dei capigruppo', 'Discussione e voto in aula'],
    modifies: 'Da sola non spende e non cambia regole: crea un impegno per la giunta.',
    approved: 'La giunta deve portare un atto sul tema entro 8 settimane; se non lo fa perde stabilità e credibilità.', rejected: 'Nessun impegno; chi l’ha presentata ne fa una bandiera (più pressione se è dell’opposizione).',
    politics: 0.6, content: 0.8, breadth: -0.05, player: ['consigliere']
  }),
  T('interrogazione', {
    label: 'Interrogazione', organ: 'esecutivo', quorum: 'nessuno', reference: 'art. 43 TUEL', proposers: 'Consiglieri',
    function: 'Domanda al sindaco o a un assessore sull’attività dell’amministrazione: la risposta arriva entro 30 giorni.',
    iter: ['Deposito', 'Risposta in aula o scritta'],
    modifies: 'Il controllo sulla giunta: la risposta dipende da come va il servizio.',
    approved: 'Servizio in difficoltà: risposta debole, la giunta perde stabilità e chi ha chiesto guadagna visibilità.', rejected: 'Servizio in salute: la giunta risponde bene e la pressione cala.',
    politics: 0, player: ['consigliere']
  }),
  T('sfiducia', {
    label: 'Mozione di sfiducia', quorum: 'componenti', reference: 'art. 52 TUEL', proposers: 'Almeno due quinti dei consiglieri',
    function: 'Sfiducia al sindaco: motivata, discussa tra 10 e 30 giorni dopo il deposito, votata per appello nominale.', areas: ['pa'],
    iter: ['Deposito con le firme', 'Attesa di almeno 10 giorni', 'Voto per appello nominale'],
    modifies: 'La sopravvivenza della giunta e del consiglio.',
    approved: 'Sindaco e giunta decadono: consiglio sciolto, arriva un commissario, si torna al voto (art. 141 TUEL).', rejected: 'Il sindaco resta e si rafforza; l’opposizione perde credibilità.',
    politics: 1, content: 0
  })
];
const REGIONE = [
  T('legge', {
    label: 'Legge regionale', reference: 'artt. 117 e 121 Cost.', proposers: 'Giunta, consiglieri, enti locali e cittadini',
    function: 'Le leggi nelle materie della Regione: sanità, trasporti, formazione e lavoro, agricoltura, turismo, territorio.',
    iter: ['Deposito', 'Commissione consiliare referente', 'Voto in aula articolo per articolo e finale', 'Promulgazione del Presidente e pubblicazione sul Bollettino'],
    modifies: 'Il servizio o il settore regionale del tema, in modo ampio e duraturo; spesa rilevante.',
    approved: 'Nei mesi successivi migliorano gli indicatori regionali del tema.', rejected: 'Il settore resta com’è; il proponente perde credibilità.',
    politics: 0.45, effect: 3.5, cost: 4, phase: 16, weight: 0.3, player: ['leader', 'consigliere']
  }),
  T('regolamento', {
    label: 'Regolamento regionale', organ: 'giunta', quorum: 'giunta', reference: 'art. 121 Cost. e statuto regionale', proposers: 'Giunta, dopo il parere della commissione consiliare',
    function: 'Norme di attuazione delle leggi regionali: le approva di norma la Giunta, le emana il Presidente.',
    iter: ['Proposta dell’assessorato', 'Parere della commissione consiliare', 'Approvazione in Giunta', 'Emanazione del Presidente'],
    modifies: 'Come funziona un servizio già previsto dalla legge: effetto moderato, quasi a costo zero.',
    approved: 'Il servizio funziona meglio e resta migliorato.', rejected: 'Senza attuazione la legge resta sulla carta; la Giunta perde stabilità.',
    politics: 0.3, effect: 1.6, cost: 0.3, phase: 8, weight: 0.08, player: ['leader'], committeeOpinion: true
  }),
  T('delibera-giunta', {
    label: 'Deliberazione della Giunta regionale', organ: 'giunta', quorum: 'giunta', reference: 'art. 121 Cost.', proposers: 'Presidente e assessori',
    function: 'Atti di amministrazione: rete ospedaliera e liste d’attesa, contratti di servizio dei treni, bandi per imprese, agricoltura e formazione.',
    iter: ['Proposta dell’assessorato', 'Istruttoria degli uffici', 'Seduta di Giunta'],
    modifies: 'Un servizio regionale del tema, in poche settimane.',
    approved: 'Effetto rapido sul servizio, che poi si attenua; spesa a carico del bilancio regionale.', rejected: 'La Giunta si divide e perde stabilità.',
    politics: 0.4, effect: 2, cost: 2, phase: 6, lasting: false, weight: 0.24, player: ['leader']
  }),
  T('piano', {
    label: 'Piano o programma regionale', reference: 'leggi regionali di settore', proposers: 'Giunta',
    function: 'La programmazione di un settore: piano sanitario, piano dei trasporti, piano rifiuti, sviluppo rurale, lavoro.',
    iter: ['Proposta della Giunta', 'Commissione consiliare', 'Voto in aula', 'Attuazione pluriennale'],
    modifies: 'Un intero settore regionale: effetti ampi e lenti, spesa pluriennale.',
    approved: 'Il settore migliora in modo stabile.', rejected: 'Il settore resta senza programmazione; la Giunta perde stabilità.',
    politics: 0.45, effect: 3.5, cost: 3, phase: 20, weight: 0.12, player: ['leader']
  }),
  T('tributi', {
    label: 'Tributi regionali', reference: 'addizionale regionale IRPEF e IRAP, nei limiti delle leggi statali', proposers: 'Giunta',
    function: 'L’addizionale regionale all’IRPEF e le aliquote IRAP: le fissa il consiglio con legge.', areas: ['fisco'],
    iter: ['Proposta di legge della Giunta', 'Commissione bilancio', 'Voto in aula'],
    modifies: 'La pressione fiscale regionale e il margine del bilancio.',
    approved: 'Aumento: +10 di margine, famiglie e imprese scontente. Riduzione: −10 di margine, cittadini più soddisfatti.', rejected: 'Aliquote invariate.',
    politics: 0.75, content: 0.8, revenue: 10, phase: 1, weight: 0.03, player: ['leader'], variants: ['aumento', 'riduzione']
  }),
  T('variazione', {
    label: 'Variazione di bilancio', reference: 'd.lgs. 118/2011', proposers: 'Giunta',
    function: 'Assestamento e variazioni del bilancio regionale: sposta risorse tra le missioni durante l’anno.',
    iter: ['Proposta di legge della Giunta', 'Commissione bilancio', 'Voto in aula'],
    modifies: 'Le risorse di una missione: più fondi al tema, meno margine.',
    approved: 'Il tema riceve fondi e migliora per qualche mese.', rejected: 'Le risorse restano ferme e la Giunta perde stabilità.',
    politics: 0.6, content: 0.6, effect: 2, cost: 3, phase: 6, lasting: false, weight: 0.08, player: ['leader']
  }),
  T('bilancio', {
    label: 'Legge di bilancio regionale', reference: 'd.lgs. 118/2011', proposers: 'Giunta',
    function: 'Entrate e spese della Regione per l’anno, con la legge di stabilità: entro il 31 dicembre, altrimenti esercizio provvisorio autorizzato per legge (al massimo quattro mesi).', areas: ['finanze'],
    iter: ['Proposta della Giunta', 'Parere del collegio dei revisori', 'Commissione bilancio', 'Voto in aula'],
    modifies: 'Le risorse dell’anno e la possibilità di spendere.',
    approved: 'Nuove risorse per l’anno e una Giunta più solida.', rejected: 'Esercizio provvisorio: niente nuove spese, i servizi peggiorano e la Giunta si indebolisce finché il bilancio non passa.',
    politics: 1, content: 0.25
  }),
  T('statuto', {
    label: 'Statuto regionale', quorum: 'componenti', reference: 'art. 123 Cost.', proposers: 'Giunta e consiglieri',
    function: 'La legge fondamentale della Regione: due deliberazioni a maggioranza assoluta a distanza di almeno due mesi, poi un possibile referendum.', areas: ['autonomie'],
    iter: ['Commissione statuto', 'Prima deliberazione a maggioranza assoluta', 'Almeno due mesi di attesa', 'Seconda deliberazione a maggioranza assoluta'],
    modifies: 'Le regole della Regione e della partecipazione.',
    approved: 'Regole più chiare e partecipate: cala la pressione sull’istituzione.', rejected: 'Tutto come prima; la maggioranza ne esce indebolita.',
    politics: 0.3, content: 0.6, breadth: 0.25, effect: 1, phase: 8, weight: 0.01, readings: 'doppia', player: ['leader']
  }),
  T('mozione', {
    label: 'Mozione', reference: 'regolamento interno del consiglio regionale', proposers: 'Consiglieri e gruppi',
    function: 'Atto di indirizzo: il consiglio impegna il Presidente e la Giunta ad agire su un tema.',
    iter: ['Deposito', 'Calendario dei capigruppo', 'Discussione e voto in aula'],
    modifies: 'Da sola non spende e non cambia leggi: crea un impegno per la Giunta.',
    approved: 'La Giunta deve portare un atto sul tema entro 8 settimane; se non lo fa perde stabilità.', rejected: 'Nessun impegno; chi l’ha presentata ne fa una bandiera.',
    politics: 0.6, content: 0.8, breadth: -0.05, player: ['consigliere']
  }),
  T('interrogazione', {
    label: 'Interrogazione', organ: 'esecutivo', quorum: 'nessuno', reference: 'regolamento interno del consiglio regionale', proposers: 'Consiglieri',
    function: 'Domanda alla Giunta sull’attività della Regione: risposta in aula o per iscritto.',
    iter: ['Deposito', 'Risposta dell’assessore'],
    modifies: 'Il controllo sulla Giunta: la risposta dipende da come va il settore.',
    approved: 'Settore in difficoltà: risposta debole, la Giunta perde stabilità e chi ha chiesto guadagna visibilità.', rejected: 'Settore in salute: la Giunta risponde bene e la pressione cala.',
    politics: 0, player: ['consigliere']
  }),
  T('sfiducia', {
    label: 'Mozione di sfiducia', quorum: 'componenti', reference: 'art. 126 Cost.', proposers: 'Almeno un quinto dei consiglieri',
    function: 'Sfiducia al Presidente della Regione: motivata, votata per appello nominale non prima di tre giorni dal deposito.', areas: ['autonomie'],
    iter: ['Deposito con le firme', 'Attesa di almeno tre giorni', 'Voto per appello nominale'],
    modifies: 'La sopravvivenza della Giunta e del consiglio.',
    approved: 'Il Presidente cessa, la Giunta si dimette e il consiglio è sciolto: nuove elezioni.', rejected: 'Il Presidente resta e si rafforza.',
    politics: 1, content: 0
  })
];
// The provincia (law 56/2014): an ente di area vasta with its own organs — the President, the council and the assembly of the
// mayors — chosen by the mayors and the municipal councillors of the province, not by the citizens. It looks after the
// provincial roads, the buildings of the secondary schools, the planning of the territory, the environment and the
// transport, and helps the comuni. Rules of the game, simplified.
const PROVINCIA = [
  T('decreto-presidente', {
    label: 'Decreto del Presidente', organ: 'giunta', quorum: 'giunta', reference: 'legge 56/2014 e statuto provinciale', proposers: 'Presidente e consiglieri delegati',
    function: 'Gli atti di governo dell’ente che non spettano al consiglio: manutenzioni, contributi ai comuni, incarichi, organizzazione degli uffici.',
    iter: ['Proposta del consigliere delegato', 'Pareri tecnici e contabili', 'Decreto del Presidente'],
    modifies: 'Un servizio della provincia, in poche settimane; spesa contenuta.',
    approved: 'Effetto rapido sul servizio, che poi si attenua; il costo pesa sul bilancio.', rejected: 'La presidenza si divide: perde stabilità e il problema resta.',
    politics: 0.35, effect: 1.6, cost: 1.2, phase: 4, lasting: false, weight: 0.24, player: ['leader']
  }),
  T('regolamento', {
    label: 'Regolamento provinciale', reference: 'TUEL e statuto provinciale', proposers: 'Presidente e consiglieri',
    function: 'Norme stabili su un servizio: viabilità, trasporto, uso degli edifici scolastici, autorizzazioni ambientali.',
    iter: ['Proposta', 'Commissione consiliare', 'Voto in consiglio', 'Pubblicazione all’albo'],
    modifies: 'Le regole di un servizio: effetto moderato e duraturo, quasi a costo zero.',
    approved: 'Il servizio migliora a poco a poco e resta migliorato.', rejected: 'Restano le regole vecchie; chi l’ha proposto perde credibilità.',
    politics: 0.3, effect: 2, cost: 0.3, phase: 8, weight: 0.1, player: ['leader', 'consigliere']
  }),
  T('piano', {
    label: 'Piano provinciale di settore', reference: 'TUEL e legge 56/2014', proposers: 'Presidente',
    function: 'Piani della provincia: viabilità, trasporto, edilizia scolastica, rifiuti e ambiente, sviluppo economico.',
    iter: ['Proposta della presidenza', 'Commissione consiliare', 'Voto in consiglio', 'Attuazione in più mesi'],
    modifies: 'Un intero settore dell’area vasta, con effetti ampi ma lenti e una spesa pluriennale.',
    approved: 'Il settore migliora in modo stabile nei mesi successivi.', rejected: 'Il settore resta senza programmazione e continua a peggiorare; la presidenza ne esce indebolita.',
    politics: 0.35, effect: 3, cost: 2.2, phase: 16, weight: 0.12, player: ['leader']
  }),
  T('opere', {
    label: 'Strade e scuole: lavori pubblici', reference: 'programma triennale dei lavori pubblici', proposers: 'Presidente',
    function: 'Le strade provinciali e gli edifici delle scuole superiori: ponti, frane, tetti, palestre, messa in sicurezza.', areas: ['infrastrutture', 'scuola', 'trasporti', 'ambiente'],
    iter: ['Progetto e copertura finanziaria', 'Commissione lavori pubblici', 'Voto in consiglio', 'Gara e cantiere'],
    modifies: 'Le strutture del tema: effetto forte ma lento (i cantieri), spesa alta.',
    approved: 'Cantieri e poi strutture migliori; lavoro per le imprese del territorio.', rejected: 'L’opera salta e i fondi dedicati vanno persi: le strutture continuano a invecchiare.',
    politics: 0.3, breadth: 0.15, effect: 4, cost: 5, phase: 24, weight: 0.14, player: ['leader']
  }),
  T('ptcp', {
    label: 'Piano territoriale di coordinamento', quorum: 'componenti', reference: 'legge 56/2014 e leggi regionali sul governo del territorio', proposers: 'Presidente',
    function: 'La pianificazione dell’area vasta: dove si può costruire, quali corridoi di mobilità e quali aree verdi, in accordo con i comuni.', areas: ['casa', 'ambiente', 'infrastrutture'],
    iter: ['Proposta della presidenza', 'Parere dell’Assemblea dei sindaci', 'Adozione in consiglio', 'Osservazioni e approvazione definitiva'],
    modifies: 'Casa, territorio e ambiente nell’intera provincia; un lavoro lento, ma che i comuni devono seguire.',
    approved: 'Il territorio si ordina: meno scontri tra i comuni e un quadro stabile per le opere.', rejected: 'Il piano decade: ogni comune va per conto suo.',
    politics: 0.45, breadth: 0.1, effect: 2.8, cost: 0.6, phase: 24, weight: 0.04, player: ['leader']
  }),
  T('convenzione', {
    label: 'Convenzione con i comuni', reference: 'TUEL e legge 56/2014', proposers: 'Presidente',
    function: 'La provincia aiuta i comuni: stazione appaltante, uffici associati, assistenza tecnica, trasporto intercomunale.',
    iter: ['Accordo con i comuni interessati', 'Parere dell’Assemblea dei sindaci', 'Voto in consiglio'],
    modifies: 'I servizi che i piccoli comuni non reggono da soli, e il rapporto tra la provincia e i sindaci.',
    approved: 'I comuni aderenti ricevono un servizio condiviso; la presidenza guadagna fiducia tra i sindaci.', rejected: 'I comuni restano da soli e la presidenza perde appoggio.',
    politics: 0.3, content: 0.8, breadth: 0.2, effect: 1.8, cost: 0.8, phase: 12, weight: 0.1, player: ['leader', 'consigliere']
  }),
  T('variazione', {
    label: 'Variazione di bilancio', reference: 'art. 175 TUEL', proposers: 'Presidente',
    function: 'Sposta risorse tra i programmi durante l’anno.',
    iter: ['Proposta della presidenza', 'Parere dei revisori', 'Commissione bilancio', 'Voto in consiglio'],
    modifies: 'Le risorse di un programma: più fondi al tema, meno margine.',
    approved: 'Il tema riceve fondi e migliora per qualche mese.', rejected: 'Le risorse restano ferme e la presidenza perde stabilità.',
    politics: 0.55, content: 0.6, effect: 1.8, cost: 2.4, phase: 6, lasting: false, weight: 0.06, player: ['leader']
  }),
  T('bilancio', {
    label: 'Bilancio provinciale', reference: 'artt. 151, 162 e 141 TUEL', proposers: 'Presidente',
    function: 'Entrate e spese dell’anno, dopo il parere dell’Assemblea dei sindaci: senza il bilancio la provincia spende solo il necessario.', areas: ['finanze'],
    iter: ['Proposta della presidenza', 'Parere dei revisori dei conti', 'Parere dell’Assemblea dei sindaci', 'Voto in consiglio'],
    modifies: 'Le risorse dell’anno (margine) e la possibilità di spendere.',
    approved: 'Nuove risorse per l’anno e una presidenza più solida.', rejected: 'Esercizio provvisorio: solo spese obbligatorie; al secondo no il Prefetto nomina un commissario e il consiglio è sciolto.',
    politics: 1, content: 0.25
  }),
  T('statuto', {
    label: 'Statuto provinciale', quorum: 'componenti', reference: 'legge 56/2014', proposers: 'Presidente e consiglieri',
    function: 'Gli organi dell’ente e i rapporti con i comuni: lo adotta il consiglio con il parere dell’Assemblea dei sindaci.', areas: ['pa'],
    iter: ['Proposta', 'Parere dell’Assemblea dei sindaci', 'Voto in consiglio con la maggioranza assoluta dei componenti'],
    modifies: 'Le regole del rapporto con i comuni: meno attrito, uffici più chiari.',
    approved: 'Rapporti più chiari con i comuni: cala la pressione sulla presidenza.', rejected: 'Tutto come prima; la maggioranza ne esce indebolita.',
    politics: 0.3, content: 0.6, breadth: 0.2, effect: 1, phase: 8, weight: 0.01, player: ['leader']
  }),
  T('mozione', {
    label: 'Mozione', reference: 'TUEL e regolamento del consiglio provinciale', proposers: 'Consiglieri e gruppi consiliari',
    function: 'Atto di indirizzo: il consiglio impegna il Presidente e i consiglieri delegati ad agire su un tema.',
    iter: ['Deposito', 'Calendario dei capigruppo', 'Discussione e voto in consiglio'],
    modifies: 'Da sola non spende e non cambia regole: crea un impegno per la presidenza.',
    approved: 'La presidenza deve portare un atto sul tema entro 8 settimane; se non lo fa perde stabilità e credibilità.', rejected: 'Nessun impegno; chi l’ha presentata ne fa una bandiera (più pressione se è dell’opposizione).',
    politics: 0.6, content: 0.8, breadth: -0.05, player: ['consigliere']
  }),
  T('interrogazione', {
    label: 'Interrogazione', organ: 'esecutivo', quorum: 'nessuno', reference: 'TUEL e regolamento del consiglio provinciale', proposers: 'Consiglieri',
    function: 'Domanda al Presidente o a un consigliere delegato sull’attività dell’ente: la risposta arriva entro 30 giorni.',
    iter: ['Deposito', 'Risposta in consiglio o scritta'],
    modifies: 'Il controllo sulla presidenza: la risposta dipende da come va il servizio.',
    approved: 'Servizio in difficoltà: risposta debole, la presidenza perde stabilità e chi ha chiesto guadagna visibilità.', rejected: 'Servizio in salute: la presidenza risponde bene e la pressione cala.',
    politics: 0, player: ['consigliere']
  }),
  T('sfiducia', {
    label: 'Mozione di sfiducia al Presidente', quorum: 'componenti', reference: 'regola del gioco, sul modello degli artt. 52 e 141 TUEL', proposers: 'Almeno due quinti dei consiglieri',
    function: 'Sfiducia al Presidente della Provincia: motivata, discussa dopo qualche giorno, votata per appello nominale.', areas: ['pa'],
    iter: ['Deposito con le firme', 'Attesa di almeno 10 giorni', 'Voto per appello nominale'],
    modifies: 'La sopravvivenza della presidenza e del consiglio.',
    approved: 'Presidente e consiglieri delegati decadono: consiglio sciolto, arriva un commissario, si torna al voto.', rejected: 'Il Presidente resta e si rafforza; l’opposizione perde credibilità.',
    politics: 1, content: 0
  })
];
const EUROPA = [
  T('ue-proposta', {
    label: 'Proposta legislativa della Commissione', reference: 'procedura legislativa ordinaria, art. 294 TFUE', proposers: 'Commissione europea',
    function: 'Regolamenti e direttive: la commissione parlamentare competente esamina il testo, poi la plenaria vota la posizione del Parlamento da negoziare con il Consiglio.',
    iter: ['Relatore e commissione competente', 'Emendamenti e voto in commissione', 'Voto in plenaria', 'Negoziato con il Consiglio'],
    modifies: 'La posizione del Parlamento su una legge europea: conta per il peso politico di relatori e gruppi.',
    approved: 'Il testo del Parlamento diventa la base del negoziato; chi l’ha scritto guadagna peso.', rejected: 'La proposta torna alla Commissione.',
    politics: 0.3
  }),
  T('ue-risoluzione', {
    label: 'Risoluzione', reference: 'regolamento del Parlamento europeo', proposers: 'Gruppi politici',
    function: 'Una presa di posizione politica del Parlamento: non vincola, orienta la Commissione e il Consiglio.',
    iter: ['Commissione competente', 'Voto in plenaria'], modifies: 'La linea politica del Parlamento sul tema.',
    approved: 'Il Parlamento prende posizione: i gruppi che l’hanno voluta guadagnano visibilità.', rejected: 'Nessuna posizione comune.', politics: 0.35
  }),
  T('ue-emendamento', {
    label: 'Emendamenti di un gruppo', reference: 'regolamento del Parlamento europeo', proposers: 'Gruppi politici',
    function: 'Modifiche al testo in discussione presentate da un gruppo.', iter: ['Commissione competente', 'Voto in plenaria'],
    modifies: 'Il testo di un dossier europeo.', approved: 'Il testo cambia nella direzione del gruppo.', rejected: 'Il testo resta com’era.', politics: 0.4
  }),
  T('ue-relazione', {
    label: 'Relazione d’iniziativa', reference: 'regolamento del Parlamento europeo', proposers: 'Deputati, tramite la commissione',
    function: 'Il Parlamento chiede alla Commissione di intervenire su un tema: la scrive un relatore della commissione competente.',
    iter: ['Commissione competente', 'Voto in commissione', 'Voto in plenaria'], modifies: 'L’agenda della Commissione e il peso del relatore.',
    approved: 'La relazione impegna politicamente la Commissione; il relatore guadagna peso.', rejected: 'La relazione cade; il relatore perde credibilità.', politics: 0.3, player: ['consigliere', 'leader']
  })
];
export const ACT_TYPES = Object.freeze({ comune: Object.freeze(COMUNE), provincia: Object.freeze(PROVINCIA), regione: Object.freeze(REGIONE), europa: Object.freeze(EUROPA) });
export const actTypeOf = (kind, id) => ACT_TYPES[kind]?.find(item => item.id === id) ?? null;
// The kinds the player can propose: a councillor, or the head of the executive (sindaco, presidente).
export const proposableTypes = (kind, leads) => (ACT_TYPES[kind] ?? []).filter(item => item.player.includes(leads ? 'leader' : 'consigliere'));
// The act a theme calls for when nothing else is said (the player's proposals and the executive's).
const NATURAL = Object.freeze({
  comune: { sicurezza: 'regolamento', commercio: 'regolamento', pa: 'regolamento', trasporti: 'piano', ambiente: 'servizi', casa: 'urbanistica', welfare: 'servizi', scuola: 'opere', cultura: 'delibera-giunta', sport: 'opere', turismo: 'piano', infrastrutture: 'opere', giovani: 'servizi', digitale: 'servizi' },
  regione: { sanita: 'piano', trasporti: 'legge', agricoltura: 'legge', ambiente: 'piano', lavoro: 'legge', industria: 'legge', scuola: 'legge', turismo: 'legge', welfare: 'legge', infrastrutture: 'piano', casa: 'legge', cultura: 'legge', energia: 'legge', autonomie: 'legge' },
  provincia: { infrastrutture: 'opere', scuola: 'opere', trasporti: 'piano', ambiente: 'piano', casa: 'ptcp', autonomie: 'convenzione', pa: 'regolamento', turismo: 'piano', industria: 'piano', cultura: 'decreto-presidente' }
});
export const naturalType = (kind, area, leads) => {
  const allowed = proposableTypes(kind, leads);
  const natural = allowed.find(item => item.id === NATURAL[kind]?.[area] && (!item.areas || item.areas.includes(area)));
  // Otherwise: a councillor files a motion, the head of the executive brings a deliberation to the council.
  return natural ?? allowed.find(item => item.id === (leads ? null : 'mozione')) ?? allowed.find(item => !item.areas && item.organ === 'consiglio') ?? allowed[0] ?? null;
};
export const typeFitsArea = (type, area) => !type.areas || type.areas.includes(area);

// ---------- titles ----------
// The subjects of the acts on each theme (comune and regione): what a real act on that theme would be about.
const CITY_TOPICS = Object.freeze({
  casa: { giunta: 'contributi per l’affitto alle famiglie', regolamento: 'per l’assegnazione degli alloggi popolari', piano: 'Piano per l’abitare e l’edilizia sociale', servizi: 'agenzia comunale per l’affitto', opere: 'recupero degli alloggi popolari sfitti', convenzione: 'con l’ente regionale per la casa', mozione: 'emergenza abitativa e affitti brevi', urbanistica: { espansione: 'Piano attuativo per un nuovo quartiere residenziale', rigenerazione: 'Variante per rigenerare un’area industriale dismessa' } },
  trasporti: { giunta: 'nuove corse serali degli autobus', regolamento: 'della zona a traffico limitato', piano: 'Piano urbano della mobilità sostenibile', servizi: 'affidamento del trasporto pubblico locale', opere: 'nuove piste ciclabili e parcheggi di scambio', convenzione: 'con i comuni vicini per il trasporto intercomunale', mozione: 'trasporto pubblico e pendolari', tariffe: 'biglietti dell’autobus e sosta' },
  ambiente: { giunta: 'piantumazione di nuovi alberi', regolamento: 'per la gestione dei rifiuti urbani', piano: 'Piano del verde urbano', servizi: 'raccolta differenziata porta a porta', opere: 'messa in sicurezza dei corsi d’acqua', convenzione: 'per la gestione associata dei rifiuti', mozione: 'qualità dell’aria e rifiuti' },
  sicurezza: { giunta: 'nuove telecamere di videosorveglianza', regolamento: 'di polizia urbana', piano: 'Piano comunale di protezione civile', servizi: 'vigili di quartiere', opere: 'illuminazione pubblica nei quartieri', convenzione: 'per la polizia locale associata', mozione: 'sicurezza nelle stazioni e nei parchi' },
  cultura: { giunta: 'calendario degli eventi culturali', regolamento: 'per la concessione dei teatri comunali', piano: 'Piano per la cultura e la biblioteca diffusa', servizi: 'apertura serale di musei e biblioteche', opere: 'restauro del teatro comunale', convenzione: 'con le associazioni culturali', mozione: 'tagli alla cultura', tariffe: 'ingressi ai musei civici' },
  sport: { giunta: 'contributi alle associazioni sportive', regolamento: 'per l’uso degli impianti sportivi', piano: 'Piano degli impianti sportivi', servizi: 'sport gratuito nei parchi', opere: 'nuova palestra comunale', convenzione: 'con le società sportive per la gestione degli impianti', mozione: 'impianti sportivi di quartiere', tariffe: 'impianti sportivi comunali' },
  welfare: { giunta: 'piano estivo per gli anziani soli', regolamento: 'dei servizi sociali', piano: 'Piano di zona dei servizi sociali', servizi: 'assistenza domiciliare agli anziani', opere: 'nuovo centro diurno', convenzione: 'con l’ASL per i servizi sociosanitari', mozione: 'povertà e servizi sociali', tariffe: 'servizi a domanda individuale' },
  scuola: { giunta: 'pre e post scuola', regolamento: 'delle mense scolastiche', piano: 'Piano per il diritto allo studio', servizi: 'nuovi posti negli asili nido', opere: 'ristrutturazione di una scuola', convenzione: 'con le scuole paritarie per l’infanzia', mozione: 'mense e asili nido', tariffe: 'mense scolastiche e asili nido' },
  turismo: { giunta: 'promozione turistica della città', regolamento: 'dell’imposta di soggiorno', piano: 'Piano del turismo', servizi: 'nuovo ufficio di informazione turistica', opere: 'riqualificazione del lungofiume', convenzione: 'con i comuni del territorio per la promozione', mozione: 'turismo e affitti brevi' },
  commercio: { giunta: 'contributi alle botteghe del centro', regolamento: 'dei dehors e del commercio su area pubblica', piano: 'Piano del commercio', servizi: 'mercati rionali', opere: 'riqualificazione delle vie commerciali', convenzione: 'con le associazioni di categoria', mozione: 'negozi di vicinato' },
  infrastrutture: { giunta: 'pronto intervento sulle buche', regolamento: 'per i cantieri stradali', piano: 'Programma di manutenzione delle strade', servizi: 'manutenzione programmata', opere: 'manutenzione straordinaria di strade e ponti', convenzione: 'con la provincia per le strade', mozione: 'strade dissestate' },
  giovani: { giunta: 'bando per i progetti dei giovani', regolamento: 'della consulta dei giovani', piano: 'Piano per le politiche giovanili', servizi: 'centri di aggregazione giovanile', opere: 'nuovo spazio per i giovani', convenzione: 'con l’università per stage e tirocini', mozione: 'spazi per i giovani' },
  pa: { giunta: 'riorganizzazione degli sportelli', regolamento: 'sull’accesso agli atti', piano: 'Piano della trasparenza', servizi: 'sportello unico per il cittadino', opere: 'nuova sede degli uffici comunali', convenzione: 'per la gestione associata degli uffici', mozione: 'tempi degli uffici comunali', statuto: 'Modifica dello statuto: referendum e partecipazione' },
  digitale: { giunta: 'wi-fi gratuito in centro', regolamento: 'dei servizi online', piano: 'Piano per la città digitale', servizi: 'certificati e pagamenti online', opere: 'fibra negli edifici pubblici', convenzione: 'con la Regione per i servizi digitali', mozione: 'servizi digitali ai cittadini' }
});
const REGION_TOPICS = Object.freeze({
  sanita: { legge: 'per ridurre le liste d’attesa', giunta: 'riorganizzazione della rete ospedaliera e dei pronto soccorso', piano: 'Piano sanitario regionale', regolamento: 'sull’accreditamento delle strutture sanitarie', mozione: 'liste d’attesa e pronto soccorso' },
  trasporti: { legge: 'sul trasporto pubblico locale', giunta: 'contratto di servizio con il trasporto ferroviario regionale', piano: 'Piano regionale dei trasporti', regolamento: 'sulle agevolazioni tariffarie', mozione: 'treni regionali e pendolari' },
  agricoltura: { legge: 'per l’agricoltura di montagna', giunta: 'bando per l’innovazione delle aziende agricole', piano: 'Programma regionale di sviluppo rurale', regolamento: 'sulle filiere corte', mozione: 'crisi dei prezzi agricoli' },
  ambiente: { legge: 'sul consumo di suolo', giunta: 'interventi contro il dissesto idrogeologico', piano: 'Piano regionale di gestione dei rifiuti', regolamento: 'sulle emissioni in atmosfera', mozione: 'dissesto idrogeologico' },
  lavoro: { legge: 'sulla formazione professionale', giunta: 'bando per le politiche attive del lavoro', piano: 'Piano regionale per il lavoro', regolamento: 'sui centri per l’impiego', mozione: 'crisi occupazionali' },
  industria: { legge: 'per l’attrazione degli investimenti', giunta: 'bando per le piccole e medie imprese', piano: 'Programma regionale per la ricerca e l’innovazione', regolamento: 'sugli aiuti alle imprese', mozione: 'crisi industriali' },
  scuola: { legge: 'sul diritto allo studio', giunta: 'borse di studio e trasporto scolastico', piano: 'Piano regionale dell’offerta formativa', regolamento: 'sulle borse di studio', mozione: 'edilizia scolastica' },
  turismo: { legge: 'sul turismo', giunta: 'promozione turistica dei borghi', piano: 'Piano regionale del turismo', regolamento: 'sulle strutture ricettive', mozione: 'turismo e affitti brevi' },
  welfare: { legge: 'sui servizi sociali', giunta: 'fondo per la non autosufficienza', piano: 'Piano sociale regionale', regolamento: 'sull’accreditamento dei servizi sociali', mozione: 'assistenza agli anziani non autosufficienti' },
  infrastrutture: { legge: 'sulle opere pubbliche regionali', giunta: 'manutenzione delle strade regionali', piano: 'Piano regionale delle infrastrutture', regolamento: 'sugli appalti regionali', mozione: 'cantieri fermi' },
  casa: { legge: 'per l’edilizia residenziale pubblica', giunta: 'riqualificazione degli alloggi popolari', piano: 'Piano regionale per la casa', regolamento: 'sull’assegnazione degli alloggi', mozione: 'emergenza abitativa' },
  cultura: { legge: 'sulla cultura e lo spettacolo', giunta: 'contributi a musei e teatri', piano: 'Piano regionale della cultura', regolamento: 'sui contributi allo spettacolo', mozione: 'tagli alla cultura' },
  energia: { legge: 'sulle comunità energetiche', giunta: 'incentivi per il fotovoltaico', piano: 'Piano energetico regionale', regolamento: 'sugli impianti rinnovabili', mozione: 'caro bollette' },
  autonomie: { legge: 'sulle unioni di comuni', giunta: 'fondo per i piccoli comuni', piano: 'Programma di riordino territoriale', regolamento: 'sulla gestione associata', mozione: 'autonomia differenziata', statuto: 'Revisione dello statuto regionale' }
});
const PROVINCE_TOPICS = Object.freeze({
  infrastrutture: { decreto: 'pronto intervento sulle strade provinciali', regolamento: 'sui cantieri lungo le strade provinciali', piano: 'Piano della viabilità provinciale', opere: 'ponti, frane e messa in sicurezza delle strade provinciali', convenzione: 'con i comuni per la manutenzione delle strade', mozione: 'strade provinciali dissestate', ptcp: 'Corridoi infrastrutturali dell’area vasta' },
  scuola: { decreto: 'interventi urgenti negli edifici delle scuole superiori', regolamento: 'sull’uso delle palestre scolastiche', piano: 'Piano dell’edilizia scolastica', opere: 'adeguamento sismico e tetti delle scuole superiori', convenzione: 'con i comuni per le palestre scolastiche', mozione: 'edilizia scolastica e sicurezza degli istituti' },
  trasporti: { decreto: 'servizio di trasporto per le scuole superiori', regolamento: 'sui servizi di trasporto in concessione', piano: 'Piano del trasporto pubblico di area vasta', opere: 'fermate, parcheggi di scambio e collegamenti', convenzione: 'con i comuni per il trasporto intercomunale', mozione: 'collegamenti tra i comuni e le valli' },
  ambiente: { decreto: 'controlli ambientali e autorizzazioni', regolamento: 'sulle autorizzazioni ambientali', piano: 'Piano provinciale dei rifiuti e della difesa del suolo', opere: 'difesa del suolo e corsi d’acqua', convenzione: 'con i comuni per la gestione associata dei rifiuti', mozione: 'frane, corsi d’acqua e rifiuti', ptcp: 'Tutela delle aree verdi e agricole dell’area vasta' },
  casa: { decreto: 'osservatorio sul territorio e sulla casa', regolamento: 'sulla pianificazione sovracomunale', piano: 'Piano per il territorio e l’abitare', opere: 'recupero di edifici provinciali', convenzione: 'con i comuni per la pianificazione associata', mozione: 'consumo di suolo e pianificazione', ptcp: 'Assetto del territorio e insediamenti dell’area vasta' },
  autonomie: { decreto: 'sportello per i piccoli comuni', regolamento: 'sugli uffici associati', piano: 'Programma di assistenza tecnica ai comuni', opere: 'sedi condivise per gli uffici dei comuni', convenzione: 'stazione appaltante e assistenza tecnica ai comuni', mozione: 'piccoli comuni e servizi associati' },
  pa: { decreto: 'riorganizzazione degli uffici dell’ente', regolamento: 'sull’accesso agli atti', piano: 'Piano della trasparenza e dell’anticorruzione', opere: 'sede degli uffici provinciali', convenzione: 'per i servizi digitali ai comuni', mozione: 'tempi e uffici della provincia', statuto: 'Modifica dello statuto provinciale' },
  turismo: { decreto: 'promozione dei cammini e dei borghi', regolamento: 'sull’accoglienza diffusa', piano: 'Piano del turismo di area vasta', opere: 'segnaletica e punti di accoglienza', convenzione: 'con i comuni per la promozione turistica', mozione: 'turismo e borghi' },
  industria: { decreto: 'tavolo con le imprese del territorio', regolamento: 'sulle aree produttive', piano: 'Piano per le aree produttive e lo sviluppo economico', opere: 'infrastrutture per le aree produttive', convenzione: 'con i comuni per lo sportello unico delle imprese', mozione: 'crisi aziendali e aree produttive' },
  cultura: { decreto: 'calendario degli eventi culturali provinciali', regolamento: 'sui contributi culturali', piano: 'Piano della cultura di area vasta', opere: 'restauro di un edificio storico provinciale', convenzione: 'con i comuni per le reti museali', mozione: 'cultura e biblioteche nei piccoli comuni' }
});
const lower = area => AREA_BY_ID[area]?.label.toLowerCase() ?? 'servizi';
// The title of an act of a kind on a theme (variant: aumento/riduzione, espansione/rigenerazione).
export function actTitle(kind, typeId, area, { variant = null, year = null } = {}) {
  const topic = (kind === 'regione' ? REGION_TOPICS : kind === 'provincia' ? PROVINCE_TOPICS : CITY_TOPICS)[area] ?? {};
  const place = kind === 'regione' ? 'regionali' : kind === 'provincia' ? 'provinciali' : 'comunali';
  switch (typeId) {
    case 'decreto-presidente': return `Decreto del Presidente: ${topic.decreto ?? `interventi su ${lower(area)}`}`;
    case 'ptcp': return topic.ptcp ?? `Piano territoriale di coordinamento: ${lower(area)}`;
    case 'delibera-giunta': return `Delibera di Giunta: ${topic.giunta ?? `interventi su ${lower(area)}`}`;
    case 'tariffe': return `Tariffe: ${variant === 'riduzione' ? 'riduzione' : 'aumento'} per ${topic.tariffe ?? lower(area)}`;
    case 'tributi': return kind === 'regione' ? `Addizionale regionale IRPEF: ${variant === 'riduzione' ? 'riduzione' : 'aumento'}` : `Aliquote IMU e addizionale IRPEF: ${variant === 'riduzione' ? 'riduzione' : 'aumento'}`;
    case 'regolamento': return `Regolamento ${kind === 'regione' ? 'regionale ' : ''}${topic.regolamento ?? `su ${lower(area)}`}`;
    case 'piano': return topic.piano ?? `Piano ${place} per ${lower(area)}`;
    case 'urbanistica': return topic.urbanistica?.[variant ?? 'rigenerazione'] ?? `Variante urbanistica: ${variant ?? 'rigenerazione'}`;
    case 'opere': return `Opere pubbliche: ${topic.opere ?? lower(area)}`;
    case 'servizi': return `Servizio pubblico: ${topic.servizi ?? lower(area)}`;
    case 'convenzione': return `Convenzione ${topic.convenzione ?? `per ${lower(area)}`}`;
    case 'variazione': return `Variazione di bilancio: fondi per ${lower(area)}`;
    case 'bilancio': return kind === 'regione' ? `Legge di bilancio regionale ${year ?? ''}`.trim() : kind === 'provincia' ? `Bilancio provinciale ${year ?? ''}`.trim() : `Bilancio di previsione ${year ?? ''}`.trim();
    case 'statuto': return topic.statuto ?? (kind === 'regione' ? 'Revisione dello statuto regionale' : kind === 'provincia' ? 'Revisione dello statuto provinciale' : 'Modifica dello statuto comunale');
    case 'legge': return `Legge regionale ${topic.legge ?? `su ${lower(area)}`}`;
    case 'mozione': return `Mozione: ${topic.mozione ?? lower(area)}`;
    case 'interrogazione': return `Interrogazione su ${topic.mozione ?? lower(area)}`;
    default: return `${AREA_BY_ID[area]?.label ?? 'Atto'}`;
  }
}
