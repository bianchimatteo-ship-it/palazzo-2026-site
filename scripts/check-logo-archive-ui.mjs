// The buttons «Esporta tutti i loghi» and «Importa loghi» of the personal catalog, in Chrome (no account: the guest scope; the archive logic itself is in check-logo-archive.mjs): the export
// downloads one zip with every logo; the import shows what is new, identical and in conflict BEFORE writing, with the choice for the conflicts; a replaced logo can be restored; a file that is not a
// logo archive is refused with a reason; nothing leaves the page. Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Esportazione e importazione dei loghi nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
const IDS = Array.from({ length: 12 }, (_, i) => `party-prova-${String(i + 1).padStart(2, '0')}`);

await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, errors, version }) => {
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ${selector.replace(/'/g, '')}'); el.click(); return true; })()`);
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? ''`);
  const inPage = body => evaluate(`(async () => { ${body} })()`);
  const logos = body => inPage(`const L = await import('/src/data/repositories/personal-logos.js?v=${version}'); ${body}`);
  const closeMenuView = async () => { if (await has('[data-menu-close]')) { await click('.menu-popup-foot [data-menu-close]').catch(() => {}); await pause(150); } };
  const openCatalog = async () => { await closeMenuView(); await wait(() => has('[data-menu="loghi"]')); await click('[data-menu="loghi"]'); await wait(() => has('[data-logo-catalog] [data-logo-archive]')); };
  const records = () => logos(`return (await L.logoStore.all(L.scopeNow())).filter(item => item.blob && !item.deleted).map(item => [item.partyId, item.sha]).sort();`);
  const giveFile = (selector, expression) => evaluate(`(async () => { const file = await (async () => { ${expression} })(); const input = document.querySelector(${JSON.stringify(selector)}); const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);

  await goto('');
  await createCareerInPage({ evaluate, version }, { weeks: 1, name: ['Archivio', 'Loghi'] });
  await goto('');
  // the downloads are caught (no file goes to disk) and every network call is recorded
  await inPage(`window.__downloads = []; window.__net = []; window.__made = new Map();
    const make = URL.createObjectURL.bind(URL); URL.createObjectURL = blob => { const href = make(blob); window.__made.set(href, blob); return href; };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__downloads.push({ name: this.download, blob: window.__made.get(this.href) }); return; } return click.call(this); };
    const realFetch = window.fetch; window.fetch = (input, init) => { window.__net.push(String(input?.url ?? input)); return realFetch(input, init); };`);
  // twelve logos in the catalog, made in the page like a player's images
  await logos(`
    for (let n = 0; n < 12; n++) {
      const canvas = Object.assign(document.createElement('canvas'), { width: 120 + n, height: 90 }); const c = canvas.getContext('2d'); c.fillStyle = 'hsl(' + (n * 29) + ', 70%, 45%)'; c.fillRect(0, 0, canvas.width, canvas.height); c.fillStyle = '#fff'; c.fillRect(10, 10, 30, 30);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await L.saveLogo(${JSON.stringify(IDS)}[n], await L.prepareLogo(new File([blob], 'logo-' + n + '.png', { type: 'image/png' })), { fileName: 'logo-' + n + '.png' });
    }
    return true;`);
  const original = await records();
  assert.equal(original.length, 12);
  await openCatalog();
  assert.ok(await has('[data-action="logo-export"]:not([disabled])') && await has('[data-logo-import-file]'), 'Ci sono i due pulsanti, «Esporta tutti i loghi» e «Importa loghi».');
  assert.match(await text('[data-logo-archive]'), /Esporta tutti i loghi[\s\S]*Importa loghi/);

  // ---------- export ----------
  await click('[data-action="logo-export"]');
  await wait(() => has('[data-logo-archive-notice]'));
  assert.match(await text('[data-logo-archive-notice]'), /Esportati 12 loghi in loghi-politicando-\d{4}-\d{2}-\d{2}\.zip/);
  await wait(() => evaluate('window.__downloads.length === 1'));
  const zipInfo = await inPage(`const { readZip } = await import('/src/data/repositories/logo-archive.js?v=${version}'); const d = window.__downloads[0]; const entries = await readZip(new Uint8Array(await d.blob.arrayBuffer())); const manifest = JSON.parse(new TextDecoder().decode(entries.get('manifest.json'))); return { name: d.name, type: d.blob.type, files: entries.size, count: manifest.count, ids: manifest.logos.map(item => item.partyId).sort() };`);
  assert.equal(zipInfo.type, 'application/zip'); assert.equal(zipInfo.files, 13); assert.equal(zipInfo.count, 12); assert.deepEqual(zipInfo.ids, IDS, 'Lo ZIP ha tutti i loghi con gli ID originali.');

  // ---------- change the catalog, then import the archive: new, identical and conflicts are shown before anything is written ----------
  await logos(`
    await L.deleteLogo(${JSON.stringify(IDS[0])});
    await L.deleteLogo(${JSON.stringify(IDS[1])});
    const canvas = Object.assign(document.createElement('canvas'), { width: 100, height: 100 }); const c = canvas.getContext('2d'); c.fillStyle = '#123456'; c.fillRect(0, 0, 100, 100); c.fillStyle = '#fed'; c.fillRect(30, 30, 20, 20);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    for (const id of ${JSON.stringify([IDS[2], IDS[3], IDS[4]])}) await L.saveLogo(id, await L.prepareLogo(new File([blob], 'altro.png', { type: 'image/png' })), { fileName: 'altro.png' });
    return true;`);
  const changed = await records();
  await openCatalog();
  await giveFile('[data-logo-import-file]', `return new File([window.__downloads[0].blob], window.__downloads[0].name, { type: 'application/zip' });`);
  await wait(() => has('[data-logo-import-plan]'));
  const summary = await text('[data-logo-import-summary]');
  assert.match(summary, /12 loghi · 2 nuovi · 7 già presenti identici · 3 in conflitto · 0 non validi/, `Il riepilogo prima di importare: ${summary}`);
  assert.deepEqual(await records(), changed, 'Aprire l’archivio non scrive nulla.');
  assert.equal(await evaluate(`document.querySelectorAll('[data-logo-import-row]').length`), 3, 'I tre conflitti sono elencati, con la scelta per ciascuno.');
  assert.ok(await has('[data-logo-import-policy] input[value="keep"]:checked'), 'La scelta predefinita è mantenere quelli che hai.');
  // keep the existing for the policy, replace one of them by choice
  await evaluate(`(() => { const select = document.querySelector('[data-logo-import-decision="${IDS[2]}"]'); select.value = 'replace'; select.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await click('[data-action="logo-import-apply"]');
  await wait(() => has('[data-logo-import-result]'));
  assert.match(await text('[data-logo-import-result]'), /Importati 2, sostituiti 1, mantenuti 2, saltati 0, già presenti 7, non validi 0, non riusciti 0/);
  const after = await records();
  assert.equal(after.length, 12, 'Ora ci sono tutti i dodici loghi.');
  const byId = Object.fromEntries(after), orig = Object.fromEntries(original), chg = Object.fromEntries(changed);
  assert.equal(byId[IDS[0]], orig[IDS[0]]); assert.equal(byId[IDS[1]], orig[IDS[1]]);
  assert.equal(byId[IDS[2]], orig[IDS[2]], 'Il logo scelto per la sostituzione è quello importato.');
  assert.equal(byId[IDS[3]], chg[IDS[3]]); assert.equal(byId[IDS[4]], chg[IDS[4]], 'Gli altri conflitti restano come erano.');
  // restore the replaced one
  await wait(() => has('[data-action="logo-restore-replaced"]'));
  await click('[data-action="logo-restore-replaced"]');
  await wait(async () => /1 loghi ripristinati/.test(await text('[data-logo-archive-notice]')));
  assert.equal(Object.fromEntries(await records())[IDS[2]], chg[IDS[2]], 'Il ripristino rimette il logo di prima.');
  // the same file again: nothing is new
  await giveFile('[data-logo-import-file]', `return new File([window.__downloads[0].blob], 'di-nuovo.zip', { type: 'application/zip' });`);
  await wait(async () => /di-nuovo\.zip/.test(await text('[data-logo-import-summary]')));
  assert.match(await text('[data-logo-import-summary]'), /0 nuovi/);
  await click('[data-action="logo-import-cancel"]');
  assert.ok(!(await has('[data-logo-import-plan]')), 'Si chiude il riepilogo senza cambiare nulla.');

  // ---------- a file that is not an archive ----------
  await giveFile('[data-logo-import-file]', `return new File([new Uint8Array(400).fill(7)], 'sbagliato.zip', { type: 'application/zip' });`);
  await wait(() => has('[data-logo-archive-error]'));
  assert.match(await text('[data-logo-archive-error]'), /ZIP valido/, 'Un file che non è uno ZIP è rifiutato con il motivo.');
  const net = await evaluate('window.__net');
  assert.equal(net.filter(url => /logo/i.test(url) && /api\/logos/.test(url)).length, 0, 'Senza account nessuna richiesta di rete per i loghi.');
  assert.deepEqual(errors.filter(item => !/favicon|ERR_|Failed to load resource/i.test(String(item))), [], 'Nessun errore nella pagina.');
});
console.log('Esportazione e importazione dei loghi nel browser verificate: pulsanti nel catalogo, un solo ZIP con tutti i loghi, riepilogo prima di importare (nuovi, identici, conflitti) con scelta per ciascuno, sostituito recuperabile, file non valido rifiutato, nessuna richiesta di rete senza account.');
