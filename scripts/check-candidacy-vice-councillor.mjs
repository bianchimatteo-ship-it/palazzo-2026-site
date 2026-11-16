// The scenario reported by a player: deputy secretary of the party AND municipal councillor, candidacy for the general election, «Candidati ora». The candidacy must either start
// (the councillor seat is kept until the vote is won: it lapses only then, and is told) or be refused with a reason a player can read: never a button that does nothing, never a half state.
// The diagnostics log of the game (core/diagnostics.js) must stay empty on the happy path.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const localStore = new Map();
globalThis.localStorage = { getItem: key => localStore.get(key) ?? null, setItem: (key, value) => localStore.set(key, String(value)), removeItem: key => localStore.delete(key) };
const realParties = JSON.parse(await readFile(new URL('../src/data/real/parties.json', import.meta.url), 'utf8'));
const party = realParties.find(item => item.id === 'party-futuro-nazionale') ?? realParties.find(item => item.verified === true);
const { store } = await import(`../src/core/store.js?cand=${Date.now()}`);
const results = [];
for (const rank of [3, 4, 5]) {
  store.createCareer({ firstName: 'Vera', lastName: 'Vice', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', previousProfession: 'Avvocata', initialLevel: 'comunale', partyMode: 'existing', partyId: party.id, currentDate: store.getState().clock.currentDate }, [party]);
  store.fastForwardToElection('politiche');
  { const s = store.getState(); s.game.party.affiliation = 'member'; s.game.party.rank = rank; s.game.resources.politicalCapital = 40; s.game.resources.funds = 8000; }
  const held = store.getState().career.currentOffice?.label ?? store.getState().career.currentOffice?.id ?? null;
  let outcome;
  try { store.startCampaign({ electionType: 'politiche', role: 'deputato', objective: 'build' }, realParties); outcome = { ok: true }; }
  catch (error) { outcome = { ok: false, message: String(error.message) }; }
  const campaign = store.getState().campaign;
  if (outcome.ok) {
    assert.equal(campaign?.status, 'active', `rango ${rank}: la campagna è attiva dopo «Candidati ora».`);
    assert.ok(campaign.candidates.some(item => item.isPlayer), `rango ${rank}: il giocatore è tra i candidati.`);
  } else {
    assert.ok(outcome.message.length > 25 && /[a-zà-ù]/i.test(outcome.message), `rango ${rank}: il rifiuto è spiegato (${outcome.message}).`);
    assert.ok(!campaign || campaign.status !== 'active', `rango ${rank}: nessuna campagna a metà.`);
  }
  results.push(`rango ${rank}: ${outcome.ok ? 'candidatura avviata' : `rifiutata («${outcome.message.slice(0, 70)}…»)`}`);
}
const { diagnosticLog } = await import('../src/core/diagnostics.js');
const log = diagnosticLog();
assert.equal(log.filter(item => item.kind === 'error').length, 0, 'Nessun errore registrato dal registro diagnostico.');
console.log(`Vicesegretario e consigliere comunale che si candida alle politiche verificato: ${results.join('; ')}.`);
