// The institutions where a local or European career is played: the consiglio comunale with its giunta and mayor, the
// consiglio regionale with its giunta and president, the European Parliament with its political groups. Each has
// groups of majority and opposition, an executive that proposes acts (deliberations, regional laws, the budget; the
// European Commission's dossiers), an opposition that attacks and files motions, groups that defect, a budget with its
// deadline, votes with individual dissent, and a player who proposes, votes, negotiates or governs. A council that loses
// its majority is dissolved and votes early. Everything is simulation; the European groups start from their real size
// at the constitutive session of 2024 (europarl), then evolve in the game.
import { DATA_SOURCES } from '../data/schema.js?v=20260926-7';
import { AREA_BY_ID, CAMP_PRIORITIES, POLICY_AREAS } from '../data/simulation/policy-rules.js?v=20260926-7';
import { cohesiveShare } from './parliament-engine.js?v=20260926-7';
import { groupLine, seededRandom, splitGroupVote } from './vote-engine.js?v=20260926-7';
import { advanceDays } from './time.js?v=20260926-7';

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
    pressure: 30, source: SIM
  };
}
const record = (inst, date, text, type = 'evento') => ({ ...inst, history: [...inst.history, { date, text, type }].slice(-40) });
const governing = inst => new Set(inst.groups.filter(group => group.side === 'maggioranza').map(group => group.id));
export const majorityMargin = inst => inst.groups.filter(group => group.side === 'maggioranza').reduce((sum, group) => sum + group.seats, 0) - (Math.floor(inst.seats / 2) + 1);

// ---------- acts ----------
function newAct(inst, { kind, sponsor, area, title, date, budget = false }) {
  const rules = INSTITUTIONS[inst.kind];
  return { id: `${inst.id}-atto-${inst.acts.length + inst.archive.length + 1}`, kind, title, area, sponsor, budget, stage: 'commissione', introducedAt: date, nextStepAt: advanceDays(date, (budget ? 2 : 1 + (inst.acts.length % 3)) * 7), votes: [], pendingPlayerVote: null, label: rules.acts[kind], source: SIM };
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
  // A shared theme (a motion on a local emergency, a proposal written with the other side) gathers votes across the aisle.
  if (act.consensual && inst.kind !== 'europa') value += fromMajority ? (inMajority ? 0 : 0.22) : (inMajority ? 0.26 : 0);
  // A majority group that feels neglected makes the executive pay on its acts.
  if (inMajority && fromMajority && group.cohesion < 50) value -= (50 - group.cohesion) / 120;
  return clamp(value, 0.05, 0.95);
}
export function forecastAct(inst, act) {
  let yes = 0;
  const positions = inst.groups.map(group => { const value = support(inst, act, group); yes += group.seats * cohesiveShare(value); return { groupId: group.id, label: group.label, seats: group.seats, side: group.side, support: Math.round(value * 100) / 100, line: value >= 0.55 ? 'favorevole' : value <= 0.42 ? 'contrario' : 'astenuto' }; });
  const needed = inst.kind === 'europa' ? Math.floor(inst.seats / 2) + 1 : Math.floor(inst.seats / 2) + 1;
  return { yes: Math.round(yes), needed, total: inst.seats, passes: yes >= needed, positions };
}
function voteAct(inst, act, date) {
  const decided = act.pendingPlayerVote;
  let choice = null, line = null;
  const rand = seededRandom(`${act.id}|${date}`);
  const byGroup = inst.groups.map(group => {
    const value = support(inst, act, group);
    const own = group.id === inst.playerGroupId;
    // The day of the vote: a few absent, a few who follow their own mind (more in a group that holds together less).
    const absent = Math.floor(group.seats * rand() * 0.12);
    const others = Math.max(0, (own ? group.seats - 1 : group.seats) - absent);
    const mood = clamp(value + (rand() - 0.5) * (0.12 + (100 - group.cohesion) / 250), 0.02, 0.98);
    let yes = Math.round(others * cohesiveShare(mood));
    const split = splitGroupVote({ seats: others, yes, seed: `${act.id}|${group.id}` });
    let no = split.no, abstain = split.abstain;
    if (own) {
      line = value >= 0.55 ? 'favorevole' : value <= 0.42 ? 'contrario' : 'astenuto';
      choice = !decided || decided === 'linea' ? line : decided;
      if (choice === 'favorevole') yes += 1; else if (choice === 'contrario') no += 1; else if (choice === 'astenuto') abstain += 1;
    }
    return { groupId: group.id, yesVotes: yes, noVotes: no, abstainVotes: abstain, absent, line: groupLine({ yes, no, abstain }), seats: group.seats, ...(own ? { playerChoice: choice } : {}) };
  });
  const yes = byGroup.reduce((sum, row) => sum + row.yesVotes, 0);
  const against = byGroup.reduce((sum, row) => sum + row.noVotes, 0);
  // Local councils decide by the majority of the votes cast; the European Parliament too (simple majority).
  const passed = yes > against;
  return { date, yes, against, abstain: byGroup.reduce((sum, row) => sum + row.abstainVotes, 0), total: inst.seats, passed, byGroup, playerChoice: choice, playerLine: line, decided: Boolean(decided), decisive: Boolean(choice) && choice !== 'assente' && Math.abs(yes - against) <= 1, source: SIM };
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

// ---------- one week ----------
// ctx: { date, rand, issues: [area], playerIsLeader }. Returns { inst, events, lines }: events for the career (votes of
// the player, requests, the fall of the executive and the early vote).
export function advanceInstitutionWeek(input, { date, rand = Math.random, issues = [] } = {}) {
  let inst = input;
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
  if (open < 6) {
    const executiveArea = issues.length && rand() < 0.6 ? pickArea(within(inst.kind, issues)) : pickArea(inst.kind === 'europa' ? EU_AREAS : within(inst.kind, CAMP_PRIORITIES[inst.executive?.camp ?? 'centro']));
    if (inst.executive?.leader !== 'player' && rand() < rules.rates.executive) {
      const leaderGroup = inst.groups.find(group => group.id === inst.executive?.groupId);
      add(newAct(inst, { kind: 'executive', sponsor: { kind: 'executive', groupId: leaderGroup?.id ?? null, label: rules.executive, axis: inst.kind === 'europa' ? 0.5 : leaderGroup?.axis ?? 0 }, area: executiveArea, title: TITLES[inst.kind].executive(executiveArea), date }));
    }
    for (const [pool, kind] of [[majority, 'majority'], [opposition, 'opposition']]) {
      if (!pool.length || rand() >= rules.rates[kind]) continue;
      const group = pool[Math.floor(rand() * pool.length)];
      if (group.id === inst.playerGroupId && inst.kind !== 'europa') continue;
      const area = inst.kind !== 'europa' && issues.length && rand() < 0.35 ? pickArea(within(inst.kind, issues)) : pickArea(inst.kind === 'europa' ? EU_AREAS : within(inst.kind, CAMP_PRIORITIES[group.camp]));
      const act = newAct(inst, { kind, sponsor: { kind, groupId: group.id, label: group.label, axis: group.axis ?? 0 }, area, title: TITLES[inst.kind][kind](area), date });
      add(issues.includes(area) && rand() < 0.5 ? { ...act, consensual: true, title: `${act.title} (testo condiviso)` } : act);
    }
  }
  // The calendar of the council: committee, then the vote.
  for (const act of inst.acts.filter(item => !CLOSED.includes(item.stage) && item.nextStepAt <= date)) {
    if (act.stage === 'commissione') { inst = { ...inst, acts: inst.acts.map(item => item.id === act.id ? { ...item, stage: 'aula', nextStepAt: advanceDays(date, 7) } : item) }; continue; }
    const vote = voteAct(inst, act, date);
    const stage = vote.passed ? 'approvato' : 'respinto';
    inst = { ...inst, acts: inst.acts.map(item => item.id === act.id ? { ...item, stage, votes: [...item.votes, vote], pendingPlayerVote: null, closedAt: date } : item) };
    inst = record(inst, date, `${rules.label}: “${act.title}” ${vote.passed ? 'approvato' : 'respinto'} (${vote.yes} sì, ${vote.against} no).`, stage);
    if (act.budget && vote.passed) inst = { ...inst, budget: { ...inst.budget, approvedYear: Number(act.title.match(/(\d{4})$/)?.[1] ?? Number(date.slice(0, 4)) + 1) } };
    if (inst.executive && (act.sponsor.kind === 'executive' || act.budget)) {
      inst = { ...inst, executive: { ...inst.executive, stability: clamp(inst.executive.stability + (vote.passed ? 1.5 : -8), 0, 100) } };
      // A group of the majority that did not follow the executive drifts away.
      const unhappy = new Set(vote.byGroup.filter(row => row.line !== 'favorevole').map(row => row.groupId));
      inst = { ...inst, groups: inst.groups.map(group => group.side === 'maggioranza' && unhappy.has(group.id) ? { ...group, cohesion: clamp(group.cohesion - 5, 0, 100) } : group) };
    }
    events.push({ type: 'atto-votato', actId: act.id, title: act.title, kind: act.kind, budget: act.budget, sponsor: act.sponsor, area: act.area, passed: vote.passed, playerChoice: vote.playerChoice, playerLine: vote.playerLine, decided: vote.decided, decisive: vote.decisive, yes: vote.yes, against: vote.against });
  }
  // Acts of the player's council coming to the vote within the week: the player is asked (the important ones).
  for (const act of inst.acts.filter(item => item.stage === 'aula' && item.nextStepAt <= advanceDays(date, 7) && !item.pendingPlayerVote && !item.asked)) {
    const forecast = forecastAct(inst, act);
    inst = { ...inst, acts: inst.acts.map(item => item.id === act.id ? { ...item, asked: true } : item) };
    const important = act.budget || act.kind === 'sfiducia' || act.sponsor.groupId === inst.playerGroupId || Math.abs(forecast.yes - forecast.needed) <= 1 || (act.kind === 'executive' && rand() < 0.2);
    if (important && act.sponsor.kind !== 'player') events.push({ type: 'voto-locale', actId: act.id, title: act.title, label: act.label, budget: act.budget, line: forecast.positions.find(item => item.groupId === inst.playerGroupId)?.line ?? 'astenuto', yes: forecast.yes, needed: forecast.needed, date: act.nextStepAt });
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
    inst = { ...inst, acts: inst.acts.filter(item => !old.has(item.id)), archive: [...inst.archive, ...inst.acts.filter(item => old.has(item.id)).map(item => ({ id: item.id, title: item.title, stage: item.stage, closedAt: item.closedAt }))].slice(-40) };
  }
  return { inst, events, lines };
}
