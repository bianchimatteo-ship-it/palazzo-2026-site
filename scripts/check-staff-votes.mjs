// The staff that votes for the player when the advance is delegated (setting «Votazioni delegate allo staff»): with «Mi fermo e voto io» an open ballot stops the advance (as before); with «Lo staff
// segue la linea del gruppo» or «Lo staff si astiene» the ballots that decide nothing big are cast by the staff and written in the diary, while a confidence vote, a bill of the player's own and the
// budget always wait. Without delegation nothing is ever cast for the player.
import assert from 'node:assert/strict';
import { startCareer } from './lib/long-run.mjs';

const KEY = 'politicando.settings.v1';
const setMode = mode => globalThis.localStorage.setItem(KEY, JSON.stringify({ staffVotes: mode }));
const run = async mode => {
  const { store } = await startCareer({ seed: `staff-${mode}`, level: 'deputato', fast: true });
  setMode(mode);
  store.setHeadlessVoter(null);
  const urgent = () => store.getState().game.inbox.filter(item => ['urgente', 'situazione'].includes(item.kind));
  const clear = () => { for (const item of urgent()) for (const choice of item.choices ?? []) { try { store.resolveAgendaItem(item.id, choice.id); break; } catch { /* next */ } } };
  let stops = 0, staff = 0, essentialStops = 0, delegatedWeeks = 0;
  for (let n = 0; n < 150 && store.getState().game.status !== 'ended'; n++) {
    clear();
    const report = store.advanceTurn(1, { delegate: true });
    delegatedWeeks += report.weeks;
    const open = store.getState().parliament ? (await import('../src/core/lawmaking-engine.js')).openVotesOf(store.getState()) : [];
    if (report.reason === 'voto') { stops++; if (open.some(vote => vote.scope === 'fiducia' || vote.own || /bilancio|manovra/i.test(`${vote.kindLabel} ${vote.title}`))) essentialStops++; }
    // the player votes what made the advance stop (an essential ballot, or every ballot in the mode that stops)
    if (report.reason === 'voto') for (const vote of open) { try { store.castOpenVote(vote.id, 'favorevole'); } catch { /* closed */ } }
  }
  staff = store.getState().game.memory?.filter?.(item => item.kind === 'voto-staff').length ?? 0;
  return { stops, staff, essentialStops, delegatedWeeks };
};
const stopMode = await run('ferma'), lineMode = await run('linea'), abstainMode = await run('astensione');
assert.equal(stopMode.staff, 0, 'Con «Mi fermo e voto io» lo staff non vota mai.');
assert.ok(stopMode.stops > 0, `Con «Mi fermo e voto io» l’avanzamento si ferma alle votazioni (${stopMode.stops}).`);
assert.ok(lineMode.staff > 0, `Con «Lo staff segue la linea» lo staff vota (${lineMode.staff} voti scritti nel diario).`);
assert.ok(abstainMode.staff > 0, `Con «Lo staff si astiene» lo staff vota (${abstainMode.staff}).`);
assert.ok(lineMode.stops < stopMode.stops && abstainMode.stops < stopMode.stops, `Con lo staff ci si ferma meno (${stopMode.stops} → ${lineMode.stops} / ${abstainMode.stops}).`);
assert.equal(lineMode.stops, lineMode.essentialStops, 'Con lo staff ci si ferma solo per i voti essenziali (fiducia, leggi proprie, bilancio).');
console.log(`Votazioni delegate allo staff verificate: ferma ${stopMode.stops} volte; linea del gruppo ${lineMode.staff} voti dello staff e ${lineMode.stops} fermate per voti essenziali; astensione ${abstainMode.staff} voti e ${abstainMode.stops} fermate.`);
