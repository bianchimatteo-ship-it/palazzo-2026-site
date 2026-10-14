// The staff of the politician: what it can be asked to do on its own, week after week, with its own budget. Game values, not real accounts; no real person works here.
// A mandate is the player's decision (objective, duration, weekly budget and a ceiling, a target); the staff carries it out every weekly close with a skill that comes from what the player has
// built (the budget lines, the committees, the standing) and reports back. What is the player's to decide is never delegated: votes, candidacies, deals and irreversible steps.

export const STAFF_SKILLS = Object.freeze({
  organizzazione: 'Organizzazione', comunicazione: 'Comunicazione', territorio: 'Territorio', tesoreria: 'Tesoreria', analisi: 'Analisi'
});

// Tasks. `needs`: what must exist for the staff to work at all ('comitati': committees of the party, 'dirigenti': local leaders). `target`: what the player may point it at.
export const STAFF_TASKS = Object.freeze([
  { id: 'volontari', label: 'Mobilitare i volontari', icon: 'users', skill: 'organizzazione', minSkill: 30, minWeeklyBudget: 100, needs: 'comitati', target: 'committee', unit: 'volontari mobilitati', objective: 12,
    detail: 'Lo staff tiene in moto i volontari di un comitato: più presenza sul territorio e un po’ di popolarità, ma anche stanchezza.', needsLabel: 'Serve un partito con comitati sul territorio (Partito › Territorio).' },
  { id: 'dirigenti', label: 'Curare i dirigenti locali', icon: 'users', skill: 'organizzazione', minSkill: 35, minWeeklyBudget: 80, needs: 'dirigenti', target: 'cadre', unit: 'colloqui riusciti', objective: 4,
    detail: 'Colloqui regolari con un responsabile dei comitati: meno malcontento e più lealtà. Le promozioni e le promesse di candidatura restano a te.', needsLabel: 'Serve almeno un dirigente locale (Partito › Vita interna).' },
  { id: 'raccolta', label: 'Raccolta fondi continuativa', icon: 'wallet', skill: 'tesoreria', minSkill: 25, minWeeklyBudget: 100, needs: null, target: null, unit: '€ raccolti', objective: 600,
    detail: 'Cene, contatti con i sostenitori, appelli: il ricavo non è garantito e può restare sotto la spesa. Sono monete di gioco, mai denaro vero.', needsLabel: '' },
  { id: 'comunicazione', label: 'Presidio di media e social', icon: 'megaphone', skill: 'comunicazione', minSkill: 25, minWeeklyBudget: 120, needs: null, target: null, unit: 'punti di notorietà', objective: 2,
    detail: 'Comunicati, risposte, presenza sui social e con le redazioni: notorietà e rapporti con i media, con il rischio di una battuta fuori posto.', needsLabel: '' },
  { id: 'territorio', label: 'Presenza sul territorio', icon: 'pin', skill: 'territorio', minSkill: 25, minWeeklyBudget: 120, needs: null, target: null, unit: 'punti di popolarità', objective: 2,
    detail: 'Lo staff presidia mercati, associazioni e sedi al posto tuo: popolarità e reputazione sul territorio, in modo più lento di una tua visita.', needsLabel: '' },
  { id: 'studio', label: 'Dossier e analisi', icon: 'book', skill: 'analisi', minSkill: 20, minWeeklyBudget: 70, needs: null, target: null, unit: 'punti di preparazione', objective: 5,
    detail: 'Dossier sul territorio, sondaggi e dati: preparazione elettorale ed esperienza crescono piano ma sicuri.', needsLabel: '' }
]);
export const STAFF_TASK_BY_ID = Object.freeze(Object.fromEntries(STAFF_TASKS.map(task => [task.id, task])));
export const STAFF_DURATIONS = Object.freeze([[1, 'Una volta (alla chiusura della settimana)'], [4, '4 settimane'], [8, '8 settimane'], [12, '12 settimane'], [26, '26 settimane']]);
export const STAFF_MAX_MANDATES = 3;
export const STAFF_REPORTS_KEPT = 40;
// What the staff never decides by itself, and why: the interface says it, the engine refuses it.
export const NON_DELEGABLE = Object.freeze([
  ['Voti in Aula e nei consigli', 'Il voto è tuo: lo staff non vota al posto tuo.'],
  ['Candidature e liste', 'Candidarti, promettere o negare una candidatura e compilare le liste resta una tua scelta.'],
  ['Accordi, alleanze e trattative decisive', 'Firmare, rompere o rinnovare un accordo cambia il tuo partito: lo decidi tu.'],
  ['Scelte irreversibili', 'Dimissioni, fondare, fondere o lasciare un partito, espulsioni, sostituire un dirigente: solo con la tua approvazione.']
]);
export const MANDATE_STATUS = Object.freeze({ attivo: 'In corso', sospeso: 'Sospeso', concluso: 'Concluso', annullato: 'Annullato' });
