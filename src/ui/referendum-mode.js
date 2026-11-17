// The page «Referendum»: the abrogative one (art. 75) and the constitutional confirmatory one (art. 138), kept apart in rules, phases, quorum and effects. Every button calls the store: nothing is decorative.
// Figures of the votes are a simulation of the game (never a real result).
import { REVISION_TOPICS, ABROGATIVE, CONSTITUTIONAL, CAMPAIGN_ACTIONS, COUNCIL_ROUTE, EXCLUDED, PHASES, pathOf, isActive } from '../core/referendum-engine.js?v=20261117-12';
import { ITALIAN_REGIONS } from '../data/regions.js?v=20261117-12';
import { badge, card, empty, esc, kpi } from './sections-kit.js?v=20261117-12';
import { formatDate } from '../core/time.js?v=20261117-12';

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
  let body = `<p class="ref-question" data-ref-question>${esc(ref.title)}</p>`;
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
  let body = head + pathOfRecord(ref);
  body += ref.kind === 'abrogativo' ? abrogativeBody(ref, state) : constitutionalBody(ref, state);
  if (ref.status !== 'in-corso') body += resultBlock(ref);
  const steps = (ref.steps ?? []).slice(0, 6);
  if (steps.length) body += `<details class="ini-history"><summary>Cronologia</summary><ul>${steps.map(item => `<li><small>${esc(formatDate(item.date))}</small> ${esc(item.text)}</li>`).join('')}</ul></details>`;
  return `<article class="ref-card" data-referendum-card="${esc(ref.id)}" data-referendum-kind="${esc(ref.kind)}" data-referendum-status="${esc(ref.status)}">${card({ kicker: ref.kind === 'abrogativo' ? 'ABROGATIVO' : 'COSTITUZIONALE', title: ref.kind === 'abrogativo' ? ref.target.title : ref.title, body, className: `ref-tone-${ref.kind}` })}</article>`;
}
function formOf(state, targets) {
  const free = targets.filter(item => !item.taken);
  const options = free.map(item => `<option value="${esc(item.statuteId)}"${item.excluded.length ? ' disabled' : ''}>${esc(item.title)}${item.excluded.length ? ` — non ammesso: ${esc(item.excluded.join(', '))}` : ''}</option>`).join('');
  if (!free.length) return card({ kicker: 'NUOVA RICHIESTA', title: 'Chiedi un referendum abrogativo', body: `<p class="quiet-copy" data-ref-nolaw>Non ci sono leggi in vigore su cui chiedere il referendum: si abroga una legge che esiste. Le leggi approvate dal Parlamento compaiono nella pagina «Leggi».</p>` });
  return card({ kicker: 'NUOVA RICHIESTA', title: 'Chiedi un referendum abrogativo', body: `<form class="ini-form ref-form" data-ref-form>
    <p class="quiet-copy">Si può chiedere solo per leggi (o atti con forza di legge) in vigore. Sono esclusi: ${EXCLUDED.map(item => esc(item.label)).join('; ')}.</p>
    <label>Legge da abrogare<select name="statuteId" required>${options}</select></label>
    <fieldset class="ref-scope"><legend>Abrogazione</legend><label><input type="radio" name="scope" value="totale" checked> totale</label> <label><input type="radio" name="scope" value="parziale"> parziale (solo alcune parti)</label></fieldset>
    <label data-ref-part>Parti da abrogare (solo per la parziale; una finalità sola, il quesito deve restare omogeneo)<textarea name="partText" rows="3" placeholder="articoli o commi da abrogare"></textarea></label>
    <label>Quesito (facoltativo: se lo lasci vuoto lo scrive il gioco)<textarea name="question" rows="2" placeholder="Volete voi che sia abrogata…"></textarea></label>
    <fieldset class="ref-scope"><legend>Come si chiede</legend><label><input type="radio" name="route" value="firme" checked> ${number(ABROGATIVE.signatures)} firme di elettori (raccolta dalla pagina «Iniziative»; apertura ${number(4000)} €)</label> <label><input type="radio" name="route" value="consigli"> ${ABROGATIVE.councils} Consigli regionali (${number(COUNCIL_ROUTE.cost.funds)} € e ${COUNCIL_ROUTE.cost.capital} di capitale politico)</label></fieldset>
    <button type="submit" class="primary-button">Presenta la richiesta</button><small>Fondi disponibili: ${number(state.game.resources?.funds ?? 0)} €.</small></form>` });
}
function revisionForm(state) {
  if (!state.parliament?.player?.groupId) return card({ kicker: 'REVISIONE COSTITUZIONALE', title: 'Proponi una revisione della Costituzione', body: '<p class="quiet-copy" data-revision-noseat>La proposta di revisione costituzionale (art. 138) la presenta un parlamentare: serve un seggio alla Camera o al Senato.</p>' });
  const busy = (state.game.referendums ?? []).some(item => item.kind === 'costituzionale' && isActive(item));
  return card({ kicker: 'REVISIONE COSTITUZIONALE', title: 'Proponi una revisione della Costituzione', body: `<form class="ini-form ref-form" data-revision-form><p class="quiet-copy">Servono due deliberazioni di ciascuna Camera a distanza di almeno tre mesi (maggioranza assoluta alla seconda). Con i due terzi non c’è referendum; altrimenti si può chiedere entro tre mesi. Costa 5 di capitale politico; il tuo gruppo porta i suoi seggi.</p><label>Tema<select name="topic">${REVISION_TOPICS.map(item => `<option value="${esc(item)}">${esc(item)}</option>`).join('')}</select></label><label>Oppure scrivi un titolo (facoltativo)<input name="custom" maxlength="140" placeholder="Titolo della revisione"></label><button type="submit" class="primary-button"${busy ? ' disabled' : ''}>Presenta la revisione</button>${busy ? '<small>Una revisione è già in corso.</small>' : ''}</form>` });
}
function rulesCard() {
  return card({ kicker: 'DUE STRADE DA NON CONFONDERE', title: 'Referendum abrogativo e referendum costituzionale', body: `<div class="ref-compare" data-ref-compare>
    <div class="ref-col ref-tone-abrogativo"><h4>Abrogativo · art. 75</h4><ul><li>Abroga una legge, in tutto o in parte.</li><li>Lo chiedono ${number(ABROGATIVE.signatures)} elettori o cinque Consigli regionali.</li><li>Controllano l’Ufficio centrale (Cassazione) e la Corte costituzionale.</li><li><b>Quorum:</b> deve votare la maggioranza degli aventi diritto, e vincere i SÌ.</li><li>Escluse: leggi tributarie e di bilancio, amnistia e indulto, ratifica dei trattati.</li></ul></div>
    <div class="ref-col ref-tone-costituzionale"><h4>Costituzionale · art. 138</h4><ul><li>Conferma o respinge una riforma costituzionale già approvata dalle Camere.</li><li>Lo chiedono un quinto dei membri di una Camera, 500.000 elettori o cinque Consigli regionali, entro tre mesi dalla pubblicazione.</li><li>Non si fa se la riforma ha avuto i due terzi in entrambe le Camere alla seconda deliberazione.</li><li><b>Nessun quorum:</b> vince la maggioranza dei voti validi.</li><li>Se la riforma è respinta, non entra in vigore.</li></ul></div></div><p class="quiet-copy">Gli esiti sono simulazioni: elettorato, sondaggi e voti sono generati dal gioco.</p>` });
}
export function renderReferendums(state, data = {}) {
  if (!state.game) return empty('Crea prima un politico per seguire i referendum.', '<button class="primary-button" data-action="new-career">Crea il politico</button>');
  const list = state.game.referendums ?? [];
  const active = list.filter(isActive);
  const kpis = `<div class="sx-kpis">${kpi({ label: 'In corso', value: String(active.length) })}${kpi({ label: 'Conclusi', value: String(list.length - active.length) })}${kpi({ label: 'Leggi in vigore', value: String((data.targets ?? []).length) })}${kpi({ label: 'Fondi', value: `${number(state.game.resources?.funds ?? 0)} €` })}</div>`;
  const cards = list.length ? list.map(item => cardOf(item, state)).join('') : card({ kicker: 'REFERENDUM', title: 'Nessun referendum', body: '<p class="sx-empty">Nessun referendum in corso. Puoi chiederne uno abrogativo qui sotto; le riforme costituzionali nascono dal lavoro delle Camere.</p>' });
  const reforms = data.reforms?.length ? card({ kicker: 'COSTITUZIONE', title: 'Riforme costituzionali concluse', body: `<ul class="ref-figures" data-ref-reforms>${data.reforms.map(item => `<li><b>${esc(item.title)}</b> · ${esc(formatDate(item.date))} · ${item.carried ? 'in vigore' : 'respinta'}${item.noReferendum ? ' (senza referendum)' : ''}</li>`).join('')}</ul>` }) : '';
  return `<div class="ini-page ref-page" data-referendum-page>${rulesCard()}${kpis}${cards}${formOf(state, data.targets ?? [])}${revisionForm(state)}${reforms}</div>`;
}
