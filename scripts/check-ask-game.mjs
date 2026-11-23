// «Chiedi al gioco» (the local assistant): the engine answers natural questions with steps, requirements and cost from the rules of the game, says «non lo so» when it cannot place a question, never touches a game; and in the
// real interface (Chrome) a question typed in the guide gets its answer and the button opens the right page. Skipped in the browser part without Chrome.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const { askGame, TOPICS, NOT_KNOWN, askTopics } = await import(new URL(`../src/core/ask-game.js?v=${build}`, import.meta.url).href);
// 56 questions in Italian and English: the ONE main answer expected (the first topic), plus vague, ambiguous and off-topic ones that must NOT get a random answer.
const CASES = [
  // [question, expected first topic id | 'unknown' | 'clarify']
  ['Come mi candido alle elezioni?', 'candidarsi'], ['Voglio candidarmi alle politiche', 'candidarsi'], ['How do I run for election?', 'candidarsi'], ['Non riesco a candidarmi: perché?', 'candidarsi'],
  ['Come funziona la campagna elettorale?', 'campagna'], ['How does the campaign work?', 'campagna'],
  ['Non riesco a invitare un partito nell’alleanza', 'alleanza'], ['Come creo una coalizione?', 'alleanza'], ['How can I form an alliance?', 'alleanza'], ['come invito un partito nella coalizione', 'alleanza'],
  ['Come diventare segretario del partito?', 'segretario'], ['How do I become party secretary?', 'segretario'], ['come fondo un partito', 'segretario'],
  ['come faccio una promessa ai cittadini', 'promesse'], ['Come mantengo le promesse elettorali?', 'promesse'], ['How do I keep a promise?', 'promesse'],
  ['voglio che lo staff voti al posto mio', 'staff'], ['Come delego le votazioni allo staff?', 'staff'], ['How do I delegate votes to the staff?', 'staff'],
  ['Come funzionano le simulazioni di quattro settimane?', 'settimane'], ['Come avanzare di 2 settimane?', 'settimane'], ['How do the four-week simulations work?', 'settimane'], ['il gioco si ferma dopo una settimana, perché?', 'settimane'],
  ['dove vedo i sondaggi', 'sondaggi'], ['Where are the polls?', 'sondaggi'],
  ['Come si forma un governo?', 'governo'], ['Come diventare ministro?', 'governo'], ['How does the government work?', 'governo'],
  ['Cos’è il voto di fiducia?', 'fiducia'], ['What happens in a confidence vote?', 'fiducia'],
  ['Come aumentare la fiducia nel partito?', 'sostegno'], ['How do I raise trust in my party?', 'sostegno'],
  ['Come funziona la maggioranza?', 'maggioranza'], ['Chi è all’opposizione?', 'maggioranza'],
  ['Come voto in Parlamento?', 'parlamento'], ['How do I vote in the Senate?', 'parlamento'],
  ['come presento una proposta di legge', 'leggi'], ['Cosa cambierebbe con una legge?', 'leggi'], ['How do I amend a law?', 'leggi'],
  ['Come raccolgo le firme per un’iniziativa popolare?', 'iniziative'], ['raccolta firme per una legge', 'iniziative'],
  ['come si fa un referendum abrogativo', 'referendum'], ['Can I call a referendum?', 'referendum'],
  ['come lascio il partito', 'uscita'], ['Come cambio partito?', 'uscita'], ['How do I leave my party?', 'uscita'],
  ['Come mi iscrivo a un partito?', 'iscrizione'], ['How do I join a party?', 'iscrizione'],
  ['Come aumentare i fondi?', 'fondi'], ['How can I raise funds?', 'fondi'], ['Come faccio una raccolta fondi?', 'fondi'],
  ['Cos’è il capitale politico?', 'capitale'], ['How do I earn political capital?', 'capitale'],
  ['Come mi dimetto da un incarico?', 'dimissioni'], ['How do I resign?', 'dimissioni'],
  ['come funziona la notte elettorale', 'notte'], ['What is election night?', 'notte'],
  ['Come cambio la lingua?', 'impostazioni'], ['Come salvo la partita?', 'salvataggi'], ['Come cambio avatar?', 'avatar'], ['Dov’è il tutorial?', 'guida'],
  // vague, ambiguous and off-topic: never a random answer
  ['qual è il senso della vita', 'unknown'], ['Che tempo fa domani?', 'unknown'], ['Chi ha vinto il mondiale?', 'unknown'], ['asdf qwerty', 'unknown'], ['How tall is Mount Everest?', 'unknown'],
  ['aiuto', 'unknown'], ['come funziona?', 'unknown'], ['non capisco', 'unknown'], ['help me', 'unknown'],
  ['partito', 'clarify'], ['elezioni', 'clarify'], ['voto', 'clarify']
];
const failures = [];
for (const [question, expected] of CASES) {
  const result = askGame(question, { lang: /^[A-Za-z ,?'’]+$/.test(question) && /\b(how|what|where|can|do|help|who|is)\b/i.test(question) ? 'en' : 'it' });
  const got = expected === 'unknown' ? (result.known || result.clarify.length ? `answered:${result.answers[0]?.id ?? result.clarify[0]?.id}` : 'unknown')
    : expected === 'clarify' ? (!result.known && result.clarify.length ? 'clarify' : `got:${result.answers[0]?.id ?? 'unknown'}`)
      : result.answers[0]?.id ?? (result.clarify.length ? 'clarify' : 'unknown');
  if (got !== expected && !(expected === 'clarify' && got === 'clarify')) failures.push(`«${question}» → ${got} (atteso ${expected})`);
  // normally ONE answer: two only when the question is flagged as ambiguous
  if (result.known && result.answers.length > 1 && !result.ambiguous) failures.push(`«${question}»: due risposte senza ambiguità`);
  if (result.known && result.answers.length > 2) failures.push(`«${question}»: più di due risposte`);
}
const oneAnswer = CASES.filter(([q, e]) => !['unknown', 'clarify'].includes(e)).filter(([q]) => askGame(q).answers.length === 1).length;
const total = CASES.filter(([q, e]) => !['unknown', 'clarify'].includes(e)).length;
assert.equal(failures.length, 0, `Domande non riconosciute bene (${failures.length}):\n- ${failures.join('\n- ')}`);
assert.ok(oneAnswer / total >= 0.85, `Normalmente una sola risposta (${oneAnswer}/${total}).`);
assert.ok(NOT_KNOWN.startsWith('Non lo so'));
assert.equal(askGame('').answers.length, 0); assert.equal(askGame('   ').known, false);
for (const lang of ['it', 'en']) for (const topic of askTopics(lang)) assert.ok(topic.steps.length >= 1 && topic.needs && topic.cost && topic.title, `Ogni argomento ha passi, requisiti e costo (${topic.id}/${lang}).`);
assert.equal(askTopics('it').length, askTopics('en').length, 'Ogni argomento esiste nelle due lingue.');
// English answers are English (no Italian left in a topic) and Italian ones are Italian
for (const topic of askTopics('en')) assert.ok(!/\b(il|della|che|sono|puoi|serve|nel|nella|dal|alla)\b/i.test([topic.title, ...topic.steps, topic.needs, topic.cost].join(' ')), `${topic.id}: la versione inglese non contiene italiano.`);
// every page a topic opens exists
const PAGES = new Set(['panoramica', 'carriera', 'calendario', 'eventi', 'ricompense', 'partito', 'finanze', 'partiti-lista', 'elezioni', 'risultati', 'sondaggi', 'parlamento', 'governo', 'diplomazia', 'quirinale', 'leggi', 'iniziative', 'referendum', 'territori', 'notizie', 'archivio', 'politici', 'profilo', 'impostazioni']);
for (const topic of TOPICS) assert.ok(!topic.nav || PAGES.has(topic.nav), `${topic.id}: la schermata «${topic.nav}» esiste.`);
// the facts written here match the rules of the engine
const alliance = TOPICS.find(item => item.id === 'alleanza');
assert.match(alliance.cost, /4 punti di capitale politico/); assert.match(alliance.needs, /segretario/);
const weeks = TOPICS.find(item => item.id === 'settimane');
assert.ok(weeks.steps.join(' ').includes('1, 2 o 4 settimane') && /decisione urgente/.test(weeks.steps.join(' ')), 'Le settimane: 1, 2 o 4 e i motivi di arresto.');
console.log(`Chiedi al gioco (motore): ${CASES.length} domande italiane e inglesi (${total} con risposta precisa, ${oneAnswer} con una sola risposta, vaghe/ambigue/fuori tema senza risposte casuali), ${TOPICS.length} argomenti in due lingue con passi, requisiti, costo e schermata esistente.`);
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
// the assistant in English, the example chips, the «did you mean…» suggestions and the unknown answer, in the real interface
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, version, errors }) => {
  await createCareerInPage({ evaluate, version }, { weeks: 2 });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`localStorage.setItem('politicando.settings.v1', JSON.stringify({ newsPopup: 'off', sceneMotion: 'off', language: 'en', weeklyReport: 'off' })); import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(1200);
  await evaluate(`document.querySelector('[data-action="menu"]')?.click(), true`); await pause(500);
  await evaluate(`document.querySelector('[data-menu="guida"]')?.click(), true`); await pause(600);
  const ask = async question => { await evaluate(`(() => { const input = document.querySelector('[data-ask-form] input'); input.value = ${JSON.stringify(question)}; document.querySelector('[data-ask-form]').requestSubmit(); return true; })()`); await pause(500); };
  await ask('How do I leave my party?');
  assert.equal(await evaluate(`document.querySelector('[data-ask-answer="uscita"] h4')?.textContent`), 'Leave or change party', 'In inglese la risposta è in inglese.');
  assert.ok(!/Lascia|Apri|Costo|Che cosa serve/.test(await evaluate(`document.querySelector('[data-ask-game]').innerText`)), 'Nessun italiano nella risposta inglese.');
  await ask('party');
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-ask-clarify]')) && document.querySelectorAll('[data-ask-pick]').length > 0`), true, 'Una domanda vaga chiede che cosa si intendeva.');
  await evaluate(`document.querySelector('[data-ask-pick]').click(), true`); await pause(400);
  assert.equal(await evaluate(`document.querySelectorAll('[data-ask-answer]').length`), 1, 'Scegliendo un suggerimento compare una sola risposta.');
  await ask('What is the weather tomorrow?');
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-ask-unknown]')) && document.querySelectorAll('[data-ask-answer]').length === 0`), true, 'Fuori tema: «non lo so», nessuna risposta casuale.');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
  console.log('Chiedi al gioco (Chrome, inglese): risposta in inglese, «intendevi…?», suggerimento, fuori tema.');
});
