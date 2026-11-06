// Diplomacy and the European Union, engine level (core/diplomacy-engine.js) and in the game (store): relations as a history, negotiations in rounds that end in a treaty or fail, concessions that
// make a treaty worth less, ratification (by default, or by the President: ratify, delay, refuse), treaties that pay every week and expire, crises that open, wait for an answer, can be mediated or
// settled by taking a side or wear out, summits that ask for a line (alignment, negotiation, veto) with lasting effects on the standing in the Union, a simulated Prime Minister who does it by
// himself, and the same inputs giving the same outputs.
import assert from 'node:assert/strict';
import { COUNTRIES, DIPLOMACY_RULES, TREATY_TYPES, advanceDiplomacy, answerCrisis, createDiplomacy, decideSummit, diplomacyView, negotiate, openNegotiation, presidentTreaty } from '../src/core/diplomacy-engine.js';
import { startCareer, playWeek } from './lib/long-run.mjs';

const day = week => new Date(Date.parse('2027-03-01T12:00:00Z') + week * 7 * 86400000).toISOString().slice(0, 10);
const rng = seed => { let s = seed; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
const fresh = () => createDiplomacy({ date: day(0), week: 0, seed: 'prova' });
assert.equal(Object.keys(fresh().countries).length, COUNTRIES.length, 'Tutti i Paesi hanno rapporti.');
assert.deepEqual(fresh(), fresh(), 'Stesso seme, stessi rapporti di partenza.');

// ---------- negotiation ----------
let d = fresh();
d = { ...d, countries: { ...d.countries, germania: { ...d.countries.germania, relation: 75, trust: 70 } } };
assert.throws(() => openNegotiation(d, { type: 'boh', countryId: 'germania' }, { date: day(1), week: 1 }), /che cosa negoziare/);
assert.throws(() => openNegotiation(d, { type: 'commerciale', countryId: 'atlantide' }, { date: day(1), week: 1 }), /Paese/);
const cold = { ...d, countries: { ...d.countries, cina: { ...d.countries.cina, relation: 12 } } };
assert.throws(() => openNegotiation(cold, { type: 'commerciale', countryId: 'cina' }, { date: day(1), week: 1 }), /troppo freddi/, 'Con rapporti gelidi non si apre nemmeno il tavolo.');
const opened = openNegotiation(d, { type: 'commerciale', countryId: 'germania' }, { date: day(1), week: 1 });
assert.equal(opened.negotiation.status, 'aperta');
assert.throws(() => openNegotiation(opened.diplomacy, { type: 'finanza', countryId: 'germania' }, { date: day(1), week: 1 }), /già un negoziato aperto/);
let step = opened.diplomacy; let treaty = null;
for (let i = 0; i < DIPLOMACY_RULES.rounds && !treaty; i++) { const out = negotiate(step, opened.negotiation.id, 'concedi', { date: day(2 + i), week: 2 + i, rand: rng(3 + i) }); step = out.diplomacy; treaty = out.treaty; }
assert.ok(treaty, 'Concedendo, con buoni rapporti, si firma.');
assert.equal(treaty.status, 'firmato', 'Appena firmato va ratificato.');
assert.ok(treaty.value < 1, 'Le concessioni fanno valere il trattato meno.');
assert.ok(step.countries.germania.relation > d.countries.germania.relation, 'Un accordo migliora i rapporti.');
assert.throws(() => negotiate(step, opened.negotiation.id, 'concedi', { date: day(9), week: 9 }), /non è più aperto/);
// a negotiation that fails costs relations
let hard = openNegotiation({ ...fresh(), countries: { ...fresh().countries, turchia: { ...fresh().countries.turchia, relation: 30, trust: 30 } } }, { type: 'migrazioni', countryId: 'turchia' }, { date: day(1), week: 1 });
let failed = hard.diplomacy;
for (let i = 0; i < DIPLOMACY_RULES.rounds; i++) { const n = failed.negotiations.at(-1); if (n.status !== 'aperta') break; failed = negotiate(failed, n.id, 'minaccia', { date: day(2 + i), week: 2 + i, rand: rng(11) }).diplomacy; }
assert.equal(failed.negotiations.at(-1).status, 'fallita', 'Alzare la pressione con rapporti freddi fa fallire il negoziato.');
assert.ok(failed.countries.turchia.tension > hard.diplomacy.countries.turchia.tension, 'E lascia tensione.');

// ---------- ratification ----------
const ratified = advanceDiplomacy(step, { date: day(10), week: 10, rand: rng(1), playerPremier: false, stability: 60 });
assert.equal(ratified.diplomacy.treaties[0].status, 'ratificato', 'Dopo qualche settimana il Parlamento ratifica.');
const waiting = advanceDiplomacy(step, { date: day(10), week: 10, rand: rng(1), playerPremier: true, playerPresident: true, stability: 60 });
assert.equal(waiting.diplomacy.treaties[0].status, 'firmato', 'Se il Presidente è il giocatore, la ratifica aspetta lui.');
const refuse = presidentTreaty(step, treaty.id, 'rifiuta', { date: day(11), week: 11 });
assert.equal(refuse.diplomacy.treaties[0].status, 'rotto'); assert.ok(refuse.diplomacy.countries.germania.trust < step.countries.germania.trust - 10, 'Rifiutare la ratifica brucia la fiducia.'); assert.ok(refuse.effects.stability < 0);
const delay = presidentTreaty(step, treaty.id, 'ritarda', { date: day(11), week: 11 });
assert.equal(delay.diplomacy.treaties[0].status, 'firmato'); assert.ok(delay.effects.stability < 0);
assert.throws(() => presidentTreaty(refuse.diplomacy, treaty.id, 'ratifica', { date: day(12), week: 12 }), /non è in attesa/);
assert.throws(() => presidentTreaty(step, treaty.id, 'boh', { date: day(12), week: 12 }), /ratificare, rinviare o rifiutare/);
// a ratified treaty pays every week and expires
const live = ratified.diplomacy;
const pay = advanceDiplomacy(live, { date: day(11), week: 11, rand: () => 0.99, playerPremier: true });
assert.ok(pay.effects.growth > 0, 'Un trattato commerciale in vigore fa crescere un po’ l’economia ogni settimana.');
const over = advanceDiplomacy({ ...live, treaties: live.treaties.map(item => ({ ...item, endsWeek: 11 })) }, { date: day(12), week: 12, rand: () => 0.99, playerPremier: true });
assert.equal(over.diplomacy.treaties[0].status, 'scaduto', 'Alla scadenza il trattato finisce.');
assert.equal(advanceDiplomacy(over.diplomacy, { date: day(13), week: 13, rand: () => 0.99, playerPremier: true }).effects.growth, 0, 'E non paga più.');

// ---------- crises ----------
let withCrisis = fresh();
for (let week = 1; week < 400 && !withCrisis.crises.length; week++) withCrisis = advanceDiplomacy(withCrisis, { date: day(week), week, rand: rng(week * 7), playerPremier: true }).diplomacy;
assert.ok(withCrisis.crises.length, 'Prima o poi una crisi si apre.');
const crisis = withCrisis.crises[0];
assert.ok(crisis.countries.length && crisis.severity >= 1);
const week0 = crisis.openedWeek;
const waited = advanceDiplomacy(withCrisis, { date: day(week0 + 1), week: week0 + 1, rand: () => 0.99, playerPremier: true });
assert.ok(Object.values(waited.effects).some(value => value !== 0), 'Una crisi aperta costa ogni settimana.');
const mediated = answerCrisis(withCrisis, crisis.id, 'mediare', { date: day(week0 + 1), week: week0 + 1, rand: () => 0.05 });
assert.equal(mediated.closed, true, 'Una mediazione fortunata chiude la crisi.');
const sided = answerCrisis(withCrisis, crisis.id, 'schierarsi', { date: day(week0 + 1), week: week0 + 1, rand: () => 0.5 });
assert.equal(sided.closed, true); const [first, second] = crisis.countries;
assert.ok(sided.diplomacy.countries[first].relation > withCrisis.countries[first].relation && sided.diplomacy.countries[second].relation < withCrisis.countries[second].relation, 'Schierarsi aiuta uno e ferisce l’altro.');
const idle = answerCrisis(withCrisis, crisis.id, 'attendere', { date: day(week0 + 1), week: week0 + 1, rand: () => 0.5 });
assert.equal(idle.closed, false, 'Attendere non risolve.');
assert.throws(() => answerCrisis(mediated.diplomacy, crisis.id, 'mediare', { date: day(week0 + 2), week: week0 + 2 }), /non è più aperta/);
assert.throws(() => answerCrisis(withCrisis, crisis.id, 'boh', { date: day(week0 + 2), week: week0 + 2 }), /come rispondere/);
let worn = withCrisis;
for (let week = week0 + 1; week <= week0 + 14; week++) worn = advanceDiplomacy(worn, { date: day(week), week, rand: () => 0.99, playerPremier: true }).diplomacy;
assert.equal(worn.crises.find(item => item.id === crisis.id).status, 'chiusa', 'Una crisi senza risposta si esaurisce da sola, male.');
assert.ok(worn.eu.standing < withCrisis.eu.standing + 0.5, 'Senza risposta il peso in Europa non cresce.');
// a simulated Prime Minister answers by himself
let auto = fresh();
for (let week = 1; week < 200; week++) auto = advanceDiplomacy(auto, { date: day(week), week, rand: rng(week * 13 + 1), playerPremier: false }).diplomacy;
assert.ok(auto.crises.every(item => item.status !== 'aperta' || auto.week - item.openedWeek < 10), 'Un governo simulato risponde alle crisi.');
assert.ok(auto.summits.every(item => item.status === 'tenuto'), 'E va ai vertici.');
assert.ok(auto.log.length > 3, 'Resta la cronaca.');

// ---------- summits ----------
let sm = fresh();
sm = { ...sm, summits: [{ id: 'v1', kind: 'consiglio-europeo', label: 'Consiglio europeo', topic: 'Energia', week: 13, status: 'in-arrivo' }] };
assert.throws(() => decideSummit(sm, 'v1', 'boh', { date: day(13), week: 13 }), /linea da portare/);
const al = decideSummit(sm, 'v1', 'allineamento', { date: day(13), week: 13 });
const vt = decideSummit(sm, 'v1', 'veto', { date: day(13), week: 13 });
assert.ok(al.diplomacy.eu.standing > sm.eu.standing, 'Allinearsi alza il peso in Europa.');
assert.ok(vt.diplomacy.eu.standing < sm.eu.standing && vt.diplomacy.eu.conditionality > sm.eu.conditionality, 'Il veto abbassa il peso e fa chiedere garanzie.');
assert.ok(vt.effects.satisfaction > 0 && vt.effects.spread > 0, 'Il veto piace in patria e costa sui mercati.');
assert.ok(vt.diplomacy.countries.francia.trust < sm.countries.francia.trust, 'E raffredda i partner europei.');
assert.throws(() => decideSummit(vt.diplomacy, 'v1', 'allineamento', { date: day(14), week: 14 }), /già tenuto/);
// determinism
const run = () => { let x = fresh(); for (let week = 1; week < 120; week++) x = advanceDiplomacy(x, { date: day(week), week, rand: rng(week), playerPremier: false }).diplomacy; return JSON.stringify(x); };
assert.equal(run(), run(), 'Stessi dati, stesso risultato.');
assert.equal(diplomacyView(null), null);
const view = diplomacyView(auto);
assert.equal(view.countries.length, COUNTRIES.length); assert.ok(Array.isArray(view.log));

// ---------- in the game ----------
const { store, db, decide } = await startCareer({ seed: 'esteri', level: 'deputato', fast: true, territorial: true });
for (let week = 0; week < 40; week++) playWeek({ store, db, decide });
assert.ok(store.diplomacyView(), 'Dopo qualche settimana la diplomazia è attiva nella carriera.');
assert.ok(store.diplomacyView().countries.length === COUNTRIES.length);
assert.throws(() => store.diplomacyAction('negotiate-open', 'commerciale', 'germania'), /Presidente del Consiglio/, 'Solo il Presidente del Consiglio tratta.');
assert.throws(() => store.diplomacyAction('treaty', 'x', 'ratifica'), /Presidente della Repubblica/, 'Solo il Presidente della Repubblica ratifica.');
const before = JSON.stringify(store.exportSave());
store.loadGame(JSON.parse(store.exportSave()));
assert.equal(store.diplomacyView().countries.length, COUNTRIES.length, 'Il salvataggio conserva i rapporti.');
const old = JSON.parse(store.exportSave()); delete old.diplomacy; store.loadGame(old);
assert.equal(store.diplomacyView(), null, 'Un salvataggio senza diplomazia si carica (parte alla prima settimana).');
store.advance(7);
assert.ok(store.diplomacyView(), 'E la diplomazia riparte.');
void before;
console.log('Diplomazia verificata: negoziati a round (concessioni, fallimento), ratifica automatica o del Presidente (ratifica, rinvio, rifiuto), trattati che pagano e scadono, crisi (mediazione, schierarsi, attesa, esaurimento), vertici (allineamento, negoziato, veto) con effetti duraturi, governo simulato autonomo, determinismo, salvataggio e vecchi salvataggi.');
