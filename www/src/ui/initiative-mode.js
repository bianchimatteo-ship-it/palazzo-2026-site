// The page «Iniziative»: popular initiatives (50,000 signatures, art. 71) and signatures for a referendum (500,000, art. 75), kept apart from the bills of the members of Parliament («Leggi»).
// Every button calls the store (startInitiative, organizeInitiative, depositInitiative, withdrawInitiative): nothing is decorative.
import { INITIATIVE_KINDS, CHANNELS, PARLIAMENTARY_NOTE, SETUP_COST, ESTIMATED_VALID_SHARE, PARLIAMENT_STAGES, overview } from '../core/initiative-engine.js?v=20261117-3';
import { POLICY_AREAS } from '../data/simulation/policy-rules.js?v=20261117-3';
import { badge, card, empty, esc, kpi } from './sections-kit.js?v=20261117-3';
import { formatDate } from '../core/time.js?v=20261117-3';

const number = value => Math.round(Number(value) || 0).toLocaleString('it-IT');
const STATUS = {
  raccolta: ['Raccolta aperta', 'warning'], verifica: ['Verifica delle firme', 'warning'], 'in-parlamento': ['In Parlamento', 'good'], approvata: ['Approvata', 'good'], archiviata: ['Archiviata', 'neutral'],
  depositata: ['Depositata', 'good'], respinta: ['Deposito respinto', 'bad'], fallita: ['Raccolta fallita', 'bad'], ritirata: ['Ritirata', 'neutral']
};
const bar = (value, tone = '') => `<span class="ini-bar ${tone}" role="img" aria-label="${esc(`${Math.round(value)}%`)}"><i style="width:${Math.max(0, Math.min(100, value))}%"></i></span>`;
const lever = (initiative, channel, funds) => {
  const have = initiative.organization?.[channel.id] ?? 0;
  const full = have >= channel.max;
  const amounts = channel.id === 'online' ? [1] : channel.id === 'volontari' ? [10, 50] : [1, 5];
  const buttons = amounts.map(amount => { const cost = channel.setup * amount; const off = full || funds < cost; return `<button type="button" class="ghost-button" data-ini-organize="${esc(initiative.id)}" data-ini-action="${esc(channel.id)}" data-ini-amount="${amount}"${off ? ' disabled aria-disabled="true"' : ''}>+${amount}${cost ? ` · ${number(cost)} €` : ' · gratis'}</button>`; }).join(' ');
  return `<li class="ini-lever" data-ini-lever="${esc(channel.id)}"><div><strong>${esc(channel.label)}</strong> <small>${have ? `${number(have)} attivi` : 'nessuno'}${channel.weekly ? ` · ${channel.weekly} € a settimana ciascuno` : ''}</small><small>${esc(channel.hint)}</small></div><div class="ini-lever-actions">${buttons}</div></li>`;
};
function regionsOf(initiative) {
  const rows = Object.entries(initiative.signatures?.byRegion ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const top = rows[0]?.[1] || 1;
  return rows.length ? `<ul class="ini-regions" data-ini-regions>${rows.map(([name, value]) => `<li><span>${esc(name)}</span>${bar(value * 100 / top)}<b>${number(value)}</b></li>`).join('')}</ul>` : '<p class="sx-empty">Le firme per Regione compaiono dalla prima settimana di raccolta.</p>';
}
function cardOf(initiative, state, view) {
  const [label, tone] = STATUS[initiative.status] ?? [initiative.status, 'neutral'];
  const rules = INITIATIVE_KINDS[initiative.kind];
  const open = initiative.status === 'raccolta';
  const funds = state.game?.resources?.funds ?? 0;
  const head = `<div class="ini-head">${badge(label, tone)} <small>${esc(rules.label)} · ${esc(rules.basis)} · ${esc(POLICY_AREAS.find(item => item.id === initiative.area)?.label ?? initiative.area)}</small></div>`;
  const progress = `<div class="ini-progress"><div class="ini-count"><strong data-ini-total>${number(view.total)}</strong> <span>su ${number(initiative.required)} firme</span></div>${bar(view.percent, view.percent >= 100 ? 'is-full' : '')}<small>${view.percent}% · firme valide stimate circa ${number(view.valid)} (il ${Math.round(ESTIMATED_VALID_SHARE * 100)}% di quelle raccolte)</small></div>`;
  let body = head + progress;
  if (open) {
    const pace = view.rate === null ? '' : `<p class="ini-forecast" data-ini-forecast>Ritmo attuale: circa ${number(view.rate)} firme a settimana · ${view.weeksLeft} settimane al termine (${esc(formatDate(initiative.deadline))}) · previsione ${number(view.forecast)} ${view.onTrack ? '— la soglia è alla portata' : '— così non si arriva alla soglia'}.</p>`;
    const stalled = initiative.opposition ? `<p class="ini-warning" data-ini-opposition>Campagna contraria in corso: −${initiative.opposition}% di firme fino al ${esc(formatDate(initiative.oppositionUntil))}.</p>` : '';
    const ready = view.ready ? `<p class="ini-ready" data-ini-ready>Soglia raggiunta. Meglio aspettare un margine di sicurezza (almeno ${number(view.margin)} firme) per le firme non valide, poi depositare.</p>` : '';
    body += pace + stalled + ready;
    body += `<details class="ini-levers" open><summary>Organizza la raccolta</summary><p class="ini-cost">Spesa settimanale attuale: ${number(view.weeklyCost)} € · fondi disponibili: ${number(funds)} €. Senza fondi i banchetti e la piattaforma si fermano.</p><ul>${Object.values(CHANNELS).map(channel => lever(initiative, channel, funds)).join('')}</ul><button type="button" class="ghost-button" data-ini-organize="${esc(initiative.id)}" data-ini-action="spinta" data-ini-amount="1"${funds < 400 || (initiative.push?.until && initiative.push.until >= state.clock?.currentDate) ? ' disabled aria-disabled="true"' : ''}>Campagna di sensibilizzazione · 400 € · quattro settimane +25%</button></details>`;
    body += `<div class="ini-actions"><button type="button" class="primary-button" data-ini-deposit="${esc(initiative.id)}"${view.ready ? '' : ' disabled aria-disabled="true"'}>Deposita le firme</button> <button type="button" class="secondary-button" data-ini-withdraw="${esc(initiative.id)}">Ritira la raccolta</button>${view.ready ? '' : `<small>Mancano ${number(view.left)} firme alla soglia.</small>`}</div>`;
  } else if (initiative.status === 'verifica') {
    body += `<p class="ini-verify" data-ini-verify>Firme depositate il ${esc(formatDate(initiative.depositedAt))}: la verifica si chiude il ${esc(formatDate(initiative.verification.until))}. Non tutte le firme saranno valide.</p>`;
  } else if (initiative.status === 'in-parlamento') {
    const stage = PARLIAMENT_STAGES.find(item => item.id === initiative.parliament?.stage);
    body += `<p class="ini-parliament" data-ini-parliament>Presentata ${initiative.parliament.chamber === 'camera' ? 'alla Camera' : 'al Senato'}: ${esc(stage?.label ?? '')} (settimana ${initiative.parliament.weeks}). Fase parlamentare simulata: la maggior parte delle iniziative popolari non viene calendarizzata.</p>`;
  }
  if (initiative.outcome) body += `<p class="ini-outcome" data-ini-outcome>${esc(initiative.outcome)}</p>`;
  body += `<details class="ini-territory"><summary>Firme per Regione e per canale</summary>${regionsOf(initiative)}${Object.keys(initiative.signatures?.byChannel ?? {}).length ? `<p class="ini-channels">${Object.entries(initiative.signatures.byChannel).filter(([, value]) => value > 0).map(([id, value]) => `${esc(id === 'organica' ? 'Passaparola e notorietà' : CHANNELS[id]?.label ?? id)}: ${number(value)}`).join(' · ')}</p>` : ''}</details>`;
  if (initiative.articles?.length) body += `<details class="ini-text"><summary>Testo in ${initiative.articles.length} ${initiative.articles.length === 1 ? 'articolo' : 'articoli'}</summary><ol>${initiative.articles.map(item => `<li>${esc(item.text)}</li>`).join('')}</ol></details>`;
  if (initiative.history?.length) body += `<details class="ini-history"><summary>Storia della raccolta</summary><ul>${initiative.history.slice(0, 8).map(item => `<li><small>${esc(formatDate(item.date))}</small> ${esc(item.text)}</li>`).join('')}</ul></details>`;
  return card({ kicker: initiative.kind === 'referendum' ? 'REFERENDUM · FIRME' : 'INIZIATIVA POPOLARE', title: initiative.title, tone, body: `<div class="ini-body" data-initiative="${esc(initiative.id)}" data-initiative-status="${esc(initiative.status)}">${body}</div>` });
}
function formOf(state) {
  const funds = state.game?.resources?.funds ?? 0;
  const areas = POLICY_AREAS.map(item => `<option value="${esc(item.id)}">${esc(item.label)}</option>`).join('');
  return card({ kicker: 'NUOVA RACCOLTA', title: 'Apri una raccolta firme', body: `<form class="ini-form" data-ini-form>
    <label>Che cosa vuoi fare<select name="kind"><option value="popolare">Iniziativa legislativa popolare — 50.000 firme (${number(SETUP_COST.popolare)} €)</option><option value="referendum">Raccolta firme referendaria — 500.000 firme (${number(SETUP_COST.referendum)} €)</option></select></label>
    <label>Titolo<input name="title" type="text" maxlength="90" placeholder="Es. Salario minimo legale" required></label>
    <label>Tema<select name="area">${areas}</select></label>
    <label data-ini-articles>Articoli del testo (uno per riga, al massimo 8; per il referendum lascia vuoto)<textarea name="articles" rows="5" placeholder="Art. 1 — …"></textarea></label>
    <button type="submit" class="primary-button">Apri la raccolta</button>
    <small>Fondi disponibili: ${number(funds)} €. L’apertura copre moduli, autentica e materiali.</small>
  </form>` });
}
const REQ_STATUS = { aperta: ['In attesa di una tua risposta', 'warning'], 'in-corso': ['In corso', 'warning'], risolta: ['Chiusa', 'good'], scaduta: ['Scaduta', 'bad'], respinta: ['Respinta', 'neutral'] };
function requestsOf(state, actionsFor) {
  const list = state.game?.requests ?? [];
  if (!list.length) return card({ kicker: 'RICHIESTE', title: 'Richieste dei cittadini e delle associazioni', body: '<p class="sx-empty">Ogni tanto cittadini e associazioni della tua Regione ti scrivono per un servizio che soffre. Chiudi qualche settimana: quando arriva una richiesta la trovi qui.</p>' });
  const cards = list.slice(0, 8).map(request => {
    const [label, tone] = REQ_STATUS[request.status] ?? [request.status, 'neutral'];
    const actions = request.status === 'aperta' ? (actionsFor?.(request.id) ?? []) : [];
    const buttons = actions.map(action => `<button type="button" class="${action.id === 'declina' ? 'ghost-button' : 'secondary-button'} compact" data-req-act="${esc(request.id)}" data-req-action="${esc(action.id)}" data-req-area="${esc(request.area)}"${action.available ? '' : ' disabled aria-disabled="true"'} title="${esc(action.reason ?? action.hint)}">${esc(action.label)}${action.cost.days ? ` · ${action.cost.days} ${action.cost.days === 1 ? 'giorno' : 'giorni'}` : ''}${action.cost.funds ? ` · ${number(action.cost.funds)} €` : ''}${action.cost.capital ? ` · ${action.cost.capital} cap.` : ''}</button>${action.available ? '' : `<small class="req-reason">${esc(action.reason)}</small>`}`).join('');
    const answer = request.status === 'in-corso' ? `<p class="req-wait" data-req-wait>${esc(request.history[0]?.text ?? '')} La risposta è attesa entro la settimana ${request.answerWeek}.</p>` : request.outcome ? `<p class="req-outcome" data-req-outcome>${esc(request.outcome)}</p>` : '';
    return `<div class="req-card" data-request-card="${esc(request.id)}" data-request-status="${esc(request.status)}"><div class="ini-head">${badge(label, tone)} <small>${esc(request.areaLabel)} · ${esc(request.region)}</small></div><p class="req-text">${esc(request.text)}</p>${answer}${buttons ? `<div class="req-actions">${buttons}</div>` : ''}</div>`;
  }).join('');
  return card({ kicker: 'RICHIESTE', title: 'Richieste dei cittadini e delle associazioni', body: `<p class="quiet-copy">Che cosa puoi fare dipende dagli incarichi che hai: ogni azione ha un costo, un tempo e delle conseguenze.</p>${cards}` });
}
export function renderInitiatives(state, ctxFor = null, requestActions = null) {
  if (!state.game) return empty('Crea prima un politico per promuovere un’iniziativa.', '<button class="primary-button" data-action="new-career">Crea il politico</button>');
  const initiatives = state.game.initiatives ?? [];
  const active = initiatives.filter(item => ['raccolta', 'verifica', 'in-parlamento'].includes(item.status));
  const intro = card({ kicker: 'COSA PUOI FARE', title: 'Tre strade diverse, da non confondere', body: `<ul class="ini-kinds">
    <li><b>Iniziativa legislativa popolare</b><span>${esc(INITIATIVE_KINDS.popolare.short)} Possono promuoverla anche partiti senza parlamentari.</span></li>
    <li><b>Raccolta firme referendaria</b><span>${esc(INITIATIVE_KINDS.referendum.short)}</span></li>
    <li><b>Proposta parlamentare</b><span>${esc(PARLIAMENTARY_NOTE)}</span></li></ul>` });
  const kpis = `<div class="sx-kpis">${kpi({ label: 'Raccolte attive', value: String(active.length) })}${kpi({ label: 'Concluse', value: String(initiatives.length - active.length) })}${kpi({ label: 'Fondi', value: `${number(state.game.resources?.funds ?? 0)} €` })}</div>`;
  const list = initiatives.length ? initiatives.map(item => cardOf(item, state, overview(item, ctxFor ? ctxFor(item) : null))).join('') : card({ kicker: 'RACCOLTE', title: 'Nessuna raccolta firme', body: '<p class="sx-empty">Non hai ancora aperto una raccolta. Compila il modulo qui sotto: serve un titolo, un tema e un testo in articoli.</p>' });
  return `<div class="ini-page" data-ini-page>${intro}${requestsOf(state, requestActions)}${kpis}${list}${formOf(state)}</div>`;
}
