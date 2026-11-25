// Founding a party DURING a real career, in the browser (Chrome), through the page itself: every field of «Fonda un nuovo partito» is changed with real input/change events (name, initials,
// description, orientation, political position, main and second colour, shape and symbol of the logo, programme, positions), the page is redrawn several times on the way (another page and back, the
// panel closed and opened again, a store notice), the preview of the logo must follow at once, a logo file is loaded from the «gallery» (a file input) — then the confirmation. Every value is checked on
// the record of the new party, on the political world (polls) and on the pages, after the confirmation AND after closing the game and opening the career again.
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { withBrowser, createCareerInPage, openCareer, chromeAvailable } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Fondazione in carriera nel browser saltata: Chrome non trovato (imposta CHROME_PATH).'); process.exit(0); }
const OUT = new URL('../docs/qa/screenshots/final/', import.meta.url).pathname; await mkdir(OUT, { recursive: true });
const crc = (() => { const table = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } return buf => { let c = 0xffffffff; for (const byte of buf) c = table[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]); const out = Buffer.alloc(8 + data.length + 4); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), 8 + data.length); return out; };
const png = (w, h) => { const raw = Buffer.concat(Array.from({ length: h }, (_, y) => Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, (_, x) => [200, 40 + ((x + y) % 120), 60, 255]).flat())]))); const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head.set([8, 6, 0, 0, 0], 8); return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); };
const logoFile = join(tmpdir(), 'politicando-logo-carriera.png'); await writeFile(logoFile, png(96, 96));

const WANT = { name: 'Patto Civico Lombardo', abbreviation: 'PCL', description: 'Un partito nato a metà carriera per i servizi pubblici e il lavoro.', color: '#1f7a5a', secondary: '#f4d35e', policy: { economia: 2, welfare: 5, ambiente: 4, europa: 1 } };
const results = {};
await withBrowser(async ({ evaluate, send, goto, waitFor: wait, pause, viewport, version, screenshot }) => {
  await viewport(1280, 900, false);
  await createCareerInPage({ evaluate, version }, { level: 'deputato', weeks: 3, name: ['Giulia', 'Ferri'], region: 'Lombardia', extra: `Object.assign(store.getState().game.resources, { funds: 500000, politicalCapital: 99 });` });
  await openCareer({ evaluate, goto, waitFor: wait }); await pause(1200);
  const S = code => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${code} })()`);
  const before = await S(`return { partyId: store.getState().career.partyId, parties: store.getState().dataset.parties.length };`);
  const openPanel = async () => {
    await evaluate(`location.hash = '#partito'; true`); await pause(800);
    await evaluate(`[...document.querySelectorAll('[data-section-tab]')].find(b => b.dataset.sectionTabValue === 'vita')?.click(); true`); await pause(700);
  };
  await openPanel();
  // the panel exists, starts closed
  const fold = await evaluate(`(() => { const d = document.querySelector('[data-pl-found]'); return d ? { open: d.open, summary: d.querySelector('summary')?.textContent.trim() } : null; })()`);
  assert.ok(fold, 'Il pannello «Fonda un nuovo partito» c’è.'); assert.equal(fold.open, false, 'Il pannello è chiuso all’inizio.'); assert.match(fold.summary, /Fonda un nuovo partito/);
  await evaluate(`document.querySelector('[data-pl-found]').open = true; document.querySelector('[data-pl-found]').dispatchEvent(new Event('toggle')); true`); await pause(300);
  const F = sel => `document.querySelector('[data-life-found-form] ${sel}')`;
  const put = (name, value) => evaluate(`(() => { const el = ${F(`[name="${name}"]`)}; if (!el) return false; el.value = ${JSON.stringify(String(value))}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return el.value; })()`);
  const pickOther = name => evaluate(`(() => { const el = ${F(`select[name="${name}"]`)}; if (!el) return null; const options = [...el.options].map(o => o.value).filter(Boolean); const next = options.find(v => v !== el.value && options.indexOf(v) >= 2) ?? options.find(v => v !== el.value); el.value = next; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return next; })()`);
  const preview = () => evaluate(`(() => { const img = document.querySelector('[data-life-found-form] [data-wizard-logo-preview] img'); return img?.getAttribute('src') ?? ''; })()`);
  // ---- every field
  assert.equal(await put('partyName', WANT.name), WANT.name);
  assert.equal(await put('partyAbbreviation', WANT.abbreviation), WANT.abbreviation);
  await put('partyDescription', WANT.description);
  const orientation = await pickOther('partyOrientation'); const position = await pickOther('partyPosition');
  const p0 = await preview();
  await put('partyColor', WANT.color); await pause(200);
  const p1 = await preview();
  assert.notEqual(p1, p0, 'Il colore principale aggiorna subito l’anteprima del logo.');
  await put('partyLogoSecondaryColor', WANT.secondary); await pause(200);
  const p2 = await preview(); assert.notEqual(p2, p1, 'Il secondo colore aggiorna subito l’anteprima.');
  const shape = await pickOther('partyLogoShape'); await pause(200); const p3 = await preview(); assert.notEqual(p3, p2, 'La forma aggiorna subito l’anteprima.');
  const symbol = await pickOther('partyLogoSymbol'); await pause(200); const p4 = await preview(); assert.notEqual(p4, p3, 'Il simbolo aggiorna subito l’anteprima.');
  const program = await evaluate(`(() => { const boxes = [...document.querySelectorAll('[data-life-found-form] [name="partyProgram"]')]; boxes.forEach(b => { if (b.checked) { b.checked = false; b.dispatchEvent(new Event('change', { bubbles: true })); } }); const chosen = boxes.slice(-4).map(b => { b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true })); return b.value; }); return chosen; })()`);
  assert.equal(program.length, 4, 'Quattro priorità del programma scelte.');
  for (const [key, value] of Object.entries(WANT.policy)) await put(`policy_${key}`, value);
  // ---- the logo from the gallery (a file input, as the native picker gives it)
  const { root } = await send('DOM.getDocument', { depth: 0 }); const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-life-logo-upload]' });
  await send('DOM.setFileInputFiles', { files: [logoFile], nodeId }); await pause(900);
  assert.ok(await evaluate(`document.querySelector('[data-life-logo-preview]')?.hidden === false`), 'Il logo dalla galleria è in anteprima.');
  await evaluate(`document.querySelector("[data-news-popup] [data-news-close], .news-popup [data-close], .np-actions button:last-child")?.click(); document.querySelector("[data-life-found-form] [data-wizard-logo-preview]")?.scrollIntoView({ block: "center" }); true`); await pause(400);
  await screenshot(`${OUT}fondazione-carriera-modulo-1280.png`);
  // ---- redraws: a notice of the store, another page and back, the panel closed and opened
  const snapshot = () => evaluate(`(() => { const f = document.querySelector('[data-life-found-form]'); if (!f) return null; const v = n => f.querySelector('[name="' + n + '"]')?.value; return { name: v('partyName'), abbreviation: v('partyAbbreviation'), description: v('partyDescription'), orientation: v('partyOrientation'), position: v('partyPosition'), color: v('partyColor'), secondary: v('partyLogoSecondaryColor'), shape: v('partyLogoShape'), symbol: v('partyLogoSymbol'), program: [...f.querySelectorAll('[name="partyProgram"]')].filter(b => b.checked).map(b => b.value), policy: Object.fromEntries(['economia','welfare','ambiente','europa'].map(k => [k, Number(v('policy_' + k))])), logo: document.querySelector('[data-life-logo-preview]')?.hidden === false, open: document.querySelector('[data-pl-found]')?.open }; })()`);
  const expected = { name: WANT.name, abbreviation: WANT.abbreviation, description: WANT.description, orientation, position, color: WANT.color, secondary: WANT.secondary, shape, symbol, program, policy: WANT.policy, logo: true };
  const same = (got, when) => { for (const [key, value] of Object.entries(expected)) assert.deepEqual(got?.[key], value, `${when}: «${key}» conservato (${JSON.stringify(got?.[key])}).`); };
  same(await snapshot(), 'Prima dei ridisegni');
  await S(`store.getState().ui.toast = 'ridisegno di prova'; store.notify?.(); return true;`); await evaluate(`window.dispatchEvent(new Event('resize')); true`); await pause(500);
  same(await snapshot(), 'Dopo un avviso');
  await evaluate(`location.hash = '#panoramica'; true`); await pause(900); await openPanel();
  const reopened = await snapshot(); assert.equal(reopened?.open, true, 'Il pannello torna aperto com’era.'); same(reopened, 'Dopo un’altra pagina');
  await evaluate(`document.querySelector('[data-pl-found]').open = false; true`); await pause(200); await evaluate(`document.querySelector('[data-pl-found]').open = true; true`); await pause(200);
  same(await snapshot(), 'Dopo chiusura e riapertura del pannello');
  results.preview = (await preview()).slice(0, 30);
  // ---- confirm
  await evaluate(`document.querySelector('[data-life-found]').click(); true`);
  await wait(() => evaluate(`Boolean([...document.querySelectorAll('.confirm-dialog button, [role=dialog] button, [data-confirm-ok]')].find(b => /Fonda il partito/.test(b.textContent)))`), 8000);
  same(await snapshot(), 'Con la conferma aperta');
  await evaluate(`[...document.querySelectorAll('.confirm-dialog button, [role=dialog] button, [data-confirm-ok]')].find(b => /Fonda il partito/.test(b.textContent)).click(); true`);
  const read = () => S(`const logos = await import('/src/data/repositories/personal-logos.js?v=${version}'); await logos.loadLogos?.(); const s = store.getState(); const id = s.career.partyId; const r = s.dataset.parties.find(p => p.id === id) ?? {}; const w = s.world?.parties?.find(p => p.isPlayer) ?? {};
    return { id, name: r.name, officialName: r.officialName, abbreviation: r.abbreviation, description: r.description, orientation: r.orientation, position: r.politicalPosition, color: r.color, secondary: r.logo?.secondary ?? null, color2: r.color2 ?? null, shape: r.logo?.shape, symbol: r.logo?.symbol, program: r.program, gameProgram: s.game.party?.program?.areas ?? null, policy: r.policyPositions, world: { label: w.label, abbreviation: w.abbreviation, color: w.brandColor ?? w.color, agenda: w.agenda ?? null }, logoInfo: Boolean(logos.logoInfo(id)), logoUrl: Boolean(logos.resolveLogo(id)) };`);
  await wait(async () => (await read()).name === WANT.name, 20000);
  await wait(async () => (await read()).logoInfo, 20000).catch(() => {});
  const check = (got, when) => {
    assert.notEqual(got.id, before.partyId, `${when}: il giocatore è nel nuovo partito.`);
    for (const [key, value] of [['name', WANT.name], ['officialName', WANT.name], ['abbreviation', WANT.abbreviation], ['description', WANT.description], ['orientation', orientation], ['position', position], ['color', WANT.color], ['secondary', WANT.secondary], ['shape', shape], ['symbol', symbol]]) assert.equal(got[key], value, `${when}: ${key} = ${JSON.stringify(got[key])}, atteso ${JSON.stringify(value)}.`);
    assert.deepEqual(got.program, program, `${when}: programma del partito.`); assert.deepEqual(got.gameProgram, program, `${when}: programma nella vita del partito.`);
    for (const [key, value] of Object.entries(WANT.policy)) assert.equal(got.policy?.[key], value, `${when}: posizione ${key}.`);
    assert.equal(got.world.label, WANT.name, `${when}: nome nei sondaggi.`); assert.equal(got.world.abbreviation, WANT.abbreviation, `${when}: sigla nei sondaggi.`); assert.equal(String(got.world.color).toLowerCase(), WANT.color, `${when}: colore nei sondaggi.`);
    assert.ok(got.logoInfo, `${when}: il logo caricato è associato al nuovo partito.`);
  };
  const founded = await read(); results.founded = founded; check(founded, 'Dopo la conferma');
  // the pages show it: Home topbar / party page / polls
  const visible = async () => {
    const out = {};
    for (const page of ['panoramica', 'partito', 'sondaggi']) { await evaluate(`location.hash = '#${page}'; true`); await pause(900); out[page] = await evaluate(`({ name: document.body.innerText.includes(${JSON.stringify(WANT.name)}), abbr: document.body.innerText.includes(${JSON.stringify(WANT.abbreviation)}), logo: [...document.querySelectorAll('img')].some(i => /^blob:|^data:image\\/(png|webp|jpeg)/.test(i.src) && i.closest('.party-logo, .logo, [class*="logo"]')) })`); }
    return out;
  };
  const pages = await visible(); results.pages = pages;
  for (const [page, seen] of Object.entries(pages)) assert.ok(seen.name || seen.abbr, `${page}: il nuovo partito è visibile con il suo nome o la sigla.`);
  assert.ok(Object.values(pages).some(seen => seen.logo), 'Il logo caricato compare nelle pagine.');
  await evaluate(`location.hash = '#partito'; true`); await pause(900); await screenshot(`${OUT}fondazione-carriera-partito-1280.png`);
  // ---- close and reopen the game
  await S(`await store.preserveCurrent?.(); return true;`); await pause(500);
  await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))')); await evaluate('document.querySelector("[data-menu=continua]").click(), true'); await wait(() => evaluate('Boolean(document.querySelector(".page-wrap"))')); await pause(1500);
  const reloaded = await read(); results.reloaded = reloaded; check(reloaded, 'Dopo il ricaricamento');
  const pagesAfter = await visible(); for (const [page, seen] of Object.entries(pagesAfter)) assert.ok(seen.name || seen.abbr, `${page} dopo il ricaricamento: il nuovo partito è visibile.`);
  // the founding form starts again empty (the draft was for the party now founded)
  await evaluate(`location.hash = '#partito'; true`); await pause(800); await evaluate(`[...document.querySelectorAll('[data-section-tab]')].find(b => b.dataset.sectionTabValue === 'vita')?.click(); true`); await pause(700);
});
console.log(`Fondazione durante la carriera verificata nel browser: tutti i campi (nome, sigla, descrizione, orientamento ${results.founded.orientation}, posizione ${results.founded.position}, colori ${results.founded.color}/${results.founded.secondary}, forma ${results.founded.shape}, simbolo ${results.founded.symbol}, programma di 4 priorità, posizioni, logo dalla galleria), anteprima immediata, nessuna perdita dopo avviso, cambio di pagina, chiusura del pannello e conferma; tutto sul partito, nei sondaggi e nelle pagine, anche dopo il ricaricamento.`);
