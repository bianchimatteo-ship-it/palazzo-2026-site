// Development tool (never part of the game): finds the Italian that the English screens still show and writes it where it can be translated.
//   node scripts/i18n-extract.mjs [out.json]    walks the screens, the popups and the wizard of a career in Chrome (the same walk as check-i18n) and writes the DISTINCT Italian texts it finds —
//                                               numbers brought to `#`, with the screens that show them — to out.json (default scripts/i18n-missing.json), then prints how many there are.
//   node scripts/i18n-complete.mjs pairs.json   adds the reviewed translations (a JSON list of [italian, english] pairs, `#` for a number and `{}` for a free part) to the phrase book, after checking them.
// Nothing here translates by itself and nothing calls an external translator: the pairs are written (or reviewed) by a person, so that the terminology (institutions, grammatical gender, plurals, English
// date/number/currency forms) is the one decided, and what the game shows in English is always a text that was read. check-i18n then fails on any Italian text that is neither translated nor in the reasoned allowlist.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const out = process.argv[2] ?? fileURLToPath(new URL('./i18n-missing.json', import.meta.url));
const run = spawnSync(process.execPath, [fileURLToPath(new URL('./check-i18n.mjs', import.meta.url))], { env: { ...process.env, I18N_MEASURE: '1', I18N_EXTRACT: out }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const line = (run.stdout.match(/^Inglese:[^\n]*/m) ?? [''])[0];
console.log(line.slice(0, 220) || run.stderr.slice(0, 400));
console.log(`Elenco scritto in ${out}`);
process.exit(run.status === 0 ? 0 : 1);
