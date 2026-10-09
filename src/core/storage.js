const STORAGE_KEY = 'palazzo-2026.career.v1';
const BACKUP_KEY = `${STORAGE_KEY}.backup`;
const HISTORY_KEY = `${STORAGE_KEY}.history`;
const LOCK_KEY = `${STORAGE_KEY}.lock`;
const HISTORY_LIMIT = 4;
const LOCK_TTL = 5000;
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
const payloadText = value => typeof value === 'string' ? value : JSON.stringify(value);
const samePayload = (left, right) => payloadText(left) === payloadText(right);
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
function coveredByAnotherSave(state, excludedSource = null) {
  return allSaveCandidates().some(item => item.source !== excludedSource && !item.source.startsWith('history:')
    && careerIdOf(item.state) === careerIdOf(state) && compareSaveVersion(item.state, state) >= 0);
}
function pruneRedundantHistoryOne() {
  const history = readJson(HISTORY_KEY);
  if (!Array.isArray(history) || !history.length) return false;
  const durable = allSaveCandidates().filter(item => !item.source.startsWith('history:'));
  const index = history.findIndex((entry, offset) => {
    const candidate = unwrap(entry, `history:${offset}`);
    return candidate && durable.some(item => careerIdOf(item.state) === careerIdOf(candidate.state) && compareSaveVersion(item.state, candidate.state) >= 0);
  });
  if (index < 0) return false;
  const next = history.filter((_, offset) => offset !== index);
  try {
    if (next.length) localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    else localStorage.removeItem(HISTORY_KEY);
    return true;
  } catch { return false; }
}
function pruneRedundantBackup() {
  const raw = readJson(BACKUP_KEY);
  if (raw === null) return false;
  const backup = unwrap(raw, 'backup');
  if (backup ? !coveredByAnotherSave(backup.state, 'backup') : !allSaveCandidates().some(item => item.source === 'main' || item.source.startsWith(SLOT_PREFIX))) return false;
  try { localStorage.removeItem(BACKUP_KEY); return true; } catch { return false; }
}
function appendHistory(entry) {
  let history = readJson(HISTORY_KEY);
  history = Array.isArray(history) ? history : [];
  if (history.some(item => samePayload(item?.payload, entry?.payload))) return true;
  while (history.length >= HISTORY_LIMIT) {
    if (!pruneRedundantHistoryOne()) {
      // Keep one best-effort copy of a corrupt main being replaced: unlike a
      // normal rotation it is the only trace of that payload, but never let
      // repeated corrupt mains grow history without bound.
      if (entry?.reason !== 'salvataggio-main-non-recuperabile' || history.length > HISTORY_LIMIT) return false;
      break;
    }
    history = readJson(HISTORY_KEY) ?? [];
  }
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify([...history, entry])); return true; }
  catch { return false; }
}
function archiveSnapshot(payload, reason, savedAt = new Date().toISOString()) {
  const entry = { reason, savedAt, payload: typeof payload === 'string' ? payload : JSON.stringify(payload) };
  try { appendHistory(entry); } catch { /* history must never block a main or backup save */ }
  return entry;
}
const isQuotaError = error => error?.name === 'QuotaExceededError' || /quota|storage full/i.test(String(error?.message ?? ''));
function writeWithHistoryPrune(key, value) {
  try { localStorage.setItem(key, value); return; }
  catch (initialError) {
    if (key === HISTORY_KEY || !isQuotaError(initialError)) throw initialError;
    let error = initialError;
    while (pruneRedundantHistoryOne()) {
      try { localStorage.setItem(key, value); return; }
      catch (retryError) { if (!isQuotaError(retryError)) throw retryError; error = retryError; }
    }
    if (key !== BACKUP_KEY && pruneRedundantBackup()) {
      try { localStorage.setItem(key, value); return; }
      catch (retryError) { if (!isQuotaError(retryError)) throw retryError; error = retryError; }
    }
    throw error;
  }
}
function writeMainSnapshot(value) {
  try { writeWithHistoryPrune(STORAGE_KEY, value); return; }
  catch (error) {
    if (!isQuotaError(error)) throw error;
    const backup = readJson(BACKUP_KEY);
    if (backup === null || !pruneRedundantBackup()) throw error;
    try { localStorage.setItem(STORAGE_KEY, value); }
    catch (retryError) {
      try { localStorage.setItem(BACKUP_KEY, JSON.stringify(backup)); } catch { /* main remains untouched; restore backup if space permits */ }
      throw retryError;
    }
  }
}
function withWriteLock(action) {
  const now = Date.now();
  const occupied = readJson(LOCK_KEY);
  if (occupied?.expiresAt > now) throw new Error('Salvataggio in corso in un’altra scheda: riprova tra qualche istante.');
  const token = `${now}-${Math.random().toString(36).slice(2)}`;
  writeWithHistoryPrune(LOCK_KEY, JSON.stringify({ token, expiresAt: now + LOCK_TTL }));
  if (readJson(LOCK_KEY)?.token !== token) throw new Error('Salvataggio in corso in un’altra scheda: riprova tra qualche istante.');
  const assertOwner = () => {
    if (readJson(LOCK_KEY)?.token !== token) throw new Error('Salvataggio interrotto da un’altra scheda; ricarica prima di riprovare.');
  };
  try { return action(assertOwner); }
  finally { try { if (readJson(LOCK_KEY)?.token === token) localStorage.removeItem(LOCK_KEY); } catch { /* the lease expires if cleanup is unavailable */ } }
}
function backupLocked(payload, reason) {
  const rawPayload = payloadText(payload);
  const incoming = typeof payload === 'string' ? readRawJson(payload) : payload;
  const previous = unwrap(readJson(BACKUP_KEY), 'backup');
  if (previous && isSave(previous.state) && !isSave(incoming)) {
    archiveSnapshot(rawPayload, reason);
    return true;
  }
  if (previous && isSave(incoming) && careerIdOf(previous.state) === careerIdOf(incoming)) {
    const comparison = compareSaveVersion(previous.state, incoming);
    if (comparison > 0) {
      archiveSnapshot(rawPayload, reason);
      return true;
    }
    if (comparison === 0 && samePayload(previous.state, incoming)) return true;
  }
  const entry = { reason, savedAt: new Date().toISOString(), payload: rawPayload };
  try { writeWithHistoryPrune(BACKUP_KEY, JSON.stringify(entry)); }
  catch { archiveSnapshot(rawPayload, reason, entry.savedAt); return false; }
  if (previous && !samePayload(previous.state, incoming)) archiveSnapshot(previous.state, 'backup-precedente', previous.savedAt ?? undefined);
  return true;
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
function repairSlotsUnlocked() {
  const index = readJson(SLOT_INDEX);
  const listed = Array.isArray(index) ? index.filter(entry => entry?.id) : [];
  const exists = slotsPresent();
  const kept = listed.filter(entry => exists(entry.id));
  const lost = slotKeys().map(key => key.slice(SLOT_PREFIX.length)).filter(id => !kept.some(entry => entry.id === id));
  const found = lost.map(id => ({ id, savedAt: new Date().toISOString(), ...metaOf(readJson(SLOT_PREFIX + id)) })).slice(0, Math.max(0, MAX_SLOTS - kept.length));
  if (kept.length === listed.length && !found.length) return false;
  writeWithHistoryPrune(SLOT_INDEX, JSON.stringify([...kept, ...found]));
  return true;
}

export const storage = {
  load() {
    const choose = () => {
      const candidates = allSaveCandidates();
      const main = candidates.find(item => item.source === 'main');
      const best = main ? bestCandidate(candidates.filter(item => careerIdOf(item.state) === careerIdOf(main.state))) : bestCandidate(candidates);
      return { candidates, main, best };
    };
    let selected = choose();
    if (!selected.best || selected.best.source === 'main') return selected.best?.state ?? null;
    try {
      withWriteLock(assertOwner => {
        selected = choose();
        if (!selected.best || selected.best.source === 'main') return;
        assertOwner();
        const rawMain = localStorage.getItem(STORAGE_KEY);
        if (selected.best.source !== 'backup') backupLocked(selected.best.state, 'recovery-copia-avanzata');
        if (selected.main) {
          archiveSnapshot(selected.main.state, 'recovery-main-precedente');
        } else if (rawMain) archiveSnapshot(rawMain, 'salvataggio-main-non-recuperabile');
        assertOwner();
        writeWithHistoryPrune(STORAGE_KEY, JSON.stringify(selected.best.state));
      });
    } catch { /* return the best valid copy in memory; never replace a good backup with corrupt main */ }
    return selected.best?.state ?? null;
  },
  bestForCareer(id, fallback = null, { preferFallbackOnProgressTie = false } = {}) {
    const candidates = allSaveCandidates().filter(item => careerIdOf(item.state) === String(id));
    const best = bestCandidate(candidates);
    if (isSave(fallback) && careerIdOf(fallback) === String(id)) {
      if (preferFallbackOnProgressTie && (!best || compareSaveProgress(fallback, best.state) >= 0)) return fallback;
      if (!best || compareSaveVersion(fallback, best.state) > 0) return fallback;
    }
    return best?.state ?? null;
  },
  latestRevision(id) {
    return allSaveCandidates().filter(item => careerIdOf(item.state) === String(id)).reduce((max, item) => Math.max(max, revisionOf(item.state)), 0);
  },
  save(state) {
    if (!isSave(state)) throw new Error('La carriera non è valida e non può essere salvata.');
    return withWriteLock(assertOwner => {
      const careerId = careerIdOf(state);
      const candidates = allSaveCandidates();
      const persisted = bestCandidate(candidates.filter(item => careerIdOf(item.state) === careerId));
      const baseRevision = revisionOf(state);
      const progress = persisted ? compareSaveProgress(persisted.state, state) : 0;
      if (persisted && (progress > 0 || (progress === 0 && revisionOf(persisted.state) > baseRevision))) {
        archiveSnapshot(state, 'conflitto-versione-obsoleta');
        throw new Error(`Salvataggio obsoleto rifiutato: la carriera ${careerId} ha già una versione più avanzata.`);
      }
      const current = unwrap(readJson(STORAGE_KEY), 'main');
      const switchIntent = state?.saveMeta?.switchFromCareerId === careerIdOf(current?.state) && Boolean(state?.saveMeta?.switchIntent);
      if (current && careerIdOf(current.state) !== careerId && !switchIntent) {
        archiveSnapshot(state, 'conflitto-carriera-diversa');
        throw new Error('La carriera persistita è cambiata in un’altra scheda; ricaricala prima di salvare.');
      }
      const revision = Math.max(nextRevision(state), baseRevision + 1);
      const savedState = { ...state, saveMeta: { ...(state.saveMeta ?? {}), careerId, revision, switchFromCareerId: null, switchIntent: null } };
      const raw = JSON.stringify(savedState);
      if (current && !samePayload(current.state, savedState) && !coveredByAnotherSave(current.state, 'main')) {
        // Backup/history are recovery aids, never a prerequisite for the main save.
        backupLocked(current.state, current.state.version < (savedState.version ?? 0) ? `aggiornamento-v${current.state.version ?? 0}-v${savedState.version ?? 0}` : 'versione-precedente');
      }
      assertOwner();
      writeMainSnapshot(raw);
      const written = readJson(STORAGE_KEY);
      if (!written || !samePayload(written, savedState)) {
        archiveSnapshot(savedState, 'conflitto-scrittura-concorrente');
        throw new Error('Scrittura concorrente rilevata: il salvataggio persistito non coincide con questa versione.');
      }
      return { savedAt: new Date().toISOString(), state: savedState, revision };
    });
  },
  // A save that cannot be restored is copied aside so a later autosave never erases it. True only when the copy is really there: whoever
  // is about to replace a save checks it first.
  backup(payload, reason) {
    try { return withWriteLock(() => backupLocked(payload, reason)); }
    catch { return false; }
  },
  clear(expected = null) {
    return withWriteLock(assertOwner => {
      const current = unwrap(readJson(STORAGE_KEY), 'main');
      if (current && expected && careerIdOf(current.state) !== careerIdOf(expected)) {
        throw new Error('La carriera persistita è cambiata in un’altra scheda: ricaricala prima di azzerare il salvataggio.');
      }
      if (current && expected && compareSaveVersion(current.state, expected) > 0) {
        throw new Error('La partita è più recente di questa scheda: ricaricala prima di azzerare il salvataggio.');
      }
      assertOwner();
      localStorage.removeItem(STORAGE_KEY);
      return true;
    });
  },

  // ---------- manual slots ----------
  // The index and the slots say the same thing: an entry whose slot is gone leaves the list, a slot the index lost (a write that stopped half way) comes back into it.
  repairSlots() {
    try { return withWriteLock(() => repairSlotsUnlocked()); } catch { return false; }
  },
  listSlots() {
    const index = readJson(SLOT_INDEX);
    const exists = slotsPresent();
    return Array.isArray(index) ? index.filter(entry => entry?.id && exists(entry.id)).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))) : [];
  },
  // The slot and its place in the index are written together: if the index cannot say it, the slot goes back to what it was (nothing is left half done).
  saveSlot(state, meta, id = null) {
    if (!isSave(state)) throw new Error('La carriera non è valida e non può essere salvata nello slot.');
    return withWriteLock(assertOwner => {
      repairSlotsUnlocked();
      const baseRevision = revisionOf(state);
      const slots = storage.listSlots();
      const savedState = { ...state, saveMeta: { ...(state.saveMeta ?? {}), careerId: careerIdOf(state), revision: baseRevision } };
      const automatic = meta?.autoPreserve ? slots.map(entry => {
        if (!entry.autoPreserve) return null;
        const snapshot = unwrap(readJson(SLOT_PREFIX + entry.id), `slot:${entry.id}`);
        return snapshot && careerIdOf(snapshot.state) === careerIdOf(savedState) ? { entry, state: snapshot.state } : null;
      }).filter(Boolean) : [];
      const bestAutomatic = automatic.reduce((best, item) => !best || compareSaveVersion(item.state, best.state) > 0 ? item : best, null);
      if (bestAutomatic && compareSaveVersion(bestAutomatic.state, savedState) > 0) return bestAutomatic.entry.id;
      const slotId = id ?? bestAutomatic?.entry.id ?? `slot-${Date.now().toString(36)}`;
      const known = slots.some(entry => entry.id === slotId);
      if (!known && slots.length >= MAX_SLOTS) throw new Error(`Puoi conservare al massimo ${MAX_SLOTS} salvataggi: eliminane uno.`);
      const savedAt = new Date().toISOString();
      const key = SLOT_PREFIX + slotId;
      let payload;
      try { payload = JSON.stringify(savedState); } catch { throw new Error('La partita non si può salvare nello slot.'); }
      const before = known ? localStorage.getItem(key) : null;
      if (before) {
        const previous = unwrap(readRawJson(before), `slot:${slotId}`);
        if (previous && !(meta?.autoPreserve && careerIdOf(previous.state) === careerIdOf(savedState))) archiveSnapshot(previous.state, 'slot-precedente');
      }
      try { assertOwner(); writeWithHistoryPrune(key, payload); }
      catch { throw new Error(`Spazio del browser esaurito: ${meta?.autoPreserve ? 'la carriera corrente resta intatta' : 'lo slot non è stato salvato'}.`); }
      try { assertOwner(); writeWithHistoryPrune(SLOT_INDEX, JSON.stringify([{ id: slotId, savedAt, ...meta }, ...slots.filter(entry => entry.id !== slotId)])); }
      catch {
        try { if (before !== null) localStorage.setItem(key, before); else localStorage.removeItem(key); } catch { /* the next opening finds the slot and lists it */ }
        throw new Error('Spazio del browser esaurito: il salvataggio nello slot non è stato registrato.');
      }
      return slotId;
    });
  },
  loadSlot(id) {
    const payload = readJson(SLOT_PREFIX + id);
    if (!payload) throw new Error('Salvataggio non trovato o non leggibile.');
    return payload;
  },
  // The index first (a failure there changes nothing), then the slot.
  deleteSlot(id) {
    return withWriteLock(assertOwner => {
      assertOwner();
      writeWithHistoryPrune(SLOT_INDEX, JSON.stringify(storage.listSlots().filter(entry => entry.id !== id)));
      localStorage.removeItem(SLOT_PREFIX + id);
    });
  },
  // ---------- the Hall of Fame ----------
  hall() { const list = readJson(HALL_KEY); return Array.isArray(list) ? list.filter(entry => entry?.id) : []; },
  saveHall(entries) {
    try { localStorage.setItem(HALL_KEY, JSON.stringify(entries)); }
    catch { throw new Error('Spazio del browser esaurito: la Hall of Fame non è stata aggiornata.'); }
  },
  // Every save of this browser goes: the running game, the slots (also the ones the index no longer lists) and the copy kept aside. The Hall of Fame stays.
  clearAll() {
    return withWriteLock(assertOwner => {
      assertOwner();
      for (const key of new Set([...slotKeys(), ...storage.listSlots().map(entry => SLOT_PREFIX + entry.id)])) localStorage.removeItem(key);
      for (const key of [SLOT_INDEX, STORAGE_KEY, BACKUP_KEY, HISTORY_KEY]) localStorage.removeItem(key);
    });
  }
};
