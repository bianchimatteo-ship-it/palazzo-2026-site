// The logos of an account appear on every device that is signed in to it, without opening the catalog: at sign-in, when the page starts with a session, when the network comes back and when
// the page is shown again. A change made by "another device" (here: straight on the account's cloud copy, as a second device would) arrives on its own; another account's logo never does.
// In Chrome against the local Worker stand-in (nothing real is touched). Skipped without Chrome.
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Sincronizzazione dei loghi nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
globalThis.location = new URL('http://127.0.0.1:8791/');
const client = await import('../src/data/repositories/account-sync.js');
const { startLocalWorker } = await import('./lib/local-worker.mjs');
const local = await startLocalWorker({ port: 8791 });
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = bytes => { let c = 0xffffffff; for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]); const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), 8 + data.length); return out; };
const png = n => { const head = Buffer.alloc(13); head.writeUInt32BE(32, 0); head.writeUInt32BE(32, 4); head[8] = 8; head[9] = 2; const row = Buffer.alloc(97); for (let x = 0; x < 32; x++) { row[1 + x * 3] = n * 40 % 256; row[2 + x * 3] = 90; row[3 + x * 3] = 200 - n * 20; } return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: 32 }, () => row)))), chunk('IEND', Buffer.alloc(0))]); };
let ip = 150;
const register = async (username, password) => {
  const proof = await client.passwordProof(username, password);
  const response = await local.worker.fetch(new Request(`${local.origin}/api/account/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': `203.0.113.${++ip}` }, body: JSON.stringify({ username, proof }) }), local.env);
  if (response.status !== 201) throw new Error('register ' + response.status + ' ' + await response.text());
  return (await response.json()).token;
};
const tokenA = await register('trig.a', 'password-di-a'), tokenB = await register('trig.b', 'password-di-b');
// "another device": the account's cloud copy written directly
const putFromOtherDevice = async (token, partyId, n) => { const response = await local.worker.fetch(new Request(`${local.origin}/api/logos/${partyId}?w=32&h=32&name=altro.png`, { method: 'PUT', headers: { authorization: `Bearer ${token}`, 'x-base-version': '0', 'content-type': 'image/png' }, body: png(n) }), local.env); assert.equal(response.status, 201); };

await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, errors, version }) => {
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ${selector.replace(/'/g, '')}'); el.click(); return true; })()`);
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const inPage = body => evaluate(`(async () => { ${body} })()`);
  const owned = () => inPage(`const L = await import('/src/data/repositories/personal-logos.js?v=${version}'); return (await L.logoStore.all('trig.a')).filter(item => item.blob && !item.deleted).map(item => item.partyId).sort();`);
  const listCalls = () => evaluate(`window.__logoLists ?? 0`);
  const arm = () => inPage(`window.__logoLists = 0; const f = window.fetch; window.fetch = (input, init = {}) => { const url = String(input?.url ?? input); if (/\\/api\\/logos$/.test(url) && (!init.method || init.method === 'GET')) window.__logoLists++; return f(input, init); }; return true;`);
  const openAccount = async () => { if (await has('[data-account-form="login"], [data-account-action="refresh"]')) return; await wait(() => has('[data-menu="account"]')); await click('[data-menu="account"]'); await pause(150); };
  const fill = (form, values) => evaluate(`(() => { const form = document.querySelector('[data-account-form="${form}"]'); for (const [name, value] of Object.entries(${JSON.stringify(values)})) form[name].value = value; form.requestSubmit(); return true; })()`);

  await goto('');
  await createCareerInPage({ evaluate, version }, { weeks: 1, name: ['Sincro', 'Loghi'] });
  await goto('');
  await arm();
  // ---------- sign-in ----------
  await putFromOtherDevice(tokenA, 'party-uno', 1);
  await openAccount();
  await fill('login', { username: 'trig.a', password: 'password-di-a' });
  await wait(() => has('[data-account-action="logout"]'));
  await wait(async () => (await owned()).includes('party-uno'));
  assert.ok(await listCalls() >= 1, 'All’accesso la sincronizzazione parte da sola, senza aprire il catalogo.');
  // ---------- the network comes back ----------
  await putFromOtherDevice(tokenA, 'party-due', 2);
  await evaluate(`window.dispatchEvent(new Event('online')); true`);
  await wait(async () => (await owned()).includes('party-due'));
  // ---------- the page is shown again ----------
  await putFromOtherDevice(tokenA, 'party-tre', 3);
  await evaluate(`document.dispatchEvent(new Event('visibilitychange')); true`);
  await wait(async () => (await owned()).includes('party-tre'));
  // ---------- the page starts with a session ----------
  await putFromOtherDevice(tokenA, 'party-quattro', 4);
  await goto('');
  await wait(async () => (await owned()).includes('party-quattro'));
  // ---------- isolation ----------
  await putFromOtherDevice(tokenB, 'party-di-b', 5);
  await evaluate(`window.dispatchEvent(new Event('online')); true`);
  await pause(1500);
  assert.deepEqual(await owned(), ['party-due', 'party-quattro', 'party-tre', 'party-uno'], 'Arrivano i loghi dell’account e solo quelli.');
  assert.deepEqual(errors.filter(item => !/favicon|ERR_|Failed to load resource/i.test(String(item))), [], 'Nessun errore nella pagina.');
}, { serverPort: 8791, language: 'it' });
await local.close();
console.log('Sincronizzazione automatica dei loghi verificata in Chrome: all’accesso, all’avvio con una sessione, al ritorno della rete e quando la pagina torna visibile i loghi cambiati da un altro dispositivo arrivano da soli; quelli di un altro account no.');
process.exit(0);
