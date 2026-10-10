// The term of the President of the Republic who is the player: the decisions come from the state of the Chambers and of the Government (a decree-law just adopted, a law just approved,
// a clash between powers, a judge to name, a visit), each one leaves a commitment that is checked weeks later against what the Chambers and the country really did, and none of them
// touches the budget (the President does not manage it). Daily events are those of the office. Everything goes through save, reload and the ordinary weeks.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer, fingerprint } from './lib/long-run.mjs';

const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const careerEngine = await import(`../src/core/career-engine.js${v}`);
const presidencyEngine = await import(`../src/core/presidency-engine.js${v}`);
const rules = await import(`../src/data/simulation/presidency-rules.js${v}`);
const daily = await import(`../src/data/simulation/daily-events.js${v}`);
const { checkInvariants } = await import(`../src/core/invariants.js${v}`);
const presidencyUi = await import(`../src/ui/presidency-view.js${v}`);

const president = async seed => startCareer({ seed, level: 'deputato', draft: { startingOffice: 'presidenteRepubblica', partyMode: 'independent', partyId: null, birthDate: '1960-03-04', startingRole: null } });
const run = await president('quirinale-mandato');
const { store } = run;
const st = () => store.getState();
const edit = change => { const save = JSON.parse(store.exportSave()); change(save); store.loadGame(save); };
const incumbent = () => st().presidency.incumbent;
const inbox = id => st().game.inbox.find(item => item.templateId === id);
const raise = (id, params = {}) => edit(save => { save.game.inbox = save.game.inbox.filter(item => item.templateId !== id); save.game = careerEngine.addSituationEvent(save.game, id, params, true); });
const answer = (id, choice) => { const item = inbox(id); assert.ok(item, `${id}: la decisione è in agenda`); store.resolveAgendaItem(item.id, choice); };
const weeks = count => { for (let week = 0; week < count; week++) store.advance(7); };
const keepCalm = () => edit(save => { if (save.parliament?.government) Object.assign(save.parliament.government, { stability: 70, status: 'active', crisisSeverity: 0 }); });

assert.equal(st().career.currentLevel, 'presidente');
assert.equal(incumbent().kind, 'giocatore');
assert.ok(st().parliament.government?.status === 'active', 'C’è un governo in carica.');
const govLaw = (id, extra = {}) => ({ id, title: `Legge di prova ${id}`, category: 'Sanità', summary: 'Legge di prova per il Quirinale', origin: 'governo', auto: true, kind: 'legge', stage: 'approved', status: 'approved', policy: { area: 'sanita', instrument: 'investimento', intensity: 2, financing: 'deficit' }, amendments: [], votes: [], demands: {}, sponsor: { kind: 'governo' }, updatedAt: st().clock.currentDate, source: 'simulation', ...extra });

// ---------- 1. the schedule of the Quirinale comes from the state, not from the calendar ----------
// A decree-law just adopted by the Government lands on the desk of the President at once, with its title.
edit(save => {
  save.parliament.laws.push(govLaw('decreto-prova', { title: 'Decreto sull’emergenza sanitaria', kind: 'decreto', stage: 'commission', status: 'commission', inForce: true, deadline: '2027-01-30', updatedAt: save.clock.currentDate }));
  save.parliament.history.push({ id: 'attivita-prova-decreto', date: save.clock.currentDate, type: 'decreto-adottato', text: 'Il Consiglio dei ministri adotta il decreto-legge', details: { lawId: 'decreto-prova' }, source: 'simulation' });
  save.game.inbox = [];
});
keepCalm();
weeks(1);
const decreeAsk = inbox('presidente-decreto');
assert.ok(decreeAsk && decreeAsk.params.lawId === 'decreto-prova' && /emergenza sanitaria/.test(decreeAsk.title), 'Il decreto appena adottato arriva al Quirinale con il suo titolo.');
// The President does not manage the budget: no decision of the office moves the public finance.
const accountsOf = () => JSON.stringify({ headroom: st().society.publicFinance.headroom, budget: st().society.publicFinance.budget, allocations: st().society.publicFinance.allocations, committed: st().society.publicFinance.committed, projects: st().society.projects ?? [], eu: st().society.publicFinance.eu ?? null });
const accounts = accountsOf();
const credit0 = incumbent().credit, stab0 = st().parliament.government.stability;
answer('presidente-decreto', 'rilievi');
assert.equal(accountsOf(), accounts, 'Una decisione del Quirinale non tocca il bilancio.');
assert.ok(incumbent().credit > credit0 || incumbent().acts[0].act === 'decreto-rilievi', 'La lettera di rilievi dà credito subito.');
const letter = incumbent().ledger.find(item => item.kind === 'rilievi');
assert.ok(letter && letter.lawId === 'decreto-prova' && letter.dueWeek > st().game.week.index, 'E apre un impegno da verificare sul decreto.');
// Convert the decree with an amendment: the letter worked. Without, it did not.
edit(save => { const law = save.parliament.laws.find(item => item.id === 'decreto-prova'); law.amendments = [{ id: 'em-1', text: 'Corretto dopo i rilievi', date: save.clock.currentDate }]; });
keepCalm();
const creditBefore = incumbent().credit;
weeks(9);
const checked = (incumbent().verified ?? []).find(item => item.kind === 'rilievi');
assert.ok(checked && checked.success, 'Il decreto è stato corretto in conversione: la lettera di rilievi risulta efficace.');
assert.ok(st().presidency.log.some(item => item.kind === 'impegno' && /corretto in sede di conversione/.test(item.text)), 'La verifica è nella cronaca del Colle.');
assert.ok(incumbent().credit !== creditBefore, 'E sposta il credito.');
// Refusing a decree makes it lapse and weakens the Government.
edit(save => {
  save.parliament.laws.push(govLaw('decreto-rifiuto', { title: 'Decreto sulle accise', kind: 'decreto', stage: 'commission', status: 'commission', inForce: true, deadline: '2027-03-30' }));
  save.parliament.history.push({ id: 'attivita-prova-decreto-2', date: save.clock.currentDate, type: 'decreto-adottato', text: 'Il Consiglio dei ministri adotta il decreto-legge', details: { lawId: 'decreto-rifiuto' }, source: 'simulation' });
  save.game.inbox = [];
});
keepCalm();
weeks(1);
const stabilityBefore = st().parliament.government.stability;
answer('presidente-decreto', 'rifiuta');
assert.equal(st().parliament.laws.find(item => item.id === 'decreto-rifiuto').stage, 'lapsed', 'Il decreto rifiutato decade.');
assert.ok(st().parliament.government.stability < stabilityBefore - 3, 'E indebolisce il governo.');
assert.ok(st().game.memory.some(item => /rifiutato di emanare/.test(item.text)), 'La scelta resta nella memoria politica.');

// A law approved with the confidence vote: promulgate, promulgate with a letter, or send it back (once).
edit(save => { save.parliament.laws.push(govLaw('legge-fiducia', { title: 'Riforma dei servizi', confidence: true })); save.game.inbox = []; });
keepCalm();
weeks(1);
assert.ok(inbox('presidente-legge') && inbox('presidente-legge').params.lawId === 'legge-fiducia', 'Una legge approvata con la fiducia arriva al Colle.');
const creditLaw = incumbent().credit;
answer('presidente-legge', 'rinvia');
assert.equal(st().parliament.laws.find(item => item.id === 'legge-fiducia').stage, 'final-vote', 'La legge torna alle Camere.');
assert.ok(incumbent().returned.some(item => item.lawId === 'legge-fiducia') && incumbent().ledger.some(item => item.kind === 'rinvio'), 'Il rinvio è registrato e apre una verifica.');
assert.ok(incumbent().credit > creditLaw, 'Il rinvio dà credito.');
assert.throws(() => store.presidentReturnLaw('legge-fiducia'), /una volta sola|approvata/, 'Una legge si rinvia una volta sola.');
edit(save => { const law = save.parliament.laws.find(item => item.id === 'legge-fiducia'); law.stage = 'approved'; law.amendments = [{ id: 'em-2', text: 'Corretta prima del nuovo voto', date: save.clock.currentDate }]; });
keepCalm();
weeks(7);
assert.ok((incumbent().verified ?? []).some(item => item.kind === 'rinvio' && item.success), 'Le Camere hanno corretto il testo: il rinvio risulta riuscito.');

// ---------- 2. nominations, diplomacy, clashes between powers ----------
const accounts2 = accountsOf();
raise('presidente-corte', { named: 'nessuno' });
answer('presidente-corte', 'magistrato');
assert.deepEqual(incumbent().court.map(item => item.profile), ['magistrato'], 'Il giudice nominato resta nel mandato.');
assert.ok(incumbent().ledger.some(item => item.kind === 'corte' && item.profile === 'magistrato'), 'E la Corte lo giudicherà alla prova.');
// The Court rules on a law of the Government: with some profiles and draws it strikes it, undoing its effects.
{
  const probe = { ...st().presidency, seed: 'prova-sentenza' };
  const lawFor = id => govLaw(id, { updatedAt: '2026-11-01' });
  let struck = null, spared = null;
  for (let n = 0; n < 60 && !(struck && spared); n++) {
    const entry = { id: `impegno-prova-${n}`, kind: 'corte', profile: n % 2 ? 'magistrato' : 'avvocato', date: '2026-11-01', dueWeek: 1, week: 0 };
    const out = presidencyEngine.settleLedger({ ...probe, incumbent: { ...probe.incumbent, ledger: [entry] } }, { week: 2, date: '2027-03-01', parliament: { laws: [lawFor('l1')], history: [], government: st().parliament.government }, society: st().society });
    const result = out.results[0];
    if (result.annul) struck ??= result; else spared ??= result;
  }
  assert.ok(struck && spared && struck.annul === 'l1' && struck.credit < 0 && spared.credit > 0, 'La Corte può bocciare la legge del governo o lasciarla stare: due esiti, con effetti opposti sul credito.');
}
raise('presidente-diplomazia', { europa: 52, esteri: 50 });
const europeBefore = st().society.areas.europa.value;
answer('presidente-diplomazia', 'europa');
assert.ok(st().society.areas.europa.value > europeBefore, 'La visita a Bruxelles sposta subito i rapporti con l’Europa.');
const trip = incumbent().ledger.find(item => item.kind === 'diplomazia');
assert.ok(trip && trip.partner === 'europa', 'E apre una verifica sui frutti della visita.');
raise('presidente-diplomazia', { europa: 52, esteri: 50 });
answer('presidente-diplomazia', 'rinuncia');
assert.ok(incumbent().acts.some(item => item.act === 'diplomazia-rinuncia' && item.credit < 0), 'Rinunciare al viaggio costa un po’ di credito.');
raise('presidente-garanzia', { conflict: 'Le opposizioni accusano il governo di forzare le procedure.' });
const calmBefore = st().parliament.government.stability;
answer('presidente-garanzia', 'leader');
assert.ok(st().parliament.government.stability > calmBefore, 'Il chiarimento tra i leader calma il governo.');
assert.ok(incumbent().ledger.some(item => item.kind === 'garanzia' && Number.isFinite(item.baseline)), 'Con una verifica sul fatto che regga.');
assert.equal(accountsOf(), accounts2, 'Né le nomine, né la diplomazia, né le crisi di garanzia toccano il bilancio.');

// ---------- 3. the message to the Chambers is checked against what the Chambers approve ----------
edit(save => { save.society.issues = [{ id: 'issue-prova', scope: 'nazionale', topic: 'Sanità', area: 'sanita', severity: 3, source: 'simulation' }]; save.game.week.ap = 12; save.game.resources.politicalCapital = 40; const cooldown = save.presidency.incumbent.actions; delete cooldown?.messaggio; });
keepCalm();
store.presidentActivity('messaggio');
const message = incumbent().ledger.find(item => item.kind === 'messaggio');
assert.ok(message && message.area === 'sanita', 'Il messaggio alle Camere riguarda il problema più urgente del Paese.');
edit(save => {
  save.parliament.laws.push(govLaw('legge-sanita', { title: 'Riforma della sanità territoriale', updatedAt: save.clock.currentDate }));
  save.parliament.history.push({ id: 'attivita-prova-sanita', date: save.clock.currentDate, type: 'iter-approved', text: 'Approvata', details: { lawId: 'legge-sanita' }, source: 'simulation' });
});
keepCalm();
weeks(9);
assert.ok((incumbent().verified ?? []).some(item => item.kind === 'messaggio' && item.success), 'Le Camere hanno approvato una legge sul tema del messaggio: il messaggio ha avuto seguito.');

// ---------- 4. consultations: the choice is checked on the Government it produced ----------
edit(save => { save.national = { ...save.national, formation: { phase: 'consultazioni', presidentChoice: null, source: 'simulation' } }; });
raise('quirinale-consultazioni', { situation: 'Il governo è caduto.', main: 'la maggioranza uscente', alt: 'un’alleanza diversa', whiteSemester: '' });
answer('quirinale-consultazioni', 'tecnico');
const assignment = incumbent().ledger.find(item => item.kind === 'incarico');
assert.ok(assignment && assignment.choice === 'tech' && assignment.dueWeek > st().game.week.index, 'L’incarico a un tecnico apre una verifica sul governo che ne nasce.');
assert.equal(st().national.formation.presidentChoice, 'tech');
{
  const probe = (government, choice) => presidencyEngine.settleLedger({ ...st().presidency, incumbent: { ...st().presidency.incumbent, ledger: [{ id: 'impegno-incarico-x', kind: 'incarico', choice, date: '2026-12-01', dueWeek: 1, week: 0 }] } }, { week: 2, date: '2027-03-01', parliament: { laws: [], history: [], government }, society: st().society }).results[0];
  assert.equal(probe({ status: 'active', stability: 62 }, 'main').success, true, 'Un governo che ha la fiducia e regge giustifica l’incarico.');
  assert.equal(probe({ status: 'fallen', stability: 10 }, 'main').success, false, 'Un governo caduto lo smentisce.');
  assert.equal(probe({ status: 'active', stability: 41 }, 'tech').success, false, 'Un governo del Presidente più debole del previsto non regge la prova.');
  assert.ok(probe({ status: 'fallen', stability: 10 }, 'main').credit < 0 && probe({ status: 'active', stability: 62 }, 'main').credit > 0, 'E il credito del Presidente segue.');
}
edit(save => { save.national = { ...save.national, formation: { ...save.national.formation, phase: 'completata' } }; });

// ---------- 5. the days of the office: its own events, with consequences ----------
const own = daily.DAILY_EVENTS.filter(item => item.forPresident);
assert.ok(own.length >= 14 && own.every(item => item.when({ president: true, governing: true, signals: { stability: 50 } }) !== undefined), 'Il Colle ha una quindicina di eventi propri.');
assert.ok(daily.DAILY_EVENTS.filter(item => !item.forPresident).every(item => !item.forPresident), 'Gli altri eventi non toccano il Presidente.');
const seen = new Set();
for (let week = 0; week < 40; week++) {
  keepCalm();
  store.advance(7);
  for (const item of [...st().game.inbox]) {
    seen.add(item.templateId);
    assert.ok(/^(quirinale|presidente)-/.test(item.templateId), `${item.templateId}: da Presidente si decide solo ciò che riguarda il Colle`);
    const pick = item.choices[(week + item.templateId.length) % item.choices.length];
    try { store.resolveAgendaItem(item.id, pick.id); } catch { store.resolveAgendaItem(item.id, item.choices.find(choice => !choice.cost)?.id ?? item.defaultChoice); }
  }
}
assert.ok([...seen].filter(id => id.startsWith('quirinale-') && !['quirinale-trattative', 'quirinale-scrutinio', 'quirinale-linea', 'quirinale-rielezione', 'quirinale-consultazioni', 'quirinale-candidatura'].includes(id)).length >= 6, `Nei mesi del mandato il Colle vede eventi variegati (${[...seen].join(', ')}).`);
assert.ok((incumbent().verified ?? []).length >= 5, 'Le verifiche si accumulano nel mandato.');

// ---------- 6. the screen, the save and the coherence ----------
const view = store.presidencyView();
const html = presidencyUi.renderQuirinale(st(), view);
assert.ok(/IMPEGNI E VERIFICHE/.test(html) && /Verificati/.test(html) && !/undefined|NaN|\[object/.test(html.replace(/data-[a-z-]+="[^"]*"/g, '')), 'La pagina del Quirinale mostra impegni e verifiche.');
const dump = store.exportSave();
store.loadGame(JSON.parse(dump));
assert.deepEqual(incumbent().verified.map(item => item.id), JSON.parse(dump).presidency.incumbent.verified.map(item => item.id), 'Impegni e verifiche sopravvivono al salvataggio.');
const inv = checkInvariants(st(), run.context);
assert.ok(inv.ok, `Stato coerente: ${inv.issues.slice(0, 3).map(item => `[${item.code}] ${item.message}`).join('; ')}`);
// Same seed, same term.
const again = await president('quirinale-mandato'), again2 = await president('quirinale-mandato');
for (const item of [again, again2]) for (let week = 0; week < 12; week++) item.store.advance(7);
assert.equal(fingerprint(again.store.getState()), fingerprint(again2.store.getState()), 'Stesso seme, stesso mandato.');
assert.ok(Object.keys(rules.LEDGER_RULES).length >= 9 && Object.values(rules.PRESIDENT_ACTS).filter(act => act.ledger).length >= 9, 'Le decisioni che aprono un impegno sono numerose.');

console.log('Mandato del Presidente verificato: decisioni che nascono dallo stato (decreto appena adottato, legge approvata con la fiducia, giudice della Corte, visita diplomatica, crisi di garanzia), rinvio e rifiuto con effetti sul governo, impegni verificati settimane dopo contro i fatti (lettera di rilievi, rinvio, messaggio alle Camere, sentenza, esito della visita), bilancio mai toccato, eventi giornalieri propri del Colle, salvataggio e coerenza.');
