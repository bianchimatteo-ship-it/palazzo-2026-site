// Monitoring of the automatic translation (DeepL), without translating anything and without spending a character.
//   node scripts/i18n-auto.mjs --status [url]   reads GET /api/translate/status of the Worker (default: the published one): configured or not, what is missing, the limits and the characters used today
//                                               and this month (the same counter that blocks the calls). It never calls DeepL.
//   node scripts/i18n-auto.mjs --missing        runs the tour of check-i18n in English (Chrome needed, CHROME_PATH) and says how many Italian texts are still visible; nothing is translated: the texts
//                                               that the phrase book lacks are translated at run time, once, as anonymous templates, through the Worker (cache + limits), never in bulk at build.
// The translations are NOT made at build or at start: the build only ships the phrase book and the code.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const say = text => console.log(`[i18n-auto] ${text}`);
if (args.includes('--missing')) {
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('./check-i18n.mjs', import.meta.url))], { env: { ...process.env, I18N_MEASURE: '1' }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  say((run.stdout.match(/^Inglese:[^\n]*/m) ?? [run.stderr.slice(0, 300)])[0]);
  process.exit(run.status === 0 ? 0 : 1);
}
const origin = args.find(item => /^https?:/.test(item)) ?? 'https://palazzo-2026-site.bianchimatteo657.workers.dev';
try {
  const data = await (await fetch(`${origin}/api/translate/status`, { signal: AbortSignal.timeout(10000) })).json();
  say(`Servizio: ${data.configured ? `attivo (${data.provider})` : `NON configurato — manca: ${(data.needs ?? []).join('; ')}`}`);
  if (data.limits) say(`Limiti: ${data.limits.day} caratteri al giorno, ${data.limits.month} al mese, ${data.limits.request} per richiesta, ${data.limits.texts} testi per richiesta, ${data.limits.rate} richieste al minuto per indirizzo.`);
  if (data.usage) say(`Consumo: oggi ${data.usage.day.used}/${data.usage.day.limit}, mese ${data.usage.month.used}/${data.usage.month.limit}${data.usage.blocked ? `; BLOCCATO fino a ${data.usage.blocked.until} (${data.usage.blocked.reason})` : ''}.`);
  process.exit(data.configured ? 0 : 2);
} catch (error) { say(`Stato non raggiungibile da qui (${error.cause?.code ?? error.message}).`); process.exit(3); }
