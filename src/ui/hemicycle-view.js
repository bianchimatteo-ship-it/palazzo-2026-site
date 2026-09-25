// The interactive hemicycle of the Parlamento section: Camera and Senato apart, one marker per seat (real
// parliamentarians in office, the player's seat), colours by group or by party, filters by party, group and
// committee, a card for every parliamentarian and, for a simulated vote, the vote of every seat.
import { chamberRoster, committeesOf, partyColors, UNKNOWN_COLOR } from '../core/hemicycle.js?v=20260925-9';
import { individualVotes, VOTE_CHOICES, voteCatalog, voteSummary } from '../core/vote-engine.js?v=20260925-9';
import { BASIS_LABELS, electionListOf, groupAffiliation, groupLabel, politicianAffiliation } from '../data/repositories/party-links.js?v=20260925-9';
import { formatDate } from '../core/time.js?v=20260925-9';
import { glyph } from './visuals.js?v=20260925-9';
import { badge, esc, num, table } from './sections-kit.js?v=20260925-9';

export const HEMICYCLE_DEFAULTS = Object.freeze({ chamber: null, colorBy: 'gruppo', party: '', group: '', committee: '', vote: '', selected: null });
const CHAMBER_LABELS = { camera: 'Camera dei deputati', senato: 'Senato della Repubblica' };
const KIND_LABELS = { legge: 'Proposta di legge', decreto: 'Decreto-legge', manovra: 'Legge di bilancio', fiducia: 'Fiducia al governo' };
const LINE_LABELS = { favorevole: 'Favorevole', contrario: 'Contrario', astenuto: 'Astensione' };
const seatKey = seat => seat.player ? 'giocatore' : seat.person ? seat.person.id : `posto:${seat.groupId}:${seat.placeholderIndex}`;
const shortDate = date => date ? formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const personName = person => person?.fullName ?? `${person?.firstName ?? ''} ${person?.lastName ?? ''}`.trim();

// Everything the view needs, computed once per render.
export function hemicycleModel(state, { politicians = [], db = {}, view = {} } = {}) {
  const parliament = state.parliament;
  if (!parliament) return null;
  // A legislature born from a vote of the game: its members are not real people (no archive, no committees).
  const simulated = parliament.legislature?.reference === 'simulation';
  if (simulated) { politicians = []; db = {}; }
  const chamber = ['camera', 'senato'].includes(view.chamber) ? view.chamber : parliament.player?.chamber ?? 'camera';
  const roster = chamberRoster(parliament, chamber, { politicians, db });
  const parties = partyColors(politicians, db);
  // Only the votes of the Chambers in office (after a general election the old ones belong to the past legislature).
  const since = parliament.legislature?.firstSitting ?? parliament.legislature?.since ?? null;
  const votes = voteCatalog(parliament).filter(vote => vote.chamber === chamber && (!since || !vote.date || vote.date >= since));
  const vote = votes.find(item => item.id === view.vote) ?? null;
  const summary = vote ? voteSummary(vote) : null;
  const law = vote?.lawId ? (parliament.laws ?? []).find(item => item.id === vote.lawId) : null;
  const individual = summary ? individualVotes(summary, roster.seats, { playerBill: Boolean(law && law.origin !== 'governo') }) : null;
  const committees = (db.committees ?? []).filter(item => item.chamber === chamber);
  const committee = committees.find(item => item.id === view.committee) ?? null;
  const committeeIds = committee ? new Set((db.committeeMemberships ?? []).filter(row => row.committeeId === committee.id).map(row => row.politicianId)) : null;
  const entityOf = seat => seat.person ? politicianAffiliation(seat.person, db)?.entity ?? null : null;
  const groupIds = new Set(roster.groups.map(group => group.groupId));
  const group = groupIds.has(view.group) ? view.group : '';
  const matches = seat => {
    if (group && seat.groupId !== group) return false;
    if (view.party) { const entity = entityOf(seat); if (view.party === 'nessuno' ? Boolean(entity) || !seat.person : entity?.id !== view.party) return false; }
    if (committeeIds && !(seat.person && committeeIds.has(seat.person.id))) return false;
    return true;
  };
  const byGroup = new Map(roster.groups.map(item => [item.groupId, item]));
  const playerParty = state.career?.partyId ?? null;
  const colorOf = (seat, index) => individual ? VOTE_CHOICES[individual.choices[index]].color
    : seat.placeholder ? (simulated ? byGroup.get(seat.groupId)?.color ?? UNKNOWN_COLOR : UNKNOWN_COLOR)
    : view.colorBy === 'partito' ? (seat.player ? parties.get(playerParty)?.color ?? UNKNOWN_COLOR : parties.get(entityOf(seat)?.id)?.color ?? UNKNOWN_COLOR)
    : byGroup.get(seat.groupId)?.color ?? UNKNOWN_COLOR;
  const visible = roster.seats.filter(matches).length;
  const selected = view.selected ? roster.seats.find(seat => seatKey(seat) === view.selected) ?? null : null;
  return { parliament, simulated, chamber, roster, parties, votes, vote, summary, law, individual, committees, committee, group, matches, colorOf, entityOf, byGroup, visible, selected };
}

function svg(model, view) {
  const { roster } = model;
  const { layout } = roster;
  const circles = roster.seats.map((seat, index) => {
    const name = seat.player ? 'Il tuo seggio' : seat.person ? personName(seat.person) : model.simulated ? 'Seggio del gruppo (eletto simulato)' : 'Seggio del gruppo (non attribuito)';
    const label = `${name} · ${model.byGroup.get(seat.groupId)?.shortName ?? ''}${model.individual ? ` · ${VOTE_CHOICES[model.individual.choices[index]].label}` : ''}`;
    const classes = ['hemi-seat', model.matches(seat) ? '' : 'is-dim', seat.player ? 'is-player' : '', seat.placeholder ? 'is-placeholder' : '', model.selected && seatKey(model.selected) === seatKey(seat) ? 'is-selected' : ''].filter(Boolean).join(' ');
    return `<circle class="${classes}" cx="${seat.x}" cy="${seat.y}" r="${layout.radius.toFixed(1)}" fill="${model.colorOf(seat, index)}" data-hemi-seat="${esc(seatKey(seat))}"><title>${esc(label)}</title></circle>`;
  }).join('');
  const caption = model.summary ? `${num(model.summary.yes, 0)} sì · ${num(model.summary.against, 0)} no` : `${num(roster.total, 0)} seggi`;
  return `<svg class="hemi-svg" viewBox="0 0 ${layout.width} ${Math.round(layout.height)}" role="img" aria-label="${esc(`${CHAMBER_LABELS[model.chamber]}: ${roster.total} seggi${model.summary ? `, votazione simulata: ${model.summary.yes} favorevoli, ${model.summary.against} contrari, ${model.summary.abstain} astenuti` : ''}`)}">
    <g class="hemi-seats">${circles}</g>
    <text class="hemi-total" x="${layout.cx}" y="${Math.round(layout.cy - layout.cy * 0.12)}" text-anchor="middle">${esc(caption)}</text>
    <text class="hemi-sub" x="${layout.cx}" y="${Math.round(layout.cy - layout.cy * 0.12 + 26)}" text-anchor="middle">${esc(model.summary ? 'VOTAZIONE SIMULATA' : model.chamber === 'camera' ? 'CAMERA' : 'SENATO')}</text>
  </svg>`;
}

function legend(model, view) {
  if (model.summary) return `<ul class="hemi-legend is-vote">${['favorevole', 'contrario', 'astenuto'].map(choice => `<li><i style="background:${VOTE_CHOICES[choice].color}"></i><span>${VOTE_CHOICES[choice].label}</span><b>${num(model.summary[{ favorevole: 'yes', contrario: 'against', astenuto: 'abstain' }[choice]], 0)}</b></li>`).join('')}${model.summary.secret ? `<li><i style="background:${VOTE_CHOICES.segreto.color}"></i><span>Voto segreto: singoli non noti</span></li>` : ''}</ul>`;
  if (view.colorBy === 'partito') {
    const counts = new Map();
    let unknown = 0;
    for (const seat of model.roster.seats) { const entity = model.entityOf(seat); if (entity) counts.set(entity.id, (counts.get(entity.id) ?? 0) + 1); else if (seat.person) unknown++; }
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => { const item = model.parties.get(id); return `<li><button type="button" class="${view.party === id ? 'active' : ''}" data-hemi-filter-party="${esc(id)}" aria-pressed="${view.party === id}"><i style="background:${item?.color ?? UNKNOWN_COLOR}"></i><span>${esc(item?.entity.abbreviation || item?.entity.officialName || id)}</span><b>${count}</b></button></li>`; }).join('');
    return `<ul class="hemi-legend">${rows}<li><button type="button" class="${view.party === 'nessuno' ? 'active' : ''}" data-hemi-filter-party="nessuno" aria-pressed="${view.party === 'nessuno'}"><i style="background:${UNKNOWN_COLOR}"></i><span>Partito non documentato</span><b>${unknown}</b></button></li></ul><p class="sx-note">Il partito è solo quello documentato (iscrizione con fonte o collegamento dell’amministratore): lista d’elezione e gruppo non sono il partito.</p>`;
  }
  return `<ul class="hemi-legend">${model.roster.groups.map(group => `<li><button type="button" class="${model.group === group.groupId ? 'active' : ''}" data-hemi-filter-group="${esc(group.groupId)}" aria-pressed="${model.group === group.groupId}"><i style="background:${group.color}"></i><span>${esc(group.shortName)}</span><b>${group.seats}</b></button></li>`).join('')}</ul>`;
}

function controls(model, view, counts) {
  if (model.simulated) return `<div class="hemi-controls">
    <div class="hemi-switch" role="group" aria-label="Camera">${['camera', 'senato'].map(chamber => `<button type="button" class="${model.chamber === chamber ? 'active' : ''}" data-hemi-chamber="${chamber}" aria-pressed="${model.chamber === chamber}">${chamber === 'camera' ? 'Camera' : 'Senato'} <small>${counts[chamber]}</small></button>`).join('')}</div>
    <label>Gruppo<select data-hemi-filter="group"><option value="">Tutti</option>${model.roster.groups.map(group => `<option value="${esc(group.groupId)}" ${model.group === group.groupId ? 'selected' : ''}>${esc(group.shortName)} · ${group.seats}</option>`).join('')}</select></label>
    <label>Votazione<select data-hemi-filter="vote"><option value="">Composizione (nessuna)</option>${model.votes.map(item => `<option value="${esc(item.id)}" ${model.vote?.id === item.id ? 'selected' : ''}>${esc(`${shortDate(item.date)} · ${KIND_LABELS[item.kind] ?? 'Votazione'}: ${item.label ?? ''}`.slice(0, 90))}</option>`).join('')}</select></label>
    <button type="button" class="text-link" data-hemi-reset ${model.group || model.vote ? '' : 'disabled'}>Azzera filtri</button>
  </div>`;
  const partyOptions = [...model.parties.values()].map(item => `<option value="${esc(item.entity.id)}" ${view.party === item.entity.id ? 'selected' : ''}>${esc(item.entity.officialName)} · ${item.count}</option>`).join('');
  return `<div class="hemi-controls">
    <div class="hemi-switch" role="group" aria-label="Camera">${['camera', 'senato'].map(chamber => `<button type="button" class="${model.chamber === chamber ? 'active' : ''}" data-hemi-chamber="${chamber}" aria-pressed="${model.chamber === chamber}">${chamber === 'camera' ? 'Camera' : 'Senato'} <small>${counts[chamber]}</small></button>`).join('')}</div>
    <div class="hemi-switch" role="group" aria-label="Colori">${[['gruppo', 'Per gruppo'], ['partito', 'Per partito']].map(([id, label]) => `<button type="button" class="${view.colorBy === id ? 'active' : ''}" data-hemi-color="${id}" aria-pressed="${view.colorBy === id}" ${model.summary ? 'disabled title="Durante una votazione i colori indicano il voto"' : ''}>${label}</button>`).join('')}</div>
    <label>Partito<select data-hemi-filter="party"><option value="">Tutti</option>${partyOptions}<option value="nessuno" ${view.party === 'nessuno' ? 'selected' : ''}>Partito non documentato</option></select></label>
    <label>Gruppo<select data-hemi-filter="group"><option value="">Tutti</option>${model.roster.groups.map(group => `<option value="${esc(group.groupId)}" ${model.group === group.groupId ? 'selected' : ''}>${esc(group.shortName)} · ${group.seats}</option>`).join('')}</select></label>
    <label>Commissione<select data-hemi-filter="committee"><option value="">Tutte</option>${model.committees.map(item => `<option value="${esc(item.id)}" ${model.committee?.id === item.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>
    <label>Votazione<select data-hemi-filter="vote"><option value="">Composizione (nessuna)</option>${model.votes.map(item => `<option value="${esc(item.id)}" ${model.vote?.id === item.id ? 'selected' : ''}>${esc(`${shortDate(item.date)} · ${KIND_LABELS[item.kind] ?? 'Votazione'}: ${item.label ?? ''}`.slice(0, 90))}</option>`).join('')}</select></label>
    <button type="button" class="text-link" data-hemi-reset ${view.party || model.group || model.committee || model.vote ? '' : 'disabled'}>Azzera filtri</button>
  </div>`;
}

// The card of the selected seat: identity from the verified dataset, the game's relation and the simulated vote.
function card(model, state, db, logoFor) {
  const seat = model.selected;
  if (!seat) return `<div class="hemi-card is-empty">${glyph('user', 22)}<p>Tocca un seggio per la scheda del parlamentare: partito, gruppo, ruolo, commissioni, collegio e, in una votazione, il voto simulato.</p></div>`;
  const index = model.roster.seats.indexOf(seat);
  const group = model.byGroup.get(seat.groupId);
  const choice = model.individual?.choices[index];
  const dissent = model.individual?.dissenters.find(item => item.index === index);
  const voteRow = choice ? `<div class="hemi-vote-row"><span class="section-kicker">VOTAZIONE SIMULATA</span>${choice === 'segreto' ? '<strong>Voto segreto: non noto</strong>' : `<strong style="--vote:${VOTE_CHOICES[choice].color}"><i></i>${VOTE_CHOICES[choice].label}</strong>`}${dissent ? `<small>Nella simulazione vota diversamente dal suo gruppo (${esc(LINE_LABELS[dissent.line].toLowerCase())}).</small>` : ''}${seat.person ? '<em>Voto generato dal gioco: non è un voto reale di questa persona.</em>' : ''}</div>` : '';
  const close = '<button type="button" class="hemi-close" data-hemi-close aria-label="Chiudi la scheda">×</button>';
  if (seat.player) {
    const player = state.dataset?.politicians?.find(item => item.id === state.career?.playerId);
    const role = state.parliament?.careerStanding?.committeeRole?.title ?? 'Componente del gruppo';
    return `<div class="hemi-card is-player">${close}<span class="section-kicker">IL TUO SEGGIO · SIMULAZIONE</span><h3>${esc(player?.displayName ?? 'Il tuo politico')}</h3><dl class="hemi-facts"><div><dt>Gruppo</dt><dd>${esc(group?.name ?? '—')}</dd></div><div><dt>Ruolo</dt><dd>${esc(role)}</dd></div><div><dt>Camera</dt><dd>${esc(CHAMBER_LABELS[model.chamber])}</dd></div></dl>${voteRow}<button class="text-link" data-section-tab="carriera" data-section-tab-value="progressione">Incarichi e probabilità ${glyph('route', 14)}</button></div>`;
  }
  if (!seat.person && model.simulated) return `<div class="hemi-card">${close}<span class="section-kicker">SEGGIO DEL GRUPPO · LEGISLATURA SIMULATA</span><h3>${esc(group?.shortName ?? 'Gruppo')}</h3><p class="sx-note">Un eletto della partita: le Camere nate dal voto simulato non hanno parlamentari reali. Il gruppo ha ${num(group?.seats ?? 0, 0)} seggi.</p>${voteRow}</div>`;
  if (!seat.person) return `<div class="hemi-card">${close}<span class="section-kicker">SEGGIO DEL GRUPPO · SCENARIO</span><h3>${esc(group?.shortName ?? 'Gruppo')}</h3><p class="sx-note">Nello scenario il gruppo ha più seggi dei componenti presenti nell’archivio verificato: questo seggio non è attribuito a nessuna persona reale.</p>${voteRow}</div>`;
  const person = seat.person;
  const affiliation = politicianAffiliation(person, db);
  const logo = affiliation?.entity ? logoFor(affiliation.entity) : null;
  const groupInfo = groupAffiliation(person, db);
  const list = electionListOf(person, db);
  const offices = (db.offices ?? []).filter(item => item.politicianId === person.id && !item.endDate && !/mandate$/.test(item.id)).map(item => item.title);
  const committees = committeesOf(person.id, db);
  const contact = (state.game?.contacts ?? []).find(item => item.person?.id === person.id);
  const busy = !state.game || state.game.status === 'ended' || state.game.week.ap < 1 || state.game.resources.politicalCapital < 1 || state.campaign?.status === 'active';
  return `<div class="hemi-card">${close}
    <header>${logo ? `<img src="${esc(logo)}" alt="${esc(`Logo di ${affiliation.entity.officialName}`)}" loading="lazy" />` : `<span class="hemi-card-mark" style="background:${model.colorOf(seat, index)}"></span>`}<div><span class="section-kicker">${esc(model.chamber === 'camera' ? 'DEPUTATO · DATO REALE' : 'SENATORE · DATO REALE')}</span><h3>${esc(personName(person))}</h3></div></header>
    <dl class="hemi-facts">
      <div><dt>Partito</dt><dd>${affiliation ? `${esc(affiliation.entity.officialName)}<small>${esc(BASIS_LABELS[affiliation.basis] ?? affiliation.detail ?? '')}</small>` : 'Non documentato nell’archivio'}</dd></div>
      <div><dt>Gruppo</dt><dd>${esc(groupLabel(groupInfo) ?? group?.name ?? '—')}</dd></div>
      <div><dt>Ruolo</dt><dd>${offices.length ? offices.map(esc).join('<br>') : model.chamber === 'camera' ? 'Deputato' : 'Senatore'}</dd></div>
      <div><dt>${model.chamber === 'camera' ? 'Collegio e circoscrizione' : 'Circoscrizione'}</dt><dd>${esc([person.constituency, person.circoscription].filter(Boolean).join(' · ') || 'Non indicata nella fonte')}</dd></div>
      ${list ? `<div><dt>Eletto nel 2022 con</dt><dd>${esc(list.label)}<small>lista d’elezione, non il partito attuale</small></dd></div>` : ''}
      <div><dt>Commissioni</dt><dd>${committees.length ? committees.map(row => `${esc(row.committee.name)}${row.role !== 'Componente' ? ` · <b>${esc(row.role.toLowerCase())}</b>` : ''}${row.groupLeader ? ' · capogruppo in commissione' : ''}`).join('<br>') : 'Nessuna commissione permanente nella fonte'}</dd></div>
      <div><dt>In carica dal</dt><dd>${esc(shortDate(person.termStart))}</dd></div>
    </dl>
    ${voteRow}
    ${contact ? `<div class="hemi-relation"><span>Rapporto con te (simulato)</span><b>${num(contact.relation, 0)}/100</b><button class="secondary-button" data-game-activity="incontro-parlamentare" data-activity-target-value="${esc(person.id)}" ${busy ? 'disabled' : ''}>Incontra · 1 giorno</button></div>` : ''}
    <p class="sx-note">Identità, gruppo, incarichi e commissioni dal dataset verificato${person.verifiedAt ? ` (${esc(shortDate(person.verifiedAt))})` : ''}.${person.sourceUrl ? ` <a href="${esc(person.sourceUrl)}" target="_blank" rel="noopener noreferrer">Scheda ufficiale ↗</a>` : ''}</p>
  </div>`;
}

function votePanel(model, db) {
  const summary = model.summary;
  if (!summary) return '';
  const outcome = summary.kind === 'fiducia' ? (summary.passed ? ['Fiducia ottenuta', 'good'] : ['Fiducia negata', 'bad']) : summary.passed ? ['Approvata', 'good'] : ['Respinta', 'bad'];
  const rows = summary.groups.map(row => {
    const group = model.byGroup.get(row.groupId);
    return { _class: '', group: `<span class="hemi-group-cell"><i style="background:${group?.color ?? UNKNOWN_COLOR}"></i>${esc(group?.shortName ?? row.groupId)}</span>`, seats: num(row.seats, 0), yes: num(row.yes, 0), no: num(row.no, 0), abstain: num(row.abstain, 0), line: esc(LINE_LABELS[row.line] ?? row.line), dissent: summary.secret ? '—' : num(row.dissent, 0), snipers: summary.secret ? num(row.snipers, 0) : '—' };
  });
  const people = new Map((db.politicians ?? []).map(person => [person.id, person]));
  const dissenters = model.individual?.dissenters ?? [];
  const names = dissenters.slice(0, 16).map(item => `<li><span>${item.player ? '<b>Tu</b>' : esc(personName(people.get(item.personId)) || 'Seggio non attribuito')}</span><small>${esc(model.byGroup.get(item.groupId)?.shortName ?? '')} · ${esc(VOTE_CHOICES[item.choice].label.toLowerCase())} (linea: ${esc(LINE_LABELS[item.line].toLowerCase())})</small></li>`).join('');
  const bar = summary.total ? `<div class="hemi-vote-bar" role="img" aria-label="${esc(`${summary.yes} favorevoli, ${summary.against} contrari, ${summary.abstain} astenuti su ${summary.total}`)}"><i style="width:${summary.yes / summary.total * 100}%;background:${VOTE_CHOICES.favorevole.color}"></i><i style="width:${summary.against / summary.total * 100}%;background:${VOTE_CHOICES.contrario.color}"></i><i style="width:${summary.abstain / summary.total * 100}%;background:${VOTE_CHOICES.astenuto.color}"></i>${summary.needed ? `<b style="left:${summary.needed / summary.total * 100}%" title="Maggioranza richiesta"></b>` : ''}</div>` : '';
  return `<section class="hemi-vote">
    <header><div>${badge('VOTAZIONE SIMULATA', 'warn')} ${badge(outcome[0], outcome[1])}${summary.secret ? ` ${badge('Voto segreto')}` : ''}</div><h3>${esc(summary.label ?? KIND_LABELS[summary.kind])}</h3><small>${esc(KIND_LABELS[summary.kind] ?? 'Votazione')} · ${esc(CHAMBER_LABELS[summary.chamber])} · ${esc(shortDate(summary.date))}</small></header>
    <div class="hemi-vote-totals"><div><small>Favorevoli</small><strong>${num(summary.yes, 0)}</strong></div><div><small>Contrari</small><strong>${num(summary.against, 0)}</strong></div><div><small>Astenuti</small><strong>${num(summary.abstain, 0)}</strong></div><div><small>Maggioranza richiesta</small><strong>${summary.needed ? num(summary.needed, 0) : '—'}</strong></div><div><small>${summary.secret ? 'Franchi tiratori stimati' : 'Voti discordanti'}</small><strong>${num(summary.secret ? summary.snipers : summary.dissent, 0)}</strong></div></div>
    ${bar}
    ${summary.groups.length ? table([['group', 'Gruppo'], ['seats', 'Seggi', 'num'], ['yes', 'Sì', 'num'], ['no', 'No', 'num'], ['abstain', 'Astenuti', 'num'], ['line', 'Linea', 'nowrap'], ['dissent', 'Discordanti', 'num'], ['snipers', 'Franchi tiratori', 'num']], rows) : '<p class="sx-empty">Dettaglio per gruppo non disponibile per questa votazione (registrata prima dell’aggiornamento).</p>'}
    ${summary.secret ? '<p class="sx-note">Nel voto segreto nessuno sa chi ha votato cosa: i franchi tiratori sono una stima (voti mancati alla maggioranza rispetto a un gruppo compatto), mai attribuita a una persona.</p>' : dissenters.length ? `<div class="hemi-dissent"><span class="section-kicker">VOTI DIVERSI DALLA LINEA DEL GRUPPO · SIMULATI</span><ul>${names}</ul>${dissenters.length > 16 ? `<p class="sx-note">e altri ${dissenters.length - 16}.</p>` : ''}</div>` : '<p class="sx-note">Tutti i gruppi hanno votato compatti.</p>'}
    <p class="sx-note"><b>VOTAZIONE SIMULATA</b>: il gioco decide i voti di ogni gruppo; i voti dei singoli parlamentari reali sono ricostruiti da quei totali e non corrispondono a votazioni reali.</p>
  </section>`;
}

function committeePanel(model, db) {
  const committee = model.committee;
  if (!committee) return '';
  const people = new Map((db.politicians ?? []).map(person => [person.id, person]));
  const rows = (db.committeeMemberships ?? []).filter(row => row.committeeId === committee.id);
  const officers = ['Presidente', 'Vicepresidente', 'Segretario'].map(role => [role, rows.filter(row => row.role === role).map(row => personName(people.get(row.politicianId)))]);
  return `<section class="hemi-committee"><span class="section-kicker">COMMISSIONE PERMANENTE · DATO REALE</span><h3>${esc(committee.name)}</h3><dl class="hemi-facts">${officers.map(([role, names]) => `<div><dt>${role === 'Presidente' ? 'Presidenza' : role === 'Vicepresidente' ? 'Vicepresidenti' : 'Segretari'}</dt><dd>${names.length ? names.map(esc).join(', ') : role === 'Presidente' ? 'Vacante secondo la fonte' : '—'}</dd></div>`).join('')}<div><dt>Componenti in carica</dt><dd>${rows.length}</dd></div></dl><p class="sx-note">Fonte: ${esc(committee.sourceName)} · verificata il ${esc(shortDate(committee.verifiedAt))}. <a href="${esc(committee.sourceUrl)}" target="_blank" rel="noopener noreferrer">Dati ufficiali ↗</a></p></section>`;
}

// The accessible alternative to the drawing: the members that match the filters, as a list of buttons.
function memberList(model, db, view) {
  if (model.simulated) return model.group ? `<p class="sx-note">${esc(model.byGroup.get(model.group)?.name ?? 'Gruppo')}: ${num(model.byGroup.get(model.group)?.seats ?? 0, 0)} seggi nella legislatura simulata.</p>` : '<p class="sx-note">Scegli un gruppo per evidenziarne i seggi.</p>';
  if (!(view.party || model.group || model.committee)) return '<p class="sx-note">Scegli un partito, un gruppo o una commissione per l’elenco dei componenti (utile anche da tastiera).</p>';
  const seats = model.roster.seats.filter(model.matches);
  const items = seats.slice(0, 60).map(seat => `<li><button type="button" data-hemi-seat="${esc(seatKey(seat))}" class="${model.selected && seatKey(model.selected) === seatKey(seat) ? 'active' : ''}"><i style="background:${model.colorOf(seat, model.roster.seats.indexOf(seat))}"></i><span>${esc(seat.player ? 'Il tuo seggio' : seat.person ? personName(seat.person) : 'Seggio non attribuito')}</span><small>${esc(model.byGroup.get(seat.groupId)?.shortName ?? '')}</small></button></li>`).join('');
  return `<ul class="hemi-members">${items}</ul>${seats.length > 60 ? `<p class="sx-note">Primi 60 di ${seats.length}: restringi i filtri per vedere gli altri.</p>` : ''}`;
}

export function renderHemicycle(state, { politicians = [], db = {}, view = {}, logoFor = () => null } = {}) {
  const settings = { ...HEMICYCLE_DEFAULTS, ...view };
  const model = hemicycleModel(state, { politicians, db, view: settings });
  if (!model) return '';
  if (!politicians.length && !model.simulated) return `<section class="hemicycle sx-card" id="hemicycle"><span class="section-kicker">EMICICLO INTERATTIVO</span><p class="sx-empty">Carico i parlamentari in carica…</p></section>`;
  const counts = Object.fromEntries(['camera', 'senato'].map(chamber => [chamber, (state.parliament.chambers?.[chamber]?.groups ?? []).reduce((sum, group) => sum + (group.simulatedSeats ?? 0), 0)]));
  const placeholders = model.simulated ? 0 : model.roster.groups.reduce((sum, group) => sum + group.placeholders, 0);
  const intro = model.simulated
    ? `Ogni punto è un seggio della ${esc(state.parliament.legislature?.label ?? 'legislatura simulata')}: i gruppi nati dal voto della partita e il tuo seggio. Nessun parlamentare reale siede in queste Camere. La disposizione è grafica; i gruppi vanno da sinistra a destra secondo la collocazione dei partiti.`
    : 'Ogni punto è un seggio: parlamentari reali in carica (dati verificati) e il tuo seggio nella partita. La disposizione è grafica, non la posizione fisica in Aula; i gruppi vanno da sinistra a destra secondo la collocazione dei loro componenti.';
  return `<section class="hemicycle" id="hemicycle">
    <header class="hemi-head"><div><span class="section-kicker">EMICICLO INTERATTIVO · RAPPRESENTAZIONE GRAFICA</span><h2>${esc(CHAMBER_LABELS[model.chamber])}</h2><p>${intro}</p></div><span class="hemi-count">${model.visible === model.roster.total ? `${num(model.roster.total, 0)} seggi` : `${num(model.visible, 0)} di ${num(model.roster.total, 0)}`}</span></header>
    ${controls(model, settings, counts)}
    <div class="hemi-layout">
      <div class="hemi-stage">${svg(model, settings)}${legend(model, settings)}${placeholders ? `<p class="sx-note">${placeholders} ${placeholders === 1 ? 'seggio' : 'seggi'} dello scenario senza un componente nell’archivio verificato: sono in grigio e non sono attribuiti a nessuno.</p>` : ''}</div>
      <aside class="hemi-side">${card(model, state, db, logoFor)}${model.simulated ? '' : committeePanel(model, db)}${memberList(model, db, settings)}</aside>
    </div>
    ${votePanel(model, db)}
  </section>`;
}
