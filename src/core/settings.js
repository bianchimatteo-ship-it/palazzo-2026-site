// Player preferences, kept apart from the career save: they survive new games and loads.
const SETTINGS_KEY = 'politicando.settings.v1';

export const SETTINGS_SCHEMA = Object.freeze({
  // the language of the interface: a preference of the browser, apart from every career (see core/i18n.js)
  language: { label: 'Lingua', options: [['it', 'Italiano'], ['en', 'English']], default: 'it' },
  sound: { label: 'Effetti sonori', options: [['on', 'Attivi'], ['off', 'Disattivati']], default: 'on' },
  volume: { label: 'Volume', options: [['30', 'Basso'], ['60', 'Medio'], ['100', 'Alto']], default: '60' },
  // Two independent preferences (never one for both): the motion of the interface (texts, panels, notices, counters, decorative effects) is OFF by default; the motion of the game scenes (rallies,
  // protests, television, the vote at the polling station, the election night, the Aula and the political scenes) is COMPLETE by default.
  interfaceMotion: { label: 'Animazioni dell’interfaccia', options: [['full', 'Complete'], ['reduced', 'Ridotte'], ['off', 'Disattivate']], default: 'off',
    hint: { full: 'Testi, pannelli, notifiche e contatori si animano.', reduced: 'Movimenti dell’interfaccia più brevi e discreti.', off: 'Testi e pannelli compaiono subito, senza movimenti o effetti decorativi.' } },
  sceneMotion: { label: 'Animazioni delle scene di gioco', options: [['full', 'Complete'], ['reduced', 'Ridotte'], ['off', 'Disattivate']], default: 'full',
    hint: { full: 'Comizi, proteste, studi TV, voto, Notte elettorale e Aula con personaggi in movimento.', reduced: 'Le scene mostrano le pose senza percorsi e movimenti lunghi.', off: 'Le scene mostrano la posizione di ogni momento, senza movimento.' } },
  toasts: { label: 'Messaggi a comparsa', options: [['on', 'Mostra'], ['off', 'Nascondi']], default: 'on' },
  toastLength: { label: 'Durata dei messaggi', options: [['short', 'Breve'], ['normal', 'Normale'], ['long', 'Lunga']], default: 'normal' },
  // `scoped`: the choice belongs to the account that is signed in (or to the browser when nobody is), so that one account never changes another's; see saveSetting.
  newsPopup: { label: 'Popup notizie settimanali', options: [['on', 'Attivo'], ['off', 'Disattivato']], default: 'on', scoped: true,
    hint: { on: 'Ogni settimana compare un riepilogo delle notizie principali.', off: 'Nessun riepilogo automatico: le notizie restano in Informazione e nella Home.' } },
  electionNight: { label: 'Notte Elettorale', options: [['on', 'Da giocare ora per ora'], ['off', 'Salta (risultato subito)']], default: 'on', hint: { on: 'Alla fine di ogni voto vivi le dodici ore dello scrutinio in diretta.', off: 'Il risultato viene registrato subito, senza la giornata elettorale.' } },
  weeklyReport: { label: 'Resoconto a fine settimana', options: [['on', 'Mostra'], ['off', 'Non mostrare']], default: 'on' },
  autosave: { label: 'Salvataggio automatico', options: [['action', 'Dopo ogni azione'], ['week', 'A fine settimana'], ['manual', 'Solo manuale']], default: 'action' },
  weeksPerTurn: { label: 'Velocità della simulazione', options: [['1', '1 settimana per turno'], ['2', '2 settimane per turno'], ['4', '4 settimane per turno']], default: '1' },
  textSize: { label: 'Dimensione del testo', options: [['100', 'Normale'], ['112', 'Grande'], ['125', 'Molto grande']], default: '100' },
  contrast: { label: 'Contrasto', options: [['normal', 'Normale'], ['high', 'Alto']], default: 'normal' },
  density: { label: 'Densità dell’interfaccia', options: [['comfortable', 'Comoda'], ['compact', 'Compatta']], default: 'comfortable' }
});
const defaults = () => Object.fromEntries(Object.entries(SETTINGS_SCHEMA).map(([key, spec]) => [key, spec.default]));

// The preferences are kept in this browser, apart from the career saves. The ones marked `scoped` are kept per account: `scope` is «account:<username>» while an account is signed in, else null
// (the browser's own choice). An account that never chose reads the browser's value (what every existing player already has), and its own choice is written only under its own name: it
// never reaches another account, nor the browser's value, nor a career save.
const SCOPED_KEY = 'politicando.settings.scoped.v1';
const readJson = key => { try { const value = JSON.parse(localStorage.getItem(key) ?? '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; } };
const validFor = (spec, value) => spec.options.some(([option]) => option === value);

export function loadSettings(scope = null) {
  const saved = readJson(SETTINGS_KEY);
  const own = scope ? readJson(SCOPED_KEY)[scope] ?? {} : {};
  const settings = defaults();
  for (const [key, spec] of Object.entries(SETTINGS_SCHEMA)) {
    if (spec.scoped && validFor(spec, own?.[key])) settings[key] = own[key];
    else if (validFor(spec, saved[key])) settings[key] = saved[key];
  }
  // A choice made before the two preferences existed (the single `motion` key, written only when the player chose it) is kept for both, until they are separated; an automatic default is never taken for a choice.
  const old = saved.motion;
  if (['full', 'reduced', 'off'].includes(old)) {
    if (!validFor(SETTINGS_SCHEMA.sceneMotion, saved.sceneMotion)) settings.sceneMotion = old;
    if (!validFor(SETTINGS_SCHEMA.interfaceMotion, saved.interfaceMotion)) settings.interfaceMotion = old;
  }
  return settings;
}
export function saveSetting(key, value, scope = null) {
  const spec = SETTINGS_SCHEMA[key];
  if (!spec || !validFor(spec, value)) throw new Error('Impostazione non valida.');
  try {
    if (spec.scoped && scope) {
      const all = readJson(SCOPED_KEY);
      localStorage.setItem(SCOPED_KEY, JSON.stringify({ ...all, [scope]: { ...(all[scope] ?? {}), [key]: value } }));
    } else localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...readJson(SETTINGS_KEY), [key]: value }));
  } catch { /* preferences stay for this session */ }
  return loadSettings(scope);
}
export function resetSettings(scope = null) {
  try {
    localStorage.removeItem(SETTINGS_KEY);
    // the signed-in account takes back its own choice only; the other accounts keep theirs
    if (scope) { const all = readJson(SCOPED_KEY); delete all[scope]; localStorage.setItem(SCOPED_KEY, JSON.stringify(all)); }
  } catch { /* nothing to remove */ }
  return loadSettings(scope);
}
