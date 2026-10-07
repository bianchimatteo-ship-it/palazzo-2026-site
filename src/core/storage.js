const STORAGE_KEY = 'palazzo-2026.career.v1';
const BACKUP_KEY = `${STORAGE_KEY}.backup`;
// Manual save slots live beside the running game: an index plus one entry per slot.
const SLOT_INDEX = 'politicando.slots.v1';
const SLOT_PREFIX = 'politicando.slot.';
export const MAX_SLOTS = 5;
// The Hall of Fame (the careers concluded and their legacy) belongs to the player: it is not part of any save and
// outlives every career, every slot and “delete all saves”.
const HALL_KEY = 'politicando.hall.v1';

const readJson = key => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } };
// Every key of the browser's storage that holds a slot, listed or not (a browser without key() only knows the index).
const canScan = () => typeof localStorage.key === 'function' && Number.isFinite(localStorage.length);
const slotKeys = () => { const keys = []; try { if (canScan()) for (let index = 0; index < localStorage.length; index++) { const key = localStorage.key(index); if (key?.startsWith(SLOT_PREFIX)) keys.push(key); } } catch { /* the index is all that is known */ } return keys; };
// Does the slot of an entry exist? (a scan of the keys: the slots themselves are not read)
const slotsPresent = () => { const keys = canScan() ? new Set(slotKeys()) : null; return id => keys ? keys.has(SLOT_PREFIX + id) : localStorage.getItem(SLOT_PREFIX + id) !== null; };
// What a slot shows before it is opened, for a slot the index lost (its game says it all).
function metaOf(payload) {
  const player = payload?.dataset?.politicians?.find?.(item => item.id === payload?.career?.playerId);
  return { player: player?.displayName ?? 'Carriera', role: null, party: payload?.game?.party?.label ?? 'Indipendente', week: payload?.game?.week?.index ?? 1, gameDate: payload?.clock?.currentDate ?? null, status: payload?.game?.status ?? 'active', name: `${player?.displayName ?? 'Carriera'} · salvataggio ritrovato` };
}

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
  // A save that cannot be restored is copied aside so a later autosave never erases it. True only when the copy is really there: whoever
  // is about to replace a save checks it first.
  backup(payload, reason) {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify({ reason, savedAt: new Date().toISOString(), payload: typeof payload === 'string' ? payload : JSON.stringify(payload) }));
      return true;
    } catch { return false; }
  },
  clear() { localStorage.removeItem(STORAGE_KEY); },

  // ---------- manual slots ----------
  // The index and the slots say the same thing: an entry whose slot is gone leaves the list, a slot the index lost (a write that stopped half way) comes back into it.
  repairSlots() {
    const index = readJson(SLOT_INDEX);
    const listed = Array.isArray(index) ? index.filter(entry => entry?.id) : [];
    const exists = slotsPresent();
    const kept = listed.filter(entry => exists(entry.id));
    const lost = slotKeys().map(key => key.slice(SLOT_PREFIX.length)).filter(id => !kept.some(entry => entry.id === id));
    const found = lost.map(id => ({ id, savedAt: new Date().toISOString(), ...metaOf(readJson(SLOT_PREFIX + id)) })).slice(0, Math.max(0, MAX_SLOTS - kept.length));
    if (kept.length === listed.length && !found.length) return false;
    try { localStorage.setItem(SLOT_INDEX, JSON.stringify([...kept, ...found])); return true; } catch { return false; }
  },
  listSlots() {
    const index = readJson(SLOT_INDEX);
    const exists = slotsPresent();
    return Array.isArray(index) ? index.filter(entry => entry?.id && exists(entry.id)).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))) : [];
  },
  // The slot and its place in the index are written together: if the index cannot say it, the slot goes back to what it was (nothing is left half done).
  saveSlot(state, meta, id = null) {
    storage.repairSlots();
    const slots = storage.listSlots();
    const slotId = id ?? `slot-${Date.now().toString(36)}`;
    const known = slots.some(entry => entry.id === slotId);
    if (!known && slots.length >= MAX_SLOTS) throw new Error(`Puoi conservare al massimo ${MAX_SLOTS} salvataggi: eliminane uno.`);
    const savedAt = new Date().toISOString();
    const key = SLOT_PREFIX + slotId;
    let payload;
    try { payload = JSON.stringify(state); } catch { throw new Error('La partita non si può salvare nello slot.'); }
    const before = known ? localStorage.getItem(key) : null;
    try { localStorage.setItem(key, payload); }
    catch { throw new Error('Spazio del browser esaurito: elimina un salvataggio o esportalo su file.'); }
    try { localStorage.setItem(SLOT_INDEX, JSON.stringify([{ id: slotId, savedAt, ...meta }, ...slots.filter(entry => entry.id !== slotId)])); }
    catch {
      try { if (before !== null) localStorage.setItem(key, before); else localStorage.removeItem(key); } catch { /* the next opening finds the slot and lists it */ }
      throw new Error('Spazio del browser esaurito: il salvataggio nello slot non è stato registrato.');
    }
    return slotId;
  },
  loadSlot(id) {
    const payload = readJson(SLOT_PREFIX + id);
    if (!payload) throw new Error('Salvataggio non trovato o non leggibile.');
    return payload;
  },
  // The index first (a failure there changes nothing), then the slot.
  deleteSlot(id) {
    localStorage.setItem(SLOT_INDEX, JSON.stringify(storage.listSlots().filter(entry => entry.id !== id)));
    localStorage.removeItem(SLOT_PREFIX + id);
  },
  // ---------- the Hall of Fame ----------
  hall() { const list = readJson(HALL_KEY); return Array.isArray(list) ? list.filter(entry => entry?.id) : []; },
  saveHall(entries) {
    try { localStorage.setItem(HALL_KEY, JSON.stringify(entries)); }
    catch { throw new Error('Spazio del browser esaurito: la Hall of Fame non è stata aggiornata.'); }
  },
  // Every save of this browser goes: the running game, the slots (also the ones the index no longer lists) and the copy kept aside. The Hall of Fame stays.
  clearAll() {
    for (const key of new Set([...slotKeys(), ...storage.listSlots().map(entry => SLOT_PREFIX + entry.id)])) localStorage.removeItem(key);
    for (const key of [SLOT_INDEX, STORAGE_KEY, BACKUP_KEY]) localStorage.removeItem(key);
  }
};
