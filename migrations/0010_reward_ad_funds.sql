-- Rewarded videos of personal funds (Appodeal placement personal_funds_1000, Android): the completion id of each video, once for each account or guest device, no daily limit. Same text as the table list of worker.js.
CREATE TABLE IF NOT EXISTS reward_ad_funds (user_id TEXT NOT NULL, ad_id TEXT NOT NULL, claimed_at TEXT NOT NULL, career_id TEXT, device_id TEXT, PRIMARY KEY (user_id, ad_id));
