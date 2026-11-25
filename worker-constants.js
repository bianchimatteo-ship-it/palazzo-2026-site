// Constants of worker.js, kept in their own module: the Workers runtime (workerd, `wrangler dev`) refuses a main module that exports anything but handlers, classes and functions ("Incorrect type for map entry"),
// so these values are imported by worker.js and by the checks, never exported from the main module.
export const REWARD_MIGRATION = '0006-rewards';

export const REWARD_COLUMNS = {
  reward_claims: [['device_id', 'TEXT']],
  reward_time: [['base_ms', 'INTEGER NOT NULL DEFAULT 0'], ['folded_ms', 'INTEGER NOT NULL DEFAULT 0'], ['spans', "TEXT NOT NULL DEFAULT '[]'"], ['total_ms', 'INTEGER NOT NULL DEFAULT 0'], ['rev', 'INTEGER NOT NULL DEFAULT 0'], ['updated_at', "TEXT NOT NULL DEFAULT ''"]]
};

export const ACTIVITY_KEEP_DAYS = 400;

export const MAIL_SUBJECTS = Object.freeze({
  verify: 'POLITICANDO 2026 — conferma il tuo indirizzo email',
  reset: 'POLITICANDO 2026 — nuova password',
  retention: 'POLITICANDO 2026: il tuo account sarà eliminato per inattività'
});

export const RETENTION = Object.freeze({ inactivityMonths: 12, noticeDays: 30, batch: 50 });

export const PORTAL_PATHS = /^\/(?:index\.html|portal\.(?:js|css)|privacy(?:-en)?\.html|support(?:-en)?\.html|termini\.html|terms-en\.html|elimina-account\.html|delete-account-en\.html|favicon\.(?:ico|svg)|app-ads\.txt|src\/legal\.css|src\/legal\/delete-account\.js|src\/data\/repositories\/(?:account-sync|career-visibility)\.js)?$/;
