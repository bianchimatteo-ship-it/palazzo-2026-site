// Public policy in the interface: designing a measure, its projected bill, the Government's desk,
// the budget law and the state of the country's policy areas, security and accounts.
import { AREA_BY_ID, AREA_GROUPS, BILLION_PER_POINT, EU_DEFICIT_LIMIT, FINANCING, GOVERNMENT_LINES, INSTRUMENT_KINDS, INTENSITY, MINISTRIES, POLICY_AREAS, TERRITORIAL_TARGETS } from '../data/simulation/policy-rules.js?v=20260925-3';
import { SEGMENTS } from '../data/simulation/society-rules.js?v=20260925-3';
import { ITALIAN_REGIONS } from '../data/regions.js?v=20260925-3';
import { areaTable, budgetImpact, measureDesign, projectMeasure } from '../core/society-engine.js?v=20260925-3';
import { activeMinisters, groupProfile, partnerSatisfaction, stageWait } from '../core/parliament-engine.js?v=20260925-3';
import { glyph } from './visuals.js?v=20260925-3';
import { esc, stateBadge } from './charts.js?v=20260925-3';

const num = (value, digits = 1) => Number(value ?? 0).toLocaleString('it-IT', { maximumFractionDigits: digits });
const signed = (value, digits = 1) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${num(Math.abs(value ?? 0), digits)}`;
const option = (value, label, selected) => `<option value="${esc(value)}" ${selected ? 'selected' : ''}>${esc(label)}</option>`;
const groupsOf = parliament => ['camera', 'senato'].flatMap(chamber => parliament?.chambers?.[chamber]?.groups ?? []);
const groupName = (parliament, id) => groupsOf(parliament).find(group => group.groupId === id)?.officialName ?? id;
const meterBar = (value, tone = '') => `<b class="hq-bar ${tone}"><i style="width:${Math.max(0, Math.min(100, value))}%"></i></b>`;

// ---------- the measure designer ----------
export function policyFields(design = {}, { prefix = '' } = {}) {
  const current = measureDesign({ area: design.area ?? 'sanita', ...design }) ?? measureDesign({ area: 'sanita' });
  const spec = AREA_BY_ID[current.area];
  const areas = Object.entries(AREA_GROUPS).map(([group, label]) => `<optgroup label="${esc(label)}">${POLICY_AREAS.filter(item => item.group === group).map(item => option(item.id, item.label, item.id === current.area)).join('')}</optgroup>`).join('');
  const instruments = Object.entries(INSTRUMENT_KINDS).map(([id, kind]) => `<label class="policy-choice ${current.instrument === id ? 'active' : ''}"><input type="radio" name="instrument" value="${id}" ${current.instrument === id ? 'checked' : ''} /><span><strong>${esc(spec.instruments[id])}</strong><small>${esc(kind.label)} · ${esc(kind.detail)}</small></span></label>`).join('');
  const financing = Object.entries(FINANCING).filter(([id]) => id !== 'ue' || spec.euFunds).map(([id, item]) => option(id, item.label, current.financing === id)).join('');
  const cuts = POLICY_AREAS.filter(item => item.id !== current.area).map(item => option(item.id, item.label, current.cutArea === item.id)).join('');
  const targets = spec.forcedTarget ? option(spec.forcedTarget, TERRITORIAL_TARGETS.find(item => item.id === spec.forcedTarget).label, true) : [...TERRITORIAL_TARGETS.map(item => option(item.id, item.label, current.target === item.id)), `<optgroup label="Una sola regione">${ITALIAN_REGIONS.map(name => option(name, name, current.target === name)).join('')}</optgroup>`].join('');
  const segments = [option('tutti', 'Tutti i cittadini', current.segment === 'tutti'), ...SEGMENTS.map(item => option(item.id, item.label, current.segment === item.id))].join('');
  return `<div class="policy-fields" data-policy-fields${prefix ? ` data-prefix="${esc(prefix)}"` : ''}>
    <label>Tema<select name="area" data-policy-area>${areas}</select></label>
    <fieldset class="policy-instruments"><legend>Strumento</legend>${instruments}</fieldset>
    <div class="policy-row">
      <label>Portata<select name="intensity">${INTENSITY.map(item => option(item.level, item.label, current.intensity === item.level)).join('')}</select></label>
      <label>Copertura<select name="financing" data-policy-financing>${financing}</select></label>
      <label ${current.financing === 'tagli' ? '' : 'hidden'} data-policy-cut>Settore da tagliare<select name="cutArea">${cuts}</select></label>
    </div>
    <div class="policy-row">
      <label>Territorio<select name="target">${targets}</select></label>
      <label>Chi favorire<select name="segment">${segments}</select></label>
    </div>
  </div>`;
}
export function designFromForm(form) {
  const data = new FormData(form);
  return measureDesign({ area: data.get('area'), instrument: data.get('instrument'), intensity: data.get('intensity'), financing: data.get('financing'), cutArea: data.get('cutArea'), target: data.get('target'), segment: data.get('segment') });
}
// The projected bill of a design, readable before any vote.
export function policyPreview(society, design) {
  if (!society || !design) return '';
  const p = projectMeasure(society, design);
  if (!p) return '';
  const finance = society.publicFinance;
  const over = p.deficitAfter > EU_DEFICIT_LIMIT;
  const regions = Object.entries(p.regionDeltas ?? {}).sort((a, b) => b[1] - a[1]);
  const best = regions.slice(0, 3), worst = regions.slice(-3).reverse();
  const people = (list, tone) => list.length ? list.map(item => `<li class="${tone}"><strong>${esc(item.label)}</strong><span>${esc(item.reason ?? '')}</span><b>${signed(item.delta)}</b></li>`).join('') : `<li class="quiet">${tone === 'good' ? 'Nessun gruppo ne beneficia in modo evidente' : 'Nessun gruppo penalizzato in modo evidente'}</li>`;
  const security = p.security ? `<div class="preview-security">${glyph('shield', 14)} Sicurezza a regime: criminalità ${num(society.security.crime, 0)} → <b>${num(p.crimeAfter, 0)}</b> · sicurezza percepita ${num(society.security.perceived, 0)} → <b>${num(p.perceivedAfter, 0)}</b></div>` : '';
  return `<div class="policy-preview">
    <div class="preview-kpis">
      <div><small>COSTO</small><strong>${num(p.billions)} mld</strong><span>${num(p.cost)} punti di margine</span></div>
      <div class="${p.covered ? '' : 'bad'}"><small>MARGINE DI BILANCIO</small><strong>${num(finance.headroom, 0)} → ${num(p.headroomAfter, 0)}</strong><span>${p.covered ? 'coperture trovate' : 'senza coperture: effetti ridotti'}</span></div>
      <div class="${over ? 'bad' : ''}"><small>DEFICIT</small><strong>${num(society.economy.deficit, 2)}% → ${num(p.deficitAfter, 2)}%</strong><span>${over ? 'oltre il 3%: rischio richiamo europeo' : 'entro la soglia europea'}</span></div>
      <div><small>SPREAD</small><strong>${num(finance.spread, 0)} → ${num(p.spreadAfter, 0)}</strong><span>punti base (simulati)</span></div>
      <div class="${p.satisfactionDelta < 0 ? 'bad' : 'good'}"><small>CITTADINI A REGIME</small><strong>${signed(p.satisfactionDelta)}</strong><span>soddisfazione media</span></div>
      <div><small>${esc(p.areaLabel.toUpperCase())}</small><strong>${num(p.areaBefore, 0)} → ${num(p.areaAfter, 0)}</strong><span>in ${p.phaseIn} settimane${p.lasting ? '' : ', poi svanisce in parte'}</span></div>
    </div>
    ${security}
    <div class="preview-people"><div><span class="section-kicker">CHI CI GUADAGNA</span><ul>${people(p.winners, 'good')}</ul></div><div><span class="section-kicker">CHI CI PERDE</span><ul>${people(p.losers, 'bad')}</ul></div></div>
    <div class="preview-regions"><span>${glyph('map', 14)} Più beneficiate: ${best.map(([name, delta]) => `<b>${esc(name)}</b> ${signed(delta)}`).join(' · ')}</span><span>${glyph('map', 14)} Meno toccate: ${worst.map(([name, delta]) => `<b>${esc(name)}</b> ${signed(delta)}`).join(' · ')}</span></div>
    <p class="parliament-note">Copertura: ${esc(FINANCING[p.design.financing].detail)} · Polemica attesa ${p.controversy >= 0.9 ? 'alta' : p.controversy >= 0.5 ? 'media' : 'bassa'}. Stime della simulazione, non previsioni reali.</p>
  </div>`;
}

// ---------- the budget law ----------
export function budgetFields(plan = {}) {
  return `<div class="budget-fields">${Object.entries(AREA_GROUPS).map(([id, label]) => `<div class="budget-field"><span>${esc(label)}</span><div class="segmented" role="group" aria-label="${esc(label)}">${[[-1, 'Taglio'], [0, 'Invariato'], [1, 'Aumento']].map(([value, text]) => `<label class="${(plan.allocations?.[id] ?? 0) === value ? 'active' : ''}"><input type="radio" name="alloc-${id}" value="${value}" ${(plan.allocations?.[id] ?? 0) === value ? 'checked' : ''} />${text}</label>`).join('')}</div></div>`).join('')}
    <div class="budget-field"><span>Tasse</span><div class="segmented" role="group" aria-label="Tasse">${[[-1, 'Meno tasse'], [0, 'Invariate'], [1, 'Più tasse']].map(([value, text]) => `<label class="${(plan.taxes ?? 0) === value ? 'active' : ''}"><input type="radio" name="taxes" value="${value}" ${(plan.taxes ?? 0) === value ? 'checked' : ''} />${text}</label>`).join('')}</div></div></div>`;
}
export function planFromForm(form) {
  const data = new FormData(form);
  return { allocations: Object.fromEntries(Object.keys(AREA_GROUPS).map(id => [id, Number(data.get(`alloc-${id}`) ?? 0)])), taxes: Number(data.get('taxes') ?? 0) };
}
export function budgetPreview(society, plan) {
  if (!society) return '';
  const b = budgetImpact(society, plan);
  const label = id => SEGMENTS.find(item => item.id === id)?.label ?? id;
  return `<div class="policy-preview"><div class="preview-kpis">
    <div class="${b.overLimit ? 'bad' : ''}"><small>DEFICIT</small><strong>${num(society.economy.deficit, 2)}% → ${num(b.deficitAfter, 2)}%</strong><span>${b.overLimit ? 'oltre il 3%: Bruxelles chiederà correzioni' : 'entro la soglia europea'}</span></div>
    <div><small>MARGINE PER L’ANNO</small><strong>${num(society.publicFinance.headroom, 0)} → ${num(b.headroomAfter, 0)}</strong><span>spazio per nuove misure</span></div>
    <div><small>SPESA</small><strong>${signed(b.spending, 0)}</strong><span>gruppi di spesa aumentati o tagliati</span></div></div>
    <div class="preview-people"><div><span class="section-kicker">PIÙ SODDISFATTI</span><ul>${b.winners.map(id => `<li class="good"><strong>${esc(label(id))}</strong><span>più risorse per i loro temi</span></li>`).join('') || '<li class="quiet">Nessuno in particolare</li>'}</ul></div><div><span class="section-kicker">SCONTENTI</span><ul>${b.losers.map(id => `<li class="bad"><strong>${esc(label(id))}</strong><span>tagli o più tasse</span></li>`).join('') || '<li class="quiet">Nessuno in particolare</li>'}</ul></div></div></div>`;
}

// ---------- the Prime Minister's desk ----------
export function governmentDesk(state) {
  const parliament = state.parliament;
  const government = parliament?.government;
  if (!government || government.primeMinister !== 'player' || !['active', 'crisis'].includes(government.status)) return '';
  const society = state.society;
  const program = government.program;
  const lines = Object.entries(GOVERNMENT_LINES).map(([id, item]) => `<label class="policy-choice ${program?.line === id ? 'active' : ''}"><input type="radio" name="line" value="${id}" ${program?.line === id ? 'checked' : ''} required /><span><strong>${esc(item.label)}</strong><small>${esc(item.detail)}</small></span></label>`).join('');
  const priorities = Object.entries(AREA_GROUPS).map(([group, label]) => `<fieldset class="priority-group"><legend>${esc(label)}</legend>${POLICY_AREAS.filter(item => item.group === group).map(item => `<label class="agenda-option"><input type="checkbox" name="priorities" value="${item.id}" ${program?.priorities?.includes(item.id) ? 'checked' : ''} /><span>${esc(item.label)}</span></label>`).join('')}</fieldset>`).join('');
  const partners = Object.entries(government.partners ?? {}).map(([id, partner]) => {
    const profile = groupProfile(id);
    const ministries = activeMinisters(government).filter(item => item.groupId === id).map(item => item.portfolio);
    return `<article class="partner-row ${partner.satisfaction < 35 ? 'danger' : ''}"><div><strong>${esc(groupName(parliament, id))}</strong><small>Priorità attribuite dallo scenario: ${profile.likes.map(area => esc(AREA_BY_ID[area].label.toLowerCase())).join(', ')} · non gradisce ${esc(FINANCING[profile.dislikesFinancing].label.toLowerCase())}</small><small>${ministries.length ? `Ministeri: ${ministries.map(esc).join(', ')}` : 'Nessun ministero'}</small>${partner.demand ? `<em class="decision-block">Chiede ${esc(partner.demand.label)} entro il ${esc(partner.demand.deadline)}</em>` : ''}</div><span class="partner-mood"><b>${num(partner.satisfaction, 0)}</b>${meterBar(partner.satisfaction, partner.satisfaction < 35 ? 'danger' : partner.satisfaction > 65 ? 'good' : '')}</span></article>`;
  }).join('') || '<p class="quiet-copy">Il governo non ha alleati da gestire.</p>';
  const ministers = activeMinisters(government).map(item => `<div class="minister-line${item.playerAppointed ? ' player-minister' : ''}"><span>${esc(item.portfolio)}</span><strong>${esc(item.playerAppointed ? item.appointeeLabel : item.groupName)}</strong><small>${item.playerAppointed ? 'Il tuo incarico' : `Lealtà ${num(item.loyalty ?? 60, 0)} · competenza ${num(item.competence ?? 60, 0)} · figura simulata`}</small></div>`).join('') || '<p class="quiet-copy">Nessun ministro nominato: assegna i ministeri qui sotto.</p>';
  const occupied = activeMinisters(government).filter(item => !item.playerAppointed).map(item => option(item.portfolio, `${item.portfolio} · ${item.groupName}`, false)).join('');
  const majority = [...government.coalitionGroupIds, ...government.supportingGroupIds].filter(id => id !== parliament.player?.groupId).map(id => option(id, groupName(parliament, id), false)).join('');
  const budgetLaw = parliament.laws.find(law => law.kind === 'manovra' && !['approved', 'rejected', 'lapsed'].includes(law.stage));
  const year = Number(state.clock.currentDate.slice(0, 4)) + (Number(state.clock.currentDate.slice(5, 7)) >= 9 ? 1 : 0);
  const budgetStatus = (government.budgetYear ?? 0) >= year ? `<p class="parliament-note">${glyph('shield', 14)} Legge di bilancio ${year} approvata.</p>` : budgetLaw ? `<p class="parliament-note">${glyph('clock', 14)} La legge di bilancio è all’esame delle Camere (fase: ${esc(budgetLaw.stage)}). Seguila nella sezione Leggi: va approvata entro il 31 dicembre.</p>` : '';
  const decrees = parliament.laws.filter(law => law.kind === 'decreto' && !['approved', 'rejected', 'lapsed'].includes(law.stage));
  const emergencies = Object.entries(state.game?.flags?.emergencies ?? {}).filter(([, week]) => (state.game.week.index - week) <= 6).map(([area]) => AREA_BY_ID[area]?.label).filter(Boolean);
  const issues = (society?.issues ?? []).slice(0, 4).map(issue => issue.topic);
  const mood = partnerSatisfaction(parliament);
  return `<section class="government-current pm-desk"><div class="home-section-heading"><div><span class="section-kicker">PRESIDENTE DEL CONSIGLIO · SIMULAZIONE</span><h2>La guida del governo</h2></div>${stateBadge(government.stability < 35 ? 'crisi' : government.stability < 50 ? 'rischio' : 'stabile', `Stabilità ${num(government.stability, 0)}`)}</div>
    <p class="parliament-note">Il governo propone, il Parlamento decide: nessun atto diventa legge senza il voto di entrambe le Camere. Ogni mossa costa giorni e capitale politico; alleati, opposizione, mercati e cittadini reagiscono.</p>
    <details class="pm-block" ${program ? '' : 'open'}><summary>${glyph('route', 16)} Indirizzo politico e priorità nazionali ${program ? `· ${esc(GOVERNMENT_LINES[program.line].label)}` : '· da definire'}</summary>
      <form data-government-program-form class="program-form"><div class="policy-lines">${lines}</div><div class="priority-groups">${priorities}</div><button class="primary-button" type="submit">Fissa il programma · 1 giorno · 2 cap.</button><small class="parliament-note">Da due a cinque priorità. Gli alleati le confrontano con le proprie; l’indirizzo sposta spread e gruppi di cittadini. Si può rivedere ogni 8 settimane.</small></form></details>
    <div class="pm-grid">
      <div class="pm-block"><h3>${glyph('users', 16)} Maggioranza · soddisfazione media ${mood ?? '—'}</h3>${partners}<button class="secondary-button" data-government-action="summit">Vertice di maggioranza · 2 giorni · 3 cap.</button><small class="parliament-note">Un vertice può ricompattare gli alleati o trasformarsi in una lite pubblica. Un alleato ignorato a lungo lascia la maggioranza.</small></div>
      <div class="pm-block"><h3>${glyph('ministry', 16)} Consiglio dei ministri</h3><div class="minister-list">${ministers}</div>${occupied ? `<form data-reshuffle-form class="reshuffle-form"><label>Rimpasto: ministero<select name="portfolio">${occupied}</select></label><label>Passa a<select name="groupId">${majority}</select></label><button class="secondary-button" type="submit">Rimpasto · 1 giorno · 4 cap.</button></form><small class="parliament-note">Il gruppo che perde il ministero si risente; chi lo ottiene diventa più leale.</small>` : ''}</div>
    </div>
    <div class="pm-block"><h3>${glyph('law', 16)} Nuovo provvedimento del governo</h3>
      <p class="parliament-note">Disegno di legge: segue l’iter completo alle Camere (almeno 5 settimane). Decreto-legge: in vigore subito, solo con un’emergenza aperta${emergencies.length || issues.length ? ` (oggi: ${[...new Set([...emergencies, ...issues])].slice(0, 5).map(esc).join(', ')})` : ' (oggi nessuna)'}, da convertire entro 60 giorni o decade. Decreti in attesa: ${decrees.length}/2.</p>
      <form data-policy-form data-policy-mode="government" class="policy-form"><label>Titolo<input name="title" maxlength="90" placeholder="Lascia vuoto per usare il nome dello strumento" /></label>${policyFields({ area: program?.priorities?.[0] ?? 'sanita' })}<div data-policy-preview>${policyPreview(society, measureDesign({ area: program?.priorities?.[0] ?? 'sanita' }))}</div><div class="policy-submit"><button class="primary-button" type="submit" name="submitKind" value="bill">Disegno di legge del governo · 2 giorni · 3 cap.</button><button class="secondary-button" type="submit" name="submitKind" value="decree">Decreto-legge · 2 giorni · 5 cap.</button></div></form></div>
    <div class="pm-block"><h3>${glyph('money', 16)} Legge di bilancio ${year}</h3>${budgetStatus}${!budgetLaw && (government.budgetYear ?? 0) < year ? `<form data-budget-form class="budget-form">${budgetFields({})}<div data-budget-preview>${budgetPreview(society, {})}</div><button class="primary-button" type="submit">Presenta la manovra · 2 giorni · 4 cap.</button><small class="parliament-note">Senza approvazione entro il 31 dicembre scatta l’esercizio provvisorio: spesa congelata, spread in aumento, stabilità in calo.</small></form>` : ''}</div>
  </section>`;
}

// ---------- the content of a bill on its card ----------
export function lawContent(law, parliament, state) {
  const policy = law.policy;
  const currentDate = state.clock.currentDate;
  const open = !['approved', 'rejected', 'lapsed'].includes(law.stage);
  const wait = open ? stageWait(law, currentDate) : 0;
  const kind = law.kind === 'decreto' ? 'Decreto-legge' : law.kind === 'manovra' ? 'Legge di bilancio' : law.origin === 'governo' ? 'Disegno di legge del governo' : 'Proposta parlamentare';
  const spec = AREA_BY_ID[policy?.area];
  const content = law.kind === 'manovra'
    ? `<span>${Object.entries(policy?.plan?.allocations ?? {}).filter(([, level]) => level).map(([group, level]) => `${esc(AREA_GROUPS[group])} ${level > 0 ? '↑' : '↓'}`).join(' · ') || 'Spesa invariata'} · tasse ${['giù', 'invariate', 'su'][(policy?.plan?.taxes ?? 0) + 1]}</span>`
    : spec ? `<span><b>${esc(spec.instruments[policy.instrument ?? 'investimento'])}</b> · portata ${esc(INTENSITY[(policy.intensity ?? 2) - 1].label.toLowerCase())} · ${esc(FINANCING[policy.financing ?? 'deficit'].label.toLowerCase())}${policy.financing === 'tagli' && policy.cutArea ? ` (${esc(AREA_BY_ID[policy.cutArea]?.label.toLowerCase())})` : ''} · ${esc(TERRITORIAL_TARGETS.find(item => item.id === policy.target)?.label ?? policy.target ?? 'Tutto il Paese')}${policy.segment && policy.segment !== 'tutti' ? ` · per ${esc(SEGMENTS.find(item => item.id === policy.segment)?.label.toLowerCase())}` : ''}</span>` : '';
  const status = [
    `<span class="law-kind">${esc(kind)}</span>`,
    law.deadline && open ? `<span class="law-deadline">${glyph('clock', 13)} Da convertire entro il ${esc(law.deadline)}</span>` : '',
    law.confidence ? `<span class="law-deadline">${glyph('alert', 13)} Fiducia posta: se il voto fallisce il governo cade</span>` : '',
    law.obstruction && open ? `<span class="law-deadline">${glyph('alert', 13)} Ostruzionismo: +${law.obstruction} settimane in commissione</span>` : '',
    law.snipers && open ? `<span class="law-deadline">${glyph('alert', 13)} Rischio franchi tiratori nel voto segreto</span>` : '',
    wait ? `<span>${glyph('clock', 13)} Prossimo passaggio tra ${wait} ${wait === 1 ? 'settimana' : 'settimane'}</span>` : ''
  ].filter(Boolean).join('');
  const demands = Object.entries(law.demands ?? {}).map(([groupId, demand]) => `<div class="law-demand ${demand.accepted ? 'accepted' : ''}"><span><b>${esc(groupName(parliament, groupId))}</b> chiede di ${esc(demand.label)}</span>${demand.accepted ? '<em>Accolta</em>' : open ? `<button class="secondary-button" data-law-demand="${esc(law.id)}" data-group-id-demand="${esc(groupId)}">Accogli</button>` : ''}</div>`).join('');
  const canEdit = open && ['commission', 'amendments'].includes(law.stage) && !law.confidence && law.kind !== 'manovra' && policy?.area;
  const edits = canEdit ? `<div class="law-edits"><span>Emenda il contenuto (1 giorno):</span>${(policy.intensity ?? 2) > 1 ? `<button class="text-link" data-law-patch="${esc(law.id)}" data-patch-key="intensity" data-patch-value="${(policy.intensity ?? 2) - 1}">Riduci la portata</button>` : ''}${(policy.intensity ?? 2) < 3 ? `<button class="text-link" data-law-patch="${esc(law.id)}" data-patch-key="intensity" data-patch-value="${(policy.intensity ?? 2) + 1}">Aumenta la portata</button>` : ''}${Object.keys(FINANCING).filter(id => id !== policy.financing && id !== 'tagli' && (id !== 'ue' || spec.euFunds)).slice(0, 4).map(id => `<button class="text-link" data-law-patch="${esc(law.id)}" data-patch-key="financing" data-patch-value="${id}">Copertura: ${esc(FINANCING[id].label.toLowerCase())}</button>`).join('')}${policy.target && policy.target !== 'nazionale' && !spec.forcedTarget ? `<button class="text-link" data-law-patch="${esc(law.id)}" data-patch-key="target" data-patch-value="nazionale">Estendi a tutto il Paese</button>` : ''}</div>` : '';
  const premier = parliament.government?.primeMinister === 'player' && parliament.government?.status === 'active';
  const extra = [
    premier && law.origin === 'governo' && ['amendments', 'final-vote'].includes(law.stage) && !law.confidence ? `<button class="secondary-button" data-law-confidence="${esc(law.id)}">Poni la questione di fiducia · 4 cap.</button>` : '',
    open && law.stage !== 'proposal' && law.kind !== 'decreto' ? `<button class="text-link" data-law-withdraw="${esc(law.id)}">Ritira la proposta</button>` : ''
  ].filter(Boolean).join('');
  return `<div class="law-content">${content}<div class="law-status-line">${status}</div>${demands ? `<div class="law-demands">${demands}</div>` : ''}${edits}${extra ? `<div class="law-extra">${extra}</div>` : ''}</div>`;
}

// ---------- the country: areas, security, accounts ----------
export function areasPanel(society) {
  if (!society) return '';
  const rows = areaTable(society);
  const tone = value => value < 32 ? 'crisi' : value < 42 ? 'rischio' : value > 62 ? 'crescita' : 'stabile';
  return Object.entries(AREA_GROUPS).map(([group, label]) => `<div class="area-group"><h3>${esc(label)}</h3>${rows.filter(row => row.group === group).map(row => `<div class="area-row" data-tip="${esc(`${row.label}: ${row.indicator} ${num(row.value, 0)}/100 · ministero ${row.portfolio}${row.value < 42 ? ` · ${row.problem}` : ''}`)}" tabindex="0">${glyph(row.icon, 15)}<span><strong>${esc(row.label)}</strong><small>${esc(row.indicator)}</small></span>${meterBar(row.value, row.value < 35 ? 'danger' : row.value > 62 ? 'good' : '')}<b>${num(row.value, 0)}</b>${stateBadge(tone(row.value), row.value < 32 ? 'Crisi' : row.value < 42 ? 'Rischio' : row.value > 62 ? 'Buono' : 'Stabile')}</div>`).join('')}</div>`).join('');
}
export function securityPanel(society) {
  const s = society?.security;
  if (!s) return '';
  const item = (label, value, note, invert = false) => `<div class="security-kpi"><small>${esc(label)}</small><strong>${num(value, 0)}</strong>${meterBar(value, (invert ? value > 58 : value < 42) ? 'danger' : '')}<span>${esc(note)}</span></div>`;
  return `<div class="security-kpis">${item('Criminalità simulata', s.crime, 'più alto = peggio: segue disoccupazione, presidi e prevenzione', true)}${item('Sicurezza percepita', s.perceived, 'segue la criminalità con ritardo e i fatti di cronaca')}${item('Capacità operativa', s.capacity, 'forze sul territorio: cresce con le assunzioni, cala senza fondi')}${item('Prevenzione', s.prevention, 'riqualificazione e servizi: lenta ma duratura')}</div>${s.operations ? `<p class="parliament-note">${glyph('shield', 14)} Operazioni straordinarie in corso ancora per ${s.operations} settimane.</p>` : ''}<p class="parliament-note">Più agenti costano molto e agiscono in mesi; pene più severe rassicurano subito ma intasano la giustizia e dividono; la prevenzione è lenta ma riduce i reati nel tempo.</p>`;
}
export function publicFinancePanel(society) {
  const f = society?.publicFinance;
  if (!f) return '';
  const eu = { regolare: ['stabile', 'In regola'], richiamo: ['rischio', 'Richiamo europeo'], procedura: ['crisi', 'Procedura per deficit eccessivo'] }[f.euStatus] ?? ['stabile', f.euStatus];
  const allocations = Object.entries(f.allocations ?? {}).filter(([, level]) => level).map(([group, level]) => `${esc(AREA_GROUPS[group])} ${level > 0 ? '↑' : '↓'}`).join(' · ');
  return `<div class="finance-kpis"><div><small>DEFICIT</small><strong>${num(society.economy.deficit, 2)}%</strong><span>soglia europea ${EU_DEFICIT_LIMIT}%</span></div><div><small>DEBITO</small><strong>${num(society.economy.debt, 1)}%</strong><span>del PIL (simulato)</span></div><div><small>SPREAD</small><strong>${num(f.spread, 0)}</strong><span>punti base: sopra 200 gli interessi erodono il margine</span></div><div><small>MARGINE DI BILANCIO</small><strong>${num(f.headroom, 0)}/100</strong><span>≈ ${num(f.headroom * BILLION_PER_POINT, 0)} mld per nuove misure</span></div></div><p class="parliament-note">${stateBadge(eu[0], eu[1])} ${f.budget?.provisional ? ' · Esercizio provvisorio in corso' : f.budget ? ` · Bilancio in vigore${allocations ? `: ${allocations}` : ''}` : ' · Nessuna legge di bilancio approvata in partita'}</p>`;
}
