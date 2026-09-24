import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const KEY = 'palazzo-2026.career.v1';
const localStore = new Map();
const sessionStore = new Map();
const storageOf = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) });
globalThis.localStorage = storageOf(localStore);
globalThis.sessionStorage = storageOf(sessionStore);
const raw = async name => readFile(new URL('../src/data/real/' + name + '.json', import.meta.url), 'utf8');
const read = async name => JSON.parse(await raw(name));
// The browser loader fetches the real snapshot; here the same files are served from disk.
globalThis.fetch = async url => { const text = await readFile(decodeURIComponent(new URL(url).pathname), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(text) }; };
const snapshots = { parties: await raw('parties'), politicians: await raw('politicians') };
const groups = await read('parliamentary-groups');
const politicians = await read('politicians');
const parties = await read('parties');
const realParty = parties.find(item => item.id === 'party-futuro-nazionale');
const twoPerThousand = await read('two-per-thousand');
const movements = await read('political-movements');
const realIds = new Set([...parties, ...movements].map(item => item.id));
let imports = 0;
const load = async () => (await import('../src/core/store.js?polls=' + (++imports))).store;
const reload = async mutate => { const saved = JSON.parse(localStore.get(KEY)); mutate(saved); localStore.set(KEY, JSON.stringify(saved)); return load(); };
const draft = (level, extra = {}) => ({
  firstName: 'Marta', lastName: 'Neri', birthDate: '1985-02-11', gender: 'donna', region: 'Toscana', municipality: 'Siena', previousProfession: 'Architetta',
  initialLevel: level, partyMode: 'new', partyId: '', partyName: 'Lista di prova', partyAbbreviation: 'LDP', partyDescription: 'Partito fondato dal giocatore per il test.', partyOrientation: 'Altro', partyColor: '#285c42', parliamentStartMode: 'real-context', parliamentaryGroupId: level === 'deputato' ? 'cam-xix-04' : '',
  policyPositions: { economia: 3, welfare: 3, ambiente: 3, europa: 3 }, ...extra
});
const simulatedOnly = list => list.every(item => item.source === 'simulation');

let store = await load();
store.setRealReference({ twoPerThousand, parties, movements });

// 1. Mondo e primo sondaggio: nazionale, regionale e locale, margine d’errore, forze e figure simulate.
store.createCareer(draft('regionale'), [realParty], groups);
let state = store.getState();
let world = state.world;
assert.equal(world.source, 'simulation');
const playerPartyId = state.career.partyId;
assert.ok(world.parties.length >= 8, 'Il mondo comprende i partiti reali più scelti nel 2×1000 e il partito del giocatore.');
assert.equal(world.parties.find(item => item.isPlayer).id, playerPartyId);
assert.ok(world.parties.filter(item => !item.isPlayer).every(item => realIds.has(item.id) && item.refSource === 'real' && item.reference?.source === 'real'), 'Solo partiti reali, con il riferimento reale del 2×1000.');
assert.ok(!world.parties.some(item => ['scenario', 'demo', 'scissione'].includes(item.origin)), 'Nessuna forza inventata.');
const topParty = twoPerThousand.sort((a, b) => b.validChoices - a.validChoices)[0];
assert.ok(world.parties.some(item => item.id === topParty.partyId), 'Il partito più scelto nel 2×1000 è nel mondo.');
let poll = world.polls.at(-1);
assert.ok(poll.margin > 1.5 && poll.margin < 4.5, 'Il margine d’errore dipende dal campione.');
assert.ok(poll.results.reduce((sum, row) => sum + row.share, 0) <= 100.2);
assert.equal(Object.keys(poll.regional).length, 20, 'Consenso regionale per tutte le regioni.');
assert.ok(Number.isFinite(poll.local) && Number.isFinite(poll.regionalHome));
assert.ok(Number.isFinite(poll.personal.approval), 'Il gradimento personale è separato dal consenso del partito.');
assert.ok(simulatedOnly(world.parties) && simulatedOnly(world.figures) && simulatedOnly(world.polls) && simulatedOnly(world.alliances));
assert.ok(world.figures.every(figure => /simulat/i.test(figure.name)), 'Le figure simulate hanno etichette esplicite, non nomi realistici.');
assert.ok(state.game.relations.find(item => item.id === 'rival').label.includes('simulata'));

// 2. Trend, volatilità, eventi e reazioni nel corso delle settimane.
let reaction = null;
for (let week = 0; week < 16; week++) {
  store.advance(7);
  reaction ??= store.getState().game.inbox.find(item => item.templateId === 'presa-posizione');
}
state = store.getState();
world = state.world;
assert.ok(world.polls.length >= 16, 'Un sondaggio a settimana alimenta il trend.');
assert.ok(world.polls.slice(0, -1).every(item => item.regional === null) && world.polls.at(-1).regional, 'Lo storico tiene la mappa completa solo sull’ultimo sondaggio.');
const shares = world.polls.map(item => item.results.find(row => row.partyId === playerPartyId).share);
assert.ok(new Set(shares).size > 3, 'Il consenso varia da una settimana all’altra.');
assert.ok(world.events.some(event => event.kind === 'evento'), 'Eventi nazionali e territoriali entrano nella cronaca.');
assert.ok(state.game.lastReport.lines.some(line => line.startsWith('Sondaggio')), 'Il bilancio settimanale riporta il sondaggio.');
assert.ok(reaction, 'Un evento del mondo chiede una presa di posizione al giocatore.');
const pending = store.getState().game.inbox.find(item => item.templateId === 'presa-posizione');
if (pending) {
  const events = store.getState().world.events.length;
  store.resolveAgendaItem(pending.id, 'attacco');
  assert.ok(store.getState().world.events.length > events && store.getState().world.events[0].title.startsWith('Presa di posizione'));
}

// 3. Alleanze proposte dal giocatore: costi, esito e rottura.
const partner = store.getState().world.parties.find(item => !item.isPlayer);
const capital = store.getState().game.resources.politicalCapital;
const alliance = store.proposeAlliance(partner.id);
assert.equal(store.getState().game.resources.politicalCapital, capital - 4);
assert.ok(typeof alliance.success === 'boolean');
if (alliance.success) {
  const own = store.getState().world.alliances.find(item => item.withPlayer && item.status === 'active');
  store.breakAlliance(own.id);
  assert.equal(store.getState().world.alliances.find(item => item.id === own.id).status, 'broken');
}

// 4. Campagna: bonus dai sondaggi e avversari reali verificati della circoscrizione.
store.fastForwardToElection('politiche');
store.startCampaign({ electionType: 'politiche', role: 'deputato', objective: 'build' }, [realParty], { politicians, groups });
const campaign = store.getState().campaign;
assert.ok(Number.isFinite(campaign.preparation.pollBonus), 'Il sondaggio entra nella partenza della campagna.');
const opponents = campaign.candidates.filter(item => item.realReference);
assert.ok(opponents.length >= 2, 'Nelle politiche gli avversari sono deputati reali della circoscrizione.');
for (const opponent of opponents) {
  const person = politicians.find(item => item.id === opponent.realReference.politicianId);
  assert.equal(opponent.displayName, person.fullName, 'Nome e cognome esattamente come nel dataset.');
  assert.equal(opponent.realReference.groupId, person.groupId);
  assert.equal(opponent.realReference.electedOnList, person.electedOnList ?? null);
  assert.ok(person.circoscription.startsWith('Toscana'));
  assert.equal(opponent.realReference.source, 'real');
  assert.equal(opponent.source, 'simulation', 'I numeri della campagna restano simulati.');
}
assert.equal(new Set(opponents.map(item => item.realReference.groupId)).size, opponents.length, 'Avversari di gruppi diversi.');
store.clearCampaign();

// 5. Governo e mondo: cambi di maggioranza con una maggioranza fragile, gradimento nei sondaggi.
store.reset();
store.createCareer(draft('deputato', { partyMode: 'independent', partyId: '' }), [realParty], groups);
assert.equal(store.getState().world.playerPartyId, null, 'Un indipendente non ha un partito nei sondaggi, solo il gradimento personale.');
assert.throws(() => store.formGovernment(['cam-xix-01', 'cam-xix-03', 'cam-xix-04', 'senato-xix-gruppo-85', 'senato-xix-gruppo-33', 'senato-xix-gruppo-56']), /segretario/, 'Un indipendente non può formare un governo.');
store.reset();
store.createCareer(draft('deputato'), [realParty], groups);
store.formGovernment(['cam-xix-01', 'cam-xix-03', 'cam-xix-04', 'senato-xix-gruppo-85', 'senato-xix-gruppo-33', 'senato-xix-gruppo-56']);
store.negotiateGovernmentSupport('cam-xix-05');
store.voteGovernmentConfidence();
assert.equal(store.getState().parliament.government.status, 'active');
let shifted = false;
for (let week = 0; week < 25 && !shifted; week++) {
  store = await reload(saved => { if (saved.parliament.government.status === 'active') saved.parliament.government.stability = 25; });
  store.advance(7);
  shifted = store.getState().parliament.history.some(item => item.type === 'cambio-maggioranza');
}
assert.ok(shifted, 'Una maggioranza fragile può perdere pezzi da sola.');
assert.ok(store.getState().world.events.some(event => event.kind === 'maggioranza'));
assert.ok(store.getState().world.polls.some(item => item.government), 'Il gradimento del governo compare nei sondaggi.');

// 6. Salvataggio e ripristino del mondo.
const snapshot = JSON.stringify(store.getState().world);
store.save();
store = await load();
assert.equal(JSON.stringify(store.getState().world), snapshot);

// 7. Archivio amministrativo: override persistenti sopra il dataset reale, file originali intatti.
const realData = await import('../src/data/repositories/real-data.js?admin=1');
const admin = await import('../src/data/repositories/admin-store.js?admin=1');
await realData.loadRealCollections(['parties', 'politicalMovements', 'politicians']);
const original = realData.pristineRecord('parties', realParty.id);
admin.saveRecordOverride('parties', realParty.id, { officialName: 'Futuro Nazionale (nome corretto)', abbreviation: realParty.abbreviation, website: 'https://example.org' }, original);
realData.refreshAdminOverrides();
let edited = realData.realDatabase.parties.find(item => item.id === realParty.id);
assert.equal(edited.officialName, 'Futuro Nazionale (nome corretto)');
assert.deepEqual([...edited.adminEdited.fields].sort(), ['officialName', 'website']);
assert.equal(realData.pristineRecord('parties', realParty.id).officialName, realParty.officialName, 'L’originale resta disponibile per il ripristino.');
assert.throws(() => admin.saveRecordOverride('parties', realParty.id, { website: 'javascript:alert(1)' }, original), /http/);
const deputy = politicians.find(item => item.chamber === 'camera');
admin.setRecordField('politicians', deputy.id, 'partyId', realParty.id, deputy);
admin.addRoleOverride(deputy.id, { title: 'Responsabile nazionale enti locali', institution: realParty.officialName, startDate: '2026-01-10' });
realData.refreshAdminOverrides();
const person = realData.realDatabase.politicians.find(item => item.id === deputy.id);
assert.equal(person.partyId, realParty.id);
assert.equal(person.adminRoles[0].title, 'Responsabile nazionale enti locali');
// A code update reloads every module: the archive is read again from its own storage key.
const reloadedData = await import('../src/data/repositories/real-data.js?admin=2');
await reloadedData.loadRealCollections(['parties', 'politicians']);
assert.equal(reloadedData.realDatabase.parties.find(item => item.id === realParty.id).officialName, 'Futuro Nazionale (nome corretto)', 'Le modifiche sopravvivono al ricaricamento del codice.');
assert.ok(localStore.has('politicando.admin.overrides.v1') && localStore.has(KEY), 'Archivio amministrativo separato dal salvataggio di gioco.');
const exported = admin.exportAdminArchive();
admin.clearAdminArchive();
realData.refreshAdminOverrides();
assert.equal(realData.realDatabase.parties.find(item => item.id === realParty.id).officialName, realParty.officialName);
admin.importAdminArchive(exported);
realData.refreshAdminOverrides();
assert.equal(realData.realDatabase.parties.find(item => item.id === realParty.id).officialName, 'Futuro Nazionale (nome corretto)', 'Import/export ripristinano l’archivio.');
admin.resetRecordOverride('parties', realParty.id);
realData.refreshAdminOverrides();
assert.equal(realData.realDatabase.parties.find(item => item.id === realParty.id).adminEdited, undefined);
await admin.setAdminPin('segreto-123');
admin.lockAdmin();
assert.equal(admin.isAdminUnlocked(), false);
await assert.rejects(() => admin.unlockAdmin('sbagliato'), /PIN/);
await admin.unlockAdmin('segreto-123');
assert.equal(admin.isAdminUnlocked(), true);
store.reset();
assert.ok(localStore.has('politicando.admin.overrides.v1'), 'Una nuova partita non cancella l’archivio amministrativo.');

// 8. Il dataset reale su disco non cambia mai.
assert.equal(await raw('parties'), snapshots.parties);
assert.equal(await raw('politicians'), snapshots.politicians);

console.log('Sondaggi e mondo verificati: consenso nazionale/regionale/locale, gradimento personale, margine d’errore, trend, eventi e reazioni, alleanze, avversari reali verificati, cambi di maggioranza, salvataggio. Archivio amministrativo verificato: override persistenti, originali intatti, import/export, PIN.');
