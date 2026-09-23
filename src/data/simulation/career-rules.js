// Weekly career gameplay. Every value, character and event below is simulation
// content: no real person, party position or result is asserted here.
export const WEEKLY_ACTION_POINTS = 6;
export const BASE_WEEKLY_INCOME = 250;

export const ACTIVITY_CATEGORIES = Object.freeze({
  territorio: 'Territorio', media: 'Media', partito: 'Partito', parlamento: 'Parlamento',
  relazioni: 'Relazioni', risorse: 'Risorse', elezioni: 'Preparazione elettorale'
});

export const STAT_LABELS = Object.freeze({
  consensus: 'Consenso', popularity: 'Popolarità', reputation: 'Reputazione', notoriety: 'Notorietà', influence: 'Influenza', experience: 'Esperienza'
});

// Parliamentary actions are paid with the week's working days.
export const PARLIAMENT_TIME_COSTS = Object.freeze({
  joinGroup: 1, contestRole: 1, proposeLaw: 1, amendLaw: 1, negotiateLaw: 1, compromiseLaw: 1,
  advanceLaw: 1, formGovernment: 1, governmentSupport: 1, reviseCoalition: 1, assignMinister: 1, confidence: 1, crisis: 1
});

export const WEEKLY_ACTIVITIES = Object.freeze([
  { id: 'ascolto', category: 'territorio', label: 'Giro di ascolto', detail: 'Mercati, quartieri e sedi di associazione: presenza costante, poco rischio.', cost: { ap: 1, funds: 150 }, effects: { stats: { popularity: 1.4, consensus: 0.3, notoriety: 0.4 }, relations: { civic: 2 } }, risk: { chance: 0.06, label: 'Una contestazione rovina l’incontro', effects: { stats: { popularity: -1 } } } },
  { id: 'associazioni', category: 'territorio', label: 'Rete con associazioni e comitati', detail: 'Costruisce fiducia duratura con chi organizza il territorio.', cost: { ap: 2, funds: 250 }, effects: { stats: { consensus: 0.6, reputation: 0.8 }, relations: { civic: 6 } }, risk: { chance: 0.1, label: 'Un comitato ti accusa di fare passerella', effects: { relations: { civic: -4 }, stats: { reputation: -0.5 } } } },
  { id: 'cittadini', category: 'territorio', target: 'segment', label: 'Incontra un gruppo di cittadini', detail: 'Giovani, famiglie, pensionati, imprese o chi fa fatica: ognuno ha priorità diverse e ricorda chi lo ascolta.', cost: { ap: 1, funds: 100 }, effects: { stats: { popularity: 0.8, consensus: 0.2 } }, society: { segment: 2.5 }, risk: { chance: 0.12, label: 'Ti rinfacciano promesse non mantenute', effects: { stats: { reputation: -0.8 } } } },
  { id: 'progetto', category: 'territorio', label: 'Progetto per il territorio', detail: 'Un dossier concreto con amministratori e tecnici: lento ma solido.', cost: { ap: 3, funds: 800, capital: 2 }, effects: { stats: { reputation: 2, consensus: 1, experience: 1.2 }, relations: { civic: 4, business: 2 }, prep: 4 }, risk: { chance: 0.18, label: 'Il progetto si arena negli uffici', effects: { stats: { reputation: -1.5 } } } },
  { id: 'social', category: 'media', label: 'Campagna social', detail: 'Rapida ed economica; la credibilità conta più dei numeri.', cost: { ap: 1, funds: 120 }, effects: { stats: { notoriety: 1.8, popularity: 0.5 } }, risk: { chance: 0.2, label: 'Un post scatena una polemica', effects: { stats: { reputation: -1.8, notoriety: 0.8 } } } },
  { id: 'intervista', category: 'media', label: 'Intervista a un quotidiano', detail: 'Visibilità e rapporti con le redazioni.', cost: { ap: 1, capital: 1 }, effects: { stats: { notoriety: 2.6, reputation: 0.6 }, relations: { media: 3 } }, risk: { chance: 0.22, label: 'Un titolo travisa le tue parole', effects: { stats: { reputation: -2 }, relations: { leadership: -2 } } } },
  { id: 'talk', category: 'media', label: 'Ospite in un talk show', detail: 'Grande esposizione, alta probabilità di scontro.', cost: { ap: 2, funds: 200, capital: 2 }, effects: { stats: { notoriety: 4.5, popularity: 1.2, influence: 0.6 }, relations: { media: 4 } }, risk: { chance: 0.3, label: 'Scontro in diretta', effects: { stats: { reputation: -3, notoriety: 1 } } } },
  { id: 'conferenza', category: 'media', label: 'Conferenza stampa', detail: 'Rispondi alle domande dei giornalisti: il tono dei titoli dipende dalla tua reputazione.', cost: { ap: 1, funds: 200 }, effects: { stats: { notoriety: 2.2 }, relations: { media: 2 } }, media: { outlet: 'quotidiani', tone: 'reputation' }, risk: { chance: 0.15, label: 'Una domanda scomoda sui tuoi finanziatori', effects: { stats: { reputation: -1.2 } } } },
  { id: 'riunione', category: 'partito', requires: 'member', label: 'Riunione di partito', detail: 'Presenza negli organismi: il sostegno interno si costruisce qui.', cost: { ap: 1 }, effects: { party: { support: 3 }, relations: { leadership: 2 } } },
  { id: 'corrente', category: 'partito', requires: 'party', target: 'current', label: 'Lavora con una corrente', detail: 'Ti avvicina a un’area interna e ti allontana dalle altre.', cost: { ap: 2, capital: 2 }, effects: { party: { support: 2 }, relations: { target: 7, otherCurrents: -2 } } },
  { id: 'leadership', category: 'partito', requires: 'member', label: 'Incontro con la leadership', detail: 'Un canale diretto con chi decide candidature e incarichi.', cost: { ap: 1, capital: 3 }, effects: { relations: { leadership: 6 }, stats: { influence: 0.8 } }, risk: { chance: 0.15, label: 'La leadership ti riceve con freddezza', effects: { relations: { leadership: -3 } } } },
  { id: 'dissenso', category: 'partito', requires: 'member', label: 'Prendi posizione contro la linea', detail: 'Visibilità e peso personale, al prezzo del conflitto interno.', cost: { ap: 1 }, effects: { stats: { notoriety: 3, influence: 1.2, reputation: 0.5 }, party: { support: -6 }, relations: { leadership: -10 }, org: { discipline: -14, cohesion: -2 } }, later: { weeks: 3, chance: 0.35, hint: 'La segreteria potrebbe fartela pagare', label: 'La segreteria ti esclude da un tavolo importante', effects: { party: { support: -3 }, stats: { influence: -1 } } } },
  { id: 'tesseramento', category: 'partito', requires: 'party', label: 'Campagna di tesseramento', detail: 'Banchetti e porta a porta: nuovi iscritti per il partito e più peso per te.', cost: { ap: 1, funds: 150 }, effects: { org: { members: 1 }, party: { support: 1.5 } }, risk: { chance: 0.08, label: 'Polemica su tessere gonfiate', effects: { stats: { reputation: -1 }, party: { support: -2 } } } },
  { id: 'sezione', category: 'partito', requires: sit => sit.party && (sit.game.party.affiliation === 'founder' || sit.game.party.rank >= 1), requiresLabel: 'Serve un incarico nel partito (dal direttivo locale in su).', target: 'region', label: 'Apri o rilancia una sezione', detail: 'Una sede con volontari: radica il partito in una regione.', cost: { ap: 2, funds: 600, capital: 2 }, effects: { org: { section: true }, stats: { popularity: 0.5 }, party: { support: 1 } } },
  { id: 'formazione', category: 'partito', requires: sit => sit.party && (sit.game.party.affiliation === 'founder' || sit.game.party.rank >= 1), requiresLabel: 'Serve un incarico nel partito (dal direttivo locale in su).', label: 'Scuola di formazione per militanti', detail: 'Militanti più preparati e un partito più compatto.', cost: { ap: 1, funds: 300 }, effects: { org: { militants: 0.05, cohesion: 3 }, stats: { experience: 0.5 } } },
  { id: 'contributo', category: 'partito', requires: 'party', label: 'Versa un contributo al partito', detail: 'Sostieni la tesoreria: la leadership se ne ricorda.', cost: { funds: 500 }, effects: { org: { treasury: 500 }, party: { support: 2 }, relations: { leadership: 2 } } },
  { id: 'campagna-partito', category: 'partito', requires: sit => sit.party && (sit.game.party.affiliation === 'founder' || sit.game.party.rank >= 2), requiresLabel: 'Serve un ruolo regionale o nazionale nel partito.', label: 'Campagna di comunicazione del partito', detail: 'Spot e manifesti pagati dalla tesoreria: sposta i sondaggi del partito.', cost: { ap: 1, capital: 2, treasury: 1200 }, effects: { org: { communication: true }, world: 0.35, stats: { notoriety: 1 } }, media: { outlet: 'tv-nazionale', tone: 1 } },
  { id: 'mediazione-correnti', category: 'partito', requires: sit => sit.party && (sit.game.party.affiliation === 'founder' || sit.game.party.rank >= 2), requiresLabel: 'Serve un ruolo regionale o nazionale nel partito.', label: 'Media tra le correnti', detail: 'Ricuci gli scontri interni prima che diventino una crisi.', cost: { ap: 2, capital: 2 }, effects: { org: { conflicts: -30, cohesion: 4 }, party: { support: 2 } } },
  { id: 'disciplina', category: 'partito', requires: sit => sit.party && (sit.game.party.affiliation === 'founder' || sit.game.party.rank >= 3), requiresLabel: 'Serve un posto in direzione nazionale o la guida del partito.', label: 'Richiama il partito all’unità', detail: 'Linea comune e regole per tutti: più coesione, qualche malumore.', cost: { ap: 1, capital: 3 }, effects: { org: { cohesion: 8, conflicts: -15 }, relations: { rival: -4 } } },
  { id: 'aula', category: 'parlamento', requires: 'seat', label: 'Lavoro in commissione e in Aula', detail: 'Presenza, dossier e relazioni dentro il gruppo.', cost: { ap: 2 }, effects: { stats: { experience: 1.6, influence: 0.8 }, group: { support: 3 } } },
  { id: 'interrogazione', category: 'parlamento', requires: 'seat', label: 'Interrogazione sul tuo territorio', detail: 'Porti in Aula il problema più grave della tua regione: il governo deve rispondere, i cittadini se ne accorgono.', cost: { ap: 1, capital: 1 }, effects: { stats: { experience: 0.8, notoriety: 0.6 }, government: { stability: -1 } }, society: { homeTrust: 1.5 }, media: { outlet: 'stampa-locale', tone: 1 } },
  { id: 'diplomazia', category: 'parlamento', requires: 'seat', target: 'group', label: 'Diplomazia con un gruppo', detail: 'Migliora il rapporto con un gruppo: pesa su trattative e votazioni.', cost: { ap: 1, capital: 2 }, effects: { groups: { target: 5 }, stats: { influence: 0.4 } } },
  { id: 'incontro', category: 'relazioni', target: 'character', label: 'Incontro riservato', detail: 'Un caffè lontano dai riflettori.', cost: { ap: 1, funds: 120 }, effects: { relations: { target: 6 } }, risk: { chance: 0.1, label: 'L’incontro finisce sui giornali', effects: { stats: { reputation: -1 }, relations: { target: -2 } } } },
  { id: 'incontro-parlamentare', category: 'relazioni', target: 'contact', label: 'Incontra un parlamentare', detail: 'Persone reali del Parlamento: il rapporto (simulato) pesa su firme, emendamenti e voti.', cost: { ap: 1, capital: 1 }, effects: { contacts: { target: 8 }, stats: { influence: 0.3 } }, risk: { chance: 0.1, label: 'L’incontro resta formale', effects: { contacts: { target: -3 } } } },
  { id: 'mediazione', category: 'relazioni', target: 'character', label: 'Mediazione politica', detail: 'Chiude un contrasto con un accordo esplicito.', cost: { ap: 2, capital: 3 }, effects: { relations: { target: 11 }, stats: { influence: 1 } } },
  { id: 'raccolta', category: 'risorse', label: 'Raccolta fondi', detail: 'Cene e contributi tracciati: risorse per le prossime settimane.', cost: { ap: 1 }, effects: { funds: 1200 }, risk: { chance: 0.15, label: 'Polemica sui finanziatori', effects: { stats: { reputation: -1.5 } } } },
  { id: 'crowdfunding', category: 'risorse', label: 'Raccolta fondi online', detail: 'Piccole donazioni dai sostenitori: più sei popolare, più raccogli; se nessuno risponde, la notizia gira.', cost: { ap: 1, funds: 80 }, effects: { fundsFrom: { stat: 'popularity', factor: 22, min: 150 } }, risk: { chance: 0.12, label: 'Pochi donatori: la raccolta diventa un caso', effects: { stats: { notoriety: 0.5, reputation: -1 } } } },
  { id: 'dossier', category: 'risorse', label: 'Studio dei dossier', detail: 'Esperienza e un po’ di capitale politico.', cost: { ap: 1 }, effects: { stats: { experience: 1.4 }, capital: 1 } },
  { id: 'preparazione', category: 'elezioni', label: 'Prepara la candidatura', detail: 'Programma, sondaggi interni e contatti: aumenta la preparazione elettorale.', cost: { ap: 2, funds: 400 }, effects: { prep: 10, party: { support: 1 } } },
  { id: 'squadra', category: 'elezioni', label: 'Costruisci la squadra elettorale', detail: 'Volontari e coordinatori pronti per la campagna.', cost: { ap: 2, funds: 700 }, effects: { prep: 8, relations: { civic: 3 } } }
]);

export const RELATION_TEMPLATES = Object.freeze([
  { id: 'leadership', label: 'Leadership del partito', kind: 'Partito', requires: 'member', base: 50 },
  { id: 'rival', label: 'Rivale', kind: 'Personaggio simulato', base: 40 },
  { id: 'civic', label: 'Associazioni e comitati', kind: 'Territorio', base: 45 },
  { id: 'media', label: 'Redazioni locali', kind: 'Media', base: 45 },
  { id: 'business', label: 'Categorie produttive', kind: 'Territorio', base: 45 },
  { id: 'unions', label: 'Sindacati', kind: 'Territorio', base: 45 }
]);

// No documented person fits an internal rival of a player-made politician: the role stays explicitly simulated.
export const SIMULATED_RIVAL_LABEL = 'Rivale interno (figura simulata)';
export const LEGACY_RIVAL_NAMES = Object.freeze(['Marco Ferri', 'Laura Conti', 'Paolo Serra', 'Chiara Villa', 'Andrea Galli', 'Sara Fontana', 'Luca Moretti', 'Elena Rizzo']);

export const CURRENT_TEMPLATES = Object.freeze([
  { id: 'riformisti', label: 'Area riformista' },
  { id: 'territori', label: 'Area dei territori' },
  { id: 'movimento', label: 'Area movimentista' }
]);

export const PARTY_RANKS = Object.freeze([
  { level: 0, title: 'Iscritto', threshold: null, weeklyIncome: 0 },
  { level: 1, title: 'Coordinatore locale', threshold: 48, weeklyIncome: 80 },
  { level: 2, title: 'Responsabile regionale', threshold: 56, weeklyIncome: 150 },
  { level: 3, title: 'Membro della direzione nazionale', threshold: 64, weeklyIncome: 220 },
  { level: 4, title: 'Vicesegretario', threshold: 72, weeklyIncome: 300 }
]);
export const FOUNDER_RANK = Object.freeze({ level: 4, title: 'Segretario e fondatore', weeklyIncome: 150 });

// Simulated calendar: cycles are compressed compared with real terms of office.
export const ELECTION_SCHEDULE = Object.freeze({
  comunale: { firstWeeks: 7, cycleWeeks: 56, windowDays: 14 },
  regionale: { firstWeeks: 11, cycleWeeks: 64, windowDays: 14 },
  politiche: { firstWeeks: 20, cycleWeeks: 78, windowDays: 14 },
  europee: { firstWeeks: 30, cycleWeeks: 96, windowDays: 14 }
});
export const LEVEL_FIRST_ELECTION = Object.freeze({ comunale: { comunale: 4 }, regionale: { regionale: 5 }, deputato: { politiche: 26 }, senatore: { politiche: 26 } });
export const EARLY_ELECTION_AFTER_WEEKS = 4;

export const OFFICE_INCOME = Object.freeze([
  { match: /ministro/i, amount: 650 }, { match: /deputat|senat/i, amount: 900 }, { match: /sindac|presidente di regione/i, amount: 600 },
  { match: /consiglier|parlamento europeo/i, amount: 350 }, { match: /commissione/i, amount: 150 }
]);

// Weekly appointments: optional opportunities that expire at the end of the week.
export const APPOINTMENTS = Object.freeze([
  { id: 'inaugurazione', title: 'Inaugurazione a {municipality}', body: 'Il comune inaugura uno spazio pubblico rinnovato e ti invita a intervenire.', choices: [
    { id: 'partecipa', label: 'Partecipa', cost: { ap: 1 }, effects: { stats: { popularity: 1.5, reputation: 0.5 }, relations: { civic: 2 } } },
    { id: 'declina', label: 'Declina', effects: {} }] },
  { id: 'assemblea', when: 'member', title: 'Assemblea degli iscritti', body: 'La base del partito si riunisce: chi c’è conta nelle scelte sulle candidature.', choices: [
    { id: 'intervieni', label: 'Intervieni', cost: { ap: 1 }, effects: { party: { support: 4 }, relations: { leadership: 1 } } },
    { id: 'assente', label: 'Non partecipare', effects: { party: { support: -0.5 } } }] },
  { id: 'imprenditori', title: 'Incontro con le categorie produttive', body: 'Imprese e commercianti chiedono attenzione su tasse locali e infrastrutture.', choices: [
    { id: 'partecipa', label: 'Partecipa', cost: { ap: 1 }, effects: { relations: { business: 6 }, funds: 300, stats: { notoriety: 0.5 } } },
    { id: 'declina', label: 'Declina', effects: { relations: { business: -1 } } }] },
  { id: 'sindacati', title: 'Tavolo con i sindacati', body: 'Una vertenza locale cerca interlocutori politici.', choices: [
    { id: 'partecipa', label: 'Siediti al tavolo', cost: { ap: 1 }, effects: { relations: { unions: 6 }, stats: { consensus: 0.3 } } },
    { id: 'declina', label: 'Declina', effects: { relations: { unions: -1 } } }] },
  { id: 'radio', title: 'Intervista radiofonica', body: 'Una radio locale ti offre mezz’ora in diretta.', choices: [
    { id: 'accetta', label: 'Accetta', cost: { ap: 1 }, effects: { stats: { notoriety: 2 }, relations: { media: 2 } }, risk: { chance: 0.15, label: 'Una battuta infelice gira sui social', effects: { stats: { reputation: -1 } } } },
    { id: 'declina', label: 'Declina', effects: {} }] },
  { id: 'festa', title: 'Festa di quartiere', body: 'Un’occasione informale per farti conoscere.', choices: [
    { id: 'partecipa', label: 'Partecipa', cost: { ap: 1 }, effects: { stats: { popularity: 2 }, relations: { civic: 3 } } },
    { id: 'declina', label: 'Declina', effects: {} }] },
  { id: 'scuola', title: 'Incontro in una scuola superiore', body: 'Studenti e docenti ti invitano a parlare di istituzioni.', choices: [
    { id: 'partecipa', label: 'Partecipa', cost: { ap: 1 }, effects: { stats: { reputation: 1, popularity: 1 } } },
    { id: 'declina', label: 'Declina', effects: {} }] },
  { id: 'audizione', when: 'seat', title: 'Audizione in commissione', body: 'Esperti e associazioni presentano un dossier sul tuo tema.', choices: [
    { id: 'partecipa', label: 'Partecipa', cost: { ap: 1 }, effects: { stats: { experience: 2 }, group: { support: 2 } } },
    { id: 'assente', label: 'Assente', effects: { group: { support: -1 } } }] },
  { id: 'riunione-gruppo', when: 'seat', title: 'Riunione del gruppo parlamentare', body: 'Si decide la linea sui prossimi voti.', choices: [
    { id: 'partecipa', label: 'Partecipa', cost: { ap: 1 }, effects: { group: { support: 3 } } },
    { id: 'assente', label: 'Assente', effects: { group: { support: -1.5 } } }] },
  { id: 'dossier-ministero', when: 'minister', title: 'Dossier del tuo ministero', body: 'Uffici e sottosegretari aspettano indicazioni su un provvedimento.', choices: [
    { id: 'segui', label: 'Segui il dossier', cost: { ap: 2 }, effects: { stats: { reputation: 2, experience: 2 }, government: { stability: 2 } } },
    { id: 'delega', label: 'Delega agli uffici', effects: { stats: { reputation: -0.5 }, government: { stability: -1 } } }] }
]);

// Contextual events with real alternatives; the default choice applies when the week closes.
export const CAREER_EVENTS = Object.freeze([
  { id: 'protesta', weight: 3, title: 'Protesta dei residenti a {municipality}', body: 'Un cantiere fermo da mesi porta in piazza residenti e commercianti.', defaultChoice: 'ignora', choices: [
    { id: 'piazza', label: 'Vai in piazza ad ascoltare', cost: { ap: 1 }, effects: { stats: { popularity: 3 }, relations: { civic: 5 } }, risk: { chance: 0.25, label: 'Vieni contestato davanti alle telecamere', effects: { stats: { popularity: -2, notoriety: 1 } } } },
    { id: 'dichiarazione', label: 'Rilascia una dichiarazione', effects: { stats: { notoriety: 1, popularity: -0.5 } } },
    { id: 'ignora', label: 'Non intervenire', effects: { stats: { popularity: -1.5 }, relations: { civic: -3 } }, later: { weeks: 3, chance: 0.5, hint: 'La protesta potrebbe allargarsi', label: 'La protesta si allarga a tutto il quartiere', effects: { stats: { popularity: -2 }, relations: { civic: -3 } } } }] },
  { id: 'collaboratore', weight: 2, when: ctx => ctx.stats.notoriety >= 25, title: 'Un collaboratore finisce sotto inchiesta', body: 'Scandalo simulato: un membro del tuo staff è indagato per una consulenza.', defaultChoice: 'silenzio', choices: [
    { id: 'distanze', label: 'Prendi subito le distanze', effects: { stats: { reputation: -1 }, relations: { leadership: 2 } } },
    { id: 'difendi', label: 'Difendilo pubblicamente', outcomes: [
      { chance: 0.5, label: 'Le accuse cadono: la tua lealtà viene apprezzata', effects: { stats: { reputation: 1.5, notoriety: 2 } } },
      { chance: 0.5, label: 'Emergono nuovi elementi: la tua difesa si ritorce contro di te', effects: { stats: { reputation: -6 }, relations: { leadership: -4 } } }] },
    { id: 'silenzio', label: 'Resta in silenzio', effects: { stats: { reputation: -1.5, notoriety: 1 } } }] },
  { id: 'rivale', weight: 2, title: 'Il tuo rivale interno ti attacca pubblicamente', body: 'Un rivale interno (figura simulata) mette in dubbio il tuo lavoro davanti a iscritti e giornalisti.', defaultChoice: 'lascia', choices: [
    { id: 'rispondi', label: 'Rispondi colpo su colpo', effects: { stats: { notoriety: 3 }, relations: { rival: -8 }, party: { support: -2 } } },
    { id: 'chiarimento', label: 'Cerca un chiarimento', cost: { capital: 2 }, effects: { relations: { rival: 8 }, party: { support: 1 } } },
    { id: 'lascia', label: 'Lascia correre', effects: { party: { support: -1 }, stats: { influence: -0.5 } } }] },
  { id: 'lista-civica', weight: 2, when: ctx => !ctx.seat, title: 'Una lista civica propone un’alleanza', body: 'Un gruppo di amministratori locali cerca un riferimento per le prossime elezioni.', defaultChoice: 'rifiuta', choices: [
    { id: 'accetta', label: 'Accetta l’alleanza', cost: { capital: 2 }, effects: { relations: { civic: 6, leadership: -2 }, prep: 8, stats: { consensus: 0.5 } }, later: { weeks: 8, chance: 0.35, hint: 'La lista civica potrebbe chiedere qualcosa in cambio', label: 'La lista civica pretende posti e visibilità', effects: { relations: { leadership: -3, civic: 2 }, stats: { reputation: -0.5 } } } },
    { id: 'tempo', label: 'Prendi tempo', effects: { relations: { civic: -1 } } },
    { id: 'rifiuta', label: 'Rifiuta', effects: { relations: { civic: -3 } } }] },
  { id: 'prima-serata', weight: 2, when: ctx => ctx.stats.notoriety >= 30, title: 'Invito in prima serata', body: 'Un talk nazionale ti vuole ospite su un tema caldo.', defaultChoice: 'declina', choices: [
    { id: 'accetta', label: 'Accetta', cost: { ap: 2 }, effects: { stats: { notoriety: 5, popularity: 1.5 } }, risk: { chance: 0.3, label: 'Uno scivolone diventa virale', effects: { stats: { reputation: -3 } } } },
    { id: 'collaboratore', label: 'Manda un collaboratore', effects: { stats: { notoriety: 1 } } },
    { id: 'declina', label: 'Declina', effects: {} }] },
  { id: 'congresso', weight: 0, when: () => false, title: 'Congresso: {currentA} contro {currentB}', body: 'Due aree del partito si contendono la guida. Schierarsi può pagare molto o costare caro.', defaultChoice: 'neutrale', choices: [
    { id: 'a', label: 'Sostieni {currentA}', special: 'leadership-a' },
    { id: 'b', label: 'Sostieni {currentB}', special: 'leadership-b' },
    { id: 'neutrale', label: 'Resta neutrale', effects: { party: { support: -1 } } }] },
  { id: 'finanziatore', weight: 2, title: 'Un imprenditore offre un contributo', body: 'Il sostegno è generoso, ma chiede riservatezza.', defaultChoice: 'rifiuta', choices: [
    { id: 'trasparente', label: 'Accetta e rendilo pubblico', effects: { funds: 1500, stats: { reputation: -0.5 }, relations: { business: 3 } } },
    { id: 'rifiuta', label: 'Rifiuta', effects: { stats: { reputation: 1 }, relations: { business: -3 } } },
    { id: 'riservato', label: 'Accetta senza pubblicità', effects: { funds: 2800 }, special: 'flag-opaque-funding' }] },
  { id: 'maltempo', weight: 2, title: 'Maltempo e danni in {region}', body: 'Allagamenti e strade chiuse: la comunità aspetta risposte.', defaultChoice: 'solidarieta', choices: [
    { id: 'sul-posto', label: 'Coordina gli aiuti sul posto', cost: { ap: 2, funds: 300 }, effects: { stats: { reputation: 3, popularity: 3 }, relations: { civic: 4 } } },
    { id: 'fondi', label: 'Chiedi fondi straordinari', cost: { capital: 3 }, effects: { stats: { consensus: 1, influence: 1 } } },
    { id: 'solidarieta', label: 'Esprimi solidarietà', effects: { stats: { popularity: -1 } } }] },
  { id: 'tensione-maggioranza', weight: 3, when: ctx => ctx.seat && ctx.inMajority, title: 'Tensione nella maggioranza', body: 'Due alleati litigano su una nomina: il governo chiede lealtà.', defaultChoice: 'defilato', choices: [
    { id: 'sostieni', label: 'Sostieni il governo', effects: { group: { support: 3 }, government: { stability: 6 } } },
    { id: 'rimpasto', label: 'Chiedi un rimpasto', effects: { stats: { influence: 2 }, government: { stability: -8 }, groups: { coalition: -2 } } },
    { id: 'minaccia', label: 'Minaccia di uscire', effects: { stats: { influence: 3, notoriety: 2 }, government: { stability: -15 }, groups: { coalition: -5 }, org: { discipline: -10 } } },
    { id: 'defilato', label: 'Resta defilato', effects: { government: { stability: -3 } } }] },
  { id: 'decreto', weight: 3, when: ctx => ctx.seat && ctx.governing && !ctx.inMajority, title: 'Il governo presenta un decreto contestato', body: 'L’opposizione deve decidere come reagire in Aula.', defaultChoice: 'lascia', choices: [
    { id: 'ostruzionismo', label: 'Guida l’ostruzionismo', cost: { ap: 1 }, effects: { stats: { notoriety: 3 }, government: { stability: -5 }, group: { support: 2 }, groups: { coalition: -3 } } },
    { id: 'modifiche', label: 'Proponi modifiche costruttive', effects: { stats: { reputation: 2 }, groups: { coalition: 3 } } },
    { id: 'lascia', label: 'Lascia fare', effects: { group: { support: -1 } } }] },
  { id: 'corteggiamento', weight: 1, when: ctx => ctx.seat, title: 'Un altro gruppo ti corteggia', body: 'Ti offrono visibilità e un ruolo se cambi gruppo.', defaultChoice: 'ignora', choices: [
    { id: 'ascolta', label: 'Ascolta l’offerta', effects: { capital: 3, group: { support: -4 } }, later: { weeks: 4, chance: 0.4, hint: 'Il tuo gruppo potrebbe venirlo a sapere', label: 'Il tuo gruppo scopre la trattativa', effects: { group: { support: -5 }, org: { discipline: -6 } } } },
    { id: 'rifiuta', label: 'Rifiuta pubblicamente', effects: { group: { support: 4 }, stats: { notoriety: 1 } } },
    { id: 'ignora', label: 'Ignora', effects: {} }] },
  { id: 'crisi-ministero', weight: 3, when: ctx => ctx.minister, title: 'Emergenza nel tuo ministero', body: 'Un dossier esplode sui giornali: serve una risposta.', defaultChoice: 'tecnici', choices: [
    { id: 'responsabilita', label: 'Assumi la responsabilità', cost: { ap: 1 }, effects: { stats: { reputation: 2 }, government: { stability: 3 } }, risk: { chance: 0.3, label: 'La gestione viene giudicata tardiva', effects: { stats: { reputation: -3 } } } },
    { id: 'tecnici', label: 'Scarica sui tecnici', effects: { stats: { reputation: -1 }, government: { stability: -2 } } }] },
  { id: 'presa-posizione', weight: 0, when: () => false, title: 'Prendi posizione: {event}', body: '{eventBody}', defaultChoice: 'silenzio', choices: [
    { id: 'proposta', label: 'Intervieni con una proposta', cost: { ap: 1 }, effects: { stats: { notoriety: 2, reputation: 1 } }, special: 'world-stance-proposal' },
    { id: 'attacco', label: 'Attacca gli avversari', effects: { stats: { notoriety: 3, reputation: -0.5 }, relations: { media: 2 } }, special: 'world-stance-attack' },
    { id: 'silenzio', label: 'Resta in silenzio', effects: { stats: { notoriety: -0.5 } } }] },
  { id: 'sindacati-vertenza', weight: 1, title: 'Vertenza in una fabbrica del territorio', body: 'Lavoratori e azienda chiedono una mediazione politica.', defaultChoice: 'osserva', choices: [
    { id: 'lavoratori', label: 'Stai con i lavoratori', effects: { relations: { unions: 7, business: -4 }, stats: { popularity: 1 } } },
    { id: 'mediazione', label: 'Proponi una mediazione', cost: { ap: 1, capital: 2 }, effects: { relations: { unions: 3, business: 3 }, stats: { reputation: 1.5 } } },
    { id: 'osserva', label: 'Resta a guardare', effects: { relations: { unions: -2 } } }] }
]);

// Forced events are raised by the situation itself rather than drawn at random.
export const FORCED_EVENTS = Object.freeze({
  espulsione: { id: 'espulsione', title: 'Il partito valuta la tua espulsione', body: 'Il sostegno interno è crollato: la segreteria apre un procedimento.', defaultChoice: 'resisti', choices: [
    { id: 'ammenda', label: 'Fai ammenda', cost: { capital: 4 }, effects: { party: { support: 12 }, relations: { leadership: 5 }, stats: { reputation: -1 } } },
    { id: 'rompi', label: 'Rompi con il partito', special: 'leave-party', effects: { stats: { notoriety: 4, influence: -2 } } },
    { id: 'resisti', label: 'Resisti', outcomes: [
      { chance: 0.5, label: 'Il procedimento si chiude con un richiamo', effects: { party: { support: 4 } } },
      { chance: 0.5, label: 'La segreteria decide l’espulsione', special: 'expel', effects: { stats: { reputation: -2 } } }] }] },
  dimissioni: { id: 'dimissioni', title: 'Richieste di dimissioni', body: 'La tua reputazione è ai minimi: stampa e alleati chiedono un passo indietro.', defaultChoice: 'resisti', choices: [
    { id: 'dimettiti', label: 'Lascia gli incarichi', special: 'resign', effects: { stats: { reputation: 6 } } },
    { id: 'resisti', label: 'Resisti', outcomes: [
      { chance: 0.55, label: 'La tempesta passa, a fatica', effects: { stats: { reputation: 3, notoriety: 2 } } },
      { chance: 0.45, label: 'Alleati e sostenitori ti abbandonano: la carriera si chiude', special: 'end-career' }] }] },
  finanziamento: { id: 'finanziamento', title: 'Emerge il contributo non dichiarato', body: 'Un’inchiesta giornalistica ricostruisce il finanziamento ricevuto in modo riservato.', defaultChoice: 'nega', choices: [
    { id: 'ammetti', label: 'Ammetti e restituisci', cost: { funds: 2800 }, effects: { stats: { reputation: -3 } } },
    { id: 'nega', label: 'Nega tutto', outcomes: [
      { chance: 0.4, label: 'La notizia si sgonfia', effects: { stats: { reputation: -2 } } },
      { chance: 0.6, label: 'Le prove emergono: scandalo', effects: { stats: { reputation: -8 }, relations: { leadership: -6, media: -4 } } }] }] }
});

// Events raised by the concrete situation (territory, finances, party, Parliament) rather than drawn at random.
export const SITUATION_EVENTS = Object.freeze({
  'crisi-territoriale': { id: 'crisi-territoriale', title: '{issueTitle}', body: '{issueBody}', defaultChoice: 'silenzio', choices: [
    { id: 'visita', label: 'Vai sul posto e ascolta', cost: { ap: 1, funds: 150 }, effects: { stats: { popularity: 1.5, reputation: 0.5 }, relations: { civic: 2 } }, special: 'region-attention' },
    { id: 'promessa', label: 'Prometti una soluzione entro 12 settimane', effects: { stats: { popularity: 2, notoriety: 1 } }, special: 'promise' },
    { id: 'aula', label: 'Porta il problema in Aula con una proposta', requires: 'seat', cost: { ap: 1, capital: 2 }, effects: { stats: { reputation: 1, experience: 0.5 } }, special: 'issue-law' },
    { id: 'silenzio', label: 'Non intervenire', effects: { stats: { popularity: -1 } }, special: 'region-neglect' }] },
  'crisi-finanziaria': { id: 'crisi-finanziaria', title: 'I conti del tuo comitato sono in crisi', body: 'Il debito ha superato la soglia di guardia: fornitori e collaboratori chiedono garanzie.', defaultChoice: 'tagli', choices: [
    { id: 'tagli', label: 'Taglia tutte le spese ricorrenti', effects: { stats: { notoriety: -0.5 } }, special: 'budget-cut' },
    { id: 'prestito', label: 'Chiedi un prestito al partito', requires: 'party', effects: { party: { support: -4 }, relations: { leadership: -2 } }, special: 'party-loan' },
    { id: 'raccolta', label: 'Lancia una raccolta fondi straordinaria', cost: { ap: 2 }, effects: { funds: 1800 }, special: 'repay-debt', risk: { chance: 0.3, label: 'I donatori chiedono troppo in cambio: polemica', effects: { stats: { reputation: -2 } } } }] },
  'selezione-candidati': { id: 'selezione-candidati', title: 'Selezione dei candidati: {election}', body: 'Il partito decide come scegliere chi corre per {election}. Il metodo pesa sulla tua candidatura interna.', defaultChoice: 'rinuncia', choices: [
    { id: 'primarie', label: 'Chiedi le primarie', cost: { ap: 2, funds: 400 }, special: 'selection-primarie' },
    { id: 'accordo', label: 'Tratta un posto in lista con la direzione', cost: { capital: 4 }, special: 'selection-accordo' },
    { id: 'corrente', label: 'Fatti indicare dalla tua area', special: 'selection-corrente' },
    { id: 'rinuncia', label: 'Non chiedere nulla', effects: { party: { support: 1 } }, special: 'selection-rinuncia' }] },
  'conflitto-interno': { id: 'conflitto-interno', title: 'Scontro aperto nel partito', body: '{conflict}: la tensione è salita al punto da paralizzare gli organi.', defaultChoice: 'fuori', choices: [
    { id: 'media', label: 'Proponi una mediazione', cost: { ap: 1, capital: 2 }, effects: { org: { conflicts: -45, cohesion: 5 }, party: { support: 2 } } },
    { id: 'schierati', label: 'Schierati con {currentA}', effects: { relations: { currentA: 6, otherCurrents: -3 }, org: { conflicts: 10 }, party: { support: -1 } } },
    { id: 'fuori', label: 'Resta fuori dallo scontro', effects: { org: { cohesion: -3 } } }] },
  'tesoreria-rosso': { id: 'tesoreria-rosso', title: 'La tesoreria del partito è in rosso', body: 'Il tesoriere chiede alla direzione di scegliere: tagli, sottoscrizione o nuovi contributi.', defaultChoice: 'rinvia', choices: [
    { id: 'tagli', label: 'Taglia comunicazione e formazione', effects: { org: { cohesion: -3 } }, special: 'party-cuts' },
    { id: 'sottoscrizione', label: 'Lancia una sottoscrizione tra gli iscritti', cost: { ap: 1 }, effects: { party: { support: 1 } }, special: 'party-subscription' },
    { id: 'contributo', label: 'Versa tu un contributo', cost: { funds: 1000 }, effects: { org: { treasury: 1000 }, party: { support: 3 } } },
    { id: 'rinvia', label: 'Rinvia la decisione', effects: { org: { cohesion: -4 } } }] },
  'campagna-stampa': { id: 'campagna-stampa', title: 'Campagna di stampa contro di te', body: 'Da settimane i titoli sono ostili: {reason}. Serve una risposta, o il racconto resterà quello.', defaultChoice: 'ignora', choices: [
    { id: 'intervista', label: 'Concedi un’intervista riparatrice', cost: { ap: 1 }, effects: { stats: { reputation: 1, notoriety: 1 }, relations: { media: 3 } }, special: 'media-repair' },
    { id: 'querela', label: 'Querela per diffamazione', cost: { funds: 1200 }, effects: { stats: { notoriety: 1.5 }, relations: { media: -4 } }, later: { weeks: 6, hint: 'Il tribunale si pronuncerà sulla querela', label: 'Esito della querela', outcomes: [
      { chance: 0.5, label: 'Il giudice ti dà ragione: rettifica in prima pagina', effects: { stats: { reputation: 2.5 }, funds: 1500 } },
      { chance: 0.5, label: 'Querela respinta: la notizia torna sui giornali', effects: { stats: { reputation: -2 }, funds: -600 } }] } },
    { id: 'ignora', label: 'Lascia passare la tempesta', effects: { stats: { reputation: -1 } } }] },
  'sondaggi-crollo': { id: 'sondaggi-crollo', title: 'Il partito crolla nei sondaggi', body: '{party} ha perso {drop} punti in poche settimane: la base chiede un responsabile e una reazione.', defaultChoice: 'silenzio', choices: [
    { id: 'responsabilita', label: 'Assumiti una parte di responsabilità', effects: { party: { support: -3 }, stats: { reputation: 1.5 } } },
    { id: 'rilancio', label: 'Proponi un piano di rilancio', cost: { ap: 2, capital: 3 }, effects: { prep: 5, stats: { notoriety: 1 } }, special: 'world-stance-proposal' },
    { id: 'scarica', label: 'Scarica la colpa sulla segreteria', effects: { relations: { leadership: -6 }, party: { support: 2 }, stats: { reputation: -1 } } },
    { id: 'silenzio', label: 'Resta in silenzio', effects: { party: { support: -1 } } }] },
  'sondaggi-slancio': { id: 'sondaggi-slancio', title: 'Il partito vola nei sondaggi', body: '{party} guadagna {gain} punti: la segreteria ti chiede di metterci la faccia nelle prossime settimane.', defaultChoice: 'declina', choices: [
    { id: 'accetta', label: 'Diventa un volto della campagna', cost: { ap: 1 }, effects: { stats: { notoriety: 3, influence: 1 }, party: { support: 3 } }, later: { weeks: 4, chance: 0.3, hint: 'Se l’onda si ferma, le aspettative potrebbero ritorcersi contro di te', label: 'L’onda si ferma: ti chiedono conto delle aspettative', effects: { party: { support: -3 }, stats: { reputation: -1 } } } },
    { id: 'declina', label: 'Resta concentrato sul tuo lavoro', effects: { relations: { leadership: -2 } } }] },
  'bilancio-pubblico': { id: 'bilancio-pubblico', title: 'Il Tesoro chiede di chiudere i conti', body: 'Il margine di bilancio è quasi esaurito: senza una scelta, ogni nuova legge resterà senza coperture.', defaultChoice: 'rinvia', choices: [
    { id: 'tagli', label: 'Taglia la spesa corrente', effects: { stats: { popularity: -1.5 }, government: { stability: 2 } }, special: 'public-cuts' },
    { id: 'deficit', label: 'Finanzia in deficit', effects: { stats: { reputation: -1 }, government: { stability: 1 } }, special: 'public-deficit' },
    { id: 'tasse', label: 'Aumenta le entrate', effects: { stats: { popularity: -1 }, relations: { business: -5 } }, special: 'public-taxes' },
    { id: 'rinvia', label: 'Rinvia la decisione', effects: { government: { stability: -4 } } }] },
  'offerta-incarico': { id: 'offerta-incarico', title: 'La segreteria ti offre un incarico', body: 'Il tuo peso nel partito è cresciuto: ti propongono di diventare {rank}, in cambio di lealtà alla linea.', defaultChoice: 'declina', choices: [
    { id: 'accetta', label: 'Accetta l’incarico', effects: { org: { discipline: 6 }, relations: { leadership: 3 } }, special: 'accept-rank' },
    { id: 'declina', label: 'Declina per restare libero', effects: { party: { support: -1 }, stats: { influence: 0.5 } } }] },
  'sostegno-parlamentare': { id: 'sostegno-parlamentare', title: '{contact} offre sostegno alla tua proposta', body: '{contact} è disposto a sottoscrivere “{law}”. Persona reale (dati verificati), iniziativa simulata dal gioco.', defaultChoice: 'declina', choices: [
    { id: 'accetta', label: 'Accetta la firma', effects: { contacts: { target: 4 } }, special: 'cosign' },
    { id: 'declina', label: 'Ringrazia e declina', effects: { contacts: { target: -3 } } }] },
  'emendamenti-contrari': { id: 'emendamenti-contrari', title: '{contact} prepara emendamenti contrari', body: '{contact} annuncia emendamenti contrari a “{law}”. Persona reale (dati verificati), iniziativa simulata dal gioco.', defaultChoice: 'ignora', choices: [
    { id: 'incontra', label: 'Chiedi un incontro', cost: { ap: 1, capital: 2 }, effects: { contacts: { target: 10 } } },
    { id: 'ignora', label: 'Vai avanti senza trattare', effects: { groups: { contact: -3 } } }] },
  'richiesta-territorio': { id: 'richiesta-territorio', title: '{contact} propone un incontro su {region}', body: '{contact}, eletto in {circoscription}, chiede un confronto sui problemi del territorio. Persona reale (dati verificati), proposta simulata dal gioco.', defaultChoice: 'declina', choices: [
    { id: 'incontra', label: 'Accetta l’incontro', cost: { ap: 1 }, effects: { contacts: { target: 8 }, stats: { popularity: 0.5, experience: 0.5 } } },
    { id: 'declina', label: 'Declina', effects: { contacts: { target: -2 } } }] }
});

export const CAREER_OBJECTIVES = Object.freeze([
  { id: 'radicamento', label: 'Radicamento sul territorio', detail: 'Porta la popolarità a 55.', reward: { capital: 3 } },
  { id: 'rete', label: 'Una rete di relazioni', detail: 'Tre rapporti sopra quota 65.', reward: { capital: 3 } },
  { id: 'partito', label: 'Un ruolo nel partito', detail: 'Ottieni un incarico interno.', reward: { capital: 4 } },
  { id: 'candidatura', label: 'La candidatura', detail: 'Ottieni la candidatura a un’elezione.', reward: { capital: 3 } },
  { id: 'elezione', label: 'Eletto', detail: 'Conquista un mandato alle elezioni.', reward: { capital: 5 } },
  { id: 'parlamento', label: 'In Parlamento', detail: 'Siedi alla Camera o al Senato con un gruppo.', reward: { capital: 4 } },
  { id: 'incarico', label: 'Responsabilità in Aula', detail: 'Conquista un incarico parlamentare.', reward: { capital: 4 } },
  { id: 'legge', label: 'La tua legge', detail: 'Fai approvare una legge in entrambe le Camere.', reward: { capital: 5 } },
  { id: 'dirigenza', label: 'Leadership interna', detail: 'Entra nella direzione nazionale del partito.', reward: { capital: 5 } },
  { id: 'governo', label: 'Al Governo', detail: 'Assumi un incarico di ministro.', reward: { capital: 6 } }
]);
