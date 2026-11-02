-- Automatic translation (worker-translate.js): global consumption of the translation provider, shared by every user and updated atomically (one conditional upsert), a rate window per address and a short claim per
-- text so that two simultaneous requests never send the same text twice. Additive: worker.js creates the same tables when they are missing.
CREATE TABLE IF NOT EXISTS translate_budget (id TEXT PRIMARY KEY, day TEXT NOT NULL, day_used INTEGER NOT NULL DEFAULT 0, month TEXT NOT NULL, month_used INTEGER NOT NULL DEFAULT 0, blocked_until INTEGER NOT NULL DEFAULT 0, blocked_reason TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS translate_rate (key TEXT PRIMARY KEY, n INTEGER NOT NULL, window INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS translate_claims (hash TEXT PRIMARY KEY, at INTEGER NOT NULL);
