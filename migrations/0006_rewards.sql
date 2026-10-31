-- Rewards of the game (time played, daily reward, blocks of 30/60 minutes, community reward). Additive: worker.js creates the same tables when they are missing and, on a database made by an earlier
-- version of the rewards, adds the columns that are missing (migration 0006-rewards, checked with PRAGMA table_info and recorded in schema_migrations): no existing row is touched.
CREATE TABLE IF NOT EXISTS reward_claims (user_id TEXT NOT NULL, day TEXT NOT NULL, claimed_at TEXT NOT NULL, career_id TEXT, device_id TEXT, PRIMARY KEY (user_id, day));
CREATE TABLE IF NOT EXISTS reward_time (user_id TEXT NOT NULL, scope TEXT NOT NULL, base_ms INTEGER NOT NULL DEFAULT 0, folded_ms INTEGER NOT NULL DEFAULT 0, spans TEXT NOT NULL DEFAULT '[]', total_ms INTEGER NOT NULL DEFAULT 0, rev INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, scope));
CREATE TABLE IF NOT EXISTS reward_devices (user_id TEXT NOT NULL, device_id TEXT NOT NULL, ranges TEXT NOT NULL DEFAULT '[]', rev INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, device_id));
CREATE TABLE IF NOT EXISTS reward_blocks (user_id TEXT NOT NULL, career_id TEXT NOT NULL, kind TEXT NOT NULL, block INTEGER NOT NULL, device_id TEXT, claimed_at TEXT NOT NULL, PRIMARY KEY (user_id, career_id, kind, block));
CREATE TABLE IF NOT EXISTS reward_community (user_id TEXT NOT NULL, reward TEXT NOT NULL, claimed_at TEXT NOT NULL, career_id TEXT, device_id TEXT, PRIMARY KEY (user_id, reward));
CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
