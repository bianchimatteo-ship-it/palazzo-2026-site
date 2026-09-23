const STORAGE_KEY = 'palazzo-2026.career.v1';
const BACKUP_KEY = `${STORAGE_KEY}.backup`;

export const storage = {
  load() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn('Salvataggio non leggibile:', error);
      if (raw) storage.backup(raw, 'json-non-leggibile');
      return null;
    }
  },
  save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return new Date().toISOString();
  },
  // A save that cannot be restored is copied aside so a later autosave never erases it.
  backup(payload, reason) {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify({ reason, savedAt: new Date().toISOString(), payload: typeof payload === 'string' ? payload : JSON.stringify(payload) }));
    } catch { /* storage may be unavailable */ }
  },
  clear() { localStorage.removeItem(STORAGE_KEY); }
};
