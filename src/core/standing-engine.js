// How the player stands (see standing-rules): the four reputations and the influence in each sector of public policy.
// The game keeps the single reputation and the notoriety of the stats; here they are told apart. A reputation is the general one
// moved by what really counts for that audience (the party's support and the leadership for the internal one, popularity and roots
// for the territorial one, notoriety and the polemics for the media one, the office held and the group's backing for the
// institutional one) and by the player's own choices (an offset that the decisions of a category push). The influence in a sector
// is earned by acts, laws and reports on its themes and by the office that covers them, and it fades if it is not kept alive.
// Pure functions on the career state; the career engine writes game.standing, the others read the view.
import { committeeStrength, territorialControl } from './committee-engine.js?v=20261005-2';
import {
  CATEGORY_REPUTATION, REPUTATIONS, REPUTATION_IDS, SECTORS, SECTOR_GAINS, SECTOR_IDS, STANDING_RULES, areasOfSector, sectorOfArea
} from '../data/simulation/standing-rules.js?v=20261005-2';
import { OFFICES } from '../data/simulation/office-rules.js?v=20261005-2';

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;
const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${String(Math.abs(round1(value))).replace('.', ',')}`;
const LOG_LIMIT = 24;

// A fresh standing: how far each reputation sits from the general one (offsets) and the influence earned in each sector.
export function createStanding({ rep = {}, sectors = {}, week = 1 } = {}) {
  return {
    version: 1, since: week,
    rep: Object.fromEntries(REPUTATION_IDS.map(id => [id, round1(clamp(rep[id] ?? 0, -STANDING_RULES.offsetMax, STANDING_RULES.offsetMax))])),
    sectors: Object.fromEntries(SECTOR_IDS.map(id => [id, round1(clamp(sectors[id] ?? 0, 0, STANDING_RULES.sectorMax))])),
    cache: { tier: 0, held: [], floors: {}, week },
    log: []
  };
}
// Saves made before the standing existed (or with a part missing) get a neutral one.
export function normalizeStanding(raw, { week = 1 } = {}) {
  if (!raw || typeof raw !== 'object') return createStanding({ week });
  const base = createStanding({ week: raw.since ?? week });
  return {
    ...base, ...raw,
    rep: { ...base.rep, ...(raw.rep ?? {}) }, sectors: { ...base.sectors, ...(raw.sectors ?? {}) },
    cache: { ...base.cache, ...(raw.cache ?? {}) }, log: Array.isArray(raw.log) ? raw.log.slice(0, LOG_LIMIT) : []
  };
}
const logIt = (standing, entry) => { standing.log = [entry, ...standing.log].slice(0, LOG_LIMIT); };

// What a decision does to the standing: explicit changes (effects.standing, effects.sector) and the share of a change of the
// general reputation that belongs to the kind of the decision. Mutates game.standing; returns the lines for the report.
export function applyStandingEffects(game, effects = {}, { category = null, reputationDelta = 0, cause = null, week = game?.week?.index ?? 0 } = {}) {
  if (!game) return [];
  const standing = (game.standing = normalizeStanding(game.standing, { week }));
  const lines = [];
  const push = (id, delta) => {
    if (!delta || !(id in standing.rep)) return;
    const before = standing.rep[id];
    standing.rep[id] = round1(clamp(before + delta, -STANDING_RULES.offsetMax, STANDING_RULES.offsetMax));
    if (standing.rep[id] !== before) logIt(standing, { week, kind: 'reputazione', target: id, delta: round1(standing.rep[id] - before), cause });
  };
  for (const [id, delta] of Object.entries(effects.standing ?? {})) { push(id, Number(delta) || 0); if (delta) lines.push(`${REPUTATIONS[id]?.label ?? id} ${signed(delta)}`); }
  // The general reputation moves all of them; the audience of the decision's kind moves a little more.
  const kind = CATEGORY_REPUTATION[category] ?? null;
  if (kind && reputationDelta) push(kind, round2(reputationDelta * STANDING_RULES.eventShare));
  for (const [id, delta] of Object.entries(effects.sector ?? {})) { if (gainSector(game, id, Number(delta) || 0, { cause, week })) lines.push(`Influenza ${SECTORS.find(item => item.id === sectorOfArea(id))?.label.toLowerCase() ?? id} ${signed(delta)}`); }
  return lines;
}

// The influence earned in a sector (an id of a sector or of a policy area), with its cause for the record.
export function gainSector(game, sectorOrArea, amount, { cause = null, week = game?.week?.index ?? 0 } = {}) {
  const id = sectorOfArea(sectorOrArea);
  if (!game || !id || !amount) return false;
  const standing = (game.standing = normalizeStanding(game.standing, { week }));
  const before = standing.sectors[id] ?? 0;
  // Influence is harder to earn the more there is of it.
  const delta = amount > 0 ? amount * clamp((100 - before) / 70, 0.2, 1) : amount;
  standing.sectors[id] = round2(clamp(before + delta, 0, STANDING_RULES.sectorMax));
  if (Math.abs(standing.sectors[id] - before) >= 0.3) logIt(standing, { week, kind: 'settore', target: id, delta: round1(standing.sectors[id] - before), cause });
  return standing.sectors[id] !== before;
}

// Every week: the influence earned fades a little, the offsets drift back toward the general reputation, the offices held are cached
// (the weight of the highest one, the sectors they cover) and the delega or the ministry feeds its sector.
export function advanceStanding(game, { held = [], floors = {}, week = game?.week?.index ?? 0 } = {}) {
  if (!game) return null;
  const standing = (game.standing = normalizeStanding(game.standing, { week }));
  for (const id of SECTOR_IDS) standing.sectors[id] = round2(Math.max(0, standing.sectors[id] - STANDING_RULES.sectorDecay));
  for (const id of REPUTATION_IDS) standing.rep[id] = round2(standing.rep[id] * 0.995);
  standing.cache = { tier: held.reduce((best, id) => Math.max(best, OFFICES[id]?.tier ?? 0), 0), held: [...held], floors: { ...floors }, week };
  // What the office covers keeps the sector alive: a delega, a ministry, a committee.
  for (const [sector, floor] of Object.entries(floors)) if ((standing.sectors[sector] ?? 0) < floor - 6) standing.sectors[sector] = round2(Math.min(floor - 6, standing.sectors[sector] + 0.4));
  return standing;
}

// The sectors an office covers and the floor of influence it gives: { sector: floor }. facts: { delegas: [{ areas, kind }],
// ministerAreas, committeeAreas, euAreas, headAreas }.
export function sectorFloors({ delegas = [], ministerAreas = [], undersecretaryAreas = [], committeeAreas = [], euAreas = [], headAreas = [], premier = false } = {}) {
  const floors = {};
  const raise = (area, value) => { const sector = sectorOfArea(area); if (sector) floors[sector] = Math.max(floors[sector] ?? 0, value); };
  for (const delega of delegas) for (const area of delega.areas ?? []) raise(area, delega.kind === 'assessore' ? STANDING_RULES.floors.assessore : STANDING_RULES.floors.delega);
  for (const area of ministerAreas) raise(area, STANDING_RULES.floors.ministro);
  for (const area of undersecretaryAreas) raise(area, STANDING_RULES.floors.sottosegretario);
  for (const area of committeeAreas) raise(area, STANDING_RULES.floors.commissione);
  for (const area of euAreas) raise(area, STANDING_RULES.floors['commissione-ue']);
  for (const area of headAreas) raise(area, STANDING_RULES.floors.presidente);
  if (premier) for (const id of SECTOR_IDS) floors[id] = Math.max(floors[id] ?? 0, STANDING_RULES.floors.premier);
  return floors;
}

// The influence in a sector now: what has been earned, or the floor the office gives.
export const sectorValue = (standing, sector) => round1(Math.max(standing?.sectors?.[sector] ?? 0, standing?.cache?.floors?.[sector] ?? 0));
// The sector of a policy area, or of a ministry (by the areas it covers), as an influence value for the odds.
export const influenceInArea = (game, area) => sectorValue(game?.standing, sectorOfArea(area));

// The view: the four reputations with what they are made of, the notoriety, the influence, the capital and the sectors.
export function standingOf({ game = null, stats = {}, parliament = null } = {}) {
  const standing = normalizeStanding(game?.standing, { week: game?.week?.index ?? 1 });
  const base = clamp(stats.reputation ?? 50);
  const party = game?.party ?? null;
  const member = party?.affiliation === 'member';
  const founder = party?.affiliation === 'founder';
  const relation = id => (game?.relations ?? []).find(item => item.id === id)?.value ?? 50;
  const memory = (game?.memory ?? []).filter(item => (game?.week?.index ?? 0) - (item.week ?? 0) <= 104);
  const scandals = memory.filter(item => item.tone === 'bad').reduce((sum, item) => sum + (item.weight ?? 1), 0);
  const praise = memory.filter(item => item.tone === 'good').reduce((sum, item) => sum + (item.weight ?? 1), 0);
  const org = party?.org ?? null;
  const committees = (org?.committees ?? []).filter(item => item.region === game?.place?.region && item.status !== 'dissoluzione' && ['comune', 'provincia'].includes(item.level));
  const roots = committees.length ? committees.reduce((sum, item) => sum + committeeStrength(item), 0) / committees.length : null;
  // The local leaders who follow the player (or do not) are part of the name the player has in the territory.
  const control = org?.committees?.length ? territorialControl(party, { region: game?.place?.region ?? null }) : null;
  const tier = standing.cache.tier ?? 0;
  const own = id => standing.rep[id] ?? 0;
  const parts = {
    internal: party ? [
      ['Reputazione generale', base], ['Sostegno nel partito', (party.support - 50) * 0.2], ['Rapporto con la leadership', (relation('leadership') - 50) * 0.15],
      ['Incarico nel partito', founder ? 8 : (party.rank ?? 0) * 1.5], ['Le tue scelte nel partito', own('internal')]
    ] : null,
    territorial: [
      ['Reputazione generale', base], ['Popolarità', ((stats.popularity ?? 45) - 45) * 0.25], ['Radicamento del partito', roots === null ? 0 : (roots - 50) * 0.12],
      ['Dirigenti locali con te', control ? (control.index - 50) * 0.1 : 0], ['Ricordo di quello che hai fatto', (praise - scandals) * 0.8], ['Le tue scelte sul territorio', own('territorial')]
    ],
    media: [
      ['Reputazione generale', base], ['Notorietà', ((stats.notoriety ?? 30) - 30) * 0.25], ['Polemiche e scandali recenti', -scandals * 1.2],
      ['Le tue scelte con i media', own('media')]
    ],
    institutional: [
      ['Reputazione generale', base], ['Peso della carica', Math.max(0, tier - STANDING_RULES.officeBase) * 0.2], ['Incarico in commissione', (parliament?.careerStanding?.roleLevel ?? 0) * 2],
      ['Sostegno nel gruppo', parliament?.careerStanding ? (parliament.careerStanding.partySupport - 50) * 0.1 : 0], ['Le tue scelte nelle istituzioni', own('institutional')]
    ]
  };
  const reputation = Object.fromEntries(REPUTATION_IDS.map(id => {
    const rows = parts[id];
    if (!rows) return [id, { id, value: null, parts: [] }];
    const total = clamp(rows.reduce((sum, [, value]) => sum + value, 0));
    return [id, { id, value: round1(total), parts: rows.map(([label, value]) => ({ label, value: round1(value) })).filter(row => row.value !== 0) }];
  }));
  const sectors = SECTORS.map(item => {
    const earned = standing.sectors[item.id] ?? 0;
    const floor = standing.cache.floors?.[item.id] ?? 0;
    return { id: item.id, label: item.label, value: round1(Math.max(earned, floor)), earned: round1(earned), floor: round1(floor), areas: areasOfSector(item.id) };
  }).sort((a, b) => b.value - a.value);
  return {
    capital: game?.resources?.politicalCapital ?? 0, notoriety: round1(stats.notoriety ?? 0), influence: round1(stats.influence ?? 0), base: round1(base),
    reputation, sectors, log: standing.log, member, tier
  };
}

// What the standing adds to the factors of a promotion (all 0–100; 50 is neutral). An independent has no internal reputation:
// the party's weights do not apply to them, so the factor stays neutral.
export function standingFactors(input) {
  const view = standingOf(input);
  const best = view.sectors[0]?.value ?? 0;
  return {
    internal: view.reputation.internal.value ?? 50, territorialRep: view.reputation.territorial.value ?? 50, mediaRep: view.reputation.media.value ?? 50,
    institutional: view.reputation.institutional.value ?? 50, competence: clamp(50 + best * 0.5)
  };
}
// The competence the player has in the sector of a theme (50 with no influence there, up to 100), for the odds of a law or a ministry.
export const competenceIn = (game, area) => clamp(50 + influenceInArea(game, area) * 0.5);

export { SECTOR_GAINS };
