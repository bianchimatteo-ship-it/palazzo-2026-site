// La fondazione di un partito con logo caricato, nel browser (Chrome): file validato, anteprima, un file non valido rifiutato con il motivo, il logo va nel catalogo personale con l'id del nuovo partito subito alla fondazione e resta dopo il ricaricamento.
import assert from 'node:assert/strict';
import { withBrowser, createCareerInPage, openCareer, chromeAvailable } from './lib/browser.mjs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (!chromeAvailable) { console.log('Fondazione con logo nel browser saltata: Chrome non trovato (imposta CHROME_PATH).'); process.exit(0); }
// a small valid PNG (written here) and a file that is not an image
const crc = (() => { const table = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } return buf => { let c = 0xffffffff; for (const byte of buf) c = table[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]); const out = Buffer.alloc(8 + data.length + 4); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), 8 + data.length); return out; };
const { deflateSync } = await import('node:zlib');
const png = (w, h) => { const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [40, 120, 200, 255]).flat())]))); const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head.set([8, 6, 0, 0, 0], 8); return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); };
const good = join(tmpdir(), 'politicando-logo-ok.png'), bad = join(tmpdir(), 'politicando-logo-bad.png');
await writeFile(good, png(64, 64)); await writeFile(bad, Buffer.from('questo non è un file immagine, sono solo parole'));

await withBrowser(async ({ evaluate, send, goto, waitFor: wait, pause, viewport, version }) => {
  await viewport(1280, 900, false);
  await createCareerInPage({ evaluate, version }, { level: 'deputato', weeks: 3, name: ['Anna', 'Bianchi'], region: 'Lombardia', extra: `Object.assign(store.getState().game.resources, { funds: 500000, politicalCapital: 99 });` });
  await openCareer({ evaluate, goto, waitFor: wait }); await pause(1200);
  await evaluate(`location.hash = '#partito'; true`); await pause(900);
  await evaluate(`[...document.querySelectorAll('[data-section-tab]')].find(b => b.dataset.sectionTabValue === 'vita')?.click(); true`); await pause(700);
  await evaluate(`document.querySelectorAll('details').forEach(d => d.setAttribute('open', '')); true`); await pause(400);
  const setFile = async path => { const { root } = await send('DOM.getDocument', { depth: 0 }); const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-life-logo-upload]' }); await send('DOM.setFileInputFiles', { files: [path], nodeId }); await pause(600); };
  const status = () => evaluate(`({ shown: document.querySelector('[data-life-logo-preview]')?.hidden === false, src: document.querySelector('[data-life-logo-preview] img')?.src ?? '', error: document.querySelector('[data-life-logo-error]')?.textContent ?? '' })`);
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-life-logo-upload]'))`), 'Il caricamento del logo è nel modulo di fondazione.');
  // validation: a file that is not an image is refused, with the reason, and no preview is shown
  await setFile(bad);
  let state = await status();
  assert.equal(state.shown, false, 'Nessuna anteprima per un file non valido.'); assert.ok(state.error.length > 5, `Motivo del rifiuto mostrato: «${state.error}»`);
  // a valid file: preview
  await setFile(good);
  state = await status();
  assert.ok(state.shown && state.src.startsWith('blob:') && state.error === '', 'Anteprima del logo valido.');
  const fill = (name, value) => evaluate(`(() => { const el = document.querySelector('[data-life-found-form] [name="${name}"]'); el.value = ${JSON.stringify(value)}; return true; })()`);
  await fill('partyName', 'Rotta Nuova'); await fill('partyAbbreviation', 'RTN'); await fill('partyDescription', 'Un partito nato in carriera.');
  await evaluate(`document.querySelector('[data-life-found]').click(); true`);
  await wait(() => evaluate(`Boolean(document.querySelector('[data-confirm="ok"], [data-confirm="confirm"], [data-confirm-ok]'))`), 8000).catch(() => {});
  await evaluate(`(document.querySelector('[data-confirm="ok"]') ?? document.querySelector('[data-confirm="confirm"]') ?? document.querySelector('[data-confirm-ok]') ?? [...document.querySelectorAll('.confirm-dialog button, [role=dialog] button')].find(b => /Fonda il partito/.test(b.textContent)))?.click(); true`);
  const founded = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const logos = await import('/src/data/repositories/personal-logos.js?v=${version}'); const id = store.getState().career.partyId; const rec = store.getState().dataset.parties.find(p => p.id === id); return { id, name: rec?.name, info: logos.logoInfo(id), mime: logos.logoInfo(id)?.mime ?? null, inSave: store.exportSave().includes('blob:') }; })()`);
  await wait(async () => (await founded()).name === 'Rotta Nuova', 20000);
  await wait(async () => Boolean((await founded()).info), 20000);
  state = await founded();
  assert.equal(state.name, 'Rotta Nuova'); assert.ok(state.info, 'Il logo caricato è nel catalogo con l’id del nuovo partito, subito.'); assert.equal(state.inSave, false, 'Nessun Blob nel salvataggio.');
  // after a reload (career saved, logo catalog read again) the logo is still associated to the party
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); await store.preserveCurrent?.(); return true; })()`); await pause(500);
  await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))')); await evaluate('document.querySelector("[data-menu=continua]").click(), true'); await wait(() => evaluate('Boolean(document.querySelector(".page-wrap"))')); await pause(1500);
  const after = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const logos = await import('/src/data/repositories/personal-logos.js?v=${version}'); await logos.loadLogos(); const id = store.getState().career.partyId; return { name: store.getState().dataset.parties.find(p => p.id === id)?.name, has: Boolean(logos.logoInfo(id)), url: Boolean(logos.resolveLogo(id)) }; })()`);
  assert.equal(after.name, 'Rotta Nuova'); assert.ok(after.has && after.url, 'Dopo il ricaricamento il logo è ancora presente e associato al partito.');
});
console.log('Fondazione con logo caricato nel browser: validazione (file non valido rifiutato), anteprima, salvataggio con l’id del nuovo partito e persistenza dopo il ricaricamento verificati.');
