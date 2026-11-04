// La fondazione di un partito durante la carriera: stessa personalizzazione della creazione iniziale (nome, sigla, descrizione, orientamento, colore, logo da forme e simboli, programma fino a quattro priorità, posizioni),
// anche partendo da indipendente; il partito lasciato conserva la propria identità; tutto sopravvive al salvataggio e al ricaricamento; nessun Blob o URL temporaneo nel salvataggio.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderPartyLife } from '../src/ui/party-life-view.js';
import { makeDemoState } from '../src/data/simulation/demo.js';

const mem = new Map();
globalThis.localStorage = { getItem: key => mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
const read = async name => JSON.parse(await readFile(new URL('../src/data/real/' + name + '.json', import.meta.url), 'utf8'));
const groups = await read('parliamentary-groups');
const parties = await read('parties');
const party = parties.find(item => item.id === 'party-futuro-nazionale');
const demo = makeDemoState();
const draftFor = extra => ({ firstName: 'Alessia', lastName: 'Verdi', birthDate: '1988-04-20', gender: 'donna', region: 'Lombardia', municipality: 'Milano', previousProfession: 'Ricercatrice', initialLevel: 'deputato', partyMode: 'independent', partyId: '', currentDate: demo.clock.currentDate, parliamentaryGroupId: 'cam-xix-01', parliamentStartMode: 'real-context', policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 }, ...extra });
// the English of the new screens (independent career: foundation only) must have no unjustified Italian
globalThis.localStorage = { getItem: key => key === 'politicando.settings.v1' ? JSON.stringify({ language: 'en' }) : mem.get(key) ?? null, setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
const I18N = await import('../src/core/i18n.js?found-en=' + Date.now());
await I18N.loadBook();
const { createIndependentDetector } = await import('./lib/i18n-independent.mjs');
const detector = createIndependentDetector();
const englishTexts = html => [...html.matchAll(/>([^<>]{3,})</g)].map(match => match[1].replace(/&[a-z#0-9]+;/g, ' ').trim()).filter(Boolean).map(text => I18N.translateText(text));
const { store } = await import('../src/core/store.js?founding=' + Date.now());
const identity = { description: 'Un partito nuovo, con idee chiare.', orientation: 'Ecologista', position: 'centro-sinistra', color: '#1b8a5a', program: ['ambiente', 'scuola', 'lavoro', 'salute', 'cultura'], policyPositions: { economia: 2, welfare: 5, ambiente: 5, europa: 4 }, logo: { shape: 'scudo', symbol: 'ponte', secondary: '#e8c14b' } };
const fund = () => { const s = store.getState(); store.advance(7); void s; };
const rich = () => { const s = store.getState(); Object.assign(s.game.resources, { funds: 500000, politicalCapital: 99 }); };
const founded = (label, abbr) => {
  rich();
  for (let guard = 0; guard < 12; guard++) { try { store.foundParty({ label, abbreviation: abbr, followerIds: [], identity }); return store.getState(); } catch (error) { if (!/settimana|Di nuovo|capitale|fondi|giorni/i.test(error.message) || guard > 10) throw error; store.advance(7); rich(); } }
  return store.getState();
};

// ---- from an independent career ----
store.reset();
store.createCareer(draftFor({}), [party], groups);
let state = store.getState();
assert.ok(!state.game.party, 'La carriera parte indipendente: nessun partito.');
const page = renderPartyLife(state);
assert.ok(page.includes('data-life-found-form') && page.includes('data-life-found') && page.includes('name="partyName"') && page.includes('name="partyProgram"') && page.includes('name="partyLogoShape"') && page.includes('name="policy_economia"'), 'L’indipendente vede la fondazione con tutti i campi dell’identità.');
const leftovers = englishTexts(page).map(text => [text, detector.reasonOf(text)]).filter(([, reason]) => reason);
assert.deepEqual(leftovers, [], 'Fondazione per l’indipendente: nessun testo italiano non giustificato nell’inglese.');
assert.ok(!page.includes('data-life-rename') && !page.includes('data-life-merge'), 'Per l’indipendente solo la fondazione, non fusione né cambio nome.');
assert.ok(!/ruolo iniziale|startingRole|Scegli il ruolo/i.test(page), 'Non si riconsidera la scelta del ruolo iniziale.');
state = founded('Nuova Rotta', 'NRT');
const record = state.dataset.parties.find(item => item.id === state.career.partyId);
assert.ok(record && record.source === 'user' && record.name === 'Nuova Rotta' && record.abbreviation === 'NRT', 'Il partito nuovo ha nome e sigla scelti.');
assert.equal(record.description, identity.description); assert.equal(record.orientation, 'Ecologista'); assert.equal(record.politicalPosition, 'centro-sinistra'); assert.equal(record.color, '#1b8a5a');
assert.deepEqual(record.program, ['ambiente', 'scuola', 'lavoro', 'salute'], 'Programma: al più quattro priorità.');
assert.deepEqual([record.policyPositions.economia, record.policyPositions.welfare, record.policyPositions.ambiente, record.policyPositions.europa], [2, 5, 5, 4]);
assert.deepEqual([record.logo.kind, record.logo.shape, record.logo.symbol, record.logo.secondary], ['builder', 'scudo', 'ponte', '#e8c14b'], 'Logo da forme e simboli.');
assert.equal(state.game.party.affiliation, 'founder', 'Chi fonda è già fondatore e segretario.');
assert.deepEqual(state.game.party.program.areas, ['ambiente', 'scuola', 'lavoro', 'salute'], 'Il programma di gioco segue la scelta.');
const worldParty = state.world.parties.find(item => item.id === record.id);
assert.ok(worldParty && worldParty.isPlayer, 'Il partito è nel mondo politico, del giocatore.');
// persistence: the save carries the logo as data (shape, symbol, colour), never a Blob or a temporary address
const saved = store.exportSave();
assert.ok(!/blob:/.test(saved), 'Nessun Blob o URL temporaneo nel salvataggio.');
store.reset(); store.loadGame(saved);
const reloaded = store.getState().dataset.parties.find(item => item.id === record.id);
assert.deepEqual(reloaded.logo, record.logo, 'Il logo resta dopo il ricaricamento.');
assert.deepEqual(reloaded.program, record.program); assert.equal(reloaded.color, record.color);

// ---- from a member of a real party: the party left keeps its own identity ----
store.reset();
store.createCareer(draftFor({ partyMode: 'existing', partyId: party.id, startingRole: 'militante' }), [party], groups);
const before = JSON.stringify(store.getState().dataset.parties.find(item => item.id === party.id) ?? parties.find(item => item.id === party.id));
void fund;
const stateMember = store.getState();
assert.ok(stateMember.game.party, 'Da iscritto il partito c’è.');
const pageMember = renderPartyLife(stateMember);
assert.ok(pageMember.includes('data-life-found-form'), 'Anche da iscritto la fondazione offre i campi dell’identità.');
const memberFounded = founded('Altra Rotta', 'ALR');
assert.notEqual(memberFounded.career.partyId, party.id, 'Chi fonda lascia il partito di prima.');
assert.equal(JSON.stringify(memberFounded.dataset.parties.find(item => item.id === party.id) ?? parties.find(item => item.id === party.id)), before, 'Il partito lasciato conserva la propria identità.');
assert.equal(memberFounded.game.party.affiliation, 'founder');
const pageFounder = renderPartyLife(memberFounded);
assert.ok(!/<option[^>]*>[^<]{40,}<\/option>/.test(pageFounder.match(/<select[^>]*data-rename-style[\s\S]*?<\/select>/)?.[0] ?? ''), 'Il menu di Restyling, Rilancio e Rifondazione mostra solo nomi brevi.');
assert.ok((pageFounder.match(/data-rename-detail="/g) ?? []).length === 3 && pageFounder.includes('data-rename-detail="rilancio" >') , 'La descrizione dell’opzione scelta è separata dal menu.');
console.log('Fondazione di un partito: identità, programma, posizioni e logo personalizzati (da indipendente), ruolo di fondatore, persistenza nel salvataggio e pagina Vita interna verificati.');
