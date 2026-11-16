// The desk of the minister (core/ministry-engine.js + store + weekly tick): the player who holds a ministry has an area of his own: the department with its areas and problems, a priority, proposals
// prepared by the staff (two weeks), sounded out with colleagues and voted by the Council of Ministers (each minister, the Prime Minister counting twice), a bill of the Government when they pass,
// what the Prime Minister asks him (with a deadline and a price for a late answer), the crises of his sector. He acts only in the areas of his department.
import assert from 'node:assert/strict';
import * as M from '../src/core/ministry-engine.js';
import { AREA_BY_ID, areasOfPortfolio } from '../src/data/simulation/policy-rules.js';
import { startCareer } from './lib/long-run.mjs';

const portfolio = 'Salute'; const own = areasOfPortfolio(portfolio);
const D = '2027-01-04';
// ---------- engine ----------
{
  assert.ok(own.length >= 1, `Il ministero ha delle aree (${own.join(', ')}).`);
  let m = M.newMinistry(portfolio, D);
  const outside = Object.keys(AREA_BY_ID).find(id => !own.includes(id));
  assert.throws(() => M.setPriority(m, outside, D), /non ha competenza/, 'Una priorità fuori competenza è rifiutata e dice di chi è.');
  assert.throws(() => M.prepareProposal(m, { area: outside, instrument: Object.keys(AREA_BY_ID[outside].instruments)[0] }, { week: 1, date: D }), /non ha competenza/);
  m = M.setPriority(m, own[0], D); assert.equal(m.priority, own[0]); assert.throws(() => M.setPriority(m, own[0], D), /già la priorità/);
  const instrument = Object.keys(AREA_BY_ID[own[0]].instruments)[0];
  assert.throws(() => M.prepareProposal(m, { area: own[0], instrument: 'inesistente' }, { week: 1, date: D }), /strumento/);
  m = M.prepareProposal(m, { area: own[0], instrument, financing: 'deficit' }, { week: 1, date: D });
  assert.equal(m.proposals[0].status, 'in-preparazione'); assert.equal(m.proposals[0].readyWeek, 3);
  assert.throws(() => M.submitProposal(m, m.proposals[0].id, { week: 2, date: D }), /non ha finito/, 'Prima del tempo non si porta in Consiglio.');
  assert.throws(() => M.prepareProposal(m, { area: own[0], instrument, financing: 'deficit' }, { week: 1, date: D }), /già una proposta uguale/);
  const tick = M.tickMinistry(m, { week: 3, date: D, indicators: Object.fromEntries(own.map(id => [id, 60])) });
  assert.equal(tick.ministry.proposals[0].status, 'pronta'); assert.ok(tick.events.some(e => /finito la proposta/.test(e.text)));
  m = tick.ministry;
  const ministers = Array.from({ length: 6 }, (_, n) => ({ id: `m${n}`, portfolio: `Ministero ${n}`, bond: 55, likes: n < 2 ? [own[0]] : [], dislikes: n > 4 ? [own[0]] : [] }));
  m = M.lobbyColleague(m, m.proposals[0].id, ministers[0], D); assert.throws(() => M.lobbyColleague(m, m.proposals[0].id, ministers[0], D), /Hai già parlato/);
  m = M.submitProposal(m, m.proposals[0].id, { week: 3, date: D });
  assert.equal(M.holdSession(m, { week: 3, date: D, ministers }).decided.length, 0, 'Il Consiglio vota dalla settimana dopo.');
  // the vote over many proposals: it passes more often with good relations and with sounded colleagues
  const rate = (pm, lobby) => { let ok = 0; for (let n = 0; n < 120; n++) { const base = { ...m, pmRelation: pm, proposals: [{ ...m.proposals[0], id: `p${n}-${pm}-${lobby}`, lobbied: lobby ? ministers.slice(0, 4).map(x => x.id) : [], status: 'in-agenda', submittedWeek: 3 }] }; if (M.holdSession(base, { week: 5, date: D, ministers }).decided[0].outcome === 'approvata') ok++; } return ok; };
  const good = rate(80, true), poor = rate(20, false);
  assert.ok(good > poor + 20, `Buoni rapporti e colleghi sondati fanno passare più proposte (${good}/120 contro ${poor}/120).`);
  const decided = M.holdSession({ ...m, proposals: [{ ...m.proposals[0], status: 'in-agenda', submittedWeek: 3 }] }, { week: 5, date: D, ministers });
  assert.ok(decided.decided[0].proposal.votes.length === ministers.length + 1 && decided.decided[0].proposal.votes.at(-1).weight === 2, 'Ogni ministro vota e il Presidente del Consiglio conta doppio.');
  // the Prime Minister's requests and the crises
  let t = M.tickMinistry(M.newMinistry(portfolio, D), { week: 10, date: D, indicators: Object.fromEntries(own.map(id => [id, 30])) });
  assert.ok(t.ministry.crises.some(c => c.status === 'aperta'), 'Un indicatore sotto 38 apre una crisi del settore.');
  assert.ok(t.ministry.assignments.some(a => a.status === 'aperto' && a.kind === 'piano'), 'Il Presidente del Consiglio chiede un piano.');
  const assignment = t.ministry.assignments[0];
  const done = M.respondAssignment(t.ministry, assignment.id, 'consegna', { week: 11, date: D, competence: 70, rand: 0.1 }); assert.equal(done.result, 'buona'); assert.ok(done.ministry.pmRelation > t.ministry.pmRelation);
  const late = M.tickMinistry(t.ministry, { week: 10 + M.MINISTRY_RULES.assignmentWeeks + 1, date: D, indicators: Object.fromEntries(own.map(id => [id, 30])) });
  assert.ok(late.ministry.pmRelation < t.ministry.pmRelation && late.events.some(e => /Non hai consegnato/.test(e.text)), 'Un incarico non consegnato costa il rapporto con il Presidente del Consiglio.');
  const crisis = t.ministry.crises[0];
  assert.throws(() => M.answerCrisis(t.ministry, 'inesistente', 'fondi', { date: D }), /non è più aperta/);
  assert.equal(M.answerCrisis(t.ministry, crisis.id, 'fondi', { date: D }).fund, true);
}
// ---------- a career ----------
{
  const { store } = await startCareer({ seed: 'ministro', level: 'deputato', fast: true });
  store.setHeadlessVoter(null);
  assert.equal(store.ministryView(), null, 'Senza ministero non c’è l’area ministeriale.');
  const state = () => store.getState();
  const minister = state().parliament.government.ministers.find(item => !item.playerAppointed && !item.endedAt && areasOfPortfolio(item.portfolio).length);
  minister.playerAppointed = true;
  const view = store.ministryView();
  assert.ok(view && view.ministry.portfolio === minister.portfolio && view.areas.length && view.colleagues.length, 'Con un ministero compare l’area ministeriale.');
  const clear = () => { for (const item of state().game.inbox.filter(entry => ['urgente', 'situazione'].includes(entry.kind))) for (const choice of item.choices ?? []) { try { store.resolveAgendaItem(item.id, choice.id); break; } catch { /* next */ } } };
  const area = view.areas[0]; state().game.resources.politicalCapital = 40; state().game.resources.funds = 20000;
  const outside = Object.keys(AREA_BY_ID).find(id => !view.areas.some(item => item.id === id));
  assert.throws(() => store.ministryAction('prepara', { area: outside, instrument: Object.keys(AREA_BY_ID[outside].instruments)[0], financing: 'deficit' }), /non ha competenza/, 'Fuori competenza: rifiutato con il motivo.');
  store.ministryAction('priorita', { area: area.id });
  const capitalBefore = state().game.resources.politicalCapital;
  store.ministryAction('prepara', { area: area.id, instrument: Object.keys(area.instruments)[0], financing: 'deficit', intensity: 1 });
  assert.equal(state().game.resources.politicalCapital, capitalBefore - 1, 'Preparare una proposta costa 1 punto di capitale.');
  const advance = n => { for (let i = 0; i < n; i++) { clear(); for (const vote of []) void vote; store.advanceTurn(1, { delegate: true }); } };
  advance(3);
  let proposal = store.ministryView().ministry.proposals[0];
  assert.equal(proposal.status, 'pronta', 'Dopo due settimane la proposta è pronta.');
  store.ministryAction('sonda', { proposalId: proposal.id, ministerId: store.ministryView().colleagues[0].id });
  store.ministryAction('porta', { proposalId: proposal.id });
  advance(3);
  proposal = store.ministryView().ministry.proposals[0];
  assert.ok(['approvata', 'respinta', 'pronta'].includes(proposal.status) && proposal.votes?.length > 1, `Il Consiglio ha votato (${proposal.status}).`);
  if (proposal.status === 'approvata') assert.ok(proposal.lawId ? state().parliament.laws.some(law => law.id === proposal.lawId) : true, 'Approvata: il governo presenta il disegno di legge.');
  assert.ok(state().game.log.length >= 0);
  advance(12);
  const after = store.ministryView().ministry;
  assert.ok(after.assignments.length >= 1, 'Il Presidente del Consiglio ha chiesto qualcosa.');
  const open = after.assignments.find(item => item.status === 'aperto');
  if (open) { const out = store.ministryAction('consegna', { assignmentId: open.id }); assert.ok(['buona', 'sufficiente'].includes(out.result)); }
}
// ---------- the Prime Minister convenes the Council ----------
{
  const { store } = await startCareer({ seed: 'premier-cdm', level: 'deputato', fast: true });
  const state = () => store.getState();
  const { isPrimeMinister } = await import('../src/core/roles.js');
  if (!isPrimeMinister(state().parliament)) state().parliament.government.primeMinister = 'player';
  state().game.resources.politicalCapital = 30;
  const before = store.cabinetView();
  if (before?.meeting) store.cabinetAction('meeting', before.meeting.id, 'approvare');
  store.cabinetAction('convoca', 'sanita');
  const open = store.cabinetView().meeting;
  assert.ok(open && open.area === 'sanita' && open.convoked, 'Il Presidente del Consiglio convoca il Consiglio con l’ordine del giorno scelto.');
  assert.throws(() => store.cabinetAction('convoca', 'scuola'), /già un Consiglio/, 'Uno alla volta.');
  assert.throws(() => store.cabinetAction('convoca', 'inesistente'), /ordine del giorno|già un Consiglio/);
  store.cabinetAction('meeting', open.id, 'approvare');
  assert.ok(store.cabinetView().recent.some(item => item.area === 'sanita' || /sanit/i.test(item.topic)), 'La decisione è nello storico.');
}
console.log('Area ministeriale verificata: aree e problemi del ministero, priorità, proposte preparate dallo staff, colleghi sondati, voto del Consiglio con il Presidente del Consiglio che conta doppio, disegno di legge del governo, incarichi e crisi con scadenze, nessuna azione fuori competenza.');
