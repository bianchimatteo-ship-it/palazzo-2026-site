// The desk of the minister on the page «Governo»: the department with its areas and problems, the priority, the crises of the sector, what the Prime Minister asks, the proposals (prepare, sound out
// colleagues, submit to the Council of Ministers, see how each minister voted). Every button calls store.ministryAction: nothing is decorative.
import { MINISTRY_RULES } from '../core/ministry-engine.js?v=20261118-11';
import { badge, card, esc } from './sections-kit.js?v=20261118-11';

const meter = value => `<b class="dp-meter ${value < 38 ? 'bad' : value < 50 ? 'warn' : ''}" role="img" aria-label="${esc(String(Math.round(value ?? 0)))}"><i style="width:${Math.max(0, Math.min(100, Number(value) || 0))}%"></i></b>`;
const btn = (kind, attrs, label, tone = 'secondary-button') => `<button type="button" class="${tone} compact" data-ministry-kind="${esc(kind)}" ${Object.entries(attrs).map(([key, value]) => `data-min-${key}="${esc(value)}"`).join(' ')}>${esc(label)}</button>`;
const STATUS = { 'in-preparazione': ['In preparazione', 'warning'], pronta: ['Pronta', 'good'], 'in-agenda': ['In Consiglio dei ministri', 'warning'], approvata: ['Approvata', 'good'], respinta: ['Respinta', 'bad'], ritirata: ['Ritirata', 'neutral'] };

export function ministryPanel(view, state) {
  if (!view) return '';
  const { ministry, areas, colleagues, financing } = view;
  const priority = areas.find(item => item.id === ministry.priority);
  const header = `<div class="sx-kpis"><div class="sx-kpi"><span>Ministero</span><b>${esc(ministry.portfolio)}</b></div><div class="sx-kpi"><span>Rapporto con il Presidente del Consiglio</span>${meter(ministry.pmRelation)}</div><div class="sx-kpi"><span>Peso nel governo</span>${meter(ministry.standing)}</div></div>`;
  const rows = areas.map(item => `<li data-ministry-area="${esc(item.id)}"><strong>${esc(item.label)}</strong> ${item.value === null ? '' : meter(item.value)} <small>${item.value === null ? '' : `${Math.round(item.value)}/100${item.value < 45 ? ' · problema' : ''}`}</small>${item.id === ministry.priority ? ' <span class="badge badge-good">Priorità</span>' : btn('priorita', { area: item.id }, 'Rendila priorità · 1 giorno', 'ghost-button')}</li>`).join('');
  const crises = ministry.crises.filter(item => item.status === 'aperta').map(item => `<li data-ministry-crisis="${esc(item.id)}"><span>${badge('Crisi', 'bad')} ${esc(areas.find(a => a.id === item.area)?.label ?? item.area)} a ${item.value}/100 · risposta entro la settimana ${item.deadlineWeek}</span><span class="cl-actions">${item.statement ? '' : btn('dichiarazione', { crisis: item.id }, 'Dichiarazione · 1 giorno')}${item.funded ? '' : btn('fondi', { crisis: item.id }, 'Chiedi fondi d’emergenza · 1 giorno · 2 cap.')}</span></li>`).join('');
  const assignments = ministry.assignments.filter(item => item.status === 'aperto').map(item => `<li data-ministry-assignment="${esc(item.id)}"><span>Il Presidente del Consiglio ti chiede ${esc(item.title)}, entro la settimana ${item.dueWeek}.</span><span class="cl-actions">${btn('consegna', { assignment: item.id }, 'Consegna · 2 giorni', 'primary-button')}${item.extended ? '' : btn('proroga', { assignment: item.id }, 'Chiedi più tempo · 1 cap.', 'ghost-button')}</span></li>`).join('');
  const proposals = ministry.proposals.slice(0, 6).map(item => {
    const [label, tone] = STATUS[item.status] ?? [item.status, 'neutral'];
    const area = areas.find(a => a.id === item.area)?.label ?? item.area;
    const sound = ['pronta', 'in-agenda', 'in-preparazione'].includes(item.status) ? `<label class="min-sound">Sonda un collega<select data-min-colleague>${colleagues.filter(c => !item.lobbied.includes(c.id)).map(c => `<option value="${esc(c.id)}">${esc(c.portfolio)}</option>`).join('')}</select></label>${btn('sonda', { proposal: item.id }, 'Incontro · 1 giorno · 1 cap.')}` : '';
    const submit = item.status === 'pronta' ? btn('porta', { proposal: item.id }, 'Porta in Consiglio · 1 giorno', 'primary-button') : item.status === 'in-preparazione' ? `<small>Pronta alla settimana ${item.readyWeek}.</small>` : '';
    const withdraw = ['in-preparazione', 'pronta', 'in-agenda'].includes(item.status) ? btn('ritira', { proposal: item.id }, 'Ritira', 'ghost-button') : '';
    const votes = item.votes ? `<ul class="min-votes" data-ministry-votes>${item.votes.map(vote => `<li>${esc(vote.portfolio)}: ${vote.vote === 'favorevole' ? 'a favore' : 'contro'}${vote.weight === 2 ? ' (voto doppio)' : ''}</li>`).join('')}</ul>` : '';
    return `<li class="req-card" data-ministry-proposal="${esc(item.id)}" data-ministry-status="${esc(item.status)}"><div class="ini-head">${badge(label, tone)} <small>${esc(area)} · finanziata con ${esc(financing[item.financing])}${item.lobbied.length ? ` · ${item.lobbied.length} colleghi sondati` : ''}</small></div><strong>${esc(item.title)}</strong>${item.outcome ? `<small>Esito: ${esc(item.outcome)}${item.lawId ? ' · il governo ha presentato il disegno di legge' : ''}</small>` : ''}<div class="req-actions">${sound}${submit}${withdraw}</div>${votes}</li>`;
  }).join('');
  const options = areas.map(item => Object.entries(item.instruments).map(([id, text]) => `<option value="${esc(item.id)}|${esc(id)}">${esc(item.label)} — ${esc(text)}</option>`).join('')).join('');
  const form = `<form class="ini-form" data-ministry-form><label>Prepara una proposta<select name="measure">${options}</select></label><label>Come la finanzi<select name="financing">${Object.entries(financing).map(([id, text]) => `<option value="${esc(id)}">${esc(text)}</option>`).join('')}</select></label><label>Ambizione<select name="intensity"><option value="1">Misura contenuta</option><option value="2">Misura forte</option></select></label><button type="submit" class="primary-button">Prepara la proposta · 1 giorno · 1 cap.</button><small>Lo staff impiega ${MINISTRY_RULES.prepWeeks} settimane. Puoi proporre solo misure delle aree del tuo ministero: per le altre ti rivolgi al collega competente.</small></form>`;
  const history = ministry.history.slice(0, 6).map(item => `<li><small>${esc(item.date)}</small> ${esc(item.text)}</li>`).join('');
  return card({ kicker: 'AREA MINISTERIALE', title: `Ministero · ${ministry.portfolio}`, body: `<div data-ministry-desk>${header}<p class="quiet-copy">${priority ? `Priorità del ministero: ${esc(priority.label)}.` : 'Scegli una priorità per il tuo ministero: il Presidente del Consiglio la tiene in conto.'} Ogni azione costa giorni della settimana e, a volte, capitale politico.</p>
    <h4>Le aree del ministero</h4><ul class="ini-levers-list">${rows}</ul>
    ${crises ? `<h4>Crisi del settore</h4><ul class="cl-waiting">${crises}</ul>` : ''}
    ${assignments ? `<h4>Che cosa ti chiede il Presidente del Consiglio</h4><ul class="cl-waiting">${assignments}</ul>` : ''}
    <h4>Le tue proposte</h4>${proposals ? `<ul class="req-list">${proposals}</ul>` : '<p class="sx-empty">Nessuna proposta ancora: preparane una qui sotto.</p>'}${form}
    <details class="ini-history"><summary>Il tuo lavoro al ministero</summary><ul>${history}</ul></details></div>` });
}
