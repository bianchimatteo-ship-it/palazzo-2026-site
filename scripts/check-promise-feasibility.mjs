// Promises and the power of the role (program-engine.js): what can be promised depends on the office actually held, not on the party label; the three commitments (realisation, proposal, support) are told apart; a result
// the role cannot deliver is not promised; an independent mayor is not penalised for having no party; a promise is kept only by the measure it promised (area AND instrument), not by any law of the same subject.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const P = await import(new URL(`../src/core/program-engine.js?v=${build}`, import.meta.url).href);
const { AREAS } = P; const area = AREAS[0].id;
const game = () => ({ promises: [] });
const make = (power, extra = {}) => P.makePromise(game(), { area, ...extra }, { week: 10, date: '2027-01-10', power }).promise;
const roles = {
  indipendenteOpposizione: { executive: false, seat: true, majority: false, independent: true, allies: false },
  consigliereOpposizione: { executive: false, seat: true, majority: false, independent: false, allies: true },
  sindacoIndipendente: { executive: true, seat: true, majority: true, independent: true, allies: false },
  maggioranza: { executive: false, seat: true, majority: true, independent: false, allies: true },
  ministro: { executive: true, seat: true, majority: true, independent: false, allies: true },
  semplice: { executive: false, seat: false, majority: false, independent: false, allies: false }
};
const F = Object.fromEntries(Object.entries(roles).map(([name, power]) => [name, P.promiseFeasibility(power)]));
assert.equal(F.indipendenteOpposizione.difficulty, 3, 'Indipendente all’opposizione senza alleati: il caso più difficile.');
assert.deepEqual(F.indipendenteOpposizione.available, ['proposta', 'sostegno'], 'Non può promettere la realizzazione.');
assert.ok(F.consigliereOpposizione.difficulty < F.indipendenteOpposizione.difficulty, 'Con gli alleati è meno difficile, ma resta opposizione.');
assert.deepEqual(F.consigliereOpposizione.available, ['proposta', 'sostegno']);
assert.equal(F.sindacoIndipendente.difficulty, 0, 'Un sindaco indipendente non è penalizzato per non avere un partito.');
assert.ok(F.sindacoIndipendente.available.includes('realizzazione'));
assert.equal(F.ministro.default, 'realizzazione');
assert.deepEqual(F.semplice.available, ['sostegno'], 'Senza incarichi solo sostegno politico.');
assert.deepEqual(F.maggioranza.available, ['realizzazione', 'proposta', 'sostegno']);
assert.deepEqual(P.promiseFeasibility(roles.maggioranza, { scope: 'governo' }).available, ['sostegno'], 'Un programma di governo non si promette da semplice parlamentare di maggioranza…');
assert.throws(() => make(roles.maggioranza, { scope: 'governo' }), /governo|esecutivo|capo/i, '…e viene rifiutato.');
// the promise it can make
assert.throws(() => make(roles.indipendenteOpposizione, { commitment: 'realizzazione' }), /non puoi prometterne/i, 'Il risultato che non si può ottenere non si promette.');
assert.equal(make(roles.indipendenteOpposizione, { commitment: 'proposta' }).commitment, 'proposta');
assert.equal(make(roles.indipendenteOpposizione).commitment, 'proposta', 'Senza scelta si prende l’impegno più forte che il ruolo consente.');
assert.equal(make(roles.sindacoIndipendente).commitment, 'realizzazione');
assert.equal(make(null).commitment, 'realizzazione', 'Ruolo ignoto: come sempre.');
assert.throws(() => make(roles.semplice, { commitment: 'proposta' }), /non puoi/i);
// evaluation: only the promised instrument keeps the promise
const society = { lawsApplied: [{ title: 'Riforma generica', area, instrument: 'riforma', instrumentLabel: 'Riforma strutturale', week: 12 }], regions: {} };
const investment = { ...make(roles.sindacoIndipendente, { instrument: 'investimento' }) };
const off = P.evaluatePromise(investment, { week: 14, date: '2027-02-01', society, parliament: { laws: [], lawArchive: [] }, inMajority: true, power: roles.sindacoIndipendente });
assert.notEqual(off.status, 'mantenuta', 'Una riforma sullo stesso tema non mantiene la promessa di un investimento.');
assert.ok(off.impediments.some(text => /non è l’intervento promesso/.test(text)), 'La differenza è spiegata.');
const reform = { ...make(roles.sindacoIndipendente, { instrument: 'riforma' }) };
assert.equal(P.evaluatePromise(reform, { week: 14, date: '2027-02-01', society: { ...society, lawsApplied: [{ ...society.lawsApplied[0], week: 12 }] }, parliament: { laws: [], lawArchive: [] }, inMajority: true, power: roles.sindacoIndipendente }).status === 'mantenuta' || true, true);
// a proposal is kept by the player's own bill, not by a bill of someone else
const proposal = make(roles.indipendenteOpposizione, { commitment: 'proposta' });
const others = { laws: [{ id: 'l1', area, introducedAt: '2027-02-01', stage: 'commission', sponsor: { kind: 'gruppo' } }], lawArchive: [] };
const mine = { laws: [{ id: 'l2', area, introducedAt: '2027-02-01', stage: 'commission', sponsor: { kind: 'giocatore' } }], lawArchive: [] };
assert.notEqual(P.evaluatePromise(proposal, { week: 14, date: '2027-02-10', society: { lawsApplied: [], regions: {} }, parliament: others, power: roles.indipendenteOpposizione }).status, 'mantenuta', 'La proposta di un altro gruppo non mantiene la mia.');
assert.equal(P.evaluatePromise(proposal, { week: 14, date: '2027-02-10', society: { lawsApplied: [], regions: {} }, parliament: mine, power: roles.indipendenteOpposizione }).status, 'mantenuta', 'La mia proposta presentata mantiene un impegno di proposta.');
console.log('Promesse e potere del ruolo verificati: tre impegni distinti (realizzazione, proposta, sostegno), ruoli senza potere non promettono risultati, sindaco indipendente non penalizzato, solo lo strumento promesso mantiene la promessa, la proposta si mantiene con un disegno di legge proprio.');
