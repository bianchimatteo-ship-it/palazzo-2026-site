// The election night in the browser (Chrome, the game's own store in the page): the end of a vote opens a screen of its own with a clock of twelve hours, the time of the career stays
// where it was while the player advances hour by hour, the feed/count/results/territories/map/forecast/seats/statements tabs are there, a reload in the middle gives the same hour and the
// same news, the conclusion closes the campaign once (the same result as before the night), a first round with a runoff ends the night and goes on with the runoff campaign, and the screen
// fits a phone (390 and 320 px): no horizontal scroll, a thumb-sized button for the next hour, tabs that scroll, nothing hidden by the safe area. With animations off nothing moves.
import assert from 'node:assert/strict';
import { chromeAvailable, createCareerInPage, withBrowser } from './lib/browser.mjs';

if (!chromeAvailable) { console.log('Notte elettorale nel browser saltata: Chrome non trovato (imposta CHROME_PATH per eseguirlo).'); process.exit(0); }
await withBrowser(async ({ evaluate, goto, waitFor: wait, pause, viewport, errors, version }) => {
  const band = process.env.BAND ?? 'oltre-15000';
  const startOver = async () => {
    await createCareerInPage({ evaluate, version }, { level: 'comunale', onboarding: true, extra: `store.fastForwardToElection('comunale'); store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: ${JSON.stringify(band)} }, real.parties ?? []);` });
    await goto();
    await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'));
    await evaluate('document.querySelector("[data-menu=continua]").click(), true');
    await wait(() => evaluate('Boolean(document.querySelector(".page-wrap"))'));
  };
  await startOver();
  const S = body => evaluate(`(async () => { const { store } = await import('/src/core/store.js?v=${version}'); ${body} })()`);
  assert.equal(await S('return store.electionNightLive();'), true, 'La Notte Elettorale è attiva nel gioco (nessuno scorciatoia di test).');
  const snapshot = () => S(`const s = store.getState(); return { night: s.night ? { stage: s.night.stage, hour: s.night.hour, feed: s.night.feed.length, statements: s.night.statements.length } : null, date: s.clock.currentDate, week: s.game?.week?.index, last: s.career.lastCampaignId, camp: s.campaign ? { status: s.campaign.status, stage: s.campaign.stage, id: s.campaign.id } : null, held: s.nightsHeld ?? [], page: s.ui.activePage };`);
  let votes = 0;
  // the player's own vote (a scene) comes first: it is seen, then skipped (it decides nothing), and the night follows
  const untilNight = async () => { for (let i = 0; i < 90; i++) { const s = await snapshot(); if (s.night) { if (await S(`return store.getState().scene?.kind ?? null;`) === 'voto') { votes++; await S(`store.sceneSkip(); return true;`); await pause(300); } return snapshot(); } await S('store.advance(7);'); } throw new Error('La notte non si è aperta.'); };
  const text = () => evaluate('document.querySelector(".night")?.innerText ?? ""');
  // everything that moves the career refuses while a night lasts (both phases), and changes nothing: the whole state but the notice on screen is identical before and after
  const BLOCKED = ['advance(7)', 'advanceTurn(1)', 'advanceToDate("2100-01-01")', 'fastForwardToElection("comunale")', 'performCampaignActivity("comizio")', 'decideCampaignEvent("x", "y")', 'setCampaignStrategy("equilibrata")', 'startCampaign({ electionType: "comunale" }, [])', 'performWeeklyActivity("studio")', 'resolveAgendaItem("x", "y")', 'clearCampaign()', 'proposeLaw({})', 'castLawVote("x", "si")', 'issueDecree({})', 'formGovernment({})', 'askConfidence()', 'triggerGovernmentCrisis()', 'setPartyProgram({})', 'invest({})', 'proposeAlliance("x")'];
  const frozenCheck = async label => {
    const before = await S('const s = store.getState(); return JSON.stringify({ ...s, ui: null });');
    for (const call of BLOCKED) {
      const outcome = await S(`try { store.${call}; return 'eseguito'; } catch (error) { return /Notte Elettorale/.test(error.message) ? 'rifiutato' : 'errore: ' + error.message; }`);
      assert.equal(outcome, 'rifiutato', `${label}: ${call} è rifiutato durante la notte (${outcome}).`);
    }
    const after = await S('const s = store.getState(); return JSON.stringify({ ...s, ui: null });');
    assert.equal(after, before, `${label}: lo stato della carriera non è cambiato (nessuna settimana, mondo o campagna).`);
  };
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click(), true`); await pause(250); };
  let runoffSeen = false;
  let s = await untilNight();
  // the runoff path is part of the test, not a matter of luck: a municipal vote of a big comune is played again (a new career) until a first round ends without an absolute majority
  for (let attempt = 1; s.night.stage !== 'primo-turno' && attempt < 8 && band === 'oltre-15000'; attempt++) { await startOver(); s = await untilNight(); }
  assert.equal(s.night.stage, 'primo-turno', 'Il percorso del ballottaggio è stato giocato (primo turno con ballottaggio).');
  if (s.night.stage === 'primo-turno') {
    runoffSeen = true;
    await wait(() => evaluate('Boolean(document.querySelector(".night"))'));
    assert.equal(s.camp.status, 'active', 'Al primo turno la campagna del ballottaggio è ancora aperta.');
    const before = s;
    await frozenCheck('primo turno');
    for (let h = 1; h < 12; h++) await click('[data-night-next]');
    await frozenCheck('primo turno, ora 12');
    assert.equal((await snapshot()).night.hour, 12);
    assert.equal((await snapshot()).date, before.date, 'Il tempo della carriera non si è mosso durante le dodici ore del primo turno.');
    await click('[data-night-conclude]');
    s = await snapshot();
    assert.equal(s.night, null, 'Il primo turno si conclude.');
    assert.equal(s.camp.stage, 'ballottaggio', 'Comincia la campagna del ballottaggio.');
    assert.equal(s.last === before.last, true, 'Il primo turno non chiude la campagna.');
    s = await untilNight();
  }
  assert.equal(s.night.stage, 'finale', 'La seconda notte (o la prima, senza ballottaggio) è quella dell’esito.');
  await wait(() => evaluate('Boolean(document.querySelector(".night"))'));
  // the career is not closed yet: the result is not applied while the night lasts
  const opening = s;
  assert.equal(opening.camp.status, 'finished', 'La campagna è conclusa, il suo risultato è conservato.');
  assert.notEqual(opening.last, opening.camp.id, 'Il risultato non è ancora registrato nella carriera.');
  assert.equal(opening.night.hour, 1, 'Si apre alla prima ora.');
  let t = await text();
  assert.match(t, /NOTTE ELETTORALE/, 'La schermata dedicata è quella della Notte Elettorale.');
  assert.match(t, /15:00/, 'Il comunale chiude alle 15:00: è l’ora della prima schermata.');
  assert.match(t, /EXIT POLL/, 'L’exit poll è nella diretta.');
  assert.match(t, /stima, non è un risultato/i, 'L’exit poll è dichiarato come stima.');
  assert.equal(await evaluate('document.querySelectorAll(".night-hours li").length'), 12, 'Dodici ore.');
  assert.equal(await evaluate('Boolean(document.querySelector(".page-wrap, .sidebar, .mobile-tabbar"))'), false, 'La carriera non è disegnata dietro la notte.');
  // the time of the career is suspended: the store refuses to advance and the clock does not move
  const frozen = await snapshot();
  await frozenCheck('esito');
  const after = await snapshot();
  assert.equal(after.date, frozen.date, 'advance() non muove il tempo durante la notte.');
  assert.equal(after.week, frozen.week);
  // the tabs
  const tabs = ['diretta', 'scrutinio', 'risultati', 'territorio', 'mappa', 'previsioni', 'parlamento', 'dichiarazioni'];
  for (const id of tabs) { await click(`[data-night-tab-value="${id}"]`); assert.equal(await evaluate('document.querySelector(".night-body").dataset.nightPanel'), id, `La scheda ${id} si apre.`); }
  // hour by hour: the clock moves one hour, the career does not, the count only grows
  let lastBallots = -1;
  for (let hour = 2; hour <= 12; hour++) {
    await click('[data-night-next]');
    const now = await snapshot();
    assert.equal(now.night.hour, hour, `Ora ${hour}.`);
    assert.equal(now.date, frozen.date, `Ora ${hour}: il tempo della carriera non si muove.`);
    assert.equal(now.week, frozen.week, `Ora ${hour}: nessuna settimana è passata.`);
    assert.equal(now.last, frozen.last, `Ora ${hour}: il risultato non è registrato prima della fine.`);
    assert.equal(await evaluate('document.querySelector(".night-clock strong").textContent'), `${String((15 + hour - 1) % 24).padStart(2, '0')}:00`, `Ora ${hour}: l’orologio avanza di un’ora.`);
    const counted = await evaluate('(() => { const m = document.querySelector(".night-progress em").textContent.match(/(\\d+)\\/(\\d+)/); return Number(m[1]); })()');
    assert.ok(counted >= lastBallots, 'Le unità scrutinate non calano.'); lastBallots = counted;
    if (hour === 3) {
      await click('[data-night-tab-value="dichiarazioni"]');
      assert.ok(await evaluate('document.querySelectorAll("[data-night-say]").length') === 3, 'Alla terza ora il giocatore può dichiarare (tre scelte).');
      await click('[data-night-say-choice="fiduciosa"]');
      assert.equal((await snapshot()).night.statements, 1, 'La dichiarazione è registrata una volta.');
      assert.equal(await evaluate('document.querySelectorAll("[data-night-say]").length'), 0, 'Il quesito sparisce dopo la risposta.');
      await click('[data-night-tab-value="diretta"]');
    }
    if (hour === 6) {
      // reload in the middle: the same hour, the same news, nothing written twice
      const before = await snapshot();
      await goto();
      await wait(() => evaluate('Boolean(document.querySelector("[data-menu=continua]"))'));
      await evaluate('document.querySelector("[data-menu=continua]").click(), true');
      await wait(() => evaluate('Boolean(document.querySelector(".night"))'), 20000);
      const reloaded = await snapshot();
      assert.deepEqual(reloaded.night, before.night, 'Dopo il ricaricamento si ritrova la stessa ora, le stesse notizie, la stessa dichiarazione.');
      assert.equal(reloaded.date, before.date);
      // the file of the save (export and import): the night comes back as it was, and the game goes on from the same hour
      const viaFile = await S(`const text = store.exportSave(); store.loadGame(JSON.parse(text)); const s = store.getState(); return { hour: s.night?.hour, feed: s.night?.feed.length, statements: s.night?.statements.length, stage: s.night?.stage };`);
      assert.deepEqual(viaFile, { hour: before.night.hour, feed: before.night.feed, statements: before.night.statements, stage: before.night.stage }, 'Il salvataggio su file riporta la stessa notte.');
      await wait(() => evaluate('Boolean(document.querySelector(".night"))'), 20000);
    }
  }
  // phones: no horizontal scroll, a thumb-sized button, scrolling tabs
  for (const [name, w, h] of [['smartphone', 390, 800], ['smartphone stretto', 320, 700], ['tablet', 768, 1000], ['computer', 1440, 900]]) {
    await viewport(w, h, w < 800); await pause(400);
    for (const id of ['riepilogo', ...tabs]) {
      await click(`[data-night-tab-value="${id}"]`);
      const m = await evaluate(`(() => { const d = document.documentElement; const b = document.querySelector('.night-next'); const r = b.getBoundingClientRect(); const tabs = document.querySelector('.night .sx-tabs'); return { over: d.scrollWidth - innerWidth, h: r.height, w: r.width, inView: r.bottom <= innerHeight + 1 && r.top >= 0, tabH: Math.min(...[...document.querySelectorAll('.night .sx-tab')].map(x => x.getBoundingClientRect().height)), tabScroll: tabs.scrollWidth >= tabs.clientWidth }; })()`);
      assert.ok(m.over <= 1, `${name}/${id}: nessuno scorrimento orizzontale (${m.over}px).`);
      assert.ok(m.h >= 44 && m.inView, `${name}/${id}: il pulsante è grande (${Math.round(m.h)}px) e nello schermo.`);
      assert.ok(m.tabH >= (w < 700 ? 44 : 36), `${name}/${id}: schede toccabili (${Math.round(m.tabH)}px).`);
    }
  }
  await viewport(1280, 800, false); await pause(300);
  // animations: the setting applies to everything of the night
  for (const [mode, expectAnim] of [['full', true], ['reduced', false], ['off', false]]) {
    await evaluate(`document.documentElement.dataset.motion = ${JSON.stringify(mode)}; true`); await pause(150);
    await click('[data-night-tab-value="diretta"]');
    const m = await evaluate(`(() => { const item = document.querySelector('.night-item.is-new'); const bar = document.querySelector('.night-progress span'); return { anim: item ? getComputedStyle(item).animationName : 'nessuno', transition: getComputedStyle(bar).transitionDuration, live: getComputedStyle(document.querySelector('.night-live')).animationName }; })()`);
    if (expectAnim) { assert.equal(m.anim, 'night-in', 'Animazioni complete: le notizie entrano con movimento.'); assert.notEqual(m.transition, '0s', 'Animazioni complete: la barra dello scrutinio si muove.'); }
    else { assert.ok(m.anim === 'none' || m.anim === 'nessuno', `Animazioni ${mode}: le notizie non si animano (${m.anim}).`); assert.equal(m.transition, '0s', `Animazioni ${mode}: nessuna transizione sulla barra.`); assert.equal(m.live, 'none', `Animazioni ${mode}: nemmeno il segnale «in diretta».`); }
  }
  await evaluate(`document.documentElement.dataset.motion = 'off'; true`);
  await click('[data-night-tab-value="riepilogo"]');
  assert.match(await text(), /RIEPILOGO FINALE/, 'Il riepilogo finale è nella dodicesima ora.');
  const final = await snapshot();
  assert.equal(final.night.hour, 12);
  await click('[data-night-tab-value="risultati"]');
  const finalTable = await evaluate('[...document.querySelectorAll(".night-rows li")].map(li => li.querySelector("strong")?.textContent.trim() + "|" + li.querySelector(".night-num")?.textContent.trim())');
  assert.ok(finalTable.length >= 2, 'La classifica finale c’è.');
  // conclusion: the campaign closes once, with the result of the engine
  await click('[data-night-conclude]');
  await pause(500);
  const done = await snapshot();
  assert.equal(done.night, null, 'La notte è conclusa.');
  assert.equal(done.last, final.camp.id, 'Il risultato è registrato nella carriera, una volta.');
  assert.ok(done.held.length >= 1, 'La notte è segnata come già giocata.');
  assert.equal(await evaluate('Boolean(document.querySelector(".night"))'), false, 'La schermata della notte è sparita.');
  // the victory / defeat moment of the game (the result card with its effect) comes after the final result, with the tone of the real outcome
  await wait(() => evaluate('Boolean(document.querySelector(".outcome-overlay"))'), 15000);
  // (a party congress held the same week has its own card, shown first: the election's one comes in its turn)
  for (let i = 0; i < 4 && await S('return store.getState().game.celebrations?.outcome?.kind !== "elezione";'); i++) { await S('store.dismissOutcome(store.getState().game.celebrations.outcome.id); return true;'); await pause(400); }
  assert.equal(await S('return store.getState().game.celebrations?.outcome?.kind ?? null;'), 'elezione', 'La carta dell’esito dell’elezione compare.');
  const tone = await evaluate('(() => { const o = document.querySelector(".outcome-overlay"); return { cls: [...o.classList].find(c => /^is-(win|partial|loss)$/.test(c)), confetti: Boolean(o.querySelector(".outcome-confetti")), title: o.querySelector("h2, h3, strong")?.textContent ?? "" }; })()');
  const expected = await S(`const { electionTone } = await import('/src/core/celebration.js?v=${version}'); const c = store.getState().campaign; return electionTone(c.result, c.result.outcome);`);
  assert.equal(tone.cls, `is-${expected}`, `La carta dell’esito ha il tono dell’esito reale (${JSON.stringify({ expected, cls: tone.cls, recorded: await S('const st = store.getState(); const o = st.game.celebrations?.outcome; return [o?.tone, o?.headline, o?.lines, st.campaign.result.personalMandate, st.campaign.result.outcome?.code, st.campaign.stage, st.campaign.result.eliminatedInFirstRound, st.career.lastElectionResult?.personalMandate, st.campaign.result.playerSeats];') })}).`);
  assert.equal(await S('return store.getState().game.celebrations?.outcome?.tone ?? null;'), expected, 'E il tono registrato è lo stesso.');
  assert.equal(tone.confetti, expected === 'win', 'L’effetto di festa solo per la vittoria.');
  assert.equal(await S('return store.getState().career.electionHistory.filter(item => item.campaignId === store.getState().career.lastCampaignId).length;'), 1, 'Una sola voce nello storico.');
  assert.deepEqual(errors, [], 'Nessun errore JavaScript.');
  console.log(`Notte elettorale verificata in Chrome (computer, 768, 390 e 320 px): apertura al termine del voto, dodici ore con orologio e tempo della carriera fermo, schede, dichiarazione, ricaricamento a metà identico, conclusione unica${runoffSeen ? ', primo turno con ballottaggio e nuova campagna, carta di vittoria/sconfitta al termine, sospensione totale della carriera, animazioni ridotte' : ''}.`);
  assert.ok(votes >= 1, 'Prima della notte il giocatore vota al seggio (scena saltabile).');
}, { night: true });
