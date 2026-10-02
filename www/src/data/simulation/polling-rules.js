// The dynamic political world is made of REAL parties only. What they do in the game (strategies,
// alliances, reactions, poll figures) is simulation and labelled as such; no party, leader or
// institute is invented with a realistic name.

// Validated categorical order (light surface): colour follows the entity, never its rank.
// Categorical slots stepped for the dark game surface (validated set: same hues, dark steps).
export const CHART_SLOTS = Object.freeze(['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']);

// Simulated pollsters: explicit labels, not names that could pass for real institutes.
export const POLL_INSTITUTES = Object.freeze([
  { id: 'a', name: 'Rilevazione simulata A', sample: [900, 1500] },
  { id: 'b', name: 'Rilevazione simulata B', sample: [700, 1100] },
  { id: 'c', name: 'Rilevazione simulata C', sample: [1000, 1600] },
  { id: 'd', name: 'Rilevazione simulata D', sample: [800, 1200] }
]);

// How many real parties enter the world besides the player's: the ones with the most 2x1000 choices (MEF, real).
export const WORLD_PARTY_COUNT = 7;

// Strategies the parties choose and change on their own during the game.
export const STRATEGIES = Object.freeze({
  autonoma: { label: 'Corsa solitaria', detail: 'Pensa alla propria crescita, senza legarsi all’esecutivo né agli altri.' },
  governista: { label: 'Sostegno all’esecutivo', detail: 'Guadagna quando il Paese approva chi governa, perde quando lo boccia.' },
  opposizione: { label: 'Opposizione dura', detail: 'Cresce sul malcontento e attacca chi governa e i suoi alleati.' },
  coalizione: { label: 'Ricerca di alleanze', detail: 'Cerca intese con altre forze, anche con il tuo partito.' }
});

export const CIVIC_FIGURE_LABEL = 'Volto civico simulato';

// National and territorial events. `executive` moves the parties that back the executive,
// `challengers` those in hard opposition, `small` the parties under 5%; `majority`/`opposition`
// concern the player's side in Parliament; `stability` touches the government of the simulation.
export const WORLD_EVENTS = Object.freeze([
  { id: 'rincari', icon: 'energy', scope: 'nazionale', weight: 3, title: 'Rincari energetici', body: 'Bollette in aumento: famiglie e imprese chiedono misure immediate.', executive: -0.5, challengers: 0.8, majority: -0.6, stability: -4, duration: 6, reactable: true },
  { id: 'dati-economia', icon: 'chart', scope: 'nazionale', weight: 2, title: 'Dati economici sopra le attese', body: 'Crescita e occupazione migliorano nelle stime diffuse questa settimana (scenario).', executive: 0.6, challengers: -0.3, majority: 0.8, stability: 4, duration: 5 },
  { id: 'sciopero', icon: 'megaphone', scope: 'nazionale', weight: 2, title: 'Sciopero generale', body: 'Trasporti e scuole si fermano per una giornata di mobilitazione nazionale (scenario).', executive: -0.3, challengers: 0.5, stability: -2, duration: 3, reactable: true },
  { id: 'scandalo-ministero', icon: 'scandal', scope: 'nazionale', weight: 2, title: 'Inchiesta su un ministero dello scenario', body: 'Un’inchiesta giornalistica simulata coinvolge gli uffici di un dicastero del governo di gioco.', executive: -0.8, challengers: 0.6, majority: -1, opposition: 0.6, stability: -6, duration: 5 },
  { id: 'vertice-ue', icon: 'globe', scope: 'nazionale', weight: 2, title: 'Vertice europeo decisivo', body: 'Il negoziato su bilancio e transizione occupa l’agenda (scenario).', executive: 0.3, small: -0.1, duration: 3 },
  { id: 'sicurezza', icon: 'shield', scope: 'nazionale', weight: 2, title: 'Allarme sicurezza nelle città', body: 'Una serie di episodi di cronaca riaccende il dibattito sulla sicurezza (scenario).', challengers: 0.6, executive: -0.2, duration: 4, reactable: true },
  { id: 'clima', icon: 'leaf', scope: 'nazionale', weight: 2, title: 'Ondata di calore record', body: 'Siccità e caldo estremo portano l’ambiente al centro della discussione (scenario).', small: 0.3, executive: -0.2, duration: 4 },
  { id: 'riforma-pensioni', icon: 'scales', scope: 'nazionale', weight: 1, title: 'Riforma delle pensioni', body: 'Il dibattito sulla riforma divide maggioranza e opposizione (scenario).', challengers: 0.5, executive: -0.3, majority: -0.5, stability: -3, duration: 6, reactable: true },
  { id: 'alluvione', icon: 'storm', scope: 'regionale', weight: 2, title: 'Alluvione in {region}', body: 'Danni gravi e comunità isolate: la regione chiede lo stato di emergenza (scenario).', regionalPlayer: 1.2, stability: -1, duration: 4, reactable: true },
  { id: 'ospedale', icon: 'cross', scope: 'regionale', weight: 2, title: 'Pronto soccorso sotto pressione in {region}', body: 'Attese lunghe e personale ridotto: la sanità regionale finisce sui giornali (scenario).', regionalPlayer: -0.6, challengers: 0.2, duration: 3, reactable: true },
  { id: 'fabbrica', icon: 'factory', scope: 'locale', weight: 2, title: 'Chiude uno stabilimento vicino a {municipality}', body: 'Centinaia di posti di lavoro a rischio: il territorio chiede risposte (scenario).', localPlayer: -0.8, challengers: 0.3, duration: 4, reactable: true },
  { id: 'festival', icon: 'star', scope: 'locale', weight: 1, title: 'Grande evento culturale a {municipality}', body: 'Migliaia di visitatori e attenzione nazionale sulla città (scenario).', localPlayer: 0.5, duration: 2 }
]);

// Chains of events: what an event of the country sets in motion in the following weeks. Every stage acts like a world
// event (effects on the forces, on the government, on the player's side) and can also move the country (`shock`: the
// society's indicators, economy, trust — which in turn produce problems, decrees, protests), strain a party or its
// alliance (`party*`, `alliance`), and open the next stages. `next` picks one branch by weight among those whose
// condition holds: governoStabile / governoDebole (the government of the simulation), fiduciaBassa / fiduciaAlta (trust in
// the institutions). {party} is the force involved: inquiries are never attributed to real parties — they name only
// forces of the simulation; a real force can only be the subject of internal divisions or political choices.
export const WORLD_FOLLOWUPS = Object.freeze({
  rincari: { shock: { inflation: 0.3, growth: -0.05, trust: -0.5 }, next: [{ id: 'bollette-decreto', weeks: [2, 3], weight: 2, when: 'governoStabile' }, { id: 'bollette-piazza', weeks: [2, 4], weight: 2, when: 'governoDebole' }, { id: 'bollette-piazza', weeks: [3, 5], weight: 1, when: 'fiduciaBassa' }] },
  'dati-economia': { shock: { growth: 0.1 }, next: [{ id: 'rating-promozione', weeks: [3, 6], weight: 1, when: 'governoStabile' }, { id: null, weight: 2 }] },
  sciopero: { shock: { growth: -0.03 }, next: [{ id: 'sindacati-accordo', weeks: [2, 3], weight: 2, when: 'governoStabile' }, { id: 'sindacati-rottura', weeks: [2, 3], weight: 2, when: 'governoDebole' }, { id: 'sindacati-rottura', weeks: [2, 4], weight: 1 }] },
  'scandalo-ministero': { shock: { trust: -1.5 }, next: [{ id: 'ministro-dimissioni', weeks: [1, 2], weight: 2, when: 'fiduciaBassa' }, { id: 'ministro-resiste', weeks: [1, 2], weight: 2 }] },
  sicurezza: { shock: { perceived: 4 }, next: [{ id: 'sicurezza-piazza', weeks: [2, 3], weight: 1, when: 'fiduciaBassa' }, { id: 'sicurezza-pacchetto', weeks: [2, 4], weight: 1, when: 'governoStabile' }, { id: null, weight: 1 }] },
  clima: { shock: { area: 'ambiente', areaDelta: -3 }, next: [{ id: 'siccita-campi', weeks: [2, 4], weight: 2 }, { id: null, weight: 1 }] },
  'riforma-pensioni': { next: [{ id: 'pensioni-piazza', weeks: [2, 3], weight: 2, when: 'governoDebole' }, { id: 'pensioni-mediazione', weeks: [2, 4], weight: 2, when: 'governoStabile' }, { id: 'pensioni-piazza', weeks: [2, 4], weight: 1 }] },
  alluvione: { shock: { region: 'home', indicator: 'infrastrutture', delta: -8 }, next: [{ id: 'alluvione-emergenza', weeks: [1, 2], weight: 2, when: 'governoStabile' }, { id: 'alluvione-ritardi', weeks: [2, 3], weight: 2 }] },
  ospedale: { shock: { region: 'home', indicator: 'sanita', delta: -4 }, next: [{ id: 'sanita-commissario', weeks: [3, 5], weight: 1 }, { id: null, weight: 1 }] },
  fabbrica: { shock: { region: 'home', indicator: 'occupazione', delta: -4 }, next: [{ id: 'fabbrica-vertenza', weeks: [1, 2], weight: 1 }] },
  festival: { shock: { region: 'home', indicator: 'economia', delta: 1 } }
});
// Events that start from a force of the game (chosen when they happen) and then follow their own chain.
export const WORLD_PARTY_EVENTS = Object.freeze([
  { id: 'partito-divisioni', icon: 'users', scope: 'nazionale', weight: 2, target: 'any', title: 'Divisioni interne in {party}', body: 'La linea del partito divide dirigenti e parlamentari (scenario simulato).', partyDelta: -0.4, partyCohesion: -9, duration: 4, next: [{ id: 'partito-resa-dei-conti', weeks: [2, 4], weight: 2 }, { id: 'partito-ricucitura', weeks: [2, 4], weight: 1 }] },
  { id: 'partito-inchiesta', icon: 'scandal', scope: 'nazionale', weight: 1.5, target: 'simulated', title: 'Inchiesta su esponenti di {party}', body: 'Un’inchiesta giornalistica coinvolge dirigenti della forza (tutto simulato: la forza è nata nella partita).', partyDelta: -0.9, partyCohesion: -8, alliance: -8, duration: 5, next: [{ id: 'alleato-distanze', weeks: [1, 3], weight: 2 }, { id: 'partito-resa-dei-conti', weeks: [2, 4], weight: 1 }] },
  { id: 'partito-proposta-bandiera', icon: 'flag', scope: 'nazionale', weight: 1.5, target: 'any', title: '{party} lancia una proposta bandiera', body: 'Una campagna nazionale su un tema identitario: gli alleati devono decidere se seguirla (scenario).', partyDelta: 0.4, alliance: -4, duration: 4, next: [{ id: 'alleato-distanze', weeks: [2, 4], weight: 1 }, { id: 'alleati-seguono', weeks: [2, 4], weight: 2 }] }
]);
export const WORLD_CHAIN_STAGES = Object.freeze({
  'bollette-decreto': { icon: 'ministry', scope: 'nazionale', title: 'Il governo vara misure contro il caro bollette', body: 'Sconti e crediti d’imposta per famiglie e imprese: costano margine di bilancio (scenario).', executive: 0.4, majority: 0.4, stability: 2, duration: 4, shock: { headroom: -3, inflation: -0.15, trust: 0.5 } },
  'bollette-piazza': { icon: 'megaphone', scope: 'nazionale', title: 'Piazze piene contro il caro vita', body: 'Manifestazioni in molte città: le opposizioni cavalcano la protesta (scenario).', challengers: 0.5, executive: -0.3, majority: -0.4, stability: -3, duration: 4, reactable: true, shock: { trust: -1.5 }, next: [{ id: 'sindacati-rottura', weeks: [2, 4], weight: 1, when: 'governoDebole' }, { id: null, weight: 2 }] },
  'rating-promozione': { icon: 'chart', scope: 'nazionale', title: 'Un’agenzia di rating alza il giudizio sul Paese', body: 'Spread in calo e più margine per la prossima manovra (scenario).', executive: 0.3, majority: 0.3, stability: 2, duration: 4, shock: { headroom: 3 } },
  'sindacati-accordo': { icon: 'link', scope: 'nazionale', title: 'Accordo tra governo e sindacati', body: 'Il tavolo si chiude con un’intesa: rientrano gli scioperi (scenario).', executive: 0.3, majority: 0.3, stability: 2, duration: 3, shock: { trust: 1, headroom: -1 } },
  'sindacati-rottura': { icon: 'megaphone', scope: 'nazionale', title: 'Rottura con i sindacati: nuovo sciopero', body: 'La trattativa salta e i sindacati proclamano un’altra giornata di mobilitazione (scenario).', challengers: 0.4, executive: -0.3, majority: -0.3, stability: -3, duration: 3, reactable: true, shock: { growth: -0.05, trust: -1 } },
  'ministro-dimissioni': { icon: 'ministry', scope: 'nazionale', title: 'Il ministro coinvolto si dimette', body: 'Il dicastero passa ad interim: la maggioranza prova a voltare pagina (scenario).', executive: -0.2, stability: -3, duration: 3, shock: { trust: 0.5 } },
  'ministro-resiste': { icon: 'scandal', scope: 'nazionale', title: 'Il ministro non si dimette: le opposizioni chiedono la sfiducia', body: 'Mozione di sfiducia individuale annunciata; nella maggioranza c’è chi prende le distanze (scenario).', challengers: 0.4, executive: -0.4, majority: -0.3, stability: -4, duration: 4, reactable: true, shock: { trust: -1 }, next: [{ id: 'ministro-dimissioni', weeks: [2, 3], weight: 1, when: 'governoDebole' }, { id: 'ministro-salvato', weeks: [2, 3], weight: 1, when: 'governoStabile' }] },
  'ministro-salvato': { icon: 'dome', scope: 'nazionale', title: 'Respinta la sfiducia al ministro', body: 'La maggioranza fa quadrato, ma la vicenda lascia strascichi (scenario).', executive: 0.1, stability: 1, duration: 2 },
  'sicurezza-piazza': { icon: 'megaphone', scope: 'nazionale', title: 'Fiaccolate e comitati per la sicurezza', body: 'Nei quartieri nascono comitati di cittadini: la protesta si fa organizzata (scenario).', challengers: 0.4, small: 0.1, duration: 3, shock: { perceived: 2, trust: -1 } },
  'sicurezza-pacchetto': { icon: 'shield', scope: 'nazionale', title: 'Il governo annuncia un pacchetto sicurezza', body: 'Più agenti nelle città e nuove norme: le opposizioni parlano di propaganda (scenario).', executive: 0.3, majority: 0.2, duration: 3, shock: { perceived: -2, headroom: -1 } },
  'siccita-campi': { icon: 'leaf', scope: 'nazionale', title: 'Siccità: raccolti a rischio', body: 'Le associazioni agricole chiedono lo stato di calamità (scenario).', executive: -0.2, small: 0.1, duration: 3, shock: { area: 'agricoltura', areaDelta: -4, inflation: 0.1 } },
  'pensioni-piazza': { icon: 'megaphone', scope: 'nazionale', title: 'Pensioni: i sindacati in piazza', body: 'Grande manifestazione nazionale contro la riforma (scenario).', challengers: 0.4, executive: -0.3, majority: -0.3, stability: -3, duration: 3, shock: { trust: -1 } },
  'pensioni-mediazione': { icon: 'scales', scope: 'nazionale', title: 'Pensioni: trovata una mediazione', body: 'La riforma viene ammorbidita: costa di più, ma la maggioranza si ricompatta (scenario).', executive: 0.2, stability: 2, duration: 3, shock: { headroom: -2 } },
  'alluvione-emergenza': { icon: 'storm', scope: 'regionale', title: 'Stato di emergenza per {region}', body: 'Fondi e commissario per la ricostruzione (scenario).', executive: 0.2, regionalPlayer: 0.3, duration: 4, shock: { region: 'home', indicator: 'infrastrutture', delta: 3, headroom: -1.5 } },
  'alluvione-ritardi': { icon: 'storm', scope: 'regionale', title: 'Ricostruzione a rilento in {region}', body: 'I fondi tardano: sindaci e cittadini protestano (scenario).', executive: -0.3, regionalPlayer: -0.4, duration: 4, reactable: true, shock: { region: 'home', indicator: 'infrastrutture', delta: -2, trust: -0.5 } },
  'sanita-commissario': { icon: 'cross', scope: 'regionale', title: 'Sanità in {region}: arriva un piano straordinario', body: 'Assunzioni e riorganizzazione dei pronto soccorso (scenario).', regionalPlayer: 0.2, duration: 3, shock: { region: 'home', indicator: 'sanita', delta: 3, headroom: -1 } },
  'fabbrica-vertenza': { icon: 'factory', scope: 'locale', title: 'Vertenza aperta vicino a {municipality}', body: 'Tavolo al ministero con azienda, sindacati ed enti locali (scenario).', localPlayer: 0.2, duration: 2, next: [{ id: 'fabbrica-salvata', weeks: [3, 5], weight: 1, when: 'governoStabile' }, { id: 'fabbrica-chiusa', weeks: [3, 5], weight: 1 }] },
  'fabbrica-salvata': { icon: 'link', scope: 'locale', title: 'Stabilimento salvato vicino a {municipality}', body: 'Un nuovo acquirente e un accordo sugli organici (scenario).', localPlayer: 0.5, executive: 0.2, duration: 3, shock: { region: 'home', indicator: 'occupazione', delta: 3 } },
  'fabbrica-chiusa': { icon: 'factory', scope: 'locale', title: 'Chiude definitivamente lo stabilimento vicino a {municipality}', body: 'Licenziamenti confermati: il territorio si sente abbandonato (scenario).', localPlayer: -0.4, challengers: 0.3, duration: 4, shock: { region: 'home', indicator: 'occupazione', delta: -2, trust: -0.5 } },
  'partito-resa-dei-conti': { icon: 'crown', scope: 'nazionale', title: 'Resa dei conti in {party}', body: 'Si chiede un congresso: la minoranza interna alza la voce (scenario).', partyDelta: -0.3, partyCohesion: -12, duration: 3 },
  'partito-ricucitura': { icon: 'link', scope: 'nazionale', title: '{party} ricompone le divisioni', body: 'Un documento unitario chiude lo scontro interno (scenario).', partyDelta: 0.2, partyCohesion: 10, duration: 3 },
  'alleato-distanze': { icon: 'link', scope: 'nazionale', title: 'Gli alleati prendono le distanze da {party}', body: 'Nella coalizione c’è chi chiede chiarimenti prima di andare avanti insieme (scenario).', partyDelta: -0.2, alliance: -14, alliesDelta: 0.15, duration: 3 },
  'alleati-seguono': { icon: 'link', scope: 'nazionale', title: 'Gli alleati sostengono la proposta di {party}', body: 'La coalizione trova una posizione comune (scenario).', partyDelta: 0.2, alliance: 6, duration: 3 }
});
