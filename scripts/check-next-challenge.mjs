// La scheda «La tua prossima sfida» della Campagna: individua la prossima elezione cronologicamente affrontabile (candidature, requisiti, finestre), senza ripiegare sulle Comunali quando c'è un'occasione
// precedente, e se un voto non è affrontabile lo dice con il motivo e indica il successivo valido. Titolo, voto, finestra, conto alla rovescia e azione vengono dalla stessa elezione.
// Parte pura (nextChallenge) su calendari costruiti a mano e sul calendario vero di una carriera; la pagina in Chrome è nel test check-election-ui.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.fetch = async url => { const body = await readFile(fileURLToPath(new URL(String(url).split('?')[0])), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(body) }; };
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const v = build ? `?v=${build}` : '?';
const { nextChallenge, candidacyAccess } = await import(`../src/ui/campaign-mode.js${v}`);
const T = await import(`../src/core/time.js${v}`);
const C = await import(`../src/core/career-engine.js${v}`);
const { ELECTION_MODELS } = await import(`../src/data/simulation/campaign-rules.js${v}`);
const { ELECTION_SCHEDULE } = await import(`../src/data/simulation/career-rules.js${v}`);

const entry = (type, vote, extra = {}) => {
  const opens = T.advanceDays(vote, -ELECTION_MODELS[type].campaignDays);
  return { id: `elezione-${type}-${opens}`, type, label: `${type} ${vote}`, windowOpensAt: opens, windowClosesAt: T.advanceDays(opens, ELECTION_SCHEDULE[type].windowDays), electionDate: vote, status: 'upcoming', early: false, ...extra };
};
const stateOf = (today, elections, extra = {}) => ({ clock: { currentDate: today }, game: { elections, rounds: [], candidacies: [], ...extra }, races: { items: [] }, career: {}, parliament: null, dataset: { politicians: [] } });

// 1. the earliest vote wins: Politiche (or Europee) first, Comunali later: the card is about the earlier one, never the Comunali
{
  const state = stateOf('2027-01-10', [entry('comunale', '2027-11-28'), entry('europee', '2027-06-06'), entry('politiche', '2027-09-26')]);
  const { next, skipped, chain } = nextChallenge(state);
  assert.deepEqual(chain.map(item => item.type), ['europee', 'politiche', 'comunale'], 'Le elezioni sono in ordine cronologico.');
  assert.ok(next, 'C’è una sfida.');
  assert.ok(next.electionDate <= chain.at(-1).electionDate && next.type !== 'comunale', 'Non si ripiega sulle Comunali quando esiste un’occasione precedente.');
  assert.equal(next.id, chain.find(item => !skipped.some(row => row.entry.id === item.id)).id, 'La prossima sfida è la prima elezione non bloccata.');
}
// 2. a vote the player cannot stand in is listed with the reason and the next valid one is shown
{
  const state = stateOf('2027-01-10', [entry('provinciale', '2027-04-18'), entry('comunale', '2027-11-28')]);
  const access = candidacyAccess(state, state.game.elections[0]);
  assert.equal(access.ok, false, 'Senza un seggio in un comune la provinciale non è affrontabile.');
  const { next, skipped } = nextChallenge(state);
  assert.equal(skipped.length, 1, 'La provinciale è elencata come non affrontabile.');
  assert.ok(skipped[0].entry.type === 'provinciale' && skipped[0].reason.length > 10, 'Con il motivo.');
  assert.equal(next.type, 'comunale', 'La successiva opportunità valida è la comunale.');
}
// 3. past votes and votes already held are not a challenge; with nothing left the card says so
{
  const state = stateOf('2027-12-10', [entry('comunale', '2027-11-28', { status: 'held' }), entry('regionale', '2027-03-07')]);
  const { next, chain } = nextChallenge(state);
  assert.equal(next, null, 'Nessun voto futuro: nessuna sfida.');
  assert.equal(chain.length, 0);
}
// 4. an open window counts as a vote to face (status open), in date order with the others
{
  const open = entry('politiche', '2027-09-26', { status: 'open' });
  const state = stateOf('2027-08-20', [entry('comunale', '2027-10-10'), open]);
  assert.equal(nextChallenge(state).next.id, open.id, 'La finestra aperta e più vicina è la sfida.');
}
// 5. a real career: the card follows the calendar of the game from several starts
{
  const realData = await import(`../src/data/repositories/real-data.js${v}`);
  await realData.loadRealDatabase();
  const calendar = await realData.loadRealDocument('localElections');
  const place = { region: 'Piemonte', municipality: 'Tassarolo', municipalityCode: '006170', province: 'Alessandria', provinceCode: '006', provinceType: 'Provincia' };
  const localCalendar = C.localCalendarOf(calendar, { municipalityCode: '006170', region: 'Piemonte', seed: 'Tassarolo', provinceCode: '006' });
  for (const level of ['comunale', 'regionale', 'deputato', 'europeo']) for (const start of ['2026-10-12', '2027-03-08', '2028-09-11']) {
    const game = C.createGameState({ seedText: `sfida|${level}|${start}`, currentDate: start, level, place, localCalendar });
    const state = stateOf(start, game.elections);
    const { next, chain, skipped } = nextChallenge(state);
    assert.ok(chain.length > 0, `${level}/${start}: ci sono elezioni in calendario.`);
    const first = chain[0];
    if (next) assert.ok(next.id === first.id || skipped.some(row => row.entry.id === first.id), `${level}/${start}: o è la prima elezione, o la prima è elencata come non affrontabile.`);
    assert.ok(skipped.every(row => row.entry.electionDate <= (next?.electionDate ?? '9999')), `${level}/${start}: gli esclusi sono tutti prima della sfida mostrata.`);
    assert.ok(next === null || (next.windowOpensAt < next.windowClosesAt && next.windowClosesAt <= next.electionDate), `${level}/${start}: finestra e voto della stessa elezione sono coerenti.`);
  }
}
console.log('Prossima sfida verificata: la prima elezione affrontabile in ordine di data, senza ripiego sulle Comunali, con i voti non affrontabili spiegati e il successivo valido indicato.');
