// The institutions of a local or European career as the player sees them: the council with its groups, the executive
// and its assessori, the state of the territory it answers for, the acts in discussion (what each kind is for, who
// decides, the majority it needs, what it changes, the forecast and the player's vote), what the player can do
// (propose, question, negotiate, govern), the chronicle of the council. Everything here is simulation, except the size
// of the European groups at the constitutive session of 2024 (real, with its source).
import { DELEGA_FORBIDDEN, EP_COMMITTEES, EP_COSTS, EP_GROUPS_2024, committeeById, compactVote, coverageGap, europeanOdds, forecastAct, inCommittee, INSTITUTIONS, isClosedAct, LOCAL_VOTE_CHOICES, localAreas, majorityMargin, measureOf, actorOf, delegaScore, nextEuropeanRole, typeOfAct, voteRule, withEuropeanSeat, withLocalState } from '../core/local-engine.js?v=20261005-2';
import { ACT_TYPES, CITY_INDICATORS, QUORUMS, actTypeOf, neededYes, proposableTypes } from '../data/simulation/local-acts.js?v=20261005-2';
import { INDICATORS } from '../data/simulation/society-rules.js?v=20261005-2';
import { DELEGA_RULES } from '../data/simulation/office-rules.js?v=20261005-2';
import { AREA_BY_ID } from '../data/simulation/policy-rules.js?v=20261005-2';
import { esc, meter, num, signed } from './charts.js?v=20261005-2';
import { glyph } from './visuals.js?v=20261005-2';

const STAGES = Object.freeze({ commissione: 'In commissione', giunta: 'In Giunta', aula: 'In aula', osservazioni: 'Osservazioni dei cittadini', 'seconda-lettura': 'Attesa della seconda deliberazione', risposta: 'In attesa di risposta', approvato: 'Approvato', respinto: 'Respinto', ritirato: 'Ritirato', risposto: 'Risposta data' });
const SIDE_LABELS = Object.freeze({ maggioranza: 'Maggioranza', opposizione: 'Opposizione' });
const ROLE_LABELS = Object.freeze({ sindaco: 'Sindaco', presidente: 'Presidente della Regione', eurodeputato: 'Deputato al Parlamento europeo' });
const TAX_LEVELS = Object.freeze({ bassa: 'Bassa', media: 'Media', alta: 'Alta' });
const date = value => value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const percent = value => `${Math.round((value ?? 0) * 100)}%`;
const ROLE_NAMES = Object.freeze({ coordinatore: 'Coordinatore del gruppo', vicepresidente: 'Vicepresidente', presidente: 'Presidente' });
const sideOfAct = (inst, act) => act.sponsor.kind === 'executive' || act.sponsor.kind === 'budget' ? 'governo' : inst.groups.find(group => group.id === act.sponsor.groupId)?.side === 'maggioranza' ? 'maggioranza' : 'opposizione';
const indicatorLabel = (inst, id) => (inst.kind === 'comune' ? CITY_INDICATORS : INDICATORS).find(item => item.id === id)?.label ?? id;
const organLabel = (inst, type) => type.organ === 'giunta' ? INSTITUTIONS[inst.kind].executive : type.organ === 'esecutivo' ? `${INSTITUTIONS[inst.kind].leader ?? 'Esecutivo'} o assessore competente` : INSTITUTIONS[inst.kind].label;
const giuntaSize = inst => (inst.executive?.members?.length ?? 0) + 1;

function roleLine(inst) {
  const rules = INSTITUTIONS[inst.kind];
  const own = inst.groups.find(group => group.id === inst.playerGroupId);
  if (inst.executive?.leader === 'player') return `${inst.kind === 'provincia' ? 'Presidente della Provincia' : inst.kind === 'regione' ? 'Presidente della Regione' : 'Sindaco'} · guidi la ${rules.executive.toLowerCase()}`;
  if (inst.playerDelega) return `${inst.playerRole === 'assessore' ? (inst.kind === 'provincia' ? 'Assessore provinciale' : 'Assessore') : 'Consigliere delegato'} · delega ${inst.playerDelega.portfolio} · ${inst.playerSide === 'maggioranza' ? 'in maggioranza' : 'all’opposizione'}`;
  if (ROLE_LABELS[inst.playerRole] && inst.playerRole !== 'eurodeputato') return `${ROLE_LABELS[inst.playerRole]} · guidi la ${rules.executive.toLowerCase()}`;
  return `${inst.playerRole === 'eurodeputato' ? ROLE_LABELS.eurodeputato : rules.member}${own ? ` · gruppo ${own.label}` : ''} · ${inst.playerSide === 'maggioranza' ? 'in maggioranza' : 'all’opposizione'}`;
}
function composition(inst) {
  const total = inst.seats || 1;
  const bar = [...inst.groups].sort((a, b) => (a.side === b.side ? b.seats - a.seats : a.side === 'maggioranza' ? -1 : 1)).map(group => `<i class="side-${esc(group.side)}${group.id === inst.playerGroupId ? ' own' : ''}" style="width:${(group.seats / total * 100).toFixed(2)}%" title="${esc(group.label)}: ${group.seats} seggi"></i>`).join('');
  const rows = inst.groups.map(group => `<li class="${group.id === inst.playerGroupId ? 'own' : ''}"><span class="local-dot side-${esc(group.side)}"></span><strong>${esc(group.label)}</strong><small>${esc(SIDE_LABELS[group.side] ?? group.side)}${group.id === inst.playerGroupId ? ' · il tuo gruppo' : ''}</small><b>${group.seats}</b><span class="local-cohesion" title="Coesione del gruppo">${meter(group.cohesion, group.cohesion < 45 ? 'danger' : '')}</span></li>`).join('');
  const margin = majorityMargin(inst);
  const needed = Math.floor(inst.seats / 2) + 1;
  return `<div class="local-seats" role="img" aria-label="Composizione: ${inst.groups.map(group => `${group.label} ${group.seats}`).join(', ')}">${bar}</div><p class="local-margin">${inst.seats} seggi · maggioranza politica: ${needed + margin} seggi, ne servono ${needed} per governare${margin < 0 ? ' · <b class="bad">senza numeri: rischio sfiducia</b>' : margin === 0 ? ' · <b class="bad">nessun margine</b>' : ''}</p><ul class="local-groups">${rows}</ul>`;
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
  // Local taxes: the head of the executive proposes the rates, the council votes them (one step at a time).
  const taxPending = inst.acts.some(act => act.category === 'tributi' && !isClosedAct(act));
  const tax = leads && inst.budget && actTypeOf(inst.kind, 'tributi') ? `<div class="local-tax"><span>Pressione fiscale locale</span><div class="bill-vote-choices" role="group" aria-label="Pressione fiscale locale">${Object.entries(TAX_LEVELS).map(([id, label]) => `<button type="button" class="chip-button${inst.budget.localTax === id ? ' active' : ''}" data-local-tax="${id}" data-inst-id="${esc(inst.id)}" aria-pressed="${inst.budget.localTax === id}"${taxPending || inst.budget.localTax === id ? ' disabled' : ''}>${label}</button>`).join('')}</div><small>${taxPending ? 'La proposta sulle aliquote è in consiglio: aspetta il voto.' : 'Proponi al consiglio le nuove aliquote (un livello alla volta): più entrate allargano il margine del bilancio ma costano popolarità; meno tasse il contrario.'}</small></div>` : '';
  const budget = inst.budget ? `<div><dt>Bilancio</dt><dd>Margine ${num(inst.budget.margin, 0)}/100 · pressione fiscale ${esc(inst.budget.localTax)} · ${inst.budget.provisional ? '<b class="bad">esercizio provvisorio</b>' : `bilancio approvato per il ${inst.budget.approvedYear}`}</dd></div>` : '';
  return `<dl class="hq-facts"><div><dt>${esc(rules.leader)}</dt><dd>${esc(inst.executive.label)}</dd></div><div><dt>Stabilità</dt><dd>${num(inst.executive.stability, 0)}/100 ${meter(inst.executive.stability, inst.executive.stability < 40 ? 'danger' : '')}</dd></div><div><dt>Pressione dell’opposizione</dt><dd>${num(inst.pressure, 0)}/100 ${meter(inst.pressure, inst.pressure > 65 ? 'danger' : '')}</dd></div>${budget}</dl><details class="local-giunta"><summary>${esc(rules.executive)}: ${inst.executive.members.length} assessori (figure simulate)</summary><ul>${members}</ul></details>${tax}${reshuffle}`;
}
// The state of the territory the institution answers for: the city's services (comune) or the region's indicators
// (regione, those of the society simulation), with the effects of its approved acts still arriving; the commitments
// the council gave the executive with its motions.
function territoryPanel(inst, state) {
  if (inst.kind === 'europa') return '';
  let rows;
  if (inst.kind === 'comune') {
    rows = CITY_INDICATORS.map(item => {
      const effects = (inst.effects ?? []).filter(effect => effect.indicator === item.id);
      return { label: item.label, value: inst.indicators?.[item.id] ?? 50, coming: effects.reduce((sum, effect) => sum + effect.perWeek * effect.remaining, 0), causes: [...new Set(effects.filter(effect => !effect.delay).map(effect => effect.title))] };
    });
  } else {
    const region = state?.society?.regions?.[inst.region];
    if (!region) return '<p class="quiet-copy">Gli indicatori della regione compaiono quando parte la simulazione del Paese.</p>';
    const titles = new Set(inst.acts.map(act => act.title));
    const effects = (state.society.effects ?? []).filter(effect => effect.region === inst.region && titles.has(String(effect.cause ?? '').replace(/ \(fine del sostegno\)$/, '')));
    rows = INDICATORS.map(item => {
      const own = effects.filter(effect => effect.indicator === item.id);
      return { label: item.label, value: region.indicators[item.id], coming: own.reduce((sum, effect) => sum + effect.perWeek * effect.remaining, 0), causes: [...new Set(own.filter(effect => !effect.delay).map(effect => effect.cause))] };
    });
  }
  const list = rows.map(row => `<div><dt>${esc(row.label)}</dt><dd>${num(row.value, 0)}/100 ${meter(row.value, row.value < 40 ? 'danger' : '')}${Math.abs(row.coming) >= 0.1 ? `<small>In arrivo ${signed(row.coming)} da ${esc(row.causes.slice(0, 2).join(', ') || 'atti approvati')}</small>` : ''}</dd></div>`).join('');
  const commitments = (inst.commitments ?? []).filter(item => item.status === 'aperto').map(item => `<li>${esc(AREA_BY_ID[item.area]?.label ?? item.area)}: un atto entro il ${esc(date(item.dueAt))} <small>(mozione “${esc(item.title)}”)</small></li>`).join('');
  return `<dl class="hq-facts local-territory">${list}</dl>${commitments ? `<div class="local-commitments"><strong>Impegni votati dal consiglio</strong><ul>${commitments}</ul></div>` : ''}<p class="poll-footnote">${inst.kind === 'comune' ? 'Servizi della città (simulazione): li muovono gli atti approvati, senza cura si consumano; una parte degli effetti arriva agli indicatori della regione.' : inst.kind === 'provincia' ? 'Indicatori della regione di cui la provincia fa parte: strade, scuole e servizi di area vasta ne muovono una quota, settimana dopo settimana.' : 'Indicatori della regione nella simulazione del Paese: gli atti approvati li muovono settimana dopo settimana.'}</p>`;
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
// What an act changes if approved (its measure), in words: the indicators, the budget margin, the taxes.
function measureText(inst, act) {
  const measure = act.measure ?? (act.category ? measureOf(inst, act) : null);
  if (!measure) return '';
  const parts = Object.entries(measure.indicators).map(([id, delta]) => `${indicatorLabel(inst, id)} ${signed(delta)}`);
  const when = parts.length ? ` in ${measure.phase} settiman${measure.phase === 1 ? 'a' : 'e'}${measure.lasting ? '' : ', poi in parte svanisce'}` : '';
  const money = measure.cost > 0 ? `margine di bilancio −${num(measure.cost, 1)}` : measure.revenue ? `margine di bilancio ${signed(measure.revenue)}` : '';
  const tax = measure.tax ? `pressione fiscale ${measure.tax === 'su' ? 'in aumento' : 'in calo'}` : '';
  return [parts.length ? `${parts.join(', ')}${when}` : '', money, tax].filter(Boolean).join(' · ');
}
// The majority an act needs, with this council's numbers.
function majorityText(inst, act) {
  const type = typeOfAct(inst, act);
  if (!type) return '';
  if (type.quorum === 'giunta') return `${QUORUMS.giunta.label}: ${Math.floor(giuntaSize(inst) / 2) + 1} voti su ${giuntaSize(inst)}; il consiglio non vota`;
  if (type.quorum === 'nessuno') return QUORUMS.nessuno.detail;
  const rule = voteRule(inst, act);
  const needed = neededYes(rule.quorum, inst.seats);
  return `${QUORUMS[rule.quorum].label}${needed ? `: ${needed} sì su ${inst.seats}` : ' (più sì che no)'} · numero legale ${rule.legal} presenti${act.secondCall ? ' (seconda convocazione)' : ''}`;
}
// How an act works: its function, who decides, the iter, the majority, what it changes, what follows if it passes or not.
function actExplain(inst, act, type) {
  const changes = measureText(inst, act);
  const [yesLabel, noLabel] = type.quorum === 'nessuno' ? ['Se il servizio va male', 'Se il servizio va bene'] : ['Se passa', 'Se non passa'];
  return `<details class="local-explain"><summary>Come funziona: ${esc(type.label.toLowerCase())}</summary><dl class="hq-facts">
    <div><dt>A cosa serve</dt><dd>${esc(type.function)}</dd></div>
    <div><dt>Chi decide</dt><dd>${esc(organLabel(inst, type))} · propone: ${esc(type.proposers)}${type.reference ? ` (${esc(type.reference)})` : ''}</dd></div>
    <div><dt>Iter</dt><dd>${esc(type.iter.join(' → '))}</dd></div>
    <div><dt>Maggioranza</dt><dd>${esc(majorityText(inst, act))}</dd></div>
    <div><dt>Cosa cambia</dt><dd>${esc(changes || type.modifies)}</dd></div>
    <div><dt>${yesLabel}</dt><dd>${esc(type.approved)}</dd></div>
    <div><dt>${noLabel}</dt><dd>${esc(type.rejected)}</dd></div>
  </dl></details>`;
}
// After the vote (or the answer): the votes actually cast (the player's included), how the player voted, what it did.
function resultLine(item) {
  if (item.answer) return `<small class="local-vote-line">Risposta ${esc(item.answer)} dell’esecutivo</small>`;
  if (item.withdrawn) return `<small class="local-vote-line">Ritirato: ${esc(item.withdrawn)}</small>`;
  if (!item.vote) return item.committeeVote && !item.committeeVote.passed ? `<small class="local-vote-line">Respinto in commissione: ${item.committeeVote.yes} sì, ${item.committeeVote.against} no</small>` : '';
  const vote = item.vote;
  if (vote.organ === 'giunta') return `<small class="local-vote-line">Voto in Giunta: <b>${vote.yes}</b> sì su ${vote.yes + vote.against + vote.abstain}${item.effects ? ` · ${esc(item.effects)}` : ''}</small>`;
  const against = vote.playerLine && vote.playerChoice !== vote.playerLine && vote.playerChoice !== 'assente' ? ', contro la linea del gruppo' : '';
  const mine = vote.playerChoice ? ` · il tuo voto: <b>${esc(vote.playerChoice)}</b>${against}${vote.decisive ? ' · <b>decisivo</b>' : ''}` : '';
  const rule = vote.quorum && vote.quorum !== 'votanti' && vote.needed ? ` · servivano ${vote.needed} sì (${esc(QUORUMS[vote.quorum]?.short ?? vote.quorum)})` : '';
  return `<small class="local-vote-line">Risultato del voto: ${voteCounts({ yes: vote.yes, no: vote.against, abstain: vote.abstain, absent: vote.absent })}${rule}${mine}${item.effects && vote.passed ? ` · effetti: ${esc(item.effects)}` : ''}</small>`;
}
function actCard(inst, act, capital, context = { capital, influence: 30 }) {
  const open = !isClosedAct(act);
  const side = sideOfAct(inst, act);
  const type = typeOfAct(inst, act);
  const question = type?.organ === 'esecutivo';
  const byGiunta = type?.organ === 'giunta';
  const forecast = open && !question ? forecastAct(inst, act) : null;
  const leads = inst.executive?.leader === 'player';
  const last = act.votes?.at(-1);
  let forecastBox = '';
  if (forecast?.organ === 'giunta') {
    const members = forecast.members.map(item => `<span class="bill-pos pos-${esc(item.line)}">${esc(item.portfolio)} · ${esc(inst.groups.find(group => group.id === item.groupId)?.label ?? 'lista civica')}: ${esc(item.line)}</span>`).join('');
    forecastBox = `<div class="bill-forecast"><span class="section-kicker">Previsione in Giunta</span><div class="bill-forecast-head"><strong class="${forecast.passes ? 'good' : 'bad'}">${forecast.passes ? 'La Giunta la adotterebbe' : 'La Giunta è divisa'}</strong><small>circa ${forecast.yes} sì su ${forecast.total}, ne servono ${forecast.needed}</small></div><div class="bill-positions">${members}</div></div>`;
  } else if (forecast) {
    const positions = `<div class="bill-positions">${forecast.positions.map(item => `<span class="bill-pos pos-${esc(item.line)}${item.groupId === inst.playerGroupId ? ' own' : ''}">${esc(item.label)} · ${esc(item.line)}: ${voteCounts(item, { group: true })}${item.playerChoice ? ` · tu: ${esc(item.playerChoice)}` : ''}</span>`).join('')}</div>`;
    const rule = forecast.quorum === 'votanti' ? 'passa con più sì che no' : `servono ${forecast.needed} sì su ${forecast.total} (${QUORUMS[forecast.quorum].short})`;
    const legal = forecast.yes + forecast.against + forecast.abstain < forecast.legal ? ' · rischio numero legale' : '';
    forecastBox = `<div class="bill-forecast"><span class="section-kicker">Previsione prima del voto ${inst.kind === 'europa' ? 'in plenaria' : 'in aula'}</span><div class="bill-forecast-head"><strong class="${forecast.passes ? 'good' : 'bad'}">${forecast.passes ? 'Oggi passerebbe' : 'Oggi non passerebbe'}</strong><small>circa ${voteCounts({ ...forecast, no: forecast.against }, { bold: false })} · ${rule}${legal}</small></div><div class="bill-meter"><i style="width:${Math.min(100, forecast.yes / forecast.total * 100).toFixed(1)}%"></i><b style="left:${Math.min(100, forecast.needed / forecast.total * 100).toFixed(1)}%"></b></div>${positions}</div>`;
  }
  // The player votes in the council on its acts, not on those of the Giunta (unless leading it) nor on questions.
  const vote = open && !question && !byGiunta && act.sponsor.kind !== 'player' && !(leads && ['executive', 'budget'].includes(act.sponsor.kind)) ? `<div class="bill-vote"><span>Il tuo voto in aula</span><div class="bill-vote-choices" role="group" aria-label="Il tuo voto">${Object.entries(LOCAL_VOTE_CHOICES).map(([id, label]) => `<button type="button" class="chip-button${(act.pendingPlayerVote ?? 'linea') === id ? ' active' : ''}" data-local-vote="${id}" data-inst-id="${esc(inst.id)}" data-act-id="${esc(act.id)}" aria-pressed="${(act.pendingPlayerVote ?? 'linea') === id}">${esc(label)}</button>`).join('')}</div></div>` : '';
  const giuntaNote = open && byGiunta && !leads && actorOf(inst) !== 'assessore' ? `<p class="poll-footnote">Atto della ${esc(INSTITUTIONS[inst.kind].executive)}: il consiglio non lo vota; puoi chiedere conto con un’interrogazione.</p>` : '';
  // The head of the executive (or the proposer) can win a wavering group with a concession: 2 points of capital.
  const own = act.sponsor.kind === 'player' || act.byDelega || (leads && ['executive', 'budget'].includes(act.sponsor.kind));
  const wavering = own && forecast?.organ === 'consiglio' ? forecast.positions.filter(item => item.groupId !== inst.playerGroupId && item.line !== 'favorevole' && !act.concession?.[item.groupId]).sort((a, b) => b.support - a.support).slice(0, 2) : [];
  const concede = wavering.length ? `<div class="bill-speak">${wavering.map(item => `<button class="secondary-button" data-local-concede="${esc(item.groupId)}" data-inst-id="${esc(inst.id)}" data-act-id="${esc(act.id)}"${capital < 2 ? ' disabled' : ''}>Concessione a ${esc(item.label)} · 2 cap.</button>`).join('')}</div>` : '';
  const result = last && open ? `<div class="law-vote-result"><strong>Voto · ${esc(date(last.date))}</strong><span>Sì <b>${last.yes}</b></span><span>No <b>${last.against}</b></span><span>Astenuti <b>${last.abstain}</b></span>${last.playerChoice ? `<span>Il tuo voto <b>${esc(LOCAL_VOTE_CHOICES[last.playerChoice] ?? last.playerChoice)}</b>${last.playerLine && last.playerChoice !== last.playerLine && last.playerChoice !== 'assente' ? ' (in dissenso)' : ''}</span>` : ''}<em>${act.adoptedAt && !act.firstReadingAt ? 'Adottato' : 'Prima deliberazione'}</em></div>` : '';
  const flags = [act.budget ? '<span class="bill-flag warn">Bilancio</span>' : '', act.consensual ? '<span class="bill-flag good">Testo condiviso</span>' : '', act.kind === 'sfiducia' ? '<span class="bill-flag bad">Sfiducia</span>' : '', Object.keys(act.concession ?? {}).length ? `<span class="bill-flag">Concessioni: ${Object.keys(act.concession).map(id => esc(inst.groups.find(group => group.id === id)?.label ?? id)).join(', ')}</span>` : ''].join('');
  const when = open && act.nextStepAt ? `<span>${glyph('clock', 13)} ${question ? 'Risposta entro il' : act.stage === 'giunta' ? 'In Giunta il' : act.stage === 'aula' ? 'Voto il' : act.stage === 'osservazioni' ? 'Approvazione dopo il' : act.stage === 'seconda-lettura' ? 'Seconda deliberazione dopo il' : inst.kind === 'europa' ? 'Voto in commissione il' : 'In aula il'} ${esc(date(act.nextStepAt))}</span>` : '';
  // Who decides and with which majority, what it changes, whether the money is there: visible before the vote.
  const how = type && inst.kind !== 'europa' ? `<p class="bill-committee">${glyph(byGiunta ? 'users' : question ? 'mic' : 'ministry', 13)} ${esc(organLabel(inst, type))} · ${esc(majorityText(inst, act))}</p>` : '';
  const changes = measureText(inst, act);
  const measure = changes ? `<p class="local-measure"><b>Se approvato:</b> ${esc(changes)}</p>` : '';
  const gap = open && !question ? coverageGap(inst, act) : null;
  const warning = gap ? `<p class="local-warning">${glyph('alert', 13)} ${esc(gap[0].toUpperCase() + gap.slice(1))}: così verrà ritirato.</p>` : '';
  return `<article class="law-card bill-card local-act stage-${esc(act.stage)} side-${esc(side)}"><div class="law-card-title"><span class="section-kicker">${esc(String(act.label ?? '').toUpperCase())} · ${esc(String(AREA_BY_ID[act.area]?.label ?? act.area).toUpperCase())}</span><h3>${esc(act.title)}</h3><span class="bill-sponsor"><b class="sponsor-${esc(side)}">${esc(side === 'governo' ? INSTITUTIONS[inst.kind].executive : side === 'maggioranza' ? 'Maggioranza' : 'Opposizione')}</b> ${side === 'governo' ? '' : esc(act.sponsor.label ?? '')}</span></div><div class="bill-meta"><span class="bill-flag ${act.stage === 'approvato' ? 'good' : act.stage === 'respinto' ? 'bad' : ''}">${esc(STAGES[act.stage] ?? act.stage)}</span>${when}${flags}</div>${dossierLine(inst, act)}${how}${measure}${warning}${forecastBox}${open && (vote || concede || dossierActions(inst, act, context)) ? `<div class="bill-actions">${dossierActions(inst, act, context)}${concede}${vote}</div>` : ''}${giuntaNote}${result}${type && inst.kind !== 'europa' ? actExplain(inst, act, type) : ''}</article>`;
}
// What the player is in this institution and what that asks: the head of the executive answers for everything, an assessore for the
// service of the delega (judged every few weeks), a group leader for the cohesion of the group, a councillor for the vote and the motions.
function roleBox(inst, state) {
  const actor = actorOf(inst);
  if (inst.kind === 'europa') return '';
  if (actor === 'assessore' || actor === 'delegato') {
    const delega = inst.playerDelega;
    const territory = ['regione', 'provincia'].includes(inst.kind) ? state?.society?.regions?.[inst.region]?.indicators ?? null : null;
    const score = delegaScore(inst, territory);
    const weeks = Math.max(0, DELEGA_RULES.reviewWeeks - Math.floor((Date.parse(`${state?.clock?.currentDate ?? delega.lastReview}T12:00:00Z`) - Date.parse(`${delega.lastReview ?? delega.since}T12:00:00Z`)) / 604800000));
    return `<div class="local-role-box"><strong>${actor === 'assessore' ? 'Assessore' : 'Consigliere delegato'} · ${esc(delega.portfolio)}</strong><span>Servizio ${Number.isFinite(score) ? `a ${num(score, 0)}/100 (all’inizio ${num(delega.baseline ?? score, 0)})` : 'non misurabile'} · prossima valutazione tra ${weeks} settimane · valutazioni negative di fila ${delega.strikes ?? 0}/${DELEGA_RULES.strikesToRevoke}</span><small>Proponi gli atti della tua delega (${esc(delega.areas.map(id => AREA_BY_ID[id]?.label.toLowerCase() ?? id).join(', '))}); ${actor === 'assessore' ? 'non interroghi la giunta di cui fai parte' : 'la giunta li adotta'}; se il servizio va male te ne rispondi.</small></div>`;
  }
  if (actor === 'leader') return `<div class="local-role-box"><strong>Guidi l’esecutivo</strong><small>Giunta, bilancio${actTypeOf(inst.kind, 'tributi') ? ' e tributi' : ' (la Provincia non ha tributi propri di peso)'} sono tuoi; così come la responsabilità di ogni servizio, della maggioranza e della sfiducia.</small></div>`;
  if (inst.playerGroupLead) return `<div class="local-role-box"><strong>Capogruppo</strong><small>Il tuo voto orienta quello del gruppo; se lo porti contro la sua linea, la coesione ne risente.</small></div>`;
  return `<div class="local-role-box"><strong>Consigliere</strong><small>Voti gli atti, presenti mozioni e interroghi l’esecutivo; non governi: la delega la dà il sindaco o il presidente.</small></div>`;
}
function actionsPanel(inst, capital) {
  const rules = INSTITUTIONS[inst.kind];
  const actor = actorOf(inst);
  const leads = actor === 'leader';
  const delegated = actor === 'assessore' || actor === 'delegato';
  const pending = !leads && inst.acts.some(act => (act.sponsor.kind === 'player' || act.byDelega) && act.category !== 'interrogazione' && !isClosedAct(act));
  const areas = (delegated ? inst.playerDelega.areas : localAreas(inst.kind)).filter(id => AREA_BY_ID[id]);
  const areaOptions = areas.map(id => `<option value="${esc(id)}">${esc(AREA_BY_ID[id].label)}</option>`).join('');
  // The kinds the office can propose (taxes have their own buttons, questions their own form); variants as options.
  const kinds = inst.kind === 'europa' ? [] : proposableTypes(inst.kind, leads || delegated).filter(type => !['interrogazione', 'tributi'].includes(type.id) && !(delegated && DELEGA_FORBIDDEN.has(type.id)));
  const money = type => type.cost > 0 ? ` · costo ${num(type.cost, 1)}` : type.revenue ? ` · entrate ${num(type.revenue, 1)}` : type.cost < 0 ? ` · risparmio ${num(-type.cost, 1)}` : '';
  const kindOptions = kinds.flatMap(type => (type.variants ?? [null]).map(variant => `<option value="${esc(variant ? `${type.id}|${variant}` : type.id)}">${esc(type.label)}${variant ? `: ${esc(variant)}` : ''}${type.areas ? ` (${esc(type.areas.map(id => AREA_BY_ID[id]?.label.toLowerCase() ?? id).join(', '))})` : ''}${esc(money(type))}</option>`)).join('');
  const kindSelect = kinds.length ? `<label>Tipo di atto<select name="category"><option value="">Quello adatto al tema</option>${kindOptions}</select></label>` : '';
  const propose = `<form class="local-inline-form" data-local-propose-form data-inst-id="${esc(inst.id)}">${kindSelect}<label>${esc(inst.kind === 'europa' ? rules.acts.player : 'Tema')}<select name="area">${areaOptions}</select></label><button class="primary-button" type="submit"${pending ? ' disabled' : ''}>Presenta · 1 giorno</button></form>${pending ? '<p class="poll-footnote">Hai già una proposta in discussione: aspetta il voto.</p>' : `<p class="poll-footnote">${leads ? `Gli atti della Giunta li adotta la Giunta, gli altri vanno in consiglio con la maggioranza richiesta; puoi fare concessioni ai gruppi incerti. Un atto che spende più del margine (${num(inst.budget?.margin ?? 0, 0)}) viene ritirato per mancanza di copertura.` : inst.kind === 'europa' ? 'Ne sei relatore: prima il voto nella commissione competente, poi la plenaria; servono voti anche fuori dal tuo gruppo.' : inst.playerSide === 'maggioranza' ? 'Dalla maggioranza ha buone probabilità se la giunta la sostiene: le mozioni approvate impegnano la giunta.' : 'Dall’opposizione passa solo se convinci qualcuno della maggioranza: scegli un tema che sentono anche loro.'}</p>`}`;
  const question = leads || actor === 'assessore' ? '' : inst.kind === 'europa'
    ? `<div class="bill-speak"><button class="secondary-button" data-local-question data-inst-id="${esc(inst.id)}">${glyph('mic', 14)} Interrogazione alla ${esc(rules.executive)} · 1 giorno</button></div>`
    : `<div class="local-inline-form local-question" data-local-question-box><label>Interrogazione sul tema<select name="question-area">${areaOptions}</select></label><button class="secondary-button" data-local-question data-inst-id="${esc(inst.id)}">${glyph('mic', 14)} Interrogazione alla ${esc(rules.executive.toLowerCase())} · 1 giorno</button></div>`;
  return `${propose}${question}<p class="poll-footnote">Capitale politico disponibile: ${num(capital, 0)}.</p>`;
}
// The kinds of act of the institution: what each is for, who decides, how and with which majority, what it changes,
// what follows if it passes or not.
function actsGuide(inst) {
  const types = ACT_TYPES[inst.kind] ?? [];
  const majority = type => {
    const needed = neededYes(type.quorum, inst.seats);
    return type.quorum === 'giunta' ? `decide la ${INSTITUTIONS[inst.kind].executive}` : type.quorum === 'nessuno' ? 'nessun voto' : `${QUORUMS[type.quorum].label.toLowerCase()}${needed ? ` (${needed} sì su ${inst.seats})` : ''}`;
  };
  const rows = types.map(type => `<li><strong>${esc(type.label)}</strong> <small>${esc(organLabel(inst, type))} · ${esc(majority(type))}</small><p>${esc(type.function)}</p><p><b>Cambia:</b> ${esc(type.modifies)}</p><p><b>${type.quorum === 'nessuno' ? 'Esiti' : 'Se passa'}:</b> ${esc(type.approved)} <b>${type.quorum === 'nessuno' ? 'Altrimenti' : 'Se non passa'}:</b> ${esc(type.rejected)}</p><small>${esc(type.iter.join(' → '))}${type.reference ? ` · ${esc(type.reference)}` : ''}</small></li>`).join('');
  const needed = Math.floor(inst.seats / 2) + 1;
  return `<details class="bill-archive local-guide"><summary>Guida agli atti: ${types.length} tipi</summary><ul>${rows}</ul><p class="poll-footnote">Maggioranza politica: la coalizione che sostiene l’esecutivo (ne servono ${needed} seggi su ${inst.seats} per governare). Maggioranza dei votanti: più sì che no. Maggioranza assoluta: ${needed} sì su ${inst.seats}. Due terzi: ${neededYes('dueterzi', inst.seats)} sì. Regole semplificate del gioco, ispirate al TUEL e alla Costituzione.</p></details>`;
}
function institutionCard(input, capital, context, state) {
  const inst = withLocalState(withEuropeanSeat(input, input.since));
  const rules = INSTITUTIONS[inst.kind];
  const open = inst.acts.filter(act => !isClosedAct(act)).sort((a, b) => String(a.nextStepAt).localeCompare(String(b.nextStepAt)));
  const closed = inst.acts.filter(isClosedAct).slice(-4).reverse();
  const history = inst.history.slice(-8).reverse().map(item => `<li><time>${esc(date(item.date))}</time> ${esc(item.text)}</li>`).join('');
  const archive = [...closed.map(act => ({ title: act.title, stage: act.stage, closedAt: act.closedAt, vote: compactVote(act.votes?.at(-1)), committeeVote: act.votes?.length ? null : act.committeeVote ?? null, answer: act.answer ?? null, withdrawn: act.withdrawn ?? null, effects: measureText(inst, act) })), ...inst.archive.slice(-6).reverse()].slice(0, 10).map(item => `<li><span class="bill-flag ${item.stage === 'approvato' || item.answer === 'esauriente' ? 'good' : 'bad'}">${esc(STAGES[item.stage] ?? item.stage)}</span> ${esc(item.title)} <small>${esc(date(item.closedAt))}</small>${resultLine(item)}</li>`).join('');
  return `<section class="hq-panel local-institution" id="istituzione-${esc(inst.kind)}"><div class="home-section-heading"><div><span class="section-kicker">${esc(rules.label.toUpperCase())} · SIMULAZIONE</span><h2>${esc(inst.name)}</h2><p class="section-subtitle">${esc(roleLine(inst))}${inst.until ? ` · mandato fino al voto del ${esc(date(inst.until))}` : ''}</p></div><span class="parliament-provenance simulated">SCENARIO SIMULATO</span></div>
    <div class="local-grid"><div><h3 class="local-h">Composizione</h3>${composition(inst)}</div><div><h3 class="local-h">${esc(inst.ep ? 'Le tue commissioni' : rules.executive)}</h3>${inst.ep ? europeanPanel(inst, context) : executivePanel(inst)}</div></div>
    ${inst.ep ? `<h3 class="local-h">${esc(rules.executive)}</h3>${executivePanel(inst)}` : `<h3 class="local-h">${esc(inst.kind === 'comune' ? 'Stato della città' : inst.kind === 'provincia' ? 'Stato del territorio provinciale' : 'Stato della regione')}</h3>${territoryPanel(inst, state)}`}
    <h3 class="local-h">Cosa puoi fare</h3>${roleBox(inst, state)}${actionsPanel(inst, capital)}
    <h3 class="local-h">In discussione (${open.length})</h3>${open.map(act => actCard(inst, act, capital, context)).join('') || '<p class="quiet-copy">Nessun atto in calendario: la giunta e i gruppi ne presentano di nuovi ogni settimana.</p>'}
    ${archive ? `<details class="bill-archive"><summary>Atti conclusi</summary><ul>${archive}</ul></details>` : ''}
    ${inst.kind !== 'europa' ? actsGuide(inst) : ''}
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
  return `<div class="local-institutions" id="istituzioni"><div class="home-section-heading local-intro"><div><span class="section-kicker">LE TUE ISTITUZIONI</span><h2>Dove eserciti il tuo mandato</h2><p class="section-subtitle">Delibere, leggi, mozioni, voti e interrogazioni e, se guidi l’esecutivo, giunta, bilancio e tributi: ogni atto approvato cambia i servizi del territorio.</p></div></div>${jump}${active.map(inst => institutionCard(inst, capital, context, state)).join('')}<p class="poll-footnote">Consigli, giunte, gruppi, atti, voti ed effetti sono simulati (source: simulation); sindaci, presidenti e assessori non giocanti sono figure simulate, non persone reali.</p></div>`;
}
export const activeInstitutions = state => (state?.local?.institutions ?? []).filter(item => item.status === 'active');
// How a council is named in the links that lead to it (Home, election report).
export function institutionLabel(inst) {
  if (inst.kind === 'europa') return 'Parlamento europeo';
  if (inst.executive?.leader === 'player') return inst.kind === 'regione' ? `La tua Regione · ${inst.name.replace(/^Regione\s*/, '')}` : inst.kind === 'provincia' ? `La tua Provincia · ${inst.name.replace(/^(Provincia|Città metropolitana|Libero consorzio comunale)\s*(di)?\s*/, '')}` : `Il tuo Comune · ${inst.name.replace(/^Comune di\s*/, '')}`;
  return inst.kind === 'regione' ? 'Consiglio regionale' : inst.kind === 'provincia' ? 'Consiglio provinciale' : 'Consiglio comunale';
}
