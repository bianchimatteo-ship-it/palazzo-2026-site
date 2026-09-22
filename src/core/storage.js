const STORAGE_KEY = 'palazzo-2026.career.v1';

export const storage = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn('Salvataggio non leggibile:', error);
      return null;
    }
  },
  save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return new Date().toISOString();
  },
  clear() { localStorage.removeItem(STORAGE_KEY); }
};
