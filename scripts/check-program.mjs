// The programme and the promises, engine level (core/program-engine.js): making, credibility, the weekly check against laws/bills/indicators, the states and their consequences (once),
// modifying and withdrawing, the priorities of the Government derived from what was promised, the accord's commitments shown beside, the programmes of the rivals.
import assert from 'node:assert/strict';
import { AMBITIONS, PROMISE_RULES, PROMISE_SETTLED, PROMISE_STATES, accordPromises, credibility, derivePriorities, evaluatePromise, makePromise, modifyPromise, promiseQuote, promisesOf, rivalProgram, settleEffects, tickPromises, topicOfArea, withdrawPromise } from '../src/core/program-engine.js';
import { DEBATE_TOPICS } from '../src/data/simulation/campaign-rules.js';

const society = (over = {}) => ({ economy: { deficit: 3.0 }, regions: { Toscana: { indicators: { sanita: 50, occupazione: 55 } } }, lawsApplied: [], ...over });
const ctx = (week, extra = {}) => ({ week, date: `2027-01-${String(10 + (week % 18)).padStart(2, '0')}`, society: society(), parliament: { laws: [], lawArchive: [] }, inMajority: true, instability: false, ...extra });
const game = (promises = [], party = null) => ({ promises, party });

// ---------- topics and quotes ----------
for (const id of ['sanita', 'scuola', 'fisco', 'sicurezza', 'lavoro', 'ambiente', 'giustizia', 'welfare']) assert.ok(DEBATE_TOPICS.some(topic => topic.id === topicOfArea(id)), `${id}: l’area ha un tema di dibattito.`);
assert.ok(promiseQuote({ area: 'sanita', instrument: 'investimento', ambition: 'ambiziosa' }).cost > promiseQuote({ area: 'sanita', instrument: 'investimento', ambition: 'prudente' }).cost, 'Più ambiziosa costa di più.');
assert.ok(promiseQuote({ area: 'sanita', instrument: 'riforma' }).cost < promiseQuote({ area: 'sanita', instrument: 'investimento' }).cost, 'Una riforma costa meno di un investimento.');
assert.equal(promiseQuote({ area: 'nonesiste' }), null);

// ---------- making ----------
const made = makePromise(game(), { area: 'sanita', scope: 'candidato', instrument: 'investimento', ambition: 'media', region: 'Toscana' }, { week: 10, date: '2027-01-10', society: society() });
assert.equal(made.promise.status, 'non-avviata');
assert.equal(made.promise.baseline, 50, 'La promessa registra il valore di partenza dell’indicatore.');
assert.equal(made.promise.dueWeek, 10 + AMBITIONS.media.weeks);
assert.ok(made.promise.objective && made.promise.intervention && made.promise.cost > 0, 'Obiettivo, intervento e costo sono dichiarati.');
assert.throws(() => makePromise(game([made.promise]), { area: 'sanita', scope: 'candidato' }, { week: 11, date: '2027-01-11', society: society() }), /già una promessa aperta/);
assert.throws(() => makePromise(game(), { area: 'x' }, { week: 1, date: '2027-01-01' }), /area politica/);
assert.throws(() => makePromise(game(), { area: 'sanita', scope: 'boh' }, { week: 1, date: '2027-01-01' }), /nome di chi/);
// a different scope on the same area is another commitment
assert.doesNotThrow(() => makePromise(game([made.promise]), { area: 'sanita', scope: 'governo' }, { week: 11, date: '2027-01-11', society: society() }));

// ---------- credibility ----------
const base = credibility(game(), { society: society() }).score;
const many = ['sanita', 'scuola', 'lavoro', 'sicurezza', 'ambiente', 'giustizia'].map((area, index) => makePromise(game(), { area, scope: 'candidato', ambition: 'ambiziosa' }, { week: index, date: '2027-01-01', society: society() }).promise);
const crowded = credibility(game(many), { society: society() });
assert.ok(crowded.score < base, 'Promettere tutto a tutti toglie credibilità.');
assert.ok(crowded.overload > 0 && crowded.notes.some(line => /Troppe promesse/.test(line)), 'Il sovraccarico è spiegato.');
const clash = credibility(game([makePromise(game(), { area: 'fisco', scope: 'candidato' }, { week: 1, date: '2027-01-01' }).promise, makePromise(game(), { area: 'welfare', scope: 'candidato' }, { week: 1, date: '2027-01-01' }).promise]), { society: society() });
assert.ok(clash.conflicts.length >= 1 && clash.notes.some(line => /direzioni opposte/.test(line)), 'Tagliare le tasse e spendere in welfare è una contraddizione dichiarata.');
const broken = credibility(game([{ ...made.promise, status: 'non-mantenuta' }]), { society: society() }).score;
const kept = credibility(game([{ ...made.promise, status: 'mantenuta' }]), { society: society() }).score;
assert.ok(kept > base && broken < base, 'Mantenere alza la credibilità, tradire la abbassa.');
const four = many.slice(0, 4);
assert.ok(credibility(game(four), { society: society({ economy: { deficit: 5.5 } }) }).score < credibility(game(four), { society: society() }).score, 'Con i conti in disordine la copertura manca.');

// ---------- the weekly check ----------
const open = { ...made.promise };
let r = evaluatePromise(open, ctx(12));
assert.equal(r.status, 'non-avviata', 'Senza provvedimenti, nei tempi: non avviata.');
const bill = (stage, over = {}) => ({ id: 'l1', title: 'Legge sulla sanità', stage, introducedAt: '2027-02-01', policy: { area: 'sanita' }, ...over });
r = evaluatePromise(open, ctx(15, { parliament: { laws: [bill('amendments')], lawArchive: [] } }));
assert.equal(r.status, 'in-corso'); assert.equal(r.progress, 50, 'L’avanzamento segue lo stato del provvedimento.');
r = evaluatePromise(open, ctx(30, { society: society({ lawsApplied: [{ area: 'sanita', title: 'Piano sanità', week: 20, lawId: 'l1' }], regions: { Toscana: { indicators: { sanita: 53, occupazione: 55 } } } }) }));
assert.equal(r.status, 'mantenuta', 'Misura in vigore e indicatore migliorato: mantenuta.');
r = evaluatePromise(open, ctx(30, { society: society({ lawsApplied: [{ area: 'sanita', title: 'Piano sanità', week: 20 }] }) }));
assert.equal(r.status, 'in-corso', 'Misura in vigore ma obiettivo non raggiunto, prima della scadenza: ancora in corso (non basta aver avviato).');
r = evaluatePromise(open, ctx(open.dueWeek + 1, { society: society({ lawsApplied: [{ area: 'sanita', title: 'Piano sanità', week: 20 }] }) }));
assert.equal(r.status, 'parzialmente-mantenuta', 'Scaduta con la misura ma senza il risultato: parziale.');
r = evaluatePromise(open, ctx(open.dueWeek + 2));
assert.equal(r.status, 'ritardata', 'Scaduta e senza esito: ritardata, entro il periodo di tolleranza.');
assert.ok(r.impediments.some(line => /Nessun provvedimento/.test(line)), 'Gli ostacoli sono detti.');
r = evaluatePromise(open, ctx(open.dueWeek + PROMISE_RULES.grace + 1));
assert.equal(r.status, 'non-mantenuta', 'Oltre la tolleranza: non mantenuta.');
r = evaluatePromise(open, ctx(open.dueWeek + PROMISE_RULES.grace + 1, { parliament: { laws: [bill('other-chamber')], lawArchive: [] } }));
assert.equal(r.status, 'parzialmente-mantenuta', 'Un provvedimento avanzato ma non concluso vale come parziale.');
r = evaluatePromise({ ...open, scope: 'governo' }, ctx(20, { inMajority: false, parliament: { laws: [bill('commission', { introducedAt: '2027-01-20' })], lawArchive: [] } }));
assert.ok(r.impediments.some(line => /Non guidi la maggioranza/.test(line)), 'Chi non guida la maggioranza lo vede come ostacolo.');
r = evaluatePromise(open, ctx(20, { instability: true }));
assert.ok(r.impediments.some(line => /instabile/.test(line)), 'L’instabilità del Governo è un ostacolo.');

// ---------- ticks: settled once, with consequences ----------
const g0 = game([{ ...open }, { ...makePromise(game(), { area: 'scuola', scope: 'partito' }, { week: 10, date: '2027-01-10', society: society() }).promise }]);
let t = tickPromises(g0, ctx(open.dueWeek + PROMISE_RULES.grace + 2));
assert.equal(t.settled.length, 2, 'Le due promesse scadute sono chiuse in questo passaggio.');
assert.ok(t.settled.every(item => item.effects.reputation < 0 && item.effects.popularity < 0), 'Le promesse non mantenute costano reputazione e popolarità.');
assert.ok(t.promises.every(item => PROMISE_SETTLED.includes(item.status) && item.settledWeek), 'Lo stato finale è registrato con la settimana.');
const again = tickPromises({ promises: t.promises }, ctx(open.dueWeek + PROMISE_RULES.grace + 3));
assert.equal(again.settled.length, 0, 'Una promessa chiusa non si chiude due volte: nessun effetto doppio.');
// the second broken promise weighs more than the first (the record)
assert.ok(Math.abs(t.settled[1].effects.reputation) > Math.abs(t.settled[0].effects.reputation) - 0.01, 'Chi ha già tradito pesa di più.');
// kept: positive, coalition promises move the allies, party promises the party
const keptPromise = { ...open, scope: 'coalizione', status: 'mantenuta' };
assert.ok(settleEffects(keptPromise, 'mantenuta').partner > 0 && settleEffects({ ...keptPromise, scope: 'partito' }, 'mantenuta').party > 0);
assert.ok(settleEffects({ ...keptPromise, scope: 'coalizione' }, 'non-mantenuta').partner < 0, 'Una promessa di coalizione tradita pesa sugli alleati.');
// late notes
const late = tickPromises(game([{ ...open }]), ctx(open.dueWeek + 2));
assert.equal(late.notes.length, 1, 'Il passaggio a «ritardata» è raccontato una volta.');
assert.equal(tickPromises({ promises: late.promises }, ctx(open.dueWeek + 3)).notes.length, 0, 'E non si ripete.');

// ---------- modify and withdraw ----------
const mod = modifyPromise(game([open]), open.id, { ambition: 'prudente', extraWeeks: 12 }, { week: 20, date: '2027-02-01', society: society() });
assert.equal(mod.closed.status, 'modificata'); assert.equal(mod.next.status, 'non-avviata');
assert.equal(mod.next.dueWeek, open.dueWeek + 12); assert.ok(mod.next.cost < open.cost, 'Un’ambizione minore costa meno.');
assert.ok(mod.effects.reputation < 0, 'Cambiare una promessa costa reputazione: la modifica si vede.');
assert.ok(mod.next.history.length > open.history.length, 'La storia della promessa resta.');
assert.throws(() => modifyPromise(game([mod.closed]), mod.closed.id, { ambition: 'media' }, { week: 21, date: '2027-02-02' }), /non si può più modificare/);
assert.throws(() => modifyPromise(game([open]), open.id, {}, { week: 21, date: '2027-02-02' }), /Nessun cambiamento/);
const wd = withdrawPromise(game([open]), open.id, { week: 22, date: '2027-02-03' });
assert.equal(wd.promise.status, 'non-mantenuta'); assert.ok(wd.effects.reputation > settleEffects(open, 'non-mantenuta').reputation, 'Ammettere costa meno che essere scoperti.');
assert.ok(wd.effects.reputation < 0, 'Ma costa.');

// ---------- Government, accord, rivals ----------
const pri = derivePriorities(game([{ ...open, scope: 'governo', status: 'in-corso' }, { ...makePromise(game(), { area: 'lavoro', scope: 'candidato' }, { week: 1, date: '2027-01-01' }).promise }], { program: { areas: ['sicurezza', 'sanita', 'ambiente'] } }), { government: { accord: { commitments: [{ kind: 'misura', area: 'fisco' }, { kind: 'linea-rossa', area: 'difesa' }] } } });
assert.equal(pri[0], 'sanita', 'Le promesse di governo vengono per prime.');
assert.ok(pri.includes('sicurezza') && pri.length <= 5, 'Poi il programma del partito, al massimo cinque.');
assert.ok(!pri.includes('difesa'), 'Le linee rosse dell’accordo non sono priorità.');
assert.ok(derivePriorities(game([]), null).length === 0);
const accord = accordPromises({ government: { accord: { commitments: [{ id: 'a1', kind: 'misura', area: 'sanita', status: 'aperto', groupId: 'g' }, { id: 'a2', kind: 'misura', area: 'fisco', status: 'mantenuto', groupId: 'g' }, { id: 'a3', kind: 'ministero', portfolio: 'x' }] } } });
assert.equal(accord.length, 2); assert.equal(accord[0].scope, 'coalizione'); assert.equal(accord[1].status, 'mantenuta'); assert.ok(accord[0].id.startsWith('accordo:'));
assert.deepEqual(rivalProgram({ parties: [{ id: 'p', agenda: ['sanita', 'fisco', 'finta', 'lavoro', 'scuola'] }] }, 'p'), ['sanita', 'fisco', 'lavoro']);
assert.deepEqual(rivalProgram({ parties: [] }, 'p'), []);
assert.ok(Object.keys(PROMISE_STATES).length === 7, 'Sette stati: non avviata, in corso, mantenuta, parzialmente mantenuta, ritardata, modificata, non mantenuta.');
assert.equal(promisesOf({ promises: [{ kind: 'territorio' }, { kind: 'programma' }] }).length, 1, 'Le promesse territoriali di prima restano a parte.');
console.log('Programma e promesse (motore) verificati: creazione con costo e obiettivo, credibilità (sovraccarico, contraddizioni, copertura, storia), sette stati con avanzamento e ostacoli, conseguenze una sola volta, modifica e ritiro, priorità del Governo dalle promesse, impegni di coalizione e programmi dei rivali.');
