// Where a career begins, beyond the stats of the level: what a seat of that rank (a council, a province, a region, the Chambers,
// Strasbourg) and a way of belonging (independent, member of a party, founder of one) really start with. Resources, relations,
// the four reputations, the influence in the sectors of policy, the standing in the party and the territory, the pace at which the
// stats grow, what is expected of the player and what pushes against. The numbers are mechanics of the game (source: simulation);
// the engine (scenario-engine.js) turns them into the first week and into the way the career goes on. The conditions chosen with
// the levers (outsider, debts, a divided party, a consolidated career, a custom scenario) come on top of these.

// A level is a kind of stage. fundsFactor multiplies the funds of the level, capital is added to the starting capital and
// capitalGain to the weekly one; relations, standing (the offsets of the four reputations) and sectors are added; party applies to
// a member (support, rank, the vitality of the own section); growth multiplies the positive changes of a stat.
export const LEVEL_SCENARIOS = Object.freeze({
  comunale: {
    label: 'Consigliere comunale', stage: 'un consiglio e un quartiere',
    summary: 'Parti dal gradino più vicino alle persone: conosci le strade e i comitati, ma i giornali nazionali non sanno chi sei e i mezzi sono pochi.',
    fundsFactor: 1, capital: 0, capitalGain: 0,
    relations: { civic: 6, media: -2, business: 1, unions: 1 },
    standing: { territorial: 8, media: -4, institutional: -4 },
    sectors: { territorio: 5, societa: 4 },
    party: { support: 0, rank: 0, vitality: 6 },
    growth: { popularity: 1.15, notoriety: 0.85, influence: 0.9, experience: 1.1 },
    expectation: 'Farti notare in consiglio e arrivare a sindaco o a un ruolo regionale.',
    pressure: 'Pochi mezzi e poca visibilità fuori dal territorio: la tua rete locale è il tuo capitale.'
  },
  provinciale: {
    label: 'Consigliere provinciale', stage: 'una provincia e la rete dei suoi sindaci',
    summary: 'Siedi in un ente di secondo livello: ti hanno eletto sindaci e consiglieri, non i cittadini. Pesi nella rete degli amministratori, molto meno sui giornali.',
    fundsFactor: 1.15, capital: 1, capitalGain: 0,
    relations: { civic: 4, media: -2, business: 3, unions: 2 },
    standing: { territorial: 4, internal: 2, media: -3, institutional: 2 },
    sectors: { territorio: 8, istituzioni: 3 },
    party: { support: 1, rank: 0, vitality: 4 },
    growth: { popularity: 0.95, notoriety: 0.85, influence: 1.1, experience: 1.2 },
    expectation: 'Tessere la rete dei sindaci: la presidenza della Provincia o un seggio in Regione.',
    pressure: 'Poche risorse e poca ribalta: strade, scuole e consenso degli amministratori sono la tua moneta.'
  },
  regionale: {
    label: 'Consigliere regionale', stage: 'un consiglio regionale con la sua sanità',
    summary: 'Voti le leggi della Regione, sanità e bilancio compresi: hai peso nel partito regionale e nelle categorie, ma Roma è lontana.',
    fundsFactor: 1.1, capital: 2, capitalGain: 0,
    relations: { civic: 3, media: 1, business: 4, unions: 3 },
    standing: { territorial: 3, internal: 3, institutional: 4 },
    sectors: { welfare: 8, territorio: 4 },
    party: { support: 3, rank: 1, vitality: 3 },
    growth: { popularity: 1, notoriety: 1, influence: 1.05, experience: 1 },
    expectation: 'Una giunta o la presidenza della Regione; poi, forse, Roma.',
    pressure: 'Il partito regionale e le categorie ti chiedono di portare risultati sul territorio.'
  },
  deputato: {
    label: 'Deputato', stage: 'la Camera dei deputati',
    summary: 'Parti a Roma: commissioni, gruppo e governo sono il tuo mondo, la visibilità nazionale è alta e il territorio si allontana.',
    fundsFactor: 1, capital: 4, capitalGain: 1,
    relations: { civic: -2, media: 4, business: 3, unions: 1, leadership: 2 },
    standing: { institutional: 8, media: 4, territorial: -3, internal: 2 },
    sectors: { istituzioni: 6, conti: 3 },
    party: { support: 4, rank: 1, vitality: -2 },
    growth: { popularity: 0.9, notoriety: 1.15, influence: 1.1, experience: 1 },
    expectation: 'Un incarico in commissione, una legge tua e la rielezione.',
    pressure: 'Il gruppo ti chiede disciplina e il collegio si lamenta che non ti vede mai.'
  },
  senatore: {
    label: 'Senatore', stage: 'il Senato della Repubblica',
    summary: 'Parti nell’aula più piccola, dove i numeri sono stretti e ogni voto pesa: autorevolezza e margini ridotti.',
    fundsFactor: 1, capital: 5, capitalGain: 1,
    relations: { civic: -2, media: 3, business: 3, unions: 1, leadership: 3 },
    standing: { institutional: 9, media: 3, territorial: -3, internal: 3 },
    sectors: { istituzioni: 7, welfare: 2 },
    party: { support: 4, rank: 1, vitality: -2 },
    growth: { popularity: 0.9, notoriety: 1.1, influence: 1.1, experience: 1.05 },
    expectation: 'Pesare nelle maggioranze risicate e ottenere la rielezione.',
    pressure: 'Con i numeri al Senato ogni assenza e ogni dissenso si vedono: i capigruppo ti contano.'
  },
  europeo: {
    label: 'Eurodeputato', stage: 'il Parlamento europeo',
    summary: 'Parti a Bruxelles e Strasburgo: commissioni, gruppi europei e lobby ti conoscono, a casa molto meno; il partito è lontano.',
    fundsFactor: 1, capital: 2, capitalGain: 0,
    relations: { civic: -2, media: -2, business: 4, unions: 2, leadership: -3 },
    standing: { institutional: 6, internal: -4, territorial: -5, media: -4 },
    sectors: { istituzioni: 4, economia: 5, territorio: 3 },
    party: { support: 0, rank: 1, vitality: -4 },
    growth: { popularity: 0.85, notoriety: 0.8, influence: 0.95, experience: 1.1 },
    expectation: 'Una relazione in commissione e il modo di tornare a contare in Italia.',
    pressure: 'Poca visibilità in patria e un partito lontano: chi non torna si fa dimenticare.'
  }
});

// A way of belonging.
export const AFFILIATION_SCENARIOS = Object.freeze({
  independent: {
    label: 'Indipendente', summary: 'Nessuna tessera: libertà di scelta e immagine personale, ma nessuna macchina alle spalle e liste da trovare.',
    fundsFactor: 0.9, capital: 0, capitalGain: -1,
    relations: { civic: 3, media: 3 },
    standing: { media: 4 },
    growth: { popularity: 1.05, notoriety: 1.05, influence: 0.95 },
    expectation: 'Nessuna lista pronta: alleanze, liste civiche o l’adesione a un partito più avanti.',
    pressure: 'Niente apparato né leadership che ti protegge: ogni candidatura è da costruire.'
  },
  member: {
    label: 'Iscritto a un partito', summary: 'Hai una casa politica: liste, correnti e leadership, e con loro vincoli e rivalità interne.',
    fundsFactor: 1, capital: 0, capitalGain: 0,
    relations: { leadership: 2 },
    standing: { internal: 3 },
    growth: {},
    expectation: 'Le candidature si negoziano: sostegno interno, correnti e leadership decidono.',
    pressure: 'Dipendi dal partito: il dissenso si paga e le correnti ti tirano da parti diverse.'
  },
  founder: {
    label: 'Fondatore di un partito', summary: 'Guidi una forza tua: segreteria, tesoreria e liste sono nelle tue mani, ma devi farla vivere con soglie, alleanze e una squadra.',
    fundsFactor: 1.25, capital: 6, capitalGain: 1,
    relations: { civic: -2, media: 2 },
    standing: { internal: 10, media: 3, institutional: -2 },
    growth: { notoriety: 1.1, experience: 0.95 },
    expectation: 'Far vivere il partito: la soglia elettorale, le alleanze, la tesoreria e una squadra.',
    pressure: 'Tutto dipende da te: ogni scelta sbagliata ricade sul partito e sul suo futuro.'
  }
});

export const SCENARIO_VERSION = 1;
export const GROWTH_STATS = Object.freeze(['popularity', 'reputation', 'notoriety', 'influence', 'experience']);
