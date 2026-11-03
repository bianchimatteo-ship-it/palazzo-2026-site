// The independent audit of the English interface (scripts/audit-i18n-ui.mjs) as a check: a career of two levels is created, played on and walked page by page in Chrome in English, every text a person can
// read is analysed without the phrase book as the judge (scripts/lib/i18n-independent.mjs), and ANY text left in Italian fails the check. Wider runs (all six levels, more years, every safe button pressed):
//   AUDIT_LEVELS=deputato,senatore,comunale,regionale,provinciale,europeo AUDIT_WEEKS=10,130 AUDIT_CLICKS=1 node scripts/audit-i18n-ui.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromeAvailable } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Audit dell’interfaccia inglese saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
const root = fileURLToPath(new URL('../', import.meta.url));
const run = spawnSync(process.execPath, [`${root}scripts/audit-i18n-ui.mjs`], { cwd: root, encoding: 'utf8', timeout: 1500000, env: { ...process.env, AUDIT_LEVELS: process.env.AUDIT_LEVELS ?? 'deputato,comunale', AUDIT_WEEKS: process.env.AUDIT_WEEKS ?? '10,60', AUDIT_CLICKS: process.env.AUDIT_CLICKS ?? '0', AUDIT_REQUIRE_CHROME: '1' } });
process.stdout.write(run.stdout.split('\n').slice(0, 30).join('\n') + '\n');
if (run.status !== 0) { process.stderr.write(run.stderr.slice(-800)); console.error('Audit dell’interfaccia inglese FALLITO: restano testi italiani (o una carriera non è stata percorsa).'); process.exit(1); }
console.log('Audit indipendente verificato: l’interfaccia inglese di due livelli di carriera percorsa pagina per pagina non lascia testi italiani.');
