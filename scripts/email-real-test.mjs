// REAL e-mail test against a TEST deployment (never run by check:all). It sends ONE verification message to the test mailbox through the
// Apps Script gateway configured on that deployment. Nothing secret is stored here: the target and the optional Cloudflare Access service
// token come from the environment of whoever runs it.
//   TEST_BASE_URL=https://<sito-test> [CF_ACCESS_CLIENT_ID=… CF_ACCESS_CLIENT_SECRET=…] node scripts/email-real-test.mjs --yes
import crypto from 'node:crypto';

const RECIPIENT = 'politicando2026simulazione@gmail.com';
const base = String(process.env.TEST_BASE_URL ?? '').replace(/\/+$/, '');
const fail = message => { console.error(`email-real-test: ${message}`); process.exit(1); };
if (!base) fail('imposta TEST_BASE_URL con l’indirizzo del sito TEST (https://…). Nessuna richiesta inviata.');
const url = new URL(base);
if (url.protocol !== 'https:') fail('solo https.');
if (!/test/i.test(url.hostname) && process.env.ALLOW_NON_TEST_HOST !== '1') fail(`l’host ${url.hostname} non sembra un ambiente TEST: rifiuto per non scrivere in produzione.`);
if (!process.argv.includes('--yes')) fail('questo test spedisce un messaggio vero a ' + RECIPIENT + '. Rilancia con --yes per confermare.');
const access = process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET
  ? { 'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID, 'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET } : {};
const call = async (path, { method = 'GET', body, token } = {}) => {
  const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...access, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text(); let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: response.status, json, text };
};
const status = await call('/api/account/status');
if (status.status === 401 || status.status === 403 || !status.json) fail(`il TEST non risponde con JSON (HTTP ${status.status}): probabile Cloudflare Access; fornisci CF_ACCESS_CLIENT_ID e CF_ACCESS_CLIENT_SECRET di un service token.`);
if (status.json.email !== true) fail('/api/account/status dice email:false: EMAIL_GATEWAY_URL/SECRET non sono configurati sul TEST. Nessun messaggio spedito.');
const name = `prova.${crypto.randomBytes(4).toString('hex')}`;
const proof = crypto.randomBytes(32).toString('hex');
const registered = await call('/api/account/register', { method: 'POST', body: { username: name, proof } });
if (registered.status !== 201) fail(`registrazione di prova non riuscita (HTTP ${registered.status}).`);
const sent = await call('/api/account/email', { method: 'POST', token: registered.json.token, body: { email: RECIPIENT, proof } });
if (sent.status !== 200 && sent.status !== 202) fail(`richiesta di verifica non riuscita (HTTP ${sent.status}): ${String(sent.json?.error ?? '').slice(0, 120)}`);
console.log(`OK: richiesta accettata dal TEST per l’account di prova «${name}». Controlla la casella ${RECIPIENT} (anche spam): deve arrivare «POLITICANDO 2026 — conferma il tuo indirizzo». L’arrivo reale va confermato a mano.`);
