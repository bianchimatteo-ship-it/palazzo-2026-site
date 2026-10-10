// The Quirinale in the electoral centre (tab "Quirinale"): the election of the President of the Republic (the assembly
// of the grand electors, the field of candidates, the negotiations, the secret ballots and their quorum) and, when the
// player is the President, the powers of the office. Everything is simulation: the candidates are figures of the game.
import { formatDate } from '../core/time.js?v=20261010-2';
import { CAMP_LABELS, CANDIDATE_TYPES, LEDGER_RULES, PRESIDENCY_RULES, PRESIDENT_ACTIVITIES } from '../data/simulation/presidency-rules.js?v=20261010-2';
import { ITALIAN_REGIONS } from '../data/regions.js?v=20261010-2';
import { termEndOf, electionPhaseLabel, lineText } from '../core/presidency-engine.js?v=20261010-2';
import { arrow, badge, bar, card, empty, esc, kpi, num, table } from './sections-kit.js?v=20261010-2';

const day = date => date ? formatDate(date) : '—';
const shortName = label => String(label ?? '').replace(/\s*\(figura simulata\)$/, '');
const typeLabel = candidate => candidate.isPlayer ? 'Il tuo nome' : (CANDIDATE_TYPES[candidate.type]?.label ?? 'Candidato');
const campLabel = camp => CAMP_LABELS[camp] ?? camp;
const option = (value, label, selected = false) => `<option value="${esc(value)}" ${selected ? 'selected' : ''}>${esc(label)}</option>`;
const weeksUntil = (from, to) => Math.max(0, Math.ceil((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 604800000));

// ---------- the state of the election ----------
function summary(state, view) {
  const { election, presidency, eligibility, schedule } = view;
  const today = state.clock.currentDate;
  if (election) {
    const last = election.ballots.at(-1);
    return `<div class="sx-kpis">${[
      kpi({ label: 'Grandi elettori', value: num(election.assembly.total, 0), note: `${election.assembly.camera} deputati · ${election.assembly.senato} senatori${election.assembly.lifeSenators ? ` (${election.assembly.lifeSenators} a vita)` : ''} · ${election.assembly.delegates} delegati regionali` }),
      kpi({ label: 'Scrutini 1–3', value: num(election.assembly.twoThirds, 0), note: 'due terzi dell’assemblea', tone: election.ballots.length < 3 ? 'warn' : '' }),
      kpi({ label: 'Dal 4º scrutinio', value: num(election.assembly.absolute, 0), note: 'maggioranza assoluta', tone: election.ballots.length >= 3 ? 'warn' : '' }),
      kpi({ label: 'Scrutini svolti', value: num(election.ballots.length, 0), note: election.phase === 'trattative' ? `il primo il ${day(election.firstBallot)}` : last ? `ultimo: ${shortName(last.votes[0]?.label ?? '—')} ${last.leaderVotes}` : '' }),
      kpi({ label: 'Fase', value: esc(electionPhaseLabel(election)), note: election.delayed ? esc(election.delayed) : `mandato in scadenza il ${day(election.termEnds)}` })
    ].join('')}</div>`;
  }
  const incumbent = presidency.incumbent;
  const waiting = presidency.postponed ? `<p class="sx-note">${esc(presidency.postponed.reason)} Resta in carica il Presidente (prorogatio).</p>` : '';
  return `<div class="sx-kpis">${[
    kpi({ label: 'Il Presidente in carica', value: esc(incumbent.kind === 'giocatore' ? 'Sei tu' : shortName(incumbent.label)), note: `dal ${day(incumbent.since)}` }),
    kpi({ label: 'Il mandato scade', value: esc(day(termEndOf(incumbent))), note: `${PRESIDENCY_RULES.termYears} anni dal giuramento` }),
    kpi({ label: 'Si apre la corsa', value: esc(day(schedule.opensAt)), note: `tra ${weeksUntil(today, schedule.opensAt)} settimane`, tone: weeksUntil(today, schedule.opensAt) <= 12 ? 'warn' : '' }),
    kpi({ label: 'Tu al Quirinale', value: eligibility.eligible ? 'Eleggibile' : 'Non ancora', note: eligibility.eligible ? `${eligibility.age} anni` : esc(eligibility.problems[0] ?? ''), tone: eligibility.eligible ? 'good' : '' })
  ].join('')}</div>${waiting}`;
}

// ---------- the assembly ----------
function assemblyCard(election) {
  const rows = [...election.blocs].sort((a, b) => b.electors - a.electors).map(bloc => ({
    bloc: `<strong>${esc(bloc.label)}</strong><small>${esc(campLabel(bloc.camp))}${bloc.governing ? ' · maggioranza' : ''}${bloc.isPlayer ? ' · il tuo partito' : ''}</small>`,
    camera: num(bloc.camera, 0), senato: num(bloc.senato + bloc.lifeSenators, 0), delegates: num(bloc.delegates, 0), total: `<strong>${num(bloc.electors, 0)}</strong>`,
    line: esc(bloc.free ? 'libero' : election.ballots.length ? lineText(bloc.line, election).replace(/^vota /, '') : 'ancora da definire'),
    _class: bloc.isPlayer ? 'is-player' : ''
  }));
  const regions = election.assembly.regions.map(region => `<li><strong>${esc(region.region)}</strong><small>${region.delegates} ${region.delegates === 1 ? 'delegato' : 'delegati'} · maggioranza ${esc(campLabel(region.majorityCamp))}${region.delegates > 1 ? `, minoranza ${esc(campLabel(region.minorityCamp))}` : ''}</small></li>`).join('');
  return card({
    kicker: 'IL PARLAMENTO IN SEDUTA COMUNE · SIMULAZIONE', title: `${num(election.assembly.total, 0)} grandi elettori`,
    body: `${table([['bloc', 'Gruppo'], ['camera', 'Camera', 'num'], ['senato', 'Senato', 'num'], ['delegates', 'Delegati', 'num'], ['total', 'Totale', 'num'], ['line', 'Linea']], rows)}
      <details class="cp-past"><summary>I ${election.assembly.delegates} delegati regionali (tre per Regione, uno per la Valle d’Aosta)</summary><ul class="qr-regions">${regions}</ul></details>
      <p class="sx-note">I delegati sono scelti dai consigli regionali: due dalla maggioranza e uno dall’opposizione, in proporzione ai gruppi. Il voto è segreto: i franchi tiratori si contano, mai si nominano.</p>`
  });
}

// ---------- the field and the projection ----------
function fieldCard(view) {
  const { election, role } = view;
  const viability = election.viability ?? {};
  const mine = role?.leader;
  const blocLabel = id => election.blocs.find(item => item.id === id)?.label ?? id;
  const rows = [...election.candidates].sort((a, b) => Number(a.withdrawn) - Number(b.withdrawn) || (viability[b.id] ?? 0) - (viability[a.id] ?? 0)).map(candidate => {
    const sponsors = (candidate.sponsors ?? []).map(blocLabel);
    const status = candidate.withdrawn ? badge(candidate.reason === 'bruciato' ? 'Bruciato' : 'Ritirato', 'bad') : candidate.reserve && !candidate.called && election.ballots.length < 6 ? badge('Di riserva', 'neutral') : badge('In corsa', 'good');
    const actions = candidate.withdrawn || !mine ? '' : `<button class="text-link" data-presidency-action="sponsor" data-candidate="${esc(candidate.id)}">Sostieni</button> <button class="text-link" data-presidency-action="veto" data-candidate="${esc(candidate.id)}">Veto</button>`;
    return {
      name: `<strong>${esc(shortName(candidate.label))}</strong><small>${esc(typeLabel(candidate))}${candidate.camp !== 'centro' ? ` · ${esc(campLabel(candidate.camp))}` : ''}</small>`,
      prestige: num(candidate.prestige, 0), breadth: num(candidate.breadth, 0),
      sponsors: sponsors.length ? esc(sponsors.slice(0, 3).join(', ')) + (sponsors.length > 3 ? ` +${sponsors.length - 3}` : '') : '<small>nessuno</small>',
      viability: candidate.withdrawn ? '—' : `<span class="eh-share"><b>${Math.round((viability[candidate.id] ?? 0) * 100)}%</b>${bar((viability[candidate.id] ?? 0) * 100, (viability[candidate.id] ?? 0) >= 0.6 ? 'good' : '')}</span>`,
      status, actions, _class: candidate.isPlayer ? 'is-player' : ''
    };
  });
  const columns = [['name', 'Candidato'], ['prestige', 'Prestigio', 'num'], ['breadth', 'Ampiezza', 'num'], ['sponsors', 'Sponsor'], ['viability', 'Accettabile per'], ['status', 'Stato']];
  if (mine) columns.push(['actions', 'Mosse']);
  return card({ kicker: 'I NOMI IN CAMPO · FIGURE SIMULATE', title: 'Candidati e negoziazioni', body: `${table(columns, rows)}<p class="sx-note">Prestigio: quanto è alta la figura. Ampiezza: quanti campi potrebbero votarla. «Accettabile per» è la parte dell’assemblea che potrebbe votarla: per i due terzi servono nomi larghi, per la maggioranza assoluta basta un campo compatto.</p>` });
}
function projectionCard(view) {
  const { election, projection } = view;
  if (!projection) return '';
  const needed = projection.rule.needed;
  const rows = projection.rows.slice(0, 5).map(row => `<li><span><strong>${esc(shortName(row.label))}</strong><small>${row.votes >= needed ? 'oltre il quorum' : `mancano ${needed - row.votes} voti`}</small></span><b>${num(row.votes, 0)}</b>${bar(row.votes / needed * 100, row.votes >= needed ? 'good' : '')}</li>`).join('');
  return card({ kicker: `PROIEZIONE DEL ${projection.ballot}º SCRUTINIO · SIMULATA`, title: `Quorum: ${num(needed, 0)} voti (${esc(projection.rule.label)})`, body: `<ul class="eh-bars">${rows}</ul><p class="sx-note">Previsione sulle linee attuali dei gruppi, senza i franchi tiratori del voto segreto: ${num(projection.blank, 0)} schede bianche e ${num(projection.scattered, 0)} voti dispersi attesi.</p>` });
}
function ballotsCard(view) {
  const { election } = view;
  const rows = [...election.ballots].reverse().map(ballot => ({
    n: `${ballot.n}º`, date: esc(day(ballot.date)), rule: esc(ballot.rule === 'due-terzi' ? 'due terzi' : 'maggioranza assoluta'), needed: num(ballot.needed, 0),
    leader: `<strong>${esc(shortName(ballot.votes[0]?.label ?? '—'))}</strong>`, votes: num(ballot.leaderVotes, 0), blank: num(ballot.blank, 0), scattered: num(ballot.scattered, 0), absent: num(ballot.absent, 0),
    outcome: ballot.elected ? badge('Eletto', 'good') : badge('Nessun eletto', 'neutral')
  }));
  return card({ kicker: 'GLI SCRUTINI · SEGRETI', title: `${election.ballots.length} ${election.ballots.length === 1 ? 'scrutinio' : 'scrutini'}`, body: table([['n', 'N.', 'num'], ['date', 'Data'], ['rule', 'Quorum'], ['needed', 'Voti richiesti', 'num'], ['leader', 'In testa'], ['votes', 'Voti', 'num'], ['blank', 'Bianche', 'num'], ['scattered', 'Disperse', 'num'], ['absent', 'Assenti', 'num'], ['outcome', 'Esito']], rows, { empty: 'Nessuno scrutinio ancora: il primo è il ' + day(election.firstBallot) + '.' }) });
}

// ---------- the moves of the player ----------
function movesCard(state, view) {
  const { election, role, eligibility, standing } = view;
  const candidates = election.candidates.filter(item => !item.withdrawn);
  const mine = election.candidates.find(item => item.isPlayer && !item.withdrawn);
  const roleText = role?.leader ? `Guidi ${esc(election.blocs.find(item => item.id === election.player.blocId)?.label ?? 'il tuo gruppo')}: decidi la linea dei suoi grandi elettori.` : role?.delegate ? 'Sei delegato della tua Regione: il tuo voto è segreto.' : role?.elector ? 'Sei un grande elettore (deputato o senatore): il tuo voto è segreto.' : 'Non sei un grande elettore: puoi solo seguire la corsa (o candidarti, se hai i requisiti).';
  const candidacy = mine
    ? `<div class="qr-move"><span><strong>Sei in corsa</strong><small>${esc(shortName(mine.label))} · prestigio ${num(mine.prestige, 0)}, ampiezza ${num(mine.breadth, 0)}${mine.sponsors.length ? '' : ' · nessuno sponsor'}</small></span><button class="secondary-button" data-presidency-action="withdraw">Ritira la candidatura</button></div>`
    : `<div class="qr-move"><span><strong>Candidarti</strong><small>${eligibility.eligible ? `Hai ${eligibility.age} anni. Il tuo profilo: prestigio ${num(standing?.prestige, 0)}, ampiezza ${num(standing?.breadth, 0)}, ${Math.round((standing?.partisan ?? 0) * 100)}% di parte. Se sei eletto lasci ogni altra carica.` : esc(eligibility.problems[0] ?? '')}</small></span><button class="primary-button" data-presidency-action="declare" ${eligibility.eligible ? '' : 'disabled'}>Candidati al Quirinale</button></div>`;
  const options = candidates.map(item => option(item.id, shortName(item.label))).join('');
  const blocOptions = election.blocs.filter(item => item.id !== election.player.blocId && !item.free).map(item => option(item.id, `${item.label} (${item.electors})`)).join('');
  const lineMoves = role?.leader ? `<div class="qr-move"><span><strong>Linea del tuo gruppo</strong><small>Sostieni un nome (2 capitale, 1 giorno): gli alleati dello stesso campo possono seguirti. Un veto (3 capitale) lo blocca.</small></span><span class="qr-fields"><select data-presidency-field="candidate" aria-label="Candidato">${options}</select><button class="secondary-button" data-presidency-action="sponsor">Sostieni</button><button class="secondary-button" data-presidency-action="veto">Veto</button><button class="text-link" data-presidency-action="line-blank">Scheda bianca</button></span></div>` : '';
  const deal = (role?.leader || role?.elector || role?.delegate) && blocOptions ? `<div class="qr-move"><span><strong>Cerca un accordo</strong><small>Chiedi a un altro gruppo di votare un candidato (3 capitale, 1 giorno). Se accetta, poi chiederà qualcosa in cambio.</small></span><span class="qr-fields"><select data-presidency-field="bloc" aria-label="Gruppo">${blocOptions}</select><select data-presidency-field="deal-candidate" aria-label="Candidato">${options}</select><button class="secondary-button" data-presidency-action="deal">Tratta</button></span></div>` : '';
  const vote = role?.elector || role?.delegate ? `<div class="qr-move"><span><strong>Il tuo voto segreto</strong><small>Vale un voto del tuo gruppo, spostato dove decidi. Si applica dal prossimo scrutinio: ${election.player.vote ? `oggi: ${esc(election.player.vote === 'linea' ? 'come il gruppo' : election.player.vote === 'bianca' ? 'scheda bianca' : shortName(election.candidates.find(item => item.id === election.player.vote)?.label))}` : 'come il gruppo, se non scegli'}.</small></span><span class="qr-fields"><select data-presidency-field="vote" aria-label="Il tuo voto">${option('linea', 'Come il mio gruppo', !election.player.vote || election.player.vote === 'linea')}${option('bianca', 'Scheda bianca', election.player.vote === 'bianca')}${candidates.map(item => option(item.id, shortName(item.label), election.player.vote === item.id)).join('')}</select><button class="secondary-button" data-presidency-action="vote">Registra</button></span></div>` : '';
  return card({ kicker: 'LE TUE MOSSE', title: `Il tuo ruolo: ${role?.leader ? 'capo di un gruppo' : role?.delegate ? 'delegato regionale' : role?.elector ? 'grande elettore' : 'osservatore'}`, body: `<p class="sx-note">${roleText}</p><div class="qr-moves">${candidacy}${lineMoves}${deal}${vote}</div>` });
}
function chronicleCard(presidency) {
  const rows = presidency.log.slice(0, 12).map(item => `<li><time>${esc(day(item.date))}</time><span>${esc(item.text)}</span></li>`).join('');
  return card({ kicker: 'CRONACA · SIMULAZIONE', title: 'Quello che succede al Colle', body: rows ? `<ul class="qr-log">${rows}</ul>` : '<p class="sx-empty">Nessuna notizia ancora.</p>' });
}
function historyCard(presidency) {
  const rows = [...presidency.history].reverse().map(item => ({ date: esc(day(item.date)), who: `<strong>${esc(shortName(item.president))}</strong>`, how: item.reconstructed ? 'precedente alla partita' : item.resigned ? 'dimissioni' : `${item.ballots}º scrutinio · ${num(item.votes, 0)} voti${item.rule === 'due-terzi' ? ' (due terzi)' : ''}` }));
  return card({ kicker: 'I PRESIDENTI DELLA PARTITA', title: 'Storia del Colle', body: table([['date', 'Elezione'], ['who', 'Presidente'], ['how', 'Esito']], rows, { empty: 'Il primo settennato della partita è quello in corso.' }) });
}
function rulesCard() {
  return card({ kicker: 'COME FUNZIONA', title: 'L’elezione del Presidente', body: `<ul class="eh-rules">${PRESIDENCY_RULES.notes.map(note => `<li><span>${esc(note)}</span></li>`).join('')}</ul>` });
}

// ---------- the President ----------
function powersCard(state, view) {
  const { presidency, semester } = view;
  const incumbent = presidency.incumbent;
  const week = state.game.week.index;
  const ap = state.game.week.ap;
  const activities = PRESIDENT_ACTIVITIES.map(activity => {
    const last = incumbent.actions?.[activity.id];
    const wait = last !== undefined && week - last < (activity.cooldownWeeks ?? 0) ? `dalla settimana ${last + activity.cooldownWeeks}` : null;
    const blocked = wait || ap < (activity.cost.ap ?? 0) || (state.game.resources.politicalCapital ?? 0) < (activity.cost.capital ?? 0);
    const region = activity.target === 'region' ? `<select data-presidency-field="region" aria-label="Regione">${ITALIAN_REGIONS.map(item => option(item, item, item === state.game.place?.region)).join('')}</select>` : '';
    return `<li><span><strong>${esc(activity.label)}</strong><small>${esc(activity.detail)} · ${activity.cost.ap ?? 0} giorno${activity.cost.capital ? ` · ${activity.cost.capital} capitale` : ''}${wait ? ` · ${esc(wait)}` : ''}</small></span><span class="qr-fields">${region}<button class="secondary-button" data-presidency-action="activity" data-activity="${esc(activity.id)}" ${blocked ? 'disabled' : ''}>Fai</button></span></li>`;
  }).join('');
  const laws = (state.parliament?.laws ?? []).filter(law => law.auto && law.stage === 'approved' && !law.returned && law.updatedAt && Math.round((Date.parse(`${state.clock.currentDate}T12:00:00`) - Date.parse(`${law.updatedAt}T12:00:00`)) / 86400000) <= PRESIDENCY_RULES.returnWindowDays);
  const lawRows = laws.map(law => `<li><span><strong>${esc(law.title)}</strong><small>approvata il ${esc(day(law.updatedAt))} · promulgazione entro ${PRESIDENCY_RULES.returnWindowDays} giorni</small></span><button class="secondary-button" data-presidency-action="return-law" data-law="${esc(law.id)}">Rinvia alle Camere</button></li>`).join('');
  const senators = incumbent.lifeSenators ?? [];
  const dissolveWhy = semester.active ? `Semestre bianco dal ${day(semester.since)}: non puoi sciogliere le Camere.` : 'Si può sciogliere le Camere solo con una crisi di governo senza soluzione o consultazioni fallite.';
  return card({
    kicker: 'I POTERI DEL PRESIDENTE · SIMULAZIONE', title: 'Quello che puoi fare',
    body: `<ul class="qr-actions">${activities}</ul>
      <h4 class="cp-sub">Leggi approvate</h4>${laws.length ? `<ul class="qr-actions">${lawRows}</ul>` : '<p class="sx-empty">Nessuna legge in attesa di promulgazione: quando le Camere ne approvano una hai trenta giorni per rinviarla (una volta sola, art. 74).</p>'}
      <h4 class="cp-sub">Governo e Camere</h4><ul class="qr-actions"><li><span><strong>Consultazioni e incarico</strong><small>Alla nascita di un governo o dopo una crisi decidi a chi affidare l’incarico: la maggioranza più solida, un’alternativa, un governo del Presidente. La decisione arriva in agenda.</small></span></li>
      <li><span><strong>Scioglimento delle Camere</strong><small>${esc(dissolveWhy)}</small></span><button class="secondary-button" data-presidency-action="dissolve" ${semester.active ? 'disabled' : ''}>Sciogli le Camere</button></li></ul>
      <h4 class="cp-sub">Senatori a vita (${senators.length} su ${PRESIDENCY_RULES.lifeSenatorLimit})</h4><ul class="qr-actions"><li><span><strong>Nomina per altissimi meriti</strong><small>Una nomina all’anno: aumenta il credito del Presidente.${senators.length ? ` Ultima: ${esc(senators.at(-1).label)} (${esc(day(senators.at(-1).date))}).` : ''}</small></span><span class="qr-fields"><select data-presidency-field="senator" aria-label="Profilo"><option value="scienza">Scienza</option><option value="arte">Arte e cultura</option><option value="impresa">Impresa e lavoro</option><option value="servizio">Servizio pubblico</option></select><button class="secondary-button" data-presidency-action="senator" ${senators.length >= PRESIDENCY_RULES.lifeSenatorLimit ? 'disabled' : ''}>Nomina</button></span></li></ul>
      <h4 class="cp-sub">Dimissioni</h4><ul class="qr-actions"><li><span><strong>Lasciare il Colle</strong><small>Il Presidente del Senato ti sostituisce e il Parlamento elegge il successore entro quindici giorni. Sei senatore a vita di diritto.</small></span><button class="secondary-button danger" data-presidency-action="resign">Dimettiti</button></li></ul>`
  });
}
// The commitments the decisions of the term have opened (they come due and are checked) and the ones already verified.
function ledgerCard(state, view) {
  const incumbent = view.presidency.incumbent;
  const week = state.game.week.index;
  const open = (incumbent.ledger ?? []).map(item => `<li><span><strong>${esc(LEDGER_RULES[item.kind]?.label ?? item.kind)}</strong><small>${esc(day(item.date))} · verifica tra ${Math.max(0, item.dueWeek - week)} settimane${item.area ? ` · tema: ${esc(item.area)}` : ''}${item.profile ? ` · ${esc(item.profile)}` : ''}</small></span></li>`).join('');
  const done = (incumbent.verified ?? []).slice(0, 6).map(item => `<li class="${item.success ? 'good' : 'bad'}"><span><strong>${esc(item.label)}</strong><small>${esc(item.text)}</small></span><b class="tone-${item.success ? 'good' : 'bad'}">${item.success ? 'Riuscito' : 'Non riuscito'}</b></li>`).join('');
  return card({ kicker: 'IMPEGNI E VERIFICHE', title: 'Quello che le tue scelte hanno messo in moto', body: `<h4 class="cp-sub">In attesa di verifica (${(incumbent.ledger ?? []).length})</h4>${open ? `<ul class="qr-actions">${open}</ul>` : '<p class="sx-empty">Nessun impegno aperto: lettere, messaggi, nomine e visite ne aprono uno, e dopo qualche settimana si controlla che cosa hanno prodotto davvero.</p>'}<h4 class="cp-sub">Verificati</h4>${done ? `<ul class="qr-actions">${done}</ul>` : '<p class="sx-empty">Nessuna verifica ancora.</p>'}` });
}
function creditCard(view) {
  const incumbent = view.presidency.incumbent;
  const acts = (incumbent.acts ?? []).slice(0, 8).map(item => `<li><time>${esc(day(item.date))}</time><span>${esc(item.text ?? item.act)} <b class="tone-${item.credit >= 0 ? 'good' : 'bad'}">${item.credit >= 0 ? '+' : ''}${num(item.credit, 1)}</b></span></li>`).join('');
  return card({ kicker: 'CREDITO ISTITUZIONALE', title: `${num(incumbent.credit ?? 0, 0)}/100`, body: `${bar(incumbent.credit ?? 0, (incumbent.credit ?? 0) >= 60 ? 'good' : (incumbent.credit ?? 0) < 35 ? 'bad' : '')}<p class="sx-note">Il credito con le Camere e con il Paese: un Presidente rispettato calma la maggioranza e può essere confermato alla scadenza; uno che lo perde aggiunge attrito. Non si governa: si garantisce.</p>${acts ? `<ul class="qr-log">${acts}</ul>` : ''}` });
}

export function renderQuirinale(state, view) {
  if (!state.game || !view) return empty('Crea un politico per seguire il Quirinale.');
  const { election, isPlayer } = view;
  const blocks = [];
  blocks.push(card({ kicker: isPlayer ? 'IL TUO MANDATO' : 'IL QUIRINALE · SIMULAZIONE', title: isPlayer ? 'Sei il Presidente della Repubblica' : election ? 'Si elegge il Presidente della Repubblica' : 'Il Presidente della Repubblica', body: summary(state, view) }));
  if (isPlayer) blocks.push(`<div class="sx-grid two">${powersCard(state, view)}${creditCard(view)}</div>`, ledgerCard(state, view));
  if (election) {
    blocks.push(`<div class="sx-grid two">${movesCard(state, view)}${projectionCard(view)}</div>`, fieldCard(view), assemblyCard(election), ballotsCard(view));
  }
  blocks.push(`<div class="sx-grid two">${chronicleCard(view.presidency)}${historyCard(view.presidency)}</div>`);
  blocks.push(rulesCard());
  return blocks.join('');
}
