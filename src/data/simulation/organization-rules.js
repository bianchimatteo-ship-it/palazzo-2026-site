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

export const MEMBERSHIP_FEE = 30;          // € per iscritto all'anno (simulato)
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
