// Rival life between campaigns (rival-life-rules.js): the rivals the player has already met (game.rivalRegistry, the same record the campaigns write) keep acting on their own. Pure and deterministic
// (hash of week and key, no random numbers): by personality (RIVAL_PERSONALITIES of the campaign engine), by what they remember of the player (the same memory types) and by what the player promised
// (game.promises). A move is a situation event; the answer is written back in the registry, so the next campaign meets a rival who remembers.
import { RIVAL_PERSONALITIES } from './campaign-engine.js?v=20261110-20';
import { RIVAL_LIFE, RIVAL_SITUATIONS } from '../data/simulation/rival-life-rules.js?v=20261110-20';
import { AREA_BY_ID } from '../data/simulation/policy-rules.js?v=20261110-20';

const hash = text => { let h = 2166136261; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const round1 = value => Math.round(value * 10) / 10;
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const weightOf = (record, ...types) => (record.memory ?? []).filter(row => types.includes(row.type)).reduce((sum, row) => sum + Number(row.weight ?? 0), 0);
export { RIVAL_SITUATIONS };

// What a rival feels about the player, from the registry: hostility (attacks, betrayals) and warmth (aid, agreements).
export function rivalMood(record) {
  const hostility = weightOf(record, 'attack') + weightOf(record, 'betrayal') * 1.4 + weightOf(record, 'rejection') * 0.6 + (record.record?.beatPlayer ? 0.3 : 0);
  const warmth = weightOf(record, 'aid') * 1.2 + weightOf(record, 'agreement') + (record.record?.allied ? 0.5 : 0);
  return { hostility: round1(hostility), warmth: round1(warmth), relation: record.relation ?? 50 };
}
const memoryLineOf = record => {
  const top = [...(record.memory ?? [])].sort((a, b) => b.weight - a.weight)[0];
  return RIVAL_LIFE.memoryLines[top?.type] ?? 'segue da lontano la tua carriera';
};
const openPromises = game => (game?.promises ?? []).filter(item => !['mantenuta', 'parzialmente-mantenuta', 'non-mantenuta', 'modificata'].includes(item.status));

// The move of this rival this week, or null: which kind, with which parameters.
function moveOf(record, game, week) {
  const mood = rivalMood(record);
  const traits = RIVAL_PERSONALITIES[record.personality] ?? RIVAL_PERSONALITIES.prudente;
  const roll = hash(`${record.key}|mossa|${week}`);
  const promises = openPromises(game);
  const promise = promises.length ? promises[Math.floor(hash(`${record.key}|tema|${week}`) * promises.length)] : null;
  const area = promise?.area ? AREA_BY_ID[promise.area] : null;
  const base = { rivalKey: record.key, rival: record.label, personality: RIVAL_LIFE.personalityLabels[record.personality] ?? 'un avversario che conosci', memoryLine: memoryLineOf(record), topic: area?.label?.toLowerCase() ?? 'i temi del territorio', area: promise?.area ?? null };
  if (record.record?.lostToPlayer && traits.attack >= 1.2 && roll < 0.5) return { kind: 'rivale-rivincita', params: base };
  if (mood.warmth > mood.hostility && traits.alliance >= 1) return { kind: 'rivale-mano-tesa', params: base };
  if (promise && (record.personality === 'ideologico' || record.personality === 'territoriale' || record.personality === 'opportunista') && roll < 0.7) return { kind: 'rivale-sfida-tema', params: base };
  if (mood.hostility >= 0.3 || traits.attack >= 1.2) {
    const charges = ['avere tradito gli elettori', 'curare più l’immagine che i problemi', 'non mantenere quello che dici', 'stare dalla parte dei soliti noti'];
    return { kind: 'rivale-attacco', params: { ...base, charge: charges[Math.floor(hash(`${record.key}|accusa|${week}`) * charges.length)] } };
  }
  return null;
}

// Weekly: at most one move, never too often, never twice from the same rival close together. life = game.rivalLife ({ lastAny, last: { key: week } }).
export function rivalPulse(game, { week }) {
  const registry = game?.rivalRegistry ?? [];
  const life = game?.rivalLife ?? { lastAny: -99, last: {} };
  if (!registry.length || week - (life.lastAny ?? -99) < RIVAL_LIFE.minGapWeeks) return null;
  const candidates = registry.filter(record => record.key && week - (life.last?.[record.key] ?? -99) >= RIVAL_LIFE.rivalGapWeeks);
  for (const record of [...candidates].sort((a, b) => hash(`${a.key}|ordine|${week}`) - hash(`${b.key}|ordine|${week}`))) {
    const initiative = Number(record.initiative ?? 0.6);
    if (hash(`${record.key}|tick|${week}`) >= RIVAL_LIFE.baseChance * (0.5 + initiative)) continue;
    const move = moveOf(record, game, week);
    if (move) return { ...move, rivalKey: record.key, life: { lastAny: week, last: { ...(life.last ?? {}), [record.key]: week } } };
  }
  return null;
}

const ANSWERS = Object.freeze({
  'rival-reply': { memory: [['attack', 0.2]], relation: -1 }, 'rival-counter': { memory: [['attack', 0.7]], relation: -6 }, 'rival-ignore': { memory: [['attack', 0.15]], relation: 0 },
  'rival-accept': { memory: [['agreement', 0.8]], relation: 8 }, 'rival-wait': { memory: [], relation: 0 }, 'rival-refuse': { memory: [['rejection', 0.6]], relation: -5 }
});
// The competence of the player against the rival on a theme: who wins a public duel (deterministic).
export function duelOutcome(record, { competence = 50, reputation = 50, week = 0 }) {
  const traits = RIVAL_PERSONALITIES[record.personality] ?? RIVAL_PERSONALITIES.prudente;
  const mine = competence * 0.5 + reputation * 0.3 + hash(`${record.key}|duello|io|${week}`) * 20;
  const theirs = 45 + traits.visibility * 8 + Number(record.initiative ?? 0.6) * 12 + hash(`${record.key}|duello|lui|${week}`) * 20;
  const margin = round1(mine - theirs);
  return { won: margin >= 0, margin, effects: margin >= 0 ? { popularity: 2, reputation: 0.8, notoriety: 1 } : { popularity: -1.5, reputation: -0.6 } };
}
// The answer of the player written in the registry: memory and rapport of the rival; returns the next registry and what to tell.
export function answerRivalMove(registry, rivalKey, special, { date, week, competence = 50, reputation = 50 } = {}) {
  const record = (registry ?? []).find(item => item.key === rivalKey);
  if (!record) return { registry: registry ?? [], effects: {}, line: null };
  let spec = ANSWERS[special];
  let duel = null;
  if (special === 'rival-duel') { duel = duelOutcome(record, { competence, reputation, week }); spec = { memory: [[duel.won ? 'defeat' : 'victory', 0.6]], relation: duel.won ? -3 : 2 }; }
  if (!spec) return { registry, effects: {}, line: null };
  const memory = [...(record.memory ?? [])];
  for (const [type, weight] of spec.memory) {
    const row = memory.find(item => item.type === type);
    if (row) { row.weight = round1(Math.min(3, row.weight + weight)); row.count = (row.count ?? 0) + 1; row.date = date; }
    else memory.push({ type, weight, count: 1, date });
  }
  const life = { moves: (record.life?.moves ?? 0) + 1, lastWeek: week, lastAnswer: special };
  const next = { ...record, relation: clamp((record.relation ?? 50) + spec.relation), memory: memory.sort((a, b) => b.weight - a.weight), life };
  const line = duel ? (duel.won ? `Il confronto con ${record.label} va a tuo favore.` : `Il confronto con ${record.label} lo vince lui.`) : `${record.label} prende nota della tua risposta.`;
  return { registry: registry.map(item => item.key === rivalKey ? next : item), effects: duel?.effects ?? {}, line, duel };
}
// What the page shows: the rivals the player has met, with mood and last move.
export function rivalsView(game, areasOf = () => []) {
  const mine = new Set((game?.promises ?? []).filter(item => !['mantenuta', 'parzialmente-mantenuta', 'non-mantenuta', 'modificata'].includes(item.status)).map(item => item.area));
  for (const id of game?.party?.program?.areas ?? []) mine.add(id);
  return (game?.rivalRegistry ?? []).map(record => { const theirs = areasOf(record.partyId) ?? []; return ({ shared: theirs.filter(id => mine.has(id)), onlyTheirs: theirs.filter(id => !mine.has(id)), onlyMine: [...mine].filter(id => !theirs.includes(id)).slice(0, 4), areas: theirs, key: record.key, label: record.label, personality: record.personality, mood: rivalMood(record), relation: record.relation ?? 50, life: record.life ?? null, lastMet: record.lastMet ?? null, memoryLine: memoryLineOf(record) }); });
}
