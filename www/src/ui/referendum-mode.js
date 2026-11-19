// The page «Referendum»: the abrogative one (art. 75) and the constitutional confirmatory one (art. 138), kept apart in rules, phases, quorum and effects. Every button calls the store: nothing is decorative.
// Figures of the votes are a simulation of the game (never a real result).
import { REVISION_TOPICS, ABROGATIVE, CONSTITUTIONAL, CAMPAIGN_ACTIONS, COUNCIL_ROUTE, EXCLUDED, PHASES, pathOf, isActive } from '../core/referendum-engine.js?v=20261119-7';
import { ITALIAN_REGIONS } from '../data/regions.js?v=20261119-7';
import { badge, card, empty, esc, foldPanel, kpi, sectionTabs } from './sections-kit.js?v=20261119-7';
import { glyph } from './visuals.js?v=20261119-7';
import { abrogativeSuggestions, CUSTOM_DRAFT, revisionDrafts } from '../data/referendum-drafts.js?v=20261119-7';
import { formatDate } from '../core/time.js?v=20261119-7';

const number = value => Math.round(Number(value) || 0).toLocaleString('it-IT');
const pct = value => `${(Math.round(value * 10) / 10).toLocaleString('it-IT')}%`;
const STATUS = { 'in-corso': ['In corso', 'warning'], concluso: ['Concluso', 'neutral'], respinto: ['Richiesta respinta', 'bad'], inammissibile: ['Inammissibile', 'bad'], fallito: ['Raccolta fallita', 'bad'], respinta: ['Riforma respinta', 'bad'], 'in-vigore': ['Riforma in vigore', 'good'] };
const bar = (value, tone = '') => `<span class="ini-bar ref-bar ${tone}" role="img" aria-label="${esc(pct(value))}"><i style="width:${Math.max(0, Math.min(100, value))}%"></i></span>`;
const side = value => value === 'si' ? 'SÌ' : value === 'no' ? 'NO' : null;

function pathOfRecord(ref) {
  const steps = pathOf(ref);
  const at = Math.max(0, steps.findIndex(([id]) => id === ref.phase));
  const closed = ref.status !== 'in-corso';
  return `<ol class="req-path ref-path" data-ref-path>${steps.map(([id, label], index) => `<li class="${closed ? (index === steps.length - 1 ? 'is-now' : 'is-done') : index < at ? 'is-done' : index === at ? 'is-now' : ''}">${esc(label)}</li>`).join('')}</ol>`;
}
function campaignBlock(ref, state) {
  const c = ref.campaign;
  if (!c) return '';
  const funds = state.game?.resources?.funds ?? 0, capital = state.game?.resources?.politicalCapital ?? 0;
  const mine = ref.side;
  const last = c.polls.at(-1);
  const quorum = ref.kind === 'abrogativo';
  const sides = `<div class="ref-sides" data-ref-sides><span>La tua parte:</span> ${['si', 'no'].map(value => `<button type="button" class="${mine === value ? 'primary-button' : 'secondary-button'} compact" data-ref-side="${esc(ref.id)}" data-ref-choice="${value}" aria-pressed="${mine === value}">${side(value)}</button>`).join('')}</div>`;
  const polls = last ? `<p class="ref-poll" data-ref-poll>Sondaggio (${esc(formatDate(last.date))}): SÌ ${pct(last.yes)} · NO ${pct(100 - last.yes)} · affluenza stimata ${pct(last.turnout)}${quorum ? ` (quorum: più del ${Math.round(ABROGATIVE.quorum * 100)}%)` : ' (nessun quorum)'}. I sondaggi hanno un margine d’errore.</p><div class="ref-bars"><span>SÌ</span>${bar(last.yes, 'is-yes')}<span>NO</span>${bar(100 - last.yes, 'is-no')}</div>` : '<p class="quiet-copy">Il primo sondaggio esce a metà della prima settimana di campagna.</p>';
  const actions = mine ? `<div class="ref-actions" data-ref-actions>${Object.values(CAMPAIGN_ACTIONS).filter(item => !item.only || item.only === mine).filter(item => item.id !== 'astensione' || ref.kind === 'abrogativo').map(item => { const off = funds < item.cost.funds || capital < item.cost.capital; const costText = [item.cost.funds ? `${number(item.cost.funds)} €` : '', item.cost.capital ? `${item.cost.capital} capitale` : '', `${item.cost.days} g`].filter(Boolean).join(' · '); return `<button type="button" class="secondary-button compact" data-ref-act="${esc(ref.id)}" data-ref-action="${esc(item.id)}" title="${esc(item.hint)}"${off ? ' disabled' : ''}>${esc(item.label)} <small>${esc(costText)}</small></button>`; }).join('')}</div><p class="quiet-copy">Al massimo tre iniziative a settimana. ${esc(mine === 'si' ? 'Spingi il SÌ.' : 'Spingi il NO.')}</p>` : '<p class="quiet-copy">Scegli da che parte stare per fare campagna.</p>';
  const stances = `<p class="ref-stances" data-ref-stances>Gruppi per il SÌ: ${c.stances.si.length} · per il NO: ${c.stances.no.length} · liberi: ${c.stances.free.length}.</p>`;
  const events = c.events.length ? `<ul class="ref-events" data-ref-events>${c.events.slice(0, 4).map(item => `<li class="${esc(item.tone)}">${esc(item.text)}</li>`).join('')}</ul>` : '';
  return `<div class="ref-campaign" data-ref-campaign><h4>Campagna · si vota il ${esc(formatDate(ref.voteDate))}</h4>${sides}${stances}${polls}${actions}${events}</div>`;
}
function resultBlock(ref) {
  const r = ref.result;
  if (!r) return `<p class="ref-outcome" data-ref-outcome>${esc(ref.outcome ?? '')}</p>`;
  return `<div class="ref-result" data-ref-result><p class="ref-outcome" data-ref-outcome>${esc(ref.outcome)}</p><div class="ref-bars"><span>SÌ</span>${bar(r.yes, 'is-yes')}<b>${pct(r.yes)}</b><span>NO</span>${bar(r.no, 'is-no')}<b>${pct(r.no)}</b></div>
    <ul class="ref-figures"><li>Aventi diritto <b>${number(r.electorate)}</b></li><li>Votanti <b>${number(r.voters)}</b> (${pct(r.turnout)})</li><li>Voti validi <b>${number(r.valid)}</b> · bianche e nulle <b>${number(r.blank)}</b></li><li>SÌ <b>${number(r.yesVotes)}</b> · NO <b>${number(r.noVotes)}</b></li>${ref.kind === 'abrogativo' ? `<li>Quorum (più del 50% degli aventi diritto): <b>${r.quorumReached ? 'raggiunto' : 'non raggiunto'}</b></li>` : '<li>Nessun quorum di partecipazione (art. 138)</li>'}</ul><small class="quiet-copy">Dati simulati dal gioco, non un risultato reale.</small></div>`;
}
function abrogativeBody(ref, state) {
  let body = `<p class="ref-question" data-ref-question>${esc(ref.question)}</p>`;
  body += `<p class="quiet-copy">Quesito: ${ref.target.scope === 'parziale' ? 'abrogazione parziale' : 'abrogazione totale'} · chiarezza ${pct(ref.quality.clarity * 100)} · omogeneità ${pct(ref.quality.homogeneity * 100)} (le guarda l’Ufficio centrale e la Corte).</p>`;
  if (ref.phase === 'raccolta') {
    const ini = (state.game?.initiatives ?? []).find(item => item.id === ref.initiativeId);
    body += `<p data-ref-phase-note>Servono ${number(ABROGATIVE.signatures)} firme. ${ini ? `Raccolte finora: <b>${number(ini.signatures?.total ?? 0)}</b>${ini.status !== 'raccolta' ? ` (${esc(ini.status)})` : ''}.` : ''} La raccolta si organizza e si deposita dalla pagina <button type="button" class="link-button" data-nav="iniziative">Iniziative</button>.</p>`;
  } else if (ref.phase === 'consigli') {
    const done = ref.councils.approved.length;
    body += `<p data-ref-phase-note>Servono ${ABROGATIVE.councils} Consigli regionali: ${done} hanno approvato${ref.councils.refused.length ? `, ${ref.councils.refused.length} hanno rifiutato` : ''}.</p><form class="ref-councils" data-ref-councils-form="${esc(ref.id)}"><fieldset><legend>Scegli le Regioni a cui chiedere la delibera (${COUNCIL_ROUTE.cost.funds} € non incluso: già pagato)</legend>${ITALIAN_REGIONS.map(name => { const used = ref.councils.approved.includes(name) || ref.councils.refused.includes(name); return `<label class="ref-region${used ? ' is-used' : ''}"><input type="checkbox" name="region" value="${esc(name)}"${used ? ' disabled' : ''}> ${esc(name)}${ref.councils.approved.includes(name) ? ' ✓' : ref.councils.refused.includes(name) ? ' ✗' : ''}</label>`; }).join('')}</fieldset><button type="submit" class="primary-button compact">Chiedi la delibera</button></form>`;
  } else if (ref.phase === 'cassazione') body += `<p data-ref-phase-note>L’Ufficio centrale per il referendum presso la Cassazione verifica firme e quesito: esito dal ${esc(formatDate(ref.cassationAt))}.</p>`;
  else if (ref.phase === 'corte') body += `<p data-ref-phase-note>La Corte costituzionale giudica l’ammissibilità (non si possono abrogare leggi tributarie e di bilancio, amnistia e indulto, ratifica dei trattati): decisione dal ${esc(formatDate(ref.courtAt))}.</p>`;
  else if (ref.phase === 'campagna') body += campaignBlock(ref, state);
  return body;
}
function constitutionalBody(ref, state) {
  let body = `<p class="ref-question" data-ref-question>${esc(ref.title)}</p>${ref.description ? `<p class="quiet-copy" data-ref-description>${esc(ref.description)}</p>` : ''}`;
  const deliberations = (ref.deliberations ?? []).map(item => `<li>${item.which === 1 ? 'Prima' : 'Seconda'} deliberazione (${esc(formatDate(item.date))}): Camera ${pct(item.camera.share)}${item.camera.twoThirds ? ' (due terzi)' : ''} · Senato ${pct(item.senato.share)}${item.senato.twoThirds ? ' (due terzi)' : ''}</li>`).join('');
  if (deliberations) body += `<ul class="ref-figures" data-ref-deliberations>${deliberations}</ul>`;
  if (ref.phase === 'prima') body += `<p data-ref-phase-note>Prima deliberazione delle Camere dal ${esc(formatDate(ref.firstAt))}.</p>`;
  else if (ref.phase === 'pausa') body += `<p data-ref-phase-note>Intervallo di almeno tre mesi: seconda deliberazione dal ${esc(formatDate(ref.secondAt))}, a maggioranza assoluta.</p>`;
  else if (ref.phase === 'richiesta') {
    if (ref.request) body += `<p data-ref-phase-note>Referendum chiesto da ${esc(ref.request.who)}.</p>`;
    else body += `<p data-ref-phase-note>Approvata senza i due terzi: entro il <b>${esc(formatDate(ref.requestUntil))}</b> si può chiedere il referendum (un quinto dei membri di una Camera, 500.000 elettori o cinque Consigli regionali). Se nessuno lo chiede, la riforma entra in vigore. Non c’è quorum.</p>
      <div class="ref-routes" data-ref-routes><button type="button" class="secondary-button compact" data-ref-request="${esc(ref.id)}" data-ref-route="quinto">Un quinto dei membri di una Camera</button> <button type="button" class="secondary-button compact" data-ref-collect="${esc(ref.id)}">500.000 firme (apri la raccolta)</button></div>
      <form class="ref-councils" data-ref-request-form="${esc(ref.id)}"><fieldset><legend>Oppure cinque Consigli regionali</legend>${ITALIAN_REGIONS.map(name => `<label class="ref-region"><input type="checkbox" name="region" value="${esc(name)}"> ${esc(name)}</label>`).join('')}</fieldset><button type="submit" class="secondary-button compact">Chiedi ai Consigli regionali</button></form>`;
  } else if (ref.phase === 'campagna') body += campaignBlock(ref, state);
  return body;
}
function cardOf(ref, state) {
  const [label, tone] = STATUS[ref.status] ?? [ref.status, 'neutral'];
  const rules = ref.kind === 'abrogativo' ? ABROGATIVE : CONSTITUTIONAL;
  const head = `<div class="ini-head">${badge(label, tone)} <small>${esc(rules.label)} · ${esc(rules.basis)}</small>${ref.side ? ` ${badge(`Per il ${side(ref.side)}`, ref.side === 'si' ? 'good' : 'bad')}` : ''}</div>`;
  const who = actorOf(ref);
  const whoLine = who.text ? `<p class="ref-who ${who.mine ? 'is-mine' : 'is-auto'}" data-ref-who>${glyph(who.mine ? 'target' : 'clock', 15)} <b>${who.mine ? 'Tocca a te' : 'Avviene da solo'}</b> · ${esc(who.text)}</p>` : '';
  let body = head + whoLine + pathOfRecord(ref);
  body += ref.kind === 'abrogativo' ? abrogativeBody(ref, state) : constitutionalBody(ref, state);
  if (ref.status !== 'in-corso') body += resultBlock(ref);
  const steps = (ref.steps ?? []).slice(0, 6);
  if (steps.length) body += `<details class="ini-history"><summary>Cronologia</summary><ul>${steps.map(item => `<li><small>${esc(formatDate(item.date))}</small> ${esc(item.text)}</li>`).join('')}</ul></details>`;
  return `<article class="ref-card" data-referendum-card="${esc(ref.id)}" data-referendum-kind="${esc(ref.kind)}" data-referendum-status="${esc(ref.status)}">${card({ kicker: ref.kind === 'abrogativo' ? 'ABROGATIVO' : 'COSTITUZIONALE', title: ref.kind === 'abrogativo' ? ref.target.title : ref.title, body, className: `ref-tone-${ref.kind}` })}</article>`;
}
// ---------- who does what ----------
// For each procedure: what the player has to do now («mine») and what happens by itself (the Office, the Court, the Chambers, the calendar). Read from the phase of the record, never invented.
export function actorOf(ref) {
  if (!isActive(ref)) return { mine: false, text: '' };
  if (ref.kind === 'abrogativo') {
    if (ref.phase === 'raccolta') return { mine: true, text: `Raccogli ${number(ABROGATIVE.signatures)} firme e depositale dalla pagina Iniziative.` };
    if (ref.phase === 'consigli') return { mine: true, text: `Chiedi la delibera ai Consigli regionali: ne servono ${ABROGATIVE.councils}.` };
    if (ref.phase === 'cassazione') return { mine: false, text: 'L’Ufficio centrale per il referendum verifica firme e quesito.' };
    if (ref.phase === 'corte') return { mine: false, text: 'La Corte costituzionale giudica l’ammissibilità.' };
    if (ref.phase === 'campagna') return ref.side ? { mine: true, text: 'Campagna in corso: usa le azioni per spostare consenso e affluenza.' } : { mine: true, text: 'Scegli da che parte stare (SÌ o NO) per aprire le azioni di campagna.' };
    return { mine: false, text: '' };
  }
  if (ref.phase === 'prima') return { mine: false, text: 'Prima deliberazione delle Camere: avviene da sola, con i voti dei gruppi.' };
  if (ref.phase === 'pausa') return { mine: false, text: 'Intervallo di almeno tre mesi tra le due deliberazioni.' };
  if (ref.phase === 'richiesta') return ref.request ? { mine: false, text: 'Il referendum è stato chiesto: segue la campagna.' } : { mine: true, text: 'Puoi chiedere il referendum entro il termine, altrimenti la riforma entra in vigore.' };
  if (ref.phase === 'campagna') return ref.side ? { mine: true, text: 'Campagna in corso: usa le azioni per spostare consenso e affluenza.' } : { mine: true, text: 'Scegli da che parte stare (SÌ o NO) per aprire le azioni di campagna.' };
  return { mine: false, text: 'Avviene da solo: nessuna azione richiesta.' };
}
// The date the current phase ends or opens, when the record has one.
const phaseDate = (ref, id) => ({ cassazione: ref.cassationAt, corte: ref.courtAt, campagna: ref.voteDate, prima: ref.firstAt, pausa: ref.secondAt, richiesta: ref.requestUntil }[id] ?? null);

function summaryCard(state, list, data) {
  const active = list.filter(isActive);
  const mine = active.map(ref => ({ ref, ...actorOf(ref) })).filter(item => item.mine);
  const auto = active.map(ref => ({ ref, ...actorOf(ref) })).filter(item => !item.mine && item.text);
  const titleOf = ref => ref.kind === 'abrogativo' ? ref.target?.title : ref.title;
  const line = item => `<li data-ref-todo-kind="${esc(item.ref.kind)}"><span class="ref-todo-icon">${glyph(item.ref.kind === 'abrogativo' ? 'ballot' : 'book', 16)}</span><span><b>${esc(titleOf(item.ref))}</b><small>${esc(item.text)}${phaseDate(item.ref, item.ref.phase) ? ` · ${esc(formatDate(phaseDate(item.ref, item.ref.phase)))}` : ''}</small></span><button type="button" class="ghost-button compact" data-section-tab="referendum" data-section-tab-value="${esc(item.ref.kind)}">Apri</button></li>`;
  const kpis = `<div class="sx-kpis">${kpi({ label: 'In corso', value: String(active.length) })}${kpi({ label: 'Conclusi', value: String(list.length - active.length) })}${kpi({ label: 'Leggi in vigore', value: String((data.targets ?? []).length) })}${kpi({ label: 'Fondi', value: `${number(state.game.resources?.funds ?? 0)} €` })}</div>`;
  const body = `${kpis}<div class="ref-todo-grid" data-ref-summary>
    <div class="ref-todo is-mine"><h4>${glyph('target', 16)} Tocca a te</h4>${mine.length ? `<ul>${mine.map(line).join('')}</ul>` : '<p class="quiet-copy">Nessuna azione richiesta ora. Puoi avviare una nuova richiesta qui sotto.</p>'}</div>
    <div class="ref-todo is-auto"><h4>${glyph('clock', 16)} Avviene da solo</h4>${auto.length ? `<ul>${auto.map(line).join('')}</ul>` : '<p class="quiet-copy">Nessuna procedura in attesa di controlli o scadenze.</p>'}</div></div>`;
  return card({ kicker: 'RIEPILOGO', title: 'Le tue procedure', body, className: 'ref-summary' });
}

// ---------- the question of an abrogative referendum, guided ----------
export function checkBox(check) {
  if (!check) return '<div class="ref-check" data-ref-check><p class="quiet-copy">Scegli la legge e la formula: qui vedi subito se il quesito è ammissibile.</p></div>';
  const tone = check.ok ? 'is-ok' : 'is-bad';
  const reasons = [...(check.excluded ?? []).map(item => `Non ammesso: ${item.label}.`), ...(check.problems ?? [])];
  return `<div class="ref-check ${tone}" data-ref-check role="status" aria-live="polite"><strong>${check.ok ? `${glyph('shield', 16)} Il quesito può essere presentato` : `${glyph('alert', 16)} Il quesito non è ammissibile così`}</strong>
    ${reasons.length ? `<ul>${reasons.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
    <p class="quiet-copy">Chiarezza ${pct((check.clarity ?? 0) * 100)} · omogeneità ${pct((check.homogeneity ?? 0) * 100)}: sono i criteri che guardano l’Ufficio centrale e la Corte. Il quesito che leggeranno: <i>${esc(check.text ?? '')}</i></p></div>`;
}
export function suggestionsBox(target, scope, partText) {
  if (!target) return '';
  const list = abrogativeSuggestions(target, scope, partText);
  return `<div class="ref-suggest" data-ref-suggest-box><span class="ref-suggest-title">${glyph('book', 14)} Formulazioni suggerite (puoi modificarle)</span>${list.map(item => `<button type="button" class="secondary-button compact" data-ref-suggest="${esc(item.text)}" title="${esc(item.text)}">${esc(item.label)}</button>`).join('')}</div>`;
}
const targetData = item => ({ statuteId: item.statuteId, title: item.title, area: item.area, instrument: item.instrument, approvedAt: item.approvedAt });
function formOf(state, targets, check = null) {
  const free = targets.filter(item => !item.taken);
  const options = free.map(item => `<option value="${esc(item.statuteId)}"${item.excluded.length ? ' disabled' : ''}>${esc(item.title)}${item.excluded.length ? ` — non ammesso: ${esc(item.excluded.join(', '))}` : ''}</option>`).join('');
  if (!free.length) return card({ kicker: 'NUOVA RICHIESTA', title: 'Chiedi un referendum abrogativo', body: `<p class="quiet-copy" data-ref-nolaw>Non ci sono leggi in vigore su cui chiedere il referendum: si abroga una legge che esiste. Le leggi approvate dal Parlamento compaiono nella pagina «Leggi».</p>`, className: 'ref-new' });
  const first = free.find(item => !item.excluded.length) ?? free[0];
  return card({ kicker: 'NUOVA RICHIESTA', title: 'Chiedi un referendum abrogativo', className: 'ref-new', body: `<form class="ini-form ref-form" data-ref-form data-ref-targets='${esc(JSON.stringify(free.map(targetData)))}'>
    <p class="quiet-copy">Si può chiedere solo per leggi (o atti con forza di legge) in vigore. Sono esclusi: ${EXCLUDED.map(item => esc(item.label)).join('; ')}.</p>
    <ol class="ref-steps">
    <li><label><b>1 · Legge da abrogare</b><select name="statuteId" required>${options}</select></label></li>
    <li><fieldset class="ref-scope"><legend><b>2 · Quanto abrogare</b></legend><label><input type="radio" name="scope" value="totale" checked> totale</label> <label><input type="radio" name="scope" value="parziale"> parziale (solo alcune parti)</label></fieldset>
      <label data-ref-part>Parti da abrogare (solo per la parziale; una finalità sola, il quesito deve restare omogeneo)<textarea name="partText" rows="3" placeholder="articoli o commi da abrogare"></textarea></label></li>
    <li><b>3 · Il quesito</b>${suggestionsBox(first ? targetData(first) : null, 'totale', '')}<label>Quesito (facoltativo: se lo lasci vuoto lo scrive il gioco)<textarea name="question" rows="3" placeholder="Volete voi che sia abrogata…"></textarea></label>${checkBox(check)}</li>
    <li><fieldset class="ref-scope"><legend><b>4 · Come si chiede</b></legend><label><input type="radio" name="route" value="firme" checked> ${number(ABROGATIVE.signatures)} firme di elettori (raccolta dalla pagina «Iniziative»; apertura ${number(4000)} €)</label> <label><input type="radio" name="route" value="consigli"> ${ABROGATIVE.councils} Consigli regionali (${number(COUNCIL_ROUTE.cost.funds)} € e ${COUNCIL_ROUTE.cost.capital} di capitale politico)</label></fieldset></li></ol>
    <button type="submit" class="primary-button">Presenta la richiesta</button><small>Fondi disponibili: ${number(state.game.resources?.funds ?? 0)} €. La richiesta si presenta solo con la tua conferma: l’ammissibilità la decidono poi l’Ufficio centrale e la Corte.</small></form>` });
}
// ---------- the constitutional revision, guided ----------
export function revisionDraftBox(topic) {
  const drafts = revisionDrafts(topic);
  return `<div class="ref-suggest" data-revision-draft-box><span class="ref-suggest-title">${glyph('book', 14)} Bozze suggerite per «${esc(topic)}» (puoi modificarle)</span>${drafts.map((item, index) => `<button type="button" class="secondary-button compact" data-revision-use="${index}" data-revision-title="${esc(item.title)}" data-revision-text="${esc(item.text)}">${esc(item.title)}</button>`).join('') || `<small class="quiet-copy">${esc(CUSTOM_DRAFT.text)}</small>`}</div>`;
}
function revisionForm(state) {
  if (!state.parliament?.player?.groupId) return card({ kicker: 'REVISIONE COSTITUZIONALE', title: 'Proponi una revisione della Costituzione', body: '<p class="quiet-copy" data-revision-noseat>La proposta di revisione costituzionale (art. 138) la presenta un parlamentare: serve un seggio alla Camera o al Senato.</p>', className: 'ref-new' });
  const busy = (state.game.referendums ?? []).some(item => item.kind === 'costituzionale' && isActive(item));
  const capital = state.game.resources?.politicalCapital ?? 0;
  return card({ kicker: 'NUOVA REVISIONE', title: 'Proponi una revisione della Costituzione', className: 'ref-new', body: `<form class="ini-form ref-form" data-revision-form data-revision-drafts='${esc(JSON.stringify(Object.fromEntries(REVISION_TOPICS.map(topic => [topic, revisionDrafts(topic)]))))}'>
    <p class="quiet-copy">Servono due deliberazioni di ciascuna Camera a distanza di almeno tre mesi (maggioranza assoluta alla seconda). Con i due terzi non c’è referendum; altrimenti si può chiedere entro tre mesi. Costa 5 di capitale politico (ne hai ${capital}); il tuo gruppo porta i suoi seggi.</p>
    <ol class="ref-steps"><li><label><b>1 · Tema</b><select name="topic">${REVISION_TOPICS.map(item => `<option value="${esc(item)}">${esc(item)}</option>`).join('')}</select></label></li>
    <li><b>2 · Bozza</b>${revisionDraftBox(REVISION_TOPICS[0])}<label>Titolo personalizzato (facoltativo: sostituisce il tema)<input name="custom" maxlength="140" placeholder="Es.: Modifica dell’articolo … della Costituzione" /></label><label>Descrizione (facoltativa)<textarea name="description" rows="3" maxlength="600" placeholder="${esc(CUSTOM_DRAFT.text)}"></textarea></label></li></ol>
    <p class="ref-note" data-revision-note>Il gioco registra la proposta e ne segue l’iter (Camere, intervallo, eventuale referendum): non scrive né applica il testo costituzionale.</p>
    <button type="submit" class="primary-button"${busy ? ' disabled' : ''}>Presenta la revisione</button>${busy ? '<small>C’è già una revisione in corso: concludila prima.</small>' : ''}</form>` });
}

// ---------- the two paths ----------
const PHASE_HELP = {
  abrogativo: [['Richiesta', 'giocatore', 'Con 500.000 firme valide o con cinque Consigli regionali.'], ['Cassazione', 'automatico', 'L’Ufficio centrale controlla firme e quesito.'], ['Corte costituzionale', 'automatico', 'Ammissibilità: sono esclusi tributi, bilancio, amnistia, ratifiche.'], ['Campagna', 'giocatore', 'Scegli una parte e usa le azioni; i sondaggi hanno un margine d’errore.'], ['Voto', 'automatico', 'Quorum: vota più del 50% degli aventi diritto e vincono i SÌ per abrogare.']],
  costituzionale: [['Prima deliberazione', 'automatico', 'Camera e Senato votano la riforma.'], ['Tre mesi', 'automatico', 'Intervallo minimo previsto dall’art. 138.'], ['Seconda deliberazione', 'automatico', 'Maggioranza assoluta; con i due terzi non c’è referendum.'], ['Richiesta del referendum', 'giocatore', 'Un quinto di una Camera, 500.000 elettori o cinque Consigli regionali, entro tre mesi.'], ['Campagna e voto', 'giocatore', 'Nessun quorum: vince la maggioranza dei voti validi.']]
};
function procedureFold(kind) {
  const rows = PHASE_HELP[kind].map(([label, who, text]) => `<li class="ref-proc is-${who === 'giocatore' ? 'mine' : 'auto'}"><span class="ref-proc-who">${who === 'giocatore' ? 'Tocca a te' : 'Automatico'}</span><div><b>${esc(label)}</b><small>${esc(text)}</small></div></li>`).join('');
  return foldPanel({ id: `ref-proc-${kind}`, title: 'Requisiti e procedura', kicker: kind === 'abrogativo' ? 'ART. 75' : 'ART. 138', icon: 'book', open: 'always', body: `<ol class="ref-proc-list">${rows}</ol>` });
}
function pathSection(kind, state, list, data) {
  const mineList = list.filter(item => item.kind === kind);
  const activeCards = mineList.filter(isActive), closed = mineList.filter(item => !isActive(item));
  const form = kind === 'abrogativo' ? formOf(state, data.targets ?? [], data.check ?? null) : revisionForm(state);
  const reforms = kind === 'costituzionale' && data.reforms?.length ? foldPanel({ id: 'ref-reforms', title: 'Riforme costituzionali concluse', icon: 'book', open: 'always', body: `<ul class="ref-figures" data-ref-reforms>${data.reforms.map(item => `<li><b>${esc(item.title)}</b> · ${esc(formatDate(item.date))} · ${item.carried ? 'in vigore' : 'respinta'}${item.noReferendum ? ' (senza referendum)' : ''}</li>`).join('')}</ul>` }) : '';
  const active = activeCards.length ? activeCards.map(item => cardOf(item, state)).join('') : card({ kicker: kind === 'abrogativo' ? 'ABROGATIVO' : 'COSTITUZIONALE', title: 'Nessuna procedura in corso', body: `<p class="sx-empty">${kind === 'abrogativo' ? 'Nessun referendum abrogativo in corso: avviane uno con il modulo qui sopra.' : 'Nessuna revisione in corso. Puoi proporne una tu, oppure nasce dal lavoro delle Camere.'}</p>` });
  const done = closed.length ? foldPanel({ id: `ref-closed-${kind}`, title: `Concluse (${closed.length})`, icon: 'clock', open: 'always', body: closed.map(item => cardOf(item, state)).join('') }) : '';
  return `<section class="ref-path-section ref-tone-${kind}" data-ref-section="${kind}"><header class="ref-path-head"><span class="ref-path-icon">${glyph(kind === 'abrogativo' ? 'ballot' : 'book', 22)}</span><div><span class="section-kicker">${kind === 'abrogativo' ? 'PERCORSO 1 · ART. 75' : 'PERCORSO 2 · ART. 138'}</span><h3>${kind === 'abrogativo' ? 'Referendum abrogativo' : 'Revisione costituzionale'}</h3><p class="quiet-copy">${kind === 'abrogativo' ? 'Per cancellare una legge, in tutto o in parte, con un voto popolare.' : 'Per cambiare la Costituzione: due letture delle Camere e, se serve, un referendum confermativo.'}</p></div></header>${form}<h4 class="ref-subhead">In corso</h4>${active}${procedureFold(kind)}${done}${reforms}</section>`;
}
function rulesCard() {
  return card({ kicker: 'DUE STRADE DA NON CONFONDERE', title: 'Referendum abrogativo e referendum costituzionale', className: 'ref-rules', body: `<div class="ref-compare" data-ref-compare>
    <div class="ref-col ref-tone-abrogativo"><h4>${glyph('ballot', 16)} Abrogativo · art. 75</h4><ul><li>Abroga una legge, in tutto o in parte.</li><li>Lo chiedono ${number(ABROGATIVE.signatures)} elettori o cinque Consigli regionali.</li><li>Controllano l’Ufficio centrale (Cassazione) e la Corte costituzionale.</li><li><b>Quorum:</b> deve votare la maggioranza degli aventi diritto, e vincere i SÌ.</li><li>Escluse: leggi tributarie e di bilancio, amnistia e indulto, ratifica dei trattati.</li></ul></div>
    <div class="ref-col ref-tone-costituzionale"><h4>${glyph('book', 16)} Costituzionale · art. 138</h4><ul><li>Conferma o respinge una riforma costituzionale già approvata dalle Camere.</li><li>Lo chiedono un quinto dei membri di una Camera, 500.000 elettori o cinque Consigli regionali, entro tre mesi dalla pubblicazione.</li><li>Non si fa se la riforma ha avuto i due terzi in entrambe le Camere alla seconda deliberazione.</li><li><b>Nessun quorum:</b> vince la maggioranza dei voti validi.</li><li>Se la riforma è respinta, non entra in vigore.</li></ul></div></div><p class="quiet-copy">Gli esiti sono simulazioni del gioco, non risultati reali.</p>` });
}
export function renderReferendums(state, data = {}) {
  if (!state.game) return empty('Crea prima un politico per seguire i referendum.', '<button class="primary-button" data-action="new-career">Crea il politico</button>');
  const list = state.game.referendums ?? [];
  const count = kind => list.filter(item => item.kind === kind && isActive(item)).length;
  const natural = count('costituzionale') && !count('abrogativo') ? 'costituzionale' : 'abrogativo';
  const tab = ['abrogativo', 'costituzionale'].includes(data.tab) ? data.tab : natural;
  const tabs = sectionTabs('referendum', [['abrogativo', 'Abrogativo', count('abrogativo')], ['costituzionale', 'Costituzionale', count('costituzionale')]], tab);
  return `<div class="ini-page ref-page" data-referendum-page data-ref-tab="${tab}">${summaryCard(state, list, data)}${tabs}${pathSection(tab, state, list, data)}${rulesCard()}</div>`;
}
