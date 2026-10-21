// Party-selection filter in the career wizard: orientation / kind / status / name criteria, removal, and compatibility
// with picking a party and creating the career. Node render checks + a real browser (desktop and phone width).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterWizardParties, activePartyCriteria, removePartyCriterion, togglePartyOrientation } from '../src/ui/career-wizard.js';
import { chromeAvailable, withBrowser } from './lib/browser.mjs';

const read = f => JSON.parse(readFileSync(new URL('../src/data/real/' + f + '.json', import.meta.url), 'utf8'));
const parties = [...['parties', 'political-movements', 'coalitions'].flatMap(f => { const j = read(f); return j.items ?? j; })];

// 1. Pure filter logic, built only from fields present in the data.
const d = { partyMode: 'existing', partyQuery: '', partyFilter: 'all', partyOrient: [], partyKind: 'all', partyStatus: 'all' };
const total = filterWizardParties(parties, d).length;
assert.equal(total, parties.length, 'senza criteri compaiono tutti i partiti');
togglePartyOrientation(d, 'destra');
const right = filterWizardParties(parties, d);
assert.ok(right.length > 0 && right.length < total);
assert.ok(right.every(p => p.politicalPosition === 'destra'), 'solo partiti di destra');
togglePartyOrientation(d, 'sinistra');
const both = filterWizardParties(parties, d);
assert.equal(both.length, parties.filter(p => ['destra', 'sinistra'].includes(p.politicalPosition)).length, 'più orientamenti si sommano');
d.partyQuery = both[0].abbreviation ?? both[0].name.slice(0, 3);
assert.ok(filterWizardParties(parties, d).includes(both[0]), 'ricerca combinata con orientamento');
assert.equal(activePartyCriteria(d).length, 3);
removePartyCriterion(d, 'query', '');
removePartyCriterion(d, 'orient', 'destra');
assert.deepEqual(d.partyOrient, ['sinistra']);
removePartyCriterion(d, 'all');
assert.equal(filterWizardParties(parties, d).length, total, 'rimuovere tutti i criteri ripristina l’elenco');
assert.equal(activePartyCriteria(d).length, 0);
d.partyStatus = 'historical';
assert.ok(filterWizardParties(parties, d).every(p => p.status === 'historical'));
console.log('Filtro partiti: logica pura verificata (' + total + ' schede, orientamenti, ricerca, rimozione).');

// 2. Real browser: desktop and phone; the filtered party can be selected and the wizard keeps its flow.
if (!chromeAvailable) { console.log('Filtro partiti nel browser saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors }) => {
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ' + ${JSON.stringify(selector)}); el.click(); return true; })()`).then(() => pause(200));
  const setField = (selector, value, event = 'input') => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true })); return true; })()`).then(() => pause(250));
  const entries = () => evaluate(`[...document.querySelectorAll('.wizard-party-entry .demo-party')].map(el => el.dataset.partyId)`);
  const countText = () => evaluate(`document.querySelector('.wizard-party-count')?.textContent ?? ''`);
  const selectedId = () => evaluate(`document.querySelector('.wizard-party-entry.selected .demo-party')?.dataset.partyId ?? null`);
  const fieldValue = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.value ?? null`);

  await evaluate(`localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })), true`);
  for (const vp of [{ name: 'desktop', width: 1280, height: 900, mobile: false }, { name: 'smartphone', width: 390, height: 780, mobile: true }]) {
    await viewport(vp.width, vp.height, vp.mobile);
    await goto('');
    await wait(() => has('[data-menu="nuova"]:not([disabled])'));
    await click('[data-menu="nuova"]:not([disabled])');
    await wait(() => has('.career-wizard'));
    await setField('.career-wizard [name="firstName"]', 'Prova'); await setField('.career-wizard [name="lastName"]', 'Filtro');
    await setField('.career-wizard [name="birthDate"]', '1985-04-12', 'change'); await setField('.career-wizard [name="previousProfession"]', 'Insegnante');
    const next = () => click('.wizard-footer [data-wizard-action="next"]').then(() => pause(250));
    await next(); await wait(() => has('[data-wizard-region]'));
    await setField('[data-wizard-region]', 'Toscana', 'change');
    await wait(() => has('[data-wizard-municipality-search]'));
    await setField('[data-wizard-municipality-search]', 'Siena');
    await wait(() => has('[data-municipality-code="052032"]'));
    await click('[data-municipality-code="052032"]');
    for (let i = 0; i < 4 && !(await has('[data-party-mode]')); i++) await next();
    assert.ok(await has('[data-party-mode]'), `${vp.name}: il passo del partito è raggiungibile col flusso normale.`);
    await click('[data-party-mode="existing"]');
    await wait(() => has('[data-party-orient]'));
    const everything = await entries();
    const totalText = await countText();

    // orientation: only right-wing parties are listed
    await click('[data-party-orient="destra"]');
    const right = await entries();
    assert.ok(right.length > 0 && right.length < everything.length, `${vp.name}: il filtro per orientamento restringe l’elenco.`);
    assert.notEqual(await countText(), totalText, `${vp.name}: il conteggio si aggiorna.`);
    assert.ok(await has('.party-criterion[data-party-criterion="orient"]'), `${vp.name}: il criterio applicato è mostrato e rimovibile.`);
    // picking a filtered party works and survives removal of the criterion
    const picked = right[0];
    await click(`.demo-party[data-party-id="${picked}"]`);
    assert.equal(await selectedId(), picked, `${vp.name}: si può scegliere un partito dall’elenco filtrato.`);
    await click('.party-criterion[data-party-criterion="orient"]');
    assert.equal(await has('.party-criterion'), false, `${vp.name}: rimuovendo il criterio scompare la chip.`);
    assert.equal((await entries()).length >= right.length, true, `${vp.name}: l’elenco si allarga dopo la rimozione.`);
    assert.equal(await selectedId(), picked, `${vp.name}: la selezione resta valida dopo la rimozione.`);

    // search + two orientations + clear all
    await setField('[data-wizard-party-search]', 'a');
    await click('[data-party-orient="centro"]'); await click('[data-party-orient="sinistra"]');
    assert.ok(await has('.party-clear'), `${vp.name}: «Rimuovi tutti i filtri» compare.`);
    await click('.party-clear');
    assert.equal(await fieldValue('[data-wizard-party-search]'), '', `${vp.name}: la ricerca viene azzerata.`);
    assert.equal(await has('.party-criterion'), false);
    assert.equal(await evaluate(`document.querySelectorAll('.party-chip.on').length`), 0);
    assert.deepEqual((await entries()).slice(0, 12), everything.slice(0, 12), `${vp.name}: l’elenco torna identico.`);

    // flow intact: the selected party is kept when moving on and the wizard still advances
    await click(`.demo-party[data-party-id="${picked}"]`);
    const stepBefore = await evaluate(`document.querySelector('.wizard-kicker')?.textContent.replace(/\\s+/g, ' ').trim()`);
    await next();
    const stepAfter = await evaluate(`document.querySelector('.wizard-kicker')?.textContent.replace(/\\s+/g, ' ').trim()`);
    assert.notEqual(stepAfter, stepBefore, `${vp.name}: dopo il filtro si può proseguire con la creazione.`);

    // phone: no horizontal overflow, chips big enough to tap
    if (vp.mobile) {
      await click('.wizard-footer [data-wizard-action="back"]'); await pause(250);
      await click('[data-party-mode="existing"]');
      await wait(() => has('[data-party-orient]'));
      const m = await evaluate(`({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth, h: Math.min(...[...document.querySelectorAll('.party-chip')].map(el => el.getBoundingClientRect().height)) })`);
      assert.ok(m.over <= 1, `smartphone: nessun overflow orizzontale (${m.over}px).`);
      assert.ok(m.h >= 38, `smartphone: chip toccabili (${m.h}px).`);
    }
    await goto('');
    console.log(`Filtro partiti nel browser (${vp.name}): orientamento, ricerca, rimozione criteri, selezione e prosecuzione verificati.`);
  }
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
});
