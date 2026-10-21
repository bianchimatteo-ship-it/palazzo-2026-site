// Offline tool for the owner: prepares the record the Worker keeps for the admin credential (salt + PBKDF2 hash + epoch), so it can be written to the production KV by hand with
// wrangler. The credential is read from standard input (never from an argument or a file in the repository) and is not printed; only the record is.
//   printf '%s' "$NEW_CREDENTIAL" | node scripts/admin-credential-record.mjs      (or run it and type the value, then Ctrl-D)
// Nothing here talks to Cloudflare. Writing the record and the effect on the online game are described in docs/admin-credenziale.md.
import { adminCredentialRecord } from '../worker.js';

let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) input += chunk;
const pin = input.replace(/\r?\n$/, '');
if (pin.length < 6 || pin.length > 64) { console.error('La credenziale deve avere da 6 a 64 caratteri.'); process.exit(1); }
const record = await adminCredentialRecord(pin);
console.log(JSON.stringify(record));
