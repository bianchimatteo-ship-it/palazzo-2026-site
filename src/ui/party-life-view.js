// VITA INTERNA — the people behind the currents, what they ask, the agreements, the congress, the local leaders, the
// rebuilding of the party and the way it is founded, merged or renamed. All simulated: no real person appears here.
import { costProblem, lifeOverview, partyOpsAvailability } from '../core/career-engine.js?v=20261015-2';
import { mergeCandidates } from '../core/world-engine.js?v=20261015-2';
import { OP_COSTS } from '../core/party-ops-engine.js?v=20261015-2';
import { CADRE_ACTIONS, REBUILD_FOCUS, RENAME_STYLES } from '../data/simulation/party-life-rules.js?v=20261015-2';
import { PARTY_LINES } from '../data/simulation/career-rules.js?v=20261015-2';
import { badge, bar, card, empty, esc, euro, num, weeksLabel } from './sections-kit.js?v=20261015-2';
import { territoryTile, territoryVisual } from './visuals.js?v=20261015-2';
import { planAddButton } from './plan-view.js?v=20261015-2';

const STANCE = { alleata: ['good', 'Alleata'], neutrale: ['neutral', 'Neutrale'], ostile: ['bad', 'Ostile'] };
const PACT_STATUS = { attivo: ['good', 'In vigore'], scaduto: ['neutral', 'Scaduto'], rotto: ['bad', 'Rotto'], rinnovato: ['good', 'Rinnovato'] };
const TREND = { crescita: ['good', 'In crescita'], stabile: ['neutral', 'Stabile'], declino: ['bad', 'In declino'], volatile: ['warn', 'Volatile'] };
const tone = (value, low, high, invert = false) => { const good = invert ? value <= low : value >= high; const bad = invert ? value >= high : value <= low; return good ? 'good' : bad ? 'bad' : ''; };
const costChips = cost => Object.entries(cost ?? {}).map(([key, value]) => `<span class="hq-cost-chip">${key === 'ap' ? `${value} giorn${value === 1 ? 'o' : 'i'}` : key === 'capital' ? `${value} cap. politico` : key === 'funds' ? euro(value) : key === 'treasury' ? `${euro(value)} dal partito` : `${value} ${esc(key)}`}</span>`).join(' ');
const meterRow = (label, value, toneName = '') => `<div class="pl-meter"><span>${esc(label)}</span>${bar(value, toneName)}<b>${num(value, 0)}</b></div>`;

function vitalsCard(view) {
  const vitals = view.vitals;
  if (!vitals) return '';
  const [trendTone, trendLabel] = TREND[vitals.trend] ?? TREND.stabile;
  return card({ kicker: 'STATO DI SALUTE DEL PARTITO · SIMULAZIONE', title: 'Stabilità, slancio e capacità di mobilitazione', action: badge(trendLabel, trendTone), body: `<div class="pl-vitals">
    <div><small>STABILITÀ</small><strong>${vitals.stability}</strong>${bar(vitals.stability, tone(vitals.stability, 40, 65))}<em>coesione, disciplina e malcontento delle aree</em></div>
    <div><small>VOLATILITÀ</small><strong>${vitals.volatility}</strong>${bar(vitals.volatility, tone(vitals.volatility, 30, 60, true))}<em>quanto il partito può cambiare in poche settimane</em></div>
    <div><small>SLANCIO</small><strong>${num(vitals.momentum, 1)}</strong>${bar((vitals.momentum + 10) * 5, tone(vitals.momentum, -2, 2))}<em>crescita degli iscritti e clima interno (−10 / +10)</em></div>
    <div><small>MOBILITAZIONE</small><strong>${vitals.mobilization}</strong>${bar(vitals.mobilization, tone(vitals.mobilization, 30, 60))}<em>militanti, comitati e quadri pronti a muoversi</em></div>
  </div>` });
}

function requestButtons(item) {
  const counter = item.stage === 'trattativa';
  const negotiable = item.kind !== 'rinnovo';
  const btn = (choice, label, extra = '', primary = false) => `<button type="button" class="${primary ? 'primary-button' : 'secondary-button'}" data-life-request="${esc(item.id)}" data-life-choice="${choice}" ${extra}>${label}</button>`;
  return counter
    ? `${btn('accetta-controfferta', 'Accetta la controfferta', '', true)}${btn('rifiuta', 'Rifiuta')}${btn('tempo', 'Prendi tempo')}`
    : `${btn('accetta', 'Accetta', '', true)}${negotiable ? btn('tratta', `Tratta <small>${item.kind === 'ultimatum' ? '3' : '1'} cap.</small>`) : ''}${btn('rifiuta', 'Rifiuta')}${btn('tempo', 'Prendi tempo')}`;
}
function requestsCard(view) {
  if (!view.requests.length) return card({ kicker: 'RICHIESTE', title: 'Nessuna richiesta aperta', body: '<p class="sx-note">Le aree, i dirigenti locali e le altre forze si fanno vivi quando hanno qualcosa da chiedere: dipende da quanto pesano, da quanto sono scontenti e da cosa hai concesso. Le richieste compaiono anche nell’agenda della settimana.</p>' });
  return card({ kicker: 'RICHIESTE → RISPOSTA → TRATTATIVA → ACCORDO', title: `${view.requests.length} ${view.requests.length === 1 ? 'richiesta aperta' : 'richieste aperte'}`, body: `<div class="pl-requests">${view.requests.map(item => `<article class="pl-request ${item.kind === 'ultimatum' ? 'is-urgent' : ''}"><header>${badge(item.label, item.kind === 'ultimatum' ? 'bad' : item.stage === 'trattativa' ? 'warn' : 'neutral')}<small>${item.stage === 'trattativa' ? 'in trattativa · ' : ''}scade tra ${weeksLabel(item.weeksLeft)}</small></header><h4>${esc(item.title)}</h4><p>${esc(item.body)}</p><div class="pl-actions">${requestButtons(item)}</div></article>`).join('')}</div><p class="sx-note">Ogni risposta ha conseguenze: chi ottiene ricorda, chi viene respinto ricorda di più, le altre aree guardano. Accettare crea un accordo con condizioni e durata.</p>` });
}

function areasCard(view, party) {
  const rows = [...view.currents].sort((a, b) => b.strength - a.strength).map(item => {
    const [stanceTone, stanceLabel] = STANCE[item.stance] ?? STANCE.neutrale;
    const badges = [item.ruling ? badge('Guida il partito', 'good') : '', item.aligned ? badge('La tua area', 'neutral') : '', badge(stanceLabel, stanceTone), item.leaving ? badge('Valuta la rottura', 'bad') : ''].join(' ');
    return `<article class="pl-area ${item.aligned ? 'is-mine' : ''}"><header><div><strong>${esc(item.label)}</strong><small>${esc(item.leader ?? '')}</small></div><div class="pl-badges">${badges}</div></header>
      <p class="pl-trait">${esc(item.persona ? `${item.persona[0].toUpperCase()}${item.persona.slice(1)}: ${item.trait}` : '')}${item.line ? ` · linea «${esc(PARTY_LINES[item.line]?.label ?? item.line)}»` : ''}${item.areas.length ? ` · temi: ${esc(item.areas.join(', '))}` : ''}</p>
      ${meterRow(`Peso nel partito ${item.share}%`, item.share * 1.6)}${meterRow(`Seggi negli organi ${item.seats}/${view.organs.total}`, item.seats / view.organs.total * 100)}${meterRow('Lealtà', item.loyalty, tone(item.loyalty, 35, 65))}${meterRow('Malcontento', item.grievance, tone(item.grievance, 35, 65, true))}
      <footer><small>Richieste accolte ${item.granted} · respinte ${item.refused} · rapporto con te ${item.relation}/100${item.pacts.length ? ` · accordi: ${esc(item.pacts.join(', '))}` : ''}</small>${!view.secretary && !item.aligned && party.affiliation === 'member' ? `<button type="button" class="secondary-button" data-party-current="${esc(item.id)}">Schierati</button>` : ''}</footer></article>`;
  }).join('');
  return card({ kicker: 'LE AREE E I LORO CAPI · SIMULATI', title: 'Obiettivi, forza, lealtà e memoria', body: `<div class="pl-areas">${rows}</div><p class="sx-note">Ogni area agisce sullo stato reale della partita: chiede ciò che le manca (seggi, linea, liste, fondi), si scontenta se ignorata e può arrivare a lasciare il partito. I capi sono ruoli simulati, non persone.</p>` });
}

function pactsCard(view) {
  const rows = view.pacts.map(pact => {
    const [statusTone, statusLabel] = PACT_STATUS[pact.status] ?? ['neutral', pact.status];
    return { accordo: `<strong>${esc(pact.title)}</strong><small>${esc(pact.actor)}</small>`, termini: `${esc(pact.gives ?? '')}<small>in cambio di: ${esc(pact.asks ?? '')}</small>`, durata: pact.status === 'attivo' ? `${weeksLabel(pact.weeksLeft)}${pact.renewals ? ` · rinnovato ${pact.renewals}×` : ''}` : `dalla sett. ${pact.since}`, stato: badge(statusLabel, statusTone), azione: pact.status === 'attivo' ? `<button type="button" class="secondary-button" data-life-pact-break="${esc(pact.id)}" title="Costa 1 punto di capitale politico: l’area se lo ricorderà">Denuncia</button>` : '' };
  });
  const columns = [['accordo', 'Accordo'], ['termini', 'Condizioni'], ['durata', 'Durata'], ['stato', 'Stato'], ['azione', '']];
  return card({ kicker: 'ACCORDI · CONDIZIONI, DURATA, ROTTURA, RINNOVO', title: 'Cosa hai promesso e cosa ti è dovuto', body: `${table(columns, rows, 'Nessun accordo: nasce quando accetti una richiesta o chiudi una trattativa.')}<p class="sx-note">Un accordo che non rispetti si rompe da solo e costa lealtà; uno che sta per scadere torna come richiesta di rinnovo, spesso a condizioni più pesanti per chi è cresciuto.</p>` });
}
function table(columns, rows, emptyText) {
  if (!rows.length) return `<p class="sx-empty">${esc(emptyText)}</p>`;
  return `<div class="sx-table-wrap"><table class="sx-table"><thead><tr>${columns.map(([, label]) => `<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(([key, label]) => `<td data-label="${esc(label)}">${row[key] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// What the player can do about the congress now: every action with its cost (days, his money, the party's treasury, capital), what it does, what can go wrong and, when it cannot be done, why.
// The ones that are pointed at something (a region, an area) have their choice next to the button.
function congressWork(view, congress, party, state) {
  if (!party.alignedCurrentId) return '<p class="sx-note">Non hai un’area di riferimento: schierati per pesare al congresso.</p>';
  const mine = view.currents.find(item => item.id === party.alignedCurrentId);
  const others = view.currents.filter(item => item.id !== party.alignedCurrentId);
  const marks = congress.marks ?? {};
  const placed = [marks.mobilization ? `mobilitazione ${marks.mobilization}/40` : null, marks.tours ? `${marks.tours} giro delle federazioni` : null, marks.pushes?.length ? `campagna in ${marks.pushes.join(', ')}` : null, marks.motion ? (marks.motion.weak ? 'mozione debole' : `mozione solida (${Math.round(marks.motion.quality * 100)}%)`) : null].filter(Boolean);
  const rows = (congress.actions ?? []).map(action => {
    const gap = action.available ? costProblem(state.game, action.cost) : null;
    const reason = action.reason ?? gap;
    const pick = action.needs === 'regione' ? `<label class="pl-ca-pick">Regione<select data-life-field="congress-${action.id}">${(congress.regions ?? []).map(region => `<option value="${esc(region)}">${esc(region)}</option>`).join('')}</select></label>`
      : action.needs === 'area' ? `<label class="pl-ca-pick">Area<select data-life-field="congress-${action.id}">${others.map(item => `<option value="${esc(item.id)}">${esc(item.label)}</option>`).join('')}</select></label>` : '';
    return `<li class="pl-ca${reason ? ' is-off' : ''}"><div class="pl-ca-head"><strong>${esc(action.label)}</strong><span>${costChips(action.cost)}</span>${action.done ? badge('Fatto', 'good') : ''}</div><p>${esc(action.detail)}</p>${action.risk ? `<small class="pl-ca-risk">${esc(action.risk)}</small>` : ''}${pick}<div class="pl-ca-foot"><button type="button" class="secondary-button" data-life-congress="${esc(action.id)}" ${reason ? `disabled title="${esc(reason)}"` : ''}>${esc(action.label)}</button>${reason ? `<small class="pl-ca-reason">${esc(reason)}</small>` : ''}</div></li>`;
  }).join('');
  return `<div class="pl-congress-work"><h4>Che cosa puoi fare ora per ${esc(mine?.label ?? 'la tua area')}</h4>${placed.length ? `<p class="sx-note">Già messo in campo: ${esc(placed.join(' · '))}.</p>` : ''}<ul class="pl-congress-actions">${rows}</ul></div>`;
}

function congressCard(view, party, state) {
  const congress = view.congress;
  const lastRows = view.lastCongress ? `<h4>Ultimo congresso (settimana ${view.lastCongress.week})</h4><ul class="pl-rank">${view.lastCongress.ranked.map(row => `<li><span>${esc(row.label)}</span>${bar(row.pct, row.id === view.lastCongress.winnerId ? 'good' : '')}<b>${num(row.pct, 1)}%</b></li>`).join('')}</ul>` : '';
  if (!congress) return card({ kicker: 'CONGRESSO', title: party.affiliation === 'founder' ? 'Guidi il partito da fondatore: nessun congresso' : `Prossimo congresso: settimana ${view.nextCongressWeek ?? '—'}`, body: `<p class="sx-note">${party.affiliation === 'founder' ? 'Un partito appena fondato non ha congressi: li avrà quando sarà cresciuto.' : 'La stagione congressuale si apre circa otto mesi prima del voto: forza delle aree → preparazione → delegati → alleanze → trattative → mozioni → voto.'}</p>${lastRows}` });
  const phases = congress.schedule.map(item => `<li class="${item.id === congress.phase ? 'current' : congress.schedule.findIndex(entry => entry.id === item.id) < congress.schedule.findIndex(entry => entry.id === congress.phase) ? 'done' : ''}"><span>${esc(item.label)}</span><small>sett. ${item.startWeek}</small></li>`).join('');
  const delegates = congress.delegates ? view.currents.map(item => { const n = congress.delegates.byCurrent[item.id] ?? 0; return `<li><span>${esc(item.label)}</span>${bar(n, item.aligned ? 'good' : '', congress.delegates.total)}<b>${n}</b></li>`; }).join('') : '';
  const projection = congress.projection?.ranked?.map(row => `<li><span>${esc(row.label)}</span>${bar(row.pct, row === congress.projection.winner ? 'good' : '')}<b>${num(row.pct, 1)}%</b></li>`).join('') ?? '';
  return card({ kicker: 'CONGRESSO · FORZA → PREPARAZIONE → DELEGATI → ALLEANZE → TRATTATIVE → MOZIONI → VOTO', title: `${congress.phaseLabel} · voto tra ${weeksLabel(congress.weeksLeft)}`, body: `<p>${esc(congress.phaseDetail ?? '')}</p><ol class="organ-ladder pl-phases">${phases}</ol>
    <div class="sx-grid two"><div><h4>Delegati (${congress.delegates?.total ?? '—'}${congress.delegates?.player ? ` · ${congress.delegates.player} legati a te` : ''})</h4><ul class="pl-rank">${delegates}</ul></div><div><h4>Se si votasse oggi</h4><ul class="pl-rank">${projection || '<li>Stima non disponibile.</li>'}</ul></div></div>
    ${congress.alliances.length ? `<h4>Alleanze di mozioni</h4><ul class="pl-notes">${congress.alliances.map(al => `<li>${esc(al.labels.join(' + '))} <small>(${esc(al.origin)})</small></li>`).join('')}</ul>` : ''}
    ${congress.notes.length ? `<ul class="pl-notes">${congress.notes.map(item => `<li><small>sett. ${item.week}</small> ${esc(item.text)}</li>`).join('')}</ul>` : ''}
    ${congressWork(view, congress, party, state)}
    <p class="sx-note">I delegati nascono dalle federazioni: contano gli iscritti, la vitalità, chi guida il comitato e quanto l’area si è mobilitata. Le tue scelte passate (comitati, fondi, accordi, schieramenti) cambiano i numeri.</p>${lastRows}` });
}

// The local leaders: people (first and last name, a «simulated person» badge) apart from the committees they lead. Filters by level and territory; every committee without a leader of its own
// has its own row with the button to recruit one. The committee keeps its name; the leader keeps his.
const LEVELS = ['regione', 'provincia', 'comune'];
const LEVEL_ONE = { regione: 'Comitato regionale', provincia: 'Comitato provinciale', comune: 'Comitato comunale' };
const LEVEL_NOUN = { regione: 'regionali', provincia: 'provinciali', comune: 'comunali', comitato: 'di altri comitati' };
const norm = text => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function cadresCard(view, party, filters = {}) {
  const level = ['regione', 'provincia', 'comune'].includes(filters.cadreLevel) ? filters.cadreLevel : '';
  const query = norm(filters.cadreQuery).trim();
  const committeeOf = id => (party.org?.committees ?? []).find(item => item.id === id) ?? null;
  const levelOf = item => (LEVELS.includes(item.level) ? item.level : 'comitato');
  const matches = (item, text) => (!level || item.level === level) && (!query || norm(text).includes(query));
  const actionButton = (item, action) => `<button type="button" class="secondary-button" data-life-cadre="${action}" data-cadre-id="${esc(item.id)}" title="${esc(CADRE_ACTIONS[action].detail)}">${esc(CADRE_ACTIONS[action].label.replace(' il dirigente', ''))} <small>${costChips(CADRE_ACTIONS[action].cost).replace(/<[^>]+>/g, '')}</small></button>${planAddButton({ kind: 'cadre', action, cadreId: item.id, label: `${CADRE_ACTIONS[action].label.replace(' il dirigente', '')}: ${item.personName ?? item.name}` })}`;
  const SIM_BADGE = badge('Personaggio simulato', 'neutral');
  // One card per person: his name first, then role and place, the committee he leads on its own line, the state and the first actions; the rest folds under «Dettagli».
  const row = item => {
    const committee = committeeOf(item.committeeId);
    const place = committee ? `${committee.level === 'regione' ? committee.region : `${committee.name}${committee.level === 'provincia' ? ' (provincia)' : ''} · ${committee.region}`}` : item.name;
    const stateBadge = badge(item.player ? 'Guidato da te' : item.status === 'in-uscita' ? 'Sta per andarsene' : item.status === 'critico' ? 'Critico' : 'In carica', item.player ? 'good' : item.status === 'in-uscita' ? 'bad' : item.status === 'critico' ? 'warn' : 'neutral');
    const stance = item.stance && !item.player ? badge(item.stance.label, item.stance.tone) : '';
    const details = item.player ? '' : `<details class="pl-details"><summary>Dettagli</summary><p class="pl-trait">${item.area ? `Area: ${esc(item.area)} · ` : ''}${esc(item.mode)} · in carica dalla settimana ${esc(item.since ?? '—')} · vuole: ${esc(item.interest ?? '—')}</p>${meterRow('Lealtà', item.loyalty, tone(item.loyalty, 35, 65))}${meterRow('Malcontento', item.grievance, tone(item.grievance, 35, 65, true))}<p class="sx-note" title="${esc((item.stance?.reasons ?? []).join(' · '))}">${item.stance ? `Peso politico ${Math.round(item.stance.weight * 100)}/100 · ` : ''}autonomia ${item.autonomy ?? '—'}/100 · organizzazione ${item.organization ?? '—'}/100${item.promise ? ` · candidatura promessa (${weeksLabel(item.promise.weeksLeft)})` : ''}</p><div class="pl-actions">${actionButton(item, 'sostituisci')}</div></details>`;
    return `<article class="pl-cadre pl-compact ${item.status !== 'attivo' ? `is-${item.status}` : ''}" data-cadre="${esc(item.id)}" data-person="${esc(item.personId ?? '')}"><header><div><strong class="pl-person-name">${esc(item.player ? 'Tu' : item.personName)}</strong><small>${esc(item.roleLabel)} · ${esc(place)}</small><small class="pl-committee-line">Comitato: ${esc(committee?.name ?? item.name)}</small></div><span class="cm-badges">${stateBadge}${stance}${item.player ? '' : SIM_BADGE}</span></header>${item.player ? '' : `<div class="pl-actions">${['incontra', 'promuovi'].map(action => actionButton(item, action)).join('')}</div>`}${details}</article>`;
  };
  const people = view.cadres.filter(item => matches(item, `${item.personName} ${item.name} ${item.region} ${item.roleLabel}`));
  const groups = [...LEVELS, 'comitato'].map(key => ({ key, items: people.filter(item => levelOf(committeeOf(item.committeeId) ?? item) === key).sort((a, b) => String(a.region ?? '').localeCompare(String(b.region ?? ''), 'it') || String(a.personName).localeCompare(String(b.personName), 'it')) })).filter(group => group.items.length);
  const rows = groups.map(({ key, items }) => { const visual = territoryVisual(key); return `<details class="pl-level" open style="--lv:${esc(visual.color)}" data-level="${esc(key)}"><summary>${territoryTile(key, 'sm')}<span>Dirigenti ${LEVEL_NOUN[key]}</span><small>${items.length}</small></summary><div class="pl-level-list">${items.map(row).join('')}</div></details>`; }).join('');
  // The committees that have nobody of their own: who to appoint, and where. Level and territory are on every row.
  const vacant = (view.committees ?? []).filter(item => item.vacant && matches(item, `${item.name} ${item.region}`)).sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || String(a.region).localeCompare(String(b.region), 'it') || String(a.name).localeCompare(String(b.name), 'it'));
  const vacantRows = vacant.map(item => { const visual = territoryVisual(item.level); return `<li class="pl-vacant" style="--lv:${esc(visual.color)}" data-committee="${esc(item.id)}">${territoryTile(item.level, 'sm')}<div><strong>${esc(item.name)}</strong><small>${esc(LEVEL_ONE[item.level])} · ${esc(item.region)} · ${esc(item.status)}</small><small class="pl-reason">Nessun responsabile</small></div><div class="pl-actions"><button type="button" class="secondary-button" data-life-cadre="recluta" data-committee-id="${esc(item.id)}" title="${esc(CADRE_ACTIONS.recluta.detail)}">Recluta un responsabile <small>${costChips(CADRE_ACTIONS.recluta.cost).replace(/<[^>]+>/g, '')}</small></button>${planAddButton({ kind: 'cadre', action: 'recluta', committeeId: item.id, label: `Recluta un responsabile: ${item.name}` })}</div></li>`; }).join('');
  const filterBar = `<div class="pl-filters" role="group" aria-label="Filtra dirigenti e comitati"><label>Livello<select data-view-filter-select="cadreLevel"><option value="">Tutti</option>${LEVELS.map(key => `<option value="${key}" ${level === key ? 'selected' : ''}>${esc(LEVEL_NOUN[key].replace(/^./, c => c.toUpperCase()))}</option>`).join('')}</select></label><label>Territorio o nome<input type="search" data-view-filter-text="cadreQuery" value="${esc(filters.cadreQuery ?? '')}" placeholder="Es. Siena, Toscana, Rossi" autocomplete="off" /></label></div>`;
  const control = view.control;
  const controlBlock = control ? `<div class="pl-control"><div class="pl-meter"><span>Controllo del territorio · ${esc(control.region ?? 'il tuo territorio')}</span>${bar(control.index, tone(control.index, 40, 65))}<b>${control.index}/100</b></div><p class="sx-note">${control.byStance.tuo + control.byStance['con-te']} con te · ${control.byStance.distante} distanti · ${control.byStance.contro} contro${control.critical ? ` · ${control.critical} in crisi` : ''}.</p></div>` : '';
  const vacantTotal = (view.committees ?? []).filter(item => item.vacant).length;
  return card({ kicker: 'DIRIGENTI LOCALI · PERSONE SIMULATE', title: `${view.cadres.length} ${view.cadres.length === 1 ? 'dirigente' : 'dirigenti'} · ${vacantTotal} ${vacantTotal === 1 ? 'comitato senza responsabile' : 'comitati senza responsabile'}`, body: `${controlBlock}${filterBar}<div class="pl-cadres">${rows || '<p class="sx-empty">Nessun dirigente corrisponde ai filtri: i dirigenti compaiono quando il partito ha i suoi comitati sul territorio (scheda Territorio).</p>'}</div>${vacant.length ? `<h4 class="pl-subhead">Comitati senza responsabile</h4><ul class="pl-vacancies">${vacantRows}</ul><p class="sx-note">Reclutare dà un volto e un nome a un comitato senza guida: il responsabile è una persona simulata con un nome tuo e una fedeltà alta; il comitato non cambia nome.</p>` : `<p class="sx-note">${vacantTotal ? 'Nessun comitato senza responsabile corrisponde ai filtri.' : 'Ogni comitato ha il suo responsabile.'}</p>`}` });
}

function rebuildCard(view, secretary) {
  if (view.rebuild) return card({ kicker: 'RICOSTRUZIONE', title: view.rebuild.label, body: `<div class="pl-meter"><span>Avanzamento</span>${bar(view.rebuild.progress, 'good')}<b>${view.rebuild.progress}%</b></div><p class="sx-note">Mancano ${weeksLabel(view.rebuild.weeksLeft)}: il piano lavora ogni settimana finché il partito non torna al governo o il percorso si conclude.</p>` });
  if (!secretary) return '';
  return card({ kicker: 'RICOSTRUZIONE · OPPOSIZIONE', title: 'Un piano per rimettere in piedi il partito', body: `<p class="sx-note">Quando il partito è all’opposizione e perde terreno, sei mesi di lavoro mirato possono ricostruire sezioni, quadri, identità o conti.</p><div class="pl-actions">${Object.entries(REBUILD_FOCUS).map(([id, spec]) => `<button type="button" class="secondary-button" data-life-rebuild="${id}" title="${esc(spec.detail)}">${esc(spec.label)} <small>2 cap.</small></button>`).join('')}</div>` });
}

function opsCard(state, view, party, neighbours, ops) {
  const found = `<article class="pl-op"><h4>Fonda un nuovo partito</h4><p>Lasci ${esc(party.label ?? 'il partito')} (o parti da indipendente) e ne fondi uno tuo: porti con te le aree che scegli, i comitati che guidi, una parte di iscritti, volontari e cassa. Nel Parlamento una parte del gruppo ti segue. ${costChips(OP_COSTS.found)}</p>
    <div class="pl-form"><label>Nome del partito<input type="text" data-life-field="found-label" maxlength="60" placeholder="Es. Alleanza dei Territori" /></label><label>Sigla<input type="text" data-life-field="found-abbr" maxlength="6" placeholder="Es. ADT" /></label></div>
    ${view.currents.length ? `<fieldset class="pl-followers"><legend>Aree che ti seguono</legend>${view.currents.map(item => `<label><input type="checkbox" data-life-follower value="${esc(item.id)}" ${item.aligned ? 'checked' : ''}/> ${esc(item.label)} <small>${item.share}%</small></label>`).join('')}</fieldset>` : ''}
    <button type="button" class="primary-button" data-life-found ${ops.found.ok ? '' : `disabled title="${esc(ops.found.reason ?? '')}"`}>Fonda il partito</button>${ops.found.ok ? '' : `<small class="pl-reason">${esc(ops.found.reason ?? '')}</small>`}</article>`;
  const merge = `<article class="pl-op"><h4>Fusione con un’altra forza</h4><p>Iscritti, sezioni e cassa si sommano, nasce una nuova area interna e la coesione ne soffre per qualche mese. ${costChips(OP_COSTS.merge)}</p>${neighbours.length ? `<label class="pl-check"><input type="checkbox" data-life-field="merge-unify" ${party.affiliation === 'founder' ? '' : 'disabled'}/> Unisci anche i nomi</label>${neighbours.map(item => `<div class="pl-neighbour"><span><strong>${esc(item.label)}</strong><small>${num(item.share, 1)}% · rapporti ${item.tie} · distanza ${num(item.axisGap, 1)}</small></span><button type="button" class="secondary-button" data-life-merge="${esc(item.id)}" ${ops.merge.ok ? '' : `disabled title="${esc(ops.merge.reason ?? '')}"`}>Proponi la fusione</button></div>`).join('')}` : '<p class="sx-empty">Nessuna forza è abbastanza vicina per ideologia, dimensioni e rapporti.</p>'}${!ops.merge.ok && neighbours.length ? `<small class="pl-reason">${esc(ops.merge.reason ?? '')}</small>` : ''}</article>`;
  const rename = `<article class="pl-op"><h4>Cambia nome e identità</h4><p>Un nuovo nome costa soldi e riconoscibilità: nei sondaggi c’è uno scossone, poi un rilancio. ${costChips(OP_COSTS.rename)}</p>${party.affiliation === 'founder' ? `<div class="pl-form"><label>Nuovo nome<input type="text" data-life-field="rename-label" maxlength="60" value="" placeholder="${esc(party.label ?? '')}" /></label><label>Sigla<input type="text" data-life-field="rename-abbr" maxlength="6" /></label><label>Tipo<select data-life-field="rename-style">${Object.entries(RENAME_STYLES).map(([id, spec]) => `<option value="${id}" ${id === 'rilancio' ? 'selected' : ''}>${esc(spec.label)} — ${esc(spec.detail)}</option>`).join('')}</select></label></div><button type="button" class="secondary-button" data-life-rename ${ops.rename.ok ? '' : `disabled title="${esc(ops.rename.reason ?? '')}"`}>Cambia nome</button>${ops.rename.ok ? '' : `<small class="pl-reason">${esc(ops.rename.reason ?? '')}</small>`}` : `<p class="sx-note">${esc(ops.rename.reason ?? 'Solo chi ha fondato il proprio partito può cambiarne il nome.')}</p>`}</article>`;
  return card({ kicker: 'IL PARTITO COME STRUTTURA · FONDAZIONE, FUSIONE, IDENTITÀ', title: 'Scissioni, nuovi partiti, fusioni e cambi di nome', body: `<div class="pl-ops">${found}${merge}${rename}</div><p class="sx-note">Seggi, territori, consenso, organizzazione e finanze cambiano davvero: il partito reale resta un riferimento, ciò che nasce nella tua partita è simulato.</p>` });
}

function chronicleCard(view) {
  const items = [...view.history.map(item => `<li><small>sett. ${item.week}</small> ${esc(item.text)}</li>`), ...view.closed.map(item => `<li><small>sett. ${item.week}</small> ${esc(item.title)} — <em>${esc(item.outcome)}</em></li>`)];
  if (!items.length) return '';
  return card({ kicker: 'MEMORIA INTERNA', title: 'Cosa è successo di recente', body: `<ul class="pl-notes">${items.slice(0, 14).join('')}</ul>` });
}

export function renderPartyLife(state, filters = {}) {
  const game = state.game;
  const party = game?.party;
  const view = party ? lifeOverview(game) : null;
  if (!view) return empty('La vita interna del partito compare quando fai parte di un partito.');
  const neighbours = state.world ? mergeCandidates(state.world) : [];
  const ops = partyOpsAvailability(game, { neighbours });
  return `<div class="pl-page">${vitalsCard(view)}${requestsCard(view)}<div class="sx-grid two">${areasCard(view, party)}${pactsCard(view)}</div>${congressCard(view, party, state)}${cadresCard(view, party, filters)}${rebuildCard(view, view.secretary)}${opsCard(state, view, party, neighbours, ops)}${chronicleCard(view)}</div>`;
}
