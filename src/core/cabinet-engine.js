// The Government of a simulated Prime Minister as an actor. It gives itself a programme and revises it, answers the
// discontent of its allies with reshuffles, replaces the ministers who fall, looks for external support when its
// numbers are thin, and in a crisis tries to save itself — a "verifica" with a new programme and attention to the
// allies, new supporters — before going back to the Chambers, or resigns when the numbers are gone. It works with the
// primitives of parliament-engine (programme, reshuffle, appointments, majority); everything here is simulation.
import { DATA_SOURCES } from '../data/schema.js?v=20260926-7';
import { AREA_BY_ID, GOVERNMENT_LINES, POLICY_AREAS } from '../data/simulation/policy-rules.js?v=20260926-7';
import { activeMinisters, assignMinister, campOfAxis, governingGroupIds, groupProfile, leaveMajority, parliamentInternals, reshuffleMinister, setGovernmentProgram } from './parliament-engine.js?v=20260926-7';

const { getGroup, allGroups, record, majority, setRelation } = parliamentInternals;
const SIM = DATA_SOURCES.SIMULATION;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const weeksBetween = (from, to) => from && to ? Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 604800000) : 99;
const tieKey = (a, b) => [a, b].sort().join('|');

export const CABINET_RULES = Object.freeze({
  // The programme is set when the Government starts and revised every six months (or in a verifica).
  programReviewWeeks: 26,
  // An ally below this satisfaction may get a ministry in a reshuffle, at most once every ten weeks.
  unhappyPartner: 38, reshuffleCooldownWeeks: 10, reshuffleChance: 0.5,
  // A minister can fall (an inquiry, a quarrel, health): the less competent, the more often.
  ministerTroubleChance: 0.0012,
  // An ally can break with the Government ("strappo"): unhappy, rising in the polls, far from the Prime Minister, tired
  // of a long cohabitation. Weekly chance per point of temptation.
  breakChance: 0.01, breakThreshold: 0.6,
  // Below this margin the Government looks for external support, at most once every six weeks.
  thinMargin: 4, supportSearchChance: 0.35, supportCooldownWeeks: 6,
  // In a crisis without numbers the Prime Minister may resign instead of facing the Chambers.
  resignationChance: 0.3,
  source: SIM
});
const ledByOthers = government => Boolean(government) && government.primeMinister !== 'player' && government.formedBy !== 'player';
const seatsOf = (parliament, chamber, ids) => (parliament.chambers?.[chamber]?.groups ?? []).filter(group => ids.has(group.groupId)).reduce((sum, group) => sum + group.simulatedSeats, 0);
export const majorityMargin = parliament => { const ids = governingGroupIds(parliament); return Math.min(...['camera', 'senato'].map(chamber => seatsOf(parliament, chamber, ids) - majority(parliament, chamber))); };
const withGovernment = (parliament, patch) => ({ ...parliament, government: { ...parliament.government, ...patch } });

// The line and the priorities a simulated Prime Minister gives the Government: the priorities of the premier's party
// and the problems of the country; a technical Government keeps the accounts in order.
export function programFor(parliament, society, rand = Math.random) {
  const government = parliament.government;
  const premier = getGroup(parliament, government.premierGroupId);
  const lines = { destra: ['sicurezza', 'crescita', 'rigore'], sinistra: ['equita', 'crescita', 'riforme'], centro: ['crescita', 'riforme', 'rigore'] }[campOfAxis(premier?.axis ?? 0)];
  const line = government.majorityKind === 'governo-del-presidente' ? 'rigore' : lines[Math.floor(rand() * lines.length)];
  const issues = (society?.issues ?? []).map(issue => issue.area ?? POLICY_AREAS.find(item => item.label === issue.topic)?.id).filter(id => AREA_BY_ID[id]);
  const priorities = [...new Set([...issues.slice(0, 2), ...groupProfile(premier ?? government.premierGroupId ?? 'governo').likes])].slice(0, 4);
  return { line, priorities: priorities.length >= 2 ? priorities : ['economia', 'lavoro'] };
}
// The groups of a force in both Chambers.
const groupsOfParty = (parliament, partyId) => allGroups(parliament).filter(group => partyId && group.partyId === partyId);
const partyName = (world, group) => world?.parties?.find(item => item.id === group?.partyId)?.label ?? group?.officialName ?? 'un gruppo';
// Who would give external support: a force outside the majority, not far from the Prime Minister, on good terms with
// the premier's party and not in hard opposition.
export function supportCandidates(parliament, world) {
  const government = parliament.government;
  const inside = governingGroupIds(parliament);
  const premier = getGroup(parliament, government?.premierGroupId);
  const seen = new Set();
  return allGroups(parliament).filter(group => group.partyId && !inside.has(group.groupId) && !seen.has(group.partyId) && seen.add(group.partyId) && Math.abs((group.axis ?? 0) - (premier?.axis ?? 0)) <= 2).map(group => {
    const party = world?.parties?.find(item => item.id === group.partyId);
    const tie = premier?.partyId ? world?.ties?.[tieKey(group.partyId, premier.partyId)] ?? 0 : 0;
    const seats = groupsOfParty(parliament, group.partyId).reduce((sum, item) => sum + item.simulatedSeats, 0);
    const chance = clamp(0.35 + tie / 150 - Math.abs((group.axis ?? 0) - (premier?.axis ?? 0)) * 0.1 + (party?.strategy === 'coalizione' || party?.strategy === 'autonoma' ? 0.1 : party?.strategy === 'opposizione' ? -0.2 : 0), 0.05, 0.8);
    return { partyId: group.partyId, label: party?.label ?? group.officialName, seats, chance, player: groupsOfParty(parliament, group.partyId).some(item => item.groupId === parliament.player?.groupId) };
  }).filter(item => item.seats > 0).sort((a, b) => b.chance * Math.sqrt(b.seats) - a.chance * Math.sqrt(a.seats));
}
// How a force moved in the polls over the last two months (points).
function pollTrend(world, partyId) {
  const polls = world?.polls ?? [];
  const share = poll => poll?.results?.find(row => row.partyId === partyId)?.share ?? null;
  const now = share(polls.at(-1));
  const before = share(polls.at(-9) ?? polls[0]);
  return now !== null && before !== null ? now - before : 0;
}
// A force enters the majority from outside (external support, no ministers).
export function joinAsSupport(parliament, partyId, date, { world = null, text = null } = {}) {
  const government = parliament.government;
  const groups = groupsOfParty(parliament, partyId).filter(group => ![...government.coalitionGroupIds, ...government.supportingGroupIds].includes(group.groupId));
  if (!groups.length) return parliament;
  const partners = { ...(government.partners ?? {}) };
  for (const group of groups) if (group.groupId !== parliament.player?.groupId) partners[group.groupId] = { satisfaction: 56, demand: null, source: SIM };
  let next = withGovernment(parliament, { supportingGroupIds: [...government.supportingGroupIds, ...groups.map(group => group.groupId)], partners, stability: clamp((government.stability ?? 50) + 4, 0, 100), crisisSeverity: government.status === 'crisis' ? Math.max(0, (government.crisisSeverity ?? 0) - 4) : government.crisisSeverity });
  for (const group of groups) next = setRelation(next, group.groupId, 3);
  return record(next, date, 'sostegno-esterno', text ?? `${partyName(world, groups[0])} garantisce un sostegno esterno al governo, senza ministri.`, { governmentId: government.id, partyId, groupIds: groups.map(group => group.groupId), auto: true });
}

// One week of the Government of a simulated Prime Minister. ctx: { date, rand, world, society, playerSecretaryOf }.
// Returns { parliament, events, lines }: events are the decisions that belong to the player (a request of external
// support to the player's party, when the player leads it).
export function advanceCabinetWeek(input, { date, rand = Math.random, world = null, society = null, playerSecretaryOf = null } = {}) {
  let next = input;
  const events = [];
  const lines = [];
  const government = next?.government;
  if (!ledByOthers(government) || !['active', 'crisis'].includes(government.status)) return { parliament: input, events, lines };
  // 1. The programme: at the start, then every six months.
  if (government.status === 'active' && (!government.program || weeksBetween(government.program.setAt, date) >= CABINET_RULES.programReviewWeeks)) {
    const program = programFor(next, society, rand);
    try { next = setGovernmentProgram(next, program, date); lines.push(`Il governo ${government.program ? 'rilancia' : 'fissa'} il suo programma: ${GOVERNMENT_LINES[program.line].label.toLowerCase()}.`); } catch { /* revised too recently */ }
  }
  // 2. An unhappy ally gets a ministry: a reshuffle at the expense of the group with the most ministries per seat.
  const cabinet = next.government;
  if (cabinet.status === 'active' && weeksBetween(cabinet.lastReshuffleAt ?? cabinet.formedAt ?? cabinet.inheritedAt, date) >= CABINET_RULES.reshuffleCooldownWeeks) {
    const unhappy = Object.entries(cabinet.partners ?? {}).filter(([id, partner]) => partner.satisfaction < CABINET_RULES.unhappyPartner && cabinet.coalitionGroupIds.includes(id) && !partner.demand).sort((a, b) => a[1].satisfaction - b[1].satisfaction)[0];
    if (unhappy && rand() < CABINET_RULES.reshuffleChance) {
      const [groupId] = unhappy;
      const held = activeMinisters(cabinet).filter(item => item.groupId && item.groupId !== groupId && !item.playerAppointed);
      const load = id => held.filter(item => item.groupId === id).length / Math.max(1, getGroup(next, id)?.simulatedSeats ?? 1);
      const donor = [...new Set(held.map(item => item.groupId))].sort((a, b) => load(b) - load(a))[0];
      const portfolio = held.filter(item => item.groupId === donor).at(-1)?.portfolio;
      if (portfolio) {
        try {
          next = reshuffleMinister(next, portfolio, groupId, date);
          const partner = next.government.partners?.[groupId];
          next = withGovernment(next, { lastReshuffleAt: date, ...(partner ? { partners: { ...next.government.partners, [groupId]: { ...partner, courtedAt: date } } } : {}) });
          lines.push(`Rimpasto: il ministero ${portfolio} passa a ${getGroup(next, groupId)?.officialName ?? 'un alleato'}.`);
        } catch { /* the portfolio changed hands meanwhile */ }
      }
    }
  }
  // 3. A minister falls and is replaced by the same group (a new simulated minister, never a real person).
  if (next.government.status === 'active') for (const minister of activeMinisters(next.government).filter(item => !item.playerAppointed && item.groupId)) {
    if (rand() >= CABINET_RULES.ministerTroubleChance * (1 + (60 - (minister.competence ?? 60)) / 40)) continue;
    next = withGovernment(next, { ministers: next.government.ministers.map(item => item.id === minister.id ? { ...item, endedAt: date, endReason: 'Dimissioni' } : item), stability: clamp((next.government.stability ?? 50) - 3, 0, 100) });
    try { next = assignMinister(next, minister.portfolio, minister.groupId, date); } catch { /* the group left meanwhile */ }
    next = record(next, date, 'nuovo-ministro', `Si dimette il ministro ${minister.portfolio} (${minister.groupName}): giura un nuovo ministro dello stesso gruppo (figura simulata).`, { governmentId: next.government.id, portfolio: minister.portfolio, groupId: minister.groupId, auto: true });
    lines.push(`Cambio al ministero ${minister.portfolio}.`);
    break;
  }
  // 4. Thin numbers: the Prime Minister looks for external support (in a crisis, with more urgency).
  const crisis = next.government.status === 'crisis';
  if (majorityMargin(next) < CABINET_RULES.thinMargin && weeksBetween(next.government.lastSupportSearchAt, date) >= CABINET_RULES.supportCooldownWeeks && rand() < (crisis ? 0.8 : CABINET_RULES.supportSearchChance)) {
    next = withGovernment(next, { lastSupportSearchAt: date });
    const target = supportCandidates(next, world)[0];
    if (target?.player && playerSecretaryOf && target.partyId === playerSecretaryOf) events.push({ id: 'richiesta-sostegno', params: { partyId: target.partyId, party: target.label, government: next.government.name, margin: String(majorityMargin(next)) } });
    else if (target && rand() < target.chance) { next = joinAsSupport(next, target.partyId, date, { world }); lines.push(`${target.label} garantisce un sostegno esterno al governo.`); }
    else if (target) { next = record(next, date, 'sostegno-negato', `${target.label} respinge la richiesta di sostegno del governo.`, { governmentId: next.government.id, partyId: target.partyId, auto: true }); lines.push(`${target.label} dice no al governo.`); }
  }
  // 5. An ally breaks with the Government: the temptation grows with discontent, a rising trend in the polls, the
  // distance from the Prime Minister and the time spent together. The player's own party decides for itself.
  if (next.government.status === 'active') {
    const premier = getGroup(next, next.government.premierGroupId);
    const months = weeksBetween(next.government.formedAt ?? next.government.inheritedAt, date) / 4.3;
    const tried = new Set();
    // The most tempted ally first.
    const tempted = Object.entries(next.government.partners ?? {}).map(([groupId, partner]) => {
      const group = getGroup(next, groupId);
      if (!group?.partyId || group.partyId === premier?.partyId || weeksBetween(partner.courtedAt, date) < 8 || groupsOfParty(next, group.partyId).some(item => item.groupId === next.player?.groupId)) return null;
      // An ally just courted (a ministry in a reshuffle) gives the Government some time; the player's party decides for itself.
      return { group, temptation: Math.max(0, (42 - partner.satisfaction) / 30) + Math.max(0, pollTrend(world, group.partyId)) / 2 + Math.abs((group.axis ?? 0) - (premier?.axis ?? 0)) * 0.15 + Math.min(0.5, months / 48) };
    }).filter(Boolean).sort((a, b) => b.temptation - a.temptation);
    for (const { group, temptation } of tempted) {
      if (tried.has(group.partyId)) continue;
      tried.add(group.partyId);
      if (temptation < CABINET_RULES.breakThreshold || rand() >= CABINET_RULES.breakChance * temptation) continue;
      for (const item of groupsOfParty(next, group.partyId).filter(entry => governingGroupIds(next).has(entry.groupId))) next = leaveMajority(next, item.groupId, date, 'rompe con il governo ed esce dalla maggioranza');
      lines.push(`Strappo: ${partyName(world, group)} esce dalla maggioranza.`);
      break;
    }
  }
  // 6. A crisis: with the numbers, a verifica (programme, attention to the allies) lowers the risk of defections;
  // without them, the Prime Minister may resign and leave it to the consultations.
  if (next.government.status === 'crisis' && next.government.verificaFor !== next.government.crisisOpenedAt) {
    next = withGovernment(next, { verificaFor: next.government.crisisOpenedAt });
    if (majorityMargin(next) >= 0) {
      const partners = Object.fromEntries(Object.entries(next.government.partners ?? {}).map(([id, partner]) => [id, { ...partner, satisfaction: clamp(partner.satisfaction + 6, 0, 100) }]));
      next = withGovernment(next, { partners, crisisSeverity: Math.max(2, (next.government.crisisSeverity ?? 10) - 6 - Math.round(rand() * 4)) });
      try { next = setGovernmentProgram(next, programFor(next, society, rand), date); } catch { /* the programme was just set */ }
      next = record(next, date, 'verifica-maggioranza', 'Verifica di maggioranza: il Presidente del Consiglio (simulato) rilancia il programma e ascolta gli alleati prima di tornare alle Camere.', { governmentId: next.government.id, auto: true });
      lines.push('Verifica di maggioranza prima del voto di fiducia.');
    } else if (rand() < CABINET_RULES.resignationChance) {
      const ministers = next.government.ministers.map(item => item.endedAt ? item : { ...item, endedAt: date, endReason: 'Dimissioni del governo' });
      next = withGovernment(next, { status: 'fallen', stability: 0, ministers, fallenAt: date, resigned: true });
      next = record(next, date, 'dimissioni-governo', `Senza più una maggioranza, il Presidente del Consiglio (simulato) si dimette: ${next.government.name} resta per gli affari correnti, si aprono le consultazioni.`, { governmentId: next.government.id, auto: true });
      lines.push('Il governo si dimette.');
    }
  }
  // What the simulated Prime Minister did belongs to the calendar of the Government, not to the player's decisions.
  if (next !== input) {
    const known = new Set((input.history ?? []).map(entry => entry.id));
    next = { ...next, history: (next.history ?? []).map(entry => known.has(entry.id) || entry.details?.auto ? entry : { ...entry, details: { ...(entry.details ?? {}), auto: true } }) };
  }
  return { parliament: next, events, lines };
}
