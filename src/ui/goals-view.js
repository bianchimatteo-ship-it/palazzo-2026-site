// OBIETTIVI — the goals of the career, line by line: how far each one is (measured on what the player does and
// decides), what it pays and unlocks, what is still missing, and the public ambitions (goals declared with a deadline).
import { gameContext } from './game-mode.js?v=20261005-2';
import { objectiveProgress } from '../core/career-engine.js?v=20261005-2';
import { ambitionProblem } from '../core/objective-engine.js?v=20261005-2';
import { AMBITION_COST, AMBITION_LIMIT, OBJECTIVE_LINES, OBJECTIVE_LINE_ORDER } from '../data/simulation/objective-rules.js?v=20261005-2';
import { memoryBalance } from '../core/career-engine.js?v=20261005-2';
import { formatDate } from '../core/time.js?v=20261005-2';
import { badge, bar, card, esc, num } from './sections-kit.js?v=20261005-2';
import { REPUTATIONS } from '../data/simulation/standing-rules.js?v=20261005-2';

const REWARD_LABELS = { capital: 'Capitale politico', reputation: 'Reputazione', notoriety: 'Notorietà', popularity: 'Popolarità', influence: 'Influenza' };
const rewardText = reward => {
  const bits = [];
  if (reward?.capital) bits.push(`${REWARD_LABELS.capital} +${reward.capital}`);
  for (const [metric, value] of Object.entries(reward?.stats ?? {})) bits.push(`${REWARD_LABELS[metric] ?? metric} ${value > 0 ? '+' : ''}${String(value).replace('.', ',')}`);
  for (const [key, value] of Object.entries(reward?.relations ?? {})) bits.push(`Rapporto ${key === 'leadership' ? 'con la leadership' : key} +${value}`);
  if (reward?.party?.support) bits.push(`Sostegno nel partito +${reward.party.support}`);
  for (const [id, value] of Object.entries(reward?.standing ?? {})) bits.push(`${REPUTATIONS[id]?.label ?? id} +${value}`);
  return bits.join(' · ');
};
const valueText = (value, target) => `${num(Math.min(value, target), target % 1 || value % 1 ? 1 : 0)}/${num(target, target % 1 ? 1 : 0)}`;

function measureRows(item) {
  return `<ul class="gv-measures">${item.rows.map(row => `<li class="${row.met ? 'met' : ''}"><span>${esc(row.label)}</span><b>${valueText(row.value, row.target)}</b>${bar(row.ratio * 100, row.met ? 'good' : '')}</li>`).join('')}</ul>${item.mode === 'any' ? '<small class="gv-any">Basta una delle misure.</small>' : ''}`;
}

function goalCard(item, state, gc) {
  const game = state.game;
  const ambition = item.ambitionActive;
  let status;
  if (item.done) status = badge(item.silent ? 'Già raggiunto' : item.declaredKept ? 'Raggiunto · dichiarato' : 'Raggiunto', 'good');
  else if (ambition) status = badge(`Dichiarato · scade alla settimana ${ambition.deadline}`, ambition.deadline - game.week.index <= 6 ? 'bad' : 'warn');
  else if (item.waiting.length) status = badge(`Dopo: ${item.waiting.join(', ')}`, 'neutral');
  else status = badge(`${Math.round(item.progress * 100)}%`, item.progress >= 0.6 ? 'good' : 'neutral');
  let action = '';
  if (!item.done && item.ambition) {
    const problem = ambitionProblem(gc.ctx, gc.env, item, { memoryNet: memoryBalance(game).net });
    action = ambition ? '' : `<button class="secondary-button" data-ambition-declare="${esc(item.id)}" ${problem ? `disabled title="${esc(problem)}"` : ''}>Dichiara pubblicamente · ${AMBITION_COST.capital} capitale, entro ${item.ambition.weeks} settimane</button>${problem && !item.waiting.length ? `<em class="decision-block">${esc(problem)}</em>` : ''}`;
  }
  const unlock = item.unlock?.text ? `<p class="gv-unlock"><b>${item.done ? 'Sbloccato' : 'Sblocca'}</b> ${esc(item.unlock.text)}</p>` : '';
  const reward = item.done ? '' : `<p class="gv-reward"><b>Premio</b> ${esc(rewardText(item.reward))}${item.ambition ? ` (doppio se lo dichiari e lo mantieni)` : ''}</p>`;
  const when = item.completedAt ? `<small>${item.silent ? 'già raggiunto prima di questa versione' : `raggiunto il ${esc(formatDate(item.completedAt))}`}</small>` : '';
  return `<article class="gv-goal ${item.done ? 'is-done' : ''} ${ambition ? 'is-declared' : ''}"><header><strong>${esc(item.label)}</strong>${status}</header><p>${esc(item.detail)}</p>${item.done ? '' : measureRows(item)}${unlock}${reward}${when}${action ? `<div class="sx-actions">${action}</div>` : ''}</article>`;
}

export function renderGoals(state) {
  const game = state.game;
  const gc = gameContext(state);
  const items = objectiveProgress(gc.ctx, gc.env).filter(item => item.available);
  const done = items.filter(item => item.done).length;
  const declared = game.ambitions ?? [];
  const record = game.record ?? {};
  const head = `<div class="gv-head"><div><strong>${done} / ${items.length}</strong><span>obiettivi raggiunti</span></div><div><strong>${declared.length} / ${AMBITION_LIMIT}</strong><span>impegni dichiarati</span></div><div><strong>${record.decisions?.made ?? 0}</strong><span>decisioni prese${record.decisions?.delegated ? ` · ${record.decisions.delegated} lasciate al caso` : ''}</span></div><div><strong>${record.ambitions?.kept ?? 0} / ${record.ambitions?.broken ?? 0}</strong><span>impegni mantenuti / mancati</span></div></div><p class="sx-note">Gli obiettivi non si spuntano da soli: si misurano su ciò che fai e decidi (attività, scelte, rapporti, mandati, promesse). Ognuno paga un premio e lascia qualcosa che continua a pesare: rapporti che si assestano più in alto, più peso nelle promozioni e nelle candidature, nuove decisioni in agenda. Un obiettivo dichiarato in pubblico vale il doppio se lo mantieni e costa credibilità se lo manchi.</p>`;
  const lines = OBJECTIVE_LINE_ORDER.map(line => ({ line, goals: items.filter(item => item.line === line) })).filter(entry => entry.goals.length)
    .map(entry => card({ kicker: OBJECTIVE_LINES[entry.line].toUpperCase(), title: `${entry.goals.filter(item => item.done).length} su ${entry.goals.length}`, body: `<div class="gv-goals">${entry.goals.map(item => goalCard(item, state, gc)).join('')}</div>` })).join('');
  const unlocked = Object.values(game.unlocks ?? {});
  const unlocks = unlocked.length ? card({ kicker: 'COSA HAI SBLOCCATO', title: `${unlocked.length} ${unlocked.length === 1 ? 'conseguenza' : 'conseguenze'} che restano`, body: `<ul class="gv-unlocks">${unlocked.map(entry => `<li><strong>${esc(entry.label)}</strong><small>${esc(entry.text)}</small></li>`).join('')}</ul>` }) : '';
  return `<div class="goals-view">${head}${unlocks}${lines}</div>`;
}
