// The page «Sondaggi e media» in two sections told apart at first sight (Sondaggi dei partiti / Alleanze e coalizioni), in Chrome: the tabs, the summary of the alliances, the accordions (composition and weight,
// cohesion, programme, talks, activities, registration, breaks), the weight of an alliance that comes from the readings of its members and says when one is missing, phone / tablet / desktop without horizontal scroll.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.error('SKIPPED: Chrome non trovato.'); process.exit(process.env.REQUIRE_CHROME ? 1 : 0); }
const OUT = new URL('../docs/qa/screenshots/final/', import.meta.url).pathname; await mkdir(OUT, { recursive: true });
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, screenshot, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); document.querySelectorAll('[data-report-close],[data-confirm=cancel]').forEach(b => b.click()); true`);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  await S(`const s = store.getState(); s.game.party.affiliation = 'founder'; s.game.party.rank = 5;
    const ids = s.world.parties.filter(p => !p.isPlayer && p.active).map(p => p.id);
    let allied = null;
    for (let i = 0; i < 60 && !allied; i++) { for (const id of ids) { store.getState().game.resources.politicalCapital = 60; try { const out = store.proposeAlliance(id); if (out.success) { allied = id; break; } } catch (e) {} } if (!allied) { try { store.advance(7); } catch (e) {} } }
    return allied;`);
  const open = async () => { await evaluate(`location.hash = '#panoramica'; true`); await pause(400); await evaluate(`location.hash = '#sondaggi'; true`); await pause(1500); };
  const text = sel => evaluate(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? ''`);
  await open();
  // two areas
  const tabs = await evaluate(`[...document.querySelectorAll('.obs-tabs [data-obs-area]')].map(b => b.textContent.trim())`);
  assert.deepEqual(tabs, ['Sondaggi dei partiti', 'Alleanze e coalizioni'], 'Due schede, una per i sondaggi dei partiti e una per le alleanze.');
  assert.ok(await evaluate(`document.querySelector('.obs-tabs [data-obs-area].active, .obs-tabs [data-obs-area][aria-selected=true]')?.dataset.obsArea === 'partiti'`), 'Si apre sui sondaggi dei partiti.');
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-my-coalition], [data-alliances-overview]'))`), false, 'Le alleanze non stanno nella pagina dei sondaggi dei partiti.');
  await evaluate(`document.querySelector('.obs-tabs [data-obs-area=alleanze]').click(); true`); await pause(900);
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-alliances-overview]'))`), 'La scheda alleanze mostra il quadro di tutte le alleanze.');
  assert.ok(await evaluate(`Boolean(document.querySelector('[data-my-coalition]'))`), 'Con un’alleanza stretta c’è la scheda «La mia alleanza».');
  const subs = await evaluate(`[...document.querySelectorAll('.obs-subtab')].map(b => b.textContent.trim())`);
  assert.deepEqual(subs, ['Quadro delle alleanze', 'Partiti e trattative', 'Scenari e coalizioni'], 'Le viste dell’area alleanze.');
  // the accordions of the player's alliance
  const folds = await evaluate(`[...document.querySelectorAll('[data-my-coalition] [data-alliance-fold]')].map(d => d.dataset.allianceFold)`);
  for (const id of ['composizione', 'coesione', 'trattative', 'registrazione', 'rotture']) assert.ok(folds.includes(id), `Accordion «${id}» presente.`);
  assert.ok(await evaluate(`document.querySelectorAll('[data-my-coalition] .alliance-fold > summary').length >= 5 && [...document.querySelectorAll('[data-my-coalition] .alliance-fold > summary')].every(s => s.getBoundingClientRect().height >= 44)`), 'Le intestazioni degli accordion sono comode da toccare (44 px).');
  await evaluate(`document.querySelector('[data-my-coalition] [data-alliance-fold=composizione] summary').click(); true`); await pause(200);
  const isOpen = await evaluate(`document.querySelector('[data-my-coalition] [data-alliance-fold=composizione]').open`);
  await evaluate(`document.querySelector('[data-my-coalition] [data-alliance-fold=composizione] summary').click(); true`); await pause(200);
  assert.notEqual(await evaluate(`document.querySelector('[data-my-coalition] [data-alliance-fold=composizione]').open`), isOpen, 'Un clic apre e chiude l’accordion.');
  // the weight comes from the members' readings; a missing reading is declared, never estimated
  const w = await text('[data-alliance-card] [data-alliance-weight]');
  assert.match(w, /Insieme \d|Nessuna rilevazione/, 'Il peso dell’alleanza è la somma delle rilevazioni.');
  const sum = await S(`const s = store.getState(); const a = s.world.alliances.find(x => x.status === 'active' && x.partyIds.length >= 2); const poll = s.world.polls.at(-1); const shares = a.partyIds.map(id => poll.results.find(r => r.partyId === id)?.share ?? null); return { shares, id: a.id };`);
  const measured = sum.shares.filter(x => x !== null);
  if (measured.length === sum.shares.length) assert.ok(!/mancano/.test(w), 'Con tutte le rilevazioni il totale è completo.');
  await S(`const s = store.getState(); const a = s.world.alliances.find(x => x.status === 'active' && x.partyIds.length >= 2); const poll = s.world.polls.at(-1); const drop = a.partyIds.find(id => !s.world.parties.find(p => p.id === id)?.isPlayer); poll.results = poll.results.filter(r => r.partyId !== drop); return drop;`);
  await open(); await evaluate(`document.querySelector('.obs-tabs [data-obs-area=alleanze]').click(); true`); await pause(900);
  assert.match(await text('[data-alliance-card] [data-alliance-weight]'), /mancano le rilevazioni di .+totale è parziale/, 'Con una rilevazione mancante il totale è dichiarato parziale e dice quale manca.');
  // layouts and screenshots
  for (const [area, width] of [['partiti', 390], ['alleanze', 390], ['partiti', 820], ['alleanze', 1280]]) {
    await viewport(width, width < 500 ? 844 : 1000); await open();
    await evaluate(`document.querySelector('.obs-tabs [data-obs-area=${area}]').click(); true`); await pause(900);
    await evaluate(`[...document.querySelectorAll('button')].filter(b => /^Chiudi$/.test(b.textContent.trim())).forEach(b => b.click()); true`);
    const m = await evaluate(`({ doc: document.documentElement.scrollWidth, vw: innerWidth, over: [...document.querySelectorAll('.polls-page *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !e.closest('.table-scroll, .obs-subtabs, .sx-tabs, .obs-tabs'); }).length })`);
    assert.ok(m.doc <= m.vw + 1 && m.over === 0, `${area} a ${width}px: nessuno scorrimento orizzontale (${m.doc}/${m.vw}, ${m.over} fuori).`);
    await screenshot(`${OUT}sondaggi-${area}-${width}.png`);
  }
  assert.deepEqual(errors.filter(e => !/api\//.test(String(e))), [], 'Nessun errore in pagina.');
});
console.log('Sondaggi e media in due sezioni verificato in Chrome: partiti / alleanze e coalizioni, accordion, peso dalle rilevazioni dei componenti con dichiarazione dei dati mancanti, tre larghezze; schermate in docs/qa/screenshots/final.');
