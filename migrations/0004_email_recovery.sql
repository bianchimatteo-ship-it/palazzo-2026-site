-- Optional verified e-mail address (only to recover the password) and single-use tokens, stored as hashes (additive; worker.js also creates these tables if missing).
-- Existing accounts keep logging in with their current credentials: they simply have no row in user_emails until they add and verify an address.
CREATE TABLE IF NOT EXISTS user_emails (user_id TEXT PRIMARY KEY, email TEXT NOT NULL, email_norm TEXT NOT NULL, verified_at TEXT, created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS user_emails_verified ON user_emails (email_norm) WHERE verified_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_emails_norm ON user_emails (email_norm);
CREATE TABLE IF NOT EXISTS email_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, purpose TEXT NOT NULL, email_norm TEXT, created_at TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at TEXT);
CREATE INDEX IF NOT EXISTS email_tokens_user ON email_tokens (user_id);
CREATE INDEX IF NOT EXISTS email_tokens_expiry ON email_tokens (expires_at);
