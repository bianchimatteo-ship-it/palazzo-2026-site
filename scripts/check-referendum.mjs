// The two referendums, strictly apart: the abrogative one (art. 75) and the constitutional confirmatory one (art. 138). Real engine, real career.
//   abrogative: exclusions (tax/budget, amnesty, treaties), partial/total, the quality of the question, signatures or five Regional Councils, the Central Office, the Court, the campaign, the QUORUM (more than half
//   of those entitled to vote must take part) and the majority of YES, the effect on the law in force; constitutional: two deliberations, the two thirds (no referendum), the request within three months, NO quorum,
//   a rejected reform does not enter into force.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer, playWeek } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const R = await import(new URL(`../src/core/referendum-engine.js?v=${build}`, import.meta.url).href);

const target = { statuteId: 'statuto-1', title: 'Fondo per la scuola di montagna', area: 'scuola', instrument: 'investimento', kind: 'ddl' };

// ---------- 1. the question and its admissibility ----------
for (const [title, area] of [['Legge di bilancio 2027', 'fisco'], ['Amnistia per i reati minori', 'giustizia'], ['Ratifica del trattato sulla pesca', 'esteri'], ['Imposta sulle bevande zuccherate', 'sanita']]) {
  const check = R.eligibility({ statuteId: 'x', title, area }, { scope: 'totale', route: 'firme' });
  assert.ok(!check.ok && check.excluded.length, `«${title}» non si può abrogare con referendum`);
  assert.throws(() => R.createAbrogative({ scope: 'totale', route: 'firme' }, { target: { statuteId: 'x', title, area }, date: '2027-01-10' }), /Non si può chiedere il referendum/);
}
assert.ok(R.eligibility(target, { scope: 'totale' }).ok, 'una legge ordinaria si può abrogare');
assert.ok(!R.eligibility(target, { scope: 'parziale', partText: 'art. 2' }).ok, 'abrogazione parziale: bisogna dire quali parti');
assert.match(R.questionOf(target, { scope: 'parziale', partText: 'articolo 3, comma 2 (le sedi)' }), /limitatamente a/);
assert.ok(R.eligibility(target, { scope: 'totale' }).homogeneity > R.eligibility(target, { scope: 'parziale', partText: 'articolo 1 sulle sedi; articolo 2 sui fondi; articolo 3 sui concorsi; articolo 4 sulle tariffe; articolo 5 sui controlli; articolo 6 sulle sanzioni' }).homogeneity, 'un quesito con molte finalità è meno omogeneo');
assert.throws(() => R.createAbrogative({ scope: 'totale', route: 'altro' }, { target, date: '2027-01-10' }), /Scegli la via/);

// ---------- 2. the Regional Councils route ----------
let ref = R.createAbrogative({ scope: 'totale', route: 'consigli' }, { target, date: '2027-01-10', id: 'ref-consigli' });
assert.equal(ref.phase, 'consigli');
const names = ['Lombardia', 'Veneto', 'Toscana', 'Emilia-Romagna', 'Lazio', 'Piemonte', 'Campania', 'Puglia', 'Sicilia', 'Liguria', 'Marche', 'Umbria'];
assert.throws(() => R.askCouncils(ref, { regions: names.slice(0, 3), weights: {}, date: '2027-01-17', week: 2 }), /Servono 5/);
let guard = 0, approved = [];
const strong = Object.fromEntries(names.map(name => [name, 1]));
while (ref.phase === 'consigli' && guard++ < 6) { const out = R.askCouncils(ref, { regions: names, weights: strong, date: '2027-01-17', week: guard }); ref = out.referendum; approved = out.approved; }
assert.equal(ref.phase, 'cassazione', 'con cinque Consigli favorevoli la richiesta passa in Cassazione');
assert.ok(approved.length >= 5 && ref.cassationAt, 'sono almeno cinque e c’è una data per la Cassazione');

// ---------- 3. the Central Office and the Court ----------
const ctxAt = (date, week, extra = {}) => ({ date, week, salience: 0.5, stances: { si: ['a'], no: ['b'], free: [] }, weights: { si: 0.4, no: 0.5 }, electorate: 51000000, ...extra });
let out = R.advanceReferendum(ref, ctxAt('2027-01-20', 3));
assert.equal(out.referendum.phase, 'cassazione', 'prima della data la Cassazione non decide');
out = R.advanceReferendum(ref, ctxAt(ref.cassationAt, 8));
assert.equal(out.referendum.phase, 'corte');
const fromCourt = out.referendum;
// a request with too few valid signatures is refused by the Central Office
{
  const weak = R.fileRequest(R.createAbrogative({ scope: 'totale', route: 'firme' }, { target, date: '2027-01-10', id: 'ref-poche' }), { date: '2027-04-01', valid: 480000 });
  const refused = R.advanceReferendum(weak, ctxAt(weak.cassationAt, 20));
  assert.equal(refused.referendum.status, 'respinto', 'sotto le 500.000 firme valide il deposito è respinto');
  assert.ok(refused.effects?.reputation < 0, 'e costa un po’ di reputazione');
}
// the Court: a clear and homogeneous question is mostly admitted, a heterogeneous one is not
let admitted = 0, rejected = 0;
for (let i = 0; i < 40; i++) { const trial = { ...fromCourt, id: `corte-${i}` }; const r = R.advanceReferendum(trial, ctxAt(trial.courtAt, 30 + i)).referendum; if (r.phase === 'campagna') admitted++; else if (r.status === 'inammissibile') rejected++; }
assert.ok(admitted > 20 && rejected > 0, `la Corte ammette la maggior parte dei quesiti chiari ma non tutti (${admitted}/${rejected})`);
{
  const messy = R.createAbrogative({ scope: 'parziale', partText: 'articolo 1 sulle sedi; articolo 2 sui fondi; articolo 3 sui concorsi; articolo 4 sulle tariffe; articolo 5 sui controlli; articolo 6 sulle sanzioni', route: 'consigli' }, { target, date: '2027-01-10', id: 'messy' });
  assert.ok(messy.quality.homogeneity < 0.7, 'quesito non omogeneo');
}
// excluded matter is stopped even if it got this far
{
  const sneaky = { ...fromCourt, id: 'sneaky', target: { ...fromCourt.target, title: 'Imposta sui redditi', area: 'fisco' } };
  const r = R.advanceReferendum(sneaky, ctxAt(sneaky.courtAt, 40));
  assert.equal(r.referendum.status, 'inammissibile', 'la Corte dichiara inammissibile una legge tributaria');
}

// ---------- 4. the vote: QUORUM and majority (abrogative) ----------
const campaignOf = (base, { support, turnout }) => { const r = { ...base, id: `voto-${support}-${turnout}`, phase: 'campagna', voteDate: '2027-06-06', campaign: { support, turnout, stances: { si: ['a'], no: ['b'], free: [] }, actions: {}, events: [], polls: [], effortWeek: -1, used: 0 }, side: 'si' }; return r; };
const vote = (base, args) => R.advanceReferendum(campaignOf(base, args), ctxAt('2027-06-06', 60));
{
  const noQuorum = vote(fromCourt, { support: 72, turnout: 30 });
  assert.equal(noQuorum.referendum.result.quorumReached, false, 'con l’affluenza al 30% manca il quorum');
  assert.equal(noQuorum.referendum.carried, false, 'senza quorum la legge NON è abrogata, anche se i SÌ sono il 72%');
  assert.equal(noQuorum.effects.statute, null, 'e la legge resta in vigore');
  assert.match(noQuorum.referendum.outcome, /Quorum non raggiunto/);
  const noAhead = vote(fromCourt, { support: 30, turnout: 68 });
  assert.equal(noAhead.referendum.result.quorumReached, true);
  assert.equal(noAhead.referendum.carried, false, 'con il quorum ma i NO avanti la legge resta');
  assert.equal(noAhead.effects.statute, null);
  const yes = vote(fromCourt, { support: 70, turnout: 70 });
  assert.equal(yes.referendum.carried, true, 'quorum e SÌ avanti: abrogata');
  assert.deepEqual({ id: yes.effects.statute.id, status: yes.effects.statute.status }, { id: 'statuto-1', status: 'abrogata' });
  const r = yes.referendum.result;
  assert.equal(r.yesVotes + r.noVotes, r.valid, 'SÌ + NO = voti validi');
  assert.equal(r.valid + r.blank, r.voters, 'validi + bianche/nulle = votanti');
  assert.ok(r.voters <= r.electorate && r.simulated === true, 'votanti ≤ aventi diritto, dato dichiarato simulato');
  // the partial repeal leaves the law, amended
  const part = vote({ ...fromCourt, target: { ...fromCourt.target, scope: 'parziale', partText: 'art. 2' } }, { support: 70, turnout: 70 });
  assert.equal(part.effects.statute.status, 'modificata', 'abrogazione parziale: la legge resta, modificata');
  // the side taken pays: a win gains reputation, a defeat loses it
  assert.ok(yes.effects.reputation > 0 && noAhead.effects.reputation < 0, 'chi vince guadagna reputazione, chi perde la paga');
  assert.equal(vote(fromCourt, { support: 70, turnout: 70 }).referendum.result.yesVotes, yes.referendum.result.yesVotes, 'deterministico: stesso stato, stesso voto');
}
// the player acts: a campaign action moves the support, at most three a week, the abstention is for the NO side only
{
  let c = campaignOf(fromCourt, { support: 50, turnout: 40 });
  const base = c.campaign.support;
  c = R.campaignAction(c, 'spot', { week: 61, side: 'si' }).referendum;
  assert.ok(c.campaign.support !== base, 'una campagna di spot sposta i voti');
  assert.throws(() => R.campaignAction(c, 'astensione', { week: 61, side: 'si' }), /parte del NO/);
  const n = R.campaignAction(c, 'astensione', { week: 61, side: 'no' }).referendum;
  assert.ok(n.campaign.turnout < c.campaign.turnout, 'invitare a non votare abbassa l’affluenza');
  c = R.campaignAction(n, 'comizio', { week: 61, side: 'no' }).referendum;
  assert.throws(() => R.campaignAction(c, 'spot', { week: 61, side: 'no' }), /tre iniziative/);
  assert.doesNotThrow(() => R.campaignAction(c, 'spot', { week: 62, side: 'no' }), 'la settimana dopo si riparte');
}

// ---------- 5. the constitutional referendum: two thirds, request, NO quorum, rejected reform ----------
const revision = { id: 'riforma-1', kind: 'costituzionale', title: 'Riforma del bicameralismo', status: 'in-corso', phase: 'prima', createdAt: '2027-01-10', side: null, deliberations: [], councils: { required: 5, approved: [], refused: [] }, request: null, firstAt: '2027-01-31', steps: [], source: 'simulazione' };
const backing = share => ({ camera: share, senato: share });
{
  // two thirds at the second deliberation: no referendum
  let r = R.advanceReferendum(revision, ctxAt('2027-01-31', 5, { backing: backing(0.7) })).referendum;
  assert.equal(r.phase, 'pausa', 'prima deliberazione approvata: segue l’intervallo di tre mesi');
  assert.equal(r.secondAt, R.addMonths('2027-01-31', 3), 'l’intervallo è di tre mesi di calendario (31 gennaio → 30 aprile)'); assert.ok(Date.parse(r.secondAt) - Date.parse('2027-01-31') >= 89 * 86400000);
  const early = R.advanceReferendum(r, ctxAt('2027-03-01', 9, { backing: backing(0.7) })).referendum;
  assert.equal(early.phase, 'pausa', 'prima di tre mesi la seconda deliberazione non si fa');
  const third = R.advanceReferendum(r, ctxAt(r.secondAt, 19, { backing: backing(0.72) }));
  assert.equal(third.referendum.status, 'in-vigore', 'con i due terzi alla seconda deliberazione il referendum non è possibile');
  assert.match(third.referendum.outcome, /referendum non è possibile/);
  assert.ok(third.effects.constitutional.noReferendum);
  // a reform without the absolute majority falls
  const low = R.advanceReferendum(revision, ctxAt('2027-01-31', 5, { backing: backing(0.35) })).referendum;
  assert.equal(low.status, 'respinta', 'senza la maggioranza assoluta la riforma decade');
  // an absolute majority but not two thirds: the referendum can be requested within three months
  r = R.advanceReferendum(revision, ctxAt('2027-01-31', 5, { backing: backing(0.58) })).referendum;
  const second = R.advanceReferendum(r, ctxAt(r.secondAt, 19, { backing: backing(0.58) })).referendum;
  assert.equal(second.phase, 'richiesta', 'maggioranza assoluta ma non i due terzi: si può chiedere il referendum');
  assert.ok(second.requestUntil && Date.parse(second.requestUntil) - Date.parse(r.secondAt) >= 85 * 86400000, 'entro tre mesi dalla pubblicazione');
  assert.throws(() => R.requestConstitutional(second, { route: 'quinto', date: '2027-07-15', week: 30, opposition: { camera: 10, senato: 10 } }), /un quinto/);
  assert.throws(() => R.requestConstitutional(second, { route: 'firme', date: '2027-07-15', week: 30, valid: 400000 }), /500\.000 firme/);
  assert.throws(() => R.requestConstitutional(second, { route: 'consigli', date: '2027-07-15', week: 30, regions: ['Lazio', 'Veneto'] }), /cinque Consigli/);
  assert.throws(() => R.requestConstitutional(second, { route: 'quinto', date: '2030-01-01', week: 30, opposition: { camera: 42, senato: 42 } }), /scaduto/);
  const asked = R.requestConstitutional(second, { route: 'quinto', date: '2027-07-15', week: 30, opposition: { camera: 42, senato: 42 } });
  assert.ok(asked.done && asked.referendum.request.by === 'quinto');
  // no request in three months and a weak opposition: the reform enters into force
  const weakOpposition = { ...second, opposition: { camera: 5, senato: 5 } };
  const lapsed = R.advanceReferendum(weakOpposition, ctxAt('2030-01-01', 150));
  assert.equal(lapsed.referendum.status, 'in-vigore', 'nessuna richiesta nei tre mesi: la riforma entra in vigore');
  // the campaign and the vote: NO quorum — a low turnout still counts, and a rejected reform does not enter into force
  const camp = (support, turnout) => ({ ...asked.referendum, phase: 'campagna', voteDate: '2027-10-10', side: 'no', campaign: { support, turnout, stances: { si: ['a'], no: ['b'], free: [] }, actions: {}, events: [], polls: [], effortWeek: -1, used: 0 } });
  const lowTurnoutYes = R.advanceReferendum(camp(66, 22), ctxAt('2027-10-10', 36));
  assert.equal(lowTurnoutYes.referendum.result.quorumReached, true, 'il referendum costituzionale non ha quorum');
  assert.equal(lowTurnoutYes.referendum.carried, true, 'anche con il 22% di affluenza vince il SÌ se ha la maggioranza');
  assert.equal(lowTurnoutYes.referendum.status, 'concluso');
  assert.match(lowTurnoutYes.referendum.outcome, /confermata ed entra in vigore/);
  assert.equal(lowTurnoutYes.effects.constitutional.carried, true);
  assert.equal(lowTurnoutYes.effects.statute, null, 'il referendum costituzionale non tocca il registro delle leggi ordinarie');
  const rejectedReform = R.advanceReferendum(camp(30, 55), ctxAt('2027-10-10', 36));
  assert.equal(rejectedReform.referendum.carried, false);
  assert.match(rejectedReform.referendum.outcome, /respinta e non entra in vigore/);
  assert.equal(rejectedReform.effects.constitutional.carried, false);
  assert.ok(rejectedReform.effects.reputation > 0, 'chi era per il NO ha vinto');
  assert.throws(() => R.campaignAction({ ...camp(50, 40) }, 'astensione', { week: 1, side: 'no' }), /non ha quorum/, 'invitare a non votare non ha senso senza quorum');
}
// the two procedures never share their rules
assert.equal(R.ABROGATIVE.quorum, 0.5);
assert.ok(!('quorum' in R.CONSTITUTIONAL), 'il costituzionale non ha quorum');
assert.ok(R.pathOf(revision).some(([id]) => id === 'pausa') && !R.pathOf(fromCourt).some(([id]) => id === 'pausa'), 'fasi diverse');

// ---------- 6. in the game ----------
const { store, db, decide } = await startCareer({ seed: 'referendum', level: 'deputato', fast: true });
const state = () => store.getState();
const lawsInForce = () => store.referendumTargets().filter(item => !item.excluded.length);
assert.deepEqual(store.referendums(), [], 'all’inizio nessun referendum');
// a law in force to repeal
state().parliament = { ...state().parliament, statutes: [{ id: 'statuto-gioco', lawId: 'l1', number: 1, title: 'Fondo per le scuole di montagna', summary: 'Un fondo.', area: 'scuola', instrument: 'investimento', kind: 'ddl', origin: 'La maggioranza', approvedAt: state().clock.currentDate, legislature: 1, status: 'vigente', blockable: true, amendments: [] }, { id: 'statuto-fisco', lawId: 'l2', number: 2, title: 'Imposta sui consumi', summary: 'Tributaria.', area: 'fisco', instrument: 'tasse', kind: 'ddl', origin: 'La maggioranza', approvedAt: state().clock.currentDate, legislature: 1, status: 'vigente', blockable: true, amendments: [] }] };
assert.equal(lawsInForce().length, 1, 'la legge tributaria è marcata come esclusa');
assert.ok(store.referendumTargets().find(item => item.statuteId === 'statuto-fisco').excluded.length, 'esclusione mostrata');
assert.throws(() => store.startReferendum({ statuteId: 'statuto-fisco', scope: 'totale', route: 'firme' }), /Non si può chiedere/);
assert.throws(() => store.startReferendum({ statuteId: 'non-esiste', scope: 'totale', route: 'firme' }), /Scegli la legge/);
state().game.resources = { ...state().game.resources, funds: 50000, politicalCapital: 20 };
const made = store.startReferendum({ statuteId: 'statuto-gioco', scope: 'totale', route: 'firme' });
assert.equal(made.phase, 'raccolta');
const linked = store.initiatives().find(item => item.id === made.initiativeId);
assert.ok(linked && linked.kind === 'referendum' && linked.required === 500000, 'la raccolta è quella delle 500.000 firme della pagina Iniziative');
assert.throws(() => store.startReferendum({ statuteId: 'statuto-gioco', scope: 'totale', route: 'consigli' }), /già una richiesta/, 'una richiesta alla volta per legge');
// the collection is deposited and verified: the referendum moves to the Cassazione (the initiative engine runs)
state().game.initiatives = state().game.initiatives.map(item => item.id === made.initiativeId ? { ...item, status: 'depositata', verification: { valid: 520000, share: 0.93 }, signatures: { ...item.signatures, total: 560000 } } : item);
for (let week = 0; week < 2; week++) playWeek({ store, db, decide });
let current = store.referendums().find(item => item.id === made.id);
assert.ok(['cassazione', 'corte', 'campagna'].includes(current.phase), `dopo il deposito la richiesta va avanti (fase: ${current.phase})`);
// play on until it is over: Cassazione, Court, campaign, vote — the law is repealed only with quorum and YES
store.supportReferendum(made.id, 'si');
let weeks = 0, acted = 0;
while (store.referendums().find(item => item.id === made.id).status === 'in-corso' && weeks++ < 60) {
  const now = store.referendums().find(item => item.id === made.id);
  if (now.phase === 'campagna' && acted < 12) { try { store.referendumAction(made.id, ['spot', 'mobilitazione', 'comizio'][acted % 3]); acted++; } catch { /* no resources this week */ } }
  playWeek({ store, db, decide });
}
current = store.referendums().find(item => item.id === made.id);
assert.notEqual(current.status, 'in-corso', `il referendum arriva a una conclusione (${weeks} settimane)`);
assert.ok(current.outcome && current.steps.length >= 3, 'esito e cronologia');
const law = store.statutes().find(item => item.id === 'statuto-gioco');
if (current.carried) assert.equal(law.status, 'abrogata', 'abrogata dal referendum: nel registro delle leggi');
else assert.equal(law.status, 'vigente', 'respinto, non valido o inammissibile: la legge resta in vigore');
assert.ok(state().game.log.some(item => /Referendum/.test(item.title ?? '')), 'il diario racconta il referendum');
// a repealed law no longer blocks: the same measure can be proposed again
if (current.carried) assert.equal(store.referendumTargets().find(item => item.statuteId === 'statuto-gioco'), undefined, 'una legge abrogata non è più tra quelle abrogabili');
// the constitutional one: born from the Chambers, the player can request or collect, the calendar lists the dates
{
  const year = state().clock.currentDate;
  state().game.referendums = [{ ...revision, id: 'riforma-gioco', phase: 'richiesta', requestUntil: new Date(Date.parse(year) + 60 * 86400000).toISOString().slice(0, 10), opposition: { camera: 41, senato: 38 }, deliberations: [] }, ...state().game.referendums];
  const agenda = store.agendaCalendar?.() ?? null;
  const asked = store.requestConstitutionalReferendum('riforma-gioco', 'quinto');
  assert.equal(asked.request.by, 'quinto', 'la richiesta di un quinto dei membri è registrata');
  assert.throws(() => store.requestConstitutionalReferendum('riforma-gioco', 'quinto'), /già stato chiesto/);
}
// ---- deadlines in calendar months (art. 138): end of month, leap years, change of year ----
for (const [from, months, expected] of [['2027-01-31', 3, '2027-04-30'], ['2026-11-30', 3, '2027-02-28'], ['2027-11-30', 3, '2028-02-29'], ['2026-12-15', 3, '2027-03-15'], ['2028-01-31', 1, '2028-02-29'], ['2027-01-31', 1, '2027-02-28'], ['2026-05-31', 3, '2026-08-31'], ['2026-08-31', 6, '2027-02-28'], ['2028-02-29', 12, '2029-02-28'], ['2026-10-01', 3, '2027-01-01']]) assert.equal(R.addMonths(from, months), expected, `${from} + ${months} mesi = ${expected}`);
assert.equal(R.CONSTITUTIONAL?.deliberationGapMonths ?? 3, 3);
console.log('check-referendum: ok');
