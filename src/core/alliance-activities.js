// Concrete activities with the allies of the player's alliance or coalition: a meeting of the leaders, a programme table, a territorial initiative, a press conference, a mobilisation. Each one has a
// cost (days, political capital, funds), a duration, and an outcome that depends on how the allies are doing (cohesion, the relation with the partners, how well the programmes fit): it succeeds, it
// half-succeeds or it fails, and what it leaves is told once — on the cohesion of the alliance, on the relations with the partners and on the player's standing. Pure and deterministic.
import { seededRandom } from './vote-engine.js?v=20261118-18';

export const ALLY_ACTIVITIES = Object.freeze({
  riunione: { id: 'riunione', label: 'Riunione dei leader', hint: 'Un incontro riservato tra i leader per ricucire e coordinarsi.', cost: { days: 1, capital: 1, funds: 0 }, weeks: 1, base: 0.72, target: 'partner', win: { cohesion: 4, relation: 4 }, lose: { cohesion: -3, relation: -3 } },
  tavolo: { id: 'tavolo', label: 'Tavolo sul programma', hint: 'Si lavora insieme sui temi che dividono: se va bene la coesione sale, se va male le distanze emergono.', cost: { days: 2, capital: 2, funds: 0 }, weeks: 2, base: 0.58, target: 'partner', win: { cohesion: 6, relation: 4 }, lose: { cohesion: -5, relation: -3 }, needsPrograms: true },
  territorio: { id: 'territorio', label: 'Iniziativa sul territorio', hint: 'Un’iniziativa comune in una città: porta visibilità e unisce i militanti.', cost: { days: 2, capital: 0, funds: 800 }, weeks: 3, base: 0.66, target: 'all', win: { cohesion: 3, relation: 2, popularity: 0.6, notoriety: 0.8 }, lose: { cohesion: -2, relation: -1, popularity: -0.2 } },
  conferenza: { id: 'conferenza', label: 'Conferenza stampa comune', hint: 'Presentarsi insieme davanti alla stampa: se un alleato stona, si vede.', cost: { days: 1, capital: 0, funds: 200 }, weeks: 1, base: 0.64, target: 'all', win: { cohesion: 2, relation: 1, notoriety: 1.2, reputation: 0.4 }, lose: { cohesion: -4, relation: -2, reputation: -0.6 } },
  mobilitazione: { id: 'mobilitazione', label: 'Mobilitazione comune', hint: 'Una piazza, un presidio, una campagna con tutti gli alleati: costa, ma sposta consenso.', cost: { days: 3, capital: 1, funds: 1500 }, weeks: 4, base: 0.55, target: 'all', win: { cohesion: 4, relation: 3, popularity: 1.2, notoriety: 1.5, reputation: 0.6 }, lose: { cohesion: -4, relation: -3, popularity: -0.5, reputation: -0.8 } }
});
export const MAX_OPEN = 2;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const round1 = value => Math.round(value * 10) / 10;
export const isOpenActivity = item => item?.status === 'in-corso';

// What the odds depend on: cohesion of the alliance (0..100), the relation with the partner(s) (−100..100) and the compatibility of the programmes (0..1).
export function oddsOf(kindId, { cohesion = 60, relation = 0, compatibility = 0.5 } = {}) {
  const kind = ALLY_ACTIVITIES[kindId];
  if (!kind) return null;
  const parts = [
    { label: 'Base dell’attività', value: kind.base - 0.5 },
    { label: 'Coesione dell’alleanza', value: (cohesion - 60) / 200 },
    { label: 'Rapporti con gli alleati', value: relation / 400 },
    ...(kind.needsPrograms ? [{ label: 'Compatibilità dei programmi', value: (compatibility - 0.5) * 0.4 }] : [])
  ];
  const chance = clamp(0.5 + parts.reduce((sum, part) => sum + part.value, 0), 0.1, 0.92);
  return { chance: Math.round(chance * 100) / 100, parts: parts.map(part => ({ ...part, value: round1(part.value * 100) })) };
}
export function startActivity(list, { kindId, allianceId, partnerId = null, date, week, id = null }) {
  const kind = ALLY_ACTIVITIES[kindId];
  if (!kind) throw new Error('Attività non valida.');
  if (!allianceId) throw new Error('Serve un’alleanza o una coalizione attiva.');
  if (kind.target === 'partner' && !partnerId) throw new Error('Scegli con quale alleato.');
  const open = list.filter(item => isOpenActivity(item) && item.allianceId === allianceId);
  if (open.length >= MAX_OPEN) throw new Error('Hai già due attività in corso con gli alleati: aspetta che finiscano.');
  if (open.some(item => item.kind === kindId && item.partnerId === partnerId)) throw new Error('Questa attività è già in corso.');
  return { id: id ?? `attivita-${week}-${list.length + 1}`, kind: kindId, label: kind.label, allianceId, partnerId, startedAt: date, startWeek: week, endsWeek: week + kind.weeks, status: 'in-corso', cost: kind.cost };
}
// The end of an activity: a draw by its own id decides success, half-success or failure, by the odds. Returns { activity, effects: { cohesion, relation, popularity, notoriety, reputation }, text, tone }.
export function resolveActivity(input, ctx) {
  if (!isOpenActivity(input) || ctx.week < input.endsWeek) return null;
  const kind = ALLY_ACTIVITIES[input.kind];
  const odds = oddsOf(input.kind, ctx);
  const roll = seededRandom(`${input.id}|${input.endsWeek}|attivita`)();
  const result = roll < odds.chance * 0.7 ? 'riuscita' : roll < odds.chance ? 'parziale' : 'fallita';
  const scale = result === 'riuscita' ? 1 : result === 'parziale' ? 0.45 : 1;
  const table = result === 'fallita' ? kind.lose : kind.win;
  const effects = Object.fromEntries(Object.entries(table).map(([key, value]) => [key, round1(value * scale)]));
  const who = ctx.partnerLabel ? `con ${ctx.partnerLabel}` : 'con gli alleati';
  const text = result === 'riuscita' ? `${kind.label} ${who}: è andata bene, l’alleanza ne esce più unita.` : result === 'parziale' ? `${kind.label} ${who}: risultato a metà, qualche passo avanti ma poco più.` : `${kind.label} ${who}: è andata male, tensioni e nessun risultato.`;
  return { activity: { ...input, status: result, closedAt: ctx.date, text, effects }, effects, text, tone: result === 'fallita' ? 'bad' : result === 'riuscita' ? 'good' : 'neutral', odds: odds.chance };
}
