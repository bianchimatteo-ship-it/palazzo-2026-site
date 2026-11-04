// The way to play in the real interface (Chrome), in Italian and in English: the choice comes BEFORE the six steps of the new career (which are unchanged), is saved with the career and survives a reload;
// the notice of the offices that a win would leave appears before the candidacy is confirmed, apart from the requirements that bar a candidacy, and not at all when nothing lapses.
import assert from 'node:assert/strict';
import { withBrowser, createCareerInPage, openCareer, chromeAvailable } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Modalità di gioco nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).'); process.exit(0); }
const checks = [];
for (const language of ['it', 'en']) {
  await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
    const T = (it, en) => language === 'en' ? en : it;
    await viewport(1280, 900, false);
    await evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })); true`);
    await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu]"))')); await pause(800);
    // 1. the gate comes first
    await evaluate(`document.querySelector('[data-menu="nuova"]:not([disabled])').click(); true`);
    await wait(() => evaluate('Boolean(document.querySelector(".wizard-mode-gate"))'));
    const gate = await evaluate(`(() => { const g = document.querySelector('.wizard-mode-gate'); return { cards: [...g.querySelectorAll('[data-wizard-mode]')].map(b => [b.dataset.wizardMode, b.querySelector('strong').textContent.trim(), b.textContent.length]), title: g.querySelector('h1').textContent.trim(), steps: g.querySelectorAll('.wizard-chips li, .wizard-step').length, firstField: Boolean(g.querySelector('[name="firstName"]')) }; })()`);
    assert.deepEqual(gate.cards.map(c => c.slice(0, 2)), [['realistica', T('Realistica', 'Realistic')], ['sandbox', T('Modalità libera', 'Free mode')]], 'La schermata iniziale ha le due modalità');
    assert.equal(gate.title, T('Come vuoi giocare?', 'How do you want to play?'));
    assert.equal(gate.steps, 0); assert.equal(gate.firstField, false, 'Prima dei sei passaggi, non dentro il wizard');
    // cancelling goes back to the menu and creates nothing; opening again asks again
    await evaluate(`document.querySelector('.wizard-mode-gate [data-wizard-action="cancel"]').click(); true`); await pause(300);
    assert.equal(await evaluate('Boolean(document.querySelector(".wizard-mode-gate"))'), false);
    await evaluate(`document.querySelector('[data-menu="nuova"]:not([disabled])').click(); true`);
    await wait(() => evaluate('Boolean(document.querySelector(".wizard-mode-gate"))'));
    // 2. choosing Sandbox opens the SIX steps as they are
    await evaluate(`document.querySelector('[data-wizard-mode="sandbox"]').click(); true`);
    await wait(() => evaluate('Boolean(document.querySelector(".career-wizard [name=firstName]"))'));
    const steps = await evaluate(`({ n: document.querySelectorAll('.career-wizard .wizard-chips li').length, step: document.querySelector('.career-wizard').dataset.step, gate: Boolean(document.querySelector('.wizard-mode-gate')) })`);
    assert.deepEqual(steps, { n: 6, step: '1', gate: false }, 'I sei passaggi del wizard sono invariati');
    const set = (selector, value, event = 'input') => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true })); return true; })()`);
    const next = async () => { await evaluate(`document.querySelector('.wizard-footer [data-wizard-action="next"]').click(); true`); await pause(450); };
    await set('.career-wizard [name="firstName"]', 'Anna'); await set('.career-wizard [name="lastName"]', 'Bianchi'); await set('.career-wizard [name="birthDate"]', '1985-04-12', 'change');
    await set('.career-wizard [name="professionChoice"]', 'Insegnante', 'change'); await pause(300); await next();
    await wait(() => evaluate('Boolean(document.querySelector("[data-wizard-region]"))'));
    await set('[data-wizard-region]', 'Toscana', 'change'); await wait(() => evaluate('Boolean(document.querySelector("[data-wizard-municipality-search]"))'));
    await set('[data-wizard-municipality-search]', 'Siena'); await wait(() => evaluate('Boolean(document.querySelector("[data-municipality-code=\\"052032\\"]"))'));
    await evaluate(`document.querySelector('[data-municipality-code="052032"]').click(); true`); await pause(300);
    await next(); await evaluate(`document.querySelector('[data-level="comunale"]').click(); true`); await pause(300);
    await next(); await next(); await next(); // party, advanced, summary
    assert.ok(/Modalità libera|Free mode/.test(await evaluate(`document.querySelector('.summary-mode')?.textContent ?? ''`)), 'Il riepilogo dice la modalità');
    await evaluate(`document.querySelector('.wizard-footer [data-wizard-action="finish"]').click(); true`);
    await wait(() => evaluate('Boolean(document.querySelector(".page-wrap"))'), 30000);
    const mode = () => evaluate(`(async () => (await import('/src/core/store.js?v=${version}')).store.getState().career.gameMode)()`);
    assert.equal(await mode(), 'sandbox', 'La modalità scelta è nella carriera appena creata');
    // 3. it survives a reload (the career is saved)
    await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'));
    await evaluate('document.querySelector("[data-menu=continua]").click(), true'); await wait(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
    assert.equal(await mode(), 'sandbox', 'Dopo il ricaricamento la carriera è ancora Sandbox');
    checks.push(`${language}: schermata prima dei sei passaggi, scelta salvata e ritrovata`);
  }, { language });
}
// 4. the notice before the candidacy
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  await viewport(1280, 900, false);
  const scenario = (level, label) => createCareerInPage({ evaluate, version }, { level, weeks: 2, name: ['Anna', 'Bianchi'], region: 'Lombardia', extra: `
    const save = JSON.parse(store.exportSave());
    const day = n => new Date(Date.parse(save.clock.currentDate + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
    save.game.elections = save.game.elections.map(e => e.type === 'regionale' ? { ...e, id: e.id + '-anticipata', status: 'open', windowOpensAt: day(-3), windowClosesAt: day(14), electionDate: day(35) } : e);
    store.loadGame(JSON.stringify(save));` });
  await goto(); await wait(() => evaluate('Boolean(document.querySelector("[data-menu]"))'));
  await scenario('deputato');
  await openCareer({ evaluate, goto, waitFor: wait }); await pause(1200);
  await evaluate(`location.hash = '#elezioni'; true`); await pause(900);
  await evaluate(`(() => { const b = [...document.querySelectorAll('[data-section-tab]')].find(x => x.dataset.sectionTabValue === 'campagna'); b?.click(); return true; })()`); await pause(900);
  await evaluate(`(() => { const b = document.querySelector('[data-campaign-goto="regionale"]'); b?.click(); return true; })()`); await pause(900);
  const box = await evaluate(`(() => { const el = document.querySelector('[data-candidacy-lapses]'); return el ? { text: el.textContent.replace(/\\s+/g, ' ').trim(), isNote: el.getAttribute('role') } : null; })()`);
  assert.ok(box, 'Prima della conferma compare l’avviso delle cariche che si perderebbero');
  assert.ok(/Deputato/.test(box.text) && /art\. 122/i.test(box.text) && /Se vinci/.test(box.text), `L’avviso nomina il seggio e la regola (${box.text.slice(0, 160)})`);
  assert.ok(/finché la vittoria non è confermata/.test(box.text), 'E dice che la carica resta fino alla vittoria');
  assert.equal(await evaluate(`Boolean(document.querySelector('.campaign-office-note [data-candidacy-lapses]'))`), false, 'L’avviso non si confonde con i requisiti che impediscono di candidarsi');
  checks.push('avviso "Se vinci, lasci…" prima della conferma (deputato → regionali), separato dai requisiti');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript');
}, { language: 'it' });
console.log(`Modalità di gioco verificate nel browser: ${checks.join(' · ')}.`);
