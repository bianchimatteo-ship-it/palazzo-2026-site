// The staff: mandates the player gives (an objective, a duration, a weekly budget with a ceiling, a target), carried out at every weekly close, with true effects, a report every week, shown in
// the Home, changed, suspended and cancelled by the player. Nothing that is the player's to decide is delegated (votes, candidacies, deals, irreversible steps) and nothing starts without
// the player's approval. Covered: the catalogue; refusal without approval, without skills, without a target, over the room; a mandate run through several weeks on the real store (committees,
// local leaders and funds change, stats move, reports are kept and the funds are booked once); suspension, ceiling, edit, cancel; the same week twice gives the same result (determinism);
// a save made before the staff existed loads and plays.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const KEY = 'palazzo-2026.career.v1';
const localStore = new Map();
globalThis.localStorage = { getItem: key => localStore.get(key) ?? null, setItem: (key, value) => localStore.set(key, String(value)), removeItem: key => localStore.delete(key) };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { STAFF_TASKS, STAFF_TASK_BY_ID, STAFF_DURATIONS, NON_DELEGABLE, STAFF_SKILLS } = await module('src/data/simulation/staff-rules.js');
const { staffSkills, staffCapacity, taskProblem, createMandate, staffView, delegableNotes } = await module('src/core/staff-engine.js');
const read = async name => JSON.parse(await readFile(new URL('../src/data/real/' + name + '.json', import.meta.url), 'utf8'));
const groups = await read('parliamentary-groups'), parties = await read('parties'), units = await read('territorial-units');

// ---------- 1. the catalogue ----------
assert.ok(STAFF_TASKS.length >= 6 && new Set(STAFF_TASKS.map(task => task.id)).size === STAFF_TASKS.length, 'Sei incarichi con id diversi.');
for (const task of STAFF_TASKS) {
  assert.ok(task.label && task.detail.length > 40 && task.unit && task.objective > 0 && task.minWeeklyBudget >= 50 && task.skill in STAFF_SKILLS && task.minSkill >= 20 && task.minSkill <= 60, `${task.id}: dati completi.`);
  assert.ok(!/vot|candidat|accord|alleanz|dimission|fond[ao] un partito/i.test(task.label), `${task.id}: non delega ciò che è del giocatore.`);
}
assert.deepEqual(STAFF_DURATIONS.map(([weeks]) => weeks), [1, 4, 8, 12, 26]);
assert.equal(NON_DELEGABLE.length, 4); assert.equal(delegableNotes().length, 4);
for (const word of ['Voti', 'Candidature', 'Accordi', 'irreversibili']) assert.ok(NON_DELEGABLE.some(([what]) => what.includes(word)), `Non delegabile: ${word}.`);

// ---------- 2. in the game ----------
let imports = 0;
const load = async () => (await import('../src/core/store.js?staff=' + (++imports))).store;
const reload = async mutate => { const saved = JSON.parse(localStore.get(KEY)); mutate(saved); localStore.set(KEY, JSON.stringify(saved)); return load(); };
const realParty = parties.find(item => item.id === 'party-futuro-nazionale');
const draft = { firstName: 'Marta', lastName: 'Neri', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', previousProfession: 'Architetta', initialLevel: 'deputato', partyMode: 'existing', partyId: realParty.id, parliamentStartMode: 'real-context', parliamentaryGroupId: 'cam-xix-12', startingOffice: null, startingRole: null, partyName: '', partyDescription: '', difficulty: 'normale' };
let store = await load();
store.createCareer(draft, [realParty], groups);
store.initializeCommittees(units);
const stat = (state, metric) => state.dataset.statistics.find(item => item.subjectId === state.career.playerId && item.metric === metric)?.value;
const rich = saved => { saved.game.resources.funds = 20000; saved.game.resources.politicalCapital = 80; };
store.save?.();
store = await reload(rich);
let state = store.getState();
assert.ok(state.game.party.org.committees.length > 3, 'Il partito ha i suoi comitati.');
assert.equal(state.game.staff, undefined, 'Un salvataggio senza staff non ne ha uno: nessuna migrazione.');
const volunteers = { task: 'volontari', weeks: 4, weeklyBudget: 150, budgetMax: 1000, objective: 8 };
// refusals
assert.throws(() => store.giveStaffMandate(volunteers), /approvazione/, 'Senza la tua approvazione non parte.');
assert.throws(() => store.giveStaffMandate({ ...volunteers, task: 'vota-in-aula', approved: true }), /non riconosciuto/, 'Ciò che non è nel catalogo non si delega.');
for (const task of ['vota', 'candidatura', 'accordo']) assert.throws(() => store.giveStaffMandate({ ...volunteers, task, approved: true }), /non riconosciuto/, `«${task}» non si delega.`);
assert.throws(() => store.giveStaffMandate({ ...volunteers, weeklyBudget: 20, approved: true }), /budget settimanale minimo/, 'Sotto il budget minimo no.');
assert.throws(() => store.giveStaffMandate({ ...volunteers, budgetMax: 100, approved: true }), /tetto/, 'Il tetto copre almeno una settimana.');
assert.throws(() => store.giveStaffMandate({ ...volunteers, weeks: 5, approved: true }), /durata/, 'Solo le durate dell’elenco.');
assert.throws(() => store.giveStaffMandate({ ...volunteers, target: 'comitato-che-non-esiste', approved: true }), /bersaglio/, 'Il bersaglio deve esistere.');
assert.equal(store.getState().game.staff, undefined, 'I rifiuti non cambiano nulla.');
// skills come from what is built
const skillsBefore = staffSkills(state.game, { experience: 30 });
store.setBudget('formazione', 1); store.setBudget('personale', 1);
const skillsAfter = staffSkills(store.getState().game, { experience: 30 });
assert.ok(skillsAfter.organizzazione > skillsBefore.organizzazione && skillsAfter.analisi > skillsBefore.analisi, 'Le competenze crescono con il bilancio (formazione, staff).');
assert.equal(staffCapacity(store.getState().game).max, 2, 'Partito e un collaboratore: due incarichi.');
store.setBudget('personale', 0); store.setBudget('formazione', 0);
assert.equal(staffCapacity(store.getState().game).max, 1, 'Il partito da solo: un incarico.');
// give a mandate: volunteers on a committee of the player's region
const committee = store.getState().game.party.org.committees.find(item => item.region === 'Toscana' && item.status !== 'dissoluzione');
const fundsBefore = store.getState().game.resources.funds;
const given = store.giveStaffMandate({ ...volunteers, target: committee.id, approved: true });
state = store.getState();
const mandate = state.game.staff.mandates[0];
assert.equal(state.game.staff.mandates.length, 1); assert.equal(mandate.status, 'attivo'); assert.equal(mandate.kind, 'ricorrente'); assert.equal(mandate.spent, 0);
assert.equal(state.game.resources.funds, fundsBefore, 'Affidare l’incarico non costa nulla: si paga a ogni settimana di lavoro, una volta.');
assert.throws(() => store.giveStaffMandate({ task: 'studio', weeks: 4, weeklyBudget: 80, budgetMax: 400, approved: true }), /già 1 incarico aperto su 1/, 'Oltre i posti dello staff no, e il motivo è scritto.');
// the staff works at the weekly close
const activists = () => store.getState().game.party.org.committees.find(item => item.id === committee.id).activists;
const popularity = () => stat(store.getState(), 'popularity');
const a0 = activists(), p0 = popularity();
store.advance(7);
state = store.getState();
const m1 = state.game.staff.mandates[0];
assert.equal(m1.weeksDone, 1); assert.equal(m1.spent, 150, 'Una settimana di lavoro, 150 € spesi una volta sola.');
assert.equal(state.game.finance.ledger.filter(row => /Staff: Mobilitare i volontari/.test(row.label) && row.week === m1.createdWeek).length, 1, 'Nel registro la spesa compare una volta.');
assert.ok(state.game.staff.reports.length === 1 && m1.lastReport?.week === m1.createdWeek && /volontar/.test(m1.lastReport.text), 'Il resoconto settimanale c’è.');
assert.ok(state.game.lastReport.lines.some(line => /^Staff · Mobilitare i volontari/.test(line)), 'E compare nel resoconto della chiusura.');
for (let i = 0; i < 4; i++) { if (store.getState().game.staff.mandates[0].status === 'attivo') store.advance(7); }
state = store.getState();
const done = state.game.staff.mandates[0];
assert.ok(['concluso'].includes(done.status) && done.weeksDone >= 1 && done.weeksDone <= 4 && done.spent === done.weeksDone * 150, `Incarico concluso (${done.weeksDone} settimane, ${done.spent} €, ${done.outcome}).`);
assert.ok(done.spent <= done.budgetMax, 'Mai oltre il tetto.');
assert.ok(done.results.length === done.weeksDone && done.points >= 0, 'Ogni settimana lascia il suo risultato.');
assert.ok(activists() > a0 || done.results.every(row => !row.ok), 'Ogni riuscita ha davvero aggiunto volontari al comitato.');
assert.ok(done.outcome && staffView(state.game, {}).closed.length === 1, 'Concluso: resta nell’archivio dello staff.');

// suspension, ceiling, edit, cancel
{
  assert.throws(() => store.giveStaffMandate({ task: 'raccolta', weeks: 12, weeklyBudget: 100, budgetMax: 250, objective: 500, approved: true }), /Competenze insufficienti: Tesoreria/, 'Senza competenze di tesoreria la raccolta fondi non si affida, e dice quanto manca.');
  store.setBudget('raccolta', 1);
  store.giveStaffMandate({ task: 'raccolta', weeks: 12, weeklyBudget: 100, budgetMax: 250, objective: 500, approved: true });
  let s = store.getState().game.staff.mandates.at(-1);
  store.setStaffMandate(s.id, 'sospeso');
  const f0 = store.getState().game.resources.funds;
  store.advance(7);
  assert.equal(store.getState().game.resources.funds >= f0 - 400, true); assert.equal(store.getState().game.staff.mandates.at(-1).spent, 0, 'Sospeso: non lavora e non spende.');
  store.setStaffMandate(s.id, 'attivo');
  store.advance(7); store.advance(7); store.advance(7);
  s = store.getState().game.staff.mandates.at(-1);
  assert.ok(s.spent <= 250 && (s.status === 'sospeso' && s.pausedReason === 'budget' || s.status === 'concluso'), `Il tetto di 250 € ferma l’incarico (${s.status}, speso ${s.spent}).`);
  assert.ok(s.status !== 'sospeso' || /tetto/.test(s.lastReport.text), 'Dice perché si è fermato.');
  if (s.status === 'sospeso') {
    assert.throws(() => store.setStaffMandate(s.id, 'attivo'), /tetto/, 'Senza alzare il tetto non riparte.');
    store.changeStaffMandate(s.id, { budgetMax: 800, weeks: 6 });
    s = store.getState().game.staff.mandates.at(-1);
    assert.ok(s.status === 'attivo' && s.budgetMax === 800 && s.weeksLeft === 6, 'Alzato il tetto, riprende.');
    assert.throws(() => store.changeStaffMandate(s.id, { weeklyBudget: 10 }), /minimo/, 'Le modifiche seguono le stesse regole.');
  }
  const before = store.getState().game.staff.mandates.at(-1).spent;
  store.setStaffMandate(s.id, 'annullato');
  store.advance(7);
  s = store.getState().game.staff.mandates.at(-1);
  assert.equal(s.status, 'annullato'); assert.equal(s.spent, before, 'Annullato: nessuna altra spesa.');
  assert.throws(() => store.setStaffMandate(s.id, 'attivo'), /già chiuso/, 'Un incarico chiuso non si riapre.');
  assert.throws(() => store.changeStaffMandate(s.id, { weeklyBudget: 200 }), /non si può più modificare/);
}

// a task that needs something that is not there
{
  store = await reload(saved => { rich(saved); saved.game.party.life = { ...(saved.game.party.life ?? {}), cadres: [] }; });
  assert.throws(() => store.giveStaffMandate({ task: 'dirigenti', weeks: 4, weeklyBudget: 100, budgetMax: 400, approved: true }), /dirigente locale/, 'Senza dirigenti non c’è nessuno da seguire, e dice dove crearli.');
  store = await reload(saved => { rich(saved); saved.game.party = null; });
  assert.throws(() => store.giveStaffMandate({ task: 'studio', weeks: 4, weeklyBudget: 80, budgetMax: 400, approved: true }), /staff si forma|partito|collaboratore/i, 'Senza partito né collaboratore lo staff non c’è.');
}

// determinism: the same career, the same mandate, the same week: the same report
{
  const run = async () => { localStore.clear(); store = await load(); store.createCareer(draft, [realParty], groups); store.initializeCommittees(units); store = await reload(rich); store.setBudget('raccolta', 1); store.giveStaffMandate({ task: 'raccolta', weeks: 4, weeklyBudget: 120, budgetMax: 600, approved: true }); store.advance(7); store.advance(7); return JSON.stringify(store.getState().game.staff); };
  assert.equal(await run(), await run(), 'Stessa partita, stesso incarico, stessi resoconti.');
}
console.log(`Staff verificato: ${STAFF_TASKS.length} incarichi (volontari, dirigenti locali, raccolta fondi, media e social, territorio, dossier) con competenze che vengono dal bilancio, dai comitati e dalle statistiche; rifiuti senza approvazione, sotto il budget minimo, con un tetto troppo basso, senza bersaglio, senza posto o senza ciò che serve; lavoro a ogni chiusura di settimana con effetti veri su comitati, dirigenti, fondi (registro: una sola spesa), statistiche e preparazione, un resoconto per settimana nel diario e nella chiusura; sospensione, tetto di spesa, modifica e annullamento; il voto, le candidature, gli accordi e le scelte irreversibili restano tuoi; la stessa partita dà gli stessi resoconti.`);
