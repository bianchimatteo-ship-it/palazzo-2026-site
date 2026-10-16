-- Online saves, protocol 2 (additive: nothing existing is altered or deleted; worker.js also creates these tables if missing).
-- save_state: what the server read from the content of each slot (career, progress) and the monotone revision counter (it survives a delete).
-- save_history: the versions replaced, kept so that a replaced or deleted career can be recovered.
CREATE TABLE IF NOT EXISTS save_state (user_id TEXT NOT NULL, slot TEXT NOT NULL, career_id TEXT, progress TEXT, last_revision INTEGER NOT NULL, origin TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, slot));
CREATE TABLE IF NOT EXISTS save_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, slot TEXT NOT NULL, revision INTEGER NOT NULL, name TEXT, meta TEXT, data TEXT NOT NULL, encoding TEXT NOT NULL, size INTEGER NOT NULL, progress TEXT, saved_at TEXT NOT NULL, archived_at TEXT NOT NULL, reason TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS save_history_slot ON save_history (user_id, slot, id);
