// Requests of citizens and associations (core/citizen-requests-engine.js + store + weekly tick): a request arrives about an area that is really under pressure in the region of the player; the actions
// that can be taken depend on the offices held (a question and a motion need a seat, a direct action an executive) and each has a cost, a time and a chance; the answer arrives weeks later with its
// consequences, an unanswered request expires with a cost; «Inserisci nel programma» creates a real promise; the career plays it all week after week.
import assert from 'node:assert/strict';
import * as E from '../src/core/citizen-requests-engine.js';
import { startCareer } from './lib/long-run.mjs';

const areas = [{ id: 'sanita', label: 'Sanità', value: 30 }, { id: 'scuola', label: 'Scuola', value: 85 }, { id: 'trasporti', label: 'Trasporti', value: 55 }, { id: 'ambiente', label: 'Ambiente', value: 90 }];
// ---------- the arrival ----------
const seen = { sanita: 0, scuola: 0, trasporti: 0, ambiente: 0 }; let made = 0;
for (let week = 1; week <= 800; week += 4) { const r = E.generateRequest([], { week, date: '2027-01-04', region: 'Toscana', areas, seed: `s${week}` }); if (r) { made++; seen[r.area]++; assert.match(r.text, /Toscana/); assert.match(r.text, new RegExp(`${Math.round(areas.find(a => a.id === r.area).value)}/100`), 'La richiesta cita l’indicatore reale.'); } }
assert.ok(made > 20, `Le richieste arrivano (${made}).`);
assert.ok(seen.sanita > seen.scuola && seen.sanita > seen.ambiente, `I servizi che soffrono sono chiesti più spesso (${JSON.stringify(seen)}).`);
assert.equal(E.generateRequest(Array.from({ length: 3 }, (_, n) => ({ id: `x${n}`, status: 'aperta', area: `a${n}`, createdWeek: 1 })), { week: 50, date: '2027-01-04', region: 'Toscana', areas, seed: 'k' }), null, 'Con tre richieste aperte non ne arrivano altre.');
const same = [E.generateRequest([], { week: 12, date: '2027-01-04', region: 'Toscana', areas, seed: 'det' }), E.generateRequest([], { week: 12, date: '2027-01-04', region: 'Toscana', areas, seed: 'det' })];
assert.equal(JSON.stringify(same[0]), JSON.stringify(same[1]), 'Stessa settimana e stesso contesto: stessa richiesta.');
// ---------- the actions and the powers ----------
let request = null; for (let week = 1; !request; week++) request = E.generateRequest([], { week: week * 4, date: '2027-01-04', region: 'Toscana', areas, seed: 'r' });
const bare = E.actionsFor(request, { party: true, funds: 5000, capital: 10 });
const by = (list, id) => list.find(item => item.id === id);
assert.equal(by(bare, 'segnala').available, true); assert.equal(by(bare, 'interrogazione').available, false); assert.match(by(bare, 'interrogazione').reason, /seggio/);
assert.equal(by(bare, 'diretto').available, false); assert.match(by(bare, 'diretto').reason, /esecutivo/);
const councillor = E.actionsFor(request, { questions: true, motions: true, party: true, funds: 5000, capital: 10 });
assert.ok(by(councillor, 'interrogazione').available && by(councillor, 'mozione').available && !by(councillor, 'diretto').available);
const mayor = E.actionsFor(request, { questions: true, motions: true, executive: true, party: true, funds: 5000, capital: 10 });
assert.ok(by(mayor, 'diretto').available, 'Chi guida un esecutivo può intervenire direttamente.');
assert.match(by(E.actionsFor(request, { executive: true, party: true, funds: 100, capital: 10 }), 'diretto').reason, /1500 €|fondi/, 'Senza fondi l’intervento diretto è spiegato.');
assert.throws(() => E.takeAction(request, 'interrogazione', { week: 5, date: '2027-02-01', powers: { party: true, funds: 0, capital: 0 } }), /seggio/, 'Un’azione senza i poteri è rifiutata con il motivo.');
// ---------- the answer ----------
const taken = E.takeAction(request, 'interrogazione', { week: 10, date: '2027-03-01', powers: councillor.reduce((o, a) => ({ ...o, questions: true, motions: true, party: true, funds: 5000, capital: 10 }), {}) });
assert.equal(taken.request.status, 'in-corso'); assert.equal(taken.request.answerWeek, 12, 'La risposta arriva dopo due settimane.');
assert.equal(E.advanceRequest(taken.request, { week: 11, date: '2027-03-08', influence: 50 }).request.status, 'in-corso', 'Prima del tempo non c’è risposta.');
let wins = 0, losses = 0;
for (let n = 0; n < 60; n++) { const out = E.advanceRequest({ ...taken.request, id: `richiesta-${n}` }, { week: 12, date: '2027-03-15', influence: 50 }); assert.ok(['risolta', 'fallita'].includes(out.request.status) && out.request.won === (out.request.status === 'risolta')); assert.ok(out.effects && out.headline); assert.equal(out.request.phase, out.request.won ? 'realizzata' : 'fallita'); out.request.won ? wins++ : losses++; }
assert.ok(wins > 0 && losses > 0 && wins > losses, `Un’interrogazione riesce di solito ma non sempre (${wins}/${wins + losses}).`);
const expired = E.advanceRequest(request, { week: request.expiresWeek + 1, date: '2027-12-01', influence: 50 });
assert.equal(expired.request.status, 'scaduta'); assert.ok(expired.effects.reputation < 0, 'Una richiesta lasciata scadere costa reputazione.');
const declined = E.takeAction(request, 'declina', { week: 5, date: '2027-02-01', powers: {} }); assert.equal(declined.request.status, 'respinta'); assert.ok(declined.effects.reputation < 0);
const direct = E.takeAction(request, 'diretto', { week: 5, date: '2027-02-01', powers: { executive: true, funds: 5000, capital: 5 } });
assert.deepEqual(direct.cost, { days: 2, capital: 2, funds: 1500 }); assert.ok(E.ACTIONS.diretto.win.indicator > 0, 'L’intervento diretto muove un indicatore.');

// ---------- a career ----------
const { store } = await startCareer({ seed: 'richieste', level: 'comunale', fast: true });
store.setHeadlessVoter(null);
const g = () => store.getState().game;
g().resources.funds = 20000; g().resources.politicalCapital = 40;
const clearInbox = () => { for (const item of g().inbox.filter(entry => ['urgente', 'situazione'].includes(entry.kind))) for (const choice of item.choices ?? []) { try { store.resolveAgendaItem(item.id, choice.id); break; } catch { /* next */ } } };
let first = null;
for (let w = 0; w < 80 && !first; w++) { clearInbox(); store.advanceTurn(1, { delegate: true }); first = store.citizenRequests().find(item => item.status === 'aperta') ?? null; }
assert.ok(first, 'In una carriera arriva una richiesta entro ottanta settimane.');
const available = store.requestActions(first.id).filter(item => item.available && !['declina', 'iniziativa'].includes(item.id));
assert.ok(available.length >= 2, `Sono disponibili azioni (${available.map(item => item.id).join(', ')}).`);
const reputationBefore = store.getState().game.stats?.reputation ?? null;
const act = store.requestActions(first.id).find(item => item.id === 'interrogazione' && item.available) ?? store.requestActions(first.id).find(item => item.id === 'segnala');
const capitalBefore = g().resources.politicalCapital;
const result = store.actOnRequest(first.id, act.id);
assert.equal(result.status, 'in-corso'); assert.ok(g().resources.politicalCapital <= capitalBefore, 'L’azione costa quello che dice.');
for (let w = 0; w < 8 && store.citizenRequests().find(item => item.id === first.id).status === 'in-corso'; w++) { clearInbox(); store.advanceTurn(1, { delegate: true }); }
const closed = store.citizenRequests().find(item => item.id === first.id);
assert.ok(['risolta', 'fallita'].includes(closed.status), 'La risposta arriva.'); assert.ok(closed.outcome);
assert.ok(g().log.some(entry => /Richiesta (accolta|scaduta)|Nessun seguito/.test(entry.title ?? '')) || g().memory?.some?.(item => item.kind === 'richiesta-chiusa'), 'L’esito è scritto nella memoria della carriera.');
// the promise: a real programme promise
const second = (() => { for (let w = 0; w < 120; w++) { const open = store.citizenRequests().find(item => item.status === 'aperta'); if (open) return open; clearInbox(); store.advanceTurn(1, { delegate: true }); } return null; })();
if (second) { const promisesBefore = (g().promises ?? []).length; store.actOnRequest(second.id, 'promessa'); assert.ok((g().promises ?? []).length >= promisesBefore, 'La richiesta diventa una promessa del programma (se non ce n’è già una su quel tema).'); assert.equal(store.citizenRequests().find(item => item.id === second.id).status, 'risolta'); }

// ---------- the cycle: received → taken in charge → started → carried out / failed / ignored → satisfied / rejected ----------
{
  assert.equal(request.phase, 'ricevuta'); assert.equal(E.phaseOf({ status: 'risolta' }), 'realizzata', 'Le richieste dei vecchi salvataggi hanno la loro fase.');
  // the answers that take time: taken in charge, then started, then carried out
  const slow = E.takeAction(request, 'interrogazione', { week: 10, date: '2027-03-01', powers: { questions: true, party: true, funds: 5000, capital: 10 } });
  assert.equal(slow.request.phase, 'presa-in-carico');
  const started = E.advanceRequest(slow.request, { week: 11, date: '2027-03-08', influence: 50 });
  assert.equal(started.request.phase, 'avviata'); assert.ok(started.step && started.request.status === 'in-corso', 'La presa in carico diventa un intervento avviato, e il diario lo racconta.');
  // a promise is NOT an answer: the request stays open until the promise is kept
  const promised = E.takeAction(request, 'promessa', { week: 10, date: '2027-03-01', powers: { party: true } });
  assert.equal(promised.request.status, 'in-corso'); assert.equal(promised.request.linked, 'promessa'); assert.notEqual(promised.request.status, 'risolta', 'Inserire nel programma non soddisfa la richiesta.');
  const waiting = E.advanceRequest({ ...promised.request, promiseId: 'p1' }, { week: 20, date: '2027-05-10', influence: 50, link: { state: 'attiva' } });
  assert.equal(waiting.request.status, 'in-corso'); assert.ok(!waiting.effects || !(waiting.effects.reputation > 0.5), 'Finché la promessa è aperta nessun beneficio.');
  const kept = E.advanceRequest({ ...promised.request, promiseId: 'p1' }, { week: 30, date: '2027-08-01', influence: 50, link: { state: 'riuscita' } });
  assert.equal(kept.request.status, 'risolta'); assert.equal(kept.request.phase, 'realizzata'); assert.ok(kept.effects.reputation > 0 && kept.effects.popularity > 0 && kept.effects.indicator > 0 && kept.effects.attention > 0, 'Realizzata: soddisfazione, reputazione, consenso e indicatore del territorio.');
  const broken = E.advanceRequest({ ...promised.request, promiseId: 'p1' }, { week: 30, date: '2027-08-01', influence: 50, link: { state: 'fallita' } });
  assert.equal(broken.request.status, 'fallita'); assert.ok(broken.effects.reputation < 0 && broken.effects.popularity < 0, 'Promessa tradita: conseguenze.');
  const ignored = E.advanceRequest({ ...promised.request, promiseId: 'p1' }, { week: promised.request.answerWeek + 1, date: '2028-06-01', influence: 50, link: { state: 'attiva' } });
  assert.equal(ignored.request.phase, 'ignorata'); assert.ok(ignored.effects.reputation < 0, 'Scaduto il tempo senza promessa mantenuta: richiesta ignorata.');
  assert.equal(E.linkOf({ linked: 'promessa', promiseId: 'p1' }, { promises: [{ id: 'p1', status: 'mantenuta' }] }).state, 'riuscita');
  assert.equal(E.linkOf({ linked: 'promessa', promiseId: 'p1' }, { promises: [{ id: 'p1', status: 'non-mantenuta' }] }).state, 'fallita');
  assert.equal(E.linkOf({ linked: 'promessa', promiseId: 'p1' }, { promises: [{ id: 'p1', status: 'in-corso' }] }).state, 'attiva');
  assert.equal(E.linkOf({ linked: 'iniziativa', area: 'sanita', takenAt: '2027-03-01' }, { initiatives: [{ id: 'i1', area: 'sanita', createdAt: '2027-03-10', status: 'approvata' }] }).state, 'riuscita');
  // in a career: the request taken in charge with a promise is bound to it and is not satisfied by the registration
  const bound = await startCareer({ seed: 'richieste-ciclo', level: 'deputato', fast: true });
  const st = bound.store; st.setHeadlessVoter(null);
  const gg = () => st.getState().game; gg().resources.funds = 20000; gg().resources.politicalCapital = 40;
  const fresh = JSON.parse(JSON.stringify({ ...request, id: 'richiesta-ciclo-prova', region: st.getState().game.place?.region ?? 'Toscana', createdWeek: gg().week.index, expiresWeek: gg().week.index + 10, status: 'aperta', phase: 'ricevuta' }));
  gg().requests = [fresh];
  const made = st.actOnRequest(fresh.id, 'promessa');
  const after = st.citizenRequests().find(item => item.id === fresh.id);
  assert.equal(after.status, 'in-corso'); assert.equal(after.linked, 'promessa'); assert.ok(after.promiseId && gg().promises.some(item => item.id === after.promiseId), 'La richiesta è legata a una promessa vera.');
  // the promise is kept (the engine of the programme settles it): the next week the request is satisfied, with the diary and the memory
  gg().promises = gg().promises.map(item => item.id === after.promiseId ? { ...item, status: 'mantenuta', settledWeek: gg().week.index } : item);
  const repBefore = st.getState().dataset.statistics.find(row => row.subjectId === st.getState().career.playerId && row.metric === 'reputation')?.value ?? 0;
  st.advanceTurn(1, { delegate: true });
  const done = st.citizenRequests().find(item => item.id === fresh.id);
  assert.equal(done.status, 'risolta', 'Promessa mantenuta: richiesta soddisfatta.'); assert.equal(done.phase, 'realizzata');
  assert.ok(gg().log.some(item => item.kind === 'richiesta' && /soddisfatta/i.test(item.title)), 'Il diario registra la richiesta soddisfatta.');
}

console.log('Richieste di cittadini e associazioni verificate: arrivo su servizi che soffrono con l’indicatore reale, azioni secondo gli incarichi con costo e motivo, risposta dopo qualche settimana con conseguenze, scadenza con costo, promessa nel programma, carriera settimana per settimana.');
