// The public portal of the production Worker: the ONLY web pages it serves (confirm the e-mail address, choose a new password, the legal pages the app links, the account deletion page).
// It carries no game: the files below are copied byte for byte from the sources of the game (the account client, the legal pages), so the portal keeps the same tokens, deadlines and checks.
//   node scripts/build-portal.mjs          writes portal/
//   node scripts/build-portal.mjs --check  fails if portal/ is not what the sources give (used by npm run check:publication)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const PORTAL_COPIES = Object.freeze([
  'privacy.html', 'privacy-en.html', 'termini.html', 'terms-en.html', 'elimina-account.html', 'delete-account-en.html', 'favicon.ico', 'favicon.svg',
  'src/legal.css', 'src/legal/delete-account.js', 'src/data/repositories/account-sync.js', 'src/data/repositories/career-visibility.js'
]);
const check = process.argv.includes('--check');
const stale = [];
for (const name of PORTAL_COPIES) {
  const source = await readFile(join(ROOT, name));
  const target = join(ROOT, 'portal', name);
  let current = null;
  try { current = await readFile(target); } catch { /* not there yet */ }
  if (current && Buffer.compare(current, source) === 0) continue;
  if (check) { stale.push(name); continue; }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, source);
}
if (check && stale.length) { console.error(`Il portale non è aggiornato rispetto ai sorgenti: ${stale.join(', ')} (esegui node scripts/build-portal.mjs).`); process.exit(1); }
console.log(check ? 'Portale aggiornato rispetto ai sorgenti.' : `Portale scritto: ${PORTAL_COPIES.length} file copiati.`);
