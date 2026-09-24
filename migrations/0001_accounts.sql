-- Player accounts and online career saves (POLITICANDO 2026). worker.js also creates these tables if missing.
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, hash TEXT NOT NULL, iterations INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS saves (user_id TEXT NOT NULL, slot TEXT NOT NULL, name TEXT, meta TEXT, data TEXT NOT NULL, encoding TEXT NOT NULL, revision INTEGER NOT NULL, size INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, slot));
CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
