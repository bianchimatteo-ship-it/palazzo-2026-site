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
