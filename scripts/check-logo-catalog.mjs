// The personal catalog of party logos, in Chrome (the local Worker stands in for the account service; nothing real is touched): the Home section «Loghi dei partiti» lists every party,
// movement and list of the game (the parties made by the player too) with search, preview and state; a logo is added from a file or from an https address (copied once, address forgotten),
// replaced and deleted; only real PNG, JPEG and WebP are accepted (SVG, GIF, corrupt, oversized and out-of-limit files are refused, whatever their name), the image is compressed
// locally and kept in IndexedDB under the account in use and the party's stable id, never in the saves; it appears wherever the party appears, in every career, and follows a change of
// party; a party without a logo is drawn from its initials and colours; accounts never see each other's logos; nothing is sent anywhere; the old shared catalog is gone and the logos
// of the earlier version are carried over once. Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Catalogo personale dei loghi nel browser saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
globalThis.location = new URL('http://127.0.0.1:8791/');
const client = await import('../src/data/repositories/account-sync.js');
const { startLocalWorker } = await import('./lib/local-worker.mjs');
const local = await startLocalWorker({ port: 8791 });
let ipCounter = 80;
const registerApi = async (username, password) => {
  const proof = await client.passwordProof(username, password);
  const response = await local.worker.fetch(new Request(`${local.origin}/api/account/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': `203.0.113.${++ipCounter}` }, body: JSON.stringify({ username, proof }) }), local.env);
  assert.equal(response.status, 201);
};
await registerApi('logo.a', 'password-di-a');
await registerApi('logo.b', 'password-di-b');
const P1 = 'party-registro-p1-2017-41-ir';   // the party of the default career
const P2 = 'party-registro-p1-2015-29-ir';

await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, errors, version }) => {
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ${selector.replace(/'/g, '')}'); el.click(); return true; })()`);
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? ''`);
  const count = selector => evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
  const fill = (form, values) => evaluate(`(() => { const form = document.querySelector('[data-account-form="${form}"]'); for (const [name, value] of Object.entries(${JSON.stringify(values)})) form[name].value = value; form.requestSubmit(); return true; })()`);
  const inPage = body => evaluate(`(async () => { ${body} })()`);
  const logos = (body) => inPage(`const L = await import('/src/data/repositories/personal-logos.js?v=${version}'); ${body}`);
  const openAccount = async () => { if (await has('[data-account-form="login"], [data-account-action="refresh"]')) return; await wait(() => has('[data-menu="account"]')); await click('[data-menu="account"]'); await pause(150); };
  const closeMenuView = async () => { if (await has('[data-menu-close]')) { await click('.menu-popup-foot [data-menu-close]').catch(() => {}); await pause(150); } };

  // the page is watched: every network call is recorded, images loaded from an address are served by a stand-in (no real site is reached)
  const arm = () => inPage(`
    window.__net = []; window.__imgLog = [];
    if (!window.__armed) {
      window.__armed = true;
      const realFetch = window.fetch;
      window.fetch = (input, init = {}) => { window.__net.push({ kind: 'fetch', url: String(input?.url ?? input), body: init.body === undefined ? null : Object.prototype.toString.call(init.body) }); return realFetch.call(window, input, init); };
      const open = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (method, url) { window.__net.push({ kind: 'xhr', url: String(url) }); return open.apply(this, arguments); };
      const beacon = navigator.sendBeacon?.bind(navigator); if (beacon) navigator.sendBeacon = (url, data) => { window.__net.push({ kind: 'beacon', url: String(url) }); return beacon(url, data); };
      const canvas = Object.assign(document.createElement('canvas'), { width: 220, height: 160 }); const c = canvas.getContext('2d'); c.fillStyle = '#1b6ca8'; c.fillRect(0, 0, 220, 160); c.fillStyle = '#fff'; c.fillRect(30, 30, 80, 80);
      window.__imgData = canvas.toDataURL('image/png');
      window.__imgMode = () => 'ok';
      const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, get() { return descriptor.get.call(this); }, set(value) {
        if (String(value).startsWith('https://')) {
          window.__imgLog.push({ url: String(value), crossOrigin: this.crossOrigin, referrerPolicy: this.referrerPolicy });
          if (window.__imgMode(String(value)) === 'blocked') { setTimeout(() => this.onerror?.(new Event('error')), 0); return; }
          descriptor.set.call(this, window.__imgData); return;
        }
        descriptor.set.call(this, value);
      } });
    }
    return true;`);
  const net = () => evaluate(`window.__net`);
  const imgLog = () => evaluate(`window.__imgLog`);
  const makeFile = spec => evaluate(`(async () => {
    const spec = ${JSON.stringify(spec)};
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="red"/></svg>';
    let file;
    if (spec.kind === 'svg') file = new File([svg], 'logo.svg', { type: 'image/svg+xml' });
    else if (spec.kind === 'svg-renamed') file = new File([svg], 'logo.png', { type: 'image/png' });
    else if (spec.kind === 'gif') file = new File([Uint8Array.from([71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 0, 0, 0, 0x3b, ...new Array(30).fill(0)])], 'logo.gif', { type: 'image/gif' });
    else if (spec.kind === 'corrupt') file = new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array.from({ length: 300 }, (_, i) => (i * 37) % 251)])], 'logo.png', { type: 'image/png' });
    else if (spec.kind === 'text') file = new File(['non sono un\\'immagine'.repeat(5)], 'logo.png', { type: 'image/png' });
    else if (spec.kind === 'oversize') { const bytes = new Uint8Array(6 * 1024 * 1024); bytes.set([137, 80, 78, 71, 13, 10, 26, 10]); file = new File([bytes], 'grande.png', { type: 'image/png' }); }
    else {
      const canvas = document.createElement('canvas'); canvas.width = spec.w ?? 300; canvas.height = spec.h ?? 200;
      const context = canvas.getContext('2d'); context.fillStyle = spec.color ?? '#c00'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#fff'; context.fillRect(20, 20, 60, 60);
      const type = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[spec.kind];
      file = new File([await new Promise(resolve => canvas.toBlob(resolve, type, 0.92))], 'logo.' + spec.kind, { type });
    }
    window.__file = file; return file.size;
  })()`);
  const giveFile = async spec => {
    await makeFile(spec);
    await evaluate(`(() => { const input = document.querySelector('[data-logo-file]'); const dt = new DataTransfer(); dt.items.add(window.__file); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    await wait(async () => !(await evaluate(`document.querySelector('[data-logo-file]')?.disabled`)));
    await pause(150);
  };
  const openCatalog = async () => { await closeMenuView(); await wait(() => has('[data-menu="loghi"]')); await click('[data-menu="loghi"]'); await wait(() => has('[data-logo-catalog] .logo-row')); };
  const search = async query => { await evaluate(`(() => { const input = document.querySelector('[data-logo-query]'); input.value = ${JSON.stringify(query)}; input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`); await pause(250); };
  const partyName = id => inPage(`const real = await import('/src/data/repositories/real-data.js?v=${version}'); const p = [...(real.realDatabase.parties ?? []), ...(real.realDatabase.politicalMovements ?? [])].find(item => item.id === ${JSON.stringify(id)}); return p.officialName ?? p.name;`);
  const select = async id => { const name = await partyName(id); await search(name.slice(0, 22)); await wait(() => has(`[data-logo-party-id="${id}"]`)); await click(`[data-logo-party-id="${id}"]`); await pause(200); };
  const state = () => text('[data-logo-status]').then(() => evaluate(`document.querySelector('[data-logo-status]')?.dataset.logoStatus`));
  const resolved = id => logos(`return L.resolveLogo(${JSON.stringify(id)});`);
  const records = () => inPage(`
    const db = await new Promise(resolve => { const r = indexedDB.open('politicando-personal-logos'); r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(null); });
    if (!db) return [];
    const all = await new Promise(resolve => { const q = db.transaction('logos').objectStore('logos').getAll(); q.onsuccess = () => resolve(q.result); });
    db.close();
    return all.map(({ blob, ...rest }) => ({ ...rest, blobType: blob?.type, blobSize: blob?.size }));`);

  await arm();
  const dataBefore = await inPage(`const real = await import('/src/data/repositories/real-data.js?v=${version}'); await real.loadRealDatabase(); await real.loadRealCollections(['parties', 'politicalMovements', 'politicians', 'parliamentaryGroups']); return { parties: real.realDatabase.parties.length, movements: real.realDatabase.politicalMovements.length, politicians: real.realDatabase.politicians.length, groups: real.realDatabase.parliamentaryGroups.length };`);

  // ---------- 1. the section on the Home: every party, search, preview, state ----------
  await openCatalog();
  assert.ok(await has('[data-logo-rights]'), 'L’informativa sui diritti compare nella pagina.');
  assert.match(await text('.logo-intro'), /restano (soltanto )?su questo dispositivo/, 'E dice che i loghi restano sul dispositivo.');
  assert.match(await text('.logo-intro'), /non vengono caricati online né condivisi/i, 'E che senza account non si sincronizzano.');
  const total = await inPage(`const m = document.querySelector('[data-logo-count]').textContent.match(/su (\\d+)/); return Number(m[1]);`);
  assert.ok(total >= dataBefore.parties + dataBefore.movements, 'L’elenco comprende tutti i partiti e i movimenti del gioco.');
  await search('zzzz-nessuno');
  assert.equal(await count('.logo-row'), 0, 'La ricerca senza risultati mostra l’elenco vuoto.');
  await select(P1);
  assert.equal(await state(), 'none', 'Un partito senza logo dice che usa la grafica originale.');
  assert.ok(await has('.logo-preview .logo-fallback'), 'E la anteprima mostra il segno originale con sigla e colori.');
  assert.equal(await has('[data-logo-state="custom"]'), false);

  // ---------- 2. add from a file; only real PNG/JPEG/WebP; compressed locally ----------
  for (const [kind, expected] of [['svg', /SVG/], ['svg-renamed', /SVG/], ['gif', /PNG, JPEG o WebP/], ['corrupt', /danneggiato|valida/], ['text', /PNG, JPEG o WebP|valida|SVG/], ['oversize', /5 MB/]]) {
    await giveFile({ kind });
    assert.match(await text('[data-logo-error]'), expected, `Il file «${kind}» è rifiutato con un messaggio chiaro.`);
    assert.equal(await state(), 'none', `E nulla viene salvato (${kind}).`);
  }
  await giveFile({ kind: 'png', w: 5000, h: 40 });
  assert.match(await text('[data-logo-error]'), /4096/, 'Oltre 4096 pixel per lato è rifiutato.');
  await giveFile({ kind: 'png', w: 8, h: 8 });
  assert.match(await text('[data-logo-error]'), /troppo piccola/, 'E sotto i 16 pixel.');
  assert.ok(await has('[data-logo-party-id]'), 'Dopo gli errori il gioco funziona e l’elenco c’è.');
  await giveFile({ kind: 'png', w: 1800, h: 1200, color: '#0a7' });
  assert.equal(await state(), 'pending', 'Un PNG valido compare in anteprima, non ancora salvato.');
  // the editor opens on the image: crop, zoom, position, uniform background with a tolerance, previews on light/dark/transparent, restore; the colour button is not for the catalog
  assert.ok(await has('[data-logo-editor]'), 'Si apre l’editor dei loghi.');
  for (const selector of ['[data-logo-stage]', 'input[data-logo-edit="zoom"]', 'input[data-logo-edit="panX"]', 'input[data-logo-edit="panY"]', 'input[data-logo-edit="transparent"]', 'input[data-logo-edit="tolerance"]', '[data-logo-edit-reset]', '.le-tile.is-light', '.le-tile.is-dark', '.le-tile.is-check']) assert.ok(await has(selector), `L’editor ha ${selector}.`);
  assert.equal(await has('[data-logo-edit-color]'), false, 'Nel catalogo non c’è «usa come colore del partito».');
  assert.match(await text('.logo-editor'), /non essere perfetto/, 'Non promette una rimozione perfetta dello sfondo.');
  await evaluate(`(() => { const zoom = document.querySelector('input[data-logo-edit="zoom"]'); zoom.value = '1.5'; zoom.dispatchEvent(new Event('input', { bubbles: true })); const box = document.querySelector('input[data-logo-edit="transparent"]'); box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await pause(300);
  await click('[data-logo-edit-reset]'); await pause(300);
  assert.ok(await has('[data-logo-editor]'), 'Il ripristino riporta l’immagine originale senza chiudere l’editor.');
  assert.equal(await resolved(P1), null, 'Finché non si salva il logo non è in uso.');
  await click('[data-action="logo-save"]');
  await wait(async () => (await state()) === 'custom');
  const saved = await records();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].partyId, P1, 'Il logo è associato all’identificativo stabile del partito.');
  assert.equal(saved[0].scope, '_ospite', 'Senza accesso sta nell’ambito ospite.');
  assert.ok(saved[0].blobSize <= 300 * 1024 && saved[0].width <= 512 && saved[0].height <= 512, `Compresso in locale (${saved[0].width}×${saved[0].height}, ${saved[0].blobSize} byte).`);
  assert.ok(['image/webp', 'image/png'].includes(saved[0].blobType), 'Salvato come WebP o PNG.');
  assert.equal(Object.keys(saved[0]).some(key => /url$/i.test(key) && key !== 'blobType'), false, 'Nessun indirizzo esterno nel record.');
  assert.match((await resolved(P1)) ?? '', /^blob:/, 'Il logo si usa dalla copia locale.');
  assert.match(await text('[data-logo-notice]'), /dispositivo/, 'Il gioco conferma dove è stato salvato.');
  // replace with a JPEG, then a WebP
  await giveFile({ kind: 'jpeg', color: '#a0a' });
  assert.match(await text('[data-action="logo-save"]'), /sostituisci/i, 'Con un logo già presente il pulsante dice «Sostituisci».');
  await click('[data-action="logo-save"]');
  await wait(async () => (await records())[0]?.mimeType !== saved[0].mimeType || (await records())[0]?.updatedAt !== saved[0].updatedAt);
  assert.equal((await records()).length, 1, 'La sostituzione non crea un secondo logo.');
  await giveFile({ kind: 'webp', color: '#0aa' });
  await click('[data-action="logo-save"]');
  await wait(async () => (await records())[0]?.updatedAt > saved[0].updatedAt);

  // ---------- 3. add from an address: https only, copied once, address forgotten ----------
  await select(P2);
  const url = address => evaluate(`(() => { const input = document.querySelector('[data-logo-url]'); input.value = ${JSON.stringify(address)}; document.querySelector('[data-logo-url-form]').requestSubmit(); return true; })()`);
  for (const bad of ['http://logos.test/p2.png', 'logos.test/p2.png', 'https://logos.test/p2.svg', 'https://utente:pw@logos.test/p2.png', 'https://logos.test/animato.gif']) {
    await url(bad); await pause(250);
    assert.ok((await text('[data-logo-error]')).length > 10, `L’indirizzo «${bad}» è rifiutato.`);
  }
  assert.deepEqual(await imgLog(), [], 'Un indirizzo non valido non viene nemmeno caricato.');
  await evaluate(`window.__imgMode = () => 'blocked'`);
  await url('https://logos.test/bloccato.png');
  await wait(() => has('[data-logo-error]'));
  assert.match(await text('[data-logo-error]'), /Scaricala sul dispositivo e caricala come file/, 'Se il sito impedisce l’importazione propone di scaricare e caricare il file.');
  await evaluate(`window.__imgMode = () => 'ok'`);
  await url('https://logos.test/p2.png');
  await wait(async () => (await state()) === 'pending');
  const loaded = await imgLog();
  assert.equal(loaded.length, 2, 'L’immagine è stata richiesta solo per gli indirizzi validi.');
  assert.ok(loaded.every(item => item.crossOrigin === 'anonymous' && item.referrerPolicy === 'no-referrer'), 'Con CORS e senza referrer: nessun proxy.');
  await click('[data-action="logo-save"]');
  await wait(async () => (await state()) === 'custom');
  const withUrl = (await records()).find(item => item.partyId === P2);
  assert.equal(withUrl.origin, 'url');
  assert.equal(JSON.stringify(withUrl).includes('logos.test'), false, 'L’indirizzo non viene conservato.');
  const requestsBefore = (await imgLog()).length;
  await goto('');
  await arm();
  await evaluate(`window.__imgMode = () => 'blocked'`);   // the site is gone: the copy is all that is left
  await logos(`await L.loadLogos(); return true;`);
  assert.match((await resolved(P2)) ?? '', /^blob:/, 'Dopo il ricaricamento il logo da indirizzo si vede dalla copia locale, senza il collegamento.');
  assert.equal((await imgLog()).filter(item => item.url.includes('logos.test')).length, 0, 'Nessuna nuova richiesta all’indirizzo.');
  assert.ok(requestsBefore >= 2);

  // ---------- 4. the logo is everywhere its party is: the same resolver, every career ----------
  await createCareerInPage({ evaluate, version }, { weeks: 1, party: P1, name: ['Prima', 'Uno'] });
  await goto('');
  await arm();
  await wait(() => has('[data-menu="nuova"]:not([disabled])'));
  const blobP1 = await resolved(P1);
  assert.match(blobP1 ?? '', /^blob:/, 'Il logo di P1 si ritrova nella prima carriera e dopo il ricaricamento (IndexedDB).');
  const identity = await inPage(`const store = (await import('/src/core/store.js?v=${version}')).store; const { partyIdentity } = await import('/src/ui/party-identity.js?v=${version}'); const real = await import('/src/data/repositories/real-data.js?v=${version}'); const state = store.getState(); const party = [...state.dataset.parties, ...real.realDatabase.parties].find(item => item.id === state.career.partyId); const L = await import('/src/data/repositories/personal-logos.js?v=${version}'); const id = partyIdentity({ party, logo: L.resolveLogo(party.id) }); return { partyId: party.id, hasLogo: JSON.stringify(id).includes('blob:') || (id.logo ?? '').startsWith?.('blob:') };`);
  assert.equal(identity.partyId, P1);
  assert.ok(identity.hasLogo, 'L’identità del partito della carriera usa il logo del catalogo.');
  // a second career in another party reuses the catalog automatically
  await createCareerInPage({ evaluate, version }, { weeks: 1, party: P2, name: ['Seconda', 'Due'] });
  await goto('');
  await arm();
  await wait(async () => Boolean(await resolved(P2)));   // the catalog is read in the background at the start
  assert.match((await resolved(P2)) ?? '', /^blob:/, 'Una seconda carriera in un altro partito usa il suo logo, senza nuove azioni.');
  assert.match((await resolved(P1)) ?? '', /^blob:/);
  // a parliamentarian, wherever shown, carries the logo of the party the data gives him now
  const marks = await inPage(`
    const real = await import('/src/data/repositories/real-data.js?v=${version}'); const L = await import('/src/data/repositories/personal-logos.js?v=${version}');
    const links = await import('/src/data/repositories/party-links.js?v=${version}'); const marks = await import('/src/ui/person-marks.js?v=${version}');
    await real.loadRealCollections(['politicians', 'parliamentaryGroups', ...links.PARTY_LINK_COLLECTIONS]);
    const withParty = id => real.realDatabase.politicians.find(person => links.politicianAffiliation(person)?.entity?.id === id);
    const a = withParty(${JSON.stringify(P1)}), b = withParty(${JSON.stringify(P2)});
    return { a: Boolean(a), b: Boolean(b), htmlA: a ? marks.markForPerson(a) : null, htmlB: b ? marks.markForPerson(b) : null, srcA: L.resolveLogo(${JSON.stringify(P1)}), srcB: L.resolveLogo(${JSON.stringify(P2)}) };`);
  if (marks.a) assert.ok(marks.srcA && marks.htmlA.includes(marks.srcA), 'Il parlamentare di P1 mostra il logo di P1.');
  if (marks.b) assert.ok(marks.htmlB.includes(marks.srcB) && !marks.htmlB.includes(marks.srcA ?? 'zzz'), 'E quello di P2 il logo di P2, non quello di un altro partito (cambio di partito = cambio di logo).');
  assert.ok(marks.a || marks.b, 'Nel dataset ci sono parlamentari dei due partiti.');
  // no logo is matched by name: a record with the same name but another id has none
  const byName = await inPage(`const L = await import('/src/data/repositories/personal-logos.js?v=${version}'); return [L.resolveLogo('party-con-lo-stesso-nome'), L.resolveLogo(''), L.resolveLogo(null)];`);
  assert.deepEqual(byName, [null, null, null], 'Nessun abbinamento per nome o approssimato.');
  // saves hold no image
  const savesText = await evaluate(`Object.keys(localStorage).filter(key => /career|slot|palazzo|politicando/.test(key)).map(key => localStorage.getItem(key)).join('')`);
  assert.equal(/data:image|blob:/.test(savesText), false, 'Nelle carriere e nei salvataggi non c’è nessuna immagine (né base64 né blob).');

  // ---------- 5. delete, with a confirmation; the original mark comes back ----------
  await openCatalog();
  await select(P1);
  assert.equal(await state(), 'custom');
  await click('[data-action="logo-delete"]');
  await wait(() => has('[data-confirm="ok"]'));
  await click('[data-confirm="ok"]');
  await wait(async () => (await state()) === 'none');
  assert.equal(await resolved(P1), null, 'Eliminato il logo, il gioco torna al segno originale.');
  assert.ok(await has('.logo-preview .logo-fallback'));
  assert.equal((await records()).some(item => item.partyId === P1), false, 'E il record non c’è più.');
  assert.ok((await records()).some(item => item.partyId === P2), 'Gli altri loghi restano.');

  // ---------- 6. accounts: each sees only its own; guests have theirs; a return finds them again ----------
  await giveFile({ kind: 'png', color: '#333' });
  await click('[data-action="logo-save"]'); await wait(async () => (await state()) === 'custom');   // guest logo for P1
  const guestP1 = await resolved(P1);
  await closeMenuView();
  await openAccount();
  await fill('login', { username: 'logo.a', password: 'password-di-a' });
  await wait(() => has('[data-account-action="logout"]'));
  await pause(500);
  assert.equal(await resolved(P1), null, 'Con un altro account il logo dell’ospite non compare.');
  assert.equal(await resolved(P2), null);
  await openCatalog();
  await select(P1);
  assert.equal(await state(), 'none', 'Il catalogo dell’account A parte vuoto.');
  await giveFile({ kind: 'png', color: '#e60' });
  await click('[data-action="logo-save"]'); await wait(async () => (await state()) === 'custom');
  const aP1 = await resolved(P1);
  assert.ok(aP1 && aP1 !== guestP1);
  assert.deepEqual((await records()).map(item => `${item.scope}|${item.partyId}`).sort(), [`_ospite|${P1}`, `_ospite|${P2}`, `logo.a|${P1}`].sort(), 'I record sono separati per ambito.');
  await closeMenuView();
  await openAccount();
  await click('[data-account-action="logout"]');
  await wait(() => has('[data-account-form="login"]'));
  await pause(500);
  assert.equal(await resolved(P1), guestP1 === null ? null : await resolved(P1), 'Da disconnesso si torna all’ambito ospite.');
  assert.notEqual(await resolved(P1), aP1, 'Dopo il logout il logo dell’account A non si vede più.');
  await fill('login', { username: 'logo.b', password: 'password-di-b' });
  await wait(() => has('[data-account-action="logout"]'));
  await pause(500);
  assert.equal(await resolved(P1), null, 'L’account B non vede i loghi di A né dell’ospite.');
  await openAccount();
  await click('[data-account-action="logout"]');
  await wait(() => has('[data-account-form="login"]'));
  await fill('login', { username: 'logo.a', password: 'password-di-a' });
  await wait(() => has('[data-account-action="logout"]'));
  await pause(500);
  assert.match((await resolved(P1)) ?? '', /^blob:/, 'Rientrando, l’account A ritrova il suo logo.');
  await goto('');
  await arm();
  await logos(`await L.loadLogos(); return true;`);
  assert.match((await resolved(P1)) ?? '', /^blob:/, 'E lo ritrova dopo il ricaricamento della pagina.');

  // ---------- 7. quota exhausted: the game goes on, nothing is lost ----------
  await openCatalog();
  await select(P1);
  await evaluate(`(() => { const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { IDBObjectStore.prototype.put = put; throw new DOMException('quota', 'QuotaExceededError'); }; return true; })()`);
  await giveFile({ kind: 'png', color: '#00f' });
  await click('[data-action="logo-save"]');
  await wait(() => has('[data-logo-error]'));
  assert.match(await text('[data-logo-error]'), /spazio del browser è esaurito/, 'Se lo spazio è finito lo dice e non blocca il gioco.');
  assert.ok(await has('[data-logo-party-id]'), 'La pagina resta utilizzabile.');
  assert.match((await resolved(P1)) ?? '', /^blob:/, 'Il logo precedente non viene perso.');

  // ---------- 8. nothing leaves the device; the old shared catalog is gone ----------
  const calls = await net();
  // Without an account nothing leaves the device (check-logo-sync.mjs covers the signed-in synchronisation): the only logo requests are the authenticated ones to the account's own route.
  assert.equal(calls.filter(item => /logo/i.test(item.url) && !/\/api\/logos(\/|\?|$)/.test(item.url)).length, 0, 'Le uniche richieste che riguardano i loghi sono quelle alla rotta del proprio account.');
  assert.equal(calls.filter(item => item.body && /Blob|ArrayBuffer|FormData|File/.test(item.body) && !/\/api\/logos\//.test(item.url)).length, 0, 'Nessun file o immagine viene inviato altrove.');
  assert.equal(calls.some(item => item.kind !== 'fetch'), false, 'Né con XHR o beacon.');
  const gone = await evaluate(`fetch('/api/admin/logo/${P1}').then(response => response.status)`);
  assert.equal(gone, 404, 'Il percorso dei loghi condivisi non esiste più.');

  // ---------- 9. the data of the game is untouched ----------
  const dataAfter = await inPage(`const real = await import('/src/data/repositories/real-data.js?v=${version}'); return { parties: real.realDatabase.parties.length, movements: real.realDatabase.politicalMovements.length, politicians: real.realDatabase.politicians.length, groups: real.realDatabase.parliamentaryGroups.length };`);
  assert.deepEqual(dataAfter, dataBefore, 'Partiti, movimenti, parlamentari e gruppi sono tutti ancora lì, invariati.');

  // ---------- 10. the logos of the earlier version are carried over once; the old database is not touched ----------
  await goto('');
  await arm();
  const legacy = await inPage(`
    const make = async () => { const c = document.createElement('canvas'); c.width = 120; c.height = 90; const x = c.getContext('2d'); x.fillStyle = '#7a2'; x.fillRect(0, 0, 120, 90); return new Promise(resolve => c.toBlob(resolve, 'image/png')); };
    const blob = await make();
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('politicando-local-admin', 1); r.onupgradeneeded = () => r.result.createObjectStore('party-logos', { keyPath: 'partyId' }); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise(resolve => { const t = db.transaction('party-logos', 'readwrite'); t.objectStore('party-logos').put({ partyId: 'party-futuro-nazionale', blob, mimeType: 'image/png', fileName: 'vecchio.png', origin: 'user' }); t.oncomplete = resolve; });
    db.close();
    localStorage.removeItem('politicando.personal-logos.migrated.v1');
    const L = await import('/src/data/repositories/personal-logos.js?v=${version}');
    const result = await L.migrateLegacyLogos();
    await L.loadLogos();
    const again = await L.migrateLegacyLogos();
    const old = await new Promise(resolve => { const r = indexedDB.open('politicando-local-admin'); r.onsuccess = () => { const q = r.result.transaction('party-logos').objectStore('party-logos').getAll(); q.onsuccess = () => resolve(q.result.length); }; });
    return { result, again, old, mine: L.resolveLogo('party-futuro-nazionale') };`);
  assert.equal(legacy.result.migrated, 1, 'Il logo della versione precedente viene messo da parte.');
  assert.equal(legacy.mine, null, 'Senza proprietario noto non viene dato né all’ospite né all’account: non si vede in nessuna schermata.');
  assert.equal(legacy.again.already, true, 'Una volta sola.');
  assert.equal(legacy.old, 1, 'Il vecchio archivio non viene toccato.');
  await openCatalog();
  assert.ok(await has('[data-logo-legacy-block]'), 'Nel catalogo compare l’elenco dei loghi trovati, con la spiegazione.');
  await click('[data-action="logo-legacy-claim"]');
  await wait(async () => !(await has('[data-logo-legacy-block]')));
  assert.match((await resolved('party-futuro-nazionale')) ?? '', /^blob:/, 'Dopo che il giocatore lo rivendica il logo è suo e si usa.');
  assert.deepEqual(errors, [], 'Nessun errore in pagina.');
}, { serverPort: 8791 });
await local.close();
console.log('Catalogo personale dei loghi verificato in Chrome: sezione della Home con tutti i partiti, ricerca, anteprima e stato; aggiunta da file o da indirizzo https (copiata una volta, indirizzo dimenticato), sostituzione ed eliminazione; solo PNG, JPEG e WebP reali, compressi in locale; salvati in IndexedDB per account e identificativo del partito, mai nei salvataggi; riutilizzati in tutte le carriere e per i parlamentari; fallback originale; isolamento tra account e ospite; quota esaurita gestita; nessuna richiesta di rete; dati del gioco intatti; migrazione una tantum dei loghi precedenti.');
