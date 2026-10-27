// The institutions of a local or European career as the player sees them: the council with its groups, the executive
// and its assessori, the state of the territory it answers for, the acts in discussion (what each kind is for, who
// decides, the majority it needs, what it changes, the forecast and the player's vote), what the player can do
// (propose, question, negotiate, govern), the chronicle of the council. Everything here is simulation, except the size
// of the European groups at the constitutive session of 2024 (real, with its source).
import { DELEGA_FORBIDDEN, actCapacity, EP_COMMITTEES, EP_COSTS, EP_GROUPS_2024, committeeById, compactVote, coverageGap, europeanOdds, forecastAct, inCommittee, INSTITUTIONS, isClosedAct, LOCAL_VOTE_CHOICES, localAreas, majorityMargin, mandateRecord, measureOf, actorOf, delegaScore, nextEuropeanRole, typeOfAct, voteRule, weakCityAreas, withEuropeanSeat, withLocalState } from '../core/local-engine.js?v=20261027-3';
import { ACT_TYPES, CITY_INDICATORS, PROVINCE_INDICATORS, QUORUMS, actTypeOf, neededYes, proposableTypes } from '../data/simulation/local-acts.js?v=20261027-3';
import { COFIN_TERMS, WORK_PRIORITIES, WORK_RULES, WORK_SITE_LIST, WORK_TYPES, siteLabel, workTypesFor } from '../data/simulation/local-works.js?v=20261027-3';
import { activeWorks, agedUpkeepOf, archiveOf, canManageWorks, cofinPartners, euroOf, externalOf, isActiveWork, planWork, workGap, workView, worksLedger } from '../core/local-works-engine.js?v=20261027-3';
import { INDICATORS } from '../data/simulation/society-rules.js?v=20261027-3';
import { DELEGA_RULES } from '../data/simulation/office-rules.js?v=20261027-3';
import { AREA_BY_ID } from '../data/simulation/policy-rules.js?v=20261027-3';
import { esc, meter, num, signed } from './charts.js?v=20261027-3';
import { glyph, territoryTile, territoryVisual } from './visuals.js?v=20261027-3';
import { fallbackTones, forceColorResolver, hemicycleLayout, seatColor } from '../core/hemicycle.js?v=20261027-3';
import { SEAT_ROLES, rosterSeats } from '../core/seat-roster.js?v=20261027-3';

const STAGES = Object.freeze({ commissione: 'In commissione', giunta: 'In Giunta', aula: 'In aula', osservazioni: 'Osservazioni dei cittadini', 'seconda-lettura': 'Attesa della seconda deliberazione', risposta: 'In attesa di risposta', approvato: 'Approvato', respinto: 'Respinto', ritirato: 'Ritirato', risposto: 'Risposta data' });
const SIDE_LABELS = Object.freeze({ maggioranza: 'Maggioranza', opposizione: 'Opposizione' });
const ROLE_LABELS = Object.freeze({ sindaco: 'Sindaco', presidente: 'Presidente della Regione', eurodeputato: 'Deputato al Parlamento europeo' });
const TAX_LEVELS = Object.freeze({ bassa: 'Bassa', media: 'Media', alta: 'Alta' });
const date = value => value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const percent = value => `${Math.round((value ?? 0) * 100)}%`;
const ROLE_NAMES = Object.freeze({ coordinatore: 'Coordinatore del gruppo', vicepresidente: 'Vicepresidente', presidente: 'Presidente' });
const sideOfAct = (inst, act) => act.sponsor.kind === 'executive' || act.sponsor.kind === 'budget' ? 'governo' : inst.groups.find(group => group.id === act.sponsor.groupId)?.side === 'maggioranza' ? 'maggioranza' : 'opposizione';
const indicatorLabel = (inst, id) => (inst.kind === 'comune' ? CITY_INDICATORS : inst.kind === 'provincia' ? PROVINCE_INDICATORS : INDICATORS).find(item => item.id === id)?.label ?? id;
// A reading of the margin points in euros (the margin is a simulated measure: the euros only say how big the work is for this level).
const euro = (inst, points) => { const value = euroOf(inst, points); return value >= 1e6 ? `${(value / 1e6).toFixed(1).replace('.', ',')} milioni di €` : `${Math.round(value / 1000)} mila €`; };
const pts = value => num(value, 1);
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
// The seats of a council (or of the European Parliament) as dots, one per person, in the colour of the force each belongs to (the groups no force stands for take the colours the
// forces leave); a dot opens the card of the person on that seat. Ordered from left to right by the collocazione of the groups, the player in the middle of his group's wedge.
function seatDots(inst, state, ui) {
  const seats = rosterSeats(inst.roster);
  if (!seats.length) return '';
  const forceColor = forceColorResolver(state.world);
  const people = new Map((state.dataset?.politicians ?? []).map(item => [item.id, item]));
  const groups = [...inst.groups].sort((a, b) => (a.axis ?? 0) - (b.axis ?? 0) || String(a.id).localeCompare(String(b.id)));
  const byGroup = new Map(groups.map(group => [group.id, group]));
  const used = [...new Set(seats.map(seat => seat.partyId ? forceColor(seat.partyId) : null).filter(Boolean))];
  const tones = fallbackTones(groups.filter(group => !group.partyId || !forceColor(group.partyId)).map(group => ({ id: group.id, seats: group.seats })), used);
  const colorOf = seat => seatColor(seat, { forceColor, groupColor: tones.get(seat.groupId) });
  const ordered = groups.flatMap(group => { const own = seats.filter(seat => seat.groupId === group.id); const mine = own.findIndex(seat => seat.origin === 'player'); if (mine >= 0) { const [seat] = own.splice(mine, 1); own.splice(Math.floor(own.length / 2), 0, seat); } return own; });
  const layout = hemicycleLayout(ordered.length, { width: 1000 });
  const radius = Math.min(layout.radius, 20);
  const pad = Math.ceil(radius);
  const labelOf = seat => seat.origin === 'player' ? 'Il tuo seggio' : people.get(seat.personId)?.displayName ?? 'Seggio';
  const key = seat => `${inst.id}|${seat.personId}`;
  const circles = ordered.map((seat, index) => `<circle class="hemi-seat${seat.origin === 'player' ? ' is-player' : ''}${ui.localSeat === key(seat) ? ' is-selected' : ''}" cx="${layout.seats[index].x}" cy="${layout.seats[index].y}" r="${radius.toFixed(1)}" fill="${colorOf(seat)}" data-local-seat="${esc(key(seat))}"><title>${esc(labelOf(seat))} · ${esc(byGroup.get(seat.groupId)?.label ?? '')}</title></circle>`).join('');
  const forceName = id => state.world?.parties?.find(item => item.id === id || item.mergedFrom?.includes(id))?.label ?? null;
  const entries = new Map();
  for (const seat of ordered) { const id = seat.partyId ?? `gruppo:${seat.groupId}`; const entry = entries.get(id) ?? { color: colorOf(seat), count: 0, label: seat.partyId ? forceName(seat.partyId) ?? byGroup.get(seat.groupId)?.label : byGroup.get(seat.groupId)?.label }; entry.count++; entries.set(id, entry); }
  const legend = [...entries.values()].sort((a, b) => b.count - a.count).map(entry => `<li><i style="background:${esc(entry.color)}"></i><span>${esc(entry.label ?? '—')}</span><b>${entry.count}</b></li>`).join('');
  const picked = ordered.find(seat => key(seat) === ui.localSeat) ?? null;
  const card = picked ? (() => {
    const person = people.get(picked.personId);
    const group = byGroup.get(picked.groupId);
    const force = picked.partyId ? forceName(picked.partyId) : null;
    const leads = picked.leader || (picked.origin === 'player' && inst.executive?.leader === 'player');
    return `<div class="local-seat-card"><span class="section-kicker">${esc(picked.origin === 'player' ? 'IL TUO SEGGIO · SIMULAZIONE' : `${(SEAT_ROLES[inst.kind] ?? 'Eletto').toUpperCase()} · PERSONA DELLA SIMULAZIONE`)}</span><strong>${esc(picked.origin === 'player' ? person?.displayName ?? 'Il tuo politico' : person?.displayName ?? 'Seggio')}</strong>
      <p class="hemi-badges"><span class="sx-badge tone-${picked.origin === 'player' ? 'good' : 'warn'}">${picked.origin === 'player' ? 'TU' : 'SIMULATO'}</span></p>
      <dl class="hq-facts"><div><dt>Identificativo</dt><dd><code>${esc(picked.personId)}</code><small>sempre lo stesso per tutto il mandato</small></dd></div><div><dt>Gruppo</dt><dd>${esc(group?.label ?? '—')} · ${esc(SIDE_LABELS[group?.side] ?? '')}</dd></div><div><dt>Partito</dt><dd>${force ? esc(force) : inst.kind === 'europa' ? 'Delegazione di un altro Paese: il suo partito non è tra le forze del gioco' : 'Nessuna forza: lista civica o territoriale'}</dd></div>${leads ? `<div><dt>Incarico</dt><dd>${esc(INSTITUTIONS[inst.kind]?.leader ?? 'Guida l’esecutivo')}</dd></div>` : ''}<div><dt>Eletto</dt><dd>${esc(inst.name)} · dal ${esc(date(inst.roster?.date ?? inst.since))}${inst.region ? ` · ${esc(inst.region)}` : ''}</dd></div>${(person?.terms ?? []).length ? `<div><dt>Mandati precedenti</dt><dd>${person.terms.map(term => `${esc(term.assembly)} · ${esc(date(term.since))} – ${esc(date(term.until))}`).join('<br>')}</dd></div>` : ''}</dl></div>`;
  })() : '<p class="local-seat-hint">Tocca un punto per vedere chi siede in quel seggio.</p>';
  // The members as a searchable list (the same seats as the dots; also the alternative to the drawing for the keyboard and the screen readers). A council shows all its members; the European
  // Parliament its Italian delegation and the player, and any of the 720 seats once a search is typed. A row selects the seat (card and highlighted dot), the card's seat is marked in the list.
  const plain = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const tokens = plain(ui.localQuery).split(/\s+/).filter(Boolean);
  const textOf = seat => plain([labelOf(seat), seat.personId, byGroup.get(seat.groupId)?.label, seat.partyId ? forceName(seat.partyId) : ''].join(' '));
  const base = ordered.filter(seat => tokens.length || inst.kind !== 'europa' || seat.partyId || seat.origin === 'player');
  const listed = tokens.length ? base.filter(seat => tokens.every(token => textOf(seat).includes(token))) : base;
  const LIST_MAX = 60;
  const shown = listed.slice(0, LIST_MAX);
  const row = seat => `<li><button type="button" class="${ui.localSeat === key(seat) ? 'active' : ''}" data-local-seat="${esc(key(seat))}" aria-pressed="${ui.localSeat === key(seat)}"><i style="background:${esc(colorOf(seat))}"></i><span><strong>${esc(labelOf(seat))}</strong><small>${esc(byGroup.get(seat.groupId)?.label ?? '')}${seat.partyId && forceName(seat.partyId) ? ` · ${esc(forceName(seat.partyId))}` : ''}</small></span><span class="sx-badge tone-${seat.origin === 'player' ? 'good' : 'warn'}">${seat.origin === 'player' ? 'Tu' : 'Simulato'}</span></button></li>`;
  const pickedListed = picked && !shown.some(seat => key(seat) === ui.localSeat) && listed.some(seat => key(seat) === ui.localSeat) ? picked : null;
  const searchable = ordered.length > 0;
  const list = searchable ? `<details class="local-roster-list" data-remember="local-roster-${esc(inst.kind)}"><summary>${inst.kind === 'europa' ? 'Delegazione italiana e ricerca' : 'Elenco degli eletti'} (${base.length === ordered.length ? ordered.length : `${listed.length} di ${ordered.length}`})</summary>
    <label class="local-roster-search">Cerca per nome, gruppo o partito<input type="search" data-local-search value="${esc(ui.localQuery ?? '')}" placeholder="Nome, gruppo o partito" autocomplete="off" maxlength="60" /></label>
    ${listed.length ? `<ul class="hemi-members hemi-roster-list">${shown.map(row).join('')}${pickedListed ? row(pickedListed) : ''}</ul>${listed.length > LIST_MAX ? `<p class="poll-footnote">Primi ${LIST_MAX} di ${listed.length}: restringi la ricerca per gli altri.</p>` : ''}` : '<p class="poll-footnote">Nessun seggio corrisponde alla ricerca.</p>'}</details>` : '';
  return `<div class="local-hemi"><svg class="hemi-svg" viewBox="${-pad} ${-pad} ${layout.width + 2 * pad} ${Math.round(layout.height) + 2 * pad}" role="img" aria-label="${esc(`${inst.name}: ${ordered.length} seggi, uno per persona; ${[...entries.values()].map(entry => `${entry.label} ${entry.count}`).join(', ')}`)}"><g class="hemi-seats">${circles}</g></svg><ul class="local-legend">${legend}</ul>${card}${list}</div>`;
}
function composition(inst, state = {}, ui = {}) {
  const total = inst.seats || 1;
  const bar = [...inst.groups].sort((a, b) => (a.side === b.side ? b.seats - a.seats : a.side === 'maggioranza' ? -1 : 1)).map(group => `<i class="side-${esc(group.side)}${group.id === inst.playerGroupId ? ' own' : ''}" style="width:${(group.seats / total * 100).toFixed(2)}%" title="${esc(group.label)}: ${group.seats} seggi"></i>`).join('');
  const rows = inst.groups.map(group => `<li class="${group.id === inst.playerGroupId ? 'own' : ''}"><span class="local-dot side-${esc(group.side)}"></span><strong>${esc(group.label)}</strong><small>${esc(SIDE_LABELS[group.side] ?? group.side)}${group.id === inst.playerGroupId ? ' · il tuo gruppo' : ''}</small><b>${group.seats}</b><span class="local-cohesion" title="Coesione del gruppo">${meter(group.cohesion, group.cohesion < 45 ? 'danger' : '')}</span></li>`).join('');
  const margin = majorityMargin(inst);
  const needed = Math.floor(inst.seats / 2) + 1;
  return `<div class="local-seats" role="img" aria-label="Composizione: ${inst.groups.map(group => `${group.label} ${group.seats}`).join(', ')}">${bar}</div>${seatDots(inst, state, ui)}<p class="local-margin">${inst.seats} seggi · maggioranza politica: ${needed + margin} seggi, ne servono ${needed} per governare${margin < 0 ? ' · <b class="bad">senza numeri: rischio sfiducia</b>' : margin === 0 ? ' · <b class="bad">nessun margine</b>' : ''}</p><ul class="local-groups">${rows}</ul>`;
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
function executivePanel(inst, { withBudget = false } = {}) {
  const rules = INSTITUTIONS[inst.kind];
  if (!inst.executive) return `<p class="parliament-note">Nel Parlamento europeo l’iniziativa spetta alla ${esc(rules.executive)}: i gruppi politici costruiscono maggioranze diverse su ogni dossier. Gruppi e seggi di partenza: sessione costitutiva del 2024 (<a href="${esc(EP_GROUPS_2024.sourceUrl)}" target="_blank" rel="noopener">${esc(EP_GROUPS_2024.sourceName)}</a>, dato reale); da lì in poi voti e maggioranze sono simulati.</p>`;
  const leads = inst.executive.leader === 'player';
  const majority = inst.groups.filter(group => group.side === 'maggioranza');
  const members = inst.executive.members.map(item => `<li><span>${esc(item.portfolio)}</span><small>${esc(inst.groups.find(group => group.id === item.groupId)?.label ?? 'lista civica')}</small></li>`).join('');
  const reshuffle = leads && majority.length > 1 ? `<form class="local-inline-form" data-local-reshuffle-form data-inst-id="${esc(inst.id)}"><label>Assessorato<select name="portfolio">${inst.executive.members.map(item => `<option value="${esc(item.portfolio)}">${esc(item.portfolio)}</option>`).join('')}</select></label><label>Al gruppo<select name="group">${majority.map(group => `<option value="${esc(group.id)}">${esc(group.label)}</option>`).join('')}</select></label><button class="secondary-button" type="submit">Rimpasto · 1 giorno</button></form><p class="poll-footnote">Chi riceve l’assessorato diventa più leale, chi lo perde meno: una maggioranza trascurata può uscire e sfiduciarti.</p>` : '';
  const budget = withBudget && inst.budget ? `<div><dt>Bilancio</dt><dd>Margine ${num(inst.budget.margin, 0)}/100 · pressione fiscale ${esc(inst.budget.localTax)} · ${inst.budget.provisional ? '<b class="bad">esercizio provvisorio</b>' : `bilancio approvato per il ${inst.budget.approvedYear}`}</dd></div>` : '';
  return `<dl class="hq-facts"><div><dt>${esc(rules.leader)}</dt><dd>${esc(inst.executive.label)}</dd></div><div><dt>Stabilità</dt><dd>${num(inst.executive.stability, 0)}/100 ${meter(inst.executive.stability, inst.executive.stability < 40 ? 'danger' : '')}</dd></div><div><dt>Pressione dell’opposizione</dt><dd>${num(inst.pressure, 0)}/100 ${meter(inst.pressure, inst.pressure > 65 ? 'danger' : '')}</dd></div>${budget}</dl><details class="local-giunta"><summary>${esc(rules.executive)}: ${inst.executive.members.length} assessori (figure simulate)</summary><ul>${members}</ul></details>${reshuffle}`;
}
// The budget of the institution: the margin (a simulated measure, in points), what the works have reserved and drawn, the upkeep they ask every year, the taxes; the euros are a reading of the points.
function budgetPanel(inst) {
  if (!inst.budget) return '<p class="quiet-copy">Il Parlamento europeo non ha un bilancio locale: i suoi dossier sono atti e voti.</p>';
  const leads = inst.executive?.leader === 'player';
  const ledger = worksLedger(inst);
  const taxPending = inst.acts.some(act => act.category === 'tributi' && !isClosedAct(act));
  const tax = leads && actTypeOf(inst.kind, 'tributi') ? `<div class="local-tax"><span>Pressione fiscale locale</span><div class="bill-vote-choices" role="group" aria-label="Pressione fiscale locale">${Object.entries(TAX_LEVELS).map(([id, label]) => `<button type="button" class="chip-button${inst.budget.localTax === id ? ' active' : ''}" data-local-tax="${id}" data-inst-id="${esc(inst.id)}" aria-pressed="${inst.budget.localTax === id}"${taxPending || inst.budget.localTax === id ? ' disabled' : ''}>${label}</button>`).join('')}</div><small>${taxPending ? 'La proposta sulle aliquote è in consiglio: aspetta il voto.' : 'Proponi al consiglio le nuove aliquote (un livello alla volta): più entrate allargano il margine del bilancio ma costano popolarità; meno tasse il contrario.'}</small></div>` : '';
  const rows = [
    ['Margine di bilancio', `${num(inst.budget.margin, 0)}/100 ${meter(inst.budget.margin, inst.budget.margin < 20 ? 'danger' : '')}`],
    ['Bilancio', inst.budget.provisional ? '<b class="bad">esercizio provvisorio</b>: nessuna nuova opera finché non passa il bilancio' : `approvato per il ${inst.budget.approvedYear}${inst.budget.failures ? ` · ${inst.budget.failures} voto/i fallito/i` : ''}`],
    ['Pressione fiscale', esc(TAX_LEVELS[inst.budget.localTax] ?? inst.budget.localTax)]
  ];
  if (inst.kind !== 'europa') rows.push(
    ['Cantieri aperti', `${ledger.open} su ${ledger.max}`],
    ['Impegni ancora da pagare', `${pts(ledger.residual)} punti · circa ${euro(inst, ledger.residual)}`],
    ['Speso e impegnato sulle opere', `${pts(ledger.drawn)} punti · circa ${euro(inst, ledger.drawn)}`],
    ['Manutenzione ogni anno', `${pts(ledger.upkeepYear)} punti · circa ${euro(inst, ledger.upkeepYear)}`]);
  return `<dl class="hq-facts">${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`).join('')}</dl>${tax}<p class="poll-footnote">Il margine è una misura simulata (0-100), non un saldo in euro: un’opera ne impegna una parte quando è approvata (${Math.round(WORK_RULES.commit * 100)}% del preventivo), paga il resto mentre i lavori avanzano e poi chiede manutenzione. Ogni costo esce dal margine una volta sola. Un punto vale circa ${euro(inst, 1)} per ${esc(INSTITUTIONS[inst.kind].label.toLowerCase())} (lettura indicativa, simulazione).</p>`;
}
// The state of the territory the institution answers for: the city's services (comune) or the region's indicators
// (regione, those of the society simulation), with the effects of its approved acts still arriving; the commitments
// the council gave the executive with its motions.
function territoryPanel(inst, state) {
  if (inst.kind === 'europa') return '';
  let rows;
  if (inst.kind === 'comune' || inst.kind === 'provincia') {
    const list = inst.kind === 'comune' ? CITY_INDICATORS : PROVINCE_INDICATORS;
    rows = list.map(item => {
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
  const list = rows.map(row => `<div><dt>${esc(row.label)}</dt><dd>${num(row.value, 0)}/100 ${meter(row.value, row.value < 40 ? 'danger' : row.value < 55 ? 'warn' : row.value >= 65 ? 'good' : '')}${Math.abs(row.coming) >= 0.1 ? `<small>In arrivo ${signed(row.coming)} da ${esc(row.causes.slice(0, 2).join(', ') || 'atti approvati')}</small>` : ''}</dd></div>`).join('');
  // The priorities: the weakest services, with the work the level would build for each.
  const weakest = [...rows].sort((a, b) => a.value - b.value).slice(0, 3);
  const priorities = `<div class="local-commitments"><strong>Priorità del territorio</strong><ul>${weakest.map(row => `<li>${esc(row.label)}: ${num(row.value, 0)}/100${row.value < 45 ? ' · <b class="bad">in sofferenza</b>' : ''}</li>`).join('')}</ul></div>`;
  const commitments = (inst.commitments ?? []).filter(item => item.status === 'aperto').map(item => `<li>${esc(AREA_BY_ID[item.area]?.label ?? item.area)}: un atto entro il ${esc(date(item.dueAt))} <small>(${item.actId ? `mozione “${esc(item.title)}”` : esc(item.title)})</small></li>`).join('');
  const IMPLEMENTATION_TEXT = { 'in-attuazione': 'in attuazione', 'in-ritardo': 'in ritardo', attuato: 'attuata', inefficace: 'attuata ma inefficace', 'non-attuato': 'non attuata' };
  const measures = (inst.implementations ?? []).slice(-5).reverse().map(item => `<li>${esc(item.title)} <small>· ${esc(IMPLEMENTATION_TEXT[item.status] ?? item.status)}${['in-attuazione', 'in-ritardo'].includes(item.status) ? ` · avvio previsto il ${esc(date(item.startsAt))}` : item.efficacy != null && item.status !== 'non-attuato' ? ` · efficacia ${Math.round(item.efficacy * 100)}%` : ''}</small></li>`).join('');
  return `<dl class="hq-facts local-territory">${list}</dl>${priorities}${measures ? `<div class="local-commitments"><strong>Misure approvate e loro attuazione</strong><ul>${measures}</ul><small>Il voto non cambia i servizi: lo fa la misura quando viene attuata.</small></div>` : ''}${commitments ? `<div class="local-commitments"><strong>Impegni presi</strong><ul>${commitments}</ul></div>` : ''}<p class="poll-footnote">${inst.kind === 'comune' ? 'Servizi della città (simulazione): li muovono gli atti approvati e le opere finite, senza cura si consumano; una parte degli effetti arriva agli indicatori della regione.' : inst.kind === 'provincia' ? 'Servizi propri della Provincia (strade, scuole superiori, trasporto, ambiente, sviluppo, comuni): non sono la media della regione; le opere finite e gli atti li muovono e una quota arriva alla regione.' : 'Indicatori della regione nella simulazione del Paese: gli atti e le opere finite li muovono settimana dopo settimana.'}</p>`;
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
  const withdraw = open && !question && act.kind === 'player' && act.category !== 'interrogazione' ? `<div class="bill-speak"><button type="button" class="text-link" data-local-withdraw data-inst-id="${esc(inst.id)}" data-act-id="${esc(act.id)}">Ritira l’atto</button></div>` : '';
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
  return `<article class="law-card bill-card local-act stage-${esc(act.stage)} side-${esc(side)}"><div class="law-card-title"><span class="section-kicker">${esc(String(act.label ?? '').toUpperCase())} · ${esc(String(AREA_BY_ID[act.area]?.label ?? act.area).toUpperCase())}</span><h3>${esc(act.title)}</h3><span class="bill-sponsor"><b class="sponsor-${esc(side)}">${esc(side === 'governo' ? INSTITUTIONS[inst.kind].executive : side === 'maggioranza' ? 'Maggioranza' : 'Opposizione')}</b> ${side === 'governo' ? '' : esc(act.sponsor.label ?? '')}</span></div><div class="bill-meta"><span class="bill-flag ${act.stage === 'approvato' ? 'good' : act.stage === 'respinto' ? 'bad' : ''}">${esc(STAGES[act.stage] ?? act.stage)}</span>${when}${flags}</div>${dossierLine(inst, act)}${how}${measure}${warning}${forecastBox}${open && (vote || concede || withdraw || dossierActions(inst, act, context)) ? `<div class="bill-actions">${dossierActions(inst, act, context)}${concede}${vote}${withdraw}</div>` : ''}${giuntaNote}${result}${type && inst.kind !== 'europa' ? actExplain(inst, act, type) : ''}</article>`;
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
  const capacity = actCapacity(inst);
  const pending = capacity.free <= 0;
  const areas = (delegated ? inst.playerDelega.areas : localAreas(inst.kind)).filter(id => AREA_BY_ID[id]);
  const areaOptions = areas.map(id => `<option value="${esc(id)}">${esc(AREA_BY_ID[id].label)}</option>`).join('');
  // The kinds the office can propose (taxes have their own buttons, questions their own form); variants as options.
  const kinds = inst.kind === 'europa' ? [] : proposableTypes(inst.kind, leads || delegated).filter(type => !['interrogazione', 'tributi', 'opere'].includes(type.id) && !(delegated && DELEGA_FORBIDDEN.has(type.id)));
  const money = type => type.cost > 0 ? ` · costo ${num(type.cost, 1)}` : type.revenue ? ` · entrate ${num(type.revenue, 1)}` : type.cost < 0 ? ` · risparmio ${num(-type.cost, 1)}` : '';
  const kindOptions = kinds.flatMap(type => (type.variants ?? [null]).map(variant => `<option value="${esc(variant ? `${type.id}|${variant}` : type.id)}">${esc(type.label)}${variant ? `: ${esc(variant)}` : ''}${type.areas ? ` (${esc(type.areas.map(id => AREA_BY_ID[id]?.label.toLowerCase() ?? id).join(', '))})` : ''}${esc(money(type))}</option>`)).join('');
  const kindSelect = kinds.length ? `<label>Tipo di atto<select name="category"><option value="">Quello adatto al tema</option>${kindOptions}</select></label>` : '';
  const propose = `<form class="local-inline-form" data-local-propose-form data-inst-id="${esc(inst.id)}">${kindSelect}<label>${esc(inst.kind === 'europa' ? rules.acts.player : 'Tema')}<select name="area">${areaOptions}</select></label><button class="primary-button" type="submit"${pending ? ' disabled' : ''}>Presenta · 1 giorno</button></form><p class="poll-footnote" data-act-capacity>Atti in corso: <b>${capacity.open} su ${capacity.max}</b> (${esc(capacity.rule)}).${pending ? ' Per presentarne un altro aspetta un voto o ritira un atto.' : ''}</p>${pending ? '' : `<p class="poll-footnote">${leads ? `Gli atti della Giunta li adotta la Giunta, gli altri vanno in consiglio con la maggioranza richiesta; puoi fare concessioni ai gruppi incerti. Un atto che spende più del margine (${num(inst.budget?.margin ?? 0, 0)}) viene ritirato per mancanza di copertura.` : inst.kind === 'europa' ? 'Ne sei relatore: prima il voto nella commissione competente, poi la plenaria; servono voti anche fuori dal tuo gruppo.' : inst.playerSide === 'maggioranza' ? 'Dalla maggioranza ha buone probabilità se la giunta la sostiene: le mozioni approvate impegnano la giunta.' : 'Dall’opposizione passa solo se convinci qualcuno della maggioranza: scegli un tema che sentono anche loro.'}</p>`}`;
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
// ---------- the public works ----------
const euroText = value => value >= 1e6 ? `${num(value / 1e6, 1)} milioni €` : `${Math.round(value / 1000)} mila €`;
const WORK_STATE_TEXT = Object.freeze({ autorizzazioni: 'In attesa delle autorizzazioni', progettazione: 'In progettazione', gara: 'In gara d’appalto', cantiere: 'Cantiere aperto', collaudo: 'In collaudo', completato: 'Aperta', sospeso: 'Sospesa' });
function workProblemsText(work) {
  const out = [];
  if (work.pending) out.push(`sforamento di ${pts(work.pending.amount)} punti in attesa di una decisione`);
  if (work.fundsAlert) out.push('ferma: manca il margine di bilancio');
  if (work.delayWeeks >= 3) out.push(`${work.delayWeeks} settimane di ritardo`);
  if (work.stall > 0 && !work.fundsAlert && !work.pending) out.push('cantiere fermo per qualche settimana');
  if (work.boost > 0) out.push(`accelerata per ${work.boost} settimane`);
  return out;
}
function workCard(inst, input, leads, partners = []) {
  const work = workView(inst, input);
  const type = work.type;
  const problems = workProblemsText(work);
  const goal = work.goal?.indicator ? `Obiettivo: ${esc(indicatorLabel(inst, work.goal.indicator).toLowerCase())} da ${num(work.goal.from, 0)} a ${num(work.goal.to, 0)}` : `Obiettivo: più servizio nel settore ${esc(AREA_BY_ID[work.area]?.label.toLowerCase() ?? work.area)}`;
  const site = siteLabel(work.site, inst.kind);
  const place = work.territory?.name ?? inst.name;
  const open = isActiveWork(work);
  const money = `Preventivo ${pts(work.budget0 ?? work.cost)} punti (circa ${euro(inst, work.budget0 ?? work.cost)})${Math.abs(work.cost - (work.budget0 ?? work.cost)) >= 0.1 ? ` · oggi ${pts(work.cost)}` : ''} · impegnati ${pts(work.drawn)} · lavori fatti per ${pts(work.spent)}`;
  const result = work.result ? `<p class="local-measure"><b>Risultato:</b> qualità ${Math.round(work.result.quality * 100)}/100 · costo finale ${pts(work.result.finalCost)} contro ${pts(work.result.budget)} previsti · ${work.result.late ? `${work.result.late} settimane di ritardo` : 'nei tempi'} · condizione ${Math.round(work.condition)}/100${work.degraded ? ' · <b class="bad">si sta degradando</b>' : ''}. Manutenzione: ${pts(work.upkeepYear)} punti l’anno.</p>` : '';
  const fund = ['autorizzazioni', 'progettazione', 'gara'].includes(work.stage) ? `<form class="local-inline-form" data-work-funding-form data-inst-id="${esc(inst.id)}" data-work-id="${esc(work.id)}"><label>Livello di fondi<select name="funding">${WORK_PRIORITIES.map(item => `<option value="${item.funding}"${item.funding === work.funding ? ' selected' : ''}>${esc(item.label)} · ${item.funding}%</option>`).join('')}</select></label><button class="secondary-button" type="submit">Modifica il progetto · 1 giorno</button></form>` : '';
  const agreements = (work.cofin ?? []).map(item => `<li><b>${esc(item.name)}</b> · ${Math.round(item.share * 100)}% del costo (${esc(euroText(item.euro))}) · ${esc({ richiesto: 'in attesa della decisione dell’ente', erogato: 'versato', rifiutato: 'rifiutato', decaduto: 'decaduto' }[item.status] ?? item.status)}${item.reason ? ` (${esc(item.reason)})` : ''}</li>`).join('');
  const askForm = leads && partners.length && ['autorizzazioni', 'progettazione', 'gara'].includes(work.stage)
    ? `<form class="local-inline-form" data-work-cofin-form data-inst-id="${esc(inst.id)}" data-work-id="${esc(work.id)}"><label>Cofinanzia<select name="partner">${partners.map(item => `<option value="${esc(item.id)}">${esc(item.name)} · ${esc(INSTITUTIONS[item.kind].label)}</option>`).join('')}</select></label><label>Quota<select name="share">${[0.1, 0.2, 0.3, 0.4, 0.5].map(share => `<option value="${share}"${share === 0.3 ? ' selected' : ''}>${Math.round(share * 100)}% · circa ${esc(euro(inst, work.cost * share))}</option>`).join('')}</select></label><button class="secondary-button" type="submit">Chiedi il cofinanziamento · 1 giorno · 1 cap.</button></form><p class="poll-footnote">${esc(partners.map(item => `${item.name}: 1 punto del suo margine = ${euroText(WORK_RULES.euroPerPoint[item.kind])}, margine ${num(item.budget.margin, 1)}`).join(' · '))}. La quota è in euro simulati e si converte nei punti di ciascun ente; la decide l’organo competente dell’altro ente.</p>` : '';
  const received = externalOf(work);
  const buttons = leads ? `<div class="project-actions">${open ? `<button class="secondary-button" data-work-action="fund" data-inst-id="${esc(inst.id)}" data-work-id="${esc(work.id)}">Rifinanzia · 1 giorno · 1 cap.</button>${work.stage !== 'collaudo' ? `<button class="secondary-button" data-work-action="resize" data-inst-id="${esc(inst.id)}" data-work-id="${esc(work.id)}">Ridimensiona · 1 giorno · 1 cap.</button>` : ''}<button class="secondary-button danger-link" data-work-action="suspend" data-inst-id="${esc(inst.id)}" data-work-id="${esc(work.id)}">Sospendi · 1 giorno · 1 cap.</button>` : work.stage === 'sospeso' ? `<button class="secondary-button" data-work-action="resume" data-inst-id="${esc(inst.id)}" data-work-id="${esc(work.id)}">Riapri il cantiere · 1 giorno · 2 cap.</button>` : work.stage === 'completato' ? `<button class="secondary-button" data-work-action="upkeep" data-inst-id="${esc(inst.id)}" data-work-id="${esc(work.id)}">Paga la manutenzione · 1 giorno</button>` : ''}</div>` : '';
  return `<article class="project-row work-row stage-${esc(work.stage)}${work.stage === 'completato' ? ' completato' : work.stage === 'sospeso' ? ' sospeso' : ''}"><div class="project-head">${glyph(type?.icon ?? 'bridge', 20)}<div><strong>${esc(work.label)}</strong><small>${esc(place)}${site ? ` · ${esc(site)}` : ''} · ${esc(WORK_STATE_TEXT[work.stage] ?? work.stageLabel)}${work.byPlayer ? ' · tua proposta' : ''}</small></div><span class="badge">${Math.round(work.progress)}%</span></div>
    <div class="project-progress">${meter(work.progress, problems.length && open ? 'danger' : '')}<small>${open ? `Ancora circa ${work.weeksLeft} settimane · ` : ''}${esc(money)}</small></div><p class="poll-footnote">${goal}${problems.length ? ` · <b class="bad">${esc(problems.join(' · '))}</b>` : ''}</p>${result}${agreements ? `<ul class="local-commitments">${agreements}</ul><p class="poll-footnote">${esc(COFIN_TERMS['quota-fissa'].owner)} ${esc(COFIN_TERMS['quota-fissa'].partner)}</p>` : ''}${received ? `<p class="poll-footnote">Contributi ricevuti: ${pts(received)} punti (circa ${euro(inst, received)}), già detratti da ciò che paga il tuo bilancio. Sovracosti e manutenzione restano a carico di chi costruisce.</p>` : ''}${fund}${askForm}${buttons}</article>`;
}
function worksSection(inst, state) {
  if (inst.kind === 'europa') return '<p class="quiet-copy">Il Parlamento europeo non costruisce opere locali.</p>';
  const actor = actorOf(inst);
  const leads = canManageWorks(inst);
  const delegated = actor === 'assessore' || actor === 'delegato';
  const ledger = worksLedger(inst);
  const works = (inst.works ?? []);
  const others = (state?.local?.institutions ?? []).filter(item => item.status === 'active');
  const partnersOf = work => leads ? cofinPartners(inst, work, others) : [];
  const open = works.filter(item => isActiveWork(item));
  const suspended = works.filter(item => item.stage === 'sospeso');
  const done = works.filter(item => item.stage === 'completato').slice(-6).reverse();
  const waiting = inst.acts.filter(act => act.category === 'opere' && !isClosedAct(act));
  const types = (delegated ? workTypesFor(inst.kind).filter(type => (inst.playerDelega?.areas ?? []).includes(type.area)) : workTypesFor(inst.kind));
  const gapOf = type => { try { return workGap(inst, planWork(inst, { typeId: type.id }).commit); } catch (error) { return error.message; } };
  const typeOptions = types.map(type => `<option value="${esc(type.id)}">${esc(type.label)} · ${esc(AREA_BY_ID[type.area]?.label ?? type.area)} · circa ${pts(type.cost)} punti (${esc(euro(inst, type.cost))})</option>`).join('');
  const blocker = !types.length ? 'La tua delega non comprende opere in catalogo.' : (gapOf(types[0]) ?? '');
  const capacity = actCapacity(inst);
  const pending = capacity.free <= 0;
  const propose = leads || delegated
    ? `<form class="local-inline-form" data-local-work-form data-inst-id="${esc(inst.id)}"><label>Opera<select name="type">${typeOptions}</select></label><label>Priorità<select name="funding">${WORK_PRIORITIES.map(item => `<option value="${item.funding}"${item.funding === 100 ? ' selected' : ''}>${esc(item.label)} · ${item.funding}%</option>`).join('')}</select></label><label>Dove<select name="site">${WORK_SITE_LIST.map(item => `<option value="${esc(item.id)}"${item.id === 'periferia' ? ' selected' : ''}>${esc(siteLabel(item.id, inst.kind))}</option>`).join('')}</select></label><button class="primary-button" type="submit"${pending || !types.length ? ' disabled' : ''}>Proponi l’opera · 1 giorno</button></form>
      <p class="poll-footnote">${pending ? `Stai seguendo ${capacity.open} atti su ${capacity.max} (${esc(capacity.rule)}): aspetta un voto o ritira un atto.` : esc(blocker || (leads ? 'La proposta va al voto dell’organo competente: se passa, l’opera riserva il 40% del costo e parte con le autorizzazioni. I benefici arrivano a opera finita.' : 'La tua delega propone l’opera; la decide il consiglio, la gestisce chi guida l’esecutivo.'))}</p>`
    : `<p class="parliament-note">Non guidi l’esecutivo: non spendi il bilancio e non decidi sui cantieri. Puoi impegnare la giunta con una mozione su un servizio in sofferenza o ispezionare i cantieri in ritardo (Attività).</p><div class="bill-speak">${weakCityAreas(inst, 3).map(area => `<button class="secondary-button" data-work-motion="${esc(area)}" data-inst-id="${esc(inst.id)}"${pending ? ' disabled' : ''}>Mozione su ${esc(AREA_BY_ID[area]?.label.toLowerCase() ?? area)} · 1 giorno</button>`).join('') || '<small>Gli indicatori della regione dicono dove intervenire: usa il tema nel form degli atti.</small>'}</div>`;
  const catalog = `<details class="bill-archive local-guide"><summary>Catalogo delle opere di competenza: ${workTypesFor(inst.kind).length} tipi</summary><ul>${workTypesFor(inst.kind).map(type => `<li><strong>${esc(type.label)}</strong> <small>${esc(AREA_BY_ID[type.area]?.label ?? type.area)} · circa ${pts(type.cost)} punti (${esc(euro(inst, type.cost))}) · ${type.weeks[0]}–${type.weeks[1]} settimane · manutenzione ${Math.round(type.upkeep * 100)}% l’anno</small><p>${esc(type.benefit)} ${esc(type.need)}</p></li>`).join('')}</ul><p class="poll-footnote">Ogni ente costruisce solo ciò che è di sua competenza: un Comune non costruisce un ospedale regionale. Cofinanziamenti: solo tra enti del tuo percorso (gli altri non hanno un bilancio nel gioco), per lo stesso territorio e prima che il cantiere apra; la quota è un contributo fisso in euro simulati, approvato dall’organo dell’ente che paga.</p></details>`;
  const record = ledger.record;
  const aged = archiveOf(inst);
  const agedLine = aged.length ? `<p class="poll-footnote">In archivio: ${aged.length} ${aged.length === 1 ? 'opera più vecchia' : 'opere più vecchie'} (costo finale ${pts(aged.reduce((sum, item) => sum + (item.result?.finalCost ?? item.cost), 0))} punti, manutenzione ${pts(agedUpkeepOf(aged))} punti l’anno): continuano a essere mantenute e a consumarsi, e i totali del mandato le comprendono.</p>` : '';
  const granted = (inst.cofin ?? []).slice(-6).reverse().map(item => `<li><b>${esc(item.ownerName)}</b>: «${esc(item.workTitle)}» · ${Math.round(item.share * 100)}% (${esc(euroText(item.euro))}, ${pts(item.partnerPts)} punti del tuo margine) · ${esc({ richiesto: 'in esame nel tuo organo', erogato: 'versato', rifiutato: 'rifiutato', decaduto: 'decaduto' }[item.status] ?? item.status)}${item.reason ? ` (${esc(item.reason)})` : ''}</li>`).join('');
  const grantedList = granted ? `<h4 class="news-subhead">Cofinanziamenti chiesti al tuo ente</h4><ul class="local-commitments">${granted}</ul>` : '';
  const summary = `<p class="local-margin">${ledger.open} cantieri aperti su ${ledger.max} · ${record.completed ?? 0} opere finite · ${record.suspended ?? 0} sospese · impegni residui ${pts(ledger.residual)} punti (circa ${euro(inst, ledger.residual)})${ledger.received ? ` · contributi ricevuti ${pts(ledger.received)} punti` : ''}</p>${agedLine}`;
  const waitingList = waiting.length ? `<h4 class="news-subhead">In approvazione</h4><ul class="local-commitments">${waiting.map(act => `<li>${esc(act.title)} <small>· ${esc(STAGES[act.stage] ?? act.stage)} · preventivo ${pts(act.workPlan?.cost ?? act.measure?.cost ?? 0)} punti, ${pts(act.workPlan?.commit ?? act.measure?.cost ?? 0)} da impegnare</small></li>`).join('')}</ul>` : '';
  return `${summary}${propose}${waitingList}${grantedList}<h4 class="news-subhead">Cantieri aperti (${open.length})</h4><div class="project-list">${open.map(item => workCard(inst, item, leads, partnersOf(item))).join('') || '<p class="quiet-copy">Nessun cantiere aperto: le opere nascono da atti approvati.</p>'}</div>${suspended.length ? `<h4 class="news-subhead">Sospese</h4><div class="project-list">${suspended.map(item => workCard(inst, item, leads)).join('')}</div>` : ''}${done.length ? `<h4 class="news-subhead">Concluse di recente</h4><div class="project-list">${done.map(item => workCard(inst, item, leads)).join('')}</div>` : ''}${catalog}`;
}
// The verdict of the term so far: how the executive stands, what the council kept, what the works say (on time, on budget, the waste, the upkeep) and what it means for the next vote.
function resultsSection(inst, state) {
  if (inst.kind === 'europa') return '';
  const record = mandateRecord(inst, { date: state.clock?.currentDate ?? null });
  const works = record.works;
  const lines = [
    ['Giudizio sull’amministrazione', `${signed(record.score)} su 100 (affidabilità ${Math.round(record.confidence * 100)}%)`],
    ['Cosa significa per te', `${signed(record.standing)} ${record.leads ? '(guidi tu: ne rispondi per intero)' : record.side === 'maggioranza' ? '(sei in maggioranza: ne rispondi in parte)' : '(sei all’opposizione: ti giovano gli insuccessi altrui)'}`],
    ['Impegni del consiglio', `${record.kept} rispettati · ${record.broken} disattesi`],
    ['Servizi del territorio', `${signed(record.servicesDelta)} dall’inizio del mandato`],
    ['Atti tuoi approvati', String(record.passed)],
    ['Opere avviate / finite / sospese', `${works.started} / ${works.completed} / ${works.suspended}`],
    ['Opere nei tempi', `${works.onTime} su ${works.completed}`],
    ['Qualità media delle opere', works.quality === null ? 'nessuna opera ancora finita' : `${Math.round(works.quality * 100)}/100`],
    ['Costo finale contro preventivo', works.completed ? `${pts(works.finalCost)} punti contro ${pts(works.completedBudget)} a preventivo (opere finite)` : '—'],
    ['Ritardi accumulati', `${works.delayWeeks} settimane · ${works.overruns} sforamenti · ${works.protests} proteste`],
    ['Manutenzione rinviata', `${works.upkeepMissed} volte`],
    ['Opere in archivio', works.archived ? `${works.archived} (continuano a essere mantenute)` : 'nessuna'],
    ['Cofinanziamenti', works.cofinReceived || works.cofinPaid ? `ricevuti ${pts(works.cofinReceived)} punti · versati ${pts(works.cofinPaid)} punti (ognuno nei punti del proprio bilancio)` : 'nessuno']
  ];
  return `<dl class="hq-facts">${lines.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><p class="poll-footnote">I benefici di un’opera finita sono già nei servizi del territorio (non si contano due volte): qui pesano il modo in cui è stata fatta (nei tempi e nei costi) e gli sprechi. Gli elettori ricordano le promesse mantenute e quelle no, i cantieri fermi e le opere aperte (simulazione).</p>`;
}

// ---------- the card of an institution: one mandate at a time, one section at a time ----------
const SECTION_IDS = Object.freeze([['panoramica', 'Panoramica'], ['bilancio', 'Bilancio'], ['opere', 'Opere e cantieri'], ['territorio', 'Servizi e territorio'], ['atti', 'Consiglio e Giunta'], ['cronologia', 'Cronologia e risultati']]);
const EUROPE_SECTIONS = Object.freeze([['panoramica', 'Panoramica'], ['atti', 'Dossier e voti'], ['cronologia', 'Cronologia']]);
// An icon and a colour (data-sec, in sections.css) for each section: the tabs are told apart at a glance, never by colour alone.
const SECTION_ICONS = Object.freeze({ panoramica: 'sections', bilancio: 'money', opere: 'factory', territorio: 'pin', atti: 'law', cronologia: 'clock' });
export const sectionsOf = inst => inst.kind === 'europa' ? EUROPE_SECTIONS : SECTION_IDS;
function institutionCard(input, capital, context, state, ui = {}) {
  const inst = withLocalState(withEuropeanSeat(input, input.since));
  const rules = INSTITUTIONS[inst.kind];
  const sections = sectionsOf(inst);
  const section = sections.some(([id]) => id === ui.localSection) ? ui.localSection : 'panoramica';
  const open = inst.acts.filter(act => !isClosedAct(act)).sort((a, b) => String(a.nextStepAt).localeCompare(String(b.nextStepAt)));
  const closed = inst.acts.filter(isClosedAct).slice(-4).reverse();
  const history = inst.history.slice(-12).reverse().map(item => `<li><time>${esc(date(item.date))}</time> ${esc(item.text)}</li>`).join('');
  const archive = [...closed.map(act => ({ title: act.title, stage: act.stage, closedAt: act.closedAt, vote: compactVote(act.votes?.at(-1)), committeeVote: act.votes?.length ? null : act.committeeVote ?? null, answer: act.answer ?? null, withdrawn: act.withdrawn ?? null, effects: measureText(inst, act) })), ...inst.archive.slice(-6).reverse()].slice(0, 10).map(item => `<li><span class="bill-flag ${item.stage === 'approvato' || item.answer === 'esauriente' ? 'good' : 'bad'}">${esc(STAGES[item.stage] ?? item.stage)}</span> ${esc(item.title)} <small>${esc(date(item.closedAt))}</small>${resultLine(item)}</li>`).join('');
  const badge = id => id === 'opere' ? activeWorks(inst).length : id === 'atti' ? open.length : 0;
  const tabs = `<nav class="sx-tabs local-tabs" role="tablist" aria-label="Sezioni di ${esc(inst.name)}">${sections.map(([id, label]) => `<button type="button" role="tab" id="tab-${esc(inst.id)}-${id}" class="sx-tab${section === id ? ' active' : ''}" data-sec="${id}" data-local-section="${id}" aria-selected="${section === id}" aria-controls="panel-${esc(inst.kind)}" tabindex="${section === id ? 0 : -1}">${glyph(SECTION_ICONS[id] ?? 'news', 15)}<span>${esc(label)}</span>${badge(id) ? ` <span class="badge">${badge(id)}</span>` : ''}</button>`).join('')}</nav>`;
  let body;
  if (section === 'bilancio') body = `<h3 class="local-h">Bilancio e impegni</h3>${budgetPanel(inst)}`;
  else if (section === 'opere') body = `<h3 class="local-h">Opere e cantieri</h3>${worksSection(inst, state)}`;
  else if (section === 'territorio') body = `<h3 class="local-h">${esc(inst.kind === 'comune' ? 'Stato della città' : inst.kind === 'provincia' ? 'Stato del territorio provinciale' : 'Stato della regione')}</h3>${territoryPanel(inst, state)}`;
  else if (section === 'atti') body = `<h3 class="local-h">Cosa puoi fare</h3>${roleBox(inst, state)}${actionsPanel(inst, capital)}<h3 class="local-h">In discussione (${open.length})</h3>${open.map(act => actCard(inst, act, capital, context)).join('') || '<p class="quiet-copy">Nessun atto in calendario: la giunta e i gruppi ne presentano di nuovi ogni settimana.</p>'}${archive ? `<details class="bill-archive"><summary>Atti conclusi</summary><ul>${archive}</ul></details>` : ''}${inst.kind !== 'europa' ? actsGuide(inst) : ''}`;
  else if (section === 'cronologia') body = `${inst.kind !== 'europa' ? `<h3 class="local-h">Risultati del mandato</h3>${resultsSection(inst, state)}` : ''}<h3 class="local-h">Cronaca del ${esc(rules.label.toLowerCase())}</h3>${history ? `<ul class="bill-journal">${history}</ul>` : '<p class="quiet-copy">La cronaca si riempie con le decisioni del consiglio.</p>'}`;
  else body = `<div class="local-grid"><div><h3 class="local-h">Composizione</h3>${composition(inst, state, ui)}</div><div><h3 class="local-h">${esc(inst.ep ? 'Le tue commissioni' : rules.executive)}</h3>${inst.ep ? europeanPanel(inst, context) : executivePanel(inst)}</div></div>${inst.ep ? `<h3 class="local-h">${esc(rules.executive)}</h3>${executivePanel(inst)}` : ''}<h3 class="local-h">Il tuo ruolo</h3>${roleBox(inst, state)}`;
  return `<section class="hq-panel local-institution" id="${esc(institutionAnchor(inst))}" data-institution-id="${esc(inst.id)}" style="--lv:${esc(territoryVisual(inst.kind).color)}" data-level="${esc(inst.kind)}"><div class="home-section-heading local-heading">${territoryTile(inst.kind)}<div><span class="section-kicker">${esc(rules.label.toUpperCase())} · SIMULAZIONE</span><h2>${esc(inst.name)}</h2><p class="section-subtitle">${esc(roleLine(inst))}${inst.until ? ` · mandato fino al voto del ${esc(date(inst.until))}` : ''}</p></div><span class="parliament-provenance simulated">SCENARIO SIMULATO</span></div>
    ${tabs}<div class="local-section" data-sec="${section}" role="tabpanel" id="panel-${esc(inst.id)}" aria-labelledby="tab-${esc(inst.id)}-${section}">${body}</div></section>`;
}
// The player's active institutions (none: an empty string, the page stays as it was). One mandate is shown at a time (a selector when there are several); each has its sections.
export function renderInstitutions(state, ui = {}) {
  const active = activeInstitutions(state);
  if (!active.length) return '';
  const capital = state.game?.resources?.politicalCapital ?? 0;
  const influence = state.dataset?.statistics?.find(item => item.subjectId === state.career?.playerId && item.metric === 'influence')?.value ?? 30;
  const context = { capital, influence, today: state.clock?.currentDate ?? null };
  // Each institution is reached by its own id (a legacy value that is a kind, from an older session or a link, opens the first of that kind).
  const selected = resolveInstitution(state, ui.localInst) ?? active[0];
  const jump = active.length > 1 ? `<nav class="sx-tabs local-jump" role="tablist" aria-label="I tuoi mandati">${active.map(inst => `<button type="button" role="tab" class="sx-tab${inst.id === selected.id ? ' active' : ''}" data-local-inst="${esc(inst.id)}" aria-selected="${inst.id === selected.id}" tabindex="${inst.id === selected.id ? 0 : -1}" style="--lv:${esc(territoryVisual(inst.kind).color)}">${glyph(territoryVisual(inst.kind).icon, 15)} ${esc(institutionLabel(inst, active))}</button>`).join('')}</nav>` : '';
  return `<div class="local-institutions" id="istituzioni"><div class="home-section-heading local-intro"><div><span class="section-kicker">LE TUE ISTITUZIONI</span><h2>Dove eserciti il tuo mandato</h2><p class="section-subtitle">Un mandato alla volta: panoramica, bilancio, opere e cantieri, servizi del territorio, atti e cronologia. Ogni atto approvato e ogni opera finita cambiano i servizi del territorio.</p></div></div>${jump}${institutionCard(selected, capital, context, state, ui)}<p class="poll-footnote">Consigli, giunte, gruppi, atti, voti, opere ed effetti sono simulati; sindaci, presidenti e assessori non giocanti sono figure simulate, non persone reali.</p></div>`;
}
export const activeInstitutions = state => (state?.local?.institutions ?? []).filter(item => item.status === 'active');
// The anchor of an institution on the page: its own id, never its kind (two councils of one kind are two anchors).
export const institutionAnchor = inst => `istituzione-${inst.id}`;
// The institution a reference points to: an id, or (a link or a view saved by an older version) a kind, which opens the latest of that kind.
export function resolveInstitution(state, ref) {
  const active = activeInstitutions(state);
  return active.find(inst => inst.id === ref) ?? [...active].reverse().find(inst => inst.kind === ref) ?? null;
}
const placeOf = inst => inst.kind === 'europa' ? '' : String(inst.name ?? '').replace(inst.kind === 'comune' ? /^Comune di\s*/ : inst.kind === 'provincia' ? /^(Provincia|Città metropolitana|Libero consorzio comunale)\s*(di)?\s*/ : /^Regione\s*/, '');
// How a council is named in the links that lead to it (Home, election report). With several of one kind active, the place is added so each is told apart.
export function institutionLabel(inst, among = null) {
  const label = baseLabel(inst);
  return among && inst.kind !== 'europa' && among.filter(item => item.kind === inst.kind).length > 1 && !label.includes(placeOf(inst)) ? `${label} · ${placeOf(inst)}` : label;
}
function baseLabel(inst) {
  if (inst.kind === 'europa') return 'Parlamento europeo';
  if (inst.executive?.leader === 'player') return inst.kind === 'regione' ? `La tua Regione · ${inst.name.replace(/^Regione\s*/, '')}` : inst.kind === 'provincia' ? `La tua Provincia · ${inst.name.replace(/^(Provincia|Città metropolitana|Libero consorzio comunale)\s*(di)?\s*/, '')}` : `Il tuo Comune · ${inst.name.replace(/^Comune di\s*/, '')}`;
  return inst.kind === 'regione' ? 'Consiglio regionale' : inst.kind === 'provincia' ? 'Consiglio provinciale' : 'Consiglio comunale';
}
