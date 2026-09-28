// The institutions where a local or European career is played: the consiglio comunale with its giunta and mayor, the
// consiglio regionale with its giunta and president, the European Parliament with its political groups. Each has
// groups of majority and opposition, an executive that proposes acts (deliberations, regional laws, the budget; the
// European Commission's dossiers), an opposition that attacks and files motions, groups that defect, a budget with its
// deadline, votes with individual dissent, and a player who proposes, votes, negotiates or governs. A council that loses
// its majority is dissolved and votes early. Everything is simulation; the European groups start from their real size
// at the constitutive session of 2024 (europarl), then evolve in the game.
import { uniqueId } from './ids.js?v=20260928-2';
import { DATA_SOURCES } from '../data/schema.js?v=20260928-2';
import { AREA_BY_ID, CAMP_PRIORITIES, POLICY_AREAS } from '../data/simulation/policy-rules.js?v=20260928-2';
import { cohesiveShare } from './parliament-engine.js?v=20260928-2';
import { groupLine, seededRandom, splitGroupVote } from './vote-engine.js?v=20260928-2';
import { advanceDays } from './time.js?v=20260928-2';

const SIM = DATA_SOURCES.SIMULATION;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const weeksBetween = (from, to) => from && to ? Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 604800000) : 99;
const campOf = axis => (axis ?? 0) >= 1 ? 'destra' : (axis ?? 0) <= -1 ? 'sinistra' : 'centro';
const CLOSED = ['approvato', 'respinto', 'ritirato'];

// ---------- rules of the game ----------
export const INSTITUTIONS = Object.freeze({
  comune: {
    label: 'Consiglio comunale', executive: 'Giunta comunale', leader: 'Sindaco', leaderTitle: 'Sindaco', member: 'Consigliere comunale',
    portfolios: ['Bilancio', 'Lavori pubblici', 'Politiche sociali', 'Urbanistica', 'Mobilità', 'Cultura e turismo', 'Sicurezza urbana', 'Ambiente'],
    acts: { executive: 'Delibera della giunta', majority: 'Mozione della maggioranza', opposition: 'Mozione dell’opposizione', budget: 'Bilancio di previsione', player: 'Tua proposta di delibera' },
    rates: { executive: 0.35, majority: 0.08, opposition: 0.14 }, dissolves: true
  },
  regione: {
    label: 'Consiglio regionale', executive: 'Giunta regionale', leader: 'Presidente della Regione', leaderTitle: 'Presidente di Regione', member: 'Consigliere regionale',
    portfolios: ['Sanità', 'Bilancio', 'Trasporti', 'Attività produttive', 'Ambiente', 'Agricoltura', 'Welfare', 'Istruzione e formazione'],
    acts: { executive: 'Proposta di legge della giunta', majority: 'Proposta di legge della maggioranza', opposition: 'Mozione dell’opposizione', budget: 'Legge di bilancio regionale', player: 'Tua proposta di legge regionale' },
    rates: { executive: 0.3, majority: 0.07, opposition: 0.12 }, dissolves: true
  },
  europa: {
    label: 'Parlamento europeo', executive: 'Commissione europea', leader: null, member: 'Deputato al Parlamento europeo',
    portfolios: [],
    acts: { executive: 'Proposta della Commissione', majority: 'Risoluzione', opposition: 'Emendamento di un gruppo', budget: 'Bilancio annuale dell’Unione', player: 'Tua relazione d’iniziativa' },
    rates: { executive: 0.4, majority: 0.08, opposition: 0.1 }, dissolves: false
  }
});
// The political groups of the European Parliament at the constitutive session of July 2024 (720 seats; source:
// European Parliament, results.elections.europa.eu, verified 2026-09-26), with the collocazione the game gives them.
export const EP_GROUPS_2024 = Object.freeze({
  source: 'real', verified: true, sourceUrl: 'https://results.elections.europa.eu/en/seats-political-group-country/2024-2029/', sourceName: 'Parlamento europeo — seggi per gruppo politico, sessione costitutiva 2024', verifiedAt: '2026-09-26',
  groups: [
    { id: 'epp', label: 'PPE', seats: 188, axis: 1 }, { id: 'sd', label: 'S&D', seats: 136, axis: -1 }, { id: 'pfe', label: 'Patrioti per l’Europa', seats: 84, axis: 3 },
    { id: 'ecr', label: 'ECR', seats: 78, axis: 2 }, { id: 'renew', label: 'Renew Europe', seats: 77, axis: 0 }, { id: 'greens', label: 'Verdi/ALE', seats: 53, axis: -2 },
    { id: 'left', label: 'La Sinistra', seats: 46, axis: -3 }, { id: 'esn', label: 'Europa delle nazioni sovrane', seats: 25, axis: 3 }, { id: 'ni', label: 'Non iscritti', seats: 33, axis: 0, nonAttached: true }
  ]
});
// The European group of a national party in the game: by its collocazione (a rule of the game, not a real membership).
export const epGroupFor = axis => ({ '-3': 'left', '-2': 'greens', '-1': 'sd', 0: 'renew', 1: 'epp', 2: 'ecr', 3: 'pfe' })[String(clamp(Math.round(axis ?? 0), -3, 3))];

// ---------- creation ----------
// spec: { kind, name, region, date, until, role, side, groups: [{ id, label, partyId, axis, seats, side }], leaderGroupId, leaderIsPlayer, playerGroupId }
export function createInstitution(spec) {
  const rules = INSTITUTIONS[spec.kind];
  const groups = spec.groups.filter(group => group.seats > 0).map(group => ({ ...group, camp: campOf(group.axis), cohesion: 70, source: SIM }));
  const leaderGroup = groups.find(group => group.id === spec.leaderGroupId) ?? groups.find(group => group.side === 'maggioranza') ?? groups[0];
  const members = rules.portfolios.map((portfolio, index) => {
    const majority = groups.filter(group => group.side === 'maggioranza');
    const holder = majority[index % Math.max(1, majority.length)] ?? leaderGroup;
    return { portfolio, groupId: holder?.id ?? null, holder: 'simulato', label: `Assessore (figura simulata) · ${holder?.label ?? 'lista civica'}` };
  });
  return {
    id: `${spec.kind}-${spec.date}-${String(spec.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, kind: spec.kind, name: spec.name, region: spec.region ?? null,
    since: spec.date, until: spec.until ?? null, status: 'active', playerRole: spec.role, playerSide: spec.side, playerGroupId: spec.playerGroupId ?? null,
    groups, seats: groups.reduce((sum, group) => sum + group.seats, 0),
    executive: spec.kind === 'europa' ? null : { leader: spec.leaderIsPlayer ? 'player' : 'simulato', label: spec.leaderIsPlayer ? `Tu, ${rules.leader.toLowerCase()}` : `${rules.leader} (figura simulata) · ${leaderGroup?.label ?? ''}`.trim(), groupId: leaderGroup?.id ?? null, camp: leaderGroup?.camp ?? 'centro', members, stability: 62, program: null },
    budget: spec.kind === 'europa' ? null : { approvedYear: Number(String(spec.date).slice(0, 4)), margin: 50, localTax: 'media' },
    acts: [], archive: [], history: [{ date: spec.date, text: `${rules.label}: inizia il mandato (${spec.role === 'sindaco' || spec.role === 'presidente' ? 'guidi l’esecutivo' : spec.side === 'maggioranza' ? 'in maggioranza' : 'all’opposizione'}).` }],
    pressure: 30, ...(spec.kind === 'europa' ? { ep: europeanSeat(`${spec.kind}-${spec.date}`, spec.date, spec.committee) } : {}), source: SIM
  };
}
const record = (inst, date, text, type = 'evento') => ({ ...inst, history: [...inst.history, { date, text, type }].slice(-40) });
const governing = inst => new Set(inst.groups.filter(group => group.side === 'maggioranza').map(group => group.id));
export const majorityMargin = inst => inst.groups.filter(group => group.side === 'maggioranza').reduce((sum, group) => sum + group.seats, 0) - (Math.floor(inst.seats / 2) + 1);

// ---------- acts ----------
function newAct(inst, { kind, sponsor, area, title, date, budget = false }) {
  const rules = INSTITUTIONS[inst.kind];
  return { id: uniqueId([...inst.acts, ...inst.archive], `${inst.id}-atto-${inst.acts.length + inst.archive.length + 1}`), kind, title, area, sponsor, budget, stage: 'commissione', introducedAt: date, nextStepAt: advanceDays(date, (budget ? 2 : 1 + (inst.acts.length % 3)) * 7), votes: [], pendingPlayerVote: null, label: rules.acts[kind], ...(inst.kind === 'europa' ? { committee: committeeOfArea(area).id, rapporteur: null } : {}), source: SIM };
}
const TITLES = {
  comune: { executive: area => `Delibera: ${AREA_BY_ID[area]?.label.toLowerCase() ?? 'servizi'} in città`, majority: area => `Mozione: più attenzione a ${AREA_BY_ID[area]?.label.toLowerCase() ?? 'servizi'}`, opposition: area => `Mozione dell’opposizione su ${AREA_BY_ID[area]?.label.toLowerCase() ?? 'servizi'}` },
  regione: { executive: area => `Legge regionale: ${AREA_BY_ID[area]?.label.toLowerCase() ?? 'servizi'}`, majority: area => `Proposta di legge: ${AREA_BY_ID[area]?.label.toLowerCase() ?? 'servizi'}`, opposition: area => `Mozione dell’opposizione su ${AREA_BY_ID[area]?.label.toLowerCase() ?? 'servizi'}` },
  europa: { executive: area => `Proposta di regolamento: ${AREA_BY_ID[area]?.label.toLowerCase() ?? 'mercato interno'}`, majority: area => `Risoluzione su ${AREA_BY_ID[area]?.label.toLowerCase() ?? 'Europa'}`, opposition: area => `Emendamenti su ${AREA_BY_ID[area]?.label.toLowerCase() ?? 'Europa'}` }
};
// What each level decides (competences, simplified): the executive and the groups propose on these areas.
const COMPETENCES = Object.freeze({
  comune: ['casa', 'trasporti', 'ambiente', 'sicurezza', 'cultura', 'sport', 'welfare', 'scuola', 'turismo', 'commercio', 'infrastrutture', 'giovani', 'pa', 'digitale'],
  regione: ['sanita', 'trasporti', 'agricoltura', 'ambiente', 'lavoro', 'industria', 'scuola', 'turismo', 'welfare', 'infrastrutture', 'casa', 'cultura', 'energia', 'autonomie']
});
const within = (kind, pool) => { const allowed = COMPETENCES[kind]; if (!allowed) return pool; const own = pool.filter(area => allowed.includes(area)); return own.length ? own : allowed; };
const EU_AREAS = ['europa', 'ambiente', 'agricoltura', 'digitale', 'immigrazione', 'energia', 'industria', 'commercio', 'difesa', 'esteri', 'lavoro'];
// The themes the player can bring to the institution (its competences).
export const localAreas = kind => kind === 'europa' ? EU_AREAS : COMPETENCES[kind] ?? [];
export const isClosedAct = act => CLOSED.includes(act.stage);
// How much a group supports an act: who proposed it, majority and opposition, collocazione, cohesion.
function support(inst, act, group) {
  if (act.sponsor.groupId && act.sponsor.groupId === group.id) return 0.92;
  const inMajority = group.side === 'maggioranza';
  const fromMajority = act.sponsor.kind === 'executive' || act.sponsor.kind === 'budget' || (act.sponsor.groupId && governing(inst).has(act.sponsor.groupId));
  let value = inst.kind === 'europa'
    ? 0.55 - Math.abs((group.axis ?? 0) - (act.sponsor.axis ?? 0)) * 0.12 + (act.kind === 'executive' ? 0.08 : 0)
    : fromMajority ? (inMajority ? 0.72 : 0.28) : (inMajority ? 0.3 : 0.62);
  const sponsor = inst.groups.find(item => item.id === act.sponsor.groupId);
  if (sponsor && inst.kind !== 'europa') value += (1.5 - Math.abs((group.axis ?? 0) - (sponsor.axis ?? 0))) * 0.04;
  if (CAMP_PRIORITIES[group.camp]?.includes(act.area)) value += 0.06;
  if (inMajority && fromMajority) value += ((inst.executive?.stability ?? 60) - 55) / 250 + (group.cohesion - 60) / 300;
  if (act.concession?.[group.id]) value += 0.12;
  // European dossiers: an amendment carried brings the text closer to its group; the rapporteur writes compromises.
  if (act.amended?.[group.id]) value += act.amended[group.id];
  if (act.rapporteur) value += act.rapporteur.groupId === group.id ? 0.1 : 0.03;
  // A shared theme (a motion on a local emergency, a proposal written with the other side) gathers votes across the aisle.
  if (act.consensual && inst.kind !== 'europa') value += fromMajority ? (inMajority ? 0 : 0.22) : (inMajority ? 0.26 : 0);
  // A majority group that feels neglected makes the executive pay on its acts.
  if (inMajority && fromMajority && group.cohesion < 50) value -= (50 - group.cohesion) / 120;
  return clamp(value, 0.05, 0.95);
}
const lineOf = value => value >= 0.55 ? 'favorevole' : value <= 0.42 ? 'contrario' : 'astenuto';
// The player's seat in a vote: the chosen vote (or the line of the group) takes the place of one of the group's votes.
const BALLOT = Object.freeze({ favorevole: 'yes', contrario: 'no', astenuto: 'abstain', assente: 'absent' });
// Councils and the European Parliament decide by the votes cast: more in favour than against (abstentions and absences
// count for neither side).
const carried = ({ yes, against }) => yes > against;
// The count of a vote: the votes of everyone else plus the player's (choice: favorevole, contrario, astenuto, assente;
// null when the player does not vote there). Decisive: another vote of the player, everyone else voting as they did,
// would have given the opposite outcome.
export function countVote(others, choice = null) {
  const ballot = choice ? BALLOT[choice] : null;
  if (choice && !ballot) throw new Error('Scelta di voto non valida.');
  const plus = (base, key) => (base ?? 0) + (ballot === key ? 1 : 0);
  const tally = { yes: plus(others.yes, 'yes'), against: plus(others.against, 'no'), abstain: plus(others.abstain, 'abstain'), absent: plus(others.absent, 'absent') };
  const passed = carried(tally);
  const decisive = Boolean(ballot) && Object.values(BALLOT).some(other => carried({ yes: (others.yes ?? 0) + (other === 'yes' ? 1 : 0), against: (others.against ?? 0) + (other === 'no' ? 1 : 0) }) !== passed);
  return { ...tally, passed, decisive };
}
// What an archived act keeps of its vote: the totals, the outcome and the player's vote.
export const compactVote = vote => vote ? { date: vote.date, yes: vote.yes, against: vote.against, abstain: vote.abstain ?? 0, absent: vote.absent ?? (vote.byGroup ?? []).reduce((sum, row) => sum + (row.absent ?? 0), 0), passed: Boolean(vote.passed), playerChoice: vote.playerChoice ?? null, playerLine: vote.playerLine ?? null, decisive: Boolean(vote.decisive) } : null;
// The forecast before the vote: every group votes as its members lean today (the usual defections included) and the
// player's seat as the player chose (with the group, until a choice is made); passes if the yes outnumber the no.
export function forecastAct(inst, act) {
  const pending = BALLOT[act.pendingPlayerVote] ? act.pendingPlayerVote : null;
  let playerChoice = null;
  const positions = inst.groups.map(group => {
    const value = support(inst, act, group);
    const line = lineOf(value);
    const own = group.id === inst.playerGroupId && group.seats > 0;
    const members = own ? group.seats - 1 : group.seats;
    const split = splitGroupVote({ seats: members, yes: Math.round(members * cohesiveShare(value)), seed: `${act.id}|${group.id}` });
    const row = { yes: split.yes, no: split.no, abstain: split.abstain, absent: 0 };
    if (own) { playerChoice = pending ?? line; row[BALLOT[playerChoice]] += 1; }
    return { groupId: group.id, label: group.label, seats: group.seats, side: group.side, support: Math.round(value * 100) / 100, line, ...row, ...(own ? { playerChoice } : {}) };
  });
  const sum = key => positions.reduce((total, row) => total + row[key], 0);
  const yes = sum('yes');
  const against = sum('no');
  return { yes, against, abstain: sum('abstain'), absent: sum('absent'), needed: against + 1, total: inst.seats, passes: carried({ yes, against }), positions, playerChoice };
}
function voteAct(inst, act, date) {
  const decided = act.pendingPlayerVote;
  let choice = null, line = null;
  const rand = seededRandom(`${act.id}|${date}`);
  const byGroup = inst.groups.map(group => {
    const value = support(inst, act, group);
    const own = group.id === inst.playerGroupId;
    // The day of the vote: a few absent, a few who follow their own mind (more in a group that holds together less).
    let absent = Math.floor(group.seats * rand() * 0.12);
    const others = Math.max(0, (own ? group.seats - 1 : group.seats) - absent);
    const mood = clamp(value + (rand() - 0.5) * (0.12 + (100 - group.cohesion) / 250), 0.02, 0.98);
    let yes = Math.round(others * cohesiveShare(mood));
    const split = splitGroupVote({ seats: others, yes, seed: `${act.id}|${group.id}` });
    let no = split.no, abstain = split.abstain;
    if (own) {
      // The player's seat: one of the group's votes, as the player chose (or with the line of the group).
      line = lineOf(value);
      choice = !decided || decided === 'linea' ? line : BALLOT[decided] ? decided : 'assente';
      if (choice === 'favorevole') yes += 1; else if (choice === 'contrario') no += 1; else if (choice === 'astenuto') abstain += 1; else absent += 1;
    }
    return { groupId: group.id, yesVotes: yes, noVotes: no, abstainVotes: abstain, absent, line: groupLine({ yes, no, abstain }), seats: group.seats, ...(own ? { playerChoice: choice } : {}) };
  });
  const total = key => byGroup.reduce((sum, row) => sum + row[key], 0);
  // The outcome from the votes actually cast, the player's included; decisive only if another vote of the player
  // would have reversed it.
  const ballot = choice ? BALLOT[choice] : null;
  const others = { yes: total('yesVotes') - (ballot === 'yes' ? 1 : 0), against: total('noVotes') - (ballot === 'no' ? 1 : 0), abstain: total('abstainVotes') - (ballot === 'abstain' ? 1 : 0), absent: total('absent') - (ballot === 'absent' ? 1 : 0) };
  const count = countVote(others, choice);
  return { date, yes: count.yes, against: count.against, abstain: count.abstain, absent: count.absent, total: inst.seats, passed: count.passed, byGroup, playerChoice: choice, playerLine: line, decided: Boolean(decided), decisive: count.decisive, source: SIM };
}

// ---------- the player ----------
export const LOCAL_VOTE_CHOICES = Object.freeze({ linea: 'Con il tuo gruppo', favorevole: 'Favorevole', contrario: 'Contrario', astenuto: 'Astenuto', assente: 'Assente' });
export function setLocalVote(inst, actId, choice) {
  if (!LOCAL_VOTE_CHOICES[choice]) throw new Error('Scelta di voto non valida.');
  const act = inst.acts.find(item => item.id === actId);
  if (!act || CLOSED.includes(act.stage)) throw new Error('L’atto non è più in discussione.');
  return { ...inst, acts: inst.acts.map(item => item.id === actId ? { ...item, pendingPlayerVote: choice } : item) };
}
// The player proposes an act (a deliberation, a regional bill, an own-initiative report) on an area.
export function proposeLocalAct(inst, area, date) {
  if (!AREA_BY_ID[area]) throw new Error('Scegli un tema.');
  if (inst.acts.some(item => item.sponsor.kind === 'player' && !CLOSED.includes(item.stage))) throw new Error('Hai già una proposta in discussione: aspetta il voto.');
  const executive = inst.executive?.leader === 'player';
  const title = `${INSTITUTIONS[inst.kind].acts.player}: ${AREA_BY_ID[area].label.toLowerCase()}`;
  const act = newAct(inst, { kind: 'player', sponsor: { kind: executive ? 'executive' : 'player', groupId: inst.playerGroupId, label: 'Tu', axis: inst.groups.find(group => group.id === inst.playerGroupId)?.axis ?? 0 }, area, title, date });
  return record({ ...inst, acts: [...inst.acts, { ...act, pendingPlayerVote: 'favorevole' }] }, date, `Presenti “${title}”.`, 'proposta');
}
// The executive (the player as mayor or president) wins a wavering group with a concession on an act.
export function concedeToGroup(inst, actId, groupId, date) {
  const act = inst.acts.find(item => item.id === actId);
  const group = inst.groups.find(item => item.id === groupId);
  if (!act || CLOSED.includes(act.stage) || !group) throw new Error('Trattativa non disponibile.');
  if (act.concession?.[groupId]) throw new Error('Hai già fatto una concessione a questo gruppo.');
  const next = { ...inst, acts: inst.acts.map(item => item.id === actId ? { ...item, concession: { ...(item.concession ?? {}), [groupId]: date } } : item), groups: inst.groups.map(item => item.id === groupId ? { ...item, cohesion: clamp(item.cohesion + 4, 0, 100) } : item) };
  return record(next, date, `Concessione a ${group.label} su “${act.title}”.`, 'trattativa');
}
// A question to the executive (the opposition's weapon): visibility, and pressure on the majority.
export function questionExecutive(inst, date) {
  if (inst.lastQuestionAt && weeksBetween(inst.lastQuestionAt, date) < 3) throw new Error('Hai presentato un’interrogazione da poco.');
  const next = { ...inst, lastQuestionAt: date, pressure: clamp(inst.pressure + 6, 0, 100), executive: inst.executive ? { ...inst.executive, stability: clamp(inst.executive.stability - 2, 0, 100) } : inst.executive };
  return record(next, date, 'Presenti un’interrogazione: l’esecutivo deve rispondere in aula.', 'interrogazione');
}
// The head of the executive changes an assessore: the group that gains is grateful, the one that loses resents it.
export function reshuffleLocal(inst, portfolio, groupId, date) {
  if (inst.executive?.leader !== 'player') throw new Error('Solo chi guida l’esecutivo nomina gli assessori.');
  const member = inst.executive.members.find(item => item.portfolio === portfolio);
  const group = inst.groups.find(item => item.id === groupId && item.side === 'maggioranza');
  if (!member || !group) throw new Error('Scegli un assessorato e un gruppo della maggioranza.');
  if (member.groupId === groupId) throw new Error('L’assessorato è già di quel gruppo.');
  const members = inst.executive.members.map(item => item.portfolio === portfolio ? { ...item, groupId, label: `Assessore (figura simulata) · ${group.label}` } : item);
  const groups = inst.groups.map(item => item.id === groupId ? { ...item, cohesion: clamp(item.cohesion + 8, 0, 100) } : item.id === member.groupId ? { ...item, cohesion: clamp(item.cohesion - 10, 0, 100) } : item);
  return record({ ...inst, groups, executive: { ...inst.executive, members } }, date, `Rimpasto: l’assessorato ${portfolio} passa a ${group.label}.`, 'rimpasto');
}
export function setLocalTax(inst, level, date) {
  if (inst.executive?.leader !== 'player' || !inst.budget) throw new Error('Solo chi guida l’esecutivo decide le aliquote.');
  if (!['bassa', 'media', 'alta'].includes(level)) throw new Error('Livello non valido.');
  const margin = clamp(inst.budget.margin + ({ bassa: -12, media: 0, alta: 12 }[level] - { bassa: -12, media: 0, alta: 12 }[inst.budget.localTax]), 0, 100);
  return record({ ...inst, budget: { ...inst.budget, localTax: level, margin } }, date, `Nuove aliquote locali: pressione fiscale ${level}.`, 'bilancio');
}

// ---------- the European Parliament: committees, dossiers, offices ----------
// The standing committees of the European Parliament (their real names; membership, dossiers, votes and offices are
// simulated). Every dossier is prepared in the committee of its area: a rapporteur writes the report, the groups table
// amendments, the committee votes, then the plenary. The player sits as a full member in one committee and as a
// substitute in another, works there (reports, amendments, votes) and can rise to group coordinator, vice-chair, chair.
export const EP_COMMITTEES = Object.freeze([
  { id: 'afco', code: 'AFCO', label: 'Affari costituzionali', areas: ['europa'] },
  { id: 'envi', code: 'ENVI', label: 'Ambiente, clima e sicurezza alimentare', areas: ['ambiente'] },
  { id: 'itre', code: 'ITRE', label: 'Industria, ricerca ed energia', areas: ['industria', 'energia'] },
  { id: 'imco', code: 'IMCO', label: 'Mercato interno e protezione dei consumatori', areas: ['digitale'] },
  { id: 'agri', code: 'AGRI', label: 'Agricoltura e sviluppo rurale', areas: ['agricoltura'] },
  { id: 'libe', code: 'LIBE', label: 'Libertà civili, giustizia e affari interni', areas: ['immigrazione'] },
  { id: 'empl', code: 'EMPL', label: 'Occupazione e affari sociali', areas: ['lavoro'] },
  { id: 'inta', code: 'INTA', label: 'Commercio internazionale', areas: ['commercio'] },
  { id: 'afet', code: 'AFET', label: 'Affari esteri', areas: ['esteri'] },
  { id: 'sede', code: 'SEDE', label: 'Sicurezza e difesa', areas: ['difesa'] }
]);
export const committeeOfArea = area => EP_COMMITTEES.find(item => item.areas.includes(area)) ?? EP_COMMITTEES[0];
export const committeeById = id => EP_COMMITTEES.find(item => item.id === id) ?? null;
// The offices of a committee, one step at a time: the work done (merit: reports and amendments approved) and some
// time in the previous office open the next one; capital pays the campaign, the committee's vote decides.
export const EP_ROLES = Object.freeze([
  { id: 'coordinatore', label: 'Coordinatore del gruppo in commissione', title: code => `Coordinatore del gruppo in commissione ${code}`, merit: 5, after: 0, capital: 3, base: 0.45, stats: { influence: 2, notoriety: 1 } },
  { id: 'vicepresidente', label: 'Vicepresidente di commissione', title: code => `Vicepresidente della commissione ${code}`, merit: 15, after: 26, capital: 4, base: 0.3, stats: { influence: 3, notoriety: 1.5, reputation: 0.5 } },
  { id: 'presidente', label: 'Presidente di commissione', title: code => `Presidente della commissione ${code}`, merit: 30, after: 52, capital: 5, base: 0.2, stats: { influence: 4, notoriety: 2, reputation: 1 } }
]);
const COMMITTEE_SEATS = 60;
export const EP_COSTS = Object.freeze({ rapporteur: 2, amendment: 1, committee: 2 });
// The seat of a new MEP: the group assigns a committee as full member and one as substitute.
function europeanSeat(seed, date, preferred = null) {
  const rand = seededRandom(`${seed}|commissioni`);
  const member = committeeById(preferred)?.id ?? EP_COMMITTEES[Math.floor(rand() * EP_COMMITTEES.length)].id;
  const others = EP_COMMITTEES.filter(item => item.id !== member);
  return { member, substitute: others[Math.floor(rand() * others.length)].id, role: null, roleSince: null, merit: 0, reports: 0, amendments: { tabled: 0, carried: 0 }, lastBid: null, lastRequest: null, since: date, source: SIM };
}
// Saves made before the committees existed: the MEP gets a seat and the dossiers their committee.
export function withEuropeanSeat(inst, date) {
  if (inst?.kind !== 'europa' || inst.ep) return inst;
  return { ...inst, ep: europeanSeat(inst.id, inst.since ?? date), acts: inst.acts.map(act => act.committee ? act : { ...act, committee: committeeOfArea(act.area).id, rapporteur: act.rapporteur ?? null }) };
}
const groupShare = inst => (inst.groups.find(group => group.id === inst.playerGroupId)?.seats ?? 0) / (inst.seats || 1);
const roleIndex = inst => EP_ROLES.findIndex(role => role.id === inst.ep?.role);
export const inCommittee = (inst, act) => Boolean(inst.ep && act.committee && [inst.ep.member, inst.ep.substitute].includes(act.committee));
export const nextEuropeanRole = inst => EP_ROLES[roleIndex(inst) + 1] ?? null;
// The odds of the player's moves in the European Parliament (the UI shows them before the choice).
export function europeanOdds(inst, act = null, { influence = 30 } = {}) {
  const share = groupShare(inst);
  const office = Math.max(0, roleIndex(inst) + 1) * 0.08;
  const role = nextEuropeanRole(inst);
  return {
    // Reports go to the groups in proportion to their weight (the points system): a large group, an office and a name help.
    rapporteur: clamp(0.22 + share * 1.6 + office + (influence - 50) / 200, 0.08, 0.85),
    // An amendment passes in committee when the others can accept it: harder against a text the own group dislikes.
    amendment: act ? clamp(0.4 + (support(inst, act, inst.groups.find(group => group.id === inst.playerGroupId) ?? { axis: 0, side: 'opposizione', cohesion: 60 }) - 0.5) * 0.6 + (act.rapporteur?.player ? 0.3 : 0) + office + (influence - 50) / 300, 0.1, 0.9) : null,
    role: role ? clamp(role.base + share * 0.8 + (influence - 50) / 150 + ((inst.ep?.merit ?? 0) - role.merit) * 0.03, 0.05, 0.85) : null,
    committee: clamp(0.45 + (influence - 50) / 150 + share * 0.5, 0.15, 0.85)
  };
}
const openDossier = (inst, actId) => {
  const act = inst.acts.find(item => item.id === actId);
  if (!inst.ep || !act || CLOSED.includes(act.stage)) throw new Error('Il dossier non è più in discussione.');
  if (act.stage !== 'commissione') throw new Error('Il dossier ha già lasciato la commissione: ora decide la plenaria.');
  return act;
};
// The player asks for a report: in the own committee, before the committee vote, when nobody has it yet.
export function bidRapporteur(inst, actId, { influence = 30, rand = Math.random, date } = {}) {
  inst = withEuropeanSeat(inst, date);
  const act = openDossier(inst, actId);
  if (act.committee !== inst.ep.member) throw new Error('Puoi chiedere le relazioni solo nella commissione di cui sei membro titolare.');
  if (act.rapporteur) throw new Error('Il dossier ha già un relatore.');
  if (act.sponsor.kind === 'player') throw new Error('È già la tua relazione.');
  const won = rand() < europeanOdds(inst, act, { influence }).rapporteur;
  const rivals = inst.groups.filter(group => group.id !== inst.playerGroupId).sort((a, b) => b.seats - a.seats);
  const other = rivals[Math.floor(rand() * Math.min(3, rivals.length))] ?? null;
  const rapporteur = won ? { groupId: inst.playerGroupId, player: true } : { groupId: other?.id ?? null, player: false };
  const next = { ...inst, acts: inst.acts.map(item => item.id === actId ? { ...item, rapporteur } : item) };
  return { inst: record(next, date, won ? `Sei relatore di “${act.title}”.` : `La relazione su “${act.title}” va a ${other?.label ?? 'un altro gruppo'}.`, 'relazione'), won, group: won ? null : other?.label ?? null };
}
// An amendment to a dossier of the own committees (full member or substitute), one per dossier.
export function tableAmendment(inst, actId, { influence = 30, rand = Math.random, date } = {}) {
  inst = withEuropeanSeat(inst, date);
  const act = openDossier(inst, actId);
  if (!inCommittee(inst, act)) throw new Error('Puoi emendare solo i dossier delle tue commissioni.');
  if (act.playerAmendment) throw new Error('Hai già presentato i tuoi emendamenti su questo dossier.');
  const carried = rand() < europeanOdds(inst, act, { influence }).amendment;
  const amended = carried ? { ...(act.amended ?? {}), [inst.playerGroupId]: round1((act.amended?.[inst.playerGroupId] ?? 0) + 0.08) } : act.amended ?? {};
  const ep = { ...inst.ep, merit: inst.ep.merit + (carried ? 1 : 0), amendments: { tabled: inst.ep.amendments.tabled + 1, carried: inst.ep.amendments.carried + (carried ? 1 : 0) } };
  const next = { ...inst, ep, acts: inst.acts.map(item => item.id === actId ? { ...item, amended, playerAmendment: { carried, date } } : item) };
  return { inst: record(next, date, `${carried ? 'Approvato in commissione' : 'Respinto in commissione'} il tuo emendamento a “${act.title}”.`, 'emendamento'), carried };
}
// The next office of the committee: the merit gathered opens the race, the vote of the committee decides.
export function runForCommitteeRole(inst, { influence = 30, rand = Math.random, date } = {}) {
  inst = withEuropeanSeat(inst, date);
  if (!inst.ep) throw new Error('Serve un seggio al Parlamento europeo.');
  const role = nextEuropeanRole(inst);
  if (!role) throw new Error('Guidi già la tua commissione.');
  if (inst.ep.merit < role.merit) throw new Error(`Per ${role.label.toLowerCase()} serve più lavoro in commissione (${inst.ep.merit} su ${role.merit}: relazioni ed emendamenti approvati).`);
  if (inst.ep.role && weeksBetween(inst.ep.roleSince, date) < role.after) throw new Error(`Per ${role.label.toLowerCase()} servono almeno ${role.after} settimane nell’incarico attuale.`);
  if (inst.ep.lastBid && weeksBetween(inst.ep.lastBid, date) < 8) throw new Error('Hai tentato da poco: riprova tra qualche settimana.');
  const won = rand() < europeanOdds(inst, null, { influence }).role;
  const committee = committeeById(inst.ep.member);
  const ep = { ...inst.ep, lastBid: date, ...(won ? { role: role.id, roleSince: date } : {}) };
  return { inst: record({ ...inst, ep }, date, won ? `${role.title(committee.code)}: eletto.` : `Non eletto ${role.label.toLowerCase()}: la commissione sceglie un altro nome.`, 'incarico'), won, role, committee };
}
// A move to another committee: the group decides, and the offices of the old one are left behind.
export function requestCommittee(inst, committeeId, { influence = 30, rand = Math.random, date } = {}) {
  inst = withEuropeanSeat(inst, date);
  if (!inst.ep) throw new Error('Serve un seggio al Parlamento europeo.');
  const target = committeeById(committeeId);
  if (!target || target.id === inst.ep.member) throw new Error('Scegli una commissione diversa dalla tua.');
  if (inst.ep.lastRequest && weeksBetween(inst.ep.lastRequest, date) < 26) throw new Error('Il gruppo ha già discusso la tua richiesta: riprova tra qualche mese.');
  const moved = rand() < europeanOdds(inst, null, { influence }).committee;
  const ep = moved ? { ...inst.ep, member: target.id, substitute: inst.ep.substitute === target.id ? inst.ep.member : inst.ep.substitute, role: null, roleSince: null, lastRequest: date } : { ...inst.ep, lastRequest: date };
  return { inst: record({ ...inst, ep }, date, moved ? `Passi alla commissione ${target.code} (${target.label}).` : `Il gruppo respinge la richiesta di passare alla commissione ${target.code}.`, 'commissione'), moved, committee: target, leftRole: moved ? inst.ep.role : null };
}
// The vote in committee (about sixty members, the groups in proportion): the player votes as a full member.
function committeeVote(inst, act, date) {
  const total = inst.seats || 1;
  const groups = inst.groups.map(group => ({ ...group, seats: Math.max(1, Math.round(group.seats / total * COMMITTEE_SEATS)) }));
  const member = inst.ep?.member === act.committee;
  return voteAct({ ...inst, groups, seats: groups.reduce((sum, group) => sum + group.seats, 0), playerGroupId: member ? inst.playerGroupId : null }, act, date);
}

// ---------- one week ----------
// ctx: { date, rand, issues: [area], playerIsLeader }. Returns { inst, events, lines }: events for the career (votes of
// the player, requests, the fall of the executive and the early vote).
export function advanceInstitutionWeek(input, { date, rand = Math.random, issues = [] } = {}) {
  let inst = withEuropeanSeat(input, date);
  if (!inst || inst.status !== 'active') return { inst: input, events: [], lines: [] };
  const rules = INSTITUTIONS[inst.kind];
  const events = [];
  const lines = [];
  const add = act => { inst = record({ ...inst, acts: [...inst.acts, act] }, date, `${act.label}: “${act.title}”.`, 'atto'); };
  const majority = inst.groups.filter(group => group.side === 'maggioranza');
  const opposition = inst.groups.filter(group => group.side !== 'maggioranza');
  const pickArea = pool => pool[Math.floor(rand() * pool.length)];
  const open = inst.acts.filter(item => !CLOSED.includes(item.stage)).length;
  // New acts: the executive (from the local problems and its camp), the majority, the opposition; the budget in autumn.
  if (inst.budget && Number(date.slice(5, 7)) >= 11 && inst.budget.approvedYear < Number(date.slice(0, 4)) + 1 && !inst.acts.some(item => item.budget && !CLOSED.includes(item.stage))) {
    const leaderGroup = inst.groups.find(group => group.id === inst.executive?.groupId);
    add(newAct(inst, { kind: 'budget', sponsor: { kind: 'budget', groupId: inst.executive?.leader === 'player' ? inst.playerGroupId : leaderGroup?.id ?? null, label: rules.executive, axis: leaderGroup?.axis ?? 0 }, area: 'finanze', title: `${rules.acts.budget} ${Number(date.slice(0, 4)) + 1}`, date, budget: true }));
  }
  // In Strasbourg the player follows above all the dossiers of the own committees (the others pass in plenary).
  const euroArea = () => { const draw = rand(); const own = committeeById(draw < 0.45 ? inst.ep?.member : draw < 0.6 ? inst.ep?.substitute : null); return own ? own.areas[Math.floor(rand() * own.areas.length)] : pickArea(EU_AREAS); };
  if (open < 6) {
    const executiveArea = inst.kind === 'europa' ? euroArea() : issues.length && rand() < 0.6 ? pickArea(within(inst.kind, issues)) : pickArea(within(inst.kind, CAMP_PRIORITIES[inst.executive?.camp ?? 'centro']));
    if (inst.executive?.leader !== 'player' && rand() < rules.rates.executive) {
      const leaderGroup = inst.groups.find(group => group.id === inst.executive?.groupId);
      add(newAct(inst, { kind: 'executive', sponsor: { kind: 'executive', groupId: leaderGroup?.id ?? null, label: rules.executive, axis: inst.kind === 'europa' ? 0.5 : leaderGroup?.axis ?? 0 }, area: executiveArea, title: TITLES[inst.kind].executive(executiveArea), date }));
    }
    for (const [pool, kind] of [[majority, 'majority'], [opposition, 'opposition']]) {
      if (!pool.length || rand() >= rules.rates[kind]) continue;
      const group = pool[Math.floor(rand() * pool.length)];
      if (group.id === inst.playerGroupId && inst.kind !== 'europa') continue;
      const area = inst.kind !== 'europa' && issues.length && rand() < 0.35 ? pickArea(within(inst.kind, issues)) : inst.kind === 'europa' ? euroArea() : pickArea(within(inst.kind, CAMP_PRIORITIES[group.camp]));
      const act = newAct(inst, { kind, sponsor: { kind, groupId: group.id, label: group.label, axis: group.axis ?? 0 }, area, title: TITLES[inst.kind][kind](area), date });
      add(issues.includes(area) && rand() < 0.5 ? { ...act, consensual: true, title: `${act.title} (testo condiviso)` } : act);
    }
  }
  // The calendar of the council: committee, then the vote.
  for (const act of inst.acts.filter(item => !CLOSED.includes(item.stage) && item.nextStepAt <= date)) {
    if (act.stage === 'commissione' && inst.kind === 'europa') {
      // A dossier without a rapporteur gets one from a group (by weight); then the committee votes the report.
      const pool = inst.groups.filter(group => !group.nonAttached);
      const weights = pool.map(group => group.seats);
      let pick = rand() * weights.reduce((sum, value) => sum + value, 0);
      const assigned = act.rapporteur ?? (act.kind === 'player' ? { groupId: inst.playerGroupId, player: true } : { groupId: (pool.find((group, index) => (pick -= weights[index]) < 0) ?? pool[0])?.id ?? null, player: false });
      const vote = committeeVote(inst, { ...act, rapporteur: assigned }, date);
      const code = committeeById(act.committee)?.code ?? '';
      inst = { ...inst, acts: inst.acts.map(item => item.id === act.id ? { ...item, rapporteur: assigned, committeeVote: { yes: vote.yes, against: vote.against, abstain: vote.abstain, total: vote.total, passed: vote.passed, playerChoice: vote.playerChoice, date }, ...(vote.passed ? { stage: 'aula', nextStepAt: advanceDays(date, 7) } : { stage: 'respinto', closedAt: date }) } : item) };
      inst = record(inst, date, `Commissione ${code}: “${act.title}” ${vote.passed ? 'approvato, va in plenaria' : 'respinto'} (${vote.yes} sì, ${vote.against} no).`, 'commissione');
      if (inCommittee(inst, act) || assigned.player) events.push({ type: 'commissione-votata', actId: act.id, title: act.title, committee: code, passed: vote.passed, rapporteur: assigned.player, playerChoice: vote.playerChoice, playerLine: vote.playerLine, decisive: vote.decisive });
      if (assigned.player && !vote.passed) inst = { ...inst, ep: { ...inst.ep, merit: inst.ep.merit + 1 } };
      continue;
    }
    if (act.stage === 'commissione') { inst = { ...inst, acts: inst.acts.map(item => item.id === act.id ? { ...item, stage: 'aula', nextStepAt: advanceDays(date, 7) } : item) }; continue; }
    const vote = voteAct(inst, act, date);
    const stage = vote.passed ? 'approvato' : 'respinto';
    inst = { ...inst, acts: inst.acts.map(item => item.id === act.id ? { ...item, stage, votes: [...item.votes, vote], pendingPlayerVote: null, closedAt: date } : item) };
    inst = record(inst, date, `${rules.label}: “${act.title}” ${vote.passed ? 'approvato' : 'respinto'} (${vote.yes} sì, ${vote.against} no${vote.abstain ? `, ${vote.abstain} ${vote.abstain === 1 ? 'astenuto' : 'astenuti'}` : ''}${vote.playerChoice ? `; tuo voto: ${vote.playerChoice}${vote.decisive ? ', decisivo' : ''}` : ''}).`, stage);
    if (act.budget && vote.passed) inst = { ...inst, budget: { ...inst.budget, approvedYear: Number(act.title.match(/(\d{4})$/)?.[1] ?? Number(date.slice(0, 4)) + 1) } };
    if (inst.executive && (act.sponsor.kind === 'executive' || act.budget)) {
      inst = { ...inst, executive: { ...inst.executive, stability: clamp(inst.executive.stability + (vote.passed ? 1.5 : -8), 0, 100) } };
      // A group of the majority that did not follow the executive drifts away.
      const unhappy = new Set(vote.byGroup.filter(row => row.line !== 'favorevole').map(row => row.groupId));
      inst = { ...inst, groups: inst.groups.map(group => group.side === 'maggioranza' && unhappy.has(group.id) ? { ...group, cohesion: clamp(group.cohesion - 5, 0, 100) } : group) };
    }
    events.push({ type: 'atto-votato', actId: act.id, title: act.title, kind: act.kind, budget: act.budget, sponsor: act.sponsor, area: act.area, passed: vote.passed, playerChoice: vote.playerChoice, playerLine: vote.playerLine, decided: vote.decided, decisive: vote.decisive, yes: vote.yes, against: vote.against });
    // The player's report (or own-initiative report) in plenary: the work of months is judged.
    if (inst.ep && (act.rapporteur?.player || act.kind === 'player')) {
      inst = { ...inst, ep: { ...inst.ep, merit: inst.ep.merit + (vote.passed ? 3 : 1), reports: inst.ep.reports + (vote.passed ? 1 : 0) } };
      events.push({ type: 'relazione-votata', actId: act.id, title: act.title, committee: committeeById(act.committee)?.code ?? '', passed: vote.passed, own: act.kind === 'player' });
    }
  }
  // Acts of the player's council coming to the vote within the week: the player is asked (the important ones).
  for (const act of inst.acts.filter(item => item.stage === 'aula' && item.nextStepAt <= advanceDays(date, 7) && !item.pendingPlayerVote && !item.asked)) {
    const forecast = forecastAct(inst, act);
    inst = { ...inst, acts: inst.acts.map(item => item.id === act.id ? { ...item, asked: true } : item) };
    const important = act.budget || act.kind === 'sfiducia' || act.sponsor.groupId === inst.playerGroupId || act.rapporteur?.player || Math.abs(forecast.yes - forecast.needed) <= 1 || (act.kind === 'executive' && rand() < 0.2);
    if (important && act.sponsor.kind !== 'player') events.push({ type: 'voto-locale', actId: act.id, title: act.title, label: act.label, budget: act.budget, line: forecast.positions.find(item => item.groupId === inst.playerGroupId)?.line ?? 'astenuto', yes: forecast.yes, against: forecast.against, needed: forecast.needed, date: act.nextStepAt });
  }
  // Groups and executive: cohesion drifts, the opposition presses, a group of the majority may walk out.
  inst = { ...inst, groups: inst.groups.map(group => ({ ...group, cohesion: clamp(Math.round(group.cohesion + (rand() - 0.5) * 4 + (68 - group.cohesion) * 0.04), 0, 100) })), pressure: clamp(Math.round(inst.pressure + (rand() - 0.45) * 3 + (inst.executive ? (50 - inst.executive.stability) * 0.02 : 0)), 0, 100) };
  if (inst.executive) {
    const margin = majorityMargin(inst);
    const stability = clamp(inst.executive.stability + ((55 + clamp(margin, -5, 8) * 1.5 - inst.pressure * 0.15) - inst.executive.stability) * 0.06 + (rand() - 0.5) * 3, 0, 100);
    inst = { ...inst, executive: { ...inst.executive, stability: Math.round(stability) } };
    // A group of the majority unhappy with the executive threatens to leave, then leaves (not the player's own group).
    const shaky = inst.groups.filter(group => group.side === 'maggioranza' && group.id !== inst.executive.groupId && group.id !== inst.playerGroupId && group.cohesion < 45);
    const leaving = shaky.find(() => rand() < 0.04 + (50 - inst.executive.stability) / 400);
    if (leaving) {
      inst = { ...inst, groups: inst.groups.map(group => group.id === leaving.id ? { ...group, side: 'opposizione' } : group), executive: { ...inst.executive, stability: clamp(inst.executive.stability - 12, 0, 100), members: inst.executive.members.map(item => item.groupId === leaving.id ? { ...item, groupId: inst.executive.groupId, label: `Assessore (figura simulata) · ${inst.groups.find(group => group.id === inst.executive.groupId)?.label ?? ''}`.trim() } : item) } };
      inst = record(inst, date, `${leaving.label} esce dalla maggioranza.`, 'crisi');
      lines.push(`${rules.label}: ${leaving.label} esce dalla maggioranza.`);
      events.push({ type: 'uscita-maggioranza', group: leaving.label, margin: majorityMargin(inst) });
    } else if (inst.executive.leader === 'player' && shaky.length && !inst.threatFrom && rand() < 0.08) {
      inst = { ...inst, threatFrom: shaky[0].id };
      events.push({ type: 'minaccia-gruppo', groupId: shaky[0].id, group: shaky[0].label });
    }
    // Without a majority the opposition files a motion of no confidence; if it passes, the council is dissolved.
    if (majorityMargin(inst) < 0 && rules.dissolves && !inst.acts.some(item => item.kind === 'sfiducia' && !CLOSED.includes(item.stage))) {
      const opposing = opposition[0] ?? inst.groups.find(group => group.side !== 'maggioranza');
      inst = { ...inst, acts: [...inst.acts, { ...newAct(inst, { kind: 'opposition', sponsor: { kind: 'opposition', groupId: opposing?.id ?? null, label: opposing?.label ?? 'Opposizione', axis: opposing?.axis ?? 0 }, area: 'pa', title: `Mozione di sfiducia: ${rules.leader.toLowerCase()}`, date }), kind: 'sfiducia', stage: 'aula', nextStepAt: advanceDays(date, 7) }] };
      inst = record(inst, date, `L’opposizione presenta una mozione di sfiducia contro ${inst.executive.label}.`, 'sfiducia');
      events.push({ type: 'sfiducia-presentata' });
    }
    const confidence = inst.acts.find(item => item.kind === 'sfiducia' && item.stage === 'approvato' && !item.handled);
    if (confidence) {
      inst = { ...inst, status: 'sciolto', dissolvedAt: date, acts: inst.acts.map(item => item.id === confidence.id ? { ...item, handled: true } : item) };
      inst = record(inst, date, `Sfiducia approvata: ${rules.label.toLowerCase()} sciolto, arriva un commissario; si torna al voto.`, 'scioglimento');
      events.push({ type: 'scioglimento', kind: inst.kind });
    }
  }
  // Closed acts leave the list after a while (the last ones stay for the record).
  const closed = inst.acts.filter(item => CLOSED.includes(item.stage));
  if (closed.length > 12) {
    const old = new Set(closed.slice(0, closed.length - 12).map(item => item.id));
    inst = { ...inst, acts: inst.acts.filter(item => !old.has(item.id)), archive: [...inst.archive, ...inst.acts.filter(item => old.has(item.id)).map(item => ({ id: item.id, title: item.title, stage: item.stage, closedAt: item.closedAt, ...(item.votes?.length ? { vote: compactVote(item.votes.at(-1)) } : {}) }))].slice(-40) };
  }
  return { inst, events, lines };
}
