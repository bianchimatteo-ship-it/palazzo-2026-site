import { advanceDays } from './time.js?v=20260925-4';
import { CAMPAIGN_ACTIVITIES, CAMPAIGN_EVENTS, CAMPAIGN_PHASES, CAMPAIGN_STRATEGIES, DEBATE_TOPICS, ELECTION_MODELS, EUROPEAN_THRESHOLD, phaseOf } from '../data/simulation/campaign-rules.js?v=20260925-4';
import { aggregateShares, runFinalElection, runFirstRound } from './election-engine.js?v=20260925-4';
import { ITALIAN_REGIONS } from '../data/regions.js?v=20260925-4';

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
function withinDays(date, count) { return advanceDays(date, count); }
function gameStat(records, playerId, metric, fallback) {
  return records.find(record => record.subjectId === playerId && record.metric === metric)?.value ?? fallback;
}
function normalized(values) {
  const total = values.reduce((sum, value) => sum + Math.max(.01, value), 0) || 1;
  return values.map(value => round(Math.max(.01, value) * 100 / total));
}
function ids(prefix, seed, index = 0) { return `${prefix}-${seed.toString(36)}-${index}`; }

function campaignTerritories(type, player, userTerritories) {
  const playerMunicipality = userTerritories.find(item => item.id === player.territoryId)?.name ?? player.municipality ?? 'Territorio locale';
  if (type === 'comunale') return [{ id:`sim-territory-comune-${hash(playerMunicipality).toString(36)}`, name:playerMunicipality, kind:'comune', weight:100, source:SOURCE, scope:'territorio comunale', organization:30 }];
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

// ISTAT region codes as used by the real dataset (it-region-NN).
const REGION_CODES = Object.freeze(['Piemonte','Valle d’Aosta','Lombardia','Trentino-Alto Adige','Veneto','Friuli-Venezia Giulia','Liguria','Emilia-Romagna','Toscana','Umbria','Marche','Lazio','Abruzzo','Molise','Campania','Puglia','Basilicata','Calabria','Sicilia','Sardegna']);
const regionIdOf = name => { const index = REGION_CODES.indexOf(name); return index < 0 ? null : `it-region-${String(index + 1).padStart(2, '0')}`; };
// Plausible rivals: active parties only, regional parties only in their own region (and never in a national
// vote), the forces with more weight in the polls more often than the small ones.
function buildOpponents(partyId, catalog, seed, count = 3, realCandidates = [], { type = null, region = null, weights = {} } = {}) {
  const rand = randomFrom(seed ^ 0x5bd1e995);
  const home = regionIdOf(region);
  const pool = catalog.filter(item => item?.id && item.id !== partyId && (item.source === 'real' || item.source === 'simulation' || item.source === 'user')
      && !['historical', 'inactive', 'sciolto'].includes(item.status) && !item.adminHidden && !item.sameEntityAs
      && (!item.regionId || (['comunale', 'regionale'].includes(type) && item.regionId === home)))
    .sort((a,b) => String(a.id).localeCompare(String(b.id)));
  const parties = [];
  while (pool.length) {
    const weightOf = item => Math.max(.3, Number(weights[item.id] ?? 0)) + (item.parliamentaryPresence ? 1 : 0);
    const total = pool.reduce((sum, item) => sum + weightOf(item), 0);
    let pick = rand() * total;
    const index = Math.max(0, pool.findIndex(item => (pick -= weightOf(item)) < 0));
    parties.push(pool.splice(index, 1)[0]);
  }
  const candidates = [];
  for (let index=0;index<count;index++) {
    const party = parties[index % Math.max(1, parties.length)] ?? null;
    const candidateId = ids('candidatura-simulata',seed,index+1);
    const person = realCandidates[index];
    // A documented parliamentarian keeps only verified identity data; campaign numbers stay simulated.
    if (person) candidates.push({ ...createCandidate({ id:candidateId, partyId:null, displayName:person.fullName, seed:seed + index*97 }), realReference:{ politicianId:person.id, fullName:person.fullName, chamber:person.chamber, groupId:person.groupId ?? null, groupName:person.groupName ?? null, electedOnList:person.electedOnList ?? null, circoscription:person.circoscription ?? null, sourceUrl:person.sourceUrl, sourceName:person.sourceName, source:'real', verified:true } });
    else candidates.push({ ...createCandidate({ id:candidateId, partyId:party?.id ?? null, displayName:`Candidatura simulata ${index+1}`, seed:seed + index*97 }), partyLabel:party?.officialName ?? party?.name ?? null, partyAbbreviation:party?.abbreviation ?? null });
  }
  return candidates;
}

function initSupport(areas, candidates, player, seed) {
  const rand = randomFrom(seed ^ 0x7f4a7c15);
  for (const area of areas) {
    const strengths = candidates.map((candidate,index) => {
      const stats = candidate.campaignStats;
      const foundation = candidate.isPlayer
        ? 12 + Number(stats.popularity ?? 42)*.14 + Number(stats.notoriety ?? 20)*.07 + Number(stats.influence ?? 14)*.055 + Number(stats.experience ?? 18)*.04
        : 15 + Number(stats.notoriety ?? 35)*.08 + Number(stats.influence ?? 30)*.05 + Number(stats.experience ?? 35)*.035;
      const territoryBoost = candidate.isPlayer && (area.name === player.municipality || area.region === player.region) ? 3.2 : 0;
      return Math.max(4, foundation + territoryBoost + (candidate.campaignStats.momentum??0)*.55 + (area.localTrend??0)*.8 + rand()*7 + area.organization*.015);
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
    const actual = Math.min(Math.max(-own + .01, delta), Object.keys(shares).length > 1 ? 4 : 0);
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
const IMPACT_SCALE = Object.freeze({ comunale:.42, regionale:.5, politiche:.6, europee:.6 });
const ELASTICITY = Object.freeze({ comunale:5, regionale:4.5, politiche:3.5, europee:3.5 });
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
  if (id === 'territorio') return round(({ comunale:1.2, regionale:1.08, politiche:.88, europee:.8 })[type] * (.9 + clamp(player?.resources?.organization ?? 30, 0, 100) / 300));
  if (id === 'media') return round(({ comunale:.86, regionale:1, politiche:1.12, europee:1.16 })[type] * (.82 + clamp(stats.notoriety ?? 20, 0, 100) / 220));
  if (id === 'temi') return (topicId ?? campaign.strategy?.topicId) === campaign.nationalContext?.salientTopic ? 1.25 : .88;
  if (id === 'contrasto') {
    const target = campaign.candidates.find(item => item.id === (targetId ?? campaign.strategy?.targetId)) ?? rival;
    const distance = target ? Math.abs(weightedShare(campaign, target.id) - own) : 20;
    return round((distance < 6 ? 1.16 : distance < 12 ? 1 : .78) * ((stats.reputation ?? 50) < 45 ? .9 : 1));
  }
  if (id === 'coalizione') return (campaign.alliances ?? []).some(item => item.status === 'active' && item.leaderCandidateId === campaign.playerCandidateId) ? 1.14 : own < 12 ? 1.02 : .92;
  return 1;
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
    topic: 1, mood: 1, party: 1, area: 1
  };
  const topicId = options.topicId ?? campaign.strategy?.topicId ?? null;
  if (activity.topic) mods.topic = topicId && topicId === campaign.nationalContext?.salientTopic ? 1.3 : .8;
  if (strategy.id === 'temi' && ['media', 'debate'].includes(activity.scope === 'debate' ? 'debate' : activity.category) && topicId && topicId === campaign.strategy?.topicId) mods.topic = round(mods.topic * 1.15);
  const mood = campaign.context?.mood ?? campaign.nationalContext?.moodIndex ?? 50;
  if (activity.mood === 'incumbent') mods.mood = round(clamp(.45 + (mood - 35) / 30, .35, 1.4));
  if (activity.mood === 'challenger') mods.mood = round(clamp(.45 + (65 - mood) / 30, .35, 1.4));
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
  if (activity.id === 'debate' && campaign.nomination.status === 'pending') return { ok:false, reason:'Prima ottieni la candidatura.' };
  if (activity.id === 'ally_meeting' && (campaign.alliances ?? []).filter(item => item.status === 'active' && item.leaderCandidateId === campaign.playerCandidateId).length >= 2) return { ok:false, reason:'La coalizione è già completa (due accordi).' };
  if (activity.id === 'ally_meeting' && !activeOpponents(campaign).length) return { ok:false, reason:'Non ci sono candidature con cui trattare.' };
  if (campaign.day + activity.days > campaign.totalDays) return { ok:false, reason:'Tempo insufficiente.' };
  const player = campaign.candidates.find(item => item.isPlayer);
  if (!resourceAffordable(player.resources, activity.cost)) return { ok:false, reason:'Risorse insufficienti.' };
  if (player.status === 'eliminated') return { ok:false, reason:'La tua candidatura non è in corsa.' };
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
  if (strategy.needsTopic && !DEBATE_TOPICS.some(topic => topic.id === topicId)) throw new Error('Scegli il tema su cui puntare.');
  const target = strategy.needsTarget ? campaign.candidates.find(item => item.id === targetId && !item.isPlayer && item.status === 'active') ?? strongestRival(campaign) : null;
  if (strategy.needsTarget && !target) throw new Error('Non ci sono avversari da contrastare.');
  const current = campaign.strategy?.id ?? null;
  if (current === strategyId && (campaign.strategy.topicId ?? null) === (strategy.needsTopic ? topicId : null) && (campaign.strategy.targetId ?? null) === (target?.id ?? null)) throw new Error('È già la strategia della campagna.');
  const player = campaign.candidates.find(item => item.isPlayer);
  if (current) {
    if (campaign.totalDays - campaign.day <= 5) throw new Error('Negli ultimi cinque giorni non si cambia strategia.');
    if ((player.resources.politicalCapital ?? 0) < 2) throw new Error('Cambiare strategia costa 2 punti di capitale politico.');
    player.resources.politicalCapital -= 2;
    campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation - .3));
  }
  campaign.strategy = { id:strategyId, topicId:strategy.needsTopic ? topicId : null, targetId:target?.id ?? null, since:campaign.day, changes:(campaign.strategy?.changes ?? -1) + 1, source:SOURCE };
  addHistory(campaign, 'strategia', `${current ? 'Cambio di strategia' : 'Strategia'}: ${strategy.label}${strategy.needsTopic ? ` · ${DEBATE_TOPICS.find(topic => topic.id === topicId)?.label}` : ''}${target ? ` · contro ${target.realReference?.fullName ?? target.displayName}` : ''}${current ? ' (2 capitale, un po’ di credibilità)' : ''}.`);
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
  if (rand < .27) events.push({
    kind:'endorsement', title:'Un sostegno inatteso', body:'Un comitato civico locale propone un endorsement simulato. Il sostegno porta risorse, ma richiede un impegno pubblico.',
    choices:[{id:'accept',label:'Accetta il sostegno',effects:{volunteers:2,politicalCapital:1,visibility:2}},{id:'decline',label:'Mantieni autonomia',effects:{reputation:.3}}]
  });
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
  const strongestInternal=Math.max(0,...campaign.internalCandidates.map(item=>item.internalSupport));
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
    // A narrow decision: the candidacy comes with a worse place on the list than hoped.
    if (roll > odds * .82 && campaign.nomination.listPosition < 8) {
      campaign.nomination.listPosition += 1 + (roll > odds * .93 ? 1 : 0);
      campaign.nomination.decision.lowerPlace = true;
      addHistory(campaign,'candidatura',`Candidatura approvata, ma in una posizione peggiore di quella attesa: numero ${campaign.nomination.listPosition}.`,{source:SOURCE});
    } else addHistory(campaign,'candidatura','Il partito ha approvato la candidatura e la posizione in lista.',{source:SOURCE});
    campaign.candidacy.listPosition = campaign.nomination.listPosition;
  } else {
    campaign.nomination.status = 'excluded';
    campaign.candidates.find(item=>item.isPlayer).status='eliminated';
    campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-1.5));
    addHistory(campaign,'candidatura',lead < 0 ? 'Il partito ha preferito un’altra candidatura interna.' : 'La candidatura non ha ottenuto sostegno interno sufficiente entro la scadenza.',{source:SOURCE});
  }
}
function opponentTurn(campaign) {
  if (campaign.status !== 'active') return;
  campaign.aiTurns=(campaign.aiTurns??0)+1;
  if(campaign.nomination.status==='pending') for(const rival of campaign.internalCandidates) {
    rival.internalSupport=round(clamp(rival.internalSupport+.25+draw(campaign)*.42,0,10));
    rival.lastAction='Sta cercando sostegno nel partito.';
  }
  const rivals = activeOpponents(campaign);
  if (!rivals.length) return;
  const player = campaign.candidates.find(item=>item.isPlayer);
  for (const rival of rivals) {
    if (rival.resources.money <= 0 || rival.resources.volunteers <= 0) {
      rival.strategy='conservazione';
      rival.lastAction='Ha ridotto il ritmo per proteggere le risorse.';
      continue;
    }
    const ranked = campaign.territories.map(area=>({area,own:Number(area.supportByCandidate[rival.id]??0),player:Number(area.supportByCandidate[player.id]??0)}));
    ranked.sort((a,b)=>(b.player-b.own)-(a.player-a.own));
    const target = ranked[0]?.area;
    const top = ranked.reduce((a,b)=>a.own>b.own?a:b,ranked[0]);
    // A rival attacked by the player answers in kind.
    const targeted = campaign.strategy?.id === 'contrasto' && campaign.strategy.targetId === rival.id;
    rival.strategy = targeted ? 'risposta agli attacchi' : top.own > 34 ? 'difesa del vantaggio' : rival.resources.volunteers > 6 ? 'presidio dei territori deboli' : 'visibilità mirata';
    // Only a rival attacked in the last week answers back, and less than it was hit.
    if (targeted && campaign.day - (campaign.lastAttackDay ?? -99) <= 7) transferSupport(campaign, player.id, rival.id, .08 + draw(campaign) * .15);
    else if (targeted && target) moveSupport(campaign,rival.id,.2+draw(campaign)*.3,target.id);
    else if (target) moveSupport(campaign,rival.id,.28+draw(campaign)*.37,target.id);
    rival.resources.money=Math.max(0,rival.resources.money-Math.round(80+draw(campaign)*200));
    rival.resources.volunteers=Math.max(0,rival.resources.volunteers-(draw(campaign)<.2?1:0));
    rival.resources.organization=Math.max(0,rival.resources.organization-(draw(campaign)<.3?1:0));
    rival.lastAction = targeted ? 'Risponde colpo su colpo alla tua campagna.' : rival.strategy==='difesa del vantaggio'?'Sta difendendo le aree in cui è avanti.':rival.strategy==='visibilità mirata'?'Ha ridotto gli appuntamenti per cercare copertura.':'Sta cercando sostegno nelle aree contendibili.';
    if (!campaign.alliances.some(item=>item.status==='active') && rival.relationship > .82 && rivals.length>1 && draw(campaign)<.12) {
      const leader = rivals.filter(item=>item.id!==rival.id).sort((a,b)=>a.relationship-b.relationship)[0];
      if (leader) {
        rival.status='allied'; rival.coalitionLeaderId=leader.id;
        const transfer = mergeAlliance(campaign, leader.id, rival);
        campaign.alliances.push({id:ids('alleanza',campaign.seed,campaign.day+rivals.indexOf(rival)),leaderCandidateId:leader.id,partnerCandidateId:rival.id,status:'active',transfer,terms:'Sostegno e campagna condivisi; seggi calcolati insieme nello scenario.',formedOn:campaign.currentDate,source:SOURCE});
        addHistory(campaign,'alleanza','Due candidature simulate hanno annunciato un accordo.',{source:SOURCE});
      }
    }
  }
  const currentLeader = activeOpponents(campaign).sort((a,b)=>supportAt(campaign,campaign.territories[0].id,b.id)-supportAt(campaign,campaign.territories[0].id,a.id))[0];
  if (currentLeader && player && supportAt(campaign,campaign.territories[0].id,currentLeader.id)-supportAt(campaign,campaign.territories[0].id,player.id)>14 && draw(campaign)<.24) {
    pendingEvent(campaign,'rival','Un avversario attacca la tua proposta','Una candidatura rivale contesta pubblicamente una tua scelta. Rispondere può attirare attenzione e comporta un rischio reputazionale.',[
      {id:'answer',label:'Rispondi nel merito',effects:{visibility:2,reputation:.4,politicalCapital:-1,support:.25}},
      {id:'ignore',label:'Non spostare il programma',effects:{organization:1}}
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
// The day of the vote: late deciders, turnout and the error of every projection move the final result a little.
// How much depends on the strategy (more when looking for new voters, less when consolidating) and on the climate.
function electionDay(campaign, round_ = 'primo-turno') {
  const strategy = strategyOf(campaign);
  const mood = campaign.nationalContext?.moodIndex ?? 50;
  const climate = 1 + Math.abs(mood - 50) / 80;
  const player = campaign.candidates.find(item => item.isPlayer);
  const before = Object.fromEntries(campaign.candidates.map(item => [item.id, round(weightedShare(campaign, item.id))]));
  const shifts = {};
  for (const candidate of campaign.candidates.filter(item => item.status === 'active')) {
    const share = Math.max(.5, before[candidate.id]);
    const volatility = candidate.isPlayer ? strategy.volatility : 1;
    shifts[candidate.id] = round(gaussian(campaign) * (.45 + Math.sqrt(share) * .3) * volatility * climate);
  }
  // Mobilisation: organisation, volunteers and the final push bring one's own voters to the polls.
  const gotv = campaign.activityUses?.get_out_vote ?? 0;
  const mobilization = player && player.status === 'active' ? round(clamp((Number(player.resources.organization ?? 30) - 30) / 90 + (Number(player.resources.volunteers ?? 10) - 10) / 70 + gotv * .35, -.8, 1.4)) : 0;
  if (player && shifts[player.id] !== undefined) shifts[player.id] = round(shifts[player.id] + mobilization);
  for (const area of campaign.territories) {
    const shares = area.supportByCandidate;
    for (const [id, shift] of Object.entries(shifts)) if (id in shares) shares[id] = Math.max(.1, Number(shares[id]) + shift * (.75 + draw(campaign) * .5));
    const total = Object.values(shares).reduce((sum, value) => sum + Number(value), 0) || 1;
    for (const id of Object.keys(shares)) shares[id] = round(Number(shares[id]) * 100 / total);
  }
  const turnout = round(clamp(58 + (campaign.context?.participation ? (campaign.context.participation - 60) * .4 : 0) + (mood - 50) * .08 + mobilization * 1.5 + (round_ === 'ballottaggio' ? -9 : 0), 32, 82));
  campaign.electionDays = [...(campaign.electionDays ?? []), { round:round_, projection:before, shifts, mobilization, turnout, source:SOURCE }];
}
function tick(campaign) {
  campaign.day++;
  campaign.currentDate=withinDays(campaign.startedAt,campaign.day);
  evaluateNomination(campaign);
  if (campaign.day>0 && campaign.day%7===0) {
    opponentTurn(campaign);
    weeklyPressure(campaign);
    if (!campaign.pendingEvents.length && draw(campaign) < .5) poolEvent(campaign);
    if (!campaign.pendingEvents.length) contextualEvent(campaign,'week');
  }
  if (campaign.stage==='ballottaggio' && campaign.day>=campaign.totalDays) { electionDay(campaign, 'ballottaggio'); finish(campaign, campaign.firstRoundResult); }
  else if (campaign.stage==='campagna' && campaign.day>=campaign.totalDays) {
    electionDay(campaign, 'primo-turno');
    const first=runFirstRound(campaign);
    if (first.requiresRunoff) {
      campaign.firstRoundResult=first;
      campaign.stage='ballottaggio';
      campaign.runoffCandidateIds=first.runoffCandidateIds;
      campaign.totalDays+=14;
      campaign.electionDate=withinDays(campaign.electionDate,14);
      campaign.candidates.forEach(candidate=>{if(!campaign.runoffCandidateIds.includes(candidate.id))candidate.status='eliminated';});
      campaign.pendingEvents=[];
      addHistory(campaign,'elezione','Primo turno concluso. Inizia il periodo di ballottaggio.',{source:SOURCE});
    } else finish(campaign,first);
  }
}
function finish(campaign,firstRound=null) {
  campaign.result=runFinalElection(campaign,firstRound);
  const opening=campaign.expectation?.share ?? campaign.consensusHistory[0]?.value ?? campaign.result.playerShare;
  campaign.partyImpact={...campaign.partyImpact,openingConsensus:opening,electionResult:campaign.result.playerShare,consensusChange:round(campaign.result.playerShare-opening),reputationChange:round(campaign.candidateStats.reputation-campaign.startingStats.reputation),outcome:campaign.result.objectiveMet?'obiettivo-raggiunto':'obiettivo-non-raggiunto',asOf:campaign.currentDate,source:SOURCE};
  campaign.status='finished'; campaign.stage='risultato'; campaign.closedAt=campaign.currentDate;
  campaign.pendingEvents=[];
  campaign.result.description = campaign.result.objectiveMet ? 'Obiettivo raggiunto.' : 'Obiettivo non raggiunto.';
  addHistory(campaign,'risultato',`${campaign.result.outcome?.label ?? campaign.result.description}`,{source:SOURCE});
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
  const validRoles={comunale:['sindaco','consigliere'],regionale:['presidente','consigliere'],politiche:['deputato','senatore','uninominale'],europee:['eurodeputato']};
  const role=config.role ?? (type==='comunale'?'sindaco':type==='regionale'?'presidente':type==='politiche'?'deputato':'eurodeputato');
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
  const opponents=buildOpponents(partyId,partyCatalog,seed,3,config.realCandidates??[],{ type, region:player.region ?? null, weights:config.partyWeights ?? {} });
  const candidates=[candidate,...opponents];
  initSupport(campaignAreas,candidates,player,seed);
  const focus=campaignAreas.find(area=>area.name===player.municipality)?.id ?? campaignAreas.find(area=>area.region===player.region)?.id ?? campaignAreas.find(area=>area.constituency && (config.constituency === area.constituency))?.id ?? campaignAreas[0].id;
  const deadlineDay=model.nominationDays;
  const internalSupport=partyId && !userOrIndependent ? round(1.5+playerStats.influence*.035+(incumbency?1.5:0)) : 10;
  const nomination={status:userOrIndependent?'approved':'pending',internalSupport,requiredSupport:7,deadlineDay,listPosition:6,source:SOURCE,
    incumbent:incumbency,incumbencyNote:incumbency?'La ricandidatura è da negoziare e non è garantita.':null};
  const baseMoney=type==='comunale'?9500:type==='regionale'?18000:28000;
  const initialResources={money:baseMoney+Math.round(playerStats.influence*55),volunteers:Math.max(8,Math.round(12+playerStats.influence*.25)),organization:Math.max(12,Math.round(24+playerStats.experience*.22)),visibility:Math.round(playerStats.notoriety*.22),politicalCapital:Math.max(5,Math.round(8+playerStats.influence*.13)),source:SOURCE};
  candidate.resources={...initialResources};
  const allPartyRefs=partyCatalog.filter(item=>candidates.some(candidate=>candidate.partyId===item.id)).map(item=>({id:item.id,source:item.source,verified:item.verified===true}));
  const internalRandom=randomFrom(seed ^ 0xc2b2ae35);
  const internalCandidates=userOrIndependent?[]:[0,1].map(index=>({id:ids('candidatura-interna',seed,index),displayName:`Candidatura interna simulata ${index+1}`,partyId,internalSupport:round(2.8+internalRandom()*3.5),lastAction:'Sta cercando sostegno nel partito.',source:SOURCE}));
  const strategy = config.strategy && CAMPAIGN_STRATEGIES[config.strategy] ? config.strategy : null;
  const campaign={
    id:campaignId,careerId:career.id,playerId:player.id,electionType:type,electionLabel:model.label,model:model.model,
    modelSource:model.source,modelReference:{source:'real',verified:true,sourceUrl:model.referenceUrl,sourceName:model.referenceName,verifiedAt:'2026-09-22',validFrom:null,validTo:null},
    ruleFacts:type==='europee'?{threshold:EUROPEAN_THRESHOLD}:null,
    municipalityBand:type==='comunale'?(config.municipalityBand==='oltre-15000'?'oltre-15000':'fino-15000'):null,
    objective:config.objective??'build',playerCandidateId,partyId,independent:userOrIndependent && !partyId,partyReferences:allPartyRefs,
    initialLevel:career.initialLevel,territoryId:career.territoryId,homeRegion:player.region ?? null,territories:campaignAreas,candidates,resources:initialResources,
    candidateStats:playerStats,startingStats:{...playerStats},nomination,internalCandidates,candidacy:{role,listPosition:6,territoryId:focus,incumbent:incumbency},
    status:'active',stage:'campagna',startedAt:currentDate,currentDate,electionDate:withinDays(currentDate,model.campaignDays),
    day:0,totalDays:model.campaignDays,daysToNomination:deadlineDay,firstRoundResult:null,result:null,runoffCandidateIds:null,
    alliances:[],events:[],pendingEvents:[],history:[],consensusHistory:[],aiTurns:0,preparationByTopic:Object.fromEntries(DEBATE_TOPICS.map(topic=>[topic.id,0])),
    nationalContext:{moodIndex:Math.round(42+randomFrom(seed ^ 0x165667b1)()*18),macroTrend:round((randomFrom(seed ^ 0x9e3779b9)()-.5)*4),salientTopic:DEBATE_TOPICS[Math.floor(randomFrom(seed ^ 0x85ebca6b)()*DEBATE_TOPICS.length)].id,source:SOURCE},
    media:{coverage:0,reactions:0,criticalEvents:0,source:SOURCE},partyImpact:{internalSupport:internalSupport,source:SOURCE},
    pollingHook:{provider:null,connected:false,signal:null,source:SOURCE,description:'Nessun sondaggio collegato: l’indicatore in schermata è una proiezione interna simulata.'},
    strategy:null,activityUses:{},crisis:null,commitments:0,eventLog:{},electionDays:[],partyTrend:0,
    seed,rngState:seed,source:SOURCE
  };
  addHistory(campaign,'inizio',`${model.label}: inizia una campagna di ${model.campaignDays} giorni nello scenario simulato.`,{source:SOURCE});
  const openingWeight=campaignAreas.reduce((sum,item)=>sum+item.weight,0)||1;
  const openingConsensus=campaignAreas.reduce((sum,item)=>sum+Number(item.supportByCandidate[playerCandidateId]??0)*item.weight,0)/openingWeight;
  campaign.consensusHistory.push({day:0,date:currentDate,value:round(openingConsensus),source:SOURCE});
  if (strategy) {
    const opts = { topicId: config.topicId ?? null, targetId: config.targetId ?? null };
    const withStrategy = setCampaignStrategy(campaign, strategy, CAMPAIGN_STRATEGIES[strategy].needsTopic && !opts.topicId ? { ...opts, topicId: campaign.nationalContext.salientTopic } : opts);
    Object.assign(campaign, withStrategy);
  }
  return campaign;
}
// What the player may reasonably expect, set once the campaign starts from the polls and the opening projection.
export function setExpectation(campaign, { pollShare = null } = {}) {
  const share = round(weightedShare(campaign, campaign.playerCandidateId));
  campaign.expectation = { share, pollShare, setOn:campaign.currentDate, source:SOURCE };
  if (campaign.consensusHistory[0]) campaign.consensusHistory[0] = { ...campaign.consensusHistory[0], value:share };
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
  const area=targetArea(campaign,options.territoryId);
  const topic=DEBATE_TOPICS.find(item=>item.id===options.topicId)??DEBATE_TOPICS.find(item=>item.id===campaign.strategy?.topicId)??DEBATE_TOPICS[0];
  const strategy = strategyOf(campaign);
  const modifiers = activityModifiers(campaign, activity, { ...options, territoryId:area?.id, topicId:topic.id });
  const factor = modifiers.total;
  campaign.activityUses = { ...(campaign.activityUses ?? {}), [activity.id]:(campaign.activityUses?.[activity.id] ?? 0) + 1 };
  let report='';
  if(activity.internalSupport) {
    if(campaign.nomination.status==='pending') {
      campaign.nomination.internalSupport=round(clamp(campaign.nomination.internalSupport+activity.internalSupport*strategy.mods.internal+Math.min(1,campaign.candidateStats.influence*.025),0,10));
      campaign.nomination.listPosition=Math.max(1,campaign.nomination.listPosition-(activity.listPosition??0));
      campaign.partyImpact.internalSupport=campaign.nomination.internalSupport;
      report=`Sostegno interno ${campaign.nomination.internalSupport}/10; posizione provvisoria ${campaign.nomination.listPosition}.`;
    } else if(campaign.nomination.status==='approved'&&activity.listPosition) {
      campaign.candidacy.listPosition=Math.max(1,campaign.candidacy.listPosition-activity.listPosition);
      campaign.nomination.listPosition=campaign.candidacy.listPosition;
      report=`La trattativa ha migliorato la tua posizione in lista: numero ${campaign.candidacy.listPosition}.`;
    }
  }
  const baseSupport = () => activity.effect*(.55+player.resources.organization/120+player.resources.volunteers/100)*(0.78+campaign.candidateStats.reputation/180+campaign.nationalContext.macroTrend*.006)*(1.14+Number(area.localTrend??0)*.025-supportAt(campaign,area.id)/125);
  if(activity.id==='debate_prep') {
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
    report = `Squadra più preparata: volontari +${volunteers}, organizzazione +${organization}.`;
  } else if(activity.crisis) {
    const handled = draw(campaign) < clamp(.45 + (campaign.candidateStats.reputation - 40) / 60, .2, .9);
    if (handled) { report = `La polemica “${campaign.crisis.title}” si sgonfia: la spiegazione convince.`; campaign.crisis = null; campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation + .5)); }
    else { campaign.crisis.severity = Math.max(.5, round(campaign.crisis.severity - .4)); report = 'La spiegazione attenua la polemica, ma non la chiude.'; }
  } else if(activity.endorsement) {
    const odds = clamp(.3 + (campaign.candidateStats.reputation - 50) / 60 + campaign.candidateStats.influence / 250, .12, .85);
    if (draw(campaign) < odds) { playerMove(campaign, Math.min(1.6, baseSupport() * factor * 1.25), area.id); campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation + .4)); report = 'Il sostegno pubblico arriva: più credibilità nell’area.'; }
    else { campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation - .4)); report = 'Il sostegno non arriva e il no finisce sui giornali locali.'; }
  } else if(activity.pact) {
    const odds = clamp(.35 + campaign.candidateStats.influence / 200 + (strategy.id === 'coalizione' ? .15 : 0) + (player.resources.politicalCapital > 6 ? .05 : 0), .15, .85);
    if (draw(campaign) < odds) { playerMove(campaign, Math.min(1.8, baseSupport() * factor * 1.2), area.id); player.resources.volunteers += 2; campaign.commitments = (campaign.commitments ?? 0) + 1; report = `Accordo territoriale in ${area.name}: sostegno e volontari, in cambio di impegni per l’area.`; }
    else { campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation - .3)); report = 'L’accordo salta all’ultimo: le reti locali restano neutrali.'; }
  } else if(activity.rival) {
    campaign.lastAttackDay = campaign.day;
    const rival = campaign.candidates.find(item => item.id === (options.opponentId ?? strategy.targetId) && item.status === 'active' && !item.isPlayer) ?? strongestRival(campaign);
    if (rival) {
      const backlash = campaign.candidateStats.reputation < 45 && draw(campaign) < .35 * strategy.risk;
      if (backlash) { playerTransfer(campaign, rival.id, -.3); campaign.candidateStats.reputation = round(clamp(campaign.candidateStats.reputation - .8)); report = `L’attacco a ${rival.realReference?.fullName ?? 'un avversario'} viene percepito come scorretto: effetto boomerang.`; }
      else { playerTransfer(campaign, rival.id, round(Math.min(1.6, .9 * factor))); report = `Il confronto con ${rival.realReference?.fullName ?? 'la candidatura rivale'} sposta voti dalla sua parte alla tua.`; }
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
  const visibilityGain = activity.visibility * (strategy.id === 'media' ? 1.2 : 1);
  campaign.candidateStats.notoriety=round(clamp(campaign.candidateStats.notoriety+visibilityGain*.075));
  campaign.resources.visibility=round(clamp(campaign.resources.visibility+visibilityGain));
  campaign.media.coverage=round(clamp(campaign.media.coverage+activity.visibility*.45));
  const risk=clamp((activity.risk+campaign.candidateStats.notoriety*.18-campaign.candidateStats.reputation*.05)*strategy.risk,0,75);
  if(draw(campaign)<risk/100) {
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
  const own=campaign.territories.reduce((sum,item)=>sum+Number(item.supportByCandidate[player.id]??0)*item.weight,0)/campaign.territories.reduce((sum,item)=>sum+item.weight,0);
  campaign.consensusHistory.push({day:campaign.day,date:campaign.currentDate,value:round(own),source:SOURCE});
  campaign.consensusHistory=campaign.consensusHistory.slice(-16);
  campaign.resources={...player.resources,visibility:campaign.resources.visibility,source:SOURCE};
  return campaign;
}

function negotiateAllianceInPlace(campaign,targetId,costAlreadyPaid=false) {
  const player=campaign.candidates.find(item=>item.isPlayer);
  const choices=activeOpponents(campaign).filter(item=>!campaign.alliances.some(alliance=>alliance.status==='active'&&alliance.partnerCandidateId===item.id));
  const target=choices.find(item=>item.id===targetId)??choices.sort((a,b)=>a.relationship-b.relationship)[0];
  if(!target) return 'Non ci sono candidature disponibili per un nuovo accordo.';
  if(!costAlreadyPaid&&player.resources.politicalCapital<3) return 'Il capitale politico non basta per aprire questa trattativa.';
  const led = campaign.alliances.filter(item => item.status === 'active' && item.leaderCandidateId === player.id).length;
  if (led >= 2) return 'La coalizione è già completa: un terzo alleato non entra nell’accordo.';
  const bonus = strategyOf(campaign).allianceBonus ?? 0;
  // Whoever is ahead of you does not join your coalition; the strongest rival almost never does.
  const ahead = weightedShare(campaign, target.id) - weightedShare(campaign, player.id);
  const leaderPenalty = target.id === strongestRival(campaign)?.id ? .15 : ahead > 3 ? .5 : 1;
  const chance=clamp((18+bonus+target.relationship*57+campaign.candidateStats.influence*.22-(supportAt(campaign,campaign.territories[0].id,target.id)-supportAt(campaign,campaign.territories[0].id,player.id))*.6-led*15)*leaderPenalty,3,85);
  if(!costAlreadyPaid) player.resources.politicalCapital-=3;
  if(draw(campaign)*100<chance) {
    target.status='allied'; target.coalitionLeaderId=player.id;
    const transfer = mergeAlliance(campaign, player.id, target);
    campaign.alliances.push({id:ids('alleanza',campaign.seed,campaign.day),leaderCandidateId:player.id,partnerCandidateId:target.id,status:'active',transfer,terms:'Sostegno condiviso e lista comune nello scenario simulato.',formedOn:campaign.currentDate,source:SOURCE});
    player.resources.volunteers+=2; player.resources.organization+=1;
    // A coalition costs identity: part of the party does not like sharing the list.
    if (campaign.nomination.status === 'pending') campaign.nomination.internalSupport = round(clamp(campaign.nomination.internalSupport - .5, 0, 10));
    return `Accordo raggiunto con una candidatura simulata: il ${Math.round(transfer * 100)}% dei suoi elettori segue l’intesa, gli altri votano altrove.`;
  }
  campaign.candidateStats.reputation=round(clamp(campaign.candidateStats.reputation-.35));
  return `La trattativa con una candidatura simulata è fallita; il costo politico resta.`;
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
  if(partner){partner.status='active';partner.coalitionLeaderId=null;}
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
  const rival = strongestRival(campaign);
  if(effect.rivalSupport && rival) playerTransfer(campaign, rival.id, effect.rivalSupport);
  if(effect.rivalGain && rival) playerTransfer(campaign, rival.id, -effect.rivalGain);
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
  campaign.resources={...player.resources,visibility:campaign.resources.visibility,source:SOURCE};
  return campaign;
}

export function advanceCampaign(input,days=7) {
  const campaign=copy(input);
  if(campaign.status!=='active') return campaign;
  for(let day=0;day<Math.max(0,Math.min(120,Math.floor(days)));day++) {
    if(campaign.status!=='active')break;
    tick(campaign);
  }
  const player=campaign.candidates.find(item=>item.isPlayer);
  const average=campaign.territories.reduce((sum,area)=>sum+Number(area.supportByCandidate[player.id]??0)*area.weight,0)/campaign.territories.reduce((sum,area)=>sum+area.weight,0);
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
  return {consensus:round(consensus),territories:groups,daysRemaining:Math.max(0,campaign.totalDays-campaign.day),candidateStatus:player?.status,nationalContext:campaign.nationalContext,phase:campaignPhase(campaign),strategy:strategyOf(campaign),expectation:campaign.expectation?.share ?? campaign.consensusHistory?.[0]?.value ?? null,crisis:campaign.crisis ?? null,standings,playerPosition,source:SOURCE};
}
