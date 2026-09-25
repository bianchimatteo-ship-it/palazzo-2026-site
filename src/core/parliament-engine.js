import { DATA_SOURCES } from '../data/schema.js?v=20260925-3';
import { AREA_BY_ID, DECREE_RULES, FINANCING, GOVERNMENT_LINES, MINISTRIES, POLICY_AREAS, STAGE_WEEKS, areaOf } from '../data/simulation/policy-rules.js?v=20260925-3';

export const CHAMBERS = Object.freeze({
  camera: { label: 'Camera dei deputati', shortLabel: 'Camera', source: DATA_SOURCES.REAL },
  senato: { label: 'Senato della Repubblica', shortLabel: 'Senato', source: DATA_SOURCES.REAL }
});

// Every policy area of the simulation can be the subject of a bill.
export const LAW_CATEGORIES = Object.freeze(POLICY_AREAS.map(item => item.label));
export const MINISTERIAL_PORTFOLIOS = MINISTRIES;

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
const hashOf = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
export const weeksBetween = (from, to) => from && to ? Math.floor((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 604800000) : 99;
const addDaysTo = (date, days) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10); };
// Scenario priorities of a parliamentary group: drawn from its id, declared as simulation, never an attribution of real positions.
export function groupProfile(groupId) {
  let state = hashOf(`profilo|${groupId}`);
  const rand = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const pool = POLICY_AREAS.map(item => item.id);
  const pick = () => pool.splice(Math.floor(rand() * pool.length), 1)[0];
  const likes = [pick(), pick(), pick()];
  const dislikes = [pick(), pick()];
  const financing = ['deficit', 'irpef', 'imprese', 'consumi', 'rendite', 'tagli'][Math.floor(rand() * 6)];
  return { likes, dislikes, dislikesFinancing: financing, source: DATA_SOURCES.SIMULATION };
}
// How much a group likes the content of a bill (areas and financing), from −1 to +1.
function contentAffinity(groupId, law) {
  const policy = law.policy;
  if (!policy?.area) return 0;
  const profile = groupProfile(groupId);
  let score = 0;
  if (profile.likes.includes(policy.area)) score += 0.6;
  if (profile.dislikes.includes(policy.area)) score -= 0.6;
  if (policy.financing === profile.dislikesFinancing) score -= 0.4;
  return clamp(score, -1, 1);
}
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

export function createParliamentState({ career, player, groups = [], currentDate, politicalCapital = 50, referenceGovernment = null }) {
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
  let next = parliament;
  if (chamber) {
    const referenceGroup = getGroup(parliament, validGroup);
    next = record(parliament, currentDate, 'ingresso', `${CHAMBERS[chamber].shortLabel}: avvio dello scenario parlamentare con ${referenceGroup?.officialName ?? 'gruppo da definire'}.`, { chamber, groupId: validGroup, source: DATA_SOURCES.SIMULATION });
  }
  // The country already has a Government when the career starts: the player finds it in office.
  return referenceGovernment ? createReferenceGovernment(next, referenceGovernment, currentDate) : next;
}

// ---------- the Government in office at the start of a career ----------
// Built from the real situation at the start (spec from government-reference.js: the groups of the members of the real
// Government, the group of the real Prime Minister, who holds each ministry) and then fully simulated. The player is
// not a member: the Prime Minister is a simulated role ('reference'), the ministers are simulated offices without names.
export const isReferenceGovernment = government => Boolean(government) && government.formedBy === 'reference';
export const playerLeadsGovernment = parliament => parliament?.government?.primeMinister === 'player';
// True when the career has never seen a Government: only then the Government in office at the start can be created.
export function neverHadGovernment(parliament) {
  return Boolean(parliament) && !parliament.government && !(parliament.pastGovernments ?? []).length
    && !(parliament.history ?? []).some(entry => ['governo-proposto', 'fiducia-ottenuta', 'fiducia-negata', 'governo-riferimento'].includes(entry.type));
}
export function createReferenceGovernment(parliament, spec, currentDate) {
  if (!parliament || !spec || parliament.government) return parliament;
  const coalitionGroupIds = [...new Set(spec.groupIds ?? [])].filter(id => getGroup(parliament, id));
  if (!['camera', 'senato'].every(chamber => coalitionGroupIds.some(id => getGroup(parliament, id).chamber === chamber))) return parliament;
  const governmentId = newId('governo-riferimento');
  const ministers = (spec.ministries ?? []).filter(item => MINISTERIAL_PORTFOLIOS.includes(item.portfolio)).map(item => {
    const group = item.groupId && coalitionGroupIds.includes(item.groupId) ? getGroup(parliament, item.groupId) : null;
    const seed = hashOf(`${spec.governmentId}|${item.portfolio}`);
    return { id: newId('nomina'), portfolio: item.portfolio, groupId: group?.groupId ?? null, groupName: group?.officialName ?? 'Tecnico indipendente', playerAppointed: false, appointeeLabel: 'Incarico simulato · ripartito all’avvio come nel governo reale', loyalty: 60 + seed % 20, competence: 45 + (seed >> 5) % 35, fromReference: true, source: DATA_SOURCES.SIMULATION, appointedAt: currentDate };
  });
  const seats = chamber => parliament.chambers[chamber].groups.filter(group => coalitionGroupIds.includes(group.groupId)).reduce((sum, group) => sum + group.simulatedSeats, 0);
  const margin = Math.min(...['camera', 'senato'].map(chamber => seats(chamber) - majority(parliament, chamber)));
  const partners = Object.fromEntries(coalitionGroupIds.filter(id => id !== parliament.player?.groupId).map(id => [id, { satisfaction: 62, demand: null, source: DATA_SOURCES.SIMULATION }]));
  const government = {
    id: governmentId, name: 'Governo in carica all’avvio', status: 'active', formedBy: 'reference', primeMinister: 'reference',
    premierGroupId: spec.premierGroupId && getGroup(parliament, spec.premierGroupId) ? spec.premierGroupId : coalitionGroupIds[0],
    coalitionGroupIds, supportingGroupIds: [], ministers, partners, confidenceVotes: [], crisisSeverity: 0, program: null, agenda: [],
    stability: clamp(Math.round(45 + margin / 2), 25, 80), formedAt: currentDate, inheritedAt: currentDate,
    reference: { governmentId: spec.governmentId, label: spec.label, startDate: spec.startDate, sourceUrl: spec.sourceUrl, sourceName: spec.sourceName, derivedFrom: spec.derivedFrom, source: DATA_SOURCES.REAL, verified: true },
    source: DATA_SOURCES.SIMULATION
  };
  const names = coalitionGroupIds.map(id => getGroup(parliament, id).officialName);
  return record({ ...parliament, government }, currentDate, 'governo-riferimento', `All’avvio della carriera è in carica un governo (simulazione) sostenuto da ${names.join(', ')}: maggioranza ricostruita dai gruppi dei componenti del governo reale «${spec.label}». Non ne fai parte.`, { governmentId, coalitionGroupIds, reference: spec.governmentId, source: DATA_SOURCES.SIMULATION });
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
    coalitionGroupIds: [], supportingGroupIds: [], ministers: [], confidenceVotes: [], crisisSeverity: 0, stability: 50, partners: {}, program: null, ...parliament.government
  } : null;
  const laws = (Array.isArray(parliament.laws) ? parliament.laws : []).map(law => ({
    negotiatedGroupIds: [], amendments: [], votes: [], compromiseLevel: 0, forcedVote: false, origin: 'parlamentare', kind: 'ddl', demands: {}, stageSince: law.updatedAt ?? law.introducedAt ?? null, ...law
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

export function proposeLaw(parliament, { title, category, summary, currentDate, policy = null, origin = 'parlamentare', kind = 'ddl' }) {
  if (!canManageParliament(parliament)) throw new Error('Per presentare una legge serve un percorso parlamentare e un gruppo di riferimento.');
  const cleanTitle = String(title ?? '').trim();
  const cleanSummary = String(summary ?? '').trim();
  const area = areaOf(policy?.area) ?? areaOf(category);
  if (cleanTitle.length < 5) throw new Error('Il titolo deve contenere almeno 5 caratteri.');
  if (kind !== 'manovra' && !area) throw new Error('Scegli un tema valido.');
  if (cleanSummary.length < 12) throw new Error('Descrivi la proposta con almeno 12 caratteri.');
  const law = {
    id: newId(kind === 'decreto' ? 'decreto' : kind === 'manovra' ? 'manovra' : 'legge'), title: cleanTitle, category: kind === 'manovra' ? 'Finanze pubbliche' : area.label, summary: cleanSummary,
    status: 'proposal', stage: 'proposal', introducedAt: currentDate, updatedAt: currentDate, stageSince: currentDate,
    firstChamber: parliament.player.chamber, currentChamber: parliament.player.chamber,
    negotiatedGroupIds: [], amendments: [], compromiseLevel: 0, forcedVote: false, demands: {},
    origin, kind, policy: policy ? { ...policy, area: kind === 'manovra' ? null : area.id } : (area ? { area: area.id } : null),
    votes: [], source: DATA_SOURCES.SIMULATION
  };
  let next = { ...parliament, laws: [...parliament.laws, law] };
  const label = kind === 'manovra' ? 'la legge di bilancio' : origin === 'governo' ? `il disegno di legge del governo “${law.title}”` : `“${law.title}”`;
  next = record(next, currentDate, 'legge-proposta', `Presentata ${label} (${law.category.toLowerCase()}).`, { lawId: law.id, stage: law.stage, origin, kind });
  return { parliament: next, law };
}
// Urgent measure by the Government: in force at once, void if Parliament does not convert it within 60 days.
export function issueDecree(parliament, { title, summary, policy, currentDate }) {
  const government = parliament.government;
  if (!government || government.status !== 'active') throw new Error('Un decreto-legge lo adotta solo un governo nella pienezza dei poteri.');
  const open = parliament.laws.filter(law => law.kind === 'decreto' && !CLOSED_LAW_STAGES.includes(law.stage)).length;
  if (open >= DECREE_RULES.maxOpen) throw new Error(`Ci sono già ${open} decreti in attesa di conversione: il Parlamento non ne può esaminare altri.`);
  if (government.lastDecreeAt && weeksBetween(government.lastDecreeAt, currentDate) < DECREE_RULES.cooldownWeeks) throw new Error(`Troppi decreti ravvicinati: il prossimo è possibile dal ${addDaysTo(government.lastDecreeAt, DECREE_RULES.cooldownWeeks * 7)}.`);
  const result = proposeLaw(parliament, { title, category: areaOf(policy?.area)?.label, summary, currentDate, policy, origin: 'governo', kind: 'decreto' });
  const deadline = addDaysTo(currentDate, DECREE_RULES.conversionWeeks * 7);
  let next = replaceLaw(result.parliament, result.law.id, law => ({ ...law, stage: 'commission', status: 'commission', inForce: true, deadline }));
  next = { ...next, government: { ...next.government, lastDecreeAt: currentDate, decrees: (next.government.decrees ?? 0) + 1 } };
  next = record(next, currentDate, 'decreto-adottato', `Il Consiglio dei ministri adotta il decreto-legge “${title}”: va convertito entro il ${deadline}.`, { lawId: result.law.id, deadline, source: DATA_SOURCES.SIMULATION });
  return { parliament: next, law: next.laws.find(law => law.id === result.law.id) };
}

// The content of a bill changes: an amendment on money, cover, territory, beneficiaries or scale.
export function amendLawPolicy(parliament, lawId, patch = {}, currentDate, { author = 'player', label = null } = {}) {
  const law = parliament.laws.find(item => item.id === lawId);
  if (!law || !['commission', 'amendments'].includes(law.stage)) throw new Error('Il contenuto si modifica in commissione o nella fase degli emendamenti.');
  if (law.confidence) throw new Error('Sulla proposta è stata posta la fiducia: il testo non si può più emendare.');
  if (law.kind === 'manovra' && !patch.plan) throw new Error('La legge di bilancio si modifica sulle voci di spesa.');
  const allowed = ['intensity', 'financing', 'cutArea', 'target', 'segment', 'instrument', 'plan'];
  const clean = Object.fromEntries(Object.entries(patch).filter(([key, value]) => allowed.includes(key) && value !== undefined && value !== null && value !== ''));
  if (!Object.keys(clean).length) throw new Error('Nessuna modifica da applicare.');
  const text = label ?? Object.entries(clean).map(([key, value]) => ({ intensity: `portata ${['', 'contenuta', 'media', 'ampia'][value] ?? value}`, financing: `copertura: ${FINANCING[value]?.label ?? value}`, cutArea: `tagli a ${AREA_BY_ID[value]?.label ?? value}`, target: `territorio: ${value}`, segment: `destinatari: ${value}`, instrument: `strumento: ${value}`, plan: 'voci di spesa riviste' }[key])).join(' · ');
  let next = replaceLaw(parliament, lawId, current => ({ ...current, policy: { ...(current.policy ?? {}), ...clean }, amendments: [...current.amendments, { id: newId('emendamento'), text, patch: clean, author, date: currentDate, source: DATA_SOURCES.SIMULATION }], updatedAt: currentDate }));
  // Groups read the new text: those who now like it more get closer, the others cool down.
  const updated = next.laws.find(item => item.id === lawId);
  for (const group of allGroups(next)) {
    const delta = contentAffinity(group.groupId, updated) - contentAffinity(group.groupId, law);
    if (Math.abs(delta) >= 0.2) next = setRelation(next, group.groupId, Math.round(delta * 5));
  }
  return record(next, currentDate, 'emendamento-contenuto', `Modificato il contenuto di “${law.title}”: ${text}.`, { lawId, patch: clean, source: DATA_SOURCES.SIMULATION });
}
// What a group asks in exchange for its votes, derived from its scenario priorities.
function demandFor(parliament, law, groupId) {
  const profile = groupProfile(groupId);
  const policy = law.policy ?? {};
  if (law.kind === 'manovra') {
    const group = POLICY_AREAS.find(item => item.id === profile.likes[0])?.group;
    return { patch: { plan: { ...(policy.plan ?? {}), allocations: { ...(policy.plan?.allocations ?? {}), [group]: 1 } } }, label: `più risorse per ${POLICY_AREAS.find(item => item.id === profile.likes[0])?.label.toLowerCase()}` };
  }
  if (policy.financing && policy.financing === profile.dislikesFinancing) {
    const alternative = ['evasione', 'tagli', 'deficit', 'rendite'].find(item => item !== profile.dislikesFinancing);
    return { patch: { financing: alternative }, label: `cambiare la copertura (${FINANCING[alternative].label.toLowerCase()} invece di ${FINANCING[policy.financing].label.toLowerCase()})` };
  }
  if (profile.dislikes.includes(policy.area) && (policy.intensity ?? 2) > 1) return { patch: { intensity: (policy.intensity ?? 2) - 1 }, label: 'ridurre la portata della misura' };
  if (policy.target && policy.target !== 'nazionale') return { patch: { target: 'nazionale' }, label: 'estendere la misura a tutto il Paese' };
  const segment = ['giovani', 'famiglie', 'anziani', 'imprese', 'fragili'][hashOf(groupId) % 5];
  if (policy.segment !== segment) return { patch: { segment }, label: `favorire ${{ giovani: 'i giovani', famiglie: 'le famiglie', anziani: 'i pensionati', imprese: 'le imprese', fragili: 'i redditi bassi' }[segment]}` };
  return { patch: { intensity: Math.max(1, (policy.intensity ?? 2) - 1) }, label: 'un testo più prudente' };
}
export function acceptLawDemand(parliament, lawId, groupId, currentDate) {
  const law = parliament.laws.find(item => item.id === lawId);
  const demand = law?.demands?.[groupId];
  if (!demand || demand.accepted) throw new Error('Non c’è una richiesta aperta da questo gruppo.');
  let next = amendLawPolicy(parliament, lawId, demand.patch, currentDate, { author: groupId, label: `Accolta la richiesta di ${getGroup(parliament, groupId)?.officialName ?? 'un gruppo'}: ${demand.label}` });
  next = replaceLaw(next, lawId, current => ({ ...current, demands: { ...current.demands, [groupId]: { ...demand, accepted: true } } }));
  return setRelation(next, groupId, 4);
}
export function withdrawLaw(parliament, lawId, currentDate) {
  const law = parliament.laws.find(item => item.id === lawId);
  if (!law || CLOSED_LAW_STAGES.includes(law.stage)) throw new Error('La proposta non è ritirabile.');
  const next = replaceLaw(parliament, lawId, current => ({ ...current, stage: 'lapsed', status: 'withdrawn', updatedAt: currentDate }));
  return record(next, currentDate, 'legge-ritirata', `Ritirata la proposta “${law.title}”.`, { lawId, source: DATA_SOURCES.SIMULATION });
}
// The Government stakes its life on a text: its majority closes ranks, and if the vote fails the Government falls.
export function askConfidenceOnLaw(parliament, lawId, currentDate) {
  const law = parliament.laws.find(item => item.id === lawId);
  const government = parliament.government;
  if (!government || government.status !== 'active') throw new Error('La questione di fiducia la pone un governo in carica.');
  if (!law || law.origin !== 'governo' || !['amendments', 'final-vote'].includes(law.stage)) throw new Error('La fiducia si pone su un testo del governo arrivato al voto.');
  if (law.confidence) throw new Error('La fiducia è già stata posta su questo testo.');
  let next = replaceLaw(parliament, lawId, current => ({ ...current, confidence: true, updatedAt: currentDate }));
  for (const group of allGroups(next).filter(item => !governingGroupIds(next).has(item.groupId))) next = setRelation(next, group.groupId, -3);
  return record(next, currentDate, 'fiducia-posta', `Il governo pone la questione di fiducia su “${law.title}”: se la perde, cade.`, { lawId, source: DATA_SOURCES.SIMULATION });
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
  // Votes have a price: the group states what it wants changed in the text.
  const demand = { ...demandFor(parliament, law, groupId), accepted: false, date: currentDate, source: DATA_SOURCES.SIMULATION };
  next = replaceLaw(next, lawId, current => ({ ...current, negotiatedGroupIds: [...current.negotiatedGroupIds, groupId], demands: { ...(current.demands ?? {}), [groupId]: demand }, updatedAt: currentDate }));
  next = setRelation(next, groupId, 3);
  return record(next, currentDate, 'negoziato', `Avviato un negoziato con ${target.officialName}: chiede di ${demand.label}.`, { lawId, groupId, demand: demand.label, source: DATA_SOURCES.SIMULATION });
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

// The starting difficulty makes majorities more or less disciplined and allies more or less patient.
const DIFFICULTY_TUNING = Object.freeze({ facile: { discipline: 0.05, drift: 0.7 }, normale: { discipline: 0, drift: 1 }, difficile: { discipline: -0.06, drift: 1.45 } });
const tuningOf = parliament => DIFFICULTY_TUNING[parliament?.difficulty] ?? DIFFICULTY_TUNING.normale;
function calculateVote(parliament, law, chamber) {
  const governing = governingGroupIds(parliament);
  const tuning = tuningOf(parliament);
  const inMajority = playerInMajority(parliament);
  const negotiated = new Set(law.negotiatedGroupIds);
  const government = parliament.government;
  const discipline = parliament.careerStanding?.partySupport ?? 50;
  const rows = parliament.chambers[chamber].groups;
  let yes = 0;
  const results = rows.map(group => {
    const relation = parliament.relations?.[group.groupId]?.value ?? 50;
    const own = group.groupId === parliament.player?.groupId;
    const demand = law.demands?.[group.groupId];
    const partner = government?.partners?.[group.groupId];
    let support = own ? 0.5 + discipline / 500
      : negotiated.has(group.groupId) ? (demand && !demand.accepted ? 0.52 : 0.74)
      : governing.has(group.groupId) ? (inMajority ? 0.62 : 0.4)
      : governing.size && inMajority ? 0.38 : 0.43;
    support += law.compromiseLevel * 0.035;
    support += (relation - 50) / 1000;
    // The content matters: areas and cover a group cares about move its votes.
    if (!own) support += contentAffinity(group.groupId, law) * 0.09;
    // Allies vote according to how satisfied they are with the Government; government bills are followed more.
    if (partner && !own) support += (partner.satisfaction - 50) / 400 + (law.origin === 'governo' ? 0.05 : 0);
    if (governing.has(group.groupId) && (government?.stability ?? 50) < 40) support -= (40 - government.stability) / 400;
    if (law.forcedVote) support += own || (inMajority && governing.has(group.groupId)) ? 0.1 : -0.07;
    // A question of confidence binds the majority: dissenting means bringing the Government down.
    if (law.confidence && governing.has(group.groupId)) support += 0.18;
    // Snipers: in a secret ballot part of the majority can betray.
    if (law.snipers && governing.has(group.groupId) && !own && !law.confidence) support -= 0.07;
    if (governing.has(group.groupId) || own) support += tuning.discipline;
    const votes = Math.round(group.simulatedSeats * clamp(support, 0.12, 0.93));
    yes += votes;
    return { groupId: group.groupId, yesVotes: votes, simulatedSeats: group.simulatedSeats, source: DATA_SOURCES.SIMULATION };
  });
  const total = rows.reduce((sum, group) => sum + group.simulatedSeats, 0);
  const needed = Math.floor(total / 2) + 1;
  return { chamber, yes, no: total - yes, total, needed, passed: yes >= needed, forced: Boolean(law.forcedVote), confidence: Boolean(law.confidence), byGroup: results, source: DATA_SOURCES.SIMULATION };
}
// Each phase takes time: commissions hear, groups negotiate, the other Chamber reads the text again.
export function stageWait(law, currentDate) {
  const needed = (law.kind === 'decreto' || law.kind === 'manovra' ? Math.min(1, STAGE_WEEKS[law.stage] ?? 0) : STAGE_WEEKS[law.stage] ?? 0) + (law.stage === 'commission' ? law.obstruction ?? 0 : 0);
  return Math.max(0, needed - weeksBetween(law.stageSince ?? law.updatedAt ?? law.introducedAt, currentDate));
}

export function advanceLaw(parliament, lawId, action, currentDate) {
  const law = parliament.laws.find(item => item.id === lawId);
  if (!law) throw new Error('La proposta non è disponibile.');
  if (CLOSED_LAW_STAGES.includes(law.stage)) throw new Error('L’iter legislativo è già concluso.');
  if (!canManageParliament(parliament)) throw new Error('Serve un mandato parlamentare attivo per far avanzare la proposta.');
  const wait = stageWait(law, currentDate);
  const phaseName = { proposal: 'la presentazione', commission: 'l’esame in commissione', amendments: 'la fase degli emendamenti', 'other-chamber': 'la trasmissione', 'final-vote': 'l’esame dell’altra Camera' }[law.stage];
  if (wait > 0) throw new Error(`Servono ancora ${wait} ${wait === 1 ? 'settimana' : 'settimane'} per ${phaseName}${law.obstruction && law.stage === 'commission' ? ' (l’opposizione fa ostruzionismo)' : ''}.`);
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
    if (!vote.passed && law.confidence) next = governmentDefeated(next, law, currentDate);
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
    if (!vote.passed && law.confidence) next = governmentDefeated(next, law, currentDate);
    text = vote.passed ? `Approvazione simulata definitiva: “${law.title}”.` : `La ${CHAMBERS[law.currentChamber].label} ha respinto “${law.title}” nella votazione finale simulata.`;
  } else {
    throw new Error('Questa azione non è disponibile nella fase corrente.');
  }
  next = replaceLaw(next, lawId, current => current.stage !== law.stage ? { ...current, stageSince: currentDate } : current);
  const current = next.laws.find(item => item.id === lawId);
  next = record(next, currentDate, `iter-${current.stage}`, text, { lawId, stage: current.stage, kind: current.kind, origin: current.origin, source: DATA_SOURCES.SIMULATION });
  return { parliament: next, law: current, vote: current.votes.at(-1) ?? null };
}
function governmentDefeated(parliament, law, currentDate) {
  const government = parliament.government;
  if (!government || !['active', 'crisis'].includes(government.status)) return parliament;
  const ministers = government.ministers.map(item => item.endedAt ? item : { ...item, endedAt: currentDate, endReason: 'Fiducia negata' });
  const next = { ...parliament, government: { ...government, status: 'fallen', stability: 0, ministers, fallenAt: currentDate } };
  return record(next, currentDate, 'fiducia-negata', `Il governo perde la fiducia su “${law.title}” e cade.`, { governmentId: government.id, lawId: law.id, source: DATA_SOURCES.SIMULATION });
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

// A Government the player does not lead: the player's group can offer its support (the majority decides whether to
// accept it) or withdraw it; the player can ask the Prime Minister for a ministry when the requirements are met.
export function offerGroupSupport(parliament, currentDate, { influence = 50, roll = 0.5 } = {}) {
  if (!canManageParliament(parliament)) throw new Error('Serve un seggio con un gruppo di riferimento.');
  const government = parliament.government;
  if (!government || government.status !== 'active') throw new Error('Serve un governo in carica.');
  if (playerLeadsGovernment(parliament)) throw new Error('Guidi già il governo: gestisci la maggioranza dalla sezione Governo.');
  const groupId = parliament.player.groupId;
  if ([...government.coalitionGroupIds, ...government.supportingGroupIds].includes(groupId)) throw new Error('Il tuo gruppo sostiene già il governo.');
  if ((parliament.resources?.politicalCapital ?? 0) < 5) throw new Error('Servono 5 punti di capitale politico per trattare il sostegno.');
  // The groups of the majority decide together: their relations with the player's group weigh on the answer.
  const relations = government.coalitionGroupIds.map(id => parliament.relations?.[id]?.value ?? 50);
  const mood = relations.reduce((sum, value) => sum + value, 0) / (relations.length || 1);
  const chance = clamp(0.4 + (mood - 50) / 100 + (influence - 50) / 200 - (government.stability > 70 ? 0.1 : 0), 0.1, 0.9);
  let next = { ...parliament, resources: { ...parliament.resources, politicalCapital: parliament.resources.politicalCapital - 5 } };
  const group = getGroup(parliament, groupId);
  if (roll >= chance) {
    for (const id of government.coalitionGroupIds) next = setRelation(next, id, -2);
    return { parliament: record(next, currentDate, 'sostegno-respinto', `La maggioranza non accetta il sostegno di ${group.officialName}: nessun accordo sul programma.`, { governmentId: government.id, groupId, chance, source: DATA_SOURCES.SIMULATION }), accepted: false, chance };
  }
  next = { ...next, government: { ...next.government, supportingGroupIds: [...government.supportingGroupIds, groupId], stability: clamp((government.stability ?? 50) + 3, 0, 100) } };
  for (const id of government.coalitionGroupIds) next = setRelation(next, id, 3);
  next = adjustStanding(next, 2);
  return { parliament: record(next, currentDate, 'sostegno-governo', `${group.officialName} entra nella maggioranza con un sostegno esterno al governo (simulazione).`, { governmentId: government.id, groupId, chance, source: DATA_SOURCES.SIMULATION }), accepted: true, chance };
}
export function withdrawGroupSupport(parliament, currentDate) {
  if (!canManageParliament(parliament)) throw new Error('Serve un seggio con un gruppo di riferimento.');
  const government = parliament.government;
  if (!government || !['active', 'crisis'].includes(government.status)) throw new Error('Serve un governo in carica.');
  if (playerLeadsGovernment(parliament)) throw new Error('Guidi il governo: per lasciarlo apri una crisi o dimettiti.');
  const groupId = parliament.player.groupId;
  if (![...government.coalitionGroupIds, ...government.supportingGroupIds].includes(groupId)) throw new Error('Il tuo gruppo non fa parte della maggioranza.');
  if (groupId === government.premierGroupId) throw new Error('Il gruppo del Presidente del Consiglio non lascia il proprio governo: per metterlo in discussione apri una crisi.');
  let next = leaveMajority(parliament, groupId, currentDate, 'ritira il sostegno al governo');
  for (const id of government.coalitionGroupIds.filter(item => item !== groupId)) next = setRelation(next, id, -8);
  return adjustStanding(next, -2);
}
// A ministry is a step up: a newly elected member of Parliament does not have these numbers yet.
export const GOVERNMENT_POST_REQUIREMENTS = Object.freeze({ influence: 62, reputation: 58, experience: 62, groupSupport: 62, mandateWeeks: 12, cooldownWeeks: 8 });
// What still stands between the player and a ministry in a Government led by someone else.
export function governmentPostProblems(parliament, stats = {}, currentDate = null) {
  const government = parliament?.government;
  const needs = GOVERNMENT_POST_REQUIREMENTS;
  const problems = [];
  if (!canManageParliament(parliament)) problems.push('Serve un seggio con un gruppo di riferimento.');
  if (!government || government.status !== 'active') problems.push('Serve un governo in carica.');
  else {
    if (![...government.coalitionGroupIds, ...government.supportingGroupIds].includes(parliament.player?.groupId)) problems.push('Il tuo gruppo deve far parte della maggioranza.');
    if (activeMinisters(government).some(item => item.playerAppointed)) problems.push('Hai già un incarico di governo.');
    if (government.lastPostRequestAt && currentDate && weeksBetween(government.lastPostRequestAt, currentDate) < needs.cooldownWeeks) problems.push(`Hai chiesto un incarico da poco: riprova dal ${addDaysTo(government.lastPostRequestAt, needs.cooldownWeeks * 7)}.`);
  }
  if (parliament?.player?.mandateStartedAt && currentDate && weeksBetween(parliament.player.mandateStartedAt, currentDate) < needs.mandateWeeks) problems.push(`Almeno ${needs.mandateWeeks} settimane di mandato (dal ${addDaysTo(parliament.player.mandateStartedAt, needs.mandateWeeks * 7)}).`);
  if ((stats.influence ?? 0) < needs.influence) problems.push(`Influenza almeno ${needs.influence} (ora ${Math.round(stats.influence ?? 0)}).`);
  if ((stats.reputation ?? 0) < needs.reputation) problems.push(`Reputazione almeno ${needs.reputation} (ora ${Math.round(stats.reputation ?? 0)}).`);
  if ((stats.experience ?? 0) < needs.experience) problems.push(`Esperienza almeno ${needs.experience} (ora ${Math.round(stats.experience ?? 0)}).`);
  if ((parliament?.careerStanding?.partySupport ?? 0) < needs.groupSupport) problems.push(`Sostegno nel gruppo almeno ${needs.groupSupport} (ora ${Math.round(parliament?.careerStanding?.partySupport ?? 0)}).`);
  return problems;
}
export function requestGovernmentPost(parliament, portfolio, currentDate, { stats = {}, roll = 0.5, appointeeLabel = null } = {}) {
  if (playerLeadsGovernment(parliament)) throw new Error('Guidi il governo: assegna tu stesso gli incarichi.');
  if (!MINISTERIAL_PORTFOLIOS.includes(portfolio)) throw new Error('Scegli un ministero.');
  const problems = governmentPostProblems(parliament, stats, currentDate);
  if (problems.length) throw new Error(`Non hai ancora i requisiti: ${problems.join(' ')}`);
  const government = parliament.government;
  const holder = activeMinisters(government).find(item => item.portfolio === portfolio);
  const chance = clamp(0.3 + ((stats.influence ?? 45) - 45) / 100 + ((stats.reputation ?? 50) - 50) / 150 + ((parliament.careerStanding?.partySupport ?? 55) - 55) / 150 + ((government.stability ?? 50) - 50) / 300 - (holder ? 0.15 : 0), 0.05, 0.85);
  let next = { ...parliament, government: { ...government, lastPostRequestAt: currentDate } };
  if (roll >= chance) return { parliament: record(next, currentDate, 'richiesta-incarico-respinta', `Il Presidente del Consiglio (simulato) non ti affida il ministero ${portfolio}.`, { governmentId: government.id, portfolio, chance, source: DATA_SOURCES.SIMULATION }), appointed: false, chance };
  if (holder) {
    // A small reshuffle: the outgoing minister's group resents it.
    next = { ...next, government: { ...next.government, ministers: next.government.ministers.map(item => item.id === holder.id ? { ...item, endedAt: currentDate, endReason: 'Rimpasto del Presidente del Consiglio (simulato)' } : item), stability: clamp((government.stability ?? 50) - 2, 0, 100) } };
    if (holder.groupId) { next = changePartner(next, holder.groupId, -8); next = setRelation(next, holder.groupId, -4); }
  }
  const group = getGroup(next, next.player.groupId);
  const appointment = { id: newId('nomina'), portfolio, groupId: group.groupId, groupName: group.officialName, playerAppointed: true, appointeeLabel: appointeeLabel || 'Il tuo politico', loyalty: 100, competence: null, source: DATA_SOURCES.SIMULATION, appointedAt: currentDate };
  next = { ...next, government: { ...next.government, ministers: [...next.government.ministers, appointment] } };
  next = adjustStanding(next, 2);
  return { parliament: record(next, currentDate, 'nomina-ministro-giocatore', `Il Presidente del Consiglio (simulato) ti affida il ministero ${portfolio}${holder ? ' con un rimpasto' : ''}.`, { governmentId: government.id, appointmentId: appointment.id, portfolio, chance, source: DATA_SOURCES.SIMULATION }), appointed: true, chance, appointment };
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
  const seed = hashOf(`${government.id}|${portfolio}|${groupId}`);
  const appointment = { id: newId('nomina'), portfolio, groupId, groupName: group.officialName, playerAppointed: toPlayer, appointeeLabel: toPlayer ? (appointeeLabel || 'Il tuo politico') : 'Incarico di governo simulato', loyalty: toPlayer ? 100 : 55 + seed % 25, competence: toPlayer ? null : 40 + (seed >> 5) % 45, source: DATA_SOURCES.SIMULATION, appointedAt: currentDate };
  let next = { ...parliament, government: { ...government, ministers: [...government.ministers, appointment] } };
  next = changePartner(next, groupId, 6);
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
  const partners = Object.fromEntries([...groups].filter(id => id !== parliament.player?.groupId).map(id => [id, government.partners?.[id] ?? { satisfaction: government.coalitionGroupIds.includes(id) ? 62 : 55, demand: null, source: DATA_SOURCES.SIMULATION }]));
  let next = { ...parliament, government: { ...government, status, stability, ministers, partners, crisisSeverity: passed ? 0 : government.crisisSeverity, lastCrisisSeverity: government.crisisSeverity, confidenceVotes: [...government.confidenceVotes, { date: currentDate, votes, result: status, source: DATA_SOURCES.SIMULATION }], formedAt: passed ? (government.formedAt ?? currentDate) : government.formedAt ?? null, fallenAt: passed ? null : currentDate } };
  if (inCoalition) next = adjustStanding(next, passed ? 1 : -2);
  return record(next, currentDate, passed ? 'fiducia-ottenuta' : 'fiducia-negata', passed ? 'La maggioranza simulata ha ottenuto la fiducia in entrambe le Camere.' : 'La maggioranza simulata non ha ottenuto la fiducia in entrambe le Camere.', { governmentId: government.id, votes, renewed: government.status === 'crisis', source: DATA_SOURCES.SIMULATION });
}

export function triggerGovernmentCrisis(parliament, currentDate) {
  if (!canManageParliament(parliament)) throw new Error('Serve un mandato parlamentare attivo per aprire una crisi.');
  const government = parliament.government;
  if (!government || government.status !== 'active') throw new Error('Serve un governo in carica per aprire una crisi.');
  // From inside the majority a crisis can bring the Government down; from the opposition it is a no-confidence motion,
  // which only bites when the majority is already weak.
  const fromOpposition = !playerLeadsGovernment(parliament) && !playerInMajority(parliament);
  const severity = fromOpposition
    ? clamp(Math.round((55 - (government.stability ?? 50)) / 3), 0, 12)
    : Math.min(24, 8 + Math.floor(activeMinisters(government).length / 2) + Math.max(0, 3 - government.supportingGroupIds.length) * 2);
  const next = { ...parliament, government: { ...government, status: 'crisis', crisisSeverity: severity, crisisOpenedAt: currentDate, stability: fromOpposition ? government.stability : Math.min(government.stability ?? 50, 20) } };
  return record(next, currentDate, 'crisi-governo', fromOpposition ? 'L’opposizione presenta una mozione di sfiducia: il governo deve verificare la fiducia nelle due Camere.' : 'Si apre una crisi politica nello scenario; il governo deve verificare la propria fiducia.', { governmentId: government.id, severity, fromOpposition, source: DATA_SOURCES.SIMULATION });
}

// ---------- the Government as an actor ----------
function changePartner(parliament, groupId, delta, patch = {}) {
  const government = parliament.government;
  if (!government?.partners?.[groupId]) return parliament;
  const partner = government.partners[groupId];
  return { ...parliament, government: { ...government, partners: { ...government.partners, [groupId]: { ...partner, ...patch, satisfaction: clamp(Math.round((partner.satisfaction + delta) * 10) / 10, 0, 100) } } } };
}
export function partnerSatisfaction(parliament) {
  const partners = Object.values(parliament?.government?.partners ?? {});
  return partners.length ? Math.round(partners.reduce((sum, item) => sum + item.satisfaction, 0) / partners.length) : null;
}
// The political direction and the national priorities of the Government: allies judge them against their own.
export function setGovernmentProgram(parliament, { line, priorities = [] }, currentDate) {
  const government = parliament.government;
  if (!government || !['active', 'crisis'].includes(government.status)) throw new Error('Serve un governo in carica.');
  if (!GOVERNMENT_LINES[line]) throw new Error('Scegli un indirizzo politico.');
  const areas = [...new Set(priorities)].filter(id => AREA_BY_ID[id]).slice(0, 5);
  if (areas.length < 2) throw new Error('Scegli da due a cinque priorità nazionali.');
  if (government.program?.setAt && weeksBetween(government.program.setAt, currentDate) < 8) throw new Error(`Il programma è stato fissato da poco: si può rivedere dal ${addDaysTo(government.program.setAt, 56)}.`);
  let next = { ...parliament, government: { ...government, program: { line, priorities: areas, setAt: currentDate, source: DATA_SOURCES.SIMULATION } } };
  const reactions = [];
  for (const groupId of Object.keys(government.partners ?? {})) {
    const profile = groupProfile(groupId);
    const delta = areas.filter(id => profile.likes.includes(id)).length * 4 - areas.filter(id => profile.dislikes.includes(id)).length * 5;
    if (delta) { next = changePartner(next, groupId, delta); reactions.push(`${getGroup(parliament, groupId)?.officialName ?? groupId} ${delta > 0 ? '+' : ''}${delta}`); }
  }
  return record(next, currentDate, 'programma-governo', `Programma di governo: ${GOVERNMENT_LINES[line].label.toLowerCase()} · priorità ${areas.map(id => AREA_BY_ID[id].label.toLowerCase()).join(', ')}.${reactions.length ? ` Reazioni degli alleati: ${reactions.join('; ')}.` : ''}`, { line, priorities: areas, source: DATA_SOURCES.SIMULATION });
}
// Summit of the majority: it can calm the allies, or make a quarrel public.
export function majoritySummit(parliament, currentDate, roll = 0.5) {
  const government = parliament.government;
  if (!government || government.status !== 'active') throw new Error('Il vertice di maggioranza serve a un governo in carica.');
  if (government.lastSummitAt && weeksBetween(government.lastSummitAt, currentDate) < 3) throw new Error('Un vertice ogni tre settimane al massimo: gli alleati non tornano al tavolo così presto.');
  const mood = partnerSatisfaction(parliament) ?? 50;
  const success = roll < clamp(0.35 + (mood - 40) / 80 + ((government.stability ?? 50) - 50) / 150, 0.15, 0.9);
  let next = { ...parliament, government: { ...government, lastSummitAt: currentDate } };
  for (const groupId of Object.keys(government.partners ?? {})) next = changePartner(next, groupId, success ? 4 : -2);
  next = { ...next, government: { ...next.government, stability: clamp((next.government.stability ?? 50) + (success ? 4 : -3), 0, 100), ministers: next.government.ministers.map(item => item.endedAt || item.playerAppointed ? item : { ...item, loyalty: clamp((item.loyalty ?? 60) + (success ? 5 : -2), 0, 100) }) } };
  return { parliament: record(next, currentDate, 'vertice-maggioranza', success ? 'Vertice di maggioranza: gli alleati firmano un documento comune.' : 'Vertice di maggioranza: lite sulle priorità, gli alleati escono divisi.', { success, source: DATA_SOURCES.SIMULATION }), success };
}
// Reshuffle: a ministry changes hands. The group that loses it resents it; the new holder is grateful.
export function reshuffleMinister(parliament, portfolio, groupId, currentDate) {
  const government = parliament.government;
  if (!government || government.status !== 'active') throw new Error('Il rimpasto si fa con un governo in carica.');
  const current = activeMinisters(government).find(item => item.portfolio === portfolio);
  if (!current) throw new Error('Il ministero è vacante: assegnalo direttamente.');
  if (current.groupId === groupId) throw new Error('Il ministero è già di quel gruppo.');
  if (![...government.coalitionGroupIds, ...government.supportingGroupIds].includes(groupId)) throw new Error('Il ministero va a un gruppo della maggioranza.');
  const ministers = government.ministers.map(item => item.id === current.id ? { ...item, endedAt: currentDate, endReason: 'Rimpasto' } : item);
  let next = { ...parliament, government: { ...government, ministers, stability: clamp((government.stability ?? 50) - 4, 0, 100) } };
  next = changePartner(next, current.groupId, -12);
  next = setRelation(next, current.groupId, -6);
  next = assignMinister(next, portfolio, groupId, currentDate);
  return record(next, currentDate, 'rimpasto', `Rimpasto: il ministero ${portfolio} passa da ${current.groupName} a ${getGroup(parliament, groupId)?.officialName ?? groupId}.`, { portfolio, from: current.groupId, to: groupId, source: DATA_SOURCES.SIMULATION });
}
// An ally with a demand met, or a demand that expired.
export function settlePartnerDemand(parliament, groupId, fulfilled, currentDate) {
  const partner = parliament.government?.partners?.[groupId];
  if (!partner?.demand) return parliament;
  const next = changePartner(parliament, groupId, fulfilled ? 10 : -15, { demand: null, lastDemand: { ...partner.demand, outcome: fulfilled ? 'accolta' : 'respinta', closedAt: currentDate } });
  return record(next, currentDate, fulfilled ? 'richiesta-accolta' : 'richiesta-respinta', `${getGroup(parliament, groupId)?.officialName ?? 'Un alleato'}: ${fulfilled ? 'richiesta soddisfatta' : 'richiesta ignorata'} (${partner.demand.label}).`, { groupId, source: DATA_SOURCES.SIMULATION });
}
export function leaveMajority(parliament, groupId, currentDate, reason = 'esce dalla maggioranza') {
  const government = parliament.government;
  if (!government || !['active', 'crisis'].includes(government.status)) return parliament;
  const coalitionGroupIds = government.coalitionGroupIds.filter(id => id !== groupId);
  const supportingGroupIds = government.supportingGroupIds.filter(id => id !== groupId);
  const ministers = government.ministers.map(item => item.groupId === groupId && !item.endedAt ? { ...item, endedAt: currentDate, endReason: 'Gruppo uscito dalla maggioranza' } : item);
  const partners = Object.fromEntries(Object.entries(government.partners ?? {}).filter(([id]) => id !== groupId));
  const next = { ...parliament, government: { ...government, coalitionGroupIds, supportingGroupIds, ministers, partners, status: 'crisis', crisisSeverity: 14, crisisOpenedAt: currentDate, stability: Math.min(government.stability ?? 50, 22) } };
  return record(next, currentDate, 'cambio-maggioranza', `${getGroup(parliament, groupId)?.officialName ?? 'Un gruppo'} ${reason}: il governo deve verificare la fiducia.`, { governmentId: government.id, groupId, source: DATA_SOURCES.SIMULATION });
}

// Weekly life of the executive: margins, allies' moods and demands, decrees that expire.
export function advanceGovernmentWeek(parliament, currentDate, roll = 0.5, rand = null) {
  let next = parliament;
  // Decree-laws not converted in time lapse.
  for (const law of (next?.laws ?? []).filter(item => item.kind === 'decreto' && item.deadline && !CLOSED_LAW_STAGES.includes(item.stage) && item.deadline < currentDate)) {
    next = replaceLaw(next, law.id, current => ({ ...current, stage: 'lapsed', status: 'decaduto', inForce: false, updatedAt: currentDate }));
    if (next.government) next = { ...next, government: { ...next.government, stability: clamp((next.government.stability ?? 50) - 6, 0, 100) } };
    next = record(next, currentDate, 'decreto-decaduto', `Il decreto-legge “${law.title}” decade: non è stato convertito in tempo.`, { lawId: law.id, source: DATA_SOURCES.SIMULATION });
  }
  const random = rand ?? (() => roll);
  // A Government led by the simulated Prime Minister goes back to the Chambers by itself, two weeks into a crisis.
  const led = next?.government && !playerLeadsGovernment(next) && next.government.formedBy !== 'player';
  if (led && ['crisis', 'awaiting-confidence'].includes(next.government.status) && weeksBetween(next.government.crisisOpenedAt ?? next.government.proposedAt ?? currentDate, currentDate) >= 2) {
    next = record(next, currentDate, 'fiducia-richiesta', 'Il Presidente del Consiglio (simulato) torna alle Camere e chiede la fiducia.', { governmentId: next.government.id, source: DATA_SOURCES.SIMULATION });
    return voteGovernmentConfidence(next, currentDate);
  }
  const government = next?.government;
  if (!government || government.status !== 'active') return next;
  const majorityIds = new Set([...government.coalitionGroupIds, ...government.supportingGroupIds]);
  const margin = Math.min(...['camera', 'senato'].map(chamber => next.chambers[chamber].groups.filter(group => majorityIds.has(group.groupId)).reduce((sum, group) => sum + group.simulatedSeats, 0) - majority(next, chamber)));
  const mood = partnerSatisfaction(next) ?? 55;
  const drift = (margin >= 15 ? 1 : margin >= 5 ? 0 : -2) + Math.round((roll - 0.5) * 4) + (mood < 40 ? -1 : mood > 65 ? 1 : 0);
  const stability = clamp((government.stability ?? 50) + drift, 0, 100);
  next = { ...next, government: { ...next.government, stability } };
  // Allies: those without ministries grow restless; unhappy ones make demands, and walk out if ignored.
  const holders = new Set(activeMinisters(government).map(item => item.groupId));
  for (const [groupId, partner] of Object.entries(next.government.partners ?? {})) {
    const restless = tuningOf(next).drift;
    let delta = (holders.has(groupId) ? 0.3 : -0.6 * restless) + (55 - partner.satisfaction) * 0.03;
    next = changePartner(next, groupId, delta);
    const current = next.government.partners[groupId];
    // The simulated Prime Minister answers the allies' demands on his own (the player does it only when leading).
    if (led && current.demand && current.demand.deadline >= currentDate && random() < 0.25) { next = settlePartnerDemand(next, groupId, true, currentDate); continue; }
    if (current.demand && current.demand.deadline < currentDate) {
      next = settlePartnerDemand(next, groupId, false, currentDate);
      if (next.government.partners[groupId]?.satisfaction < 25) return leaveMajority(next, groupId, currentDate, 'esce dalla maggioranza dopo una richiesta ignorata');
      continue;
    }
    if (!current.demand && current.satisfaction < 45 && random() < 0.3 * restless) {
      const profile = groupProfile(groupId);
      const free = MINISTRIES.filter(portfolio => !activeMinisters(next.government).some(item => item.portfolio === portfolio && item.groupId === groupId));
      const wantsMinistry = !holders.has(groupId) || random() < 0.4;
      const demand = wantsMinistry
        ? { type: 'ministero', portfolio: free[Math.floor(random() * free.length)] ?? MINISTRIES[0], deadline: addDaysTo(currentDate, 42) }
        : { type: 'misura', area: profile.likes[Math.floor(random() * profile.likes.length)], deadline: addDaysTo(currentDate, 56) };
      demand.label = demand.type === 'ministero' ? `il ministero ${demand.portfolio}` : `un provvedimento su ${AREA_BY_ID[demand.area].label.toLowerCase()}`;
      demand.since = currentDate;
      next = changePartner(next, groupId, 0, { demand: { ...demand, source: DATA_SOURCES.SIMULATION } });
      next = record(next, currentDate, 'richiesta-alleato', `${getGroup(next, groupId)?.officialName ?? 'Un alleato'} chiede ${demand.label} entro il ${demand.deadline}, altrimenti rimette in discussione il sostegno.`, { groupId, demand: demand.label, source: DATA_SOURCES.SIMULATION });
    }
  }
  if (next.government.stability > 20) return next;
  const severity = Math.min(24, 10 + Math.max(0, 3 - next.government.supportingGroupIds.length) * 2);
  next = { ...next, government: { ...next.government, status: 'crisis', crisisSeverity: severity, crisisOpenedAt: currentDate } };
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
