// A ZIP of logos really exported by one device/account and imported on another in Chrome (two separate browser profiles against the local Worker stand-in; D1 and R2 in memory, nothing real is
// touched): every step is checked, not only the records in IndexedDB.
//   - device A (account imp.a) has 88 logos: 86 of parties that are in no list of this game (original ids kept), one of a real party and one made by a player; the ZIP is exported with the button;
//   - device B (account imp.b, a career with another party running): choose the file, the review (88 new), «Importa»: the result with the quantities, the records in IndexedDB re-read, EVERY logo
//     visible in the catalog with its image (also the parties that are not in the current career, under their original id), the account catalog (D1 and R2) gets the 88, a second device C of imp.b
//     downloads them and shows them;
//   - the same ZIP again: nothing is new, nothing is written twice; a ZIP with one altered image: that one is «non valido», the others are imported; a damaged file is refused with the reason;
//   - the cloud fails (network down) after the import: the logos stay, the page says they wait and the retry button uploads them; without an account the page says the import stays local.
// Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Importazione dei loghi visibili saltata: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
globalThis.location = new URL('http://127.0.0.1:8791/');
const client = await import('../src/data/repositories/account-sync.js');
const { startLocalWorker } = await import('./lib/local-worker.mjs');
const local = await startLocalWorker({ port: 8791 });
let ip = 190;
for (const [username, password] of [['imp.a', 'password-di-a'], ['imp.b', 'password-di-b'], ['imp.d', 'password-di-d']]) {
  const proof = await client.passwordProof(username, password);
  const response = await local.worker.fetch(new Request(`${local.origin}/api/account/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': `203.0.113.${++ip}` }, body: JSON.stringify({ username, proof }) }), local.env);
  assert.equal(response.status, 201);
}
const rowsOf = username => local.sqlite.prepare('SELECT l.* FROM logos l JOIN users u ON u.id = l.user_id WHERE u.username = ? AND l.deleted_at IS NULL ORDER BY l.party_id').all(username);
const EXTERNAL = Array.from({ length: 86 }, (_, i) => `party-esterno-${String(i + 1).padStart(3, '0')}`);
const REAL = 'party-registro-p1-2017-41-ir', MADE = 'partito-utente-1760000000000-ab12';
const ALL = [...EXTERNAL, REAL, MADE].sort();

const helpers = ({ evaluate, waitFor, pause, version }) => {
  const wait = async (check, label = '') => { try { return await waitFor(check); } catch { const page = await evaluate(`(document.querySelector('[data-logo-catalog]')?.innerText ?? document.body.innerText).slice(0, 1200)`).catch(() => ''); throw new Error(`Tempo scaduto in attesa di: ${label || check}\n${page}`); } };
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ${selector.replace(/'/g, '')}'); el.click(); return true; })()`);
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? ''`);
  const inPage = body => evaluate(`(async () => { ${body} })()`);
  const logos = body => inPage(`const L = await import('/src/data/repositories/personal-logos.js?v=${version}'); ${body}`);
  const fill = (form, values) => evaluate(`(() => { const form = document.querySelector('[data-account-form="${form}"]'); for (const [name, value] of Object.entries(${JSON.stringify(values)})) form[name].value = value; form.requestSubmit(); return true; })()`);
  const closeMenuView = async () => { if (await has('[data-menu-close]')) { await click('.menu-popup-foot [data-menu-close]').catch(() => {}); await pause(150); } };
  const openAccount = async () => { if (await has('[data-account-form="login"], [data-account-action="refresh"]')) return; await wait(() => has('[data-menu="account"]')); await click('[data-menu="account"]'); await pause(150); };
  const login = async (username, password) => { await closeMenuView(); await openAccount(); await fill('login', { username, password }); await wait(() => has('[data-account-action="logout"]'), 'accesso'); await pause(300); };
  const openCatalog = async () => { await closeMenuView(); await wait(() => has('[data-menu="loghi"]')); await click('[data-menu="loghi"]'); await wait(() => has('[data-logo-catalog] [data-logo-archive]'), 'catalogo dei loghi'); await wait(() => has('.logo-row'), 'elenco dei partiti'); };
  const records = scope => logos(`return (await L.logoStore.all(${JSON.stringify(scope)})).filter(item => item.blob && !item.deleted).map(item => [item.partyId, item.sha, Boolean(item.dirty)]).sort();`);
  const giveFile = (selector, base64) => evaluate(`(async () => { const bin = atob(${JSON.stringify(base64)}); const bytes = Uint8Array.from(bin, c => c.charCodeAt(0)); const file = new File([bytes], 'loghi.zip', { type: 'application/zip' }); const input = document.querySelector(${JSON.stringify(selector)}); const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  // every row of the catalog (also the «Mostra altri» pages) with the image really decoded
  const shownLogos = async () => {
    while (await has('[data-action="logo-more"]')) { await click('[data-action="logo-more"]'); await pause(120); }
    return evaluate(`(async () => {
      const out = [];
      for (const row of document.querySelectorAll('.logo-row')) {
        row.scrollIntoView({ block: 'center' });
        const img = row.querySelector('.logo-row-mark img');
        let decoded = false; if (img) { try { await img.decode(); decoded = img.naturalWidth > 0; } catch { decoded = false; } }
        out.push({ id: row.dataset.logoPartyId, custom: row.querySelector('[data-logo-state]')?.dataset.logoState === 'custom', decoded });
      }
      return out;
    })()`);
  };
  return { wait, click, has, text, inPage, logos, login, openCatalog, records, giveFile, shownLogos, closeMenuView, openAccount, pause, evaluate, version };
};
const onboard = async (h, goto) => { await goto(''); await h.evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tutorial: true, install: true })); true`); await goto(''); };
const baseline = (errors, extra = /$^/) => assert.deepEqual(errors.filter(item => !/favicon|ERR_|Failed to load resource|offline/i.test(String(item)) && !extra.test(String(item))), [], 'Nessun errore nella pagina.');

let zip64 = null, aRecords = null;
// ---------- device A: 88 logos, the real export ----------
await withBrowser(async ({ evaluate, goto, waitFor, pause, errors, version }) => {
  const h = helpers({ evaluate, waitFor, pause, version });
  await onboard(h, goto);
  await h.login('imp.a', 'password-di-a');
  await h.logos(`
    const ids = ${JSON.stringify(ALL)};
    for (const [n, id] of ids.entries()) {
      const canvas = Object.assign(document.createElement('canvas'), { width: 90 + n, height: 70 }); const c = canvas.getContext('2d'); c.fillStyle = 'hsl(' + ((n * 37) % 360) + ', 65%, ' + (30 + (n % 5) * 8) + '%)'; c.fillRect(0, 0, canvas.width, canvas.height); c.fillStyle = '#fff'; c.fillRect(8 + (n % 20), 8, 24, 24);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await L.saveLogo(id, await L.prepareLogo(new File([blob], 'logo-' + n + '.png', { type: 'image/png' })), { fileName: 'logo-' + n + '.png' });
    }
    await (await import('/src/data/repositories/logo-sync.js?v=${version}')).syncLogos();
    return true;`);
  aRecords = (await h.records('imp.a')).map(([id, sha]) => [id, sha]);
  assert.equal(aRecords.length, ALL.length);
  await h.wait(() => rowsOf('imp.a').length === ALL.length, 'caricamento dei 88 loghi di A');
  await h.inPage(`window.__made = new Map(); window.__downloads = [];
    const make = URL.createObjectURL.bind(URL); URL.createObjectURL = blob => { const href = make(blob); window.__made.set(href, blob); return href; };
    const click = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__downloads.push({ name: this.download, blob: window.__made.get(this.href) }); return; } return click.call(this); };
    return true;`);
  await h.openCatalog();
  await h.click('[data-action="logo-export"]');
  await h.wait(() => h.evaluate('window.__downloads.length === 1'), 'download dello ZIP');
  zip64 = await h.inPage(`const bytes = new Uint8Array(await window.__downloads[0].blob.arrayBuffer()); let bin = ''; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(bin);`);
  assert.ok(zip64.length > 1000);
  baseline(errors);
}, { serverPort: 8791, language: 'it' });
assert.equal(rowsOf('imp.b').length, 0);

// ---------- device B: another account, a career with another party; the import ----------
let altered64 = null;
await withBrowser(async ({ evaluate, goto, waitFor, pause, errors, version }) => {
  const h = helpers({ evaluate, waitFor, pause, version });
  await onboard(h, goto);
  await h.login('imp.b', 'password-di-b');
  await createCareerInPage({ evaluate, version }, { weeks: 1, name: ['Importa', 'Loghi'] });
  await goto(''); await h.wait(() => h.has('[data-menu]'));
  await h.inPage(`window.__net = []; const realFetch = window.fetch; window.__offline = false; window.fetch = (input, init) => { const url = String(input?.url ?? input); window.__net.push(url); return window.__offline && /\\/api\\//.test(url) ? Promise.reject(new TypeError('offline')) : realFetch(input, init); }; return true;`);
  await h.openCatalog();
  // before the import: the parties of this game are listed, the 88 are not
  const before = await h.shownLogos();
  assert.ok(before.length > 5 && before.every(item => !item.custom), `Prima dell’importazione nessun logo tuo (${before.length} righe, ${before.filter(item => item.custom).length} con un logo).`);
  assert.ok(!before.some(item => EXTERNAL.includes(item.id)));

  await h.giveFile('[data-logo-import-file]', zip64);
  await h.wait(() => h.has('[data-logo-import-plan]'), 'riepilogo dell’archivio');
  assert.match(await h.text('[data-logo-import-summary]'), /88 loghi · 88 nuovi · 0 già presenti identici · 0 in conflitto · 0 non validi/);
  assert.deepEqual(await h.records('imp.b'), [], 'Aprire l’archivio non scrive nulla.');
  await h.click('[data-action="logo-import-apply"]');
  await h.wait(() => h.has('[data-logo-import-result]'), 'esito dell’importazione');
  await h.wait(async () => !(await h.has('[data-logo-import-progress]')), 'fine dell’importazione');
  assert.match(await h.text('[data-logo-import-result]'), /Importati 88, sostituiti 0, mantenuti 0, saltati 0, già presenti 0, non validi 0, non riusciti 0/);
  // 1. the records are really in IndexedDB (re-read), under the account that is signed in, with the original ids
  const stored = await h.records('imp.b');
  assert.deepEqual(stored.map(([id, sha]) => [id, sha]), aRecords, 'Gli stessi 88 identificativi e le stesse immagini (checksum).');
  assert.deepEqual(await h.records('_ospite'), [], 'Nulla è finito nel catalogo degli ospiti.');
  assert.deepEqual(await h.records('imp.a'), [], 'Nulla è finito nel catalogo di un altro account.');
  // 2. the page says clearly what was done and where
  const outcome = await h.text('[data-logo-import-outcome]');
  assert.match(outcome, /88 importati/); assert.match(outcome, /0 già presenti/); assert.match(outcome, /0 in conflitto/); assert.match(outcome, /0 non validi/); assert.match(outcome, /0 non riusciti/);
  assert.match(outcome, /account «imp\.b»/);
  // 3. EVERY logo is visible, with its image, under its original id (also those of parties that are not in this game)
  const shown = await h.shownLogos();
  const customShown = shown.filter(item => item.custom);
  assert.deepEqual(customShown.map(item => item.id).sort(), ALL, 'Nel catalogo si vedono tutti gli 88 loghi importati, con l’identificativo originale.');
  assert.ok(customShown.every(item => item.decoded), 'E ognuno mostra davvero la sua immagine.');
  assert.match(await h.text('[data-logo-count]'), /88 con un logo tuo/);
  assert.equal(shown.length, new Set(shown.map(item => item.id)).size, 'Nessuna riga doppia.');
  // 4. the account catalog (D1 and R2) has them, uploaded by the usual synchronisation
  await h.wait(() => rowsOf('imp.b').length === ALL.length, 'caricamento sull’account');
  assert.deepEqual(rowsOf('imp.b').map(row => row.party_id), ALL);
  assert.deepEqual(rowsOf('imp.b').map(row => row.sha256).sort(), aRecords.map(item => item[1]).sort(), 'Online ci sono le stesse immagini.');
  await h.wait(async () => /sincronizzati con il tuo account/.test(await h.text('[data-logo-sync]')), 'stato di sincronizzazione');
  assert.ok((await h.records('imp.b')).every(item => item[2] === false), 'Nessun logo resta in attesa.');

  // the same file again: nothing is new, nothing is written twice
  const versions = rowsOf('imp.b').map(row => `${row.party_id}|${row.version}`);
  await h.giveFile('[data-logo-import-file]', zip64);
  await h.wait(async () => /88 già presenti identici/.test(await h.text('[data-logo-import-summary]')), 'secondo riepilogo');
  assert.match(await h.text('[data-logo-import-summary]'), /0 nuovi/);
  assert.ok(await h.has('[data-action="logo-import-apply"][disabled]'), 'Non c’è nulla da importare: il pulsante è spento.');
  await h.click('[data-action="logo-import-cancel"]');
  assert.deepEqual(rowsOf('imp.b').map(row => `${row.party_id}|${row.version}`), versions, 'Nessuna nuova versione online.');

  // a damaged file and a ZIP with one altered image
  altered64 = await h.inPage(`
    const { readZip, zipStore } = await import('/src/data/repositories/logo-archive.js?v=${version}');
    const bin = atob(${JSON.stringify(zip64)}); const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const entries = await readZip(bytes); const files = [];
    let altered = false;
    for (const [name, data] of entries) { const copy = new Uint8Array(data); if (!altered && name !== 'manifest.json') { copy[copy.length - 20] ^= 0xff; altered = true; } files.push({ name, bytes: copy }); }
    const out = zipStore(files); let s = ''; for (let i = 0; i < out.length; i += 8192) s += String.fromCharCode(...out.subarray(i, i + 8192)); return btoa(s);`);
  await h.giveFile('[data-logo-import-file]', Buffer.from(zip64, 'base64').subarray(0, 30000).toString('base64'));
  await h.wait(() => h.has('[data-logo-archive-error]'), 'errore per il file danneggiato');
  assert.ok((await h.text('[data-logo-archive-error]')).length > 10, 'Il file danneggiato è rifiutato con il motivo.');
  assert.equal((await h.records('imp.b')).length, 88, 'Il file danneggiato non cambia nulla.');
  baseline(errors);
}, { serverPort: 8791, language: 'it' });

// ---------- device C: a second device of imp.b downloads and shows the 88 ----------
await withBrowser(async ({ evaluate, goto, waitFor, pause, errors, version }) => {
  const h = helpers({ evaluate, waitFor, pause, version });
  await onboard(h, goto);
  await h.login('imp.b', 'password-di-b');
  await h.wait(async () => (await h.records('imp.b')).length === ALL.length, 'download dei loghi sul secondo dispositivo');
  assert.deepEqual((await h.records('imp.b')).map(([id, sha]) => [id, sha]), aRecords, 'Le stesse immagini del primo dispositivo.');
  await h.openCatalog();
  const shown = (await h.shownLogos()).filter(item => item.custom);
  assert.deepEqual(shown.map(item => item.id).sort(), ALL, 'Sul secondo dispositivo si vedono tutti gli 88 loghi.');
  assert.ok(shown.every(item => item.decoded));
  baseline(errors);
}, { serverPort: 8791, language: 'it' });

// ---------- account imp.d: one altered image is «non valido», the cloud is down after the import, the retry uploads ----------
await withBrowser(async ({ evaluate, goto, waitFor, pause, errors, version }) => {
  const h = helpers({ evaluate, waitFor, pause, version });
  await onboard(h, goto);
  await h.login('imp.d', 'password-di-d');
  await h.inPage(`window.__offline = false; const f = window.fetch; window.fetch = (input, init) => window.__offline && /\\/api\\//.test(String(input?.url ?? input)) ? Promise.reject(new TypeError('offline')) : f(input, init); return true;`);
  await h.openCatalog();
  await h.giveFile('[data-logo-import-file]', altered64);
  await h.wait(() => h.has('[data-logo-import-plan]'), 'riepilogo del file con un’immagine alterata');
  assert.match(await h.text('[data-logo-import-summary]'), /88 loghi · 87 nuovi · 0 già presenti identici · 0 in conflitto · 1 non validi/);
  // the network goes down just before the import: the logos are saved on the device, the cloud fails
  await h.evaluate(`window.__offline = true; true`);
  await h.click('[data-action="logo-import-apply"]');
  await h.wait(() => h.has('[data-logo-import-result]'), 'esito');
  await h.wait(async () => !(await h.has('[data-logo-import-progress]')), 'fine');
  await h.wait(async () => /non raggiungibile|attendono/.test(await h.text('[data-logo-import-outcome]')), 'avviso del cloud non raggiunto');
  const outcome = await h.text('[data-logo-import-outcome]');
  assert.match(outcome, /87 importati/); assert.match(outcome, /1 non validi/); assert.match(outcome, /0 non riusciti/);
  assert.doesNotMatch(outcome, /caricati sul tuo account\./, 'Il caricamento non è dichiarato riuscito.');
  assert.equal((await h.records('imp.d')).length, 87, 'I loghi validi restano sul dispositivo.');
  assert.ok((await h.records('imp.d')).every(item => item[2] === true), 'E sono tutti in attesa di essere caricati.');
  assert.equal(rowsOf('imp.d').length, 0);
  assert.ok(await h.has('[data-logo-import-outcome] [data-action="logo-sync-now"]'), 'C’è il pulsante per riprovare.');
  // the network is back: the retry button uploads them
  await h.evaluate(`window.__offline = false; true`);
  await h.click('[data-logo-import-outcome] [data-action="logo-sync-now"]');
  await h.wait(() => rowsOf('imp.d').length === 87, 'caricamento dopo «Riprova»');
  await h.wait(async () => /caricati sul tuo account/.test(await h.text('[data-logo-import-outcome]')), 'esito finale');
  assert.ok((await h.records('imp.d')).every(item => item[2] === false));
  baseline(errors);
}, { serverPort: 8791, language: 'it' });

// ---------- no account: the import stays on this device and the page says so; nothing goes online ----------
await withBrowser(async ({ evaluate, goto, waitFor, pause, errors, version }) => {
  const h = helpers({ evaluate, waitFor, pause, version });
  await onboard(h, goto);
  await h.inPage(`window.__net = []; const f = window.fetch; window.fetch = (input, init) => { window.__net.push(String(input?.url ?? input)); return f(input, init); }; return true;`);
  await h.openCatalog();
  await h.giveFile('[data-logo-import-file]', zip64);
  await h.wait(() => h.has('[data-logo-import-plan]'), 'riepilogo');
  await h.click('[data-action="logo-import-apply"]');
  await h.wait(() => h.has('[data-logo-import-outcome]'), 'esito');
  await h.wait(async () => !(await h.has('[data-logo-import-progress]')), 'fine');
  const outcome = await h.text('[data-logo-import-outcome]');
  assert.match(outcome, /88 importati/);
  assert.match(outcome, /resta(no)? su questo dispositivo/i); assert.match(outcome, /accedi/i);
  assert.equal((await h.records('_ospite')).length, 88);
  const shown = (await h.shownLogos()).filter(item => item.custom);
  assert.deepEqual(shown.map(item => item.id).sort(), ALL, 'Anche senza account si vedono tutti gli 88.');
  assert.equal((await h.evaluate('window.__net')).filter(url => /api\/logos/.test(url)).length, 0, 'Nessuna richiesta online per i loghi.');
  baseline(errors);
}, { serverPort: 8791, language: 'it' });
await local.close();
console.log('Importazione ZIP dei loghi verificata in Chrome (ZIP esportato davvero da un altro account/dispositivo, Worker locale): 88 loghi con identificativi non presenti nella carriera tutti visibili con la loro immagine, esito con le quantità, scrittura riletta, catalogo dell’account (D1 e R2) e secondo dispositivo, stesso ZIP senza duplicati, immagine alterata non valida, file danneggiato rifiutato, cloud non raggiungibile con «Riprova», senza account resta locale.');
process.exit(0);
