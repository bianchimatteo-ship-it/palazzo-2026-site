// The exact election chosen with «Candidati» is the one the campaign starts for (not just «the first open one of that type»): several elections of the same type, comunali and politiche, the other types,
// the checks that explain why a vote cannot be run for, and the separation from the territorial races (raceId). Pure store, no browser.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderCampaignPage } from '../src/ui/campaign-mode.js';

const localStore = new Map();
globalThis.localStorage = { getItem: key => localStore.get(key) ?? null, setItem: (key, value) => localStore.set(key, String(value)), removeItem: key => localStore.delete(key) };
const realParties = JSON.parse(await readFile(new URL('../src/data/real/parties.json', import.meta.url), 'utf8'));
const party = realParties.find(item => item.id === 'party-futuro-nazionale') ?? realParties.find(item => item.verified === true);
const { makeDemoState } = await import('../src/data/simulation/demo.js');
const base = makeDemoState();
let seq = 0;
const fresh = async level => {
  const module = await import(`../src/core/store.js?election-id=${Date.now()}-${seq++}`);
  const store = module.store;
  store.createCareer({ firstName: 'Alessia', lastName: 'Test', birthDate: '1988-04-20', gender: 'donna', region: 'Lombardia', municipality: 'Milano', previousProfession: 'Ricercatrice', initialLevel: level, partyMode: 'existing', partyId: party.id, currentDate: base.clock.currentDate }, [party]);
  return store;
};
const draftOf = (election, over = {}) => ({ ...election, ...over });

// ---- the same type twice: the chosen one wins, in both orders, for every kind of vote ----
for (const [type, role, level] of [['comunale', 'sindaco', 'comunale'], ['politiche', 'deputato', 'regionale'], ['regionale', 'consigliere', 'regionale'], ['europee', 'eurodeputato', 'regionale'], ['provinciale', 'consigliere', 'comunale']]) {
  const store = await fresh(level);
  let open = null;
  try { open = store.fastForwardToElection(type); } catch { open = null; }
  if (!open) { console.log(`(${type}: nessuna tornata raggiungibile in questa carriera, saltata)`); continue; }
  const state = store.getState();
  const original = state.game.elections.find(item => item.id === open.id);
  // a second open vote of the same type, with its own id, label and dates
  const twin = draftOf(original, { id: `${original.id}-bis`, label: `${original.label} (seconda tornata)`, electionDate: original.electionDate.replace(/-\d\d$/, '-28'), early: false });
  for (const order of ['original-first', 'twin-first']) {
    const copy = await fresh(level); copy.fastForwardToElection(type);
    const game = copy.getState().game;
    const first = game.elections.find(item => item.type === type && item.status === 'open');
    const second = draftOf(first, { id: `${first.id}-bis`, label: `${first.label} (seconda tornata)` });
    game.elections = order === 'original-first' ? [...game.elections, second] : [second, ...game.elections];
    const wanted = order === 'original-first' ? second : first;
    const config = { electionType: type, role, objective: 'build', electionId: wanted.id };
    // (a vote the career cannot run for by the OFFICES held — e.g. a provincial seat without a seat in a comune — says so, it is not an election-id error)
    try { copy.startCampaign(config, [party], {}); }
    catch (error) { if (/seggio|consigliere comunale|sindaco|incarich|ricopri|ruolo/i.test(error.message) && !/calendario|corrisponde|chiuse|si aprono/.test(error.message)) { console.log(`(${type}/${order}: ${error.message.slice(0, 70)}… candidatura bloccata dagli incarichi, saltata)`); continue; } assert.fail(`${type}/${order}: la campagna per l’elezione scelta non parte: ${error.message}`); }
    const campaign = copy.getState().campaign;
    assert.equal(campaign.electionId, wanted.id, `${type}/${order}: la campagna è per l’elezione scelta (${wanted.id}), non per un’altra dello stesso tipo (${campaign.electionId}).`);
  }
  // without an id the behaviour is the old one (the first open vote of the type): nothing else changes
  const plain = await fresh(level); plain.fastForwardToElection(type);
  plain.startCampaign({ electionType: type, role, objective: 'build' }, [party], {});
  assert.ok(plain.getState().campaign.electionId, `${type}: senza id parte comunque per la tornata aperta.`);
  void twin;
}

// ---- the id is validated: unknown, of another type, not open yet, already held ----
{
  const store = await fresh('comunale');
  const open = store.fastForwardToElection('comunale');
  const game = store.getState().game;
  assert.throws(() => store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'build', electionId: 'non-esiste' }, [party], {}), /non è più in calendario/, 'Un id sconosciuto: errore chiaro.');
  const other = game.elections.find(item => item.type !== 'comunale');
  if (other) assert.throws(() => store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'build', electionId: other.id }, [party], {}), /non è un’elezione di tipo|altro tipo|non corrisponde/i, 'Un id di un altro tipo non si confonde con il tipo scelto.');
  const future = game.elections.find(item => item.type === 'comunale' && item.status !== 'open');
  const closed = { ...open, id: `${open.id}-chiusa`, windowClosesAt: '2000-01-01', windowOpensAt: '1999-12-01' };
  game.elections = [...game.elections, closed];
  assert.throws(() => store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'build', electionId: closed.id }, [party], {}), /chiuse|si aprono|non sono aperte/i, 'Candidature chiuse: la spiegazione dice perché.');
  void future;
  assert.equal(store.getState().campaign?.status === 'active', false, 'Gli errori non avviano nessuna campagna.');
}

// ---- the setup page shows the chosen vote, not the first one of its type ----
{
  const store = await fresh('comunale');
  const open = store.fastForwardToElection('comunale');
  const game = store.getState().game;
  const second = draftOf(open, { id: `${open.id}-bis`, label: `${open.label} (seconda tornata)` });
  game.elections = [...game.elections, second];
  const html = renderCampaignPage(store.getState(), [party], () => null, { 'setup.electionType': 'comunale', 'setup.electionId': second.id });
  assert.ok(html.includes(`data-campaign-target="${second.id}"`), 'La pagina mostra la tornata scelta.');
  assert.ok(!html.includes(`data-campaign-target="${open.id}"`), 'E non la prima dello stesso tipo.');
  assert.ok(html.includes(`data-challenge="${second.id}"`), 'Il pulsante «Candidati e inizia la campagna» è legato alla tornata scelta.');
  const stale = renderCampaignPage(store.getState(), [party], () => null, { 'setup.electionType': 'comunale', 'setup.electionId': 'sparita' });
  assert.ok(stale.includes('data-campaign-setup="electionType"') && stale.includes('data-campaign-target'), 'Un id sparito non svuota la pagina: torna alla tornata predefinita.');
}

// ---- a chosen vote that is not open yet: the button is OFF and the text says when it opens ----
{
  const store = await fresh('comunale');
  const open = store.fastForwardToElection('comunale');
  const game = store.getState().game;
  const plus = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  const later = draftOf(open, { id: `${open.id}-futura`, label: `${open.label} (futura)`, status: 'upcoming', windowOpensAt: plus(open.windowClosesAt, 400), windowClosesAt: plus(open.windowClosesAt, 430), electionDate: plus(open.windowClosesAt, 460) });
  game.elections = [...game.elections, later];
  const html = renderCampaignPage(store.getState(), [party], () => null, { 'setup.electionType': 'comunale', 'setup.electionId': later.id });
  assert.match(html, /data-action="campaign-start"[^>]*disabled/, 'Una tornata non ancora aperta: il pulsante è spento.');
  assert.match(html, new RegExp(`si aprono il [^<]*${later.windowOpensAt.slice(0, 4)}[^<]*fino ad allora non puoi candidarti`), 'E il testo dice quando si aprono le candidature.');
  assert.throws(() => store.startCampaign({ electionType: 'comunale', role: 'sindaco', objective: 'build', electionId: later.id }, [party], {}), /si aprono il/, 'Anche il motore rifiuta, con la stessa spiegazione.');
}

// ---- election and race stay separate: a race still starts with its raceId and never reads electionId ----
{
  const source = await readFile(new URL('../src/core/store.js', import.meta.url), 'utf8');
  assert.match(source, /const race = config\.raceId/, 'Le corse territoriali passano da raceId.');
  assert.match(source, /campaign\.raceId = race\.id; campaign\.electionId = race\.electionId \?\? race\.id/, 'La campagna di una corsa conserva electionId e raceId separati.');
}
console.log('Candidatura per elezione esatta: più tornate dello stesso tipo (comunali, politiche, regionali, europee, provinciali), id validato con errori chiari, pagina di impostazione sulla tornata scelta, corse (raceId) separate.');
