// The open vote in English, in Chrome: Home with the notice, the sitting (assembly, measure, content, the President, the ballot), the result of a simulated vote, the Aula followed live, and a council vote.
// In English not a word of Italian is left (the names of people, parties, places and the titles of the bills of the game's data are not counted).
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { COLLECT } from './lib/i18n-tour.mjs';
import { createIndependentDetector } from './lib/i18n-independent.mjs';

if (!chromeAvailable) { console.log('Votazione aperta in inglese saltata: Chrome non trovato.'); process.exit(0); }
const detector = createIndependentDetector();
const found = [];
const known = [];
const scan = async (name, evaluate, selector = 'body') => {
  const texts = await evaluate(`(() => { const root = document.querySelector(${JSON.stringify(selector)}) ?? document.body; const out = []; const walk = node => { if (node.nodeType === 3) { const t = node.nodeValue.replace(/\\s+/g, ' ').trim(); if (t) out.push(t); return; } if (node.nodeType !== 1 || ['SCRIPT','STYLE','svg'].includes(node.tagName) || node.hasAttribute('data-no-translate')) return; for (const a of ['title','aria-label','placeholder']) { const v = node.getAttribute(a); if (v && v.trim()) out.push(v.trim()); } for (const c of node.childNodes) walk(c); }; walk(root); return out; })()`);
  for (const text of [...new Set(texts)]) { const clean = known.reduce((acc, item) => acc.split(item).join(''), text); const reason = clean.trim() ? detector.reasonOf(clean) : null; if (reason) found.push(`${name}: ${text.slice(0, 170)}`); }
};
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, version }) => {
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const click = async sel => { await evaluate(`document.querySelector(${JSON.stringify(sel)})?.click(), true`); await pause(300); };
  const has = sel => evaluate(`Boolean(document.querySelector(${JSON.stringify(sel)}))`);
  await createCareerInPage({ evaluate, version }, { level: 'deputato', onboarding: true, extra: '' });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off' })); import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(1000);
  await S(`let i = 0; for (; i < 80 && !store.openVotes().some(v => v.scope === 'nazionale'); i++) store.advance(7); return i;`);
  const open = JSON.parse(await S(`return JSON.stringify(store.openVotes()[0])`));
  known.push(open.title, open.proposer, ...open.content.map(item => item.value));
  await evaluate(`location.hash = '#panoramica'; true`); await pause(1500);
  await wait(() => has('[data-floor-offer]'), 15000);
  await scan('home', evaluate, '[data-floor-band]');
  console.log('pulsanti:', await evaluate(`[...document.querySelectorAll('[data-floor-open]')].map(b => b.textContent.trim()).join(' | ')`));
  assert.match(await evaluate(`document.querySelector('[data-floor-mode="diretta"]').textContent`), /FOLLOW LIVE/);
  assert.match(await evaluate(`document.querySelector('[data-floor-mode="simulata"]').textContent`), /SIMULATE VOTE/);
  await click('[data-floor-open][data-floor-mode="simulata"]'); await wait(() => has('.floor-overlay'), 8000);
  await wait(() => evaluate(`document.querySelector('.floor-overlay')?.dataset.floorPhase === 'voto'`), 8000); await pause(400);
  await scan('seduta', evaluate, '.floor-overlay');
  await click('[data-floor-choice="astenuto"]'); await scan('seduta-scelta', evaluate, '.floor-overlay');
  await click('[data-floor-confirm]'); await wait(() => evaluate(`document.querySelector('.floor-overlay')?.dataset.floorPhase === 'esito'`), 8000); await pause(400);
  await scan('esito', evaluate, '.floor-overlay');
  await click('[data-floor-review]'); await wait(() => has('.aula-overlay:not(.floor-overlay)'), 8000); await pause(500);
  await scan('aula-storico', evaluate, '.aula-overlay');
  await click('[data-aula-close]');
  // the next vote, live
  await S(`for (let i = 0; i < 80 && !store.openVotes().length; i++) store.advance(7); return true;`);
  await evaluate(`location.hash = '#parlamento'; true`); await pause(500); await evaluate(`location.hash = '#panoramica'; true`); await pause(1200);
  await evaluate(`document.documentElement.dataset.sceneMotion = 'full', true`);
  const next = JSON.parse(await S(`return JSON.stringify(store.openVotes()[0])`)); known.push(next.title, next.proposer, ...next.content.map(item => item.value));
  await click('[data-floor-open][data-floor-mode="diretta"]'); await wait(() => evaluate(`document.querySelector('.floor-overlay')?.dataset.floorPhase === 'voto'`), 20000);
  await scan('diretta-seduta', evaluate, '.floor-overlay');
  await click('[data-floor-choice="favorevole"]'); await click('[data-floor-confirm]'); await wait(() => has('.aula-overlay:not(.floor-overlay)'), 8000); await pause(1500);
  await scan('aula-diretta', evaluate, '.aula-overlay');
  await wait(() => evaluate(`document.querySelector('.aula-overlay')?.dataset.aulaFinal === '1'`), 40000);
  await scan('aula-fine', evaluate, '.aula-overlay');
  assert.deepEqual(found, [], `Italiano rimasto nella votazione aperta in inglese:\n${found.join('\n')}`);
}, { voter: false });
console.log('Votazione aperta in inglese verificata: Home, seduta, scheda, esito, Aula storica e in diretta senza italiano.');
