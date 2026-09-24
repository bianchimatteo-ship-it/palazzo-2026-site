// Public policy of the simulation: areas, instruments, financing and targets of every measure.
// All values are game mechanics (source: simulation); none of them describes a real statistic or a real law.

// Macro-areas of the ISTAT territorial breakdown (real classification of the regions).
export const MACRO_AREAS = Object.freeze({
  'nord-ovest': { label: 'Nord-ovest', regions: ['Piemonte', 'Valle d’Aosta', 'Lombardia', 'Liguria'] },
  'nord-est': { label: 'Nord-est', regions: ['Trentino-Alto Adige', 'Veneto', 'Friuli-Venezia Giulia', 'Emilia-Romagna'] },
  centro: { label: 'Centro', regions: ['Toscana', 'Umbria', 'Marche', 'Lazio'] },
  sud: { label: 'Sud', regions: ['Abruzzo', 'Molise', 'Campania', 'Puglia', 'Basilicata', 'Calabria'] },
  isole: { label: 'Isole', regions: ['Sicilia', 'Sardegna'] }
});
export const macroAreaOf = region => Object.entries(MACRO_AREAS).find(([, area]) => area.regions.includes(region))?.[0] ?? null;

// Where a measure is concentrated. A target concentrates effects (and money) and leaves the rest waiting.
export const TERRITORIAL_TARGETS = Object.freeze([
  { id: 'nazionale', label: 'Tutto il Paese', macro: null },
  { id: 'nord', label: 'Nord', macro: ['nord-ovest', 'nord-est'] },
  { id: 'centro', label: 'Centro', macro: ['centro'] },
  { id: 'mezzogiorno', label: 'Mezzogiorno (Sud e Isole)', macro: ['sud', 'isole'] }
]);

export const AREA_GROUPS = Object.freeze({
  conti: 'Conti pubblici e fisco', economia: 'Economia e lavoro', welfare: 'Welfare e salute', sapere: 'Istruzione e ricerca',
  territorio: 'Territorio, reti e ambiente', sicurezza: 'Sicurezza e giustizia', societa: 'Società e diritti', istituzioni: 'Istituzioni, Europa ed esteri'
});

// Instruments every area can use; labels are specific to each area.
export const INSTRUMENT_KINDS = Object.freeze({
  investimento: { label: 'Investimento', costFactor: 1, effectFactor: 1, phaseIn: 10, lasting: true, controversy: 0.2, detail: 'Spesa pubblica pluriennale: effetti ampi ma lenti, pesa sul bilancio.' },
  riforma: { label: 'Riforma strutturale', costFactor: 0.35, effectFactor: 0.75, phaseIn: 16, lasting: true, controversy: 0.8, detail: 'Cambia le regole di un settore: costa poco, divide molto, dà risultati nel tempo.' },
  sostegno: { label: 'Sostegno mirato', costFactor: 0.7, effectFactor: 0.8, phaseIn: 4, lasting: false, controversy: 0.35, detail: 'Bonus e incentivi: effetti rapidi per chi li riceve, poi svaniscono.' },
  regole: { label: 'Regolazione e semplificazione', costFactor: 0.12, effectFactor: 0.45, phaseIn: 8, lasting: true, controversy: 0.55, detail: 'Norme e procedure: quasi a costo zero, scontentano chi perde vantaggi.' }
});

// Each area: national indicator, regional indicator(s) it moves, who benefits and who pays, ministry in charge.
// base: margin of the public budget used by a medium measure (1 point ≈ 1,5 miliardi di euro di gioco).
const area = (id, label, group, icon, spec) => Object.freeze({ id, label, group, icon, ...spec });
export const POLICY_AREAS = Object.freeze([
  area('economia', 'Economia', 'economia', 'chart', { national: 'Crescita e fiducia delle imprese', regional: { economia: 1, occupazione: 0.4 }, portfolio: 'Economia e finanze', base: 6, pleased: ['imprese', 'famiglie'], displeased: [], economy: { growth: 0.2 }, problem: 'Crescita ferma: imprese e famiglie rinviano spese e investimenti.', instruments: { investimento: 'Fondo per gli investimenti produttivi', riforma: 'Riforma degli incentivi alle imprese', sostegno: 'Credito d’imposta per chi investe', regole: 'Semplificazione degli adempimenti' } }),
  area('finanze', 'Finanze pubbliche', 'conti', 'money', { national: 'Sostenibilità dei conti', derived: 'accounts', portfolio: 'Economia e finanze', base: 2, pleased: [], displeased: ['fragili', 'anziani'], economy: { growth: -0.05 }, fiscalGain: 7, problem: 'Deficit e spread alti: ogni nuova spesa costa di più.', instruments: { investimento: 'Piano di riduzione del debito', riforma: 'Revisione strutturale della spesa', sostegno: 'Rientro straordinario del deficit', regole: 'Nuove regole di bilancio per gli enti' } }),
  area('fisco', 'Tasse e fisco', 'conti', 'scales', { national: 'Peso ed equità del fisco', portfolio: 'Economia e finanze', base: 7, pleased: ['famiglie', 'imprese'], displeased: [], economy: { growth: 0.12 }, problem: 'Pressione fiscale percepita come insostenibile.', instruments: { investimento: 'Taglio strutturale delle aliquote', riforma: 'Riforma organica del fisco', sostegno: 'Detrazioni per famiglie e lavoratori', regole: 'Semplificazione delle dichiarazioni' } }),
  area('industria', 'Industria e imprese', 'economia', 'factory', { national: 'Competitività industriale', regional: { economia: 0.8, occupazione: 0.6 }, portfolio: 'Imprese', base: 6, pleased: ['imprese'], displeased: [], economy: { growth: 0.15, unemployment: -0.1 }, problem: 'Crisi industriali: chiusure e delocalizzazioni.', instruments: { investimento: 'Piano per la transizione industriale', riforma: 'Riforma delle politiche industriali', sostegno: 'Incentivi alle filiere in crisi', regole: 'Autorizzazioni più rapide per gli impianti' } }),
  area('commercio', 'Commercio', 'economia', 'briefcase', { national: 'Vitalità del commercio', portfolio: 'Imprese', base: 3, pleased: ['imprese'], displeased: [], economy: { growth: 0.05 }, problem: 'Negozi che chiudono nei centri storici.', instruments: { investimento: 'Rigenerazione dei centri commerciali naturali', riforma: 'Riforma degli orari e delle licenze', sostegno: 'Contributi al piccolo commercio', regole: 'Regole più semplici per aprire un’attività' } }),
  area('lavoro', 'Lavoro', 'economia', 'briefcase', { national: 'Qualità del lavoro', regional: { occupazione: 1 }, portfolio: 'Lavoro', base: 5, pleased: ['giovani', 'fragili'], displeased: ['imprese'], economy: { unemployment: -0.3 }, problem: 'Disoccupazione e precarietà in aumento.', instruments: { investimento: 'Piano per le politiche attive del lavoro', riforma: 'Riforma dei contratti', sostegno: 'Sgravi per le assunzioni stabili', regole: 'Stretta sui contratti precari' } }),
  area('pensioni', 'Pensioni', 'welfare', 'users', { national: 'Adeguatezza delle pensioni', portfolio: 'Lavoro', base: 8, pleased: ['anziani'], displeased: ['giovani'], economy: {}, problem: 'Pensioni che non tengono il passo del costo della vita.', instruments: { investimento: 'Rivalutazione delle pensioni', riforma: 'Riforma dell’età pensionabile', sostegno: 'Aumento delle pensioni minime', regole: 'Nuove regole per la previdenza complementare' } }),
  area('welfare', 'Welfare', 'welfare', 'heart', { national: 'Rete di protezione sociale', regional: { servizi: 1 }, portfolio: 'Lavoro', base: 7, pleased: ['fragili', 'anziani'], displeased: ['imprese'], economy: {}, problem: 'Servizi sociali insufficienti per chi è in difficoltà.', instruments: { investimento: 'Rete dei servizi sociali territoriali', riforma: 'Riforma del sostegno al reddito', sostegno: 'Bonus contro la povertà', regole: 'Controlli sui requisiti delle prestazioni' } }),
  area('sanita', 'Sanità', 'welfare', 'cross', { national: 'Qualità del servizio sanitario', regional: { sanita: 1 }, portfolio: 'Salute', base: 8, pleased: ['anziani', 'famiglie', 'fragili'], displeased: [], economy: {}, problem: 'Liste d’attesa lunghe e pronto soccorso sotto pressione.', instruments: { investimento: 'Piano straordinario per ospedali e personale', riforma: 'Riforma della medicina territoriale', sostegno: 'Taglio delle liste d’attesa', regole: 'Nuove regole per gli accreditamenti privati' } }),
  area('scuola', 'Scuola', 'sapere', 'book', { national: 'Qualità della scuola', regional: { istruzione: 1 }, portfolio: 'Istruzione', base: 5, pleased: ['giovani', 'famiglie'], displeased: [], economy: {}, problem: 'Edifici scolastici vecchi e carenza di docenti.', instruments: { investimento: 'Piano per l’edilizia scolastica', riforma: 'Riforma del reclutamento dei docenti', sostegno: 'Borse di studio e libri gratuiti', regole: 'Nuove regole di valutazione' } }),
  area('universita', 'Università e ricerca', 'sapere', 'book', { national: 'Ricerca e università', portfolio: 'Università e ricerca', base: 4, pleased: ['giovani'], displeased: [], economy: { growth: 0.05 }, euFunds: true, problem: 'Ricercatori che partono per l’estero.', instruments: { investimento: 'Fondo per la ricerca di base', riforma: 'Riforma dell’accesso e dei corsi', sostegno: 'Borse per i dottorati', regole: 'Semplificazione dei concorsi' } }),
  area('infrastrutture', 'Infrastrutture', 'territorio', 'bridge', { national: 'Qualità delle infrastrutture', regional: { infrastrutture: 1, trasporti: 0.4 }, portfolio: 'Infrastrutture', base: 9, pleased: ['imprese', 'famiglie'], displeased: [], economy: { growth: 0.15 }, euFunds: true, problem: 'Cantieri fermi e opere incompiute.', instruments: { investimento: 'Piano nazionale delle grandi opere', riforma: 'Riforma del codice degli appalti', sostegno: 'Fondo per la manutenzione di strade e ponti', regole: 'Commissari per sbloccare i cantieri' } }),
  area('trasporti', 'Trasporti', 'territorio', 'route', { national: 'Mobilità e trasporti', regional: { trasporti: 1 }, portfolio: 'Infrastrutture', base: 6, pleased: ['giovani', 'famiglie'], displeased: [], economy: {}, euFunds: true, problem: 'Treni in ritardo e pendolari esasperati.', instruments: { investimento: 'Piano per il trasporto pubblico locale', riforma: 'Riforma delle concessioni ferroviarie', sostegno: 'Abbonamenti agevolati per pendolari', regole: 'Liberalizzazione dei servizi' } }),
  area('energia', 'Energia', 'territorio', 'energy', { national: 'Costo e sicurezza dell’energia', portfolio: 'Ambiente', base: 7, pleased: ['imprese', 'famiglie'], displeased: [], economy: { inflation: -0.15, growth: 0.05 }, euFunds: true, problem: 'Bollette alte e dipendenza dall’estero.', instruments: { investimento: 'Piano per le rinnovabili e le reti', riforma: 'Riforma del mercato elettrico', sostegno: 'Taglio delle bollette', regole: 'Autorizzazioni rapide per gli impianti' } }),
  area('ambiente', 'Ambiente', 'territorio', 'leaf', { national: 'Qualità dell’ambiente', regional: { ambiente: 1 }, portfolio: 'Ambiente', base: 4, pleased: ['giovani'], displeased: ['imprese'], economy: { growth: -0.03 }, euFunds: true, problem: 'Dissesto idrogeologico e inquinamento.', instruments: { investimento: 'Piano contro il dissesto idrogeologico', riforma: 'Riforma della gestione dei rifiuti', sostegno: 'Incentivi alla mobilità sostenibile', regole: 'Limiti più severi alle emissioni' } }),
  area('agricoltura', 'Agricoltura', 'territorio', 'leaf', { national: 'Reddito agricolo', portfolio: 'Agricoltura', base: 3, pleased: ['imprese'], displeased: [], economy: {}, euFunds: true, problem: 'Agricoltori schiacciati da costi e prezzi bassi.', instruments: { investimento: 'Piano per l’irrigazione', riforma: 'Riforma delle filiere agroalimentari', sostegno: 'Ristori per le aziende colpite', regole: 'Meno burocrazia per i coltivatori' } }),
  area('sicurezza', 'Sicurezza', 'sicurezza', 'shield', { national: 'Sicurezza percepita', regional: { sicurezza: 1 }, portfolio: 'Interno', base: 5, pleased: ['anziani', 'famiglie'], displeased: [], economy: {}, security: true, problem: 'Reati in crescita e cittadini che non si sentono sicuri.', instruments: { investimento: 'Assunzioni straordinarie nelle forze dell’ordine', riforma: 'Prevenzione e riqualificazione delle periferie', sostegno: 'Operazioni straordinarie di controllo del territorio', regole: 'Pene più severe e nuovi reati' } }),
  area('difesa', 'Difesa', 'istituzioni', 'shield', { national: 'Capacità della difesa', portfolio: 'Difesa', base: 6, pleased: ['anziani'], displeased: ['giovani'], economy: { growth: 0.03 }, problem: 'Impegni internazionali e mezzi inadeguati.', instruments: { investimento: 'Ammodernamento dei mezzi della difesa', riforma: 'Riforma dello strumento militare', sostegno: 'Fondo per le missioni internazionali', regole: 'Nuove regole per l’industria della difesa' } }),
  area('giustizia', 'Giustizia', 'sicurezza', 'scales', { national: 'Tempi della giustizia', regional: { servizi: 0.3, sicurezza: 0.2 }, portfolio: 'Giustizia', base: 3, pleased: ['imprese'], displeased: [], economy: { growth: 0.03 }, problem: 'Processi lunghissimi e tribunali intasati.', instruments: { investimento: 'Assunzioni di magistrati e personale', riforma: 'Riforma del processo', sostegno: 'Digitalizzazione dei tribunali', regole: 'Separazione e riordino delle carriere' } }),
  area('immigrazione', 'Immigrazione', 'societa', 'globe', { national: 'Gestione dei flussi migratori', portfolio: 'Interno', base: 4, pleased: ['anziani'], displeased: ['giovani'], economy: {}, problem: 'Arrivi irregolari e sistema di accoglienza in affanno.', instruments: { investimento: 'Rete di accoglienza e integrazione', riforma: 'Riforma dei flussi di ingresso regolari', sostegno: 'Fondo per i comuni dell’accoglienza', regole: 'Rimpatri e controlli più rapidi' } }),
  area('cittadinanza', 'Cittadinanza', 'societa', 'flag', { national: 'Integrazione e diritti', portfolio: 'Interno', base: 1, pleased: ['giovani'], displeased: ['anziani'], economy: {}, problem: 'Giovani nati in Italia senza pieni diritti.', instruments: { investimento: 'Piano per l’integrazione scolastica', riforma: 'Riforma della legge sulla cittadinanza', sostegno: 'Corsi di lingua e orientamento', regole: 'Procedure più rapide per le domande' } }),
  area('casa', 'Casa', 'societa', 'town', { national: 'Accesso alla casa', portfolio: 'Infrastrutture', base: 5, pleased: ['giovani', 'fragili'], displeased: [], economy: {}, problem: 'Affitti alle stelle e case popolari insufficienti.', instruments: { investimento: 'Piano di edilizia residenziale pubblica', riforma: 'Riforma degli affitti', sostegno: 'Contributi per l’affitto', regole: 'Limiti agli affitti brevi' } }),
  area('famiglia', 'Famiglia', 'societa', 'heart', { national: 'Sostegno alle famiglie', portfolio: 'Famiglia', base: 5, pleased: ['famiglie'], displeased: [], economy: {}, problem: 'Costi di crescita dei figli troppo alti.', instruments: { investimento: 'Piano nazionale per gli asili nido', riforma: 'Riforma dell’assegno per i figli', sostegno: 'Bonus per le famiglie numerose', regole: 'Congedi parentali più flessibili' } }),
  area('giovani', 'Giovani', 'societa', 'users', { national: 'Opportunità per i giovani', portfolio: 'Sport e giovani', base: 3, pleased: ['giovani'], displeased: [], economy: {}, problem: 'Giovani che non studiano e non lavorano.', instruments: { investimento: 'Fondo per l’autonomia dei giovani', riforma: 'Riforma dell’apprendistato', sostegno: 'Bonus per il primo impiego', regole: 'Stage retribuiti obbligatori' } }),
  area('demografia', 'Natalità e demografia', 'societa', 'users', { national: 'Natalità', portfolio: 'Famiglia', base: 4, pleased: ['famiglie', 'giovani'], displeased: [], economy: {}, problem: 'Nascite in calo e Paese che invecchia.', instruments: { investimento: 'Piano pluriennale per la natalità', riforma: 'Riforma dei servizi per l’infanzia', sostegno: 'Assegno di nascita', regole: 'Lavoro agile per i genitori' } }),
  area('cultura', 'Cultura', 'sapere', 'book', { national: 'Offerta culturale', portfolio: 'Cultura', base: 2, pleased: ['giovani'], displeased: [], economy: { growth: 0.02 }, problem: 'Musei e teatri con risorse ridotte.', instruments: { investimento: 'Piano per il patrimonio culturale', riforma: 'Riforma dello spettacolo dal vivo', sostegno: 'Carta cultura per i giovani', regole: 'Nuove regole per le concessioni museali' } }),
  area('sport', 'Sport', 'societa', 'trophy', { national: 'Pratica sportiva', portfolio: 'Sport e giovani', base: 2, pleased: ['giovani', 'famiglie'], displeased: [], economy: {}, problem: 'Impianti sportivi fatiscenti.', instruments: { investimento: 'Piano per gli impianti sportivi', riforma: 'Riforma dello sport di base', sostegno: 'Voucher sportivi per i ragazzi', regole: 'Nuove regole per le società sportive' } }),
  area('turismo', 'Turismo', 'economia', 'globe', { national: 'Flussi turistici', portfolio: 'Turismo', base: 3, pleased: ['imprese'], displeased: [], economy: { growth: 0.05 }, problem: 'Turismo concentrato in poche città e stagioni.', instruments: { investimento: 'Piano per le destinazioni minori', riforma: 'Riforma delle strutture ricettive', sostegno: 'Incentivi alle imprese turistiche', regole: 'Regole sugli affitti turistici' } }),
  area('digitale', 'Digitale e tecnologia', 'sapere', 'energy', { national: 'Digitalizzazione del Paese', portfolio: 'Innovazione digitale', base: 4, pleased: ['imprese', 'giovani'], displeased: [], economy: { growth: 0.08 }, euFunds: true, problem: 'Aree senza banda larga e servizi pubblici non digitali.', instruments: { investimento: 'Banda ultralarga in tutto il Paese', riforma: 'Riforma dei servizi pubblici digitali', sostegno: 'Voucher per la digitalizzazione delle imprese', regole: 'Nuove regole su dati e intelligenza artificiale' } }),
  area('pa', 'Pubblica amministrazione', 'istituzioni', 'ministry', { national: 'Efficienza della pubblica amministrazione', regional: { servizi: 0.8 }, portfolio: 'Pubblica amministrazione', base: 3, pleased: ['imprese', 'famiglie'], displeased: [], economy: { growth: 0.04 }, problem: 'Uffici lenti e procedure infinite.', instruments: { investimento: 'Assunzioni e formazione nella PA', riforma: 'Riforma della dirigenza pubblica', sostegno: 'Rinnovo dei contratti pubblici', regole: 'Silenzio-assenso e tempi certi' } }),
  area('autonomie', 'Autonomie territoriali', 'istituzioni', 'map', { national: 'Equilibrio tra Stato e Regioni', portfolio: 'Affari regionali', base: 3, pleased: ['imprese'], displeased: ['fragili'], economy: {}, problem: 'Conflitti tra Stato, Regioni e Comuni.', instruments: { investimento: 'Fondo perequativo per i territori', riforma: 'Riforma delle autonomie regionali', sostegno: 'Trasferimenti straordinari ai Comuni', regole: 'Nuovo riparto delle competenze' } }),
  area('mezzogiorno', 'Mezzogiorno', 'economia', 'map', { national: 'Divario tra Nord e Sud', regional: { economia: 0.7, occupazione: 0.7, infrastrutture: 0.4 }, portfolio: 'Affari europei e Sud', base: 7, pleased: ['giovani', 'fragili'], displeased: [], economy: { growth: 0.08, unemployment: -0.15 }, forcedTarget: 'mezzogiorno', euFunds: true, problem: 'Il divario tra Nord e Sud si allarga.', instruments: { investimento: 'Piano per le infrastrutture del Sud', riforma: 'Riforma delle zone economiche speciali', sostegno: 'Decontribuzione per chi assume al Sud', regole: 'Sportello unico per gli investimenti' } }),
  area('esteri', 'Esteri', 'istituzioni', 'globe', { national: 'Peso internazionale', portfolio: 'Esteri', base: 2, pleased: ['imprese'], displeased: [], economy: { growth: 0.02 }, problem: 'L’Italia conta poco nei tavoli internazionali.', instruments: { investimento: 'Piano per la cooperazione allo sviluppo', riforma: 'Riforma della rete diplomatica', sostegno: 'Sostegno all’export delle imprese', regole: 'Nuove regole per l’internazionalizzazione' } }),
  area('europa', 'Europa', 'istituzioni', 'flag', { national: 'Rapporti con l’Unione europea', portfolio: 'Affari europei e Sud', base: 1, pleased: ['imprese'], displeased: [], economy: {}, problem: 'Tensioni con Bruxelles su conti e fondi.', instruments: { investimento: 'Piano di spesa dei fondi europei', riforma: 'Riforma della governance dei fondi', sostegno: 'Assistenza tecnica agli enti locali', regole: 'Recepimento accelerato delle direttive' } })
]);
export const AREA_BY_ID = Object.freeze(Object.fromEntries(POLICY_AREAS.map(item => [item.id, item])));
export const AREA_BY_LABEL = Object.freeze(Object.fromEntries(POLICY_AREAS.map(item => [item.label, item])));
export const areaOf = value => AREA_BY_ID[value] ?? AREA_BY_LABEL[value] ?? null;

// How a measure is paid for. Every option has a price somewhere else.
export const FINANCING = Object.freeze({
  deficit: { label: 'In deficit', detail: 'Nessun sacrificio oggi: sale il deficit, lo spread e il rischio di richiami europei.' },
  irpef: { label: 'Più IRPEF sui redditi alti', detail: 'Pagano famiglie con redditi medio-alti e professionisti.', tax: { famiglie: -1.2, imprese: -0.6 }, growth: -0.01 },
  imprese: { label: 'Contributo delle grandi imprese', detail: 'Pagano le imprese: meno investimenti e crescita.', tax: { imprese: -2 }, growth: -0.03 },
  consumi: { label: 'Accise e IVA', detail: 'Pagano tutti, soprattutto chi ha redditi bassi; i prezzi salgono.', tax: { fragili: -1.6, anziani: -0.8, famiglie: -0.6 }, inflation: 0.08 },
  rendite: { label: 'Tassa sulle rendite finanziarie', detail: 'Pagano risparmiatori e pensionati con patrimoni.', tax: { anziani: -1, famiglie: -0.3 }, growth: -0.01 },
  evasione: { label: 'Recupero dell’evasione', detail: 'Gettito incerto e lento: se non arriva, il buco finisce in deficit.', tax: { imprese: -0.5 }, uncertain: 0.6 },
  tagli: { label: 'Tagli a un altro settore', detail: 'Si toglie a un’area per dare a un’altra: chi perde protesta.' },
  ue: { label: 'Fondi europei', detail: 'Pesa poco sul bilancio ma richiede buoni rapporti con Bruxelles e tempi più lunghi.' }
});
export const INTENSITY = Object.freeze([
  { level: 1, label: 'Contenuta', cost: 0.6, effect: 0.6 },
  { level: 2, label: 'Media', cost: 1, effect: 1 },
  { level: 3, label: 'Ampia', cost: 1.7, effect: 1.45 }
]);
export const BILLION_PER_POINT = 1.5;

// Budget rules of the scenario: the European deficit reference and market pressure.
export const EU_DEFICIT_LIMIT = 3;
export const EU_PROCEDURE_WEEKS = 12;
export const SPREAD_BASE = 130;

// Decree-laws: urgent measures in force at once, lost if Parliament does not convert them within 60 days.
export const DECREE_RULES = Object.freeze({ conversionWeeks: 9, cooldownWeeks: 4, maxOpen: 2, lapseRecovery: 0.6 });
// Minimum weeks a bill spends in each phase of the parliamentary process.
export const STAGE_WEEKS = Object.freeze({ proposal: 0, commission: 2, amendments: 1, 'other-chamber': 1, 'final-vote': 1 });

// The Government's political direction: the line colours how partners, markets and citizens read every act.
export const GOVERNMENT_LINES = Object.freeze({
  rigore: { label: 'Rigore dei conti', detail: 'Mercati e Bruxelles più tranquilli; chi chiede spesa protesta.', spread: -12, pleased: ['imprese'], displeased: ['fragili'] },
  crescita: { label: 'Crescita e investimenti', detail: 'Più cantieri e lavoro; il deficit va sorvegliato.', spread: 6, pleased: ['imprese', 'giovani'], displeased: [] },
  equita: { label: 'Equità sociale', detail: 'Welfare e redditi bassi al centro; le imprese temono nuove tasse.', spread: 8, pleased: ['fragili', 'anziani'], displeased: ['imprese'] },
  sicurezza: { label: 'Sicurezza e ordine', detail: 'Più controllo del territorio; critiche su diritti e costi.', spread: 0, pleased: ['anziani', 'famiglie'], displeased: ['giovani'] },
  riforme: { label: 'Grandi riforme', detail: 'Cambiare le regole del Paese: tempi lunghi, molti nemici, eredità duratura.', spread: -4, pleased: ['imprese'], displeased: [] }
});

// The annual budget: groups of areas that the manovra can fund more, keep or cut.
export const BUDGET_SESSION = Object.freeze({ opensMonth: 10, deadline: '12-31', levels: [[-1, 'Taglio'], [0, 'Invariato'], [1, 'Aumento']] });

// Ministries of the simulated executive: each one answers for its areas.
export const MINISTRIES = Object.freeze([...new Set(POLICY_AREAS.map(item => item.portfolio))]);
export const areasOfPortfolio = portfolio => POLICY_AREAS.filter(item => item.portfolio === portfolio).map(item => item.id);
