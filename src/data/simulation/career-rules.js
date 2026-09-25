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
  advanceLaw: 1, formGovernment: 1, governmentSupport: 1, reviseCoalition: 1, assignMinister: 1, confidence: 1, crisis: 1,
  governmentBill: 2, decree: 2, budget: 2, program: 1, summit: 2, reshuffle: 1, confidenceOnLaw: 1, amendPolicy: 1, withdraw: 1
});
// Political capital spent by the Government's big moves.
export const GOVERNMENT_CAPITAL_COSTS = Object.freeze({ governmentBill: 3, decree: 5, budget: 4, program: 2, summit: 3, reshuffle: 4, confidenceOnLaw: 4 });

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
  { level: 4, title: 'Vicesegretario', threshold: 72, weeklyIncome: 300 },
  // The secretary is not contested: it is elected by a congress.
  { level: 5, title: 'Segretario nazionale', threshold: null, weeklyIncome: 350 }
]);
export const FOUNDER_RANK = Object.freeze({ level: 5, title: 'Segretario e fondatore', weeklyIncome: 150 });
// The line the secretary gives the party; each internal area prefers one.
export const PARTY_LINES = Object.freeze({
  autonoma: { label: 'Corsa solitaria', detail: 'Identità forte, nessun vincolo: cresce solo con le tue forze.' },
  governista: { label: 'Responsabilità di governo', detail: 'Sostieni chi governa: premia quando il Paese è soddisfatto.' },
  opposizione: { label: 'Opposizione dura', detail: 'Visibilità sul malcontento, rapporti tesi con chi governa.' },
  coalizione: { label: 'Costruzione di alleanze', detail: 'Apre il partito alle intese con altre forze.' }
});
export const CURRENT_LINES = Object.freeze({ riformisti: 'governista', territori: 'autonoma', movimento: 'opposizione' });
// Policy areas each internal area cares about: the party programme is judged against them.
export const CURRENT_AREAS = Object.freeze({ riformisti: ['economia', 'europa', 'pa', 'infrastrutture', 'digitale'], territori: ['autonomie', 'mezzogiorno', 'agricoltura', 'trasporti', 'turismo'], movimento: ['welfare', 'lavoro', 'ambiente', 'casa', 'sanita'] });
export const COMMUNICATION_STYLES = Object.freeze({
  istituzionale: { label: 'Istituzionale', detail: 'Toni misurati: la reputazione cresce piano, la notorietà meno.', weekly: { reputation: 0.2, notoriety: -0.1 }, sentiment: 0.5 },
  popolare: { label: 'Popolare', detail: 'Vicino alla gente: più popolarità, qualche semplificazione di troppo.', weekly: { popularity: 0.25, reputation: -0.05 }, sentiment: 0 },
  aggressiva: { label: 'Aggressiva', detail: 'Attacchi quotidiani: tanta visibilità, stampa ostile e avversari più duri.', weekly: { notoriety: 0.4, reputation: -0.15 }, sentiment: -1.2 }
});
// One-off decisions of the secretary on the party treasury.
export const PARTY_INVESTMENTS = Object.freeze([
  { id: 'piattaforma-iscritti', label: 'Piattaforma digitale per gli iscritti', cost: 15000, effect: 'Tesseramento online: iscritti in crescita costante e comunicazione più economica.' },
  { id: 'scuola-politica', label: 'Scuola politica nazionale', cost: 9000, effect: 'Militanti più preparati e partito più compatto per un anno.' },
  { id: 'fondo-territori', label: 'Fondo per le federazioni in difficoltà', cost: 12000, effect: 'Le sezioni più deboli ripartono: vitalità +20 dove serve.' }
]);

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
  { match: /assessor/i, amount: 450 }, { match: /consiglier|parlamento europeo/i, amount: 350 }, { match: /commissione|capogruppo/i, amount: 150 }
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
  { id: 'protesta', category: 'territorio', cooldown: 6, weight: 3, title: 'Protesta dei residenti a {municipality}', body: 'Un cantiere fermo da mesi porta in piazza residenti e commercianti.', defaultChoice: 'ignora', choices: [
    { id: 'piazza', label: 'Vai in piazza ad ascoltare', cost: { ap: 1 }, effects: { stats: { popularity: 3 }, relations: { civic: 5 } }, risk: { chance: 0.25, label: 'Vieni contestato davanti alle telecamere', effects: { stats: { popularity: -2, notoriety: 1 } } } },
    { id: 'dichiarazione', label: 'Rilascia una dichiarazione', effects: { stats: { notoriety: 1, popularity: -0.5 } } },
    { id: 'ignora', label: 'Non intervenire', effects: { stats: { popularity: -1.5 }, relations: { civic: -3 } }, later: { weeks: 3, chance: 0.5, hint: 'La protesta potrebbe allargarsi', label: 'La protesta si allarga a tutto il quartiere', effects: { stats: { popularity: -2 }, relations: { civic: -3 } } } }] },
  { id: 'collaboratore', category: 'scandalo', cooldown: 20, weight: 2, when: ctx => ctx.stats.notoriety >= 25, title: 'Un collaboratore finisce sotto inchiesta', body: 'Scandalo simulato: un membro del tuo staff è indagato per una consulenza.', defaultChoice: 'silenzio', choices: [
    { id: 'distanze', label: 'Prendi subito le distanze', effects: { stats: { reputation: -1 }, relations: { leadership: 2 } } },
    { id: 'difendi', label: 'Difendilo pubblicamente', outcomes: [
      { chance: 0.5, label: 'Le accuse cadono: la tua lealtà viene apprezzata', effects: { stats: { reputation: 1.5, notoriety: 2 } } },
      { chance: 0.5, label: 'Emergono nuovi elementi: la tua difesa si ritorce contro di te', effects: { stats: { reputation: -6 }, relations: { leadership: -4 } }, memory: { kind: 'scandalo', text: 'Hai difeso un collaboratore poi travolto dall’inchiesta', weight: 1.5 } }] },
    { id: 'silenzio', label: 'Resta in silenzio', effects: { stats: { reputation: -1.5, notoriety: 1 } } }] },
  { id: 'rivale', category: 'partito', cooldown: 8, weight: 2, title: 'Il tuo rivale interno ti attacca pubblicamente', body: 'Un rivale interno (figura simulata) mette in dubbio il tuo lavoro davanti a iscritti e giornalisti.', defaultChoice: 'lascia', choices: [
    { id: 'rispondi', label: 'Rispondi colpo su colpo', effects: { stats: { notoriety: 3 }, relations: { rival: -8 }, party: { support: -2 } } },
    { id: 'chiarimento', label: 'Cerca un chiarimento', cost: { capital: 2 }, effects: { relations: { rival: 8 }, party: { support: 1 } } },
    { id: 'lascia', label: 'Lascia correre', effects: { party: { support: -1 }, stats: { influence: -0.5 } } }] },
  { id: 'lista-civica', category: 'territorio', cooldown: 16, weight: 2, when: ctx => !ctx.seat, title: 'Una lista civica propone un’alleanza', body: 'Un gruppo di amministratori locali cerca un riferimento per le prossime elezioni.', defaultChoice: 'rifiuta', choices: [
    { id: 'accetta', label: 'Accetta l’alleanza', cost: { capital: 2 }, effects: { relations: { civic: 6, leadership: -2 }, prep: 8, stats: { consensus: 0.5 } }, later: { weeks: 8, chance: 0.35, hint: 'La lista civica potrebbe chiedere qualcosa in cambio', label: 'La lista civica pretende posti e visibilità', effects: { relations: { leadership: -3, civic: 2 }, stats: { reputation: -0.5 } } } },
    { id: 'tempo', label: 'Prendi tempo', effects: { relations: { civic: -1 } } },
    { id: 'rifiuta', label: 'Rifiuta', effects: { relations: { civic: -3 } } }] },
  { id: 'prima-serata', category: 'media', cooldown: 8, weight: 2, when: ctx => ctx.stats.notoriety >= 30, title: 'Invito in prima serata', body: 'Un talk nazionale ti vuole ospite su un tema caldo.', defaultChoice: 'declina', choices: [
    { id: 'accetta', label: 'Accetta', cost: { ap: 2 }, effects: { stats: { notoriety: 5, popularity: 1.5 } }, risk: { chance: 0.3, label: 'Uno scivolone diventa virale', effects: { stats: { reputation: -3 } } } },
    { id: 'collaboratore', label: 'Manda un collaboratore', effects: { stats: { notoriety: 1 } } },
    { id: 'declina', label: 'Declina', effects: {} }] },
  { id: 'congresso', weight: 0, when: () => false, title: 'Congresso: {currentA} contro {currentB}', body: 'Due aree del partito si contendono la guida. Schierarsi può pagare molto o costare caro.', defaultChoice: 'neutrale', choices: [
    { id: 'candidato', label: 'Candidati tu alla segreteria', requires: 'direzione', cost: { capital: 5 }, special: 'leadership-self' },
    { id: 'a', label: 'Sostieni {currentA}', special: 'leadership-a' },
    { id: 'b', label: 'Sostieni {currentB}', special: 'leadership-b' },
    { id: 'neutrale', label: 'Resta neutrale', effects: { party: { support: -1 } } }] },
  { id: 'finanziatore', category: 'scandalo', cooldown: 20, weight: 2, title: 'Un imprenditore offre un contributo', body: 'Il sostegno è generoso, ma chiede riservatezza.', defaultChoice: 'rifiuta', choices: [
    { id: 'trasparente', label: 'Accetta e rendilo pubblico', effects: { funds: 1500, stats: { reputation: -0.5 }, relations: { business: 3 } } },
    { id: 'rifiuta', label: 'Rifiuta', effects: { stats: { reputation: 1 }, relations: { business: -3 } } },
    { id: 'riservato', label: 'Accetta senza pubblicità', effects: { funds: 2800 }, special: 'flag-opaque-funding' }] },
  { id: 'maltempo', category: 'territorio', cooldown: 10, boost: sit => sit.signals.autumn || sit.signals.winter ? 1.6 : 0.7, weight: 2, title: 'Maltempo e danni in {region}', body: 'Allagamenti e strade chiuse: la comunità aspetta risposte.', defaultChoice: 'solidarieta', choices: [
    { id: 'sul-posto', label: 'Coordina gli aiuti sul posto', cost: { ap: 2, funds: 300 }, effects: { stats: { reputation: 3, popularity: 3 }, relations: { civic: 4 } } },
    { id: 'fondi', label: 'Chiedi fondi straordinari', cost: { capital: 3 }, effects: { stats: { consensus: 1, influence: 1 } } },
    { id: 'solidarieta', label: 'Esprimi solidarietà', effects: { stats: { popularity: -1 } } }] },
  { id: 'tensione-maggioranza', category: 'governo', cooldown: 8, weight: 3, when: ctx => ctx.seat && ctx.inMajority, title: 'Tensione nella maggioranza', body: 'Due alleati litigano su una nomina: il governo chiede lealtà.', defaultChoice: 'defilato', choices: [
    { id: 'sostieni', label: 'Sostieni il governo', effects: { group: { support: 3 }, government: { stability: 6 } } },
    { id: 'rimpasto', label: 'Chiedi un rimpasto', effects: { stats: { influence: 2 }, government: { stability: -8 }, groups: { coalition: -2 } } },
    { id: 'minaccia', label: 'Minaccia di uscire', effects: { stats: { influence: 3, notoriety: 2 }, government: { stability: -15 }, groups: { coalition: -5 }, org: { discipline: -10 } } },
    { id: 'defilato', label: 'Resta defilato', effects: { government: { stability: -3 } } }] },
  { id: 'decreto', category: 'parlamento', cooldown: 8, weight: 3, when: ctx => ctx.seat && ctx.governing && !ctx.inMajority, title: 'Il governo presenta un decreto contestato', body: 'L’opposizione deve decidere come reagire in Aula.', defaultChoice: 'lascia', choices: [
    { id: 'ostruzionismo', label: 'Guida l’ostruzionismo', cost: { ap: 1 }, effects: { stats: { notoriety: 3 }, government: { stability: -5 }, group: { support: 2 }, groups: { coalition: -3 } } },
    { id: 'modifiche', label: 'Proponi modifiche costruttive', effects: { stats: { reputation: 2 }, groups: { coalition: 3 } } },
    { id: 'lascia', label: 'Lascia fare', effects: { group: { support: -1 } } }] },
  { id: 'corteggiamento', category: 'parlamento', cooldown: 20, weight: 1, when: ctx => ctx.seat, title: 'Un altro gruppo ti corteggia', body: 'Ti offrono visibilità e un ruolo se cambi gruppo.', defaultChoice: 'ignora', choices: [
    { id: 'ascolta', label: 'Ascolta l’offerta', effects: { capital: 3, group: { support: -4 } }, later: { weeks: 4, chance: 0.4, hint: 'Il tuo gruppo potrebbe venirlo a sapere', label: 'Il tuo gruppo scopre la trattativa', effects: { group: { support: -5 }, org: { discipline: -6 } } } },
    { id: 'rifiuta', label: 'Rifiuta pubblicamente', effects: { group: { support: 4 }, stats: { notoriety: 1 } } },
    { id: 'ignora', label: 'Ignora', effects: {} }] },
  { id: 'crisi-ministero', category: 'governo', cooldown: 10, weight: 3, when: ctx => ctx.minister, title: 'Emergenza nel tuo ministero', body: 'Un dossier esplode sui giornali: serve una risposta.', defaultChoice: 'tecnici', choices: [
    { id: 'responsabilita', label: 'Assumi la responsabilità', cost: { ap: 1 }, effects: { stats: { reputation: 2 }, government: { stability: 3 } }, risk: { chance: 0.3, label: 'La gestione viene giudicata tardiva', effects: { stats: { reputation: -3 } } } },
    { id: 'tecnici', label: 'Scarica sui tecnici', effects: { stats: { reputation: -1 }, government: { stability: -2 } } }] },
  { id: 'presa-posizione', weight: 0, when: () => false, title: 'Prendi posizione: {event}', body: '{eventBody}', defaultChoice: 'silenzio', choices: [
    { id: 'proposta', label: 'Intervieni con una proposta', cost: { ap: 1 }, effects: { stats: { notoriety: 2, reputation: 1 } }, special: 'world-stance-proposal' },
    { id: 'attacco', label: 'Attacca gli avversari', effects: { stats: { notoriety: 3, reputation: -0.5 }, relations: { media: 2 } }, special: 'world-stance-attack' },
    { id: 'silenzio', label: 'Resta in silenzio', effects: { stats: { notoriety: -0.5 } } }] },
  { id: 'sindacati-vertenza', category: 'economia', cooldown: 10, weight: 1, title: 'Vertenza in una fabbrica del territorio', body: 'Lavoratori e azienda chiedono una mediazione politica.', defaultChoice: 'osserva', choices: [
    { id: 'lavoratori', label: 'Stai con i lavoratori', effects: { relations: { unions: 7, business: -4 }, stats: { popularity: 1 } } },
    { id: 'mediazione', label: 'Proponi una mediazione', cost: { ap: 1, capital: 2 }, effects: { relations: { unions: 3, business: 3 }, stats: { reputation: 1.5 } } },
    { id: 'osserva', label: 'Resta a guardare', effects: { relations: { unions: -2 } } }] }
,
  // ---------- procedural events: conditions, cooldowns, rarity, variants, chains ----------
  { id: 'cronaca-nera', category: 'sicurezza', weight: 2, cooldown: 6, pickRegion: 'sicurezza', boost: sit => sit.signals.crime > 55 ? 2 : sit.signals.crime > 48 ? 1.3 : 0.7,
    variants: [
      { title: 'Aggressione in pieno centro in {region2}', body: 'Un episodio violento finisce su tutti i telegiornali: i residenti chiedono più controlli (fatto di cronaca simulato).' },
      { title: 'Rapine in serie in {region2}', body: 'Tre colpi in una settimana nella stessa zona: commercianti in allarme (fatto di cronaca simulato).' },
      { title: 'Rissa tra bande giovanili in {region2}', body: 'Il video fa il giro dei social: sindaci e comitati chiedono risposte (fatto di cronaca simulato).' }],
    onRaise: { shock: { perceived: -4, region: '{region2}' } }, defaultChoice: 'calma', choices: [
    { id: 'presidio', label: 'Vai sul posto con le forze dell’ordine', cost: { ap: 1 }, effects: { stats: { popularity: 1.5, notoriety: 1 } }, special: 'region-attention' },
    { id: 'legge', label: 'Annuncia una proposta sulla sicurezza', requires: 'seat', cost: { ap: 1, capital: 2 }, effects: { stats: { notoriety: 2 } }, special: 'issue-law-security' },
    { id: 'calma', label: 'Invita alla calma e ai dati', effects: { stats: { reputation: 1, popularity: -1 } }, followUp: { id: 'cronaca-nera', weeks: 3, chance: 0.3 } }] },
  { id: 'operazione-antimafia', category: 'sicurezza', weight: 1, cooldown: 14, pickRegion: 'sicurezza', title: 'Grande operazione contro la criminalità organizzata in {region2}', body: 'Decine di arresti in un’indagine simulata: il territorio respira, ma chiede continuità.',
    onRaise: { shock: { perceived: 3, crime: -1, region: '{region2}' } }, defaultChoice: 'nulla', choices: [
    { id: 'plauso', label: 'Ringrazia pubblicamente inquirenti e forze dell’ordine', effects: { stats: { reputation: 1, notoriety: 1 } } },
    { id: 'risorse', label: 'Chiedi più risorse per quegli uffici', cost: { capital: 2 }, effects: { stats: { influence: 1 } }, special: 'issue-law-security' },
    { id: 'nulla', label: 'Non commentare', effects: {} }] },
  { id: 'chiusura-stabilimento', category: 'economia', weight: 2, cooldown: 10, pickRegion: 'occupazione', title: 'Chiude uno stabilimento in {region2}', body: 'Centinaia di posti di lavoro a rischio in un’azienda simulata: sindacati in piazza, imprese preoccupate per l’indotto.',
    onRaise: { shock: { region: '{region2}', indicator: 'occupazione', delta: -5 } }, defaultChoice: 'ignora', choices: [
    { id: 'tavolo', label: 'Apri un tavolo di crisi', cost: { ap: 1, capital: 2 }, effects: { relations: { unions: 6, business: 2 }, stats: { reputation: 1.5 } }, later: { weeks: 6, outcomes: [
      { chance: 0.5, label: 'Il tavolo trova un acquirente: posti salvati', effects: { stats: { reputation: 2, popularity: 2 } } },
      { chance: 0.5, label: 'Il tavolo fallisce: licenziamenti confermati', effects: { stats: { reputation: -1.5 }, relations: { unions: -4 } } }] } },
    { id: 'promessa', label: 'Prometti che nessuno resterà senza lavoro', effects: { stats: { popularity: 2 } }, later: { weeks: 10, chance: 0.6, hint: 'I lavoratori ricorderanno la promessa', label: 'La promessa non è mantenuta: gli operai ti contestano', effects: { stats: { popularity: -3, reputation: -2 } }, memory: { kind: 'promessa-tradita', text: 'Promessa ai lavoratori non mantenuta' } } },
    { id: 'ignora', label: 'Non intervenire', effects: { relations: { unions: -3 }, stats: { popularity: -1 } }, followUp: { id: 'sindacati-vertenza', weeks: 2, chance: 0.6 } }] },
  { id: 'rincari-carburanti', category: 'economia', weight: 1, cooldown: 12, title: 'Carburanti alle stelle', body: 'Il prezzo alla pompa sale per settimane: autotrasportatori pronti al fermo.',
    onRaise: { shock: { inflation: 0.2 } }, defaultChoice: 'dichiarazione', choices: [
    { id: 'accise', label: 'Chiedi il taglio delle accise', effects: { stats: { popularity: 2, reputation: -0.5 } } },
    { id: 'mediazione', label: 'Incontra gli autotrasportatori', cost: { ap: 1 }, effects: { relations: { business: 4 }, stats: { reputation: 1 } } },
    { id: 'dichiarazione', label: 'Una dichiarazione di circostanza', effects: { stats: { popularity: -0.5 } } }] },
  { id: 'boom-turismo', category: 'territorio', weight: 1, cooldown: 26, when: sit => sit.signals.summer, title: 'Estate record per il turismo', body: 'Presenze sopra le attese in molte località: gli operatori chiedono di non sprecare l’occasione.',
    onRaise: { shock: { area: 'turismo', areaDelta: 3, growth: 0.05 } }, defaultChoice: 'nulla', choices: [
    { id: 'rivendica', label: 'Rivendica il risultato', effects: { stats: { notoriety: 2 } }, risk: { chance: 0.35, label: 'Ti accusano di prenderti meriti non tuoi', effects: { stats: { reputation: -1.5 } } } },
    { id: 'territori', label: 'Proponi di portare i turisti nelle aree interne', cost: { ap: 1 }, effects: { stats: { reputation: 1.5 }, relations: { business: 3 } } },
    { id: 'nulla', label: 'Non commentare', effects: {} }] },
  { id: 'inchiesta-giornalistica', category: 'media', weight: 1, cooldown: 20, when: sit => sit.stats.notoriety >= 40, title: 'Un’inchiesta giornalistica ti riguarda', body: 'Un quotidiano ricostruisce nomine e rapporti del tuo staff (vicenda simulata): nulla di penalmente rilevante, ma molte domande.', defaultChoice: 'silenzio', choices: [
    { id: 'chiarisci', label: 'Rispondi punto per punto', cost: { ap: 1 }, effects: { stats: { reputation: 1 } }, risk: { chance: 0.3, label: 'Una risposta imprecisa riaccende il caso', effects: { stats: { reputation: -2 } } } },
    { id: 'querela', label: 'Minaccia querela', effects: { stats: { notoriety: 1 }, relations: { media: -5 } }, memory: { kind: 'scandalo', text: 'Scontro con la stampa su un’inchiesta', weight: 0.6 } },
    { id: 'silenzio', label: 'Non rispondere', effects: { stats: { reputation: -1.5 } }, memory: { kind: 'scandalo', text: 'Inchiesta giornalistica rimasta senza risposta', weight: 0.8 } }] },
  { id: 'passato-ritorna', category: 'memoria', weight: 3, cooldown: 16, when: sit => Boolean(sit.signals.memoryRecall) && (sit.signals.electionSoon || sit.campaignActive), title: 'Il passato ritorna: {memory}', body: 'Gli avversari ripescano una vecchia vicenda della tua carriera e la rilanciano in vista del voto.', defaultChoice: 'ignora', choices: [
    { id: 'ammetti', label: 'Ammetti l’errore e spiega cosa è cambiato', cost: { ap: 1 }, effects: { stats: { reputation: 1, popularity: -1 } } },
    { id: 'contrattacca', label: 'Contrattacca sui loro errori', effects: { stats: { notoriety: 2, reputation: -1 } }, risk: { chance: 0.35, label: 'Lo scontro si allarga e ti danneggia', effects: { stats: { reputation: -2 } } } },
    { id: 'ignora', label: 'Ignora gli attacchi', effects: { stats: { reputation: -1.5 } } }] },
  { id: 'fronda-parlamentari', category: 'partito', weight: 2, cooldown: 14, when: sit => sit.secretary && sit.seat && sit.signals.cohesion < 58, title: 'Lettera critica dei tuoi parlamentari', body: 'Un gruppo di eletti del partito firma un documento contro la linea della segreteria.', defaultChoice: 'ignora', choices: [
    { id: 'ascolta', label: 'Convoca gli eletti e ascolta', cost: { ap: 1, capital: 2 }, effects: { org: { cohesion: 5 }, group: { support: 3 } } },
    { id: 'disciplina', label: 'Richiama tutti alla disciplina', effects: { org: { discipline: 8, cohesion: -3 }, group: { support: -3 } } },
    { id: 'ignora', label: 'Ignora la lettera', effects: { org: { cohesion: -2 } }, later: { weeks: 4, chance: 0.5, hint: 'I dissidenti potrebbero votare contro in Aula', label: 'I dissidenti votano contro una tua proposta', effects: { group: { support: -8 }, org: { discipline: -6 } } } }] },
  { id: 'sfiducia-interna', category: 'partito', weight: 2, cooldown: 30, exclusive: 'leadership', when: sit => sit.secretary && sit.game.party?.affiliation === 'member' && sit.signals.cohesion < 45 && sit.signals.hostileCurrents >= 1, title: 'Le aree interne chiedono la tua testa', body: 'Una mozione in direzione nazionale mette in discussione la tua segreteria: coesione e sostegno sono ai minimi.', defaultChoice: 'conta', choices: [
    { id: 'conta', label: 'Vai alla conta in direzione', special: 'secretary-confidence' },
    { id: 'concessioni', label: 'Offri organi e linea alle aree critiche', cost: { capital: 4 }, effects: { org: { cohesion: 10 }, relations: { otherCurrents: 6 }, party: { support: 4 } } },
    { id: 'dimissioni', label: 'Dimettiti da segretario', special: 'secretary-resign' }] },
  { id: 'ostruzionismo', category: 'parlamento', weight: 2, cooldown: 8, when: sit => sit.seat && sit.signals.openLawInCommission, title: 'L’opposizione fa ostruzionismo', body: 'Centinaia di emendamenti bloccano in commissione “{lawTitle}”.', defaultChoice: 'tira-dritto', choices: [
    { id: 'tratta', label: 'Tratta con l’opposizione', cost: { capital: 3 }, effects: { stats: { reputation: 0.5 } }, special: 'obstruction-clear' },
    { id: 'tira-dritto', label: 'Tira dritto', special: 'obstruction-add' },
    { id: 'tempi', label: 'Chiedi di contingentare i tempi', requires: 'premier', cost: { capital: 2 }, effects: { government: { stability: -3 } }, special: 'obstruction-clear' }] },
  { id: 'franchi-tiratori', category: 'parlamento', weight: 1, cooldown: 16, when: sit => sit.premier && sit.signals.majorityMood < 55 && sit.signals.lawAtVote, title: 'Voci di franchi tiratori', body: 'Nel segreto dell’urna alcuni parlamentari della maggioranza potrebbero votare contro “{lawTitle}”.', defaultChoice: 'rischia', choices: [
    { id: 'vertice', label: 'Convoca un vertice lampo', cost: { ap: 1, capital: 3 }, effects: { government: { stability: 2 } } },
    { id: 'fiducia', label: 'Valuta di porre la fiducia', effects: { stats: { notoriety: 1 } } },
    { id: 'rischia', label: 'Rischia il voto', special: 'snipers' }] },
  { id: 'alluvione', category: 'emergenza', weight: 1.5, cooldown: 20, exclusive: 'emergenza', pickRegion: 'ambiente', boost: sit => sit.signals.autumn ? 2 : 0.6,
    variants: [
      { title: 'Alluvione in {region2}', body: 'Fiumi esondati, paesi isolati e strade interrotte: servono aiuti immediati e fondi per la ricostruzione.' },
      { title: 'Frane e allagamenti in {region2}', body: 'Giorni di pioggia mettono in ginocchio il territorio: famiglie evacuate e scuole chiuse.' }],
    onRaise: { shock: { region: '{region2}', indicator: 'infrastrutture', delta: -8, headroom: -2 }, emergency: 'ambiente' }, defaultChoice: 'solidarieta', choices: [
    { id: 'decreto', label: 'Decreto-legge per l’emergenza', requires: 'premier', cost: { ap: 1 }, effects: { stats: { reputation: 2 } }, special: 'emergency-decree', decree: { area: 'ambiente', instrument: 'sostegno', intensity: 2, financing: 'deficit', target: '{region2}' }, memory: { kind: 'emergenza', text: 'Emergenza alluvione affrontata con un decreto' } },
    { id: 'sul-posto', label: 'Vai sul posto e coordina gli aiuti', cost: { ap: 2 }, effects: { stats: { popularity: 3, reputation: 2 } }, special: 'region-attention' },
    { id: 'solidarieta', label: 'Esprimi solidarietà', effects: { stats: { popularity: -1.5 } }, later: { weeks: 3, chance: 0.5, hint: 'I cittadini potrebbero sentirsi abbandonati', label: 'Proteste per i ritardi nei soccorsi', effects: { stats: { popularity: -2, reputation: -1.5 } } }, followUp: { id: 'protesta', weeks: 2, chance: 0.5 } }] },
  { id: 'crisi-energetica', category: 'emergenza', weight: 1, cooldown: 26, exclusive: 'emergenza', when: sit => sit.governing, title: 'Crisi energetica: bollette raddoppiate', body: 'Tensioni sui mercati internazionali dell’energia: famiglie e imprese chiedono un intervento.',
    onRaise: { shock: { inflation: 0.5, growth: -0.1, area: 'energia', areaDelta: -6 }, emergency: 'energia' }, defaultChoice: 'attendi', choices: [
    { id: 'decreto', label: 'Decreto-legge contro il caro bollette', requires: 'premier', cost: { ap: 1 }, effects: { stats: { popularity: 2 } }, special: 'emergency-decree', decree: { area: 'energia', instrument: 'sostegno', intensity: 2, financing: 'deficit' } },
    { id: 'europa', label: 'Chiedi una risposta europea comune', cost: { capital: 3 }, effects: { stats: { influence: 1.5 } }, later: { weeks: 5, outcomes: [
      { chance: 0.5, label: 'L’Europa trova un accordo: i prezzi scendono', effects: { stats: { reputation: 2 } } },
      { chance: 0.5, label: 'Il vertice europeo si chiude senza intesa', effects: { stats: { reputation: -1.5 } } }] } },
    { id: 'attendi', label: 'Aspetta che i mercati si calmino', effects: { stats: { popularity: -2 } }, followUp: { id: 'sciopero-generale', weeks: 3, chance: 0.45 } }] },
  { id: 'ondata-sbarchi', category: 'emergenza', weight: 1, cooldown: 16, exclusive: 'emergenza', when: sit => sit.signals.summer, title: 'Arrivi record sulle coste', body: 'Il sistema di accoglienza è sotto pressione: i comuni chiedono aiuto, la politica si divide.',
    onRaise: { shock: { area: 'immigrazione', areaDelta: -6, perceived: -1.5 }, emergency: 'immigrazione' }, defaultChoice: 'rinvia', choices: [
    { id: 'decreto', label: 'Decreto-legge su accoglienza e rimpatri', requires: 'premier', cost: { ap: 1 }, effects: { stats: { notoriety: 2 } }, special: 'emergency-decree', decree: { area: 'immigrazione', instrument: 'regole', intensity: 2, financing: 'tagli' } },
    { id: 'comuni', label: 'Sostieni i comuni dell’accoglienza', cost: { ap: 1 }, effects: { stats: { reputation: 1.5 }, relations: { civic: 3 } } },
    { id: 'rinvia', label: 'Rinvia a una soluzione europea', effects: { stats: { popularity: -1 } } }] },
  { id: 'attacco-informatico', category: 'emergenza', weight: 0.6, cooldown: 40, rare: true, exclusive: 'emergenza', title: 'Attacco informatico ai servizi pubblici', body: 'Portali e sistemi di pagamento fermi per giorni: cittadini e imprese bloccati.',
    onRaise: { shock: { area: 'digitale', areaDelta: -7, trust: -1.5 }, emergency: 'digitale' }, defaultChoice: 'tecnici', choices: [
    { id: 'decreto', label: 'Decreto per la sicurezza informatica', requires: 'premier', cost: { ap: 1 }, effects: { stats: { reputation: 1.5 } }, special: 'emergency-decree', decree: { area: 'digitale', instrument: 'investimento', intensity: 1, financing: 'deficit' } },
    { id: 'trasparenza', label: 'Spiega pubblicamente cosa è successo', cost: { ap: 1 }, effects: { stats: { reputation: 1 } } },
    { id: 'tecnici', label: 'Lascia fare ai tecnici', effects: { stats: { reputation: -1 } } }] },
  { id: 'terremoto', category: 'emergenza', weight: 0.4, cooldown: 60, rare: true, unique: false, exclusive: 'emergenza', pickRegion: 'infrastrutture', title: 'Terremoto in {region2}', body: 'Una forte scossa (evento simulato) colpisce borghi e città: sfollati e danni ingenti.',
    onRaise: { shock: { region: '{region2}', indicator: 'infrastrutture', delta: -12, headroom: -4, trust: -1 }, emergency: 'infrastrutture' }, defaultChoice: 'solidarieta', choices: [
    { id: 'decreto', label: 'Decreto per la ricostruzione', requires: 'premier', cost: { ap: 2 }, effects: { stats: { reputation: 3 } }, special: 'emergency-decree', decree: { area: 'infrastrutture', instrument: 'investimento', intensity: 3, financing: 'deficit', target: '{region2}' }, memory: { kind: 'emergenza', text: 'Ricostruzione dopo il terremoto' } },
    { id: 'sul-posto', label: 'Vai tra gli sfollati', cost: { ap: 2 }, effects: { stats: { popularity: 4, reputation: 2 } } },
    { id: 'solidarieta', label: 'Esprimi vicinanza', effects: { stats: { popularity: -2 } } }] },
  { id: 'emergenza-sanitaria', category: 'emergenza', weight: 0.4, cooldown: 60, rare: true, exclusive: 'emergenza', when: sit => sit.signals.winter, title: 'Ondata influenzale eccezionale', body: 'Pronto soccorso saturi e ospedali in affanno: i medici chiedono misure straordinarie.',
    onRaise: { shock: { area: 'sanita', trust: -1 }, emergency: 'sanita' }, defaultChoice: 'rassicura', choices: [
    { id: 'decreto', label: 'Decreto per assunzioni straordinarie', requires: 'premier', cost: { ap: 1 }, effects: { stats: { reputation: 2 } }, special: 'emergency-decree', decree: { area: 'sanita', instrument: 'sostegno', intensity: 2, financing: 'deficit' } },
    { id: 'regioni', label: 'Coordina le Regioni', cost: { ap: 1, capital: 2 }, effects: { stats: { reputation: 1.5, influence: 1 } } },
    { id: 'rassicura', label: 'Rassicura e minimizza', effects: {}, risk: { chance: 0.45, label: 'La situazione peggiora: ti accusano di aver sottovalutato', effects: { stats: { reputation: -4 } } } }] },
  { id: 'tensione-spread', category: 'economia', weight: 2, cooldown: 10, when: sit => sit.premier && sit.signals.spread > 210, title: 'Lo spread vola: tensione sui mercati', body: 'Gli investitori chiedono tassi più alti sul debito italiano: ogni settimana di incertezza costa.', defaultChoice: 'ignora', choices: [
    { id: 'rassicura', label: 'Rassicura i mercati con un piano di rientro', cost: { capital: 3 }, effects: { stats: { reputation: 1 } }, special: 'markets-calm' },
    { id: 'tagli', label: 'Annuncia tagli immediati', effects: { stats: { popularity: -2 } }, special: 'public-cuts' },
    { id: 'ignora', label: 'Accusa la speculazione', effects: { stats: { notoriety: 2 } }, special: 'markets-worse', followUp: { id: 'richiamo-europeo', weeks: 4, chance: 0.5 } }] },
  { id: 'richiamo-europeo', category: 'europa', weight: 2, cooldown: 12, when: sit => sit.premier && ['richiamo', 'procedura'].includes(sit.signals.euStatus), title: 'Bruxelles chiede di correggere i conti', body: 'La Commissione europea (istituzione) chiede misure per riportare il deficit sotto la soglia di riferimento.', defaultChoice: 'tratta', choices: [
    { id: 'rientro', label: 'Presenta un piano di rientro', effects: { stats: { reputation: 1.5, popularity: -1 } }, special: 'public-cuts' },
    { id: 'tratta', label: 'Tratta più flessibilità', cost: { capital: 4 }, effects: { stats: { influence: 1 } }, later: { weeks: 6, outcomes: [
      { chance: 0.5, label: 'Flessibilità concessa', effects: { stats: { reputation: 1.5 } } },
      { chance: 0.5, label: 'Flessibilità negata: la procedura va avanti', effects: { stats: { reputation: -1.5 } } }] } },
    { id: 'sfida', label: 'Sfida Bruxelles in pubblico', effects: { stats: { notoriety: 3, reputation: -1 } }, special: 'markets-worse' }] },
  { id: 'sciopero-generale', category: 'sociale', weight: 1, cooldown: 20, when: sit => sit.premier || sit.minister, title: 'Sciopero generale contro il governo', body: 'I sindacati proclamano una giornata di sciopero su salari e servizi: il Paese si ferma.', defaultChoice: 'linea-dura', choices: [
    { id: 'tavolo', label: 'Convoca le parti sociali', cost: { ap: 2 }, effects: { relations: { unions: 8 }, government: { stability: 2 } } },
    { id: 'concessioni', label: 'Concedi aumenti ai contratti pubblici', cost: { capital: 2 }, effects: { relations: { unions: 5 } }, special: 'society-cost' },
    { id: 'linea-dura', label: 'Linea dura', effects: { relations: { unions: -8, business: 3 }, stats: { notoriety: 2 } } }] },
  { id: 'ministro-bufera', category: 'governo', weight: 1.5, cooldown: 12, when: sit => sit.premier && sit.signals.ministers >= 2, title: 'Un ministro nella bufera', body: 'Una frase infelice di un ministro della coalizione (figura simulata) scatena polemiche per giorni.', defaultChoice: 'difendi', choices: [
    { id: 'difendi', label: 'Difendi il ministro', effects: { government: { stability: -2 } }, special: 'minister-defend' },
    { id: 'dimissioni', label: 'Chiedi le dimissioni', effects: { stats: { reputation: 1.5 } }, special: 'minister-resign' },
    { id: 'rimprovera', label: 'Rimprovero in privato', effects: { stats: { reputation: -0.5 } } }] },
  { id: 'vertice-europeo', category: 'europa', weight: 1, cooldown: 14, when: sit => sit.premier, title: 'Vertice europeo decisivo', body: 'I capi di governo discutono di bilancio comune e regole: l’Italia deve scegliere la sua linea.', defaultChoice: 'basso-profilo', choices: [
    { id: 'alleanze', label: 'Costruisci alleanze con altri governi', cost: { ap: 1, capital: 2 }, effects: { stats: { influence: 2 } }, special: 'europe-up' },
    { id: 'veto', label: 'Minaccia il veto', effects: { stats: { notoriety: 3 } }, special: 'europe-down' },
    { id: 'basso-profilo', label: 'Tieni un basso profilo', effects: {} }] },
  // ---------- events tied to role, party, territory, economy and Parliament ----------
  { id: 'bilancio-comunale', category: 'economia', weight: 2, cooldown: 16, when: sit => sit.role.local, title: 'Il bilancio di {municipality} non torna', body: 'Mancano risorse per servizi e manutenzioni: in consiglio comunale si decide dove intervenire.', defaultChoice: 'rinvia', choices: [
    { id: 'tagli', label: 'Taglia le spese non essenziali', effects: { stats: { reputation: 1.5, popularity: -1.5 }, relations: { civic: -2 } }, memory: { kind: 'tagli', text: 'Tagli al bilancio di {municipality}', weight: 0.8 } },
    { id: 'tariffe', label: 'Aumenta tariffe e addizionali', effects: { stats: { popularity: -3 }, funds: 400 }, memory: { kind: 'tasse', text: 'Tariffe comunali aumentate a {municipality}', weight: 1 } },
    { id: 'regione', label: 'Chiedi un contributo straordinario alla Regione', cost: { ap: 1, capital: 3 }, later: { weeks: 6, outcomes: [
      { chance: 0.55, label: 'La Regione stanzia i fondi', effects: { stats: { reputation: 2, popularity: 2 } } },
      { chance: 0.45, label: 'La richiesta resta nel cassetto', effects: { stats: { popularity: -1.5 } } }] } },
    { id: 'rinvia', label: 'Rinvia la decisione', effects: { stats: { reputation: -1 } }, followUp: { id: 'bilancio-comunale', weeks: 6, chance: 0.5 } }] },
  { id: 'strade-dissestate', category: 'territorio', weight: 1.5, cooldown: 12, when: sit => sit.role.local || sit.role.regional, variants: [
      { title: 'Buche e strade dissestate a {municipality}', body: 'Un incidente riaccende le proteste: i residenti pubblicano foto e video delle strade.' },
      { title: 'Ponte chiuso per verifiche a {municipality}', body: 'Traffico deviato e commercianti in difficoltà: tutti chiedono tempi certi.' }], defaultChoice: 'promessa', choices: [
    { id: 'cantiere', label: 'Apri subito un cantiere', cost: { funds: 600, ap: 1 }, effects: { stats: { popularity: 2.5 }, relations: { civic: 3 } } },
    { id: 'promessa', label: 'Annuncia un piano per l’anno prossimo', effects: { stats: { popularity: 0.5 } }, later: { weeks: 16, chance: 0.5, hint: 'Se il piano non parte, qualcuno se lo ricorderà', label: 'Il piano per le strade non è mai partito', effects: { stats: { popularity: -2, reputation: -1.5 } }, memory: { kind: 'promessa-tradita', text: 'Piano per le strade annunciato e mai partito' } } }] },
  { id: 'liste-attesa', category: 'sociale', weight: 2, cooldown: 14, when: sit => sit.role.regional || (sit.role.parliamentarian && sit.south), title: 'Liste d’attesa infinite negli ospedali di {region}', body: 'Mesi per una visita specialistica: i pazienti si rivolgono al privato o rinunciano alle cure.', onRaise: { shock: { area: 'sanita', areaDelta: -1 } }, defaultChoice: 'denuncia', choices: [
    { id: 'piano', label: 'Proponi un piano straordinario per le prestazioni', cost: { ap: 1, capital: 3 }, effects: { stats: { reputation: 2 } }, later: { weeks: 10, outcomes: [
      { chance: 0.5, label: 'Le attese si accorciano davvero', effects: { stats: { popularity: 3, reputation: 1.5 } }, memory: { kind: 'promessa-mantenuta', text: 'Liste d’attesa ridotte in {region}' } },
      { chance: 0.5, label: 'Il piano resta sulla carta', effects: { stats: { popularity: -2 } }, memory: { kind: 'promessa-tradita', text: 'Piano per le liste d’attesa rimasto sulla carta' } }] } },
    { id: 'denuncia', label: 'Denuncia la situazione e attacca chi governa', effects: { stats: { notoriety: 2, reputation: -0.5 } } },
    { id: 'privato', label: 'Sostieni convenzioni con le strutture private', effects: { relations: { business: 4, unions: -3 }, stats: { popularity: 0.5 } } }] },
  { id: 'pendolari', category: 'territorio', weight: 1.5, cooldown: 14, boost: sit => sit.north ? 1.6 : 0.8, when: sit => !sit.role.local || sit.north, title: 'Treni regionali soppressi: pendolari infuriati in {region}', body: 'Ritardi e corse cancellate ogni giorno: i comitati dei pendolari chiedono risposte a Regione e governo.', defaultChoice: 'comunicato', choices: [
    { id: 'viaggio', label: 'Viaggia una settimana con i pendolari', cost: { ap: 2 }, effects: { stats: { popularity: 3, notoriety: 2 }, relations: { civic: 4 } } },
    { id: 'gestore', label: 'Pretendi penali dal gestore del servizio', cost: { capital: 2 }, effects: { stats: { reputation: 1.5 }, relations: { business: -2 } } },
    { id: 'comunicato', label: 'Un comunicato di solidarietà', effects: { stats: { popularity: -1 } } }] },
  { id: 'aree-interne', category: 'territorio', weight: 1.5, cooldown: 20, boost: sit => sit.south ? 1.8 : sit.macroArea === 'centro' ? 1.2 : 0.6, title: 'I borghi di {region} si svuotano', body: 'Scuole che chiudono, ambulatori senza medici, giovani che partono: i sindaci delle aree interne lanciano un appello.', defaultChoice: 'appello', choices: [
    { id: 'servizi', label: 'Proponi incentivi per chi resta e servizi di prossimità', cost: { ap: 1, capital: 2 }, effects: { stats: { reputation: 2, popularity: 1.5 }, relations: { civic: 4 } }, special: 'region-attention' },
    { id: 'turismo', label: 'Punta su turismo lento e seconde case', effects: { relations: { business: 3 }, stats: { popularity: 0.5 } } },
    { id: 'appello', label: 'Rilancia l’appello dei sindaci', effects: { stats: { notoriety: 1 } } }] },
  { id: 'siccita', category: 'emergenza', weight: 1, cooldown: 30, exclusive: 'emergenza', when: sit => sit.signals.summer, boost: sit => sit.south ? 2 : 0.8, pickRegion: 'ambiente', title: 'Siccità: acqua razionata in {region2}', body: 'Invasi ai minimi, turnazioni nell’erogazione e agricoltori in ginocchio.', onRaise: { shock: { region: '{region2}', indicator: 'ambiente', delta: -5, growth: -0.03 }, emergency: 'ambiente' }, defaultChoice: 'rinvia', choices: [
    { id: 'decreto', label: 'Decreto per reti idriche e agricoltura', requires: 'premier', cost: { ap: 1 }, effects: { stats: { reputation: 2 } }, special: 'emergency-decree', decree: { area: 'ambiente', instrument: 'investimento', intensity: 2, financing: 'deficit', target: '{region2}' } },
    { id: 'agricoltori', label: 'Stai con gli agricoltori: ristori subito', cost: { capital: 2 }, effects: { relations: { business: 3 }, stats: { popularity: 2 } } },
    { id: 'rinvia', label: 'Aspetta le piogge d’autunno', effects: { stats: { popularity: -2 } }, later: { weeks: 4, chance: 0.5, hint: 'Se non piove, la crisi peggiora', label: 'La crisi idrica peggiora: raccolti persi', effects: { stats: { popularity: -2, reputation: -1.5 } } } }] },
  { id: 'autonomia-differenziata', category: 'parlamento', weight: 1, cooldown: 30, when: sit => sit.role.parliamentarian || sit.role.regional, boost: sit => sit.north || sit.south ? 1.5 : 0.8, title: 'Scontro sull’autonomia delle Regioni', body: 'Più competenze alle Regioni che le chiedono: il Nord spinge, il Sud teme di restare indietro. Devi scegliere una linea.', defaultChoice: 'mediazione', choices: [
    { id: 'favorevole', label: 'Sostieni più autonomia', effects: { stats: { popularity: 1 } }, special: 'region-attention', memory: { kind: 'decisione', text: 'Hai sostenuto l’autonomia differenziata', weight: 0.8, subject: 'autonomia' } },
    { id: 'contrario', label: 'Difendi l’uniformità dei servizi nel Paese', effects: { stats: { reputation: 1 } }, memory: { kind: 'decisione', text: 'Ti sei opposto all’autonomia differenziata', weight: 0.8, subject: 'autonomia' } },
    { id: 'mediazione', label: 'Proponi livelli minimi garantiti prima di tutto', cost: { capital: 2 }, effects: { stats: { reputation: 1.5, influence: 1 } } }] },
  { id: 'sotto-soglia', category: 'partito', weight: 2.5, cooldown: 20, when: sit => sit.party && sit.partySmall, title: 'Il partito è sotto la soglia di sbarramento', body: 'I sondaggi danno {party} sotto il 4%: senza una strategia, alle prossime elezioni rischia di non entrare in Parlamento.', defaultChoice: 'da-soli', choices: [
    { id: 'lista-comune', label: 'Cerca una lista comune con forze vicine', cost: { capital: 3 }, effects: { party: { support: -2 } }, special: 'seek-alliance' },
    { id: 'civici', label: 'Allarga ai civici e agli amministratori locali', cost: { ap: 1 }, effects: { relations: { civic: 5 }, prep: 6 } },
    { id: 'da-soli', label: 'Andate da soli: identità prima di tutto', effects: { party: { support: 3 }, stats: { notoriety: 1 } }, later: { weeks: 12, chance: 0.45, hint: 'Se i sondaggi non salgono, qualcuno lascerà', label: 'Dirigenti locali passano ad altri partiti', effects: { party: { support: -5 }, org: { cohesion: -6 } } } }] },
  { id: 'correnti-liste', category: 'partito', weight: 1.5, cooldown: 24, when: sit => sit.member && sit.partyBig, title: 'Le correnti si contendono i posti in lista', body: 'In un grande partito ogni candidatura è una trattativa: {currentA} e {currentB} chiedono garanzie.', defaultChoice: 'attendi', choices: [
    { id: 'a', label: 'Sostieni le richieste di {currentA}', effects: { relations: { currentA: 6, otherCurrents: -4 } } },
    { id: 'merito', label: 'Chiedi criteri trasparenti per tutti', cost: { capital: 2 }, effects: { stats: { reputation: 1.5 }, relations: { leadership: -2, otherCurrents: 2 } } },
    { id: 'attendi', label: 'Aspetta che decida la segreteria', effects: { party: { support: -1 } } }] },
  { id: 'corteggiamento-poli', category: 'partito', weight: 1.5, cooldown: 26, when: sit => sit.secretary && sit.partyAxis !== null && Math.abs(sit.partyAxis) <= 1, title: 'Entrambi i poli corteggiano {party}', body: 'Per una forza di centro ogni voto conta doppio: destra e sinistra offrono posti e programmi, ma chiedono una scelta di campo.', defaultChoice: 'equidistanza', choices: [
    { id: 'destra', label: 'Apri al centro-destra', effects: { stats: { influence: 2 }, party: { support: -2 } }, special: 'lean-right', memory: { kind: 'decisione', text: 'Apertura del partito al centro-destra', weight: 1, subject: 'campo' } },
    { id: 'sinistra', label: 'Apri al centro-sinistra', effects: { stats: { influence: 2 }, party: { support: -2 } }, special: 'lean-left', memory: { kind: 'decisione', text: 'Apertura del partito al centro-sinistra', weight: 1, subject: 'campo' } },
    { id: 'equidistanza', label: 'Resta equidistante', effects: { party: { support: 2 }, stats: { influence: -1 } } }] },
  { id: 'audizioni', category: 'parlamento', weight: 1.5, cooldown: 10, when: sit => sit.seat && sit.signals.openLawInCommission, title: 'Audizioni in commissione su “{lawTitle}”', body: 'Esperti, sindacati e imprese sfilano in commissione: le loro osservazioni possono cambiare il testo.', defaultChoice: 'assente', choices: [
    { id: 'studia', label: 'Prepara domande e proposte di modifica', cost: { ap: 1 }, effects: { stats: { reputation: 2, experience: 2 }, group: { support: 2 } } },
    { id: 'imprese', label: 'Dai spazio alle richieste delle imprese', effects: { relations: { business: 4, unions: -2 } } },
    { id: 'assente', label: 'Lascia fare ai colleghi', effects: { stats: { experience: -0.5 } } }] },
  { id: 'fiducia-dissenso', category: 'parlamento', weight: 1.5, cooldown: 16, when: sit => sit.seat && sit.inMajority && (sit.signals.stability ?? 60) < 50, title: 'Il governo pone la fiducia: nel tuo gruppo c’è chi non ci sta', body: 'Un provvedimento divide la maggioranza: votare la fiducia significa ingoiare il testo, votare contro può aprire la crisi.', defaultChoice: 'vota', choices: [
    { id: 'vota', label: 'Vota la fiducia per lealtà', effects: { group: { support: 3 }, government: { stability: 3 }, stats: { popularity: -0.5 } }, memory: { kind: 'lealta', text: 'Fiducia votata in un momento difficile', weight: 0.8 } },
    { id: 'contro', label: 'Vota contro e rivendica la coerenza', effects: { stats: { notoriety: 3, reputation: 1 }, group: { support: -6 }, government: { stability: -8 } }, memory: { kind: 'voto', text: 'Voto contro la fiducia al governo', weight: 1.5, tone: 'bad', subject: 'maggioranza' } },
    { id: 'esci', label: 'Esci dall’Aula', effects: { group: { support: -2 }, government: { stability: -2 } } }] },
  { id: 'contromanovra', category: 'parlamento', weight: 1, cooldown: 26, when: sit => sit.seat && sit.governing && !sit.inMajority && sit.signals.autumn, title: 'L’opposizione prepara la contromanovra', body: 'Mentre il governo scrive la legge di bilancio, l’opposizione presenta la sua alternativa: serve qualcuno che ci metta la faccia.', defaultChoice: 'firma', choices: [
    { id: 'guida', label: 'Guida la stesura della contromanovra', cost: { ap: 2, capital: 2 }, effects: { stats: { notoriety: 3, reputation: 2, experience: 2 } } },
    { id: 'firma', label: 'Firma il documento del gruppo', effects: { group: { support: 1 } } }] },
  { id: 'banca-territorio', category: 'economia', weight: 0.6, cooldown: 40, rare: true, when: sit => (sit.signals.spread ?? 130) > 170, pickRegion: 'economia', title: 'Una banca del territorio in difficoltà in {region2}', body: 'Risparmiatori in fila agli sportelli di un istituto simulato: la vigilanza valuta un salvataggio.', onRaise: { shock: { region: '{region2}', indicator: 'economia', delta: -4, trust: -1 } }, defaultChoice: 'prudenza', choices: [
    { id: 'risparmiatori', label: 'Chiedi tutele per i piccoli risparmiatori', effects: { stats: { popularity: 2.5 }, relations: { business: -2 } } },
    { id: 'salvataggio', label: 'Sostieni un salvataggio con fondi pubblici', cost: { capital: 3 }, effects: { relations: { business: 5 }, stats: { popularity: -2 } }, memory: { kind: 'decisione', text: 'Salvataggio pubblico di una banca del territorio', weight: 1.2, tone: 'bad' } },
    { id: 'prudenza', label: 'Invita alla prudenza e lascia decidere la vigilanza', effects: { stats: { reputation: 1 } } }] },
  { id: 'premio-legalita', category: 'opportunita', positive: true, weight: 0.8, cooldown: 40, when: sit => sit.role.local || sit.role.regional, title: 'Un premio per il progetto sulla legalità di {municipality}', body: 'Scuole e associazioni del territorio vengono premiate per un progetto a cui hai contribuito.', defaultChoice: 'ringrazia', choices: [
    { id: 'rilancia', label: 'Rilancia il progetto in tutta la regione', cost: { ap: 1 }, effects: { stats: { reputation: 2.5, notoriety: 1.5 }, relations: { civic: 4 } } },
    { id: 'ringrazia', label: 'Ringrazia e lascia la scena alle scuole', effects: { stats: { reputation: 1.5 } } }] },
  { id: 'fondi-europei', category: 'opportunita', positive: true, weight: 1, cooldown: 26, title: 'Fondi europei per un progetto in {region}', body: 'Un bando europeo può finanziare un’opera attesa da anni, ma servono progetti pronti e tempi certi.', defaultChoice: 'segnala', choices: [
    { id: 'squadra', label: 'Metti al lavoro una squadra di progettisti', cost: { funds: 500, ap: 1 }, later: { weeks: 12, outcomes: [
      { chance: 0.6, label: 'Il progetto è finanziato: cantieri in arrivo', effects: { stats: { reputation: 3, popularity: 2 } }, memory: { kind: 'legge', text: 'Fondi europei ottenuti per {region}', weight: 1 } },
      { chance: 0.4, label: 'Il bando sfuma per un errore di forma', effects: { stats: { reputation: -1.5 } } }] } },
    { id: 'segnala', label: 'Segnala il bando ai comuni', effects: { relations: { civic: 2 } } }] },
  { id: 'crollo-sondaggi', category: 'crisi', weight: 3, cooldown: 12, when: sit => sit.party && sit.pollDelta <= -0.8, title: '{party} perde terreno nei sondaggi', body: 'Il calo è netto in una sola settimana: militanti inquieti, avversari all’attacco, giornali a caccia di responsabili.', defaultChoice: 'minimizza', choices: [
    { id: 'rilancio', label: 'Rilancia con una proposta forte', cost: { ap: 1, capital: 2 }, effects: { stats: { notoriety: 2 } }, special: 'world-stance-proposal' },
    { id: 'autocritica', label: 'Fai autocritica davanti agli iscritti', effects: { party: { support: 3 }, stats: { reputation: 1, notoriety: -1 } } },
    { id: 'minimizza', label: 'Minimizza: sono solo sondaggi', effects: { party: { support: -2 } } }] },
  { id: 'exploit-sondaggi', category: 'opportunita', positive: true, weight: 2, cooldown: 12, when: sit => sit.party && sit.pollDelta >= 0.8, title: '{party} vola nei sondaggi', body: 'Una crescita così rapida attira nuovi iscritti, ma anche attenzione e attacchi.', defaultChoice: 'prudenza', choices: [
    { id: 'capitalizza', label: 'Capitalizza: campagna di tesseramento', cost: { funds: 400 }, effects: { party: { support: 3 }, org: { members: 60 } } },
    { id: 'prudenza', label: 'Mantieni un profilo prudente', effects: { stats: { reputation: 1 } } }] },
  { id: 'inchiesta-appalti', category: 'scandalo', weight: 0.7, cooldown: 40, rare: true, when: sit => sit.role.mayor || sit.role.regional, title: 'Inchiesta sugli appalti a {municipality}', body: 'La procura indaga su alcuni affidamenti dell’amministrazione (vicenda simulata): non sei indagato, ma la tua giunta è sotto i riflettori.', defaultChoice: 'attendi', choices: [
    { id: 'trasparenza', label: 'Pubblica tutti gli atti e collabora', cost: { ap: 1 }, effects: { stats: { reputation: 2.5 }, relations: { media: 3 } } },
    { id: 'rimuovi', label: 'Rimuovi i dirigenti coinvolti', effects: { stats: { reputation: 1 }, relations: { civic: -2 } } },
    { id: 'attendi', label: 'Attendi l’esito dell’indagine', effects: { stats: { reputation: -1.5 } }, later: { weeks: 8, chance: 0.4, hint: 'L’inchiesta potrebbe allargarsi', label: 'L’inchiesta si allarga ad altri appalti', effects: { stats: { reputation: -4 } }, memory: { kind: 'scandalo', text: 'Inchiesta sugli appalti durante la tua amministrazione', weight: 1.5 } } }] },
  { id: 'grande-evento', category: 'territorio', weight: 0.3, cooldown: 80, rare: true, unique: true, pickRegion: 'turismo', title: 'L’Italia si candida a un grande evento internazionale', body: 'Una candidatura a un evento sportivo internazionale (simulato) può portare investimenti in {region2}, o sprechi.', defaultChoice: 'prudenza', choices: [
    { id: 'sostieni', label: 'Sostieni la candidatura', cost: { capital: 3 }, effects: { stats: { notoriety: 3 } }, later: { weeks: 20, outcomes: [
      { chance: 0.55, label: 'Candidatura vinta: cantieri e turisti', effects: { stats: { popularity: 3, reputation: 2 } } },
      { chance: 0.45, label: 'Candidatura persa tra polemiche sui costi', effects: { stats: { reputation: -2 } } }] } },
    { id: 'prudenza', label: 'Chiedi prima un piano dei costi', effects: { stats: { reputation: 1 } } }] }
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
      { chance: 0.45, label: 'Alleati e sostenitori ti abbandonano: perdi incarichi e sostegni, ma la carriera continua dal basso', special: 'career-setback' }] }] },
  finanziamento: { id: 'finanziamento', title: 'Emerge il contributo non dichiarato', body: 'Un’inchiesta giornalistica ricostruisce il finanziamento ricevuto in modo riservato.', defaultChoice: 'nega', choices: [
    { id: 'ammetti', label: 'Ammetti e restituisci', cost: { funds: 2800 }, effects: { stats: { reputation: -3 } } },
    { id: 'nega', label: 'Nega tutto', outcomes: [
      { chance: 0.4, label: 'La notizia si sgonfia', effects: { stats: { reputation: -2 } } },
      { chance: 0.6, label: 'Le prove emergono: scandalo', effects: { stats: { reputation: -8 }, relations: { leadership: -6, media: -4 } }, memory: { kind: 'scandalo', text: 'Finanziamento riservato scoperto dalla stampa', weight: 2 } }] }] }
});

// Events raised by the concrete situation (territory, finances, party, Parliament) rather than drawn at random.
export const SITUATION_EVENTS = Object.freeze({
  'sessione-bilancio': { id: 'sessione-bilancio', title: 'Si apre la sessione di bilancio per il {year}', body: 'Entro il 31 dicembre il Parlamento deve approvare la legge di bilancio: senza, si va all’esercizio provvisorio con spesa congelata e mercati nervosi.', defaultChoice: 'rinvia', choices: [
    { id: 'prepara', label: 'Prepara la manovra (sezione Governo)', special: 'budget-open' },
    { id: 'rinvia', label: 'Rinvia di qualche settimana', effects: { government: { stability: -1 } } }] },
  'richiesta-alleato': { id: 'richiesta-alleato', title: '{group} chiede {demand}', body: 'Un alleato della maggioranza mette sul tavolo una richiesta entro il {deadline}: se la ignori, rimetterà in discussione il sostegno al governo (comportamento simulato).', defaultChoice: 'attendi', choices: [
    { id: 'accetta', label: 'Accetta la richiesta', effects: { stats: { influence: -0.5 } }, special: 'partner-accept' },
    { id: 'tratta', label: 'Tratta: più tempo in cambio di attenzione', cost: { capital: 4 }, special: 'partner-negotiate' },
    { id: 'respingi', label: 'Respingi apertamente', effects: { stats: { notoriety: 1 } }, special: 'partner-refuse' },
    { id: 'attendi', label: 'Prendi tempo', effects: {} }] },
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
  'congresso-segretario': { id: 'congresso-segretario', title: 'Congresso: la tua segreteria alla prova', body: 'Gli iscritti votano: {currentA} vuole la guida del partito. Coesione {cohesion}/100, sostegno interno {support}/100.', defaultChoice: 'difendi', choices: [
    { id: 'unita', label: 'Proponi una segreteria unitaria', cost: { capital: 4 }, special: 'secretary-unity' },
    { id: 'difendi', label: 'Difendi la tua linea al voto', special: 'secretary-defend' },
    { id: 'lascia', label: 'Non ricandidarti', special: 'secretary-resign' }] },
  'sfida-corrente': { id: 'sfida-corrente', title: '{currentA} chiede il tuo incarico', body: 'Il coordinamento dell’area (figure simulate) contesta il tuo ruolo di {rank}: vuole un proprio dirigente al tuo posto.', defaultChoice: 'resisti', choices: [
    { id: 'tratta', label: 'Tratta: concedi spazio all’area', cost: { capital: 3 }, effects: { relations: { currentA: 10 }, party: { support: 1 } } },
    { id: 'resisti', label: 'Resisti e vai alla conta', special: 'current-resist' },
    { id: 'cedi', label: 'Fai un passo indietro', effects: { relations: { currentA: 15 }, party: { support: 3 }, stats: { reputation: 0.5 } }, special: 'current-cede' }] },
  'proposta-alleanza': { id: 'proposta-alleanza', title: '{partyLabel} propone un’intesa', body: 'Nello scenario la forza (strategia: {strategy}) offre un percorso comune al tuo partito. Partito reale, proposta simulata dal gioco.', defaultChoice: 'rifiuta', choices: [
    { id: 'accetta', label: 'Accetta l’intesa', special: 'world-alliance-accept' },
    { id: 'tratta', label: 'Prendi tempo e tratta', cost: { capital: 3 }, special: 'world-relation-up' },
    { id: 'rifiuta', label: 'Rifiuta', special: 'world-relation-down' }] },
  'attacco-avversario': { id: 'attacco-avversario', title: '{partyLabel} attacca il tuo partito', body: 'Nello scenario la forza in opposizione dura prende di mira te e il tuo partito. Partito reale, attacco simulato dal gioco.', defaultChoice: 'ignora', choices: [
    { id: 'rispondi', label: 'Rispondi colpo su colpo', effects: { stats: { notoriety: 2, reputation: -0.5 } }, special: 'world-relation-down' },
    { id: 'chiarimento', label: 'Cerca un chiarimento', cost: { capital: 2 }, special: 'world-relation-up' },
    { id: 'ignora', label: 'Ignora l’attacco', effects: { stats: { reputation: 0.5, notoriety: -0.5 } } }] },
  'offerta-governo': { id: 'offerta-governo', title: 'L’esecutivo ti offre un incarico', body: 'L’esecutivo di scenario cerca figure con reputazione ed esperienza: ti propone di diventare sottosegretario.', defaultChoice: 'declina', choices: [
    { id: 'accetta', label: 'Accetta l’incarico', effects: { stats: { influence: 2, notoriety: 2 } }, special: 'accept-scenario-office' },
    { id: 'declina', label: 'Declina per restare libero', effects: { stats: { reputation: 0.5 } } }] },
  'sostegno-parlamentare': { id: 'sostegno-parlamentare', title: '{contact} offre sostegno alla tua proposta', body: '{contact} è disposto a sottoscrivere “{law}”. Persona reale (dati verificati), iniziativa simulata dal gioco.', defaultChoice: 'declina', choices: [
    { id: 'accetta', label: 'Accetta la firma', effects: { contacts: { target: 4 } }, special: 'cosign' },
    { id: 'declina', label: 'Ringrazia e declina', effects: { contacts: { target: -3 } } }] },
  'emendamenti-contrari': { id: 'emendamenti-contrari', title: '{contact} prepara emendamenti contrari', body: '{contact} annuncia emendamenti contrari a “{law}”. Persona reale (dati verificati), iniziativa simulata dal gioco.', defaultChoice: 'ignora', choices: [
    { id: 'incontra', label: 'Chiedi un incontro', cost: { ap: 1, capital: 2 }, effects: { contacts: { target: 10 } } },
    { id: 'ignora', label: 'Vai avanti senza trattare', effects: { groups: { contact: -3 } } }] },
  'richiesta-territorio': { id: 'richiesta-territorio', title: '{contact} propone un incontro su {region}', body: '{contact}, eletto in {circoscription}, chiede un confronto sui problemi del territorio. Persona reale (dati verificati), proposta simulata dal gioco.', defaultChoice: 'declina', choices: [
    { id: 'incontra', label: 'Accetta l’incontro', cost: { ap: 1 }, effects: { contacts: { target: 8 }, stats: { popularity: 0.5, experience: 0.5 } } },
    { id: 'declina', label: 'Declina', effects: { contacts: { target: -2 } } }] },
  // After an election: what the vote opens, never granted.
  'dopo-voto-vittoria': { id: 'dopo-voto-vittoria', title: 'Dopo il voto: {election}', body: 'Risultato: {outcome}. Partito, alleati e stampa aspettano la tua prima mossa.', defaultChoice: 'squadra', choices: [
    { id: 'squadra', label: 'Ringrazia la squadra e il territorio', effects: { stats: { popularity: 1 }, relations: { civic: 2 } } },
    { id: 'agenda', label: 'Annuncia subito tre priorità', cost: { ap: 1 }, effects: { stats: { reputation: 1, notoriety: 1 } }, later: { weeks: 12, label: 'Le priorità annunciate dopo il voto', hint: 'I cittadini verificheranno le priorità annunciate', outcomes: [
      { chance: 0.5, label: 'Prime promesse mantenute', effects: { stats: { reputation: 2, popularity: 1 } } },
      { chance: 0.5, label: 'Le priorità restano sulla carta', effects: { stats: { reputation: -1.5 } } }] } },
    { id: 'partito', label: 'Dedica il risultato al partito', requires: 'party', effects: { party: { support: 3 }, relations: { leadership: 3 } } }] },
  'dopo-voto-sconfitta': { id: 'dopo-voto-sconfitta', title: 'Dopo il voto: {election}', body: '{outcome}. La carriera non finisce qui: nel partito e sul territorio si discute di come ripartire.', defaultChoice: 'silenzio', choices: [
    { id: 'responsabilita', label: 'Assumiti la responsabilità', effects: { stats: { reputation: 1.5 }, party: { support: -1 }, relations: { leadership: 2 } } },
    { id: 'colpa', label: 'Accusa il partito di non averti sostenuto', requires: 'party', effects: { stats: { notoriety: 2 }, party: { support: -6 }, relations: { leadership: -6 } }, risk: { chance: 0.3, label: 'La direzione valuta provvedimenti nei tuoi confronti', effects: { party: { support: -6 } } } },
    { id: 'territorio', label: 'Riparti dal territorio', cost: { ap: 1 }, effects: { stats: { popularity: 1 }, prep: 10, relations: { civic: 3 } } },
    { id: 'silenzio', label: 'Rimani in silenzio', effects: { stats: { notoriety: -1 } } }] },
  'giunta-offerta': { id: 'giunta-offerta', title: 'La giunta: {executive} valuta il tuo nome', body: 'La maggioranza compone la giunta. Puoi chiedere un assessorato, ma la scelta non è tua: contano gli equilibri tra gli alleati.', defaultChoice: 'consiglio', choices: [
    { id: 'chiedi', label: 'Chiedi un assessorato', cost: { capital: 3 }, outcomes: [
      { chance: 0.4, label: 'Nominato assessore', effects: { stats: { influence: 3, reputation: 1 } }, special: 'local-office', office: { title: 'Assessore {assessorLevel}', institution: '{institution}', level: '{level}' } },
      { chance: 0.3, label: 'Solo una delega da consigliere: meno di quanto speravi', effects: { stats: { influence: 1 } }, special: 'local-office', office: { title: 'Consigliere delegato ({assessorLevel})', institution: '{institution}', level: '{level}' } },
      { chance: 0.3, label: 'L’assessorato va a un alleato', effects: { stats: { influence: -1 }, relations: { leadership: -2 } } }] },
    { id: 'consiglio', label: 'Resta in consiglio senza chiedere nulla', effects: { stats: { reputation: 0.5 } } }] },
  'giunta-composizione': { id: 'giunta-composizione', title: 'La tua giunta: {institution}', body: 'Da capo dell’esecutivo scegli gli assessori. Alleati, partito e società civile si aspettano posti: ogni scelta scontenta qualcuno.', defaultChoice: 'partito', choices: [
    { id: 'alleati', label: 'Premia gli alleati della coalizione', effects: { stats: { influence: 1 }, party: { support: -2 }, relations: { civic: -1 } }, risk: { chance: 0.25, label: 'Il partito lamenta troppi posti agli alleati', effects: { relations: { leadership: -3 } } } },
    { id: 'partito', label: 'Dai i posti chiave al tuo partito', effects: { party: { support: 4 }, relations: { leadership: 2, civic: -2 } }, risk: { chance: 0.3, label: 'Gli alleati minacciano di uscire dalla maggioranza', effects: { stats: { reputation: -1 } } } },
    { id: 'civici', label: 'Scegli figure competenti della società civile', cost: { capital: 3 }, effects: { stats: { reputation: 2 }, party: { support: -3 }, relations: { civic: 4 } } }] },
  'capogruppo-opposizione': { id: 'capogruppo-opposizione', title: 'Chi guida l’opposizione?', body: 'Il gruppo di opposizione deve scegliere il capogruppo. È una vetrina, ma anche un banco di prova.', defaultChoice: 'rinuncia', choices: [
    { id: 'candidati', label: 'Candidati a capogruppo', cost: { capital: 2 }, outcomes: [
      { chance: 0.55, label: 'Eletto capogruppo dell’opposizione', effects: { stats: { notoriety: 2, influence: 2 } }, special: 'local-office', office: { title: 'Capogruppo di opposizione', institution: '{institution}', level: '{level}' } },
      { chance: 0.45, label: 'Il gruppo sceglie un altro nome', effects: { stats: { influence: -1 } } }] },
    { id: 'rinuncia', label: 'Lascia spazio ad altri', effects: { party: { support: 1 } } }] },
  'ricorso-elettorale': { id: 'ricorso-elettorale', title: 'Una sconfitta di misura', body: 'Hai perso per meno di {margin} punti. Qualcuno ti consiglia un ricorso sui verbali di alcune sezioni.', defaultChoice: 'accetta', choices: [
    { id: 'ricorso', label: 'Presenta ricorso', cost: { funds: 2500, ap: 1 }, outcomes: [
      { chance: 0.12, label: 'Riconteggio favorevole in alcune sezioni: il risultato resta, ma la stampa ti dà ragione', effects: { stats: { reputation: 1, notoriety: 2 } } },
      { chance: 0.88, label: 'Ricorso respinto', effects: { stats: { reputation: -1.5 } } }] },
    { id: 'accetta', label: 'Riconosci la vittoria dell’avversario', effects: { stats: { reputation: 1.5 } } }] },
  'resa-dei-conti': { id: 'resa-dei-conti', title: 'Resa dei conti nel partito dopo il voto', body: '{currentA} chiede una discussione sulla sconfitta e sulle responsabilità: in gioco c’è il tuo incarico.', defaultChoice: 'difenditi', choices: [
    { id: 'difenditi', label: 'Difendi le tue scelte alla conta', special: 'current-resist' },
    { id: 'cedi', label: 'Fai un passo indietro', special: 'current-cede' },
    { id: 'rilancia', label: 'Rilancia con un’iniziativa interna', cost: { ap: 1, capital: 2 }, effects: { party: { support: 2 }, relations: { currentA: 3 } } }] },
  'consultazioni-governo': { id: 'consultazioni-governo', title: 'Dopo le politiche: la squadra di governo', body: 'Si discute degli incarichi dopo il voto. I posti sono pochi, contesi tra alleati e correnti: un seggio non basta.', defaultChoice: 'aula', choices: [
    { id: 'governo', label: 'Proponi il tuo nome per un incarico di governo', cost: { capital: 4 }, outcomes: [
      { chance: 0.2, label: 'Entri nell’esecutivo come sottosegretario', effects: { stats: { influence: 3, notoriety: 2 } }, special: 'accept-scenario-office' },
      { chance: 0.25, label: 'Niente governo: il partito ti indica per un ruolo in commissione', effects: { stats: { influence: 1.5 } } },
      { chance: 0.55, label: 'Nessun incarico: la squadra è già fatta', effects: { relations: { leadership: -2 } } }] },
    { id: 'aula', label: 'Concentrati sul lavoro in Aula', effects: { stats: { reputation: 0.5 } } }] },
  'impegni-elettorali': { id: 'impegni-elettorali', title: 'Gli impegni presi in campagna', body: 'In campagna hai preso {commitments} impegni con categorie e territori: ora ti chiedono conto.', defaultChoice: 'rinvia', choices: [
    { id: 'onora', label: 'Onora gli impegni', cost: { ap: 1, capital: 2 }, effects: { stats: { reputation: 1.5 }, relations: { civic: 3 } } },
    { id: 'rinvia', label: 'Rinvia a tempi migliori', later: { weeks: 8, label: 'Impegni elettorali', chance: 0.6, hint: 'Le categorie potrebbero accusarti di aver tradito le promesse', effects: { stats: { reputation: -2 } }, memory: { kind: 'promessa-tradita', text: 'Impegni elettorali non mantenuti', weight: 1 } } }] }
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
