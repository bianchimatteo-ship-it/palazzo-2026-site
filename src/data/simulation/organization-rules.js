// The party as an organisation, as the game models it. Every number here is simulated:
// it never describes the real membership, bodies, sections or accounts of a real party.

// Bodies the player sits in, by internal rank (the founder sits in the national secretariat).
export const ORGANS = Object.freeze([
  { level: 0, id: 'assemblea', label: 'Assemblea degli iscritti', scope: 'Circolo locale', detail: 'Vota i delegati e discute la linea.' },
  { level: 1, id: 'direttivo', label: 'Direttivo locale', scope: 'Circolo locale', detail: 'Organizza tesseramento, iniziative e candidature locali.' },
  { level: 2, id: 'coordinamento', label: 'Coordinamento regionale', scope: 'Federazione regionale', detail: 'Sceglie le liste regionali e gestisce la rete delle sezioni.' },
  { level: 3, id: 'direzione', label: 'Direzione nazionale', scope: 'Nazionale', detail: 'Decide linea politica, alleanze e bilancio del partito.' },
  { level: 4, id: 'segreteria', label: 'Segreteria nazionale', scope: 'Nazionale', detail: 'Guida il partito tra un congresso e l’altro.' }
]);

export const MEMBERSHIP_FEE = 30;          // € per iscritto all'anno (simulato): la quota di partenza, che la direzione può cambiare
// The annual membership fee and what it does (all simulated). The fee is the player's lever when they lead the party: it sets the income from the members and, at the same time, how many join and how many leave.
// A dearer fee than the one the members are willing to pay (higher when cohesion and the life of the sections are high) discourages new members, pushes some out and makes some of them pay late;
// a cheaper one helps growth and costs revenue. Changes are not continuous: one a quarter at most, and a rise is felt for some weeks.
export const MEMBERSHIP = Object.freeze({
  reference: MEMBERSHIP_FEE, min: 0, max: 120, step: 5, cooldownWeeks: 8,
  // Weekly rates, on the members of a section: those who join and those who leave in a neutral climate (about +1% a year when everything is average).
  baseJoin: 0.0016, baseLeave: 0.0014, noise: 0.0012, maxWeekly: 0.02,
  // How the fee, measured against what the members accept, moves joins and leaves: at the reference fee both are 1; free = more joins, fewer leaves.
  join: { slope: 0.5, floor: 0.2, ceiling: 1.5 }, leave: { base: 0.5, slope: 0.5, floor: 0.5, ceiling: 2.6 },
  // What the members accept: the reference fee, higher with cohesion, living sections and a party that is doing well.
  tolerance: { base: 0.8, cohesion: 0.4, vitality: 0.2, climate: 0.15, min: 0.6, max: 1.5 },
  // A rise is felt for some weeks as a plus on the leaving rate (per reference fee of rise); a cut brings a plus on joining. Both fade.
  shockPerReference: 0.004, boostPerReference: 0.003, shockDecay: 0.7,
  // Share of the members that pays within the week: all of them up to the accepted fee, fewer above it (and in a party that is falling apart).
  collection: { overSlope: 0.3, min: 0.35 }
});
export const SECTION_WEEKLY_COST = 55;     // sede e utenze di una sezione territoriale
export const CONGRESS_CYCLE_WEEKS = 52;    // un congresso ordinario all'anno di gioco
export const FIRST_CONGRESS_WEEKS = 18;
export const SELECTION_LEAD_DAYS = 21;     // la selezione dei candidati si apre prima delle candidature
export const ELECTED_CONTRIBUTION = 0.1;   // quota dell'indennità versata dagli eletti al partito

export const TREASURY_LABELS = Object.freeze({
  quote: 'Quote degli iscritti', contributi: 'Contributi degli eletti', duepermille: '2×1000 (stima di gioco)', donazioni: 'Donazioni',
  sedi: 'Sedi e sezioni', personale: 'Personale', comunicazione: 'Comunicazione', formazione: 'Eventi e formazione', campagne: 'Campagne', prestiti: 'Prestiti agli eletti'
});

// Priorities the national leadership can give to the party budget (rank 3+ or founder).
export const PARTY_PRIORITIES = Object.freeze([
  { id: 'territorio', label: 'Radicamento territoriale', detail: 'Più sezioni vive e nuovi iscritti.', costPerLevel: 0.06 },
  { id: 'comunicazione', label: 'Comunicazione nazionale', detail: 'Visibilità del partito nei sondaggi e nei media.', costPerLevel: 0.07 },
  { id: 'formazione', label: 'Formazione dei militanti', detail: 'Militanti più attivi e partito più compatto.', costPerLevel: 0.04 }
]);

// Selection of candidates before an election: how the party chooses its lists.
export const SELECTION_METHODS = Object.freeze({
  primarie: 'Primarie aperte', accordo: 'Accordo in direzione', corrente: 'Indicazione della tua area', rinuncia: 'Nessuna candidatura interna'
});
