// The career as four tracks that move at different speeds: institutions won at the polls, the party, Parliament and
// the Government. For each one: where the player stands, the next step, what it takes, the odds (the same functions
// the engines use to decide) and what is blocking it. Nothing here is granted: it only reads the state.
import { costProblem, nextPartyRank, partyAdvancementOdds, upcomingElections } from './career-engine.js?v=20260925-7';
import { activeMinisters, canManageParliament, CONTEST_COST, CONTEST_WINDOW_DAYS, governmentPostOdds, governmentPostProblems, nextParliamentaryRole, PARLIAMENTARY_ROLES } from './parliament-engine.js?v=20260925-7';
import { isPrimeMinister } from './roles.js?v=20260925-7';
import { PARTY_RANKS } from '../data/simulation/career-rules.js?v=20260925-7';
import { advancementOdds, progressionFactors } from './progression-engine.js?v=20260925-7';
import { formatDate } from './time.js?v=20260925-7';

const day = date => date ? formatDate(date) : '';
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000);
// The elected offices of Italian politics, from the town council to Europe (a map of stages, not a forced ladder).
export const INSTITUTION_STEPS = Object.freeze([
  { id: 'consigliere-comunale', label: 'Consigliere comunale', level: 'comunale', test: /consigliere comunale|consigliere delegato \(comunale\)/i },
  { id: 'assessore-comunale', label: 'Assessore comunale', level: 'comunale', test: /assessore comunale/i },
  { id: 'sindaco', label: 'Sindaco', level: 'comunale', test: /^sindaco/i },
  { id: 'consigliere-regionale', label: 'Consigliere regionale', level: 'regionale', test: /consigliere regionale|consigliere delegato \(regionale\)/i },
  { id: 'assessore-regionale', label: 'Assessore regionale', level: 'regionale', test: /assessore regionale/i },
  { id: 'presidente-regione', label: 'Presidente di Regione', level: 'regionale', test: /presidente (di|della) regione/i },
  { id: 'parlamentare', label: 'Deputato o Senatore', level: 'politiche', test: /^(deputato|senatore)(?! al parlamento europeo)/i },
  { id: 'eurodeputato', label: 'Deputato al Parlamento europeo', level: 'europee', test: /parlamento europeo/i }
]);
const ELECTION_OPENS = { comunale: 'consigliere comunale o sindaco', regionale: 'consigliere regionale o presidente di Regione', politiche: 'un seggio alla Camera o al Senato', europee: 'un seggio al Parlamento europeo' };

export function playerStatsOf(state) {
  const id = state?.career?.playerId;
  return Object.fromEntries((state?.dataset?.statistics ?? []).filter(item => item.subjectId === id).map(item => [item.metric, item.value]));
}
function playerOffices(state) {
  const id = state?.career?.playerId;
  return (state?.dataset?.offices ?? []).filter(item => item.politicianId === id);
}

function institutionTrack(state) {
  const offices = playerOffices(state);
  const steps = INSTITUTION_STEPS.map(step => {
    const matches = offices.filter(office => step.test.test(office.title ?? ''));
    const open = matches.find(office => !office.endDate);
    return { id: step.id, label: step.label, level: step.level, done: matches.length > 0 && !open, current: Boolean(open), since: open?.startDate ?? matches[0]?.startDate ?? null };
  });
  const next = upcomingElections(state.game).find(entry => entry.status !== 'missed') ?? null;
  const held = steps.filter(step => step.current).map(step => step.label);
  return {
    id: 'istituzioni', label: 'Istituzioni elette', icon: 'town', steps,
    position: held.length ? held.join(' · ') : 'Nessun mandato elettivo in corso',
    next: next ? { title: `${next.label}: in palio ${ELECTION_OPENS[next.type] ?? 'un mandato'}`, when: next.status === 'open' ? `candidature aperte fino al ${day(next.windowClosesAt)}` : next.status === 'running' ? `campagna in corso, voto il ${day(next.electionDate)}` : `candidature dal ${day(next.windowOpensAt)}` } : null,
    requirement: 'Candidatura nel partito (o da indipendente), campagna e voto: l’esito non è mai scontato.',
    odds: null, blocker: null,
    action: next?.status === 'open' || next?.status === 'running' ? { type: 'tab', section: 'elezioni', tab: 'campagna', label: next.status === 'open' ? 'Candidati' : 'Vai alla campagna' } : { type: 'nav', page: 'elezioni', label: 'Centrale elettorale' }
  };
}

function partyTrack(state, stats) {
  const game = state.game;
  const party = game.party;
  if (!party) return { id: 'partito', label: 'Partito', icon: 'flag', steps: [], position: 'Indipendente', next: { title: 'Aderire a un partito', when: 'quando vuoi' }, requirement: 'Un partito apre liste, incarichi interni e correnti, ma lega a una leadership.', odds: null, blocker: null, action: { type: 'nav', page: 'partito', label: 'Scegli un partito' }, contests: [] };
  const contests = [...(party.contests ?? [])].reverse();
  if (party.affiliation === 'founder') return { id: 'partito', label: 'Partito', icon: 'flag', steps: [{ id: 'fondatore', label: party.rankTitle, current: true, done: false }], position: party.rankTitle, next: null, requirement: 'Da fondatore guidi il partito: la sfida è farlo crescere e tenerlo unito.', odds: null, blocker: null, action: { type: 'tab', section: 'partito', tab: 'segreteria', label: 'Segreteria' }, contests };
  const next = nextPartyRank(game);
  const odds = partyAdvancementOdds({ game, stats, parliament: state.parliament });
  const cooldown = party.lastRankContestWeek && game.week.index - party.lastRankContestWeek < 3 ? `Nuovo tentativo dalla settimana ${party.lastRankContestWeek + 3}.` : '';
  const blocker = !next ? 'Sei al vertice del partito.' : next.threshold === null ? 'La segreteria si conquista solo al congresso.' : cooldown || costProblem(game, { ap: 2, capital: 4 }) || null;
  return {
    id: 'partito', label: 'Partito', icon: 'flag',
    steps: PARTY_RANKS.map(rank => ({ id: `rank-${rank.level}`, label: rank.title, threshold: rank.threshold, done: rank.level < party.rank, current: rank.level === party.rank })),
    position: party.rankTitle,
    next: next ? { title: next.title, when: next.threshold === null ? 'al prossimo congresso' : 'candidandoti negli organi (2 giorni · 4 capitale)' } : null,
    requirement: next?.threshold ? `Soglia ${next.threshold}: superarla rende la nomina probabile, non certa.` : 'Vince chi porta la propria area alla guida del partito.',
    odds, blocker,
    action: next?.threshold ? { type: 'party-contest', label: `Candidati a ${next.title.toLowerCase()}` } : { type: 'tab', section: 'partito', tab: 'ruoli', label: 'Correnti e congresso' },
    contests
  };
}

function parliamentTrack(state, stats) {
  const parliament = state.parliament;
  const game = state.game;
  const seat = parliament?.player;
  const standing = parliament?.careerStanding;
  const level = standing?.roleLevel ?? 0;
  const steps = [{ id: 'ruolo-0', label: 'Componente del gruppo', threshold: null, done: Boolean(seat) && level > 0, current: Boolean(seat) && level === 0 }, ...PARLIAMENTARY_ROLES.map(role => ({ id: `ruolo-${role.level}`, label: role.title, threshold: role.threshold, done: Boolean(seat) && level > role.level, current: Boolean(seat) && level === role.level }))];
  const contests = [...(standing?.contests ?? (standing?.lastContest ? [{ kind: 'parlamento', target: standing.lastContest.roleTitle, ...standing.lastContest }] : []))].reverse();
  if (!seat) {
    const politiche = upcomingElections(game).find(entry => entry.type === 'politiche');
    return { id: 'parlamento', label: 'Parlamento', icon: 'dome', steps, position: parliament?.pastMandates?.length ? 'Mandato concluso' : 'Fuori dal Parlamento', next: { title: 'Un seggio alla Camera o al Senato', when: politiche ? `politiche: voto il ${day(politiche.electionDate)}` : 'alle prossime politiche' }, requirement: 'Si entra solo vincendo un seggio: uninominale, lista bloccata o ripescaggio proporzionale.', odds: null, blocker: 'Serve un seggio.', action: { type: 'nav', page: 'elezioni', label: 'Elezioni' }, contests };
  }
  if (!canManageParliament(parliament)) return { id: 'parlamento', label: 'Parlamento', icon: 'dome', steps, position: seat.chamber === 'senato' ? 'Senatore senza gruppo' : 'Deputato senza gruppo', next: { title: 'Scegliere un gruppo parlamentare', when: 'subito' }, requirement: 'Senza gruppo non si ottengono incarichi né si votano le leggi.', odds: null, blocker: 'Scegli un gruppo.', action: { type: 'nav', page: 'parlamento', label: 'Scegli il gruppo' }, contests };
  const role = nextParliamentaryRole(parliament);
  const capital = game.resources?.politicalCapital ?? 0;
  const threshold = standing?.competitionStrength ?? role?.threshold ?? null;
  const odds = role ? advancementOdds('parlamento', { factors: progressionFactors({ game, stats, parliament }), threshold, capital }) : null;
  const wait = standing?.lastContestAt ? Math.max(0, CONTEST_WINDOW_DAYS - daysBetween(standing.lastContestAt, state.clock.currentDate)) : 0;
  const blocker = !role ? 'Hai raggiunto l’incarico più alto previsto.' : wait ? `Nuovo tentativo tra ${wait} giorni.` : capital < CONTEST_COST ? `Servono ${CONTEST_COST} punti di capitale politico.` : null;
  return {
    id: 'parlamento', label: 'Parlamento', icon: 'dome', steps,
    position: standing?.committeeRole?.title ?? (seat.chamber === 'senato' ? 'Senatore' : 'Deputato'),
    next: role ? { title: role.title, when: `competizione nel gruppo (${CONTEST_COST} capitale)` } : null,
    requirement: role ? `Soglia ${threshold}: contano influenza, reputazione, esperienza e sostegno nel gruppo.` : 'Il gruppo ti riconosce il ruolo più alto previsto.',
    odds, blocker,
    action: role ? { type: 'parliament-contest', label: `Candidati a ${role.title.toLowerCase()}` } : { type: 'nav', page: 'parlamento', label: 'Aula' },
    contests
  };
}

function governmentTrack(state, stats) {
  const parliament = state.parliament;
  const game = state.game;
  const government = parliament?.government;
  const governing = ['active', 'crisis'].includes(government?.status);
  const minister = governing ? activeMinisters(government).find(item => item.playerAppointed) : null;
  const premier = isPrimeMinister(parliament);
  const under = Boolean(game.flags?.scenarioOffice);
  const steps = [
    { id: 'sottosegretario', label: 'Sottosegretario', done: under && (Boolean(minister) || premier), current: under && !minister && !premier },
    { id: 'ministro', label: 'Ministro', done: Boolean(minister) && premier, current: Boolean(minister) && !premier },
    { id: 'premier', label: 'Presidente del Consiglio', done: false, current: premier }
  ];
  const problems = parliament ? governmentPostProblems(parliament, stats, state.clock.currentDate) : ['Serve un seggio con un gruppo di riferimento.'];
  const chance = !problems.length ? governmentPostOdds(parliament, stats) : null;
  const history = (parliament?.history ?? []).filter(item => ['richiesta-incarico-respinta', 'nomina-ministro-giocatore'].includes(item.type)).slice(-6).reverse()
    .map(item => ({ kind: 'governo', target: item.details?.portfolio ? `Ministero ${item.details.portfolio}` : 'Incarico di governo', outcome: item.type === 'nomina-ministro-giocatore' ? 'promosso' : /sottosegretario/.test(item.text ?? '') ? 'incarico-inferiore' : 'sconfitta-interna', label: item.type === 'nomina-ministro-giocatore' ? 'Ministero ottenuto' : /sottosegretario/.test(item.text ?? '') ? 'Proposto un posto da sottosegretario' : 'Richiesta respinta', chance: item.details?.chance ?? null, date: item.date }));
  return {
    id: 'governo', label: 'Governo', icon: 'ministry', steps,
    position: premier ? 'Presidente del Consiglio' : minister ? `Ministro · ${minister.portfolio}` : under ? game.flags.scenarioOffice.title : 'Nessun incarico di governo',
    next: premier ? null : { title: minister ? 'Guidare il governo' : 'Un ministero', when: minister ? 'da segretario, quando si forma un nuovo governo' : 'chiedendolo al Presidente del Consiglio' },
    requirement: minister ? 'La guida del governo passa dal Parlamento: serve una maggioranza.' : 'Seggio in un gruppo di maggioranza, 12 settimane di mandato, influenza, reputazione, esperienza e sostegno nel gruppo alti.',
    odds: chance === null ? null : { chance, score: null, threshold: null, factors: [] },
    blocker: premier ? null : minister ? null : problems[0] ?? null, problems: premier || minister ? [] : problems,
    action: { type: 'nav', page: 'governo', label: minister || premier || problems.length ? 'Vai al Governo' : 'Chiedi un incarico' },
    contests: history
  };
}

// The four tracks, the next useful move, and every recent attempt to climb (with its odds and outcome).
export function careerOverview(state) {
  if (!state?.game) return null;
  const stats = playerStatsOf(state);
  const tracks = [institutionTrack(state), partyTrack(state, stats), parliamentTrack(state, stats), governmentTrack(state, stats)];
  const contests = tracks.flatMap(track => (track.contests ?? []).map(item => ({ ...item, track: track.id, trackLabel: track.label })))
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))).slice(0, 12);
  // The next useful move: an open vote first, then an attempt that is possible right now.
  const open = upcomingElections(state.game).find(entry => entry.status === 'open');
  const ready = tracks.find(track => track.odds && !track.blocker && ['party-contest', 'parliament-contest'].includes(track.action?.type));
  const focus = state.campaign?.status === 'active' ? { track: 'istituzioni', text: 'Sei in campagna: ogni giorno conta per il risultato.' }
    : open ? { track: 'istituzioni', text: `Candidature aperte: ${open.label}.` }
    : ready ? { track: ready.id, text: `${ready.next.title}: probabilità stimata ${Math.round(ready.odds.chance * 100)}%.` }
    : null;
  return { stats, tracks, contests, focus };
}
