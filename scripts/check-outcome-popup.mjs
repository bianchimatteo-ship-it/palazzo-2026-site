// The official result of a vote, told once at the centre of the page. In the game: a defeat and a victory each leave one card with percentage, position and mandate (won or missed); a seat that is
// not a victory is told as such; closing it moves it to the seen ones and it never comes back after a redraw, a save or a reload. In a real browser: the card is a large modal at the centre on a dark blurred backdrop
// (what is under it can still be clicked), closes with the button and with Escape, fits the phone, and the discreet banner of a win does not appear beside it.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { announceOutcome, dismissOutcome, pendingOutcome, electionTone } from '../src/core/celebration.js';

// ---------- the rules of the card ----------
{
  const game = { celebrations: { pending: null, seen: [] } };
  assert.ok(announceOutcome(game, { id: 'esito-1', kind: 'elezione', tone: 'loss', title: 'Comunali', headline: 'Sconfitta', lines: ['a'] }));
  assert.ok(!announceOutcome(game, { id: 'esito-1', kind: 'elezione', tone: 'loss', title: 'x', headline: 'x' }), 'Lo stesso esito non si annuncia due volte mentre è aperto.');
  assert.equal(pendingOutcome(game).id, 'esito-1');
  assert.ok(dismissOutcome(game, 'esito-1') && !pendingOutcome(game));
  assert.ok(!announceOutcome(game, { id: 'esito-1', kind: 'elezione', tone: 'loss', title: 'x', headline: 'x' }), 'Dopo la chiusura non torna.');
  assert.ok(!dismissOutcome(game, 'esito-1'), 'Chiudere due volte non fa niente.');
  // two results in the same moment: both are told, one after the other, neither replaces the other
  const two = { celebrations: { pending: null, seen: [] } };
  assert.ok(announceOutcome(two, { id: 'a', kind: 'congresso', tone: 'loss', title: 'A', headline: 'A' }) && announceOutcome(two, { id: 'b', kind: 'elezione', tone: 'win', title: 'B', headline: 'B' }));
  assert.equal(pendingOutcome(two).id, 'a');
  assert.ok(dismissOutcome(two, 'a'));
  assert.equal(pendingOutcome(two).id, 'b', 'Il secondo esito aspetta il suo turno.');
  assert.ok(dismissOutcome(two, 'b') && !pendingOutcome(two));
  assert.ok(!announceOutcome(two, { id: 'a', kind: 'congresso', tone: 'loss', title: 'A', headline: 'A' }), 'Nessuno dei due torna.');
  assert.equal(electionTone({ personalMandate: true }, { tone: 'good' }), 'win');
  assert.equal(electionTone({ personalMandate: true }, { tone: 'bad' }), 'partial', 'Un seggio senza vittoria è un risultato parziale.');
  assert.equal(electionTone({ personalMandate: false }, { tone: 'bad' }), 'loss');
}

// ---------- in the game ----------
const nativeFetch = globalThis.fetch;
const KEY = 'palazzo-2026.career.v1';
const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(String(url).split('?')[0])), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const realData = await import(`../src/data/repositories/real-data.js${v}`);
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'twoPerThousand', 'parliamentaryGroups', 'politicians']);
const db = realData.realDatabase;
const { store } = await import(`../src/core/store.js${v}&esito=1`);
store.setRealReference({ twoPerThousand: db.twoPerThousand, parties: db.parties, movements: db.politicalMovements });
const party = db.parties.find(item => item.id === 'party-registro-p1-2022-63-ir');
store.createCareer({ firstName: 'Marta', lastName: 'Prova', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', municipalityCode: '052032', previousProfession: 'Architetta', initialLevel: 'comunale', partyMode: 'existing', partyId: party.id, parliamentaryGroupId: '', parliamentStartMode: 'real-context', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 } }, db.parties, db.parliamentaryGroups);

async function vote(win) {
  store.fastForwardToElection('comunale');
  store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, db.parties);
  const campaign = store.getState().campaign;
  campaign.nomination.status = 'approved';
  for (const area of campaign.territories) { const ids = Object.keys(area.supportByCandidate); area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === campaign.playerCandidateId ? (win ? 70 : 5) : (win ? 30 : 95) / (ids.length - 1)])); }
  campaign.day = campaign.totalDays - 1;
  store.advance(1);
  return store.getState();
}
const cardsOf = game => [game.celebrations?.outcome, ...(game.celebrations?.outcomeQueue ?? [])].filter(Boolean);
const closeAll = () => { for (let guard = 0; store.getState().game.celebrations.outcome && guard < 6; guard++) store.dismissOutcome(); };
let state = await vote(false);
let card = cardsOf(state.game).find(item => item.kind === 'elezione');
assert.ok(card && card.kind === 'elezione' && card.tone === 'loss', 'Una sconfitta lascia un esito ufficiale.');
assert.ok(/Sconfitta|sconfitt/i.test(card.headline) && card.lines.some(line => /^Risultato: \d+(,\d)?% dei voti$/.test(line)) && card.lines.some(line => /Mandato mancato/.test(line)), `Sconfitta: esito, percentuale, mandato mancato (${JSON.stringify(card)}).`);
assert.ok(!state.game.celebrations.pending, 'Nessun segno di vittoria dopo una sconfitta.');
const lostId = card.id;
store.save();
let reloaded = (await import(`../src/core/store.js${v}&esito=r1`)).store.getState();
assert.ok(cardsOf(reloaded.game).some(item => item.id === lostId), 'L’esito non ancora chiuso resta dopo il ricaricamento (una volta).');
closeAll();
assert.ok(!store.getState().game.celebrations.outcome && store.getState().game.celebrations.seen.includes(lostId), 'Chiuso, sparisce.');
assert.ok(!store.dismissOutcome(lostId), 'Chiuderlo ancora non fa nulla.');
store.save();
reloaded = (await import(`../src/core/store.js${v}&esito=r2`)).store.getState();
assert.ok(!cardsOf(reloaded.game).length && reloaded.game.celebrations.seen.includes(lostId), 'Dopo la chiusura non torna al ricaricamento.');
store.advance(3);
assert.ok(!cardsOf(store.getState().game).some(item => item.id === lostId), 'Né dopo qualche settimana.');
store.clearCampaign();

state = await vote(true);
card = cardsOf(state.game).find(item => item.kind === 'elezione');
assert.ok(card && card.tone === 'win', `Una vittoria lascia un esito di vittoria (${JSON.stringify(card)} / ${JSON.stringify(state.campaign.result.outcome)}).`);
assert.ok(card.lines.some(line => /^Risultato: \d+(,\d)?% dei voti$/.test(line)) && card.lines.some(line => /Mandato conquistato/.test(line)) && card.lines.some(line => /^Posizione: /.test(line)), `Vittoria: percentuale, posizione e mandato (${JSON.stringify(card.lines)}).`);
assert.ok(card.celebrationId && state.game.celebrations.pending?.id === card.celebrationId, 'Il segno discreto della vittoria è collegato allo stesso esito.');
closeAll();
assert.ok(!store.getState().game.celebrations.outcome && !store.getState().game.celebrations.pending, 'Chiusi gli esiti si chiude anche il segno discreto: un risultato, una notifica.');
store.save();

// ---------- in a real browser ----------
globalThis.fetch = nativeFetch;
const { chromeAvailable, createCareerInPage, openCareer, withBrowser } = await import('./lib/browser.mjs');
if (!chromeAvailable) { console.log('Esito ufficiale verificato nel gioco; la parte nel browser è saltata: Chrome non trovato (imposta CHROME_PATH).'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, version }) => {
  const mod = `import('/src/core/store.js?v=${version}')`;
  await createCareerInPage({ evaluate, version }, { level: 'comunale', onboarding: true, extra: `store.fastForwardToElection('comunale'); store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, real.realDatabase.parties); const c = store.getState().campaign; c.nomination.status = 'approved'; for (const area of c.territories) { const ids = Object.keys(area.supportByCandidate); area.supportByCandidate = Object.fromEntries(ids.map(id => [id, id === c.playerCandidateId ? 70 : 30 / (ids.length - 1)])); } c.day = c.totalDays - 1; store.save();` });
  await openCareer({ evaluate, goto, waitFor: wait });
  const popup = () => evaluate(`(() => { const el = document.querySelector('.outcome-popup'); if (!el) return null; const r = el.getBoundingClientRect(); const vw = innerWidth, vh = innerHeight; return { id: el.dataset.outcome, tone: el.dataset.outcomeTone, text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw, vh, count: document.querySelectorAll('.outcome-popup').length, banner: Boolean(document.querySelector('.celebration')) }; })()`);
  await evaluate(`(async () => { const { store } = await ${mod}; store.advance(1); return true; })()`);
  await wait(async () => Boolean(await popup()), 15000).catch(async () => { throw new Error('Nessuna scheda: ' + JSON.stringify(await evaluate(`(async () => { const { store } = await ${mod}; const s = store.getState(); return { campaign: s.campaign && { status: s.campaign.status, day: s.campaign.day, total: s.campaign.totalDays }, cel: s.game.celebrations, page: s.ui.activePage }; })()`))); });
  // a party congress may have come the same week: its card is told first, and closed with the button the vote's card follows
  for (let guard = 0; guard < 3 && (await evaluate(`document.querySelector('.outcome-popup')?.dataset.outcomeKind`)) !== 'elezione'; guard++) {
    const first = (await popup()).id;
    await evaluate(`document.querySelector('[data-outcome-dismiss]').click(), true`);
    await wait(async () => (await popup())?.id !== first, 8000);
  }
  await pause(600);
  let p = await popup();
  assert.equal(p.count, 1, 'Una sola scheda.');
  assert.equal(p.tone, 'win');
  assert.ok(/\d+(,\d)?% dei voti\s*risultato/i.test(p.text) && /Mandato conquistato/.test(p.text) && /Posizione: /.test(p.text), `La scheda dice percentuale, posizione e mandato (${p.text}).`);
  assert.ok(!p.banner, 'Il banner discreto non compare accanto alla scheda dello stesso risultato.');
  // centre of the page, inside the screen
  assert.ok(Math.abs((p.left + p.right) / 2 - p.vw / 2) < 4 && p.left >= 0 && p.right <= p.vw && p.top >= 0 && p.bottom <= p.vh, `Al centro e dentro lo schermo: ${JSON.stringify(p)}`);
  assert.ok(Math.abs((p.top + p.bottom) / 2 - p.vh / 2) < 6, 'Al centro anche in verticale (desktop).');
  // a large card on a dark, blurred backdrop: the page behind is veiled (the card is a modal), the card is big and green for a victory with confetti (a victory only), crimson for a defeat without
  const look = await evaluate(`(() => { const overlay = document.querySelector('[data-outcome-overlay]'); const popup = document.querySelector('.outcome-popup'); const o = getComputedStyle(overlay); const pc = getComputedStyle(popup); const r = popup.getBoundingClientRect(); return { overlay: Boolean(overlay), blur: (o.backdropFilter || o.webkitBackdropFilter || ''), bg: o.backgroundColor + '|' + o.backgroundImage, covers: overlay.getBoundingClientRect().width === innerWidth && overlay.getBoundingClientRect().height === innerHeight, tone: pc.getPropertyValue('--outcome-tone').trim(), width: Math.round(r.width), height: Math.round(r.height), confetti: document.querySelectorAll('.outcome-confetti i').length, headline: popup.querySelector('.outcome-headline')?.textContent, stat: popup.querySelector('.outcome-stat b')?.textContent, role: popup.getAttribute('aria-modal') }; })()`);
  assert.ok(look.overlay && look.covers && /blur\(/.test(look.blur), `Sfondo scuro e sfocato su tutta la pagina: ${JSON.stringify(look)}`);
  assert.ok(look.width >= 560 && look.height >= 330 && look.role === 'true', `Scheda grande e modale (${look.width}×${look.height}).`);
  assert.equal(look.tone, '#6fe0a6', 'Vittoria: palette verde.');
  assert.ok(look.confetti >= 30, `Vittoria: coriandoli (${look.confetti}).`);
  assert.ok(/\d+(,\d)?%/.test(look.stat ?? ''), `La percentuale è il numero grande (${look.stat}).`);
  // the confetti are a one-off effect, not an endless one: every piece animates once
  const iterations = await evaluate(`getComputedStyle(document.querySelector('.outcome-confetti i')).animationIterationCount`);
  assert.ok(iterations === '1' || iterations === '', `Coriandoli una volta sola, mai in loop (${iterations}).`);
  // a defeat is crimson and has no confetti (the same card with the tone of a defeat)
  const lossLook = await evaluate(`(() => { const overlay = document.createElement('div'); overlay.className = 'outcome-overlay is-loss'; overlay.innerHTML = '<aside class="outcome-popup is-loss"><h2 class="outcome-headline">x</h2></aside>'; document.body.append(overlay); const c = getComputedStyle(overlay.firstChild); const out = { tone: c.getPropertyValue('--outcome-tone').trim(), deep: c.getPropertyValue('--outcome-deep').trim(), confetti: overlay.querySelectorAll('.outcome-confetti').length }; overlay.remove(); return out; })()`);
  assert.equal(lossLook.tone, '#ff6b7a', 'Sconfitta: palette rossa/cremisi.'); assert.equal(lossLook.confetti, 0, 'Sconfitta: nessun coriandolo.');
  // it is a modal: the card is told first, closed with the button or Escape
  const covered = await evaluate(`(() => { const el = document.elementFromPoint(8, innerHeight - 8); return Boolean(el && el.closest('[data-outcome-overlay]')); })()`);
  assert.ok(covered, 'Il resto della pagina è sotto il velo finché non si chiude la scheda.');
  // redraws and a saved game do not duplicate it
  await evaluate(`(async () => { const { store } = await ${mod}; store.save(); store.advance(0); return true; })()`);
  await pause(400);
  assert.equal((await popup()).count, 1, 'Dopo un ridisegno resta una sola scheda.');
  // the phone
  await viewport(390, 800, true);
  await pause(400);
  p = await popup();
  assert.ok(p.left >= 0 && p.right <= p.vw && p.bottom <= p.vh && p.top >= 0, `Sul telefono sta nello schermo: ${JSON.stringify(p)}`);
  await viewport(1280, 800, false);
  await pause(300);
  // Escape closes it, and it is not drawn again
  await evaluate(`globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })), true`);
  await wait(async () => !(await popup()), 8000);
  await evaluate('window.__old = true'); await goto('');
  await wait(async () => !(await evaluate('window.__old === true')) && await evaluate('Boolean(document.querySelector("[data-menu]"))'));
  await openCareer({ evaluate, goto, waitFor: wait });
  await pause(600);
  assert.ok(!(await popup()), 'Dopo il ricaricamento non torna.');
});
console.log('Esito ufficiale verificato: una scheda per risultato (sconfitta, vittoria), con percentuale, posizione e mandato; chiusa non torna dopo salvataggio e ricaricamento; nel browser è grande al centro su sfondo scuro e sfocato (verde con coriandoli per la vittoria, cremisi per la sconfitta), si chiude con il pulsante e con Esc, sta nel telefono.');
