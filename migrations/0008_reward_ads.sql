-- Rewarded videos: the completion id of each video, once for each account (a repeated claim is recognised), and the day for the daily limit (Europe/Rome). Same text as the table list of worker.js.
CREATE TABLE IF NOT EXISTS reward_ads (user_id TEXT NOT NULL, ad_id TEXT NOT NULL, day TEXT NOT NULL, claimed_at TEXT NOT NULL, career_id TEXT, device_id TEXT, PRIMARY KEY (user_id, ad_id));
CREATE INDEX IF NOT EXISTS reward_ads_day ON reward_ads (user_id, day);
