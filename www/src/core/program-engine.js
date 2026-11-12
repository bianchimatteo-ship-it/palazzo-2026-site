// The programme and the promises: one system for the party, the candidate, the coalition and the Government.
//
// It does not replace what already exists, it joins it:
//   - party.program (up to four priority areas, set by the secretary) is where the party's proposals come from;
//   - game.promises holds the promises of the career. Those born from a local crisis (kind 'territorio', status open/kept/broken) keep their own rule in the store; the ones of this file are
//     kind 'programma' and are checked against what the game actually did: the laws that came into force (society.lawsApplied), the bills in Parliament, the movement of the indicators;
//   - the commitments of the coalition accord (government.accord, parliament-engine.js) are shown as promises of scope 'coalizione' by reference: the accord keeps judging them, nothing is
//     counted twice;
//   - the programme of the Government (government.program.priorities, dossier-engine.js settles it) is derived from the promises of the player and the programme of the party, so the
//     Government does what was promised, not something else.
// Everything here is pure: the store applies the effects (reputation, popularity, partners, memory, news) once, when a promise is settled.
import { AREA_BY_ID, INSTRUMENT_KINDS, POLICY_AREAS } from '../data/simulation/policy-rules.js?v=20261112-8';
import { LAW_PROGRESS } from '../data/simulation/dossier-rules.js?v=20261112-8';

export const PROMISE_STATES = Object.freeze({
  'non-avviata': { label: 'Non avviata', tone: 'neutral' },
  'in-corso': { label: 'In corso', tone: 'info' },
  mantenuta: { label: 'Mantenuta', tone: 'good' },
  'parzialmente-mantenuta': { label: 'Parzialmente mantenuta', tone: 'good' },
  ritardata: { label: 'Ritardata', tone: 'warning' },
  modificata: { label: 'Modificata', tone: 'neutral' },
  'non-mantenuta': { label: 'Non mantenuta', tone: 'bad' }
});
export const PROMISE_SETTLED = Object.freeze(['mantenuta', 'parzialmente-mantenuta', 'non-mantenuta', 'modificata']);
export const PROMISE_SCOPES = Object.freeze({
  candidato: { label: 'Impegno personale', detail: 'Lo prendi tu, davanti agli elettori.', weight: 1 },
  partito: { label: 'Proposta del partito', detail: 'Viene dal programma del partito: il partito ti giudica.', weight: 1 },
  coalizione: { label: 'Impegno di coalizione', detail: 'Lo prendi con gli alleati: se manca, ne risentono gli accordi.', weight: 1.3 },
  governo: { label: 'Programma di governo', detail: 'Lo prendi da capo dell’esecutivo: pesa su fiducia e maggioranza.', weight: 1.3 }
});
export const AMBITIONS = Object.freeze({ prudente: { label: 'Prudente', goal: 'un miglioramento contenuto', cost: 0.6, lasting: 0.7, weeks: 20 }, media: { label: 'Media', goal: 'un miglioramento sensibile', cost: 1, lasting: 1, weeks: 32 }, ambiziosa: { label: 'Ambiziosa', goal: 'un miglioramento netto', cost: 1.8, lasting: 1.25, weeks: 52 } });
export const PROMISE_RULES = Object.freeze({ capacity: 4, grace: 12, improvement: 1.5, maxDue: 260, minDue: 8 });
// Priority of a promise: the voters weigh a promise the player put first more, kept or broken (credibility and what settling it gives).
export const PRIORITIES = Object.freeze({ alta: { label: 'Priorità alta', weight: 1.35 }, media: { label: 'Priorità media', weight: 1 }, bassa: { label: 'Priorità bassa', weight: 0.75 } });
const priorityWeight = item => PRIORITIES[item?.priority]?.weight ?? 1;
// Why a promise is revised: a reason that holds (the resources are really missing, the allies ask for it, an emergency, the situation has really changed) softens the price in credibility; no reason, or
// one the facts do not support, makes it heavier. The reasons are checked against the game, never taken on trust.
export const REVISION_REASONS = Object.freeze({
  risorse: { label: 'Mancano le risorse' }, alleati: { label: 'Lo chiedono gli alleati' }, emergenza: { label: 'Un’emergenza cambia le priorità' }, scenario: { label: 'Il quadro è cambiato' }, nessuno: { label: 'Nessun motivo dichiarato' }
});

// The topics of the TV debates and of the campaign (campaign-rules.js DEBATE_TOPICS) each area belongs to: what the promise feeds when it is announced or defended.
const TOPIC_OF_GROUP = Object.freeze({ conti: 'costo-vita', economia: 'lavoro', welfare: 'servizi', sapere: 'giovani', territorio: 'ambiente', sicurezza: 'sicurezza', societa: 'servizi', istituzioni: 'istituzioni' });
export const topicOfArea = areaId => areaId === 'sanita' ? 'sanita' : (AREA_BY_ID[areaId] ? TOPIC_OF_GROUP[AREA_BY_ID[areaId].group] ?? 'lavoro' : 'lavoro');

// Areas that pull against each other when both are promised with money (a promise to cut taxes beside one that spends): the voter and the press notice.
const CONFLICTS = Object.freeze([[['fisco', 'finanze'], ['welfare', 'pensioni', 'sanita', 'infrastrutture']], [['ambiente'], ['industria', 'energia']]]);

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const round1 = value => Math.round(value * 10) / 10;
export const promisesOf = game => (game?.promises ?? []).filter(item => item.kind === 'programma');
const open = promise => !PROMISE_SETTLED.includes(promise.status);

// The mean of the regional indicators an area moves (null when the area has none: the check then rests on the measure alone).
export function areaIndicator(society, areaId, region = null) {
  const spec = AREA_BY_ID[areaId]?.regional;
  if (!spec || !society?.regions) return null;
  const regions = region && society.regions[region] ? [society.regions[region]] : Object.values(society.regions);
  let total = 0, weight = 0;
  for (const entry of regions) for (const [indicator, w] of Object.entries(spec)) { const value = entry?.indicators?.[indicator]; if (Number.isFinite(value)) { total += value * w; weight += w; } }
  return weight ? round1(total / weight) : null;
}

// What the public budget allows: the room (in billions, a coarse game figure) shrinks with the deficit, and the open promises already use part of it.
export function fiscalRoom(society) {
  const deficit = Number(society?.economy?.deficit ?? 3.2);
  return round1(clamp((3.9 - deficit) * 9 + 8, 3, 40));
}
export function promiseQuote({ area, instrument = 'investimento', ambition = 'media' }) {
  const spec = AREA_BY_ID[area], kind = INSTRUMENT_KINDS[instrument], size = AMBITIONS[ambition];
  if (!spec || !kind || !size) return null;
  return { cost: round1(spec.base * 1.5 * kind.costFactor * size.cost), weeks: size.weeks, phaseIn: kind.phaseIn, lasting: kind.lasting, controversy: kind.controversy };
}

// How credible the programme is, from 0 to 100: the record of kept and broken promises, how many are open beyond what a mandate can carry, how much they cost against the room the budget
// leaves, and the contradictions between them. It is what an announcement is worth in the campaign.
export function credibility(game, { society = null, extra = null, reputation = 50 } = {}) {
  const all = promisesOf(game);
  const kept = all.filter(item => item.status === 'mantenuta').reduce((sum, item) => sum + priorityWeight(item), 0) + all.filter(item => item.status === 'parzialmente-mantenuta').reduce((sum, item) => sum + 0.5 * priorityWeight(item), 0);
  const broken = all.filter(item => item.status === 'non-mantenuta').reduce((sum, item) => sum + priorityWeight(item), 0);
  const live = [...all.filter(open), ...(extra ? [extra] : [])];
  const overload = Math.max(0, live.length - PROMISE_RULES.capacity);
  const cost = live.reduce((sum, item) => sum + (item.cost ?? 0), 0);
  const room = fiscalRoom(society);
  const uncovered = Math.max(0, cost - room) / Math.max(1, room);
  const conflicts = conflictsOf(live);
  const score = 68 + (reputation - 50) * .3 + kept * 5 - broken * 9 - overload * 7 - uncovered * 18 - conflicts.length * 8;
  const notes = [];
  if (overload) notes.push(`Troppe promesse aperte (${live.length}): un mandato ne regge ${PROMISE_RULES.capacity}.`);
  if (uncovered > 0) notes.push(`Costi per ${round1(cost)} miliardi contro un margine di bilancio di circa ${room}: manca la copertura.`);
  for (const [a, b] of conflicts) notes.push(`${AREA_BY_ID[a]?.label ?? a} e ${AREA_BY_ID[b]?.label ?? b} tirano in direzioni opposte.`);
  const brokenCount = all.filter(item => item.status === 'non-mantenuta').length;
  if (brokenCount) notes.push(`${brokenCount} promess${brokenCount === 1 ? 'a non mantenuta pesa' : 'e non mantenute pesano'} sulla tua parola.`);
  return { score: Math.round(clamp(score, 5, 100)), live: live.length, overload, cost: round1(cost), room, conflicts, notes, kept: Math.round(kept * 10) / 10, broken: Math.round(broken * 10) / 10 };
}
function conflictsOf(list) {
  const out = [];
  const money = list.filter(item => ['investimento', 'sostegno'].includes(item.instrument) || !item.instrument).map(item => item.area);
  for (const [lefts, rights] of CONFLICTS) for (const left of lefts) for (const right of rights) if (money.includes(left) && money.includes(right) && left !== right) out.push([left, right]);
  return out;
}

// ---------- making, changing, withdrawing ----------
export function makePromise(game, { area, scope = 'candidato', instrument = 'investimento', ambition = 'media', dueWeeks = null, region = null, campaignId = null, source = null, priority = 'media' } = {}, { week, date, society = null, reputation = 50 } = {}) {
  const spec = AREA_BY_ID[area];
  if (!spec) throw new Error('Scegli un’area politica per la promessa.');
  if (!PROMISE_SCOPES[scope]) throw new Error('Scegli in nome di chi prendi l’impegno.');
  if (!INSTRUMENT_KINDS[instrument]) throw new Error('Scegli lo strumento con cui vuoi mantenerla.');
  if (!AMBITIONS[ambition]) throw new Error('Scegli quanto è ambiziosa.');
  if (promisesOf(game).some(item => open(item) && item.area === area && item.scope === scope)) throw new Error(`Hai già una promessa aperta su ${spec.label.toLowerCase()}: modificala invece di ripeterla.`);
  const quote = promiseQuote({ area, instrument, ambition });
  const due = clamp(Math.round(dueWeeks ?? quote.weeks), PROMISE_RULES.minDue, PROMISE_RULES.maxDue);
  const item = {
    id: `promessa-prog-${week}-${area}-${scope}`, kind: 'programma', scope, area, label: spec.label, instrument, ambition, region,
    problem: spec.problem ?? null, objective: `${spec.national}: ${AMBITIONS[ambition].goal}`, intervention: `${INSTRUMENT_KINDS[instrument].label} in ${spec.label.toLowerCase()}`,
    cost: quote.cost, madeWeek: week, madeDate: date, dueWeek: week + due, baseline: areaIndicator(society, area, region), status: 'non-avviata', progress: 0, impediments: [], history: [{ week, date, text: 'Promessa fatta.' }],
    modified: 0, announced: [], campaignId, sourceRef: source, priority: ['alta', 'media', 'bassa'].includes(priority) ? priority : 'media', backedBy: [], source: 'simulation'
  };
  const quality = credibility({ promises: [...(game?.promises ?? []), item] }, { society, reputation });
  item.credibility = quality.score;
  return { promise: item, credibility: quality };
}

// Changing a promise: more time (once, with a price), a smaller ambition, another instrument. The old one is closed as «modificata» and the new one carries on its history: nobody can
// quietly rewrite what was said (the press and the opposition remember the change).
export function modifyPromise(game, id, changes, { week, date, society = null, reputation = 50, allied = false } = {}) {
  const old = promisesOf(game).find(item => item.id === id);
  if (!old || !open(old)) throw new Error('Questa promessa non si può più modificare.');
  const ambition = changes.ambition ?? old.ambition, instrument = changes.instrument ?? old.instrument;
  const quote = promiseQuote({ area: old.area, instrument, ambition });
  const extra = clamp(Math.round(changes.extraWeeks ?? 0), 0, 52);
  if (ambition === old.ambition && instrument === old.instrument && !extra) throw new Error('Nessun cambiamento da registrare.');
  const reason = revisionReason(changes.reason, old, { game, society, allied });
  const next = { ...old, id: `${old.id}~${old.modified + 1}`, instrument, ambition, cost: quote.cost, intervention: `${INSTRUMENT_KINDS[instrument].label} in ${old.label.toLowerCase()}`, objective: `${AREA_BY_ID[old.area].national}: ${AMBITIONS[ambition].goal}`,
    dueWeek: old.dueWeek + extra, modified: old.modified + 1, status: old.progress > 0 ? 'in-corso' : 'non-avviata', settledWeek: null, outcome: null,
    history: [...old.history, { week, date, text: `Modificata. Motivo: ${REVISION_REASONS[reason.id].label.toLowerCase()}${reason.valid ? '' : reason.id === 'nessuno' ? '' : ' (i fatti non lo confermano)'}.` }, ...(extra ? [{ week, date, text: `Tempo in più: ${extra} settimane.` }] : []), ...(ambition !== old.ambition ? [{ week, date, text: `Ambizione cambiata: ${AMBITIONS[ambition].label.toLowerCase()}.` }] : []), ...(instrument !== old.instrument ? [{ week, date, text: `Strumento cambiato: ${INSTRUMENT_KINDS[instrument].label.toLowerCase()}.` }] : [])] };
  const closed = { ...old, status: 'modificata', settledWeek: week, outcome: 'modificata', history: [...old.history, { week, date, text: 'Sostituita da una versione modificata.' }] };
  // a change costs credibility: the harder the retreat, the heavier (a downgrade or a long delay is noticed; a better instrument for the same goal is not)
  const retreat = (AMBITIONS[old.ambition].cost - AMBITIONS[ambition].cost) * 2 + extra / 26;
  return { closed, next, reason, effects: { reputation: -Math.round(clamp((0.6 + retreat * 1.4) * (reason.valid ? 0.6 : reason.id === 'nessuno' ? 1.25 : 1), 0.3, 5) * 10) / 10 }, credibility: credibility({ promises: [...(game.promises ?? []).filter(item => item.id !== old.id), closed, next] }, { society, reputation }) };
}

// Does the reason given for a revision hold? Checked against the game: the room of the budget, the accord of the player, the mood of the country, the indicator of the area since the promise was made.
export function revisionReason(id, promise, { game = null, society = null, allied = false } = {}) {
  const key = REVISION_REASONS[id] ? id : 'nessuno';
  let valid = false;
  if (key === 'risorse') valid = fiscalRoom(society) < (credibility(game ?? { promises: [] }, { society }).cost || promise?.cost || 0);
  else if (key === 'alleati') valid = Boolean(allied) || ['coalizione', 'governo'].includes(promise?.scope);
  else if (key === 'emergenza') valid = (society?.mood ?? 50) < 42;
  else if (key === 'scenario') { const now = areaIndicator(society, promise?.area, promise?.region); valid = promise?.baseline != null && now != null && Math.abs(now - promise.baseline) >= 2; }
  return { id: key, valid, label: REVISION_REASONS[key].label };
}

// The priority of an open promise: a record in its history, nothing else changes (the weight shows in credibility and when it is settled).
export function setPromisePriority(game, id, priority, { week, date } = {}) {
  const old = promisesOf(game).find(item => item.id === id);
  if (!old || !open(old)) throw new Error('Questa promessa non è più aperta.');
  if (!PRIORITIES[priority]) throw new Error('Scegli una priorità: alta, media o bassa.');
  if (old.priority === priority) throw new Error('Questa è già la sua priorità.');
  const live = promisesOf(game).filter(item => open(item) && item.id !== id && item.priority === 'alta').length;
  if (priority === 'alta' && live >= 2) throw new Error('Due promesse in cima bastano: se tutto è prioritario, nulla lo è.');
  return { ...old, priority, history: [...(old.history ?? []), { week, date, text: `Priorità: ${PRIORITIES[priority].label.toLowerCase()}.` }] };
}

// Negotiating a promise with an ally of the accord: the ally may back it (the cost is shared, the ally's name stands beside it) or refuse (the relation cools). The chance comes from the tie between the two
// parties and the priority; the draw is given by the caller (seeded), never taken here. One capital point is spent either way.
export function negotiatePromise(game, id, { ally, tie = 0, roll }, { week, date } = {}) {
  const old = promisesOf(game).find(item => item.id === id);
  if (!old || !open(old)) throw new Error('Questa promessa non è più aperta.');
  if (!ally?.id) throw new Error('Scegli con quale alleato trattare.');
  if ((old.backedBy ?? []).some(item => item.id === ally.id)) throw new Error('Questo alleato la sostiene già.');
  if ((old.backedBy ?? []).length >= 2) throw new Error('Due alleati a sostenerla bastano.');
  const chance = clamp(0.3 + tie / 160 + (old.priority === 'alta' ? 0.05 : 0), 0.1, 0.85);
  const ok = roll < chance;
  const backed = ok ? [...(old.backedBy ?? []), { id: ally.id, label: ally.label, week }] : (old.backedBy ?? []);
  const promise = { ...old, backedBy: backed, cost: ok ? round1(old.cost * 0.85) : old.cost, history: [...(old.history ?? []), { week, date, text: ok ? `${ally.label} sostiene la promessa: il costo si divide.` : `${ally.label} rifiuta di sostenerla: la trattativa non ha esito.` }] };
  return { promise, ok, chance: Math.round(chance * 100) / 100, effects: { capital: -1, tie: ok ? 2 : -3 } };
}

// Withdrawing a promise in the open is a failure that is admitted: it costs less than being found out, but it counts as not kept.
export function withdrawPromise(game, id, { week, date } = {}) {
  const old = promisesOf(game).find(item => item.id === id);
  if (!old || !open(old)) throw new Error('Questa promessa non è più aperta.');
  const prior = promisesOf(game).filter(item => item.status === 'non-mantenuta').length;
  return { promise: { ...old, status: 'non-mantenuta', settledWeek: week, outcome: 'ritirata', history: [...old.history, { week, date, text: 'Ritirata pubblicamente.' }] }, effects: settleEffects(old, 'non-mantenuta', prior, { admitted: true }) };
}

// ---------- the weekly check against what the game did ----------
const bestBill = (parliament, promise) => {
  const laws = [...(parliament?.laws ?? []), ...(parliament?.lawArchive ?? [])].filter(law => (law.policy?.area ?? law.area) === promise.area && (law.introducedAt ?? '') >= (promise.madeDate ?? '') && !['rejected', 'lapsed'].includes(law.stage));
  return laws.map(law => ({ law, value: LAW_PROGRESS[law.stage] ?? 0 })).sort((a, b) => b.value - a.value)[0] ?? null;
};
const stuckBill = (parliament, promise) => (parliament?.laws ?? []).find(law => (law.policy?.area ?? law.area) === promise.area && (law.introducedAt ?? '') >= (promise.madeDate ?? '') && ['rejected', 'lapsed'].includes(law.stage)) ?? null;

export function evaluatePromise(promise, { week, date, society = null, parliament = null, inMajority = false, instability = false }) {
  const applied = (society?.lawsApplied ?? []).filter(item => item.area === promise.area && (item.week ?? 0) >= promise.madeWeek);
  const bill = bestBill(parliament, promise);
  const progress = applied.length ? 100 : Math.min(90, bill?.value ?? 0);
  const now = areaIndicator(society, promise.area, promise.region);
  const improved = promise.baseline === null || now === null ? true : now >= promise.baseline + PROMISE_RULES.improvement * (AMBITIONS[promise.ambition]?.lasting ?? 1);
  const impediments = [];
  const elapsed = week - promise.madeWeek, span = Math.max(1, promise.dueWeek - promise.madeWeek);
  if (!bill && !applied.length && elapsed > span / 3) impediments.push('Nessun provvedimento presentato: la promessa non è diventata un testo.');
  if (stuckBill(parliament, promise) && !applied.length) impediments.push('Un provvedimento sul tema è stato respinto o è decaduto.');
  if (bill && ['commission'].includes(bill.law.stage) && elapsed > span / 2) impediments.push('Il provvedimento è fermo in commissione.');
  if (instability) impediments.push('Il Governo è instabile: la maggioranza fatica a votare.');
  if (!inMajority && ['governo', 'coalizione'].includes(promise.scope)) impediments.push('Non guidi la maggioranza: da sola non puoi trasformarla in legge.');
  if (fiscalRoom(society) < promise.cost) impediments.push('Il bilancio non lascia margine per questa spesa.');
  const evidence = applied[0] ? `«${applied[0].title}» è in vigore.` : bill ? `Provvedimento «${bill.law.title}» in corso: fase ${bill.law.stage}.` : 'Nessun atto collegato.';
  let status = promise.status, outcome = null;
  if (applied.length && improved) { status = 'mantenuta'; outcome = 'mantenuta'; }
  else if (applied.length && week >= promise.dueWeek) { status = 'parzialmente-mantenuta'; outcome = 'misura in vigore, obiettivo non raggiunto'; }
  else if (week < promise.dueWeek) status = progress > 0 ? 'in-corso' : 'non-avviata';
  else if (week < promise.dueWeek + PROMISE_RULES.grace) status = 'ritardata';
  else if (progress >= 60) { status = 'parzialmente-mantenuta'; outcome = 'provvedimento avanzato ma non concluso'; }
  else { status = 'non-mantenuta'; outcome = 'scaduta senza un provvedimento'; }
  return { status, progress, impediments, evidence, outcome, indicator: now };
}

// Effects of a promise settled, applied once by the store: reputation, popularity, the party, the allies, the voters of the area and the memory/news lines.
export function settleEffects(promise, status, brokenBefore = 0, { admitted = false } = {}) {
  const scope = (PROMISE_SCOPES[promise.scope]?.weight ?? 1) * priorityWeight(promise);
  const ambition = promise.ambition === 'ambiziosa' ? 1.2 : 1;
  const label = promise.label.toLowerCase();
  if (status === 'mantenuta') return { reputation: round1(2 * scope * ambition), popularity: round1(1.1 * scope), attention: 3, partner: ['coalizione', 'governo'].includes(promise.scope) ? 3 : 0, party: promise.scope === 'partito' ? 1 : 0, memory: { kind: 'promessa-mantenuta', weight: 1.1, text: `Promessa mantenuta su ${label}: ${promise.intervention}.` }, tone: 'good', headline: `Promessa mantenuta su ${label}` };
  if (status === 'parzialmente-mantenuta') return { reputation: round1(0.6 * scope), popularity: round1(0.3 * scope), attention: 1, partner: 0, party: 0, memory: { kind: 'promessa-mantenuta', weight: 0.6, text: `Promessa su ${label} mantenuta solo in parte.` }, tone: 'good', headline: `Promessa su ${label} mantenuta solo in parte` };
  const heavy = admitted ? 0.6 : 1;
  return { reputation: -round1((2.5 + brokenBefore * 0.5) * scope * heavy), popularity: -round1(1.2 * scope * heavy), attention: -4, partner: ['coalizione', 'governo'].includes(promise.scope) ? -4 : 0, party: promise.scope === 'partito' ? -2 : 0, memory: { kind: 'promessa-tradita', weight: 1.5 * heavy, text: `Promessa non mantenuta su ${label}: ${promise.intervention}.` }, tone: 'bad', headline: admitted ? `Promessa su ${label} ritirata` : `Promessa non mantenuta su ${label}`, press: !admitted };
}

// One pass over the open promises of the player. Returns the updated list, what to tell, and the effects of the ones settled in this pass.
export function tickPromises(game, ctx) {
  const list = game?.promises ?? [];
  const updated = [], notes = [], settled = [];
  let brokenSoFar = list.filter(item => item.kind === 'programma' && item.status === 'non-mantenuta').length;
  for (const promise of list) {
    if (promise.kind !== 'programma' || !open(promise)) { updated.push(promise); continue; }
    const result = evaluatePromise(promise, ctx);
    let next = { ...promise, progress: result.progress, impediments: result.impediments, evidence: result.evidence };
    if (result.status !== promise.status) {
      next.status = result.status;
      next.history = [...(promise.history ?? []), { week: ctx.week, date: ctx.date, text: `Stato: ${PROMISE_STATES[result.status].label.toLowerCase()}.` }, ...(result.outcome ? [{ week: ctx.week, date: ctx.date, text: `Esito: ${result.outcome}.` }] : [])].slice(-12);
      if (PROMISE_SETTLED.includes(result.status)) {
        next.settledWeek = ctx.week; next.outcome = result.outcome;
        const effects = settleEffects(next, result.status, brokenSoFar);
        if (result.status === 'non-mantenuta') brokenSoFar++;
        settled.push({ promise: next, effects });
      } else if (result.status === 'ritardata') notes.push({ kind: 'ritardo', promise: next, text: `La promessa su ${next.label.toLowerCase()} è in ritardo: l’opposizione e i giornali lo fanno notare.` });
    }
    updated.push(next);
  }
  return { promises: updated, notes, settled };
}

// ---------- the programme of the Government and of the rivals ----------
// The priorities a Government led by the player should have: the promises of scope governo/coalizione first, then the programme of the party, then the areas the accord asks. Never more
// than five, never an unknown area (policy-rules).
export function derivePriorities(game, parliament = null, max = 5, proposals = []) {
  const out = [];
  const add = id => { if (AREA_BY_ID[id] && !out.includes(id)) out.push(id); };
  promisesOf(game).filter(item => open(item) && ['governo', 'coalizione'].includes(item.scope)).forEach(item => add(item.area));
  [...proposals].filter(item => item.status === 'pubblicata').sort((a, b) => a.priority - b.priority).forEach(item => add(item.area));
  (game?.party?.program?.areas ?? []).forEach(add);
  promisesOf(game).filter(open).forEach(item => add(item.area));
  for (const item of parliament?.government?.accord?.commitments ?? []) if (item.kind === 'misura') add(item.area);
  return out.slice(0, max);
}
// The commitments of the accord, shown beside the promises (read only: the accord keeps its own verdict).
export function accordPromises(parliament) {
  const accord = parliament?.government?.accord;
  if (!accord) return [];
  return (accord.commitments ?? []).filter(item => item.kind === 'misura').map(item => ({ id: `accordo:${item.id}`, kind: 'accordo', scope: 'coalizione', area: item.area, label: AREA_BY_ID[item.area]?.label ?? item.area, objective: item.label ?? 'Misura concordata in coalizione', status: item.status === 'mantenuto' ? 'mantenuta' : item.status === 'tradito' || item.status === 'scaduto' ? 'non-mantenuta' : item.status === 'in-corso' ? 'in-corso' : 'non-avviata', groupId: item.groupId, rawStatus: item.status }));
}
// The programme of a rival: the agenda of its force in the political world (the areas its party stands for), the same data the polls read.
export function rivalProgram(world, partyId, max = 3) {
  const party = world?.parties?.find(item => item.id === partyId);
  return (party?.agenda ?? []).filter(id => AREA_BY_ID[id]).slice(0, max);
}
// A line to say in the campaign for an area: the problem, the intervention, the goal (used by announcements and by the TV debate).
export const promiseLine = promise => `${AREA_BY_ID[promise.area]?.label ?? promise.area}: ${promise.intervention}. Obiettivo: ${promise.objective}. Costo stimato ${promise.cost} miliardi, entro ${promise.dueWeek - promise.madeWeek} settimane.`;
export const AREAS = POLICY_AREAS;
