export const ITALIAN_REGIONS = Object.freeze([
  'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia',
  'Lazio', 'Liguria', 'Lombardia', 'Marche', 'Molise', 'Piemonte', 'Puglia',
  'Sardegna', 'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', 'Valle d’Aosta', 'Veneto'
]);

export const CAREER_LEVELS = Object.freeze({
  comunale: { label: 'Politica comunale', shortLabel: 'Comunale', territory: 'comune', office: 'Percorso comunale iniziale' },
  regionale: { label: 'Politica regionale', shortLabel: 'Regionale', territory: 'regione', office: 'Percorso regionale iniziale' },
  nazionale: { label: 'Politica nazionale', shortLabel: 'Nazionale', territory: 'stato', office: 'Percorso nazionale iniziale' }
});

// Deterministic baseline: each higher entry point starts with more experience
// and visibility, while personal standing remains close to neutral.
const LEVEL_BASELINES = Object.freeze({
  comunale: { popularity: 42, reputation: 50, consensus: 4, experience: 18, influence: 14, notoriety: 20 },
  regionale: { popularity: 43, reputation: 52, consensus: 6, experience: 36, influence: 32, notoriety: 38 },
  nazionale: { popularity: 45, reputation: 54, consensus: 8, experience: 54, influence: 50, notoriety: 56 }
});

export function initialCareerStatistics(level) {
  const baseline = LEVEL_BASELINES[level];
  if (!baseline) throw new Error('Livello iniziale non valido.');
  return { ...baseline };
}
