// The public works of the local institutions as the game models them: what each level can build (competences, simplified), what a work costs
// in points of the institution's budget margin (never in euros: the margin is a simulated measure, the euros are only a reading of it), how long
// it takes, how often it slips, what it brings when it is finished and what it costs to keep. Rules of the game (source: simulation), never
// statistics. The national projects (project-rules.js) keep their own state in society.projects; the works of a comune, a provincia or a regione
// live in the institution that answers for them. They share the stages and the rules of the decisions on delays and overruns.
import { PROJECT_RULES, PROJECT_STAGES } from './project-rules.js?v=20261027-2';

export const WORK_STAGES = Object.freeze([
  { id: 'autorizzazioni', label: 'Autorizzazioni' },
  ...PROJECT_STAGES.map(({ id, label }) => ({ id, label })),
  { id: 'completato', label: 'Aperta' },
  { id: 'sospeso', label: 'Sospesa' }
]);
export const WORK_STAGE_LABEL = Object.freeze(Object.fromEntries(WORK_STAGES.map(item => [item.id, item.label])));
export const ACTIVE_WORK_STAGES = Object.freeze(['autorizzazioni', 'progettazione', 'gara', 'cantiere', 'collaudo']);

// The rules of the cycle. Where a rule is the same as the national projects' it is the same number (commit, refund, stall, hurry, decision).
export const WORK_RULES = Object.freeze({
  // The share of the cost reserved from the margin when the work is approved; the rest is paid as the work is done.
  commit: PROJECT_RULES.commit, refund: PROJECT_RULES.refund,
  fundingMin: PROJECT_RULES.fundingMin, fundingMax: PROJECT_RULES.fundingMax, fundingStep: PROJECT_RULES.fundingStep, fundingDefault: PROJECT_RULES.fundingDefault,
  stallWeeks: PROJECT_RULES.stallWeeks, hurryWeeks: PROJECT_RULES.hurryWeeks, decisionWeeks: PROJECT_RULES.decisionWeeks,
  overrunChance: PROJECT_RULES.overrunChance * 1.4, overrunShare: PROJECT_RULES.overrunShare,
  // Works in progress at the same time, by level.
  maxActive: Object.freeze({ comune: 3, provincia: 3, regione: 4 }),
  // The upkeep of a finished work is paid every `upkeepEvery` weeks; unpaid, the work wears out.
  upkeepEvery: 13, wear: 9, worn: 45,
  // A reading of the margin in euros: how much money a point of margin stands for in an institution of each level (the interface, and the common unit of the co-financing).
  euroPerPoint: Object.freeze({ comune: 120000, provincia: 900000, regione: 14000000 }),
  // A request of the citizens for a work waits for an answer this long, and does not come back before this many weeks.
  requestDueWeeks: 16, requestGapWeeks: 20,
  // How many closed works the institution keeps in the detailed list; the older ones pass to the archive, which keeps what upkeep and wear need (the totals live in its record).
  keepClosed: 8,
  // The co-financing between institutions: a fixed contribution (a share of the cost when it is agreed) paid once by the partner, before the site opens.
  cofin: Object.freeze({ minShare: 0.1, maxShare: 0.5, step: 0.1, minPoints: 0.05, reserve: 10, stages: Object.freeze(['autorizzazioni', 'progettazione', 'gara']), waitWeeks: 12, keepClosed: 10 }),
  // The tension a work in trouble puts on the groups of the majority (points of cohesion, taken once for each threshold crossed, never every week).
  fallout: Object.freeze({ delay: Object.freeze([{ weeks: 8, loss: 2 }, { weeks: 16, loss: 3 }, { weeks: 26, loss: 4 }]), overrun: 2, funds: 2, fundsWeeks: 6, protest: 1, suspend: 1.5 })
});
// The one economic unit the levels share: the simulated euro. A point of margin is worth a different sum of money in each level (euroPerPoint), so a contribution is
// agreed in euros and converted into the points of the institution that pays it and of the one that receives it. Simulation, never real money.
export const COFIN_LEVEL = Object.freeze({ comune: 0, provincia: 1, regione: 2 });
// The agreement every co-financing follows (each entry records its terms by id): who answers for what.
export const COFIN_TERMS = Object.freeze({
  'quota-fissa': {
    label: 'Contributo fisso',
    owner: 'Chi costruisce progetta, appalta, dirige i lavori, risponde dei ritardi e dei sovracosti e paga la manutenzione.',
    partner: 'Chi cofinanzia versa una volta sola la sua quota del preventivo (in euro simulati, nei punti del proprio margine); i sovracosti e la manutenzione restano a carico di chi costruisce.'
  }
});

// Where the work stands in the territory: it decides who benefits more and how visible it is.
export const WORK_SITES = Object.freeze({
  centro: { id: 'centro', label: 'Centro', detail: 'Più visibile: il consenso cresce di più, ma sono i quartieri già serviti a goderne.', visibility: 1.25, equity: 0.8 },
  periferia: { id: 'periferia', label: 'Periferia e quartieri', detail: 'Più equilibrata: serve chi ha meno e rende un po’ meno in visibilità.', visibility: 1, equity: 1.15 },
  interne: { id: 'interne', label: 'Aree interne e frazioni', detail: 'Poco visibile ma decisiva per chi vive lontano dai servizi; costa e dura di più.', visibility: 0.75, equity: 1.5, cost: 1.1, weeks: 1.12 }
});
export const WORK_SITE_LIST = Object.freeze(Object.values(WORK_SITES));
// The same three places read differently when the institution is a province or a region.
const SITE_LABELS = Object.freeze({
  provincia: { centro: 'Capoluogo e poli urbani', periferia: 'Comuni di cintura e area vasta', interne: 'Comuni interni e montani' },
  regione: { centro: 'Aree metropolitane e capoluoghi', periferia: 'Province di costa e di pianura', interne: 'Aree interne e montane' }
});
export const siteLabel = (siteId, kind) => SITE_LABELS[kind]?.[siteId] ?? WORK_SITES[siteId]?.label ?? '';

// What a level of funding means for the player: a priority (save, standard, quality).
export const WORK_PRIORITIES = Object.freeze([
  { id: 'risparmio', label: 'Essenziale', funding: 80, detail: 'Costa meno e rende un po’ meno; più rischio di ritardi e sforamenti.' },
  { id: 'standard', label: 'Standard', funding: 100, detail: 'Preventivo ordinario.' },
  { id: 'qualita', label: 'Qualità', funding: 120, detail: 'Costa di più, dura di più e rende di più; meno rischio di ritardi.' }
]);

// The catalog. kinds: who can build it (the competences of each level: a comune does not build a regional hospital). area: the theme of the
// act that approves it; indicator: the service of the city or of the province it improves (the regional indicators for a region: `regional`).
// cost: points of margin (medium funding); weeks: [min, max]; gain: points on the indicator at the end (before quality); risk: weekly chance of
// a delay; permit: weeks of authorisations before the design starts; upkeep: share of the cost paid every year to keep it; disruption: weekly
// damage to a service while the site is open; pleased/displeased: the citizens who feel it; benefit/need: what it is for, in a line.
const W = (id, spec) => Object.freeze({ id, permit: 2, upkeep: 0.05, disruption: null, displeased: [], ...spec });
export const WORK_TYPES = Object.freeze([
  // ---- Comune ----
  W('campo-calcio', { kinds: ['comune'], label: 'Campo da calcio comunale', icon: 'trophy', area: 'sport', indicator: 'sport', cost: 3, weeks: [24, 44], gain: 5, risk: 0.05, permit: 4, upkeep: 0.05, pleased: ['giovani', 'famiglie'], benefit: 'Più sport per i ragazzi e le associazioni.', need: 'Chiedono l’intervento le società sportive e le famiglie.' }),
  W('palazzetto', { kinds: ['comune'], label: 'Palazzetto dello sport', icon: 'trophy', area: 'sport', indicator: 'sport', cost: 7, weeks: [44, 78], gain: 8, risk: 0.07, permit: 8, upkeep: 0.06, pleased: ['giovani', 'famiglie', 'anziani'], benefit: 'Sport al coperto tutto l’anno e un luogo per eventi.', need: 'Serve un’area, una gara e poi la gestione.' }),
  W('piscina', { kinds: ['comune'], label: 'Piscina comunale', icon: 'trophy', area: 'sport', indicator: 'sport', cost: 8, weeks: [48, 84], gain: 7, risk: 0.07, permit: 8, upkeep: 0.1, pleased: ['giovani', 'famiglie', 'anziani'], benefit: 'Nuoto, riabilitazione e scuole.', need: 'Costa molto da mantenere: impianti, acqua, personale.' }),
  W('strade-comunali', { kinds: ['comune'], label: 'Rifacimento di strade comunali', icon: 'bridge', area: 'infrastrutture', indicator: 'opere', cost: 4, weeks: [20, 40], gain: 6, risk: 0.07, permit: 2, upkeep: 0.04, disruption: { indicator: 'mobilita', perWeek: 0.12 }, pleased: ['imprese', 'famiglie'], displeased: [], benefit: 'Strade sicure e meno buche.', need: 'I cantieri stradali intralciano il traffico finché durano.' }),
  W('piste-ciclabili', { kinds: ['comune'], label: 'Piste ciclabili', icon: 'route', area: 'trasporti', indicator: 'mobilita', cost: 2.5, weeks: [16, 34], gain: 5, risk: 0.05, permit: 3, upkeep: 0.04, disruption: { indicator: 'mobilita', perWeek: 0.05 }, pleased: ['giovani', 'famiglie'], benefit: 'Mobilità alternativa e meno traffico.', need: 'Tolgono qualche parcheggio: i commercianti protestano.' }),
  W('sicurezza-stradale', { kinds: ['comune'], label: 'Sicurezza stradale: attraversamenti e rotatorie', icon: 'shield', area: 'sicurezza', indicator: 'sicurezza', cost: 2, weeks: [12, 26], gain: 4, risk: 0.04, permit: 2, upkeep: 0.04, pleased: ['famiglie', 'anziani'], benefit: 'Meno incidenti vicino a scuole e incroci.', need: 'Cantieri brevi, spesa contenuta.' }),
  W('parco-urbano', { kinds: ['comune'], label: 'Parco e verde urbano', icon: 'leaf', area: 'ambiente', indicator: 'ambiente', cost: 3, weeks: [20, 40], gain: 5, risk: 0.05, permit: 3, upkeep: 0.07, pleased: ['famiglie', 'giovani', 'anziani'], benefit: 'Più verde e spazi per tutti.', need: 'Il verde va curato ogni anno.' }),
  W('piazza', { kinds: ['comune'], label: 'Riqualificazione di una piazza', icon: 'town', area: 'commercio', indicator: 'cultura', cost: 3.5, weeks: [22, 44], gain: 5, risk: 0.06, permit: 4, upkeep: 0.04, pleased: ['imprese', 'giovani'], benefit: 'Più vita nel centro e commercio.', need: 'Cantiere in pieno centro: qualche protesta dei negozi.' }),
  W('scuola-comunale', { kinds: ['comune'], label: 'Ristrutturazione di una scuola (asilo, primaria)', icon: 'book', area: 'scuola', indicator: 'sociale', cost: 5, weeks: [30, 60], gain: 6, risk: 0.06, permit: 6, upkeep: 0.05, pleased: ['famiglie', 'giovani'], benefit: 'Aule sicure e posti negli asili.', need: 'I lavori vanno fatti d’estate o i ragazzi restano senza aule.' }),
  W('centro-sociale', { kinds: ['comune'], label: 'Centro sociale e diurno', icon: 'heart', area: 'welfare', indicator: 'sociale', cost: 3.5, weeks: [22, 44], gain: 5, risk: 0.05, permit: 4, upkeep: 0.07, pleased: ['fragili', 'anziani'], benefit: 'Un luogo per chi ha più bisogno.', need: 'Serve personale e gestione continua.' }),
  W('spazio-culturale', { kinds: ['comune'], label: 'Spazio culturale e biblioteca', icon: 'book', area: 'cultura', indicator: 'cultura', cost: 4, weeks: [26, 50], gain: 5, risk: 0.06, permit: 5, upkeep: 0.06, pleased: ['giovani', 'imprese'], benefit: 'Cultura e turismo.', need: 'Restauri e permessi: tempi lunghi.' }),
  W('riqualificazione-quartiere', { kinds: ['comune'], label: 'Riqualificazione di un quartiere', icon: 'town', area: 'casa', indicator: 'territorio', cost: 6, weeks: [40, 80], gain: 7, risk: 0.08, permit: 8, upkeep: 0.05, disruption: { indicator: 'territorio', perWeek: 0.06 }, pleased: ['giovani', 'fragili'], benefit: 'Casa, spazi pubblici e decoro.', need: 'Lavori lunghi che toccano molti abitanti.' }),
  // ---- Provincia: area vasta ----
  W('strade-provinciali', { kinds: ['provincia'], label: 'Manutenzione delle strade provinciali', icon: 'bridge', area: 'infrastrutture', indicator: 'viabilita', cost: 6, weeks: [26, 52], gain: 6, risk: 0.07, permit: 4, upkeep: 0.05, disruption: { indicator: 'trasporti', perWeek: 0.05 }, pleased: ['imprese', 'famiglie'], benefit: 'Collegamenti più sicuri tra i comuni.', need: 'Competenza della Provincia: strade fuori dai centri abitati.' }),
  W('ponte-provinciale', { kinds: ['provincia'], label: 'Ponte o viadotto provinciale', icon: 'bridge', area: 'infrastrutture', indicator: 'viabilita', cost: 12, weeks: [52, 100], gain: 9, risk: 0.09, permit: 10, upkeep: 0.06, pleased: ['imprese', 'famiglie'], benefit: 'Un collegamento chiave torna sicuro.', need: 'Progetto complesso, molti pareri, rischio di sforamenti.' }),
  W('frana', { kinds: ['provincia'], label: 'Messa in sicurezza di un versante franoso', icon: 'leaf', area: 'ambiente', indicator: 'ambiente', cost: 6, weeks: [30, 60], gain: 7, risk: 0.08, permit: 6, upkeep: 0.03, pleased: ['famiglie', 'imprese'], benefit: 'Strade riaperte e meno rischio per i paesi.', need: 'Spesso un’emergenza: il tempo non è dalla parte della Provincia.' }),
  W('scuola-superiore', { kinds: ['provincia'], label: 'Edificio di una scuola superiore: messa a norma', icon: 'book', area: 'scuola', indicator: 'scuole', cost: 8, weeks: [36, 70], gain: 8, risk: 0.06, permit: 6, upkeep: 0.05, pleased: ['giovani', 'famiglie'], benefit: 'Aule sicure e a norma per gli studenti.', need: 'Competenza provinciale: gli edifici delle scuole superiori.' }),
  W('palestra-scolastica', { kinds: ['provincia'], label: 'Palestra di una scuola superiore', icon: 'trophy', area: 'scuola', indicator: 'scuole', cost: 4, weeks: [24, 46], gain: 5, risk: 0.05, permit: 4, upkeep: 0.05, pleased: ['giovani', 'famiglie'], benefit: 'Sport a scuola e per le associazioni del territorio.', need: 'La palestra serve anche ai comuni, nelle ore libere.' }),
  W('intermodale', { kinds: ['provincia'], label: 'Autostazione e fermate di area vasta', icon: 'route', area: 'trasporti', indicator: 'trasporti', cost: 5, weeks: [26, 50], gain: 6, risk: 0.06, permit: 5, upkeep: 0.05, pleased: ['giovani', 'famiglie'], benefit: 'Collegamenti tra valli e centri.', need: 'Serve l’accordo con i comuni e i gestori.' }),
  W('area-produttiva', { kinds: ['provincia'], label: 'Infrastrutture per un’area produttiva', icon: 'factory', area: 'industria', indicator: 'sviluppo', cost: 7, weeks: [40, 80], gain: 7, risk: 0.08, permit: 8, upkeep: 0.04, pleased: ['imprese', 'giovani'], benefit: 'Imprese e lavoro nel territorio.', need: 'Dipende dai comuni interessati.' }),
  // ---- Regione: sanità, trasporti, formazione e sviluppo ----
  W('ospedale-regionale', { kinds: ['regione'], label: 'Nuovo ospedale', icon: 'cross', area: 'sanita', regional: { sanita: 1 }, cost: 22, weeks: [78, 140], gain: 12, risk: 0.08, permit: 12, upkeep: 0.06, pleased: ['anziani', 'famiglie', 'fragili'], benefit: 'Più posti e servizi sanitari nella regione.', need: 'Competenza regionale: la sanità. Progetto lungo e costoso.' }),
  W('potenziamento-sanitario', { kinds: ['regione'], label: 'Potenziamento di strutture sanitarie (case di comunità, pronto soccorso)', icon: 'cross', area: 'sanita', regional: { sanita: 1 }, cost: 9, weeks: [36, 70], gain: 7, risk: 0.06, permit: 6, upkeep: 0.06, pleased: ['anziani', 'famiglie', 'fragili'], benefit: 'Liste d’attesa più corte e servizi vicini ai cittadini.', need: 'Servono personale e gestione, non solo muri.' }),
  W('ferrovia-regionale', { kinds: ['regione'], label: 'Tratta ferroviaria regionale', icon: 'route', area: 'trasporti', regional: { trasporti: 1, infrastrutture: 0.5 }, cost: 24, weeks: [90, 160], gain: 11, risk: 0.1, permit: 14, upkeep: 0.05, pleased: ['giovani', 'famiglie', 'imprese'], benefit: 'Pendolari e merci su rotaia.', need: 'Il progetto più lungo: pareri, gara, cantieri.' }),
  W('trasporto-regionale', { kinds: ['regione'], label: 'Rinnovo dei treni e dei bus regionali', icon: 'route', area: 'trasporti', regional: { trasporti: 1 }, cost: 12, weeks: [40, 76], gain: 7, risk: 0.07, permit: 6, upkeep: 0.06, pleased: ['giovani', 'famiglie'], benefit: 'Mezzi nuovi e servizi più puntuali.', need: 'Gara per i mezzi e contratto di servizio.' }),
  W('strade-regionali', { kinds: ['regione'], label: 'Infrastruttura stradale regionale', icon: 'bridge', area: 'infrastrutture', regional: { infrastrutture: 1, trasporti: 0.3 }, cost: 14, weeks: [50, 100], gain: 8, risk: 0.08, permit: 8, upkeep: 0.05, pleased: ['imprese', 'famiglie'], benefit: 'Collegamenti più rapidi e sicuri.', need: 'Cantieri lunghi che toccano più province.' }),
  W('formazione', { kinds: ['regione'], label: 'Poli di formazione professionale', icon: 'book', area: 'lavoro', regional: { occupazione: 0.7, istruzione: 0.5 }, cost: 8, weeks: [36, 70], gain: 7, risk: 0.06, permit: 5, upkeep: 0.07, pleased: ['giovani', 'imprese'], benefit: 'Formazione legata alle imprese del territorio.', need: 'Servono docenti e accordi con le imprese.' }),
  W('sviluppo-economico', { kinds: ['regione'], label: 'Polo di sviluppo economico', icon: 'factory', area: 'industria', regional: { economia: 0.8, occupazione: 0.9 }, cost: 12, weeks: [48, 90], gain: 8, risk: 0.08, permit: 8, upkeep: 0.04, pleased: ['imprese', 'giovani', 'fragili'], benefit: 'Imprese, lavoro e investimenti.', need: 'Gara e insediamenti: i tempi dipendono dalle imprese.' })
]);
export const WORK_BY_ID = Object.freeze(Object.fromEntries(WORK_TYPES.map(item => [item.id, item])));
export const workTypesFor = kind => WORK_TYPES.filter(item => item.kinds.includes(kind));
// The work an act on a theme builds when the act does not say (the executive's own proposals, acts saved before the works existed).
export const defaultWorkFor = (kind, area) => workTypesFor(kind).find(item => item.area === area) ?? null;
