// The goals of a career. Each one is measured on what the player does and decides (the activities done, the choices
// taken, the relations built, the mandates won, the promises kept), not ticked off a list; reaching it pays a reward and
// unlocks something that keeps working afterwards: a higher level at which the relations settle, more weight in the
// promotions and candidacies, a new decision on the desk. A goal can also be declared in public (an ambition): a
// commitment with a deadline, worth more if kept and costly if broken.
// Everything is simulated; no goal describes a real person or organisation.

// What the pages show, line by line.
export const OBJECTIVE_LINES = Object.freeze({
  territorio: 'Territorio e consenso', partito: 'Il partito', istituzioni: 'Istituzioni elette', parlamento: 'Parlamento e governo',
  integrita: 'Memoria e parola data', partenza: 'La tua partenza', europa: 'Europa', quirinale: 'Quirinale'
});
export const OBJECTIVE_LINE_ORDER = Object.freeze(['territorio', 'partito', 'istituzioni', 'parlamento', 'europa', 'integrita', 'partenza', 'quirinale']);

export const AMBITION_COST = Object.freeze({ capital: 2 });
export const AMBITION_LIMIT = 2;
// A goal kept after being declared pays double the capital and builds credibility; a broken one costs it.
export const AMBITION_KEPT = Object.freeze({ capitalFactor: 2, stats: { reputation: 1.5 } });
export const AMBITION_BROKEN = Object.freeze({ stats: { reputation: -2, popularity: -1 } });

// measures: { kind, target, label, ...parameters }. mode: 'all' (default) or 'any' of the measures.
// needs: when the goal exists for the player (see objective-engine). after: the goals it follows (it can be declared
// only once they are done). reward: capital, stats, relations, party support, applied when the goal is reached.
// unlock: what stays — base (the level a relation returns to), mods (weights in promotions, candidacies, campaigns),
// offer (a new decision raised at once) and the text that says it.
const RAW_OBJECTIVES = ([
  { id: 'radicamento', line: 'territorio', label: 'Radicamento sul territorio', detail: 'Porta la popolarità a 55 e tieni vivo il territorio con almeno 6 attività.',
    measures: [{ kind: 'stat', stat: 'popularity', target: 55, label: 'Popolarità' }, { kind: 'activities', categories: ['territorio'], target: 6, label: 'Attività sul territorio' }],
    reward: { capital: 3 }, ambition: { weeks: 26 },
    unlock: { text: 'Associazioni e comitati ti riconoscono come uno dei loro: i rapporti con il territorio tornano più in alto e il radicamento pesa di più nelle promozioni.', base: { civic: 3 }, mods: { territory: 4 } } },
  { id: 'rete', line: 'territorio', label: 'Una rete di relazioni', detail: 'Tre rapporti sopra quota 65, curati con almeno 4 incontri e relazioni.',
    measures: [{ kind: 'relations', min: 65, target: 3, label: 'Rapporti sopra 65' }, { kind: 'activities', categories: ['relazioni', 'territorio'], target: 4, label: 'Incontri e relazioni' }],
    reward: { capital: 3 }, ambition: { weeks: 26 },
    unlock: { text: 'Redazioni e categorie produttive ti rispondono più in fretta: i rapporti con media e imprese si stabilizzano più in alto e hai più visibilità in campagna.', base: { media: 2, business: 2 }, mods: { visibility: 2 } } },
  { id: 'territorio-con-te', line: 'territorio', needs: 'territory', label: 'Il territorio risponde a te', detail: 'Porta il controllo dei comitati del tuo territorio a 65 e tieni almeno 2 responsabili locali con te.',
    measures: [{ kind: 'control', target: 65, label: 'Controllo del territorio' }, { kind: 'leadersWith', target: 2, label: 'Responsabili locali con te' }],
    reward: { capital: 3 }, ambition: { weeks: 40 },
    unlock: { text: 'I responsabili dei comitati ti riconoscono come il loro punto di riferimento: le candidature passano più facilmente dal territorio e il radicamento pesa di più nelle promozioni.', mods: { nomination: 0.5, territory: 4 } } },
  { id: 'voce', line: 'territorio', label: 'Una voce nei media', detail: 'Notorietà a 45 e almeno 4 uscite sui media.',
    measures: [{ kind: 'stat', stat: 'notoriety', target: 45, label: 'Notorietà' }, { kind: 'activities', categories: ['media'], target: 4, label: 'Uscite sui media' }],
    reward: { capital: 2, stats: { reputation: 0.5 } }, ambition: { weeks: 20 },
    unlock: { text: 'Il tuo nome è noto alle redazioni: in campagna hai più visibilità.', mods: { visibility: 3 } } },

  { id: 'partito', line: 'partito', needs: 'party', label: 'Un ruolo nel partito', detail: 'Ottieni un incarico interno.',
    measures: [{ kind: 'rank', target: 1, label: 'Incarico interno' }], reward: { capital: 4 },
    unlock: { text: 'Chi ha un incarico interno pesa di più nelle sfide per i livelli successivi.', mods: { partyScore: 1 } } },
  { id: 'pontiere', line: 'partito', needs: 'member', label: 'Il pontiere', detail: 'Ricuci il partito: almeno 2 mediazioni e una coesione sopra 55.',
    measures: [{ kind: 'actions', choices: ['conflitto-interno.media', 'start-partito-spaccato.ponte', 'frattura-alleanza.mediazione'], activities: ['mediazione-correnti'], target: 2, label: 'Mediazioni tra le aree' }, { kind: 'cohesion', target: 55, label: 'Coesione del partito' }],
    reward: { capital: 3, relations: { leadership: 3 } }, ambition: { weeks: 30 }, memory: { kind: 'lealta', text: 'Hai tenuto insieme il partito nei momenti difficili', weight: 1 },
    unlock: { text: 'Chi ha ricucito il partito viene chiamato nelle trattative interne: più peso nelle sfide per gli incarichi.', mods: { partyScore: 1 } } },
  { id: 'dirigenza', line: 'partito', needs: 'party', after: ['partito'], label: 'Leadership interna', detail: 'Entra nella direzione nazionale del partito.',
    measures: [{ kind: 'rank', target: 3, label: 'Direzione nazionale' }], reward: { capital: 5 }, ambition: { weeks: 52 },
    unlock: { text: 'Dalla direzione i tuoi giudizi pesano nelle nomine, e la segreteria ti offre un incarico in più.', mods: { partyScore: 2 }, offer: 'obiettivo-dirigenza' } },
  { id: 'guida', line: 'partito', needs: 'party', after: ['dirigenza'], label: 'Alla guida del partito', detail: 'Diventa segretario nazionale (o fondatore).',
    measures: [{ kind: 'rank', target: 5, label: 'Segreteria nazionale' }], reward: { capital: 6, stats: { reputation: 1 } },
    unlock: { text: 'Chi guida il partito è un candidato più forte ovunque: le liste, le alleanze e le candidature passano da te.', mods: { nomination: 1 } } },

  { id: 'candidatura', line: 'istituzioni', label: 'La candidatura', detail: 'Ottieni la candidatura a un’elezione.',
    measures: [{ kind: 'candidacy', target: 1, label: 'Candidatura ottenuta' }], reward: { capital: 3 } },
  { id: 'elezione', line: 'istituzioni', after: ['candidatura'], label: 'Eletto', detail: 'Conquista un mandato alle elezioni.',
    measures: [{ kind: 'mandates', target: 1, label: 'Mandati conquistati' }], reward: { capital: 5 }, ambition: { weeks: 78 },
    unlock: { text: 'Un eletto è un candidato più forte, e ora scegli su cosa costruire il tuo mandato.', mods: { nomination: 0.5 }, offer: 'obiettivo-elezione' } },
  { id: 'rielezione', line: 'istituzioni', after: ['elezione'], label: 'Confermato dagli elettori', detail: 'Vinci un secondo mandato.',
    measures: [{ kind: 'mandates', target: 2, label: 'Mandati conquistati' }], reward: { capital: 5, stats: { reputation: 1 } },
    unlock: { text: 'Chi è stato confermato ha anzianità e radici: più peso nelle promozioni e nelle candidature.', mods: { nomination: 1, seniority: 6 } } },

  { id: 'parlamento', line: 'parlamento', label: 'In Parlamento', detail: 'Siedi alla Camera o al Senato con un gruppo.',
    measures: [{ kind: 'seat', target: 1, label: 'Seggio in Parlamento' }], reward: { capital: 4 } },
  { id: 'incarico', line: 'parlamento', needs: 'seat', after: ['parlamento'], label: 'Responsabilità in Aula', detail: 'Conquista un incarico parlamentare.',
    measures: [{ kind: 'committeeRole', target: 1, label: 'Incarico parlamentare' }], reward: { capital: 4 },
    unlock: { text: 'Chi ha un incarico in commissione ha più peso nelle sfide per i ruoli parlamentari.', mods: { parlScore: 1 } } },
  { id: 'legge', line: 'parlamento', needs: 'seat', after: ['parlamento'], label: 'La tua legge', detail: 'Fai approvare una legge in entrambe le Camere.',
    measures: [{ kind: 'laws', target: 1, label: 'Leggi approvate' }], reward: { capital: 5 }, ambition: { weeks: 104 },
    unlock: { text: 'La tua legge fa scuola: più peso nelle sfide parlamentari, e la stampa chiede di raccontarla.', mods: { parlScore: 1 }, offer: 'obiettivo-legge' } },
  { id: 'governo', line: 'parlamento', label: 'Al Governo', detail: 'Assumi un incarico di ministro.',
    measures: [{ kind: 'minister', target: 1, label: 'Incarico di ministro' }], reward: { capital: 6 },
    unlock: { text: 'Chi ha governato ha un nome che pesa anche in Parlamento.', mods: { parlScore: 1 } } },

  { id: 'relatore', line: 'europa', needs: 'ep', label: 'Relatore in commissione', detail: 'Porta a termine una relazione nel Parlamento europeo.',
    measures: [{ kind: 'epReports', target: 1, label: 'Relazioni concluse' }], reward: { capital: 4, stats: { notoriety: 1.5 } }, ambition: { weeks: 52 },
    unlock: { text: 'Le redazioni raccontano il tuo lavoro a Bruxelles: i rapporti con i media si stabilizzano più in alto.', base: { media: 2 } } },

  { id: 'patti', line: 'integrita', label: 'Chi mantiene i patti', detail: 'Mantieni almeno 2 promesse, onora un debito o rispetta un impegno dichiarato.', mode: 'any',
    measures: [{ kind: 'memory', kinds: ['promessa-mantenuta'], target: 2, label: 'Promesse mantenute' }, { kind: 'debtsPaid', target: 1, label: 'Debiti onorati' }, { kind: 'ambitionsKept', target: 1, label: 'Impegni dichiarati e mantenuti' }],
    reward: { capital: 2, stats: { reputation: 1.5 } },
    unlock: { text: 'Imprese e sindacati sanno che puoi essere creduto: i rapporti si stabilizzano più in alto.', base: { business: 1, unions: 1 } } },
  { id: 'reputazione', line: 'integrita', label: 'Una reputazione solida', detail: 'Reputazione a 65 e una memoria politica in attivo.',
    measures: [{ kind: 'stat', stat: 'reputation', target: 65, label: 'Reputazione' }, { kind: 'memoryNet', target: 0, label: 'Bilancio della memoria politica' }],
    reward: { capital: 3 }, ambition: { weeks: 52 },
    unlock: { text: 'Chi ha una reputazione solida è un candidato più credibile per il partito e per gli elettori.', mods: { nomination: 0.5 } } },

  { id: 'integrazione', line: 'partenza', needs: 'start:outsider', label: 'Non più outsider', detail: 'Lascia che l’apparato ti accolga: più resti nei palazzi e curi i rapporti, meno sei un outsider.',
    measures: [{ kind: 'outsider', target: 1, label: 'Integrazione' }], reward: { capital: 4, party: { support: 3 } }, memory: { kind: 'decisione', text: 'Da outsider a figura riconosciuta', weight: 0.8 },
    unlock: { text: 'L’apparato ti tratta da pari: le candidature del partito sono più facili.', mods: { nomination: 1 } } },
  { id: 'saldo-debiti', line: 'partenza', needs: 'start:debiti', label: 'Debiti politici saldati', detail: 'Onora tutti i debiti con cui sei partito: pagare costa, ma libera.',
    measures: [{ kind: 'debtsPaid', target: 'all', label: 'Debiti onorati' }], reward: { capital: 3, stats: { reputation: 1 } },
    unlock: { text: 'Chi ha pagato i suoi debiti è libero: i rapporti con imprese e sindacati si stabilizzano più in alto.', base: { business: 1, unions: 1 } } },
  { id: 'ricomposizione', line: 'partenza', needs: 'start:partito-diviso', label: 'Il partito ricomposto', detail: 'Chiudi gli scontri aperti e riporta la coesione sopra 55.',
    measures: [{ kind: 'divided', target: 1, label: 'Divisione chiusa' }], reward: { capital: 4, party: { support: 3 } },
    unlock: { text: 'Il partito ricomposto ti riconosce un ruolo di garanzia.', mods: { partyScore: 1 }, offer: 'obiettivo-ricomposizione' } },
  { id: 'attese', line: 'partenza', needs: 'start:aspettative', label: 'All’altezza delle attese', detail: 'Resta sopra le attese di chi si aspettava molto da te per 26 settimane.',
    measures: [{ kind: 'weeksAbove', target: 26, label: 'Settimane all’altezza' }], reward: { capital: 4, stats: { reputation: 2 }, party: { support: 3 } },
    unlock: { text: 'Hai smentito chi dubitava: candidature e promozioni sono più facili.', mods: { nomination: 1 } } },

  { id: 'colle', line: 'quirinale', needs: 'quirinale', label: 'Il Colle', detail: 'Sii eletto Presidente della Repubblica.',
    measures: [{ kind: 'president', target: 1, label: 'Presidente della Repubblica' }], reward: { stats: { reputation: 2, notoriety: 3 } },
    unlock: { text: 'Il tuo nome entra nella storia della Repubblica simulata: la carriera prosegue al di sopra delle parti.' } },
  { id: 'settennato', line: 'quirinale', needs: 'president', after: ['colle'], label: 'Un settennato da ricordare', detail: 'Porta il credito istituzionale a 70.',
    measures: [{ kind: 'presidentCredit', target: 70, label: 'Credito istituzionale' }], reward: { stats: { reputation: 2 } },
    unlock: { text: 'Il tuo mandato è ricordato come un punto di riferimento per le istituzioni.' } }
]);
// A goal reached also builds the reputation of its line (the party's goals the internal one, the territory's the territorial one, and
// so on) and, where it is about a policy theme, the influence in its sector: the standing is what the promotions weigh.
const LINE_REPUTATION = Object.freeze({ territorio: 'territorial', partito: 'internal', istituzioni: 'territorial', parlamento: 'institutional', europa: 'institutional', integrita: 'media', partenza: 'internal', quirinale: 'institutional' });
const OWN_REPUTATION = Object.freeze({ rete: 'territorial', 'territorio-con-te': 'territorial', voce: 'media', patti: 'internal', reputazione: 'media', governo: 'institutional', legge: 'institutional', incarico: 'institutional', elezione: 'territorial', rielezione: 'territorial' });
export const CAREER_OBJECTIVES = Object.freeze(RAW_OBJECTIVES.map(item => {
  const reputation = OWN_REPUTATION[item.id] ?? LINE_REPUTATION[item.line];
  const gain = Math.max(1, Math.min(4, Math.round((item.reward?.capital ?? 2) / 2)));
  return Object.freeze({ ...item, reward: Object.freeze({ ...(item.reward ?? {}), ...(reputation && !item.reward?.standing ? { standing: Object.freeze({ [reputation]: gain }) } : {}) }) });
}));
export const OBJECTIVE_BY_ID = Object.freeze(Object.fromEntries(CAREER_OBJECTIVES.map(item => [item.id, item])));
// The goals the game has always had: saves from before the new ones keep them as they were.
export const CLASSIC_OBJECTIVES = Object.freeze(['radicamento', 'rete', 'partito', 'candidatura', 'elezione', 'parlamento', 'incarico', 'legge', 'dirigenza', 'governo']);

// ---------- the decisions an unlock puts on the desk ----------
const choice = (id, label, extra = {}) => ({ id, label, ...extra });
export const OBJECTIVE_SITUATIONS = Object.freeze({
  'obiettivo-dirigenza': {
    id: 'obiettivo-dirigenza', title: 'La segreteria ti offre un dipartimento', body: 'Entrando nella direzione nazionale hai guadagnato la fiducia della segreteria, che ti propone di guidare un dipartimento a tua scelta: un incarico in più, ma anche una responsabilità sui risultati davanti al partito.',
    defaultChoice: 'rifiuta', choices: [
      choice('accetta', 'Accetta il dipartimento (1 giorno, 2 capitale)', { cost: { ap: 1, capital: 2 }, effects: { party: { support: 3 }, stats: { influence: 2 }, relations: { leadership: 3 } }, special: 'objective-role-dipartimento' }),
      choice('rifiuta', 'Ringrazia e rifiuta', { effects: { stats: { reputation: 0.5 }, relations: { leadership: -1 } } })
    ]
  },
  'obiettivo-legge': {
    id: 'obiettivo-legge', title: 'La tua legge fa scuola', body: 'La stampa e altri gruppi parlano della legge che hai fatto approvare. Puoi cavalcare l’attenzione con un giro nei territori, o consolidare il risultato con una seconda iniziativa.',
    defaultChoice: 'lascia', choices: [
      choice('tour', 'Fai un giro nei territori per raccontarla (2 giorni)', { cost: { ap: 2 }, effects: { stats: { notoriety: 2, popularity: 1.5 }, relations: { media: 3 } } }),
      choice('seconda', 'Prepara una seconda iniziativa (1 giorno, 2 capitale)', { cost: { ap: 1, capital: 2 }, effects: { group: { support: 3 }, stats: { influence: 1.5 } } }),
      choice('lascia', 'Lascia che il risultato parli da solo', { effects: { stats: { reputation: 0.5 } } })
    ]
  },
  'obiettivo-elezione': {
    id: 'obiettivo-elezione', title: 'Il tuo primo mandato', body: 'Hai vinto: ora scegli su cosa costruire il tuo mandato. Ogni scelta stringe un legame e ne lascia un altro più debole.',
    defaultChoice: 'territorio', choices: [
      choice('territorio', 'Radicati nel territorio che ti ha votato', { effects: { relations: { civic: 4 }, stats: { popularity: 1.5 } } }),
      choice('partito', 'Costruisci il tuo peso nel partito', { effects: { relations: { leadership: 4 }, party: { support: 2 } } }),
      choice('visibilita', 'Punta sulla visibilità nazionale', { effects: { stats: { notoriety: 2.5 }, relations: { media: 3, civic: -1 } } })
    ]
  },
  'obiettivo-ricomposizione': {
    id: 'obiettivo-ricomposizione', title: 'Garante dell’unità', body: 'Il partito ricomposto ti chiede di assumere un ruolo di garanzia: tenere insieme le aree, vigilare sui patti, parlare con tutti. È un incarico che pesa, e che nessun altro potrebbe svolgere senza sospetti.',
    defaultChoice: 'rifiuta', choices: [
      choice('accetta', 'Accetta il ruolo di garante (1 giorno, 2 capitale)', { cost: { ap: 1, capital: 2 }, effects: { party: { support: 3 }, org: { cohesion: 4 } }, special: 'objective-role-garante' }),
      choice('rifiuta', 'Preferisci restare in prima linea', { effects: { stats: { influence: 0.5 } } })
    ]
  }
});
