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

console.log('Opere locali verificate: catalogo per competenze (Comune, Provincia, Regione) e un Comune che non costruisce un ospedale; ciclo autorizzazioni, progetto, gara, cantiere, collaudo, apertura, con il margine che paga una volta (impegno, lavori, sforamenti, rifinanziamenti, sospensione e ripresa) e senza benefici prima dell’apertura; manutenzione e degrado; solo chi guida l’esecutivo decide, consiglieri e assessori propongono o seguono; servizi propri della Provincia con una quota alla Regione; un esecutivo che non ripete la stessa opera e non ne apre una dietro l’altra; salvataggi vecchi migrati; giudizio del mandato con le opere; determinismo.');
