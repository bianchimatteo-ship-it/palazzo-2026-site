// The public works of the local institutions: what each level can build, how a work is paid (points of the budget margin, once), its cycle from the vote to the opening and the upkeep,
// who can decide on it (the head of the executive; a councillor or an assessore proposes or follows and spends nothing), the services of the province, the saves made before the works,
// and the determinism of the whole. Pure engines (no career): the store and the screens are checked by check-local and check-province.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const L = await import(`../src/core/local-engine.js${v}`);
const W = await import(`../src/core/local-works-engine.js${v}`);
const R = await import(`../src/data/simulation/local-works.js${v}`);
const A = await import(`../src/data/simulation/local-acts.js${v}`);
const { seededRandom } = await import(`../src/core/vote-engine.js${v}`);
const { advanceDays } = await import(`../src/core/time.js${v}`);

const groups = [{ id: 'maj', label: 'Maggioranza', axis: -1, seats: 21, side: 'maggioranza' }, { id: 'opp', label: 'Opposizione', axis: 2, seats: 3, side: 'opposizione' }];
const make = (kind, extra = {}) => L.createInstitution({ kind, name: `${kind} di prova`, region: 'Toscana', date: '2027-01-10', role: kind === 'regione' ? 'presidente' : 'sindaco', side: 'maggioranza', playerGroupId: 'maj', leaderGroupId: 'maj', leaderIsPlayer: true, groups, territory: { servizi: 50, sicurezza: 50, ambiente: 50, trasporti: 50, infrastrutture: 50, economia: 50, istruzione: 50, sanita: 50, occupazione: 50 }, place: { region: 'Toscana', municipalityCode: '052032', provinceCode: '052' }, ...extra });
// An institution with a settled budget (no budget vote in the way) whose executive is not the player's, so that the council runs by itself.
const settled = inst => ({ ...inst, budget: { ...inst.budget, approvedYear: 2040 }, executive: { ...inst.executive, leader: 'simulato' } });
const at = (inst, id, stage, date) => ({ ...inst, acts: inst.acts.map(item => item.id === id ? { ...item, stage, nextStepAt: date } : item) });
const week = (inst, date, key = 'w') => L.advanceInstitutionWeek(inst, { date, rand: seededRandom(`${key}|${date}`) });
const throwsWith = (fn, pattern, message) => assert.throws(fn, pattern, message);

// ---------- 1. the catalog and the competences ----------
for (const kind of ['comune', 'provincia', 'regione']) assert.ok(R.workTypesFor(kind).length >= 6, `${kind}: un catalogo di opere`);
assert.ok(R.WORK_TYPES.every(type => type.kinds.length === 1 && type.cost > 0 && type.weeks[1] > type.weeks[0] && type.upkeep > 0 && type.gain > 0 && type.pleased.length), 'Ogni opera ha costo, tempi, beneficio, manutenzione e chi ne gode');
const names = kind => R.workTypesFor(kind).map(type => type.id);
for (const id of ['campo-calcio', 'palazzetto', 'piscina', 'strade-comunali', 'piste-ciclabili', 'parco-urbano']) assert.ok(names('comune').includes(id), `Comune: ${id}`);
for (const id of ['strade-provinciali', 'ponte-provinciale', 'frana', 'scuola-superiore', 'palestra-scolastica']) assert.ok(names('provincia').includes(id), `Provincia: ${id}`);
for (const id of ['ospedale-regionale', 'potenziamento-sanitario', 'ferrovia-regionale', 'formazione', 'sviluppo-economico']) assert.ok(names('regione').includes(id), `Regione: ${id}`);
throwsWith(() => W.planWork(make('comune'), { typeId: 'ospedale-regionale' }), /competenza/, 'Un Comune non costruisce un ospedale regionale');
throwsWith(() => W.planWork(make('provincia'), { typeId: 'piscina' }), /competenza/, 'Una Provincia non costruisce una piscina comunale');
throwsWith(() => L.proposeLocalAct(make('comune'), 'sanita', '2027-01-10', { category: 'opere' }), /catalogo/, 'Sulla sanità un Comune non ha opere in catalogo');
assert.ok(W.planWork(make('regione'), { typeId: 'ospedale-regionale' }).cost > W.planWork(make('regione'), { typeId: 'potenziamento-sanitario' }).cost, 'Un ospedale costa più di un potenziamento');
assert.ok(W.euroOf(make('regione'), 1) > W.euroOf(make('provincia'), 1) && W.euroOf(make('provincia'), 1) > W.euroOf(make('comune'), 1), 'Un punto di margine vale di più a un livello più alto (solo lettura in euro)');

// ---------- 2. the cycle of a work and its accounting ----------
{
  const mayor = settled(make('comune'));
  const start = mayor.budget.margin;
  const proposed = L.proposeLocalAct({ ...mayor, executive: { ...mayor.executive, leader: 'player' } }, 'sport', '2027-01-10', { category: 'opere', work: { typeId: 'palazzetto', funding: 100, site: 'centro' } });
  const act = proposed.acts.at(-1);
  assert.ok(act.workPlan && act.workPlan.typeId === 'palazzetto' && act.measure.work && Object.keys(act.measure.indicators).length === 0, 'L’atto approva un piano: nessun indicatore subito');
  let inst = settled(at(proposed, act.id, 'aula', '2027-01-17'));
  let date = '2027-01-17';
  let out = week(inst, date);
  inst = out.inst;
  const work = inst.works[0];
  assert.ok(work && work.actId === act.id && work.stage === 'autorizzazioni' && work.territory.region === 'Toscana' && work.territory.municipalityCode === '052032', 'L’opera nasce dall’atto, con il territorio e i codici dell’ente');
  assert.equal(work.drawn, work.committed, 'All’inizio è prelevato solo l’impegno');
  assert.equal(Math.round((start - inst.budget.margin) * 10) / 10, work.committed, 'Il margine cala dell’impegno, una volta');
  const sport0 = inst.indicators.sport;
  const effectsBefore = inst.effects.length;
  let finished = null, drawnBefore = work.drawn, lastProgress = 0, stages = new Set();
  for (let n = 0; n < 200 && !finished; n++) {
    date = advanceDays(date, 7);
    out = week(inst, date);
    inst = out.inst;
    const current = inst.works[0];
    stages.add(current.stage);
    assert.ok(current.progress >= lastProgress && current.drawn >= drawnBefore - 1e-9 && current.drawn <= current.cost + 0.11, 'Avanzamento e prelievi non tornano indietro e non superano il costo');
    assert.ok(current.drawn + 0.11 >= current.cost * current.progress / 100, 'Il margine segue i lavori fatti');
    if (current.stage !== 'completato') assert.ok(inst.effects.length <= effectsBefore || inst.effects.every(effect => effect.actId !== current.id || effect.delay > 0 || effect.indicator !== 'sport'), 'Nessun beneficio prima dell’apertura');
    drawnBefore = current.drawn; lastProgress = current.progress;
    if (current.stage === 'completato') finished = { work: current, events: out.events };
  }
  assert.ok(finished, 'Il cantiere arriva all’apertura');
  assert.ok(['autorizzazioni', 'progettazione', 'gara', 'cantiere', 'collaudo', 'completato'].every(stage => stages.has(stage) || stage === 'autorizzazioni'), 'Passa per progettazione, gara, cantiere e collaudo');
  const done = finished.work;
  assert.ok(Math.abs(done.drawn - done.cost) < 0.11 && done.result && done.result.quality > 0.5 && done.result.finalCost === done.cost, 'A opera finita tutto il costo è uscito dal margine, una volta');
  assert.ok(finished.events.some(item => item.type === 'opera-completata' && item.workId === done.id), 'La fine dell’opera arriva alla carriera');
  assert.ok(inst.effects.some(effect => effect.indicator === 'sport' && effect.actId === done.id), 'I benefici partono solo a opera finita');
  assert.ok(!finished.events.some(item => item.type === 'effetti' && item.actId === done.id), 'Lo sport non ha un indicatore regionale: nessuna quota arriva alla regione');
  const afterOpen = inst;
  for (let n = 0; n < 12; n++) { date = advanceDays(date, 7); inst = week(inst, date).inst; }
  assert.ok(inst.indicators.sport - afterOpen.indicators.sport > (done.result.gains.sport * 0.6) - 1 && inst.indicators.sport > sport0, 'Lo sport migliora dopo l’apertura, in proporzione alla qualità');
  assert.ok(inst.worksRecord.completed >= 1 && inst.worksRecord.started >= inst.worksRecord.completed && inst.worksRecord.finalCost >= done.cost - 0.01 && inst.worksRecord.completedBudget >= done.budget0 - 0.01, 'Il registro delle opere conta ciò che è stato fatto');
  // The upkeep is paid every quarter from the margin; left unpaid, the work wears and loses part of its benefit.
  const before = inst.budget.margin;
  for (let n = 0; n < 13; n++) { date = advanceDays(date, 7); inst = week(inst, date).inst; }
  assert.ok(inst.budget.margin < before + 0.1 && inst.works[0].condition >= 90, 'La manutenzione pesa sul margine e l’opera resta in condizione');
  let wearing = { ...inst, budget: { ...inst.budget, margin: 0, provisional: true } };
  const wornEvents = [], losses = [];
  for (let n = 0; n < 13 * 9; n++) { date = advanceDays(date, 7); const next = week(wearing, date); wearing = { ...next.inst, budget: { ...next.inst.budget, margin: 0, provisional: true, approvedYear: 2040 } }; wornEvents.push(...next.events); losses.push(...next.inst.effects.filter(effect => effect.perWeek < 0 && /degrado/.test(effect.title))); }
  assert.ok(wearing.works[0].condition < R.WORK_RULES.worn && wearing.works[0].degraded && wornEvents.some(item => item.type === 'opera-degrado') && wornEvents.some(item => item.type === 'opera-manutenzione'), 'Senza manutenzione l’opera si degrada e perde parte del beneficio');
  assert.ok(losses.length > 0, 'Il degrado toglie parte del beneficio ai servizi della città');
}

// ---------- 3. who decides: the head of the executive; a councillor or an assessore spends nothing ----------
{
  const mayor = make('comune');
  const councillor = { ...mayor, executive: { ...mayor.executive, leader: 'simulato' }, playerRole: 'consigliere' };
  throwsWith(() => L.proposeLocalAct(councillor, 'sport', '2027-01-10', { category: 'opere' }), /guida l’esecutivo|delega/, 'Un consigliere non propone opere');
  const proposed = L.proposeLocalAct(mayor, 'sport', '2027-01-10', { category: 'opere' });
  let inst = settled(at(proposed, proposed.acts.at(-1).id, 'aula', '2027-01-17'));
  inst = week(inst, '2027-01-17').inst;
  const id = inst.works[0].id;
  let when = '2027-01-17';
  for (let n = 0; n < 6; n++) { when = advanceDays(when, 7); inst = week(inst, when).inst; }
  assert.ok(inst.works[0].stage !== 'autorizzazioni', 'Dopo qualche settimana l’opera è in progettazione');
  for (const action of [() => W.refundWork(inst, id), () => W.suspendWork(inst, id, '2027-02-01'), () => W.resizeWork(inst, id), () => W.setWorkFunding(inst, id, 120), () => W.settleWorkIssue(inst, id, 'attendi'), () => W.payUpkeep(inst, id)]) throwsWith(action, /guida l’esecutivo/, 'Solo chi guida l’esecutivo decide sulle opere');
  // An assessore proposes only on the theme of the own delega.
  const assessore = L.grantDelega(settled(make('comune')), { kind: 'assessore', portfolio: 'Lavori pubblici', date: '2027-01-10' });
  assert.ok(assessore.playerDelega.areas.length, 'Una delega ha i suoi temi');
  throwsWith(() => L.proposeLocalAct(assessore, 'cultura', '2027-01-10', { category: 'opere' }), /delega/, 'Fuori dalla delega non si propone');
  throwsWith(() => W.suspendWork({ ...assessore, works: inst.works }, id, '2027-02-01'), /guida l’esecutivo/, 'Un assessore non sospende un cantiere');
  // Activities: a site visit speeds up the works one steers, an inspection weighs on works in trouble only when there are some; a councillor's visit does not accelerate anything.
  const boosted = L.applyLocalEffect(inst, { workBoost: 3 });
  assert.ok(boosted.works[0].boost === 0, 'Chi non guida l’esecutivo non accelera i cantieri');
  const mine = L.applyLocalEffect({ ...inst, executive: { ...inst.executive, leader: 'player' } }, { workBoost: 3 });
  assert.ok(mine.works[0].boost === 3, 'Il sindaco accelera i cantieri aperti');
  const calm = L.applyLocalEffect({ ...inst, playerSide: 'opposizione' }, { scrutiny: true });
  assert.equal(calm.pressure, inst.pressure, 'Un’ispezione a un cantiere in regola non pesa sulla giunta');
  const troubled = L.applyLocalEffect({ ...inst, playerSide: 'opposizione', works: inst.works.map(work => ({ ...work, delayWeeks: 6 })) }, { scrutiny: true });
  assert.ok(troubled.pressure > inst.pressure && troubled.executive.stability < inst.executive.stability, 'Un cantiere in ritardo, ispezionato, pesa sulla giunta');
}

// ---------- 4. the decisions on a work: overrun, funds, suspension, funding ----------
{
  const mayor = make('comune');
  const proposed = L.proposeLocalAct(mayor, 'sport', '2027-01-10', { category: 'opere', work: { typeId: 'piscina', funding: 100, site: 'periferia' } });
  let inst = { ...proposed, budget: { ...proposed.budget, approvedYear: 2040 } };
  inst = at(inst, inst.acts.at(-1).id, 'aula', '2027-01-17');
  inst = L.advanceInstitutionWeek({ ...inst, executive: { ...inst.executive, leader: 'player' } }, { date: '2027-01-17', rand: seededRandom('x') }).inst;
  const id = inst.works[0].id;
  const margin0 = inst.budget.margin;
  // Funding before the site opens: the difference is paid (or given back) at once.
  const up = W.setWorkFunding(inst, id, 120);
  assert.ok(up.work.cost > inst.works[0].cost && up.inst.budget.margin < margin0 && Math.abs((margin0 - up.inst.budget.margin) - (up.work.drawn - inst.works[0].drawn)) < 0.11, 'Più fondi: costa di più e il margine paga la differenza una volta');
  const down = W.setWorkFunding(inst, id, 80);
  assert.ok(down.work.cost < inst.works[0].cost && down.inst.budget.margin > margin0 - 0.01, 'Meno fondi: costa meno e la differenza torna al margine');
  // An overrun waits for the decision; 'integra' pays it once, 'ridimensiona' makes the work smaller and gives money back.
  const stuck = { ...inst, works: inst.works.map(work => ({ ...work, stage: 'cantiere', progress: 50, drawn: work.cost * 0.7, pending: { kind: 'sforamento', amount: 2, raised: true, waited: 0, waits: 0 } })) };
  const paid = W.settleWorkIssue(stuck, id, 'integra');
  assert.ok(paid.work.cost === stuck.works[0].cost + 2 && !paid.work.pending && paid.inst.budget.margin < stuck.budget.margin && Math.abs((stuck.budget.margin - paid.inst.budget.margin) - (paid.work.drawn - stuck.works[0].drawn)) < 0.11, 'Integrare i fondi: il costo sale e il margine paga una volta');
  // A late overrun (83 % done) keeps the money drawn in line with the work done (regression: 8 → 9,6 points left 7,7 drawn for 83,2 % of 9,6), also when the executive settles it by itself.
  const late = { ...inst, budget: { ...inst.budget, margin: 90 }, works: inst.works.map(work => ({ ...work, stage: 'cantiere', progress: 83.2, drawn: work.cost * 0.832, pending: { kind: 'sforamento', amount: work.cost * 0.2, raised: true, waited: 0, waits: 0 } })) };
  const latePaid = W.settleWorkIssue(late, id, 'integra');
  assert.ok(latePaid.work.drawn + 0.11 >= latePaid.work.cost * latePaid.work.progress / 100, `Sforamento a fine lavori: prelevato ${latePaid.work.drawn} per ${latePaid.work.cost * latePaid.work.progress / 100} di lavori fatti.`);
  const scaled = W.settleWorkIssue(stuck, id, 'ridimensiona');
  assert.ok(scaled.work.cost < stuck.works[0].cost && scaled.work.scope < 1 && !scaled.work.pending, 'Ridimensionare: costa meno e rende meno');
  throwsWith(() => W.settleWorkIssue({ ...stuck, budget: { ...stuck.budget, margin: 0.2 } }, id, 'integra'), /margine/, 'Senza margine non si integra');
  // Suspending gives back part of what was reserved and not spent; resuming asks for it again.
  const stopped = W.suspendWork(stuck, id, '2027-06-01');
  assert.ok(stopped.work.stage === 'sospeso' && stopped.back > 0 && stopped.inst.budget.margin > stuck.budget.margin, 'Sospendere restituisce una parte dell’impegno');
  const back = W.resumeWork(stopped.inst, id);
  assert.ok(back.work.stage === 'cantiere' && Math.abs(back.inst.budget.margin - stuck.budget.margin) < 0.11, 'Riaprire richiede di nuovo il margine restituito');
  assert.ok(stopped.inst.worksRecord.suspended === 1, 'Il registro ricorda la sospensione');
  // Without margin the site stops: the margin never goes below zero, and the decision is asked for.
  const dry = { ...stuck, executive: { ...stuck.executive, leader: 'player' }, budget: { ...stuck.budget, margin: 0 }, works: stuck.works.map(work => ({ ...work, pending: null, stall: 0, progress: 50, drawn: work.cost * 0.4 })) };
  const starved = W.advanceWorks(dry, { date: '2027-06-08', rand: () => 0.99 });
  assert.ok(starved.inst.budget.margin >= 0 && starved.inst.works[0].progress === 50 && starved.events.some(item => item.type === 'opera-fondi'), 'Senza margine il cantiere si ferma e lo dice');
}

// ---------- 5. the executive builds with moderation and never twice the same work ----------
{
  let inst = settled(make('comune'));
  let date = '2027-01-10';
  const starts = [];
  for (let n = 0; n < 160 && inst.status === 'active'; n++) { date = advanceDays(date, 7); inst = week(inst, date, 'esecutivo').inst; inst = { ...inst, budget: { ...inst.budget, approvedYear: 2040, margin: Math.max(inst.budget.margin, 60) } }; }
  for (const work of inst.works) starts.push(work.approvedAt);
  for (let i = 1; i < starts.length; i++) assert.ok(Date.parse(starts[i]) - Date.parse(starts[i - 1]) >= 12 * 7 * 86400000 - 86400000, `Due opere dell’esecutivo non partono a meno di un trimestre l’una dall’altra (${starts[i - 1]} e ${starts[i]})`);
  const open = inst.works.filter(work => W.isActiveWork(work));
  assert.equal(new Set(open.map(work => work.typeId)).size, open.length, 'Non si apre due volte la stessa opera');
  assert.ok(inst.works.length >= 1, 'In tre anni un esecutivo apre qualche opera');
}

// ---------- 6. the services of the province are its own, and persist ----------
{
  const province = make('provincia');
  assert.deepEqual(Object.keys(province.indicators).sort(), A.PROVINCE_INDICATORS.map(item => item.id).sort(), 'La provincia ha servizi propri (strade, scuole, trasporto, ambiente...)');
  assert.notDeepEqual(Object.keys(province.indicators).sort(), A.CITY_INDICATORS.map(item => item.id).sort(), 'Non sono quelli del Comune');
  assert.ok(province.baseline.services === Math.round(Object.values(province.indicators).reduce((a, b) => a + b, 0) / Object.keys(province.indicators).length * 10) / 10, 'Il punto di partenza del mandato è la media dei servizi della provincia');
  const territory = { infrastrutture: 80, istruzione: 80, trasporti: 80, ambiente: 80, servizi: 80, sicurezza: 80, sanita: 80, economia: 80 };
  const low = make('provincia', { territory: { ...territory, infrastrutture: 20 } });
  assert.ok(low.indicators.viabilita < make('provincia', { territory }).indicators.viabilita, 'I servizi di partenza seguono il territorio della regione');
  const regional = L.mandateRecord({ ...province, indicators: Object.fromEntries(Object.keys(province.indicators).map(id => [id, province.indicators[id] + 10])) }, { date: '2027-12-01' });
  assert.ok(Math.abs(regional.servicesDelta - 10) < 0.11, 'Il mandato provinciale si valuta sui servizi della provincia, non sulla media regionale');
  // A provincial work improves a provincial service (a share reaches the region) and the school buildings of the province.
  const president = { ...province, budget: { ...province.budget, approvedYear: 2040 } };
  const proposed = L.proposeLocalAct(president, 'scuola', '2027-01-10', { category: 'opere', work: { typeId: 'palestra-scolastica', funding: 100, site: 'periferia' } });
  let inst = settled(at(proposed, proposed.acts.at(-1).id, 'aula', '2027-01-17'));
  let date = '2027-01-17', completed = null;
  inst = week(inst, date).inst;
  for (let n = 0; n < 160 && !completed; n++) { date = advanceDays(date, 7); const out = week(inst, date); inst = out.inst; if (inst.works[0].stage === 'completato') completed = out; }
  assert.ok(completed && completed.events.some(item => item.type === 'effetti' && item.kind === 'provincia' && item.indicators.istruzione > 0 && item.indicators.istruzione < inst.works[0].result.gains.scuole), 'Un’opera provinciale muove le scuole della provincia e una quota la regione');
  const opened = inst;
  for (let n = 0; n < 12; n++) { date = advanceDays(date, 7); inst = week(inst, date).inst; }
  assert.ok(inst.indicators.scuole - opened.indicators.scuole > inst.works[0].result.gains.scuole * 0.6 - 1, 'Le scuole superiori della provincia migliorano dopo l’apertura');
}

// ---------- 7. a regional work and the regions' indicators ----------
{
  const region = settled(make('regione'));
  const proposed = L.proposeLocalAct({ ...region, executive: { ...region.executive, leader: 'player' } }, 'sanita', '2027-01-10', { category: 'opere', work: { typeId: 'potenziamento-sanitario', funding: 100, site: 'centro' } });
  assert.equal(proposed.acts.at(-1).category, 'opere', 'La Regione propone un programma di investimenti');
  let inst = settled(at(proposed, proposed.acts.at(-1).id, 'aula', '2027-01-17'));
  let date = '2027-01-17', completed = null;
  const territory = { sanita: 45, servizi: 50, istruzione: 50, infrastrutture: 50, trasporti: 50, economia: 50, occupazione: 50, sicurezza: 50, ambiente: 50 };
  for (let n = 0; n < 200 && !completed; n++) { const out = L.advanceInstitutionWeek(inst, { date, rand: seededRandom(`r|${date}`), territory }); inst = out.inst; if (inst.works[0]?.stage === 'completato') completed = out; date = advanceDays(date, 7); }
  assert.ok(completed && completed.events.some(item => item.type === 'effetti' && item.kind === 'regione' && item.indicators.sanita > 0), 'Un’opera sanitaria regionale migliora la sanità della regione, a opera finita');
}

// ---------- 8. saves made before the works ----------
{
  const modern = make('comune');
  const old = { ...modern };
  delete old.works; delete old.worksRecord; delete old.place;
  const migrated = L.withLocalState(old);
  assert.ok(Array.isArray(migrated.works) && migrated.worksRecord.started === 0 && migrated.place.region === 'Toscana', 'Un’istituzione vecchia riceve opere vuote e un luogo');
  assert.equal(migrated.indicators, old.indicators, 'I servizi che aveva restano gli stessi');
  assert.deepEqual(L.withLocalState(migrated), migrated, 'La migrazione è stabile (idempotente)');
  const oldProvince = (() => { const province = make('provincia'); const copy = { ...province, baseline: { services: 41 } }; delete copy.indicators; delete copy.works; delete copy.worksRecord; delete copy.place; return copy; })();
  const fixed = L.withLocalState(oldProvince, { infrastrutture: 60, istruzione: 60, trasporti: 60, ambiente: 60, servizi: 60 });
  assert.ok(fixed.indicators && Object.keys(fixed.indicators).length === A.PROVINCE_INDICATORS.length && fixed.baseline.services === Math.round(Object.values(fixed.indicators).reduce((a, b) => a + b, 0) / Object.keys(fixed.indicators).length * 10) / 10, 'Una provincia vecchia riceve servizi propri, con il punto di partenza del mandato');
  // An old `opere` act still open (with the generic measure) becomes a work when it is approved, once.
  const legacy = L.proposeLocalAct(make('comune'), 'infrastrutture', '2027-01-10', { category: 'opere' });
  const act = { ...legacy.acts.at(-1) }; delete act.workPlan; act.measure = { indicators: { opere: 4.5 }, cost: 6, revenue: 0, tax: null, phase: 26, lasting: true, segments: {}, intensity: 2 };
  const out = week(settled(at({ ...legacy, acts: [act] }, act.id, 'aula', '2027-01-17')), '2027-01-17');
  assert.equal(out.inst.works.length, 1, 'Un atto di opere già in discussione diventa un’opera quando è approvato');
  assert.ok(!out.inst.effects.some(effect => effect.indicator === 'opere'), 'Senza aver già applicato il beneficio generico dell’atto');
}

// ---------- 9. the mandate reads the works ----------
{
  let inst = settled(make('comune'));
  const clean = L.mandateRecord({ ...inst, worksRecord: { ...inst.worksRecord, started: 3, completed: 3, onTime: 3, finalCost: 15, completedBudget: 15, qualitySum: 2.9 } }, { date: '2028-01-10' });
  const messy = L.mandateRecord({ ...inst, worksRecord: { ...inst.worksRecord, started: 3, completed: 3, onTime: 0, delayWeeks: 60, overruns: 3, suspended: 2, finalCost: 21, completedBudget: 15, qualitySum: 2.4, upkeepMissed: 4 } }, { date: '2028-01-10' });
  assert.ok(clean.works.score > 0 && messy.works.score < 0 && clean.score > messy.score, 'Un mandato di opere nei tempi e nei costi vale più di uno di sprechi');
  assert.ok(clean.works.quality > messy.works.quality && messy.works.overruns === 3, 'Il giudizio conserva qualità, ritardi e sforamenti');
}

// ---------- 10. determinism ----------
{
  const run = () => { let inst = settled(make('comune')); let date = '2027-01-10'; for (let n = 0; n < 60; n++) { date = advanceDays(date, 7); inst = week(inst, date, 'det').inst; } return JSON.stringify({ works: inst.works, record: inst.worksRecord, margin: inst.budget.margin, indicators: inst.indicators }); };
  assert.equal(run(), run(), 'Stessi dati, stesse opere, stessi costi');
}

// ---------- 11. co-financing between institutions of the career ----------
const { PORTFOLIO_AREAS } = await import(`../src/data/simulation/office-rules.js${v}`);
const approvedAct = (inst, actId, stage = 'approvato') => ({ ...inst, acts: inst.acts.map(item => item.id === actId ? { ...item, stage, closedAt: '2027-02-01' } : item) });
// A comune (the player is mayor) with a work that has just started, and a provincia of the same province the player sits in without leading it.
function startedWork(kind, typeId, area, extra = {}) {
  const base = make(kind, extra);
  const proposed = L.proposeLocalAct({ ...base, budget: { ...base.budget, approvedYear: 2040, margin: 80 } }, area, '2027-01-10', { category: 'opere', work: { typeId, funding: 100, site: 'periferia' } });
  const out = week(at(proposed, proposed.acts.at(-1).id, 'aula', '2027-01-17'), '2027-01-17');
  assert.equal(out.inst.works.length, 1, `${kind}: l’opera parte`);
  return out.inst;
}
{
  const owner = startedWork('comune', 'palazzetto', 'sport');
  const work = owner.works[0];
  const provincia = settled(make('provincia', { leaderIsPlayer: false, role: 'consigliere', place: { region: 'Toscana', provinceCode: '052' } }));
  const regione = settled(make('regione', { leaderIsPlayer: false, role: 'consigliere', place: { region: 'Toscana' } }));
  const margin0 = owner.budget.margin, pMargin0 = provincia.budget.margin;
  // The request: an act of the partner for its Giunta, a record on the work; no money moves yet, and each side reads the sum in its own points of margin.
  const asked = L.proposeCofinance(owner, work.id, provincia, 0.3, '2027-01-18');
  const entry = asked.owner.works[0].cofin[0];
  assert.ok(entry.status === 'richiesto' && entry.share === 0.3 && entry.instId === provincia.id && entry.actId === asked.act.id, 'La richiesta è registrata sull’opera, con l’ente e l’atto');
  assert.equal(asked.act.category, 'cofinanziamento', 'Il partner riceve un atto di cofinanziamento');
  assert.ok(entry.ownerId === owner.id && entry.terms === 'quota-fissa' && R.COFIN_TERMS[entry.terms].owner && R.COFIN_TERMS[entry.terms].partner && asked.partner.cofin[0].terms === entry.terms && asked.partner.cofin[0].ownerId === owner.id, 'L’accordo registra l’ente che costruisce, il partner, la quota e le rispettive responsabilità');
  assert.ok(asked.act.organ === 'giunta' && asked.act.quorum === 'giunta' && asked.partner.acts.at(-1).id === asked.act.id, 'Lo decide l’organo competente del partner (la Giunta)');
  assert.ok(Math.abs(entry.ownerPts * R.WORK_RULES.euroPerPoint.comune - entry.euro) < 60 && Math.abs(entry.partnerPts * R.WORK_RULES.euroPerPoint.provincia - entry.euro) / entry.euro < 0.02, 'La stessa somma in euro simulati è letta nei punti di ciascun ente');
  assert.ok(entry.partnerPts < entry.ownerPts / 5 && entry.partnerPts !== entry.ownerPts, 'I punti dei due livelli non si sommano direttamente: un punto provinciale vale molti punti comunali');
  assert.ok(asked.owner.budget.margin === margin0 && asked.partner.budget.margin === pMargin0 && R.WORK_RULES && W.externalOf(asked.owner.works[0]) === 0, 'Alla richiesta non si muove un punto di margine');
  assert.equal(asked.act.measure.cost, entry.partnerPts, 'Il parere contabile guarda la quota in punti del partner');
  assert.equal(asked.partner.cofin[0].status, 'richiesto', 'Il partner la tiene nel suo registro');
  // The checks: territory, competence, scale, stage, powers, shares, funds.
  throwsWith(() => L.proposeCofinance(owner, work.id, settled(make('provincia', { leaderIsPlayer: false, place: { region: 'Toscana', provinceCode: '053' } })), 0.3, '2027-01-18'), /territorio/, 'Un’altra provincia non risponde del territorio dell’opera');
  throwsWith(() => L.proposeCofinance(owner, work.id, settled(make('provincia', { leaderIsPlayer: false, region: 'Lazio', place: { region: 'Lazio', provinceCode: '058' } })), 0.3, '2027-01-18'), /territorio/, 'Un’altra regione nemmeno');
  throwsWith(() => L.proposeCofinance(owner, work.id, regione, 0.5, '2027-01-18'), /rappresentare/, 'Una quota troppo piccola per il bilancio regionale (scala diversa) non si può rappresentare');
  throwsWith(() => L.proposeCofinance(owner, work.id, provincia, 0.7, '2027-01-18'), /quota va dal/, 'La quota ha un massimo');
  throwsWith(() => L.proposeCofinance(asked.owner, work.id, provincia, 0.2, '2027-01-18'), /già un accordo/, 'Un solo accordo vivo per ente');
  throwsWith(() => L.proposeCofinance({ ...owner, executive: { ...owner.executive, leader: 'simulato' } }, work.id, provincia, 0.3, '2027-01-18'), /guida l’esecutivo/, 'Chi non guida l’esecutivo non chiede cofinanziamenti');
  throwsWith(() => L.proposeCofinance({ ...owner, works: [{ ...work, stage: 'cantiere' }] }, work.id, provincia, 0.3, '2027-01-18'), /prima che il cantiere apra/, 'Con il cantiere aperto non si concorda più');
  throwsWith(() => L.proposeCofinance(owner, work.id, { ...provincia, budget: { ...provincia.budget, margin: 0.1 } }, 0.3, '2027-01-18'), /copertura/, 'Senza copertura nel bilancio del partner non si chiede');
  throwsWith(() => L.proposeCofinance(owner, work.id, { ...provincia, budget: { ...provincia.budget, margin: 10.2 } }, 0.3, '2027-01-18'), /riserva minima/, 'Il partner non svuota il suo margine: resta una riserva minima');
  throwsWith(() => L.proposeCofinance(owner, work.id, { ...provincia, budget: { ...provincia.budget, provisional: true } }, 0.3, '2027-01-18'), /provvisorio/, 'Un partner in esercizio provvisorio non cofinanzia');
  throwsWith(() => L.proposeCofinance(owner, work.id, owner, 0.3, '2027-01-18'), /bilancio rappresentato/, 'Un ente non cofinanzia se stesso');
  const crowded = { ...owner, works: [{ ...work, cofin: [{ id: 'x', instId: 'altro', share: 0.3, status: 'erogato', ownerPts: 1, euro: 1, partnerPts: 1 }, { id: 'y', instId: 'terzo', share: 0.2, status: 'richiesto', ownerPts: 1, euro: 1, partnerPts: 1 }] }] };
  throwsWith(() => L.proposeCofinance(crowded, work.id, provincia, 0.1, '2027-01-18'), /superare/, 'Tutti i contributi insieme non superano la metà del costo');
  const ownerLevel = startedWork('regione', 'ospedale-regionale', 'sanita', { place: { region: 'Toscana' } });
  throwsWith(() => L.proposeCofinance(ownerLevel, ownerLevel.works[0].id, settled(make('comune', { leaderIsPlayer: false, place: { region: 'Toscana', provinceCode: '052', municipalityCode: '052032' } })), 0.3, '2027-01-18'), /competenza/, 'Un Comune non cofinanzia un ospedale regionale');
  assert.equal(W.cofinPartners(owner, work, [owner, provincia, regione]).length, 1, 'Dei tre enti del percorso solo la Provincia può cofinanziare questa opera');

  // The partner's organ decides: the real vote closes the act, and the settlement follows it (paid once if it passes, nothing otherwise).
  const settle = (ownerNow, partnerNow, date) => W.settleCofinance([ownerNow, partnerNow], date);
  const waiting = settle(asked.owner, asked.partner, '2027-01-25');
  assert.equal(waiting.events.length, 0, 'Finché l’organo non decide non succede nulla');
  let partnerWeek = asked.partner;
  const voted = week({ ...partnerWeek, executive: { ...partnerWeek.executive, leader: 'simulato' } }, '2027-01-25', 'cofin');
  const act = voted.inst.acts.find(item => item.id === asked.act.id);
  assert.ok(['approvato', 'respinto', 'ritirato'].includes(act.stage), 'La Giunta del partner vota nella settimana');
  const real = settle(asked.owner, voted.inst, '2027-01-25');
  assert.equal(real.events.length, 1, 'Il voto reale chiude l’accordo una volta');
  assert.equal(real.events[0].outcome, act.stage === 'approvato' ? 'erogato' : 'rifiutato', 'L’esito segue il voto');
  const thin = week({ ...asked.partner, budget: { ...asked.partner.budget, margin: 5 } }, '2027-01-25', 'cofin');
  assert.equal(thin.inst.acts.find(item => item.id === asked.act.id).stage, 'ritirato', 'Se il margine del partner non regge più, l’atto è ritirato per mancanza di copertura');
  const shut = settle(asked.owner, thin.inst, '2027-01-25');
  assert.ok(shut.events[0].outcome === 'rifiutato' && /copertura/.test(shut.events[0].reason) && W.externalOf(shut.institutions[0].works[0]) === 0, 'E l’accordo si chiude senza contributo, dicendo perché');
  // Approved and paid: the money crosses once.
  const yes = approvedAct(asked.partner, asked.act.id);
  const paid = settle(asked.owner, yes, '2027-02-01');
  const [o1, p1] = paid.institutions;
  assert.equal(paid.events[0].outcome, 'erogato', 'Con il via libera la quota viene versata');
  assert.equal(Math.round((pMargin0 - p1.budget.margin) * 100) / 100, entry.partnerPts, 'Il partner paga la sua quota, una volta');
  assert.equal(W.externalOf(o1.works[0]), entry.ownerPts, 'L’opera riceve la stessa somma in punti dell’ente che costruisce');
  assert.ok(o1.works[0].cofin[0].status === 'erogato' && p1.cofin[0].status === 'erogato' && o1.worksRecord.cofinReceived === entry.ownerPts && p1.worksRecord.cofinPaid === entry.partnerPts, 'Entrambi i registri la contano');
  assert.ok(o1.works[0].drawn + entry.ownerPts <= o1.works[0].cost + 0.11 && o1.budget.margin >= margin0, 'La riserva dell’ente che costruisce cala dello stesso importo e torna al margine');
  const again = settle(o1, p1, '2027-02-08');
  assert.deepEqual(again, { institutions: [o1, p1], events: [] }, 'Un accordo chiuso non si paga due volte');
  assert.equal(W.cofinPartners(o1, o1.works[0], [o1, p1]).length, 0, 'Con l’accordo già vivo il partner non è più proponibile');
  // Declined, lapsed, no cover at payment time, work finished before: nothing moves.
  const no = settle(asked.owner, approvedAct(asked.partner, asked.act.id, 'respinto'), '2027-02-01');
  assert.equal(no.events[0].outcome, 'rifiutato');
  assert.ok(no.institutions[1].budget.margin === pMargin0 && no.institutions[0].budget.margin === margin0 && W.externalOf(no.institutions[0].works[0]) === 0 && no.institutions[0].works[0].cofin[0].status === 'rifiutato', 'Un rifiuto non sposta denaro e chiude l’accordo');
  const broke = settle(asked.owner, { ...yes, budget: { ...yes.budget, margin: 0.01 } }, '2027-02-01');
  assert.equal(broke.events[0].outcome, 'decaduto', 'Senza copertura al momento di pagare l’accordo decade');
  assert.ok(broke.institutions[1].budget.margin === 0.01 && W.externalOf(broke.institutions[0].works[0]) === 0, 'Nessun addebito e nessun contributo se la copertura è venuta meno');
  const late = settle(asked.owner, asked.partner, '2027-04-26');
  assert.equal(late.events[0].outcome, 'decaduto', 'Senza decisione in tre mesi la richiesta decade');
  const finished = settle({ ...asked.owner, works: [{ ...asked.owner.works[0], stage: 'completato' }] }, yes, '2027-02-01');
  assert.equal(finished.events[0].outcome, 'decaduto', 'Per un’opera già finita non si versa più');
  assert.equal(settle(asked.owner, { ...yes, status: 'sciolto' }, '2027-02-01').events[0].outcome, 'decaduto', 'Un ente che non è più in carica non paga');

  const orphan = W.settleCofinance([asked.partner], '2027-02-01');
  assert.ok(orphan.institutions[0].cofin[0].status === 'decaduto' && orphan.events.length === 0, 'Una richiesta il cui ente non c’è più decade nel registro del partner, senza muovere denaro');
  // The life of the work with the contribution: cost, suspension, resume, resize, refinance, completion; the partner is never charged again.
  let inst = o1;
  const own0 = W.worksLedger(inst);
  assert.equal(own0.received, entry.ownerPts, 'Il bilancio dei cantieri mostra i contributi ricevuti');
  let when = '2027-02-08';
  const partnerAfter = p1.budget.margin;
  // The player leads this executive: an overrun waits for his answer, so here he pays it (the other tests never leave a decision hanging either).
  const keep = x => { let next = { ...x, budget: { ...x.budget, approvedYear: 2040, margin: Math.max(x.budget.margin, 50) } }; for (const work of next.works) if (work.pending) next = W.settleWorkIssue(next, work.id, 'integra', when).inst; return next; };
  const run = (count, patch = x => x) => { for (let n = 0; n < count; n++) { when = advanceDays(when, 7); inst = patch(week(inst, when, 'vita').inst); } };
  run(18, keep);
  const mid = inst.works[0];
  assert.ok(mid.progress > 0 && mid.drawn + entry.ownerPts + 0.11 >= mid.cost * mid.progress / 100, 'I lavori fatti sono coperti dal margine dell’ente e dal contributo, mai oltre');
  const suspended = W.suspendWork(inst, mid.id, when);
  assert.equal(W.externalOf(suspended.work), entry.ownerPts, 'Il contributo del partner resta nell’opera mentre è sospesa');
  assert.ok(suspended.back >= 0 && suspended.work.drawn >= Math.max(0, mid.cost * mid.progress / 100 - entry.ownerPts) - 0.11, 'Alla sospensione tornano solo i fondi propri non spesi');
  const resumed = W.resumeWork(suspended.inst, mid.id);
  assert.ok(Math.abs(resumed.inst.budget.margin - (inst.budget.margin)) < 0.11 && Math.abs(resumed.work.drawn - mid.drawn) < 0.11, 'Alla ripresa l’ente che costruisce rimette solo i suoi fondi: stesso margine e stessi prelievi di prima');
  const smaller = W.resizeWork(inst, mid.id);
  assert.ok(smaller.work.cost >= W.externalOf(smaller.work) && smaller.work.drawn + W.externalOf(smaller.work) <= smaller.work.cost + 0.11, 'Ridimensionata, l’opera non costa meno del contributo ricevuto');
  const more = W.refundWork(inst, mid.id);
  assert.ok(more.paid > 0 && more.inst.budget.margin < inst.budget.margin && W.externalOf(more.work) === entry.ownerPts, 'Il rifinanziamento lo paga chi costruisce: il contributo resta quello pattuito');
  let doneAt = null;
  for (let n = 0; n < 160 && !doneAt; n++) { run(1, keep); if (inst.works[0].stage === 'completato') doneAt = inst.works[0]; }
  assert.ok(doneAt, 'L’opera cofinanziata arriva all’apertura');
  assert.ok(Math.abs(doneAt.drawn + entry.ownerPts - doneAt.cost) < 0.2 && doneAt.result.external === entry.ownerPts, 'A opera finita costo = fondi propri + contributo, una volta');
  assert.equal(inst.worksRecord.cofinReceived, entry.ownerPts, 'Il registro non conta due volte il contributo');
  assert.equal(p1.budget.margin, partnerAfter, 'Il partner non è stato addebitato altre volte');
  // Upkeep stays with the owner: the partner's ledger has no upkeep and the owner pays it.
  const before = inst.budget.margin;
  run(14);
  assert.ok(inst.budget.margin <= before + 0.05 && p1.cofin.length === 1, 'La manutenzione è a carico di chi costruisce');
}

// A provincial work with a regional partner (a higher level can pay a small share of a larger work): the scales differ by 15 times and the margin of each moves in its own points.
{
  const owner = startedWork('provincia', 'palestra-scolastica', 'scuola', { place: { region: 'Toscana', provinceCode: '052' } });
  const regione = settled(make('regione', { leaderIsPlayer: false, role: 'consigliere', place: { region: 'Toscana' } }));
  const asked = L.proposeCofinance(owner, owner.works[0].id, regione, 0.3, '2027-01-18');
  const entry = asked.owner.works[0].cofin[0];
  assert.ok(entry.partnerPts >= R.WORK_RULES.cofin.minPoints && entry.partnerPts < entry.ownerPts / 10, 'La Regione paga pochi punti suoi per molti punti provinciali');
  const paid = W.settleCofinance([asked.owner, approvedAct(asked.partner, asked.act.id)], '2027-02-01');
  assert.equal(Math.round((regione.budget.margin - paid.institutions[1].budget.margin) * 100) / 100, entry.partnerPts, 'Il margine regionale cala di una quota regionale');
  assert.ok(paid.institutions[1].budget.margin < regione.budget.margin && W.externalOf(paid.institutions[0].works[0]) === entry.ownerPts, 'La Provincia riceve la quota in punti provinciali');
}

// A save made before the co-financing and the archive: the institution gets what it lacks, once, and nothing else changes.
{
  const modern = make('comune');
  const old = { ...modern };
  delete old.worksArchive; delete old.cofin;
  const migrated = L.withLocalState(old);
  assert.ok(Array.isArray(migrated.worksArchive) && Array.isArray(migrated.cofin) && migrated.worksArchive.length === 0, 'Un salvataggio senza archivio e senza cofinanziamenti li riceve vuoti');
  assert.deepEqual(L.withLocalState(migrated), migrated, 'La migrazione è idempotente');
  assert.equal(migrated.indicators, old.indicators, 'Nulla di ciò che c’era cambia');
  const oldRecord = { ...old, worksRecord: { started: 2, completed: 1, suspended: 0 } };
  const out = week(oldRecord, '2027-01-17');
  const read = L.worksRecordOf(out.inst);
  assert.ok(read.archived === 0 && read.cofinReceived === 0 && read.cofinPaid === 0 && read.started === 2 && read.completed === 1, 'Un registro delle opere vecchio si legge senza perdere i conteggi, con zero nei campi nuovi');
  const grown = W.advanceWorks({ ...oldRecord, works: [{ ...make('comune').works[0], id: 'v', stage: 'completato', completedAt: '2026-01-01', cost: 1, drawn: 1, upkeepYear: 0.1, typeId: 'palazzetto', label: 'x', title: 'x', area: 'sport', result: { quality: 1, late: 0, finalCost: 1, budget: 1, onTime: true } }] }, { date: '2027-01-17', rand: () => 0.99 }).inst;
  assert.ok(Number.isFinite(grown.worksRecord.started) && grown.worksRecord.started === 2, 'Anche un passo di opere su un registro vecchio non perde i conteggi');
}

// ---------- 12. finished works: the detailed list, the archive and the upkeep that goes on ----------
{
  const base = settled(make('comune'));
  const clone = (n, extra = {}) => ({ id: `${base.id}-opera-${n}`, actId: `a${n}`, typeId: n % 2 ? 'palazzetto' : 'piscina', label: n % 2 ? 'Palazzetto dello sport' : 'Piscina comunale', title: `Opera ${n}`, area: 'sport', site: 'periferia', funding: 100, cost: 7, budget0: 7, compensation: 0, committed: 2.8, drawn: 7, refunded: 0, progress: 100, weeks: 40, stage: 'completato', delayWeeks: 4, overruns: 0, scope: 1, boost: 0, stall: 0, pending: null, upkeepYear: 0.35, upkeepIn: 1, condition: 100, quality: 1, byPlayer: false, territory: { region: 'Toscana' }, approvedAt: '2024-01-10', completedAt: advanceDays('2025-01-10', n * 7), result: { quality: 1, late: 4, finalCost: 7, budget: 7, gains: { sport: 3 }, onTime: false, external: 0 }, goal: { indicator: 'sport', from: 50, to: 54 }, sponsorLabel: 'x', source: 'simulation', ...extra });
  const many = 10;
  const works = Array.from({ length: many }, (_, n) => clone(n + 1));
  const record = { ...base.worksRecord, started: many, completed: many, onTime: 0, finalCost: 70, completedBudget: 70, qualitySum: 10, delayWeeks: 40 };
  const full = { ...base, works, worksRecord: record, budget: { ...base.budget, margin: 60 } };
  const totalsBefore = L.worksRecordOf(full);
  const upkeepBefore = W.worksLedger(full).upkeepYear;
  const out = week(full, '2027-01-17', 'arch');
  const kept = out.inst.works.filter(work => work.stage === 'completato');
  assert.equal(kept.length, R.WORK_RULES.keepClosed, 'Nell’elenco restano solo le opere previste dal limite');
  assert.equal(out.inst.worksArchive.length, many - R.WORK_RULES.keepClosed, 'Le più vecchie passano all’archivio');
  assert.ok(out.inst.worksArchive.every(item => item.completedAt <= kept.map(work => work.completedAt).sort()[0]), 'Passano le più vecchie, non le recenti');
  const totalsAfter = L.worksRecordOf(out.inst);
  for (const key of ['started', 'completed', 'onTime', 'delayWeeks', 'overruns', 'finalCost', 'completedBudget', 'quality', 'score']) assert.equal(totalsAfter[key], totalsBefore[key], `I totali del mandato non cambiano con l’archivio (${key})`);
  assert.equal(totalsAfter.archived, many - R.WORK_RULES.keepClosed, 'Il registro sa quante opere ha archiviato');
  const archived = out.inst.worksArchive[0];
  assert.ok(archived.result.finalCost === 7 && archived.result.quality === 1 && archived.cost === 7 && archived.budget0 === 7 && archived.upkeepYear === 0.35, 'L’archivio conserva costo finale, risultato, qualità e manutenzione');
  assert.ok(!('goal' in archived) && !('pending' in archived) && !('sponsorLabel' in archived) && !('cofin' in archived), 'L’archivio non porta lo storico completo');
  const ledger = W.worksLedger(out.inst);
  assert.equal(ledger.archived, 2, 'Il bilancio conta le opere archiviate');
  assert.ok(Math.abs(ledger.upkeepYear - upkeepBefore) < 0.011 && Math.abs(out.inst.worksRecord.agedUpkeep - 0.7) < 0.011 && W.agedUpkeepOf(out.inst.worksArchive) === out.inst.worksRecord.agedUpkeep, 'agedUpkeep è la somma delle manutenzioni dei record archiviati e il totale annuo non cambia');
  // The upkeep: each finished work, listed or archived, pays its own once a quarter; the aggregate is not charged again.
  const due = Math.round(0.35 * R.WORK_RULES.upkeepEvery / 52 * 100) / 100;
  assert.ok(Math.abs((60 - out.inst.budget.margin) - due * many) < 0.06 * many + 0.5, 'Il margine paga la manutenzione di tutte le opere, archiviate comprese, una volta sola');
  const paidOnce = out.inst.worksArchive.every(item => item.upkeepIn === R.WORK_RULES.upkeepEvery) && kept.every(item => item.upkeepIn === R.WORK_RULES.upkeepEvery);
  assert.ok(paidOnce, 'Ogni record rimette in ordine il suo contatore di manutenzione');
  const idle = week(out.inst, '2027-01-24', 'arch');
  assert.ok(idle.inst.worksArchive.length === 2 && idle.inst.works.length === R.WORK_RULES.keepClosed, 'Senza nuove opere finite non si archivia altro');
  // The wear goes on for the archived: without upkeep they lose condition, then part of the benefit; with upkeep back they recover.
  let wearing = out.inst, date = '2027-01-24';
  const events = [], lost = [];
  for (let n = 0; n < 13 * 9; n++) { date = advanceDays(date, 7); const next = week(wearing, date, 'arch'); wearing = { ...next.inst, budget: { ...next.inst.budget, margin: 0, provisional: true, approvedYear: 2040 } }; events.push(...next.events); lost.push(...next.inst.effects.filter(effect => effect.perWeek < 0 && /degrado/.test(effect.title))); }
  const worn = wearing.worksArchive[0];
  assert.ok(worn.condition < R.WORK_RULES.worn && worn.degraded, 'Un’opera archiviata si degrada se non è mantenuta');
  assert.ok(events.some(item => item.type === 'opera-degrado' && wearing.worksArchive.some(rec => rec.id === item.workId)), 'Il degrado di un’opera archiviata arriva alla carriera');
  assert.ok(lost.some(effect => wearing.worksArchive.some(rec => rec.id === effect.actId)), 'E toglie parte del beneficio ai servizi');
  let healing = { ...wearing, budget: { ...wearing.budget, margin: 90, provisional: false, approvedYear: 2040 } };
  const back = [];
  for (let n = 0; n < 13 * 22; n++) { date = advanceDays(date, 7); const next = week(healing, date, 'arch'); healing = { ...next.inst, budget: { ...next.inst.budget, margin: 90, provisional: false, approvedYear: 2040 } }; back.push(...next.inst.effects.filter(effect => effect.perWeek > 0 && /ripristino/.test(effect.title))); }
  assert.ok(healing.worksArchive[0].condition >= 70 && !healing.worksArchive[0].degraded && back.some(effect => effect.actId === worn.id), 'Ripresa la manutenzione, l’opera archiviata recupera e riprende il beneficio');
  // The upkeep of an archived work can also be paid by hand (the agenda asks for it).
  assert.equal(W.payUpkeep({ ...wearing, budget: { ...wearing.budget, margin: 50, provisional: false }, executive: { ...wearing.executive, leader: 'player' } }, worn.id).work.id, worn.id, 'La manutenzione di un’opera archiviata si paga come le altre');
  // A new work cannot reuse the id of an archived one, and the executive does not repeat a type it finished recently.
  assert.ok(![...out.inst.works, ...out.inst.worksArchive].some((item, index, all) => all.findIndex(other => other.id === item.id) !== index), 'Nessun identificativo duplicato tra elenco e archivio');
  assert.deepEqual(W.availableWorkTypes({ ...out.inst, works: [], acts: [] }, 'sport', '2025-03-01').map(type => type.id).filter(id => id === 'piscina' || id === 'palazzetto'), [], 'Le opere archiviate contano per non ripetere lo stesso tipo troppo presto');
}

// ---------- 13. the tension of a work in trouble on the majority ----------
{
  const groups3 = [{ id: 'a', label: 'Lista A', axis: -1, seats: 10, side: 'maggioranza' }, { id: 'b', label: 'Lista B', axis: -0.5, seats: 6, side: 'maggioranza' }, { id: 'c', label: 'Lista C', axis: 0, seats: 4, side: 'maggioranza' }, { id: 'opp', label: 'Opposizione', axis: 2, seats: 4, side: 'opposizione' }];
  const council = settled(make('comune', { groups: groups3, playerGroupId: 'a', leaderGroupId: 'a', leaderIsPlayer: false }));
  const running = { ...council, budget: { ...council.budget, margin: 70 }, works: [{ id: 'w1', actId: 'x', typeId: 'palazzetto', label: 'Palazzetto dello sport', title: 'Palazzetto', area: 'sport', site: 'periferia', funding: 100, cost: 7, budget0: 7, compensation: 0, committed: 2.8, drawn: 2.8, refunded: 0, progress: 40, weeks: 40, stage: 'cantiere', delayWeeks: 0, overruns: 0, scope: 1, boost: 0, stall: 0, pending: null, upkeepYear: 0.35, upkeepIn: null, condition: 100, quality: 1, byPlayer: false, goal: null, territory: { region: 'Toscana' }, approvedAt: '2026-06-01', source: 'simulation' }] };
  const calm = () => 0.99;
  const cohesion = inst => Object.fromEntries(inst.groups.map(group => [group.id, group.cohesion]));
  const base = cohesion(running);
  const step = (inst, patch = {}) => W.advanceWorks({ ...inst, works: inst.works.map(work => ({ ...work, ...patch })) }, { date: '2027-03-01', rand: calm });
  const holder = new Set(council.executive.members.filter(member => (PORTFOLIO_AREAS.comune[member.portfolio] ?? []).includes('sport')).map(member => member.groupId));
  // Below the first threshold: nothing.
  const quiet = step(running, { delayWeeks: 7 });
  assert.deepEqual(cohesion(quiet.inst), base, 'Sotto la soglia di ritardo i gruppi non pagano nulla');
  assert.ok(!quiet.events.some(item => item.type === 'opera-tensione'), 'E nessun evento di tensione');
  // The first threshold: 8 weeks.
  const first = step(running, { delayWeeks: 8 });
  const tension = first.events.filter(item => item.type === 'opera-tensione');
  assert.equal(tension.length, 1, 'Alla soglia delle otto settimane scatta una sola tensione');
  const lost = id => base[id] - cohesion(first.inst)[id];
  assert.ok(lost('a') >= 0 && lost('b') > 0 && lost('c') > 0 && lost('opp') === 0, 'Pagano i gruppi della maggioranza, l’opposizione no');
  assert.ok([...holder].every(id => lost(id) >= Math.max(...['a', 'b', 'c'].filter(other => !holder.has(other)).map(lost))), 'Chi ha la delega dell’opera ne risponde di più');
  assert.ok(lost('a') <= lost('b') || holder.has('a'), 'Il gruppo di chi guida l’esecutivo ne risponde un po’ meno');
  assert.equal(first.inst.pressure, running.pressure, 'Non muove la pressione dell’opposizione');
  assert.equal(first.inst.executive.stability, running.executive.stability, 'Non muove la stabilità dell’esecutivo: sono altri indicatori');
  assert.ok(first.inst.works[0].fallout.includes('ritardo-8'), 'La soglia è segnata sull’opera');
  // The same problem, unchanged, does not cost again, week after week.
  let held = first.inst;
  for (let n = 0; n < 6; n++) { const next = W.advanceWorks(held, { date: advanceDays('2027-03-01', 7 * (n + 1)), rand: calm }); assert.ok(!next.events.some(item => item.type === 'opera-tensione'), 'Nessuna ripetizione per lo stesso ritardo'); held = next.inst; }
  assert.deepEqual(cohesion(held), cohesion(first.inst), 'La coesione non scende ogni settimana per lo stesso problema');
  // Heavier and longer problems cost more, each threshold once.
  const second = W.advanceWorks({ ...held, works: held.works.map(work => ({ ...work, delayWeeks: 16 })) }, { date: '2027-04-20', rand: calm });
  const third = W.advanceWorks({ ...second.inst, works: second.inst.works.map(work => ({ ...work, delayWeeks: 26 })) }, { date: '2027-06-20', rand: calm });
  const cut = events => events.filter(item => item.type === 'opera-tensione').map(item => item.loss);
  assert.deepEqual([cut(first.events), cut(second.events), cut(third.events)], [[2], [3], [4]], 'La gravità cresce con la durata del ritardo');
  assert.ok(third.inst.groups.filter(group => group.side === 'maggioranza').every(group => group.cohesion < base[group.id]), 'Il danno si somma e resta');
  // It lasts: the cohesion of the groups drifts back only slowly.
  let later = third.inst;
  for (let n = 0; n < 4; n++) { later = week(later, advanceDays('2027-06-27', 7 * n), 'cohesion').inst; }
  assert.ok(['a', 'b', 'c'].some(id => later.groups.find(group => group.id === id).cohesion < base[id] - 2), 'Dopo qualche settimana il danno non è sparito');
  // An overrun left unanswered and a site stopped for lack of funds weigh once each.
  const overrun = step(running, { pending: { kind: 'sforamento', amount: 1, raised: true, waited: 0, waits: 2 } });
  assert.ok(overrun.events.some(item => item.type === 'opera-tensione' && item.why === 'sforamento senza risposta'), 'Uno sforamento rimasto senza risposta pesa');
  const again = W.advanceWorks(overrun.inst, { date: '2027-03-08', rand: calm });
  assert.ok(!again.events.some(item => item.type === 'opera-tensione'), 'Una sola volta');
  const starved = step({ ...running, budget: { ...running.budget, margin: 0 } }, { fundsWeeks: 6, fundsAlert: true });
  assert.ok(starved.events.some(item => item.type === 'opera-tensione' && /fondi/.test(item.why)), 'Un cantiere fermo per sei settimane senza fondi pesa');
  // A protest weighs on the groups (one point), once for each protest.
  const draws = [0.99, 0.99, 0];
  let call = 0;
  const protested = W.advanceWorks({ ...running, works: running.works.map(work => ({ ...work, delayWeeks: 5 })) }, { date: '2027-03-01', rand: () => draws[call++ % draws.length] });
  assert.ok(protested.events.some(item => item.type === 'opera-protesta') && protested.events.some(item => item.type === 'opera-tensione' && item.why === 'protesta'), 'Una protesta al cantiere pesa sulla maggioranza');
  // A suspension by the head of the executive costs more the further the work had gone, once for each suspension.
  const boss = { ...running, executive: { ...running.executive, leader: 'player' } };
  const stopped = W.suspendWork(boss, 'w1', '2027-03-01');
  assert.ok(['a', 'b', 'c'].every(id => stopped.inst.groups.find(group => group.id === id).cohesion < base[id]) && stopped.inst.works[0].fallout.includes('sospensione-1'), 'Sospendere un cantiere a metà costa coesione alla maggioranza');
  const early = W.suspendWork({ ...boss, works: boss.works.map(work => ({ ...work, progress: 5, drawn: 2.8 })) }, 'w1', '2027-03-01');
  assert.ok(stopped.inst.groups[0].cohesion <= early.inst.groups[0].cohesion, 'Più il lavoro è avanti, più pesa');
  const reopened = W.resumeWork(stopped.inst, 'w1');
  assert.deepEqual(cohesion(reopened.inst), cohesion(stopped.inst), 'Riaprire non costa altra coesione');
  // Only this council's groups move; there is no majority, nothing breaks.
  const none = step({ ...running, groups: running.groups.map(group => ({ ...group, side: 'opposizione' })) }, { delayWeeks: 30 });
  assert.ok(none.inst.groups.every(group => group.cohesion === base[group.id]), 'Senza gruppi di maggioranza non c’è nulla da incrinare');
  assert.deepEqual(step(running, { delayWeeks: 30 }).events.map(item => item.type), step(running, { delayWeeks: 30 }).events.map(item => item.type), 'Deterministico');
}

console.log('Opere locali verificate: catalogo per competenze (Comune, Provincia, Regione) e un Comune che non costruisce un ospedale; ciclo autorizzazioni, progetto, gara, cantiere, collaudo, apertura, con il margine che paga una volta (impegno, lavori, sforamenti, rifinanziamenti, sospensione e ripresa) e senza benefici prima dell’apertura; manutenzione e degrado; solo chi guida l’esecutivo decide, consiglieri e assessori propongono o seguono; servizi propri della Provincia con una quota alla Regione; un esecutivo che non ripete la stessa opera e non ne apre una dietro l’altra; salvataggi vecchi migrati; giudizio del mandato con le opere; determinismo; cofinanziamento tra enti con unità economica comune (euro simulati), approvazione dell’organo del partner, quote, scale diverse, fondi insufficienti e nessun doppio addebito; archivio delle opere concluse con manutenzione, degrado e totali del mandato invariati; tensioni sulla maggioranza per ritardi, sforamenti, proteste e sospensioni, una volta per soglia.');
