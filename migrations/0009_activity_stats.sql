-- The owner's statistics. Same text as the table list of worker.js.
-- activity_days: one row per account per day of activity (Europe/Rome); no address, no device, no content. Written only while the Worker has ADMIN_STATS=on, kept 400 days, deleted with the account.
-- store_installs: the install figures the owner types in from Google Play Console / App Store Connect, with the source of the figure.
CREATE TABLE IF NOT EXISTS activity_days (user_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (user_id, day));
CREATE INDEX IF NOT EXISTS activity_days_day ON activity_days (day);
CREATE TABLE IF NOT EXISTS store_installs (day TEXT NOT NULL, store TEXT NOT NULL, installs INTEGER NOT NULL, source TEXT NOT NULL, recorded_at TEXT NOT NULL, PRIMARY KEY (day, store));
