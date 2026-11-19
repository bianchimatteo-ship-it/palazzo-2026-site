// The desk of a minister (the player when he holds a ministry): the department with its areas, the problems that the indicators show, a priority; the proposals he prepares, sounds out with his
// colleagues and submits to the Council of Ministers, where each minister and the Prime Minister vote; what the Prime Minister asks him (reports, plans) with a deadline; the crises of his sector.
// He acts only in the areas of his department: a proposal outside it is refused and says who is competent. Pure and deterministic (choices are hashes of the keys, never the game's random sequence).
import { AREA_BY_ID, areasOfPortfolio } from '../data/simulation/policy-rules.js?v=20261119-10';
import { seededRandom } from './vote-engine.js?v=20261119-10';

export const MINISTRY_RULES = Object.freeze({ maxProposals: 3, prepWeeks: 2, sessionEvery: 4, assignmentEvery: 8, assignmentWeeks: 3, crisisBelow: 38, crisisWeeks: 4, lobbyBoost: 0.22 });
export const FINANCING = Object.freeze({ evasione: 'lotta all’evasione', deficit: 'deficit', tagli: 'tagli di spesa', ue: 'fondi europei' });
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const addWeeks = (date, weeks) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + weeks * 7); return d.toISOString().slice(0, 10); };
const note = (ministry, date, text) => ({ ...ministry, history: [{ date, text }, ...(ministry.history ?? [])].slice(0, 30) });

export const newMinistry = (portfolio, date) => ({ portfolio, since: date, priority: null, proposals: [], assignments: [], crises: [], pmRelation: 55, standing: 50, history: [{ date, text: `Giuri come ministro: ${portfolio}.` }], sessions: [], lastSession: date, lastAssignment: date });
export const areasOfMinistry = ministry => areasOfPortfolio(ministry?.portfolio ?? '');
const competenceError = (ministry, area) => {
  const spec = AREA_BY_ID[area];
  if (!spec) return 'Scegli un’area valida.';
  return areasOfMinistry(ministry).includes(area) ? null : spec.portfolio ? `Il tuo ministero non ha competenza su «${spec.label}»: se ne occupa il ministero ${spec.portfolio}. Puoi proporlo al collega competente o al Presidente del Consiglio, non farlo tuo.` : `Il tuo ministero non ha competenza su «${spec.label}». Puoi proporlo al collega competente o al Presidente del Consiglio, non farlo tuo.`;
};

// ---------- priority ----------
export function setPriority(input, area, date) {
  const ministry = JSON.parse(JSON.stringify(input));
  const error = competenceError(ministry, area); if (error) throw new Error(error);
  if (ministry.priority === area) throw new Error('È già la priorità del tuo ministero.');
  ministry.priority = area; ministry.pmRelation = clamp(ministry.pmRelation + 1, 0, 100);
  return note(ministry, date, `Priorità del ministero: ${AREA_BY_ID[area].label}.`);
}

// ---------- the proposals ----------
// A proposal is a measure of the department written by the staff (two weeks), sounded out with the colleagues, and submitted to the Council of Ministers.
export function prepareProposal(input, { area, instrument, financing = 'deficit', intensity = 1 }, { week, date }) {
  const ministry = JSON.parse(JSON.stringify(input));
  const error = competenceError(ministry, area); if (error) throw new Error(error);
  const spec = AREA_BY_ID[area];
  if (!Object.keys(spec.instruments ?? {}).includes(instrument)) throw new Error('Scegli uno strumento tra quelli dell’area.');
  if (!FINANCING[financing]) throw new Error('Scegli come finanziarla.');
  if (financing === 'ue' && !spec.euFunds) throw new Error('Per quest’area non ci sono fondi europei a cui attingere.');
  if (ministry.proposals.filter(item => ['in-preparazione', 'pronta', 'in-agenda'].includes(item.status)).length >= MINISTRY_RULES.maxProposals) throw new Error(`Hai già ${MINISTRY_RULES.maxProposals} proposte aperte: portane una in Consiglio o ritirala.`);
  if (ministry.proposals.some(item => ['in-preparazione', 'pronta', 'in-agenda'].includes(item.status) && item.area === area && item.instrument === instrument)) throw new Error('C’è già una proposta uguale in corso.');
  const proposal = { id: `proposta-${week}-${area}-${instrument}`, area, instrument, financing, intensity: intensity >= 2 ? 2 : 1, title: spec.instruments[instrument], status: 'in-preparazione', preparedAt: date, readyWeek: week + MINISTRY_RULES.prepWeeks, lobbied: [], support: 0 };
  ministry.proposals = [proposal, ...ministry.proposals].slice(0, 20);
  return note(ministry, date, `Il tuo staff prepara la proposta «${proposal.title}» (${spec.label}): pronta fra ${MINISTRY_RULES.prepWeeks} settimane.`);
}
// A talk with a colleague before the Council: he is more likely to vote for the proposal (once for each colleague).
export function lobbyColleague(input, proposalId, minister, date) {
  const ministry = JSON.parse(JSON.stringify(input));
  const proposal = ministry.proposals.find(item => item.id === proposalId);
  if (!proposal || !['pronta', 'in-preparazione', 'in-agenda'].includes(proposal.status)) throw new Error('La proposta non è più in corso.');
  if (proposal.lobbied.includes(minister.id)) throw new Error(`Hai già parlato con il ministro ${minister.portfolio} di questa proposta.`);
  proposal.lobbied.push(minister.id); proposal.support = proposal.lobbied.length;
  return note(ministry, date, `Incontro con il ministro ${minister.portfolio} sulla proposta «${proposal.title}»: ora la sostiene più volentieri.`);
}
export function submitProposal(input, proposalId, { week, date }) {
  const ministry = JSON.parse(JSON.stringify(input));
  const proposal = ministry.proposals.find(item => item.id === proposalId);
  if (!proposal) throw new Error('Proposta non trovata.');
  if (proposal.status === 'in-preparazione') throw new Error(`Lo staff non ha finito: la proposta sarà pronta alla settimana ${proposal.readyWeek}.`);
  if (proposal.status !== 'pronta') throw new Error('La proposta non può essere portata in Consiglio.');
  proposal.status = 'in-agenda'; proposal.submittedWeek = week;
  return note(ministry, date, `Porti in Consiglio dei ministri la proposta «${proposal.title}».`);
}
export function withdrawProposal(input, proposalId, date) {
  const ministry = JSON.parse(JSON.stringify(input));
  const proposal = ministry.proposals.find(item => item.id === proposalId);
  if (!proposal || !['in-preparazione', 'pronta', 'in-agenda'].includes(proposal.status)) throw new Error('La proposta non è più in corso.');
  proposal.status = 'ritirata';
  ministry.standing = clamp(ministry.standing - 1, 0, 100);
  return note(ministry, date, `Ritiri la proposta «${proposal.title}».`);
}
// The vote of the Council on the proposals in the agenda. ctx.ministers: [{ id, portfolio, bond (0-100), likes: [areas], dislikes: [areas] }]; the Prime Minister counts twice.
export function holdSession(input, { week, date, ministers = [], premier = null }) {
  let ministry = JSON.parse(JSON.stringify(input));
  const decided = [];
  for (const proposal of ministry.proposals.filter(item => item.status === 'in-agenda' && week - (item.submittedWeek ?? week) >= 1)) {
    const area = AREA_BY_ID[proposal.area];
    const votes = ministers.map(minister => {
      const rand = seededRandom(`${proposal.id}|${minister.id}|consiglio`);
      let chance = 0.5 + (ministry.pmRelation - 50) / 220 + ((minister.bond ?? 55) - 55) / 300;
      if (proposal.lobbied.includes(minister.id)) chance += MINISTRY_RULES.lobbyBoost;
      if (minister.likes?.includes(proposal.area)) chance += 0.12;
      if (minister.dislikes?.includes(proposal.area)) chance -= 0.15;
      if (proposal.financing === 'deficit') chance -= 0.04;
      return { ministerId: minister.id, portfolio: minister.portfolio, vote: rand() < clamp(chance, 0.08, 0.92) ? 'favorevole' : 'contrario', chance: Math.round(clamp(chance, 0.08, 0.92) * 100) / 100 };
    });
    const premierRand = seededRandom(`${proposal.id}|premier|consiglio`);
    const premierChance = clamp(0.5 + (ministry.pmRelation - 50) / 100 + (ministry.priority === proposal.area ? 0.1 : 0), 0.1, 0.92);
    const premierVote = { ministerId: 'presidente-del-consiglio', portfolio: 'Presidente del Consiglio', vote: premierRand() < premierChance ? 'favorevole' : 'contrario', chance: Math.round(premierChance * 100) / 100, weight: 2 };
    const all = [...votes, premierVote];
    const yes = all.reduce((sum, item) => sum + (item.vote === 'favorevole' ? (item.weight ?? 1) : 0), 0), no = all.reduce((sum, item) => sum + (item.vote === 'contrario' ? (item.weight ?? 1) : 0), 0);
    const outcome = yes > no ? 'approvata' : yes === no ? 'rinviata' : 'respinta';
    proposal.votes = all; proposal.outcome = outcome; proposal.decidedAt = date;
    if (outcome === 'rinviata') { proposal.status = 'pronta'; proposal.support += 1; }
    else proposal.status = outcome;
    ministry.pmRelation = clamp(ministry.pmRelation + (outcome === 'approvata' ? 5 : outcome === 'respinta' ? -3 : 0), 0, 100);
    ministry.standing = clamp(ministry.standing + (outcome === 'approvata' ? 4 : outcome === 'respinta' ? -2 : 0), 0, 100);
    ministry = note(ministry, date, `Consiglio dei ministri: la proposta «${proposal.title}» è ${outcome === 'approvata' ? 'approvata' : outcome === 'respinta' ? 'respinta' : 'rinviata'} (${yes} a favore, ${no} contro).`);
    decided.push({ proposal, outcome, yes, no, area });
  }
  ministry.lastSession = decided.length ? date : ministry.lastSession;
  return { ministry, decided };
}

// ---------- what the Prime Minister asks ----------
export function respondAssignment(input, assignmentId, answer, { week, date, competence = 55, rand = 0.5 }) {
  const ministry = JSON.parse(JSON.stringify(input));
  const item = ministry.assignments.find(entry => entry.id === assignmentId);
  if (!item || item.status !== 'aperto') throw new Error('L’incarico non è più aperto.');
  if (answer === 'proroga') {
    if (item.extended) throw new Error('Hai già chiesto una proroga.');
    item.extended = true; item.dueWeek += 2; ministry.pmRelation = clamp(ministry.pmRelation - 1, 0, 100);
    return { ministry: note(ministry, date, `Chiedi più tempo al Presidente del Consiglio per: ${item.title}.`), result: 'proroga' };
  }
  if (answer !== 'consegna') throw new Error('Risposta non valida.');
  const quality = clamp(0.45 + (competence - 50) / 120 + (ministry.priority === item.area ? 0.1 : 0), 0.15, 0.92);
  const good = rand < quality;
  item.status = 'consegnato'; item.closedAt = date; item.quality = good ? 'buona' : 'sufficiente';
  ministry.pmRelation = clamp(ministry.pmRelation + (good ? 6 : 2), 0, 100); ministry.standing = clamp(ministry.standing + (good ? 3 : 1), 0, 100);
  return { ministry: note(ministry, date, `Consegni al Presidente del Consiglio: ${item.title} (${good ? 'lavoro apprezzato' : 'lavoro sufficiente'}).`), result: good ? 'buona' : 'sufficiente' };
}

// ---------- the week ----------
// ctx: { week, date, indicators: { areaId: value }, ministers, premier }. Opens the work that is ready, brings the Prime Minister's requests and the crises of the sector, lets the late ones expire.
export function tickMinistry(input, { week, date, indicators = {} }) {
  let ministry = JSON.parse(JSON.stringify(input));
  const events = [];
  for (const proposal of ministry.proposals.filter(item => item.status === 'in-preparazione' && week >= item.readyWeek)) {
    proposal.status = 'pronta';
    events.push({ tone: 'good', text: `Il tuo staff ha finito la proposta «${proposal.title}»: puoi sondare i colleghi e portarla in Consiglio.` });
  }
  const areas = areasOfMinistry(ministry);
  // the crises of the sector
  for (const area of areas) {
    const value = indicators[area];
    const open = ministry.crises.find(item => item.area === area && item.status === 'aperta');
    if (Number.isFinite(value) && value < MINISTRY_RULES.crisisBelow && !open && !ministry.crises.some(item => item.area === area && item.closedWeek && week - item.closedWeek < 12)) {
      ministry.crises = [{ id: `crisi-${week}-${area}`, area, value: Math.round(value), openedWeek: week, deadlineWeek: week + MINISTRY_RULES.crisisWeeks, status: 'aperta' }, ...ministry.crises].slice(0, 12);
      events.push({ tone: 'bad', text: `Crisi nel tuo settore: ${AREA_BY_ID[area].label} è a ${Math.round(value)}/100. Il Presidente del Consiglio e la stampa guardano a te.` });
    }
  }
  for (const crisis of ministry.crises.filter(item => item.status === 'aperta')) {
    const value = indicators[crisis.area];
    if (Number.isFinite(value) && value >= MINISTRY_RULES.crisisBelow + 6) { crisis.status = 'rientrata'; crisis.closedWeek = week; ministry.standing = clamp(ministry.standing + 3, 0, 100); events.push({ tone: 'good', text: `La crisi di ${AREA_BY_ID[crisis.area].label.toLowerCase()} è rientrata.` }); }
    else if (week > crisis.deadlineWeek) { crisis.status = 'scaduta'; crisis.closedWeek = week; ministry.pmRelation = clamp(ministry.pmRelation - 4, 0, 100); ministry.standing = clamp(ministry.standing - 4, 0, 100); events.push({ tone: 'bad', text: `Crisi di ${AREA_BY_ID[crisis.area].label.toLowerCase()} senza risposta: il Presidente del Consiglio e i cittadini ti chiedono conto.` }); }
  }
  // the requests of the Prime Minister
  if (areas.length && week - (ministry.lastAssignmentWeek ?? -99) >= MINISTRY_RULES.assignmentEvery && !ministry.assignments.some(item => item.status === 'aperto')) {
    const worst = [...areas].filter(id => Number.isFinite(indicators[id])).sort((a, b) => indicators[a] - indicators[b])[0] ?? areas[0];
    const kind = indicators[worst] < 50 ? 'piano' : 'relazione';
    ministry.assignments = [{ id: `incarico-${week}-${worst}`, kind, area: worst, title: kind === 'piano' ? `un piano per rimettere in sesto ${AREA_BY_ID[worst].label.toLowerCase()} (oggi ${Math.round(indicators[worst])}/100)` : `una relazione sullo stato di ${AREA_BY_ID[worst].label.toLowerCase()}`, requestedWeek: week, dueWeek: week + MINISTRY_RULES.assignmentWeeks, status: 'aperto' }, ...ministry.assignments].slice(0, 12);
    ministry.lastAssignmentWeek = week;
    events.push({ tone: 'neutral', text: `Il Presidente del Consiglio ti chiede ${ministry.assignments[0].title}, entro ${MINISTRY_RULES.assignmentWeeks} settimane.` });
  }
  for (const item of ministry.assignments.filter(entry => entry.status === 'aperto' && week > entry.dueWeek)) {
    item.status = 'scaduto'; item.closedAt = date; ministry.pmRelation = clamp(ministry.pmRelation - 8, 0, 100); ministry.standing = clamp(ministry.standing - 3, 0, 100);
    events.push({ tone: 'bad', text: `Non hai consegnato ${item.title}: il Presidente del Consiglio è deluso.` });
  }
  for (const event of events) ministry = note(ministry, date, event.text);
  return { ministry, events };
}
// A sector in crisis: a statement calms the press (no real effect), the funds are asked of the Council (the store pays them from the fiscal margin).
export function answerCrisis(input, crisisId, answer, { date }) {
  const ministry = JSON.parse(JSON.stringify(input));
  const crisis = ministry.crises.find(item => item.id === crisisId && item.status === 'aperta');
  if (!crisis) throw new Error('La crisi non è più aperta.');
  if (answer === 'dichiarazione') {
    if (crisis.statement) throw new Error('Hai già parlato: ora servono fatti.');
    crisis.statement = true; ministry.standing = clamp(ministry.standing + 1, 0, 100);
    return { ministry: note(ministry, date, `Dichiarazione sulla crisi di ${AREA_BY_ID[crisis.area].label.toLowerCase()}: la stampa aspetta i fatti.`), fund: false };
  }
  if (answer === 'fondi') {
    if (crisis.funded) throw new Error('Hai già chiesto i fondi per questa crisi.');
    crisis.funded = true; ministry.pmRelation = clamp(ministry.pmRelation + 1, 0, 100);
    return { ministry: note(ministry, date, `Chiedi al Consiglio dei fondi d’emergenza per ${AREA_BY_ID[crisis.area].label.toLowerCase()}.`), fund: true, area: crisis.area };
  }
  throw new Error('Risposta non valida.');
}
export const openProposals = ministry => (ministry?.proposals ?? []).filter(item => ['in-preparazione', 'pronta', 'in-agenda'].includes(item.status));
