// The logo uploaded for a NEW party in the career creator goes to the account like the logos of the catalog, and shows up on another device. In Chrome, two separate browser profiles (device A and
// device B) against the local Worker stand-in (D1 and R2 in memory; nothing real is touched):
//   - device A: signed in to the account, the creator is run with the real buttons (identity, place, party «nuovo» with an uploaded logo); the career is created WITHOUT waiting for the upload;
//     with the network down the logo stays on the device, the toast says it is waiting and the career is saved all the same; when the network is back the logo goes up by itself (checksum verified);
//     a second career with another new party, this time online, uploads its logo at once and says so;
//   - the cloud has both images (metadata in D1, bytes in R2) and the careers; account C (another one) sees none of it;
//   - device B (a fresh profile): sign-in downloads the logos with no catalog opened, loads the career online and the logo is shown next to the party; reloading the page with the session
//     already active repeats nothing and loses nothing; a later edit made on B from the synced version goes up as a normal update (real conflicts are checked in check-logo-sync).
// Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Logo del nuovo partito sincronizzato fra dispositivi saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
globalThis.location = new URL('http://127.0.0.1:8791/');
const client = await import('../src/data/repositories/account-sync.js');
const { startLocalWorker } = await import('./lib/local-worker.mjs');
const local = await startLocalWorker({ port: 8791 });
let ip = 170;
for (const [username, password] of [['wiz.a', 'password-di-a'], ['wiz.c', 'password-di-c']]) {
  const proof = await client.passwordProof(username, password);
  const response = await local.worker.fetch(new Request(`${local.origin}/api/account/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': `203.0.113.${++ip}` }, body: JSON.stringify({ username, proof }) }), local.env);
  assert.equal(response.status, 201);
}
const rowsOf = username => local.sqlite.prepare('SELECT l.* FROM logos l JOIN users u ON u.id = l.user_id WHERE u.username = ? AND l.deleted_at IS NULL ORDER BY l.created_at').all(username);
const savesOf = username => local.sqlite.prepare('SELECT s.* FROM saves s JOIN users u ON u.id = s.user_id WHERE u.username = ?').all(username);

const helpers = ({ evaluate, waitFor, pause, version }) => {
  const wait = async check => { try { return await waitFor(check); } catch { const page = await evaluate(`(document.querySelector(".career-wizard")?.innerText ?? document.body.innerText).slice(-900)`).catch(() => ''); throw new Error(`Tempo scaduto in attesa di: ${check}\n${page}`); } };
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ${selector.replace(/'/g, '')}'); el.click(); return true; })()`);
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? ''`);
  const inPage = body => evaluate(`(async () => { ${body} })()`);
  const fill = (form, values) => evaluate(`(() => { const form = document.querySelector('[data-account-form="${form}"]'); for (const [name, value] of Object.entries(${JSON.stringify(values)})) form[name].value = value; form.requestSubmit(); return true; })()`);
  const openAccount = async () => { if (await has('[data-account-form="login"], [data-account-action="refresh"]')) return; await wait(() => has('[data-menu="account"]')); await click('[data-menu="account"]'); await pause(150); };
  const closeMenuView = async () => { if (await has('[data-menu-close]')) { await click('.menu-popup-foot [data-menu-close]').catch(() => {}); await pause(150); } };
  const login = async (username, password) => { await closeMenuView(); await openAccount(); await fill('login', { username, password }); await wait(() => has('[data-account-action="logout"]')); await pause(300); };
  const logoRecords = scope => inPage(`const L = await import('/src/data/repositories/personal-logos.js?v=${version}'); return (await L.logoStore.all(${JSON.stringify(scope)})).filter(item => item.blob && !item.deleted).map(item => ({ partyId: item.partyId, dirty: Boolean(item.dirty), sha: item.sha, version: item.sync?.version ?? null }));`);
  const setField = (selector, value, event = 'input') => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true })); return true; })()`).then(() => pause(200));
  const next = () => click('.wizard-footer [data-wizard-action="next"]').then(() => pause(300));
  // the creator with the real buttons: identity, place, path, a NEW party with an uploaded logo, summary, create
  const createCareerWithLogo = async ({ first, last, partyName, abbreviation, color }) => {
    await closeMenuView(); await wait(() => has('[data-menu="nuova"]:not([disabled])'));
    await click('[data-menu="nuova"]:not([disabled])'); await wait(() => has('.career-wizard') || has('[data-confirm="ok"]'));
    if (await has('[data-confirm="ok"]')) { await click('[data-confirm="ok"]'); await wait(() => has('.career-wizard')); }
    await setField('.career-wizard [name="firstName"]', first); await setField('.career-wizard [name="lastName"]', last);
    await setField('.career-wizard [name="birthDate"]', '1985-04-12', 'change'); await setField('.career-wizard [name="previousProfession"]', 'Insegnante');
    await next(); await wait(() => has('[data-wizard-region]'));
    await setField('[data-wizard-region]', 'Toscana', 'change');
    await wait(() => has('[data-wizard-municipality-search]'));
    await setField('[data-wizard-municipality-search]', 'Siena');
    await wait(() => has('[data-municipality-code="052032"]'));
    await click('[data-municipality-code="052032"]'); await pause(250);
    await next();
    await wait(() => has('.level-cards')); await next();
    await wait(() => has('[data-party-mode="new"]'));
    await click('[data-party-mode="new"]'); await pause(250);
    await setField('.career-wizard [name="partyName"]', partyName); await setField('.career-wizard [name="partyAbbreviation"]', abbreviation);
    await setField('.career-wizard [name="partyDescription"]', 'Lista civica di prova per il test dei loghi');
    await evaluate(`(() => { document.querySelector('input[name="partyLogoMode"][value="upload"]').click(); return true; })()`);
    await wait(() => has('[data-wizard-logo-upload]'));
    await evaluate(`(async () => {
      const canvas = Object.assign(document.createElement('canvas'), { width: 240, height: 160 }); const c = canvas.getContext('2d'); c.fillStyle = ${JSON.stringify(color)}; c.fillRect(0, 0, 240, 160); c.fillStyle = '#fff'; c.fillRect(30, 30, 70, 50);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const input = document.querySelector('[data-wizard-logo-upload]'); const dt = new DataTransfer(); dt.items.add(new File([blob], 'logo-partito.png', { type: 'image/png' })); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    await wait(() => has('[data-wizard-logo-preview] img, [data-logo-editor]'));
    await pause(400);
    for (let n = 0; n < 4 && !(await has('.wizard-footer [data-wizard-action="finish"]')); n++) await next();
    if (!(await has('.wizard-footer [data-wizard-action="finish"]'))) throw new Error('Il creatore non arriva al riepilogo: ' + await evaluate(`document.querySelector('.career-wizard')?.innerText.slice(-900)`));
    await click('.wizard-footer [data-wizard-action="finish"]'); await pause(400);
    if (await has('[data-confirm="ok"]')) await click('[data-confirm="ok"]');
    await wait(async () => !(await has('.career-wizard')));
  };
  return { click, has, text, inPage, login, logoRecords, createCareerWithLogo, closeMenuView, openAccount, pause };
};

let partyOne = null, partyTwo = null, shaOne = null, shaTwo = null;
// ---------- device A ----------
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, errors, version }) => {
  const h = helpers({ evaluate, waitFor: wait, pause, version });
  await goto('');
  await evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tutorial: true, install: true })); true`);
  await goto('');
  await h.login('wiz.a', 'password-di-a');
  const sync = () => h.inPage(`return JSON.parse(JSON.stringify((await import('/src/data/repositories/logo-sync.js?v=${version}')).lastLogoSync() ?? null));`);
  const currentParty = () => h.inPage(`const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); return { partyId: s.career.partyId, name: s.game?.party?.label ?? null, career: s.career.id };`);

  // 1. the network is down: the career is created, the logo waits on the device and the player is told
  await evaluate(`window.__offline = true; const f = window.fetch; window.fetch = (input, init) => window.__offline && /\\/api\\//.test(String(input?.url ?? input)) ? Promise.reject(new TypeError('offline')) : f(input, init); true`);
  await h.createCareerWithLogo({ first: 'Prima', last: 'Fondatrice', partyName: 'Lista Uno', abbreviation: 'LU', color: '#1b6ca8' });
  await wait(() => h.has('.page-wrap'));
  partyOne = (await currentParty()).partyId;
  assert.ok(partyOne?.startsWith('partito-utente-'), 'La carriera ha un partito nuovo del giocatore.');
  const waiting = await h.logoRecords('wiz.a');
  assert.deepEqual(waiting.map(item => [item.partyId, item.dirty]), [[partyOne, true]], 'Il logo è salvato sul dispositivo, in attesa di essere caricato.');
  shaOne = waiting[0].sha;
  await wait(async () => /in attesa di essere caricato: sei offline/.test(await evaluate(`document.body.innerText`)) || /in attesa/.test(await h.text('[data-logo-notice], .toast, [role="status"]')));
  assert.equal(rowsOf('wiz.a').length, 0, 'Offline nulla è online.');
  assert.ok(await h.has('.page-wrap'), 'La carriera è stata creata lo stesso.');
  // the network is back: the waiting logo goes up by itself
  await evaluate(`window.__offline = false; window.dispatchEvent(new Event('online')); true`);
  await wait(() => rowsOf('wiz.a').length === 1);
  assert.equal(rowsOf('wiz.a')[0].party_id, partyOne); assert.equal(rowsOf('wiz.a')[0].sha256, shaOne, 'Online c’è la stessa immagine (checksum).');
  await wait(async () => (await h.logoRecords('wiz.a'))[0]?.dirty === false);

  // 2. another new party, online: the logo is uploaded at once, without opening the catalog, and the toast says so
  await goto(''); await wait(() => h.has('[data-menu="nuova"]:not([disabled])'));
  await h.createCareerWithLogo({ first: 'Seconda', last: 'Fondatrice', partyName: 'Lista Due', abbreviation: 'LD', color: '#b3402e' });
  await wait(() => h.has('.page-wrap'));
  partyTwo = (await currentParty()).partyId;
  assert.notEqual(partyTwo, partyOne);
  await wait(() => rowsOf('wiz.a').length === 2);
  const records = await h.logoRecords('wiz.a');
  shaTwo = records.find(item => item.partyId === partyTwo).sha;
  assert.ok(records.every(item => item.dirty === false && item.version >= 1), 'Tutti e due i loghi sono sincronizzati.');
  assert.deepEqual(rowsOf('wiz.a').map(row => row.party_id).sort(), [partyOne, partyTwo].sort());
  await wait(async () => /salvato sul tuo account/.test(await evaluate(`document.body.innerText`)) || (await sync())?.uploaded?.includes(partyTwo));
  assert.ok(savesOf('wiz.a').length >= 1, 'Anche la carriera è online.');
  assert.deepEqual(errors.filter(item => !/favicon|ERR_|Failed to load resource|offline/i.test(String(item))), [], 'Nessun errore nella pagina.');
}, { serverPort: 8791, language: 'it' });
assert.equal(rowsOf('wiz.c').length, 0, 'L’account C non ha loghi.');

// ---------- device B: a fresh profile ----------
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, errors, version }) => {
  const h = helpers({ evaluate, waitFor: wait, pause, version });
  await goto('');
  await evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tutorial: true, install: true })); true`);
  await goto('');
  // another account signs in first on this device: it receives nothing
  await h.login('wiz.c', 'password-di-c');
  assert.deepEqual(await h.logoRecords('wiz.c'), [], 'Un altro account non riceve nulla.');
  await h.openAccount(); await h.click('[data-account-action="logout"]'); await wait(() => h.has('[data-account-form="login"]'));
  await h.login('wiz.a', 'password-di-a');
  // the logos come down at sign-in, with no catalog opened
  await wait(async () => (await h.logoRecords('wiz.a')).length === 2);
  const down = await h.logoRecords('wiz.a');
  assert.deepEqual(down.map(item => item.sha).sort(), [shaOne, shaTwo].sort(), 'Sul dispositivo B arrivano le stesse immagini (checksum).');
  assert.ok(down.every(item => item.dirty === false));
  // the career online is loaded and the logo is shown next to the party
  await h.openAccount();
  await wait(() => h.has('[data-cloud-load]'));
  const slots = await evaluate(`[...document.querySelectorAll('[data-cloud-load]')].map(el => el.dataset.cloudLoad)`);
  assert.ok(slots.length >= 1);
  await h.click(`[data-cloud-load="${slots[0]}"]`);
  await wait(async () => (await h.has('[data-confirm="ok"]')) || (await h.has('.page-wrap')));
  if (await h.has('[data-confirm="ok"]')) await h.click('[data-confirm="ok"]');
  await wait(() => h.has('.page-wrap'));
  await pause(500);
  const shown = await h.inPage(`
    const { store } = await import('/src/core/store.js?v=${version}'); const L = await import('/src/data/repositories/personal-logos.js?v=${version}');
    const partyId = store.getState().career.partyId; const src = L.resolveLogo(partyId);
    const imgs = [...document.querySelectorAll('img')].filter(img => img.src === src).length;
    return { partyId, src: Boolean(src && src.startsWith('blob:')), imgs };`);
  assert.ok([partyOne, partyTwo].includes(shown.partyId), 'La carriera caricata è quella online.');
  assert.ok(shown.src, 'Il logo del partito è risolto sul dispositivo B.');
  assert.ok(shown.imgs >= 1, 'E si vede accanto al partito nella pagina.');
  // the page restarts with the session already active: nothing is repeated or lost
  const before = rowsOf('wiz.a').map(row => `${row.party_id}|${row.version}|${row.sha256}`);
  await goto('');
  await wait(() => h.has('[data-menu]'));
  await pause(2500);
  assert.deepEqual(rowsOf('wiz.a').map(row => `${row.party_id}|${row.version}|${row.sha256}`), before, 'Riavviare la pagina con la sessione attiva non crea nuove versioni.');
  assert.equal((await h.logoRecords('wiz.a')).length, 2);
  // a change made on device B to a logo it has already synced is a normal update of that logo (same base version): it goes up, once, with no conflict
  await h.inPage(`
    const L = await import('/src/data/repositories/personal-logos.js?v=${version}');
    const canvas = Object.assign(document.createElement('canvas'), { width: 200, height: 200 }); const c = canvas.getContext('2d'); c.fillStyle = '#222'; c.fillRect(0, 0, 200, 200); c.fillStyle = '#ff0'; c.fillRect(50, 50, 80, 80);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    await L.saveLogo(${JSON.stringify(partyOne)}, await L.prepareLogo(new File([blob], 'diverso.png', { type: 'image/png' })));
    await (await import('/src/data/repositories/logo-sync.js?v=${version}')).syncLogos(); return true;`);
  const edited = (await h.logoRecords('wiz.a')).find(item => item.partyId === partyOne);
  assert.notEqual(edited.sha, shaOne); assert.equal(edited.dirty, false);
  assert.equal(rowsOf('wiz.a').find(row => row.party_id === partyOne).sha256, edited.sha, 'La modifica fatta sul dispositivo B, partendo dalla versione sincronizzata, è online.');
  assert.equal(rowsOf('wiz.a').find(row => row.party_id === partyTwo).sha256, shaTwo, 'L’altro logo non è toccato.');
  const conflicts = await h.inPage(`return (await (await import('/src/data/repositories/logo-sync.js?v=${version}')).listLogoConflicts()).map(item => item.partyId);`);
  assert.deepEqual(conflicts, [], 'Nessun conflitto: la base era la stessa. (I conflitti veri, con cloud e dispositivo cambiati, sono in check-logo-sync.)');
  assert.deepEqual(errors.filter(item => !/favicon|ERR_|Failed to load resource/i.test(String(item))), [], 'Nessun errore nella pagina.');
}, { serverPort: 8791, language: 'it' });
await local.close();
console.log('Logo del nuovo partito sincronizzato fra due dispositivi (due profili Chrome, Worker locale): creazione offline con il logo in attesa e avviso, caricamento da solo al ritorno della rete, secondo partito caricato subito, carriera online, nessun logo per un altro account, dispositivo B che scarica i loghi all’accesso e li mostra accanto al partito, riavvio con sessione attiva senza nuove versioni, modifica successiva dal dispositivo B senza conflitti.');
process.exit(0);
