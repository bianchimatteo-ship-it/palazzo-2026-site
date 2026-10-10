// The Prime Minister's money: the budget by sector with its economic levers (sliders), the concrete projects (proposal, financing, works, delays, overruns, results), the European
// funds (requirements, cofinancing, deadlines, reports) and the decisions they put on the desk. Every decision changes the state of the country, survives a save and a reload, and
// goes through the weeks of the ordinary engine.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer, fingerprint } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const parliamentEngine = await import(`../src/core/parliament-engine.js${v}`);
const societyEngine = await import(`../src/core/society-engine.js${v}`);
const projects = await import(`../src/core/project-engine.js${v}`);
const rules = await import(`../src/data/simulation/project-rules.js${v}`);
const { checkInvariants } = await import(`../src/core/invariants.js${v}`);
const parliamentUi = await import(`../src/ui/parliament-mode.js${v}`);
const policyUi = await import(`../src/ui/policy-mode.js${v}`);

// A career that leads the Government: the reference coalition with the player as Prime Minister.
async function premierCareer(seed) {
  const run = await startCareer({ seed, level: 'deputato' });
  const { store } = run;
  store.advance(7);
  const save = JSON.parse(store.exportSave());
  const group = save.parliament.player.groupId;
  const allies = save.parliament.government.coalitionGroupIds.filter(id => id !== group);
  let parliament = { ...save.parliament, government: null };
  parliament = parliamentEngine.formGovernment({ ...parliament, resources: { ...parliament.resources, politicalCapital: 90 } }, [group, ...allies], save.clock.currentDate);
  save.parliament = { ...parliament, government: { ...parliament.government, formedBy: 'player', premierGroupId: group } };
  save.game.resources.politicalCapital = 90;
  save.society.crisisSeverity = 0;
  store.loadGame(save);
  store.advance(7);
  store.voteGovernmentConfidence?.();
  assert.equal(store.getState().parliament.government.primeMinister, 'player', 'Il giocatore guida il governo.');
  return run;
}
const edit = (store, change) => { const save = JSON.parse(store.exportSave()); change(save); store.loadGame(save); };
// The desk of the week is refilled before each action: the test is about what the actions do, not about the days of the week.
const run = await premierCareer('premier-bilancio');
const { store } = run;
const st = () => store.getState();
// The Government holds through the weeks (the test is about the money, not about the majority).
const advance = () => { edit(store, save => { Object.assign(save.parliament.government, { stability: 95, crisisSeverity: 0, status: 'active' }); }); store.advance(7); };
const api = Object.fromEntries(['proposeProject', 'setProjectFunding', 'stopProject', 'applyEuCall', 'reportEuCall', 'presentBudget'].map(name => [name, (...args) => { edit(store, save => { save.game.week.ap = 12; save.game.resources.politicalCapital = 90; }); return store[name](...args); }]));
const sentence = text => text.replace(/data-[a-z-]+="[^"]*"/g, '');

// ---------- 1. the budget by sector and its levers ----------
const society = st().society;
const plan = { sectors: { sanita: 3, scuola: 1, ricerca: -2 }, levers: { accise: 2, agevolazioni: 2, sanzioni: 1, regole: -1 }, taxes: -1 };
const impact = societyEngine.budgetImpact(society, plan);
assert.equal(impact.rows.length, rules.BUDGET_SECTORS.length, 'Un cursore per ognuno degli otto settori.');
assert.ok(impact.spending > 0 && impact.rows.find(row => row.id === 'sanita').billions > 0 && impact.rows.find(row => row.id === 'ricerca').billions < 0, 'Stanziamenti e tagli hanno un segno e un costo in miliardi.');
// Cover: every lever moves the deficit the way its description says.
const deficitOf = change => societyEngine.budgetImpact(society, change).deficit;
assert.ok(deficitOf({ sectors: { sanita: 3 } }) > 0 && deficitOf({ sectors: { sanita: -3 } }) < 0, 'Più spesa, più deficit; un taglio lo riduce.');
assert.ok(deficitOf({ taxes: 2 }) < deficitOf({ taxes: 1 }) && deficitOf({ levers: { accise: 2 } }) < 0 && deficitOf({ levers: { agevolazioni: 3 } }) > 0 && deficitOf({ levers: { sanzioni: 3 } }) < 0, 'Tasse, accise e controlli riducono il deficit; le agevolazioni lo aumentano.');
assert.ok(societyEngine.budgetImpact(society, { levers: { accise: 2 } }).economy.inflation > 0 && societyEngine.budgetImpact(society, { levers: { agevolazioni: 3 } }).economy.growth > 0, 'Le accise alzano i prezzi, le agevolazioni la crescita.');
assert.deepEqual(societyEngine.normalizeBudgetPlan({ sectors: { sanita: 9 }, taxes: -9, levers: { regole: 7 } }), { ...societyEngine.normalizeBudgetPlan({}), sectors: { ...societyEngine.normalizeBudgetPlan({}).sectors, sanita: 3 }, taxes: -2, levers: { ...societyEngine.normalizeBudgetPlan({}).levers, regole: 2 } }, 'I cursori restano nella loro scala.');
// Plans written before the sectors still read: groups and one tax step.
const legacy = societyEngine.budgetImpact(society, { allocations: { welfare: 1 }, taxes: 1 });
assert.equal(legacy.taxes, 1); assert.ok(legacy.winners.length && legacy.losers.length, 'Un piano vecchio si legge ancora.');
// The law: effects arrive week after week on the areas and the territories, and keep working through the stance.
const queued = societyEngine.applyBudgetPlan(society, plan, { date: st().clock.currentDate, week: 10, title: 'Manovra di prova' });
assert.ok(queued.effects.length > society.effects.length && queued.publicFinance.budget.sectors.sanita === 3 && queued.publicFinance.stance.agevolazioni > 0, 'La manovra mette in coda effetti e ricorda l’orientamento.');
let later = queued;
for (let week = 0; week < 26; week++) later = societyEngine.advanceSociety(later, { date: '2027-03-01', week: 11 + week, government: st().parliament.government }).society;
let calm = society;
for (let week = 0; week < 26; week++) calm = societyEngine.advanceSociety(calm, { date: '2027-03-01', week: 11 + week, government: st().parliament.government }).society;
assert.ok(societyEngine.areaValue(later, 'sanita') > societyEngine.areaValue(calm, 'sanita') + 1, 'Lo stanziamento alla sanità la migliora rispetto a non farlo.');
assert.ok(societyEngine.areaValue(later, 'universita') < societyEngine.areaValue(calm, 'universita') - 1, 'Il taglio alla ricerca la peggiora.');
assert.ok(later.segments.find(item => item.id === 'imprese').mood > calm.segments.find(item => item.id === 'imprese').mood, 'Le agevolazioni scontentano meno le imprese.');
assert.equal(Object.values(societyEngine.provisionalBudget(later).publicFinance.sectors).every(level => level === 0), true, 'L’esercizio provvisorio congela anche i settori.');
// The majority reads the plan: a group that cares for health is happier with more health, and is told in the preview.
const reactions = parliamentEngine.budgetReactions(st().parliament, impact.plan);
assert.ok(reactions.length >= 2 && reactions.every(item => item.name && Number.isFinite(item.score) && item.reason), 'Ogni alleato ha un giudizio motivato sulla manovra.');
const cuts = parliamentEngine.budgetReactions(st().parliament, societyEngine.normalizeBudgetPlan({ sectors: Object.fromEntries(rules.BUDGET_SECTORS.map(sector => [sector.id, -3])) }));
const boosts = parliamentEngine.budgetReactions(st().parliament, societyEngine.normalizeBudgetPlan({ sectors: Object.fromEntries(rules.BUDGET_SECTORS.map(sector => [sector.id, 3])) }));
assert.ok(boosts.reduce((sum, item) => sum + item.score, 0) > cuts.reduce((sum, item) => sum + item.score, 0), 'Più risorse piacciono ai gruppi più dei tagli a tutto.');
// The preview and the form: sliders with value and unit, no placeholders.
const preview = policyUi.budgetPreview(society, plan, st().parliament);
assert.ok(/DEFICIT/.test(preview) && /ECONOMIA/.test(preview) && /IN PARLAMENTO/.test(preview) && !/undefined|NaN|\[object/.test(preview), 'L’anteprima mostra deficit, economia e Parlamento.');
const fields = policyUi.budgetFields(plan);
assert.equal((fields.match(/type="range"/g) ?? []).length, rules.BUDGET_SECTORS.length + rules.FISCAL_LEVERS.length, 'Un cursore per ogni settore e leva.');
assert.ok(/aria-valuetext="\+3 · \+\d/.test(fields) && /<output[^>]*data-range-out>Invariato/.test(fields), 'Ogni cursore dice il suo valore (e il costo) a chi lo usa e a chi lo ascolta.');
// The law in Parliament: the plan arrives with the sectors, and the card reads them.
edit(store, save => { save.parliament.laws = save.parliament.laws.filter(law => law.kind !== 'manovra'); });
api.presentBudget({ ...plan });
const budgetLaw = st().parliament.laws.find(law => law.kind === 'manovra' && law.stage !== 'approved');
assert.ok(budgetLaw && budgetLaw.policy.plan.sectors.sanita === 3, 'La legge di bilancio porta i settori.');
assert.match(parliamentUi.renderParliamentPage('leggi', st(), { politicians: [] }) + parliamentUi.renderParliamentPage('governo', st(), { politicians: [] }), /Sanità \+3/, 'La scheda della legge elenca i settori.');

// ---------- 2. projects: proposal, financing, validation ----------
const quote = projects.projectQuote(st().society, { type: 'ospedale', region: 'Lombardia', funding: 100 }, st().parliament.government);
assert.ok(quote.ok && quote.cost === 6 && quote.marginUse === 2.4 && quote.weeks > 40, 'Un ospedale a budget pieno: 6 punti, impegno del 40%, tempi lunghi.');
const thin = projects.projectQuote(st().society, { type: 'ospedale', region: 'Lombardia', funding: 60 }, st().parliament.government);
const rich = projects.projectQuote(st().society, { type: 'ospedale', region: 'Lombardia', funding: 140 }, st().parliament.government);
assert.ok(thin.cost < quote.cost && quote.cost < rich.cost && thin.weeks > quote.weeks && quote.weeks > rich.weeks && thin.delayRisk > quote.delayRisk && thin.quality < rich.quality, 'Il budget cambia costo, tempi, rischio di ritardo e qualità.');
assert.ok(!projects.projectQuote(st().society, { type: 'ospedale', region: 'Atlantide' }).ok && !projects.projectQuote(st().society, { type: 'ospedale', region: 'Lombardia', financing: 'ue' }).ok, 'Senza regione valida o senza bando europeo non si parte.');
assert.throws(() => api.proposeProject({ type: 'ospedale', region: 'Atlantide' }), /regione/);
const margin0 = st().society.publicFinance.headroom;
const capital0 = st().game.resources.politicalCapital;
api.proposeProject({ type: 'ospedale', region: 'Lombardia', funding: 100 });
api.proposeProject({ type: 'scuola', region: 'Campania', funding: 80 });
api.proposeProject({ type: 'ferrovia', region: 'Puglia', funding: 100 });
assert.equal(st().society.projects.length, 3);
assert.ok(st().society.publicFinance.headroom < margin0 - 5 && st().game.resources.politicalCapital < capital0, 'Le opere impegnano il margine di bilancio e capitale politico.');
assert.ok(st().society.projects.every(project => project.stage === 'progettazione' && project.progress === 0 && project.committed > 0), 'Partono dalla progettazione.');
// The budget can change before the works start, and only then.
const school = st().society.projects.find(project => project.type === 'scuola');
api.setProjectFunding(school.id, 120);
assert.equal(st().society.projects.find(project => project.id === school.id).funding, 120);
assert.throws(() => api.setProjectFunding(school.id, 120), /già a questo livello/);
// Save, reload: same projects.
const dump = store.exportSave();
store.loadGame(JSON.parse(dump));
assert.deepEqual(st().society.projects.map(project => [project.id, project.funding, project.cost]), JSON.parse(dump).society.projects.map(project => [project.id, project.funding, project.cost]), 'Le opere sopravvivono al salvataggio.');
edit(store, save => { save.society.projects[0].progress = 130; });
assert.ok(checkInvariants(st(), run.context).issues.some(item => item.code === 'opera'), 'Un avanzamento impossibile viene segnalato dai controlli di coerenza.');
store.loadGame(JSON.parse(dump));

// ---------- 3. the weeks: delays, overruns, completion, results ----------
const checkpoint = JSON.stringify(st().society.projects.map(project => project.id));
for (let week = 0; week < 8; week++) advance();
const mid = st().society.projects;
assert.ok(mid.some(project => project.progress > 5) && mid.every(project => project.progress <= 100), 'Le opere avanzano settimana dopo settimana.');
assert.equal(JSON.stringify(mid.map(project => project.id)), checkpoint);
// Funding makes the difference over many identical worlds: a thin budget slips more than a rich one.
const delays = funding => {
  let total = 0;
  for (let seed = 1; seed <= 12; seed++) {
    let world = societyEngine.normalizeSociety(JSON.parse(JSON.stringify(st().society)));
    world.rngState = seed * 7919; world.projects = []; world.publicFinance.headroom = 100;
    world = projects.proposeProject(world, { type: 'ferrovia', region: 'Toscana', funding }, { date: '2027-01-01', week: 1 }).society;
    for (let week = 2; week < 90; week++) { world.week = week; projects.projectsWeek(world, { date: '2027-06-01' }); for (const project of world.projects) if (project.pending) projects.settleProjectIssue(world, project.id, 'attendi'); }
    total += world.projects[0].delayWeeks;
  }
  return total;
};
assert.ok(delays(60) > delays(140), 'Un budget stretto accumula più ritardo di uno abbondante.');
// An overrun waits for a decision, with the four answers on the desk.
edit(store, save => { const project = save.society.projects.find(item => item.type === 'ospedale'); Object.assign(project, { stage: 'cantiere', progress: 45, pending: { kind: 'sforamento', amount: 1.4, week: save.game.week.index, raised: false, waits: 0 } }); });
const hospital = () => st().society.projects.find(project => project.type === 'ospedale');
advance();
const ask = st().game.inbox.find(item => item.templateId === 'progetto-sforamento');
assert.ok(ask && ask.choices.map(choice => choice.id).join() === 'integra,ridimensiona,sospendi,attendi' && ask.params.projectId === hospital().id, 'Lo sforamento arriva in agenda con quattro risposte.');
const costBefore = hospital().cost, marginBefore = st().society.publicFinance.headroom;
store.resolveAgendaItem(ask.id, 'integra');
assert.ok(hospital().cost > costBefore && st().society.publicFinance.headroom < marginBefore && !hospital().pending, 'Integrare paga subito e fa ripartire il cantiere.');
for (const [choice, check] of [
  ['ridimensiona', project => project.scope < 1 && !project.pending],
  ['sospendi', project => project.stage === 'sospeso'],
  ['attendi', project => project.pending && project.pending.amount > 1.4 && project.stall > 0]
]) {
  edit(store, save => { const project = save.society.projects.find(item => item.type === 'ospedale'); Object.assign(project, { stage: 'cantiere', progress: 45, stall: 0, scope: 1, pending: { kind: 'sforamento', amount: 1.4, week: save.game.week.index, raised: false, waits: 0 } }); save.game.inbox = []; });
  advance();
  const item = st().game.inbox.find(entry => entry.templateId === 'progetto-sforamento');
  assert.ok(item, `${choice}: la decisione è in agenda`);
  store.resolveAgendaItem(item.id, choice);
  assert.ok(check(hospital()), `Risposta «${choice}» applicata all’opera.`);
}
// Without a decision the waiting falls on the works: stalled weeks that are counted as delay.
edit(store, save => { const project = save.society.projects.find(item => item.type === 'ferrovia'); Object.assign(project, { stage: 'cantiere', progress: 50, stall: 0, delayWeeks: 0, pending: { kind: 'sforamento', amount: 1.4, week: save.game.week.index, raised: true, waits: 0 } }); });
for (let week = 0; week < 5; week++) advance();
assert.ok(st().society.projects.find(project => project.type === 'ferrovia').delayWeeks >= 3, 'Senza decisione i lavori si fermano e il ritardo si conta.');
// Completion: results land on the territory only when the works end, scaled by quality and delay.
edit(store, save => { const project = save.society.projects.find(item => item.type === 'scuola'); Object.assign(project, { stage: 'collaudo', progress: 99.6, stall: 0, pending: null, delayWeeks: 6 }); save.game.inbox = []; });
const school2 = () => st().society.projects.find(project => project.type === 'scuola');
const indicatorBefore = st().society.regions.Campania.indicators.istruzione;
advance();
assert.equal(school2().stage, 'completato');
assert.ok(school2().result && school2().result.late === 6 && school2().result.gains.istruzione > 0, 'L’opera finita ha un risultato con ritardo e guadagno.');
const done = st().game.inbox.find(item => item.templateId === 'progetto-completato');
assert.ok(done, 'La fine dell’opera è in agenda.');
store.resolveAgendaItem(done.id, 'inaugura');
for (let week = 0; week < 8; week++) advance();
assert.ok(st().society.regions.Campania.indicators.istruzione > indicatorBefore + 3, 'L’istruzione in Campania sale dopo l’apertura della scuola.');
assert.ok(st().game.memory.some(item => item.kind === 'legge' && /Aperta l’opera/.test(item.text)), 'L’inaugurazione resta nella memoria politica.');
// Stopping a work is a decision with a price.
const rail = () => st().society.projects.find(project => project.type === 'ferrovia');
const marginStop = st().society.publicFinance.headroom;
api.stopProject(rail().id);
assert.equal(rail().stage, 'sospeso');
assert.ok(st().society.publicFinance.headroom > marginStop, 'Una parte dell’impegno torna al margine.');
assert.throws(() => api.setProjectFunding(rail().id, 90), /prima dell’apertura del cantiere/);
assert.ok(st().game.memory.some(item => item.kind === 'decisione' && /Sospesa l’opera/.test(item.text)), 'La sospensione resta nella memoria.');

// ---------- 4. European funds ----------
edit(store, save => {
  save.society.projects = [];
  save.society.lawsApplied = [];
  save.society.publicFinance.headroom = 80;
  save.society.publicFinance.eu = { calls: [
    { id: 'bando-test-aperto', template: 'coesione', title: 'Salute e coesione territoriale', amount: 4, committed: 0, cofinance: 0.3, openedWeek: save.game.week.index, deadlineWeek: save.game.week.index + 10, status: 'aperto', reports: 0, missed: 0 },
    { id: 'bando-test-assegnato', template: 'mobilita', title: 'Mobilità sostenibile', amount: 6, committed: 0, cofinance: 0.35, openedWeek: 1, deadlineWeek: 5, status: 'assegnato', spendByWeek: save.game.week.index + 30, reports: 0, missed: 0 }
  ], nextCallWeek: save.game.week.index + 200, received: 6, lost: 0, reports: 0, missed: 0 };
});
assert.throws(() => api.applyEuCall('bando-test-aperto'), /Manca la riforma richiesta/);
const view = projects.euView(st().society, st().game.week.index);
assert.ok(view.calls.find(call => call.id === 'bando-test-aperto').requirement.reform === null, 'Senza riforma la candidatura è bloccata.');
edit(store, save => { save.society.lawsApplied.unshift({ title: 'Riforma della sanità', area: 'sanita', week: save.game.week.index, origin: 'governo' }); });
api.applyEuCall('bando-test-aperto');
assert.equal(st().society.publicFinance.eu.calls.find(call => call.id === 'bando-test-aperto').status, 'candidato');
// A work financed by an awarded call: the State pays its cofinancing, the call keeps count.
const eu = () => st().society.publicFinance.eu.calls.find(call => call.id === 'bando-test-assegnato');
const euQuote = projects.projectQuote(st().society, { type: 'ferrovia', region: 'Sicilia', funding: 100, financing: 'ue', callId: 'bando-test-assegnato' }, st().parliament.government);
assert.ok(euQuote.ok && euQuote.euShare === 5.9 && euQuote.statePart === 3.1 && euQuote.marginUse < 1.3, 'Con i fondi europei lo Stato mette solo il cofinanziamento.');
assert.ok(!projects.projectQuote(st().society, { type: 'ospedale', region: 'Sicilia', funding: 100, financing: 'ue' }).ok, 'I fondi per le ferrovie non pagano un ospedale.');
api.proposeProject({ type: 'ferrovia', region: 'Sicilia', funding: 100, financing: 'ue', callId: 'bando-test-assegnato' });
assert.equal(eu().committed, 5.9);
assert.ok(eu().reportDueWeek > st().game.week.index, 'Parte il calendario dei rendiconti.');
assert.ok(!projects.projectQuote(st().society, { type: 'ferrovia', region: 'Sicilia', funding: 140, financing: 'ue', callId: 'bando-test-assegnato' }).ok, 'Oltre i fondi rimasti non si finanzia.');
assert.ok(!checkInvariants(st(), run.context).issues.some(item => item.code === 'bando-ue' || item.code === 'opera'), 'Opere e bandi sono coerenti.');
// Report in time: relations with Brussels improve. Miss it: the funds shrink and the markets notice.
edit(store, save => { save.society.publicFinance.eu.calls[1].reportDueWeek = save.game.week.index; });
const europeBefore = st().society.areas.europa.value;
api.reportEuCall('bando-test-assegnato');
assert.equal(eu().reports, 1);
assert.ok(st().society.areas.europa.value > europeBefore, 'Il rendiconto migliora i rapporti con la Commissione.');
assert.throws(() => api.reportEuCall('bando-test-assegnato'), /presentato da poco/);
const spread0 = st().society.publicFinance.spread;
edit(store, save => { save.society.publicFinance.eu.calls[1].reportDueWeek = save.game.week.index - 1; });
for (let week = 0; week < 7; week++) advance();
assert.ok(eu().missed >= 1 && st().society.publicFinance.eu.lost > 0 && eu().amount < 6, 'Un rendiconto mancato fa perdere parte dei fondi.');
assert.ok(st().game.memory.some(item => item.kind === 'procedura-ue' && /Rendiconto/.test(item.text)), 'E resta nella memoria politica.');
// Funds not committed by the deadline go back to Brussels.
edit(store, save => { save.society.publicFinance.eu.calls.push({ id: 'bando-test-scadenza', template: 'competenze', title: 'Scuola e competenze', amount: 3, committed: 1, cofinance: 0.25, openedWeek: 1, deadlineWeek: 5, status: 'assegnato', spendByWeek: save.game.week.index + 1, reportDueWeek: save.game.week.index + 20, reports: 0, missed: 0 }); });
const lostBefore = st().society.publicFinance.eu.lost;
for (let week = 0; week < 2; week++) advance();
const expired = st().society.publicFinance.eu.calls.find(call => call.id === 'bando-test-scadenza');
assert.equal(expired.status, 'chiuso');
assert.equal(expired.lost, 2, 'I fondi non impegnati alla scadenza tornano a Bruxelles.');
assert.ok(st().society.publicFinance.eu.lost >= lostBefore + 2 && st().game.memory.some(item => item.kind === 'procedura-ue' && /Fondi europei non spesi/.test(item.text)), 'Lo si ricorda nella memoria politica.');

// ---------- 5. the screen ----------
const html = parliamentUi.renderParliamentPage('governo', st(), { politicians: [] });
assert.ok(/Opere pubbliche/.test(html) && /Fondi europei/.test(html) && /name="funding"/.test(html) && /aria-valuetext/.test(html) && /data-project-form/.test(html), 'La pagina Governo mostra opere, fondi europei e cursori.');
assert.ok(!/undefined|NaN|\[object/.test(sentence(html)), 'La pagina non mostra segnaposto o valori vuoti.');
assert.ok(policyUi.projectPreview(st(), { type: 'impresa', region: 'Veneto', funding: 120 }).includes('QUALITÀ ATTESA'), 'L’anteprima di un’opera mostra costo, tempi e qualità.');

// ---------- 6. the whole game stays coherent and deterministic ----------
const final = checkInvariants(st(), run.context);
assert.ok(final.ok, `Stato coerente: ${final.issues.slice(0, 3).map(item => `[${item.code}] ${item.message}`).join('; ')}`);
const again = await premierCareer('premier-bilancio');
const again2 = await premierCareer('premier-bilancio');
for (const item of [again, again2]) { item.store.proposeProject({ type: 'scuola', region: 'Veneto', funding: 100 }); for (let week = 0; week < 20; week++) item.store.advance(7); }
assert.equal(fingerprint(again.store.getState()), fingerprint(again2.store.getState()), 'Stessa partita, stesse opere: la simulazione è deterministica.');

console.log('Primo ministro verificato: bilancio per otto settori e cinque leve economiche con cursori (valore, costo, anteprima di deficit, economia e Parlamento), effetti nel tempo su aree, territori e cittadini; opere pubbliche (ospedali, ferrovie, scuole, poli industriali) con budget, ritardi, sforamenti con quattro risposte, sospensione e risultati a opera finita; fondi europei con requisiti, cofinanziamento, candidatura, rendiconti e perdita dei fondi; salvataggio, avanzamento e coerenza dello stato.');
