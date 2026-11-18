// Reminders of the promises the player made: a short card (never a dialog that blocks) that brings back the open promises at the right moments — a deadline coming (eight, four and one weeks
// before), a promise that has not started a while after it was made, one that is late — each reminder once (the log keeps the milestone), at most one card every three weeks, and only for the
// promises still open. Pure: the store keeps the log (game.reminderLog) and the page shows the card only when nothing else is going on (a scene, a vote, the night, a dialog).
import { PROMISE_SETTLED } from './program-engine.js?v=20261118-33';

export const REMINDER_RULES = Object.freeze({ milestones: [8, 4, 1], notStartedAfter: 6, every: 3, max: 3 });
const open = promise => !PROMISE_SETTLED.includes(promise.status) && promise.kind === 'programma';
// Returns { items, keys }: the reminders due now (the most urgent first) and the log keys to write once the card is shown.
export function dueReminders(game, { week }) {
  const log = game?.reminderLog ?? {};
  if (week - (log.lastShown ?? -99) < REMINDER_RULES.every) return { items: [], keys: [] };
  const items = [];
  for (const promise of (game?.promises ?? []).filter(open)) {
    const left = promise.dueWeek - week;
    const base = { promiseId: promise.id, label: promise.label, intervention: promise.intervention, progress: promise.progress ?? 0, status: promise.status, weeksLeft: left, area: promise.area, priority: promise.priority ?? 'media' };
    const milestone = [...REMINDER_RULES.milestones].sort((a, b) => a - b).find(value => left <= value && left > -1);
    if (milestone !== undefined && !log[`${promise.id}|scadenza|${milestone}`]) { items.push({ ...base, kind: 'scadenza', key: `${promise.id}|scadenza|${milestone}`, text: left <= 1 ? `La scadenza è questa settimana.` : `Mancano ${left} settimane alla scadenza.` }); continue; }
    if (left < 0 && !log[`${promise.id}|ritardo`]) { items.push({ ...base, kind: 'ritardo', key: `${promise.id}|ritardo`, text: 'La scadenza è passata: i cittadini aspettano ancora.' }); continue; }
    if (promise.status === 'non-avviata' && week - promise.madeWeek >= REMINDER_RULES.notStartedAfter && !log[`${promise.id}|avvio`]) items.push({ ...base, kind: 'avvio', key: `${promise.id}|avvio`, text: 'Non hai ancora fatto nulla per mantenerla.' });
  }
  const weight = item => (item.kind === 'ritardo' ? 0 : item.kind === 'scadenza' ? 1 + Math.max(0, item.weeksLeft) / 10 : 3) + (item.priority === 'alta' ? -0.5 : 0);
  items.sort((a, b) => weight(a) - weight(b));
  const shown = items.slice(0, REMINDER_RULES.max);
  return { items: shown, keys: shown.map(item => item.key) };
}
export function markReminded(game, keys, { week }) {
  const log = { ...(game.reminderLog ?? {}), lastShown: week };
  for (const key of keys) log[key] = week;
  return { ...game, reminderLog: log };
}
