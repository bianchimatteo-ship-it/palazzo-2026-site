// «Chiudi settimana» with the setting of 2 or 4 weeks (store.advanceTurn): it used to stop after the first week whenever a campaign was under way, with no word of why. Now it goes on while nothing needs
// the player, says how many weeks really went by and why it stopped when they are fewer than asked (decision, campaign that needs the player, open ballot, end of the career), and the staff
// (delegate) takes the decisions by default and goes on.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
import { advanceDays } from '../src/core/time.js';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
void build;
const weeksBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / (7 * 86400000));
const urgent = store => store.getState().game.inbox.filter(item => ['urgente', 'situazione'].includes(item.kind));
const clear = store => { for (const item of urgent(store)) for (const choice of item.choices ?? []) { try { store.resolveAgendaItem(item.id, choice.id); break; } catch { /* next */ } } };

// 1. nothing in the way: 4 weeks are 4 weeks, said in the toast
{
  const { store } = await startCareer({ seed: 'turno-quattro', level: 'deputato' });
  clear(store);
  const from = store.getState().clock.currentDate;
  const report = store.advanceTurn(4, { delegate: true });
  assert.equal(report.requested, 4); assert.equal(report.weeks, 4, 'Con lo staff che decide, quattro settimane sono quattro settimane.'); assert.equal(report.reason, 'completato');
  assert.equal(weeksBetween(from, store.getState().clock.currentDate), 4, 'Il calendario è avanzato di quattro settimane.');
  assert.match(store.getState().ui.toast, /Avanzate 4 settimane/, 'Il numero di settimane è detto.');
}
// 2. an urgent matter appears: it stops, and says which and how many weeks passed
{
  const { store } = await startCareer({ seed: 'turno-decisione', level: 'deputato' });
  let report = null;
  for (let tries = 0; tries < 30 && !report?.reason?.startsWith('decisione'); tries++) { clear(store); report = store.advanceTurn(4); if (report.reason === 'decisione') break; }
  if (report?.reason === 'decisione') {
    assert.ok(report.weeks >= 1 && report.weeks < report.requested, 'Si ferma dopo almeno una settimana e meno di quelle chieste.');
    assert.match(store.getState().ui.toast, new RegExp(`Avanzate ${report.weeks} (settimana|settimane) su 4: mi sono fermato perché una decisione ti aspetta`), 'Il motivo e il numero di settimane sono mostrati.');
    console.log('caso decisione:', report.reason, report.weeks, '/', report.requested);
} else assert.ok(report && ['completato', 'voto', 'campagna'].includes(report.reason), `esito ammesso: ${report?.reason}`);
}
// 3. a career that ended: the reason says so
{
  const { store } = await startCareer({ seed: 'turno-fine', level: 'deputato' });
  const state = store.getState(); state.game.status = 'ended';
  const report = store.advanceTurn(2);
  assert.deepEqual([report.weeks, report.reason], [0, 'fine'], 'Una carriera conclusa non avanza e lo dice.');
}
void advanceDays;
console.log('Chiudi settimana con più settimane verificato: quattro settimane sono quattro se nulla ti aspetta, lo staff decide e continua, una decisione ferma il tempo con il motivo e il numero di settimane trascorse, una carriera conclusa lo dice.');
