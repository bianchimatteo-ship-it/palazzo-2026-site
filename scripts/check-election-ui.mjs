// Candidacy and campaign pages: when a candidacy is open the action to run is at the top of the page (in the first screen, desktop and phone), the campaign page opens with the same action and the dates it
// depends on, the open candidacies are listed first in the Candidatura tab, and pressing «Candidati» leads to the campaign set-up, ready to start. Chrome; skipped without it.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
if (!chromeAvailable) { console.log('Candidatura e campagna nel browser saltate: Chrome non trovato (imposta CHROME_PATH per eseguirle).'); process.exit(0); }

await withBrowser(async browser => {
  const { evaluate, waitFor: wait, pause, viewport, errors } = browser;
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ' + ${JSON.stringify(selector)}); el.click(); return true; })()`).then(() => pause(500));
  await createCareerInPage(browser, { weeks: 1, level: 'comunale', extra: `store.fastForwardToElection('comunale'); store.save();` });
  await openCareer(browser);
  await evaluate(`document.querySelector('[data-news-popup-close]')?.click(), true`);
  await click('[data-nav="elezioni"]');
  await wait(() => has('.sx-hero'), 15000);
  const dismiss = () => evaluate(`document.querySelectorAll('[data-outcome-dismiss],[data-news-popup-close]').forEach(el => el.click()); true`);
  for (const [name, w, h, mobile] of [['desktop', 1280, 800, false], ['smartphone', 390, 780, true]]) {
    await viewport(w, h, mobile); await pause(400); await dismiss();
    await evaluate(`scrollTo(0, 0); true`);
    // 1. the action is in the first screen of the page
    const hero = await evaluate(`(() => { const b = document.querySelector('.sx-hero [data-campaign-goto]'); if (!b) return null; const r = b.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, disabled: b.disabled }; })()`);
    assert.ok(hero && !hero.disabled, `${name}: «Candidati» c’è, nella testata della pagina, e si può premere.`);
    assert.ok(hero.top >= 0 && hero.bottom <= hero.vh, `${name}: ed è visibile senza scorrere (${hero.top}–${hero.bottom} su ${hero.vh}).`);
    // 2. Candidatura: the open candidacies come first
    await click('[data-section-tab="elezioni"][data-section-tab-value="candidatura"]');
    assert.ok(await has('[data-candidate-now] [data-campaign-goto]'), `${name}: nella scheda Candidatura le candidature aperte sono in cima, col pulsante.`);
    assert.ok(await evaluate(`/candidature aperte ora/i.test(document.querySelector('[data-candidate-now]').textContent) && /chiudono tra \\d+/.test(document.querySelector('[data-candidate-now]').textContent)`), `${name}: con i giorni che restano.`);
    // 3. Campagna: the same action with its dates
    await click('[data-section-tab="elezioni"][data-section-tab-value="campagna"]');
    await wait(() => has('[data-campaign-cta]'), 8000);
    const cta = await evaluate(`(() => { const c = document.querySelector('[data-campaign-cta]'); const b = c.querySelector('[data-action="campaign-start"]'); return { open: c.classList.contains('is-open'), text: c.textContent.replace(/\\s+/g, ' '), button: b?.textContent.trim(), disabled: b?.disabled, first: document.querySelector('.campaign-cta') === document.querySelector('.eh-campaign, .page-wrap').querySelector('.campaign-cta') }; })()`);
    assert.ok(cta.open && /Candidati e inizia la campagna/.test(cta.button) && !cta.disabled, `${name}: la pagina della campagna si apre con l’azione per candidarsi (${cta.button}).`);
    assert.ok(/Voto/.test(cta.text) && /Candidature/.test(cta.text) && /chiudono tra \d+/.test(cta.text), `${name}: con data del voto, finestra e giorni rimasti.`);
    const place = await evaluate(`(() => { const r = document.querySelector('[data-campaign-cta]').getBoundingClientRect(); const over = document.documentElement.scrollWidth - document.documentElement.clientWidth; return { top: Math.round(r.top + scrollY), over }; })()`);
    assert.ok(place.over <= 1, `${name}: nessun overflow orizzontale.`);
    // the set-up is still complete: every select and the strategies are there
    for (const hook of ['electionType', 'objective', 'role', 'topicId']) assert.ok(await has(`[data-campaign-setup="${hook}"]`), `${name}: resta il campo ${hook}.`);
    assert.ok(await evaluate(`document.querySelectorAll('.campaign-strategy').length >= 4 && document.querySelectorAll('.campaign-strategy[data-strategy]').length >= 4`), `${name}: le strategie ci sono, ognuna col suo colore.`);
    await click('[data-section-tab="elezioni"][data-section-tab-value="panoramica"]');
  }
  // pressing «Candidati» from the top leads to the set-up of that vote
  await viewport(1280, 800, false); await pause(300); await dismiss();
  await click('.sx-hero [data-campaign-goto]');
  await wait(() => has('[data-campaign-cta]'), 8000);
  assert.ok(await has('[data-campaign-setup="electionType"]'), 'Premendo «Candidati» si arriva all’impostazione della campagna.');
  assert.equal(await evaluate(`document.querySelector('[data-campaign-setup="electionType"]').value`), 'comunale', 'Con il tipo di elezione già scelto.');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
});
console.log('Candidatura e campagna: azione per candidarsi in alto, date e giorni rimasti, elenco delle candidature aperte e passaggio all’impostazione, su desktop e smartphone.');
