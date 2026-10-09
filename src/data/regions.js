export const ITALIAN_REGIONS = Object.freeze([
  'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia',
  'Lazio', 'Liguria', 'Lombardia', 'Marche', 'Molise', 'Piemonte', 'Puglia',
  'Sardegna', 'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', 'Valle d’Aosta', 'Veneto'
]);

// The regions in the order of the ISTAT codes (01 Piemonte … 20 Sardegna): the id of a region in the real data is `it-region-NN`.
export const ISTAT_REGIONS = Object.freeze(['Piemonte', 'Valle d’Aosta', 'Lombardia', 'Trentino-Alto Adige', 'Veneto', 'Friuli-Venezia Giulia', 'Liguria', 'Emilia-Romagna', 'Toscana', 'Umbria', 'Marche', 'Lazio', 'Abruzzo', 'Molise', 'Campania', 'Puglia', 'Basilicata', 'Calabria', 'Sicilia', 'Sardegna']);
export const regionIdOf = name => { const index = ISTAT_REGIONS.indexOf(name); return index < 0 ? null : `it-region-${String(index + 1).padStart(2, '0')}`; };

export const CAREER_LEVELS = Object.freeze({
  comunale: { label: 'Carriera comunale', shortLabel: 'Comunale', territory: 'comune', office: 'Consigliere comunale' },
  // The province (ente di area vasta, law 56/2014): its councillors are the mayors and municipal councillors of the province,
  // so the career starts with a seat in the own comune as well.
  provinciale: { label: 'Carriera provinciale', shortLabel: 'Provinciale', territory: 'provincia', office: 'Consigliere provinciale', institution: 'provincia', requiresComune: true },
  regionale: { label: 'Carriera regionale', shortLabel: 'Regionale', territory: 'regione', office: 'Consigliere regionale' },
  deputato: { label: 'Carriera come Deputato', shortLabel: 'Deputato', territory: 'camera', office: 'Deputato (scenario di simulazione)', chamber: 'camera' },
  senatore: { label: 'Carriera come Senatore', shortLabel: 'Senatore', territory: 'senato', office: 'Senatore (scenario di simulazione)', chamber: 'senato' },
  // A seat at the European Parliament: no Chamber of the Italian Parliament, the institution of the career is the EP.
  europeo: { label: 'Carriera europea', shortLabel: 'Eurodeputato', territory: 'europa', office: 'Deputato al Parlamento europeo (scenario di simulazione)', institution: 'europa' }
});

// Saves created before the Deputato/Senatore split still carry the old national path.
const LEGACY_LEVEL_LABELS = Object.freeze({ nazionale: 'Carriera nazionale' });
// Levels reached only by election (not a starting point of the wizard).
const ELECTED_LEVEL_LABELS = Object.freeze({ europeo: 'Carriera europea', presidente: 'Presidente della Repubblica' });
export const careerLevelLabel = level => CAREER_LEVELS[level]?.label ?? ELECTED_LEVEL_LABELS[level] ?? LEGACY_LEVEL_LABELS[level] ?? null;

// Deterministic baseline: each higher entry point starts with more experience
// and visibility, while personal standing remains close to neutral.
const LEVEL_BASELINES = Object.freeze({
  comunale: { popularity: 42, reputation: 50, consensus: 4, experience: 18, influence: 14, notoriety: 20 },
  provinciale: { popularity: 42, reputation: 52, consensus: 5, experience: 28, influence: 24, notoriety: 28 },
  regionale: { popularity: 43, reputation: 52, consensus: 6, experience: 36, influence: 32, notoriety: 38 },
  deputato: { popularity: 45, reputation: 54, consensus: 8, experience: 54, influence: 50, notoriety: 56 },
  senatore: { popularity: 45, reputation: 55, consensus: 7, experience: 58, influence: 52, notoriety: 55 },
  europeo: { popularity: 44, reputation: 56, consensus: 8, experience: 52, influence: 46, notoriety: 50 }
});

export function initialCareerStatistics(level) {
  const baseline = LEVEL_BASELINES[level];
  if (!baseline) throw new Error('Livello iniziale non valido.');
  return { ...baseline };
}

// The province as a level of the game: a province, a metropolitan city or a free consortium of comuni with organs of its own
// (law 56/2014). Not Valle d'Aosta (the Region does that work), nor the autonomous provinces of Trento and Bolzano (which
// have the powers of a region), nor the former provinces of Friuli-Venezia Giulia (now without organs).
export const PROVINCIAL_UNIT_TYPES = Object.freeze(['Provincia', 'Città metropolitana', 'Libero consorzio di comuni']);
export const hasProvincialLevel = ({ region = null, provinceCode = null, provinceType = null } = {}) => Boolean(provinceCode) && region !== 'Valle d’Aosta' && (provinceType ? PROVINCIAL_UNIT_TYPES.includes(provinceType) : true);
export const PROVINCIAL_LEVEL_PROBLEM = 'Nel comune scelto non c’è una provincia con organi elettivi (non li hanno la Valle d’Aosta, le province autonome di Trento e Bolzano e le ex province del Friuli-Venezia Giulia): scegli un altro percorso o un altro comune.';
