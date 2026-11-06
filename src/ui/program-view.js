// The programme and the promises (program-engine.js): what the party proposes, what the player promised, how credible it is, how each promise is going against what the game really did,
// the commitments of the coalition, and what the rivals promise. Every button here calls the store (makePromise, modifyPromise, withdrawPromise, announcePromise): nothing is decorative.
import { AMBITIONS, PROMISE_SCOPES, PROMISE_SETTLED, PROMISE_STATES, promiseLine } from '../core/program-engine.js?v=20261106-1';
import { AREA_BY_ID, INSTRUMENT_KINDS, POLICY_AREAS } from '../data/simulation/policy-rules.js?v=20261106-1';
import { badge, bar, card, empty, esc, kpi, num } from './sections-kit.js?v=20261106-1';
import { glyph } from './visuals.js?v=20261106-1';

const TONE = { neutral: 'neutral', info: 'info', good: 'good', warning: 'warning', bad: 'bad' };
const stateChip = status => { const spec = PROMISE_STATES[status] ?? PROMISE_STATES['non-avviata']; return badge(spec.label, TONE[spec.tone] ?? 'neutral'); };
const options = (entries, selected = '') => entries.map(([id, label]) => `<option value="${esc(id)}"${id === selected ? ' selected' : ''}>${esc(label)}</option>`).join('');
const AREA_OPTIONS = POLICY_AREAS.map(area => [area.id, area.label]);
const INSTRUMENT_OPTIONS = Object.entries(INSTRUMENT_KINDS).map(([id, kind]) => [id, kind.label]);
const AMBITION_OPTIONS = Object.entries(AMBITIONS).map(([id, spec]) => [id, spec.label]);

function credibilityCard(view) {
  const quality = view.credibility;
  const tone = quality.score >= 65 ? 'good' : quality.score >= 45 ? 'warning' : 'bad';
  const notes = quality.notes.length ? `<ul class="program-notes">${quality.notes.map(line => `<li>${esc(line)}</li>`).join('')}</ul>` : '<p class="sx-note">Il programma è sostenibile: poche promesse, coperte dal bilancio e coerenti fra loro.</p>';
  return card({ kicker: 'CREDIBILITÀ', title: 'Quanto vale la tua parola', tone, body: `<div class="sx-kpis">
    ${kpi({ label: 'Credibilità', value: `${quality.score}/100`, bar: quality.score, tone })}
    ${kpi({ label: 'Promesse aperte', value: String(quality.live), note: `un mandato ne regge ${4}` })}
    ${kpi({ label: 'Mantenute · non mantenute', value: `${num(quality.kept, 0)} · ${quality.broken}` })}
    ${kpi({ label: 'Costo delle aperte', value: `${num(quality.cost, 1)} mld`, note: `margine di bilancio ~${num(quality.room, 0)} mld` })}
  </div>${notes}<p class="sx-note">La credibilità vale in campagna (quanto pesa un annuncio) e dopo il voto (come ti giudicano elettori, giornali, alleati).</p>` });
}

function partyCard(view, premier) {
  const areas = view.partyAreas;
  const body = areas.length ? `<ul class="program-party">${areas.map(id => {
    const spec = AREA_BY_ID[id];
    const taken = view.promises.some(item => !PROMISE_SETTLED.includes(item.status) && item.area === id && item.scope === 'partito');
    return `<li><strong>${glyph(spec?.icon ?? 'target', 16)} ${esc(spec?.label ?? id)}</strong><small>${esc(spec?.national ?? '')}</small>${taken ? badge('Già promessa', 'good') : `<button type="button" class="ghost-button" data-promise-adopt="${esc(id)}">Fai tua questa proposta</button>`}</li>`;
  }).join('')}</ul><p class="sx-note">Sono le priorità fissate dal partito (Partito › Programma). Le proposte del partito e i tuoi impegni personali restano distinti: chi giudica è diverso.</p>`
    : '<p class="sx-empty">Il partito non ha ancora fissato un programma. Se sei segretario puoi farlo da Partito › Programma; altrimenti prendi impegni personali.</p>';
  void premier;
  return card({ kicker: 'IL PARTITO', title: 'Le proposte del partito', body });
}

function makeForm(view, { premier, hasAccord }) {
  const scopes = Object.entries(PROMISE_SCOPES).filter(([id]) => id !== 'governo' || premier).filter(([id]) => id !== 'coalizione' || hasAccord || premier);
  return card({ kicker: 'NUOVA PROMESSA', title: 'Prendi un impegno', body: `<form class="program-form" data-promise-form>
    <label>Area politica<select name="area">${options(AREA_OPTIONS, 'sanita')}</select></label>
    <label>In nome di chi<select name="scope">${options(scopes.map(([id, spec]) => [id, spec.label]), 'candidato')}</select></label>
    <label>Con quale strumento<select name="instrument">${options(INSTRUMENT_OPTIONS, 'investimento')}</select></label>
    <label>Quanto ambiziosa<select name="ambition">${options(AMBITION_OPTIONS, 'media')}</select></label>
    <button type="submit" class="primary-button">${glyph('target', 16)} Registra la promessa</button>
  </form>
  <p class="sx-note">Ogni promessa indica il problema, l’intervento, l’obiettivo, il costo stimato e la scadenza. Più sono ambiziose e numerose, meno sono credibili; dopo il voto vengono verificate sulle leggi davvero approvate e sugli indicatori del territorio.</p>` });
}

function promiseCard(promise, { campaign }) {
  const settled = PROMISE_SETTLED.includes(promise.status);
  const weeksLeft = promise.dueWeek - (promise.currentWeek ?? promise.dueWeek);
  const scope = PROMISE_SCOPES[promise.scope]?.label ?? promise.scope;
  const impediments = !settled && promise.impediments?.length ? `<ul class="program-impediments">${promise.impediments.map(line => `<li>${esc(line)}</li>`).join('')}</ul>` : '';
  const history = (promise.history ?? []).slice(-3).map(item => `<li>${esc(item.text)}</li>`).join('');
  const announced = (promise.announced ?? []).length;
  const actions = settled ? '' : `<div class="program-actions">
      ${campaign ? `<button type="button" class="primary-button" data-promise-announce="${esc(promise.id)}"${announced && promise.announced.some(item => item.campaignId === campaign.id) ? ' disabled' : ''}>${glyph('megaphone', 16)} Presenta agli elettori</button>` : ''}
      <details class="program-modify"><summary class="ghost-button">Modifica</summary>
        <form data-promise-modify-form data-promise-id="${esc(promise.id)}"><label>Ambizione<select name="ambition">${options(AMBITION_OPTIONS, promise.ambition)}</select></label>
        <label>Strumento<select name="instrument">${options(INSTRUMENT_OPTIONS, promise.instrument)}</select></label>
        <label>Tempo in più (settimane)<select name="extraWeeks">${options([['0', 'Nessuno'], ['8', '8'], ['16', '16'], ['26', '26']], '0')}</select></label>
        <button type="submit" class="ghost-button">Registra la modifica</button><small>Cambiare la parola data costa reputazione, e ne resta traccia.</small></form></details>
      <button type="button" class="ghost-button" data-promise-withdraw="${esc(promise.id)}">Ritira</button></div>`;
  return `<article class="program-promise status-${esc(promise.status)}">
    <header><div><strong>${esc(promise.label)}</strong><small>${esc(scope)} · ${esc(AMBITIONS[promise.ambition]?.label ?? '')}</small></div>${stateChip(promise.status)}</header>
    ${promise.problem ? `<p class="program-problem"><b>Problema</b> ${esc(promise.problem)}</p>` : ''}
    <p><b>Intervento</b> ${esc(promise.intervention)}</p><p><b>Obiettivo</b> ${esc(promise.objective)}</p>
    <div class="program-meta"><span>Costo ~${num(promise.cost, 1)} mld</span><span>${settled ? (promise.outcome ? `Esito: ${esc(promise.outcome)}` : '') : `Scadenza tra ${Math.max(0, weeksLeft)} settimane`}</span>${announced ? `<span>Presentata in campagna</span>` : ''}</div>
    ${bar(promise.progress ?? 0, promise.status === 'non-mantenuta' ? 'bad' : promise.status === 'ritardata' ? 'warning' : 'good')}
    <small class="program-evidence">${esc(promise.evidence ?? 'Nessun atto collegato.')}</small>
    ${impediments}${history ? `<details class="program-history"><summary>Storia</summary><ul>${history}</ul></details>` : ''}${actions}</article>`;
}

function accordCard(view) {
  if (!view.accord.length) return '';
  return card({ kicker: 'COALIZIONE', title: 'Gli impegni dell’accordo di governo', body: `<ul class="program-accord">${view.accord.map(item => `<li><strong>${esc(item.label)}</strong><span>${esc(item.objective)}</span>${stateChip(item.status)}</li>`).join('')}</ul><p class="sx-note">Li giudica l’accordo di governo (Parlamento › Governo): qui sono accanto alle tue promesse, senza essere contati due volte.</p>` });
}

function rivalsCard(view) {
  if (!view.campaign) return '';
  const mine = new Set(view.promises.filter(item => !PROMISE_SETTLED.includes(item.status)).map(item => item.area));
  const rows = view.campaign.rivals.map(rival => `<li><strong>${esc(rival.label)}</strong><span>${rival.areas.length ? rival.areas.map(id => `${esc(AREA_BY_ID[id]?.label ?? id)}${mine.has(id) ? ' ★' : ''}`).join(' · ') : 'Nessun programma noto'}</span></li>`).join('');
  return card({ kicker: 'AVVERSARI', title: 'Cosa promettono gli altri', body: `<ul class="program-rivals">${rows || '<li>Nessun avversario in campo.</li>'}</ul><p class="sx-note">★ = stesso tema di una tua promessa aperta: lo scontro in campagna e nei dibattiti passa da lì.</p>` });
}

function knownRivalsCard(view) {
  const known = view.known ?? [];
  if (!known.length) return '';
  const rows = known.slice(0, 6).map(item => `<li><strong>${esc(item.label)}</strong><span>${esc(item.personality ?? '')}${item.life?.moves ? ` · ${item.life.moves} ${item.life.moves === 1 ? 'mossa' : 'mosse'} risposte` : ''}</span>${badge(item.mood.hostility > item.mood.warmth ? 'Ostile' : item.mood.warmth > item.mood.hostility ? 'Cordiale' : 'Neutrale', item.mood.hostility > item.mood.warmth ? 'bad' : item.mood.warmth > item.mood.hostility ? 'good' : 'neutral')}</li>`).join('');
  return card({ kicker: 'RIVALI CHE CONOSCI', title: 'Chi ti ricorda', body: `<ul class="program-rivals">${rows}</ul><p class="sx-note">Gli avversari delle campagne passate non spariscono: agiscono secondo il loro carattere e ricordano come hai risposto (le loro mosse arrivano in agenda).</p>` });
}

export function renderProgram(state, view) {
  if (!state.game) return empty('Crea prima un politico per costruire un programma.', '<button class="primary-button" data-action="new-career">Crea il politico</button>');
  const week = state.game.week.index;
  const promises = view.promises.map(item => ({ ...item, currentWeek: week }));
  const premier = state.parliament?.government?.primeMinister === 'player';
  const hasAccord = view.accord.length > 0;
  const live = promises.filter(item => !PROMISE_SETTLED.includes(item.status));
  const closed = promises.filter(item => PROMISE_SETTLED.includes(item.status)).sort((a, b) => (b.settledWeek ?? 0) - (a.settledWeek ?? 0));
  const compare = closed.length ? card({ kicker: 'VERIFICA', title: 'Promesso e realizzato', body: `<div class="sx-table-wrap"><table class="sx-table"><thead><tr><th scope="col">Area</th><th scope="col">Promesso</th><th scope="col">Stato</th><th scope="col">Realizzato</th></tr></thead><tbody>${closed.map(item => `<tr><td data-label="Area">${esc(item.label)}</td><td data-label="Promesso">${esc(item.intervention)}</td><td data-label="Stato">${stateChip(item.status)}</td><td data-label="Realizzato">${esc(item.evidence ?? '—')}${item.outcome ? ` · ${esc(item.outcome)}` : ''}</td></tr>`).join('')}</tbody></table></div>` }) : '';
  return `<div class="program-page">
    ${credibilityCard(view)}
    <div class="sx-grid two">${partyCard(view, premier)}${makeForm(view, { premier, hasAccord })}</div>
    ${card({ kicker: 'IN CORSO', title: `Le tue promesse (${live.length})`, body: live.length ? `<div class="program-list">${live.map(item => promiseCard(item, { campaign: view.campaign })).join('')}</div>` : '<p class="sx-empty">Nessuna promessa aperta. Ogni impegno è una responsabilità: sceglili con cura.</p>' })}
    ${accordCard(view)}${rivalsCard(view)}${knownRivalsCard(view)}${compare}
    ${premier && view.suggestion.length ? card({ kicker: 'GOVERNO', title: 'Il programma di governo parte dalle tue promesse', body: `<p>Priorità suggerite dal tuo programma: ${view.suggestion.map(id => esc(AREA_BY_ID[id]?.label ?? id)).join(' · ')}.</p><p class="sx-note">Quando fissi il programma del Governo (Parlamento › Governo) senza scegliere le priorità, il gioco usa queste; ogni priorità diventa anche una promessa di governo.</p>` }) : ''}
  </div>`;
}
export { promiseLine };
