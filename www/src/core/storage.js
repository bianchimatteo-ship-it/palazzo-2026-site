const STORAGE_KEY = 'palazzo-2026.career.v1';
const BACKUP_KEY = `${STORAGE_KEY}.backup`;
// Manual save slots live beside the running game: an index plus one entry per slot.
const SLOT_INDEX = 'politicando.slots.v1';
const SLOT_PREFIX = 'politicando.slot.';
export const MAX_SLOTS = 5;

const readJson = key => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } };

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
  clear() { localStorage.removeItem(STORAGE_KEY); },

  // ---------- manual slots ----------
  listSlots() {
    const index = readJson(SLOT_INDEX);
    return Array.isArray(index) ? index.filter(entry => entry?.id).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))) : [];
  },
  saveSlot(state, meta, id = null) {
    const slots = storage.listSlots();
    const slotId = id ?? `slot-${Date.now().toString(36)}`;
    if (!slots.some(entry => entry.id === slotId) && slots.length >= MAX_SLOTS) throw new Error(`Puoi conservare al massimo ${MAX_SLOTS} salvataggi: eliminane uno.`);
    const savedAt = new Date().toISOString();
    try { localStorage.setItem(SLOT_PREFIX + slotId, JSON.stringify(state)); }
    catch { throw new Error('Spazio del browser esaurito: elimina un salvataggio o esportalo su file.'); }
    localStorage.setItem(SLOT_INDEX, JSON.stringify([{ id: slotId, savedAt, ...meta }, ...slots.filter(entry => entry.id !== slotId)]));
    return slotId;
  },
  loadSlot(id) {
    const payload = readJson(SLOT_PREFIX + id);
    if (!payload) throw new Error('Salvataggio non trovato o non leggibile.');
    return payload;
  },
  deleteSlot(id) {
    localStorage.removeItem(SLOT_PREFIX + id);
    localStorage.setItem(SLOT_INDEX, JSON.stringify(storage.listSlots().filter(entry => entry.id !== id)));
  },
  clearAll() {
    for (const entry of storage.listSlots()) localStorage.removeItem(SLOT_PREFIX + entry.id);
    localStorage.removeItem(SLOT_INDEX);
    localStorage.removeItem(STORAGE_KEY);
  }
};
