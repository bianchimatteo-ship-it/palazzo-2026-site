// «Chiedi al gioco» (the local assistant): the engine answers natural questions with steps, requirements and cost from the rules of the game, says «non lo so» when it cannot place a question, never touches a game; and in the
// real interface (Chrome) a question typed in the guide gets its answer and the button opens the right page. Skipped in the browser part without Chrome.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const { askGame, TOPICS, NOT_KNOWN } = await import(new URL(`../src/core/ask-game.js?v=${build}`, import.meta.url).href);
const expectFirst = {
  'Come mi candido alle elezioni?': 'candidarsi', 'Non riesco a invitare un partito nell’alleanza': 'alleanza', 'come faccio una promessa ai cittadini': 'promesse', 'voglio che lo staff voti al posto mio': 'staff',
  'come si fa un referendum abrogativo': 'referendum', 'dove vedo i sondaggi': 'sondaggi', 'come lascio il partito': 'cambiopartito', 'come presento una proposta di legge': 'leggi', 'come funziona la notte elettorale': 'notte', 'raccolta firme per una iniziativa popolare': 'iniziative'
};
for (const [question, id] of Object.entries(expectFirst)) assert.equal(askGame(question).answers[0]?.id, id, `«${question}» → ${id}`);
assert.equal(askGame('qual è il senso della vita').known, false, 'Una domanda fuori tema non inventa una risposta.');
assert.ok(NOT_KNOWN.startsWith('Non lo so'));
assert.equal(askGame('').answers.length, 0);
for (const topic of TOPICS) assert.ok(topic.steps.length >= 1 && topic.needs && topic.cost && topic.title, `Ogni argomento ha passi, requisiti e costo (${topic.id}).`);
// the facts written here match the rules of the engine
const alliance = TOPICS.find(item => item.id === 'alleanza');
assert.match(alliance.cost, /4 punti di capitale politico/); assert.match(alliance.needs, /segretario/);
console.log(`Chiedi al gioco (motore): ${Object.keys(expectFirst).length} domande riconosciute, domanda fuori tema → «non lo so», ${TOPICS.length} argomenti con passi, requisiti e costo.`);
const { chromeAvailable, createCareerInPage, openCareer, withBrowser } = await import('./lib/browser.mjs');
if (!chromeAvailable) process.exit(0);
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, version }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'it', weeklyReport: 'off' })); true`);
  await evaluate(`(() => { document.querySelector('[data-action="menu"]')?.click(); return true; })()`); await pause(500);
  await evaluate(`(() => { document.querySelector('[data-menu="guida"]')?.click(); return true; })()`); await pause(500);
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-ask-form]'))`), true, 'La guida ha «Chiedi al gioco».');
  await evaluate(`(() => { const input = document.querySelector('[data-ask-form] input'); input.value = 'come invito un partito nella coalizione'; document.querySelector('[data-ask-form]').requestSubmit(); return true; })()`); await pause(500);
  const shown = await evaluate(`[...document.querySelectorAll('[data-ask-answer]')].map(el => el.dataset.askAnswer)`);
  assert.ok(shown.includes('alleanza'), `La risposta compare (${shown.join(',')}).`);
  assert.equal(await evaluate(`/4 punti di capitale politico/.test(document.querySelector('[data-ask-answer="alleanza"]').innerText)`), true, 'La risposta indica il costo.');
  await evaluate(`(() => { document.querySelector('[data-ask-open="sondaggi"]')?.click(); return true; })()`); await pause(1200);
  assert.equal(await evaluate(`location.hash`), '#sondaggi', 'Il pulsante apre la schermata giusta.');
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-ask-form]'))`), false, 'Il menu si è chiuso.');
  console.log('Chiedi al gioco (Chrome): domanda → risposta con costo → «Apri la schermata» porta a Sondaggi.');
});
