import { CAREER_LEVELS, ITALIAN_REGIONS } from '../data/regions.js?v=20260926-2';
import { isSelectableParty } from '../data/schema.js?v=20260926-2';
import { DIFFICULTIES } from '../data/simulation/difficulty-rules.js?v=20260926-2';

const genders = new Set(['preferisco-non-specificare', 'donna', 'uomo', 'non-binario']);
const orientations = new Set(['Centrismo civico', 'Progressista', 'Conservatore', 'Liberale', 'Socialdemocratico', 'Ecologista', 'Popolare', 'Autonomista', 'Altro']);
const isValidDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

// Steps of a new career: 1 where (Regione → Comune, from the ISTAT list), 2 path, 3 party, 4 difficulty, 5 who you are.
// territory: { units, municipalities } — when given, the comune must be one of the ISTAT list, in the chosen region.
export const CAREER_STEPS = 5;
export function validateCareerStep(draft, step, selectableParties, parliamentaryGroups = [], territory = null) {
  const errors = [];
  if (step === 1) {
    if (!ITALIAN_REGIONS.includes(draft.region)) errors.push('Scegli la regione in cui iniziare.');
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
  }
  if (step === 4 && draft.difficulty && !DIFFICULTIES[draft.difficulty]) errors.push('Scegli una difficoltà.');
  if (step === 2) {
    const level = CAREER_LEVELS[draft.initialLevel];
    if (!level) errors.push('Scegli un percorso iniziale.');
    else if (level.chamber) {
      if (draft.parliamentStartMode !== 'real-context') errors.push('Scegli il contesto parlamentare reale per questo percorso.');
      const selectedGroup = parliamentaryGroups.find(group => group.id === draft.parliamentaryGroupId && group.source === 'real' && group.verified === true && group.chamber === level.chamber);
      if (!selectedGroup) errors.push(`Scegli un gruppo reale della ${level.chamber === 'camera' ? 'Camera' : 'Senato'} per lo scenario.`);
    }
  }
  if (step === 3) {
    if (!['independent', 'existing', 'new'].includes(draft.partyMode)) errors.push('Scegli come iniziare il percorso di partito.');
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
