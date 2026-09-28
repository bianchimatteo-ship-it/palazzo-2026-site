// The institutions of a local or European career as the player sees them: the council with its groups, the executive
// and its assessori, the acts in discussion with the forecast and the player's vote, what the player can do (propose,
// question, negotiate, govern), the chronicle of the council. Everything here is simulation, except the size of the
// European groups at the constitutive session of 2024 (real, with its source).
import { EP_COMMITTEES, EP_COSTS, EP_GROUPS_2024, committeeById, compactVote, europeanOdds, forecastAct, inCommittee, INSTITUTIONS, isClosedAct, LOCAL_VOTE_CHOICES, localAreas, majorityMargin, nextEuropeanRole, withEuropeanSeat } from '../core/local-engine.js?v=20260928-1';
import { AREA_BY_ID } from '../data/simulation/policy-rules.js?v=20260928-1';
import { esc, meter, num } from './charts.js?v=20260928-1';
import { glyph } from './visuals.js?v=20260928-1';

const STAGES = Object.freeze({ commissione: 'In commissione', aula: 'In aula', approvato: 'Approvato', respinto: 'Respinto', ritirato: 'Ritirato' });
const SIDE_LABELS = Object.freeze({ maggioranza: 'Maggioranza', opposizione: 'Opposizione' });
const ROLE_LABELS = Object.freeze({ sindaco: 'Sindaco', presidente: 'Presidente della Regione', eurodeputato: 'Deputato al Parlamento europeo' });
const TAX_LEVELS = Object.freeze({ bassa: 'Bassa', media: 'Media', alta: 'Alta' });
const date = value => value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const percent = value => `${Math.round((value ?? 0) * 100)}%`;
const ROLE_NAMES = Object.freeze({ coordinatore: 'Coordinatore del gruppo', vicepresidente: 'Vicepresidente', presidente: 'Presidente' });
const sideOfAct = (inst, act) => act.sponsor.kind === 'executive' || act.sponsor.kind === 'budget' ? 'governo' : inst.groups.find(group => group.id === act.sponsor.groupId)?.side === 'maggioranza' ? 'maggioranza' : 'opposizione';

function roleLine(inst) {
  const rules = INSTITUTIONS[inst.kind];
  const own = inst.groups.find(group => group.id === inst.playerGroupId);
  if (ROLE_LABELS[inst.playerRole] && inst.playerRole !== 'eurodeputato') return `${ROLE_LABELS[inst.playerRole]} · guidi la ${rules.executive.toLowerCase()}`;
  return `${inst.playerRole === 'eurodeputato' ? ROLE_LABELS.eurodeputato : rules.member}${own ? ` · gruppo ${own.label}` : ''} · ${inst.playerSide === 'maggioranza' ? 'in maggioranza' : 'all’opposizione'}`;
}
function composition(inst) {
  const total = inst.seats || 1;
  const bar = [...inst.groups].sort((a, b) => (a.side === b.side ? b.seats - a.seats : a.side === 'maggioranza' ? -1 : 1)).map(group => `<i class="side-${esc(group.side)}${group.id === inst.playerGroupId ? ' own' : ''}" style="width:${(group.seats / total * 100).toFixed(2)}%" title="${esc(group.label)}: ${group.seats} seggi"></i>`).join('');
  const rows = inst.groups.map(group => `<li class="${group.id === inst.playerGroupId ? 'own' : ''}"><span class="local-dot side-${esc(group.side)}"></span><strong>${esc(group.label)}</strong><small>${esc(SIDE_LABELS[group.side] ?? group.side)}${group.id === inst.playerGroupId ? ' · il tuo gruppo' : ''}</small><b>${group.seats}</b><span class="local-cohesion" title="Coesione del gruppo">${meter(group.cohesion, group.cohesion < 45 ? 'danger' : '')}</span></li>`).join('');
  const margin = majorityMargin(inst);
  const needed = Math.floor(inst.seats / 2) + 1;
  return `<div class="local-seats" role="img" aria-label="Composizione: ${inst.groups.map(group => `${group.label} ${group.seats}`).join(', ')}">${bar}</div><p class="local-margin">${inst.seats} seggi · la maggioranza ne ha ${needed + margin}, ne servono ${needed}${margin < 0 ? ' · <b class="bad">senza numeri: rischio sfiducia</b>' : margin === 0 ? ' · <b class="bad">nessun margine</b>' : ''}</p><ul class="local-groups">${rows}</ul>`;
}
// The MEP's committees: full member and substitute, the work record, the next office and a move to another committee.
function europeanPanel(inst, context) {
  const ep = inst.ep;
  const member = committeeById(ep.member);
  const substitute = committeeById(ep.substitute);
  const odds = europeanOdds(inst, null, context);
  const role = nextEuropeanRole(inst);
  const weeksInRole = ep.roleSince ? Math.floor((Date.parse(`${context.today}T12:00:00Z`) - Date.parse(`${ep.roleSince}T12:00:00Z`)) / 604800000) : 0;
  const blocker = !role ? 'Guidi già la tua commissione.' : ep.merit < role.merit ? `Servono ${role.merit} punti di lavoro in commissione (ne hai ${ep.merit}).` : ep.role && weeksInRole < role.after ? `Servono ${role.after} settimane nell’incarico attuale (sei a ${weeksInRole}).` : context.capital < role.capital ? `Servono ${role.capital} punti di capitale politico.` : '';
  const run = role ? `<button class="secondary-button" data-ep-role data-inst-id="${esc(inst.id)}"${blocker ? ` disabled title="${esc(blocker)}"` : ''}>Candidati: ${esc(role.label.toLowerCase())} · 1 giorno · ${role.capital} cap. · ${percent(odds.role)}</button>${blocker ? `<p class="poll-footnote">${esc(blocker)}</p>` : ''}` : '';
  const move = `<form class="local-inline-form" data-ep-committee-form data-inst-id="${esc(inst.id)}"><label>Chiedi di passare a<select name="committee">${EP_COMMITTEES.filter(item => item.id !== ep.member).map(item => `<option value="${esc(item.id)}">${esc(item.code)} · ${esc(item.label)}</option>`).join('')}</select></label><button class="secondary-button" type="submit"${context.capital < EP_COSTS.committee ? ' disabled' : ''}>Chiedi al gruppo · 1 giorno · ${EP_COSTS.committee} cap. · ${percent(odds.committee)}</button></form>${ep.role ? '<p class="poll-footnote">Cambiando commissione lasci l’incarico che hai in quella attuale.</p>' : ''}`;
  return `<dl class="hq-facts"><div><dt>Membro titolare</dt><dd><span><b>${esc(member.code)}</b> · ${esc(member.label)}</span></dd></div><div><dt>Membro sostituto</dt><dd><span><b>${esc(substitute.code)}</b> · ${esc(substitute.label)}</span></dd></div><div><dt>Incarico</dt><dd>${ep.role ? `${esc(ROLE_NAMES[ep.role])} · ${esc(member.code)} dal ${esc(date(ep.roleSince))}` : 'Membro della commissione'}</dd></div><div><dt>Lavoro in commissione</dt><dd>${ep.merit} punti · ${ep.reports} relazioni approvate · ${ep.amendments.carried} emendamenti approvati su ${ep.amendments.tabled}</dd></div></dl>
    <div class="bill-speak">${run}</div>${move}
    <p class="poll-footnote">Le relazioni si chiedono sui dossier della commissione di cui sei titolare, gli emendamenti anche in quella in cui sei sostituto; il voto in commissione precede la plenaria. Commissioni con i nomi reali del Parlamento europeo; composizione, dossier, voti e incarichi sono simulati.</p>`;
}
function executivePanel(inst) {
  const rules = INSTITUTIONS[inst.kind];
  if (!inst.executive) return `<p class="parliament-note">Nel Parlamento europeo l’iniziativa spetta alla ${esc(rules.executive)}: i gruppi politici costruiscono maggioranze diverse su ogni dossier. Gruppi e seggi di partenza: sessione costitutiva del 2024 (<a href="${esc(EP_GROUPS_2024.sourceUrl)}" target="_blank" rel="noopener">${esc(EP_GROUPS_2024.sourceName)}</a>, dato reale); da lì in poi voti e maggioranze sono simulati.</p>`;
  const leads = inst.executive.leader === 'player';
  const majority = inst.groups.filter(group => group.side === 'maggioranza');
  const members = inst.executive.members.map(item => `<li><span>${esc(item.portfolio)}</span><small>${esc(inst.groups.find(group => group.id === item.groupId)?.label ?? 'lista civica')}</small></li>`).join('');
  const reshuffle = leads && majority.length > 1 ? `<form class="local-inline-form" data-local-reshuffle-form data-inst-id="${esc(inst.id)}"><label>Assessorato<select name="portfolio">${inst.executive.members.map(item => `<option value="${esc(item.portfolio)}">${esc(item.portfolio)}</option>`).join('')}</select></label><label>Al gruppo<select name="group">${majority.map(group => `<option value="${esc(group.id)}">${esc(group.label)}</option>`).join('')}</select></label><button class="secondary-button" type="submit">Rimpasto · 1 giorno</button></form><p class="poll-footnote">Chi riceve l’assessorato diventa più leale, chi lo perde meno: una maggioranza trascurata può uscire e sfiduciarti.</p>` : '';
  const tax = leads && inst.budget ? `<div class="local-tax"><span>Pressione fiscale locale</span><div class="bill-vote-choices" role="group" aria-label="Pressione fiscale locale">${Object.entries(TAX_LEVELS).map(([id, label]) => `<button type="button" class="chip-button${inst.budget.localTax === id ? ' active' : ''}" data-local-tax="${id}" data-inst-id="${esc(inst.id)}" aria-pressed="${inst.budget.localTax === id}">${label}</button>`).join('')}</div><small>Più entrate allargano il margine del bilancio ma costano popolarità; meno tasse il contrario.</small></div>` : '';
  return `<dl class="hq-facts"><div><dt>${esc(rules.leader)}</dt><dd>${esc(inst.executive.label)}</dd></div><div><dt>Stabilità</dt><dd>${num(inst.executive.stability, 0)}/100 ${meter(inst.executive.stability, inst.executive.stability < 40 ? 'danger' : '')}</dd></div><div><dt>Pressione dell’opposizione</dt><dd>${num(inst.pressure, 0)}/100 ${meter(inst.pressure, inst.pressure > 65 ? 'danger' : '')}</dd></div>${inst.budget ? `<div><dt>Bilancio</dt><dd>Margine ${num(inst.budget.margin, 0)}/100 · pressione fiscale ${esc(inst.budget.localTax)} · ultimo bilancio approvato: ${inst.budget.approvedYear}</dd></div>` : ''}</dl><details class="local-giunta"><summary>${esc(rules.executive)}: ${inst.executive.members.length} assessori (figure simulate)</summary><ul>${members}</ul></details>${tax}${reshuffle}`;
}
// A European dossier in the own committees: the report can be asked, the text amended (odds shown before the choice).
function dossierActions(inst, act, context) {
  if (!inst.ep || act.stage !== 'commissione' || act.sponsor.kind === 'player' || !inCommittee(inst, act)) return '';
  const odds = europeanOdds(inst, act, context);
  const bid = act.committee === inst.ep.member && !act.rapporteur ? `<button class="secondary-button" data-ep-rapporteur data-inst-id="${esc(inst.id)}" data-act-id="${esc(act.id)}"${context.capital < EP_COSTS.rapporteur ? ' disabled' : ''}>Chiedi la relazione · 1 giorno · ${EP_COSTS.rapporteur} cap. · ${percent(odds.rapporteur)}</button>` : '';
  const amend = !act.playerAmendment ? `<button class="secondary-button" data-ep-amend data-inst-id="${esc(inst.id)}" data-act-id="${esc(act.id)}"${context.capital < EP_COSTS.amendment ? ' disabled' : ''}>Presenta emendamenti · 1 giorno · ${EP_COSTS.amendment} cap. · ${percent(odds.amendment)}</button>` : '';
  return bid || amend ? `<div class="bill-speak">${bid}${amend}</div>` : '';
}
function dossierLine(inst, act) {
  if (inst.kind !== 'europa' || !act.committee) return '';
  const committee = committeeById(act.committee);
  const rapporteur = act.rapporteur?.player ? '<b>tu</b>' : act.rapporteur ? esc(inst.groups.find(group => group.id === act.rapporteur.groupId)?.label ?? 'un altro gruppo') : 'da assegnare';
  const own = inst.ep?.member === act.committee ? ' · la tua commissione' : inst.ep?.substitute === act.committee ? ' · sei sostituto' : '';
  const amendment = act.playerAmendment ? ` · tuo emendamento ${act.playerAmendment.carried ? 'approvato' : 'respinto'}` : '';
  const vote = act.committeeVote ? ` · commissione: ${act.committeeVote.yes} sì, ${act.committeeVote.against} no${act.committeeVote.playerChoice ? `, tuo voto ${esc(LOCAL_VOTE_CHOICES[act.committeeVote.playerChoice] ?? act.committeeVote.playerChoice)}` : ''}` : '';
  return `<p class="bill-committee">${glyph('users', 13)} Commissione ${esc(committee?.code ?? '')}${own} · relatore: ${rapporteur}${amendment}${vote}</p>`;
}
// The votes of the whole assembly (yes and no always shown) or of a group (only what it casts): yes, no, abstentions,
// absences.
function voteCounts(row, { bold = true, group = false } = {}) {
  const parts = [[row.yes, 'sì'], [row.no, 'no'], [row.abstain, row.abstain === 1 ? 'astenuto' : 'astenuti'], [row.absent, row.absent === 1 ? 'assente' : 'assenti']];
  return parts.filter(([value], index) => value || (!group && index < 2)).map(([value, word]) => bold ? `<b>${value}</b> ${word}` : `${value} ${word}`).join(', ');
}
// After the vote: the votes actually cast (the player's included) and how the player voted.
function resultLine(item) {
  if (!item.vote) return item.committeeVote && !item.committeeVote.passed ? `<small class="local-vote-line">Respinto in commissione: ${item.committeeVote.yes} sì, ${item.committeeVote.against} no</small>` : '';
  const vote = item.vote;
  const against = vote.playerLine && vote.playerChoice !== vote.playerLine && vote.playerChoice !== 'assente' ? ', contro la linea del gruppo' : '';
  const mine = vote.playerChoice ? ` · il tuo voto: <b>${esc(vote.playerChoice)}</b>${against}${vote.decisive ? ' · <b>decisivo</b>' : ''}` : '';
  return `<small class="local-vote-line">Risultato del voto: ${voteCounts({ yes: vote.yes, no: vote.against, abstain: vote.abstain, absent: vote.absent })}${mine}</small>`;
}
function actCard(inst, act, capital, context = { capital, influence: 30 }) {
  const open = !isClosedAct(act);
  const side = sideOfAct(inst, act);
  const forecast = open ? forecastAct(inst, act) : null;
  const leads = inst.executive?.leader === 'player';
  const last = act.votes?.at(-1);
  const positions = forecast ? `<div class="bill-positions">${forecast.positions.map(item => `<span class="bill-pos pos-${esc(item.line)}${item.groupId === inst.playerGroupId ? ' own' : ''}">${esc(item.label)} · ${esc(item.line)}: ${voteCounts(item, { group: true })}${item.playerChoice ? ` · tu: ${esc(item.playerChoice)}` : ''}</span>`).join('')}</div>` : '';
  const forecastBox = forecast ? `<div class="bill-forecast"><span class="section-kicker">Previsione prima del voto ${inst.kind === 'europa' ? 'in plenaria' : 'in aula'}</span><div class="bill-forecast-head"><strong class="${forecast.passes ? 'good' : 'bad'}">${forecast.passes ? 'Oggi passerebbe' : 'Oggi non passerebbe'}</strong><small>circa ${voteCounts({ ...forecast, no: forecast.against }, { bold: false })} · passa con più sì che no</small></div><div class="bill-meter"><i style="width:${Math.min(100, forecast.yes / forecast.total * 100).toFixed(1)}%"></i><b style="left:${(forecast.needed / forecast.total * 100).toFixed(1)}%"></b></div>${positions}</div>` : '';
  const vote = open && act.sponsor.kind !== 'player' && !(leads && ['executive', 'budget'].includes(act.sponsor.kind)) ? `<div class="bill-vote"><span>Il tuo voto in aula</span><div class="bill-vote-choices" role="group" aria-label="Il tuo voto">${Object.entries(LOCAL_VOTE_CHOICES).map(([id, label]) => `<button type="button" class="chip-button${(act.pendingPlayerVote ?? 'linea') === id ? ' active' : ''}" data-local-vote="${id}" data-inst-id="${esc(inst.id)}" data-act-id="${esc(act.id)}" aria-pressed="${(act.pendingPlayerVote ?? 'linea') === id}">${esc(label)}</button>`).join('')}</div></div>` : '';
  // The head of the executive (or the proposer) can win a wavering group with a concession: 2 points of capital.
  const own = act.sponsor.kind === 'player' || (leads && ['executive', 'budget'].includes(act.sponsor.kind));
  const wavering = own && forecast ? forecast.positions.filter(item => item.groupId !== inst.playerGroupId && item.line !== 'favorevole' && !act.concession?.[item.groupId]).sort((a, b) => b.support - a.support).slice(0, 2) : [];
  const concede = wavering.length ? `<div class="bill-speak">${wavering.map(item => `<button class="secondary-button" data-local-concede="${esc(item.groupId)}" data-inst-id="${esc(inst.id)}" data-act-id="${esc(act.id)}"${capital < 2 ? ' disabled' : ''}>Concessione a ${esc(item.label)} · 2 cap.</button>`).join('')}</div>` : '';
  const result = last ? `<div class="law-vote-result"><strong>Voto · ${esc(date(last.date))}</strong><span>Sì <b>${last.yes}</b></span><span>No <b>${last.against}</b></span><span>Astenuti <b>${last.abstain}</b></span>${last.playerChoice ? `<span>Il tuo voto <b>${esc(LOCAL_VOTE_CHOICES[last.playerChoice] ?? last.playerChoice)}</b>${last.playerLine && last.playerChoice !== last.playerLine && last.playerChoice !== 'assente' ? ' (in dissenso)' : ''}</span>` : ''}<em>${last.passed ? 'Approvato' : 'Respinto'}</em></div>` : '';
  const flags = [act.budget ? '<span class="bill-flag warn">Bilancio</span>' : '', act.consensual ? '<span class="bill-flag good">Testo condiviso</span>' : '', act.kind === 'sfiducia' ? '<span class="bill-flag bad">Sfiducia</span>' : '', Object.keys(act.concession ?? {}).length ? `<span class="bill-flag">Concessioni: ${Object.keys(act.concession).map(id => esc(inst.groups.find(group => group.id === id)?.label ?? id)).join(', ')}</span>` : ''].join('');
  return `<article class="law-card bill-card local-act stage-${esc(act.stage)} side-${esc(side)}"><div class="law-card-title"><span class="section-kicker">${esc(String(act.label ?? '').toUpperCase())} · ${esc(String(AREA_BY_ID[act.area]?.label ?? act.area).toUpperCase())}</span><h3>${esc(act.title)}</h3><span class="bill-sponsor"><b class="sponsor-${esc(side)}">${esc(side === 'governo' ? INSTITUTIONS[inst.kind].executive : side === 'maggioranza' ? 'Maggioranza' : 'Opposizione')}</b> ${side === 'governo' ? '' : esc(act.sponsor.label ?? '')}</span></div><div class="bill-meta"><span class="bill-flag ${act.stage === 'approvato' ? 'good' : act.stage === 'respinto' ? 'bad' : ''}">${esc(STAGES[act.stage] ?? act.stage)}</span>${open && act.nextStepAt ? `<span>${glyph('clock', 13)} ${act.stage === 'aula' ? 'Voto' : inst.kind === 'europa' ? 'Voto in commissione' : 'In aula'} il ${esc(date(act.nextStepAt))}</span>` : ''}${flags}</div>${dossierLine(inst, act)}${forecastBox}${open && (vote || concede || dossierActions(inst, act, context)) ? `<div class="bill-actions">${dossierActions(inst, act, context)}${concede}${vote}</div>` : ''}${result}</article>`;
}
function actionsPanel(inst, capital) {
  const rules = INSTITUTIONS[inst.kind];
  const leads = inst.executive?.leader === 'player';
  const pending = inst.acts.some(act => act.sponsor.kind === 'player' && !isClosedAct(act)) || inst.acts.some(act => leads && act.kind === 'player' && !isClosedAct(act));
  const areas = localAreas(inst.kind).filter(id => AREA_BY_ID[id]);
  const propose = `<form class="local-inline-form" data-local-propose-form data-inst-id="${esc(inst.id)}"><label>${esc(rules.acts.player)} sul tema<select name="area">${areas.map(id => `<option value="${esc(id)}">${esc(AREA_BY_ID[id].label)}</option>`).join('')}</select></label><button class="primary-button" type="submit"${pending ? ' disabled' : ''}>Presenta · 1 giorno</button></form>${pending ? '<p class="poll-footnote">Hai già una proposta in discussione: aspetta il voto.</p>' : `<p class="poll-footnote">${leads ? 'Come atto della giunta parte con i voti della maggioranza; puoi fare concessioni ai gruppi incerti.' : inst.kind === 'europa' ? 'Ne sei relatore: prima il voto nella commissione competente, poi la plenaria; servono voti anche fuori dal tuo gruppo.' : inst.playerSide === 'maggioranza' ? 'Dalla maggioranza ha buone probabilità se la giunta la sostiene.' : 'Dall’opposizione passa solo se convinci qualcuno della maggioranza: scegli un tema che sentono anche loro.'}</p>`}`;
  const question = !leads ? `<button class="secondary-button" data-local-question data-inst-id="${esc(inst.id)}">${glyph('mic', 14)} Interrogazione alla ${esc(inst.kind === 'europa' ? rules.executive : rules.executive.toLowerCase())} · 1 giorno</button>` : '';
  return `${propose}${question ? `<div class="bill-speak">${question}</div>` : ''}<p class="poll-footnote">Capitale politico disponibile: ${num(capital, 0)}.</p>`;
}
function institutionCard(input, capital, context) {
  const inst = withEuropeanSeat(input, input.since);
  const rules = INSTITUTIONS[inst.kind];
  const open = inst.acts.filter(act => !isClosedAct(act)).sort((a, b) => String(a.nextStepAt).localeCompare(String(b.nextStepAt)));
  const closed = inst.acts.filter(isClosedAct).slice(-4).reverse();
  const history = inst.history.slice(-8).reverse().map(item => `<li><time>${esc(date(item.date))}</time> ${esc(item.text)}</li>`).join('');
  const archive = [...closed.map(act => ({ title: act.title, stage: act.stage, closedAt: act.closedAt, vote: compactVote(act.votes?.at(-1)), committeeVote: act.votes?.length ? null : act.committeeVote ?? null })), ...inst.archive.slice(-6).reverse()].slice(0, 10).map(item => `<li><span class="bill-flag ${item.stage === 'approvato' ? 'good' : 'bad'}">${esc(STAGES[item.stage] ?? item.stage)}</span> ${esc(item.title)} <small>${esc(date(item.closedAt))}</small>${resultLine(item)}</li>`).join('');
  return `<section class="hq-panel local-institution" id="istituzione-${esc(inst.kind)}"><div class="home-section-heading"><div><span class="section-kicker">${esc(rules.label.toUpperCase())} · SIMULAZIONE</span><h2>${esc(inst.name)}</h2><p class="section-subtitle">${esc(roleLine(inst))}${inst.until ? ` · mandato fino al voto del ${esc(date(inst.until))}` : ''}</p></div><span class="parliament-provenance simulated">SCENARIO SIMULATO</span></div>
    <div class="local-grid"><div><h3 class="local-h">Composizione</h3>${composition(inst)}</div><div><h3 class="local-h">${esc(inst.ep ? 'Le tue commissioni' : rules.executive)}</h3>${inst.ep ? europeanPanel(inst, context) : executivePanel(inst)}</div></div>
    ${inst.ep ? `<h3 class="local-h">${esc(rules.executive)}</h3>${executivePanel(inst)}` : ''}
    <h3 class="local-h">Cosa puoi fare</h3>${actionsPanel(inst, capital)}
    <h3 class="local-h">In discussione (${open.length})</h3>${open.map(act => actCard(inst, act, capital, context)).join('') || '<p class="quiet-copy">Nessun atto in calendario: la giunta e i gruppi ne presentano di nuovi ogni settimana.</p>'}
    ${archive ? `<details class="bill-archive"><summary>Atti conclusi</summary><ul>${archive}</ul></details>` : ''}
    ${history ? `<details class="bill-archive" open><summary>Cronaca del ${esc(rules.label.toLowerCase())}</summary><ul class="bill-journal">${history}</ul></details>` : ''}
  </section>`;
}
// The player's active institutions (none: an empty string, the page stays as it was).
export function renderInstitutions(state) {
  const active = activeInstitutions(state);
  if (!active.length) return '';
  const capital = state.game?.resources?.politicalCapital ?? 0;
  const influence = state.dataset?.statistics?.find(item => item.subjectId === state.career?.playerId && item.metric === 'influence')?.value ?? 30;
  const context = { capital, influence, today: state.clock?.currentDate ?? null };
  // Where the player's mandates are played: one card per council (and the European Parliament), reachable at once.
  const jump = active.length > 1 ? `<nav class="local-jump" aria-label="Le tue istituzioni">${active.map(inst => `<button class="chip-button" data-scroll="istituzione-${esc(inst.kind)}">${esc(institutionLabel(inst))}</button>`).join('')}</nav>` : '';
  return `<div class="local-institutions" id="istituzioni"><div class="home-section-heading local-intro"><div><span class="section-kicker">LE TUE ISTITUZIONI</span><h2>Dove eserciti il tuo mandato</h2><p class="section-subtitle">Proposte, voti, interrogazioni e, se guidi l’esecutivo, giunta, bilancio e tributi.</p></div></div>${jump}${active.map(inst => institutionCard(inst, capital, context)).join('')}<p class="poll-footnote">Consigli, giunte, gruppi, atti e voti sono simulati (source: simulation); sindaci, presidenti e assessori non giocanti sono figure simulate, non persone reali.</p></div>`;
}
export const activeInstitutions = state => (state?.local?.institutions ?? []).filter(item => item.status === 'active');
// How a council is named in the links that lead to it (Home, election report).
export function institutionLabel(inst) {
  if (inst.kind === 'europa') return 'Parlamento europeo';
  if (inst.executive?.leader === 'player') return inst.kind === 'regione' ? `La tua Regione · ${inst.name.replace(/^Regione\s*/, '')}` : `Il tuo Comune · ${inst.name.replace(/^Comune di\s*/, '')}`;
  return inst.kind === 'regione' ? 'Consiglio regionale' : 'Consiglio comunale';
}
