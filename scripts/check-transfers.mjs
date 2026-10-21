// Fondi tra il politico e il partito, sostenitori ricorrenti e nuove entrate simulate. Due casse distinte (i fondi del politico, la tesoreria del partito): ogni trasferimento è scritto in entrambi i
// registri, per lo stesso importo, una sola volta; nessuna creazione di denaro, nessun doppio conteggio, nessun saldo negativo; le quote di tesseramento restano del partito. Motore puro.
import assert from 'node:assert/strict';
import { book, contributeToParty, createFinance, operationProblem, partyRequestRules, requestPartyFunds, settleFinanceWeek, settleOperations, settleTransfers, beginOperation, supporterIncome, supporterTarget, supporterPerHead } from '../src/core/finance-engine.js';
import { createOrganization } from '../src/core/organization-engine.js';
import { SUPPORTERS, TRANSFERS, TREASURY_OPERATIONS } from '../src/data/simulation/finance-rules.js';
import { checkInvariants } from '../src/core/invariants.js';

const seeded = seed => { let state = seed >>> 0 || 1; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; };
const START = '2027-01-04';
const makeGame = ({ funds = 4000, rank = 3, founder = false, treasury = 6000, support = 55 } = {}) => {
  const org = createOrganization({ rand: seeded(3), founder, region: 'Toscana', share: 6, week: 1, date: START });
  org.treasury.balance = treasury;
  return { resources: { funds, politicalCapital: 10 }, week: { index: 1 }, flags: {}, memory: [], finance: createFinance({ week: 1, date: START, funds }), party: { org, rank, affiliation: founder ? 'founder' : 'member', support } };
};
const total = game => game.resources.funds + game.party.org.treasury.balance - game.finance.debt;
const ctx = week => ({ week, date: START });

// ---------- 1. paying into the party: both registers, once, never more than the funds ----------
{
  const game = makeGame({ funds: 1000 });
  const before = total(game);
  const entry = contributeToParty(game, 400, ctx(1));
  assert.equal(game.resources.funds, 600); assert.equal(game.party.org.treasury.balance, 6400);
  assert.equal(total(game), before, 'Il versamento sposta denaro, non lo crea né lo perde.');
  assert.equal(entry.status, 'eseguito'); assert.equal(game.finance.transfers.length, 1);
  assert.equal(game.finance.ledger[0].amount, -400, 'Nel registro del politico una sola uscita.');
  assert.equal(game.party.org.treasury.current.byCategory.contributi, 400, 'Nel registro della tesoreria una sola entrata.');
  assert.equal(game.party.org.treasury.current.income, 400);
  assert.ok(game.party.support > 55, 'Un versamento volontario pesa nel partito.');
  for (const bad of [0, -5, '', '  ', 'abc', null, undefined, NaN, 30, 99999]) assert.throws(() => contributeToParty(game, bad, ctx(1)), /cifra|importo/i, `Importo non valido rifiutato: ${JSON.stringify(bad)}.`);
  assert.throws(() => contributeToParty(game, 700, ctx(1)), /Nei tuoi fondi ci sono 600/, 'Mai più di quanto si ha: nessun saldo negativo.');
  assert.equal(game.resources.funds, 600); assert.equal(game.finance.debt, 0);
  assert.throws(() => contributeToParty({ ...makeGame(), party: null }, 100, ctx(1)), /Serve un partito/);
}

// ---------- 2. asking the party: by rank, with approval when the rule says so ----------
{
  const member = makeGame({ rank: 0 });
  assert.equal(partyRequestRules(member).allowed, false); assert.throws(() => requestPartyFunds(member, 200, ctx(1)), /iscritto/);
  assert.equal(partyRequestRules({ ...makeGame(), party: null }).allowed, false);

  const game = makeGame({ rank: 3, treasury: 6000, funds: 500 });
  const rules = partyRequestRules(game);
  assert.ok(rules.allowed && rules.approval && rules.cap === 1500, 'Direzione nazionale: fino a 1.500 € per volta, con approvazione.');
  assert.throws(() => requestPartyFunds(game, 2000, ctx(1)), /al massimo 1500/, 'Oltre il limite del ruolo.');
  for (const bad of ['', 'x', null, 10]) assert.throws(() => requestPartyFunds(game, bad, ctx(1)), /cifra|importo/i);
  const before = total(game);
  const asked = requestPartyFunds(game, 1000, ctx(1));
  assert.equal(asked.status, 'in-attesa'); assert.equal(game.resources.funds, 500, 'Finché la direzione non risponde non si muove nulla.'); assert.equal(game.party.org.treasury.balance, 6000);
  assert.throws(() => requestPartyFunds(game, 100, ctx(1)), /in attesa/, 'Una richiesta alla volta.');
  // the answer comes at the weekly close; with a high chance it is approved, with a low one refused
  const yes = structuredClone(game), no = structuredClone(game);
  assert.equal(settleTransfers(yes, { week: 1, date: START, rand: () => 0.0001, stats: { reputation: 50 } })[0].status, 'approvata');
  assert.equal(yes.resources.funds, 1500); assert.equal(yes.party.org.treasury.balance, 5000); assert.equal(total(yes), before, 'Approvata: i soldi passano da una cassa all’altra.');
  assert.equal(yes.finance.ledger[0].amount, 1000); assert.equal(yes.party.org.treasury.current.byCategory.sostegno, -1000);
  assert.ok(yes.party.support < 55, 'Chiedere fondi consuma un po’ di credito nel partito.');
  assert.equal(settleTransfers(no, { week: 1, date: START, rand: () => 0.9999, stats: { reputation: 50 } })[0].status, 'rifiutata');
  assert.equal(no.resources.funds, 500); assert.equal(no.party.org.treasury.balance, 6000); assert.equal(total(no), before, 'Respinta: nulla si muove.');
  // decided once: a second close does not pay again
  assert.equal(settleTransfers(yes, { week: 2, date: START, rand: () => 0.0001, stats: {} }).length, 0); assert.equal(yes.resources.funds, 1500);
  // the wait between two requests
  assert.match(partyRequestRules(yes).reason, /tra \d+ settiman/, 'Una nuova richiesta ha un tempo di attesa.');
  yes.week.index = 1 + TRANSFERS.cooldownWeeks; assert.equal(partyRequestRules(yes).allowed, true);
}
// the treasury keeps its floor: a request never takes it under, and an approved request is refused if the treasury shrank in the meantime
{
  const game = makeGame({ rank: 4, treasury: 1000 });
  assert.equal(partyRequestRules(game).cap, 1000 - TRANSFERS.floor, 'Resta sempre un fondo minimo in tesoreria.');
  assert.throws(() => requestPartyFunds(game, 800, ctx(1)), /al massimo 700/);
  requestPartyFunds(game, 700, ctx(1));
  game.party.org.treasury.balance = 800;
  const out = settleTransfers(game, { week: 1, date: START, rand: () => 0.0001, stats: {} })[0];
  assert.equal(out.status, 'rifiutata', 'Se nel frattempo la tesoreria non ha più margine, niente fondi.'); assert.equal(game.party.org.treasury.balance, 800); assert.equal(game.resources.funds, 4000);
  const poor = makeGame({ rank: 4, treasury: 320 });
  assert.equal(partyRequestRules(poor).allowed, false, 'Con la tesoreria quasi vuota non si può chiedere.');
}
// the secretary and the founder dispose directly, up to a quarter of the treasury
{
  for (const founder of [true, false]) {
    const game = makeGame({ rank: founder ? 0 : 5, founder, treasury: 8000 });
    const rules = partyRequestRules(game);
    assert.ok(rules.allowed && !rules.approval && rules.cap === 2000, `${founder ? 'Fondatore' : 'Segretario'}: dispone direttamente, al massimo un quarto della tesoreria (2.000 €).`);
    assert.throws(() => requestPartyFunds(game, 2500, ctx(1)), /al massimo 2000/);
    const before = total(game);
    const entry = requestPartyFunds(game, 1800, ctx(1));
    assert.equal(entry.status, 'approvata'); assert.equal(game.resources.funds, 5800); assert.equal(game.party.org.treasury.balance, 6200); assert.equal(total(game), before);
    assert.equal(game.finance.transfers.length, 1, 'Un solo movimento nello storico.');
  }
}

// ---------- 3. the books: income/expense, ledger, year, and the membership fees stay the party's ----------
{
  const game = makeGame({ rank: 5, treasury: 8000 });
  const rand = seeded(7);
  requestPartyFunds(game, 1000, ctx(1));
  const treasuryDay = game.party.org.treasury.balance;
  const out = settleFinanceWeek(game, { week: 1, date: START, incomes: [{ category: 'base', amount: 200 }], rand });
  assert.ok(game.finance.yearTotals.byCategory.fondi_partito === 1000 && game.finance.current.income >= 0, 'L’entrata dal partito è nella categoria dedicata dell’anno.');
  assert.equal(game.party.org.treasury.balance, treasuryDay, 'La chiusura della settimana non tocca di nuovo la tesoreria.');
  assert.ok(out.lines.length > 0);
  // the fees of the members are income of the party only: no trace in the politician's register
  assert.ok(!game.finance.ledger.some(row => /tessera|quota/i.test(row.label)));
  const problems = checkInvariants({ state: { game }, label: 'trasferimenti' });
  void problems;
}

// ---------- 4. the regular supporters follow the standing and vary ----------
{
  const low = { notoriety: 10, consensus: 2, popularity: 30, reputation: 30 }, high = { notoriety: 60, consensus: 30, popularity: 70, reputation: 85 };
  assert.ok(supporterTarget(high) > supporterTarget(low) * 3, 'Più notorietà, consenso e popolarità, più sostenitori.');
  assert.ok(supporterPerHead(high) > supporterPerHead(low), 'Con la reputazione alta ciascuno dà di più.');
  assert.ok(supporterTarget({}) >= SUPPORTERS.min && supporterTarget({ notoriety: 1e9, consensus: 1e9, popularity: 1e9 }) <= SUPPORTERS.max, 'Il numero resta in un intervallo.');
  const game = makeGame();
  const rand = seeded(11);
  const amounts = [];
  for (let week = 0; week < 60; week++) amounts.push(supporterIncome(game, high, rand).amount);
  assert.ok(new Set(amounts).size > 40, 'L’incasso cambia di settimana in settimana.');
  assert.ok(game.supporters.count > supporterTarget(low) * 2, 'Il numero cresce verso quello che il profilo sostiene (con inerzia).');
  const first = amounts[0], last = amounts.at(-1);
  assert.ok(Math.max(...amounts) <= supporterTarget(high) * supporterPerHead(high) * 1.3 && Math.min(...amounts) > 0, `Nessun bonus fisso né esplosione (${first}..${last}).`);
  // a worse standing lowers it, slowly
  const drop = Array.from({ length: 40 }, () => supporterIncome(game, low, rand).amount);
  assert.ok(drop.at(-1) < amounts.at(-1) * 0.6 && drop[0] > drop.at(-1), 'Se il profilo peggiora il circolo si restringe nel tempo, non di colpo.');
  // an old save without the model starts from the number the standing sustains: no jump
  const old = makeGame(); const entry = supporterIncome(old, high, () => 0.5);
  assert.ok(Math.abs(entry.count - supporterTarget(high)) < 1, 'Un salvataggio vecchio parte dal numero sostenuto dal profilo, senza salti.');
}

// ---------- 5. the new simulated fundraising: costs, varied outcomes, consequences, no guaranteed profit ----------
{
  const ids = ['crowdfunding', 'presentazione-libro', 'conferenza-retribuita', 'collaborazione-editoriale', 'consulenza-professionale'];
  for (const id of ids) {
    const spec = TREASURY_OPERATIONS.find(item => item.id === id);
    assert.ok(spec && spec.cost.ap >= 1 && spec.cost.funds >= 100, `${id}: ha un costo in giorni e denaro.`);
    assert.ok(spec.outcomes.some(item => item.tone === 'warn' && item.income[1] < spec.cost.funds + 400), `${id}: l’esito debole non è un guadagno garantito.`);
    const rand = seeded(id.length * 97);
    const results = new Set();
    let spent = 0, back = 0, min = Infinity, max = 0;
    for (let n = 0; n < 400; n++) {
      const game = makeGame({ funds: 100000 });
      game.week.index = 5;
      beginOperation(game, id, { week: 5, date: START });
      spent += spec.cost.funds; game.resources.funds -= spec.cost.funds;
      const settled = settleOperations(game, { week: 5 + spec.weeks, date: START, rand, notoriety: 30 });
      const entry = settled.results[0].entry; results.add(entry.result.outcome); back += entry.result.income; min = Math.min(min, entry.result.income); max = Math.max(max, entry.result.income);
    }
    assert.ok(results.size >= 3 && max > min * 2, `${id}: gli esiti variano (${[...results].join(', ')}).`);
    assert.ok(back / 400 < 5000 && min < spec.cost.funds + 300, `${id}: guadagno medio contenuto, e a volte non copre la spesa.`);
  }
  // the professional income belongs to the early stages: not with a high indemnity
  const spec = TREASURY_OPERATIONS.find(item => item.id === 'consulenza-professionale');
  const game = makeGame(); game.finance.indemnity = 300;
  assert.equal(operationProblem(game, spec), null, 'Con un’indennità bassa è compatibile.');
  game.finance.indemnity = 900;
  assert.match(operationProblem(game, spec), /non è compatibile/i); assert.throws(() => beginOperation(game, 'consulenza-professionale', { week: 1, date: START }), /compatibile/);
  const ind = makeGame(); ind.party = null;
  assert.match(operationProblem(ind, TREASURY_OPERATIONS.find(item => item.id === 'campagna-adesioni')), /Serve un partito/, 'Le operazioni del partito richiedono ancora un partito.');
}
console.log('Fondi e finanze verificati: versamenti e richieste al partito in due registri (nessun denaro creato o perso, saldi mai negativi, approvazione per ruolo, tetto e fondo minimo, attese), sostenitori ricorrenti che seguono il profilo e variano, cinque nuove entrate simulate con costi, esiti variabili e nessun guadagno garantito.');
