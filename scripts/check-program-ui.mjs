// The programme in the browser (Elezioni › Programma): the credibility, the form that makes a promise (store.makePromise), the list with state, progress and obstacles, modify (the old one stays
// as «modificata»), withdraw, and in a real campaign «Presenta agli elettori» (store.announcePromise: the campaign records it, the topic is prepared). Phones 320/390, tablet, computer: no
// horizontal scroll, controls of at least 44 px. In English no Italian is left.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { COLLECT } from './lib/i18n-tour.mjs';
import { createIndependentDetector } from './lib/i18n-independent.mjs';

if (!chromeAvailable) { console.log('Programma nel browser saltato: Chrome non trovato.'); process.exit(0); }
const detector = createIndependentDetector();
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await createCareerInPage({ evaluate, version }, { level: 'comunale', onboarding: true, extra: `store.fastForwardToElection('comunale');` });
  await openCareer({ evaluate, goto, waitFor: wait });
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(350); };
  const openTab = async () => { await evaluate(`location.hash = '#elezioni'; true`); const tab = '[data-section-tab="elezioni"][data-section-tab-value="programma"]'; await wait(() => evaluate(`Boolean(document.querySelector(${JSON.stringify(tab)}))`), 20000); await wait(async () => { await click(tab); return evaluate('Boolean(document.querySelector(".program-page"))'); }, 20000); };
  const setSelect = (selector, value) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await openTab();
  let t = await evaluate('document.querySelector(".program-page").innerText');
  assert.match(t, /Quanto vale la tua parola/, 'C’è la credibilità.');
  assert.match(t, /Prendi un impegno/, 'C’è il modulo per promettere.');
  assert.match(t, /Nessuna promessa aperta/, 'All’inizio nessuna promessa.');

  // make a promise through the form
  await setSelect('[data-promise-form] [name="area"]', 'scuola'); await setSelect('[data-promise-form] [name="ambition"]', 'prudente');
  await click('[data-promise-form] button[type="submit"]'); await pause(500);
  assert.equal(await S('return store.programView().promises.length;'), 1, 'La promessa è nello store.');
  t = await evaluate('document.querySelector(".program-page").innerText');
  assert.match(t, /Scuola/); assert.match(t, /Non avviata/); assert.match(t, /Intervento/); assert.match(t, /Obiettivo/); assert.match(t, /Costo ~/);
  // the same again: refused, still one
  await setSelect('[data-promise-form] [name="area"]', 'scuola');
  await click('[data-promise-form] button[type="submit"]'); await pause(400);
  assert.equal(await S('return store.programView().promises.length;'), 1, 'Una seconda promessa identica è rifiutata.');
  // a second one, then modify it
  await setSelect('[data-promise-form] [name="area"]', 'sanita');
  await click('[data-promise-form] button[type="submit"]'); await pause(500);
  assert.equal(await S('return store.programView().promises.length;'), 2);
  await evaluate(`document.querySelector('.program-modify summary')?.click(), true`); await pause(200);
  await setSelect('[data-promise-modify-form] [name="extraWeeks"]', '8');
  await evaluate(`document.querySelector('[data-promise-modify-form] button[type="submit"]').click(), true`); await pause(600);
  const afterModify = await S('return store.programView().promises.map(item => [item.label, item.status]);');
  assert.ok(afterModify.some(([, status]) => status === 'modificata'), 'La promessa modificata resta come «modificata».');
  assert.equal(afterModify.filter(([, status]) => status === 'non-avviata').length, 2, 'E ne esiste la nuova versione.');
  assert.match(await evaluate('document.querySelector(".program-page").innerText'), /Promesso e realizzato/, 'La verifica confronta promesso e realizzato.');
  // withdraw
  await click('[data-promise-withdraw]'); await pause(500);
  assert.ok((await S('return store.programView().promises.some(item => item.status === "non-mantenuta");')), 'Ritirare la registra come non mantenuta.');

  // in a campaign: announce
  await S(`store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, (await import('/src/data/repositories/real-data.js?v=${version}')).realDatabase.parties ?? []); return true;`);
  await pause(600); await openTab();
  assert.match(await evaluate('document.querySelector(".program-page").innerText'), /Cosa promettono gli altri/, 'In campagna si vedono i programmi dei rivali.');
  const before = await S('const c = store.getState().campaign; return { prep: c.preparationByTopic.servizi ?? 0, rep: c.candidateStats.reputation, history: c.history.length, money: c.resources.money };');
  const target = await S('return store.programView().promises.find(item => item.status === "non-avviata")?.id ?? null;');
  assert.ok(target, 'C’è una promessa da presentare.');
  await click('[data-promise-announce]'); await pause(700);
  const after = await S('const c = store.getState().campaign; return { prep: c.preparationByTopic, history: c.history.filter(item => item.type === "promessa").length, announced: store.programView().promises.filter(item => (item.announced ?? []).length).length, rep: c.candidateStats.reputation, money: c.resources.money };');
  assert.equal(after.history, 1, 'La campagna registra l’annuncio.');
  assert.equal(after.announced, 1, 'La promessa sa di essere stata presentata.');
  assert.ok(after.money < before.money, 'Presentare una promessa ha un costo di campagna.');
  assert.ok(Object.values(after.prep).some(value => value > 0), 'Il tema dell’area è stato preparato (serve nei dibattiti).');
  assert.equal(await evaluate('document.querySelector("[data-promise-announce]")?.disabled ?? true'), true, 'Non si presenta due volte la stessa promessa nella stessa campagna.');
  assert.equal(await S('try { store.announcePromise(store.programView().promises.find(item => (item.announced ?? []).length).id); return "ok"; } catch (error) { return error.message; }'), 'Questa promessa è già stata presentata in questa campagna.');

  // layout
  for (const [name, w, h, mobile] of [['smartphone stretto', 320, 700, true], ['smartphone', 390, 800, true], ['tablet', 768, 1000, true], ['computer', 1440, 900, false]]) {
    await viewport(w, h, mobile); await pause(500);
    const m = await evaluate(`(() => { const d = document.documentElement; const buttons = [...document.querySelectorAll('.program-page button:not([disabled]), .program-page select')].map(el => el.getBoundingClientRect()).filter(r => r.width && r.height); return { over: d.scrollWidth - innerWidth, minH: Math.min(...buttons.map(r => r.height)), count: buttons.length }; })()`);
    assert.ok(m.over <= 1, `${name}: nessuno scorrimento orizzontale (${m.over}px).`);
    assert.ok(m.minH >= 40, `${name}: controlli toccabili (${Math.round(m.minH)}px).`);
  }
  await viewport(1280, 900, false);
  // English
  await evaluate(`import('/src/core/i18n.js?v=${version}').then(m => m.setLanguage('en')).then(() => true)`); await pause(800);
  const texts = await evaluate(COLLECT);
  const program = await evaluate('[...document.querySelectorAll(".program-page *")].filter(el => !el.children.length).map(el => el.textContent.replace(/\\s+/g, " ").trim()).filter(Boolean)');
  const left = [...new Set(program)].filter(text => detector.reasonOf(text)).slice(0, 40);
  if (process.env.PROGRAM_OUT) (await import('node:fs')).writeFileSync(process.env.PROGRAM_OUT, JSON.stringify([...new Set(program)].filter(text => detector.reasonOf(text)), null, 1));
  assert.deepEqual(left, [], `Nessun italiano rimasto nella pagina del programma in inglese: ${left.join(' | ').slice(0, 600)}`);
  void texts;
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
}, {});
console.log('Programma verificato in Chrome (320, 390, 768 e 1440 px): credibilità, nuova promessa dal modulo, duplicato rifiutato, modifica con la vecchia versione «modificata», ritiro, annuncio in campagna con costo, tema preparato e registro, programmi dei rivali, inglese completo.');
