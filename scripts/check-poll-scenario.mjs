// The opening poll of a new career: «Realistico» (the real Supermedia, untouched), «Casuale» (an invented but plausible picture drawn from a seed) and «Personalizzato» (the numbers the player writes).
//   - the engine: for hundreds of seeds the poll is a list of shares in tenths of a point that adds up to exactly 100.0 with "Altri", with no NaN, no negative figure, every force between the limits; the same seed
//     gives the same poll, other seeds give other ones; a written poll that does not add up is refused with the reason, «Porta a 100» makes it add up;
//   - the game: a career started with each mode opens with the right poll (real source untouched, or a poll marked as a simulation that says which real poll it started from), the forces of the world start from those
//     shares, the same seed gives the same game, the poll survives a reload (and a rebuilt world), a written poll that does not add up never starts a career, and the real data files are byte-for-byte what they were;
//   - in Chrome (skipped without it): the wizard (step 4) shows the three modes, the table with the real figures beside the game's ones, the seed and «Nuovo seme», the written values with «Porta a 100», the refusal
//     with the reason, the summary; the career that starts says «scenario» on the Sondaggi page (never «DATO REALE»), at 390 and 1280 px without a horizontal scroll and without invalid values.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromeAvailable, withBrowser } from './lib/browser.mjs';
import { POLL_SCENARIOS, SCENARIO_LIMITS, allocate, customPoll, fitCustom, normalizePollScenario, randomPoll, scenarioPoll } from '../src/core/poll-scenario.js';

const sha = async name => createHash('sha256').update(await readFile(new URL(`../src/data/real/${name}.json`, import.meta.url))).digest('hex');
const REAL_FILES = ['polls', 'parties', 'database', 'manifest'];
const before = Object.fromEntries(await Promise.all(REAL_FILES.map(async name => [name, await sha(name)])));
const tenths = value => Math.round(value * 10);

// ---------- 1. the engine ----------
const polls = JSON.parse(await readFile(new URL('../src/data/real/polls.json', import.meta.url), 'utf8'));
const supermedia = polls.filter(poll => poll.source === 'real' && (poll.verified === true || poll.verificationStatus === 'in-attesa-di-conferma')).sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))[0];
const rows = supermedia.results.map(row => ({ partyId: row.entityId, share: row.share, delta: row.delta ?? 0 }));
assert.ok(rows.length >= 8, `La Supermedia ha le sue forze (${rows.length}).`);
const realSum = rows.reduce((sum, row) => sum + tenths(row.share), 0);

const checkPoll = (poll, label) => {
  assert.equal(poll.rows.length, rows.length, `${label}: tutte le forze della fonte.`);
  const sum = poll.rows.reduce((total, row) => total + tenths(row.share), 0) + tenths(poll.others);
  assert.equal(sum, 1000, `${label}: partiti e Altri fanno esattamente 100,0 (fanno ${sum / 10}).`);
  assert.equal(tenths(poll.total), 1000, `${label}: il totale dichiarato è 100,0.`);
  for (const row of poll.rows) {
    assert.ok(Number.isFinite(row.share) && Number.isFinite(row.delta), `${label}: ${row.partyId} senza NaN.`);
    assert.ok(row.share >= SCENARIO_LIMITS.minShare - 1e-9 && row.share <= SCENARIO_LIMITS.maxShare + 1e-9, `${label}: ${row.partyId} ${row.share}% entro i limiti.`);
    assert.equal(tenths(row.share) / 10, row.share, `${label}: ${row.partyId} ha al più un decimale.`);
  }
  assert.ok(Number.isFinite(poll.others) && poll.others >= SCENARIO_LIMITS.othersMin - 1e-9 && poll.others <= SCENARIO_LIMITS.othersMax + 1e-9, `${label}: Altri ${poll.others}% entro i limiti.`);
};

const seen = new Set();
for (let i = 0; i < 400; i++) {
  const seed = i < 100 ? String(i) : `seme-${i}-${(i * 7919) % 1013}`;
  const poll = scenarioPoll({ mode: 'casuale', seed }, { rows, seedText: 'politicando' });
  checkPoll(poll, `casuale «${seed}»`);
  assert.equal(poll.mode, 'casuale');
  assert.deepEqual(scenarioPoll({ mode: 'casuale', seed }, { rows, seedText: 'politicando' }), poll, `Lo stesso seme «${seed}» dà lo stesso quadro.`);
  seen.add(poll.rows.map(row => row.share).join(','));
}
assert.ok(seen.size >= 395, `Semi diversi danno quadri diversi (${seen.size} su 400).`);
{
  // a plausible picture: the leading real force stays among the first three, no force disappears, the largest one stays the largest a good part of the time
  const top = rows.reduce((best, row) => row.share > best.share ? row : best, rows[0]).partyId;
  let stays = 0, tops = 0;
  for (let i = 0; i < 200; i++) {
    const poll = scenarioPoll({ mode: 'casuale', seed: `ordine-${i}` }, { rows, seedText: 'politicando' });
    const ranked = poll.rows.slice().sort((a, b) => b.share - a.share).map(row => row.partyId);
    if (ranked.indexOf(top) < 3) stays++;
    if (ranked[0] === top) tops++;
  }
  assert.ok(stays >= 190, `La prima forza reale resta tra le prime tre in quasi tutti i quadri (${stays}/200).`);
  assert.ok(tops >= 40 && tops <= 190, `Ma l’ordine può cambiare (la prima resta prima ${tops} volte su 200).`);
}
assert.notDeepEqual(scenarioPoll({ mode: 'casuale', seed: 'a' }, { rows, seedText: 'politicando' }).rows, scenarioPoll({ mode: 'casuale', seed: 'b' }, { rows, seedText: 'politicando' }).rows, 'Due semi, due quadri.');

// realistic: the rows as the source published them
{
  const poll = scenarioPoll({ mode: 'realistico' }, { rows, seedText: 'politicando' });
  assert.deepEqual(poll.rows.map(row => [row.partyId, row.share, row.delta]), rows.map(row => [row.partyId, row.share, row.delta]), 'Realistico: le percentuali e le variazioni della fonte.');
  assert.equal(tenths(poll.rows.reduce((total, row) => total + row.share, 0)) + tenths(poll.others), 1000, 'E il totale con Altri è 100.');
}
// custom: what is written, the rest to "Altri"; refusals say why
{
  const custom = Object.fromEntries(rows.map(row => [row.partyId, 5]));
  const ok = customPoll({ rows, custom });
  assert.equal(ok.problems.length, rows.length * 5 > 99 ? 1 : 0, 'Cinque per cento a tutti: ' + (rows.length * 5 > 99 ? 'non resta nulla ad Altri' : 'accettato') + '.');
  const exact = fitCustom({ rows, custom: { ...custom, [rows[0].partyId]: 30 } });
  const fitted = customPoll({ rows, custom: exact });
  assert.deepEqual(fitted.problems, [], '«Porta a 100» dà un quadro che torna.');
  checkPoll({ ...fitted, mode: 'personalizzato' }, 'porta a 100');
  const over = customPoll({ rows, custom: { ...Object.fromEntries(rows.map(row => [row.partyId, 20])) } });
  assert.ok(over.problems.some(item => /Altri|sommano/.test(item)), `Oltre 100: lo dice (${over.problems[0]}).`);
  assert.ok(customPoll({ rows, custom: { [rows[0].partyId]: 80 } }).problems.some(item => /superare/.test(item)), 'Un partito oltre il massimo: rifiutato.');
  assert.ok(customPoll({ rows, custom: { [rows[0].partyId]: 0.1 } }).problems.some(item => /almeno/.test(item)), 'Sotto il minimo: rifiutato.');
  assert.ok(customPoll({ rows, custom: { [rows[0].partyId]: 'abc' } }).problems.length >= 1, 'Un testo al posto del numero: rifiutato.');
  const real = customPoll({ rows, custom: {} });
  assert.deepEqual(real.problems, [], 'Senza valori scritti: la Supermedia reale.');
  assert.deepEqual(real.rows.map(row => row.share), rows.map(row => row.share), 'Gli stessi numeri.');
  assert.equal(tenths(real.total), 1000);
}
// allocate and the normalisation
assert.deepEqual(allocate([1, 1, 1], 100, 0).reduce((a, b) => a + b, 0), 100, 'La ripartizione fa il totale.');
assert.equal(allocate([0, 0, 0], 99, 0).reduce((a, b) => a + b, 0), 99, 'Anche senza pesi.');
assert.deepEqual(normalizePollScenario({ mode: 'inventata', seed: 5, custom: { 'party-x': '12', 'a b': 3, 'party-y': 'x' } }), { mode: 'realistico', seed: '5', custom: { 'party-x': 12 } }, 'Un modo ignoto torna a Realistico, il seme è un testo, i valori non validi cadono.');
assert.equal(normalizePollScenario(null).mode, 'realistico', 'Senza scelta: Realistico.');
assert.equal(Object.keys(POLL_SCENARIOS).join(), 'realistico,casuale,personalizzato');
assert.ok(randomPoll({ rows, seedText: 'x', seed: '' }).total === 100, 'Anche un seme vuoto.');

// ---------- 2. the game ----------
const nativeFetch = globalThis.fetch;   // (the browser part needs the real one back: it waits for the local server)
const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(url)), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '';
const KEY = 'palazzo-2026.career.v1';
const read = async name => JSON.parse(await readFile(new URL(`../src/data/real/${name}.json`, import.meta.url), 'utf8'));
const parties = await read('parties'), groups = await read('parliamentary-groups');
const realParty = parties.find(item => item.id === 'party-futuro-nazionale');
const realData = await import(`../src/data/repositories/real-data.js${v}`);
await realData.loadRealDatabase();
await realData.loadRealCollections(['parties', 'politicalMovements', 'twoPerThousand', 'parliamentaryGroups', 'politicians', 'realPolls', 'government']);
const db = realData.realDatabase;
let imports = 0;
const load = async () => { const { store } = await import(`../src/core/store.js${v}&scenario=${++imports}`); store.setRealReference({ twoPerThousand: db.twoPerThousand, parties: db.parties, movements: db.politicalMovements, polls: db.realPolls, governingIds: [] }); return store; };
const draft = (extra = {}) => ({ firstName: 'Marta', lastName: 'Sondaggi', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', previousProfession: 'Architetta', initialLevel: 'comunale', partyMode: 'existing', partyId: realParty.id, parliamentStartMode: 'real-context', parliamentaryGroupId: null, ...extra });
const first = state => state.world.polls[0];

mem.clear();
let store = await load();
const view = store.pollScenarioView({ mode: 'realistico' });
if (!view.available) {
  // (the Supermedia is part of the dataset: without it there is nothing to test beyond the engine)
  console.log('Parte del gioco NON eseguita: la Supermedia non è stata caricata nello store del test.');
  process.exit(1);
}
// the forces the game can show: those of the source that the database knows (a row of the source with no verified party is left out, as in the real opening poll)
const live = view.rows.map(row => ({ partyId: row.partyId, share: row.real, delta: row.realDelta }));
assert.ok(live.length >= 8 && live.length <= rows.length, `La vista della procedura ha le forze della fonte che il gioco conosce (${live.length} di ${rows.length}).`);
assert.equal(tenths(view.total), 1000);
assert.ok(view.rows.every(row => Number.isFinite(row.share) && Number.isFinite(row.real)), 'Vista senza NaN.');

// realistic: the real poll, with its source, as ever
store.createCareer(draft(), [realParty], groups);
{
  const poll = first(store.getState());
  assert.equal(poll.source, 'real', 'Realistico: il primo sondaggio è dato reale.');
  assert.ok(poll.real && /youtrend/i.test(poll.real.sourceUrl), 'Con la sua fonte.');
  assert.ok(!poll.scenario, 'Senza scenario.');
  assert.equal(store.getState().career.pollScenario, null, 'E la carriera non porta nessuno scenario.');
  assert.equal(poll.results.filter(row => row.real).length, poll.results.length - poll.results.filter(row => row.outsideSource).length, 'Le righe sono dati reali.');
}

// random: a simulation that says where it started from
const SEED = 'prova-7';
store.createCareer(draft({ pollMode: 'casuale', pollSeed: SEED }), [realParty], groups);
const randomState = store.getState();
const randomPollOpen = first(randomState);
{
  assert.equal(randomPollOpen.source, 'simulation', 'Casuale: il primo sondaggio è una simulazione.');
  assert.ok(!randomPollOpen.real, 'Non porta il blocco «dato reale».');
  assert.equal(randomPollOpen.scenario.mode, 'casuale');
  assert.equal(randomPollOpen.scenario.seed, SEED);
  assert.equal(randomPollOpen.scenario.basedOn.id, supermedia.id, 'Dice da quale sondaggio reale è partito.');
  assert.equal(randomPollOpen.othersSource, 'scenario');
  assert.ok(randomPollOpen.results.every(row => !row.real), 'Nessuna riga è segnata come dato reale.');
  const measured = randomPollOpen.results.filter(row => !row.outsideSource);
  assert.equal(measured.reduce((total, row) => total + tenths(row.share), 0) + tenths(randomPollOpen.others), 1000, 'Partiti e Altri: 100,0 esatti nel sondaggio della partita.');
  assert.ok(measured.every(row => Number.isFinite(row.share) && Number.isFinite(row.delta)), 'Senza NaN.');
  const expected = scenarioPoll({ mode: 'casuale', seed: SEED }, { rows: live, seedText: 'politicando' });
  assert.deepEqual(measured.map(row => [row.partyId, row.share]), expected.rows.map(row => [row.partyId, row.share]), 'È il quadro che la procedura aveva mostrato.');
  // the world starts from those shares (not from the source's)
  const world = randomState.world;
  const top = expected.rows.slice().sort((a, b) => b.share - a.share)[0];
  assert.equal(world.parties.find(party => party.id === top.partyId).baseline, top.share, 'Le forze del mondo partono dalle percentuali dello scenario.');
  assert.equal(randomState.career.pollScenario.mode, 'casuale', 'La carriera ricorda lo scenario.');
  assert.ok(randomState.game.timeline.some(item => /Sondaggio iniziale: scenario casuale/.test(item.title)), 'E la storia della carriera lo dice.');
  // the real reference of each force is still the source's
  assert.ok(world.parties.filter(party => party.pollReference).every(party => party.pollReference.source === 'real' && party.pollReference.label === supermedia.label), 'Il riferimento reale di ogni forza resta quello della fonte.');
}
// the same seed → the same game; another seed → another one
store.createCareer(draft({ pollMode: 'casuale', pollSeed: SEED }), [realParty], groups);
assert.deepEqual(first(store.getState()).results.map(row => [row.partyId, row.share]), randomPollOpen.results.map(row => [row.partyId, row.share]), 'Lo stesso seme, lo stesso sondaggio.');
store.createCareer(draft({ pollMode: 'casuale', pollSeed: 'altro' }), [realParty], groups);
assert.notDeepEqual(first(store.getState()).results.map(row => row.share), randomPollOpen.results.map(row => row.share), 'Un altro seme, un altro sondaggio.');

// it survives a reload: from the save, and from a rebuilt world
store.createCareer(draft({ pollMode: 'casuale', pollSeed: SEED }), [realParty], groups);
const expectedRows = first(store.getState()).results.map(row => [row.partyId, row.share]);
store = await load();
assert.deepEqual(first(store.getState()).results.map(row => [row.partyId, row.share]), expectedRows, 'Ricaricata la partita, il sondaggio iniziale è lo stesso.');
assert.equal(store.getState().career.pollScenario.seed, SEED, 'E lo scenario salvato.');
for (let i = 0; i < 4; i++) store.advanceTurn(1);
const afterWeeks = store.getState();
assert.deepEqual(afterWeeks.world.polls[0].results.map(row => [row.partyId, row.share]), expectedRows, 'Dopo quattro settimane il primo sondaggio non è cambiato.');
assert.ok(afterWeeks.world.polls.length >= 5 && afterWeeks.world.polls.slice(1).every(poll => poll.source === 'simulation' && !poll.scenario), 'I successivi sono sondaggi simulati ordinari.');
assert.ok(afterWeeks.world.polls.every(poll => poll.results.every(row => Number.isFinite(row.share) && Number.isFinite(row.delta))), 'Mai un NaN lungo il percorso.');
{
  const saved = JSON.parse(mem.get(KEY));
  saved.world = { ...saved.world, version: 1, parties: [] };   // an old world: the game rebuilds it from the career's scenario
  mem.set(KEY, JSON.stringify(saved));
  store = await load();
  const rebuilt = store.getState().world;
  assert.ok(rebuilt?.polls?.length, 'Il mondo vecchio è stato ricostruito.');
  assert.deepEqual(rebuilt.polls[0].results.filter(row => !row.outsideSource).map(row => [row.partyId, row.share]), expectedRows.filter(([id]) => rebuilt.polls[0].results.some(row => row.partyId === id && !row.outsideSource)), 'Un mondo ricostruito riparte dallo stesso scenario, forza per forza.');
  assert.equal(rebuilt.polls[0].scenario?.seed, SEED, 'E dice lo stesso seme.');
}

// custom: written values, a written poll that does not add up never starts a career
mem.clear(); store = await load();
{
  const write = Object.fromEntries(live.map((row, index) => [row.partyId, index === 0 ? 30 : Math.max(0.5, Math.round(row.share * 0.8 * 10) / 10)]));
  const fitted = store.pollScenarioView({ mode: 'personalizzato', custom: write });
  assert.deepEqual(fitted.problems, [], `Valori scritti che tornano (${fitted.problems[0] ?? 'nessun problema'}).`);
  store.createCareer(draft({ pollMode: 'personalizzato', pollCustom: write }), [realParty], groups);
  const poll = first(store.getState());
  assert.equal(poll.scenario.mode, 'personalizzato');
  const measured = poll.results.filter(row => !row.outsideSource);
  assert.equal(measured.find(row => row.partyId === live[0].partyId).share, 30, 'Il valore scritto è nel sondaggio.');
  assert.equal(measured.reduce((total, row) => total + tenths(row.share), 0) + tenths(poll.others), 1000, 'E il totale è 100,0.');
  const snapshot = JSON.stringify(store.getState().career.id);
  const tooMuch = Object.fromEntries(live.map(row => [row.partyId, 20]));
  assert.throws(() => store.createCareer(draft({ pollMode: 'personalizzato', pollCustom: tooMuch }), [realParty], groups), /Altri|sommano/, 'Una somma oltre 100 non fa partire la carriera.');
  assert.equal(JSON.stringify(store.getState().career.id), snapshot, 'E la partita in corso resta quella.');
  const auto = store.fitPollScenario({ mode: 'personalizzato', custom: tooMuch });
  assert.deepEqual(store.pollScenarioView({ mode: 'personalizzato', custom: auto }).problems, [], '«Porta a 100» rende valido anche quel quadro.');
}

// the real data are what they were
{
  const after = Object.fromEntries(await Promise.all(REAL_FILES.map(async name => [name, await sha(name)])));
  assert.deepEqual(after, before, 'I file dei dati reali non sono cambiati di un byte.');
  const rereadPolls = JSON.parse(await readFile(new URL('../src/data/real/polls.json', import.meta.url), 'utf8'));
  assert.deepEqual(rereadPolls.find(poll => poll.id === supermedia.id).results.map(row => row.share), supermedia.results.map(row => row.share), 'Le percentuali della Supermedia reale sono quelle della fonte.');
}

// ---------- 3. in Chrome ----------
let browserNote = 'parte nel browser NON eseguita (Chrome non trovato)';
globalThis.fetch = nativeFetch;
if (chromeAvailable) {
  await withBrowser(async browser => {
    const { evaluate, viewport, waitFor, pause, goto, errors } = browser;
    const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
    const setValue = (selector, value) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.focus(); el.value = ${JSON.stringify(String(value))}; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    const text = selector => evaluate(`(document.querySelector(${JSON.stringify(selector)})?.textContent ?? '').replace(/\\s+/g, ' ').trim()`);
    const overflow = () => evaluate(`document.documentElement.scrollWidth - window.innerWidth`);
    for (const [width, height] of [[390, 844], [1280, 800]]) {
      await viewport(width, height, width < 800);
      // a clean browser has no IndexedDB copy of the saves either
      await evaluate(`new Promise(resolve => { const done = () => resolve(true); const request = indexedDB.deleteDatabase('politicando-vault'); request.onsuccess = request.onerror = request.onblocked = done; })`);
      await evaluate(`localStorage.clear(), sessionStorage.clear(), localStorage.setItem('politicando.onboarding.v1', JSON.stringify({ account: true, tour: 'done', localStart: true })), true`);
      await goto();
      await waitFor(() => evaluate('Boolean(document.querySelector("[data-menu=nuova]:not([disabled])"))'));
      await click('[data-menu="nuova"]:not([disabled])');
      await waitFor(() => evaluate('Boolean(document.querySelector(".career-wizard"))'));
      // the first steps, as a player would fill them in: identity, Toscana · Siena, an independent
      await waitFor(() => evaluate(`Boolean(document.querySelector('.career-wizard [name="firstName"]'))`));
      await setValue('.career-wizard [name="firstName"]', 'Marta'); await setValue('.career-wizard [name="lastName"]', 'Sondaggi'); await setValue('.career-wizard [name="birthDate"]', '1985-02-11'); await setValue('.career-wizard [name="previousProfession"]', 'Insegnante');
      await click('.wizard-footer [data-wizard-action="next"]');
      await waitFor(() => evaluate(`Boolean(document.querySelector('[data-wizard-region]'))`), 10000);
      await evaluate(`(() => { const r = document.querySelector('[data-wizard-region]'); r.value = 'Toscana'; r.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
      await waitFor(() => evaluate(`Boolean(document.querySelector('[data-wizard-municipality-search]'))`), 20000);
      await setValue('[data-wizard-municipality-search]', 'Siena');
      await waitFor(() => evaluate(`Boolean(document.querySelector('[data-municipality-code="052032"]'))`), 10000);
      await click('[data-municipality-code="052032"]'); await pause(400);
      await click('.wizard-footer [data-wizard-action="next"]'); await pause(500);
      await click('.wizard-footer [data-wizard-action="next"]'); await pause(500);
      // step 3 (party): independent is the default; step 4
      await waitFor(() => evaluate(`Boolean(document.querySelector('.poll-scenario')) || document.querySelector('.career-wizard')?.textContent.includes('DIFFICOLTÀ')`), 15000);
      assert.ok(await evaluate(`Boolean(document.querySelector('.poll-scenario'))`), `${width}px: il passaggio 4 ha il blocco «Sondaggio iniziale».`);
      const modes = await evaluate(`[...document.querySelectorAll('input[name="pollMode"]')].map(item => item.value)`);
      assert.deepEqual(modes, ['realistico', 'casuale', 'personalizzato'], `${width}px: i tre modi.`);
      assert.equal(await evaluate(`document.querySelector('input[name="pollMode"]:checked')?.value`), 'realistico', 'Il modo di partenza è Realistico.');
      assert.ok(!/NaN|undefined|\[object/.test(await text('.poll-scenario')), 'Senza valori non validi.');

      // random: a seed appears, the table shows real and game figures, the total is 100,0
      await click('input[name="pollMode"][value="casuale"]'); await pause(500);
      const seed1 = await evaluate(`document.querySelector('[data-poll-seed]')?.value ?? ''`);
      assert.ok(seed1.length >= 3, `${width}px: «Casuale» propone un seme (${seed1}).`);
      const table1 = await evaluate(`[...document.querySelectorAll('.poll-scenario-row:not(.is-head)')].map(row => [...row.children].map(cell => cell.textContent.trim()))`);
      assert.ok(table1.length >= 8 && table1.at(-1)[0] === 'Altri', `${width}px: la tabella ha le forze e Altri (${table1.length} righe).`);
      assert.ok(table1.every(row => row.length === 3 && row.slice(1).every(cell => /^\d+,\d%$/.test(cell))), `${width}px: percentuali con una cifra decimale (${JSON.stringify(table1.slice(0, 2))}).`);
      assert.match(await text('.poll-scenario-total'), /Totale 100,0%/, `${width}px: il totale è 100,0%.`);
      await click('[data-poll-new-seed]'); await pause(400);
      const seed2 = await evaluate(`document.querySelector('[data-poll-seed]')?.value ?? ''`);
      assert.notEqual(seed2, seed1, `${width}px: «Nuovo seme» cambia il seme.`);
      const table2 = await evaluate(`[...document.querySelectorAll('.poll-scenario-row:not(.is-head)')].map(row => row.children[2].textContent.trim())`);
      assert.notDeepEqual(table2, table1.map(row => row[2]), `${width}px: e il quadro.`);
      await setValue('[data-poll-seed]', seed1); await pause(400);
      assert.deepEqual(await evaluate(`[...document.querySelectorAll('.poll-scenario-row:not(.is-head)')].map(row => row.children[2].textContent.trim())`), table1.map(row => row[2]), `${width}px: scrivere il vecchio seme riporta lo stesso quadro.`);
      assert.equal(await evaluate(`document.activeElement?.matches('[data-poll-seed]')`), true, `${width}px: scrivendo il seme il campo tiene il cursore.`);
      assert.ok((await overflow()) <= 1, `${width}px: nessuno scroll orizzontale (${await overflow()}).`);

      // custom: values are editable, a sum over 100 is refused with the reason, «Porta a 100» fixes it
      await click('input[name="pollMode"][value="personalizzato"]'); await pause(500);
      const inputs = await evaluate(`[...document.querySelectorAll('.poll-scenario input[name^="poll_"]')].length`);
      assert.ok(inputs >= 8, `${width}px: ogni forza ha il suo campo (${inputs}).`);
      const firstField = await evaluate(`document.querySelector('.poll-scenario input[name^="poll_"]').name`);
      await setValue(`[name="${firstField}"]`, '20'); await pause(300);
      assert.match(await text('.poll-scenario-total'), /Totale 100,0%/, `${width}px: con un valore scritto Altri si ricalcola e il totale resta 100,0%.`);
      assert.ok(!(await evaluate(`Boolean(document.querySelector('.poll-problems'))`)), `${width}px: e non c’è nessun rifiuto.`);
      for (let i = 1; i < 6; i++) { const name = await evaluate(`document.querySelectorAll('.poll-scenario input[name^="poll_"]')[${i}].name`); await setValue(`[name="${name}"]`, '25'); await pause(120); }
      assert.ok(await evaluate(`Boolean(document.querySelector('.poll-problems'))`), `${width}px: oltre 100 il blocco dice perché.`);
      assert.match(await text('.poll-problems'), /sommano|Altri/, `${width}px: con il motivo.`);
      await click('.wizard-footer [data-wizard-action="next"]'); await pause(500);
      assert.equal(await evaluate(`Number(document.querySelector('.career-wizard')?.dataset?.step ?? 0) || (document.querySelector('.poll-scenario') ? 4 : 5)`), 4, `${width}px: con una somma che non torna non si va avanti.`);
      assert.ok(await evaluate(`Boolean(document.querySelector('.wizard-errors'))`), `${width}px: e l’errore è in vista.`);
      await click('[data-poll-fit]'); await pause(500);
      assert.ok(!(await evaluate(`Boolean(document.querySelector('.poll-problems'))`)), `${width}px: «Porta a 100» fa tornare i conti.`);
      assert.match(await text('.poll-scenario-total'), /Totale 100,0%/);
      assert.ok((await overflow()) <= 1, `${width}px: nessuno scroll orizzontale (${await overflow()}).`);

      // back to random, on to the summary
      await click('input[name="pollMode"][value="casuale"]'); await pause(400);
      await setValue('[data-poll-seed]', 'e2e-seed'); await pause(300);
      await click('.wizard-footer [data-wizard-action="next"]'); await pause(600);
      assert.match(await text('.summary-sheet'), /SONDAGGIO INIZIALE[\s\S]*Casuale[\s\S]*e2e-seed/, `${width}px: il riepilogo dice il modo e il seme.`);
      assert.ok(!/NaN|undefined|\[object/.test(await text('.summary-sheet')), 'Riepilogo senza valori non validi.');
      assert.ok(await click('.wizard-footer [data-wizard-action="finish"]'), 'Inizia carriera.');
      await waitFor(() => evaluate(`Boolean(document.querySelector('.page-wrap')) && !document.querySelector('.career-wizard')`), 30000);

      // the page of the polls says «scenario», never «DATO REALE»
      await pause(500);
      await evaluate(`document.querySelector('[data-nav="sondaggi"]')?.click(), true`); await pause(1200);
      const page = await evaluate(`document.querySelector('.page-wrap').textContent.replace(/\\s+/g, ' ')`);
      assert.match(page, /SCENARIO CASUALE/, `${width}px: la pagina Sondaggi dice «scenario casuale».`);
      assert.match(page, /e2e-seed/, `${width}px: e il seme.`);
      assert.ok(!/DATO REALE/.test(page.split('Dalla prossima settimana')[0] ?? page) || !/DATO REALE\s+Supermedia/.test(page), `${width}px: il quadro non si spaccia per la Supermedia reale.`);
      assert.ok(!/NaN|undefined|\[object Object\]/.test(page), `${width}px: Sondaggi senza valori non validi.`);
      assert.ok((await overflow()) <= 1, `${width}px: Sondaggi senza scroll orizzontale (${await overflow()}).`);
    }
    assert.deepEqual(errors, [], `Errori in pagina: ${errors.slice(0, 2).join(' | ')}`);
    browserNote = 'in Chrome a 390 e 1280 px';
  }, {});
}
const after2 = Object.fromEntries(await Promise.all(REAL_FILES.map(async name => [name, await sha(name)])));
assert.deepEqual(after2, before, 'Alla fine i dati reali sono ancora quelli di prima.');
console.log(`Scenario del sondaggio iniziale verificato: 400 semi casuali (più i quadri scritti e «Porta a 100») danno sempre 100,0 esatti con Altri, nessun NaN o negativo, limiti rispettati, stesso seme = stesso quadro e semi diversi quadri diversi (${seen.size}/400); una carriera Realistica apre con il dato reale e la sua fonte, una Casuale/Personalizzata con un sondaggio marcato come simulazione che dice da quale sondaggio reale è partito (le forze del mondo partono da quelle percentuali, il riferimento reale resta quello della fonte), lo stesso seme dà la stessa partita, il quadro sopravvive a ricaricamento e a mondo ricostruito, una somma oltre 100 non fa partire la carriera, i file dei dati reali (${REAL_FILES.join(', ')}) sono identici byte per byte; ${browserNote}: passaggio 4 con i tre modi, tabella reale/partita, seme e «Nuovo seme», valori scritti con «Porta a 100», rifiuto con il motivo, riepilogo e pagina Sondaggi con «scenario» al posto di «dato reale».`);
