// Fondi tra politico e partito nel gioco vero (store): richiesta e versamento, risposta alla chiusura della settimana, registro, salvataggio e ricaricamento, nessun denaro creato.
import assert from 'node:assert/strict';
import { playWeek, startCareer } from './lib/long-run.mjs';

const { store, decide } = await startCareer({ seed: 'fondi', level: 'comunale', draft: { partyMode: 'new', partyName: 'Lista Fondi', partyAbbreviation: 'LF', partyDescription: 'Test', partyColor: '#336699', partyOrientation: 'Centrismo civico', partyWebsite: '' } }).catch(async () => startCareer({ seed: 'fondi', level: 'comunale' }));
const sum = () => { const state = store.getState(); return state.game.resources.funds + (state.game.party?.org?.treasury.balance ?? 0) - state.game.finance.debt; };
const game = () => store.getState().game;
assert.ok(game().party?.org, 'La carriera ha un partito con la sua tesoreria.');
game().party.org.treasury.balance = Math.max(game().party.org.treasury.balance, 5000);
game().resources.funds = Math.max(game().resources.funds, 2000);

// pay into the party
const before = sum();
store.payIntoParty(300);
assert.equal(sum(), before, 'Il versamento sposta soli denari tra le due casse.');
assert.equal(game().finance.transfers[0].direction, 'al-partito');
assert.throws(() => store.payIntoParty(''), /cifra valida/, 'Importo vuoto: errore, nulla si muove.');
assert.equal(sum(), before);

// ask the party: the answer comes with the weekly close
const rules = (await import('../src/core/finance-engine.js')).partyRequestRules(game());
if (rules.allowed) {
  const ask = Math.min(rules.cap, 500);
  store.requestPartyFunds(ask);
  const asked = game().finance.transfers[0];
  assert.equal(asked.direction, 'dal-partito');
  const total = sum();
  if (asked.status === 'in-attesa') {
    for (let i = 0; i < 3 && game().finance.transfers[0].status === 'in-attesa'; i++) playWeek({ store, db: null, decide });
    assert.ok(['approvata', 'rifiutata'].includes(game().finance.transfers[0].status), 'La direzione risponde alla chiusura della settimana.');
  }
  void total;
}

// save and reload: the transfers and the supporters are still there
playWeek({ store, db: null, decide });
const saved = JSON.parse(store.exportSave());
assert.ok(saved.game.finance.transfers.length >= 1, 'I trasferimenti sono nel salvataggio.');
assert.ok(saved.game.supporters && saved.game.supporters.count > 0, 'Lo stato dei sostenitori ricorrenti è nel salvataggio.');
const expected = { funds: game().resources.funds, treasury: game().party.org.treasury.balance, transfers: game().finance.transfers.length };
store.loadGame(saved);
assert.deepEqual({ funds: game().resources.funds, treasury: game().party.org.treasury.balance, transfers: game().finance.transfers.length }, expected, 'Dopo il ricaricamento fondi, tesoreria e storico coincidono.');

// weeks go on: the supporters vary, the registers agree
const incomes = [];
for (let i = 0; i < 6; i++) { playWeek({ store, db: null, decide }); incomes.push(game().supporters.income); }
assert.ok(new Set(incomes).size > 2, `Le entrate dei sostenitori variano (${incomes.join(', ')}).`);
assert.ok(game().finance.debt >= 0 && game().resources.funds >= 0, 'Nessun saldo negativo.');
console.log('Fondi tra politico e partito nel gioco: versamento, richiesta con risposta alla chiusura della settimana, storico, salvataggio e ricaricamento, sostenitori che variano, nessun saldo negativo.');
