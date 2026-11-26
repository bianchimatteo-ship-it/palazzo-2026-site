// The guided identity of a merger in Chrome with real clicks: the form with the four names and the four logos, the live preview, the confirmation (name, initials, logo, what happens), the new identity seen
// in the party record and in the polls, the history of the merger, phone / tablet / desktop without horizontal scroll. Screenshots in docs/qa/screenshots/final.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.error('SKIPPED: Chrome non trovato.'); process.exit(process.env.REQUIRE_CHROME ? 1 : 0); }
const OUT = new URL('../docs/qa/screenshots/final/', import.meta.url).pathname; await mkdir(OUT, { recursive: true });
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, screenshot, errors, version }) => {
  await viewport(1280, 900, false);
  await createCareerInPage({ evaluate, version }, { level: 'deputato', weeks: 3, name: ['Anna', 'Bianchi'], region: 'Lombardia', extra: `
    const s = store.getState(); Object.assign(s.game.resources, { funds: 500000, politicalCapital: 99 });
    try { store.foundParty({ label: 'Rotta Nuova', abbreviation: 'RTN', followerIds: [] }); } catch (error) { for (let i = 0; i < 6; i++) { store.advance(7); Object.assign(store.getState().game.resources, { funds: 500000, politicalCapital: 99 }); try { store.foundParty({ label: 'Rotta Nuova', abbreviation: 'RTN', followerIds: [] }); break; } catch (e) {} } }
    ` });
  await openCareer({ evaluate, goto, waitFor: wait }); await pause(1200);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); true`);
  const partner = await S(`const s = store.getState(); Object.assign(s.game.resources, { funds: 500000, politicalCapital: 99 }); s.game.party.org.treasury.balance = 80000; const own = s.world.parties.find(p => p.isPlayer); const listed = new Set((s.world.polls.at(-1)?.results ?? []).map(r => r.partyId)); const near = s.world.parties.find(p => !p.isPlayer && p.active && listed.has(p.id) && p.baseline >= Math.max(0.5, own.baseline * 0.3) && p.baseline <= own.baseline * 1.8 + 1); if (!near) return null; s.world.ties[[own.id, near.id].sort().join('|')] = 70; near.axis = own.axis; return { id: near.id, label: near.label, ownLabel: s.game.party.label };`);
  assert.ok(partner, 'C’è un partner possibile.');
  const open = async () => { await evaluate(`location.hash = '#panoramica'; true`); await pause(400); await evaluate(`location.hash = '#partito'; true`); await pause(900); await evaluate(`(() => { const tab = [...document.querySelectorAll('[data-section-tab]')].find(b => b.dataset.sectionTabValue === 'vita'); tab?.click(); return true; })()`); await pause(700); await evaluate(`document.querySelectorAll('details').forEach(d => d.setAttribute('open', '')); true`); await pause(500); };
  const set = (sel, value, ev = ['input', 'change']) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(value)}; for (const e of ${JSON.stringify(ev)}) el.dispatchEvent(new Event(e, { bubbles: true })); return true; })()`);
  const pick = (name, value) => evaluate(`(() => { const r = document.querySelector('[data-merge-form] input[name=${name}][value=${value}]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await open();
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-merge-form]'))`), 'Il modulo dell’identità c’è per chi ha fondato il partito.');
  assert.equal(await evaluate(`document.querySelectorAll('[data-merge-form] input[name=merge-nameMode]').length`), 4, 'Quattro modi di scegliere il nome.');
  assert.equal(await evaluate(`document.querySelectorAll('[data-merge-form] input[name=merge-logoMode]').length`), 4, 'Quattro scelte per il logo.');
  const preview = () => evaluate(`document.querySelector('[data-merge-preview]')?.textContent ?? ''`);
  assert.match(await preview(), new RegExp(partner.ownLabel.split(' ')[0]), 'L’anteprima mostra il nome attuale.');
  await pick('merge-nameMode', 'both'); await pause(300);
  assert.match(await preview(), /–/, 'Con i due nomi uniti l’anteprima li mostra insieme.');
  await pick('merge-nameMode', 'custom'); await pause(300);
  assert.equal(await evaluate(`document.querySelector('[data-merge-custom]').hidden`), false, 'Il nome personalizzato compare solo per quella scelta.');
  await set('[data-life-field=merge-label]', 'Alleanza Nuova Civica'); await set('[data-life-field=merge-abbr]', 'anc');
  await set('[data-life-field=merge-color]', '#aa3322', ['input', 'change']); await set('[data-life-field=merge-color2]', '#eecc44', ['input', 'change']);
  await pick('merge-logoMode', 'new'); await pause(300);
  assert.equal(await evaluate(`document.querySelector('[data-merge-new]').hidden`), false, 'Forme e simboli compaiono per il logo nuovo.');
  const p = await preview(); assert.match(p, /Alleanza Nuova Civica/); assert.match(p, /ANC/, 'L’anteprima mostra nome e sigla scelti.');
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-merge-preview] img'))`), 'E il logo nuovo disegnato.');
  await pick('merge-logoMode', 'upload'); await pause(300);
  await evaluate(`document.querySelector(\`[data-life-merge="${partner.id}"]\`).click(); true`); await pause(600);
  assert.equal(await S(`return store.getState().game.party.label;`), partner.ownLabel, 'Senza file la fusione non parte.');
  assert.match(await evaluate(`document.querySelector('.toast')?.innerText ?? ''`), /file del logo|un’altra opzione/);
  await pick('merge-logoMode', 'new'); await pause(300);
  for (const [w, h, mobile] of [[390, 844, true], [820, 1100, true], [1280, 900, false]]) {
    await viewport(w, h, mobile); await open();
    await pick('merge-nameMode', 'custom'); await pick('merge-logoMode', 'new'); await set('[data-life-field=merge-label]', 'Alleanza Nuova Civica'); await pause(300);
    const m = await evaluate(`({ doc: document.documentElement.scrollWidth, vw: innerWidth, over: [...document.querySelectorAll('[data-merge-form] *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }).map(e => e.tagName + '.' + e.className).slice(0, 4) })`);
    assert.ok(m.doc <= m.vw + 1 && !m.over.length, `${w}px: nessuno scorrimento orizzontale (${m.doc}/${m.vw}) ${m.over.join(' | ')}.`);
    await evaluate(`document.querySelector('[data-merge-form]').scrollIntoView(); true`); await pause(300); await screenshot(`${OUT}fusione-identita-${w}.png`);
  }
  // confirmation: the dialog shows the choice; cancelling changes nothing
  await viewport(1280, 900, false); await open();
  await pick('merge-nameMode', 'custom'); await set('[data-life-field=merge-label]', 'Alleanza Nuova Civica'); await set('[data-life-field=merge-abbr]', 'anc'); await pick('merge-logoMode', 'new'); await pause(300);
  await evaluate(`document.querySelector(\`[data-life-merge="${partner.id}"]\`).click(); true`); await pause(700);
  const dialog = await evaluate(`document.querySelector('.confirm-dialog')?.innerText ?? ''`);
  assert.match(dialog, /Nuovo nome: Alleanza Nuova Civica/); assert.match(dialog, /Sigla: ANC/); assert.match(dialog, /Logo: uno nuovo/);
  await evaluate(`document.querySelector('[data-confirm="cancel"]').click(); true`); await pause(500);
  assert.equal(await S(`return store.getState().game.party.label;`), partner.ownLabel, 'Annullando nulla cambia.');
  await open();
  await pick('merge-nameMode', 'custom'); await set('[data-life-field=merge-label]', 'Alleanza Nuova Civica'); await set('[data-life-field=merge-abbr]', 'anc'); await set('[data-life-field=merge-color]', '#aa3322'); await set('[data-life-field=merge-color2]', '#eecc44'); await pick('merge-logoMode', 'new'); await pause(300);
  await evaluate(`document.querySelector(\`[data-life-merge="${partner.id}"]\`).click(); true`); await pause(600); await evaluate(`document.querySelector('[data-confirm="ok"]').click(); true`); await pause(1500);
  const done = await S(`const s = store.getState(); const rec = s.dataset.parties.find(p => p.id === s.career.partyId); return { label: s.game.party.label, force: s.world.parties.find(p => p.isPlayer).label, abbr: rec?.abbreviation, color: rec?.color, logo: rec?.logo?.kind, mergers: rec?.mergers?.length ?? 0, partnerActive: s.world.parties.find(p => p.id === '${partner.id}').active };`);
  assert.deepEqual([done.label, done.force, done.abbr, done.color, done.logo, done.mergers, done.partnerActive], ['Alleanza Nuova Civica', 'Alleanza Nuova Civica', 'ANC', '#aa3322', 'builder', 1, false], 'La scelta fatta è salvata nel partito, nei sondaggi e nello storico.');
  await open();
  assert.match(await evaluate(`document.querySelector('[data-merge-history]')?.textContent ?? ''`), /Storico delle fusioni \(1\).*Alleanza Nuova Civica/s, 'Lo storico delle fusioni è nella pagina.');
  assert.deepEqual(errors.filter(e => !/api\//.test(String(e))), [], 'Nessun errore in pagina.');
});
console.log('Identità della fusione verificata in Chrome: modulo, anteprima, conferma, salvataggio e storico, tre larghezze; schermate in docs/qa/screenshots/final.');
