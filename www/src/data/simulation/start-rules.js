// Where a career begins, beyond the level: the conditions a player starts with. A condition is a lever with a level
// from 0 to 3. The engine (start-engine.js) turns each level into real starting values (stats, relations, funds, the
// state of the party) and into pressures that go on during the game: debts to repay, an apparatus that does not trust
// an outsider, a party at war, enemies that strike back, a past that resurfaces, expectations to meet.
// The presets (outsider, debts, divided party, consolidated career) are fixed sets of levers; the custom scenario lets
// the player compose them under a budget of points. Everything here is simulated: no creditor, enemy, faction or
// person described by these rules is a real one.

export const START_BUDGET = 6;
export const START_LEVEL_MAX = 3;
// Careers older than this many weeks no longer show the starting conditions as "new" (the page keeps the history).
export const START_FRESH_WEEKS = 104;

// kind: 'vantaggio' costs points, 'zavorra' gives points back. party: 'member' = needs an existing party to join.
// minAge: the age needed for each level (the experience has to fit in a life).
export const START_LEVERS = Object.freeze([
  { id: 'rete', kind: 'vantaggio', label: 'Rete di relazioni', cost: 2, party: null, minAge: [0, 0, 0, 0],
    detail: 'Associazioni, redazioni, categorie e sindacati ti conoscono e ti rispondono: i rapporti con il territorio partono più alti e tornano più in fretta a quel livello.' },
  { id: 'risorse', kind: 'vantaggio', label: 'Risorse e fondi', cost: 1, party: null, minAge: [0, 0, 0, 0],
    detail: 'Un tesoretto personale per iniziare: i fondi di partenza crescono del 60% per livello e la prima campagna parte con più mezzi.' },
  { id: 'capitale', kind: 'vantaggio', label: 'Capitale politico', cost: 1, party: null, minAge: [0, 0, 0, 0],
    detail: 'Favori da spendere subito: un punto di partenza più alto di capitale politico.' },
  { id: 'esperienza', kind: 'vantaggio', label: 'Esperienza maturata', cost: 2, party: null, minAge: [0, 30, 35, 40],
    detail: 'Anni di lavoro alle spalle: esperienza, influenza e reputazione di partenza, anzianità che pesa nelle promozioni e, da iscritto, un incarico interno già ottenuto. Richiede almeno 30, 35 o 40 anni.' },
  { id: 'notorieta', kind: 'vantaggio', label: 'Notorietà', cost: 1, party: null, minAge: [0, 0, 0, 0],
    detail: 'Un nome già noto: più popolarità e visibilità, e più peso nelle campagne.' },
  { id: 'sostegno', kind: 'vantaggio', label: 'Sostegno nel partito', cost: 2, party: 'member', minAge: [0, 0, 0, 0],
    detail: 'Un dirigente ti protegge: più sostegno interno, rapporto con la leadership più alto e più facile ottenere le candidature.' },
  { id: 'radicamento', kind: 'vantaggio', label: 'Radicamento sul territorio', cost: 1, party: null, minAge: [0, 0, 0, 0],
    detail: 'Conosci le persone del tuo territorio: più popolarità locale, più volontari in campagna e una sezione più viva.' },
  { id: 'debiti', kind: 'zavorra', label: 'Debiti politici', gain: 2, party: null, minAge: [0, 0, 0, 0],
    detail: 'Qualcuno ti ha aiutato a partire e aspetta di essere ripagato: un creditore per livello, con favori da restituire. Chi resta senza risposta diventa un nemico.' },
  { id: 'nemici', kind: 'zavorra', label: 'Nemici e rivali', gain: 1, party: null, minAge: [0, 0, 0, 0],
    detail: 'Un avversario per livello ti ha preso di mira: rapporti peggiori con il rivale e attacchi ricorrenti che chiedono una risposta.' },
  { id: 'partito-diviso', kind: 'zavorra', label: 'Partito già diviso', gain: 2, party: 'member', minAge: [0, 0, 0, 0],
    detail: 'Il partito è spaccato in aree che non si parlano: meno coesione, scontri aperti e un congresso vicino, ma la leadership è contendibile e chi fa da arbitro conta.' },
  { id: 'outsider', kind: 'zavorra', label: 'Outsider', gain: 2, party: null, minAge: [0, 0, 0, 0],
    detail: 'Non hai un apparato alle spalle: poco peso nel partito e nelle istituzioni, ma freschezza agli occhi degli elettori. Più resti nei palazzi, meno sei un outsider. Non si abbina a un forte sostegno nel partito né a una lunga esperienza politica.' },
  { id: 'precedenti', kind: 'zavorra', label: 'Ombre del passato', gain: 1, party: null, minAge: [0, 0, 0, 0],
    detail: 'Una vicenda del passato pesa sul tuo nome: reputazione di partenza più bassa e, prima o poi, qualcuno la riporterà a galla.' },
  { id: 'aspettative', kind: 'zavorra', label: 'Aspettative alte', gain: 1, party: null, minAge: [0, 0, 0, 0],
    detail: 'Tutti si aspettano molto da te: alle elezioni il risultato atteso sale e deludere costa caro; se il consenso resta sotto le attese perdi sostegno.' }
]);
export const LEVER_BY_ID = Object.freeze(Object.fromEntries(START_LEVERS.map(lever => [lever.id, lever])));

// Levers that cannot be combined: an outsider has no party protector and no long political career.
export const START_EXCLUSIONS = Object.freeze([
  { lever: 'outsider', other: 'sostegno', max: 0, text: 'Un outsider non ha un protettore nel partito: togli il sostegno nel partito.' },
  { lever: 'outsider', other: 'esperienza', max: 1, text: 'Un outsider non ha una lunga carriera politica alle spalle: l’esperienza resta al livello 1.' }
]);

// The numbers behind every level (per level unless said). The interface describes them from here, so the text is the rule.
export const LEVER_EFFECTS = Object.freeze({
  rete: { relations: { civic: 4, media: 4, business: 3, unions: 3 }, base: { civic: 3, media: 3, business: 2, unions: 2 }, member: { relations: { leadership: 2 }, base: { leadership: 1 } } },
  risorse: { funds: 0.6, volunteers: 0, money: 0.12 },
  capitale: { capital: 6 },
  esperienza: { stats: { experience: 10, influence: 5, reputation: 3, popularity: 3 }, seniority: 8, nomination: 0.4, partyScore: 1, parlScore: 1, expectation: 0.5, rank: [0, 0, 1, 2] },
  notorieta: { stats: { popularity: 4, notoriety: 10 }, visibility: 3 },
  sostegno: { member: { support: 6, relations: { leadership: 6 }, base: { leadership: 3 } }, nomination: 0.5 },
  radicamento: { stats: { popularity: 3 }, territory: 4, volunteers: 2, vitality: 8 },
  debiti: { creditors: 1 },
  nemici: { enemies: 1, relations: { rival: -8 }, base: { rival: -5, leadership: -1 }, expectation: 0 },
  'partito-diviso': { cohesion: -10, conflicts: 1, conflict: [0, 62, 69, 76], support: -3, grievance: 12, loyalty: -6, congressWeeks: [0, 26, 20, 14], nomination: -0.5, partyScore: 2.5 },
  outsider: { stats: { popularity: 2, reputation: 2, notoriety: 4, influence: -3, experience: -3 }, relations: { civic: 3 }, base: { civic: 2 }, member: { support: -5, relations: { leadership: -6 }, base: { leadership: -4 } }, nomination: -0.5, partyScore: -1, parlScore: -0.5, appeal: 0.8, volunteers: -2, visibility: 2 },
  precedenti: { stats: { reputation: -4 }, shadows: 1 },
  aspettative: { expectation: 1.5, demand: 0.1 }
});

// The sets of levers behind each way of starting. "ordinaria" is the career as it has always been.
export const START_PROFILES = Object.freeze({
  ordinaria: {
    id: 'ordinaria', label: 'Inizio ordinario', levels: {},
    summary: 'Nessuna condizione particolare: parti dal percorso che hai scelto, senza favori da restituire e senza grandi alleati alle spalle.',
    gives: ['Una partenza neutra, la stessa di sempre'], costs: []
  },
  outsider: {
    id: 'outsider', label: 'Outsider', levels: { outsider: 3, notorieta: 2, rete: 1, radicamento: 1 },
    summary: 'Vieni da fuori dei palazzi: pochi appoggi nel partito e nelle istituzioni, ma visibilità e la fiducia di chi è stanco dei politici di professione. La freschezza svanisce man mano che ti integri.',
    gives: ['Più popolarità, notorietà e reputazione', 'Fascino sugli elettori: bonus nelle campagne', 'Rapporti con associazioni e redazioni'], costs: ['Meno influenza ed esperienza', 'Rapporto freddo con la leadership e candidature più difficili', 'Poco peso nelle promozioni di partito']
  },
  debiti: {
    id: 'debiti', label: 'Con debiti politici', levels: { debiti: 2, risorse: 2, capitale: 2, notorieta: 1 },
    summary: 'Qualcuno ti ha aiutato a partire con soldi e appoggi e ora aspetta di essere ripagato: favori da restituire, scadenze e, per chi resta senza risposta, un nuovo nemico.',
    gives: ['Fondi e capitale politico di partenza più alti', 'Un nome già noto'], costs: ['Due creditori con favori da restituire', 'Rifiutare crea nemici e scandali', 'Pagare costa capitale e reputazione']
  },
  'partito-diviso': {
    id: 'partito-diviso', label: 'Un partito già diviso', levels: { 'partito-diviso': 3, capitale: 2, sostegno: 1 }, party: 'member',
    summary: 'Entri in un partito spaccato in due aree che non si parlano: la leadership è contendibile e chi fa da arbitro conta, ma ogni scelta ti schiera e il congresso è vicino.',
    gives: ['Capitale politico e un protettore nel partito', 'Più peso nelle sfide interne finché dura la crisi'], costs: ['Coesione bassa, scontri aperti e un congresso a rischio', 'Una scissione possibile', 'Le aree ti chiedono di schierarti']
  },
  consolidata: {
    id: 'consolidata', label: 'Carriera già consolidata', levels: { esperienza: 3, rete: 2, sostegno: 1, aspettative: 3, nemici: 2, precedenti: 1 },
    summary: 'Hai alle spalle anni di lavoro: esperienza, rete e un nome che pesa, con un incarico interno già ottenuto. Ma tutti si aspettano di più da te, hai già dei nemici e qualche ombra.',
    gives: ['Esperienza, influenza e reputazione alte; anzianità', 'Un incarico nel partito già ottenuto (se iscritto)', 'Una rete di relazioni solida'], costs: ['Alle elezioni il risultato atteso è più alto', 'Due nemici che attaccano', 'Una vicenda del passato che può tornare', 'Richiede almeno 40 anni']
  },
  personalizzato: {
    id: 'personalizzato', label: 'Scenario personalizzato', levels: {}, custom: true,
    summary: 'Componi tu la partenza: spendi punti in vantaggi e accetta zavorre per averne altri. Resta segnato come scenario personalizzato nella Hall of Fame.',
    gives: ['Scegli tu vantaggi e zavorre', `${START_BUDGET} punti liberi di partenza`], costs: ['Nella Hall of Fame vale meno di una partenza ordinaria']
  }
});
export const START_PROFILE_ORDER = Object.freeze(['ordinaria', 'outsider', 'debiti', 'partito-diviso', 'consolidata', 'personalizzato']);

// ---------- the creditors, the enemies and the shadows of the past (simulated roles, never real people) ----------
export const DEBT_KINDS = Object.freeze({
  finanziatore: { label: 'un imprenditore che ha finanziato i tuoi esordi (figura simulata)', favor: 'una norma o un appalto che gli sta a cuore', relation: 'business', group: 'categorie produttive', risk: 'Un favore a un finanziatore, se si sa, fa scandalo' },
  capocorrente: { label: 'il capo di un’area del partito che ti ha sostenuto (figura simulata)', favor: 'un posto in lista per un suo fedelissimo', relation: 'leadership', group: 'la leadership del partito', party: true, risk: 'Il posto promesso a un fedelissimo non piace alle altre aree' },
  sindacato: { label: 'una federazione sindacale che ha messo la sua rete al tuo servizio (figura simulata)', favor: 'un impegno pubblico su salari e contratti', relation: 'unions', group: 'i sindacati', risk: 'L’impegno preso pesa sui conti e sulle altre categorie' },
  territorio: { label: 'i comitati e le associazioni che ti hanno portato in piazza (figura simulata)', favor: 'un intervento sul territorio che aspettano da anni', relation: 'civic', group: 'associazioni e comitati', risk: 'L’intervento promesso crea malumori altrove' }
});
export const ENEMY_LABELS = Object.freeze([
  'un avversario interno che ti vuole fuori (figura simulata)', 'un notabile locale che ti considera un intruso (figura simulata)',
  'un commentatore che ti ha preso di mira (figura simulata)', 'un ex alleato rimasto con il dente avvelenato (figura simulata)'
]);
export const SHADOW_LABELS = Object.freeze([
  'una vecchia vicenda professionale', 'una polemica di anni fa', 'un’inchiesta chiusa ma mai dimenticata', 'un incarico passato finito male'
]);

// ---------- the pace of the pressures (weeks from the start) ----------
export const START_PACE = Object.freeze({
  firstDebt: 6, debtSpacing: 9, debtDeferWeeks: 8, debtGraceDeferrals: 2,
  dividedEvent: 2, outsiderEvent: 4, legacyEvent: 3, outsiderIntegrationYears: 2,
  firstEnemyAttack: 18, enemyCalmWeeks: 52, enemySpacing: 30,
  firstShadow: 24, shadowSpacing: 30, expectationEvery: 26, expectationFloor: 45
});

// ---------- the decisions the starting conditions put on the desk ----------
const choice = (id, label, extra = {}) => ({ id, label, ...extra });
export const START_SITUATIONS = Object.freeze({
  'start-debito': {
    id: 'start-debito', title: 'Un debito da onorare', body: '{creditor} ricorda l’aiuto che ti ha dato e chiede {favor}. {pressure} Pagare costa capitale politico e qualche rischio; rimandare lo fa arrabbiare; rifiutare lo trasforma in un nemico. {risk}',
    defaultChoice: 'attendi', choices: [
      choice('salda', 'Onora il debito: {favor} (4 capitale)', { cost: { capital: 4 }, effects: { relations: { target: 8 }, stats: { reputation: -0.5 } }, special: 'start-debt-pay',
        later: { weeks: 10, hint: 'Il favore concesso potrebbe fare rumore', label: 'Il favore concesso fa discutere', chance: 0.3, effects: { stats: { reputation: -2, notoriety: 1 } }, memory: { kind: 'scandalo', text: 'Un favore concesso a chi ti aveva aiutato ha fatto discutere', weight: 0.8 } } }),
      choice('tratta', 'Chiedi tempo: ne riparliamo tra due mesi (1 giorno, 1 capitale)', { cost: { ap: 1, capital: 1 }, effects: { relations: { target: -1 } }, special: 'start-debt-defer' }),
      choice('rifiuta', 'Rifiuta: nessun favore in cambio dell’aiuto', { effects: { relations: { target: -10 }, stats: { reputation: 1 } }, special: 'start-debt-refuse',
        memory: { kind: 'alleato-tradito', text: 'Hai rifiutato di onorare un debito politico', weight: 1.2 },
        later: { weeks: 8, hint: 'Il creditore potrebbe parlare con la stampa', label: 'Il creditore tradito parla con la stampa', chance: 0.55, effects: { stats: { reputation: -3, notoriety: 1.5 } }, memory: { kind: 'scandalo', text: 'Un ex alleato ti accusa di non rispettare i patti', weight: 1 } } }),
      choice('attendi', 'Lascia correre per ora', { effects: { relations: { target: -3 } }, special: 'start-debt-defer' })
    ]
  },
  'start-partito-spaccato': {
    id: 'start-partito-spaccato', title: 'Un partito spaccato in due', body: '{currentA} e {currentB} non si parlano più e il partito rischia la rottura. Entrambe le aree ti cercano: da chi ti schiererai pesa sul tuo futuro interno, e restare fuori costa coesione. Coesione del partito: {cohesion}/100.',
    defaultChoice: 'fuori', choices: [
      choice('ponte', 'Fai da pontiere tra le due aree (1 giorno, 3 capitale)', { cost: { ap: 1, capital: 3 }, effects: { org: { conflicts: -25, cohesion: 4 }, stats: { influence: 1 } }, special: 'start-divided-bridge',
        outcomes: [{ chance: 0.6, label: 'Le due aree riaprono il dialogo', effects: { org: { cohesion: 5, conflicts: -15 }, relations: { leadership: 3 } }, memory: { kind: 'lealta', text: 'Hai tenuto insieme un partito spaccato', weight: 1.3 } },
          { chance: 0.4, label: 'La mediazione viene bruciata e passi per ambiguo', effects: { stats: { reputation: -1 }, relations: { otherCurrents: -2 } } }] }),
      choice('a', 'Schierati con {currentA}', { effects: { relations: { currentA: 8, otherCurrents: -5 }, org: { conflicts: 8 } }, special: 'start-divided-side' }),
      choice('b', 'Schierati con {currentB}', { effects: { relations: { target: 8, otherCurrents: -5 }, org: { conflicts: 8 } }, special: 'start-divided-side' }),
      choice('fuori', 'Resta fuori dallo scontro', { effects: { org: { cohesion: -3 } } })
    ]
  },
  'start-outsider-apparato': {
    id: 'start-outsider-apparato', title: 'L’apparato ti nota', body: 'Un dirigente propone di “normalizzarti” con un incarico nelle strutture: ti darebbe appoggi e un posto al tavolo, ma ti toglierebbe lo status di chi viene da fuori. Come outsider sei {level}/3: la freschezza vale voti, ma senza apparato le promozioni restano difficili.',
    defaultChoice: 'resta', choices: [
      choice('accetta', 'Accetta la protezione dell’apparato', { effects: { party: { support: 3 }, relations: { leadership: 6 }, stats: { influence: 1 } }, special: 'start-outsider-integrate' }),
      choice('resta', 'Resta fuori: la tua forza è essere un’altra cosa', { effects: { stats: { popularity: 1, notoriety: 1 }, relations: { leadership: -2 } }, special: 'start-outsider-keep' }),
      choice('sfida', 'Sfida l’apparato in pubblico (3 capitale)', { cost: { capital: 3 }, effects: { stats: { notoriety: 2, popularity: 1 }, relations: { leadership: -6, media: 4 } }, special: 'start-outsider-keep',
        outcomes: [{ chance: 0.55, label: 'La sfida ti dà ragione agli occhi dell’opinione pubblica', effects: { stats: { reputation: 1.5, popularity: 1 } } },
          { chance: 0.45, label: 'L’apparato si compatta contro di te', effects: { stats: { influence: -1.5 }, party: { support: -3 } } }] })
    ]
  },
  'start-nemico': {
    id: 'start-nemico', title: 'Un nemico torna all’attacco', body: '{enemy} è tornato alla carica con una campagna contro di te. Rispondere costa tempo e il silenzio non sempre paga.',
    defaultChoice: 'ignora', choices: [
      choice('replica', 'Rispondi punto su punto (1 giorno)', { cost: { ap: 1 }, outcomes: [
        { chance: 0.55, label: 'La replica funziona: l’attacco si ritorce contro di lui', effects: { stats: { reputation: 1.5, notoriety: 1 }, relations: { rival: 3 } } },
        { chance: 0.45, label: 'La polemica si allarga e fa rumore', effects: { stats: { reputation: -1.5, notoriety: 1 } } }] }),
      choice('accordo', 'Cerca un accordo riservato (4 capitale)', { cost: { capital: 4 }, effects: { relations: { rival: 8 } }, special: 'start-enemy-calm' }),
      choice('denuncia', 'Valuta una querela (600 €)', { cost: { funds: 600 }, outcomes: [
        { chance: 0.5, label: 'Il giudice ti dà ragione e l’avversario deve ritirare tutto', effects: { stats: { reputation: 2.5 }, funds: 800 } },
        { chance: 0.5, label: 'La querela è archiviata e la notizia torna sui giornali', effects: { stats: { reputation: -2 } } }] }),
      choice('ignora', 'Ignora l’attacco', { effects: { stats: { reputation: -1.5 }, relations: { rival: -2 } } })
    ]
  },
  'start-passato': {
    id: 'start-passato', title: 'Il passato torna a galla', body: 'Qualcuno ha riportato in prima pagina {shadow}. Nessuno lo ha dimenticato davvero e ora chiede spiegazioni: il modo in cui rispondi resterà nella memoria politica.',
    defaultChoice: 'silenzio', choices: [
      choice('chiarisci', 'Chiarisci tutto in pubblico (1 giorno, 2 capitale)', { cost: { ap: 1, capital: 2 }, special: 'start-shadow-handled', outcomes: [
        { chance: 0.6, label: 'Il chiarimento convince e la vicenda si sgonfia', effects: { stats: { reputation: 2 } }, memory: { kind: 'decisione', text: 'Hai chiarito una vicenda del passato senza girarci intorno', weight: 1 } },
        { chance: 0.4, label: 'Il chiarimento apre nuove domande', effects: { stats: { reputation: -1 } } }] }),
      choice('nega', 'Nega ogni addebito', { special: 'start-shadow-handled', outcomes: [
        { chance: 0.45, label: 'Nessuno insiste: per ora è chiusa', effects: {} },
        { chance: 0.55, label: 'Spuntano nuove carte: la smentita crolla', effects: { stats: { reputation: -4, notoriety: 1 } }, memory: { kind: 'scandalo', text: 'Una smentita sul tuo passato è crollata', weight: 1.4 } }] }),
      choice('silenzio', 'Non commentare', { effects: { stats: { reputation: -1.5 } }, special: 'start-shadow-handled' })
    ]
  },
  'start-eredita': {
    id: 'start-eredita', title: 'Il nome che porti', body: 'Il nome di {predecessor} ({tier}) è ancora ricordato: colleghi, giornalisti ed elettori ti confrontano con lui, e per molti sei il suo erede politico. Puoi onorare quel nome o prendere le distanze: in ogni caso, sarai giudicato anche per lui.',
    defaultChoice: 'onora', choices: [
      choice('onora', 'Onora il nome che porti', { effects: { stats: { notoriety: 2.5 }, relations: { media: 3 }, party: { support: 1 } }, memory: { kind: 'decisione', text: 'Hai raccolto l’eredità politica di {predecessor}', weight: 0.8 } }),
      choice('distanzia', 'Prendi le distanze: sei una persona nuova', { effects: { stats: { reputation: 1, popularity: 1 }, relations: { leadership: -1 } }, memory: { kind: 'decisione', text: 'Hai preso le distanze da {predecessor}', weight: 0.6 } })
    ]
  },
  'start-attese': {
    id: 'start-attese', title: 'Ci aspettavamo di più', body: 'Con il tuo nome e il tuo percorso, nel partito e fuori si aspettavano molto di più: la tua popolarità è {popularity} contro attese di {expected}. Puoi rilanciare, ammettere che le attese erano troppe e chiedere pazienza (a un prezzo), o far finta di niente: le attese restano dove sono.',
    defaultChoice: 'ignora', choices: [
      choice('rilancia', 'Rilancia con una nuova iniziativa (2 giorni, 2 capitale)', { cost: { ap: 2, capital: 2 }, effects: { prep: 5, stats: { notoriety: 1.5, popularity: 1 } } }),
      choice('pazienza', 'Chiedi pazienza e ridimensiona le attese', { effects: { stats: { reputation: -1.5 }, party: { support: -2 } }, special: 'start-expectation-lower' }),
      choice('ignora', 'Fai finta di niente', { effects: { stats: { reputation: -0.5 } } })
    ]
  }
});
