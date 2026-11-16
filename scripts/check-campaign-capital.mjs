// Political capital of the campaign: when the campaign starts, 60% of the career's capital goes to it and the rest stays (never copied), the split is told before and written in the diary,
// and the funds (another resource, also 60% as before) are kept apart. Example from the brief: 60 points → 36 to the campaign, 24 left.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderCampaignPage } from '../src/ui/campaign-mode.js';

const localStore = new Map();
globalThis.localStorage = { getItem: key => localStore.get(key) ?? null, setItem: (key, value) => localStore.set(key, String(value)), removeItem: key => localStore.delete(key) };
const realParties = JSON.parse(await readFile(new URL('../src/data/real/parties.json', import.meta.url), 'utf8'));
const party = realParties.find(item => item.id === 'party-futuro-nazionale') ?? realParties.find(item => item.verified === true);
const { store } = await import(`../src/core/store.js?capital=${Date.now()}`);
store.createCareer({ firstName: 'Alessia', lastName: 'Capitale', birthDate: '1988-04-20', gender: 'donna', region: 'Lombardia', municipality: 'Milano', previousProfession: 'Ricercatrice', initialLevel: 'regionale', partyMode: 'existing', partyId: party.id, currentDate: store.getState().clock.currentDate }, [party]);
store.fastForwardToElection('politiche');
{ const s = store.getState(); s.game.resources.politicalCapital = 60; s.game.resources.funds = 10000; }
const html = renderCampaignPage(store.getState(), realParties, () => null);
assert.match(html, /Capitale politico: 36 su 60 \(il 60%\) passano alla campagna, 24 restano a te/, 'Il calcolo è mostrato prima dell’avvio.');
const before = store.getState();
const capitalBefore = before.game.resources.politicalCapital, fundsBefore = before.game.resources.funds;
store.startCampaign({ electionType: 'politiche', role: 'deputato', objective: 'build' }, realParties);
const after = store.getState();
const player = after.campaign.candidates.find(item => item.isPlayer);
const prep = after.campaign.preparation;
assert.deepEqual(prep.capital, { before: 60, moved: 36, left: 24 }, '60 punti: 36 alla campagna, 24 residui.');
assert.equal(after.game.resources.politicalCapital, 24, 'Il capitale della carriera scende a 24.');
assert.ok(player.resources.politicalCapital >= 36, 'La campagna riceve 36 punti (più quelli propri di partenza).');
assert.ok(after.game.resources.funds < fundsBefore, 'I fondi sono trasferiti a parte (60%).');
assert.equal(prep.transfer, Math.round(fundsBefore * 0.6), 'I fondi restano il 60% dei fondi: nessuna confusione col capitale.');
assert.match(after.campaign.history.find(item => item.id.startsWith('preparazione-')).text, /capitale politico 36 su 60 \(60%\) alla campagna, 24 restano/, 'Il calcolo è scritto nel diario della campagna.');
assert.equal(capitalBefore, 60);
console.log('Capitale politico della campagna verificato: 60 punti → 36 alla campagna e 24 residui, calcolo mostrato prima e scritto nel diario, nessuna duplicazione, fondi a parte.');
