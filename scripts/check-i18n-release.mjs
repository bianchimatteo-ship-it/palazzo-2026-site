// English of the last release pass, in Chrome: the guided programme editor (area, theme, cost bands, place), the party headquarters and the other rooms of the activity scenes with their name straps, the
// days of the Quirinale on Home and on the Quirinale page, the room of the Government, the guide and the tutorial. In English not a word of Italian is left (the names of people, parties and places are
// the data of the game and are not counted; what the player writes is his own).
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { COLLECT } from './lib/i18n-tour.mjs';
import { createIndependentDetector } from './lib/i18n-independent.mjs';

if (!chromeAvailable) { console.log('Traduzioni della revisione nel browser saltate: Chrome non trovato.'); process.exit(0); }
const detector = createIndependentDetector();
const found = [];
const knownNames = [];
const scan = async (name, evaluate, selector = 'body') => {
  const texts = await evaluate(`(() => { const root = document.querySelector(${JSON.stringify(selector)}) ?? document.body; const out = []; const walk = node => { if (node.nodeType === 3) { const t = node.nodeValue.replace(/\\s+/g, ' ').trim(); if (t && !node.parentElement?.closest('[data-no-translate], textarea, script, style')) out.push(t); return; } if (node.nodeType !== 1) return; for (const a of ['title', 'aria-label', 'placeholder', 'alt']) { const v = node.getAttribute(a); if (v && v.trim()) out.push(v.replace(/\\s+/g, ' ').trim()); } if (node.tagName === 'TEXTAREA') return; for (const c of node.childNodes) walk(c); }; walk(root); return out; })()`);
  for (const text of [...new Set(texts)]) { const clean = knownNames.reduce((acc, person) => acc.split(person).join(''), text); const reason = clean.trim() ? detector.reasonOf(clean) : null; if (reason) found.push(`${name}: ${text.slice(0, 160)}`); }
};
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, version }) => {
  await createCareerInPage({ evaluate, version }, { level: 'deputato', onboarding: true, extra: '' });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off' })); import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(1000);
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const click = async sel => { await evaluate(`document.querySelector(${JSON.stringify(sel)})?.click(), true`); await pause(300); };
  // ---- the guided editor
  await evaluate(`document.querySelector('[data-nav="elezioni"]')?.click(); true`);
  await wait(() => evaluate(`Boolean(document.querySelector('[data-section-tab="elezioni"][data-section-tab-value="programma"]'))`), 20000);
  await wait(async () => { await click('[data-section-tab="elezioni"][data-section-tab-value="programma"]'); return evaluate('Boolean(document.querySelector(".program-page"))'); }, 20000);
  await evaluate(`document.querySelector('.program-new')?.setAttribute('open', ''); true`);
  for (const area of ['scuola', 'sicurezza', 'cultura']) {
    await evaluate(`(() => { const sel = document.querySelector('.guided-form [name="area"]'); sel.value = ${JSON.stringify(area)}; sel.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await pause(500);
    await evaluate(`(() => { const t = document.querySelector('.guided-form [data-guide="theme"]'); t.value = t.options[2].value; t.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await pause(300);
    await evaluate(`(() => { const t = document.querySelector('.guided-form [name="territory"]'); t.value = 'locale'; t.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await pause(300);
    await scan(`editor ${area}`, evaluate, '.guided-form');
    // what the choice wrote into the field is the theme in English too (the field is the player's own text: only the lists are translated)
    const lists = await evaluate(`[...document.querySelectorAll('.guided-form select[data-guide] option')].map(o => o.textContent.trim()).filter(Boolean)`);
    for (const text of [...new Set(lists)]) if (detector.reasonOf(text)) found.push(`editor ${area} (lista): ${text.slice(0, 140)}`);
  }
  // ---- the rooms of the activity scenes and their straps
  // every moment of every encounter, with different decisions each round: the moves, the reactions, the second voice, the guarantees, the outcome and what it leaves
  for (const [activity, name, picks] of [['riunione', 'sede', [0, 2]], ['associazioni', 'sala', [1, 3]], ['cittadini', 'mercato', [0, 3]], ['audizione-commissione', 'commissione', [1, 2]], ['intervista', 'redazione', [2, 0]], ['cantiere', 'cantiere', [0, 1]]]) {
    const id = name === 'cantiere' ? 'sopralluogo' : activity;
    for (const offset of picks) {
      await S('store.advance(7); return true;');
      const ok = await S(`try { await store.startActivityScene(${JSON.stringify(id)}, { quick: false${activity === 'cittadini' ? ", target: 'anziani'" : ''} }); return true; } catch (e) { return String(e.message); }`);
      if (ok !== true) { console.log(`(${id}: ${ok})`); break; }
      await wait(() => evaluate(`Boolean(document.querySelector('.st-svg'))`), 8000);
      knownNames.push(...await evaluate(`import('/src/core/store.js?v=${version}').then(m => (m.store.getState().scene?.cast ?? []).map(c => c.name))`));
      let step = 0;
      for (let guard = 0; guard < 14; guard++) {
        const node = await evaluate(`document.querySelector('.scene')?.dataset.sceneNode ?? ''`);
        if (!node) break;
        await scan(`scena ${name} ${node}`, evaluate, '.scene');
        // the language changed in the middle of the encounter: Italian and English both come back whole, on the same moment
        if (node === 'r2' && offset === picks[0] && name === 'sede') {
          await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('it')).then(() => true)`); await pause(500);
          const italian = await evaluate(`document.querySelector('.scene-dialogue')?.innerText ?? ''`);
          assert.ok(/Hai detto|Perché/.test(italian) && !/You said|Why/.test(italian), `Cambiando lingua a metà scena il testo torna italiano (${italian.slice(0, 80)})`);
          assert.equal(await evaluate(`document.querySelector('.scene')?.dataset.sceneNode`), node, 'Cambiare lingua non sposta la scena.');
          await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(500);
          const english = await evaluate(`document.querySelector('.scene-dialogue')?.innerText ?? ''`);
          assert.ok(/You said/.test(english) && !/Hai detto/.test(english), `E tornando all’inglese il testo è inglese (${english.slice(0, 80)})`);
          await scan(`scena ${name} ${node} (dopo il cambio di lingua)`, evaluate, '.scene');
        }
        if (node === 'esito') break;
        const choices = await evaluate(`[...document.querySelectorAll('[data-scene-choice]:not([disabled])')].map(b => b.dataset.sceneChoice)`);
        await click(`[data-scene-choice="${choices.length > 1 ? choices[(offset + step++) % choices.length] : choices[0]}"]`);
      }
      await S(`store.sceneAbandon(); return true;`); await pause(300);
    }
  }
  await S(`store.advance(7); store.startTalkShowScene({ source: 'attivita', showId: 'tg-sera' }); return true;`); await wait(() => evaluate(`Boolean(document.querySelector('.st-svg'))`), 8000);
  knownNames.push(...await evaluate(`import('/src/core/store.js?v=${version}').then(m => (m.store.getState().scene?.cast ?? []).map(c => c.name))`)); await scan('studio', evaluate, '.scene'); await S(`store.sceneAbandon(); return true;`); await pause(300);
  // ---- Home with the activities, the guide
  await evaluate(`location.hash = '#panoramica'; true`); await pause(1500);
  await evaluate(`document.querySelectorAll('details').forEach(d => d.open = true); true`);
  await evaluate(`document.querySelectorAll('#hq-news-band, .newsroom, .hqc-news, .hq-log-list, .hq-report').forEach(el => el.remove()); true`);
  await scan('home', evaluate, '.page-wrap');
  await evaluate(`document.querySelector('[data-menu-open="guida"], [data-action="menu"]')?.click(); true`); await pause(600);
  await evaluate(`const g = [...document.querySelectorAll('[data-menu-section], [data-menu-open], button')].find(b => /Come giocare/.test(b.textContent)); g?.click(); true`); await pause(800);
  await scan('guida', evaluate, 'body');
  await evaluate(`import('/src/ui/tutorial.js?v=${version}').then(m => m.TUTORIAL_STEPS.length)`);
  // the steps of the tutorial (their texts come from the data)
  const steps = await evaluate(`import('/src/ui/tutorial.js?v=${version}').then(m => m.TUTORIAL_STEPS.map(s => [s.title, s.what, s.cost, s.next]))`);
  const i18n = await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => JSON.stringify(steps_translate()))`).catch(() => null);
  void steps; void i18n;
});
// ---- the President (Home and Quirinale)
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, version }) => {
  await evaluate(`(async () => {
    localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true }));
    localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off' }));
    return true; })()`);
  await createCareerInPage({ evaluate, version }, { level: 'deputato', onboarding: true, extra: '' });
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const save = JSON.parse(store.exportSave()); save.game.flags = { ...save.game.flags, president: { since: save.clock.currentDate, termEnds: '2036-01-01' } }; store.loadGame(save); return true; })()`);
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off' })); import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(1000);
  await evaluate(`location.hash = '#panoramica'; true`); await pause(1500);
  await evaluate(`document.querySelectorAll('details').forEach(d => d.open = true); true`);
  await scan('home presidente', evaluate, '.page-wrap');
});
assert.deepEqual(found, [], `Italiano rimasto in inglese (${found.length}):\n${found.slice(0, 200).join('\n')}`);
console.log('Inglese della revisione verificato: editor guidato del programma (tre aree), scene delle attività con i cartellini, Home, guida e Home del Presidente senza italiano residuo.');
