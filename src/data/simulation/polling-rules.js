// Polls and the dynamic political world are simulation content: institutes, forces,
// leaders and events are invented and never describe real results or real people.

// Validated categorical order (light surface): colour follows the entity, never its rank.
export const CHART_SLOTS = Object.freeze(['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']);

export const POLL_INSTITUTES = Object.freeze([
  { id: 'aurora', name: 'Istituto Aurora', sample: [900, 1500] },
  { id: 'meridiana', name: 'Panel Meridiana', sample: [700, 1100] },
  { id: 'osservatorio', name: 'Osservatorio Civico', sample: [1000, 1600] },
  { id: 'bussola', name: 'Studio Bussola', sample: [800, 1200] }
]);

export const FAMILY_LABELS = Object.freeze({ destra: 'Area conservatrice', sinistra: 'Area progressista', centro: 'Area moderata', populista: 'Area di protesta', ecologista: 'Area ecologista', autonomista: 'Area autonomista' });
export const FAMILY_BY_ORIENTATION = Object.freeze({
  'Centrismo civico': 'centro', Progressista: 'sinistra', Conservatore: 'destra', Liberale: 'centro', Socialdemocratico: 'sinistra',
  Ecologista: 'ecologista', Popolare: 'centro', Autonomista: 'autonomista', Altro: 'centro'
});
// Families that can share a coalition in the scenario.
export const COMPATIBLE_FAMILIES = Object.freeze({
  destra: ['destra', 'centro', 'populista', 'autonomista'], sinistra: ['sinistra', 'ecologista', 'centro'], centro: ['centro', 'destra', 'sinistra', 'autonomista', 'ecologista'],
  populista: ['populista', 'destra'], ecologista: ['ecologista', 'sinistra', 'centro'], autonomista: ['autonomista', 'centro', 'destra']
});

export const SCENARIO_FORCES = Object.freeze([
  { id: 'forza-polo-conservatore', name: 'Polo Conservatore', abbreviation: 'PCO', family: 'destra', base: [18, 25] },
  { id: 'forza-polo-progressista', name: 'Polo Progressista', abbreviation: 'PPR', family: 'sinistra', base: [16, 22] },
  { id: 'forza-movimento-protesta', name: 'Movimento di Protesta', abbreviation: 'MDP', family: 'populista', base: [9, 14] },
  { id: 'forza-centro-moderato', name: 'Centro Moderato', abbreviation: 'CMO', family: 'centro', base: [6, 10] },
  { id: 'forza-lista-ecologista', name: 'Lista Ecologista', abbreviation: 'LEC', family: 'ecologista', base: [3, 6] }
]);
export const DEMO_FAMILIES = Object.freeze({ 'partito-demo': 'centro', 'partito-territori-demo': 'autonomista', 'partito-futuro-demo': 'sinistra' });
export const SPLINTER_NAMES = Object.freeze(['Nuovo Orizzonte', 'Patto Riformatore', 'Officina Civica', 'Sentiero Comune', 'Terza Via Popolare', 'Laboratorio Democratico']);
// Simulated people get explicit role labels, never realistic names that could pass for real politicians.
export const SIMULATED_FIGURE_ROLES = Object.freeze({ leader: 'Leader simulato', civic: 'Volto civico simulato' });
export const INITIAL_ALLIANCES = Object.freeze([
  { id: 'alleanza-conservatrice', label: 'Alleanza conservatrice-moderata', partyIds: ['forza-polo-conservatore', 'forza-centro-moderato'] },
  { id: 'alleanza-progressista', label: 'Alleanza progressista ed ecologista', partyIds: ['forza-polo-progressista', 'forza-lista-ecologista'] }
]);

// National and territorial events. Family deltas move polls for `duration` weeks,
// `permanent` deltas shift the long-term baseline; `stability` touches the scenario government.
export const WORLD_EVENTS = Object.freeze([
  { id: 'rincari', icon: 'energy', scope: 'nazionale', weight: 3, title: 'Rincari energetici', body: 'Bollette in aumento: famiglie e imprese chiedono misure immediate.', families: { populista: 1.2, destra: 0.4, sinistra: -0.2 }, majority: -0.6, stability: -4, duration: 6, reactable: true },
  { id: 'dati-economia', icon: 'chart', scope: 'nazionale', weight: 2, title: 'Dati economici sopra le attese', body: 'Crescita e occupazione migliorano nelle stime diffuse questa settimana.', majority: 0.8, stability: 4, duration: 5 },
  { id: 'sciopero', icon: 'megaphone', scope: 'nazionale', weight: 2, title: 'Sciopero generale', body: 'Trasporti e scuole si fermano per una giornata di mobilitazione nazionale.', families: { sinistra: 0.8, destra: -0.3 }, stability: -2, duration: 3, reactable: true },
  { id: 'scandalo-ministero', icon: 'scandal', scope: 'nazionale', weight: 2, title: 'Scandalo in un ministero', body: 'Un’inchiesta giornalistica (simulata) coinvolge i vertici di un dicastero.', majority: -1, opposition: 0.6, stability: -6, duration: 5 },
  { id: 'vertice-ue', icon: 'globe', scope: 'nazionale', weight: 2, title: 'Vertice europeo decisivo', body: 'Il negoziato a Bruxelles su bilancio e transizione occupa l’agenda.', families: { centro: 0.5, ecologista: 0.4, populista: -0.3 }, duration: 3 },
  { id: 'sicurezza', icon: 'shield', scope: 'nazionale', weight: 2, title: 'Allarme sicurezza nelle città', body: 'Una serie di episodi di cronaca riaccende il dibattito sulla sicurezza.', families: { destra: 1, populista: 0.6, sinistra: -0.5 }, duration: 4, reactable: true },
  { id: 'clima', icon: 'leaf', scope: 'nazionale', weight: 2, title: 'Ondata di calore record', body: 'Siccità e caldo estremo portano l’ambiente al centro della discussione.', families: { ecologista: 1.2, sinistra: 0.3 }, duration: 4 },
  { id: 'riforma-pensioni', icon: 'scales', scope: 'nazionale', weight: 1, title: 'Riforma delle pensioni', body: 'Il dibattito sulla riforma divide maggioranza e opposizione.', families: { populista: 0.5 }, majority: -0.5, stability: -3, permanent: { populista: 0.4 }, duration: 6, reactable: true },
  { id: 'alluvione', icon: 'storm', scope: 'regionale', weight: 2, title: 'Alluvione in {region}', body: 'Danni gravi e comunità isolate: la regione chiede lo stato di emergenza.', regionalPlayer: 1.2, stability: -1, duration: 4, reactable: true },
  { id: 'ospedale', icon: 'cross', scope: 'regionale', weight: 2, title: 'Pronto soccorso sotto pressione in {region}', body: 'Attese lunghe e personale ridotto: la sanità regionale finisce sui giornali.', regionalPlayer: -0.6, families: { populista: 0.3 }, duration: 3, reactable: true },
  { id: 'fabbrica', icon: 'factory', scope: 'locale', weight: 2, title: 'Chiude uno stabilimento vicino a {municipality}', body: 'Centinaia di posti di lavoro a rischio: il territorio chiede risposte.', localPlayer: -0.8, families: { sinistra: 0.3, populista: 0.3 }, duration: 4, reactable: true },
  { id: 'festival', icon: 'star', scope: 'locale', weight: 1, title: 'Grande evento culturale a {municipality}', body: 'Migliaia di visitatori e attenzione nazionale sulla città.', localPlayer: 0.5, duration: 2 }
]);
