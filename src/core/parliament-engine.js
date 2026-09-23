import { DATA_SOURCES } from '../data/schema.js?v=20260924-11';

export const CHAMBERS = Object.freeze({
  camera: { label: 'Camera dei deputati', shortLabel: 'Camera', source: DATA_SOURCES.REAL },
  senato: { label: 'Senato della Repubblica', shortLabel: 'Senato', source: DATA_SOURCES.REAL }
});

export const LAW_CATEGORIES = Object.freeze([
  'Economia', 'Lavoro', 'Sanità', 'Scuola', 'Sicurezza', 'Ambiente',
  'Infrastrutture', 'Giustizia', 'Welfare', 'Pubblica amministrazione'
]);

export const MINISTERIAL_PORTFOLIOS = Object.freeze([
  'Economia e finanze', 'Interno', 'Esteri', 'Giustizia', 'Difesa', 'Lavoro',
  'Salute', 'Istruzione', 'Ambiente', 'Infrastrutture'
]);

// Internal career ladder of the game: each step is a simulated appointment, never a real office.
export const PARLIAMENTARY_ROLES = Object.freeze([
  { level: 1, title: 'Responsabile di commissione', threshold: 50 },
  { level: 2, title: 'Vicepresidente di commissione', threshold: 58 },
  { level: 3, title: 'Presidente di commissione', threshold: 66 }
]);

export const CONTEST_COST = 8;
export const CONTEST_WINDOW_DAYS = 30;
const BASE_POSITION = 'Componente del gruppo nello scenario';
const OPEN_GOVERNMENT = ['awaiting-confidence', 'active', 'crisis'];
const CLOSED_LAW_STAGES = ['approved', 'rejected', 'lapsed'];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const opposite = chamber => chamber === 'camera' ? 'senato' : 'camera';
const newId = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const normalizeGroup = group => ({
  groupId: group.id,
  officialName: group.officialName,
  chamber: group.chamber,
  simulatedSeats: group.memberCount,
  source: DATA_SOURCES.SIMULATION,
  reference: {
    memberCount: group.memberCount,
    leaderPoliticianId: group.leaderPoliticianId ?? null,
    countAsOf: group.countAsOf ?? group.verifiedAt ?? null,
    source: group.source,
    verified: group.verified,
    sourceUrl: group.sourceUrl ?? null,
    sourceName: group.sourceName ?? null
  }
});

function allGroups(parliament) {
  return ['camera', 'senato'].flatMap(chamber => parliament?.chambers?.[chamber]?.groups ?? []);
}
function getGroup(parliament, groupId) { return allGroups(parliament).find(group => group.groupId === groupId) ?? null; }
function totalSeats(parliament, chamber) {
  return (parliament?.chambers?.[chamber]?.groups ?? []).reduce((sum, group) => sum + (group.simulatedSeats ?? 0), 0);
}
function majority(parliament, chamber) { return Math.floor(totalSeats(parliament, chamber) / 2) + 1; }
function record(parliament, date, type, text, details = {}) {
  const entry = { id: newId('attivita-parlamentare'), date, type, text, details, source: DATA_SOURCES.SIMULATION };
  return { ...parliament, history: [...(parliament.history ?? []), entry] };
}
function setRelation(parliament, groupId, delta) {
  const current = parliament.relations?.[groupId] ?? { value: 50, source: DATA_SOURCES.SIMULATION };
  return { ...parliament, relations: { ...parliament.relations, [groupId]: { ...current, value: clamp(current.value + delta, 0, 100), source: DATA_SOURCES.SIMULATION } } };
}
function changeSeats(parliament, chamber, groupId, delta) {
  const current = parliament.chambers?.[chamber];
  if (!current || !groupId) return parliament;
  const groups = current.groups.map(group => group.groupId === groupId ? { ...group, simulatedSeats: Math.max(0, group.simulatedSeats + delta) } : group);
  return { ...parliament, chambers: { ...parliament.chambers, [chamber]: { ...current, groups } } };
}
function adjustStanding(parliament, delta) {
  if (!parliament.careerStanding || !delta) return parliament;
  return { ...parliament, careerStanding: { ...parliament.careerStanding, partySupport: clamp(parliament.careerStanding.partySupport + delta, 0, 100), source: DATA_SOURCES.SIMULATION } };
}
function createCareerStanding() {
  return {
    position: BASE_POSITION, roleLevel: 0, committeeRole: null, roles: [],
    partySupport: 50, competitionStrength: PARLIAMENTARY_ROLES[0].threshold,
    lastContestAt: null, lastContest: null, source: DATA_SOURCES.SIMULATION
  };
}
export function governingGroupIds(parliament) {
  const government = parliament?.government;
  if (!government || !['active', 'crisis'].includes(government.status)) return new Set();
  return new Set([...(government.coalitionGroupIds ?? []), ...(government.supportingGroupIds ?? [])]);
}
export function playerInMajority(parliament) {
  return Boolean(parliament?.player?.groupId) && governingGroupIds(parliament).has(parliament.player.groupId);
}

export function createParliamentState({ career, player, groups = [], currentDate, politicalCapital = 50 }) {
  const chamber = CHAMBERS[career?.parliamentContext?.chamber] ? career.parliamentContext.chamber : null;
  const groupId = career?.parliamentContext?.groupId ?? null;
  const chambers = Object.fromEntries(['camera', 'senato'].map(kind => {
    const referenceGroups = groups.filter(group => group?.source === DATA_SOURCES.REAL && group.verified === true && group.chamber === kind && Number.isInteger(group.memberCount));
    const scenarioGroups = referenceGroups.map(group => {
      const entry = normalizeGroup(group);
      // The player's place exists only in this career save; immutable real counts stay unchanged.
      if (kind === chamber && entry.groupId === groupId) entry.simulatedSeats += 1;
      return entry;
    });
    return [kind, { id: `scenario-${kind}`, chamber: kind, label: CHAMBERS[kind].label, groups: scenarioGroups, source: DATA_SOURCES.SIMULATION }];
  }));
  const relations = Object.fromEntries(allGroups({ chambers }).map(group => [group.groupId, { value: 50, source: DATA_SOURCES.SIMULATION }]));
  const validGroup = chamber && chambers[chamber].groups.some(group => group.groupId === groupId) ? groupId : null;
  const parliament = {
    id: newId('scenario-parlamento'), source: DATA_SOURCES.SIMULATION, createdAt: currentDate,
    player: chamber ? { politicianId: player?.id ?? null, chamber, groupId: validGroup, position: BASE_POSITION, territoryName: career?.parliamentContext?.territoryName ?? null, mandateStartedAt: currentDate, source: DATA_SOURCES.SIMULATION } : null,
    contextMode: chamber ? 'real-context' : null,
    chambers, relations, resources: { politicalCapital: clamp(Number(politicalCapital) || 50, 0, 100), source: DATA_SOURCES.SIMULATION },
    careerStanding: chamber ? createCareerStanding() : null,
    government: null, laws: [], history: [], pastMandates: [], pollingHook: { connected: false, source: DATA_SOURCES.SIMULATION }
  };
  if (chamber) {
    const referenceGroup = getGroup(parliament, validGroup);
    return record(parliament, currentDate, 'ingresso', `${CHAMBERS[chamber].shortLabel}: avvio dello scenario parlamentare con ${referenceGroup?.officialName ?? 'gruppo da definire'}.`, { chamber, groupId: validGroup, source: DATA_SOURCES.SIMULATION });
  }
  return parliament;
}

// Restores saves written by earlier builds: missing collections get neutral defaults, nothing is dropped.
export function normalizeParliamentState(parliament) {
  if (!parliament || typeof parliament !== 'object') return null;
  const chambers = Object.fromEntries(['camera', 'senato'].map(kind => {
    const current = parliament.chambers?.[kind] ?? {};
    const groups = (Array.isArray(current.groups) ? current.groups : []).filter(group => group?.groupId).map(group => ({
      ...group,
      chamber: group.chamber ?? kind,
      simulatedSeats: Number.isFinite(group.simulatedSeats) ? group.simulatedSeats : numberOr(group.reference?.memberCount, 0),
      reference: group.reference ?? { memberCount: null, leaderPoliticianId: null, countAsOf: null, source: DATA_SOURCES.REAL, verified: true, sourceUrl: null, sourceName: null },
      source: DATA_SOURCES.SIMULATION
    }));
    return [kind, { id: `scenario-${kind}`, chamber: kind, label: CHAMBERS[kind].label, source: DATA_SOURCES.SIMULATION, ...current, groups }];
  }));
  const relations = { ...(parliament.relations ?? {}) };
  for (const group of allGroups({ chambers })) if (!relations[group.groupId]) relations[group.groupId] = { value: 50, source: DATA_SOURCES.SIMULATION };
  const player = parliament.player && CHAMBERS[parliament.player.chamber] ? { position: BASE_POSITION, groupId: null, source: DATA_SOURCES.SIMULATION, ...parliament.player } : null;
  const government = parliament.government ? {
    coalitionGroupIds: [], supportingGroupIds: [], ministers: [], confidenceVotes: [], crisisSeverity: 0, stability: 50, ...parliament.government
  } : null;
  const laws = (Array.isArray(parliament.laws) ? parliament.laws : []).map(law => ({
    negotiatedGroupIds: [], amendments: [], votes: [], compromiseLevel: 0, forcedVote: false, ...law
  }));
  const standing = parliament.careerStanding
    ? { ...createCareerStanding(), ...parliament.careerStanding, roles: parliament.careerStanding.roles ?? (parliament.careerStanding.committeeRole ? [parliament.careerStanding.committeeRole] : []), roleLevel: parliament.careerStanding.roleLevel ?? (parliament.careerStanding.committeeRole ? 1 : 0) }
    : player ? createCareerStanding() : null;
  return {
    source: DATA_SOURCES.SIMULATION, contextMode: player ? 'real-context' : null, pollingHook: { connected: false, source: DATA_SOURCES.SIMULATION },
    ...parliament,
    chambers, relations, player, government, laws, careerStanding: standing,
    resources: { source: DATA_SOURCES.SIMULATION, ...(parliament.resources ?? {}), politicalCapital: clamp(numberOr(parliament.resources?.politicalCapital, 50), 0, 100) },
    history: Array.isArray(parliament.history) ? parliament.history : [],
    pastMandates: Array.isArray(parliament.pastMandates) ? parliament.pastMandates : []
  };
}

export function enterParliament(parliament, { politicianId, chamber, groupId = null, territoryName = null, currentDate }) {
  if (!CHAMBERS[chamber]) throw new Error('Camera non valida per il mandato.');
  let next = normalizeParliamentState(parliament);
  const current = next.player;
  if (current?.chamber === chamber) {
    next = { ...next, player: { ...current, politicianId: politicianId ?? current.politicianId, territoryName: territoryName ?? current.territoryName, mandateStartedAt: currentDate } };
    return record(next, currentDate, 'rielezione', `${CHAMBERS[chamber].shortLabel}: seggio confermato, il mandato prosegue nello scenario.`, { chamber, groupId: current.groupId, source: DATA_SOURCES.SIMULATION });
  }
  if (current?.groupId) next = changeSeats(next, current.chamber, current.groupId, -1);
  const target = groupId ? getGroup(next, groupId) : null;
  const validGroup = target?.chamber === chamber ? groupId : null;
  if (validGroup) next = changeSeats(next, chamber, validGroup, 1);
  next = {
    ...next, contextMode: 'real-context', careerStanding: createCareerStanding(),
    player: { politicianId, chamber, groupId: validGroup, position: BASE_POSITION, territoryName, mandateStartedAt: currentDate, source: DATA_SOURCES.SIMULATION }
  };
  const text = validGroup
    ? `${CHAMBERS[chamber].shortLabel}: mandato avviato con ${getGroup(next, validGroup).officialName} nello scenario.`
    : `${CHAMBERS[chamber].shortLabel}: mandato ottenuto nello scenario. Scegli il gruppo di riferimento.`;
  return record(next, currentDate, 'ingresso', text, { chamber, groupId: validGroup, source: DATA_SOURCES.SIMULATION });
}

export function leaveParliament(parliament, currentDate, reason = 'Mandato concluso') {
  const current = parliament?.player;
  if (!current) return parliament;
  let next = current.groupId ? changeSeats(parliament, current.chamber, current.groupId, -1) : parliament;
  const laws = next.laws.map(law => CLOSED_LAW_STAGES.includes(law.stage) ? law : { ...law, stage: 'lapsed', status: 'lapsed', updatedAt: currentDate });
  const mandate = {
    id: newId('mandato-concluso'), chamber: current.chamber, groupId: current.groupId, startedAt: current.mandateStartedAt ?? next.createdAt, endedAt: currentDate,
    roles: next.careerStanding?.roles ?? [], reason, source: DATA_SOURCES.SIMULATION
  };
  next = { ...next, laws, player: null, careerStanding: null, pastMandates: [...(next.pastMandates ?? []), mandate] };
  return record(next, currentDate, 'fine-mandato', `${CHAMBERS[current.chamber].shortLabel}: ${reason.charAt(0).toLowerCase() + reason.slice(1)}. Le proposte ancora in esame decadono.`, { chamber: current.chamber, groupId: current.groupId, source: DATA_SOURCES.SIMULATION });
}

export function assignPlayerGroup(parliament, groupId, currentDate) {
  const player = parliament?.player;
  const target = getGroup(parliament, groupId);
  if (!player?.chamber || !target || target.chamber !== player.chamber) throw new Error('Scegli un gruppo della Camera o del Senato del tuo percorso.');
  if (player.groupId === groupId) throw new Error('Fai già parte di questo gruppo nello scenario.');
  const previousGroupId = player.groupId;
  let next = changeSeats(parliament, player.chamber, previousGroupId, -1);
  next = changeSeats(next, player.chamber, groupId, 1);
  next = { ...next, player: { ...player, groupId, position: BASE_POSITION, source: DATA_SOURCES.SIMULATION } };
  if (previousGroupId) {
    // Leaving a group costs trust and the group-assigned responsibilities.
    const standing = next.careerStanding ?? createCareerStanding();
    const endedRoles = standing.roles.map(role => role.endedAt ? role : { ...role, endedAt: currentDate });
    next = setRelation(next, previousGroupId, -12);
    next = { ...next, careerStanding: { ...standing, roles: endedRoles, roleLevel: 0, committeeRole: null, position: BASE_POSITION, partySupport: 42, competitionStrength: PARLIAMENTARY_ROLES[0].threshold, source: DATA_SOURCES.SIMULATION } };
    const previous = getGroup(parliament, previousGroupId);
    return record(next, currentDate, 'cambio-gruppo', `Lasciato ${previous?.officialName ?? 'il gruppo precedente'} per ${target.officialName}: gli incarichi di gruppo si interrompono.`, { groupId, previousGroupId, chamber: player.chamber, source: DATA_SOURCES.SIMULATION });
  }
  return record(next, currentDate, 'adesione-gruppo', 'Scelto il gruppo parlamentare di riferimento ' + target.officialName + ' nello scenario.', { groupId, chamber: player.chamber, source: DATA_SOURCES.SIMULATION });
}

export function canManageParliament(parliament) {
  return Boolean(parliament?.player?.politicianId && parliament.player.groupId && getGroup(parliament, parliament.player.groupId));
}

export function proposeLaw(parliament, { title, category, summary, currentDate }) {
  if (!canManageParliament(parliament)) throw new Error('Per presentare una legge serve un percorso parlamentare e un gruppo di riferimento.');
  const cleanTitle = String(title ?? '').trim();
  const cleanSummary = String(summary ?? '').trim();
  if (cleanTitle.length < 5) throw new Error('Il titolo deve contenere almeno 5 caratteri.');
  if (!LAW_CATEGORIES.includes(category)) throw new Error('Scegli una categoria valida.');
  if (cleanSummary.length < 12) throw new Error('Descrivi la proposta con almeno 12 caratteri.');
  const law = {
    id: newId('legge'), title: cleanTitle, category, summary: cleanSummary,
    status: 'proposal', stage: 'proposal', introducedAt: currentDate, updatedAt: currentDate,
    firstChamber: parliament.player.chamber, currentChamber: parliament.player.chamber,
    negotiatedGroupIds: [], amendments: [], compromiseLevel: 0, forcedVote: false,
    votes: [], source: DATA_SOURCES.SIMULATION
  };
  let next = { ...parliament, laws: [...parliament.laws, law] };
  next = record(next, currentDate, 'legge-proposta', `Presentata “${law.title}” (${law.category.toLowerCase()}).`, { lawId: law.id, stage: law.stage });
  return { parliament: next, law };
}

function replaceLaw(parliament, lawId, transform) {
  const existing = parliament.laws.find(law => law.id === lawId);
  if (!existing) throw new Error('La proposta non è più disponibile.');
  const updated = transform(existing);
  return { ...parliament, laws: parliament.laws.map(law => law.id === lawId ? updated : law) };
}

export function amendLaw(parliament, lawId, text, currentDate) {
  if (!canManageParliament(parliament)) throw new Error('Serve un mandato parlamentare attivo per presentare emendamenti.');
  const amendment = String(text ?? '').trim();
  if (!amendment) throw new Error('Scrivi il testo dell’emendamento.');
  const law = parliament.laws.find(item => item.id === lawId);
  if (!law || law.stage !== 'amendments') throw new Error('Gli emendamenti sono disponibili durante l’esame in commissione.');
  let next = replaceLaw(parliament, lawId, current => ({ ...current, amendments: [...current.amendments, { id: newId('emendamento'), text: amendment, date: currentDate, source: DATA_SOURCES.SIMULATION }], updatedAt: currentDate }));
  next = record(next, currentDate, 'emendamento', `Aggiunto un emendamento a “${law.title}”.`, { lawId, source: DATA_SOURCES.SIMULATION });
  return next;
}

// A group only sits at the table when relations and the player's weight allow it.
function refusesTalks(parliament, groupId, influence) {
  return (parliament.relations?.[groupId]?.value ?? 50) + numberOr(influence, 50) * 0.2 < 45;
}
function refusal(parliament, groupId, currentDate, details) {
  const group = getGroup(parliament, groupId);
  const next = { ...parliament, resources: { ...parliament.resources, politicalCapital: Math.max(0, (parliament.resources?.politicalCapital ?? 0) - 2) } };
  return record(next, currentDate, 'negoziato-rifiutato', `${group.officialName} rifiuta di trattare: i rapporti sono troppo tesi.`, { groupId, ...details, source: DATA_SOURCES.SIMULATION });
}

export function negotiateLaw(parliament, lawId, groupId, currentDate, { influence = 50 } = {}) {
  if (!canManageParliament(parliament)) throw new Error('Serve un mandato parlamentare attivo per negoziare.');
  const law = parliament.laws.find(item => item.id === lawId);
  if (!law || !['amendments', 'final-vote'].includes(law.stage)) throw new Error('La trattativa è disponibile durante gli emendamenti o prima della votazione finale.');
  const target = getGroup(parliament, groupId);
  if (!target || target.chamber !== law.currentChamber) throw new Error('Scegli un gruppo della Camera che sta esaminando la proposta.');
  if (target.groupId === parliament.player.groupId) throw new Error('Il tuo gruppo sostiene già la proposta.');
  if (law.negotiatedGroupIds.includes(groupId)) throw new Error('Il gruppo è già coinvolto nella trattativa.');
  if ((parliament.resources?.politicalCapital ?? 0) < 4) throw new Error('Capitale politico insufficiente per aprire un’altra trattativa.');
  if (refusesTalks(parliament, groupId, influence)) return refusal(parliament, groupId, currentDate, { lawId });
  let next = { ...parliament, resources: { ...parliament.resources, politicalCapital: parliament.resources.politicalCapital - 4 } };
  next = replaceLaw(next, lawId, current => ({ ...current, negotiatedGroupIds: [...current.negotiatedGroupIds, groupId], updatedAt: currentDate }));
  next = setRelation(next, groupId, 3);
  return record(next, currentDate, 'negoziato', `Avviato un negoziato con ${target.officialName}.`, { lawId, groupId, source: DATA_SOURCES.SIMULATION });
}

export function compromiseLaw(parliament, lawId, currentDate) {
  if (!canManageParliament(parliament)) throw new Error('Serve un mandato parlamentare attivo per modificare la proposta.');
  const law = parliament.laws.find(item => item.id === lawId);
  if (!law || law.stage !== 'amendments') throw new Error('Il compromesso è disponibile nella fase emendamenti.');
  if ((parliament.resources?.politicalCapital ?? 0) < 2) throw new Error('Capitale politico insufficiente per un nuovo compromesso.');
  const level = Math.min(3, law.compromiseLevel + 1);
  if (level === law.compromiseLevel) throw new Error('La proposta ha già raggiunto il massimo livello di compromesso.');
  let next = { ...parliament, resources: { ...parliament.resources, politicalCapital: parliament.resources.politicalCapital - 2 } };
  next = replaceLaw(next, lawId, current => ({ ...current, compromiseLevel: level, amendments: [...current.amendments, { id: newId('emendamento'), text: 'Compromesso negoziale generale', date: currentDate, source: DATA_SOURCES.SIMULATION }], updatedAt: currentDate }));
  return record(next, currentDate, 'compromesso', `Accolto un compromesso su “${law.title}”.`, { lawId, compromiseLevel: level, source: DATA_SOURCES.SIMULATION });
}

function calculateVote(parliament, law, chamber) {
  const governing = governingGroupIds(parliament);
  const inMajority = playerInMajority(parliament);
  const negotiated = new Set(law.negotiatedGroupIds);
  const rows = parliament.chambers[chamber].groups;
  let yes = 0;
  const results = rows.map(group => {
    const relation = parliament.relations?.[group.groupId]?.value ?? 50;
    const own = group.groupId === parliament.player?.groupId;
    let support = own ? 0.58
      : negotiated.has(group.groupId) ? 0.72
      : governing.has(group.groupId) ? (inMajority ? 0.65 : 0.4)
      : governing.size && inMajority ? 0.38 : 0.43;
    support += law.compromiseLevel * 0.035;
    support += (relation - 50) / 1000;
    // A forced vote tightens discipline in the player's camp and hardens everyone else.
    if (governing.has(group.groupId) && (parliament.government?.stability ?? 50) < 40) support -= (40 - parliament.government.stability) / 400;
    if (law.forcedVote) support += own || (inMajority && governing.has(group.groupId)) ? 0.1 : -0.07;
    const votes = Math.round(group.simulatedSeats * clamp(support, 0.12, 0.9));
    yes += votes;
    return { groupId: group.groupId, yesVotes: votes, simulatedSeats: group.simulatedSeats, source: DATA_SOURCES.SIMULATION };
  });
  const total = rows.reduce((sum, group) => sum + group.simulatedSeats, 0);
  const needed = Math.floor(total / 2) + 1;
  return { chamber, yes, no: total - yes, total, needed, passed: yes >= needed, forced: Boolean(law.forcedVote), byGroup: results, source: DATA_SOURCES.SIMULATION };
}

export function advanceLaw(parliament, lawId, action, currentDate) {
  const law = parliament.laws.find(item => item.id === lawId);
  if (!law) throw new Error('La proposta non è disponibile.');
  if (CLOSED_LAW_STAGES.includes(law.stage)) throw new Error('L’iter legislativo è già concluso.');
  if (!canManageParliament(parliament)) throw new Error('Serve un mandato parlamentare attivo per far avanzare la proposta.');
  let next = parliament;
  let text = '';
  if (law.stage === 'proposal' && action === 'present') {
    next = replaceLaw(next, lawId, current => ({ ...current, stage: 'commission', status: 'commission', updatedAt: currentDate }));
    text = `“${law.title}” è stata assegnata alla commissione.`;
  } else if (law.stage === 'commission' && action === 'complete-commission') {
    next = replaceLaw(next, lawId, current => ({ ...current, stage: 'amendments', status: 'amendments', updatedAt: currentDate }));
    text = `Concluso l’esame in commissione di “${law.title}”.`;
  } else if (law.stage === 'amendments' && ['vote', 'force-vote'].includes(action)) {
    const forced = action === 'force-vote';
    const votingLaw = forced ? { ...law, forcedVote: true } : law;
    const vote = calculateVote(next, votingLaw, law.currentChamber);
    next = replaceLaw(next, lawId, current => ({ ...current, forcedVote: forced || current.forcedVote, stage: vote.passed ? 'other-chamber' : 'rejected', status: vote.passed ? 'other-chamber' : 'rejected', votes: [...current.votes, vote], updatedAt: currentDate }));
    if (forced) for (const group of next.chambers[law.currentChamber].groups) {
      if (group.groupId !== next.player.groupId && !(playerInMajority(next) && governingGroupIds(next).has(group.groupId))) next = setRelation(next, group.groupId, -2);
    }
    if (!vote.passed) next = adjustStanding(next, -1);
    text = vote.passed ? `Via libera simulato alla ${CHAMBERS[law.currentChamber].label}: “${law.title}” passa all’altra Camera.` : `La proposta “${law.title}” è stata respinta nella prima votazione simulata.`;
  } else if (law.stage === 'other-chamber' && action === 'transmit') {
    const nextChamber = opposite(law.currentChamber);
    next = replaceLaw(next, lawId, current => ({ ...current, currentChamber: nextChamber, stage: 'final-vote', status: 'final-vote', negotiatedGroupIds: [], updatedAt: currentDate }));
    text = `“${law.title}” arriva alla ${CHAMBERS[nextChamber].label} per la votazione finale.`;
  } else if (law.stage === 'final-vote' && action === 'final-vote') {
    const vote = calculateVote(next, law, law.currentChamber);
    const resultStage = vote.passed ? 'approved' : 'rejected';
    next = replaceLaw(next, lawId, current => ({ ...current, stage: resultStage, status: resultStage, votes: [...current.votes, vote], updatedAt: currentDate }));
    next = adjustStanding(next, vote.passed ? 2 : -1);
    text = vote.passed ? `Approvazione simulata definitiva: “${law.title}”.` : `La ${CHAMBERS[law.currentChamber].label} ha respinto “${law.title}” nella votazione finale simulata.`;
  } else {
    throw new Error('Questa azione non è disponibile nella fase corrente.');
  }
  const current = next.laws.find(item => item.id === lawId);
  next = record(next, currentDate, `iter-${current.stage}`, text, { lawId, stage: current.stage, source: DATA_SOURCES.SIMULATION });
  return { parliament: next, law: current, vote: current.votes.at(-1) ?? null };
}

function validateCoalition(parliament, groupIds) {
  const selected = [...new Set(groupIds ?? [])].filter(id => getGroup(parliament, id));
  if (!selected.length) throw new Error('Scegli almeno un gruppo per aprire la trattativa.');
  if (!['camera', 'senato'].every(chamber => selected.some(id => getGroup(parliament, id).chamber === chamber))) throw new Error('La coalizione deve includere almeno un gruppo alla Camera e uno al Senato: la fiducia si vota in entrambe.');
  return selected;
}

export function formGovernment(parliament, groupIds, currentDate) {
  if (!canManageParliament(parliament)) throw new Error('Per guidare una trattativa di governo serve un seggio e un gruppo di riferimento.');
  if (parliament.government && OPEN_GOVERNMENT.includes(parliament.government.status)) throw new Error('C’è già un governo o una trattativa aperta: rinegozia la coalizione esistente.');
  const requested = [...new Set(groupIds ?? [])].filter(id => getGroup(parliament, id));
  const refusing = requested.filter(id => id !== parliament.player.groupId && (parliament.relations?.[id]?.value ?? 50) < 35);
  if (refusing.length && requested.length === refusing.length) throw new Error('Nessuno dei gruppi scelti accetta di trattare.');
  let selected;
  try { selected = validateCoalition(parliament, requested.filter(id => !refusing.includes(id))); }
  catch (error) { throw new Error(refusing.length ? `Rifiutano la trattativa: ${refusing.map(id => getGroup(parliament, id).officialName).join(', ')}. ${error.message}` : error.message); }
  const gov = {
    id: newId('governo-simulato'), name: `Governo di coalizione ${new Date(`${currentDate}T12:00:00`).getFullYear()}`,
    status: 'awaiting-confidence', coalitionGroupIds: selected, supportingGroupIds: [], ministers: [],
    crisisSeverity: 0, stability: 50, proposedAt: currentDate, confidenceVotes: [], source: DATA_SOURCES.SIMULATION
  };
  const next = { ...parliament, government: gov, pastGovernments: parliament.government ? [...(parliament.pastGovernments ?? []), parliament.government] : (parliament.pastGovernments ?? []) };
  return record(next, currentDate, 'governo-proposto', `Aperta una trattativa di governo con ${selected.length} gruppi${refusing.length ? `; rifiutano ${refusing.map(id => getGroup(parliament, id).officialName).join(', ')}` : ''}.`, { governmentId: gov.id, coalitionGroupIds: selected, source: DATA_SOURCES.SIMULATION });
}

export function negotiateGovernmentSupport(parliament, groupId, currentDate, { influence = 50 } = {}) {
  if (!canManageParliament(parliament)) throw new Error('Serve un mandato parlamentare attivo per trattare con gli altri gruppi.');
  const government = parliament.government;
  const group = getGroup(parliament, groupId);
  if (!government || !OPEN_GOVERNMENT.includes(government.status)) throw new Error('Non c’è una trattativa di governo aperta.');
  if (!group || government.coalitionGroupIds.includes(groupId)) throw new Error('Scegli un gruppo esterno alla coalizione.');
  if (government.supportingGroupIds.includes(groupId)) throw new Error('Il gruppo ha già promesso sostegno.');
  if ((parliament.resources?.politicalCapital ?? 0) < 5) throw new Error('Capitale politico insufficiente per un accordo.');
  if (refusesTalks(parliament, groupId, influence)) return refusal(parliament, groupId, currentDate, { governmentId: government.id });
  let next = { ...parliament, resources: { ...parliament.resources, politicalCapital: parliament.resources.politicalCapital - 5 }, government: { ...government, supportingGroupIds: [...government.supportingGroupIds, groupId] } };
  next = setRelation(next, groupId, 4);
  return record(next, currentDate, 'sostegno-governo', `Ottenuto un impegno simulato di sostegno da ${group.officialName}.`, { governmentId: government.id, groupId, source: DATA_SOURCES.SIMULATION });
}

export function reviseGovernmentCoalition(parliament, groupIds, currentDate) {
  if (!canManageParliament(parliament)) throw new Error('Serve un mandato parlamentare attivo per rinegoziare la coalizione.');
  const government = parliament.government;
  if (!government || !OPEN_GOVERNMENT.includes(government.status)) throw new Error('Non c’è un governo da rinegoziare.');
  const selected = validateCoalition(parliament, groupIds);
  const supportingGroupIds = government.supportingGroupIds.filter(id => !selected.includes(id));
  const allowed = new Set([...selected, ...supportingGroupIds]);
  const ministers = government.ministers.map(item => allowed.has(item.groupId) || item.endedAt ? item : { ...item, endedAt: currentDate, endReason: 'Gruppo uscito dalla maggioranza' });
  const removed = ministers.filter(item => item.endedAt === currentDate && item.endReason).length;
  const next = { ...parliament, government: { ...government, coalitionGroupIds: selected, supportingGroupIds, ministers, status: 'awaiting-confidence', crisisSeverity: 0 } };
  return record(next, currentDate, 'coalizione-modificata', `La composizione della coalizione è stata rinegoziata${removed ? `: ${removed} incarichi di governo decadono` : ''}; serve una nuova fiducia.`, { governmentId: government.id, coalitionGroupIds: selected, source: DATA_SOURCES.SIMULATION });
}

export function activeMinisters(government) {
  return (government?.ministers ?? []).filter(item => !item.endedAt);
}

export function assignMinister(parliament, portfolio, groupId, currentDate, { appointee = 'group', appointeeLabel = null } = {}) {
  const government = parliament.government;
  if (!government || !['active', 'awaiting-confidence'].includes(government.status)) throw new Error('Forma un governo prima di distribuire gli incarichi.');
  if (!MINISTERIAL_PORTFOLIOS.includes(portfolio)) throw new Error('Scegli un ministero disponibile.');
  const toPlayer = appointee === 'player';
  if (toPlayer) {
    if (!canManageParliament(parliament)) throw new Error('Serve un mandato parlamentare attivo per entrare nel governo.');
    groupId = parliament.player.groupId;
    if (activeMinisters(government).some(item => item.playerAppointed)) throw new Error('Hai già un incarico di governo in questo esecutivo.');
  }
  if (![...government.coalitionGroupIds, ...government.supportingGroupIds].includes(groupId)) throw new Error(toPlayer ? 'Puoi entrare nel governo solo se il tuo gruppo fa parte della maggioranza.' : 'L’incarico va assegnato a un gruppo della maggioranza o a un sostenitore.');
  if (activeMinisters(government).some(item => item.portfolio === portfolio)) throw new Error('Questo ministero è già assegnato.');
  const group = getGroup(parliament, groupId);
  const appointment = { id: newId('nomina'), portfolio, groupId, groupName: group.officialName, playerAppointed: toPlayer, appointeeLabel: toPlayer ? (appointeeLabel || 'Il tuo politico') : 'Incarico di governo simulato', source: DATA_SOURCES.SIMULATION, appointedAt: currentDate };
  let next = { ...parliament, government: { ...government, ministers: [...government.ministers, appointment] } };
  next = setRelation(next, groupId, 3);
  if (toPlayer) next = adjustStanding(next, 2);
  return record(next, currentDate, toPlayer ? 'nomina-ministro-giocatore' : 'nomina-ministro', toPlayer ? `Assunto l’incarico di ministro (${portfolio}) nello scenario.` : `Assegnato il ministero ${portfolio} al gruppo ${group.officialName} nello scenario.`, { governmentId: government.id, appointmentId: appointment.id, source: DATA_SOURCES.SIMULATION });
}

export function voteGovernmentConfidence(parliament, currentDate) {
  const government = parliament.government;
  if (!government || !['awaiting-confidence', 'crisis'].includes(government.status)) throw new Error('Non è prevista una votazione di fiducia in questa fase.');
  const groups = new Set([...government.coalitionGroupIds, ...government.supportingGroupIds]);
  const votes = ['camera', 'senato'].map(chamber => {
    const yes = parliament.chambers[chamber].groups.filter(group => groups.has(group.groupId)).reduce((sum, group) => sum + group.simulatedSeats, 0);
    const total = totalSeats(parliament, chamber);
    const needed = Math.floor(total / 2) + 1;
    const risk = Math.floor(yes * government.crisisSeverity / 100);
    return { chamber, yes: Math.max(0, yes - risk), nominalSupport: yes, total, needed, passed: yes - risk >= needed, source: DATA_SOURCES.SIMULATION };
  });
  const passed = votes.every(vote => vote.passed);
  const status = passed ? 'active' : 'fallen';
  const ministers = passed ? government.ministers : government.ministers.map(item => item.endedAt ? item : { ...item, endedAt: currentDate, endReason: 'Fiducia negata' });
  const inCoalition = groups.has(parliament.player?.groupId);
  const margin = Math.min(...votes.map(vote => vote.yes - vote.needed));
  const stability = passed ? clamp(Math.round(government.status === 'crisis' ? 40 + margin / 3 : 45 + margin / 2), 25, 80) : 0;
  let next = { ...parliament, government: { ...government, status, stability, ministers, crisisSeverity: passed ? 0 : government.crisisSeverity, lastCrisisSeverity: government.crisisSeverity, confidenceVotes: [...government.confidenceVotes, { date: currentDate, votes, result: status, source: DATA_SOURCES.SIMULATION }], formedAt: passed ? (government.formedAt ?? currentDate) : government.formedAt ?? null, fallenAt: passed ? null : currentDate } };
  if (inCoalition) next = adjustStanding(next, passed ? 1 : -2);
  return record(next, currentDate, passed ? 'fiducia-ottenuta' : 'fiducia-negata', passed ? 'La maggioranza simulata ha ottenuto la fiducia in entrambe le Camere.' : 'La maggioranza simulata non ha ottenuto la fiducia in entrambe le Camere.', { governmentId: government.id, votes, source: DATA_SOURCES.SIMULATION });
}

export function triggerGovernmentCrisis(parliament, currentDate) {
  if (!canManageParliament(parliament)) throw new Error('Serve un mandato parlamentare attivo per aprire una crisi.');
  const government = parliament.government;
  if (!government || government.status !== 'active') throw new Error('Serve un governo in carica per aprire una crisi.');
  const severity = Math.min(24, 8 + Math.floor(activeMinisters(government).length / 2) + Math.max(0, 3 - government.supportingGroupIds.length) * 2);
  const next = { ...parliament, government: { ...government, status: 'crisis', crisisSeverity: severity, crisisOpenedAt: currentDate, stability: Math.min(government.stability ?? 50, 20) } };
  return record(next, currentDate, 'crisi-governo', 'Si apre una crisi politica nello scenario; il governo deve verificare la propria fiducia.', { governmentId: government.id, severity, source: DATA_SOURCES.SIMULATION });
}

// Weekly life of the executive: comfortable majorities steady it, thin ones erode it.
export function advanceGovernmentWeek(parliament, currentDate, roll = 0.5) {
  const government = parliament?.government;
  if (!government || government.status !== 'active') return parliament;
  const majorityIds = new Set([...government.coalitionGroupIds, ...government.supportingGroupIds]);
  const margin = Math.min(...['camera', 'senato'].map(chamber => parliament.chambers[chamber].groups.filter(group => majorityIds.has(group.groupId)).reduce((sum, group) => sum + group.simulatedSeats, 0) - majority(parliament, chamber)));
  const drift = (margin >= 15 ? 1 : margin >= 5 ? 0 : -2) + Math.round((roll - 0.5) * 4);
  const stability = clamp((government.stability ?? 50) + drift, 0, 100);
  if (stability > 20) return { ...parliament, government: { ...government, stability } };
  const severity = Math.min(24, 10 + Math.max(0, 3 - government.supportingGroupIds.length) * 2);
  const next = { ...parliament, government: { ...government, stability, status: 'crisis', crisisSeverity: severity, crisisOpenedAt: currentDate } };
  return record(next, currentDate, 'crisi-spontanea', 'La maggioranza si sfalda: il governo deve tornare a chiedere la fiducia.', { governmentId: government.id, severity, source: DATA_SOURCES.SIMULATION });
}

// A fragile majority loses a piece: an external supporter first, otherwise the smallest partner.
export function majorityShift(parliament, currentDate) {
  const government = parliament?.government;
  if (!government || government.status !== 'active') return parliament;
  const supporter = government.supportingGroupIds.at(-1);
  if (supporter) {
    const next = { ...parliament, government: { ...government, supportingGroupIds: government.supportingGroupIds.slice(0, -1), stability: Math.max(0, (government.stability ?? 50) - 6) } };
    return record(next, currentDate, 'cambio-maggioranza', `${getGroup(parliament, supporter)?.officialName ?? 'Un gruppo'} ritira il sostegno esterno al governo.`, { governmentId: government.id, groupId: supporter, source: DATA_SOURCES.SIMULATION });
  }
  const partners = government.coalitionGroupIds.filter(id => id !== parliament.player?.groupId);
  if (government.coalitionGroupIds.length < 2 || !partners.length) return parliament;
  const leaving = [...partners].sort((a, b) => (getGroup(parliament, a)?.simulatedSeats ?? 0) - (getGroup(parliament, b)?.simulatedSeats ?? 0))[0];
  const coalitionGroupIds = government.coalitionGroupIds.filter(id => id !== leaving);
  const ministers = government.ministers.map(item => item.groupId === leaving && !item.endedAt ? { ...item, endedAt: currentDate, endReason: 'Gruppo uscito dalla maggioranza' } : item);
  const next = { ...parliament, government: { ...government, coalitionGroupIds, ministers, status: 'crisis', crisisSeverity: 12, crisisOpenedAt: currentDate, stability: Math.min(government.stability ?? 50, 20) } };
  return record(next, currentDate, 'cambio-maggioranza', `${getGroup(parliament, leaving)?.officialName ?? 'Un gruppo'} esce dalla maggioranza: il governo deve verificare la fiducia.`, { governmentId: government.id, groupId: leaving, source: DATA_SOURCES.SIMULATION });
}

export function nextParliamentaryRole(parliament) {
  return PARLIAMENTARY_ROLES[parliament?.careerStanding?.roleLevel ?? 0] ?? null;
}

export function contestCommitteeRole(parliament, currentDate, stats = {}) {
  if (!canManageParliament(parliament)) throw new Error('Scegli un gruppo parlamentare prima di candidarti a un incarico interno.');
  const standing = parliament.careerStanding ?? createCareerStanding();
  const role = PARLIAMENTARY_ROLES[standing.roleLevel ?? 0];
  if (!role) throw new Error('Hai già raggiunto l’incarico più alto disponibile in questa fase del gioco.');
  if (standing.lastContestAt) {
    const elapsed = (Date.parse(currentDate + 'T12:00:00') - Date.parse(standing.lastContestAt + 'T12:00:00')) / 86400000;
    if (elapsed < CONTEST_WINDOW_DAYS) throw new Error(`La competizione interna ha una finestra di ${CONTEST_WINDOW_DAYS} giorni: consolida prima il tuo sostegno.`);
  }
  if ((parliament.resources?.politicalCapital ?? 0) < CONTEST_COST) throw new Error(`Servono ${CONTEST_COST} punti di capitale politico per affrontare la competizione interna.`);
  const influence = numberOr(stats.influence, 50), reputation = numberOr(stats.reputation, 50), experience = numberOr(stats.experience, 40);
  const threshold = standing.competitionStrength ?? role.threshold;
  const score = Math.round((influence * 0.35) + (reputation * 0.3) + (experience * 0.2) + (standing.partySupport * 0.15));
  const success = score >= threshold;
  const appointment = success ? { id: newId('incarico-parlamentare'), title: role.title, level: role.level, chamber: parliament.player.chamber, groupId: parliament.player.groupId, appointedAt: currentDate, endedAt: null, source: DATA_SOURCES.SIMULATION } : null;
  const roles = success ? [...standing.roles.map(item => item.endedAt ? item : { ...item, endedAt: currentDate }), appointment] : standing.roles;
  const updatedStanding = {
    ...standing,
    roles,
    roleLevel: success ? role.level : standing.roleLevel ?? 0,
    position: success ? `${role.title} (simulato)` : standing.position,
    committeeRole: success ? appointment : standing.committeeRole,
    partySupport: clamp(standing.partySupport + (success ? 2 : -2), 0, 100),
    competitionStrength: success ? (PARLIAMENTARY_ROLES[role.level]?.threshold ?? threshold) : threshold,
    lastContestAt: currentDate,
    lastContest: { roleTitle: role.title, score, threshold, result: success ? 'success' : 'not-selected', date: currentDate, source: DATA_SOURCES.SIMULATION },
    source: DATA_SOURCES.SIMULATION
  };
  let next = { ...parliament, careerStanding: updatedStanding, player: { ...parliament.player, position: updatedStanding.position }, resources: { ...parliament.resources, politicalCapital: parliament.resources.politicalCapital - CONTEST_COST } };
  next = record(next, currentDate, success ? 'incarico-conquistato' : 'competizione-interna', success ? `Conquistato l’incarico di ${role.title.toLowerCase()} nello scenario.` : `La competizione interna per l’incarico di ${role.title.toLowerCase()} non è stata vinta; il prossimo tentativo richiederà nuova preparazione.`, { score, threshold, role: role.title, result: success ? 'success' : 'not-selected', source: DATA_SOURCES.SIMULATION });
  return { parliament: next, success, score, threshold, role, appointment };
}

export function parliamentGroupFacts(parliament, chamber) {
  const groups = parliament?.chambers?.[chamber]?.groups ?? [];
  const total = totalSeats(parliament, chamber);
  return { total, majority: Math.floor(total / 2) + 1, groups };
}

export const parliamentInternals = Object.freeze({ getGroup, totalSeats, majority, allGroups });
