// Territorial committees as structures of the party: seats with a recurring cost, volunteers of different quality,
// local fundraising, autonomy from the national line and local events. Every number is simulated: it never describes
// the real organisation, seats or accounts of a real party.

// A seat gives capacity to work (organisation, volunteers) and costs every week; only owning one is cheap to keep.
// The regional seats are the federations' own (their cost is in the party's sections): they only give capacity.
export const SEAT_TIERS = Object.freeze([
  { id: 'nessuna', label: 'Nessuna sede', upkeep: 0, capacity: 0, price: 0 },
  { id: 'provvisoria', label: 'Sede provvisoria', upkeep: 10, capacity: 3, price: 300 },
  { id: 'affitto', label: 'Sede in affitto', upkeep: 55, capacity: 7, price: 1200 },
  { id: 'proprieta', label: 'Sede di proprietà', upkeep: 20, capacity: 10, price: 6000 }
]);
export const SEAT_LEVEL_FACTOR = Object.freeze({ regione: 3, provincia: 1.6, comune: 1 });

// Parties differ by scale: a local party lives on personal leaders and simple seats; a national one has money and
// bureaucracy. The scale comes from the party's standing in the polls (a founded party starts local).
export const PARTY_SCALES = Object.freeze({
  locale: { label: 'Partito locale', autonomy: 62, fundraising: 0.8, upkeep: 0.7, recruit: 1.15, detail: 'Dirigenti personali, sedi sobrie, molta autonomia.' },
  regionale: { label: 'Partito regionale', autonomy: 50, fundraising: 1, upkeep: 1, recruit: 1, detail: 'Radicato in alcune regioni: rete di sedi e referenti.' },
  nazionale: { label: 'Partito nazionale', autonomy: 38, fundraising: 1.25, upkeep: 1.25, recruit: 0.9, detail: 'Più risorse e più burocrazia: i comitati seguono la linea.' }
});
export const scaleOf = ({ nationalShare = null, founder = false } = {}) => founder || (nationalShare !== null && nationalShare < 1.5) ? 'locale' : nationalShare !== null && nationalShare < 6 ? 'regionale' : 'nazionale';

// What the player can do on top of the basic actions (costs are paid by the career engine; the seat's price depends on
// the committee). `leader` actions are for whoever leads the party.
export const LOCAL_ACTIONS = Object.freeze({
  recluta: { label: 'Campagna di tesseramento', cost: { ap: 1, funds: 350 }, detail: 'Sei settimane di banchetti e porta a porta: nuovi iscritti, ma volontari meno esperti.' },
  iniziativa: { label: 'Iniziativa locale', cost: { ap: 1, funds: 250 }, detail: 'Un evento sul territorio: attività e consenso salgono se i volontari sono all’altezza.' },
  forma: { label: 'Forma i volontari', cost: { ap: 1, funds: 400 }, detail: 'Corsi per i volontari: qualità più alta e meno stanchezza.' },
  raccolta: { label: 'Cena di raccolta fondi', cost: { ap: 1 }, detail: 'Una serata con i sostenitori: soldi alla tesoreria del partito, volontari più stanchi.' },
  sede: { label: 'Sede migliore', cost: { funds: 300 }, detail: 'Dalla sede provvisoria all’affitto, poi all’acquisto: più capacità di lavoro, costi ricorrenti diversi.' },
  delega: { label: 'Concedi autonomia', cost: { capital: 1 }, leader: true, detail: 'Solo per chi guida il partito: il comitato decide di più da solo; fedeltà e organizzazione salgono, il controllo cala.' }
});

// Local events in the player's own territory: a decision with consequences on members, volunteers, consensus and control.
export const LOCAL_EVENT_RULES = Object.freeze({ weeklyChance: 0.05, cooldownWeeks: 10 });

// Recurring limits and rates of the weekly life of a committee.
export const COMMITTEE_RULES = Object.freeze({
  fundraisingRate: 0.45,        // what a committee raises in a week, in proportion to its people (a fraction of what the fees already bring)
  autonomyKeep: 0.3,            // share kept locally by a committee with full autonomy
  fatigueLimit: 80,
  trendWindow: 8,
  tiers: Object.freeze([['forte', 65], ['solido', 45], ['debole', 28], ['fragile', 0]])
});
