export const ITALIAN_REGIONS = Object.freeze([
  'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia',
  'Lazio', 'Liguria', 'Lombardia', 'Marche', 'Molise', 'Piemonte', 'Puglia',
  'Sardegna', 'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', 'Valle d’Aosta', 'Veneto'
]);

export const CAREER_LEVELS = Object.freeze({
  comunale: { label: 'Carriera comunale', shortLabel: 'Comunale', territory: 'comune', office: 'Consigliere comunale' },
  regionale: { label: 'Carriera regionale', shortLabel: 'Regionale', territory: 'regione', office: 'Consigliere regionale' },
  deputato: { label: 'Carriera come Deputato', shortLabel: 'Deputato', territory: 'camera', office: 'Deputato (scenario di simulazione)', chamber: 'camera' },
  senatore: { label: 'Carriera come Senatore', shortLabel: 'Senatore', territory: 'senato', office: 'Senatore (scenario di simulazione)', chamber: 'senato' }
});

// Saves created before the Deputato/Senatore split still carry the old national path.
const LEGACY_LEVEL_LABELS = Object.freeze({ nazionale: 'Carriera nazionale' });
export const careerLevelLabel = level => CAREER_LEVELS[level]?.label ?? LEGACY_LEVEL_LABELS[level] ?? null;

// Deterministic baseline: each higher entry point starts with more experience
// and visibility, while personal standing remains close to neutral.
const LEVEL_BASELINES = Object.freeze({
  comunale: { popularity: 42, reputation: 50, consensus: 4, experience: 18, influence: 14, notoriety: 20 },
  regionale: { popularity: 43, reputation: 52, consensus: 6, experience: 36, influence: 32, notoriety: 38 },
  deputato: { popularity: 45, reputation: 54, consensus: 8, experience: 54, influence: 50, notoriety: 56 },
  senatore: { popularity: 45, reputation: 55, consensus: 7, experience: 58, influence: 52, notoriety: 55 }
});

export function initialCareerStatistics(level) {
  const baseline = LEVEL_BASELINES[level];
  if (!baseline) throw new Error('Livello iniziale non valido.');
  return { ...baseline };
}
