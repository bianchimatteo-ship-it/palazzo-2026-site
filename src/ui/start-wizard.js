// The starting conditions in the career wizard (step 4, under the difficulty): how the career begins — an ordinary
// start, an outsider, with political debts, in a party already divided, with a consolidated career, or a custom
// scenario built under a budget of points. What each choice does is read from the same rules the engine applies.
import { LEVER_BY_ID, START_BUDGET, START_LEVERS, START_LEVEL_MAX, START_PROFILES, START_PROFILE_ORDER } from '../data/simulation/start-rules.js?v=20261003-2';
import { normalizeStart, planLines, startPlan } from '../core/start-engine.js?v=20261003-2';
import { legacyPicker } from './hall-view.js?v=20261003-2';

const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const list = (items, mark) => items.length ? `<ul class="start-list">${items.map(item => `<li data-mark="${mark}">${esc(item)}</li>`).join('')}</ul>` : '';

function profileCards(d, selected) {
  return START_PROFILE_ORDER.map(id => {
    const item = START_PROFILES[id];
    const blocked = item.party === 'member' && d.partyMode !== 'existing' && id !== selected;
    const on = id === selected;
    return `<button type="button" class="start-card ${on ? 'selected' : ''}" data-start-profile="${esc(id)}" aria-pressed="${on}" ${blocked ? 'disabled' : ''}>
      <span class="start-card-top"><strong>${esc(item.label)}</strong><span class="radio-ring"></span></span>
      <p>${esc(item.summary)}</p>${list(item.gives, '+')}${list(item.costs, '−')}
      ${blocked ? '<em class="start-note">Serve un partito esistente: sceglilo nel passaggio 3.</em>' : ''}
    </button>`;
  }).join('');
}

function leverRow(lever, level, plan, d) {
  const memberOnly = lever.party === 'member' && d.partyMode !== 'existing';
  const points = lever.kind === 'vantaggio' ? `costa ${lever.cost} ${lever.cost === 1 ? 'punto' : 'punti'} a livello` : `dà ${lever.gain} ${lever.gain === 1 ? 'punto' : 'punti'} a livello`;
  const canUp = level < START_LEVEL_MAX && !memberOnly && (lever.kind === 'zavorra' || plan.points.balance >= lever.cost);
  return `<div class="start-lever ${level ? 'active' : ''} ${lever.kind}">
    <div class="start-lever-text"><strong>${esc(lever.label)}</strong><small>${esc(lever.detail)}</small><em>${esc(points)}${memberOnly ? ' · serve un partito esistente' : ''}</em></div>
    <div class="start-lever-stepper" role="group" aria-label="Livello di ${esc(lever.label)}">
      <button type="button" data-start-lever="${esc(lever.id)}" data-start-delta="-1" aria-label="Riduci: ${esc(lever.label)}" ${level ? '' : 'disabled'}>−</button>
      <b aria-live="polite">${level}</b>
      <button type="button" data-start-lever="${esc(lever.id)}" data-start-delta="1" aria-label="Aumenta: ${esc(lever.label)}" ${canUp ? '' : 'disabled'}>+</button>
    </div>
  </div>`;
}

function editor(d, levels, plan) {
  const p = plan.points;
  const tone = p.balance < 0 ? 'bad' : p.balance === 0 ? 'neutral' : 'good';
  const rows = kind => START_LEVERS.filter(lever => lever.kind === kind).map(lever => leverRow(lever, levels[lever.id] ?? 0, plan, d)).join('');
  return `<div class="start-editor">
    <div class="start-points tone-${tone}"><strong>${p.balance} ${Math.abs(p.balance) === 1 ? 'punto' : 'punti'} da spendere</strong><span>${START_BUDGET} liberi + ${p.gained} dalle zavorre − ${p.spent} per i vantaggi</span></div>
    <h4 class="start-sub">Vantaggi: costano punti</h4><div class="start-levers">${rows('vantaggio')}</div>
    <h4 class="start-sub">Zavorre: ti danno punti</h4><div class="start-levers">${rows('zavorra')}</div>
    <small>Ogni condizione cambia davvero la partita: valori e rapporti di partenza, e pressioni che continuano (debiti, nemici, un partito in guerra, attese da rispettare). Resta segnato come scenario personalizzato nella Hall of Fame.</small>
  </div>`;
}

// What the chosen start does, level by level (generated from the engine's own numbers).
function effects(plan) {
  const rows = planLines(plan);
  if (!rows.length) return '';
  return `<div class="start-effects"><h4 class="start-sub">Cosa cambia nella tua partenza</h4><ul>${rows.map(row => `<li class="${row.kind}"><strong>${esc(row.label)} · livello ${row.level}/3</strong><ul>${row.lines.map(line => `<li>${esc(line)}</li>`).join('')}</ul></li>`).join('')}</ul>${plan.dropped.length ? `<em class="start-note">Non applicabili senza un partito esistente: ${plan.dropped.map(id => esc(LEVER_BY_ID[id].label)).join(', ')}.</em>` : ''}</div>`;
}

export function startStep(d) {
  const { profile, levels } = normalizeStart(d.start);
  const plan = startPlan(d.start, { partyMode: d.partyMode });
  const item = START_PROFILES[profile];
  return `<section class="summary-section start-section"><div class="summary-section-heading"><div><span>CONDIZIONI DI PARTENZA</span><strong>${esc(item.label)}</strong></div></div>
    <p class="start-intro">Oltre al percorso, scegli come inizi: sono condizioni vere, non etichette. Cambiano relazioni, risorse, vincoli e opportunità e continuano a produrre conseguenze durante tutta la partita.</p>
    <div class="start-grid" role="group" aria-label="Come inizia la carriera">${profileCards(d, profile)}</div>
    ${item.custom ? editor(d, levels, plan) : ''}${effects(plan)}${legacyPicker(d)}
  </section>`;
}

// One line for the final summary of the wizard.
export function startSummary(d) {
  const plan = startPlan(d.start, { partyMode: d.partyMode });
  const rows = planLines(plan);
  const heir = (d.hall ?? []).find(entry => entry.id === d.legacyId);
  return `<section class="summary-section"><div class="summary-section-heading"><div><span>04 · PUNTO DI PARTENZA</span><strong>${esc(plan.label)}</strong></div><button type="button" data-wizard-goto="4">Modifica</button></div><small>${rows.length ? esc(rows.map(row => `${row.label} ${row.level}/3`).join(' · ')) : 'Nessuna condizione particolare.'}${heir ? esc(` · con l’eredità di ${heir.name}`) : ''}</small></section>`;
}
