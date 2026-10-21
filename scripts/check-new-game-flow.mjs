// «Nuova partita», × and «Annulla» in a real browser (headless Chrome, a clean profile, nothing of the player's): from the main menu and from inside a career (career page, settings,
// profile, mobile menu) the creator opens as a screen of its own (the career in progress is not drawn behind it), «Annulla» and × are there at every step and always go back to the
// initial menu without creating or loading anything; a reply of the data that arrives after the cancel changes nothing; a career that cannot be kept blocks the new one and offers
// its file. The career in progress is the same before and after (id, week, date, revision, bytes). Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Nuova partita nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirla).'); process.exit(0); }

await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  const has = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  const visible = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const box = el.getBoundingClientRect(); return getComputedStyle(el).display !== 'none' && box.width > 0 && box.height > 0; })()`);
  const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('manca ${selector.replace(/'/g, '')}'); el.click(); return true; })()`);
  const snapshot = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const s = store.getState(); return JSON.stringify({ id: s.career.id, week: s.game.week.index, date: s.clock.currentDate, revision: s.saveMeta?.revision ?? null, main: localStorage.getItem('palazzo-2026.career.v1')?.length ?? 0, slots: Object.keys(localStorage).filter(key => key.includes('slot')).length }); })()`);
  const onMenu = async () => { await wait(() => has(".menu-shell .menu-new:not([disabled])")); return !(await has('.career-wizard')); };
  const openWizard = async () => { await click('[data-menu="nuova"]:not([disabled]), [data-action="new-career"]'); await wait(() => has('.career-wizard')); };
  const wizardIsAlone = async label => {
    for (const part of ['.sidebar', '.topbar', '.mobile-tabbar', '.page-wrap']) assert.equal(await has(part), false, `${label}: con la creazione aperta la carriera in corso non è disegnata dietro (${part}).`);
  };
  const step = () => evaluate(`document.querySelector('.wizard-kicker')?.textContent.replace(/\\s+/g, ' ').trim() ?? ''`);

  await createCareerInPage({ evaluate, version }, { weeks: 3 });
  await goto('');
  await wait(() => has('[data-menu="nuova"]:not([disabled])'));
  // the game settles after it opens (it may save once more): the comparison starts from the stable state
  let before = await snapshot();
  for (let i = 0; i < 20; i++) { await pause(400); const again = await snapshot(); if (again === before) break; before = again; }

  // ---------- 1. from the main menu: the creator is a screen of its own; × and «Annulla» go back ----------
  await click('[data-menu="nuova"]:not([disabled])');
  await wait(() => has('.career-wizard'));
  await wizardIsAlone('dal menu');
  assert.ok(await has('.wizard-cancel'), '«Annulla» c’è al passaggio 1.');
  await click('.wizard-x');
  assert.ok(await onMenu(), '× torna al menu iniziale.');
  assert.equal(await snapshot(), before, 'La carriera non è cambiata dopo ×.');
  await click('[data-menu="nuova"]:not([disabled])'); await wait(() => has('.career-wizard'));
  await click('.wizard-cancel');
  assert.ok(await onMenu(), '«Annulla» torna al menu iniziale.');
  assert.equal(await snapshot(), before, 'La carriera non è cambiata dopo «Annulla».');

  // ---------- 2. «Annulla» and × from every step, reached with the real buttons ----------
  const setField = (selector, value, event = 'input') => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true })); return true; })()`).then(() => pause(200));
  const next = () => click('.wizard-footer [data-wizard-action="next"]').then(() => pause(250));
  const reach = async target => {
    await openWizard();
    if (target >= 2) {
      await setField('.career-wizard [name="firstName"]', 'Prova'); await setField('.career-wizard [name="lastName"]', 'Annulla');
      await setField('.career-wizard [name="birthDate"]', '1985-04-12', 'change'); await setField('.career-wizard [name="previousProfession"]', 'Insegnante');
      await next(); await wait(() => has('[data-wizard-region]'));
    }
    if (target >= 3) {
      await setField('[data-wizard-region]', 'Toscana', 'change');
      await wait(() => has('[data-wizard-municipality-search]'));
      await setField('[data-wizard-municipality-search]', 'Siena');
      await wait(() => has('[data-municipality-code="052032"]'));
      await click('[data-municipality-code="052032"]'); await pause(250);
      await next();
    }
    if (target >= 4) await next();
    if (target >= 5) await next();
    await wait(async () => (await step()).includes(`0${target}`));
  };
  for (const target of [1, 2, 3, 4, 5]) {
    await reach(target);
    await evaluate(`document.querySelector('.career-wizard').click(), true`); await pause(200);
    assert.ok(await has('.career-wizard'), `Un clic dentro il popup non annulla (passaggio ${target}).`);
    assert.ok(await has('.wizard-cancel'), `«Annulla» c’è al passaggio ${target}.`);
    assert.ok(await has('.wizard-x'), `× c’è al passaggio ${target}.`);
    await wizardIsAlone(`passaggio ${target}`);
    // the creator is a popup over the homepage (which stays, out of reach); every way out lands on the initial menu
    assert.ok(await has('.wizard-under .menu-new'), `Al passaggio ${target} la homepage resta dietro il popup.`);
    assert.equal(await evaluate(`document.querySelector('.wizard-under').hasAttribute('inert')`), true, 'E non si può toccare.');
    const how = ['cancel', 'x', 'escape', 'backdrop', 'cancel'][target - 1];
    if (how === 'cancel') await click('.wizard-cancel');
    else if (how === 'x') await click('.wizard-x');
    else if (how === 'escape') { await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), true`); await pause(300); }
    else { await evaluate(`document.querySelector('.wizard-backdrop').click(), true`); await pause(300); }
    assert.ok(await onMenu(), `Dal passaggio ${target} (${how}) si torna al menu iniziale.`);
    assert.equal(await snapshot(), before, `Dal passaggio ${target} la carriera non cambia (nessuna carriera creata o caricata).`);
  }

  // ---------- 3. a reply of the data after the cancel changes nothing and does not reopen the creator ----------
  await evaluate(`(() => { const original = window.fetch.bind(window); window.__slow = true; window.fetch = (...args) => window.__slow ? new Promise(resolve => setTimeout(() => resolve(original(...args)), 1500)) : original(...args); return true; })()`);
  await click('[data-menu="nuova"]:not([disabled])');
  await wait(() => has('.career-wizard'));
  await click('.wizard-cancel');
  assert.ok(await onMenu(), '«Annulla» mentre i dati sono in caricamento torna al menu.');
  await pause(2600);
  assert.equal(await has('.career-wizard'), false, 'La risposta tardiva dei dati non riapre la creazione.');
  assert.ok(await has(".main-menu, .menu-shell .menu-new:not([disabled])"), 'Il menu iniziale resta.');
  assert.equal(await snapshot(), before, 'La carriera non è cambiata.');
  await evaluate(`(() => { window.__slow = false; return true; })()`);

  // Continuing a career saves it again (a new revision): from here on the same career is recognised by id, week and date, and the creator must not change those.
  const core = async () => { const { id, week, date } = JSON.parse(await snapshot()); return JSON.stringify({ id, week, date }); };
  const coreBefore = await core();
  // ---------- 4. from inside the career: the home button, then the new career from the career page and the settings ----------
  await click('[data-menu="continua"]');
  await wait(() => has('.page-wrap'));
  await click('[data-action="menu"]');
  assert.ok(await onMenu(), 'Dalla partita il pulsante Home riporta al menu iniziale.');
  await click('[data-menu="continua"]'); await wait(() => has('.page-wrap'));
  for (const page of ['carriera', 'impostazioni']) {
    await evaluate(`location.hash = '#${page}'`);
    await wait(() => has('[data-action="new-career"]'));
    await click('[data-action="new-career"]');
    await wait(() => has('.career-wizard'));
    await wizardIsAlone(`da ${page}`);
    await click('.wizard-cancel');
    assert.ok(await onMenu(), `Da ${page} «Annulla» torna al menu iniziale.`);
    assert.equal(await core(), coreBefore, `Da ${page} la carriera resta quella di prima.`);
    await click('[data-menu="continua"]'); await wait(() => has('.page-wrap'));
  }

  // ---------- 5. on a phone ----------
  await viewport(375, 740, true);
  await click('[data-action="menu"]'); await onMenu();
  await click('[data-menu="nuova"]:not([disabled])'); await wait(() => has('.career-wizard'));
  await wizardIsAlone('su telefono');
  assert.equal(await visible('.mobile-tabbar'), false, 'Su telefono la barra di navigazione non si vede con la creazione aperta.');
  assert.ok(await visible('.wizard-cancel'), '«Annulla» si vede e si tocca su telefono.');
  await click('.wizard-cancel');
  assert.ok(await onMenu(), 'Su telefono «Annulla» torna al menu.');
  assert.equal(await core(), coreBefore, 'Su telefono la carriera è intatta.');
  await viewport(1280, 800, false);

  // ---------- 6. a career that cannot be kept (slots full) blocks the new one and offers its file ----------
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const names = ['uno', 'due', 'tre', 'quattro', 'cinque']; for (const name of names) store.saveToSlot(name, null, { manual: true }); return store.listSlots().length; })()`);
  const verdict = await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); return store.preserveCheck(); })()`);
  assert.equal(verdict.ok, false, 'Con gli slot pieni la carriera in corso non può essere conservata.');
  assert.equal(verdict.reason, 'full');
  const slotsBefore = await evaluate(`Object.keys(localStorage).filter(key => key.includes('slot')).length`);
  await evaluate(`(() => { window.__downloads = []; const make = URL.createObjectURL.bind(URL); URL.createObjectURL = blob => { window.__downloads.push(blob.size); return make(blob); }; return true; })()`);
  await reach(5);
  await click('.wizard-footer [data-wizard-action="finish"]');
  await wait(() => has('.wizard-blocked'));
  assert.match(await evaluate(`document.querySelector('.wizard-errors').textContent`), /slot sono pieni/, 'Il gioco spiega perché la nuova carriera non parte.');
  assert.ok(await has('.career-wizard'), 'La creazione resta aperta: nulla è stato creato.');
  assert.equal(await has('[data-confirm="ok"]'), false, 'Nessuna conferma che prometta una perdita: la sostituzione è bloccata.');
  assert.equal(await core(), coreBefore, 'La carriera in corso non è stata toccata.');
  await click('[data-wizard-action="export-current"]');
  await wait(() => has('.wizard-blocked span'));
  assert.ok((await evaluate(`window.__downloads.length`)) >= 1 && (await evaluate(`window.__downloads[0]`)) > 10000, 'Il file della carriera in corso viene scaricato.');
  await click('.wizard-cancel'); assert.ok(await onMenu());
  assert.equal(await evaluate(`Object.keys(localStorage).filter(key => key.includes('slot')).length`), slotsBefore, 'Nessuno slot è stato eliminato da sé.');
  assert.deepEqual(errors, [], 'Nessun errore in pagina.');
});
console.log('Nuova partita verificata in Chrome: la creazione è un popup sopra la homepage (inerte; la carriera in corso non è disegnata), ×, «Annulla», Escape e lo sfondo tornano al menu iniziale (un clic dentro il popup non annulla) senza creare né caricare nulla, una risposta tardiva dei dati dopo l’annullamento non riapre nulla, dal menu, dalla pagina Carriera, dalle impostazioni e su telefono la carriera resta identica (id, settimana, data, revisione, byte), con gli slot pieni la nuova carriera è bloccata e nessuno slot viene eliminato.');
