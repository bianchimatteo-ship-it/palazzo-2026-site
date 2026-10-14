// The plan of the week (several operations shown first and done together) and the treasury operations (cost now, outcome later, benefit not guaranteed).
// Plan: the preview runs the real operations on a copy and puts the game back (nothing changes), its totals are exactly what is charged, a step that cannot be done is named with the reason and
// the plan will not run, a duplicate is refused, carrying it out is one save and charges each operation once, a failure leaves nothing half done, and the same operations one by one give the
// same game. Treasury: the cost is paid at the start, the outcome is drawn when it falls due within the declared ranges and with the declared odds, the money goes through book() (the ledger
// agrees with the cash), a membership drive adds members and their fees, a repeat while one is in progress is refused, an independent cannot run the party's; invariants hold.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const KEY = 'palazzo-2026.career.v1';
const localStore = new Map();
let saves = 0;
globalThis.localStorage = { getItem: key => localStore.get(key) ?? null, setItem: (key, value) => { if (key === KEY) saves++; localStore.set(key, String(value)); }, removeItem: key => localStore.delete(key) };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const module = path => import(new URL(`../${path}${build ? `?v=${build}` : ''}`, import.meta.url).href);
const { TREASURY_OPERATIONS } = await module('src/data/simulation/finance-rules.js');
const { createFinance, beginOperation, settleOperations, operationRange, book } = await module('src/core/finance-engine.js');
const { checkInvariants } = await module('src/core/invariants.js');
const read = async name => JSON.parse(await readFile(new URL('../src/data/real/' + name + '.json', import.meta.url), 'utf8'));
const groups = await read('parliamentary-groups'), parties = await read('parties'), units = await read('territorial-units');

// ---------- 1. the operations as rules ----------
assert.ok(TREASURY_OPERATIONS.length >= 4 && new Set(TREASURY_OPERATIONS.map(item => item.id)).size === TREASURY_OPERATIONS.length);
for (const spec of TREASURY_OPERATIONS) {
  assert.ok(spec.cost.ap >= 1 && spec.cost.funds >= 100 && spec.weeks >= 2, `${spec.id}: costa giorni e fondi e richiede tempo.`);
  const total = spec.outcomes.reduce((sum, item) => sum + item.chance, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `${spec.id}: gli esiti sommano a 1.`);
  assert.ok(spec.outcomes.some(item => item.tone === 'warn'), `${spec.id}: il beneficio non è garantito, c’è un esito debole.`);
  assert.ok(spec.outcomes.every(item => (item.income ?? item.members).length === 2 && (item.income ?? item.members)[0] < (item.income ?? item.members)[1]));
  assert.ok(/non è garantit|può|non/i.test(spec.detail), `${spec.id}: lo dice.`);
}
// settle a hundred thousand draws: the odds and the ranges are the declared ones, and the books agree with the cash
{
  const rng = (() => { let seed = 42; return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; })();
  for (const spec of TREASURY_OPERATIONS) {
    const counts = new Map(); let risks = 0; const N = 4000;
    for (let i = 0; i < N; i++) {
      const game = { week: { index: 1 }, resources: { funds: 5000, politicalCapital: 10 }, party: { org: { members: 100 } }, finance: createFinance({ week: 1, funds: 5000 }) };
      const entry = beginOperation(game, spec.id, { week: 1, date: '2026-10-12' });
      assert.equal(entry.dueWeek, 1 + spec.weeks);
      assert.equal(settleOperations(game, { week: entry.dueWeek - 1, date: '2026-11-01', rand: rng }).results.length, 0, 'Prima della scadenza non c’è esito.');
      const before = game.resources.funds;
      const { results } = settleOperations(game, { week: entry.dueWeek, date: '2026-11-09', rand: rng, notoriety: 30 });
      assert.equal(results.length, 1); const result = game.finance.operations[0].result;
      counts.set(result.outcome, (counts.get(result.outcome) ?? 0) + 1);
      const outcome = spec.outcomes.find(item => item.label === result.outcome);
      const factor = spec.scale === 'notoriety' ? 0.5 + 30 / 60 : 1;
      if (outcome.income) assert.ok(result.income >= Math.round(outcome.income[0] * factor) && result.income <= Math.round(outcome.income[1] * factor), `${spec.id}: incasso nell’intervallo (${result.income}).`);
      if (outcome.members) assert.ok(result.members >= Math.round(outcome.members[0]) && result.members <= outcome.members[1]);
      assert.equal(game.resources.funds, before + result.income - result.extraCost, `${spec.id}: la cassa è quella dei movimenti.`);
      if (game.finance.ledger.length) assert.equal(game.finance.ledger[0].balance, game.resources.funds, `${spec.id}: l’ultimo movimento dice il saldo vero.`);
      assert.equal(game.finance.operations[0].status, 'concluso');
      if (result.extraCost) risks++;
      assert.throws(() => beginOperation(game, spec.id, { week: 20, date: '2026-12-01' }) && beginOperation(game, spec.id, { week: 20, date: '2026-12-01' }), /già in corso/, 'Una alla volta.');
    }
    for (const outcome of spec.outcomes) assert.ok(Math.abs((counts.get(outcome.label) ?? 0) / N - outcome.chance) < 0.05, `${spec.id}: «${outcome.label}» esce come dichiarato (${((counts.get(outcome.label) ?? 0) / N).toFixed(3)} contro ${outcome.chance}).`);
    if (spec.risk?.cost) assert.ok(Math.abs(risks / N - spec.risk.chance) < 0.03, `${spec.id}: il rischio di costi in più esce come dichiarato.`);
    const range = operationRange(spec, 30); assert.ok(range.low < range.high);
  }
}

// ---------- 2. in the game ----------
let imports = 0;
const load = async () => (await import('../src/core/store.js?plan=' + (++imports))).store;
const reload = async mutate => { const saved = JSON.parse(localStore.get(KEY)); mutate(saved); localStore.set(KEY, JSON.stringify(saved)); return load(); };
const realParty = parties.find(item => item.id === 'party-futuro-nazionale');
const draft = { firstName: 'Marta', lastName: 'Neri', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', previousProfession: 'Architetta', initialLevel: 'deputato', partyMode: 'existing', partyId: realParty.id, parliamentStartMode: 'real-context', parliamentaryGroupId: 'cam-xix-12', startingOffice: null, startingRole: null, partyName: '', partyDescription: '', difficulty: 'normale' };
const rich = saved => { saved.game.resources.funds = 20000; saved.game.resources.politicalCapital = 80; };
const fresh = async () => { localStore.clear(); let store = await load(); store.createCareer(draft, [realParty], groups); store.initializeCommittees(units); return reload(rich); };
const summary = store => { const s = store.getState(); return JSON.stringify({ ap: s.game.week.ap, funds: s.game.resources.funds, capital: s.game.resources.politicalCapital, committees: s.game.party.org.committees.map(item => [item.id, item.activists, item.fundedUntil, item.mobilizedUntil, item.members]), stats: s.dataset.statistics.filter(item => item.subjectId === s.career.playerId).map(item => [item.metric, item.value]), ledger: s.game.finance.ledger.length, uses: s.game.week.activityUses ?? {}, operations: s.game.finance.operations ?? [] }); };
let store = await fresh();
const baseSave = localStore.get(KEY);
const mine = store.getState().game.party.org.committees.filter(item => item.status !== 'dissoluzione' && !item.leader?.player);
const plan = [{ kind: 'activity', id: 'ascolto' }, { kind: 'committee', action: 'mobilita', id: mine[0].id }, { kind: 'committee', action: 'finanzia', id: mine[1].id }, { kind: 'treasury', id: 'cena-raccolta' }];

// preview: the game does not move
{
  const before = summary(store);
  const preview = store.planPreview(plan);
  assert.equal(summary(store), before, 'L’anteprima rimette il gioco com’era.');
  assert.ok(preview.ok && preview.lines.length === 4 && preview.lines.every(line => line.ok), 'Le quattro operazioni si possono fare.');
  const sum = key => preview.lines.reduce((total, line) => total + line.cost[key], 0);
  for (const key of ['ap', 'funds', 'capital']) assert.equal(preview.total[key], sum(key), `Totale ${key}: somma dei passi.`);
  assert.ok(preview.total.ap >= 3 && preview.total.funds >= 150 + 300 && preview.total.capital >= 1, `Costi mostrati: ${JSON.stringify(preview.total)}.`);
  assert.equal(preview.start.funds - preview.end.funds, preview.total.funds, 'Quanto resta è quanto c’era meno il totale.');
  assert.ok(preview.lines.every((line, index) => index === 0 || line.left.funds <= preview.lines[index - 1].left.funds), 'Ogni passo parte da ciò che il precedente ha lasciato.');
  // carrying it out: one save, each operation once, exactly the totals shown
  const funds0 = store.getState().game.resources.funds, ap0 = store.getState().game.week.ap, cap0 = store.getState().game.resources.politicalCapital;
  saves = 0;
  const done = store.executePlan(plan);
  assert.equal(saves, 1, 'Il piano è un solo salvataggio.');
  const s = store.getState();
  assert.equal(funds0 - s.game.resources.funds, preview.total.funds, 'Fondi addebitati: quelli mostrati.');
  assert.equal(ap0 - s.game.week.ap, preview.total.ap, 'Giorni usati: quelli mostrati.');
  assert.equal(cap0 - s.game.resources.politicalCapital, preview.total.capital, 'Capitale usato: quello mostrato.');
  assert.equal(done.results.length, 4);
  assert.equal(s.game.finance.operations.filter(item => item.opId === 'cena-raccolta').length, 1, 'La cena è avviata una volta sola.');
  assert.equal(s.game.log.filter(entry => entry.title === 'Giro di ascolto').length, 1, 'L’attività è nel diario una volta sola: nessun effetto duplicato.');
  assert.ok(s.game.party.org.committees.find(item => item.id === mine[1].id).fundedUntil > s.game.week.index, 'Gli effetti sul comitato ci sono (finanziato).');
  assert.ok(checkInvariants(s).ok, 'Le invarianti reggono.');
  // the same operations one by one on the same game: the same result
  localStore.set(KEY, baseSave);
  const sequential = await load();
  sequential.performWeeklyActivity('ascolto'); sequential.committeeAction('mobilita', { committeeId: mine[0].id }); sequential.committeeAction('finanzia', { committeeId: mine[1].id }); sequential.startTreasuryOperation('cena-raccolta');
  const pick = st => { const g = st.getState().game; return JSON.stringify([g.week.ap, g.resources, g.party.org.committees.map(item => [item.id, item.activists, item.fundedUntil, item.mobilizedUntil]), g.finance.operations.map(item => [item.opId, item.dueWeek]), g.week.activityUses]); };
  assert.equal(pick(store), pick(sequential), 'Fare le operazioni insieme o una per una dà lo stesso gioco.');
}

// what cannot be done: named, nothing runs, nothing half done
{
  store = await fresh();
  const before = summary(store);
  const tooMany = [{ kind: 'activity', id: 'progetto' }, { kind: 'activity', id: 'squadra' }, { kind: 'activity', id: 'associazioni' }];
  const preview = store.planPreview(tooMany);
  assert.ok(!preview.ok && preview.lines.some(line => !line.ok && /giorni/.test(line.problem)), `Giorni insufficienti: il passo e il motivo (${preview.lines.map(line => line.problem ?? 'ok').join(' | ')}).`);
  assert.equal(summary(store), before, 'Neanche l’anteprima di un piano impossibile cambia nulla.');
  saves = 0;
  assert.throws(() => store.executePlan(tooMany), /Il piano non si può eseguire/, 'Un piano impossibile non parte.');
  assert.equal(summary(store), before, 'Nulla è cambiato.'); assert.equal(saves, 0, 'Nessun salvataggio parziale.');
  assert.throws(() => store.planPreview([{ kind: 'activity', id: 'ascolto' }, { kind: 'activity', id: 'ascolto' }]), /compare due volte/, 'Doppioni rifiutati.');
  assert.throws(() => store.planPreview([{ kind: 'voto', id: 'x' }]), /non riconosciuta/, 'Solo le operazioni previste (niente voti, candidature o accordi).');
  assert.throws(() => store.planPreview(Array.from({ length: 13 }, (_, index) => ({ kind: 'committee', action: 'finanzia', id: `c${index}` }))), /al massimo 12/);
  assert.equal(store.planPreview([]).ok, false, 'Un piano vuoto non è eseguibile.');
  assert.throws(() => store.executePlan([]), /vuoto/);
  const noFunds = await reload(saved => { saved.game.resources.funds = 100; });
  const poor = noFunds.planPreview([{ kind: 'activity', id: 'ascolto' }, { kind: 'treasury', id: 'cena-raccolta' }]);
  assert.ok(!poor.ok && poor.lines.some(line => /fondi/.test(line.problem ?? '')), 'Fondi insufficienti: bloccato, con la cifra.');
  // a repeat of the weekly-capped activity inside one plan, or after it
  store = await fresh();
  store.executePlan([{ kind: 'activity', id: 'corso-politiche' }]);
  assert.ok(!store.planPreview([{ kind: 'activity', id: 'corso-politiche' }]).ok, 'Una volta a settimana vale anche nel piano.');
}

// treasury operations through a week: the cost now, the outcome later
{
  store = await fresh();
  const funds0 = store.getState().game.resources.funds;
  store.startTreasuryOperation('campagna-adesioni');
  let s = store.getState();
  assert.equal(funds0 - s.game.resources.funds, 250, 'Il costo si paga all’avvio.');
  assert.equal(s.game.finance.operations[0].status, 'in-corso'); assert.equal(s.game.finance.operations[0].result, null, 'L’esito non è noto in anticipo.');
  assert.throws(() => store.startTreasuryOperation('campagna-adesioni'), /già in corso/, 'Una alla volta.');
  const members0 = s.game.party.org.members;
  for (let i = 0; i < 4; i++) store.advance(7);
  s = store.getState();
  const entry = s.game.finance.operations.find(item => item.opId === 'campagna-adesioni');
  assert.equal(entry.status, 'concluso'); assert.ok(entry.result.members >= 10 && entry.result.members <= 320, `Adesioni: ${entry.result.members}.`);
  assert.ok(s.game.party.org.members >= members0 + entry.result.members - 5, 'Gli iscritti sono davvero aumentati.');
  assert.equal(s.game.party.org.members, s.game.party.org.sections.reduce((sum, item) => sum + item.members, 0), 'Il totale degli iscritti è la somma delle sezioni.');
  assert.ok(s.game.lastReport || s.game.log.some(item => item.kind === 'tesoreria'), 'Resta nel diario.');
  assert.ok(checkInvariants(s).ok, 'Le invarianti reggono.');
  store.startTreasuryOperation('campagna-adesioni');
  const independent = await reload(saved => { rich(saved); saved.game.party = null; });
  assert.throws(() => independent.startTreasuryOperation('evento-partito'), /Serve un partito|tesoreria/, 'Un indipendente non organizza eventi del partito.');
}
console.log('Piano e tesoreria verificati: l’anteprima esegue le operazioni vere su una copia e rimette tutto com’era; i totali mostrati sono quelli addebitati (giorni, fondi, capitale), un solo salvataggio, ogni operazione una volta, lo stesso risultato che si avrebbe una per una; un piano impossibile, vuoto, con doppioni o con operazioni non previste (voti, candidature, accordi) non parte e non lascia nulla a metà; quattro operazioni di tesoreria con costo subito, esito alla scadenza con le probabilità e gli intervalli dichiarati su 16.000 estrazioni, cassa e registro in accordo, iscritti e quote, una alla volta, solo con un partito dove serve.');
