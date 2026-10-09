// The starting conditions of a career, in motion. At the start they become real values (stats, relations, funds, the
// state of the party) and a state kept in game.start; during the game they go on producing consequences: creditors
// ask for their favours, the apparatus tests an outsider, a divided party drags its currents into the open, enemies
// strike back, the past resurfaces, expectations have to be met. The numbers of the other engines (promotions,
// candidacies, campaigns, the equilibrium of the relations) read the same state through startMods(), so a condition
// is never a label: it changes how the career is played.
// Pure functions over plain data: the career engine hands in the helpers it owns (memory, relations) through `api`,
// so nothing here imports the career engine. Everything is simulated; no real person or organisation is described.
import {
  DEBT_KINDS, ENEMY_LABELS, LEVER_BY_ID, LEVER_EFFECTS, SHADOW_LABELS, START_BUDGET, START_EXCLUSIONS, START_LEVEL_MAX, START_LEVERS, START_PACE, START_PROFILES
} from '../data/simulation/start-rules.js?v=20261009-1';
import { PARTY_RANKS } from '../data/simulation/career-rules.js?v=20261009-1';

const SIM = 'simulation';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;
const hash = value => [...String(value)].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 2166136261) || 1;
const STAT_LABEL = Object.freeze({ popularity: 'Popolarità', reputation: 'Reputazione', experience: 'Esperienza', influence: 'Influenza', notoriety: 'Notorietà', consensus: 'Consenso' });
const RELATION_LABEL = Object.freeze({ civic: 'associazioni e comitati', media: 'redazioni locali', business: 'categorie produttive', unions: 'sindacati', leadership: 'leadership del partito', rival: 'rivale' });
const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${String(Math.abs(round1(value))).replace('.', ',')}`;
export const ageOn = (birthDate, date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return null;
  return Number(date.slice(0, 4)) - Number(birthDate.slice(0, 4)) - (date.slice(5) < birthDate.slice(5) ? 1 : 0);
};

// ---------- the plan: profile, levels, points ----------
// A start as the wizard keeps it ({ profile, levels }): the profile is known, a preset brings its own levels, the
// custom scenario brings the ones the player chose; every level is an integer from 0 to 3.
export function normalizeStart(raw) {
  const profile = START_PROFILES[raw?.profile] ? raw.profile : 'ordinaria';
  const preset = START_PROFILES[profile];
  const source = preset.custom ? (raw?.levels ?? {}) : preset.levels;
  const levels = {};
  for (const lever of START_LEVERS) {
    const level = Math.round(Number(source[lever.id]));
    if (Number.isFinite(level) && level > 0) levels[lever.id] = Math.min(START_LEVEL_MAX, level);
  }
  return { profile, levels };
}
// The wizard's choice: a profile (the custom scenario starts from the way of starting just left, so it can be adjusted)
// or one step of a lever (which turns the start into a custom scenario).
export function chooseStart(current, { profile = null, lever = null, delta = 0 } = {}) {
  const base = normalizeStart(current);
  if (profile) {
    if (!START_PROFILES[profile]) return base;
    return profile === 'personalizzato' ? { profile, levels: { ...base.levels } } : { profile, levels: {} };
  }
  if (lever && LEVER_BY_ID[lever] && Number.isFinite(delta)) {
    const levels = { ...base.levels };
    const level = clamp((levels[lever] ?? 0) + Math.sign(delta), 0, START_LEVEL_MAX);
    if (level) levels[lever] = level; else delete levels[lever];
    return { profile: 'personalizzato', levels };
  }
  return base;
}
// Without an existing party to join, what depends on a party (a protector, a divided party) cannot exist.
export function effectiveLevels(start, { partyMode = 'independent' } = {}) {
  const { levels } = normalizeStart(start);
  const kept = {};
  const dropped = [];
  for (const [id, level] of Object.entries(levels)) {
    if (LEVER_BY_ID[id].party === 'member' && partyMode !== 'existing') dropped.push(id); else kept[id] = level;
  }
  return { levels: kept, dropped };
}
export function startBalance(levels = {}) {
  let spent = 0;
  let gained = 0;
  for (const lever of START_LEVERS) {
    const level = levels[lever.id] ?? 0;
    if (lever.kind === 'vantaggio') spent += (lever.cost ?? 0) * level; else gained += (lever.gain ?? 0) * level;
  }
  return { free: START_BUDGET, spent, gained, balance: START_BUDGET + gained - spent };
}
// What is wrong with a start (an empty list = valid): the profile, the party it needs, the levers that exclude each
// other, the points. The age is checked apart, once the birth date is known (startAgeProblems).
export function startProblems(start, { partyMode = 'independent' } = {}) {
  const errors = [];
  const raw = start ?? {};
  if (raw.profile !== undefined && !START_PROFILES[raw.profile]) return ['Scegli come iniziare la carriera.'];
  const { profile, levels } = normalizeStart(raw);
  const preset = START_PROFILES[profile];
  if (preset.party === 'member' && partyMode !== 'existing') errors.push(`${preset.label}: serve un partito esistente da cui partire (scegli «Entra in un partito»).`);
  for (const rule of START_EXCLUSIONS) if ((levels[rule.lever] ?? 0) > 0 && (levels[rule.other] ?? 0) > rule.max) errors.push(rule.text);
  const { levels: effective } = effectiveLevels({ profile, levels }, { partyMode });
  const points = startBalance(effective);
  if (points.balance < 0) errors.push(`Il punteggio dello scenario è in rosso di ${-points.balance} punti: togli qualche vantaggio o aggiungi una zavorra.`);
  return errors;
}
export function startAgeProblems(start, { partyMode = 'independent', birthDate = null, date = null } = {}) {
  const age = ageOn(birthDate, date);
  if (age === null) return [];
  const { levels } = effectiveLevels(start, { partyMode });
  return Object.entries(levels).flatMap(([id, level]) => {
    const need = LEVER_BY_ID[id].minAge?.[level] ?? 0;
    return need && age < need ? [`${LEVER_BY_ID[id].label} al livello ${level} richiede almeno ${need} anni: ne hai ${age}.`] : [];
  });
}
// The plan the engine applies: effective levels (the chosen ones plus the free levels a legacy gives, never above 3),
// what was dropped, the points (the chosen levers only: a legacy costs nothing and gives no points).
export function startPlan(start, { partyMode = 'independent', legacy = null } = {}) {
  const { profile } = normalizeStart(start);
  const { levels: chosen, dropped } = effectiveLevels(start, { partyMode });
  const free = Object.fromEntries(Object.entries(legacy?.free ?? {}).filter(([id]) => LEVER_BY_ID[id] && (LEVER_BY_ID[id].party !== 'member' || partyMode === 'existing')));
  const levels = { ...chosen };
  for (const [id, level] of Object.entries(free)) levels[id] = Math.min(START_LEVEL_MAX, (levels[id] ?? 0) + level);
  return {
    profile, label: START_PROFILES[profile].label, custom: Boolean(START_PROFILES[profile].custom), levels, chosen, free, dropped, points: startBalance(chosen),
    legacy: legacy ? { id: legacy.id, name: legacy.name, tier: legacy.tier, score: legacy.score } : null
  };
}
// A start exists when it brings conditions or the legacy of a concluded career (even one that gives nothing: its name still precedes the heir).
export const hasStart = plan => Object.keys(plan?.levels ?? {}).length > 0 || Boolean(plan?.legacy);

// ---------- what each level means (the text is generated from the same numbers the engine applies) ----------
export function leverLines(id, level) {
  const fx = LEVER_EFFECTS[id];
  if (!fx || !level) return [];
  const lines = [];
  const stats = Object.entries(fx.stats ?? {}).map(([key, value]) => `${STAT_LABEL[key]} ${signed(value * level)}`);
  if (stats.length) lines.push(stats.join(' · '));
  const relations = Object.entries(fx.relations ?? {}).map(([key, value]) => `${RELATION_LABEL[key]} ${signed(value * level)}`);
  if (relations.length) lines.push(`Rapporti: ${relations.join(', ')}`);
  const memberRelations = Object.entries(fx.member?.relations ?? {}).map(([key, value]) => `${RELATION_LABEL[key]} ${signed(value * level)}`);
  if (memberRelations.length) lines.push(`Da iscritto: ${memberRelations.join(', ')}`);
  if (fx.base || fx.member?.base) lines.push('Il livello di equilibrio dei rapporti si sposta con la partenza: tornano lì, non al valore di sempre');
  if (id === 'risorse') lines.push(`Fondi di partenza +${Math.round(fx.funds * level * 100)}%; la prima campagna parte con più mezzi`);
  if (id === 'capitale') lines.push(`Capitale politico +${fx.capital * level}`);
  if (id === 'esperienza') {
    lines.push(`Anzianità +${fx.seniority * level} e un peso in più nelle promozioni (${signed(fx.partyScore * level)} punti)`);
    if (fx.rank[level]) lines.push(`Da iscritto parti da «${PARTY_RANKS[fx.rank[level]].title}»`);
    lines.push(`Attese più alte alle elezioni (${signed(fx.expectation * level)} punti)`);
  }
  if (id === 'notorieta') lines.push(`Più visibilità in campagna (${signed(fx.visibility * level)})`);
  if (id === 'sostegno') lines.push(`Sostegno interno ${signed(fx.member.support * level)}; candidature più facili (${signed(fx.nomination * level)})`);
  if (id === 'radicamento') lines.push(`Più peso nel territorio (${signed(fx.territory * level)}), ${fx.volunteers * level} volontari in più in campagna, sezione più viva`);
  if (id === 'debiti') lines.push(`${level} ${level === 1 ? 'creditore' : 'creditori'} con favori da restituire: scadenze, richieste e, se resti senza risposta, un nemico`);
  if (id === 'nemici') lines.push(`${level} ${level === 1 ? 'nemico' : 'nemici'} che attaccano a intervalli: servono risposte`);
  if (id === 'partito-diviso') lines.push(`Coesione ${signed(fx.cohesion * level)}, ${level >= 3 ? 'due scontri aperti' : 'uno scontro aperto'}, congresso fra ${fx.congressWeeks[level]} settimane; più peso nelle sfide interne finché dura la crisi`);
  if (id === 'outsider') lines.push(`Da iscritto: sostegno interno ${signed(fx.member.support * level)}; candidature più difficili (${signed(fx.nomination * level)}); fascino sugli elettori in campagna (${signed(fx.appeal * level)}); la condizione si scioglie man mano che ti integri`);
  if (id === 'precedenti') lines.push(level === 1 ? 'Una vicenda del passato tornerà a galla' : `${level} vicende del passato torneranno a galla`);
  if (id === 'aspettative') lines.push(`Il risultato atteso alle elezioni sale di ${fx.expectation * level} punti; se la popolarità resta sotto le attese perdi sostegno nel partito`);
  return lines;
}
export const planLines = plan => START_LEVERS.filter(lever => (plan?.levels?.[lever.id] ?? 0) > 0).map(lever => ({ id: lever.id, label: lever.label, kind: lever.kind, level: plan.levels[lever.id], lines: leverLines(lever.id, plan.levels[lever.id]) }));

// ---------- the numbers a start gives the career at the beginning ----------
// Stat deltas (the wizard adds them to the baseline of the level and the difficulty).
export function startStatDeltas(levels = {}) {
  const out = {};
  for (const [id, level] of Object.entries(levels)) for (const [stat, delta] of Object.entries(LEVER_EFFECTS[id]?.stats ?? {})) out[stat] = round2((out[stat] ?? 0) + delta * level);
  return out;
}
export const startFundsFactor = (levels = {}) => 1 + LEVER_EFFECTS.risorse.funds * (levels.risorse ?? 0);

// Applies a start to a game just created (week 1): resources, relations, party, memory and the state of the pressures.
export function startInit(game, plan, api) {
  const levels = plan?.levels ?? {};
  if (!Object.keys(levels).length && !plan?.legacy) return null;
  const L = id => levels[id] ?? 0;
  const party = game.party;
  const member = party?.affiliation === 'member';
  const seed = game.seed;
  const week = game.week.index;
  const date = game.week.startedAt;
  game.resources.politicalCapital = clamp(game.resources.politicalCapital + LEVER_EFFECTS.capitale.capital * L('capitale'));
  for (const [id, level] of Object.entries(levels)) {
    const fx = LEVER_EFFECTS[id] ?? {};
    for (const [relation, delta] of Object.entries(fx.relations ?? {})) api.changeRelation(game, relation, delta * level);
    if (member) for (const [relation, delta] of Object.entries(fx.member?.relations ?? {})) api.changeRelation(game, relation, delta * level);
  }
  if (member) {
    const support = Object.entries(levels).reduce((sum, [id, level]) => sum + (LEVER_EFFECTS[id]?.member?.support ?? 0) * level, 0) + LEVER_EFFECTS['partito-diviso'].support * L('partito-diviso');
    party.support = clamp(round2(party.support + support));
    const rank = LEVER_EFFECTS.esperienza.rank[L('esperienza')] ?? 0;
    if (rank > party.rank) {
      party.rank = rank; party.rankTitle = PARTY_RANKS[rank].title;
      party.history.push({ week, date, text: `Parte da ${party.rankTitle.toLowerCase()}: anni di lavoro nel partito`, source: SIM });
    }
  }
  const home = party?.org?.sections?.find(item => item.region === game.place?.region);
  if (home && L('radicamento')) home.vitality = Math.round(clamp(home.vitality + LEVER_EFFECTS.radicamento.vitality * L('radicamento')));
  // A party already divided: the two strongest areas at war, a low cohesion, a congress around the corner.
  let divided = null;
  if (member && L('partito-diviso')) {
    const level = L('partito-diviso');
    const fx = LEVER_EFFECTS['partito-diviso'];
    const ranked = [...party.currents].sort((a, b) => b.strength - a.strength);
    const [a, b, c] = ranked;
    const org = party.org;
    org.cohesion = Math.round(clamp(org.cohesion + fx.cohesion * level, 22, 100));
    const clash = (first, second, intensity, topic, id) => ({ id, title: `${first.label} contro ${second.label} ${topic}`, currents: [first.id, second.id], intensity, since: week, source: SIM });
    org.conflicts = [...org.conflicts, clash(a, b, fx.conflict[level], 'sulla guida del partito', 'conflitto-partenza-1')];
    if (level >= 3 && c) org.conflicts.push(clash(a, c, fx.conflict[level] - 12, 'sulle candidature', 'conflitto-partenza-2'));
    org.congress = { ...org.congress, nextWeek: Math.min(org.congress.nextWeek ?? 999, week + fx.congressWeeks[level]) };
    for (const current of ranked.slice(1)) {
      const actor = party.life?.actors?.[current.id];
      if (actor) { actor.grievance = Math.round(clamp(actor.grievance + fx.grievance * level)); actor.loyalty = Math.round(clamp(actor.loyalty + fx.loyalty * level)); }
    }
    divided = { level, since: week, resolvedAt: null, side: null, raised: false, mediated: 0 };
  }
  const kinds = Object.keys(DEBT_KINDS).filter(kind => member || !DEBT_KINDS[kind].party);
  const kindStart = hash(`${seed}|debiti`) % kinds.length;
  const debts = Array.from({ length: L('debiti') }, (_, index) => {
    const kind = kinds[(kindStart + index) % kinds.length];
    const spec = DEBT_KINDS[kind];
    api.changeRelation(game, spec.relation, 5);
    return { id: `debito-${index + 1}`, kind, creditor: spec.label, favor: spec.favor, relation: spec.relation, due: START_PACE.firstDebt + index * START_PACE.debtSpacing + (hash(`${seed}|debito|${index}`) % 4), deferred: 0, severity: 1, status: 'aperto', source: SIM };
  });
  const enemies = Array.from({ length: L('nemici') }, (_, index) => ({ id: `nemico-${index + 1}`, label: ENEMY_LABELS[(hash(`${seed}|nemici`) + index) % ENEMY_LABELS.length], nextAttack: START_PACE.firstEnemyAttack + index * 10 + (hash(`${seed}|nemico|${index}`) % 6), attacks: 0, calmUntil: null, origin: 'partenza', source: SIM }));
  const shadows = Array.from({ length: L('precedenti') }, (_, index) => ({ id: `ombra-${index + 1}`, label: SHADOW_LABELS[(hash(`${seed}|ombre`) + index) % SHADOW_LABELS.length], surfaceWeek: START_PACE.firstShadow + index * START_PACE.shadowSpacing + (hash(`${seed}|ombra|${index}`) % 10), state: 'dormiente', source: SIM }));
  if (shadows.length) api.remember(game, { date, kind: 'scandalo', text: 'Una vicenda del passato pesa sul tuo nome', weight: round2(0.8 * Math.min(2, shadows.length)) });
  if (L('esperienza') >= 2) api.remember(game, { date, kind: 'vittoria-elettorale', text: 'Anni di lavoro e di risultati alle spalle', weight: round2(0.6 * L('esperienza') / 2) });
  const history = [{ week, text: plan.legacy ? `Punto di partenza: ${plan.label}, con l’eredità di ${plan.legacy.name}` : `Punto di partenza: ${plan.label}`, source: SIM }];
  game.start = {
    version: 1, profile: plan.profile, custom: Boolean(plan.custom), levels: { ...levels }, since: week, date, source: SIM,
    debts, enemies, shadows, divided,
    legacy: plan.legacy ? { ...plan.legacy, raised: false } : null,
    outsider: L('outsider') ? { level: L('outsider'), integration: 0, raised: false, kept: 0 } : null,
    expectation: L('aspettative') ? { level: L('aspettative'), lowered: 0, lastCheck: START_PACE.expectationEvery - 8 } : null,
    history
  };
  return game.start;
}

// ---------- what the conditions in force change in the other engines ----------
const levelNow = (start, id) => id === 'outsider' ? (start.outsider?.level ?? 0) : id === 'aspettative' ? Math.max(0, (start.levels.aspettative ?? 0) - (start.expectation?.lowered ?? 0)) : (start.levels[id] ?? 0);
export const NO_MODS = Object.freeze({ active: false, nomination: 0, partyScore: 0, parlScore: 0, expectation: 0, money: 0, volunteers: 0, visibility: 0, appeal: 0, seniority: 0, territory: 0, notes: Object.freeze([]) });
export function startMods(game) {
  const start = game?.start;
  if (!start || !Object.keys(start.levels ?? {}).length) return NO_MODS;
  const L = id => levelNow(start, id);
  const member = game.party?.affiliation === 'member';
  const open = Boolean(start.divided && !start.divided.resolvedAt);
  const fx = LEVER_EFFECTS;
  const mods = {
    active: true,
    nomination: round2(fx.esperienza.nomination * L('esperienza') + (member ? fx.sostegno.nomination * L('sostegno') : 0) + fx.outsider.nomination * L('outsider') * (member ? 1 : 0) + (open ? fx['partito-diviso'].nomination * (start.divided.level ?? 0) : 0)),
    partyScore: round2(fx.esperienza.partyScore * L('esperienza') + fx.outsider.partyScore * L('outsider') + (open ? fx['partito-diviso'].partyScore * (start.divided.level ?? 0) : 0)),
    parlScore: round2(fx.esperienza.parlScore * L('esperienza') + fx.outsider.parlScore * L('outsider')),
    expectation: round2(fx.aspettative.expectation * L('aspettative') + fx.esperienza.expectation * L('esperienza')),
    money: round2(fx.risorse.money * L('risorse')),
    volunteers: Math.round(fx.radicamento.volunteers * L('radicamento') + fx.outsider.volunteers * L('outsider')),
    visibility: Math.round(fx.notorieta.visibility * L('notorieta') + fx.outsider.visibility * L('outsider')),
    appeal: round2(fx.outsider.appeal * L('outsider')),
    seniority: fx.esperienza.seniority * L('esperienza'),
    territory: fx.radicamento.territory * L('radicamento')
  };
  const notes = [];
  if (L('outsider')) notes.push(`Outsider (${L('outsider')}/3): fascino sugli elettori ${signed(mods.appeal)}, candidature ${signed(fx.outsider.nomination * L('outsider'))}`);
  if (L('esperienza')) notes.push(`Carriera alle spalle: attese ${signed(fx.esperienza.expectation * L('esperienza'))}, anzianità ${signed(mods.seniority)}`);
  if (L('aspettative')) notes.push(`Aspettative alte: il risultato atteso sale di ${signed(fx.aspettative.expectation * L('aspettative'))}`);
  if (open) notes.push('Partito diviso: la leadership è contendibile');
  if (L('sostegno') && member) notes.push(`Protettore nel partito: candidature ${signed(fx.sostegno.nomination * L('sostegno'))}`);
  return { ...mods, notes };
}
// The moment bonuses of a promotion attempt (progression-engine adds them to the score).
export function startMoment(kind, game) {
  const start = game?.start;
  if (!start) return [];
  const L = id => levelNow(start, id);
  const bits = [];
  if (kind === 'partito') {
    if (L('outsider')) bits.push(['Outsider: nessun apparato alle spalle', LEVER_EFFECTS.outsider.partyScore * L('outsider')]);
    if (L('esperienza')) bits.push(['Una carriera alle spalle: il tuo nome pesa', LEVER_EFFECTS.esperienza.partyScore * L('esperienza')]);
    if (start.divided && !start.divided.resolvedAt) bits.push(['Partito diviso: la leadership è contendibile', LEVER_EFFECTS['partito-diviso'].partyScore * start.divided.level]);
  } else if (kind === 'parlamento') {
    if (L('outsider')) bits.push(['Outsider: pochi appoggi in Parlamento', LEVER_EFFECTS.outsider.parlScore * L('outsider')]);
    if (L('esperienza')) bits.push(['Una carriera alle spalle: il tuo nome pesa', LEVER_EFFECTS.esperienza.parlScore * L('esperienza')]);
  }
  return bits;
}
// The level a relation returns to when nothing happens (the career engine pulls every relation towards it).
export function startBase(game, relationId) {
  const start = game?.start;
  if (!start) return 0;
  const member = game.party?.affiliation === 'member';
  let shift = 0;
  for (const id of Object.keys(start.levels)) {
    const level = levelNow(start, id);
    const fx = LEVER_EFFECTS[id] ?? {};
    shift += (fx.base?.[relationId] ?? 0) * level;
    if (member) shift += (fx.member?.base?.[relationId] ?? 0) * level;
  }
  return shift;
}

// ---------- the pressures, week by week (no random draws: the schedule follows the state) ----------
const debtPressure = debt => debt.deferred === 0 ? 'È il momento di restituire il favore.' : `Hai già rimandato ${debt.deferred} ${debt.deferred === 1 ? 'volta' : 'volte'}: la pazienza sta per finire.`;
const debtParams = (debt, week) => ({ debtId: debt.id, creditor: debt.creditor, favor: debt.favor, targetId: debt.relation, overdue: Math.max(0, week - debt.due), deferred: debt.deferred, pressure: debtPressure(debt), risk: DEBT_KINDS[debt.kind].risk + '.' });
export function advanceStart(game, api, { week = game.week.index, date = null, stats = {}, seat = false, mandates = 0 } = {}) {
  const start = game.start;
  const out = { lines: [], raises: [], logs: [] };
  if (!start) return out;
  const raised = id => game.inbox.some(item => item.templateId === id);
  const party = game.party;
  // Creditors: the next debt due asks for its favour (one request at a time).
  if (!raised('start-debito')) {
    const due = start.debts.filter(item => item.status === 'aperto' && item.due <= week).sort((a, b) => a.due - b.due)[0];
    if (due) out.raises.push({ id: 'start-debito', params: debtParams(due, week), urgent: false });
  }
  // A divided party: the first call to choose a side, and the day the party finds peace.
  const divided = start.divided;
  if (divided && !divided.resolvedAt && party?.org) {
    if (!divided.raised && week >= START_PACE.dividedEvent && !raised('start-partito-spaccato')) {
      divided.raised = true;
      out.raises.push({ id: 'start-partito-spaccato', params: { cohesion: Math.round(party.org.cohesion) }, urgent: true });
    }
    if (week - divided.since >= 8 && (party.org.conflicts ?? []).length === 0 && party.org.cohesion >= 55) {
      divided.resolvedAt = week;
      api.remember(game, { date, kind: 'lealta', text: 'Il partito si è ricomposto dopo la spaccatura', weight: 1.2 });
      out.logs.push({ kind: 'partito', title: 'Il partito si ricompone', lines: ['Gli scontri si sono chiusi e la coesione è tornata sopra 55: la leadership non è più contendibile come prima.'], tone: 'good' });
      out.lines.push('Il partito si è ricomposto dopo la spaccatura.');
    }
  }
  // The outsider: the apparatus approaches, and each year in the palaces wears the condition down.
  const outsider = start.outsider;
  if (outsider?.level > 0) {
    if (!outsider.raised && week >= START_PACE.outsiderEvent && party?.affiliation === 'member' && !raised('start-outsider-apparato')) {
      outsider.raised = true;
      out.raises.push({ id: 'start-outsider-apparato', params: { level: outsider.level }, urgent: false });
    }
    const leadership = (game.relations.find(item => item.id === 'leadership')?.value ?? 0);
    const points = (party?.affiliation === 'member' && leadership >= 65 && party.support >= 60 ? 1 : 0) + ((party?.rank ?? 0) >= 2 ? 0.5 : 0) + (seat ? 0.5 : 0) + (mandates > 0 ? 0.5 : 0);
    outsider.integration = round2(outsider.integration + points / (52 * START_PACE.outsiderIntegrationYears));
    if (outsider.integration >= 1) {
      outsider.level -= 1; outsider.integration = 0;
      start.history.push({ week, text: outsider.level ? 'Meno outsider: gli appoggi crescono, la freschezza cala' : 'Non sei più un outsider', source: SIM });
      api.remember(game, { date, kind: 'decisione', text: outsider.level ? 'Meno outsider di prima: ti stai integrando' : 'Non sei più un outsider: sei ormai parte dell’establishment', weight: 1 });
      out.logs.push({ kind: 'carriera', title: outsider.level ? 'Meno outsider di prima' : 'Non sei più un outsider', lines: ['Più resti nei palazzi, più pesi, ma meno sei visto come una novità: il fascino sugli elettori cala e gli appoggi nel partito crescono.'], tone: 'neutral' });
      out.lines.push(outsider.level ? 'Sei meno outsider di prima.' : 'Non sei più un outsider.');
    }
  }
  // Enemies strike at intervals, until calmed.
  if (!raised('start-nemico')) {
    const enemy = start.enemies.find(item => (item.calmUntil ?? 0) <= week && item.nextAttack <= week);
    if (enemy) {
      enemy.attacks += 1; enemy.nextAttack = week + START_PACE.enemySpacing + (hash(`${game.seed}|${enemy.id}|${enemy.attacks}`) % 8);
      out.raises.push({ id: 'start-nemico', params: { enemy: enemy.label, enemyId: enemy.id }, urgent: false });
    }
  }
  // The name of a concluded career: the first decision of the heir.
  if (start.legacy && !start.legacy.raised && week >= START_PACE.legacyEvent && !raised('start-eredita')) {
    start.legacy.raised = true;
    out.raises.push({ id: 'start-eredita', params: { predecessor: start.legacy.name, tier: String(start.legacy.tier ?? '').toLowerCase() }, urgent: false });
  }
  // The past comes back, one shadow at a time.
  if (!raised('start-passato')) {
    const shadow = start.shadows.find(item => item.state === 'dormiente' && item.surfaceWeek <= week);
    if (shadow) { shadow.state = 'emersa'; out.raises.push({ id: 'start-passato', params: { shadow: shadow.label, shadowId: shadow.id }, urgent: false }); }
  }
  // Expectations: below the bar, support leaks away and, now and then, someone says it out loud.
  const expectation = start.expectation;
  if (expectation && levelNow(start, 'aspettative') > 0) {
    const level = levelNow(start, 'aspettative');
    const expected = START_PACE.expectationFloor + 4 * level;
    const popularity = stats.popularity ?? 50;
    if (popularity < expected && party) party.support = clamp(round2(party.support - LEVER_EFFECTS.aspettative.demand * level * Math.min(1, (expected - popularity) / 10)));
    // The weeks spent at the height of the expectations (a goal of the career counts them).
    if (popularity >= expected) expectation.metWeeks = (expectation.metWeeks ?? 0) + 1;
    if (week - expectation.lastCheck >= START_PACE.expectationEvery && popularity < expected && !raised('start-attese')) {
      expectation.lastCheck = week;
      out.raises.push({ id: 'start-attese', params: { popularity: Math.round(popularity), expected }, urgent: false });
    }
  }
  return out;
}

// The decisions: each special of the start events changes the state of the pressure it belongs to.
export function startSpecial(game, special, item, choice, api) {
  const start = game.start;
  const lines = [];
  if (!start) return lines;
  const week = game.week.index;
  const date = game.week.startedAt;
  const params = item.params ?? {};
  const betray = (debt, text) => {
    debt.status = 'tradito'; debt.closedWeek = week;
    start.enemies.push({ id: `nemico-${debt.id}`, label: `${debt.creditor.replace(/ \(figura simulata\)$/, '')} (ex creditore, figura simulata)`, nextAttack: week + 8, attacks: 0, calmUntil: null, origin: 'debito', source: SIM });
    start.history.push({ week, text, source: SIM });
  };
  if (special.startsWith('start-debt-')) {
    const debt = start.debts.find(entry => entry.id === params.debtId);
    if (!debt) return lines;
    if (special === 'start-debt-pay') {
      debt.status = 'saldato'; debt.closedWeek = week;
      start.history.push({ week, text: `Debito onorato: ${debt.favor}`, source: SIM });
      lines.push('Il debito è saldato: il creditore è soddisfatto.');
    } else if (special === 'start-debt-defer') {
      debt.deferred += 1; debt.due = week + START_PACE.debtDeferWeeks;
      if (choice?.id === 'attendi') debt.severity += 1;
      if (debt.deferred > START_PACE.debtGraceDeferrals) {
        api.changeRelation(game, debt.relation, -8);
        api.remember(game, { date, kind: 'alleato-tradito', text: 'Un creditore politico ha perso la pazienza: i favori promessi non sono mai arrivati', weight: 1 });
        betray(debt, 'Un creditore perde la pazienza e diventa un nemico');
        lines.push('Troppi rinvii: il creditore perde la pazienza e diventa un tuo nemico.');
      } else lines.push(`Il creditore aspetterà fino alla settimana ${debt.due}.`);
    } else if (special === 'start-debt-refuse') {
      betray(debt, 'Rifiuti di onorare un debito: nasce un nemico');
      lines.push('Il creditore tradito diventa un nemico.');
    }
  } else if (special === 'start-divided-bridge' && start.divided) { start.divided.mediated += 1; lines.push('Hai provato a tenere insieme le due aree.'); }
  else if (special === 'start-divided-side' && start.divided && game.party) {
    const sideId = choice?.id === 'a' ? params.currentAId : params.currentBId;
    if (sideId) { game.party.alignedCurrentId = sideId; start.divided.side = sideId; lines.push('Ti sei schierato: l’altra area non lo dimenticherà.'); }
  } else if (special === 'start-outsider-integrate' && start.outsider) { start.outsider.integration = round2(start.outsider.integration + 0.5); lines.push('L’apparato ti accoglie: ti stai integrando.'); }
  else if (special === 'start-outsider-keep' && start.outsider) { start.outsider.kept += 1; lines.push('Resti un outsider.'); }
  else if (special === 'start-enemy-calm') {
    const enemy = start.enemies.find(entry => entry.id === params.enemyId);
    if (enemy) { enemy.calmUntil = week + START_PACE.enemyCalmWeeks; lines.push('L’avversario si calma, per un anno.'); }
  } else if (special === 'start-shadow-handled') {
    const shadow = start.shadows.find(entry => entry.id === params.shadowId);
    if (shadow) { shadow.state = 'chiusa'; shadow.closedWeek = week; start.history.push({ week, text: `Il passato riemerso (${shadow.label}) è stato affrontato`, source: SIM }); }
  } else if (special === 'start-expectation-lower' && start.expectation) {
    start.expectation.lowered = Math.min(start.levels.aspettative ?? 0, start.expectation.lowered + 1);
    lines.push('Le aspettative si abbassano di un livello.');
  }
  return lines;
}

// ---------- the state of the conditions, for the pages ----------
export function startOverview(game) {
  const start = game?.start;
  if (!start) return null;
  const week = game.week?.index ?? 0;
  const conditions = START_LEVERS.filter(lever => (start.levels[lever.id] ?? 0) > 0).map(lever => {
    const level = start.levels[lever.id];
    const now = levelNow(start, lever.id);
    let status = '';
    if (lever.id === 'debiti') { const open = start.debts.filter(item => item.status === 'aperto').length; status = `${open} aperti, ${start.debts.filter(item => item.status === 'saldato').length} saldati, ${start.debts.filter(item => item.status === 'tradito').length} traditi`; }
    else if (lever.id === 'outsider') status = now ? `livello ${now}/3 · integrazione ${Math.round((start.outsider?.integration ?? 0) * 100)}%` : 'non sei più un outsider';
    else if (lever.id === 'partito-diviso') status = start.divided?.resolvedAt ? `ricomposto alla settimana ${start.divided.resolvedAt}` : 'divisione in corso';
    else if (lever.id === 'nemici') status = `${start.enemies.filter(item => (item.calmUntil ?? 0) <= week).length} attivi su ${start.enemies.length}`;
    else if (lever.id === 'precedenti') status = `${start.shadows.filter(item => item.state === 'dormiente').length} ancora nascoste`;
    else if (lever.id === 'aspettative') status = now === level ? `livello ${now}/3` : `abbassate a ${now}/3`;
    return { id: lever.id, label: lever.label, kind: lever.kind, level, now, status, lines: leverLines(lever.id, now || level) };
  });
  return {
    profile: start.profile, label: START_PROFILES[start.profile]?.label ?? 'Inizio ordinario', custom: Boolean(start.custom), since: start.since, conditions, history: [...(start.history ?? [])].slice(-6),
    legacy: start.legacy ? { name: start.legacy.name, tier: start.legacy.tier, score: start.legacy.score } : null,
    debts: start.debts.map(item => ({ id: item.id, creditor: item.creditor, favor: item.favor, due: item.due, status: item.status, deferred: item.deferred, weeksLeft: item.status === 'aperto' ? item.due - week : null })),
    points: startBalance(start.levels), mods: startMods(game)
  };
}
// Old saves and plain games: no conditions.
export const withStart = game => game?.start ?? null;
