// Political finances of the player: a simulated committee with income, recurring budget and debt.
// Amounts are game values, not real salaries, allowances or accounts.

export const FINANCE_CATEGORIES = Object.freeze({
  base: { label: 'Sostenitori ricorrenti', kind: 'entrata' },
  indennita: { label: 'Indennità di carica', kind: 'entrata' },
  rimborsi: { label: 'Rimborsi del partito', kind: 'entrata' },
  donazioni: { label: 'Donazioni e raccolte fondi', kind: 'entrata' },
  territorio: { label: 'Attività territoriali', kind: 'uscita' },
  comunicazione: { label: 'Comunicazione', kind: 'uscita' },
  eventi: { label: 'Eventi e appuntamenti', kind: 'uscita' },
  personale: { label: 'Personale', kind: 'uscita' },
  sede: { label: 'Sede e segreteria', kind: 'uscita' },
  campagne: { label: 'Campagne elettorali', kind: 'uscita' },
  partito: { label: 'Contributi al partito', kind: 'uscita' },
  relazioni: { label: 'Relazioni e rappresentanza', kind: 'uscita' },
  interessi: { label: 'Interessi sul debito', kind: 'uscita' },
  debito: { label: 'Rimborso del debito', kind: 'uscita' },
  investimenti: { label: 'Investimenti', kind: 'uscita' },
  manutenzione: { label: 'Mantenimento e utenze', kind: 'uscita' },
  formazione: { label: 'Formazione e squadra', kind: 'uscita' },
  imprevisti: { label: 'Imprevisti', kind: 'uscita' },
  fondo: { label: 'Fondo elettorale', kind: 'movimento' },
  riserva: { label: 'Riserva di emergenza', kind: 'movimento' },
  altro: { label: 'Altro', kind: 'uscita' }
});

// Where the money of a weekly activity goes.
export const ACTIVITY_FINANCE_CATEGORY = Object.freeze({
  territorio: 'territorio', media: 'comunicazione', partito: 'partito', parlamento: 'relazioni', relazioni: 'relazioni', risorse: 'donazioni', elezioni: 'campagne'
});

// Recurring budget lines: every level is paid each week and works every week.
export const BUDGET_LINES = Object.freeze([
  { id: 'personale', label: 'Staff e collaboratori', icon: 'users', category: 'personale', levels: [
    { cost: 0, label: 'Nessuno', effect: 'Fai tutto da solo.' },
    { cost: 380, label: 'Un collaboratore', effect: '+1 giorno ogni due settimane.' },
    { cost: 850, label: 'Segreteria completa', effect: '+1 giorno ogni settimana, +1 capitale politico.' }] },
  { id: 'comunicazione', label: 'Comunicazione e social', icon: 'megaphone', category: 'comunicazione', levels: [
    { cost: 0, label: 'Spenta', effect: 'Nessuna presenza programmata.' },
    { cost: 180, label: 'Essenziale', effect: 'Notorietà +0,5 e redazioni +0,5 a settimana.' },
    { cost: 460, label: 'Intensa', effect: 'Notorietà +1,1, popolarità +0,3, redazioni +1 a settimana.' }] },
  { id: 'territorio', label: 'Presenza sul territorio', icon: 'pin', category: 'territorio', levels: [
    { cost: 0, label: 'Occasionale', effect: 'Solo le attività che scegli tu.' },
    { cost: 160, label: 'Costante', effect: 'Popolarità +0,5, associazioni +0,5; nessun calo per assenza.' },
    { cost: 420, label: 'Capillare', effect: 'Popolarità +1, consenso +0,2, associazioni +1 a settimana.' }] },
  { id: 'sede', label: 'Sede e comitato', icon: 'town', category: 'sede', levels: [
    { cost: 0, label: 'Nessuna sede', effect: 'Nessun presidio fisso.' },
    { cost: 260, label: 'Sede aperta', effect: 'Preparazione elettorale +1,5 e sostegno nel partito +0,3 a settimana.' }] },
  // Programmes with a memory: what they return builds up week after week (the ramp) and fades when the money stops.
  { id: 'formazione', label: 'Formazione e scouting', icon: 'book', category: 'formazione', ramp: 12, levels: [
    { cost: 0, label: 'Nessuna', effect: 'Nessun investimento sulle persone.' },
    { cost: 140, label: 'Corsi periodici', effect: 'Volontari più preparati e candidati meglio selezionati (a regime dopo circa 12 settimane).', weekly: { quality: 3, selection: 0.1, stats: { experience: 0.15 } } },
    { cost: 320, label: 'Scuola quadri', effect: 'Quadri e candidati di livello: qualità dei volontari, sostegno interno e candidature più forti.', weekly: { quality: 7, selection: 0.25, party: 0.2, stats: { experience: 0.3 } } }] },
  { id: 'digitale', label: 'Sito, app e dati', icon: 'chart', category: 'comunicazione', ramp: 10, levels: [
    { cost: 0, label: 'Solo i social', effect: 'Nessuna infrastruttura propria.' },
    { cost: 90, label: 'Sito e newsletter', effect: 'Un archivio di contatti: notorietà +0,3 e qualche donazione in più col tempo.', weekly: { stats: { notoriety: 0.3 }, donations: 35, recruit: 0.0004 } },
    { cost: 240, label: 'App e piattaforma dati', effect: 'Notorietà +0,6, volontari e donazioni in crescita; costa e va tenuta aggiornata.', weekly: { stats: { notoriety: 0.6 }, donations: 95, recruit: 0.001, volunteers: 2 } }] },
  { id: 'raccolta', label: 'Raccolta fondi', icon: 'wallet', category: 'formazione', ramp: 16, levels: [
    { cost: 0, label: 'Spenta', effect: 'Solo i sostenitori che ti trovano da soli.' },
    { cost: 120, label: 'Campagna donatori', effect: 'Ritorno lento: dopo qualche mese le donazioni superano il costo.', weekly: { donations: 210 } },
    { cost: 300, label: 'Grandi donatori', effect: 'Donazioni più alte a regime, ma i grandi sostenitori vogliono attenzioni e c’è il rischio di un caso.', weekly: { donations: 520, risk: { chance: 0.012, label: 'Un grande donatore finisce sui giornali', stats: { reputation: -1.2 }, cost: 600 } } }] },
  { id: 'logistica', label: 'Mezzi e logistica', icon: 'pin', category: 'territorio', ramp: 4, levels: [
    { cost: 0, label: 'Si arrangia chi può', effect: 'Nessun mezzo organizzato.' },
    { cost: 80, label: 'Mezzi in comodato', effect: 'Più presenza sul territorio con meno spese per le attività: volontari +1 nelle campagne.', weekly: { volunteers: 1, stats: { popularity: 0.15 } } },
    { cost: 210, label: 'Mezzi propri e logistica', effect: 'Eventi e mobilitazione senza intoppi: popolarità +0,3, volontari +3 e organizzazione +2 nelle campagne.', weekly: { volunteers: 3, organization: 2, stats: { popularity: 0.3 }, risk: { chance: 0.008, label: 'Un guasto ai mezzi blocca un evento', cost: 350 } } }] }
]);

// Investments: some become lasting assets that cost to keep (upkeep), return something every week, lose value (decay) and
// carry a risk; upgrades need the asset they improve. Others buy information or preparation once.
export const INVESTMENTS = Object.freeze([
  { id: 'piattaforma', label: 'Piattaforma per volontari e contatti', icon: 'users', cost: 2500, value: 1200, upkeep: 20, decay: 0.004, effect: 'Notorietà +0,3 a settimana; 3 volontari in più all’avvio di ogni campagna. Costa 20 € a settimana tra server e assistenza.' },
  { id: 'piattaforma-pro', label: 'Piattaforma evoluta (CRM e app)', icon: 'chart', cost: 4200, value: 2000, upkeep: 55, decay: 0.006, requires: 'piattaforma', weekly: { stats: { notoriety: 0.3 }, donations: 45, volunteers: 2 }, risk: { chance: 0.004, label: 'Un incidente sui dati degli iscritti', cost: 900, stats: { reputation: -1 } }, effect: 'Potenzia la piattaforma: +0,3 notorietà, 2 volontari nelle campagne e donazioni che crescono; costa 55 € a settimana e un guasto sui dati ha un prezzo.' },
  { id: 'sede-propria', label: 'Acquisto della sede del comitato', icon: 'town', cost: 6000, value: 5400, effect: 'Con la sede aperta paghi solo le utenze (60 € invece di 260 €); resta nel tuo patrimonio.' },
  { id: 'sede-ampliata', label: 'Ampliamento della sede', icon: 'town', cost: 5200, value: 3600, upkeep: 90, requires: 'sede-propria', weekly: { prep: 1, party: 0.2, volunteers: 2 }, effect: 'Sala riunioni e segreteria: preparazione +1 a settimana, sostegno nel partito +0,2, 2 volontari nelle campagne; 90 € a settimana di mantenimento.' },
  { id: 'mezzi', label: 'Mezzi per eventi e trasferte', icon: 'pin', cost: 3400, value: 2600, upkeep: 40, decay: 0.012, weekly: { volunteers: 2, stats: { popularity: 0.15 } }, risk: { chance: 0.01, label: 'Un guasto ai mezzi blocca un evento', cost: 450 }, effect: 'Presenza sul territorio senza chiedere favori: popolarità +0,15 e 2 volontari nelle campagne. Si usurano (−1,2% a settimana), costano 40 € a settimana e ogni tanto si rompono.' },
  { id: 'archivio-dati', label: 'Archivio dati e ricerca sul territorio', icon: 'chart', cost: 2900, value: 0, upkeep: 30, weeks: 78, weekly: { prep: 0.6, organization: 1 }, effect: 'Sai dove cercare i voti: preparazione +0,6 a settimana e +1 organizzazione nelle campagne per un anno e mezzo; 30 € a settimana.' },
  { id: 'scouting', label: 'Scouting e formazione dei candidati', icon: 'ballot', cost: 2600, value: 0, upkeep: 25, weeks: 52, weekly: { selection: 0.35, party: 0.15, organization: 1 }, effect: 'Candidati preparati e liste più forti: peso nelle candidature +0,35 e +1 organizzazione nelle campagne per un anno; 25 € a settimana.' },
  { id: 'media-locali', label: 'Presenza sui media locali (un anno)', icon: 'megaphone', cost: 2200, value: 0, upkeep: 30, weeks: 52, weekly: { relations: { media: 0.3 }, stats: { popularity: 0.2, notoriety: 0.1 } }, effect: 'Rubrica fissa, radio e testate del territorio: redazioni +0,3, popolarità +0,2 e notorietà +0,1 a settimana per un anno; 30 € a settimana.' },
  { id: 'sondaggio', label: 'Sondaggio riservato sul territorio', icon: 'chart', cost: 1500, value: 0, repeatable: true, effect: 'Sai dove concentrarti: preparazione elettorale +8 e capitale politico +2.' },
  { id: 'ufficio-stampa', label: 'Ufficio stampa esterno (un anno)', icon: 'news', cost: 3200, value: 0, weeks: 52, effect: 'Per 52 settimane i rischi delle attività sui media si dimezzano e le redazioni +0,5 a settimana.' }
]);
// A reserve is not spent: it absorbs the unexpected, so that a bad week does not become a debt.
export const RESERVE = Object.freeze({ min: 200, deposits: [500, 1000, 2500], cap: 12000 });
// The unexpected: every week each shock may happen with its chance (higher where the cause is there); the reserve pays first.
export const FINANCE_SHOCKS = Object.freeze([
  { id: 'spese-legali', label: 'Spese legali', chance: 0.007, risky: ({ game }) => (game.flags?.opaqueFunding ? 0.02 : 0) + ((game.memory ?? []).slice(0, 12).some(item => item.kind === 'scandalo') ? 0.006 : 0), cost: [250, 900], effects: { stats: { reputation: -0.4 } }, text: 'Una causa e le spese del legale: si paga anche quando si ha ragione.' },
  { id: 'imprevisto-personale', label: 'Imprevisto personale', chance: 0.006, cost: [150, 600], effects: {}, text: 'Una spesa urgente fuori dalla politica: capita.' },
  { id: 'donatore-ritira', label: 'Un sostenitore ritira il contributo', chance: 0.005, when: ({ game }) => (game.finance?.budget?.raccolta ?? 0) > 0, cost: [120, 450], effects: { stats: { notoriety: -0.2 } }, text: 'Un donatore importante si sfila: l’entrata prevista non arriva.' },
  { id: 'danno-sede', label: 'Danni alla sede', chance: 0.005, when: ({ game }) => (game.finance?.budget?.sede ?? 0) > 0, cost: [200, 800], effects: {}, text: 'Un danno alla sede: riparazioni e qualche giorno di lavoro perso.' }
]);
// A role costs: the higher the office, the more it takes to represent it (guests, staff, security).
export const ROLE_COST_SHARE = 0.2;
export const ELECTION_FUND_MATCH = 0.15;
export const DEBT_WEEKLY_INTEREST = 0.01;
export const DEBT_CRISIS_THRESHOLD = 2500;
export const RESERVE_BEFORE_REPAYING = 1500;
export const LEDGER_SIZE = 80;
export const HISTORY_WEEKS = 52;
