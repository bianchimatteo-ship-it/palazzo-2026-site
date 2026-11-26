// Candidature senza la lista del partito: indipendente, lista civica, movimento, alleanza. Ogni modalità ha regole diverse per tipo di voto, requisiti (comitato, volontari, firme, fondi, accordo),
// effetti diversi sul sostegno di partenza e passa dal salvataggio. Senza partito non si apre una campagna senza aver preparato la candidatura.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startCareer } from './lib/long-run.mjs';
const build = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).match(/main\.js\?v=([^"']+)/)?.[1];
const R = await import(new URL(`../src/core/candidacy-routes.js?v=${build}`, import.meta.url).href);
// ---- the rules ----
const ids = list => list.filter(item => item.available).map(item => item.id).sort();
assert.deepEqual(ids(R.routesFor({ electionType: 'comunale' })), ['alleanza', 'indipendente', 'lista-civica', 'movimento']);
assert.deepEqual(ids(R.routesFor({ electionType: 'provinciale' })), ['alleanza', 'lista-civica']);
assert.deepEqual(ids(R.routesFor({ electionType: 'regionale' })), ['alleanza', 'lista-civica', 'movimento']);
assert.deepEqual(ids(R.routesFor({ electionType: 'politiche' })), ['alleanza', 'indipendente', 'movimento']);
assert.deepEqual(ids(R.routesFor({ electionType: 'europee' })), ['alleanza', 'movimento']);
for (const type of ['provinciale', 'regionale', 'politiche', 'europee']) for (const route of R.routesFor({ electionType: type }).filter(item => !item.available)) assert.ok(route.reason.length > 20, `${type}/${route.id}: la ragione è scritta.`);
assert.deepEqual(R.routesFor({ electionType: 'comunale', member: true }).map(item => item.id), ['partito'], 'Un iscritto si candida con la lista del partito.');
assert.ok(R.requirementsOf('movimento', 'regionale').volunteers > R.requirementsOf('lista-civica', 'regionale').volunteers && R.requirementsOf('lista-civica', 'regionale').volunteers > R.requirementsOf('indipendente', 'comunale', 'oltre-15000').volunteers, 'Il movimento chiede più volontari della lista civica.');
assert.equal(R.requirementsOf('alleanza', 'politiche').signatures, 0, 'Con un’alleanza non servono firme.');
assert.ok(R.requirementsOf('lista-civica', 'comunale', 'oltre-15000').signatures > R.requirementsOf('lista-civica', 'comunale', 'fino-15000').signatures, 'Un comune grande chiede più firme.');
const prep = (route, type, extra = {}) => ({ ...R.newPrep({ route, electionType: type }), ...extra });
assert.ok(R.routeFactor(prep('indipendente', 'politiche')) < R.routeFactor(prep('indipendente', 'comunale')), 'Da indipendente il Parlamento è più difficile di un comune.');
assert.ok(R.routeFactor(prep('movimento', 'regionale', { volunteers: 10 }), { home: false }) < 1, 'Un movimento nuovo parte sotto il baseline fuori dal suo territorio.');
assert.ok(R.routeFactor(prep('lista-civica', 'comunale', { volunteers: 40 }), { home: true }) > R.routeFactor(prep('lista-civica', 'comunale', { volunteers: 2 }), { home: true }), 'Più volontari, più sostegno.');
assert.ok(R.routeFactor(prep('alleanza', 'politiche', { deal: { share: 20 } })) > 1, 'Un’alleanza presta il suo consenso.');
assert.equal(R.routeFactor(prep('partito', 'comunale')), 1);
console.log('Modalità di candidatura (regole): matrice per tipo di voto, requisiti, effetti diversi.');
// ---- the flow on the real store ----
const { store, db } = await startCareer({ seed: 'candidature', level: 'comunale', fast: true, territorial: true });
const state = () => store.getState();
store.leaveParty();
assert.equal(state().game.party, null, 'Il giocatore è indipendente.');
store.fastForwardToElection('comunale');
state().game.resources = { ...state().game.resources, funds: 50000, politicalCapital: 40 };
assert.throws(() => store.startCampaign({ strictRoute: true, electionType: 'comunale', role: 'sindaco', objective: 'win' }, db.parties), /Senza un partito scegli prima come ti candidi/, 'Senza preparazione non si apre la campagna.');
assert.throws(() => store.openCandidacyRoute('indipendente', 'regionale'), /una lista/, 'Alle Regionali una persona sola non può presentarsi.');
const info = store.candidacyRoutes('comunale');
assert.equal(info.member, false); assert.ok(info.routes.length === 4 && info.partners.length > 3);
store.openCandidacyRoute('lista-civica', 'comunale');
assert.ok(store.candidacyRoutes('comunale').missing.length >= 3, 'Mancano comitato, volontari, firme, fondi.');
assert.throws(() => store.candidacyPrepAction('firme'), /comitato/, 'Le firme chiedono il comitato.');
assert.throws(() => store.candidacyPrepAction('liste'), /non si possono presentare/, 'Le liste non si presentano a requisiti incompleti.');
const refill = () => { state().game.week.ap = 7; state().game.resources.funds = Math.max(state().game.resources.funds, 20000); };
const loop = (action, until, max = 60) => { for (let i = 0; i < max && !until(); i++) { refill(); store.candidacyPrepAction(action); } };
refill(); store.candidacyPrepAction('comitato');
assert.throws(() => store.candidacyPrepAction('comitato'), /già/, 'Un solo comitato.');
const need = R.requirementsOf('lista-civica', 'comunale', state().game.candidacyPrep.band);
loop('volontari', () => state().game.candidacyPrep.volunteers >= need.volunteers);
loop('firme', () => state().game.candidacyPrep.signatures >= need.signatures);
loop('sostenitori', () => state().game.candidacyPrep.supporters >= 10, 4);
loop('fondi', () => state().game.candidacyPrep.raised >= need.funds);
assert.deepEqual(store.candidacyRoutes('comunale').missing, [], 'Tutti i requisiti sono soddisfatti.');
// a save in the middle of the preparation keeps it
const saved = JSON.parse(store.exportSave()); store.loadGame(saved);
assert.equal(state().game.candidacyPrep.route, 'lista-civica'); assert.ok(state().game.candidacyPrep.signatures >= need.signatures, 'La preparazione sopravvive al salvataggio.');
assert.throws(() => store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win' }, db.parties), /Presenta le liste/, 'Prima si presentano le liste.');
refill(); store.candidacyPrepAction('liste');
const lista = store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win' }, db.parties);
assert.equal(lista.candidacyRoute.route, 'lista-civica'); assert.ok(lista.candidacyRoute.volunteers >= need.volunteers);
const myShare = c => { const me = c.candidates.find(item => item.isPlayer); return c.territories.reduce((sum, area) => sum + Number(area.supportByCandidate[me.id] ?? 0), 0) / c.territories.length; };
const civic = myShare(state().campaign);
// the same race by another road: an independent with minimum preparation starts differently
const rawSave = JSON.parse(store.exportSave());
// the campaign closes with a result, saved and loaded with its route
for (let i = 0; i < 80 && state().campaign?.status === 'active'; i++) { for (const event of [...(state().campaign.pendingEvents ?? [])]) store.decideCampaignEvent(event.id, event.choices[0].id); store.advance(7); }
assert.ok(['finished', 'closed', undefined].includes(state().campaign?.status) || state().campaign?.result, 'La campagna arriva al risultato.');
const reloaded = JSON.parse(store.exportSave()); store.loadGame(reloaded);
assert.equal(state().campaign?.candidacyRoute?.route ?? 'lista-civica', 'lista-civica', 'La modalità resta nel salvataggio.');
console.log(`Modalità di candidatura (store): scelta, requisiti, preparazione, salvataggio, liste, campagna con effetto proprio (sostegno medio ${civic.toFixed(1)}%), risultato.`);
// the alliance road: an agreement with a party (it can be refused, and then another is tried), no signatures, fewer volunteers; and the independent one in a comune
{
  const second = await startCareer({ seed: 'candidature-alleanza', level: 'comunale', fast: true, territorial: true });
  const s2 = second.store; const st = () => s2.getState();
  s2.leaveParty(); s2.fastForwardToElection('comunale');
  st().game.resources = { ...st().game.resources, funds: 50000, politicalCapital: 200 };
  s2.openCandidacyRoute('alleanza', 'comunale');
  assert.throws(() => s2.candidacyPrepAction('firme'), /non richiede firme|comitato/, 'Con un’alleanza non si raccolgono firme.');
  const partners = s2.candidacyRoutes('comunale').partners;
  let accepted = false, refused = 0;
  for (let i = 0; i < 40 && !accepted; i++) { st().game.week.ap = 7; st().game.resources.politicalCapital = 200; s2.candidacyPrepAction('accordo', { partnerId: partners[i % partners.length].id }); const deal = st().game.candidacyPrep.deal; if (deal.status === 'accettato') accepted = true; else refused++; }
  assert.ok(accepted, `Prima o poi un partito accetta (rifiuti: ${refused}).`);
  const need = R.requirementsOf('alleanza', 'comunale', st().game.candidacyPrep.band);
  for (let i = 0; i < 40 && st().game.candidacyPrep.volunteers < need.volunteers; i++) { st().game.week.ap = 7; s2.candidacyPrepAction('volontari'); }
  for (let i = 0; i < 40 && st().game.candidacyPrep.raised < need.funds; i++) { st().game.week.ap = 7; s2.candidacyPrepAction('fondi'); }
  st().game.week.ap = 7; s2.candidacyPrepAction('liste');
  const c = s2.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'win' }, second.db.parties);
  assert.equal(c.candidacyRoute.route, 'alleanza'); assert.equal(c.candidacyRoute.deal.status, 'accettato');
  console.log(`Modalità di candidatura (alleanza): accordo dopo ${refused} rifiuti, nessuna firma, campagna aperta con l’accordo registrato.`);
}
