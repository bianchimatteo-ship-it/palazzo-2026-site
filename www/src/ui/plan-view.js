// The plan of the week: the operations the player collects (activities, committee and local-leader actions, treasury operations) and does together, after seeing what they cost and what is
// left. The tray shows the list with the days, funds and capital each one takes from the one before, names the step that cannot be done and why, and nothing runs until the player confirms.
import { WEEKLY_ACTIVITIES } from '../data/simulation/career-rules.js?v=20261027-4';
import { CADRE_ACTIONS } from '../data/simulation/party-life-rules.js?v=20261027-4';
import { TREASURY_OPERATIONS } from '../data/simulation/finance-rules.js?v=20261027-4';
import { COMMITTEE_ACTIONS } from '../core/committee-engine.js?v=20261027-4';
import { esc, euro } from './sections-kit.js?v=20261027-4';
import { glyph } from './visuals.js?v=20261027-4';

export const PLAN_MAX = 12;
// The identity of an operation (the target of an activity is not part of it: the same activity is the same step).
export const planKey = op => [op.kind, op.id ?? '', op.action ?? '', op.cadreId ?? '', op.committeeId ?? ''].join('|');
export const planAddButton = (op, label = '+ Piano') => `<button type="button" class="plan-add" data-plan-add="${esc(JSON.stringify(op))}" aria-pressed="false" title="Aggiungi al piano della settimana: lo vedi con i costi e lo esegui con le altre operazioni, in una volta">${esc(label)}</button>`;

export function planOpLabel(state, op) {
  if (op.kind === 'activity') return WEEKLY_ACTIVITIES.find(item => item.id === op.id)?.label ?? op.id;
  if (op.kind === 'committee') return `${COMMITTEE_ACTIONS[op.action]?.label ?? op.action} · ${state.game?.party?.org?.committees?.find(item => item.id === op.id)?.name ?? ''}`.replace(/ · $/, '');
  if (op.kind === 'cadre') { const cadre = (state.game?.party?.life?.cadres ?? []).find(item => item.id === op.cadreId); return `${(CADRE_ACTIONS[op.action]?.label ?? op.action).replace(' il dirigente', '')}${cadre ? ` · ${cadre.name}` : ''}`; }
  return TREASURY_OPERATIONS.find(item => item.id === op.id)?.label ?? op.id;
}
export const costText = cost => [cost.ap ? `${cost.ap} ${cost.ap === 1 ? 'giorno' : 'giorni'}` : '', cost.funds ? euro(cost.funds) : '', cost.capital ? `${cost.capital} cap.` : '', cost.treasury ? `${euro(cost.treasury)} dalla tesoreria` : ''].filter(Boolean).join(' · ') || 'nessun costo';

export function renderPlanTray(state, plan, preview) {
  if (!plan.length) return '';
  const ok = Boolean(preview?.ok);
  const lines = preview?.lines ?? [];
  const items = plan.map((op, index) => { const line = lines[index]; return `<li class="${line && !line.ok ? 'is-blocked' : ''}"><span><strong>${index + 1}. ${esc(planOpLabel(state, op))}</strong><small>${line ? (line.ok ? esc(costText(line.cost)) : `${glyph('alert', 12)} ${esc(line.problem)}`) : ''}</small></span><button type="button" data-plan-remove="${index}" aria-label="Togli «${esc(planOpLabel(state, op))}» dal piano">×</button></li>`; }).join('');
  const total = preview?.total ?? { ap: 0, funds: 0, capital: 0, treasury: 0 };
  const end = preview?.end ?? null;
  const summary = `${plan.length} ${plan.length === 1 ? 'operazione' : 'operazioni'} · ${costText(total)}`;
  return `<aside class="plan-tray ${ok ? '' : 'is-blocked'}" role="region" aria-label="Piano della settimana" data-plan-tray>
    <details class="plan-details" data-remember="plan-tray"><summary><span class="plan-title">${glyph('route', 15)} Piano della settimana</span><span class="plan-summary">${esc(summary)}</span></summary>
      <ol class="plan-list">${items}</ol>${end ? `<p class="plan-after">Dopo il piano: ${end.ap} giorni, ${euro(end.funds)} in cassa, ${end.capital} di capitale politico.</p>` : ''}
      ${preview?.error ? `<p class="staff-problem">${esc(preview.error)}</p>` : ''}</details>
    <div class="plan-actions"><button type="button" class="primary-button" data-plan-run ${ok ? '' : 'disabled'} ${ok ? '' : 'title="Un passo del piano non si può fare: toglilo o cambia il piano"'}>Rivedi ed esegui</button><button type="button" class="secondary-button" data-plan-clear>Svuota</button></div>
  </aside>`;
}
// The lines of the final confirmation.
export function planConfirmLines(state, plan, preview) {
  return [...preview.lines.map((line, index) => `${index + 1}. ${planOpLabel(state, plan[index])} — ${costText(line.cost)}`), `Totale: ${costText(preview.total)}.`, `Dopo il piano: ${preview.end.ap} giorni, ${euro(preview.end.funds)} in cassa, ${preview.end.capital} di capitale politico.`, 'Gli esiti dipendono dal caso e dai rischi di ogni operazione: i costi sono quelli indicati.'];
}
