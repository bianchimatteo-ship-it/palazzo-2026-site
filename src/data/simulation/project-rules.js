// What the Prime Minister decides on the public money, beyond the single bill: the budget by sector with its economic levers, the concrete projects
// (hospitals, railways, schools, firms) and the European funds. Game mechanics (source: simulation): none of these values describes a real figure or a real programme.

// The sectors of the budget law with a slider each: from a cut (−3) to a boost (+3), on the area of the country they pay for.
export const BUDGET_SECTORS = Object.freeze([
  { id: 'sanita', label: 'Sanità', area: 'sanita' },
  { id: 'scuola', label: 'Scuola', area: 'scuola' },
  { id: 'lavoro', label: 'Lavoro', area: 'lavoro' },
  { id: 'infrastrutture', label: 'Infrastrutture', area: 'infrastrutture' },
  { id: 'sicurezza', label: 'Sicurezza', area: 'sicurezza' },
  { id: 'imprese', label: 'Imprese', area: 'industria' },
  { id: 'ricerca', label: 'Ricerca', area: 'universita' },
  { id: 'ambiente', label: 'Ambiente', area: 'ambiente' }
]);
export const SECTOR_RANGE = Object.freeze({ min: -3, max: 3 });

// The economic levers of the budget law. `taxes` is the income tax of the older plans; the others are new. revenue: deficit points per step.
export const FISCAL_LEVERS = Object.freeze([
  { id: 'taxes', label: 'Tasse sul reddito', min: -2, max: 2, low: 'Meno tasse', high: 'Più tasse', revenue: 0.25, detail: 'Più gettito, meno consumi e crescita; meno tasse alleggeriscono famiglie e imprese ma pesano sul deficit.' },
  { id: 'accise', label: 'Accise e imposte sui consumi', min: -2, max: 2, low: 'Accise più basse', high: 'Accise più alte', revenue: 0.12, detail: 'Carburanti, tabacchi, alcol: gettito rapido, ma i prezzi salgono e chi si muove ogni giorno protesta.' },
  { id: 'agevolazioni', label: 'Agevolazioni alle imprese', min: 0, max: 3, low: 'Nessuna', high: 'Molte', revenue: -0.14, detail: 'Crediti d’imposta e sgravi: spingono investimenti e crescita, costano gettito e ai redditi bassi sembrano un regalo.' },
  { id: 'sanzioni', label: 'Controlli e sanzioni', min: 0, max: 3, low: 'Invariati', high: 'Più rigore', revenue: 0.1, detail: 'Lotta all’evasione e agli illeciti: il gettito è incerto e lento, le imprese lo vivono come un peso.' },
  { id: 'regole', label: 'Regolamentazione del mercato', min: -2, max: 2, low: 'Semplificare', high: 'Più tutele', revenue: 0, detail: 'Meno vincoli aiutano la crescita ma indeboliscono tutele e ambiente; più regole proteggono lavoratori e territorio e frenano le imprese.' }
]);

// Concrete projects: what is built, where it lands, how long it takes, how often it slips. base: points of budget (1 point ≈ 1,5 miliardi di gioco);
// weeks: duration range; gain: points on the regional indicators at completion (before quality and delays); risk: weekly chance of a delay.
export const PROJECT_TYPES = Object.freeze({
  ospedale: { id: 'ospedale', label: 'Ospedale', icon: 'cross', area: 'sanita', base: 6, weeks: [52, 96], regional: { sanita: 1 }, gain: 13, national: 1.6, pleased: ['anziani', 'famiglie', 'fragili'], risk: 0.06, call: 'coesione', stages: 'Progetto · gara · cantiere · collaudo · apertura' },
  ferrovia: { id: 'ferrovia', label: 'Linea ferroviaria', icon: 'route', area: 'trasporti', base: 9, weeks: [78, 150], regional: { trasporti: 1, infrastrutture: 0.6 }, gain: 12, national: 1.4, pleased: ['giovani', 'famiglie', 'imprese'], risk: 0.09, call: 'mobilita', stages: 'Progetto · gara · cantiere · collaudo · apertura' },
  scuola: { id: 'scuola', label: 'Scuola', icon: 'book', area: 'scuola', base: 3, weeks: [36, 72], regional: { istruzione: 1 }, gain: 10, national: 1.1, pleased: ['giovani', 'famiglie'], risk: 0.05, call: 'competenze', stages: 'Progetto · gara · cantiere · collaudo · apertura' },
  impresa: { id: 'impresa', label: 'Polo industriale', icon: 'factory', area: 'industria', base: 5, weeks: [44, 90], regional: { economia: 0.8, occupazione: 0.9 }, gain: 10, national: 1.2, pleased: ['imprese', 'giovani', 'fragili'], risk: 0.07, call: 'competitivita', stages: 'Piano · gara · insediamento · collaudo · avvio' }
});
export const PROJECT_STAGES = Object.freeze([
  { id: 'progettazione', label: 'Progettazione', until: 22 },
  { id: 'gara', label: 'Gara d’appalto', until: 32 },
  { id: 'cantiere', label: 'Cantiere', until: 90 },
  { id: 'collaudo', label: 'Collaudo', until: 100 }
]);
export const PROJECT_RULES = Object.freeze({
  fundingMin: 60, fundingMax: 140, fundingStep: 5, fundingDefault: 100,
  // The share of the cost committed from the fiscal margin at the start (the rest is paid along the works).
  commit: 0.4,
  maxActive: 8,
  overrunChance: 0.014, overrunShare: [0.08, 0.22], stallWeeks: 6, hurryWeeks: 6,
  // Weeks of waiting for a decision before the default (waiting) applies.
  decisionWeeks: 3,
  // A suspended project gives back this share of what was committed.
  refund: 0.5
});

// European calls: they open in turn, the Government applies with a reform behind it, Brussels awards, the funds are spent on projects (cofinanced by the State) and reported.
// areas: the reform that must have been enacted (a law of the Government on one of these areas in the last two years); projects: the types of project the funds can pay.
export const EU_CALLS = Object.freeze({
  coesione: { id: 'coesione', title: 'Salute e coesione territoriale', areas: ['sanita', 'welfare', 'mezzogiorno'], projects: ['ospedale'], amount: [3, 6], cofinance: 0.3 },
  mobilita: { id: 'mobilita', title: 'Mobilità sostenibile', areas: ['trasporti', 'infrastrutture', 'energia'], projects: ['ferrovia'], amount: [5, 9], cofinance: 0.35 },
  competenze: { id: 'competenze', title: 'Scuola e competenze', areas: ['scuola', 'universita', 'giovani', 'lavoro'], projects: ['scuola'], amount: [2, 4], cofinance: 0.25 },
  competitivita: { id: 'competitivita', title: 'Competitività e innovazione', areas: ['industria', 'digitale', 'universita', 'fisco'], projects: ['impresa'], amount: [3, 7], cofinance: 0.3 }
});
export const EU_RULES = Object.freeze({
  // A new call every so many weeks (each of them stays open `openWeeks`, then Brussels needs `reviewWeeks` to decide).
  everyWeeks: 22, openWeeks: 12, reviewWeeks: [4, 8], spendWeeks: 104, reportEveryWeeks: 26, reportGraceWeeks: 5,
  // The reform required counts if it is not older than this many weeks.
  reformWeeks: 104, keep: 6,
  // What losing funds costs: the weight with Brussels and the markets.
  lossEurope: 3, lossSpread: 12
});
