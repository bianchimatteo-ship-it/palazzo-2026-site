const STORAGE_KEY = 'palazzo-2026.career.v1';
const BACKUP_KEY = `${STORAGE_KEY}.backup`;
const HISTORY_KEY = `${STORAGE_KEY}.history`;
const HISTORY_LIMIT = 6;
// Manual save slots live beside the running game: an index plus one entry per slot.
const SLOT_INDEX = 'politicando.slots.v1';
const SLOT_PREFIX = 'politicando.slot.';
export const MAX_SLOTS = 5;
// The Hall of Fame (the careers concluded and their legacy) belongs to the player: it is not part of any save and
// outlives every career, every slot and “delete all saves”.
const HALL_KEY = 'politicando.hall.v1';

const readJson = key => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } };
const readRawJson = raw => { try { return raw ? JSON.parse(raw) : null; } catch { return null; } };
const careerIdOf = state => String(state?.career?.id ?? state?.saveMeta?.careerId ?? '');
const revisionOf = state => Number.isSafeInteger(state?.saveMeta?.revision) ? state.saveMeta.revision : 0;
const progressOf = state => [
  String(state?.clock?.currentDate ?? ''), Number(state?.game?.week?.index ?? 0),
  Number(state?.game?.week?.number ?? 0), (state?.career?.electionHistory ?? []).length,
  (state?.game?.timeline ?? []).length, (state?.dataset?.offices ?? []).filter(item => !item.endDate).length
];
export function compareSaveProgress(left, right) {
  const a = progressOf(left), b = progressOf(right);
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  return 0;
}
export function compareSaveVersion(left, right) {
  const progress = compareSaveProgress(left, right);
  return progress || Math.sign(revisionOf(left) - revisionOf(right));
}
const isSave = state => Boolean(state && typeof state === 'object' && state.career && state.clock?.currentDate && Array.isArray(state.dataset?.politicians));
const unwrap = (value, source) => {
  const wrapper = value && typeof value === 'object' && Object.hasOwn(value, 'payload') && value.reason ? value : null;
  const payload = wrapper ? (typeof wrapper.payload === 'string' ? readRawJson(wrapper.payload) : wrapper.payload) : value;
  return isSave(payload) ? { state: payload, source, savedAt: wrapper?.savedAt ?? null } : null;
};
const samePayload = (left, right) => JSON.stringify(left) === JSON.stringify(right);
function allSaveCandidates() {
  const candidates = [];
  const main = unwrap(readJson(STORAGE_KEY), 'main');
  if (main) candidates.push(main);
  const backup = unwrap(readJson(BACKUP_KEY), 'backup');
  if (backup) candidates.push(backup);
  const history = readJson(HISTORY_KEY);
  for (const [index, entry] of (Array.isArray(history) ? history : []).entries()) {
    const candidate = unwrap(entry, `history:${index}`);
    if (candidate) candidates.push(candidate);
  }
  for (const key of slotKeys()) {
    const candidate = unwrap(readJson(key), key);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}
function bestCandidate(candidates) {
  return candidates.reduce((best, item) => !best || compareSaveVersion(item.state, best.state) > 0 ? item : best, null);
}
function appendHistory(entry) {
  const list = readJson(HISTORY_KEY);
  const history = Array.isArray(list) ? list : [];
  const duplicate = history.some(item => item?.reason === entry?.reason && samePayload(item?.payload, entry?.payload));
  if (duplicate) return;
  history.push(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-HISTORY_LIMIT)));
}
function archiveSnapshot(payload, reason, savedAt = new Date().toISOString()) {
  const entry = { reason, savedAt, payload: typeof payload === 'string' ? payload : JSON.stringify(payload) };
  appendHistory(entry);
  return entry;
}
function nextRevision(state) {
  return allSaveCandidates().filter(item => careerIdOf(item.state) === careerIdOf(state)).reduce((max, item) => Math.max(max, revisionOf(item.state)), revisionOf(state)) + 1;
}
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
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && !unwrap(readRawJson(raw), 'main')) storage.backup(raw, 'salvataggio-main-non-recuperabile');
    } catch { /* browser storage may be unavailable; the remaining recovery path is still attempted */ }
    const candidates = allSaveCandidates();
    const main = candidates.find(item => item.source === 'main');
    const best = main ? bestCandidate(candidates.filter(item => careerIdOf(item.state) === careerIdOf(main.state))) : bestCandidate(candidates);
    if (best && best.source !== 'main') {
      try {
        if (main) archiveSnapshot(main.state, 'recovery-main-precedente');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(best.state));
      } catch { /* the recovered copy is still returned in memory; a later save will report storage failure */ }
    }
    return best?.state ?? null;
  },
  bestForCareer(id) {
    return bestCandidate(allSaveCandidates().filter(item => careerIdOf(item.state) === String(id)))?.state ?? null;
  },
  latestRevision(id) {
    return allSaveCandidates().filter(item => careerIdOf(item.state) === String(id)).reduce((max, item) => Math.max(max, revisionOf(item.state)), 0);
  },
  save(state) {
    const persisted = bestCandidate(allSaveCandidates().filter(item => careerIdOf(item.state) === careerIdOf(state)));
    const baseRevision = Number.isSafeInteger(state?.saveMeta?.revision) ? state.saveMeta.revision : 0;
    if (persisted && (compareSaveProgress(persisted.state, state) > 0 || revisionOf(persisted.state) > baseRevision)) {
      storage.backup(state, 'conflitto-versione-obsoleta');
      throw new Error(`Salvataggio obsoleto rifiutato: la carriera ${careerIdOf(state)} ha già una versione più avanzata.`);
    }
    const current = unwrap(readJson(STORAGE_KEY), 'main');
    const switchIntent = state?.saveMeta?.switchFromCareerId === careerIdOf(current?.state) && Boolean(state?.saveMeta?.switchIntent);
    if (current && careerIdOf(current.state) !== careerIdOf(state) && !switchIntent) {
      storage.backup(state, 'conflitto-carriera-diversa');
      throw new Error('La carriera persistita è cambiata in un’altra scheda; ricaricala prima di salvare.');
    }
    const revision = nextRevision(state);
    const savedState = { ...state, saveMeta: { ...(state.saveMeta ?? {}), careerId: careerIdOf(state), revision, switchFromCareerId: null, switchIntent: null } };
    const raw = JSON.stringify(savedState);
    if (current && !samePayload(current.state, savedState)) archiveSnapshot(current.state, 'versione-precedente');
    localStorage.setItem(STORAGE_KEY, raw);
    const written = readJson(STORAGE_KEY);
    if (!written || !samePayload(written, savedState)) {
      storage.backup(savedState, 'conflitto-scrittura-concorrente');
      throw new Error('Scrittura concorrente rilevata: il salvataggio persistito non coincide con questa versione.');
    }
    return { savedAt: new Date().toISOString(), state: savedState, revision };
  },
  // A save that cannot be restored is copied aside so a later autosave never erases it. True only when the copy is really there: whoever
  // is about to replace a save checks it first.
  backup(payload, reason) {
    try {
      const previous = readJson(BACKUP_KEY);
      if (previous?.payload && !samePayload(previous.payload, typeof payload === 'string' ? payload : JSON.stringify(payload))) archiveSnapshot(previous.payload, previous.reason ?? 'backup-precedente', previous.savedAt);
      const entry = archiveSnapshot(payload, reason);
      localStorage.setItem(BACKUP_KEY, JSON.stringify(entry));
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
    const best = storage.bestForCareer(careerIdOf(state));
    const baseRevision = revisionOf(state);
    if (best && (compareSaveProgress(best, state) > 0 || revisionOf(best) > baseRevision)) {
      storage.backup(state, 'conflitto-slot-obsoleto');
      throw new Error('Salvataggio nello slot rifiutato: questa scheda contiene una versione meno recente della carriera.');
    }
    const slots = storage.listSlots();
    const slotId = id ?? `slot-${Date.now().toString(36)}`;
    const known = slots.some(entry => entry.id === slotId);
    if (!known && slots.length >= MAX_SLOTS) throw new Error(`Puoi conservare al massimo ${MAX_SLOTS} salvataggi: eliminane uno.`);
    const savedAt = new Date().toISOString();
    const key = SLOT_PREFIX + slotId;
    let payload;
    const savedState = { ...state, saveMeta: { ...(state.saveMeta ?? {}), careerId: careerIdOf(state), revision: baseRevision } };
    try { payload = JSON.stringify(savedState); } catch { throw new Error('La partita non si può salvare nello slot.'); }
    const before = known ? localStorage.getItem(key) : null;
    if (before) {
      const previous = unwrap(readRawJson(before), `slot:${slotId}`);
      if (previous) archiveSnapshot(previous.state, 'slot-precedente');
    }
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
    for (const key of [SLOT_INDEX, STORAGE_KEY, BACKUP_KEY, HISTORY_KEY]) localStorage.removeItem(key);
  }
};
