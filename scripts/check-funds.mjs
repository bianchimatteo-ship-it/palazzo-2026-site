// The three purses of the game, kept apart and charged once: the player's own money (cassa personale), the treasury of the party, and the election fund set aside for the next campaign.
//   - each action says which purse pays and only that one moves: an operation of the player's treasury desk and a weekly plan charge the personal cash; an investment of the party only the
//     treasury; saving for the election moves cash into the fund (once, one entry in the books) and cannot be taken twice;
//   - when a campaign starts, the money it receives is exactly what each purse gave: the share of the personal cash, the fund (with the donors' 15%) and the party's support, plus the days of
//     preparation and the committees' own money; each purse is charged once and by that amount, the fund is emptied, the books have one entry for each, and a second campaign does not take it again;
//   - the Finanze page shows them under their own names, never one total that mixes them.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const KEY = 'palazzo-2026.career.v1';
const read = async name => JSON.parse(await readFile(new URL(`../src/data/real/${name}.json`, import.meta.url), 'utf8'));
const parties = await read('parties'), groups = await read('parliamentary-groups'), units = await read('territorial-units');
const realParty = parties.find(item => item.id === 'party-futuro-nazionale');
const realData = await import(`../src/data/repositories/real-data.js${v}`);
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'twoPerThousand', 'parliamentaryGroups', 'politicians']);
const db = realData.realDatabase;
let imports = 0;
const load = async () => { const { store } = await import(`../src/core/store.js${v}&fondi=${++imports}`); store.setRealReference({ twoPerThousand: db.twoPerThousand, parties: db.parties, movements: db.politicalMovements }); return store; };
const reload = async mutate => { const saved = JSON.parse(mem.get(KEY)); mutate(saved); mem.set(KEY, JSON.stringify(saved)); return load(); };
const draft = { firstName: 'Marta', lastName: 'Fondi', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', previousProfession: 'Architetta', initialLevel: 'comunale', partyMode: 'existing', partyId: realParty.id, parliamentStartMode: 'real-context', parliamentaryGroupId: null };
const wallets = store => { const g = store.getState().game; return { cash: g.resources.funds, treasury: g.party.org.treasury.balance, fund: g.finance?.electionFund ?? 0, capital: g.resources.politicalCapital, ap: g.week.ap }; };
const entries = (store, category) => (store.getState().game.finance?.ledger ?? []).filter(item => item.category === category);

mem.clear();
let store = await load();
store.createCareer(draft, [realParty], groups);
store.initializeCommittees(units);
store = await reload(saved => { saved.game.resources.funds = 30000; saved.game.resources.politicalCapital = 40; saved.game.party.org.treasury.balance = 60000; saved.game.finance.electionFund = 0; saved.game.party.rank = 5; });

// ---------- 1. the three purses exist and are different numbers ----------
{
  const w = wallets(store);
  assert.ok(w.cash === 30000 && w.treasury === 60000 && w.fund === 0, `Tre casse: personale ${w.cash}, tesoreria del partito ${w.treasury}, fondo elettorale ${w.fund}.`);
  const { renderFinancePage } = await import(`../src/ui/finance-mode.js${v}`);
  const page = renderFinancePage(store.getState());
  for (const label of ['Cassa', 'Fondo elettorale']) assert.ok(page.includes(label), `La pagina Finanze nomina «${label}».`);
  assert.ok(/tesoreria del partito|Tesoreria/i.test(page), 'E la tesoreria del partito.');
  assert.ok(!/undefined|NaN|\[object Object\]/.test(page), 'Senza valori non validi.');
}

// ---------- 2. who pays what ----------
{
  // an operation of the treasury desk: the personal cash, not the party's
  let before = wallets(store);
  store.startTreasuryOperation('campagna-adesioni');
  let after = wallets(store);
  assert.equal(before.cash - after.cash, 250, 'L’operazione di tesoreria costa 250 € della cassa personale.');
  assert.equal(after.treasury, before.treasury, 'La tesoreria del partito non si muove.');
  assert.equal(after.fund, before.fund, 'Né il fondo elettorale.');
  // an investment of the party: the party's treasury, not the personal cash
  before = wallets(store);
  store.partyInvestment('sedi-regionali');
  after = wallets(store);
  assert.ok(before.treasury - after.treasury > 0 && after.cash === before.cash && after.fund === before.fund, `Un investimento del partito costa alla tesoreria (${before.treasury - after.treasury} €) e a nessun’altra cassa.`);
  // saving for the election: cash → fund, once
  before = wallets(store);
  const booked = entries(store, 'fondo').length;
  store.saveForElection(5000);
  after = wallets(store);
  assert.equal(before.cash - after.cash, 5000, 'Mettere da parte 5.000 € per le elezioni li toglie dalla cassa personale…');
  assert.equal(after.fund - before.fund, 5000, '…e li mette nel fondo, né più né meno.');
  assert.equal(after.treasury, before.treasury, 'La tesoreria del partito resta quella.');
  assert.equal(entries(store, 'fondo').length - booked, 1, 'Una sola voce nei conti.');
  assert.equal(before.cash + before.fund, after.cash + after.fund, 'La somma di cassa e fondo non cambia: il denaro si sposta, non si moltiplica.');
  assert.throws(() => store.saveForElection(10_000_000), /cifra in cassa/i, 'Non si accantona più di quanto si ha.');
  assert.equal(wallets(store).fund, 5000, 'E il rifiuto non lascia nulla a metà.');
  // a weekly plan: the sum of its parts, charged once
  const plan = [{ kind: 'treasury', id: 'cena-raccolta' }];
  before = wallets(store);
  const preview = store.planPreview(plan);
  store.executePlan(plan);
  after = wallets(store);
  assert.equal(before.cash - after.cash, preview.total.funds, 'Il piano costa alla cassa personale quanto dice l’anteprima, una volta.');
  assert.equal(after.treasury, before.treasury, 'La tesoreria del partito non paga le operazioni del giocatore.');
}

// ---------- 3. a campaign starts: each purse gives once, the candidate receives the sum ----------
{
  store.fastForwardToElection('comunale');
  store = await reload(saved => { saved.game.resources.funds = 30000; saved.game.party.org.treasury.balance = 60000; });
  store.saveForElection(8000);
  const before = wallets(store);
  assert.ok(before.fund >= 8000, `Il fondo ha i suoi soldi prima della campagna (${before.fund} €).`);
  const ratio = before.cash;
  store.startCampaign({ electionType: 'comunale', role: 'consigliere', objective: 'seat', municipalityBand: 'fino-15000' }, db.parties);
  const state = store.getState();
  const campaign = state.campaign;
  assert.ok(campaign && campaign.status === 'active', 'La campagna è partita.');
  const after = wallets(store);
  const prep = campaign.preparation;
  assert.equal(before.cash - after.cash, prep.transfer, `La cassa personale dà ${prep.transfer} €, e solo quelli (ha dato ${before.cash - after.cash}).`);
  assert.equal(prep.transfer, Math.round(ratio * 0.6), 'Il 60% della cassa, come dichiarato.');
  assert.equal(before.treasury - after.treasury, prep.partyFunds, `La tesoreria del partito dà ${prep.partyFunds} € (ha dato ${before.treasury - after.treasury}).`);
  assert.equal(prep.fund, Math.round(before.fund * 1.15), 'Il fondo elettorale arriva con la quota dei donatori (il 15%).');
  assert.equal(after.fund, 0, 'E si svuota: non può essere preso due volte.');
  const candidate = campaign.candidates.find(item => item.isPlayer);
  const given = prep.transfer + prep.fund + prep.partyFunds;
  assert.ok(candidate.resources.money >= given, `Il candidato riceve almeno la somma di ciò che hanno dato le tre casse (${candidate.resources.money} € contro ${given} €; il di più viene dai giorni di preparazione e dai comitati del territorio, che non pagano nessuna delle tre).`);
  assert.equal(state.game.finance.ledger.filter(item => item.category === 'campagne' && /Fondi trasferiti alla campagna/.test(item.label ?? '')).length, 1, 'Un solo movimento di cassa per i fondi trasferiti alla campagna.');
  assert.equal(entries(store, 'fondo').filter(item => /campagna/i.test(item.label)).length, 1, 'E uno per il fondo elettorale che passa alla campagna (senza toccare la cassa).');
  const fundEntry = entries(store, 'fondo').find(item => /campagna/i.test(item.label));
  assert.equal(fundEntry.amount, 0, 'La voce del fondo non sposta la cassa: i soldi erano già usciti quando sono stati accantonati.');
  // the invariants hold: no negative purse, no invented money
  assert.ok(after.cash >= 0 && after.treasury >= 0 && after.fund >= 0, 'Nessuna cassa in negativo.');
  assert.ok(Number.isFinite(after.cash) && Number.isFinite(after.treasury) && Number.isFinite(candidate.resources.money), 'Nessun valore non valido.');
  // no second campaign takes the same money (one main candidacy: the second is refused, and nothing moves)
  const snapshot = JSON.stringify(wallets(store));
  assert.throws(() => store.startCampaign({ electionType: 'comunale', role: 'consigliere', objective: 'seat', municipalityBand: 'fino-15000' }, db.parties), /./, 'Una seconda campagna non parte.');
  assert.equal(JSON.stringify(wallets(store)), snapshot, 'E non tocca nessuna cassa.');
}
console.log('Le tre casse verificate: cassa personale, tesoreria del partito e fondo elettorale hanno nomi e importi distinti; un’operazione di tesoreria e un piano della settimana pagano solo dalla cassa personale, un investimento del partito solo dalla tesoreria, mettere da parte per le elezioni sposta il denaro (una voce, somma invariata, rifiuto senza effetti); all’avvio di una campagna ognuna dà una volta e l’importo dichiarato (60% della cassa, fondo con i donatori al 15%, sostegno del partito), il fondo si svuota, una seconda campagna non riprende gli stessi soldi.');
