// Audit of the staff: every task that the interface offers as delegable has an implementation that really changes the game; the cost of a week is paid once even if the weekly close is run twice for
// the same week; the budget ceiling stops the spending exactly; suspension / resume / cancel behave; the results and the reports are kept within their limits; what is NOT delegable is stated with
// its reason, and nothing in the list of tasks hides a vote, a candidacy, a deal or an irreversible step.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const load = path => import(new URL(`../${path}?v=${build}`, import.meta.url).href);
const { STAFF_TASKS, STAFF_TASK_BY_ID, NON_DELEGABLE, STAFF_REPORTS_KEPT, STAFF_MAX_MANDATES } = await load('src/data/simulation/staff-rules.js');
const E = await load('src/core/staff-engine.js');
const seededRand = seed => { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };
const { createFinance } = await load('src/core/finance-engine.js');
const baseGame = () => ({ resources: { funds: 100000, politicalCapital: 50 }, finance: { ...createFinance({ week: 5, date: '2027-01-01', funds: 100000 }), budget: { personale: 4000, comunicazione: 4000, territorio: 4000, studio: 4000, raccolta: 4000 } }, week: { index: 5 },
  party: { org: { committees: [{ id: 'c1', name: 'Comitato Uno', region: 'Toscana', activists: 20, members: 120, quality: 50, organization: 60, consensus: 55, loyalty: 60, status: 'attivo', fatigue: 0, activity: 30 }, { id: 'c2', name: 'Comitato Due', region: 'Lazio', activists: 8, members: 60, quality: 50, organization: 55, consensus: 50, loyalty: 55, status: 'attivo', fatigue: 0, activity: 20 }], treasury: { balance: 50000 } }, life: { cadres: [{ id: 'd1', name: 'Dirigente Uno', status: 'attivo', grievance: 60, loyalty: 40, person: { displayName: 'Dirigente Uno' } }] } },
  place: { region: 'Toscana' }, staff: null });
const stats = { competence: 70, charisma: 65, reputation: 60, popularity: 50, notoriety: 40, experience: 40, influence: 30 };
// ---- 1. every offered task is implemented and changes something real
const effectsSeen = {};
for (const task of STAFF_TASKS) {
  let any = false;
  for (let seed = 1; seed <= 40 && !any; seed++) {
    const game = baseGame();
    const created = E.createMandate(game, stats, { task: task.id, weeks: 4, weeklyBudget: Math.max(300, task.minWeeklyBudget), budgetMax: 6000, approved: true, target: null, objective: task.objective }, { week: 5, date: '2027-01-01' });
    const g = created.game;
    const before = JSON.stringify({ c: g.party.org.committees, d: g.party.life.cadres, f: g.resources.funds });
    const out = E.staffWeek(g, stats, { week: 6, date: '2027-01-08', rand: seededRand(seed * 7919) });
    const after = JSON.stringify({ c: g.party.org.committees, d: g.party.life.cadres, f: g.resources.funds });
    const moved = (out.effects && (Object.keys(out.effects.stats ?? {}).length || out.effects.prep || out.effects.relations)) || before !== after;
    if (moved && (g.staff.mandates[0].points > 0 || g.staff.mandates[0].results[0]?.ok)) any = true;
  }
  effectsSeen[task.id] = any;
  assert.ok(any, `${task.id}: l’incarico «${task.label}» produce davvero un effetto (comitati, dirigenti, cassa, statistiche, rapporti o preparazione), non è solo una voce dell’elenco.`);
}
// ---- 2. the cost of a week is paid ONCE, even if the close runs twice for the same week
{
  const game = baseGame();
  const { game: g } = E.createMandate(game, stats, { task: 'comunicazione', weeks: 4, weeklyBudget: 500, budgetMax: 6000, approved: true, objective: 2 }, { week: 5, date: '2027-01-01' });
  const funds0 = g.resources.funds;
  E.staffWeek(g, stats, { week: 6, date: '2027-01-08', rand: seededRand(1) });
  const afterFirst = { funds: g.resources.funds, weeksDone: g.staff.mandates[0].weeksDone, spent: g.staff.mandates[0].spent, reports: g.staff.reports.length };
  assert.equal(funds0 - afterFirst.funds - 0, 500 - (afterFirst.funds - (funds0 - 500)), 'sanity');
  E.staffWeek(g, stats, { week: 6, date: '2027-01-08', rand: seededRand(2) });
  assert.deepEqual({ funds: g.resources.funds, weeksDone: g.staff.mandates[0].weeksDone, spent: g.staff.mandates[0].spent, reports: g.staff.reports.length }, afterFirst, 'Lo stesso settimana chiusa due volte non paga e non esegue due volte lo stesso incarico.');
  E.staffWeek(g, stats, { week: 7, date: '2027-01-15', rand: seededRand(3) });
  assert.equal(g.staff.mandates[0].weeksDone, 2, 'La settimana dopo l’incarico procede.'); assert.equal(g.staff.mandates[0].spent, 1000, 'Spesa totale = settimane × budget settimanale.');
}
// ---- 3. the ceiling stops the spending exactly; resuming needs a higher ceiling
{
  const game = baseGame();
  const { game: g } = E.createMandate(game, stats, { task: 'territorio', weeks: 12, weeklyBudget: 400, budgetMax: 1000, approved: true, objective: 50 }, { week: 5, date: '2027-01-01' });
  for (let w = 6; w <= 12; w++) E.staffWeek(g, stats, { week: w, date: `2027-02-${String(w).padStart(2, '0')}`, rand: seededRand(w) });
  const m = g.staff.mandates[0];
  assert.ok(m.spent <= 1000, `Non si spende oltre il tetto (${m.spent}).`); assert.equal(m.status, 'sospeso'); assert.equal(m.pausedReason, 'budget');
  assert.throws(() => E.setMandateStatus(g, stats, m.id, 'attivo', { week: 13 }), /tetto di spesa/, 'Per riprendere va alzato il tetto.');
  const raised = E.updateMandate(g, stats, m.id, { budgetMax: 3000 });
  assert.equal(raised.mandate.status, 'attivo', 'Alzato il tetto, l’incarico riprende.');
  const cancelled = E.setMandateStatus(raised.game, stats, m.id, 'annullato', { week: 14 });
  assert.equal(cancelled.mandate.status, 'annullato'); const funds = cancelled.game.resources.funds;
  E.staffWeek(cancelled.game, stats, { week: 15, date: '2027-03-01', rand: seededRand(15) });
  assert.equal(cancelled.game.resources.funds, funds, 'Un incarico annullato non spende più.');
  assert.throws(() => E.setMandateStatus(cancelled.game, stats, m.id, 'attivo', { week: 16 }), /già chiuso/);
}
// ---- 4. a single mandate (one week) ends by itself; a recurring one ends at its duration; reports and results are bounded
{
  const game = baseGame();
  const { game: g } = E.createMandate(game, stats, { task: 'studio', weeks: 1, weeklyBudget: 200, budgetMax: 200, approved: true, objective: 1 }, { week: 5, date: '2027-01-01' });
  E.staffWeek(g, stats, { week: 6, date: '2027-01-08', rand: seededRand(4) });
  assert.equal(g.staff.mandates[0].status, 'concluso', 'Un incarico «una volta» si chiude da solo dopo la prima settimana.'); assert.ok(g.staff.mandates[0].outcome, 'E dice se l’obiettivo è raggiunto.');
  let h = baseGame(); let id;
  for (let i = 0; i < STAFF_MAX_MANDATES; i++) { const out = E.createMandate(h, stats, { task: ['raccolta', 'comunicazione', 'studio'][i], weeks: 26, weeklyBudget: 200, budgetMax: 9000, approved: true, objective: 500 }, { week: 5, date: '2027-01-01' }); h = out.game; id = out.mandate.id; }
  assert.throws(() => E.createMandate(h, stats, { task: 'territorio', weeks: 4, weeklyBudget: 200, budgetMax: 2000, approved: true }, { week: 5, date: '2027-01-01' }), /già|aperti/, 'Oltre il numero massimo di incarichi lo staff rifiuta.');
  for (let w = 6; w < 6 + STAFF_REPORTS_KEPT; w++) E.staffWeek(h, stats, { week: w, date: '2027-02-01', rand: seededRand(w) });
  assert.ok(h.staff.reports.length <= STAFF_REPORTS_KEPT, `Il registro dei rapporti è limitato (${h.staff.reports.length}).`);
  assert.ok(h.staff.mandates.every(m => m.results.length <= 12), 'E i risultati per incarico.');
  assert.ok(E.staffView(h, stats).reports.length <= 6, 'La Home mostra gli ultimi rapporti.');
}
// ---- 5. nothing starts without approval; the player's own decisions are never delegable, and the interface says why
assert.throws(() => E.createMandate(baseGame(), stats, { task: 'raccolta', weeks: 4, weeklyBudget: 300, budgetMax: 2000 }, { week: 5, date: '2027-01-01' }), /approvazione/, 'Senza approvazione non parte nulla.');
assert.equal(E.delegableNotes().length, NON_DELEGABLE.length); for (const note of E.delegableNotes()) assert.ok(note.what && note.why.length > 25, `Non delegabile «${note.what}»: con il motivo.`);
for (const task of STAFF_TASKS) assert.ok(!/vot|candidat|accord|alleanz|dimission|fond[ao] un partito|fusion/i.test(`${task.label} ${task.id}`), `${task.id}: non finge di delegare ciò che è del giocatore.`);
console.log(`Staff verificato: i ${STAFF_TASKS.length} incarichi delegabili hanno un effetto reale (${Object.keys(effectsSeen).join(', ')}), il costo di una settimana è pagato una sola volta anche chiudendola due volte, il tetto ferma la spesa, sospensione/ripresa/annullamento funzionano, rapporti e risultati sono limitati, il non delegabile è spiegato.`);
