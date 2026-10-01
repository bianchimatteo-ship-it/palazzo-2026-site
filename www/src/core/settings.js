// Player preferences, kept apart from the career save: they survive new games and loads.
const SETTINGS_KEY = 'politicando.settings.v1';

export const SETTINGS_SCHEMA = Object.freeze({
  sound: { label: 'Effetti sonori', options: [['on', 'Attivi'], ['off', 'Disattivati']], default: 'on' },
  volume: { label: 'Volume', options: [['30', 'Basso'], ['60', 'Medio'], ['100', 'Alto']], default: '60' },
  motion: { label: 'Animazioni', options: [['full', 'Complete'], ['reduced', 'Ridotte'], ['off', 'Disattivate']], default: 'full' },
  toasts: { label: 'Messaggi a comparsa', options: [['on', 'Mostra'], ['off', 'Nascondi']], default: 'on' },
  toastLength: { label: 'Durata dei messaggi', options: [['short', 'Breve'], ['normal', 'Normale'], ['long', 'Lunga']], default: 'normal' },
  weeklyReport: { label: 'Resoconto a fine settimana', options: [['on', 'Mostra'], ['off', 'Non mostrare']], default: 'on' },
  autosave: { label: 'Salvataggio automatico', options: [['action', 'Dopo ogni azione'], ['week', 'A fine settimana'], ['manual', 'Solo manuale']], default: 'action' },
  weeksPerTurn: { label: 'Velocità della simulazione', options: [['1', '1 settimana per turno'], ['2', '2 settimane per turno'], ['4', '4 settimane per turno']], default: '1' },
  textSize: { label: 'Dimensione del testo', options: [['100', 'Normale'], ['112', 'Grande'], ['125', 'Molto grande']], default: '100' },
  contrast: { label: 'Contrasto', options: [['normal', 'Normale'], ['high', 'Alto']], default: 'normal' },
  density: { label: 'Densità dell’interfaccia', options: [['comfortable', 'Comoda'], ['compact', 'Compatta']], default: 'comfortable' }
});
const defaults = () => Object.fromEntries(Object.entries(SETTINGS_SCHEMA).map(([key, spec]) => [key, spec.default]));

export function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') ?? {}; } catch { saved = {}; }
  const settings = defaults();
  for (const [key, spec] of Object.entries(SETTINGS_SCHEMA)) if (spec.options.some(([value]) => value === saved[key])) settings[key] = saved[key];
  return settings;
}
export function saveSetting(key, value) {
  const spec = SETTINGS_SCHEMA[key];
  if (!spec || !spec.options.some(([option]) => option === value)) throw new Error('Impostazione non valida.');
  const settings = { ...loadSettings(), [key]: value };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* preferences stay for this session */ }
  return settings;
}
export function resetSettings() {
  try { localStorage.removeItem(SETTINGS_KEY); } catch { /* nothing to remove */ }
  return defaults();
}
