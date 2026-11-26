// Advancing 1, 2 and 4 weeks in the two modes (setting «advanceMode», passed by the page with the player's settings):
//   A «Fermati per le decisioni importanti» (default): the staff casts only the ordinary ballots its setting gives it; essential ballots, urgent matters, the campaign and the election night stop the
//     advance with the reason and the weeks that passed;
//   B «Delega tutto allo staff»: the staff casts every ballot it can decide by the documented rule (own measure: for; otherwise the line of the group), the open matters take their default, the
//     campaign goes on, the election night is not played; every staff ballot is in the diary; only a ballot with no line stops it, saying why.
// Checked on several careers over many turns: the weeks asked are the weeks that pass (B), each week is simulated once (the calendar moves 7 days per week, the week counter by one), no diary entry is
// duplicated, the essential ballots really occur and are decided (B) or stop (A), save and reload in the middle, no infinite block (every turn ends), the election night of A stops instead of failing.
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';

const days = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
const essential = vote => vote.scope === 'fiducia' || Boolean(vote.own) || /bilancio|manovra/i.test(`${vote.kindLabel ?? ''} ${vote.title ?? ''}`);
const { openVotesOf } = await import('../src/core/lawmaking-engine.js');
const totals = { A: { turns: 0, weeks: 0, stops: {}, staff: 0 }, B: { turns: 0, weeks: 0, stops: {}, staff: 0, essentialByStaff: 0, nights: 0 } };

async function play({ seed, level, mode, weeks, turns, night = false, reload = false }) {
  const run = await startCareer({ seed, level, fast: true });
  const { store } = run;
  store.setHeadlessVoter(null);
  if (night) store.setElectionNightLive?.(true);
  const stats = totals[mode];
  for (let turn = 0; turn < turns && store.getState().game.status !== 'ended'; turn++) {
    if (reload && turn === Math.floor(turns / 2)) { store.loadGame(JSON.parse(store.exportSave())); store.setHeadlessVoter(null); }
    const before = store.getState();
    const from = before.clock.currentDate, week0 = before.game.week.index;
    const report = store.advanceTurn(weeks, { mode: mode === 'B' ? 'delega' : 'decisioni', staffVotes: 'linea' });
    const after = store.getState();
    stats.turns++; stats.weeks += report.weeks; stats.staff += report.staffDecisions ?? 0;
    // 14. each week once: 7 days and one week of the career for every week that passed (a campaign moves day by day but by the same 7 days)
    assert.equal(days(from, after.clock.currentDate), 7 * report.weeks, `${seed} ${mode}: ${report.weeks} settimane = ${7 * report.weeks} giorni (${from} → ${after.clock.currentDate}).`);
    assert.ok(after.game.week.index - week0 === report.weeks || after.game.status === 'ended', `${seed} ${mode}: il contatore delle settimane avanza di ${report.weeks}.`);
    // 15. nothing duplicated in the diary
    const ids = after.game.log.map(entry => entry.id);
    assert.equal(new Set(ids).size, ids.length, `${seed} ${mode}: nessuna voce del diario duplicata.`);
    if (report.reason !== 'completato') stats.stops[report.reason] = (stats.stops[report.reason] ?? 0) + 1;
    if (mode === 'B') {
      // 12. B: only an undecidable ballot (no line), the end of the career or a scene already open stop it
      assert.ok(['completato', 'voto', 'fine'].includes(report.reason), `${seed} B: la delega totale non si ferma per «${report.reason}» (${report.title}).`);
      if (report.reason === 'voto') {
        const left = openVotesOf(after);
        assert.ok(left.length && left.every(vote => !vote.own && !['favorevole', 'contrario', 'astenuto'].includes(vote.line)), `${seed} B: si ferma solo per un voto senza una linea da seguire.`);
        assert.match(after.ui.toast, /mi sono fermato perché/, 'Il motivo è detto.');
        for (const vote of left) { try { store.castOpenVote(vote.id, 'astenuto'); } catch { /* closed */ } }
      } else assert.equal(report.weeks, report.reason === 'fine' ? report.weeks : weeks, `${seed} B: ${weeks} settimane chieste, ${weeks} trascorse.`);
      assert.ok(!after.night, `${seed} B: la Notte Elettorale non si gioca con la delega totale.`);
      stats.essentialByStaff += after.game.log.filter(entry => entry.title === 'Delega totale: lo staff ha votato per te').length;
    } else {
      // 11. A: a stop always names its reason and the weeks that passed; then the player settles what waits
      if (report.reason !== 'completato' && report.reason !== 'fine') assert.match(after.ui.toast, new RegExp(`Avanzate ${report.weeks} (settimana|settimane) su ${weeks}: mi sono fermato perché`), `${seed} A: motivo e settimane detti (${after.ui.toast}).`);
      if (report.reason === 'voto') {
        const left = openVotesOf(after);
        assert.ok(left.length && left.every(essential), `${seed} A: con lo staff sulla linea ci si ferma solo per i voti essenziali.`);
        for (const vote of left) { try { store.castOpenVote(vote.id, 'favorevole'); } catch { /* closed */ } }
      }
      if (report.reason === 'decisione') for (const item of after.game.inbox.filter(entry => ['urgente', 'situazione'].includes(entry.kind))) for (const choice of item.choices ?? []) { try { store.resolveAgendaItem(item.id, choice.id); break; } catch { /* next */ } }
      if (report.reason === 'notte') { totals.B.nights; assert.ok(after.night || after.scene, 'A: la Notte Elettorale ferma l’avanzamento invece di farlo fallire.'); store.concludeElectionNight?.(); if (store.getState().night) break; }
      if (report.reason === 'campagna') break;
    }
  }
  return store;
}

// 1-9, 11-17 across careers, 2 and 4 weeks, both modes, ordinary and essential ballots, urgent matters, a reload in the middle
for (const [seed, level] of [['avanza-a', 'deputato'], ['avanza-b', 'deputato'], ['avanza-c', 'senatore'], ['avanza-d', 'regionale']]) {
  for (const weeks of [1, 2, 4]) {
    await play({ seed: `${seed}-${weeks}-B`, level, mode: 'B', weeks, turns: weeks === 1 ? 20 : 30, reload: weeks === 4 });
    await play({ seed: `${seed}-${weeks}-A`, level, mode: 'A', weeks, turns: weeks === 1 ? 20 : 30, reload: weeks === 4 });
  }
}
// 10. a campaign under way up to the vote, with the election night of the page on: B goes through it to the result, A stops (campaign, then the night) with its reason, never with an error
for (const mode of ['B', 'A']) {
  const run = await startCareer({ seed: `avanza-campagna-${mode}`, level: 'comunale', fast: true });
  const { store, db } = run;
  store.setHeadlessVoter(null); store.setElectionNightLive?.(true);
  // up to the window of the candidacies (the ballots on the way are cast by the voter of the scripts, as the player would)
  store.setHeadlessVoter(() => 'astenuto');
  for (let tries = 0; tries < 20; tries++) { try { if (store.fastForwardToElection('comunale')) break; } catch { break; } }
  store.setHeadlessVoter(null);
  store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win', municipalityBand: 'fino-15000' }, db.parties);
  store.getState().campaign.nomination.status = 'approved'; store.loadGame(JSON.parse(store.exportSave())); store.setHeadlessVoter(null); store.setElectionNightLive?.(true);
  assert.equal(store.getState().campaign?.status, 'active', 'La campagna è in corso.');
  const reasons = [];
  for (let turn = 0; turn < 12 && store.getState().campaign?.status === 'active' && !store.getState().night; turn++) {
    const from = store.getState().clock.currentDate;
    const report = store.advanceTurn(4, { mode: mode === 'B' ? 'delega' : 'decisioni', staffVotes: 'linea' });
    reasons.push(report.reason);
    // the week of the vote ends on election day (the engine aligns the campaign to it): at most 6 days shorter, never longer, never a week counted twice
    { const moved = days(from, store.getState().clock.currentDate); assert.ok(moved <= 7 * report.weeks && moved >= 7 * report.weeks - 6, `campagna ${mode}: ${moved} giorni per ${report.weeks} settimane.`); }
    if (mode === 'A' && report.reason === 'campagna') { assert.match(store.getState().ui.toast, /la campagna ti richiede/); store.advanceTurn(1, { mode: 'decisioni', staffVotes: 'linea' }); }
    if (report.reason === 'decisione') for (const item of store.getState().game.inbox.filter(entry => ['urgente', 'situazione'].includes(entry.kind))) for (const choice of item.choices ?? []) { try { store.resolveAgendaItem(item.id, choice.id); break; } catch { /* next */ } }
    if (report.reason === 'voto') for (const vote of openVotesOf(store.getState())) { try { store.castOpenVote(vote.id, 'favorevole'); } catch { /* closed */ } }
  }
  if (mode === 'B') {
    assert.ok(!store.getState().night && store.getState().campaign?.status !== 'active', `B: la campagna arriva al risultato senza fermarsi e senza Notte Elettorale (${reasons.join(', ')}).`);
    assert.ok(reasons.every(reason => ['completato', 'fine', 'voto'].includes(reason)), `B: nessuna fermata per la campagna (${reasons.join(', ')}).`);
  } else {
    assert.ok(reasons.includes('campagna') || store.getState().night || reasons.includes('notte'), `A: la campagna o la Notte Elettorale fermano l’avanzamento con il motivo (${reasons.join(', ')}).`);
    if (store.getState().night) assert.throws(() => store.advance(7), /Notte Elettorale/, 'Durante la Notte la carriera aspetta.');
    if (store.getState().night) assert.throws(() => store.advanceTurn(4, { mode: 'decisioni' }), /Notte Elettorale/, 'Un nuovo avanzamento durante la Notte dice di concluderla (la pagina mostra la Notte).');
  }
  console.log(`campagna ${mode}: ${reasons.join(', ')}${store.getState().night ? ' · Notte Elettorale aperta' : ''}`);
}
assert.ok(totals.B.weeks > 0 && totals.A.weeks > 0);
assert.ok(totals.B.staff > 0, `Lo staff ha votato nella delega totale (${totals.B.staff}).`);
assert.ok(totals.B.essentialByStaff > 0, `Nella delega totale lo staff ha deciso anche voti essenziali (fiducia, bilancio, proposte proprie): ${totals.B.essentialByStaff}.`);
assert.ok((totals.A.stops.voto ?? 0) > 0, `In modalità A i voti essenziali fermano l’avanzamento (${totals.A.stops.voto ?? 0}).`);
console.log(`Avanzamento a 1, 2 e 4 settimane verificato. Delega totale: ${totals.B.turns} turni, ${totals.B.weeks} settimane, ${totals.B.staff} voti dello staff (di cui ${totals.B.essentialByStaff} essenziali nel diario), fermate ${JSON.stringify(totals.B.stops)}. Fermati per le decisioni: ${totals.A.turns} turni, ${totals.A.weeks} settimane, fermate ${JSON.stringify(totals.A.stops)}. Ogni settimana una volta, nessun duplicato nel diario, ricaricamento a metà, nessun blocco.`);
