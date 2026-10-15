-- Expired sessions are removed by the Worker (on login, registration, deletion and once a day): the index keeps that cheap. worker.js also creates it if missing.
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions (expires_at);
