// The territorial races of a round (regional, provincial and municipal votes): which ones the party contests, who the leader fields in each, and what
// the ones nobody plays leave behind. One engine for the three levels: a race is a campaign of the campaign-engine (createCampaign, the weekly work, the
// polls, the vote), either played by the player or run by the party in his place; nothing here has rules of its own about votes or polls.
// Pure functions on plain data: the store gives them the calendar, the people and the state of the game, and keeps what they return.
// Everything made here is simulation: the territories and the dates come from the real calendar of the votes, the candidates and the results are
// simulated (a real politician stays real, his candidacy is not); a new figure is a person of the simulation, never a real one.
import { ELECTION_MODELS } from '../data/simulation/campaign-rules.js?v=20261007-1';
import { RACE_LEVELS, RACE_ROLES, RACE_RULES } from '../data/simulation/race-rules.js?v=20261007-1';
import { advanceDays, nextMunicipalVote, nextProvincialVote, nextRegionalVote } from './time.js?v=20261007-1';
import { advanceCampaign, campaignObservatory, createCampaign, decideCampaignEvent, performCampaignActivity, setExpectation } from './campaign-engine.js?v=20261007-1';

const SIM = 'simulation';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = value => Math.round(value * 100) / 100;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const slug = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('it-IT').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
const sameKey = (a, b) => slug(a) === slug(b) && Boolean(slug(a));

export const raceIdOf = (level, key, electionDate) => `gara-${level}-${slug(key)}-${electionDate}`;
const NEXT_VOTE = Object.freeze({ regionale: nextRegionalVote, provinciale: nextProvincialVote, comunale: nextMunicipalVote });
const LEVEL_LABELS = Object.freeze({ regionale: 'Regionali', provinciale: 'Provinciali', comunale: 'Comunali' });
export const RACE_STATUS = Object.freeze({ planned: 'Da decidere', confirmed: 'Candidato scelto', running: 'Campagna in corso', held: 'Conclusa', missed: 'Senza candidato' });

// ---------- the slate: the races in front of the leader ----------
// calendar: the real calendar of the local and regional votes (regions, and the comuni by date of their last vote); units: the provinces (ISTAT);
// municipalities: the comuni (ISTAT). avoid: the territories of the player's own votes, which have their own flow (regions, provinceCodes, municipalityCodes).
// weightOf(region): how much the party weighs in a region (to choose, among races on the same day, the ones that matter most to it).
export function buildSlate({ today, calendar, units = [], municipalities = [], avoid = {}, weightOf = () => 0, hasProvincial = () => true } = {}) {
  if (!today || !calendar) return [];
  const rules = RACE_RULES;
  const horizon = advanceDays(today, rules.horizonDays);
  const skipRegions = new Set(avoid.regions ?? []);
  const skipProvinces = new Set(avoid.provinceCodes ?? []);
  const skipComuni = new Set(avoid.municipalityCodes ?? []);
  const found = [];
  const make = (level, territory, lastDate) => {
    const model = ELECTION_MODELS[level];
    const after = advanceDays(today, model.campaignDays - rules.windowDays - 1);
    const electionDate = NEXT_VOTE[level](lastDate, after);
    const windowOpensAt = advanceDays(electionDate, -model.campaignDays);
    if (windowOpensAt > horizon) return;
    found.push({
      id: raceIdOf(level, `${territory.kind}-${territory.code ?? territory.name}`, electionDate), level, territory, label: `${LEVEL_LABELS[level]} · ${territory.name}`,
      electionDate, windowOpensAt, windowClosesAt: advanceDays(windowOpensAt, rules.windowDays), nextVote: NEXT_VOTE[level](electionDate, advanceDays(electionDate, 1)),
      status: 'planned', candidacy: null, campaignId: null, result: null, polls: null, office: null, history: [], source: SIM
    });
  };
  for (const row of calendar.regions ?? []) {
    if (!row?.region || !row.lastElection || skipRegions.has(row.region)) continue;
    make('regionale', { kind: 'regione', name: row.region, region: row.region, code: slug(row.region), provinceCode: null, municipalityCode: null }, row.lastElection);
  }
  const unitByCode = new Map(units.map(item => [item.code, item]));
  for (const unit of units) {
    if (skipProvinces.has(unit.code) || !hasProvincial({ region: unit.gameRegion ?? unit.region, provinceCode: unit.code, provinceType: unit.type })) continue;
    // The provinces have no real calendar in the data: each one votes in a year of the game drawn from the province (as for the player's own).
    const last = `${2021 + hash(`${unit.code}|provinciali`) % 4}-11-28`;
    make('provinciale', { kind: 'provincia', name: unit.name, region: unit.gameRegion ?? unit.region, code: unit.code, provinceCode: unit.code, municipalityCode: null, provinceType: unit.type ?? null }, last);
  }
  // The comuni that matter to a party in the country are the capoluoghi: the ones whose name is the name of their province.
  const capitalOf = new Map();
  for (const comune of municipalities) {
    const unit = unitByCode.get(comune.unit);
    if (unit && sameKey(comune.name, unit.name)) capitalOf.set(comune.code, { comune, unit });
  }
  for (const [date, codes] of Object.entries(calendar.municipalities ?? {})) {
    for (const code of codes ?? []) {
      const capital = capitalOf.get(code);
      if (!capital || skipComuni.has(code)) continue;
      make('comunale', { kind: 'comune', name: capital.comune.name, region: capital.unit.gameRegion ?? capital.unit.region, code, provinceCode: capital.unit.code, municipalityCode: code }, date);
    }
  }
  // The nearest in time first, then the ones where the party weighs more, a few for each level and day.
  found.sort((a, b) => a.windowOpensAt.localeCompare(b.windowOpensAt) || (weightOf(b.territory.region) - weightOf(a.territory.region)) || a.territory.name.localeCompare(b.territory.name, 'it'));
  const taken = new Map();
  return found.filter(race => { const key = `${race.level}|${race.electionDate}`; const n = taken.get(key) ?? 0; if (n >= rules.maxPerLevel[race.level]) return false; taken.set(key, n + 1); return true; });
}
// The slate the game already has plus the new races: nothing that has been decided is touched, races that have no candidate and whose candidacies closed leave the
// list, and a day never gets more races of a level than the rule allows (the weights move from week to week, the list does not).
export function mergeSlate(items = [], fresh = [], today) {
  const kept = items.filter(race => race.status !== 'planned' || race.windowClosesAt >= today);
  const known = new Set(kept.map(race => race.id));
  const count = new Map();
  for (const race of kept.filter(item => item.status !== 'held')) count.set(`${race.level}|${race.electionDate}`, (count.get(`${race.level}|${race.electionDate}`) ?? 0) + 1);
  for (const race of fresh) {
    if (known.has(race.id)) continue;
    const key = `${race.level}|${race.electionDate}`;
    if ((count.get(key) ?? 0) >= RACE_RULES.maxPerLevel[race.level]) continue;
    count.set(key, (count.get(key) ?? 0) + 1);
    kept.push(race);
  }
  const held = kept.filter(race => ['held', 'missed'].includes(race.status)).sort((a, b) => a.electionDate.localeCompare(b.electionDate)).slice(-16);
  return [...held, ...kept.filter(race => !['held', 'missed'].includes(race.status))].sort((a, b) => a.electionDate.localeCompare(b.electionDate) || a.id.localeCompare(b.id));
}
export const racesOpen = (items = [], today) => items.filter(race => ['planned', 'confirmed'].includes(race.status) && race.windowClosesAt >= today);

// ---------- rooting ----------
// The local strength of a candidate where the race is held, in points of the campaign: the places he comes from (the same territory, the same region, a
// stranger) and the committees of the party in the territory (a strong network lifts any candidate, none leaves him alone). It moves the result and
// never blocks a candidacy. `from` is the place of the candidate: { region, municipality, provinceCode }; `committee` the strength (0–100) of the committees
// of the party in the territory of the race; `standing` (the player at home only) the territorial standing of his career.
export function rootingOf({ race, from = {}, committee = 0, standing = null } = {}) {
  const rules = RACE_RULES.rooting;
  const place = race.territory;
  const exact = place.kind === 'comune' ? sameKey(from.municipality, place.name) || (place.municipalityCode && from.municipalityCode === place.municipalityCode)
    : place.kind === 'provincia' ? Boolean(place.provinceCode) && from.provinceCode === place.provinceCode
      : sameKey(from.region, place.region);
  const sameRegion = sameKey(from.region, place.region);
  const base = exact ? rules.local : sameRegion ? rules.region : rules.outside;
  const network = rules.committee * (clamp(Number(committee) || 0, 0, 100) - rules.committeePivot) / (100 - rules.committeePivot);
  const personal = exact && Number.isFinite(standing) ? clamp((standing - 50) / 22, -1.6, 2.2) : 0;
  return { points: round(clamp(base + network + personal, rules.floor, rules.cap)), exact: Boolean(exact), region: sameRegion, network: round(network) };
}
// What a candidate brings to the campaign, by kind (the stats the campaign-engine reads for the player's candidacy).
export function profileStats(kind, extra = {}) {
  const profile = RACE_RULES.profiles[kind] ?? RACE_RULES.profiles.simulation;
  return { popularity: profile.popularity, reputation: profile.reputation, consensus: 4, experience: profile.experience + (extra.experience ?? 0), influence: profile.influence + (extra.influence ?? 0), notoriety: profile.notoriety + (extra.notoriety ?? 0) };
}

// ---------- the candidates ----------
// The people the leader can field in a race, by kind, with what each one would be there (rooting) and whether he is available (the reason when he is not).
// from: where the player comes from ({ region, municipality, municipalityCode, provinceCode }); committee: the strength (0–100) of the committees of the party where
// the race is held (a number, or a function of the race); standing: the territorial standing of the player's career.
//   player: { id, label, block }          the leader himself: block is why he cannot (offices that bar the candidacy), or null
//   cadres: [{ id, label, region, municipality?, provinceCode?, committeeStrength }]   the local leaders of the party (staff)
//   politicians: [{ id, label, region, source }]   people the game already knows of the party: the real parliamentarians of its groups and the figures of the simulation
//   simulation: a new person of the simulation, made for the race
export function candidateOptions({ race, items = [], today, player = null, cadres = [], politicians = [], homeVotes = [], from = {}, committee = 0, standing = null } = {}) {
  const busy = personId => personBusy(items, race, personId);
  const strength = typeof committee === 'function' ? committee(race) : committee;
  const rooted = person => rootingOf({ race, from: person, committee: strength, standing: person.isPlayer ? standing : null });
  const out = { player: null, cadres: [], politicians: [], simulation: null };
  if (player) {
    const spacing = playerSpacing(items, race, homeVotes);
    out.player = { kind: 'player', id: player.id, label: player.label, source: 'user', rooting: rooted({ ...from, isPlayer: true }), available: !player.block && !spacing, reason: player.block ?? spacing ?? null };
  }
  out.cadres = cadres.filter(item => item.id && item.status !== 'uscito' && !item.player).map(item => ({ kind: 'cadre', id: item.id, label: item.label, source: 'simulation', region: item.region ?? null, municipality: item.municipality ?? null, municipalityCode: item.municipalityCode ?? null, provinceCode: item.provinceCode ?? null, rooting: rooted(item), available: !busy(item.personId ?? item.id), reason: busy(item.personId ?? item.id) }));
  const known = politicians.filter(item => item.id).map(item => ({ kind: 'politician', id: item.id, label: item.label, source: item.source ?? 'real', region: item.region ?? null, rooting: rooted(item), available: !busy(item.id), reason: busy(item.id) }));
  const ranked = known.sort((a, b) => b.rooting.points - a.rooting.points || String(a.label).localeCompare(String(b.label), 'it'));
  const top = ranked.slice(0, RACE_RULES.maxPoliticians);
  const chosen = race.candidacy?.kind === 'politician' ? ranked.find(item => item.id === race.candidacy.personId) : null;
  out.politicians = chosen && !top.includes(chosen) ? [...top, chosen] : top;
  out.simulation = { kind: 'simulation', id: null, label: `Nuova figura simulata · ${race.territory.name}`, source: 'simulation', rooting: rooted({ region: race.territory.region, municipality: race.territory.kind === 'comune' ? race.territory.name : null, provinceCode: race.territory.provinceCode }), available: true, reason: null };
  return out;
}
// A person stands in one race at a time: another race of the party with the same person, too close in time, makes him busy.
function personBusy(items, race, personId) {
  const other = items.find(item => item.id !== race.id && ['confirmed', 'running'].includes(item.status) && item.candidacy && (item.candidacy.personId === personId || item.candidacy.cadreId === personId) && Math.abs(daysBetween(item.electionDate, race.electionDate)) < RACE_RULES.personGapDays);
  return other ? `Già candidato a ${other.label}: tra i due voti servono almeno ${RACE_RULES.personGapDays} giorni.` : null;
}
// The player plays his campaigns one after the other: the votes he plays himself (the other races he chose and the votes of his own place) keep their distance.
function playerSpacing(items, race, homeVotes) {
  const gap = RACE_RULES.playableGapDays;
  const dates = [
    ...items.filter(item => item.id !== race.id && ['confirmed', 'running'].includes(item.status) && item.candidacy?.kind === 'player').map(item => [item.electionDate, item.label]),
    ...homeVotes.filter(item => ['upcoming', 'open', 'running'].includes(item.status)).map(item => [item.electionDate, item.label])
  ];
  const near = dates.find(([date]) => Math.abs(daysBetween(date, race.electionDate)) < gap);
  return near ? `Troppo vicina a ${near[1]} (${near[0]}): per giocare tutte e due servono almeno ${gap} giorni tra i voti.` : null;
}

// A person of the simulation (a row of the persons of the game): never a real one.
export function simulatedPerson({ id, label, region = null, municipality = null, partyId = null, date }) {
  return { id, firstName: 'Figura', lastName: 'simulata', displayName: label, birthDate: null, gender: null, region, municipality, previousProfession: null, partyId, territoryId: null, roleId: null, source: SIM, createdAt: date };
}
const idOfSimulation = (careerId, raceId) => `persona-gara-${hash(`${careerId}|${raceId}|candidato`).toString(36)}`;
const idOfCadre = (careerId, cadreId) => `persona-${slug(cadreId)}-${hash(`${careerId}|${cadreId}`).toString(36)}`;

// The leader fields a candidate in a race (or takes the choice back: kind 'none'). No days, no capital, no money: it is a decision, not an action.
// choice: { kind: 'player'|'cadre'|'politician'|'simulation'|'none', id }. ctx: { today, leader, career: { id, playerId, playerLabel, partyId, partyLabel },
// player: { block }, cadres, politicians, people (the persons of the game), homeVotes, from, committee(), standing }. Returns { items, person } (person: the row to add to the persons).
export function chooseCandidate(items, raceId, choice, ctx) {
  if (!ctx.leader) throw new Error('Solo chi guida il partito decide i candidati.');
  const next = copy(items);
  const race = next.find(item => item.id === raceId);
  if (!race) throw new Error('Questa corsa non è più in calendario.');
  if (!['planned', 'confirmed'].includes(race.status)) throw new Error('Questa corsa è già in svolgimento o conclusa: il candidato non si cambia.');
  if (ctx.today > race.windowClosesAt) throw new Error('Le candidature per questa corsa sono chiuse.');
  const stamp = text => race.history.unshift({ date: ctx.today, text, source: SIM });
  if (!choice || choice.kind === 'none') {
    if (race.candidacy) stamp(`Candidatura ritirata: ${race.candidacy.label}`);
    race.candidacy = null; race.status = 'planned';
    return { items: next, person: null };
  }
  const options = candidateOptions({ race, items: next, today: ctx.today, player: ctx.player ? { id: ctx.career.playerId, label: ctx.career.playerLabel, block: ctx.playerBlock?.(race) ?? null } : null, cadres: ctx.cadres, politicians: ctx.politicians, homeVotes: ctx.homeVotes, from: ctx.from, committee: ctx.committee, standing: ctx.standing });
  // (the cadres are people of the party that the game already has: they become persons of the simulation the first time one of them is fielded)
  let chosen = null, person = null;
  if (choice.kind === 'player') {
    chosen = options.player;
    if (!chosen) throw new Error('Serve un politico per candidarsi.');
    if (!chosen.available) throw new Error(chosen.reason);
    chosen = { ...chosen, personId: ctx.career.playerId, personRef: { collection: 'politicians', id: ctx.career.playerId, source: 'user' }, role: ctx.playerRole?.(race) ?? null };
  } else if (choice.kind === 'cadre') {
    const cadre = options.cadres.find(item => item.id === choice.id);
    if (!cadre) throw new Error('Questo dirigente non è disponibile.');
    if (!cadre.available) throw new Error(cadre.reason);
    const id = idOfCadre(ctx.career.id, cadre.id);
    person = (ctx.people ?? []).some(item => item.id === id) ? null : simulatedPerson({ id, label: cadre.label, region: cadre.region, partyId: ctx.career.partyId, date: ctx.today });
    chosen = { ...cadre, personId: id, cadreId: cadre.id, personRef: { collection: 'politicians', id, source: SIM } };
  } else if (choice.kind === 'politician') {
    const known = options.politicians.find(item => item.id === choice.id);
    if (!known) throw new Error('Questa persona non è disponibile.');
    if (!known.available) throw new Error(known.reason);
    chosen = { ...known, personId: known.id, personRef: { collection: 'politicians', id: known.id, source: known.source ?? 'real' } };
  } else if (choice.kind === 'simulation') {
    const id = idOfSimulation(ctx.career.id, race.id);
    const already = (ctx.people ?? []).find(item => item.id === id);
    const ordinal = (ctx.people ?? []).filter(item => item.source === SIM && item.region === race.territory.region && /^Candidato simulato/.test(item.displayName ?? '')).length + 1;
    const label = already?.displayName ?? `Candidato simulato n. ${ordinal} · ${race.territory.name}`;
    person = already ? null : simulatedPerson({ id, label, region: race.territory.region, municipality: race.territory.kind === 'comune' ? race.territory.name : null, partyId: ctx.career.partyId, date: ctx.today });
    chosen = { ...options.simulation, label, id, personId: id, personRef: { collection: 'politicians', id, source: SIM } };
  } else throw new Error('Scelta non riconosciuta.');
  const from = choice.kind === 'player' ? ctx.from : choice.kind === 'simulation' ? { region: race.territory.region, municipality: race.territory.kind === 'comune' ? race.territory.name : null, provinceCode: race.territory.provinceCode } : { region: chosen.region ?? null, municipality: chosen.municipality ?? null, municipalityCode: chosen.municipalityCode ?? null, provinceCode: chosen.provinceCode ?? null };
  race.candidacy = { kind: chosen.kind, personId: chosen.personId, personRef: chosen.personRef, ...(chosen.cadreId ? { cadreId: chosen.cadreId } : {}), label: chosen.label, partyId: ctx.career.partyId, partyLabel: ctx.career.partyLabel ?? null, role: chosen.role ?? RACE_ROLES[race.level], source: chosen.source, rooting: chosen.rooting.points, from, confirmedAt: ctx.today };
  race.status = 'confirmed';
  stamp(`Candidatura confermata: ${chosen.label}${chosen.kind === 'player' ? ' (te stesso: campagna giocabile)' : ''}`);
  return { items: next, person };
}

// ---------- the race the party runs by itself ----------
// A campaign for a candidate nobody plays: the campaign-engine's own campaign, the weekly work of the party in rotation, the events answered with their first option,
// the polls every week, the vote. `args` are those of createCampaign (the store fills them from the state of the game); the party's candidate is the one the campaign
// calls the player. Deterministic: the seed is the career and the race.
export function runRace(args, { rooting = null, rotation = RACE_RULES.rotation, pollShare = null, pollBonus = 0, partyTrend = 0, resources = null } = {}) {
  let campaign = createCampaign({ ...args, config: { ...args.config, ...(Number.isFinite(rooting) ? { rooting } : {}) } });
  // The leader chose the candidate: there is no internal contest for the place on the list.
  campaign.nomination = { ...campaign.nomination, status: 'approved', internalSupport: 10 };
  campaign.internalCandidates = [];
  const player = campaign.candidates.find(item => item.isPlayer);
  if (resources && player) { player.resources = { ...player.resources, money: player.resources.money + (resources.money ?? 0), volunteers: player.resources.volunteers + (resources.volunteers ?? 0), organization: clamp(player.resources.organization + (resources.organization ?? 0), 0, 100) }; campaign.resources = { ...player.resources, visibility: campaign.resources.visibility, source: SIM }; }
  // The party's weight in the polls of the territory lifts (or holds back) the candidate in every area, as for the player's own campaign.
  if (pollBonus) for (const area of campaign.territories) {
    const shares = area.supportByCandidate;
    shares[campaign.playerCandidateId] = Math.max(0.5, shares[campaign.playerCandidateId] + pollBonus);
    const total = Object.values(shares).reduce((sum, value) => sum + value, 0);
    for (const id of Object.keys(shares)) shares[id] = round(shares[id] * 100 / total);
  }
  setExpectation(campaign, { pollShare });
  campaign.partyTrend = partyTrend;
  const area = campaign.territories[0]?.id;
  for (let week = 0; campaign.status === 'active' && week < 40; week++) {
    try { campaign = performCampaignActivity(campaign, rotation[week % rotation.length], { territoryId: area }); } catch { /* the activity is not possible this week: the week goes on */ }
    for (const event of [...(campaign.pendingEvents ?? [])]) { try { campaign = decideCampaignEvent(campaign, event.id, event.choices[0].id); } catch { /* answered */ } }
    campaign = advanceCampaign(campaign, 7);
  }
  return campaign;
}
// What a closed race leaves in the game: the standing of the party's candidate, the result of the vote, a compact trace of the polls and the office, if any.
export function raceOutcome(campaign, race) {
  const result = campaign.result;
  if (!result) return null;
  const view = campaignObservatory(campaign, {});
  const groups = [...(result.groups ?? [])].sort((a, b) => b.percent - a.percent);
  const mine = groups.find(group => (group.memberCandidateIds ?? [group.candidateId]).includes(campaign.playerCandidateId)) ?? null;
  const winner = groups.find(group => group.id === result.winnerGroupId) ?? groups[0] ?? null;
  const won = Boolean(mine && winner && mine.id === winner.id);
  const rowOf = group => view.rows.find(row => row.id === group.id) ?? null;
  // The party's own candidacy carries the name of its candidate (the campaign calls it "la tua candidatura"), with the allies that joined it.
  const nameOf = group => { const row = rowOf(group); return row?.isPlayer ? `${race.candidacy?.label ?? 'Il candidato del partito'}${(row.members?.length ?? 0) > 1 ? ' e alleati' : ''}` : row?.label ?? group.label; };
  const outcome = result.outcome ?? {};
  const place = race.territory.name;
  const leaderTitle = race.level === 'comunale' ? `Sindaco di ${place}` : race.level === 'provinciale' ? `Presidente della Provincia di ${place}` : `Presidente della Regione ${place}`;
  const office = result.personalMandate ? { title: won ? leaderTitle : `${race.level === 'comunale' ? 'Consigliere comunale' : race.level === 'provinciale' ? 'Consigliere provinciale' : 'Consigliere regionale'} di ${place}`, side: won ? 'maggioranza' : 'opposizione', since: race.electionDate, until: race.nextVote, personId: race.candidacy?.personId ?? null } : null;
  return {
    result: { won, share: round(Number(result.playerShare ?? mine?.percent ?? 0)), position: outcome.position ?? (mine ? groups.indexOf(mine) + 1 : null), outcome: outcome.code ?? null, outcomeLabel: outcome.label ?? null, mandate: Boolean(result.personalMandate), seats: result.playerSeats ?? mine?.seats ?? 0, turnout: result.turnout ?? null, runoff: Boolean(outcome.runoff),
      winner: winner ? { label: nameOf(winner), partyId: rowOf(winner)?.partyId ?? winner.partyIds?.[0] ?? null, percent: round(winner.percent) } : null,
      groups: groups.slice(0, 6).map(group => ({ label: nameOf(group), partyId: rowOf(group)?.partyId ?? group.partyIds?.[0] ?? null, percent: round(group.percent), ours: group === mine })) },
    // The polls of every week for the candidacies of the vote (also the ones that did not reach the runoff): one series per candidacy.
    polls: { waves: view.waves, days: view.average.map(point => point.day), rows: groups.slice(0, 6).map(group => ({ label: nameOf(group), partyId: rowOf(group)?.partyId ?? group.partyIds?.[0] ?? null, ours: group === mine, series: view.average.map(point => point.rows.find(row => row.partyId === group.id)?.share ?? null), poll: rowOf(group)?.poll ?? null })) },
    office
  };
}
// Whether the race of a candidate that is not the player's is due: the vote has come.
export const raceDue = (race, today) => race.status === 'confirmed' && race.candidacy && race.candidacy.kind !== 'player' && today >= race.electionDate;
export { RACE_LEVELS, RACE_ROLES, RACE_RULES };
