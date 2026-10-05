// HALL OF FAME, retirement and legacy: the careers concluded and what they leave. The Hall belongs to the player and
// outlives every career; a new career can start from the legacy of one of them (a bounded set of starting conditions,
// never a change to the world of the game). Also the card of the Career page where a career is concluded.
import { LEVER_BY_ID, START_PROFILES } from '../data/simulation/start-rules.js?v=20261005-2';
import { END_KINDS, LEGACY_TIERS, RETIREMENT, boonLines, careerFacts, legacyBoon, legacyScore, legacyTags, retirementProblem, tierOf } from '../core/legacy-engine.js?v=20261005-2';
import { formatDate } from '../core/time.js?v=20261005-2';

const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const leverLabel = id => LEVER_BY_ID[id]?.label ?? id;
const year = iso => String(iso ?? '').slice(0, 4);
const num = value => Number(value ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 1 });
const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${num(Math.abs(value))}`;
const LEVELS = Object.freeze({ comunale: 'Comunale', provinciale: 'Provinciale', regionale: 'Regionale', deputato: 'Camera dei deputati', senatore: 'Senato', europeo: 'Parlamento europeo' });

const partsList = parts => `<ul class="hall-parts">${parts.map(item => `<li class="${item.points < 0 ? 'neg' : ''}"><span>${esc(item.label)}</span><b>${signed(item.points)}</b></li>`).join('')}</ul>`;
const tagList = tags => tags.length ? `<ul class="hall-tags">${tags.map(tag => `<li>${esc(tag)}</li>`).join('')}</ul>` : '';

// ---------- the Hall of Fame (menu) ----------
function entryCard(entry) {
  const boon = legacyBoon(entry);
  const tier = LEGACY_TIERS.find(item => item.id === entry.tier?.id) ?? tierOf(entry.score);
  const profile = START_PROFILES[entry.startProfile]?.label ?? 'Inizio ordinario';
  const facts = [
    ['Carica più alta', entry.peak?.label ?? 'Nessuna'], ['Anni di carriera', num(entry.years)], ['Partito', entry.party ? `${entry.party.label ?? 'Partito'}${entry.party.founded ? ' (fondato da lui)' : entry.party.rankTitle ? ` · ${entry.party.rankTitle}` : ''}` : 'Indipendente'],
    ['Mandati conquistati', entry.counts?.mandates ?? 0], ['Leggi approvate', entry.counts?.laws ?? 0], ['Obiettivi raggiunti', entry.counts?.objectives ?? 0],
    ['Partenza', `${LEVELS[entry.level] ?? entry.level} · ${profile}`], ['Difficoltà', entry.difficulty]
  ];
  return `<article class="hall-entry" data-hall-entry="${esc(entry.id)}">
    <header><div><strong>${esc(entry.name)}</strong><small>${esc(entry.endLabel ?? '')} · ${esc(year(entry.startedAt))}–${esc(year(entry.endedAt))} · ${esc(entry.age ? `${entry.age} anni` : '')}</small></div><span class="hall-score" aria-label="Eredità ${entry.score} su 100">${entry.score}<small>/100</small></span></header>
    <p class="hall-tier"><b>${esc(tier.label)}</b> ${esc(tier.text)}</p>${tagList(entry.tags ?? [])}
    <dl class="hall-facts">${facts.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
    <details><summary>Come è stata pesata l’eredità</summary>${partsList(entry.parts ?? [])}</details>
    <p class="hall-boon"><b>Cosa lascia a una nuova carriera</b> ${esc(boonLines(boon, leverLabel).join(' · '))}</p>
    <div class="hall-actions"><button class="primary-button" data-hall-legacy="${esc(entry.id)}">Nuova carriera con questa eredità</button><button class="secondary-button" data-hall-delete="${esc(entry.id)}">Elimina dalla Hall of Fame</button></div>
  </article>`;
}
export function hallView(entries = []) {
  return `<h2>Hall of Fame</h2><p class="section-subtitle">Le carriere concluse, dalla più alta in giù. Ogni carriera lascia un’eredità politica pesata su ciò che è davvero successo: cariche, mandati, leggi, obiettivi, partito, reputazione e memoria. Una nuova carriera può partire dall’eredità di una di queste, senza toccare il mondo di gioco. La Hall resta nel browser anche se cancelli i salvataggi.</p>
    ${entries.length ? `<div class="hall-list">${entries.map(entryCard).join('')}</div>` : '<p class="quiet-copy">Nessuna carriera conclusa. Quando lascerai la politica (Carriera → Percorso), la tua storia entrerà qui con la sua eredità.</p>'}
    <details class="hall-howto"><summary>Come si pesa l’eredità</summary><ul class="hall-parts"><li><span>Punteggio da 0 a 100: anni di carriera, carica più alta (in proporzione a quanto è durata), mandati, leggi, obiettivi, partito guidato, reputazione, memoria politica, parola data, scandali e cadute.</span></li>${LEGACY_TIERS.map(item => `<li><span><b>${esc(item.label)}</b> da ${item.min} · ${esc(item.text)}</span></li>`).join('')}<li><span>Gli scenari personalizzati valgono l’85% e la difficoltà pesa sul risultato (facile 90%, difficile 112%).</span></li></ul></details>`;
}

// ---------- the Career page: concluding the career ----------
export function renderRetirement(state) {
  const game = state.game;
  if (game.status === 'ended' && game.legacy) return endedPanel(state);
  const facts = careerFacts(state);
  const legacy = legacyScore(facts);
  const tags = legacyTags(facts);
  const button = (kind, label) => {
    const problem = retirementProblem(state, kind);
    return `<div class="hall-retire-action"><button class="secondary-button danger" data-retire="${kind}" ${problem ? `disabled title="${esc(problem)}"` : ''}>${esc(label)}</button>${problem ? `<em class="decision-block">${esc(problem)}</em>` : ''}</div>`;
  };
  return `<div class="hall-retire"><p class="hall-now"><span><b>La tua eredità oggi: ${legacy.score}/100</b> · ${esc(legacy.tier.label)}</span><small>${esc(legacy.tier.text)}</small></p>${tagList(tags)}
    <details><summary>Come è pesata oggi</summary>${partsList(legacy.parts)}</details>
    <p class="sx-note">Lasciare la politica conclude la carriera: incarichi e mandati finiscono, la partita si ferma e la tua storia entra nella Hall of Fame con la sua eredità, che una nuova carriera può raccogliere. Il pensionamento (da ${RETIREMENT.minAge} anni, dopo ${RETIREMENT.minYears} anni di carriera o da ex Presidente della Repubblica) lascia un congedo più dignitoso. La carriera in corso non si può riprendere.</p>
    <div class="sx-actions">${button('ritiro', 'Lascia la politica')}${button('pensionamento', 'Vai in pensione')}<div class="hall-retire-action"><button class="secondary-button" data-action="hall">Hall of Fame</button></div></div></div>`;
}
function endedPanel(state) {
  const game = state.game;
  const legacy = game.legacy;
  return `<div class="hall-retire is-ended"><p class="hall-now"><span><b>${esc(END_KINDS[game.endKind]?.label ?? 'Carriera conclusa')} il ${esc(formatDate(game.endedAt))}</b> · eredità ${legacy.score}/100 · ${esc(legacy.tier.label)}</span></p>${tagList(legacy.tags ?? [])}
    <details><summary>Come è stata pesata</summary>${partsList(legacy.parts ?? [])}</details>
    <div class="sx-actions"><button class="primary-button" data-hall-legacy="${esc(legacy.hallId)}">Nuova carriera con questa eredità</button><button class="secondary-button" data-action="new-career">Nuova carriera</button><button class="secondary-button" data-action="hall">Hall of Fame</button></div></div>`;
}

// What the Home says of a concluded career.
export function endedHeadline(state) {
  const game = state.game;
  const legacy = game.legacy;
  if (!game.endKind || !legacy) return null;
  return ['CARRIERA CONCLUSA', `${legacy.tier.label} · eredità ${legacy.score}/100`, 'Gli incarichi sono finiti e la partita è ferma: la tua storia è nella Hall of Fame. Puoi iniziare una nuova carriera, anche con l’eredità di questa.',
    `<button class="primary-button" data-hall-legacy="${esc(legacy.hallId)}">Nuova carriera con questa eredità</button> <button class="secondary-button" data-action="hall">Hall of Fame</button>`];
}

// ---------- the wizard: starting from the legacy of a concluded career ----------
// The legacy picked in the Hall stays visible on every step (its conditions are chosen at the step of the starting point).
export function legacyBanner(d) {
  const chosen = (d.hall ?? []).find(entry => entry.id === d.legacyId);
  if (!chosen) return '';
  return `<p class="start-banner" role="status"><b>Parti dall’eredità di ${esc(chosen.name)}</b> ${esc(chosen.tier?.label ?? '')} · ${chosen.score}/100. Cosa lascia a questa carriera si vede al passaggio «Difficoltà»; il mondo di gioco resta lo stesso.</p>`;
}
export function legacyPicker(d) {
  const hall = d.hall ?? [];
  if (!hall.length) return '';
  const chosen = hall.find(entry => entry.id === d.legacyId) ?? null;
  const boon = chosen ? legacyBoon(chosen) : null;
  return `<div class="start-legacy"><h4 class="start-sub">Eredità di una carriera conclusa</h4>
    <label>Raccogli l’eredità di…<select name="legacyId" data-wizard-legacy><option value="">Nessuna: una storia nuova</option>${hall.map(entry => `<option value="${esc(entry.id)}" ${entry.id === d.legacyId ? 'selected' : ''}>${esc(entry.name)} · ${esc(entry.tier?.label ?? '')} · ${entry.score}/100</option>`).join('')}</select></label>
    ${boon ? `<p class="start-note">${esc(boonLines(boon, leverLabel).join(' · '))}. Sono condizioni di partenza in più, senza costo in punti e con un tetto: il mondo di gioco resta lo stesso.</p>` : '<small>Una carriera conclusa può lasciarti un nome noto, una rete e qualche zavorra, senza cambiare il mondo di gioco.</small>'}</div>`;
}
