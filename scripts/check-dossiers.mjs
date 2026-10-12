// The dossiers of the ministers and the balance of the programme: each minister who is not the player's takes on an objective in his field with a term; the result is read from
// what the game really did (a law of the majority in the matter, the level of a sector in the country), moves minister, Government and group once, reaches the news and the agenda,
// and the Prime Minister can help, extend or withdraw a dossier. Same game, same dossiers; old saves read; the invariants hold.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const dossiers = await import(`../src/core/dossier-engine.js${v}`);
const rules = await import(`../src/data/simulation/dossier-rules.js${v}`);
const parliamentEngine = await import(`../src/core/parliament-engine.js${v}`);
const societyEngine = await import(`../src/core/society-engine.js${v}`);
const { checkInvariants } = await import(`../src/core/invariants.js${v}`);
const ui = await import(`../src/ui/dossier-view.js${v}`);
const bad = text => /undefined|NaN|\[object|Infinity/.test(text.replace(/data-[a-z-]+="[^"]*"/g, ''));
const copy = value => JSON.parse(JSON.stringify(value));
const addWeeks = (date, weeks) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + weeks * 7); return value.toISOString().slice(0, 10); };

// ---------- 1. a Government led by others: the ministers take on dossiers by themselves ----------
async function aiCareer(seed, weeks) {
  const run = await startCareer({ seed, level: 'deputato' });
  for (let i = 0; i < weeks; i++) run.store.advance(7);
  return run;
}
const run = await aiCareer('dossier-1', 34);
const { store } = run;
const st = () => store.getState();
const government = () => st().parliament.government;
assert.equal(government().status, 'active', 'Il governo è in carica.');
const all = dossiers.dossiersOf(government());
assert.ok(all.length >= 3, `Dopo otto mesi i ministri hanno preso in carico dei dossier (${all.length}).`);
assert.ok(dossiers.openDossiers(government()).length <= rules.DOSSIER_RULES.maxOpen, 'Non più di sei dossier aperti insieme.');
const ids = new Set(all.map(item => item.id));
assert.equal(ids.size, all.length, 'Nessun dossier duplicato.');
const ministerIds = new Set(government().ministers.map(item => item.id));
for (const dossier of all) {
  assert.ok(ministerIds.has(dossier.ministerId) && dossier.portfolio && ['riforma', 'emergenza'].includes(dossier.kind) && Number.isFinite(dossier.progress), `${dossier.id}: ministro, tipo e avanzamento.`);
  assert.equal(dossier.due, addWeeks(dossier.openedDate, dossier.termWeeks), 'La scadenza è l’apertura più il termine.');
  if (dossier.kind === 'emergenza') assert.ok(dossier.goal > dossier.start && dossier.goal <= rules.DOSSIER_RULES.areaCap, 'Un’emergenza ha un obiettivo sopra il livello di partenza.');
}
for (const id of ministerIds) assert.ok(dossiers.openDossiers(government()).filter(item => item.ministerId === id).length <= 1, 'Un ministro, un dossier aperto alla volta.');
assert.ok(all.some(item => ['riuscito', 'fallito'].includes(item.status)), 'Alcuni dossier si sono già chiusi, riusciti o falliti.');
assert.ok(st().parliament.history.some(entry => entry.type === 'dossier-aperto') && st().parliament.history.some(entry => entry.type === 'dossier-esito'), 'Aperture ed esiti sono nel registro del Parlamento.');
// The same career, the same dossiers.
const twin = await aiCareer('dossier-1', 34);
assert.deepEqual(dossiers.dossiersOf(twin.store.getState().parliament.government).map(item => [item.id, item.status, item.progress]), all.map(item => [item.id, item.status, item.progress]), 'Stessa carriera, stessi dossier.');
assert.deepEqual(checkInvariants(st()).issues, [], 'Gli invarianti reggono.');
const aiSave = store.exportSave();

// ---------- 2. a result is read from the game, and moves minister, Government and group once ----------
const base = copy(st());
const open = dossiers.openDossiers(base.parliament.government).find(item => item.kind === 'riforma');
assert.ok(open, 'C’è una riforma aperta da portare in porto.');
const ctxOf = (state, extra = {}) => ({ date: state.clock.currentDate, week: state.game.week.index, society: state.society, margin: 6, ...extra });
const ministerOf = (state, id) => state.parliament.government.ministers.find(item => item.id === id);
// A measure of the same area that does not come from a bill of the majority does not close the reform (nothing links it to the dossier).
{
  const state = copy(base);
  state.parliament.laws = state.parliament.laws.filter(law => law.policy?.area !== open.area);
  state.society.lawsApplied = [{ title: 'Misura altrui', category: AREA_LABEL(open.area), area: open.area, week: open.openedWeek + 1, date: state.clock.currentDate, origin: 'governo', lawId: 'legge-di-un-altro', controversy: 0.2, covered: true, cost: 1 }, { title: 'Misura senza legge', category: AREA_LABEL(open.area), area: open.area, week: open.openedWeek + 1, date: state.clock.currentDate, origin: 'governo', controversy: 0.2, covered: true, cost: 1 }, ...state.society.lawsApplied];
  const out = dossiers.tickDossiers(state.parliament, ctxOf(state));
  assert.equal(dossiers.dossiersOf(out.parliament.government).find(item => item.id === open.id).status, 'aperto', 'Una legge della stessa area ma non del dossier non lo chiude.');
}
// A measure on the matter, born from a bill of the majority, is enacted: the dossier succeeds.
{
  const state = copy(base);
  state.parliament.laws = [{ id: 'legge-prova-dossier', title: 'Riforma di prova', kind: 'disegno', origin: 'governo', sponsor: { kind: 'governo' }, policy: { area: open.area }, introducedAt: open.openedDate, stage: 'approved', status: 'approved' }, ...state.parliament.laws];
  state.society.lawsApplied = [{ title: 'Riforma di prova', category: AREA_LABEL(open.area), area: open.area, week: open.openedWeek + 1, date: state.clock.currentDate, origin: 'governo', lawId: 'legge-prova-dossier', controversy: 0.2, covered: true, cost: 1 }, ...state.society.lawsApplied];
  const before = ministerOf(state, open.ministerId), stabilityBefore = state.parliament.government.stability, partnerBefore = state.parliament.government.partners?.[open.groupId]?.satisfaction;
  const out = dossiers.tickDossiers(state.parliament, ctxOf(state));
  const done = dossiers.dossiersOf(out.parliament.government).find(item => item.id === open.id);
  assert.equal(done.status, 'riuscito', 'Una misura nella materia chiude il dossier.');
  assert.equal(out.settled.length >= 1 && out.settled.some(item => item.dossier.id === open.id && item.outcome === 'riuscito'), true, 'Il risultato è comunicato.');
  const after = ministerOf({ parliament: out.parliament }, open.ministerId);
  assert.equal(after.loyalty, Math.min(100, before.loyalty + rules.DOSSIER_RULES.success.loyalty), 'Il ministro è più leale.');
  assert.equal(after.dossiers.done, 1, 'E ha un dossier riuscito in più.');
  assert.ok(out.parliament.government.stability >= stabilityBefore, 'La stabilità non scende.');
  if (partnerBefore !== undefined) assert.equal(out.parliament.government.partners[open.groupId].satisfaction, Math.round(Math.min(100, partnerBefore + rules.DOSSIER_RULES.success.partner) * 10) / 10, 'Il gruppo del ministro è più soddisfatto.');
  // Once: another week changes nothing more for that dossier.
  const again = dossiers.tickDossiers(out.parliament, ctxOf(state, { week: state.game.week.index + 1 }));
  assert.equal(ministerOf({ parliament: again.parliament }, open.ministerId).loyalty, after.loyalty, 'Un risultato pesa una volta sola.');
  assert.equal(out.parliament.history.filter(entry => entry.type === 'dossier-esito' && entry.details.dossierId === open.id).length, 1, 'Un solo esito nel registro.');
}
// The term passes with nothing done: a minister with most of the way done asks for time once, one with nothing fails and is to blame (or the majority, or the circumstances).
{
  const state = copy(base);
  state.society.lawsApplied = state.society.lawsApplied.filter(item => item.area !== open.area);
  state.parliament.laws = state.parliament.laws.filter(law => law.policy?.area !== open.area);
  state.parliament.government.dossiers = state.parliament.government.dossiers.map(item => item.id === open.id ? { ...item, due: addWeeks(state.clock.currentDate, -1) } : item);
  const before = ministerOf(state, open.ministerId);
  const out = dossiers.tickDossiers(state.parliament, ctxOf(state));
  const failed = dossiers.dossiersOf(out.parliament.government).find(item => item.id === open.id);
  assert.equal(failed.status, 'fallito', 'Senza nulla di fatto alla scadenza il dossier fallisce.');
  assert.ok(['ministro', 'maggioranza', 'circostanze'].includes(failed.blame), 'E ha un responsabile dichiarato.');
  const after = ministerOf({ parliament: out.parliament }, open.ministerId);
  assert.equal(after.loyalty, Math.max(0, before.loyalty + rules.DOSSIER_RULES.failure.loyalty), 'Il ministro perde lealtà.');
  assert.equal(after.pressure, 1, 'E finisce sotto pressione.');
  assert.ok(out.parliament.government.stability <= state.parliament.government.stability, 'Il governo ne risente.');
  const blamed = dossiers.tickDossiers(copyWith(state, { margin: 1 }).parliament, ctxOf(state, { margin: 1 }));
  assert.ok(['ministro', 'maggioranza'].includes(dossiers.dossiersOf(blamed.parliament.government).find(item => item.id === open.id).blame), 'Con una maggioranza di un seggio la colpa non è delle circostanze.');
  // With most of the way done he asks for more time, once.
  const half = copy(state);
  half.parliament.laws = [...half.parliament.laws, { id: 'legge-prova-x', title: 'Testo avanzato', origin: 'governo', kind: 'ddl', stage: 'final-vote', introducedAt: open.openedDate, policy: { area: open.area }, votes: [] }];
  const asked = dossiers.tickDossiers(half.parliament, ctxOf(half));
  const postponed = dossiers.dossiersOf(asked.parliament.government).find(item => item.id === open.id);
  assert.ok(postponed.status === 'rinviato' && postponed.postponed === 1 && postponed.due > postponed.originalDue && postponed.progress >= rules.DOSSIER_RULES.autoPostponeAt, 'Con l’85% fatto il ministro ottiene una proroga, una volta.');
  assert.ok(asked.parliament.history.some(entry => entry.type === 'dossier-rinvio'), 'La proroga è nel registro.');
}
function AREA_LABEL(area) { return area; }
function copyWith(state, extra) { return { ...copy(state), ...extra }; }
// An emergency dossier is read on the country: the level of the sector.
{
  const state = copy(base);
  const area = 'europa';
  const level = societyEngine.areaValue(state.society, area);
  const minister = state.parliament.government.ministers.find(item => !item.playerAppointed && item.endedAt === undefined);
  const made = { id: 'dossier-prova-e', kind: 'emergenza', origin: 'emergenza', area, areaLabel: 'Europa', portfolio: minister.portfolio, ministerId: minister.id, groupId: minister.groupId ?? null, title: 'Emergenza: europa', openedWeek: 1, openedDate: state.clock.currentDate, due: addWeeks(state.clock.currentDate, 20), termWeeks: 26, status: 'aperto', progress: 0, postponed: 0, funded: false, drafted: false, alarmed: false, start: level - 2, goal: level + 4, source: 'simulation' };
  state.parliament.government.dossiers = [made, ...state.parliament.government.dossiers.filter(item => item.ministerId !== minister.id)];
  assert.equal(dossiers.dossierProgress(made, { parliament: state.parliament, society: state.society }).value, 33, 'Il cammino è la distanza percorsa dal livello di partenza all’obiettivo.');
  state.society.areas[area] = { ...(state.society.areas[area] ?? {}), value: level + 6 };
  const out = dossiers.tickDossiers(state.parliament, ctxOf(state));
  assert.equal(dossiers.dossiersOf(out.parliament.government).find(item => item.id === 'dossier-prova-e').status, 'riuscito', 'Raggiunto il livello obiettivo nel Paese, il dossier riesce.');
}

// ---------- 3. the Prime Minister helps, extends or withdraws a dossier ----------
const reform = open;
{
  const state = copy(base);
  const draft = dossiers.draftDossierBill(state.parliament, reform.id, state.clock.currentDate);
  assert.ok(draft.law.origin === 'governo' && draft.law.policy.area === reform.area && draft.law.stage === 'proposal', 'Il testo del ministro è un disegno di legge del governo nella materia.');
  assert.ok(dossiers.dossiersOf(draft.parliament.government).find(item => item.id === reform.id).drafted, 'Il dossier segna il testo presentato.');
  assert.throws(() => dossiers.draftDossierBill(draft.parliament, reform.id, state.clock.currentDate), /già/, 'Il testo si prepara una volta.');
  assert.throws(() => dossiers.fundDossier(state.parliament, state.society, reform.id, { week: 1 }), /non una riforma|riforma si porta|Solo un settore/i, 'Una riforma non si finanzia.');
  const progress = dossiers.dossierProgress(dossiers.dossiersOf(draft.parliament.government).find(item => item.id === reform.id), { parliament: draft.parliament, society: state.society });
  assert.ok(progress.value >= 10 && progress.lawId === draft.law.id, 'Il testo presentato fa avanzare il dossier (10% alla presentazione).');
  const late = dossiers.postponeDossier(state.parliament, reform.id, state.clock.currentDate);
  const posted = dossiers.dossiersOf(late.government ? late : late).find?.(item => item.id === reform.id) ?? dossiers.dossiersOf(late.government).find(item => item.id === reform.id);
  assert.ok(posted.status === 'rinviato' && posted.due > reform.due, 'Più tempo: la scadenza slitta.');
  assert.throws(() => dossiers.postponeDossier(late, reform.id, state.clock.currentDate), /già stato rinviato/, 'Una proroga sola.');
  const gone = dossiers.withdrawDossier(state.parliament, reform.id, state.clock.currentDate, 5);
  assert.equal(dossiers.dossiersOf(gone.government).find(item => item.id === reform.id).status, 'ritirato', 'Il dossier ritirato è chiuso.');
  assert.ok(ministerOf({ parliament: gone }, reform.ministerId).loyalty < ministerOf(state, reform.ministerId).loyalty, 'Il ministro ci resta male.');
}
// Money for a sector: paid once from the fiscal margin, it raises the sector in the weeks that follow.
{
  const state = copy(base);
  const minister = state.parliament.government.ministers.find(item => !item.playerAppointed && !item.endedAt);
  const area = 'europa', level = societyEngine.areaValue(state.society, area);
  const made = { id: 'dossier-prova-f', kind: 'emergenza', origin: 'emergenza', area, areaLabel: 'Europa', portfolio: minister.portfolio, ministerId: minister.id, groupId: minister.groupId ?? null, title: 'Emergenza: europa', openedWeek: 1, openedDate: state.clock.currentDate, due: addWeeks(state.clock.currentDate, 20), termWeeks: 26, status: 'aperto', progress: 0, postponed: 0, funded: false, drafted: false, alarmed: false, start: level, goal: level + 8, source: 'simulation' };
  state.parliament.government.dossiers = [made];
  const headroom = state.society.publicFinance.headroom;
  const out = dossiers.fundDossier(state.parliament, state.society, made.id, { week: 2 });
  assert.equal(out.society.publicFinance.headroom, Math.round((headroom - rules.DOSSIER_RULES.fund.cost) * 10) / 10, 'Il finanziamento si paga dal margine di bilancio.');
  assert.ok(out.society.effects.some(effect => effect.area === area && effect.perWeek > 0 && /Dossier/.test(effect.cause)), 'E mette in moto un effetto sul settore.');
  assert.throws(() => dossiers.fundDossier(out.parliament, out.society, made.id, { week: 3 }), /già stato finanziato/, 'Una volta sola.');
  const poor = copy(state.society); poor.publicFinance.headroom = 1;
  assert.throws(() => dossiers.fundDossier(state.parliament, poor, made.id, { week: 2 }), /margine di bilancio/, 'Senza margine non si finanzia.');
  // The effect works: weeks of the society engine raise the level.
  let world = out.society;
  const start = societyEngine.areaValue(world, area);
  for (let week = 0; week < 10; week++) world = societyEngine.advanceSociety(world, { date: state.clock.currentDate, week: state.game.week.index + week + 1 }).society;
  assert.ok(societyEngine.areaValue(world, area) > start, 'Dopo qualche settimana il settore è più alto.');
}

// ---------- 4. the programme against the measures ----------
{
  const state = copy(base);
  const priorities = ['sanita', 'lavoro', 'sicurezza'];
  state.parliament.government.program = { line: 'crescita', priorities, setAt: addWeeks(state.clock.currentDate, -(rules.DOSSIER_RULES.program.weeks + 1)), source: 'simulation' };
  state.parliament.laws = state.parliament.laws.filter(law => !priorities.includes(law.policy?.area));
  state.society.lawsApplied = [];
  const empty = dossiers.programReport(state.parliament, state.society, state.clock.currentDate);
  assert.deepEqual(empty.rows.map(row => row.status), ['ferma', 'ferma', 'ferma'], 'Senza misure il programma è fermo.');
  const stability = state.parliament.government.stability;
  const bad = dossiers.settleProgram(state.parliament, state.society, state.clock.currentDate);
  assert.ok(bad.report.share === 0 && bad.parliament.government.stability === Math.max(0, stability + rules.DOSSIER_RULES.program.badStability) && bad.parliament.history.some(entry => entry.type === 'programma-bilancio'), 'Un programma lasciato fermo pesa sul governo, e il bilancio resta nel registro.');
  assert.equal(dossiers.settleProgram(bad.parliament, state.society, state.clock.currentDate).report, null, 'Il bilancio si fa una volta.');
  state.society.lawsApplied = ['sanita', 'lavoro'].map(area => ({ title: `Misura ${area}`, category: area, area, week: 1, date: state.clock.currentDate, origin: 'governo', controversy: 0.1, covered: true, cost: 1 }));
  assert.deepEqual(dossiers.programReport(state.parliament, state.society, state.clock.currentDate).rows.map(row => row.status), ['ferma', 'ferma', 'ferma'], 'Una misura senza un disegno di legge della maggioranza non attua una priorità.');
  state.parliament.laws = [...['sanita', 'lavoro'].map(area => ({ id: `legge-${area}`, title: `Misura ${area}`, kind: 'disegno', origin: 'governo', sponsor: { kind: 'governo' }, policy: { area }, introducedAt: state.parliament.government.program.setAt, stage: 'approved', status: 'approved' })), ...state.parliament.laws];
  state.society.lawsApplied = state.society.lawsApplied.map(item => ({ ...item, lawId: `legge-${item.area}` }));
  const good = dossiers.settleProgram(state.parliament, state.society, state.clock.currentDate);
  assert.ok(good.report.share >= rules.DOSSIER_RULES.program.good && good.parliament.government.stability === Math.min(100, stability + rules.DOSSIER_RULES.program.goodStability), 'Due priorità su tre attuate rafforzano il governo.');
  const early = copy(state); early.parliament.government.program.setAt = addWeeks(state.clock.currentDate, -3);
  assert.equal(dossiers.settleProgram(early.parliament, early.society, state.clock.currentDate).report, null, 'Troppo presto per un bilancio.');
}

// ---------- 5. in the game: the agenda, the news, the save ----------
async function premierCareer(seed) {
  const career = await startCareer({ seed, level: 'deputato' });
  career.store.advance(7);
  const save = JSON.parse(career.store.exportSave());
  const group = save.parliament.player.groupId;
  const allies = save.parliament.government.coalitionGroupIds.filter(id => id !== group);
  let parliament = { ...save.parliament, government: null };
  parliament = parliamentEngine.formGovernment({ ...parliament, resources: { ...parliament.resources, politicalCapital: 90 } }, [group, ...allies], save.clock.currentDate);
  save.parliament = { ...parliament, government: { ...parliament.government, formedBy: 'player', premierGroupId: group } };
  save.game.resources.politicalCapital = 90;
  save.society.crisisSeverity = 0;
  career.store.loadGame(save);
  career.store.advance(7);
  career.store.voteGovernmentConfidence?.();
  return career;
}
const pm = await premierCareer('dossier-pm');
const pmStore = pm.store;
const pmState = () => pmStore.getState();
assert.equal(pmState().parliament.government.primeMinister, 'player', 'Il giocatore guida il governo.');
const edit = change => { const save = JSON.parse(pmStore.exportSave()); change(save); pmStore.loadGame(save); };
const hold = () => edit(save => { Object.assign(save.parliament.government, { stability: 95, crisisSeverity: 0, status: 'active' }); save.game.week.ap = 12; save.game.resources.politicalCapital = 90; });
// A minister of the Prime Minister's own Government with a dossier past half of its term.
edit(save => {
  const group = save.parliament.government.coalitionGroupIds.find(id => id !== save.parliament.player.groupId) ?? save.parliament.player.groupId;
  const minister = { id: 'nomina-prova-1', portfolio: 'Salute', groupId: group, groupName: 'Gruppo di prova', playerAppointed: false, appointeeLabel: 'Incarico simulato', loyalty: 60, competence: 70, source: 'simulation', appointedAt: save.clock.currentDate };
  save.parliament.government.ministers = [minister];
  save.parliament.government.program = { line: 'crescita', priorities: ['sanita', 'lavoro'], setAt: addWeeks(save.clock.currentDate, -3), source: 'simulation' };
  const level = societyEngine.areaValue(save.society, 'sanita');
  save.parliament.government.dossiers = [{ id: 'dossier-pm-1', kind: 'emergenza', origin: 'emergenza', area: 'sanita', areaLabel: 'Sanità', portfolio: 'Salute', ministerId: minister.id, groupId: group, title: 'Emergenza: sanità', openedWeek: save.game.week.index - 15, openedDate: addWeeks(save.clock.currentDate, -15), due: addWeeks(save.clock.currentDate, 11), termWeeks: 26, status: 'aperto', progress: 0, postponed: 0, funded: false, drafted: false, alarmed: false, start: level, goal: Math.min(92, level + 8), source: 'simulation' },
    { id: 'dossier-pm-2', kind: 'riforma', origin: 'programma', area: 'lavoro', areaLabel: 'Lavoro', portfolio: 'Lavoro', ministerId: minister.id, groupId: group, title: 'Riforma: lavoro', openedWeek: save.game.week.index - 18, openedDate: addWeeks(save.clock.currentDate, -18), due: addWeeks(save.clock.currentDate, 12), termWeeks: 30, status: 'aperto', progress: 0, postponed: 0, funded: false, drafted: false, alarmed: false, source: 'simulation' }];
});
hold(); pmStore.advance(7);
const alarm = pmState().game.inbox.find(item => item.templateId === 'dossier-emergenza');
assert.ok(alarm && alarm.choices.map(choice => choice.id).join() === 'finanzia,rinvia,ritira,attendi' && alarm.params.dossierId === 'dossier-pm-1', 'A metà del termine un dossier in ritardo arriva in agenda, con quattro risposte.');
assert.ok(pmState().game.inbox.some(item => item.templateId === 'dossier-riforma' && item.params.dossierId === 'dossier-pm-2'), 'Anche una riforma ferma chiede una decisione.');
const headroom = pmState().society.publicFinance.headroom;
hold(); pmStore.resolveAgendaItem(alarm.id, 'finanzia');
const funded = dossiers.dossiersOf(pmState().parliament.government).find(item => item.id === 'dossier-pm-1');
assert.ok(funded.funded && pmState().society.publicFinance.headroom < headroom && pmState().society.effects.some(effect => effect.area === 'sanita' && /Dossier/.test(effect.cause)), 'La risposta «finanzia» paga dal margine e muove il settore.');
// The same through the Government page (actions of the Prime Minister).
hold(); pmStore.dossierAction('draft', 'dossier-pm-2');
const drafted = pmState().parliament.laws.find(law => law.origin === 'governo' && law.policy?.area === 'lavoro');
assert.ok(drafted && dossiers.dossiersOf(pmState().parliament.government).find(item => item.id === 'dossier-pm-2').drafted, 'Il testo del ministro diventa un disegno di legge del governo.');
// What the reader sees.
const html = ui.dossierPanel(pmState());
assert.ok(/I dossier dei ministri/.test(html) && /data-dossier-action="postpone"/.test(html) && /Il programma di governo alla prova/.test(html) && !bad(html), 'La pagina del governo mostra dossier, azioni e programma.');
// Back to the career of a Government led by others: nobody but the Prime Minister decides on the dossiers, and everyone else reads them.
const pmSaved = pmStore.exportSave();
pmStore.loadGame(JSON.parse(aiSave));
assert.throws(() => store.dossierAction('fund', 'x'), /Presidente del Consiglio/, 'Solo chi guida il governo decide sui dossier.');
const readOnly = ui.dossierPanel(st());
assert.ok(/dossier-row/.test(readOnly) && !/data-dossier-action/.test(readOnly) && !bad(readOnly), 'Chi non guida il governo legge i dossier senza poterli decidere.');
// The news tell the outcomes.
const outcomes = st().society.media.articles.filter(item => item.key.startsWith('storia:') && /dossier/i.test(item.headline));
assert.ok(outcomes.length >= 1 && outcomes.every(item => item.category === 'governo' && item.body.length >= 2), 'Gli esiti dei dossier diventano articoli della redazione.');
// A save carries the dossiers; a save from before them reads and the ministers start again.
pmStore.loadGame(JSON.parse(pmSaved));
assert.equal(JSON.stringify(dossiers.dossiersOf(pmState().parliament.government)), JSON.stringify(dossiers.dossiersOf(JSON.parse(pmSaved).parliament.government)), 'Dopo il ricaricamento i dossier sono gli stessi.');
assert.deepEqual(checkInvariants(pmState()).issues, [], 'Invarianti con i dossier del Presidente del Consiglio.');
pmStore.loadGame(JSON.parse(aiSave));
const old = JSON.parse(store.exportSave());
delete old.parliament.government.dossiers; for (const minister of old.parliament.government.ministers) { delete minister.pressure; delete minister.dossiers; delete minister.nextDossierWeek; }
store.loadGame(old);
for (let i = 0; i < 12; i++) store.advance(7);
assert.ok(dossiers.dossiersOf(government()).length >= 1, 'Un salvataggio senza dossier li riceve nelle settimane successive.');
assert.deepEqual(checkInvariants(st()).issues, [], 'Invarianti dopo la migrazione.');
console.log('Dossier dei ministri verificati: ogni ministro non del giocatore prende in carico un obiettivo con termine (riforma da portare in porto, settore da rimettere in sesto), uno alla volta e entro il limite; il risultato si legge dai fatti (una legge della maggioranza nella materia, il livello del settore nel Paese), pesa una volta su ministro, governo e gruppo con un responsabile dichiarato, proroga una tantum; il Presidente del Consiglio decide in agenda o sulla pagina (finanziare dal margine, far preparare il testo, più tempo, ritirare); bilancio del programma una sola volta; esiti in cronaca e registro; salvataggi vecchi e nuovi coerenti.');
process.exit(0);
