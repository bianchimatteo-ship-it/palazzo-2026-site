// The countdown of a campaign in a real browser: after an activity of one or more days the number and the date SHOWN in the page are the ones of the state (days remaining = totalDays − day, the
// date of the campaign), not only the ones the engine returns; also after the activity that closes the campaign and after a reload; desktop and phone.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, openCareer, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Contatore dei giorni della campagna saltato: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, version }) => {
  const mod = `import('/src/core/store.js?v=${version}')`;
  await createCareerInPage({ evaluate, version }, { level: 'comunale', weeks: 0, onboarding: true, extra: `store.fastForwardToElection('comunale'); store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, real.realDatabase.parties); store.getState().campaign.nomination.status = 'approved';` });
  await openCareer({ evaluate, goto, waitFor: wait });
  await evaluate(`location.hash = '#elezioni'; true`);
  const shown = () => evaluate(`(() => { const box = document.querySelector('.campaign-countdown'); if (!box) return null; return { days: Number(box.querySelector('strong')?.childNodes[0]?.textContent), date: box.querySelector('time')?.textContent?.trim() ?? null, hubTitle: document.querySelector('.campaign-active-head') ? null : null }; })()`);
  const state = () => evaluate(`(async () => { const { store } = await ${mod}; const c = store.getState().campaign; const { campaignSummary } = await import('/src/core/campaign-engine.js?v=${version}'); const { formatDate } = await import('/src/core/time.js?v=${version}'); return { day: c.day, total: c.totalDays, status: c.status, current: c.currentDate, clock: store.getState().clock.currentDate, remaining: c.status === 'active' ? campaignSummary(c).daysRemaining : null, electionDate: formatDate(c.electionDate) }; })()`);
  await wait(() => evaluate(`Boolean(document.querySelector('.campaign-countdown'))`));
  const seen = [];
  for (const [width, height, mobile] of [[1280, 800, false], [390, 800, true]]) {
    await viewport(width, height, mobile);
    await pause(400);
    for (let step = 0; step < 4; step++) {
      await wait(async () => (await shown())?.days !== undefined);
      const s = await state(), d = await shown();
      assert.equal(s.remaining, s.total - s.day, `${width}px: il motore è coerente (${s.total} − ${s.day}).`);
      assert.equal(d.days, s.remaining, `${width}px, passo ${step}: il numero mostrato (${d.days}) è quello dello stato (${s.remaining}).`);
      assert.equal(d.date, s.electionDate, `${width}px, passo ${step}: la data del voto mostrata è quella della campagna.`);
      // an action of one or more days, as the player does it (a click on an activity)
      const clicked = await evaluate(`(() => { const buttons = [...document.querySelectorAll('[data-campaign-activity]:not([disabled])')]; const b = buttons[${step} % Math.max(1, buttons.length)]; if (!b) return null; const id = b.dataset.campaignActivity; b.scrollIntoView({ block: 'center' }); b.click(); return id; })()`);
      if (!clicked) { assert.ok(step > 0 || width >= 800, `${width}px: nessuna attività eseguibile all'inizio.`); break; }
      await pause(500);
      const after = await state();
      if (after.status !== 'active') break;
      const dom = await shown();
      seen.push([width, after.day, dom?.days]);
      assert.equal(dom?.days, after.remaining, `${width}px, dopo «${clicked}»: giorno ${after.day}/${after.total}, il contatore mostra ${dom?.days} invece di ${after.remaining}.`);
    }
  }
  assert.ok(new Set(seen.map(item => item[1])).size >= 3 && seen.some(item => item[0] < 800), `Le azioni hanno fatto avanzare i giorni (${JSON.stringify(seen)}).`);
  // the activity that closes the campaign, then a reload
  await viewport(1280, 800, false);
  // to the vote: events answered and activities done from the page, as the player does; at every step the number shown is the one of the state, and the days left are those between the date of the
  // campaign and the day of the vote
  const gap = () => evaluate(`(async () => { const { store } = await ${mod}; const c = store.getState().campaign; return c.status === 'active' ? Math.round((Date.parse(c.electionDate + 'T12:00:00Z') - Date.parse(c.currentDate + 'T12:00:00Z')) / 86400000) : null; })()`);
  for (let guard = 0; guard < 120; guard++) {
    const s = await state();
    if (s.status !== 'active') break;
    const acted = await evaluate(`(() => { const e = document.querySelector('[data-campaign-event]:not([disabled])'); if (e) { e.click(); return 'evento'; } const a = [...document.querySelectorAll('[data-campaign-activity]:not([disabled])')]; if (a.length) { a[a.length - 1].click(); return 'attività'; } const n = document.querySelector('[data-action="advance"]'); if (n) { n.click(); return 'avanti'; } return null; })()`);
    await pause(350);
    const after = await state();
    if (after.status !== 'active') break;
    const dom = await shown();
    assert.equal(dom?.days, after.remaining, `Verso il voto (${acted ?? 'nessuna azione'}): giorno ${after.day}/${after.total}, il contatore mostra ${dom?.days} invece di ${after.remaining}.`);
    const anywhere = await evaluate(`(document.body.innerText.match(/(\\d+) giorni al voto/) ?? [])[1] ?? null`);
    if (anywhere !== null) assert.equal(Number(anywhere), after.remaining, `Anche la scritta «giorni al voto» del resto della pagina è aggiornata (${anywhere} contro ${after.remaining}).`);
    assert.equal(await gap(), after.remaining, `I giorni mancanti coincidono con la distanza tra la data della campagna (${after.current}) e il voto.`);
  }
  const closed = await state();
  assert.notEqual(closed.status, 'active', `La campagna si conclude (${JSON.stringify(closed)}).`);
  const hasCountdown = await evaluate(`Boolean(document.querySelector('.campaign-countdown'))`);
  assert.ok(!hasCountdown, 'A campagna conclusa non resta un conto alla rovescia vecchio nella pagina.');
  await evaluate('window.__old = true'); await goto('');
  await wait(async () => !(await evaluate('window.__old === true')) && await evaluate('Boolean(document.querySelector("[data-menu]"))'));
  const reloaded = await evaluate(`(async () => { const { store } = await ${mod}; const c = store.getState().campaign; return c ? { status: c.status, day: c.day, total: c.totalDays } : null; })()`);
  assert.ok(!reloaded || reloaded.status !== 'active', 'Dopo il ricaricamento la campagna conclusa non torna attiva.');
});
console.log('Contatore dei giorni verificato nel browser: il numero e la data mostrati coincidono con lo stato dopo ogni azione (desktop e telefono), a campagna chiusa e dopo il ricaricamento.');
