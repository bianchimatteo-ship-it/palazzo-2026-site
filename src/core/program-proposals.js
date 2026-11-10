// The programme as a structured document the player edits (the proposals), distinct from the promises (program-engine.js): a proposal is what the player WRITES — the problem, the objective, the measures,
// the cost and how it is paid, the deadline, the territory — and may or may not become a promise. A promise is a public commitment the game verifies; a proposal is a page of the programme. They are
// linked only when a real relation exists (same area, a promise made by the player): a proposal never creates a promise by itself, and a promise is never counted twice.
//
// What a proposal does in the game, all deterministic and read from the situation: a published proposal whose cost is covered (by the budget room, by savings, by European funds, by revenue) makes the
// programme more credible, one that is not covered makes it less; its area enters the rally and the debate (the player can present it, the opponents attack it where it is not covered); and it
// comes first in the priorities suggested for the Government. A draft does nothing: it is only a draft. Plain data, additive to the save (`game.proposals`, absent in older saves = none).
import { AREA_BY_ID, INSTRUMENT_KINDS } from '../data/simulation/policy-rules.js?v=20261110-24';
import { fiscalRoom, promisesOf, promiseQuote } from './program-engine.js?v=20261110-24';

export const PROPOSAL_LIMIT = 12;
export const PROPOSAL_STATES = Object.freeze({ bozza: 'Bozza', pubblicata: 'Pubblicata' });
export const FINANCING = Object.freeze({
  bilancio: { label: 'Margine di bilancio', detail: 'Si paga con lo spazio che il bilancio lascia: vale fino al margine disponibile.', covers: 1 },
  risparmi: { label: 'Risparmi su altre spese', detail: 'Tagli altrove: coprono, ma toccano altri servizi.', covers: 0.85 },
  tasse: { label: 'Nuove entrate fiscali', detail: 'Più tasse o lotta all’evasione: copre, ma ha un costo politico.', covers: 0.9 },
  europa: { label: 'Fondi europei', detail: 'Programmi dell’Unione: coprono in parte e dipendono dalle trattative.', covers: 0.6 },
  debito: { label: 'Nuovo debito', detail: 'Non copre davvero: i mercati e gli avversari se ne accorgono.', covers: 0.2 }
});
export const TERRITORIES = Object.freeze({ nazionale: 'Tutto il Paese', regionale: 'Una regione', locale: 'Un comune' });
export const DEADLINES = Object.freeze({ 13: 'Entro tre mesi', 26: 'Entro sei mesi', 52: 'Entro un anno', 104: 'Entro due anni', 156: 'Entro tre anni', 208: 'Entro quattro anni', 260: 'Entro cinque anni (una legislatura)' });
// The cost bands of the editor (billions of euro): a band only fills the cost; the value stored is the number, as before. «Stima automatica» leaves it empty and the engine estimates it from the area and the first measure.
export const COST_BANDS = Object.freeze([[0.3, 'Molto piccolo: circa 0,3 miliardi'], [1, 'Piccolo: circa 1 miliardo'], [3, 'Medio: circa 3 miliardi'], [8, 'Grande: circa 8 miliardi'], [18, 'Molto grande: circa 18 miliardi'], [35, 'Eccezionale: circa 35 miliardi']]);

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const round1 = value => Math.round(value * 10) / 10;
const text = (value, max) => String(value ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
export const proposalsOf = game => Array.isArray(game?.proposals) ? game.proposals : [];

function normalise(input, previous = null) {
  const area = AREA_BY_ID[input.area ?? previous?.area] ? (input.area ?? previous.area) : null;
  if (!area) throw new Error('Scegli l’area politica della proposta.');
  const spec = AREA_BY_ID[area];
  const title = text(input.title ?? previous?.title ?? '', 80) || `Proposta su ${spec.label.toLowerCase()}`;
  const measures = (input.measures ?? previous?.measures ?? []).map(item => ({ instrument: INSTRUMENT_KINDS[item?.instrument] ? item.instrument : 'investimento', text: text(item?.text, 160) })).filter(item => item.text).slice(0, 4);
  if (!measures.length) throw new Error('Indica almeno una misura concreta.');
  const quote = promiseQuote({ area, instrument: measures[0].instrument, ambition: 'media' });
  const cost = Number.isFinite(Number(input.cost)) && input.cost !== '' && input.cost !== null ? round1(clamp(Number(input.cost), 0, 60)) : (previous?.cost ?? quote?.cost ?? 1);
  const territory = TERRITORIES[input.territory ?? previous?.territory] ? (input.territory ?? previous.territory) : 'nazionale';
  const deadline = DEADLINES[Number(input.deadlineWeeks ?? previous?.deadlineWeeks)] ? Number(input.deadlineWeeks ?? previous.deadlineWeeks) : 104;
  return {
    area, title, problem: text(input.problem ?? previous?.problem ?? spec.problem ?? '', 240), objective: text(input.objective ?? previous?.objective ?? '', 200) || spec.national,
    measures, cost, financing: FINANCING[input.financing ?? previous?.financing] ? (input.financing ?? previous.financing) : 'bilancio', deadlineWeeks: deadline,
    territory, region: territory === 'nazionale' ? null : (text(input.region ?? previous?.region ?? '', 40) || null),
    // the place of a local proposal (a real comune chosen from the data, or written by the player): absent in older proposals = none
    municipality: territory === 'locale' ? (text(input.municipality ?? previous?.municipality ?? '', 60) || null) : null
  };
}

export function createProposal(game, input, { week = 0, date = null } = {}) {
  const list = proposalsOf(game);
  if (list.length >= PROPOSAL_LIMIT) throw new Error(`Un programma leggibile ha al massimo ${PROPOSAL_LIMIT} proposte: elimina o unisci quelle meno importanti.`);
  const made = normalise(input);
  const id = `prop-${week}-${made.area}-${list.length + 1}-${(list.reduce((n, item) => Math.max(n, Number(String(item.id).split('-').at(-1)) || 0), 0)) + 1}`;
  return { ...made, id, status: 'bozza', priority: list.length + 1, linkedPromiseId: null, createdWeek: week, createdOn: date, history: [{ week, text: 'Proposta scritta' }] };
}
export function updateProposal(game, id, input, { week = 0 } = {}) {
  const previous = proposalsOf(game).find(item => item.id === id);
  if (!previous) throw new Error('Proposta non trovata.');
  const changed = normalise(input, previous);
  // a linked promise keeps its own text: changing the proposal's area breaks the link (it was a real relation only in the same area)
  const keepLink = previous.linkedPromiseId && changed.area === previous.area;
  return { ...previous, ...changed, linkedPromiseId: keepLink ? previous.linkedPromiseId : null, history: [...(previous.history ?? []), { week, text: 'Proposta modificata' }].slice(-8) };
}
export const setProposalState = (game, id, status, { week = 0 } = {}) => {
  const previous = proposalsOf(game).find(item => item.id === id);
  if (!previous || !PROPOSAL_STATES[status]) throw new Error('Proposta non trovata.');
  return { ...previous, status, history: [...(previous.history ?? []), { week, text: status === 'pubblicata' ? 'Pubblicata nel programma' : 'Riportata in bozza' }].slice(-8) };
};
// Reordering: the priority is the order in the list (1 = most important); a move of one place up or down, never outside.
export function moveProposals(game, id, delta) {
  const list = [...proposalsOf(game)].sort((a, b) => a.priority - b.priority);
  const index = list.findIndex(item => item.id === id), target = index + delta;
  if (index < 0 || target < 0 || target >= list.length) return list.map((item, i) => ({ ...item, priority: i + 1 }));
  [list[index], list[target]] = [list[target], list[index]];
  return list.map((item, i) => ({ ...item, priority: i + 1 }));
}
export const removeProposals = (game, id) => proposalsOf(game).filter(item => item.id !== id).sort((a, b) => a.priority - b.priority).map((item, i) => ({ ...item, priority: i + 1 }));
// A proposal is linked to a promise only if the promise exists, is the player's own (kind programma), is in the same area and is not already linked to another proposal.
export function linkableTo(game, proposal) {
  const taken = new Set(proposalsOf(game).filter(item => item.id !== proposal.id && item.linkedPromiseId).map(item => item.linkedPromiseId));
  return promisesOf(game).filter(item => item.area === proposal.area && !taken.has(item.id) && !['non-mantenuta', 'modificata'].includes(item.status));
}
export function linkProposal(game, id, promiseId) {
  const proposal = proposalsOf(game).find(item => item.id === id);
  if (!proposal) throw new Error('Proposta non trovata.');
  if (!promiseId) return { ...proposal, linkedPromiseId: null };
  if (!linkableTo(game, proposal).some(item => item.id === promiseId)) throw new Error('Una proposta si collega solo a una tua promessa nella stessa area, non già collegata ad altro.');
  return { ...proposal, linkedPromiseId: promiseId };
}

// How well the proposal is covered, from what the game knows: the cost against the room of the budget (shared with the other published proposals and the open promises) and the way it is paid.
export function assessProposal(game, proposal, { society = null } = {}) {
  const room = fiscalRoom(society);
  const financing = FINANCING[proposal.financing] ?? FINANCING.bilancio;
  const others = proposalsOf(game).filter(item => item.status === 'pubblicata' && item.id !== proposal.id && item.financing === 'bilancio').reduce((sum, item) => sum + item.cost, 0);
  const promisesCost = promisesOf(game).filter(item => !['mantenuta', 'parzialmente-mantenuta', 'non-mantenuta', 'modificata'].includes(item.status) && !proposalsOf(game).some(p => p.linkedPromiseId === item.id)).reduce((sum, item) => sum + (item.cost ?? 0), 0);
  const available = proposal.financing === 'bilancio' ? Math.max(0, room - others - promisesCost) : Infinity;
  const covered = proposal.financing === 'bilancio' ? Math.min(1, available / Math.max(0.1, proposal.cost)) : financing.covers;
  const notes = [];
  let level = covered >= 0.85 ? 'solida' : covered >= 0.5 ? 'fragile' : 'scoperta';
  if (proposal.financing === 'bilancio' && covered < 1) notes.push(`Costa ${round1(proposal.cost)} miliardi: il margine di bilancio libero è ${round1(available)}.`);
  if (proposal.financing === 'debito') notes.push('È finanziata con nuovo debito: non è una vera copertura.');
  if (proposal.financing === 'europa') notes.push('Dipende dai fondi europei: serve una trattativa riuscita.');
  if (proposal.financing === 'tasse') notes.push('Richiede nuove entrate: ha un costo politico.');
  if (proposal.deadlineWeeks <= 26 && proposal.cost > room / 2) { notes.push('Scadenza molto ravvicinata per un costo così alto.'); if (level === 'solida') level = 'fragile'; }
  if (!notes.length) notes.push('Costo coperto e scadenza realistica.');
  return { level, covered: round1(covered), room, notes };
}

// The effect of the published proposals on the credibility of the programme (program-engine.js adds it): +1.5 for a solid one, +0 for a fragile one, -3 for one that is not covered; never more than
// +6 or less than -9 in all. Drafts count nothing.
export function proposalCredibility(game, { society = null } = {}) {
  let delta = 0; const notes = [];
  for (const proposal of proposalsOf(game).filter(item => item.status === 'pubblicata')) {
    const { level } = assessProposal(game, proposal, { society });
    if (level === 'solida') delta += 1.5; else if (level === 'scoperta') { delta -= 3; notes.push(`La proposta «${proposal.title}» non ha copertura: gli avversari lo faranno notare.`); }
  }
  return { delta: clamp(round1(delta), -9, 6), notes };
}
// What the rally and the debate read: the areas of the published proposals, and the first one that is not covered (the rivals attack it).
export function proposalContext(game, { society = null } = {}) {
  const published = proposalsOf(game).filter(item => item.status === 'pubblicata').sort((a, b) => a.priority - b.priority);
  const weak = published.find(item => assessProposal(game, item, { society }).level === 'scoperta') ?? null;
  return { areas: published.map(item => item.area), titles: published.map(item => item.title), weak: weak ? { id: weak.id, title: weak.title, area: weak.area } : null };
}
// The programme as the voters see it: what is published, in order of priority, grouped for reading. Drafts are not shown (the preview says how many are left out).
export function programPreview(game, { society = null, party = '', player = '' } = {}) {
  const published = proposalsOf(game).filter(item => item.status === 'pubblicata').sort((a, b) => a.priority - b.priority);
  const drafts = proposalsOf(game).filter(item => item.status === 'bozza').length;
  return {
    party, player, drafts, total: round1(published.reduce((sum, item) => sum + item.cost, 0)),
    items: published.map(item => ({ id: item.id, priority: item.priority, area: AREA_BY_ID[item.area]?.label ?? item.area, title: item.title, problem: item.problem, objective: item.objective, measures: item.measures.map(measure => ({ instrument: INSTRUMENT_KINDS[measure.instrument]?.label ?? measure.instrument, text: measure.text })), cost: item.cost, financing: FINANCING[item.financing]?.label ?? item.financing, deadline: DEADLINES[item.deadlineWeeks] ?? '', territory: item.territory === 'nazionale' ? TERRITORIES.nazionale : ([item.municipality, item.region].filter(Boolean).join(', ') || TERRITORIES[item.territory]), coverage: assessProposal(game, item, { society }).level }))
  };
}
