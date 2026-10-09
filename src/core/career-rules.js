import { CAREER_LEVELS, ITALIAN_REGIONS, PROVINCIAL_LEVEL_PROBLEM, hasProvincialLevel } from '../data/regions.js?v=20261009-1';
import { isSelectableParty } from '../data/schema.js?v=20261009-1';
import { DIFFICULTIES } from '../data/simulation/difficulty-rules.js?v=20261009-1';
import { startAgeProblems, startProblems } from './start-engine.js?v=20261009-1';
import { presidentialEligibility } from './presidency-engine.js?v=20261009-1';

const genders = new Set(['preferisco-non-specificare', 'donna', 'uomo', 'non-binario']);
const orientations = new Set(['Centrismo civico', 'Progressista', 'Conservatore', 'Liberale', 'Socialdemocratico', 'Ecologista', 'Popolare', 'Autonomista', 'Altro']);
export const STARTING_ROLES = Object.freeze({
  militante: { label: 'Giovane militante', partyRank: 0 },
  dirigenteLocale: { label: 'Dirigente locale', partyRank: 1 },
  dirigenteRegionale: { label: 'Dirigente regionale', partyRank: 2 },
  direzioneNazionale: { label: 'Direzione nazionale', partyRank: 3 },
  segretarioNazionale: { label: 'Segretario nazionale', partyRank: 5 }
});
export const STARTING_OFFICES = Object.freeze({
  presidenteConsiglio: { label: 'Presidente del Consiglio' },
  presidenteRepubblica: { label: 'Presidente della Repubblica — scenario alternativo' }
});
const isValidDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

// Steps of a new career: 1 where (Regione → Comune, from the ISTAT list), 2 path, 3 party, 4 difficulty and starting conditions, 5 who you are.
// territory: { units, municipalities } — when given, the comune must be one of the ISTAT list, in the chosen region.
export const CAREER_STEPS = 5;
// requireTerritory: the Career Wizard needs the ISTAT list; while it is missing no comune can be accepted (never one
// typed freely). Without it (saves, tests, careers built in code) a comune name is enough, as before.
export function validateCareerStep(draft, step, selectableParties, parliamentaryGroups = [], territory = null, { requireTerritory = false } = {}) {
  const errors = [];
  if (step === 1) {
    if (!ITALIAN_REGIONS.includes(draft.region)) errors.push('Scegli la regione in cui iniziare.');
    else if (requireTerritory && !territory?.municipalities?.length) errors.push('L’elenco ISTAT dei comuni non è ancora disponibile: attendi il caricamento o premi «Riprova».');
    else if (territory?.municipalities?.length) {
      const municipality = territory.municipalities.find(item => item.code === draft.municipalityCode);
      const unit = municipality ? territory.units?.find(item => item.code === municipality.unit) : null;
      if (!municipality) errors.push('Scegli il comune dall’elenco ISTAT.');
      else if (unit?.gameRegion !== draft.region) errors.push('Il comune scelto non si trova in questa regione.');
    } else if (!draft.municipality?.trim()) errors.push('Scegli il comune in cui iniziare.');
  }
  if (step === 5) {
    if (!draft.firstName?.trim()) errors.push('Inserisci il nome.');
    if (!draft.lastName?.trim()) errors.push('Inserisci il cognome.');
    if (!isValidDate(draft.birthDate) || draft.birthDate > draft.currentDate) errors.push('Inserisci una data di nascita valida e precedente all’inizio della carriera.');
    if (!genders.has(draft.gender)) errors.push('Seleziona il genere.');
    if (!draft.previousProfession?.trim()) errors.push('Inserisci la professione precedente.');
    if (draft.startingOffice === 'presidenteRepubblica') errors.push(...presidentialEligibility({ birthDate: draft.birthDate, date: draft.currentDate }).problems);
    // A career that starts consolidated needs the years to have it: the age is known only here.
    errors.push(...startAgeProblems(draft.start, { partyMode: draft.partyMode, birthDate: draft.birthDate, date: draft.currentDate }));
  }
  if (step === 4 && draft.difficulty && !DIFFICULTIES[draft.difficulty]) errors.push('Scegli una difficoltà.');
  // How the career starts (outsider, debts, a divided party, a consolidated career, a custom scenario).
  if (step === 4) errors.push(...startProblems(draft.start, { partyMode: draft.partyMode }));
  if (step === 2) {
    const level = CAREER_LEVELS[draft.initialLevel];
    const startingOffice = draft.startingOffice ? STARTING_OFFICES[draft.startingOffice] : null;
    const externalPremier = draft.startingOffice === 'presidenteConsiglio' && draft.parliamentStartMode === 'external';
    const directPresident = draft.startingOffice === 'presidenteRepubblica';
    if (!level) errors.push('Scegli un percorso iniziale.');
    else if (draft.startingOffice && !startingOffice) errors.push('Scegli un punto di partenza valido.');
    else if (draft.startingOffice === 'presidenteConsiglio' && !externalPremier && !level.chamber) errors.push('Per iniziare da Presidente del Consiglio scegli Camera, Senato o un contesto esterno al Parlamento.');
    else if (draft.initialLevel === 'provinciale' && !hasProvincialLevel({ region: draft.region, provinceCode: draft.provinceCode, provinceType: draft.provinceType })) errors.push(PROVINCIAL_LEVEL_PROBLEM);
    else if (level.chamber && !externalPremier && !directPresident) {
      if (draft.parliamentStartMode !== 'real-context') errors.push('Scegli il contesto parlamentare reale per questo percorso.');
      const selectedGroup = parliamentaryGroups.find(group => group.id === draft.parliamentaryGroupId && group.source === 'real' && group.verified === true && group.chamber === level.chamber);
      if (!selectedGroup) errors.push(`Scegli un gruppo reale della ${level.chamber === 'camera' ? 'Camera' : 'Senato'} per lo scenario.`);
    }
    if (draft.startingOffice === 'presidenteConsiglio' && !['camera', 'senato'].every(chamber => parliamentaryGroups.some(group => group.source === 'real' && group.verified === true && group.chamber === chamber && Number(group.memberCount) > 0))) errors.push('Per iniziare da Presidente del Consiglio servono i gruppi di entrambe le Camere.');
    if (externalPremier && draft.parliamentaryGroupId) errors.push('Il Presidente del Consiglio esterno non ha un gruppo parlamentare personale.');
    if (directPresident && (level.chamber || draft.parliamentaryGroupId)) errors.push('La partenza da Presidente della Repubblica non prevede seggio o gruppo parlamentare personale.');
  }
  if (step === 3) {
    if (!['independent', 'existing', 'new'].includes(draft.partyMode)) errors.push('Scegli come iniziare il percorso di partito.');
    if (draft.startingOffice === 'presidenteRepubblica' && (draft.partyMode !== 'independent' || draft.startingRole != null)) errors.push('La partenza da Presidente della Repubblica è indipendente e senza incarichi di partito.');
    if (draft.partyMode === 'independent' && draft.startingRole != null) errors.push('Una carriera indipendente non può avere una posizione di partito.');
    if (draft.partyMode === 'existing' && !STARTING_ROLES[draft.startingRole]) errors.push('Scegli una posizione nel partito valida.');
    if (draft.partyMode === 'new' && draft.startingRole != null) errors.push('Chi fonda un partito assume la guida tramite il ruolo di fondatore.');
    if (draft.partyMode === 'existing' && !selectableParties.some(p => p.id === draft.partyId && isSelectableParty(p))) errors.push('Seleziona un partito reale verificato oppure fondane uno tuo.');
    if (draft.partyMode === 'new') {
      if (!draft.partyName?.trim()) errors.push('Inserisci il nome del partito.');
      if (!draft.partyAbbreviation?.trim()) errors.push('Inserisci l’abbreviazione.');
      if (!draft.partyDescription?.trim()) errors.push('Inserisci una descrizione.');
      if (!orientations.has(draft.partyOrientation)) errors.push('Scegli un orientamento generale.');
      if (!/^#[\da-f]{6}$/i.test(draft.partyColor || '')) errors.push('Scegli un colore valido.');
      if (draft.partyColor2 && !/^#[\da-f]{6}$/i.test(draft.partyColor2)) errors.push('Scegli un secondo colore valido.');
      if ((draft.partyProgram ?? []).length > 4) errors.push('Il programma ha al massimo quattro priorità.');
      if (draft.partyLogoMode === 'url' && !/^https?:\/\/\S+$/i.test(draft.partyLogoUrl || '')) errors.push('Incolla un indirizzo del logo che inizi con https://, oppure scegli un altro tipo di logo.');
      for (const [key, label] of [['economia','economia'], ['welfare','welfare'], ['ambiente','ambiente'], ['europa','integrazione europea']]) {
        const value = Number(draft.policyPositions?.[key]);
        if (!Number.isInteger(value) || value < 1 || value > 5) errors.push(`Imposta la posizione su ${label} da 1 a 5.`);
      }
    }
  }
  return errors;
}

export function validateNewCareerDraft(draft, selectableParties, parliamentaryGroups = [], territory = null) {
  return Array.from({ length: CAREER_STEPS }, (_, index) => index + 1).flatMap(step => validateCareerStep(draft, step, selectableParties, parliamentaryGroups, territory));
}
