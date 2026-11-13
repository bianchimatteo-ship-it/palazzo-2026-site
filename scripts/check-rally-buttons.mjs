// The buttons of the campaign and of the rally on a phone (bug of the field: in the row «Comizio» of the campaign the two buttons, «Scendi in piazza» and «Simula il comizio», were put in the same cell of the grid and one
// covered the other). In Chrome, at 320×700, 360×800, 390×844, 430×932, 768×1024 and 1440×900:
//   · every activity row of the campaign (all of them, the rally included): its parts do not overlap, every button is on screen, whole, at least 44px high on a phone, its text not cut;
//   · the rally scene, beat by beat (the opening, the two speeches with up to four ways each, the protest, the closing): the choices are distinct, one under the other or side by side, never over one another, whole, touchable;
//   · the same after a change of language (a dynamic update of the scene) and in the reduced-motion setting.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Pulsanti del comizio nel browser saltati: Chrome non trovato.'); process.exit(0); }
const SIZES = [[320, 700, true], [360, 800, true], [390, 844, true], [430, 932, true], [768, 1024, true], [1440, 900, false]];
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { level: 'comunale', onboarding: true, extra: `store.fastForwardToElection('comunale'); store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, real.parties ?? []); { const saved = JSON.parse(store.exportSave()); saved.campaign.nomination = { ...saved.campaign.nomination, status: 'approved' }; store.loadGame(saved); }` });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off' })); true`);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(350); };
  const lang = code => evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage(${JSON.stringify(code)})).then(() => true)`).then(() => pause(600));
  // the geometry of a group of buttons: overlaps, off-screen, cut text, size
  const geometry = (selector, scope) => evaluate(`(() => { const vw = innerWidth; const out = { n: 0, bad: [] }; const groups = ${scope ? `[...document.querySelectorAll(${JSON.stringify(scope)})]` : '[document]'}; for (const group of groups) { const items = [...group.querySelectorAll(${JSON.stringify(selector)})].filter(el => el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== 'hidden'); out.n += items.length; const boxes = items.map(el => ({ el, r: el.getBoundingClientRect() })); for (const { el, r } of boxes) { const name = (el.textContent || '').trim().slice(0, 30); if (r.left < -0.5 || r.right > vw + 0.5) out.bad.push('fuori schermo: ' + name); if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) out.bad.push('testo tagliato: ' + name); if (r.height < (vw < 800 ? 44 : 30) - 0.5) out.bad.push('troppo basso ' + Math.round(r.height) + 'px: ' + name); } for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i].r, b = boxes[j].r; const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ox > 1 && oy > 1) out.bad.push('sovrapposti: ' + (boxes[i].el.textContent || '').trim().slice(0, 20) + ' / ' + (boxes[j].el.textContent || '').trim().slice(0, 20)); } } return out; })()`);
  const dismissOutcomes = async () => { for (let i = 0; i < 6; i++) { await evaluate(`document.querySelectorAll('[data-outcome-dismiss]').forEach(b => b.click()); true`); await pause(500); } };

  // ---------- the activities of the campaign ----------
  await evaluate(`location.hash = '#elezioni'; true`); await pause(1500); await dismissOutcomes();
  await wait(() => evaluate(`document.querySelectorAll('.campaign-activity').length > 20`), 20000);
  await evaluate(`document.querySelectorAll('.campaign-activity-group').forEach(d => d.open = true); true`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-scene-start-kind="comizio"]').length`), 1, 'Il comizio ha il suo pulsante «Scendi in piazza».');
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-campaign-activity="rally"]'))`), true, 'E «Simula il comizio».');
  for (const [width, height, mobile] of SIZES) {
    await viewport(width, height, mobile); await pause(500);
    const rows = await geometry('.campaign-action-button, .campaign-activity-copy, .campaign-activity-cost', '.campaign-activity');
    const label = `campagna ${width}×${height}`;
    // within a row: no part covers another (copy, cost, buttons)
    const covered = rows.bad.filter(item => item.startsWith('sovrapposti') || item.startsWith('fuori schermo'));
    assert.deepEqual(covered, [], `${label}: nessuna sovrapposizione né pulsante fuori schermo`);
    const buttons = await geometry('.campaign-action-button', '.campaign-activity');
    assert.ok(buttons.n >= 20, `${label}: ${buttons.n} pulsanti d’azione controllati`);
    assert.deepEqual(buttons.bad, [], `${label}: pulsanti interi e toccabili`);
    assert.equal(await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1'), true, `${label}: nessuno scorrimento orizzontale`);
    // the two buttons of the rally are side by side or one under the other, distinct
    const rally = await evaluate(`(() => { const a = document.querySelector('[data-scene-start-kind="comizio"]').getBoundingClientRect(), b = document.querySelector('[data-campaign-activity="rally"]').getBoundingClientRect(); return { a: [a.left, a.top, a.right, a.bottom], b: [b.left, b.top, b.right, b.bottom] }; })()`);
    const overlap = Math.min(rally.a[2], rally.b[2]) - Math.max(rally.a[0], rally.b[0]) > 1 && Math.min(rally.a[3], rally.b[3]) - Math.max(rally.a[1], rally.b[1]) > 1;
    assert.equal(overlap, false, `${label}: «Scendi in piazza» e «Simula il comizio» sono distinti`);
  }
  await lang('en');
  for (const [width, height, mobile] of [[320, 700, true], [390, 844, true]]) { await viewport(width, height, mobile); await pause(500); const rows = await geometry('.campaign-action-button, .campaign-activity-copy, .campaign-activity-cost', '.campaign-activity'); assert.deepEqual(rows.bad.filter(item => !item.startsWith('troppo')), [], `campagna in inglese ${width}×${height}: nessuna sovrapposizione`); }
  await lang('it');

  // ---------- the rally scene, beat by beat ----------
  await viewport(390, 844, true);
  await click('[data-scene-start-kind="comizio"]'); await wait(() => evaluate(`Boolean(document.querySelector('.scene[data-scene-kind="comizio"] .st-svg'))`), 15000);
  await click('[data-scene-motion="off"]');
  const seen = new Set(); let maxChoices = 0, steps = 0;
  for (let guard = 0; guard < 16; guard++) {
    const node = await evaluate(`document.querySelector('.scene')?.dataset.sceneNode ?? ''`);
    if (!node) break;
    seen.add(node);
    const count = await evaluate(`document.querySelectorAll('.scene-choice').length`); maxChoices = Math.max(maxChoices, count);
    for (const [width, height, mobile] of SIZES) {
      await viewport(width, height, mobile); await pause(250);
      const g = await geometry('.scene-choice', '.scene-choices');
      assert.deepEqual(g.bad, [], `comizio «${node}» ${width}×${height}: ${count} pulsanti distinti, interi e toccabili`);
      assert.equal(await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1'), true, `comizio «${node}» ${width}×${height}: nessuno scorrimento orizzontale`);
      const controls = await geometry('[data-scene-abandon], [data-stage-skip], [data-stage-pause], [data-scene-motion-set]', '.scene');
      assert.deepEqual(controls.bad.filter(item => !item.startsWith('troppo')), [], `comizio «${node}» ${width}×${height}: i controlli non si sovrappongono`);
    }
    await viewport(390, 844, true);
    if (node === 'saluto' && steps === 0) { await lang('en'); const g = await geometry('.scene-choice', '.scene-choices'); assert.deepEqual(g.bad.filter(item => !item.startsWith('troppo')), [], 'comizio in inglese: nessuna sovrapposizione'); await lang('it'); }
    if (node === 'uscita' || node === 'esito' || (await evaluate(`Boolean(document.querySelector('[data-scene-choice="fine"]'))`))) break;
    const choices = await evaluate(`[...document.querySelectorAll('[data-scene-choice]:not([disabled])')].map(b => b.dataset.sceneChoice)`);
    await click(`[data-scene-choice="${choices[steps++ % choices.length]}"]`);
  }
  assert.ok(seen.size >= 5, `Il comizio attraversa i suoi momenti (${[...seen].join(', ')})`);
  assert.ok(maxChoices >= 3, `Con ${maxChoices} azioni disponibili nel momento più pieno`);
  await S('store.sceneAbandon(); return true;');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
  console.log(`Pulsanti della campagna e del comizio verificati in Chrome a 320, 360, 390, 430, 768 e 1440 px: ogni riga delle attività (comizio compreso) senza parti sovrapposte, pulsanti interi e toccabili; la scena del comizio in ${seen.size} momenti (fino a ${maxChoices} azioni) con pulsanti distinti, anche in inglese.`);
}, { voter: true });
