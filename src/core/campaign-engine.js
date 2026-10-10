import { advanceDays } from './time.js?v=20261010-2';
import { CAMPAIGN_ACTIVITIES, CAMPAIGN_AUDIENCE, CAMPAIGN_EVENTS, CAMPAIGN_PHASES, CAMPAIGN_POLL_RULES, CAMPAIGN_STRATEGIES, CREW_RULES, CREW_TEAMS, DEBATE_TOPICS, ELECTION_MODELS, ENDORSEMENT_KINDS, ENDORSEMENT_RULES, EUROPEAN_THRESHOLD, INCUMBENCY_RULES, LIST_RULES, RIVAL_PERSISTENCE, RUNOFF_RULES, TOPIC_AREA, phaseOf } from '../data/simulation/campaign-rules.js?v=20261010-2';
import { POLL_INSTITUTES } from '../data/simulation/polling-rules.js?v=20261010-2';
import { aggregateShares, mateForce, runFinalElection, runFirstRound } from './election-engine.js?v=20261010-2';
import { houseEffect } from './world-engine.js?v=20261010-2';
import { ITALIAN_REGIONS, regionIdOf } from '../data/regions.js?v=20261010-2';
import { CAMP_PRIORITIES } from '../data/simulation/policy-rules.js?v=20261010-2';
import { averageOf, flowsOf, hash as pollHash, readInstitute, secondChoice, segmentSupport, stanceOf, themesOf } from './poll-observatory.js?v=20261010-2';

const SOURCE = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = value => Math.round(value * 100) / 100;
const copy = value => JSON.parse(JSON.stringify(value));
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
function randomFrom(seed) {
  let value = seed >>> 0 || 1;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}
function draw(campaign) {
  campaign.rngState = (Math.imul(campaign.rngState, 1664525) + 1013904223) >>> 0;
  return campaign.rngState / 4294967296;
}
// A normally distributed draw (Box–Muller) from the campaign's own sequence.
function gaussian(campaign) {
  const u = Math.max(1e-9, draw(campaign));
  const v = draw(campaign);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function pollDraw(campaign) {
  campaign.pollRngState = (Math.imul(campaign.pollRngState ?? hash(`${campaign.seed}|campaign-polls`), 1664525) + 1013904223) >>> 0;
  return campaign.pollRngState / 4294967296;
}
function pollGaussian(campaign) {
  const u = Math.max(1e-9, pollDraw(campaign));
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * pollDraw(campaign));
}
function recordCampaignPoll(campaign) {
  if (!Array.isArray(campaign.polls)) campaign.polls = [];
  if (campaign.polls?.at(-1)?.day === campaign.day) return campaign.polls.at(-1);
  const groups = aggregateShares(campaign);
  if (!groups.length) return null;
  const institute = POLL_INSTITUTES[Math.floor(pollDraw(campaign) * POLL_INSTITUTES.length)];
  const sample = Math.round((institute.sample[0] + pollDraw(campaign) * (institute.sample[1] - institute.sample[0])) / 10) * 10;
  const margin = round(1.96 * Math.sqrt(.25 / sample) * 100);
  campaign.pollErrors ??= {};
  const raw = groups.map(group => {
    const share = clamp(Number(group.share) || 0, 0, 100);
    const p = share / 100;
    const sigma = Math.sqrt(Math.max(.0004, p * (1 - p)) / sample) * 100;
    const error = Number(campaign.pollErrors[group.id] ?? 0) * .7 + pollGaussian(campaign) * sigma;
    campaign.pollErrors[group.id] = round(error);
    return Math.max(.2, share + error + houseEffect(institute.id, group.id, share));
  });
  const shares = normalized(raw);
  const previous = campaign.polls?.at(-1);
  const results = groups.map((group, index) => {
    const previousShare = previous?.results?.find(item => item.candidateId === group.id)?.share;
    return { candidateId:group.id,label:group.label,share:shares[index],delta:Number.isFinite(previousShare)?round(shares[index]-previousShare):null,source:SOURCE };
  });
  const poll = { id:`${campaign.id}-poll-${campaign.day}`,day:campaign.day,date:campaign.currentDate,stage:campaign.stage,institute:{id:institute.id,name:institute.name},sample,margin,results,source:SOURCE };
  campaign.polls = [...(campaign.polls ?? []),poll].slice(-24);
  return poll;
}
function withinDays(date, count) { return advanceDays(date, count); }
function gameStat(records, playerId, metric, fallback) {
  return records.find(record => record.subjectId === playerId && record.metric === metric)?.value ?? fallback;
}
function normalized(values) {
  const total = values.reduce((sum, value) => sum + Math.max(.01, value), 0) || 1;
  return values.map(value => round(Math.max(.01, value) * 100 / total));
}
function ids(prefix, seed, index = 0) { return `${prefix}-${seed.toString(36)}-${index}`; }

// The campaign is simulation data: rival identities are deliberately generated from the campaign seed and
// candidate id, so they survive saves and remain reproducible without touching REAL or USER records.
export const RIVAL_PERSONALITIES = Object.freeze({
  aggressivo: Object.freeze({ attack: 1.8, defend: .65, territory: .9, visibility: 1.25, alliance: .45, withdraw: .35 }),
  prudente: Object.freeze({ attack: .55, defend: 1.8, territory: 1.2, visibility: .75, alliance: 1.05, withdraw: .7 }),
  opportunista: Object.freeze({ attack: 1.3, defend: .75, territory: 1.05, visibility: 1.15, alliance: 1.35, withdraw: 1.1 }),
  diplomatico: Object.freeze({ attack: .35, defend: 1.05, territory: .85, visibility: .8, alliance: 1.95, withdraw: .55 }),
  ideologico: Object.freeze({ attack: 1.2, defend: .9, territory: 1.05, visibility: 1.15, alliance: .55, withdraw: .25 }),
  territoriale: Object.freeze({ attack: .75, defend: 1.15, territory: 2, visibility: .7, alliance: .8, withdraw: .45 })
});
const RIVAL_PERSONALITY_IDS = Object.freeze(Object.keys(RIVAL_PERSONALITIES));
const RIVAL_OBJECTIVES = Object.freeze(['vincere', 'consolidare-territorio', 'fermare-il-giocatore', 'costruire-alleanza', 'emergere-nel-partito', 'restare-competitivo']);
const RIVAL_INTERESTS = Object.freeze(['territorio', 'visibilita', 'programma', 'coalizioni', 'partito', 'elettorato-locale']);
const RIVAL_MEMORY_LIMIT = 24;
const RIVAL_MEMORY_HALF_LIFE = 90;
const RIVAL_MEMORY_TYPES = Object.freeze({
  attack: -1,
  betrayal: -1.5,
  rejection: -.65,
  aid: 1,
  agreement: 1,
  conflict: -.8,
  victory: 1,
  defeat: -.5,
  initiative: 0
});
function rivalProfileSeed(campaignSeed, candidateId) { return hash(`rival-profile|${campaignSeed}|${candidateId}`); }
function profileForCandidate(campaignSeed, candidateId, index = 0, type = 'politiche') {
  const seed = rivalProfileSeed(campaignSeed, candidateId);
  const rand = randomFrom(seed ^ (index * 0x9e3779b9));
  const personality = RIVAL_PERSONALITY_IDS[(seed + index) % RIVAL_PERSONALITY_IDS.length];
  const objective = RIVAL_OBJECTIVES[(seed >>> 3) % RIVAL_OBJECTIVES.length];
  const firstInterest = RIVAL_INTERESTS[(seed >>> 7) % RIVAL_INTERESTS.length];
  const secondInterest = RIVAL_INTERESTS[(seed >>> 11) % RIVAL_INTERESTS.length];
  const interests = [...new Set([firstInterest, secondInterest, ['comunale', 'provinciale'].includes(type) ? 'elettorato-locale' : null].filter(Boolean))];
  return {
    version: 1,
    personality,
    objectives: [objective, objective === 'vincere' ? 'restare-competitivo' : 'vincere'],
    interests,
    loyalty: round(38 + rand() * 48),
    initiative: round(.42 + rand() * .5),
    memory: [],
    relationships: {},
    lastDecision: null,
    source: SOURCE
  };
}
function memoryWeightAt(campaign, entry) {
  const age = Math.max(0, (campaign.day ?? 0) - Number(entry.day ?? campaign.day ?? 0));
  return Number(entry.weight ?? 1) * Math.pow(.5, age / RIVAL_MEMORY_HALF_LIFE);
}
function ensureRivalProfile(campaign, rival, index = 0) {
  if (!rival || rival.isPlayer) return null;
  const fallback = profileForCandidate(campaign.seed ?? 1, rival.id, index, campaign.electionType);
  const profile = rival.aiProfile && typeof rival.aiProfile === 'object' ? rival.aiProfile : {};
  const normalized = {
    ...fallback,
    ...profile,
    objectives: Array.isArray(profile.objectives) && profile.objectives.length ? profile.objectives : fallback.objectives,
    interests: Array.isArray(profile.interests) && profile.interests.length ? profile.interests : fallback.interests,
    memory: Array.isArray(profile.memory) ? profile.memory.slice(0, RIVAL_MEMORY_LIMIT) : [],
    relationships: profile.relationships && typeof profile.relationships === 'object' ? { ...profile.relationships } : {},
    loyalty: clamp(Number(profile.loyalty ?? fallback.loyalty)),
    initiative: clamp(Number(profile.initiative ?? fallback.initiative), 0, 1),
    source: SOURCE
  };
  // Keep the same object reference during a turn: memory/decision helpers can safely enrich it incrementally.
  rival.aiProfile = profile === rival.aiProfile ? Object.assign(rival.aiProfile, normalized) : normalized;
  const playerId = campaign.playerCandidateId;
  if (playerId && !Number.isFinite(Number(rival.aiProfile.relationships[playerId]))) rival.aiProfile.relationships[playerId] = round(clamp(Number(rival.relationship ?? .5) * 100));
  for (const other of campaign.candidates ?? []) {
    if (other.id !== rival.id && !Number.isFinite(Number(rival.aiProfile.relationships[other.id]))) rival.aiProfile.relationships[other.id] = 50;
  }
  rival.relationship = round(clamp(Number(rival.aiProfile.relationships[playerId] ?? Number(rival.relationship ?? .5) * 100) / 100, 0, 1));
  return rival.aiProfile;
}
function rivalMemory(campaign, rival, type, targetId = null, details = {}) {
  const profile = ensureRivalProfile(campaign, rival);
  if (!profile) return;
  const entry = {
    id: ids(`memoria-rivale-${type}`, campaign.seed, (campaign.history?.length ?? 0) + (profile.memory?.length ?? 0)),
    type, targetId, day: campaign.day, date: campaign.currentDate, weight: details.weight ?? (Math.abs(RIVAL_MEMORY_TYPES[type] ?? 0.5) || .5),
    valence: RIVAL_MEMORY_TYPES[type] ?? 0, source: SOURCE, ...details
  };
  profile.memory = [entry, ...(profile.memory ?? [])].slice(0, RIVAL_MEMORY_LIMIT);
  if (targetId) {
    const old = Number(profile.relationships[targetId] ?? 50);
    const delta = Number(details.relationDelta ?? (entry.valence * (type === 'betrayal' ? 9 : type === 'agreement' ? 6 : 4)));
    profile.relationships[targetId] = round(clamp(old + delta));
    if (targetId === campaign.playerCandidateId) rival.relationship = round(clamp(profile.relationships[targetId] / 100, 0, 1));
  }
}
function rivalMemoryScore(campaign, rival, type, targetId = null) {
  const profile = ensureRivalProfile(campaign, rival);
  return (profile?.memory ?? []).filter(item => item.type === type && (!targetId || item.targetId === targetId)).reduce((sum, item) => sum + memoryWeightAt(campaign, item), 0);
}
function rivalRelationship(campaign, rival, targetId) {
  const profile = ensureRivalProfile(campaign, rival);
  return Number(profile?.relationships?.[targetId] ?? (targetId === campaign.playerCandidateId ? Number(rival.relationship ?? .5) * 100 : 50));
}

// ---------- the rivals between campaigns ----------
// A rival is not born with the campaign: the same political family runs again in the same place. The registry (kept by the game, one record per
// rival identity) remembers how it ended between the rival and the player - votes, attacks, agreements, betrayals - and fades with time
// (RIVAL_PERSISTENCE.halfLifeDays). A rival met before recognises the player: personality and interests stay, the rapport and the memories
// start where they were left, and with them what he does (attacks, alliances, priorities, who he backs when he withdraws).
const DAY_MS = 864e5;
const daysBetween = (from, to) => from && to ? Math.max(0, (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS) : 0;
const fadeOf = (days, half = RIVAL_PERSISTENCE.halfLifeDays) => Math.pow(.5, Math.max(0, days) / half);
export const stanceOfRelation = relation => RIVAL_PERSISTENCE.stances.find(([limit]) => relation < limit)?.[1] ?? 'neutro';
const rivalScopeOf = (type, player = {}) => type === 'comunale' ? `comune:${player.municipality ?? ''}` : type === 'provinciale' ? `provincia:${player.province ?? player.region ?? ''}` : type === 'regionale' ? `regione:${player.region ?? ''}` : 'nazionale';
// The identity of a rival: a documented person is himself; a simulated one is the candidacy of a party in a place, for a kind of election.
export function rivalKeyOf(type, scope, candidate, index = 0) {
  if (candidate.realReference?.politicianId) return `reale|${candidate.realReference.politicianId}`;
  return `${type}|${scope}|${candidate.partyId ?? `civica-${index}`}`;
}
// The registry as it is on a date: memories and rapport faded, what is no longer worth remembering gone.
export function decayRivalRegistry(registry = [], date = null) {
  return (Array.isArray(registry) ? registry : []).map(record => {
    const days = daysBetween(record.lastMet, date);
    const memory = (record.memory ?? []).map(item => ({ ...item, weight:round(Number(item.weight ?? 0) * fadeOf(daysBetween(item.date ?? record.lastMet, date))) })).filter(item => item.weight >= RIVAL_PERSISTENCE.dropWeight);
    return { ...record, memory, relation:round(50 + (Number(record.relation ?? 50) - 50) * fadeOf(days)), ageDays:Math.round(days) };
  }).filter(record => record.ageDays < RIVAL_PERSISTENCE.forgetYears * 365 && (record.memory.length || Math.abs(record.relation - 50) >= 3));
}
const PERSISTENT_TYPES = Object.freeze(['attack', 'betrayal', 'rejection', 'aid', 'agreement', 'victory', 'defeat']);
const PLAYER_ATTACKS = Object.freeze(['attacco-del-giocatore', 'evento-del-giocatore', 'sostegno-ostile', 'attacco-al-mandato']);
// What a campaign leaves with each rival, ready to be merged into the registry.
export function rivalLedger(campaign) {
  // A campaign saved before the registry has no identity for its rivals: it leaves nothing behind.
  if (!campaign.rivalScope) return [];
  const playerId = campaign.playerCandidateId;
  const scope = campaign.rivalScope ?? rivalScopeOf(campaign.electionType);
  const seen = new Set();
  return campaign.candidates.filter(item => !item.isPlayer).map((rival, index) => {
    const profile = rival.aiProfile ?? {};
    let key = rival.rivalKey ?? rivalKeyOf(campaign.electionType, scope, rival, index);
    while (seen.has(key)) key = `${key}#${index}`;
    seen.add(key);
    const mine = (profile.memory ?? []).filter(item => item.targetId === playerId && PERSISTENT_TYPES.includes(item.type));
    const byType = {};
    for (const item of mine) {
      const row = byType[item.type] ?? { type:item.type, weight:0, count:0, date:item.date ?? campaign.currentDate };
      row.weight += Number(item.weight ?? 1); row.count += 1; if ((item.date ?? '') > row.date) row.date = item.date;
      byType[item.type] = row;
    }
    const memory = Object.values(byType).map(row => ({ ...row, weight:round(Math.min(3, row.weight)) })).sort((a, b) => b.weight - a.weight).slice(0, RIVAL_PERSISTENCE.memoryLimit);
    const has = (type, actions = null) => mine.some(item => item.type === type && (!actions || actions.includes(item.action)));
    const rows = campaign.result?.groups ?? [];
    const rowOf = id => rows.find(row => row.candidateId === id || (row.memberCandidateIds ?? []).includes(id)) ?? null;
    const rivalRow = rowOf(rival.id), playerRow = rowOf(playerId);
    const together = Boolean(rivalRow && playerRow && rivalRow.id === playerRow.id);
    const ahead = together ? rivalRow.id === campaign.result?.winnerGroupId : (rivalRow?.id === campaign.result?.winnerGroupId) || (playerRow?.id !== campaign.result?.winnerGroupId && Number(rivalRow?.percent ?? 0) > Number(playerRow?.percent ?? 0));
    return {
      key, label:rival.realReference?.fullName ?? rival.partyLabel ?? rival.displayName, partyId:rival.partyId ?? null, scope, electionType:campaign.electionType,
      personality:profile.personality ?? null, objectives:profile.objectives ?? [], interests:profile.interests ?? [], loyalty:profile.loyalty ?? 50, initiative:profile.initiative ?? .6,
      relation:round(Number(profile.relationships?.[playerId] ?? Number(rival.relationship ?? .5) * 100)), memory,
      flags:{ beatPlayer:!together && ahead, lostToPlayer:!together && !ahead, allied:has('agreement') || rival.status === 'allied', betrayed:has('betrayal'), attacked:has('attack', PLAYER_ATTACKS), aided:has('aid') },
      share:round(Number(rivalRow?.percent ?? weightedShare(campaign, rival.id))), ahead, date:campaign.currentDate, campaignId:campaign.id, source:SOURCE
    };
  });
}
export function mergeRivalRegistry(registry = [], ledger = [], date = null) {
  const byKey = new Map(decayRivalRegistry(registry, date).map(record => [record.key, record]));
  for (const entry of ledger) {
    const old = byKey.get(entry.key);
    const memory = {};
    for (const item of [...(old?.memory ?? []), ...entry.memory.map(row => ({ ...row, date:row.date ?? date }))]) {
      const row = memory[item.type] ?? { type:item.type, weight:0, count:0, date:item.date };
      row.weight += Number(item.weight ?? 0); row.count += Number(item.count ?? 1); if ((item.date ?? '') > (row.date ?? '')) row.date = item.date;
      memory[item.type] = row;
    }
    const record = old?.record ?? {};
    byKey.set(entry.key, {
      key:entry.key, label:entry.label, partyId:entry.partyId, scope:entry.scope, electionType:entry.electionType,
      personality:old?.personality ?? entry.personality, objectives:entry.objectives, interests:old?.interests ?? entry.interests, loyalty:entry.loyalty, initiative:entry.initiative,
      relation:entry.relation, meetings:Number(old?.meetings ?? 0) + 1, firstMet:old?.firstMet ?? date, lastMet:date,
      record:{ beatPlayer:Number(record.beatPlayer ?? 0) + (entry.flags.beatPlayer ? 1 : 0), lostToPlayer:Number(record.lostToPlayer ?? 0) + (entry.flags.lostToPlayer ? 1 : 0), allied:Number(record.allied ?? 0) + (entry.flags.allied ? 1 : 0), betrayed:Number(record.betrayed ?? 0) + (entry.flags.betrayed ? 1 : 0), attacked:Number(record.attacked ?? 0) + (entry.flags.attacked ? 1 : 0), aided:Number(record.aided ?? 0) + (entry.flags.aided ? 1 : 0) },
      last:{ date, campaignId:entry.campaignId, electionType:entry.electionType, share:entry.share, ahead:entry.ahead },
      memory:Object.values(memory).map(row => ({ ...row, weight:round(Math.min(3, row.weight)) })).sort((a, b) => b.weight - a.weight).slice(0, RIVAL_PERSISTENCE.memoryLimit), source:SOURCE
    });
  }
  return [...byKey.values()].sort((a, b) => String(b.lastMet).localeCompare(String(a.lastMet))).slice(0, RIVAL_PERSISTENCE.limit);
}
// The subjects who backed (or refused) the player remember it too: the same mayor, association or network comes back in the next campaigns in
// the same place, with the rapport it left, faded with time.
export function decayEndorsers(list = [], date = null) {
  return (Array.isArray(list) ? list : []).map(item => ({ ...item, relation:round(50 + (Number(item.relation ?? 50) - 50) * fadeOf(daysBetween(item.lastMet, date))) }))
    .filter(item => daysBetween(item.lastMet, date) < RIVAL_PERSISTENCE.forgetYears * 365 && Math.abs(item.relation - 50) >= 3);
}
export function mergeEndorsers(list = [], campaign, { date = campaign.currentDate, won = false } = {}) {
  const map = new Map(decayEndorsers(list, date).map(item => [item.key, item]));
  const box = campaign.endorsements ?? {};
  const touch = (entry, delta, accepted) => {
    const old = map.get(entry.key);
    map.set(entry.key, { key:entry.key, kind:entry.kind, areaId:entry.areaId, label:entry.label, relation:round(clamp(Number(old?.relation ?? entry.relation ?? 50) + delta)), meetings:Number(old?.meetings ?? 0) + 1, firstMet:old?.firstMet ?? date, lastMet:date,
      history:[...(old?.history ?? []), { campaignId:campaign.id, accepted, mode:entry.mode ?? null, points:entry.points ?? 0, outcome:won ? 'vinto' : 'perso', date }].slice(-6), source:SOURCE });
  };
  for (const given of box.given ?? []) touch(given, (won ? 8 : 2) - (given.mode === 'light' ? 3 : 0), true);
  for (const refused of box.refused ?? []) touch(refused, Number(refused.delta ?? -6), false);
  return [...map.values()].sort((a, b) => String(b.lastMet).localeCompare(String(a.lastMet))).slice(0, 30);
}
// What the promises of the campaign leave to keep: the relations that move with the vote (who backed a winner is pleased, who ceded a place for nothing is not).
export function campaignDebts(campaign, { won = false } = {}) {
  const relations = {};
  const add = (id, delta) => { relations[id] = round((relations[id] ?? 0) + delta); };
  for (const given of campaign.endorsements?.given ?? []) add(ENDORSEMENT_RULES.relations[given.kind] ?? 'civic', won ? (given.mode === 'light' ? 1 : 2) : -.5);
  for (const item of campaign.obligations ?? []) if (item.kind === 'lista') add('leadership', won ? .5 * (item.weight ?? 1) : -.5 * (item.weight ?? 1));
  return { relations, endorsements:(campaign.endorsements?.given ?? []).length, obligations:(campaign.obligations ?? []).length, commitments:Number(campaign.commitments ?? 0) };
}
// A rival who has met the player before: priorities shift with what happened between them.
function adaptObjectives(base, record) {
  const out = [...base];
  const front = id => { const index = out.indexOf(id); if (index >= 0) out.splice(index, 1); out.unshift(id); };
  // Whoever won last time defends it; but hostility or friendship towards the player comes first.
  if (record.last?.ahead) front('consolidare-territorio');
  if (record.relation <= 35 || record.record?.betrayed || (record.record?.attacked ?? 0) >= 2) front('fermare-il-giocatore');
  else if (record.relation >= 65 || record.record?.allied) front('costruire-alleanza');
  return out.slice(0, 3);
}
// The rival of this campaign is a rival the player has met: identity, rapport, memories and a way of looking at him.
function recognizeRival(campaign, rival, record) {
  const profile = rival.aiProfile;
  const playerId = campaign.playerCandidateId;
  Object.assign(profile, { personality:record.personality ?? profile.personality, interests:record.interests?.length ? record.interests : profile.interests, loyalty:Number(record.loyalty ?? profile.loyalty), initiative:clamp(Number(record.initiative ?? profile.initiative) + (record.relation <= 35 ? .08 : 0), 0, 1), objectives:adaptObjectives(record.objectives?.length ? record.objectives : profile.objectives, record) });
  profile.relationships = { ...(profile.relationships ?? {}), [playerId]:round(clamp(record.relation)) };
  profile.memory = (record.memory ?? []).map((item, index) => ({ id:ids(`memoria-passata-${item.type}`, campaign.seed, index), type:item.type, targetId:playerId, day:0, date:campaign.currentDate, weight:Number(item.weight), valence:RIVAL_MEMORY_TYPES[item.type] ?? 0, fromPast:true, source:SOURCE }));
  rival.relationship = round(clamp(record.relation / 100, 0, 1));
  const stance = stanceOfRelation(record.relation);
  const last = record.last ?? {};
  rival.recognition = { met:record.meetings, stance, relation:round(record.relation), lastMet:record.lastMet, ageDays:record.ageDays ?? 0, beatPlayer:Boolean(last.ahead), lostToPlayer:last.ahead === false, allied:Number(record.record?.allied ?? 0) > 0, betrayed:Number(record.record?.betrayed ?? 0) > 0, source:SOURCE };
  const note = [last.ahead ? 'ti ha battuto' : last.ahead === false ? 'è stato battuto da te' : null, record.record?.allied ? 'siete stati alleati' : null, record.record?.betrayed ? 'ricorda un tradimento' : null, record.record?.attacked ? 'ricorda i tuoi attacchi' : null].filter(Boolean);
  addHistory(campaign, 'rivali', `Ritrovi ${rival.realReference?.fullName ?? candidateLabel(rival)}: non è la prima volta (${record.meetings === 1 ? 'vi siete già incontrati' : `${record.meetings} incontri`}${note.length ? `, ${note.join(', ')}` : ''}). Il rapporto è ${stance}.`, { source:SOURCE });
}

function campaignTerritories(type, player, userTerritories) {
  const playerMunicipality = userTerritories.find(item => item.id === player.territoryId)?.name ?? player.municipality ?? 'Territorio locale';
  if (type === 'comunale') return [{ id:`sim-territory-comune-${hash(playerMunicipality).toString(36)}`, name:playerMunicipality, kind:'comune', weight:100, source:SOURCE, scope:'territorio comunale', organization:30 }];
  // The electorate of a second-level vote: the mayors and the municipal councillors of the province, by the weight of the
  // comune they come from (rules of the game: the bigger comuni weigh more, the small ones are many).
  if (type === 'provinciale') return [
    ['comuni-grandi', 'Comuni sopra i 15.000 abitanti', 44], ['comuni-medi', 'Comuni tra 5.000 e 15.000 abitanti', 33], ['comuni-piccoli', 'Piccoli comuni sotto i 5.000 abitanti', 23]
  ].map(([id,name,weight], index) => ({ id:`sim-provincia-${id}`, name, kind:'fascia-comuni-simulata', urban:index === 0, region:player.region, province:player.province ?? null, weight, source:SOURCE, organization:Math.max(8, 26 - index * 4) }));
  if (type === 'regionale') return [
    ['area-capoluogo', 'Capoluogo e area urbana', 27], ['area-nord', 'Area regionale settentrionale', 25],
    ['area-centro', 'Area regionale centrale', 25], ['area-sud', 'Area regionale meridionale', 23]
  ].map(([id,name,weight], index) => ({ id:`sim-${player.region.toLocaleLowerCase('it-IT').replace(/[^a-z0-9]+/g,'-')}-${id}`, name, kind:'area-regionale-simulata', urban:index === 0, region:player.region, weight, source:SOURCE, organization:Math.max(8, 28 - index * 3) }));
  if (type === 'europee') return [
    ['nord-occidentale','Italia nord-occidentale',26], ['nord-orientale','Italia nord-orientale',20],
    ['centrale','Italia centrale',20], ['meridionale','Italia meridionale',24], ['insulare','Italia insulare',10]
  ].map(([id,name,weight], index) => ({ id:`sim-circoscrizione-${id}`, name, kind:'circoscrizione-di-simulazione', constituency:id, weight, source:SOURCE, organization:Math.max(9,27-index*2) }));
  return ITALIAN_REGIONS.map((name,index) => ({ id:`sim-regione-${index+1}`, name, region:name, kind:'regione', weight:100/ITALIAN_REGIONS.length, source:SOURCE, organization:20 }));
}

function createCandidate({ id, player = false, partyId = null, displayName, seed, stats = {} }) {
  const rand = randomFrom(seed);
  return {
    id, partyId, displayName, displayLabel:displayName, source:SOURCE, isPlayer:player, status:'active', strategy:'territoriale',
    resources:{ money:Math.round(500+rand()*900), volunteers:Math.round(8+rand()*10), organization:Math.round(30+rand()*35), politicalCapital:Math.round(5+rand()*5) },
    campaignStats:player ? { ...stats, momentum:round((rand()-.5)*4), source:SOURCE } : {
      reputation:Math.round(42+rand()*24), notoriety:Math.round(25+rand()*45), experience:Math.round(15+rand()*70),
      influence:Math.round(15+rand()*65), debateReadiness:Math.round(28+rand()*55), momentum:round((rand()-.5)*5), source:SOURCE
    },
    relationship:player ? null : round(rand()), coalitionLeaderId:null, lastAction:'Sta definendo le priorità della campagna.'
  };
}

// ---------- incumbency, strongholds and lists ----------
// The record of the term that ends (see mandateRecord in the local engine), as the campaign lives it: points of consensus at the
// start, what is expected of the result, the weight in the candidacy and in the activities that claim the record.
function buildIncumbency(mandate) {
  const rules = INCUMBENCY_RULES;
  const standing = clamp(Number(mandate.standing), -100, 100);
  const governing = Boolean(mandate.leads) || mandate.side === 'maggioranza';
  const former = Boolean(mandate.former);
  const notes = [];
  if (mandate.leads) notes.push(former ? 'Hai guidato l’amministrazione in passato: gli elettori se lo ricordano ancora.' : 'Sei l’amministratore uscente: il bilancio del mandato pesa sulla tua campagna.');
  else if (governing) notes.push(former ? 'Hai fatto parte della maggioranza in passato.' : 'Sei nella maggioranza uscente: ne condividi i risultati.');
  else notes.push('Sei all’opposizione: i fallimenti dell’amministrazione uscente sono la tua occasione.');
  if (standing >= 15) notes.push(governing ? 'Il mandato è stato giudicato bene: parti con un vantaggio.' : 'L’amministrazione è andata bene: ti è più difficile attaccarla.');
  else if (standing <= -15) notes.push(governing ? 'Il mandato è stato difficile: parti con uno svantaggio.' : 'L’amministrazione ha deluso: il malcontento ti favorisce.');
  return {
    version: 1, kind: mandate.kind ?? null, role: mandate.role ?? null, leads: Boolean(mandate.leads), side: mandate.side ?? null, former, active: !former, governing,
    weeks: Number(mandate.weeks ?? 0), score: Number(mandate.score ?? 0), standing: round(standing),
    start: round(clamp(standing * rules.consensus, -rules.consensusCap, rules.consensusCap)),
    expectation: round(clamp(standing * rules.expectation, -rules.expectationCap, rules.expectationCap)),
    nomination: round(clamp(standing * rules.nomination, -rules.nominationCap, rules.nominationCap)),
    record: { stability: mandate.stability ?? null, pressure: mandate.pressure ?? null, margin: mandate.margin ?? null, kept: mandate.kept ?? 0, broken: mandate.broken ?? 0, failures: mandate.failures ?? 0, servicesDelta: mandate.servicesDelta ?? 0, passed: mandate.passed ?? 0 },
    notes, source: SOURCE
  };
}
// Points of start for the party of each rival, by its weight in the polls compared with the others (zero on average).
function partyEdges(rivals, weights = {}) {
  const parties = rivals.filter(item => item.partyId);
  const values = parties.map(item => Number(weights[item.partyId] ?? 0));
  if (!values.some(value => value > 0)) return {};
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Object.fromEntries(rivals.map(item => [item.id, item.partyId ? round(clamp((Number(weights[item.partyId] ?? 0) - mean) / (mean + 4) * 6, -3.5, 3.5)) : 0]));
}
// Where each rival is from: a stronghold area and how deep the roots go (zero-mean, like the party edge).
function rivalRoots(rivals, areas, seed) {
  const roots = {};
  for (const rival of rivals) {
    const rand = randomFrom(hash(`roots|${seed}|${rival.id}`));
    const area = areas[Math.floor(rand() * areas.length)];
    const strength = round(.3 + rand() * .7);
    roots[rival.id] = { areaId: area.id, strength, edge: round(5 * (strength - .65)) };
    rival.local = { areaId: area.id, strength, source: SOURCE };
  }
  return roots;
}
// The list the player stands in: who stands with him, how strong they are, which faction they come from. The place on the list is a
// political result: it depends on this composition, on the territory, on the currents of the party and on what is negotiated.
// A single-member district (uninominale) has no list: no composition, no place, no preferences against list mates.
const LIST_ROLES = Object.freeze(['consigliere', 'deputato', 'senatore', 'eurodeputato']);
function listQuality(mates) {
  const best = [...mates].filter(item => item.status !== 'ritirato').sort((a, b) => b.strength - a.strength).slice(0, 6);
  return round(clamp(best.reduce((sum, item) => sum + item.strength, 0) / Math.max(1, best.length) - 16, 0, 100));
}
function buildList({ seed, type, role, areas }) {
  if (!LIST_ROLES.includes(role)) return null;
  const rules = LIST_RULES;
  const count = type === 'europee' ? rules.mates.europee : type === 'politiche' ? rules.mates.national : rules.mates.local;
  const rand = randomFrom(hash(`lista|${seed}`));
  const mates = Array.from({ length: count }, (_, index) => ({
    id: ids('lista', seed, index + 1), label: `Candidato di lista ${index + 1}`, strength: round(clamp(66 + (rand() - .5) * 30 - index * 1.6, 25, 95)),
    faction: rules.factions[Math.floor(rand() * rules.factions.length)], areaId: areas[Math.floor(rand() * areas.length)].id, status: 'in-lista', source: SOURCE
  }));
  const quality = listQuality(mates);
  return { version: 1, mates, scouted: 0, concessions: 0, negotiated: 0, quality, baseline: quality, source: SOURCE };
}

// Where the composition of the list, the territory, the currents of the party and the weight of the candidacy would put the player:
// the number of names that count more than he does, and the places that follow.
export function listStanding(campaign) {
  const list = campaign.list;
  if (!list) return null;
  const ctx = campaign.listContext ?? {};
  const stats = campaign.candidateStats ?? {};
  const own = Number(campaign.nomination?.internalSupport ?? 5) * 4 + Number(stats.influence ?? 20) * .25 + Number(ctx.territorial ?? 50) * .12 + Number(ctx.bias ?? 0) * 3 + (campaign.candidacy?.incumbent ? 6 : 0) + Number(list.concessions ?? 0) * 1.5;
  // The party places its own people first: the leaders' names count a little more for the places than for the preferences.
  const ahead = list.mates.filter(item => item.status !== 'ritirato' && mateForce(campaign, item) * .5 + (item.faction === 'dirigenti' ? 4 : 0) > own).length;
  return { own:round(own), ahead, rank:1 + ahead, quality:round(list.quality ?? 0), baseline:round(list.baseline ?? list.quality ?? 0), mates:list.mates.length, source:SOURCE };
}
// Points of share a better (or worse) list than the one the party would have drawn up on its own brings to the player.
function listEdge(campaign) {
  const list = campaign.list;
  if (!list) return 0;
  return round(clamp((Number(list.quality ?? 0) - Number(list.baseline ?? list.quality ?? 0)) * LIST_RULES.strength.vote, -LIST_RULES.strength.voteCap, LIST_RULES.strength.voteCap));
}
const obligationOf = (campaign, kind, to, text, extra = {}) => {
  campaign.obligations = [...(campaign.obligations ?? []), { id:ids(`obbligo-${kind}`, campaign.seed, (campaign.obligations?.length ?? 0) + campaign.day), kind, to, text, since:campaign.day, date:campaign.currentDate, weight:1, source:SOURCE, ...extra }];
  return campaign.obligations.at(-1);
};
// Looking for names for the list: among the people of the territory there are strong ones, who bring votes (and compete with the player
// for the preferences), and weak ones, who bring nothing. Whoever is displaced, and the faction he belongs to, does not forget it.
function scoutCandidates(campaign, player, modifiers, area) {
  const list = campaign.list;
  if (!list) return 'Questa candidatura non passa per una lista.';
  const crew = modifiers.crew ?? 1;
  const found = round(clamp(48 + draw(campaign) * 34 * crew + Number(area?.localTrend ?? 0) * 2 + (Number(player.resources.organization ?? 30) - 30) * .1, 30, 92));
  const weakest = list.mates.filter(item => item.status !== 'ritirato').reduce((low, item) => !low || item.strength < low.strength ? item : low, null);
  list.scouted = (list.scouted ?? 0) + 1;
  if (!weakest || found <= weakest.strength + 2) return `Il nome trovato (${Math.round(found)}) non migliora la lista: la ricerca non porta nulla.`;
  const index = list.mates.indexOf(weakest);
  const factions = LIST_RULES.factions;
  const faction = factions[Math.floor(draw(campaign) * factions.length)];
  list.mates[index] = { ...weakest, id:ids('lista', campaign.seed, 100 + list.scouted), label:`Candidato scovato sul territorio ${list.scouted}`, strength:found, faction, areaId:area?.id ?? weakest.areaId, status:'in-lista', scouted:true, source:SOURCE };
  list.quality = listQuality(list.mates);
  const strong = found >= 68;
  const cost = [];
  // The faction of the name that is pushed out feels it; a strong newcomer from the leaders' side takes room from the others.
  if (weakest.faction === 'dirigenti' || (strong && faction === 'dirigenti')) {
    if (campaign.nomination.status === 'pending') campaign.nomination.internalSupport = round(clamp(campaign.nomination.internalSupport - .3, 0, 10));
    obligationOf(campaign, 'lista', 'dirigenti', 'Un nome vicino ai dirigenti è stato escluso dalla lista per far posto a una scelta tua.', { faction:'dirigenti', weight:.6 });
    cost.push('i dirigenti non gradiscono');
  }
  if (strong) campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation + .15));
  // The territory is pleased to see a local name on the list.
  const praised = strong && faction === 'territorio' && campaign.nomination.status === 'pending';
  if (praised) campaign.nomination.internalSupport = round(clamp(campaign.nomination.internalSupport + .25, 0, 10));
  return strong
    ? `Un nome forte (${Math.round(found)}) entra in lista${cost.length ? `, ma ${cost.join(' e ')}` : ''}: la lista guadagna, ma farà concorrenza anche a te nelle preferenze.${praised ? ' Il territorio apprezza un nome locale.' : ''}`
    : `Un nome discreto (${Math.round(found)}) entra in lista al posto di uno più debole${cost.length ? `, ma ${cost.join(' e ')}` : ''}.`;
}
// The place on the list is negotiated: who counts in the party and on the territory asks for room, and every concession has a price.
function negotiateList(campaign, player, modifiers) {
  const list = campaign.list;
  const standing = listStanding(campaign);
  if (!list || !standing) return 'Non c’è una lista su cui trattare.';
  const ctx = campaign.listContext ?? {};
  const odds = clamp((.35 + Number(campaign.candidateStats.influence ?? 20) / 250 + Number(campaign.nomination.internalSupport ?? 5) * .02 + Number(ctx.bias ?? 0) * .08 + (Number(player.resources.politicalCapital ?? 0) > 6 ? .05 : 0) - Number(list.concessions ?? 0) * .07) * Math.min(1, modifiers.repetition ?? 1) * (modifiers.crew ?? 1), .1, .85);
  list.negotiated = (list.negotiated ?? 0) + 1;
  const place = campaign.nomination.status === 'approved' ? campaign.candidacy.listPosition : campaign.nomination.listPosition;
  if (draw(campaign) >= odds) {
    campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation - .25));
    if (campaign.nomination.status === 'pending') campaign.nomination.internalSupport = round(clamp(campaign.nomination.internalSupport - .2, 0, 10));
    return 'La trattativa sulla lista si arena: nessuno vuole fare un passo indietro e il rapporto con chi hai provato a spostare si raffredda.';
  }
  const gained = place > 2 && draw(campaign) < .3 ? 2 : 1;
  const next = Math.max(1, place - gained);
  campaign.nomination.listPosition = next;
  if (campaign.nomination.status === 'approved') campaign.candidacy.listPosition = next;
  list.concessions = (list.concessions ?? 0) + 1;
  const giver = ['dirigenti', 'territorio', 'giovani', 'liste-civiche'].map(faction => ({ faction, strength:list.mates.filter(item => item.faction === faction).reduce((sum, item) => sum + item.strength, 0) })).sort((a, b) => b.strength - a.strength)[0];
  if (campaign.nomination.status === 'pending') campaign.nomination.internalSupport = round(clamp(campaign.nomination.internalSupport - LIST_RULES.negotiation.cost.loyal, 0, 10));
  obligationOf(campaign, 'lista', giver.faction, `Hai ottenuto un posto migliore in lista: chi ha ceduto (${giver.faction.replace('-', ' ')}) si aspetta qualcosa in cambio.`, { faction:giver.faction, weight:gained });
  return `Posto migliore in lista: ora al numero ${next}. Chi ha ceduto (${giver.faction.replace('-', ' ')}) si aspetta qualcosa in cambio.`;
}

// Who a person of the real Parliament stands for in a roster: the force whose name his group's name resembles.
const normalizedName = text => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT');
const NAME_STOP = new Set(['di', 'e', 'per', 'le', 'la', 'il', 'lo', 'con', 'al', 'del', 'della', 'dei', 'gruppo', 'misto', 'italia', 'partito', 'movimento', 'alleanza', 'presidente', 'premier']);
const nameTokens = text => new Set(normalizedName(text).split(/[^a-z0-9]+/).filter(word => word.length > 2 && !NAME_STOP.has(word)));
function forceOfGroup(groupName, slots) {
  const own = nameTokens(groupName);
  if (!own.size) return null;
  const scored = slots.map(slot => { const other = nameTokens(slot.officialName ?? slot.name); const common = [...own].filter(word => other.has(word)).length; return { slot, score: other.size ? common / Math.min(own.size, other.size) : 0, common }; }).filter(item => item.common >= 1 && item.score >= .5).sort((a, b) => b.score - a.score || a.slot.id.localeCompare(b.slot.id));
  return scored[0]?.slot ?? null;
}
const partyKindOf = source => source === 'user' ? 'utente' : source === 'simulation' ? 'simulata' : 'reale';
// Plausible rivals. In a general or a European election they are the forces that stand in that vote (the roster the world gives: the forces the polls
// measure, the ones under observation, the ones that stood last time, the regional ones of the place): the very ids of the polls, one candidacy per
// force, in the order of their weight. In a local vote they are drawn, seeded by the kind of election, the date and the place (two territories do
// not have the same field): active parties only, regional parties only in their own region, the forces with more weight in the polls more often than the
// small ones, the real parties the polls do not measure at their small weight, and now and then a candidacy without a party, declared independent
// (never a made-up party: a simulated candidate belongs to a real force, to a force of the player or to nobody).
function buildOpponents(partyId, catalog, seed, count = 3, realCandidates = [], { type = null, region = null, weights = {}, roster = null, place = null, independents = 0, excluded = [] } = {}) {
  const placeKey = place ? `${place.municipalityCode ?? place.municipality ?? ''}|${place.region ?? region ?? ''}` : null;
  const rand = randomFrom(placeKey ? (seed ^ 0x5bd1e995) ^ pollHash(placeKey) : seed ^ 0x5bd1e995);
  const home = regionIdOf(region);
  const national = ['politiche', 'europee'].includes(type) && roster?.participants?.some(item => !item.isPlayer && item.id !== partyId);
  let slots = [];
  if (national) {
    slots = roster.participants.filter(item => !item.isPlayer && item.id !== partyId).map(item => ({ id: item.id, officialName: item.officialName ?? item.label, name: item.label, abbreviation: item.abbreviation ?? null, source: item.refSource ?? 'real', rosterReason: item.reason, surveyed: item.surveyed, rosterShare: item.share, regional: item.regional }));
  } else {
    const out = new Set(excluded);
    const pool = catalog.filter(item => item?.id && item.id !== partyId && !out.has(item.id) && (item.source === 'real' || item.source === 'simulation' || item.source === 'user')
        && !['historical', 'inactive', 'sciolto'].includes(item.status) && !item.adminHidden && !item.sameEntityAs
        && (!item.regionId || item.regionId === home))
      .sort((a,b) => String(a.id).localeCompare(String(b.id)));
    const parties = [];
    while (pool.length) {
      const weightOf = item => Math.max(.3, Number(weights[item.id] ?? 0)) + (item.parliamentaryPresence ? 1 : 0) + (item.regionId && item.regionId === home ? 2 : 0);
      const total = pool.reduce((sum, item) => sum + weightOf(item), 0);
      let pick = rand() * total;
      const index = Math.max(0, pool.findIndex(item => (pick -= weightOf(item)) < 0));
      parties.push(pool.splice(index, 1)[0]);
    }
    slots = Array.from({ length: count }, (_, index) => parties[index % Math.max(1, parties.length)] ?? null).map(item => item ? { id: item.id, officialName: item.officialName ?? item.name, name: item.name ?? item.officialName, abbreviation: item.abbreviation ?? null, source: item.source, rosterReason: weights[item.id] > 0 ? 'rilevata' : item.regionId && item.regionId === home ? 'presenza-regionale' : 'non-rilevata', surveyed: Number(weights[item.id] ?? 0) > 0, regional: Boolean(item.regionId) } : null);
    // A candidacy without a party: a civic list or an independent, for as many slots as the kind of election gives (at most one fewer than the field).
    const free = clamp(Math.round(independents), 0, Math.max(0, slots.length - 1));
    for (let index = 0; index < free; index++) slots[slots.length - 1 - index] = { independent: true };
  }
  // A real parliamentarian stands for the force his group resembles (his party): his identity is verified, the numbers are simulated. In a vote
  // without a roster he stands for no party, as before; one whose group matches no force of the roster is not made a rival of its own.
  const matched = new Map();
  if (national) for (const person of realCandidates) { const slot = forceOfGroup(person.groupName ?? person.electedOnList, slots.filter(item => !item.independent && !matched.has(item.id))); if (slot) matched.set(slot.id, person); }
  const candidates = [];
  slots.forEach((slot, index) => {
    const candidateId = ids('candidatura-simulata',seed,index+1);
    const person = national ? matched.get(slot.id) : realCandidates[index];
    const rivalSeed = seed + index * 97;
    const aiProfile = profileForCandidate(seed, candidateId, index, type);
    const party = slot?.independent ? null : slot;
    const trace = party ? { partyKind: partyKindOf(party.source), rosterReason: party.rosterReason ?? null, surveyed: party.surveyed ?? null } : { partyKind: 'indipendente', independent: true, rosterReason: 'indipendente', surveyed: false };
    if (person) candidates.push({ ...createCandidate({ id:candidateId, partyId:national ? party?.id ?? null : null, displayName:person.fullName, seed:rivalSeed }), aiProfile, ...(national && party ? { partyLabel:party.officialName ?? party.name ?? null, partyAbbreviation:party.abbreviation ?? null } : {}), ...trace, realReference:{ politicianId:person.id, fullName:person.fullName, chamber:person.chamber, groupId:person.groupId ?? null, groupName:person.groupName ?? null, electedOnList:person.electedOnList ?? null, circoscription:person.circoscription ?? null, sourceUrl:person.sourceUrl, sourceName:person.sourceName, source:'real', verified:true } });
    else if (slot?.independent) candidates.push({ ...createCandidate({ id:candidateId, partyId:null, displayName:`Candidatura indipendente simulata ${index+1}`, seed:rivalSeed }), aiProfile, ...trace });
    else candidates.push({ ...createCandidate({ id:candidateId, partyId:party?.id ?? null, displayName:`Candidatura simulata ${index+1}`, seed:rivalSeed }), aiProfile, partyLabel:party?.officialName ?? party?.name ?? null, partyAbbreviation:party?.abbreviation ?? null, ...trace });
  });
  return candidates;
}

// How many rival candidacies run against the player, by kind of election.
export const RIVALS_BY_TYPE = Object.freeze({ comunale:{ small:3, default:4 }, provinciale:{ default:3 }, regionale:{ default:4 }, politiche:{ default:5 }, europee:{ default:6 } });
const candidateLabel = candidate => candidate.realReference?.fullName ?? (candidate.partyAbbreviation || candidate.partyLabel ? `la candidatura di ${candidate.partyAbbreviation || candidate.partyLabel}` : candidate.displayName);
// The opening of the race, area by area: what the candidate is (name, standing), where he is from (roots, strongholds), what his party is
// worth there (the lean of each area for each party, the weight of the party in the polls) and what the term he served left behind.
// `extra` are points per candidate (the record of an incumbent), `edges` the party weight, `roots` the strongholds of the rivals, `homeExtra`
// what the roots of the player (his territorial reputation, the committees) add at home. All of them are zero-mean among the rivals, so
// a field without data starts as it always did.
function initSupport(areas, candidates, player, seed, { extra = {}, edges = {}, roots = {}, homeExtra = 0, spread = 1.6, anchors = {}, rooted = false } = {}) {
  const rand = randomFrom(seed ^ 0x7f4a7c15);
  for (const area of areas) {
    const strengths = candidates.map((candidate,index) => {
      const stats = candidate.campaignStats;
      const foundation = candidate.isPlayer
        ? 12 + Number(stats.popularity ?? 42)*.14 + Number(stats.notoriety ?? 20)*.07 + Number(stats.influence ?? 14)*.055 + Number(stats.experience ?? 18)*.04
        : 15 + Number(stats.notoriety ?? 35)*.08 + Number(stats.influence ?? 30)*.05 + Number(stats.experience ?? 35)*.035;
      // A race the party fields a candidate in (a territory that may not be his own) gives its own rooting: the candidate's points (config.rooting) replace the boost of the home.
      const territoryBoost = candidate.isPlayer && !rooted && (area.name === player.municipality || area.region === player.region) ? 3.2 + homeExtra : 0;
      const stronghold = roots[candidate.id]?.areaId === area.id ? roots[candidate.id].edge : 0;
      // The lean of the area for the party of the candidate: it differs from area to area, never on average.
      const lean = areas.length > 1 ? (randomFrom(hash(`lean|${seed}|${area.id}|${candidate.partyId ?? candidate.id}`))() - .5) * 2 * spread : 0;
      const anchor = Number(anchors[candidate.id]);
      if (Number.isFinite(anchor)) {
        // A general or European vote: the force starts from its weight in the polls (what the institutes measure), moved by the quality of the candidate and by
        // the lean of the area; the points of the local campaign scale with the size of the force, so a force of 0,3% does not start with the room of one of 20%.
        const size = clamp(anchor / 12, .04, 1);
        const quality = clamp((foundation - 20) / 100, -.25, .35);
        return Math.max(.03, anchor * (1 + quality) + size * (territoryBoost + stronghold + lean + Number(extra[candidate.id] ?? 0) + (candidate.campaignStats.momentum??0)*.55 + (area.localTrend??0)*.8 + (rand()*7 - 3.5)));
      }
      return Math.max(4, foundation + territoryBoost + stronghold + lean + Number(extra[candidate.id] ?? 0) + Number(edges[candidate.id] ?? 0) + (candidate.campaignStats.momentum??0)*.55 + (area.localTrend??0)*.8 + rand()*7 + area.organization*.015);
    });
    const shares = normalized(strengths);
    area.supportByCandidate = Object.fromEntries(candidates.map((candidate,index) => [candidate.id,shares[index]]));
  }
}

function addHistory(campaign, type, text, extra = {}) {
  campaign.history.unshift({ id:ids('azione',campaign.seed,campaign.history.length+campaign.day), day:campaign.day, date:campaign.currentDate, type, text, source:SOURCE, ...extra });
  campaign.history = campaign.history.slice(0,60);
}
function moveSupport(campaign, candidateId, delta, areaId = null) {
  const areas = areaId ? campaign.territories.filter(item => item.id === areaId) : campaign.territories;
  if (!areas.length || !delta) return;
  for (const area of areas) {
    const shares = area.supportByCandidate;
    const own = Number(shares[candidateId] ?? 0);
    const actual = Math.min(Math.max(-own + .01, delta), Object.keys(shares).length > 1 ? (campaign.anchored ? Math.min(4, Math.max(.05, own * .6)) : 4) : 0);
    const others = Object.keys(shares).filter(id => id !== candidateId && campaign.candidates.find(item => item.id === id)?.status === 'active');
    const othersTotal = others.reduce((sum,id) => sum + Number(shares[id] ?? 0),0);
    if (!others.length || !othersTotal) continue;
    shares[candidateId] = round(clamp(own + actual,0,100));
    for (const id of others) shares[id] = round(clamp(Number(shares[id]) - actual*Number(shares[id])/othersTotal,0,100));
    const sum = Object.values(shares).reduce((total,value)=>total+value,0);
    const diff = round(100-sum);
    if (diff) shares[others[0]] = round(clamp(shares[others[0]]+diff,0,100));
  }
}
// Votes that move from one candidate to another (a comparison, an attack, a gaffe): the others are not touched.
function transferSupport(campaign, fromId, toId, delta, areaId = null) {
  const areas = areaId ? campaign.territories.filter(item => item.id === areaId) : campaign.territories;
  for (const area of areas) {
    const shares = area.supportByCandidate;
    if (!(fromId in shares) || !(toId in shares)) continue;
    const amount = delta >= 0 ? Math.min(delta, Math.max(0, Number(shares[fromId]) - .5)) : -Math.min(-delta, Math.max(0, Number(shares[toId]) - .5));
    shares[fromId] = round(Number(shares[fromId]) - amount);
    shares[toId] = round(Number(shares[toId]) + amount);
  }
}
// How much a campaign can move: what the player does counts, but less and less as the gains pile up (the first
// points come easily, then every point costs more). A strong campaign is worth a few points, never a landslide.
const IMPACT_SCALE = Object.freeze({ comunale:.42, provinciale:.4, regionale:.5, politiche:.6, europee:.6 });
const ELASTICITY = Object.freeze({ comunale:5, provinciale:5, regionale:4.5, politiche:3.5, europee:3.5 });
function playerMove(campaign, delta, areaId = null) {
  const player = campaign.candidates.find(item => item.isPlayer);
  if (!player || !delta) return 0;
  const scale = IMPACT_SCALE[campaign.electionType] ?? .5;
  const elastic = delta > 0 ? 1 / (1 + Math.max(0, campaign.gained ?? 0) / (ELASTICITY[campaign.electionType] ?? 4)) : 1;
  const before = weightedShare(campaign, player.id);
  moveSupport(campaign, player.id, delta * scale * elastic, areaId);
  const gained = weightedShare(campaign, player.id) - before;
  campaign.gained = round((campaign.gained ?? 0) + gained);
  return gained;
}
function playerTransfer(campaign, fromId, delta, areaId = null) {
  const player = campaign.candidates.find(item => item.isPlayer);
  if (!player || !delta) return 0;
  const scale = IMPACT_SCALE[campaign.electionType] ?? .5;
  const elastic = delta > 0 ? 1 / (1 + Math.max(0, campaign.gained ?? 0) / (ELASTICITY[campaign.electionType] ?? 4)) : 1;
  const before = weightedShare(campaign, player.id);
  transferSupport(campaign, fromId, player.id, delta * scale * elastic, areaId);
  const gained = weightedShare(campaign, player.id) - before;
  campaign.gained = round((campaign.gained ?? 0) + gained);
  return gained;
}
// A candidate leaves the race: part of his voters follow his indication, the others scatter among those who remain, in proportion.
function releaseSupport(campaign, fromId, toId, rate) {
  for (const area of campaign.territories) {
    const shares = area.supportByCandidate;
    const votes = Number(shares[fromId] ?? 0);
    if (!votes) continue;
    const others = Object.keys(shares).filter(id => id !== fromId && id !== toId && campaign.candidates.find(item => item.id === id)?.status === 'active');
    const total = others.reduce((sum, id) => sum + Number(shares[id] ?? 0), 0);
    const kept = toId in shares ? votes * rate : 0;
    shares[toId] = round(Number(shares[toId] ?? 0) + kept);
    for (const id of others) shares[id] = round(Number(shares[id]) + (votes - kept) * (total ? Number(shares[id]) / total : 1 / others.length));
    shares[fromId] = 0;
    const alive = Object.keys(shares).filter(id => id !== fromId && campaign.candidates.find(item => item.id === id)?.status !== 'withdrawn');
    const sum = alive.reduce((acc, id) => acc + Number(shares[id] ?? 0), 0) || 1;
    for (const id of alive) shares[id] = round(Number(shares[id]) * 100 / sum);
  }
}
// A coalition is not a sum: part of the partner's voters does not follow the agreement and votes elsewhere.
function mergeAlliance(campaign, leaderId, partner) {
  const rate = clamp(.55 + Number(partner.relationship ?? .5) * .3, .55, .85);
  for (const area of campaign.territories) {
    const shares = area.supportByCandidate;
    const partnerShare = Number(shares[partner.id] ?? 0);
    const lost = partnerShare * (1 - rate);
    shares[partner.id] = round(partnerShare * rate);
    const others = Object.keys(shares).filter(id => id !== partner.id && id !== leaderId && campaign.candidates.find(item => item.id === id)?.status === 'active');
    const total = others.reduce((sum, id) => sum + Number(shares[id] ?? 0), 0);
    if (!others.length || !total) { shares[leaderId] = round(Number(shares[leaderId] ?? 0) + lost); continue; }
    for (const id of others) shares[id] = round(Number(shares[id]) + lost * Number(shares[id]) / total);
  }
  return round(rate);
}
function resourceAffordable(resources,cost) {
  return Object.entries(cost ?? {}).every(([name,value]) => Number(resources[name] ?? 0) >= Number(value ?? 0));
}
function charge(resources,cost) {
  for (const [name,value] of Object.entries(cost ?? {})) resources[name] = Math.max(0,Number(resources[name] ?? 0)-Number(value ?? 0));
}
function supportAt(campaign, territoryId, candidateId = campaign.playerCandidateId) {
  return Number(campaign.territories.find(area=>area.id===territoryId)?.supportByCandidate?.[candidateId] ?? 0);
}
function weightedShare(campaign, candidateId) {
  const total = campaign.territories.reduce((sum, area) => sum + area.weight, 0) || 1;
  return campaign.territories.reduce((sum, area) => sum + Number(area.supportByCandidate?.[candidateId] ?? 0) * area.weight, 0) / total;
}
function targetArea(campaign, requestedId) { return campaign.territories.find(item=>item.id===requestedId) ?? campaign.territories[0]; }
function activeOpponents(campaign) { return campaign.candidates.filter(item=>!item.isPlayer&&item.status==='active'); }
function strongestRival(campaign) { return [...activeOpponents(campaign)].sort((a, b) => weightedShare(campaign, b.id) - weightedShare(campaign, a.id))[0] ?? null; }
function pendingEvent(campaign, kind, title, body, choices) {
  if (campaign.pendingEvents.length) return;
  campaign.pendingEvents.push({ id:ids('evento-campagna',campaign.seed,campaign.day), kind, title, body, choices, day:campaign.day, date:campaign.currentDate, source:SOURCE });
}

// ---------- phases and strategies ----------
const NEUTRAL_STRATEGY = Object.freeze({ id:null, label:'Nessuna strategia dichiarata', short:'Libera', mods:{territory:1,internal:1,event:1,media:1,ads:1,resources:1}, risk:1, volatility:1 });
export function strategyOf(campaign) {
  const id = campaign?.strategy?.id;
  return id && CAMPAIGN_STRATEGIES[id] ? { ...CAMPAIGN_STRATEGIES[id], id } : NEUTRAL_STRATEGY;
}
export function campaignPhase(campaign) { return phaseOf(campaign.day, campaign.totalDays, campaign.stage); }
// The strategies that can be declared in a stage: those of the runoff exist only between the two rounds.
export const strategyStages = id => CAMPAIGN_STRATEGIES[id]?.stages ?? ['campagna', 'ballottaggio'];
export const strategyAvailable = (campaign, id) => Boolean(CAMPAIGN_STRATEGIES[id]) && strategyStages(id).includes(campaign.stage ?? 'campagna');
// How well a strategy suits the situation: none is always the best. The same choice that wins a close local race
// wastes a national one; attacking a distant rival is pointless; a lead is defended, a gap needs new voters.
export function strategyFit(campaign, id, { topicId = null, targetId = null } = {}) {
  const own = weightedShare(campaign, campaign.playerCandidateId);
  const rival = strongestRival(campaign);
  const gap = rival ? weightedShare(campaign, rival.id) - own : -10;
  const type = campaign.electionType;
  const stats = campaign.candidateStats ?? {};
  const player = campaign.candidates.find(item => item.isPlayer);
  if (id === 'consolidare') return gap <= 0 ? 1.14 : gap < 5 ? 1 : .8;
  if (id === 'nuovi') return gap > 8 ? 1.28 : gap > 0 ? 1.08 : .82;
  if (id === 'territorio') return round(({ comunale:1.2, provinciale:1.15, regionale:1.08, politiche:.88, europee:.8 })[type] * (.9 + clamp(player?.resources?.organization ?? 30, 0, 100) / 300));
  if (id === 'media') return round(({ comunale:.86, provinciale:.7, regionale:1, politiche:1.12, europee:1.16 })[type] * (.82 + clamp(stats.notoriety ?? 20, 0, 100) / 220));
  if (id === 'temi') return (topicId ?? campaign.strategy?.topicId) === campaign.nationalContext?.salientTopic ? 1.25 : .88;
  if (id === 'contrasto') {
    const target = campaign.candidates.find(item => item.id === (targetId ?? campaign.strategy?.targetId)) ?? rival;
    const distance = target ? Math.abs(weightedShare(campaign, target.id) - own) : 20;
    return round((distance < 6 ? 1.16 : distance < 12 ? 1 : .78) * ((stats.reputation ?? 50) < 45 ? .9 : 1));
  }
  if (id === 'coalizione') return (campaign.alliances ?? []).some(item => item.status === 'active' && item.leaderCandidateId === campaign.playerCandidateId) ? 1.14 : own < 12 ? 1.02 : .92;
  // The runoff: apparentamenti pay when there are candidates who are out and well disposed, the mobilisation when the machine is strong,
  // the useful vote when the other finalist is disliked by the voters who are out.
  if (['apparentamenti', 'mobilitazione', 'voto-utile'].includes(id) && campaign.runoff) {
    const finalists = finalistsOf(campaign);
    const other = finalists.find(item => !item.isPlayer);
    const out = campaign.candidates.filter(item => item.status === 'eliminated' && !item.isPlayer);
    const relation = out.length && player ? out.reduce((sum, item) => sum + relationToFinalist(campaign, item, player), 0) / out.length : 50;
    const dislike = out.length && other ? out.reduce((sum, item) => sum + (100 - relationToFinalist(campaign, item, other)), 0) / out.length : 50;
    if (id === 'apparentamenti') return round(clamp(.8 + out.length * .08 + (relation - 50) / 200, .8, 1.25));
    if (id === 'mobilitazione') return round(clamp(1 + mobilizationOf(campaign, player, 'ballottaggio') * .3, .8, 1.25));
    return round(clamp(.88 + (dislike - 50) / 150, .8, 1.2));
  }
  return 1;
}
// ---------- the crew: teams of volunteers with a quality and a fatigue ----------
// Each team serves some kinds of activity (CREW_TEAMS). A team that is poorly trained or tired yields less, with diminishing
// returns, and past the burnout threshold it loses people; rest and rotation bring the fatigue down. A campaign without a crew
// (a saved one, a test) is neutral: quality 50, no fatigue, efficiency 1.
const teamOfActivity = activity => Object.entries(CREW_TEAMS).find(([, team]) => team.categories.includes(activity.category))?.[0] ?? 'office';
function newCrew(stats = {}, { quality = null, fieldEdge = 0, organization = 30 } = {}) {
  const edge = { field:clamp(Number(fieldEdge), -10, 10), media:clamp((Number(stats.notoriety ?? 30) - 30) * .12, -8, 8), events:clamp((Number(organization) - 30) * .1, -8, 8), office:clamp((Number(stats.influence ?? 30) - 30) * .1, -8, 8) };
  return {
    version:1, quality:clamp(Number(quality ?? CREW_RULES.quality.base), CREW_RULES.quality.min, CREW_RULES.quality.max), gotv:0, burnouts:0, lost:0, trained:0, rested:0,
    teams:Object.fromEntries(Object.entries(CREW_TEAMS).map(([id, team]) => [id, { id, share:team.share, edge:round(edge[id]), fatigue:0, busyUntil:-1 }])), source:SOURCE
  };
}
function ensureCrew(campaign) {
  const player = campaign.candidates?.find(item => item.isPlayer);
  if (!campaign.crew || typeof campaign.crew !== 'object') campaign.crew = newCrew(campaign.candidateStats ?? {}, { organization:player?.resources?.organization });
  const crew = campaign.crew;
  crew.teams = crew.teams && typeof crew.teams === 'object' ? crew.teams : {};
  for (const [id, team] of Object.entries(CREW_TEAMS)) crew.teams[id] = { id, share:team.share, edge:0, fatigue:0, busyUntil:-1, ...(crew.teams[id] ?? {}) };
  return crew;
}
// The quality a crew starts with (committees, programmes, the civic network) and the strength of the local network of the field team.
export function applyCrewProfile(campaign, { quality = null, fieldEdge = null } = {}) {
  const crew = ensureCrew(campaign);
  if (quality !== null) crew.quality = round(clamp(Number(quality), CREW_RULES.quality.min, CREW_RULES.quality.max));
  if (fieldEdge !== null) crew.teams.field.edge = round(clamp(Number(fieldEdge), -10, 10));
  return campaign;
}
export function crewEfficiency(campaign, teamId) {
  const team = campaign?.crew?.teams?.[teamId];
  if (!team) return 1;
  const { quality: q, fatigue: f } = CREW_RULES;
  const quality = clamp(Number(campaign.crew.quality ?? q.base) + Number(team.edge ?? 0), q.min, q.max);
  const tired = Math.max(f.floor, 1 - Math.max(0, Number(team.fatigue ?? 0) - f.free) * f.slope);
  return round((q.floor + quality * q.perPoint) * tired);
}
// The crew as the interface shows it: size, quality and fatigue of each team, and whether the campaign is running on empty.
export function crewOf(campaign) {
  const player = campaign.candidates?.find(item => item.isPlayer);
  const crew = campaign.crew ?? newCrew(campaign.candidateStats ?? {}, { organization:player?.resources?.organization });
  const volunteers = Number(player?.resources?.volunteers ?? 0);
  const view = { ...campaign, crew:{ ...crew, teams:Object.fromEntries(Object.entries(CREW_TEAMS).map(([id, team]) => [id, { id, share:team.share, edge:0, fatigue:0, ...(crew.teams?.[id] ?? {}) }])) } };
  const teams = Object.entries(CREW_TEAMS).map(([id, def]) => {
    const team = view.crew.teams[id];
    return { id, label:def.label, short:def.short, size:Math.round(volunteers * team.share), quality:round(clamp(crew.quality + team.edge, CREW_RULES.quality.min, CREW_RULES.quality.max)), fatigue:round(team.fatigue), efficiency:crewEfficiency(view, id) };
  });
  const peak = Math.max(0, ...teams.map(team => team.fatigue));
  const average = round(teams.reduce((sum, team) => sum + team.fatigue * CREW_TEAMS[team.id].share, 0));
  return { quality:round(crew.quality), volunteers, teams, peak:round(peak), average, tired:peak >= CREW_RULES.fatigue.tired, burnouts:crew.burnouts ?? 0, lost:crew.lost ?? 0, gotv:round(crew.gotv ?? 0), source:SOURCE };
}
// What an activity costs the team that does it: more days, more volunteers and organisation mean more load; a big team spreads
// it, a well-organised campaign tires less.
function crewLoad(campaign, player, activity, teamId) {
  const { fatigue: f } = CREW_RULES;
  const cost = activity.cost ?? {};
  const raw = activity.days * (f.load.base + Number(cost.volunteers ?? 0) * f.load.volunteer + Number(cost.organization ?? 0) * f.load.organization);
  const size = Math.max(1, Number(player.resources.volunteers ?? 0) * (campaign.crew.teams[teamId]?.share ?? .25));
  // The pace of the campaign (an aggressive strategy is a frantic one) is part of the load, like the size of the team and the organisation behind it.
  const pace = clamp(1 + (Number(strategyOf(campaign).risk ?? 1) - 1) * .4, .85, 1.15);
  return round(raw * pace * clamp(f.size / size, .5, 2.2) * clamp(1.25 - Number(player.resources.organization ?? 30) / 200, .7, 1.2));
}
function restCrew(campaign, days, factor = 1) {
  const crew = ensureCrew(campaign);
  const player = campaign.candidates.find(item => item.isPlayer);
  const gain = CREW_RULES.fatigue.restRecovery * days * factor * (.8 + clamp(Number(player?.resources?.organization ?? 30), 0, 100) / 150);
  for (const team of Object.values(crew.teams)) team.fatigue = round(clamp(Number(team.fatigue ?? 0) - gain));
  crew.rested = (crew.rested ?? 0) + days;
}
// A day goes by: the teams that did not work recover, those that did only a little.
function crewDay(campaign) {
  const crew = campaign.crew;
  if (!crew?.teams) return;
  const player = campaign.candidates.find(item => item.isPlayer);
  const organization = .8 + clamp(Number(player?.resources?.organization ?? 30), 0, 100) / 150;
  for (const team of Object.values(crew.teams)) {
    const working = campaign.day <= Number(team.busyUntil ?? -1);
    team.fatigue = round(clamp(Number(team.fatigue ?? 0) - (working ? CREW_RULES.fatigue.workRecovery : CREW_RULES.fatigue.idleRecovery) * organization));
  }
}
// A week: the crew learns while it is not exhausted; an exhausted team loses people, who are replaced by novices.
function crewWeek(campaign) {
  const crew = campaign.crew;
  const player = campaign.candidates.find(item => item.isPlayer);
  if (!crew?.teams || !player || player.status === 'eliminated') return;
  const f = CREW_RULES.fatigue;
  const peak = Math.max(...Object.values(crew.teams).map(team => Number(team.fatigue ?? 0)));
  if (peak < f.tired && (crew.learned ?? 0) < CREW_RULES.quality.learnCap) {
    crew.quality = round(clamp(crew.quality + CREW_RULES.quality.learnPerWeek, CREW_RULES.quality.min, CREW_RULES.quality.max));
    crew.learned = round((crew.learned ?? 0) + CREW_RULES.quality.learnPerWeek);
  }
  for (const [id, team] of Object.entries(crew.teams)) {
    if (Number(team.fatigue ?? 0) < f.burnout) continue;
    const lost = Math.max(1, Math.round(Number(player.resources.volunteers ?? 0) * team.share * f.attrition));
    if (Number(player.resources.volunteers ?? 0) <= 0) continue;
    player.resources.volunteers = Math.max(0, Number(player.resources.volunteers) - lost);
    player.resources.organization = clamp(Number(player.resources.organization ?? 0) - 1, 0, 100);
    crew.quality = round(clamp(crew.quality - CREW_RULES.quality.burnoutLoss, CREW_RULES.quality.min, CREW_RULES.quality.max));
    crew.burnouts = (crew.burnouts ?? 0) + 1; crew.lost = (crew.lost ?? 0) + lost;
    team.fatigue = round(Math.max(0, team.fatigue - 18));
    campaign.resources = { ...campaign.resources, ...player.resources, visibility:campaign.resources.visibility };
    addHistory(campaign, 'squadre', `${CREW_TEAMS[id].label} allo stremo: ${lost} ${lost === 1 ? 'volontario molla' : 'volontari mollano'} e il gruppo perde esperienza.`);
  }
}

// How much the record of the term that ends is worth to the activities that talk about it: whoever governs claims it (and pays for a bad
// one), whoever challenges profits from the failures of the administration he faces.
function recordFactor(campaign, kind) {
  const claim = INCUMBENCY_RULES.claim;
  const inc = campaign.incumbency;
  if (kind === 'incumbent') return inc?.governing ? clamp(1 + inc.standing * claim.perPoint, claim.min, claim.max) : 1;
  const score = inc && !inc.governing ? inc.score : campaign.candidates?.find(item => item.incumbent)?.incumbency?.score ?? 0;
  return clamp(1 - score * .004, .75, 1.25);
}
// Everything that makes an activity work more or less this time: phase, kind of election, strategy, repetition,
// agenda, mood of the country, the party's polls and the area chosen.
export function activityModifiers(campaign, activity, options = {}) {
  const phase = campaignPhase(campaign);
  const strategy = strategyOf(campaign);
  const area = options.territoryId ? targetArea(campaign, options.territoryId) : null;
  const uses = campaign.activityUses?.[activity.id] ?? 0;
  const mods = {
    phase: activity.phaseBonus?.[phase] ?? 1,
    type: activity.typeBonus?.[campaign.electionType] ?? 1,
    // A declared strategy makes the whole campaign more coherent; attacking a rival is what 'contrasto' is for.
    strategy: round((strategy.mods[activity.category] ?? 1) * (strategy.id ? strategyFit(campaign, strategy.id) * 1.08 : 1) * (strategy.id === 'contrasto' && activity.rival ? 1.3 : 1)),
    repetition: round(Math.max(.35, 1 - (activity.saturation ?? 0) * uses)),
    topic: 1, mood: 1, party: 1, area: 1,
    // The team that does the work: its quality and how tired it is (1 when the campaign has no crew yet).
    crew: activity.rest ? 1 : crewEfficiency(campaign, teamOfActivity(activity))
  };
  const topicId = options.topicId ?? campaign.strategy?.topicId ?? null;
  if (activity.topic) mods.topic = topicId && topicId === campaign.nationalContext?.salientTopic ? 1.3 : .8;
  if (strategy.id === 'temi' && ['media', 'debate'].includes(activity.scope === 'debate' ? 'debate' : activity.category) && topicId && topicId === campaign.strategy?.topicId) mods.topic = round(mods.topic * 1.15);
  const mood = campaign.context?.mood ?? campaign.nationalContext?.moodIndex ?? 50;
  if (activity.mood === 'incumbent') mods.mood = round(clamp(.45 + (mood - 35) / 30, .35, 1.4) * recordFactor(campaign, 'incumbent'));
  if (activity.mood === 'challenger') mods.mood = round(clamp(.45 + (65 - mood) / 30, .35, 1.4) * recordFactor(campaign, 'challenger'));
  if (activity.usesPartyTrend) { const trend = campaign.partyTrend ?? 0; mods.party = trend > .2 ? 1.18 : trend < -.3 ? .65 : 1; }
  if (activity.urban && area) mods.area = area.urban || /capoluogo|urban/i.test(area.name) || campaign.electionType === 'europee' ? 1.2 : .9;
  if (activity.id === 'local_life' && area) mods.area = area.urban ? .85 : 1.1;
  mods.total = round(Object.entries(mods).filter(([key]) => key !== 'total').reduce((product, [, value]) => product * value, 1));
  return mods;
}
const REQUIREMENT_REASONS = { party:'Serve un partito alle spalle.', alliance:'Serve un accordo attivo con un’altra candidatura.', crisis:'Nessuna polemica in corso da gestire.', reputation:'Serve una reputazione di almeno 45.', incumbent:'Solo chi governa può rivendicare dei risultati.', challenger:'Chi governa non può fare campagna contro sé stesso.' };
function requirementMet(campaign, requirement) {
  if (!requirement) return true;
  if (requirement === 'party') return Boolean(campaign.partyId) && !campaign.independent;
  if (requirement === 'alliance') return (campaign.alliances ?? []).some(item => item.status === 'active' && item.leaderCandidateId === campaign.playerCandidateId);
  if (requirement === 'crisis') return Boolean(campaign.crisis);
  if (requirement === 'reputation') return (campaign.candidateStats?.reputation ?? 50) >= 45;
  if (requirement === 'incumbent') return Boolean(campaign.context?.incumbent || campaign.candidacy?.incumbent);
  if (requirement === 'challenger') return !(campaign.context?.incumbent || campaign.candidacy?.incumbent);
  return true;
}
// Whether an activity can be done now, and why not.
export function activityAvailability(campaign, activity) {
  if (campaign.status !== 'active') return { ok:false, reason:'La campagna è conclusa.' };
  if (activity.electionTypes && !activity.electionTypes.includes(campaign.electionType)) return { ok:false, reason:`Non previsto alle ${ELECTION_MODELS[campaign.electionType]?.label.toLowerCase() ?? 'elezioni'}.`, hidden:true };
  const phase = campaignPhase(campaign);
  if (activity.phases && !activity.phases.includes(phase)) return { ok:false, reason:`Disponibile solo in: ${activity.phases.map(id => CAMPAIGN_PHASES[id]?.label.toLowerCase()).join(', ')}.` };
  if (!requirementMet(campaign, activity.requires)) return { ok:false, reason:REQUIREMENT_REASONS[activity.requires] ?? 'Non disponibile ora.' };
  if (activity.runoffStance && !(campaign.stage === 'ballottaggio' && campaign.candidates.find(item => item.isPlayer)?.status === 'eliminated' && campaign.nomination.status === 'approved')) return { ok:false, reason:'Solo chi è fuori dal ballottaggio indica per chi votare.', hidden:true };
  if (activity.id === 'debate' && campaign.nomination.status === 'pending') return { ok:false, reason:'Prima ottieni la candidatura.' };
  if (activity.id === 'ally_meeting' && (campaign.alliances ?? []).filter(item => item.status === 'active' && item.leaderCandidateId === campaign.playerCandidateId).length >= 2) return { ok:false, reason:'La coalizione è già completa (due accordi).' };
  if (activity.id === 'ally_meeting' && !activeOpponents(campaign).length) return { ok:false, reason:'Non ci sono candidature con cui trattare.' };
  if (activity.id === 'ally_meeting' && campaign.stage === 'ballottaggio') return { ok:false, reason:'Tra i due turni gli accordi sono apparentamenti con i candidati esclusi.' };
  if ((activity.runoffPact || activity.runoffAppeal || activity.runoffStance) && !campaign.runoff) return { ok:false, reason:'Il ballottaggio di questa campagna non prevede apparentamenti.', hidden:true };
  if ((activity.scouting || activity.listNegotiation) && !campaign.list) return { ok:false, reason:'Questa candidatura non passa per una lista.', hidden:true };
  if (activity.id === 'list_building' && campaign.candidacy?.role === 'uninominale') return { ok:false, reason:'Il collegio uninominale non ha una lista da costruire.', hidden:true };
  if (activity.listNegotiation && campaign.nomination.status === 'excluded') return { ok:false, reason:'Non sei in lista.' };
  if (campaign.day + activity.days > campaign.totalDays) return { ok:false, reason:'Tempo insufficiente.' };
  const player = campaign.candidates.find(item => item.isPlayer);
  if (!resourceAffordable(player.resources, activity.cost)) return { ok:false, reason:'Risorse insufficienti.' };
  if (player.status === 'eliminated' && !activity.runoffStance) return { ok:false, reason:'La tua candidatura non è in corsa.' };
  return { ok:true, reason:'' };
}
// A rough estimate of the points an activity is worth now (on the whole electorate), before luck and risks.
export function expectedGain(campaign, activity, modifiers = activityModifiers(campaign, activity)) {
  if (!activity.effect || ['internal', 'any', 'debate'].includes(activity.scope) && !activity.pact) return 0;
  const player = campaign.candidates.find(item => item.isPlayer);
  const areas = campaign.territories;
  const area = areas.find(item => item.id === campaign.candidacy?.territoryId) ?? areas[0];
  const weight = areas.reduce((sum, item) => sum + item.weight, 0) || 1;
  const base = activity.effect * (.55 + (player?.resources.organization ?? 30) / 120 + (player?.resources.volunteers ?? 10) / 100) * (.78 + (campaign.candidateStats?.reputation ?? 50) / 180) * (1.14 - supportAt(campaign, area?.id) / 125);
  const scope = activity.scope === 'national' ? .55 : activity.scope === 'broad' ? .6 : activity.rival ? .9 : area ? area.weight / weight : 1;
  const elastic = 1 / (1 + Math.max(0, campaign.gained ?? 0) / (ELASTICITY[campaign.electionType] ?? 4));
  return round(Math.max(0, base * modifiers.total * scope * (IMPACT_SCALE[campaign.electionType] ?? .5) * elastic * (activity.gotv ? .7 : 1)));
}
// The activities of this campaign, with availability, modifiers and expected effect, for the interface.
export function campaignActivities(campaign, options = {}) {
  return CAMPAIGN_ACTIVITIES.map(activity => { const modifiers = activityModifiers(campaign, activity, options); return { activity, ...activityAvailability(campaign, activity), modifiers, expected: expectedGain(campaign, activity, modifiers) }; }).filter(item => !item.hidden);
}
export function setCampaignStrategy(input, strategyId, { topicId = null, targetId = null } = {}) {
  const campaign = copy(input);
  const strategy = CAMPAIGN_STRATEGIES[strategyId];
  if (!strategy) throw new Error('Strategia non riconosciuta.');
  if (campaign.status !== 'active') throw new Error('La campagna è conclusa.');
  if (!strategyAvailable(campaign, strategyId)) throw new Error(`Questa strategia si sceglie ${strategy.stages?.includes('ballottaggio') ? 'solo tra i due turni' : 'durante la campagna'}.`);
  if (strategy.needsTopic && !DEBATE_TOPICS.some(topic => topic.id === topicId)) throw new Error('Scegli il tema su cui puntare.');
  const target = strategy.needsTarget ? campaign.candidates.find(item => item.id === targetId && !item.isPlayer && item.status === 'active') ?? strongestRival(campaign) : null;
  if (strategy.needsTarget && !target) throw new Error('Non ci sono avversari da contrastare.');
  const current = campaign.strategy?.id ?? null;
  if (current === strategyId && (campaign.strategy.topicId ?? null) === (strategy.needsTopic ? topicId : null) && (campaign.strategy.targetId ?? null) === (target?.id ?? null)) throw new Error('È già la strategia della campagna.');
  const player = campaign.candidates.find(item => item.isPlayer);
  // The first choice of the two weeks of the runoff is free: the campaign changes nature and nobody can say it is a change of mind.
  const free = Boolean(campaign.runoff?.freeSwitch && strategy.stages?.includes('ballottaggio'));
  if (current && !free) {
    if (campaign.totalDays - campaign.day <= 5) throw new Error('Negli ultimi cinque giorni non si cambia strategia.');
    if ((player.resources.politicalCapital ?? 0) < 2) throw new Error('Cambiare strategia costa 2 punti di capitale politico.');
    player.resources.politicalCapital -= 2;
    campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation - .3));
  }
  if (free && campaign.runoff) campaign.runoff.freeSwitch = false;
  campaign.strategy = { id:strategyId, topicId:strategy.needsTopic ? topicId : null, targetId:target?.id ?? null, since:campaign.day, changes:(campaign.strategy?.changes ?? -1) + 1, source:SOURCE };
  addHistory(campaign, 'strategia', `${current ? 'Cambio di strategia' : 'Strategia'}: ${strategy.label}${strategy.needsTopic ? ` · ${DEBATE_TOPICS.find(topic => topic.id === topicId)?.label}` : ''}${target ? ` · contro ${target.realReference?.fullName ?? target.displayName}` : ''}${current && !free ? ' (2 capitale, un po’ di credibilità)' : ''}.`);
  campaign.resources = { ...player.resources, visibility:campaign.resources.visibility, source:SOURCE };
  return campaign;
}

// ---------- events ----------
function contextualEvent(campaign, context) {
  if (campaign.pendingEvents.length || campaign.status !== 'active') return;
  const player = campaign.candidates.find(item=>item.isPlayer);
  const rand = draw(campaign);
  const events = [];
  if (context === 'public-event' && rand < .48) events.push({
    kind:'protest', title:'Protesta durante un evento pubblico', body:'Un gruppo di cittadini contesta l’iniziativa. Ascoltare le richieste richiede tempo e organizzazione; interrompere l’evento protegge le risorse ma lascia spazio alle critiche.',
    choices:[{id:'listen',label:'Apri un confronto pubblico',effects:{organization:-1,volunteers:-1,reputation:.7,visibility:1}},{id:'close',label:'Concludi l’evento',effects:{reputation:-.7,politicalCapital:1}}]
  });
  if (context === 'internal' && campaign.nomination.status === 'pending' && rand < .52) events.push({
    kind:'party-crisis', title:'Tensione nel coordinamento del partito', body:'Una parte del coordinamento chiede garanzie sulla lista. Un compromesso può rafforzare la candidatura interna, ma usa capitale politico.',
    choices:[{id:'compromise',label:'Negozia un compromesso',effects:{politicalCapital:-1,organization:-1,internalSupport:1}},{id:'stand',label:'Mantieni la posizione',effects:{internalSupport:-.5,reputation:.2}}]
  });
  if (context === 'media' && campaign.candidateStats.notoriety > 36 && rand < .38) events.push({
    kind:'media', title:'Una finestra mediatica', body:'Una redazione locale propone un approfondimento. La maggiore esposizione può allargare il pubblico e aumentare le critiche.',
    choices:[{id:'accept',label:'Accetta l’intervista',effects:{visibility:5,notoriety:1.2,politicalCapital:-1}},{id:'decline',label:'Rifiuta e concentra il lavoro sul territorio',effects:{organization:2}}]
  });
  if (campaign.candidateStats.reputation < 42 && rand < .72) events.push({
    kind:'controversy', title:'Una dichiarazione fa discutere', body:'Un passaggio della comunicazione è stato contestato. Puoi chiarire il contesto o lasciare che la discussione si esaurisca.',
    choices:[{id:'clarify',label:'Pubblica una rettifica',effects:{money:-350,reputation:1.1,visibility:1}},{id:'ignore',label:'Non alimentare la polemica',effects:{reputation:-1.3,politicalCapital:1}}]
  });
  const weakest = campaign.territories.reduce((a,b)=>supportAt(campaign,a.id)<supportAt(campaign,b.id)?a:b,campaign.territories[0]);
  if (weakest && supportAt(campaign,weakest.id)<13 && rand < .68) events.push({
    kind:'territory', title:`Richiesta da ${weakest.name}`, body:'Una rete civica chiede un confronto pubblico nell’area. La risposta può rafforzare il legame locale o sottrarre risorse ad altre priorità.',
    choices:[{id:'visit',label:'Accetta la visita',effects:{volunteers:-1,organization:-1,territory:weakest.id,support:.45}},{id:'defer',label:'Rimanda dopo le elezioni',effects:{politicalCapital:-1}}]
  });
  if (player && player.resources.organization < 8 && rand < .75) events.push({
    kind:'organization', title:'La macchina organizzativa è sotto pressione', body:'I coordinamenti chiedono tempo e persone. Se non intervieni, alcuni appuntamenti potrebbero perdere efficacia.',
    choices:[{id:'repair',label:'Riorganizza la squadra',effects:{money:-600,organization:4,volunteers:-1}},{id:'continue',label:'Mantieni il programma',effects:{organization:-2,reputation:-.5}}]
  });
  if (rand < .27) { const offer = endorsementOffer(campaign); if (offer) events.push(offer); }
  if (rand < .19) events.push({
    kind:'rival', title:'Un avversario cambia priorità', body:'Una candidatura rivale annuncia un evento nell’area dove la tua presenza è più debole. Puoi spostare parte del programma.',
    choices:[{id:'respond',label:'Rispondi con una visita locale',effects:{money:-250,volunteers:-1,territory:weakest?.id,support:.35}},{id:'hold',label:'Proteggi le risorse',effects:{organization:1}}]
  });
  if (events.length) campaign.pendingEvents.push({ id:ids('evento-campagna',campaign.seed,campaign.day), ...events[Math.floor(rand*events.length)], day:campaign.day, date:campaign.currentDate, source:SOURCE });
}
// A condition of the events pool: what the campaign looks like right now.
function eventCondition(campaign, when) {
  const player = campaign.candidates.find(item => item.isPlayer);
  const trend = campaign.consensusHistory.length > 1 ? campaign.consensusHistory.at(-1).value - campaign.consensusHistory.at(-2).value : 0;
  if (!when) return true;
  if (when === 'notoriety') return (campaign.candidateStats.notoriety ?? 0) > 30;
  if (when === 'momentum') return trend > 0;
  if (when === 'party') return Boolean(campaign.partyId) && !campaign.independent;
  if (when === 'nominated') return campaign.nomination.status === 'approved';
  if (when === 'media') return (campaign.resources.visibility ?? 0) > 18;
  if (when === 'notComunale') return campaign.electionType !== 'comunale';
  if (when === 'lowOrganization') return (player?.resources.organization ?? 30) < 12;
  if (when === 'incumbent') return Boolean(campaign.incumbency?.active && campaign.incumbency.governing);
  if (when === 'recognized') return campaign.candidates.some(item => item.recognition && item.status === 'active' && !item.isPlayer);
  if (when === 'challenger-record') return campaign.candidates.some(item => item.incumbent && item.status === 'active');
  if (when === 'tired') return Object.values(campaign.crew?.teams ?? {}).some(team => Number(team.fatigue ?? 0) >= CREW_RULES.fatigue.tired);
  return true;
}
// The events of the pool: weighted, with cooldowns and one-off episodes, so that no two campaigns look the same.
function poolEvent(campaign) {
  if (campaign.pendingEvents.length || campaign.status !== 'active') return false;
  const seen = campaign.eventLog ?? {};
  const eligible = CAMPAIGN_EVENTS.filter(event => eventCondition(campaign, event.when) && !(event.unique && seen[event.id] !== undefined) && campaign.day - (seen[event.id] ?? -999) >= (event.cooldown ?? 14));
  if (!eligible.length) return false;
  const total = eligible.reduce((sum, event) => sum + event.weight, 0);
  let pick = draw(campaign) * total;
  const event = eligible.find(item => (pick -= item.weight) < 0) ?? eligible.at(-1);
  campaign.eventLog = { ...seen, [event.id]: campaign.day };
  campaign.pendingEvents.push({ id:ids(`evento-${event.id}`,campaign.seed,campaign.day), kind:event.id, title:event.title, body:event.body, choices:event.choices.map(choice => ({ ...choice, effects:{ ...choice.effects } })), day:campaign.day, date:campaign.currentDate, source:SOURCE });
  return true;
}
function evaluateNomination(campaign) {
  if (campaign.nomination.status !== 'pending' || campaign.day < campaign.nomination.deadlineDay) return;
  // The names the leaders of the party have put on the list are part of the internal competition: the stronger they are, the harder the candidacy.
  const leaders=(campaign.list?.mates??[]).filter(item=>item.faction==='dirigenti'&&item.status!=='ritirato').map(item=>item.strength);
  const strongestInternal=Math.max(0,...campaign.internalCandidates.map(item=>item.internalSupport))+(leaders.length?clamp((Math.max(...leaders)-62)/60,0,.6):0);
  // The party decides: support above the bar and ahead of internal rivals makes the candidacy likely, not certain;
  // a lead that is too thin can end in a lower place on the list or in exclusion.
  const support = campaign.nomination.internalSupport;
  const lead = support - strongestInternal;
  const bar = support - campaign.nomination.requiredSupport;
  const odds = clamp(.5 + bar * .09 + lead * .12, lead <= -2 ? .01 : .05, .95);
  const roll = draw(campaign);
  campaign.nomination.decision = { support:round(support), required:campaign.nomination.requiredSupport, strongestRival:round(strongestInternal), odds:round(odds), source:SOURCE };
  if (roll < odds) {
    campaign.nomination.status = 'approved';
    // Who is on the list with you, how strong they are and what the territory and the currents of the party say decide the place.
    const standing = listStanding(campaign);
    if (standing) {
      const before = campaign.nomination.listPosition;
      campaign.nomination.listPosition = clamp(Math.round((before + standing.rank) / 2), 1, 8);
      campaign.nomination.decision.rank = standing;
      if (campaign.nomination.listPosition !== before) addHistory(campaign, 'candidatura', `La composizione della lista (${standing.ahead} ${standing.ahead === 1 ? 'nome pesa' : 'nomi pesano'} più di te) sposta il tuo posto: dal ${before} al ${campaign.nomination.listPosition}.`, { source:SOURCE });
    }
    // A narrow decision: the candidacy comes with a worse place on the list than hoped.
    if (campaign.nomination.listPosition !== null && roll > odds * .82 && campaign.nomination.listPosition < 8) {
      campaign.nomination.listPosition += 1 + (roll > odds * .93 ? 1 : 0);
      campaign.nomination.decision.lowerPlace = true;
      addHistory(campaign,'candidatura',`Candidatura approvata, ma in una posizione peggiore di quella attesa: numero ${campaign.nomination.listPosition}.`,{source:SOURCE});
    } else addHistory(campaign,'candidatura',campaign.nomination.listPosition===null?'Il partito ha approvato la candidatura nel collegio uninominale.':'Il partito ha approvato la candidatura e la posizione in lista.',{source:SOURCE});
    campaign.candidacy.listPosition = campaign.nomination.listPosition;
  } else {
    campaign.nomination.status = 'excluded';
    campaign.candidates.find(item=>item.isPlayer).status='eliminated';
    campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-1.5));
    addHistory(campaign,'candidatura',lead < 0 ? 'Il partito ha preferito un’altra candidatura interna.' : 'La candidatura non ha ottenuto sostegno interno sufficiente entro la scadenza.',{source:SOURCE});
  }
}
function chooseRivalAction(campaign, rival, ranked, rivals, player) {
  const profile = ensureRivalProfile(campaign, rival, rivals.indexOf(rival));
  const traits = RIVAL_PERSONALITIES[profile.personality] ?? RIVAL_PERSONALITIES.prudente;
  const playerRelation = rivalRelationship(campaign, rival, player.id);
  const hostileMemory = rivalMemoryScore(campaign, rival, 'attack', player.id) + rivalMemoryScore(campaign, rival, 'betrayal', player.id) * 1.4;
  const cooperativeMemory = rivalMemoryScore(campaign, rival, 'agreement', player.id) + rivalMemoryScore(campaign, rival, 'aid', player.id) * 1.2;
  const own = weightedShare(campaign, rival.id);
  const playerShare = weightedShare(campaign, player.id);
  const gap = playerShare - own;
  const top = ranked.reduce((best, entry) => !best || entry.own > best.own ? entry : best, null);
  const target = ranked[0]?.area;
  const objectives = profile.objectives ?? [];
  const interests = profile.interests ?? [];
  const scores = {
    attack: traits.attack + (hostileMemory * .22) + (playerRelation < 38 ? .65 : 0) + (gap > -5 ? .35 : -.15) + (objectives.includes('fermare-il-giocatore') ? .75 : 0) + (campaign.incumbency?.active && campaign.incumbency.governing && campaign.incumbency.standing < -10 ? .3 : 0) + (rival.recognition?.lostToPlayer ? RIVAL_PERSISTENCE.campaign.revenge : 0) + (rival.recognition?.betrayed ? .3 : 0),
    defend: traits.defend + (own > 34 ? .8 : 0) + (objectives.includes('consolidare-territorio') ? .25 : 0) + (rival.recognition?.beatPlayer ? .2 : 0),
    territory: traits.territory + (interests.includes('territorio') || interests.includes('elettorato-locale') ? .55 : 0) + (target ? Math.max(0, target.player - target.own) * .06 : 0),
    visibility: traits.visibility + (interests.includes('visibilita') ? .55 : 0) + (objectives.includes('emergere-nel-partito') ? .4 : 0),
    alliance: traits.alliance + (cooperativeMemory * .18) + (playerRelation > 62 ? .35 : 0) + (objectives.includes('costruire-alleanza') ? .85 : 0) + (rival.recognition?.allied ? RIVAL_PERSISTENCE.campaign.allied : 0),
    withdraw: traits.withdraw + (own < 8 ? 1.5 : 0) + (profile.loyalty < 40 ? .45 : 0)
  };
  if (campaign.alliances.some(item => item.status === 'active') || rivals.length < 2) scores.alliance *= .18;
  if (!resourceAffordable(rival.resources, { money: 140, volunteers: 1 })) {
    scores.attack *= .35; scores.visibility *= .35; scores.alliance *= .55;
  }
  if (profile.personality === 'ideologico' && campaign.nationalContext?.salientTopic) scores.visibility += .2;
  if (profile.personality === 'territoriale' && target) scores.territory += target.region === campaign.homeRegion ? .35 : 0;
  const initiative = clamp(profile.initiative + (hostileMemory > 1 ? .12 : 0) - (cooperativeMemory > 1 ? .04 : 0), 0, 1);
  if (draw(campaign) > initiative) return own > 24 ? 'defend' : 'territory';
  const rankedActions = Object.entries(scores).map(([action, score]) => ({ action, score: score + draw(campaign) * .08 })).sort((a, b) => b.score - a.score);
  return rankedActions[0]?.action ?? 'defend';
}
function formRivalAlliance(campaign, rival, rivals) {
  if (campaign.alliances.some(item => item.status === 'active')) return false;
  const profile = ensureRivalProfile(campaign, rival, rivals.indexOf(rival));
  const partner = rivals.filter(item => item.id !== rival.id && item.status === 'active')
    .sort((a, b) => rivalRelationship(campaign, rival, b.id) - rivalRelationship(campaign, rival, a.id))[0];
  if (!partner) return false;
  const trust = rivalRelationship(campaign, rival, partner.id);
  const chance = clamp(.08 + (profile?.personality === 'diplomatico' ? .16 : 0) + (profile?.objectives?.includes('costruire-alleanza') ? .15 : 0) + trust / 500, .03, .48);
  if (trust < 58 || draw(campaign) >= chance) return false;
  rival.status = 'allied'; rival.coalitionLeaderId = partner.id;
  const transfer = mergeAlliance(campaign, partner.id, rival);
  campaign.alliances.push({ id:ids('alleanza', campaign.seed, campaign.day + rivals.indexOf(rival)), leaderCandidateId:partner.id, partnerCandidateId:rival.id, status:'active', transfer, terms:'Sostegno e campagna condivisi; seggi calcolati insieme nello scenario.', formedOn:campaign.currentDate, source:SOURCE });
  rivalMemory(campaign, rival, 'agreement', partner.id, { relationDelta: 8, action:'accordo-tra-rivali' });
  rivalMemory(campaign, partner, 'agreement', rival.id, { relationDelta: 8, action:'accordo-tra-rivali' });
  addHistory(campaign, 'alleanza', 'Due candidature simulate hanno annunciato un accordo.', { source:SOURCE });
  return true;
}
function opponentTurn(campaign) {
  if (campaign.status !== 'active') return;
  campaign.aiTurns = (campaign.aiTurns ?? 0) + 1;
  if (campaign.nomination.status === 'pending') for (const rival of campaign.internalCandidates) {
    rival.internalSupport = round(clamp(rival.internalSupport + .25 + draw(campaign) * .42, 0, 10));
    rival.lastAction = 'Sta cercando sostegno nel partito.';
  }
  const rivals = activeOpponents(campaign);
  if (!rivals.length) return;
  const player = campaign.candidates.find(item => item.isPlayer);
  rivals.forEach((rival, index) => ensureRivalProfile(campaign, rival, index));
  for (const rival of rivals) {
    const profile = ensureRivalProfile(campaign, rival, rivals.indexOf(rival));
    if (rival.resources.money <= 0 || rival.resources.volunteers <= 0) {
      rival.strategy = 'conservazione';
      rival.lastAction = 'Ha ridotto il ritmo per proteggere le risorse.';
      profile.lastDecision = { day:campaign.day, action:'conservazione', source:SOURCE };
      continue;
    }
    const ranked = campaign.territories.map(area => ({ area, own:Number(area.supportByCandidate[rival.id] ?? 0), player:Number(area.supportByCandidate[player.id] ?? 0) }));
    ranked.sort((a, b) => (b.player - b.own) - (a.player - a.own));
    const target = ranked[0]?.area;
    const top = ranked.reduce((a, b) => a.own > b.own ? a : b, ranked[0]);
    const targeted = campaign.strategy?.id === 'contrasto' && campaign.strategy.targetId === rival.id;
    const action = targeted && campaign.day - (campaign.lastAttackDay ?? -99) <= 7 ? 'attack' : chooseRivalAction(campaign, rival, ranked, rivals, player);
    profile.lastDecision = { day:campaign.day, action, targetId:target?.id ?? null, source:SOURCE };
    rival.strategy = action === 'attack' ? 'risposta agli attacchi' : action === 'defend' ? 'difesa del vantaggio' : action === 'territory' ? 'presidio dei territori deboli' : action === 'alliance' ? 'costruzione di alleanze' : action === 'withdraw' ? 'conservazione' : 'visibilità mirata';
    if (action === 'attack') {
      transferSupport(campaign, player.id, rival.id, targeted ? .08 + draw(campaign) * .15 : .16 + draw(campaign) * .27, target?.id);
      moveSupport(campaign, rival.id, .12 + draw(campaign) * .24, target?.id);
      rival.lastAction = targeted ? 'Ricorda l’attacco e risponde colpo su colpo.' : 'Apre un fronte contro la candidatura del giocatore.';
      rivalMemory(campaign, rival, 'attack', player.id, { action:'attacco-autonomo', relationDelta:-2, weight:.35 });
    } else if (action === 'territory' && target) {
      moveSupport(campaign, rival.id, .3 + draw(campaign) * .4, target.id);
      rival.lastAction = `Concentra risorse su ${target.name}.`;
    } else if (action === 'visibility') {
      moveSupport(campaign, rival.id, .18 + draw(campaign) * .32);
      rival.lastAction = 'Cerca visibilità per allargare il proprio elettorato.';
    } else if (action === 'alliance') {
      const formed = formRivalAlliance(campaign, rival, rivals);
      rival.lastAction = formed ? 'Ha costruito un accordo autonomo con un’altra candidatura.' : 'Ha sondato possibili alleanze senza chiudere un accordo.';
    } else if (action === 'withdraw') {
      rival.resources.organization = Math.min(100, Number(rival.resources.organization ?? 0) + 1);
      rival.lastAction = 'Riduce il ritmo per conservare risorse e influenza.';
    } else {
      moveSupport(campaign, rival.id, .22 + draw(campaign) * .25, top?.area?.id);
      rival.lastAction = 'Difende il vantaggio nelle aree più solide.';
    }
    rival.resources.money = Math.max(0, rival.resources.money - Math.round(80 + draw(campaign) * 200));
    rival.resources.volunteers = Math.max(0, rival.resources.volunteers - (draw(campaign) < (action === 'attack' ? .28 : .2) ? 1 : 0));
    rival.resources.organization = Math.max(0, rival.resources.organization - (draw(campaign) < .3 ? 1 : 0));
    if (action !== 'alliance' && action !== 'withdraw') rivalMemory(campaign, rival, 'initiative', null, { action, weight:.12 });
  }
  // Rivals also remember conflicts between themselves; personality and trust change who starts them.
  for (const rival of activeOpponents(campaign)) {
    rival.campaignStats.momentum = round(clamp(Number(rival.campaignStats.momentum ?? 0) * .8 + gaussian(campaign) * 1.2, -5, 5));
    moveSupport(campaign, rival.id, rival.campaignStats.momentum * .06);
  }
  const field = [...activeOpponents(campaign)].sort((a, b) => weightedShare(campaign, b.id) - weightedShare(campaign, a.id));
  if (field.length >= 2) {
    const [first, second] = field;
    const aggressiveness = RIVAL_PERSONALITIES[ensureRivalProfile(campaign, second, 0)?.personality]?.attack ?? 1;
    const conflictChance = clamp(.08 + aggressiveness * .07 + (50 - rivalRelationship(campaign, second, first.id)) / 500, .03, .32);
    if (draw(campaign) < conflictChance) {
      const backfires = draw(campaign) < .35;
      transferSupport(campaign, first.id, second.id, (.15 + draw(campaign) * .35) * (backfires ? -1 : 1));
      second.lastAction = backfires ? 'Il suo attacco alla candidatura in testa si è ritorto contro.' : 'Attacca la candidatura in testa e guadagna terreno.';
      rivalMemory(campaign, second, 'conflict', first.id, { action:'scontro-tra-rivali', relationDelta:-5, weight:1 });
      rivalMemory(campaign, first, 'conflict', second.id, { action:'scontro-tra-rivali', relationDelta:-5, weight:1 });
      addHistory(campaign, 'scontro', `Scontro tra ${candidateLabel(second)} e ${candidateLabel(first)}: ${backfires ? 'l’attacco si ritorce contro chi lo ha lanciato' : 'chi insegue recupera qualcosa'}.`, { source:SOURCE });
    }
  }
  const last = field.at(-1);
  if (field.length >= 3 && last && weightedShare(campaign, last.id) < 8 && campaign.day < campaign.totalDays - 7) {
    const profile = ensureRivalProfile(campaign, last, rivals.indexOf(last));
    const withdrawChance = clamp(.04 + (profile?.personality === 'prudente' ? .1 : 0) + (profile?.objectives?.includes('restare-competitivo') ? .05 : 0) + (1 - (profile?.loyalty ?? 50) / 100) * .08, .03, .25);
    if (draw(campaign) < withdrawChance) {
      // He backs whom he likes best among the others - the player too, if they already know each other and he thinks well of him.
      const candidates = [...field.slice(0, -1), ...(last.recognition && player?.status === 'active' && rivalRelationship(campaign, last, player.id) >= 60 ? [player] : [])];
      const backed = candidates.sort((a, b) => rivalRelationship(campaign, last, b.id) - rivalRelationship(campaign, last, a.id))[0];
      const rate = clamp(.5 + (rivalRelationship(campaign, last, backed.id) - 50) / 200, .35, .85);
      releaseSupport(campaign, last.id, backed.id, rate);
      last.status = 'withdrawn'; last.endorsedId = backed.id;
      last.lastAction = backed.isPlayer ? 'Si è ritirata e sostiene la tua candidatura.' : `Si è ritirata e sostiene ${candidateLabel(backed)}.`;
      rivalMemory(campaign, last, backed.isPlayer ? 'agreement' : 'defeat', backed.id, { action:backed.isPlayer ? 'sostegno-al-giocatore' : 'ritiro', relationDelta:backed.isPlayer ? 5 : 2, weight:1 });
      if (!backed.isPlayer) rivalMemory(campaign, backed, 'aid', last.id, { action:'endorsement-ricevuto', relationDelta:4, weight:1 });
      addHistory(campaign, 'ritiro', `${candidateLabel(last).charAt(0).toLocaleUpperCase('it-IT') + candidateLabel(last).slice(1)} si ritira e indica di votare ${backed.isPlayer ? 'te' : candidateLabel(backed)}: ${Math.round(rate * 100)}% dei suoi elettori segue l’indicazione.`, { source:SOURCE });
    }
  }
  // A rival who thinks well of the player (they already know each other) proposes an alliance: an offer, not a negotiation.
  const friendly = player?.status === 'active' && !campaign.pendingEvents.length && (campaign.alliances ?? []).filter(item => item.status === 'active' && item.leaderCandidateId === player.id).length < 2
    ? activeOpponents(campaign).find(rival => rival.recognition && rivalRelationship(campaign, rival, player.id) >= RIVAL_PERSISTENCE.campaign.relation && campaign.eventLog?.[`alleanza-${rival.id}`] === undefined) : null;
  if (friendly && draw(campaign) < RIVAL_PERSISTENCE.campaign.offer) {
    campaign.eventLog = { ...(campaign.eventLog ?? {}), [`alleanza-${friendly.id}`]:campaign.day };
    pendingEvent(campaign, 'alleanza', `${candidateLabel(friendly).charAt(0).toLocaleUpperCase('it-IT') + candidateLabel(friendly).slice(1)} propone un accordo`, 'Vi conoscete dalle campagne precedenti e vi fidate l’uno dell’altro. Propone di correre insieme: una parte dei suoi elettori seguirà l’intesa, ma la tua lista pesa meno.', [
      { id:'accept', label:'Accetta l’alleanza', effects:{ rivalAlliance:friendly.id } },
      { id:'decline', label:'Declina con garbo', effects:{ rivalRelation:{ id:friendly.id, delta:-3 } } }
    ]);
  }
  const currentLeader = activeOpponents(campaign).sort((a, b) => supportAt(campaign, campaign.territories[0].id, b.id) - supportAt(campaign, campaign.territories[0].id, a.id))[0];
  if (currentLeader && player && supportAt(campaign, campaign.territories[0].id, currentLeader.id) - supportAt(campaign, campaign.territories[0].id, player.id) > 14 && draw(campaign) < .24) {
    pendingEvent(campaign, 'rival', 'Un avversario attacca la tua proposta', 'Una candidatura rivale contesta pubblicamente una tua scelta. Rispondere può attirare attenzione e comporta un rischio reputazionale.', [
      { id:'answer', label:'Rispondi nel merito', effects:{ visibility:2, reputation:.4, politicalCapital:-1, support:.25 } },
      { id:'ignore', label:'Non spostare il programma', effects:{ organization:1 } }
    ]);
  }
}
// What a week of campaign costs or brings by itself: a controversy that is not handled, a base that feels neglected.
function weeklyPressure(campaign) {
  const player = campaign.candidates.find(item => item.isPlayer);
  if (!player || player.status !== 'active') return;
  const strategy = strategyOf(campaign);
  if (strategy.erosion) {
    const home = campaign.territories.reduce((a, b) => supportAt(campaign, a.id) >= supportAt(campaign, b.id) ? a : b, campaign.territories[0]);
    playerMove(campaign, -strategy.erosion, home.id);
  }
  if (campaign.crisis) {
    playerMove(campaign, -.22 * campaign.crisis.severity);
    campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation - .2 * campaign.crisis.severity));
    campaign.crisis.weeks = (campaign.crisis.weeks ?? 0) + 1;
    if (campaign.crisis.weeks >= 3) { addHistory(campaign, 'crisi', `La polemica si spegne da sola: “${campaign.crisis.title}” ha pesato per tre settimane.`); campaign.crisis = null; }
  }
}
// Who gets its voters to the polls: organisation, volunteers (their quality and how tired they are), the push of the last days
// (get-out-the-vote), the climate of the country and, in the runoff, the plan of the two weeks. What counts is the difference
// with the others: whoever mobilises more than the field gains, whoever mobilises less loses.
function mobilizationOf(campaign, candidate, round_ = 'primo-turno') {
  const res = candidate.resources ?? {};
  const rules = CREW_RULES.mobilization;
  const base = (Number(res.organization ?? 30) - 30) / 90 + (Number(res.volunteers ?? 10) - 10) / 70;
  // In the runoff the plan of the two weeks counts: a strategy built on the turnout (or on the appeals to the others) changes it.
  const runoff = campaign.stage === 'ballottaggio' ? (candidate.isPlayer ? ((strategyOf(campaign).runoff?.turnout ?? 1) - 1) * .8 : .05) : 0;
  if (!candidate.isPlayer) {
    const personality = candidate.aiProfile?.personality;
    return round(clamp(base * rules.rivals + (personality === 'territoriale' ? .12 : personality === 'ideologico' ? .06 : 0) + runoff, -.5, .9));
  }
  const mood = campaign.nationalContext?.moodIndex ?? 50;
  const incumbent = Boolean(campaign.context?.incumbent || campaign.candidacy?.incumbent);
  const gotv = campaign.crew ? Number(campaign.crew.gotv ?? 0) : Number(campaign.activityUses?.get_out_vote ?? 0) * rules.gotv;
  let crewTerm = 0;
  if (campaign.crew) {
    const view = crewOf(campaign);
    const work = view.teams.filter(team => ['field', 'events'].includes(team.id));
    const fatigue = work.reduce((sum, team) => sum + team.fatigue, 0) / Math.max(1, work.length);
    crewTerm = (view.quality - CREW_RULES.quality.base) / 100 * rules.quality - Math.max(0, fatigue - CREW_RULES.fatigue.free) / 100 * rules.fatigue;
  }
  const climate = incumbent ? (mood - 50) * rules.climateIncumbent : (50 - mood) * rules.climateChallenger;
  return round(clamp(base + gotv + crewTerm + climate + runoff, -.8, 1.6));
}
// The turnout of a vote and what it is made of: the participation of the territory, the climate, the mobilisation of the player and
// of the others. In the runoff far fewer people vote, and who goes to the polls is decided by the machines.
function turnoutOf(campaign, round_ = 'primo-turno', mobilization = null) {
  const mood = campaign.nationalContext?.moodIndex ?? 50;
  const player = campaign.candidates.find(item => item.isPlayer);
  const own = player?.status === 'active' ? Number(mobilization?.[player.id] ?? mobilizationOf(campaign, player, round_)) : 0;
  const others = campaign.candidates.filter(item => !item.isPlayer && item.status === 'active').map(item => Number(mobilization?.[item.id] ?? mobilizationOf(campaign, item, round_)));
  const rivals = others.length ? others.reduce((sum, value) => sum + value, 0) / others.length : 0;
  const parts = { base:58, place:campaign.context?.participation ? round((campaign.context.participation - 60) * .4) : 0, climate:round((mood - 50) * .08), mobilization:round(own * 1.5 + rivals * .8), runoff:round_ === 'ballottaggio' ? RUNOFF_RULES.turnoutDrop : 0 };
  return { value:round(clamp(Object.values(parts).reduce((sum, value) => sum + value, 0), 32, 82)), parts };
}
// More noise where fewer people decide. It is the size of the electorate that counts (the voters, when the registers are known: electors times turnout), not the turnout
// alone; when only its class is known (a comune up to 15,000 inhabitants, the second-level vote of a province) the class says it; unknown, it is neutral.
function electorateNoise(campaign, turnout) {
  const electorate = campaign.electorate;
  const electors = Number(electorate?.electors);
  if (Number.isFinite(electors) && electors > 0) return 1 + clamp((Math.log10(30000) - Math.log10(Math.max(1, electors * turnout / 100))) * .3, 0, .7);
  return electorate?.sizeClass === 'piccolo' ? 1.2 : electorate?.sizeClass === 'secondo-livello' ? 1.15 : 1;
}
// The size of the electorate of the race, as far as it is known: the number of electors (the registers the store reads from the real map), or only its class.
function electorateOf(config, type) {
  const given = config.electorate && typeof config.electorate === 'object' ? config.electorate : {};
  const electors = Number(given.electors);
  const sizeClass = type === 'comunale' ? (config.municipalityBand === 'oltre-15000' ? 'medio' : 'piccolo') : type === 'provinciale' ? 'secondo-livello' : null;
  return { electors: Number.isFinite(electors) && electors > 0 ? Math.round(electors) : null, validRatio: given.validRatio !== null && given.validRatio !== undefined && Number(given.validRatio) > 0 && Number(given.validRatio) <= 1 ? Number(given.validRatio) : null, sizeClass, basis: given.basis ?? (sizeClass === 'piccolo' || sizeClass === 'medio' ? 'fascia demografica del comune (fino o oltre 15.000 abitanti)' : null), source:SOURCE };
}
// The day of the vote: late deciders, turnout and the error of every projection move the final result a little.
// How much depends on the strategy (more when looking for new voters, less when consolidating), on the climate and on the turnout
// (a small electorate is a noisier one); the difference in mobilisation between the candidates moves the shares.
function electionDay(campaign, round_ = 'primo-turno') {
  const strategy = strategyOf(campaign);
  const mood = campaign.nationalContext?.moodIndex ?? 50;
  const climate = 1 + Math.abs(mood - 50) / 80;
  const player = campaign.candidates.find(item => item.isPlayer);
  const before = Object.fromEntries(campaign.candidates.map(item => [item.id, round(weightedShare(campaign, item.id))]));
  const active = campaign.candidates.filter(item => item.status === 'active');
  const mobilization = Object.fromEntries(active.map(item => [item.id, mobilizationOf(campaign, item, round_)]));
  const mean = active.length ? Object.values(mobilization).reduce((sum, value) => sum + value, 0) / active.length : 0;
  const turnout = turnoutOf(campaign, round_, mobilization);
  const smallElectorate = electorateNoise(campaign, turnout.value);
  const shifts = {};
  for (const candidate of active) {
    const share = Math.max(.5, before[candidate.id]);
    const volatility = candidate.isPlayer ? strategy.volatility : 1;
    shifts[candidate.id] = round(gaussian(campaign) * (.45 + Math.sqrt(share) * .3) * volatility * climate * smallElectorate * .8 + (mobilization[candidate.id] - mean) + (candidate.isPlayer ? listEdge(campaign) : 0));
  }
  for (const area of campaign.territories) {
    const shares = area.supportByCandidate;
    for (const [id, shift] of Object.entries(shifts)) if (id in shares) shares[id] = Math.max(.1, Number(shares[id]) + shift * (.75 + draw(campaign) * .5));
    const total = Object.values(shares).reduce((sum, value) => sum + Number(value), 0) || 1;
    for (const id of Object.keys(shares)) shares[id] = round(Number(shares[id]) * 100 / total);
  }
  campaign.electionDays = [...(campaign.electionDays ?? []), { round:round_, projection:before, shifts, mobilization:round(player && mobilization[player.id] !== undefined ? mobilization[player.id] : 0), mobilizationByCandidate:mobilization, turnout:turnout.value, turnoutParts:turnout.parts, source:SOURCE }];
}
// ---------- endorsements: who backs the player, why, at what price, and what is remembered ----------
// An endorsement is not a bonus: it comes from a subject (a mayor, a trade association, a union, a civic network, a newspaper, a leader of
// the party), for a reason (ideals, interest, hostility to another candidate, convenience, friendship), it brings the votes the subject can
// move (in its area, or broadly), it costs something (a commitment, autonomy, independence, a debt) and it is remembered: by the subject, in the
// next campaigns, and by the voters, in the commitments the player has to keep.
const MOTIVE_TEXT = ENDORSEMENT_RULES.motives;
function ensureEndorsements(campaign) {
  campaign.endorsements = campaign.endorsements && typeof campaign.endorsements === 'object' ? campaign.endorsements : {};
  const box = campaign.endorsements;
  box.source = SOURCE;
  box.known = Array.isArray(box.known) ? box.known : [];
  box.given = Array.isArray(box.given) ? box.given : [];
  box.refused = Array.isArray(box.refused) ? box.refused : [];
  box.pending = box.pending && typeof box.pending === 'object' ? box.pending : {};
  box.offers = Number(box.offers ?? 0);
  return box;
}
// Who comes forward: someone the player already knows (a friend, or an enemy) or a new subject, more often where the player is weaker.
function drawEndorser(campaign) {
  const box = ensureEndorsements(campaign);
  const areas = campaign.territories;
  const here = box.known.filter(item => areas.some(area => area.id === item.areaId) && !box.given.some(given => given.key === item.key) && !box.refused.some(refused => refused.key === item.key));
  const friends = here.filter(item => item.relation >= 50);
  if (friends.length && draw(campaign) < .35) return { ...friends[Math.floor(draw(campaign) * friends.length)], known:true };
  const weights = ENDORSEMENT_RULES.weights[campaign.electionType] ?? ENDORSEMENT_RULES.weights.comunale;
  const kinds = Object.keys(ENDORSEMENT_KINDS).filter(kind => weights[kind] && (kind !== 'dirigente' || (campaign.partyId && !campaign.independent)));
  let pick = draw(campaign) * kinds.reduce((sum, kind) => sum + weights[kind], 0);
  const kind = kinds.find(item => (pick -= weights[item]) < 0) ?? kinds.at(-1);
  const gaps = areas.map(area => Math.max(1, 40 - supportAt(campaign, area.id)));
  let at = draw(campaign) * gaps.reduce((sum, value) => sum + value, 0);
  const area = areas.find((item, index) => (at -= gaps[index]) < 0) ?? areas[0];
  const key = `${kind}|${area.id}`;
  const old = box.known.find(item => item.key === key);
  return { key, kind, areaId:area.id, label:`${ENDORSEMENT_KINDS[kind].label}${areas.length > 1 || campaign.electionType !== 'comunale' ? ` · ${area.name}` : ''}`, relation:old?.relation ?? 50, known:Boolean(old) };
}
function endorsementMotive(campaign, subject) {
  const position = campaign.status === 'active' ? aggregateShares(campaign).findIndex(group => group.id === campaign.playerCandidateId) : 0;
  const weights = { ideale:Math.max(.2, .8 + (campaign.candidateStats.reputation - 50) / 60), interesse:1, ostilita:strongestRival(campaign) ? .6 : 0, convenienza:position === 0 ? 1.1 : .2, amicizia:subject.known ? 1.6 : .3 };
  let pick = draw(campaign) * Object.values(weights).reduce((sum, value) => sum + value, 0);
  return Object.keys(weights).find(key => (pick -= weights[key]) < 0) ?? 'interesse';
}
const MOTIVE_FACTOR = Object.freeze({ ideale:1.1, amicizia:1.15, interesse:.95, convenienza:.8, ostilita:1 });
// The votes an endorsement is worth, before the elasticity of the campaign: the weight of the subject, the rapport, the reason and the credibility of the player.
function endorsementPoints(campaign, subject, motive, mode = 'accept') {
  const kind = ENDORSEMENT_KINDS[subject.kind] ?? ENDORSEMENT_KINDS.civico;
  return round(.9 * kind.weight * (.75 + Number(subject.relation ?? 50) / 200) * (MOTIVE_FACTOR[motive] ?? 1) * (.8 + campaign.candidateStats.reputation / 250) * (mode === 'light' ? .55 : 1));
}
// The endorsement is given: votes where the subject counts (or broadly, or taken from a rival the subject opposes), the price, the memory.
function grantEndorsement(campaign, player, subject, motive, mode, modifiers = null) {
  const box = ensureEndorsements(campaign);
  const kind = ENDORSEMENT_KINDS[subject.kind] ?? ENDORSEMENT_KINDS.civico;
  const points = round(endorsementPoints(campaign, subject, motive, mode) * Math.max(.5, modifiers?.total ?? 1));
  const area = campaign.territories.find(item => item.id === subject.areaId) ?? campaign.territories[0];
  const rival = strongestRival(campaign);
  if (motive === 'ostilita' && rival) {
    playerTransfer(campaign, rival.id, points * .8, area.id);
    rivalMemory(campaign, rival, 'attack', player.id, { action:'sostegno-ostile', relationDelta:-3, weight:.6 });
  } else if (kind.reach === 'ampio') playerMove(campaign, points * .6);
  else { playerMove(campaign, points, area.id); playerMove(campaign, points * .15); }
  const costs = [];
  if (mode !== 'light') {
    if (kind.cost === 'impegno') { campaign.commitments = (campaign.commitments ?? 0) + 1; obligationOf(campaign, 'sostegno', subject.label, `${subject.label}: un impegno scritto sul programma.`, { subjectKey:subject.key, kind:subject.kind, areaId:subject.areaId, weight:1 }); costs.push('un impegno sul programma'); }
    else if (kind.cost === 'autonomia') { campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation - .3)); player.resources.politicalCapital = Math.max(0, Number(player.resources.politicalCapital ?? 0) - 1); costs.push('un po’ di autonomia'); }
    else if (kind.cost === 'indipendenza') { campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation - .35)); costs.push('qualche critica di parte'); }
    else if (kind.cost === 'debito') { if (campaign.nomination.status === 'pending') campaign.nomination.internalSupport = round(clamp(campaign.nomination.internalSupport + .6, 0, 10)); obligationOf(campaign, 'sostegno', subject.label, `${subject.label}: un debito politico da onorare.`, { subjectKey:subject.key, kind:subject.kind, faction:'dirigenti', areaId:subject.areaId, weight:.8 }); costs.push('un debito con i dirigenti'); }
  }
  campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation + .2));
  box.given.push({ id:ids('sostegno-dato', campaign.seed, box.given.length + campaign.day), key:subject.key, kind:subject.kind, label:subject.label, areaId:subject.areaId, motive, mode, points, cost:kind.cost, relation:Number(subject.relation ?? 50), day:campaign.day, date:campaign.currentDate, source:SOURCE });
  return `${subject.label} ti sostiene${motive === 'ostilita' && rival ? ` per fermare ${candidateLabel(rival)}` : ''} (${MOTIVE_TEXT[motive]}): +${String(points).replace('.', ',')}${costs.length ? `, in cambio di ${costs.join(' e ')}` : ''}.`;
}
function refuseEndorsement(campaign, subject, report, delta = -6) {
  const box = ensureEndorsements(campaign);
  box.refused.push({ id:ids('sostegno-negato', campaign.seed, box.refused.length + campaign.day), key:subject.key, kind:subject.kind, label:subject.label, areaId:subject.areaId, relation:Number(subject.relation ?? 50), delta, day:campaign.day, date:campaign.currentDate, source:SOURCE });
  return report;
}
// A subject comes forward on its own: the player decides whether to accept (with the commitment), accept without commitments (it is worth less) or decline.
function endorsementOffer(campaign) {
  const box = ensureEndorsements(campaign);
  // At most `maxOffers` offers in a whole campaign (a subject that comes forward counts even if the player declines).
  if (box.offers >= ENDORSEMENT_RULES.maxOffers) return null;
  const subject = drawEndorser(campaign);
  const motive = endorsementMotive(campaign, subject);
  const kind = ENDORSEMENT_KINDS[subject.kind];
  const offerId = ids('offerta-sostegno', campaign.seed, campaign.day + box.offers);
  box.offers += 1;
  box.pending[offerId] = { subject, motive };
  const costText = { impegno:'un impegno scritto sul programma', autonomia:'un po’ della tua autonomia', indipendenza:'una vicinanza che la stampa noterà', debito:'un debito con la dirigenza' }[kind.cost] ?? 'qualcosa in cambio';
  return {
    kind:'endorsement', title:subject.known ? `Un sostegno che torna: ${subject.label}` : `Un sostegno inatteso: ${subject.label}`,
    body:`${subject.label} propone di sostenerti perché ${MOTIVE_TEXT[motive]}. Il sostegno porta voti dove ${kind.reach === 'ampio' ? 'arriva il suo pubblico' : 'ha seguito'}, ma chiede ${costText}.${subject.known ? ' Vi siete già incontrati.' : ''}`,
    choices:[
      { id:'accept', label:'Accetta il sostegno e assumi l’impegno', effects:{ endorse:{ offerId, mode:'accept' } } },
      { id:'light', label:'Accetta, ma senza impegni (vale meno)', effects:{ endorse:{ offerId, mode:'light' } } },
      { id:'decline', label:'Declina con garbo', effects:{ endorse:{ offerId, mode:'decline' } } }
    ]
  };
}
// The player answers an offer.
function resolveEndorsement(campaign, player, { offerId, mode }, outcome) {
  const box = ensureEndorsements(campaign);
  const offer = box.pending[offerId];
  if (!offer) return;
  delete box.pending[offerId];
  if (mode === 'decline') {
    // Declining a subject that asked for nothing heavy is a snub; declining one that asked for too much is a sign of independence.
    const heavy = ['autonomia', 'indipendenza', 'debito'].includes(ENDORSEMENT_KINDS[offer.subject.kind]?.cost);
    campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation + (heavy ? .3 : 0)));
    outcome.push(refuseEndorsement(campaign, offer.subject, heavy ? 'Resti indipendente: la tua scelta viene apprezzata.' : 'Il rifiuto raffredda i rapporti con chi ti aveva offerto il sostegno.', heavy ? -3 : -8));
    return;
  }
  outcome.push(grantEndorsement(campaign, player, offer.subject, offer.motive, mode));
}

// ---------- the runoff: two finalists, the voters of the others in play ----------
// After the first round the votes of the candidates who are out do not simply "follow the proportions": each of them backs a finalist or
// leaves the voters free, the voters follow in part (how much depends on the rapport with the finalist, on pacts, appeals and strategies),
// part of them stay at home. The player's choices of the two weeks - pacts, appeals, a strategy, the mobilisation - move these numbers.
const finalistsOf = campaign => (campaign.runoffCandidateIds ?? []).map(id => campaign.candidates.find(item => item.id === id)).filter(Boolean);
const AI_ENDORSEMENT = Object.freeze({ diplomatico:.75, opportunista:.6, prudente:.5, territoriale:.45, ideologico:.3, aggressivo:.25 });
// How much the voters of `from` like a finalist, 0–100 (the rapport the rival has with the player stands for the player's with him).
function relationToFinalist(campaign, from, finalist) {
  if (from.isPlayer) return finalist.isPlayer ? 100 : rivalRelationship(campaign, finalist, from.id);
  return rivalRelationship(campaign, from, finalist.id);
}
function runoffRates(campaign, from) {
  const runoff = campaign.runoff;
  const finalists = finalistsOf(campaign);
  const strategy = strategyOf(campaign);
  const pact = (runoff.pacts ?? []).find(item => item.candidateId === from.id) ?? null;
  const backed = pact?.finalistId ?? runoff.stances?.[from.id]?.backs ?? null;
  const rules = RUNOFF_RULES.transfer;
  const other = finalists.find(item => !item.isPlayer) ?? null;
  const rates = {};
  for (const finalist of finalists) {
    const relation = relationToFinalist(campaign, from, finalist) / 100;
    let rate = (backed === finalist.id ? .5 + rules.endorsed : backed ? .08 : rules.neutral) + (relation - .5) * .5 + (pact?.finalistId === finalist.id ? rules.pact : 0);
    if (finalist.isPlayer) {
      rate = rate * (strategy.runoff?.transfer ?? 1) + (backed ? 0 : Number(runoff.appeal ?? 0));
      // "The useful vote": whoever dislikes the other finalist is pushed towards the player.
      if ((strategy.runoff?.against ?? 1) > 1 && other) rate += (1 - relationToFinalist(campaign, from, other) / 100) * .15 * ((strategy.runoff.against - 1) / .35);
    }
    rates[finalist.id] = clamp(rate, rules.min, rules.max);
  }
  const total = Object.values(rates).reduce((sum, value) => sum + value, 0);
  const cap = 1 - RUNOFF_RULES.abstentionFloor;
  if (total > cap) for (const id of Object.keys(rates)) rates[id] = round(rates[id] * cap / total);
  return rates;
}
// Where the voters of the candidates who are out would go with the choices made so far (never changes the campaign).
function transferTable(campaign) {
  const finalists = finalistsOf(campaign);
  const weight = campaign.territories.reduce((sum, area) => sum + area.weight, 0) || 1;
  return campaign.candidates.filter(item => item.status === 'eliminated' && !finalists.includes(item)).map(from => {
    const share = campaign.territories.reduce((sum, area) => sum + Number(area.supportByCandidate[from.id] ?? 0) * area.weight, 0) / weight;
    const rates = runoffRates(campaign, from);
    const pact = (campaign.runoff.pacts ?? []).find(item => item.candidateId === from.id) ?? null;
    return { candidateId:from.id, share:round(share), rates:Object.fromEntries(Object.entries(rates).map(([id, value]) => [id, round(value)])), abstain:round(1 - Object.values(rates).reduce((sum, value) => sum + value, 0)), backs:pact?.finalistId ?? campaign.runoff.stances?.[from.id]?.backs ?? null, pact:Boolean(pact) };
  }).filter(row => row.share > 0);
}
function applyRunoffTransfers(campaign) {
  const runoff = campaign.runoff;
  if (!runoff || runoff.transfers) return;
  const table = transferTable(campaign);
  for (const area of campaign.territories) {
    const shares = area.supportByCandidate;
    for (const row of table) {
      const votes = Number(shares[row.candidateId] ?? 0);
      for (const [id, rate] of Object.entries(row.rates)) shares[id] = round(Number(shares[id] ?? 0) + votes * rate);
      shares[row.candidateId] = 0;
    }
    const alive = Object.keys(shares).filter(id => !['eliminated', 'withdrawn'].includes(campaign.candidates.find(item => item.id === id)?.status));
    const total = alive.reduce((sum, id) => sum + Number(shares[id] ?? 0), 0) || 1;
    for (const id of alive) shares[id] = round(Number(shares[id]) * 100 / total);
  }
  runoff.transfers = table;
  const label = id => candidateLabel(campaign.candidates.find(item => item.id === id) ?? {});
  const lines = table.map(row => `${label(row.candidateId)}: ${Object.entries(row.rates).map(([id, rate]) => `${Math.round(rate * 100)}% a ${campaign.candidates.find(item => item.id === id)?.isPlayer ? 'te' : label(id)}`).join(', ')}, ${Math.round(row.abstain * 100)}% non vota`);
  if (lines.length) addHistory(campaign, 'ballottaggio', `Gli elettori degli esclusi si dividono: ${lines.join('; ')}.`, { source:SOURCE });
}
// What the runoff would be with the choices made so far: the share of each finalist among the votes cast.
export function runoffProjection(campaign) {
  if (campaign.stage !== 'ballottaggio' || !campaign.runoff) return null;
  const view = copy({ ...campaign, history:[] });
  if (!view.runoff.transfers) applyRunoffTransfers(view);
  const groups = aggregateShares(view);
  const total = groups.filter(group => (view.runoffCandidateIds ?? []).includes(group.id)).reduce((sum, group) => sum + group.share, 0) || 1;
  return Object.fromEntries(groups.filter(group => (view.runoffCandidateIds ?? []).includes(group.id)).map(group => [group.id, round(group.share * 100 / total)]));
}
const playerShareNow = campaign => campaign.stage === 'ballottaggio' && campaign.runoff ? (runoffProjection(campaign)?.[campaign.playerCandidateId] ?? weightedShare(campaign, campaign.playerCandidateId)) : weightedShare(campaign, campaign.playerCandidateId);
// The first round is over: who is in, who backs whom, what the two weeks allow.
function startRunoff(campaign, first) {
  campaign.firstRoundResult = first;
  campaign.stage = 'ballottaggio';
  campaign.runoffCandidateIds = first.runoffCandidateIds;
  campaign.totalDays += 14;
  campaign.electionDate = withinDays(campaign.electionDate, 14);
  // Whoever is not in the runoff is out - but not the partners of a finalist's coalition, who stay in it with their votes.
  campaign.candidates.forEach(candidate => { if (!campaign.runoffCandidateIds.includes(candidate.coalitionLeaderId ?? candidate.id)) candidate.status = 'eliminated'; });
  campaign.pendingEvents = [];
  const finalists = finalistsOf(campaign);
  const runoff = { version:1, startedDay:campaign.day, firstRound:Object.fromEntries(first.groups.map(row => [row.candidateId, round(row.percent)])), firstRoundRaw:Object.fromEntries(campaign.candidates.map(item => [item.id, round(weightedShare(campaign, item.id))])), finalists:[...campaign.runoffCandidateIds], stances:{}, pacts:[], appeal:0, freeSwitch:true, transfers:null, source:SOURCE };
  campaign.runoff = runoff;
  if (campaign.crew) campaign.crew.gotv = 0;
  // The candidates who are out decide whether to back a finalist or to leave their voters free.
  for (const from of campaign.candidates.filter(item => item.status === 'eliminated' && !item.isPlayer)) {
    const profile = ensureRivalProfile(campaign, from);
    const wants = draw(campaign) < (AI_ENDORSEMENT[profile?.personality] ?? .45);
    const backs = wants ? [...finalists].sort((a, b) => relationToFinalist(campaign, from, b) - relationToFinalist(campaign, from, a))[0] : null;
    runoff.stances[from.id] = { backs:backs?.id ?? null, kind:backs ? 'endorsement' : 'neutro', since:campaign.day, source:'ai' };
    if (backs) {
      rivalMemory(campaign, from, 'agreement', backs.isPlayer ? campaign.playerCandidateId : backs.id, { action:'sostegno-al-ballottaggio', relationDelta:backs.isPlayer ? 6 : 3, weight:.8 });
      if (backs.isPlayer) addHistory(campaign, 'ballottaggio', `${candidateLabel(from).charAt(0).toLocaleUpperCase('it-IT') + candidateLabel(from).slice(1)} dichiara il proprio sostegno alla tua candidatura.`, { source:SOURCE });
      else addHistory(campaign, 'ballottaggio', `${candidateLabel(from).charAt(0).toLocaleUpperCase('it-IT') + candidateLabel(from).slice(1)} sostiene ${candidateLabel(backs)} al ballottaggio.`, { source:SOURCE });
    }
  }
  addHistory(campaign, 'elezione', 'Primo turno concluso. Inizia il periodo di ballottaggio: gli elettori degli esclusi sono in gioco.', { source:SOURCE });
  // The polls do not stop between the rounds: the first reading of the runoff asks the head-to-head of the finalists.
  pollWave(campaign, 'Dopo il primo turno');
}
// During the two weeks the rival finalists work on the candidates who are out as well (both of them, when the player is out of the runoff).
function runoffRivalMoves(campaign) {
  const runoff = campaign.runoff;
  if (!runoff || campaign.status !== 'active') return;
  for (const rival of finalistsOf(campaign).filter(item => !item.isPlayer)) {
    const profile = ensureRivalProfile(campaign, rival);
    for (const from of campaign.candidates.filter(item => item.status === 'eliminated' && !item.isPlayer)) {
      if ((runoff.pacts ?? []).some(item => item.candidateId === from.id) || runoff.stances[from.id]?.backs === campaign.playerCandidateId) continue;
      const chance = clamp(.12 + relationToFinalist(campaign, from, rival) / 400 + (profile?.personality === 'diplomatico' ? .1 : 0), .05, .4);
      if (draw(campaign) >= chance) continue;
      runoff.stances[from.id] = { backs:rival.id, kind:'pact', since:campaign.day, source:'ai' };
      runoff.pacts.push({ candidateId:from.id, finalistId:rival.id, transfer:.75, day:campaign.day, source:'ai' });
      rivalMemory(campaign, from, 'agreement', rival.id, { action:'apparentamento', relationDelta:8, weight:1 });
      addHistory(campaign, 'ballottaggio', `${candidateLabel(from).charAt(0).toLocaleUpperCase('it-IT') + candidateLabel(from).slice(1)} si apparenta con ${candidateLabel(rival)}.`, { source:SOURCE });
    }
  }
}
// An agreement with a candidate who is out: his voters follow in large part and his lists enter the majority, in exchange for places and promises.
function runoffPact(campaign, player, modifiers, options) {
  const strategy = strategyOf(campaign);
  const pool = campaign.candidates.filter(item => item.status === 'eliminated' && !item.isPlayer && !(campaign.runoff.pacts ?? []).some(pact => pact.candidateId === item.id));
  const target = pool.find(item => item.id === options.targetCandidateId) ?? [...pool].sort((a, b) => relationToFinalist(campaign, b, player) - relationToFinalist(campaign, a, player))[0] ?? null;
  if (!target) return 'Non ci sono candidati esclusi con cui apparentarsi.';
  const relation = relationToFinalist(campaign, target, player);
  const stance = campaign.runoff.stances[target.id];
  const odds = clamp(.25 + relation / 200 + Number(campaign.candidateStats.influence ?? 20) / 300 + (strategy.id === 'apparentamenti' ? .15 : 0) + (stance?.backs === player.id ? .25 : stance?.backs ? -.2 : 0) - (rivalMemoryScore(campaign, target, 'attack', player.id) > 1.5 ? .12 : 0), .08, .88);
  if (draw(campaign) >= odds) {
    rivalMemory(campaign, target, 'rejection', player.id, { action:'apparentamento-fallito', relationDelta:-3, weight:.7 });
    campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation - .3));
    return `${candidateLabel(target).charAt(0).toLocaleUpperCase('it-IT') + candidateLabel(target).slice(1)} non si apparenta con te: pretende più di quanto tu possa dare.`;
  }
  campaign.runoff.stances[target.id] = { backs:player.id, kind:'pact', since:campaign.day, source:'player' };
  campaign.runoff.pacts.push({ candidateId:target.id, finalistId:player.id, transfer:.78, day:campaign.day, source:'player' });
  campaign.commitments = (campaign.commitments ?? 0) + 1;
  obligationOf(campaign, 'apparentamento', candidateLabel(target), `Apparentamento con ${candidateLabel(target)}: posti in giunta e impegni sul programma.`, { toId:target.id, weight:1.4 });
  rivalMemory(campaign, target, 'agreement', player.id, { action:'apparentamento-con-il-giocatore', relationDelta:12, weight:1.2 });
  // Not everybody at home likes sharing the majority.
  campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation - .2));
  return `Apparentamento con ${candidateLabel(target)}: i suoi elettori ti seguono in larga parte e le sue liste entrano nella tua maggioranza; in cambio, posti in giunta e impegni.`;
}
// An appeal to everybody who voted for the others: it works on those who have not chosen yet, and only if they have not been attacked.
function runoffAppeal(campaign, player, modifiers) {
  const runoff = campaign.runoff;
  const attacked = campaign.candidates.filter(item => item.status === 'eliminated' && !item.isPlayer && rivalMemoryScore(campaign, item, 'attack', player.id) > 1.2).length;
  const gain = round(Math.max(.01, .05 * modifiers.total * (attacked ? .5 : 1)));
  runoff.appeal = round(Math.min(.3, Number(runoff.appeal ?? 0) + gain));
  return attacked ? `L’appello arriva anche a chi hai attaccato: ne convince meno (la quota cresce di ${Math.round(gain * 100)} punti).` : `L’appello agli elettori degli esclusi funziona: la quota di quelli che ti seguono cresce di ${Math.round(gain * 100)} punti.`;
}
// The player is out of the runoff: he can still tell his voters whom to vote, and bargain for it.
function runoffStance(campaign, player, options) {
  const finalists = finalistsOf(campaign);
  const target = finalists.find(item => item.id === options.targetCandidateId) ?? [...finalists].sort((a, b) => relationToFinalist(campaign, player, b) - relationToFinalist(campaign, player, a))[0];
  if (!target) return 'Non ci sono finalisti da sostenere.';
  campaign.runoff.stances[player.id] = { backs:target.id, kind:'endorsement', since:campaign.day, source:'player' };
  const other = finalists.find(item => item.id !== target.id);
  rivalMemory(campaign, target, 'aid', player.id, { action:'sostegno-al-ballottaggio', relationDelta:12, weight:1.2 });
  if (other) rivalMemory(campaign, other, 'rejection', player.id, { action:'sostegno-all-avversario', relationDelta:-6, weight:.8 });
  campaign.commitments = (campaign.commitments ?? 0) + 1;
  obligationOf(campaign, 'apparentamento', candidateLabel(target), `Hai indicato di votare ${candidateLabel(target)}: in cambio, un posto per la tua lista e impegni sul programma.`, { toId:target.id, weight:1.1 });
  campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation - .2));
  return `Indichi ai tuoi elettori di votare ${candidateLabel(target)}: in cambio ti aspetti un posto per la tua lista e impegni sul programma.`;
}

function tick(campaign) {
  campaign.day++;
  campaign.currentDate=withinDays(campaign.startedAt,campaign.day);
  crewDay(campaign);
  evaluateNomination(campaign);
  if (campaign.day>0 && campaign.day%7===0) {
    opponentTurn(campaign);
    if (campaign.stage==='ballottaggio') runoffRivalMoves(campaign);
    weeklyPressure(campaign);
    crewWeek(campaign);
    if (!campaign.pendingEvents.length && draw(campaign) < .5) poolEvent(campaign);
    if (!campaign.pendingEvents.length) contextualEvent(campaign,'week');
    recordCampaignPoll(campaign);
  }
  // The institutes poll the race every week, through the runoff, until the vote (the readings never touch the sequence of the campaign).
  if (campaign.day>0 && campaign.day%CAMPAIGN_POLL_RULES.everyDays===0 && campaign.day<campaign.totalDays) pollWave(campaign);
  if (campaign.stage==='ballottaggio' && campaign.day>=campaign.totalDays) { applyRunoffTransfers(campaign); electionDay(campaign, 'ballottaggio'); finish(campaign, campaign.firstRoundResult); }
  else if (campaign.stage==='campagna' && campaign.day>=campaign.totalDays) {
    electionDay(campaign, 'primo-turno');
    const first=runFirstRound(campaign);
    if (first.requiresRunoff) {
      startRunoff(campaign, first);
    } else finish(campaign,first);
  }
}
function finish(campaign,firstRound=null) {
  campaign.result=runFinalElection(campaign,firstRound);
  // Each rival remembers how it ended between him and the player: who finished ahead (the winner first, then by votes of the first round).
  const rows = campaign.result?.groups ?? [];
  const rowOf = id => rows.find(row => row.candidateId === id || (row.memberCandidateIds ?? []).includes(id)) ?? null;
  const rank = row => !row ? 99 : row.id === campaign.result.winnerGroupId ? 0 : 1 + rows.filter(item => item.id !== campaign.result.winnerGroupId && item.percent > row.percent).length;
  const playerRow = rowOf(campaign.playerCandidateId);
  for (const [index, rival] of campaign.candidates.filter(item => !item.isPlayer).entries()) {
    const rivalRow = rowOf(rival.id);
    const together = rivalRow && playerRow && rivalRow.id === playerRow.id;
    const ahead = together ? rivalRow.id === campaign.result.winnerGroupId : rank(rivalRow) < rank(playerRow);
    rivalMemory(campaign, rival, ahead ? 'victory' : 'defeat', campaign.playerCandidateId, { action:'esito-elettorale', relationDelta:together ? (ahead ? 3 : -1) : ahead ? 4 : -2, weight:1.4 + (ahead ? .3 : 0), rank:index + 1 });
  }
  const opening=campaign.expectation?.share ?? campaign.consensusHistory[0]?.value ?? campaign.result.playerShare;
  campaign.partyImpact={...campaign.partyImpact,openingConsensus:opening,electionResult:campaign.result.playerShare,consensusChange:round(campaign.result.playerShare-opening),reputationChange:round(campaign.candidateStats.reputation-campaign.startingStats.reputation),outcome:campaign.result.objectiveMet?'obiettivo-raggiunto':'obiettivo-non-raggiunto',asOf:campaign.currentDate,source:SOURCE};
  campaign.status='finished'; campaign.stage='risultato'; campaign.closedAt=campaign.currentDate;
  campaign.pendingEvents=[];
  campaign.result.description = campaign.result.objectiveMet ? 'Obiettivo raggiunto.' : 'Obiettivo non raggiunto.';
  addHistory(campaign,'risultato',`${campaign.result.outcome?.label ?? campaign.result.description}`,{source:SOURCE});
}

// ---------- the polls of the campaign ----------
// Every institute polls the race (the candidacies in the field, coalitions as one) once a week, from the first day to the vote and through the
// runoff: its sample is the one of the national panel scaled to the size of the race, its error is its own and persists from one week to the next,
// the house effect and the weekly cap are those of the national polls (poll-observatory.js). The readings are pure functions of the seed, the day, the
// institute and the candidacy (a hash, never the random sequence of the campaign), so asking for them changes nothing and reloading a save gives the
// same numbers. They measure the consensus of the campaign; nothing they say moves it.
const pollKey = campaign => campaign.electionType === 'comunale' ? (campaign.municipalityBand === 'oltre-15000' ? 'comunale' : 'comunaleSmall') : campaign.electionType;
const packRows = rows => rows.map(row => [row.partyId, row.share, row.delta ?? 0]);
const unpackRows = rows => (rows ?? []).map(([partyId, share, delta, spread]) => ({ partyId, share, delta, spread }));
function ensurePolls(campaign) {
  if (!campaign.pollObservatory || typeof campaign.pollObservatory !== 'object') {
    campaign.pollObservatory = campaign.polls && !Array.isArray(campaign.polls) ? campaign.polls : {};
  }
  const box = campaign.pollObservatory;
  box.waves = Array.isArray(box.waves) ? box.waves : [];
  box.errors = box.errors && typeof box.errors === 'object' ? box.errors : {};
  box.source = SOURCE;
  return box;
}
export function pollWave(campaign, label = null) {
  if (!campaign || campaign.status !== 'active') return null;
  // In the runoff the polls ask the head-to-head: the finalists, as the projection of the two weeks gives them (the voters of the others in play).
  const head = campaign.stage === 'ballottaggio' ? runoffProjection(campaign) : null;
  const groups = aggregateShares(campaign).filter(group => group.share > 0 && (!head || group.id in head)).map(group => head ? { ...group, share: head[group.id] } : group);
  if (!groups.length) return null;
  const box = ensurePolls(campaign);
  if (box.waves.at(-1)?.day === campaign.day && box.waves.at(-1)?.stage === campaign.stage) return box.waves.at(-1);
  const scale = CAMPAIGN_POLL_RULES.sampleScale[pollKey(campaign)] ?? 1;
  const trueRows = groups.map(group => ({ partyId: group.id, share: group.share }));
  const last = box.waves.at(-1);
  const wave = { id: ids('onda', campaign.seed, campaign.day), day: campaign.day, date: campaign.currentDate, stage: campaign.stage, label, institutes: {}, source: SOURCE };
  const readings = [];
  for (const profile of POLL_INSTITUTES) {
    const scaled = { ...profile, sample: profile.sample.map(value => Math.max(150, Math.round(value * scale / 10) * 10)) };
    const before = last?.institutes?.[profile.id]?.rows;
    const out = readInstitute({ profile: scaled, seed: campaign.seed, week: campaign.day + (campaign.stage === 'ballottaggio' ? 1000 : 0), date: campaign.currentDate, trueRows, previousRows: before ? unpackRows(before) : null, errors: box.errors[profile.id] ?? {}, noise: 1 });
    box.errors[profile.id] = out.errors;
    wave.institutes[profile.id] = { sample: out.reading.sample, margin: out.reading.margin, rows: packRows(out.reading.rows), others: out.reading.others };
    readings.push({ ...out.reading });
  }
  const average = averageOf(readings, last?.average ? unpackRows(last.average) : null);
  wave.average = average ? packRows(average.rows.map(row => ({ ...row }))).map((row, index) => [...row, average.rows[index].spread]) : [];
  // The groups the polls follow, as they stand now: the same ids as the candidacies of the race.
  wave.groups = groups.map(group => ({ id: group.id, members: group.members, partyIds: group.partyIds }));
  box.waves = [...box.waves, wave].slice(-CAMPAIGN_POLL_RULES.waves);
  return wave;
}
// Which audience the player has built so far: each activity speaks to the segments of the electorate that suit it (CAMPAIGN_AUDIENCE).
function audienceOf(activity) {
  return CAMPAIGN_AUDIENCE.activity[activity.id] ?? CAMPAIGN_AUDIENCE.category[activity.category] ?? {};
}
function recordAudience(campaign, activity) {
  const mix = audienceOf(activity);
  if (!Object.keys(mix).length || !(activity.effect > 0 || activity.visibility > 0)) return;
  campaign.audience = campaign.audience && typeof campaign.audience === 'object' ? campaign.audience : {};
  for (const [segment, weight] of Object.entries(mix)) campaign.audience[segment] = round(Number(campaign.audience[segment] ?? 0) + weight * Math.max(.3, activity.effect + activity.visibility * .1));
}
const topicAreaOf = campaign => TOPIC_AREA[campaign.strategy?.topicId] ?? TOPIC_AREA[campaign.nationalContext?.salientTopic] ?? null;
// The profile of a candidacy in the segments: the agenda and the stance of its force, or of its camp when the force is not one of the world; an
// independent speaks to the services of the place. The topic the player's campaign is built on comes first in his agenda.
function profileOf(campaign, candidate) {
  const base = candidate.profile ?? { agenda: ['pa', 'infrastrutture', 'trasporti'], stance: 0 };
  const topic = candidate.isPlayer ? topicAreaOf(campaign) : null;
  return { ...base, agenda: topic ? [topic, ...(base.agenda ?? []).filter(item => item !== topic)].slice(0, 4) : base.agenda };
}
// The observatory of the race, for the page: the readings of every institute, the average, the standing of each group, the territories, and (given the
// society) the segments with their insights. Pure: it reads what the campaign has saved and measures nothing new.
export function campaignObservatory(campaign, { society = null } = {}) {
  if (!campaign?.candidates?.length) return null;
  const box = campaign.pollObservatory ?? (Array.isArray(campaign.polls) ? null : campaign.polls) ?? { waves: [] };
  const waves = box.waves ?? [];
  const latest = waves.at(-1) ?? null;
  // A candidacy is named by the force it stands for (a verified person of the real Parliament, when there is one, is named next to it: `person`).
  const labelOf = candidate => candidate?.isPlayer ? 'La tua candidatura' : candidate?.partyLabel ? candidate.partyLabel : candidate?.realReference?.fullName ?? candidate?.displayName ?? 'Candidatura simulata';
  const byId = new Map(campaign.candidates.map(item => [item.id, item]));
  const head = campaign.status === 'active' && campaign.stage === 'ballottaggio' ? runoffProjection(campaign) : null;
  // A race that is over keeps the last poll it had (the vote of a general or European election is counted on the national map, with its own rows).
  const groupsNow = campaign.status === 'active' ? aggregateShares(campaign).filter(group => !head || group.id in head).map(group => head ? { ...group, share: head[group.id] } : group) : (latest?.groups ?? []).map(group => ({ id: group.id, leaderCandidateId: group.id, share: unpackRows(latest.average).find(row => row.partyId === group.id)?.share ?? 0, members: group.members, partyIds: group.partyIds }));
  const rows = groupsNow.map(group => {
    const leader = byId.get(group.leaderCandidateId ?? group.id);
    const members = (group.members ?? [group.id]).map(id => byId.get(id)).filter(Boolean);
    const line = id => waves.map(wave => unpackRows(wave.average).find(row => row.partyId === id)?.share ?? null);
    const series = line(group.id);
    const current = unpackRows(latest?.average).find(row => row.partyId === group.id) ?? null;
    return { id: group.id, candidateId: leader?.id ?? group.id, label: members.length > 1 ? `${labelOf(leader)} e alleati` : labelOf(leader), isPlayer: members.some(item => item.isPlayer), partyId: leader?.partyId ?? null, person: leader?.realReference?.fullName ?? null, partyKind: leader?.partyKind ?? (leader?.isPlayer ? 'giocatore' : null), independent: Boolean(leader?.independent), rosterReason: leader?.rosterReason ?? null, surveyed: leader?.surveyed ?? null, members: members.map(item => item.id), projection: round(Number(group.share ?? 0)), poll: current?.share ?? null, delta: current?.delta ?? 0, spread: current?.spread ?? null, series };
  }).sort((a, b) => (b.poll ?? b.projection) - (a.poll ?? a.projection));
  const institutes = POLL_INSTITUTES.map(profile => ({ id: profile.id, name: profile.name, mode: profile.mode, weighting: profile.weighting, note: profile.note, history: waves.map(wave => ({ day: wave.day, date: wave.date, stage: wave.stage, ...(wave.institutes?.[profile.id] ? { sample: wave.institutes[profile.id].sample, margin: wave.institutes[profile.id].margin, rows: unpackRows(wave.institutes[profile.id].rows) } : { sample: null, margin: null, rows: [] }) })), latest: latest?.institutes?.[profile.id] ? { day: latest.day, date: latest.date, sample: latest.institutes[profile.id].sample, margin: latest.institutes[profile.id].margin, rows: unpackRows(latest.institutes[profile.id].rows) } : null }));
  const player = campaign.candidates.find(item => item.isPlayer);
  const entries = rows.map(row => { const candidate = byId.get(row.candidateId); return { id: row.id, share: row.poll ?? row.projection, ...profileOf(campaign, candidate ?? {}) }; });
  const boosts = player ? { [rows.find(row => row.isPlayer)?.id ?? player.id]: Object.fromEntries(Object.entries(campaign.audience ?? {}).map(([segment, points]) => [segment, clamp(points * .012, 0, .35)])) } : {};
  const segments = society && entries.length ? segmentSupport(entries, society, { boosts }) : null;
  const territories = campaign.territories.map(area => ({ id: area.id, name: area.name, weight: area.weight, localTrend: area.localTrend ?? 0, shares: Object.entries(area.supportByCandidate ?? {}).map(([id, value]) => ({ candidateId: id, share: round(Number(value)) })).sort((a, b) => b.share - a.share) }));
  const playerRow = rows.find(row => row.isPlayer) ?? null;
  const expectation = campaign.expectation?.share ?? null;
  const flows = latest ? flowsOf(unpackRows(latest.average), entries.map(item => ({ id: item.id, axis: item.axis ?? null }))) : [];
  const second = playerRow && latest ? secondChoice({ id: playerRow.id, axis: entries.find(item => item.id === playerRow.id)?.axis ?? null }, entries.map(item => ({ id: item.id, axis: item.axis ?? null, share: item.share })), { abstain: true }) : [];
  return { waves: waves.length, latest: latest ? { day: latest.day, date: latest.date, stage: latest.stage, label: latest.label ?? null } : null, rows, institutes, average: waves.map(wave => ({ day: wave.day, date: wave.date, stage: wave.stage, rows: unpackRows(wave.average) })), territories, segments, themes: society ? { national: themesOf(society, null, 4), bySegment: Object.fromEntries((society.segments ?? []).map(segment => [segment.id, themesOf(society, segment.id, 2)])) } : null, audience: campaign.audience ?? {}, flows, secondChoice: second, expectation, playerShare: playerRow ? (playerRow.poll ?? playerRow.projection) : null, roster: campaign.roster ?? null, entries };
}

export function createCampaign({career,player,statistics=[],offices=[],territories:userTerritories=[],partyCatalog=[],currentDate,config={}}) {
  if (!career?.id || !player?.id) throw new Error('Crea prima un politico per iniziare la campagna.');
  const type=config.electionType;
  const model=ELECTION_MODELS[type];
  if (!model) throw new Error('Tipo di elezione non valido.');
  const seed=hash(`${career.id}|${currentDate}|${type}|${config.objective ?? 'build'}`);
  const partyId=player.partyId ?? career.partyId ?? null;
  const consensus=Number(gameStat(statistics,player.id,'consensus',4));
  const playerStats={
    popularity:Number(gameStat(statistics,player.id,'popularity',42)), reputation:Number(gameStat(statistics,player.id,'reputation',50)),
    consensus, experience:Number(gameStat(statistics,player.id,'experience',18)), influence:Number(gameStat(statistics,player.id,'influence',14)),
    notoriety:Number(gameStat(statistics,player.id,'notoriety',20)), source:SOURCE
  };
  const partyRecord=partyCatalog.find(item=>item.id===partyId);
  const userOrIndependent= !partyId || partyRecord?.source==='user' || partyRecord?.id?.startsWith('partito-utente-');
  const validRoles={comunale:['sindaco','consigliere'],provinciale:['presidente','consigliere'],regionale:['presidente','consigliere'],politiche:['deputato','senatore','uninominale'],europee:['eurodeputato']};
  const role=config.role ?? (type==='comunale'?'sindaco':type==='provinciale'?'consigliere':type==='regionale'?'presidente':type==='politiche'?'deputato':'eurodeputato');
  if(!validRoles[type].includes(role)) throw new Error('Il ruolo selezionato non è compatibile con il tipo di elezione.');
  const campaignAreas=campaignTerritories(type,player,userTerritories);
  const localTrendRandom=randomFrom(seed ^ 0x27d4eb2f);
  campaignAreas.forEach(area=>{area.localTrend=round((localTrendRandom()-.5)*3);});
  if (type==='comunale') campaignAreas[0].region=player.region;
  const campaignId=ids('campagna',seed);
  const playerCandidateId=ids('candidatura-giocatore',seed);
  const officeTitle=String(offices.find(item=>item.id===player.roleId)?.title??'');
  const incumbency=type==='politiche' && /deputat|senat/i.test(officeTitle) && !/inizial/i.test(officeTitle);
  const candidate=createCandidate({id:playerCandidateId,player:true,partyId,displayName:player.displayName,seed,stats:playerStats});
  // What the player's own candidacy stands for: a party of the database, a party he founded (his own), or nobody.
  candidate.partyKind=!partyId?'indipendente':userOrIndependent?'utente':partyRecord?.source==='simulation'?'simulata':'reale';
  // More forces in the field where more of them really run: a small comune, a big one, a region, the whole country.
  const rivals=RIVALS_BY_TYPE[type]?.[type==='comunale'&&config.municipalityBand!=='oltre-15000'?'small':'default'] ?? 3;
  // A local race is seeded by the place too, and some of its candidacies may stand without a party; a general or European one is the roster of the forces that stand.
  const place=config.place ?? null;
  const independentsOf=()=>{ if(!['comunale','provinciale','regionale'].includes(type)) return 0; const key=type==='comunale'?(config.municipalityBand==='oltre-15000'?'comunale':'comunaleSmall'):type; const chance=CAMPAIGN_POLL_RULES.independents[key]??0; const roll=randomFrom(hash(`indipendenti|${seed}|${place?.municipalityCode??place?.municipality??''}|${place?.region??player.region??''}`)); return (roll()<chance?1:0)+(key==='comunale'&&roll()<chance*.3?1:0); };
  const roster=config.roster?.participants?.length?config.roster:null;
  const opponents=buildOpponents(partyId,partyCatalog,seed,rivals,config.realCandidates??[],{ type, region:player.region ?? null, weights:config.partyWeights ?? {}, roster, place, independents:Number.isFinite(config.independents)?config.independents:independentsOf(), excluded:config.excluded ?? [] });
  const candidates=[candidate,...opponents];
  // What each candidacy stands for in the segments of the electorate: the agenda and the stance of its force (the forces of the world give them), else of its camp.
  const campOf=position=>/destra/.test(position??'')?'destra':/sinistra/.test(position??'')?'sinistra':'centro';
  for(const item of candidates){
    const force=item.partyId?config.forces?.[item.partyId]:null;
    const record=item.partyId?partyCatalog.find(entry=>entry.id===item.partyId):null;
    item.profile=force?{ agenda:force.agenda, stance:stanceOf(force), axis:Number.isFinite(force.axis)?force.axis:null }:item.partyId||item.isPlayer&&partyId?{ agenda:CAMP_PRIORITIES[campOf(record?.politicalPosition??record?.position)].slice(0,3), stance:0, axis:null }:{ agenda:['pa','infrastrutture','trasporti'], stance:0, axis:null };
  }
  // The term that ends: the record of the player when he sat in the administration, or of the administration he now faces (its candidate carries it).
  const local=['comunale','provinciale','regionale'].includes(type);
  const mandateInput=local&&config.mandate&&Number.isFinite(Number(config.mandate.standing))?config.mandate:null;
  const incumbencyRecord=mandateInput?buildIncumbency(mandateInput):null;
  const fieldIncumbent=local&&!incumbencyRecord?.governing&&config.field?.incumbent&&Number.isFinite(Number(config.field.incumbent.score))?config.field.incumbent:null;
  const extra={};
  if(incumbencyRecord) extra[playerCandidateId]=incumbencyRecord.start;
  const rooted=Number.isFinite(config.rooting);
  if(rooted) extra[playerCandidateId]=round(Number(extra[playerCandidateId]??0)+config.rooting);
  if(fieldIncumbent&&opponents[0]) {
    const boost=round(clamp(Number(fieldIncumbent.score)*clamp(Number(fieldIncumbent.confidence??1),.3,1)*INCUMBENCY_RULES.consensus,-INCUMBENCY_RULES.consensusCap,INCUMBENCY_RULES.consensusCap));
    opponents[0].incumbent=true; opponents[0].incumbency={score:round(Number(fieldIncumbent.score)),boost,label:fieldIncumbent.label??'amministrazione uscente',source:SOURCE};
    extra[opponents[0].id]=boost;
  }
  // Rivals the player has already met in this place: the registry of the game recognises them (decayed to today).
  const rivalScope=rivalScopeOf(type,player);
  const history=decayRivalRegistry(config.rivalHistory??[],currentDate);
  const usedKeys=new Set();
  opponents.forEach((rival,index)=>{let key=rivalKeyOf(type,rivalScope,rival,index);while(usedKeys.has(key))key=`${key}#${index}`;usedKeys.add(key);rival.rivalKey=key;});
  const recognized=opponents.map(rival=>[rival,history.find(item=>item.key===rival.rivalKey)]).filter(([,record])=>record);
  for(const [rival,record] of recognized) extra[rival.id]=round(Number(extra[rival.id]??0)+(record.last?.ahead?RIVAL_PERSISTENCE.campaign.confidence:record.last?.ahead===false?-.4:0));
  const rootsConfig=config.roots??{};
  const homeExtra=round(clamp((Number(rootsConfig.territorial??50)-50)/22,-1.6,2.2));
  // In a general or European vote the weight of each force in the polls is the starting point of the race (the roster carries it); the player's own force too.
  const anchors={};
  if(roster&&['politiche','europee'].includes(type)){
    const shareOf=id=>roster.participants.find(item=>item.id===id)?.share;
    for(const item of candidates) { const value=item.isPlayer?(partyId?shareOf(partyId):null):shareOf(item.partyId); anchors[item.id]=Number.isFinite(value)?value:item.isPlayer?.3:.3; }
  }
  initSupport(campaignAreas,candidates,player,seed,{extra,edges:partyEdges(opponents,config.partyWeights??{}),roots:rivalRoots(opponents,campaignAreas,seed),homeExtra,spread:local?1.8:1.2,anchors,rooted});
  const focus=campaignAreas.find(area=>area.name===player.municipality)?.id ?? campaignAreas.find(area=>area.region===player.region)?.id ?? campaignAreas.find(area=>area.constituency && (config.constituency === area.constituency))?.id ?? campaignAreas[0].id;
  const deadlineDay=model.nominationDays;
  const internalSupport=partyId && !userOrIndependent ? round(1.5+playerStats.influence*.035+(incumbency?1.5:0)) : 10;
  const nomination={status:userOrIndependent?'approved':'pending',internalSupport,requiredSupport:7,deadlineDay,listPosition:role==='uninominale'?null:6,source:SOURCE,
    incumbent:incumbency,incumbencyNote:incumbency?'La ricandidatura è da negoziare e non è garantita.':null};
  const governingIncumbent=Boolean(incumbencyRecord?.active&&incumbencyRecord.governing);
  if(incumbencyRecord&&nomination.status==='pending') {
    // The party weighs the record: a mandate that went well is hard to turn down, one that went badly is an invitation to look elsewhere.
    nomination.internalSupport=round(clamp(nomination.internalSupport+incumbencyRecord.nomination,0,10));
    nomination.requiredSupport=governingIncumbent&&incumbencyRecord.standing>20?6:incumbencyRecord.standing<-25?8:7;
    if(governingIncumbent) { nomination.incumbent=true; nomination.incumbencyNote=incumbencyRecord.standing>=15?'Il mandato è andato bene: la ricandidatura è più facile.':incumbencyRecord.standing<=-15?'Il mandato è andato male: la ricandidatura è in discussione.':'La ricandidatura è da negoziare e non è garantita.'; }
  }
  const baseMoney=type==='comunale'?9500:type==='provinciale'?6000:type==='regionale'?18000:28000;
  const initialResources={money:baseMoney+Math.round(playerStats.influence*55),volunteers:Math.max(8,Math.round(12+playerStats.influence*.25)),organization:Math.max(12,Math.round(24+playerStats.experience*.22)),visibility:Math.round(playerStats.notoriety*.22),politicalCapital:Math.max(5,Math.round(8+playerStats.influence*.13)),source:SOURCE};
  candidate.resources={...initialResources};
  const allPartyRefs=partyCatalog.filter(item=>candidates.some(candidate=>candidate.partyId===item.id)).map(item=>({id:item.id,source:item.source,verified:item.verified===true}));
  const internalRandom=randomFrom(seed ^ 0xc2b2ae35);
  const internalCandidates=userOrIndependent?[]:[0,1].map(index=>({id:ids('candidatura-interna',seed,index),displayName:`Candidatura interna simulata ${index+1}`,partyId,internalSupport:round(2.8+internalRandom()*3.5),lastAction:'Sta cercando sostegno nel partito.',source:SOURCE}));
  const strategy = config.strategy && CAMPAIGN_STRATEGIES[config.strategy] && strategyStages(config.strategy).includes('campagna') ? config.strategy : null;
  const campaign={
    id:campaignId,careerId:career.id,playerId:player.id,electionType:type,electionLabel:model.label,model:model.model,
    modelSource:model.source,modelReference:{source:'real',verified:model.referenceVerified!==false,sourceUrl:model.referenceUrl,sourceName:model.referenceName,verifiedAt:'2026-09-22',validFrom:null,validTo:null},
    ruleFacts:type==='europee'?{threshold:EUROPEAN_THRESHOLD}:null,
    municipalityBand:type==='comunale'?(config.municipalityBand==='oltre-15000'?'oltre-15000':'fino-15000'):null,
    objective:config.objective??'build',playerCandidateId,partyId,independent:userOrIndependent && !partyId,partyReferences:allPartyRefs,
    initialLevel:career.initialLevel,territoryId:career.territoryId,homeRegion:player.region ?? null,territories:campaignAreas,candidates,resources:initialResources,
    candidateStats:playerStats,startingStats:{...playerStats},nomination,internalCandidates,candidacy:{role,listPosition:role==='uninominale'?null:6,territoryId:focus,incumbent:incumbency||governingIncumbent},incumbency:incumbencyRecord,list:buildList({seed,type,role,areas:campaignAreas}),listContext:config.listContext?{...config.listContext,source:SOURCE}:null,obligations:[],
    status:'active',stage:'campagna',startedAt:currentDate,currentDate,electionDate:withinDays(currentDate,model.campaignDays),
    day:0,totalDays:model.campaignDays,daysToNomination:deadlineDay,firstRoundResult:null,result:null,runoffCandidateIds:null,
    alliances:[],events:[],pendingEvents:[],history:[],consensusHistory:[],polls:[],pollObservatory:{waves:[],errors:{}},pollErrors:{},aiTurns:0,preparationByTopic:Object.fromEntries(DEBATE_TOPICS.map(topic=>[topic.id,0])),
    nationalContext:{moodIndex:Math.round(42+randomFrom(seed ^ 0x165667b1)()*18),macroTrend:round((randomFrom(seed ^ 0x9e3779b9)()-.5)*4),salientTopic:DEBATE_TOPICS[Math.floor(randomFrom(seed ^ 0x85ebca6b)()*DEBATE_TOPICS.length)].id,source:SOURCE},
    media:{coverage:0,reactions:0,criticalEvents:0,source:SOURCE},partyImpact:{internalSupport:internalSupport,source:SOURCE},
    strategy:null,activityUses:{},crisis:null,commitments:0,eventLog:{},electionDays:[],partyTrend:0,
    crew:newCrew(playerStats,{quality:config.crew?.quality??null,fieldEdge:config.crew?.fieldEdge??0,organization:initialResources.organization}),rivalScope,endorsements:{known:Array.isArray(config.endorsers)?config.endorsers.filter(item=>item?.key&&item.areaId).map(item=>({key:item.key,kind:item.kind,areaId:item.areaId,label:item.label,relation:Number(item.relation??50)})):[],given:[],refused:[],pending:{},offers:0,source:SOURCE},
    anchored:Object.keys(anchors).length>0,audience:{},electorate:electorateOf(config,type),roster:roster?{ type, regionId:roster.regionId??null, others:roster.others??null, participants:roster.participants.map(item=>({ id:item.id, label:item.label, abbreviation:item.abbreviation??null, refSource:item.refSource??'real', share:item.share, surveyed:item.surveyed, reason:item.reason, regional:Boolean(item.regional), isPlayer:Boolean(item.isPlayer) })), source:SOURCE }:null,
    seed,rngState:seed,source:SOURCE
  };
  addHistory(campaign,'inizio',`${model.label}: inizia una campagna di ${model.campaignDays} giorni nello scenario simulato.`,{source:SOURCE});
  for(const [rival,record] of recognized) recognizeRival(campaign,rival,record);
  // The forces already standing with the player's (an intesa or a coalition of the world, the coalition of a general or European vote) start the race allied.
  const alliedParties=new Set(config.allies??[]);
  if(alliedParties.size) for(const rival of campaign.candidates.filter(item=>!item.isPlayer&&item.partyId&&alliedParties.has(item.partyId))) addHistory(campaign,'alleanza',formPlayerAlliance(campaign,campaign.candidates.find(item=>item.isPlayer),rival,'Intesa già in vigore tra i due partiti',2,{existing:true}),{source:SOURCE});
  const openingWeight=campaignAreas.reduce((sum,item)=>sum+item.weight,0)||1;
  const openingConsensus=campaignAreas.reduce((sum,item)=>sum+Number(item.supportByCandidate[playerCandidateId]??0)*item.weight,0)/openingWeight;
  campaign.consensusHistory.push({day:0,date:currentDate,value:round(openingConsensus),source:SOURCE});
  if (strategy) {
    const opts = { topicId: config.topicId ?? null, targetId: config.targetId ?? null };
    const withStrategy = setCampaignStrategy(campaign, strategy, CAMPAIGN_STRATEGIES[strategy].needsTopic && !opts.topicId ? { ...opts, topicId: campaign.nationalContext.salientTopic } : opts);
    Object.assign(campaign, withStrategy);
  }
  recordCampaignPoll(campaign);
  return campaign;
}
// What the player may reasonably expect, set once the campaign starts from the polls and the opening projection.
export function setExpectation(campaign, { pollShare = null } = {}) {
  const share = round(weightedShare(campaign, campaign.playerCandidateId));
  campaign.expectation = { share, pollShare, setOn:campaign.currentDate, ...(campaign.incumbency?.expectation ? { pressure:campaign.incumbency.expectation } : {}), source:SOURCE };
  if (campaign.consensusHistory[0]) campaign.consensusHistory[0] = { ...campaign.consensusHistory[0], value:share };
  // The opening poll of the race: what the institutes read on the first day, from the projection the campaign starts with.
  pollWave(campaign, 'Apertura della campagna');
  return campaign;
}

export function performCampaignActivity(input,activityId,options={}) {
  const campaign=copy(input);
  if(campaign.status!=='active') throw new Error('Questa campagna è già conclusa.');
  const activity=CAMPAIGN_ACTIVITIES.find(item=>item.id===activityId);
  if(!activity) throw new Error('Attività di campagna non riconosciuta.');
  if(campaign.day+activity.days>campaign.totalDays) throw new Error('Non ci sono abbastanza giorni prima del voto per questa attività.');
  const player=campaign.candidates.find(item=>item.isPlayer);
  if(!resourceAffordable(player.resources,activity.cost)) throw new Error('Risorse insufficienti per questa attività.');
  if(activity.id==='debate' && campaign.nomination.status==='pending') throw new Error('Prima devi ottenere la candidatura del partito.');
  const availability = activityAvailability(campaign, activity);
  if (!availability.ok) throw new Error(availability.reason);
  charge(player.resources,activity.cost);
  const crew=ensureCrew(campaign);
  const area=targetArea(campaign,options.territoryId);
  const topic=DEBATE_TOPICS.find(item=>item.id===options.topicId)??DEBATE_TOPICS.find(item=>item.id===campaign.strategy?.topicId)??DEBATE_TOPICS[0];
  const strategy = strategyOf(campaign);
  const modifiers = activityModifiers(campaign, activity, { ...options, territoryId:area?.id, topicId:topic.id });
  const factor = modifiers.total;
  campaign.activityUses = { ...(campaign.activityUses ?? {}), [activity.id]:(campaign.activityUses?.[activity.id] ?? 0) + 1 };
  recordAudience(campaign, activity);
  let report='';
  if(activity.internalSupport) {
    if(campaign.nomination.status==='pending') {
      campaign.nomination.internalSupport=round(clamp(campaign.nomination.internalSupport+activity.internalSupport*strategy.mods.internal+Math.min(1,campaign.candidateStats.influence*.025),0,10));
      if(campaign.nomination.listPosition!==null) campaign.nomination.listPosition=Math.max(1,campaign.nomination.listPosition-(activity.listPosition??0));
      campaign.partyImpact.internalSupport=campaign.nomination.internalSupport;
      report=campaign.nomination.listPosition===null?`Sostegno interno ${campaign.nomination.internalSupport}/10.`:`Sostegno interno ${campaign.nomination.internalSupport}/10; posizione provvisoria ${campaign.nomination.listPosition}.`;
    } else if(campaign.nomination.status==='approved'&&activity.listPosition&&campaign.candidacy.listPosition!==null) {
      campaign.candidacy.listPosition=Math.max(1,campaign.candidacy.listPosition-activity.listPosition);
      campaign.nomination.listPosition=campaign.candidacy.listPosition;
      report=`La trattativa ha migliorato la tua posizione in lista: numero ${campaign.candidacy.listPosition}.`;
    }
  }
  const baseSupport = () => activity.effect*(.55+player.resources.organization/120+player.resources.volunteers/100)*(0.78+campaign.candidateStats.reputation/180+campaign.nationalContext.macroTrend*.006)*(1.14+Number(area.localTrend??0)*.025-supportAt(campaign,area.id)/125);
  if(activity.rest) {
    const before=Math.max(...Object.values(crew.teams).map(team=>Number(team.fatigue??0)));
    restCrew(campaign,activity.days);
    report=`Giornata di riposo: la fatica delle squadre scende da ${Math.round(before)} a ${Math.round(Math.max(...Object.values(crew.teams).map(team=>Number(team.fatigue??0))))}.`;
  } else if(activity.id==='debate_prep') {
    campaign.preparationByTopic[topic.id]=round(Math.min(24,(campaign.preparationByTopic[topic.id]??0)+activity.preparation+campaign.candidateStats.experience*.025));
    report=`Preparazione simulata su “${topic.label}”: ${campaign.preparationByTopic[topic.id]}/24.`;
  } else if(activity.id==='debate') {
    const opponent=campaign.candidates.find(item=>item.id===options.opponentId&&item.status==='active'&&!item.isPlayer)??activeOpponents(campaign).sort((a,b)=>supportAt(campaign,area.id,b.id)-supportAt(campaign,area.id,a.id))[0];
    const pressure=clamp((campaign.totalDays-campaign.day)/campaign.totalDays*100,0,100);
    const preparedness=campaign.preparationByTopic[topic.id]??0;
    const reputation=campaign.candidateStats.reputation*.17;
    const visibility=campaign.resources.visibility*.07;
    const pressurePenalty=Math.max(0,45-pressure)*.1;
    const playerScore=preparedness+reputation+visibility-pressurePenalty+draw(campaign)*5+(topic.id===campaign.nationalContext.salientTopic?1.5:0);
    const rivalScore=(opponent?.campaignStats.debateReadiness??40)*.48+(opponent?.campaignStats.reputation??50)*.15+draw(campaign)*5;
    const edge=playerScore-rivalScore;
    if(edge>1.5){playerMove(campaign,.62*factor,area.id);if(opponent&&strategy.id==='contrasto'&&strategy.targetId===opponent.id)playerTransfer(campaign,opponent.id,.25*factor);campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation+.45));report=`Il confronto su “${topic.label}” ha favorito la tua candidatura nello scenario simulato.`;}
    else if(edge< -1.5){playerMove(campaign,-.55,area.id);campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-.55));report=`Il confronto su “${topic.label}” ha lasciato un’impressione incerta nello scenario simulato.`;}
    else {report=`Il confronto su “${topic.label}” è terminato senza un vantaggio netto nello scenario simulato.`;}
    campaign.media.coverage=round(clamp(campaign.media.coverage+activity.visibility));
    campaign.media.reactions++;
  } else if(activity.runoffPact) {
    report=runoffPact(campaign,player,modifiers,options);
  } else if(activity.runoffAppeal) {
    report=runoffAppeal(campaign,player,modifiers);
    playerMove(campaign,Math.min(.7,baseSupport()*factor*.6));
  } else if(activity.runoffStance) {
    report=runoffStance(campaign,player,options);
  } else if(activity.scouting) {
    report=scoutCandidates(campaign,player,modifiers,area);
  } else if(activity.listNegotiation) {
    report=negotiateList(campaign,player,modifiers);
  } else if(activity.id==='ally_meeting') {
    report=negotiateAllianceInPlace(campaign,options.targetCandidateId,true);
  } else if(activity.category==='resources') {
    const raised=Math.max(200,Math.round(activity.moneyGain*(.55+draw(campaign)*.9)*(campaign.candidateStats.reputation/60)*modifiers.phase*modifiers.repetition));
    player.resources.money+=raised;
    campaign.resources.money=player.resources.money;
    report=`Raccolta simulata: +€${raised.toLocaleString('it-IT')}.`;
  } else if(activity.training) {
    const volunteers = Math.max(1, Math.round(3 * modifiers.phase * modifiers.repetition));
    const organization = Math.max(1, Math.round(3 * modifiers.phase * modifiers.repetition));
    player.resources.volunteers += volunteers; player.resources.organization = clamp(player.resources.organization + organization, 0, 100);
    const quality = round(CREW_RULES.quality.trainGain * modifiers.phase * modifiers.repetition);
    crew.quality = round(clamp(crew.quality + quality, CREW_RULES.quality.min, CREW_RULES.quality.max)); crew.trained = (crew.trained ?? 0) + 1;
    report = `Squadre più preparate: volontari +${volunteers}, organizzazione +${organization}, qualità +${String(quality).replace('.', ',')}.`;
  } else if(activity.crisis) {
    const handled = draw(campaign) < clamp(.45 + (campaign.candidateStats.reputation - 40) / 60, .2, .9);
    if (handled) { report = `La polemica “${campaign.crisis.title}” si sgonfia: la spiegazione convince.`; campaign.crisis = null; campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation + .5)); }
    else { campaign.crisis.severity = Math.max(.5, round(campaign.crisis.severity - .4)); report = 'La spiegazione attenua la polemica, ma non la chiude.'; }
  } else if(activity.endorsement) {
    // The player asks: the subject (more often one the player knows) says yes depending on the credibility of the player and on the rapport.
    const subject=drawEndorser(campaign);
    const odds=clamp(.3+(campaign.candidateStats.reputation-50)/60+campaign.candidateStats.influence/250+(Number(subject.relation??50)-50)/150,.12,.85);
    if(draw(campaign)<odds) report=grantEndorsement(campaign,player,subject,endorsementMotive(campaign,subject),'accept',modifiers);
    else { campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-.4)); report=refuseEndorsement(campaign,subject,`${subject.label} non ti sostiene e il no finisce sui giornali locali.`,-4); }
  } else if(activity.pact) {
    const odds = clamp(.35 + campaign.candidateStats.influence / 200 + (strategy.id === 'coalizione' ? .15 : 0) + (player.resources.politicalCapital > 6 ? .05 : 0), .15, .85);
    if (draw(campaign) < odds) { playerMove(campaign, Math.min(1.8, baseSupport() * factor * 1.2), area.id); player.resources.volunteers += 2; campaign.commitments = (campaign.commitments ?? 0) + 1; report = `Accordo territoriale in ${area.name}: sostegno e volontari, in cambio di impegni per l’area.`; }
    else { campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation - .3)); report = 'L’accordo salta all’ultimo: le reti locali restano neutrali.'; }
  } else if(activity.rival) {
    campaign.lastAttackDay = campaign.day;
    const rival = campaign.candidates.find(item => item.id === (options.opponentId ?? strategy.targetId) && item.status === 'active' && !item.isPlayer) ?? strongestRival(campaign);
    if (rival) {
      const backlash = campaign.candidateStats.reputation < 45 && draw(campaign) < .35 * strategy.risk;
      if (backlash) { playerTransfer(campaign, rival.id, -.3); campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation - .8)); rivalMemory(campaign, rival, 'attack', player.id, { action:'attacco-del-giocatore', relationDelta:-10, weight:1.4 }); report = `L’attacco a ${rival.realReference?.fullName ?? 'un avversario'} viene percepito come scorretto: effetto boomerang.`; }
      else { playerTransfer(campaign, rival.id, round(Math.min(1.6, .9 * factor))); rivalMemory(campaign, rival, 'attack', player.id, { action:'attacco-del-giocatore', relationDelta:-7, weight:1 }); report = `Il confronto con ${rival.realReference?.fullName ?? 'la candidatura rivale'} sposta voti dalla sua parte alla tua.`; }
    } else report = 'Non ci sono avversari da mettere a confronto.';
  } else {
    let support=baseSupport()*factor;
    // Claiming results in a discontented country, or campaigning on discontent when people are content, backfires.
    if (activity.mood && modifiers.mood < .6) support = -Math.abs(support) * .5;
    if (activity.coalition) for (const alliance of campaign.alliances.filter(item => item.status === 'active' && item.leaderCandidateId === player.id)) alliance.strength = round((alliance.strength ?? 1) + .1);
    if (activity.gotv) support = Math.min(1.2, support * .7);
    if(activity.scope==='national') playerMove(campaign,Math.min(.85,support*.55));
    else if(activity.scope==='broad') playerMove(campaign,Math.min(.7,support*.6));
    else if(activity.scope!=='internal'&&activity.effect) playerMove(campaign,Math.min(1.5,support),area.id);
    if (activity.topic) campaign.preparationByTopic[topic.id]=round(Math.min(24,(campaign.preparationByTopic[topic.id]??0)+(activity.preparation ?? 0)));
    if (activity.commitment) campaign.commitments = (campaign.commitments ?? 0) + 1;
    if (activity.reputation) campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation + activity.reputation));
    if(activity.effect && activity.scope!=='internal') {
      campaign.candidateStats.consensus=round(clamp(campaign.candidateStats.consensus+Math.min(.5,support*.24)));
      player.campaignStats.consensus=campaign.candidateStats.consensus;
      report=support < 0 ? 'Il messaggio non convince: il clima del Paese lo ribalta contro di te.' : `Variazione territoriale contenuta; presenza attuale ${supportAt(campaign,area.id).toFixed(1)}%.`;
    }
  }
  if(activity.preparation && !['debate_prep','issue_focus'].includes(activity.id)) campaign.candidateStats.experience=round(clamp(campaign.candidateStats.experience+.1));
  player.resources.organization=clamp(player.resources.organization+(activity.id==='list_building'?2:activity.id==='party_meeting'&&campaign.nomination.status==='approved'?1:0),0,100);
  if(campaign.nomination.status==='approved'&&['party_meeting','list_building'].includes(activity.id)) campaign.candidateStats.influence=round(clamp(campaign.candidateStats.influence+.25));
  if(!activity.rest) {
    const teamId=teamOfActivity(activity);
    const team=crew.teams[teamId];
    team.fatigue=round(clamp(Number(team.fatigue??0)+crewLoad(campaign,player,activity,teamId)));
    team.busyUntil=campaign.day+activity.days;
    if(activity.gotv) crew.gotv=round(Math.min(CREW_RULES.mobilization.gotvCap,Number(crew.gotv??0)+CREW_RULES.mobilization.gotv*modifiers.crew*modifiers.repetition));
  }
  const visibilityGain = activity.visibility * (strategy.id === 'media' ? 1.2 : 1);
  campaign.candidateStats.notoriety=round(clamp(campaign.candidateStats.notoriety+visibilityGain*.075));
  campaign.resources.visibility=round(clamp(campaign.resources.visibility+visibilityGain));
  campaign.media.coverage=round(clamp(campaign.media.coverage+activity.visibility*.45));
  // A tired team makes mistakes; a well-trained one makes fewer.
  const crewRisk=activity.rest?0:Math.max(0,Number(crew.teams[teamOfActivity(activity)].fatigue??0)-CREW_RULES.fatigue.tired)*CREW_RULES.fatigue.risk*1.5-(crew.quality-CREW_RULES.quality.base)*.04;
  const risk=activity.rest?0:clamp((activity.risk+crewRisk+campaign.candidateStats.notoriety*.18-campaign.candidateStats.reputation*.05)*strategy.risk,0,75);
  if(risk&&draw(campaign)<risk/100) {
    if(activity.category==='media') {
      campaign.media.criticalEvents++;
      campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-.65));
      report += ' L’esposizione ha generato una reazione critica.';
      if (!campaign.crisis && draw(campaign) < .25) { campaign.crisis = { title:`Polemica dopo: ${activity.label.toLowerCase()}`, since:campaign.day, severity:1, weeks:0, source:SOURCE }; report += ' La polemica rischia di trascinarsi.'; }
      contextualEvent(campaign,'media');
    } else if(activity.category==='event') {
      player.resources.organization=Math.max(0,player.resources.organization-1);
      campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-.45));
      playerMove(campaign,-.3,area.id);
      report += ' Un imprevisto organizzativo ha ridotto l’impatto dell’evento.';
      campaign.media.reactions++;
    } else if(['territory','ads'].includes(activity.category)) {
      player.resources.volunteers=Math.max(0,player.resources.volunteers-1);
      player.resources.organization=Math.max(0,player.resources.organization-1);
      playerMove(campaign,-.22,area.id);
      report += activity.category === 'ads' ? ' Qualche manifesto strappato e una polemica sui costi.' : ' Un problema logistico ha ridotto la resa dell’iniziativa.';
    } else if(activity.category==='internal') {
      player.resources.organization=Math.max(0,player.resources.organization-1);
      campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-.3));
      if(campaign.nomination.status==='pending') campaign.nomination.internalSupport=round(clamp(campaign.nomination.internalSupport-.45));
      report += ' La riunione ha lasciato una frizione nel coordinamento.';
    } else if(activity.category==='resources') {
      if (activity.id === 'fundraising_dinner') { campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation - .8)); report += ' La lista degli invitati finisce sui giornali: domande imbarazzanti sui finanziatori.'; }
      else { const loss=Math.min(650,player.resources.money); player.resources.money-=loss; report += ` La raccolta ha avuto un costo organizzativo di €${loss.toLocaleString('it-IT')}.`; }
    }
  }
  if(activity.category==='media'&&!campaign.pendingEvents.length) contextualEvent(campaign,'media');
  addHistory(campaign,activity.category,`${activity.label}${area&&!['internal','any','national','broad'].includes(activity.scope)?' — '+area.name:''}${report?' · '+report:''}`,{activityId,territoryId:area?.id,factor,source:SOURCE});
  if(activity.category==='event'&&!campaign.pendingEvents.length) contextualEvent(campaign,'public-event');
  if(activity.category==='internal'&&!campaign.pendingEvents.length) contextualEvent(campaign,'internal');
  for(let day=0;day<activity.days;day++) tick(campaign);
  if(activity.category!=='media'&&campaign.day>0&&campaign.day%7===0&&!campaign.pendingEvents.length) contextualEvent(campaign,activity.category);
  const own=campaign.status==='active'?playerShareNow(campaign):campaign.territories.reduce((sum,item)=>sum+Number(item.supportByCandidate[player.id]??0)*item.weight,0)/campaign.territories.reduce((sum,item)=>sum+item.weight,0);
  campaign.consensusHistory.push({day:campaign.day,date:campaign.currentDate,value:round(own),source:SOURCE});
  campaign.consensusHistory=campaign.consensusHistory.slice(-16);
  campaign.resources={...player.resources,visibility:campaign.resources.visibility,source:SOURCE};
  return campaign;
}

function negotiateAllianceInPlace(campaign,targetId,costAlreadyPaid=false) {
  const player=campaign.candidates.find(item=>item.isPlayer);
  if(campaign.stage==='ballottaggio') return 'Tra i due turni gli accordi sono apparentamenti con i candidati esclusi.';
  const choices=activeOpponents(campaign).filter(item=>!campaign.alliances.some(alliance=>alliance.status==='active'&&alliance.partnerCandidateId===item.id));
  const target=choices.find(item=>item.id===targetId)??choices.sort((a,b)=>a.relationship-b.relationship)[0];
  if(!target) return 'Non ci sono candidature disponibili per un nuovo accordo.';
  if(!costAlreadyPaid&&player.resources.politicalCapital<3) return 'Il capitale politico non basta per aprire questa trattativa.';
  const led = campaign.alliances.filter(item => item.status === 'active' && item.leaderCandidateId === player.id).length;
  if (led >= 2) return 'La coalizione è già completa: un terzo alleato non entra nell’accordo.';
  // A partner of other times is easier to convince, one who remembers a betrayal almost never joins.
  const bonus = (strategyOf(campaign).allianceBonus ?? 0) + (target.recognition?.allied ? 10 : 0);
  // Whoever is ahead of you does not join your coalition; the strongest rival almost never does.
  const ahead = weightedShare(campaign, target.id) - weightedShare(campaign, player.id);
  const leaderPenalty = (target.id === strongestRival(campaign)?.id ? .15 : ahead > 3 ? .5 : 1) * (target.recognition?.betrayed ? .4 : 1);
  const chance=clamp((18+bonus+target.relationship*57+campaign.candidateStats.influence*.22-(supportAt(campaign,campaign.territories[0].id,target.id)-supportAt(campaign,campaign.territories[0].id,player.id))*.6-led*15)*leaderPenalty,3,85);
  if(!costAlreadyPaid) player.resources.politicalCapital-=3;
  if(draw(campaign)*100<chance) return formPlayerAlliance(campaign,player,target,'Sostegno condiviso e lista comune nello scenario simulato.',12);
  campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-.35));
  rivalMemory(campaign, target, 'rejection', player.id, { action:'accordo-rifiutato-dal-giocatore', relationDelta:-4, weight:.8 });
  return `La trattativa con una candidatura simulata è fallita; il costo politico resta.`;
}

// The partner joins the coalition of the player: part of his voters follows the agreement, the machine grows a little, the party feels the price of sharing the list.
function formPlayerAlliance(campaign,player,target,terms,relationDelta,{ existing=false }={}) {
  target.status='allied'; target.coalitionLeaderId=player.id;
  const transfer = mergeAlliance(campaign, player.id, target);
  campaign.alliances.push({id:ids('alleanza',campaign.seed,campaign.day+campaign.alliances.length),leaderCandidateId:player.id,partnerCandidateId:target.id,status:'active',transfer,terms,formedOn:campaign.currentDate,existing,source:SOURCE});
  rivalMemory(campaign, target, 'agreement', player.id, { action:'accordo-con-il-giocatore', relationDelta, weight:existing?.6:1.2 });
  // An agreement made today costs a little at home and brings a little help; one that was already in force when the campaign starts is a given.
  if (existing) return `Corri con ${candidateLabel(target)}: l’intesa tra i due partiti era già in vigore.`;
  player.resources.volunteers+=2; player.resources.organization+=1;
  if (campaign.nomination.status === 'pending') campaign.nomination.internalSupport = round(clamp(campaign.nomination.internalSupport - .5, 0, 10));
  return `Accordo raggiunto con una candidatura simulata: il ${Math.round(transfer * 100)}% dei suoi elettori segue l’intesa, gli altri votano altrove.`;
}
export function negotiateCampaignAlliance(input,targetId=null) {
  const campaign=copy(input);
  if(campaign.status!=='active') throw new Error('La campagna è conclusa.');
  const player=campaign.candidates.find(item=>item.isPlayer);
  if(player.resources.politicalCapital<3) throw new Error('Servono almeno 3 punti di capitale politico.');
  const report=negotiateAllianceInPlace(campaign,targetId,false);
  addHistory(campaign,'alleanza',report,{source:SOURCE});
  campaign.resources={...player.resources,visibility:campaign.resources.visibility,source:SOURCE};
  return campaign;
}

export function breakCampaignAlliance(input,allianceId) {
  const campaign=copy(input);
  const alliance=campaign.alliances.find(item=>item.id===allianceId&&item.status==='active');
  if(!alliance) throw new Error('Accordo attivo non trovato.');
  if(alliance.leaderCandidateId!==campaign.playerCandidateId) throw new Error('L’accordo tra le altre candidature non è sotto il tuo controllo.');
  alliance.status='broken'; alliance.endedOn=campaign.currentDate;
  const partner=campaign.candidates.find(item=>item.id===alliance.partnerCandidateId);
  if(partner){partner.status='active';partner.coalitionLeaderId=null;rivalMemory(campaign, partner, 'betrayal', campaign.playerCandidateId, { action:'rottura-dell-alleanza', relationDelta:-18, weight:1.7 });}
  campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-1.2));
  campaign.candidates.find(item=>item.isPlayer).resources.politicalCapital=Math.max(0,campaign.candidates.find(item=>item.isPlayer).resources.politicalCapital-1);
  addHistory(campaign,'alleanza','Hai interrotto un accordo; il rapporto politico ne risente.',{source:SOURCE});
  return campaign;
}

function areaFor(campaign, key) {
  if (!key) return null;
  if (key === 'weakest') return campaign.territories.reduce((a,b)=>supportAt(campaign,a.id)<supportAt(campaign,b.id)?a:b,campaign.territories[0])?.id;
  if (key === 'strongest') return campaign.territories.reduce((a,b)=>supportAt(campaign,a.id)>=supportAt(campaign,b.id)?a:b,campaign.territories[0])?.id;
  if (key === 'focus') return campaign.candidacy?.territoryId ?? campaign.territories[0]?.id;
  return campaign.territories.some(area => area.id === key) ? key : null;
}
export function decideCampaignEvent(input,eventId,choiceId) {
  const campaign=copy(input);
  const index=campaign.pendingEvents.findIndex(item=>item.id===eventId);
  if(index<0) throw new Error('Evento non più disponibile.');
  const event=campaign.pendingEvents[index];
  const choice=event.choices.find(item=>item.id===choiceId);
  if(!choice) throw new Error('Scelta non valida per questo evento.');
  const player=campaign.candidates.find(item=>item.isPlayer);
  const effect=choice.effects??{};
  const outcome=[];
  for(const key of ['money','volunteers','organization','politicalCapital']) if(effect[key]) player.resources[key]=Math.max(0,Number(player.resources[key]??0)+effect[key]);
  if(effect.visibility){campaign.resources.visibility=clamp(campaign.resources.visibility+effect.visibility);campaign.media.coverage=clamp(campaign.media.coverage+effect.visibility);}
  if(effect.notoriety) campaign.candidateStats.notoriety=round(clamp(campaign.candidateStats.notoriety+effect.notoriety));
  if(effect.reputation) campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation+effect.reputation));
  if(effect.support) {
    const trend = effect.partyTrend ? ((campaign.partyTrend ?? 0) < -.3 ? -.6 : (campaign.partyTrend ?? 0) > .2 ? 1.3 : 1) : 1;
    playerMove(campaign,effect.support*trend,areaFor(campaign,effect.territory));
    if (trend < 0) outcome.push('Il partito è in calo: la tappa del leader ti costa voti.');
  }
  if(effect.internalSupport) campaign.nomination.internalSupport=round(clamp(campaign.nomination.internalSupport+effect.internalSupport,0,10));
  if(effect.quality||effect.fatigue||effect.rest) {
    const crew=ensureCrew(campaign);
    if(effect.quality) crew.quality=round(clamp(crew.quality+effect.quality,CREW_RULES.quality.min,CREW_RULES.quality.max));
    if(effect.fatigue) for(const team of Object.values(crew.teams)) team.fatigue=round(clamp(Number(team.fatigue??0)+effect.fatigue));
    if(effect.rest) { restCrew(campaign,effect.rest); outcome.push(`Le squadre si fermano ${effect.rest} giorni e recuperano.`); }
  }
  if(effect.endorse) resolveEndorsement(campaign, player, effect.endorse, outcome);
  if(effect.rivalAlliance) {
    const partner = campaign.candidates.find(item => item.id === effect.rivalAlliance && item.status === 'active' && !item.isPlayer);
    if (partner && (campaign.alliances ?? []).filter(item => item.status === 'active' && item.leaderCandidateId === player.id).length < 2) outcome.push(formPlayerAlliance(campaign, player, partner, 'Alleanza proposta da chi ti conosce da altre campagne: sostegno e lista comuni.', 8));
    else outcome.push('L’alleanza non si può più fare.');
  }
  if(effect.rivalRelation) {
    const other = campaign.candidates.find(item => item.id === effect.rivalRelation.id && !item.isPlayer);
    if (other) rivalMemory(campaign, other, effect.rivalRelation.delta >= 0 ? 'agreement' : 'rejection', player.id, { action:'risposta-del-giocatore', relationDelta:effect.rivalRelation.delta, weight:.6 });
  }
  if(effect.recognizedRival) {
    const known = campaign.candidates.filter(item => item.recognition && item.status === 'active' && !item.isPlayer).sort((a, b) => b.recognition.met - a.recognition.met || a.id.localeCompare(b.id))[0];
    if (known) {
      if (effect.recognizedRival.relation) rivalMemory(campaign, known, effect.recognizedRival.relation > 0 ? 'agreement' : 'attack', player.id, { action:'evento-del-passato', relationDelta:effect.recognizedRival.relation, weight:.8 });
      if (effect.recognizedRival.transfer) playerTransfer(campaign, known.id, effect.recognizedRival.transfer * (known.recognition.stance === 'ostile' ? 1.2 : 1));
    }
  }
  if(effect.record) {
    const standing = campaign.incumbency?.standing ?? 0;
    playerMove(campaign, effect.record * clamp(standing / 30, -1.2, 1.2), areaFor(campaign, 'focus'));
    if (Math.abs(standing) >= 6) outcome.push(standing >= 0 ? 'Il bilancio del mandato ti aiuta.' : 'Il bilancio del mandato ti si ritorce contro.');
  }
  if(effect.recordAgainst) {
    const incumbent = campaign.candidates.find(item => item.incumbent && item.status === 'active');
    if (incumbent) {
      const factor = clamp(-Number(incumbent.incumbency?.score ?? 0) / 40, -1, 1.3);
      playerTransfer(campaign, incumbent.id, effect.recordAgainst * factor);
      rivalMemory(campaign, incumbent, 'attack', campaign.playerCandidateId, { action:'attacco-al-mandato', relationDelta:-5, weight:.9 });
      outcome.push(factor > .15 ? 'Il dossier colpisce: i risultati dell’amministrazione uscente sono deboli.' : factor < -.15 ? 'Il dossier non regge: il mandato uscente ha dato buoni risultati.' : 'Il dossier non sposta molto.');
    }
  }
  const rival = strongestRival(campaign);
  if(effect.rivalSupport && rival) playerTransfer(campaign, rival.id, effect.rivalSupport);
  if(effect.rivalGain && rival) playerTransfer(campaign, rival.id, -effect.rivalGain);
  if (rival && (effect.rivalSupport || effect.rivalGain)) rivalMemory(campaign, rival, effect.rivalSupport ? 'attack' : 'aid', campaign.playerCandidateId, { action:'evento-del-giocatore', relationDelta:effect.rivalSupport ? -6 : 3, weight:1 });
  if(effect.commitment) campaign.commitments=(campaign.commitments??0)+effect.commitment;
  if(effect.crisis==='open' && !campaign.crisis) { campaign.crisis={ title:event.title, since:campaign.day, severity:1, weeks:0, source:SOURCE }; outcome.push('La vicenda rischia di trascinarsi: puoi gestirla con un’azione dedicata.'); }
  if(effect.topic==='new') {
    const others = DEBATE_TOPICS.filter(topic => topic.id !== campaign.nationalContext.salientTopic);
    const next = others[Math.floor(draw(campaign) * others.length)];
    campaign.nationalContext.salientTopic = next.id;
    outcome.push(`Al centro del dibattito ora c’è: ${next.label.toLowerCase()}.`);
    if (choice.id === 'align') campaign.preparationByTopic[next.id] = round(Math.min(24, (campaign.preparationByTopic[next.id] ?? 0) + 4));
  }
  if(effect.riskRoll && draw(campaign) < effect.riskRoll) { campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-.8)); outcome.push('Qualcuno ripesca vecchie dichiarazioni: il video diventa una polemica.'); }
  if(effect.debateRoll && rival) {
    const score = campaign.candidateStats.reputation*.17 + (campaign.preparationByTopic[campaign.nationalContext.salientTopic] ?? 0) + draw(campaign)*6;
    const rivalScore = (rival.campaignStats.debateReadiness ?? 40)*.48 + draw(campaign)*6;
    if (score - rivalScore > 1.5) { playerMove(campaign, .7); outcome.push('Il confronto televisivo va bene: ne esci rafforzato.'); }
    else if (score - rivalScore < -1.5) { playerMove(campaign, -.5); outcome.push('Il confronto televisivo va male: l’avversario ne approfitta.'); }
    else outcome.push('Il confronto televisivo finisce in parità.');
  }
  campaign.pendingEvents.splice(index,1);
  campaign.events.unshift({...event,choiceId,choiceLabel:choice.label,outcome:outcome.join(' ')||null,resolvedOn:campaign.currentDate,status:'resolved',source:SOURCE});
  campaign.events=campaign.events.slice(0,30);
  addHistory(campaign,'evento',`${event.title}: ${choice.label}.${outcome.length?` ${outcome.join(' ')}`:''}`,{source:SOURCE});
  // Days of rest are days of the campaign: they pass (never up to the vote itself).
  if(effect.rest) passDays(campaign,Math.min(effect.rest,Math.max(0,campaign.totalDays-campaign.day-1)));
  campaign.resources={...player.resources,visibility:campaign.resources.visibility,source:SOURCE};
  return campaign;
}

function passDays(campaign,days) {
  for(let day=0;day<days&&campaign.status==='active';day++) tick(campaign);
  const own=campaign.status==='active'?playerShareNow(campaign):weightedShare(campaign,campaign.playerCandidateId);
  if(campaign.consensusHistory.at(-1)?.day!==campaign.day) campaign.consensusHistory.push({day:campaign.day,date:campaign.currentDate,value:round(own),source:SOURCE});
  campaign.consensusHistory=campaign.consensusHistory.slice(-16);
}
export function advanceCampaign(input,days=7) {
  const campaign=copy(input);
  if(campaign.status!=='active') return campaign;
  for(let day=0;day<Math.max(0,Math.min(120,Math.floor(days)));day++) {
    if(campaign.status!=='active')break;
    tick(campaign);
  }
  const player=campaign.candidates.find(item=>item.isPlayer);
  const average=campaign.status==='active'?playerShareNow(campaign):campaign.territories.reduce((sum,area)=>sum+Number(area.supportByCandidate[player.id]??0)*area.weight,0)/campaign.territories.reduce((sum,area)=>sum+area.weight,0);
  if(campaign.consensusHistory.at(-1)?.day!==campaign.day) campaign.consensusHistory.push({day:campaign.day,date:campaign.currentDate,value:round(average),source:SOURCE});
  campaign.consensusHistory=campaign.consensusHistory.slice(-16);
  campaign.resources={...player.resources,visibility:campaign.resources.visibility,source:SOURCE};
  return campaign;
}

export function campaignSummary(campaign) {
  const player=campaign.candidates.find(item=>item.isPlayer);
  const denominator=campaign.territories.reduce((sum,area)=>sum+area.weight,0)||1;
  const consensus=campaign.territories.reduce((sum,area)=>sum+Number(area.supportByCandidate[player?.id]??0)*area.weight,0)/denominator;
  const groups=campaign.territories.map(area=>({id:area.id,name:area.name,weight:area.weight,localTrend:area.localTrend??0,consensus:round(area.supportByCandidate[player?.id]??0),leaders:Object.entries(area.supportByCandidate).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([candidateId,value])=>({candidateId,value:round(value)}))}));
  const standings = campaign.status === 'active' ? aggregateShares(campaign).map((group, index) => ({ ...group, position:index + 1 })) : [];
  const playerPosition = standings.find(group => group.id === campaign.playerCandidateId)?.position ?? null;
  return {consensus:round(consensus),territories:groups,daysRemaining:Math.max(0,campaign.totalDays-campaign.day),candidateStatus:player?.status,nationalContext:campaign.nationalContext,phase:campaignPhase(campaign),strategy:strategyOf(campaign),expectation:campaign.expectation?.share ?? campaign.consensusHistory?.[0]?.value ?? null,crisis:campaign.crisis ?? null,standings,playerPosition,crew:crewOf(campaign),runoff:campaign.stage === 'ballottaggio' && campaign.status === 'active' && campaign.runoff ? { projection:runoffProjection(campaign), transfers:campaign.runoff.transfers ?? transferTable(campaign), pacts:campaign.runoff.pacts ?? [], appeal:campaign.runoff.appeal ?? 0, stances:campaign.runoff.stances ?? {} } : null,turnout:campaign.status === 'active' ? turnoutOf(campaign, campaign.stage === 'ballottaggio' ? 'ballottaggio' : 'primo-turno') : null,source:SOURCE};
}
