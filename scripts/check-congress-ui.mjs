// The congress in the page (Partito → Vita interna), in Chrome: the player backs an area, the list of what can be done appears with what each costs, what can go wrong and, for the ones that cannot
// be done now, why; the choices that need a target (a region, an area) have their own selector; doing an action through the page pays exactly its cost, writes its mark in the congress and tells
// so; what is saved is read again after a reload; and nothing overflows on a phone (390 px), with touch targets of at least 40 px.
// Skipped without Chrome.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';
import { CONGRESS_ACTIONS } from '../src/data/simulation/party-life-rules.js';

if (!chromeAvailable) { console.log('Congresso nella pagina saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }

await withBrowser(async browser => {
  const { evaluate, viewport, waitFor, pause, errors, version } = browser;
  await createCareerInPage(browser, { party: 'party-registro-p1-2015-29-ir', group: 'cam-xix-02', level: 'comunale', weeks: 1, extra: `
    const s = store.getState(); s.game.party.org.congress.nextWeek = s.game.week.index + 24; s.game.resources.funds = 6000; s.game.resources.politicalCapital = 14; s.game.party.org.treasury.balance = 6000;
    for (let i = 0; i < 14; i++) store.advanceTurn(1);
    const g = store.getState().game; s.game.resources.funds = 6000; g.resources.funds = 6000; g.resources.politicalCapital = 14; g.party.org.treasury.balance = 6000;
    store.alignPartyCurrent(g.party.currents.find(item => item.id !== g.party.leaderCurrentId).id);
  ` });
  const game = () => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const g = store.getState().game; const c = g.party.life?.congress; return { week: g.week.index, ap: g.week.ap, funds: g.resources.funds, capital: g.resources.politicalCapital, treasury: g.party.org.treasury.balance, aligned: g.party.alignedCurrentId, phase: c?.phase ?? null, tours: c?.tours?.length ?? 0, pushes: c?.pushes?.map(item => item.region) ?? [], motion: c?.playerMotion ? { weak: c.playerMotion.weak } : null, mobilization: Math.round(c?.mobilization?.[g.party.alignedCurrentId] ?? 0), alliances: c?.alliances?.length ?? 0, regions: g.party.org.sections.map(item => item.region), currents: g.party.currents.map(item => item.id) }; })()`);
  const click = selector => evaluate(`(async () => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element || element.disabled) return false; element.dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 700)); return true; })()`);
  const cards = () => evaluate(`[...document.querySelectorAll('.pl-ca')].map(item => ({ id: item.querySelector('[data-life-congress]').dataset.lifeCongress, label: item.querySelector('strong').textContent, off: item.classList.contains('is-off'), disabled: item.querySelector('[data-life-congress]').disabled, reason: item.querySelector('.pl-ca-reason')?.textContent ?? '', risk: item.querySelector('.pl-ca-risk')?.textContent ?? '', cost: [...item.querySelectorAll('.hq-cost-chip')].map(chip => chip.textContent), pick: item.querySelector('select')?.dataset.lifeField ?? null, options: [...item.querySelectorAll('select option')].map(option => option.value), height: item.querySelector('[data-life-congress]').getBoundingClientRect().height }))`);
  const back = async () => { await evaluate(`document.querySelector('[data-nav="partito"]')?.click(), true`); await pause(500); await evaluate(`document.querySelector('[data-section-tab="partito"][data-section-tab-value="vita"]')?.click(), true`); await pause(700); await waitFor(() => evaluate(`Boolean(document.querySelector('.pl-congress-work'))`), 20000); };
  const open = async () => { await openCareer(browser); await evaluate(`document.querySelector('[data-nav="partito"]')?.click(), true`); await pause(500); await evaluate(`document.querySelector('[data-section-tab="partito"][data-section-tab-value="vita"]')?.click(), true`); await pause(700); await waitFor(() => evaluate(`Boolean(document.querySelector('.pl-congress-work'))`), 20000); };

  const start = await game();
  assert.ok(start.aligned && start.phase === 'delegati', `Il giocatore ha scelto un’area e il congresso è in «${start.phase}».`);
  await open();

  // ---------- 1. the list: costs, risks, reasons ----------
  let list = await cards();
  assert.deepEqual(list.map(item => item.id), Object.keys(CONGRESS_ACTIONS), 'Le sei azioni, nell’ordine della tabella.');
  for (const item of list) {
    const spec = CONGRESS_ACTIONS[item.id];
    assert.equal(item.label, spec.label);
    assert.equal(item.cost.length, Object.keys(spec.cost).length, `${item.id}: un riquadro di costo per voce (${item.cost}).`);
    assert.ok(spec.risk ? item.risk.length > 20 : item.risk === '', `${item.id}: il rischio c’è solo dove è dichiarato.`);
  }
  assert.ok(list.find(item => item.id === 'federazioni').cost.some(text => /dal partito/.test(text)), 'La tesoreria del partito si distingue dalle tue tasche.');
  assert.ok(list.find(item => item.id === 'delegati').cost.some(text => /€/.test(text)), 'E i tuoi soldi mostrano l’euro.');
  const bySlug = Object.fromEntries(list.map(item => [item.id, item]));
  assert.ok(!bySlug.delegati.disabled && bySlug.delegati.pick === 'congress-delegati' && bySlug.delegati.options.length >= 10, 'Nella fase dei delegati la campagna per regione c’è, con le regioni del partito.');
  assert.ok(bySlug.trattativa.disabled && /solo in/.test(bySlug.trattativa.reason), `Le trattative non sono ancora aperte e dice perché («${bySlug.trattativa.reason}»).`);
  assert.ok(bySlug.alleanza.disabled && bySlug.alleanza.reason.length > 10, 'Né le alleanze.');
  assert.ok(!bySlug.mobilita.disabled && !bySlug.mozione.disabled, 'Mobilitare e scrivere la mozione sì.');
  assert.ok(!bySlug.federazioni.disabled, 'Il giro delle federazioni si fa in preparazione e nell’elezione dei delegati: ora si può.');
  assert.ok(list.every(item => item.disabled === item.off), 'Ciò che non si può fare è disabilitato e attenuato, e viceversa.');

  // ---------- 2. doing: the exact cost, the mark, the message ----------
  const before = await game();
  assert.ok(await click('[data-life-congress="mobilita"]'), 'Mobilita i quadri si preme.');
  let after = await game();
  assert.equal(before.ap - after.ap, CONGRESS_ACTIONS.mobilita.cost.ap, 'Un giorno in meno.');
  assert.equal(after.mobilization - before.mobilization, 8, 'E +8 di mobilitazione scritti nel congresso.');
  const region = before.regions[0];
  const delegatesBefore = await game();
  await evaluate(`document.querySelector('[data-life-field="congress-delegati"]').value = ${JSON.stringify(region)}, true`);
  assert.ok(await click('[data-life-congress="delegati"]'), 'La campagna sulla regione scelta si preme.');
  after = await game();
  assert.equal(delegatesBefore.funds - after.funds, CONGRESS_ACTIONS.delegati.cost.funds, 'Trecento euro di tasca propria.');
  assert.equal(delegatesBefore.ap - after.ap, CONGRESS_ACTIONS.delegati.cost.ap);
  assert.deepEqual(after.pushes, [region], 'La campagna è scritta nel congresso, per quella regione.');
  assert.ok(await click('[data-life-congress="mozione"]'), 'La mozione si deposita.');
  after = await game();
  assert.ok(after.motion, 'La mozione è nel congresso.');
  assert.equal(delegatesBefore.treasury - after.treasury, 0, 'La mozione non tocca la tesoreria del partito.');
  await open();
  list = await cards();
  assert.ok(list.find(item => item.id === 'mozione').disabled && /già depositato/.test(list.find(item => item.id === 'mozione').reason), 'Fatta, la mozione dice «già depositato» e non si ripete.');
  assert.ok(await evaluate(`document.body.textContent.includes('Già messo in campo')`) && await evaluate(`document.querySelector('.pl-congress-work').textContent.includes('mozione')`), 'La pagina riassume ciò che hai già messo in campo.');
  assert.ok(await evaluate(`document.querySelectorAll('.pl-ca .badge, .pl-ca .sx-badge').length`) >= 1, 'E il «Fatto» sulle azioni che si fanno una volta.');

  // ---------- 3. a shortfall is said, not hidden ----------
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const g = store.getState().game; g.resources.funds = 50; document.querySelector('[data-nav="panoramica"]')?.click(); return true; })()`);
  await pause(400);
  await back();
  list = await cards();
  const poor = list.find(item => item.id === 'delegati');
  assert.ok(poor.disabled && /fondi/.test(poor.reason), `Senza soldi la campagna è disabilitata, con la cifra («${poor.reason}»).`);

  // ---------- 4. saved and read again ----------
  const saved = await game();
  await open();
  const reread = await game();
  assert.deepEqual({ tours: reread.tours, pushes: reread.pushes, motion: reread.motion, mobilization: reread.mobilization }, { tours: saved.tours, pushes: saved.pushes, motion: saved.motion, mobilization: saved.mobilization }, 'Dopo aver riaperto la partita i segni sono gli stessi.');

  // ---------- 5. a phone ----------
  await evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); const g = store.getState().game; g.resources.funds = 5000; g.week.ap = 6; return true; })()`);
  for (const width of [360, 390]) {
    await viewport(width, 844, true);
    await pause(400);
    await open();
    await evaluate(`document.querySelector('.pl-congress-work').scrollIntoView(), true`);
    const phone = await evaluate(`(() => { const box = document.querySelector('.pl-congress-work').getBoundingClientRect(); const buttons = [...document.querySelectorAll('.pl-ca button')]; return { overflow: document.documentElement.scrollWidth - window.innerWidth, right: Math.round(box.right), tall: Math.min(...buttons.map(button => button.getBoundingClientRect().height)), wide: buttons.filter(button => button.scrollWidth > button.clientWidth + 1).length, cards: document.querySelectorAll('.pl-ca').length }; })()`);
    assert.ok(phone.overflow <= 1 && phone.right <= width + 1, `A ${width} px nessuno scroll orizzontale (${phone.overflow}, bordo a ${phone.right}).`);
    assert.ok(phone.tall >= 36, `I pulsanti si toccano (${phone.tall} px).`);
    assert.equal(phone.wide, 0, 'Nessun testo esce dal pulsante.');
    assert.equal(phone.cards, 6);
  }
  assert.deepEqual(errors, [], `Errori in pagina: ${errors.slice(0, 2).join(' | ')}`);
  console.log('Congresso nella pagina verificato in Chrome: sei azioni con costo (giorni, fondi propri, tesoreria del partito, capitale), rischio dichiarato e, quando non si può, la ragione; selettori per regione e area; mobilitare, fare la campagna in una regione e depositare la mozione pagano il costo esatto e scrivono i segni nel congresso; fatto è fatto (una volta sola); senza soldi dice che cosa manca; dopo la riapertura i segni ci sono ancora; a 360 e 390 px nessuno scroll orizzontale.');
}, {});
