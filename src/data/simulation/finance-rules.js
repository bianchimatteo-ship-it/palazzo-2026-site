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
    { cost: 260, label: 'Sede aperta', effect: 'Preparazione elettorale +1,5 e sostegno nel partito +0,3 a settimana.' }] }
]);

export const DEBT_WEEKLY_INTEREST = 0.01;
export const DEBT_CRISIS_THRESHOLD = 2500;
export const RESERVE_BEFORE_REPAYING = 1500;
export const LEDGER_SIZE = 80;
export const HISTORY_WEEKS = 52;
