// PARTITO — the organisation seen from inside: identity, the player's role and odds, internal areas, members and
// sections, the secretary's desk and the history. The real party stays a reference; everything inside is simulated.
import { careerOverview } from '../core/career-overview.js?v=20261124-3';
import { organOf, treasuryOutlook } from '../core/organization-engine.js?v=20261124-3';
import { playerRoles } from '../core/roles.js?v=20261124-3';
import { currentObjectiveLabel } from '../data/simulation/career-rules.js?v=20261124-3';
import { formatDate } from '../core/time.js?v=20261124-3';
import { lineChart, SERIES } from './charts.js?v=20261124-3';
import { glyph } from './visuals.js?v=20261124-3';
import { renderPartyPosition, renderSecretaryDesk } from './game-mode.js?v=20261124-3';
import { renderOrganizationPanel } from './organization-mode.js?v=20261124-3';
import { renderOddsCard } from './career-page.js?v=20261124-3';
import { renderCommitteesPanel } from './committees-view.js?v=20261124-3';
import { renderPartyLife } from './party-life-view.js?v=20261124-3';
import { partyOpsAvailability } from '../core/career-engine.js?v=20261124-3';
import { OP_COSTS, OP_COOLDOWNS } from '../core/party-ops-engine.js?v=20261124-3';
import { arrow, badge, bar, card, esc, euro, num, pct, sectionHero, sectionTabs, signed, table } from './sections-kit.js?v=20261124-3';

const SOURCE_LABELS = { real: 'Dato reale verificato', user: 'Creato da te', simulation: 'Simulazione' };
const partyName = party => party?.officialName ?? party?.name ?? 'Partito';
export function partyTabs(state) {
  const party = state.game?.party;
  if (!party) return [['panoramica', 'Panoramica']];
  const tabs = [['panoramica', 'Panoramica'], ['ruoli', 'Ruoli e correnti'], ['vita', 'Vita interna'], ['organizzazione', 'Organizzazione'], ['territorio', 'Territorio']];
  if (playerRoles(state).secretary) tabs.push(['segreteria', 'Segreteria']);
  tabs.push(['storico', 'Storico']);
  return tabs;
}

// The player's party in the national polls of the game (simulated series, or the real reference poll when loaded).
function pollOf(state) {
  const world = state.world;
  const force = world?.parties?.find(item => item.isPlayer);
  if (!force) return null;
  const polls = world.polls ?? [];
  const last = polls.at(-1)?.results?.find(item => item.partyId === force.id);
  return { force, share: last?.share ?? null, delta: last?.delta ?? 0, history: polls.slice(-20).map(poll => poll.results?.find(item => item.partyId === force.id)?.share ?? null), source: polls.at(-1)?.source ?? 'simulation' };
}

function identity(party, record, logoFor) {
  const logo = record ? logoFor?.(record) : null;
  const description = record?.source === 'real' ? record.factualDescription || 'Descrizione non disponibile nelle fonti consultate.' : record?.description || 'Partito della partita: identità e programma nascono dalle tue scelte.';
  const positions = record?.policyPositions ? `<div class="policy-summary">${[['economia', 'Economia'], ['welfare', 'Welfare'], ['ambiente', 'Ambiente'], ['europa', 'Europa']].map(([key, label]) => `<span><small>${label}</small><strong>${Number(record.policyPositions[key] ?? 3)} <i>/ 5</i></strong><b><i style="width:${Number(record.policyPositions[key] ?? 3) * 20}%"></i></b></span>`).join('')}</div>` : '';
  return `<div class="pp-identity">${logo ? `<img class="pp-logo" src="${esc(logo)}" alt="${esc(record?.logoAlt || `Logo di ${partyName(record)}`)}" />` : `<span class="pp-logo is-empty">${esc((record?.abbreviation || party.label || 'P').slice(0, 3))}</span>`}<div><div class="pp-identity-meta">${badge(SOURCE_LABELS[record?.source] ?? 'Simulazione', record?.source === 'real' ? 'good' : 'neutral')}${record?.abbreviation ? badge(record.abbreviation) : ''}${record?.orientation ? badge(record.orientation) : ''}</div><p>${esc(description)}</p>${record?.source === 'real' && record.sourceUrl ? `<a class="catalog-source" href="${esc(record.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fonte ufficiale ↗</a>` : ''}</div></div>${positions}`;
}

function currentsCard(party) {
  const rows = [...(party.currents ?? [])].sort((a, b) => b.strength - a.strength).map(current => { const request = current.profile?.requests?.at(-1); return `<li class="${party.alignedCurrentId === current.id ? 'is-mine' : ''}"><span><strong>${esc(current.label)}</strong><small>${party.leaderCurrentId === current.id ? 'guida il partito · ' : ''}rapporto con te ${num(current.value ?? current.relation, 0)}/100</small><small>${esc(current.profile?.objective ? currentObjectiveLabel(current.profile.objective) : 'Obiettivo in definizione')} · ${esc(current.lastAction ?? 'Iniziativa non ancora registrata')}${request?.status === 'open' ? ` · richiesta: ${esc(request.title)}` : ''}</small></span><b>${num(current.strength, 1)}%</b>${bar(current.strength, party.alignedCurrentId === current.id ? 'good' : '')}</li>`; }).join('');
  return `<ul class="pp-currents">${rows}</ul>${party.alignedCurrentId ? '' : '<p class="sx-note">Non sei schierato: al congresso e nelle nomine chi resta neutrale conta meno.</p>'}<div class="sx-actions"><button class="secondary-button" data-section-tab="partito" data-section-tab-value="ruoli">Schierati o cambia area ${arrow}</button></div>`;
}

function alerts(state) {
  const game = state.game;
  const party = game.party;
  const org = party.org;
  const items = [];
  if (party.affiliation === 'member' && party.support < 25) items.push(['bad', 'alert', 'Sostegno interno molto basso', 'Sotto quota 20 il partito può avviare l’espulsione; sotto 30 rischi gli incarichi.']);
  const congress = org && !org.founder ? org.congress.nextWeek - game.week.index : null;
  if (congress !== null && congress >= 0 && congress <= 6) items.push(['warn', 'crown', `Congresso tra ${congress} ${congress === 1 ? 'settimana' : 'settimane'}`, party.alignedCurrentId ? 'La tua area si gioca la guida del partito.' : 'Schierati prima del voto degli iscritti.']);
  for (const conflict of (org?.conflicts ?? []).filter(item => item.intensity >= 55).slice(0, 2)) items.push([conflict.intensity >= 70 ? 'bad' : 'warn', 'split', conflict.title, `Intensità ${num(conflict.intensity, 0)}/100: pesa sulla coesione e sulle nomine.`]);
  if (org && org.treasury.balance < 0) items.push(['bad', 'money', 'Tesoreria in rosso', 'Le sezioni chiudono e la coesione cala finché i conti non tornano in ordine.']);
  if (!items.length) return '';
  return `<ul class="pp-alerts">${items.map(([tone, icon, title, text]) => `<li class="tone-${tone}">${glyph(icon, 16)}<span><strong>${esc(title)}</strong><small>${esc(text)}</small></span></li>`).join('')}</ul>`;
}

function positionCard(state, track) {
  const party = state.game.party;
  const leadership = state.game.relations.find(item => item.id === 'leadership');
  const steps = track.steps.map(step => `<li class="${step.current ? 'is-current' : step.done ? 'is-done' : ''}"><i aria-hidden="true">${step.done ? '✓' : step.current ? '●' : ''}</i><span>${esc(step.label)}</span></li>`).join('');
  const odds = track.odds ? `<div class="cp-odds tone-${track.odds.chance >= .6 ? 'good' : track.odds.chance >= .35 ? 'warn' : 'bad'}"><strong>${Math.round(track.odds.chance * 100)}%</strong><span>probabilità stimata di diventare ${esc(track.next.title.toLowerCase())}</span>${bar(track.odds.chance * 100, track.odds.chance >= .6 ? 'good' : track.odds.chance >= .35 ? 'warn' : 'bad')}</div>` : '';
  return `<ol class="cp-steps is-compact">${steps}</ol>${odds}<dl class="cp-facts"><div><dt>Sostegno interno</dt><dd>${num(party.support, 0)}/100</dd></div>${leadership ? `<div><dt>Rapporto con la leadership</dt><dd>${num(leadership.value, 0)}/100</dd></div>` : ''}<div><dt>La tua area</dt><dd>${esc(party.currents?.find(item => item.id === party.alignedCurrentId)?.label ?? 'nessuna')}</dd></div></dl>
    <div class="sx-actions">${track.action?.type === 'party-contest' ? `<button class="primary-button" data-party-action="contest" ${track.blocker ? `disabled title="${esc(track.blocker)}"` : ''}>${esc(track.action.label)}</button>` : ''}<button class="secondary-button" data-section-tab="carriera" data-section-tab-value="progressione">Fattori e probabilità ${arrow}</button>${track.blocker && track.action?.type === 'party-contest' ? `<em class="cp-blocker">${esc(track.blocker)}</em>` : ''}</div>`;
}

function countryCard(state) {
  const poll = pollOf(state);
  if (!poll) return '<p class="sx-empty">I sondaggi del partito compariranno con la prima rilevazione.</p>';
  const values = poll.history.filter(value => value !== null);
  const chart = values.length > 2 ? lineChart({ series: [{ label: poll.force.label, color: SERIES[0], values: poll.history, emphasis: true }], labels: poll.history.map((_, index) => `${index + 1}`), unit: '%', height: 150, ariaLabel: `${poll.force.label} negli ultimi sondaggi` }) : '';
  const world = state.world;
  const allies = (world.alliances ?? []).filter(item => item.status === 'active' && item.partyIds.includes(poll.force.id)).flatMap(item => item.partyIds.filter(id => id !== poll.force.id)).map(id => world.parties.find(party => party.id === id)?.label ?? id);
  return `<div class="pp-poll"><strong>${pct(poll.share)}</strong><span class="tone-${poll.delta > 0 ? 'good' : poll.delta < 0 ? 'bad' : 'neutral'}">${signed(poll.delta)} nell’ultima rilevazione</span></div>${chart}<p class="sx-note">Alleanze attive: ${allies.length ? esc(allies.join(', ')) : 'nessuna'}. Sondaggi ${poll.source === 'real' ? 'di riferimento reali' : 'simulati dal gioco'}.</p><button class="text-link" data-nav="sondaggi" data-obs-view="forze">Sondaggi e alleanze ${arrow}</button>`;
}

function historyTab(state) {
  const game = state.game;
  const party = game.party;
  const rows = [
    ...(party.history ?? []).map(item => ({ date: item.date, week: item.week, kind: 'Incarico', text: item.text, tone: 'neutral' })),
    ...(party.contests ?? []).map(item => ({ date: item.date, week: item.week, kind: item.kind === 'proposta' ? 'Proposta' : 'Sfida interna', text: `${item.target}: ${item.label} (probabilità ${Math.round((item.chance ?? 0) * 100)}%)`, tone: item.outcome === 'promosso' ? 'good' : ['sconfitta-interna', 'retrocessione'].includes(item.outcome) ? 'bad' : 'neutral' })),
    ...(party.org?.congress?.history ?? []).map(item => ({ date: null, week: item.week, kind: 'Congresso', text: `Vince ${item.winner}${item.backed ? ' · la tua area' : ''}`, tone: item.backed ? 'good' : 'neutral' })),
    ...game.log.filter(entry => entry.kind === 'partito' && !(party.contests ?? []).some(contest => contest.week === entry.week && entry.title.includes(contest.target))).map(entry => ({ date: null, week: entry.week, kind: 'Diario', text: entry.title, tone: entry.tone }))
  ].sort((a, b) => (b.week ?? 0) - (a.week ?? 0)).slice(0, 30);
  const table1 = table([['when', 'Quando'], ['kind', 'Tipo'], ['text', 'Cosa è successo']], rows.map(row => ({ _class: '', when: row.date ? esc(formatDate(row.date, { day: 'numeric', month: 'short', year: 'numeric' })) : `S${row.week}`, kind: badge(row.kind, row.tone === 'good' ? 'good' : row.tone === 'bad' ? 'bad' : 'neutral'), text: esc(row.text) })), { empty: 'La storia del partito si scriverà con nomine, congressi e sfide interne.' });
  const past = (game.pastParties ?? []).map(item => ({ label: `<strong>${esc(item.label)}</strong>`, rank: esc(item.rankTitle ?? '—'), left: `S${item.leftAtWeek}`, reason: esc(item.reason ?? '') }));
  return `${card({ kicker: 'STORICO · SIMULAZIONE', title: 'La tua vita nel partito', body: table1 })}${past.length ? card({ kicker: 'PARTITI LASCIATI', title: 'Da dove vieni', body: table([['label', 'Partito'], ['rank', 'Ruolo'], ['left', 'Uscita'], ['reason', 'Motivo']], past) }) : ''}`;
}

function hero(state, record, logoFor, track) {
  const game = state.game;
  const party = game.party;
  if (!party) return sectionHero({ kicker: 'PARTITO · PROFILO INDIPENDENTE', icon: 'flag', title: 'Sei indipendente', lead: 'Nessuna struttura alle spalle e nessuna leadership da convincere. Aderire a un partito apre liste, incarichi interni e correnti.' });
  const org = party.org;
  const poll = pollOf(state);
  const leadership = game.relations.find(item => item.id === 'leadership');
  const logo = record ? logoFor?.(record) : null;
  const actions = track?.action?.type === 'party-contest' ? `<button class="primary-button" data-party-action="contest" ${track.blocker ? `disabled title="${esc(track.blocker)}"` : ''}>${esc(track.action.label)} · ${Math.round((track.odds?.chance ?? 0) * 100)}%</button>` : playerRoles(state).secretary ? `<button class="primary-button" data-section-tab="partito" data-section-tab-value="segreteria">Decisioni della segreteria ${arrow}</button>` : '';
  return sectionHero({
    kicker: `IL TUO PARTITO · ${(record?.source === 'real' && record.verified !== true ? 'Dato reale in attesa di conferma' : SOURCE_LABELS[record?.source] ?? 'SIMULAZIONE').toUpperCase()}`, icon: 'flag',
    title: partyName(record) || party.label,
    lead: `${party.rankTitle}${org ? ` · siedi in ${organOf(party).label.toLowerCase()}` : ''} · area: ${party.currents?.find(item => item.id === party.alignedCurrentId)?.label ?? 'nessuna'}. Ruoli, correnti e organizzazione interna sono simulati.`,
    actions,
    aside: logo ? `<img class="pp-hero-logo" src="${esc(logo)}" alt="${esc(record?.logoAlt || `Logo di ${partyName(record)}`)}" />` : '',
    kpis: [
      { label: 'Sostegno interno', value: `${num(party.support, 0)}/100`, bar: party.support, tone: party.support < 30 ? 'bad' : party.support >= 65 ? 'good' : '' },
      leadership ? { label: 'Rapporto con la leadership', value: `${num(leadership.value, 0)}/100`, bar: leadership.value, tone: leadership.value < 35 ? 'bad' : leadership.value >= 65 ? 'good' : '' } : null,
      org ? { label: 'Coesione', value: `${num(org.cohesion, 0)}/100`, bar: org.cohesion, tone: org.cohesion < 40 ? 'bad' : org.cohesion >= 65 ? 'good' : '' } : null,
      org ? { label: 'Iscritti', value: num(org.members, 0), note: org.growth ? `${signed(org.growth)}% a settimana` : 'stabili', tone: org.growth > 0 ? 'good' : org.growth < 0 ? 'bad' : '' } : null,
      org ? { label: 'Tesoreria', value: euro(org.treasury.balance), note: esc(treasuryOutlook(org).statusLabel), tone: org.treasury.balance < 0 ? 'bad' : '' } : null,
      poll ? { label: 'Nei sondaggi', value: pct(poll.share), note: `${signed(poll.delta)} ultima rilevazione`, tone: poll.delta > 0 ? 'good' : poll.delta < 0 ? 'bad' : '' } : null
    ].filter(Boolean)
  });
}

// «Appartenenza»: leaving the party / changing it, in plain sight on the Panoramica (it used to live only in the secondary tab «Ruoli e correnti»). What it does is read from the engine before the player confirms.
function membershipCard(state, preview) {
  const party = state.game.party;
  const lines = (preview?.lines ?? []).map(line => `<li>${esc(line)}</li>`).join('');
  return card({ kicker: 'APPARTENENZA', title: `Sei iscritto a ${partyName(null) === 'Partito' ? party.label : party.label}`, body: `<p class="parliament-note">Puoi lasciare il partito quando vuoi e continuare come indipendente, oppure passare subito a un altro: la scelta ha conseguenze, che leggi qui prima di confermare.</p>
    ${lines ? `<details class="pp-leave-details"><summary>Che cosa succede se lasci ${esc(party.label)}</summary><ul class="sx-list">${lines}</ul></details>` : ''}
    <div class="sx-actions"><button type="button" class="secondary-button danger" data-party-action="leave">Lascia il partito</button><button type="button" class="secondary-button" data-party-action="change">Cambia partito</button></div>` });
}

// An independent: the two ways back into party politics, said first — found a party of one's own (the operation of the internal life, with its requirements and its cost) or join one that exists.
function independentPaths(state) {
  const game = state.game;
  const ops = partyOpsAvailability(game, { neighbours: [] }).found;
  const have = { capital: Math.round(game.resources?.politicalCapital ?? 0), funds: Math.round(game.resources?.funds ?? 0) };
  const need = OP_COSTS.found;
  const req = (label, ok, detail) => `<li class="${ok ? 'is-ok' : 'is-missing'}"><span aria-hidden="true">${ok ? '✓' : '•'}</span><b>${esc(label)}</b> <small>${esc(detail)}</small></li>`;
  const office = (playerRoles(state).roles ?? []).filter(([kind]) => !['fondatore', 'segretario', 'direzione', 'dirigente', 'iscritto'].includes(kind)).map(([, title]) => title).filter(Boolean).slice(0, 2);
  return card({ className: 'pp-independent', kicker: 'INDIPENDENTE', title: 'Fonda un nuovo partito o aderisci a uno esistente', body: `<p class="parliament-note">Senza un partito decidi da solo, ma non hai una struttura alle spalle. Puoi fondarne uno tuo, con nome, sigla, identità, logo, orientamento e posizioni, oppure aderire a un partito che esiste.</p>
    <div class="sx-grid two"><div><h4 class="pp-sub">Requisiti per fondare</h4><ul class="pp-reqs">${req('Capitale politico', have.capital >= (need.capital ?? 0), `${have.capital} disponibili, ne servono ${need.capital}`)}${req('Fondi', have.funds >= (need.funds ?? 0), `${euro(have.funds)} disponibili, ne servono ${euro(need.funds)}`)}${req('Tempo dall’ultima fondazione', !/settiman/i.test(ops.reason ?? ''), `una fondazione ogni ${OP_COOLDOWNS.found} settimane`)}</ul>${ops.ok ? '' : `<p class="pl-reason">${esc(ops.reason ?? '')}</p>`}</div>
    <div><h4 class="pp-sub">Cosa ottieni</h4><ul class="sx-list"><li>Diventi fondatore e segretario: decidi linea, alleanze e candidature.</li><li>Nasce l’organizzazione iniziale (iscritti, sezioni, tesoreria) e la prima area interna; la fai crescere dalla Vita del partito.</li><li>Il partito entra nel mondo politico simulato e nei sondaggi, e resta nel salvataggio.</li><li>${office.length ? `Gli incarichi che ricopri (${esc(office.join(', '))}) restano tuoi.` : 'Gli incarichi che ricoprirai saranno legati al nuovo partito.'}</li></ul></div></div>
    <div class="sx-actions"><button type="button" class="primary-button" data-action="scroll-to" data-target="fonda-partito">Fonda un nuovo partito ${arrow}</button><button type="button" class="secondary-button" data-action="scroll-to" data-target="aderisci-partito">Aderisci a un partito</button></div>` });
}

export function renderPartyPage(state, { tab = null, record = null, logoFor = () => null, selectable = [], territory = {}, filters = {}, leavePreview = null } = {}) {
  if (!state.game) return '';
  const party = state.game.party;
  const tabs = partyTabs(state);
  const active = tabs.some(([id]) => id === tab) ? tab : 'panoramica';
  const track = careerOverview(state).tracks.find(item => item.id === 'partito');
  let body = '';
  if (!party) body = `${independentPaths(state)}<div id="fonda-partito">${renderPartyLife(state, filters)}</div><div id="aderisci-partito">${renderPartyPosition(state, { parties: selectable })}</div><p class="sx-note">Il partito reale resta un riferimento: la tua posizione interna, le correnti e l’organizzazione sono simulate.</p>`;
  else if (active === 'panoramica') body = `${alerts(state)}<div class="sx-grid two">${card({ kicker: 'IDENTITÀ', title: partyName(record) || party.label, body: identity(party, record, logoFor) })}${card({ kicker: 'LA TUA POSIZIONE · SIMULAZIONE', title: party.rankTitle, body: positionCard(state, track) })}</div><div class="sx-grid two">${card({ kicker: 'EQUILIBRI INTERNI · SIMULATI', title: 'Le aree del partito', body: currentsCard(party) })}${card({ kicker: 'NEL PAESE', title: 'Il partito nei sondaggi', body: countryCard(state) })}</div>${membershipCard(state, leavePreview)}`;
  else if (active === 'ruoli') body = `${track?.odds ? renderOddsCard(track) : ''}${renderPartyPosition(state, { parties: selectable, withSecretary: false })}`;
  else if (active === 'vita') body = renderPartyLife(state, filters);
  else if (active === 'organizzazione') body = party.org ? `<section class="sx-card pp-org">${renderOrganizationPanel(state)}</section>` : '<p class="sx-empty">Organizzazione non disponibile.</p>';
  else if (active === 'territorio') body = renderCommitteesPanel(state, territory);
  else if (active === 'segreteria') body = renderSecretaryDesk(state);
  else body = historyTab(state);
  const troubled = (party?.org?.committees ?? []).filter(item => ['crisi', 'perdita-controllo'].includes(item.status)).length;
  const openRequests = (party?.life?.requests ?? []).filter(item => ['aperta', 'trattativa'].includes(item.stage)).length;
  const counts = { storico: ((party?.contests ?? []).length + (party?.history ?? []).length) || '', territorio: troubled ? `${troubled}!` : '', vita: openRequests || '' };
  return `<div class="party-page">${hero(state, record, logoFor, track)}${tabs.length > 1 ? sectionTabs('partito', tabs.map(([id, label]) => [id, label, counts[id]]), active) : ''}<div class="sx-body" role="tabpanel">${body}</div></div>`;
}
