// Checks the schema of the rewards in a D1 database against what worker.js expects (the tables and columns of migration 0006-rewards) and says whether the migration is recorded.
//   node scripts/verify-d1-rewards.mjs --local    the local stand-in of D1 (what the tests use): fresh and from the earlier schema
//   node scripts/verify-d1-rewards.mjs --remote   the PRODUCTION database «politicando-accounts» through wrangler (needs `wrangler` and CLOUDFLARE_API_TOKEN / a login): read-only, it only runs PRAGMA and SELECT
// Without credentials the remote check says so and exits with 2: nothing is reported as verified that was not.
import { spawnSync } from 'node:child_process';
import { REWARD_COLUMNS, REWARD_MIGRATION } from '../worker.js';

const TABLES = { ...REWARD_COLUMNS, reward_devices: [['ranges']], reward_blocks: [['block']], reward_community: [['reward']], schema_migrations: [['name']] };
const mode = process.argv.includes('--remote') ? 'remote' : 'local';

if (mode === 'local') {
  const { startLocalWorker } = await import('./lib/local-worker.mjs');
  const local = await startLocalWorker({ port: 8798 });
  await local.worker.fetch(new Request(`${local.origin}/api/account/status`), local.env);
  const problems = [];
  for (const [table, columns] of Object.entries(TABLES)) {
    const have = local.sqlite.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
    for (const [name] of columns) if (!have.includes(name)) problems.push(`${table}.${name} manca`);
  }
  const migrated = local.sqlite.prepare('SELECT COUNT(*) AS n FROM schema_migrations WHERE name = ?').get(REWARD_MIGRATION).n;
  await local.close();
  if (problems.length || !migrated) { console.error(`Schema locale non conforme: ${problems.join('; ') || 'migrazione non registrata'}`); process.exit(1); }
  console.log(`Schema locale (stand-in di D1): conforme, migrazione ${REWARD_MIGRATION} registrata. Questo NON è il database di produzione.`);
  process.exit(0);
}

const run = sql => spawnSync('npx', ['--yes', 'wrangler@4', 'd1', 'execute', 'politicando-accounts', '--remote', '--json', '--command', sql], { encoding: 'utf8', timeout: 120000 });
const probe = run('SELECT 1 AS ok');
if (probe.status !== 0) {
  console.error('Database remoto NON verificato: wrangler non è disponibile o non ha le credenziali (CLOUDFLARE_API_TOKEN / wrangler login).');
  console.error((probe.stderr || probe.stdout || '').split('\n').slice(0, 3).join('\n'));
  process.exit(2);
}
const problems = [];
for (const [table, columns] of Object.entries(TABLES)) {
  const out = run(`PRAGMA table_info(${table})`);
  const rows = (() => { try { return JSON.parse(out.stdout)?.[0]?.results ?? []; } catch { return []; } })();
  if (!rows.length) { problems.push(`${table}: tabella assente (si crea alla prima richiesta del Worker aggiornato)`); continue; }
  for (const [name] of columns) if (!rows.some(row => row.name === name)) problems.push(`${table}.${name} manca (lo aggiunge la migrazione ${REWARD_MIGRATION} alla prima richiesta)`);
}
const recorded = (() => { try { return JSON.parse(run(`SELECT name FROM schema_migrations WHERE name = '${REWARD_MIGRATION}'`).stdout)?.[0]?.results?.length > 0; } catch { return false; } })();
console.log(problems.length ? `Produzione: ${problems.join('; ')}` : 'Produzione: tabelle e colonne conformi.', recorded ? `Migrazione ${REWARD_MIGRATION} registrata.` : `Migrazione ${REWARD_MIGRATION} non ancora registrata.`);
process.exit(problems.length ? 1 : 0);
